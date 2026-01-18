/**
 * Pet 视图计算属性
 * author: liangliang
 * 参考 YiWeb 的设计模式
 */

// 确保Vue已加载
if (typeof Vue === 'undefined') {
    console.error('[Pet useComputed] Vue未加载');
    throw new Error('Vue未加载');
}

const vueComputed = typeof Vue !== 'undefined' && Vue.computed ? Vue.computed : (fn) => ({ value: fn() });

/**
 * 计算属性组合函数
 * @param {Object} store - 状态管理对象
 * @returns {Object} 计算属性对象
 */
export const useComputed = (store) => {
    // 当前宠物的颜色
    const petColor = vueComputed(() => {
        const colors = store.petColors.value || [];
        const index = store.petColorIndex.value || 0;
        return colors[index] || colors[0] || 'linear-gradient(135deg, #667eea, #764ba2)';
    });

    // 当前宠物的样式对象
    const petStyle = vueComputed(() => {
        const position = store.petPosition.value || { x: 20, y: '20%' };
        return {
            width: `${store.petSize.value}px`,
            height: `${store.petSize.value}px`,
            left: typeof position.x === 'number' ? `${position.x}px` : position.x,
            top: typeof position.y === 'number' ? `${position.y}px` : position.y,
            background: petColor.value,
            display: store.petVisible.value ? 'block' : 'none'
        };
    });

    // 过滤后的会话列表（支持搜索和标签过滤）
    const filteredSessions = vueComputed(() => {
        const sessions = store.sessions.value || {};
        let sessionList = Object.values(sessions);

        // 根据搜索关键词过滤
        if (store.searchQuery.value || store.sessionTitleFilter.value) {
            const query = (store.searchQuery.value || store.sessionTitleFilter.value).toLowerCase();
            sessionList = sessionList.filter(session => {
                const title = (session.title || '').toLowerCase();
                return title.includes(query);
            });
        }

        // 根据标签过滤
        if (store.selectedFilterTags.value && store.selectedFilterTags.value.length > 0) {
            sessionList = sessionList.filter(session => {
                const sessionTags = session.tags || [];
                const sessionTagNames = sessionTags.map(t =>
                    typeof t === 'string' ? t : (t.name || t.label || '')
                ).filter(Boolean);

                if (store.tagFilterReverse.value) {
                    // 反向过滤：不包含任何选中标签
                    return !store.selectedFilterTags.value.some(tag =>
                        sessionTagNames.includes(tag)
                    );
                } else {
                    // 正向过滤：包含所有选中标签
                    return store.selectedFilterTags.value.every(tag =>
                        sessionTagNames.includes(tag)
                    );
                }
            });
        }

        // 过滤无标签会话
        if (store.tagFilterNoTags.value) {
            sessionList = sessionList.filter(session => {
                const tags = session.tags || [];
                return tags.length === 0;
            });
        }

        // 按时间排序（最新的在前）
        sessionList.sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
        });

        return sessionList;
    });

    // 当前会话
    const currentSession = vueComputed(() => {
        if (!store.currentSessionId.value) return null;
        return store.sessions.value[store.currentSessionId.value] || null;
    });

    // 当前会话的消息列表
    const currentMessages = vueComputed(() => {
        const session = currentSession.value;
        if (!session) return [];
        return session.messages || [];
    });

    // 是否有错误
    const hasError = vueComputed(() => {
        return store.error.value !== null;
    });

    // 是否正在加载
    const isLoading = vueComputed(() => {
        return store.loading.value === true;
    });

    // 是否可以发送消息
    const canSendMessage = vueComputed(() => {
        return !store.isSending.value &&
            !store.thinking.value &&
            store.inputContent.value.trim().length > 0 &&
            store.currentSessionId.value !== null;
    });

    // 聊天窗口样式
    const chatWindowStyle = vueComputed(() => {
        const position = store.chatWindowPosition.value || { x: 'center', y: '12%' };
        const size = store.chatWindowSize.value || { width: 700, height: 600 };

        let left = '50%';
        let top = position.y;

        if (typeof position.x === 'number') {
            left = `${position.x}px`;
        } else if (position.x === 'center') {
            left = '50%';
        } else {
            left = position.x;
        }

        if (typeof position.y === 'number') {
            top = `${position.y}px`;
        }

        return {
            width: `${size.width}px`,
            height: `${size.height}px`,
            left: position.x === 'center' ? '50%' : left,
            top: top,
            transform: position.x === 'center' ? 'translateX(-50%)' : 'none',
            display: store.chatWindowVisible.value ? 'block' : 'none'
        };
    });

    // 侧边栏样式
    const sidebarStyle = vueComputed(() => {
        return {
            width: store.sidebarCollapsed.value ? '0' : `${store.sidebarWidth.value}px`,
            opacity: store.sidebarCollapsed.value ? '0' : '1'
        };
    });

    // 会话数量
    const sessionCount = vueComputed(() => {
        return Object.keys(store.sessions.value || {}).length;
    });

    // 过滤后的会话数量
    const filteredSessionCount = vueComputed(() => {
        return filteredSessions.value.length;
    });

    // 当前模型信息
    const currentModelInfo = vueComputed(() => {
        const models = store.availableModels.value || [];
        return models.find(m => m.key === store.currentModel.value) || models[0] || null;
    });

    return {
        // 宠物相关
        petColor,
        petStyle,

        // 会话相关
        filteredSessions,
        currentSession,
        currentMessages,
        sessionCount,
        filteredSessionCount,

        // UI状态
        hasError,
        isLoading,
        canSendMessage,

        // 样式相关
        chatWindowStyle,
        sidebarStyle,

        // 模型相关
        currentModelInfo
    };
};
