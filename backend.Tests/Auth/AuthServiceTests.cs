using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;
using OpenSpot.Audit;
using OpenSpot.Auth;
using OpenSpot.Auth.DTOs;
using OpenSpot.Common;
using OpenSpot.Config;
using OpenSpot.Email;
using OpenSpot.RefreshTokens;
using OpenSpot.Tests.Helpers;
using OpenSpot.Users.Models;

namespace OpenSpot.Tests.Auth;

public class AuthServiceTests : IDisposable
{
    private readonly DbContextFactory _factory;
    private readonly Mock<UserManager<User>> _userManager;
    private readonly Mock<IEmailService> _email;
    private readonly Mock<IAuditService> _audit;
    private readonly IOptions<JwtOptions> _jwtOptions;
    private readonly IOptions<AppOptions> _appOptions;

    public AuthServiceTests()
    {
        _factory = new DbContextFactory();
        _userManager = UserManagerMockFactory.Create();
        _email = new Mock<IEmailService>();
        _audit = new Mock<IAuditService>();

        _jwtOptions = Options.Create(new JwtOptions
        {
            Secret = "super-secret-key-used-only-in-unit-tests-32c",
            Issuer = "test-issuer",
            Audience = "test-audience",
            AccessTokenExpiryMinutes = 15,
            RefreshTokenExpiryDays = 30,
        });
        _appOptions = Options.Create(new AppOptions { BaseUrl = "https://test.example.com" });
    }

    public void Dispose() => _factory.Dispose();

    private AuthService CreateService() => new(
        _userManager.Object,
        _factory.CreateContext(),
        _jwtOptions,
        _appOptions,
        _email.Object,
        _audit.Object);

    private static User MakeUser(string id = "user-1", string email = "user@test.com",
        bool emailConfirmed = true) => new()
    {
        Id = id,
        UserName = email,
        Email = email,
        EmailConfirmed = emailConfirmed,
        SecurityStamp = Guid.NewGuid().ToString(),
        ConcurrencyStamp = Guid.NewGuid().ToString(),
        FirstName = "Test",
        LastName = "User",
    };

    // ── RegisterAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task RegisterAsync_EmailAlreadyInUse_ReturnsConflict()
    {
        _userManager.Setup(m => m.FindByEmailAsync("taken@test.com"))
            .ReturnsAsync(MakeUser());

        var result = await CreateService().RegisterAsync(
            new RegisterDto { Email = "taken@test.com", Password = "Password1!", FirstName = "A", LastName = "B" },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.Conflict, result.Status);
    }

    [Fact]
    public async Task RegisterAsync_WeakPassword_ReturnsValidationError()
    {
        _userManager.Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((User?)null);
        _userManager.Setup(m => m.CreateAsync(It.IsAny<User>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "Password too weak." }));

