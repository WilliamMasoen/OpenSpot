using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSpot.Common;
using OpenSpot.Listings.DTOs;
using OpenSpot.Listings.Interfaces;

namespace OpenSpot.Listings.Controllers
{
    [ApiController]
    [Route("api/listings")]
    public class ListingsController : ControllerBase
    {
        private readonly IListingService _listingService;

        public ListingsController(IListingService listingService)
        {
            _listingService = listingService;
        }

        [HttpGet]
        public async Task<IActionResult> GetListings(CancellationToken token)
        {
            var result = await _listingService.GetListingsAsync(token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetListing(Guid id, CancellationToken token)
        {
            var result = await _listingService.GetListingByIdAsync(id, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                ResultStatus.NotFound => NotFound(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateListing([FromBody] CreateListingDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _listingService.CreateNewListingAsync(userId, dto, token);
            return result.Status switch
            {
                ResultStatus.Created => StatusCode(201, result.Data),
                ResultStatus.Conflict => Conflict(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [Authorize]
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> UpdateListing(Guid id, [FromBody] UpdateListingDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _listingService.UpdateListingAsync(id, userId, dto, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                ResultStatus.NotFound => NotFound(result.Message),
                ResultStatus.Forbidden => StatusCode(403, result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [Authorize]
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteListing(Guid id, CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _listingService.DeleteListingAsync(id, userId, token);
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
