
/**
 * Chrome扩展Content Script
 * 负责在网页中创建和管理宠物
 */

(function() {
    try {
        const keyName = 'petDevMode';
        const defaultEnabled = false;
        const original = {
            log: console.log,
            info: console.info,
            debug: console.debug,
            warn: console.warn
        };
        const muteIfNeeded = (enabled) => {
            if (enabled) return;
            const noop = () => {};
            console.log = noop;
            console.info = noop;
            console.debug = noop;
            console.warn = noop;
        };
        chrome.storage.sync.get([keyName], (res) => {
            const enabled = res[keyName];
            muteIfNeeded(typeof enabled === 'boolean' ? enabled : defaultEnabled);
        });
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'sync') return;
            if (changes[keyName]) {
                const enabled = changes[keyName].newValue;
                if (enabled) {
                    console.log = original.log;
                    console.info = original.info;
                    console.debug = original.debug;
                    console.warn = original.warn;
                } else {
                    const noop = () => {};
                    console.log = noop;
                    console.info = noop;
                    console.debug = noop;
                    console.warn = noop;
                }
            }
        });
    } catch (e) {}
})();

console.log('Content Script 加载');

// 检查PET_CONFIG是否可用
if (typeof PET_CONFIG === 'undefined') {
    console.error('PET_CONFIG未定义，尝试重新加载config.js');

    // 创建默认配置作为备用
    window.PET_CONFIG = {
        pet: {
            defaultSize: 180,
            defaultColorIndex: 0,
            defaultVisible: true,
            colors: [
                'linear-gradient(135deg, #ff6b6b, #ff8e8e)',
                'linear-gradient(135deg, #4ecdc4, #44a08d)',
                'linear-gradient(135deg, #ff9a9e, #fecfef)',
                'linear-gradient(135deg, #a8edea, #fed6e3)',
                'linear-gradient(135deg, #ffecd2, #fcb69f)'
            ],
            sizeLimits: { min: 80, max: 400 }
        },
        chatWindow: {
            defaultSize: { width: 700, height: 600 },
            sizeLimits: { minWidth: 300, maxWidth: 10000, minHeight: 200, maxHeight: 10000 },
            input: { maxLength: 200, placeholder: '输入消息...' },
            message: { maxLength: 1000, thinkingDelay: { min: 1000, max: 2000 } }
        },
        ui: {
            zIndex: {
                pet: 2147483647,
                chatWindow: 2147483648,
                resizeHandle: 20,
                inputContainer: 10
            }
        },
        storage: {
            keys: { globalState: 'petGlobalState' },
            syncInterval: 3000
        }
    };

    console.log('已创建默认PET_CONFIG配置');
}

// 添加默认工具函数
if (typeof getPetDefaultPosition === 'undefined') {
    window.getPetDefaultPosition = function() {
        return { x: 20, y: Math.round(window.innerHeight * 0.2) };
    };
}

if (typeof getChatWindowDefaultPosition === 'undefined') {
    window.getChatWindowDefaultPosition = function(width, height) {
        return {
            x: Math.max(0, (window.innerWidth - width) / 2),
            y: Math.round(window.innerHeight * 0.12)
        };
    };
}

if (typeof getCenterPosition === 'undefined') {
    window.getCenterPosition = function(elementSize, windowSize) {
        return Math.max(0, (windowSize - elementSize) / 2);
    };
}

class PetManager {
    constructor() {
        this.pet = null;
        this.isVisible = PET_CONFIG.pet.defaultVisible;
        this.colorIndex = PET_CONFIG.pet.defaultColorIndex;
        this.size = PET_CONFIG.pet.defaultSize;
        this.position = getPetDefaultPosition();
        this.chatWindow = null;
        this.isChatOpen = false;
        this.currentModel = PET_CONFIG.chatModels.default;

        this.colors = PET_CONFIG.pet.colors;
        this.mermaidLoaded = false;
        this.mermaidLoading = false;

        // 会话管理相关属性
        this.currentSessionId = null;
        this.sessions = {}; // 存储所有会话，key为sessionId，value为会话数据
        this.sessionSidebar = null; // 会话侧边栏元素
        this.isSwitchingSession = false; // 是否正在切换会话（防抖标志）
        this.currentPageUrl = null; // 当前页面URL，用于判断是否为新页面
        this.hasAutoCreatedSessionForPage = false; // 当前页面是否已经自动创建了会话
        this.sessionInitPending = false; // 会话初始化是否正在进行中
        this.sidebarWidth = 200; // 侧边栏宽度（像素）
        this.isResizingSidebar = false; // 是否正在调整侧边栏宽度
        
        // 会话更新优化相关
        this.sessionUpdateTimer = null; // 会话更新防抖定时器
        this.pendingSessionUpdate = false; // 是否有待处理的会话更新
        this.lastSessionSaveTime = 0; // 上次保存会话的时间
        this.SESSION_UPDATE_DEBOUNCE = 300; // 会话更新防抖时间（毫秒）
        this.SESSION_SAVE_THROTTLE = 1000; // 会话保存节流时间（毫秒）
        
        // 会话API管理器
        this.sessionApi = null;
        this.lastSessionListLoadTime = 0;
        this.SESSION_LIST_RELOAD_INTERVAL = 10000; // 会话列表重新加载间隔（10秒）

        this.init();
    }

    async init() {
        console.log('初始化宠物管理器');
        
        // 初始化会话API管理器
        if (typeof SessionApiManager !== 'undefined' && PET_CONFIG.api.syncSessionsToBackend) {
            this.sessionApi = new SessionApiManager(
                PET_CONFIG.api.yiaiBaseUrl,
                PET_CONFIG.api.syncSessionsToBackend
            );
            console.log('会话API管理器已初始化');
        } else {
            console.log('会话API管理器未启用');
        }
        
        this.loadState(); // 加载保存的状态
        this.setupMessageListener();
        this.createPet();
        // 启动定期同步，确保状态一致性
        this.startPeriodicSync();

        // 添加键盘快捷键支持
        this.setupKeyboardShortcuts();

        // 初始化会话：等待页面加载完成后1秒再创建新会话
        this.initSessionWithDelay();
        
        // 监听页面标题变化，以便在标题改变时更新会话
        this.setupTitleChangeListener();
        
        // 监听URL变化，以便在URL改变时创建新会话（支持单页应用）
        this.setupUrlChangeListener();
        
        // 监听会话列表变化，实现跨页面同步
        this.setupSessionSyncListener();
    }

    // 延迟初始化会话：等待页面加载完成后1秒再执行
    async initSessionWithDelay() {
        // 使用标志防止重复执行
        if (this.sessionInitPending) {
            return;
        }
        this.sessionInitPending = true;

        // 检查页面是否已经加载完成
        const isPageLoaded = document.readyState === 'complete';
        
        if (isPageLoaded) {
            // 页面已经加载完成，延迟1秒后初始化会话
            console.log('页面已加载完成，等待1秒后初始化会话');
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.initSession();
        } else {
            // 页面尚未加载完成，等待加载完成后再延迟1秒
            console.log('等待页面加载完成，然后延迟1秒后初始化会话');
            const handleLoad = async () => {
                // 移除事件监听器，避免重复执行
                window.removeEventListener('load', handleLoad);
                
                // 延迟1秒后初始化会话
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.initSession();
            };
            
            // 监听页面完全加载完成事件（包括所有资源）
            window.addEventListener('load', handleLoad);
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('收到消息:', request);

            switch (request.action) {
                case 'ping':
                    sendResponse({ success: true, message: 'pong' });
                    break;

                case 'initPet':
                    this.createPet();
                    sendResponse({ success: true });
                    break;

                case 'toggleVisibility':
                    this.toggleVisibility();
                    sendResponse({ success: true, visible: this.isVisible });
                    break;

                case 'changeColor':
                    this.changeColor();
                    sendResponse({ success: true, color: this.colorIndex });
                    break;

                case 'setColor':
                    this.setColor(request.color);
                    sendResponse({ success: true, color: this.colorIndex });
                    break;

                case 'changeSize':
                    this.setSize(request.size);
                    sendResponse({ success: true, size: this.size });
                    break;

                case 'resetPosition':
                    this.resetPosition();
                    sendResponse({ success: true });
                    break;

                case 'centerPet':
                    this.centerPet();
                    sendResponse({ success: true });
                    break;

                case 'setModel':
                    this.setModel(request.model);
                    sendResponse({ success: true, model: this.currentModel });
                    break;

                case 'getStatus':
                    sendResponse({
                        visible: this.isVisible,
                        color: this.colorIndex,
                        size: this.size,
                        position: this.position,
                        model: this.currentModel
                    });
                    break;

                case 'getFullPageText':
                    const text = this.getFullPageText();
                    sendResponse({ text: text });
                    break;

                case 'removePet':
                    this.removePet();
                    sendResponse({ success: true });
                    break;

                case 'globalStateUpdated':
                    this.handleGlobalStateUpdate(request.data);
                    sendResponse({ success: true });
                    break;

                case 'chatWithPet':
                    // 添加聊天动画效果
                    this.playChatAnimation();
                    // 异步处理
                    (async () => {
                        try {
                            const reply = await this.generatePetResponse(request.message);
                            sendResponse({ success: true, reply: reply });
                        } catch (error) {
                            console.error('生成回复失败:', error);
                            sendResponse({ success: false, error: error.message });
                        }
                    })();
                    return true; // 保持消息通道开放

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        });
    }

    createPet() {
        // 防止重复创建
        if (document.getElementById('minimal-pet')) {
            console.log('宠物已存在，跳过创建');
            return;
        }

        console.log('开始创建宠物...');

        // 创建宠物容器
        this.pet = document.createElement('div');
        this.pet.id = 'minimal-pet';
        this.updatePetStyle();

        // 使用 icon.png 作为宠物图标，不需要添加眼睛和嘴巴

        // 添加到页面
        this.addPetToPage();

        // 添加交互功能
        this.addInteractions();

        console.log('宠物创建成功！');
    }

    addPetToPage() {
        console.log('尝试添加宠物到页面...');
        console.log('document.body 存在:', !!document.body);
        console.log('document.readyState:', document.readyState);

        if (document.body) {
            console.log('直接添加到 body');
            document.body.appendChild(this.pet);
            console.log('宠物已添加到页面');
        } else {
            console.log('body 不存在，等待 DOMContentLoaded');
            // 如果body还没有加载，等待DOM加载完成
            document.addEventListener('DOMContentLoaded', () => {
                console.log('DOMContentLoaded 事件触发');
                if (document.body && this.pet) {
                    console.log('现在添加到 body');
                    document.body.appendChild(this.pet);
                    console.log('宠物已添加到页面（延迟）');
                } else {
                    console.log('DOMContentLoaded 后仍然无法添加宠物');
                }
            });
        }
    }

    updatePetStyle() {
        if (!this.pet) return;

        // 获取扩展的 URL
        const iconUrl = chrome.runtime.getURL('icons/icon.png');

        this.pet.style.cssText = `
            position: fixed !important;
            top: ${this.position.y}px !important;
            left: ${this.position.x}px !important;
            width: ${this.size}px !important;
            height: ${this.size}px !important;
            background: url(${iconUrl}) center/contain no-repeat !important;
            border-radius: 12px !important;
            z-index: ${PET_CONFIG.ui.zIndex.pet} !important;
            cursor: grab !important;
            pointer-events: auto !important;
            box-shadow: none !important;
            transition: all 0.3s ease !important;
            display: ${this.isVisible ? 'block' : 'none'} !important;
            background-color: transparent !important;
        `;
    }

    addInteractions() {
        if (!this.pet) return;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        this.pet.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = this.position.x;
            startTop = this.position.y;
            this.pet.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging && this.pet) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                this.position.x = Math.max(0, Math.min(window.innerWidth - this.size, startLeft + deltaX));
                this.position.y = Math.max(0, Math.min(window.innerHeight - this.size, startTop + deltaY));
                this.pet.style.left = this.position.x + 'px';
                this.pet.style.top = this.position.y + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            if (this.pet) {
                this.pet.style.cursor = 'grab';
                this.saveState(); // 拖拽结束后保存状态
                // 立即同步到全局状态
                this.syncToGlobalState();
            }
        });

        this.pet.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.pet.style.transform = 'scale(1.1)';
            setTimeout(() => {
                if (this.pet) {
                    this.pet.style.transform = 'scale(1)';
                }
            }, 150);

            // 切换聊天窗口
            this.toggleChatWindow();
        });
    }

    toggleVisibility() {
        this.isVisible = !this.isVisible;
        this.updatePetStyle();
        console.log('宠物可见性切换为:', this.isVisible);
    }

    changeColor() {
        this.colorIndex = (this.colorIndex + 1) % this.colors.length;
        this.updatePetStyle();
        this.updateChatWindowColor();
        console.log('宠物颜色切换为:', this.colorIndex);
    }

    setColor(colorIndex) {
        if (colorIndex >= 0 && colorIndex < this.colors.length) {
            this.colorIndex = colorIndex;
            this.updatePetStyle();
            this.updateChatWindowColor();
            this.saveState();
            this.syncToGlobalState();
            console.log('宠物颜色设置为:', this.colorIndex);
        }
    }

    setSize(size) {
        this.size = Math.max(PET_CONFIG.pet.sizeLimits.min, Math.min(PET_CONFIG.pet.sizeLimits.max, size));
        this.updatePetStyle();
        this.saveState();
        this.syncToGlobalState();
        console.log('宠物大小设置为:', this.size);
    }

    setModel(modelId) {
        if (PET_CONFIG.chatModels.models.some(m => m.id === modelId)) {
            this.currentModel = modelId;
            this.saveState();
            this.syncToGlobalState();
            this.updateChatModelSelector(); // 更新聊天窗口中的模型选择器
            console.log('聊天模型设置为:', modelId);
        } else {
            console.error('无效的模型ID:', modelId);
        }
    }

    resetPosition() {
        this.position = getPetDefaultPosition();
        this.updatePetStyle();
        this.saveState();
        this.syncToGlobalState();
        console.log('宠物位置已重置');
    }

    centerPet() {
        const centerX = getCenterPosition(this.size, window.innerWidth);
        const centerY = getCenterPosition(this.size, window.innerHeight);
        this.position = { x: centerX, y: centerY };
        this.updatePetStyle();
        this.saveState();
        this.syncToGlobalState();
        console.log('宠物已居中，位置:', this.position);
    }

    removePet() {
        if (this.pet && this.pet.parentNode) {
            this.pet.parentNode.removeChild(this.pet);
            this.pet = null;
            console.log('宠物已移除');
        }
    }

    saveState() {
        try {
            const state = {
                visible: this.isVisible,
                color: this.colorIndex,
                size: this.size,
                position: this.position,
                model: this.currentModel,
                timestamp: Date.now()
            };

            // 使用Chrome存储API保存全局状态
            chrome.storage.sync.set({ [PET_CONFIG.storage.keys.globalState]: state }, () => {
                console.log('宠物全局状态已保存:', state);
            });

            // 同时保存到localStorage作为备用
            localStorage.setItem('petState', JSON.stringify(state));
        } catch (error) {
            console.log('保存状态失败:', error);
        }
    }

    // 同步当前状态到全局状态
    syncToGlobalState() {
        try {
            const state = {
                visible: this.isVisible,
                color: this.colorIndex,
                size: this.size,
                position: this.position,
                model: this.currentModel,
                timestamp: Date.now()
            };

            chrome.storage.sync.set({ [PET_CONFIG.storage.keys.globalState]: state }, () => {
                console.log('状态已同步到全局:', state);
            });
        } catch (error) {
            console.log('同步到全局状态失败:', error);
        }
    }

    loadState() {
        try {
            // 首先尝试从Chrome存储API加载全局状态
            chrome.storage.sync.get([PET_CONFIG.storage.keys.globalState], (result) => {
                if (result[PET_CONFIG.storage.keys.globalState]) {
                    const state = result[PET_CONFIG.storage.keys.globalState];
                    this.isVisible = state.visible !== undefined ? state.visible : PET_CONFIG.pet.defaultVisible;
                    this.colorIndex = state.color !== undefined ? state.color : PET_CONFIG.pet.defaultColorIndex;

                    // 检查并迁移旧的大小值（从 60 升级到 180）
                    if (state.size && state.size < 100) {
                        // 旧版本的大小范围是 40-120，小于 100 的可能是旧版本
                        this.size = PET_CONFIG.pet.defaultSize;
                        // 更新存储中的值
                        const updatedState = { ...state, size: this.size };
                        chrome.storage.sync.set({ [PET_CONFIG.storage.keys.globalState]: updatedState }, () => {
                            console.log('已更新旧版本大小值到新默认值');
                        });
                    } else {
                        this.size = state.size !== undefined ? state.size : PET_CONFIG.pet.defaultSize;
                    }

                    this.currentModel = state.model !== undefined ? state.model : PET_CONFIG.chatModels.default;
                    // 位置也使用全局状态，但会进行边界检查
                    this.position = this.validatePosition(state.position || getPetDefaultPosition());
                    console.log('宠物全局状态已恢复:', state);

                    // 更新宠物样式
                    this.updatePetStyle();
                } else {
                    // 如果全局状态不存在，尝试从localStorage加载
                    this.loadStateFromLocalStorage();
                }
            });

            // 监听存储变化，实现跨页面同步
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'sync' && changes[PET_CONFIG.storage.keys.globalState]) {
                    const newState = changes[PET_CONFIG.storage.keys.globalState].newValue;
                    if (newState) {
                        this.isVisible = newState.visible !== undefined ? newState.visible : this.isVisible;
                        this.colorIndex = newState.color !== undefined ? newState.color : this.colorIndex;

                        // 检查并迁移旧的大小值
                        if (newState.size && newState.size < 100) {
                            // 旧版本的大小值，使用新默认值
                            this.size = PET_CONFIG.pet.defaultSize;
                        } else {
                            this.size = newState.size !== undefined ? newState.size : this.size;
                        }

                        this.currentModel = newState.model !== undefined ? newState.model : this.currentModel;
                        // 位置也进行跨页面同步，但会进行边界检查
                        if (newState.position) {
                            this.position = this.validatePosition(newState.position);
                        }
                        console.log('收到全局状态更新:', newState);
                        this.updatePetStyle();
                        this.updateChatModelSelector(); // 更新聊天窗口中的模型选择器
                    }
                }
            });

            return true;
        } catch (error) {
            console.log('恢复状态失败:', error);
            return this.loadStateFromLocalStorage();
        }
    }

    loadStateFromLocalStorage() {
        try {
            const savedState = localStorage.getItem('petState');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.isVisible = state.visible !== undefined ? state.visible : PET_CONFIG.pet.defaultVisible;
                this.colorIndex = state.color !== undefined ? state.color : PET_CONFIG.pet.defaultColorIndex;

                // 检查并迁移旧的大小值
                if (state.size && state.size < 100) {
                    this.size = PET_CONFIG.pet.defaultSize;
                } else {
                    this.size = state.size !== undefined ? state.size : PET_CONFIG.pet.defaultSize;
                }

                this.position = state.position || getPetDefaultPosition();
                console.log('宠物本地状态已恢复:', state);
                return true;
            }
        } catch (error) {
            console.log('恢复本地状态失败:', error);
        }
        return false;
    }

    handleGlobalStateUpdate(newState) {
        if (newState) {
            // 更新全局状态（颜色、大小、可见性、位置）
            this.isVisible = newState.visible !== undefined ? newState.visible : this.isVisible;
            this.colorIndex = newState.color !== undefined ? newState.color : this.colorIndex;

            // 检查并迁移旧的大小值
            if (newState.size && newState.size < 100) {
                this.size = PET_CONFIG.pet.defaultSize;
            } else {
                this.size = newState.size !== undefined ? newState.size : this.size;
            }

            // 位置也进行跨页面同步，但会进行边界检查
            if (newState.position) {
                this.position = this.validatePosition(newState.position);
            }

            console.log('处理全局状态更新:', newState);
            this.updatePetStyle();
        }
    }

    // 验证位置是否在当前窗口范围内
    validatePosition(position) {
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return getPetDefaultPosition();
        }

        const maxX = Math.max(0, window.innerWidth - this.size);
        const maxY = Math.max(0, window.innerHeight - this.size);

        return {
            x: Math.max(0, Math.min(maxX, position.x)),
            y: Math.max(0, Math.min(maxY, position.y))
        };
    }

    // 启动定期同步
    startPeriodicSync() {
        // 定期同步状态，确保跨页面一致性
        this.syncInterval = setInterval(() => {
            this.syncToGlobalState();
        }, PET_CONFIG.storage.syncInterval);

        // 监听窗口大小变化，重新验证位置
        window.addEventListener('resize', () => {
            this.position = this.validatePosition(this.position);
            this.updatePetStyle();
            this.syncToGlobalState();
        });
    }

    // 停止定期同步
    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // 设置键盘快捷键
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 检查是否按下了 F7 (截图快捷键)
            if (e.key === 'F7') {
                e.preventDefault();
                e.stopPropagation();
                console.log('检测到截图快捷键 F7');

                // 直接进行截图，不需要打开聊天窗口
                this.takeScreenshot();

                return false;
            }

            // 检查是否按下了 F8 (打开聊天窗口快捷键)
            if (e.key === 'F8') {
                e.preventDefault();
                e.stopPropagation();
                console.log('检测到聊天快捷键 F8');

                if (this.isChatOpen) {
                    this.closeChatWindow();
                } else {
                    this.openChatWindow();
                }
                return false;
            }

            // 检查是否按下了 Esc (关闭聊天窗口)
            if (e.key === 'Escape' && this.isChatOpen) {
                e.preventDefault();
                e.stopPropagation();
                this.closeChatWindow();
                return false;
            }
        }, true); // 使用捕获阶段，确保在其他处理之前执行

        console.log('键盘快捷键已设置：');
        console.log('  - F7：截图');
        console.log('  - F8：切换聊天窗口');
        console.log('  - Esc：关闭聊天窗口');
    }

    // 清理资源
    cleanup() {
        console.log('清理宠物管理器资源...');

        // 停止定期同步
        this.stopPeriodicSync();

        // 移除宠物
        this.removePet();

        // 关闭聊天窗口
        if (this.chatWindow) {
            this.closeChatWindow();
        }

        // 清理截图预览
        this.closeScreenshotPreview();

        console.log('资源清理完成');
    }

    // 计算两个文本的相似度（简化版）
    calculateSimilarity(text1, text2) {
        if (text1 === text2) return 1.0;
        if (text1.length === 0 || text2.length === 0) return 0;

        // 使用简单的字符匹配度
        const longer = text1.length > text2.length ? text1 : text2;
        const shorter = text1.length > text2.length ? text2 : text1;

        if (longer.length === 0) return 1.0;

        // 计算相同字符的数量
        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (longer.includes(shorter[i])) {
                matches++;
            }
        }

        return matches / longer.length;
    }

    // 获取页面的完整正文内容
    getFullPageText() {
        try {
            // 定义需要排除的选择器
            const excludeSelectors = [
                'script', 'style', 'nav', 'header', 'footer', 'aside',
                'noscript', 'iframe', 'embed', 'svg', 'canvas',
                '.ad', '.advertisement', '.ads', '.advertisement-container',
                '.sidebar', '.menu', '.navigation', '.navbar', '.nav',
                '.header', '.footer', '.comment', '.comments', '.social-share',
                '.related-posts', '.related', '.widget', '.sidebar-widget',
                '[class*="ad"]', '[class*="banner"]', '[class*="promo"]',
                '[id*="ad"]', '[id*="banner"]', '[id*="promo"]',
                'iframe', 'embed', 'object', 'form', 'button', 'input'
            ];

            // 定义主要正文内容选择器，按优先级顺序
            const contentSelectors = [
                'main',
                'article',
                '[role="main"]',
                '.content', '.main-content', '.page-content',
                '.post-content', '.entry-content', '.article-content',
                '.post-body', '.text-content', '.article-body',
                '#content', '#main-content', '#main',
                '.article', '.blog-post', '.entry', '.post',
                '.content-area', '.content-wrapper',
                '.text-wrapper', '.text-container'
            ];

            // 尝试从主要内容区域获取
            let mainContent = null;
            let foundSelector = '';
            for (const selector of contentSelectors) {
                mainContent = document.querySelector(selector);
                if (mainContent) {
                    foundSelector = selector;
                    console.log('找到主要内容区域:', selector);
                    break;
                }
            }

            // 如果找到了主要内容区域
            if (mainContent) {
                // 克隆内容以避免修改原始DOM
                const cloned = mainContent.cloneNode(true);

                // 移除不需要的元素
                excludeSelectors.forEach(sel => {
                    try {
                        const elements = cloned.querySelectorAll(sel);
                        elements.forEach(el => el.remove());
                    } catch (e) {
                        // 忽略无效的选择器
                    }
                });

                const textContent = cloned.textContent || cloned.innerText || '';
                const trimmedText = textContent.trim();

                // 如果内容足够长，返回
                if (trimmedText.length > 100) {
                    return trimmedText;
                }
            }

            // 如果没有足够的内容，获取页面中所有的文本段落
            const textElements = Array.from(document.querySelectorAll(
                'p, div, section, article, main, li, blockquote, ' +
                'h1, h2, h3, h4, h5, h6, span, pre, code, td, th, dd, dt, ' +
                'label, legend, caption, summary, details, address, time'
            ));

            const allTexts = textElements
                .map(el => (el.textContent || el.innerText || '').trim())
                .filter(text => {
                    // 进一步放宽文本长度要求：只要超过3个字符就保留
                    if (text.length < 3) return false;

                    // 只过滤明显的垃圾内容
                    const lowerText = text.toLowerCase();

                    // 只过滤最明显、最简短的无意义文本
                    if (text.length <= 5 &&
                        (lowerText === '更多' || lowerText === 'more' || lowerText === '点击')) {
                        return false;
                    }

                    return true;
                });

            // 去重并合并文本（使用更宽松的去重策略）
            const uniqueTexts = [];
            const seenTexts = new Set();

            for (const text of allTexts) {
                // 检查是否是确切的重复
                let isExactDuplicate = seenTexts.has(text);

                if (!isExactDuplicate) {
                    // 更宽松的去重：只在文本非常相似时视为重复
                    let isSimilar = false;
                    for (const seenText of seenTexts) {
                        // 只有当两个长文本几乎完全相同时才视为重复
                        if (text.length > 100 && seenText.length > 100) {
                            // 计算相似度：使用Levenshtein距离的简化版本
                            const similarity = calculateSimilarity(text, seenText);
                            if (similarity > 0.99) { // 99%以上相似才视为重复（几乎完全一致）
                                isSimilar = true;
                                break;
                            }
                        }
                    }

                    if (!isSimilar) {
                        seenTexts.add(text);
                        uniqueTexts.push(text);
                    }
                }
            }

            if (uniqueTexts.length > 0) {
                return uniqueTexts.join('\n\n').trim();
            }

            // 最后尝试从整个body获取
            const body = document.body;
            if (body) {
                const clonedBody = body.cloneNode(true);

                // 移除不需要的元素
                excludeSelectors.forEach(sel => {
                    try {
                        const elements = clonedBody.querySelectorAll(sel);
                        elements.forEach(el => el.remove());
                    } catch (e) {
                        // 忽略无效的选择器
                    }
                });

                const textContent = clonedBody.textContent || clonedBody.innerText || '';
                return textContent.trim();
            }

            return '';
        } catch (error) {
            console.error('获取页面内容时出错:', error);
            return '';
        }
    }

    // 获取页面内容并转换为 Markdown
    // 统一获取页面信息的方法：标题、描述、URL、内容
    getPageInfo() {
        const pageTitle = document.title || '未命名页面';
        const pageUrl = window.location.href;
        
        // 获取页面描述（meta description）
        const metaDescription = document.querySelector('meta[name="description"]');
        const pageDescription = metaDescription ? metaDescription.content.trim() : '';
        
        // 获取页面内容
        const pageContent = this.getPageContentAsMarkdown();
        
        return {
            title: pageTitle.trim(),
            url: pageUrl,
            description: pageDescription,
            content: pageContent
        };
    }

    getPageContentAsMarkdown() {
        try {
            // 检查 Turndown 是否可用
            if (typeof TurndownService === 'undefined') {
                console.warn('Turndown 未加载，返回纯文本内容');
                return this.getFullPageText();
            }

            // 定义需要排除的选择器
            const excludeSelectors = [
                'script', 'style', 'nav', 'header', 'footer', 'aside',
                'noscript', 'iframe', 'embed', 'svg', 'canvas',
                '.ad', '.advertisement', '.ads', '.advertisement-container',
                '.sidebar', '.menu', '.navigation', '.navbar', '.nav',
                '.header', '.footer', '.comment', '.comments', '.social-share',
                '.related-posts', '.related', '.widget', '.sidebar-widget',
                '[class*="ad"]', '[class*="banner"]', '[class*="promo"]',
                '[id*="ad"]', '[id*="banner"]', '[id*="promo"]',
                'iframe', 'embed', 'object', 'form', 'button', 'input'
            ];

            // 定义主要正文内容选择器
            const contentSelectors = [
                'main',
                'article',
                '[role="main"]',
                '.content', '.main-content', '.page-content',
                '.post-content', '.entry-content', '.article-content',
                '.post-body', '.text-content', '.article-body',
                '#content', '#main-content', '#main',
                '.article', '.blog-post', '.entry', '.post',
                '.content-area', '.content-wrapper',
                '.text-wrapper', '.text-container'
            ];

            // 尝试从主要内容区域获取
            let mainContent = null;
            for (const selector of contentSelectors) {
                mainContent = document.querySelector(selector);
                if (mainContent) break;
            }

            // 如果没有找到主要内容区域，使用body
            if (!mainContent) {
                mainContent = document.body;
            }

            // 克隆内容
            const cloned = mainContent.cloneNode(true);

            // 移除不需要的元素
            excludeSelectors.forEach(sel => {
                try {
                    const elements = cloned.querySelectorAll(sel);
                    elements.forEach(el => el.remove());
                } catch (e) {}
            });

            // 使用 Turndown 转换
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                bulletListMarker: '-',
                codeBlockStyle: 'fenced',
                fence: '```',
                emDelimiter: '*',
                strongDelimiter: '**',
                linkStyle: 'inlined',
                linkReferenceStyle: 'collapsed'
            });

            const markdown = turndownService.turndown(cloned);

            // 如果 Markdown 内容太短或为空，返回纯文本
            if (!markdown || markdown.trim().length < 100) {
                const textContent = cloned.textContent || cloned.innerText || '';
                return textContent.trim();
            }

            return markdown.trim();
        } catch (error) {
            console.error('转换为 Markdown 时出错:', error);
            // 出错时返回纯文本
            return this.getFullPageText();
        }
    }


    // 通用的流式响应处理方法
    async processStreamingResponse(response, onContent) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const message of messages) {
                if (message.startsWith('data: ')) {
                    try {
                        const dataStr = message.substring(6);
                        const chunk = JSON.parse(dataStr);

                        // 处理后端返回的上下文信息（Mem0 和 Qdrant 检索结果）
                        if (chunk.type === 'context_info') {
                            const contextData = chunk.data || {};
                            if (contextData.memories_count > 0 || contextData.chats_count > 0) {
                                console.log(`检索到 ${contextData.memories_count} 条记忆和 ${contextData.chats_count} 条聊天记录`);
                            }
                        }
                        // 处理后端返回的聊天保存成功事件，同步会话 ID
                        else if (chunk.type === 'chat_saved') {
                            const conversationId = chunk.conversation_id;
                            if (conversationId && !this.currentSessionId) {
                                // 如果当前没有会话 ID，使用后端返回的会话 ID
                                this.currentSessionId = conversationId;
                                console.log('从后端同步会话 ID:', conversationId);
                            } else if (conversationId && this.currentSessionId !== conversationId) {
                                // 如果后端返回的会话 ID 与当前不同，记录日志（但不强制更新，因为前端可能有自己的会话管理逻辑）
                                console.log('后端返回的会话 ID 与当前不同:', conversationId, 'vs', this.currentSessionId);
                            }
                        }
                        // 支持 Ollama 格式: chunk.message.content
                        else if (chunk.message && chunk.message.content) {
                            fullContent += chunk.message.content;
                            if (onContent) {
                                onContent(chunk.message.content, fullContent);
                            }
                        }
                        // 支持旧的自定义格式: data.type === 'content'
                        else if (chunk.type === 'content') {
                            fullContent += chunk.data;
                            if (onContent) {
                                onContent(chunk.data, fullContent);
                            }
                        }
                        // 检查是否完成
                        else if (chunk.done === true) {
                            console.log('流式响应完成');
                        }
                        // 处理错误
                        else if (chunk.type === 'error' || chunk.error) {
                            console.error('流式响应错误:', chunk.data || chunk.error);
                            throw new Error(chunk.data || chunk.error || '未知错误');
                        }
                    } catch (e) {
                        console.warn('解析 SSE 消息失败:', message, e);
                    }
                }
            }
        }

        // 处理最后的缓冲区消息
        if (buffer.trim()) {
            const message = buffer.trim();
            if (message.startsWith('data: ')) {
                try {
                    const chunk = JSON.parse(message.substring(6));
                    if (chunk.done === true || chunk.type === 'done') {
                        console.log('流式响应完成');
                    } else if (chunk.type === 'error' || chunk.error) {
                        throw new Error(chunk.data || chunk.error || '未知错误');
                    }
                } catch (e) {
                    console.warn('解析最后的 SSE 消息失败:', message, e);
                }
            }
        }

        return fullContent;
    }

    // 构建 prompt 请求 payload，自动包含会话 ID
    buildPromptPayload(fromSystem, fromUser, model = null, options = {}) {
        const payload = {
            fromSystem: fromSystem || '你是一个俏皮活泼、古灵精怪的小女友，聪明有趣，时而调侃时而贴心。语气活泼可爱，会开小玩笑，但也会关心用户。',
            fromUser: fromUser,
            save_chat: options.save_chat !== false, // 默认保存聊天记录
            use_memory: options.use_memory !== false, // 默认使用 Mem0
            use_vector_search: options.use_vector_search !== false, // 默认使用 Qdrant
        };
        
        // 添加模型名称（如果提供）
        if (model) {
            payload.model = model;
        } else if (this.currentModel) {
            payload.model = this.currentModel;
        }
        
        // 添加会话 ID（conversation_id）- 使用当前会话 ID
        if (this.currentSessionId) {
            payload.conversation_id = this.currentSessionId;
        }
        
        // 添加用户 ID（如果配置了）
        if (options.user_id) {
            payload.user_id = options.user_id;
        }
        
        // 添加其他选项
        if (options.memory_limit !== undefined) {
            payload.memory_limit = options.memory_limit;
        }
        if (options.vector_search_limit !== undefined) {
            payload.vector_search_limit = options.vector_search_limit;
        }
        if (options.images !== undefined) {
            payload.images = options.images;
        }
        
        return payload;
    }

    // 生成宠物响应（流式版本）
    async generatePetResponseStream(message, onContent, abortController = null) {
        try {
            // 检查开关状态
            let includeContext = true; // 默认包含上下文
            const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null;
            if (contextSwitch) {
                includeContext = contextSwitch.checked;
            }

            // 优先使用会话保存的页面内容，如果没有则使用当前页面内容
            let fullPageMarkdown = '';
            let pageTitle = document.title || '当前页面';
            
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                // 如果会话有保存的页面内容，使用它
                if (session.pageContent) {
                    fullPageMarkdown = session.pageContent;
                    pageTitle = session.pageTitle || pageTitle;
                } else {
                    // 如果没有保存的页面内容，获取当前页面内容并保存到会话
                    fullPageMarkdown = this.getPageContentAsMarkdown();
                    pageTitle = document.title || '当前页面';
                    session.pageContent = fullPageMarkdown;
                    session.pageTitle = pageTitle;
                    await this.saveAllSessions();
                }
            } else {
                // 如果没有当前会话，使用当前页面内容
                fullPageMarkdown = this.getPageContentAsMarkdown();
            }

            // 构建包含页面内容的完整消息
            const pageUrl = window.location.href;

            // 根据开关状态决定是否包含页面内容
            let userMessage = message;
            if (includeContext && fullPageMarkdown) {
                userMessage = `【当前页面上下文】\n页面标题：${pageTitle}\n页面内容（Markdown 格式）：\n${fullPageMarkdown}\n\n【用户问题】\n${message}`;
            }

            // 调用 API，使用配置中的 URL
            const apiUrl = PET_CONFIG.api.streamPromptUrl;

            // 使用统一的 payload 构建函数，自动包含会话 ID
            const payload = this.buildPromptPayload(
                '你是一个俏皮活泼、古灵精怪的小女友，聪明有趣，时而调侃时而贴心。语气活泼可爱，会开小玩笑，但也会关心用户。',
                userMessage,
                this.currentModel
            );
            
            const fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            };

            // 如果提供了 AbortController，添加 signal
            if (abortController) {
                fetchOptions.signal = abortController.signal;
            }

            const response = await fetch(apiUrl, fetchOptions);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // 读取流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';

            while (true) {
                // 检查是否已中止
                if (abortController && abortController.signal.aborted) {
                    reader.cancel();
                    throw new Error('请求已取消');
                }

                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                // 解码数据并添加到缓冲区
                buffer += decoder.decode(value, { stream: true });

                // 处理完整的 SSE 消息
                const messages = buffer.split('\n\n');
                buffer = messages.pop() || '';

                for (const message of messages) {
                    if (message.startsWith('data: ')) {
                        try {
                            const dataStr = message.substring(6);
                            const chunk = JSON.parse(dataStr);

                            // 处理后端返回的上下文信息（Mem0 和 Qdrant 检索结果）
                            if (chunk.type === 'context_info') {
                                const contextData = chunk.data || {};
                                if (contextData.memories_count > 0 || contextData.chats_count > 0) {
                                    console.log(`检索到 ${contextData.memories_count} 条记忆和 ${contextData.chats_count} 条聊天记录`);
                                }
                            }
                            // 处理后端返回的聊天保存成功事件，同步会话 ID
                            else if (chunk.type === 'chat_saved') {
                                const conversationId = chunk.conversation_id;
                                if (conversationId && !this.currentSessionId) {
                                    // 如果当前没有会话 ID，使用后端返回的会话 ID
                                    this.currentSessionId = conversationId;
                                    console.log('从后端同步会话 ID:', conversationId);
                                } else if (conversationId && this.currentSessionId !== conversationId) {
                                    // 如果后端返回的会话 ID 与当前不同，记录日志（但不强制更新，因为前端可能有自己的会话管理逻辑）
                                    console.log('后端返回的会话 ID 与当前不同:', conversationId, 'vs', this.currentSessionId);
                                }
                            }
                            // 支持 Ollama 格式: chunk.message.content
                            else if (chunk.message && chunk.message.content) {
                                fullContent += chunk.message.content;
                                if (onContent) {
                                    onContent(chunk.message.content, fullContent);
                                }
                            }
                            // 支持旧的自定义格式: data.type === 'content'
                            else if (chunk.type === 'content') {
                                fullContent += chunk.data;
                                if (onContent) {
                                    onContent(chunk.data, fullContent);
                                }
                            }
                            // 检查是否完成
                            else if (chunk.done === true) {
                                console.log('流式响应完成');
                            }
                            // 处理错误
                            else if (chunk.type === 'error' || chunk.error) {
                                console.error('流式响应错误:', chunk.data || chunk.error);
                                throw new Error(chunk.data || chunk.error || '未知错误');
                            }
                        } catch (e) {
                            console.warn('解析 SSE 消息失败:', message, e);
                        }
                    }
                }
            }

            // 处理最后的缓冲区消息
            if (buffer.trim()) {
                const message = buffer.trim();
                if (message.startsWith('data: ')) {
                    try {
                        const chunk = JSON.parse(message.substring(6));
                        if (chunk.done === true || chunk.type === 'done') {
                            console.log('流式响应完成');
                        } else if (chunk.type === 'error' || chunk.error) {
                            throw new Error(chunk.data || chunk.error || '未知错误');
                        }
                    } catch (e) {
                        console.warn('解析最后的 SSE 消息失败:', message, e);
                    }
                }
            }

            return fullContent;
        } catch (error) {
            // 如果是中止错误，不记录为错误
            if (error.name === 'AbortError' || error.message === '请求已取消') {
                console.log('请求已取消');
                throw error;
            }
            console.error('API 调用失败:', error);
            throw error;
        }
    }

    // 生成宠物响应
    async generatePetResponse(message) {
        try {
            // 检查开关状态
            let includeContext = true; // 默认包含上下文
            const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null;
            if (contextSwitch) {
                includeContext = contextSwitch.checked;
            }

            // 优先使用会话保存的页面内容，如果没有则使用当前页面内容
            let fullPageMarkdown = '';
            let pageTitle = document.title || '当前页面';
            
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                // 如果会话有保存的页面内容，使用它
                if (session.pageContent) {
                    fullPageMarkdown = session.pageContent;
                    pageTitle = session.pageTitle || pageTitle;
                } else {
                    // 如果没有保存的页面内容，获取当前页面内容并保存到会话
                    fullPageMarkdown = this.getPageContentAsMarkdown();
                    pageTitle = document.title || '当前页面';
                    session.pageContent = fullPageMarkdown;
                    session.pageTitle = pageTitle;
                    await this.saveAllSessions();
                }
            } else {
                // 如果没有当前会话，使用当前页面内容
                fullPageMarkdown = this.getPageContentAsMarkdown();
            }

            // 构建包含页面内容的完整消息
            // 根据开关状态决定是否包含页面内容
            let userMessage = message;
            if (includeContext && fullPageMarkdown) {
                userMessage = `【当前页面上下文】\n页面标题：${pageTitle}\n页面内容（Markdown 格式）：\n${fullPageMarkdown}\n\n【用户问题】\n${message}`;
            }

            // 使用统一的 payload 构建函数，自动包含会话 ID
            const payload = this.buildPromptPayload(
                '你是一个俏皮活泼、古灵精怪的小女友，聪明有趣，时而调侃时而贴心。语气活泼可爱，会开小玩笑，但也会关心用户。',
                userMessage
            );
            
            // 调用 API，使用配置中的 URL
            const response = await fetch(PET_CONFIG.api.promptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            // 适配新的响应格式: {status, msg, data, pagination}
            if (result.status === 200 && result.data) {
                // 成功响应，提取 data 字段
                return result.data;
            } else if (result.status !== 200) {
                // API 返回错误，使用 msg 字段
                return result.msg || '抱歉，服务器返回了错误。';
            } else if (result.content) {
                return result.content;
            } else if (result.message) {
                return result.message;
            } else if (typeof result === 'string') {
                return result;
            } else {
                // 未知格式，尝试提取可能的文本内容
                return JSON.stringify(result);
            }
        } catch (error) {
            console.error('API 调用失败:', error);
            // 如果 API 调用失败，返回默认响应
            return '抱歉，我现在无法连接到服务器。请稍后再试。😔';
        }
    }

    // 获取随机响应
    getRandomResponse(responses) {
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // 切换聊天窗口
    toggleChatWindow() {
        if (this.isChatOpen) {
            this.closeChatWindow();
        } else {
            this.openChatWindow();
        }
    }

    // 打开聊天窗口
    async openChatWindow() {
        if (this.chatWindow) {
            this.chatWindow.style.display = 'block';
            this.isChatOpen = true;

            // 初始化会话
            await this.initSession();

            // 重新初始化滚动功能
            this.initializeChatScroll();

            // 更新模型选择器显示
            this.updateChatModelSelector();

            // 更新聊天窗口颜色
            this.updateChatWindowColor();
            
            // 更新聊天窗口标题（显示当前会话名称）
            this.updateChatHeaderTitle();
            
            // 确保会话侧边栏已更新（如果侧边栏已创建）
            if (this.sessionSidebar) {
                await this.loadAllSessions(); // 确保数据已加载
                await this.updateSessionSidebar();
            }
            
            return;
        }

        // 初始化聊天窗口状态（先设置默认值）
        const defaultSize = PET_CONFIG.chatWindow.defaultSize;
        const defaultPosition = getChatWindowDefaultPosition(defaultSize.width, defaultSize.height);

        this.chatWindowState = {
            x: defaultPosition.x,
            y: defaultPosition.y,
            width: defaultSize.width,
            height: defaultSize.height,
            isDragging: false,
            isResizing: false,
            resizeType: 'bottom-right', // 默认缩放类型
            dragStart: { x: 0, y: 0 },
            resizeStart: { x: 0, y: 0, width: 0, height: 0 }
        };

        // 尝试加载保存的聊天窗口状态（会覆盖默认值）
        // 加载完成后创建窗口
        this.loadChatWindowState(async (success) => {
            if (success) {
                console.log('聊天窗口状态已加载，创建窗口');
            } else {
                console.log('使用默认聊天窗口状态，创建窗口');
            }

            // 初始化会话
            await this.initSession();

            await this.createChatWindow();
            this.isChatOpen = true;
            
            // 更新聊天窗口标题（显示当前会话名称）
            this.updateChatHeaderTitle();
        });
    }

    // 关闭聊天窗口
    closeChatWindow() {
        if (this.chatWindow) {
            // 保存当前会话
            this.saveCurrentSession();
            this.chatWindow.style.display = 'none';
            this.isChatOpen = false;
        }
    }

    // 会话管理方法
    // 获取当前会话ID（基于网页标题）
    // 基于URL生成会话ID，确保每个URL对应唯一会话
    getCurrentSessionId() {
        const currentUrl = window.location.href;
        // 使用URL作为会话ID的基础，如果URL过长则使用hash
        // 为了保持向后兼容和唯一性，我们使用generateSessionId，但在initSession中通过URL查找
        return currentUrl;
    }

    // 生成唯一会话ID
    generateSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        return `session_${timestamp}_${random}`;
    }

    // 检查并修复会话数据一致性
    ensureSessionConsistency(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            return false;
        }

        const session = this.sessions[sessionId];
        const pageInfo = this.getPageInfo();
        
        // 关键检查：只有当会话URL和当前页面URL匹配时，才更新一致性
        // 这样可以防止修改不同URL的会话数据
        if (session.url !== pageInfo.url) {
            console.log(`确保会话一致性 ${sessionId}：URL不匹配，跳过更新。会话URL: ${session.url}, 当前页面URL: ${pageInfo.url}`);
            return false; // URL不匹配，不更新，保持数据隔离
        }
        
        let updated = false;

        // 确保URL一致
        if (session.url !== pageInfo.url) {
            console.log(`修复会话 ${sessionId} 的URL不一致:`, session.url, '->', pageInfo.url);
            session.url = pageInfo.url;
            updated = true;
        }

        // 确保标题一致（用于显示）
        if (session.title !== pageInfo.title) {
            console.log(`修复会话 ${sessionId} 的标题不一致:`, session.title, '->', pageInfo.title);
            session.title = pageInfo.title;
            updated = true;
        }

        // 确保页面标题一致
        if (session.pageTitle !== pageInfo.title) {
            console.log(`修复会话 ${sessionId} 的页面标题不一致:`, session.pageTitle, '->', pageInfo.title);
            session.pageTitle = pageInfo.title;
            updated = true;
        }

        // 确保页面描述一致
        const pageDescription = pageInfo.description || '';
        if (session.pageDescription !== pageDescription) {
            console.log(`修复会话 ${sessionId} 的页面描述不一致`);
            session.pageDescription = pageDescription;
            updated = true;
        }

        // 确保页面内容存在（如果缺失则补充）
        if (!session.pageContent || session.pageContent.trim() === '') {
            console.log(`补充会话 ${sessionId} 的页面内容`);
            session.pageContent = pageInfo.content;
            updated = true;
        }

        // 确保messages数组存在
        if (!Array.isArray(session.messages)) {
            console.log(`修复会话 ${sessionId} 的消息数组`);
            session.messages = [];
            updated = true;
        }

        // 确保时间戳存在
        if (!session.createdAt) {
            session.createdAt = Date.now();
            updated = true;
        }
        if (!session.updatedAt) {
            session.updatedAt = Date.now();
            updated = true;
        }
        
        // 确保最后访问时间存在并更新（节流：至少间隔1分钟）
        const now = Date.now();
        if (!session.lastAccessTime || (now - session.lastAccessTime) > 60000) {
            session.lastAccessTime = now;
            updated = true;
        }

        return updated;
    }

    // 创建标准化的会话对象
    // 每个会话都会保存以下信息：
    // - 网页标题（title, pageTitle）：用于显示和识别
    // - 网页描述（pageDescription）：meta description 信息
    // - 网页网址（url）：用于唯一标识会话，作为会话ID的基础
    // - 网页上下文（pageContent）：页面的完整Markdown内容，用于AI理解页面上下文
    // - 聊天记录（messages）：该会话的所有聊天消息
    // - 时间戳（createdAt, updatedAt, lastAccessTime）：用于排序和管理
    createSessionObject(sessionId, pageInfo, existingSession = null) {
        const now = Date.now();
        
        // 如果是已有会话，保留消息和创建时间
        const messages = existingSession?.messages || [];
        const createdAt = existingSession?.createdAt || now;
        const lastAccessTime = now; // 每次创建或更新时都更新访问时间
        
        return {
            id: sessionId, // 会话ID（基于URL生成）
            title: pageInfo.title, // 显示名称（使用页面标题）
            url: pageInfo.url, // 页面URL（用于查找会话，作为会话的唯一标识）
            pageTitle: pageInfo.title, // 页面标题（与页面上下文对应）
            pageDescription: pageInfo.description || '', // 页面描述（meta description）
            pageContent: pageInfo.content || '', // 页面内容（Markdown格式，用于AI理解上下文）
            messages: messages, // 聊天记录（该会话的所有对话）
            createdAt: createdAt, // 创建时间
            updatedAt: now, // 更新时间
            lastAccessTime: lastAccessTime // 最后访问时间
        };
    }

    // ==================== 会话管理辅助方法 ====================
    
    // 根据URL查找会话
    findSessionByUrl(url) {
        return Object.values(this.sessions).find(session => session.url === url) || null;
    }
    
    // 生成会话ID（如果URL过长则使用hash）
    async generateSessionId(url) {
        if (url.length <= 200) {
            return url;
        }
        const hash = await this.hashString(url);
        return `session_${hash}`;
    }
    
    // 更新会话页面信息（保持消息不变，但更新所有页面信息：标题、描述、网址、上下文）
    // 重要：只有当会话URL和页面URL匹配时，才更新页面信息，确保数据隔离
    updateSessionPageInfo(sessionId, pageInfo) {
        if (!this.sessions[sessionId]) return false;
        
        const session = this.sessions[sessionId];
        
        // 关键检查：只有当会话URL和页面URL匹配时，才更新页面信息
        // 这样可以防止意外修改不同URL的会话数据
        if (session.url !== pageInfo.url) {
            console.log(`更新会话页面信息 ${sessionId}：URL不匹配，跳过更新。会话URL: ${session.url}, 页面URL: ${pageInfo.url}`);
            return false; // URL不匹配，不更新，保持数据隔离
        }
        
        const sessionData = this.createSessionObject(sessionId, pageInfo, session);
        const now = Date.now();
        
        // 更新所有页面相关信息，保留消息和其他会话数据
        Object.assign(session, {
            title: sessionData.title,
            url: sessionData.url,
            pageTitle: sessionData.pageTitle,
            pageDescription: sessionData.pageDescription || '',
            pageContent: sessionData.pageContent || session.pageContent || '', // 保留已有内容，但如果缺失则补充
            updatedAt: sessionData.updatedAt,
            lastAccessTime: now // 更新最后访问时间
        });
        
        return true;
    }
    
    // 统一更新UI（侧边栏、标题等）
    async updateSessionUI(options = {}) {
        const { 
            updateSidebar = true, 
            updateTitle = true, 
            loadMessages = false,
            highlightSessionId = null 
        } = options;
        
        if (updateSidebar && this.sessionSidebar) {
            await this.updateSessionSidebar();
        }
        
        if (updateTitle) {
            this.updateChatHeaderTitle();
        }
        
        if (loadMessages && this.chatWindow && this.isChatOpen) {
            await this.loadSessionMessages();
            
            // 高亮显示新会话
            if (highlightSessionId) {
                setTimeout(() => {
                    const sessionItem = this.sessionSidebar?.querySelector(`[data-session-id="${highlightSessionId}"]`);
                    if (sessionItem) {
                        sessionItem.classList.add('new-session-highlight');
                        setTimeout(() => {
                            sessionItem.classList.remove('new-session-highlight');
                        }, 1500);
                    }
                }, 100);
            }
        }
    }
    
    // 切换到会话（统一入口）
    // 重要：确保数据隔离，切换到不同URL的会话时，不会更新该会话的页面信息
    async activateSession(sessionId, options = {}) {
        const { 
            saveCurrent = true,
            updateConsistency = true,
            updateUI = true 
        } = options;
        
        // 在切换会话前，强制保存当前会话的所有数据（确保数据持久化）
        if (saveCurrent && this.currentSessionId && this.currentSessionId !== sessionId) {
            await this.saveCurrentSession(true); // 强制保存，确保数据不丢失
        }
        
        // 切换到目标会话
        const targetSession = this.sessions[sessionId];
        if (!targetSession) {
            console.error('目标会话不存在:', sessionId);
            return;
        }
        
        this.currentSessionId = sessionId;
        this.currentPageUrl = targetSession.url || null;
        
        // 检查当前页面URL和目标会话URL是否匹配
        const pageInfo = this.getPageInfo();
        const isUrlMatched = targetSession.url === pageInfo.url;
        
        // 只有当URL匹配时，才标记为当前页面的会话
        // 如果URL不匹配（例如用户切换到其他页面的会话），不标记为自动创建
        this.hasAutoCreatedSessionForPage = isUrlMatched;
        
        // 更新会话一致性（只有在URL匹配时才更新，确保数据隔离）
        if (updateConsistency && isUrlMatched) {
            // 只有当目标会话的URL和当前页面URL匹配时，才更新一致性
            // 这样可以防止切换到不同URL的会话时，意外修改那个会话的页面信息
            const needsUpdate = this.ensureSessionConsistency(sessionId);
            if (needsUpdate) {
                await this.saveAllSessions();
            }
        } else if (!isUrlMatched) {
            // URL不匹配时，只更新最后访问时间，不更新页面信息（保持数据隔离）
            console.log(`切换到会话 ${sessionId}：URL不匹配，不更新页面信息。会话URL: ${targetSession.url}, 当前页面URL: ${pageInfo.url}`);
            const now = Date.now();
            if (!targetSession.lastAccessTime || (now - targetSession.lastAccessTime) > 60000) {
                targetSession.lastAccessTime = now;
                await this.saveAllSessions();
            }
        }
        
        // 更新UI
        if (updateUI) {
            await this.updateSessionUI({
                updateSidebar: true,
                updateTitle: true,
                loadMessages: this.isChatOpen
            });
        }
    }
    
    // 辅助方法：生成字符串的hash值
    async hashString(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        // 返回前16个字符作为会话ID的一部分
        return hashHex.substring(0, 16);
    }

    // 初始化或恢复会话 - 基于URL创建唯一会话，确保每个会话与页面上下文一一对应
    async initSession() {
        const pageInfo = this.getPageInfo();
        const currentUrl = pageInfo.url;
        const isSamePage = this.currentPageUrl === currentUrl;
        
        // 加载所有会话数据
        await this.loadAllSessions();
        
        // 处理同一页面的情况：如果已选中会话，只更新一致性
        if (isSamePage && this.hasAutoCreatedSessionForPage && this.currentSessionId) {
            if (this.sessions[this.currentSessionId]) {
                const needsUpdate = this.ensureSessionConsistency(this.currentSessionId);
                if (needsUpdate) {
                    await this.saveAllSessions();
                    await this.updateSessionUI({ updateTitle: true });
                } else {
                    // 更新访问时间（节流）
                    const session = this.sessions[this.currentSessionId];
                    const now = Date.now();
                    if (!session.lastAccessTime || (now - session.lastAccessTime) > 60000) {
                        session.lastAccessTime = now;
                    }
                }
                await this.updateSessionUI({ updateSidebar: true });
            }
            return this.currentSessionId;
        }
        
        // 处理新页面的情况
        if (!isSamePage) {
            this.currentPageUrl = currentUrl;
            this.hasAutoCreatedSessionForPage = false;
        }
        
        // 保存当前会话（如果切换到不同页面）
        if (this.currentSessionId) {
            await this.saveCurrentSession();
        }
        
        // 使用URL生成会话ID
        const sessionId = await this.generateSessionId(currentUrl);
        
        // 查找是否存在该会话ID的会话
        let existingSession = this.sessions[sessionId];
        
        if (existingSession) {
            // 更新会话页面信息
            this.updateSessionPageInfo(sessionId, pageInfo);
            await this.saveAllSessions();
            
            // 自动选中匹配的会话
            await this.activateSession(sessionId, {
                saveCurrent: false, // 已经在前面保存了
                updateConsistency: true,
                updateUI: true
            });
            
            console.log('找到基于URL的已有会话，已自动选中:', sessionId);
            return sessionId;
        } else {
            // 没有找到会话，使用URL作为会话ID自动创建新会话
            const newSession = this.createSessionObject(sessionId, pageInfo);
            this.sessions[sessionId] = newSession;
            await this.saveAllSessions();
            
            // 自动激活新创建的会话
            await this.activateSession(sessionId, {
                saveCurrent: false, // 已经在前面保存了
                updateConsistency: true,
                updateUI: true
            });
            
            console.log('使用URL作为会话ID，已自动创建新会话:', sessionId, 'URL:', currentUrl);
            
            return sessionId;
        }
    }

    // 设置页面标题变化监听（带防抖优化）
    setupTitleChangeListener() {
        let titleUpdateTimer = null;
        let lastTitle = document.title;
        
        // 防抖的会话更新函数
        const debouncedUpdateSession = () => {
            if (titleUpdateTimer) {
                clearTimeout(titleUpdateTimer);
            }
            titleUpdateTimer = setTimeout(() => {
                this.initSession();
            }, this.SESSION_UPDATE_DEBOUNCE);
        };
        
        // 使用 MutationObserver 监听标题变化
        const titleObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    const currentTitle = document.title;
                    // 只有标题真的变化了才触发更新
                    if (currentTitle !== lastTitle) {
                        lastTitle = currentTitle;
                        debouncedUpdateSession();
                    }
                }
            });
        });

        // 观察 title 元素的变化
        const titleElement = document.querySelector('title');
        if (titleElement) {
            titleObserver.observe(titleElement, {
                childList: true,
                characterData: true,
                subtree: true
            });
        }

        // 也监听 document.title 的直接变化（某些动态页面会直接修改）
        // 使用更长的检查间隔，减少不必要的检查
        setInterval(() => {
            const currentTitle = document.title;
            if (currentTitle !== lastTitle) {
                lastTitle = currentTitle;
                debouncedUpdateSession();
            }
        }, 2000); // 每2秒检查一次标题变化（降低频率）
    }

    // 设置URL变化监听，用于单页应用（SPA）的路由变化（带防抖优化）
    setupUrlChangeListener() {
        let lastUrl = window.location.href;
        let urlUpdateTimer = null;
        const self = this;
        
        // 防抖的会话更新函数
        const debouncedUpdateSession = (reason = '') => {
            if (urlUpdateTimer) {
                clearTimeout(urlUpdateTimer);
            }
            urlUpdateTimer = setTimeout(() => {
                self.initSession();
            }, self.SESSION_UPDATE_DEBOUNCE);
        };
        
        // 监听popstate事件（浏览器前进/后退）
        window.addEventListener('popstate', () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('检测到URL变化（popstate）:', lastUrl, '->', currentUrl);
                lastUrl = currentUrl;
                debouncedUpdateSession('popstate');
            }
        });
        
        // 监听pushState和replaceState（单页应用路由变化）
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('检测到URL变化（pushState）:', lastUrl, '->', currentUrl);
                lastUrl = currentUrl;
                // 延迟执行，确保页面已更新，并使用防抖
                setTimeout(() => {
                    debouncedUpdateSession('pushState');
                }, 100);
            }
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('检测到URL变化（replaceState）:', lastUrl, '->', currentUrl);
                lastUrl = currentUrl;
                // 延迟执行，确保页面已更新，并使用防抖
                setTimeout(() => {
                    debouncedUpdateSession('replaceState');
                }, 100);
            }
        };
        
        // 定期检查URL变化（作为备用方案，防止某些边缘情况）
        // 降低检查频率，减少性能开销
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('检测到URL变化（定期检查）:', lastUrl, '->', currentUrl);
                lastUrl = currentUrl;
                debouncedUpdateSession('periodic');
            }
        }, 3000); // 每3秒检查一次（降低频率）
    }

    // 设置会话列表同步监听器，实现跨页面同步
    setupSessionSyncListener() {
        // 防止重复添加监听器
        if (this.sessionSyncListener) {
            return;
        }

        // 创建会话同步监听器
        this.sessionSyncListener = (changes, namespace) => {
            // 只监听 local 存储中的会话数据变化
            if (namespace === 'local' && changes.petChatSessions) {
                const newSessions = changes.petChatSessions.newValue;
                const oldSessions = changes.petChatSessions.oldValue || {};
                
                console.log('检测到会话列表变化，同步更新...');
                
                // 确保 this.sessions 已初始化
                if (!this.sessions) {
                    this.sessions = {};
                }
                
                // 检查是否是其他页面的变化（避免自身触发无限循环）
                // 注意：Chrome 的 onChanged 事件通常不会在同一个页面修改时触发
                // 但为了健壮性，我们仍然进行比较
                const currentSessionsStr = JSON.stringify(this.sessions);
                const newSessionsStr = JSON.stringify(newSessions || {});
                const sessionsChanged = currentSessionsStr !== newSessionsStr;
                
                if (sessionsChanged) {
                    // 保存当前会话的ID，以便切换后恢复
                    const previousSessionId = this.currentSessionId;
                    
                    // 更新会话数据
                    this.sessions = newSessions || {};
                    
                    // 如果之前的会话已被删除，需要切换到另一个会话
                    if (previousSessionId && !this.sessions[previousSessionId]) {
                        console.log('当前会话已被删除，切换到最近访问的会话');
                        // 使用 lastAccessTime 查找最近访问的会话（更合理）
                        // 如果没有 lastAccessTime，则使用 createdAt 作为备选
                        const sortedSessions = Object.values(this.sessions).sort((a, b) => {
                            const aTime = a.lastAccessTime || a.createdAt || 0;
                            const bTime = b.lastAccessTime || b.createdAt || 0;
                            return bTime - aTime; // 最近访问的在前
                        });
                        
                        if (sortedSessions.length > 0) {
                            this.currentSessionId = sortedSessions[0].id;
                            // 如果聊天窗口已打开，加载新会话的消息
                            if (this.chatWindow && this.isChatOpen) {
                                this.loadSessionMessages();
                            }
                        } else {
                            // 没有其他会话了，清除当前会话ID
                            this.currentSessionId = null;
                            if (this.chatWindow && this.isChatOpen) {
                                const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
                                if (messagesContainer) {
                                    messagesContainer.innerHTML = '';
                                }
                            }
                        }
                    } else if (previousSessionId && this.sessions[previousSessionId]) {
                        // 如果当前会话仍然存在，检查消息是否有更新
                        // 比较更新时间，如果新会话的更新时间更新，则重新加载消息
                        const newSessionData = this.sessions[previousSessionId];
                        const oldSessionData = oldSessions[previousSessionId];
                        
                        if (!oldSessionData || (newSessionData.updatedAt || 0) > (oldSessionData.updatedAt || 0)) {
                            // 会话消息已更新，重新加载
                            if (this.chatWindow && this.isChatOpen) {
                                this.loadSessionMessages();
                            }
                        }
                    }
                    
                    // 更新会话侧边栏
                    if (this.sessionSidebar) {
                        // 在同步回调中异步调用，不阻塞
                        this.updateSessionSidebar().catch(err => {
                            console.warn('更新会话侧边栏失败:', err);
                        });
                    }
                    
                    console.log('会话列表已同步，当前会话数量:', Object.keys(this.sessions).length);
                }
            }
        };

        // 添加监听器
        chrome.storage.onChanged.addListener(this.sessionSyncListener);
        console.log('会话列表同步监听器已设置');
    }

    // 从后端加载会话列表（使用API管理器）
    async loadSessionsFromBackend(forceRefresh = false) {
        try {
            // 使用新的API管理器
            if (this.sessionApi) {
                console.log('使用API管理器加载会话列表...');
                const backendSessions = await this.sessionApi.getSessionsList({ forceRefresh });
                
                // 合并后端数据到本地 sessions
                if (!this.sessions) {
                    this.sessions = {};
                }
                
                // 对于每个后端会话，如果没有消息但message_count>0，获取完整数据
                const sessionsToFetch = [];
                const backendSessionsMap = {};
                
                backendSessions.forEach(backendSession => {
                    const sessionId = backendSession.id || backendSession.conversation_id;
                    if (!sessionId) return;
                    
                    const localSession = {
                        id: sessionId,
                        url: backendSession.url || '',
                        title: backendSession.title || '',
                        pageTitle: backendSession.pageTitle || '',
                        pageDescription: backendSession.pageDescription || '',
                        pageContent: backendSession.pageContent || '',
                        messages: backendSession.messages || [],
                        createdAt: backendSession.createdAt || Date.now(),
                        updatedAt: backendSession.updatedAt || Date.now(),
                        lastAccessTime: backendSession.lastAccessTime || Date.now()
                    };
                    
                    const messageCount = backendSession.message_count || 0;
                    if ((!localSession.messages || localSession.messages.length === 0) && messageCount > 0) {
                        sessionsToFetch.push(sessionId);
                    }
                    
                    backendSessionsMap[sessionId] = localSession;
                });
                
                // 获取需要完整数据的会话
                if (sessionsToFetch.length > 0) {
                    await Promise.all(sessionsToFetch.map(async (sessionId) => {
                        try {
                            const fullSession = await this.sessionApi.getSession(sessionId);
                            if (fullSession && backendSessionsMap[sessionId]) {
                                if (fullSession.messages && Array.isArray(fullSession.messages)) {
                                    backendSessionsMap[sessionId].messages = fullSession.messages;
                                }
                                if (fullSession.pageDescription) {
                                    backendSessionsMap[sessionId].pageDescription = fullSession.pageDescription;
                                }
                                if (fullSession.pageContent) {
                                    backendSessionsMap[sessionId].pageContent = fullSession.pageContent;
                                }
                            }
                        } catch (error) {
                            console.warn(`获取会话 ${sessionId} 的完整数据失败:`, error.message);
                        }
                    }));
                }
                
                // 合并策略
                for (const [sessionId, backendSession] of Object.entries(backendSessionsMap)) {
                    const localSession = this.sessions[sessionId];
                    
                    if (!localSession) {
                        this.sessions[sessionId] = backendSession;
                    } else {
                        const localUpdatedAt = localSession.updatedAt || 0;
                        const backendUpdatedAt = backendSession.updatedAt || 0;
                        const localMessages = localSession.messages || [];
                        const backendMessages = backendSession.messages || [];
                        
                        let finalMessages = localMessages;
                        if (backendMessages.length > 0) {
                            if (backendUpdatedAt >= localUpdatedAt && backendMessages.length >= localMessages.length) {
                                finalMessages = backendMessages;
                            } else if (localMessages.length === 0 && backendMessages.length > 0) {
                                finalMessages = backendMessages;
                            }
                        }
                        
                        if (backendUpdatedAt >= localUpdatedAt) {
                            this.sessions[sessionId] = {
                                ...backendSession,
                                messages: finalMessages,
                                title: localSession.title || backendSession.title,
                                pageTitle: localSession.pageTitle || backendSession.pageTitle,
                                pageDescription: localSession.pageDescription || backendSession.pageDescription,
                                pageContent: localSession.pageContent || backendSession.pageContent
                            };
                        } else {
                            this.sessions[sessionId] = {
                                ...localSession,
                                url: backendSession.url || localSession.url,
                                title: localSession.title || backendSession.title,
                                pageTitle: localSession.pageTitle || backendSession.pageTitle,
                                pageDescription: localSession.pageDescription || backendSession.pageDescription,
                                pageContent: localSession.pageContent || backendSession.pageContent,
                                messages: localMessages
                            };
                        }
                    }
                }
                
                // 去重
                const deduplicatedSessions = {};
                for (const [sessionId, session] of Object.entries(this.sessions)) {
                    if (!session || !session.id) continue;
                    const id = session.id;
                    if (!deduplicatedSessions[id]) {
                        deduplicatedSessions[id] = session;
                    } else {
                        const existingUpdatedAt = deduplicatedSessions[id].updatedAt || 0;
                        const currentUpdatedAt = session.updatedAt || 0;
                        if (currentUpdatedAt > existingUpdatedAt) {
                            deduplicatedSessions[id] = session;
                        }
                    }
                }
                this.sessions = {};
                for (const session of Object.values(deduplicatedSessions)) {
                    if (session && session.id) {
                        this.sessions[session.id] = session;
                    }
                }
                
                await this.saveAllSessions(true);
                console.log('会话列表已从后端同步（API管理器），当前会话数量:', Object.keys(this.sessions).length);
                return;
            }
            
            // 如果没有API管理器，使用旧方式（向后兼容）
            if (!PET_CONFIG.api.syncSessionsToBackend) {
                console.log('会话同步未启用，跳过从后端加载');
                return;
            }
            
            const baseUrl = PET_CONFIG.api.yiaiBaseUrl;
            if (!baseUrl) {
                console.warn('YiAi后端地址未配置，跳过从后端加载');
                return;
            }
            
            // 检查是否需要刷新（避免频繁调用）
            const now = Date.now();
            if (!forceRefresh && (now - this.lastSessionListLoadTime) < this.SESSION_LIST_RELOAD_INTERVAL) {
                return;
            }
            
            console.log('开始从后端加载会话列表...');
            
            // 调用后端API获取会话列表
            const response = await fetch(`${baseUrl}/session/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`从后端加载会话列表失败: HTTP ${response.status}: ${errorText}`);
                return;
            }
            
            const result = await response.json();
            this.lastSessionListLoadTime = now;
            
            if (result.success && result.sessions && Array.isArray(result.sessions)) {
                console.log(`从后端加载到 ${result.sessions.length} 个会话`);
                
                // 将后端返回的会话数据合并到本地 sessions 对象
                // 如果后端数据更新（updatedAt 更晚），则使用后端数据
                // 否则保留本地数据（可能包含未同步的最新消息）
                const backendSessions = {};
                const sessionsToFetch = []; // 需要获取完整数据的会话ID列表
                
                result.sessions.forEach(backendSession => {
                    const sessionId = backendSession.id || backendSession.conversation_id;
                    if (!sessionId) return;
                    
                    // 将后端会话数据转换为本地格式
                    // 注意：后端列表API不返回messages字段，需要单独获取
                    const localSession = {
                        id: sessionId,
                        url: backendSession.url || '',
                        title: backendSession.title || '',
                        pageTitle: backendSession.pageTitle || '',
                        pageDescription: backendSession.pageDescription || '',
                        pageContent: backendSession.pageContent || '',
                        messages: backendSession.messages || [], // 后端列表API通常不包含messages
                        createdAt: backendSession.createdAt || backendSession.created_time || Date.now(),
                        updatedAt: backendSession.updatedAt || backendSession.updated_time || Date.now(),
                        lastAccessTime: backendSession.lastAccessTime || backendSession.last_access_time || Date.now()
                    };
                    
                    // 如果后端会话没有消息，但后端有message_count且大于0，需要获取完整数据
                    const messageCount = backendSession.message_count || 0;
                    if (!localSession.messages || localSession.messages.length === 0) {
                        if (messageCount > 0) {
                            sessionsToFetch.push(sessionId);
                        }
                    }
                    
                    backendSessions[sessionId] = localSession;
                });
            
                // 对于没有消息的会话，尝试从后端获取完整数据
                if (sessionsToFetch.length > 0) {
                    console.log(`发现 ${sessionsToFetch.length} 个需要获取完整数据的会话`);
                    await Promise.all(sessionsToFetch.map(async (sessionId) => {
                        try {
                            const sessionResponse = await fetch(`${baseUrl}/session/${sessionId}`, {
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            });
                            
                            if (sessionResponse.ok) {
                                const sessionResult = await sessionResponse.json();
                                if (sessionResult.success && sessionResult.data) {
                                    const fullSession = sessionResult.data;
                                    // 更新后端会话数据，包含完整的messages
                                    if (fullSession.messages && Array.isArray(fullSession.messages)) {
                                        backendSessions[sessionId].messages = fullSession.messages;
                                        // 同时更新其他可能缺失的字段
                                        if (fullSession.pageDescription) {
                                            backendSessions[sessionId].pageDescription = fullSession.pageDescription;
                                        }
                                        if (fullSession.pageContent) {
                                            backendSessions[sessionId].pageContent = fullSession.pageContent;
                                        }
                                    }
                                    console.log(`已获取会话 ${sessionId} 的完整数据，包含 ${fullSession.messages?.length || 0} 条消息`);
                                }
                            }
                        } catch (error) {
                            console.warn(`获取会话 ${sessionId} 的完整数据失败:`, error.message);
                        }
                    }));
                }
                
                // 合并后端数据到本地 sessions
                // 初始化 sessions 对象如果不存在
                if (!this.sessions) {
                    this.sessions = {};
                }
                
                // 合并策略：如果本地没有该会话，直接使用后端数据
                // 如果本地有该会话，比较 updatedAt，使用更新的一方
                // 关键：始终保留本地的消息，除非后端有更多消息
                for (const [sessionId, backendSession] of Object.entries(backendSessions)) {
                    const localSession = this.sessions[sessionId];
                    
                    if (!localSession) {
                        // 本地没有，直接使用后端数据（已包含完整的messages）
                        this.sessions[sessionId] = backendSession;
                    } else {
                        // 本地有，比较更新时间
                        const localUpdatedAt = localSession.updatedAt || 0;
                        const backendUpdatedAt = backendSession.updatedAt || 0;
                        
                        const localMessages = localSession.messages || [];
                        const backendMessages = backendSession.messages || [];
                        
                        // 关键修复：始终优先保留本地消息，除非后端消息更多或更新时间更晚
                        let finalMessages = localMessages;
                        if (backendMessages.length > 0) {
                            if (backendUpdatedAt >= localUpdatedAt && backendMessages.length >= localMessages.length) {
                                // 后端更新且消息更多，使用后端消息
                                finalMessages = backendMessages;
                            } else if (localMessages.length === 0 && backendMessages.length > 0) {
                                // 本地没有消息但后端有，使用后端消息
                                finalMessages = backendMessages;
                            }
                            // 否则保留本地消息（不覆盖）
                        }
                        
                        if (backendUpdatedAt >= localUpdatedAt) {
                            // 后端数据更新，使用后端数据，但保留本地消息（如果本地消息更多或更新）
                            this.sessions[sessionId] = {
                                ...backendSession,
                                messages: finalMessages, // 使用合并后的消息
                                // 如果本地标题或内容有更新，保留本地的
                                title: localSession.title || backendSession.title,
                                pageTitle: localSession.pageTitle || backendSession.pageTitle,
                                pageDescription: localSession.pageDescription || backendSession.pageDescription,
                                pageContent: localSession.pageContent || backendSession.pageContent
                            };
                        } else {
                            // 本地更新，保留本地数据，但更新其他字段（如果后端有更新的元数据）
                            this.sessions[sessionId] = {
                                ...localSession,
                                // 更新元数据字段（如果后端有更新的值）
                                url: backendSession.url || localSession.url,
                                title: localSession.title || backendSession.title,
                                pageTitle: localSession.pageTitle || backendSession.pageTitle,
                                pageDescription: localSession.pageDescription || backendSession.pageDescription,
                                pageContent: localSession.pageContent || backendSession.pageContent,
                                // 消息始终使用本地的（因为本地更新）
                                messages: localMessages
                            };
                        }
                    }
                }
                
                // 去重：确保 this.sessions 中每个 id 只有一个会话（保留 updatedAt 最新的）
                const deduplicatedSessions = {};
                for (const [sessionId, session] of Object.entries(this.sessions)) {
                    if (!session || !session.id) continue;
                    
                    const id = session.id;
                    if (!deduplicatedSessions[id]) {
                        deduplicatedSessions[id] = session;
                    } else {
                        // 如果已存在，比较 updatedAt，保留更新的
                        const existingUpdatedAt = deduplicatedSessions[id].updatedAt || 0;
                        const currentUpdatedAt = session.updatedAt || 0;
                        if (currentUpdatedAt > existingUpdatedAt) {
                            deduplicatedSessions[id] = session;
                        }
                    }
                }
                // 将去重后的会话重新映射回 sessionId（使用会话的 id 作为 key）
                this.sessions = {};
                for (const session of Object.values(deduplicatedSessions)) {
                    if (session && session.id) {
                        this.sessions[session.id] = session;
                    }
                }
                
                // 保存合并后的会话数据到本地存储
                await this.saveAllSessions(true);
                
                console.log('会话列表已从后端同步（旧方式），当前会话数量（去重后）:', Object.keys(this.sessions).length);
                } else {
                    console.warn('从后端加载会话列表返回数据格式错误:', result);
                }
        } catch (error) {
            // 静默处理错误，不阻塞主流程
            console.warn('从后端加载会话列表时出错:', error.message);
        }
    }

    // 加载所有会话（先从后端加载，然后从本地存储加载）
    async loadAllSessions() {
        // 先从后端加载会话列表
        await this.loadSessionsFromBackend();
        
        // 然后从本地存储加载（作为补充，因为本地可能有一些未同步的临时会话）
        return new Promise((resolve) => {
            chrome.storage.local.get(['petChatSessions'], (result) => {
                if (result.petChatSessions) {
                    // 合并本地存储的会话（如果后端没有）
                    if (!this.sessions) {
                        this.sessions = {};
                    }
                    
                    // 将本地存储的会话合并进来（如果后端没有对应的会话）
                    for (const [sessionId, localSession] of Object.entries(result.petChatSessions)) {
                        if (!localSession || !localSession.id) continue;
                        
                        // 使用会话的 id 作为 key（而不是 sessionId，因为可能有不同）
                        const id = localSession.id;
                        if (!this.sessions[id]) {
                            this.sessions[id] = localSession;
                        } else {
                            // 如果两端都有，使用更更新的版本
                            const backendSession = this.sessions[id];
                            const localUpdatedAt = localSession.updatedAt || 0;
                            const backendUpdatedAt = backendSession.updatedAt || 0;
                            
                            if (localUpdatedAt > backendUpdatedAt) {
                                // 本地更新，使用本地数据
                                this.sessions[id] = localSession;
                            }
                        }
                    }
                    
                    // 最后进行一次去重，确保每个 id 只有一个会话
                    const deduplicatedSessions = {};
                    for (const [key, session] of Object.entries(this.sessions)) {
                        if (!session || !session.id) continue;
                        const id = session.id;
                        if (!deduplicatedSessions[id]) {
                            deduplicatedSessions[id] = session;
                        } else {
                            const existingUpdatedAt = deduplicatedSessions[id].updatedAt || 0;
                            const currentUpdatedAt = session.updatedAt || 0;
                            if (currentUpdatedAt > existingUpdatedAt) {
                                deduplicatedSessions[id] = session;
                            }
                        }
                    }
                    this.sessions = {};
                    for (const session of Object.values(deduplicatedSessions)) {
                        if (session && session.id) {
                            this.sessions[session.id] = session;
                        }
                    }
                } else if (!this.sessions) {
                    // 如果本地存储也没有，初始化空对象
                    this.sessions = {};
                }
                resolve();
            });
        });
    }

    // 保存所有会话（带节流优化）
    async saveAllSessions(force = false) {
        const now = Date.now();
        
        // 如果不在强制模式下，且距离上次保存时间太短，则延迟保存
        if (!force && (now - this.lastSessionSaveTime) < this.SESSION_SAVE_THROTTLE) {
            // 标记有待处理的更新
            this.pendingSessionUpdate = true;
            
            // 如果已有定时器在等待，清除它
            if (this.sessionUpdateTimer) {
                clearTimeout(this.sessionUpdateTimer);
            }
            
            // 延迟保存
            return new Promise((resolve) => {
                this.sessionUpdateTimer = setTimeout(async () => {
                    this.pendingSessionUpdate = false;
                    await this._doSaveAllSessions();
                    resolve();
                }, this.SESSION_SAVE_THROTTLE - (now - this.lastSessionSaveTime));
            });
        }
        
        // 立即保存
        this.pendingSessionUpdate = false;
        if (this.sessionUpdateTimer) {
            clearTimeout(this.sessionUpdateTimer);
            this.sessionUpdateTimer = null;
        }
        return await this._doSaveAllSessions();
    }
    
    // 实际执行保存操作
    async _doSaveAllSessions() {
        this.lastSessionSaveTime = Date.now();
        return new Promise((resolve) => {
            chrome.storage.local.set({ petChatSessions: this.sessions }, () => {
                // 保存到本地存储后，异步同步到后端（使用队列批量保存，不阻塞保存流程）
                if (PET_CONFIG.api.syncSessionsToBackend && this.currentSessionId) {
                    // 使用队列批量保存，提高性能
                    this.syncSessionToBackend(this.currentSessionId, false).catch(err => {
                        console.warn('同步会话到后端失败:', err);
                    });
                }
                resolve();
            });
        });
    }
    
    // 同步会话到YiAi后端（使用API管理器，支持批量保存）
    async syncSessionToBackend(sessionId, immediate = false) {
        try {
            if (!PET_CONFIG.api.syncSessionsToBackend) {
                return;
            }
            
            const session = this.sessions[sessionId];
            if (!session) {
                console.warn('会话不存在，无法同步:', sessionId);
                return;
            }
            
            // 构建请求数据
            const sessionData = {
                id: session.id || sessionId,
                url: session.url || '',
                title: session.title || '',
                pageTitle: session.pageTitle || '',
                pageDescription: session.pageDescription || '',
                pageContent: session.pageContent || '',
                messages: session.messages || [],
                createdAt: session.createdAt || Date.now(),
                updatedAt: session.updatedAt || Date.now(),
                lastAccessTime: session.lastAccessTime || Date.now()
            };
            
            // 使用API管理器
            if (this.sessionApi) {
                if (immediate) {
                    // 立即保存
                    const result = await this.sessionApi.saveSession(sessionData);
                    
                    // 如果返回了完整的会话数据，更新本地会话数据
                    if (result?.data?.session) {
                        const updatedSession = result.data.session;
                        if (this.sessions[sessionId]) {
                            // 更新本地会话数据，但保留本地的 messages（可能包含未同步的最新消息）
                            this.sessions[sessionId] = {
                                ...updatedSession,
                                // 如果本地消息更新，保留本地消息
                                messages: this.sessions[sessionId].messages?.length > updatedSession.messages?.length
                                    ? this.sessions[sessionId].messages
                                    : updatedSession.messages
                            };
                        }
                    }
                    
                    // 清除列表缓存，强制下次刷新时从接口获取最新数据
                    this.lastSessionListLoadTime = 0;
                    
                    console.log(`会话 ${sessionId} 已立即同步到后端`);
                } else {
                    // 加入队列批量保存
                    this.sessionApi.queueSave(sessionId, sessionData);
                    console.log(`会话 ${sessionId} 已加入保存队列`);
                }
            } else {
                // 向后兼容：使用旧方式
                const baseUrl = PET_CONFIG.api.yiaiBaseUrl;
                if (!baseUrl) {
                    console.warn('YiAi后端地址未配置，跳过同步');
                    return;
                }
                
                const response = await fetch(`${baseUrl}/session/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(sessionData)
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
                
                const result = await response.json();
                if (result.success) {
                    console.log(`会话 ${sessionId} 已同步到后端`);
                } else {
                    console.warn(`会话同步失败:`, result.message);
                }
            }
        } catch (error) {
            // 静默处理错误，不阻塞主流程
            console.warn('同步会话到后端时出错:', error.message);
        }
    }

    // 直接添加消息到当前会话对象（实时保存，确保消息与会话一一对应）
    async addMessageToSession(type, content, timestamp = null) {
        if (!this.currentSessionId) {
            console.warn('没有当前会话，无法添加消息');
            return;
        }
        
        // 确保会话存在
        if (!this.sessions[this.currentSessionId]) {
            console.warn('会话不存在，无法添加消息:', this.currentSessionId);
            return;
        }
        
        const session = this.sessions[this.currentSessionId];
        
        // 确保messages数组存在
        if (!Array.isArray(session.messages)) {
            session.messages = [];
        }
        
        // 验证消息内容
        if (!content || typeof content !== 'string' || !content.trim()) {
            console.warn('消息内容为空或无效，跳过保存');
            return;
        }
        
        // 创建消息对象
        const message = {
            type: type, // 'user' 或 'pet'
            content: content.trim(), // 去除首尾空白
            timestamp: timestamp || Date.now()
        };
        
        // 检查是否重复（避免重复保存相同的消息）
        // 如果最后一条消息的类型和内容都相同，可能是重复添加，跳过
        const lastMessage = session.messages[session.messages.length - 1];
        if (lastMessage && 
            lastMessage.type === message.type && 
            lastMessage.content === message.content &&
            (Date.now() - lastMessage.timestamp) < 1000) { // 1秒内的相同消息视为重复
            console.log('检测到重复消息，跳过保存:', message.content.substring(0, 30));
            return;
        }
        
        // 如果是欢迎消息（第一条宠物消息），不添加到会话中
        if (type === 'pet' && session.messages.length === 0) {
            // 检查是否是欢迎消息，如果是则不添加
            return;
        }
        
        // 添加消息到会话对象
        session.messages.push(message);
        session.updatedAt = Date.now();
        
        console.log(`消息已添加到会话 ${this.currentSessionId} (${session.messages.length} 条):`, 
            message.type, message.content.substring(0, 50));
        
        // 异步保存到存储（使用防抖优化，避免频繁保存）
        this.saveAllSessions().catch(err => {
            console.error('保存会话消息失败:', err);
        });
    }

    // 保存当前会话的消息和页面信息（确保一致性，优化版本）
    // 重要：只有当会话URL和当前页面URL匹配时，才更新页面信息，确保数据隔离
    async saveCurrentSession(force = false) {
        if (!this.currentSessionId) return;
        
        // 确保会话存在
        if (!this.sessions[this.currentSessionId]) {
            console.warn('会话不存在，无法保存:', this.currentSessionId);
            return;
        }

        // 获取当前页面信息
        const pageInfo = this.getPageInfo();
        const session = this.sessions[this.currentSessionId];
        let hasActualChanges = false;
        let messagesChanged = false;
        
        // 关键检查：只有当会话URL和当前页面URL匹配时，才允许更新页面信息
        // 这样可以确保切换到不同URL的会话时，不会互相影响数据
        const isUrlMatched = session.url === pageInfo.url;
        
        // 如果聊天窗口已打开，同步消息记录（从DOM中提取，确保完整性）
        if (this.chatWindow) {
            const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
            if (messagesContainer) {
                // 获取所有消息元素
                const messageElements = Array.from(messagesContainer.children);
                const messages = [];
                
                for (const msgEl of messageElements) {
                    const userBubble = msgEl.querySelector('[data-message-type="user-bubble"]');
                    const petBubble = msgEl.querySelector('[data-message-type="pet-bubble"]');
                    
                    if (userBubble) {
                        const content = userBubble.textContent || userBubble.getAttribute('data-original-text') || '';
                        if (content.trim()) {
                            messages.push({
                                type: 'user',
                                content: content,
                                timestamp: this.getMessageTimestamp(msgEl)
                            });
                        }
                    } else if (petBubble) {
                        // 跳过欢迎消息（第一条宠物消息）
                        const isWelcome = msgEl.hasAttribute('data-welcome-message');
                        if (!isWelcome) {
                            const content = petBubble.getAttribute('data-original-text') || petBubble.textContent || '';
                            if (content.trim()) {
                                messages.push({
                                    type: 'pet',
                                    content: content,
                                    timestamp: this.getMessageTimestamp(msgEl)
                                });
                            }
                        }
                    }
                }
                
                // 检查消息是否真的发生了变化（比较消息数量和内容）
                const existingMessages = session.messages || [];
                
                // 深度比较消息数组
                const messagesEqual = (msgs1, msgs2) => {
                    if (msgs1.length !== msgs2.length) return false;
                    for (let i = 0; i < msgs1.length; i++) {
                        if (msgs1[i].type !== msgs2[i].type || 
                            msgs1[i].content !== msgs2[i].content) {
                            return false;
                        }
                    }
                    return true;
                };
                
                messagesChanged = !messagesEqual(existingMessages, messages);
                
                // 只有在消息发生变化时才更新（强制模式下也会更新）
                if (messagesChanged || force) {
                    session.messages = messages;
                    session.updatedAt = Date.now();
                    hasActualChanges = true;
                    console.log(`会话 ${this.currentSessionId} 消息已同步，共 ${messages.length} 条消息`);
                }
            }
        }
        
        // 同步更新页面信息（只有在URL匹配时才更新，确保数据隔离）
        // 当用户切换到不同URL的会话时，不会影响那个会话的页面信息
        if (isUrlMatched) {
            const pageInfoChanged = (
                session.url !== pageInfo.url ||
                session.title !== pageInfo.title ||
                session.pageTitle !== pageInfo.title ||
                session.pageDescription !== (pageInfo.description || '') ||
                (!session.pageContent || session.pageContent.trim() === '')
            );
            
            // 只有在URL匹配时，才更新页面信息（确保会话信息完整且隔离）
            if (pageInfoChanged) {
                if (session.url !== pageInfo.url) {
                    session.url = pageInfo.url;
                    hasActualChanges = true;
                }
                if (session.title !== pageInfo.title) {
                    session.title = pageInfo.title;
                    hasActualChanges = true;
                }
                if (session.pageTitle !== pageInfo.title) {
                    session.pageTitle = pageInfo.title;
                    hasActualChanges = true;
                }
                if (session.pageDescription !== (pageInfo.description || '')) {
                    session.pageDescription = pageInfo.description || '';
                    hasActualChanges = true;
                }
                // 如果 pageContent 缺失，则补充（保留原始快照，但确保信息完整）
                if (!session.pageContent || session.pageContent.trim() === '') {
                    session.pageContent = pageInfo.content || '';
                    hasActualChanges = true;
                }
                
                // 如果有实际变化，更新时间戳
                if (hasActualChanges && !messagesChanged) {
                    // 如果消息未变化，更新更新时间戳
                    session.updatedAt = Date.now();
                }
            }
        } else {
            // URL不匹配时，只记录日志，不更新页面信息（保持数据隔离）
            console.log(`保存会话 ${this.currentSessionId}：URL不匹配，不更新页面信息。会话URL: ${session.url}, 当前页面URL: ${pageInfo.url}`);
        }
        
        // 更新最后访问时间（每次保存时都更新，即使URL不匹配也更新）
        const now = Date.now();
        if (!session.lastAccessTime || (now - session.lastAccessTime) > 60000) {
            session.lastAccessTime = now;
            hasActualChanges = true;
        }
        
        // 强制保存模式：无论是否有变化都保存（用于切换会话前的保存）
        // 或者有实际变化时才保存
        if (hasActualChanges || force) {
            await this.saveAllSessions(force);
            return true; // 返回true表示有变化
        }
        
        return false; // 返回false表示无变化
    }

    // 从消息元素获取时间戳
    getMessageTimestamp(msgEl) {
        const timeEl = msgEl.querySelector('[data-message-time="true"]');
        if (timeEl) {
            const timeText = timeEl.textContent.trim();
            // 尝试解析时间戳，如果无法解析则使用当前时间
            return Date.now();
        }
        return Date.now();
    }

    // 切换到指定会话（确保数据一致性）
    // 注意：手动切换会话时不调用 session/save 接口
    async switchSession(sessionId) {
        // 防抖：如果正在切换或点击的是当前会话，直接返回
        if (this.isSwitchingSession || sessionId === this.currentSessionId) {
            return;
        }
        
        // 验证会话是否存在
        if (!this.sessions[sessionId]) {
            console.error('会话不存在:', sessionId);
            this.showNotification('会话不存在', 'error');
            return;
        }

        // 设置切换状态
        this.isSwitchingSession = true;
        
        // 获取UI元素引用
        const clickedItem = this.sessionSidebar?.querySelector(`[data-session-id="${sessionId}"]`);
        const previousActiveItem = this.sessionSidebar?.querySelector('.session-item.active');
        const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
        
        // 显示加载状态
        if (clickedItem) {
            clickedItem.classList.add('switching');
            if (previousActiveItem && previousActiveItem !== clickedItem) {
                previousActiveItem.classList.remove('active');
            }
        }
        
        // 添加淡出效果
        if (messagesContainer && this.isChatOpen) {
            messagesContainer.style.opacity = '0.5';
            messagesContainer.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        }
        
        try {
            // 使用统一的激活会话方法
            // 注意：saveCurrent设为false，手动切换会话时不保存当前会话
            await this.activateSession(sessionId, {
                saveCurrent: false, // 手动切换会话时不保存，避免调用 session/save 接口
                updateConsistency: true,
                updateUI: false // 稍后手动更新UI以便添加过渡效果
            });
            
            // 更新侧边栏
            await new Promise(resolve => {
                requestAnimationFrame(async () => {
                    await this.updateSessionSidebar();
                    resolve();
                });
            });
            
            // 加载消息并添加淡入效果（确保消息正确恢复）
            if (this.chatWindow && this.isChatOpen) {
                // 先确保会话数据已加载
                if (!this.sessions[sessionId]) {
                    await this.loadAllSessions();
                }
                
                // 加载会话消息（确保消息与会话一一对应）
                await this.loadSessionMessages();
                
                // 更新聊天窗口标题（显示当前会话名称）
                this.updateChatHeaderTitle();
                
                // 验证消息是否已正确加载
                const loadedMessagesCount = messagesContainer?.querySelectorAll('[data-message-type="user-bubble"], [data-message-type="pet-bubble"]:not([data-welcome-message])').length || 0;
                const sessionMessagesCount = this.sessions[sessionId]?.messages?.length || 0;
                console.log(`会话切换完成，已加载 ${loadedMessagesCount} 条消息（会话中存储了 ${sessionMessagesCount} 条）`);
                
                requestAnimationFrame(() => {
                    if (messagesContainer) {
                        messagesContainer.style.opacity = '1';
                    }
                });
            }
        } catch (error) {
            console.error('切换会话时出错:', error);
            
            // 恢复UI状态
            if (previousActiveItem) {
                previousActiveItem.classList.add('active');
            }
            if (clickedItem) {
                clickedItem.classList.remove('switching');
            }
            if (messagesContainer) {
                messagesContainer.style.opacity = '1';
            }
            
            this.showNotification('切换会话失败，请重试', 'error');
            throw error;
        } finally {
            // 清除加载状态
            if (clickedItem) {
                clickedItem.classList.remove('switching');
            }
            this.isSwitchingSession = false;
        }
    }

    // 加载当前会话的消息（确保消息与会话一一对应）
    async loadSessionMessages() {
        if (!this.chatWindow || !this.currentSessionId) {
            console.warn('无法加载消息：聊天窗口或会话ID不存在');
            return;
        }
        
        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (!messagesContainer) {
            console.warn('无法加载消息：消息容器不存在');
            return;
        }
        
        // 获取当前会话数据
        const session = this.sessions[this.currentSessionId];
        if (!session) {
            console.warn('会话不存在，无法加载消息:', this.currentSessionId);
            return;
        }
        
        console.log(`加载会话 ${this.currentSessionId} 的消息，共 ${session.messages?.length || 0} 条`);
        
        // 清空现有消息（确保干净的加载状态）
        messagesContainer.innerHTML = '';
        
        // 创建欢迎消息（使用会话保存的页面信息）
        const pageInfo = {
            title: session.pageTitle || session.title || document.title || '当前页面',
            url: session.url || window.location.href,
            description: session.pageDescription || ''
        };
        this.createWelcomeMessage(messagesContainer, pageInfo);
        
        // 确保欢迎消息的按钮容器存在并刷新角色按钮
        // 如果按钮容器不存在，创建一个临时的以确保 refreshWelcomeActionButtons 能正常工作
        setTimeout(async () => {
            let welcomeActionsContainer = this.chatWindow.querySelector('#pet-welcome-actions');
            if (!welcomeActionsContainer) {
                // 如果按钮容器不存在，找到欢迎消息的时间容器并创建按钮容器
                const welcomeMessage = messagesContainer.querySelector('[data-welcome-message]');
                if (welcomeMessage) {
                    let messageTime = welcomeMessage.querySelector('[data-message-time]');
                    if (messageTime) {
                        // 检查 messageTime 是否在 messageTimeWrapper 中，如果是，使用 messageTimeWrapper
                        // 因为 createMessageElement 会创建 messageTimeWrapper 包裹 messageTime
                        const messageTimeWrapper = messageTime.parentElement;
                        let targetContainer = messageTime;
                        
                        // 如果 messageTime 有父容器且父容器是 messageTimeWrapper，使用 messageTime 本身
                        // 但需要检查父容器的结构
                        const timeAndCopyContainer = messageTimeWrapper?.parentElement;
                        if (timeAndCopyContainer && timeAndCopyContainer.querySelector('[data-copy-button-container]')) {
                            // 这是标准的消息结构，messageTime 在 messageTimeWrapper 中
                            // 我们需要修改 messageTime 的样式，使其成为 flex 容器
                            targetContainer = messageTime;
                        }
                        
                        // 创建按钮容器（与 createChatWindow 中的逻辑一致）
                        // 将按钮直接添加到 data-message-time 元素中，和时间同一行
                        // 首先确保 messageTime 是 flex 布局
                        targetContainer.style.cssText = `
                            display: flex !important;
                            justify-content: space-between !important;
                            align-items: center !important;
                            font-size: 11px !important;
                            color: #999 !important;
                            margin-top: 4px !important;
                            max-width: 100% !important;
                            width: 100% !important;
                        `;
                        
                        // 如果 targetContainer 没有时间文本，创建一个
                        let timeText = targetContainer.querySelector('span');
                        if (!timeText) {
                            timeText = document.createElement('span');
                            timeText.style.cssText = 'flex: 1 !important; min-width: 0 !important;';
                            timeText.textContent = this.getCurrentTime();
                            // 如果 targetContainer 有文本内容，先清除
                            if (targetContainer.textContent.trim()) {
                                const originalText = targetContainer.textContent.trim();
                                targetContainer.innerHTML = '';
                                timeText.textContent = originalText || this.getCurrentTime();
                            }
                            targetContainer.appendChild(timeText);
                        }
                        
                        // 创建按钮容器
                        const actionsGroup = document.createElement('div');
                        actionsGroup.id = 'pet-welcome-actions';
                        actionsGroup.style.cssText = `
                            display: inline-flex !important;
                            align-items: center !important;
                            gap: 8px !important;
                            flex-shrink: 0 !important;
                        `;
                        
                        const actionsWrapper = document.createElement('div');
                        actionsWrapper.style.cssText = `
                            position: relative !important;
                            display: inline-flex !important;
                            align-items: center !important;
                            gap: 8px !important;
                        `;
                        actionsWrapper.appendChild(actionsGroup);
                        targetContainer.appendChild(actionsWrapper);
                    }
                }
            }
            // 刷新角色按钮（确保显示最新的角色列表）
            await this.refreshWelcomeActionButtons();
        }, 150);
        
        // 加载会话消息（确保消息顺序和内容正确）
        if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
            // 先使用 DocumentFragment 批量添加消息，提高性能
            const fragment = document.createDocumentFragment();
            const petMessages = []; // 保存所有宠物消息，用于后续添加按钮
            
            for (const msg of session.messages) {
                // 验证消息格式
                if (!msg || !msg.type || !msg.content) {
                    console.warn('跳过无效消息:', msg);
                    continue;
                }
                
                const msgEl = this.createMessageElement(msg.content, msg.type);
                fragment.appendChild(msgEl);
                
                // 如果是宠物消息，渲染 Markdown
                if (msg.type === 'pet') {
                    const petBubble = msgEl.querySelector('[data-message-type="pet-bubble"]');
                    if (petBubble) {
                        petBubble.innerHTML = this.renderMarkdown(msg.content);
                        petBubble.setAttribute('data-original-text', msg.content);
                        
                        // 保存宠物消息引用，用于后续添加按钮
                        petMessages.push(msgEl);
                        
                        // 处理 Mermaid 图表（异步处理，不阻塞其他消息渲染）
                        this.processMermaidBlocks(petBubble).catch(err => {
                            console.error('处理 Mermaid 图表失败:', err);
                        });
                    }
                } else if (msg.type === 'user') {
                    // 确保用户消息的原始文本被保存（用于保存时提取）
                    const userBubble = msgEl.querySelector('[data-message-type="user-bubble"]');
                    if (userBubble) {
                        userBubble.setAttribute('data-original-text', msg.content);
                    }
                }
            }
            
            // 一次性添加所有消息
            messagesContainer.appendChild(fragment);
            
            // 为所有宠物消息添加按钮（异步处理，不阻塞渲染）
            // 使用 setTimeout 确保 DOM 完全更新后再添加按钮
            setTimeout(async () => {
                for (const petMsg of petMessages) {
                    try {
                        const petBubble = petMsg.querySelector('[data-message-type="pet-bubble"]');
                        if (!petBubble) continue;
                        
                        // 检查是否是欢迎消息（第一条消息），欢迎消息不需要添加按钮
                        const isWelcome = petMsg.hasAttribute('data-welcome-message');
                        if (isWelcome) continue;
                        
                        // 添加复制按钮（编辑和删除按钮）
                        const copyButtonContainer = petMsg.querySelector('[data-copy-button-container]');
                        if (copyButtonContainer && !copyButtonContainer.querySelector('.edit-button')) {
                            this.addCopyButton(copyButtonContainer, petBubble);
                        }
                        
                        // 添加重试按钮（仅当不是第一条消息时）
                        // 检查是否是第一条宠物消息
                        const allPetMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]') && 
                            !child.hasAttribute('data-welcome-message')
                        );
                        
                        if (allPetMessages.length > 0) {
                            const tryAgainContainer = petMsg.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                // 检查是否是按钮操作生成的消息，不添加重试按钮
                                if (!petMsg.hasAttribute('data-button-action')) {
                                    this.addTryAgainButton(tryAgainContainer, petMsg);
                                }
                            }
                        }
                        
                        // 添加动作按钮（包括角色按钮和设置按钮）
                        await this.addActionButtonsToMessage(petMsg);
                    } catch (error) {
                        console.error('为消息添加按钮时出错:', error);
                    }
                }
                
                // 确保滚动到底部
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
            
            // 使用 requestAnimationFrame 确保 DOM 更新完成后再滚动
            requestAnimationFrame(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
        } else {
            // 如果没有消息，确保滚动到底部
            requestAnimationFrame(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
        }
    }

    // 从本地 sessions 对象获取会话列表（辅助函数）
    _getSessionsFromLocal() {
        // 确保 sessions 对象已初始化
        if (!this.sessions) {
            this.sessions = {};
            return [];
        }
        
        // 获取所有会话并去重（按 id 去重，保留 updatedAt 最新的）
        const sessionMap = new Map();
        for (const session of Object.values(this.sessions)) {
            if (!session || !session.id) {
                continue;
            }
            
            const sessionId = session.id;
            const existingSession = sessionMap.get(sessionId);
            
            if (!existingSession) {
                // 如果不存在，直接添加
                sessionMap.set(sessionId, session);
            } else {
                // 如果已存在，比较 updatedAt，保留更新的版本
                const existingUpdatedAt = existingSession.updatedAt || existingSession.createdAt || 0;
                const currentUpdatedAt = session.updatedAt || session.createdAt || 0;
                
                if (currentUpdatedAt > existingUpdatedAt) {
                    sessionMap.set(sessionId, session);
                }
            }
        }
        
        return Array.from(sessionMap.values());
    }

    // 更新会话侧边栏
    async updateSessionSidebar(forceRefresh = false) {
        if (!this.sessionSidebar) {
            console.log('会话侧边栏未创建，跳过更新');
            return;
        }
        
        const sessionList = this.sessionSidebar.querySelector('.session-list');
        if (!sessionList) {
            console.log('会话列表容器未找到，跳过更新');
            return;
        }
        
        // 优先使用接口数据，确保列表与后端一致
        let allSessions = [];
        
        if (PET_CONFIG.api.syncSessionsToBackend && this.sessionApi) {
            try {
                // 检查是否需要刷新（避免频繁调用）
                const now = Date.now();
                const shouldRefresh = (now - this.lastSessionListLoadTime) >= this.SESSION_LIST_RELOAD_INTERVAL;
                
                if (shouldRefresh || forceRefresh) {
                    // 从接口获取最新的会话列表
                    const backendSessions = await this.sessionApi.getSessionsList({ forceRefresh });
                    
                    // 将接口数据转换为前端格式，确保格式一致
                    allSessions = backendSessions.map(backendSession => ({
                        id: backendSession.id,
                        url: backendSession.url || '',
                        title: backendSession.title || '',
                        pageTitle: backendSession.pageTitle || '',
                        pageDescription: backendSession.pageDescription || '',
                        message_count: backendSession.message_count || 0,
                        createdAt: backendSession.createdAt || Date.now(),
                        updatedAt: backendSession.updatedAt || Date.now(),
                        lastAccessTime: backendSession.lastAccessTime || backendSession.updatedAt || Date.now(),
                        // 列表接口不包含完整消息，使用本地会话的消息（如果有）
                        messages: this.sessions?.[backendSession.id]?.messages || []
                    }));
                    
                    // 同时更新本地 sessions 对象，保持同步
                    await this.loadSessionsFromBackend(forceRefresh);
                    this.lastSessionListLoadTime = now;
                    
                    console.log('从接口获取会话列表，数量:', allSessions.length);
                } else {
                    // 使用缓存的接口数据
                    const cachedSessions = await this.sessionApi.getSessionsList({ forceRefresh: false });
                    allSessions = cachedSessions.map(s => ({
                        id: s.id,
                        url: s.url || '',
                        title: s.title || '',
                        pageTitle: s.pageTitle || '',
                        pageDescription: s.pageDescription || '',
                        message_count: s.message_count || 0,
                        createdAt: s.createdAt || Date.now(),
                        updatedAt: s.updatedAt || Date.now(),
                        lastAccessTime: s.lastAccessTime || s.updatedAt || Date.now(),
                        messages: this.sessions?.[s.id]?.messages || []
                    }));
                }
            } catch (error) {
                console.warn('从接口获取会话列表失败，使用本地数据:', error.message);
                // 接口失败时，使用本地 sessions 作为后备
                allSessions = this._getSessionsFromLocal();
            }
        } else {
            // 未启用后端同步，使用本地 sessions
            allSessions = this._getSessionsFromLocal();
        }
        
        // 清空列表
        sessionList.innerHTML = '';
        
        console.log('当前会话数量:', allSessions.length);
        
        if (allSessions.length === 0) {
            // 如果没有会话，显示提示信息
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = `
                padding: 20px !important;
                text-align: center !important;
                color: #9ca3af !important;
                font-size: 12px !important;
            `;
            emptyMsg.textContent = '暂无会话';
            sessionList.appendChild(emptyMsg);
            return;
        }
        
        // 按更新时间排序会话（最新更新的在前，与接口排序一致）
        // 这样可以确保列表与接口返回的顺序一致
        const sortedSessions = allSessions.sort((a, b) => {
            const aUpdated = a.updatedAt || a.createdAt || 0;
            const bUpdated = b.updatedAt || b.createdAt || 0;
            
            // 首先按更新时间排序（最新更新的在前）
            if (aUpdated !== bUpdated) {
                return bUpdated - aUpdated;
            }
            
            // 如果更新时间相同，按会话ID排序（确保完全稳定）
            const aId = a.id || '';
            const bId = b.id || '';
            return aId.localeCompare(bId);
        });
        
        // 创建会话列表项
        for (const session of sortedSessions) {
            if (!session || !session.id) continue;
            
            const sessionItem = document.createElement('div');
            sessionItem.className = 'session-item';
            sessionItem.dataset.sessionId = session.id;
            
            if (session.id === this.currentSessionId) {
                sessionItem.classList.add('active');
            }
            
            // 截断过长的标题
            const displayTitle = session.title && session.title.length > 20 
                ? session.title.substring(0, 20) + '...' 
                : (session.title || session.id || '未命名会话');
            
            // 创建内容容器
            const contentWrapper = document.createElement('div');
            contentWrapper.style.cssText = `
                flex: 1 !important;
                min-width: 0 !important;
            `;
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'session-title';
            titleDiv.textContent = displayTitle;
            
            const metaDiv = document.createElement('div');
            metaDiv.className = 'session-meta';
            metaDiv.textContent = this.formatSessionTime(session.updatedAt);
            
            contentWrapper.appendChild(titleDiv);
            contentWrapper.appendChild(metaDiv);
            
            sessionItem.appendChild(contentWrapper);
            
            // 长按删除相关变量
            let longPressTimer = null;
            let longPressProgressTimer = null;
            let longPressThreshold = 800; // 长按时间阈值（毫秒）
            let isLongPressing = false;
            let hasMoved = false;
            let startX = 0;
            let startY = 0;
            let longPressStartTime = 0;
            const moveThreshold = 10; // 移动阈值，超过此值则取消长按
            
            // 创建长按进度指示器
            const progressBar = document.createElement('div');
            progressBar.className = 'long-press-progress';
            progressBar.style.cssText = `
                position: absolute !important;
                bottom: 0 !important;
                left: 0 !important;
                height: 3px !important;
                background: rgba(244, 67, 54, 0.8) !important;
                width: 0% !important;
                border-radius: 0 0 8px 8px !important;
                transition: width 0.05s linear !important;
                z-index: 10 !important;
            `;
            sessionItem.appendChild(progressBar);
            
            // 创建长按提示文本
            const hintText = document.createElement('div');
            hintText.className = 'long-press-hint';
            hintText.textContent = '继续按住以删除';
            hintText.style.cssText = `
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) scale(0) !important;
                background: rgba(244, 67, 54, 0.95) !important;
                color: white !important;
                padding: 6px 12px !important;
                border-radius: 6px !important;
                font-size: 12px !important;
                white-space: nowrap !important;
                pointer-events: none !important;
                z-index: 20 !important;
                opacity: 0 !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
            `;
            sessionItem.appendChild(hintText);
            
            // 清除长按定时器
            const clearLongPress = () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                if (longPressProgressTimer) {
                    clearInterval(longPressProgressTimer);
                    longPressProgressTimer = null;
                }
                if (isLongPressing) {
                    sessionItem.classList.remove('long-pressing', 'long-press-start', 
                        'long-press-stage-1', 'long-press-stage-2', 'long-press-stage-3');
                    isLongPressing = false;
                } else {
                    // 即使没有完成长按，也要清除开始状态和阶段状态
                    sessionItem.classList.remove('long-press-start', 
                        'long-press-stage-1', 'long-press-stage-2', 'long-press-stage-3');
                }
                hasMoved = false;
                progressBar.style.width = '0%';
                hintText.style.opacity = '0';
                hintText.style.transform = 'translate(-50%, -50%) scale(0)';
                longPressStartTime = 0;
            };
            
            // 触觉反馈（如果支持）
            const triggerHapticFeedback = () => {
                if ('vibrate' in navigator) {
                    navigator.vibrate(50); // 短震动
                }
            };
            
            // 开始长按检测
            const startLongPress = (e) => {
                // 如果正在切换会话，忽略
                if (this.isSwitchingSession) {
                    return;
                }
                
                hasMoved = false;
                startX = e.touches ? e.touches[0].clientX : e.clientX;
                startY = e.touches ? e.touches[0].clientY : e.clientY;
                longPressStartTime = Date.now();
                
                // 添加开始长按的视觉反馈
                sessionItem.classList.add('long-press-start');
                
                // 显示提示文本（延迟一点，避免立即显示）
                setTimeout(() => {
                    if (longPressStartTime && !hasMoved) {
                        hintText.style.opacity = '1';
                        hintText.style.transform = 'translate(-50%, -50%) scale(1)';
                    }
                }, 200);
                
                // 开始进度条动画
                let lastStage = 0;
                const progressInterval = 50; // 每50ms更新一次
                longPressProgressTimer = setInterval(() => {
                    if (hasMoved || !longPressStartTime) {
                        clearInterval(longPressProgressTimer);
                        return;
                    }
                    
                    const elapsed = Date.now() - longPressStartTime;
                    const progress = Math.min((elapsed / longPressThreshold) * 100, 100);
                    progressBar.style.width = progress + '%';
                    
                    // 在不同阶段添加反馈（确保每个阶段只触发一次）
                    if (progress >= 30 && progress < 35 && lastStage < 1) {
                        sessionItem.classList.add('long-press-stage-1');
                        lastStage = 1;
                    } else if (progress >= 60 && progress < 65 && lastStage < 2) {
                        sessionItem.classList.remove('long-press-stage-1');
                        sessionItem.classList.add('long-press-stage-2');
                        lastStage = 2;
                        triggerHapticFeedback(); // 中期震动
                    } else if (progress >= 90 && progress < 95 && lastStage < 3) {
                        sessionItem.classList.remove('long-press-stage-2');
                        sessionItem.classList.add('long-press-stage-3');
                        lastStage = 3;
                        triggerHapticFeedback(); // 接近完成时的震动
                    }
                    
                    if (progress >= 100) {
                        clearInterval(longPressProgressTimer);
                    }
                }, progressInterval);
                
                longPressTimer = setTimeout(async () => {
                    if (!hasMoved) {
                        isLongPressing = true;
                        sessionItem.classList.add('long-pressing');
                        triggerHapticFeedback(); // 触发删除前的震动
                        
                        // 触发删除（异步执行，删除完成后清除状态）
                        try {
                            await this.deleteSession(session.id);
                        } catch (error) {
                            console.error('删除会话失败:', error);
                        } finally {
                            // 清除长按状态
                            clearLongPress();
                        }
                    }
                }, longPressThreshold);
            };
            
            // 结束长按检测
            const endLongPress = () => {
                clearLongPress();
            };
            
            // 移动检测（取消长按）
            const handleMove = (e) => {
                const currentX = e.touches ? e.touches[0].clientX : e.clientX;
                const currentY = e.touches ? e.touches[0].clientY : e.clientY;
                const deltaX = Math.abs(currentX - startX);
                const deltaY = Math.abs(currentY - startY);
                
                if (deltaX > moveThreshold || deltaY > moveThreshold) {
                    hasMoved = true;
                    clearLongPress();
                }
            };
            
            // 触摸事件（移动设备）
            sessionItem.addEventListener('touchstart', (e) => {
                startLongPress(e);
            }, { passive: true });
            
            sessionItem.addEventListener('touchmove', (e) => {
                handleMove(e);
            }, { passive: true });
            
            sessionItem.addEventListener('touchend', () => {
                endLongPress();
            }, { passive: true });
            
            sessionItem.addEventListener('touchcancel', () => {
                endLongPress();
            }, { passive: true });
            
            // 鼠标事件（桌面设备）
            sessionItem.addEventListener('mousedown', (e) => {
                startLongPress(e);
            });
            
            sessionItem.addEventListener('mousemove', (e) => {
                if (longPressTimer) {
                    handleMove(e);
                }
            });
            
            sessionItem.addEventListener('mouseup', () => {
                endLongPress();
            });
            
            sessionItem.addEventListener('mouseleave', () => {
                endLongPress();
            });
            
            // 点击会话项切换到该会话
            sessionItem.addEventListener('click', async (e) => {
                // 如果正在长按，不执行点击
                if (isLongPressing || hasMoved) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                // 如果正在切换，忽略点击
                if (this.isSwitchingSession) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                // 如果点击的是当前会话，不执行操作（但仍添加视觉反馈）
                if (session.id === this.currentSessionId) {
                    // 添加轻微反馈提示这是当前会话
                    sessionItem.classList.add('clicked');
                    setTimeout(() => {
                        sessionItem.classList.remove('clicked');
                    }, 150);
                    return;
                }
                
                // 立即添加点击反馈
                sessionItem.classList.add('clicked');
                
                // 防止重复点击：快速禁用
                sessionItem.style.pointerEvents = 'none';
                
                try {
                    // 切换会话
                    await this.switchSession(session.id);
                } catch (error) {
                    console.error('切换会话失败:', error);
                    // 移除加载状态
                    sessionItem.classList.remove('switching', 'clicked');
                } finally {
                    // 恢复交互（延迟一点，避免过快重复点击）
                    setTimeout(() => {
                        sessionItem.style.pointerEvents = '';
                        sessionItem.classList.remove('clicked');
                    }, 300);
                }
            });
            
            sessionList.appendChild(sessionItem);
        }
        
        console.log('会话侧边栏已更新，显示', sortedSessions.length, '个会话');
    }

    // 删除会话
    async deleteSession(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) return;
        
        // 获取会话标题用于提示
        const session = this.sessions[sessionId];
        const sessionTitle = session?.title || sessionId || '未命名会话';
        
        // 确认删除
        const confirmDelete = confirm(`确定要删除会话"${sessionTitle}"吗？`);
        if (!confirmDelete) return;
        
        // 记录是否删除的是当前会话
        const isCurrentSession = sessionId === this.currentSessionId;
        
        // 如果删除的是当前会话，先保存当前会话
        if (isCurrentSession) {
            await this.saveCurrentSession();
        }
        
        // 从后端删除会话（如果启用了后端同步）
        if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            try {
                // 确保使用 session.id 作为统一标识
                const unifiedSessionId = session.id || sessionId;
                await this.sessionApi.deleteSession(unifiedSessionId);
                console.log('会话已从后端删除:', unifiedSessionId);
            } catch (error) {
                console.warn('从后端删除会话失败:', error);
                // 即使后端删除失败，也继续本地删除，确保用户界面响应
            }
        }
        
        // 从本地删除会话
        delete this.sessions[sessionId];
        await this.saveAllSessions();
        
        // 如果删除的是当前会话，切换到其他会话或清空
        if (isCurrentSession) {
            // 查找最新的其他会话
            const otherSessions = Object.values(this.sessions);
            
            if (otherSessions.length > 0) {
                // 切换到最近访问的会话（使用 lastAccessTime，更符合"最新使用"的概念）
                // 如果没有 lastAccessTime，则使用 createdAt 作为备选
                const latestSession = otherSessions.sort((a, b) => {
                    const aTime = a.lastAccessTime || a.createdAt || 0;
                    const bTime = b.lastAccessTime || b.createdAt || 0;
                    return bTime - aTime; // 最近访问的在前
                })[0];
                
                await this.activateSession(latestSession.id, {
                    saveCurrent: false, // 已经在前面保存了
                    updateUI: true
                });
            } else {
                // 没有其他会话，清空当前会话
                this.currentSessionId = null;
                this.hasAutoCreatedSessionForPage = false;
                
                // 清空消息显示
                if (this.chatWindow && this.isChatOpen) {
                    const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '';
                    }
                }
            }
        }
        
        // 更新侧边栏
        await this.updateSessionUI({ updateSidebar: true });
        
        console.log('会话已删除:', sessionId);
    }

    // 加载侧边栏宽度
    loadSidebarWidth() {
        try {
            chrome.storage.local.get(['sessionSidebarWidth'], (result) => {
                if (result.sessionSidebarWidth && typeof result.sessionSidebarWidth === 'number') {
                    // 验证宽度是否在合理范围内
                    const width = Math.max(150, Math.min(500, result.sessionSidebarWidth));
                    this.sidebarWidth = width;
                    console.log('加载侧边栏宽度:', width);
                    
                    // 如果侧边栏已创建，更新其宽度
                    if (this.sessionSidebar) {
                        this.sessionSidebar.style.setProperty('width', `${width}px`, 'important');
                    }
                }
            });
        } catch (error) {
            console.log('加载侧边栏宽度失败:', error);
        }
    }

    // 保存侧边栏宽度
    saveSidebarWidth() {
        try {
            chrome.storage.local.set({ sessionSidebarWidth: this.sidebarWidth }, () => {
                console.log('保存侧边栏宽度:', this.sidebarWidth);
            });
        } catch (error) {
            console.log('保存侧边栏宽度失败:', error);
        }
    }

    // 创建侧边栏拖拽调整边框
    createSidebarResizer() {
        if (!this.sessionSidebar) return;

        const resizer = document.createElement('div');
        resizer.className = 'sidebar-resizer';
        resizer.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            right: -4px !important;
            width: 8px !important;
            height: 100% !important;
            cursor: col-resize !important;
            z-index: 10 !important;
            background: transparent !important;
            transition: background 0.2s ease !important;
        `;

        // 鼠标悬停效果
        resizer.addEventListener('mouseenter', () => {
            if (!this.isResizingSidebar) {
                resizer.style.setProperty('background', 'rgba(59, 130, 246, 0.3)', 'important');
            }
        });

        resizer.addEventListener('mouseleave', () => {
            if (!this.isResizingSidebar) {
                resizer.style.setProperty('background', 'transparent', 'important');
            }
        });

        // 拖拽开始
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            this.isResizingSidebar = true;
            resizer.style.setProperty('background', 'rgba(59, 130, 246, 0.5)', 'important');
            resizer.style.setProperty('cursor', 'col-resize', 'important');
            
            // 记录初始位置和宽度
            const startX = e.clientX;
            const startWidth = this.sidebarWidth;
            
            // 添加全局样式，禁用文本选择
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            
            // 拖拽中
            const handleMouseMove = (e) => {
                if (!this.isResizingSidebar) return;
                
                const diffX = e.clientX - startX;
                let newWidth = startWidth + diffX;
                
                // 限制宽度范围
                newWidth = Math.max(150, Math.min(500, newWidth));
                
                // 更新宽度
                this.sidebarWidth = newWidth;
                if (this.sessionSidebar) {
                    this.sessionSidebar.style.setProperty('width', `${newWidth}px`, 'important');
                }
            };
            
            // 拖拽结束
            const handleMouseUp = () => {
                this.isResizingSidebar = false;
                resizer.style.setProperty('background', 'transparent', 'important');
                resizer.style.setProperty('cursor', 'col-resize', 'important');
                
                // 恢复全局样式
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                
                // 保存宽度
                this.saveSidebarWidth();
                
                // 移除事件监听器
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            // 添加全局事件监听器
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        this.sessionSidebar.appendChild(resizer);
    }

    formatSessionTime(timestamp) {
        if (!timestamp) return '';
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return new Date(timestamp).toLocaleDateString('zh-CN');
    }

    // 确保上下文编辑器 UI 存在
    ensureContextEditorUi() {
        if (!this.chatWindow) return;
        if (document.getElementById('pet-context-editor')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pet-context-editor';
        // 初始使用顶部不遮住 chat-header 的定位（根据当前 header 高度）
        const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
        const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
        overlay.style.cssText = `
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            top: ${headerH}px !important;
            background: transparent !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: ${PET_CONFIG.ui.zIndex.inputContainer + 1} !important;
            pointer-events: none !important;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            width: calc(100% - 24px) !important;
            height: calc(100% - 12px) !important;
            margin: 0 12px 12px 12px !important;
            background: #1f1f1f !important;
            color: #fff !important;
            border-radius: 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            min-height: 0 !important;
            pointer-events: auto !important;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 10px 14px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            background: rgba(255,255,255,0.04) !important;
        `;
        const title = document.createElement('div');
        title.textContent = '页面上下文（Markdown）';
        title.style.cssText = 'font-weight: 600;';
        const headerBtns = document.createElement('div');
        headerBtns.style.cssText = 'display:flex; gap:8px; align-items:center;';
        // 简洁模式切换：并排 / 仅编辑 / 仅预览
        const modeGroup = document.createElement('div');
        modeGroup.style.cssText = `
            display: inline-flex !important;
            gap: 6px !important;
            background: rgba(255,255,255,0.04) !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            border-radius: 8px !important;
            padding: 4px !important;
        `;
        const makeModeBtn = (id, label, mode) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.textContent = label;
            btn.style.cssText = `
                padding: 4px 8px !important;
                font-size: 12px !important;
                border-radius: 6px !important;
                border: none !important;
                background: transparent !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
            `;
            btn.addEventListener('click', () => this.setContextMode(mode));
            return btn;
        };
        const btnSplit = makeModeBtn('pet-context-mode-split', '并排', 'split');
        const btnEdit = makeModeBtn('pet-context-mode-edit', '仅编辑', 'edit');
        const btnPreview = makeModeBtn('pet-context-mode-preview', '仅预览', 'preview');
        modeGroup.appendChild(btnSplit);
        modeGroup.appendChild(btnEdit);
        modeGroup.appendChild(btnPreview);
        const closeBtn = document.createElement('button');
        closeBtn.id = 'pet-context-close-btn';
        closeBtn.className = 'chat-toolbar-btn';
        closeBtn.setAttribute('aria-label', '关闭上下文面板 (Esc)');
        closeBtn.setAttribute('title', '关闭 (Esc)');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            width: 28px !important;
            height: 28px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.12)';
            closeBtn.style.borderColor = 'rgba(255,255,255,0.25)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.04)';
            closeBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        closeBtn.addEventListener('mousedown', () => {
            closeBtn.style.transform = 'scale(0.96)';
        });
        closeBtn.addEventListener('mouseup', () => {
            closeBtn.style.transform = 'scale(1)';
        });
        closeBtn.addEventListener('click', () => this.closeContextEditor());
        headerBtns.appendChild(modeGroup);
        // 复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.id = 'pet-context-copy-btn';
        copyBtn.className = 'chat-toolbar-btn';
        copyBtn.setAttribute('title', '复制内容');
        copyBtn.textContent = '复制';
        copyBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
        `;
        copyBtn.addEventListener('mouseenter', () => {
            copyBtn.style.background = 'rgba(255,255,255,0.12)';
            copyBtn.style.borderColor = 'rgba(255,255,255,0.25)';
        });
        copyBtn.addEventListener('mouseleave', () => {
            copyBtn.style.background = 'rgba(255,255,255,0.04)';
            copyBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        copyBtn.addEventListener('click', () => this.copyContextEditor());
        // 下载按钮（导出 Markdown）
        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'pet-context-download-btn';
        downloadBtn.className = 'chat-toolbar-btn';
        downloadBtn.setAttribute('title', '下载当前上下文为 Markdown (.md)');
        downloadBtn.textContent = '下载';
        downloadBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
        `;
        downloadBtn.addEventListener('click', () => this.downloadContextMarkdown());
        headerBtns.appendChild(copyBtn);
        headerBtns.appendChild(downloadBtn);
        headerBtns.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(headerBtns);

        const body = document.createElement('div');
        body.style.cssText = `
            flex: 1 !important;
            display: flex !important;
            padding: 10px !important;
            gap: 10px !important;
            min-height: 0 !important;
        `;
        const textarea = document.createElement('textarea');
        textarea.id = 'pet-context-editor-textarea';
        textarea.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #121212 !important;
            color: #fff !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace !important;
            font-size: 12px !important;
            line-height: 1.6 !important;
            outline: none !important;
            resize: none !important;
            white-space: pre-wrap !important;
            min-height: 0 !important;
            overflow: auto !important;
            -webkit-overflow-scrolling: touch !important;
        `;
        const preview = document.createElement('div');
        preview.id = 'pet-context-preview';
        preview.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #0e0e0e !important;
            color: #e5e7eb !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            pointer-events: auto !important;
        `;
        // 防止滚动事件冒泡到父级，保证自身滚动有效
        preview.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
        preview.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
        // 编辑时实时更新预览（防抖）
        textarea.addEventListener('input', () => {
            if (this._contextPreviewTimer) clearTimeout(this._contextPreviewTimer);
            this._contextPreviewTimer = setTimeout(() => {
                this.updateContextPreview();
            }, 150);
        });
        // 同步滚动（比例映射）
        textarea.addEventListener('scroll', () => {
            const previewEl = this.chatWindow ? this.chatWindow.querySelector('#pet-context-preview') : null;
            if (!previewEl) return;
            const tMax = textarea.scrollHeight - textarea.clientHeight;
            const pMax = previewEl.scrollHeight - previewEl.clientHeight;
            if (tMax > 0 && pMax >= 0) {
                const ratio = textarea.scrollTop / tMax;
                previewEl.scrollTop = ratio * pMax;
            }
        });
        body.appendChild(textarea);
        body.appendChild(preview);

        panel.appendChild(header);
        panel.appendChild(body);
        overlay.appendChild(panel);
        // 确保聊天窗口容器为定位上下文
        const currentPosition = window.getComputedStyle(this.chatWindow).position;
        if (currentPosition === 'static') {
            this.chatWindow.style.position = 'relative';
        }
        this.chatWindow.appendChild(overlay);
    }

    openContextEditor() {
        this.ensureContextEditorUi();
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor') : null;
        if (!overlay) return;
        overlay.style.display = 'flex';
        // 打开时根据当前 header 高度校正位置
        this.updateContextEditorPosition();
        this.loadContextIntoEditor();
        this.updateContextPreview();
        // 默认并排模式
        this._contextPreviewMode = this._contextPreviewMode || 'split';
        this.applyContextPreviewMode();
        // Esc 关闭
        this._contextKeydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeContextEditor();
            }
        };
        document.addEventListener('keydown', this._contextKeydownHandler, { capture: true });
        // 监听窗口尺寸变化，动态更新覆盖层位置
        this._contextResizeHandler = () => this.updateContextEditorPosition();
        window.addEventListener('resize', this._contextResizeHandler, { passive: true });
    }

    closeContextEditor() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor') : null;
        if (overlay) overlay.style.display = 'none';
        
        // 保存用户编辑的页面上下文到会话
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (textarea && this.currentSessionId && this.sessions[this.currentSessionId]) {
            const editedContent = textarea.value || '';
            this.sessions[this.currentSessionId].pageContent = editedContent;
            // 异步保存，不阻塞关闭
            this.saveAllSessions().catch(err => console.error('保存编辑的页面上下文失败:', err));
        }
        
        if (this._contextKeydownHandler) {
            document.removeEventListener('keydown', this._contextKeydownHandler, { capture: true });
            this._contextKeydownHandler = null;
        }
        if (this._contextResizeHandler) {
            window.removeEventListener('resize', this._contextResizeHandler);
            this._contextResizeHandler = null;
        }
    }

    setContextMode(mode) {
        this._contextPreviewMode = mode; // 'split' | 'edit' | 'preview'
        this.applyContextPreviewMode();
    }

    applyContextPreviewMode() {
        if (!this.chatWindow) return;
        const textarea = this.chatWindow.querySelector('#pet-context-editor-textarea');
        const preview = this.chatWindow.querySelector('#pet-context-preview');
        const btnSplit = this.chatWindow.querySelector('#pet-context-mode-split');
        const btnEdit = this.chatWindow.querySelector('#pet-context-mode-edit');
        const btnPreview = this.chatWindow.querySelector('#pet-context-mode-preview');
        if (!textarea || !preview) return;
        const mode = this._contextPreviewMode;
        const isPreviewOnly = mode === 'preview';
        const isEditOnly = mode === 'edit';
        textarea.style.display = isPreviewOnly ? 'none' : 'block';
        preview.style.display = isEditOnly ? 'none' : 'block';
        textarea.style.width = isEditOnly ? '100%' : (isPreviewOnly ? '0%' : '50%');
        preview.style.width = isPreviewOnly ? '100%' : (isEditOnly ? '0%' : '50%');
        // 激活态样式更简单：当前模式高亮底色
        const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
        const resetBtn = (b) => { if (!b) return; b.style.background = 'transparent'; b.style.color = '#e5e7eb'; b.style.border = 'none'; };
        const activateBtn = (b) => { if (!b) return; b.style.background = currentMainColor; b.style.color = '#fff'; b.style.border = 'none'; };
        resetBtn(btnSplit); resetBtn(btnEdit); resetBtn(btnPreview);
        if (mode === 'split') activateBtn(btnSplit);
        if (mode === 'edit') activateBtn(btnEdit);
        if (mode === 'preview') activateBtn(btnPreview);
    }

    // ========== 消息编辑器（类似上下文编辑器） ==========
    
    // 确保消息编辑器 UI 存在
    ensureMessageEditorUi() {
        if (!this.chatWindow) return;
        if (document.getElementById('pet-message-editor')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pet-message-editor';
        const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
        const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
        overlay.style.cssText = `
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            top: ${headerH}px !important;
            background: transparent !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: ${PET_CONFIG.ui.zIndex.inputContainer + 1} !important;
            pointer-events: none !important;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            width: calc(100% - 24px) !important;
            height: calc(100% - 12px) !important;
            margin: 0 12px 12px 12px !important;
            background: #1f1f1f !important;
            color: #fff !important;
            border-radius: 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            min-height: 0 !important;
            pointer-events: auto !important;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 10px 14px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            background: rgba(255,255,255,0.04) !important;
        `;
        const title = document.createElement('div');
        title.textContent = '编辑消息';
        title.style.cssText = 'font-weight: 600;';
        const headerBtns = document.createElement('div');
        headerBtns.style.cssText = 'display:flex; gap:8px; align-items:center;';
        
        // 模式切换：并排 / 仅编辑 / 仅预览
        const modeGroup = document.createElement('div');
        modeGroup.style.cssText = `
            display: inline-flex !important;
            gap: 6px !important;
            background: rgba(255,255,255,0.04) !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            border-radius: 8px !important;
            padding: 4px !important;
        `;
        const makeModeBtn = (id, label, mode) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.textContent = label;
            btn.style.cssText = `
                padding: 4px 8px !important;
                font-size: 12px !important;
                border-radius: 6px !important;
                border: none !important;
                background: transparent !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
            `;
            btn.addEventListener('click', () => this.setMessageEditorMode(mode));
            return btn;
        };
        const btnSplit = makeModeBtn('pet-message-mode-split', '并排', 'split');
        const btnEdit = makeModeBtn('pet-message-mode-edit', '仅编辑', 'edit');
        const btnPreview = makeModeBtn('pet-message-mode-preview', '仅预览', 'preview');
        modeGroup.appendChild(btnSplit);
        modeGroup.appendChild(btnEdit);
        modeGroup.appendChild(btnPreview);
        
        // 保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.id = 'pet-message-save-btn';
        saveBtn.className = 'chat-toolbar-btn';
        saveBtn.setAttribute('title', '保存 (Ctrl+Enter)');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 4px 12px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(76, 175, 80, 0.3) !important;
            color: #4caf50 !important;
            cursor: pointer !important;
        `;
        saveBtn.addEventListener('click', () => this.saveMessageEditor());
        
        // 复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.id = 'pet-message-copy-btn';
        copyBtn.className = 'chat-toolbar-btn';
        copyBtn.setAttribute('title', '复制内容');
        copyBtn.textContent = '复制';
        copyBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
        `;
        copyBtn.addEventListener('mouseenter', () => {
            copyBtn.style.background = 'rgba(255,255,255,0.12)';
            copyBtn.style.borderColor = 'rgba(255,255,255,0.25)';
        });
        copyBtn.addEventListener('mouseleave', () => {
            copyBtn.style.background = 'rgba(255,255,255,0.04)';
            copyBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        copyBtn.addEventListener('click', () => this.copyMessageEditor());
        
        // 下载按钮（导出 Markdown）
        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'pet-message-download-btn';
        downloadBtn.className = 'chat-toolbar-btn';
        downloadBtn.setAttribute('title', '下载为 Markdown (.md)');
        downloadBtn.textContent = '下载';
        downloadBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
        `;
        downloadBtn.addEventListener('click', () => this.downloadMessageMarkdown());
        
        // 取消/关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.id = 'pet-message-close-btn';
        closeBtn.className = 'chat-toolbar-btn';
        closeBtn.setAttribute('aria-label', '关闭编辑器 (Esc)');
        closeBtn.setAttribute('title', '取消 (Esc)');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            width: 28px !important;
            height: 28px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.12)';
            closeBtn.style.borderColor = 'rgba(255,255,255,0.25)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.04)';
            closeBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        closeBtn.addEventListener('click', () => this.closeMessageEditor());
        
        headerBtns.appendChild(modeGroup);
        headerBtns.appendChild(copyBtn);
        headerBtns.appendChild(downloadBtn);
        headerBtns.appendChild(saveBtn);
        headerBtns.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(headerBtns);

        const body = document.createElement('div');
        body.style.cssText = `
            flex: 1 !important;
            display: flex !important;
            padding: 10px !important;
            gap: 10px !important;
            min-height: 0 !important;
        `;
        const textarea = document.createElement('textarea');
        textarea.id = 'pet-message-editor-textarea';
        textarea.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #121212 !important;
            color: #fff !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace !important;
            font-size: 12px !important;
            line-height: 1.6 !important;
            outline: none !important;
            resize: none !important;
            white-space: pre-wrap !important;
            min-height: 0 !important;
            overflow: auto !important;
            -webkit-overflow-scrolling: touch !important;
        `;
        const preview = document.createElement('div');
        preview.id = 'pet-message-preview';
        preview.className = 'markdown-content';
        preview.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #0e0e0e !important;
            color: #e5e7eb !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            pointer-events: auto !important;
        `;
        // 防止滚动事件冒泡
        preview.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
        preview.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
        
        // 编辑时实时更新预览（防抖）
        textarea.addEventListener('input', () => {
            if (this._messagePreviewTimer) clearTimeout(this._messagePreviewTimer);
            this._messagePreviewTimer = setTimeout(() => {
                this.updateMessagePreview();
            }, 150);
        });
        
        // 同步滚动
        textarea.addEventListener('scroll', () => {
            const previewEl = this.chatWindow ? this.chatWindow.querySelector('#pet-message-preview') : null;
            if (!previewEl) return;
            const tMax = textarea.scrollHeight - textarea.clientHeight;
            const pMax = previewEl.scrollHeight - previewEl.clientHeight;
            if (tMax > 0 && pMax >= 0) {
                const ratio = textarea.scrollTop / tMax;
                previewEl.scrollTop = ratio * pMax;
            }
        });
        
        // Ctrl+Enter 保存，Esc 关闭
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.saveMessageEditor();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.closeMessageEditor();
            }
        });
        
        body.appendChild(textarea);
        body.appendChild(preview);

        panel.appendChild(header);
        panel.appendChild(body);
        overlay.appendChild(panel);
        
        // 确保聊天窗口容器为定位上下文
        const currentPosition = window.getComputedStyle(this.chatWindow).position;
        if (currentPosition === 'static') {
            this.chatWindow.style.position = 'relative';
        }
        this.chatWindow.appendChild(overlay);
    }

    openMessageEditor(messageElement, sender) {
        this.ensureMessageEditorUi();
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        if (!overlay) return;

        // 保存当前编辑的消息元素和发送者
        this._editingMessageElement = messageElement;
        this._editingMessageSender = sender;
        
        // 获取原始内容
        let originalText = messageElement.getAttribute('data-original-text') || '';
        if (!originalText) {
            originalText = messageElement.innerText || messageElement.textContent || '';
        }
        
        const textarea = overlay.querySelector('#pet-message-editor-textarea');
        if (textarea) {
            textarea.value = originalText;
        }
        
        overlay.style.display = 'flex';
        this.updateContextEditorPosition(); // 复用位置更新函数
        this.updateMessagePreview();
        
        // 默认并排模式
        this._messageEditorMode = this._messageEditorMode || 'split';
        this.applyMessageEditorMode();
        
        // Esc 关闭
        this._messageKeydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeMessageEditor();
            }
        };
        document.addEventListener('keydown', this._messageKeydownHandler, { capture: true });
        
        // 监听窗口尺寸变化
        this._messageResizeHandler = () => this.updateContextEditorPosition();
        window.addEventListener('resize', this._messageResizeHandler, { passive: true });
        
        // 聚焦到文本区域
        setTimeout(() => {
            if (textarea) {
                textarea.focus();
            }
        }, 100);
    }

    closeMessageEditor() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        if (overlay) overlay.style.display = 'none';
        
        this._editingMessageElement = null;
        this._editingMessageSender = null;
        
        if (this._messageKeydownHandler) {
            document.removeEventListener('keydown', this._messageKeydownHandler, { capture: true });
            this._messageKeydownHandler = null;
        }
        if (this._messageResizeHandler) {
            window.removeEventListener('resize', this._messageResizeHandler);
            this._messageResizeHandler = null;
        }
        if (this._messagePreviewTimer) {
            clearTimeout(this._messagePreviewTimer);
            this._messagePreviewTimer = null;
        }
    }

    setMessageEditorMode(mode) {
        this._messageEditorMode = mode; // 'split' | 'edit' | 'preview'
        this.applyMessageEditorMode();
    }

    applyMessageEditorMode() {
        if (!this.chatWindow) return;
        const textarea = this.chatWindow.querySelector('#pet-message-editor-textarea');
        const preview = this.chatWindow.querySelector('#pet-message-preview');
        const btnSplit = this.chatWindow.querySelector('#pet-message-mode-split');
        const btnEdit = this.chatWindow.querySelector('#pet-message-mode-edit');
        const btnPreview = this.chatWindow.querySelector('#pet-message-mode-preview');
        if (!textarea || !preview) return;
        
        const mode = this._messageEditorMode;
        const isPreviewOnly = mode === 'preview';
        const isEditOnly = mode === 'edit';
        textarea.style.display = isPreviewOnly ? 'none' : 'block';
        preview.style.display = isEditOnly ? 'none' : 'block';
        textarea.style.width = isEditOnly ? '100%' : (isPreviewOnly ? '0%' : '50%');
        preview.style.width = isPreviewOnly ? '100%' : (isEditOnly ? '0%' : '50%');
        
        // 激活态样式
        const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
        const resetBtn = (b) => { if (!b) return; b.style.background = 'transparent'; b.style.color = '#e5e7eb'; b.style.border = 'none'; };
        const activateBtn = (b) => { if (!b) return; b.style.background = currentMainColor; b.style.color = '#fff'; b.style.border = 'none'; };
        resetBtn(btnSplit); resetBtn(btnEdit); resetBtn(btnPreview);
        if (mode === 'split') activateBtn(btnSplit);
        if (mode === 'edit') activateBtn(btnEdit);
        if (mode === 'preview') activateBtn(btnPreview);
    }

    updateMessagePreview() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor-textarea') : null;
        const preview = this.chatWindow ? this.chatWindow.querySelector('#pet-message-preview') : null;
        if (!textarea || !preview) return;
        
        const markdown = textarea.value || '';
        preview.innerHTML = this.renderMarkdown(markdown);
        
        // 渲染 mermaid（若有）- 防抖
        if (preview._mermaidTimer) {
            clearTimeout(preview._mermaidTimer);
            preview._mermaidTimer = null;
        }
        preview._mermaidTimer = setTimeout(async () => {
            await this.processMermaidBlocks(preview);
            preview._mermaidTimer = null;
        }, 200);
    }

    saveMessageEditor() {
        if (!this._editingMessageElement || !this._editingMessageSender) return;
        
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        const textarea = overlay ? overlay.querySelector('#pet-message-editor-textarea') : null;
        if (!textarea) return;
        
        const newText = textarea.value.trim();
        if (!newText) {
            // 如果内容为空，关闭编辑器
            this.closeMessageEditor();
            return;
        }
        
        const messageElement = this._editingMessageElement;
        const sender = this._editingMessageSender;
        
        // 更新消息内容
        if (sender === 'pet') {
            // 对于宠物消息，使用Markdown渲染
            const oldText = messageElement.getAttribute('data-original-text') || messageElement.textContent || '';
            messageElement.innerHTML = this.renderMarkdown(newText);
            messageElement.classList.add('markdown-content');
            messageElement.setAttribute('data-original-text', newText);
            
            // 更新会话中对应的消息内容
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                if (session.messages && Array.isArray(session.messages)) {
                    // 找到对应的消息并更新
                    const messageIndex = session.messages.findIndex(msg => 
                        msg.type === 'pet' && 
                        (msg.content === oldText || msg.content.trim() === oldText.trim())
                    );
                    
                    if (messageIndex !== -1) {
                        session.messages[messageIndex].content = newText;
                        session.updatedAt = Date.now();
                        // 异步保存会话
                        this.saveAllSessions().catch(err => {
                            console.error('更新消息后保存会话失败:', err);
                        });
                        console.log(`已更新会话 ${this.currentSessionId} 中的消息内容`);
                    }
                }
            }
            
            // 处理可能的 Mermaid 图表
            setTimeout(async () => {
                try {
                    await this.loadMermaid();
                    const hasMermaidCode = messageElement.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                    if (hasMermaidCode) {
                        await this.processMermaidBlocks(messageElement);
                    }
                } catch (error) {
                    console.error('处理编辑后的 Mermaid 图表时出错:', error);
                }
            }, 200);
        } else {
            // 对于用户消息
            const hasMarkdown = /[#*_`\[\]()!]|```/.test(newText);
            
            if (hasMarkdown) {
                messageElement.innerHTML = this.renderMarkdown(newText);
                messageElement.classList.add('markdown-content');
                messageElement.setAttribute('data-original-text', newText);
                
                // 处理可能的 Mermaid 图表
                setTimeout(async () => {
                    try {
                        await this.loadMermaid();
                        const hasMermaidCode = messageElement.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                        if (hasMermaidCode) {
                            await this.processMermaidBlocks(messageElement);
                        }
                    } catch (error) {
                        console.error('处理编辑后的 Mermaid 图表时出错:', error);
                    }
                }, 200);
            } else {
                messageElement.textContent = newText;
                messageElement.setAttribute('data-original-text', newText);
            }
        }
        
        messageElement.setAttribute('data-edited', 'true');
        
        // 关闭编辑器
        this.closeMessageEditor();
    }

    // 复制消息编辑器内容
    copyMessageEditor() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        const textarea = overlay ? overlay.querySelector('#pet-message-editor-textarea') : null;
        if (!textarea) return;
        
        const content = textarea.value || '';
        if (!content.trim()) return;
        
        // 复制到剪贴板
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            // 显示复制成功反馈
            const copyBtn = overlay ? overlay.querySelector('#pet-message-copy-btn') : null;
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '已复制';
                copyBtn.style.background = 'rgba(76, 175, 80, 0.3)';
                copyBtn.style.color = '#4caf50';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = 'rgba(255,255,255,0.04)';
                    copyBtn.style.color = '#e5e7eb';
                }, 1500);
            }
        } catch (err) {
            console.error('复制失败:', err);
        }
        
        document.body.removeChild(textArea);
    }

    // 下载消息编辑器内容为 Markdown
    downloadMessageMarkdown() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        const textarea = overlay ? overlay.querySelector('#pet-message-editor-textarea') : null;
        if (!textarea) return;
        
        const content = textarea.value || '';
        if (!content.trim()) return;
        
        // 生成文件名（使用时间戳）
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const filename = `message_${stamp}.md`;
        
        try {
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                if (a.parentNode) a.parentNode.removeChild(a);
            }, 0);
        } catch (e) {
            console.error('下载失败:', e);
        }
    }

    // 统一获取角色图标（优先自定义，其次按 actionKey 映射，最后兜底）
    getRoleIcon(roleConfig, allConfigs = null) {
        if (!roleConfig) return '🙂';
        
        // 优先使用配置中的自定义图标
        const icon = roleConfig.icon;
        const custom = icon && typeof icon === 'string' ? icon.trim() : '';
        if (custom) return custom;
        
        // 如果没有自定义图标，从角色配置列表中查找
        const actionKey = roleConfig.actionKey;
        if (actionKey && allConfigs && Array.isArray(allConfigs)) {
            const foundConfig = allConfigs.find(c => c && c.actionKey === actionKey);
            if (foundConfig && foundConfig.icon && typeof foundConfig.icon === 'string') {
                const foundIcon = foundConfig.icon.trim();
                if (foundIcon) return foundIcon;
            }
        }
        
        // 如果还是找不到，返回默认图标
        return '🙂';
    }

    // 统一获取角色标签/名称（优先自定义，其次从角色配置列表中查找）
    getRoleLabel(roleConfig, allConfigs = null) {
        if (!roleConfig) return '自定义角色';
        
        // 优先使用配置中的自定义标签
        if (roleConfig.label && typeof roleConfig.label === 'string') {
            const label = roleConfig.label.trim();
            if (label) return label;
        }
        
        // 如果没有自定义标签，从角色配置列表中查找
        const actionKey = roleConfig.actionKey;
        if (actionKey && allConfigs && Array.isArray(allConfigs)) {
            const foundConfig = allConfigs.find(c => c && c.actionKey === actionKey);
            if (foundConfig && foundConfig.label && typeof foundConfig.label === 'string') {
                const label = foundConfig.label.trim();
                if (label) return label;
            }
        }
        
        // 如果还是找不到，使用actionKey作为默认标签
        if (actionKey) {
            return actionKey;
        }
        
        return '自定义角色';
    }

    // 统一获取角色提示语（用于按钮的 title 属性，支持自定义）
    getRoleTooltip(roleConfig) {
        // 优先使用配置中的自定义提示语
        if (roleConfig && roleConfig.tooltip && typeof roleConfig.tooltip === 'string') {
            const tooltip = roleConfig.tooltip.trim();
            if (tooltip) return tooltip;
        }
        
        // 如果没有自定义提示语，使用标签作为提示语
        return this.getRoleLabel(roleConfig);
    }

    // 统一获取角色完整信息（图标、标签、提示语等）
    async getRoleInfoForAction(actionKey) {
        try {
            const configs = await this.getRoleConfigs();
            const cfg = Array.isArray(configs) ? configs.find(c => c && c.actionKey === actionKey) : null;
            
            return {
                icon: this.getRoleIcon(cfg || { actionKey }, configs),
                label: this.getRoleLabel(cfg || { actionKey }, configs),
                tooltip: this.getRoleTooltip(cfg || { actionKey }),
                config: cfg
            };
        } catch (error) {
            console.error('获取角色信息失败:', error);
            // 降级处理
            const fallbackConfig = { actionKey };
            return {
                icon: this.getRoleIcon(fallbackConfig, null),
                label: this.getRoleLabel(fallbackConfig, null),
                tooltip: this.getRoleTooltip(fallbackConfig),
                config: null
            };
        }
    }

    // 根据 actionKey 从角色配置中获取提示语（必须从角色配置中获取 prompt）
    async getRolePromptForAction(actionKey, pageInfo) {
        // 获取角色信息（图标、标签等）
        const roleInfo = await this.getRoleInfoForAction(actionKey);
        const cfg = roleInfo.config;
        
        // 检查角色配置中是否有 prompt
        if (!cfg || !cfg.prompt || !cfg.prompt.trim()) {
            throw new Error(`角色 ${actionKey} 未配置 prompt，请在角色设置中配置提示词`);
        }
        
        const pageTitle = pageInfo.title || document.title || '当前页面';
        const pageUrl = pageInfo.url || window.location.href;
        const pageDescription = pageInfo.description || '';
        const pageContent = pageInfo.content || '';
        
        // 构建 userPrompt
        const userPrompt = `页面标题：${pageTitle}
页面URL：${pageUrl}
${pageDescription ? `页面描述：${pageDescription}` : ''}

页面内容（Markdown 格式）：
${pageContent || '无内容'}

请根据以上信息进行分析和处理。`;
        
        return {
            systemPrompt: cfg.prompt.trim(),
            userPrompt: userPrompt,
            label: roleInfo.label,
            icon: roleInfo.icon
        };
    }

    // 通用的流式生成函数，支持动态 systemPrompt 和 userPrompt
    async generateContentStream(systemPrompt, userPrompt, onContent, loadingText = '正在处理...') {
        try {
            console.log('调用大模型生成内容，systemPrompt长度:', systemPrompt ? systemPrompt.length : 0);
            
            // 使用统一的 payload 构建函数，自动包含会话 ID
            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt,
                this.currentModel
            );
            
            // 调用大模型 API（使用流式接口）
            const apiUrl = PET_CONFIG.api.streamPromptUrl;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            // 使用通用的流式响应处理
            return await this.processStreamingResponse(response, onContent);
        } catch (error) {
            console.error('生成内容失败:', error);
            throw error;
        }
    }

    // 将角色设置应用到欢迎消息下方的动作按钮（根据 actionKey 动态更新图标、标题和提示语）
    async applyRoleConfigToActionIcon(iconEl, actionKey) {
        try {
            if (!iconEl || !actionKey) return;
            
            // 使用统一的角色信息获取函数
            const roleInfo = await this.getRoleInfoForAction(actionKey);
            
            // 更新按钮的图标、标题和提示语
            iconEl.innerHTML = roleInfo.icon || iconEl.innerHTML;
            iconEl.title = roleInfo.tooltip;
        } catch (_) { /* 忽略展示更新错误 */ }
    }

    // 创建动作按钮（根据角色配置动态创建）
    async createActionButton(actionKey) {
        const button = document.createElement('span');
        button.setAttribute('data-action-key', actionKey);
        
        // 从角色配置中动态获取图标、标签和提示语
        try {
            const roleInfo = await this.getRoleInfoForAction(actionKey);
            button.innerHTML = roleInfo.icon || '🙂';
            button.title = roleInfo.tooltip;
        } catch (error) {
            // 降级到默认值
            const fallbackInfo = await this.getRoleInfoForAction(actionKey);
            button.innerHTML = fallbackInfo.icon || '🙂';
            button.title = fallbackInfo.tooltip;
        }
        
        // 统一的按钮样式
        button.style.cssText = `
            padding: 4px !important;
            cursor: pointer !important;
            font-size: 16px !important;
            color: #666 !important;
            font-weight: 300 !important;
            transition: all 0.2s ease !important;
            flex-shrink: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            user-select: none !important;
            width: 22px !important;
            height: 22px !important;
            line-height: 22px !important;
        `;
        
        return button;
    }

    // 获取按角色设置列表顺序排列的已绑定角色的 actionKey 列表
    // 此方法与 renderRoleSettingsList() 共享相同的顺序逻辑
    async getOrderedBoundRoleKeys() {
        const configsRaw = await this.getRoleConfigs();
        const configs = Array.isArray(configsRaw) ? configsRaw : [];
        
        // 返回所有有 actionKey 的角色的 actionKey（保持配置中的顺序）
        const orderedKeys = [];
        const seenKeys = new Set();
        for (const config of configs) {
            if (config && config.actionKey && !seenKeys.has(config.actionKey)) {
                orderedKeys.push(config.actionKey);
                seenKeys.add(config.actionKey);
            }
        }
        
        return orderedKeys;
    }

    // 刷新欢迎消息操作按钮：显示角色列表作为按钮（设置按钮已移动到 chat-request-status-button 后面）
    async refreshWelcomeActionButtons() {
        if (!this.chatWindow) return;
        const container = this.chatWindow.querySelector('#pet-welcome-actions');
        if (!container) return;
        
        // 重建容器
        container.innerHTML = '';
        
        // 确保按钮样式容器正确（横向排列）
        container.style.cssText = `
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
        `;
        
        // 获取所有角色配置
        const configsRaw = await this.getRoleConfigs();
        
        // 确保 actionIcons 和 buttonHandlers 已初始化
        if (!this.actionIcons) {
            this.actionIcons = {};
        }
        if (!this.buttonHandlers) {
            this.buttonHandlers = {};
        }
        // 用于存储没有 actionKey 的角色按钮
        if (!this.roleButtonsById) {
            this.roleButtonsById = {};
        }
        
        // 先显示已绑定按钮的角色（按按钮顺序）
        const orderedKeys = await this.getOrderedBoundRoleKeys();
        const boundRoleIds = new Set();
        
        for (const key of orderedKeys) {
            const config = (configsRaw || []).find(c => c && c.actionKey === key);
            if (config) {
                boundRoleIds.add(config.id);
                
                // 创建角色按钮
                let button = this.actionIcons[key];
                if (!button) {
                    button = await this.createActionButton(key);
                    this.actionIcons[key] = button;
                    
                    // 创建 processing flag 和 hover 处理
                    const processingFlag = { value: false };
                    this.buttonHandlers[key] = {
                        button,
                        processingFlag,
                        hover: {
                            mouseenter: function() {
                                if (!processingFlag.value) {
                                    this.style.fontSize = '18px';
                                    this.style.color = '#333';
                                    this.style.transform = 'scale(1.1)';
                                }
                            },
                            mouseleave: function() {
                                if (!processingFlag.value) {
                                    this.style.fontSize = '16px';
                                    this.style.color = '#666';
                                    this.style.transform = 'scale(1)';
                                }
                            }
                        }
                    };
                    
                    // 绑定 hover 事件
                    button.addEventListener('mouseenter', this.buttonHandlers[key].hover.mouseenter);
                    button.addEventListener('mouseleave', this.buttonHandlers[key].hover.mouseleave);
                    
                    // 绑定点击事件
                    if (!this.buttonHandlers[key].clickHandler) {
                        const clickHandler = this.createRoleButtonHandler(key, button, this.buttonHandlers[key].processingFlag);
                        button.addEventListener('click', clickHandler);
                        this.buttonHandlers[key].clickHandler = clickHandler;
                    }
                }
                
                // 更新按钮显示和配置
                button.style.display = 'inline-flex';
                await this.applyRoleConfigToActionIcon(button, key);
                
                // 如果按钮已经在容器中，不要重复添加
                if (button.parentNode !== container) {
                    container.appendChild(button);
                }
            }
        }
        
        // 再显示其他角色（没有绑定按钮的角色）作为可点击按钮
        const otherRoles = (configsRaw || []).filter(c => c && c.id && !boundRoleIds.has(c.id));
        for (const config of otherRoles) {
            // 创建或复用角色按钮（没有 actionKey，点击时请求 /prompt 接口）
            let button = this.roleButtonsById[config.id];
            if (!button) {
                button = document.createElement('span');
                button.setAttribute('data-role-id', config.id);
                button.style.cssText = `
                    padding: 4px !important;
                    cursor: pointer !important;
                    font-size: 16px !important;
                    color: #666 !important;
                    font-weight: 300 !important;
                    transition: all 0.2s ease !important;
                    flex-shrink: 0 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    user-select: none !important;
                    width: 22px !important;
                    height: 22px !important;
                    line-height: 22px !important;
                `;
                
                // 添加 hover 效果
                button.addEventListener('mouseenter', function() {
                    this.style.fontSize = '18px';
                    this.style.color = '#333';
                    this.style.transform = 'scale(1.1)';
                });
                button.addEventListener('mouseleave', function() {
                    this.style.fontSize = '16px';
                    this.style.color = '#666';
                    this.style.transform = 'scale(1)';
                });
                
                this.roleButtonsById[config.id] = button;
            }
            
            // 创建 processing flag 用于防止重复点击
            if (!this.roleButtonsProcessingFlags) {
                this.roleButtonsProcessingFlags = {};
            }
            if (!this.roleButtonsProcessingFlags[config.id]) {
                this.roleButtonsProcessingFlags[config.id] = { value: false };
            }
            const processingFlag = this.roleButtonsProcessingFlags[config.id];
            
            // 移除旧的点击事件（通过克隆节点来移除所有事件监听器）
            // 只有在按钮已在 DOM 中时才需要替换（移除旧的事件监听器）
            if (button.parentNode) {
                const oldButton = button;
                const newButton = oldButton.cloneNode(true);
                oldButton.parentNode.replaceChild(newButton, oldButton);
                button = newButton;
                this.roleButtonsById[config.id] = button;
                
                // 重新绑定 hover 效果（因为克隆后事件监听器丢失了）
                button.addEventListener('mouseenter', function() {
                    this.style.fontSize = '18px';
                    this.style.color = '#333';
                    this.style.transform = 'scale(1.1)';
                });
                button.addEventListener('mouseleave', function() {
                    this.style.fontSize = '16px';
                    this.style.color = '#666';
                    this.style.transform = 'scale(1)';
                });
            }
            
            // 点击时请求 /prompt 接口（参考 createRoleButtonHandler 的实现）
            // 对于已存在的按钮，需要先移除旧的点击事件（如果之前绑定过的话）
            // 但由于我们通过克隆来移除，所以这里直接绑定新事件即可
            button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    
                    // 如果是设置按钮或正在处理中，不执行
                    if (processingFlag.value) return;
                    
                    processingFlag.value = true;
                    const originalIcon = button.innerHTML;
                    const originalTitle = button.title;
                    
                    // 获取消息容器
                    const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                    if (!messagesContainer) {
                        console.error('无法找到消息容器');
                        processingFlag.value = false;
                        button.innerHTML = originalIcon;
                        button.style.opacity = '1';
                        button.style.cursor = 'pointer';
                        return;
                    }
                    
                    // 获取页面信息
                    const pageInfo = this.getPageInfo();
                    
                    // 获取角色配置信息
                    const roleLabel = config.label || '自定义角色';
                    const roleIcon = this.getRoleIcon(config, configsRaw) || '🙂';
                    const systemPrompt = (config.prompt && config.prompt.trim()) ? config.prompt.trim() : '';
                    
                    // 构建基础 userPrompt（页面信息）
                    const pageTitle = pageInfo.title || document.title || '当前页面';
                    const pageUrl = pageInfo.url || window.location.href;
                    const pageDescription = pageInfo.description || '';
                    const pageContent = pageInfo.content || '';
                    let baseUserPrompt = `页面标题：${pageTitle}
页面URL：${pageUrl}
${pageDescription ? `页面描述：${pageDescription}` : ''}

页面内容（Markdown 格式）：
${pageContent || '无内容'}

请根据以上信息进行分析和处理。`;
                    
                    // 构建包含会话上下文的 fromUser 参数
                    const fromUser = this.buildFromUserWithContext(baseUserPrompt, roleLabel);
                    
                    // 创建新的消息（按钮操作生成的消息）
                    const message = this.createMessageElement('', 'pet');
                    message.setAttribute('data-button-action', 'true'); // 标记为按钮操作生成
                    messagesContainer.appendChild(message);
                    const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                    const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');
                    
                    // 显示加载动画
                    if (messageAvatar) {
                        messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                    }
                    
                    // 使用角色配置中的图标显示加载文本
                    if (messageText) {
                        messageText.textContent = `${roleIcon} 正在${roleLabel}...`;
                    }
                    
                    try {
                        // 使用 /prompt 接口生成内容（非流式）
                        console.log('调用大模型生成内容，角色:', roleLabel, '页面标题:', pageTitle);
                        
                        // 创建 AbortController 用于终止请求
                        const abortController = new AbortController();
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(abortController);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('loading');
                        }
                        
                        // 使用统一的 payload 构建函数，自动包含会话 ID
                        const payload = this.buildPromptPayload(
                            systemPrompt,
                            fromUser,
                            this.currentModel || PET_CONFIG.chatModels.default
                        );
                        
                        const response = await fetch(PET_CONFIG.api.promptUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(payload),
                            signal: abortController.signal
                        });
                        
                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                        }
                        
                        // 先读取响应文本，判断是否为流式响应（SSE格式）
                        const responseText = await response.text();
                        let result;
                        
                        // 检查是否包含SSE格式（包含 "data: "）
                        if (responseText.includes('data: ')) {
                            // 处理SSE流式响应
                            const lines = responseText.split('\n');
                            let accumulatedData = '';
                            let lastValidData = null;
                            
                            for (const line of lines) {
                                const trimmedLine = line.trim();
                                if (trimmedLine.startsWith('data: ')) {
                                    try {
                                        const dataStr = trimmedLine.substring(6).trim();
                                        if (dataStr === '[DONE]' || dataStr === '') {
                                            continue;
                                        }
                                        
                                        // 尝试解析JSON
                                        const chunk = JSON.parse(dataStr);
                                        
                                        // 检查是否完成
                                        if (chunk.done === true) {
                                            break;
                                        }
                                        
                                        // 累积内容（处理流式内容块）
                                        if (chunk.data) {
                                            accumulatedData += chunk.data;
                                        } else if (chunk.content) {
                                            accumulatedData += chunk.content;
                                        } else if (chunk.message && chunk.message.content) {
                                            // Ollama格式
                                            accumulatedData += chunk.message.content;
                                        } else if (typeof chunk === 'string') {
                                            accumulatedData += chunk;
                                        }
                                        
                                        // 保存最后一个有效的数据块（用于提取其他字段如status等）
                                        lastValidData = chunk;
                                    } catch (e) {
                                        // 如果不是JSON，可能是纯文本内容
                                        const dataStr = trimmedLine.substring(6).trim();
                                        if (dataStr && dataStr !== '[DONE]') {
                                            accumulatedData += dataStr;
                                        }
                                    }
                                }
                            }
                            
                            // 如果累积了内容，创建结果对象
                            if (accumulatedData || lastValidData) {
                                if (lastValidData && lastValidData.status) {
                                    // 如果有status字段，保留原有结构，但替换data/content
                                    result = {
                                        ...lastValidData,
                                        data: accumulatedData || lastValidData.data || '',
                                        content: accumulatedData || lastValidData.content || ''
                                    };
                                } else {
                                    // 否则创建新的结果对象
                                    result = {
                                        data: accumulatedData,
                                        content: accumulatedData
                                    };
                                }
                            } else {
                                // 如果无法解析SSE格式，尝试直接解析整个响应
                                try {
                                    result = JSON.parse(responseText);
                                } catch (e) {
                                    throw new Error('无法解析响应格式');
                                }
                            }
                        } else {
                            // 非SSE格式，直接解析JSON
                            try {
                                result = JSON.parse(responseText);
                            } catch (e) {
                                // 如果解析失败，尝试查找SSE格式的数据
                                const sseMatch = responseText.match(/data:\s*({.+?})/s);
                                if (sseMatch) {
                                    result = JSON.parse(sseMatch[1]);
                                } else {
                                    throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                                }
                            }
                        }
                        
                        // 适配响应格式: {status, msg, data, pagination}
                        let content = '';
                        
                        // 优先尝试提取内容，不管status值是什么（因为可能有内容但status不是200）
                        if (result.data) {
                            // 提取 data 字段
                            content = result.data;
                        } else if (result.content) {
                            content = result.content;
                        } else if (result.message && result.message.content) {
                            // Ollama格式
                            content = result.message.content;
                        } else if (result.message && typeof result.message === 'string') {
                            content = result.message;
                        } else if (typeof result === 'string') {
                            content = result;
                        } else {
                            // 未知格式，尝试提取可能的文本内容
                            content = JSON.stringify(result);
                        }
                        
                        // 如果提取到了有效内容，直接使用
                        if (content && content.trim()) {
                            // 内容提取成功，继续处理
                        } else if (result.status !== undefined && result.status !== 200) {
                            // 只有在明确status不是200且没有内容时，才认为是错误
                            content = result.msg || '抱歉，服务器返回了错误。';
                            throw new Error(content);
                        } else if (result.msg && !content) {
                            // 如果有错误消息但没有内容，也认为是错误
                            content = result.msg;
                            throw new Error(content);
                        }
                        
                        // 停止加载动画
                        if (messageAvatar) {
                            messageAvatar.style.animation = '';
                        }
                        
                        // 显示生成的内容
                        if (messageText) {
                            // 确保内容不为空
                            if (!content || !content.trim()) {
                                content = '抱歉，未能获取到有效内容。';
                            }
                            messageText.innerHTML = this.renderMarkdown(content);
                            // 更新原始文本用于复制功能
                            messageText.setAttribute('data-original-text', content);
                            // 添加复制按钮
                            if (content && content.trim()) {
                                const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                                if (copyButtonContainer) {
                                    this.addCopyButton(copyButtonContainer, messageText);
                                }
                                // 添加 try again 按钮（仅当不是第一条消息时）
                                const petMessages = Array.from(messagesContainer.children).filter(
                                    child => child.querySelector('[data-message-type="pet-bubble"]')
                                );
                                if (petMessages.length > 1) {
                                    const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                    if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                        this.addTryAgainButton(tryAgainContainer, message);
                                    }
                                }
                                
                                // 添加动作按钮（包括设置按钮）
                                await this.addActionButtonsToMessage(message);
                            }
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }
                        
                        button.innerHTML = '✓';
                        button.style.cursor = 'default';
                        button.style.color = '#4caf50';
                        
                        // 2秒后恢复初始状态，允许再次点击
                        setTimeout(() => {
                            button.innerHTML = originalIcon;
                            button.title = originalTitle;
                            button.style.color = '#666';
                            button.style.cursor = 'pointer';
                            button.style.opacity = '1';
                            processingFlag.value = false;
                        }, 2000);
                        
                    } catch (error) {
                        // 检查是否是取消错误
                        const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';
                        
                        if (!isAbortError) {
                            console.error(`生成${roleLabel}失败:`, error);
                        }
                        
                        // 显示错误消息（取消时不显示）
                        if (!isAbortError && messageText) {
                            const errorMessage = error.message && error.message.includes('HTTP error') 
                                ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${roleIcon}`
                                : `抱歉，无法生成"${pageTitle}"的${roleLabel}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${roleIcon}`;
                            messageText.innerHTML = this.renderMarkdown(errorMessage);
                            // 添加 try again 按钮（仅当不是第一条消息时）
                            const petMessages = Array.from(messagesContainer.children).filter(
                                child => child.querySelector('[data-message-type="pet-bubble"]')
                            );
                            if (petMessages.length > 1) {
                                const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                    this.addTryAgainButton(tryAgainContainer, message);
                                }
                            }
                            
                            // 添加动作按钮（包括设置按钮）
                            await this.addActionButtonsToMessage(message);
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        } else if (isAbortError && message) {
                            // 请求被取消，移除消息
                            message.remove();
                        }
                        
                        if (!isAbortError) {
                            button.innerHTML = '✕';
                            button.style.cursor = 'default';
                            button.style.color = '#f44336';
                            
                            // 1.5秒后恢复初始状态，允许再次点击
                            setTimeout(() => {
                                button.innerHTML = originalIcon;
                                button.title = originalTitle;
                                button.style.color = '#666';
                                button.style.cursor = 'pointer';
                                button.style.opacity = '1';
                                processingFlag.value = false;
                            }, 1500);
                        } else {
                            // 请求被取消，立即恢复状态
                            button.innerHTML = originalIcon;
                            button.title = originalTitle;
                            button.style.color = '#666';
                            button.style.cursor = 'pointer';
                            button.style.opacity = '1';
                            processingFlag.value = false;
                        }
                    } finally {
                        // 确保请求状态总是被更新为空闲状态
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(null);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('idle');
                        }
                        // 确保停止加载动画
                        if (messageAvatar) {
                            messageAvatar.style.animation = '';
                        }
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                });
            
            // 更新按钮内容
            const displayIcon = this.getRoleIcon(config, configsRaw);
            button.innerHTML = displayIcon || '🙂';
            button.title = config.label || '(未命名)';
            
            // 如果按钮已经在容器中，不要重复添加
            if (button.parentNode !== container) {
                container.appendChild(button);
            }
        }
        
        // 角色设置按钮已移动到 chat-request-status-button 后面，不再添加到欢迎消息容器中
    }
    
    // 为消息添加动作按钮（复制欢迎消息的按钮，设置按钮已移动到 chat-request-status-button 后面）
    async addActionButtonsToMessage(messageDiv, forceRefresh = false) {
        // 检查是否是欢迎消息，如果是则不添加（因为它已经有按钮了）
        const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
        if (!messagesContainer) return;
        
        // 检查当前消息是否是欢迎消息，如果是则跳过（欢迎消息已经有按钮了）
        const isWelcome = messageDiv.hasAttribute('data-welcome-message');
        if (isWelcome) return;
        
        // 获取时间容器（需要在早期获取，因为后续逻辑需要使用）
        let timeAndCopyContainer = messageDiv.querySelector('[data-message-time]')?.parentElement?.parentElement;
        // 如果时间容器不存在，可能是消息结构还没准备好，尝试等待一下
        if (!timeAndCopyContainer) {
            // 等待消息结构完全准备好（最多等待500ms）
            for (let i = 0; i < 5; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                timeAndCopyContainer = messageDiv.querySelector('[data-message-time]')?.parentElement?.parentElement;
                if (timeAndCopyContainer) break;
            }
        }
        if (!timeAndCopyContainer) {
            console.warn('无法找到消息时间容器，按钮添加失败');
            return;
        }
        
        // 如果强制刷新，先移除现有按钮容器
        const existingContainer = messageDiv.querySelector('[data-message-actions]');
        if (forceRefresh && existingContainer) {
            existingContainer.remove();
        } else if (existingContainer) {
            // 如果按钮容器存在但没有按钮（子元素为空），强制刷新
            if (existingContainer.children.length === 0) {
                existingContainer.remove();
                // 继续执行后续逻辑添加按钮
            } else {
                // 如果已经有按钮容器且不强制刷新，则需要确保它在编辑按钮之前
                const copyButtonContainer = timeAndCopyContainer.querySelector('[data-copy-button-container]');
                if (copyButtonContainer && existingContainer.nextSibling !== copyButtonContainer) {
                    // 如果顺序不对，重新插入到正确位置
                    timeAndCopyContainer.insertBefore(existingContainer, copyButtonContainer);
                }
                return;
            }
        }
        
        // 获取欢迎消息的按钮容器
        const welcomeActions = this.chatWindow.querySelector('#pet-welcome-actions');
        // 即使 welcomeActions 不存在，也尝试从角色配置创建按钮
        // if (!welcomeActions) return;
        
        // 创建按钮容器
        const actionsContainer = document.createElement('div');
        actionsContainer.setAttribute('data-message-actions', 'true');
        actionsContainer.style.cssText = `
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
            margin-left: 8px !important;
        `;
        
        // 获取所有角色配置（用于没有 actionKey 的按钮）
        const configsRaw = await this.getRoleConfigs();
        
        // 获取已绑定的角色键，用于检查哪些角色已经有按钮
        const orderedKeys = await this.getOrderedBoundRoleKeys();
        const boundRoleIds = new Set();
        const configsByActionKey = {};
        const configsById = {};
        
        for (const config of (configsRaw || [])) {
            if (config && config.id) {
                configsById[config.id] = config;
                if (config.actionKey) {
                    configsByActionKey[config.actionKey] = config;
                    if (orderedKeys.includes(config.actionKey)) {
                        boundRoleIds.add(config.id);
                    }
                }
            }
        }
        
        // 复制欢迎消息中的所有按钮（包括设置按钮）
        const buttonsToCopy = welcomeActions ? Array.from(welcomeActions.children) : [];
        const copiedButtonIds = new Set(); // 记录已复制的按钮ID
        
        for (const originalButton of buttonsToCopy) {
            // 创建新按钮（通过克隆并重新绑定事件）
            const newButton = originalButton.cloneNode(true);
            
            // 如果是设置按钮，绑定点击事件
            if (newButton.innerHTML.trim() === '⚙️' || newButton.title === '角色设置') {
                newButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openRoleSettingsModal();
                });
                actionsContainer.appendChild(newButton);
                continue;
            } else if (newButton.hasAttribute('data-action-key')) {
                // 如果是角色按钮（有 actionKey），创建使用消息内容的处理函数
                const actionKey = newButton.getAttribute('data-action-key');
                const config = configsByActionKey[actionKey];
                if (config && config.id) {
                    copiedButtonIds.add(config.id);
                }
                
                // 为消息下的按钮创建特殊的处理函数（使用消息内容而不是页面内容）
                newButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    
                    // 获取当前消息的内容
                    const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                    let messageContent = '';
                    if (messageBubble) {
                        // 优先使用 data-original-text（原始文本），如果没有则使用文本内容
                        messageContent = messageBubble.getAttribute('data-original-text') || 
                                       messageBubble.innerText || 
                                       messageBubble.textContent || '';
                    }
                    
                    // 获取角色信息
                    const pageInfo = this.getPageInfo(); // 保留用于获取角色配置，但不用于 userPrompt
                    let roleInfo;
                    try {
                        roleInfo = await this.getRolePromptForAction(actionKey, pageInfo);
                    } catch (error) {
                        console.error('获取角色信息失败:', error);
                        roleInfo = {
                            systemPrompt: '',
                            userPrompt: '',
                            label: '自定义角色',
                            icon: '🙂'
                        };
                    }
                    
                    // 构建 fromUser：以当前消息内容为主，包含会话上下文
                    const baseMessageContent = messageContent.trim() || '无内容';
                    let fromUser = baseMessageContent;
                    
                    // 获取会话上下文，添加相关的上下文信息
                    const context = this.buildConversationContext();
                    
                    // 如果存在会话历史，在消息内容前添加上下文
                    if (context.hasHistory && context.messages.length > 0) {
                        // 构建消息历史上下文（只包含当前消息之前的历史）
                        let conversationContext = '\n\n## 会话历史：\n\n';
                        context.messages.forEach((msg) => {
                            const role = msg.type === 'user' ? '用户' : '助手';
                            const content = msg.content.trim();
                            if (content && content !== baseMessageContent) { // 排除当前消息本身
                                conversationContext += `${role}：${content}\n\n`;
                            }
                        });
                        // 将上下文放在前面，当前消息内容放在后面
                        fromUser = conversationContext + `## 当前需要处理的消息：\n\n${baseMessageContent}`;
                    }
                    
                    // 如果有页面内容且角色提示词包含页面内容，也添加页面内容
                    if (context.pageContent && roleInfo.userPrompt && roleInfo.userPrompt.includes('页面内容')) {
                        fromUser += `\n\n## 页面内容：\n\n${context.pageContent}`;
                    }
                    
                    // 获取消息容器
                    const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                    if (!messagesContainer) {
                        console.error('无法找到消息容器');
                        return;
                    }
                    
                    // 创建新的消息
                    const message = this.createMessageElement('', 'pet');
                    message.setAttribute('data-button-action', 'true');
                    messagesContainer.appendChild(message);
                    const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                    const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');
                    
                    // 显示加载动画
                    if (messageAvatar) {
                        messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                    }
                    const loadingIcon = roleInfo.icon || '📖';
                    if (messageText) {
                        messageText.textContent = `${loadingIcon} 正在${roleInfo.label || '处理'}...`;
                    }
                    
                    try {
                        // 创建 AbortController 用于终止请求
                        const abortController = new AbortController();
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(abortController);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('loading');
                        }
                        
                        // 使用统一的 payload 构建函数，自动包含会话 ID
                        const payload = this.buildPromptPayload(
                            roleInfo.systemPrompt,
                            fromUser,
                            this.currentModel || PET_CONFIG.chatModels.default
                        );
                        
                        const response = await fetch(PET_CONFIG.api.promptUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(payload),
                            signal: abortController.signal
                        });
                        
                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                        }
                        
                        // 先读取响应文本，判断是否为流式响应（SSE格式）
                        const responseText = await response.text();
                        let result;
                        
                        // 检查是否包含SSE格式（包含 "data: "）
                        if (responseText.includes('data: ')) {
                            // 处理SSE流式响应
                            const lines = responseText.split('\n');
                            let accumulatedData = '';
                            let lastValidData = null;
                            
                            for (const line of lines) {
                                const trimmedLine = line.trim();
                                if (trimmedLine.startsWith('data: ')) {
                                    try {
                                        const dataStr = trimmedLine.substring(6).trim();
                                        if (dataStr === '[DONE]' || dataStr === '') {
                                            continue;
                                        }
                                        
                                        // 尝试解析JSON
                                        const chunk = JSON.parse(dataStr);
                                        
                                        // 检查是否完成
                                        if (chunk.done === true) {
                                            break;
                                        }
                                        
                                        // 累积内容（处理流式内容块）
                                        if (chunk.data) {
                                            accumulatedData += chunk.data;
                                        } else if (chunk.content) {
                                            accumulatedData += chunk.content;
                                        } else if (chunk.message && chunk.message.content) {
                                            // Ollama格式
                                            accumulatedData += chunk.message.content;
                                        } else if (typeof chunk === 'string') {
                                            accumulatedData += chunk;
                                        }
                                        
                                        // 保存最后一个有效的数据块（用于提取其他字段如status等）
                                        lastValidData = chunk;
                                    } catch (e) {
                                        // 如果不是JSON，可能是纯文本内容
                                        const dataStr = trimmedLine.substring(6).trim();
                                        if (dataStr && dataStr !== '[DONE]') {
                                            accumulatedData += dataStr;
                                        }
                                    }
                                }
                            }
                            
                            // 如果累积了内容，创建结果对象
                            if (accumulatedData || lastValidData) {
                                if (lastValidData && lastValidData.status) {
                                    result = {
                                        ...lastValidData,
                                        data: accumulatedData || lastValidData.data || '',
                                        content: accumulatedData || lastValidData.content || ''
                                    };
                                } else {
                                    result = {
                                        data: accumulatedData,
                                        content: accumulatedData
                                    };
                                }
                            } else {
                                try {
                                    result = JSON.parse(responseText);
                                } catch (e) {
                                    throw new Error('无法解析响应格式');
                                }
                            }
                        } else {
                            // 非SSE格式，直接解析JSON
                            try {
                                result = JSON.parse(responseText);
                            } catch (e) {
                                const sseMatch = responseText.match(/data:\s*({.+?})/s);
                                if (sseMatch) {
                                    result = JSON.parse(sseMatch[1]);
                                } else {
                                    throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                                }
                            }
                        }
                        
                        // 适配响应格式
                        let content = '';
                        if (result.data) {
                            content = result.data;
                        } else if (result.content) {
                            content = result.content;
                        } else if (result.message && result.message.content) {
                            content = result.message.content;
                        } else if (result.message && typeof result.message === 'string') {
                            content = result.message;
                        } else if (typeof result === 'string') {
                            content = result;
                        } else {
                            content = JSON.stringify(result);
                        }
                        
                        // 如果提取到了有效内容，直接使用
                        if (content && content.trim()) {
                            // 内容提取成功，继续处理
                        } else if (result.status !== undefined && result.status !== 200) {
                            content = result.msg || '抱歉，服务器返回了错误。';
                            throw new Error(content);
                        } else if (result.msg && !content) {
                            content = result.msg;
                            throw new Error(content);
                        }
                        
                        // 停止加载动画
                        if (messageAvatar) {
                            messageAvatar.style.animation = '';
                        }
                        
                        // 显示生成的内容
                        if (messageText) {
                            if (!content || !content.trim()) {
                                content = '抱歉，未能获取到有效内容。';
                            }
                            messageText.innerHTML = this.renderMarkdown(content);
                            messageText.setAttribute('data-original-text', content);
                            
                            // 添加复制按钮
                            if (content && content.trim()) {
                                const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                                if (copyButtonContainer) {
                                    this.addCopyButton(copyButtonContainer, messageText);
                                }
                                // 添加 try again 按钮（仅当不是第一条消息时）
                                const petMessages = Array.from(messagesContainer.children).filter(
                                    child => child.querySelector('[data-message-type="pet-bubble"]')
                                );
                                if (petMessages.length > 1) {
                                    const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                    if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                        this.addTryAgainButton(tryAgainContainer, message);
                                    }
                                }
                                
                                // 添加动作按钮（包括设置按钮）
                                await this.addActionButtonsToMessage(message);
                            }
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }
                    } catch (error) {
                        const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';
                        
                        if (!isAbortError) {
                            console.error(`生成${roleInfo.label}失败:`, error);
                        }
                        
                        // 显示错误消息（取消时不显示）
                        if (!isAbortError && messageText) {
                            const errorMessage = error.message && error.message.includes('HTTP error') 
                                ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${loadingIcon}`
                                : `抱歉，无法生成${roleInfo.label}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${loadingIcon}`;
                            messageText.innerHTML = this.renderMarkdown(errorMessage);
                            // 添加 try again 按钮
                            const petMessages = Array.from(messagesContainer.children).filter(
                                child => child.querySelector('[data-message-type="pet-bubble"]')
                            );
                            if (petMessages.length > 1) {
                                const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                    this.addTryAgainButton(tryAgainContainer, message);
                                }
                            }
                            await this.addActionButtonsToMessage(message);
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        } else if (isAbortError && message) {
                            message.remove();
                        }
                    } finally {
                        // 确保请求状态总是被更新为空闲状态
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(null);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('idle');
                        }
                        // 确保停止加载动画
                        if (messageAvatar) {
                            messageAvatar.style.animation = '';
                        }
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                });
            } else if (newButton.hasAttribute('data-role-id')) {
                // 如果是没有 actionKey 的角色按钮，需要重新创建点击处理函数
                const roleId = newButton.getAttribute('data-role-id');
                copiedButtonIds.add(roleId); // 记录已复制
                const config = configsById[roleId];
                if (config) {
                    // 创建 processing flag
                    if (!this.roleButtonsProcessingFlags) {
                        this.roleButtonsProcessingFlags = {};
                    }
                    if (!this.roleButtonsProcessingFlags[roleId]) {
                        this.roleButtonsProcessingFlags[roleId] = { value: false };
                    }
                    const processingFlag = this.roleButtonsProcessingFlags[roleId];
                    
                    // 重新绑定点击事件（使用与 refreshWelcomeActionButtons 中相同的逻辑）
                    newButton.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        
                        if (processingFlag.value) return;
                        processingFlag.value = true;
                        const originalIcon = newButton.innerHTML;
                        const originalTitle = newButton.title;
                        
                        // 获取当前消息的内容
                        const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                        let messageContent = '';
                        if (messageBubble) {
                            // 优先使用 data-original-text（原始文本），如果没有则使用文本内容
                            messageContent = messageBubble.getAttribute('data-original-text') || 
                                           messageBubble.innerText || 
                                           messageBubble.textContent || '';
                        }
                        
                        const roleLabel = config.label || '自定义角色';
                        const roleIcon = this.getRoleIcon(config, configsRaw) || '🙂';
                        const systemPrompt = (config.prompt && config.prompt.trim()) ? config.prompt.trim() : '';
                        
                        // 构建 fromUser：以当前消息内容为主，包含会话上下文
                        const baseMessageContent = messageContent.trim() || '无内容';
                        let fromUser = baseMessageContent;
                        
                        // 获取会话上下文，添加相关的上下文信息
                        const context = this.buildConversationContext();
                        
                        // 如果存在会话历史，在消息内容前添加上下文
                        if (context.hasHistory && context.messages.length > 0) {
                            // 构建消息历史上下文（只包含当前消息之前的历史）
                            let conversationContext = '\n\n## 会话历史：\n\n';
                            context.messages.forEach((msg) => {
                                const role = msg.type === 'user' ? '用户' : '助手';
                                const content = msg.content.trim();
                                if (content && content !== baseMessageContent) { // 排除当前消息本身
                                    conversationContext += `${role}：${content}\n\n`;
                                }
                            });
                            // 将上下文放在前面，当前消息内容放在后面
                            fromUser = conversationContext + `## 当前需要处理的消息：\n\n${baseMessageContent}`;
                        }
                        
                        // 如果有页面内容，也添加页面内容
                        if (context.pageContent) {
                            fromUser += `\n\n## 页面内容：\n\n${context.pageContent}`;
                        }
                        
                        // 创建新的消息
                        const message = this.createMessageElement('', 'pet');
                        message.setAttribute('data-button-action', 'true');
                        messagesContainer.appendChild(message);
                        const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                        const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');
                        
                        if (messageAvatar) {
                            messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                        }
                        if (messageText) {
                            messageText.textContent = `${roleIcon} 正在${roleLabel}...`;
                        }
                        
                        try {
                            const abortController = new AbortController();
                            
                            // 使用统一的 payload 构建函数，自动包含会话 ID
                            const payload = this.buildPromptPayload(
                                systemPrompt,
                                fromUser,
                                this.currentModel || PET_CONFIG.chatModels.default
                            );
                            
                            const response = await fetch(PET_CONFIG.api.promptUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(payload),
                                signal: abortController.signal
                            });
                            
                            if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                            }
                            
                            // 先读取响应文本，判断是否为流式响应（SSE格式）
                            const responseText = await response.text();
                            let result;
                            
                            // 检查是否包含SSE格式（包含 "data: "）
                            if (responseText.includes('data: ')) {
                                // 处理SSE流式响应
                                const lines = responseText.split('\n');
                                let accumulatedData = '';
                                let lastValidData = null;
                                
                                for (const line of lines) {
                                    const trimmedLine = line.trim();
                                    if (trimmedLine.startsWith('data: ')) {
                                        try {
                                            const dataStr = trimmedLine.substring(6).trim();
                                            if (dataStr === '[DONE]' || dataStr === '') {
                                                continue;
                                            }
                                            
                                            // 尝试解析JSON
                                            const chunk = JSON.parse(dataStr);
                                            
                                            // 检查是否完成
                                            if (chunk.done === true) {
                                                break;
                                            }
                                            
                                            // 累积内容（处理流式内容块）
                                            if (chunk.data) {
                                                accumulatedData += chunk.data;
                                            } else if (chunk.content) {
                                                accumulatedData += chunk.content;
                                            } else if (chunk.message && chunk.message.content) {
                                                // Ollama格式
                                                accumulatedData += chunk.message.content;
                                            } else if (typeof chunk === 'string') {
                                                accumulatedData += chunk;
                                            }
                                            
                                            // 保存最后一个有效的数据块（用于提取其他字段如status等）
                                            lastValidData = chunk;
                                        } catch (e) {
                                            // 如果不是JSON，可能是纯文本内容
                                            const dataStr = trimmedLine.substring(6).trim();
                                            if (dataStr && dataStr !== '[DONE]') {
                                                accumulatedData += dataStr;
                                            }
                                        }
                                    }
                                }
                                
                                // 如果累积了内容，创建结果对象
                                if (accumulatedData || lastValidData) {
                                    if (lastValidData && lastValidData.status) {
                                        // 如果有status字段，保留原有结构，但替换data/content
                                        result = {
                                            ...lastValidData,
                                            data: accumulatedData || lastValidData.data || '',
                                            content: accumulatedData || lastValidData.content || ''
                                        };
                                    } else {
                                        // 否则创建新的结果对象
                                        result = {
                                            data: accumulatedData,
                                            content: accumulatedData
                                        };
                                    }
                                } else {
                                    // 如果无法解析SSE格式，尝试直接解析整个响应
                                    try {
                                        result = JSON.parse(responseText);
                                    } catch (e) {
                                        throw new Error('无法解析响应格式');
                                    }
                                }
                            } else {
                                // 非SSE格式，直接解析JSON
                                try {
                                    result = JSON.parse(responseText);
                                } catch (e) {
                                    // 如果解析失败，尝试查找SSE格式的数据
                                    const sseMatch = responseText.match(/data:\s*({.+?})/s);
                                    if (sseMatch) {
                                        result = JSON.parse(sseMatch[1]);
                                    } else {
                                        throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                                    }
                                }
                            }
                            
                            // 适配响应格式: {status, msg, data, pagination}
                            let content = '';
                            
                            // 优先尝试提取内容，不管status值是什么（因为可能有内容但status不是200）
                            if (result.data) {
                                // 提取 data 字段
                                content = result.data;
                            } else if (result.content) {
                                content = result.content;
                            } else if (result.message && result.message.content) {
                                // Ollama格式
                                content = result.message.content;
                            } else if (result.message && typeof result.message === 'string') {
                                content = result.message;
                            } else if (typeof result === 'string') {
                                content = result;
                            } else {
                                // 未知格式，尝试提取可能的文本内容
                                content = JSON.stringify(result);
                            }
                            
                            // 如果提取到了有效内容，直接使用
                            if (content && content.trim()) {
                                // 内容提取成功，继续处理
                            } else if (result.status !== undefined && result.status !== 200) {
                                // 只有在明确status不是200且没有内容时，才认为是错误
                                content = result.msg || '抱歉，服务器返回了错误。';
                                throw new Error(content);
                            } else if (result.msg && !content) {
                                // 如果有错误消息但没有内容，也认为是错误
                                content = result.msg;
                                throw new Error(content);
                            }
                            
                            // 停止加载动画
                            if (messageAvatar) {
                                messageAvatar.style.animation = '';
                            }
                            
                            // 显示生成的内容
                            if (messageText) {
                                // 确保内容不为空
                                if (!content || !content.trim()) {
                                    content = '抱歉，未能获取到有效内容。';
                                }
                                messageText.innerHTML = this.renderMarkdown(content);
                                // 更新原始文本用于复制功能
                                messageText.setAttribute('data-original-text', content);
                                // 添加复制按钮
                                if (content && content.trim()) {
                                    const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                                    if (copyButtonContainer) {
                                        this.addCopyButton(copyButtonContainer, messageText);
                                    }
                                    // 添加 try again 按钮（仅当不是第一条消息时）
                                    const petMessages = Array.from(messagesContainer.children).filter(
                                        child => child.querySelector('[data-message-type="pet-bubble"]')
                                    );
                                    if (petMessages.length > 1) {
                                        const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                        if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                            this.addTryAgainButton(tryAgainContainer, message);
                                        }
                                    }
                                    
                                    // 添加动作按钮（包括设置按钮）
                                    await this.addActionButtonsToMessage(message);
                                }
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            }
                            
                            newButton.innerHTML = '✓';
                            newButton.style.cursor = 'default';
                            newButton.style.color = '#4caf50';
                            
                            // 2秒后恢复初始状态，允许再次点击
                            setTimeout(() => {
                                newButton.innerHTML = originalIcon;
                                newButton.title = originalTitle;
                                newButton.style.color = '#666';
                                newButton.style.cursor = 'pointer';
                                newButton.style.opacity = '1';
                                processingFlag.value = false;
                            }, 2000);
                            
                        } catch (error) {
                            // 检查是否是取消错误
                            const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';
                            
                            if (!isAbortError) {
                                console.error(`生成${roleLabel}失败:`, error);
                            }
                            
                            // 显示错误消息（取消时不显示）
                            if (!isAbortError && messageText) {
                                const errorMessage = error.message && error.message.includes('HTTP error') 
                                    ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${roleIcon}`
                                    : `抱歉，无法生成"${pageTitle}"的${roleLabel}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${roleIcon}`;
                                messageText.innerHTML = this.renderMarkdown(errorMessage);
                                // 添加 try again 按钮（仅当不是第一条消息时）
                                const petMessages = Array.from(messagesContainer.children).filter(
                                    child => child.querySelector('[data-message-type="pet-bubble"]')
                                );
                                if (petMessages.length > 1) {
                                    const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                    if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                        this.addTryAgainButton(tryAgainContainer, message);
                                    }
                                }
                                
                                // 添加动作按钮（包括设置按钮）
                                await this.addActionButtonsToMessage(message);
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            } else if (isAbortError && message) {
                                // 请求被取消，移除消息
                                message.remove();
                            }
                            
                            if (!isAbortError) {
                                newButton.innerHTML = '✕';
                                newButton.style.cursor = 'default';
                                newButton.style.color = '#f44336';
                                
                                // 1.5秒后恢复初始状态，允许再次点击
                                setTimeout(() => {
                                    newButton.innerHTML = originalIcon;
                                    newButton.title = originalTitle;
                                    newButton.style.color = '#666';
                                    newButton.style.cursor = 'pointer';
                                    newButton.style.opacity = '1';
                                    processingFlag.value = false;
                                }, 1500);
                            } else {
                                // 请求被取消，立即恢复状态
                                newButton.innerHTML = originalIcon;
                                newButton.title = originalTitle;
                                newButton.style.color = '#666';
                                newButton.style.cursor = 'pointer';
                                newButton.style.opacity = '1';
                                processingFlag.value = false;
                            }
                        } finally {
                            // 确保停止加载动画
                            if (messageAvatar) {
                                messageAvatar.style.animation = '';
                            }
                        }
                    });
                }
            }
            
            actionsContainer.appendChild(newButton);
        }
        
        // 补充遗漏的角色按钮（确保所有角色按钮都被添加）
        // 首先添加有 actionKey 但可能遗漏的按钮
        for (const key of orderedKeys) {
            const config = configsByActionKey[key];
            if (config && config.id && !copiedButtonIds.has(config.id)) {
                // 这个按钮没有被复制，需要创建
                const button = await this.createActionButton(key);
                if (button) {
                    const clonedButton = button.cloneNode(true);
                    
                    // 重新绑定点击事件（使用消息内容）
                    clonedButton.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        
                        const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                        let messageContent = '';
                        if (messageBubble) {
                            messageContent = messageBubble.getAttribute('data-original-text') || 
                                           messageBubble.innerText || 
                                           messageBubble.textContent || '';
                        }
                        
                        const pageInfo = this.getPageInfo();
                        let roleInfo;
                        try {
                            roleInfo = await this.getRolePromptForAction(key, pageInfo);
                        } catch (error) {
                            console.error('获取角色信息失败:', error);
                            roleInfo = {
                                systemPrompt: '',
                                userPrompt: '',
                                label: '自定义角色',
                                icon: '🙂'
                            };
                        }
                        
                        // 构建 fromUser：以当前消息内容为主，包含会话上下文
                        const baseMessageContent = messageContent.trim() || '无内容';
                        let fromUser = baseMessageContent;
                        
                        // 获取会话上下文，添加相关的上下文信息
                        const context = this.buildConversationContext();
                        
                        // 如果存在会话历史，在消息内容前添加上下文
                        if (context.hasHistory && context.messages.length > 0) {
                            // 构建消息历史上下文（只包含当前消息之前的历史）
                            let conversationContext = '\n\n## 会话历史：\n\n';
                            context.messages.forEach((msg) => {
                                const role = msg.type === 'user' ? '用户' : '助手';
                                const content = msg.content.trim();
                                if (content && content !== baseMessageContent) { // 排除当前消息本身
                                    conversationContext += `${role}：${content}\n\n`;
                                }
                            });
                            // 将上下文放在前面，当前消息内容放在后面
                            fromUser = conversationContext + `## 当前需要处理的消息：\n\n${baseMessageContent}`;
                        }
                        
                        // 如果有页面内容且角色提示词包含页面内容，也添加页面内容
                        if (context.pageContent && roleInfo.userPrompt && roleInfo.userPrompt.includes('页面内容')) {
                            fromUser += `\n\n## 页面内容：\n\n${context.pageContent}`;
                        }
                        
                        const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                        if (!messagesContainer) {
                            console.error('无法找到消息容器');
                            return;
                        }
                        
                        const message = this.createMessageElement('', 'pet');
                        message.setAttribute('data-button-action', 'true');
                        messagesContainer.appendChild(message);
                        const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                        const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');
                        
                        if (messageAvatar) {
                            messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                        }
                        const loadingIcon = roleInfo.icon || '📖';
                        if (messageText) {
                            messageText.textContent = `${loadingIcon} 正在${roleInfo.label || '处理'}...`;
                        }
                        
                        try {
                            const abortController = new AbortController();
                            if (this.chatWindow && this.chatWindow._setAbortController) {
                                this.chatWindow._setAbortController(abortController);
                            }
                            if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                                this.chatWindow._updateRequestStatus('loading');
                            }
                            
                            // 使用统一的 payload 构建函数，自动包含会话 ID
                            const payload = this.buildPromptPayload(
                                roleInfo.systemPrompt,
                                fromUser,
                                this.currentModel || PET_CONFIG.chatModels.default
                            );
                            
                            const response = await fetch(PET_CONFIG.api.promptUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(payload),
                                signal: abortController.signal
                            });
                            
                            if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                            }
                            
                            const responseText = await response.text();
                            let result;
                            
                            if (responseText.includes('data: ')) {
                                const lines = responseText.split('\n');
                                let accumulatedData = '';
                                let lastValidData = null;
                                
                                for (const line of lines) {
                                    const trimmedLine = line.trim();
                                    if (trimmedLine.startsWith('data: ')) {
                                        try {
                                            const dataStr = trimmedLine.substring(6).trim();
                                            if (dataStr === '[DONE]' || dataStr === '') {
                                                continue;
                                            }
                                            
                                            const chunk = JSON.parse(dataStr);
                                            if (chunk.done === true) {
                                                break;
                                            }
                                            
                                            if (chunk.data) {
                                                accumulatedData += chunk.data;
                                            } else if (chunk.content) {
                                                accumulatedData += chunk.content;
                                            } else if (chunk.message && chunk.message.content) {
                                                accumulatedData += chunk.message.content;
                                            } else if (typeof chunk === 'string') {
                                                accumulatedData += chunk;
                                            }
                                            
                                            lastValidData = chunk;
                                        } catch (e) {
                                            const dataStr = trimmedLine.substring(6).trim();
                                            if (dataStr && dataStr !== '[DONE]') {
                                                accumulatedData += dataStr;
                                            }
                                        }
                                    }
                                }
                                
                                if (accumulatedData || lastValidData) {
                                    if (lastValidData && lastValidData.status) {
                                        result = {
                                            ...lastValidData,
                                            data: accumulatedData || lastValidData.data || '',
                                            content: accumulatedData || lastValidData.content || ''
                                        };
                                    } else {
                                        result = {
                                            data: accumulatedData,
                                            content: accumulatedData
                                        };
                                    }
                                } else {
                                    try {
                                        result = JSON.parse(responseText);
                                    } catch (e) {
                                        throw new Error('无法解析响应格式');
                                    }
                                }
                            } else {
                                try {
                                    result = JSON.parse(responseText);
                                } catch (e) {
                                    const sseMatch = responseText.match(/data:\s*({.+?})/s);
                                    if (sseMatch) {
                                        result = JSON.parse(sseMatch[1]);
                                    } else {
                                        throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                                    }
                                }
                            }
                            
                            let content = '';
                            if (result.data) {
                                content = result.data;
                            } else if (result.content) {
                                content = result.content;
                            } else if (result.message && result.message.content) {
                                content = result.message.content;
                            } else if (result.message && typeof result.message === 'string') {
                                content = result.message;
                            } else if (typeof result === 'string') {
                                content = result;
                            } else {
                                content = JSON.stringify(result);
                            }
                            
                            if (content && content.trim()) {
                                // 内容提取成功
                            } else if (result.status !== undefined && result.status !== 200) {
                                content = result.msg || '抱歉，服务器返回了错误。';
                                throw new Error(content);
                            } else if (result.msg && !content) {
                                content = result.msg;
                                throw new Error(content);
                            }
                            
                            if (messageAvatar) {
                                messageAvatar.style.animation = '';
                            }
                            
                            if (messageText) {
                                if (!content || !content.trim()) {
                                    content = '抱歉，未能获取到有效内容。';
                                }
                                messageText.innerHTML = this.renderMarkdown(content);
                                messageText.setAttribute('data-original-text', content);
                                
                                if (content && content.trim()) {
                                    const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                                    if (copyButtonContainer) {
                                        this.addCopyButton(copyButtonContainer, messageText);
                                    }
                                    const petMessages = Array.from(messagesContainer.children).filter(
                                        child => child.querySelector('[data-message-type="pet-bubble"]')
                                    );
                                    if (petMessages.length > 1) {
                                        const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                        if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                            this.addTryAgainButton(tryAgainContainer, message);
                                        }
                                    }
                                    
                                    await this.addActionButtonsToMessage(message);
                                }
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            }
                        } catch (error) {
                            const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';
                            
                            if (!isAbortError) {
                                console.error(`生成${roleInfo.label}失败:`, error);
                            }
                            
                            if (!isAbortError && messageText) {
                                const errorMessage = error.message && error.message.includes('HTTP error') 
                                    ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${loadingIcon}`
                                    : `抱歉，无法生成${roleInfo.label}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${loadingIcon}`;
                                messageText.innerHTML = this.renderMarkdown(errorMessage);
                                const petMessages = Array.from(messagesContainer.children).filter(
                                    child => child.querySelector('[data-message-type="pet-bubble"]')
                                );
                                if (petMessages.length > 1) {
                                    const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                    if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                        this.addTryAgainButton(tryAgainContainer, message);
                                    }
                                }
                                await this.addActionButtonsToMessage(message);
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            } else if (isAbortError && message) {
                                message.remove();
                            }
                        } finally {
                            if (this.chatWindow && this.chatWindow._setAbortController) {
                                this.chatWindow._setAbortController(null);
                            }
                            if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                                this.chatWindow._updateRequestStatus('idle');
                            }
                            if (messageAvatar) {
                                messageAvatar.style.animation = '';
                            }
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }
                    });
                    
                    actionsContainer.appendChild(clonedButton);
                    copiedButtonIds.add(config.id);
                }
            }
        }
        
        // 然后添加没有 actionKey 但遗漏的角色按钮
        const otherRoles = (configsRaw || []).filter(c => c && c.id && !boundRoleIds.has(c.id) && !copiedButtonIds.has(c.id));
        for (const config of otherRoles) {
            // 创建新的角色按钮（没有 actionKey）
            const button = document.createElement('span');
            button.setAttribute('data-role-id', config.id);
            button.style.cssText = `
                padding: 4px !important;
                cursor: pointer !important;
                font-size: 16px !important;
                color: #666 !important;
                font-weight: 300 !important;
                transition: all 0.2s ease !important;
                flex-shrink: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                user-select: none !important;
                width: 22px !important;
                height: 22px !important;
                line-height: 22px !important;
            `;
            
            const displayIcon = this.getRoleIcon(config, configsRaw);
            button.innerHTML = displayIcon || '🙂';
            button.title = config.label || '(未命名)';
            
            // 添加 hover 效果
            button.addEventListener('mouseenter', function() {
                this.style.fontSize = '18px';
                this.style.color = '#333';
                this.style.transform = 'scale(1.1)';
            });
            button.addEventListener('mouseleave', function() {
                this.style.fontSize = '16px';
                this.style.color = '#666';
                this.style.transform = 'scale(1)';
            });
            
            // 创建 processing flag
            if (!this.roleButtonsProcessingFlags) {
                this.roleButtonsProcessingFlags = {};
            }
            if (!this.roleButtonsProcessingFlags[config.id]) {
                this.roleButtonsProcessingFlags[config.id] = { value: false };
            }
            const processingFlag = this.roleButtonsProcessingFlags[config.id];
            
            // 绑定点击事件（使用与 refreshWelcomeActionButtons 中相同的逻辑，但使用消息内容）
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                if (processingFlag.value) return;
                processingFlag.value = true;
                const originalIcon = button.innerHTML;
                const originalTitle = button.title;
                
                const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                let messageContent = '';
                if (messageBubble) {
                    messageContent = messageBubble.getAttribute('data-original-text') || 
                                   messageBubble.innerText || 
                                   messageBubble.textContent || '';
                }
                
                const roleLabel = config.label || '自定义角色';
                const roleIcon = this.getRoleIcon(config, configsRaw) || '🙂';
                const systemPrompt = (config.prompt && config.prompt.trim()) ? config.prompt.trim() : '';
                
                // 构建 fromUser：以当前消息内容为主，包含会话上下文
                const baseMessageContent = messageContent.trim() || '无内容';
                let fromUser = baseMessageContent;
                
                // 获取会话上下文，添加相关的上下文信息
                const context = this.buildConversationContext();
                
                // 如果存在会话历史，在消息内容前添加上下文
                if (context.hasHistory && context.messages.length > 0) {
                    // 构建消息历史上下文（只包含当前消息之前的历史）
                    let conversationContext = '\n\n## 会话历史：\n\n';
                    context.messages.forEach((msg) => {
                        const role = msg.type === 'user' ? '用户' : '助手';
                        const content = msg.content.trim();
                        if (content && content !== baseMessageContent) { // 排除当前消息本身
                            conversationContext += `${role}：${content}\n\n`;
                        }
                    });
                    // 将上下文放在前面，当前消息内容放在后面
                    fromUser = conversationContext + `## 当前需要处理的消息：\n\n${baseMessageContent}`;
                }
                
                // 如果有页面内容，也添加页面内容
                if (context.pageContent) {
                    fromUser += `\n\n## 页面内容：\n\n${context.pageContent}`;
                }
                
                const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                if (!messagesContainer) {
                    console.error('无法找到消息容器');
                    processingFlag.value = false;
                    return;
                }
                
                const message = this.createMessageElement('', 'pet');
                message.setAttribute('data-button-action', 'true');
                messagesContainer.appendChild(message);
                const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');
                
                if (messageAvatar) {
                    messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                }
                if (messageText) {
                    messageText.textContent = `${roleIcon} 正在${roleLabel}...`;
                }
                
                try {
                    const abortController = new AbortController();
                    
                    // 使用统一的 payload 构建函数，自动包含会话 ID
                    const payload = this.buildPromptPayload(
                        systemPrompt,
                        fromUser,
                        this.currentModel || PET_CONFIG.chatModels.default
                    );
                    
                    const response = await fetch(PET_CONFIG.api.promptUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload),
                        signal: abortController.signal
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                    }
                    
                    const responseText = await response.text();
                    let result;
                    
                    if (responseText.includes('data: ')) {
                        const lines = responseText.split('\n');
                        let accumulatedData = '';
                        let lastValidData = null;
                        
                        for (const line of lines) {
                            const trimmedLine = line.trim();
                            if (trimmedLine.startsWith('data: ')) {
                                try {
                                    const dataStr = trimmedLine.substring(6).trim();
                                    if (dataStr === '[DONE]' || dataStr === '') {
                                        continue;
                                    }
                                    
                                    const chunk = JSON.parse(dataStr);
                                    if (chunk.done === true) {
                                        break;
                                    }
                                    
                                    if (chunk.data) {
                                        accumulatedData += chunk.data;
                                    } else if (chunk.content) {
                                        accumulatedData += chunk.content;
                                    } else if (chunk.message && chunk.message.content) {
                                        accumulatedData += chunk.message.content;
                                    } else if (typeof chunk === 'string') {
                                        accumulatedData += chunk;
                                    }
                                    
                                    lastValidData = chunk;
                                } catch (e) {
                                    const dataStr = trimmedLine.substring(6).trim();
                                    if (dataStr && dataStr !== '[DONE]') {
                                        accumulatedData += dataStr;
                                    }
                                }
                            }
                        }
                        
                        if (accumulatedData || lastValidData) {
                            if (lastValidData && lastValidData.status) {
                                result = {
                                    ...lastValidData,
                                    data: accumulatedData || lastValidData.data || '',
                                    content: accumulatedData || lastValidData.content || ''
                                };
                            } else {
                                result = {
                                    data: accumulatedData,
                                    content: accumulatedData
                                };
                            }
                        } else {
                            try {
                                result = JSON.parse(responseText);
                            } catch (e) {
                                throw new Error('无法解析响应格式');
                            }
                        }
                    } else {
                        try {
                            result = JSON.parse(responseText);
                        } catch (e) {
                            const sseMatch = responseText.match(/data:\s*({.+?})/s);
                            if (sseMatch) {
                                result = JSON.parse(sseMatch[1]);
                            } else {
                                throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                            }
                        }
                    }
                    
                    let content = '';
                    if (result.data) {
                        content = result.data;
                    } else if (result.content) {
                        content = result.content;
                    } else if (result.message && result.message.content) {
                        content = result.message.content;
                    } else if (result.message && typeof result.message === 'string') {
                        content = result.message;
                    } else if (typeof result === 'string') {
                        content = result;
                    } else {
                        content = JSON.stringify(result);
                    }
                    
                    if (content && content.trim()) {
                        // 内容提取成功
                    } else if (result.status !== undefined && result.status !== 200) {
                        content = result.msg || '抱歉，服务器返回了错误。';
                        throw new Error(content);
                    } else if (result.msg && !content) {
                        content = result.msg;
                        throw new Error(content);
                    }
                    
                    if (messageAvatar) {
                        messageAvatar.style.animation = '';
                    }
                    
                    if (messageText) {
                        if (!content || !content.trim()) {
                            content = '抱歉，未能获取到有效内容。';
                        }
                        messageText.innerHTML = this.renderMarkdown(content);
                        messageText.setAttribute('data-original-text', content);
                        
                        if (content && content.trim()) {
                            const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                            if (copyButtonContainer) {
                                this.addCopyButton(copyButtonContainer, messageText);
                            }
                            const petMessages = Array.from(messagesContainer.children).filter(
                                child => child.querySelector('[data-message-type="pet-bubble"]')
                            );
                            if (petMessages.length > 1) {
                                const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                    this.addTryAgainButton(tryAgainContainer, message);
                                }
                            }
                            
                            await this.addActionButtonsToMessage(message);
                        }
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                    
                    button.innerHTML = '✓';
                    button.style.cursor = 'default';
                    button.style.color = '#4caf50';
                    
                    setTimeout(() => {
                        button.innerHTML = originalIcon;
                        button.title = originalTitle;
                        button.style.color = '#666';
                        button.style.cursor = 'pointer';
                        button.style.opacity = '1';
                        processingFlag.value = false;
                    }, 2000);
                } catch (error) {
                    const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';
                    
                    if (!isAbortError) {
                        console.error(`生成${roleLabel}失败:`, error);
                    }
                    
                    if (!isAbortError && messageText) {
                        const errorMessage = error.message && error.message.includes('HTTP error') 
                            ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${roleIcon}`
                            : `抱歉，无法生成${roleLabel}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${roleIcon}`;
                        messageText.innerHTML = this.renderMarkdown(errorMessage);
                        const petMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]')
                        );
                        if (petMessages.length > 1) {
                            const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                this.addTryAgainButton(tryAgainContainer, message);
                            }
                        }
                        await this.addActionButtonsToMessage(message);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    } else if (isAbortError && message) {
                        message.remove();
                    }
                    
                    if (!isAbortError) {
                        button.innerHTML = '✕';
                        button.style.cursor = 'default';
                        button.style.color = '#f44336';
                        
                        setTimeout(() => {
                            button.innerHTML = originalIcon;
                            button.title = originalTitle;
                            button.style.color = '#666';
                            button.style.cursor = 'pointer';
                            button.style.opacity = '1';
                            processingFlag.value = false;
                        }, 1500);
                    } else {
                        button.innerHTML = originalIcon;
                        button.title = originalTitle;
                        button.style.color = '#666';
                        button.style.cursor = 'pointer';
                        button.style.opacity = '1';
                        processingFlag.value = false;
                    }
                } finally {
                    if (messageAvatar) {
                        messageAvatar.style.animation = '';
                    }
                }
            });
            
            actionsContainer.appendChild(button);
        }
        
        // 只有在按钮容器中有按钮时才插入到DOM中
        if (actionsContainer.children.length > 0) {
            // 将按钮容器添加到时间容器中，和时间同一行（在 messageTimeWrapper 之后）
            const messageTimeWrapper = timeAndCopyContainer.querySelector('[data-message-time]')?.parentElement;
            if (messageTimeWrapper && messageTimeWrapper.parentNode === timeAndCopyContainer) {
                // 将角色按钮插入到时间包装器之后，这样它就和时间在同一行了
                // 查找 copyButtonContainer 的位置，如果存在则插入到它之前，否则添加到末尾
                const copyButtonContainer = timeAndCopyContainer.querySelector('[data-copy-button-container]');
                if (copyButtonContainer) {
                    // 如果存在复制按钮容器，将角色按钮插入到它之前
                    timeAndCopyContainer.insertBefore(actionsContainer, copyButtonContainer);
                } else {
                    // 如果没有复制按钮容器，将角色按钮插入到时间包装器之后
                    timeAndCopyContainer.insertBefore(actionsContainer, messageTimeWrapper.nextSibling);
                }
            } else {
                // 如果找不到 messageTimeWrapper 或者结构不对，尝试找到第一个子元素之后插入
                const firstChild = timeAndCopyContainer.firstElementChild;
                if (firstChild && firstChild.nextSibling) {
                    timeAndCopyContainer.insertBefore(actionsContainer, firstChild.nextSibling);
                } else {
                    // 如果没有合适的插入位置，添加到开头（在第一个子元素之前）
                    if (firstChild) {
                        timeAndCopyContainer.insertBefore(actionsContainer, firstChild);
                    } else {
                        timeAndCopyContainer.appendChild(actionsContainer);
                    }
                }
            }
        }
    }
    
    // 刷新所有消息的动作按钮（在角色设置更新后调用）
    async refreshAllMessageActionButtons() {
        if (!this.chatWindow) return;
        
        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (!messagesContainer) return;
        
        // 查找所有有按钮容器的消息（不包括第一条欢迎消息）
        const allMessages = Array.from(messagesContainer.children).filter(
            child => child.querySelector('[data-message-type="pet-bubble"]')
        );
        
        // 跳过第一条消息，从第二条开始刷新
        for (let i = 1; i < allMessages.length; i++) {
            const messageDiv = allMessages[i];
            // 强制刷新按钮
            await this.addActionButtonsToMessage(messageDiv, true);
        }
    }

    // 构建会话上下文（包含消息历史和页面内容）
    buildConversationContext() {
        const context = {
            messages: [],
            pageContent: '',
            hasHistory: false
        };

        // 获取当前会话
        if (this.currentSessionId && this.sessions[this.currentSessionId]) {
            const session = this.sessions[this.currentSessionId];
            
            // 获取消息历史（排除欢迎消息和按钮操作生成的消息）
            if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
                context.messages = session.messages.filter(msg => {
                    // 只包含用户消息和宠物消息，排除按钮操作生成的消息
                    return msg.type === 'user' || msg.type === 'pet';
                });
                context.hasHistory = context.messages.length > 0;
            }
            
            // 获取页面内容
            if (session.pageContent && session.pageContent.trim()) {
                context.pageContent = session.pageContent.trim();
            }
        }

        return context;
    }

    // 构建包含会话上下文的 fromUser 参数
    buildFromUserWithContext(baseUserPrompt, roleLabel) {
        const context = this.buildConversationContext();
        
        // 如果没有消息历史，直接使用基础提示词
        if (!context.hasHistory) {
            return baseUserPrompt;
        }

        // 构建消息历史上下文
        let conversationContext = '';
        if (context.messages.length > 0) {
            conversationContext = '\n\n## 会话历史：\n\n';
            context.messages.forEach((msg, index) => {
                const role = msg.type === 'user' ? '用户' : '助手';
                const content = msg.content.trim();
                if (content) {
                    conversationContext += `${role}：${content}\n\n`;
                }
            });
        }

        // 如果有页面内容，也包含进去
        let pageContext = '';
        if (context.pageContent) {
            pageContext = '\n\n## 页面内容：\n\n' + context.pageContent;
        }

        // 组合：基础提示词 + 会话历史 + 页面内容
        return baseUserPrompt + conversationContext + pageContext;
    }

    // 创建角色按钮点击处理函数（用于有 actionKey 的角色）
    createRoleButtonHandler(actionKey, iconEl, processingFlag) {
        return async () => {
            if (processingFlag.value) return;

            processingFlag.value = true;

            // 获取消息容器
            const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
            if (!messagesContainer) {
                console.error('无法找到消息容器');
                processingFlag.value = false;
                return;
            }

            // 获取页面信息
            const pageInfo = this.getPageInfo();
            
            // 从角色配置中获取提示语、名称、图标
            let roleInfo;
            try {
                roleInfo = await this.getRolePromptForAction(actionKey, pageInfo);
            } catch (error) {
                console.error('获取角色信息失败:', error);
                roleInfo = {
                    systemPrompt: '',
                    userPrompt: '',
                    label: '自定义角色',
                    icon: '🙂'
                };
            }

            // 构建包含会话上下文的 fromUser 参数
            const fromUser = this.buildFromUserWithContext(roleInfo.userPrompt, roleInfo.label);

            // 创建新的消息（按钮操作生成的消息）
            const message = this.createMessageElement('', 'pet');
            message.setAttribute('data-button-action', 'true'); // 标记为按钮操作生成
            messagesContainer.appendChild(message);
            const messageText = message.querySelector('[data-message-type="pet-bubble"]');
            const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');

            // 显示加载动画
            if (messageAvatar) {
                messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
            }

            // 使用角色配置中的图标显示加载文本
            const loadingIcon = roleInfo.icon || '📖';
            if (messageText) {
                messageText.textContent = `${loadingIcon} 正在${roleInfo.label || '处理'}...`;
            }

            try {
                // 使用 /prompt 接口生成内容（非流式）
                console.log('调用大模型生成内容，角色:', roleInfo.label, '页面标题:', pageInfo.title || '当前页面');
                
                // 创建 AbortController 用于终止请求
                const abortController = new AbortController();
                
                // 使用统一的 payload 构建函数，自动包含会话 ID
                const payload = this.buildPromptPayload(
                    roleInfo.systemPrompt,
                    fromUser,
                    this.currentModel || PET_CONFIG.chatModels.default
                );
                
                const response = await fetch(PET_CONFIG.api.promptUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    signal: abortController.signal
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }

                const result = await response.json();
                
                // 适配响应格式: {status, msg, data, pagination}
                let content = '';
                if (result.status === 200 && result.data) {
                    // 成功响应，提取 data 字段
                    content = result.data;
                } else if (result.status !== 200) {
                    // API 返回错误，使用 msg 字段
                    content = result.msg || '抱歉，服务器返回了错误。';
                    throw new Error(content);
                } else if (result.content) {
                    content = result.content;
                } else if (result.message) {
                    content = result.message;
                } else if (typeof result === 'string') {
                    content = result;
                } else {
                    // 未知格式，尝试提取可能的文本内容
                    content = JSON.stringify(result);
                }

                // 停止加载动画
                if (messageAvatar) {
                    messageAvatar.style.animation = '';
                }

                // 显示生成的内容
                if (messageText) {
                    // 确保内容不为空
                    if (!content || !content.trim()) {
                        content = '抱歉，未能获取到有效内容。';
                    }
                    messageText.innerHTML = this.renderMarkdown(content);
                    // 更新原始文本用于复制功能
                    messageText.setAttribute('data-original-text', content);
                    // 添加复制按钮
                    if (content && content.trim()) {
                        const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                        if (copyButtonContainer) {
                            this.addCopyButton(copyButtonContainer, messageText);
                        }
                        // 添加 try again 按钮（仅当不是第一条消息时）
                        const petMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]')
                        );
                        if (petMessages.length > 1) {
                            const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                this.addTryAgainButton(tryAgainContainer, message);
                            }
                        }
                    }
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

                // prompt 接口完成后，立即同步到后端
                if (content && content.trim()) {
                    // 更新会话中的消息（角色按钮生成的消息）
                    await this.addMessageToSession('pet', content);
                    await this.saveCurrentSession();
                    if (PET_CONFIG.api.syncSessionsToBackend && this.currentSessionId) {
                        await this.syncSessionToBackend(this.currentSessionId, true).catch(err => {
                            console.warn('角色按钮操作后同步会话到后端失败:', err);
                        });
                    }
                }

                iconEl.innerHTML = '✓';
                iconEl.style.cursor = 'default';
                iconEl.style.color = '#4caf50';

                // 2秒后恢复初始状态，允许再次点击（根据角色设置恢复图标与标题）
                setTimeout(() => {
                    this.applyRoleConfigToActionIcon(iconEl, actionKey);
                    iconEl.style.color = '#666';
                    iconEl.style.cursor = 'pointer';
                    iconEl.style.opacity = '1';
                    processingFlag.value = false;
                }, 2000);

            } catch (error) {
                // 检查是否是取消错误
                const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';
                
                if (!isAbortError) {
                    console.error(`生成${roleInfo.label}失败:`, error);
                }
                
                // 显示错误消息（取消时不显示）
                if (!isAbortError && messageText) {
                    const errorMessage = error.message && error.message.includes('HTTP error') 
                        ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${loadingIcon}`
                        : `抱歉，无法生成"${pageInfo.title || '当前页面'}"的${roleInfo.label || '内容'}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${loadingIcon}`;
                    messageText.innerHTML = this.renderMarkdown(errorMessage);
                    // 添加 try again 按钮（仅当不是第一条消息时）
                    const petMessages = Array.from(messagesContainer.children).filter(
                        child => child.querySelector('[data-message-type="pet-bubble"]')
                    );
                    if (petMessages.length > 1) {
                        const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                        if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                            this.addTryAgainButton(tryAgainContainer, message);
                        }
                    }
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                } else if (isAbortError && messageText) {
                    // 请求被取消，移除消息
                    message.remove();
                }
                
                if (!isAbortError) {
                    iconEl.innerHTML = '✕';
                    iconEl.style.cursor = 'default';
                    iconEl.style.color = '#f44336';

                    // 1.5秒后恢复初始状态，允许再次点击（根据角色设置恢复图标与标题）
                    setTimeout(() => {
                        this.applyRoleConfigToActionIcon(iconEl, actionKey);
                        iconEl.style.color = '#666';
                        iconEl.style.cursor = 'pointer';
                        iconEl.style.opacity = '1';
                        processingFlag.value = false;
                    }, 1500);
                } else {
                    // 请求被取消，立即恢复状态
                    this.applyRoleConfigToActionIcon(iconEl, actionKey);
                    iconEl.style.color = '#666';
                    iconEl.style.cursor = 'pointer';
                    iconEl.style.opacity = '1';
                    processingFlag.value = false;
                }
            } finally {
                // 确保停止加载动画
                if (messageAvatar) {
                    messageAvatar.style.animation = '';
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        };
    }

    // 已移除 custom-role-shortcuts 功能

    // -------- 角色设置弹框（新增/编辑/删除） --------
    openRoleSettingsModal(editId = null) {
        if (!this.chatWindow) return;
        let overlay = this.chatWindow.querySelector('#pet-role-settings');
        const currentColor = this.colors[this.colorIndex];
        const mainColor = this.getMainColorFromGradient(currentColor);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pet-role-settings';
            const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
            const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
            overlay.style.cssText = `
                position: absolute !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                top: ${headerH}px !important;
                background: transparent !important;
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: ${PET_CONFIG.ui.zIndex.inputContainer + 1} !important;
                pointer-events: none !important;
            `;

            const panel = document.createElement('div');
            panel.id = 'pet-role-settings-panel';
            panel.style.cssText = `
                width: calc(100% - 24px) !important;
                height: calc(100% - 12px) !important;
                margin: 0 12px 12px 12px !important;
                background: #1f1f1f !important;
                color: #fff !important;
                border-radius: 12px !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                pointer-events: auto !important;
            `;

            const header = document.createElement('div');
            header.style.cssText = `
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 16px 20px !important;
                border-bottom: 1px solid rgba(255,255,255,0.08) !important;
                background: rgba(255,255,255,0.04) !important;
                flex-shrink: 0 !important;
            `;
            const title = document.createElement('div');
            title.textContent = '角色设置';
            title.style.cssText = 'font-weight: 600; font-size: 16px; color: #fff;';

            const headerBtns = document.createElement('div');
            headerBtns.style.cssText = 'display:flex; gap:10px; align-items:center;';
            const closeBtn = document.createElement('button');
            closeBtn.id = 'pet-role-settings-close-btn';
            closeBtn.setAttribute('aria-label', '关闭角色设置 (Esc)');
            closeBtn.setAttribute('title', '关闭 (Esc)');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                width: 32px !important;
                height: 32px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 6px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                font-size: 16px !important;
                transition: all 0.2s ease !important;
                outline: none !important;
            `;
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = 'rgba(239, 68, 68, 0.15)';
                closeBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                closeBtn.style.color = '#ef4444';
                closeBtn.style.transform = 'translateY(-1px)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'rgba(255,255,255,0.06)';
                closeBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                closeBtn.style.color = '#e5e7eb';
                closeBtn.style.transform = 'translateY(0)';
            });
            closeBtn.addEventListener('mousedown', () => {
                closeBtn.style.transform = 'scale(0.96)';
            });
            closeBtn.addEventListener('mouseup', () => {
                closeBtn.style.transform = 'scale(1)';
            });
            closeBtn.addEventListener('click', () => this.closeRoleSettingsModal());
            headerBtns.appendChild(closeBtn);
            header.appendChild(title);
            header.appendChild(headerBtns);

            const body = document.createElement('div');
            body.id = 'pet-role-settings-body';
            body.style.cssText = `
                display: flex !important;
                gap: 16px !important;
                padding: 16px 20px !important;
                height: 100% !important;
                min-height: 0 !important;
                overflow: hidden !important;
            `;

            // 左侧：角色列表
            const listContainer = document.createElement('div');
            listContainer.style.cssText = `
                width: 38% !important;
                min-width: 280px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 12px !important;
            `;
            
            // 新增角色按钮（放在列表顶部）
            const addBtn = document.createElement('button');
            addBtn.textContent = '新增角色';
            addBtn.style.cssText = `
                padding: 8px 16px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                border-radius: 6px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                flex-shrink: 0 !important;
            `;
            addBtn.addEventListener('mouseenter', () => {
                addBtn.style.background = 'rgba(255,255,255,0.12)';
                addBtn.style.borderColor = 'rgba(255,255,255,0.25)';
                addBtn.style.transform = 'translateY(-1px)';
            });
            addBtn.addEventListener('mouseleave', () => {
                addBtn.style.background = 'rgba(255,255,255,0.06)';
                addBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                addBtn.style.transform = 'translateY(0)';
            });
            addBtn.addEventListener('click', () => this.renderRoleSettingsForm(null, false));
            listContainer.appendChild(addBtn);
            
            const list = document.createElement('div');
            list.id = 'pet-role-list';
            list.style.cssText = `
                flex: 1 !important;
                min-height: 0 !important;
                background: #181818 !important;
                color: #e5e7eb !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                border-radius: 10px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding: 12px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
            `;
            listContainer.appendChild(list);

            // 右侧：表单区
            const form = document.createElement('div');
            form.id = 'pet-role-form';
            form.style.cssText = `
                flex: 1 !important;
                background: #181818 !important;
                color: #e5e7eb !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                border-radius: 10px !important;
                padding: 20px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 16px !important;
            `;

            body.appendChild(listContainer);
            body.appendChild(form);
            panel.appendChild(header);
            panel.appendChild(body);
            overlay.appendChild(panel);
            this.chatWindow.appendChild(overlay);
        }

        overlay.style.display = 'flex';
        // 直接渲染当前配置（不再强制补齐默认项，便于"删除"生效）
        this.renderRoleSettingsList();
        if (editId) {
            this.renderRoleSettingsForm(editId);
        } else {
            this.renderRoleSettingsForm(null, true); // 第二个参数表示显示空白状态
        }
    }

    closeRoleSettingsModal() {
        if (!this.chatWindow) return;
        const overlay = this.chatWindow.querySelector('#pet-role-settings');
        if (overlay) overlay.style.display = 'none';
    }

    async getRoleConfigs() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['roleConfigs'], (result) => {
                resolve(Array.isArray(result.roleConfigs) ? result.roleConfigs : []);
            });
        });
    }

    async setRoleConfigs(configs) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ roleConfigs: configs }, () => resolve(true));
        });
    }

    // 读取内置角色定义并转为默认配置（从已有配置中获取label、icon和prompt，如果没有则使用默认值）
    buildDefaultRoleConfigsFromBuiltins(existingConfigs = null) {
        const keys = ['summary', 'mindmap', 'flashcard', 'report', 'bestPractice'];
        const includeChartsMap = {
            summary: false,
            mindmap: true,
            flashcard: false,
            report: true,
            bestPractice: true
        };
        const arr = [];
        keys.forEach(k => {
            // 从已有配置中查找对应的label、icon和prompt
            let label = k; // 默认使用actionKey
            let icon = ''; // 默认icon为空，由用户配置
            let prompt = ''; // 默认prompt为空，由用户配置
            if (existingConfigs && Array.isArray(existingConfigs)) {
                const existing = existingConfigs.find(c => c && c.actionKey === k);
                if (existing) {
                    if (existing.label && typeof existing.label === 'string') {
                        const trimmedLabel = existing.label.trim();
                        if (trimmedLabel) {
                            label = trimmedLabel;
                        }
                    }
                    if (existing.icon && typeof existing.icon === 'string') {
                        const trimmedIcon = existing.icon.trim();
                        if (trimmedIcon) {
                            icon = trimmedIcon;
                        }
                    }
                    if (existing.prompt && typeof existing.prompt === 'string') {
                        const trimmedPrompt = existing.prompt.trim();
                        if (trimmedPrompt) {
                            prompt = trimmedPrompt;
                        }
                    }
                }
            }
            arr.push({
                id: 'builtin_' + k,
                label: label,
                actionKey: k,
                icon: icon,
                includeCharts: includeChartsMap[k] || false,
                prompt: prompt
            });
        });
        return arr;
    }

    // 确保默认角色已存在（仅在为空或缺少时补齐）
    async ensureDefaultRoleConfigs() {
        const existing = await this.getRoleConfigs();
        const defaults = this.buildDefaultRoleConfigsFromBuiltins(existing);
        if (!existing || existing.length === 0) {
            await this.setRoleConfigs(defaults);
            return true;
        }
        // 补齐缺失的内置项
        const haveKeys = new Set(existing.map(c => c.actionKey));
        let updated = false;
        defaults.forEach(d => {
            if (!haveKeys.has(d.actionKey)) {
                existing.push({
                    id: d.id,
                    label: d.label,
                    actionKey: d.actionKey,
                    icon: d.icon,
                    includeCharts: d.includeCharts,
                    prompt: d.prompt
                });
                updated = true;
            }
        });
        // 回填缺失图标（老数据兼容）
        for (const c of existing) {
            if ((!c.icon || !String(c.icon).trim()) && c.actionKey) {
                c.icon = this.getRoleIcon(c, existing);
                updated = true;
            }
        }
        if (updated) {
            await this.setRoleConfigs(existing);
        }
        return true;
    }

    async renderRoleSettingsList() {
        if (!this.chatWindow) return;
        const list = this.chatWindow.querySelector('#pet-role-list');
        if (!list) return;
        const configsRaw = await this.getRoleConfigs();
        list.innerHTML = '';

        // 先显示已绑定按钮的角色（按按钮顺序）
        // 使用 getOrderedBoundRoleKeys() 确保与 refreshWelcomeActionButtons() 顺序一致
        const orderedKeys = await this.getOrderedBoundRoleKeys();
        const boundRoleIds = new Set();
        for (const key of orderedKeys) {
            const config = (configsRaw || []).find(c => c && c.actionKey === key);
            if (config) {
                boundRoleIds.add(config.id);
                // 使用统一的角色信息获取函数获取标签
                const roleInfo = await this.getRoleInfoForAction(key);
                const row = this.createRoleListItem(config, roleInfo.label, configsRaw);
                list.appendChild(row);
            }
        }

        // 再显示其他角色（没有绑定按钮的角色）
        const otherRoles = (configsRaw || []).filter(c => c && c.id && !boundRoleIds.has(c.id));
        if (otherRoles.length > 0) {
            // 如果有已绑定的角色，添加分隔线
            if (orderedKeys.length > 0) {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0; border-radius: 1px;';
                list.appendChild(separator);
            }
            
            otherRoles.forEach((config) => {
                const row = this.createRoleListItem(config, '', configsRaw);
                list.appendChild(row);
            });
        }

        // 如果没有任何角色
        if (list.children.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = '暂无可编辑角色。点击"新增角色"开始创建';
            empty.style.cssText = 'color: #64748b; font-size: 13px; padding: 24px 12px; text-align: center; line-height: 1.5;';
            list.appendChild(empty);
        }
    }

    // 创建角色列表项
    createRoleListItem(c, buttonLabel, allConfigs = null) {
        const row = document.createElement('div');
        row.style.cssText = `
            display:flex !important;
            align-items:center !important;
            justify-content: space-between !important;
            gap: 12px !important;
            padding: 12px !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            border-radius: 8px !important;
            background: rgba(255,255,255,0.02) !important;
            transition: all 0.2s ease !important;
            cursor: pointer !important;
        `;
        row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(255,255,255,0.05)';
            row.style.borderColor = 'rgba(255,255,255,0.15)';
            row.style.transform = 'translateX(2px)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'rgba(255,255,255,0.02)';
            row.style.borderColor = 'rgba(255,255,255,0.08)';
            row.style.transform = 'translateX(0)';
        });
        const info = document.createElement('div');
        info.style.cssText = 'display:flex; flex-direction:column; gap:6px; flex:1; min-width:0;';
        const name = document.createElement('div');
        const displayIcon = this.getRoleIcon(c, allConfigs);
        name.textContent = `${displayIcon ? (displayIcon + ' ') : ''}${c.label || '(未命名)'}`;
        name.style.cssText = 'font-weight: 600; font-size: 13px; color: #fff; line-height: 1.4; word-break: break-word;';
        info.appendChild(name);
        if (buttonLabel && buttonLabel.trim()) {
            const sub = document.createElement('div');
            sub.textContent = buttonLabel;
            sub.style.cssText = 'color: #94a3b8; font-size: 11px; line-height: 1.3;';
            info.appendChild(sub);
        }

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex; gap:6px; flex-shrink:0;';
        const edit = document.createElement('button');
        edit.textContent = '编辑';
        edit.style.cssText = `
            padding: 6px 10px !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        `;
        edit.addEventListener('mouseenter', () => {
            edit.style.background = 'rgba(59, 130, 246, 0.15)';
            edit.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            edit.style.color = '#60a5fa';
            edit.style.transform = 'translateY(-1px)';
        });
        edit.addEventListener('mouseleave', () => {
            edit.style.background = 'rgba(255,255,255,0.06)';
            edit.style.borderColor = 'rgba(255,255,255,0.15)';
            edit.style.color = '#e5e7eb';
            edit.style.transform = 'translateY(0)';
        });
        edit.addEventListener('click', () => this.renderRoleSettingsForm(c.id));
        const del = document.createElement('button');
        del.textContent = '删除';
        del.style.cssText = `
            padding: 6px 10px !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        `;
        del.addEventListener('mouseenter', () => {
            del.style.background = 'rgba(239, 68, 68, 0.15)';
            del.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            del.style.color = '#f87171';
            del.style.transform = 'translateY(-1px)';
        });
        del.addEventListener('mouseleave', () => {
            del.style.background = 'rgba(255,255,255,0.06)';
            del.style.borderColor = 'rgba(255,255,255,0.15)';
            del.style.color = '#e5e7eb';
            del.style.transform = 'translateY(0)';
        });
        del.addEventListener('click', async () => {
            const next = (await this.getRoleConfigs()).filter(x => x.id !== c.id);
            await this.setRoleConfigs(next);
            this.renderRoleSettingsList();
            this.renderRoleSettingsForm(null, true); // 显示空白状态
            // 同步刷新欢迎消息下的动作按钮
            await this.refreshWelcomeActionButtons();
            // 刷新所有消息下的按钮
            await this.refreshAllMessageActionButtons();
        });
        btns.appendChild(edit);
        btns.appendChild(del);

        row.appendChild(info);
        row.appendChild(btns);
        return row;
    }

    async renderRoleSettingsForm(editId = null, showEmptyState = false) {
        if (!this.chatWindow) return;
        const form = this.chatWindow.querySelector('#pet-role-form');
        if (!form) return;
        const configsAll = await this.getRoleConfigs();
        // 用于查找已绑定按钮的角色列表（用于检查占用情况）
        const configs = (configsAll || []).filter(c => c && c.actionKey);
        // 当前编辑的角色（从所有角色中查找）
        const current = editId ? (configsAll || []).find(c => c && c.id === editId) : null;
        
        form.innerHTML = '';

        // 如果显示空白状态（没有选中角色且不是主动新增）
        if (showEmptyState && !editId && !current) {
            const emptyState = document.createElement('div');
            emptyState.style.cssText = `
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                height: 100% !important;
                padding: 40px 20px !important;
                text-align: center !important;
            `;
            
            const icon = document.createElement('div');
            icon.textContent = '👤';
            icon.style.cssText = `
                font-size: 64px !important;
                margin-bottom: 20px !important;
                opacity: 0.6 !important;
            `;
            
            const title = document.createElement('div');
            title.textContent = '选择一个角色开始编辑';
            title.style.cssText = `
                font-weight: 600 !important;
                font-size: 16px !important;
                color: #e5e7eb !important;
                margin-bottom: 8px !important;
            `;
            
            const desc = document.createElement('div');
            desc.textContent = '从左侧列表选择角色进行编辑，或点击"新增角色"创建新角色';
            desc.style.cssText = `
                font-size: 13px !important;
                color: #94a3b8 !important;
                line-height: 1.6 !important;
                max-width: 320px !important;
            `;
            
            const actionBtn = document.createElement('button');
            actionBtn.textContent = '新增角色';
            actionBtn.style.cssText = `
                margin-top: 24px !important;
                padding: 10px 24px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                border-radius: 8px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
            `;
            actionBtn.addEventListener('mouseenter', () => {
                actionBtn.style.background = 'rgba(255,255,255,0.12)';
                actionBtn.style.borderColor = 'rgba(255,255,255,0.25)';
                actionBtn.style.transform = 'translateY(-2px)';
            });
            actionBtn.addEventListener('mouseleave', () => {
                actionBtn.style.background = 'rgba(255,255,255,0.06)';
                actionBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                actionBtn.style.transform = 'translateY(0)';
            });
            actionBtn.addEventListener('click', () => {
                this.renderRoleSettingsForm(null, false); // 显示新增表单
            });
            
            emptyState.appendChild(icon);
            emptyState.appendChild(title);
            emptyState.appendChild(desc);
            emptyState.appendChild(actionBtn);
            form.appendChild(emptyState);
            return;
        }

        const title = document.createElement('div');
        title.textContent = current ? '编辑角色' : '新增角色';
        title.style.cssText = 'font-weight: 600; font-size: 18px; color: #fff; margin-bottom: 4px;';

        const row = (labelText, inputEl) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
            const lab = document.createElement('label');
            lab.textContent = labelText;
            lab.style.cssText = 'font-size: 13px; font-weight: 500; color: #cbd5e1;';
            wrap.appendChild(lab);
            wrap.appendChild(inputEl);
            return wrap;
        };

        const currentColor = this.colors[this.colorIndex];
        const mainColor = this.getMainColorFromGradient(currentColor);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = current?.label || '';
        nameInput.placeholder = '角色名称，如：会议纪要摘要';
        nameInput.style.cssText = `
            padding: 10px 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            font-size: 13px !important;
            transition: all 0.2s ease !important;
        `;
        nameInput.addEventListener('focus', () => {
            nameInput.style.borderColor = 'rgba(255,255,255,0.25)';
            nameInput.style.background = '#1a1a1a';
        });
        nameInput.addEventListener('blur', () => {
            nameInput.style.borderColor = 'rgba(255,255,255,0.12)';
            nameInput.style.background = '#121212';
        });

        // 角色图标（可用 Emoji 或短文本）
        const iconInput = document.createElement('input');
        iconInput.type = 'text';
        iconInput.value = current?.icon || '';
        iconInput.placeholder = '图标（Emoji 或短文本，如：📝 / AI）';
        // 取消 maxLength，避免多码点 Emoji 被截断
        iconInput.style.cssText = `
            padding: 10px 12px !important;
            width: 80px !important;
            text-align: center !important;
            font-size: 18px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            transition: all 0.2s ease !important;
        `;
        iconInput.addEventListener('focus', () => {
            iconInput.style.borderColor = 'rgba(255,255,255,0.25)';
            iconInput.style.background = '#1a1a1a';
        });
        iconInput.addEventListener('blur', () => {
            iconInput.style.borderColor = 'rgba(255,255,255,0.12)';
            iconInput.style.background = '#121212';
        });

        // 图标预览与快捷选择
        const iconRow = document.createElement('div');
        iconRow.style.cssText = 'display:flex; align-items:center; gap:12px;';
        const iconPreview = document.createElement('div');
        iconPreview.textContent = iconInput.value || '🙂';
        iconPreview.style.cssText = `
            width: 48px !important;
            height: 48px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 10px !important;
            background: #121212 !important;
            color: #e5e7eb !important;
            font-size: 24px !important;
            flex-shrink: 0 !important;
        `;
        const emojiQuick = document.createElement('div');
        emojiQuick.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; margin-top: 4px;';
        const commonEmojis = ['📝','🧠','📚','📌','✅','💡','🔍','📄','🗂️','⭐'];
        commonEmojis.forEach(e => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = e;
            b.style.cssText = `
                width: 36px !important;
                height: 36px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.04) !important;
                color: #e5e7eb !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font-size: 18px !important;
                transition: all 0.2s ease !important;
            `;
            b.addEventListener('mouseenter', () => {
                b.style.background = 'rgba(255,255,255,0.12)';
                b.style.borderColor = 'rgba(255,255,255,0.3)';
                b.style.transform = 'scale(1.1)';
            });
            b.addEventListener('mouseleave', () => {
                b.style.background = 'rgba(255,255,255,0.04)';
                b.style.borderColor = 'rgba(255,255,255,0.15)';
                b.style.transform = 'scale(1)';
            });
            b.addEventListener('click', () => {
                iconInput.value = e;
                iconPreview.textContent = e || '🙂';
            });
            emojiQuick.appendChild(b);
        });
        iconInput.addEventListener('input', () => {
            iconPreview.textContent = iconInput.value || '🙂';
        });

        // 去除“对应功能”下拉框

        // 已移除“生成内容包含图表（如 Mermaid）”选项

        const promptArea = document.createElement('textarea');
        promptArea.rows = 16;
        promptArea.placeholder = '提示语（可选）：为该角色的生成提供风格/结构指导';
        promptArea.value = current?.prompt || '';
        promptArea.style.cssText = `
            padding: 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            resize: vertical !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            font-size: 13px !important;
            line-height: 1.5 !important;
            font-family: inherit !important;
            transition: all 0.2s ease !important;
            min-height: 200px !important;
        `;
        promptArea.addEventListener('focus', () => {
            promptArea.style.borderColor = 'rgba(255,255,255,0.25)';
            promptArea.style.background = '#1a1a1a';
        });
        promptArea.addEventListener('blur', () => {
            promptArea.style.borderColor = 'rgba(255,255,255,0.12)';
            promptArea.style.background = '#121212';
        });

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex; gap:10px; margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 10px 20px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 8px !important;
            border: 1px solid rgba(34, 197, 94, 0.3) !important;
            background: rgba(34, 197, 94, 0.15) !important;
            color: #4ade80 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            flex: 1 !important;
        `;
        saveBtn.addEventListener('mouseenter', () => {
            saveBtn.style.background = 'rgba(34, 197, 94, 0.25)';
            saveBtn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
            saveBtn.style.transform = 'translateY(-1px)';
        });
        saveBtn.addEventListener('mouseleave', () => {
            saveBtn.style.background = 'rgba(34, 197, 94, 0.15)';
            saveBtn.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            saveBtn.style.transform = 'translateY(0)';
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 10px 20px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 8px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            flex: 1 !important;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.12)';
            cancelBtn.style.borderColor = 'rgba(255,255,255,0.25)';
            cancelBtn.style.transform = 'translateY(-1px)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.06)';
            cancelBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            cancelBtn.style.transform = 'translateY(0)';
        });

        // 提取首个“可见字符”的简易函数（优先保留完整 Emoji）
        const getSafeIcon = (raw) => {
            try {
                if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                    const it = seg.segment(raw);
                    const first = it[Symbol.iterator]().next();
                    return first && first.value ? first.value.segment : raw.trim();
                }
            } catch (_) {}
            return raw.trim();
        };

        saveBtn.addEventListener('click', async () => {
            // 保存按钮加载状态
            const originalText = saveBtn.textContent;
            const isLoading = saveBtn.dataset.loading === 'true';
            if (isLoading) return; // 防止重复点击
            
            // 设置加载状态
            saveBtn.dataset.loading = 'true';
            saveBtn.textContent = '保存中...';
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.7';
            saveBtn.style.cursor = 'not-allowed';
            
            // 保存加载状态样式（如果还没有）
            if (!document.getElementById('role-save-loading-styles')) {
                const loadingStyle = document.createElement('style');
                loadingStyle.id = 'role-save-loading-styles';
                loadingStyle.textContent = `
                    @keyframes roleSavePulse {
                        0%, 100% { opacity: 0.7; }
                        50% { opacity: 1; }
                    }
                    button[data-loading="true"] {
                        animation: roleSavePulse 1.5s ease-in-out infinite !important;
                    }
                `;
                document.head.appendChild(loadingStyle);
            }
            
            try {
                const next = {
                    id: current?.id || ('r_' + Math.random().toString(36).slice(2, 10)),
                    label: nameInput.value.trim() || '未命名角色',
                    actionKey: current?.actionKey || '',
                    includeCharts: current?.includeCharts ?? false,
                    icon: (iconInput.value.trim() === '' ? (current?.icon || '') : getSafeIcon(iconInput.value)),
                    prompt: promptArea.value.trim(),
                };
                
                const arr = await this.getRoleConfigs();
                
                // 更新或添加角色
                const idx = arr.findIndex(x => x.id === next.id);
                const isEdit = idx >= 0;
                if (isEdit) {
                    arr[idx] = next;
                } else {
                    arr.push(next);
                }
                
                await this.setRoleConfigs(arr);
                
                // 短暂延迟以提供更好的视觉反馈
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // 刷新界面
                this.renderRoleSettingsList();
                this.renderRoleSettingsForm(null, true); // 显示空白状态
                // 同步刷新欢迎消息下的动作按钮
                await this.refreshWelcomeActionButtons();
                // 刷新所有消息下的按钮
                await this.refreshAllMessageActionButtons();
                
                // 显示成功提示
                const successMessage = isEdit ? `✅ 角色 "${next.label}" 已更新` : `✅ 角色 "${next.label}" 已创建`;
                this.showNotification(successMessage, 'success');
                
            } catch (error) {
                console.error('保存角色设置失败:', error);
                this.showNotification(`❌ 保存失败：${error.message || '未知错误'}`, 'error');
            } finally {
                // 恢复按钮状态
                saveBtn.dataset.loading = 'false';
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
            }
        });

        cancelBtn.addEventListener('click', () => {
            this.renderRoleSettingsForm(null, true); // 显示空白状态
        });

        form.appendChild(title);
        form.appendChild(row('角色名称', nameInput));
        // 图标设置区：预览 + 输入 + 快选
        const iconWrap = document.createElement('div');
        iconWrap.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
        const iconLabel = document.createElement('label');
        iconLabel.textContent = '图标';
        iconLabel.style.cssText = 'font-size: 13px; font-weight: 500; color: #cbd5e1;';
        const iconRowOuter = document.createElement('div');
        iconRowOuter.style.cssText = 'display:flex; align-items:center; gap:10px;';
        iconRowOuter.appendChild(iconPreview);
        iconRowOuter.appendChild(iconInput);
        iconWrap.appendChild(iconLabel);
        iconWrap.appendChild(iconRowOuter);
        iconWrap.appendChild(emojiQuick);
        form.appendChild(iconWrap);
        form.appendChild(row('提示语', promptArea));
        form.appendChild(btns);
        btns.appendChild(saveBtn);
        btns.appendChild(cancelBtn);
    }

    // 动态更新上下文覆盖层的位置与尺寸，避免遮挡 chat-header
    updateContextEditorPosition() {
        if (!this.chatWindow) return;
        const overlay = this.chatWindow.querySelector('#pet-context-editor');
        if (!overlay) return;
        const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
        const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
        overlay.style.top = headerH + 'px';
        overlay.style.left = '0px';
        overlay.style.right = '0px';
        overlay.style.bottom = '0px';
    }

    // 复制页面上下文编辑器内容
    copyContextEditor() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;
        
        const content = textarea.value || '';
        if (!content.trim()) return;
        
        // 复制到剪贴板
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            // 显示复制成功反馈
            const copyBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-copy-btn') : null;
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '已复制';
                copyBtn.style.background = 'rgba(76, 175, 80, 0.3)';
                copyBtn.style.color = '#4caf50';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = 'rgba(255,255,255,0.04)';
                    copyBtn.style.color = '#e5e7eb';
                }, 1500);
            }
        } catch (err) {
            console.error('复制失败:', err);
        }
        
        document.body.removeChild(textArea);
    }

    downloadContextMarkdown() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;
        const content = textarea.value || '';
        const title = (document.title || 'page').replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '');
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        const filename = `${title}_${stamp}.md`;
        try {
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                if (a.parentNode) a.parentNode.removeChild(a);
            }, 0);
        } catch (e) {
            // 忽略下载错误
        }
    }


    loadContextIntoEditor() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;
        try {
            // 优先使用会话保存的页面内容
            let md = '';
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                md = session.pageContent || this.getPageContentAsMarkdown();
            } else {
                md = this.getPageContentAsMarkdown();
            }
            textarea.value = md || '';
        } catch (e) {
            textarea.value = '获取页面上下文失败。';
        }
    }

    updateContextPreview() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        const preview = this.chatWindow ? this.chatWindow.querySelector('#pet-context-preview') : null;
        if (!textarea || !preview) return;
        const markdown = textarea.value || '';
        // 使用已存在的 Markdown 渲染
        preview.innerHTML = this.renderMarkdown(markdown);
        // 渲染 mermaid（若有）- 防抖，避免频繁触发
        if (preview._mermaidTimer) {
            clearTimeout(preview._mermaidTimer);
            preview._mermaidTimer = null;
        }
        preview._mermaidTimer = setTimeout(async () => {
            await this.processMermaidBlocks(preview);
            preview._mermaidTimer = null;
        }, 200);
    }

    // 初始化聊天滚动功能
    initializeChatScroll() {
        if (!this.chatWindow) return;

        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (messagesContainer) {
            // 确保滚动功能正常
            messagesContainer.style.overflowY = 'auto';

            // 滚动到底部显示最新消息
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);

            // 强制重新计算布局
            messagesContainer.style.height = 'auto';
            messagesContainer.offsetHeight; // 触发重排

            // 添加滚动事件监听器，确保滚动功能正常
            messagesContainer.addEventListener('scroll', () => {
                // 可以在这里添加滚动相关的逻辑
            });
        }
    }

    // 更新聊天窗口中的模型选择器显示
    updateChatModelSelector() {
        if (!this.chatWindow) return;

        const modelSelector = this.chatWindow.querySelector('.chat-model-selector');
        if (modelSelector) {
            modelSelector.value = this.currentModel;
        }
    }

    // 创建聊天窗口
    async createChatWindow() {
        // 注意：chatWindowState 已在 openChatWindow() 中初始化

        // 创建聊天窗口容器
        this.chatWindow = document.createElement('div');
        this.chatWindow.id = 'pet-chat-window';
        this.updateChatWindowStyle();

        // 根据宠物颜色获取当前主题色调
        const currentColor = this.colors[this.colorIndex];
        // 提取主色调作为边框颜色
        const getMainColor = (gradient) => {
            const match = gradient.match(/#[0-9a-fA-F]{6}/);
            return match ? match[0] : '#3b82f6';
        };
        const mainColor = getMainColor(currentColor);

        // 创建聊天头部（拖拽区域）- 使用宠物颜色主题
        const chatHeader = document.createElement('div');
        chatHeader.className = 'chat-header';
        chatHeader.style.cssText = `
            background: ${currentColor} !important;
            color: white !important;
            padding: 15px 20px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            cursor: move !important;
            user-select: none !important;
            border-radius: 16px 16px 0 0 !important;
            transition: background 0.2s ease !important;
        `;

        // 添加拖拽提示
        chatHeader.title = '拖拽移动窗口';

        const headerTitle = document.createElement('div');
        headerTitle.className = 'chat-header-title';
        headerTitle.id = 'pet-chat-header-title';
        headerTitle.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
        `;
        headerTitle.innerHTML = `
            <span style="font-size: 20px;">💕</span>
            <span id="pet-chat-header-title-text" style="font-weight: 600; font-size: 16px;">与我聊天</span>
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            background: none !important;
            border: none !important;
            color: white !important;
            font-size: 18px !important;
            cursor: pointer !important;
            padding: 5px !important;
            border-radius: 50% !important;
            width: 30px !important;
            height: 30px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: background 0.3s ease !important;
        `;
        closeBtn.addEventListener('click', () => this.closeChatWindow());
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
        });

        chatHeader.appendChild(headerTitle);
        chatHeader.appendChild(closeBtn);

        // 创建主内容容器（包含侧边栏和消息区域）
        const mainContentContainer = document.createElement('div');
        mainContentContainer.style.cssText = `
            display: flex !important;
            flex: 1 !important;
            overflow: hidden !important;
            background: linear-gradient(135deg, #f8f9fa, #ffffff) !important;
        `;

        // 创建会话侧边栏
        // 加载保存的侧边栏宽度
        this.loadSidebarWidth();
        
        this.sessionSidebar = document.createElement('div');
        this.sessionSidebar.className = 'session-sidebar';
        this.sessionSidebar.style.cssText = `
            width: ${this.sidebarWidth}px !important;
            min-width: 150px !important;
            max-width: 500px !important;
            background: white !important;
            border-right: 1px solid #e5e7eb !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            position: relative !important;
            resize: none !important;
        `;

        // 侧边栏标题容器
        const sidebarHeader = document.createElement('div');
        sidebarHeader.style.cssText = `
            padding: 12px 15px !important;
            border-bottom: 1px solid #e5e7eb !important;
            background: #f9fafb !important;
            display: flex !important;
            align-items: center !important;
        `;
        
        const sidebarTitle = document.createElement('div');
        sidebarTitle.style.cssText = `
            font-weight: 600 !important;
            font-size: 14px !important;
            color: #374151 !important;
        `;
        sidebarTitle.textContent = '💬 会话列表';
        
        sidebarHeader.appendChild(sidebarTitle);

        // 会话列表容器
        const sessionList = document.createElement('div');
        sessionList.className = 'session-list';
        sessionList.style.cssText = `
            flex: 1 !important;
            overflow-y: auto !important;
            padding: 8px !important;
        `;

        // 添加会话列表样式
        if (!document.getElementById('session-sidebar-styles')) {
            const style = document.createElement('style');
            style.id = 'session-sidebar-styles';
            style.textContent = `
                .session-item {
                    padding: 12px !important;
                    margin-bottom: 6px !important;
                    border-radius: 8px !important;
                    cursor: pointer !important;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    background: #f9fafb !important;
                    border: 1px solid transparent !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    position: relative !important;
                    user-select: none !important;
                    will-change: transform, background-color, border-color !important;
                }
                .session-item:hover:not(.switching) {
                    background: #f3f4f6 !important;
                    border-color: #e5e7eb !important;
                    transform: translateX(2px) !important;
                }
                .session-item.active {
                    background: ${mainColor}15 !important;
                    border-color: ${mainColor} !important;
                    box-shadow: 0 2px 8px ${mainColor}20 !important;
                    transform: translateX(4px) !important;
                }
                .session-item.clicked {
                    transform: scale(0.97) translateX(2px) !important;
                    background: ${mainColor}25 !important;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
                }
                .session-item.switching {
                    cursor: wait !important;
                    opacity: 0.8 !important;
                    pointer-events: none !important;
                    position: relative !important;
                    background: ${mainColor}10 !important;
                    border-color: ${mainColor}40 !important;
                }
                .session-item.switching::after {
                    content: '' !important;
                    position: absolute !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    width: 16px !important;
                    height: 16px !important;
                    border: 2px solid ${mainColor} !important;
                    border-top-color: transparent !important;
                    border-radius: 50% !important;
                    animation: session-switching-spin 0.6s linear infinite !important;
                }
                @keyframes session-switching-spin {
                    0% { transform: translate(-50%, -50%) rotate(0deg) !important; }
                    100% { transform: translate(-50%, -50%) rotate(360deg) !important; }
                }
                .session-item.long-press-start {
                    background: rgba(244, 67, 54, 0.08) !important;
                    border-color: rgba(244, 67, 54, 0.3) !important;
                    transform: scale(0.99) !important;
                    transition: all 0.2s ease !important;
                }
                .session-item.long-press-stage-1 {
                    background: rgba(244, 67, 54, 0.12) !important;
                    border-color: rgba(244, 67, 54, 0.4) !important;
                    transform: scale(0.985) !important;
                    box-shadow: 0 2px 8px rgba(244, 67, 54, 0.2) !important;
                }
                .session-item.long-press-stage-2 {
                    background: rgba(244, 67, 54, 0.18) !important;
                    border-color: rgba(244, 67, 54, 0.6) !important;
                    transform: scale(0.975) !important;
                    box-shadow: 0 3px 10px rgba(244, 67, 54, 0.3) !important;
                }
                .session-item.long-press-stage-3 {
                    background: rgba(244, 67, 54, 0.22) !important;
                    border-color: rgba(244, 67, 54, 0.7) !important;
                    transform: scale(0.97) !important;
                    box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4) !important;
                }
                .session-item.long-pressing {
                    background: rgba(244, 67, 54, 0.25) !important;
                    border-color: rgba(244, 67, 54, 0.8) !important;
                    transform: scale(0.96) !important;
                    box-shadow: 0 6px 16px rgba(244, 67, 54, 0.5) !important;
                    animation: long-press-pulse 0.6s ease-in-out infinite !important;
                }
                @keyframes long-press-pulse {
                    0%, 100% {
                        box-shadow: 0 6px 16px rgba(244, 67, 54, 0.5) !important;
                    }
                    50% {
                        box-shadow: 0 6px 20px rgba(244, 67, 54, 0.7) !important;
                    }
                }
                .session-title {
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    color: #374151 !important;
                    margin-bottom: 4px !important;
                    word-break: break-word !important;
                }
                .session-item.active .session-title {
                    color: ${mainColor} !important;
                    font-weight: 600 !important;
                }
                .session-meta {
                    font-size: 11px !important;
                    color: #9ca3af !important;
                }
                .session-item.active .session-meta {
                    color: ${mainColor} !important;
                }
                .session-item.new-session-highlight {
                    animation: new-session-highlight 1.5s ease-out !important;
                }
                @keyframes new-session-highlight {
                    0% {
                        background: ${mainColor}30 !important;
                        transform: scale(1.02) !important;
                    }
                    50% {
                        background: ${mainColor}20 !important;
                    }
                    100% {
                        background: ${mainColor}15 !important;
                        transform: scale(1) !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        this.sessionSidebar.appendChild(sidebarHeader);
        this.sessionSidebar.appendChild(sessionList);
        
        // 在所有内容添加完成后，创建拖拽调整边框（确保在最上层）
        this.createSidebarResizer();

        // 创建消息区域
        const messagesContainer = document.createElement('div');
        messagesContainer.id = 'pet-chat-messages';
        messagesContainer.style.cssText = `
            flex: 1 !important;
            padding: 20px !important;
            padding-bottom: 160px !important;
            overflow-y: auto !important;
            background: linear-gradient(135deg, #f8f9fa, #ffffff) !important;
            position: relative !important;
            min-height: 200px !important;
            user-select: text !important;
        `;

        // 将侧边栏和消息区域添加到主容器
        mainContentContainer.appendChild(this.sessionSidebar);
        mainContentContainer.appendChild(messagesContainer);

        // 统一的 AbortController，用于终止所有正在进行的请求
        let currentAbortController = null;

        // 动态更新底部padding，确保内容不被输入框遮住
        const updatePaddingBottom = () => {
            if (!this.chatWindow) return;
            const inputContainer = this.chatWindow.querySelector('.chat-input-container');
            const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
            if (inputContainer && messagesContainer) {
                const inputHeight = inputContainer.offsetHeight || 160;
                // 添加额外20px的缓冲空间
                messagesContainer.style.paddingBottom = (inputHeight + 20) + 'px';
            }
        };

        // 初始化按钮相关的对象（保留以避免其他地方出错）
        this.actionIcons = {};
        this.buttonHandlers = {};

        // 创建欢迎消息（使用统一方法）
        const welcomeMessage = this.createWelcomeMessage(messagesContainer);

        // 将按钮添加到消息容器中，和时间戳同一行
        setTimeout(() => {
            const messageTime = welcomeMessage?.querySelector('[data-message-time="true"]');
            if (messageTime) {
                // 修改时间戳容器为 flex 布局
                messageTime.style.cssText = `
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    font-size: 11px !important;
                    color: #999 !important;
                    margin-top: 4px !important;
                    max-width: 100% !important;
                    width: 100% !important;
                `;

                // 创建时间文本容器
                const timeText = document.createElement('span');
                timeText.style.cssText = 'flex: 1 !important; min-width: 0 !important;';
                timeText.textContent = this.getCurrentTime();

                // 将原有内容替换为 flex 布局的内容
                messageTime.innerHTML = '';
                messageTime.appendChild(timeText);
                const actionsGroup = document.createElement('div');
                actionsGroup.id = 'pet-welcome-actions';
                actionsGroup.style.cssText = `
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-shrink: 0 !important;
                `;

                // 把 actionsGroup 放到一个相对定位容器里，以便菜单定位
                const actionsWrapper = document.createElement('div');
                actionsWrapper.style.cssText = `
                    position: relative !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                `;

                actionsWrapper.appendChild(actionsGroup);
                messageTime.appendChild(actionsWrapper);
                
                // 根据角色设置动态创建按钮（与角色设置列表保持一致）
                // refreshWelcomeActionButtons() 会从角色配置中获取列表，并确保设置按钮始终在最后
                this.refreshWelcomeActionButtons();
            }
        }, 100);

        // 播放宠物欢迎动画
        this.playChatAnimation();

        // 创建输入区域 - 使用宠物颜色主题
        const inputContainer = document.createElement('div');
        inputContainer.className = 'chat-input-container';
        inputContainer.style.cssText = `
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 20px !important;
            background: white !important;
            border-top: 1px solid #e5e7eb !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            border-radius: 0 !important;
            z-index: ${PET_CONFIG.ui.zIndex.inputContainer} !important;
        `;

        // 创建顶部工具栏（左侧按钮和右侧状态）
        const topToolbar = document.createElement('div');
        topToolbar.style.cssText = `
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 8px !important;
        `;

        // 左侧按钮组
        const leftButtonGroup = document.createElement('div');
        leftButtonGroup.style.cssText = `
            display: flex !important;
            gap: 6px !important;
            align-items: center !important;
        `;

        // 创建 @ 按钮（使用宠物颜色主题）
        const mentionButton = document.createElement('button');
        mentionButton.innerHTML = '@';
        mentionButton.title = '提及';
        mentionButton.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            border-radius: 50% !important;
            background: white !important;
            color: ${mainColor} !important;
            border: 1px solid ${mainColor} !important;
            cursor: pointer !important;
            font-size: 16px !important;
            font-weight: 500 !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;
        mentionButton.addEventListener('mouseenter', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            mentionButton.style.background = currentMainColor;
            mentionButton.style.color = 'white';
            mentionButton.style.borderColor = currentMainColor;
        });
        mentionButton.addEventListener('mouseleave', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            mentionButton.style.background = 'white';
            mentionButton.style.color = currentMainColor;
            mentionButton.style.borderColor = currentMainColor;
        });

        // 创建图片上传按钮（使用宠物颜色主题）
        const imageUploadButton = document.createElement('button');
        imageUploadButton.innerHTML = '📷';
        imageUploadButton.className = 'chat-image-upload-button';
        imageUploadButton.title = '上传图片';
        imageUploadButton.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            border-radius: 6px !important;
            background: white !important;
            color: ${mainColor} !important;
            border: 1px solid ${mainColor} !important;
            cursor: pointer !important;
            font-size: 16px !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;

        imageUploadButton.addEventListener('mouseenter', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            imageUploadButton.style.background = currentMainColor;
            imageUploadButton.style.color = 'white';
            imageUploadButton.style.borderColor = currentMainColor;
        });
        imageUploadButton.addEventListener('mouseleave', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            imageUploadButton.style.background = 'white';
            imageUploadButton.style.color = currentMainColor;
            imageUploadButton.style.borderColor = currentMainColor;
        });

        // 创建隐藏的文件输入
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imageDataUrl = event.target.result;
                    this.sendImageMessage(imageDataUrl);
                };
                reader.readAsDataURL(file);
            }
            fileInput.value = '';
        });

        imageUploadButton.addEventListener('click', () => {
            fileInput.click();
        });

        // 右侧状态组
        const rightStatusGroup = document.createElement('div');
        rightStatusGroup.style.cssText = `
            display: flex !important;
            gap: 8px !important;
            align-items: center !important;
        `;

        // 创建页面上下文开关（扁平化简约设计）
        const contextSwitchContainer = document.createElement('div');
        contextSwitchContainer.className = 'context-switch-container';
        contextSwitchContainer.style.cssText = `
            display: inline-flex !important;
            align-items: center !important;
            gap: 10px !important;
            padding: 4px 0 !important;
            cursor: pointer !important;
            user-select: none !important;
            transition: opacity 0.2s ease !important;
        `;
        contextSwitchContainer.title = '开启/关闭页面上下文，帮助AI理解当前页面内容';

        // 创建标签（简约字体）
        const contextSwitchLabel = document.createElement('span');
        contextSwitchLabel.textContent = '页面上下文';
        contextSwitchLabel.style.cssText = `
            font-size: 12px !important;
            font-weight: 400 !important;
            color: #64748b !important;
            white-space: nowrap !important;
            transition: color 0.2s ease !important;
            letter-spacing: 0.3px !important;
        `;

        // 创建扁平化开关容器
        const switchWrapper = document.createElement('div');
        switchWrapper.style.cssText = `
            position: relative !important;
            width: 40px !important;
            height: 20px !important;
            border-radius: 10px !important;
            background: #cbd5e1 !important;
            transition: background-color 0.2s ease !important;
            cursor: pointer !important;
        `;

        // 创建扁平化开关滑块
        const switchThumb = document.createElement('div');
        switchThumb.style.cssText = `
            position: absolute !important;
            top: 2px !important;
            left: 2px !important;
            width: 16px !important;
            height: 16px !important;
            border-radius: 50% !important;
            background: #ffffff !important;
            transition: transform 0.2s ease !important;
            transform: translateX(0) !important;
        `;

        // 隐藏原生checkbox，但保留功能
        const contextSwitch = document.createElement('input');
        contextSwitch.type = 'checkbox';
        contextSwitch.id = 'context-switch';
        contextSwitch.checked = true; // 默认开启
        contextSwitch.style.cssText = `
            position: absolute !important;
            opacity: 0 !important;
            width: 0 !important;
            height: 0 !important;
            margin: 0 !important;
            pointer-events: none !important;
        `;

        // 更新开关状态的函数（扁平化风格）
        const updateSwitchState = (isChecked) => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            if (isChecked) {
                switchWrapper.style.background = currentMainColor;
                switchThumb.style.transform = 'translateX(20px)';
                contextSwitchLabel.style.color = currentMainColor;
            } else {
                switchWrapper.style.background = '#cbd5e1';
                switchThumb.style.transform = 'translateX(0)';
                contextSwitchLabel.style.color = '#64748b';
            }
        };

        // 初始状态
        updateSwitchState(contextSwitch.checked);

        // 组装开关
        switchWrapper.appendChild(switchThumb);
        contextSwitchContainer.appendChild(contextSwitchLabel);
        contextSwitchContainer.appendChild(switchWrapper);
        contextSwitchContainer.appendChild(contextSwitch);

        // 简约悬停效果（扁平化）
        contextSwitchContainer.addEventListener('mouseenter', () => {
            contextSwitchContainer.style.opacity = '0.8';
        });

        contextSwitchContainer.addEventListener('mouseleave', () => {
            contextSwitchContainer.style.opacity = '1';
        });

        // 点击整个容器切换开关
        contextSwitchContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            contextSwitch.checked = !contextSwitch.checked;
            updateSwitchState(contextSwitch.checked);
            contextSwitch.dispatchEvent(new Event('change'));
        });

        // 从存储中读取开关状态
        chrome.storage.local.get(['contextSwitchEnabled'], (result) => {
            if (result.contextSwitchEnabled !== undefined) {
                contextSwitch.checked = result.contextSwitchEnabled;
                updateSwitchState(contextSwitch.checked);
            }
        });

        // 监听开关状态变化并保存
        contextSwitch.addEventListener('change', () => {
            updateSwitchState(contextSwitch.checked);
            chrome.storage.local.set({ contextSwitchEnabled: contextSwitch.checked });
        });

        // 监听颜色变化，更新开关颜色
        const updateSwitchColor = () => {
            if (contextSwitch.checked) {
                updateSwitchState(true);
            }
        };
        
        // 存储更新函数以便在其他地方调用
        contextSwitchContainer.updateColor = updateSwitchColor;

        leftButtonGroup.appendChild(mentionButton);
        leftButtonGroup.appendChild(imageUploadButton);
        rightStatusGroup.appendChild(contextSwitchContainer);
        // 添加：页面上下文预览/编辑按钮
        const contextBtn = document.createElement('button');
        contextBtn.className = 'chat-toolbar-btn';
        contextBtn.setAttribute('title', '预览/编辑页面上下文');
        contextBtn.textContent = '📝 上下文';
        contextBtn.style.cssText = `
            padding: 6px 10px !important;
            border-radius: 6px !important;
            background: white !important;
            color: ${mainColor} !important;
            border: 1px solid ${mainColor} !important;
            cursor: pointer !important;
            font-size: 12px !important;
            font-weight: 500 !important;
        `;
        contextBtn.addEventListener('mouseenter', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            contextBtn.style.background = currentMainColor;
            contextBtn.style.color = 'white';
            contextBtn.style.borderColor = currentMainColor;
        });
        contextBtn.addEventListener('mouseleave', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            contextBtn.style.background = 'white';
            contextBtn.style.color = currentMainColor;
            contextBtn.style.borderColor = currentMainColor;
        });
        contextBtn.addEventListener('click', () => this.openContextEditor());
        leftButtonGroup.appendChild(contextBtn);
        // 已移除自定义角色快捷入口

        topToolbar.appendChild(leftButtonGroup);
        topToolbar.appendChild(rightStatusGroup);
        inputContainer.appendChild(topToolbar);

        // 创建输入框容器（暗色主题）
        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = `
            display: flex !important;
            gap: 8px !important;
            align-items: flex-end !important;
            position: relative !important;
            width: 100% !important;
        `;

        const messageInput = document.createElement('textarea');
        messageInput.placeholder = '输入消息... (Enter发送, Shift+Enter换行)';
        messageInput.maxLength = PET_CONFIG.chatWindow.input.maxLength;
        messageInput.className = 'chat-message-input';
        messageInput.rows = 2; // 初始2行
        messageInput.style.cssText = `
            flex: 1 !important;
            width: 100% !important;
            padding: 12px 16px !important;
            border: 2px solid ${mainColor} !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 400 !important;
            color: #1f2937 !important;
            background: #f9fafb !important;
            outline: none !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            resize: none !important;
            min-height: 60px !important;
            max-height: 200px !important;
            overflow-y: auto !important;
            line-height: 1.5 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        `;


        // 设置placeholder和滚动条样式
        const style = document.createElement('style');
        style.textContent = `
            .chat-message-input::placeholder {
                color: #888888 !important;
                opacity: 1 !important;
                font-size: 14px !important;
                font-weight: 400 !important;
            }
            .chat-message-input::-webkit-input-placeholder {
                color: #9ca3af !important;
                opacity: 1 !important;
                font-size: 14px !important;
            }
            .chat-message-input::-moz-placeholder {
                color: #9ca3af !important;
                opacity: 1 !important;
                font-size: 14px !important;
            }
            .chat-message-input:-ms-input-placeholder {
                color: #9ca3af !important;
                opacity: 1 !important;
                font-size: 14px !important;
            }
            .chat-message-input::-webkit-scrollbar {
                width: 4px !important;
            }
            .chat-message-input::-webkit-scrollbar-track {
                background: #1e1e1e !important;
            }
            .chat-message-input::-webkit-scrollbar-thumb {
                background: #555555 !important;
                border-radius: 2px !important;
            }
            .chat-message-input::-webkit-scrollbar-thumb:hover {
                background: #666666 !important;
            }
        `;
        document.head.appendChild(style);

        // 自动调整高度和输入时的视觉反馈
        const updateInputState = () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            const hasContent = messageInput.value.trim().length > 0;
            if (hasContent) {
                messageInput.style.borderColor = currentMainColor;
                messageInput.style.background = '#ffffff';
            } else {
                messageInput.style.borderColor = currentMainColor;
                messageInput.style.background = '#f9fafb';
            }
        };

        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            const newHeight = Math.max(60, messageInput.scrollHeight);
            messageInput.style.height = newHeight + 'px';
            updateInputState();
            // 更新消息容器的底部padding
            setTimeout(() => {
                const inputContainer = this.chatWindow.querySelector('.chat-input-container');
                const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
                if (inputContainer && messagesContainer) {
                    const inputHeight = inputContainer.offsetHeight || 160;
                    messagesContainer.style.paddingBottom = (inputHeight + 20) + 'px';
                    // 滚动到底部
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 0);
        });

        // 将颜色转换为rgba用于阴影
        const hexToRgba = (hex, alpha) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        const shadowColor = hexToRgba(mainColor, 0.1);

        messageInput.addEventListener('focus', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            messageInput.style.borderColor = currentMainColor;
            messageInput.style.background = '#ffffff';
            const currentShadowColor = currentMainColor.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16)).join(',');
            messageInput.style.boxShadow = `0 0 0 3px rgba(${currentShadowColor}, 0.1)`;
        });

        messageInput.addEventListener('blur', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            if (messageInput.value.length === 0) {
                messageInput.style.borderColor = currentMainColor;
                messageInput.style.background = '#f9fafb';
            }
            messageInput.style.boxShadow = 'none';
        });

        // 添加粘贴图片支持
        messageInput.addEventListener('paste', async (e) => {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const imageDataUrl = event.target.result;
                        this.sendImageMessage(imageDataUrl);
                    };
                    reader.readAsDataURL(file);
                    break;
                }
            }
        });

        // 发送消息功能（使用流式响应）
        const sendMessage = async () => {
            const message = messageInput.value.trim();
            if (!message) return;

            // 确保有当前会话（如果没有，先初始化会话）
            if (!this.currentSessionId) {
                await this.initSession();
                // 更新聊天窗口标题
                this.updateChatHeaderTitle();
            }

            // 添加用户消息
            const userMessage = this.createMessageElement(message, 'user');
            messagesContainer.appendChild(userMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            // 立即保存用户消息到当前会话（确保消息实时持久化）
            await this.addMessageToSession('user', message);

            // 清空输入框并重置高度
            messageInput.value = '';
            messageInput.style.height = '';
            // 强制重排以确保高度被正确重置
            void messageInput.offsetHeight;
            messageInput.style.height = '60px';

            // 更新输入状态
            updateInputState();

            // 播放思考动画
            this.playChatAnimation();

            // 创建宠物消息元素（用于流式更新）
            let petMessageElement = null;
            let fullContent = '';

            // 流式响应回调函数
            const onStreamContent = (chunk, accumulatedContent) => {
                // 移除打字指示器
                if (typingIndicatorInterval) {
                    clearInterval(typingIndicatorInterval);
                    typingIndicatorInterval = null;
                    const typingIndicator = messagesContainer.querySelector('[data-typing-indicator="true"]');
                    if (typingIndicator) {
                        typingIndicator.remove();
                    }
                }

                if (!petMessageElement) {
                    // 创建消息元素
                    petMessageElement = this.createMessageElement('', 'pet');
                    messagesContainer.appendChild(petMessageElement);
                    
                    // 检查是否是第一条消息（欢迎消息），如果不是第一条，添加 try again 按钮
                    const petMessages = Array.from(messagesContainer.children).filter(
                        child => child.querySelector('[data-message-type="pet-bubble"]')
                    );
                    // 如果不是第一条宠物消息（第一条是欢迎消息），添加 try again 按钮
                    if (petMessages.length > 1) {
                        const tryAgainContainer = petMessageElement.querySelector('[data-try-again-button-container]');
                        if (tryAgainContainer) {
                            this.addTryAgainButton(tryAgainContainer, petMessageElement);
                        }
                    }
                }

                // 更新消息内容 - 找到消息气泡元素并更新其文本（使用 Markdown 渲染）
                fullContent = accumulatedContent;
                const messageBubble = petMessageElement.querySelector('[data-message-type="pet-bubble"]');
                if (messageBubble) {
                    // 使用 renderMarkdown 渲染完整内容
                    messageBubble.innerHTML = this.renderMarkdown(fullContent);
                    // 更新原始文本用于复制功能
                    messageBubble.setAttribute('data-original-text', fullContent);

                    // 处理可能的 Mermaid 图表（使用防抖，避免在流式更新时频繁触发）
                    // 清除之前的定时器
                    if (messageBubble._mermaidTimeout) {
                        clearTimeout(messageBubble._mermaidTimeout);
                    }
                    // 设置新的延迟处理
                    messageBubble._mermaidTimeout = setTimeout(async () => {
                        await this.processMermaidBlocks(messageBubble);
                        messageBubble._mermaidTimeout = null;
                    }, 500);

                    // 如果有内容，添加复制按钮和角色按钮
                    if (fullContent && fullContent.trim()) {
                        const copyButtonContainer = petMessageElement.querySelector('[data-copy-button-container]');
                        if (copyButtonContainer) {
                            this.addCopyButton(copyButtonContainer, messageBubble);
                        }
                        
                        // 确保 try again 按钮已添加（仅当不是第一条消息时）
                        const petMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]')
                        );
                        if (petMessages.length > 1) {
                            const tryAgainContainer = petMessageElement.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                this.addTryAgainButton(tryAgainContainer, petMessageElement);
                            }
                        }
                        
                        // 确保角色按钮已添加（在流式更新过程中也添加，确保按钮及时显示）
                        // 延迟添加以确保消息结构已完全准备好
                        setTimeout(async () => {
                            await this.addActionButtonsToMessage(petMessageElement, false);
                        }, 200);
                    }
                }

                // 自动滚动到底部
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            };

            // 添加动态的等待提示语（在收到第一个chunk之前显示）
            let typingIndicatorInterval = null;
            let waitingTime = 0;
            const thinkingMessages = [
                '🤔 让我仔细想想...',
                '💭 正在思考中...',
                '✨ 灵感正在涌现',
                '🌟 整理思路中...',
                '📝 准备精彩回答',
                '🎯 深度分析中...',
                '🔍 搜索相关信息',
                '💡 突然有了想法',
                '🌊 思绪万千中',
                '🎨 酝酿完美回复'
            ];
            let lastIndex = -1;

            const showTypingIndicator = () => {
                if (petMessageElement) return; // 已经有消息就不显示

                const typingMsg = this.createTypingIndicator();
                messagesContainer.appendChild(typingMsg);

                typingIndicatorInterval = setInterval(() => {
                    waitingTime += 300;
                    const messageBubble = typingMsg.querySelector('[data-message-type="pet-bubble"]');
                    if (messageBubble) {
                        // 每隔一段时间换一个提示语
                        let newIndex;
                        do {
                            newIndex = Math.floor(Math.random() * thinkingMessages.length);
                        } while (newIndex === lastIndex && thinkingMessages.length > 1);
                        lastIndex = newIndex;
                        messageBubble.textContent = thinkingMessages[newIndex];
                    }
                }, 800);
            };

            // 立即显示打字指示器
            showTypingIndicator();

            // 创建 AbortController 用于终止请求（使用统一的 currentAbortController）
            currentAbortController = new AbortController();
            if (this.chatWindow && this.chatWindow._setAbortController) {
                this.chatWindow._setAbortController(currentAbortController);
            }
            if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                this.chatWindow._updateRequestStatus('loading');
            } else {
                updateRequestStatus('loading');
            }

            // 生成宠物响应
            try {
                const reply = await this.generatePetResponseStream(message, onStreamContent, currentAbortController);

                // 清理打字指示器
                if (typingIndicatorInterval) {
                    clearInterval(typingIndicatorInterval);
                    typingIndicatorInterval = null;
                    const typingIndicator = messagesContainer.querySelector('[data-typing-indicator="true"]');
                    if (typingIndicator) {
                        typingIndicator.remove();
                    }
                }

                // 确保最终内容被显示（使用 Markdown 渲染）
                if (petMessageElement && fullContent !== reply) {
                    const messageBubble = petMessageElement.querySelector('[data-message-type="pet-bubble"]');
                    if (messageBubble) {
                        // 清除流式更新中的防抖定时器
                        if (messageBubble._mermaidTimeout) {
                            clearTimeout(messageBubble._mermaidTimeout);
                            messageBubble._mermaidTimeout = null;
                        }
                        
                        messageBubble.innerHTML = this.renderMarkdown(reply);
                        // 更新原始文本
                        messageBubble.setAttribute('data-original-text', reply);
                        // 处理 Mermaid 图表（流式完成后立即处理）
                        setTimeout(async () => {
                            await this.processMermaidBlocks(messageBubble);
                        }, 100);
                        
                        // 确保 try again 按钮已添加（仅当不是第一条消息时）
                        const petMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]')
                        );
                        if (petMessages.length > 1) {
                            const tryAgainContainer = petMessageElement.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                this.addTryAgainButton(tryAgainContainer, petMessageElement);
                            }
                        }
                        
                        // 确保角色按钮已添加（无论内容是否相同，都要确保按钮存在）
                        // 使用强制刷新确保按钮被正确添加
                        await this.addActionButtonsToMessage(petMessageElement, true);
                    }
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                } else if (petMessageElement) {
                    // 即使内容相同，也确保处理 mermaid（可能流式更新时已经设置了内容）
                    const messageBubble = petMessageElement.querySelector('[data-message-type="pet-bubble"]');
                    if (messageBubble && messageBubble._mermaidTimeout) {
                        // 如果还在等待防抖定时器，等待它完成；否则立即处理
                        const waitForTimeout = () => {
                            if (messageBubble._mermaidTimeout) {
                                setTimeout(waitForTimeout, 50);
                            } else {
                                setTimeout(async () => {
                                    await this.processMermaidBlocks(messageBubble);
                                }, 100);
                            }
                        };
                        waitForTimeout();
                    } else if (messageBubble && !messageBubble._mermaidTimeout) {
                        // 如果定时器已经完成，再次检查是否有遗漏的 mermaid
                        setTimeout(async () => {
                            await this.processMermaidBlocks(messageBubble);
                        }, 100);
                    }
                    
                    // 确保 try again 按钮已添加（仅当不是第一条消息时）
                    const petMessages = Array.from(messagesContainer.children).filter(
                        child => child.querySelector('[data-message-type="pet-bubble"]')
                    );
                    if (petMessages.length > 1) {
                        const tryAgainContainer = petMessageElement.querySelector('[data-try-again-button-container]');
                        if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                            this.addTryAgainButton(tryAgainContainer, petMessageElement);
                        }
                    }
                    
                    // 确保角色按钮已添加（即使内容相同，也要确保按钮存在）
                    // 使用强制刷新确保按钮被正确添加
                    await this.addActionButtonsToMessage(petMessageElement, true);
                }

                // 请求成功完成，更新状态为空闲
                currentAbortController = null;
                if (this.chatWindow && this.chatWindow._setAbortController) {
                    this.chatWindow._setAbortController(null);
                }
                if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                    this.chatWindow._updateRequestStatus('idle');
                } else {
                    updateRequestStatus('idle');
                }

                // 立即保存宠物回复到当前会话（确保消息实时持久化）
                if (reply && reply.trim()) {
                    await this.addMessageToSession('pet', reply);
                }

                // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                await this.saveCurrentSession();
                
                // prompt 接口完成后，立即同步到后端
                if (PET_CONFIG.api.syncSessionsToBackend && this.currentSessionId) {
                    await this.syncSessionToBackend(this.currentSessionId, true).catch(err => {
                        console.warn('prompt 接口完成后同步会话到后端失败:', err);
                    });
                }
            } catch (error) {
                // 检查是否是取消错误
                const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';
                
                if (!isAbortError) {
                    console.error('生成回复失败:', error);
                }

                // 清理打字指示器
                if (typingIndicatorInterval) {
                    clearInterval(typingIndicatorInterval);
                    typingIndicatorInterval = null;
                    const typingIndicator = messagesContainer.querySelector('[data-typing-indicator="true"]');
                    if (typingIndicator) {
                        typingIndicator.remove();
                    }
                }

                // 如果不是取消错误，显示错误信息
                if (!isAbortError) {
                    const errorMessageContent = '抱歉，发生了错误，请稍后再试。😔';
                    // 如果已经创建了消息元素，更新错误信息（使用 innerHTML 以支持 Markdown）
                    if (petMessageElement) {
                        const messageBubble = petMessageElement.querySelector('[data-message-type="pet-bubble"]');
                        if (messageBubble) {
                            messageBubble.innerHTML = errorMessageContent;
                            messageBubble.setAttribute('data-original-text', errorMessageContent);
                        }
                        // 确保 try again 按钮已添加（仅当不是第一条消息时）
                        const petMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]')
                        );
                        if (petMessages.length > 1) {
                            const tryAgainContainer = petMessageElement.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                this.addTryAgainButton(tryAgainContainer, petMessageElement);
                            }
                        }
                        
                        // 确保角色按钮已添加（所有错误消息都应该有角色按钮）
                        await this.addActionButtonsToMessage(petMessageElement);
                    } else {
                        const errorMessageContent = '抱歉，发生了错误，请稍后再试。😔';
                        const errorMessage = this.createMessageElement(errorMessageContent, 'pet');
                        messagesContainer.appendChild(errorMessage);
                        // 为错误消息添加 try again 按钮（仅当不是第一条消息时）
                        const petMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]')
                        );
                        if (petMessages.length > 1) {
                            const tryAgainContainer = errorMessage.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer) {
                                this.addTryAgainButton(tryAgainContainer, errorMessage);
                            }
                        }
                        
                        // 确保所有错误消息都有角色按钮
                        await this.addActionButtonsToMessage(errorMessage);
                    }
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    
                    // 保存错误消息到会话（确保错误消息也被记录）
                    if (!isAbortError) {
                        await this.addMessageToSession('pet', errorMessageContent);
                    }
                }

                // 更新状态为空闲（无论成功还是失败，除非是取消操作）
                if (!isAbortError) {
                    currentAbortController = null;
                    if (this.chatWindow && this.chatWindow._setAbortController) {
                        this.chatWindow._setAbortController(null);
                    }
                    if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                        this.chatWindow._updateRequestStatus('idle');
                    } else {
                        updateRequestStatus('idle');
                    }
                }
            }
        };

        // 中文输入法状态跟踪
        let isComposing = false;
        let compositionEndTime = 0;
        const COMPOSITION_END_DELAY = 100; // 组合输入结束后延迟处理回车键的时间（毫秒）
        
        // 监听输入法组合开始事件（中文输入法开始输入）
        messageInput.addEventListener('compositionstart', () => {
            isComposing = true;
            compositionEndTime = 0;
        });
        
        // 监听输入法组合更新事件（输入法正在输入）
        messageInput.addEventListener('compositionupdate', () => {
            isComposing = true;
            compositionEndTime = 0;
        });
        
        // 监听输入法组合结束事件（中文输入法输入完成）
        messageInput.addEventListener('compositionend', (e) => {
            isComposing = false;
            // 记录组合输入结束的时间，用于后续判断
            compositionEndTime = Date.now();
        });
        
        // 键盘事件处理：Enter发送，Shift+Enter换行，ESC清除
        messageInput.addEventListener('keydown', (e) => {
            // 检查是否正在使用中文输入法组合输入
            if (e.isComposing) {
                // 如果正在组合输入，不处理回车键，让输入法正常处理
                return;
            }
            
            // 检查自定义的 isComposing 状态
            if (isComposing) {
                return;
            }
            
            // 检查是否刚刚结束组合输入（防止组合输入刚结束时误触发）
            // 如果组合输入结束时间距离现在不到 COMPOSITION_END_DELAY 毫秒，且按的是回车键，则不处理
            if (e.key === 'Enter' && compositionEndTime > 0) {
                const timeSinceCompositionEnd = Date.now() - compositionEndTime;
                if (timeSinceCompositionEnd < COMPOSITION_END_DELAY) {
                    // 组合输入刚结束，这次回车键可能是用来确认输入法选择，不发送消息
                    return;
                }
            }
            
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
                // 发送消息后重置组合输入结束时间
                compositionEndTime = 0;
            } else if (e.key === 'Escape') {
                e.preventDefault();
                messageInput.value = '';
                messageInput.style.height = '';
                messageInput.style.height = '60px';
                updateInputState();
                messageInput.blur();
            }
        });

        inputWrapper.appendChild(messageInput);
        inputContainer.appendChild(inputWrapper);

        // 创建底部工具栏
        const bottomToolbar = document.createElement('div');
        bottomToolbar.style.cssText = `
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-top: 8px !important;
            width: 100% !important;
        `;

        // 左侧：模型选择器
        const leftBottomGroup = document.createElement('div');
        leftBottomGroup.style.cssText = `
            display: flex !important;
            gap: 6px !important;
            align-items: center !important;
        `;

        // 创建模型选择器（使用宠物颜色主题）
        const modelSelector = document.createElement('select');
        modelSelector.className = 'chat-model-selector';
        modelSelector.style.cssText = `
            padding: 6px 10px !important;
            background: white !important;
            color: #1f2937 !important;
            border: 1px solid ${mainColor} !important;
            border-radius: 6px !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            outline: none !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            min-width: 100px !important;
        `;

        // 添加模型选项
        PET_CONFIG.chatModels.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `${model.icon} ${model.name}`;
            option.selected = model.id === this.currentModel;
            modelSelector.appendChild(option);
        });

        // 模型切换事件
        modelSelector.addEventListener('change', (e) => {
            const selectedModel = e.target.value;
            this.setModel(selectedModel);
            // 显示切换提示
            const modelConfig = PET_CONFIG.chatModels.models.find(m => m.id === selectedModel);
            if (modelConfig) {
                this.showNotification(`已切换到 ${modelConfig.name}`, 'info');
            }
        });

        // 添加悬停效果
        modelSelector.addEventListener('mouseenter', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            modelSelector.style.borderColor = currentMainColor;
            modelSelector.style.background = '#f0f9ff';
        });
        modelSelector.addEventListener('mouseleave', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            modelSelector.style.borderColor = currentMainColor;
            modelSelector.style.background = 'white';
        });

        leftBottomGroup.appendChild(modelSelector);
        bottomToolbar.appendChild(leftBottomGroup);

        // 右侧：请求状态按钮
        const rightBottomGroup = document.createElement('div');
        rightBottomGroup.style.cssText = `
            display: flex !important;
            gap: 6px !important;
            align-items: center !important;
        `;

        // 创建请求状态按钮（使用宠物颜色主题）
        const requestStatusButton = document.createElement('button');
        requestStatusButton.className = 'chat-request-status-button';
        requestStatusButton.innerHTML = '⏹️';
        requestStatusButton.title = '请求状态：空闲';
        requestStatusButton.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            border-radius: 6px !important;
            background: white !important;
            color: ${mainColor} !important;
            border: 1px solid ${mainColor} !important;
            cursor: pointer !important;
            font-size: 16px !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            opacity: 0.5 !important;
            pointer-events: none !important;
        `;

        // 更新请求状态按钮的函数（使用上面定义的 currentAbortController）
        const updateRequestStatus = (status) => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            if (status === 'idle') {
                // 空闲状态
                requestStatusButton.innerHTML = '⏹️';
                requestStatusButton.title = '请求状态：空闲';
                requestStatusButton.style.opacity = '0.5';
                requestStatusButton.style.pointerEvents = 'none';
                requestStatusButton.disabled = true;
                requestStatusButton.style.background = 'white';
                requestStatusButton.style.color = currentMainColor;
            } else if (status === 'loading') {
                // 请求进行中
                requestStatusButton.innerHTML = '⏸️';
                requestStatusButton.title = '点击终止请求';
                requestStatusButton.style.opacity = '1';
                requestStatusButton.style.pointerEvents = 'auto';
                requestStatusButton.disabled = false;
                requestStatusButton.style.background = '#fee2e2';
                requestStatusButton.style.color = '#dc2626';
                requestStatusButton.style.borderColor = '#dc2626';
            } else if (status === 'stopping') {
                // 正在终止
                requestStatusButton.innerHTML = '⏹️';
                requestStatusButton.title = '正在终止请求...';
                requestStatusButton.style.opacity = '0.7';
                requestStatusButton.style.pointerEvents = 'none';
                requestStatusButton.disabled = true;
            }
        };

        // 终止请求的处理函数
        const abortRequest = () => {
            // 获取当前的 AbortController（可能在其他作用域中）
            const controller = currentAbortController || (this.chatWindow && this.chatWindow._currentAbortController ? this.chatWindow._currentAbortController() : null);
            
            if (controller) {
                updateRequestStatus('stopping');
                controller.abort();
                
                // 清除 AbortController 引用
                currentAbortController = null;
                if (this.chatWindow && this.chatWindow._setAbortController) {
                    this.chatWindow._setAbortController(null);
                }
                
                // 清理打字指示器
                const typingIndicator = messagesContainer.querySelector('[data-typing-indicator="true"]');
                if (typingIndicator) {
                    typingIndicator.remove();
                }
                
                // 显示取消提示
                this.showNotification('请求已取消', 'info');
                
                // 延迟恢复空闲状态
                setTimeout(() => {
                    updateRequestStatus('idle');
                }, 500);
            }
        };

        requestStatusButton.addEventListener('mouseenter', () => {
            if (!requestStatusButton.disabled && requestStatusButton.title.includes('终止')) {
                requestStatusButton.style.background = '#dc2626';
                requestStatusButton.style.color = 'white';
                requestStatusButton.style.borderColor = '#dc2626';
            }
        });
        requestStatusButton.addEventListener('mouseleave', () => {
            if (!requestStatusButton.disabled && requestStatusButton.title.includes('终止')) {
                requestStatusButton.style.background = '#fee2e2';
                requestStatusButton.style.color = '#dc2626';
                requestStatusButton.style.borderColor = '#dc2626';
            }
        });

        // 点击按钮终止请求
        requestStatusButton.addEventListener('click', abortRequest);

        // 先添加请求状态按钮
        rightBottomGroup.appendChild(requestStatusButton);
        
        // 然后添加角色设置按钮到 rightBottomGroup（在 requestStatusButton 之后）
        let settingsButton = this.settingsButton;
        if (!settingsButton) {
            settingsButton = document.createElement('span');
            settingsButton.innerHTML = '⚙️';
            settingsButton.title = '角色设置';
            settingsButton.style.cssText = `
                padding: 4px !important;
                cursor: pointer !important;
                font-size: 18px !important;
                color: #666 !important;
                font-weight: 300 !important;
                transition: all 0.2s ease !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                user-select: none !important;
                width: 24px !important;
                height: 24px !important;
                line-height: 24px !important;
            `;
            settingsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openRoleSettingsModal();
            });
            this.settingsButton = settingsButton;
        }
        
        // 如果设置按钮已经在其他容器中，先移除它
        if (settingsButton.parentNode && settingsButton.parentNode !== rightBottomGroup) {
            settingsButton.parentNode.removeChild(settingsButton);
        }
        
        // 如果设置按钮不在 rightBottomGroup 中，添加它（在 requestStatusButton 之后）
        if (settingsButton.parentNode !== rightBottomGroup) {
            rightBottomGroup.appendChild(settingsButton);
        }
        
        bottomToolbar.appendChild(rightBottomGroup);
        inputContainer.appendChild(bottomToolbar);

        // 将文件输入添加到容器
        inputContainer.appendChild(fileInput);

        // 将 currentAbortController 和 updateRequestStatus 暴露给外部函数使用
        // 通过存储到 chatWindow 对象的方式，让角色按钮也能访问
        this.chatWindow._currentAbortController = () => currentAbortController;
        this.chatWindow._setAbortController = (controller) => { currentAbortController = controller; };
        this.chatWindow._updateRequestStatus = updateRequestStatus;

        // 确保上下文编辑器 UI 预创建（隐藏）
        this.ensureContextEditorUi();
        // 确保消息编辑器 UI 预创建（隐藏）
        this.ensureMessageEditorUi();

        // 创建四个缩放手柄（四个角）
        const createResizeHandle = (position) => {
            const handle = document.createElement('div');
			handle.className = `resize-handle resize-handle-${position}`;

            let styles = `
                position: absolute !important;
				width: 20px !important;
				height: 20px !important;
                background: linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 70%, transparent 70%) !important;
                z-index: ${PET_CONFIG.ui.zIndex.resizeHandle} !important;
                transition: background 0.2s ease !important;
            `;

            // 根据位置设置样式
            switch(position) {
                case 'top-left':
                    styles += `
                        top: 0 !important;
                        left: 0 !important;
                        cursor: nw-resize !important;
                        border-radius: 16px 0 0 0 !important;
                    `;
                    break;
                case 'top-right':
                    styles += `
                        top: 0 !important;
                        right: 0 !important;
                        cursor: ne-resize !important;
                        border-radius: 0 16px 0 0 !important;
                    `;
                    break;
                case 'bottom-left':
                    styles += `
                        bottom: 0 !important;
                        left: 0 !important;
                        cursor: sw-resize !important;
                        border-radius: 0 0 0 16px !important;
                    `;
                    break;
                case 'bottom-right':
                    styles += `
                        bottom: 0 !important;
                        right: 0 !important;
                        cursor: nw-resize !important;
                        border-radius: 0 0 16px 0 !important;
                    `;
                    break;
				case 'left':
					styles += `
						top: 20px !important;
						bottom: 20px !important;
						left: 0 !important;
						width: 8px !important;
						height: auto !important;
						cursor: ew-resize !important;
						background: transparent !important;
					`;
					break;
				case 'right':
					styles += `
						top: 20px !important;
						bottom: 20px !important;
						right: 0 !important;
						width: 8px !important;
						height: auto !important;
						cursor: ew-resize !important;
						background: transparent !important;
					`;
					break;
				case 'bottom':
					styles += `
						left: 20px !important;
						right: 20px !important;
						bottom: 0 !important;
						height: 8px !important;
						width: auto !important;
						cursor: ns-resize !important;
						background: transparent !important;
					`;
					break;
                case 'top':
                    styles += `
                        left: 20px !important;
                        right: 20px !important;
                        top: 0 !important;
                        height: 8px !important;
                        width: auto !important;
                        cursor: ns-resize !important;
                        background: transparent !important;
                    `;
                    break;
            }

            handle.style.cssText = styles;
            handle.title = '拖拽调整大小';
            return handle;
        };

		// 创建四个角的缩放手柄
        const resizeHandleTL = createResizeHandle('top-left');
        const resizeHandleTR = createResizeHandle('top-right');
        const resizeHandleBL = createResizeHandle('bottom-left');
        const resizeHandleBR = createResizeHandle('bottom-right');
		// 创建边缘缩放手柄（左、右、下）
		const resizeHandleL = createResizeHandle('left');
		const resizeHandleR = createResizeHandle('right');
		const resizeHandleB = createResizeHandle('bottom');
		const resizeHandleT = createResizeHandle('top');

        // 组装聊天窗口
        this.chatWindow.appendChild(chatHeader);
        this.chatWindow.appendChild(mainContentContainer);
        this.chatWindow.appendChild(inputContainer);
		this.chatWindow.appendChild(resizeHandleTL);
		this.chatWindow.appendChild(resizeHandleTR);
		this.chatWindow.appendChild(resizeHandleBL);
		this.chatWindow.appendChild(resizeHandleBR);
		this.chatWindow.appendChild(resizeHandleL);
		this.chatWindow.appendChild(resizeHandleR);
		this.chatWindow.appendChild(resizeHandleB);
		this.chatWindow.appendChild(resizeHandleT);

        // 添加到页面
        document.body.appendChild(this.chatWindow);

        // 添加拖拽和缩放功能
        this.addChatWindowInteractions();

        // 添加滚动条样式
        this.addChatScrollbarStyles();

        // 初始化滚动功能
        this.initializeChatScroll();

        // 初始化模型选择器显示
        this.updateChatModelSelector();

        // 初始化消息容器的底部padding
        this.updateMessagesPaddingBottom = updatePaddingBottom;
        setTimeout(() => this.updateMessagesPaddingBottom(), 50);

        // 加载所有会话数据（确保会话数据已加载）
        await this.loadAllSessions();
        
        // 更新会话侧边栏（显示所有会话）
        await this.updateSessionSidebar();
        
        // 加载会话消息
        await this.loadSessionMessages();

        // 监听角色配置变化，自动刷新按钮列表
        if (!this.roleConfigChangeListener) {
            this.roleConfigChangeListener = async (changes, namespace) => {
                if (namespace === 'local' && changes.roleConfigs) {
                    // 角色配置发生变化，自动刷新欢迎消息下的按钮列表
                    await this.refreshWelcomeActionButtons();
                    // 刷新所有消息下的按钮
                    await this.refreshAllMessageActionButtons();
                }
            };
            chrome.storage.onChanged.addListener(this.roleConfigChangeListener);
        }
    }

    // 更新消息容器的底部padding（公共方法）
    updateMessagesPaddingBottom() {
        if (!this.chatWindow) return;
        const inputContainer = this.chatWindow.querySelector('.chat-input-container');
        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (inputContainer && messagesContainer) {
            const inputHeight = inputContainer.offsetHeight || 160;
            // 添加额外20px的缓冲空间
            messagesContainer.style.paddingBottom = (inputHeight + 20) + 'px';
            // 确保内容完全可见，滚动到底部
            setTimeout(() => {
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 0);
        }
    }

    // 更新聊天窗口样式
    updateChatWindowStyle() {
        if (!this.chatWindow || !this.chatWindowState) return;

        const { x, y, width, height } = this.chatWindowState;

        this.chatWindow.style.cssText = `
            position: fixed !important;
            left: ${x}px !important;
            top: ${y}px !important;
            width: ${width}px !important;
            height: ${height}px !important;
            background: white !important;
            border-radius: 16px !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
            z-index: ${PET_CONFIG.ui.zIndex.chatWindow} !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            resize: none !important;
        `;
    }

    // 从渐变色中提取主色调
    getMainColorFromGradient(gradient) {
        const match = gradient.match(/#[0-9a-fA-F]{6}/);
        return match ? match[0] : '#3b82f6';
    }

    // 更新聊天窗口标题（显示当前会话名称）
    updateChatHeaderTitle() {
        if (!this.chatWindow) return;
        
        const titleTextEl = this.chatWindow.querySelector('#pet-chat-header-title-text');
        if (!titleTextEl) return;
        
        // 获取当前会话名称
        if (this.currentSessionId && this.sessions[this.currentSessionId]) {
            const sessionTitle = this.sessions[this.currentSessionId].title || '未命名会话';
            // 如果标题太长，截断并添加省略号
            const displayTitle = sessionTitle.length > 20 
                ? sessionTitle.substring(0, 20) + '...' 
                : sessionTitle;
            titleTextEl.textContent = displayTitle;
        } else {
            // 如果没有会话，显示默认文本
            titleTextEl.textContent = '与我聊天';
        }
    }

    // 更新聊天窗口颜色（跟随宠物颜色）
    updateChatWindowColor() {
        if (!this.chatWindow) return;

        // 获取当前宠物颜色
        const currentColor = this.colors[this.colorIndex];
        const mainColor = this.getMainColorFromGradient(currentColor);

        // 更新聊天窗口头部元素
        const chatHeader = this.chatWindow.querySelector('.chat-header');
        if (chatHeader) {
            chatHeader.style.setProperty('background', currentColor, 'important');
        }

        // 更新输入框边框颜色
        const messageInput = this.chatWindow.querySelector('.chat-message-input');
        if (messageInput) {
            messageInput.style.setProperty('border-color', mainColor, 'important');
        }

        // 更新模型选择器边框颜色
        const modelSelector = this.chatWindow.querySelector('.chat-model-selector');
        if (modelSelector) {
            modelSelector.style.setProperty('border-color', mainColor, 'important');
        }

        // 更新所有使用颜色的按钮
        const allButtons = this.chatWindow.querySelectorAll('button');
        allButtons.forEach(button => {
            // 跳过关闭按钮（保持白色）
            if (button.textContent.includes('✕')) return;

            // 更新@按钮和+按钮
            if (button.innerHTML === '@' || button.innerHTML === '+') {
                button.style.setProperty('color', mainColor, 'important');
                button.style.setProperty('border-color', mainColor, 'important');
                button.setAttribute('data-theme-color', mainColor);
            }

            // 更新图片上传按钮
            if (button.className.includes('chat-image-upload-button')) {
                button.style.setProperty('color', mainColor, 'important');
                button.style.setProperty('border-color', mainColor, 'important');
                button.setAttribute('data-theme-color', mainColor);
            }
        });

        // 更新页面上下文开关颜色
        const contextSwitchContainer = this.chatWindow.querySelector('.context-switch-container');
        if (contextSwitchContainer && contextSwitchContainer.updateColor) {
            contextSwitchContainer.updateColor();
        }

        // 更新所有已有消息的气泡和头像颜色（仅宠物消息）
        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (messagesContainer) {
            // 更新宠物头像
            const petAvatars = messagesContainer.querySelectorAll('[data-message-type="pet-avatar"]');
            petAvatars.forEach(avatar => {
                avatar.style.setProperty('background', currentColor, 'important');
            });

            // 更新宠物消息气泡
            const petBubbles = messagesContainer.querySelectorAll('[data-message-type="pet-bubble"]');
            petBubbles.forEach(bubble => {
                bubble.style.setProperty('background', currentColor, 'important');
            });
        }
    }

    // 添加聊天窗口交互功能
    addChatWindowInteractions() {
        if (!this.chatWindow) return;

        const header = this.chatWindow.querySelector('.chat-header');
        const resizeHandles = this.chatWindow.querySelectorAll('.resize-handle');

        // 拖拽功能
        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('button')) return; // 忽略按钮点击

                this.chatWindowState.isDragging = true;
                this.chatWindowState.dragStart = {
                    x: e.clientX - this.chatWindowState.x,
                    y: e.clientY - this.chatWindowState.y
                };

                header.style.cursor = 'grabbing';
                e.preventDefault();
            });
        }

        // 缩放功能 - 为每个缩放手柄添加事件监听
        resizeHandles.forEach((resizeHandle) => {
            resizeHandle.addEventListener('mousedown', (e) => {
                this.chatWindowState.isResizing = true;

                // 根据手柄位置确定缩放类型
                if (resizeHandle.classList.contains('resize-handle-top-left')) {
                    this.chatWindowState.resizeType = 'top-left';
                } else if (resizeHandle.classList.contains('resize-handle-top-right')) {
                    this.chatWindowState.resizeType = 'top-right';
                } else if (resizeHandle.classList.contains('resize-handle-bottom-left')) {
                    this.chatWindowState.resizeType = 'bottom-left';
                } else if (resizeHandle.classList.contains('resize-handle-bottom-right')) {
                    this.chatWindowState.resizeType = 'bottom-right';
				} else if (resizeHandle.classList.contains('resize-handle-left')) {
					this.chatWindowState.resizeType = 'left';
				} else if (resizeHandle.classList.contains('resize-handle-right')) {
					this.chatWindowState.resizeType = 'right';
				} else if (resizeHandle.classList.contains('resize-handle-bottom')) {
					this.chatWindowState.resizeType = 'bottom';
                } else if (resizeHandle.classList.contains('resize-handle-top')) {
                    this.chatWindowState.resizeType = 'top';
                }

                this.chatWindowState.resizeStart = {
                    x: e.clientX,
                    y: e.clientY,
                    width: this.chatWindowState.width,
                    height: this.chatWindowState.height,
                    startX: this.chatWindowState.x,
                    startY: this.chatWindowState.y
                };

                // 添加缩放时的视觉反馈
                this.chatWindow.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)';
                // 使用宠物的主色调
                const currentColor = this.colors[this.colorIndex];
                const getMainColor = (gradient) => {
                    const match = gradient.match(/#[0-9a-fA-F]{6}/);
                    return match ? match[0] : '#ff6b6b';
                };
                const mainColor = getMainColor(currentColor);
                resizeHandle.style.background = `linear-gradient(-45deg, transparent 30%, ${mainColor} 30%, ${mainColor} 70%, transparent 70%)`;

                e.preventDefault();
                e.stopPropagation();
            });
        });

        // 全局鼠标移动事件
        document.addEventListener('mousemove', (e) => {
            if (this.chatWindowState.isDragging) {
                const newX = e.clientX - this.chatWindowState.dragStart.x;
                const newY = e.clientY - this.chatWindowState.dragStart.y;

                // 边界检查
                this.chatWindowState.x = Math.max(0, Math.min(window.innerWidth - this.chatWindowState.width, newX));
                this.chatWindowState.y = Math.max(0, Math.min(window.innerHeight - this.chatWindowState.height, newY));

                // 添加拖拽时的视觉反馈
                this.chatWindow.style.transform = 'scale(1.02)';
                this.chatWindow.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)';

                this.updateChatWindowStyle();
            }

            if (this.chatWindowState.isResizing) {
                const deltaX = e.clientX - this.chatWindowState.resizeStart.x;
                const deltaY = e.clientY - this.chatWindowState.resizeStart.y;

                const resizeType = this.chatWindowState.resizeType;
                let newWidth, newHeight, newX, newY;

				// 根据不同的缩放类型计算新的宽度、高度和位置
                switch(resizeType) {
                    case 'bottom-right':
                        // 右下角：调整宽度和高度
                        newWidth = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.resizeStart.width + deltaX));
                        newHeight = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.resizeStart.height + deltaY));
                        newX = this.chatWindowState.resizeStart.startX;
                        newY = this.chatWindowState.resizeStart.startY;
                        break;

                    case 'bottom-left':
                        // 左下角：调整宽度（负方向）和高度，同时移动x位置
                        newWidth = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.resizeStart.width - deltaX));
                        newHeight = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.resizeStart.height + deltaY));
                        newX = Math.max(0, this.chatWindowState.resizeStart.startX + deltaX);
                        newY = this.chatWindowState.resizeStart.startY;
                        break;

                    case 'top-right':
                        // 右上角：调整宽度和高度（负方向），同时移动y位置
                        newWidth = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.resizeStart.width + deltaX));
                        newHeight = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.resizeStart.height - deltaY));
                        newX = this.chatWindowState.resizeStart.startX;
                        newY = Math.max(0, this.chatWindowState.resizeStart.startY + deltaY);
                        break;

                    case 'top-left':
                        // 左上角：调整宽度和高度（负方向），同时移动x和y位置
                        newWidth = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.resizeStart.width - deltaX));
                        newHeight = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.resizeStart.height - deltaY));
                        newX = Math.max(0, this.chatWindowState.resizeStart.startX + deltaX);
                        newY = Math.max(0, this.chatWindowState.resizeStart.startY + deltaY);
                        break;

					case 'left':
						// 左边：调整宽度（负方向），同时移动x位置
						newWidth = Math.max(
							PET_CONFIG.chatWindow.sizeLimits.minWidth,
							Math.min(
								PET_CONFIG.chatWindow.sizeLimits.maxWidth,
								this.chatWindowState.resizeStart.width - deltaX
							)
						);
						newHeight = this.chatWindowState.resizeStart.height;
						newX = Math.max(0, this.chatWindowState.resizeStart.startX + deltaX);
						newY = this.chatWindowState.resizeStart.startY;
						break;

					case 'right':
						// 右边：调整宽度（正方向）
						newWidth = Math.max(
							PET_CONFIG.chatWindow.sizeLimits.minWidth,
							Math.min(
								PET_CONFIG.chatWindow.sizeLimits.maxWidth,
								this.chatWindowState.resizeStart.width + deltaX
							)
						);
						newHeight = this.chatWindowState.resizeStart.height;
						newX = this.chatWindowState.resizeStart.startX;
						newY = this.chatWindowState.resizeStart.startY;
						break;

					case 'bottom':
						// 下边：仅调整高度（正方向）
						newWidth = this.chatWindowState.resizeStart.width;
						newHeight = Math.max(
							PET_CONFIG.chatWindow.sizeLimits.minHeight,
							Math.min(
								PET_CONFIG.chatWindow.sizeLimits.maxHeight,
								this.chatWindowState.resizeStart.height + deltaY
							)
						);
						newX = this.chatWindowState.resizeStart.startX;
						newY = this.chatWindowState.resizeStart.startY;
						break;

                    case 'top':
                        // 上边：仅调整高度（负方向），同时移动y位置
                        newWidth = this.chatWindowState.resizeStart.width;
                        newHeight = Math.max(
                            PET_CONFIG.chatWindow.sizeLimits.minHeight,
                            Math.min(
                                PET_CONFIG.chatWindow.sizeLimits.maxHeight,
                                this.chatWindowState.resizeStart.height - deltaY
                            )
                        );
                        newX = this.chatWindowState.resizeStart.startX;
                        newY = Math.max(0, this.chatWindowState.resizeStart.startY + deltaY);
                        break;

                    default:
                        return;
                }

                // 边界检查，确保窗口不超出屏幕
                const maxX = window.innerWidth - newWidth;
                const maxY = window.innerHeight - newHeight;

                if (newX + newWidth > window.innerWidth) {
                    newX = Math.max(0, maxX);
                }

                if (newY + newHeight > window.innerHeight) {
                    newY = Math.max(0, maxY);
                }

                this.chatWindowState.width = newWidth;
                this.chatWindowState.height = newHeight;
                this.chatWindowState.x = newX;
                this.chatWindowState.y = newY;

                this.updateChatWindowStyle();
            }
        });

        // 全局鼠标释放事件
        document.addEventListener('mouseup', () => {
            if (this.chatWindowState.isDragging) {
                this.chatWindowState.isDragging = false;
                if (header) {
                    header.style.cursor = 'move';
                }
                // 恢复正常的视觉样式
                this.chatWindow.style.transform = 'scale(1)';
                this.chatWindow.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
                this.saveChatWindowState();
            }

            if (this.chatWindowState.isResizing) {
                this.chatWindowState.isResizing = false;

                // 恢复所有缩放手柄的样式
                const allResizeHandles = this.chatWindow.querySelectorAll('.resize-handle');
                allResizeHandles.forEach(handle => {
                    handle.style.background = 'linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 70%, transparent 70%)';
                });

                // 恢复窗口阴影
                this.chatWindow.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';

                // 重新初始化滚动功能
                this.initializeChatScroll();

                // 更新消息容器的底部padding
                this.updateMessagesPaddingBottom();

                this.saveChatWindowState();
            }
        });

        // 悬停效果 - 为所有缩放手柄添加悬停效果
        resizeHandles.forEach((resizeHandle) => {
            resizeHandle.addEventListener('mouseenter', () => {
                if (!this.chatWindowState.isResizing) {
                    resizeHandle.style.background = 'linear-gradient(-45deg, transparent 30%, #999 30%, #999 70%, transparent 70%)';
                    resizeHandle.style.transform = 'scale(1.1)';
                }
            });

            resizeHandle.addEventListener('mouseleave', () => {
                if (!this.chatWindowState.isResizing) {
                    resizeHandle.style.background = 'linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 70%, transparent 70%)';
                    resizeHandle.style.transform = 'scale(1)';
                }
            });
        });
    }

    // 保存聊天窗口状态
    saveChatWindowState() {
        if (!this.chatWindowState) return;

        try {
            const state = {
                x: this.chatWindowState.x,
                y: this.chatWindowState.y,
                width: this.chatWindowState.width,
                height: this.chatWindowState.height,
                timestamp: Date.now()
            };

            // 保存到chrome.storage.sync以实现跨页面同步
            chrome.storage.sync.set({ [PET_CONFIG.storage.keys.chatWindowState]: state }, () => {
                console.log('聊天窗口状态已保存到全局存储:', state);
            });

            // 同时保存到localStorage作为备用
            localStorage.setItem('petChatWindowState', JSON.stringify(state));
            console.log('聊天窗口状态已保存:', state);
        } catch (error) {
            console.log('保存聊天窗口状态失败:', error);
        }
    }

    // 加载聊天窗口状态
    loadChatWindowState(callback) {
        try {
            // 首先尝试从Chrome存储API加载全局状态
            chrome.storage.sync.get([PET_CONFIG.storage.keys.chatWindowState], (result) => {
                if (result[PET_CONFIG.storage.keys.chatWindowState]) {
                    const state = result[PET_CONFIG.storage.keys.chatWindowState];
                    this.restoreChatWindowState(state);

                    // 更新聊天窗口样式（如果已经创建）
                    if (this.chatWindow) {
                        this.updateChatWindowStyle();
                    }

                    if (callback) callback(true);
                } else {
                    // 如果全局状态不存在，尝试从localStorage加载
                    const success = this.loadChatWindowStateFromLocalStorage();
                    if (callback) callback(success);
                }
            });

            // 监听存储变化，实现跨页面同步
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'sync' && changes[PET_CONFIG.storage.keys.chatWindowState]) {
                    const newState = changes[PET_CONFIG.storage.keys.chatWindowState].newValue;
                    if (newState && !this.chatWindowState.isDragging && !this.chatWindowState.isResizing) {
                        this.restoreChatWindowState(newState);

                        // 更新聊天窗口样式（如果已经创建）
                        if (this.chatWindow) {
                            this.updateChatWindowStyle();
                            console.log('聊天窗口状态已从全局存储更新:', newState);
                        }
                    }
                }
            });

            return true;
        } catch (error) {
            console.log('恢复聊天窗口状态失败:', error);
            const success = this.loadChatWindowStateFromLocalStorage();
            if (callback) callback(success);
            return success;
        }
    }

    // 从localStorage加载聊天窗口状态（备用方法）
    loadChatWindowStateFromLocalStorage() {
        try {
            const savedState = localStorage.getItem('petChatWindowState');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.restoreChatWindowState(state);
                console.log('聊天窗口状态已从本地存储恢复:', this.chatWindowState);
                return true;
            }
        } catch (error) {
            console.log('恢复本地聊天窗口状态失败:', error);
        }
        return false;
    }

    // 恢复聊天窗口状态（应用位置和大小）
    restoreChatWindowState(state) {
        this.chatWindowState = {
            ...this.chatWindowState,
            ...state,
            isDragging: false,
            isResizing: false,
            resizeType: 'bottom-right' // 默认缩放类型
        };

        // 验证位置和大小
        this.chatWindowState.width = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.width));
        this.chatWindowState.height = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.height));
        this.chatWindowState.x = Math.max(0, Math.min(window.innerWidth - this.chatWindowState.width, this.chatWindowState.x));
        this.chatWindowState.y = Math.max(0, Math.min(window.innerHeight - this.chatWindowState.height, this.chatWindowState.y));

        console.log('聊天窗口状态已恢复:', this.chatWindowState);
    }

    // 加载 Mermaid.js (CDN)
    async loadMermaid() {
        if (this.mermaidLoaded || this.mermaidLoading) {
            return this.mermaidLoaded;
        }

        this.mermaidLoading = true;

        return new Promise((resolve, reject) => {
            // 检查是否已经加载（从 content_scripts 自动加载或之前动态加载）
            const mermaidLib = (typeof mermaid !== 'undefined') ? mermaid : 
                              (typeof window !== 'undefined' && window.mermaid) ? window.mermaid : null;
            
            if (mermaidLib && typeof mermaidLib.initialize === 'function') {
                try {
                    // 初始化 mermaid
                    mermaidLib.initialize({
                        startOnLoad: false,
                        theme: 'default',
                        securityLevel: 'loose',
                        flowchart: {
                            useMaxWidth: true,
                            htmlLabels: true
                        }
                    });
                    this.mermaidLoaded = true;
                    this.mermaidLoading = false;
                    console.log('Mermaid.js 已加载并初始化');
                    resolve(true);
                    return;
                } catch (error) {
                    console.error('初始化 Mermaid 失败:', error);
                    this.mermaidLoading = false;
                    reject(error);
                    return;
                }
            }

            // 使用注入脚本在页面上下文中加载 mermaid
            // 这样可以确保 mermaid 在页面的 window 对象中可用
            const scriptUrl = chrome.runtime.getURL('mermaid.min.js');
            const loadScriptUrl = chrome.runtime.getURL('load-mermaid.js');
            console.log('尝试在页面上下文中加载 Mermaid.js，URL:', scriptUrl);
            
            // 通过 data 属性传递 URL（避免内联脚本）
            // 注：我们仍然需要通过页面上下文传递 URL，使用隐藏的 data 属性
            const urlContainer = document.createElement('div');
            urlContainer.id = '__mermaid_url_container__';
            urlContainer.style.display = 'none';
            urlContainer.setAttribute('data-mermaid-url', scriptUrl);
            (document.head || document.documentElement).appendChild(urlContainer);
            
            // 修改 load-mermaid.js 以从 data 属性读取 URL
            // 但更简单的方法是在 load-mermaid.js 中直接使用 chrome.runtime.getURL
            // 因为 load-mermaid.js 在页面上下文中执行，无法直接访问 chrome API
            // 所以我们需要通过 data 属性传递
            
            // 加载外部脚本文件（避免 CSP 限制）
            const injectedScript = document.createElement('script');
            injectedScript.src = loadScriptUrl;
            injectedScript.charset = 'UTF-8';
            injectedScript.async = false;
            
            // 监听页面中的 mermaid 加载事件（在脚本加载前设置）
            const handleMermaidLoaded = () => {
                console.log('[Content] 收到 Mermaid 加载完成事件');
                // Mermaid 已经在页面上下文中加载（通过 load-mermaid.js）
                // 由于 content script 的隔离环境，我们无法直接访问页面的 window.mermaid
                // 但我们知道它已经加载，可以通过外部脚本执行渲染
                this.mermaidLoaded = true;
                this.mermaidLoading = false;
                console.log('[Content] Mermaid.js 在页面上下文中已加载');
                window.removeEventListener('mermaid-loaded', handleMermaidLoaded);
                window.removeEventListener('mermaid-error', handleMermaidError);
                resolve(true);
            };
            
            const handleMermaidError = () => {
                console.error('[Content] 收到 Mermaid 加载失败事件');
                this.mermaidLoading = false;
                window.removeEventListener('mermaid-loaded', handleMermaidLoaded);
                window.removeEventListener('mermaid-error', handleMermaidError);
                reject(new Error('页面上下文中的 Mermaid.js 加载失败'));
            };
            
            // 监听页面事件（通过注入的事件监听器）
            window.addEventListener('mermaid-loaded', handleMermaidLoaded);
            window.addEventListener('mermaid-error', handleMermaidError);
            
            // 注入脚本到页面上下文
            (document.head || document.documentElement).appendChild(injectedScript);
            
            // 清理注入的脚本
            setTimeout(() => {
                if (injectedScript.parentNode) {
                    injectedScript.parentNode.removeChild(injectedScript);
                }
            }, 1000);
        });
    }

    // 处理 Markdown 中的 Mermaid 代码块
    async processMermaidBlocks(container) {
        if (!container) return;

        // 检查是否需要加载 mermaid - 更全面的选择器
        const mermaidBlocks = container.querySelectorAll('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
        
        if (mermaidBlocks.length === 0) return;

        // 过滤掉已经处理过的块
        const unprocessedBlocks = Array.from(mermaidBlocks).filter(block => {
            // 检查是否已经是mermaid div或被标记为已处理
            const preElement = block.parentElement;
            if (preElement && preElement.tagName === 'PRE') {
                // 如果父元素的下一个兄弟元素是mermaid div，说明已经处理过
                const nextSibling = preElement.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('mermaid')) {
                    return false;
                }
                // 检查是否有处理标记
                if (block.classList.contains('mermaid-processed')) {
                    return false;
                }
            }
            return true;
        });

        if (unprocessedBlocks.length === 0) return;

        // 加载 mermaid（如果需要）
        const mermaidAvailable = await this.loadMermaid().catch(() => false);
        if (!mermaidAvailable) {
            console.warn('Mermaid.js 未加载，无法渲染图表');
            return;
        }

        // 处理每个未处理的 mermaid 代码块
        unprocessedBlocks.forEach((codeBlock, index) => {
            const preElement = codeBlock.parentElement;
            if (preElement && preElement.tagName === 'PRE') {
                const mermaidId = `mermaid-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
                const mermaidContent = codeBlock.textContent || codeBlock.innerText || '';

                if (!mermaidContent.trim()) {
                    return; // 跳过空内容
                }

                // 创建 mermaid 容器
                const mermaidDiv = document.createElement('div');
                mermaidDiv.className = 'mermaid';
                mermaidDiv.id = mermaidId;
                mermaidDiv.textContent = mermaidContent;
                // 保存源代码以便后续复制功能使用
                mermaidDiv.setAttribute('data-mermaid-source', mermaidContent);
                mermaidDiv.style.cssText = `
                    background: rgba(255, 255, 255, 0.1) !important;
                    padding: 15px !important;
                    border-radius: 8px !important;
                    margin: 15px 0 !important;
                    overflow-x: auto !important;
                    min-height: 100px !important;
                `;

                // 标记为已处理
                codeBlock.classList.add('mermaid-processed');
                
                // 替换代码块
                try {
                    preElement.parentNode.replaceChild(mermaidDiv, preElement);

                    // 渲染 mermaid 图表 - 使用页面上下文中的 mermaid
                    // 因为 mermaid 在页面上下文中，我们需要通过注入脚本执行渲染
                    // 通过 data 属性传递渲染 ID（避免内联脚本）
                    // 为每个 mermaid 块使用唯一的容器 ID，避免冲突
                    const renderIdContainer = document.createElement('div');
                    renderIdContainer.id = `__mermaid_render_id_container__${mermaidId}`;
                    renderIdContainer.style.display = 'none';
                    renderIdContainer.setAttribute('data-mermaid-id', mermaidId);
                    // 确保容器在页面上下文中（不是在 content script 的隔离 DOM）
                    (document.head || document.documentElement).appendChild(renderIdContainer);
                    
                    // 监听渲染结果（在加载脚本之前设置）
                    const handleRender = (event) => {
                        if (event.detail.id === mermaidId) {
                            window.removeEventListener('mermaid-rendered', handleRender);
                            if (!event.detail.success) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'mermaid-error';
                                errorDiv.style.cssText = `
                                    background: rgba(255, 0, 0, 0.1) !important;
                                    padding: 10px !important;
                                    border-radius: 5px !important;
                                    color: #ff6b6b !important;
                                    font-size: 12px !important;
                                    margin: 10px 0 !important;
                                `;
                                errorDiv.innerHTML = `
                                    <div>❌ Mermaid 图表渲染失败</div>
                                    <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                                `;
                                if (mermaidDiv.parentNode) {
                                    mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv);
                                }
                            } else {
                                // 渲染成功，添加复制和下载按钮
                                setTimeout(() => {
                                    this.addMermaidActions(mermaidDiv, event.detail.svgContent || '', mermaidContent);
                                }, 100);
                            }
                            // 清理 ID 容器
                            if (renderIdContainer.parentNode) {
                                renderIdContainer.parentNode.removeChild(renderIdContainer);
                            }
                        }
                    };
                    window.addEventListener('mermaid-rendered', handleRender);
                    
                    // 延迟加载渲染脚本，确保 mermaid div 已经添加到 DOM 且事件监听器已设置
                    // 增加延迟时间，确保 DOM 完全更新
                    setTimeout(() => {
                        // 再次检查 mermaid div 是否存在（确保 DOM 已更新）
                        const checkDiv = document.getElementById(mermaidId);
                        if (!checkDiv) {
                            console.warn('[ProcessMermaid] mermaid div 尚未准备好，延迟渲染:', mermaidId);
                            // 如果还没准备好，再等一会
                            setTimeout(() => {
                                const renderScript = document.createElement('script');
                                renderScript.src = chrome.runtime.getURL('render-mermaid.js');
                                renderScript.charset = 'UTF-8';
                                renderScript.async = false;
                                document.documentElement.appendChild(renderScript);
                                
                                setTimeout(() => {
                                    if (renderScript.parentNode) {
                                        renderScript.parentNode.removeChild(renderScript);
                                    }
                                }, 3000);
                            }, 150);
                            return;
                        }
                        
                        // 加载外部渲染脚本（避免 CSP 限制）
                        const renderScript = document.createElement('script');
                        renderScript.src = chrome.runtime.getURL('render-mermaid.js');
                        renderScript.charset = 'UTF-8';
                        renderScript.async = false;
                        
                        // 注入渲染脚本到页面上下文
                        document.documentElement.appendChild(renderScript);
                        
                        // 清理脚本（渲染完成后）
                        setTimeout(() => {
                            if (renderScript.parentNode) {
                                renderScript.parentNode.removeChild(renderScript);
                            }
                        }, 3000);
                    }, 200);
                } catch (error) {
                    console.error('替换 Mermaid 代码块时出错:', error);
                    // 出错时显示错误信息，但保留原始代码
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'mermaid-error';
                    errorDiv.style.cssText = `
                        background: rgba(255, 0, 0, 0.1) !important;
                        padding: 10px !important;
                        border-radius: 5px !important;
                        color: #ff6b6b !important;
                        font-size: 12px !important;
                        margin: 10px 0 !important;
                    `;
                    errorDiv.innerHTML = `
                        <div>❌ Mermaid 图表渲染失败</div>
                        <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                    `;
                    if (mermaidDiv.parentNode) {
                        mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv);
                    }
                }
            }
        });
    }

    // 渲染 Markdown 为 HTML（保持同步以兼容现有代码）
    renderMarkdown(markdown) {
        if (!markdown) return '';

        try {
            // 检查 marked 是否可用
            if (typeof marked !== 'undefined') {
                // 配置 marked 以增强安全性
                marked.setOptions({
                    breaks: true, // 支持换行
                    gfm: true, // GitHub Flavored Markdown
                    sanitize: false // 允许 HTML，但我们会通过 DOMPurify 或其他方式处理
                });
                return marked.parse(markdown);
            } else {
                // 如果 marked 不可用，返回转义的纯文本
                return this.escapeHtml(markdown);
            }
        } catch (error) {
            console.error('渲染 Markdown 失败:', error);
            return this.escapeHtml(markdown);
        }
    }

    // 渲染 Markdown 并处理 Mermaid（完整流程）
    async renderMarkdownWithMermaid(markdown, container) {
        // 先渲染 Markdown
        const html = this.renderMarkdown(markdown);
        
        // 如果提供了容器，处理其中的 Mermaid 代码块
        if (container) {
            // 需要等待 DOM 更新后再处理
            setTimeout(async () => {
                await this.processMermaidBlocks(container);
            }, 100);
        }
        
        return html;
    }

    // HTML 转义辅助函数
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 为 Mermaid 图表添加复制和下载按钮
    addMermaidActions(mermaidDiv, svgContent, mermaidSourceCode) {
        if (!mermaidDiv) return;

        // 检查是否已经添加了按钮
        if (mermaidDiv.querySelector('.mermaid-actions')) {
            return;
        }

        // 创建按钮容器
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'mermaid-actions';
        actionsContainer.style.cssText = `
            position: absolute !important;
            top: 10px !important;
            right: 10px !important;
            display: flex !important;
            gap: 8px !important;
            z-index: 10 !important;
            opacity: 0 !important;
            transition: opacity 0.2s ease !important;
        `;

        // 确保 mermaid div 有相对定位
        const currentPosition = window.getComputedStyle(mermaidDiv).position;
        if (currentPosition === 'static') {
            mermaidDiv.style.position = 'relative';
        }

        // 创建复制按钮
        const copyButton = document.createElement('button');
        copyButton.className = 'mermaid-copy-button';
        copyButton.title = '复制 Mermaid 代码';
        copyButton.innerHTML = '📋';
        copyButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 创建下载按钮
        const downloadButton = document.createElement('button');
        downloadButton.className = 'mermaid-download-button';
        downloadButton.title = '下载 SVG';
        downloadButton.innerHTML = '💾';
        downloadButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 创建编辑按钮（在新标签页打开 Mermaid Live Editor）
        const editButton = document.createElement('button');
        editButton.className = 'mermaid-edit-button';
        editButton.title = '在 Mermaid Live Editor 中打开';
        editButton.innerHTML = '✏️';
        editButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 获取 SVG 内容的辅助函数
        const getSvgContent = () => {
            return new Promise((resolve) => {
                // 首先尝试使用事件传递的内容
                if (svgContent) {
                    resolve(svgContent);
                    return;
                }

                // 尝试从 DOM 获取（content script 可以直接访问 DOM）
                const svgElement = mermaidDiv.querySelector('svg');
                if (svgElement) {
                    try {
                        const clone = svgElement.cloneNode(true);
                        if (!clone.getAttribute('xmlns')) {
                            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        }
                        const svgString = new XMLSerializer().serializeToString(clone);
                        resolve(svgString);
                        return;
                    } catch (error) {
                        console.warn('通过 DOM 获取 SVG 失败，尝试注入脚本:', error);
                    }
                }

                // 如果都失败，通过注入脚本从页面上下文获取
                const script = document.createElement('script');
                script.textContent = `
                    (function() {
                        const mermaidDiv = document.getElementById('${mermaidDiv.id}');
                        if (mermaidDiv) {
                            const svgElement = mermaidDiv.querySelector('svg');
                            if (svgElement) {
                                const clone = svgElement.cloneNode(true);
                                if (!clone.getAttribute('xmlns')) {
                                    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                                }
                                const svgString = new XMLSerializer().serializeToString(clone);
                                window.postMessage({
                                    type: 'mermaid-svg-content',
                                    id: '${mermaidDiv.id}',
                                    svgContent: svgString
                                }, '*');
                            }
                        }
                    })();
                `;
                document.documentElement.appendChild(script);
                
                const messageHandler = (event) => {
                    if (event.data && event.data.type === 'mermaid-svg-content' && event.data.id === mermaidDiv.id) {
                        window.removeEventListener('message', messageHandler);
                        document.documentElement.removeChild(script);
                        resolve(event.data.svgContent || '');
                    }
                };
                window.addEventListener('message', messageHandler);
                
                // 超时处理
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    if (script.parentNode) {
                        document.documentElement.removeChild(script);
                    }
                    resolve('');
                }, 1000);
            });
        };

        // 复制按钮点击事件 - 复制 Mermaid 源代码
        copyButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            try {
                // 优先使用传入的参数，其次从 data 属性获取
                let codeToCopy = mermaidSourceCode || mermaidDiv.getAttribute('data-mermaid-source') || '';

                if (codeToCopy) {
                    await navigator.clipboard.writeText(codeToCopy);
                    // 显示成功提示
                    copyButton.innerHTML = '✓';
                    copyButton.style.background = 'rgba(76, 175, 80, 0.3) !important';
                    setTimeout(() => {
                        copyButton.innerHTML = '📋';
                        copyButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                    }, 1000);
                } else {
                    throw new Error('无法获取 Mermaid 源代码');
                }
            } catch (error) {
                console.error('复制 Mermaid 代码失败:', error);
                copyButton.innerHTML = '✗';
                copyButton.style.background = 'rgba(244, 67, 54, 0.3) !important';
                setTimeout(() => {
                    copyButton.innerHTML = '📋';
                    copyButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                }, 1000);
            }
        });

        // 下载按钮点击事件
        downloadButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            try {
                const svg = await getSvgContent();

                if (svg) {
                    // 创建 Blob 并下载
                    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `mermaid-diagram-${Date.now()}.svg`;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    // 显示成功提示
                    downloadButton.innerHTML = '✓';
                    downloadButton.style.background = 'rgba(76, 175, 80, 0.3) !important';
                    setTimeout(() => {
                        downloadButton.innerHTML = '💾';
                        downloadButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                    }, 1000);
                } else {
                    throw new Error('无法获取 SVG 内容');
                }
            } catch (error) {
                console.error('下载 SVG 失败:', error);
                downloadButton.innerHTML = '✗';
                downloadButton.style.background = 'rgba(244, 67, 54, 0.3) !important';
                setTimeout(() => {
                    downloadButton.innerHTML = '💾';
                    downloadButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                }, 1000);
            }
        });

        // 编辑按钮点击事件 - 在新标签页打开 Mermaid Live Editor
        editButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            try {
                // 获取 Mermaid 源代码
                const codeToEdit = mermaidSourceCode || mermaidDiv.getAttribute('data-mermaid-source') || '';
                
                if (!codeToEdit || !codeToEdit.trim()) {
                    // 如果没有源代码，直接打开编辑器
                    window.open('https://mermaid.live/edit', '_blank');
                    return;
                }

                // 显示加载状态
                const originalHTML = editButton.innerHTML;
                editButton.innerHTML = '⏳';
                editButton.style.cursor = 'wait';

                // 同时使用多种方式传递代码，提高成功率
                let urlOpened = false;
                let clipboardSuccess = false;

                // 方式1: 优先将代码复制到剪贴板（最可靠的方式）
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(codeToEdit);
                        clipboardSuccess = true;
                        console.log('代码已复制到剪贴板');
                    }
                } catch (clipboardError) {
                    console.warn('复制到剪贴板失败，尝试 fallback 方法:', clipboardError);
                    // 如果 Clipboard API 失败，尝试使用 fallback 方法
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = codeToEdit;
                        textArea.style.position = 'fixed';
                        textArea.style.opacity = '0';
                        textArea.style.left = '-9999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        const successful = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        if (successful) {
                            clipboardSuccess = true;
                            console.log('代码已通过 fallback 方法复制到剪贴板');
                        }
                    } catch (fallbackError) {
                        console.error('Fallback 复制方法也失败:', fallbackError);
                    }
                }

                // 方式2: 尝试通过 URL 传递代码（多种格式尝试）
                const urlFormats = [];
                
                // 格式1: state 参数（JSON 对象 base64 编码）
                try {
                    const stateObj = {
                        code: codeToEdit,
                        mermaid: { theme: 'default' }
                    };
                    const stateJson = JSON.stringify(stateObj);
                    const stateBase64 = btoa(unescape(encodeURIComponent(stateJson)));
                    urlFormats.push(`https://mermaid.live/edit#state/${stateBase64}`);
                } catch (e) {
                    console.warn('生成 state 格式 URL 失败:', e);
                }
                
                // 格式2: code 参数（代码直接 base64 编码）
                try {
                    const codeBase64 = btoa(unescape(encodeURIComponent(codeToEdit)));
                    urlFormats.push(`https://mermaid.live/edit#code/${codeBase64}`);
                } catch (e) {
                    console.warn('生成 code 格式 URL 失败:', e);
                }
                
                // 格式3: 查询参数方式
                try {
                    const encodedCode = encodeURIComponent(codeToEdit);
                    urlFormats.push(`https://mermaid.live/edit?code=${encodedCode}`);
                } catch (e) {
                    console.warn('生成查询参数 URL 失败:', e);
                }

                // 尝试打开编辑器（使用多种 URL 格式）
                for (const editorUrl of urlFormats) {
                    try {
                        const newWindow = window.open(editorUrl, '_blank');
                        if (newWindow) {
                            urlOpened = true;
                            console.log('Mermaid Live Editor 已打开，尝试通过 URL 传递代码');
                            break; // 成功打开后就停止尝试
                        }
                    } catch (error) {
                        console.warn('打开编辑器失败，尝试下一个 URL 格式:', error);
                    }
                }

                // 如果所有 URL 格式都失败，尝试使用基础 URL
                if (!urlOpened) {
                    try {
                        const newWindow = window.open('https://mermaid.live/edit', '_blank');
                        urlOpened = !!newWindow;
                        if (urlOpened) {
                            console.log('Mermaid Live Editor 已打开（代码已在剪贴板中）');
                        }
                    } catch (error) {
                        console.error('打开编辑器窗口失败:', error);
                    }
                }


                // 显示成功提示
                setTimeout(() => {
                    // 根据结果显示不同的提示
                    let tipMessage = '';
                    if (clipboardSuccess && urlOpened) {
                        tipMessage = '✓ 编辑器已打开，代码已复制到剪贴板';
                    } else if (clipboardSuccess) {
                        tipMessage = '✓ 代码已复制到剪贴板，请在新打开的编辑器中粘贴';
                    } else if (urlOpened) {
                        tipMessage = '✓ 编辑器已打开';
                    } else {
                        tipMessage = '⚠️ 编辑器已打开，请手动复制代码';
                    }

                    // 更新按钮状态
                    if (clipboardSuccess || urlOpened) {
                        editButton.innerHTML = '✓';
                        editButton.style.background = clipboardSuccess ? 'rgba(76, 175, 80, 0.3) !important' : 'rgba(255, 193, 7, 0.3) !important';
                    }
                    
                    // 创建临时提示（仅在成功复制或打开时显示）
                    if (clipboardSuccess || urlOpened) {
                        const tip = document.createElement('div');
                        tip.textContent = tipMessage;
                        tip.style.cssText = `
                            position: fixed !important;
                            top: 50% !important;
                            left: 50% !important;
                            transform: translate(-50%, -50%) !important;
                            background: rgba(0, 0, 0, 0.85) !important;
                            color: white !important;
                            padding: 14px 28px !important;
                            border-radius: 8px !important;
                            font-size: 14px !important;
                            z-index: 10000 !important;
                            pointer-events: none !important;
                            animation: fadeInOut 2.5s ease-in-out !important;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
                            max-width: 90% !important;
                            text-align: center !important;
                            word-wrap: break-word !important;
                        `;
                        
                        // 添加动画样式（如果还没有）
                        if (!document.getElementById('mermaid-tip-styles')) {
                            const style = document.createElement('style');
                            style.id = 'mermaid-tip-styles';
                            style.textContent = `
                                @keyframes fadeInOut {
                                    0%, 100% { opacity: 0; transform: translate(-50%, -50%) translateY(-10px); }
                                    10%, 90% { opacity: 1; transform: translate(-50%, -50%) translateY(0); }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                        
                        document.body.appendChild(tip);
                        setTimeout(() => {
                            if (tip.parentNode) {
                                tip.parentNode.removeChild(tip);
                            }
                        }, 2500);
                    }
                    
                    // 恢复按钮状态
                    setTimeout(() => {
                        editButton.innerHTML = originalHTML;
                        editButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                        editButton.style.cursor = 'pointer';
                    }, 2000);
                }, 100);

            } catch (error) {
                console.error('打开 Mermaid Live Editor 失败:', error);
                // 出错时仍尝试打开编辑器
                try {
                    window.open('https://mermaid.live/edit', '_blank');
                } catch (openError) {
                    console.error('无法打开编辑器窗口:', openError);
                }
                // 恢复按钮状态
                setTimeout(() => {
                    editButton.innerHTML = '✏️';
                    editButton.style.cursor = 'pointer';
                }, 1000);
            }
        });

        // 悬停显示按钮
        mermaidDiv.addEventListener('mouseenter', () => {
            actionsContainer.style.opacity = '1';
        });
        mermaidDiv.addEventListener('mouseleave', () => {
            actionsContainer.style.opacity = '0';
        });

        actionsContainer.appendChild(copyButton);
        actionsContainer.appendChild(downloadButton);
        actionsContainer.appendChild(editButton);
        mermaidDiv.appendChild(actionsContainer);

        // 按钮悬停效果
        copyButton.addEventListener('mouseenter', () => {
            copyButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            copyButton.style.transform = 'scale(1.1)';
            copyButton.style.opacity = '1';
        });
        copyButton.addEventListener('mouseleave', () => {
            copyButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            copyButton.style.transform = 'scale(1)';
            copyButton.style.opacity = '0.8';
        });

        downloadButton.addEventListener('mouseenter', () => {
            downloadButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            downloadButton.style.transform = 'scale(1.1)';
            downloadButton.style.opacity = '1';
        });
        downloadButton.addEventListener('mouseleave', () => {
            downloadButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            downloadButton.style.transform = 'scale(1)';
            downloadButton.style.opacity = '0.8';
        });

        editButton.addEventListener('mouseenter', () => {
            editButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            editButton.style.transform = 'scale(1.1)';
            editButton.style.opacity = '1';
        });
        editButton.addEventListener('mouseleave', () => {
            editButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            editButton.style.transform = 'scale(1)';
            editButton.style.opacity = '0.8';
        });
    }

    // 创建消息元素
    createMessageElement(text, sender, imageDataUrl = null) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            display: flex !important;
            margin-bottom: 15px !important;
            animation: messageSlideIn 0.3s ease-out !important;
        `;

        if (sender === 'user') {
            messageDiv.style.flexDirection = 'row-reverse';
        }

        // 获取宠物颜色用于宠物消息
        const currentColor = this.colors[this.colorIndex];

        const avatar = document.createElement('div');
        avatar.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 16px !important;
            margin-right: 10px !important;
            flex-shrink: 0 !important;
            background: ${sender === 'user' ? 'linear-gradient(135deg, #2196F3, #1976D2)' : currentColor} !important;
        `;
        avatar.textContent = sender === 'user' ? '👤' : '🐾';
        // 添加标识以便后续更新
        if (sender === 'pet') {
            avatar.setAttribute('data-message-type', 'pet-avatar');
        }

        if (sender === 'user') {
            avatar.style.marginRight = '0';
            avatar.style.marginLeft = '10px';
        }

        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1 !important;
            min-width: 0 !important;
        `;

        const messageText = document.createElement('div');
        messageText.style.cssText = `
            background: ${sender === 'user' ? 'linear-gradient(135deg, #2196F3, #1976D2)' : currentColor} !important;
            color: white !important;
            padding: 12px 16px !important;
            border-radius: 12px !important;
            font-size: 14px !important;
            line-height: 1.6 !important;
            word-wrap: break-word !important;
            position: relative !important;
            max-width: 80% !important;
            width: 100% !important;
            margin-left: ${sender === 'user' ? 'auto' : '0'} !important;
            user-select: text !important;
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
        `;

        // 为宠物消息添加 Markdown 样式
        if (sender === 'pet') {
            messageText.classList.add('markdown-content');
        }

        // 添加标识以便后续更新
        if (sender === 'pet') {
            messageText.setAttribute('data-message-type', 'pet-bubble');
        } else {
            messageText.setAttribute('data-message-type', 'user-bubble');
        }

        // 为消息保存原始文本用于复制和编辑功能
        if (text) {
            if (sender === 'pet') {
                messageText.setAttribute('data-original-text', text);
            } else {
                // 用户消息也保存原始文本，用于编辑功能
                messageText.setAttribute('data-original-text', text);
            }
        }

        if (sender === 'user') {
            messageText.style.borderBottomRightRadius = '4px';
        } else {
            messageText.style.borderBottomLeftRadius = '4px';
        }

        // 如果包含图片，添加图片元素
        if (imageDataUrl) {
            const imageContainer = document.createElement('div');
            imageContainer.style.cssText = `
                margin-bottom: ${text ? '8px' : '0'} !important;
                border-radius: 8px !important;
                overflow: hidden !important;
            `;

            const img = document.createElement('img');
            img.src = imageDataUrl;
            img.style.cssText = `
                max-width: 100% !important;
                max-height: 300px !important;
                border-radius: 8px !important;
                display: block !important;
                cursor: pointer !important;
            `;

            // 点击查看大图
            img.addEventListener('click', () => {
                this.showImagePreview(imageDataUrl);
            });

            imageContainer.appendChild(img);
            messageText.appendChild(imageContainer);
        }

        // 如果有文本，添加文本（支持 Markdown 渲染）
        if (text) {
            // 对于宠物消息，使用 Markdown 渲染；对于用户消息，使用纯文本
            const displayText = sender === 'pet' ? this.renderMarkdown(text) : this.escapeHtml(text);

            if (imageDataUrl) {
                // 如果已经添加了图片，则追加文本
                const textSpan = document.createElement('span');
                if (sender === 'pet') {
                    textSpan.innerHTML = displayText;
                } else {
                    textSpan.textContent = text;
                }
                messageText.appendChild(textSpan);
            } else {
                if (sender === 'pet') {
                    messageText.innerHTML = displayText;
                    // 对于宠物消息，处理可能的 Mermaid 图表
                    if (!messageText.hasAttribute('data-mermaid-processing')) {
                        messageText.setAttribute('data-mermaid-processing', 'true');
                        setTimeout(async () => {
                            await this.processMermaidBlocks(messageText);
                            messageText.removeAttribute('data-mermaid-processing');
                        }, 100);
                    }
                } else {
                    messageText.textContent = text;
                }
            }
        } else if (imageDataUrl) {
            // 如果没有文本只有图片，保持容器为空
            messageText.style.padding = '0';
        }

        const messageTime = document.createElement('div');
        messageTime.setAttribute('data-message-time', 'true');
        messageTime.style.cssText = `
            font-size: 11px !important;
            color: #999 !important;
            margin-top: 4px !important;
        `;
        messageTime.textContent = this.getCurrentTime();

        content.appendChild(messageText);

        // 为宠物消息创建时间和复制按钮的容器
        if (sender === 'pet') {
            const timeAndCopyContainer = document.createElement('div');
            timeAndCopyContainer.style.cssText = `
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                max-width: calc(80% + 36px) !important;
                width: 100% !important;
                margin-top: 4px !important;
            `;

            const messageTimeWrapper = document.createElement('div');
            messageTimeWrapper.style.cssText = 'flex: 1;';
            messageTimeWrapper.appendChild(messageTime);
            timeAndCopyContainer.appendChild(messageTimeWrapper);

            const copyButtonContainer = document.createElement('div');
            copyButtonContainer.setAttribute('data-copy-button-container', 'true');
            copyButtonContainer.style.cssText = 'display: none; margin-left: 8px;';
            timeAndCopyContainer.appendChild(copyButtonContainer);

            // 添加 try again 按钮容器
            const tryAgainButtonContainer = document.createElement('div');
            tryAgainButtonContainer.setAttribute('data-try-again-button-container', 'true');
            tryAgainButtonContainer.style.cssText = 'display: none; margin-left: 8px; align-items: center;';
            timeAndCopyContainer.appendChild(tryAgainButtonContainer);

            content.appendChild(timeAndCopyContainer);

            // 如果已经有文本，立即添加复制按钮
            if (text && text.trim()) {
                this.addCopyButton(copyButtonContainer, messageText);
            }

            // 为消息元素添加标识，用于后续判断是否是第一个消息
            messageDiv.setAttribute('data-message-id', Date.now().toString());
        } else {
            // 用户消息创建时间和删除按钮的容器（与气泡宽度对齐）
            const timeAndCopyContainer = document.createElement('div');
            timeAndCopyContainer.style.cssText = `
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                max-width: 80% !important;
                width: 100% !important;
                margin-top: 4px !important;
                margin-left: auto !important;
                box-sizing: border-box !important;
            `;

            const messageTimeWrapper = document.createElement('div');
            messageTimeWrapper.style.cssText = `
                margin: 0 !important;
                padding: 0 !important;
                display: flex !important;
                align-items: flex-start !important;
            `;
            messageTime.style.cssText = `
                font-size: 11px !important;
                color: #999 !important;
                margin: 0 !important;
                padding: 0 !important;
            `;
            messageTimeWrapper.appendChild(messageTime);

            const copyButtonContainer = document.createElement('div');
            copyButtonContainer.setAttribute('data-copy-button-container', 'true');
            copyButtonContainer.style.cssText = 'display: flex;';
            timeAndCopyContainer.appendChild(copyButtonContainer);
            timeAndCopyContainer.appendChild(messageTimeWrapper);

            content.appendChild(timeAndCopyContainer);

            // 为用户消息添加删除和编辑按钮
            this.addDeleteButtonForUserMessage(copyButtonContainer, messageText);
            
            // 同步时间容器与气泡的宽度和位置，确保精确对齐
            const syncTimeContainerAlignment = () => {
                // 使用双重 requestAnimationFrame 确保 DOM 完全渲染
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const bubbleRect = messageText.getBoundingClientRect();
                        const containerRect = timeAndCopyContainer.getBoundingClientRect();
                        
                        // 同步宽度：直接使用气泡的实际宽度
                        if (bubbleRect.width > 0) {
                            timeAndCopyContainer.style.width = `${bubbleRect.width}px`;
                            timeAndCopyContainer.style.maxWidth = `${bubbleRect.width}px`;
                        }
                        
                        // 重新获取容器位置以检查对齐
                        const updatedContainerRect = timeAndCopyContainer.getBoundingClientRect();
                        
                        // 检查并修正左边缘对齐（允许1px的误差）
                        if (Math.abs(bubbleRect.left - updatedContainerRect.left) > 1) {
                            // 计算相对于父容器的偏移
                            const contentRect = content.getBoundingClientRect();
                            const bubbleOffset = bubbleRect.left - contentRect.left;
                            const containerOffset = updatedContainerRect.left - contentRect.left;
                            
                            // 计算需要的 margin-left 调整
                            const marginDiff = bubbleOffset - containerOffset;
                            
                            // 获取当前计算后的 margin-left 值（即使 CSS 是 auto，计算值也是像素）
                            const computedStyle = window.getComputedStyle(timeAndCopyContainer);
                            const computedMarginLeft = computedStyle.marginLeft;
                            const numericMargin = parseFloat(computedMarginLeft) || 0;
                            
                            // 应用修正后的 margin-left
                            timeAndCopyContainer.style.marginLeft = `${numericMargin + marginDiff}px`;
                        }
                    });
                });
            };
            
            // 立即同步一次
            syncTimeContainerAlignment();
            
            // 监听气泡大小变化，自动重新同步
            if (typeof ResizeObserver !== 'undefined') {
                const resizeObserver = new ResizeObserver(() => {
                    syncTimeContainerAlignment();
                });
                resizeObserver.observe(messageText);
                
                // 将 observer 保存到元素上，以便后续清理（如果需要）
                messageText._timeContainerObserver = resizeObserver;
            }
            
            // 延迟再次同步，确保所有内容都已渲染
            setTimeout(syncTimeContainerAlignment, 100);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        return messageDiv;
    }

    // 创建打字指示器（有趣的等待动画）
    createTypingIndicator() {
        const currentColor = this.colors[this.colorIndex];

        // 获取第一个聊天下面第一个按钮的图标
        let indicatorIcon = '🐾'; // 默认图标
        if (this.chatWindow) {
            const welcomeActions = this.chatWindow.querySelector('#pet-welcome-actions');
            if (welcomeActions) {
                const firstButton = welcomeActions.querySelector('[data-action-key]');
                if (firstButton && firstButton.innerHTML) {
                    indicatorIcon = firstButton.innerHTML.trim();
                }
            }
        }

        const messageDiv = document.createElement('div');
        messageDiv.setAttribute('data-typing-indicator', 'true');
        messageDiv.style.cssText = `
            display: flex !important;
            margin-bottom: 15px !important;
            animation: messageSlideIn 0.3s ease-out !important;
        `;

        const avatar = document.createElement('div');
        avatar.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 16px !important;
            margin-right: 10px !important;
            flex-shrink: 0 !important;
            background: ${currentColor} !important;
            animation: petTyping 1.2s ease-in-out infinite !important;
        `;
        avatar.textContent = indicatorIcon;
        avatar.setAttribute('data-message-type', 'pet-avatar');

        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1 !important;
            min-width: 0 !important;
        `;

        const messageText = document.createElement('div');
        messageText.style.cssText = `
            background: ${currentColor} !important;
            color: white !important;
            padding: 12px 16px !important;
            border-radius: 12px !important;
            border-bottom-left-radius: 4px !important;
            font-size: 14px !important;
            line-height: 1.6 !important;
            max-width: 80% !important;
        `;
        messageText.setAttribute('data-message-type', 'pet-bubble');
        messageText.textContent = '💭 正在思考中...';

        const messageTime = document.createElement('div');
        messageTime.style.cssText = `
            font-size: 11px !important;
            color: #999 !important;
            margin-top: 4px !important;
            text-align: left !important;
        `;

        content.appendChild(messageText);
        content.appendChild(messageTime);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        return messageDiv;
    }

    // 添加复制按钮的辅助方法
    addCopyButton(container, messageTextElement) {
        // 如果已经添加过，就不再添加
        // 注意：现在只添加编辑、删除按钮
        if (container.querySelector('.edit-button')) {
            return;
        }

        // 创建删除按钮
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '🗑️';
        deleteButton.setAttribute('title', '删除消息');

        // 点击删除
        deleteButton.addEventListener('click', async (e) => {
            e.stopPropagation();

            // 确认删除
            if (confirm('确定要删除这条消息吗？')) {
                // 找到包含复制按钮容器的消息元素
                let currentMessage = container.parentElement;
                while (currentMessage && !currentMessage.style.cssText.includes('margin-bottom: 15px')) {
                    currentMessage = currentMessage.parentElement;
                }

                if (currentMessage) {
                    // 从会话中删除对应的消息
                    if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                        const session = this.sessions[this.currentSessionId];
                        if (session.messages && Array.isArray(session.messages)) {
                            // 获取消息内容，用于匹配会话中的消息
                            const petBubble = currentMessage.querySelector('[data-message-type="pet-bubble"]');
                            if (petBubble) {
                                const messageContent = petBubble.getAttribute('data-original-text') || 
                                                      petBubble.textContent || '';
                                
                                // 找到并删除对应的消息
                                const messageIndex = session.messages.findIndex(msg => 
                                    msg.type === 'pet' && 
                                    (msg.content === messageContent || msg.content.trim() === messageContent.trim())
                                );
                                
                                if (messageIndex !== -1) {
                                    session.messages.splice(messageIndex, 1);
                                    session.updatedAt = Date.now();
                                    // 保存会话
                                    await this.saveAllSessions();
                                    console.log(`已从会话 ${this.currentSessionId} 中删除消息，剩余 ${session.messages.length} 条消息`);
                                }
                            }
                        }
                    }
                    
                    // 动画删除消息
                    currentMessage.style.transition = 'opacity 0.3s ease';
                    currentMessage.style.opacity = '0';
                    setTimeout(() => {
                        currentMessage.remove();
                        // 删除后保存会话（确保数据同步）
                        this.saveCurrentSession().catch(err => {
                            console.error('删除消息后保存会话失败:', err);
                        });
                    }, 300);
                }
            }
        });

        // 创建编辑按钮
        const editButton = document.createElement('button');
        editButton.className = 'edit-button';
        editButton.innerHTML = '✏️';
        editButton.setAttribute('title', '编辑消息');

        // 点击编辑 - 打开弹窗编辑器（类似上下文编辑器）
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openMessageEditor(messageTextElement, 'pet');
        });

        container.innerHTML = '';
        container.appendChild(editButton);
        container.appendChild(deleteButton);
        container.style.display = 'flex';
        container.style.gap = '8px';
    }

    // 为宠物消息添加 try again 按钮
    addTryAgainButton(container, messageDiv) {
        // 如果已经添加过，就不再添加
        if (container.querySelector('.try-again-button')) {
            return;
        }
        
        // 如果是按钮操作生成的消息，不添加 try again 按钮
        if (messageDiv.hasAttribute('data-button-action')) {
            return;
        }

        const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
        if (!messagesContainer) {
            return;
        }

        // 创建 try again 按钮
        const tryAgainButton = document.createElement('button');
        tryAgainButton.className = 'try-again-button';
        tryAgainButton.innerHTML = '🔄';
        tryAgainButton.setAttribute('title', '重新生成回复');
        tryAgainButton.style.cssText = `
            background: transparent !important;
            border: none !important;
            cursor: pointer !important;
            font-size: 16px !important;
            padding: 4px 8px !important;
            opacity: 0.7 !important;
            transition: opacity 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;

        // 悬停效果
        tryAgainButton.addEventListener('mouseenter', () => {
            tryAgainButton.style.opacity = '1';
        });
        tryAgainButton.addEventListener('mouseleave', () => {
            tryAgainButton.style.opacity = '0.7';
        });

        // 点击重新生成
        let isRetrying = false;
        tryAgainButton.addEventListener('click', async (e) => {
            e.stopPropagation();

            if (isRetrying) return;
            isRetrying = true;
            
            // 获取第一个聊天下面第一个按钮的图标作为等待图标
            let waitingIcon = '⏳'; // 默认图标
            if (this.chatWindow) {
                const welcomeActions = this.chatWindow.querySelector('#pet-welcome-actions');
                if (welcomeActions) {
                    const firstButton = welcomeActions.querySelector('[data-action-key]');
                    if (firstButton && firstButton.innerHTML) {
                        waitingIcon = firstButton.innerHTML.trim();
                    }
                }
            }
            
            tryAgainButton.innerHTML = waitingIcon;
            tryAgainButton.style.opacity = '0.6';
            tryAgainButton.style.cursor = 'not-allowed';

            try {
                // 找到对应的用户消息（当前宠物消息之前的上一条用户消息）
                let userMessageText = '';
                
                // 获取消息容器中所有的消息元素
                const allMessages = Array.from(messagesContainer.children);
                
                // 找到当前宠物消息的索引
                const currentIndex = allMessages.indexOf(messageDiv);
                
                if (currentIndex === -1) {
                    throw new Error('当前消息不在消息容器中');
                }
                
                // 向前遍历所有消息，找到最近的用户消息
                for (let i = currentIndex - 1; i >= 0; i--) {
                    const messageElement = allMessages[i];
                    const userBubble = messageElement.querySelector('[data-message-type="user-bubble"]');
                    if (userBubble) {
                        // 优先使用 data-original-text，如果没有则使用文本内容
                        userMessageText = userBubble.getAttribute('data-original-text');
                        if (!userMessageText) {
                            // 如果没有保存原始文本，尝试从文本内容获取
                            userMessageText = userBubble.textContent || userBubble.innerText;
                        }
                        break;
                    }
                }

                if (!userMessageText || !userMessageText.trim()) {
                    // 如果找不到用户消息，可能是通过按钮触发的操作
                    // 尝试从消息本身获取信息，或者显示友好的错误提示
                    console.warn('未找到对应的用户消息，无法重新生成回复');
                    
                    // 恢复按钮状态
                    tryAgainButton.innerHTML = '🔄';
                    tryAgainButton.style.opacity = '0.7';
                    tryAgainButton.style.cursor = 'pointer';
                    isRetrying = false;
                    
                    // 显示提示信息
                    const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                    if (messageBubble) {
                        const originalText = messageBubble.getAttribute('data-original-text') || messageBubble.textContent;
                        messageBubble.innerHTML = this.renderMarkdown(`${originalText}\n\n💡 提示：此消息可能是通过按钮操作生成的，无法重新生成。`);
                    }
                    
                    return;
                }

                // 获取消息气泡元素
                const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                if (!messageBubble) {
                    throw new Error('未找到消息气泡');
                }

                // 显示加载状态（使用与等待按钮相同的图标）
                messageBubble.innerHTML = this.renderMarkdown(`${waitingIcon} 正在重新生成回复...`);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                // 重新生成回复
                let fullContent = '';
                const onStreamContent = (chunk, accumulatedContent) => {
                    fullContent = accumulatedContent;
                    messageBubble.innerHTML = this.renderMarkdown(fullContent);
                    messageBubble.setAttribute('data-original-text', fullContent);
                    
                    // 处理可能的 Mermaid 图表
                    if (messageBubble._mermaidTimeout) {
                        clearTimeout(messageBubble._mermaidTimeout);
                    }
                    messageBubble._mermaidTimeout = setTimeout(async () => {
                        await this.processMermaidBlocks(messageBubble);
                        messageBubble._mermaidTimeout = null;
                    }, 500);

                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                };

                // 创建 AbortController 用于终止请求（使用统一的 currentAbortController）
                const abortController = new AbortController();
                if (this.chatWindow && this.chatWindow._setAbortController) {
                    this.chatWindow._setAbortController(abortController);
                }
                if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                    this.chatWindow._updateRequestStatus('loading');
                }
                
                // 调用 API 重新生成
                const reply = await this.generatePetResponseStream(userMessageText, onStreamContent, abortController);

                // 确保最终内容被显示
                if (fullContent !== reply) {
                    messageBubble.innerHTML = this.renderMarkdown(reply);
                    messageBubble.setAttribute('data-original-text', reply);
                    setTimeout(async () => {
                        await this.processMermaidBlocks(messageBubble);
                    }, 100);
                }

                // 更新复制按钮
                const copyButtonContainer = messageDiv.querySelector('[data-copy-button-container]');
                if (copyButtonContainer && reply && reply.trim()) {
                    this.addCopyButton(copyButtonContainer, messageBubble);
                }

                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                // 更新状态为空闲
                if (this.chatWindow && this.chatWindow._setAbortController) {
                    this.chatWindow._setAbortController(null);
                }
                if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                    this.chatWindow._updateRequestStatus('idle');
                }

                // prompt 接口完成后，立即同步到后端
                if (reply && reply.trim()) {
                    // 更新会话中的消息
                    await this.addMessageToSession('pet', reply);
                    await this.saveCurrentSession();
                    if (PET_CONFIG.api.syncSessionsToBackend && this.currentSessionId) {
                        await this.syncSessionToBackend(this.currentSessionId, true).catch(err => {
                            console.warn('重新生成后同步会话到后端失败:', err);
                        });
                    }
                }

                // 恢复按钮状态
                tryAgainButton.innerHTML = '✓';
                tryAgainButton.style.color = '#4caf50';
                
                setTimeout(() => {
                    tryAgainButton.innerHTML = '🔄';
                    tryAgainButton.style.color = '';
                    tryAgainButton.style.opacity = '0.7';
                    tryAgainButton.style.cursor = 'pointer';
                    isRetrying = false;
                }, 1500);

            } catch (error) {
                // 检查是否是取消错误
                const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';
                
                if (!isAbortError) {
                    console.error('重新生成回复失败:', error);
                }
                
                // 更新状态为空闲
                if (this.chatWindow && this.chatWindow._setAbortController) {
                    this.chatWindow._setAbortController(null);
                }
                if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                    this.chatWindow._updateRequestStatus('idle');
                }
                
                // 显示错误信息（取消时不显示错误）
                if (!isAbortError) {
                    const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                    if (messageBubble) {
                        const originalText = messageBubble.getAttribute('data-original-text') || '抱歉，重新生成失败。';
                        messageBubble.innerHTML = this.renderMarkdown(originalText);
                    }

                    // 恢复按钮状态
                    tryAgainButton.innerHTML = '✕';
                    tryAgainButton.style.color = '#f44336';
                    
                    setTimeout(() => {
                        tryAgainButton.innerHTML = '🔄';
                        tryAgainButton.style.color = '';
                        tryAgainButton.style.opacity = '0.7';
                        tryAgainButton.style.cursor = 'pointer';
                        isRetrying = false;
                    }, 1500);
                } else {
                    // 请求被取消，恢复按钮状态
                    tryAgainButton.innerHTML = '🔄';
                    tryAgainButton.style.color = '';
                    tryAgainButton.style.opacity = '0.7';
                    tryAgainButton.style.cursor = 'pointer';
                    isRetrying = false;
                }
            }
        });

        container.appendChild(tryAgainButton);
        container.style.display = 'flex';
        container.style.gap = '8px';
        
        // 如果容器之前是隐藏的，现在显示它
        if (container.style.display === 'none') {
            container.style.display = 'flex';
        }
    }

    // 为用户消息添加删除和编辑按钮
    addDeleteButtonForUserMessage(container, messageTextElement) {
        // 如果已经添加过，就不再添加
        if (container.querySelector('.delete-button')) {
            return;
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '🗑️';
        deleteButton.setAttribute('title', '删除消息');

        // 点击删除
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();

            // 确认删除
            if (confirm('确定要删除这条消息吗？')) {
                // 找到包含删除按钮容器的消息元素
                let currentMessage = container.parentElement;
                while (currentMessage && !currentMessage.style.cssText.includes('margin-bottom: 15px')) {
                    currentMessage = currentMessage.parentElement;
                }

                if (currentMessage) {
                    currentMessage.style.transition = 'opacity 0.3s ease';
                    currentMessage.style.opacity = '0';
                    setTimeout(() => {
                        currentMessage.remove();
                    }, 300);
                }
            }
        });

        // 创建编辑按钮
        const editButton = document.createElement('button');
        editButton.className = 'edit-button';
        editButton.innerHTML = '✏️';
        editButton.setAttribute('title', '编辑消息');

        // 点击编辑 - 打开弹窗编辑器（类似上下文编辑器，与宠物消息保持一致）
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (messageTextElement) {
                this.openMessageEditor(messageTextElement, 'user');
            }
        });

        container.innerHTML = '';
        container.appendChild(editButton);
        container.appendChild(deleteButton);
        container.style.display = 'flex';
        container.style.gap = '8px';
    }

    // 启用消息编辑功能
    enableMessageEdit(messageElement, editButton, sender) {
        // 保存原始内容 - 优先从data-original-text获取（保留原始格式），如果没有则从元素内容获取
        let originalText = messageElement.getAttribute('data-original-text') || '';
        
        // 如果data-original-text为空，则从元素内容中提取
        if (!originalText) {
            if (sender === 'pet') {
                // 对于宠物消息，从innerText获取（去掉Markdown格式）
                originalText = messageElement.innerText || messageElement.textContent || '';
            } else {
                // 对于用户消息，直接获取文本内容
                originalText = messageElement.innerText || messageElement.textContent || '';
            }
        }

        // 保存原始HTML（如果存在）
        const originalHTML = messageElement.innerHTML;

        // 保存到data属性
        messageElement.setAttribute('data-original-content', originalHTML);
        messageElement.setAttribute('data-editing', 'true');

        // 创建文本输入框
        const textarea = document.createElement('textarea');
        textarea.value = originalText;
        textarea.style.cssText = `
            width: 100% !important;
            min-height: 80px !important;
            max-height: 400px !important;
            padding: 12px 16px !important;
            border: 2px solid rgba(255, 255, 255, 0.5) !important;
            border-radius: 8px !important;
            background: rgba(255, 255, 255, 0.2) !important;
            color: white !important;
            font-size: 14px !important;
            font-family: inherit !important;
            line-height: 1.6 !important;
            resize: vertical !important;
            outline: none !important;
            box-sizing: border-box !important;
            overflow-y: auto !important;
        `;
        textarea.setAttribute('placeholder', '编辑消息内容...');

        // 替换消息内容为输入框
        messageElement.innerHTML = '';
        messageElement.appendChild(textarea);

        // 自动调整高度以适应内容
        const adjustHeight = () => {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            const minHeight = 80;
            const maxHeight = 400;
            const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
            textarea.style.height = newHeight + 'px';
        };

        // 初始调整高度
        setTimeout(() => {
            adjustHeight();
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }, 10);

        // 更新编辑按钮状态
        editButton.setAttribute('data-editing', 'true');
        editButton.innerHTML = '💾';
        editButton.setAttribute('title', '保存编辑');

        // 添加回车保存功能（Ctrl+Enter或Cmd+Enter）
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.saveMessageEdit(messageElement, editButton, sender);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelMessageEdit(messageElement, editButton, sender);
            }
        });

        // 自动调整高度（输入时实时调整）
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            const minHeight = 80;
            const maxHeight = 400;
            const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
            textarea.style.height = newHeight + 'px';
            
            // 如果内容超过最大高度，显示滚动条
            if (scrollHeight > maxHeight) {
                textarea.style.overflowY = 'auto';
            } else {
                textarea.style.overflowY = 'hidden';
            }
        });
    }

    // 保存消息编辑
    saveMessageEdit(messageElement, editButton, sender) {
        const textarea = messageElement.querySelector('textarea');
        if (!textarea) return;

        const newText = textarea.value.trim();
        
        if (!newText) {
            // 如果内容为空，取消编辑
            this.cancelMessageEdit(messageElement, editButton, sender);
            return;
        }

        // 更新消息内容
        if (sender === 'pet') {
            // 对于宠物消息，使用Markdown渲染
            messageElement.innerHTML = this.renderMarkdown(newText);
            messageElement.classList.add('markdown-content');
            // 更新原始文本
            messageElement.setAttribute('data-original-text', newText);
            // 处理可能的 Mermaid 图表 - 使用更可靠的方式
            // 先等待DOM更新完成，然后处理mermaid
            setTimeout(async () => {
                try {
                    // 确保 mermaid 已加载
                    await this.loadMermaid();
                    // 再次检查 DOM 是否已更新
                    const hasMermaidCode = messageElement.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                    if (hasMermaidCode) {
                        // 处理 mermaid 图表
                        await this.processMermaidBlocks(messageElement);
                    }
                } catch (error) {
                    console.error('处理编辑后的 Mermaid 图表时出错:', error);
                }
            }, 200);
        } else {
            // 对于用户消息，也支持 Markdown 和 Mermaid 预览
            // 检查是否包含 markdown 语法（简单检测）
            const hasMarkdown = /[#*_`\[\]()!]|```/.test(newText);
            
            if (hasMarkdown) {
                // 使用 Markdown 渲染
                messageElement.innerHTML = this.renderMarkdown(newText);
                messageElement.classList.add('markdown-content');
                // 更新原始文本
                messageElement.setAttribute('data-original-text', newText);
                // 处理可能的 Mermaid 图表
                setTimeout(async () => {
                    try {
                        // 确保 mermaid 已加载
                        await this.loadMermaid();
                        // 再次检查 DOM 是否已更新
                        const hasMermaidCode = messageElement.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                        if (hasMermaidCode) {
                            // 处理 mermaid 图表
                            await this.processMermaidBlocks(messageElement);
                        }
                    } catch (error) {
                        console.error('处理编辑后的 Mermaid 图表时出错:', error);
                    }
                }, 200);
            } else {
                // 纯文本，不使用 Markdown
                messageElement.textContent = newText;
                // 更新原始文本，以便再次编辑时可以获取
                messageElement.setAttribute('data-original-text', newText);
            }
        }

        // 恢复编辑状态
        messageElement.removeAttribute('data-editing');
        messageElement.setAttribute('data-edited', 'true');

        // 更新编辑按钮状态
        editButton.setAttribute('data-editing', 'false');
        editButton.innerHTML = '✏️';
        editButton.setAttribute('title', '编辑消息');
    }

    // 取消消息编辑
    cancelMessageEdit(messageElement, editButton, sender) {
        const originalHTML = messageElement.getAttribute('data-original-content');
        
        if (originalHTML) {
            messageElement.innerHTML = originalHTML;
        }

        // 恢复编辑状态
        messageElement.removeAttribute('data-editing');

        // 更新编辑按钮状态
        editButton.setAttribute('data-editing', 'false');
        editButton.innerHTML = '✏️';
        editButton.setAttribute('title', '编辑消息');
    }

    // 发送图片消息
    sendImageMessage(imageDataUrl) {
        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (!messagesContainer) return;

        // 添加用户消息（带图片）
        const userMessage = this.createMessageElement('', 'user', imageDataUrl);
        messagesContainer.appendChild(userMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 播放思考动画
        this.playChatAnimation();

        // 生成宠物响应
        setTimeout(() => {
            const replies = [
                '哇！这张图片好有趣啊！✨',
                '看起来很棒呢！😊',
                '这是我见过的最特别的图片！🌟',
                '太有意思了！💕',
                '我真的很喜欢这张图！💖',
                '这真是太棒了！🎉'
            ];
            const reply = replies[Math.floor(Math.random() * replies.length)];
            const petMessage = this.createMessageElement(reply, 'pet');
            messagesContainer.appendChild(petMessage);
            // 添加 try again 按钮（仅当不是第一条消息时）
            const petMessages = Array.from(messagesContainer.children).filter(
                child => child.querySelector('[data-message-type="pet-bubble"]')
            );
            if (petMessages.length > 1) {
                const tryAgainContainer = petMessage.querySelector('[data-try-again-button-container]');
                if (tryAgainContainer) {
                    this.addTryAgainButton(tryAgainContainer, petMessage);
                }
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, PET_CONFIG.chatWindow.message.thinkingDelay.min + Math.random() * (PET_CONFIG.chatWindow.message.thinkingDelay.max - PET_CONFIG.chatWindow.message.thinkingDelay.min));
    }

    // 显示图片预览
    showImagePreview(imageDataUrl) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.9) !important;
            z-index: 2147483650 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            animation: fadeIn 0.3s ease-out !important;
        `;

        const img = document.createElement('img');
        img.src = imageDataUrl;
        img.style.cssText = `
            max-width: 90% !important;
            max-height: 90% !important;
            border-radius: 8px !important;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute !important;
            top: 20px !important;
            right: 20px !important;
            background: rgba(255, 255, 255, 0.2) !important;
            color: white !important;
            border: none !important;
            width: 40px !important;
            height: 40px !important;
            border-radius: 50% !important;
            font-size: 20px !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
        `;
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        });

        modal.appendChild(img);
        modal.appendChild(closeBtn);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        document.body.appendChild(modal);
    }

    // 获取当前时间
    // 获取页面图标URL（辅助方法）
    getPageIconUrl() {
        let iconUrl = '';
        const linkTags = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
        if (linkTags.length > 0) {
            iconUrl = linkTags[0].href;
            if (!iconUrl.startsWith('http')) {
                iconUrl = new URL(iconUrl, window.location.origin).href;
            }
        }
        if (!iconUrl) {
            iconUrl = '/favicon.ico';
            if (!iconUrl.startsWith('http')) {
                iconUrl = new URL(iconUrl, window.location.origin).href;
            }
        }
        return iconUrl;
    }

    // 创建欢迎消息（重构后的统一方法）
    // @param {HTMLElement} messagesContainer - 消息容器
    // @param {Object} pageInfo - 页面信息对象（可选，如果不提供则使用当前页面信息）
    //   - title: 页面标题
    //   - url: 页面URL
    //   - description: 页面描述（可选）
    createWelcomeMessage(messagesContainer, pageInfo = null) {
        // 如果没有提供页面信息，使用当前页面信息或会话信息
        if (!pageInfo) {
            // 优先使用当前会话的页面信息，如果没有则使用当前页面信息
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                pageInfo = {
                    title: session.pageTitle || session.title || document.title || '当前页面',
                    url: session.url || window.location.href,
                    description: session.pageDescription || ''
                };
            } else {
                // 使用 getPageInfo 方法获取当前页面信息
                const currentPageInfo = this.getPageInfo();
                pageInfo = {
                    title: currentPageInfo.title,
                    url: currentPageInfo.url,
                    description: currentPageInfo.description || ''
                };
            }
        }

        // 获取页面图标
        const pageIconUrl = this.getPageIconUrl();

        // 构建页面信息显示内容（优化后的HTML结构）
        let pageInfoHtml = `
            <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, rgba(78, 205, 196, 0.1), rgba(68, 160, 141, 0.05)); border-radius: 12px; border-left: 3px solid #4ECDC4;">
                <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <img src="${pageIconUrl}" alt="页面图标" style="width: 20px; height: 20px; border-radius: 4px; object-fit: contain; flex-shrink: 0;" onerror="this.style.display='none'">
                    <span style="font-weight: 600; font-size: 15px; color: #374151;">${this.escapeHtml(pageInfo.title)}</span>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px; font-weight: 500;">🔗 网址</div>
                    <a href="${pageInfo.url}" target="_blank" style="word-break: break-all; color: #2196F3; text-decoration: none; font-size: 13px; display: inline-block; max-width: 100%;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${this.escapeHtml(pageInfo.url)}</a>
                </div>
        `;

        if (pageInfo.description && pageInfo.description.trim()) {
            pageInfoHtml += `
                <div style="margin-bottom: 0;">
                    <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px; font-weight: 500;">📝 页面描述</div>
                    <div style="font-size: 13px; color: #4B5563; line-height: 1.5;">${this.escapeHtml(pageInfo.description)}</div>
                </div>
            `;
        }

        pageInfoHtml += `</div>`;

        // 创建欢迎消息元素
        const welcomeMessage = this.createMessageElement('', 'pet');
        welcomeMessage.setAttribute('data-welcome-message', 'true');
        messagesContainer.appendChild(welcomeMessage);
        
        const messageText = welcomeMessage.querySelector('[data-message-type="pet-bubble"]');
        if (messageText) {
            messageText.innerHTML = pageInfoHtml;
            // 保存原始HTML用于后续保存（虽然欢迎消息不会被保存到消息数组中）
            messageText.setAttribute('data-original-text', pageInfoHtml);
        }

        return welcomeMessage;
    }

    // HTML转义辅助方法（防止XSS）
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 添加聊天滚动条样式
    addChatScrollbarStyles() {
        if (document.getElementById('pet-chat-styles')) return;

        const style = document.createElement('style');
        style.id = 'pet-chat-styles';
        style.textContent = `
            @keyframes messageSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* Chrome/Safari 滚动条样式 */
            #pet-chat-messages::-webkit-scrollbar {
                width: 8px;
            }

            #pet-chat-messages::-webkit-scrollbar-track {
                background: rgba(241, 241, 241, 0.5);
                border-radius: 4px;
            }

            #pet-chat-messages::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 4px;
                border: 1px solid transparent;
                background-clip: padding-box;
            }

            #pet-chat-messages::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }

            /* Firefox 滚动条样式 */
            #pet-chat-messages {
                scrollbar-width: thin;
                scrollbar-color: #c1c1c1 rgba(241, 241, 241, 0.5);
            }

            /* 确保消息容器可以滚动 */
            #pet-chat-messages {
                overflow-y: auto !important;
                overflow-x: hidden !important;
            }
        `;
        document.head.appendChild(style);
    }

    // 播放聊天动画
    playChatAnimation() {
        if (!this.pet) return;

        // 先清理之前的动画
        if (this.chatBubbleInterval) {
            clearInterval(this.chatBubbleInterval);
            this.chatBubbleInterval = null;
        }
        if (this.lastChatBubble && this.lastChatBubble.parentNode) {
            this.lastChatBubble.parentNode.removeChild(this.lastChatBubble);
            this.lastChatBubble = null;
        }

        // 添加思考动画（更丰富的动画效果）
        this.pet.style.animation = 'none';
        setTimeout(() => {
            // 随机选择不同的动画效果
            const animations = [
                'petThinking 0.8s ease-in-out infinite',
                'petThinkingBounce 1.2s ease-in-out infinite',
                'petThinkingPulse 1s ease-in-out infinite'
            ];
            const selectedAnimation = animations[Math.floor(Math.random() * animations.length)];
            this.pet.style.animation = selectedAnimation;
        }, 10);

        // 添加聊天气泡效果
        this.showChatBubble();
    }

    // 显示聊天气泡
    showChatBubble() {
        if (!this.pet) return;

        // 创建聊天气泡
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.style.cssText = `
            position: absolute !important;
            top: -40px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: rgba(0, 0, 0, 0.8) !important;
            color: white !important;
            padding: 8px 12px !important;
            border-radius: 12px !important;
            font-size: 12px !important;
            white-space: nowrap !important;
            z-index: 2147483648 !important;
            pointer-events: none !important;
            animation: bubbleAppear 0.5s ease-out !important;
        `;

        // 添加动画样式
        if (!document.getElementById('chat-bubble-styles')) {
            const style = document.createElement('style');
            style.id = 'chat-bubble-styles';
            style.textContent = `
                @keyframes petThinking {
                    0%, 100% { transform: scale(1) rotate(0deg); }
                    25% { transform: scale(1.1) rotate(-5deg); }
                    50% { transform: scale(1.05) rotate(5deg); }
                    75% { transform: scale(1.1) rotate(-3deg); }
                }

                @keyframes petThinkingBounce {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-8px) scale(1.08); }
                }

                @keyframes petThinkingPulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.15); opacity: 0.9; }
                }

                @keyframes bubbleAppear {
                    0% {
                        opacity: 0;
                        transform: translateX(-50%) translateY(10px) scale(0.8);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                    }
                }
            `;
            if (document.head) {
                document.head.appendChild(style);
            }
        }

        // 随机选择思考文本（更有趣的提示语）
        const thinkingTexts = [
            '🤔 让我想想...',
            '💭 思考中...',
            '✨ 灵感涌现',
            '🌟 整理思路',
            '🎯 深度分析',
            '🔍 搜索答案',
            '💡 想法来了',
            '🌊 头脑风暴',
            '📝 组织语言',
            '🎨 酝酿回复',
            '⚡ 快想好了',
            '🌈 无限接近',
            '🚀 马上就来'
        ];
        bubble.textContent = thinkingTexts[Math.floor(Math.random() * thinkingTexts.length)];

        this.pet.appendChild(bubble);

        // 保存气泡到实例以便后续更新
        this.lastChatBubble = bubble;

        // 动态更新气泡文本（让用户感受到进展）
        const updateBubbleInterval = setInterval(() => {
            if (bubble.parentNode) {
                let newText;
                do {
                    newText = thinkingTexts[Math.floor(Math.random() * thinkingTexts.length)];
                } while (newText === bubble.textContent && thinkingTexts.length > 1);
                bubble.textContent = newText;
            } else {
                clearInterval(updateBubbleInterval);
            }
        }, 1500);

        // 保存interval以便后续清理
        this.chatBubbleInterval = updateBubbleInterval;

        // 3秒后移除气泡
        setTimeout(() => {
            clearInterval(updateBubbleInterval);
            if (bubble.parentNode) {
                bubble.style.animation = 'bubbleAppear 0.3s ease-out reverse';
                setTimeout(() => {
                    if (bubble.parentNode) {
                        bubble.parentNode.removeChild(bubble);
                    }
                    this.lastChatBubble = null;
                }, 300);
            }
        }, 3000);
    }

    // 截图功能（支持区域选择）
    async takeScreenshot() {
        try {
            console.log('开始截图...');

            // 检查Chrome API可用性
            if (!this.checkChromeAPIAvailability()) {
                this.showScreenshotNotification('Chrome API不可用，请刷新页面后重试', 'error');
                return;
            }

            // 添加详细的权限诊断
            await this.diagnosePermissions();

            // 检查权限
            const hasPermission = await this.checkScreenshotPermission();
            if (!hasPermission) {
                this.showScreenshotNotification('权限不足，请重新加载扩展或手动授予权限', 'error');
                this.showPermissionHelp();
                return;
            }

            // 检查当前页面是否允许截图
            if (this.isSystemPage()) {
                this.showScreenshotNotification('无法截取系统页面，请在其他网页中使用截图功能', 'error');
                return;
            }

            // 隐藏聊天窗口以获取更清晰的截图
            const originalDisplay = this.chatWindow ? this.chatWindow.style.display : 'block';
            if (this.chatWindow) {
                this.chatWindow.style.display = 'none';
            }

            // 隐藏宠物（如果显示的话）
            const originalPetDisplay = this.pet ? this.pet.style.display : 'block';
            if (this.pet) {
                this.pet.style.display = 'none';
            }

            // 等待一小段时间确保窗口完全隐藏
            await new Promise(resolve => setTimeout(resolve, 200));

            // 尝试使用Chrome的captureVisibleTab API截图
            let dataUrl = await this.captureVisibleTab();

            // 如果主要方法失败，尝试备用方法
            if (!dataUrl) {
                console.log('主要截图方法失败，尝试备用方法...');
                this.showScreenshotNotification('主要方法失败，尝试备用方法...', 'info');
                dataUrl = await this.fallbackScreenshot();
            }

            if (dataUrl) {
                // 保持聊天窗口和宠物隐藏，直到区域选择完成
                this.showAreaSelector(dataUrl, originalDisplay, originalPetDisplay);
            } else {
                // 如果截图失败，恢复显示
                if (this.chatWindow) {
                    this.chatWindow.style.display = originalDisplay;
                }
                if (this.pet) {
                    this.pet.style.display = originalPetDisplay;
                }
                this.showScreenshotNotification('截图失败，请检查权限设置或尝试刷新页面', 'error');
                this.showPermissionHelp();
            }

        } catch (error) {
            console.error('截图失败:', error);
            this.showScreenshotNotification('截图失败，请重试', 'error');

            // 确保聊天窗口和宠物恢复显示
            if (this.chatWindow) {
                this.chatWindow.style.display = 'block';
            }
            if (this.pet) {
                this.pet.style.display = 'block';
            }
        }
    }

    // 显示区域选择器
    showAreaSelector(dataUrl, originalChatDisplay = 'block', originalPetDisplay = 'block') {
        // 创建区域选择器覆盖层
        const overlay = document.createElement('div');
        overlay.id = 'area-selector-overlay';
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 2147483651 !important;
            cursor: crosshair !important;
            user-select: none !important;
        `;

        // 先加载图片以获取真实尺寸
        const img = new Image();
        img.src = dataUrl;

        // 创建截图背景容器
        const screenshotBg = document.createElement('div');
        screenshotBg.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            opacity: 0.7 !important;
        `;

        // 创建实际图片元素
        const screenshotImg = document.createElement('img');
        screenshotImg.src = dataUrl;
        screenshotImg.style.cssText = `
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
        `;

        screenshotBg.appendChild(screenshotImg);

        // 创建选择框
        const selectionBox = document.createElement('div');
        selectionBox.id = 'selection-box';
        selectionBox.style.cssText = `
            position: absolute !important;
            border: 2px solid #2196F3 !important;
            background: rgba(33, 150, 243, 0.1) !important;
            pointer-events: none !important;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3) !important;
            display: none !important;
        `;

        // 创建工具提示
        const tipText = document.createElement('div');
        tipText.id = 'selection-tip';
        tipText.textContent = '拖动鼠标选择截图区域，双击确认';
        tipText.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(0, 0, 0, 0.8) !important;
            color: white !important;
            padding: 12px 20px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            pointer-events: none !important;
            z-index: 2147483652 !important;
        `;

        overlay.appendChild(screenshotBg);
        overlay.appendChild(selectionBox);
        overlay.appendChild(tipText);

        // 等待图片加载完成后再添加到页面并设置事件监听
        img.onload = () => {
            document.body.appendChild(overlay);
            setupEventListeners();
        };

        // 如果图片已经加载完成
        if (img.complete && img.naturalHeight !== 0) {
            document.body.appendChild(overlay);
            setupEventListeners();
        }

        let isSelecting = false;
        let startX = 0;
        let startY = 0;

        // 设置事件监听器的函数
        const setupEventListeners = () => {
            // 鼠标按下事件
            overlay.addEventListener('mousedown', (e) => {
                isSelecting = true;
                startX = e.clientX;
                startY = e.clientY;

                selectionBox.style.left = startX + 'px';
                selectionBox.style.top = startY + 'px';
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
                selectionBox.style.display = 'block';

                // 隐藏提示
                tipText.style.display = 'none';

                e.preventDefault();
            });

            // 鼠标移动事件
            overlay.addEventListener('mousemove', (e) => {
                if (!isSelecting) return;

                const currentX = e.clientX;
                const currentY = e.clientY;

                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);

                selectionBox.style.left = left + 'px';
                selectionBox.style.top = top + 'px';
                selectionBox.style.width = width + 'px';
                selectionBox.style.height = height + 'px';
            });

            // 鼠标释放或双击事件
            const finishSelection = (e) => {
                if (!isSelecting) return;
                isSelecting = false;

                const rect = selectionBox.getBoundingClientRect();

                // 如果区域太小，关闭选择器并恢复显示
                if (rect.width < 10 || rect.height < 10) {
                    if (tipText) tipText.remove();
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                    // 恢复聊天窗口和宠物显示
                    this.restoreElements(originalChatDisplay, originalPetDisplay);
                    return;
                }

                // 计算截取区域的相对坐标（相对于原始截图尺寸）
                // 使用已经加载的图片
                const imgRect = screenshotImg.getBoundingClientRect();

                // 计算图片在页面中的实际显示尺寸和位置
                const imgDisplayWidth = imgRect.width;
                const imgDisplayHeight = imgRect.height;
                const imgDisplayX = imgRect.left;
                const imgDisplayY = imgRect.top;

                // 计算原始图片和显示图片的缩放比例
                const scaleX = img.width / imgDisplayWidth;
                const scaleY = img.height / imgDisplayHeight;

                // 将选择框相对于图片的位置转换为原始图片的坐标
                const relativeX = rect.left - imgDisplayX;
                const relativeY = rect.top - imgDisplayY;
                const relativeWidth = rect.width;
                const relativeHeight = rect.height;

                // 转换为原始图片坐标
                const actualX = relativeX * scaleX;
                const actualY = relativeY * scaleY;
                const actualWidth = relativeWidth * scaleX;
                const actualHeight = relativeHeight * scaleY;

                // 移除选择器
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }

                // 恢复聊天窗口和宠物显示
                this.restoreElements(originalChatDisplay, originalPetDisplay);

                // 裁剪图片
                this.cropAndDisplayScreenshot(dataUrl, actualX, actualY, actualWidth, actualHeight);
            };

            overlay.addEventListener('mouseup', finishSelection);
            overlay.addEventListener('dblclick', finishSelection);

            // ESC键取消
            const cancelHandler = (e) => {
                if (e.key === 'Escape') {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                    // 恢复聊天窗口和宠物显示
                    this.restoreElements(originalChatDisplay, originalPetDisplay);
                    window.removeEventListener('keydown', cancelHandler);
                }
            };
            window.addEventListener('keydown', cancelHandler);
        };
    }

    // 恢复元素显示
    restoreElements(chatDisplay, petDisplay) {
        if (this.chatWindow) {
            this.chatWindow.style.display = chatDisplay;
        }
        if (this.pet) {
            this.pet.style.display = petDisplay;
        }
    }

    // 裁剪并显示截图
    cropAndDisplayScreenshot(dataUrl, x, y, width, height) {
        const img = new Image();
        img.src = dataUrl;

        img.onload = () => {
            // 创建canvas进行裁剪
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

            // 转换为data URL
            const croppedDataUrl = canvas.toDataURL('image/png');

            this.showScreenshotPreview(croppedDataUrl);
        };
    }

    // 权限诊断
    async diagnosePermissions() {
        console.log('=== 权限诊断开始 ===');

        // 检查Chrome API可用性
        console.log('Chrome API可用性:', {
            chrome: typeof chrome !== 'undefined',
            runtime: typeof chrome !== 'undefined' && !!chrome.runtime,
            tabs: typeof chrome !== 'undefined' && !!chrome.tabs,
            permissions: '通过background script检查'
        });

        // 检查当前页面信息
        console.log('当前页面信息:', {
            url: window.location.href,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            isSystemPage: this.isSystemPage()
        });

        // 检查扩展信息
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            try {
                const manifest = chrome.runtime.getManifest();
                console.log('扩展信息:', {
                    name: manifest.name,
                    version: manifest.version,
                    permissions: manifest.permissions,
                    host_permissions: manifest.host_permissions
                });
            } catch (error) {
                console.error('获取扩展信息失败:', error);
            }
        }

        // 通过background script获取权限信息
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                action: 'checkPermissions'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('获取权限信息失败:', chrome.runtime.lastError.message);
                } else if (response && response.success) {
                    console.log('权限状态:', response.permissions);
                }
            });
        }

        console.log('=== 权限诊断结束 ===');
    }

    // 显示权限帮助
    showPermissionHelp() {
        const helpModal = document.createElement('div');
        helpModal.id = 'permission-help-modal';
        helpModal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.8) !important;
            z-index: 2147483651 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            animation: fadeIn 0.3s ease-out !important;
        `;

        const helpContainer = document.createElement('div');
        helpContainer.style.cssText = `
            background: white !important;
            border-radius: 16px !important;
            padding: 30px !important;
            max-width: 500px !important;
            max-height: 80% !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
            position: relative !important;
            animation: scaleIn 0.3s ease-out !important;
            overflow-y: auto !important;
        `;

        helpContainer.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #333; font-size: 20px; font-weight: 600; text-align: center;">
                🔧 权限问题解决方案
            </h3>

            <div style="margin-bottom: 20px;">
                <h4 style="color: #ff6b6b; margin-bottom: 10px;">📋 解决步骤：</h4>
                <ol style="color: #666; line-height: 1.6; padding-left: 20px;">
                    <li>打开 Chrome 扩展管理页面：<code>chrome://extensions/</code></li>
                    <li>找到"温柔陪伴助手"扩展</li>
                    <li>点击"重新加载"按钮</li>
                    <li>确保"在所有网站上"权限已启用</li>
                    <li>刷新当前网页</li>
                    <li>重新尝试截图功能</li>
                </ol>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="color: #FF9800; margin-bottom: 10px;">⚠️ Chrome API问题：</h4>
                <ul style="color: #666; line-height: 1.6; padding-left: 20px;">
                    <li>如果显示"Chrome API不可用"，请刷新页面</li>
                    <li>确保在普通网页中使用（非系统页面）</li>
                    <li>检查浏览器是否是最新版本</li>
                    <li>尝试重启浏览器</li>
                </ul>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="color: #4CAF50; margin-bottom: 10px;">💡 其他解决方案：</h4>
                <ul style="color: #666; line-height: 1.6; padding-left: 20px;">
                    <li>尝试在其他网页中使用截图功能</li>
                    <li>检查浏览器是否是最新版本</li>
                    <li>暂时禁用其他可能冲突的扩展</li>
                    <li>重启浏览器后重试</li>
                </ul>
            </div>

            <div style="text-align: center;">
                <button id="open-extensions-page" style="
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #2196F3, #1976D2);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-right: 10px;
                    transition: all 0.3s ease;
                ">🚀 打开扩展管理页面</button>

                <button id="close-help-modal" style="
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #f44336, #d32f2f);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">关闭</button>
            </div>
        `;

        helpModal.appendChild(helpContainer);
        document.body.appendChild(helpModal);

        // 添加事件监听器
        document.getElementById('open-extensions-page').addEventListener('click', () => {
            window.open('chrome://extensions/', '_blank');
        });

        document.getElementById('close-help-modal').addEventListener('click', () => {
            this.closePermissionHelp();
        });

        // 点击背景关闭
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                this.closePermissionHelp();
            }
        });

        // 添加动画样式
        if (!document.getElementById('help-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'help-modal-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // 关闭权限帮助
    closePermissionHelp() {
        const modal = document.getElementById('permission-help-modal');
        if (modal) {
            modal.style.animation = 'fadeIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }

    // 检查是否为系统页面
    isSystemPage() {
        const url = window.location.href;
        return url.startsWith('chrome://') ||
               url.startsWith('chrome-extension://') ||
               url.startsWith('moz-extension://') ||
               url.startsWith('about:') ||
               url.startsWith('edge://') ||
               url.startsWith('browser://');
    }

    // 检查Chrome API可用性
    checkChromeAPIAvailability() {
        console.log('检查Chrome API可用性...');

        const apiStatus = {
            chrome: typeof chrome !== 'undefined',
            runtime: typeof chrome !== 'undefined' && !!chrome.runtime,
            tabs: typeof chrome !== 'undefined' && !!chrome.tabs
        };

        console.log('API状态:', apiStatus);

        if (!apiStatus.chrome) {
            console.error('Chrome对象不存在');
            return false;
        }

        if (!apiStatus.runtime) {
            console.error('Chrome runtime API不可用');
            return false;
        }

        // 测试runtime API是否正常工作
        try {
            const manifest = chrome.runtime.getManifest();
            if (!manifest || !manifest.name) {
                console.error('无法获取扩展manifest');
                return false;
            }
            console.log('✅ Chrome API可用，扩展:', manifest.name);
            return true;
        } catch (error) {
            console.error('Chrome runtime API测试失败:', error);
            return false;
        }
    }

    // 检查截图权限
    async checkScreenshotPermission() {
        return new Promise((resolve) => {
            console.log('开始检查截图权限...');

            // 检查chrome runtime API是否可用
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                console.error('Chrome runtime API不可用');
                resolve(false);
                return;
            }

            // 通过background script检查权限
            chrome.runtime.sendMessage({
                action: 'checkPermissions'
            }, (response) => {
                console.log('权限检查响应:', response);

                if (chrome.runtime.lastError) {
                    console.error('权限检查失败:', chrome.runtime.lastError.message);
                    resolve(false);
                    return;
                }

                if (response && response.success && response.permissions) {
                    const permissions = response.permissions;
                    console.log('当前权限列表:', permissions);

                    // 检查是否有activeTab权限
                    const hasActiveTab = permissions.permissions && permissions.permissions.includes('activeTab');
                    console.log('activeTab权限状态:', hasActiveTab);

                    if (hasActiveTab) {
                        console.log('✅ activeTab权限已存在');
                        resolve(true);
                    } else {
                        console.log('❌ activeTab权限不存在');
                        resolve(false);
                    }
                } else {
                    console.error('权限检查响应无效:', response);
                    resolve(false);
                }
            });
        });
    }

    // 备用截图方法
    async fallbackScreenshot() {
        try {
            console.log('尝试备用截图方法...');

            // 方法1: 使用html2canvas库（如果可用）
            if (typeof html2canvas !== 'undefined') {
                console.log('使用html2canvas库截图...');
                try {
                    const canvas = await html2canvas(document.body, {
                        allowTaint: true,
                        useCORS: true,
                        scale: 0.5, // 降低分辨率以提高性能
                        logging: false,
                        width: window.innerWidth,
                        height: window.innerHeight
                    });
                    return canvas.toDataURL('image/png');
                } catch (error) {
                    console.error('html2canvas截图失败:', error);
                }
            }

            // 方法2: 使用getDisplayMedia API
            if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                console.log('尝试使用getDisplayMedia API...');
                try {
                    const stream = await navigator.mediaDevices.getDisplayMedia({
                        video: {
                            mediaSource: 'screen',
                            width: { ideal: 1920 },
                            height: { ideal: 1080 }
                        }
                    });

                    const video = document.createElement('video');
                    video.srcObject = stream;
                    video.style.position = 'fixed';
                    video.style.top = '-9999px';
                    video.style.left = '-9999px';
                    video.style.opacity = '0';
                    video.style.pointerEvents = 'none';
                    document.body.appendChild(video);

                    return new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            console.error('getDisplayMedia超时');
                            // 清理资源
                            stream.getTracks().forEach(track => track.stop());
                            if (video.parentNode) {
                                document.body.removeChild(video);
                            }
                            resolve(null);
                        }, 10000); // 10秒超时

                        video.addEventListener('loadedmetadata', () => {
                            clearTimeout(timeout);
                            try {
                                const canvas = document.createElement('canvas');
                                canvas.width = video.videoWidth;
                                canvas.height = video.videoHeight;

                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(video, 0, 0);

                                // 清理资源
                                stream.getTracks().forEach(track => track.stop());
                                if (video.parentNode) {
                                    document.body.removeChild(video);
                                }

                                resolve(canvas.toDataURL('image/png'));
                            } catch (error) {
                                console.error('处理getDisplayMedia视频时出错:', error);
                                // 清理资源
                                stream.getTracks().forEach(track => track.stop());
                                if (video.parentNode) {
                                    document.body.removeChild(video);
                                }
                                resolve(null);
                            }
                        });

                        video.addEventListener('error', (error) => {
                            clearTimeout(timeout);
                            console.error('视频加载错误:', error);
                            // 清理资源
                            stream.getTracks().forEach(track => track.stop());
                            if (video.parentNode) {
                                document.body.removeChild(video);
                            }
                            resolve(null);
                        });

                        video.play().catch(error => {
                            clearTimeout(timeout);
                            console.error('视频播放失败:', error);
                            // 清理资源
                            stream.getTracks().forEach(track => track.stop());
                            if (video.parentNode) {
                                document.body.removeChild(video);
                            }
                            resolve(null);
                        });
                    });
                } catch (error) {
                    console.error('getDisplayMedia截图失败:', error);
                    // 检查是否是权限被拒绝
                    if (error.name === 'NotAllowedError') {
                        console.log('用户拒绝了屏幕共享权限');
                    }
                }
            }

            // 方法3: 简单的页面截图（仅可见区域）
            console.log('尝试简单页面截图...');
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 设置画布大小为视口大小
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;

                // 填充背景色
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // 添加文本说明
                ctx.fillStyle = '#333333';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('截图功能暂时不可用', canvas.width / 2, canvas.height / 2);
                ctx.fillText('请尝试刷新页面或重新加载扩展', canvas.width / 2, canvas.height / 2 + 30);

                return canvas.toDataURL('image/png');
            } catch (error) {
                console.error('简单截图失败:', error);
            }

            return null;
        } catch (error) {
            console.error('备用截图方法失败:', error);
            return null;
        }
    }

    // 使用Chrome API截图
    async captureVisibleTab() {
        return new Promise((resolve) => {
            console.log('发送截图请求到background script...');

            // 检查chrome API是否可用
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                console.error('Chrome API不可用');
                resolve(null);
                return;
            }

            // 设置超时处理
            const timeout = setTimeout(() => {
                console.error('截图请求超时');
                resolve(null);
            }, 10000); // 10秒超时

            chrome.runtime.sendMessage({
                action: 'captureVisibleTab'
            }, (response) => {
                clearTimeout(timeout);
                console.log('收到background script响应:', response);

                if (chrome.runtime.lastError) {
                    console.error('Chrome runtime错误:', chrome.runtime.lastError.message);
                    console.error('错误详情:', chrome.runtime.lastError);

                    // 检查是否是权限相关错误
                    if (chrome.runtime.lastError.message.includes('permission') ||
                        chrome.runtime.lastError.message.includes('denied') ||
                        chrome.runtime.lastError.message.includes('not allowed')) {
                        console.error('权限被拒绝，需要重新授权');
                    }

                    resolve(null);
                } else if (response && response.success) {
                    console.log('截图成功，数据URL长度:', response.dataUrl ? response.dataUrl.length : 0);
                    resolve(response.dataUrl);
                } else {
                    console.error('截图API调用失败:', response);
                    console.error('响应详情:', JSON.stringify(response, null, 2));
                    resolve(null);
                }
            });
        });
    }

    // 显示截图预览
    showScreenshotPreview(dataUrl) {
        // 创建截图预览模态框
        const modal = document.createElement('div');
        modal.id = 'screenshot-preview-modal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.8) !important;
            z-index: 2147483649 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            animation: fadeIn 0.3s ease-out !important;
        `;

        // 创建预览容器
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = `
            background: white !important;
            border-radius: 16px !important;
            padding: 20px !important;
            max-width: 90% !important;
            max-height: 90% !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
            position: relative !important;
            animation: scaleIn 0.3s ease-out !important;
        `;

        // 创建标题
        const title = document.createElement('h3');
        title.innerHTML = '📷 截图预览';
        title.style.cssText = `
            margin: 0 0 20px 0 !important;
            color: #333 !important;
            font-size: 18px !important;
            font-weight: 600 !important;
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
        `;

        // 创建图片预览
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = `
            max-width: 100% !important;
            max-height: 60vh !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
        `;

        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex !important;
            gap: 12px !important;
            margin-top: 20px !important;
            justify-content: center !important;
        `;

        // 保存按钮
        const saveButton = document.createElement('button');
        saveButton.innerHTML = '💾 保存图片';
        saveButton.style.cssText = `
            padding: 12px 24px !important;
            background: linear-gradient(135deg, #4CAF50, #45a049) !important;
            color: white !important;
            border: none !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
        `;
        saveButton.addEventListener('click', () => {
            this.downloadScreenshot(dataUrl);
            this.closeScreenshotPreview();
        });

        // 复制按钮
        const copyButton = document.createElement('button');
        copyButton.innerHTML = '📋 复制';
        copyButton.style.cssText = `
            padding: 12px 24px !important;
            background: linear-gradient(135deg, #2196F3, #1976D2) !important;
            color: white !important;
            border: none !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
        `;
        copyButton.addEventListener('click', async () => {
            try {
                // 将图片转换为blob
                const response = await fetch(dataUrl);
                const blob = await response.blob();

                // 复制到剪贴板
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
            } catch (error) {
                console.error('复制失败:', error);
                this.showScreenshotNotification('复制失败，请使用保存功能', 'error');
            }
        });

        // 关闭按钮
        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.cssText = `
            padding: 12px 24px !important;
            background: linear-gradient(135deg, #f44336, #d32f2f) !important;
            color: white !important;
            border: none !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
        `;
        closeButton.addEventListener('click', () => {
            this.closeScreenshotPreview();
        });

        // 添加悬停效果
        [saveButton, copyButton, closeButton].forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px)';
                button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = 'none';
            });
        });

        // 组装预览框
        buttonContainer.appendChild(saveButton);
        buttonContainer.appendChild(copyButton);
        buttonContainer.appendChild(closeButton);
        previewContainer.appendChild(title);
        previewContainer.appendChild(img);
        previewContainer.appendChild(buttonContainer);
        modal.appendChild(previewContainer);

        // 添加到页面
        document.body.appendChild(modal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeScreenshotPreview();
            }
        });

        // 添加动画样式
        if (!document.getElementById('screenshot-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'screenshot-modal-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // 关闭截图预览
    closeScreenshotPreview() {
        const modal = document.getElementById('screenshot-preview-modal');
        if (modal) {
            modal.style.animation = 'fadeIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }

    // 下载截图
    downloadScreenshot(dataUrl) {
        try {
            // 创建下载链接
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `screenshot_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.showScreenshotNotification('图片已保存到下载文件夹', 'success');
        } catch (error) {
            console.error('下载失败:', error);
            this.showScreenshotNotification('下载失败，请重试', 'error');
        }
    }

    // 显示通知
    showNotification(message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `pet-notification ${type}`;
        notification.textContent = message;

        const backgroundColor = type === 'error' ? '#f44336' :
                               type === 'info' ? '#2196F3' : '#4CAF50';

        notification.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: ${backgroundColor} !important;
            color: white !important;
            padding: 12px 20px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            z-index: 2147483650 !important;
            animation: slideInRight 0.3s ease-out !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
        `;

        // 添加动画样式
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // 3秒后移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    // 显示截图通知
    showScreenshotNotification(message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `screenshot-notification ${type}`;
        notification.textContent = message;

        const backgroundColor = type === 'error' ? '#f44336' :
                               type === 'info' ? '#2196F3' : '#4CAF50';

        notification.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: ${backgroundColor} !important;
            color: white !important;
            padding: 12px 20px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            z-index: 2147483650 !important;
            animation: slideInRight 0.3s ease-out !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
        `;

        // 添加动画样式
        if (!document.getElementById('screenshot-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'screenshot-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // 3秒后移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

}

// 初始化宠物管理器
const petManager = new PetManager();

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (petManager) {
        petManager.cleanup();
    }
});

// 页面隐藏时暂停某些功能
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('页面隐藏，暂停某些功能');
        // 可以在这里添加暂停逻辑
    } else {
        console.log('页面显示，恢复功能');
        // 可以在这里添加恢复逻辑
    }
});

console.log('Content Script 完成');













