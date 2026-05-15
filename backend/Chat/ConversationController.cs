using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSpot.Chat.DTOs;
using OpenSpot.Chat.Interfaces;
using OpenSpot.Common;

namespace OpenSpot.Chat.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/conversations")]
    public class ConversationController : ControllerBase
    {
        private readonly IConversationService _svc;

        public ConversationController(IConversationService svc)
        {
            _svc = svc;
        }

        [HttpPost]
        public async Task<IActionResult> StartConversation([FromBody] StartConversationDto dto, CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _svc.GetOrCreateConversationAsync(dto.ListingId, userId, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                ResultStatus.Created => StatusCode(201, result.Data),
                ResultStatus.NotFound => NotFound(result.Message),
                ResultStatus.Forbidden => StatusCode(403, result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpGet]
        public async Task<IActionResult> GetConversations(CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _svc.GetConversationsAsync(userId, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpGet("{id:guid}/messages")]
        public async Task<IActionResult> GetMessages(Guid id, CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _svc.GetMessagesAsync(id, userId, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                ResultStatus.NotFound => NotFound(result.Message),
                ResultStatus.Forbidden => StatusCode(403, result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpPost("{id:guid}/messages")]
        public async Task<IActionResult> SendMessage(Guid id, [FromBody] SendMessageDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _svc.SendMessageAsync(id, userId, dto.Body, token);
            return result.Status switch
            {
                ResultStatus.Created => StatusCode(201, result.Data),
                ResultStatus.NotFound => NotFound(result.Message),
                ResultStatus.Forbidden => StatusCode(403, result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpPut("{id:guid}/read")]
        public async Task<IActionResult> MarkRead(Guid id, CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _svc.MarkReadAsync(id, userId, token);
            return result.Status switch
            {
                ResultStatus.NoContent => NoContent(),
                ResultStatus.NotFound => NotFound(result.Message),
                ResultStatus.Forbidden => StatusCode(403, result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }
    }
}
