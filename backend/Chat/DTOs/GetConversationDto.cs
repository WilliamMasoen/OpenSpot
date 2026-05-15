namespace OpenSpot.Chat.DTOs
{
    public record GetConversationDto(
        Guid Id,
        Guid ListingId,
        string ListingTitle,
        string? ListingImageUrl,
        string OtherUserId,
        string OtherUserName,
        DateTime CreatedAt,
        GetMessageDto? LastMessage,
        int UnreadCount);
}
