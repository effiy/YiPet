/**
 * Pet Manager State Module
 * 管理宠物相关的状态
 */

class PetStateManager {
    constructor() {
        this.state = {
            // 宠物状态
            pet: null,
            isVisible: false,
            colorIndex: 0,
            position: { x: 0, y: 0 },
            role: '教师',
            
            // UI状态
            isChatOpen: false,
            isDragging: false,
            dragOffset: { x: 0, y: 0 },
            
            // 会话状态
            currentSessionId: null,
            sessions: {},
            isSwitchingSession: false,
            
            // 页面状态
            currentPageUrl: null,
            hasAutoCreatedSessionForPage: false,
            sessionInitPending: false,
            
            // 布局状态
            sidebarWidth: 320,
            isResizingSidebar: false,
            sidebarCollapsed: false,
            inputContainerCollapsed: false,
            
            // 功能状态
            mermaidLoaded: false,
            mermaidLoading: false,
            jszipLoaded: false,
            jszipLoading: false
        };

        this.listeners = new Set();
        this.stateHistory = [];
        this.maxHistoryLength = 50;
    }

    // 获取状态
    getState(key) {
        if (key) {
            return this.state[key];
        }
        return { ...this.state };
    }

    // 设置状态
    setState(key, value) {
        const prevState = { ...this.state };
        
        if (typeof key === 'object') {
            // 批量更新
            Object.assign(this.state, key);
        } else {
            // 单个更新
            this.state[key] = value;
        }

        // 保存历史
        this.stateHistory.push({
            timestamp: Date.now(),
            prevState,
            nextState: { ...this.state }
        });

        // 限制历史长度
        if (this.stateHistory.length > this.maxHistoryLength) {
            this.stateHistory.shift();
        }

        // 通知监听器
        this.notifyListeners(key, value);
    }

    // 订阅状态变化
    subscribe(listener) {
        this.listeners.add(listener);
        
        // 返回取消订阅函数
        return () => {
            this.listeners.delete(listener);
        };
    }

    // 通知所有监听器
    notifyListeners(key, value) {
        this.listeners.forEach(listener => {
            try {
                listener(key, value, this.state);
            } catch (error) {
                console.error('[PetStateManager] 监听器错误:', error);
            }
        });
    }

    // 批量更新状态
    batchUpdate(updates) {
        const prevState = { ...this.state };
        Object.assign(this.state, updates);
        
        this.stateHistory.push({
            timestamp: Date.now(),
            prevState,
            nextState: { ...this.state }
        });

        // 批量通知
        Object.keys(updates).forEach(key => {
            this.notifyListeners(key, updates[key]);
        });
    }

    // 重置状态
    resetState(keys) {
        const defaultState = {
            pet: null,
            isVisible: false,
            colorIndex: 0,
            position: { x: 0, y: 0 },
            role: '教师',
            isChatOpen: false,
            isDragging: false,
            dragOffset: { x: 0, y: 0 },
            currentSessionId: null,
            sessions: {},
            isSwitchingSession: false,
            currentPageUrl: null,
            hasAutoCreatedSessionForPage: false,
            sessionInitPending: false,
            sidebarWidth: 320,
            isResizingSidebar: false,
            sidebarCollapsed: false,
            inputContainerCollapsed: false,
            mermaidLoaded: false,
            mermaidLoading: false,
            jszipLoaded: false,
            jszipLoading: false
        };

        if (keys && Array.isArray(keys)) {
            // 重置指定状态
            keys.forEach(key => {
                if (defaultState.hasOwnProperty(key)) {
                    this.state[key] = defaultState[key];
                }
            });
        } else {
            // 重置所有状态
            this.state = { ...defaultState };
        }

        this.notifyListeners('reset', this.state);
    }

    // 获取状态历史
    getStateHistory() {
        return [...this.stateHistory];
    }

    // 撤销状态变化
    undo() {
        if (this.stateHistory.length > 0) {
            const lastChange = this.stateHistory.pop();
            this.state = { ...lastChange.prevState };
            this.notifyListeners('undo', this.state);
            return true;
        }
        return false;
    }

    // 获取状态快照
    getSnapshot() {
        return {
            timestamp: Date.now(),
            state: { ...this.state }
        };
    }

    // 从快照恢复
    restoreSnapshot(snapshot) {
        if (snapshot && snapshot.state) {
            this.state = { ...snapshot.state };
            this.notifyListeners('restore', this.state);
            return true;
        }
        return false;
    }

    // 状态验证
    validateState() {
        const errors = [];
        
        // 验证必要的状态字段
        const requiredFields = ['isVisible', 'colorIndex', 'position', 'role'];
        requiredFields.forEach(field => {
            if (this.state[field] === undefined || this.state[field] === null) {
                errors.push(`缺少必要状态字段: ${field}`);
            }
        });

        // 验证状态值的有效性
        if (this.state.colorIndex < 0 || this.state.colorIndex >= PET_CONFIG.pet.colors.length) {
            errors.push('颜色索引超出范围');
        }

        if (this.state.position && (this.state.position.x < 0 || this.state.position.y < 0)) {
            errors.push('位置坐标不能为负数');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// 创建全局实例
window.PetStateManager = PetStateManager;

// 防止重复初始化
if (typeof window.petStateManager === 'undefined') {
    window.petStateManager = new PetStateManager();
}