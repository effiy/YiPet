/**
 * 模板加载工具
 * 从 DomHelper 中提取，专注 HTML 模板加载与缓存
 *
 * 使用示例：
 * ```javascript
 * const url = TemplateHelper.resolveExtensionResourceUrl('templates/chat.html');
 * const html = await TemplateHelper.loadHtmlTemplate('templates/chat.html', '.chat-window');
 * ```
 */
class TemplateHelper {
  /**
   * 解析扩展资源 URL
   * @param {string} relativePath - 相对路径
   * @returns {string} 解析后的完整 URL
   */
  static resolveExtensionResourceUrl(relativePath) {
    if (!relativePath) return ''
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
        return chrome.runtime.getURL(relativePath)
      }
    } catch (_) {}
    return relativePath
  }

  /**
   * 加载 HTML 模板（带缓存和去重）
   * @param {string} resourcePath - 模板资源路径
   * @param {string} selector - CSS 选择器，用于提取目标片段
   * @param {string} [errorMessage] - 自定义错误消息前缀
   * @returns {Promise<string>} 模板 HTML 内容
   */
  static async loadHtmlTemplate(resourcePath, selector, errorMessage) {
    const resolvedPath = String(resourcePath || '').trim()
    const resolvedSelector = String(selector || '').trim()
    const key = `${resolvedPath}::${resolvedSelector}`

    const cache = this._templateCache || (this._templateCache = Object.create(null))
    if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key]

    const pending = this._templatePromises || (this._templatePromises = Object.create(null))
    if (pending[key]) return pending[key]

    pending[key] = (async () => {
      const url = this.resolveExtensionResourceUrl(resolvedPath)
      const res = await fetch(url)
      if (!res.ok) {
        const prefix = String(errorMessage || '').trim() || 'Failed to load template'
        throw new Error(`${prefix}: ${res.status}`)
      }
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const el = doc.querySelector(resolvedSelector)
      const template = el ? el.innerHTML : ''
      cache[key] = template
      return template
    })()

    try {
      return await pending[key]
    } finally {
      try {
        delete pending[key]
      } catch (_) {
        pending[key] = null
      }
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TemplateHelper
} else {
  window.TemplateHelper = TemplateHelper
}
