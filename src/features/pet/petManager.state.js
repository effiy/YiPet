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
        this._saveStateInternal();
    };

    // 同步当前状态到全局状态（带节流机制）
    proto.syncToGlobalState = function() {
        this._saveStateInternal();
    };

    // 内部保存状态方法，统一处理节流和错误处理
    proto._saveStateInternal = function() {
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
                this._doSaveState();
            }, this.STATE_SAVE_THROTTLE - timeSinceLastSave);
            return;
        }

        // 立即保存
        this._doSaveState();
    };

    // 执行实际保存操作
    proto._doSaveState = async function() {
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
            const result = await window.StorageHelper.set(PET_CONFIG.storage.keys.globalState, state);
            if (!result.success) {
                console.warn('保存状态失败:', result.error);
            } else {
                console.log('宠物全局状态已保存到local存储:', state);
            }
        } catch (error) {
            console.log('保存状态失败:', error);
        }
    };

    // 加载状态
    proto.loadState = function() {
        try {
            chrome.storage.local.get([PET_CONFIG.storage.keys.globalState], (result) => {
                const state = result[PET_CONFIG.storage.keys.globalState];
                this._applyLoadedState(state);
            });
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
        this.size = state.size !== undefined ? state.size : PET_CONFIG.pet.defaultSize;

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

    // 处理全局状态更新
    proto.handleGlobalStateUpdate = function(newState) {
        if (newState) {
            // 更新全局状态（颜色、大小、可见性、位置、角色）
            this.isVisible = newState.visible !== undefined ? newState.visible : this.isVisible;
            this.colorIndex = newState.color !== undefined ? newState.color : this.colorIndex;
            this.size = newState.size !== undefined ? newState.size : this.size;

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
