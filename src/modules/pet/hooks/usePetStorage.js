/**
 * Pet Storage Hook
 * 宠物存储Hook
 */

import React from 'react';
import { STATE_CONFIG, StorageTypes } from '../constants/index.js';

/**
 * 存储管理器
 */
class PetStorageManager {
    constructor() {
        this.storageType = STATE_CONFIG.persistence.enabled ? StorageTypes.LOCAL : StorageTypes.MEMORY;
        this.memoryStorage = new Map();
        this.listeners = new Map();
    }

    /**
     * 设置存储类型
     */
    setStorageType(type) {
        if (Object.values(StorageTypes).includes(type)) {
            this.storageType = type;
            return true;
        }
        return false;
    }

    /**
     * 获取存储类型
     */
    getStorageType() {
        return this.storageType;
    }

    /**
     * 设置值
     */
    set(key, value, type = null) {
        const storageType = type || this.storageType;
        const storageKey = this.getStorageKey(key);
        
        try {
            const serializedValue = JSON.stringify(value);
            
            switch (storageType) {
                case StorageTypes.LOCAL:
                    localStorage.setItem(storageKey, serializedValue);
                    break;
                case StorageTypes.SESSION:
                    sessionStorage.setItem(storageKey, serializedValue);
                    break;
                case StorageTypes.INDEXEDDB:
                    // IndexedDB实现
                    return this.setIndexedDB(storageKey, serializedValue);
                case StorageTypes.MEMORY:
                default:
                    this.memoryStorage.set(storageKey, serializedValue);
                    break;
            }
            
            this.notifyListeners(key, value, 'set');
            return true;
        } catch (error) {
            console.error('存储失败:', error);
            return false;
        }
    }

    /**
     * 获取值
     */
    get(key, defaultValue = null, type = null) {
        const storageType = type || this.storageType;
        const storageKey = this.getStorageKey(key);
        
        try {
            let value = null;
            
            switch (storageType) {
                case StorageTypes.LOCAL:
                    value = localStorage.getItem(storageKey);
                    break;
                case StorageTypes.SESSION:
                    value = sessionStorage.getItem(storageKey);
                    break;
                case StorageTypes.INDEXEDDB:
                    // IndexedDB实现
                    return this.getIndexedDB(storageKey, defaultValue);
                case StorageTypes.MEMORY:
                default:
                    value = this.memoryStorage.get(storageKey);
                    break;
            }
            
            if (value !== null) {
                return JSON.parse(value);
            }
        } catch (error) {
            console.error('读取存储失败:', error);
        }
        
        return defaultValue;
    }

    /**
     * 删除值
     */
    remove(key, type = null) {
        const storageType = type || this.storageType;
        const storageKey = this.getStorageKey(key);
        
        try {
            switch (storageType) {
                case StorageTypes.LOCAL:
                    localStorage.removeItem(storageKey);
                    break;
                case StorageTypes.SESSION:
                    sessionStorage.removeItem(storageKey);
                    break;
                case StorageTypes.INDEXEDDB:
                    // IndexedDB实现
                    return this.removeIndexedDB(storageKey);
                case StorageTypes.MEMORY:
                default:
                    this.memoryStorage.delete(storageKey);
                    break;
            }
            
            this.notifyListeners(key, null, 'remove');
            return true;
        } catch (error) {
            console.error('删除存储失败:', error);
            return false;
        }
    }

    /**
     * 清空存储
     */
    clear(type = null) {
        const storageType = type || this.storageType;
        
        try {
            switch (storageType) {
                case StorageTypes.LOCAL:
                    localStorage.clear();
                    break;
                case StorageTypes.SESSION:
                    sessionStorage.clear();
                    break;
                case StorageTypes.INDEXEDDB:
                    // IndexedDB实现
                    return this.clearIndexedDB();
                case StorageTypes.MEMORY:
                default:
                    this.memoryStorage.clear();
                    break;
            }
            
            this.notifyListeners(null, null, 'clear');
            return true;
        } catch (error) {
            console.error('清空存储失败:', error);
            return false;
        }
    }

    /**
     * 获取所有键
     */
    keys(type = null) {
        const storageType = type || this.storageType;
        
        try {
            switch (storageType) {
                case StorageTypes.LOCAL:
                    return Array.from({ length: localStorage.length }, (_, i) => {
                        const key = localStorage.key(i);
                        return key.startsWith('yi-pet-') ? key.replace('yi-pet-', '') : null;
                    }).filter(Boolean);
                case StorageTypes.SESSION:
                    return Array.from({ length: sessionStorage.length }, (_, i) => {
                        const key = sessionStorage.key(i);
                        return key.startsWith('yi-pet-') ? key.replace('yi-pet-', '') : null;
                    }).filter(Boolean);
                case StorageTypes.MEMORY:
                default:
                    return Array.from(this.memoryStorage.keys())
                        .filter(key => key.startsWith('yi-pet-'))
                        .map(key => key.replace('yi-pet-', ''));
            }
        } catch (error) {
            console.error('获取存储键失败:', error);
            return [];
        }
    }

    /**
     * 获取存储大小
     */
    getSize(type = null) {
        const storageType = type || this.storageType;
        const keys = this.keys(storageType);
        
        let totalSize = 0;
        keys.forEach(key => {
            const value = this.get(key, null, storageType);
            if (value !== null) {
                totalSize += JSON.stringify(value).length;
            }
        });
        
        return totalSize;
    }

    /**
     * 添加监听器
     */
    addListener(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        
        return () => this.removeListener(key, callback);
    }

