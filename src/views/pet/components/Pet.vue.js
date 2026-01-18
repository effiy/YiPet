/**
 * Pet 组件
 * 宠物显示组件
 * author: liangliang
 */

export default {
    name: 'Pet',
    props: {
        visible: {
            type: Boolean,
            default: false
        },
        size: {
            type: Number,
            default: 180
        },
        color: {
            type: String,
            default: 'linear-gradient(135deg, #667eea, #764ba2)'
        },
        position: {
            type: Object,
            default: () => ({ x: 20, y: '20%' })
        },
        role: {
            type: String,
            default: '教师'
        }
    },
    emits: ['click', 'drag'],
    setup(props, { emit }) {
        const isDragging = Vue.ref(false);
        const dragStartPos = Vue.ref({ x: 0, y: 0 });
        const dragOffset = Vue.ref({ x: 0, y: 0 });

        const handleClick = (e) => {
            // 如果正在拖拽，不触发点击事件
            if (isDragging.value) {
                return;
            }
            emit('click', e);
        };

        const handleMouseDown = (e) => {
            if (e.button !== 0) return; // 只处理左键
            isDragging.value = false;
            dragStartPos.value = { x: e.clientX, y: e.clientY };
            dragOffset.value = { x: 0, y: 0 };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            e.preventDefault();
        };

        const handleMouseMove = (e) => {
            if (!dragStartPos.value) return;

            const dx = e.clientX - dragStartPos.value.x;
            const dy = e.clientY - dragStartPos.value.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 如果移动距离超过5px，认为是拖拽
            if (distance > 5) {
                isDragging.value = true;
            }

            if (isDragging.value) {
                dragOffset.value = { x: dx, y: dy };
                emit('drag', {
                    type: 'move',
                    offset: dragOffset.value,
                    position: {
                        x: e.clientX,
                        y: e.clientY
                    }
                });
            }
        };

        const handleMouseUp = (e) => {
            if (isDragging.value) {
                emit('drag', {
                    type: 'end',
                    offset: dragOffset.value,
                    position: {
                        x: e.clientX,
                        y: e.clientY
                    }
                });
            }

            dragStartPos.value = null;
            isDragging.value = false;
            dragOffset.value = { x: 0, y: 0 };

            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        const style = Vue.computed(() => {
            const pos = props.position || { x: 20, y: '20%' };
            return {
                width: `${props.size}px`,
                height: `${props.size}px`,
                left: typeof pos.x === 'number' ? `${pos.x}px` : pos.x,
                top: typeof pos.y === 'number' ? `${pos.y}px` : pos.y,
                background: props.color,
                display: props.visible ? 'block' : 'none',
                position: 'fixed',
                borderRadius: '50%',
                cursor: 'move',
                zIndex: 2147483647,
                pointerEvents: props.visible ? 'auto' : 'none',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            };
        });

        const roleIconPath = Vue.computed(() => {
            const role = props.role || '教师';
            return chrome?.runtime?.getURL(`src/assets/images/${role}/icon.png`) || '';
        });

        return {
            handleClick,
            handleMouseDown,
            style,
            roleIconPath
        };
    },
    template: `
        <div
            class="yi-pet"
            :style="style"
            @click="handleClick"
            @mousedown="handleMouseDown"
        >
            <img
                v-if="roleIconPath"
                :src="roleIconPath"
                :alt="role"
                style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%; pointer-events: none;"
            />
        </div>
    `
};
