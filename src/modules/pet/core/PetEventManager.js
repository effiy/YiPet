/**
 * Pet Manager Event System
 * 管理宠物相关的事件处理
 */

class PetEventManager {
    constructor() {
        this.events = new Map();
        this.eventHistory = [];
        this.maxHistoryLength = 100;
        this.eventStats = new Map();
        
        // 初始化默认事件
        this.initDefaultEvents();
    }

    initDefaultEvents() {
        // 宠物相关事件
        this.register('pet:created', '宠物创建');
        this.register('pet:destroyed', '宠物销毁');
        this.register('pet:shown', '宠物显示');
        this.register('pet:hidden', '宠物隐藏');
        this.register('pet:moved', '宠物移动');
        this.register('pet:colorChanged', '宠物颜色改变');
        this.register('pet:roleChanged', '宠物角色改变');
        
        // 聊天相关事件
        this.register('chat:opened', '聊天窗口打开');
        this.register('chat:closed', '聊天窗口关闭');
        this.register('chat:messageSent', '消息发送');
        this.register('chat:messageReceived', '消息接收');
        this.register('chat:typing', '输入状态变化');
        
        // 会话相关事件
        this.register('session:created', '会话创建');
        this.register('session:switched', '会话切换');
        this.register('session:deleted', '会话删除');
        this.register('session:updated', '会话更新');
        
        // 拖拽相关事件
        this.register('drag:start', '拖拽开始');
        this.register('drag:move', '拖拽移动');
        this.register('drag:end', '拖拽结束');
        
        // 系统事件
        this.register('system:initialized', '系统初始化');
        this.register('system:error', '系统错误');
        this.register('system:warning', '系统警告');
        
        // 页面事件
        this.register('page:loaded', '页面加载');
        this.register('page:urlChanged', '页面URL变化');
        this.register('page:visibilityChanged', '页面可见性变化');
    }

    // 注册事件
    register(eventName, description = '') {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, {
                listeners: new Set(),
                description,
                createdAt: Date.now(),
                emitCount: 0
            });
            
