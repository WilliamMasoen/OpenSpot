using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using OpenSpot.Auth.DTOs;
using OpenSpot.Common;
using OpenSpot.Config;
using OpenSpot.Data;
using OpenSpot.Email;
using OpenSpot.RefreshTokens;
using OpenSpot.Users.Models;

namespace OpenSpot.Auth
{
    public class AuthService : IAuthService
    {
        private readonly UserManager<User> _userManager;
        private readonly ApplicationDbContext _context;
        private readonly JwtOptions _jwtOptions;
        private readonly AppOptions _appOptions;
        private readonly IEmailService _emailService;

        public AuthService(
            UserManager<User> userManager,
            ApplicationDbContext context,
            IOptions<JwtOptions> jwtOptions,
            IOptions<AppOptions> appOptions,
            IEmailService emailService)
        {
            _userManager = userManager;
            _context = context;
            _jwtOptions = jwtOptions.Value;
            _appOptions = appOptions.Value;
            _emailService = emailService;
        }

        public async Task<ServiceResult<TokenResponseDto?>> RegisterAsync(RegisterDto dto, CancellationToken token)
        {
            var existing = await _userManager.FindByEmailAsync(dto.Email);
            if (existing != null)
                return ServiceResult<TokenResponseDto?>.Fail("Email already in use.", ResultStatus.Conflict);

            var user = new User
            {
                UserName = dto.Email,
                Email = dto.Email,
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                PhoneNumber = dto.PhoneNumber
            };

            var result = await _userManager.CreateAsync(user, dto.Password);
            if (!result.Succeeded)
                return ServiceResult<TokenResponseDto?>.Fail(
                    string.Join(", ", result.Errors.Select(e => e.Description)),
                    ResultStatus.ValidationError);

            await _userManager.AddToRoleAsync(user, "User");
            await SendVerificationEmailAsync(user);

            var response = await GenerateTokensAsync(user, token);
            return ServiceResult<TokenResponseDto?>.Created(response);
        }

        public async Task<ServiceResult<TokenResponseDto?>> LoginAsync(LoginDto dto, CancellationToken token)
        {
            var user = await _userManager.FindByEmailAsync(dto.Email);
            if (user == null || !await _userManager.CheckPasswordAsync(user, dto.Password))
                return ServiceResult<TokenResponseDto?>.Fail("Invalid email or password.", ResultStatus.ValidationError);

            if (!user.EmailConfirmed)
                return ServiceResult<TokenResponseDto?>.Fail("Please verify your email before logging in.", ResultStatus.ValidationError);

            var response = await GenerateTokensAsync(user, token);
            return ServiceResult<TokenResponseDto?>.Ok(response);
        }

        public async Task<ServiceResult<TokenResponseDto?>> RefreshAsync(string refreshToken, CancellationToken token)
        {
            var stored = await _context.RefreshTokens
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Token == refreshToken, token);

            if (stored == null || stored.IsRevoked || stored.ExpiresAt < DateTime.UtcNow)
                return ServiceResult<TokenResponseDto?>.Fail("Invalid or expired refresh token.", ResultStatus.ValidationError);

            _context.RefreshTokens.Remove(stored);
            await _context.SaveChangesAsync(token);

            var response = await GenerateTokensAsync(stored.User, token);
            return ServiceResult<TokenResponseDto?>.Ok(response);
        }

        public async Task<ServiceResult<bool?>> LogoutAsync(string userId, string refreshToken, CancellationToken token)
        {
            var stored = await _context.RefreshTokens
                .FirstOrDefaultAsync(t => t.Token == refreshToken && t.UserId == userId, token);

            if (stored == null)
                return ServiceResult<bool?>.Fail("Token not found.", ResultStatus.NotFound);

            _context.RefreshTokens.Remove(stored);
            await _context.SaveChangesAsync(token);

            return ServiceResult<bool?>.NoContent();
        }

