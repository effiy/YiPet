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
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = DomHelper;
} else {
    window.DomHelper = DomHelper;
}
