/**
 * session-log-autogen.mjs
 *
 * Appends a lightweight session entry to the daily Copilot chat log after
 * userscript builds. This is intentionally append-only and non-fatal.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Format local date components as YYYY-MM-DD.
 *
 * @param {Date} date - Local date
 * @returns {string} Date string
 */
function formatDate(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/**
 * Returns repository-relative modified file paths from git status.
 *
 * @param {string} repoRoot - Repository root
 * @returns {string[]} Changed files
 */
function getModifiedFiles(repoRoot) {
	try {
		const output = execSync('git status --short', {
			cwd: repoRoot,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();

		if (!output) {
			return [];
		}

		return output
			.split(/\r?\n/)
			.map((line) => line.slice(3).trim())
			.filter(Boolean)
			.slice(0, 25);
	} catch {
		return [];
	}
}

/**
 * Appends an auto-generated build session entry to today's session log.
 */
function appendSessionEntry() {
	const now = new Date();
	const datePart = formatDate(now);
	const repoRoot = path.resolve(process.cwd(), '..');
	const logDir = path.join(repoRoot, '~docs', 'copilot-chats');
	const logPath = path.join(logDir, `${datePart}.md`);

	fs.mkdirSync(logDir, { recursive: true });

	let existing = '';
	if (fs.existsSync(logPath)) {
		existing = fs.readFileSync(logPath, 'utf8');
	}

	const sessionCount = (existing.match(/^### Auto Build Session$/gm) || []).length + 1;
	const changed = getModifiedFiles(repoRoot);
	const changedLines = changed.length > 0
		? changed.map((file) => `- ${file}`).join('\n')
		: '- (No tracked changes detected at log-generation time)';

	const header = existing
		? ''
		: `# Copilot Session Log - ${datePart}\n\n`;

	const section = [
		existing ? '' : '## Source: userscript/scripts/session-log-autogen.mjs',
		existing ? '' : '',
		'---',
		'',
		'### Auto Build Session',
		`- Date: ${datePart}`,
		`- Session Number: ${sessionCount}`,
		'- Scope: Automated userscript build session logging',
		'',
		'## Summary',
		'- Auto-generated entry from userscript build pipeline.',
		'- Captures a timestamp and a git working-tree snapshot for traceability.',
		'',
		'## Files Modified',
		changedLines,
		'',
		'## Validation',
		'- yarn build',
		'',
		'## Generated',
		`- Timestamp UTC: ${new Date().toISOString()}`,
		'',
	].join('\n');

	const separator = existing && !existing.endsWith('\n') ? '\n' : '';
	const next = `${existing}${separator}${header}${section}`;
	fs.writeFileSync(logPath, next, 'utf8');
	console.log(`[OJ] Session log updated: ${path.relative(repoRoot, logPath)}`);
}

try {
	appendSessionEntry();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.warn(`[OJ] session-log-autogen warning: ${message}`);
	process.exit(0);
}
