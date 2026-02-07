/**
 * YiPet Configuration
 * 
 * Centralized configuration for Chrome Extension.
 * Handles environment variables and default settings.
 */

// --- Defaults ---
const DEFAULT_CONFIG = {
  pet: {
    defaultSize: 180,
    defaultPosition: { x: 20, y: "20%" },
    defaultColorIndex: 0,
    defaultVisible: false,
    colors: [
      "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",  /* 主色：优雅蓝紫 */
      "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",  /* 现代靛蓝紫 */
      "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)",  /* 量子海洋 */
      "linear-gradient(135deg, #22c55e 0%, #10b981 50%, #059669 100%)",  /* 量子森林 */
      "linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #a855f7 100%)"   /* 量子日落 */
    ],
    sizeLimits: { min: 80, max: 400 }
  },
  chatWindow: {
    defaultSize: { width: 700, height: 720 },
    defaultPosition: { x: "center", y: "12%" },
    sizeLimits: { minWidth: 300, maxWidth: 10000, minHeight: 450, maxHeight: 10000 },
    input: { maxLength: 0, placeholder: "输入消息..." },
    message: { maxLength: 0, thinkingDelay: { min: 1000, max: 2000 } }
  },
  animation: {
    pet: { floatDuration: 3000, blinkDuration: 4000, wagDuration: 2000 },
    chatWindow: { transitionDuration: 300, scaleEffect: 1.02 }
  },
  storage: {
    keys: { globalState: "petGlobalState", chatWindowState: "petChatWindowState" },
    syncInterval: 3000
  },
  ui: {
    zIndex: { pet: 2147483647, chatWindow: 2147483648, resizeHandle: 20, inputContainer: 10, modal: 2147483649 },
    borderRadius: { pet: "50%", chatWindow: "16px", input: "25px", button: "25px" }
  },
  api: {
    streamPromptUrl: "https://api.effiy.cn/prompt",
    promptUrl: "https://api.effiy.cn/prompt/",
    yiaiBaseUrl: "https://api.effiy.cn",
    faqApiUrl: "https://api.effiy.cn",
    syncSessionsToBackend: true
  },
  chatModels: {
    default: "qwen3",
    models: [
      { id: "qwen3", name: "Qwen3", icon: "🤖" },
      { id: "qwen3-vl", name: "Qwen3-VL", icon: "👁️" },
      { id: "qwq", name: "QWQ", icon: "💬" },
      { id: "deepseek-r1:32b", name: "DeepSeek-R1:32B", icon: "🧠" },
      { id: "deepseek-r1", name: "DeepSeek-R1", icon: "🧠" },
      { id: "qwen3:32b", name: "Qwen3:32B", icon: "🚀" },
      { id: "deepseek-ocr", name: "DeepSeek-OCR", icon: "📄" },
      { id: "qwen3-coder", name: "Qwen3-Coder", icon: "💻" }
    ]
  },
  env: {
    mode: "production",
    flags: {
      debug: false,
      mockApi: false,
      telemetry: false
    },
    endpoints: {
      production: {
        streamPromptUrl: "https://api.effiy.cn/prompt",
        promptUrl: "https://api.effiy.cn/prompt/",
        yiaiBaseUrl: "https://api.effiy.cn",
        faqApiUrl: "https://api.effiy.cn"
      },
      staging: {
        streamPromptUrl: "https://staging.api.effiy.cn/prompt",
        promptUrl: "https://staging.api.effiy.cn/prompt/",
        yiaiBaseUrl: "https://staging.api.effiy.cn",
        faqApiUrl: "https://staging.api.effiy.cn"
      },
      development: {
        streamPromptUrl: "http://localhost:8000/prompt",
        promptUrl: "http://localhost:8080/prompt/",
        yiaiBaseUrl: "http://localhost:8000",
        faqApiUrl: "http://localhost:8000"
      }
    }
  },
  constants: {
    TIMING: {
      RETRY_DELAY: 500,
      STATUS_SYNC_INTERVAL: 5000,
      NOTIFICATION_DURATION: 3000,
      CONTENT_SCRIPT_WAIT: 1000,
      REQUEST_RETRY_DELAY: 500,
      QUOTA_CLEANUP_TIMEOUT: 60000,
      INJECT_PET_DELAY: 1000,
      REQUEST_DEDUP_WINDOW: 5000,
      REQUEST_CLEANUP_INTERVAL: 30000,
      REQUEST_CLEANUP_TIMEOUT: 60000,
      STORAGE_CLEANUP_INTERVAL: 86400000,
      STORAGE_CLEANUP_AGE: 604800000
    },
    RETRY: {
      MAX_RETRIES: 3,
      INITIAL_DELAY: 500
    },
    STORAGE: {
      MAX_REQUESTS: 1000,
      MAX_SESSION_SIZE: 50000,
      SYNC_INTERVAL: 60000
    },
    URLS: {
      CHROME_PROTOCOL: "chrome://",
      CHROME_EXTENSION_PROTOCOL: "chrome-extension://",
      MOZ_EXTENSION_PROTOCOL: "moz-extension://",
      ABOUT_PROTOCOL: "about:",
      AICR_REVIEW_PAGE: "https://effiy.cn/src/views/aicr/index.html",
      NEWS_ASSISTANT_PAGE: "https://effiy.cn/src/views/news/index.html",
      isSystemPage(url) {
        if (!url || typeof url !== "string") return false;
        return url.startsWith(this.CHROME_PROTOCOL) ||
          url.startsWith(this.CHROME_EXTENSION_PROTOCOL) ||
          url.startsWith(this.MOZ_EXTENSION_PROTOCOL) ||
          url.startsWith(this.ABOUT_PROTOCOL);
      }
    },
    UI: {
      NOTIFICATION_TOP: 10,
      STATUS_DOT_ACTIVE: "#22c55e",      /* 现代绿 */
      STATUS_DOT_INACTIVE: "#f59e0b",    /* 量子橙 */
      NOTIFICATION_SUCCESS: "#22c55e",   /* 现代绿 */
      NOTIFICATION_ERROR: "#ef4444",     /* 量子红 */
      NOTIFICATION_INFO: "#3b82f6"       /* 信息蓝 */
    },
    DEFAULTS: {
      PET_ROLE: "教师"
    },
    ERROR_MESSAGES: {
      TAB_NOT_FOUND: "无法获取当前标签页",
      INIT_FAILED: "初始化失败",
      OPERATION_FAILED: "操作失败",
      CONTEXT_INVALIDATED: "扩展上下文已失效",
      QUOTA_EXCEEDED: "存储配额超出",
      RETRYING: "正在重试...",
      RETRY_SUCCESS: "重试成功",
      RETRY_FAILED: "多次尝试后仍失败"
    },
    SUCCESS_MESSAGES: {
      SHOWN: "已显示",
      HIDDEN: "已隐藏",
      COLOR_CHANGED: "颜色已更换",
      COLOR_SET: "颜色主题已设置",
      SIZE_UPDATED: "大小已更新",
      POSITION_RESET: "位置已重置",
      CENTERED: "已居中",
      ROLE_CHANGED: "角色已切换"
    },
    API: {
      MAX_WEWORK_CONTENT_LENGTH: 4096,
      MAX_WEWORK_CONTENT_TRUNCATE_MARGIN: 100
    },
    storageKeys: {
      devMode: "petDevMode",
      globalState: "petGlobalState",
      chatWindowState: "petChatWindowState",
      settings: "petSettings"
    },
    ids: {
      assistantElement: "chat-assistant-element"
    }
  }
};

