/**
 * Pet Drag Hook
 * 用于管理宠物拖拽功能的自定义Hook
 */

import { petStateManager } from '../core/index.js';
import { usePetState } from './usePetState.js';

/**
 * 使用宠物拖拽
 */
export function usePetDrag() {
    const [isDragging, setIsDragging] = usePetState('isDragging');
    const [dragOffset, setDragOffset] = usePetState('dragOffset');
    const [position, setPosition] = usePetState('position');
    const dragRef = React.useRef(null);
    const startPosRef = React.useRef({ x: 0, y: 0 });

    /**
     * 开始拖拽
     */
    const startDrag = React.useCallback((event) => {
        if (event.button !== 0) return; // 只处理左键

        const petElement = dragRef.current;
        if (!petElement) return;

        // 获取宠物元素的位置
        const rect = petElement.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;

        // 设置拖拽状态
        setIsDragging(true);
        setDragOffset({ x: offsetX, y: offsetY });
        
        // 记录起始位置
        startPosRef.current = { x: event.clientX, y: event.clientY };

        // 添加全局事件监听
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('mouseleave', handleDragEnd);

        // 阻止默认行为
        event.preventDefault();
        event.stopPropagation();

        // 触发拖拽开始事件
        window.petEventManager.emit('drag:start', {
            startPosition: { x: rect.left, y: rect.top },
            offset: { x: offsetX, y: offsetY }
        });

    }, [setIsDragging, setDragOffset]);

    /**
     * 拖拽移动
     */
    const handleDragMove = React.useCallback((event) => {
        if (!isDragging) return;

        // 计算新位置
        const newX = event.clientX - dragOffset.x;
        const newY = event.clientY - dragOffset.y;

        // 边界检测
        const boundedPosition = getBoundedPosition(newX, newY);

        // 更新位置
        setPosition(boundedPosition);

        // 触发拖拽移动事件
        window.petEventManager.emit('drag:move', {
            position: boundedPosition,
            mousePosition: { x: event.clientX, y: event.clientY },
            delta: {
                x: event.clientX - startPosRef.current.x,
                y: event.clientY - startPosRef.current.y
            }
        });

    }, [isDragging, dragOffset, setPosition]);

    /**
     * 结束拖拽
     */
    const handleDragEnd = React.useCallback((event) => {
        if (!isDragging) return;

        // 移除全局事件监听
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('mouseleave', handleDragEnd);

        // 重置拖拽状态
        setIsDragging(false);
        setDragOffset({ x: 0, y: 0 });

        // 触发拖拽结束事件
        window.petEventManager.emit('drag:end', {
            finalPosition: position,
            dragDistance: {
                x: event.clientX - startPosRef.current.x,
                y: event.clientY - startPosRef.current.y
            }
        });

    }, [isDragging, position, setIsDragging, setDragOffset, handleDragMove]);

    /**
     * 获取边界限制的位置
     */
    const getBoundedPosition = React.useCallback((x, y) => {
        const margin = 10; // 边距
        const petWidth = 80; // 假设宠物宽度
        const petHeight = 80; // 假设宠物高度

        const maxX = window.innerWidth - petWidth - margin;
        const maxY = window.innerHeight - petHeight - margin;

        return {
            x: Math.max(margin, Math.min(x, maxX)),
            y: Math.max(margin, Math.min(y, maxY))
        };
    }, []);

    /**
     * 设置拖拽引用
     */
    const setDragRef = React.useCallback((element) => {
        dragRef.current = element;
        
        if (element) {
            // 添加鼠标事件监听
            element.addEventListener('mousedown', startDrag);
            element.style.cursor = 'move';
            element.style.userSelect = 'none';
        }
    }, [startDrag]);

    /**
     * 重置位置
     */
    const resetPosition = React.useCallback(() => {
        const defaultPosition = {
            x: window.innerWidth - 150,
            y: window.innerHeight - 150
        };
        
        setPosition(defaultPosition);
        
        window.petEventManager.emit('drag:reset', {
            position: defaultPosition
        });
    }, [setPosition]);

    /**
     * 清理
     */
    React.useEffect(() => {
        return () => {
            if (isDragging) {
                document.removeEventListener('mousemove', handleDragMove);
                document.removeEventListener('mouseup', handleDragEnd);
                document.removeEventListener('mouseleave', handleDragEnd);
            }
        };
    }, [isDragging, handleDragMove, handleDragEnd]);

    return {
        // 状态
        isDragging,
        dragOffset,
        position,
        
        // 方法
        setDragRef,
        resetPosition,
        startDrag,
        handleDragMove,
        handleDragEnd
    };
}

/**
 * 使用拖拽约束
 */
export function useDragConstraints(constraints = {}) {
    const [position, setPosition] = usePetState('position');
    const constrainedPosition = React.useMemo(() => {
        return applyConstraints(position, constraints);
    }, [position, constraints]);

    const setConstrainedPosition = React.useCallback((newPosition) => {
        const constrained = applyConstraints(newPosition, constraints);
        setPosition(constrained);
    }, [setPosition, constraints]);

    return [constrainedPosition, setConstrainedPosition];
}

/**
 * 应用拖拽约束
 */
function applyConstraints(position, constraints) {
    let { x, y } = position;

    // 边界约束
    if (constraints.boundary) {
        const { minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity } = constraints.boundary;
        x = Math.max(minX, Math.min(x, maxX));
        y = Math.max(minY, Math.min(y, maxY));
    }

    // 网格约束
    if (constraints.grid) {
        const { size = 1 } = constraints.grid;
        x = Math.round(x / size) * size;
        y = Math.round(y / size) * size;
    }

    // 吸附约束
    if (constraints.snap) {
        const { threshold = 20, targets = [] } = constraints.snap;
        const snapped = snapToTargets({ x, y }, targets, threshold);
        x = snapped.x;
        y = snapped.y;
    }

    return { x, y };
}

/**
 * 吸附到目标点
 */
function snapToTargets(position, targets, threshold) {
    let bestTarget = null;
    let bestDistance = threshold;

    for (const target of targets) {
        const distance = Math.sqrt(
            Math.pow(position.x - target.x, 2) + Math.pow(position.y - target.y, 2)
        );

        if (distance < bestDistance) {
            bestDistance = distance;
            bestTarget = target;
        }
    }

    return bestTarget || position;
}

/**
 * 使用拖拽历史
 */
export function useDragHistory(maxHistory = 50) {
    const [history, setHistory] = React.useState([]);
    const [position] = usePetState('position');

    React.useEffect(() => {
        setHistory(prev => {
            const newHistory = [...prev, {
                position: { ...position },
                timestamp: Date.now()
            }];

            if (newHistory.length > maxHistory) {
                return newHistory.slice(-maxHistory);
            }

            return newHistory;
        });
    }, [position, maxHistory]);

    /**
     * 撤销拖拽
     */
    const undoDrag = React.useCallback(() => {
        if (history.length > 1) {
            const previous = history[history.length - 2];
            petStateManager.setState('position', previous.position);
            
            // 移除最后两个记录（当前位置和要恢复的位置）
            setHistory(prev => prev.slice(0, -2));
            
            return true;
        }
        return false;
    }, [history]);

    /**
     * 清除历史
     */
    const clearHistory = React.useCallback(() => {
        setHistory([]);
    }, []);

    return {
        history,
        undoDrag,
        clearHistory,
        canUndo: history.length > 1
    };
}