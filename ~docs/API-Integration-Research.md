# Hero Wars API Integration Research Summary
**Date**: 2025-01-21  
**Project**: OrganizedJihad - Hero Wars Tracker

## Research Sources

### Primary References
1. **HeroWarsHelper Script**: https://greasyfork.org/en/scripts/450693-herowarshelper
   - Comprehensive TamperMonkey script for Hero Wars automation
   - Source code available at: https://update.greasyfork.org/scripts/450693/HeroWarsHelper.user.js

2. **Hero Wars Assistant (Browser Extension)**: https://hw-assist.com/
   - Community gifts auto-collection
   - Daily automation scripts (Tower, Expeditions, Tournament, Dungeon)
   - Endless arena/guild war logs with filtering
   - Guild War scouting reports

## Key Technical Findings

### Hero Wars API Architecture

#### API Endpoint Pattern
```
POST https://*.nextersglobal.com/api/
```
- Uses HTTPS POST requests to Nexters Global servers
- Specific pattern: URL ends with `/api/` (regex: `/api\/$/`)

#### Request Format
```javascript
{
	"calls": [
		{
			"name": "userGetInfo",      // API method name
			"args": {},                  // Method arguments
			"ident": "body",             // Identifier for response matching
			"context": {
				"actionTs": 1234567890   // Timestamp from performance.now()
			}
		},
		{
			"name": "heroGetAll",
			"args": {},
			"ident": "heroGetAll"
		}
	]
}
```

#### Response Format
```javascript
{
	"results": [
		{
			"ident": "body",                    // Matches request ident
			"result": {
				"response": { /* actual data */ },  // Main response data
				// Additional metadata fields...
			}
		}
	],
	"error": null  // Only present if request failed
}
```

### Common API Methods

Based on HeroWarsHelper analysis:

#### Player Data
- `userGetInfo` - Player level, VIP, resources, guild, refillables (energy, etc)
- `registration` - Initial player registration/login

#### Heroes & Titans
- `heroGetAll` - Complete hero roster with stats, power, skills, artifacts
- `titanGetAll` - Titan roster
- `heroUpgradeSkill` - Level up hero skills
- `heroArtifactLevelUp` - Upgrade hero artifacts
- `heroSkinUpgrade` - Upgrade hero skins

#### Inventory
- `inventoryGet` - All items, consumables, fragments, coins, gear
- `inventorySell` - Sell items
- `consumableUseLootBox` - Open loot boxes

#### Battles
- `missionStart` / `missionEnd` - Campaign missions
- `towerStartBattle` / `towerEnd` - Tower battles
- `arenaStart` / `arenaEnd` - Arena battles
- `bossStart` / `bossEnd` - Outland boss battles
- `dungeonStartBattle` / `dungeonEnd` - Guild dungeon

#### Quests & Events
- `questGetAll` - All available quests with progress
- `questFarm` - Collect quest rewards
- `offerGetAll` - Special offers and events
- `offerFarmReward` - Collect event rewards

#### Guild/Clan
- `clanGetInfo` - Guild information and members
- `clanWarGetInfo` - Guild war status and attempts
- `clanGetWeeklyStat` - Member activity statistics

#### Shop & Economy
- `shopGetAll` - All available shops
- `shopBuy` - Purchase items
- `billingGetAll` - Donation offers (for filtering)

#### Expeditions & Adventures
- `expeditionGet` - Expedition status
- `expeditionFarm` - Collect expedition rewards
- `adventure_getInfo` - Adventure/Sanctuary info
- `adventure_turnStartBattle` - Start adventure battle

#### Mail
- `mailGetAll` - Inbox messages
- `mailFarm` - Collect mail rewards

### Data Interception Pattern

#### XMLHttpRequest Proxying
```javascript
// 1. Save original methods
const originalXHR = {
	open: XMLHttpRequest.prototype.open,
	send: XMLHttpRequest.prototype.send,
	setRequestHeader: XMLHttpRequest.prototype.setRequestHeader
};

// 2. Override open() to detect API URL
XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
	// Detect Hero Wars API pattern
	if (method === 'POST' && url.includes('.nextersglobal.com/api/')) {
		this._trackingData = { /* store request metadata */ };
	}
	return originalXHR.open.call(this, method, url, async, user, password);
};

// 3. Override send() to capture request data
XMLHttpRequest.prototype.send = function(data) {
	if (this._trackingData) {
		const requestData = JSON.parse(data);
		// Store for later processing
		
		// Proxy onreadystatechange to capture response
		const originalHandler = this.onreadystatechange;
		this.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				const responseData = JSON.parse(this.responseText);
				// Process captured data
				processAPIResponse(requestData, responseData);
			}
			if (originalHandler) return originalHandler.apply(this, arguments);
		};
	}
	return originalXHR.send.call(this, data);
};
```

### Data Structures

