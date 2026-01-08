
/**
 * Chrome扩展Content Script
 * 负责在网页中创建和管理宠物
 */

// 使用公共日志工具（如果可用）
(function() {
    try {
        if (typeof LoggerUtils !== 'undefined' && LoggerUtils.initMuteLogger) {
            const keyName = (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.storageKeys) ? PET_CONFIG.constants.storageKeys.devMode : 'petDevMode';
            LoggerUtils.initMuteLogger(keyName, false);
        } else {
            // 降级到本地实现
            const keyName = (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.storageKeys) ? PET_CONFIG.constants.storageKeys.devMode : 'petDevMode';
            const defaultEnabled = false;
            const original = {
                log: console.log,
                info: console.info,
                debug: console.debug,
                warn: console.warn
            };
            const muteIfNeeded = (enabled) => {
                if (enabled) {
                    console.log = original.log;
                    console.info = original.info;
                    console.debug = original.debug;
                    console.warn = original.warn;
                } else {
                    const noop = () => {};
                    console.log = noop;
                    console.info = noop;
                    console.debug = noop;
                    console.warn = noop;
                }
            };
            chrome.storage.sync.get([keyName], (res) => {
                const enabled = res[keyName];
                muteIfNeeded(typeof enabled === 'boolean' ? enabled : defaultEnabled);
            });
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace !== 'sync') return;
                if (changes[keyName]) {
                    muteIfNeeded(changes[keyName].newValue);
                }
            });
        }
    } catch (e) {}
})();

console.log('Content Script 加载');

// 检查PET_CONFIG是否可用
if (typeof PET_CONFIG === 'undefined') {
    console.error('PET_CONFIG未定义，尝试重新加载config.js');

    // 创建默认配置作为备用
    window.PET_CONFIG = {
        pet: {
            defaultSize: 180,
            defaultColorIndex: 0,
            defaultVisible: false,
            colors: [
                'linear-gradient(135deg, #ff6b6b, #ff8e8e)',
                'linear-gradient(135deg, #4ecdc4, #44a08d)',
                'linear-gradient(135deg, #ff9a9e, #fecfef)',
                'linear-gradient(135deg, #a8edea, #fed6e3)',
                'linear-gradient(135deg, #ffecd2, #fcb69f)'
            ],
            sizeLimits: { min: 80, max: 400 }
        },
        chatWindow: {
            defaultSize: { width: 700, height: 600 },
            sizeLimits: { minWidth: 300, maxWidth: 10000, minHeight: 200, maxHeight: 10000 },
            input: { maxLength: 0, placeholder: '输入消息...' }, // 0表示无限制
            message: { maxLength: 0, thinkingDelay: { min: 1000, max: 2000 } } // 0表示无限制
        },
        ui: {
            zIndex: {
                pet: 2147483647,
                chatWindow: 2147483648,
                resizeHandle: 20,
                inputContainer: 10,
                modal: 2147483649 // 弹框层级，确保在所有元素之上
            }
        },
        storage: {
            keys: { globalState: 'petGlobalState' },
            syncInterval: 3000
        },
        chatModels: {
            default: 'qwen3',
            models: [
                { id: 'qwen3', name: 'Qwen3', icon: '🤖' },
                { id: 'qwen3-vl', name: 'Qwen3-VL', icon: '👁️' },
                { id: 'qwq', name: 'QWQ', icon: '💬' }
            ]
        },
        api: {
            streamPromptUrl: 'https://api.effiy.cn/prompt',
            promptUrl: 'https://api.effiy.cn/prompt/',
            yiaiBaseUrl: 'https://api.effiy.cn',
            syncSessionsToBackend: true
        }
    };

    console.log('已创建默认PET_CONFIG配置');
}

