import { describe, it, expect, beforeEach } from 'vitest'

// Load config.js (non-IIFE, sets PET_CONFIG on globalThis)
loadModule('core/config.js')

beforeEach(() => {
  // Reload config for clean state
  delete globalThis.PET_CONFIG
  delete globalThis.PET_ENV
  delete globalThis.window?.__PET_ENV_MODE__
  loadModule('core/config.js')
})

describe('DEFAULT_CONFIG structure', () => {
  it('has all top-level sections', () => {
    const cfg = globalThis.PET_CONFIG
    expect(cfg).toBeDefined()
    expect(cfg.pet).toBeDefined()
    expect(cfg.chatWindow).toBeDefined()
    expect(cfg.animation).toBeDefined()
    expect(cfg.storage).toBeDefined()
    expect(cfg.ui).toBeDefined()
    expect(cfg.api).toBeDefined()
    expect(cfg.chatModels).toBeDefined()
    expect(cfg.env).toBeDefined()
    expect(cfg.constants).toBeDefined()
  })

  it('pet section has required fields', () => {
    const pet = globalThis.PET_CONFIG.pet
    expect(pet.colors).toHaveLength(5)
    expect(pet.sizeLimits.min).toBe(80)
    expect(pet.sizeLimits.max).toBe(400)
  })

  it('chatWindow section has required fields', () => {
    const cw = globalThis.PET_CONFIG.chatWindow
    expect(cw.defaultSize.width).toBe(700)
    expect(cw.defaultSize.height).toBe(720)
  })

  it('constants has required sub-sections', () => {
    const c = globalThis.PET_CONFIG.constants
    expect(c.TIMING).toBeDefined()
    expect(c.RETRY).toBeDefined()
    expect(c.STORAGE).toBeDefined()
    expect(c.URLS).toBeDefined()
    expect(c.UI).toBeDefined()
    expect(c.DEFAULTS).toBeDefined()
    expect(c.ERROR_MESSAGES).toBeDefined()
  })

  it('PET_CONFIG has ENDPOINTS', () => {
    expect(globalThis.PET_CONFIG.ENDPOINTS).toBeDefined()
    expect(globalThis.PET_CONFIG.ENDPOINTS.BASE_ENDPOINTS).toBeDefined()
    expect(globalThis.PET_CONFIG.ENDPOINTS.SESSION_ENDPOINTS).toBeDefined()
  })
})

describe('buildUrl', () => {
  it('replaces :id placeholder in endpoint', () => {
    const url = globalThis.PET_CONFIG.buildUrl('http://example.com', '/sessions/:id', { id: 'abc123' })
    expect(url).toBe('http://example.com/sessions/abc123')
  })

  it('replaces multiple placeholders', () => {
    const url = globalThis.PET_CONFIG.buildUrl('http://example.com', '/users/:uid/posts/:pid', { uid: '1', pid: '2' })
    expect(url).toBe('http://example.com/users/1/posts/2')
  })

  it('strips trailing slash from baseUrl', () => {
    const url = globalThis.PET_CONFIG.buildUrl('http://example.com/', '/users', {})
    expect(url).toBe('http://example.com/users')
  })

  it('strips leading slash from endpoint when combining', () => {
    const url = globalThis.PET_CONFIG.buildUrl('http://example.com/api', '/users', {})
    expect(url).toBe('http://example.com/api/users')
  })

  it('returns full URL when endpoint starts with http', () => {
    const url = globalThis.PET_CONFIG.buildUrl('http://example.com', 'https://other.com/path', {})
    expect(url).toBe('https://other.com/path')
  })

  it('handles empty params', () => {
    const url = globalThis.PET_CONFIG.buildUrl('http://example.com', '/users', {})
    expect(url).toBe('http://example.com/users')
  })
})

describe('buildQueryParams', () => {
  it('builds query string from params', () => {
    const qs = globalThis.PET_CONFIG.buildQueryParams({ a: '1', b: '2' })
    expect(qs).toContain('a=1')
    expect(qs).toContain('b=2')
  })

  it('filters null and undefined values', () => {
    const qs = globalThis.PET_CONFIG.buildQueryParams({ a: '1', b: null, c: undefined })
    expect(qs).toBe('a=1')
  })

  it('JSON serializes objects', () => {
    const qs = globalThis.PET_CONFIG.buildQueryParams({ filter: { name: 'test' } })
    expect(qs).toContain('filter=%7B%22name%22%3A%22test%22%7D')
  })

  it('returns empty string for empty params', () => {
    expect(globalThis.PET_CONFIG.buildQueryParams({})).toBe('')
  })
})

describe('buildDatabaseUrl', () => {
  it('constructs database query URL', () => {
    const url = globalThis.PET_CONFIG.buildDatabaseUrl('http://example.com', 'getData', { id: 1 })
    expect(url).toContain('module_name=services.database.data_service')
    expect(url).toContain('method_name=getData')
    expect(url).toContain('parameters=%7B%22id%22%3A1%7D')
  })

  it('handles empty parameters', () => {
    const url = globalThis.PET_CONFIG.buildDatabaseUrl('http://example.com', 'listAll')
    expect(url).toContain('parameters=%7B%7D')
  })
})

describe('env detection', () => {
  it('defaults to production mode', () => {
    expect(globalThis.PET_CONFIG.envInfo.mode).toBe('production')
  })

  it('uses window.__PET_ENV_MODE__ if set', () => {
    delete globalThis.PET_CONFIG
    globalThis.window = globalThis.window || {}
    globalThis.window.__PET_ENV_MODE__ = 'staging'
    loadModule('core/config.js')
    expect(globalThis.PET_CONFIG.envInfo.mode).toBe('staging')
    delete globalThis.window.__PET_ENV_MODE__
  })

  it('endpoints change based on env mode', () => {
    delete globalThis.PET_CONFIG
    globalThis.window = globalThis.window || {}
    globalThis.window.__PET_ENV_MODE__ = 'development'
    loadModule('core/config.js')
    expect(globalThis.PET_CONFIG.api.yiaiBaseUrl).toBe('http://localhost:8000')
    delete globalThis.window.__PET_ENV_MODE__
  })
})
