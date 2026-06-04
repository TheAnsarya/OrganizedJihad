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
		options.SmokeRuntime.Should().Be("auto");
		options.DryRunFormat.Should().Be("text");
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
			"--skip-smoke-test",
			"--dry-run",
			"--dry-run-fail-on-warnings",
			"--dry-run-fail-on-errors"
		]);

		options.SkipUserscriptBuild.Should().BeTrue();
		options.SkipMigrationCheck.Should().BeTrue();
		options.SkipSmokeTest.Should().BeTrue();
		options.DryRun.Should().BeTrue();
		options.DryRunFailOnWarnings.Should().BeTrue();
		options.DryRunFailOnErrors.Should().BeTrue();
	}

	[Fact]
	public void Parse_Should_Set_StartupTimeoutSeconds_When_Valid() {
		var options = ReleaseOptions.Parse(["--startup-timeout-seconds", "120"]);

		options.StartupTimeoutSeconds.Should().Be(120);
	}

	[Fact]
	public void Parse_Should_Set_DryRunFormat_When_Valid() {
		var options = ReleaseOptions.Parse(["--dry-run-format", "json"]);

		options.DryRunFormat.Should().Be("json");
	}

	[Fact]
	public void Parse_Should_Set_DryRunOutputPath_When_Provided() {
		var options = ReleaseOptions.Parse(["--dry-run-output-path", "artifacts/dryrun/plan.json"]);

		options.DryRunOutputPath.Should().Be("artifacts/dryrun/plan.json");
	}

	[Fact]
	public void Parse_Should_Throw_For_Invalid_DryRunFormat() {
		var action = () => ReleaseOptions.Parse(["--dry-run-format", "yaml"]);

		action.Should().Throw<ArgumentException>().WithMessage("*--dry-run-format*");
	}

	[Fact]
	public void Parse_Should_Throw_For_NonInteger_StartupTimeoutSeconds() {
		var action = () => ReleaseOptions.Parse(["--startup-timeout-seconds", "abc"]);

		action.Should().Throw<ArgumentException>().WithMessage("*--startup-timeout-seconds*");
	}

	[Fact]
	public void Parse_Should_Throw_For_StartupTimeoutSeconds_Below_Minimum() {
		var action = () => ReleaseOptions.Parse(["--startup-timeout-seconds", "9"]);

		action.Should().Throw<ArgumentException>().WithMessage("*between 10 and 600*");
	}

	[Fact]
	public void Parse_Should_Throw_For_StartupTimeoutSeconds_Above_Maximum() {
		var action = () => ReleaseOptions.Parse(["--startup-timeout-seconds", "601"]);

		action.Should().Throw<ArgumentException>().WithMessage("*between 10 and 600*");
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

	[Fact]
	public void Parse_Should_Set_Smoke_Runtime_When_Provided() {
		var options = ReleaseOptions.Parse(["--smoke-runtime", "linux-x64"]);

		options.SmokeRuntime.Should().Be("linux-x64");
	}

	[Fact]
	public void Parse_Should_Throw_For_Invalid_Smoke_Runtime_With_Whitespace() {
		var action = () => ReleaseOptions.Parse(["--smoke-runtime", "linux x64"]);

		action.Should().Throw<ArgumentException>().WithMessage("*--smoke-runtime*");
	}

	[Fact]
	public void ResolveSmokeRuntimeForExecution_Should_Return_Null_When_Skip_Enabled() {
		var runtime = ReleasePipeline.ResolveSmokeRuntimeForExecution(["win-x64"], true, "auto", "win-x64");

		runtime.Should().BeNull();
	}

	[Fact]
	public void ResolveSmokeRuntimeForExecution_Should_Return_Host_Runtime_For_Auto_When_Present() {
		var runtime = ReleasePipeline.ResolveSmokeRuntimeForExecution(["linux-x64", "osx-x64"], false, "auto", "linux-x64");

		runtime.Should().Be("linux-x64");
	}

	[Fact]
	public void ResolveSmokeRuntimeForExecution_Should_Return_Null_For_Auto_When_Host_Not_In_Matrix() {
		var runtime = ReleasePipeline.ResolveSmokeRuntimeForExecution(["osx-arm64"], false, "auto", "win-x64");

		runtime.Should().BeNull();
	}

	[Fact]
	public void ResolveSmokeRuntimeForExecution_Should_Return_Null_For_None() {
		var runtime = ReleasePipeline.ResolveSmokeRuntimeForExecution(["win-x64"], false, "none", "win-x64");

		runtime.Should().BeNull();
	}

	[Fact]
	public void ResolveSmokeRuntimeForExecution_Should_Throw_When_Explicit_Runtime_Not_In_Matrix() {
		var action = () => ReleasePipeline.ResolveSmokeRuntimeForExecution(["linux-x64"], false, "win-x64", "linux-x64");

		action.Should().Throw<ArgumentException>().WithMessage("*not present in --runtimes*");
	}

	[Fact]
	public void Parse_Should_Throw_For_Unknown_Value_Option() {
		var action = () => ReleaseOptions.Parse(["--not-a-real-option", "123"]);

		action.Should().Throw<ArgumentException>().WithMessage("*Unknown option*--not-a-real-option*");
	}

	[Fact]
	public void Parse_Should_Throw_For_Unknown_Flag() {
		var action = () => ReleaseOptions.Parse(["--not-a-real-flag"]);

		action.Should().Throw<ArgumentException>().WithMessage("*Unknown flag*--not-a-real-flag*");
	}

	[Fact]
	public void Parse_Should_Throw_For_Runtime_With_Path_Separator() {
		var action = () => ReleaseOptions.Parse(["--runtimes", "win-x64,linux/x64"]);

		action.Should().Throw<ArgumentException>().WithMessage("*Path separators are not allowed*");
	}

	[Fact]
	public void Parse_Should_Throw_When_Runtime_List_Exceeds_Limit() {
		var runtimes = string.Join(',', Enumerable.Range(1, 17).Select(index => $"r{index}"));
		var action = () => ReleaseOptions.Parse(["--runtimes", runtimes]);

		action.Should().Throw<ArgumentException>().WithMessage("*Maximum is 16*");
	}

	[Fact]
	public void IsSafeArtifactRoot_Should_Return_True_For_Subdirectory_Under_Repo() {
		var safe = ReleasePipeline.IsSafeArtifactRoot("C:\\repo\\OrganizedJihad", "C:\\repo\\OrganizedJihad\\artifacts\\v0.2.3");

		safe.Should().BeTrue();
	}

	[Fact]
	public void IsSafeArtifactRoot_Should_Return_False_For_Repo_Root() {
		var safe = ReleasePipeline.IsSafeArtifactRoot("C:\\repo\\OrganizedJihad", "C:\\repo\\OrganizedJihad");

		safe.Should().BeFalse();
	}

	[Fact]
	public void IsSafeArtifactRoot_Should_Return_False_For_Path_Outside_Repo() {
		var safe = ReleasePipeline.IsSafeArtifactRoot("C:\\repo\\OrganizedJihad", "C:\\repo\\artifacts");

		safe.Should().BeFalse();
	}
}
