/**
 * Pet State Hook
 * 用于管理宠物状态的自定义Hook
 */

import { petStateManager } from '../core/index.js';

/**
 * 使用宠物状态
 * @param {string} key - 要监听的状态键
 * @param {Function} selector - 状态选择器函数
 * @returns {Array} [状态值, 设置状态函数]
 */
export function usePetState(key, selector = null) {
    const [state, setState] = React.useState(() => {
        if (selector) {
            return selector(petStateManager.getState());
        }
        if (key) {
            return petStateManager.getState(key);
        }
        return petStateManager.getState();
    });

    React.useEffect(() => {
        const unsubscribe = petStateManager.subscribe((changedKey, value, fullState) => {
            if (!key || changedKey === key) {
                if (selector) {
                    setState(selector(fullState));
                } else {
                    setState(key ? fullState[key] : fullState);
                }
            }
        });

        return unsubscribe;
    }, [key, selector]);

    const setPetState = React.useCallback((newValue) => {
        if (key) {
            petStateManager.setState(key, newValue);
        } else if (typeof newValue === 'object') {
            petStateManager.batchUpdate(newValue);
        }
    }, [key]);

    return [state, setPetState];
}

/**
 * 使用宠物可见性状态
 */
export function usePetVisibility() {
    return usePetState('isVisible');
}

/**
 * 使用宠物位置状态
 */
export function usePetPosition() {
    return usePetState('position');
}

/**
 * 使用宠物颜色索引状态
 */
export function usePetColor() {
    return usePetState('colorIndex');
}

/**
 * 使用宠物角色状态
 */
export function usePetRole() {
    return usePetState('role');
}

/**
 * 使用聊天窗口状态
 */
export function useChatState() {
    return usePetState('isChatOpen');
}

/**
 * 使用拖拽状态
 */
export function useDragState() {
    const [isDragging] = usePetState('isDragging');
    const [dragOffset] = usePetState('dragOffset');
    
    return { isDragging, dragOffset };
}

/**
 * 使用会话状态
 */
export function useSessionState() {
    const [currentSessionId] = usePetState('currentSessionId');
    const [sessions] = usePetState('sessions');
    const [isSwitching] = usePetState('isSwitchingSession');
    
    return {
        currentSessionId,
        sessions,
        isSwitching,
        currentSession: sessions[currentSessionId]
    };
}

/**
 * 使用UI状态
 */
export function useUIState() {
    const [sidebarWidth] = usePetState('sidebarWidth');
    const [sidebarCollapsed] = usePetState('sidebarCollapsed');
    const [inputContainerCollapsed] = usePetState('inputContainerCollapsed');
    
    return {
        sidebarWidth,
        sidebarCollapsed,
        inputContainerCollapsed
    };
}

/**
 * 使用功能状态
 */
export function useFeatureState() {
    const [mermaidLoaded] = usePetState('mermaidLoaded');
    const [mermaidLoading] = usePetState('mermaidLoading');
    const [jszipLoaded] = usePetState('jszipLoaded');
    const [jszipLoading] = usePetState('jszipLoading');
    
    return {
        mermaid: {
            loaded: mermaidLoaded,
            loading: mermaidLoading
        },
        jszip: {
            loaded: jszipLoaded,
            loading: jszipLoading
        }
    };
}

/**
 * 使用宠物完整状态
 */
export function usePetFullState() {
    const [pet] = usePetState('pet');
    const [isVisible] = usePetVisibility();
    const [position] = usePetPosition();
    const [colorIndex] = usePetColor();
    const [role] = usePetRole();
    
    return {
        pet,
        isVisible,
        position,
        colorIndex,
        role,
        color: PET_CONFIG.pet.colors[colorIndex]
    };
}

/**
 * 使用状态选择器
 */
export function usePetStateSelector(selector) {
    return usePetState(null, selector);
}

/**
 * 使用状态历史
 */
export function usePetStateHistory() {
    const [history, setHistory] = React.useState(() => 
        petStateManager.getStateHistory()
    );

    React.useEffect(() => {
        const unsubscribe = petStateManager.subscribe(() => {
            setHistory(petStateManager.getStateHistory());
        });

        return unsubscribe;
    }, []);

    const undo = React.useCallback(() => {
        return petStateManager.undo();
    }, []);

    const getSnapshot = React.useCallback(() => {
        return petStateManager.getSnapshot();
    }, []);

    const restoreSnapshot = React.useCallback((snapshot) => {
        return petStateManager.restoreSnapshot(snapshot);
    }, []);

    return {
        history,
        undo,
        getSnapshot,
        restoreSnapshot
    };
}

/**
 * 使用状态验证
 */
export function usePetStateValidation() {
    const [validation, setValidation] = React.useState(() => 
        petStateManager.validateState()
    );

    React.useEffect(() => {
        const unsubscribe = petStateManager.subscribe(() => {
            setValidation(petStateManager.validateState());
        });

        return unsubscribe;
    }, []);

    return validation;
}

/**
 * 使用批量状态更新
 */
export function usePetBatchUpdate() {
    return React.useCallback((updates) => {
        petStateManager.batchUpdate(updates);
    }, []);
}

/**
 * 使用状态重置
 */
export function usePetReset() {
    return React.useCallback((keys) => {
        petStateManager.resetState(keys);
    }, []);
}