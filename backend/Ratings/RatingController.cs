using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSpot.Common;
using OpenSpot.Ratings.DTOs;
using OpenSpot.Ratings.Interfaces;

namespace OpenSpot.Ratings.Controllers
{
    [ApiController]
    [Route("api/ratings")]
    [Authorize]
    public class RatingsController : ControllerBase
    {
        private readonly IRatingService _ratingService;

        public RatingsController(IRatingService ratingService)
        {
            _ratingService = ratingService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateRating([FromBody] CreateRatingDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _ratingService.CreateRatingAsync(userId, dto, token);
            return result.Status switch
            {
                ResultStatus.Created => StatusCode(201, result.Data),
                ResultStatus.NotFound => NotFound(result.Message),
                ResultStatus.Forbidden => StatusCode(403, result.Message),
                ResultStatus.Conflict => Conflict(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpGet("pending")]
        public async Task<IActionResult> GetPending(CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _ratingService.GetPendingAsync(userId, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserRatings(string userId, CancellationToken token)
        {
            var result = await _ratingService.GetUserRatingsAsync(userId, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                _ => StatusCode(500, "Unexpected error.")
            };
        }
    }
}
