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

  // core 没加载时给出明显提示，避免 silent failure
  if (typeof window.PetManager === 'undefined') {
    // eslint-disable-next-line no-console
    console.error(
      '[PetManager] 未检测到 window.PetManager：请确认 content/petManager.core.js 在本文件之前注入'
    );
    return;
  }
})();


