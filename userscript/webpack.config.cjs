/**
 * Webpack Configuration for TamperMonkey Userscript
 * @see https://webpack.js.org/configuration/
 * @see https://webpack.js.org/loaders/babel-loader/
 */

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

// ─── Auto-increment patch version on every build ────────────────────────
// Reads package.json, bumps `patch`, writes back, and uses the new version
// in the TamperMonkey banner and DefinePlugin so runtime code can display it.
const pkgPath = path.resolve(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const parts = pkg.version.split('.').map(Number);
parts[2] = (parts[2] || 0) + 1; // bump patch
const newVersion = parts.join('.');
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n', 'utf8');
console.log(`[OJ] Build version: ${newVersion}`);

/**
 * TamperMonkey metadata block.
 * Must appear at the VERY FIRST LINE of the output file or TamperMonkey
 * will not recognise @match, @grant, @run-at, etc.
 * Webpack's BannerPlugin injects this before any bundled code.
 */
const userscriptBanner = `// ==UserScript==
// @name         OrganizedJihad - Hero Wars Tracker
// @namespace    http://tampermonkey.net/
// @version      ${newVersion}
// @description  Track and manage Hero Wars game data with IndexedDB storage and in-game UI
// @author       Andy Hubbard <me@ansarya.com>
// @match        https://www.hero-wars.com/*
// @match        https://*.hero-wars.com/*
// @match        https://i-heroes-fb.nextersglobal.com/*
// @match        https://i.hero-wars-fb.com/*
// @match        https://i-heroes-vk.nextersglobal.com/*
// @match        https://i-heroes-ok.nextersglobal.com/*
// @match        https://i-heroes-mm.nextersglobal.com/*
// @match        https://i-heroes-wb.nextersglobal.com/*
// @match        https://i-heroes-mg.nextersglobal.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-start
// ==/UserScript==`;

module.exports = {
	// Entry point for the application
	entry: './src/index.js',

	// Output configuration - where compiled files go
	// @see https://webpack.js.org/configuration/output/
	output: {
		filename: 'organized-jihad.user.js',
		path: path.resolve(__dirname, 'dist'),
		clean: true, // Clean dist folder before each build
	},

	// Module rules for different file types
	// @see https://webpack.js.org/configuration/module/
	module: {
		rules: [
			// JavaScript files - transpile with Babel
			// @see https://babeljs.io/docs/en/babel-preset-env
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							[
								'@babel/preset-env',
								{
									// Target modern browsers for ES2020+ features
									targets: {
										chrome: '90',
										firefox: '88',
										safari: '14',
										edge: '90',
									},
									// Use modern modules
									modules: false,
								},
							],
						],
					},
				},
			},
			// CSS files - inject into DOM via style-loader
			// @see https://webpack.js.org/loaders/style-loader/
			// @see https://webpack.js.org/loaders/css-loader/
			// Custom insert function defers style injection if <head>
			// doesn't exist yet (@run-at document-start).
			{
				test: /\.css$/,
				use: [
					{
						loader: 'style-loader',
						options: {
							insert: function insertStyleDeferred(element) {
								var head = document.head || document.querySelector('head');
								if (head) {
									head.appendChild(element);
								} else {
									document.addEventListener('DOMContentLoaded', function() {
										document.head.appendChild(element);
									});
								}
							},
						},
					},
					'css-loader',
				],
			},
		],
	},

	// Optimization settings
	// @see https://webpack.js.org/configuration/optimization/
	optimization: {
		minimize: false, // Don't minify for easier debugging in TamperMonkey
	},

	// Plugins
	// @see https://webpack.js.org/configuration/plugins/
	plugins: [
		// Prepend TamperMonkey metadata as the very first content in the file.
		// raw:true means the banner string is emitted verbatim (not wrapped in /**/)
		new webpack.BannerPlugin({
			banner: userscriptBanner,
			raw: true,
			entryOnly: true,
		}),
		// Inject build version into runtime code so index.js can display it
		new webpack.DefinePlugin({
			__OJ_VERSION__: JSON.stringify(newVersion),
		}),
	],

	// Development mode for better debugging
	mode: 'development',

	// Source maps for debugging
	// @see https://webpack.js.org/configuration/devtool/
	devtool: 'inline-source-map',
};

