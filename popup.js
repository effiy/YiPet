/**
 * Chrome扩展弹窗控制脚本
 */

class PopupController {
    constructor() {
        this.currentTab = null;
        this.petStatus = {
            visible: true,
            color: 0,
            size: 80,
            position: { x: 0, y: 0 }
        };
        
        this.init();
    }
    
    async init() {
        try {
            // 获取当前标签页
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];
            
            if (!this.currentTab) {
                console.error('无法获取当前标签页');
                this.showNotification('无法获取当前标签页，请刷新页面后重试', 'error');
                return;
            }
            
            console.log('当前标签页:', this.currentTab.id, this.currentTab.url);
            
            // 初始化UI
            this.setupEventListeners();
            
            // 检查content script状态
            const isContentScriptReady = await this.checkContentScriptStatus();
            if (!isContentScriptReady) {
                console.log('Content script 未就绪，等待...');
                this.showNotification('正在初始化，请稍候...', 'info');
                
                // 等待一段时间后重试
                setTimeout(async () => {
                    await this.loadPetStatus();
                    this.updateUI();
                }, 1000);
            } else {
                await this.loadPetStatus();
                this.updateUI();
            }
            
            // 定期同步状态，确保UI与宠物状态一致
            this.startStatusSync();
        } catch (error) {
            console.error('初始化失败:', error);
            this.showNotification('初始化失败，请刷新页面后重试', 'error');
        }
    }
    
    setupEventListeners() {
        // 切换显示/隐藏
        const toggleBtn = document.getElementById('toggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.togglePet();
            });
        }
        
        // 改变颜色
        const colorBtn = document.getElementById('colorBtn');
        if (colorBtn) {
            colorBtn.addEventListener('click', () => {
                this.changePetColor();
            });
        }
        
        // 大小滑块
        const sizeSlider = document.getElementById('sizeSlider');
        if (sizeSlider) {
            sizeSlider.addEventListener('input', (e) => {
                this.updatePetSize(parseInt(e.target.value));
            });
        }
        
        // 颜色选择
        const colorSelect = document.getElementById('colorSelect');
        if (colorSelect) {
            colorSelect.addEventListener('change', (e) => {
                this.setPetColor(parseInt(e.target.value));
            });
        }
        
        // 重置位置
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetPetPosition();
            });
        }
        
        // 居中显示
        const centerBtn = document.getElementById('centerBtn');
        if (centerBtn) {
            centerBtn.addEventListener('click', () => {
                this.centerPet();
            });
        }
    }
    
    async loadPetStatus() {
        try {
            console.log('尝试获取宠物状态...');
            
            // 首先尝试从Chrome存储API加载全局状态
            const globalState = await this.loadGlobalState();
            if (globalState) {
                this.petStatus = globalState;
                console.log('从全局存储加载状态:', globalState);
            } else {
                // 向content script发送消息获取宠物状态
                const response = await this.sendMessageToContentScript({ action: 'getStatus' });
                
                if (response && response.success !== false) {
                    console.log('成功获取宠物状态:', response);
                    this.petStatus = {
                        visible: response.visible !== undefined ? response.visible : true,
                        color: response.color !== undefined ? response.color : 0,
                        size: response.size !== undefined ? response.size : 80,
                        position: response.position || { x: 20, y: 20 }
                    };
                } else {
                    console.log('无法获取宠物状态，使用默认值');
                    // 如果无法获取状态，尝试初始化宠物
                    await this.initializePet();
                }
            }
        } catch (error) {
            console.log('获取宠物状态时出错:', error);
            // 如果无法获取状态，尝试初始化宠物
            await this.initializePet();
        }
    }
    
    async loadGlobalState() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['petGlobalState'], (result) => {
                if (result.petGlobalState) {
                    const state = result.petGlobalState;
                    resolve({
                        visible: state.visible !== undefined ? state.visible : true,
                        color: state.color !== undefined ? state.color : 0,
                        size: state.size !== undefined ? state.size : 80,
                        position: state.position || { x: 20, y: 20 }
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }
    
    async updateGlobalState() {
        return new Promise((resolve) => {
            const globalState = {
                visible: this.petStatus.visible,
                color: this.petStatus.color,
                size: this.petStatus.size,
                position: this.petStatus.position,
                timestamp: Date.now()
            };
            
            chrome.storage.sync.set({ petGlobalState: globalState }, () => {
                console.log('全局状态已更新:', globalState);
                resolve();
            });
        });
    }
    
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
    
    async checkContentScriptStatus() {
        try {
            console.log('检查content script状态...');
            const response = await this.sendMessageToContentScript({ action: 'ping' });
            return response !== null;
        } catch (error) {
            console.log('Content script 未响应:', error);
            return false;
        }
    }
    
    updateUI() {
        // 更新切换按钮
        const toggleBtn = document.getElementById('toggleBtn');
        if (toggleBtn) {
            const btnText = toggleBtn.querySelector('.btn-text');
            const btnIcon = toggleBtn.querySelector('.btn-icon');
            
            if (btnText && btnIcon) {
                if (this.petStatus.visible) {
                    btnText.textContent = '隐藏宠物';
                    btnIcon.textContent = '👁️';
                } else {
                    btnText.textContent = '显示宠物';
                    btnIcon.textContent = '🙈';
                }
            }
        }
        
        // 更新大小滑块
        const sizeSlider = document.getElementById('sizeSlider');
        const sizeValue = document.getElementById('sizeValue');
        if (sizeSlider) {
            sizeSlider.value = this.petStatus.size;
        }
        if (sizeValue) {
            sizeValue.textContent = this.petStatus.size;
        }
        
        // 更新颜色选择
        const colorSelect = document.getElementById('colorSelect');
        if (colorSelect) {
            colorSelect.value = this.petStatus.color;
        }
        
        // 更新状态指示器
        this.updateStatusIndicator();
    }
    
    updateStatusIndicator() {
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            const statusText = statusIndicator.querySelector('.status-text');
            const statusDot = statusIndicator.querySelector('.status-dot');
            
            if (statusText && statusDot) {
                if (this.petStatus.visible) {
                    statusText.textContent = '已激活';
                    statusDot.style.background = '#4CAF50';
                } else {
                    statusText.textContent = '已隐藏';
                    statusDot.style.background = '#FF9800';
                }
            }
        }
    }
    
    async sendMessageToContentScript(message, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`发送消息到content script (尝试 ${i + 1}/${retries}):`, message);
                
                // 通过background script转发消息
                const response = await chrome.runtime.sendMessage({
                    action: 'forwardToContentScript',
                    tabId: this.currentTab.id,
                    message: message
                });
                
                console.log('收到响应:', response);
                return response;
            } catch (error) {
                console.log(`通信失败 (尝试 ${i + 1}/${retries}):`, error.message);
                
                if (i === retries - 1) {
                    // 最后一次尝试失败
                    console.error('所有通信尝试都失败了');
                    return null;
                }
                
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
            }
        }
        return null;
    }
    
    async togglePet() {
        this.setButtonLoading('toggleBtn', true);
        
        try {
            console.log('切换宠物可见性...');
            const response = await this.sendMessageToContentScript({ action: 'toggleVisibility' });
            
            if (response && response.success) {
                this.petStatus.visible = response.visible !== undefined ? response.visible : !this.petStatus.visible;
                
                // 更新全局状态
                await this.updateGlobalState();
                
                this.updateUI();
                this.showNotification(this.petStatus.visible ? '宠物已显示' : '宠物已隐藏');
                console.log('宠物状态切换成功:', this.petStatus.visible);
            } else {
                console.log('切换宠物状态失败，响应:', response);
                this.showNotification('操作失败，请刷新页面后重试', 'error');
            }
        } catch (error) {
            console.error('切换宠物状态时出错:', error);
            this.showNotification('操作失败，请刷新页面后重试', 'error');
        } finally {
            this.setButtonLoading('toggleBtn', false);
        }
    }
    
    async changePetColor() {
        this.setButtonLoading('colorBtn', true);
        
        try {
            const response = await this.sendMessageToContentScript({ action: 'changeColor' });
            if (response && response.success) {
                this.petStatus.color = (this.petStatus.color + 1) % 5;
                this.updateUI();
                this.showNotification('颜色已更换');
            } else {
                this.showNotification('操作失败，请刷新页面后重试', 'error');
            }
        } catch (error) {
            this.showNotification('操作失败，请刷新页面后重试', 'error');
        } finally {
            this.setButtonLoading('colorBtn', false);
        }
    }
    
    async setPetColor(colorIndex) {
        this.petStatus.color = colorIndex;
        
        try {
            // 更新全局状态
            await this.updateGlobalState();
            
            const response = await this.sendMessageToContentScript({ 
                action: 'setColor', 
                color: colorIndex 
            });
            if (response && response.success) {
                this.showNotification('颜色主题已设置');
                // 更新UI状态
                this.updateUI();
            } else {
                this.showNotification('操作失败，请刷新页面后重试', 'error');
            }
        } catch (error) {
            this.showNotification('操作失败，请刷新页面后重试', 'error');
        }
    }
    
    async updatePetSize(newSize) {
        this.petStatus.size = newSize;
        const sizeValue = document.getElementById('sizeValue');
        if (sizeValue) {
            sizeValue.textContent = newSize;
        }
        
        try {
            // 更新全局状态
            await this.updateGlobalState();
            
            const response = await this.sendMessageToContentScript({ 
                action: 'changeSize', 
                size: newSize 
            });
            if (response && response.success) {
                // 大小更新成功，更新UI状态
                this.updateUI();
            } else {
                this.showNotification('大小设置失败', 'error');
            }
        } catch (error) {
            this.showNotification('大小设置失败', 'error');
        }
    }
    
    async resetPetPosition() {
        this.setButtonLoading('resetBtn', true);
        
        try {
            const response = await this.sendMessageToContentScript({ action: 'resetPosition' });
            if (response && response.success) {
                this.petStatus.position = { x: 20, y: 20 };
                this.updateUI();
                this.showNotification('位置已重置');
            } else {
                this.showNotification('操作失败，请刷新页面后重试', 'error');
            }
        } catch (error) {
            this.showNotification('操作失败，请刷新页面后重试', 'error');
        } finally {
            this.setButtonLoading('resetBtn', false);
        }
    }
    
    async centerPet() {
        this.setButtonLoading('centerBtn', true);
        
        try {
            const response = await this.sendMessageToContentScript({ action: 'centerPet' });
            if (response && response.success) {
                // 从content script获取实际的位置信息
                const statusResponse = await this.sendMessageToContentScript({ action: 'getStatus' });
                if (statusResponse && statusResponse.position) {
                    this.petStatus.position = statusResponse.position;
                }
                this.updateUI();
                this.showNotification('宠物已居中');
            } else {
                this.showNotification('操作失败，请刷新页面后重试', 'error');
            }
        } catch (error) {
            this.showNotification('操作失败，请刷新页面后重试', 'error');
        } finally {
            this.setButtonLoading('centerBtn', false);
        }
    }
    
    setButtonLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        if (button) {
            if (loading) {
                button.classList.add('loading');
                button.disabled = true;
            } else {
                button.classList.remove('loading');
                button.disabled = false;
            }
        }
    }
    
    startStatusSync() {
        // 监听Chrome存储变化，实现跨页面同步
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.petGlobalState) {
                const newState = changes.petGlobalState.newValue;
                if (newState) {
                    // 更新本地状态（颜色和大小同步，位置保持独立）
                    this.petStatus.visible = newState.visible !== undefined ? newState.visible : this.petStatus.visible;
                    this.petStatus.color = newState.color !== undefined ? newState.color : this.petStatus.color;
                    this.petStatus.size = newState.size !== undefined ? newState.size : this.petStatus.size;
                    // 位置保持独立，不跨页面同步
                    
                    console.log('收到全局状态更新:', newState);
                    this.updateUI();
                }
            }
        });
        
        // 每5秒同步一次状态（作为备用）
        this.statusSyncInterval = setInterval(async () => {
            try {
                const response = await this.sendMessageToContentScript({ action: 'getStatus' });
                if (response && response.success !== false) {
                    // 更新本地状态
                    this.petStatus.visible = response.visible !== undefined ? response.visible : this.petStatus.visible;
                    this.petStatus.color = response.color !== undefined ? response.color : this.petStatus.color;
                    this.petStatus.size = response.size !== undefined ? response.size : this.petStatus.size;
                    this.petStatus.position = response.position || this.petStatus.position;
                    
                    // 更新UI
                    this.updateUI();
                }
            } catch (error) {
                // 静默处理同步错误
                console.log('状态同步失败:', error);
            }
        }, 5000);
    }
    
    stopStatusSync() {
        if (this.statusSyncInterval) {
            clearInterval(this.statusSyncInterval);
            this.statusSyncInterval = null;
        }
    }
    
    showNotification(message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        const backgroundColor = type === 'error' ? '#f44336' : 
                               type === 'info' ? '#2196F3' : '#4CAF50';
        
        notification.style.cssText = `
            position: fixed;
            top: 10px;
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
        
        // 添加动画样式
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
        
        if (document.body) {
            document.body.appendChild(notification);
        }
        
        // 3秒后移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// 页面加载完成后初始化
let popupController;
document.addEventListener('DOMContentLoaded', () => {
    popupController = new PopupController();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (popupController) {
        popupController.stopStatusSync();
    }
});

