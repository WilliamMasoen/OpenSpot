using Microsoft.AspNetCore.Identity;
using Moq;
using OpenSpot.Users.Models;

namespace OpenSpot.Tests.Helpers;

public static class UserManagerMockFactory
{
    public static Mock<UserManager<User>> Create()
    {
        var store = new Mock<IUserStore<User>>();
        store.As<IUserPasswordStore<User>>();

        return new Mock<UserManager<User>>(
            store.Object,
            null,   // IOptions<IdentityOptions>
            null,   // IPasswordHasher<User>
            null,   // IEnumerable<IUserValidator<User>>
            null,   // IEnumerable<IPasswordValidator<User>>
            null,   // ILookupNormalizer
            null,   // IdentityErrorDescriber
            null,   // IServiceProvider
            null);  // ILogger<UserManager<User>>
    }
}
