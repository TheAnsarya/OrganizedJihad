# Format-AllFiles.ps1
# Converts spaces to tabs for all project files (Razor, XAML, CSS, JS, etc.)
# Reference: https://docs.microsoft.com/en-us/powershell/scripting/overview

param(
	[string]$RootPath = $PSScriptRoot,
	[int]$TabSize = 4,
	[switch]$DryRun = $false
)

Write-Host "Formatting all files to use tabs (size: $TabSize), CRLF, and UTF-8..." -ForegroundColor Cyan
Write-Host "Root path: $RootPath" -ForegroundColor Gray

# File patterns to format
# Reference: https://editorconfig.org/
$filePatterns = @(
	'*.razor',
	'*.cshtml',
	'*.xaml',
	'*.css',
	'*.scss',
	'*.js',
	'*.ts',
	'*.tsx',
	'*.jsx',
	'*.json',
	'*.html',
	'*.htm',
	'*.xml',
	'*.config',
	'*.md'
)

# Directories to exclude
$excludeDirs = @(
	'node_modules',
	'bin',
	'obj',
	'.git',
	'.vs',
	'dist',
	'packages'
)

# Get all files matching patterns
$files = Get-ChildItem -Path $RootPath -Recurse -File -Include $filePatterns |
	Where-Object {
		$file = $_
		$exclude = $false
		foreach ($dir in $excludeDirs) {
			if ($file.FullName -like "*\$dir\*") {
				$exclude = $true
				break
			}
		}
		-not $exclude
	}

Write-Host "Found $($files.Count) files to process" -ForegroundColor Green

$processedCount = 0
$changedCount = 0

foreach ($file in $files) {
	$processedCount++
	$relativePath = $file.FullName.Substring($RootPath.Length + 1)
	
	try {
		# Read file with UTF-8 encoding
		# Reference: https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-content
		$content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
		
		if ($null -eq $content) {
			Write-Host "  [$processedCount/$($files.Count)] Skipped (empty): $relativePath" -ForegroundColor DarkGray
			continue
		}
		
		$originalContent = $content
		
		# Convert line endings to LF temporarily for processing
		$content = $content -replace "`r`n", "`n"
		$content = $content -replace "`r", "`n"
		
		# Convert leading spaces to tabs
		# Match spaces at the beginning of each line in multiples of $TabSize
		# Reference: https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_regular_expressions
		$lines = $content -split "`n"
		$newLines = @()
		
		foreach ($line in $lines) {
			# Count leading spaces
			if ($line -match '^( +)(.*)$') {
				$spaces = $matches[1]
				$rest = $matches[2]
				$spaceCount = $spaces.Length
				
				# Convert spaces to tabs (4 spaces = 1 tab)
				$tabCount = [Math]::Floor($spaceCount / $TabSize)
				$remainingSpaces = $spaceCount % $TabSize
				
				$newLine = ("`t" * $tabCount) + (" " * $remainingSpaces) + $rest
				$newLines += $newLine
			} else {
				$newLines += $line
			}
		}
		
		$content = $newLines -join "`n"
		
		# Convert line endings to CRLF
		$content = $content -replace "`n", "`r`n"
		
		# Ensure file ends with newline (POSIX compliance)
		# Reference: https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap03.html#tag_03_206
		if (-not $content.EndsWith("`r`n")) {
			$content += "`r`n"
		}
		
		# Check if content changed
		if ($content -ne $originalContent) {
			$changedCount++
			
			if ($DryRun) {
				Write-Host "  [$processedCount/$($files.Count)] Would change: $relativePath" -ForegroundColor Yellow
			} else {
				# Write file with UTF-8 encoding (no BOM)
				# Reference: https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.management/set-content
				$utf8NoBom = New-Object System.Text.UTF8Encoding $false
				[System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
				Write-Host "  [$processedCount/$($files.Count)] Formatted: $relativePath" -ForegroundColor Green
			}
		} else {
			Write-Host "  [$processedCount/$($files.Count)] No change: $relativePath" -ForegroundColor DarkGray
		}
	} catch {
		Write-Host "  [$processedCount/$($files.Count)] Error: $relativePath - $($_.Exception.Message)" -ForegroundColor Red
	}
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Total files processed: $processedCount" -ForegroundColor Gray
Write-Host "  Files changed: $changedCount" -ForegroundColor $(if ($changedCount -gt 0) { 'Yellow' } else { 'Green' })
Write-Host "  Files unchanged: $($processedCount - $changedCount)" -ForegroundColor DarkGray

if ($DryRun) {
	Write-Host ""
	Write-Host "DRY RUN - No files were modified. Remove -DryRun to apply changes." -ForegroundColor Yellow
}
