/**
 * Main Application Index
 * 主应用入口文件
 */

// 模块导出
export * as PetModule from './modules/pet/index.js';
export * as ChatModule from './modules/chat/index.js';
export * as ScreenshotModule from './modules/screenshot/index.js';
export * as MermaidModule from './modules/mermaid/index.js';
export * as FAQModule from './modules/faq/index.js';
export * as SessionModule from './modules/session/index.js';

// 共享资源导出
export * as SharedUtils from './shared/utils/index.js';
export * as SharedConstants from './shared/constants/index.js';
export * as SharedTypes from './shared/types/index.js';
export * as SharedAPI from './shared/api/index.js';

// 页面组件导出
export * as Pages from './pages/index.js';

// 核心应用导出
export { App } from './core/App.js';
export { AppManager } from './core/AppManager.js';
export { Router } from './core/Router.js';

// 默认导出
export default {
    // 模块
    PetModule: require('./modules/pet/index.js'),
    ChatModule: require('./modules/chat/index.js'),
    ScreenshotModule: require('./modules/screenshot/index.js'),
    MermaidModule: require('./modules/mermaid/index.js'),
    FAQModule: require('./modules/faq/index.js'),
    SessionModule: require('./modules/session/index.js'),
    
    // 共享资源
    SharedUtils: require('./shared/utils/index.js'),
    SharedConstants: require('./shared/constants/index.js'),
    SharedTypes: require('./shared/types/index.js'),
    SharedAPI: require('./shared/api/index.js'),
    
    // 页面
    Pages: require('./pages/index.js'),
    
    // 核心应用
    App: require('./core/App.js'),
    AppManager: require('./core/AppManager.js'),
    Router: require('./core/Router.js')
};