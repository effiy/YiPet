/**
 * Token 工具类
 * 
 * 功能说明：
 * - 统一管理 X-Token 的存储和获取
 * - 使用 chrome.storage 实现跨 tab 和跨域共享
 * - 提供降级机制：chrome.storage -> localStorage
 * - 自动处理上下文失效错误
 * 
 * 使用示例：
 * ```javascript
 * // 获取 token
 * const token = await TokenUtils.getApiToken();
 * 
 * // 保存 token
 * await TokenUtils.saveApiToken('your-token-here');
 * ```
 */

class TokenUtilsClass {
    constructor() {
        this.TOKEN_KEY = 'YiPet.apiToken.v1';
    }
    
    /**
     * 检查 Chrome Storage 是否可用
     */
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
    
    /**
     * 检查是否是扩展上下文失效错误
     */
    isContextInvalidatedError(error) {
        if (!error) return false;
        const errorMsg = (error.message || error.toString() || '').toLowerCase();
        return errorMsg.includes('extension context invalidated') ||
               errorMsg.includes('context invalidated');
    }
    
    /**
     * 从 localStorage 获取 token（降级方案）
     */
    getTokenFromLocalStorage() {
        try {
            const token = localStorage.getItem(this.TOKEN_KEY);
            return token ? String(token).trim() : '';
        } catch (error) {
            console.warn('从 localStorage 获取 token 失败:', error);
            return '';
        }
    }
    
    /**
     * 保存 token 到 localStorage（降级方案）
     */
    saveTokenToLocalStorage(token) {
        try {
            localStorage.setItem(this.TOKEN_KEY, String(token || '').trim());
            return true;
        } catch (error) {
            console.error('保存 token 到 localStorage 失败:', error);
            return false;
        }
    }
    
    /**
     * 从 Chrome Storage 获取 token
     */
    async getTokenFromChromeStorage() {
        if (!this.isChromeStorageAvailable()) {
            return this.getTokenFromLocalStorage();
        }
        
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([this.TOKEN_KEY], (result) => {
                    if (chrome.runtime.lastError) {
                        const error = chrome.runtime.lastError;
                        // 如果是上下文失效错误，降级到 localStorage
                        if (this.isContextInvalidatedError(error)) {
                            resolve(this.getTokenFromLocalStorage());
                            return;
                        }
                        // 其他错误也降级到 localStorage
                        resolve(this.getTokenFromLocalStorage());
                        return;
                    }
                    
                    const token = result[this.TOKEN_KEY];
                    resolve(token ? String(token).trim() : '');
                });
            } catch (error) {
                // 出错时降级到 localStorage
                resolve(this.getTokenFromLocalStorage());
            }
        });
    }
    
    /**
     * 保存 token 到 Chrome Storage
     */
    async saveTokenToChromeStorage(token) {
        const tokenValue = String(token || '').trim();
        
        // 同时保存到 localStorage 作为备份
        this.saveTokenToLocalStorage(tokenValue);
        
        if (!this.isChromeStorageAvailable()) {
            return true;
        }
        
        return new Promise((resolve) => {
            try {
                chrome.storage.local.set({ [this.TOKEN_KEY]: tokenValue }, () => {
                    if (chrome.runtime.lastError) {
                        const error = chrome.runtime.lastError;
                        // 如果是上下文失效错误，已经保存到 localStorage，继续
                        if (this.isContextInvalidatedError(error)) {
                            resolve(true);
                            return;
                        }
                        // 其他错误，已经保存到 localStorage，继续
                        resolve(true);
                        return;
                    }
                    resolve(true);
                });
            } catch (error) {
                // 出错时已经保存到 localStorage，继续
                resolve(true);
            }
        });
    }
    
    /**
     * 获取 API Token（同步方式，从 localStorage 快速获取）
     * @returns {string} token 字符串
     */
    getApiTokenSync() {
        // 同步方式：优先从 localStorage 获取（快速）
        const localToken = this.getTokenFromLocalStorage();
        
        // 异步从 chrome.storage 同步（不阻塞，后台更新）
        if (this.isChromeStorageAvailable()) {
            this.getTokenFromChromeStorage().then(chromeToken => {
                // 如果 chrome.storage 中的 token 与 localStorage 不同，更新 localStorage
                if (chromeToken && chromeToken !== localToken) {
                    this.saveTokenToLocalStorage(chromeToken);
                }
            }).catch(() => {
                // 静默处理错误
            });
        }
        
        return localToken;
    }
    
    /**
     * 获取 API Token（异步方式，从 chrome.storage 获取最新值）
     * @returns {Promise<string>} token 字符串
     */
    async getApiToken() {
        // 异步方式：优先从 chrome.storage 获取
        const chromeToken = await this.getTokenFromChromeStorage();
        return chromeToken;
    }
    
    /**
     * 保存 API Token（同时保存到 chrome.storage 和 localStorage）
     * 
     * @param {string} token - token 字符串
     * @returns {Promise<boolean>} 是否保存成功
     */
    async saveApiToken(token) {
        const tokenValue = String(token || '').trim();
        
        // 同时保存到两个地方
        this.saveTokenToLocalStorage(tokenValue);
        await this.saveTokenToChromeStorage(tokenValue);
        
        return true;
    }
    
    /**
     * 检查 token 是否存在（同步方式）
     * @returns {boolean} token 是否存在
     */
    hasApiTokenSync() {
        const token = this.getApiTokenSync();
        return token && token.trim().length > 0;
    }
    
    /**
     * 检查 token 是否存在（异步方式）
     * @returns {Promise<boolean>} token 是否存在
     */
    async hasApiToken() {
        const token = await this.getApiToken();
        return token && token.trim().length > 0;
    }
}

// 创建单例实例
const tokenUtilsInstance = new TokenUtilsClass();

// 导出单例方法（兼容同步和异步调用）
const TokenUtils = {
    /**
     * 获取 API Token（异步）
     * @returns {Promise<string>}
     */
    async getApiToken() {
        return await tokenUtilsInstance.getApiToken();
    },
    
    /**
     * 获取 API Token（同步，快速但可能不是最新）
     * @returns {string}
     */
    getApiTokenSync() {
        return tokenUtilsInstance.getApiTokenSync();
    },
    
    /**
     * 保存 API Token
     * @param {string} token
     * @returns {Promise<boolean>}
     */
    async saveApiToken(token) {
        return await tokenUtilsInstance.saveApiToken(token);
    },
    
    /**
     * 检查 token 是否存在（异步）
     * @returns {Promise<boolean>}
     */
    async hasApiToken() {
        return await tokenUtilsInstance.hasApiToken();
    },
    
    /**
     * 检查 token 是否存在（同步）
     * @returns {boolean}
     */
    hasApiTokenSync() {
        return tokenUtilsInstance.hasApiTokenSync();
    },
    
    /**
     * 确保 token 已设置，如果未设置则尝试弹出设置框
     * @returns {Promise<boolean>} 返回 token 是否已设置
     */
    async ensureTokenSet() {
        const hasToken = await tokenUtilsInstance.hasApiToken();
        if (!hasToken) {
            // 尝试调用 PetManager 的 ensureTokenSet 方法
            if (typeof window !== 'undefined' && window.petManager) {
                try {
                    await window.petManager.ensureTokenSet();
                    // 再次检查
                    return await tokenUtilsInstance.hasApiToken();
                } catch (error) {
                    console.warn('调用 PetManager.ensureTokenSet 失败:', error);
                }
            }
        }
        return hasToken;
    }
};

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = TokenUtils;
} else {
    window.TokenUtils = TokenUtils;
}



