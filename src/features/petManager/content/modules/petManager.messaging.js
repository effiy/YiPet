/**
 * PetManager - 消息通信模块（从 `content/petManager.core.js` 拆分）
 * 负责处理来自 background 的消息
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    proto.setupMessageListener = function() {
        // 监听chrome.runtime消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('收到消息:', request);

            switch (request.action) {
                case 'ping':
                    sendResponse({ success: true, message: 'pong' });
                    break;

                case 'initPet':
                    if (!this.pet && typeof this.createPet === 'function') {
                        this.createPet();
                    } else if (this.pet && !this.pet.parentNode && typeof this.addPetToPage === 'function') {
                        this.addPetToPage();
                    }
                    if (typeof this.updatePetStyle === 'function') {
                        this.updatePetStyle();
                    }
                    sendResponse({
                        success: true,
                        visible: this.isVisible,
                        color: this.colorIndex,
                        size: this.size,
                        position: this.position,
                        role: this.role || '教师',
                        model: this.currentModel
                    });
                    break;

                case 'openChatWindow':
                    this.openChatWindow();
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

                case 'openQuickComment':
                case 'openQuickCommentFromShortcut':
                    {
                        const openIfEnabled = (enabled) => {
                            if (enabled === false) {
                                sendResponse({ success: false, disabled: true });
                                return;
                            }

                            if (typeof this.openQuickCommentFromShortcut === 'function') {
                                this.openQuickCommentFromShortcut();
                                sendResponse({ success: true });
                            } else {
                                sendResponse({ success: false, error: 'openQuickCommentFromShortcut not available' });
                            }
                        };

                        if (typeof this.quickCommentShortcutEnabled === 'boolean') {
                            openIfEnabled(this.quickCommentShortcutEnabled);
                            break;
                        }

                        try {
                            chrome.storage.local.get(['petSettings'], (result) => {
                                const settings = result && result.petSettings ? result.petSettings : null;
                                const enabled = settings ? settings.quickCommentShortcutEnabled : undefined;
                                let normalizedEnabled = enabled;
                                if (normalizedEnabled === 'false') normalizedEnabled = false;
                                if (normalizedEnabled === 'true') normalizedEnabled = true;
                                if (typeof normalizedEnabled === 'boolean') {
                                    this.quickCommentShortcutEnabled = normalizedEnabled;
                                }
                                openIfEnabled(typeof normalizedEnabled === 'boolean' ? normalizedEnabled : true);
                            });
                        } catch (e) {
                            openIfEnabled(true);
                        }
                        return true;
                    }

                case 'centerPet':
                    this.centerPet();
                    sendResponse({ success: true });
                    break;

                case 'setRole':
                    this.setRole(request.role);
                    sendResponse({ success: true, role: this.role });
                    break;

                case 'getStatus':
                    sendResponse({
                        visible: this.isVisible,
                        color: this.colorIndex,
                        size: this.size,
                        position: this.position,
                        role: this.role || '教师',
                        model: this.currentModel
                    });
                    break;

                case 'getFullPageText':
                    const text = this.getFullPageText();
                    sendResponse({ text: text });
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
                    // 异步处理
                    (async () => {
                        try {
                            // 确保有当前会话
                            if (!this.currentSessionId) {
                                await this.initSessionWithDelay();
                            }

                            // 添加用户消息到会话
                            if (this.currentSessionId && request.message) {
                                await this.addMessageToSession('user', request.message, null, false);
                            }

                            // 生成宠物回复
                            const reply = await this.generatePetResponse(request.message);

                            // 添加宠物回复到会话
                            if (this.currentSessionId && reply) {
                                await this.addMessageToSession('pet', reply, null, true);

                                // 调用 session/save 保存会话到后端（只在聊天窗口打开时）
                                if (this.isChatOpen && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                                    await this.syncSessionToBackend(this.currentSessionId, true);
                                }
                            }

                            sendResponse({ success: true, reply: reply });
                        } catch (error) {
                            console.error('生成回复失败:', error);
                            sendResponse({ success: false, error: error.message });
                        }
                    })();
                    return true; // 保持消息通道开放

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        });
    };

})();
