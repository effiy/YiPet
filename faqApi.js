/**
 * FAQ API 管理器
 * 统一管理常见问题的后端API调用
 * 使用 https://api.effiy.cn/mongodb/?cname=faqs
 */

class FaqApiManager {
    constructor(baseUrl = 'https://api.effiy.cn/mongodb', enabled = true) {
        this.baseUrl = baseUrl;
        this.enabled = enabled;
        this.cname = 'faqs';
        
        // 请求去重
        this.pendingRequests = new Map();
        
        // 重试配置
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000, // 1秒
        };
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
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
            throw new Error('FAQ API管理器未启用');
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
                    console.warn(`FAQ API请求失败，${this.retryConfig.retryDelay}ms后重试 (${retryCount + 1}/${this.retryConfig.maxRetries}):`, error.message);
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
     * 获取所有常见问题
     * @returns {Promise<Array>} FAQ列表
     */
    async getFaqs() {
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}`;
            const result = await this._request(url, { method: 'GET' });
            
            // 处理响应格式，数据在 result.data.list 里面
            let faqs = [];
            if (result && result.data && Array.isArray(result.data.list)) {
                faqs = result.data.list;
            } else {
                console.warn('FAQ API返回格式异常:', result);
                return [];
            }
            
            // 统一处理ID字段：将 id 转换为 _id（如果存在）
            return faqs.map(faq => {
                if (faq.id && !faq._id) {
                    faq._id = faq.id;
                }
                // 确保 tags 字段存在
                if (!faq.tags || !Array.isArray(faq.tags)) {
                    faq.tags = [];
                }
                return faq;
            });
        } catch (error) {
            console.warn('获取常见问题列表失败:', error.message);
            return [];
        }
    }
    
    /**
     * 创建常见问题
     * @param {Object} faqData - FAQ数据 { text: string, tags: Array<string> }
     * @returns {Promise<Object>} 创建的FAQ对象
     */
    async createFaq(faqData) {
        if (!faqData || !faqData.text) {
            throw new Error('FAQ数据无效：缺少text字段');
        }
        
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify({
                    text: faqData.text,
                    tags: faqData.tags || [],
                }),
            });
            
            // 处理不同的响应格式
            let faq = null;
            if (result.success && result.data) {
                faq = result.data;
            } else if (result.data) {
                faq = result.data;
            } else {
                faq = result;
            }
            
            // 统一处理ID字段：将 id 转换为 _id（如果存在）
            if (faq && faq.id && !faq._id) {
                faq._id = faq.id;
            }
            // 确保 tags 字段存在
            if (faq && (!faq.tags || !Array.isArray(faq.tags))) {
                faq.tags = [];
            }
            
            return faq;
        } catch (error) {
            console.error('创建常见问题失败:', error);
            throw error;
        }
    }
    
    /**
     * 更新常见问题
     * @param {string} key - FAQ key（text，优先使用）
     * @param {Object} faqData - FAQ数据 { text: string, tags: Array<string> }
     * @returns {Promise<Object>} 更新后的FAQ对象
     */
    async updateFaq(key, faqData) {
        if (!key) {
            throw new Error('FAQ key无效');
        }
        
        if (!faqData || !faqData.text) {
            throw new Error('FAQ数据无效：缺少text字段');
        }
        
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}`;
            
            const result = await this._request(url, {
                method: 'PUT',
                body: JSON.stringify({
                    key: key,
                    text: faqData.text,
                    tags: faqData.tags || [],
                }),
            });
            
            // 处理不同的响应格式
            let faq = null;
            if (result.success && result.data) {
                faq = result.data;
            } else if (result.data) {
                faq = result.data;
            } else {
                faq = result;
            }
            
            // 统一处理ID字段：将 id 转换为 _id（如果存在）
            if (faq && faq.id && !faq._id) {
                faq._id = faq.id;
            }
            // 确保 tags 字段存在
            if (faq && (!faq.tags || !Array.isArray(faq.tags))) {
                faq.tags = [];
            }
            
            return faq;
        } catch (error) {
            console.error('更新常见问题失败:', error);
            throw error;
        }
    }
    
    /**
     * 删除常见问题
     * @param {string} key - FAQ key（text）
     * @returns {Promise<Object>} 删除结果
     */
    async deleteFaq(key) {
        if (!key) {
            throw new Error('FAQ key无效');
        }
        
        try {
            // 使用key作为参数
            const url = `${this.baseUrl}/?cname=${this.cname}&key=${encodeURIComponent(key)}`;
            
            const result = await this._request(url, {
                method: 'DELETE',
            });
            
            return result;
        } catch (error) {
            console.error('删除常见问题失败:', error);
            throw error;
        }
    }
    
    /**
     * 批量保存常见问题（用于同步整个列表）
     * @param {Array<Object>} faqs - FAQ列表
     * @returns {Promise<Object>} 保存结果
     */
    async saveFaqs(faqs) {
        if (!Array.isArray(faqs)) {
            throw new Error('FAQ列表必须是数组');
        }
        
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'batch',
                    data: faqs,
                }),
            });
            
            return result;
        } catch (error) {
            console.error('批量保存常见问题失败:', error);
            throw error;
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
    module.exports = FaqApiManager;
} else {
    window.FaqApiManager = FaqApiManager;
}

