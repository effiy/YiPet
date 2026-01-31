/**
 * Popup Styles
 * 弹窗样式
 */

export const popupStyles = `
/* 弹窗容器 */
.popup-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.popup-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
}

.popup-content {
    position: relative;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    width: 400px;
    max-height: 600px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

/* 弹窗头部 */
.popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #e8e8e8;
    background: #fafafa;
    border-radius: 12px 12px 0 0;
}

.popup-title {
    display: flex;
    align-items: center;
    gap: 8px;
}

.popup-title .popup-icon {
    font-size: 20px;
}

.popup-title h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
}

.popup-close {
    background: none;
    border: none;
    font-size: 18px;
    color: #999;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.popup-close:hover {
    background: #f0f0f0;
    color: #666;
}

/* 快捷操作 */
.quick-actions-list {
    padding: 20px;
    border-bottom: 1px solid #f0f0f0;
}

.quick-actions-list h4 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
}

.actions-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.quick-action-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 12px;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: white;
}

.quick-action-item:hover {
    border-color: #1890ff;
    background: #f6fffe;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
}

.action-icon {
    font-size: 24px;
    margin-bottom: 8px;
}

.action-name {
    font-size: 12px;
    color: #666;
    text-align: center;
}

/* 通知 */
.notifications-list {
    padding: 20px;
    border-bottom: 1px solid #f0f0f0;
}

.notifications-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.notifications-header h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
}

.unread-count {
    background: #ff4d4f;
    color: white;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
}

.no-notifications {
    text-align: center;
    color: #999;
    font-size: 14px;
    padding: 20px;
}

.notification-item {
    display: flex;
    align-items: flex-start;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.notification-item:hover {
    background: #f8f9fa;
}

.notification-item.unread {
    background: #e6f7ff;
    border-left: 3px solid #1890ff;
}

.notification-icon {
    font-size: 16px;
    margin-right: 12px;
    margin-top: 2px;
}

.notification-content {
    flex: 1;
}

.notification-title {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
}

.notification-message {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
    line-height: 1.4;
}

.notification-time {
    font-size: 11px;
    color: #999;
}

/* 统计信息 */
.statistics-panel {
    padding: 20px;
}

.statistics-panel h4 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
}

.statistics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
}

.stat-item {
    text-align: center;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 6px;
}

.stat-value {
    font-size: 18px;
    font-weight: 600;
    color: #1890ff;
    margin-bottom: 4px;
}

.stat-label {
    font-size: 12px;
    color: #666;
}

/* 设置面板 */
.settings-panel {
    padding: 20px;
}

.settings-panel h4 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: #333;
}

.settings-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.setting-item label {
    font-size: 14px;
    color: #333;
    font-weight: 500;
}

.setting-item select {
    padding: 6px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 14px;
    background: white;
    cursor: pointer;
}

.setting-item select:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.setting-item input[type="checkbox"] {
    margin-left: 8px;
    cursor: pointer;
}

/* 响应式设计 */
@media (max-width: 480px) {
    .popup-content {
        width: 90vw;
        max-width: 400px;
        margin: 20px;
    }
    
    .actions-grid {
        grid-template-columns: 1fr;
    }
    
    .statistics-grid {
        grid-template-columns: 1fr;
    }
}

/* 深色主题 */
@media (prefers-color-scheme: dark) {
    .popup-content {
        background: #1f1f1f;
        color: #fff;
    }
    
    .popup-header {
        background: #141414;
        border-bottom-color: #303030;
    }
    
    .popup-title h3 {
        color: #fff;
    }
    
    .popup-close {
        color: #999;
    }
    
    .popup-close:hover {
        background: #303030;
        color: #ccc;
    }
    
    .quick-action-item {
        background: #1f1f1f;
        border-color: #303030;
    }
    
    .quick-action-item:hover {
        background: #2a2a2a;
        border-color: #1890ff;
    }
    
    .action-name {
        color: #ccc;
    }
    
    .notification-item.unread {
        background: #111d2c;
    }
    
    .notification-item:hover {
        background: #2a2a2a;
    }
    
    .notification-title {
        color: #fff;
    }
    
    .notification-message {
        color: #ccc;
    }
    
    .stat-item {
        background: #2a2a2a;
    }
    
    .stat-label {
        color: #ccc;
    }
    
    .setting-item select {
        background: #1f1f1f;
        border-color: #303030;
        color: #fff;
    }
    
    .setting-item select:focus {
        border-color: #1890ff;
    }
}

/* 动画效果 */
.popup-container {
    animation: fadeIn 0.2s ease-out;
}

.popup-content {
    animation: slideUp 0.3s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes slideUp {
    from {
        transform: translateY(20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.quick-action-item {
    animation: scaleIn 0.2s ease-out;
}

@keyframes scaleIn {
    from {
        transform: scale(0.9);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}
`;

/**
 * 获取弹窗样式
 */
export function getPopupStyles() {
    return popupStyles;
}

/**
 * 注入样式到页面
 */
export function injectPopupStyles() {
    const styleId = 'yipet-popup-styles';
    
    // 检查样式是否已存在
    if (document.getElementById(styleId)) {
        return;
    }
    
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = popupStyles;
    
    document.head.appendChild(styleElement);
}

/**
 * 移除弹窗样式
 */
export function removePopupStyles() {
    const styleElement = document.getElementById('yipet-popup-styles');
    if (styleElement) {
        styleElement.remove();
    }
}