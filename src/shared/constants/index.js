/**
 * Shared Constants Index
 * 共享常量模块入口文件
 */

// 应用常量
export * from './app.js';

// API常量
export * from './api.js';

// 存储常量
export * from './storage.js';

// 错误常量
export * from './errors.js';

// 事件常量
export * from './events.js';

// 配置常量
export * from './config.js';

// 主题常量
export * from './theme.js';

// 默认导出
export default {
    ...require('./app.js'),
    ...require('./api.js'),
    ...require('./storage.js'),
    ...require('./errors.js'),
    ...require('./events.js'),
    ...require('./config.js'),
    ...require('./theme.js')
};