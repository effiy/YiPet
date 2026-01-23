/**
 * 存储工具类
 * 
 * 功能说明：
 * - 统一处理 Chrome Storage 和 localStorage 的操作
 * - 提供降级机制：Chrome Storage -> localStorage
 * - 自动处理配额错误和上下文失效错误
 * - 规范化状态数据，确保数据一致性
 * 
 * 使用示例：
 * ```javascript
 * const storageUtils = new StorageUtils();
 * 
 * // 加载全局状态
 * const state = await storageUtils.loadGlobalState();
 * 
 * // 保存全局状态
 * await storageUtils.saveGlobalState(newState);
 * ```
 */

class StorageUtils {
    constructor() {
        this.STORAGE_KEYS = {
            GLOBAL_STATE: (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.storageKeys) ? PET_CONFIG.constants.storageKeys.globalState : 'petGlobalState',
            DEV_MODE: (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.storageKeys) ? PET_CONFIG.constants.storageKeys.devMode : 'petDevMode'
        };
        
        this.DEFAULT_VALUES = {
            visible: (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.pet) ? PET_CONFIG.pet.defaultVisible : false,
            color: (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.pet) ? PET_CONFIG.pet.defaultColorIndex : 0,
            size: (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.pet) ? PET_CONFIG.pet.defaultSize : 180,
            role: (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.DEFAULTS) ? PET_CONFIG.constants.DEFAULTS.PET_ROLE : '教师'
        };
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
     * 检查是否是扩展上下文失效错误（使用 ErrorHandler）
     */
    isContextInvalidatedError(error) {
        if (typeof ErrorHandler !== 'undefined' && typeof ErrorHandler.isContextInvalidated === 'function') {
            return ErrorHandler.isContextInvalidated(error);
        }
        // 降级实现
        if (!error) return false;
        const errorMsg = (error.message || error.toString() || '').toLowerCase();
        return errorMsg.includes('extension context invalidated') ||
               errorMsg.includes('context invalidated');
    }
    
    /**
     * 检查是否是配额错误（使用 ErrorHandler）
     */
    isQuotaError(error) {
        if (typeof ErrorHandler !== 'undefined' && typeof ErrorHandler.isQuotaError === 'function') {
            return ErrorHandler.isQuotaError(error);
        }
        // 降级实现
        if (!error) return false;
        const errorMsg = (error.message || error.toString() || '').toLowerCase();
        return errorMsg.includes('quota_bytes') || 
               errorMsg.includes('quota exceeded') ||
               errorMsg.includes('max_write_operations') ||
               errorMsg.includes('quota_bytes_per_hour');
    }
    
    /**
     * 规范化状态对象（确保所有字段都有默认值）
     */
    normalizeState(state) {
        if (!state) return null;
        
        return {
            visible: state.visible !== undefined ? state.visible : this.DEFAULT_VALUES.visible,
            color: state.color !== undefined ? state.color : this.DEFAULT_VALUES.color,
            size: state.size !== undefined ? state.size : this.DEFAULT_VALUES.size,
            position: state.position || getPetDefaultPosition(),
            role: state.role || this.DEFAULT_VALUES.role
        };
    }
    
    /**
     * 从 localStorage 加载状态
     */
    loadFromLocalStorage(key) {
        try {
            const localValue = localStorage.getItem(key);
            if (localValue) {
                return JSON.parse(localValue);
            }
        } catch (error) {
            console.warn(`从localStorage加载失败 (${key}):`, error);
        }
        return null;
    }
    
    /**
     * 保存到 localStorage
     */
    saveToLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`保存到localStorage失败 (${key}):`, error);
            return false;
        }
    }
    
    /**
     * 从 Chrome Storage 加载数据
     */
    async loadFromChromeStorage(key, useSync = false) {
        if (!this.isChromeStorageAvailable()) {
            return this.loadFromLocalStorage(key);
        }
        
        return new Promise((resolve) => {
            const storage = useSync ? chrome.storage.sync : chrome.storage.local;
            
            storage.get([key], (result) => {
                if (chrome.runtime.lastError) {
                    // 降级到 localStorage
                    resolve(this.loadFromLocalStorage(key));
                    return;
                }
                
                resolve(result[key] || null);
            });
        });
    }
    
    /**
     * 保存到 Chrome Storage
     */
    async saveToChromeStorage(key, value, useSync = false) {
        if (!this.isChromeStorageAvailable()) {
            return this.saveToLocalStorage(key, value);
        }
        
        return new Promise((resolve) => {
            const storage = useSync ? chrome.storage.sync : chrome.storage.local;
            
            storage.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError;
                    
                    // 如果是上下文失效错误，降级到 localStorage
                    if (this.isContextInvalidatedError(error)) {
                        this.saveToLocalStorage(key, value);
                        resolve();
                        return;
                    }
                    
                    // 如果是配额错误，尝试清理后重试
                    if (this.isQuotaError(error)) {
                        this._handleStorageQuotaError(key, value, resolve);
                        return;
                    }
                    
                    // 其他错误，降级到 localStorage
                    this.saveToLocalStorage(key, value);
                    resolve();
                    return;
                }
                
                // 成功保存，同时备份到 localStorage
                this.saveToLocalStorage(key, value);
                resolve();
            });
        });
    }
    
    /**
     * 处理存储配额错误
     */
    async _handleStorageQuotaError(key, value, resolve) {
        try {
            // 尝试清理OSS文件列表
            chrome.storage.local.remove('petOssFiles', () => {
                // 重试保存
                chrome.storage.local.set({ [key]: value }, (retryError) => {
                    if (chrome.runtime.lastError) {
                        const retryErr = chrome.runtime.lastError;
                        if (this.isContextInvalidatedError(retryErr) || this.isQuotaError(retryErr)) {
                            // 降级到 localStorage
                            this.saveToLocalStorage(key, value);
                        }
                    }
                    resolve();
                });
            });
        } catch (error) {
            // 清理失败，降级到 localStorage
            this.saveToLocalStorage(key, value);
            resolve();
        }
    }
    
    /**
     * 加载全局状态（带降级机制）
     */
    async loadGlobalState() {
        // 优先从 local 存储加载
        let state = await this.loadFromChromeStorage(this.STORAGE_KEYS.GLOBAL_STATE, false);
        
        // 如果 local 中没有，尝试从 sync 加载（兼容旧版本）
        if (!state) {
            state = await this.loadFromChromeStorage(this.STORAGE_KEYS.GLOBAL_STATE, true);
        }
        
        return this.normalizeState(state);
    }
    
    /**
     * 保存全局状态（带降级机制）
     */
    async saveGlobalState(state) {
        const normalizedState = {
            ...this.normalizeState(state),
            timestamp: Date.now()
        };
        
        await this.saveToChromeStorage(this.STORAGE_KEYS.GLOBAL_STATE, normalizedState, false);
    }
}

// 导出单例
if (typeof module !== "undefined" && module.exports) {
    module.exports = StorageUtils;
} else {
    window.StorageUtils = StorageUtils;
}

