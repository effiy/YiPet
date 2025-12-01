/**
 * OSS API 管理器
 * 统一管理所有 OSS 相关的后端 API 调用
 * 提供缓存等功能
 */

class OssApiManager {
    constructor(baseUrl, enabled = true) {
        this.baseUrl = baseUrl;
        this.enabled = enabled;
        
        // 请求去重
        this.pendingRequests = new Map(); // 去重用
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
            errorCount: 0,
        };
        
        // 加载动画计数器
        this.activeRequestCount = 0;
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
     * 显示加载动画
     */
    _showLoadingAnimation() {
        this.activeRequestCount++;
        if (this.activeRequestCount === 1 && typeof window !== 'undefined' && window.petLoadingAnimation) {
            window.petLoadingAnimation.show();
        }
    }
    
    /**
     * 隐藏加载动画
     */
    _hideLoadingAnimation() {
        this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);
        if (this.activeRequestCount === 0 && typeof window !== 'undefined' && window.petLoadingAnimation) {
            window.petLoadingAnimation.hide();
        }
    }
    
    /**
     * 执行请求（带去重）
     */
    async _request(url, options = {}) {
        if (!this.isEnabled()) {
            throw new Error('API管理器未启用');
        }
        
        const requestKey = this._getRequestKey(options.method || 'GET', url, options.body);
        
        // 检查是否有正在进行的相同请求
        if (this.pendingRequests.has(requestKey)) {
            return await this.pendingRequests.get(requestKey);
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
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
                
                // 隐藏加载动画
                this._hideLoadingAnimation();
                
                return result;
            } catch (error) {
                // 从pending中移除
                this.pendingRequests.delete(requestKey);
                
                // 隐藏加载动画
                this._hideLoadingAnimation();
                
                this.stats.errorCount++;
                throw error;
            }
        })();
        
        // 保存到pending中
        this.pendingRequests.set(requestKey, requestPromise);
        
        return requestPromise;
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
     * @returns {Promise<Array>} 文件列表
     */
    async getFilesList(options = {}) {
        const { directory = '', max_keys = 100, tags = null } = options;
        
        try {
            let url = `${this.baseUrl}/oss/files`;
            const params = [];
            if (directory) {
                params.push(`directory=${encodeURIComponent(directory)}`);
            }
            if (tags && Array.isArray(tags) && tags.length > 0) {
                params.push(`tags=${encodeURIComponent(tags.join(','))}`);
            }
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }
            
            const result = await this._request(url, { method: 'GET' });
            
            if (result.code === 200 && Array.isArray(result.data)) {
                return result.data;
            } else {
                throw new Error(result.message || '返回数据格式错误');
            }
        } catch (error) {
            console.warn('获取文件列表失败:', error.message);
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

