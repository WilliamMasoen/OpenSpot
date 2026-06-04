using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using OpenSpot.Audit;
using OpenSpot.Chat.Models;
using OpenSpot.Data.Interfaces;
using OpenSpot.Listings.Models;
using OpenSpot.Notifications;
using OpenSpot.RefreshTokens;
using OpenSpot.Users.Models;

namespace OpenSpot.Data
{
    public class ApplicationDbContext : IdentityDbContext<User>, IApplicationDbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> User { get; set; }
        public DbSet<Listing> Listing { get; set; }
        public DbSet<ListingImage> ListingImages { get; set; }
        public DbSet<UserFavorite> UserFavorites { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<Conversation> Conversations { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<PushToken> PushTokens { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
            modelBuilder.Entity<UserFavorite>().HasKey(f => new { f.UserId, f.ListingId });
            modelBuilder.Entity<PushToken>().HasIndex(p => p.Token).IsUnique();
            modelBuilder.Entity<Conversation>()
                .HasIndex(c => new { c.ListingId, c.BuyerId })
                .IsUnique();
        }
    }
}