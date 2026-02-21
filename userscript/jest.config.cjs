module.exports = {
	// Use jsdom for browser-like environment
	testEnvironment: 'jsdom',

	// Setup files run after Jest environment is set up
	setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

	// Transform JavaScript files with Babel
	transform: {
		'^.+\\.js$': ['babel-jest', { configFile: './babel.config.cjs' }],
	},

	// CSS handling
	moduleNameMapper: {
		'\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
	},

	// Coverage settings
	collectCoverageFrom: [
		'src/**/*.js',
		'!src/index.js', // Exclude main entry point (TamperMonkey metadata)
		'!**/node_modules/**',
		'!**/dist/**',
	],

	coverageThreshold: {
		global: {
			branches: 70,
			functions: 70,
			lines: 70,
			statements: 70,
		},
	},

	// Test file patterns
	testMatch: ['**/tests/**/*.test.js'],

	// Coverage reporters
	coverageReporters: ['text', 'lcov', 'html'],

	// Ignore patterns
	testPathIgnorePatterns: ['/node_modules/', '/dist/'],

	// Verbose output
	verbose: true,

	// Use CRLF line endings (Windows)
	testEnvironmentOptions: {
		customExportConditions: ['node', 'node-addons'],
	},
};
