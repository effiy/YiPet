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
                        // 统一处理 pageTitle：优先使用 pageTitle，如果没有则使用 title
                        const refreshedPageTitle = refreshedSession.pageTitle || refreshedSession.title || '';
                        this.sessions[this.currentSessionId] = {
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
                            // 优先保留本地的 pageTitle（如果本地有内容），否则使用后端的
                            pageTitle: (localSession.pageTitle && localSession.pageTitle.trim() !== '')
                                ? localSession.pageTitle
                                : refreshedPageTitle,

                        };
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
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.95) !important;
            z-index: 2147483650 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            animation: fadeIn 0.3s ease-out !important;
        `;

        // 添加fadeIn动画
        if (!document.getElementById('image-preview-fade-style')) {
            const style = document.createElement('style');
            style.id = 'image-preview-fade-style';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        // 创建图片容器
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            position: relative !important;
            max-width: 95% !important;
            max-height: 90% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            
        `;

        // 创建加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.style.cssText = `
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 40px !important;
            height: 40px !important;
            border: 3px solid rgba(255, 255, 255, 0.3) !important;
            border-top-color: #fff !important;
            border-radius: 50% !important;
            animation: spin 0.8s linear infinite !important;
        `;

        // 添加spin动画
        if (!document.getElementById('image-preview-spin-style')) {
            const style = document.createElement('style');
            style.id = 'image-preview-spin-style';
            style.textContent = `
                @keyframes spin {
                    to { transform: translate(-50%, -50%) rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        imageContainer.appendChild(loadingIndicator);

        const img = document.createElement('img');
        img.style.cssText = `
            max-width: 100% !important;
            max-height: 85vh !important;
            border-radius: 8px !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
            opacity: 0 !important;
            transition: opacity 0.3s ease !important;
            object-fit: contain !important;
        `;
        img.alt = fileName || '图片预览';

        // 图片加载成功
        img.onload = () => {
            loadingIndicator.style.display = 'none';
            img.style.opacity = '1';
        };

        // 图片加载失败
        img.onerror = () => {
            loadingIndicator.style.display = 'none';
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = `
                color: white !important;
                text-align: center !important;
                padding: 20px !important;
                font-size: 16px !important;
            `;
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
            titleBar.style.cssText = `
                position: absolute !important;
                top: 20px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                background: rgba(0, 0, 0, 0.6) !important;
                color: white !important;
                padding: 8px 16px !important;
                border-radius: 20px !important;
                font-size: 14px !important;
                max-width: 80% !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
                backdrop-filter: blur(10px) !important;
            `;
            titleBar.textContent = fileName;
            modal.appendChild(titleBar);
        }

        // 创建按钮容器（下载和关闭按钮）
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            position: absolute !important;
            top: 20px !important;
            right: 20px !important;
            display: flex !important;
            gap: 12px !important;
            align-items: center !important;
        `;

        // 创建下载按钮（仅当有文件名时显示）
        let downloadBtn = null;
        if (fileName) {
            downloadBtn = document.createElement('button');
            downloadBtn.innerHTML = '⬇️';
            downloadBtn.title = '下载文件';
            downloadBtn.style.cssText = `
                background: rgba(255, 255, 255, 0.15) !important;
                color: white !important;
                border: none !important;
                width: 44px !important;
                height: 44px !important;
                border-radius: 50% !important;
                font-size: 20px !important;
                cursor: pointer !important;
                transition: all 0.3s ease !important;
                backdrop-filter: blur(10px) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                line-height: 1 !important;
            `;
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

            downloadBtn.addEventListener('mouseenter', () => {
                downloadBtn.style.background = 'rgba(255, 255, 255, 0.25)';
                downloadBtn.style.transform = 'scale(1.1)';
            });

            downloadBtn.addEventListener('mouseleave', () => {
                downloadBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                downloadBtn.style.transform = 'scale(1)';
            });

            buttonContainer.appendChild(downloadBtn);
        }

        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.15) !important;
            color: white !important;
            border: none !important;
            width: 44px !important;
            height: 44px !important;
            border-radius: 50% !important;
            font-size: 24px !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
            backdrop-filter: blur(10px) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            line-height: 1 !important;
        `;
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.remove();
        });

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.25)';
            closeBtn.style.transform = 'scale(1.1)';
        });

        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.15)';
            closeBtn.style.transform = 'scale(1)';
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
