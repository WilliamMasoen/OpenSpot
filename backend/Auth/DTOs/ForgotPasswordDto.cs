using System.ComponentModel.DataAnnotations;

namespace OpenSpot.Auth.DTOs
{
    public class ForgotPasswordDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;
    }
}
