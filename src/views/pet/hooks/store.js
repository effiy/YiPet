/**
 * Pet 视图状态管理
 * author: liangliang
 * 适配 Chrome 扩展环境
 * 参考 YiWeb 的设计模式
 */

import { logInfo, logWarn, logError } from '../../../utils/base/log.js';

// 兼容Vue2和Vue3的ref获取方式
const vueRef = typeof Vue !== 'undefined' && Vue.ref ? Vue.ref : (val) => ({ value: val });

// 确保Vue已加载
if (typeof Vue === 'undefined') {
    console.error('[Pet Store] Vue未加载，无法创建响应式数据');
    throw new Error('Vue未加载');
}

/**
 * 数据存储工厂函数
 * 管理宠物状态、聊天窗口状态等
 * @returns {Object} store对象
 */
export const createStore = () => {
    // 宠物相关状态
    const petVisible = vueRef(false);
    const petSize = vueRef(180);
    const petColorIndex = vueRef(0);
    const petPosition = vueRef({ x: 20, y: '20%' });
    const petRole = vueRef('教师');
    const petColors = vueRef([
        "linear-gradient(135deg, #ff6b6b, #ff8e8e)",
        "linear-gradient(135deg, #4ecdc4, #44a08d)",
        "linear-gradient(135deg, #ff9a9e, #fecfef)",
        "linear-gradient(135deg, #a8edea, #fed6e3)",
        "linear-gradient(135deg, #ffecd2, #fcb69f)"
    ]);
    const petIsDragging = vueRef(false);

    // 聊天窗口相关状态
    const chatWindowVisible = vueRef(false);
    const chatWindowSize = vueRef({ width: 700, height: 600 });
    const chatWindowPosition = vueRef({ x: 'center', y: '12%' });
    const chatWindowIsDragging = vueRef(false);
    const chatWindowIsResizing = vueRef(false);
    const chatWindowIsFullscreen = vueRef(false);
    const inputContainerCollapsed = vueRef(false);
    const inputHeight = vueRef(150);

    // AI模型相关状态
    const currentModel = vueRef('qwen3');
    const availableModels = vueRef([
        { key: 'qwen3', name: '通义千问', description: '阿里云通义千问模型' },
        { key: 'gpt4', name: 'GPT-4', description: 'OpenAI GPT-4 模型' }
    ]);

    // 会话相关状态
    const currentSessionId = vueRef(null);
    const sessions = vueRef({});
    const messages = vueRef([]);
    const isSwitchingSession = vueRef(false);
    const currentPageUrl = vueRef(null);
    const hasAutoCreatedSessionForPage = vueRef(false);

    // UI状态
    const loading = vueRef(false);
    const error = vueRef(null);
    const thinking = vueRef(false); // AI 正在思考

    // 侧边栏状态
    const sidebarWidth = vueRef(200);
    const sidebarCollapsed = vueRef(false);
    const isResizingSidebar = vueRef(false);

    // 标签过滤相关
    const selectedFilterTags = vueRef([]);
    const tagFilterReverse = vueRef(false);
    const tagFilterNoTags = vueRef(false);
    const allTags = vueRef([]); // 所有可用标签

    // 搜索相关
    const searchQuery = vueRef('');
    const sessionTitleFilter = vueRef('');

    // 消息输入相关
    const inputContent = vueRef('');
    const isSending = vueRef(false);

    // 角色配置相关
    const roleConfigs = vueRef({});
    const currentRoleConfig = vueRef(null);

    // 页面信息相关
    const pageInfo = vueRef({
        title: '',
        url: '',
        text: ''
    });

    /**
     * 清除错误
     */
    const clearError = () => {
        error.value = null;
    };

    /**
     * 设置错误
     */
    const setError = (err) => {
        error.value = err;
        logError('[Pet Store] 错误:', err);
    };

    /**
     * 初始化状态（从存储加载）
     */
    const loadState = async () => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['petGlobalState', 'petChatWindowState']);

                if (result.petGlobalState) {
                    const state = result.petGlobalState;
                    if (state.visible !== undefined) petVisible.value = state.visible;
                    if (state.size !== undefined) petSize.value = state.size;
                    if (state.colorIndex !== undefined) petColorIndex.value = state.colorIndex;
                    if (state.position) petPosition.value = state.position;
                    if (state.role) petRole.value = state.role;
                    logInfo('[Pet Store] 已加载宠物状态');
                }

                if (result.petChatWindowState) {
                    const state = result.petChatWindowState;
                    if (state.size) chatWindowSize.value = state.size;
                    if (state.position) chatWindowPosition.value = state.position;
                    if (state.sidebarWidth !== undefined) sidebarWidth.value = state.sidebarWidth;
                    if (state.sidebarCollapsed !== undefined) sidebarCollapsed.value = state.sidebarCollapsed;
                    logInfo('[Pet Store] 已加载聊天窗口状态');
                }
            }
        } catch (err) {
            logError('[Pet Store] 加载状态失败:', err);
        }
    };

    /**
     * 保存状态到存储
     */
    const saveState = async () => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({
                    petGlobalState: {
                        visible: petVisible.value,
                        size: petSize.value,
                        colorIndex: petColorIndex.value,
                        position: petPosition.value,
                        role: petRole.value
                    },
                    petChatWindowState: {
                        size: chatWindowSize.value,
                        position: chatWindowPosition.value,
                        sidebarWidth: sidebarWidth.value,
                        sidebarCollapsed: sidebarCollapsed.value
                    }
                });
                logInfo('[Pet Store] 状态已保存');
            }
        } catch (err) {
            logError('[Pet Store] 保存状态失败:', err);
        }
    };

    // 初始化时加载状态
    loadState();

    return {
        // 宠物状态
        petVisible,
        petSize,
        petColorIndex,
        petPosition,
        petRole,
        petColors,
        petIsDragging,

        // 聊天窗口状态
        chatWindowVisible,
        chatWindowSize,
        chatWindowPosition,
        chatWindowIsDragging,
        chatWindowIsResizing,
        chatWindowIsFullscreen,
        inputContainerCollapsed,
        inputHeight,

        // AI模型状态
        currentModel,
        availableModels,

        // 会话状态
        currentSessionId,
        sessions,
        messages,
        isSwitchingSession,
        currentPageUrl,
        hasAutoCreatedSessionForPage,

        // UI状态
        loading,
        error,
        thinking,

        // 侧边栏状态
        sidebarWidth,
        sidebarCollapsed,
        isResizingSidebar,

        // 标签过滤
        selectedFilterTags,
        tagFilterReverse,
        tagFilterNoTags,
        allTags,

        // 搜索
        searchQuery,
        sessionTitleFilter,

        // 消息输入
        inputContent,
        isSending,

        // 角色配置
        roleConfigs,
        currentRoleConfig,

        // 页面信息
        pageInfo,

        // 方法
        clearError,
        setError,
        loadState,
        saveState
    };
};
