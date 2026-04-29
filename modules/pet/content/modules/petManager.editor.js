(function (global) {
  'use strict'

  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  console.log('[PetManager] petManager.editor.js 兼容层已加载')
  // 所有方法已在新文件中挂载到原型，无需重复实现
  // 保持文件存在即可确保兼容性
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this)))
