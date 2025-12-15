/**
 * PetManager - 状态管理相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // 保存状态（带节流机制，避免超过写入配额）
    proto.saveState = function() {
        this._saveStateInternal(true);
    };

    // 同步当前状态到全局状态（带节流机制）
    proto.syncToGlobalState = function() {
        this._saveStateInternal(false);
    };

    // 内部保存状态方法，统一处理节流和错误处理
    proto._saveStateInternal = function(includeLocalStorage = false) {
        const now = Date.now();
        const state = {
            visible: this.isVisible,
            color: this.colorIndex,
            size: this.size,
            position: this.position,
            role: this.role || '教师',
            model: this.currentModel,
            timestamp: now
        };

        // 保存待更新的状态
        this.pendingStateUpdate = state;

        // 如果距离上次保存时间太短，使用防抖延迟保存
        const timeSinceLastSave = now - this.lastStateSaveTime;
        if (timeSinceLastSave < this.STATE_SAVE_THROTTLE) {
            // 清除之前的定时器
            if (this.stateSaveTimer) {
                clearTimeout(this.stateSaveTimer);
            }
            // 设置新的延迟保存
            this.stateSaveTimer = setTimeout(() => {
                this._doSaveState(includeLocalStorage);
            }, this.STATE_SAVE_THROTTLE - timeSinceLastSave);
            return;
        }

        // 立即保存
        this._doSaveState(includeLocalStorage);
    };

    // 执行实际保存操作
    proto._doSaveState = async function(includeLocalStorage = false) {
        if (!this.pendingStateUpdate) {
            return;
        }

        const state = this.pendingStateUpdate;
        this.lastStateSaveTime = Date.now();
        this.pendingStateUpdate = null;

        if (this.stateSaveTimer) {
            clearTimeout(this.stateSaveTimer);
            this.stateSaveTimer = null;
        }

        try {
            // 使用StorageHelper处理配额错误
            if (typeof window.StorageHelper !== 'undefined') {
                const result = await window.StorageHelper.set(PET_CONFIG.storage.keys.globalState, state);
                if (!result.success) {
                    console.warn('保存状态失败:', result.error);
                } else if (result.fallback === 'localStorage') {
                    console.log('已降级到localStorage保存状态');
                } else {
                    console.log('宠物全局状态已保存到local存储:', state);
                }
            } else {
                // 降级到原始方法
                chrome.storage.local.set({ [PET_CONFIG.storage.keys.globalState]: state }, () => {
                    if (chrome.runtime.lastError) {
                        const error = chrome.runtime.lastError;
                        console.warn('保存状态到chrome.storage.local失败:', error.message);
                        
                        // 如果遇到配额错误，降级到localStorage
                        if (error.message.includes('MAX_WRITE_OPERATIONS_PER_HOUR') || 
                            error.message.includes('QUOTA_BYTES_PER_HOUR') ||
                            error.message.includes('QUOTA_BYTES') ||
                            error.message.includes('quota exceeded')) {
                            console.warn('遇到存储配额限制，降级到localStorage');
                            this.useLocalStorage = true;
                            try {
                                localStorage.setItem('petState', JSON.stringify(state));
                            } catch (localError) {
                                console.error('保存到localStorage也失败:', localError);
                            }
                        }
                    } else {
                        console.log('宠物全局状态已保存到local存储:', state);
                    }
                });
            }

            // 同时保存到localStorage作为备用
            if (includeLocalStorage) {
                try {
                    localStorage.setItem('petState', JSON.stringify(state));
                } catch (error) {
                    console.warn('保存到localStorage失败:', error);
                }
            }
        } catch (error) {
            console.log('保存状态失败:', error);
            // 降级到localStorage
            try {
                localStorage.setItem('petState', JSON.stringify(state));
            } catch (e) {
                console.error('保存到localStorage也失败:', e);
            }
        }
    };

    // 加载状态
    proto.loadState = function() {
        try {
            // 首先尝试从chrome.storage.local加载（新版本使用local）
            chrome.storage.local.get([PET_CONFIG.storage.keys.globalState], (result) => {
                let state = result[PET_CONFIG.storage.keys.globalState];
                
                // 如果local中没有，尝试从sync加载（兼容旧版本）
                if (!state) {
                    chrome.storage.sync.get([PET_CONFIG.storage.keys.globalState], (syncResult) => {
                        if (syncResult[PET_CONFIG.storage.keys.globalState]) {
                            state = syncResult[PET_CONFIG.storage.keys.globalState];
                            // 迁移到local存储
                            chrome.storage.local.set({ [PET_CONFIG.storage.keys.globalState]: state }, () => {
                                console.log('已从sync迁移到local存储');
                            });
                        }
                        this._applyLoadedState(state);
                    });
                } else {
                    this._applyLoadedState(state);
                }
            });
            
            // 同时尝试从localStorage加载（作为备用）
            try {
                const localState = localStorage.getItem('petState');
                if (localState) {
                    const state = JSON.parse(localState);
                    // 如果chrome.storage中没有数据，使用localStorage的数据
                    chrome.storage.local.get([PET_CONFIG.storage.keys.globalState], (result) => {
                        if (!result[PET_CONFIG.storage.keys.globalState] && state) {
                            this._applyLoadedState(state);
                        }
                    });
                }
            } catch (error) {
                console.warn('从localStorage加载状态失败:', error);
            }
        } catch (error) {
            console.log('加载状态失败:', error);
        }
    };

    // 应用加载的状态数据
    proto._applyLoadedState = function(state) {
        if (!state) {
            return;
        }

        this.isVisible = state.visible !== undefined ? state.visible : PET_CONFIG.pet.defaultVisible;
        this.colorIndex = state.color !== undefined ? state.color : PET_CONFIG.pet.defaultColorIndex;

        // 检查并迁移旧的大小值（从 60 升级到 180）
        if (state.size && state.size < 100) {
            // 旧版本的大小范围是 40-120，小于 100 的可能是旧版本
            this.size = PET_CONFIG.pet.defaultSize;
            // 更新存储中的值（使用节流保存）
            const updatedState = { ...state, size: this.size };
            this.pendingStateUpdate = updatedState;
            setTimeout(() => this._doSaveState(false), this.STATE_SAVE_THROTTLE);
        } else {
            this.size = state.size !== undefined ? state.size : PET_CONFIG.pet.defaultSize;
        }

        this.currentModel = state.model !== undefined ? state.model : ((PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || 'qwen3');
        // 加载角色，默认为教师
        this.role = state.role || '教师';
        // 位置也使用全局状态，但会进行边界检查
        this.position = this.validatePosition(state.position || getPetDefaultPosition());
        console.log('宠物全局状态已恢复:', state);
        console.log('宠物可见性:', this.isVisible);
        console.log('宠物角色:', this.role);

        // 更新宠物样式（如果宠物已创建）
        this.updatePetStyle();
        
        // 如果宠物已创建但还没有添加到页面，尝试再次添加
        if (this.pet && !this.pet.parentNode) {
            console.log('宠物已创建但未添加到页面，尝试重新添加');
            this.addPetToPage();
        }
    };

    // 从localStorage加载状态
    proto.loadStateFromLocalStorage = function() {
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

                // 加载角色，默认为教师
                this.role = state.role || '教师';

                this.position = state.position || getPetDefaultPosition();
                console.log('宠物本地状态已恢复:', state);
                console.log('宠物可见性:', this.isVisible);
                console.log('宠物角色:', this.role);
                
                // 更新宠物样式（如果宠物已创建）
                this.updatePetStyle();
                
                // 如果宠物已创建但还没有添加到页面，尝试再次添加
                if (this.pet && !this.pet.parentNode) {
                    console.log('宠物已创建但未添加到页面，尝试重新添加');
                    this.addPetToPage();
                }
                
                return true;
            }
        } catch (error) {
            console.log('恢复本地状态失败:', error);
        }
        return false;
    };

    // 处理全局状态更新
    proto.handleGlobalStateUpdate = function(newState) {
        if (newState) {
            // 更新全局状态（颜色、大小、可见性、位置、角色）
            this.isVisible = newState.visible !== undefined ? newState.visible : this.isVisible;
            this.colorIndex = newState.color !== undefined ? newState.color : this.colorIndex;

            // 检查并迁移旧的大小值
            if (newState.size && newState.size < 100) {
                this.size = PET_CONFIG.pet.defaultSize;
            } else {
                this.size = newState.size !== undefined ? newState.size : this.size;
            }

            // 更新角色
            if (newState.role) {
                this.role = newState.role;
            }

            // 位置也进行跨页面同步，但会进行边界检查
            if (newState.position) {
                this.position = this.validatePosition(newState.position);
            }

            console.log('处理全局状态更新:', newState);
            this.updatePetStyle();
        }
    };

    // 验证位置是否在当前窗口范围内
    proto.validatePosition = function(position) {
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return getPetDefaultPosition();
        }

        const maxX = Math.max(0, window.innerWidth - this.size);
        const maxY = Math.max(0, window.innerHeight - this.size);

        return {
            x: Math.max(0, Math.min(maxX, position.x)),
            y: Math.max(0, Math.min(maxY, position.y))
        };
    };

    // 启动定期同步
    proto.startPeriodicSync = function() {
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
    };

    // 停止定期同步
    proto.stopPeriodicSync = function() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    };

})();

