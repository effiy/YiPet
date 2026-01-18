/**
 * ChatWindow 组件
 * 聊天窗口组件
 * author: liangliang
 */

export default {
    name: 'ChatWindow',
    props: {
        visible: {
            type: Boolean,
            default: false
        },
        size: {
            type: Object,
            default: () => ({ width: 700, height: 600 })
        },
        position: {
            type: Object,
            default: () => ({ x: 'center', y: '12%' })
        },
        isFullscreen: {
            type: Boolean,
            default: false
        }
    },
    emits: ['close', 'toggle-fullscreen', 'drag', 'resize'],
    setup(props, { emit }) {
        const handleClose = (e) => {
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
                emit('close', e);
            } catch (error) {
                console.error('[ChatWindow.vue] handleClose 出错:', error);
                // 即使出错也尝试发出关闭事件
                try {
                    emit('close');
                } catch (emitError) {
                    console.error('[ChatWindow.vue] 发出关闭事件失败:', emitError);
                }
            }
        };

        const handleToggleFullscreen = () => {
            emit('toggle-fullscreen');
        };

        const windowStyle = Vue.computed(() => {
            const pos = props.position || { x: 'center', y: '12%' };
            const size = props.size || { width: 700, height: 600 };

            let left = '50%';
            let top = pos.y;

            if (typeof pos.x === 'number') {
                left = `${pos.x}px`;
            } else if (pos.x === 'center') {
                left = '50%';
            } else {
                left = pos.x;
            }

            if (typeof pos.y === 'number') {
                top = `${pos.y}px`;
            }

            return {
                width: props.isFullscreen ? '100vw' : `${size.width}px`,
                height: props.isFullscreen ? '100vh' : `${size.height}px`,
                left: props.isFullscreen ? '0' : (pos.x === 'center' ? '50%' : left),
                top: props.isFullscreen ? '0' : top,
                transform: props.isFullscreen ? 'none' : (pos.x === 'center' ? 'translateX(-50%)' : 'none'),
                display: props.visible ? 'flex' : 'none',
                flexDirection: 'column',
                position: 'fixed',
                zIndex: 2147483648,
                borderRadius: props.isFullscreen ? '0' : '16px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                pointerEvents: 'auto'
            };
        });

        return {
            handleClose,
            handleToggleFullscreen,
            windowStyle
        };
    },
    template: `
        <div
            class="yi-chat-window"
            :style="windowStyle"
            v-show="visible"
        >
            <slot></slot>
        </div>
    `
};
