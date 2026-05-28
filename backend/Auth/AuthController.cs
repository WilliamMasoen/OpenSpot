using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenSpot.Auth.DTOs;
using OpenSpot.Common;

namespace OpenSpot.Auth
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _authService.RegisterAsync(dto, token);
            return result.Status switch
            {
                ResultStatus.Created => StatusCode(201, result.Data),
                ResultStatus.Conflict => Conflict(result.Message),
                ResultStatus.ValidationError => BadRequest(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpPost("login")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _authService.LoginAsync(dto, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                ResultStatus.ValidationError => BadRequest(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh([FromBody] RefreshTokenDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _authService.RefreshAsync(dto.RefreshToken, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                ResultStatus.ValidationError => Unauthorized(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] RefreshTokenDto dto, CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _authService.LogoutAsync(userId, dto.RefreshToken, token);
            return result.Status switch
            {
                ResultStatus.NoContent => NoContent(),
                ResultStatus.NotFound => NotFound(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpPost("resend-verification")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ResendVerification([FromBody] ForgotPasswordDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            await _authService.ResendVerificationEmailAsync(dto.Email, token);
            return NoContent();
        }

        [HttpPost("forgot-password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            await _authService.ForgotPasswordAsync(dto.Email, token);
            return NoContent();
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _authService.ResetPasswordAsync(dto, token);
            return result.Status switch
            {
                ResultStatus.NoContent => NoContent(),
                ResultStatus.ValidationError => BadRequest(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpGet("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromQuery] string userId, [FromQuery] string token, CancellationToken cancellationToken)
        {
            var result = await _authService.VerifyEmailAsync(userId, token, cancellationToken);
            return result.Status switch
            {
                ResultStatus.NoContent => Ok("Email verified successfully."),
                ResultStatus.ValidationError => BadRequest(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }
    }
}
