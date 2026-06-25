using Microsoft.EntityFrameworkCore;
using Moq;
using OpenSpot.Audit;
using OpenSpot.Common;
using OpenSpot.Listings.DTOs;
using OpenSpot.Listings.Geocoding;
using OpenSpot.Listings.Models;
using OpenSpot.Listings.Services;
using OpenSpot.Tests.Helpers;
using OpenSpot.Users.Models;

namespace OpenSpot.Tests.Listings;

/// <summary>
/// Note: SearchListingsAsync is not tested here because it uses EF.Functions.ILike,
/// which is PostgreSQL-specific and not supported by the SQLite test provider.
/// </summary>
public class ListingServiceTests : IDisposable
{
    private readonly DbContextFactory _factory;
    private readonly Mock<IGeocodingService> _geocoding;
    private readonly Mock<IAuditService> _audit;

    public ListingServiceTests()
    {
        _factory = new DbContextFactory();
        _geocoding = new Mock<IGeocodingService>();
        _audit = new Mock<IAuditService>();
    }

    public void Dispose() => _factory.Dispose();

    private ListingService CreateService() =>
        new(_factory.CreateContext(), _geocoding.Object, _audit.Object);

    private static User MakeUser(string id, string email = "") => new()
    {
        Id = id,
        UserName = string.IsNullOrEmpty(email) ? $"{id}@test.com" : email,
        NormalizedUserName = id.ToUpperInvariant(),
        Email = string.IsNullOrEmpty(email) ? $"{id}@test.com" : email,
        NormalizedEmail = id.ToUpperInvariant(),
        EmailConfirmed = true,
        SecurityStamp = Guid.NewGuid().ToString(),
        ConcurrencyStamp = Guid.NewGuid().ToString(),
        FirstName = "First" + id,
        LastName = "Last" + id,
    };

    private static Listing MakeListing(string ownerId, bool isAvailable = true,
        int price = 100, double? lat = null, double? lng = null, string? title = null) => new()
    {
        Id = Guid.NewGuid(),
        Title = title ?? "Test Spot",
        Description = "desc",
        Address = "123 Main St",
        Price = price,
        StartDate = DateOnly.FromDateTime(DateTime.Today),
        EndDate = DateOnly.FromDateTime(DateTime.Today.AddMonths(1)),
        IsAvailable = isAvailable,
        CreatedAt = DateTime.UtcNow,
        OwnerId = ownerId,
        Latitude = lat,
        Longitude = lng,
    };

    private async Task<User> SeedUserAsync(string id = "owner-1")
    {
        var user = MakeUser(id);
        using var ctx = _factory.CreateContext();
        ctx.Users.Add(user);
        await ctx.SaveChangesAsync();
        return user;
    }

    private async Task<(User owner, Listing listing)> SeedListingAsync(
        bool isAvailable = true, int price = 100,
        double? lat = null, double? lng = null)
    {
        var owner = MakeUser("owner-1");
        var listing = MakeListing(owner.Id, isAvailable, price, lat, lng);

        using var ctx = _factory.CreateContext();
        ctx.Users.Add(owner);
        ctx.Listing.Add(listing);
        await ctx.SaveChangesAsync();

        return (owner, listing);
    }

    // ── GetListingsAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task GetListings_ExcludesUnavailableListings()
    {
        var owner = await SeedUserAsync();
        using var ctx = _factory.CreateContext();
        ctx.Listing.Add(MakeListing(owner.Id, isAvailable: true));
        ctx.Listing.Add(MakeListing(owner.Id, isAvailable: false));
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetListingsAsync(
            null, 1, 10, null, null, null, null, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(1, result.Data!.TotalCount);
    }

    [Fact]
    public async Task GetListings_MaxPriceFilter_ExcludesAboveMax()
    {
        var owner = await SeedUserAsync();
        using var ctx = _factory.CreateContext();
        ctx.Listing.Add(MakeListing(owner.Id, price: 50));
        ctx.Listing.Add(MakeListing(owner.Id, price: 200));
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetListingsAsync(
            null, 1, 10, null, maxPrice: 100, null, null, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(1, result.Data!.TotalCount);
        Assert.Equal(50, result.Data.Items[0].Price);
    }

    [Fact]
    public async Task GetListings_SortByPriceAsc_OrdersCorrectly()
    {
        var owner = await SeedUserAsync();
        using var ctx = _factory.CreateContext();
        ctx.Listing.Add(MakeListing(owner.Id, price: 300));
        ctx.Listing.Add(MakeListing(owner.Id, price: 100));
        ctx.Listing.Add(MakeListing(owner.Id, price: 200));
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetListingsAsync(
            null, 1, 10, "price_asc", null, null, null, CancellationToken.None);

        Assert.True(result.Success);
        var prices = result.Data!.Items.Select(l => l.Price).ToList();
        Assert.Equal(new[] { 100, 200, 300 }, prices);
    }

    [Fact]
    public async Task GetListings_SortByPriceDesc_OrdersCorrectly()
    {
        var owner = await SeedUserAsync();
        using var ctx = _factory.CreateContext();
        ctx.Listing.Add(MakeListing(owner.Id, price: 100));
        ctx.Listing.Add(MakeListing(owner.Id, price: 300));
        ctx.Listing.Add(MakeListing(owner.Id, price: 200));
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetListingsAsync(
            null, 1, 10, "price_desc", null, null, null, CancellationToken.None);

        Assert.True(result.Success);
        var prices = result.Data!.Items.Select(l => l.Price).ToList();
        Assert.Equal(new[] { 300, 200, 100 }, prices);
    }

    [Fact]
    public async Task GetListings_NearestSort_ListingWithNoCoordinatesSortsLast()
    {
        var owner = await SeedUserAsync();
        using var ctx = _factory.CreateContext();
        // Listing near Toronto
        ctx.Listing.Add(MakeListing(owner.Id, lat: 43.65, lng: -79.38));
        // Listing with no coordinates
        ctx.Listing.Add(MakeListing(owner.Id, lat: null, lng: null));
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetListingsAsync(
            null, 1, 10, "nearest", null,
            lat: 43.65, lng: -79.38, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(2, result.Data!.Items.Count);
        Assert.NotNull(result.Data.Items[0].Latitude);       // coordinated listing first
        Assert.Null(result.Data.Items[1].Latitude);           // no-coord listing last
    }

    [Fact]
    public async Task GetListings_Pagination_ReturnsCorrectPage()
    {
        var owner = await SeedUserAsync();
        using var ctx = _factory.CreateContext();
        for (int i = 0; i < 5; i++)
            ctx.Listing.Add(MakeListing(owner.Id));
        await ctx.SaveChangesAsync();

        var page1 = await CreateService().GetListingsAsync(
            null, 1, 3, null, null, null, null, CancellationToken.None);
        var page2 = await CreateService().GetListingsAsync(
            null, 2, 3, null, null, null, null, CancellationToken.None);

        Assert.Equal(3, page1.Data!.Items.Count);
        Assert.Equal(2, page2.Data!.Items.Count);
        Assert.Equal(5, page1.Data.TotalCount);
        Assert.True(page1.Data.HasMore);
        Assert.False(page2.Data!.HasMore);
    }

    // ── GetListingByIdAsync ────────────────────────────────────────────────

    [Fact]
    public async Task GetListingById_NotFound_ReturnsNotFound()
    {
        var result = await CreateService().GetListingByIdAsync(
            Guid.NewGuid(), null, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task GetListingById_Found_ReturnsOkWithData()
    {
        var (_, listing) = await SeedListingAsync();

        var result = await CreateService().GetListingByIdAsync(
            listing.Id, null, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(listing.Id, result.Data!.Id);
        Assert.Equal(listing.Title, result.Data.Title);
    }

    [Fact]
    public async Task GetListingById_WithRequesterWhoFavorited_SetsFavoritedTrue()
    {
        var (_, listing) = await SeedListingAsync();

        using var ctx = _factory.CreateContext();
        ctx.UserFavorites.Add(new UserFavorite
        {
            UserId = "user-fav",
            ListingId = listing.Id,
            CreatedAt = DateTime.UtcNow,
        });
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetListingByIdAsync(
            listing.Id, "user-fav", CancellationToken.None);

        Assert.True(result.Data!.IsFavorited);
    }

    [Fact]
    public async Task GetListingById_WithRequesterWhoDidNotFavorite_SetsFavoritedFalse()
    {
        var (_, listing) = await SeedListingAsync();

        var result = await CreateService().GetListingByIdAsync(
            listing.Id, "some-user", CancellationToken.None);

        Assert.False(result.Data!.IsFavorited);
    }

    // ── CreateNewListingAsync ──────────────────────────────────────────────

    [Fact]
    public async Task CreateListing_DuplicateTitleForSameOwner_ReturnsConflict()
    {
        var (owner, _) = await SeedListingAsync();
        // The seeded listing has title "Test Spot"

        var result = await CreateService().CreateNewListingAsync(
            owner.Id,
            new CreateListingDto { Title = "Test Spot", Address = "456 Other St", Price = 150,
                StartDate = DateOnly.FromDateTime(DateTime.Today),
                EndDate = DateOnly.FromDateTime(DateTime.Today.AddMonths(1)) },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Conflict, result.Status);
    }

    [Fact]
    public async Task CreateListing_WithCoordinatesProvided_SkipsGeocoding()
    {
        var owner = await SeedUserAsync();

        await CreateService().CreateNewListingAsync(
            owner.Id,
            new CreateListingDto
            {
                Title = "My Spot", Address = "123 Main", Price = 100,
                StartDate = DateOnly.FromDateTime(DateTime.Today),
                EndDate = DateOnly.FromDateTime(DateTime.Today.AddMonths(1)),
                Latitude = 43.65, Longitude = -79.38,
            },
            CancellationToken.None);

        _geocoding.Verify(g => g.GeocodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateListing_WithoutCoordinates_CallsGeocoding()
    {
        var owner = await SeedUserAsync();
        _geocoding.Setup(g => g.GeocodeAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((43.65, -79.38));

        await CreateService().CreateNewListingAsync(
            owner.Id,
            new CreateListingDto
            {
                Title = "My Spot", Address = "123 Main", Price = 100,
                StartDate = DateOnly.FromDateTime(DateTime.Today),
                EndDate = DateOnly.FromDateTime(DateTime.Today.AddMonths(1)),
            },
            CancellationToken.None);

        _geocoding.Verify(g => g.GeocodeAsync("123 Main", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateListing_Success_ReturnsCreatedAndPersists()
    {
        var owner = await SeedUserAsync();

        var result = await CreateService().CreateNewListingAsync(
            owner.Id,
            new CreateListingDto
            {
                Title = "Brand New Spot", Address = "456 Ave", Price = 200,
                StartDate = DateOnly.FromDateTime(DateTime.Today),
                EndDate = DateOnly.FromDateTime(DateTime.Today.AddMonths(1)),
                Latitude = 43.0, Longitude = -79.0,
            },
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Created, result.Status);
        Assert.Equal(owner.Id, result.Data!.OwnerId);

        using var ctx = _factory.CreateContext();
        Assert.True(await ctx.Listing.AnyAsync(l => l.Title == "Brand New Spot"));
    }

    [Fact]
    public async Task CreateListing_Success_WritesAuditLog()
    {
        var owner = await SeedUserAsync();

        await CreateService().CreateNewListingAsync(
            owner.Id,
            new CreateListingDto
            {
                Title = "Audit Spot", Address = "1 Audit Lane", Price = 50,
                StartDate = DateOnly.FromDateTime(DateTime.Today),
                EndDate = DateOnly.FromDateTime(DateTime.Today.AddMonths(1)),
                Latitude = 0, Longitude = 0,
            },
            CancellationToken.None);

        _audit.Verify(a => a.Log("listing.created", owner.Id, "Listing", It.IsAny<string>(), It.IsAny<string>()), Times.Once);
    }

    // ── UpdateListingAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task UpdateListing_NotFound_ReturnsNotFound()
    {
        var result = await CreateService().UpdateListingAsync(
            Guid.NewGuid(), "any-user",
            new UpdateListingDto { Title = "x", Address = "x", Price = 1,
                StartDate = DateOnly.MinValue, EndDate = DateOnly.MaxValue },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task UpdateListing_NotOwner_ReturnsForbidden()
    {
        var (_, listing) = await SeedListingAsync();

        var result = await CreateService().UpdateListingAsync(
            listing.Id, "wrong-user",
            new UpdateListingDto { Title = "x", Address = "x", Price = 1,
                StartDate = DateOnly.MinValue, EndDate = DateOnly.MaxValue },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task UpdateListing_ByOwner_UpdatesFieldsAndReturnsOk()
    {
        var (owner, listing) = await SeedListingAsync();
        var newStart = DateOnly.FromDateTime(DateTime.Today.AddDays(1));
        var newEnd = DateOnly.FromDateTime(DateTime.Today.AddDays(60));

        var result = await CreateService().UpdateListingAsync(
            listing.Id, owner.Id,
            new UpdateListingDto
            {
                Title = "Updated Title", Address = "New Address", Price = 999,
                StartDate = newStart, EndDate = newEnd, IsAvailable = false,
            },
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Ok, result.Status);

        using var ctx = _factory.CreateContext();
        var updated = await ctx.Listing.FindAsync(listing.Id);
        Assert.Equal("Updated Title", updated!.Title);
        Assert.Equal(999, updated.Price);
        Assert.False(updated.IsAvailable);
    }

    // ── DeleteListingAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task DeleteListing_NotFound_ReturnsNotFound()
    {
        var result = await CreateService().DeleteListingAsync(
            Guid.NewGuid(), "any-user", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task DeleteListing_NotOwner_ReturnsForbidden()
    {
        var (_, listing) = await SeedListingAsync();

        var result = await CreateService().DeleteListingAsync(
            listing.Id, "wrong-user", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task DeleteListing_ByOwner_RemovesFromDatabaseAndReturnsNoContent()
    {
        var (owner, listing) = await SeedListingAsync();

        var result = await CreateService().DeleteListingAsync(
            listing.Id, owner.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.NoContent, result.Status);

        using var ctx = _factory.CreateContext();
        Assert.False(await ctx.Listing.AnyAsync(l => l.Id == listing.Id));
    }

    // ── ToggleFavoriteAsync ────────────────────────────────────────────────

    [Fact]
    public async Task ToggleFavorite_ListingNotFound_ReturnsNotFound()
    {
        var result = await CreateService().ToggleFavoriteAsync(
            "user-1", Guid.NewGuid(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task ToggleFavorite_NotYetFavorited_AddsFavoriteAndReturnsTrue()
    {
        var (_, listing) = await SeedListingAsync();

        var result = await CreateService().ToggleFavoriteAsync(
            "user-fav", listing.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.True(result.Data);

        using var ctx = _factory.CreateContext();
        Assert.True(await ctx.UserFavorites.AnyAsync(f => f.UserId == "user-fav" && f.ListingId == listing.Id));
    }

    [Fact]
    public async Task ToggleFavorite_AlreadyFavorited_RemovesFavoriteAndReturnsFalse()
    {
        var (_, listing) = await SeedListingAsync();

        using var ctx = _factory.CreateContext();
        ctx.UserFavorites.Add(new UserFavorite { UserId = "user-fav", ListingId = listing.Id, CreatedAt = DateTime.UtcNow });
        await ctx.SaveChangesAsync();

        var result = await CreateService().ToggleFavoriteAsync(
            "user-fav", listing.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.False(result.Data);

        using var assertCtx = _factory.CreateContext();
        Assert.False(await assertCtx.UserFavorites.AnyAsync(f => f.UserId == "user-fav"));
    }

    // ── SetAvailabilityAsync ───────────────────────────────────────────────

    [Fact]
    public async Task SetAvailability_NotOwner_ReturnsForbidden()
    {
        var (_, listing) = await SeedListingAsync();

        var result = await CreateService().SetAvailabilityAsync(
            listing.Id, "wrong-user", false, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task SetAvailability_ByOwner_UpdatesAndReturnsOk()
    {
        var (owner, listing) = await SeedListingAsync(isAvailable: true);

        var result = await CreateService().SetAvailabilityAsync(
            listing.Id, owner.Id, false, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.False(result.Data!.IsAvailable);

        using var ctx = _factory.CreateContext();
        var updated = await ctx.Listing.FindAsync(listing.Id);
        Assert.False(updated!.IsAvailable);
    }
}
