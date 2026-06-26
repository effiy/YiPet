/**
 * Token 管理器
 * 提供 API Token 的获取、存储、验证等功能
 *
 * 降级链：环境变量 → chrome.storage.local → 空 token
 */
;(function (root) {
  class TokenManager {
    constructor(options = {}) {
      this.storageKey = options.storageKey || 'YiPet.apiToken.v1'
      this._cachedToken = ''
      this._cacheInitialized = false
      this._envTokenCache = undefined // undefined = 未探测, '' = 探测过无结果

      this._initCache()
    }

    /* ═══════════════════════ 内部：Token 来源解析 ═══════════════════════ */

    /**
     * 从环境变量获取 Token（结果缓存，只探测一次）
     * @returns {string} token 或空字符串
     */
    _getEnvToken() {
      if (this._envTokenCache !== undefined) return this._envTokenCache

      try {
        // 检查 window.__API_X_TOKEN__（content script 环境）
        if (typeof window !== 'undefined' && window.__API_X_TOKEN__) {
          const token = String(window.__API_X_TOKEN__).trim()
          if (token) { this._envTokenCache = token; return token }
        }
        // 检查 process.env.API_X_TOKEN（Node.js 环境）
        if (typeof process !== 'undefined' && process.env && process.env.API_X_TOKEN) {
          const token = String(process.env.API_X_TOKEN).trim()
          if (token) { this._envTokenCache = token; return token }
        }
        // 检查 self.__API_X_TOKEN__（Service Worker 环境）
        if (typeof self !== 'undefined' && self.__API_X_TOKEN__) {
          const token = String(self.__API_X_TOKEN__).trim()
          if (token) { this._envTokenCache = token; return token }
        }
      } catch (e) {
        console.warn('获取环境变量 Token 失败:', e)
      }

      this._envTokenCache = ''
      return ''
    }

    /**
     * 检查 Chrome 存储是否可用
     * @returns {boolean}
     */
    _isChromeStorageAvailable() {
      try {
        return (
          typeof chrome !== 'undefined' &&
          chrome.storage && chrome.storage.local &&
          chrome.runtime && chrome.runtime.id
        )
      } catch (error) {
        return false
      }
    }

    /**
     * 统一从 chrome.storage 读取 token（返回 Promise）
     * @returns {Promise<string>}
     */
    _readFromChromeStorage() {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.get([this.storageKey], (result) => {
            if (chrome.runtime.lastError) { resolve(''); return }
            const token = result[this.storageKey]
            resolve(token ? String(token).trim() : '')
          })
        } catch (error) {
          resolve('')
        }
      })
    }

    /**
     * 统一从 chrome.storage 写入 token（返回 Promise<boolean>）
     * @param {string} token
     * @returns {Promise<boolean>}
     */
    _writeToChromeStorage(token) {
      return new Promise((resolve) => {
        try {
          chrome.storage.local.set({ [this.storageKey]: token }, () => {
            resolve(!chrome.runtime.lastError)
          })
        } catch (error) {
          resolve(false)
        }
      })
    }

    /**
     * 解析 token：env → chrome.storage → 空
     * 统一 _initCache（同步初始化）和 getToken（异步获取）的降级链
     * @param {string} mode - 'sync-init' | 'async-full'
     * @returns {string|Promise<string>}
     */
    _resolveToken(mode) {
      // L1: 环境变量（同步，结果已缓存）
      const envToken = this._getEnvToken()
      if (envToken) {
        this._cachedToken = envToken
        this._cacheInitialized = true
        return mode === 'async-full' ? Promise.resolve(envToken) : envToken
      }

      // L2: chrome.storage
      if (!this._isChromeStorageAvailable()) {
        this._cacheInitialized = true
        return mode === 'async-full' ? Promise.resolve('') : ''
      }

      if (mode === 'sync-init') {
        // 同步初始化：发起异步读取，不阻塞
        this._readFromChromeStorage().then((token) => {
          this._cachedToken = token
          this._cacheInitialized = true
        })
        return ''
      }

      // 异步完整获取：等待 chrome.storage 结果
      return this._readFromChromeStorage().then((token) => {
        this._cachedToken = token
        this._cacheInitialized = true
        return token
      })
    }

    /* ═══════════════════════ 初始化 ═══════════════════════ */

    _initCache() {
      this._resolveToken('sync-init')
    }

    /* ═══════════════════════ 公开 API：同步 ═══════════════════════ */

    /**
     * 获取 Token（同步）
     * @returns {string}
     */
    getTokenSync() {
      const envToken = this._getEnvToken()
      if (envToken) return envToken

      if (!this._cacheInitialized) this._initCache()
      return this._cachedToken
    }

    /**
     * 是否有 Token（同步）
     * @returns {boolean}
     */
    hasTokenSync() {
      const envToken = this._getEnvToken()
      if (envToken) return true

      const token = this.getTokenSync()
      return token && token.trim().length > 0
    }

    /* ═══════════════════════ 公开 API：异步 ═══════════════════════ */

    /**
     * 获取 Token（异步，含 chrome.storage 回退）
     * @returns {Promise<string>}
     */
    async getToken() {
      const envToken = this._getEnvToken()
      if (envToken) return envToken

      if (!this._isChromeStorageAvailable()) return this._cachedToken
      return this._readFromChromeStorage().then((token) => {
        this._cachedToken = token
        this._cacheInitialized = true
        return token
      })
    }

    /**
     * 是否有 Token（异步）
     * @returns {Promise<boolean>}
     */
    async hasToken() {
      const envToken = this._getEnvToken()
      if (envToken) return true

      const token = await this.getToken()
      return token && token.trim().length > 0
    }

    /* ═══════════════════════ 公开 API：写入 ═══════════════════════ */

    /**
     * 保存 Token
     * @param {string} token
     * @returns {Promise<boolean>}
     */
    async saveToken(token) {
      const tokenValue = String(token || '').trim()
      this._cachedToken = tokenValue
      this._cacheInitialized = true
      // 同时清除 env token 缓存，让下次 _getEnvToken 重新探测
      this._envTokenCache = undefined

      if (!this._isChromeStorageAvailable()) return false
      return this._writeToChromeStorage(tokenValue)
    }

    /**
     * 清除 Token
     * @returns {Promise<boolean>}
     */
    async clearToken() {
      this._cachedToken = ''
      this._envTokenCache = undefined

      if (this._isChromeStorageAvailable()) {
        return new Promise((resolve) => {
          try {
            chrome.storage.local.remove([this.storageKey], () => {
              resolve(!chrome.runtime.lastError)
            })
          } catch (error) {
            resolve(false)
          }
        })
      }

      return true
    }

    /* ═══════════════════════ 公开 API：验证 ═══════════════════════ */

    /**
     * 确保 Token 已设置（触发 UI 交互）
     * @returns {Promise<boolean>}
     */
    async ensureTokenSet() {
      const hasToken = await this.hasToken()
      if (!hasToken) {
        if (typeof window !== 'undefined' && window.petManager) {
          try {
            await window.petManager.ensureTokenSet()
            return await this.hasToken()
          } catch (error) {
            console.warn('调用 PetManager.ensureTokenSet 失败:', error)
          }
        }
      }
      return hasToken
    }

    /**
     * 验证 Token 格式
     * @param {string} token
     * @returns {boolean}
     */
    validateToken(token) {
      if (!token || typeof token !== 'string') return false

      const trimmedToken = token.trim()
      if (trimmedToken.length < 10) return false

      const tokenPattern = /^[a-zA-Z0-9_-]+$/
      return tokenPattern.test(trimmedToken)
    }
  }

  /* ═══════════════════════ 工厂 & 导出 ═══════════════════════ */

  function createTokenManager(options = {}) {
    return new TokenManager(options)
  }

  const tokenManager = createTokenManager()

  const TokenUtils = {
    async getApiToken()       { return await tokenManager.getToken() },
    getApiTokenSync()         { return tokenManager.getTokenSync() },
    async saveApiToken(token) { return await tokenManager.saveToken(token) },
    async hasApiToken()       { return await tokenManager.hasToken() },
    hasApiTokenSync()         { return tokenManager.hasTokenSync() },
    async ensureTokenSet()    { return await tokenManager.ensureTokenSet() },
  }

  root.TokenManager = TokenManager
  root.createTokenManager = createTokenManager
  root.tokenManager = tokenManager
  root.TokenUtils = TokenUtils
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : window)
