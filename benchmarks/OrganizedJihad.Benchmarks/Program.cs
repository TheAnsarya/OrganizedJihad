using BenchmarkDotNet.Running;
using OrganizedJihad.Benchmarks;

/// <summary>
/// Entry point for BenchmarkDotNet performance tests.
/// Run with: dotnet run --project benchmarks/OrganizedJihad.Benchmarks -c Release
/// </summary>
BenchmarkSwitcher.FromAssembly(typeof(DataLayerBenchmarks).Assembly).Run(args);