#### userGetInfo Response
```javascript
{
	userId: 12345,
	name: "PlayerName",
	level: 130,
	vipLevel: 15,
	gold: 5000000,
	starmoney: 25000,  // Emeralds
	clanId: 67890,
	clanTitle: "Guild Name",
	refillable: [
		{id: 1, amount: 150},   // Energy/Stamina
		{id: 45, amount: 5},    // Portal Spheres
		{id: 48, amount: 3}     // Guild War Attempts
	],
	nextDayTs: 1737504000,     // Timestamp for next day
	timeZone: -5
}
```

#### heroGetAll Response
```javascript
{
	"1": {  // Hero ID
		id: 1,
		level: 130,
		star: 6,        // Star rank
		color: 18,      // Promotion/evolution level
		power: 198058,
		xp: 3625195,
		skills: {
			2: 130,     // Skill ID: level
			3: 130,
			4: 130,
			5: 130
		},
		artifacts: [
			{level: 130, star: 6},
			{level: 130, star: 6},
			{level: 130, star: 6}
		],
		skins: {
			1: 60,      // Skin ID: level
			54: 60
		},
		currentSkin: 0,
		petId: 6004    // Patronage pet
	}
	// ... more heroes
}
```

#### inventoryGet Response
```javascript
{
	consumable: {
		81: 150,    // Prophecy Cards
		148: 25     // Platinum Boxes
	},
	gear: {
		1: 50,      // Equipment pieces
		2: 30
	},
	fragmentHero: {
		1: 100,     // Hero soul stones
		13: 250
	},
	coin: {
		7: 5000,    // Skull Coins
		18: 10000,  // Guild War Coins
		19: 8000    // Titan Arena Coins
	}
}
```

## Important Warnings

### From HeroWarsHelper Documentation
> "Using the script may result in a ban in the game"

### Cheating vs. Tracking
The HeroWarsHelper script includes features that MODIFY game data:
- Battle result manipulation (forcing wins)
- Resource generation (infinite cards)
- Subscription status spoofing

**OrganizedJihad's Approach**: READ-ONLY tracking
- **NO** data modification
- **NO** request alteration
- **ONLY** passive observation for progress tracking
- Legitimate use case: Personal analytics dashboard

## Implementation in OrganizedJihad

### Implemented Features (Read-Only)
✅ API request/response interception  
✅ Player stats tracking (level, VIP, resources)  
✅ Hero roster monitoring (power, levels, skills)  
✅ Inventory tracking (gold, emeralds, items)  
✅ Battle results logging (for analytics)  
✅ Quest progress monitoring  
✅ Guild/clan data capture  

### NOT Implemented (Cheating Features)
❌ Battle result modification  
❌ Resource generation/manipulation  
❌ Subscription spoofing  
❌ Auto-battle/automation  
❌ Any data alteration whatsoever  

### Safety Measures
1. **No Request Modification**: Original XHR send() passes data unchanged
2. **No Response Manipulation**: Response text remains intact
3. **Logging Only**: All captured data saved to local storage only
4. **Console Prefixing**: All logs tagged with `[OrganizedJihad]` for transparency
5. **Restore on Destroy**: Original XHR methods restored when tracker stops

## Testing Recommendations

1. **Install in TamperMonkey**: Load `dist/organized-jihad.user.js`
2. **Open Hero Wars**: Navigate to https://www.hero-wars.com
3. **Watch Console**: Look for `[OrganizedJihad]` messages:
   - "GameTracker initialized - monitoring Hero Wars API"
   - "Detected Hero Wars API URL: ..."
   - "Player data updated: [Name] Level [X]"
   - "Heroes updated: X heroes tracked"
4. **Check Storage**: DevTools → Application → Local Storage / GM Storage
   - `playerData` - Current player stats
   - `heroesData` - Hero roster
   - `inventoryData` - Resources
   - `gameHistory` - Historical snapshots

## References & Resources

### Technical Documentation
- **MDN XHR Guide**: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
- **TamperMonkey API**: https://www.tampermonkey.net/documentation.php
- **GM Storage API**: https://wiki.greasespot.net/GM.setValue

### Related Projects
- **HeroWarsHelper**: https://greasyfork.org/en/scripts/450693-herowarshelper
- **Hero Wars Assistant**: https://hw-assist.com/
- **HW Calc**: https://hwcalc.com/ (team calculator)

### Hero Wars Community
- **Official Site**: https://www.hero-wars.com
- **Nexters Global**: Developer/publisher
- **Telegram Communities**: Various game strategy groups

## Ethical Considerations

### Fair Use
OrganizedJihad is designed as a **personal analytics tool** for tracking your own gameplay progress. It does not:
- Automate gameplay
- Modify game state
- Provide unfair advantages
- Violate game economy

### Similar to Existing Tools
- **Steam Achievement Trackers**: Track game progress externally
- **Fitness App Integrations**: Monitor activity from other apps
- **Browser Extensions**: Save & organize web content

### Recommended Disclaimer
```
OrganizedJihad is an unofficial tracking tool for personal use only.
It monitors but does not modify Hero Wars gameplay. Use at your own risk.
Not affiliated with or endorsed by Nexters Global.
```

---

**Implemented By**: GitHub Copilot  
**Date**: January 21, 2025  
**Project**: OrganizedJihad v1.0  
**License**: MIT
