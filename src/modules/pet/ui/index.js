/**
 * Pet Module UI Index
 * 宠物模块UI入口文件
 */

// 头像相关组件
export { PetAvatar, PetStatusIndicator, PetExpression, PetAnimation } from './PetAvatar.js';

// 聊天相关组件
export { ChatMessage, ChatInput, ChatSessionList, ChatHeader, PetChat } from './PetChat.js';

// 拖拽相关组件
export { DragController, usePetDrag, PetDraggable } from './PetDrag.js';

// 工具提示组件
export { PetTooltip, withTooltip, TooltipManager } from './PetTooltip.js';

// 菜单组件
export { MenuItem, PetMenu, MenuManager } from './PetMenu.js';

// 设置组件
export { SettingItem, SettingGroup, PetSettings } from './PetSettings.js';

// 默认导出
export default {
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
};