using FluentAssertions;
using OrganizedJihad.Api.TrayHost;

namespace OrganizedJihad.Api.TrayHost.Tests;

/// <summary>
/// Unit tests for tray host options parsing and runtime utilities.
/// </summary>
public class TrayHostOptionsAndUtilitiesTests {
	[Fact]
	public void Parse_Should_Normalize_ApiUrl_To_Authority() {
		var args = new[] { "--api-url", "http://localhost:5124/api/sync/health" };

		var parsed = TrayHostOptions.Parse(args);

		parsed.ApiUrl.Should().Be("http://localhost:5124");
	}

	[Fact]
	public void Parse_Should_Fallback_To_Default_ApiUrl_For_Invalid_Url() {
		var args = new[] { "--api-url", "not-a-url" };

		var parsed = TrayHostOptions.Parse(args);

		parsed.ApiUrl.Should().Be("http://localhost:5124");
	}

	[Fact]
	public void Parse_Should_Fallback_To_Default_ApiUrl_For_Unsupported_Scheme() {
		var args = new[] { "--api-url", "ftp://localhost:21" };

		var parsed = TrayHostOptions.Parse(args);

		parsed.ApiUrl.Should().Be("http://localhost:5124");
	}

	[Fact]
	public void Parse_Should_Normalize_WorkingDirectory_To_Absolute_Path() {
		var relative = Path.Combine(".", "api");
		var args = new[] { "--working-directory", relative };

		var parsed = TrayHostOptions.Parse(args);

		Path.IsPathRooted(parsed.WorkingDirectory).Should().BeTrue();
	}

	[Fact]
	public void TryGetUpdatedApiUrl_Should_Return_Normalized_Url() {
		var tempDir = Path.Combine(Path.GetTempPath(), "oj-tray-tests", Guid.NewGuid().ToString("N"));
		Directory.CreateDirectory(tempDir);
		var settingsPath = Path.Combine(tempDir, "api-ui-settings.json");
		File.WriteAllText(settingsPath, "{ \"apiBaseUrl\": \"https://localhost:9999/path\" }");

		var marker = DateTime.MinValue;
		var ok = TrayHostRuntimeUtilities.TryGetUpdatedApiUrl(settingsPath, ref marker, "http://localhost:5124", out var updatedApiUrl);

		ok.Should().BeTrue();
		updatedApiUrl.Should().Be("https://localhost:9999");
	}

	[Fact]
	public void TryGetUpdatedApiUrl_Should_Ignore_Oversized_Settings_File() {
		var tempDir = Path.Combine(Path.GetTempPath(), "oj-tray-tests", Guid.NewGuid().ToString("N"));
		Directory.CreateDirectory(tempDir);
		var settingsPath = Path.Combine(tempDir, "api-ui-settings.json");
		var hugePayload = new string('x', 600 * 1024);
		File.WriteAllText(settingsPath, hugePayload);

		var marker = DateTime.MinValue;
		var ok = TrayHostRuntimeUtilities.TryGetUpdatedApiUrl(settingsPath, ref marker, "http://localhost:5124", out var updatedApiUrl);

		ok.Should().BeFalse();
		updatedApiUrl.Should().BeNull();
	}
}
