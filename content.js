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
                    
                case 'getStatus':
                    sendResponse({
                        visible: this.isVisible,
                        color: this.colorIndex,
                        size: this.size,
                        position: this.position
                    });
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
                    const reply = this.generatePetResponse(request.message);
                    sendResponse({ success: true, reply: reply });
                    break;
                    
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
        console.log('宠物颜色切换为:', this.colorIndex);
    }
    
    setColor(colorIndex) {
        if (colorIndex >= 0 && colorIndex < this.colors.length) {
            this.colorIndex = colorIndex;
            this.updatePetStyle();
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
                        // 位置也进行跨页面同步，但会进行边界检查
                        if (newState.position) {
                            this.position = this.validatePosition(newState.position);
                        }
                        console.log('收到全局状态更新:', newState);
                        this.updatePetStyle();
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
                
                // 显示快捷键提示
                this.showScreenshotNotification('📷 快捷键截图已触发（F7）', 'info');
                return false;
            }
            
            // 检查是否按下了 F8 (打开聊天窗口快捷键)
            if (e.key === 'F8') {
                e.preventDefault();
                e.stopPropagation();
                console.log('检测到聊天快捷键 F8');
                
                if (this.isChatOpen) {
                    this.closeChatWindow();
                    this.showScreenshotNotification('💬 聊天窗口已关闭', 'info');
                } else {
                    this.openChatWindow();
                    this.showScreenshotNotification('💬 聊天窗口已打开', 'info');
                }
                return false;
            }
            
            // 检查是否按下了 Esc (关闭聊天窗口)
            if (e.key === 'Escape' && this.isChatOpen) {
                e.preventDefault();
                e.stopPropagation();
                this.closeChatWindow();
                this.showScreenshotNotification('💬 聊天窗口已关闭', 'info');
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
    
    // 生成宠物响应
    generatePetResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        // 问候语响应
        if (lowerMessage.includes('你好') || lowerMessage.includes('hi') || lowerMessage.includes('hello')) {
            return this.getRandomResponse([
                '你好！很高兴见到你！😊',
                '嗨！今天过得怎么样？✨',
                '你好呀！有什么想聊的吗？💕'
            ]);
        }
        
        // 感谢响应
        if (lowerMessage.includes('谢谢') || lowerMessage.includes('thank')) {
            return this.getRandomResponse([
                '不客气！我很乐意帮助你！💕',
                '不用谢！这是我应该做的！😊',
                '能帮到你我很开心！✨'
            ]);
        }
        
        // 告别响应
        if (lowerMessage.includes('再见') || lowerMessage.includes('bye') || lowerMessage.includes('拜拜')) {
            return this.getRandomResponse([
                '再见！期待下次和你聊天！👋',
                '拜拜！记得想我哦！💖',
                '再见啦！我会想你的！😊'
            ]);
        }
        
        // 情感响应
        if (lowerMessage.includes('爱') || lowerMessage.includes('love')) {
            return this.getRandomResponse([
                '我也爱你！💖',
                '你是我最爱的朋友！💕',
                '我也很爱你！这让我很开心！😊'
            ]);
        }
        
        if (lowerMessage.includes('开心') || lowerMessage.includes('happy') || lowerMessage.includes('高兴')) {
            return this.getRandomResponse([
                '我也很开心！😄',
                '看到你开心我也很开心！✨',
                '太好了！让我们一起开心吧！🎉'
            ]);
        }
        
        if (lowerMessage.includes('难过') || lowerMessage.includes('sad') || lowerMessage.includes('伤心')) {
            return this.getRandomResponse([
                '别难过，我会陪着你的！🤗',
                '抱抱你！一切都会好起来的！💕',
                '我在这里陪着你，不要难过！😊'
            ]);
        }
        
        if (lowerMessage.includes('累') || lowerMessage.includes('tired') || lowerMessage.includes('疲惫')) {
            return this.getRandomResponse([
                '好好休息一下吧！我会在这里等你的！😴',
                '累了就休息，身体最重要！💤',
                '休息好了再来找我玩吧！😊'
            ]);
        }
        
        // 夸奖响应
        if (lowerMessage.includes('棒') || lowerMessage.includes('好') || lowerMessage.includes('厉害')) {
            return this.getRandomResponse([
                '谢谢你的夸奖！你也很棒！🌟',
                '你这么说让我很开心！😊',
                '你也很厉害呢！💪'
            ]);
        }
        
        // 问题响应
        if (lowerMessage.includes('？') || lowerMessage.includes('?') || lowerMessage.includes('什么') || lowerMessage.includes('怎么')) {
            return this.getRandomResponse([
                '这是个很有趣的问题！让我想想...🤔',
                '嗯...我觉得这个问题很有意思！💭',
                '你问得很好！虽然我不太确定答案...😅'
            ]);
        }
        
        // 时间相关响应
        if (lowerMessage.includes('时间') || lowerMessage.includes('几点') || lowerMessage.includes('time')) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            return `现在的时间是 ${timeStr}！⏰`;
        }
        
        // 天气相关响应
        if (lowerMessage.includes('天气') || lowerMessage.includes('weather')) {
            return this.getRandomResponse([
                '今天的天气看起来不错呢！☀️',
                '希望今天是个好天气！🌤️',
                '天气好的时候心情也会很好！😊'
            ]);
        }
        
        // 学习相关响应
        if (lowerMessage.includes('学习') || lowerMessage.includes('study') || lowerMessage.includes('工作')) {
            return this.getRandomResponse([
                '学习加油！我相信你可以的！📚',
                '工作辛苦了！记得适当休息！💪',
                '努力的人最棒了！🌟'
            ]);
        }
        
        // 食物相关响应
        if (lowerMessage.includes('吃') || lowerMessage.includes('饿') || lowerMessage.includes('food')) {
            return this.getRandomResponse([
                '我也想吃好吃的！🍎',
                '记得按时吃饭哦！🍽️',
                '美食总是让人心情愉悦！😋'
            ]);
        }
        
        // 默认响应
        return this.getRandomResponse([
            '真的吗？太有趣了！😊',
            '哇，听起来很棒呢！✨',
            '我明白了，谢谢你告诉我！💕',
            '这让我很开心！😄',
            '你总是这么有趣！🎉',
            '我很喜欢和你聊天！💖',
            '这真是太棒了！🌟',
            '你让我学到了新东西！📚',
            '和你聊天总是让我很开心！😊',
            '谢谢你的分享！🙏',
            '听起来很有意思！🤔',
            '你真是个有趣的人！😄',
            '我很喜欢听你说话！💕',
            '这让我想起了美好的事情！✨',
            '你总是能让我开心！😊'
        ]);
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
    
    // 创建聊天窗口
    createChatWindow() {
        // 注意：chatWindowState 已在 openChatWindow() 中初始化
        
        // 创建聊天窗口容器
        this.chatWindow = document.createElement('div');
        this.chatWindow.id = 'pet-chat-window';
        this.updateChatWindowStyle();
        
        // 创建聊天头部（拖拽区域）
        const chatHeader = document.createElement('div');
        chatHeader.className = 'chat-header';
        chatHeader.style.cssText = `
            background: linear-gradient(135deg, #ff6b6b, #ff8e8e) !important;
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
            padding-bottom: 120px !important;
            overflow-y: auto !important;
            background: linear-gradient(135deg, #f8f9fa, #ffffff) !important;
            position: relative !important;
            max-height: calc(100% - 140px) !important;
            min-height: 200px !important;
        `;
        
        // 添加欢迎消息
        const welcomeMessage = this.createMessageElement('你好！我是你的小宠物，有什么想对我说的吗？', 'pet');
        messagesContainer.appendChild(welcomeMessage);
        
        // 创建输入区域
        const inputContainer = document.createElement('div');
        inputContainer.className = 'chat-input-container';
        inputContainer.style.cssText = `
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 20px !important;
            background: linear-gradient(135deg, #ffffff, #f8f9fa) !important;
            border-top: 2px solid #e8e8e8 !important;
            display: flex !important;
            gap: 12px !important;
            border-radius: 0 0 16px 16px !important;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.1) !important;
            backdrop-filter: blur(10px) !important;
            z-index: ${PET_CONFIG.ui.zIndex.inputContainer} !important;
        `;
        
        const messageInput = document.createElement('input');
        messageInput.type = 'text';
        messageInput.placeholder = PET_CONFIG.chatWindow.input.placeholder;
        messageInput.maxLength = PET_CONFIG.chatWindow.input.maxLength;
        messageInput.className = 'chat-message-input';
        messageInput.style.cssText = `
            flex: 1 !important;
            padding: 16px 20px !important;
            border: 2px solid #e0e0e0 !important;
            border-radius: 25px !important;
            font-size: 15px !important;
            font-weight: 400 !important;
            outline: none !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            background: rgba(255, 255, 255, 0.9) !important;
            backdrop-filter: blur(5px) !important;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.05) !important;
        `;
        messageInput.addEventListener('focus', () => {
            messageInput.style.borderColor = '#ff6b6b';
            messageInput.style.boxShadow = '0 0 0 3px rgba(255, 107, 107, 0.1), inset 0 2px 4px rgba(0,0,0,0.05)';
            messageInput.style.transform = 'scale(1.02)';
        });
        messageInput.addEventListener('blur', () => {
            messageInput.style.borderColor = '#e0e0e0';
            messageInput.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.05)';
            messageInput.style.transform = 'scale(1)';
        });
        
        const sendButton = document.createElement('button');
        sendButton.innerHTML = '发送';
        sendButton.className = 'chat-send-button';
        sendButton.style.cssText = `
            padding: 16px 24px !important;
            background: linear-gradient(135deg, #ff6b6b, #ff8e8e) !important;
            color: white !important;
            border: none !important;
            border-radius: 25px !important;
            font-size: 15px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3) !important;
            min-width: 80px !important;
            position: relative !important;
            overflow: hidden !important;
        `;
        
        // 添加按钮悬停效果
        sendButton.addEventListener('mouseenter', () => {
            sendButton.style.background = 'linear-gradient(135deg, #ff8e8e, #ff6b6b)';
            sendButton.style.transform = 'translateY(-2px) scale(1.05)';
            sendButton.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.4)';
        });
        sendButton.addEventListener('mouseleave', () => {
            sendButton.style.background = 'linear-gradient(135deg, #ff6b6b, #ff8e8e)';
            sendButton.style.transform = 'translateY(0) scale(1)';
            sendButton.style.boxShadow = '0 4px 15px rgba(255, 107, 107, 0.3)';
        });
        
        // 添加按钮点击效果
        sendButton.addEventListener('mousedown', () => {
            sendButton.style.transform = 'translateY(0) scale(0.98)';
        });
        sendButton.addEventListener('mouseup', () => {
            sendButton.style.transform = 'translateY(-2px) scale(1.05)';
        });
        
        // 发送消息功能
        const sendMessage = async () => {
            const message = messageInput.value.trim();
            if (!message) return;
            
            // 添加用户消息
            const userMessage = this.createMessageElement(message, 'user');
            messagesContainer.appendChild(userMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // 清空输入框
            messageInput.value = '';
            
            // 禁用发送按钮
            sendButton.disabled = true;
            sendButton.innerHTML = '发送中...';
            
            // 播放思考动画
            this.playChatAnimation();
            
            // 生成宠物响应
            setTimeout(() => {
                const reply = this.generatePetResponse(message);
                const petMessage = this.createMessageElement(reply, 'pet');
                messagesContainer.appendChild(petMessage);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                // 重新启用发送按钮
                sendButton.disabled = false;
                sendButton.innerHTML = '发送';
            }, PET_CONFIG.chatWindow.message.thinkingDelay.min + Math.random() * (PET_CONFIG.chatWindow.message.thinkingDelay.max - PET_CONFIG.chatWindow.message.thinkingDelay.min));
        };
        
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // 创建截图按钮
        const screenshotButton = document.createElement('button');
        screenshotButton.innerHTML = '📷';
        screenshotButton.className = 'chat-screenshot-button';
        screenshotButton.title = '截图';
        screenshotButton.style.cssText = `
            padding: 16px !important;
            background: linear-gradient(135deg, #4CAF50, #45a049) !important;
            color: white !important;
            border: none !important;
            border-radius: 25px !important;
            font-size: 18px !important;
            cursor: pointer !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3) !important;
            min-width: 50px !important;
            position: relative !important;
            overflow: hidden !important;
        `;
        
        // 添加截图按钮悬停效果
        screenshotButton.addEventListener('mouseenter', () => {
            screenshotButton.style.background = 'linear-gradient(135deg, #45a049, #4CAF50)';
            screenshotButton.style.transform = 'translateY(-2px) scale(1.05)';
            screenshotButton.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
        });
        screenshotButton.addEventListener('mouseleave', () => {
            screenshotButton.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
            screenshotButton.style.transform = 'translateY(0) scale(1)';
            screenshotButton.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.3)';
        });
        
        // 添加截图按钮点击效果
        screenshotButton.addEventListener('mousedown', () => {
            screenshotButton.style.transform = 'translateY(0) scale(0.98)';
        });
        screenshotButton.addEventListener('mouseup', () => {
            screenshotButton.style.transform = 'translateY(-2px) scale(1.05)';
        });
        
        // 截图功能
        screenshotButton.addEventListener('click', () => {
            // 添加点击反馈
            screenshotButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                screenshotButton.style.transform = 'translateY(-2px) scale(1.05)';
            }, 100);
            
            this.takeScreenshot();
        });
        
        // 添加截图按钮的长按提示
        let longPressTimer = null;
        screenshotButton.addEventListener('mousedown', () => {
            longPressTimer = setTimeout(() => {
                this.showScreenshotNotification('💡 提示：截图功能需要浏览器权限，如果失败请尝试刷新页面', 'info');
            }, 2000);
        });
        
        screenshotButton.addEventListener('mouseup', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
        
        screenshotButton.addEventListener('mouseleave', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });

        inputContainer.appendChild(messageInput);
        inputContainer.appendChild(screenshotButton);
        inputContainer.appendChild(sendButton);
        
        // 创建缩放手柄
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.style.cssText = `
            position: absolute !important;
            bottom: 0 !important;
            right: 0 !important;
            width: 20px !important;
            height: 20px !important;
            background: linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 70%, transparent 70%) !important;
            cursor: nw-resize !important;
            border-radius: 0 0 16px 0 !important;
            z-index: ${PET_CONFIG.ui.zIndex.resizeHandle} !important;
            transition: background 0.2s ease !important;
        `;
        
        // 添加缩放手柄的视觉提示
        resizeHandle.title = '拖拽调整大小';
        
        // 组装聊天窗口
        this.chatWindow.appendChild(chatHeader);
        this.chatWindow.appendChild(messagesContainer);
        this.chatWindow.appendChild(inputContainer);
        this.chatWindow.appendChild(resizeHandle);
        
        // 添加到页面
        document.body.appendChild(this.chatWindow);
        
        // 添加拖拽和缩放功能
        this.addChatWindowInteractions();
        
        // 添加滚动条样式
        this.addChatScrollbarStyles();
        
        // 初始化滚动功能
        this.initializeChatScroll();
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
    
    // 添加聊天窗口交互功能
    addChatWindowInteractions() {
        if (!this.chatWindow) return;
        
        const header = this.chatWindow.querySelector('.chat-header');
        const resizeHandle = this.chatWindow.querySelector('.resize-handle');
        
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
        
        // 缩放功能
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                this.chatWindowState.isResizing = true;
                this.chatWindowState.resizeStart = {
                    x: e.clientX,
                    y: e.clientY,
                    width: this.chatWindowState.width,
                    height: this.chatWindowState.height
                };
                
                // 添加缩放时的视觉反馈
                this.chatWindow.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)';
                resizeHandle.style.background = 'linear-gradient(-45deg, transparent 30%, #ff6b6b 30%, #ff6b6b 70%, transparent 70%)';
                
                e.preventDefault();
                e.stopPropagation();
            });
        }
        
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
                
                const newWidth = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.resizeStart.width + deltaX));
                const newHeight = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.resizeStart.height + deltaY));
                
                this.chatWindowState.width = newWidth;
                this.chatWindowState.height = newHeight;
                
                // 调整位置，确保不超出屏幕边界
                const maxX = window.innerWidth - newWidth;
                const maxY = window.innerHeight - newHeight;
                
                // 如果窗口会超出右边界，调整x位置
                if (this.chatWindowState.x + newWidth > window.innerWidth) {
                    this.chatWindowState.x = Math.max(0, maxX);
                }
                
                // 如果窗口会超出下边界，调整y位置
                if (this.chatWindowState.y + newHeight > window.innerHeight) {
                    this.chatWindowState.y = Math.max(0, maxY);
                }
                
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
                
                // 恢复缩放手柄的样式
                const resizeHandle = this.chatWindow.querySelector('.resize-handle');
                if (resizeHandle) {
                    resizeHandle.style.background = 'linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 70%, transparent 70%)';
                }
                
                // 恢复窗口阴影
                this.chatWindow.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
                
                // 重新初始化滚动功能
                this.initializeChatScroll();
                
                this.saveChatWindowState();
            }
        });
        
        // 悬停效果
        if (resizeHandle) {
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
        }
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
            isResizing: false
        };
        
        // 验证位置和大小
        this.chatWindowState.width = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.width));
        this.chatWindowState.height = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.height));
        this.chatWindowState.x = Math.max(0, Math.min(window.innerWidth - this.chatWindowState.width, this.chatWindowState.x));
        this.chatWindowState.y = Math.max(0, Math.min(window.innerHeight - this.chatWindowState.height, this.chatWindowState.y));
        
        console.log('聊天窗口状态已恢复:', this.chatWindowState);
    }
    
    // 创建消息元素
    createMessageElement(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            display: flex !important;
            margin-bottom: 15px !important;
            animation: messageSlideIn 0.3s ease-out !important;
        `;
        
        if (sender === 'user') {
            messageDiv.style.flexDirection = 'row-reverse';
        }
        
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
            background: ${sender === 'user' ? 'linear-gradient(135deg, #2196F3, #1976D2)' : 'linear-gradient(135deg, #ff6b6b, #ff8e8e)'} !important;
        `;
        avatar.textContent = sender === 'user' ? '👤' : '🐾';
        
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
            background: ${sender === 'user' ? 'linear-gradient(135deg, #2196F3, #1976D2)' : 'linear-gradient(135deg, #ff6b6b, #ff8e8e)'} !important;
            color: white !important;
            padding: 12px 16px !important;
            border-radius: 12px !important;
            font-size: 14px !important;
            line-height: 1.4 !important;
            word-wrap: break-word !important;
            position: relative !important;
            max-width: 80% !important;
            margin-left: ${sender === 'user' ? 'auto' : '0'} !important;
        `;
        
        if (sender === 'user') {
            messageText.style.borderBottomRightRadius = '4px';
        } else {
            messageText.style.borderBottomLeftRadius = '4px';
        }
        
        messageText.textContent = text;
        
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
            
            // 显示截图提示
            this.showScreenshotNotification('正在截图...', 'info');
            
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
        
        // 创建截图背景
        const screenshotBg = document.createElement('div');
        screenshotBg.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background-image: url(${dataUrl}) !important;
            background-size: contain !important;
            background-repeat: no-repeat !important;
            background-position: center !important;
            opacity: 0.7 !important;
        `;
        
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
        document.body.appendChild(overlay);
        
        let isSelecting = false;
        let startX = 0;
        let startY = 0;
        
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
            const img = new Image();
            img.src = dataUrl;
            
            img.onload = () => {
                // 计算缩放比例
                const scaleX = img.width / window.innerWidth;
                const scaleY = img.height / window.innerHeight;
                
                // 计算实际截图区域（考虑页面滚动）
                const actualX = (rect.left + window.scrollX) * scaleX;
                const actualY = (rect.top + window.scrollY) * scaleY;
                const actualWidth = rect.width * scaleX;
                const actualHeight = rect.height * scaleY;
                
                // 移除选择器
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                
                // 恢复聊天窗口和宠物显示
                this.restoreElements(originalChatDisplay, originalPetDisplay);
                
                // 裁剪图片
                this.cropAndDisplayScreenshot(dataUrl, actualX, actualY, actualWidth, actualHeight);
            };
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
            
            // 显示裁剪后的截图预览
            this.showScreenshotNotification('区域截图成功！', 'success');
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
                
                this.showScreenshotNotification('图片已复制到剪贴板！', 'success');
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

