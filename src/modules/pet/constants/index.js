/**
 * Pet Module Constants
 * 宠物模块的常量定义
 */

/**
 * 宠物配置
 */
export const PET_CONFIG = {
    // 宠物基本配置
    pet: {
        id: 'yi-pet',
        name: 'Yi助手',
        version: '1.0.0',
        colors: [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
        ],
        defaultColor: '#FF6B6B',
        size: {
            width: 80,
            height: 80
        },
        zIndex: 1000
    },

    // 角色配置
    roles: {
        '教师': {
            name: '教师',
            icon: '👨‍🏫',
            color: '#FF6B6B',
            personality: '耐心、专业、鼓励性',
            greeting: '你好，我是你的学习伙伴',
            description: '专业的教学助手，帮助你学习各种知识'
        },
        '学生': {
            name: '学生',
            icon: '👨‍🎓',
            color: '#4ECDC4',
            personality: '好奇、积极、好学',
            greeting: '你好，我是你的学习伙伴',
            description: '充满活力的学习伙伴，和你一起探索知识'
        },
        '朋友': {
            name: '朋友',
            icon: '👋',
            color: '#45B7D1',
            personality: '友好、随和、支持性',
            greeting: '嗨！很高兴见到你',
            description: '贴心的朋友，陪伴你聊天和学习'
        },
        '专家': {
            name: '专家',
            icon: '🧠',
            color: '#96CEB4',
            personality: '专业、深入、权威性',
            greeting: '您好，我是专业顾问',
            description: '知识渊博的专家，提供深度见解和建议'
        }
    },

    // 默认角色
    defaultRole: '教师',

    // 宠物行为配置
    behaviors: {
        idle: {
            interval: 3000, // 3秒
            animations: ['bounce', 'shake', 'pulse']
        },
        thinking: {
            duration: 2000, // 2秒
            animations: ['rotate', 'pulse']
        },
        happy: {
            animations: ['bounce', 'tada']
        },
        sad: {
            animations: ['shake', 'wobble']
        }
    },

    // 动画配置
    animations: {
        duration: 300,
        easing: 'ease-in-out'
    }
};

/**
 * 聊天配置
 */
export const CHAT_CONFIG = {
    // 消息配置
    message: {
        maxLength: 1000,
        minLength: 1,
        maxMessagesPerSession: 1000,
        autoSaveInterval: 5000 // 5秒自动保存
    },

    // 会话配置
    session: {
        maxSessions: 50,
        defaultSessionName: '新会话',
        autoSave: true
    },

    // AI配置
    ai: {
        maxRetries: 3,
        timeout: 30000, // 30秒
        rateLimit: {
            maxRequests: 10,
            windowMs: 60000 // 1分钟
        },
        models: {
            default: 'gpt-3.5-turbo',
            available: ['gpt-3.5-turbo', 'gpt-4', 'claude', 'yi']
        }
    },

    // 输入配置
    input: {
        placeholder: '输入消息...',
        autoFocus: true,
        autoResize: true,
        maxRows: 10
    },

    // 显示配置
    display: {
        showTimestamps: true,
        showAvatars: true,
        groupMessages: true,
        messageGroupingTime: 300000 // 5分钟
    }
};

/**
 * 拖拽配置
 */
export const DRAG_CONFIG = {
    // 拖拽行为
    drag: {
        enabled: true,
        boundary: {
            margin: 10,
            constrainToViewport: true
        },
        snap: {
            enabled: false,
            threshold: 20,
            targets: [] // 吸附目标点
        },
        grid: {
            enabled: false,
            size: 20
        }
    },

    // 拖拽约束
    constraints: {
        minX: 0,
        minY: 0,
        maxX: window.innerWidth - 80, // 宠物宽度
        maxY: window.innerHeight - 80 // 宠物高度
    }
};

/**
 * 状态配置
 */
