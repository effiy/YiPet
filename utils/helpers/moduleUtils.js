/**
 * 模块工具类
 * 
 * 功能说明：
 * - 提供统一的模块导出功能，减少重复代码
 * - 处理不同环境下的全局对象访问（Node.js、Service Worker、浏览器）
 * - 提供安全的全局对象获取方法
 * 
 * 使用示例：
 * ```javascript
 * // 导出模块
 * ModuleUtils.export('MyClass', MyClass);
 * 
 * // 获取全局对象
 * const globalObj = ModuleUtils.getGlobal();
 * const serviceWorkerObj = ModuleUtils.getServiceWorker();
 * ```
 */

class ModuleUtils {
    /**
     * 获取全局对象（根据环境自动选择）
     * @returns {Object} 全局对象（globalThis、self、window 或 global）
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
        // 降级方案
        try {
            return Function('return this')();
        } catch (e) {
            return {};
        }
    }

    /**
     * 获取 Service Worker 全局对象
     * @returns {Object|null} Service Worker 全局对象或 null
     */
    static getServiceWorker() {
        if (typeof self !== 'undefined') {
            return self;
        }
        return null;
    }

    /**
     * 获取浏览器全局对象
     * @returns {Object|null} 浏览器全局对象或 null
     */
    static getWindow() {
        if (typeof window !== 'undefined') {
            return window;
        }
        return null;
    }

    /**
     * 检查是否在 Node.js 环境
     * @returns {boolean} 是否在 Node.js 环境
     */
    static isNode() {
        return typeof module !== 'undefined' && typeof module.exports !== 'undefined';
    }

    /**
     * 检查是否在 Service Worker 环境
     * @returns {boolean} 是否在 Service Worker 环境
     */
    static isServiceWorker() {
        return typeof self !== 'undefined' && typeof importScripts === 'function';
    }

    /**
     * 检查是否在浏览器环境
     * @returns {boolean} 是否在浏览器环境
     */
    static isBrowser() {
        return typeof window !== 'undefined';
    }

    /**
     * 安全获取全局属性
     * @param {string} name - 属性名称
     * @param {Object} [context] - 上下文对象（可选，默认使用 getGlobal()）
     * @returns {*} 属性值或 undefined
     */
    static getGlobalProperty(name, context = null) {
        const globalObj = context || this.getGlobal();
        try {
            return globalObj[name];
        } catch (e) {
            return undefined;
        }
    }

    /**
     * 统一导出模块
     * 支持 Node.js (module.exports) 和浏览器环境 (window/self/globalThis)
     * @param {string} name - 导出名称
     * @param {*} value - 要导出的值
     * @param {Object} [options] - 选项
     * @param {boolean} [options.forceGlobal] - 是否强制导出到全局对象（即使有 module.exports）
     */
    static export(name, value, options = {}) {
        // Node.js 环境
        if (this.isNode() && !options.forceGlobal) {
            if (typeof module !== 'undefined' && module.exports) {
                module.exports = value;
                return;
            }
        }

        // 浏览器/Service Worker 环境
        const globalObj = this.getGlobal();
        try {
            globalObj[name] = value;
        } catch (e) {
            console.warn(`无法导出 ${name} 到全局对象:`, e);
        }
    }

    /**
     * 统一导出多个模块
     * @param {Object} exports - 导出对象 {name: value}
     * @param {Object} [options] - 选项
     */
    static exportMultiple(exports, options = {}) {
        // Node.js 环境
        if (this.isNode() && !options.forceGlobal) {
            if (typeof module !== 'undefined' && module.exports) {
                Object.assign(module.exports, exports);
                return;
            }
        }

        // 浏览器/Service Worker 环境
        const globalObj = this.getGlobal();
        Object.keys(exports).forEach(name => {
            try {
                globalObj[name] = exports[name];
            } catch (e) {
                console.warn(`无法导出 ${name} 到全局对象:`, e);
            }
        });
    }
}

// 导出自身
ModuleUtils.export('ModuleUtils', ModuleUtils);


