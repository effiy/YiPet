// Popup入口脚本
import { createPopupModule } from './index.js';

class PopupController {
    constructor() {
        this.popupModule = null;
        this.initialized = false;
        this.elements = {};
    }

    async init() {
        try {
            console.log('初始化Popup控制器...');
            
            // 获取DOM元素
            this.elements = {
                loading: document.getElementById('loading'),
                content: document.getElementById('content'),
                error: document.getElementById('error'),
                petStatus: document.getElementById('pet-status'),
                petMood: document.getElementById('pet-mood'),
                petActivity: document.getElementById('pet-activity'),
                screenshotBtn: document.getElementById('screenshot-btn'),
                chatBtn: document.getElementById('chat-btn'),
                mermaidBtn: document.getElementById('mermaid-btn'),
                faqBtn: document.getElementById('faq-btn'),
                togglePetBtn: document.getElementById('toggle-pet-btn'),
                settingsBtn: document.getElementById('settings-btn'),
                aboutBtn: document.getElementById('about-btn'),
                logoutBtn: document.getElementById('logout-btn')
            };

            // 验证所有元素
            const missingElements = Object.entries(this.elements)
                .filter(([key, element]) => !element)
                .map(([key]) => key);
            
            if (missingElements.length > 0) {
                throw new Error(`缺少必要的DOM元素: ${missingElements.join(', ')}`);
            }

            // 初始化Popup模块
            this.popupModule = createPopupModule();
            await this.popupModule.init();
            
            // 绑定事件
            this.bindEvents();
            
            // 加载初始状态
            await this.loadInitialState();
            
            // 显示内容
            this.showContent();
            
            this.initialized = true;
            console.log('Popup控制器初始化完成');
            
        } catch (error) {
            console.error('Popup控制器初始化失败:', error);
            this.showError(`初始化失败: ${error.message}`);
        }
    }

    bindEvents() {
        // 功能按钮事件
        this.elements.screenshotBtn.addEventListener('click', () => this.handleScreenshot());
        this.elements.chatBtn.addEventListener('click', () => this.handleChat());
        this.elements.mermaidBtn.addEventListener('click', () => this.handleMermaid());
        this.elements.faqBtn.addEventListener('click', () => this.handleFAQ());
        
        // 控制按钮事件
        this.elements.togglePetBtn.addEventListener('click', () => this.handleTogglePet());
        this.elements.settingsBtn.addEventListener('click', () => this.handleSettings());
        this.elements.aboutBtn.addEventListener('click', () => this.handleAbout());
        this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
        
        console.log('事件绑定完成');
    }

    async loadInitialState() {
        try {
            // 从Chrome存储获取状态
            const result = await chrome.storage.local.get(['petState', 'userPreferences']);
            
            if (result.petState) {
                this.updatePetStatus(result.petState);
            }
            
            console.log('初始状态加载完成');
        } catch (error) {
            console.warn('加载初始状态失败:', error);
            // 使用默认状态
            this.updatePetStatus({
                status: 'online',
                mood: '开心',
                activity: '高'
            });
        }
    }

    updatePetStatus(state) {
        if (this.elements.petStatus) {
            this.elements.petStatus.textContent = this.getStatusText(state.status);
            this.elements.petStatus.className = `status-value ${state.status}`;
        }
        
        if (this.elements.petMood) {
            this.elements.petMood.textContent = state.mood || '开心';
        }
        
        if (this.elements.petActivity) {
            this.elements.petActivity.textContent = state.activity || '高';
        }
    }

    getStatusText(status) {
        const statusMap = {
            'online': '在线',
            'offline': '离线',
            'sleeping': '休息中',
            'playing': '玩耍中'
        };
        return statusMap[status] || '未知';
    }

    async handleScreenshot() {
        try {
            console.log('触发截图功能');
            
            // 发送消息到background脚本
            const response = await chrome.runtime.sendMessage({
                action: 'startScreenshot',
                type: 'area'
            });
            
            if (response && response.success) {
                this.showNotification('截图模式已启动，请选择区域');
                window.close(); // 关闭弹窗
            } else {
                throw new Error(response?.error || '截图启动失败');
            }
        } catch (error) {
            console.error('截图功能失败:', error);
            this.showError(`截图失败: ${error.message}`);
        }
    }

