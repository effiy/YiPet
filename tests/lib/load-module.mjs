/**
 * tests/lib/load-module.mjs — 规范 IIFE 模块加载器
 *
 * 读取源文件并在受控作用域中 eval，使全局变量注册到指定 target 对象。
 * 这是项目唯一的 loadModule 实现，所有测试文件统一使用此版本。
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

/**
 * 加载 IIFE 模块到测试上下文
 * @param {string} relativePath - 相对于项目根目录的路径
 * @param {object} [target]     - 目标对象，默认为 globalThis
 * @returns {object} target
 */
export function loadModule (relativePath, target = globalThis) {
  const fullPath = resolve(projectRoot, relativePath);
  const source = readFileSync(fullPath, 'utf-8');
  const fn = new Function(
    'globalThis', 'self', 'window', 'chrome',
    'AbortController', 'AbortSignal', 'fetch',
    'setTimeout', 'clearTimeout', 'Promise', 'console', 'location',
    'importScripts',
    'PET_CONFIG', 'LoggerUtils', 'ErrorHandler',
    `${source}\n//# sourceURL=${fullPath}`
  );
  fn(
    target,
    target,
    target,
    target.chrome,
    target.AbortController,
    target.AbortSignal,
    target.fetch,
    target.setTimeout,
    target.clearTimeout,
    target.Promise,
    target.console,
    target.location,
    target.importScripts || (() => {}),
    target.PET_CONFIG,
    target.LoggerUtils,
    target.ErrorHandler
  );
  return target;
}
