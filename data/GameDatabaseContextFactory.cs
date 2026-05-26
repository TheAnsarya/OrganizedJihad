using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace OrganizedJihad.Data;

/// <summary>
/// Design-time factory for GameDatabaseContext
/// Required for EF Core migrations when DbContext has required constructor parameters
/// Reference: https://learn.microsoft.com/en-us/ef/core/cli/dbcontext-creation
/// </summary>
public class GameDatabaseContextFactory : IDesignTimeDbContextFactory<GameDatabaseContext> {
	public GameDatabaseContext CreateDbContext(string[] args) {
		// Build configuration options for SQLite
		// Uses design-time connection string, actual app will use its own
		var optionsBuilder = new DbContextOptionsBuilder<GameDatabaseContext>();
		optionsBuilder.UseSqlite("Data Source=herowars.db");

		return new GameDatabaseContext(optionsBuilder.Options);
	}
}