    async handleChat() {
        try {
            console.log('触发聊天功能');
            
            // 获取当前标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('无法获取当前标签页');
            }
            
            // 发送消息到content脚本
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'openChat',
                source: 'popup'
            });
            
            if (response && response.success) {
                this.showNotification('聊天窗口已打开');
                window.close();
            } else {
                throw new Error(response?.error || '聊天窗口打开失败');
            }
        } catch (error) {
            console.error('聊天功能失败:', error);
            
            // 如果content脚本未加载，尝试注入
            if (error.message.includes('Receiving end does not exist')) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['src/content/chat.js']
                    });
                    
                    // 重试发送消息
                    const retryResponse = await chrome.tabs.sendMessage(tab.id, {
                        action: 'openChat',
                        source: 'popup'
                    });
                    
                    if (retryResponse && retryResponse.success) {
                        this.showNotification('聊天窗口已打开');
                        window.close();
                    } else {
                        throw new Error('聊天功能初始化失败');
                    }
                } catch (injectError) {
                    this.showError(`聊天功能初始化失败: ${injectError.message}`);
                }
            } else {
                this.showError(`聊天失败: ${error.message}`);
            }
        }
    }

    async handleMermaid() {
        try {
            console.log('触发流程图功能');
            
            // 获取当前标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('无法获取当前标签页');
            }
            
            // 创建新标签页打开流程图工具
            await chrome.tabs.create({
                url: chrome.runtime.getURL('src/pages/mermaid/index.html')
            });
            
            this.showNotification('流程图工具已打开');
            window.close();
        } catch (error) {
            console.error('流程图功能失败:', error);
            this.showError(`流程图功能失败: ${error.message}`);
        }
    }

    async handleFAQ() {
        try {
            console.log('触发帮助功能');
            
            // 创建新标签页打开帮助页面
            await chrome.tabs.create({
                url: chrome.runtime.getURL('src/pages/faq/index.html')
            });
            
            this.showNotification('帮助页面已打开');
            window.close();
        } catch (error) {
            console.error('帮助功能失败:', error);
            this.showError(`帮助功能失败: ${error.message}`);
        }
    }

    async handleTogglePet() {
        try {
            console.log('触发显示/隐藏伴侣功能');
            
            // 获取当前伴侣状态
            const result = await chrome.storage.local.get(['petVisibility']);
            const currentVisibility = result.petVisibility !== false; // 默认显示
            const newVisibility = !currentVisibility;
            
            // 保存新状态
            await chrome.storage.local.set({ petVisibility: newVisibility });
            
            // 发送消息到所有标签页
            const tabs = await chrome.tabs.query({});
            const promises = tabs.map(tab => 
                chrome.tabs.sendMessage(tab.id, {
                    action: 'togglePetVisibility',
                    visible: newVisibility
                }).catch(err => console.warn(`标签页 ${tab.id} 消息发送失败:`, err))
            );
            
            await Promise.allSettled(promises);
            
            this.showNotification(newVisibility ? '伴侣已显示' : '伴侣已隐藏');
            this.elements.togglePetBtn.textContent = newVisibility ? '👻 隐藏伴侣' : '🐱 显示伴侣';
            
        } catch (error) {
            console.error('切换伴侣显示失败:', error);
            this.showError(`切换失败: ${error.message}`);
        }
    }

    async handleSettings() {
        try {
            console.log('触发设置功能');
            
            // 创建新标签页打开设置页面
            await chrome.tabs.create({
                url: chrome.runtime.getURL('src/pages/options/index.html')
            });
            
            this.showNotification('设置页面已打开');
            window.close();
        } catch (error) {
            console.error('设置功能失败:', error);
            this.showError(`设置功能失败: ${error.message}`);
        }
    }

    async handleAbout() {
        try {
            console.log('触发关于功能');
            
            // 创建新标签页打开关于页面
            await chrome.tabs.create({
                url: chrome.runtime.getURL('src/pages/about/index.html')
            });
            
            this.showNotification('关于页面已打开');
            window.close();
        } catch (error) {
            console.error('关于功能失败:', error);
            this.showError(`关于功能失败: ${error.message}`);
        }
    }

    async handleLogout() {
        try {
            console.log('触发退出登录功能');
            
            if (confirm('确定要退出登录吗？这将清除您的所有本地数据。')) {
                // 清除所有本地存储
                await chrome.storage.local.clear();
                await chrome.storage.sync.clear();
                
                // 发送退出登录消息
                const tabs = await chrome.tabs.query({});
                const promises = tabs.map(tab => 
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'logout'
                    }).catch(err => console.warn(`标签页 ${tab.id} 消息发送失败:`, err))
                );
                
                await Promise.allSettled(promises);
                
                this.showNotification('已成功退出登录');
                window.close();
            }
        } catch (error) {
            console.error('退出登录失败:', error);
            this.showError(`退出登录失败: ${error.message}`);
        }
    }

    showContent() {
        if (this.elements.loading) {
            this.elements.loading.classList.add('hidden');
        }
        if (this.elements.content) {
            this.elements.content.classList.remove('hidden');
        }
        if (this.elements.error) {
            this.elements.error.classList.add('hidden');
        }
    }

    showError(message) {
        if (this.elements.error) {
            this.elements.error.textContent = message;
            this.elements.error.classList.remove('hidden');
        }
        if (this.elements.loading) {
            this.elements.loading.classList.add('hidden');
        }
    }

    showNotification(message) {
        // 简单的通知显示
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(76, 175, 80, 0.9);
            color: white;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 1000;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// 初始化控制器
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const controller = new PopupController();
        await controller.init();
    } catch (error) {
        console.error('Popup初始化失败:', error);
        document.getElementById('loading').innerHTML = `
            <div class="error-message">
                初始化失败: ${error.message}
            </div>
        `;
    }
});