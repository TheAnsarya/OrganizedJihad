using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace OrganizedJihad.Api.Filters;

/// <summary>
/// Logs API action execution details and captures exceptions with method context.
/// </summary>
public sealed class ApiActionLoggingFilter : IAsyncActionFilter {
	private readonly ILogger<ApiActionLoggingFilter> _logger;

	/// <summary>
	/// Initializes a new instance of the <see cref="ApiActionLoggingFilter"/> class.
	/// </summary>
	public ApiActionLoggingFilter(ILogger<ApiActionLoggingFilter> logger) {
		_logger = logger;
	}

	/// <summary>
	/// Logs before/after action execution and enriches exception logs with action metadata.
	/// </summary>
	public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next) {
		if (!context.HttpContext.Request.Path.StartsWithSegments("/api")) {
			await next();
			return;
		}

		var actionName = context.ActionDescriptor.DisplayName ?? "UnknownAction";
		var method = context.HttpContext.Request.Method;
		var path = context.HttpContext.Request.Path + context.HttpContext.Request.QueryString;

		if (_logger.IsEnabled(LogLevel.Debug)) {
			var argumentNames = string.Join(", ", context.ActionArguments.Keys);
			_logger.LogDebug("API action start: {ActionName} {Method} {Path} Args=[{ArgumentNames}]", actionName, method, path, argumentNames);
		}

		ActionExecutedContext executedContext;
		try {
			executedContext = await next();
		}
		catch (Exception ex) {
			_logger.LogError(ex,
				"API action exception: {ActionName} {Method} {Path} TraceId={TraceId}",
				actionName,
				method,
				path,
				context.HttpContext.TraceIdentifier);
			throw;
		}

		if (executedContext.Exception != null && !executedContext.ExceptionHandled) {
			_logger.LogError(executedContext.Exception,
				"API action failed: {ActionName} {Method} {Path} TraceId={TraceId}",
				actionName,
				method,
				path,
				executedContext.HttpContext.TraceIdentifier);
			return;
		}

		var statusCode = ResolveStatusCode(executedContext);
		_logger.LogInformation(
			"API action completed: {ActionName} {Method} {Path} => {StatusCode} TraceId={TraceId}",
			actionName,
			method,
			path,
			statusCode,
			executedContext.HttpContext.TraceIdentifier);
	}

	private static int ResolveStatusCode(ActionExecutedContext context) {
		if (context.Result is ObjectResult objectResult) {
			return objectResult.StatusCode ?? context.HttpContext.Response.StatusCode;
		}

		if (context.Result is StatusCodeResult statusCodeResult) {
			return statusCodeResult.StatusCode;
		}

		return context.HttpContext.Response.StatusCode;
	}
}
