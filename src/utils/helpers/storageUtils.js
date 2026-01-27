/**
 * 存储工具类
 * 
 * 功能说明：
 * - 统一处理 Chrome Storage 的操作
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
        if (typeof ErrorHandler === 'undefined' || typeof ErrorHandler.isContextInvalidated !== 'function') {
            return false;
        }
        return ErrorHandler.isContextInvalidated(error);
    }
    
    /**
     * 检查是否是配额错误（使用 ErrorHandler）
     */
    isQuotaError(error) {
        if (typeof ErrorHandler === 'undefined' || typeof ErrorHandler.isQuotaError !== 'function') {
            return false;
        }
        return ErrorHandler.isQuotaError(error);
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
     * 从 Chrome Storage 加载数据
     */
    async loadFromChromeStorage(key) {
        if (!this.isChromeStorageAvailable()) {
            return null;
        }
        
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                if (chrome.runtime.lastError) {
                    resolve(null);
                    return;
                }
                
                resolve(result[key] || null);
            });
        });
    }
    
    /**
     * 保存到 Chrome Storage
     */
    async saveToChromeStorage(key, value) {
        if (!this.isChromeStorageAvailable()) {
            return false;
        }
        
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError;
                    
                    if (this.isContextInvalidatedError(error)) {
                        resolve(false);
                        return;
                    }
                    
                    // 如果是配额错误，尝试清理后重试
                    if (this.isQuotaError(error)) {
                        this._handleStorageQuotaError(key, value, resolve);
                        return;
                    }
                    
                    resolve(false);
                    return;
                }
                
                resolve(true);
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
                        resolve(false);
                        return;
                    }
                    resolve(true);
                });
            });
        } catch (error) {
            resolve(false);
        }
    }
    
    /**
     * 加载全局状态（带降级机制）
     */
    async loadGlobalState() {
        // 优先从 local 存储加载
        let state = await this.loadFromChromeStorage(this.STORAGE_KEYS.GLOBAL_STATE);
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
        
        await this.saveToChromeStorage(this.STORAGE_KEYS.GLOBAL_STATE, normalizedState);
    }
}

// 导出单例
if (typeof module !== "undefined" && module.exports) {
    module.exports = StorageUtils;
} else {
    window.StorageUtils = StorageUtils;
}
