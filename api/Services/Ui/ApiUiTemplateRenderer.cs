namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Loads and renders local HTML templates used by API UI endpoints.
/// </summary>
public sealed class ApiUiTemplateRenderer {
	private const int MaxTemplateBytes = 512 * 1024;

	/// <summary>
	/// Renders a named template using placeholder replacements.
	/// </summary>
	public string Render(string templateFileName, IReadOnlyDictionary<string, string> replacements) {
		if (string.IsNullOrWhiteSpace(templateFileName)
			|| !string.Equals(Path.GetFileName(templateFileName), templateFileName, StringComparison.Ordinal)) {
			throw new ArgumentException("Template file name must be a file name only.", nameof(templateFileName));
		}

		var templatePath = ResolveTemplatePath(templateFileName);
		if (!File.Exists(templatePath)) {
			throw new FileNotFoundException($"UI template not found: {templatePath}");
		}

		var fileInfo = new FileInfo(templatePath);
		if (fileInfo.Length > MaxTemplateBytes) {
			throw new InvalidOperationException($"UI template exceeds max size: {templatePath}");
		}

		var html = File.ReadAllText(templatePath);
		foreach (var replacement in replacements) {
			if (string.IsNullOrWhiteSpace(replacement.Key)) {
				continue;
			}
			html = html.Replace(replacement.Key, replacement.Value, StringComparison.Ordinal);
		}

		return html;
	}

	private static string ResolveTemplatePath(string templateFileName) {
		return Path.Combine(AppContext.BaseDirectory, "Resources", "UiTemplates", templateFileName);
	}
}
