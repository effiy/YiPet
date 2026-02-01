/**
 * Module Manager
 * 模块管理器
 */

import { EventEmitter } from '../shared/utils/events/EventEmitter.js';
import { Logger } from '../shared/utils/logging/Logger.js';

/**
 * 模块管理器类
 */
export class ModuleManager extends EventEmitter {
    constructor(app) {
        super();
        this.app = app;
        this.logger = new Logger('ModuleManager');
        this.modules = new Map();
    }
    
    /**
     * 初始化模块管理器
     */
    async init() {
        this.logger.info('初始化模块管理器...');
        
        // 设置全局模块管理器
        window.YiPetModuleManager = this;
        
        this.logger.info('模块管理器初始化完成');
    }
    
    /**
     * 注册模块
     */
    async registerModule(moduleName, moduleInstance, options = {}) {
        if (this.modules.has(moduleName)) {
            throw new Error(`模块已存在: ${moduleName}`);
        }
        
        try {
            this.logger.info(`注册模块: ${moduleName}`);
            
            const moduleInfo = {
                name: moduleName,
                instance: moduleInstance,
                options,
                loaded: false,
                started: false,
                dependencies: options.dependencies || [],
                provides: options.provides || [],
                priority: options.priority || 0
            };
            
            // 检查依赖
            await this.checkDependencies(moduleInfo);
            
            // 注册模块
            this.modules.set(moduleName, moduleInfo);
            
            this.emit('module:registered', moduleName, moduleInfo);
            
            this.logger.info(`模块注册成功: ${moduleName}`);
            
        } catch (error) {
            this.logger.error(`模块注册失败: ${moduleName}`, error);
            throw error;
        }
    }
    
    /**
     * 卸载模块
     */
    async unregisterModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        
        if (!moduleInfo) {
            this.logger.warn(`模块未找到: ${moduleName}`);
            return;
        }
        
