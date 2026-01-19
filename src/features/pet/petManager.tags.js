/**
 * PetManager 标签管理模块
 * 扩展 PetManager.prototype
 */
(function() {
    'use strict';

    if (typeof window === 'undefined') return;

    // 辅助函数：确保 PetManager 已加载
    function extendPetManager() {
        if (typeof window.PetManager === 'undefined') {
            setTimeout(extendPetManager, 100);
            return;
        }

        const proto = window.PetManager.prototype;

        /**
         * 根据标签名称生成颜色（确保相同标签颜色一致）
         */
        proto.getTagColor = function(tagName) {
            // 预定义的配色方案（柔和的渐变色）
            const colorPalettes = [
                // 蓝色系
                { background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', text: '#0369a1', border: '#7dd3fc' },
                // 绿色系
                { background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', text: '#166534', border: '#86efac' },
                // 紫色系
                { background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', text: '#6b21a8', border: '#c084fc' },
                // 粉色系
                { background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)', text: '#9f1239', border: '#f9a8d4' },
                // 橙色系
                { background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', text: '#9a3412', border: '#fdba74' },
                // 青色系
                { background: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)', text: '#164e63', border: '#67e8f9' },
                // 红色系
                { background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', text: '#991b1b', border: '#fca5a5' },
                // 黄色系
                { background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)', text: '#854d0e', border: '#fde047' },
                // 靛蓝色系
                { background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', text: '#3730a3', border: '#a5b4fc' },
                // 玫瑰色系
                { background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', text: '#9f1239', border: '#fda4af' }
            ];

            // 使用简单的哈希函数将标签名称映射到颜色索引
            let hash = 0;
            for (let i = 0; i < tagName.length; i++) {
                hash = ((hash << 5) - hash) + tagName.charCodeAt(i);
                hash = hash & hash; // 转换为32位整数
            }

            // 确保索引为正数并在范围内
            const index = Math.abs(hash) % colorPalettes.length;
            return colorPalettes[index];
        };

        /**
         * 打开标签管理弹窗
         */
        proto.openTagManager = function(sessionId) {
            if (!sessionId || !this.sessions[sessionId]) {
                console.warn('会话不存在，无法管理标签:', sessionId);
                return;
            }

            const session = this.sessions[sessionId];
            const currentTags = session.tags || [];

            // 创建标签管理弹窗
            this.ensureTagManagerUi();
            const modal = this.chatWindow?.querySelector('#pet-tag-manager');
            if (!modal) {
                console.error('标签管理弹窗未找到');
                return;
            }

            // 显示弹窗
            modal.style.display = 'flex';
            modal.dataset.sessionId = sessionId;

            // 隐藏折叠按钮（避免在弹框中显示两个折叠按钮）
            const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
            const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
            if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
            if (inputToggleBtn) inputToggleBtn.style.display = 'none';

            // 加载当前标签
            this.loadTagsIntoManager(sessionId, currentTags);

            // 添加关闭事件
            const closeBtn = modal.querySelector('.tag-manager-close');
            if (closeBtn) {
                closeBtn.onclick = () => this.closeTagManager();
            }

            // 添加保存事件
            const saveBtn = modal.querySelector('.tag-manager-save');
            if (saveBtn) {
                saveBtn.onclick = () => this.saveTags(sessionId);
            }

            // 添加输入框回车事件（兼容中文输入法）
            const tagInput = modal.querySelector('.tag-manager-input');
            if (tagInput) {
                // 确保输入法组合状态已初始化（如果输入框是新创建的）
                if (tagInput._isComposing === undefined) {
                    tagInput._isComposing = false;
                    tagInput.addEventListener('compositionstart', () => {
                        tagInput._isComposing = true;
                    });
                    tagInput.addEventListener('compositionend', () => {
                        tagInput._isComposing = false;
                    });
                }

                // 添加回车键事件处理（移除旧的监听器，避免重复绑定）
                const existingHandler = tagInput._enterKeyHandler;
                if (existingHandler) {
                    tagInput.removeEventListener('keydown', existingHandler);
                }

                const enterKeyHandler = (e) => {
                    // 如果在输入法组合过程中，忽略回车键
                    if (tagInput._isComposing) {
                        return;
                    }

                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.addTagFromInput(sessionId);
                    }
                };

                tagInput._enterKeyHandler = enterKeyHandler;
                tagInput.addEventListener('keydown', enterKeyHandler);

                tagInput.focus();
            }

            // ESC 键关闭
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.closeTagManager();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        };

        /**
         * 确保标签管理UI存在
         */
        proto.ensureTagManagerUi = function() {
            if (!this.chatWindow) return;
            if (this.chatWindow.querySelector('#pet-tag-manager')) return;

            const modal = document.createElement('div');
            modal.id = 'pet-tag-manager';
            modal.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background: rgba(0, 0, 0, 0.5) !important;
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: 10000 !important;
            `;

            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeTagManager();
                }
            });

            const panel = document.createElement('div');
            panel.style.cssText = `
                background: #1e293b !important;  /* 量子灰 */
                border-radius: 12px !important;
                padding: 24px !important;
                width: 90% !important;
                max-width: 800px !important;
                max-height: 80vh !important;
                overflow-y: auto !important;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2) !important;
            `;

            // 标题
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 20px !important;
            `;

            const title = document.createElement('h3');
            title.textContent = '管理标签';
            title.style.cssText = `
                margin: 0 !important;
                font-size: 18px !important;
                font-weight: 600 !important;
                color: #f8fafc !important;  /* 量子白 */
            `;

            const closeBtn = document.createElement('button');
            closeBtn.className = 'tag-manager-close';
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = `
                background: none !important;
                border: none !important;
                font-size: 24px !important;
                cursor: pointer !important;
                color: #999 !important;
                padding: 0 !important;
                width: 30px !important;
                height: 30px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 4px !important;
                transition: all 0.2s ease !important;
            `;
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = '#f0f0f0';
                closeBtn.style.color = '#f8fafc';  /* 量子白 */
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'none';
                closeBtn.style.color = '#999';
            });

            header.appendChild(title);
            header.appendChild(closeBtn);

            // 输入区域
            const inputGroup = document.createElement('div');
            inputGroup.className = 'tag-manager-input-group';
            inputGroup.style.cssText = `
                display: flex !important;
                gap: 8px !important;
                margin-bottom: 20px !important;
            `;

            const tagInput = document.createElement('input');
            tagInput.className = 'tag-manager-input';
            tagInput.type = 'text';
            tagInput.placeholder = '输入标签名称，按回车添加';
            tagInput.style.cssText = `
                flex: 1 !important;
                padding: 10px 12px !important;
                border: 2px solid #e0e0e0 !important;
                border-radius: 6px !important;
                font-size: 14px !important;
                outline: none !important;
                transition: border-color 0.2s ease !important;
            `;

            // 输入法组合状态跟踪（用于处理中文输入）
            // 将状态存储在输入框元素上，便于后续访问
            tagInput._isComposing = false;
            tagInput.addEventListener('compositionstart', () => {
                tagInput._isComposing = true;
            });
            tagInput.addEventListener('compositionend', () => {
                tagInput._isComposing = false;
            });

            tagInput.addEventListener('focus', () => {
                tagInput.style.borderColor = '#22c55e';  /* 现代绿 */
            });
            tagInput.addEventListener('blur', () => {
                tagInput.style.borderColor = '#e0e0e0';
            });

            const addBtn = document.createElement('button');
            addBtn.textContent = '添加';
            addBtn.className = 'tag-manager-add-btn';
            addBtn.addEventListener('click', () => {
                const sessionId = modal.dataset.sessionId;
                if (sessionId) {
                    this.addTagFromInput(sessionId);
                }
            });

            // 智能生成标签按钮
            const smartGenerateBtn = document.createElement('button');
            smartGenerateBtn.className = 'tag-manager-smart-generate';
            smartGenerateBtn.textContent = '✨ 智能生成';
            smartGenerateBtn.addEventListener('click', () => {
                const sessionId = modal.dataset.sessionId;
                if (sessionId) {
                    this.generateSmartTags(sessionId, smartGenerateBtn);
                }
            });

            inputGroup.appendChild(tagInput);
            inputGroup.appendChild(addBtn);
            inputGroup.appendChild(smartGenerateBtn);

            // 快捷标签按钮容器
            const quickTagsContainer = document.createElement('div');
            quickTagsContainer.className = 'tag-manager-quick-tags';

            // 快捷标签列表
            const quickTags = ['工具', '开源项目', '家庭', '工作', '娱乐', '文档', '日记'];

            quickTags.forEach(tagName => {
                const quickTagBtn = document.createElement('button');
                quickTagBtn.textContent = tagName;
                quickTagBtn.className = 'tag-manager-quick-tag-btn';
                quickTagBtn.dataset.tagName = tagName;
                quickTagBtn.addEventListener('click', () => {
                    // 如果标签已添加，不执行操作
                    if (quickTagBtn.classList.contains('added')) {
                        return;
                    }
                    const sessionId = modal.dataset.sessionId;
                    if (sessionId) {
                        this.addQuickTag(sessionId, tagName);
                    }
                });
                quickTagsContainer.appendChild(quickTagBtn);
            });

            // 标签列表
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'tag-manager-tags';

            // 底部按钮
            const footer = document.createElement('div');
            footer.className = 'tag-manager-footer';

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '取消';
            cancelBtn.className = 'tag-manager-cancel';
            cancelBtn.addEventListener('click', () => this.closeTagManager());

            const saveBtn = document.createElement('button');
            saveBtn.className = 'tag-manager-save';
            saveBtn.textContent = '保存';

            footer.appendChild(cancelBtn);
            footer.appendChild(saveBtn);

            panel.appendChild(header);
            panel.appendChild(inputGroup);
            panel.appendChild(quickTagsContainer);
            panel.appendChild(tagsContainer);
            panel.appendChild(footer);
            modal.appendChild(panel);
            this.chatWindow.appendChild(modal);
        };

        /**
         * 加载标签到管理器
         */
        proto.loadTagsIntoManager = function(sessionId, tags) {
            const modal = this.chatWindow?.querySelector('#pet-tag-manager');
            if (!modal) return;

            const tagsContainer = modal.querySelector('.tag-manager-tags');
            if (!tagsContainer) return;

            tagsContainer.innerHTML = '';

            if (!tags || tags.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.textContent = '暂无标签';
                emptyMsg.className = 'tag-manager-empty-msg';
                tagsContainer.appendChild(emptyMsg);
                return;
            }

            tags.forEach((tag, index) => {
                const tagItem = document.createElement('div');
                tagItem.className = 'tag-manager-tag-item';

                const tagText = document.createElement('span');
                tagText.textContent = tag;

                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '✕';
                removeBtn.className = 'tag-manager-remove-btn';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sessionId = modal.dataset.sessionId;
                    if (sessionId) {
                        this.removeTag(sessionId, index);
                    }
                });

                tagItem.appendChild(tagText);
                tagItem.appendChild(removeBtn);
                tagsContainer.appendChild(tagItem);
            });

            // 更新快捷标签按钮状态
            const quickTagButtons = modal.querySelectorAll('.tag-manager-quick-tag-btn');
            quickTagButtons.forEach(btn => {
                const tagName = btn.dataset.tagName;
                const isAdded = tags && tags.includes(tagName);
                btn.classList.toggle('added', !!isAdded);
            });
        };

        /**
         * 从输入框添加标签
         */
        proto.addTagFromInput = function(sessionId) {
            const modal = this.chatWindow?.querySelector('#pet-tag-manager');
            if (!modal) return;

            const tagInput = modal.querySelector('.tag-manager-input');
            if (!tagInput) return;

            const tagName = tagInput.value.trim();
            if (!tagName) return;

            const session = this.sessions[sessionId];
            if (!session) return;

            if (!session.tags) {
                session.tags = [];
            }

            // 检查标签是否已存在
            if (session.tags.includes(tagName)) {
                tagInput.value = '';
                tagInput.focus();
                return;
            }

            // 添加标签
            session.tags.push(tagName);
            tagInput.value = '';
            tagInput.focus();

            // 重新加载标签列表
            this.loadTagsIntoManager(sessionId, session.tags);
        };

        /**
         * 添加快捷标签
         */
        proto.addQuickTag = function(sessionId, tagName) {
            const modal = this.chatWindow?.querySelector('#pet-tag-manager');
            if (!modal) return;

            const session = this.sessions[sessionId];
            if (!session) return;

            if (!session.tags) {
                session.tags = [];
            }

            // 检查标签是否已存在
            if (session.tags.includes(tagName)) {
                return;
            }

            // 添加标签
            session.tags.push(tagName);

            // 重新加载标签列表
            this.loadTagsIntoManager(sessionId, session.tags);
        };

        /**
         * 移除标签
         */
        proto.removeTag = function(sessionId, index) {
            const session = this.sessions[sessionId];
            if (!session || !session.tags) return;

            session.tags.splice(index, 1);
            this.loadTagsIntoManager(sessionId, session.tags);
        };

        /**
         * 智能生成标签
         */
        proto.generateSmartTags = async function(sessionId, buttonElement) {
            if (!sessionId || !this.sessions[sessionId]) {
                console.warn('会话不存在，无法生成标签:', sessionId);
                return;
            }

            const session = this.sessions[sessionId];
            const modal = this.chatWindow?.querySelector('#pet-tag-manager');

            if (!modal) {
                console.error('标签管理弹窗未找到');
                return;
            }

            // 禁用按钮，显示加载状态
            // 临时保存当前会话ID，以便生成标签后恢复
            const originalSessionId = this.currentSessionId;

            if (buttonElement) {
                buttonElement.disabled = true;
                buttonElement.style.background = '#ccc';
                buttonElement.style.cursor = 'not-allowed';
                const originalText = buttonElement.textContent;
                buttonElement.textContent = '生成中...';

                try {
                    // 收集页面上下文信息
                    const pageTitle = session.pageTitle || '当前页面';
                    const pageUrl = session.url || window.location.href;
                    const pageDescription = session.pageDescription || '';

                    // 获取会话消息摘要（取前5条消息作为上下文）
                    let messageSummary = '';
                    if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
                        const recentMessages = session.messages.slice(0, 5);
                        messageSummary = recentMessages.map((msg, idx) => {
                            const role = msg.role === 'user' ? '用户' : '助手';
                            const content = msg.content || '';
                            // 不再限制每条消息长度，显示完整内容
                            return `${idx + 1}. ${role}: ${content}`;
                        }).join('\n');
                    }

                    // 构建系统提示词
                    const systemPrompt = `你是一个专业的标签生成助手。根据用户提供的页面上下文和会话内容，生成合适的标签。

标签要求：
1. 标签应该简洁明了，每个标签2-6个汉字或3-12个英文字符
2. 标签应该准确反映页面或会话的核心主题
3. 生成3-8个标签
4. 标签之间用逗号分隔
5. 只返回标签，不要返回其他说明文字
6. 如果已有标签，避免生成重复的标签

输出格式示例：技术,编程,前端开发,JavaScript`;

                    // 构建用户提示词
                    let userPrompt = `页面信息：
- 标题：${pageTitle}
- 网址：${pageUrl}`;

                    if (pageDescription) {
                        userPrompt += `\n- 描述：${pageDescription}`;
                    }

                    if (messageSummary) {
                        userPrompt += `\n\n会话内容摘要：\n${messageSummary}`;
                    }

                    const currentTags = session.tags || [];
                    if (currentTags.length > 0) {
                        userPrompt += `\n\n已有标签：${currentTags.join(', ')}\n请避免生成重复的标签。`;
                    }

                    userPrompt += `\n\n请根据以上信息生成合适的标签。`;

                    // 构建 payload

                    // 临时设置会话ID为目标会话ID，确保 prompt 接口使用正确的会话上下文
                    this.currentSessionId = sessionId;

                    try {
                        const payload = this.buildPromptPayload(
                            systemPrompt,
                            userPrompt,
                            this.currentModel || ((PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || 'qwen3')
                        );

                        // 确保 payload 中包含正确的会话ID
                        payload.conversation_id = sessionId;

                        // 调用 prompt 接口
                        const response = await fetch(PET_CONFIG.api.promptUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(payload)
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                        }

                        // 先读取响应文本，判断是否为流式响应（SSE格式）
                        const responseText = await response.text();
                        let result;

                        // 检查是否包含SSE格式（包含 "data: "）
                        if (responseText.includes('data: ')) {
                            // 处理SSE流式响应
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

                                        // 尝试解析JSON
                                        const chunk = JSON.parse(dataStr);

                                        // 检查是否完成
                                        if (chunk.done === true) {
                                            break;
                                        }

                                        // 累积内容（处理流式内容块）
                                        if (chunk.data) {
                                            accumulatedData += chunk.data;
                                        } else if (chunk.content) {
                                            accumulatedData += chunk.content;
                                        } else if (chunk.message && chunk.message.content) {
                                            // Ollama格式
                                            accumulatedData += chunk.message.content;
                                        } else if (typeof chunk === 'string') {
                                            accumulatedData += chunk;
                                        }

                                        // 保存最后一个有效的数据块（用于提取其他字段如status等）
                                        lastValidData = chunk;
                                    } catch (e) {
                                        // 如果不是JSON，可能是纯文本内容
                                        const dataStr = trimmedLine.substring(6).trim();
                                        if (dataStr && dataStr !== '[DONE]') {
                                            accumulatedData += dataStr;
                                        }
                                    }
                                }
                            }

                            // 如果累积了内容，创建结果对象
                            if (accumulatedData || lastValidData) {
                                if (lastValidData && lastValidData.status) {
                                    // 如果有status字段，保留原有结构，但替换data/content
                                    result = {
                                        ...lastValidData,
                                        data: accumulatedData || lastValidData.data || '',
                                        content: accumulatedData || lastValidData.content || ''
                                    };
                                } else {
                                    // 否则创建新的结果对象
                                    result = {
                                        data: accumulatedData,
                                        content: accumulatedData
                                    };
                                }
                            } else {
                                // 如果无法解析SSE格式，尝试直接解析整个响应
                                try {
                                    result = JSON.parse(responseText);
                                } catch (e) {
                                    throw new Error('无法解析响应格式');
                                }
                            }
                        } else {
                            // 非SSE格式，直接解析JSON
                            try {
                                result = JSON.parse(responseText);
                            } catch (e) {
                                // 如果解析失败，尝试查找SSE格式的数据
                                const sseMatch = responseText.match(/data:\s*({.+?})/s);
                                if (sseMatch) {
                                    result = JSON.parse(sseMatch[1]);
                                } else {
                                    throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                                }
                            }
                        }

                        // 解析返回的标签
                        let generatedTags = [];
                        // 适配响应格式: {status, msg, data, pagination} 或 {content} 或 {response}
                        let content = '';
                        if (result.data) {
                            content = result.data;
                        } else if (result.content) {
                            content = result.content;
                        } else if (result.response) {
                            content = result.response;
                        }

                        if (content) {
                            const trimmedContent = content.trim();

                            // 尝试解析 JSON 格式
                            try {
                                const parsed = JSON.parse(trimmedContent);
                                if (Array.isArray(parsed)) {
                                    generatedTags = parsed;
                                } else if (typeof parsed === 'object' && parsed.tags) {
                                    generatedTags = Array.isArray(parsed.tags) ? parsed.tags : [];
                                }
                            } catch (e) {
                                // 如果不是 JSON，尝试按逗号分割
                                generatedTags = trimmedContent.split(/[,，、]/).map(tag => tag.trim()).filter(tag => tag.length > 0);
                            }
                        }

                        if (generatedTags.length === 0) {
                            throw new Error('未能生成有效标签，请重试');
                        }

                        // 确保标签数组存在
                        if (!session.tags) {
                            session.tags = [];
                        }

                        // 添加新标签（排除已存在的标签）
                        let addedCount = 0;
                        generatedTags.forEach(tag => {
                            const trimmedTag = tag.trim();
                            if (trimmedTag && !session.tags.includes(trimmedTag)) {
                                session.tags.push(trimmedTag);
                                addedCount++;
                            }
                        });

                        if (addedCount > 0) {
                            // 重新加载标签列表
                            this.loadTagsIntoManager(sessionId, session.tags);
                            console.log(`成功生成并添加 ${addedCount} 个标签:`, generatedTags.filter(tag => session.tags.includes(tag.trim())));
                        } else {
                            console.log('生成的标签都已存在，未添加新标签');
                        }

                    } finally {
                        // 恢复原始会话ID
                        this.currentSessionId = originalSessionId;
                    }

                } catch (error) {
                    console.error('智能生成标签失败:', error);

                    // 使用非阻塞的错误提示，避免阻塞弹框交互
                    const errorMessage = error.message || '未知错误';
                    const errorText = errorMessage.includes('Failed to fetch')
                        ? '网络连接失败，请检查网络后重试'
                        : `生成标签失败：${errorMessage}`;

                    // 在弹框内显示错误提示，而不是使用 alert（alert 会阻塞）
                    const modal = this.chatWindow?.querySelector('#pet-tag-manager');
                    if (modal) {
                        // 移除已存在的错误提示
                        const existingError = modal.querySelector('.tag-error-message');
                        if (existingError) {
                            existingError.remove();
                        }

                        // 创建错误提示元素
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'tag-error-message';
                        errorDiv.textContent = errorText;
                        errorDiv.style.cssText = `
                            padding: 10px 15px !important;
                            margin: 10px 0 !important;
                            background: #ffebee !important;
                            color: #c62828 !important;
                            border: 1px solid #ef5350 !important;
                            border-radius: 6px !important;
                            font-size: 13px !important;
                            animation: fadeIn 0.3s ease !important;
                        `;

                        // 插入到输入组下方
                        const inputGroup = modal.querySelector('.tag-manager-input-group');
                        if (inputGroup && inputGroup.parentNode) {
                            // 插入到输入组和标签容器之间
                            const tagsContainer = modal.querySelector('.tag-manager-tags');
                            if (tagsContainer && tagsContainer.parentNode) {
                                tagsContainer.parentNode.insertBefore(errorDiv, tagsContainer);
                            } else {
                                inputGroup.parentNode.insertBefore(errorDiv, inputGroup.nextSibling);
                            }

                            // 3秒后自动移除错误提示
                            setTimeout(() => {
                                if (errorDiv.parentNode) {
                                    errorDiv.style.opacity = '0';
                                    errorDiv.style.transition = 'opacity 0.3s ease';
                                    setTimeout(() => {
                                        if (errorDiv.parentNode) {
                                            errorDiv.remove();
                                        }
                                    }, 300);
                                }
                            }, 3000);
                        }
                    } else {
                        // 如果弹框不存在，使用 alert 作为后备方案
                        alert(errorText);
                    }
                } finally {
                    // 恢复按钮状态
                    if (buttonElement) {
                        buttonElement.disabled = false;
                        buttonElement.style.background = '#9C27B0';
                        buttonElement.style.cursor = 'pointer';
                        buttonElement.textContent = '✨ 智能生成';
                    }

                    // 确保恢复原始会话ID（即使出错）
                    if (this.currentSessionId !== originalSessionId) {
                        this.currentSessionId = originalSessionId;
                    }

                    // 确保弹框本身没有被禁用（防止其他按钮失效）
                    const modal = this.chatWindow?.querySelector('#pet-tag-manager');
                    if (modal) {
                        modal.style.pointerEvents = 'auto';
                        // 确保所有按钮都是可用的
                        const allButtons = modal.querySelectorAll('button');
                        allButtons.forEach(btn => {
                            if (btn !== buttonElement) {
                                btn.disabled = false;
                                btn.style.pointerEvents = 'auto';
                                btn.style.cursor = 'pointer';
                            }
                        });
                    }
                }
            }
        };

        /**
         * 保存标签
         */
        proto.saveTags = async function(sessionId) {
            if (!sessionId || !this.sessions[sessionId]) {
                console.warn('会话不存在，无法保存标签:', sessionId);
                return;
            }

            try {
                const session = this.sessions[sessionId];
                // 规范化标签（trim处理，去重，过滤空标签）
                if (session.tags && Array.isArray(session.tags)) {
                    const normalizedTags = session.tags
                        .map(tag => tag ? tag.trim() : '')
                        .filter(tag => tag.length > 0);
                    // 去重
                    session.tags = [...new Set(normalizedTags)];
                }
                session.updatedAt = Date.now();

                // 保存会话到本地
                await this.saveAllSessions(false, true);

                // 立即同步到后端（确保标签被保存）
                if (PET_CONFIG.api.syncSessionsToBackend && this.sessionApi) {
                    await this.syncSessionToBackend(sessionId, true);
                }

                // 更新UI显示
                await this.updateSessionSidebar(true);

                // 关闭弹窗（不自动保存，因为已经保存过了）
                const modal = this.chatWindow?.querySelector('#pet-tag-manager');
                if (modal) {
                    modal.style.display = 'none';
                    const tagInput = modal.querySelector('.tag-manager-input');
                    if (tagInput) {
                        tagInput.value = '';
                    }
                }

                console.log('标签已保存:', session.tags);
            } catch (error) {
                console.error('保存标签失败:', error);
                alert('保存标签失败，请重试');
            }
        };

        /**
         * 关闭标签管理器（自动保存）
         */
        proto.closeTagManager = async function() {
            const modal = this.chatWindow?.querySelector('#pet-tag-manager');
            if (modal) {
                const sessionId = modal.dataset.sessionId;
                // 关闭前自动保存
                if (sessionId && this.sessions[sessionId]) {
                    try {
                        const session = this.sessions[sessionId];
                        // 规范化标签（trim处理，去重，过滤空标签）
                        if (session.tags && Array.isArray(session.tags)) {
                            const normalizedTags = session.tags
                                .map(tag => tag ? tag.trim() : '')
                                .filter(tag => tag.length > 0);
                            // 去重
                            session.tags = [...new Set(normalizedTags)];
                        }
                        session.updatedAt = Date.now();
                        await this.saveAllSessions(false, true);

                        // 立即同步到后端（确保标签被保存）
                        if (PET_CONFIG.api.syncSessionsToBackend && this.sessionApi) {
                            await this.syncSessionToBackend(sessionId, true);
                        }

                        await this.updateSessionSidebar(true);
                    } catch (error) {
                        console.error('自动保存标签失败:', error);
                    }
                }

                modal.style.display = 'none';

                // 显示折叠按钮
                const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
                const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
                if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
                if (inputToggleBtn) inputToggleBtn.style.display = 'flex';

                const tagInput = modal.querySelector('.tag-manager-input');
                if (tagInput) {
                    tagInput.value = '';
                }
            }
        };
    }

    extendPetManager();
})();
