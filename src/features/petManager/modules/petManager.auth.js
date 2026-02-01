/**
 * PetManager - 认证相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // Token 存储相关方法
    proto.getApiTokenKey = function() {
        return 'YiPet.apiToken.v1';
    };

    // 获取存储的 API Token（同步方式，快速获取）
    proto.getApiToken = function() {
        if (typeof TokenUtils !== 'undefined' && TokenUtils.getApiTokenSync) {
            return TokenUtils.getApiTokenSync();
        }
        return '';
    };

    // 获取存储的 API Token（异步方式，从 chrome.storage 获取最新值）
    proto.getApiTokenAsync = async function() {
        if (typeof TokenUtils !== 'undefined' && TokenUtils.getApiToken) {
            return await TokenUtils.getApiToken();
        }
        return '';
    };

    // 保存 API Token（同时保存到 chrome.storage 和 localStorage，支持跨 tab 和跨域共享）
    proto.saveApiToken = async function(token) {
        if (typeof TokenUtils !== 'undefined' && TokenUtils.saveApiToken) {
            await TokenUtils.saveApiToken(token);
            console.log('API Token 已保存（支持跨 tab 和跨域共享）');
            return;
        }
    };

    // 获取鉴权请求头
    proto.getAuthHeaders = function() {
        const token = this.getApiToken();
        if (!token) return {};
        return { 'X-Token': token };
    };

    // 打开鉴权对话框（使用友好的弹框 UI）
    proto.openAuth = async function() {
        return new Promise((resolve) => {
            try {
                this.closeTokenSettingsModal(null, { suppressResolve: true });
            } catch (_) {}

            this.ensureTokenSettingsUi();
            const modal = document.getElementById('token-settings-modal');
            if (!modal) {
                resolve(null);
                return;
            }

            const store = modal._store;
            if (!store) {
                resolve(null);
                return;
            }

            store.token = this.getApiToken() || '';
            store.invalid = false;
            modal._resolve = resolve;
        });
    };

    proto.ensureTokenSettingsUi = function() {
        const existing = document.getElementById('token-settings-modal');
        if (existing) return;

        const Vue = window.Vue || {};
        const { createApp, reactive } = Vue;
        if (typeof createApp !== 'function' || typeof reactive !== 'function') {
            return;
        }

        const canUseTemplate = (() => {
            if (typeof Vue?.compile !== 'function') return false;
            try {
                Function('return 1')();
                return true;
            } catch (_) {
                return false;
            }
        })();

        const modal = document.createElement('div');
        modal.id = 'token-settings-modal';
        modal.className = 'token-settings-modal';
        try {
            const zIndex = (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.ui && PET_CONFIG.ui.zIndex && PET_CONFIG.ui.zIndex.modal)
                ? PET_CONFIG.ui.zIndex.modal
                : 2147483649;
            modal.style.zIndex = String(zIndex);
        } catch (_) {}

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeTokenSettingsModal(null);
            }
        });

        const mountEl = document.createElement('div');
        modal.appendChild(mountEl);

        const store = reactive({
            token: '',
            invalid: false
        });

        modal._store = store;

        modal._mountPromise = (async () => {
            try {
                const mod = window.PetManager?.Components?.TokenSettingsModal;
                if (!mod || typeof mod.createComponent !== 'function') return;
                const template = canUseTemplate && typeof mod.loadTemplate === 'function' ? await mod.loadTemplate() : '';
                const ctor = mod.createComponent({ manager: this, store, template });
                if (!ctor) return;
                modal._vueApp = createApp(ctor);
                modal._vueInstance = modal._vueApp.mount(mountEl);
            } catch (_) {}
        })();

        document.body.appendChild(modal);
    };

    proto.closeTokenSettingsModal = function(token, options = {}) {
        const modal = document.getElementById('token-settings-modal');
        if (!modal) return;

        const suppressResolve = !!options.suppressResolve;
        const resolve = modal._resolve;
        modal._resolve = null;

        try {
            if (modal._vueApp) {
                modal._vueApp.unmount();
            }
        } catch (_) {}
        modal._vueApp = null;
        modal._vueInstance = null;

        try {
            modal.remove();
        } catch (_) {}

        if (!suppressResolve && typeof resolve === 'function') {
            try {
                resolve(token ?? null);
            } catch (_) {}
        }
    };

    // 检查并提示设置 token（如果未设置则自动弹出设置框）
    proto.ensureTokenSet = async function() {
        // 使用同步方法快速检查
        let hasToken = false;
        if (typeof TokenUtils !== 'undefined' && TokenUtils.hasApiTokenSync) {
            hasToken = TokenUtils.hasApiTokenSync();
        } else {
            const token = this.getApiToken();
            hasToken = token && token.trim().length > 0;
        }

        if (!hasToken) {
            // 如果 token 未设置，自动弹出设置框
            const result = await this.openAuth();
            // 如果用户设置了 token，等待一小段时间确保保存完成
            if (result) {
                // 等待保存完成（chrome.storage 是异步的）
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // 再次检查（用户可能取消了设置，或需要从 chrome.storage 同步）
        // 使用异步方法获取最新值
        if (typeof TokenUtils !== 'undefined' && TokenUtils.hasApiToken) {
            return await TokenUtils.hasApiToken();
        } else {
            const token = this.getApiToken();
            return token && token.trim().length > 0;
        }
    };
})();
