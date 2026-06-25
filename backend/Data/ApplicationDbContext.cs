using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using OpenSpot.Audit;
using OpenSpot.Chat.Models;
using OpenSpot.Data.Interfaces;
using OpenSpot.Listings.Models;
using OpenSpot.Notifications;
using OpenSpot.Ratings.Models;
using OpenSpot.RefreshTokens;
using OpenSpot.Sales.Models;
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
        public DbSet<Sale> Sales { get; set; }
        public DbSet<Rating> Ratings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
            modelBuilder.Entity<UserFavorite>().HasKey(f => new { f.UserId, f.ListingId });

            modelBuilder.Entity<Listing>().HasIndex(l => l.OwnerId);
            modelBuilder.Entity<Listing>().HasIndex(l => l.IsAvailable);
            modelBuilder.Entity<Listing>().HasIndex(l => l.CreatedAt);
            modelBuilder.Entity<Listing>().HasIndex(l => l.Price);

            modelBuilder.Entity<Message>().HasIndex(m => m.ConversationId);
            modelBuilder.Entity<Message>().HasIndex(m => m.SentAt);
            modelBuilder.Entity<Message>().HasIndex(m => m.IsRead);

            modelBuilder.Entity<Conversation>().HasIndex(c => c.BuyerId);
            modelBuilder.Entity<Conversation>().HasIndex(c => c.OwnerId);
            modelBuilder.Entity<Conversation>()
                .HasIndex(c => new { c.ListingId, c.BuyerId })
                .IsUnique();

            modelBuilder.Entity<Rating>().HasIndex(r => new { r.SaleId, r.ReviewerId }).IsUnique();
            modelBuilder.Entity<Rating>().HasIndex(r => r.RevieweeId);
            modelBuilder.Entity<Rating>().HasIndex(r => r.ReviewerId);

            modelBuilder.Entity<RefreshToken>().HasIndex(t => t.Token).IsUnique();
            modelBuilder.Entity<RefreshToken>().HasIndex(t => t.UserId);

            modelBuilder.Entity<Sale>().HasIndex(s => s.SellerId);
            modelBuilder.Entity<Sale>().HasIndex(s => s.BuyerId);

            modelBuilder.Entity<PushToken>().HasIndex(p => p.Token).IsUnique();
        }
    }
}