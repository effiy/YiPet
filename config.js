/**
 * Chrome扩展配置文件
 * 
 * 功能说明：
 * - 集中管理所有默认配置和常量
 * - 提供响应式位置计算工具函数
 * - 支持浏览器和Node.js环境
 * 
 * 配置结构：
 * - pet: 宠物相关配置（大小、位置、颜色等）
 * - chatWindow: 聊天窗口配置
 * - animation: 动画配置
 * - storage: 存储配置
 * - ui: UI样式配置
 * - api: API接口配置
 * - chatModels: 聊天模型配置
 */

const PET_CONFIG = {
  /**
   * 宠物默认配置
   * 控制宠物的外观和行为
   */
  pet: {
    // 默认大小（像素）
    defaultSize: 180,

    // 默认位置（响应式设计）
    // x: 固定像素值
    // y: 使用百分比，自适应不同屏幕高度
    defaultPosition: {
      x: 20,
      y: "20%", // 使用百分比，让位置更响应式
    },

    // 默认颜色索引（0-4，对应colors数组）
    defaultColorIndex: 0,

    // 默认可见性（false表示初始隐藏）
    defaultVisible: false,

    // 颜色主题配置（5种渐变色主题）
    colors: [
      "linear-gradient(135deg, #ff6b6b, #ff8e8e)", // 红色系
      "linear-gradient(135deg, #4ecdc4, #44a08d)", // 绿色系
      "linear-gradient(135deg, #ff9a9e, #fecfef)", // 粉色系
      "linear-gradient(135deg, #a8edea, #fed6e3)", // 蓝色系
      "linear-gradient(135deg, #ffecd2, #fcb69f)", // 黄色系
    ],

    // 大小限制（像素）
    // 防止宠物过大或过小影响用户体验
    sizeLimits: {
      min: 80,   // 最小尺寸
      max: 400,  // 最大尺寸
    },
  },

  /**
   * 聊天窗口默认配置
   * 控制聊天窗口的外观和行为
   */
  chatWindow: {
    // 默认大小（像素）
    defaultSize: {
      width: 700,
      height: 600,
    },

    // 默认位置（响应式设计）
    defaultPosition: {
      x: "center", // 水平居中
      y: "12%",    // 使用视口高度的12%，自适应不同屏幕
    },

    // 大小限制（设置为宽泛的范围，几乎不限制）
    // 允许用户自由调整窗口大小
    sizeLimits: {
      minWidth: 300,      // 最小宽度
      maxWidth: 10000,    // 最大宽度（几乎无限制）
      minHeight: 200,     // 最小高度
      maxHeight: 10000,   // 最大高度（几乎无限制）
    },

    // 输入框配置
    input: {
      maxLength: 200,              // 最大输入长度
      placeholder: "输入消息...",   // 占位符文本
    },

    // 消息配置
    message: {
      maxLength: 1000,            // 单条消息最大长度
      thinkingDelay: {            // AI思考延迟（模拟真实对话）
        min: 1000,                 // 最小延迟（毫秒）
        max: 2000,                 // 最大延迟（毫秒）
      },
    },
  },

  /**
   * 动画配置
   * 控制各种动画效果的时长和参数
   */
  animation: {
    // 宠物动画
    pet: {
      floatDuration: 3000,   // 浮动动画时长（毫秒）
      blinkDuration: 4000,   // 眨眼动画间隔（毫秒）
      wagDuration: 2000,     // 摇摆动画时长（毫秒）
    },

    // 聊天窗口动画
    chatWindow: {
      transitionDuration: 300,  // 过渡动画时长（毫秒）
      scaleEffect: 1.02,        // 缩放效果倍数（鼠标悬停时）
    },
  },

  /**
   * 存储配置
   * Chrome Storage API 相关配置
   */
  storage: {
    // Chrome存储键名
    // 用于在Chrome Storage中存储和读取数据
    keys: {
      globalState: "petGlobalState",        // 全局状态键名
      chatWindowState: "petChatWindowState", // 聊天窗口状态键名
    },

    // 同步间隔（毫秒）
    // 定期同步状态到存储的频率
    syncInterval: 3000,
  },

  /**
   * UI配置
   * 控制界面元素的样式和层级
   */
  ui: {
    // z-index层级
    // 控制元素的显示层级，数值越大越在上层
    zIndex: {
      pet: 2147483647,        // 宠物层级（最高）
      chatWindow: 2147483648, // 聊天窗口层级
      resizeHandle: 20,       // 调整大小手柄层级
      inputContainer: 10,     // 输入容器层级
      modal: 2147483649,      // 弹框层级，确保在所有元素之上
    },

    // 圆角半径
    // 控制元素的圆角样式
    borderRadius: {
      pet: "50%",        // 宠物：圆形
      chatWindow: "16px", // 聊天窗口：圆角矩形
      input: "25px",     // 输入框：大圆角
      button: "25px",    // 按钮：大圆角
    },
  },

  /**
   * API 配置
   * 后端接口地址和功能开关
   */
  api: {
    // 流式 Prompt API 地址
    // 用于流式对话（SSE/WebSocket）
    streamPromptUrl: "https://api.effiy.cn/prompt",
    
    // 传统 Prompt API 地址
    // 用于非流式对话（普通HTTP请求）
    promptUrl: "https://api.effiy.cn/prompt/",
    
    // YiAi 后端 API 地址（用于会话同步）
    // 用于将本地会话同步到云端
    yiaiBaseUrl: "https://api.effiy.cn",
    
    // 是否启用会话同步到后端
    // true: 自动同步会话到云端
    // false: 仅本地存储
    syncSessionsToBackend: true,
  },

  /**
   * 聊天模型配置
   * 支持的AI模型列表和默认模型
   */
  chatModels: {
    // 默认使用的模型ID
    default: "qwen3",
    
    // 可用模型列表
    // 每个模型包含：id（唯一标识）、name（显示名称）、icon（图标）
    models: [
      {
        id: "qwen3",
        name: "Qwen3",
        icon: "🤖",
      },
      {
        id: "qwen3-vl",
        name: "Qwen3-VL",
        icon: "👁️",
      },
      {
        id: "qwq",
        name: "QWQ",
        icon: "💬",
      },
      {
        id: "gpt-oss",
        name: "GPT-OSS",
        icon: "✨",
      },
      {
        id: "minicpm-v",
        name: "MiniCPM-V",
        icon: "🖼️",
      },
      {
        id: "deepseek-r1:32b",
        name: "DeepSeek-R1:32B",
        icon: "🧠",
      },
      {
        id: "deepseek-r1",
        name: "DeepSeek-R1",
        icon: "🧠",
      },
      {
        id: "qwen3:32b",
        name: "Qwen3:32B",
        icon: "🚀",
      },
      {
        id: "deepseek-ocr",
        name: "DeepSeek-OCR",
        icon: "📄",
      },
      {
        id: "qwen3-coder",
        name: "Qwen3-Coder",
        icon: "💻",
      },
    ],
  },
};

