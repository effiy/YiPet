class TokenUtilsClass {
    constructor() {
        this.TOKEN_KEY = 'YiPet.apiToken.v1';
        this._cachedToken = '';
        this._cacheInitialized = false;
        this._initCache();
    }
    
    _initCache() {
        if (!this.isChromeStorageAvailable()) return;
        try {
            chrome.storage.local.get([this.TOKEN_KEY], (result) => {
                if (chrome.runtime.lastError) return;
                const token = result && result[this.TOKEN_KEY];
                this._cachedToken = token ? String(token).trim() : '';
                this._cacheInitialized = true;
            });
        } catch (e) {
        }
    }

    isChromeStorageAvailable() {
        try {
            return typeof chrome !== 'undefined' && 
                   chrome.storage && 
                   chrome.storage.local && 
                   chrome.runtime && 
                   chrome.runtime.id;
        } catch (error) {
            return false;
        }
    }
    
    isContextInvalidatedError(error) {
        if (!error) return false;
        const errorMsg = (error.message || error.toString() || '').toLowerCase();
        return errorMsg.includes('extension context invalidated') ||
               errorMsg.includes('context invalidated');
    }
    
    async getTokenFromChromeStorage() {
        if (!this.isChromeStorageAvailable()) {
            return '';
        }
        
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([this.TOKEN_KEY], (result) => {
                    if (chrome.runtime.lastError) {
                        resolve('');
                        return;
                    }
                    
                    const token = result[this.TOKEN_KEY];
                    const normalized = token ? String(token).trim() : '';
                    this._cachedToken = normalized;
                    this._cacheInitialized = true;
                    resolve(normalized);
                });
            } catch (error) {
                resolve('');
            }
        });
    }
    
    async saveTokenToChromeStorage(token) {
        const tokenValue = String(token || '').trim();
        this._cachedToken = tokenValue;
        this._cacheInitialized = true;
        
        if (!this.isChromeStorageAvailable()) {
            return false;
        }
        
        return new Promise((resolve) => {
            try {
                chrome.storage.local.set({ [this.TOKEN_KEY]: tokenValue }, () => {
                    if (chrome.runtime.lastError) {
                        resolve(false);
                        return;
                    }
                    resolve(true);
                });
            } catch (error) {
                resolve(false);
            }
        });
    }
    
    getApiTokenSync() {
        if (!this._cacheInitialized) {
            this._initCache();
        }
        return this._cachedToken;
    }
    
    async getApiToken() {
        const chromeToken = await this.getTokenFromChromeStorage();
        return chromeToken;
    }
    
    async saveApiToken(token) {
        const tokenValue = String(token || '').trim();
        return await this.saveTokenToChromeStorage(tokenValue);
    }
    
    hasApiTokenSync() {
        const token = this.getApiTokenSync();
        return token && token.trim().length > 0;
    }
    
    async hasApiToken() {
        const token = await this.getApiToken();
        return token && token.trim().length > 0;
    }
}

const tokenUtilsInstance = new TokenUtilsClass();

const TokenUtils = {
    async getApiToken() {
        return await tokenUtilsInstance.getApiToken();
    },
    
    getApiTokenSync() {
        return tokenUtilsInstance.getApiTokenSync();
    },
    
    async saveApiToken(token) {
        return await tokenUtilsInstance.saveApiToken(token);
    },
    
    async hasApiToken() {
        return await tokenUtilsInstance.hasApiToken();
    },
    
    hasApiTokenSync() {
        return tokenUtilsInstance.hasApiTokenSync();
    },
    
    async ensureTokenSet() {
        const hasToken = await tokenUtilsInstance.hasApiToken();
        if (!hasToken) {
            if (typeof window !== 'undefined' && window.petManager) {
                try {
                    await window.petManager.ensureTokenSet();
                    return await tokenUtilsInstance.hasApiToken();
                } catch (error) {
                    console.warn('调用 PetManager.ensureTokenSet 失败:', error);
                }
            }
        }
        return hasToken;
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = TokenUtils;
} else {
    window.TokenUtils = TokenUtils;
}
