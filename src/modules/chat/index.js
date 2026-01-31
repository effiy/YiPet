/**
 * Chat Module - Main Entry
 * 聊天模块主入口
 */

// 聊天核心功能
export { ChatManager } from './core/ChatManager.js';
export { MessageManager } from './core/MessageManager.js';
export { SessionManager } from './core/SessionManager.js';

// 聊天服务
export { ChatService } from './services/ChatService.js';
export { AIService } from './services/AIService.js';

// 聊天Hooks
export { useChat } from './hooks/useChat.js';
export { useMessage } from './hooks/useMessage.js';
export { useSession } from './hooks/useSession.js';
export { useAI } from './hooks/useAI.js';

// 聊天UI组件
export { ChatWindow } from './ui/ChatWindow.js';
export { MessageList } from './ui/MessageList.js';
export { MessageInput } from './ui/MessageInput.js';
export { SessionSidebar } from './ui/SessionSidebar.js';

// 聊天工具
export { 
    formatMessage,
    groupMessages,
    searchMessages,
    filterMessages,
    validateMessage,
    sanitizeMessage
} from './utils/chatUtils.js';

export { 
    createMessage,
    updateMessage,
    deleteMessage,
    resendMessage
} from './utils/messageUtils.js';

export { 
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    exportSession,
    importSession
} from './utils/sessionUtils.js';

// 聊天常量
export { 
    CHAT_CONSTANTS,
    MESSAGE_TYPES,
    SESSION_TYPES,
    AI_PROVIDERS,
    CHAT_SETTINGS
} from './constants/index.js';

// 聊天类型
export { 
    ChatMessageType,
    ChatSessionType,
    ChatSettingsType,
    AIProviderType,
    MessageStatusType
} from './types/index.js';

// 默认导出
export default {
    // 核心
    ChatManager,
    MessageManager,
    SessionManager,
    
    // 服务
    ChatService,
    AIService,
    
    // Hooks
    useChat,
    useMessage,
    useSession,
    useAI,
    
    // UI
    ChatWindow,
    MessageList,
    MessageInput,
    SessionSidebar,
    
    // 工具
    formatMessage,
    groupMessages,
    searchMessages,
    filterMessages,
    validateMessage,
    sanitizeMessage,
    createMessage,
    updateMessage,
    deleteMessage,
    resendMessage,
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    exportSession,
    importSession,
    
    // 常量
    CHAT_CONSTANTS,
    MESSAGE_TYPES,
    SESSION_TYPES,
    AI_PROVIDERS,
    CHAT_SETTINGS,
    
    // 类型
    ChatMessageType,
    ChatSessionType,
    ChatSettingsType,
    AIProviderType,
    MessageStatusType
};