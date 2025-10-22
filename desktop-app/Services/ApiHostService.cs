using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OrganizedJihad.Desktop.Data;
using OrganizedJihad.Desktop.Controllers;
using System.Threading;
using System.Threading.Tasks;

namespace OrganizedJihad.Desktop.Services;

/// <summary>
/// Hosts a local ASP.NET Core API server on localhost:5000 for browser-to-desktop sync.
/// Runs in the background while the MAUI app is active.
/// </summary>
public class ApiHostService
{
	private WebApplication? _app;
	private CancellationTokenSource? _cts;
	private Task? _runTask;
	private readonly IDbContextFactory<GameDatabaseContext> _contextFactory;
	private readonly ILogger<ApiHostService> _logger;

	public bool IsRunning { get; private set; }
	public string BaseUrl => "http://localhost:5000";

	public ApiHostService(
		IDbContextFactory<GameDatabaseContext> contextFactory,
		ILogger<ApiHostService> logger)
	{
		_contextFactory = contextFactory;
		_logger = logger;
	}

	/// <summary>
	/// Starts the API server on localhost:5000.
	/// </summary>
	public async Task StartAsync()
	{
		if (IsRunning)
		{
			_logger.LogWarning("API server is already running");
			return;
		}

		try
		{
			_logger.LogInformation("Starting API server on {BaseUrl}", BaseUrl);

			var builder = WebApplication.CreateBuilder();

			// Configure services
			builder.Services.AddControllers();
			builder.Services.AddEndpointsApiExplorer();
			builder.Services.AddCors(options =>
			{
				options.AddDefaultPolicy(policy =>
				{
					policy.AllowAnyOrigin()
						  .AllowAnyMethod()
						  .AllowAnyHeader();
				});
			});

			// Register database context factory (singleton from MAUI)
			builder.Services.AddSingleton(_contextFactory);

			// Register services
			builder.Services.AddScoped<SyncService>();

			// Configure logging
			builder.Logging.ClearProviders();
			builder.Logging.AddDebug();
			builder.Logging.SetMinimumLevel(LogLevel.Information);

			// Configure Kestrel to listen on localhost:5000
			builder.WebHost.UseUrls(BaseUrl);

			_app = builder.Build();

			// Configure middleware
			_app.UseCors();
			_app.MapControllers();

			// Add a simple welcome endpoint
			_app.MapGet("/", () => new
			{
				message = "OrganizedJihad Desktop API",
				version = "1.0.0",
				endpoints = new[]
				{
					"GET  /api/sync/health",
					"GET  /api/sync/last-sync",
					"GET  /api/sync/stats",
					"POST /api/sync/import"
				}
			});

			// Start the server in background
			_cts = new CancellationTokenSource();
			_runTask = _app.RunAsync(_cts.Token);

			// Give it a moment to start
			await Task.Delay(500);

			IsRunning = true;
			_logger.LogInformation("API server started successfully on {BaseUrl}", BaseUrl);
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Failed to start API server");
			IsRunning = false;
			throw;
		}
	}

	/// <summary>
	/// Stops the API server.
	/// </summary>
	public async Task StopAsync()
	{
		if (!IsRunning)
		{
			return;
		}

		try
		{
			_logger.LogInformation("Stopping API server");

			_cts?.Cancel();

			if (_runTask != null)
			{
				await _runTask;
			}

			if (_app != null)
			{
				await _app.DisposeAsync();
			}

			IsRunning = false;
			_logger.LogInformation("API server stopped");
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error stopping API server");
		}
		finally
		{
			_cts?.Dispose();
			_cts = null;
			_runTask = null;
			_app = null;
		}
	}
}
