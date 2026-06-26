/**
 * DOM 操作工具类
 *
 * 职责聚焦：DOM 查询/操作 + 扩展上下文错误检测
 * 模板加载 → TemplateHelper   脚本注入 → ScriptHelper   文件选择 → FileHelper
 *
 * 使用示例：
 * ```javascript
 * const el = DomHelper.getElement('myButton');
 * DomHelper.setText(el, '点击我');
 * DomHelper.addEventListener(el, 'click', handleClick);
 * ```
 */
class DomHelper {
  /* ═══════════════════════ DOM 查询 ═══════════════════════ */

  /**
   * 安全获取 DOM 元素
   * @param {string} id - 元素 ID
   * @returns {HTMLElement|null}
   */
  static getElement(id) {
    if (!id) return null
    try {
      return document.getElementById(id)
    } catch (error) {
      console.warn(`获取元素失败 (${id}):`, error)
      return null
    }
  }

  /**
   * 安全查询子元素
   * @param {HTMLElement} parent - 父元素
   * @param {string} selector - CSS 选择器
   * @returns {HTMLElement|null}
   */
  static querySelector(parent, selector) {
    if (!parent || !selector) return null
    try {
      return parent.querySelector(selector)
    } catch (error) {
      console.warn(`查询子元素失败 (${selector}):`, error)
      return null
    }
  }

  /* ═══════════════════════ DOM 操作 ═══════════════════════ */

  /**
   * 安全设置元素文本内容
   * @param {HTMLElement|null} element - 元素
   * @param {string} text - 文本内容
   */
  static setText(element, text) {
    if (element) element.textContent = text || ''
  }

  /**
   * 安全设置元素值
   * @param {HTMLElement|null} element - 元素
   * @param {string|number} value - 值
   */
  static setValue(element, value) {
    if (element && 'value' in element) element.value = value
  }

  /**
   * 安全添加事件监听器
   * @param {HTMLElement|null} element - 元素
   * @param {string} event - 事件类型
   * @param {Function} handler - 事件处理函数
   */
  static addEventListener(element, event, handler) {
    if (element && event && typeof handler === 'function') {
      element.addEventListener(event, handler)
    }
  }

  /**
   * 安全设置按钮加载状态
   * @param {string} buttonId - 按钮 ID
   * @param {boolean} loading - 是否加载中
   */
  static setButtonLoading(buttonId, loading) {
    const button = this.getElement(buttonId)
    if (button) {
      if (loading) {
        button.classList.add('loading')
        button.disabled = true
      } else {
        button.classList.remove('loading')
        button.disabled = false
      }
    }
  }

  /**
   * 批量设置元素属性
   * @param {Object} elements - 元素映射对象 {id: element}
   * @param {Object} updates - 更新对象 {id: {property: value}}
   */
  static batchUpdate(elements, updates) {
    Object.keys(updates).forEach((id) => {
      const element = elements[id] || this.getElement(id)
      if (element) {
        const update = updates[id]
        Object.keys(update).forEach((property) => {
          if (property === 'text') {
            this.setText(element, update[property])
          } else if (property === 'value') {
            this.setValue(element, update[property])
          } else if (property === 'html') {
            element.innerHTML = update[property]
          } else {
            element[property] = update[property]
          }
        })
      }
    })
  }

  /**
   * HTML 转义（防 XSS 攻击）
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的 HTML 字符串
   */
  static escapeHtml(text) {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * 按 ID 移除元素
   * @param {string} id - 元素 ID
   */
  static removeElementById(id) {
    if (!id) return
    try {
      const el = document.getElementById(id)
      if (el && el.parentNode) el.parentNode.removeChild(el)
    } catch (_) {}
  }

  /* ═══════════════════════ 错误检测 ═══════════════════════ */

  /**
   * 检测是否为扩展上下文失效错误
   * @param {Error|*} error - 错误对象
   * @returns {boolean}
   */
  static isContextInvalidatedError(error) {
    try {
      if (
        typeof ErrorHandler !== 'undefined' &&
        ErrorHandler &&
        typeof ErrorHandler.isContextInvalidated === 'function'
      ) {
        return ErrorHandler.isContextInvalidated(error)
      }
    } catch (_) {}
    const errorMsg = (
      error && (error.message || error.toString()) ? error.message || error.toString() : ''
    ).toLowerCase()
    return (
      errorMsg.includes('extension context invalidated') ||
      errorMsg.includes('context invalidated') ||
      errorMsg.includes('could not establish connection') ||
      errorMsg.includes('the message port closed')
    )
  }

  /**
   * 获取扩展资源 URL（带上下文失效检测）
   * @param {string} relativePath - 相对路径
   * @returns {string} 完整 URL
   * @throws {Error} 扩展上下文失效时抛出
   */
  static getExtensionUrlOrThrow(relativePath) {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
        throw new Error('扩展上下文无效：chrome.runtime 不可用')
      }
      const url = chrome.runtime.getURL(relativePath)
      if (!url) throw new Error('扩展上下文无效：无法获取脚本 URL')
      return url
    } catch (error) {
      if (this.isContextInvalidatedError(error)) {
        let msg = '扩展上下文已失效'
        try {
          const m =
            typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES
              ? PET_CONFIG.constants.ERROR_MESSAGES
              : null
          if (m && m.CONTEXT_INVALIDATED) msg = m.CONTEXT_INVALIDATED
        } catch (_) {}
        throw new Error(msg)
      }
      throw error
    }
  }

  /* ═══════════════════════ 委托方法（实现见对应 Helper 文件） ═══════════════════════ */

  /** @see TemplateHelper.resolveExtensionResourceUrl */
  static resolveExtensionResourceUrl(relativePath) {
    return TemplateHelper.resolveExtensionResourceUrl(relativePath)
  }

  /** @see TemplateHelper.loadHtmlTemplate */
  static async loadHtmlTemplate(resourcePath, selector, errorMessage) {
    return TemplateHelper.loadHtmlTemplate(resourcePath, selector, errorMessage)
  }

  /** @see FileHelper.pickFile */
  static pickFile(options) {
    return FileHelper.pickFile(options)
  }

  /** @see ScriptHelper.injectScript */
  static injectScript(opts) {
    return ScriptHelper.injectScript(opts)
  }

  /** @see ScriptHelper.createDataContainer */
  static createDataContainer(opts) {
    return ScriptHelper.createDataContainer(opts)
  }

  /** @see ScriptHelper.waitForWindowEvent */
  static waitForWindowEvent(opts) {
    return ScriptHelper.waitForWindowEvent(opts)
  }

  /** @see ScriptHelper.runPageScriptWithData */
  static async runPageScriptWithData(opts) {
    return ScriptHelper.runPageScriptWithData(opts)
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DomHelper
} else {
  window.DomHelper = DomHelper
}
