import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(() => {
  delete globalThis.TokenManager
  delete globalThis.createTokenManager
  delete globalThis.tokenManager
  delete globalThis.TokenUtils
  delete globalThis.window?.__API_X_TOKEN__
  if (typeof process !== 'undefined' && process.env) {
    delete process.env.API_X_TOKEN
  }
  loadModule('core/utils/api/token.js')
})

describe('TokenManager constructor', () => {
  it('creates instance with default storageKey', () => {
    const tm = new globalThis.TokenManager()
    expect(tm.storageKey).toBe('YiPet.apiToken.v1')
  })

  it('accepts custom storageKey', () => {
    const tm = new globalThis.TokenManager({ storageKey: 'custom.key' })
    expect(tm.storageKey).toBe('custom.key')
  })
})

describe('TokenManager.validateToken', () => {
  let tm
  beforeEach(() => {
    tm = new globalThis.TokenManager()
  })

  it('rejects null/undefined', () => {
    expect(tm.validateToken(null)).toBe(false)
    expect(tm.validateToken(undefined)).toBe(false)
  })

  it('rejects non-string types', () => {
    expect(tm.validateToken(12345)).toBe(false)
    expect(tm.validateToken({})).toBe(false)
  })

  it('rejects empty string', () => {
    expect(tm.validateToken('')).toBe(false)
  })

  it('rejects short tokens (< 10 chars)', () => {
    expect(tm.validateToken('abc123')).toBe(false)
    expect(tm.validateToken('123456789')).toBe(false)
  })

  it('accepts valid token (>= 10 chars, alphanumeric + _ -)', () => {
    expect(tm.validateToken('abc123-def_456')).toBe(true)
    expect(tm.validateToken('validToken1234567890')).toBe(true)
  })

  it('rejects tokens with invalid characters', () => {
    expect(tm.validateToken('token with spaces!!')).toBe(false)
    expect(tm.validateToken('token@#$%^&*()')).toBe(false)
  })
})

describe('TokenManager 3-level token fallback', () => {
  it('getTokenSync returns env token when set', () => {
    globalThis.window = globalThis.window || {}
    globalThis.window.__API_X_TOKEN__ = 'env-token-value-123'
    const tm = new globalThis.TokenManager()
    expect(tm.getTokenSync()).toBe('env-token-value-123')
    delete globalThis.window.__API_X_TOKEN__
  })

  it('getTokenSync returns empty when no token set', () => {
    const tm = new globalThis.TokenManager()
    expect(tm.getTokenSync()).toBe('')
  })

  it('getToken returns token from chrome.storage', async () => {
    clearChromeStorage()
    const storageKey = 'YiPet.apiToken.v1'
    chrome.storage.local.set({ [storageKey]: 'stored-token-abc' }, () => {})
    const tm = new globalThis.TokenManager()
    // Force cache to be uninitialized since we have no env token
    tm._cachedToken = ''
    tm._cacheInitialized = false
    const token = await tm.getToken()
    expect(token).toBe('stored-token-abc')
  })

  it('getToken returns empty when storage is empty', async () => {
    clearChromeStorage()
    const tm = new globalThis.TokenManager()
    tm._cachedToken = ''
    tm._cacheInitialized = false
    const token = await tm.getToken()
    expect(token).toBe('')
  })
})

describe('TokenManager save/clear', () => {
  it('saveToken stores and caches token', async () => {
    const tm = new globalThis.TokenManager()
    const result = await tm.saveToken('my-new-token-xyz')
    expect(result).toBe(true)
    expect(tm._cachedToken).toBe('my-new-token-xyz')
  })

  it('clearToken removes from cache and storage', async () => {
    const tm = new globalThis.TokenManager()
    await tm.saveToken('token-to-clear')
    const result = await tm.clearToken()
    expect(result).toBe(true)
    expect(tm._cachedToken).toBe('')
  })

  it('hasTokenSync returns true when token exists', async () => {
    const tm = new globalThis.TokenManager()
    await tm.saveToken('some-token-value')
    expect(tm.hasTokenSync()).toBe(true)
  })

  it('hasTokenSync returns false when no token', () => {
    const tm = new globalThis.TokenManager()
    tm._cachedToken = ''
    expect(tm.hasTokenSync()).toBeFalsy()
  })
})

describe('TokenUtils convenience', () => {
  it('TokenUtils exports are defined', () => {
    expect(globalThis.TokenUtils).toBeDefined()
    expect(globalThis.TokenUtils.getApiToken).toBeDefined()
    expect(globalThis.TokenUtils.getApiTokenSync).toBeDefined()
    expect(globalThis.TokenUtils.saveApiToken).toBeDefined()
    expect(globalThis.TokenUtils.hasApiToken).toBeDefined()
    expect(globalThis.TokenUtils.hasApiTokenSync).toBeDefined()
  })

  it('createTokenManager creates independent instance', () => {
    const tm = globalThis.createTokenManager({ storageKey: 'test.key' })
    expect(tm).toBeInstanceOf(globalThis.TokenManager)
    expect(tm.storageKey).toBe('test.key')
  })
})