export const STATE_CONFIG = {
    // 状态持久化
    persistence: {
        enabled: true,
        key: 'yi-pet-state',
        version: 1,
        migrations: {
            // 状态迁移函数
            0: (state) => ({ ...state, version: 1 })
        }
    },

    // 状态验证
    validation: {
        enabled: true,
        strict: false
    },

    // 状态历史
    history: {
        enabled: true,
        maxSize: 100,
        excludeKeys: ['isDragging', 'mousePosition']
    }
};

/**
 * 事件配置
 */
export const EVENT_CONFIG = {
    // 事件命名空间
    namespace: 'yi-pet',

    // 事件类型
    types: {
        // 宠物事件
        PET_CREATED: 'pet:created',
        PET_DESTROYED: 'pet:destroyed',
        PET_STATE_CHANGED: 'pet:state:changed',
        PET_VISIBILITY_CHANGED: 'pet:visibility:changed',
        PET_POSITION_CHANGED: 'pet:position:changed',
        PET_COLOR_CHANGED: 'pet:color:changed',
        PET_ROLE_CHANGED: 'pet:role:changed',

        // 拖拽事件
        DRAG_START: 'drag:start',
        DRAG_MOVE: 'drag:move',
        DRAG_END: 'drag:end',
        DRAG_RESET: 'drag:reset',

        // 聊天事件
        CHAT_MESSAGE_SENT: 'chat:message:sent',
        CHAT_MESSAGE_RECEIVED: 'chat:message:received',
        CHAT_MESSAGE_UPDATED: 'chat:message:updated',
        CHAT_MESSAGE_DELETED: 'chat:message:deleted',
        CHAT_SESSION_CREATED: 'chat:session:created',
        CHAT_SESSION_SWITCHED: 'chat:session:switched',
        CHAT_SESSION_DELETED: 'chat:session:deleted',
        CHAT_WINDOW_OPENED: 'chat:window:opened',
        CHAT_WINDOW_CLOSED: 'chat:window:closed',

        // AI事件
        AI_REQUEST_STARTED: 'ai:request:started',
        AI_REQUEST_COMPLETED: 'ai:request:completed',
        AI_REQUEST_FAILED: 'ai:request:failed',
        AI_RESPONSE_RECEIVED: 'ai:response:received',

        // 错误事件
        ERROR_OCCURRED: 'error:occurred',
        ERROR_HANDLED: 'error:handled'
    },

    // 事件配置
    options: {
        bubbles: true,
        cancelable: true,
        composed: true
    }
};

/**
 * API配置
 */
export const API_CONFIG = {
    // API基础配置
    base: {
        timeout: 30000,
        retries: 3,
        retryDelay: 1000
    },

    // API端点
    endpoints: {
        chat: '/api/chat',
        ai: '/api/ai',
        auth: '/api/auth',
        session: '/api/session',
        pet: '/api/pet'
    },

    // 请求头
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    }
};

/**
 * 错误配置
 */
export const ERROR_CONFIG = {
    // 错误类型
    types: {
        VALIDATION: 'validation',
        NETWORK: 'network',
        API: 'api',
        STATE: 'state',
        PERMISSION: 'permission',
        TIMEOUT: 'timeout',
        UNKNOWN: 'unknown'
    },

    // 错误处理
    handling: {
        showUser: true,
        logToConsole: true,
        sendToServer: false,
        retry: true
    }
};

/**
 * 主题配置
 */
export const THEME_CONFIG = {
    // 主题模式
    modes: {
        light: {
            name: '浅色',
            className: 'theme-light',
            colors: {
                primary: '#007bff',
                secondary: '#6c757d',
                success: '#28a745',
                danger: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8',
                light: '#f8f9fa',
                dark: '#343a40'
            }
        },
        dark: {
            name: '深色',
            className: 'theme-dark',
            colors: {
                primary: '#0d6efd',
                secondary: '#6c757d',
                success: '#198754',
                danger: '#dc3545',
                warning: '#ffc107',
                info: '#0dcaf0',
                light: '#f8f9fa',
                dark: '#212529'
            }
        }
    },

    // 默认主题
    defaultMode: 'light'
};