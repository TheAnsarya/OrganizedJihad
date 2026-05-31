using System.Diagnostics;
using FluentAssertions;
using OrganizedJihad.Api.TrayHost;

namespace OrganizedJihad.Api.TrayHost.Tests;

public sealed class ApiProcessRuntimeTests {
	[Fact]
	public void StopManagedProcess_Should_NotThrow_When_ProcessAlreadyExited() {
		using var process = Process.Start(new ProcessStartInfo {
			FileName = "cmd",
			Arguments = "/c exit 0",
			UseShellExecute = false,
			CreateNoWindow = true,
		});

		process.Should().NotBeNull();
		process!.WaitForExit(2000).Should().BeTrue();

		var action = () => ApiProcessRuntime.StopManagedProcess(process);
		action.Should().NotThrow();
	}

	[Fact]
	public void StopManagedProcess_Should_Terminate_Running_Process() {
		using var process = Process.Start(new ProcessStartInfo {
			FileName = "cmd",
			Arguments = "/c timeout /t 30 >nul",
			UseShellExecute = false,
			CreateNoWindow = true,
		});

		process.Should().NotBeNull();

		ApiProcessRuntime.StopManagedProcess(process);

		process!.HasExited.Should().BeTrue();
	}

	[Fact]
	public void StopProcessesByName_Should_NotThrow_For_Unknown_Name() {
		var action = () => ApiProcessRuntime.StopProcessesByName("DefinitelyNotARealProcess-12345.exe");

		action.Should().NotThrow();
	}
}
