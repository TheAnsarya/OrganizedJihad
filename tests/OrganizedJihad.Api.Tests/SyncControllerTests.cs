using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OrganizedJihad.Api;
using OrganizedJihad.Api.Models;
using OrganizedJihad.Data;
using OrganizedJihad.Data.Models;
using System.Net;
using System.Net.Http.Json;

namespace OrganizedJihad.Api.Tests;

/// <summary>
/// Integration tests for Sync API
/// Tests the full HTTP request/response cycle with in-memory database
/// </summary>
public class SyncControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
	private readonly WebApplicationFactory<Program> _factory;
	private readonly HttpClient _client;

	public SyncControllerTests(WebApplicationFactory<Program> factory)
	{
		// Set environment variable to skip database initialization in Program.cs
		Environment.SetEnvironmentVariable("ASPNETCORE_TEST_ENV", "true");
		
		_factory = factory.WithWebHostBuilder(builder =>
		{
			builder.ConfigureTestServices(services =>
			{
				// Remove ALL Entity Framework service registrations to avoid provider conflicts
				var dbDescriptors = services
					.Where(d => d.ServiceType.Namespace != null &&
								(d.ServiceType.Namespace.StartsWith("Microsoft.EntityFrameworkCore") ||
								 d.ServiceType.FullName?.Contains("GameDatabaseContext") == true))
					.ToList();
				
				foreach (var descriptor in dbDescriptors)
				{
					services.Remove(descriptor);
				}

				// Add in-memory database factory for testing
				// InMemory database doesn't support transactions, so we configure warnings
				services.AddDbContextFactory<GameDatabaseContext>(options =>
					options.UseInMemoryDatabase("TestDatabase")
						.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)));
			});
		});

		_client = _factory.CreateClient();
	}

	[Fact]
	public async Task Sync_Should_Return_Ok_With_Valid_Data()
	{
		// Arrange
		var syncData = new BrowserSyncData
		{
			CurrentSnapshot = new PlayerSnapshot
			{
				PlayerId = 12345,
				PlayerName = "TestPlayer",
				Timestamp = DateTime.UtcNow,
				Level = 120,
				TeamPower = 1500000
			},
			Heroes = new List<Hero>(),
			Titans = new List<Titan>()
		};

		// Act
		var response = await _client.PostAsJsonAsync("/api/sync/import", syncData);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		
		var result = await response.Content.ReadFromJsonAsync<SyncResponse>();
		result.Should().NotBeNull();
		result!.Success.Should().BeTrue();
	}

	[Fact]
	public async Task Sync_Should_Handle_Empty_Data()
	{
		// Arrange
		var syncData = new BrowserSyncData
		{
			Heroes = new List<Hero>(),
			Titans = new List<Titan>()
		};

		// Act
		var response = await _client.PostAsJsonAsync("/api/sync/import", syncData);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		
		var result = await response.Content.ReadFromJsonAsync<SyncResponse>();
		result.Should().NotBeNull();
		result!.Success.Should().BeTrue();
	}

	[Fact]
	public async Task Health_Check_Should_Return_Ok()
	{
		// Act
		var response = await _client.GetAsync("/api/sync/health");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
	}
}
