/**
 * StorageHelper Unit Tests — TC21–TC25
 * TC21: storage get success
 * TC22: storage set success
 * TC23: cleanupOldData removes expired data
 * TC24: quota exceeded triggers cleanup and retry
 * TC25: context invalidation guard
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadModule } from '../../helpers/load-module.mjs';
import { setStorageValue, getStorageValue, clearStorage, setRuntimeError } from '../../mocks/chrome.mjs';

describe('StorageHelper', () => {
  beforeEach(async () => {
    clearStorage();
    window.ErrorHandler = {
      isQuotaError: () => false,
      isContextInvalidated: () => false,
    };
    window.LoggerUtils = {
      initMuteLogger: () => {},
    };
    window.PET_CONFIG = {
      constants: {
        storageKeys: { devMode: 'petDevMode' },
      },
    };
    await loadModule('core/bootstrap/bootstrap.js', window);
  });

  describe('get()', () => {
    it('TC21: returns value from chrome.storage.local', async () => {
      setStorageValue('testKey', 'testVal');
      const result = await window.StorageHelper.get('testKey');
      expect(result).toBe('testVal');
    });
  });

  describe('set()', () => {
    it('TC22: sets value in chrome.storage.local', async () => {
      const result = await window.StorageHelper.set('k', 'v');
      expect(result.success).toBe(true);
      expect(getStorageValue('k')).toBe('v');
    });
  });

  describe('cleanupOldData()', () => {
    it('TC23: removes expired petOssFiles data', async () => {
      setStorageValue('petOssFiles', { old: true });
      await window.StorageHelper.cleanupOldData();
      expect(getStorageValue('petOssFiles')).toBeUndefined();
    });
  });

  describe('set() — quota handling', () => {
    it('TC24: triggers cleanup on quota exceeded', async () => {
      let callCount = 0;
      window.ErrorHandler.isQuotaError = () => {
        callCount++;
        if (callCount <= 1) {
          chrome.runtime.lastError = null;
          return true;
        }
        return false;
      };
      window.ErrorHandler.isContextInvalidated = () => false;

      // Pre-populate petOssFiles for cleanupOldData to remove
      setStorageValue('petOssFiles', { large: 'data' });

      // Inject runtime error to trigger the error path in set's callback
      setRuntimeError('Quota exceeded');
      const result = await window.StorageHelper.set('k', 'bigValue');
      expect(result.success).toBe(true);
      expect(result.retried).toBe(true);
    });
  });

  describe('set() — context invalidation', () => {
    it('TC25: handles context invalidation gracefully', async () => {
      window.ErrorHandler.isContextInvalidated = () => true;
      window.ErrorHandler.isQuotaError = () => false;

      // Inject runtime error so set's callback enters _handleStorageError
      setRuntimeError('Extension context invalidated');
      const result = await window.StorageHelper.set('k', 'v');
      expect(result.success).toBe(false);
      expect(result.contextInvalidated).toBe(true);
    });
  });
});