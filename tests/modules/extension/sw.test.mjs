/**
 * Service Worker Message Routing Tests — TC26–TC33
 * TC26: getToken action
 * TC27: setToken action
 * TC28: getSessions action
 * TC29: createSession action
 * TC30: getFaqs action
 * TC31: updateFaq action
 * TC32: invalid action
 * TC33: handler exception
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setupChromeMock, resetChromeMock, setStorageValue } from '../../lib/chrome-mock.mjs'

/**
 * MessageRouter — a simplified router matching the SW pattern.
 * In the real SW, MessageRouter is loaded via importScripts. Here we
 * define a minimal implementation for testing the routing contract.
 */
class MessageRouter {
  constructor() {
    this._routes = new Map()
  }

  register(action, handler, asyncFlag) {
    this._routes.set(action, { handler, async: !!asyncFlag })
  }

  handle(request, sender, sendResponse) {
    const route = this._routes.get(request.action)
    if (!route) {
      sendResponse({ success: false, error: `Unknown action: ${request.action}` })
      return
    }
    try {
      const result = route.handler(request, sender, sendResponse)
      if (route.async) return true
      return result
    } catch (e) {
      sendResponse({ success: false, error: e.message })
    }
  }
}

// Token store (simulates what SW would have)
let swToken = ''
const sessions = []
const faqs = []

function setupSWRoutes(router) {
  router.register('getToken', (request, sender, sendResponse) => {
    sendResponse({ success: true, data: swToken })
  })

  router.register('setToken', (request, sender, sendResponse) => {
    swToken = request.token
    sendResponse({ success: true })
  })

  router.register('getSessions', (request, sender, sendResponse) => {
    sendResponse({ success: true, data: sessions })
  })

  router.register('createSession', (request, sender, sendResponse) => {
    const session = { id: Date.now(), name: request.name, messages: [] }
    sessions.push(session)
    sendResponse({ success: true, data: session })
  })

  router.register('getFaqs', (request, sender, sendResponse) => {
    sendResponse({ success: true, data: faqs })
  })

  router.register('updateFaq', (request, sender, sendResponse) => {
    const { id, ...rest } = request.data
    const idx = faqs.findIndex((f) => f.id === id)
    if (idx >= 0) {
      faqs[idx] = { ...faqs[idx], ...rest }
    } else {
      faqs.push({ id: id || Date.now(), ...rest })
    }
    sendResponse({ success: true, data: faqs[idx >= 0 ? idx : faqs.length - 1] })
  })
}

describe('Service Worker Message Routing', () => {
  let router

  beforeEach(() => {
    swToken = ''
    sessions.length = 0
    faqs.length = 0
    router = new MessageRouter()
    setupSWRoutes(router)
    setupChromeMock()
  })

  function sendMessage(message) {
    return new Promise((resolve) => {
      globalThis.chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        const result = router.handle(request, sender, sendResponse)
        if (result === true) return // async handler
        resolve(sendResponse._response || undefined)
      })
      // Dispatch
      globalThis.chrome.runtime.sendMessage(message).then(resolve)
    })
  }

  it('TC26: getToken returns stored token', async () => {
    swToken = 'sk-sw-token'
    // Direct handler test
    const response = await new Promise((resolve) => {
      router.handle({ action: 'getToken' }, { id: 'mock-sender' }, (r) => resolve(r))
    })
    expect(response.success).toBe(true)
    expect(response.data).toBe('sk-sw-token')
  })

  it('TC27: setToken saves token', async () => {
    await new Promise((resolve) => {
      router.handle({ action: 'setToken', token: 'sk-new' }, { id: 'mock-sender' }, (r) => resolve(r))
    })
    expect(swToken).toBe('sk-new')
  })

  it('TC28: getSessions returns session array', async () => {
    sessions.push({ id: 1, name: 'Test', messages: [] })
    const response = await new Promise((resolve) => {
      router.handle({ action: 'getSessions' }, { id: 'mock-sender' }, (r) => resolve(r))
    })
    expect(response.success).toBe(true)
    expect(Array.isArray(response.data)).toBe(true)
    expect(response.data).toHaveLength(1)
  })

  it('TC29: createSession creates and returns new session', async () => {
    const response = await new Promise((resolve) => {
      router.handle({ action: 'createSession', name: 'test' }, { id: 'mock-sender' }, (r) => resolve(r))
    })
    expect(response.success).toBe(true)
    expect(response.data.name).toBe('test')
    expect(sessions).toHaveLength(1)
  })

  it('TC30: getFaqs returns FAQ list', async () => {
    faqs.push({ id: 1, question: 'Q1', answer: 'A1' })
    const response = await new Promise((resolve) => {
      router.handle({ action: 'getFaqs' }, { id: 'mock-sender' }, (r) => resolve(r))
    })
    expect(response.success).toBe(true)
    expect(response.data).toHaveLength(1)
  })

  it('TC31: updateFaq updates existing FAQ', async () => {
    faqs.push({ id: 1, question: 'Old', answer: 'OldA' })
    const response = await new Promise((resolve) => {
      router.handle({ action: 'updateFaq', data: { id: 1, question: 'New' } }, { id: 'mock-sender' }, (r) => resolve(r))
    })
    expect(response.success).toBe(true)
    expect(response.data.question).toBe('New')
  })

  it('TC32: unknown action returns error', async () => {
    const response = await new Promise((resolve) => {
      router.handle({ action: 'unknownAction' }, { id: 'mock-sender' }, (r) => resolve(r))
    })
    expect(response.success).toBe(false)
    expect(response.error).toContain('Unknown action')
  })

  it('TC33: handler exception returns error without crashing', async () => {
    router.register('badAction', () => {
      throw new Error('Boom!')
    })
    const response = await new Promise((resolve) => {
      router.handle({ action: 'badAction' }, { id: 'mock-sender' }, (r) => resolve(r))
    })
    expect(response.success).toBe(false)
    expect(response.error).toBe('Boom!')
  })
})
