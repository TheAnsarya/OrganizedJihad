using FluentAssertions;

namespace OrganizedJihad.Api.Tests;

/// <summary>
/// Contract tests for installer/release scripts to prevent accidental flag drift.
/// </summary>
public class InstallerScriptContractTests {
	[Fact]
	public void InstallScript_Should_Expose_Diagnostics_And_HealthCheck_Flags() {
		var scriptPath = GetRepoFilePath("Install-OrganizedJihad.ps1");
		File.Exists(scriptPath).Should().BeTrue();

		var script = File.ReadAllText(scriptPath);
		script.Should().Contain("-FirstRunDiagnostics");
		script.Should().Contain("-RunInstallHealthCheck");
		script.Should().Contain("-InstallHealthCheckJson");
		script.Should().Contain("-InstallHealthCheckOpen");
		script.Should().Contain("-OpenUserscriptDiagnostics");
	}

	[Fact]
	public void InstallCmd_Should_Request_Elevation_With_Runas() {
		var scriptPath = GetRepoFilePath("Install-OrganizedJihad.cmd");
		File.Exists(scriptPath).Should().BeTrue();

		var script = File.ReadAllText(scriptPath);
		script.Should().Contain("Start-Process", Exactly.Once());
		script.Should().Contain("-Verb RunAs");
	}

	[Fact]
	public void PublishReleaseScript_Should_Default_To_CrossPlatform_Runtimes() {
		var scriptPath = GetRepoFilePath("Publish-ReleaseArtifacts.ps1");
		File.Exists(scriptPath).Should().BeTrue();

		var script = File.ReadAllText(scriptPath);
		script.Should().Contain("win-x64,linux-x64,osx-x64,osx-arm64");
		script.Should().Contain("Test-ApiMigrationPath.ps1");
		script.Should().Contain("Test-ReleaseSmoke.ps1");
	}

	private static string GetRepoFilePath(string fileName) {
		var current = new DirectoryInfo(AppContext.BaseDirectory);
		while (current is not null) {
			if (File.Exists(Path.Combine(current.FullName, "OrganizedJihad.sln"))) {
				return Path.Combine(current.FullName, fileName);
			}

			current = current.Parent;
		}

		throw new InvalidOperationException("Could not locate repository root from test base directory.");
	}
}
