/**
 * 通用视图工厂函数
 * 提供统一的Vue应用创建和挂载逻辑
 * author: liangliang
 * 适配 Chrome 扩展环境
 */

// 导入日志工具，确保 window.logError 等函数可用
import './log.js';
// 导入错误处理工具，确保 window.safeExecute 函数可用
import './error.js';

/**
 * 视图配置选项
 */
const ViewConfig = {
    // 默认组件注册列表
    DEFAULT_COMPONENTS: [],

    // 默认插件加载列表
    DEFAULT_PLUGINS: [],

    // 默认错误处理
    DEFAULT_ERROR_HANDLER: (error) => {
        if (typeof window.logError === 'function') {
            window.logError('[视图错误]', error);
        } else {
            console.error('[视图错误]', error);
        }
    }
};

/**
 * 创建Vue应用实例
 * @param {Object} options - 应用配置选项
 * @param {Function} options.setup - 应用setup函数
 * @param {Array} options.components - 要注册的组件列表
 * @param {Array} options.plugins - 要加载的插件列表
 * @param {Function} options.onError - 错误处理函数
 * @returns {Promise<Object>} Vue应用实例
 */
async function createVueApp(options = {}) {
    const {
        setup,
        components = ViewConfig.DEFAULT_COMPONENTS,
        plugins = ViewConfig.DEFAULT_PLUGINS,
        onError = ViewConfig.DEFAULT_ERROR_HANDLER,
        rootTemplate = null
    } = options;

    // 验证必需参数
    if (typeof setup !== 'function') {
        throw new Error('setup函数是必需的');
    }

    // 检查 Vue 是否已加载
    if (typeof Vue === 'undefined') {
        throw new Error('Vue 未加载，请确保已引入 Vue 3');
    }

    // 创建Vue应用
    const app = Vue.createApp({
        setup,
        name: 'App',
        // 如果提供了根模板，则使用它而不是解析现有DOM
        ...(rootTemplate ? { template: rootTemplate } : {})
    });

    // 注册组件（异步）
    await registerComponents(app, components);

    // 加载插件
    loadPlugins(app, plugins);

    // 设置错误处理
    app.config.errorHandler = onError;

    return app;
}

/**
 * 注册组件到Vue应用
 * @param {Object} app - Vue应用实例
 * @param {Array} componentNames - 组件名称列表
 */
async function registerComponents(app, componentNames) {
    // 等待所有组件加载完成
    await waitForComponents(componentNames);

    componentNames.forEach(name => {
        if (typeof window[name] !== 'undefined') {
            // 注册 PascalCase 名称
            app.component(name, window[name]);
            // 同时注册 kebab-case 名称
            const kebabName = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
            app.component(kebabName, window[name]);
            if (typeof window.logInfo === 'function') {
                window.logInfo(`[组件注册] 已注册组件: ${name} (${kebabName})`);
            }
        } else {
            if (typeof window.logWarn === 'function') {
                window.logWarn(`[组件注册] 组件未找到: ${name}`);
            }
        }
    });
}

/**
 * 加载插件到Vue应用
 * @param {Object} app - Vue应用实例
 * @param {Array} pluginNames - 插件名称列表
 */
function loadPlugins(app, pluginNames) {
    pluginNames.forEach(pluginName => {
        try {
            if (typeof window.logInfo === 'function') {
                window.logInfo(`[插件加载] 加载插件: ${pluginName}`);
            }
        } catch (error) {
            if (typeof window.logError === 'function') {
                window.logError(`[插件加载] 插件加载失败: ${pluginName}`, error);
            }
        }
    });
}

/**
 * 挂载Vue应用到DOM
 * @param {Object} app - Vue应用实例
 * @param {string} selector - DOM选择器
 * @returns {Object} 挂载后的应用实例
 */
function mountApp(app, selector = '#app') {
    return window.safeExecute(() => {
        const element = document.querySelector(selector);
        if (!element) {
            throw new Error(`DOM元素未找到: ${selector}`);
        }

        // 直接传入 DOM 元素
        const mountedApp = app.mount(element);
        if (typeof window.logInfo === 'function') {
            window.logInfo(`[应用挂载] 应用已挂载到: ${selector}`);
        }
        return mountedApp;
    }, '应用挂载');
}

/**
 * 创建并挂载Vue应用
 * @param {Object} options - 应用配置选项
 * @param {string} selector - DOM选择器
 * @returns {Promise<Object>} 挂载后的应用实例
 */
async function createAndMountApp(options = {}, selector = '#app') {
    // 在挂载前，从目标元素抓取静态模板并清空
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`DOM元素未找到: ${selector}`);
    }
    const rootTemplate = element.innerHTML;
    element.innerHTML = '';

    const app = await createVueApp({ ...options, rootTemplate });
    try {
        return mountApp(app, selector);
    } catch (e) {
        // 回退方案：在body末尾创建全新容器再尝试一次
        try {
            const fallbackId = 'app-fallback';
            let fallback = document.getElementById(fallbackId);
            if (!fallback) {
                fallback = document.createElement('div');
                fallback.id = fallbackId;
                document.body.appendChild(fallback);
            } else {
                fallback.innerHTML = '';
            }
            const app2 = await createVueApp({ ...options, rootTemplate });
            return mountApp(app2, '#' + fallbackId);
        } catch (_) {
            throw e;
        }
    }
}

