/**
 * Minimal development HTTP server for the userscript.
 * Serves dist/organized-jihad.user.js on http://localhost:8765
 * with no-cache headers so Tampermonkey always gets the latest build.
 *
 * Usage: node serve-dev.cjs
 *
 * @see https://wiki.greasespot.net/Require
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8765;
const DIST_FILE = path.join(__dirname, 'dist', 'organized-jihad.user.js');

const server = http.createServer((req, res) => {
	// Serve the built userscript on any GET request
	if (req.method === 'GET') {
		// CORS headers so Tampermonkey can fetch it
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET');
		// No-cache headers so every request gets the freshest build
		res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
		res.setHeader('Pragma', 'no-cache');
		res.setHeader('Expires', '0');
		res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

		try {
			const content = fs.readFileSync(DIST_FILE, 'utf-8');
			res.writeHead(200);
			res.end(content);
		} catch (err) {
			res.writeHead(404);
			res.end(`// File not found: ${DIST_FILE}\n// Run "yarn build" or "yarn dev" first.\n`);
		}
	} else {
		res.writeHead(405);
		res.end();
	}
});

server.listen(PORT, '127.0.0.1', () => {
	console.log(`\n  OrganizedJihad dev server running at:`);
	console.log(`  http://localhost:${PORT}/organized-jihad.user.js\n`);
	console.log(`  Tampermonkey @require URL:`);
	console.log(`  http://localhost:${PORT}/organized-jihad.user.js\n`);
	console.log(`  Ctrl+C to stop\n`);
});
