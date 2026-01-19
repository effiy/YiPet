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
        // 优先使用 TokenUtils（如果可用），否则降级到 localStorage
        if (typeof TokenUtils !== 'undefined' && TokenUtils.getApiTokenSync) {
            return TokenUtils.getApiTokenSync();
        }
        // 降级方案：从 localStorage 获取
        try {
            const token = localStorage.getItem(this.getApiTokenKey());
            return token ? String(token).trim() : '';
        } catch (error) {
            console.warn('获取 API Token 失败:', error);
            return '';
        }
    };

    // 获取存储的 API Token（异步方式，从 chrome.storage 获取最新值）
    proto.getApiTokenAsync = async function() {
        // 优先使用 TokenUtils（如果可用）
        if (typeof TokenUtils !== 'undefined' && TokenUtils.getApiToken) {
            return await TokenUtils.getApiToken();
        }
        // 降级方案：从 localStorage 获取
        try {
            const token = localStorage.getItem(this.getApiTokenKey());
            return token ? String(token).trim() : '';
        } catch (error) {
            console.warn('获取 API Token 失败:', error);
            return '';
        }
    };

    // 保存 API Token（同时保存到 chrome.storage 和 localStorage，支持跨 tab 和跨域共享）
    proto.saveApiToken = async function(token) {
        // 优先使用 TokenUtils（如果可用）
        if (typeof TokenUtils !== 'undefined' && TokenUtils.saveApiToken) {
            await TokenUtils.saveApiToken(token);
            console.log('API Token 已保存（支持跨 tab 和跨域共享）');
            return;
        }
        // 降级方案：保存到 localStorage
        try {
            localStorage.setItem(this.getApiTokenKey(), String(token || '').trim());
            console.log('API Token 已保存（仅本地）');
        } catch (error) {
            console.warn('保存 API Token 失败:', error);
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
            // 如果已经存在弹框，先关闭
            const existingModal = document.getElementById('token-settings-modal');
            if (existingModal) {
                existingModal.remove();
            }

            // 确保 CSS 动画已定义
            if (!document.getElementById('token-modal-animations')) {
                const style = document.createElement('style');
                style.id = 'token-modal-animations';
                style.textContent = `
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes scaleIn {
                        from { transform: scale(0.9); opacity: 0; }
                        to { transform: scale(1); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }

            // 获取当前 token
            const curToken = this.getApiToken();

            // 创建模态框
            const modal = document.createElement('div');
            modal.id = 'token-settings-modal';
            modal.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: rgba(0, 0, 0, 0.7) !important;
                z-index: ${PET_CONFIG.ui.zIndex.modal} !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                animation: fadeIn 0.3s ease-out !important;
            `;

            // 创建弹框容器
            const container = document.createElement('div');
            container.style.cssText = `
                background: #1e293b !important;  /* 量子灰 */
                border-radius: 16px !important;
                padding: 30px !important;
                max-width: 500px !important;
                width: 90% !important;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
                position: relative !important;
                animation: scaleIn 0.3s ease-out !important;
            `;

            // 创建标题
            const title = document.createElement('h3');
            title.innerHTML = '🔑 设置 X-Token';
            title.style.cssText = `
                margin: 0 0 10px 0 !important;
                color: #f8fafc !important;  /* 量子白 */
                font-size: 20px !important;
                font-weight: 600 !important;
                text-align: center !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 8px !important;
            `;

            // 创建说明文字
            const description = document.createElement('p');
            description.textContent = '请输入 X-Token 以访问 api.effiy.cn 服务';
            description.style.cssText = `
                margin: 0 0 20px 0 !important;
                color: #94a3b8 !important;  /* 中量子灰 */
                font-size: 14px !important;
                text-align: center !important;
            `;

            // 创建输入框容器
            const inputContainer = document.createElement('div');
            inputContainer.className = 'auth-input-container';

            // 创建输入框
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '请输入 X-Token';
            input.value = curToken || '';
            input.className = 'auth-input';
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveButton.click();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelButton.click();
                }
            });

            // 创建按钮容器
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'auth-button-container';

            // 保存按钮
            const saveButton = document.createElement('button');
            saveButton.textContent = '保存';
            saveButton.className = 'auth-save-btn';
            saveButton.addEventListener('click', async () => {
                const token = input.value.trim();
                if (!token) {
                    input.classList.add('invalid');
                    input.focus();
                    return;
                }

                // 保存 token
                await this.saveApiToken(token);

                // 关闭弹框
                modal.remove();

                // 配置完立即尝试刷新会话列表
                if (typeof this.manualRefresh === 'function') {
                    this.manualRefresh();
                }

                resolve(token);
            });

            // 取消按钮
            const cancelButton = document.createElement('button');
            cancelButton.textContent = '取消';
            cancelButton.className = 'auth-cancel-btn';
            cancelButton.addEventListener('click', () => {
                modal.remove();
                resolve(null);
            });

            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(null);
                }
            });

            // 组装弹框
            inputContainer.appendChild(input);
            buttonContainer.appendChild(saveButton);
            buttonContainer.appendChild(cancelButton);

            container.appendChild(title);
            container.appendChild(description);
            container.appendChild(inputContainer);
            container.appendChild(buttonContainer);

            modal.appendChild(container);
            document.body.appendChild(modal);

            // 自动聚焦输入框
            setTimeout(() => {
                input.focus();
                input.select();
            }, 100);
        });
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
