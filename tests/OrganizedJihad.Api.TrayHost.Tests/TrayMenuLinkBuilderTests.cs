using FluentAssertions;
using OrganizedJihad.Api.TrayHost;

namespace OrganizedJihad.Api.TrayHost.Tests;

public class TrayMenuLinkBuilderTests {
	[Theory]
	[InlineData("http://localhost:5124")]
	[InlineData("http://localhost:5124/")]
	public void BuildUiUrl_Should_Normalize_Trailing_Slash(string apiUrl) {
		TrayMenuLinkBuilder.BuildUiUrl(apiUrl).Should().Be("http://localhost:5124/ui");
	}

	[Fact]
	public void BuildHealthUrl_Should_Return_Tray_Health_Path() {
		TrayMenuLinkBuilder.BuildHealthUrl("http://localhost:5124").Should().Be("http://localhost:5124/ui/tray-health");
	}

	[Fact]
	public void BuildSwaggerUrl_Should_Return_Swagger_Path() {
		TrayMenuLinkBuilder.BuildSwaggerUrl("http://localhost:5124").Should().Be("http://localhost:5124/swagger");
	}

	[Fact]
	public void BuildOpenApiJsonUrl_Should_Return_OpenApi_Path() {
		TrayMenuLinkBuilder.BuildOpenApiJsonUrl("http://localhost:5124").Should().Be("http://localhost:5124/swagger/v1/swagger.json");
	}

	[Fact]
	public void BuildLogsUrl_Should_Return_Log_Endpoint_Path() {
		TrayMenuLinkBuilder.BuildLogsUrl("http://localhost:5124").Should().Be("http://localhost:5124/ui/logs/latest");
	}
}
