/**
 * Pet Drag Component
 * 宠物拖拽组件
 */

import React from 'react';
import { usePetState } from '../hooks/index.js';
import { DRAG_CONFIG } from '../constants/index.js';

/**
 * 拖拽控制器
 */
export class DragController {
    constructor(options = {}) {
        this.options = { ...DRAG_CONFIG.drag, ...options };
        this.isDragging = false;
        this.startPosition = { x: 0, y: 0 };
        this.currentPosition = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.constraints = options.constraints || DRAG_CONFIG.constraints;
        
        this.listeners = {
            start: [],
            move: [],
            end: [],
            reset: []
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 鼠标事件
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // 触摸事件
        document.addEventListener('touchstart', this.handleTouchStart.bind(this));
        document.addEventListener('touchmove', this.handleTouchMove.bind(this));
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // 防止拖拽时选中文本
        document.addEventListener('selectstart', this.handleSelectStart.bind(this));
    }

    handleMouseDown(event) {
        if (!this.options.enabled) return;
        
        const target = event.target.closest('.pet-draggable');
        if (!target) return;
        
        event.preventDefault();
        this.startDrag(event.clientX, event.clientY, target);
    }

    handleTouchStart(event) {
        if (!this.options.enabled) return;
        
        const target = event.target.closest('.pet-draggable');
        if (!target) return;
        
        event.preventDefault();
        const touch = event.touches[0];
        this.startDrag(touch.clientX, touch.clientY, target);
    }

    handleMouseMove(event) {
        if (!this.isDragging) return;
        this.updateDrag(event.clientX, event.clientY);
    }

    handleTouchMove(event) {
        if (!this.isDragging) return;
        event.preventDefault();
        const touch = event.touches[0];
        this.updateDrag(touch.clientX, touch.clientY);
    }

    handleMouseUp(event) {
        if (!this.isDragging) return;
        this.endDrag();
    }

    handleTouchEnd(event) {
        if (!this.isDragging) return;
        this.endDrag();
    }

    handleSelectStart(event) {
        if (this.isDragging) {
            event.preventDefault();
        }
    }

    startDrag(clientX, clientY, target) {
        this.isDragging = true;
        this.target = target;
        
        // 获取当前位置
        const rect = target.getBoundingClientRect();
        this.currentPosition = { x: rect.left, y: rect.top };
        
        // 计算拖拽偏移
        this.dragOffset = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
        
        // 设置开始位置
        this.startPosition = { x: clientX, y: clientY };
        
        // 添加拖拽样式
        target.classList.add('dragging');
        document.body.style.cursor = 'grabbing';
        
        // 触发开始事件
        this.emit('start', {
            position: this.currentPosition,
            offset: this.dragOffset,
            target: this.target
        });
    }

    updateDrag(clientX, clientY) {
        if (!this.isDragging) return;
        
        // 计算新位置
        let newX = clientX - this.dragOffset.x;
        let newY = clientY - this.dragOffset.y;
        
        // 应用约束
        if (this.options.boundary.constrainToViewport) {
            newX = Math.max(this.constraints.minX, Math.min(this.constraints.maxX, newX));
            newY = Math.max(this.constraints.minY, Math.min(this.constraints.maxY, newY));
        }
        
        // 应用边界
        newX = Math.max(this.constraints.minX, newX);
        newY = Math.max(this.constraints.minY, newY);
        newX = Math.min(this.constraints.maxX, newX);
        newY = Math.min(this.constraints.maxY, newY);
        
        // 应用网格对齐
        if (this.options.grid.enabled) {
            const gridSize = this.options.grid.size;
            newX = Math.round(newX / gridSize) * gridSize;
            newY = Math.round(newY / gridSize) * gridSize;
        }
        
        // 更新位置
        this.currentPosition = { x: newX, y: newY };
        
        // 更新DOM位置
        if (this.target) {
            this.target.style.left = `${newX}px`;
            this.target.style.top = `${newY}px`;
        }
        
        // 触发移动事件
        this.emit('move', {
            position: this.currentPosition,
            delta: {
                x: clientX - this.startPosition.x,
                y: clientY - this.startPosition.y
            },
            target: this.target
        });
    }

    endDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // 移除拖拽样式
        if (this.target) {
            this.target.classList.remove('dragging');
        }
        document.body.style.cursor = '';
        
        // 触发结束事件
        this.emit('end', {
            position: this.currentPosition,
            target: this.target
        });
        
        // 清理
        this.target = null;
    }

