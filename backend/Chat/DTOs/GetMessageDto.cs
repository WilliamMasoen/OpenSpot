namespace OpenSpot.Chat.DTOs
{
    public record GetMessageDto(
        Guid Id,
        Guid ConversationId,
        string SenderId,
        string SenderName,
        string Body,
        DateTime SentAt,
        bool IsRead);
}
