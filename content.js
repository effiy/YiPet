/**
 * Chrome扩展Content Script
 * 负责在网页中创建和管理宠物
 */

console.log('Content Script 加载');

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
        
        // 尝试加载保存的聊天窗口状态
        this.loadChatWindowState();
        
        this.createChatWindow();
        this.isChatOpen = true;
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
        // 初始化聊天窗口状态
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
        
        inputContainer.appendChild(messageInput);
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
                ...this.chatWindowState,
                timestamp: Date.now()
            };
            
            // 保存到localStorage
            localStorage.setItem('petChatWindowState', JSON.stringify(state));
            console.log('聊天窗口状态已保存:', state);
        } catch (error) {
            console.log('保存聊天窗口状态失败:', error);
        }
    }
    
    // 加载聊天窗口状态
    loadChatWindowState() {
        try {
            const savedState = localStorage.getItem('petChatWindowState');
            if (savedState) {
                const state = JSON.parse(savedState);
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
                return true;
            }
        } catch (error) {
            console.log('恢复聊天窗口状态失败:', error);
        }
        return false;
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
}

// 初始化宠物管理器
const petManager = new PetManager();

console.log('Content Script 完成');

