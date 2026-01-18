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
        const handleClick = () => {
            emit('click');
        };

        const handleDragStart = (e) => {
            emit('drag', { type: 'start', event: e });
        };

        const handleDrag = (e) => {
            emit('drag', { type: 'move', event: e });
        };

        const handleDragEnd = (e) => {
            emit('drag', { type: 'end', event: e });
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
            handleDragStart,
            handleDrag,
            handleDragEnd,
            style,
            roleIconPath
        };
    },
    template: `
        <div
            class="yi-pet"
            :style="style"
            @click="handleClick"
            @mousedown="handleDragStart"
            @mousemove="handleDrag"
            @mouseup="handleDragEnd"
            @mouseleave="handleDragEnd"
        >
            <img
                v-if="roleIconPath"
                :src="roleIconPath"
                :alt="role"
                style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;"
            />
        </div>
    `
};
