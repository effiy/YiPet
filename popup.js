/**
 * Chrome扩展弹窗控制脚本
 */

(function() {
    try {
        // 检查 chrome.storage 是否可用
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.runtime) {
            return;
        }
        
        // 检查扩展上下文是否有效
        try {
            if (!chrome.runtime.id) {
                return;
            }
        } catch (error) {
            // 扩展上下文已失效
            return;
        }
        
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
            if (chrome.runtime.lastError) {
                // 忽略错误，使用默认值
                muteIfNeeded(defaultEnabled);
                return;
            }
            const enabled = res[keyName];
            muteIfNeeded(typeof enabled === 'boolean' ? enabled : defaultEnabled);
        });
        
        chrome.storage.onChanged.addListener((changes, namespace) => {
            try {
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
            } catch (error) {
                // 静默处理错误
            }
        });
    } catch (e) {
        // 静默处理初始化错误
    }
})();

class PopupController {
    constructor() {
        this.currentTab = null;
        this.petStatus = {
            visible: false,
            color: 0,
            size: 180,
            position: { x: 0, y: 0 },
            role: '教师' // 默认角色
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
        
        // 角色选择
        const roleSelect = document.getElementById('roleSelect');
        if (roleSelect) {
            roleSelect.addEventListener('change', (e) => {
                this.setPetRole(e.target.value);
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
                        visible: response.visible !== undefined ? response.visible : false,
                        color: response.color !== undefined ? response.color : 0,
                        size: response.size !== undefined ? response.size : 180,
                        position: response.position || getPetDefaultPosition(),
                        role: response.role || '教师'
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
            // 检查 chrome.storage 是否可用
            const isChromeStorageAvailable = () => {
                try {
                    return typeof chrome !== 'undefined' && 
                           chrome.storage && 
                           chrome.storage.local && 
                           chrome.runtime && 
                           chrome.runtime.id;
                } catch (error) {
                    return false;
                }
            };
            
            if (!isChromeStorageAvailable()) {
                console.debug('扩展上下文已失效，从localStorage加载');
                try {
                    const localValue = localStorage.getItem('petGlobalState');
                    if (localValue) {
                        const state = JSON.parse(localValue);
                        resolve({
                            visible: state.visible !== undefined ? state.visible : false,
                            color: state.color !== undefined ? state.color : 0,
                            size: state.size !== undefined ? state.size : 180,
                            position: state.position || getPetDefaultPosition(),
                            role: state.role || '教师'
                        });
                    } else {
                        resolve(null);
                    }
                } catch (error) {
                    console.warn('从localStorage加载失败:', error);
                    resolve(null);
                }
                return;
            }
            
            // 优先从 local 存储加载
            chrome.storage.local.get(['petGlobalState'], (result) => {
                if (chrome.runtime.lastError) {
                    console.debug('从chrome.storage.local加载失败，尝试localStorage');
                    try {
                        const localValue = localStorage.getItem('petGlobalState');
                        if (localValue) {
                            const state = JSON.parse(localValue);
                            resolve({
                                visible: state.visible !== undefined ? state.visible : false,
                                color: state.color !== undefined ? state.color : 0,
                                size: state.size !== undefined ? state.size : 180,
                                position: state.position || getPetDefaultPosition(),
                                role: state.role || '教师'
                            });
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        console.warn('从localStorage加载失败:', error);
                        resolve(null);
                    }
                    return;
                }
                
                if (result.petGlobalState) {
                    const state = result.petGlobalState;
                    resolve({
                        visible: state.visible !== undefined ? state.visible : false,
                        color: state.color !== undefined ? state.color : 0,
                        size: state.size !== undefined ? state.size : 180,
                        position: state.position || getPetDefaultPosition(),
                        role: state.role || '教师'
                    });
                } else {
                    // 如果 local 中没有，尝试从 sync 加载（兼容旧版本）
                    chrome.storage.sync.get(['petGlobalState'], (syncResult) => {
                        if (chrome.runtime.lastError) {
                            console.debug('从chrome.storage.sync加载失败，尝试localStorage');
                            try {
                                const localValue = localStorage.getItem('petGlobalState');
                                if (localValue) {
                                    const state = JSON.parse(localValue);
                            resolve({
                                visible: state.visible !== undefined ? state.visible : false,
                                color: state.color !== undefined ? state.color : 0,
                                size: state.size !== undefined ? state.size : 180,
                                position: state.position || getPetDefaultPosition(),
                                role: state.role || '教师'
                            });
                                } else {
                                    resolve(null);
                                }
                            } catch (error) {
                                console.warn('从localStorage加载失败:', error);
                                resolve(null);
                            }
                            return;
                        }
                        
                        if (syncResult.petGlobalState) {
                            const state = syncResult.petGlobalState;
                            resolve({
                                visible: state.visible !== undefined ? state.visible : false,
                                color: state.color !== undefined ? state.color : 0,
                                size: state.size !== undefined ? state.size : 180,
                                position: state.position || getPetDefaultPosition(),
                                role: state.role || '教师'
                            });
                        } else {
                            resolve(null);
                        }
                    });
                }
            });
        });
    }
    
    async updateGlobalState() {
        return new Promise(async (resolve) => {
            const globalState = {
                visible: this.petStatus.visible,
                color: this.petStatus.color,
                size: this.petStatus.size,
                position: this.petStatus.position,
                role: this.petStatus.role || '教师',
                timestamp: Date.now()
            };
            
            // 检查 chrome.storage 是否可用
            const isChromeStorageAvailable = () => {
                try {
                    return typeof chrome !== 'undefined' && 
                           chrome.storage && 
                           chrome.storage.local && 
                           chrome.runtime && 
                           chrome.runtime.id;
                } catch (error) {
                    return false;
                }
            };
            
            // 检查是否是扩展上下文失效错误
            const isContextInvalidatedError = (error) => {
                if (!error) return false;
                const errorMsg = (error.message || error.toString() || '').toLowerCase();
                return errorMsg.includes('extension context invalidated') ||
                       errorMsg.includes('context invalidated');
            };
            
            // 检查是否是配额错误
            const isQuotaError = (error) => {
                if (!error) return false;
                const errorMsg = error.message || error.toString();
                return errorMsg.includes('QUOTA_BYTES') || 
                       errorMsg.includes('quota exceeded') ||
                       errorMsg.includes('MAX_WRITE_OPERATIONS') ||
                       errorMsg.includes('QUOTA_BYTES_PER_HOUR');
            };
            
            // 如果 chrome.storage 不可用，直接使用 localStorage
            if (!isChromeStorageAvailable()) {
                console.debug('扩展上下文已失效，使用localStorage保存');
                try {
                    localStorage.setItem('petGlobalState', JSON.stringify(globalState));
                    resolve();
                } catch (localError) {
                    console.error('保存到localStorage失败:', localError);
                    resolve();
                }
                return;
            }
            
            try {
                // 使用 chrome.storage.local 避免写入配额限制
                chrome.storage.local.set({ petGlobalState: globalState }, async () => {
                    if (chrome.runtime.lastError) {
                        const error = chrome.runtime.lastError;
                        const errorMsg = error.message || error.toString();
                        
                        // 检查是否是扩展上下文失效错误
                        if (isContextInvalidatedError(error)) {
                            console.debug('扩展上下文已失效，使用localStorage保存');
                            try {
                                localStorage.setItem('petGlobalState', JSON.stringify(globalState));
                            } catch (localError) {
                                console.error('保存到localStorage失败:', localError);
                            }
                            resolve();
                            return;
                        }
                        
                        console.warn('保存全局状态失败:', errorMsg);
                        
                        // 检查是否是配额错误
                        if (isQuotaError(error)) {
                            console.warn('存储配额超出，尝试清理旧数据...');
                            // 尝试清理一些旧数据
                            try {
                                // 清理OSS文件列表（可以重新加载）
                                chrome.storage.local.remove('petOssFiles', () => {
                                    // 重试保存
                                    chrome.storage.local.set({ petGlobalState: globalState }, (retryError) => {
                                        if (chrome.runtime.lastError) {
                                            const retryErr = chrome.runtime.lastError;
                                            if (isContextInvalidatedError(retryErr)) {
                                                console.debug('扩展上下文已失效，使用localStorage保存');
                                                try {
                                                    localStorage.setItem('petGlobalState', JSON.stringify(globalState));
                                                } catch (localError) {
                                                    console.error('保存到localStorage失败:', localError);
                                                }
                                            } else if (isQuotaError(retryErr)) {
                                                console.warn('清理后仍然配额不足，降级到localStorage');
                                                try {
                                                    localStorage.setItem('petGlobalState', JSON.stringify(globalState));
                                                } catch (localError) {
                                                    console.error('保存到localStorage也失败:', localError);
                                                }
                                            }
                                        }
                                        resolve();
                                    });
                                });
                            } catch (cleanupError) {
                                console.error('清理存储失败:', cleanupError);
                                // 降级到localStorage
                                try {
                                    localStorage.setItem('petGlobalState', JSON.stringify(globalState));
                                } catch (localError) {
                                    console.error('保存到localStorage也失败:', localError);
                                }
                                resolve();
                            }
                        } else {
                            // 其他错误，直接降级到localStorage
                            try {
                                localStorage.setItem('petGlobalState', JSON.stringify(globalState));
                            } catch (localError) {
                                console.error('保存到localStorage也失败:', localError);
                            }
                            resolve();
                        }
                    } else {
                        console.log('全局状态已更新到local存储:', globalState);
                        // 同时保存到 localStorage 作为备份
                        try {
                            localStorage.setItem('petGlobalState', JSON.stringify(globalState));
                        } catch (localError) {
                            console.debug('保存到localStorage备份失败（可忽略）:', localError);
                        }
                        resolve();
                    }
                });
            } catch (error) {
                // 捕获外层错误
                if (isContextInvalidatedError(error)) {
                    console.debug('扩展上下文已失效，使用localStorage保存');
                } else {
                    console.warn('保存全局状态异常:', error.message);
                }
                try {
                    localStorage.setItem('petGlobalState', JSON.stringify(globalState));
                } catch (localError) {
                    console.error('保存到localStorage失败:', localError);
                }
                resolve();
            }
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
                    btnText.textContent = '隐藏陪伴';
                    btnIcon.textContent = '👁️';
                } else {
                    btnText.textContent = '显示陪伴';
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
        
        // 更新角色选择
        const roleSelect = document.getElementById('roleSelect');
        if (roleSelect) {
            roleSelect.value = this.petStatus.role || '教师';
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
                this.showNotification(this.petStatus.visible ? '已显示' : '已隐藏');
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
                this.petStatus.position = getPetDefaultPosition();
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
                    this.showNotification('已居中');
            } else {
                this.showNotification('操作失败，请刷新页面后重试', 'error');
            }
        } catch (error) {
            this.showNotification('操作失败，请刷新页面后重试', 'error');
        } finally {
            this.setButtonLoading('centerBtn', false);
        }
    }
    
    async setPetRole(role) {
        this.petStatus.role = role || '教师';
        
        try {
            // 更新全局状态
            await this.updateGlobalState();
            
            const response = await this.sendMessageToContentScript({ 
                action: 'setRole', 
                role: role 
            });
            if (response && response.success) {
                this.showNotification(`角色已切换为：${role}`);
                // 更新UI状态
                this.updateUI();
            } else {
                this.showNotification('操作失败，请刷新页面后重试', 'error');
            }
        } catch (error) {
            this.showNotification('操作失败，请刷新页面后重试', 'error');
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
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
                chrome.storage.onChanged.addListener((changes, namespace) => {
                    try {
                        // 监听 local 和 sync 存储的变化
                        if ((namespace === 'local' || namespace === 'sync') && changes.petGlobalState) {
                            const newState = changes.petGlobalState.newValue;
                            if (newState) {
                                // 更新本地状态（所有属性都同步）
                                this.petStatus.visible = newState.visible !== undefined ? newState.visible : this.petStatus.visible;
                                this.petStatus.color = newState.color !== undefined ? newState.color : this.petStatus.color;
                                this.petStatus.size = newState.size !== undefined ? newState.size : this.petStatus.size;
                                this.petStatus.role = newState.role || this.petStatus.role || '教师';
                                // 位置也进行跨页面同步
                                if (newState.position) {
                                    this.petStatus.position = newState.position;
                                }
                                
                                console.log('收到全局状态更新 (', namespace, '):', newState);
                                this.updateUI();
                            }
                        }
                    } catch (error) {
                        // 静默处理监听器错误，避免打断用户
                        console.debug('存储变化监听器错误:', error);
                    }
                });
            }
        } catch (error) {
            console.debug('无法设置存储变化监听器:', error);
        }
        
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
                console.debug('状态同步失败:', error);
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




