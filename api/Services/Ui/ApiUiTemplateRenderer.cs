namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Loads and renders local HTML templates used by API UI endpoints.
/// </summary>
public sealed class ApiUiTemplateRenderer {
	/// <summary>
	/// Renders a named template using placeholder replacements.
	/// </summary>
	public string Render(string templateFileName, IReadOnlyDictionary<string, string> replacements) {
		var templatePath = ResolveTemplatePath(templateFileName);
		if (!File.Exists(templatePath)) {
			throw new FileNotFoundException($"UI template not found: {templatePath}");
		}

		var html = File.ReadAllText(templatePath);
		foreach (var replacement in replacements) {
			html = html.Replace(replacement.Key, replacement.Value, StringComparison.Ordinal);
		}

		return html;
	}

	private static string ResolveTemplatePath(string templateFileName) {
		return Path.Combine(AppContext.BaseDirectory, "Resources", "UiTemplates", templateFileName);
	}
}
