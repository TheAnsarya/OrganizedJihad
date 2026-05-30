using FluentAssertions;
using OrganizedJihad.Release.Cli;

namespace OrganizedJihad.Release.Cli.Tests;

/// <summary>
/// Unit tests for release CLI option parsing and validation.
/// </summary>
public class ReleaseOptionsTests {
	[Fact]
	public void Parse_Should_Return_Defaults_When_No_Args() {
		var options = ReleaseOptions.Parse([]);

		options.Version.Should().Be("0.2.3");
		options.Configuration.Should().Be("Release");
		options.Runtimes.Should().ContainInOrder(["win-x64", "linux-x64", "osx-x64", "osx-arm64"]);
		options.SkipMigrationCheck.Should().BeFalse();
		options.SkipSmokeTest.Should().BeFalse();
	}

	[Fact]
	public void Parse_Should_Deduplicate_Runtimes_Using_CaseInsensitive_Comparison() {
		var options = ReleaseOptions.Parse(["--runtimes", "win-x64,WIN-x64,linux-x64"]);

		options.Runtimes.Should().ContainInOrder(["win-x64", "linux-x64"]);
	}

	[Fact]
	public void Parse_Should_Enable_Skip_Flags_When_Specified() {
		var options = ReleaseOptions.Parse([
			"--skip-userscript-build",
			"--skip-migration-check",
			"--skip-smoke-test"
		]);

		options.SkipUserscriptBuild.Should().BeTrue();
		options.SkipMigrationCheck.Should().BeTrue();
		options.SkipSmokeTest.Should().BeTrue();
	}

	[Fact]
	public void Parse_Should_Throw_For_Invalid_Smoke_Url() {
		var action = () => ReleaseOptions.Parse(["--smoke-api-url", "not-a-url"]);

		action.Should().Throw<ArgumentException>().WithMessage("*--smoke-api-url*");
	}

	[Fact]
	public void Parse_Should_Throw_For_NonHttp_Scheme() {
		var action = () => ReleaseOptions.Parse(["--migration-first-run-url", "ftp://localhost:5000"]);

		action.Should().Throw<ArgumentException>().WithMessage("*http or https*");
	}
}
