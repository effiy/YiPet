/**
 * IIFE module loader for tests.
 * Reads source files and evals them in a controlled scope so globals are
 * registered on the provided target object (default: globalThis).
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

export function loadModule (relativePath, target = globalThis) {
  const fullPath = resolve(projectRoot, relativePath);
  const source = readFileSync(fullPath, 'utf-8');
  const fn = new Function('globalThis', 'self', 'window', 'chrome', 'AbortController', 'AbortSignal', 'fetch', 'setTimeout', 'clearTimeout', 'Promise', 'console', 'location', 'importScripts', 'PET_CONFIG', 'LoggerUtils', 'ErrorHandler',
    `${source}\n//# sourceURL=${fullPath}`);
  fn(target, target, target, target.chrome, target.AbortController, target.AbortSignal, target.fetch, target.setTimeout, target.clearTimeout, target.Promise, target.console, target.location, target.importScripts || (() => {}), target.PET_CONFIG, target.LoggerUtils, target.ErrorHandler);
  return target;
}