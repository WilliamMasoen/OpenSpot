using Microsoft.EntityFrameworkCore;
using OpenSpot.Listings.Models;
using OpenSpot.RefreshTokens;
using OpenSpot.Users.Models;

namespace OpenSpot.Data.Interfaces
{
    public interface IApplicationDbContext
    {
        DbSet<User> Users { get; }
        DbSet<Listing> Listing { get; set; }
        DbSet<RefreshToken> RefreshTokens { get; set; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
