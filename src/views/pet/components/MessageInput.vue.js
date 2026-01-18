/**
 * MessageInput 组件
 * 消息输入组件
 * author: liangliang
 */

export default {
    name: 'MessageInput',
    props: {
        value: {
            type: String,
            default: ''
        },
        disabled: {
            type: Boolean,
            default: false
        },
        placeholder: {
            type: String,
            default: '输入消息...'
        }
    },
    emits: ['input', 'send'],
    setup(props, { emit }) {
        const inputRef = Vue.ref(null);
        const content = Vue.ref(props.value || '');

        Vue.watch(() => props.value, (newVal) => {
            content.value = newVal || '';
        });

        const handleInput = (e) => {
            content.value = e.target.value;
            emit('input', content.value);
        };

        const handleSend = () => {
            if (content.value.trim() && !props.disabled) {
                emit('send', content.value.trim());
                content.value = '';
                emit('input', '');
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        };

        return {
            inputRef,
            content,
            handleInput,
            handleSend,
            handleKeyDown
        };
    },
    template: `
        <div class="yi-message-input">
            <textarea
                ref="inputRef"
                v-model="content"
                :placeholder="placeholder"
                :disabled="disabled"
                @input="handleInput"
                @keydown="handleKeyDown"
                class="yi-message-input-textarea"
                rows="3"
            ></textarea>
            <button
                @click="handleSend"
                :disabled="disabled || !content.trim()"
                class="yi-btn yi-btn-primary yi-message-input-send"
            >
                发送
            </button>
        </div>
    `
};
