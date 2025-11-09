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
     * 获取文件的标签
     * @param {string} objectName - 文件对象名
     * @returns {Promise<Array>} 标签列表
     */
    async getFileTags(objectName) {
        if (!objectName) {
            throw new Error('文件对象名无效');
        }
        
        try {
            const url = `${this.baseUrl}/oss/tags/${encodeURIComponent(objectName)}`;
            const result = await this._request(url, { method: 'GET' });
            
            if (result.code === 200) {
                return result.data.tags || [];
            } else {
                throw new Error(result.message || '获取标签失败');
            }
        } catch (error) {
            console.error('获取文件标签失败:', error);
            throw error;
        }
    }
    
    /**
     * 设置文件的标签
     * @param {string} objectName - 文件对象名
     * @param {Array<string>} tags - 标签列表
     * @returns {Promise<Object>} 设置结果
     */
    async setFileTags(objectName, tags) {
        if (!objectName) {
            throw new Error('文件对象名无效');
        }
        
        if (!Array.isArray(tags)) {
            throw new Error('标签必须是数组');
        }
        
        try {
            const url = `${this.baseUrl}/oss/tags`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify({
                    object_name: objectName,
                    tags: tags
                })
            });
            
            if (result.code === 200) {
                // 清除列表缓存，因为标签可能影响显示
                this.cache.filesList = null;
                this.cache.filesListTimestamp = 0;
                
                return result;
            } else {
                throw new Error(result.message || '设置标签失败');
            }
        } catch (error) {
            console.error('设置文件标签失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取所有标签列表（带统计）
     * @returns {Promise<Array>} 标签列表，每个标签包含name和count
     */
    async getAllTags() {
        try {
            const url = `${this.baseUrl}/oss/tags`;
            const result = await this._request(url, { method: 'GET' });
            
            if (result.code === 200) {
                return result.data || [];
            } else {
                throw new Error(result.message || '获取标签列表失败');
            }
        } catch (error) {
            console.error('获取所有标签失败:', error);
            throw error;
        }
    }
    
    /**
     * 更新文件信息（标题、描述等）
     * @param {string} objectName - 文件对象名
     * @param {Object} fileInfo - 文件信息对象
     * @param {string} fileInfo.title - 文件标题（可选）
     * @param {string} fileInfo.description - 文件描述（可选）
     * @returns {Promise<Object>} 更新结果
     */
    async updateFileInfo(objectName, fileInfo = {}) {
        if (!objectName) {
            throw new Error('文件对象名无效');
        }
        
        try {
            const url = `${this.baseUrl}/oss/file/info`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify({
                    object_name: objectName,
                    title: fileInfo.title || '',
                    description: fileInfo.description || ''
                })
            });
            
            if (result.code === 200) {
                // 清除列表缓存，因为文件信息可能影响显示
                this.cache.filesList = null;
                this.cache.filesListTimestamp = 0;
                
                return result;
            } else {
                throw new Error(result.message || '更新文件信息失败');
            }
        } catch (error) {
            console.error('更新文件信息失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取文件列表（支持标签筛选）
     * @param {Object} options - 查询选项
     * @param {string} options.directory - 目录路径
     * @param {number} options.max_keys - 最大返回数量
     * @param {Array<string>} options.tags - 标签筛选（可选）
     * @param {boolean} options.forceRefresh - 强制刷新缓存
     * @returns {Promise<Array>} 文件列表
     */
    async getFilesList(options = {}) {
        const { directory = '', max_keys = 100, tags = null, forceRefresh = false } = options;
        const now = Date.now();
        
        // 检查缓存（如果有标签筛选，不使用缓存）
        if (!forceRefresh && !tags && 
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
            if (tags && Array.isArray(tags) && tags.length > 0) {
                url += `&tags=${encodeURIComponent(tags.join(','))}`;
            }
            
            const result = await this._request(url, { method: 'GET' });
            
            if (result.code === 200 && Array.isArray(result.data)) {
                // 更新缓存（仅在没有标签筛选时）
                if (!tags) {
                    this.cache.filesList = result.data;
                    this.cache.filesListTimestamp = now;
                }
                
                return result.data;
            } else {
                throw new Error(result.message || '返回数据格式错误');
            }
        } catch (error) {
            console.warn('获取文件列表失败:', error.message);
            // 如果请求失败，返回缓存的数据（如果有且没有标签筛选）
            if (!tags && this.cache.filesList) {
                console.log('使用缓存的文件列表');
                return this.cache.filesList;
            }
            throw error;
        }
    }
    
    /**
     * 下载文件
     * @param {string} objectName - 文件对象名
     * @param {string} filename - 下载时的文件名（可选，默认使用 objectName）
     * @returns {Promise<void>}
     */
    async downloadFile(objectName, filename = null) {
        if (!objectName) {
            throw new Error('文件对象名无效');
        }
        
        try {
            const url = `${this.baseUrl}/oss/download/${encodeURIComponent(objectName)}`;
            
            // 使用 fetch 获取文件
            const response = await fetch(url, {
                method: 'GET',
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            // 获取文件 blob
            const blob = await response.blob();
            
            // 确定文件名
            const downloadFilename = filename || objectName.split('/').pop() || 'download';
            
            // 创建下载链接
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = downloadFilename;
            link.style.display = 'none';
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            
            // 清理
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            
            console.log('文件下载成功:', downloadFilename);
        } catch (error) {
            console.error('下载文件失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取文件下载 URL（用于直接访问或预览）
     * @param {string} objectName - 文件对象名
     * @param {number} expires - URL 过期时间（秒，默认 3600）
     * @returns {Promise<string>} 下载 URL
     */
    async getDownloadUrl(objectName, expires = 3600) {
        if (!objectName) {
            throw new Error('文件对象名无效');
        }
        
        try {
            const url = `${this.baseUrl}/oss/download-url/${encodeURIComponent(objectName)}?expires=${expires}`;
            const result = await this._request(url, { method: 'GET' });
            
            if (result.code === 200 && result.data && result.data.url) {
                return result.data.url;
            } else {
                throw new Error(result.message || '获取下载 URL 失败');
            }
        } catch (error) {
            console.error('获取下载 URL 失败:', error);
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

