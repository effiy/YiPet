/**
 * Popup UI Components
 * 弹窗UI组件
 */

import React from 'react';
import { usePopupState, useQuickActions, usePopupNotifications, usePopupStatistics } from '../hooks/usePopup.js';

/**
 * 弹窗主容器组件
 */
export function PopupContainer({ children }) {
    const { isOpen, close } = usePopupState();
    
    if (!isOpen) {
        return null;
    }
    
    return (
        <div className="popup-container">
            <div className="popup-overlay" onClick={close} />
            <div className="popup-content">
                {children}
            </div>
        </div>
    );
}

/**
 * 弹窗头部组件
 */
export function PopupHeader({ title = 'YiPet', showClose = true }) {
    const { close } = usePopupState();
    
    return (
        <div className="popup-header">
            <div className="popup-title">
                <span className="popup-icon">🐱</span>
                <h3>{title}</h3>
            </div>
            {showClose && (
                <button 
                    className="popup-close" 
                    onClick={close}
                    aria-label="关闭"
                >
                    ✕
                </button>
            )}
        </div>
    );
}

/**
 * 快捷操作列表组件
 */
export function QuickActionsList() {
    const { actions, loading, executeAction } = useQuickActions();
    
    if (loading) {
        return <div className="quick-actions-loading">加载中...</div>;
    }
    
    return (
        <div className="quick-actions-list">
            <h4>快捷操作</h4>
            <div className="actions-grid">
                {actions.map(action => (
                    <QuickActionItem 
                        key={action.id}
                        action={action}
                        onExecute={executeAction}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * 快捷操作项组件
 */
export function QuickActionItem({ action, onExecute }) {
    const handleClick = async () => {
        try {
            await onExecute(action.id);
        } catch (error) {
            console.error('执行快捷操作失败:', error);
        }
    };
    
    return (
        <div 
            className="quick-action-item"
            onClick={handleClick}
            title={action.description}
        >
            <div className="action-icon">{action.icon}</div>
            <div className="action-name">{action.name}</div>
        </div>
    );
}

/**
 * 通知列表组件
 */
export function NotificationsList({ maxItems = 5 }) {
    const { notifications, unreadCount, markAsRead } = usePopupNotifications();
    
    const displayNotifications = notifications.slice(0, maxItems);
    
    return (
        <div className="notifications-list">
            <div className="notifications-header">
                <h4>通知</h4>
                {unreadCount > 0 && (
                    <span className="unread-count">{unreadCount}</span>
                )}
            </div>
            <div className="notifications-content">
                {displayNotifications.length === 0 ? (
                    <div className="no-notifications">暂无通知</div>
                ) : (
                    displayNotifications.map(notification => (
                        <NotificationItem 
                            key={notification.id}
                            notification={notification}
                            onMarkAsRead={markAsRead}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

/**
 * 通知项组件
 */
export function NotificationItem({ notification, onMarkAsRead }) {
    const handleClick = () => {
        if (!notification.read) {
            onMarkAsRead(notification.id);
        }
    };
    
    return (
        <div 
            className={`notification-item ${notification.read ? 'read' : 'unread'}`}
            onClick={handleClick}
        >
            <div className="notification-icon">{notification.icon}</div>
            <div className="notification-content">
                <div className="notification-title">{notification.title}</div>
                <div className="notification-message">{notification.message}</div>
                <div className="notification-time">{notification.time}</div>
            </div>
        </div>
    );
}

/**
 * 统计信息组件
 */
export function StatisticsPanel() {
    const { statistics, loading, formatUsageTime } = usePopupStatistics();
    
    if (loading) {
        return <div className="statistics-loading">加载中...</div>;
    }
    
    return (
        <div className="statistics-panel">
            <h4>使用统计</h4>
            <div className="statistics-grid">
                <div className="stat-item">
                    <div className="stat-value">{formatUsageTime(statistics.todayUsage || 0)}</div>
                    <div className="stat-label">今日使用</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{formatUsageTime(statistics.weekUsage || 0)}</div>
                    <div className="stat-label">本周使用</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{formatUsageTime(statistics.totalUsage || 0)}</div>
                    <div className="stat-label">总使用时长</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{statistics.mostUsedFeature || 'pet'}</div>
                    <div className="stat-label">最常用功能</div>
                </div>
            </div>
        </div>
    );
}

/**
 * 设置面板组件
 */
export function SettingsPanel() {
    const [settings, setSettings] = React.useState({
        theme: 'light',
        language: 'zh-CN',
        notifications: true,
        autoStart: true
    });
    
    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };
    
    return (
        <div className="settings-panel">
            <h4>设置</h4>
            <div className="settings-content">
                <div className="setting-item">
                    <label>主题</label>
                    <select 
                        value={settings.theme}
                        onChange={(e) => handleSettingChange('theme', e.target.value)}
                    >
                        <option value="light">浅色</option>
                        <option value="dark">深色</option>
                        <option value="auto">自动</option>
                    </select>
                </div>
                
                <div className="setting-item">
                    <label>语言</label>
                    <select 
                        value={settings.language}
                        onChange={(e) => handleSettingChange('language', e.target.value)}
                    >
                        <option value="zh-CN">简体中文</option>
                        <option value="en-US">English</option>
                    </select>
                </div>
                
                <div className="setting-item">
                    <label>
                        <input 
                            type="checkbox"
                            checked={settings.notifications}
                            onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                        />
                        启用通知
                    </label>
                </div>
                
                <div className="setting-item">
                    <label>
                        <input 
                            type="checkbox"
                            checked={settings.autoStart}
                            onChange={(e) => handleSettingChange('autoStart', e.target.checked)}
                        />
                        开机自启
                    </label>
                </div>
            </div>
        </div>
    );
}

/**
 * 主弹窗组件
 */
export function MainPopup() {
    const { currentView } = usePopupState();
    
    const renderContent = () => {
        switch (currentView) {
            case 'main':
                return (
                    <div className="popup-main-content">
                        <QuickActionsList />
                        <NotificationsList />
                        <StatisticsPanel />
                    </div>
                );
            case 'settings':
                return <SettingsPanel />;
            default:
                return <div>未知视图</div>;
        }
    };
    
    return (
        <PopupContainer>
            <PopupHeader title="YiPet" />
            {renderContent()}
        </PopupContainer>
    );
}