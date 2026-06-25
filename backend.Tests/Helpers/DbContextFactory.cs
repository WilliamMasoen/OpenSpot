using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using OpenSpot.Data;

namespace OpenSpot.Tests.Helpers;

/// <summary>
/// Creates an in-memory SQLite database per test. Implement IDisposable in your test class
/// and call Dispose() to clean up the connection.
/// </summary>
public sealed class DbContextFactory : IDisposable
{
    private readonly SqliteConnection _connection;

    public DbContextFactory()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        // FK enforcement is PostgreSQL's job in production; disable it here so
        // tests that mock UserManager (and don't insert the user row) still work.
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "PRAGMA foreign_keys = OFF;";
        cmd.ExecuteNonQuery();

        using var ctx = CreateContext();
        ctx.Database.EnsureCreated();
    }

    public ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;
        return new ApplicationDbContext(options);
    }

    public void Dispose() => _connection.Dispose();
}