        var result = await CreateService().RegisterAsync(
            new RegisterDto { Email = "new@test.com", Password = "weak", FirstName = "A", LastName = "B" },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.ValidationError, result.Status);
        Assert.Contains("Password too weak.", result.Message);
    }

    [Fact]
    public async Task RegisterAsync_Success_ReturnsCreatedWithTokens()
    {
        var user = MakeUser();
        _userManager.Setup(m => m.FindByEmailAsync(user.Email!)).ReturnsAsync((User?)null);
        _userManager.Setup(m => m.CreateAsync(It.IsAny<User>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);
        _userManager.Setup(m => m.AddToRoleAsync(It.IsAny<User>(), "User"))
            .ReturnsAsync(IdentityResult.Success);
        _userManager.Setup(m => m.GenerateEmailConfirmationTokenAsync(It.IsAny<User>()))
            .ReturnsAsync("email-confirm-token");
        _userManager.Setup(m => m.GetRolesAsync(It.IsAny<User>()))
            .ReturnsAsync(new List<string> { "User" });

        var result = await CreateService().RegisterAsync(
            new RegisterDto { Email = user.Email!, Password = "Password1!", FirstName = "Test", LastName = "User" },
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Created, result.Status);
        Assert.NotNull(result.Data);
        Assert.NotEmpty(result.Data!.AccessToken);
        Assert.NotEmpty(result.Data.RefreshToken);
    }

    [Fact]
    public async Task RegisterAsync_Success_SendsVerificationEmail()
    {
        _userManager.Setup(m => m.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync((User?)null);
        _userManager.Setup(m => m.CreateAsync(It.IsAny<User>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);
        _userManager.Setup(m => m.AddToRoleAsync(It.IsAny<User>(), "User"))
            .ReturnsAsync(IdentityResult.Success);
        _userManager.Setup(m => m.GenerateEmailConfirmationTokenAsync(It.IsAny<User>()))
            .ReturnsAsync("email-confirm-token");
        _userManager.Setup(m => m.GetRolesAsync(It.IsAny<User>())).ReturnsAsync([]);

        await CreateService().RegisterAsync(
            new RegisterDto { Email = "new@test.com", Password = "Password1!", FirstName = "A", LastName = "B" },
            CancellationToken.None);

        _email.Verify(
            e => e.SendAsync("new@test.com", It.IsAny<string>(), It.IsAny<string>()),
            Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_Success_WritesAuditLog()
    {
        _userManager.Setup(m => m.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync((User?)null);
        _userManager.Setup(m => m.CreateAsync(It.IsAny<User>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);
        _userManager.Setup(m => m.AddToRoleAsync(It.IsAny<User>(), "User"))
            .ReturnsAsync(IdentityResult.Success);
        _userManager.Setup(m => m.GenerateEmailConfirmationTokenAsync(It.IsAny<User>()))
            .ReturnsAsync("token");
        _userManager.Setup(m => m.GetRolesAsync(It.IsAny<User>())).ReturnsAsync([]);

        await CreateService().RegisterAsync(
            new RegisterDto { Email = "new@test.com", Password = "Password1!", FirstName = "A", LastName = "B" },
            CancellationToken.None);

        _audit.Verify(a => a.Log("user.registered", It.IsAny<string>(), "User", It.IsAny<string>(), null), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_Success_PersistsRefreshTokenToDatabase()
    {
        _userManager.Setup(m => m.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync((User?)null);
        _userManager.Setup(m => m.CreateAsync(It.IsAny<User>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);
        _userManager.Setup(m => m.AddToRoleAsync(It.IsAny<User>(), "User"))
            .ReturnsAsync(IdentityResult.Success);
        _userManager.Setup(m => m.GenerateEmailConfirmationTokenAsync(It.IsAny<User>()))
            .ReturnsAsync("token");
        _userManager.Setup(m => m.GetRolesAsync(It.IsAny<User>())).ReturnsAsync([]);

        var result = await CreateService().RegisterAsync(
            new RegisterDto { Email = "new@test.com", Password = "Password1!", FirstName = "A", LastName = "B" },
            CancellationToken.None);

        using var ctx = _factory.CreateContext();
        var token = await ctx.RefreshTokens.SingleOrDefaultAsync(t => t.Token == result.Data!.RefreshToken);
        Assert.NotNull(token);
        Assert.False(token.IsRevoked);
        Assert.True(token.ExpiresAt > DateTime.UtcNow);
    }

    // ── LoginAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task LoginAsync_UserNotFound_ReturnsValidationError()
    {
        _userManager.Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((User?)null);

        var result = await CreateService().LoginAsync(
            new LoginDto { Email = "ghost@test.com", Password = "Password1!" },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task LoginAsync_WrongPassword_ReturnsValidationError()
    {
        var user = MakeUser();
        _userManager.Setup(m => m.FindByEmailAsync(user.Email!)).ReturnsAsync(user);
        _userManager.Setup(m => m.CheckPasswordAsync(user, "wrong")).ReturnsAsync(false);

        var result = await CreateService().LoginAsync(
            new LoginDto { Email = user.Email!, Password = "wrong" },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task LoginAsync_EmailNotConfirmed_ReturnsValidationError()
    {
        var user = MakeUser(emailConfirmed: false);
        _userManager.Setup(m => m.FindByEmailAsync(user.Email!)).ReturnsAsync(user);
        _userManager.Setup(m => m.CheckPasswordAsync(user, "Password1!")).ReturnsAsync(true);

        var result = await CreateService().LoginAsync(
            new LoginDto { Email = user.Email!, Password = "Password1!" },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task LoginAsync_ValidCredentials_ReturnsOkWithTokens()
    {
        var user = MakeUser();
        _userManager.Setup(m => m.FindByEmailAsync(user.Email!)).ReturnsAsync(user);
        _userManager.Setup(m => m.CheckPasswordAsync(user, "Password1!")).ReturnsAsync(true);
        _userManager.Setup(m => m.GetRolesAsync(user)).ReturnsAsync(["User"]);

        var result = await CreateService().LoginAsync(
            new LoginDto { Email = user.Email!, Password = "Password1!" },
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotEmpty(result.Data!.AccessToken);
        Assert.NotEmpty(result.Data.RefreshToken);
        Assert.Equal(user.Id, result.Data.UserId);
    }

    [Fact]
    public async Task LoginAsync_Success_WritesAuditLog()
    {
        var user = MakeUser();
        _userManager.Setup(m => m.FindByEmailAsync(user.Email!)).ReturnsAsync(user);
        _userManager.Setup(m => m.CheckPasswordAsync(user, "Password1!")).ReturnsAsync(true);
        _userManager.Setup(m => m.GetRolesAsync(user)).ReturnsAsync([]);

        await CreateService().LoginAsync(
            new LoginDto { Email = user.Email!, Password = "Password1!" },
            CancellationToken.None);

        _audit.Verify(a => a.Log("auth.login", user.Id, "User", user.Id, null), Times.Once);
    }

    // ── RefreshAsync ───────────────────────────────────────────────────────

    [Fact]
    public async Task RefreshAsync_TokenNotInDatabase_ReturnsValidationError()
    {
        var result = await CreateService().RefreshAsync("nonexistent-token", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task RefreshAsync_TokenIsRevoked_ReturnsValidationError()
    {
        var user = MakeUser();
        await SeedUserAndRefreshTokenAsync(user, revoked: true, daysUntilExpiry: 30);

        var result = await CreateService().RefreshAsync("test-token", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task RefreshAsync_TokenIsExpired_ReturnsValidationError()
    {
        var user = MakeUser();
        await SeedUserAndRefreshTokenAsync(user, revoked: false, daysUntilExpiry: -1);

        var result = await CreateService().RefreshAsync("test-token", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task RefreshAsync_ValidToken_DeletesOldTokenAndIssuesNew()
    {
        var user = MakeUser();
        await SeedUserAndRefreshTokenAsync(user, revoked: false, daysUntilExpiry: 30);
        _userManager.Setup(m => m.GetRolesAsync(It.IsAny<User>())).ReturnsAsync([]);

        var result = await CreateService().RefreshAsync("test-token", CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotEqual("test-token", result.Data!.RefreshToken);

        using var ctx = _factory.CreateContext();
        var oldToken = await ctx.RefreshTokens.FirstOrDefaultAsync(t => t.Token == "test-token");
        var newToken = await ctx.RefreshTokens.FirstOrDefaultAsync(t => t.Token == result.Data.RefreshToken);
        Assert.Null(oldToken);   // rotated out
        Assert.NotNull(newToken);
    }

    // ── LogoutAsync ────────────────────────────────────────────────────────

    [Fact]
    public async Task LogoutAsync_TokenNotFound_ReturnsNotFound()
    {
        var result = await CreateService().LogoutAsync("user-1", "bad-token", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task LogoutAsync_ValidToken_RemovesItAndReturnsNoContent()
    {
        var user = MakeUser();
        await SeedUserAndRefreshTokenAsync(user, revoked: false, daysUntilExpiry: 30);

        var result = await CreateService().LogoutAsync(user.Id, "test-token", CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.NoContent, result.Status);

        using var ctx = _factory.CreateContext();
        Assert.False(await ctx.RefreshTokens.AnyAsync(t => t.Token == "test-token"));
    }

    [Fact]
    public async Task LogoutAsync_TokenBelongsToOtherUser_ReturnsNotFound()
    {
        var user = MakeUser();
        await SeedUserAndRefreshTokenAsync(user, revoked: false, daysUntilExpiry: 30);

        // Use a different userId — the token exists but isn't theirs
        var result = await CreateService().LogoutAsync("other-user-id", "test-token", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    // ── ForgotPasswordAsync ────────────────────────────────────────────────

    [Fact]
    public async Task ForgotPasswordAsync_UnknownEmail_ReturnsNoContentWithoutSendingEmail()
    {
        _userManager.Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((User?)null);

        var result = await CreateService().ForgotPasswordAsync("ghost@test.com", CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.NoContent, result.Status);
        _email.Verify(e => e.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ForgotPasswordAsync_UnconfirmedEmail_ReturnsNoContentWithoutSendingEmail()
    {
        _userManager.Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync(MakeUser(emailConfirmed: false));

        var result = await CreateService().ForgotPasswordAsync("unconfirmed@test.com", CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.NoContent, result.Status);
        _email.Verify(e => e.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ForgotPasswordAsync_KnownConfirmedEmail_ReturnsNoContentAndSendsEmail()
    {
        var user = MakeUser();
        _userManager.Setup(m => m.FindByEmailAsync(user.Email!)).ReturnsAsync(user);
        _userManager.Setup(m => m.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("reset-token");

        var result = await CreateService().ForgotPasswordAsync(user.Email!, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.NoContent, result.Status);
        _email.Verify(
            e => e.SendAsync(user.Email!, It.IsAny<string>(), It.Is<string>(body => body.Contains("reset"))),
            Times.Once);
    }

    // ── ResetPasswordAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task ResetPasswordAsync_InvalidUserId_ReturnsValidationError()
    {
        _userManager.Setup(m => m.FindByIdAsync(It.IsAny<string>()))
            .ReturnsAsync((User?)null);

        var result = await CreateService().ResetPasswordAsync(
            new ResetPasswordDto { UserId = "bad-id", Token = "t", NewPassword = "NewPass1!" },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task ResetPasswordAsync_InvalidToken_ReturnsValidationError()
    {
        var user = MakeUser();
        _userManager.Setup(m => m.FindByIdAsync(user.Id)).ReturnsAsync(user);
        _userManager.Setup(m => m.ResetPasswordAsync(user, It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "Invalid token." }));

        var result = await CreateService().ResetPasswordAsync(
            new ResetPasswordDto { UserId = user.Id, Token = "bad", NewPassword = "NewPass1!" },
            CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task ResetPasswordAsync_ValidRequest_ReturnsNoContent()
    {
        var user = MakeUser();
        _userManager.Setup(m => m.FindByIdAsync(user.Id)).ReturnsAsync(user);
        _userManager.Setup(m => m.ResetPasswordAsync(user, It.IsAny<string>(), "NewPass1!"))
            .ReturnsAsync(IdentityResult.Success);

        var result = await CreateService().ResetPasswordAsync(
            new ResetPasswordDto { UserId = user.Id, Token = "valid-token", NewPassword = "NewPass1!" },
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(ResultStatus.NoContent, result.Status);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private async Task SeedUserAndRefreshTokenAsync(User user, bool revoked, int daysUntilExpiry)
    {
        using var ctx = _factory.CreateContext();
        ctx.Users.Add(user);
        ctx.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = "test-token",
            UserId = user.Id,
            IsRevoked = revoked,
            ExpiresAt = DateTime.UtcNow.AddDays(daysUntilExpiry),
            CreatedAt = DateTime.UtcNow,
        });
        await ctx.SaveChangesAsync();
    }
}
