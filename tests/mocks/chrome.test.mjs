/**
 * Chrome API Mock Verification Tests — TC40–TC43
 * TC40: storage.local.get returns mock data
 * TC41: storage.local.set persists to memory
 * TC42: runtime.onMessage listener receives events
 * TC43: runtime.sendMessage returns response
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeMock, resetChromeMock, setStorageValue, getStorageValue, clearStorage } from './chrome.mjs';

describe('Chrome API Mock', () => {
  beforeEach(() => {
    globalThis.chrome = createChromeMock();
    resetChromeMock();
    clearStorage();
  });

  it('TC40: storage.local.get returns preset mock data', () => {
    setStorageValue('k', 'v');
    let resultVal;
    chrome.storage.local.get('k', (result) => {
      resultVal = result['k'];
    });
    expect(resultVal).toBe('v');
  });

  it('TC41: storage.local.set persists to memory and can be retrieved', () => {
    let getResult;
    chrome.storage.local.set({ k: 'v' }, () => {
      chrome.storage.local.get('k', (result) => {
        getResult = result['k'];
      });
    });
    expect(getResult).toBe('v');
  });

  it('TC42: runtime.onMessage listener is called on sendMessage', async () => {
    let received = null;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      received = message;
      sendResponse({ ok: true });
    });

    await chrome.runtime.sendMessage({ action: 'test' });
    expect(received).toEqual({ action: 'test' });
  });

  it('TC43: runtime.sendMessage returns listener response', async () => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      sendResponse({ ok: true });
    });

    const result = await chrome.runtime.sendMessage({ action: 'ping' });
    expect(result).toEqual({ ok: true });
  });
});