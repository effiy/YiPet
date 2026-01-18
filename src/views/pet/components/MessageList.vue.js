/**
 * MessageList 组件
 * 消息列表组件
 * author: liangliang
 */

export default {
    name: 'MessageList',
    props: {
        messages: {
            type: Array,
            default: () => []
        },
        thinking: {
            type: Boolean,
            default: false
        }
    },
    setup(props) {
        const formatTime = (timestamp) => {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        };

        const scrollToBottom = () => {
            Vue.nextTick(() => {
                const container = document.querySelector('.yi-message-list');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            });
        };

        Vue.watch(() => props.messages.length, () => {
            scrollToBottom();
        });

        Vue.onMounted(() => {
            scrollToBottom();
        });

        return {
            formatTime
        };
    },
    template: `
        <div class="yi-message-list">
            <div
                v-for="message in messages"
                :key="message.id"
                class="yi-message-item"
                :class="'yi-message-' + message.role"
            >
                <div class="yi-message-avatar">
                    <span v-if="message.role === 'user'">👤</span>
                    <span v-else>🤖</span>
                </div>
                <div class="yi-message-content">
                    <div class="yi-message-text" v-html="message.content"></div>
                    <div class="yi-message-time">{{ formatTime(message.timestamp) }}</div>
                </div>
            </div>
            <div v-if="thinking" class="yi-message-item yi-message-assistant">
                <div class="yi-message-avatar">🤖</div>
                <div class="yi-message-content">
                    <div class="yi-message-thinking">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        </div>
    `
};
