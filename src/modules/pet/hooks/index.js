/**
 * Pet Module Hooks Index
 * 宠物模块Hooks入口文件
 */

// 状态管理Hooks
export { usePetState } from './usePetState.js';

// 聊天相关Hooks
export { 
    usePetChat, 
    usePetChatInput, 
    usePetChatScroll 
} from './usePetChat.js';

// 拖拽相关Hooks
export { usePetDrag } from './ui/PetDrag.js';

// 会话管理Hooks
export { usePetSession } from './usePetSession.js';

// 工具Hooks
export { usePetEvent } from './usePetEvent.js';
export { usePetStorage } from './usePetStorage.js';
export { usePetTheme } from './usePetTheme.js';

// 默认导出
export default {
    // 状态管理
    usePetState,
    
    // 聊天
    usePetChat,
    usePetChatInput,
    usePetChatScroll,
    
    // 拖拽
    usePetDrag,
    
    // 会话
    usePetSession,
    
    // 工具
    usePetEvent,
    usePetStorage,
    usePetTheme
};