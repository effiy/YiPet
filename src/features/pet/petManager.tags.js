/**
 * PetManager 标签管理模块
 * 扩展 PetManager.prototype
 */
(function() {
    'use strict';

    if (typeof window === 'undefined') return;

    // 确保 PetManager 类已定义
    if (typeof window.PetManager === 'undefined') {
        console.error('[TagManager] PetManager 未定义，无法扩展 TagManager 模块');
        return;
    }

    const proto = window.PetManager.prototype;
    
    console.log('[TagManager] 开始扩展 PetManager 原型，添加 openTagManager 方法');

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
            const currentTags = [...(session.tags || [])];

            // 创建标签管理弹窗
            this.ensureTagManagerUi();
            const overlay = document.querySelector('#pet-tag-manager');
            if (!overlay) {
                console.error('标签管理弹窗未找到');
                return;
            }

            // 创建标签副本，避免直接修改 session.tags
            overlay._currentTags = currentTags;

            // 显示弹窗
            overlay.classList.add('js-visible');
            overlay.dataset.sessionId = sessionId;

            // 加载当前标签
            this.loadTagsIntoManager(sessionId, currentTags);

            // 初始化快捷标签列表
            this.refreshQuickTags(overlay);

            // 添加关闭事件
            const closeBtn = overlay.querySelector('.tag-manager-close');
            if (closeBtn) {
                closeBtn.onclick = () => this.closeTagManager();
            }

            // 添加保存事件
            const saveBtn = overlay.querySelector('.tag-manager-save');
            if (saveBtn) {
                saveBtn.onclick = () => this.saveTags(sessionId);
            }

            // 添加输入框回车事件（兼容中文输入法）
            const tagInput = overlay.querySelector('.tag-manager-input');
            if (tagInput) {
                const existingHandler = tagInput._enterKeyHandler;
                if (existingHandler) {
                    tagInput.removeEventListener('keydown', existingHandler);
                }

                const enterKeyHandler = (e) => {
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
         * 获取所有会话的标签统计（用于标签建议）
         */
        proto.getAllTagsStatistics = function() {
            const tagStats = new Map();
            if (!this.sessions) return tagStats;

            Object.values(this.sessions).forEach(session => {
                if (session && session.tags && Array.isArray(session.tags)) {
                    session.tags.forEach(tag => {
                        if (tag && tag.trim()) {
                            const normalizedTag = tag.trim();
                            tagStats.set(normalizedTag, (tagStats.get(normalizedTag) || 0) + 1);
                        }
                    });
                }
            });

            return tagStats;
        };

        /**
         * 确保标签管理UI存在
         */
        proto.ensureTagManagerUi = function() {
            if (document.querySelector('#pet-tag-manager')) return;

            const overlay = document.createElement('div');
            overlay.id = 'pet-tag-manager';
            // 样式已通过 CSS 类定义

            // 点击背景关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    const sessionId = overlay.dataset.sessionId;
                    if (sessionId) {
                        this.closeTagManager();
                    }
                }
            });

            const modalContainer = document.createElement('div');
            modalContainer.className = 'tag-manager-modal-container';

            // 头部
            const header = document.createElement('div');
            header.className = 'tag-manager-header';

            const title = document.createElement('div');
            title.className = 'tag-manager-title';
            title.textContent = '🏷️ 管理标签';

            const closeBtn = document.createElement('div');
            closeBtn.className = 'tag-manager-close';
            closeBtn.innerHTML = '✕';
            closeBtn.onclick = () => this.closeTagManager();

            header.appendChild(title);
            header.appendChild(closeBtn);

            // 内容区域
            const content = document.createElement('div');
            content.className = 'tag-manager-content';

            // 输入区域
            const inputGroup = document.createElement('div');
            inputGroup.className = 'tag-manager-input-group';

            const tagInput = document.createElement('input');
            tagInput.className = 'tag-manager-input';
            tagInput.type = 'text';
            tagInput.placeholder = '输入标签名称，按回车添加';
            // 样式已通过 CSS 类定义

            tagInput._isComposing = false;
            tagInput.addEventListener('compositionstart', () => {
                tagInput._isComposing = true;
            });
            tagInput.addEventListener('compositionend', () => {
                tagInput._isComposing = false;
            });

            const addBtn = document.createElement('button');
            addBtn.className = 'tag-manager-add-btn';
            addBtn.textContent = '添加';
            // 样式已通过 CSS 类定义
            addBtn.addEventListener('click', () => {
                const sessionId = overlay.dataset.sessionId;
                if (sessionId) {
                    this.addTagFromInput(sessionId);
                }
            });

            // 智能生成标签按钮
            const smartGenerateBtn = document.createElement('button');
            smartGenerateBtn.className = 'tag-manager-smart-generate';
            smartGenerateBtn.textContent = '✨ 智能生成';
            // 样式已通过 CSS 类定义
            smartGenerateBtn.addEventListener('click', () => {
                const sessionId = overlay.dataset.sessionId;
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

            // 标签列表
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'tag-manager-tags';

            // 底部按钮
            const footer = document.createElement('div');
            footer.className = 'tag-manager-footer';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'tag-manager-cancel-btn';
            cancelBtn.textContent = '取消';
            cancelBtn.addEventListener('click', () => {
                const sessionId = overlay.dataset.sessionId;
                if (sessionId) {
                    this.closeTagManager();
                }
            });

            const saveBtn = document.createElement('button');
            saveBtn.className = 'tag-manager-save';
            saveBtn.textContent = '保存';

            footer.appendChild(cancelBtn);
            footer.appendChild(saveBtn);

            content.appendChild(inputGroup);
            content.appendChild(quickTagsContainer);
            content.appendChild(tagsContainer);
            content.appendChild(footer);
            modalContainer.appendChild(header);
            modalContainer.appendChild(content);
            overlay.appendChild(modalContainer);
            
            // 添加到聊天窗口
            if (this.chatWindow) {
                this.chatWindow.appendChild(overlay);
            } else {
                document.body.appendChild(overlay);
            }
        };

        /**
         * 加载标签到管理器
         */
        proto.loadTagsIntoManager = function(sessionId, tags) {
            const overlay = document.querySelector('#pet-tag-manager');
            if (!overlay) return;

            const tagsContainer = overlay.querySelector('.tag-manager-tags');
            if (!tagsContainer) return;

            tagsContainer.innerHTML = '';

            // 使用临时标签数据
            if (!overlay._currentTags) overlay._currentTags = [];
            if (tags) {
                overlay._currentTags = [...tags];
            }
            const currentTags = overlay._currentTags;

            if (!currentTags || currentTags.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'tag-manager-empty-msg';
                emptyMsg.textContent = '暂无标签';
                tagsContainer.appendChild(emptyMsg);
                // 更新快捷标签按钮状态
                this.updateQuickTagButtons(overlay, currentTags);
                return;
            }

            const tagColorCount = 8;

            currentTags.forEach((tag, index) => {
                const colorIndex = index % tagColorCount;
                const tagItem = document.createElement('div');
                tagItem.className = `tag-manager-tag-item tag-color-${colorIndex}`;
                tagItem.dataset.tagName = tag;
                tagItem.dataset.tagIndex = index;
                tagItem.draggable = true;

                const tagText = document.createElement('span');
                tagText.textContent = tag;

                const removeBtn = document.createElement('button');
                removeBtn.className = 'tag-remove-btn';
                removeBtn.innerHTML = '✕';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const sessionId = overlay.dataset.sessionId;
                    if (sessionId) {
                        this.removeTag(sessionId, index);
                    }
                });

                // 防止删除按钮触发拖拽
                removeBtn.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });

                // 拖拽功能（与 YiWeb 一致）
                tagItem.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', tag);
                    e.dataTransfer.setData('application/tag-index', index.toString());
                    tagItem.classList.add('tag-dragging');
                });

                tagItem.addEventListener('dragend', (e) => {
                    tagItem.classList.remove('tag-dragging');
                    const allTagItems = tagsContainer.querySelectorAll('.tag-manager-tag-item');
                    allTagItems.forEach(item => {
                        item.classList.remove('tag-drag-over-top', 'tag-drag-over-bottom', 'tag-drag-hover');
                    });
                });

                tagItem.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';

                    if (tagItem.classList.contains('tag-dragging')) {
                        return;
                    }

                    const rect = tagItem.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;

                    const allTagItems = tagsContainer.querySelectorAll('.tag-manager-tag-item');
                    allTagItems.forEach(item => {
                        if (!item.classList.contains('tag-dragging')) {
                            item.classList.remove('tag-drag-over-top', 'tag-drag-over-bottom', 'tag-drag-hover');
                        }
                    });

                    if (e.clientY < midY) {
                        tagItem.classList.add('tag-drag-over-top');
                        tagItem.classList.remove('tag-drag-over-bottom');
                    } else {
                        tagItem.classList.add('tag-drag-over-bottom');
                        tagItem.classList.remove('tag-drag-over-top');
                    }

                    tagItem.classList.add('tag-drag-hover');
                });

                tagItem.addEventListener('dragleave', (e) => {
                    const rect = tagItem.getBoundingClientRect();
                    const x = e.clientX;
                    const y = e.clientY;

                    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                        tagItem.classList.remove('tag-drag-over-top', 'tag-drag-over-bottom', 'tag-drag-hover');
                    }
                });

                tagItem.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const draggedTag = e.dataTransfer.getData('text/plain');
                    const draggedIndex = parseInt(e.dataTransfer.getData('application/tag-index') || '0', 10);
                    const targetIndex = parseInt(tagItem.dataset.tagIndex || '0', 10);

                    if (draggedTag === tag || draggedIndex === targetIndex) {
                        return;
                    }

                    const sessionId = overlay.dataset.sessionId;
                    if (!sessionId) return;

                    if (!overlay._currentTags) return;
                    const currentTags = overlay._currentTags;

                    const rect = tagItem.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    let insertIndex = targetIndex;
                    if (e.clientY < midY) {
                        insertIndex = targetIndex;
                    } else {
                        insertIndex = targetIndex + 1;
                    }

                    if (draggedIndex < insertIndex) {
                        insertIndex -= 1;
                    }

                    const newTags = [...currentTags];
                    newTags.splice(draggedIndex, 1);
                    newTags.splice(insertIndex, 0, draggedTag);

                    overlay._currentTags = newTags;
                    this.loadTagsIntoManager(sessionId, newTags);
                    this.updateQuickTagButtons(overlay, newTags);
                });

                tagItem.appendChild(tagText);
                tagItem.appendChild(removeBtn);
                tagsContainer.appendChild(tagItem);
            });

            // 更新快捷标签按钮状态
            this.updateQuickTagButtons(overlay, currentTags);
        };

        /**
         * 更新快捷标签按钮状态
         */
        proto.updateQuickTagButtons = function(overlay, currentTags) {
            if (!overlay) return;

            const quickTagButtons = overlay.querySelectorAll('.tag-manager-quick-tag-btn');
            quickTagButtons.forEach(btn => {
                const tagName = btn.dataset.tagName;
                const isAdded = currentTags && currentTags.includes(tagName);

                btn.classList.toggle('added', !!isAdded);
                btn.disabled = !!isAdded;
            });
        };

        /**
         * 刷新快捷标签列表
         */
        proto.refreshQuickTags = function(overlay) {
            if (!overlay) return;

            const quickTagsContainer = overlay.querySelector('.tag-manager-quick-tags');
            if (!quickTagsContainer) return;

            // 获取所有标签
            const getAllTags = () => {
                const tagSet = new Set();
                const sessions = this.sessions || {};
                Object.values(sessions).forEach(session => {
                    if (session && session.tags && Array.isArray(session.tags)) {
                        session.tags.forEach(tag => {
                            if (tag && tag.trim()) {
                                tagSet.add(tag.trim());
                            }
                        });
                    }
                });

                const allTagsArray = Array.from(tagSet);
                allTagsArray.sort();

                // 应用保存的标签顺序（从 localStorage）
                try {
                    const saved = localStorage.getItem('pet_tag_order');
                    const savedOrder = saved ? JSON.parse(saved) : null;
                    if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
                        const orderedTags = savedOrder.filter(tag => tagSet.has(tag));
                        const newTags = allTagsArray.filter(tag => !savedOrder.includes(tag));
                        return [...orderedTags, ...newTags];
                    }
                } catch (e) {
                    console.warn('[标签管理] 加载标签顺序失败:', e);
                }

                return allTagsArray;
            };

            const quickTags = getAllTags();
            quickTagsContainer.innerHTML = '';

            if (quickTags.length === 0) {
                const emptyHint = document.createElement('div');
                emptyHint.className = 'tag-manager-empty-msg';
                emptyHint.textContent = '暂无可用标签';
                quickTagsContainer.appendChild(emptyHint);
                return;
            }

            const sessionId = overlay.dataset.sessionId;
            const session = this.sessions[sessionId];
            const currentTags = overlay._currentTags || session?.tags || [];

            quickTags.forEach(tagName => {
                const isAdded = currentTags && currentTags.includes(tagName);
                const quickTagBtn = document.createElement('button');
                quickTagBtn.textContent = tagName;
                quickTagBtn.className = isAdded ? 'tag-manager-quick-tag-btn added' : 'tag-manager-quick-tag-btn';
                quickTagBtn.dataset.tagName = tagName;
                quickTagBtn.disabled = !!isAdded;

                quickTagBtn.addEventListener('click', () => {
                    if (isAdded) {
                        return;
                    }
                    const sessionId = overlay.dataset.sessionId;
                    if (sessionId) {
                        this.addQuickTag(sessionId, tagName);
                    }
                });
                quickTagsContainer.appendChild(quickTagBtn);
            });
        };

        /**
         * 从输入框添加标签
         */
        proto.addTagFromInput = function(sessionId) {
            const overlay = document.querySelector('#pet-tag-manager');
            if (!overlay) return;

            const tagInput = overlay.querySelector('.tag-manager-input');
            if (!tagInput) return;

            const tagName = tagInput.value.trim();
            if (!tagName) return;

            // 使用临时标签数据
            if (!overlay._currentTags) overlay._currentTags = [];
            const currentTags = overlay._currentTags;

            // 检查标签是否已存在
            if (currentTags.includes(tagName)) {
                tagInput.value = '';
                tagInput.focus();
                return;
            }

            // 添加标签
            currentTags.push(tagName);
            tagInput.value = '';
            tagInput.focus();

            // 重新加载标签列表
            this.loadTagsIntoManager(sessionId, currentTags);

            // 如果添加了新标签，刷新快捷标签列表
            setTimeout(() => {
                const overlay = document.querySelector('#pet-tag-manager');
                if (overlay) {
                    this.refreshQuickTags(overlay);
                }
            }, 100);
        };

        /**
         * 添加快捷标签
         */
        proto.addQuickTag = function(sessionId, tagName) {
            const overlay = document.querySelector('#pet-tag-manager');
            if (!overlay) return;

            // 使用临时标签数据
            if (!overlay._currentTags) overlay._currentTags = [];
            const currentTags = overlay._currentTags;

            // 检查标签是否已存在
            if (currentTags.includes(tagName)) {
                return;
            }

            // 添加标签
            currentTags.push(tagName);

            // 重新加载标签列表
            this.loadTagsIntoManager(sessionId, currentTags);

            // 更新快捷标签按钮状态
            this.updateQuickTagButtons(overlay, currentTags);
        };

        /**
         * 移除标签
         */
        proto.removeTag = function(sessionId, index) {
            const overlay = document.querySelector('#pet-tag-manager');
            if (!overlay) return;

            // 使用临时标签数据
            if (!overlay._currentTags) return;
            const currentTags = overlay._currentTags;

            currentTags.splice(index, 1);
            this.loadTagsIntoManager(sessionId, currentTags);

            // 更新快捷标签按钮状态
            this.updateQuickTagButtons(overlay, currentTags);

            // 如果删除的标签不再被任何会话使用，刷新快捷标签列表
            setTimeout(() => {
                this.refreshQuickTags(overlay);
            }, 100);
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
            const overlay = document.querySelector('#pet-tag-manager');

            if (!overlay) {
                console.error('标签管理弹窗未找到');
                return;
            }

            // 禁用按钮，显示加载状态
            if (buttonElement) {
                buttonElement.disabled = true;
                buttonElement.classList.add('is-loading');
                const originalText = buttonElement.textContent;
                buttonElement.textContent = '生成中...';

                try {
                    // 收集页面上下文信息
                    const title = (session.title || '当前页面');
                    const displayTitle = String(title).replace(/\.md$/i, '');
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
- 标题：${displayTitle}
- 网址：${pageUrl}`;

                    if (pageDescription) {
                        userPrompt += `\n- 描述：${pageDescription}`;
                    }

                    if (messageSummary) {
                        userPrompt += `\n\n会话内容摘要：\n${messageSummary}`;
                    }

                    const overlay = document.querySelector('#pet-tag-manager');
                    const currentTags = overlay?._currentTags || session.tags || [];
                    if (currentTags.length > 0) {
                        userPrompt += `\n\n已有标签：${currentTags.join(', ')}\n请避免生成重复的标签。`;
                    }

                    userPrompt += `\n\n请根据以上信息生成合适的标签。`;

                    // 构建 payload
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

                    // 调用 services.ai.chat_service 接口
                    const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(this.getAuthHeaders ? this.getAuthHeaders() : {}),
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

                        // 确保标签数组存在（使用临时标签数据）
                        const tagManagerOverlay = document.querySelector('#pet-tag-manager');
                        if (!tagManagerOverlay) return;
                        
                        if (!tagManagerOverlay._currentTags) tagManagerOverlay._currentTags = [];
                        const tagsList = tagManagerOverlay._currentTags;

                        // 添加新标签（排除已存在的标签）
                        let addedCount = 0;
                        generatedTags.forEach(tag => {
                            const trimmedTag = tag.trim();
                            if (trimmedTag && !tagsList.includes(trimmedTag)) {
                                tagsList.push(trimmedTag);
                                addedCount++;
                            }
                        });

                        if (addedCount > 0) {
                            // 重新加载标签列表
                            this.loadTagsIntoManager(sessionId, tagsList);

                            // 更新快捷标签按钮状态和列表
                            this.updateQuickTagButtons(tagManagerOverlay, tagsList);
                            setTimeout(() => {
                                this.refreshQuickTags(tagManagerOverlay);
                            }, 100);

                            console.log(`成功生成并添加 ${addedCount} 个标签:`, generatedTags.filter(tag => tagsList.includes(tag.trim())));
                        } else {
                            console.log('生成的标签都已存在，未添加新标签');
                        }

                } catch (error) {
                    console.error('智能生成标签失败:', error);

                    // 使用非阻塞的错误提示，避免阻塞弹框交互
                    const errorMessage = error.message || '未知错误';
                    const errorText = errorMessage.includes('Failed to fetch')
                        ? '网络连接失败，请检查网络后重试'
                        : `生成标签失败：${errorMessage}`;

                    // 在弹框内显示错误提示，而不是使用 alert（alert 会阻塞）
                    const overlay = document.querySelector('#pet-tag-manager');
                    if (overlay) {
                        // 移除已存在的错误提示
                        const existingError = overlay.querySelector('.tag-error-message');
                        if (existingError) {
                            existingError.remove();
                        }

                        // 创建错误提示元素
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'tag-error-message';
                        errorDiv.textContent = errorText;

                        const inputGroup = overlay.querySelector('.tag-manager-input-group');
                        if (inputGroup && inputGroup.parentNode) {
                            const tagsContainer = overlay.querySelector('.tag-manager-tags');
                            if (tagsContainer && tagsContainer.parentNode) {
                                tagsContainer.parentNode.insertBefore(errorDiv, tagsContainer);
                            } else {
                                inputGroup.parentNode.insertBefore(errorDiv, inputGroup.nextSibling);
                            }

                            // 3秒后自动移除错误提示
                            setTimeout(() => {
                                if (errorDiv.parentNode) {
                                    errorDiv.classList.add('is-hiding');
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
                        buttonElement.textContent = '✨ 智能生成';
                        buttonElement.classList.remove('is-loading');
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
                const overlay = document.querySelector('#pet-tag-manager');
                if (!overlay) return;

                const session = this.sessions[sessionId];
                
                // 从临时标签数据获取
                let newTags = [];
                if (overlay?._currentTags) {
                    newTags = [...overlay._currentTags];
                } else if (session.tags) {
                    newTags = [...session.tags];
                }

                // 规范化标签（trim处理，去重，过滤空标签）
                const normalizedTags = newTags
                    .map(tag => tag ? tag.trim() : '')
                    .filter(tag => tag.length > 0);
                const uniqueTags = [...new Set(normalizedTags)];

                // 更新会话标签
                session.tags = uniqueTags;
                session.updatedAt = Date.now();

                // 保存会话到本地
                await this.saveAllSessions(false, true);

                // 更新UI显示
                await this.updateSessionSidebar(true);

                // 显示成功提示
                if (this.showNotification) {
                    this.showNotification('标签已保存', 'success');
                }

                // 关闭弹窗
                this.closeTagManager();

                console.log('标签已保存:', uniqueTags);
            } catch (error) {
                console.error('保存标签失败:', error);
                if (this.showNotification) {
                    this.showNotification('保存标签失败，请重试', 'error');
                } else {
                    alert('保存标签失败，请重试');
                }
            }
        };

        /**
         * 关闭标签管理器
         */
        proto.closeTagManager = async function() {
            const overlay = document.querySelector('#pet-tag-manager');
            if (overlay) {
                overlay.classList.remove('js-visible');
                
                // 清空临时数据
                if (overlay?._currentTags) {
                    delete overlay._currentTags;
                }
                
                const tagInput = overlay?.querySelector('.tag-manager-input');
                if (tagInput) {
                    tagInput.value = '';
                }
            }
        };
    
    console.log('[TagManager] 所有方法已添加到原型');
})();
