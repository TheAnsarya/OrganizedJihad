using System.Diagnostics;
using System.Text;
using Microsoft.Extensions.Options;
using OrganizedJihad.Api.Configuration;

namespace OrganizedJihad.Api.Middleware;

/// <summary>
/// Logs API request and response metadata with optional debug-level payload snippets.
/// </summary>
public sealed class ApiCallLoggingMiddleware {
	private const string CorrelationIdHeaderName = "X-Correlation-ID";
	private static readonly HashSet<string> _loggableContentTypeTokens = ["application/json", "text/"];
	private readonly RequestDelegate _next;
	private readonly ILogger<ApiCallLoggingMiddleware> _logger;
	private readonly ApiCallLoggingOptions _options;

	/// <summary>
	/// Initializes a new instance of the <see cref="ApiCallLoggingMiddleware"/> class.
	/// </summary>
	public ApiCallLoggingMiddleware(
		RequestDelegate next,
		ILogger<ApiCallLoggingMiddleware> logger,
		IOptions<ApiCallLoggingOptions> options) {
		_next = next;
		_logger = logger;
		_options = options.Value;
	}

	/// <summary>
	/// Executes API call logging logic for a request.
	/// </summary>
	public async Task InvokeAsync(HttpContext context) {
		if (!_options.Enabled || !context.Request.Path.StartsWithSegments("/api") || IsExcludedPath(context.Request.Path)) {
			await _next(context);
			return;
		}

		var sw = Stopwatch.StartNew();
		var traceId = context.TraceIdentifier;
		var correlationId = ResolveCorrelationId(context);
		var method = context.Request.Method;
		var path = context.Request.Path + context.Request.QueryString;
		var requestBody = await TryReadRequestBodyAsync(context.Request);

		await using var responseBuffer = ShouldCaptureResponseBody() ? new MemoryStream() : null;
		Stream? originalResponseBody = null;

		if (responseBuffer != null) {
			originalResponseBody = context.Response.Body;
			context.Response.Body = responseBuffer;
		}

		try {
			await _next(context);
		}
		catch (Exception ex) {
			sw.Stop();
			_logger.LogError(ex,
				"API call failed: {Method} {Path} ({ElapsedMs}ms, TraceId={TraceId}, CorrelationId={CorrelationId})",
				method,
				path,
				sw.ElapsedMilliseconds,
				traceId,
				correlationId);
			throw;
		}
		finally {
			sw.Stop();
			string? responseBody = null;

			if (responseBuffer != null && originalResponseBody != null) {
				responseBody = await ReadResponseBodyAsync(responseBuffer, context.Response);
				responseBuffer.Position = 0;
				await responseBuffer.CopyToAsync(originalResponseBody);
				context.Response.Body = originalResponseBody;
			}

			_logger.LogInformation(
				"API call completed: {Method} {Path} => {StatusCode} ({ElapsedMs}ms, TraceId={TraceId}, CorrelationId={CorrelationId})",
				method,
				path,
				context.Response.StatusCode,
				sw.ElapsedMilliseconds,
				traceId,
				correlationId);

			if (_logger.IsEnabled(LogLevel.Debug)) {
				if (!string.IsNullOrWhiteSpace(requestBody)) {
					_logger.LogDebug("API request body {Method} {Path} CorrelationId={CorrelationId}: {RequestBody}", method, path, correlationId, requestBody);
				}

				if (!string.IsNullOrWhiteSpace(responseBody)) {
					_logger.LogDebug("API response body {Method} {Path} CorrelationId={CorrelationId}: {ResponseBody}", method, path, correlationId, responseBody);
				}
			}
		}
	}

	private string ResolveCorrelationId(HttpContext context) {
		var headerValue = context.Request.Headers[CorrelationIdHeaderName].FirstOrDefault();
		var correlationId = string.IsNullOrWhiteSpace(headerValue) ? context.TraceIdentifier : headerValue.Trim();

		context.Response.Headers[CorrelationIdHeaderName] = correlationId;
		return correlationId;
	}

	private bool IsExcludedPath(PathString requestPath) {
		if (_options.ExcludedPaths.Count == 0) {
			return false;
		}

		var path = requestPath.Value ?? string.Empty;
		return _options.ExcludedPaths.Any(excluded =>
			path.StartsWith(excluded, StringComparison.OrdinalIgnoreCase));
	}

	private bool ShouldCaptureResponseBody() {
		return _options.LogResponseBodyOnDebug && _logger.IsEnabled(LogLevel.Debug);
	}

	private async Task<string?> TryReadRequestBodyAsync(HttpRequest request) {
		if (!_options.LogRequestBodyOnDebug || !_logger.IsEnabled(LogLevel.Debug) || !IsLoggableContentType(request.ContentType)) {
			return null;
		}

		request.EnableBuffering();
		request.Body.Position = 0;

		using var reader = new StreamReader(request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
		var content = await reader.ReadToEndAsync();
		request.Body.Position = 0;

		return Truncate(content);
	}

	private async Task<string?> ReadResponseBodyAsync(MemoryStream responseBuffer, HttpResponse response) {
		if (!_options.LogResponseBodyOnDebug || !_logger.IsEnabled(LogLevel.Debug) || !IsLoggableContentType(response.ContentType)) {
			return null;
		}

		responseBuffer.Position = 0;
		using var reader = new StreamReader(responseBuffer, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
		var content = await reader.ReadToEndAsync();
		return Truncate(content);
	}

	private bool IsLoggableContentType(string? contentType) {
		if (string.IsNullOrWhiteSpace(contentType)) {
			return false;
		}

		return _loggableContentTypeTokens.Any(token => contentType.Contains(token, StringComparison.OrdinalIgnoreCase));
	}

	private string Truncate(string value) {
		if (value.Length <= _options.MaxLoggedBodyBytes) {
			return value;
		}

		return value[.._options.MaxLoggedBodyBytes] + "...[truncated]";
	}
}
