using FluentAssertions;
using OrganizedJihad.Api.TrayHost;

namespace OrganizedJihad.Api.TrayHost.Tests;

/// <summary>
/// Unit tests for tray runtime settings parsing helpers.
/// </summary>
public class TrayRuntimeSettingsParserTests {
	[Fact]
	public void TryReadApiBaseUrl_Should_Return_True_For_Valid_Json() {
		var json = "{ \"apiBaseUrl\": \"http://localhost:5124\" }";

		var ok = TrayRuntimeSettingsParser.TryReadApiBaseUrl(json, out var apiBaseUrl);

		ok.Should().BeTrue();
		apiBaseUrl.Should().Be("http://localhost:5124");
	}

	[Fact]
	public void TryReadApiBaseUrl_Should_Return_False_When_Property_Missing() {
		var json = "{ \"preferredHeroWarsUrl\": \"https://www.hero-wars.com/\" }";

		var ok = TrayRuntimeSettingsParser.TryReadApiBaseUrl(json, out var apiBaseUrl);

		ok.Should().BeFalse();
		apiBaseUrl.Should().BeNull();
	}

	[Fact]
	public void TryReadApiBaseUrl_Should_Throw_For_Invalid_Json() {
		var action = () => TrayRuntimeSettingsParser.TryReadApiBaseUrl("not-json", out _);

		action.Should().Throw<System.Text.Json.JsonException>();
	}
}
