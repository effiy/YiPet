/**
 * Pet Event Hook
 * 宠物事件Hook
 */

import React from 'react';
import { petEventManager } from '../core/PetEventManager.js';
import { EventTypes } from '../types/index.js';

/**
 * 宠物事件Hook
 */
export function usePetEvent(eventType, callback, options = {}) {
    const { once = false, capture = false, passive = false } = options;
    
    const callbackRef = React.useRef(callback);
    
    // 更新回调引用
    React.useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);
    
    React.useEffect(() => {
        if (!eventType || !callbackRef.current) return;
        
        const eventCallback = (event) => {
            if (callbackRef.current) {
                callbackRef.current(event);
            }
        };
        
        // 添加事件监听器
        petEventManager.addEventListener(eventType, eventCallback, { once, capture, passive });
        
        // 清理函数
        return () => {
            petEventManager.removeEventListener(eventType, eventCallback);
        };
    }, [eventType, once, capture, passive]);
}

/**
 * 宠物状态变化Hook
 */
export function usePetStateChange(stateKey, callback) {
    const eventType = `pet:state:changed:${stateKey}`;
    
    usePetEvent(eventType, (event) => {
        if (callback) {
            callback(event.detail.newValue, event.detail.oldValue, event.detail.stateKey);
        }
    });
}

/**
 * 宠物拖拽事件Hook
 */
export function usePetDragEvents(handlers = {}) {
    const {
        onDragStart = null,
        onDragMove = null,
        onDragEnd = null,
        onDragReset = null
    } = handlers;
    
    usePetEvent(EventTypes.DRAG_START, onDragStart);
    usePetEvent(EventTypes.DRAG_MOVE, onDragMove);
    usePetEvent(EventTypes.DRAG_END, onDragEnd);
    usePetEvent(EventTypes.DRAG_RESET, onDragReset);
}

/**
 * 宠物聊天事件Hook
 */
export function usePetChatEvents(handlers = {}) {
    const {
        onMessageSent = null,
        onMessageReceived = null,
        onMessageUpdated = null,
        onMessageDeleted = null,
        onSessionCreated = null,
        onSessionSwitched = null,
        onSessionDeleted = null,
        onWindowOpened = null,
        onWindowClosed = null
    } = handlers;
    
    usePetEvent(EventTypes.CHAT_MESSAGE_SENT, onMessageSent);
    usePetEvent(EventTypes.CHAT_MESSAGE_RECEIVED, onMessageReceived);
    usePetEvent(EventTypes.CHAT_MESSAGE_UPDATED, onMessageUpdated);
    usePetEvent(EventTypes.CHAT_MESSAGE_DELETED, onMessageDeleted);
    usePetEvent(EventTypes.CHAT_SESSION_CREATED, onSessionCreated);
    usePetEvent(EventTypes.CHAT_SESSION_SWITCHED, onSessionSwitched);
    usePetEvent(EventTypes.CHAT_SESSION_DELETED, onSessionDeleted);
    usePetEvent(EventTypes.CHAT_WINDOW_OPENED, onWindowOpened);
    usePetEvent(EventTypes.CHAT_WINDOW_CLOSED, onWindowClosed);
}

/**
 * 宠物AI事件Hook
 */
export function usePetAIEvents(handlers = {}) {
    const {
        onRequestStarted = null,
        onRequestCompleted = null,
        onRequestFailed = null,
        onResponseReceived = null
    } = handlers;
    
    usePetEvent(EventTypes.AI_REQUEST_STARTED, onRequestStarted);
    usePetEvent(EventTypes.AI_REQUEST_COMPLETED, onRequestCompleted);
    usePetEvent(EventTypes.AI_REQUEST_FAILED, onRequestFailed);
    usePetEvent(EventTypes.AI_RESPONSE_RECEIVED, onResponseReceived);
}

/**
 * 宠物生命周期事件Hook
 */
export function usePetLifecycleEvents(handlers = {}) {
    const {
        onCreated = null,
        onDestroyed = null,
        onVisibilityChanged = null,
        onPositionChanged = null,
        onColorChanged = null,
        onRoleChanged = null
    } = handlers;
    
    usePetEvent(EventTypes.PET_CREATED, onCreated);
    usePetEvent(EventTypes.PET_DESTROYED, onDestroyed);
    usePetEvent(EventTypes.PET_VISIBILITY_CHANGED, onVisibilityChanged);
    usePetEvent(EventTypes.PET_POSITION_CHANGED, onPositionChanged);
    usePetEvent(EventTypes.PET_COLOR_CHANGED, onColorChanged);
    usePetEvent(EventTypes.PET_ROLE_CHANGED, onRoleChanged);
}

/**
 * 错误事件Hook
 */
export function usePetErrorEvents(handlers = {}) {
    const {
        onErrorOccurred = null,
        onErrorHandled = null
    } = handlers;
    
    usePetEvent(EventTypes.ERROR_OCCURRED, onErrorOccurred);
    usePetEvent(EventTypes.ERROR_HANDLED, onErrorHandled);
}

/**
 * 自定义事件Hook
 */
export function usePetCustomEvent(eventName, callback, options = {}) {
    const customEventType = `${EventTypes.namespace}:${eventName}`;
    usePetEvent(customEventType, callback, options);
}

/**
 * 一次性事件Hook
 */
export function usePetEventOnce(eventType, callback, options = {}) {
    return usePetEvent(eventType, callback, { ...options, once: true });
}

/**
 * 事件总线Hook
 */
export function usePetEventBus() {
    const emit = React.useCallback((eventType, data = null) => {
        petEventManager.emit(eventType, data);
    }, []);
    
    const on = React.useCallback((eventType, callback, options = {}) => {
        return petEventManager.addEventListener(eventType, callback, options);
    }, []);
    
    const off = React.useCallback((eventType, callback) => {
        return petEventManager.removeEventListener(eventType, callback);
    }, []);
    
    const once = React.useCallback((eventType, callback, options = {}) => {
        return petEventManager.addEventListener(eventType, callback, { ...options, once: true });
    }, []);
    
    return {
        emit,
        on,
        off,
        once
    };
}