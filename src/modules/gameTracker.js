/**
 * GameTracker Module
 * Tracks and logs game data from Hero Wars
 */

class GameTracker {
    constructor(storage) {
        this.storage = storage;
        this.gameData = {
            player: {},
            heroes: [],
            resources: {},
            battles: [],
            events: [],
            lastUpdate: null
        };
        this.loadGameData();
    }

    loadGameData() {
        const savedData = this.storage.get('gameData');
        if (savedData) {
            this.gameData = { ...this.gameData, ...savedData };
        }
    }

    startTracking() {
        console.log('Starting game tracking...');
        
        // Set up mutation observers to detect game state changes
        this.observeDOM();
        
        // Initial data capture
        this.captureCurrentState();
    }

    observeDOM() {
        const observer = new MutationObserver((mutations) => {
            this.handleDOMChanges(mutations);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });
    }

    handleDOMChanges(mutations) {
        // Look for specific game elements and extract data
        // This will need to be customized based on Hero Wars' actual DOM structure
        for (let mutation of mutations) {
            if (mutation.type === 'childList') {
                this.scanForGameData(mutation.target);
            }
        }
    }

    scanForGameData(element) {
        // Scan for player info
        this.capturePlayerInfo(element);
        
        // Scan for hero data
        this.captureHeroData(element);
        
        // Scan for resources
        this.captureResourceData(element);
        
        // Scan for battle results
        this.captureBattleData(element);
    }

    captureCurrentState() {
        console.log('Capturing current game state...');
        
        // Try to find and capture visible game data
        this.scanForGameData(document.body);
        
        this.gameData.lastUpdate = Date.now();
        this.saveGameData();
    }

    capturePlayerInfo(element) {
        // Look for player name, level, team power, etc.
        const playerNameEl = element.querySelector('[class*="player"], [class*="name"]');
        if (playerNameEl) {
            this.gameData.player.name = playerNameEl.textContent.trim();
        }
        
        // Add more specific selectors based on actual game structure
    }

    captureHeroData(element) {
        // Look for hero cards, stats, levels
        const heroElements = element.querySelectorAll('[class*="hero"]');
        heroElements.forEach(heroEl => {
            const heroData = this.extractHeroData(heroEl);
            if (heroData) {
                this.updateHeroInList(heroData);
            }
        });
    }

    extractHeroData(element) {
        // Extract hero information from DOM element
        // This is a placeholder - needs to be customized for actual game
        return {
            id: element.getAttribute('data-id') || Date.now(),
            name: element.querySelector('[class*="name"]')?.textContent || 'Unknown',
            level: parseInt(element.querySelector('[class*="level"]')?.textContent) || 0,
            power: parseInt(element.querySelector('[class*="power"]')?.textContent) || 0,
            timestamp: Date.now()
        };
    }

    updateHeroInList(heroData) {
        const existingIndex = this.gameData.heroes.findIndex(h => h.id === heroData.id);
        if (existingIndex >= 0) {
            this.gameData.heroes[existingIndex] = heroData;
        } else {
            this.gameData.heroes.push(heroData);
        }
    }

    captureResourceData(element) {
        // Look for gold, emeralds, energy, etc.
        const resourceElements = element.querySelectorAll('[class*="resource"], [class*="currency"]');
        resourceElements.forEach(resEl => {
            const resourceType = resEl.className;
            const amount = parseInt(resEl.textContent.replace(/[^0-9]/g, ''));
            if (!isNaN(amount)) {
                this.gameData.resources[resourceType] = {
                    amount,
                    timestamp: Date.now()
                };
            }
        });
    }

    captureBattleData(element) {
        // Look for battle results
        const battleElements = element.querySelectorAll('[class*="battle"], [class*="result"]');
        if (battleElements.length > 0) {
            // Extract and log battle data
            const battleData = {
                timestamp: Date.now(),
                type: 'unknown',
                result: 'unknown'
            };
            
            if (this.gameData.battles.length === 0 || 
                this.gameData.battles[this.gameData.battles.length - 1].timestamp < Date.now() - 5000) {
                this.gameData.battles.push(battleData);
            }
        }
    }

    syncData() {
        this.captureCurrentState();
    }

    saveGameData() {
        this.storage.set('gameData', this.gameData);
    }

    getGameData() {
        return { ...this.gameData };
    }

    getHeroes() {
        return [...this.gameData.heroes];
    }

    getResources() {
        return { ...this.gameData.resources };
    }

    getBattleHistory() {
        return [...this.gameData.battles];
    }
}

export default GameTracker;
