/**
 * API Endpoints (Compatibility Layer)
 *
 * 此文件已迁移到 core/config.js，保留以确保向后兼容
 * 所有配置现在统一在 PET_CONFIG.ENDPOINTS 中管理
 */
(function (root) {
  function init() {
    if (typeof root.PET_CONFIG === 'undefined' || !root.PET_CONFIG.ENDPOINTS) {
      console.warn('[endpoints] PET_CONFIG not ready, retrying...')
      setTimeout(init, 50)
      return
    }

    root.BASE_ENDPOINTS = root.PET_CONFIG.ENDPOINTS.BASE_ENDPOINTS
    root.AUTH_ENDPOINTS = root.PET_CONFIG.ENDPOINTS.AUTH_ENDPOINTS
    root.SESSION_ENDPOINTS = root.PET_CONFIG.ENDPOINTS.SESSION_ENDPOINTS
    root.FAQ_ENDPOINTS = root.PET_CONFIG.ENDPOINTS.FAQ_ENDPOINTS
    root.CONFIG_ENDPOINTS = root.PET_CONFIG.ENDPOINTS.CONFIG_ENDPOINTS
    root.DATABASE_ENDPOINTS = root.PET_CONFIG.ENDPOINTS.DATABASE_ENDPOINTS

    root.buildUrl = root.PET_CONFIG.buildUrl
    root.buildQueryParams = root.PET_CONFIG.buildQueryParams
    root.buildDatabaseUrl = root.PET_CONFIG.buildDatabaseUrl

    console.log('[endpoints] Compatibility layer loaded from PET_CONFIG')
  }

  init()
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window))
