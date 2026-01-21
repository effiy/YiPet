/**
 * FAQ API 管理器
 * 统一管理常见问题的后端API调用
 * 使用 PET_CONFIG.api.faqApiUrl 配置，默认为 http://localhost:8000/?cname=faqs
 */

class FaqApiManager extends BaseApiManager {
    constructor(baseUrl = 'http://localhost:8000', enabled = true) {
        super(baseUrl, enabled);
        this.cname = 'faqs';
    }

    /**
     * 构建通用API URL
     * @param {string} methodName - 方法名
     * @param {Object} parameters - 参数
     * @returns {string} 构建好的URL
     */
    _buildGenericApiUrl(methodName, parameters) {
        const queryParams = new URLSearchParams({
            module_name: 'services.database.data_service',
            method_name: methodName,
            parameters: JSON.stringify(parameters)
        });
        return `${this.baseUrl}/?${queryParams.toString()}`;
    }
    
    /**
     * 获取所有常见问题
     * @returns {Promise<Array>} FAQ列表（按order字段排序）
     */
    async getFaqs() {
        try {
            const params = {
                cname: this.cname,
                sort: { order: 1 }
            };
            const url = this._buildGenericApiUrl('query_documents', params);
            const result = await this._request(url, { method: 'GET' });
            
            let faqs = [];
            // 兼容不同的返回格式 (参考 SessionApiManager)
            if (Array.isArray(result)) {
                faqs = result;
            } else if (result && Array.isArray(result.data)) {
                faqs = result.data;
            } else if (result && result.data && Array.isArray(result.data.documents)) {
                faqs = result.data.documents;
            } else if (result && result.data && result.data.list && Array.isArray(result.data.list)) {
                faqs = result.data.list;
            } else if (result && Array.isArray(result.documents)) {
                faqs = result.documents;
            } else if (result && result.documents && result.documents.list && Array.isArray(result.documents.list)) {
                faqs = result.documents.list;
            } else if (result && result.result && Array.isArray(result.result)) {
                faqs = result.result;
            } else if (result && result.data && result.data.result && Array.isArray(result.data.result)) {
                faqs = result.data.result;
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
            
            return faqs;
        } catch (error) {
            console.warn('获取常见问题列表失败:', error.message);
            return [];
        }
    }
    
    /**
     * 创建常见问题
     * @param {Object} faqData - FAQ数据 
     *   支持格式1: { text: string, tags: Array<string>, order: number } - 兼容旧格式
     *   支持格式2: { key: string, title: string, prompt: string, tags: Array<string> } - 新格式（参考 YiWeb）
     * @returns {Promise<Object>} 创建的FAQ对象
     */
    async createFaq(faqData) {
        if (!faqData) {
            throw new Error('FAQ数据无效');
        }
        
        try {
            let data = {};
            
            // 如果提供了text字段（兼容旧格式），解析为title和prompt
            if (faqData.text) {
                const lines = String(faqData.text).split('\n');
                const title = String(lines[0] || '').trim();
                const prompt = String(lines.slice(1).join('\n') || '').trim();
                
                data = {
                    key: faqData.key || `faq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    title: faqData.title || title || (prompt ? prompt.slice(0, 40) : '常见问题'),
                    prompt: faqData.prompt || prompt,
                    tags: faqData.tags || []
                };
            } else if (faqData.title || faqData.prompt) {
                // 新格式：直接使用title和prompt
                data = {
                    key: faqData.key || `faq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    title: faqData.title || (faqData.prompt ? faqData.prompt.slice(0, 40) : '常见问题'),
                    prompt: faqData.prompt || '',
                    tags: faqData.tags || []
                };
            } else {
                throw new Error('FAQ数据无效：缺少text、title或prompt字段');
            }
            
            // 如果提供了order字段，添加到data中
            if (faqData.order !== undefined && faqData.order !== null) {
                data.order = faqData.order;
            }
            
            // 使用 create_document（单数）和 data 参数（参考 YiWeb 实现）
            const payload = {
                module_name: 'services.database.data_service',
                method_name: 'create_document',
                parameters: {
                    cname: this.cname,
                    data: data
                }
            };
            
            const url = `${this.baseUrl}/`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            let faq = null;
            if (result.success && result.data) {
                faq = result.data;
            } else if (result.data) {
                faq = result.data;
            } else {
                faq = result;
            }
            
            if (faq && faq.id && !faq._id) {
                faq._id = faq.id;
            }
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
     * @param {string} key - FAQ key
     * @param {Object} patch - 要更新的字段 { title?: string, prompt?: string, tags?: Array<string>, order?: number }
     * @returns {Promise<Object>} 更新后的FAQ对象
     */
    async updateFaq(key, patch) {
        if (!key) {
            throw new Error('FAQ key无效');
        }
        
        if (!patch || typeof patch !== 'object') {
            throw new Error('更新数据无效');
        }
        
        try {
            // 使用 update_document（单数）和 data 参数（参考 YiWeb 实现）
            // data 中必须包含 key 以通过校验，同时包含要更新的字段
            const payload = {
                module_name: 'services.database.data_service',
                method_name: 'update_document',
                parameters: {
                    cname: this.cname,
                    data: {
                        key: key,
                        ...patch
                    }
                }
            };
            
            const url = `${this.baseUrl}/`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            return result;
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
            // 使用 delete_document（单数）和 key 参数（参考 YiWeb 实现）
            const payload = {
                module_name: 'services.database.data_service',
                method_name: 'delete_document',
                parameters: {
                    cname: this.cname,
                    key: key
                }
            };
            
            const url = `${this.baseUrl}/`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify(payload)
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
        
        // 这里的实现比较复杂，因为新API可能不支持直接"替换所有"。
        // 暂时保留旧实现或抛出未实现，或者尝试使用 insert_documents (plural)
        // 假设有一个 batch_insert_documents 或 insert_documents
        // 为了安全起见，先警告。
        console.warn('saveFaqs: 批量保存功能在新API中可能需要调整。尝试使用 insert_documents');

        try {
            const params = {
                cname: this.cname,
                documents: faqs
            };
            const url = this._buildGenericApiUrl('insert_documents', params);
            const result = await this._request(url, { method: 'POST' });
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
            // 并行执行更新
            const promises = orders.map(item => {
                const params = {
                    cname: this.cname,
                    filter: { text: item.key },
                    update: { '$set': { order: item.order } }
                };
                const url = this._buildGenericApiUrl('update_documents', params);
                return this._request(url, { method: 'POST' });
            });
            
            const results = await Promise.all(promises);
            return results;
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

