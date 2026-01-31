/**
 * Session Module - Main Entry
 * 会话模块主入口
 */

// 会话核心功能
export { SessionManager } from './core/SessionManager.js';
export { SessionStorage } from './core/SessionStorage.js';

// 会话服务
export { SessionService } from './services/SessionService.js';
export { SessionSyncService } from './services/SessionSyncService.js';

// 会话Hooks
export { useSession } from './hooks/useSession.js';
export { useSessionStorage } from './hooks/useSessionStorage.js';
export { useSessionSync } from './hooks/useSessionSync.js';

// 会话UI组件
export { SessionManagerUI } from './ui/SessionManagerUI.js';
export { SessionList } from './ui/SessionList.js';
export { SessionDetail } from './ui/SessionDetail.js';
export { SessionSettings } from './ui/SessionSettings.js';

// 会话工具
export { 
    createSession,
    updateSession,
    deleteSession,
    duplicateSession,
    mergeSessions,
    splitSession,
    archiveSession,
    restoreSession
} from './utils/sessionUtils.js';

export { 
    exportSession,
    importSession,
    backupSessions,
    restoreSessions,
    validateSession,
    sanitizeSession,
    compressSession,
    decompressSession
} from './utils/storageUtils.js';

export { 
    syncSessions,
    resolveConflicts,
    mergeSessionData,
    validateSyncData,
    handleSyncErrors
} from './utils/syncUtils.js';

// 会话常量
export { 
    SESSION_CONSTANTS,
    SESSION_TYPES,
    SYNC_MODES,
    STORAGE_MODES,
    SESSION_SETTINGS
} from './constants/index.js';

// 会话类型
export { 
    SessionType,
    SessionDataType,
    SyncModeType,
    StorageModeType,
    SessionSettingsType
} from './types/index.js';

// 默认导出
export default {
    // 核心
    SessionManager,
    SessionStorage,
    
    // 服务
    SessionService,
    SessionSyncService,
    
    // Hooks
    useSession,
    useSessionStorage,
    useSessionSync,
    
    // UI
    SessionManagerUI,
    SessionList,
    SessionDetail,
    SessionSettings,
    
    // 工具
    createSession,
    updateSession,
    deleteSession,
    duplicateSession,
    mergeSessions,
    splitSession,
    archiveSession,
    restoreSession,
    exportSession,
    importSession,
    backupSessions,
    restoreSessions,
    validateSession,
    sanitizeSession,
    compressSession,
    decompressSession,
    syncSessions,
    resolveConflicts,
    mergeSessionData,
    validateSyncData,
    handleSyncErrors,
    
    // 常量
    SESSION_CONSTANTS,
    SESSION_TYPES,
    SYNC_MODES,
    STORAGE_MODES,
    SESSION_SETTINGS,
    
    // 类型
    SessionType,
    SessionDataType,
    SyncModeType,
    StorageModeType,
    SessionSettingsType
};