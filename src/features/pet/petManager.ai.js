/**
 * PetManager - AI 对话相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    proto.showSettingsModal = function() {
        if (!this.chatWindow) return;
        const existing = this.chatWindow.querySelector('#pet-ai-settings');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'pet-ai-settings';
        overlay.style.setProperty('z-index', `${PET_CONFIG.ui.zIndex.modal}`, 'important');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
                const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
                if (sidebarToggleBtn) sidebarToggleBtn.classList.remove('tw-hidden');
                if (inputToggleBtn) inputToggleBtn.classList.remove('tw-hidden');
            }
        });
        const panel = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'pet-ai-settings-title';
        title.innerHTML = `⚙️ AI 设置`;
        const row = document.createElement('div');
        row.className = 'pet-ai-settings-row';
        const label = document.createElement('label');
        label.className = 'pet-ai-settings-label';
        label.textContent = '模型';
        const select = document.createElement('select');
        select.className = 'pet-ai-settings-select';
        const models = (PET_CONFIG.chatModels && Array.isArray(PET_CONFIG.chatModels.models)) ? PET_CONFIG.chatModels.models : [];
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.icon || ''} ${m.name || m.id}`;
            select.appendChild(opt);
        });
        select.value = this.currentModel || ((PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || 'qwen3');
        row.appendChild(label);
        row.appendChild(select);
        const buttons = document.createElement('div');
        buttons.className = 'pet-ai-settings-buttons';
        const tokenBtn = document.createElement('button');
        tokenBtn.className = 'pet-ai-settings-token-btn';
        tokenBtn.textContent = '设置 Token';
        tokenBtn.addEventListener('click', () => {
            this.openAuth && this.openAuth();
        });
        const saveBtn = document.createElement('button');
        saveBtn.className = 'pet-ai-settings-save-btn';
        saveBtn.textContent = '保存';
        saveBtn.addEventListener('click', () => {
            this.currentModel = select.value;
            this.saveState && this.saveState();
            overlay.remove();
            const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
            const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
            if (sidebarToggleBtn) sidebarToggleBtn.classList.remove('tw-hidden');
            if (inputToggleBtn) inputToggleBtn.classList.remove('tw-hidden');
            this.showNotification && this.showNotification('模型已更新', 'success');
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'pet-ai-settings-cancel-btn';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
            const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
            if (sidebarToggleBtn) sidebarToggleBtn.classList.remove('tw-hidden');
            if (inputToggleBtn) inputToggleBtn.classList.remove('tw-hidden');
        });
        buttons.appendChild(tokenBtn);
        buttons.appendChild(cancelBtn);
        buttons.appendChild(saveBtn);
        panel.appendChild(title);
        panel.appendChild(row);
        panel.appendChild(buttons);
        overlay.appendChild(panel);
        this.chatWindow.appendChild(overlay);
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.classList.add('tw-hidden');
        if (inputToggleBtn) inputToggleBtn.classList.add('tw-hidden');
    };

    // 去除 think 内容（思考过程）
    proto.stripThinkContent = function(content) {
        if (!content || typeof content !== 'string') {
            return content;
        }
        let cleaned = String(content);
        // 去除 <think>...</think> 格式
        cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
        // 去除 ```think ... ``` 格式
        cleaned = cleaned.replace(/```think[\s\S]*?```/gi, '');
        return cleaned.trim();
    };

    // 构建 prompt 请求 payload，自动包含会话 ID
    proto.buildPromptPayload = function(fromSystem, fromUser, options = {}) {
        const payload = {
            fromSystem: fromSystem || '你是一个俏皮活泼、古灵精怪的小女友，聪明有趣，时而调侃时而贴心。语气活泼可爱，会开小玩笑，但也会关心用户。',
            fromUser: fromUser
        };

        // 从 fromUser 中提取图片和视频（不再依赖模型类型）
        if (fromUser && typeof fromUser === 'string') {
            const { images, videos, cleanedText } = this.extractMediaUrls(fromUser);

            // 更新 fromUser 为清理后的文本
            payload.fromUser = cleanedText || '';

            // 合并从 fromUser 提取的图片和 options 中提供的图片
            const allImages = [...images];

            // 获取图片：优先使用 options 中提供的
            // 如果 options 中没有提供，且 options.messageDiv 存在，则从 DOM 元素中直接提取图片
            let imageDataUrls = [];
            if (options.imageDataUrl) {
                // 如果提供了单个图片，转换为数组
                imageDataUrls = Array.isArray(options.imageDataUrl) ? options.imageDataUrl : [options.imageDataUrl];
            }

            if (imageDataUrls.length === 0 && options.messageDiv) {
                // 优先从 DOM 元素中直接查找图片（更准确）
                const userBubble = options.messageDiv.querySelector('[data-message-type="user-bubble"]');
                if (userBubble) {
                    // 查找用户消息中的所有 img 标签
                    const imgElements = userBubble.querySelectorAll('img');
                    imgElements.forEach(img => {
                        if (img.src && !imageDataUrls.includes(img.src)) {
                            imageDataUrls.push(img.src);
                        }
                    });
                }

                // 如果从 DOM 中没有找到，尝试从消息对象中获取（作为备选方案）
                if (imageDataUrls.length === 0) {
                    const messageResult = this.findMessageObjectByDiv(options.messageDiv);
                    if (messageResult && messageResult.message && messageResult.message.imageDataUrl) {
                        const imgUrl = messageResult.message.imageDataUrl;
                        if (typeof imgUrl === 'string') {
                            imageDataUrls.push(imgUrl);
                        } else if (Array.isArray(imgUrl)) {
                            imageDataUrls = imgUrl;
                        }
                    }
                }
            }
            // 如果仍然没有获取到，且没有指定 messageDiv，则从当前会话消息中获取（向后兼容）
            if (imageDataUrls.length === 0 && !options.messageDiv && this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
                    // 从后往前查找最后一条用户消息的 imageDataUrl
                    for (let i = session.messages.length - 1; i >= 0; i--) {
                        const msg = session.messages[i];
                        if (msg.type === 'user' && msg.imageDataUrl) {
                            const imgUrl = msg.imageDataUrl;
                            if (typeof imgUrl === 'string') {
                                imageDataUrls.push(imgUrl);
                            } else if (Array.isArray(imgUrl)) {
                                imageDataUrls = imgUrl;
                            }
                            break;
                        }
                    }
                }
            }

            // 将从消息中获取到的图片追加到图片列表中
            imageDataUrls.forEach(imgUrl => {
                if (imgUrl && typeof imgUrl === 'string' && !allImages.includes(imgUrl)) {
                    allImages.push(imgUrl);
                }
            });

            if (options.images && Array.isArray(options.images)) {
                options.images.forEach(img => {
                    if (!allImages.includes(img)) {
                        allImages.push(img);
                    }
                });
            }
            if (allImages.length > 0) {
                payload.images = allImages;
            }

            // 合并从 fromUser 提取的视频和 options 中提供的视频
            const allVideos = [...videos];
            if (options.videos && Array.isArray(options.videos)) {
                options.videos.forEach(video => {
                    if (!allVideos.includes(video)) {
                        allVideos.push(video);
                    }
                });
            }
            if (allVideos.length > 0) {
                payload.videos = allVideos;
            }
        } else {
            // 如果模型不是 qwen3-vl，直接使用 options 中的 images/videos（如果有）
            if (options.images !== undefined) {
                payload.images = options.images;
            }
            if (options.videos !== undefined) {
                payload.videos = options.videos;
            }
        }

        // 添加会话 ID（conversation_id）- 使用当前会话 ID
        if (this.currentSessionId) {
            payload.conversation_id = this.currentSessionId;
        }

        // 添加用户 ID（如果配置了）
        if (options.user_id) {
            payload.user_id = options.user_id;
        }

        return payload;
    };

    // 通用的流式响应处理方法
    proto.processStreamingResponse = async function(response, onContent) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const message of messages) {
                if (message.startsWith('data: ')) {
                    try {
                        const dataStr = message.substring(6);
                        const chunk = JSON.parse(dataStr);

                        // 处理后端返回的上下文信息
                        if (chunk.type === 'context_info') {
                            const contextData = chunk.data || {};
                            if (contextData.chats_count > 0) {
                                console.log(`检索到 ${contextData.chats_count} 条聊天记录`);
                            }
                        }
                        // 处理后端返回的聊天保存成功事件，同步会话 ID
                        else if (chunk.type === 'chat_saved') {
                            const conversationId = chunk.conversation_id;
                            if (conversationId && !this.currentSessionId) {
                                // 如果当前没有会话 ID，使用后端返回的会话 ID
                                this.currentSessionId = conversationId;
                                console.log('从后端同步会话 ID:', conversationId);
                            } else if (conversationId && this.currentSessionId !== conversationId) {
                                // 如果后端返回的会话 ID 与当前不同，记录日志（但不强制更新，因为前端可能有自己的会话管理逻辑）
                                console.log('后端返回的会话 ID 与当前不同:', conversationId, 'vs', this.currentSessionId);
                            }
                        }
                        // 支持 Ollama 格式: chunk.message.content
                        else if (chunk.message && chunk.message.content) {
                            fullContent += chunk.message.content;
                            if (onContent) {
                                onContent(chunk.message.content, fullContent);
                            }
                        }
                        // 支持嵌套格式: chunk.data.message
                        else if (chunk.data && chunk.data.message) {
                            fullContent += chunk.data.message;
                            if (onContent) {
                                onContent(chunk.data.message, fullContent);
                            }
                        }
                        // 支持旧的自定义格式: data.type === 'content'
                        else if (chunk.type === 'content') {
                            fullContent += chunk.data;
                            if (onContent) {
                                onContent(chunk.data, fullContent);
                            }
                        }
                        // 检查是否完成
                        else if (chunk.done === true) {
                            console.log('流式响应完成');
                        }
                        // 处理错误
                        else if (chunk.type === 'error' || chunk.error) {
                            const errorMsg = chunk.data || chunk.error || '未知错误';
                            console.error('流式响应错误:', errorMsg);
                            throw new Error(errorMsg);
                        }
                    } catch (e) {
                        console.warn('解析 SSE 消息失败:', message, e);
                    }
                }
            }
        }

        // 处理最后的缓冲区消息
        if (buffer.trim()) {
            const message = buffer.trim();
            if (message.startsWith('data: ')) {
                try {
                    const chunk = JSON.parse(message.substring(6));
                    if (chunk.done === true || chunk.type === 'done') {
                        console.log('流式响应完成');
                    } else if (chunk.type === 'error' || chunk.error) {
                        const errorMsg = chunk.data || chunk.error || '未知错误';
                        throw new Error(errorMsg);
                    }
                } catch (e) {
                    console.warn('解析最后的 SSE 消息失败:', message, e);
                }
            }
        }

        // prompt 接口调用后触发 session/save
        if (this.currentSessionId && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            try {
                // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                await this.saveCurrentSession(false, false);

                // 调用 session/save 接口保存会话
                await this.syncSessionToBackend(this.currentSessionId, true);
                console.log(`processStreamingResponse 完成后，会话 ${this.currentSessionId} 已保存到后端`);
            } catch (error) {
                console.warn('processStreamingResponse 完成后保存会话失败:', error);
            }
        }

        return fullContent;
    };

    // 生成宠物响应（流式版本）
    proto.generatePetResponseStream = async function(message, onContent, abortController = null, options = {}) {
        // 开始加载动画（不等待，避免阻塞）
        this.showLoadingAnimation().catch(err => {
            console.warn('显示加载动画失败:', err);
        });

        try {
            const _truncateText = (v, maxLen) => {
                const s = String(v ?? '');
                const limit = Math.max(0, Number(maxLen) || 0);
                if (!limit || s.length <= limit) return s;
                return `${s.slice(0, limit)}\n\n...(内容已截断)`;
            };

            // 检查开关状态
            let includeContext = true; // 默认包含上下文
            const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null;
            if (contextSwitch) {
                includeContext = contextSwitch.checked;
            }

            // 优先使用会话保存的页面内容，如果没有则使用当前页面内容
            let fullPageMarkdown = '';
            let contextTitle = document.title || '当前页面';

            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];

                // 检查是否为空白会话（空白会话不应该填充页面内容）
                const isBlankSession = session._isBlankSession ||
                                      !session.url ||
                                      session.url.startsWith('blank-session://');

                // 如果会话有保存的页面内容，使用它
                if (session.pageContent && session.pageContent.trim() !== '') {
                    fullPageMarkdown = session.pageContent;
                    contextTitle = session.title || contextTitle;
                } else if (!isBlankSession) {
                    // 如果不是空白会话且没有保存的页面内容，获取当前页面内容并保存到会话
                    fullPageMarkdown = this.getPageContentAsMarkdown();
                    contextTitle = document.title || '当前页面';
                    session.pageContent = fullPageMarkdown;
                    const ensureMdSuffix = (str) => {
                        if (!str || !String(str).trim()) return '';
                        const s = String(str).trim();
                        return s.endsWith('.md') ? s : `${s}.md`;
                    };
                    const currentTitle = session.title || '';
                    const isDefaultTitle = !currentTitle ||
                        currentTitle.trim() === '' ||
                        currentTitle === '未命名会话' ||
                        currentTitle === '新会话' ||
                        currentTitle === '未命名页面' ||
                        currentTitle === '当前页面';
                    if (isDefaultTitle) {
                        session.title = ensureMdSuffix(contextTitle);
                    }
                    // 注意：已移除临时保存，页面内容会在 prompt 接口调用完成后统一保存
                } else {
                    // 空白会话：不填充页面内容，使用空内容
                    fullPageMarkdown = '';
                    contextTitle = session.title || '新会话';
                    console.log('空白会话，不填充页面内容');
                }
            } else {
                // 如果没有当前会话，使用当前页面内容
                fullPageMarkdown = this.getPageContentAsMarkdown();
            }

            const images = Array.isArray(options?.images)
                ? options.images.filter(Boolean).slice(0, 4)
                : [];
            const baseText = (() => {
                const t = String(message ?? '').trim();
                if (t) return t;
                if (images.length > 0) return '用户发送了图片，请结合图片内容回答。';
                return '';
            })();
            const currentText = _truncateText(baseText, 8000);
            const pageMd = _truncateText(fullPageMarkdown, 12000);

            // 根据开关状态决定是否包含页面内容
            let userMessage = currentText;
            if (includeContext && pageMd) {
                userMessage = `【当前页面上下文】\n页面标题：${contextTitle}\n页面内容（Markdown 格式）：\n${pageMd}\n\n【用户问题】\n${currentText}`;
            }

            // 调用 API，使用配置中的 URL
            const apiUrl = PET_CONFIG.api.yiaiBaseUrl;

            if (typeof this.buildFromUserWithContext === 'function') {
                userMessage = this.buildFromUserWithContext(userMessage);
            }

            // 使用统一的 payload 构建函数，自动包含会话 ID 和 imageDataUrl
            const oldPayload = this.buildPromptPayload(
                '你是一个俏皮活泼、古灵精怪的小女友，聪明有趣，时而调侃时而贴心。语气活泼可爱，会开小玩笑，但也会关心用户。',
                userMessage,
                { images }
            );

            // 转换为 services.ai.chat_service 格式
            const payload = {
                module_name: 'services.ai.chat_service',
                method_name: 'chat',
                parameters: {
                    system: oldPayload.fromSystem,
                    user: oldPayload.fromUser,
                    stream: true
                }
            };
            if (oldPayload.images && Array.isArray(oldPayload.images) && oldPayload.images.length > 0) {
                payload.parameters.images = oldPayload.images;
            }
            if (oldPayload.model) {
                payload.parameters.model = oldPayload.model;
            }
            if (oldPayload.conversation_id) {
                payload.parameters.conversation_id = oldPayload.conversation_id;
            }

            const fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            };

            // 如果提供了 AbortController，添加 signal
            if (abortController) {
                fetchOptions.signal = abortController.signal;
            }

            const response = await fetch(apiUrl, fetchOptions);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // 读取流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';
            let processedContent = ''; // 保存处理后的内容，确保与显示内容一致

            while (true) {
                // 检查是否已中止
                if (abortController && abortController.signal.aborted) {
                    reader.cancel();
                    throw new Error('请求已取消');
                }

                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                // 解码数据并添加到缓冲区
                buffer += decoder.decode(value, { stream: true });

                // 处理完整的 SSE 消息
                const messages = buffer.split('\n\n');
                buffer = messages.pop() || '';

                for (const message of messages) {
                    if (message.startsWith('data: ')) {
                        try {
                            const dataStr = message.substring(6);
                            const chunk = JSON.parse(dataStr);

                            // 处理后端返回的上下文信息
                            if (chunk.type === 'context_info') {
                                const contextData = chunk.data || {};
                                if (contextData.chats_count > 0) {
                                    console.log(`检索到 ${contextData.chats_count} 条聊天记录`);
                                }
                            }
                            // 处理后端返回的聊天保存成功事件，同步会话 ID
                            else if (chunk.type === 'chat_saved') {
                                const conversationId = chunk.conversation_id;
                                if (conversationId && !this.currentSessionId) {
                                    // 如果当前没有会话 ID，使用后端返回的会话 ID
                                    this.currentSessionId = conversationId;
                                    console.log('从后端同步会话 ID:', conversationId);
                                } else if (conversationId && this.currentSessionId !== conversationId) {
                                    // 如果后端返回的会话 ID 与当前不同，记录日志（但不强制更新，因为前端可能有自己的会话管理逻辑）
                                    console.log('后端返回的会话 ID 与当前不同:', conversationId, 'vs', this.currentSessionId);
                                }
                            }
                            // 支持 Ollama 格式: chunk.message.content
                            else if (chunk.message && chunk.message.content) {
                                fullContent += chunk.message.content;
                                // 实时处理并保存处理后的内容，确保与显示内容一致
                                processedContent = this.stripThinkContent(fullContent);
                                if (onContent) {
                                    // 实时显示时也去除 think 内容（可能不完整，但可以改善体验）
                                    onContent(chunk.message.content, processedContent);
                                }
                            }
                            // 支持嵌套格式: chunk.data.message
                            else if (chunk.data && chunk.data.message) {
                                fullContent += chunk.data.message;
                                // 实时处理并保存处理后的内容，确保与显示内容一致
                                processedContent = this.stripThinkContent(fullContent);
                                if (onContent) {
                                    // 实时显示时也去除 think 内容（可能不完整，但可以改善体验）
                                    onContent(chunk.data.message, processedContent);
                                }
                            }
                            // 支持通用格式: chunk.content
                            else if (chunk.content) {
                                fullContent += chunk.content;
                                // 实时处理并保存处理后的内容，确保与显示内容一致
                                processedContent = this.stripThinkContent(fullContent);
                                if (onContent) {
                                    // 实时显示时也去除 think 内容（可能不完整，但可以改善体验）
                                    onContent(chunk.content, processedContent);
                                }
                            }
                            // 支持旧的自定义格式: data.type === 'content'
                            else if (chunk.type === 'content') {
                                fullContent += chunk.data;
                                // 实时处理并保存处理后的内容，确保与显示内容一致
                                processedContent = this.stripThinkContent(fullContent);
                                if (onContent) {
                                    // 实时显示时也去除 think 内容（可能不完整，但可以改善体验）
                                    onContent(chunk.data, processedContent);
                                }
                            }
                            // 检查是否完成
                            else if (chunk.done === true) {
                                console.log('流式响应完成');
                            }
                            // 处理错误
                            else if (chunk.type === 'error' || chunk.error) {
                                const errorMsg = chunk.data || chunk.error || '未知错误';
                                console.error('流式响应错误:', errorMsg);
                                throw new Error(errorMsg);
                            }
                        } catch (e) {
                            console.warn('解析 SSE 消息失败:', message, e);
                        }
                    }
                }
            }

            // 处理最后的缓冲区消息
            if (buffer.trim()) {
                const message = buffer.trim();
                if (message.startsWith('data: ')) {
                    try {
                        const chunk = JSON.parse(message.substring(6));
                        if (chunk.done === true || chunk.type === 'done') {
                            console.log('流式响应完成');
                        } else if (chunk.type === 'error' || chunk.error) {
                            const errorMsg = chunk.data || chunk.error || '未知错误';
                            throw new Error(errorMsg);
                        }
                    } catch (e) {
                        console.warn('解析最后的 SSE 消息失败:', message, e);
                    }
                }
            }

            // 注意：流式接口完成后不再自动保存会话
            // 会话保存由 sendMessage 方法在流式完成后统一调用 update_document 接口处理

            // 返回去除 think 内容后的完整内容（使用处理后的内容，确保与显示内容一致）
            // 如果 processedContent 为空，说明没有内容被处理，使用 stripThinkContent 处理原始内容
            return processedContent || this.stripThinkContent(fullContent);
        } catch (error) {
            // 如果是中止错误，不记录为错误
            if (error.name === 'AbortError' || error.message === '请求已取消') {
                console.log('请求已取消');
                throw error;
            }
            console.error('API 调用失败:', error);
            throw error;
        } finally {
            // 停止加载动画
            this.stopLoadingAnimation();
        }
    };

    // 生成宠物响应
    proto.generatePetResponse = async function(message) {
        // 开始加载动画（不等待，避免阻塞）
        this.showLoadingAnimation().catch(err => {
            console.warn('显示加载动画失败:', err);
        });

        try {
            // 检查开关状态
            let includeContext = true; // 默认包含上下文
            const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null;
            if (contextSwitch) {
                includeContext = contextSwitch.checked;
            }

            // 优先使用会话保存的页面内容，如果没有则使用当前页面内容
            let fullPageMarkdown = '';
            let contextTitle = document.title || '当前页面';

            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];

                // 检查是否为空白会话（空白会话不应该填充页面内容）
                const isBlankSession = session._isBlankSession ||
                                      !session.url ||
                                      session.url.startsWith('blank-session://');

                // 如果会话有保存的页面内容，使用它
                if (session.pageContent && session.pageContent.trim() !== '') {
                    fullPageMarkdown = session.pageContent;
                    contextTitle = session.title || contextTitle;
                } else if (!isBlankSession) {
                    // 如果不是空白会话且没有保存的页面内容，获取当前页面内容并保存到会话
                    fullPageMarkdown = this.getPageContentAsMarkdown();
                    contextTitle = document.title || '当前页面';
                    session.pageContent = fullPageMarkdown;
                    const ensureMdSuffix = (str) => {
                        if (!str || !String(str).trim()) return '';
                        const s = String(str).trim();
                        return s.endsWith('.md') ? s : `${s}.md`;
                    };
                    const currentTitle = session.title || '';
                    const isDefaultTitle = !currentTitle ||
                        currentTitle.trim() === '' ||
                        currentTitle === '未命名会话' ||
                        currentTitle === '新会话' ||
                        currentTitle === '未命名页面' ||
                        currentTitle === '当前页面';
                    if (isDefaultTitle) {
                        session.title = ensureMdSuffix(contextTitle);
                    }
                    // 注意：已移除临时保存，页面内容会在 prompt 接口调用完成后统一保存
                } else {
                    // 空白会话：不填充页面内容，使用空内容
                    fullPageMarkdown = '';
                    contextTitle = session.title || '新会话';
                    console.log('空白会话，不填充页面内容');
                }
            } else {
                // 如果没有当前会话，使用当前页面内容
                fullPageMarkdown = this.getPageContentAsMarkdown();
            }

            // 构建包含页面内容的完整消息
            // 根据开关状态决定是否包含页面内容
            let userMessage = message;
            if (includeContext && fullPageMarkdown) {
                userMessage = `【当前页面上下文】\n页面标题：${contextTitle}\n页面内容（Markdown 格式）：\n${fullPageMarkdown}\n\n【用户问题】\n${message}`;
            }

            // 使用统一的 payload 构建函数，自动包含会话 ID 和 imageDataUrl（如果是 qwen3-vl 模型）
            const oldPayload = this.buildPromptPayload(
                '你是一个俏皮活泼、古灵精怪的小女友，聪明有趣，时而调侃时而贴心。语气活泼可爱，会开小玩笑，但也会关心用户。',
                userMessage
            );

            // 转换为 services.ai.chat_service 格式
            const payload = {
                module_name: 'services.ai.chat_service',
                method_name: 'chat',
                parameters: {
                    system: oldPayload.fromSystem,
                    user: oldPayload.fromUser,
                    stream: false
                }
            };
            if (oldPayload.images && Array.isArray(oldPayload.images) && oldPayload.images.length > 0) {
                payload.parameters.images = oldPayload.images;
            }
            if (oldPayload.model) {
                payload.parameters.model = oldPayload.model;
            }
            if (oldPayload.conversation_id) {
                payload.parameters.conversation_id = oldPayload.conversation_id;
            }

            // 显示加载动画
            this._showLoadingAnimation();

            // 调用 API，使用配置中的 URL
            let response, result;
            try {
                response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.getAuthHeaders(),
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                result = await response.json();

                // 隐藏加载动画
                this._hideLoadingAnimation();
            } catch (error) {
                // 隐藏加载动画
                this._hideLoadingAnimation();
                throw error;
            }

            // 适配新的响应格式: {status, msg, data, pagination}
            let responseContent;
            if (result.status === 200 && result.data) {
                // 成功响应，提取 data 字段
                responseContent = result.data;
            } else if (result.status !== 200) {
                // API 返回错误，使用 msg 字段
                responseContent = result.msg || '抱歉，服务器返回了错误。';
            } else if (result.content) {
                responseContent = result.content;
            } else if (result.message) {
                responseContent = result.message;
            } else if (typeof result === 'string') {
                responseContent = result;
            } else {
                // 未知格式，尝试提取可能的文本内容
                responseContent = JSON.stringify(result);
            }

            // 去除 think 内容
            responseContent = this.stripThinkContent(responseContent);

            // prompt 接口调用后触发 session/save
            if (this.currentSessionId && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                try {
                    // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                    await this.saveCurrentSession(false, false);

                    // 调用 session/save 接口保存会话
                    await this.syncSessionToBackend(this.currentSessionId, true);
                    console.log(`非流式 prompt 接口调用后，会话 ${this.currentSessionId} 已保存到后端`);
                } catch (error) {
                    console.warn('非流式 prompt 接口调用后保存会话失败:', error);
                }
            }

            return responseContent;
        } catch (error) {
            console.error('API 调用失败:', error);
            // 如果 API 调用失败，返回默认响应
            return '抱歉，我现在无法连接到服务器。请稍后再试。😔';
        } finally {
            // 停止加载动画
            this.stopLoadingAnimation();
        }
    };

    // 获取随机响应
    proto.getRandomResponse = function(responses) {
        return responses[Math.floor(Math.random() * responses.length)];
    };

    // 通用的流式生成函数，支持动态 systemPrompt 和 userPrompt
    proto.generateContentStream = async function(systemPrompt, userPrompt, onContent, loadingText = '正在处理...') {
        try {
            console.log('调用大模型生成内容，systemPrompt长度:', systemPrompt ? systemPrompt.length : 0);

            // 使用统一的 payload 构建函数，自动包含会话 ID
            const oldPayload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 转换为 services.ai.chat_service 格式
            const payload = {
                module_name: 'services.ai.chat_service',
                method_name: 'chat',
                parameters: {
                    system: oldPayload.fromSystem,
                    user: oldPayload.fromUser,
                    stream: true
                }
            };
            if (oldPayload.images && Array.isArray(oldPayload.images) && oldPayload.images.length > 0) {
                payload.parameters.images = oldPayload.images;
            }
            if (oldPayload.model) {
                payload.parameters.model = oldPayload.model;
            }
            if (oldPayload.conversation_id) {
                payload.parameters.conversation_id = oldPayload.conversation_id;
            }

            // 调用大模型 API（使用流式接口）
            const apiUrl = PET_CONFIG.api.yiaiBaseUrl;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            // 使用通用的流式响应处理
            return await this.processStreamingResponse(response, onContent);
        } catch (error) {
            console.error('生成内容失败:', error);
            throw error;
        }
    };

    // 清理和优化文本
    proto._cleanAndOptimizeText = function(text) {
        if (!text || typeof text !== 'string') return '';
        let cleaned = text;
        // 1. 去除HTML标签（保留代码块中的内容）
        // 先保护代码块
        const codeBlocks = [];
        cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
            const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(match);
            return placeholder;
        });
        cleaned = cleaned.replace(/<[^>]+>/g, '');
        codeBlocks.forEach((block, index) => {
            cleaned = cleaned.replace(`__CODE_BLOCK_${index}__`, block);
        });
        // 2. 去除HTML实体编码（如 &nbsp; &lt; &gt; 等）
        cleaned = cleaned.replace(/&nbsp;/g, ' ');
        cleaned = cleaned.replace(/&lt;/g, '<');
        cleaned = cleaned.replace(/&gt;/g, '>');
        cleaned = cleaned.replace(/&amp;/g, '&');
        cleaned = cleaned.replace(/&quot;/g, '"');
        cleaned = cleaned.replace(/&#39;/g, "'");
        cleaned = cleaned.replace(/&[a-z]+;/gi, '');
        // 3. 去除无意义的重复内容
        // 去除重复的换行（保留代码块中的）
        const codeBlockPlaceholders = [];
        cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
            const placeholder = `__CODE_${codeBlockPlaceholders.length}__`;
            codeBlockPlaceholders.push(match);
            return placeholder;
        });
        cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
        codeBlockPlaceholders.forEach((block, index) => {
            cleaned = cleaned.replace(`__CODE_${index}__`, block);
        });
        // 4. 去除无意义的空白字符（但保留代码块和列表中的）
        // 保护代码块和列表项
        const protectedBlocks = [];
        cleaned = cleaned.replace(/(```[\s\S]*?```|^[\s]*[-*+]\s+|^\s*\d+\.\s+)/gm, (match) => {
            const placeholder = `__PROTECTED_${protectedBlocks.length}__`;
            protectedBlocks.push(match);
            return placeholder;
        });
        cleaned = cleaned.replace(/[ \t]+/g, (match, offset, string) => {
            const lineStart = string.lastIndexOf('\n', offset - 1) + 1;
            if (offset === lineStart) {
                return match.includes('\t') ? '\t' : ' ';
            }
            return ' ';
        });
        protectedBlocks.forEach((block, index) => {
            cleaned = cleaned.replace(`__PROTECTED_${index}__`, block);
        });
        // 5. 去除无意义的标记和符号
        cleaned = cleaned.replace(/\*\*\*\*/g, '');
        cleaned = cleaned.replace(/^#{7,}\s+/gm, '');
        // 6. 清理首尾空白
        cleaned = cleaned.trim();
        return cleaned;
    };

    // 优化上下文内容
    proto.optimizeContext = async function() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;

        const originalText = textarea.value.trim();
        if (!originalText) {
            this.showNotification('请先输入内容', 'warning');
            return;
        }

        if (!textarea.hasAttribute('data-original-text')) {
            textarea.setAttribute('data-original-text', originalText);
        }

        const optimizeBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-optimize-btn') : null;
        const undoBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-undo-btn') : null;
        const originalBtnText = optimizeBtn ? optimizeBtn.textContent : '';

        if (optimizeBtn) {
            optimizeBtn.disabled = true;
            optimizeBtn.textContent = '优化中...';
        }

        try {
            const systemPrompt = `你是一个专业的文档内容优化专家，擅长：
1. 保留原文的核心信息和完整内容，不丢失重要信息
2. 去除无意义的重复内容、冗余描述和无关信息
3. 优化和清理HTML标签，将HTML内容转换为清晰的Markdown格式
4. 优化文档结构和层次，使其逻辑清晰、层次分明
5. 改进语言表达，使其更加流畅自然、易于理解
6. 提升可读性，优化段落组织和过渡
7. 确保Markdown格式规范美观，标题层级清晰

请优化页面上下文内容，重点保留原文信息，去除无意义内容，优化HTML标签。`;

            const userPrompt = `请优化以下页面上下文内容，要求：

【核心要求】
1. **必须保留原文的所有核心信息和完整内容**，不能丢失重要信息
2. **去除无意义的重复内容、冗余描述、无关信息**（如重复的导航链接、广告文本、无意义的装饰性内容等）
3. **优化HTML标签**：将HTML标签转换为清晰的Markdown格式，去除无用的HTML标签，但保留文本内容
4. **优化文档结构**：使逻辑更清晰、层次更分明
5. **改进语言表达**：使其更加流畅自然
6. **提升可读性**：优化段落组织和过渡
7. **保持Markdown格式有效性**：确保标题层级清晰，段落之间过渡自然

【注意事项】
- 不要添加原文中没有的新内容
- 不要改变原文的核心意思
- 去除HTML标签时，要保留标签内的文本内容
- 去除无意义的导航、广告、重复性内容
- 保持Markdown格式的规范性

原始内容：
${originalText}

请直接返回优化后的Markdown内容，不要包含任何说明文字、引号或其他格式标记。`;

            const oldPayload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 转换为 services.ai.chat_service 格式
            const payload = {
                module_name: 'services.ai.chat_service',
                method_name: 'chat',
                parameters: {
                    system: oldPayload.fromSystem,
                    user: oldPayload.fromUser,
                    stream: false
                }
            };
            if (oldPayload.images && Array.isArray(oldPayload.images) && oldPayload.images.length > 0) {
                payload.parameters.images = oldPayload.images;
            }
            if (oldPayload.model) {
                payload.parameters.model = oldPayload.model;
            }
            if (oldPayload.conversation_id) {
                payload.parameters.conversation_id = oldPayload.conversation_id;
            }

            this._showLoadingAnimation();

            const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();
            let result;

            if (responseText.includes('data: ')) {
                const lines = responseText.split('\n');
                let accumulatedData = '';
                let lastValidData = null;

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr === '[DONE]' || dataStr === '') {
                                continue;
                            }
                            const chunk = JSON.parse(dataStr);
                            if (chunk.done === true) {
                                break;
                            }
                            if (chunk.data) {
                                // 支持嵌套格式: chunk.data.message
                                if (typeof chunk.data === 'object' && chunk.data.message) {
                                    accumulatedData += chunk.data.message;
                                } else if (typeof chunk.data === 'string') {
                                    accumulatedData += chunk.data;
                                }
                            } else if (chunk.content) {
                                accumulatedData += chunk.content;
                            } else if (chunk.message && chunk.message.content) {
                                accumulatedData += chunk.message.content;
                            } else if (typeof chunk === 'string') {
                                accumulatedData += chunk;
                            }
                            lastValidData = chunk;
                        } catch (e) {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr && dataStr !== '[DONE]') {
                                accumulatedData += dataStr;
                            }
                        }
                    }
                }

                if (accumulatedData || lastValidData) {
                    if (lastValidData && lastValidData.status) {
                        result = {
                            ...lastValidData,
                            data: accumulatedData || lastValidData.data || '',
                            content: accumulatedData || lastValidData.content || ''
                        };
                    } else {
                        result = {
                            data: accumulatedData,
                            content: accumulatedData
                        };
                    }
                } else {
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        throw new Error('无法解析响应格式');
                    }
                }
            } else {
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    throw new Error(`无法解析响应: ${e.message}`);
                }
            }

            this._hideLoadingAnimation();

            let optimizedText;
            if (result.status !== undefined && result.status !== 200) {
                throw new Error(result.msg || result.message || '优化失败');
            }

            if (result.data) {
                optimizedText = result.data;
            } else if (result.content) {
                optimizedText = result.content;
            } else if (result.message) {
                optimizedText = result.message;
            } else if (typeof result === 'string') {
                optimizedText = result;
            } else if (result.text) {
                optimizedText = result.text;
            } else {
                const possibleFields = ['output', 'response', 'result', 'answer'];
                for (const field of possibleFields) {
                    if (result[field] && typeof result[field] === 'string') {
                        optimizedText = result[field];
                        break;
                    }
                }
                if (!optimizedText) {
                    console.error('无法解析响应内容，响应对象:', result);
                    throw new Error('无法解析响应内容，请检查服务器响应格式');
                }
            }

            optimizedText = this.stripThinkContent(optimizedText);
            optimizedText = optimizedText.trim();

            const quotePairs = [
                ['"', '"'],
                ['"', '"'],
                ['"', '"'],
                ["'", "'"],
                ['`', '`'],
                ['「', '」'],
                ['『', '』']
            ];

            for (const [startQuote, endQuote] of quotePairs) {
                if (optimizedText.startsWith(startQuote) && optimizedText.endsWith(endQuote)) {
                    optimizedText = optimizedText.slice(startQuote.length, -endQuote.length).trim();
                }
            }

            const prefixes = [
                /^优化后的[内容上下文]：?\s*/i,
                /^以下是优化后的[内容上下文]：?\s*/i,
                /^优化结果：?\s*/i,
                /^优化后的文本：?\s*/i,
                /^优化后的[内容上下文]如下：?\s*/i,
                /^[内容上下文]优化如下：?\s*/i,
                /^以下是[优化后的]?[内容上下文]：?\s*/i,
                /^[内容上下文][已]?优化[结果]?：?\s*/i
            ];

            for (const prefix of prefixes) {
                optimizedText = optimizedText.replace(prefix, '').trim();
            }

            optimizedText = this._cleanAndOptimizeText(optimizedText);

            if (!optimizedText || optimizedText.length < 10) {
                throw new Error('优化后的文本过短，可能优化失败，请重试');
            }

            if (optimizedText === originalText) {
                this.showNotification('优化后的内容与原文相同', 'info');
            }

            textarea.value = optimizedText;
            textarea.setAttribute('data-optimized-text', optimizedText);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            if (undoBtn) {
                undoBtn.classList.add('js-visible');
            }

            const charCount = optimizedText.length;
            const originalCharCount = originalText.length;
            const changeInfo = charCount !== originalCharCount
                ? `（${originalCharCount}字 → ${charCount}字）`
                : `（${charCount}字）`;
            this.showNotification(`优化完成 ${changeInfo}`, 'success');
        } catch (error) {
            this._hideLoadingAnimation();
            console.error('优化上下文失败:', error);

            let errorMessage = '优化失败，请稍后重试';
            if (error.message) {
                if (error.message.includes('HTTP error')) {
                    errorMessage = '网络请求失败，请检查网络连接';
                } else if (error.message.includes('无法解析')) {
                    errorMessage = '服务器响应格式异常，请稍后重试';
                } else if (error.message.includes('过短')) {
                    errorMessage = error.message;
                } else {
                    errorMessage = error.message;
                }
            }

            this.showNotification(errorMessage, 'error');
        } finally {
            if (optimizeBtn) {
                optimizeBtn.disabled = false;
                optimizeBtn.textContent = originalBtnText;
            }
        }
    };

    // 翻译上下文内容
    proto.translateContext = async function(targetLang) {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;

        const originalText = textarea.value.trim();
        if (!originalText) {
            this.showNotification('请先输入内容', 'warning');
            return;
        }

        if (!textarea.hasAttribute('data-original-text')) {
            textarea.setAttribute('data-original-text', originalText);
        }

        const translateZhBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-translate-zh-btn') : null;
        const translateEnBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-translate-en-btn') : null;

        if (translateZhBtn) {
            translateZhBtn.disabled = true;
            translateZhBtn.setAttribute('data-translating', 'true');
            if (targetLang === 'zh') {
                translateZhBtn.textContent = '翻译中...';
            }
        }
        if (translateEnBtn) {
            translateEnBtn.disabled = true;
            translateEnBtn.setAttribute('data-translating', 'true');
            if (targetLang === 'en') {
                translateEnBtn.textContent = '翻译中...';
            }
        }

        try {
            const targetLanguage = targetLang === 'zh' ? '中文' : '英文';
            const systemPrompt = `你是一个专业的翻译专家，擅长将各种语言的内容准确、流畅地翻译成${targetLanguage}。请保持原文的格式、结构和语义，确保翻译准确、自然、流畅。`;

            const userPrompt = `请将以下内容翻译成${targetLanguage}，要求：
1. 保持原文的格式和结构（包括Markdown格式）
2. 翻译准确、自然、流畅
3. 保持专业术语的准确性
4. 不要添加任何说明文字、引号或其他格式标记
5. 直接返回翻译后的内容

原文内容：
${originalText}

请直接返回翻译后的${targetLanguage}内容，不要包含任何说明文字、引号或其他格式标记。`;

            const oldPayload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 转换为 services.ai.chat_service 格式
            const payload = {
                module_name: 'services.ai.chat_service',
                method_name: 'chat',
                parameters: {
                    system: oldPayload.fromSystem,
                    user: oldPayload.fromUser,
                    stream: false
                }
            };
            if (oldPayload.images && Array.isArray(oldPayload.images) && oldPayload.images.length > 0) {
                payload.parameters.images = oldPayload.images;
            }
            if (oldPayload.model) {
                payload.parameters.model = oldPayload.model;
            }
            if (oldPayload.conversation_id) {
                payload.parameters.conversation_id = oldPayload.conversation_id;
            }

            this._showLoadingAnimation();

            const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();
            let result;

            if (responseText.includes('data: ')) {
                const lines = responseText.split('\n');
                let accumulatedData = '';
                let lastValidData = null;

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr === '[DONE]' || dataStr === '') {
                                continue;
                            }
                            const chunk = JSON.parse(dataStr);
                            if (chunk.done === true) {
                                break;
                            }
                            if (chunk.data) {
                                // 支持嵌套格式: chunk.data.message
                                if (typeof chunk.data === 'object' && chunk.data.message) {
                                    accumulatedData += chunk.data.message;
                                } else if (typeof chunk.data === 'string') {
                                    accumulatedData += chunk.data;
                                }
                            } else if (chunk.content) {
                                accumulatedData += chunk.content;
                            } else if (chunk.message && chunk.message.content) {
                                accumulatedData += chunk.message.content;
                            } else if (typeof chunk === 'string') {
                                accumulatedData += chunk;
                            }
                            lastValidData = chunk;
                        } catch (e) {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr && dataStr !== '[DONE]') {
                                accumulatedData += dataStr;
                            }
                        }
                    }
                }

                if (accumulatedData || lastValidData) {
                    if (lastValidData && lastValidData.status) {
                        result = {
                            ...lastValidData,
                            data: accumulatedData || lastValidData.data || '',
                            content: accumulatedData || lastValidData.content || ''
                        };
                    } else {
                        result = {
                            data: accumulatedData,
                            content: accumulatedData
                        };
                    }
                } else {
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        throw new Error('无法解析响应格式');
                    }
                }
            } else {
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    throw new Error(`无法解析响应: ${e.message}`);
                }
            }

            this._hideLoadingAnimation();

            let translatedText;
            if (result.status !== undefined && result.status !== 200) {
                throw new Error(result.msg || result.message || '翻译失败');
            }

            if (result.data) {
                translatedText = result.data;
            } else if (result.content) {
                translatedText = result.content;
            } else if (result.message) {
                translatedText = result.message;
            } else if (typeof result === 'string') {
                translatedText = result;
            } else if (result.text) {
                translatedText = result.text;
            } else {
                const possibleFields = ['output', 'response', 'result', 'answer'];
                for (const field of possibleFields) {
                    if (result[field] && typeof result[field] === 'string') {
                        translatedText = result[field];
                        break;
                    }
                }
                if (!translatedText) {
                    console.error('无法解析响应内容，响应对象:', result);
                    throw new Error('无法解析响应内容，请检查服务器响应格式');
                }
            }

            translatedText = this.stripThinkContent(translatedText);
            translatedText = translatedText.trim();

            const quotePairs = [
                ['"', '"'],
                ['"', '"'],
                ['"', '"'],
                ["'", "'"],
                ['`', '`'],
                ['「', '」'],
                ['『', '』']
            ];

            for (const [startQuote, endQuote] of quotePairs) {
                if (translatedText.startsWith(startQuote) && translatedText.endsWith(endQuote)) {
                    translatedText = translatedText.slice(startQuote.length, -endQuote.length).trim();
                }
            }

            const prefixes = [
                /^翻译后的[内容上下文]：?\s*/i,
                /^以下是翻译后的[内容上下文]：?\s*/i,
                /^翻译结果：?\s*/i,
                /^翻译后的文本：?\s*/i,
                /^翻译后的[内容上下文]如下：?\s*/i,
                /^[内容上下文]翻译如下：?\s*/i,
                /^以下是翻译成[中文英文]的[内容上下文]：?\s*/i
            ];

            for (const prefix of prefixes) {
                translatedText = translatedText.replace(prefix, '').trim();
            }

            translatedText = translatedText.replace(/\n{4,}/g, '\n\n\n');
            translatedText = translatedText.replace(/[ \t]+/g, ' ');
            translatedText = translatedText.trim();

            if (!translatedText || translatedText.length < 10) {
                throw new Error('翻译后的文本过短，可能翻译失败，请重试');
            }

            if (translatedText === originalText) {
                this.showNotification('翻译后的内容与原文相同，可能已经是目标语言', 'info');
            }

            textarea.value = translatedText;
            textarea.setAttribute('data-translated-text', translatedText);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            const charCount = translatedText.length;
            const originalCharCount = originalText.length;
            const changeInfo = charCount !== originalCharCount
                ? `（${originalCharCount}字 → ${charCount}字）`
                : `（${charCount}字）`;
            this.showNotification(`翻译完成 ${changeInfo}`, 'success');
        } catch (error) {
            this._showLoadingAnimation();
            console.error('翻译上下文失败:', error);

            let errorMessage = '翻译失败，请稍后重试';
            if (error.message) {
                if (error.message.includes('HTTP error')) {
                    errorMessage = '网络请求失败，请检查网络连接';
                } else if (error.message.includes('无法解析')) {
                    errorMessage = '服务器响应格式异常，请稍后重试';
                } else if (error.message.includes('过短')) {
                    errorMessage = error.message;
                } else {
                    errorMessage = error.message;
                }
            }

            this.showNotification(errorMessage, 'error');
        } finally {
            if (translateZhBtn) {
                translateZhBtn.disabled = false;
                translateZhBtn.removeAttribute('data-translating');
                translateZhBtn.textContent = '🇨🇳 中文';
            }
            if (translateEnBtn) {
                translateEnBtn.disabled = false;
                translateEnBtn.removeAttribute('data-translating');
                translateEnBtn.textContent = '🇺🇸 英文';
            }
        }
    };

    // 构建会话上下文（包含消息历史和页面内容）
    proto.buildConversationContext = function() {
        const context = {
            messages: [],
            pageContent: '',
            hasHistory: false
        };

        // 获取当前会话
        if (this.currentSessionId && this.sessions[this.currentSessionId]) {
            const session = this.sessions[this.currentSessionId];

            // 获取消息历史（排除欢迎消息和按钮操作生成的消息）
            if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
                context.messages = session.messages.filter(msg => {
                    // 只包含用户消息和宠物消息，排除按钮操作生成的消息
                    return msg.type === 'user' || msg.type === 'pet';
                });
                context.hasHistory = context.messages.length > 0;
            }

            // 获取页面内容
            if (session.pageContent && session.pageContent.trim()) {
                context.pageContent = session.pageContent.trim();
            }
        }

        return context;
    };

    // 构建包含会话上下文的 fromUser 参数
    proto.buildFromUserWithContext = function(baseUserPrompt, roleLabel) {
        const _truncateText = (v, maxLen) => {
            const s = String(v ?? '');
            const limit = Math.max(0, Number(maxLen) || 0);
            if (!limit || s.length <= limit) return s;
            return `${s.slice(0, limit)}\n\n...(内容已截断)`;
        };

        // 检查页面上下文开关状态
        let includeContext = true; // 默认包含上下文
        const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null;
        if (contextSwitch) {
            includeContext = contextSwitch.checked;
        }

        const context = this.buildConversationContext();
        const pageContent = _truncateText(context.pageContent, 12000);

        // 如果 baseUserPrompt 已经包含了页面内容，根据开关状态决定是否替换或移除
        let finalBasePrompt = baseUserPrompt;
        if (baseUserPrompt.includes('页面内容（Markdown 格式）：')) {
            if (includeContext && context.pageContent) {
                // 开关打开且有会话页面内容：使用会话保存的页面上下文替换它
                const pageContentMatch = baseUserPrompt.match(/页面内容（Markdown 格式）：\s*\n([\s\S]*?)(?=\n\n|$)/);
                if (pageContentMatch) {
                    // 替换为会话保存的页面内容
                    finalBasePrompt = baseUserPrompt.replace(
                        /页面内容（Markdown 格式）：\s*\n[\s\S]*?(?=\n\n|$)/,
                        `页面内容（Markdown 格式）：\n${pageContent}`
                    );
                }
            } else if (!includeContext) {
                // 开关关闭：移除页面内容部分
                finalBasePrompt = baseUserPrompt.replace(
                    /页面内容（Markdown 格式）：\s*\n[\s\S]*?(?=\n\n|$)/,
                    '页面内容（Markdown 格式）：\n无内容（页面上下文已关闭）'
                );
            }
        }

        // 如果没有消息历史，直接使用基础提示词（可能已包含页面内容）
        if (!context.hasHistory) {
            // 如果开关打开、baseUserPrompt 中没有页面内容，但会话有页面内容，添加页面内容
            if (includeContext && pageContent && !finalBasePrompt.includes('页面内容（Markdown 格式）：')) {
                const pageContext = '\n\n## 页面内容：\n\n' + pageContent;
                return finalBasePrompt + pageContext;
            }
            return finalBasePrompt;
        }

        // 构建消息历史上下文
        let conversationContext = '';
        if (context.messages.length > 0) {
            conversationContext = '\n\n## 会话历史：\n\n';
            context.messages.slice(-30).forEach((msg, index) => {
                const role = msg.type === 'user' ? '用户' : '助手';
                const contentText = _truncateText(String(msg?.content || '').trim(), 12000);
                const imageList = Array.isArray(msg?.imageDataUrls)
                    ? msg.imageDataUrls
                    : (typeof msg?.imageDataUrl === 'string' && msg.imageDataUrl.trim() ? [msg.imageDataUrl.trim()] : []);
                const content = (() => {
                    if (contentText) return contentText;
                    if (imageList.length > 0) return imageList.length === 1 ? '[图片]' : `[图片 x${imageList.length}]`;
                    return '';
                })();
                if (!content) return;
                conversationContext += `${role}：${content}\n\n`;
            });
        }

        // 如果开关打开、baseUserPrompt 中没有页面内容，但会话有页面内容，添加页面内容
        let pageContext = '';
        if (includeContext && pageContent && !finalBasePrompt.includes('页面内容（Markdown 格式）：')) {
            pageContext = '\n\n## 页面内容：\n\n' + pageContent;
        }

        // 组合：基础提示词（已包含会话的页面上下文）+ 会话历史 + 页面内容（如果需要）
        return finalBasePrompt + conversationContext + pageContext;
    };

})();
