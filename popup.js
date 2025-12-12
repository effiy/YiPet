/**
 * Chrome扩展弹窗控制脚本
 * 
 * 功能说明：
 * - 管理弹窗界面的所有交互逻辑
 * - 与content script通信，控制宠物的显示、颜色、大小、位置等属性
 * - 同步全局状态，确保跨标签页的一致性
 * - 提供用户友好的错误提示和状态反馈
 */

/**
 * 初始化日志工具
 * 根据开发模式设置控制控制台输出
 * 优先使用 LoggerUtils，如果不可用则静默失败（不影响主功能）
 */
(function() {
    try {
        if (typeof LoggerUtils !== 'undefined' && LoggerUtils.initMuteLogger) {
            LoggerUtils.initMuteLogger('petDevMode', false);
        }
    } catch (e) {
        // 静默处理初始化错误，确保不影响弹窗功能
    }
})();

/**
 * 弹窗控制器类
 * 负责管理弹窗界面的所有功能和状态
 */
class PopupController {
    /**
     * 构造函数
     * 初始化当前标签页和宠物状态
     */
    constructor() {
        // 当前活动的标签页
        this.currentTab = null;
        
        // 当前宠物的状态信息
        this.currentPetStatus = {
            visible: CONSTANTS.DEFAULTS.PET_VISIBLE,  // 是否可见
            color: CONSTANTS.DEFAULTS.PET_COLOR,       // 颜色索引
            size: CONSTANTS.DEFAULTS.PET_SIZE,         // 大小（像素）
            position: { x: 0, y: 0 },                 // 位置坐标
            role: CONSTANTS.DEFAULTS.PET_ROLE          // 角色名称
        };
        
        // 状态同步定时器ID
        this.statusSyncInterval = null;
        
        // 初始化弹窗
        this.init();
    }
    
