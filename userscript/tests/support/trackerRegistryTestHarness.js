export function createRegistrationHarness() {
	const registrations = [];
	const tracker = {
		registerHandler: (methods, handler, label, options = {}) => {
			const methodList = Array.isArray(methods) ? methods : [methods];
			for (const method of methodList) {
				registrations.push({ method, handler, label, options });
			}
		},
	};

	return {
		tracker,
		registrations,
		methods: () => new Set(registrations.map((r) => r.method)),
	};
}

export function expectMethodsPresent(methodSet, expectedMethods) {
	for (const method of expectedMethods) {
		expect(methodSet.has(method)).toBe(true);
	}
}

export function expectNoDuplicateMethods(registrations) {
	const seen = new Set();
	const duplicates = new Set();
	for (const registration of registrations) {
		if (seen.has(registration.method)) {
			duplicates.add(registration.method);
		}
		seen.add(registration.method);
	}
	expect([...duplicates]).toEqual([]);
}

export function expectRegistrationMetadataIntegrity(registrations) {
	for (const registration of registrations) {
		expect(typeof registration.label).toBe('string');
		expect(registration.label.trim().length).toBeGreaterThan(0);
		expect(typeof registration.options.category).toBe('string');
		expect(registration.options.category.trim().length).toBeGreaterThan(0);
	}
}
