/**
 * Token管理器
 * 提供API Token的获取、存储、验证等功能
 */

(function (root) {
class TokenManager {
    constructor(options = {}) {
        this.storageKey = options.storageKey || 'YiPet.apiToken.v1';
        this._cachedToken = '';
        this._cacheInitialized = false;
        
        this._initCache();
    }
    
    /**
     * 初始化缓存
     */
    _initCache() {
        if (!this._isChromeStorageAvailable()) return;
        
        try {
            chrome.storage.local.get([this.storageKey], (result) => {
                if (chrome.runtime.lastError) return;
                
                const token = result && result[this.storageKey];
                this._cachedToken = token ? String(token).trim() : '';
                this._cacheInitialized = true;
            });
        } catch (e) {
            console.warn('初始化Token缓存失败:', e);
        }
    }
    
    /**
     * 检查Chrome存储是否可用
     */
    _isChromeStorageAvailable() {
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
    
    /**
     * 从Chrome存储获取Token
     */
    async _getTokenFromChromeStorage() {
        if (!this._isChromeStorageAvailable()) {
            return '';
        }
        
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([this.storageKey], (result) => {
                    if (chrome.runtime.lastError) {
                        resolve('');
                        return;
                    }
                    
                    const token = result[this.storageKey];
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
    
    /**
     * 保存Token到Chrome存储
     */
    async _saveTokenToChromeStorage(token) {
        const tokenValue = String(token || '').trim();
        this._cachedToken = tokenValue;
        this._cacheInitialized = true;
        
        if (!this._isChromeStorageAvailable()) {
            return false;
        }
        
        return new Promise((resolve) => {
            try {
                chrome.storage.local.set({ [this.storageKey]: tokenValue }, () => {
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
    
    /**
     * 获取Token（同步）
     */
    getTokenSync() {
        if (!this._cacheInitialized) {
            this._initCache();
        }
        return this._cachedToken;
    }
    
    /**
     * 获取Token（异步）
     */
    async getToken() {
        const chromeToken = await this._getTokenFromChromeStorage();
        return chromeToken;
    }
    
    /**
     * 保存Token
     */
    async saveToken(token) {
        const tokenValue = String(token || '').trim();
        return await this._saveTokenToChromeStorage(tokenValue);
    }
    
    /**
     * 是否有Token（同步）
     */
    hasTokenSync() {
        const token = this.getTokenSync();
        return token && token.trim().length > 0;
    }
    
    /**
     * 是否有Token（异步）
     */
    async hasToken() {
        const token = await this.getToken();
        return token && token.trim().length > 0;
    }
    
    /**
     * 确保Token已设置
     */
    async ensureTokenSet() {
        const hasToken = await this.hasToken();
        if (!hasToken) {
            if (typeof window !== 'undefined' && window.petManager) {
                try {
                    await window.petManager.ensureTokenSet();
                    return await this.hasToken();
                } catch (error) {
                    console.warn('调用 PetManager.ensureTokenSet 失败:', error);
                }
            }
        }
        return hasToken;
    }
    
    /**
     * 清除Token
     */
    async clearToken() {
        this._cachedToken = '';
        
        if (this._isChromeStorageAvailable()) {
            return new Promise((resolve) => {
                try {
                    chrome.storage.local.remove([this.storageKey], () => {
                        resolve(!chrome.runtime.lastError);
                    });
                } catch (error) {
                    resolve(false);
                }
            });
        }
        
        return true;
    }
    
    /**
     * 验证Token格式
     */
    validateToken(token) {
        if (!token || typeof token !== 'string') {
            return false;
        }
        
        const trimmedToken = token.trim();
        
        // 基本长度检查
        if (trimmedToken.length < 10) {
            return false;
        }
        
        // 格式检查（可以根据实际需求调整）
        const tokenPattern = /^[a-zA-Z0-9_-]+$/;
        return tokenPattern.test(trimmedToken);
    }
}

/**
 * 创建Token管理器
 */
function createTokenManager(options = {}) {
    return new TokenManager(options);
}

/**
 * 默认Token管理器实例
 */
const tokenManager = createTokenManager();

/**
 * Token工具函数
 */
const TokenUtils = {
    async getApiToken() {
        return await tokenManager.getToken();
    },
    
    getApiTokenSync() {
        return tokenManager.getTokenSync();
    },
    
    async saveApiToken(token) {
        return await tokenManager.saveToken(token);
    },
    
    async hasApiToken() {
        return await tokenManager.hasToken();
    },
    
    hasApiTokenSync() {
        return tokenManager.hasTokenSync();
    },
    
    async ensureTokenSet() {
        return await tokenManager.ensureTokenSet();
    }
};

root.TokenManager = TokenManager;
root.createTokenManager = createTokenManager;
root.tokenManager = tokenManager;
root.TokenUtils = TokenUtils;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
