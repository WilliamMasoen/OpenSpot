using OpenSpot.Auth.DTOs;
using OpenSpot.Common;

namespace OpenSpot.Auth
{
    public interface IAuthService
    {
        Task<ServiceResult<TokenResponseDto?>> RegisterAsync(RegisterDto dto, CancellationToken token);
        Task<ServiceResult<TokenResponseDto?>> LoginAsync(LoginDto dto, CancellationToken token);
        Task<ServiceResult<TokenResponseDto?>> RefreshAsync(string refreshToken, CancellationToken token);
        Task<ServiceResult<bool?>> LogoutAsync(string userId, string refreshToken, CancellationToken token);
        Task<ServiceResult<bool?>> ForgotPasswordAsync(string email, CancellationToken token);
        Task<ServiceResult<bool?>> ResetPasswordAsync(ResetPasswordDto dto, CancellationToken token);
        Task<ServiceResult<bool?>> VerifyEmailAsync(string userId, string token, CancellationToken cancellationToken);
        Task<ServiceResult<bool?>> ResendVerificationEmailAsync(string email, CancellationToken token);
    }
}
