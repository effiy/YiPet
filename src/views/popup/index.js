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
            const keyName = (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.storageKeys) ? PET_CONFIG.constants.storageKeys.devMode : 'petDevMode';
            LoggerUtils.initMuteLogger(keyName, false);
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
            visible: PET_CONFIG.pet.defaultVisible,
            color: PET_CONFIG.pet.defaultColorIndex,
            size: PET_CONFIG.pet.defaultSize,
            position: { x: 0, y: 0 },                 // 位置坐标
            role: (PET_CONFIG.constants && PET_CONFIG.constants.DEFAULTS) ? PET_CONFIG.constants.DEFAULTS.PET_ROLE : '教师',
            model: null
        };
        
        // 状态同步定时器ID
        this.statusSyncInterval = null;
        
        // 初始化弹窗
        this.init();
    }
    
    /**
     * 初始化弹窗控制器
     * 执行以下步骤：
     * 1. 获取当前活动标签页（带重试）
     * 2. 设置事件监听器
     * 3. 检查content script是否就绪（带重试）
     * 4. 加载宠物状态并更新UI（带重试和降级）
     * 5. 启动状态同步机制
     */
    async init() {
        try {
            // 步骤1: 获取当前活动的标签页（带重试）
            await this.initWithRetry(async () => {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tabs || tabs.length === 0) {
                    throw new Error('无法获取当前标签页');
                }
                this.currentTab = tabs[0];
                console.log('当前标签页:', this.currentTab.id, this.currentTab.url);
            }, '获取标签页', {
                onRetry: (error, attempt) => {
                    this.showNotification(`正在获取标签页... (${attempt}/${3})`, 'info');
                }
            });
            
            // 步骤2: 初始化UI事件监听器
            this.setupEventListeners();
            this.setControlsEnabled(false);
            this.setHintText('连接中…');
            
            // 步骤3: 检查并等待content script就绪（带重试）
            const isContentScriptReady = await this.initWithRetry(
                () => this.checkContentScriptStatus(),
                '检查Content Script',
                {
                    shouldRetry: (result) => !result, // 如果未就绪则重试
                    onRetry: (error, attempt) => {
                        this.showNotification(`正在等待Content Script就绪... (${attempt}/${3})`, 'info');
                    }
                }
            );
            
            if (!isContentScriptReady) {
                throw new Error('Content Script 未就绪');
            }
            
            // 步骤4: 加载宠物状态并更新UI（带重试和降级）
            await this.initWithRetry(
                async () => {
                    await this.loadPetStatus();
                    this.updateUI();
                },
                '加载宠物状态',
                {
                    onRetry: (error, attempt) => {
                        if (attempt === 1) {
                            this.showNotification('正在加载状态...', 'info');
                        }
                    },
                    onFailure: async (error) => {
                        console.log('加载状态失败，使用默认状态');
                        this.showNotification('使用默认配置', 'warn');
                        this.updateUI();
                    }
                }
            );

            this.setControlsEnabled(true);
            this.setHintText('准备就绪');
            
            // 步骤5: 启动定期状态同步，确保UI与宠物状态保持一致
            this.startStatusSync();
            
        } catch (error) {
            console.error('初始化失败:', error);
            const errorMsg = (PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) 
                ? PET_CONFIG.constants.ERROR_MESSAGES.INIT_FAILED 
                : '初始化失败';
            this.showNotification(`${errorMsg}: ${error.message || '未知错误'}`, 'error');
        }
    }
    
    /**
     * 带重试的初始化方法
     * @param {Function} fn - 要执行的异步函数
     * @param {string} context - 上下文描述
     * @param {Object} options - 重试选项
     * @returns {Promise<any>} 执行结果
     */
    async initWithRetry(fn, context, options = {}) {
        const maxRetries = options.maxRetries || 3;
        const delay = options.initialDelay || 500;
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                if (options.shouldRetry && typeof options.shouldRetry === 'function' && options.shouldRetry(result)) {
                    throw new Error(`${context}未就绪`);
                }
                return result;
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    if (options.onRetry) {
                        options.onRetry(error, attempt + 1);
                    }
                    await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
                    continue;
                }

                if (options.onFailure) {
                    await options.onFailure(lastError);
                }
                throw lastError;
            }
        }

        throw lastError || new Error(`${context}失败`);
    }
    
    /**
     * 设置事件监听器
     * 使用配置化的方式批量绑定UI元素的事件处理器
     */
    setupEventListeners() {
        // 事件映射配置：定义所有需要绑定事件的UI元素
        const eventMap = [
            { id: 'openChatBtn', event: 'click', handler: () => this.openChatWindow() },
            { id: 'openQuickCommentBtn', event: 'click', handler: () => this.openQuickComment() },
            { id: 'centerPetBtn', event: 'click', handler: () => this.centerPet() },
            { id: 'resetPositionBtn', event: 'click', handler: () => this.resetPosition() },
            { id: 'visibilityToggle', event: 'change', handler: (e) => this.toggleVisibility(e) },
            { id: 'sizeSlider', event: 'input', handler: (e) => this.previewPetSize(parseInt(e.target.value)) },
            { id: 'sizeSlider', event: 'change', handler: (e) => this.setPetSize(parseInt(e.target.value)) },
            { id: 'roleSelect', event: 'change', handler: (e) => this.setPetRole(String(e.target.value || '教师')) },
            { id: 'colorSelect', event: 'change', handler: (e) => this.setPetColor(parseInt(e.target.value)) }
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
     */
    async initializePet() {
        console.log('尝试初始化宠物...');
        const response = await this.sendMessageToContentScript({ action: 'initPet' });
        if (response && response.success) {
            console.log('宠物初始化成功');
            return true;
        }
        throw new Error('初始化宠物失败');
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
        const visibilityToggle = DomHelper.getElement('visibilityToggle');
        if (visibilityToggle) {
            visibilityToggle.checked = !!this.currentPetStatus.visible;
        }

        const sizeSlider = DomHelper.getElement('sizeSlider');
        DomHelper.setValue(sizeSlider, this.currentPetStatus.size);
        this.previewPetSize(this.currentPetStatus.size);

        DomHelper.setValue(DomHelper.getElement('roleSelect'), this.currentPetStatus.role || '教师');
        DomHelper.setValue(DomHelper.getElement('colorSelect'), this.currentPetStatus.color);

        const modelTextEl = DomHelper.getElement('modelText');
        const model = this.currentPetStatus.model ? String(this.currentPetStatus.model) : '-';
        DomHelper.setText(modelTextEl, `模型：${model}`);
        
        // 更新状态指示器
        this.updateStatusIndicator();
    }
    
    /**
     * 打开聊天窗口
     */
    async openChatWindow() {
        this.setButtonLoading('openChatBtn', true);
        
        const result = await ErrorHandler.safeExecute(async () => {
            console.log('打开聊天窗口...');
            const response = await this.sendMessageToContentScript({ action: 'openChatWindow' });
            
            if (response && response.success) {
                this.showNotification('聊天窗口已打开');
                return { success: true };
            } else {
                const errorMsg = (PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) 
                    ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED 
                    : '操作失败';
                throw new Error(errorMsg);
            }
        }, { showNotification: true });
        
        this.setButtonLoading('openChatBtn', false);
        return result;
    }

    previewPetSize(size) {
        const normalized = Number.isFinite(size) ? size : this.currentPetStatus.size;
        const el = DomHelper.getElement('sizeValue');
        DomHelper.setText(el, `${normalized}px`);
    }

    async toggleVisibility(e) {
        const el = e && e.target ? e.target : DomHelper.getElement('visibilityToggle');
        if (el) el.disabled = true;

        await ErrorHandler.safeExecute(async () => {
            const response = await this.sendMessageToContentScript({ action: 'toggleVisibility' });
            if (!response || response.success === false) {
                const errorMsg = (PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES)
                    ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED
                    : '操作失败';
                throw new Error(errorMsg);
            }

            this.currentPetStatus.visible = response.visible !== undefined ? response.visible : !this.currentPetStatus.visible;
            await this.updateGlobalState();
            this.updateUI();

            const msg = this.currentPetStatus.visible
                ? ((PET_CONFIG.constants && PET_CONFIG.constants.SUCCESS_MESSAGES) ? PET_CONFIG.constants.SUCCESS_MESSAGES.SHOWN : '已显示')
                : ((PET_CONFIG.constants && PET_CONFIG.constants.SUCCESS_MESSAGES) ? PET_CONFIG.constants.SUCCESS_MESSAGES.HIDDEN : '已隐藏');
            this.showNotification(msg, 'success');
        }, { showNotification: true });

        if (el) el.disabled = false;
    }

    async setPetSize(size) {
        const min = (PET_CONFIG.pet && PET_CONFIG.pet.sizeLimits) ? PET_CONFIG.pet.sizeLimits.min : 80;
        const max = (PET_CONFIG.pet && PET_CONFIG.pet.sizeLimits) ? PET_CONFIG.pet.sizeLimits.max : 400;
        const normalized = Math.max(min, Math.min(max, Number(size)));
        this.currentPetStatus.size = normalized;
        this.previewPetSize(normalized);

        await ErrorHandler.safeExecute(async () => {
            await this.updateGlobalState();
            const response = await this.sendMessageToContentScript({
                action: 'changeSize',
                size: normalized
            });
            if (!response || response.success === false) {
                const errorMsg = (PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES)
                    ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED
                    : '操作失败';
                throw new Error(errorMsg);
            }
            const nextSize = response.size !== undefined ? response.size : normalized;
            this.currentPetStatus.size = nextSize;
            await this.updateGlobalState();
            this.updateUI();
            this.showNotification((PET_CONFIG.constants && PET_CONFIG.constants.SUCCESS_MESSAGES) ? PET_CONFIG.constants.SUCCESS_MESSAGES.SIZE_UPDATED : '大小已更新', 'success');
        }, { showNotification: true });
    }

    async setPetRole(role) {
        const nextRole = role && String(role).trim() ? String(role).trim() : '教师';
        this.currentPetStatus.role = nextRole;

        await ErrorHandler.safeExecute(async () => {
            await this.updateGlobalState();
            const response = await this.sendMessageToContentScript({
                action: 'setRole',
                role: nextRole
            });
            if (!response || response.success === false) {
                const errorMsg = (PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES)
                    ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED
                    : '操作失败';
                throw new Error(errorMsg);
            }
            this.currentPetStatus.role = response.role || nextRole;
            await this.updateGlobalState();
            this.updateUI();
            this.showNotification((PET_CONFIG.constants && PET_CONFIG.constants.SUCCESS_MESSAGES) ? PET_CONFIG.constants.SUCCESS_MESSAGES.ROLE_CHANGED : '角色已切换', 'success');
        }, { showNotification: true });
    }

    async centerPet() {
        this.setButtonLoading('centerPetBtn', true);

        await ErrorHandler.safeExecute(async () => {
            const response = await this.sendMessageToContentScript({ action: 'centerPet' });
            if (!response || response.success === false) {
                const errorMsg = (PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES)
                    ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED
                    : '操作失败';
                throw new Error(errorMsg);
            }
            this.showNotification((PET_CONFIG.constants && PET_CONFIG.constants.SUCCESS_MESSAGES) ? PET_CONFIG.constants.SUCCESS_MESSAGES.CENTERED : '已居中', 'success');
            await this.refreshStatus();
        }, { showNotification: true });

        this.setButtonLoading('centerPetBtn', false);
    }

    async resetPosition() {
        this.setButtonLoading('resetPositionBtn', true);

        await ErrorHandler.safeExecute(async () => {
            const response = await this.sendMessageToContentScript({ action: 'resetPosition' });
            if (!response || response.success === false) {
                const errorMsg = (PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES)
                    ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED
                    : '操作失败';
                throw new Error(errorMsg);
            }
            this.showNotification((PET_CONFIG.constants && PET_CONFIG.constants.SUCCESS_MESSAGES) ? PET_CONFIG.constants.SUCCESS_MESSAGES.POSITION_RESET : '位置已重置', 'success');
            await this.refreshStatus();
        }, { showNotification: true });

        this.setButtonLoading('resetPositionBtn', false);
    }

    async openQuickComment() {
        this.setButtonLoading('openQuickCommentBtn', true);

        await ErrorHandler.safeExecute(async () => {
            const response = await this.sendMessageToContentScript({ action: 'openQuickComment' });
            if (!response || response.success === false) {
                if (response && response.disabled) {
                    this.showNotification('快评功能已关闭', 'warn');
                    return;
                }
                const errorMsg = (PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES)
                    ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED
                    : '操作失败';
                throw new Error(errorMsg);
            }
            this.showNotification('快评已打开', 'success');
        }, { showNotification: true });

        this.setButtonLoading('openQuickCommentBtn', false);
    }

    async refreshStatus() {
        try {
            const response = await this.sendMessageToContentScript({ action: 'getStatus' });
            if (response && response.success !== false) {
                this.currentPetStatus.visible = response.visible !== undefined ? response.visible : this.currentPetStatus.visible;
                this.currentPetStatus.color = response.color !== undefined ? response.color : this.currentPetStatus.color;
                this.currentPetStatus.size = response.size !== undefined ? response.size : this.currentPetStatus.size;
                this.currentPetStatus.position = response.position || this.currentPetStatus.position;
                this.currentPetStatus.role = response.role || this.currentPetStatus.role || '教师';
                this.currentPetStatus.model = response.model !== undefined ? response.model : this.currentPetStatus.model;
                this.updateUI();
            }
        } catch (_) {}
    }

    setHintText(text) {
        const el = DomHelper.getElement('hintText');
        DomHelper.setText(el, text);
    }

    setControlsEnabled(enabled) {
        const main = DomHelper.getElement('mainContent');
        if (main) {
            if (enabled) main.classList.remove('popup-controls-disabled');
            else main.classList.add('popup-controls-disabled');
        }

        const ids = [
            'openChatBtn',
            'openQuickCommentBtn',
            'centerPetBtn',
            'resetPositionBtn',
            'visibilityToggle',
            'sizeSlider',
            'roleSelect',
            'colorSelect'
        ];

        ids.forEach((id) => {
            const el = DomHelper.getElement(id);
            if (!el) return;
            if ('disabled' in el) el.disabled = !enabled;
        });
    }
    
    /**
     * 更新状态指示器
     * 根据宠物的可见性状态更新状态指示器的文本和颜色
     */
    updateStatusIndicator() {
        const statusIndicator = DomHelper.getElement('statusIndicator');
        if (!statusIndicator) return;
        
        const statusText = DomHelper.querySelector(statusIndicator, '.status-text');

        if (statusText) {
            if (this.currentPetStatus.visible) {
                DomHelper.setText(statusText, '已激活');
                statusIndicator.style.setProperty('--status-dot-color', (PET_CONFIG.constants && PET_CONFIG.constants.UI) ? PET_CONFIG.constants.UI.STATUS_DOT_ACTIVE : '#4CAF50');
            } else {
                DomHelper.setText(statusText, '已隐藏');
                statusIndicator.style.setProperty('--status-dot-color', (PET_CONFIG.constants && PET_CONFIG.constants.UI) ? PET_CONFIG.constants.UI.STATUS_DOT_INACTIVE : '#FF9800');
            }
        }
    }
    
    /**
     * 发送消息到content script
     * @param {Object} message - 要发送的消息对象
     * @param {number} retries - 最大重试次数
     * @returns {Promise<Object|null>} 响应结果
     */
    async sendMessageToContentScript(message, retries = (PET_CONFIG.constants && PET_CONFIG.constants.RETRY) ? PET_CONFIG.constants.RETRY.MAX_RETRIES : 3) {
        if (!this.currentTab || !this.currentTab.id) {
            console.error('当前标签页无效');
            return null;
        }
        return await MessageHelper.sendToContentScript(this.currentTab.id, message, { maxRetries: retries });
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
                this.showNotification((PET_CONFIG.constants && PET_CONFIG.constants.SUCCESS_MESSAGES) ? PET_CONFIG.constants.SUCCESS_MESSAGES.COLOR_SET : '颜色主题已设置');
                this.updateUI();
                return { success: true };
            } else {
                const errorMsg = (PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) 
                    ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED 
                    : '操作失败';
                throw new Error(errorMsg);
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
                        if (namespace === 'local' && changes.petGlobalState) {
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
                    this.currentPetStatus.role = response.role || this.currentPetStatus.role || '教师';
                    this.currentPetStatus.model = response.model !== undefined ? response.model : this.currentPetStatus.model;
                    
                    // 更新UI
                    this.updateUI();
                }
            } catch (error) {
                // 静默处理同步错误，避免影响用户体验
                console.debug('状态同步失败:', error);
            }
        }, (PET_CONFIG.constants && PET_CONFIG.constants.TIMING) ? PET_CONFIG.constants.TIMING.STATUS_SYNC_INTERVAL : 5000);
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
        try {
            if (typeof NotificationUtils !== 'undefined' && typeof NotificationUtils.show === 'function') {
                const duration = (PET_CONFIG.constants && PET_CONFIG.constants.TIMING) ? PET_CONFIG.constants.TIMING.NOTIFICATION_DURATION : 3000;
                return NotificationUtils.show(message, type, {
                    duration,
                    baseClass: 'notification',
                    includePositionClass: false
                });
            }
        } catch (_) {}

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.top = `${(PET_CONFIG.constants && PET_CONFIG.constants.UI) ? PET_CONFIG.constants.UI.NOTIFICATION_TOP : 10}px`;

        if (document.body) {
            document.body.appendChild(notification);
        }

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, (PET_CONFIG.constants && PET_CONFIG.constants.TIMING) ? PET_CONFIG.constants.TIMING.NOTIFICATION_DURATION : 3000);
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