// --- Environment Processing ---
let __ENV_MODE = "production";

// Detect mode from Window or Process
if (typeof window !== "undefined" && window.__PET_ENV_MODE__) {
  __ENV_MODE = String(window.__PET_ENV_MODE__).toLowerCase();
} else if (typeof process !== "undefined" && process.env && process.env.PET_ENV_MODE) {
  __ENV_MODE = String(process.env.PET_ENV_MODE).toLowerCase();
} else if (DEFAULT_CONFIG.env && DEFAULT_CONFIG.env.mode) {
  __ENV_MODE = String(DEFAULT_CONFIG.env.mode).toLowerCase();
}

// Get Flags and Endpoints
const __ENV_FLAGS = (DEFAULT_CONFIG.env && DEFAULT_CONFIG.env.flags) || {};
const __ENV_ENDPOINTS = (DEFAULT_CONFIG.env && DEFAULT_CONFIG.env.endpoints && DEFAULT_CONFIG.env.endpoints[__ENV_MODE]) 
  ? DEFAULT_CONFIG.env.endpoints[__ENV_MODE] 
  : null;

// Clone default config to create the final config
const config = { ...DEFAULT_CONFIG };

// Apply overrides
if (__ENV_ENDPOINTS) {
  config.api = { ...config.api, ...__ENV_ENDPOINTS };
}

// Inject environment info
config.envInfo = { 
  mode: __ENV_MODE, 
  flags: __ENV_FLAGS 
};

// Expose configuration globally
if (typeof self !== "undefined") {
  self.PET_CONFIG = config;
} else if (typeof window !== "undefined") {
  window.PET_CONFIG = config;
  window.PET_ENV = config.envInfo;
} else if (typeof global !== "undefined") {
  global.PET_CONFIG = config;
}

// Support CommonJS export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { config, PET_CONFIG: config };
}
