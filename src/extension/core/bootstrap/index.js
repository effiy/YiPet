/**
 * Content Script 入口（已拆分）
 *
 * 说明：
 * - `src/extension/core/bootstrap/bootstrap.js`：日志开关、PET_CONFIG 兜底、StorageHelper、默认位置工具函数
 * - `src/features/petManager.core.js`：PetManager 类定义（IIFE，挂到 window.PetManager）
 * - `src/features/petManager.js`：PetManager 轻量入口/装配文件（校验加载顺序、后续拆分模块的聚合点）
 * - `src/extension/core/bootstrap/index.js`（本文件）：只负责实例化与生命周期清理
 */

(function () {
  'use strict';

  try {
    // 初始化宠物管理器（防止重复初始化）
    if (typeof window.petManager === 'undefined') {
      window.petManager = new window.PetManager();
    }
  } catch (e) {
    console.error('初始化 petManager 失败:', e);
  }

  // 页面卸载时清理资源
  window.addEventListener('beforeunload', () => {
    if (window.petManager) {
      window.petManager.cleanup();
    }
  });

  // 页面隐藏时暂停某些功能（预留）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('页面隐藏，暂停某些功能');
      // 可以在这里添加暂停逻辑
    } else {
      console.log('页面显示，恢复功能');
      // 可以在这里添加恢复逻辑
    }
  });

  console.log('Content Script 完成');
})();
