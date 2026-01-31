/**
 * Project Configuration
 * 项目配置文件
 */

// 项目信息
export const PROJECT_INFO = {
    name: 'YiPet',
    version: '1.0.0',
    description: '智能助手宠物扩展',
    author: 'YiPet Team',
    repository: 'https://github.com/yipet/yipet',
    homepage: 'https://yipet.com',
    license: 'MIT'
};

// 构建配置
export const BUILD_CONFIG = {
    // 入口文件
    entry: {
        background: './src/pages/background/index.js',
        content: './src/pages/content/index.js',
        options: './src/pages/options/index.js',
        popup: './src/pages/popup/index.js',
        main: './src/app.js'
    },
    
    // 输出配置
    output: {
        path: './dist',
        filename: '[name].js',
        chunkFilename: '[name].chunk.js'
    },
    
    // 开发服务器配置
    devServer: {
        port: 3000,
        host: 'localhost',
        hot: true,
        open: true
    },
    
    // 优化配置
    optimization: {
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all'
                },
                common: {
                    name: 'common',
                    minChunks: 2,
                    chunks: 'all',
                    enforce: true
                }
            }
        }
    },
    
    // 模块解析配置
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        alias: {
            '@': './src',
            '@modules': './src/modules',
            '@shared': './src/shared',
            '@pages': './src/pages',
            '@utils': './src/shared/utils',
            '@constants': './src/shared/constants',
            '@types': './src/shared/types'
        }
    },
    
    // 插件配置
    plugins: {
        html: {
            template: './public/index.html',
            inject: true
        },
        css: {
            extract: true,
            filename: '[name].css',
            chunkFilename: '[name].chunk.css'
        }
    }
};

// 开发配置
export const DEVELOPMENT_CONFIG = {
    // 开发环境变量
    env: {
        NODE_ENV: 'development',
        DEBUG: true,
        API_URL: 'http://localhost:8080/api',
        WS_URL: 'ws://localhost:8080/ws'
    },
    
    // 调试配置
    debug: {
        enableSourceMap: true,
        enableHotReload: true,
        enableDevTools: true,
        logLevel: 'debug'
    },
    
    // 代理配置
    proxy: {
        '/api': {
            target: 'http://localhost:8080',
            changeOrigin: true,
            secure: false
        }
    }
};

// 生产配置
export const PRODUCTION_CONFIG = {
    // 生产环境变量
    env: {
        NODE_ENV: 'production',
        DEBUG: false,
        API_URL: 'https://api.yipet.com',
        WS_URL: 'wss://ws.yipet.com'
    },
    
    // 优化配置
    optimization: {
        minimize: true,
        sourceMap: false,
        treeShaking: true,
        codeSplitting: true,
        lazyLoading: true
    },
    
    // 安全配置
    security: {
        enableCSP: true,
        enableSRI: true,
        enableHTTPS: true,
        enableHSTS: true
    }
};

// 测试配置
export const TESTING_CONFIG = {
    // 测试环境变量
    env: {
        NODE_ENV: 'test',
        DEBUG: true,
        API_URL: 'http://test-api.yipet.com',
        WS_URL: 'ws://test-ws.yipet.com'
    },
    
    // 测试工具配置
    tools: {
        coverage: true,
        watch: true,
        verbose: true,
        bail: false
    },
    
    // 模拟配置
    mocks: {
        enable: true,
        delay: 100,
        failRate: 0.1
    }
};

// 部署配置
export const DEPLOYMENT_CONFIG = {
    // 部署目标
    targets: {
        chrome: {
            manifestVersion: 3,
            minVersion: '88',
            permissions: [
                'storage',
                'tabs',
                'activeTab',
                'contextMenus',
                'notifications'
            ]
        },
        firefox: {
            manifestVersion: 2,
            minVersion: '78',
            permissions: [
                'storage',
                'tabs',
                'activeTab',
                'contextMenus',
                'notifications'
            ]
        },
        edge: {
            manifestVersion: 3,
            minVersion: '88',
            permissions: [
                'storage',
                'tabs',
                'activeTab',
                'contextMenus',
                'notifications'
            ]
        }
    },
    
    // 构建配置
    build: {
        outputDir: './dist',
        clean: true,
        zip: true,
        sourceMap: false
    },
    
    // 发布配置
    publish: {
        chrome: {
            storeUrl: 'https://chrome.google.com/webstore',
            clientId: '',
            clientSecret: '',
            refreshToken: ''
        },
        firefox: {
            storeUrl: 'https://addons.mozilla.org',
            apiKey: '',
            apiSecret: ''
        },
        edge: {
            storeUrl: 'https://microsoftedge.microsoft.com/addons',
            clientId: '',
            clientSecret: '',
            accessToken: ''
        }
    }
};

// 默认导出
export default {
    PROJECT_INFO,
    BUILD_CONFIG,
    DEVELOPMENT_CONFIG,
    PRODUCTION_CONFIG,
    TESTING_CONFIG,
    DEPLOYMENT_CONFIG
};