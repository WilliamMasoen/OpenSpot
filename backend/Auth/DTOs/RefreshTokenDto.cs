using System.ComponentModel.DataAnnotations;

namespace OpenSpot.Auth.DTOs
{
    public class RefreshTokenDto
    {
        [Required]
        public string RefreshToken { get; set; } = string.Empty;
    }
}
