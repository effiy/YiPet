/**
 * OSS API管理器
 * 提供OSS文件相关的API接口
 * 继承自BaseApiManager
 */

class OssApiManager extends BaseApiManager {
    constructor(baseUrl = 'https://api.effiy.cn', enabled = true) {
        super(baseUrl, enabled);
    }
    
    /**
     * 获取文件列表
     * @param {Object} options - 查询选项 { forceRefresh, tags, etc. }
     * @returns {Promise<Array>} 文件列表
     */
    async getFilesList(options = {}) {
        try {
            let url = `${this.baseUrl}/oss/files/`;
            
            // 添加查询参数
            const params = new URLSearchParams();
            if (options.tags && Array.isArray(options.tags) && options.tags.length > 0) {
                params.append('tags', options.tags.join(','));
            }
            if (options.forceRefresh) {
                params.append('forceRefresh', 'true');
            }
            
            const queryString = params.toString();
            if (queryString) {
                url += '?' + queryString;
            }
            
            const result = await this._request(url, { method: 'GET' });
            
            // 兼容不同的返回格式
            if (Array.isArray(result)) {
                return result;
            } else if (result && Array.isArray(result.data)) {
                return result.data;
            } else if (result && result.data && Array.isArray(result.data.list)) {
                return result.data.list;
            } else if (result && result.data && Array.isArray(result.data.files)) {
                return result.data.files;
            } else {
                console.warn('获取OSS文件列表：返回数据格式异常', result);
                return [];
            }
        } catch (error) {
            console.warn('获取OSS文件列表失败:', error.message);
            return [];
        }
    }
    
    /**
     * 上传文件
     * @param {File} file - 要上传的文件
     * @param {string} directory - 目录路径（可选）
     * @returns {Promise<Object>} 上传结果
     */
    async uploadFile(file, directory = '') {
        try {
            const url = `${this.baseUrl}/oss/upload/`;
            
            // 创建FormData
            const formData = new FormData();
            formData.append('file', file);
            if (directory) {
                formData.append('directory', directory);
            }
            
            // 获取Token
            const token = await this._ensureToken();
            const authHeaders = token ? { 'X-Token': token } : {};
            
            // 显示加载动画
            this._showLoadingAnimation();
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: authHeaders,
                    body: formData
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
                
                const result = await response.json();
                return result;
            } finally {
                this._hideLoadingAnimation();
            }
        } catch (error) {
            console.error('上传文件到OSS失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取文件下载URL
     * @param {string} objectName - 对象名称（文件路径）
     * @param {number} expires - 过期时间（秒，默认3600）
     * @returns {Promise<string>} 下载URL
     */
    async getDownloadUrl(objectName, expires = 3600) {
        try {
            const url = `${this.baseUrl}/oss/download/`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify({
                    object_name: objectName,
                    expires: expires
                })
            });
            
            // 兼容不同的返回格式
            if (result && result.data && result.data.url) {
                return result.data.url;
            } else if (result && result.url) {
                return result.url;
            } else if (typeof result === 'string') {
                return result;
            } else {
                throw new Error('获取下载URL失败：返回格式异常');
            }
        } catch (error) {
            console.error('获取OSS文件下载URL失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取文件标签
     * @param {string} objectName - 对象名称（文件路径）
     * @returns {Promise<Array<string>>} 标签列表
     */
    async getFileTags(objectName) {
        try {
            const url = `${this.baseUrl}/oss/files/${encodeURIComponent(objectName)}/tags/`;
            const result = await this._request(url, { method: 'GET' });
            
            // 兼容不同的返回格式
            if (Array.isArray(result)) {
                return result;
            } else if (result && Array.isArray(result.data)) {
                return result.data;
            } else if (result && result.data && Array.isArray(result.data.tags)) {
                return result.data.tags;
            } else if (result && result.tags && Array.isArray(result.tags)) {
                return result.tags;
            } else {
                console.warn('获取文件标签：返回数据格式异常', result);
                return [];
            }
        } catch (error) {
            console.warn('获取OSS文件标签失败:', error.message);
            return [];
        }
    }
    
    /**
     * 设置文件标签
     * @param {string} objectName - 对象名称（文件路径）
     * @param {Array<string>} tags - 标签列表
     * @returns {Promise<Object>} 操作结果
     */
    async setFileTags(objectName, tags) {
        try {
            const url = `${this.baseUrl}/oss/files/${encodeURIComponent(objectName)}/tags/`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify({
                    tags: Array.isArray(tags) ? tags : []
                })
            });
            
            return result;
        } catch (error) {
            console.error('设置OSS文件标签失败:', error);
            throw error;
        }
    }
    
    /**
     * 更新文件信息
     * @param {string} fileName - 文件名
     * @param {Object} info - 文件信息 { title, description, etc. }
     * @returns {Promise<Object>} 操作结果
     */
    async updateFileInfo(fileName, info) {
        try {
            const url = `${this.baseUrl}/oss/files/${encodeURIComponent(fileName)}/info/`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify(info)
            });
            
            return result;
        } catch (error) {
            console.error('更新OSS文件信息失败:', error);
            throw error;
        }
    }
    
    /**
     * 删除文件
     * @param {string} objectName - 对象名称（文件路径）
     * @returns {Promise<Object>} 操作结果
     */
    async deleteFile(objectName) {
        try {
            const url = `${this.baseUrl}/oss/files/${encodeURIComponent(objectName)}/`;
            const result = await this._request(url, {
                method: 'DELETE'
            });
            
            return result;
        } catch (error) {
            console.error('删除OSS文件失败:', error);
            throw error;
        }
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = OssApiManager;
} else {
    window.OssApiManager = OssApiManager;
}

