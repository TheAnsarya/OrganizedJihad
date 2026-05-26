# Code-Level Action Plan: Userscript Improvements

Detailed implementation notes for each planned change, with file paths, line
references, and code patterns to follow.

---

## 1. RequestHistory Auto-Cleanup (Issue #36)

**File**: `userscript/src/modules/gameTracker.js`
**Where**: After `proxyAPIRequests()` setup, or in `init()`

```javascript
// Add to init() after proxyAPIRequests():
this._requestHistoryCleanupInterval = setInterval(() => {
	const now = Date.now();
	for (const key of Object.keys(this.requestHistory)) {
		const ts = parseInt(key.split('_')[0], 10);
		if (now - ts > 300000) { // 5 minutes
			delete this.requestHistory[key];
		}
	}
}, 300000); // Every 5 minutes
```

**Also**: Change requestId format from `${Date.now()}_${Math.random()}` to
`${Date.now()}_${Math.floor(Math.random() * 9000000 + 1000000)}` so the
timestamp is extractable.

---

## 2. Handler Array Refactor (Issue #45)

**Files to create**: `userscript/src/modules/handlers/` directory with one
file per handler category.

**Pattern** (from HWA):
```javascript
// handlers/baseHandler.js
export class BaseHandler {
	/** @type {string[]} API method names this handler responds to */
	static calls = [];

	/**
	 * @param {Object} callArgs - { [ident]: args }
	 * @param {Object} callMap - { [ident]: callName }
	 * @param {Object[]} results - response.results array
	 * @param {GameTracker} tracker - reference to gameTracker
	 */
	static async handle(callArgs, callMap, results, tracker) {
		throw new Error('Not implemented');
	}
}

// handlers/userHandler.js
export class UserHandler extends BaseHandler {
	static calls = ['userGetInfo'];

	static async handle(callArgs, callMap, results, tracker) {
		for (const result of results) {
			if (callMap[result.ident] === 'userGetInfo') {
				await tracker.trackPlayerData(result.result.response);
			}
		}
	}
}
```

**In gameTracker.js** replace the switch with:
```javascript
import { handlers } from './handlers/index.js';

for (const Handler of handlers) {
	const matchingCalls = Handler.calls.filter(c => allCallNames.includes(c));
	if (matchingCalls.length > 0) {
		try {
			await Handler.handle(callArgs, callMap, response.results, this);
			dispatched.push(...matchingCalls);
		} catch (error) {
			errors.push(`${matchingCalls.join(',')}: ${error.message}`);
		}
	}
}
```

---

## 3. WebSocket Push Events (Issue #37)

**File**: `userscript/src/modules/gameTracker.js` or new
`userscript/src/modules/pushEventTracker.js`

```javascript
/**
 * Hook into the game's WebSocket push event system.
 * The game uses window.nxg.getModule("pushd") for server-push events.
 * These arrive over WebSocket, NOT via XHR, so our XHR proxy misses them.
 *
 * Retry pattern from HWA: try every 10s, up to 10 times, because nxg
 * takes time to initialize after page load.
 */
hookPushEvents(retryCount = 0) {
	try {
		if (window.nxg && window.nxg.getModule('pushd')) {
			const pushd = window.nxg.getModule('pushd');
			pushd.on('message', (event) => {
				this._handlePushEvent(event);
			});
			console.log('[OrganizedJihad] Push event listener registered');
		} else if (retryCount < 10) {
			setTimeout(() => this.hookPushEvents(retryCount + 1), 10000);
		}
	} catch (e) {
		if (retryCount < 10) {
			setTimeout(() => this.hookPushEvents(retryCount + 1), 10000);
		}
	}
}
```

---

## 4. SetRequestHeader Proxy (Issue #35)

**File**: `userscript/src/modules/gameTracker.js`, inside `proxyAPIRequests()`

```javascript
// Add after open() proxy:
XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
	if (this._ojTracking?.isHeroWarsAPI) {
		if (!this._ojTracking.headers) this._ojTracking.headers = {};
		this._ojTracking.headers[name] = value;
	}
	return self.originalXHR.setRequestHeader.call(this, name, value);
};
```

This captures `X-Request-Id`, `X-Auth-Token`, `X-Auth-Session-Id` for:
- Detecting initial login vs. subsequent calls
- Future: replaying API calls to fetch missing data

---

## 5. Hero Compression (Issue #42)

**File**: New `userscript/src/modules/heroCompressor.js`

```javascript
const HERO_FIELDS = [
	'agility', 'armor', 'armorPenetration', 'artifacts', 'ascensions',
	'color', 'favorPetId', 'favorPower', 'hp', 'intelligence', 'level',
	'magicPower', 'magicResist', 'perks', 'petId', 'physicalAttack',
	'power', 'runes', 'skills', 'skins', 'slots', 'star', 'strength',
	'titanGiftLevel', 'magicPenetration', 'type', 'elementAttack',
	'elementArmor', 'elementSpiritPower', 'element', 'elementSpiritLevel',
	'elementSpiritStar', 'scale', 'dodge', 'physicalCritChance',
];

export function compressHero(hero) {
	return { id: hero.id, c: HERO_FIELDS.map(f => hero[f]) };
}

export function decompressHero(compressed) {
	const hero = { id: compressed.id };
	HERO_FIELDS.forEach((f, i) => { hero[f] = compressed.c[i]; });
	return hero;
}
```

---

## 6. Keyboard Shortcut Toggle (Issue #47)

**File**: `userscript/src/modules/uiManager.js`

```javascript
// Add in init():
document.addEventListener('keydown', (e) => {
	if (e.code === 'Backquote' || e.code === 'IntlBackslash' ||
		e.key === '`' || e.key === '~') {
		e.preventDefault();
		this.toggle();
	}
});
```

---

## 7. Data Auto-Purge (Issue #44)

**File**: `userscript/src/modules/gameTracker.js` or new maintenance module

```javascript
async purgeOldData() {
	const settings = {
		maxDaysSnapshots: 180,
		maxDaysBattles: 120,
		maxDaysChats: 90,
	};

	const cutoffMs = (days) => Date.now() - (days * 24 * 60 * 60 * 1000);

	// Purge old snapshots
	const oldSnapshots = await this.storage.getAll('snapshots');
	const cutoff = cutoffMs(settings.maxDaysSnapshots);
	for (const snap of oldSnapshots) {
		if (snap.timestamp < cutoff) {
			await this.storage.delete('snapshots', snap.id);
		}
	}
	// ... repeat for other stores
}
```

---

## File Impact Summary

| File | Changes |
|------|---------|
| `gameTracker.js` | ArrayBuffer decode ✅, requestHistory cleanup, setRequestHeader proxy, push events, handler dispatch refactor |
| `uiManager.js` | Keyboard shortcut, panel resize |
| NEW `handlers/*.js` | Individual handler modules |
| NEW `heroCompressor.js` | Hero data compression |
| NEW `pushEventTracker.js` | WebSocket push event handling |
| `index.js` | Wire up new modules |
| `indexedDBStorage.js` | Add purge methods |
| Tests | New test files for each new module |
