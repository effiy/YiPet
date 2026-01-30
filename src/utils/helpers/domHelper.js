/**
 * DOM操作工具类
 * 
 * 功能说明：
 * - 提供统一的DOM查询和操作方法
 * - 减少重复代码，提高代码可维护性
 * - 所有方法都包含安全检查，避免空指针错误
 * 
 * 使用示例：
 * ```javascript
 * const element = DomHelper.getElement('myButton');
 * DomHelper.setText(element, '点击我');
 * DomHelper.addEventListener(element, 'click', handleClick);
 * ```
 */

class DomHelper {
    /**
     * 安全获取DOM元素
     * @param {string} id - 元素ID
     * @returns {HTMLElement|null} DOM元素或null
     */
    static getElement(id) {
        if (!id) return null;
        try {
            return document.getElementById(id);
        } catch (error) {
            console.warn(`获取元素失败 (${id}):`, error);
            return null;
        }
    }

    /**
     * 安全查询子元素
     * @param {HTMLElement} parent - 父元素
     * @param {string} selector - CSS选择器
     * @returns {HTMLElement|null} 子元素或null
     */
    static querySelector(parent, selector) {
        if (!parent || !selector) return null;
        try {
            return parent.querySelector(selector);
        } catch (error) {
            console.warn(`查询子元素失败 (${selector}):`, error);
            return null;
        }
    }

