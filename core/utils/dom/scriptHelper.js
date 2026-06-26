/**
 * 页面脚本注入与通信工具
 * 从 DomHelper 中提取，专注向页面注入脚本并等待响应事件
 *
 * 职责：注入 <script> 标签、创建数据容器、等待 window 事件、编排完整注入流程
 *
 * 使用示例：
 * ```javascript
 * const result = await ScriptHelper.runPageScriptWithData({
 *   scriptSrc: 'libs/mermaid.min.js',
 *   dataContainerId: 'mermaid-data',
 *   dataAttributes: { 'data-theme': 'dark' },
 *   successEvent: 'mermaid-ready',
 *   errorEvent: 'mermaid-error',
 *   timeoutMs: 15000,
 * });
 * ```
 */
class ScriptHelper {
  /* ───── 元素管理 ───── */

  /**
   * 创建数据容器 div 并注入到页面
   * @param {Object} opts - 配置项
   * @param {string} opts.id - 容器 ID
   * @param {string} [opts.className] - CSS 类名
   * @param {Object} [opts.attributes] - 自定义属性键值对
   * @param {HTMLElement} [opts.parent] - 父节点，默认 document.head
   * @returns {HTMLElement|null}
   */
  static createDataContainer({ id, className, attributes, parent }) {
    if (!id) return null
    // 移除已存在的同 ID 元素
    try {
      const old = document.getElementById(id)
      if (old && old.parentNode) old.parentNode.removeChild(old)
    } catch (_) {}

    try {
      const el = document.createElement('div')
      el.id = id
      if (className) el.className = className
      if (attributes && typeof attributes === 'object') {
        Object.keys(attributes).forEach((key) => {
          try { el.setAttribute(key, String(attributes[key])) } catch (_) {}
        })
      }
      const target = parent || document.head || document.documentElement
      ;(target || document.documentElement).appendChild(el)
      return el
    } catch (_) {
      return null
    }
  }

  /* ───── 脚本注入 ───── */

  /**
   * 向页面注入 <script> 标签
   * @param {Object} opts - 配置项
   * @param {string} opts.src - 脚本 URL
   * @param {HTMLElement} [opts.parent] - 父节点，默认 document.head
   * @param {boolean} [opts.async=false] - 是否异步加载
   * @param {string} [opts.charset='UTF-8'] - 字符集
   * @returns {HTMLScriptElement|null}
   */
  static injectScript({ src, parent, async = false, charset = 'UTF-8' }) {
    if (!src) return null
    try {
      const script = document.createElement('script')
      script.src = src
      script.charset = charset
      script.async = !!async
      const target = parent || document.head || document.documentElement
      ;(target || document.documentElement).appendChild(script)
      return script
    } catch (_) {
      return null
    }
  }

  /* ───── 事件等待 ───── */

  /**
   * 等待 window 上的自定义事件（用于与注入脚本通信）
   * @param {Object} opts - 配置项
   * @param {string} [opts.successEvent] - 成功事件名
   * @param {string} [opts.errorEvent] - 失败事件名
   * @param {number} [opts.timeoutMs=15000] - 超时毫秒
   * @param {Function} [opts.isSuccess] - 成功事件过滤器
   * @param {Function} [opts.isError] - 错误事件过滤器
   * @returns {Promise<Event>}
   */
  static waitForWindowEvent({ successEvent, errorEvent, timeoutMs = 15000, isSuccess, isError }) {
    return new Promise((resolve, reject) => {
      let timeoutId = null
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (successEvent) {
          try { window.removeEventListener(successEvent, onSuccess) } catch (_) {}
        }
        if (errorEvent) {
          try { window.removeEventListener(errorEvent, onError) } catch (_) {}
        }
      }

      const onSuccess = (e) => {
        try {
          if (typeof isSuccess === 'function' && !isSuccess(e)) return
        } catch (_) {}
        cleanup()
        resolve(e)
      }

      const onError = (e) => {
        try {
          if (typeof isError === 'function' && !isError(e)) return
        } catch (_) {}
        cleanup()
        reject(e)
      }

      if (successEvent) window.addEventListener(successEvent, onSuccess)
      if (errorEvent) window.addEventListener(errorEvent, onError)

      timeoutId = setTimeout(
        () => {
          cleanup()
          reject(new Error('等待页面事件超时'))
        },
        Math.max(0, Number(timeoutMs) || 0),
      )
    })
  }

  /* ───── 编排注入流程 ───── */

  /**
   * 完整的脚本注入 + 数据传递 + 事件等待流程
   *
   * 1. 创建数据容器 div（携带配置数据作为 data-* 属性）
   * 2. 注入 <script> 标签
   * 3. 等待 window 上的成功/失败事件
   * 4. 清理注入的元素
   *
   * @param {Object} opts - 配置项
   * @param {string} opts.scriptSrc - 脚本 URL
   * @param {string} [opts.dataContainerId] - 数据容器 ID
   * @param {Object} [opts.dataAttributes] - 数据容器上的 data-* 属性
   * @param {string} [opts.successEvent] - 成功事件名
   * @param {string} [opts.errorEvent] - 失败事件名
   * @param {number} [opts.timeoutMs] - 超时毫秒
   * @param {number} [opts.cleanupDelayMs=1000] - 清理延迟（毫秒）
   * @param {Function} [opts.isSuccess] - 成功事件过滤器
   * @param {Function} [opts.isError] - 错误事件过滤器
   * @returns {Promise<Event>}
   */
  static async runPageScriptWithData({
    scriptSrc,
    dataContainerId,
    dataAttributes,
    successEvent,
    errorEvent,
    timeoutMs,
    cleanupDelayMs = 1000,
    isSuccess,
    isError,
  }) {
    const container = dataContainerId
      ? this.createDataContainer({
          id: dataContainerId,
          className: 'tw-hidden',
          attributes: dataAttributes,
          parent: document.head || document.documentElement,
        })
      : null

    const script = this.injectScript({
      src: scriptSrc,
      parent: document.head || document.documentElement,
      async: false,
    })

    try {
      return await this.waitForWindowEvent({ successEvent, errorEvent, timeoutMs, isSuccess, isError })
    } finally {
      setTimeout(
        () => {
          if (script && script.parentNode) {
            try { script.parentNode.removeChild(script) } catch (_) {}
          }
          if (container && container.parentNode) {
            try { container.parentNode.removeChild(container) } catch (_) {}
          } else if (dataContainerId) {
            try {
              const el = document.getElementById(dataContainerId)
              if (el && el.parentNode) el.parentNode.removeChild(el)
            } catch (_) {}
          }
        },
        Math.max(0, Number(cleanupDelayMs) || 0),
      )
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScriptHelper
} else {
  window.ScriptHelper = ScriptHelper
}
