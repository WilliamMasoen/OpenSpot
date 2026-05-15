using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using OpenSpot.Chat.DTOs;
using OpenSpot.Chat.Hubs;
using OpenSpot.Chat.Interfaces;
using OpenSpot.Chat.Models;
using OpenSpot.Common;
using OpenSpot.Data;

namespace OpenSpot.Chat.Services
{
    public class ConversationService : IConversationService
    {
        private readonly ApplicationDbContext _db;
        private readonly IHubContext<ChatHub> _hub;

        public ConversationService(ApplicationDbContext db, IHubContext<ChatHub> hub)
        {
            _db = db;
            _hub = hub;
        }

        public async Task<ServiceResult<GetConversationDto>> GetOrCreateConversationAsync(Guid listingId, string buyerId, CancellationToken token)
        {
            var listing = await _db.Listing.FindAsync(new object[] { listingId }, token);
            if (listing is null)
                return ServiceResult<GetConversationDto>.Fail("Listing not found.", ResultStatus.NotFound);

            if (listing.OwnerId == buyerId)
                return ServiceResult<GetConversationDto>.Fail("Cannot message your own listing.", ResultStatus.Forbidden);

            var existing = await _db.Conversations
                .FirstOrDefaultAsync(c => c.ListingId == listingId && c.BuyerId == buyerId, token);

            Conversation conv;
            bool created;
            if (existing is not null)
            {
                conv = existing;
                created = false;
            }
            else
            {
                conv = new Conversation
                {
                    Id = Guid.NewGuid(),
                    ListingId = listingId,
                    BuyerId = buyerId,
                    OwnerId = listing.OwnerId,
                    CreatedAt = DateTime.UtcNow,
                };
                _db.Conversations.Add(conv);
                await _db.SaveChangesAsync(token);
                created = true;
            }

            var dto = await BuildConversationDtoAsync(conv.Id, buyerId, token);
            return created
                ? ServiceResult<GetConversationDto>.Created(dto)
                : ServiceResult<GetConversationDto>.Ok(dto);
        }

        public async Task<ServiceResult<List<GetConversationDto>>> GetConversationsAsync(string userId, CancellationToken token)
        {
            var rows = await _db.Conversations
                .Where(c => c.BuyerId == userId || c.OwnerId == userId)
                .Select(c => new
                {
                    c.Id,
                    c.ListingId,
                    ListingTitle = c.Listing.Title,
                    c.BuyerId,
                    BuyerFirstName = c.Buyer.FirstName,
                    BuyerLastName = c.Buyer.LastName,
                    c.OwnerId,
                    OwnerFirstName = c.Owner.FirstName,
                    OwnerLastName = c.Owner.LastName,
                    c.CreatedAt,
                    ListingImageUrl = c.Listing.Images.Select(i => i.Url).FirstOrDefault(),
                    LastMessage = c.Messages
                        .OrderByDescending(m => m.SentAt)
                        .Select(m => new
                        {
                            m.Id,
                            m.ConversationId,
                            m.SenderId,
                            SenderFirstName = m.Sender.FirstName,
                            SenderLastName = m.Sender.LastName,
                            m.Body,
                            m.SentAt,
                            m.IsRead,
                        })
                        .FirstOrDefault(),
                    UnreadCount = c.Messages.Count(m => !m.IsRead && m.SenderId != userId),
                })
                .OrderByDescending(c => c.LastMessage != null ? (DateTime?)c.LastMessage.SentAt : c.CreatedAt)
                .ToListAsync(token);

            var dtos = rows.Select(r =>
            {
                var isOwner = r.OwnerId == userId;
                var otherUserId = isOwner ? r.BuyerId : r.OwnerId;
                var otherUserName = (isOwner
                    ? $"{r.BuyerFirstName} {r.BuyerLastName}"
                    : $"{r.OwnerFirstName} {r.OwnerLastName}").Trim();

                GetMessageDto? lastMsg = null;
                if (r.LastMessage is not null)
                {
                    var senderName = $"{r.LastMessage.SenderFirstName} {r.LastMessage.SenderLastName}".Trim();
                    lastMsg = new GetMessageDto(
                        r.LastMessage.Id, r.LastMessage.ConversationId,
                        r.LastMessage.SenderId, senderName,
                        r.LastMessage.Body, r.LastMessage.SentAt, r.LastMessage.IsRead);
                }

                return new GetConversationDto(
                    r.Id, r.ListingId, r.ListingTitle, r.ListingImageUrl,
                    otherUserId, otherUserName, r.CreatedAt, lastMsg, r.UnreadCount);
            }).ToList();

            return ServiceResult<List<GetConversationDto>>.Ok(dtos);
        }

