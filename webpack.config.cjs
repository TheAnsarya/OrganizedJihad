/**
 * Webpack Configuration for TamperMonkey Userscript
 * @see https://webpack.js.org/configuration/
 * @see https://webpack.js.org/loaders/babel-loader/
 */

const path = require('path');

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
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader'],
			},
		],
	},

	// Optimization settings
	// @see https://webpack.js.org/configuration/optimization/
	optimization: {
		minimize: false, // Don't minify for easier debugging in TamperMonkey
	},

	// Development mode for better debugging
	mode: 'development',

	// Source maps for debugging
	// @see https://webpack.js.org/configuration/devtool/
	devtool: 'inline-source-map',
};