        public async Task<ServiceResult<bool?>> ForgotPasswordAsync(string email, CancellationToken token)
        {
            var user = await _userManager.FindByEmailAsync(email);

            // Always return NoContent to avoid email enumeration
            if (user == null || !user.EmailConfirmed)
                return ServiceResult<bool?>.NoContent();

            var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
            var encodedToken = WebUtility.UrlEncode(resetToken);
            var resetUrl = $"{_appOptions.BaseUrl}/reset-password?userId={user.Id}&token={encodedToken}";

            await _emailService.SendAsync(
                user.Email!,
                "Reset your OpenSpot password",
                $"<p>Hi {user.FirstName},</p><p>Click <a href='{resetUrl}'>here</a> to reset your password. This link expires in 1 hour.</p><p>If you didn't request this, ignore this email.</p>");

            return ServiceResult<bool?>.NoContent();
        }

        public async Task<ServiceResult<bool?>> ResetPasswordAsync(ResetPasswordDto dto, CancellationToken token)
        {
            var user = await _userManager.FindByIdAsync(dto.UserId);
            if (user == null)
                return ServiceResult<bool?>.Fail("Invalid request.", ResultStatus.ValidationError);

            var result = await _userManager.ResetPasswordAsync(user, WebUtility.UrlDecode(dto.Token), dto.NewPassword);
            if (!result.Succeeded)
                return ServiceResult<bool?>.Fail(
                    string.Join(", ", result.Errors.Select(e => e.Description)),
                    ResultStatus.ValidationError);

            return ServiceResult<bool?>.NoContent();
        }

        public async Task<ServiceResult<bool?>> VerifyEmailAsync(string userId, string token, CancellationToken cancellationToken)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
                return ServiceResult<bool?>.Fail("Invalid request.", ResultStatus.ValidationError);

            var result = await _userManager.ConfirmEmailAsync(user, WebUtility.UrlDecode(token));
            if (!result.Succeeded)
                return ServiceResult<bool?>.Fail("Invalid or expired verification token.", ResultStatus.ValidationError);

            return ServiceResult<bool?>.NoContent();
        }

        private async Task<TokenResponseDto> GenerateTokensAsync(User user, CancellationToken token)
        {
            // Clean up expired tokens for this user
            var expired = await _context.RefreshTokens
                .Where(t => t.UserId == user.Id && (t.IsRevoked || t.ExpiresAt < DateTime.UtcNow))
                .ToListAsync(token);
            _context.RefreshTokens.RemoveRange(expired);

            var roles = await _userManager.GetRolesAsync(user);
            var accessToken = GenerateAccessToken(user, roles);

            var refreshToken = new RefreshToken
            {
                Id = Guid.NewGuid(),
                Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
                UserId = user.Id,
                ExpiresAt = DateTime.UtcNow.AddDays(_jwtOptions.RefreshTokenExpiryDays),
                CreatedAt = DateTime.UtcNow
            };

            await _context.RefreshTokens.AddAsync(refreshToken, token);
            await _context.SaveChangesAsync(token);

            return new TokenResponseDto
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken.Token,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_jwtOptions.AccessTokenExpiryMinutes),
                UserId = user.Id,
                Email = user.Email!,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Roles = roles
            };
        }

        private string GenerateAccessToken(User user, IList<string> roles)
        {
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id),
                new(JwtRegisteredClaimNames.Email, user.Email!),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new(ClaimTypes.NameIdentifier, user.Id),
            };

            claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.Secret));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var jwtToken = new JwtSecurityToken(
                issuer: _jwtOptions.Issuer,
                audience: _jwtOptions.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_jwtOptions.AccessTokenExpiryMinutes),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(jwtToken);
        }

        private async Task SendVerificationEmailAsync(User user)
        {
            var verificationToken = await _userManager.GenerateEmailConfirmationTokenAsync(user);
            var encodedToken = WebUtility.UrlEncode(verificationToken);
            var verificationUrl = $"{_appOptions.BaseUrl}/api/auth/verify-email?userId={user.Id}&token={encodedToken}";

            await _emailService.SendAsync(
                user.Email!,
                "Verify your OpenSpot account",
                $"<p>Hi {user.FirstName},</p><p>Click <a href='{verificationUrl}'>here</a> to verify your email.</p>");
        }
    }
}
