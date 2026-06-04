/**
 * Mermaid UI 交互模块（兼容层）
 * 实际逻辑已迁移至 cdn/markdown/mermaid.js，本文件保留为向后兼容层
 */
(function (global) {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') return

  var proto = global.PetManager.prototype

  proto.addMermaidActions = function (mermaidDiv, svgContent, mermaidSourceCode) {
    window.MermaidRenderer.addActions(mermaidDiv, svgContent, mermaidSourceCode)
  }

  proto.openMermaidFullscreen = function (mermaidDiv, mermaidSourceCode) {
    window.MermaidRenderer.openFullscreen(mermaidDiv, mermaidSourceCode)
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window))
