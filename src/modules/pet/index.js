/**
 * Pet Module Main Index
 * 宠物模块主入口文件
 */

// 核心模块
export {
    PetManagerCore,
    PetStateManager,
    PetEventManager,
    petStateManager,
    petEventManager
} from './core/index.js';

// 服务模块
export {
    PetAuthService,
    PetAIService,
    petAuthService,
    petAIService
} from './services/index.js';

// Hooks模块
export {
    usePetState,
    usePetChat,
    usePetChatInput,
    usePetChatScroll,
    usePetDrag,
    usePetSession,
    usePetEvent,
    usePetStorage,
    usePetTheme,
    usePetThemeToggle,
    usePetCSSVariables,
    usePetThemePreference
} from './hooks/index.js';

// UI模块
export {
    // 头像
    PetAvatar,
    PetStatusIndicator,
    PetExpression,
    PetAnimation,
    
    // 聊天
    ChatMessage,
    ChatInput,
    ChatSessionList,
    ChatHeader,
    PetChat,
    
    // 拖拽
    DragController,
    usePetDrag,
    PetDraggable,
    
    // 工具提示
    PetTooltip,
    withTooltip,
    TooltipManager,
    
    // 菜单
    MenuItem,
    PetMenu,
    MenuManager,
    
    // 设置
    SettingItem,
    SettingGroup,
    PetSettings
} from './ui/index.js';

// 工具模块
export {
    petHelpers,
    chatHelpers,
    generatePetId,
    generateSessionId,
    generateMessageId,
    formatTimestamp,
    getRoleConfig,
    getPetColor,
    calculateDistance,
    isPositionInBounds,
    constrainPosition,
    checkCollision,
    generateRandomPosition,
    smoothMoveTo,
    parseEmojis,
    validateMessage,
    sanitizeMessage,
    generateMessageSummary,
    calculateTextSimilarity,
    isGreeting,
    generateDefaultResponse,
    formatMessageTime,
    groupMessagesByTime,
    detectMessageType,
    extractCodeBlocks,
    highlightCode,
    createMessageSummary,
    isSystemMessage,
    isErrorMessage,
    getMessageSender,
    searchMessages,
    filterMessagesByRole,
    filterMessagesByTimeRange,
    calculateMessageStats
} from './utils/index.js';

// 常量模块
export {
    PET_CONFIG,
    CHAT_CONFIG,
    DRAG_CONFIG,
    STATE_CONFIG,
    EVENT_CONFIG,
    API_CONFIG,
    ERROR_CONFIG,
    THEME_CONFIG
} from './constants/index.js';

// 类型模块
export {
    PetStateTypes,
    MessageRoleTypes,
    MessageStatusTypes,
    DragStateTypes,
    EventTypes,
    ErrorTypes,
    ApiResponseTypes,
    ThemeTypes,
    StorageTypes,
    AnimationTypes
} from './types/index.js';

// 默认导出
export default {
    // 核心
    PetManagerCore,
    PetStateManager,
    PetEventManager,
    petStateManager,
    petEventManager,
    
    // 服务
    PetAuthService,
    PetAIService,
    petAuthService,
    petAIService,
    
    // Hooks
    usePetState,
    usePetChat,
    usePetChatInput,
    usePetChatScroll,
    usePetDrag,
    usePetSession,
    usePetEvent,
    usePetStorage,
    usePetTheme,
    usePetThemeToggle,
    usePetCSSVariables,
    usePetThemePreference,
    
    // UI
    PetAvatar,
    PetStatusIndicator,
    PetExpression,
    PetAnimation,
    ChatMessage,
    ChatInput,
    ChatSessionList,
    ChatHeader,
    PetChat,
    DragController,
    usePetDrag,
    PetDraggable,
    PetTooltip,
    withTooltip,
    TooltipManager,
    MenuItem,
    PetMenu,
    MenuManager,
    SettingItem,
    SettingGroup,
    PetSettings,
    
    // 工具
    petHelpers,
    chatHelpers,
    generatePetId,
    generateSessionId,
    generateMessageId,
    formatTimestamp,
    getRoleConfig,
    getPetColor,
    calculateDistance,
    isPositionInBounds,
    constrainPosition,
    checkCollision,
    generateRandomPosition,
    smoothMoveTo,
    parseEmojis,
    validateMessage,
    sanitizeMessage,
    generateMessageSummary,
    calculateTextSimilarity,
    isGreeting,
    generateDefaultResponse,
    formatMessageTime,
    groupMessagesByTime,
    detectMessageType,
    extractCodeBlocks,
    highlightCode,
    createMessageSummary,
    isSystemMessage,
    isErrorMessage,
    getMessageSender,
    searchMessages,
    filterMessagesByRole,
    filterMessagesByTimeRange,
    calculateMessageStats,
    
    // 常量
    PET_CONFIG,
    CHAT_CONFIG,
    DRAG_CONFIG,
    STATE_CONFIG,
    EVENT_CONFIG,
    API_CONFIG,
    ERROR_CONFIG,
    THEME_CONFIG,
    
    // 类型
    PetStateTypes,
    MessageRoleTypes,
    MessageStatusTypes,
    DragStateTypes,
    EventTypes,
    ErrorTypes,
    ApiResponseTypes,
    ThemeTypes,
    StorageTypes,
    AnimationTypes
};