    /**
     * 初始化弹窗控制器
     * 执行以下步骤：
     * 1. 获取当前活动标签页
     * 2. 设置事件监听器
     * 3. 检查content script是否就绪
     * 4. 加载宠物状态并更新UI
     * 5. 启动状态同步机制
     */
    async init() {
        try {
            // 步骤1: 获取当前活动的标签页
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];
            
            if (!this.currentTab) {
                console.error(CONSTANTS.ERROR_MESSAGES.TAB_NOT_FOUND);
                this.showNotification(CONSTANTS.ERROR_MESSAGES.TAB_NOT_FOUND, 'error');
                return;
            }
            
            console.log('当前标签页:', this.currentTab.id, this.currentTab.url);
            
            // 步骤2: 初始化UI事件监听器
            this.setupEventListeners();
            
            // 步骤3: 检查content script是否已加载并就绪
            const isContentScriptReady = await this.checkContentScriptStatus();
            if (!isContentScriptReady) {
                console.log('Content script 未就绪，等待...');
                this.showNotification('正在初始化，请稍候...', 'info');
                
                // 延迟重试，给content script一些时间加载
                setTimeout(async () => {
                    await this.loadPetStatus();
                    this.updateUI();
                }, CONSTANTS.TIMING.CONTENT_SCRIPT_WAIT);
            } else {
                // content script已就绪，直接加载状态
                await this.loadPetStatus();
                this.updateUI();
            }
            
            // 步骤4: 启动定期状态同步，确保UI与宠物状态保持一致
            this.startStatusSync();
        } catch (error) {
            console.error('初始化失败:', error);
            this.showNotification(CONSTANTS.ERROR_MESSAGES.INIT_FAILED, 'error');
        }
    }
    
    /**
     * 设置事件监听器
     * 使用配置化的方式批量绑定UI元素的事件处理器
     */
    setupEventListeners() {
        // 事件映射配置：定义所有需要绑定事件的UI元素
        const eventMap = [
            { id: 'toggleBtn', event: 'click', handler: () => this.togglePetVisibility() },
            { id: 'colorBtn', event: 'click', handler: () => this.changePetColor() },
            { id: 'sizeSlider', event: 'input', handler: (e) => this.updatePetSize(parseInt(e.target.value)) },
            { id: 'colorSelect', event: 'change', handler: (e) => this.setPetColor(parseInt(e.target.value)) },
            { id: 'resetBtn', event: 'click', handler: () => this.resetPetPosition() },
            { id: 'centerBtn', event: 'click', handler: () => this.centerPetPosition() },
            { id: 'roleSelect', event: 'change', handler: (e) => this.setPetRole(e.target.value) }
        ];

        // 批量绑定事件监听器
        eventMap.forEach(({ id, event, handler }) => {
            const element = DomHelper.getElement(id);
            DomHelper.addEventListener(element, event, handler);
        });
    }
    
    /**
     * 加载宠物状态
     * 优先级：全局存储 > content script > 默认值
     * 如果都无法获取，则尝试初始化宠物
     */
    async loadPetStatus() {
        try {
            console.log('尝试获取宠物状态...');
            
            // 优先从全局存储加载状态（跨标签页同步）
            const storageUtils = new StorageUtils();
            const globalState = await storageUtils.loadGlobalState();
            
            if (globalState) {
                this.currentPetStatus = globalState;
                console.log('从全局存储加载状态:', globalState);
            } else {
                // 如果全局存储中没有，则向content script请求当前状态
                const response = await this.sendMessageToContentScript({ action: 'getStatus' });
                
                if (response && response.success !== false) {
                    console.log('成功获取宠物状态:', response);
                    // 规范化状态数据，确保所有字段都有默认值
                    this.currentPetStatus = storageUtils.normalizeState({
                        visible: response.visible,
                        color: response.color,
                        size: response.size,
                        position: response.position,
                        role: response.role
                    });
                } else {
                    console.log('无法获取宠物状态，使用默认值');
                    // 如果无法获取状态，尝试初始化宠物
                    await this.initializePet();
                }
            }
        } catch (error) {
            console.log('获取宠物状态时出错:', error);
            // 如果获取状态失败，尝试初始化宠物
            await this.initializePet();
        }
    }
    
    /**
     * 更新全局状态到存储
     * 将当前宠物状态保存到Chrome存储，实现跨标签页同步
     */
    async updateGlobalState() {
        const storageUtils = new StorageUtils();
        await storageUtils.saveGlobalState(this.currentPetStatus);
    }
    
    /**
     * 初始化宠物
     * 尝试通过content script初始化宠物，如果失败则使用备用方案
     */
    async initializePet() {
        try {
            console.log('尝试初始化宠物...');
            const response = await this.sendMessageToContentScript({ action: 'initPet' });
            if (response && response.success) {
                console.log('宠物初始化成功');
            } else {
                console.log('宠物初始化失败，尝试备用方案...');
                await this.fallbackInitializePet();
            }
        } catch (error) {
            console.log('初始化宠物时出错:', error);
            await this.fallbackInitializePet();
        }
    }
    
    /**
     * 备用初始化方案
     * 当content script无法响应时，通过background script直接注入宠物
     */
    async fallbackInitializePet() {
        try {
            console.log('使用备用方案初始化宠物...');
            const response = await chrome.runtime.sendMessage({
                action: 'injectPet',
                tabId: this.currentTab.id
            });
            if (response && response.success) {
                console.log('备用方案初始化成功');
                this.showNotification('宠物已通过备用方案初始化', 'info');
            } else {
                console.log('备用方案初始化失败');
                this.showNotification('无法初始化宠物，请刷新页面后重试', 'error');
            }
        } catch (error) {
            console.log('备用方案初始化失败:', error);
            this.showNotification('无法初始化宠物，请刷新页面后重试', 'error');
        }
    }
    
    /**
     * 检查content script是否就绪
     * @returns {Promise<boolean>} content script是否已加载并可以通信
     */
    async checkContentScriptStatus() {
        if (!this.currentTab || !this.currentTab.id) {
            return false;
        }
        return await MessageHelper.checkContentScriptReady(this.currentTab.id);
    }
    
    /**
     * 更新UI界面
     * 根据当前宠物状态更新所有UI元素的显示
     */
    updateUI() {
        // 更新切换按钮
        const toggleBtn = DomHelper.getElement('toggleBtn');
        if (toggleBtn) {
            const btnText = DomHelper.querySelector(toggleBtn, '.btn-text');
            const btnIcon = DomHelper.querySelector(toggleBtn, '.btn-icon');
            
            if (btnText && btnIcon) {
                if (this.currentPetStatus.visible) {
                    DomHelper.setText(btnText, '隐藏陪伴');
                    DomHelper.setText(btnIcon, '👁️');
                } else {
                    DomHelper.setText(btnText, '显示陪伴');
                    DomHelper.setText(btnIcon, '🙈');
                }
            }
        }
        
        // 更新大小滑块和显示值
        const sizeSlider = DomHelper.getElement('sizeSlider');
        const sizeValue = DomHelper.getElement('sizeValue');
        DomHelper.setValue(sizeSlider, this.currentPetStatus.size);
        DomHelper.setText(sizeValue, this.currentPetStatus.size);
        
        // 更新颜色和角色选择
        DomHelper.setValue(DomHelper.getElement('colorSelect'), this.currentPetStatus.color);
        DomHelper.setValue(DomHelper.getElement('roleSelect'), this.currentPetStatus.role || '教师');
        
        // 更新状态指示器
        this.updateStatusIndicator();
    }
    
    /**
     * 更新状态指示器
     * 根据宠物的可见性状态更新状态指示器的文本和颜色
     */
    updateStatusIndicator() {
        const statusIndicator = DomHelper.getElement('statusIndicator');
        if (!statusIndicator) return;
        
        const statusText = DomHelper.querySelector(statusIndicator, '.status-text');
        const statusDot = DomHelper.querySelector(statusIndicator, '.status-dot');
        
        if (statusText && statusDot) {
            if (this.currentPetStatus.visible) {
                DomHelper.setText(statusText, '已激活');
                statusDot.style.background = CONSTANTS.UI.STATUS_DOT_ACTIVE;
            } else {
                DomHelper.setText(statusText, '已隐藏');
                statusDot.style.background = CONSTANTS.UI.STATUS_DOT_INACTIVE;
            }
        }
    }
    
    /**
     * 发送消息到content script
     * @param {Object} message - 要发送的消息对象
     * @param {number} retries - 最大重试次数
     * @returns {Promise<Object|null>} 响应结果
     */
    async sendMessageToContentScript(message, retries = CONSTANTS.RETRY.MAX_RETRIES) {
        if (!this.currentTab || !this.currentTab.id) {
            console.error('当前标签页无效');
            return null;
        }
        return await MessageHelper.sendToContentScript(this.currentTab.id, message, { maxRetries: retries });
    }
    
    /**
     * 切换宠物可见性
     * 显示/隐藏宠物，并更新全局状态和UI
     */
    async togglePetVisibility() {
        this.setButtonLoading('toggleBtn', true);
        
        const result = await ErrorHandler.safeExecute(async () => {
            console.log('切换宠物可见性...');
            const response = await this.sendMessageToContentScript({ action: 'toggleVisibility' });
            
            if (response && response.success) {
                this.currentPetStatus.visible = response.visible !== undefined ? response.visible : !this.currentPetStatus.visible;
                await this.updateGlobalState();
                this.updateUI();
                const message = this.currentPetStatus.visible ? CONSTANTS.SUCCESS_MESSAGES.SHOWN : CONSTANTS.SUCCESS_MESSAGES.HIDDEN;
                this.showNotification(message);
                console.log('宠物状态切换成功:', this.currentPetStatus.visible);
                return { success: true };
            } else {
                throw new Error(CONSTANTS.ERROR_MESSAGES.OPERATION_FAILED);
            }
        }, { showNotification: true });
        
        this.setButtonLoading('toggleBtn', false);
        return result;
    }
    
    /**
     * 切换宠物颜色
     * 循环切换到下一个颜色主题（0-4循环）
     */
    async changePetColor() {
        this.setButtonLoading('colorBtn', true);
        
        const result = await ErrorHandler.safeExecute(async () => {
            const response = await this.sendMessageToContentScript({ action: 'changeColor' });
            if (response && response.success) {
                // 循环切换颜色：0 -> 1 -> 2 -> 3 -> 4 -> 0
                this.currentPetStatus.color = (this.currentPetStatus.color + 1) % 5;
                this.updateUI();
                this.showNotification(CONSTANTS.SUCCESS_MESSAGES.COLOR_CHANGED);
                return { success: true };
            } else {
                throw new Error(CONSTANTS.ERROR_MESSAGES.OPERATION_FAILED);
            }
        }, { showNotification: true });
        
        this.setButtonLoading('colorBtn', false);
        return result;
    }
    
    /**
     * 设置宠物颜色
     * @param {number} colorIndex - 颜色索引（0-4）
     */
    async setPetColor(colorIndex) {
        this.currentPetStatus.color = colorIndex;
        
        await ErrorHandler.safeExecute(async () => {
            await this.updateGlobalState();
            const response = await this.sendMessageToContentScript({ 
                action: 'setColor', 
                color: colorIndex 
            });
            if (response && response.success) {
                this.showNotification(CONSTANTS.SUCCESS_MESSAGES.COLOR_SET);
                this.updateUI();
                return { success: true };
            } else {
                throw new Error(CONSTANTS.ERROR_MESSAGES.OPERATION_FAILED);
            }
        }, { showNotification: true });
    }
    
    /**
     * 更新宠物大小
     * @param {number} newSize - 新的大小值（像素）
     */
    async updatePetSize(newSize) {
        // 立即更新本地状态和UI显示值（提供即时反馈）
        this.currentPetStatus.size = newSize;
        DomHelper.setText(DomHelper.getElement('sizeValue'), newSize);
        
        // 同步到content script和全局存储
        await ErrorHandler.safeExecute(async () => {
            await this.updateGlobalState();
            const response = await this.sendMessageToContentScript({ 
                action: 'changeSize', 
                size: newSize 
            });
            if (response && response.success) {
                this.updateUI();
                return { success: true };
            } else {
                throw new Error(CONSTANTS.ERROR_MESSAGES.OPERATION_FAILED);
            }
        }, { showNotification: true });
    }
    
    /**
     * 重置宠物位置
     * 将宠物位置重置为默认位置
     */
    async resetPetPosition() {
        this.setButtonLoading('resetBtn', true);
        
        const result = await ErrorHandler.safeExecute(async () => {
            const response = await this.sendMessageToContentScript({ action: 'resetPosition' });
            if (response && response.success) {
                this.currentPetStatus.position = getPetDefaultPosition();
                this.updateUI();
                this.showNotification(CONSTANTS.SUCCESS_MESSAGES.POSITION_RESET);
                return { success: true };
            } else {
                throw new Error(CONSTANTS.ERROR_MESSAGES.OPERATION_FAILED);
            }
        }, { showNotification: true });
        
        this.setButtonLoading('resetBtn', false);
        return result;
    }
    
    /**
     * 居中宠物位置
     * 将宠物移动到屏幕中央位置
     */
    async centerPetPosition() {
        this.setButtonLoading('centerBtn', true);
        
        const result = await ErrorHandler.safeExecute(async () => {
            const response = await this.sendMessageToContentScript({ action: 'centerPet' });
            if (response && response.success) {
                // 获取更新后的位置信息
                const statusResponse = await this.sendMessageToContentScript({ action: 'getStatus' });
                if (statusResponse && statusResponse.position) {
                    this.currentPetStatus.position = statusResponse.position;
                }
                this.updateUI();
                this.showNotification(CONSTANTS.SUCCESS_MESSAGES.CENTERED);
                return { success: true };
            } else {
                throw new Error(CONSTANTS.ERROR_MESSAGES.OPERATION_FAILED);
            }
        }, { showNotification: true });
        
        this.setButtonLoading('centerBtn', false);
        return result;
    }
    
    /**
     * 设置宠物角色
     * @param {string} role - 角色名称（如：教师、医生等）
     */
    async setPetRole(role) {
        this.currentPetStatus.role = role || '教师';
        
        await ErrorHandler.safeExecute(async () => {
            await this.updateGlobalState();
            const response = await this.sendMessageToContentScript({ 
                action: 'setRole', 
                role: role 
            });
            if (response && response.success) {
                this.showNotification(`${CONSTANTS.SUCCESS_MESSAGES.ROLE_CHANGED}：${role}`);
                this.updateUI();
                return { success: true };
            } else {
                throw new Error(CONSTANTS.ERROR_MESSAGES.OPERATION_FAILED);
            }
        }, { showNotification: true });
    }
    
    /**
     * 设置按钮加载状态
     * @param {string} buttonId - 按钮ID
     * @param {boolean} loading - 是否处于加载状态
     */
    setButtonLoading(buttonId, loading) {
        DomHelper.setButtonLoading(buttonId, loading);
    }
    
    /**
     * 启动状态同步机制
     * 通过两种方式同步状态：
     * 1. 监听Chrome存储变化（实时同步）
     * 2. 定期轮询content script状态（备用同步）
     */
    startStatusSync() {
        // 方式1: 监听Chrome存储变化，实现跨页面实时同步
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
                chrome.storage.onChanged.addListener((changes, namespace) => {
                    try {
                        // 监听 local 和 sync 存储的变化（兼容新旧版本）
                        if ((namespace === 'local' || namespace === 'sync') && changes.petGlobalState) {
                            const newState = changes.petGlobalState.newValue;
                            if (newState) {
                                // 更新本地状态（所有属性都同步）
                                this.currentPetStatus.visible = newState.visible !== undefined ? newState.visible : this.currentPetStatus.visible;
                                this.currentPetStatus.color = newState.color !== undefined ? newState.color : this.currentPetStatus.color;
                                this.currentPetStatus.size = newState.size !== undefined ? newState.size : this.currentPetStatus.size;
                                this.currentPetStatus.role = newState.role || this.currentPetStatus.role || '教师';
                                // 位置也进行跨页面同步
                                if (newState.position) {
                                    this.currentPetStatus.position = newState.position;
                                }
                                
                                console.log('收到全局状态更新 (', namespace, '):', newState);
                                this.updateUI();
                            }
                        }
                    } catch (error) {
                        // 静默处理监听器错误，避免打断用户操作
                        console.debug('存储变化监听器错误:', error);
                    }
                });
            }
        } catch (error) {
            console.debug('无法设置存储变化监听器:', error);
        }
        
        // 方式2: 定期同步状态（作为备用机制，确保状态一致性）
        this.statusSyncInterval = setInterval(async () => {
            try {
                const response = await this.sendMessageToContentScript({ action: 'getStatus' });
                if (response && response.success !== false) {
                    // 更新本地状态
                    this.currentPetStatus.visible = response.visible !== undefined ? response.visible : this.currentPetStatus.visible;
                    this.currentPetStatus.color = response.color !== undefined ? response.color : this.currentPetStatus.color;
                    this.currentPetStatus.size = response.size !== undefined ? response.size : this.currentPetStatus.size;
                    this.currentPetStatus.position = response.position || this.currentPetStatus.position;
                    
                    // 更新UI
                    this.updateUI();
                }
            } catch (error) {
                // 静默处理同步错误，避免影响用户体验
                console.debug('状态同步失败:', error);
            }
        }, CONSTANTS.TIMING.STATUS_SYNC_INTERVAL);
    }
    
    /**
     * 停止状态同步
     * 清理定时器，释放资源
     */
    stopStatusSync() {
        if (this.statusSyncInterval) {
            clearInterval(this.statusSyncInterval);
            this.statusSyncInterval = null;
        }
    }
    
    /**
     * 显示通知消息
     * @param {string} message - 通知消息内容
     * @param {string} type - 通知类型：'success' | 'error' | 'info'
     */
    showNotification(message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // 根据类型选择背景颜色
        const backgroundColor = type === 'error' ? CONSTANTS.UI.NOTIFICATION_ERROR : 
                               type === 'info' ? CONSTANTS.UI.NOTIFICATION_INFO : CONSTANTS.UI.NOTIFICATION_SUCCESS;
        
        // 设置通知样式
        notification.style.cssText = `
            position: fixed;
            top: ${CONSTANTS.UI.NOTIFICATION_TOP}px;
            left: 50%;
            transform: translateX(-50%);
            background: ${backgroundColor};
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 1000;
            animation: slideDown 0.3s ease-out;
        `;
        
        // 添加动画样式（如果尚未添加）
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `;
            if (document.head) {
                document.head.appendChild(style);
            }
        }
        
        // 将通知添加到页面
        if (document.body) {
            document.body.appendChild(notification);
        }
        
        // 延迟移除通知（自动消失）
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, CONSTANTS.TIMING.NOTIFICATION_DURATION);
    }
}

// ==================== 页面初始化 ====================

/**
 * 页面加载完成后初始化弹窗控制器
 * 页面卸载时清理资源，停止状态同步定时器，防止内存泄漏
 */
let popupController;

document.addEventListener('DOMContentLoaded', () => {
    popupController = new PopupController();
});

window.addEventListener('beforeunload', () => {
    if (popupController) {
        popupController.stopStatusSync();
    }
});






