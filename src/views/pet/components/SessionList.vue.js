/**
 * SessionList 组件
 * 会话列表组件
 * author: liangliang
 */

export default {
    name: 'SessionList',
    props: {
        sessions: {
            type: Array,
            default: () => []
        },
        currentSessionId: {
            type: String,
            default: null
        },
        collapsed: {
            type: Boolean,
            default: false
        },
        width: {
            type: Number,
            default: 200
        }
    },
    emits: ['select-session', 'create-session', 'delete-session', 'update-title'],
    setup(props, { emit }) {
        const handleSelectSession = (sessionId) => {
            emit('select-session', sessionId);
        };

        const handleCreateSession = () => {
            emit('create-session');
        };

        const handleDeleteSession = (sessionId, e) => {
            e.stopPropagation();
            emit('delete-session', sessionId);
        };

        const handleUpdateTitle = (sessionId, newTitle) => {
            emit('update-title', sessionId, newTitle);
        };

        const sidebarStyle = Vue.computed(() => {
            return {
                width: props.collapsed ? '0' : `${props.width}px`,
                opacity: props.collapsed ? '0' : '1',
                overflow: props.collapsed ? 'hidden' : 'auto'
            };
        });

        const formatTime = (timestamp) => {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return '刚刚';
            if (minutes < 60) return `${minutes}分钟前`;
            if (hours < 24) return `${hours}小时前`;
            if (days < 7) return `${days}天前`;
            return date.toLocaleDateString();
        };

        return {
            handleSelectSession,
            handleCreateSession,
            handleDeleteSession,
            handleUpdateTitle,
            sidebarStyle,
            formatTime
        };
    },
    template: `
        <div class="yi-session-list" :style="sidebarStyle">
            <div class="yi-session-list-header">
                <button @click="handleCreateSession" class="yi-btn yi-btn-primary">
                    <span>+</span> 新建会话
                </button>
            </div>
            <div class="yi-session-list-content">
                <div
                    v-for="session in sessions"
                    :key="session.id"
                    class="yi-session-item"
                    :class="{ active: session.id === currentSessionId }"
                    @click="handleSelectSession(session.id)"
                >
                    <div class="yi-session-item-content">
                        <div class="yi-session-item-title">{{ session.title || '未命名会话' }}</div>
                        <div class="yi-session-item-time">{{ formatTime(session.lastAccessTime || session.updatedAt || session.createdAt) }}</div>
                    </div>
                    <button
                        class="yi-session-item-delete"
                        @click="handleDeleteSession(session.id, $event)"
                        title="删除会话"
                    >
                        ×
                    </button>
                </div>
                <div v-if="sessions.length === 0" class="yi-session-list-empty">
                    暂无会话
                </div>
            </div>
        </div>
    `
};
