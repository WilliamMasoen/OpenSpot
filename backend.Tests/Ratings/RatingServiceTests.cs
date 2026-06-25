using Microsoft.EntityFrameworkCore;
using OpenSpot.Common;
using OpenSpot.Listings.Models;
using OpenSpot.Ratings.DTOs;
using OpenSpot.Ratings.Models;
using OpenSpot.Ratings.Services;
using OpenSpot.Sales.Models;
using OpenSpot.Tests.Helpers;
using OpenSpot.Users.Models;

namespace OpenSpot.Tests.Ratings;

public class RatingServiceTests : IDisposable
{
    private readonly DbContextFactory _factory;

    public RatingServiceTests()
    {
        _factory = new DbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    // ── Helpers ────────────────────────────────────────────────────────────

    private RatingService CreateService() => new(_factory.CreateContext());

    private static User MakeUser(string id, string email) => new()
    {
        Id = id,
        UserName = email,
        NormalizedUserName = email.ToUpperInvariant(),
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        EmailConfirmed = true,
        SecurityStamp = Guid.NewGuid().ToString(),
        ConcurrencyStamp = Guid.NewGuid().ToString(),
        FirstName = "First" + id,
        LastName = "Last" + id,
    };

    private static Listing MakeListing(string ownerId) => new()
    {
        Id = Guid.NewGuid(),
        Title = "Test Listing",
        Description = "desc",
        Address = "123 Main St",
        Price = 100,
        StartDate = DateOnly.FromDateTime(DateTime.Today),
        EndDate = DateOnly.FromDateTime(DateTime.Today.AddMonths(1)),
        IsAvailable = true,
        CreatedAt = DateTime.UtcNow,
        OwnerId = ownerId,
    };

    private async Task<(User seller, User buyer, Sale sale)> SeedSaleAsync()
    {
        var seller = MakeUser("seller-1", "seller@test.com");
        var buyer = MakeUser("buyer-1", "buyer@test.com");
        var listing = MakeListing(seller.Id);
        var sale = new Sale
        {
            Id = Guid.NewGuid(),
            ListingId = listing.Id,
            SellerId = seller.Id,
            BuyerId = buyer.Id,
            CreatedAt = DateTime.UtcNow,
        };

        using var ctx = _factory.CreateContext();
        ctx.Users.AddRange(seller, buyer);
        ctx.Listing.Add(listing);
        ctx.Sales.Add(sale);
        await ctx.SaveChangesAsync();

        return (seller, buyer, sale);
    }

    // ── CreateRatingAsync ──────────────────────────────────────────────────

    [Fact]
    public async Task CreateRatingAsync_SaleNotFound_ReturnsNotFound()
    {
        var result = await CreateService().CreateRatingAsync(
            "any-user",
            new CreateRatingDto { SaleId = Guid.NewGuid(), Stars = 5 },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task CreateRatingAsync_ReviewerNotInSale_ReturnsForbidden()
    {
        var (_, _, sale) = await SeedSaleAsync();

        var result = await CreateService().CreateRatingAsync(
            "unrelated-user",
            new CreateRatingDto { SaleId = sale.Id, Stars = 4 },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task CreateRatingAsync_AlreadyRated_ReturnsConflict()
    {
        var (seller, buyer, sale) = await SeedSaleAsync();

        // Seed an existing rating from buyer
        using var ctx = _factory.CreateContext();
        ctx.Ratings.Add(new Rating
        {
            Id = Guid.NewGuid(),
            SaleId = sale.Id,
            ReviewerId = buyer.Id,
            RevieweeId = seller.Id,
            Stars = 3,
            CreatedAt = DateTime.UtcNow,
        });
        await ctx.SaveChangesAsync();

        var result = await CreateService().CreateRatingAsync(
            buyer.Id,
            new CreateRatingDto { SaleId = sale.Id, Stars = 5 },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Conflict, result.Status);
    }

    [Fact]
    public async Task CreateRatingAsync_SellerRatesBuyer_SetsRevieweeIdToBuyer()
    {
        var (seller, buyer, sale) = await SeedSaleAsync();

        var result = await CreateService().CreateRatingAsync(
            seller.Id,
            new CreateRatingDto { SaleId = sale.Id, Stars = 4 },
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Created, result.Status);

        using var ctx = _factory.CreateContext();
        var saved = await ctx.Ratings.SingleAsync();
        Assert.Equal(buyer.Id, saved.RevieweeId);
        Assert.Equal(seller.Id, saved.ReviewerId);
    }

    [Fact]
    public async Task CreateRatingAsync_BuyerRatesSeller_SetsRevieweeIdToSeller()
    {
        var (seller, buyer, sale) = await SeedSaleAsync();

        var result = await CreateService().CreateRatingAsync(
            buyer.Id,
            new CreateRatingDto { SaleId = sale.Id, Stars = 5, Comment = "Great!" },
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Created, result.Status);

        using var ctx = _factory.CreateContext();
        var saved = await ctx.Ratings.SingleAsync();
        Assert.Equal(seller.Id, saved.RevieweeId);
        Assert.Equal(buyer.Id, saved.ReviewerId);
        Assert.Equal(5, saved.Stars);
        Assert.Equal("Great!", saved.Comment);
    }

    [Fact]
    public async Task CreateRatingAsync_Success_ReturnsDtoWithReviewerName()
    {
        var (seller, buyer, sale) = await SeedSaleAsync();

        var result = await CreateService().CreateRatingAsync(
            buyer.Id,
            new CreateRatingDto { SaleId = sale.Id, Stars = 3 },
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal($"{buyer.FirstName} {buyer.LastName}", result.Data!.ReviewerName);
        Assert.Equal(3, result.Data.Stars);
        Assert.Equal(sale.Id, result.Data.SaleId);
    }

    // ── GetPendingAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task GetPendingAsync_NoSales_ReturnsEmptyList()
    {
        var user = MakeUser("user-1", "u@test.com");
        using var ctx = _factory.CreateContext();
        ctx.Users.Add(user);
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetPendingAsync(user.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task GetPendingAsync_AllSalesAlreadyRated_ReturnsEmptyList()
    {
        var (seller, buyer, sale) = await SeedSaleAsync();

        using var ctx = _factory.CreateContext();
        ctx.Ratings.Add(new Rating
        {
            Id = Guid.NewGuid(),
            SaleId = sale.Id,
            ReviewerId = buyer.Id,
            RevieweeId = seller.Id,
            Stars = 5,
            CreatedAt = DateTime.UtcNow,
        });
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetPendingAsync(buyer.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task GetPendingAsync_HasUnratedSale_ReturnsOnePendingItem()
    {
        var (seller, buyer, sale) = await SeedSaleAsync();

        var result = await CreateService().GetPendingAsync(buyer.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Single(result.Data!);
        var pending = result.Data![0];
        Assert.Equal(sale.Id, pending.SaleId);
        Assert.Equal(seller.Id, pending.RevieweeId);
    }

    [Fact]
    public async Task GetPendingAsync_BothPartiesHaveUnratedSale_EachSeesOnePending()
    {
        var (seller, buyer, sale) = await SeedSaleAsync();

        var sellerResult = await CreateService().GetPendingAsync(seller.Id, CancellationToken.None);
        var buyerResult = await CreateService().GetPendingAsync(buyer.Id, CancellationToken.None);

        Assert.Single(sellerResult.Data!);
        Assert.Single(buyerResult.Data!);
        // Seller's pending reviewee should be the buyer, and vice versa
        Assert.Equal(buyer.Id, sellerResult.Data![0].RevieweeId);
        Assert.Equal(seller.Id, buyerResult.Data![0].RevieweeId);
    }

    // ── GetUserRatingsAsync ────────────────────────────────────────────────

    [Fact]
    public async Task GetUserRatingsAsync_NoRatings_ReturnsEmptyList()
    {
        var user = MakeUser("user-1", "u@test.com");
        using var ctx = _factory.CreateContext();
        ctx.Users.Add(user);
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetUserRatingsAsync(user.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task GetUserRatingsAsync_HasRatings_ReturnsOrderedByDateDescending()
    {
        var (seller, buyer, sale) = await SeedSaleAsync();
        var older = DateTime.UtcNow.AddDays(-5);
        var newer = DateTime.UtcNow.AddDays(-1);

        using var ctx = _factory.CreateContext();
        ctx.Ratings.AddRange(
            new Rating
            {
                Id = Guid.NewGuid(), SaleId = sale.Id,
                ReviewerId = buyer.Id, RevieweeId = seller.Id,
                Stars = 3, CreatedAt = older,
            },
            new Rating
            {
                Id = Guid.NewGuid(), SaleId = Guid.NewGuid(),
                ReviewerId = buyer.Id, RevieweeId = seller.Id,
                Stars = 5, CreatedAt = newer,
            });
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetUserRatingsAsync(seller.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(2, result.Data!.Count);
        Assert.Equal(5, result.Data![0].Stars);  // newer first
        Assert.Equal(3, result.Data![1].Stars);
    }

    [Fact]
    public async Task GetUserRatingsAsync_ReturnsOnlyRatingsForRequestedUser()
    {
        var (seller, buyer, sale) = await SeedSaleAsync();

        using var ctx = _factory.CreateContext();
        ctx.Ratings.Add(new Rating
        {
            Id = Guid.NewGuid(), SaleId = sale.Id,
            ReviewerId = buyer.Id, RevieweeId = seller.Id,
            Stars = 4, CreatedAt = DateTime.UtcNow,
        });
        await ctx.SaveChangesAsync();

        // Buyer has received zero ratings
        var result = await CreateService().GetUserRatingsAsync(buyer.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Empty(result.Data!);
    }
}
