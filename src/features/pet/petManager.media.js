/**
 * PetManager - 媒体模块
 * 负责处理图片、文件等媒体消息的发送和预览
 */
(function () {
    'use strict';

    // 确保 PetManager 类已定义
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    /**
     * 发送图片消息
     * @param {string} imageDataUrl - 图片数据的DataURL
     */
    proto.sendImageMessage = async function (imageDataUrl) {
        const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages');
        if (!messagesContainer) return;

        // 确保有当前会话（如果没有，先初始化会话）
        if (!this.currentSessionId) {
            await this.initSession();
            // 更新聊天窗口标题
            this.updateChatHeaderTitle();
        }

        // 添加用户消息（带图片）
        const userMessage = this.createMessageElement('', 'user', imageDataUrl);
        messagesContainer.appendChild(userMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 添加用户消息到会话（注意：已移除自动保存，仅在保存时同步）
        await this.addMessageToSession('user', '', null, false, imageDataUrl);

        // 为用户消息添加操作按钮（包括机器人按钮）
        await this.addActionButtonsToMessage(userMessage);

        // 为用户消息添加删除、编辑和重新发送按钮
        const userBubble = userMessage.querySelector('[data-message-type="user-bubble"]');
        const copyButtonContainer = userMessage.querySelector('[data-copy-button-container]');
        if (copyButtonContainer && userBubble) {
            // 按钮现在由 ChatWindow.addActionButtonsToMessage 统一管理
            // 不再需要单独调用 addDeleteButtonForUserMessage 和 addSortButtons
        }

        // 调用 session/save 保存会话到后端
        try {
            // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
            await this.saveCurrentSession(false, false);

            // 调用 session/save 接口保存会话
            // 传入 processImages: true，表示需要处理图片上传
            if (this.currentSessionId && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                await this.syncSessionToBackend(this.currentSessionId, true, false);
                console.log('图片消息会话已保存到后端:', this.currentSessionId);

                // 保存成功后，通过会话接口刷新该会话内容
                try {
                    const refreshedSession = await this.sessionApi.getSession(this.currentSessionId, true);
                    if (refreshedSession && this.sessions[this.currentSessionId]) {
                        // 更新本地会话数据，保留本地的最新消息（可能包含未同步的数据）
                        const localSession = this.sessions[this.currentSessionId];
                        const refreshedTitle = refreshedSession.title || '';
                        const merged = {
                            ...refreshedSession,
                            id: this.currentSessionId,
                            // 如果本地消息更新，保留本地消息
                            messages: localSession.messages?.length > refreshedSession.messages?.length
                                ? localSession.messages
                                : refreshedSession.messages,
                            // 优先保留本地的 pageContent（如果本地有内容）
                            pageContent: (localSession.pageContent && localSession.pageContent.trim() !== '')
                                ? localSession.pageContent
                                : (refreshedSession.pageContent || localSession.pageContent || ''),
                            title: (localSession.title && localSession.title.trim() !== '')
                                ? localSession.title
                                : (refreshedTitle || localSession.title || ''),
                        };
                        this.sessions[this.currentSessionId] = merged;
                        console.log('会话内容已从后端刷新:', this.currentSessionId);
                    }
                } catch (refreshError) {
                    console.warn('刷新会话内容失败:', refreshError);
                    // 刷新失败不影响主流程，只记录警告
                }
            } else {
                console.warn('无法保存会话：缺少会话ID、API管理器或同步配置');
            }
        } catch (error) {
            console.error('保存图片消息会话失败:', error);
            // 显示错误提示（可选）
            const errorMessage = this.createMessageElement('保存会话时发生错误，请稍后再试。😔', 'pet');
            messagesContainer.appendChild(errorMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // 图片消息不再自动回复
    };

    /**
     * 显示图片预览
     * @param {string} imageUrl - 图片URL或DataURL
     * @param {string} fileName - 文件名（可选）
     */
    proto.showImagePreview = function (imageUrl, fileName = '') {
        // 如果已有预览弹窗，先关闭
        const existingModal = document.querySelector('.image-preview-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'image-preview-modal';
        // 样式已通过 CSS 类定义

        // 创建图片容器
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-preview-container';

        // 创建加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'image-preview-loading';

        imageContainer.appendChild(loadingIndicator);

        const img = document.createElement('img');
        // 样式已通过 CSS 类定义
        img.alt = fileName || '图片预览';

        // 图片加载成功
        img.onload = () => {
            loadingIndicator.classList.add('js-hidden');
            img.classList.add('js-loaded');
        };

        // 图片加载失败
        img.onerror = () => {
            loadingIndicator.classList.add('js-hidden');
            const errorMsg = document.createElement('div');
            errorMsg.className = 'image-preview-error';
            // 样式已通过 CSS 类定义
            errorMsg.textContent = '图片加载失败';
            imageContainer.appendChild(errorMsg);
        };

        // 直接使用图片地址进行预览
        img.src = imageUrl;
        imageContainer.appendChild(img);

        // 创建标题栏（显示文件名）
        let titleBar = null;
        if (fileName) {
            titleBar = document.createElement('div');
            titleBar.className = 'image-preview-title-bar';
            titleBar.textContent = fileName;
            modal.appendChild(titleBar);
        }

        // 创建按钮容器（下载和关闭按钮）
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'image-preview-button-container';

        // 创建下载按钮（仅当有文件名时显示）
        let downloadBtn = null;
        if (fileName) {
            downloadBtn = document.createElement('button');
            downloadBtn.className = 'image-preview-download-btn';
            downloadBtn.innerHTML = '⬇️';
            downloadBtn.title = '下载文件';
            // 样式已通过 CSS 类定义
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 通用下载逻辑
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = fileName || 'image.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });

            buttonContainer.appendChild(downloadBtn);
        }

        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.className = 'image-preview-close-btn';
        closeBtn.textContent = '✕';
        // 样式已通过 CSS 类定义
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.remove();
        });

        buttonContainer.appendChild(closeBtn);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // 按ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        modal.appendChild(imageContainer);
        modal.appendChild(buttonContainer);
        document.body.appendChild(modal);
    };

})();
