/**
 * Popup Hooks
 * 弹窗Hooks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { popupManagerCore } from '../core/PopupManagerCore.js';
import { PopupService } from '../services/PopupService.js';

/**
 * 弹窗状态Hook
 */
export function usePopupState() {
    const [state, setState] = useState(() => popupManagerCore.getState());
    
    useEffect(() => {
        const handleStateChange = () => {
            setState(popupManagerCore.getState());
        };
        
        popupManagerCore.on('popup:opened', handleStateChange);
        popupManagerCore.on('popup:closed', handleStateChange);
        popupManagerCore.on('popup:view:switched', handleStateChange);
        popupManagerCore.on('popup:config:saved', handleStateChange);
        
        return () => {
            popupManagerCore.off('popup:opened', handleStateChange);
            popupManagerCore.off('popup:closed', handleStateChange);
            popupManagerCore.off('popup:view:switched', handleStateChange);
            popupManagerCore.off('popup:config:saved', handleStateChange);
        };
    }, []);
    
    const open = useCallback(async (options) => {
        await popupManagerCore.open(options);
    }, []);
    
    const close = useCallback(async () => {
        await popupManagerCore.close();
    }, []);
    
    const switchView = useCallback(async (view, options) => {
        await popupManagerCore.switchView(view, options);
    }, []);
    
    const goBack = useCallback(async () => {
        await popupManagerCore.goBack();
    }, []);
    
    const updateConfig = useCallback(async (config) => {
        await popupManagerCore.saveConfig(config);
    }, []);
    
    return {
        ...state,
        open,
        close,
        switchView,
        goBack,
        updateConfig
    };
}

/**
 * 弹窗服务Hook
 */
export function usePopupService() {
    const [service] = useState(() => new PopupService());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        service.init().catch(err => {
            console.error('弹窗服务初始化失败:', err);
            setError(err);
        });
        
        return () => {
            // 清理逻辑
        };
    }, [service]);
    
    const executeAction = useCallback(async (action, ...args) => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await service[action](...args);
            return result;
        } catch (err) {
            setError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [service]);
    
    return {
        service,
        loading,
        error,
        executeAction,
        
        // 快捷方法
        getUserSettings: () => executeAction('getUserSettings'),
        updateUserSettings: (settings) => executeAction('updateUserSettings', settings),
        getQuickActions: () => executeAction('getQuickActions'),
        executeQuickAction: (actionId, params) => executeAction('executeQuickAction', actionId, params),
        getRecentActivity: () => executeAction('getRecentActivity'),
        getStatistics: () => executeAction('getStatistics'),
        getNotifications: () => executeAction('getNotifications'),
        markNotificationAsRead: (id) => executeAction('markNotificationAsRead', id),
        getFeatureFlags: () => executeAction('getFeatureFlags'),
        updateFeatureFlag: (key, enabled) => executeAction('updateFeatureFlag', key, enabled)
    };
}

/**
 * 快捷操作Hook
 */
export function useQuickActions() {
    const { getQuickActions, executeQuickAction } = usePopupService();
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        loadActions();
    }, []);
    
    const loadActions = async () => {
        setLoading(true);
        try {
            const data = await getQuickActions();
            setActions(data);
        } catch (error) {
            console.error('加载快捷操作失败:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const executeAction = async (actionId, params) => {
        try {
            const result = await executeQuickAction(actionId, params);
            
            // 处理特定操作
            switch (actionId) {
                case 'toggle-pet':
                    // 切换宠物显示
                    break;
                case 'screenshot':
                    // 触发截图
                    break;
                case 'chat':
                    // 打开聊天
                    break;
                case 'settings':
                    // 打开设置
                    break;
            }
            
            return result;
        } catch (error) {
            console.error('执行快捷操作失败:', error);
            throw error;
        }
    };
    
    return {
        actions,
        loading,
        executeAction,
        refresh: loadActions
    };
}

/**
 * 通知Hook
 */
export function usePopupNotifications() {
    const { getNotifications, markNotificationAsRead } = usePopupService();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    
    useEffect(() => {
        loadNotifications();
    }, []);
    
    const loadNotifications = async () => {
        try {
            const data = await getNotifications();
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.read).length);
        } catch (error) {
            console.error('加载通知失败:', error);
        }
    };
    
    const markAsRead = async (notificationId) => {
        try {
            await markNotificationAsRead(notificationId);
            
            setNotifications(prev => 
                prev.map(n => 
                    n.id === notificationId ? { ...n, read: true } : n
                )
            );
            
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('标记通知为已读失败:', error);
        }
    };
    
    const markAllAsRead = async () => {
        try {
            const unreadNotifications = notifications.filter(n => !n.read);
            
            await Promise.all(
                unreadNotifications.map(n => markNotificationAsRead(n.id))
            );
            
            setNotifications(prev => 
                prev.map(n => ({ ...n, read: true }))
            );
            
            setUnreadCount(0);
        } catch (error) {
            console.error('标记所有通知为已读失败:', error);
        }
    };
    
    return {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        refresh: loadNotifications
    };
}

/**
 * 统计信息Hook
 */
export function usePopupStatistics() {
    const { getStatistics } = usePopupService();
    const [statistics, setStatistics] = useState({});
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        loadStatistics();
    }, []);
    
    const loadStatistics = async () => {
        setLoading(true);
        try {
            const data = await getStatistics();
            setStatistics(data);
        } catch (error) {
            console.error('加载统计信息失败:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const formatUsageTime = (seconds) => {
        if (seconds < 60) {
            return `${seconds}秒`;
        } else if (seconds < 3600) {
            return `${Math.floor(seconds / 60)}分钟`;
        } else {
            return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`;
        }
    };
    
    return {
        statistics,
        loading,
        formatUsageTime,
        refresh: loadStatistics
    };
}