/**
 * Jest Setup File
 * Configures the testing environment with necessary polyfills and mocks
 */

import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock TamperMonkey GM API
global.GM = {
	getValue: jest.fn((key, defaultValue) => defaultValue),
	setValue: jest.fn(),
	deleteValue: jest.fn(),
	listValues: jest.fn(() => []),
	info: {
		script: {
			name: 'OrganizedJihad Test',
			version: '1.0.0',
		},
	},
};

// Mock XMLHttpRequest for API interception tests
global.XMLHttpRequest = class XMLHttpRequest {
	constructor() {
		this.readyState = 0;
		this.status = 0;
		this.response = null;
		this.responseText = '';
		this.responseType = '';
		this.onreadystatechange = null;
		this.onload = null;
		this.onerror = null;
		this._method = '';
		this._url = '';
		this._requestHeaders = {};
	}

	open(method, url) {
		this._method = method;
		this._url = url;
		this.readyState = 1;
	}

	setRequestHeader(name, value) {
		this._requestHeaders[name] = value;
	}

	send(body) {
		this.readyState = 4;
		this.status = 200;
		
		// Simulate response
		setTimeout(() => {
			if (this.onreadystatechange) {
				this.onreadystatechange();
			}
			if (this.onload) {
				this.onload();
			}
		}, 0);
	}

	abort() {
		this.readyState = 0;
	}
};

// Mock console methods for cleaner test output
global.console = {
	...console,
	log: jest.fn(),
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};

// Mock window.localStorage if not available
if (typeof window !== 'undefined' && !window.localStorage) {
	const localStorageMock = {
		getItem: jest.fn(),
		setItem: jest.fn(),
		removeItem: jest.fn(),
		clear: jest.fn(),
	};
	Object.defineProperty(window, 'localStorage', {
		value: localStorageMock,
	});
}
