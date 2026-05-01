using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSpot.Users.DTOs;
using OpenSpot.Users.Models;
using Microsoft.AspNetCore.Identity;

namespace OpenSpot.Users.Controllers
{
    [ApiController]
    [Route("api/users")]
    [Authorize(Roles = "Admin")]
    public class UsersController : ControllerBase
    {
        private readonly UserManager<User> _userManager;

        public UsersController(UserManager<User> userManager)
        {
            _userManager = userManager;
        }

        [HttpGet]
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
    }
}
