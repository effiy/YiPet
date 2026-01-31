/**
 * FAQ服务
 * 提供常见问题相关的API操作
 */

import { ApiManager } from '../core/ApiManager.js';
import { DATABASE_ENDPOINTS, buildDatabaseUrl } from '../constants/endpoints.js';

export class FaqService extends ApiManager {
    constructor(baseUrl, options = {}) {
        super(baseUrl, {
            ...options,
            logger: {
                ...options.logger,
                prefix: '[FaqService]'
            }
        });
        
        this.cname = 'faqs';
    }
    
    /**
     * 获取所有常见问题
     */
    async getFaqs(options = {}) {
        try {
            const params = {
                cname: this.cname,
                sort: { order: 1 },
                ...options.filter
            };
            
            const url = buildDatabaseUrl(this.baseUrl, 'query_documents', params);
            const result = await this.get(url);
            
            let faqs = result && Array.isArray(result.list) ? result.list : [];
            
            // 统一处理ID字段
            faqs = faqs.map(faq => this._normalizeFaqData(faq));
            
            return faqs;
        } catch (error) {
            this.logger.warn('获取常见问题列表失败:', error.message);
            return [];
        }
    }
    
    /**
     * 创建常见问题
     */
    async createFaq(faqData) {
        if (!faqData) {
            throw new Error('FAQ数据无效');
        }
        
        try {
            const data = this._normalizeFaqData(faqData);
            
            if (!data.title && !data.prompt) {
                throw new Error('FAQ数据无效：缺少 title 或 prompt 字段');
            }
            
            const payload = {
                module_name: 'services.database.data_service',
                method_name: 'create_document',
                parameters: {
                    cname: this.cname,
                    data: data
                }
            };
            
            const result = await this.post('/', payload);
            
            return this._normalizeFaqData(result);
        } catch (error) {
            this.logger.error('创建常见问题失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 更新常见问题
     */
    async updateFaq(key, patch) {
        if (!key) {
            throw new Error('FAQ key无效');
        }
        
        if (!patch || typeof patch !== 'object') {
            throw new Error('更新数据无效');
        }
        
        try {
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
            
            const result = await this.post('/', payload);
            
            return result;
        } catch (error) {
            this.logger.error('更新常见问题失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 删除常见问题
     */
    async deleteFaq(key) {
        if (!key) {
            throw new Error('FAQ key无效');
        }
        
        try {
            const payload = {
                module_name: 'services.database.data_service',
                method_name: 'delete_document',
                parameters: {
                    cname: this.cname,
                    key: key
                }
            };
            
            const result = await this.post('/', payload);
            
            return result;
        } catch (error) {
            this.logger.error('删除常见问题失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 批量保存常见问题
     */
    async saveFaqs(faqs) {
        if (!Array.isArray(faqs)) {
            throw new Error('FAQ列表必须是数组');
        }
        
        try {
            const params = {
                cname: this.cname,
                documents: faqs.map(faq => this._normalizeFaqData(faq))
            };
            
            const url = buildDatabaseUrl(this.baseUrl, 'insert_documents', params);
            const result = await this.post(url);
            
            return result;
        } catch (error) {
            this.logger.error('批量保存常见问题失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 批量更新排序
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
                    filter: { key: item.key },
                    update: { '$set': { order: item.order } }
                };
                
                const url = buildDatabaseUrl(this.baseUrl, 'update_documents', params);
                return this.post(url);
            });
            
            const results = await Promise.all(promises);
            
            return results;
        } catch (error) {
            this.logger.error('批量更新排序失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 按标签筛选FAQ
     */
    async getFaqsByTags(tags, options = {}) {
        if (!Array.isArray(tags) || tags.length === 0) {
            return [];
        }
        
        try {
            const params = {
                cname: this.cname,
                filter: {
                    tags: { '$in': tags }
                },
                sort: { order: 1 },
                ...options.filter
            };
            
            const url = buildDatabaseUrl(this.baseUrl, 'query_documents', params);
            const result = await this.get(url);
            
            let faqs = result && Array.isArray(result.list) ? result.list : [];
            
            return faqs.map(faq => this._normalizeFaqData(faq));
        } catch (error) {
            this.logger.warn('按标签获取FAQ失败:', error.message);
            return [];
        }
    }
    
    /**
     * 搜索FAQ
     */
    async searchFaqs(query, options = {}) {
        if (!query) {
            return [];
        }
        
        try {
            const params = {
                cname: this.cname,
                filter: {
                    '$or': [
                        { 'title': { '$regex': query, '$options': 'i' } },
                        { 'prompt': { '$regex': query, '$options': 'i' } }
                    ]
                },
                sort: { order: 1 },
                limit: options.limit || 20,
                ...options.filter
            };
            
            const url = buildDatabaseUrl(this.baseUrl, 'query_documents', params);
            const result = await this.get(url);
            
            let faqs = result && Array.isArray(result.list) ? result.list : [];
            
            return faqs.map(faq => this._normalizeFaqData(faq));
        } catch (error) {
            this.logger.warn('搜索FAQ失败:', error.message);
            return [];
        }
    }
    
    /**
     * 获取所有标签
     */
    async getAllTags() {
        try {
            const faqs = await this.getFaqs();
            const tagsSet = new Set();
            
            faqs.forEach(faq => {
                if (faq.tags && Array.isArray(faq.tags)) {
                    faq.tags.forEach(tag => tagsSet.add(tag));
                }
            });
            
            return Array.from(tagsSet).sort();
        } catch (error) {
            this.logger.warn('获取所有标签失败:', error.message);
            return [];
        }
    }
    
    /**
     * 规范化FAQ数据
     */
    _normalizeFaqData(faqData) {
        const normalized = {
            key: faqData.key || `faq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: String(faqData.title || ''),
            prompt: String(faqData.prompt || ''),
            tags: Array.isArray(faqData.tags) ? faqData.tags : [],
            order: faqData.order !== undefined ? Number(faqData.order) : 0
        };
        
        // 自动生成标题
        if (!normalized.title && normalized.prompt) {
            normalized.title = normalized.prompt.slice(0, 40);
        }
        
        // 统一ID字段
        if (faqData.id && !faqData._id) {
            normalized._id = faqData.id;
        }
        
        return normalized;
    }
}