        public async Task<ServiceResult<List<GetMessageDto>>> GetMessagesAsync(Guid conversationId, string userId, CancellationToken token)
        {
            var conv = await _db.Conversations.FindAsync(new object[] { conversationId }, token);
            if (conv is null)
                return ServiceResult<List<GetMessageDto>>.Fail("Conversation not found.", ResultStatus.NotFound);
            if (conv.BuyerId != userId && conv.OwnerId != userId)
                return ServiceResult<List<GetMessageDto>>.Fail("Access denied.", ResultStatus.Forbidden);

            var unread = await _db.Messages
                .Where(m => m.ConversationId == conversationId && !m.IsRead && m.SenderId != userId)
                .ToListAsync(token);

            if (unread.Count > 0)
            {
                unread.ForEach(m => m.IsRead = true);
                await _db.SaveChangesAsync(token);
            }

            var raw = await _db.Messages
                .Where(m => m.ConversationId == conversationId)
                .OrderBy(m => m.SentAt)
                .Select(m => new
                {
                    m.Id,
                    m.ConversationId,
                    m.SenderId,
                    SenderFirstName = m.Sender.FirstName,
                    SenderLastName = m.Sender.LastName,
                    m.Body,
                    m.SentAt,
                })
                .ToListAsync(token);

            var messages = raw
                .Select(m => new GetMessageDto(
                    m.Id, m.ConversationId, m.SenderId,
                    $"{m.SenderFirstName} {m.SenderLastName}".Trim(),
                    m.Body, m.SentAt, true))
                .ToList();

            return ServiceResult<List<GetMessageDto>>.Ok(messages);
        }

        public async Task<ServiceResult<GetMessageDto>> SendMessageAsync(Guid conversationId, string senderId, string body, CancellationToken token)
        {
            var conv = await _db.Conversations.FindAsync(new object[] { conversationId }, token);
            if (conv is null)
                return ServiceResult<GetMessageDto>.Fail("Conversation not found.", ResultStatus.NotFound);
            if (conv.BuyerId != senderId && conv.OwnerId != senderId)
                return ServiceResult<GetMessageDto>.Fail("Access denied.", ResultStatus.Forbidden);

            var sender = await _db.Users.FindAsync(new object[] { senderId }, token);
            var senderName = sender is not null
                ? $"{sender.FirstName} {sender.LastName}".Trim()
                : senderId;

            var message = new Message
            {
                Id = Guid.NewGuid(),
                ConversationId = conversationId,
                SenderId = senderId,
                Body = body,
                SentAt = DateTime.UtcNow,
                IsRead = false,
            };
            _db.Messages.Add(message);
            await _db.SaveChangesAsync(token);

            var dto = new GetMessageDto(
                message.Id, message.ConversationId, senderId,
                senderName, body, message.SentAt, false);

            var recipientId = conv.BuyerId == senderId ? conv.OwnerId : conv.BuyerId;
            await _hub.Clients.Group($"user_{recipientId}")
                .SendAsync("ReceiveMessage", dto, conversationId.ToString(), cancellationToken: token);

            return ServiceResult<GetMessageDto>.Created(dto);
        }

        public async Task<ServiceResult<object?>> MarkReadAsync(Guid conversationId, string userId, CancellationToken token)
        {
            var conv = await _db.Conversations.FindAsync(new object[] { conversationId }, token);
            if (conv is null)
                return ServiceResult<object?>.Fail("Conversation not found.", ResultStatus.NotFound);
            if (conv.BuyerId != userId && conv.OwnerId != userId)
                return ServiceResult<object?>.Fail("Access denied.", ResultStatus.Forbidden);

            var unread = await _db.Messages
                .Where(m => m.ConversationId == conversationId && !m.IsRead && m.SenderId != userId)
                .ToListAsync(token);

            if (unread.Count > 0)
            {
                unread.ForEach(m => m.IsRead = true);
                await _db.SaveChangesAsync(token);
            }

            return ServiceResult<object?>.NoContent();
        }

        private async Task<GetConversationDto> BuildConversationDtoAsync(Guid conversationId, string requesterId, CancellationToken token)
        {
            var row = await _db.Conversations
                .Where(c => c.Id == conversationId)
                .Select(c => new
                {
                    c.Id,
                    c.ListingId,
                    ListingTitle = c.Listing.Title,
                    c.BuyerId,
                    BuyerFirstName = c.Buyer.FirstName,
                    BuyerLastName = c.Buyer.LastName,
                    c.OwnerId,
                    OwnerFirstName = c.Owner.FirstName,
                    OwnerLastName = c.Owner.LastName,
                    c.CreatedAt,
                    ListingImageUrl = c.Listing.Images.Select(i => i.Url).FirstOrDefault(),
                    LastMessage = c.Messages
                        .OrderByDescending(m => m.SentAt)
                        .Select(m => new
                        {
                            m.Id, m.ConversationId, m.SenderId,
                            SenderFirstName = m.Sender.FirstName,
                            SenderLastName = m.Sender.LastName,
                            m.Body, m.SentAt, m.IsRead,
                        })
                        .FirstOrDefault(),
                    UnreadCount = c.Messages.Count(m => !m.IsRead && m.SenderId != requesterId),
                })
                .FirstAsync(token);

            var isOwner = row.OwnerId == requesterId;
            var otherUserId = isOwner ? row.BuyerId : row.OwnerId;
            var otherUserName = (isOwner
                ? $"{row.BuyerFirstName} {row.BuyerLastName}"
                : $"{row.OwnerFirstName} {row.OwnerLastName}").Trim();

            GetMessageDto? lastMsg = null;
            if (row.LastMessage is not null)
            {
                var senderName = $"{row.LastMessage.SenderFirstName} {row.LastMessage.SenderLastName}".Trim();
                lastMsg = new GetMessageDto(
                    row.LastMessage.Id, row.LastMessage.ConversationId,
                    row.LastMessage.SenderId, senderName,
                    row.LastMessage.Body, row.LastMessage.SentAt, row.LastMessage.IsRead);
            }

            return new GetConversationDto(
                row.Id, row.ListingId, row.ListingTitle, row.ListingImageUrl,
                otherUserId, otherUserName, row.CreatedAt, lastMsg, row.UnreadCount);
        }
    }
}