// 存储工具函数 - 统一处理配额错误和数据清理
if (typeof window.StorageHelper === 'undefined') {
    window.StorageHelper = {
        // 检查chrome.storage是否可用
        isChromeStorageAvailable() {
            try {
                // 检查基本对象是否存在
                if (typeof chrome === 'undefined' || 
                    !chrome.storage || 
                    !chrome.storage.local ||
                    !chrome.runtime) {
                    return false;
                }
                
                // 检查 runtime.id 是否存在（如果不存在，说明上下文已失效）
                try {
                    const runtimeId = chrome.runtime.id;
                    if (!runtimeId) {
                        return false;
                    }
                } catch (error) {
                    // 如果访问 runtime.id 抛出错误，检查是否是上下文失效错误
                    const errorMsg = (error.message || error.toString() || '').toLowerCase();
                    if (errorMsg.includes('extension context invalidated') ||
                        errorMsg.includes('context invalidated')) {
                        return false;
                    }
                    throw error;
                }
                
                return true;
            } catch (error) {
                // 如果捕获到上下文失效错误，返回 false
                const errorMsg = (error.message || error.toString() || '').toLowerCase();
                if (errorMsg.includes('extension context invalidated') ||
                    errorMsg.includes('context invalidated')) {
                    return false;
                }
                return false;
            }
        },
        
        // 检查是否是配额错误
        isQuotaError(error) {
            if (!error) return false;
            const errorMsg = error.message || error.toString();
            return errorMsg.includes('QUOTA_BYTES') || 
                   errorMsg.includes('quota exceeded') ||
                   errorMsg.includes('QuotaExceededError') ||
                   errorMsg.includes('MAX_WRITE_OPERATIONS') ||
                   errorMsg.includes('QUOTA_BYTES_PER_HOUR');
        },
        
        // 检查是否是上下文失效错误
        isContextInvalidatedError(error) {
            if (!error) return false;
            const errorMsg = (error.message || error.toString() || '').toLowerCase();
            return errorMsg.includes('extension context invalidated') ||
                   errorMsg.includes('context invalidated') ||
                   errorMsg.includes('the message port closed') ||
                   errorMsg.includes('message port closed') ||
                   errorMsg.includes('receiving end does not exist') ||
                   errorMsg.includes('could not establish connection');
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
        
        // 降级到localStorage的辅助函数
        _fallbackToLocalStorage(key, value, contextInvalidated = false) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return { success: true, fallback: 'localStorage', contextInvalidated };
            } catch (localError) {
                console.error('localStorage存储失败:', localError);
                return { success: false, error: localError.message || '存储失败' };
            }
        },
        
        // 处理存储错误的辅助函数
        _handleStorageError(key, value, error, resolve) {
            if (this.isContextInvalidatedError(error)) {
                resolve(this._fallbackToLocalStorage(key, value, true));
                return true;
            }
            
            if (this.isQuotaError(error)) {
                console.warn('存储配额超出，尝试清理旧数据...');
                this.cleanupOldData().then(() => {
                    if (!this.isChromeStorageAvailable()) {
                        resolve(this._fallbackToLocalStorage(key, value, true));
                        return;
                    }
                    // 重试保存
                    chrome.storage.local.set({ [key]: value }, (retryError) => {
                        if (chrome.runtime.lastError) {
                            const retryErr = chrome.runtime.lastError;
                            if (this.isContextInvalidatedError(retryErr) || this.isQuotaError(retryErr)) {
                                resolve(this._fallbackToLocalStorage(key, value, this.isContextInvalidatedError(retryErr)));
                            } else {
                                resolve({ success: false, error: retryErr.message });
                            }
                        } else {
                            resolve({ success: true, retried: true });
                        }
                    });
                });
                return true;
            }
            
            // 其他错误，降级到localStorage
            console.debug('存储操作已降级到localStorage');
            resolve(this._fallbackToLocalStorage(key, value));
            return true;
        },
        
        // 安全的存储设置函数
        async set(key, value, options = {}) {
            return new Promise(async (resolve) => {
                // 如果chrome.storage不可用，直接降级到localStorage
                if (!this.isChromeStorageAvailable()) {
                    resolve(this._fallbackToLocalStorage(key, value, true));
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
                    resolve(this._fallbackToLocalStorage(key, value, isContextInvalidated));
                }
            });
        },
        
        // 从localStorage读取的辅助函数
        _getFromLocalStorage(key) {
            try {
                const localValue = localStorage.getItem(key);
                return localValue ? JSON.parse(localValue) : null;
            } catch (error) {
                console.warn('从localStorage读取失败:', error);
                return null;
            }
        },
        
        // 安全的存储获取函数
        async get(key) {
            return new Promise((resolve) => {
                // 如果chrome.storage不可用，直接使用localStorage
                if (!this.isChromeStorageAvailable()) {
                    console.debug('扩展已重新加载，自动使用localStorage');
                    resolve(this._getFromLocalStorage(key));
                    return;
                }
                
                try {
                    chrome.storage.local.get([key], (result) => {
                        if (chrome.runtime.lastError) {
                            const error = chrome.runtime.lastError;
                            if (this.isContextInvalidatedError(error)) {
                                console.debug('扩展已重新加载，自动使用localStorage');
                            } else {
                                console.debug('已自动降级到localStorage');
                            }
                            resolve(this._getFromLocalStorage(key));
                        } else {
                            resolve(result[key] || null);
                        }
                    });
                } catch (error) {
                    const errorMsg = (error.message || error.toString() || '').toLowerCase();
                    const isContextInvalidated = this.isContextInvalidatedError(error) || 
                                                !this.isChromeStorageAvailable() || 
                                                errorMsg.includes('invalidated');
                    if (isContextInvalidated) {
                        console.debug('扩展已重新加载，自动使用localStorage');
                    } else {
                        console.debug('已自动降级到localStorage');
                    }
                    resolve(this._getFromLocalStorage(key));
                }
            });
        }
    };
}

// 添加默认工具函数
if (typeof getPetDefaultPosition === 'undefined') {
    window.getPetDefaultPosition = function() {
        return { x: 20, y: Math.round(window.innerHeight * 0.2) };
    };
}

if (typeof getChatWindowDefaultPosition === 'undefined') {
    window.getChatWindowDefaultPosition = function(width, height) {
        return {
            x: Math.max(0, (window.innerWidth - width) / 2),
            y: Math.round(window.innerHeight * 0.12)
        };
    };
}

if (typeof getCenterPosition === 'undefined') {
    window.getCenterPosition = function(elementSize, windowSize) {
        return Math.max(0, (windowSize - elementSize) / 2);
    };
}

