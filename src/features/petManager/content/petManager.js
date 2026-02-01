/**
 * PetManager 轻量入口/装配文件
 *
 * 目标：
 * - 把超大的实现移动到 `content/petManager.core.js`，让本文件保持小而清晰
 * - 后续拆分出的子模块（例如 `content/petManager.screenshot.js`）通过给
 *   `window.PetManager.prototype` 挂方法的方式进行扩展
 *
 * 注意：
 * - 本文件依赖 `content/petManager.core.js` 已先加载（由 manifest/注入顺序保证）
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  // 检查 core 是否已加载，如果未加载则尝试延迟检查
  function checkPetManager() {
    if (typeof window.PetManager !== 'undefined') {
      return true;
    }
    return false;
  }

  // 立即检查
  if (!checkPetManager()) {
    // 如果立即检查失败，尝试延迟检查（可能由于异步加载导致）
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 100; // 100ms

    const retryCheck = setInterval(() => {
      retryCount++;
      if (checkPetManager()) {
        clearInterval(retryCheck);
        return;
      }
      
      if (retryCount >= maxRetries) {
        clearInterval(retryCheck);
        // eslint-disable-next-line no-console
        console.error(
          '[PetManager] 未检测到 window.PetManager：请确认 content/petManager.core.js 在本文件之前注入',
          '\n诊断信息：',
          '\n- window 对象:', typeof window !== 'undefined' ? '存在' : '不存在',
          '\n- PET_CONFIG:', typeof PET_CONFIG !== 'undefined' ? '已定义' : '未定义',
          '\n- 已加载的脚本:', Array.from(document.scripts).map(s => s.src || s.textContent.substring(0, 50)).join(', ')
        );
      }
    }, retryDelay);
  }
})();