    static resolveExtensionResourceUrl(relativePath) {
        if (!relativePath) return '';
        try {
            if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) return chrome.runtime.getURL(relativePath);
        } catch (_) {}
        return relativePath;
    }

    static async loadHtmlTemplate(resourcePath, selector, errorMessage) {
        const resolvedPath = String(resourcePath || '').trim();
        const resolvedSelector = String(selector || '').trim();
        const key = `${resolvedPath}::${resolvedSelector}`;

        const cache = this._templateCache || (this._templateCache = Object.create(null));
        if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];

        const pending = this._templatePromises || (this._templatePromises = Object.create(null));
        if (pending[key]) return pending[key];

        pending[key] = (async () => {
            const url = this.resolveExtensionResourceUrl(resolvedPath);
            const res = await fetch(url);
            if (!res.ok) {
                const prefix = String(errorMessage || '').trim() || 'Failed to load template';
                throw new Error(`${prefix}: ${res.status}`);
            }
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const el = doc.querySelector(resolvedSelector);
            const template = el ? el.innerHTML : '';
            cache[key] = template;
            return template;
        })();

        try {
            return await pending[key];
        } finally {
            try {
                delete pending[key];
            } catch (_) {
                pending[key] = null;
            }
        }
    }

    static pickFile(options = {}) {
        const accept = options?.accept;
        const multiple = !!options?.multiple;

        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            if (accept) input.accept = accept;
            if (multiple) input.multiple = true;
            input.className = 'js-hidden';

            const cleanup = () => {
                try {
                    input.removeEventListener('change', onChange);
                } catch (_) {}
                try {
                    if (input.parentNode) input.parentNode.removeChild(input);
                } catch (_) {}
            };

            const onChange = () => {
                const files = input.files;
                cleanup();
                if (multiple) {
                    resolve(files ? Array.from(files) : []);
                    return;
                }
                resolve(files && files[0] ? files[0] : null);
            };

            input.addEventListener('change', onChange);
            document.body.appendChild(input);

            try {
                input.click();
            } catch (_) {
                cleanup();
                resolve(multiple ? [] : null);
            }
        });
    }

    /**
     * 安全设置元素文本内容
     * @param {HTMLElement|null} element - 元素
     * @param {string} text - 文本内容
     */
    static setText(element, text) {
        if (element) {
            element.textContent = text || '';
        }
    }

    /**
     * 安全设置元素值
     * @param {HTMLElement|null} element - 元素
     * @param {string|number} value - 值
     */
    static setValue(element, value) {
        if (element && 'value' in element) {
            element.value = value;
        }
    }

    /**
     * 安全添加事件监听器
     * @param {HTMLElement|null} element - 元素
     * @param {string} event - 事件类型
     * @param {Function} handler - 事件处理函数
     */
    static addEventListener(element, event, handler) {
        if (element && event && typeof handler === 'function') {
            element.addEventListener(event, handler);
        }
    }

    /**
     * 安全设置按钮加载状态
     * @param {string} buttonId - 按钮ID
     * @param {boolean} loading - 是否加载中
     */
    static setButtonLoading(buttonId, loading) {
        const button = this.getElement(buttonId);
        if (button) {
            if (loading) {
                button.classList.add('loading');
                button.disabled = true;
            } else {
                button.classList.remove('loading');
                button.disabled = false;
            }
        }
    }

    /**
     * 批量设置元素属性
     * @param {Object} elements - 元素映射对象 {id: element}
     * @param {Object} updates - 更新对象 {id: {property: value}}
     */
    static batchUpdate(elements, updates) {
        Object.keys(updates).forEach(id => {
            const element = elements[id] || this.getElement(id);
            if (element) {
                const update = updates[id];
                Object.keys(update).forEach(property => {
                    if (property === 'text') {
                        this.setText(element, update[property]);
                    } else if (property === 'value') {
                        this.setValue(element, update[property]);
                    } else if (property === 'html') {
                        element.innerHTML = update[property];
                    } else {
                        element[property] = update[property];
                    }
                });
            }
        });
    }

    /**
     * HTML转义（防止XSS攻击）
     * @param {string} text - 要转义的文本
     * @returns {string} 转义后的HTML字符串
     */
    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static isContextInvalidatedError(error) {
        try {
            if (typeof ErrorHandler !== 'undefined' && ErrorHandler && typeof ErrorHandler.isContextInvalidated === 'function') {
                return ErrorHandler.isContextInvalidated(error);
            }
        } catch (_) {}
        const errorMsg = (error && (error.message || error.toString()) ? (error.message || error.toString()) : '').toLowerCase();
        return errorMsg.includes('extension context invalidated') ||
            errorMsg.includes('context invalidated') ||
            errorMsg.includes('could not establish connection') ||
            errorMsg.includes('the message port closed');
    }

    static getExtensionUrlOrThrow(relativePath) {
        try {
            if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
                throw new Error('扩展上下文无效：chrome.runtime 不可用');
            }
            const url = chrome.runtime.getURL(relativePath);
            if (!url) throw new Error('扩展上下文无效：无法获取脚本 URL');
            return url;
        } catch (error) {
            if (this.isContextInvalidatedError(error)) {
                let msg = '扩展上下文已失效';
                try {
                    const m = (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) ? PET_CONFIG.constants.ERROR_MESSAGES : null;
                    if (m && m.CONTEXT_INVALIDATED) msg = m.CONTEXT_INVALIDATED;
                } catch (_) {}
                throw new Error(msg);
            }
            throw error;
        }
    }

    static removeElementById(id) {
        if (!id) return;
        try {
            const el = document.getElementById(id);
            if (el && el.parentNode) el.parentNode.removeChild(el);
        } catch (_) {}
    }

    static createDataContainer({ id, className, attributes, parent }) {
        if (!id) return null;
        this.removeElementById(id);
        try {
            const el = document.createElement('div');
            el.id = id;
            if (className) el.className = className;
            if (attributes && typeof attributes === 'object') {
                Object.keys(attributes).forEach((key) => {
                    try {
                        el.setAttribute(key, String(attributes[key]));
                    } catch (_) {}
                });
            }
            const target = parent || document.head || document.documentElement;
            (target || document.documentElement).appendChild(el);
            return el;
        } catch (_) {
            return null;
        }
    }

    static injectScript({ src, parent, async = false, charset = 'UTF-8' }) {
        if (!src) return null;
        try {
            const script = document.createElement('script');
            script.src = src;
            script.charset = charset;
            script.async = !!async;
            const target = parent || document.head || document.documentElement;
            (target || document.documentElement).appendChild(script);
            return script;
        } catch (_) {
            return null;
        }
    }

    static waitForWindowEvent({ successEvent, errorEvent, timeoutMs = 15000, isSuccess, isError }) {
        return new Promise((resolve, reject) => {
            let timeoutId = null;
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (successEvent) {
                    try {
                        window.removeEventListener(successEvent, onSuccess);
                    } catch (_) {}
                }
                if (errorEvent) {
                    try {
                        window.removeEventListener(errorEvent, onError);
                    } catch (_) {}
                }
            };

            const onSuccess = (e) => {
                try {
                    if (typeof isSuccess === 'function' && !isSuccess(e)) return;
                } catch (_) {}
                cleanup();
                resolve(e);
            };

            const onError = (e) => {
                try {
                    if (typeof isError === 'function' && !isError(e)) return;
                } catch (_) {}
                cleanup();
                reject(e);
            };

            if (successEvent) window.addEventListener(successEvent, onSuccess);
            if (errorEvent) window.addEventListener(errorEvent, onError);

            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('等待页面事件超时'));
            }, Math.max(0, Number(timeoutMs) || 0));
        });
    }

    static async runPageScriptWithData({
        scriptSrc,
        dataContainerId,
        dataAttributes,
        successEvent,
        errorEvent,
        timeoutMs,
        cleanupDelayMs = 1000,
        isSuccess,
        isError
    }) {
        const container = dataContainerId ? this.createDataContainer({
            id: dataContainerId,
            className: 'tw-hidden',
            attributes: dataAttributes,
            parent: document.head || document.documentElement
        }) : null;

        const script = this.injectScript({
            src: scriptSrc,
            parent: document.head || document.documentElement,
            async: false
        });

        try {
            return await this.waitForWindowEvent({ successEvent, errorEvent, timeoutMs, isSuccess, isError });
        } finally {
            setTimeout(() => {
                if (script && script.parentNode) {
                    try {
                        script.parentNode.removeChild(script);
                    } catch (_) {}
                }
                if (container && container.parentNode) {
                    try {
                        container.parentNode.removeChild(container);
                    } catch (_) {}
                } else if (dataContainerId) {
                    this.removeElementById(dataContainerId);
                }
            }, Math.max(0, Number(cleanupDelayMs) || 0));
        }
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = DomHelper;
} else {
    window.DomHelper = DomHelper;
}
