/**
 * TokenManager Unit Tests — TC1–TC9
 * TC1: window.__API_X_TOKEN__ fetch
 * TC2: chrome.storage.local fallback
 * TC3: no token returns empty
 * TC4: memory cache hit
 * TC5: validateToken valid
 * TC6: validateToken blank
 * TC7: saveToken to storage
 * TC8: clearToken
 * TC9: storage API exception handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadModule } from '../../helpers/load-module.mjs';
import { setStorageValue, setRuntimeError, clearStorage } from '../../mocks/chrome.mjs';

// The real TokenManager._getEnvToken() checks process.env.API_X_TOKEN (Node.js env).
// Delete it so tests don't inherit the dev token.
beforeEach(async () => {
  clearStorage();
  delete window.__API_X_TOKEN__;
  // Block process.env.API_X_TOKEN leak
  if (typeof process !== 'undefined' && process.env) {
    delete process.env.API_X_TOKEN;
  }
  await loadModule('core/utils/api/token.js', globalThis);
});

describe('TokenManager', () => {
  describe('getToken() — three-tier fallback', () => {
    it('TC1: returns token from window.__API_X_TOKEN__', async () => {
      window.__API_X_TOKEN__ = 'sk-test123';
      const tm = new globalThis.TokenManager();
      const token = await tm.getToken();
      expect(token).toBe('sk-test123');
      delete window.__API_X_TOKEN__;
    });

    it('TC2: falls back to chrome.storage.local when window var is empty', async () => {
      setStorageValue('YiPet.apiToken.v1', 'sk-from-storage');
      const tm = new globalThis.TokenManager();
      const token = await tm.getToken();
      expect(token).toBe('sk-from-storage');
    });

    it('TC3: returns empty string when no token exists', async () => {
      const tm = new globalThis.TokenManager();
      const token = await tm.getToken();
      expect(token).toBe('');
    });

    it('TC4: getToken always reads from storage, not cache', async () => {
      setStorageValue('YiPet.apiToken.v1', 'sk-cached');
      const tm = new globalThis.TokenManager();
      const first = await tm.getToken();
      expect(first).toBe('sk-cached');
      clearStorage();
      const second = await tm.getToken();
      expect(second).toBe('');
    });
  });

  describe('validateToken()', () => {
    it('TC5: returns true for valid token', () => {
      const tm = new globalThis.TokenManager();
      expect(tm.validateToken('sk-test123456')).toBe(true);
    });

    it('TC6: returns false for blank token', () => {
      const tm = new globalThis.TokenManager();
      expect(tm.validateToken('')).toBe(false);
      expect(tm.validateToken('   ')).toBe(false);
      expect(tm.validateToken(null)).toBe(false);
    });
  });

  describe('saveToken()', () => {
    it('TC7: saves token to chrome.storage.local', async () => {
      const tm = new globalThis.TokenManager();
      const result = await tm.saveToken('sk-new');
      const token = await tm.getToken();
      expect(token).toBe('sk-new');
    });
  });

  describe('clearToken()', () => {
    it('TC8: clears token from storage', async () => {
      setStorageValue('YiPet.apiToken.v1', 'sk-to-clear');
      const tm = new globalThis.TokenManager();
      await tm.clearToken();
      const token = await tm.getToken();
      expect(token).toBe('');
    });
  });

  describe('getToken() — error handling', () => {
    it('TC9: returns empty string on storage API failure', async () => {
      setStorageValue('YiPet.apiToken.v1', 'sk-error');
      const tm = new globalThis.TokenManager();
      // Set error after _initCache so getToken() sees it
      setRuntimeError('Storage error');
      const token = await tm.getToken();
      expect(token).toBe('');
    });
  });
});