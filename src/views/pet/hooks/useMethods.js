/**
 * Pet 视图方法组合
 * author: liangliang
 * 参考 YiWeb 的设计模式
 */

import { logInfo, logWarn, logError } from '../../../utils/base/log.js';
import { safeExecuteAsync } from '../../../utils/base/error.js';

/**
 * 方法组合函数
 * @param {Object} store - 状态管理对象
 * @returns {Object} 方法对象
 */
export const useMethods = (store) => {
    // ==================== 宠物相关方法 ====================

    /**
     * 切换宠物显示/隐藏
     */
    const togglePet = () => {
        store.petVisible.value = !store.petVisible.value;
        store.saveState();
        logInfo('[Pet Methods] 切换宠物显示状态:', store.petVisible.value);
    };

    /**
     * 切换宠物颜色
     */
    const changePetColor = () => {
        const colors = store.petColors.value || [];
        if (colors.length > 0) {
            store.petColorIndex.value = (store.petColorIndex.value + 1) % colors.length;
            store.saveState();
            logInfo('[Pet Methods] 切换宠物颜色:', store.petColorIndex.value);
        }
    };

    /**
     * 设置宠物颜色
     */
    const setPetColor = (index) => {
        const colors = store.petColors.value || [];
        if (index >= 0 && index < colors.length) {
            store.petColorIndex.value = index;
            store.saveState();
            logInfo('[Pet Methods] 设置宠物颜色:', index);
        }
    };

    /**
     * 设置宠物大小
     */
    const setPetSize = (size) => {
        const minSize = 80;
        const maxSize = 400;
        const newSize = Math.max(minSize, Math.min(maxSize, size));
        store.petSize.value = newSize;
        store.saveState();
        logInfo('[Pet Methods] 设置宠物大小:', newSize);
    };

    /**
     * 设置宠物角色
     */
    const setPetRole = (role) => {
        const validRoles = ['教师', '医生', '甜品师', '警察'];
        if (validRoles.includes(role)) {
            store.petRole.value = role;
            store.saveState();
            logInfo('[Pet Methods] 设置宠物角色:', role);
        } else {
            logWarn('[Pet Methods] 无效的角色:', role);
        }
    };

    /**
     * 设置宠物位置
     */
    const setPetPosition = (position) => {
        store.petPosition.value = { ...store.petPosition.value, ...position };
        store.saveState();
    };

    /**
     * 处理宠物拖拽
     */
    const handlePetDrag = (dragData) => {
        if (dragData.type === 'move') {
            const currentPos = store.petPosition.value || { x: 20, y: '20%' };
            const newX = typeof currentPos.x === 'number'
                ? currentPos.x + dragData.offset.x
                : dragData.position.x;
            const newY = typeof currentPos.y === 'number'
                ? currentPos.y + dragData.offset.y
                : dragData.position.y;

            setPetPosition({ x: newX, y: newY });
        } else if (dragData.type === 'end') {
            store.saveState();
        }
    };

    // ==================== 聊天窗口相关方法 ====================

    /**
     * 打开聊天窗口
     */
    const openChatWindow = () => {
        store.chatWindowVisible.value = true;
        console.log('[Pet Methods] 打开聊天窗口');
    };

    /**
     * 关闭聊天窗口
     */
    const closeChatWindow = (e) => {
        try {
            // 阻止事件冒泡和默认行为
            if (e) {
                if (typeof e.preventDefault === 'function') {
                    e.preventDefault();
                }
                if (typeof e.stopPropagation === 'function') {
                    e.stopPropagation();
                }
                if (typeof e.stopImmediatePropagation === 'function') {
                    e.stopImmediatePropagation();
                }
            }

            // 设置窗口为不可见
            if (store && store.chatWindowVisible) {
                store.chatWindowVisible.value = false;
                logInfo('[Pet Methods] 聊天窗口已关闭');
            } else {
                logWarn('[Pet Methods] store 或 chatWindowVisible 不存在');
            }

            // 同时尝试关闭原生 JS 版本的窗口（如果存在）
            try {
                const nativeChatWindow = document.getElementById('pet-chat-window');
                if (nativeChatWindow) {
                    nativeChatWindow.style.setProperty('display', 'none', 'important');
                    nativeChatWindow.style.setProperty('visibility', 'hidden', 'important');
                    nativeChatWindow.style.setProperty('opacity', '0', 'important');
                    nativeChatWindow.setAttribute('hidden', '');
                    logInfo('[Pet Methods] 原生 JS 窗口也已关闭');
                }
            } catch (nativeError) {
                logWarn('[Pet Methods] 关闭原生 JS 窗口时出错:', nativeError);
            }

            // 更新 PetManager 状态（如果存在）
            try {
                if (window.petManager && typeof window.petManager.closeChatWindow === 'function') {
                    window.petManager.closeChatWindow();
                } else if (window.petManager) {
                    window.petManager.isChatOpen = false;
                }
            } catch (managerError) {
                logWarn('[Pet Methods] 更新 PetManager 状态时出错:', managerError);
            }

        } catch (error) {
            logError('[Pet Methods] closeChatWindow 执行出错:', error);
            // 即使出错也尝试设置窗口为不可见
            try {
                if (store && store.chatWindowVisible) {
                    store.chatWindowVisible.value = false;
                }
            } catch (fallbackError) {
                logError('[Pet Methods] 回退关闭操作也失败:', fallbackError);
            }
        }
    };

    /**
     * 切换聊天窗口
     */
    const toggleChatWindow = () => {
        console.log('[Pet Methods] toggleChatWindow 被调用, 当前状态:', store.chatWindowVisible.value);
        if (store.chatWindowVisible.value) {
            closeChatWindow();
        } else {
            openChatWindow();
        }
    };

    /**
     * 切换全屏模式
     */
    const toggleFullscreen = () => {
        store.chatWindowIsFullscreen.value = !store.chatWindowIsFullscreen.value;
        logInfo('[Pet Methods] 切换全屏模式:', store.chatWindowIsFullscreen.value);
    };

    /**
     * 切换侧边栏
     */
    const toggleSidebar = () => {
        store.sidebarCollapsed.value = !store.sidebarCollapsed.value;
        store.saveState();
        logInfo('[Pet Methods] 切换侧边栏:', store.sidebarCollapsed.value);
    };

    /**
     * 设置侧边栏宽度
     */
    const setSidebarWidth = (width) => {
        const minWidth = 150;
        const maxWidth = 500;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, width));
        store.sidebarWidth.value = newWidth;
        store.saveState();
    };

    /**
     * 切换输入框容器
     */
    const toggleInputContainer = () => {
        store.inputContainerCollapsed.value = !store.inputContainerCollapsed.value;
        logInfo('[Pet Methods] 切换输入框容器:', store.inputContainerCollapsed.value);
    };

    // ==================== 会话相关方法 ====================

    /**
     * 加载所有会话
     */
    const loadAllSessions = async () => {
        return safeExecuteAsync(async () => {
            store.loading.value = true;
            try {
                // 从 chrome.storage 加载会话
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    const result = await chrome.storage.local.get(['petSessions']);
                    if (result.petSessions) {
                        store.sessions.value = result.petSessions;
                        logInfo('[Pet Methods] 已加载会话:', Object.keys(store.sessions.value).length);
                    }
                }
            } catch (err) {
                logError('[Pet Methods] 加载会话失败:', err);
                store.setError(err);
            } finally {
                store.loading.value = false;
            }
        }, '加载会话');
    };

    /**
     * 保存所有会话
     */
    const saveAllSessions = async () => {
        return safeExecuteAsync(async () => {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.set({ petSessions: store.sessions.value });
                    logInfo('[Pet Methods] 已保存会话');
                }
            } catch (err) {
                logError('[Pet Methods] 保存会话失败:', err);
            }
        }, '保存会话');
    };

    /**
     * 切换会话
     */
    const switchSession = async (sessionId) => {
        return safeExecuteAsync(async () => {
            if (!sessionId) {
                logWarn('[Pet Methods] 会话ID为空');
                return;
            }

            if (store.isSwitchingSession.value) {
                logWarn('[Pet Methods] 正在切换会话，跳过');
                return;
            }

            store.isSwitchingSession.value = true;
            try {
                const session = store.sessions.value[sessionId];
                if (!session) {
                    logError('[Pet Methods] 会话不存在:', sessionId);
                    return;
                }

                // 更新当前会话ID
                store.currentSessionId.value = sessionId;

                // 更新会话访问时间
                session.lastAccessTime = Date.now();
                store.sessions.value = { ...store.sessions.value };

                logInfo('[Pet Methods] 切换会话:', sessionId);
            } finally {
                setTimeout(() => {
                    store.isSwitchingSession.value = false;
                }, 300);
            }
        }, '切换会话');
    };

    /**
     * 创建新会话
     */
    const createSession = async (title = null) => {
        return safeExecuteAsync(async () => {
            const pageInfo = store.pageInfo.value || {};
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const now = new Date().toISOString();

            const newSession = {
                id: sessionId,
                title: title || pageInfo.title || '新会话',
                messages: [],
                tags: [],
                url: pageInfo.url || '',
                createdAt: now,
                updatedAt: now,
                lastAccessTime: Date.now()
            };

            store.sessions.value = {
                ...store.sessions.value,
                [sessionId]: newSession
            };

            store.currentSessionId.value = sessionId;
            await saveAllSessions();

            logInfo('[Pet Methods] 创建新会话:', sessionId);
            return sessionId;
        }, '创建会话');
    };

    /**
     * 删除会话
     */
    const deleteSession = async (sessionId) => {
        return safeExecuteAsync(async () => {
            if (!sessionId) {
                logWarn('[Pet Methods] 会话ID为空');
                return;
            }

            const sessions = { ...store.sessions.value };
            delete sessions[sessionId];
            store.sessions.value = sessions;

            // 如果删除的是当前会话，切换到其他会话
            if (store.currentSessionId.value === sessionId) {
                const otherSessions = Object.values(sessions);
                if (otherSessions.length > 0) {
                    const latestSession = otherSessions.sort((a, b) => {
                        const aTime = a.lastAccessTime || a.createdAt || 0;
                        const bTime = b.lastAccessTime || b.createdAt || 0;
                        return bTime - aTime;
                    })[0];
                    await switchSession(latestSession.id);
                } else {
                    store.currentSessionId.value = null;
                }
            }

            await saveAllSessions();
            logInfo('[Pet Methods] 删除会话:', sessionId);
        }, '删除会话');
    };

    /**
     * 更新会话标题
     */
    const updateSessionTitle = async (sessionId, title) => {
        return safeExecuteAsync(async () => {
            const session = store.sessions.value[sessionId];
            if (session) {
                session.title = title;
                session.updatedAt = new Date().toISOString();
                store.sessions.value = { ...store.sessions.value };
                await saveAllSessions();
                logInfo('[Pet Methods] 更新会话标题:', sessionId, title);
            }
        }, '更新会话标题');
    };

    // ==================== 消息相关方法 ====================

    /**
     * 发送消息
     */
    const sendMessage = async (content) => {
        return safeExecuteAsync(async () => {
            if (!content || !content.trim()) {
                logWarn('[Pet Methods] 消息内容为空');
                return;
            }

            // 确保有当前会话
            if (!store.currentSessionId.value) {
                await createSession();
            }

            const sessionId = store.currentSessionId.value;
            const session = store.sessions.value[sessionId];

            if (!session) {
                logError('[Pet Methods] 会话不存在:', sessionId);
                return;
            }

            // 添加用户消息
            const userMessage = {
                id: `msg_${Date.now()}`,
                role: 'user',
                content: content.trim(),
                timestamp: new Date().toISOString()
            };

            if (!session.messages) {
                session.messages = [];
            }
            session.messages.push(userMessage);

            // 更新会话
            session.updatedAt = new Date().toISOString();
            store.sessions.value = { ...store.sessions.value };

            // 清空输入框
            store.inputContent.value = '';

            // 设置发送状态
            store.isSending.value = true;
            store.thinking.value = true;

            logInfo('[Pet Methods] 发送消息:', content);

            // 这里可以添加调用AI接口的逻辑
            // TODO: 调用 AI API

            // 模拟AI回复（临时）
            setTimeout(() => {
                const aiMessage = {
                    id: `msg_${Date.now()}`,
                    role: 'assistant',
                    content: '这是一条模拟回复，实际应该调用AI接口',
                    timestamp: new Date().toISOString()
                };
                session.messages.push(aiMessage);
                session.updatedAt = new Date().toISOString();
                store.sessions.value = { ...store.sessions.value };
                store.isSending.value = false;
                store.thinking.value = false;
                saveAllSessions();
            }, 1000);

            return userMessage;
        }, '发送消息');
    };

    /**
     * 清空输入框
     */
    const clearInput = () => {
        store.inputContent.value = '';
    };

    // ==================== 搜索和过滤相关方法 ====================

    /**
     * 设置搜索查询
     */
    const setSearchQuery = (query) => {
        if (typeof query === 'string') {
            store.searchQuery.value = query.trim();
        }
    };

    /**
     * 清除搜索
     */
    const clearSearch = () => {
        store.searchQuery.value = '';
        store.sessionTitleFilter.value = '';
    };

    /**
     * 切换标签过滤
     */
    const toggleTagFilter = (tag) => {
        const tags = [...store.selectedFilterTags.value];
        const index = tags.indexOf(tag);
        if (index > -1) {
            tags.splice(index, 1);
        } else {
            tags.push(tag);
        }
        store.selectedFilterTags.value = tags;
    };

    /**
     * 清除标签过滤
     */
    const clearTagFilter = () => {
        store.selectedFilterTags.value = [];
        store.tagFilterReverse.value = false;
        store.tagFilterNoTags.value = false;
    };

    // ==================== 模型相关方法 ====================

    /**
     * 切换模型
     */
    const switchModel = (modelKey) => {
        const model = store.availableModels.value.find(m => m.key === modelKey);
        if (model) {
            store.currentModel.value = modelKey;
            logInfo('[Pet Methods] 切换模型:', modelKey);
        }
    };

    // ==================== 初始化方法 ====================

    /**
     * 初始化应用
     */
    const initApp = async () => {
        return safeExecuteAsync(async () => {
            logInfo('[Pet Methods] 开始初始化应用');

            // 加载会话
            await loadAllSessions();

            // 加载页面信息
            if (typeof window !== 'undefined') {
                store.pageInfo.value = {
                    title: document.title || '',
                    url: window.location.href || '',
                    text: document.body.innerText || ''
                };
            }

            logInfo('[Pet Methods] 应用初始化完成');
        }, '初始化应用');
    };

    return {
        // 宠物相关
        togglePet,
        changePetColor,
        setPetColor,
        setPetSize,
        setPetRole,
        setPetPosition,
        handlePetDrag,

        // 聊天窗口相关
        openChatWindow,
        closeChatWindow,
        toggleChatWindow,
        toggleFullscreen,
        toggleSidebar,
        setSidebarWidth,
        toggleInputContainer,

        // 会话相关
        loadAllSessions,
        saveAllSessions,
        switchSession,
        createSession,
        deleteSession,
        updateSessionTitle,

        // 消息相关
        sendMessage,
        clearInput,

        // 搜索和过滤
        setSearchQuery,
        clearSearch,
        toggleTagFilter,
        clearTagFilter,

        // 模型相关
        switchModel,

        // 初始化
        initApp
    };
};
