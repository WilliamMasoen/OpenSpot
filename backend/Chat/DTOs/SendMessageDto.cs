using System.ComponentModel.DataAnnotations;

namespace OpenSpot.Chat.DTOs
{
    public record SendMessageDto(
        [Required, StringLength(1000, MinimumLength = 1)] string Body);
}
