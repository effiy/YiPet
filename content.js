/**
 * Chrome扩展Content Script
 * 负责在网页中创建和管理宠物
 */

console.log('Content Script 加载');

// 检查PET_CONFIG是否可用
if (typeof PET_CONFIG === 'undefined') {
    console.error('PET_CONFIG未定义，尝试重新加载config.js');
    
    // 创建默认配置作为备用
    window.PET_CONFIG = {
        pet: {
            defaultSize: 60,
            defaultColorIndex: 0,
            defaultVisible: true,
            colors: [
                'linear-gradient(135deg, #ff6b6b, #ff8e8e)',
                'linear-gradient(135deg, #4ecdc4, #44a08d)',
                'linear-gradient(135deg, #ff9a9e, #fecfef)',
                'linear-gradient(135deg, #a8edea, #fed6e3)',
                'linear-gradient(135deg, #ffecd2, #fcb69f)'
            ],
            sizeLimits: { min: 40, max: 120 }
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
        
        this.init();
    }
    
    init() {
        console.log('初始化宠物管理器');
        this.loadState(); // 加载保存的状态
        this.setupMessageListener();
        this.createPet();
        // 启动定期同步，确保状态一致性
        this.startPeriodicSync();
        
        // 添加键盘快捷键支持
        this.setupKeyboardShortcuts();
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
        
        // 添加眼睛
        const eyes = document.createElement('div');
        eyes.style.cssText = `
            position: absolute !important;
            top: 20px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 40px !important;
            height: 20px !important;
        `;
        
        const leftEye = document.createElement('div');
        leftEye.style.cssText = `
            position: absolute !important;
            left: 8px !important;
            width: 8px !important;
            height: 8px !important;
            background: #333 !important;
            border-radius: 50% !important;
        `;
        
        const rightEye = document.createElement('div');
        rightEye.style.cssText = `
            position: absolute !important;
            right: 8px !important;
            width: 8px !important;
            height: 8px !important;
            background: #333 !important;
            border-radius: 50% !important;
        `;
        
        eyes.appendChild(leftEye);
        eyes.appendChild(rightEye);
        this.pet.appendChild(eyes);
        
        // 添加嘴巴
        const mouth = document.createElement('div');
        mouth.style.cssText = `
            position: absolute !important;
            top: 35px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 12px !important;
            height: 6px !important;
            border: 2px solid #333 !important;
            border-top: none !important;
            border-radius: 0 0 12px 12px !important;
        `;
        this.pet.appendChild(mouth);
        
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
        
        this.pet.style.cssText = `
            position: fixed !important;
            top: ${this.position.y}px !important;
            left: ${this.position.x}px !important;
            width: ${this.size}px !important;
            height: ${this.size}px !important;
            background: ${this.colors[this.colorIndex]} !important;
            border-radius: 50% !important;
            z-index: ${PET_CONFIG.ui.zIndex.pet} !important;
            cursor: grab !important;
            pointer-events: auto !important;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2) !important;
            transition: all 0.3s ease !important;
            display: ${this.isVisible ? 'block' : 'none'} !important;
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
        
        this.pet.addEventListener('click', (e) => {
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
                    this.size = state.size !== undefined ? state.size : PET_CONFIG.pet.defaultSize;
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
                        this.size = newState.size !== undefined ? newState.size : this.size;
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
                this.size = state.size !== undefined ? state.size : PET_CONFIG.pet.defaultSize;
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
            this.size = newState.size !== undefined ? newState.size : this.size;
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
    
    // 根据当前网页信息生成欢迎消息
    async generateWelcomeMessage() {
        try {
            // 获取当前网页信息
            const pageTitle = document.title || '当前页面';
            const pageUrl = window.location.href;
            
            // 尝试获取页面描述
            const metaDescription = document.querySelector('meta[name="description"]');
            const pageDescription = metaDescription ? metaDescription.content : '';
            
            // 获取页面内容并转换为 Markdown
            let pageContent = this.getPageContentAsMarkdown();
            // 限制长度以免过长
            if (pageContent.length > 4090) {
                pageContent = pageContent.substring(0, 4090);
            }
            
            // 构建提示词，让大模型根据网页信息生成个性化的欢迎消息
            const systemPrompt = `你是一个可爱友好的宠物助手。根据用户当前浏览的网页信息，生成一段亲切、有趣的欢迎消息。要求：
1. 语气友好、活泼，像一个小宠物
2. 适当提及网页的主题或内容
3. 字数控制在1800字以内
4. 使用简单的表情符号增加趣味性`;

            const userPrompt = `用户正在浏览：
标题：${pageTitle}
网址：${pageUrl}
描述：${pageDescription}

页面内容（Markdown 格式）：
${pageContent ? pageContent : '无内容'}

请生成一段欢迎消息。`;
            
            console.log('调用大模型生成欢迎消息，页面标题:', pageTitle);
            
            // 调用大模型 API（使用流式接口）
            const apiUrl = PET_CONFIG.api.streamPromptUrl;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fromSystem: systemPrompt,
                    fromUser: userPrompt,
                    model: this.currentModel
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // 读取流式响应
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
                            
                            // 支持 Ollama 格式: chunk.message.content
                            if (chunk.message && chunk.message.content) {
                                fullContent += chunk.message.content;
                            }
                            // 支持旧的自定义格式: data.type === 'content'
                            else if (chunk.type === 'content') {
                                fullContent += chunk.data;
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
            
            if (fullContent && fullContent.trim()) {
                console.log('大模型生成的欢迎消息:', fullContent);
                return fullContent.trim();
            } else {
                // 如果API调用失败，使用备用消息
                return `你好！我注意到你正在浏览"${pageTitle}"，有什么想和我聊的吗？🐾`;
            }
            
        } catch (error) {
            console.log('生成欢迎消息失败:', error);
            // 使用备用消息
            const pageTitle = document.title || '当前页面';
            const fallbackMessages = [
                `你好！我看到你在浏览"${pageTitle}"，我是你的小宠物，有什么想聊的吗？🐾`,
                `嗨！你正在查看"${pageTitle}"呢，我是你的小伙伴，随时准备和你聊天哦~`,
            ];
            return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
        }
    }
    
    // 生成宠物响应（流式版本）
    async generatePetResponseStream(message, onContent) {
        try {
            // 获取页面完整正文内容并转换为 Markdown
            const fullPageMarkdown = this.getPageContentAsMarkdown();
            
            // 构建包含页面内容的完整消息
            const pageTitle = document.title || '当前页面';
            const pageUrl = window.location.href;
            
            // 如果页面内容不为空，将其添加到 fromUser
            let userMessage = message;
            if (fullPageMarkdown) {
                userMessage = `【当前页面上下文】\n页面标题：${pageTitle}\n页面链接：${pageUrl}\n\n页面内容（Markdown 格式）：\n${fullPageMarkdown}\n\n【用户问题】\n${message}`;
            }
            
            // 调用 API，使用配置中的 URL
            const apiUrl = PET_CONFIG.api.streamPromptUrl;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fromSystem: '你是一个可爱的宠物助手，友善、幽默，喜欢和用户聊天。',
                    fromUser: userMessage,
                    model: this.currentModel
                })
            });
            
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
                            
                            // 支持 Ollama 格式: chunk.message.content
                            if (chunk.message && chunk.message.content) {
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
            console.error('API 调用失败:', error);
            throw error;
        }
    }
    
    // 生成宠物响应（兼容旧版本）
    async generatePetResponse(message) {
        try {
            // 获取页面完整正文内容并转换为 Markdown
            const fullPageMarkdown = this.getPageContentAsMarkdown();
            
            // 构建包含页面内容的完整消息
            const pageTitle = document.title || '当前页面';
            const pageUrl = window.location.href;
            
            // 如果页面内容不为空，将其添加到 fromUser
            let userMessage = message;
            if (fullPageMarkdown) {
                userMessage = `【当前页面上下文】\n页面标题：${pageTitle}\n页面链接：${pageUrl}\n\n页面内容（Markdown 格式）：\n${fullPageMarkdown}\n\n【用户问题】\n${message}`;
            }
            
            // 调用 API，使用配置中的 URL
            const response = await fetch(PET_CONFIG.api.promptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fromSystem: '你是一个可爱的宠物助手，友善、幽默，喜欢和用户聊天。',
                    fromUser: userMessage
                })
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
            } else if (result.reply) {
                // 兼容旧格式
                return result.reply;
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
    openChatWindow() {
        if (this.chatWindow) {
            this.chatWindow.style.display = 'block';
            this.isChatOpen = true;
            
            // 重新初始化滚动功能
            this.initializeChatScroll();
            
            // 更新模型选择器显示
            this.updateChatModelSelector();
            
            // 更新聊天窗口颜色
            this.updateChatWindowColor();
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
        this.loadChatWindowState((success) => {
            if (success) {
                console.log('聊天窗口状态已加载，创建窗口');
            } else {
                console.log('使用默认聊天窗口状态，创建窗口');
            }
            
            this.createChatWindow();
            this.isChatOpen = true;
        });
    }
    
    // 关闭聊天窗口
    closeChatWindow() {
        if (this.chatWindow) {
            this.chatWindow.style.display = 'none';
            this.isChatOpen = false;
        }
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
    createChatWindow() {
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
        headerTitle.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
        `;
        headerTitle.innerHTML = `
            <span style="font-size: 20px;">🐾</span>
            <span style="font-weight: 600; font-size: 16px;">与宠物聊天</span>
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
        `;
        
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
        
        // 先显示一个默认的欢迎消息
        const welcomeMessage = this.createMessageElement('你好！我是你的小宠物，有什么想对我说的吗？', 'pet');
        messagesContainer.appendChild(welcomeMessage);
        
        // 然后异步生成个性化的欢迎消息并更新
        setTimeout(async () => {
            try {
                console.log('开始生成个性化欢迎消息...');
                
                // 添加超时处理，避免等待太久
                const welcomeText = await Promise.race([
                    this.generateWelcomeMessage(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('超时')), 10000)
                    )
                ]);
                
                console.log('准备更新欢迎消息为:', welcomeText);
                
                const messageText = welcomeMessage.querySelector('[data-message-type="pet-bubble"]');
                console.log('找到的消息元素:', messageText);
                
                if (messageText) {
                    // 使用 Markdown 渲染欢迎消息
                    messageText.innerHTML = this.renderMarkdown(welcomeText);
                    console.log('欢迎消息已更新');
                    
                    // 添加一个简单的更新动画
                    messageText.style.transition = 'opacity 0.3s';
                    messageText.style.opacity = '0.5';
                    setTimeout(() => {
                        messageText.style.opacity = '1';
                    }, 100);
                }
            } catch (error) {
                console.log('生成欢迎消息失败:', error);
                // 即使失败也保持默认消息，不需要更新
            }
        }, 500);
        
        // 创建输入区域 - 使用宠物颜色主题
        const inputContainer = document.createElement('div');
        inputContainer.className = 'chat-input-container';
        inputContainer.style.cssText = `
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 16px !important;
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
        
        // 创建 + 按钮（使用宠物颜色主题）
        const addButton = document.createElement('button');
        addButton.innerHTML = '+';
        addButton.title = '添加内容';
        addButton.style.cssText = `
            padding: 6px 12px !important;
            border-radius: 6px !important;
            background: white !important;
            color: ${mainColor} !important;
            border: 1px dashed ${mainColor} !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
        `;
        addButton.addEventListener('mouseenter', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            addButton.style.background = currentMainColor;
            addButton.style.color = 'white';
            addButton.style.borderColor = currentMainColor;
        });
        addButton.addEventListener('mouseleave', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            addButton.style.background = 'white';
            addButton.style.color = currentMainColor;
            addButton.style.borderColor = currentMainColor;
        });
        
        // 右侧状态组
        const rightStatusGroup = document.createElement('div');
        rightStatusGroup.style.cssText = `
            display: flex !important;
            gap: 8px !important;
            align-items: center !important;
        `;
        
        // 创建加载指示器占位（可扩展）
        const loadingSpinner = document.createElement('div');
        loadingSpinner.innerHTML = '⬜'; // 占位符，实际使用时可以替换为真正的加载动画
        loadingSpinner.style.cssText = `
            width: 16px !important;
            height: 16px !important;
            opacity: 0.5 !important;
            color: #ffffff !important;
        `;
        
        leftButtonGroup.appendChild(mentionButton);
        leftButtonGroup.appendChild(addButton);
        rightStatusGroup.appendChild(loadingSpinner);
        topToolbar.appendChild(leftButtonGroup);
        topToolbar.appendChild(rightStatusGroup);
        inputContainer.appendChild(topToolbar);
        
        // 创建输入框容器（暗色主题）
        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = `
            display: flex !important;
            gap: 8px !important;
            align-items: flex-start !important;
            position: relative !important;
        `;
        
        const messageInput = document.createElement('textarea');
        messageInput.placeholder = '输入消息... (Enter发送, Shift+Enter换行)';
        messageInput.maxLength = PET_CONFIG.chatWindow.input.maxLength;
        messageInput.className = 'chat-message-input';
        messageInput.rows = 2; // 初始2行
        messageInput.style.cssText = `
            flex: 1 !important;
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
            min-height: 36px !important;
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
            messageInput.style.height = messageInput.scrollHeight + 'px';
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
            
            // 添加用户消息
            const userMessage = this.createMessageElement(message, 'user');
            messagesContainer.appendChild(userMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // 清空输入框并重置高度
            messageInput.value = '';
            messageInput.style.height = '';
            // 强制重排以确保高度被正确重置
            void messageInput.offsetHeight;
            messageInput.style.height = '36px';
            
            // 更新输入状态
            updateInputState();
            
            // 播放思考动画
            this.playChatAnimation();
            
            // 创建宠物消息元素（用于流式更新）
            let petMessageElement = null;
            let fullContent = '';
            
            // 流式响应回调函数
            const onStreamContent = (chunk, accumulatedContent) => {
                if (!petMessageElement) {
                    // 创建消息元素
                    petMessageElement = this.createMessageElement('', 'pet');
                    messagesContainer.appendChild(petMessageElement);
                }
                
                // 更新消息内容 - 找到消息气泡元素并更新其文本（使用 Markdown 渲染）
                fullContent = accumulatedContent;
                const messageBubble = petMessageElement.querySelector('[data-message-type="pet-bubble"]');
                if (messageBubble) {
                    // 使用 renderMarkdown 渲染完整内容
                    messageBubble.innerHTML = this.renderMarkdown(fullContent);
                }
                
                // 自动滚动到底部
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            };
            
            // 生成宠物响应
            try {
                const reply = await this.generatePetResponseStream(message, onStreamContent);
                
                // 确保最终内容被显示（使用 Markdown 渲染）
                if (petMessageElement && fullContent !== reply) {
                    const messageBubble = petMessageElement.querySelector('[data-message-type="pet-bubble"]');
                    if (messageBubble) {
                        messageBubble.innerHTML = this.renderMarkdown(reply);
                    }
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            } catch (error) {
                console.error('生成回复失败:', error);
                
                // 如果已经创建了消息元素，更新错误信息（使用 innerHTML 以支持 Markdown）
                if (petMessageElement) {
                    const messageBubble = petMessageElement.querySelector('[data-message-type="pet-bubble"]');
                    if (messageBubble) {
                        messageBubble.innerHTML = '抱歉，发生了错误，请稍后再试。😔';
                    }
                } else {
                    const errorMessage = this.createMessageElement('抱歉，发生了错误，请稍后再试。😔', 'pet');
                    messagesContainer.appendChild(errorMessage);
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        };
        
        // 键盘事件处理：Enter发送，Shift+Enter换行，ESC清除
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                messageInput.value = '';
                messageInput.style.height = '';
                messageInput.style.height = '36px';
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
        
        // 右侧：上传按钮
        const rightBottomGroup = document.createElement('div');
        rightBottomGroup.style.cssText = `
            display: flex !important;
            gap: 6px !important;
            align-items: center !important;
        `;
        
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
        
        rightBottomGroup.appendChild(imageUploadButton);
        bottomToolbar.appendChild(rightBottomGroup);
        inputContainer.appendChild(bottomToolbar);
        
        // 将文件输入添加到容器
        inputContainer.appendChild(fileInput);
        
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
        
        // 组装聊天窗口
        this.chatWindow.appendChild(chatHeader);
        this.chatWindow.appendChild(messagesContainer);
        this.chatWindow.appendChild(inputContainer);
        this.chatWindow.appendChild(resizeHandleTL);
        this.chatWindow.appendChild(resizeHandleTR);
        this.chatWindow.appendChild(resizeHandleBL);
        this.chatWindow.appendChild(resizeHandleBR);
        
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
    
    // 渲染 Markdown 为 HTML
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
    
    // HTML 转义辅助函数
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            margin-left: ${sender === 'user' ? 'auto' : '0'} !important;
        `;
        
        // 为宠物消息添加 Markdown 样式
        if (sender === 'pet') {
            messageText.classList.add('markdown-content');
        }
        
        // 添加标识以便后续更新
        if (sender === 'pet') {
            messageText.setAttribute('data-message-type', 'pet-bubble');
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
                } else {
                    messageText.textContent = text;
                }
            }
        } else if (imageDataUrl) {
            // 如果没有文本只有图片，保持容器为空
            messageText.style.padding = '0';
        }
        
        const messageTime = document.createElement('div');
        messageTime.style.cssText = `
            font-size: 11px !important;
            color: #999 !important;
            margin-top: 4px !important;
            text-align: ${sender === 'user' ? 'right' : 'left'} !important;
        `;
        messageTime.textContent = this.getCurrentTime();
        
        content.appendChild(messageText);
        content.appendChild(messageTime);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        return messageDiv;
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
            
            #pet-chat-messages::-webkit-scrollbar {
                width: 6px;
            }
            
            #pet-chat-messages::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }
            
            #pet-chat-messages::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 3px;
            }
            
            #pet-chat-messages::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 播放聊天动画
    playChatAnimation() {
        if (!this.pet) return;
        
        // 添加思考动画
        this.pet.style.animation = 'none';
        setTimeout(() => {
            this.pet.style.animation = 'petThinking 1s ease-in-out';
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
        
        // 随机选择思考文本
        const thinkingTexts = [
            '让我想想...',
            '嗯...',
            '思考中...',
            '🤔',
            '💭',
            '✨'
        ];
        bubble.textContent = thinkingTexts[Math.floor(Math.random() * thinkingTexts.length)];
        
        this.pet.appendChild(bubble);
        
        // 2秒后移除气泡
        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.style.animation = 'bubbleAppear 0.3s ease-out reverse';
                setTimeout(() => {
                    if (bubble.parentNode) {
                        bubble.parentNode.removeChild(bubble);
                    }
                }, 300);
            }
        }, 2000);
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
                    <li>找到"可爱桌面宠物"扩展</li>
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