// ==================== 工具函数 ====================

/**
 * 获取响应式位置
 * 将百分比字符串转换为实际像素值
 * @param {string|number} position - 位置值（可以是百分比字符串如"20%"或数字）
 * @param {number} windowSize - 窗口尺寸（宽度或高度）
 * @returns {number} 计算后的像素值
 */
function getResponsivePosition(position, windowSize) {
  if (typeof position === "string" && position.includes("%")) {
    const percentage = parseFloat(position.replace("%", "")) / 100;
    return Math.round(windowSize * percentage);
  }
  return position;
}

/**
 * 获取居中位置
 * 计算元素在窗口中居中时的位置
 * @param {number} elementSize - 元素尺寸（宽度或高度）
 * @param {number} windowSize - 窗口尺寸（宽度或高度）
 * @returns {number} 居中时的位置坐标
 */
function getCenterPosition(elementSize, windowSize) {
  return Math.max(0, (windowSize - elementSize) / 2);
}

/**
 * 获取宠物默认位置
 * 根据配置和窗口大小计算宠物的默认位置
 * @returns {Object} 位置对象 {x: number, y: number}
 */
function getPetDefaultPosition() {
  return {
    x: PET_CONFIG.pet.defaultPosition.x,
    y: getResponsivePosition(
      PET_CONFIG.pet.defaultPosition.y,
      window.innerHeight
    ),
  };
}

/**
 * 获取聊天窗口默认位置
 * 根据配置和窗口大小计算聊天窗口的默认位置（水平居中）
 * @param {number} width - 聊天窗口宽度
 * @param {number} height - 聊天窗口高度
 * @returns {Object} 位置对象 {x: number, y: number}
 */
function getChatWindowDefaultPosition(width, height) {
  return {
    x: getCenterPosition(width, window.innerWidth),
    y: getResponsivePosition(
      PET_CONFIG.chatWindow.defaultPosition.y,
      window.innerHeight
    ),
  };
}

// ==================== 模块导出 ====================

/**
 * 导出配置对象和工具函数
 * 支持Node.js和浏览器环境
 */
if (typeof module !== "undefined" && module.exports) {
  // Node.js环境
  module.exports = {
    PET_CONFIG,
    getResponsivePosition,
    getCenterPosition,
    getPetDefaultPosition,
    getChatWindowDefaultPosition,
  };
} else {
  // 浏览器环境（挂载到window对象）
  window.PET_CONFIG = PET_CONFIG;
  window.getResponsivePosition = getResponsivePosition;
  window.getCenterPosition = getCenterPosition;
  window.getPetDefaultPosition = getPetDefaultPosition;
  window.getChatWindowDefaultPosition = getChatWindowDefaultPosition;
}


