/**
 * Shared Utilities Index
 * 共享工具模块入口文件
 */

// 通用工具
export * from './common/index.js';

// API工具
export * from './api/index.js';

// 存储工具
export * from './storage/index.js';

// 验证工具
export * from './validation/index.js';

// 格式化工具
export * from './format/index.js';

// 加密工具
export * from './crypto/index.js';

// 网络工具
export * from './network/index.js';

// 时间工具
export * from './time/index.js';

// 文件工具
export * from './file/index.js';

// 字符串工具
export * from './string/index.js';

// 数组工具
export * from './array/index.js';

// 对象工具
export * from './object/index.js';

// 事件工具
export * from './event/index.js';

// DOM工具
export * from './dom/index.js';

// 浏览器工具
export * from './browser/index.js';

// 默认导出
export default {
    // 通用工具
    ...require('./common/index.js'),
    
    // API工具
    ...require('./api/index.js'),
    
    // 存储工具
    ...require('./storage/index.js'),
    
    // 验证工具
    ...require('./validation/index.js'),
    
    // 格式化工具
    ...require('./format/index.js'),
    
    // 加密工具
    ...require('./crypto/index.js'),
    
    // 网络工具
    ...require('./network/index.js'),
    
    // 时间工具
    ...require('./time/index.js'),
    
    // 文件工具
    ...require('./file/index.js'),
    
    // 字符串工具
    ...require('./string/index.js'),
    
    // 数组工具
    ...require('./array/index.js'),
    
    // 对象工具
    ...require('./object/index.js'),
    
    // 事件工具
    ...require('./event/index.js'),
    
    // DOM工具
    ...require('./dom/index.js'),
    
    // 浏览器工具
    ...require('./browser/index.js')
};