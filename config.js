/**
 * Chrome扩展配置文件
 * 包含所有默认配置信息
 */

const PET_CONFIG = {
    // 宠物默认配置
    pet: {
        // 默认大小
        defaultSize: 60,
        
        // 默认位置（响应式）
        defaultPosition: {
            x: 20,
            y: '20%'  // 使用百分比，让位置更响应式
        },
        
        // 默认颜色索引
        defaultColorIndex: 0,
        
        // 默认可见性
        defaultVisible: true,
        
        // 颜色主题配置
        colors: [
            'linear-gradient(135deg, #ff6b6b, #ff8e8e)', // 红色系
            'linear-gradient(135deg, #4ecdc4, #44a08d)', // 绿色系
            'linear-gradient(135deg, #ff9a9e, #fecfef)', // 粉色系
            'linear-gradient(135deg, #a8edea, #fed6e3)', // 蓝色系
            'linear-gradient(135deg, #ffecd2, #fcb69f)'  // 黄色系
        ],
        
        // 大小限制
        sizeLimits: {
            min: 40,
            max: 120
        }
    },
    
    // 聊天窗口默认配置
    chatWindow: {
        // 默认大小
        defaultSize: {
            width: 700,
            height: 600
        },
        
        // 默认位置（响应式）
        defaultPosition: {
            x: 'center', // 水平居中
            y: '12%'     // 使用视口高度的12%
        },
        
        // 大小限制（设置为宽泛的范围，几乎不限制）
        sizeLimits: {
            minWidth: 300,
            maxWidth: 10000,
            minHeight: 200,
            maxHeight: 10000
        },
        
        // 输入框配置
        input: {
            maxLength: 200,
            placeholder: '输入消息...'
        },
        
        // 消息配置
        message: {
            maxLength: 1000,
            thinkingDelay: {
                min: 1000,
                max: 2000
            }
        }
    },
    
    // 动画配置
    animation: {
        // 宠物动画
        pet: {
            floatDuration: 3000,
            blinkDuration: 4000,
            wagDuration: 2000
        },
        
        // 聊天窗口动画
        chatWindow: {
            transitionDuration: 300,
            scaleEffect: 1.02
        }
    },
    
    // 存储配置
    storage: {
        // Chrome存储键名
        keys: {
            globalState: 'petGlobalState',
            chatWindowState: 'petChatWindowState'
        },
        
        // 同步间隔（毫秒）
        syncInterval: 3000
    },
    
    // UI配置
    ui: {
        // z-index层级
        zIndex: {
            pet: 2147483647,
            chatWindow: 2147483648,
            resizeHandle: 20,
            inputContainer: 10
        },
        
        // 圆角半径
        borderRadius: {
            pet: '50%',
            chatWindow: '16px',
            input: '25px',
            button: '25px'
        }
    },
    
    // API 配置
    api: {
        // 流式 Prompt API 地址
        streamPromptUrl: 'http://localhost:8000/prompt',
        // 传统 Prompt API 地址
        promptUrl: 'https://api.effiy.cn/prompt/'
    }
};

// 工具函数：获取响应式位置
function getResponsivePosition(position, windowSize) {
    if (typeof position === 'string' && position.includes('%')) {
        const percentage = parseFloat(position.replace('%', '')) / 100;
        return Math.round(windowSize * percentage);
    }
    return position;
}

// 工具函数：获取居中位置
function getCenterPosition(elementSize, windowSize) {
    return Math.max(0, (windowSize - elementSize) / 2);
}

// 工具函数：获取宠物默认位置
function getPetDefaultPosition() {
    return {
        x: PET_CONFIG.pet.defaultPosition.x,
        y: getResponsivePosition(PET_CONFIG.pet.defaultPosition.y, window.innerHeight)
    };
}

// 工具函数：获取聊天窗口默认位置
function getChatWindowDefaultPosition(width, height) {
    return {
        x: getCenterPosition(width, window.innerWidth),
        y: getResponsivePosition(PET_CONFIG.chatWindow.defaultPosition.y, window.innerHeight)
    };
}

// 导出配置对象和工具函数
if (typeof module !== 'undefined' && module.exports) {
    // Node.js环境
    module.exports = {
        PET_CONFIG,
        getResponsivePosition,
        getCenterPosition,
        getPetDefaultPosition,
        getChatWindowDefaultPosition
    };
} else {
    // 浏览器环境
    window.PET_CONFIG = PET_CONFIG;
    window.getResponsivePosition = getResponsivePosition;
    window.getCenterPosition = getCenterPosition;
    window.getPetDefaultPosition = getPetDefaultPosition;
    window.getChatWindowDefaultPosition = getChatWindowDefaultPosition;
}