/**
 * 通用视图工厂函数
 * 创建标准的Vue应用结构
 * @param {Object} config - 视图配置
 * @param {Function} config.createStore - 创建状态管理函数
 * @param {Function} config.useComputed - 计算属性组合函数
 * @param {Function} config.useMethods - 方法组合函数
 * @param {Array} config.components - 组件列表
 * @param {Array} config.plugins - 插件列表
 * @param {Function} config.onMounted - 挂载后的回调函数
 * @param {string} config.selector - DOM选择器
 * @returns {Promise<Object>} 挂载后的应用实例
 */
async function createBaseView(config = {}) {
    const {
        createStore,
        useComputed,
        useMethods,
        components = ViewConfig.DEFAULT_COMPONENTS,
        plugins = ViewConfig.DEFAULT_PLUGINS,
        onMounted = null,
        selector = '#app',
        methods: extraMethods = {},
        data: extraData = {},
        computed: extraComputed = {},
        props: extraProps = {}
    } = config;

    // 验证必需函数
    if (typeof createStore !== 'function') {
        throw new Error('createStore函数是必需的');
    }
    if (typeof useComputed !== 'function') {
        throw new Error('useComputed函数是必需的');
    }
    if (typeof useMethods !== 'function') {
        throw new Error('useMethods函数是必需的');
    }

    // 确保 Vue 已加载
    if (typeof Vue === 'undefined') {
        throw new Error('Vue 未加载，请确保已引入 Vue 3');
    }

    // 创建应用setup函数
    const setup = () => {
        // 1. 创建响应式状态
        const store = createStore();

        // 2. 组合计算属性
        const computedProps = useComputed(store);

        // 3. 组合常用方法
        const methods = useMethods(store);

        // 4. 处理额外的 data（转换为响应式）
        const reactiveExtraData = {};
        if (extraData && typeof extraData === 'object') {
            Object.keys(extraData).forEach(key => {
                const value = extraData[key];
                if (value && typeof value === 'object' && 'value' in value) {
                    reactiveExtraData[key] = value;
                } else {
                    reactiveExtraData[key] = Vue.ref(value);
                }
            });
        }

        // 5. 处理额外的 computed（转换为计算属性）
        const reactiveExtraComputed = {};
        if (extraComputed && typeof extraComputed === 'object') {
            Object.keys(extraComputed).forEach(key => {
                const getter = extraComputed[key];
                if (typeof getter === 'function') {
                    reactiveExtraComputed[key] = Vue.computed(() => {
                        const context = {
                            store,
                            ...store,
                            ...computedProps,
                            ...methods,
                            ...reactiveExtraData
                        };
                        return getter.call(context);
                    });
                }
            });
        }

        // 6. 处理额外的 methods
        const boundExtraMethods = {};
        if (extraMethods && typeof extraMethods === 'object') {
            Object.keys(extraMethods).forEach(key => {
                const method = extraMethods[key];
                if (typeof method === 'function') {
                    boundExtraMethods[key] = method;
                }
            });
        }

        // 7. 返回所有需要暴露给模板的数据和方法
        return {
            ...store,                // 响应式数据
            ...computedProps,        // 计算属性
            ...methods,              // 方法
            ...reactiveExtraData,    // 额外的响应式数据
            ...reactiveExtraComputed, // 额外的计算属性
            ...boundExtraMethods     // 额外的方法
        };
    };

    // 创建并挂载应用（异步）
    const app = await createAndMountApp({
        setup,
        components,
        plugins,
        onError: (error) => {
            if (typeof window.logError === 'function') {
                window.logError('[视图错误]', error);
            } else {
                console.error('[视图错误]', error);
            }
        }
    }, selector);

    // 执行挂载后回调
    if (typeof onMounted === 'function') {
        window.safeExecute(() => {
            onMounted(app);
        }, '挂载后回调');
    }

    return app;
}

/**
 * 等待组件加载完成
 * @param {Array} componentNames - 组件名称列表
 * @param {number} timeout - 超时时间(毫秒)
 * @returns {Promise} 等待完成的Promise
 */
function waitForComponents(componentNames, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkComponents = () => {
            const allLoaded = componentNames.every(name =>
                typeof window[name] !== 'undefined'
            );

            if (allLoaded) {
                resolve();
                return;
            }

            if (Date.now() - startTime > timeout) {
                reject(new Error(`组件加载超时: ${componentNames.join(', ')}`));
                return;
            }

            setTimeout(checkComponents, 100);
        };

        checkComponents();
    });
}

// 在全局作用域中暴露（用于非模块环境）
if (typeof window !== 'undefined') {
    window.ViewConfig = ViewConfig;
    window.createVueApp = createVueApp;
    window.mountApp = mountApp;
    window.createAndMountApp = createAndMountApp;
    window.createBaseView = createBaseView;
    window.waitForComponents = waitForComponents;
}

// ES6模块导出（用于模块环境）
export {
    ViewConfig,
    createVueApp,
    mountApp,
    createAndMountApp,
    createBaseView,
    waitForComponents
};
