using FluentAssertions;
using Microsoft.AspNetCore.Http;
using OrganizedJihad.Api.Services.Ui;

namespace OrganizedJihad.Api.Tests;

/// <summary>
/// Unit tests for UI safety-oriented helpers and validators.
/// </summary>
public class ApiUiSafetyTests {
	[Theory]
	[InlineData("https://www.hero-wars.com/", true)]
	[InlineData("https://game.hero-wars.com/", true)]
	[InlineData("https://hero-wars.com.evil.example/", false)]
	[InlineData("https://evil-hero-wars.com/", false)]
	public void TryNormalizeHeroWarsUrl_Should_Validate_Exact_Domain_Rules(string candidate, bool expected) {
		var ok = ApiUiInputNormalizer.TryNormalizeHeroWarsUrl(candidate, out var normalized, out _);

		ok.Should().Be(expected);
		if (expected) {
			normalized.Should().NotBeNullOrWhiteSpace();
		}
	}

	[Theory]
	[InlineData("http://localhost:5124", true)]
	[InlineData("https://127.0.0.1:9443", true)]
	[InlineData("https://[::1]", false)]
	[InlineData("https://example.com", false)]
	[InlineData("ftp://localhost", false)]
	public void TryNormalizeLocalApiUrl_Should_Enforce_Loopback_And_HttpSchemes(string candidate, bool expected) {
		var ok = ApiUiInputNormalizer.TryNormalizeLocalApiUrl(candidate, "http://localhost:5124", out _, out _);

		ok.Should().Be(expected);
	}

	[Fact]
	public void BuildLocalBaseUrl_Should_Use_Loopback_And_LocalPort() {
		var builder = new ApiLocalUrlBuilder();
		var context = new DefaultHttpContext();
		context.Request.Scheme = "https";
		context.Connection.LocalPort = 5443;
		context.Request.Host = new HostString("attacker.example", 9999);

		var baseUrl = builder.BuildLocalBaseUrl(context);

		baseUrl.Should().Be("https://localhost:5443");
	}

	[Fact]
	public void Render_Should_Reject_Path_Traversal_Template_Name() {
		var renderer = new ApiUiTemplateRenderer();
		var action = () => renderer.Render("..\\secret.html", new Dictionary<string, string>());

		action.Should().Throw<ArgumentException>();
	}
}
