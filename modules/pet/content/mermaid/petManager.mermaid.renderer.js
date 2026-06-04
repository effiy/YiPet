/**
 * Mermaid 渲染核心模块
 * 负责 Mermaid CDN 加载、图表渲染核心逻辑
 */
(function (global) {
  const proto = global.PetManager.prototype
  const logger = (typeof window !== 'undefined' && window.LoggerUtils && typeof window.LoggerUtils.getLogger === 'function')
    ? window.LoggerUtils.getLogger('mermaid')
    : console

  // 加载 Mermaid.js (CDN)
  proto.loadMermaid = async function () {
    return window.MermaidRenderer.loadMermaid()
  }

  // 处理 Markdown 中的 Mermaid 代码块（委托给 MermaidRenderer 组件）
  proto.processMermaidBlocks = async function (container) {
    return window.MermaidRenderer.renderBlocks(container)
  }

  // 渲染 Markdown 为 HTML（使用 petManager.message.js 中的实现，确保 mermaid 处理一致）
  proto.renderMarkdown = function (markdown) {
    return window.MarkdownRenderer.render(markdown)
  }

  // 渲染 Markdown 并处理 Mermaid（委托给各组件）
  proto.renderMarkdownWithMermaid = async function (markdown, container) {
    var html = this.renderMarkdown(markdown)
    if (container) {
      setTimeout(function () {
        window.MermaidRenderer.renderBlocks(container)
        if (typeof this.processTabs === 'function') this.processTabs(container)
      }.bind(this), 100)
    }
    return html
  }

  // HTML 转义（委托给 MarkdownRenderer 组件）
  proto.escapeHtml = function (text) {
    return window.MarkdownRenderer.escapeHtml(text)
  }

})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window))
