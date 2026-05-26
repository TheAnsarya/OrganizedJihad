# OrganizedJihad - Code Style Guide

**Last Updated**: October 22, 2025  
**Project**: Hero Wars Tracker (TamperMonkey Userscript + .NET MAUI Desktop App)

## Table of Contents
1. [Formatting Standards](#formatting-standards)
2. [Comment Requirements](#comment-requirements)
3. [C# Specific Guidelines](#c-specific-guidelines)
4. [JavaScript/TypeScript Guidelines](#javascript-typescript-guidelines)
5. [Razor/Blazor Guidelines](#razor-blazor-guidelines)

---

## Formatting Standards

### Universal Rules (All File Types)

```properties
charset = utf-8
indent_style = tab
indent_size = 4
tab_width = 4
end_of_line = crlf
trim_trailing_whitespace = true
insert_final_newline = true
max_line_length = 120
```

**Reference**: [EditorConfig Documentation](https://editorconfig.org/)

### Why TABS over SPACES?
- **Accessibility**: Users can configure tab width to their preference (visual impairment accommodation)
- **File Size**: Tabs = 1 byte, spaces = multiple bytes
- **Consistency**: Enforced via `.editorconfig` and automated formatters

**Reference**: [Tabs vs Spaces: The Accessibility Argument](https://www.reddit.com/r/javascript/comments/c8drjo/nobody_talks_about_the_real_reason_to_use_tabs/)

---

## Comment Requirements

### 1. **ALWAYS Comment Code**

Every method, class, property, and complex logic block MUST have comments explaining:
- **What** it does
- **Why** it exists (business logic/design decision)
- **How** it works (for non-trivial implementations)
- **Links** to relevant documentation or articles

### 2. **Comment Inside Methods**

**❌ Bad - No Comments:**
```csharp
public async Task<List<ArenaBattle>> GetRecentBattles() {
	return await _context.ArenaBattles
		.OrderByDescending(b => b.Timestamp)
		.Take(10)
		.ToListAsync();
}
```

**✅ Good - Comprehensive Comments:**
```csharp
/// <summary>
/// Retrieves the 10 most recent arena battles for display in the dashboard.
/// Battles are immutable records captured from Hero Wars API responses.
/// </summary>
/// <returns>List of ArenaBattle entities, newest first</returns>
/// <remarks>
/// Uses EF Core's async query methods for non-blocking database access.
/// Reference: https://docs.microsoft.com/en-us/ef/core/querying/
/// </remarks>
public async Task<List<ArenaBattle>> GetRecentBattles() {
	// Query arena battles table and order by timestamp descending
	// Take(10) limits result set to 10 most recent battles
	// ToListAsync() executes query asynchronously and materializes results
	// Reference: https://docs.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.entityframeworkqueryableextensions.tolistasync
	return await _context.ArenaBattles
		.OrderByDescending(b => b.Timestamp)
		.Take(10)
		.ToListAsync();
}
```

### 3. **Include Documentation Links**

Always include links to:
- Official documentation (Microsoft Docs, MDN, etc.)
- Community guides (Hero Wars forums, Reddit, etc.)
- Design pattern explanations
- API references

**Example:**
```csharp
// Use nullish coalescing to provide default value if guild name is null
// Reference: https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/operators/null-coalescing-operator
string displayName = guildName ?? "No Guild";
```

---

## C# Specific Guidelines

### Opening Braces on Same Line

**Configuration:**
```properties
csharp_new_line_before_open_brace = none
```

**✅ Correct:**
```csharp
public class PlayerSnapshot : CreationAuditableEntity {
	public int Id { get; set; }
	
	public void UpdateStats() {
		if (Level > 100) {
			// Logic here
		}
	}
}
```

**❌ Incorrect (Allman style - DO NOT USE):**
```csharp
public class PlayerSnapshot : CreationAuditableEntity
{
	public int Id { get; set; }
	
	public void UpdateStats()
	{
		if (Level > 100)
		{
			// Logic here
		}
	}
}
```

**Reference**: [C# Coding Conventions](https://docs.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions)

### File-Scoped Namespaces (Required)

**✅ Correct:**
```csharp
namespace OrganizedJihad.Data.Models;

/// <summary>
/// Represents a player snapshot captured from Hero Wars API
/// </summary>
public class PlayerSnapshot : CreationAuditableEntity {
	// Properties...
}
```

**❌ Incorrect:**
```csharp
namespace OrganizedJihad.Data.Models {
	public class PlayerSnapshot : CreationAuditableEntity {
		// Properties...
	}
}
```

**Configuration:**
```properties
csharp_style_namespace_declarations = file_scoped:error
```

**Reference**: [File-scoped namespaces (C# 10)](https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-10.0/file-scoped-namespaces)

### JSDoc-Style XML Comments

**Required for:**
- All public classes
- All public methods
- All public properties
- Complex private methods

**Format:**
```csharp
/// <summary>
/// Brief one-line description of what this does.
/// </summary>
/// <param name="paramName">Description of parameter</param>
/// <returns>Description of return value</returns>
/// <remarks>
/// Additional context, design decisions, or important notes.
/// Include links to relevant documentation.
/// </remarks>
/// <exception cref="ArgumentNullException">Thrown when paramName is null</exception>
public async Task<Result> MethodName(string paramName) {
	// Implementation with inline comments
}
```

**Reference**: [XML Documentation Comments](https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/xmldoc/)

### Modern C# Features (Use These!)

```csharp
// ✅ Null-coalescing assignment (C# 8)
// Reference: https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/operators/null-coalescing-operator
player.Name ??= "Unknown Player";

// ✅ Null-conditional operator (C# 6)
// Reference: https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/operators/member-access-operators#null-conditional-operators--and-
int? length = player?.Name?.Length;

// ✅ Pattern matching (C# 9+)
// Reference: https://docs.microsoft.com/en-us/dotnet/csharp/fundamentals/functional/pattern-matching
if (battle is { IsWin: true, CoinsEarned: > 100 }) {
	// High-value win logic
}

// ✅ Target-typed new (C# 9)
// Reference: https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/proposals/csharp-9.0/target-typed-new
List<ArenaBattle> battles = new();

// ✅ String interpolation (C# 6)
// Reference: https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/tokens/interpolated
string message = $"Player {name} won with {coins} coins";
```

---

## JavaScript/TypeScript Guidelines

### Use Modern ES2024+ Features

```javascript
// ✅ Optional chaining (ES2020)
// Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
const guildName = response?.data?.guild?.name;

// ✅ Nullish coalescing (ES2020)
// Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing
const displayName = guildName ?? 'No Guild';

// ✅ Async/await (ES2017)
// Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
async function fetchPlayerData(playerId) {
	// Use try/catch for error handling in async functions
	// Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch
	try {
		const response = await fetch(`/api/player/${playerId}`);
		return await response.json();
	} catch (error) {
		console.error('Failed to fetch player data:', error);
		return null;
	}
}

// ✅ Private class fields (ES2022)
// Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields
class GameTracker {
	#apiInterceptor;
	
	constructor() {
		// Private field can only be accessed within class
		this.#apiInterceptor = new APIInterceptor();
	}
}
```

### JSDoc Comments (Required)

```javascript
/**
 * Tracks arena battle results captured from Hero Wars API responses.
 * Extracts opponent info, win/loss status, and rewards earned.
 * 
 * @param {Object} battleData - Raw battle data from game API
 * @param {number} battleData.opponentId - Opponent's user ID
 * @param {string} battleData.opponentName - Opponent's display name
 * @param {boolean} battleData.isWin - Whether player won the battle
 * @returns {Promise<void>} Resolves when battle data is stored
 * 
 * @throws {TypeError} If battleData is not an object
 * @throws {ValidationError} If required fields are missing
 * 
 * @see {@link https://www.hero-wars.com/|Hero Wars Official Site}
 * @see {@link https://hw-mobile.fandom.com/wiki/Arena|Hero Wars Arena Guide}
 * 
 * @example
 * await trackArenaBattle({
 *   opponentId: 12345,
 *   opponentName: "Enemy123",
 *   isWin: true
 * });
 */
async function trackArenaBattle(battleData) {
	// Validate input parameters
	// Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof
	if (typeof battleData !== 'object' || battleData === null) {
		throw new TypeError('battleData must be a non-null object');
	}
	
	// Extract opponent information with fallback values
	// Use destructuring for cleaner code
	// Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
	const { opponentId, opponentName = 'Unknown', isWin = false } = battleData;
	
	// Store battle data using GM storage API
	// Reference: https://www.tampermonkey.net/documentation.php#GM_setValue
	await GM.setValue('lastBattle', {
		opponentId,
		opponentName,
		isWin,
		timestamp: Date.now()
	});
}
```

---

## Razor/Blazor Guidelines

### Razor File Structure

```razor
@* 
	Component: Home Page Dashboard
	Purpose: Displays player statistics, recent battles, and chest openings
	
	Reference: https://docs.microsoft.com/en-us/aspnet/core/blazor/components/
*@

@page "/"
@using OrganizedJihad.Data.Models
@inject GameDatabaseContext DbContext

<PageTitle>Hero Wars Tracker - Home</PageTitle>

<div class="container-fluid">
	@* 
		Statistics Cards Section
		Displays key metrics: total battles, win rate, chests opened, last sync time
		Reference: https://getbootstrap.com/docs/5.3/components/card/
	*@
	<div class="row mb-4">
		<div class="col-md-3">
			@* 
				Total Battles Card
				Shows count of all arena battles in database
			*@
			<div class="card">
				<div class="card-body">
					<h5 class="card-title">Total Battles</h5>
					<p class="card-text display-4">@Stats.TotalBattles</p>
				</div>
			</div>
		</div>
	</div>
</div>

@code {
	/// <summary>
	/// Statistics data model for dashboard display.
	/// Populated during OnInitializedAsync lifecycle method.
	/// </summary>
	/// <remarks>
	/// Reference: https://docs.microsoft.com/en-us/aspnet/core/blazor/components/lifecycle
	/// </remarks>
	private class DashboardStats {
		public int TotalBattles { get; set; }
		public double WinRate { get; set; }
		public int ChestsOpened { get; set; }
		public DateTime? LastSync { get; set; }
	}
	
	private DashboardStats Stats { get; set; } = new();
	
	/// <summary>
	/// Blazor lifecycle method called when component is initialized.
	/// Loads dashboard statistics from database asynchronously.
	/// </summary>
	/// <returns>Task representing the async initialization operation</returns>
	/// <remarks>
	/// OnInitializedAsync runs once per component instantiation.
	/// Use this for async data loading operations.
	/// Reference: https://docs.microsoft.com/en-us/aspnet/core/blazor/components/lifecycle#component-initialization-oninitializedasync
	/// </remarks>
	protected override async Task OnInitializedAsync() {
		// Load total battle count from database
		// CountAsync is more efficient than loading all records
		// Reference: https://docs.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.entityframeworkqueryableextensions.countasync
		Stats.TotalBattles = await DbContext.ArenaBattles.CountAsync();
		
		// Calculate win rate percentage
		// Use OfType to filter nullable booleans safely
		if (Stats.TotalBattles > 0) {
			int wins = await DbContext.ArenaBattles
				.Where(b => b.IsWin)
				.CountAsync();
			
			// Calculate percentage with double precision
			// Cast to double to avoid integer division
			Stats.WinRate = (wins / (double)Stats.TotalBattles) * 100;
		}
	}
}
```

### Razor Comment Syntax

**HTML Comments (visible in rendered output):**
```razor
<!-- This is an HTML comment, visible in browser DevTools -->
```

**Razor Comments (not rendered):**
```razor
@* This is a Razor comment, not included in output *@

@*
	Multi-line Razor comment
	Use this for internal documentation
	Reference links and design decisions go here
*@
```

**Reference**: [Razor Syntax](https://docs.microsoft.com/en-us/aspnet/core/mvc/views/razor)

---

## Additional Resources

### Official Documentation
- [C# Coding Conventions](https://docs.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions)
- [.NET API Browser](https://docs.microsoft.com/en-us/dotnet/api/)
- [ASP.NET Core Blazor](https://docs.microsoft.com/en-us/aspnet/core/blazor/)
- [Entity Framework Core](https://docs.microsoft.com/en-us/ef/core/)
- [.NET MAUI Documentation](https://docs.microsoft.com/en-us/dotnet/maui/)
- [MDN Web Docs (JavaScript)](https://developer.mozilla.org/)
- [TamperMonkey API](https://www.tampermonkey.net/documentation.php)

### Community Resources
- [Hero Wars Wiki](https://hw-mobile.fandom.com/)
- [Hero Wars Subreddit](https://www.reddit.com/r/HeroWarsApp/)
- [C# Discord Community](https://discord.gg/csharp)

### Code Quality Tools
- [EditorConfig](https://editorconfig.org/)
- [.NET Format](https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-format)
- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/)

---

## Enforcement

### Automated Formatting
```bash
# Format all C# code in solution
dotnet format

# Format JavaScript/TypeScript in userscript
cd userscript
yarn format
```

### Pre-commit Hooks (TODO)
Consider adding Git pre-commit hooks to automatically format code before commits.

**Reference**: [Git Hooks Documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)

---

## Questions?

If you're unsure about formatting or comment style, refer to:
1. This document first
2. `.editorconfig` in project root
3. Existing codebase examples
4. Official documentation links provided above

**Remember**: When in doubt, over-comment rather than under-comment. Future you (and other developers) will thank you!