    /**
     * 移除监听器
     */
    removeListener(key, callback) {
        if (this.listeners.has(key)) {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
            if (callbacks.length === 0) {
                this.listeners.delete(key);
            }
        }
    }

    /**
     * 通知监听器
     */
    notifyListeners(key, value, action) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(callback => {
                try {
                    callback(value, action, key);
                } catch (error) {
                    console.error('监听器错误:', error);
                }
            });
        }
        
        // 通知全局监听器
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(callback => {
                try {
                    callback(value, action, key);
                } catch (error) {
                    console.error('全局监听器错误:', error);
                }
            });
        }
    }

    /**
     * 获取存储键
     */
    getStorageKey(key) {
        return `yi-pet-${key}`;
    }

    /**
     * IndexedDB设置（占位符实现）
     */
    async setIndexedDB(key, value) {
        console.warn('IndexedDB存储未实现，回退到localStorage');
        return this.set(key.replace('yi-pet-', ''), value, StorageTypes.LOCAL);
    }

    /**
     * IndexedDB获取（占位符实现）
     */
    async getIndexedDB(key, defaultValue) {
        console.warn('IndexedDB存储未实现，回退到localStorage');
        return this.get(key.replace('yi-pet-', ''), defaultValue, StorageTypes.LOCAL);
    }

    /**
     * IndexedDB删除（占位符实现）
     */
    async removeIndexedDB(key) {
        console.warn('IndexedDB存储未实现，回退到localStorage');
        return this.remove(key.replace('yi-pet-', ''), StorageTypes.LOCAL);
    }

    /**
     * IndexedDB清空（占位符实现）
     */
    async clearIndexedDB() {
        console.warn('IndexedDB存储未实现，回退到localStorage');
        return this.clear(StorageTypes.LOCAL);
    }
}

// 全局存储管理器实例
export const petStorageManager = new PetStorageManager();

/**
 * 宠物存储Hook
 */
export function usePetStorage(key, defaultValue = null, options = {}) {
    const { 
        storageType = null,
        serialize = JSON.stringify,
        deserialize = JSON.parse,
        debounce = 0
    } = options;

    const [value, setValue] = React.useState(() => {
        return petStorageManager.get(key, defaultValue, storageType);
    });

    const debounceRef = React.useRef(null);

    React.useEffect(() => {
        // 添加监听器
        const unsubscribe = petStorageManager.addListener(key, (newValue, action, storageKey) => {
            if (action === 'set' && storageKey === key) {
                setValue(newValue);
            }
        });

        return unsubscribe;
    }, [key]);

    const setStoredValue = React.useCallback((newValue) => {
        const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
        
        if (debounce > 0) {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            
            debounceRef.current = setTimeout(() => {
                petStorageManager.set(key, valueToStore, storageType);
                setValue(valueToStore);
            }, debounce);
        } else {
            petStorageManager.set(key, valueToStore, storageType);
            setValue(valueToStore);
        }
    }, [key, value, storageType, debounce]);

    const removeStoredValue = React.useCallback(() => {
        petStorageManager.remove(key, storageType);
        setValue(defaultValue);
    }, [key, defaultValue, storageType]);

    React.useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    return [value, setStoredValue, removeStoredValue];
}

/**
 * 宠物存储状态Hook
 */
export function usePetStorageState(key, defaultValue = null, options = {}) {
    const [value, setValue, removeValue] = usePetStorage(key, defaultValue, options);
    
    return {
        value,
        setValue,
        removeValue,
        isStored: value !== null
    };
}

/**
 * 宠物存储数组Hook
 */
export function usePetStorageArray(key, defaultValue = [], options = {}) {
    const [array, setArray, removeArray] = usePetStorage(key, defaultValue, options);
    
    const addItem = React.useCallback((item) => {
        setArray(prev => [...prev, item]);
    }, [setArray]);
    
    const removeItem = React.useCallback((indexOrPredicate) => {
        setArray(prev => {
            if (typeof indexOrPredicate === 'function') {
                return prev.filter(indexOrPredicate);
            }
            return prev.filter((_, index) => index !== indexOrPredicate);
        });
    }, [setArray]);
    
    const updateItem = React.useCallback((index, updater) => {
        setArray(prev => prev.map((item, i) => 
            i === index ? (typeof updater === 'function' ? updater(item) : updater) : item
        ));
    }, [setArray]);
    
    const clearArray = React.useCallback(() => {
        setArray([]);
    }, [setArray]);
    
    return {
        array,
        setArray,
        addItem,
        removeItem,
        updateItem,
        clearArray,
        removeArray,
        length: array.length
    };
}

/**
 * 宠物存储对象Hook
 */
export function usePetStorageObject(key, defaultValue = {}, options = {}) {
    const [object, setObject, removeObject] = usePetStorage(key, defaultValue, options);
    
    const setValue = React.useCallback((keyOrUpdater, value) => {
        setObject(prev => {
            if (typeof keyOrUpdater === 'function') {
                return keyOrUpdater(prev);
            }
            return { ...prev, [keyOrUpdater]: value };
        });
    }, [setObject]);
    
    const removeKey = React.useCallback((keyToRemove) => {
        setObject(prev => {
            const newObj = { ...prev };
            delete newObj[keyToRemove];
            return newObj;
        });
    }, [setObject]);
    
    const merge = React.useCallback((newValues) => {
        setObject(prev => ({ ...prev, ...newValues }));
    }, [setObject]);
    
    return {
        object,
        setObject,
        setValue,
        removeKey,
        merge,
        removeObject,
        keys: Object.keys(object),
        values: Object.values(object),
        entries: Object.entries(object)
    };
}