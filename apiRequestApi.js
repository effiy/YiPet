/**
 * 请求接口 API 管理器
 * 统一管理请求接口的后端API调用
 * 使用 https://api.effiy.cn/mongodb/?cname=apis
 */

class ApiRequestApiManager extends BaseApiManager {
    constructor(baseUrl = 'https://api.effiy.cn/mongodb', enabled = true) {
        super(baseUrl, enabled);
        this.cname = 'apis';
    }
    
    /**
     * 保存请求接口（创建或更新）
     * @param {Object} apiRequestData - 请求接口数据
     * @returns {Promise<Object>} 保存结果
     */
    async saveApiRequest(apiRequestData) {
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}`;
            
            // 如果有key，使用PUT更新；否则使用POST创建
            const method = apiRequestData.key ? 'PUT' : 'POST';
            
            const result = await this._request(url, {
                method: method,
                body: JSON.stringify(apiRequestData),
            });
            
            // 处理响应格式
            if (result.code === 200) {
                // 保存成功后，调用刷新接口刷新请求接口列表
                try {
                    await this.getApiRequests();
                } catch (refreshError) {
                    // 刷新失败不影响保存操作，静默处理
                    console.debug('刷新请求接口列表失败:', refreshError.message);
                }
                
                return {
                    success: true,
                    data: result.data || apiRequestData
                };
            } else {
                throw new Error(result.msg || result.message || '保存失败');
            }
        } catch (error) {
            console.warn('保存请求接口失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 删除请求接口
     * @param {Object} apiRequestData - 请求接口数据（需要包含key或url）
     * @returns {Promise<Object>} 删除结果
     */
    async deleteApiRequest(apiRequestData) {
        try {
            const key = apiRequestData.key;
            const url = apiRequestData.url;
            
            if (!key && !url) {
                throw new Error('请求接口缺少key或url字段，无法删除');
            }
            
            let apiUrl = `${this.baseUrl}/?cname=${this.cname}`;
            if (key) {
                apiUrl += `&key=${encodeURIComponent(key)}`;
            } else if (url) {
                apiUrl += `&url=${encodeURIComponent(url)}`;
            }
            
            const result = await this._request(apiUrl, {
                method: 'DELETE',
            });
            
            // 处理响应格式
            if (result.code === 200 || result.status === 200 || result.success === true) {
                return {
                    success: true,
                    data: result.data
                };
            } else {
                throw new Error(result.msg || result.message || '删除失败');
            }
        } catch (error) {
            console.warn('删除请求接口失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 获取所有请求接口
     * @returns {Promise<Array>} 请求接口列表
     */
    async getApiRequests() {
        try {
            // 默认只拉取“列表所需”的轻量字段，避免一次性传输 responseText/responseBody 等大字段
            // 需要详情时通过 getApiRequestDetail() 单条拉取
            const excludeFields = encodeURIComponent('headers,body,responseHeaders,responseText,responseBody,curl');
            const url = `${this.baseUrl}/?cname=${this.cname}&pageNum=1&pageSize=200&orderBy=timestamp&orderType=desc&excludeFields=${excludeFields}`;
            const result = await this._request(url, { method: 'GET' });
            
            // 处理响应格式，数据在 result.data.list 里面
            let apiRequests = [];
            if (result && result.data && Array.isArray(result.data.list)) {
                apiRequests = result.data.list;
            } else if (Array.isArray(result)) {
                apiRequests = result;
            } else {
                console.warn('请求接口 API返回格式异常:', result);
                return [];
            }
            
            // 统一处理ID字段：将 id 转换为 _id（如果存在）
            return apiRequests.map(apiRequest => {
                if (apiRequest.id && !apiRequest._id) {
                    apiRequest._id = apiRequest.id;
                }
                // 确保 tags 字段存在
                if (!apiRequest.tags || !Array.isArray(apiRequest.tags)) {
                    apiRequest.tags = [];
                }
                // 标记为轻量列表数据（展开时可按需拉取详情）
                apiRequest._lite = true;
                return apiRequest;
            });
        } catch (error) {
            console.warn('获取请求接口列表失败:', error.message);
            return [];
        }
    }

    /**
     * 获取单条请求接口详情（完整字段）
     * @param {string} key - 请求接口 key（优先使用 key）
     * @returns {Promise<Object|null>}
     */
    async getApiRequestDetail(key) {
        if (!key) return null;
        try {
            const url = `${this.baseUrl}/detail?cname=${this.cname}&id=${encodeURIComponent(key)}`;
            const result = await this._request(url, { method: 'GET' });

            // 兼容后端返回格式：RespOk -> {data:{...}} / 直接对象
            if (result && result.data) {
                return result.data;
            }
            return result || null;
        } catch (error) {
            console.warn('获取请求接口详情失败:', error.message);
            return null;
        }
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = ApiRequestApiManager;
} else {
    window.ApiRequestApiManager = ApiRequestApiManager;
}





