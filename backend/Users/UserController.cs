using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSpot.Data;
using OpenSpot.Notifications;
using OpenSpot.Listings.DTOs;
using OpenSpot.Ratings.DTOs;
using OpenSpot.Users.DTOs;
using OpenSpot.Users.Models;
using Microsoft.AspNetCore.Identity;

namespace OpenSpot.Users.Controllers
{
    [ApiController]
    [Route("api/users")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly UserManager<User> _userManager;
        private readonly ApplicationDbContext _db;

        public UsersController(UserManager<User> userManager, ApplicationDbContext db)
        {
            _userManager = userManager;
            _db = db;
        }

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetUsersAsync(CancellationToken token)
        {
            var users = await _userManager.Users.ToListAsync(token);

            var dto = users.Select(u => new GetUserDto
            {
                Id = u.Id,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email,
                PhoneNumber = u.PhoneNumber
            });

            return Ok(dto);
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetUserByIdAsync([FromRoute] string id, CancellationToken token)
        {
            var user = await _userManager.Users.FirstOrDefaultAsync(u => u.Id == id, token);
            if (user == null)
                return NotFound("User doesn't exist.");

            var dto = new GetUserDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber
            };

            return Ok(dto);
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetMeAsync()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound();

            return Ok(new GetUserDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email ?? string.Empty,
                PhoneNumber = user.PhoneNumber ?? string.Empty,
                ProfileImageUrl = user.ProfileImageUrl,
            });
        }

        [HttpPost("push-token")]
        public async Task<IActionResult> SavePushTokenAsync([FromBody] SavePushTokenDto dto, CancellationToken token)
        {
            if (string.IsNullOrWhiteSpace(dto.Token))
                return BadRequest("Token is required.");

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;

            var exists = await _db.PushTokens.AnyAsync(p => p.Token == dto.Token, token);
            if (!exists)
            {
                _db.PushTokens.Add(new PushToken
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Token = dto.Token,
                    CreatedAt = DateTime.UtcNow,
                });
                await _db.SaveChangesAsync(token);
            }

            return NoContent();
        }

        [HttpDelete("push-token")]
        public async Task<IActionResult> DeletePushTokenAsync([FromBody] SavePushTokenDto dto, CancellationToken token)
        {
            if (string.IsNullOrWhiteSpace(dto.Token))
                return BadRequest("Token is required.");

            var row = await _db.PushTokens.FirstOrDefaultAsync(p => p.Token == dto.Token, token);
            if (row is not null)
            {
                _db.PushTokens.Remove(row);
                await _db.SaveChangesAsync(token);
            }

            return NoContent();
        }

        [HttpPut("me")]
        public async Task<IActionResult> UpdateMeAsync([FromBody] UpdateUserDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound();

            user.FirstName = dto.FirstName ?? user.FirstName;
            user.LastName = dto.LastName ?? user.LastName;
            user.PhoneNumber = dto.PhoneNumber ?? user.PhoneNumber;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
                return BadRequest(string.Join(", ", result.Errors.Select(e => e.Description)));

            return Ok(new GetUserDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email ?? string.Empty,
                PhoneNumber = user.PhoneNumber ?? string.Empty,
                ProfileImageUrl = user.ProfileImageUrl,
            });
        }

        [HttpPost("me/photo")]
        public async Task<IActionResult> UploadPhotoAsync(IFormFile file, CancellationToken token)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file provided.");

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            string[] allowed = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
            if (!allowed.Contains(ext))
                return BadRequest("Unsupported file type.");

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound();

            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "profiles", userId);
            Directory.CreateDirectory(uploadsDir);

            // Remove previous photo files
            foreach (var old in Directory.GetFiles(uploadsDir))
                System.IO.File.Delete(old);

            var filename = $"{Guid.NewGuid()}{ext}";
            var filePath = Path.Combine(uploadsDir, filename);
            using (var stream = System.IO.File.Create(filePath))
                await file.CopyToAsync(stream, token);

            var url = $"{Request.Scheme}://{Request.Host}/uploads/profiles/{userId}/{filename}";
            user.ProfileImageUrl = url;
            await _userManager.UpdateAsync(user);

            return Ok(new { url });
        }

        [HttpGet("{id}/profile")]
        public async Task<IActionResult> GetUserProfileAsync(string id, CancellationToken token)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null) return NotFound("User not found.");

            var listings = await _db.Listing
                .AsNoTracking()
                .Include(l => l.Images)
                .Include(l => l.Owner)
                .Where(l => l.OwnerId == id)
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync(token);

            var ratingSummary = await _db.Ratings
                .Where(r => r.RevieweeId == id)
                .GroupBy(r => r.RevieweeId)
                .Select(g => new { Avg = (double?)g.Average(r => r.Stars), Count = g.Count() })
                .FirstOrDefaultAsync(token);

            var recentRatingsRaw = await _db.Ratings
                .AsNoTracking()
                .Include(r => r.Reviewer)
                .Where(r => r.RevieweeId == id)
                .OrderByDescending(r => r.CreatedAt)
                .Take(3)
                .ToListAsync(token);

            double? avgRating = ratingSummary?.Avg;
            int totalRatings = ratingSummary?.Count ?? 0;

            var recentRatings = recentRatingsRaw.Select(r => new GetRatingDto
            {
                Id = r.Id,
                SaleId = r.SaleId,
                ReviewerId = r.ReviewerId,
                ReviewerName = $"{r.Reviewer.FirstName} {r.Reviewer.LastName}".Trim(),
                ReviewerProfileImageUrl = r.Reviewer.ProfileImageUrl,
                Stars = r.Stars,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt,
            }).ToList();

            return Ok(new UserProfileDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                ProfileImageUrl = user.ProfileImageUrl,
                AverageRating = avgRating,
                TotalRatings = totalRatings,
                MemberSince = user.CreatedAt,
                ListingCount = listings.Count,
                RecentRatings = recentRatings,
                Listings = listings.Select(l => new GetListingDto(l, null, avgRating, totalRatings)).ToList(),
            });
        }
    }
}