            this.eventStats.set(eventName, {
                totalEmitted: 0,
                lastEmitted: null,
                averageInterval: 0
            });
        }
    }

    // 监听事件
    on(eventName, listener, options = {}) {
        if (!this.events.has(eventName)) {
            this.register(eventName);
        }

        const event = this.events.get(eventName);
        const wrappedListener = {
            id: this.generateListenerId(),
            fn: listener,
            once: options.once || false,
            priority: options.priority || 0,
            createdAt: Date.now()
        };

        event.listeners.add(wrappedListener);
        
        // 返回取消监听函数
        return () => {
            event.listeners.delete(wrappedListener);
        };
    }

    // 一次性监听
    once(eventName, listener, options = {}) {
        return this.on(eventName, listener, { ...options, once: true });
    }

    // 触发事件
    emit(eventName, data = null, metadata = {}) {
        if (!this.events.has(eventName)) {
            console.warn(`[PetEventManager] 事件未注册: ${eventName}`);
            return false;
        }

        const event = this.events.get(eventName);
        const eventData = {
            name: eventName,
            data,
            timestamp: Date.now(),
            metadata: {
                ...metadata,
                emitCount: event.emitCount + 1
            }
        };

        // 更新统计信息
        this.updateEventStats(eventName);
        
        // 记录事件历史
        this.recordEvent(eventData);
        
        // 执行监听器
        const listeners = Array.from(event.listeners);
        
        // 按优先级排序
        listeners.sort((a, b) => b.priority - a.priority);
        
        listeners.forEach(listener => {
            try {
                listener.fn(eventData.data, eventData);
                
                // 如果是单次监听，执行后移除
                if (listener.once) {
                    event.listeners.delete(listener);
                }
            } catch (error) {
                console.error(`[PetEventManager] 事件监听器错误 (${eventName}):`, error);
                
                // 触发错误事件
                this.emit('system:error', {
                    type: 'listener_error',
                    eventName,
                    error: error.message,
                    listener: listener.id
                });
            }
        });

        event.emitCount++;
        return true;
    }

    // 移除事件监听器
    off(eventName, listener) {
        if (this.events.has(eventName)) {
            const event = this.events.get(eventName);
            
            if (listener) {
                // 移除特定监听器
                for (const wrappedListener of event.listeners) {
                    if (wrappedListener.fn === listener) {
                        event.listeners.delete(wrappedListener);
                        break;
                    }
                }
            } else {
                // 移除所有监听器
                event.listeners.clear();
            }
        }
    }

    // 移除所有事件监听器
    removeAllListeners(eventName) {
        if (eventName) {
            if (this.events.has(eventName)) {
                this.events.get(eventName).listeners.clear();
            }
        } else {
            // 移除所有事件的所有监听器
            this.events.forEach(event => {
                event.listeners.clear();
            });
        }
    }

    // 获取事件信息
    getEventInfo(eventName) {
        if (this.events.has(eventName)) {
            const event = this.events.get(eventName);
            return {
                name: eventName,
                description: event.description,
                listenerCount: event.listeners.size,
                emitCount: event.emitCount,
                createdAt: event.createdAt
            };
        }
        return null;
    }

    // 获取所有事件信息
    getAllEvents() {
        const events = [];
        this.events.forEach((event, name) => {
            events.push({
                name,
                description: event.description,
                listenerCount: event.listeners.size,
                emitCount: event.emitCount,
                createdAt: event.createdAt
            });
        });
        return events;
    }

    // 记录事件历史
    recordEvent(eventData) {
        this.eventHistory.push(eventData);
        
        if (this.eventHistory.length > this.maxHistoryLength) {
            this.eventHistory.shift();
        }
    }

    // 更新事件统计
    updateEventStats(eventName) {
        const stats = this.eventStats.get(eventName);
        const now = Date.now();
        
        if (stats.lastEmitted) {
            const interval = now - stats.lastEmitted;
            stats.averageInterval = (stats.averageInterval * stats.totalEmitted + interval) / (stats.totalEmitted + 1);
        }
        
        stats.totalEmitted++;
        stats.lastEmitted = now;
    }

    // 获取事件统计
    getEventStats(eventName) {
        if (eventName) {
            return this.eventStats.get(eventName) || null;
        }
        
        const stats = {};
        this.eventStats.forEach((stat, name) => {
            stats[name] = stat;
        });
        return stats;
    }

    // 获取事件历史
    getEventHistory(options = {}) {
        let history = [...this.eventHistory];
        
        if (options.eventName) {
            history = history.filter(event => event.name === options.eventName);
        }
        
        if (options.startTime) {
            history = history.filter(event => event.timestamp >= options.startTime);
        }
        
        if (options.endTime) {
            history = history.filter(event => event.timestamp <= options.endTime);
        }
        
        if (options.limit) {
            history = history.slice(-options.limit);
        }
        
        return history;
    }

    // 清除事件历史
    clearEventHistory() {
        this.eventHistory = [];
        this.eventStats.forEach(stat => {
            stat.totalEmitted = 0;
            stat.lastEmitted = null;
            stat.averageInterval = 0;
        });
    }

    // 生成监听器ID
    generateListenerId() {
        return 'listener_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 事件调试信息
    getDebugInfo() {
        return {
            totalEvents: this.events.size,
            totalListeners: Array.from(this.events.values()).reduce((sum, event) => sum + event.listeners.size, 0),
            eventHistory: this.eventHistory.length,
            maxHistoryLength: this.maxHistoryLength,
            events: this.getAllEvents(),
            stats: this.getEventStats()
        };
    }
}

// 创建全局事件管理器
window.PetEventManager = PetEventManager;

// 防止重复初始化
if (typeof window.petEventManager === 'undefined') {
    window.petEventManager = new PetEventManager();
}