/**
 * Mermaid 模块 - 兼容层
 * 原文件已拆分为 mermaid/mermaid.renderer.js 和 mermaid/mermaid.ui.js
 * 本文件保留以确保向后兼容
 */
(function (global) {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  console.log('[PetManager] petManager.mermaid.js 兼容层已加载')
})()
