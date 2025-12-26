/**
 * FAQ API 管理器
 * 统一管理常见问题的后端API调用
 * 使用 https://api.effiy.cn/mongodb/?cname=faqs
 */

class FaqApiManager extends BaseApiManager {
    constructor(baseUrl = 'https://api.effiy.cn/mongodb', enabled = true) {
        super(baseUrl, enabled);
        this.cname = 'faqs';
    }
    
    /**
     * 获取所有常见问题
     * @returns {Promise<Array>} FAQ列表（按order字段排序）
     */
    async getFaqs() {
        try {
            // 添加排序参数，按order字段升序排序
            const url = `${this.baseUrl}/?cname=${this.cname}&orderBy=order&orderType=asc`;
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
            faqs = faqs.map(faq => {
                if (faq.id && !faq._id) {
                    faq._id = faq.id;
                }
                // 确保 tags 字段存在
                if (!faq.tags || !Array.isArray(faq.tags)) {
                    faq.tags = [];
                }
                return faq;
            });
            
            // 确保按order字段排序（双重保险）
            faqs.sort((a, b) => {
                const orderA = a.order !== undefined && a.order !== null ? a.order : 999999;
                const orderB = b.order !== undefined && b.order !== null ? b.order : 999999;
                return orderA - orderB;
            });
            
            return faqs;
        } catch (error) {
            console.warn('获取常见问题列表失败:', error.message);
            return [];
        }
    }
    
    /**
     * 创建常见问题
     * @param {Object} faqData - FAQ数据 { text: string, tags: Array<string>, order: number }
     * @returns {Promise<Object>} 创建的FAQ对象
     */
    async createFaq(faqData) {
        if (!faqData || !faqData.text) {
            throw new Error('FAQ数据无效：缺少text字段');
        }
        
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}`;
            const requestBody = {
                text: faqData.text,
                tags: faqData.tags || [],
            };
            // 如果提供了order字段，添加到请求体中
            if (faqData.order !== undefined && faqData.order !== null) {
                requestBody.order = faqData.order;
            }
            
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify(requestBody),
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
            // 如果返回的FAQ没有order字段，但请求中有，则设置它
            if (faq && (faq.order === undefined || faq.order === null) && faqData.order !== undefined && faqData.order !== null) {
                faq.order = faqData.order;
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
     * 批量更新常见问题排序
     * @param {Array<Object>} orders - 排序数据数组，每个项包含 { key: string, order: number }
     * @returns {Promise<Object>} 更新结果
     */
    async batchUpdateOrder(orders) {
        if (!Array.isArray(orders)) {
            throw new Error('排序数据必须是数组');
        }
        
        try {
            const url = `${this.baseUrl}/batch-order?cname=${this.cname}`;
            const result = await this._request(url, {
                method: 'PUT',
                body: JSON.stringify({
                    orders: orders,
                }),
            });
            
            return result;
        } catch (error) {
            console.error('批量更新排序失败:', error);
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
    
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = FaqApiManager;
} else {
    window.FaqApiManager = FaqApiManager;
}





