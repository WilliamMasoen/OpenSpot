using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSpot.Data;
using OpenSpot.Notifications;
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
                PhoneNumber = user.PhoneNumber ?? string.Empty
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
                PhoneNumber = user.PhoneNumber ?? string.Empty
            });
        }
    }
}