        try {
            this.logger.info(`卸载模块: ${moduleName}`);
            
            // 停止模块（如果正在运行）
            if (moduleInfo.started) {
                await this.stopModule(moduleName);
            }
            
            // 检查依赖此模块的其他模块
            const dependentModules = this.getDependentModules(moduleName);
            if (dependentModules.length > 0) {
                this.logger.warn(`模块 ${moduleName} 被其他模块依赖: ${dependentModules.join(', ')}`);
            }
            
            // 从模块列表中移除
            this.modules.delete(moduleName);
            
            this.emit('module:unregistered', moduleName);
            
            this.logger.info(`模块卸载成功: ${moduleName}`);
            
        } catch (error) {
            this.logger.error(`模块卸载失败: ${moduleName}`, error);
            throw error;
        }
    }
    
    /**
     * 启动模块
     */
    async startModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        
        if (!moduleInfo) {
            throw new Error(`模块未找到: ${moduleName}`);
        }
        
        if (moduleInfo.started) {
            this.logger.warn(`模块已经启动: ${moduleName}`);
            return;
        }
        
        try {
            this.logger.info(`启动模块: ${moduleName}`);
            
            // 检查依赖
            await this.checkDependencies(moduleInfo);
            
            // 启动依赖模块
            for (const dependency of moduleInfo.dependencies) {
                if (this.modules.has(dependency) && !this.isModuleStarted(dependency)) {
                    await this.startModule(dependency);
                }
            }
            
            // 启动模块
            if (moduleInfo.instance.start) {
                await moduleInfo.instance.start();
            }
            
            moduleInfo.started = true;
            
            this.emit('module:started', moduleName);
            
            this.logger.info(`模块启动成功: ${moduleName}`);
            
        } catch (error) {
            this.logger.error(`模块启动失败: ${moduleName}`, error);
            throw error;
        }
    }
    
    /**
     * 停止模块
     */
    async stopModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        
        if (!moduleInfo) {
            this.logger.warn(`模块未找到: ${moduleName}`);
            return;
        }
        
        if (!moduleInfo.started) {
            this.logger.warn(`模块未启动: ${moduleName}`);
            return;
        }
        
        try {
            this.logger.info(`停止模块: ${moduleName}`);
            
            // 停止依赖此模块的其他模块
            const dependentModules = this.getDependentModules(moduleName);
            for (const dependentModule of dependentModules) {
                if (this.isModuleStarted(dependentModule)) {
                    await this.stopModule(dependentModule);
                }
            }
            
            // 停止模块
            if (moduleInfo.instance.stop) {
                await moduleInfo.instance.stop();
            }
            
            moduleInfo.started = false;
            
            this.emit('module:stopped', moduleName);
            
            this.logger.info(`模块停止成功: ${moduleName}`);
            
        } catch (error) {
            this.logger.error(`模块停止失败: ${moduleName}`, error);
            throw error;
        }
    }
    
    /**
     * 启动所有模块
     */
    async startAll() {
        this.logger.info('启动所有模块...');
        
        // 按优先级排序
        const sortedModules = this.getSortedModules();
        
        for (const moduleName of sortedModules) {
            try {
                await this.startModule(moduleName);
            } catch (error) {
                this.logger.error(`启动模块失败: ${moduleName}`, error);
                throw error;
            }
        }
        
        this.logger.info('所有模块启动完成');
    }
    
    /**
     * 停止所有模块
     */
    async stopAll() {
        this.logger.info('停止所有模块...');
        
        // 按依赖关系逆序停止
        const sortedModules = this.getSortedModules().reverse();
        
        for (const moduleName of sortedModules) {
            try {
                await this.stopModule(moduleName);
            } catch (error) {
                this.logger.error(`停止模块失败: ${moduleName}`, error);
            }
        }
        
        this.logger.info('所有模块停止完成');
    }
    
    /**
     * 重新启动模块
     */
    async restartModule(moduleName) {
        await this.stopModule(moduleName);
        await this.startModule(moduleName);
    }
    
    /**
     * 重新启动所有模块
     */
    async restartAll() {
        await this.stopAll();
        await this.startAll();
    }
    
    /**
     * 获取模块
     */
    getModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        return moduleInfo ? moduleInfo.instance : null;
    }
    
    /**
     * 获取模块信息
     */
    getModuleInfo(moduleName) {
        return this.modules.get(moduleName);
    }
    
    /**
     * 获取所有模块
     */
    getAllModules() {
        return Array.from(this.modules.keys());
    }
    
    /**
     * 获取已启动的模块
     */
    getStartedModules() {
        return Array.from(this.modules.entries())
            .filter(([_, moduleInfo]) => moduleInfo.started)
            .map(([name, _]) => name);
    }
    
    /**
     * 获取已注册的模块
     */
    getRegisteredModules() {
        return Array.from(this.modules.entries())
            .filter(([_, moduleInfo]) => moduleInfo.loaded)
            .map(([name, _]) => name);
    }
    
    /**
     * 检查模块是否存在
     */
    hasModule(moduleName) {
        return this.modules.has(moduleName);
    }
    
    /**
     * 检查模块是否已启动
     */
    isModuleStarted(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        return moduleInfo ? moduleInfo.started : false;
    }
    
    /**
     * 检查模块是否已注册
     */
    isModuleRegistered(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        return moduleInfo ? moduleInfo.loaded : false;
    }
    
    /**
     * 检查依赖
     */
    async checkDependencies(moduleInfo) {
        for (const dependency of moduleInfo.dependencies) {
            if (!this.modules.has(dependency)) {
                throw new Error(`模块 ${moduleInfo.name} 依赖未满足: ${dependency}`);
            }
        }
    }
    
    /**
     * 获取依赖模块
     */
    getDependentModules(moduleName) {
        const dependents = [];
        
        for (const [name, moduleInfo] of this.modules) {
            if (moduleInfo.dependencies.includes(moduleName)) {
                dependents.push(name);
            }
        }
        
        return dependents;
    }
    
    /**
     * 获取排序后的模块（按依赖关系和优先级）
     */
    getSortedModules() {
        const visited = new Set();
        const result = [];
        
        const visit = (moduleName) => {
            if (visited.has(moduleName)) {
                return;
            }
            
            visited.add(moduleName);
            
            const moduleInfo = this.modules.get(moduleName);
            if (!moduleInfo) {
                return;
            }
            
            // 先访问依赖
            for (const dependency of moduleInfo.dependencies) {
                visit(dependency);
            }
            
            result.push(moduleName);
        };
        
        // 按优先级排序
        const sortedByPriority = Array.from(this.modules.entries())
            .sort((a, b) => b[1].priority - a[1].priority)
            .map(([name]) => name);
        
        // 拓扑排序
        for (const moduleName of sortedByPriority) {
            visit(moduleName);
        }
        
        return result;
    }
    
    /**
     * 获取模块状态
     */
    getModuleStatus(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        
        if (!moduleInfo) {
            return { exists: false, registered: false, started: false };
        }
        
        return {
            exists: true,
            registered: moduleInfo.loaded,
            started: moduleInfo.started,
            dependencies: moduleInfo.dependencies,
            provides: moduleInfo.provides,
            priority: moduleInfo.priority
        };
    }
    
    /**
     * 获取所有模块状态
     */
    getAllModuleStatus() {
        const status = {};
        
        for (const moduleName of this.getAllModules()) {
            status[moduleName] = this.getModuleStatus(moduleName);
        }
        
        return status;
    }
    
    /**
     * 获取模块统计信息
     */
    getModuleStatistics() {
        const modules = Array.from(this.modules.values());
        
        return {
            total: modules.length,
            registered: modules.filter(m => m.loaded).length,
            started: modules.filter(m => m.started).length,
            byPriority: modules.reduce((acc, module) => {
                acc[module.priority] = (acc[module.priority] || 0) + 1;
                return acc;
            }, {})
        };
    }
    
    /**
     * 清理模块管理器
     */
    async cleanup() {
        this.logger.info('清理模块管理器...');
        
        // 停止所有模块
        await this.stopAll();
        
        // 清空模块列表
        this.modules.clear();
        
        this.logger.info('模块管理器清理完成');
    }
}