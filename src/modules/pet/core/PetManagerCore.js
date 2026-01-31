/**
 * Pet Manager Core Module
 * 负责宠物核心功能的初始化和管理
 */

class PetManagerCore {
    constructor() {
        this.pet = null;
        this.isVisible = PET_CONFIG.pet.defaultVisible;
        this.colorIndex = PET_CONFIG.pet.defaultColorIndex;
        this.size = PET_CONFIG.pet.defaultSize;
        this.position = this.getDefaultPosition();
        this.role = '教师'; // 默认角色为教师
        this.colors = PET_CONFIG.pet.colors;
        
        // 状态管理
        this.currentSessionId = null;
        this.sessions = {}; // 存储所有会话
        this.currentPageUrl = null;
        this.hasAutoCreatedSessionForPage = false;
        this.sessionInitPending = false;
        
        // UI状态
        this.sidebarWidth = 320;
        this.isResizingSidebar = false;
        this.sidebarCollapsed = false;
        this.inputContainerCollapsed = false;
        
        this.init();
    }

    init() {
        console.log('[PetManagerCore] 初始化宠物管理器');
        this.loadSavedState();
        this.setupEventListeners();
    }

    getDefaultPosition() {
        return {
            x: window.innerWidth - 150,
            y: window.innerHeight - 150
        };
    }

    loadSavedState() {
        // 从存储加载保存的状态
        chrome.storage.local.get([
            'petVisible', 
            'petColorIndex', 
            'petPosition', 
            'petRole',
            'sessions',
            'currentSessionId'
        ], (result) => {
            if (result.petVisible !== undefined) {
                this.isVisible = result.petVisible;
            }
            if (result.petColorIndex !== undefined) {
                this.colorIndex = result.petColorIndex;
            }
            if (result.petPosition) {
                this.position = result.petPosition;
            }
            if (result.petRole) {
                this.role = result.petRole;
            }
            if (result.sessions) {
                this.sessions = result.sessions;
            }
            if (result.currentSessionId) {
                this.currentSessionId = result.currentSessionId;
            }
        });
    }

    setupEventListeners() {
        // 监听存储变化
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                this.handleStorageChange(changes);
            }
        });

        // 监听页面卸载
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
    }

    handleStorageChange(changes) {
        // 处理存储变化
        if (changes.petVisible) {
            this.isVisible = changes.petVisible.newValue;
        }
        if (changes.petColorIndex) {
            this.colorIndex = changes.petColorIndex.newValue;
        }
        if (changes.petPosition) {
            this.position = changes.petPosition.newValue;
        }
        if (changes.petRole) {
            this.role = changes.petRole.newValue;
        }
    }

    saveState() {
        // 保存状态到存储
        chrome.storage.local.set({
            petVisible: this.isVisible,
            petColorIndex: this.colorIndex,
            petPosition: this.position,
            petRole: this.role,
            sessions: this.sessions,
            currentSessionId: this.currentSessionId
        });
    }

    // 宠物状态管理
    getPet() {
        return this.pet;
    }

    setPet(pet) {
        this.pet = pet;
    }

    isPetVisible() {
        return this.isVisible;
    }

    setPetVisible(visible) {
        this.isVisible = visible;
        this.saveState();
    }

    getPetPosition() {
        return this.position;
    }

    setPetPosition(position) {
        this.position = position;
        this.saveState();
    }

    getPetColorIndex() {
        return this.colorIndex;
    }

    setPetColorIndex(index) {
        this.colorIndex = index;
        this.saveState();
    }

    getPetRole() {
        return this.role;
    }

    setPetRole(role) {
        this.role = role;
        this.saveState();
    }

    // 会话管理
    getSessions() {
        return this.sessions;
    }

    getSession(sessionId) {
        return this.sessions[sessionId];
    }

    setSession(sessionId, sessionData) {
        this.sessions[sessionId] = sessionData;
        this.saveState();
    }

    deleteSession(sessionId) {
        delete this.sessions[sessionId];
        if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
        }
        this.saveState();
    }

    getCurrentSessionId() {
        return this.currentSessionId;
    }

    setCurrentSessionId(sessionId) {
        this.currentSessionId = sessionId;
        this.saveState();
    }

    // 工具方法
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getCurrentPageUrl() {
        return window.location.href;
    }

    isNewPage() {
        const currentUrl = this.getCurrentPageUrl();
        return this.currentPageUrl !== currentUrl;
    }

    updateCurrentPageUrl() {
        this.currentPageUrl = this.getCurrentPageUrl();
    }
}

// 创建全局实例
window.PetManagerCore = PetManagerCore;

// 防止重复初始化
if (typeof window.petManagerCore === 'undefined') {
    window.petManagerCore = new PetManagerCore();
}