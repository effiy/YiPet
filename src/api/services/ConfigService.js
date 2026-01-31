/**
 * 配置服务
 * 提供系统配置相关的API操作
 */

import { ApiManager } from '../core/ApiManager.js';
import { CONFIG_ENDPOINTS } from '../constants/endpoints.js';

export class ConfigService extends ApiManager {
    constructor(baseUrl, options = {}) {
        super(baseUrl, {
            ...options,
            logger: {
                ...options.logger,
                prefix: '[ConfigService]'
            }
        });
        
        // 配置缓存
        this.configCache = null;
        this.configExpiry = 0;
        this.cacheDuration = options.cacheDuration || 60 * 1000; // 1分钟
    }
    
    /**
     * 获取配置
     */
    async getConfig(options = {}) {
        // 检查缓存
        if (this.configCache && Date.now() < this.configExpiry && !options.forceRefresh) {
            return this.configCache;
        }
        
        try {
            const config = await this.get(CONFIG_ENDPOINTS.GET);
            
            // 缓存配置
            this.configCache = config;
            this.configExpiry = Date.now() + this.cacheDuration;
            
            return config;
        } catch (error) {
            this.logger.error('获取配置失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 更新配置
     */
    async updateConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('配置数据无效');
        }
        
        try {
            const result = await this.post(CONFIG_ENDPOINTS.UPDATE, config);
            
            // 清除缓存
            this.clearCache();
            
            return result;
        } catch (error) {
            this.logger.error('更新配置失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 重置配置
     */
    async resetConfig() {
        try {
            const result = await this.post(CONFIG_ENDPOINTS.RESET);
            
            // 清除缓存
            this.clearCache();
            
            return result;
        } catch (error) {
            this.logger.error('重置配置失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 获取特定配置项
     */
    async getConfigItem(key, defaultValue = null) {
        try {
            const config = await this.getConfig();
            return config && config[key] !== undefined ? config[key] : defaultValue;
        } catch (error) {
            return defaultValue;
        }
    }
    
    /**
     * 更新特定配置项
     */
    async updateConfigItem(key, value) {
        if (!key) {
            throw new Error('配置项键不能为空');
        }
        
        try {
            // 获取当前配置
            const currentConfig = await this.getConfig();
            
            // 更新特定项
            const newConfig = {
                ...currentConfig,
                [key]: value
            };
            
            // 保存新配置
            return await this.updateConfig(newConfig);
        } catch (error) {
            this.logger.error('更新配置项失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 批量更新配置项
     */
    async updateConfigItems(items) {
        if (!items || typeof items !== 'object') {
            throw new Error('配置项数据无效');
        }
        
        try {
            // 获取当前配置
            const currentConfig = await this.getConfig();
            
            // 合并配置
            const newConfig = {
                ...currentConfig,
                ...items
            };
            
            // 保存新配置
            return await this.updateConfig(newConfig);
        } catch (error) {
            this.logger.error('批量更新配置项失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        this.configCache = null;
        this.configExpiry = 0;
    }
    
    /**
     * 获取配置缓存（同步）
     */
    getConfigSync() {
        if (this.configCache && Date.now() < this.configExpiry) {
            return this.configCache;
        }
        
        return null;
    }
}