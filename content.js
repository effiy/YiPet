/**
 * Chrome扩展Content Script
 * 负责在网页中创建和管理宠物
 */

console.log('Content Script 加载');

class PetManager {
    constructor() {
        this.pet = null;
        this.isVisible = true;
        this.colorIndex = 0;
        this.size = 80;
        this.position = { x: 20, y: 20 };
        
        this.colors = [
            'linear-gradient(135deg, #ff6b6b, #ff8e8e)', // 红色系
            'linear-gradient(135deg, #4ecdc4, #44a08d)', // 绿色系
            'linear-gradient(135deg, #ff9a9e, #fecfef)', // 粉色系
            'linear-gradient(135deg, #a8edea, #fed6e3)', // 蓝色系
            'linear-gradient(135deg, #ffecd2, #fcb69f)'  // 黄色系
        ];
        
        this.init();
    }
    
    init() {
        console.log('初始化宠物管理器');
        this.loadState(); // 加载保存的状态
        this.setupMessageListener();
        this.createPet();
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
            z-index: 2147483647 !important;
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
            console.log('宠物颜色设置为:', this.colorIndex);
        }
    }
    
    setSize(size) {
        this.size = Math.max(40, Math.min(120, size));
        this.updatePetStyle();
        this.saveState();
        console.log('宠物大小设置为:', this.size);
    }
    
    resetPosition() {
        this.position = { x: 20, y: 20 };
        this.updatePetStyle();
        this.saveState();
        console.log('宠物位置已重置');
    }
    
    centerPet() {
        const centerX = Math.max(0, (window.innerWidth - this.size) / 2);
        const centerY = Math.max(0, (window.innerHeight - this.size) / 2);
        this.position = { x: centerX, y: centerY };
        this.updatePetStyle();
        this.saveState();
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
            chrome.storage.sync.set({ petGlobalState: state }, () => {
                console.log('宠物全局状态已保存:', state);
            });
            
            // 同时保存到localStorage作为备用
            localStorage.setItem('petState', JSON.stringify(state));
        } catch (error) {
            console.log('保存状态失败:', error);
        }
    }
    
    loadState() {
        try {
            // 首先尝试从Chrome存储API加载全局状态
            chrome.storage.sync.get(['petGlobalState'], (result) => {
                if (result.petGlobalState) {
                    const state = result.petGlobalState;
                    this.isVisible = state.visible !== undefined ? state.visible : true;
                    this.colorIndex = state.color !== undefined ? state.color : 0;
                    this.size = state.size !== undefined ? state.size : 80;
                    this.position = state.position || { x: 20, y: 20 };
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
                if (namespace === 'sync' && changes.petGlobalState) {
                    const newState = changes.petGlobalState.newValue;
                    if (newState) {
                        this.isVisible = newState.visible !== undefined ? newState.visible : this.isVisible;
                        this.colorIndex = newState.color !== undefined ? newState.color : this.colorIndex;
                        this.size = newState.size !== undefined ? newState.size : this.size;
                        // 位置保持独立，不跨页面同步
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
                this.isVisible = state.visible !== undefined ? state.visible : true;
                this.colorIndex = state.color !== undefined ? state.color : 0;
                this.size = state.size !== undefined ? state.size : 80;
                this.position = state.position || { x: 20, y: 20 };
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
            // 更新全局状态（颜色、大小、可见性）
            this.isVisible = newState.visible !== undefined ? newState.visible : this.isVisible;
            this.colorIndex = newState.color !== undefined ? newState.color : this.colorIndex;
            this.size = newState.size !== undefined ? newState.size : this.size;
            // 位置保持独立，不跨页面同步
            
            console.log('处理全局状态更新:', newState);
            this.updatePetStyle();
        }
    }
}

// 初始化宠物管理器
const petManager = new PetManager();

console.log('Content Script 完成');

