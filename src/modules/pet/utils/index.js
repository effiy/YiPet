/**
 * Pet Module Utilities Index
 * 工具函数模块的入口文件
 */

// 宠物相关工具
import * as petHelpers from './petHelpers.js';

// 聊天相关工具
import * as chatHelpers from './chatHelpers.js';

// 导出所有工具函数
export {
    petHelpers,
    chatHelpers
};

// 从petHelpers导出
export {
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
    generateDefaultResponse
} from './petHelpers.js';

// 从chatHelpers导出
export {
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
} from './chatHelpers.js';

// 默认导出
export default {
    petHelpers,
    chatHelpers,
    ...petHelpers,
    ...chatHelpers
};