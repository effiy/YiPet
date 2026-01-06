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
    proto.generatePetResponseStream = async function(message, onContent, abortController = null) {
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
            let pageTitle = document.title || '当前页面';

            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];

                // 检查是否为空白会话（空白会话不应该填充页面内容）
                const isBlankSession = session._isBlankSession ||
                                      !session.url ||
                                      session.url.startsWith('blank-session://');

                // 如果会话有保存的页面内容，使用它
                if (session.pageContent && session.pageContent.trim() !== '') {
                    fullPageMarkdown = session.pageContent;
                    pageTitle = session.pageTitle || pageTitle;
                } else if (!isBlankSession) {
                    // 如果不是空白会话且没有保存的页面内容，获取当前页面内容并保存到会话
                    fullPageMarkdown = this.getPageContentAsMarkdown();
                    pageTitle = document.title || '当前页面';
                    session.pageContent = fullPageMarkdown;
                    session.pageTitle = pageTitle;
                    // 注意：已移除临时保存，页面内容会在 prompt 接口调用完成后统一保存
                } else {
                    // 空白会话：不填充页面内容，使用空内容
                    fullPageMarkdown = '';
                    pageTitle = session.pageTitle || '新会话';
                    console.log('空白会话，不填充页面内容');
                }
            } else {
                // 如果没有当前会话，使用当前页面内容
                fullPageMarkdown = this.getPageContentAsMarkdown();
            }

            // 构建包含页面内容的完整消息
            const pageUrl = window.location.href;

            // 根据开关状态决定是否包含页面内容
            let userMessage = message;
            if (includeContext && fullPageMarkdown) {
                userMessage = `【当前页面上下文】\n页面标题：${pageTitle}\n页面内容（Markdown 格式）：\n${fullPageMarkdown}\n\n【用户问题】\n${message}`;
            }

            // 调用 API，使用配置中的 URL
            const apiUrl = PET_CONFIG.api.streamPromptUrl;

            // 使用统一的 payload 构建函数，自动包含会话 ID 和 imageDataUrl
            const payload = this.buildPromptPayload(
                '你是一个俏皮活泼、古灵精怪的小女友，聪明有趣，时而调侃时而贴心。语气活泼可爱，会开小玩笑，但也会关心用户。',
                userMessage
            );

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
                                if (onContent) {
                                    // 实时显示时也去除 think 内容（可能不完整，但可以改善体验）
                                    onContent(chunk.message.content, this.stripThinkContent(fullContent));
                                }
                            }
                            // 支持旧的自定义格式: data.type === 'content'
                            else if (chunk.type === 'content') {
                                fullContent += chunk.data;
                                if (onContent) {
                                    // 实时显示时也去除 think 内容（可能不完整，但可以改善体验）
                                    onContent(chunk.data, this.stripThinkContent(fullContent));
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
                    console.log(`流式 prompt 接口调用后，会话 ${this.currentSessionId} 已保存到后端`);
                } catch (error) {
                    console.warn('流式 prompt 接口调用后保存会话失败:', error);
                }
            }

            // 返回去除 think 内容后的完整内容
            return this.stripThinkContent(fullContent);
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
            let pageTitle = document.title || '当前页面';

            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];

                // 检查是否为空白会话（空白会话不应该填充页面内容）
                const isBlankSession = session._isBlankSession ||
                                      !session.url ||
                                      session.url.startsWith('blank-session://');

                // 如果会话有保存的页面内容，使用它
                if (session.pageContent && session.pageContent.trim() !== '') {
                    fullPageMarkdown = session.pageContent;
                    pageTitle = session.pageTitle || pageTitle;
                } else if (!isBlankSession) {
                    // 如果不是空白会话且没有保存的页面内容，获取当前页面内容并保存到会话
                    fullPageMarkdown = this.getPageContentAsMarkdown();
                    pageTitle = document.title || '当前页面';
                    session.pageContent = fullPageMarkdown;
                    session.pageTitle = pageTitle;
                    // 注意：已移除临时保存，页面内容会在 prompt 接口调用完成后统一保存
                } else {
                    // 空白会话：不填充页面内容，使用空内容
                    fullPageMarkdown = '';
                    pageTitle = session.pageTitle || '新会话';
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
                userMessage = `【当前页面上下文】\n页面标题：${pageTitle}\n页面内容（Markdown 格式）：\n${fullPageMarkdown}\n\n【用户问题】\n${message}`;
            }

            // 使用统一的 payload 构建函数，自动包含会话 ID 和 imageDataUrl（如果是 qwen3-vl 模型）
            const payload = this.buildPromptPayload(
                '你是一个俏皮活泼、古灵精怪的小女友，聪明有趣，时而调侃时而贴心。语气活泼可爱，会开小玩笑，但也会关心用户。',
                userMessage
            );

            // 显示加载动画
            this._showLoadingAnimation();

            // 调用 API，使用配置中的 URL
            let response, result;
            try {
                response = await fetch(PET_CONFIG.api.promptUrl, {
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

})();

