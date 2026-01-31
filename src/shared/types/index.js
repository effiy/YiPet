/**
 * Shared Types Index
 * 共享类型模块入口文件
 */

// 基础类型
export * from './base.js';

// API类型
export * from './api.js';

// 状态类型
export * from './state.js';

// 事件类型
export * from './events.js';

// 错误类型
export * from './errors.js';

// 配置类型
export * from './config.js';

// 主题类型
export * from './theme.js';

// 存储类型
export * from './storage.js';

// 默认导出
export default {
    ...require('./base.js'),
    ...require('./api.js'),
    ...require('./state.js'),
    ...require('./events.js'),
    ...require('./errors.js'),
    ...require('./config.js'),
    ...require('./theme.js'),
    ...require('./storage.js')
};