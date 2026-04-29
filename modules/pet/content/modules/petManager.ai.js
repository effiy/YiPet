/**
 * AI 对话模块 - 兼容层
 * 原文件已拆分为 ai/petManager.ai.api.js 和 ai/petManager.ai.prompt.js
 * 本文件保留以确保向后兼容
 */
(function (global) {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  console.log('[PetManager] petManager.ai.js 兼容层已加载')
})()
