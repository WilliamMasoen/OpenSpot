using OpenSpot.Chat.DTOs;
using OpenSpot.Common;

namespace OpenSpot.Chat.Interfaces
{
    public interface IConversationService
    {
        Task<ServiceResult<GetConversationDto>> GetOrCreateConversationAsync(Guid listingId, string buyerId, CancellationToken token);
        Task<ServiceResult<List<GetConversationDto>>> GetConversationsAsync(string userId, CancellationToken token);
        Task<ServiceResult<List<GetMessageDto>>> GetMessagesAsync(Guid conversationId, string userId, CancellationToken token);
        Task<ServiceResult<GetMessageDto>> SendMessageAsync(Guid conversationId, string senderId, string body, CancellationToken token);
        Task<ServiceResult<object?>> MarkReadAsync(Guid conversationId, string userId, CancellationToken token);
    }
}
