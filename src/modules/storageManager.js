/**
 * StorageManager Module
 * Handles data persistence using GM storage API
 */

class StorageManager {
    constructor() {
        this.prefix = 'organizedJihad_';
    }

    /**
     * Save data to storage
     * @param {string} key - Storage key
     * @param {any} value - Value to store (will be JSON serialized)
     */
    set(key, value) {
        try {
            const serialized = JSON.stringify(value);
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue(this.prefix + key, serialized);
            } else {
                localStorage.setItem(this.prefix + key, serialized);
            }
            return true;
        } catch (error) {
            console.error('Error saving to storage:', error);
            return false;
        }
    }

    /**
     * Retrieve data from storage
     * @param {string} key - Storage key
     * @param {any} defaultValue - Default value if key doesn't exist
     */
    get(key, defaultValue = null) {
        try {
            let data;
            if (typeof GM_getValue !== 'undefined') {
                data = GM_getValue(this.prefix + key, null);
            } else {
                data = localStorage.getItem(this.prefix + key);
            }
            
            if (data === null) {
                return defaultValue;
            }
            
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading from storage:', error);
            return defaultValue;
        }
    }

    /**
     * Delete data from storage
     * @param {string} key - Storage key
     */
    delete(key) {
        try {
            if (typeof GM_deleteValue !== 'undefined') {
                GM_deleteValue(this.prefix + key);
            } else {
                localStorage.removeItem(this.prefix + key);
            }
            return true;
        } catch (error) {
            console.error('Error deleting from storage:', error);
            return false;
        }
    }

    /**
     * List all storage keys
     */
    listKeys() {
        try {
            if (typeof GM_listValues !== 'undefined') {
                return GM_listValues().filter(key => key.startsWith(this.prefix));
            } else {
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith(this.prefix)) {
                        keys.push(key);
                    }
                }
                return keys;
            }
        } catch (error) {
            console.error('Error listing keys:', error);
            return [];
        }
    }

    /**
     * Clear all stored data
     */
    clearAll() {
        const keys = this.listKeys();
        keys.forEach(key => {
            const cleanKey = key.replace(this.prefix, '');
            this.delete(cleanKey);
        });
    }

    /**
     * Export all data as JSON
     */
    exportData() {
        const data = {};
        const keys = this.listKeys();
        keys.forEach(key => {
            const cleanKey = key.replace(this.prefix, '');
            data[cleanKey] = this.get(cleanKey);
        });
        return data;
    }

    /**
     * Import data from JSON
     * @param {Object} data - Data object to import
     */
    importData(data) {
        Object.keys(data).forEach(key => {
            this.set(key, data[key]);
        });
    }
}

export default StorageManager;
