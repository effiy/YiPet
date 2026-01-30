
/**
 * Chrome扩展Content Script
 * 负责在网页中创建和管理宠物
 */

(function() {
    try {
        const keyName = (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.storageKeys) ? PET_CONFIG.constants.storageKeys.devMode : 'petDevMode';
        LoggerUtils.initMuteLogger(keyName, false);
    } catch (e) {}
})();

console.log('Content Script 加载');

// 检查PET_CONFIG是否可用
if (typeof PET_CONFIG === 'undefined') {
    console.error('PET_CONFIG未定义');
}

window.StorageHelper = {
        // 检查chrome.storage是否可用
        isChromeStorageAvailable() {
            try {
                if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || !chrome.runtime) return false;
                try {
                    return !!chrome.runtime.id;
                } catch (error) {
                    return false;
                }
            } catch (error) {
                return false;
            }
        },
        
        isQuotaError(error) {
            return ErrorHandler.isQuotaError(error);
        },
        
        isContextInvalidatedError(error) {
            return ErrorHandler.isContextInvalidated(error);
        },
        
        
        // 清理旧数据以释放空间
        async cleanupOldData() {
            try {
                // 检查chrome.storage是否可用
                if (!this.isChromeStorageAvailable()) {
                    console.debug('扩展已重新加载，跳过清理');
                    return;
                }
                
                // 获取所有存储的数据
                const allData = await new Promise((resolve) => {
                    try {
                        chrome.storage.local.get(null, (items) => {
                            if (chrome.runtime.lastError) {
                                const error = chrome.runtime.lastError;
                                if (this.isContextInvalidatedError(error)) {
                                    console.debug('扩展已重新加载，跳过清理');
                                    resolve({});
                                    return;
                                }
                            }
                            resolve(items || {});
                        });
                    } catch (error) {
                        if (this.isContextInvalidatedError(error)) {
                            console.debug('扩展已重新加载，跳过清理');
                            resolve({});
                        } else {
                            throw error;
                        }
                    }
                });
                
                // 按优先级清理数据
                const cleanupKeys = [
                    'petOssFiles', // OSS文件列表（可以重新加载）
                ];
                
                for (const key of cleanupKeys) {
                    if (allData[key]) {
                        // 其他数据直接清空
                        if (this.isChromeStorageAvailable()) {
                            await new Promise((resolve) => {
                                try {
                                    chrome.storage.local.remove(key, () => {
                                        if (chrome.runtime.lastError && this.isContextInvalidatedError(chrome.runtime.lastError)) {
                                            console.debug('扩展已重新加载，跳过清理');
                                        }
                                        resolve();
                                    });
                                } catch (error) {
                                    if (this.isContextInvalidatedError(error)) {
                                        console.debug('扩展已重新加载，跳过清理');
                                    }
                                    resolve();
                                }
                            });
                            console.log(`已清理存储键: ${key}`);
                        }
                    }
                }
                
            } catch (error) {
                console.error('清理存储数据失败:', error);
            }
        },
        
        // 处理存储错误的辅助函数
        _handleStorageError(key, value, error, resolve) {
            if (this.isContextInvalidatedError(error)) {
                resolve({ success: false, error: error.message || '扩展上下文失效', contextInvalidated: true });
                return true;
            }
            
            if (this.isQuotaError(error)) {
                console.warn('存储配额超出，尝试清理旧数据...');
                this.cleanupOldData().then(() => {
                    if (!this.isChromeStorageAvailable()) {
                        resolve({ success: false, error: 'chrome.storage 不可用', contextInvalidated: true });
                        return;
                    }
                    // 重试保存
                    chrome.storage.local.set({ [key]: value }, (retryError) => {
                        if (chrome.runtime.lastError) {
                            const retryErr = chrome.runtime.lastError;
                            resolve({ success: false, error: retryErr.message });
                        } else {
                            resolve({ success: true, retried: true });
                        }
                    });
                });
                return true;
            }
            
            resolve({ success: false, error: error.message || '存储失败' });
            return true;
        },
        
        // 安全的存储设置函数
        async set(key, value, options = {}) {
            return new Promise(async (resolve) => {
                if (!this.isChromeStorageAvailable()) {
                    resolve({ success: false, error: 'chrome.storage 不可用', contextInvalidated: true });
                    return;
                }
                
                try {
                    chrome.storage.local.set({ [key]: value }, async () => {
                        if (chrome.runtime.lastError) {
                            const error = chrome.runtime.lastError;
                            if (!this._handleStorageError(key, value, error, resolve)) {
                                resolve({ success: true });
                            }
                        } else {
                            resolve({ success: true });
                        }
                    });
                } catch (error) {
                    const errorMsg = (error.message || error.toString() || '').toLowerCase();
                    const isContextInvalidated = this.isContextInvalidatedError(error) || 
                                                !this.isChromeStorageAvailable() ||
                                                errorMsg.includes('invalidated');
                    resolve({ success: false, error: error.message || '存储失败', contextInvalidated: !!isContextInvalidated });
                }
            });
        },
        
        // 安全的存储获取函数
        async get(key) {
            return new Promise((resolve) => {
                if (!this.isChromeStorageAvailable()) {
                    resolve(null);
                    return;
                }
                
                try {
                    chrome.storage.local.get([key], (result) => {
                        if (chrome.runtime.lastError) {
                            resolve(null);
                        } else {
                            resolve(result[key] || null);
                        }
                    });
                } catch (error) {
                    resolve(null);
                }
            });
        }
    };

window.getPetDefaultPosition = function() {
    return { x: 20, y: Math.round(window.innerHeight * 0.2) };
};

window.getChatWindowDefaultPosition = function(width, height) {
    return {
        x: Math.max(0, (window.innerWidth - width) / 2),
        y: Math.round(window.innerHeight * 0.12)
    };
};

window.getCenterPosition = function(elementSize, windowSize) {
    return Math.max(0, (windowSize - elementSize) / 2);
};
