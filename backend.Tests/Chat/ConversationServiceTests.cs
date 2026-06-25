using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Moq;
using OpenSpot.Chat.Hubs;
using OpenSpot.Chat.Models;
using OpenSpot.Chat.Services;
using OpenSpot.Common;
using OpenSpot.Listings.Models;
using OpenSpot.Notifications;
using OpenSpot.Tests.Helpers;
using OpenSpot.Users.Models;

namespace OpenSpot.Tests.Chat;

public class ConversationServiceTests : IDisposable
{
    private readonly DbContextFactory _factory;
    private readonly Mock<IHubContext<ChatHub>> _hub;
    private readonly Mock<IPushNotificationService> _push;

    public ConversationServiceTests()
    {
        _factory = new DbContextFactory();

        _push = new Mock<IPushNotificationService>();
        _push.Setup(p => p.SendToUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        var mockClientProxy = new Mock<IClientProxy>();
        mockClientProxy
            .Setup(c => c.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var mockClients = new Mock<IHubClients>();
        mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);

        _hub = new Mock<IHubContext<ChatHub>>();
        _hub.Setup(h => h.Clients).Returns(mockClients.Object);
    }

    public void Dispose() => _factory.Dispose();

    private ConversationService CreateService() =>
        new(_factory.CreateContext(), _hub.Object, _push.Object);

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

    private static Listing MakeListing(string ownerId, Guid? id = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        Title = "Test Spot",
        Description = "desc",
        Address = "123 Main",
        Price = 100,
        StartDate = DateOnly.FromDateTime(DateTime.Today),
        EndDate = DateOnly.FromDateTime(DateTime.Today.AddMonths(1)),
        IsAvailable = true,
        CreatedAt = DateTime.UtcNow,
        OwnerId = ownerId,
    };

    private async Task<(User owner, User buyer, Listing listing)> SeedListingAsync()
    {
        var owner = MakeUser("owner-1", "owner@test.com");
        var buyer = MakeUser("buyer-1", "buyer@test.com");
        var listing = MakeListing(owner.Id);

        using var ctx = _factory.CreateContext();
        ctx.Users.AddRange(owner, buyer);
        ctx.Listing.Add(listing);
        await ctx.SaveChangesAsync();

        return (owner, buyer, listing);
    }

    private async Task<(User owner, User buyer, Listing listing, Conversation conv)> SeedConversationAsync()
    {
        var (owner, buyer, listing) = await SeedListingAsync();

        var conv = new Conversation
        {
            Id = Guid.NewGuid(),
            ListingId = listing.Id,
            BuyerId = buyer.Id,
            OwnerId = owner.Id,
            CreatedAt = DateTime.UtcNow,
        };

        using var ctx = _factory.CreateContext();
        ctx.Conversations.Add(conv);
        await ctx.SaveChangesAsync();

        return (owner, buyer, listing, conv);
    }

    // ── GetOrCreateConversationAsync ───────────────────────────────────────

    [Fact]
    public async Task GetOrCreate_ListingNotFound_ReturnsNotFound()
    {
        var result = await CreateService().GetOrCreateConversationAsync(
            Guid.NewGuid(), "any-buyer", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task GetOrCreate_BuyerIsOwner_ReturnsForbidden()
    {
        var (owner, _, listing) = await SeedListingAsync();

        var result = await CreateService().GetOrCreateConversationAsync(
            listing.Id, owner.Id, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task GetOrCreate_NewConversation_ReturnsCreatedAndPersists()
    {
        var (_, buyer, listing) = await SeedListingAsync();

        var result = await CreateService().GetOrCreateConversationAsync(
            listing.Id, buyer.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Created, result.Status);
        Assert.NotNull(result.Data);

        using var ctx = _factory.CreateContext();
        var saved = await ctx.Conversations.SingleOrDefaultAsync(
            c => c.ListingId == listing.Id && c.BuyerId == buyer.Id);
        Assert.NotNull(saved);
    }

    [Fact]
    public async Task GetOrCreate_ExistingConversation_ReturnsOkWithoutDuplicate()
    {
        var (_, buyer, listing, _) = await SeedConversationAsync();

        var result = await CreateService().GetOrCreateConversationAsync(
            listing.Id, buyer.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Ok, result.Status);

        using var ctx = _factory.CreateContext();
        Assert.Equal(1, await ctx.Conversations.CountAsync());
    }

    // ── GetConversationsAsync ──────────────────────────────────────────────

    [Fact]
    public async Task GetConversations_UserWithNoConversations_ReturnsEmptyList()
    {
        var user = MakeUser("lonely", "lonely@test.com");
        using var ctx = _factory.CreateContext();
        ctx.Users.Add(user);
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetConversationsAsync(user.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task GetConversations_AsBuyer_ReturnsConversation()
    {
        var (_, buyer, _, _) = await SeedConversationAsync();

        var result = await CreateService().GetConversationsAsync(buyer.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Single(result.Data!);
    }

    [Fact]
    public async Task GetConversations_AsOwner_ReturnsConversation()
    {
        var (owner, _, _, _) = await SeedConversationAsync();

        var result = await CreateService().GetConversationsAsync(owner.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Single(result.Data!);
    }

    // ── GetMessagesAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task GetMessages_ConversationNotFound_ReturnsNotFound()
    {
        var result = await CreateService().GetMessagesAsync(
            Guid.NewGuid(), "any-user", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task GetMessages_UserNotInConversation_ReturnsForbidden()
    {
        var (_, _, _, conv) = await SeedConversationAsync();

        var result = await CreateService().GetMessagesAsync(
            conv.Id, "outsider-user", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task GetMessages_MarksUnreadMessagesAsRead()
    {
        var (owner, buyer, _, conv) = await SeedConversationAsync();

        using var ctx = _factory.CreateContext();
        ctx.Messages.Add(new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conv.Id,
            SenderId = buyer.Id,
            Body = "Hello!",
            SentAt = DateTime.UtcNow,
            IsRead = false,
        });
        await ctx.SaveChangesAsync();

        // Owner reads messages — the buyer's message should be marked read
        await CreateService().GetMessagesAsync(conv.Id, owner.Id, CancellationToken.None);

        using var assertCtx = _factory.CreateContext();
        Assert.True(await assertCtx.Messages.AllAsync(m => m.IsRead));
    }

    [Fact]
    public async Task GetMessages_ReturnsMessagesOrderedBySentAt()
    {
        var (owner, buyer, _, conv) = await SeedConversationAsync();

        using var ctx = _factory.CreateContext();
        ctx.Messages.AddRange(
            new Message { Id = Guid.NewGuid(), ConversationId = conv.Id, SenderId = buyer.Id, Body = "Second", SentAt = DateTime.UtcNow, IsRead = true },
            new Message { Id = Guid.NewGuid(), ConversationId = conv.Id, SenderId = buyer.Id, Body = "First", SentAt = DateTime.UtcNow.AddMinutes(-5), IsRead = true });
        await ctx.SaveChangesAsync();

        var result = await CreateService().GetMessagesAsync(conv.Id, owner.Id, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("First", result.Data![0].Body);
        Assert.Equal("Second", result.Data![1].Body);
    }

    // ── SendMessageAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task SendMessage_ConversationNotFound_ReturnsNotFound()
    {
        var result = await CreateService().SendMessageAsync(
            Guid.NewGuid(), "any-user", "hello", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task SendMessage_UserNotInConversation_ReturnsForbidden()
    {
        var (_, _, _, conv) = await SeedConversationAsync();

        var result = await CreateService().SendMessageAsync(
            conv.Id, "outsider", "hello", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task SendMessage_Success_PersistsMessageAndReturnsDto()
    {
        var (_, buyer, _, conv) = await SeedConversationAsync();

        var result = await CreateService().SendMessageAsync(
            conv.Id, buyer.Id, "Hello!", CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Created, result.Status);
        Assert.Equal("Hello!", result.Data!.Body);
        Assert.Equal(buyer.Id, result.Data.SenderId);

        using var ctx = _factory.CreateContext();
        var saved = await ctx.Messages.SingleOrDefaultAsync();
        Assert.NotNull(saved);
        Assert.Equal("Hello!", saved.Body);
        Assert.False(saved.IsRead);
    }

    [Fact]
    public async Task SendMessage_Success_BroadcastsViaSignalR()
    {
        var (_, buyer, _, conv) = await SeedConversationAsync();

        await CreateService().SendMessageAsync(conv.Id, buyer.Id, "Hi", CancellationToken.None);

        _hub.Verify(h => h.Clients.Group(It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task SendMessage_Success_FiresAndForgetsPushNotification()
    {
        var (_, buyer, _, conv) = await SeedConversationAsync();

        await CreateService().SendMessageAsync(conv.Id, buyer.Id, "Ping", CancellationToken.None);

        _push.Verify(
            p => p.SendToUserAsync(It.IsAny<string>(), It.IsAny<string>(), "Ping"),
            Times.Once);
    }

    // ── MarkReadAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task MarkRead_ConversationNotFound_ReturnsNotFound()
    {
        var result = await CreateService().MarkReadAsync(
            Guid.NewGuid(), "any-user", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task MarkRead_UserNotInConversation_ReturnsForbidden()
    {
        var (_, _, _, conv) = await SeedConversationAsync();

        var result = await CreateService().MarkReadAsync(conv.Id, "outsider", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task MarkRead_MarksOnlyReceivedMessages()
    {
        var (owner, buyer, _, conv) = await SeedConversationAsync();

        using var ctx = _factory.CreateContext();
        // A message from buyer (should be marked read when owner calls MarkRead)
        ctx.Messages.Add(new Message
        {
            Id = Guid.NewGuid(), ConversationId = conv.Id,
            SenderId = buyer.Id, Body = "Hey", SentAt = DateTime.UtcNow, IsRead = false,
        });
        // A message from owner (should NOT be marked read by owner calling MarkRead)
        ctx.Messages.Add(new Message
        {
            Id = Guid.NewGuid(), ConversationId = conv.Id,
            SenderId = owner.Id, Body = "Reply", SentAt = DateTime.UtcNow, IsRead = false,
        });
        await ctx.SaveChangesAsync();

        await CreateService().MarkReadAsync(conv.Id, owner.Id, CancellationToken.None);

        using var assertCtx = _factory.CreateContext();
        var messages = await assertCtx.Messages.ToListAsync();
        Assert.True(messages.Single(m => m.SenderId == buyer.Id).IsRead);
        Assert.False(messages.Single(m => m.SenderId == owner.Id).IsRead);
    }
}
