using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSpot.Common;
using OpenSpot.Data;
using OpenSpot.Listings.DTOs;
using OpenSpot.Listings.Interfaces;
using OpenSpot.Sales.DTOs;
using OpenSpot.Sales.Models;

namespace OpenSpot.Listings.Controllers
{
    [ApiController]
    [Route("api/listings")]
    public class ListingsController : ControllerBase
    {
        private readonly IListingService _listingService;
        private readonly ApplicationDbContext _db;

        public ListingsController(IListingService listingService, ApplicationDbContext db)
        {
            _listingService = listingService;
            _db = db;
        }

        [HttpGet]
        public async Task<IActionResult> GetListings(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? sortBy = null,
            [FromQuery] int? maxPrice = null,
            [FromQuery] double? lat = null,
            [FromQuery] double? lng = null,
            CancellationToken token = default)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 20;

            var requesterId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var result = await _listingService.GetListingsAsync(requesterId, page, pageSize, sortBy, maxPrice, lat, lng, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchListings(
            [FromQuery] string? q,
            [FromQuery] double? lat,
            [FromQuery] double? lng,
            [FromQuery] double radius = 5,
            CancellationToken token = default)
        {
            var requesterId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var result = await _listingService.SearchListingsAsync(q, lat, lng, radius, requesterId, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetListing(Guid id, CancellationToken token)
        {
            var requesterId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var result = await _listingService.GetListingByIdAsync(id, requesterId, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                ResultStatus.NotFound => NotFound(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [Authorize]
        [HttpGet("mine")]
        public async Task<IActionResult> GetMyListings(CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _listingService.GetMyListingsAsync(userId, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [Authorize]
        [HttpGet("favorites")]
        public async Task<IActionResult> GetFavorites(CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _listingService.GetFavoritesAsync(userId, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [Authorize]
        [HttpPost("{id:guid}/favorite")]
        public async Task<IActionResult> ToggleFavorite(Guid id, CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _listingService.ToggleFavoriteAsync(userId, id, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(new { isFavorited = result.Data }),
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

            if (result.Status == ResultStatus.NoContent)
            {
                var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", id.ToString());
                if (Directory.Exists(uploadsDir))
                    Directory.Delete(uploadsDir, recursive: true);
            }

            return result.Status switch
            {
                ResultStatus.NoContent => NoContent(),
                ResultStatus.NotFound => NotFound(result.Message),
                ResultStatus.Forbidden => StatusCode(403, result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [Authorize]
        [HttpPatch("{id:guid}/availability")]
        public async Task<IActionResult> SetAvailability(Guid id, [FromBody] UpdateAvailabilityDto dto, CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await _listingService.SetAvailabilityAsync(id, userId, dto.IsAvailable, token);
            return result.Status switch
            {
                ResultStatus.Ok => Ok(result.Data),
                ResultStatus.NotFound => NotFound(result.Message),
                ResultStatus.Forbidden => StatusCode(403, result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }

        [Authorize]
        [HttpGet("{id:guid}/conversation-buyers")]
        public async Task<IActionResult> GetConversationBuyers(Guid id, CancellationToken token)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;

            var listing = await _db.Listing.FindAsync(new object[] { id }, token);
            if (listing is null) return NotFound("Listing not found.");
            if (listing.OwnerId != userId) return StatusCode(403, "You do not own this listing.");

            var buyers = await _db.Conversations
                .Where(c => c.ListingId == id)
                .Select(c => new
                {
                    c.BuyerId,
                    BuyerFirstName = c.Buyer.FirstName,
                    BuyerLastName = c.Buyer.LastName,
                    BuyerProfileImageUrl = c.Buyer.ProfileImageUrl,
                })
                .ToListAsync(token);

            return Ok(buyers.Select(b => new
            {
                id = b.BuyerId,
                name = $"{b.BuyerFirstName} {b.BuyerLastName}".Trim(),
                profileImageUrl = b.BuyerProfileImageUrl,
            }));
        }

        [Authorize]
        [HttpPost("{id:guid}/sale")]
        public async Task<IActionResult> CreateSale(Guid id, [FromBody] CreateSaleDto dto, CancellationToken token)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;

            var listing = await _db.Listing.FindAsync(new object[] { id }, token);
            if (listing is null) return NotFound("Listing not found.");
            if (listing.OwnerId != userId) return StatusCode(403, "You do not own this listing.");
            if (!listing.IsAvailable) return Conflict("Listing is already marked as rented.");

            var buyerExists = await _db.Users.AnyAsync(u => u.Id == dto.BuyerId, token);
            if (!buyerExists) return NotFound("Buyer not found.");

            listing.IsAvailable = false;
            var sale = new Sale
            {
                Id = Guid.NewGuid(),
                ListingId = id,
                SellerId = userId,
                BuyerId = dto.BuyerId,
                CreatedAt = DateTime.UtcNow,
            };
            _db.Sales.Add(sale);
            await _db.SaveChangesAsync(token);

            return StatusCode(201, new { saleId = sale.Id });
        }

        [Authorize]
        [HttpPost("{id:guid}/images")]
        public async Task<IActionResult> UploadImage(Guid id, IFormFile file, CancellationToken token)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file provided.");

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            string[] allowed = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
            if (!allowed.Contains(ext))
                return BadRequest("Unsupported file type. Allowed: jpg, jpeg, png, webp, heic.");

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;

            var listing = await _listingService.GetListingByIdAsync(id, null, token);
            if (listing.Status == ResultStatus.NotFound)
                return NotFound("Listing not found.");
            if (listing.Data!.OwnerId != userId)
                return StatusCode(403, "You do not own this listing.");
            var filename = $"{Guid.NewGuid()}{ext}";
            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", id.ToString());
            Directory.CreateDirectory(uploadsDir);

            var filePath = Path.Combine(uploadsDir, filename);
            using (var stream = System.IO.File.Create(filePath))
                await file.CopyToAsync(stream, token);

            var url = $"{Request.Scheme}://{Request.Host}/uploads/{id}/{filename}";
            var result = await _listingService.AddImageAsync(id, url, token);

            return result.Status switch
            {
                ResultStatus.Created => StatusCode(201, new { url }),
                ResultStatus.NotFound => NotFound(result.Message),
                _ => StatusCode(500, "Unexpected error.")
            };
        }
    }
}
