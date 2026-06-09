using Microsoft.Extensions.Options;
using OrganizedJihad.Api.Configuration;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Background scheduler for automated daily report generation and retention cleanup.
/// </summary>
public sealed class ApiUiDailyReportAutomationHostedService : BackgroundService {
	private readonly IServiceScopeFactory _scopeFactory;
	private readonly IOptions<DailyReportAutomationOptions> _options;
	private readonly ILogger<ApiUiDailyReportAutomationHostedService> _logger;

	/// <summary>
	/// Initializes a new instance of the daily report automation hosted service.
	/// </summary>
	public ApiUiDailyReportAutomationHostedService(
		IServiceScopeFactory scopeFactory,
		IOptions<DailyReportAutomationOptions> options,
		ILogger<ApiUiDailyReportAutomationHostedService> logger) {
		_scopeFactory = scopeFactory;
		_options = options;
		_logger = logger;
	}

	/// <summary>
	/// Executes periodic report generation while host is running.
	/// </summary>
	protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
		var options = _options.Value;
		if (!options.Enabled) {
			_logger.LogInformation("Daily report automation is disabled.");
			return;
		}

		var intervalMinutes = Math.Clamp(options.IntervalMinutes, 1, 24 * 60);
		var retentionDays = Math.Clamp(options.RetentionDays, 1, 365);
		var interval = TimeSpan.FromMinutes(intervalMinutes);

		if (options.RunOnStartup) {
			await RunGenerationPassAsync(retentionDays, stoppingToken);
		}

		while (!stoppingToken.IsCancellationRequested) {
			try {
				await Task.Delay(interval, stoppingToken);
			}
			catch (OperationCanceledException) {
				break;
			}

			await RunGenerationPassAsync(retentionDays, stoppingToken);
		}
	}

	private async Task RunGenerationPassAsync(int retentionDays, CancellationToken cancellationToken) {
		try {
			using var scope = _scopeFactory.CreateScope();
			var service = scope.ServiceProvider.GetRequiredService<ApiUiDailyReportService>();
			var report = await service.GenerateAndPersistDailyReportAsync(retentionDays, cancellationToken);
			_logger.LogInformation("Generated automated daily report for {DateUtc} at {CheckedUtc}.", report.DateUtc, report.CheckedUtc);
		}
		catch (OperationCanceledException) {
			// Host is stopping.
		}
		catch (Exception ex) {
			_logger.LogWarning(ex, "Automated daily report generation pass failed.");
		}
	}
}
