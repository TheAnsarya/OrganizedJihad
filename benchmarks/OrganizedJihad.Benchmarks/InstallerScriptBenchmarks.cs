using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Order;
using System.Text.RegularExpressions;

namespace OrganizedJihad.Benchmarks;

/// <summary>
/// Script-level installer/release benchmark probes for common validation checks.
/// </summary>
[MemoryDiagnoser]
[Orderer(SummaryOrderPolicy.FastestToSlowest)]
[RankColumn]
public class InstallerScriptBenchmarks {
	private string _installPs1 = string.Empty;
	private string _publishReleasePs1 = string.Empty;

	[GlobalSetup]
	public void Setup() {
		var root = ResolveRepositoryRoot();
		_installPs1 = File.ReadAllText(Path.Combine(root, "Install-OrganizedJihad.ps1"));
		_publishReleasePs1 = File.ReadAllText(Path.Combine(root, "Publish-ReleaseArtifacts.ps1"));
	}

	/// <summary>
	/// Benchmark installer parameter extraction regex against the install script body.
	/// </summary>
	[Benchmark(Description = "Parse installer switch list")]
	public int ParseInstallerSwitchList() {
		var matches = Regex.Matches(_installPs1, "-[A-Za-z][A-Za-z0-9]+", RegexOptions.CultureInvariant);
		return matches.Count;
	}

	/// <summary>
	/// Benchmark release script safety token scanning for smoke/migration hooks.
	/// </summary>
	[Benchmark(Description = "Scan release safety hooks")]
	public int ScanReleaseSafetyHooks() {
		var checks = 0;
		if (_publishReleasePs1.Contains("Test-ApiMigrationPath.ps1", StringComparison.Ordinal)) {
			checks++;
		}

		if (_publishReleasePs1.Contains("Test-ReleaseSmoke.ps1", StringComparison.Ordinal)) {
			checks++;
		}

		if (_publishReleasePs1.Contains("win-x64,linux-x64,osx-x64,osx-arm64", StringComparison.Ordinal)) {
			checks++;
		}

		return checks;
	}

	private static string ResolveRepositoryRoot() {
		var current = new DirectoryInfo(AppContext.BaseDirectory);
		while (current is not null) {
			if (File.Exists(Path.Combine(current.FullName, "OrganizedJihad.sln"))) {
				return current.FullName;
			}

			current = current.Parent;
		}

		throw new InvalidOperationException("Could not locate repository root from benchmark base directory.");
	}
}
