using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Order;
using Microsoft.AspNetCore.Http;
using OrganizedJihad.Api.Services.Ui;

namespace OrganizedJihad.Benchmarks;

/// <summary>
/// API server utility benchmarks for local UI URL and settings normalization paths.
/// </summary>
[MemoryDiagnoser]
[Orderer(SummaryOrderPolicy.FastestToSlowest)]
[RankColumn]
public class ApiServerUiBenchmarks {
	private readonly ApiLocalUrlBuilder _urlBuilder = new();
	private readonly DefaultHttpContext _context = new();

	[GlobalSetup]
	public void Setup() {
		_context.Request.Scheme = "http";
		_context.Connection.LocalPort = 5124;
		_context.Request.Host = new HostString("localhost", 5124);
	}

	/// <summary>
	/// Benchmark local API base URL builder used by /ui templates.
	/// </summary>
	[Benchmark(Description = "Build local UI base URL")]
	public string BuildLocalUiBaseUrl() {
		return _urlBuilder.BuildLocalBaseUrl(_context);
	}

	/// <summary>
	/// Benchmark API URL normalization guard for UI settings persistence.
	/// </summary>
	[Benchmark(Description = "Normalize local API URL")]
	public bool NormalizeLocalApiUrl() {
		return ApiUiInputNormalizer.TryNormalizeLocalApiUrl(
			rawUrl: "https://localhost:5124/api/sync/health",
			fallbackUrl: "http://localhost:5124",
			out _,
			out _);
	}

	/// <summary>
	/// Benchmark Hero Wars URL normalization guard for UI settings persistence.
	/// </summary>
	[Benchmark(Description = "Normalize Hero Wars URL")]
	public bool NormalizeHeroWarsUrl() {
		return ApiUiInputNormalizer.TryNormalizeHeroWarsUrl(
			rawUrl: "https://www.hero-wars.com/play",
			out _,
			out _);
	}
}
