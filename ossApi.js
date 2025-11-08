/**
 * OSS API 管理器
 * 统一管理所有 OSS 相关的后端 API 调用
 * 提供缓存、重试等功能
 */

class OssApiManager {
    constructor(baseUrl, enabled = true) {
        this.baseUrl = baseUrl;
        this.enabled = enabled;
        
        // 请求缓存
        this.cache = {
            filesList: null,
            filesListTimestamp: 0,
            CACHE_DURATION: 30000, // 缓存30秒
        };
        
        // 请求去重
        this.pendingRequests = new Map(); // 去重用
        
        // 重试配置
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000, // 1秒
        };
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errorCount: 0,
        };
    }
    
    /**
     * 检查是否启用
     */
    isEnabled() {
        return this.enabled && !!this.baseUrl;
    }
    
    /**
     * 创建请求key用于去重
     */
    _getRequestKey(method, url, body) {
        const bodyStr = body ? JSON.stringify(body) : '';
        return `${method}:${url}:${bodyStr}`;
    }
    
    /**
     * 执行请求（带重试和去重）
     */
    async _request(url, options = {}, retryCount = 0) {
        if (!this.isEnabled()) {
            throw new Error('API管理器未启用');
        }
        
        const requestKey = this._getRequestKey(options.method || 'GET', url, options.body);
        
        // 检查是否有正在进行的相同请求
        if (this.pendingRequests.has(requestKey)) {
            return await this.pendingRequests.get(requestKey);
        }
        
        // 创建请求Promise
        const requestPromise = (async () => {
            try {
                this.stats.totalRequests++;
                
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers,
                    },
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
                
                const result = await response.json();
                
                // 从pending中移除
                this.pendingRequests.delete(requestKey);
                
                return result;
            } catch (error) {
                // 从pending中移除
                this.pendingRequests.delete(requestKey);
                
                // 重试逻辑
                if (retryCount < this.retryConfig.maxRetries) {
                    console.warn(`请求失败，${this.retryConfig.retryDelay}ms后重试 (${retryCount + 1}/${this.retryConfig.maxRetries}):`, error.message);
                    await new Promise(resolve => setTimeout(resolve, this.retryConfig.retryDelay * (retryCount + 1)));
                    return this._request(url, options, retryCount + 1);
                }
                
                this.stats.errorCount++;
                throw error;
            }
        })();
        
        // 保存到pending中
        this.pendingRequests.set(requestKey, requestPromise);
        
        return requestPromise;
    }
    
    /**
     * 获取文件列表（带缓存）
     * @param {Object} options - 查询选项
     * @param {string} options.directory - 目录路径
     * @param {number} options.max_keys - 最大返回数量
     * @param {boolean} options.forceRefresh - 强制刷新缓存
     * @returns {Promise<Array>} 文件列表
     */
    async getFilesList(options = {}) {
        const { directory = '', max_keys = 100, forceRefresh = false } = options;
        const now = Date.now();
        
        // 检查缓存
        if (!forceRefresh && 
            this.cache.filesList && 
            (now - this.cache.filesListTimestamp) < this.cache.CACHE_DURATION) {
            this.stats.cacheHits++;
            return this.cache.filesList;
        }
        
        this.stats.cacheMisses++;
        
        try {
            let url = `${this.baseUrl}/oss/files?max_keys=${max_keys}`;
            if (directory) {
                url += `&directory=${encodeURIComponent(directory)}`;
            }
            
            const result = await this._request(url, { method: 'GET' });
            
            if (result.code === 200 && Array.isArray(result.data)) {
                // 更新缓存
                this.cache.filesList = result.data;
                this.cache.filesListTimestamp = now;
                
                return result.data;
            } else {
                throw new Error(result.message || '返回数据格式错误');
            }
        } catch (error) {
            console.warn('获取文件列表失败:', error.message);
            // 如果请求失败，返回缓存的数据（如果有）
            if (this.cache.filesList) {
                console.log('使用缓存的文件列表');
                return this.cache.filesList;
            }
            throw error;
        }
    }
    
    /**
     * 删除文件
     * @param {string} objectName - 文件对象名
     * @returns {Promise<Object>} 删除结果
     */
    async deleteFile(objectName) {
        if (!objectName) {
            throw new Error('文件对象名无效');
        }
        
        try {
            const url = `${this.baseUrl}/oss/delete/${encodeURIComponent(objectName)}`;
            const result = await this._request(url, {
                method: 'DELETE',
            });
            
            if (result.code === 200) {
                // 清除列表缓存，因为列表可能已变化
                this.cache.filesList = null;
                this.cache.filesListTimestamp = 0;
                
                return result;
            } else {
                throw new Error(result.message || '删除失败');
            }
        } catch (error) {
            console.error('删除文件失败:', error);
            throw error;
        }
    }
    
    /**
     * 上传文件
     * @param {File} file - 文件对象
     * @param {string} directory - 目录路径（可选）
     * @returns {Promise<Object>} 上传结果
     */
    async uploadFile(file, directory = '') {
        if (!file) {
            throw new Error('文件无效');
        }
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (directory) {
                formData.append('directory', directory);
            }
            
            const url = `${this.baseUrl}/oss/upload`;
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            if (result.code === 200) {
                // 清除列表缓存，因为列表可能已变化
                this.cache.filesList = null;
                this.cache.filesListTimestamp = 0;
                
                return result;
            } else {
                throw new Error(result.message || '上传失败');
            }
        } catch (error) {
            console.error('上传文件失败:', error);
            throw error;
        }
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        this.cache.filesList = null;
        this.cache.filesListTimestamp = 0;
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.stats,
            pendingRequests: this.pendingRequests.size,
        };
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errorCount: 0,
        };
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = OssApiManager;
} else {
    window.OssApiManager = OssApiManager;
}