    reset() {
        this.isDragging = false;
        this.currentPosition = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        
        // 触发重置事件
        this.emit('reset', {
            position: this.currentPosition
        });
    }

    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    destroy() {
        // 移除事件监听器
        document.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        document.removeEventListener('touchstart', this.handleTouchStart.bind(this));
        document.removeEventListener('touchmove', this.handleTouchMove.bind(this));
        document.removeEventListener('touchend', this.handleTouchEnd.bind(this));
        document.removeEventListener('selectstart', this.handleSelectStart.bind(this));
        
        // 清理
        this.listeners = {};
        this.target = null;
    }
}

/**
 * 拖拽Hook
 */
export function usePetDrag(options = {}) {
    const [isDragging, setIsDragging] = React.useState(false);
    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const dragControllerRef = React.useRef(null);

    React.useEffect(() => {
        // 创建拖拽控制器
        const controller = new DragController(options);
        dragControllerRef.current = controller;

        // 监听拖拽事件
        controller.on('start', (data) => {
            setIsDragging(true);
            setPosition(data.position);
        });

        controller.on('move', (data) => {
            setPosition(data.position);
        });

        controller.on('end', (data) => {
            setIsDragging(false);
            setPosition(data.position);
        });

        controller.on('reset', (data) => {
            setPosition(data.position);
        });

        return () => {
            controller.destroy();
        };
    }, [options]);

    const reset = React.useCallback(() => {
        if (dragControllerRef.current) {
            dragControllerRef.current.reset();
        }
    }, []);

    return {
        isDragging,
        position,
        reset,
        controller: dragControllerRef.current
    };
}

/**
 * 可拖拽组件
 */
export function PetDraggable({ children, className = '', style = {}, onDragStart, onDragMove, onDragEnd }) {
    const [isDragging, setIsDragging] = React.useState(false);
    const elementRef = React.useRef(null);

    React.useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        // 添加可拖拽类
        element.classList.add('pet-draggable');

        const handleDragStart = (event) => {
            setIsDragging(true);
            if (onDragStart) onDragStart(event);
        };

        const handleDragMove = (event) => {
            if (onDragMove) onDragMove(event);
        };

        const handleDragEnd = (event) => {
            setIsDragging(false);
            if (onDragEnd) onDragEnd(event);
        };

        element.addEventListener('dragstart', handleDragStart);
        element.addEventListener('drag', handleDragMove);
        element.addEventListener('dragend', handleDragEnd);

        return () => {
            element.removeEventListener('dragstart', handleDragStart);
            element.removeEventListener('drag', handleDragMove);
            element.removeEventListener('dragend', handleDragEnd);
            element.classList.remove('pet-draggable');
        };
    }, [onDragStart, onDragMove, onDragEnd]);

    const combinedClassName = `pet-draggable ${className} ${isDragging ? 'dragging' : ''}`.trim();
    const combinedStyle = {
        position: 'absolute',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        ...style
    };

    return (
        <div 
            ref={elementRef}
            className={combinedClassName}
            style={combinedStyle}
        >
            {children}
        </div>
    );
}

/**
 * 拖拽边界组件
 */
export function DragBoundary({ children, constraints = DRAG_CONFIG.constraints }) {
    const boundaryRef = React.useRef(null);

    React.useEffect(() => {
        const boundary = boundaryRef.current;
        if (!boundary) return;

        // 设置边界样式
        boundary.style.position = 'relative';
        boundary.style.overflow = 'hidden';
        
        // 监听拖拽事件以更新约束
        const handleDragStart = (event) => {
            // 可以在这里动态更新约束
        };

        document.addEventListener('dragstart', handleDragStart);

        return () => {
            document.removeEventListener('dragstart', handleDragStart);
        };
    }, [constraints]);

    return (
        <div ref={boundaryRef} className="drag-boundary">
            {children}
        </div>
    );
}