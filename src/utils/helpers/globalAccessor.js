/**
 * 全局对象访问工具
 * 
 * 功能说明：
 * - 提供统一的全局对象访问方法，避免重复的 typeof 检查
 * - 支持 Service Worker、浏览器和 Node.js 环境
 * 
 * 使用示例：
 * ```javascript
 * // 获取 ErrorHandler
 * const ErrorHandler = GlobalAccessor.get('ErrorHandler');
 * 
 * // 获取多个对象
 * const { ErrorHandler, InjectionService } = GlobalAccessor.getMultiple(['ErrorHandler', 'InjectionService']);
 * ```
 */

class GlobalAccessor {
    /**
     * 获取全局对象（根据环境自动选择）
     * @returns {Object} 全局对象
     */
    static getGlobal() {
        if (typeof globalThis !== 'undefined') {
            return globalThis;
        }
        if (typeof self !== 'undefined') {
            return self;
        }
        if (typeof window !== 'undefined') {
            return window;
        }
        if (typeof global !== 'undefined') {
            return global;
        }
        return {};
    }

    /**
     * 安全获取全局属性
     * @param {string} name - 属性名称
     * @param {Object} [context] - 上下文对象（可选）
     * @returns {*} 属性值或 undefined
     */
    static get(name, context = null) {
        const globalObj = context || this.getGlobal();
        try {
            return globalObj[name];
        } catch (e) {
            return undefined;
        }
    }

    /**
     * 获取多个全局属性
     * @param {Array<string>} names - 属性名称数组
     * @param {Object} [context] - 上下文对象（可选）
     * @returns {Object} 属性映射对象 {name: value}
     */
    static getMultiple(names, context = null) {
        const result = {};
        const globalObj = context || this.getGlobal();
        
        names.forEach(name => {
            try {
                result[name] = globalObj[name];
            } catch (e) {
                result[name] = undefined;
            }
        });
        
        return result;
    }

    /**
     * 检查全局属性是否存在
     * @param {string} name - 属性名称
     * @param {Object} [context] - 上下文对象（可选）
     * @returns {boolean} 是否存在
     */
    static has(name, context = null) {
        const value = this.get(name, context);
        return value !== undefined && value !== null;
    }

    /**
     * 获取 ErrorHandler（常用方法）
     * @returns {ErrorHandler|null} ErrorHandler 实例或 null
     */
    static getErrorHandler() {
        return this.get('ErrorHandler') || null;
    }

    /**
     * 获取 InjectionService（常用方法）
     * @returns {InjectionService|null} InjectionService 实例或 null
     */
    static getInjectionService() {
        return this.get('InjectionService') || null;
    }

    /**
     * 获取 TabMessaging（常用方法）
     * @returns {TabMessaging|null} TabMessaging 实例或 null
     */
    static getTabMessaging() {
        return this.get('TabMessaging') || null;
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = GlobalAccessor;
} else {
    const globalObj = GlobalAccessor.getGlobal();
    globalObj.GlobalAccessor = GlobalAccessor;
}

