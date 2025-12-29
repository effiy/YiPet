/**
 * API请求API管理器
 * 统一管理API请求相关的后端API调用
 * 使用 https://api.effiy.cn/mongodb/?cname=apiRequests
 */

class ApiRequestApiManager extends BaseApiManager {
    constructor(baseUrl = 'https://api.effiy.cn/mongodb', enabled = true) {
        super(baseUrl, enabled);
        this.cname = 'apiRequests';
    }
    
    /**
     * 获取所有API请求
     * @returns {Promise<Array>} API请求列表
     */
    async getApiRequests() {
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}`;
            const result = await this._request(url, { method: 'GET' });
            
            // 处理响应格式，数据在 result.data.list 里面
            let requests = [];
            if (result && result.data && Array.isArray(result.data.list)) {
                requests = result.data.list;
            } else if (Array.isArray(result)) {
                requests = result;
            } else if (result && Array.isArray(result.data)) {
                requests = result.data;
            } else {
                console.warn('API请求API返回格式异常:', result);
                return [];
            }
            
            // 统一处理ID字段：将 id 转换为 key（如果存在）
            requests = requests.map(req => {
                if (req.id && !req.key) {
                    req.key = req.id;
                }
                if (req._id && !req.key) {
                    req.key = req._id;
                }
                // 确保 tags 字段存在
                if (!req.tags || !Array.isArray(req.tags)) {
                    req.tags = [];
                }
                // 兼容字段名：requestUrl 和 url
                if (req.requestUrl && !req.url) {
                    req.url = req.requestUrl;
                } else if (req.url && !req.requestUrl) {
                    req.requestUrl = req.url;
                }
                return req;
            });
            
            return requests;
        } catch (error) {
            console.warn('获取API请求列表失败:', error.message);
            return [];
        }
    }
    
    /**
     * 获取单个API请求详情
     * @param {string} key - 请求的key
     * @returns {Promise<Object>} API请求详情
     */
    async getApiRequestDetail(key) {
        if (!key) {
            throw new Error('API请求key无效');
        }
        
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}&key=${encodeURIComponent(key)}`;
            const result = await this._request(url, { method: 'GET' });
            
            // 处理不同的响应格式
            let request = null;
            if (result && result.data) {
                request = result.data;
            } else if (result && Array.isArray(result.data) && result.data.length > 0) {
                request = result.data[0];
            } else {
                request = result;
            }
            
            // 统一处理ID字段
            if (request) {
                if (request.id && !request.key) {
                    request.key = request.id;
                }
                if (request._id && !request.key) {
                    request.key = request._id;
                }
                // 确保 tags 字段存在
                if (!request.tags || !Array.isArray(request.tags)) {
                    request.tags = [];
                }
                // 兼容字段名
                if (request.requestUrl && !request.url) {
                    request.url = request.requestUrl;
                } else if (request.url && !request.requestUrl) {
                    request.requestUrl = request.url;
                }
            }
            
            return request;
        } catch (error) {
            console.error('获取API请求详情失败:', error);
            throw error;
        }
    }
    
    /**
     * 保存API请求（创建或更新）
     * @param {Object} requestData - API请求数据
     * @returns {Promise<Object>} 保存结果
     */
    async saveApiRequest(requestData) {
        if (!requestData) {
            throw new Error('API请求数据无效');
        }
        
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}`;
            
            // 如果有key，使用PUT方法更新；否则使用POST方法创建
            const method = requestData.key ? 'PUT' : 'POST';
            
            const result = await this._request(url, {
                method: method,
                body: JSON.stringify(requestData),
            });
            
            // 处理不同的响应格式
            let savedRequest = null;
            if (result.success && result.data) {
                savedRequest = result.data;
            } else if (result.data) {
                savedRequest = result.data;
            } else {
                savedRequest = result;
            }
            
            // 统一处理ID字段
            if (savedRequest) {
                if (savedRequest.id && !savedRequest.key) {
                    savedRequest.key = savedRequest.id;
                }
                if (savedRequest._id && !savedRequest.key) {
                    savedRequest.key = savedRequest._id;
                }
                // 确保 tags 字段存在
                if (!savedRequest.tags || !Array.isArray(savedRequest.tags)) {
                    savedRequest.tags = [];
                }
                // 兼容字段名
                if (savedRequest.requestUrl && !savedRequest.url) {
                    savedRequest.url = savedRequest.requestUrl;
                } else if (savedRequest.url && !savedRequest.requestUrl) {
                    savedRequest.requestUrl = savedRequest.url;
                }
            }
            
            return {
                success: true,
                data: savedRequest
            };
        } catch (error) {
            console.error('保存API请求失败:', error);
            return {
                success: false,
                error: error.message || '保存失败'
            };
        }
    }
    
    /**
     * 删除API请求
     * @param {Object} deleteData - 删除数据 { key: string, url: string }
     * @returns {Promise<Object>} 删除结果
     */
    async deleteApiRequest(deleteData) {
        if (!deleteData || !deleteData.key) {
            throw new Error('API请求key无效');
        }
        
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}&key=${encodeURIComponent(deleteData.key)}`;
            
            const result = await this._request(url, {
                method: 'DELETE',
            });
            
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('删除API请求失败:', error);
            return {
                success: false,
                error: error.message || '删除失败'
            };
        }
    }
    
    /**
     * 批量删除API请求
     * @param {Array<Object>} deleteDataList - 删除数据列表
     * @returns {Promise<Object>} 删除结果
     */
    async batchDeleteApiRequests(deleteDataList) {
        if (!Array.isArray(deleteDataList) || deleteDataList.length === 0) {
            throw new Error('删除数据列表无效');
        }
        
        try {
            const url = `${this.baseUrl}/batch-delete?cname=${this.cname}`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify({
                    keys: deleteDataList.map(item => item.key)
                }),
            });
            
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('批量删除API请求失败:', error);
            return {
                success: false,
                error: error.message || '批量删除失败'
            };
        }
    }
    
    /**
     * 清除GET请求的缓存（用于在添加/更新/删除后刷新列表）
     */
    clearGetCache() {
        const getUrl = `${this.baseUrl}/?cname=${this.cname}`;
        const getRequestKey = this._getRequestKey('GET', getUrl, null);
        if (this.pendingRequests.has(getRequestKey)) {
            this.pendingRequests.delete(getRequestKey);
        }
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = ApiRequestApiManager;
} else {
    window.ApiRequestApiManager = ApiRequestApiManager;
}

