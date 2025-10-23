using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
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
		_factory = factory.WithWebHostBuilder(builder =>
		{
			builder.ConfigureServices(services =>
			{
				// Remove existing DbContext registration
				var descriptor = services.SingleOrDefault(
					d => d.ServiceType == typeof(DbContextOptions<GameDatabaseContext>));
				
				if (descriptor != null)
				{
					services.Remove(descriptor);
				}

				// Add in-memory database for testing
				services.AddDbContext<GameDatabaseContext>(options =>
				{
					options.UseInMemoryDatabase("TestDatabase");
				});
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
		var response = await _client.PostAsJsonAsync("/api/sync", syncData);

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
		var response = await _client.PostAsJsonAsync("/api/sync", syncData);

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
		var response = await _client.GetAsync("/health");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
	}
}
