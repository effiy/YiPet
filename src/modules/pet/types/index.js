/**
 * Pet Module Types
 * 宠物模块的类型定义
 */

/**
 * 宠物状态类型
 */
export const PetStateTypes = {
    // 基础状态
    VISIBILITY: 'visibility',
    POSITION: 'position',
    COLOR: 'color',
    ROLE: 'role',
    
    // 交互状态
    IS_DRAGGING: 'isDragging',
    DRAG_OFFSET: 'dragOffset',
    
    // 聊天状态
    IS_CHAT_OPEN: 'isChatOpen',
    CURRENT_SESSION_ID: 'currentSessionId',
    SESSIONS: 'sessions',
    
    // UI状态
    UI_STATE: 'uiState',
    
    // 功能状态
    FEATURES: 'features'
};

/**
 * 消息角色类型
 */
export const MessageRoleTypes = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system'
};

/**
 * 消息状态类型
 */
export const MessageStatusTypes = {
    PENDING: 'pending',
    SENT: 'sent',
    RECEIVED: 'received',
    ERROR: 'error',
    EDITING: 'editing'
};

/**
 * 拖拽状态类型
 */
export const DragStateTypes = {
    IDLE: 'idle',
    DRAGGING: 'dragging',
    SNAPPING: 'snapping'
};

/**
 * 事件类型
 */
export const EventTypes = {
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
    AI_RESPONSE_RECEIVED: 'ai:response:received'
};

/**
 * 错误类型
 */
export const ErrorTypes = {
    VALIDATION: 'validation',
    NETWORK: 'network',
    API: 'api',
    STATE: 'state',
    PERMISSION: 'permission',
    TIMEOUT: 'timeout',
    UNKNOWN: 'unknown'
};

/**
 * API响应状态类型
 */
export const ApiResponseTypes = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

/**
 * 主题类型
 */
export const ThemeTypes = {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
};

/**
 * 存储类型
 */
export const StorageTypes = {
    LOCAL: 'local',
    SESSION: 'session',
    INDEXEDDB: 'indexeddb',
    MEMORY: 'memory'
};

/**
 * 动画类型
 */
export const AnimationTypes = {
    BOUNCE: 'bounce',
    SHAKE: 'shake',
    PULSE: 'pulse',
    ROTATE: 'rotate',
    TADA: 'tada',
    WOBBLE: 'wobble',
    FADE_IN: 'fadeIn',
    FADE_OUT: 'fadeOut',
    SLIDE_IN: 'slideIn',
    SLIDE_OUT: 'slideOut'
};