(function() {
    'use strict';

    // 确保 PetManager 类已定义
    if (typeof window.PetManager === 'undefined') {
        console.error('[SessionEditor] PetManager 未定义，无法扩展 SessionEditor 模块');
        return;
    }

    const proto = window.PetManager.prototype;

    const ensureMdSuffix = (str) => {
        if (!str || !String(str).trim()) return '';
        const s = String(str).trim();
        return s.endsWith('.md') ? s : `${s}.md`;
    };

    const stripMdSuffix = (str) => {
        const s = String(str || '').trim();
        return s.toLowerCase().endsWith('.md') ? s.slice(0, -3) : s;
    };

    const extractChatReplyText = (result) => {
        if (result === null || result === undefined) return '';
        if (typeof result === 'string') return result.trim();

        const fromData = (data) => {
            if (data === null || data === undefined) return '';
            if (typeof data === 'string') return data.trim();
            // 优先检查 data.message（services.ai.chat_service 接口 stream: false 时返回的内容）
            if (typeof data?.message === 'string') return data.message.trim();
            if (typeof data?.content === 'string') return data.content.trim();
            if (typeof data?.message?.content === 'string') return data.message.content.trim();
            return '';
        };

        // 优先检查 result.data.message（services.ai.chat_service 接口 stream: false 时返回的内容）
        if (result.data !== undefined) {
            if (typeof result.data.message === 'string' && result.data.message.trim()) {
                return result.data.message.trim();
            }
            const t = fromData(result.data);
            if (t) return t;
        }

        if (typeof result.content === 'string' && result.content.trim()) return result.content.trim();
        if (typeof result.message?.content === 'string' && result.message.content.trim()) return result.message.content.trim();
        if (typeof result.message === 'string' && result.message.trim()) return result.message.trim();

        return '';
    };
    
    // 调试：确认方法已添加
    console.log('[SessionEditor] 开始扩展 PetManager 原型，添加 openSessionInfoEditor 方法');

    // 打开会话信息编辑对话框
    proto.openSessionInfoEditor = function(sessionId, originalTitle, originalDescription) {
        // 确保对话框UI存在
        this.ensureSessionInfoEditorUi();
    
        const overlay = (this.chatWindow ? this.chatWindow.querySelector('#pet-session-info-editor') : null) 
            || document.body.querySelector('#pet-session-info-editor');
        if (!overlay) {
            console.error('会话信息编辑对话框未找到');
            return;
        }

        // 显示对话框
        overlay.classList.add('js-visible');
        overlay.dataset.sessionId = sessionId;

        // 获取会话数据
        const session = this.sessions[sessionId];
        const originalUrl = session?.url || '';

        // 填充当前值
        const titleInput = overlay.querySelector('#session-edit-title');
        const urlInput = overlay.querySelector('#session-edit-url');
        const descriptionInput = overlay.querySelector('#session-edit-description');

        if (titleInput) {
            titleInput.value = originalTitle || '';
        }
        if (urlInput) {
            urlInput.value = originalUrl;
        }
        if (descriptionInput) {
            descriptionInput.value = originalDescription || '';
        }

        // 聚焦到标题输入框
        if (titleInput) {
            setTimeout(() => {
                titleInput.focus();
                titleInput.select();
            }, 100);
        }

        // 添加关闭事件
        const closeBtn = overlay.querySelector('.aicr-session-context-modal-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeSessionInfoEditor();
        }

        // 添加保存事件
        const saveBtn = overlay.querySelector('.session-editor-save');
        if (saveBtn) {
            saveBtn.onclick = () => this.saveSessionInfo(sessionId);
        }

        // 添加智能生成描述事件
        const generateDescriptionBtn = overlay.querySelector('.session-editor-generate-description');
        if (generateDescriptionBtn) {
            generateDescriptionBtn.onclick = () => this.generateSessionDescription(sessionId);
        }

        // ESC 键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeSessionInfoEditor();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    };
    
    console.log('[SessionEditor] openSessionInfoEditor 方法已添加到原型');

    // 确保会话信息编辑对话框UI存在
    proto.ensureSessionInfoEditorUi = function() {
            const existing = (this.chatWindow ? this.chatWindow.querySelector('#pet-session-info-editor') : null) 
                || document.body.querySelector('#pet-session-info-editor');
            if (existing) return;
    
            const overlay = document.createElement('div');
            overlay.id = 'pet-session-info-editor';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', '编辑会话');
            overlay.id = 'pet-session-info-editor';
            // 样式已通过 CSS 类定义
    
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeSessionInfoEditor();
                }
            });
    
            // 主体容器
            const modal = document.createElement('div');
            modal.className = 'aicr-session-context-modal-body aicr-session-settings-modal-body session-editor-modal';
            modal.setAttribute('tabindex', '0');
            // 样式已通过 CSS 类定义
            
            // 添加淡入动画（如果不存在）
            if (!document.getElementById('pet-session-editor-animations')) {
                const style = document.createElement('style');
                style.id = 'pet-session-editor-animations';
                style.textContent = `
                    @keyframes fadeInUp {
                        from {
                            opacity: 0;
                            transform: translateY(10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeSessionInfoEditor();
                }
            });
    
            // 头部
            const header = document.createElement('div');
            header.className = 'aicr-session-context-modal-header session-editor-header';
            // 样式已通过 CSS 类定义
    
            const title = document.createElement('div');
            title.className = 'aicr-session-context-modal-title session-editor-title';
            title.textContent = '✏️ 编辑会话';
    
            const headerRight = document.createElement('div');
            headerRight.className = 'aicr-session-context-modal-header-right session-editor-header-right';
    
            const saveBtn = document.createElement('button');
            saveBtn.className = 'aicr-session-context-toolbar-btn primary session-editor-save';
            saveBtn.type = 'button';
            saveBtn.textContent = '保存';
            saveBtn.setAttribute('aria-label', '保存');
            saveBtn.setAttribute('title', '保存');
    
            const closeBtn = document.createElement('div');
            closeBtn.className = 'aicr-session-context-modal-close';
            closeBtn.innerHTML = '✕';
            closeBtn.setAttribute('aria-label', '关闭');
            closeBtn.onclick = () => this.closeSessionInfoEditor();
    
            headerRight.appendChild(saveBtn);
            headerRight.appendChild(closeBtn);
            header.appendChild(title);
            header.appendChild(headerRight);
    
            // 内容区域
            const content = document.createElement('div');
            content.className = 'aicr-session-context-modal-content aicr-session-settings-modal-content';
    
            // 标题字段
            const titleField = document.createElement('div');
            titleField.className = 'aicr-session-settings-field';
    
            const titleLabel = document.createElement('label');
            titleLabel.className = 'aicr-session-settings-label';
            titleLabel.setAttribute('for', 'session-edit-title');
            titleLabel.textContent = '标题';
    
            const titleInput = document.createElement('input');
            titleInput.id = 'session-edit-title';
            titleInput.type = 'text';
            titleInput.className = 'aicr-session-settings-input';
            titleInput.placeholder = '请输入会话标题';
            titleInput.setAttribute('autocomplete', 'off');
            titleInput.setAttribute('spellcheck', 'false');
            titleInput.setAttribute('aria-label', '会话标题');
    
            titleField.appendChild(titleLabel);
            titleField.appendChild(titleInput);
            content.appendChild(titleField);
    
            // 网址字段
            const urlField = document.createElement('div');
            urlField.className = 'aicr-session-settings-field';
    
            const urlLabel = document.createElement('label');
            urlLabel.className = 'aicr-session-settings-label';
            urlLabel.setAttribute('for', 'session-edit-url');
            urlLabel.textContent = '网址';
    
            const urlInput = document.createElement('input');
            urlInput.id = 'session-edit-url';
            urlInput.type = 'url';
            urlInput.className = 'aicr-session-settings-input';
            urlInput.placeholder = '请输入网址（可选）';
            urlInput.setAttribute('autocomplete', 'off');
            urlInput.setAttribute('spellcheck', 'false');
            urlInput.setAttribute('aria-label', '会话网址');
    
            const urlHint = document.createElement('div');
            urlHint.className = 'aicr-session-settings-hint';
            urlHint.textContent = '网址将显示在欢迎卡片中';
    
            urlField.appendChild(urlLabel);
            urlField.appendChild(urlInput);
            urlField.appendChild(urlHint);
            content.appendChild(urlField);
    
            // 描述字段
            const descriptionField = document.createElement('div');
            descriptionField.className = 'aicr-session-settings-field';
    
            const descriptionHeader = document.createElement('div');
            descriptionHeader.className = 'aicr-session-edit-description-header';
    
            const descriptionLabel = document.createElement('label');
            descriptionLabel.className = 'aicr-session-settings-label';
            descriptionLabel.setAttribute('for', 'session-edit-description');
            descriptionLabel.textContent = '描述';
    
            const generateDescriptionBtn = document.createElement('button');
            generateDescriptionBtn.className = 'aicr-session-context-toolbar-btn session-editor-generate-description';
            generateDescriptionBtn.type = 'button';
            generateDescriptionBtn.innerHTML = '<span>✨ AI生成</span>';
            generateDescriptionBtn.setAttribute('aria-label', 'AI生成描述');
            generateDescriptionBtn.setAttribute('title', '根据页面上下文内容AI智能生成描述');
    
            descriptionHeader.appendChild(descriptionLabel);
            descriptionHeader.appendChild(generateDescriptionBtn);
    
            const descriptionInput = document.createElement('textarea');
            descriptionInput.id = 'session-edit-description';
            descriptionInput.className = 'aicr-session-settings-textarea';
            descriptionInput.rows = 6;
            descriptionInput.placeholder = '请输入会话描述，或点击AI生成按钮自动生成';
            descriptionInput.setAttribute('aria-label', '会话描述');
    
            const descriptionHint = document.createElement('div');
            descriptionHint.className = 'aicr-session-settings-hint';
            descriptionHint.textContent = '描述将帮助您更好地理解和管理会话内容';
    
            descriptionField.appendChild(descriptionHeader);
            descriptionField.appendChild(descriptionInput);
            descriptionField.appendChild(descriptionHint);
            content.appendChild(descriptionField);
    
            modal.appendChild(header);
            modal.appendChild(content);
            overlay.appendChild(modal);
            
            // 添加到聊天窗口（如果存在），否则添加到 body
            if (this.chatWindow) {
                this.chatWindow.appendChild(overlay);
            } else {
                document.body.appendChild(overlay);
            }
        };

        // 关闭会话信息编辑对话框
        proto.closeSessionInfoEditor = function() {
            const overlay = (this.chatWindow ? this.chatWindow.querySelector('#pet-session-info-editor') : null) 
                || document.body.querySelector('#pet-session-info-editor');
            if (overlay) {
                overlay.classList.remove('js-visible');
            }
        };

        // 保存会话信息
        proto.saveSessionInfo = async function(sessionId) {
            if (!sessionId || !this.sessions[sessionId]) {
                console.warn('会话不存在，无法保存信息:', sessionId);
                return;
            }
    
            const modal = document.body.querySelector('#pet-session-info-editor');
            if (!modal) {
                return;
            }
    
            const overlay = (this.chatWindow ? this.chatWindow.querySelector('#pet-session-info-editor') : null) 
                || document.body.querySelector('#pet-session-info-editor');
            const titleInput = overlay?.querySelector('#session-edit-title');
            const urlInput = overlay?.querySelector('#session-edit-url');
            const descriptionInput = overlay?.querySelector('#session-edit-description');
    
            if (!titleInput) {
                console.error('标题输入框未找到');
                return;
            }
    
            const rawNewTitle = titleInput.value.trim();
            const newUrl = urlInput ? urlInput.value.trim() : '';
            const newDescription = descriptionInput ? descriptionInput.value.trim() : '';
    
            // 如果标题为空，不进行更新
            if (rawNewTitle === '') {
                if (this.showNotification) {
                    this.showNotification('标题不能为空', 'error');
                } else {
                    alert('标题不能为空');
                }
                titleInput.focus();
                return;
            }
    
            const session = this.sessions[sessionId];
            const originalTitle = session.title || '未命名会话';
            const originalUrl = session.url || '';
            const originalDescription = session.pageDescription || '';
            const normalizedNewTitle = ensureMdSuffix(rawNewTitle);
            const normalizedOriginalTitle = ensureMdSuffix(originalTitle);
            const titleChanged = normalizedNewTitle !== normalizedOriginalTitle;
    
            // 如果标题、网址和描述都没有变化，不需要更新
            if (!titleChanged && newUrl === originalUrl && newDescription === originalDescription) {
                this.closeSessionInfoEditor();
                return;
            }
    
            try {
                // 如果标题改变，需要调用 rename-file 接口重命名文件
                if (titleChanged) {
                    console.log('[saveSessionInfo] 标题已改变，需要重命名文件:', normalizedOriginalTitle, '->', normalizedNewTitle);
                    
                    // 构建文件路径的辅助函数
                    const buildFilePath = (session, title) => {
                        // 优先从会话的 tags 构建路径
                        const tags = Array.isArray(session.tags) ? session.tags : [];
                        let currentPath = '';
                        tags.forEach((folderName) => {
                            if (!folderName || (folderName.toLowerCase && folderName.toLowerCase() === 'default')) return;
                            currentPath = currentPath ? currentPath + '/' + folderName : folderName;
                        });
                        
                        // 清理文件名（移除特殊字符，避免路径问题）
                        const sanitizeFileName = (name) => String(name || '').replace(/[\/\\:*?"<>|]/g, '-').trim();
                        let fileName = sanitizeFileName(title) || 'Untitled';
                        fileName = String(fileName).replace(/\//g, '-');
                        
                        let cleanPath = currentPath ? currentPath + '/' + fileName : fileName;
                        cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '');
                        if (cleanPath.startsWith('static/')) {
                            cleanPath = cleanPath.substring(7);
                        }
                        cleanPath = cleanPath.replace(/^\/+/, '');
                        
                        // 如果 cleanPath 仍然为空，尝试从 pageDescription 获取
                        if (!cleanPath) {
                            const pageDesc = session.pageDescription || '';
                            if (pageDesc && pageDesc.includes('文件：')) {
                                const filePath = pageDesc.replace('文件：', '').trim();
                                const dirPath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
                                cleanPath = dirPath + fileName;
                                cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '');
                                if (cleanPath.startsWith('static/')) {
                                    cleanPath = cleanPath.substring(7);
                                }
                                cleanPath = cleanPath.replace(/^\/+/, '');
                            }
                        }
                        
                        return cleanPath;
                    };
                    
                    // 构建旧路径和新路径
                    // 注意：构建新路径时，需要临时使用新标题，但保持其他会话数据不变
                    const oldPath = buildFilePath(session, normalizedOriginalTitle);
                    const tempSession = { ...session, title: normalizedNewTitle };
                    const newPath = buildFilePath(tempSession, normalizedNewTitle);
                    
                    // 如果路径不同，调用 rename-file 接口
                    if (oldPath && newPath && oldPath !== newPath) {
                        console.log('[saveSessionInfo] 准备重命名文件:', oldPath, '->', newPath);
                        
                        // 获取 API 基础 URL
                        const apiBase = (window.API_URL && /^https?:\/\//i.test(window.API_URL)) 
                            ? String(window.API_URL).replace(/\/+$/, '') 
                            : (PET_CONFIG?.api?.yiaiBaseUrl || '');
                        
                        if (apiBase) {
                            try {
                                const response = await fetch(`${apiBase}/rename-file`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        ...(this.getAuthHeaders ? this.getAuthHeaders() : {}),
                                    },
                                    body: JSON.stringify({
                                        old_path: oldPath,
                                        new_path: newPath
                                    })
                                });
                                
                                if (!response.ok) {
                                    const errorText = await response.text();
                                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                                }
                                
                                const result = await response.json();
                                
                                if (result.status === 200 || result.success !== false) {
                                    console.log('[saveSessionInfo] 文件重命名成功:', result);
                                    
                                    // 更新会话的 pageDescription 中的文件路径
                                    if (session.pageDescription && session.pageDescription.includes('文件：')) {
                                        session.pageDescription = session.pageDescription.replace(
                                            /文件：.*/,
                                            `文件：${newPath}`
                                        );
                                    }
                                } else {
                                    console.warn('[saveSessionInfo] 文件重命名失败:', result);
                                    // 不阻止保存，只记录警告
                                }
                            } catch (renameError) {
                                console.error('[saveSessionInfo] 调用 rename-file 接口失败:', renameError);
                                // 不阻止保存，只记录错误
                            }
                        } else {
                            console.warn('[saveSessionInfo] API_URL 未配置，跳过 rename-file 接口调用');
                        }
                    }
                }
                
                // 更新会话信息
                session.title = normalizedNewTitle;
                session.url = newUrl;
                session.pageDescription = newDescription;
                session.updatedAt = Date.now();
                session.lastAccessTime = Date.now();
    
                // 保存会话到本地
                await this.saveAllSessions(false, true);
    
                // 更新UI显示
                await this.updateSessionSidebar(true);
    
                // 如果这是当前会话，同时更新聊天窗口标题和第一条消息
                if (sessionId === this.currentSessionId) {
                    if (typeof this.updateChatHeaderTitle === 'function') {
                        this.updateChatHeaderTitle();
                    }
                    // 刷新第一条欢迎消息
                    if (typeof this.refreshWelcomeMessage === 'function') {
                        await this.refreshWelcomeMessage();
                    }
                }

                if (this.sessionApi && typeof this.sessionApi.isEnabled === 'function' && this.sessionApi.isEnabled()) {
                    const apiUrl = this.sessionApi.baseUrl || (typeof PET_CONFIG !== 'undefined' ? PET_CONFIG.api.yiaiBaseUrl : '');
                    const base = String(apiUrl || '').replace(/\/+$/, '');
                    if (base) {
                        try {
                            const payload = {
                                module_name: 'services.database.data_service',
                                method_name: 'update_document',
                                parameters: {
                                    cname: 'sessions',
                                    key: sessionId,
                                    data: {
                                        key: sessionId,
                                        title: session.title || '',
                                        url: session.url || '',
                                        pageDescription: session.pageDescription || '',
                                        updatedAt: session.updatedAt || Date.now(),
                                        lastAccessTime: session.lastAccessTime || Date.now()
                                    }
                                }
                            };
                            const response = await fetch(`${base}/`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(this.getAuthHeaders ? this.getAuthHeaders() : {})
                                },
                                body: JSON.stringify(payload)
                            });

                            if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(`HTTP ${response.status}: ${errorText}`);
                            }

                            await response.json();
                            console.log('[saveSessionInfo] update_document 接口调用成功');
                        } catch (updateError) {
                            console.error('[saveSessionInfo] 调用 update_document 接口失败:', updateError);
                        }
                    }
                }
    
                console.log('会话信息已更新:', { title: normalizedNewTitle, url: newUrl, description: newDescription });
    
                // 显示成功提示
                if (this.showNotification) {
                    this.showNotification('会话已更新', 'success');
                }
    
                // 关闭对话框
                this.closeSessionInfoEditor();
            } catch (error) {
                console.error('更新会话信息失败:', error);
                if (this.showNotification) {
                    this.showNotification('更新信息失败，请重试', 'error');
                } else {
                    alert('更新信息失败，请重试');
                }
            }
        };

        // 获取会话上下文信息
        proto.getSessionContext = function(sessionId) {
            const context = {
                messages: [],
                pageContent: '',
                title: '',
                pageDescription: '',
                url: '',
                hasHistory: false
            };

            if (!sessionId || !this.sessions[sessionId]) {
                return context;
            }

            const session = this.sessions[sessionId];

            // 获取消息历史（排除欢迎消息和按钮操作生成的消息）
            if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
                context.messages = session.messages.filter(msg => {
                    // 只包含用户消息和宠物消息，排除按钮操作生成的消息
                    return msg.type === 'user' || msg.type === 'pet';
                });
                context.hasHistory = context.messages.length > 0;
            }

            // 获取页面信息
            if (session.pageContent && session.pageContent.trim()) {
                context.pageContent = session.pageContent.trim();
            }
            context.title = session.title || '';
            if (session.pageDescription) {
                context.pageDescription = session.pageDescription;
            }
            if (session.url) {
                context.url = session.url;
            }

            return context;
        };

        // 智能生成会话标题
        proto.generateSessionTitle = async function(sessionId) {
            if (!sessionId || !this.sessions[sessionId]) {
                console.warn('会话不存在，无法生成标题:', sessionId);
                return;
            }
    
            const modal = document.body.querySelector('#pet-session-info-editor');
            if (!modal) {
                return;
            }
    
            const overlay = (this.chatWindow ? this.chatWindow.querySelector('#pet-session-info-editor') : null) 
                || document.body.querySelector('#pet-session-info-editor');
            const generateBtn = overlay?.querySelector('.session-editor-generate-title');
            const titleInput = overlay?.querySelector('.session-editor-title-input');
    
            if (!generateBtn || !titleInput) {
                return;
            }
    
            // 设置按钮为加载状态
            const originalText = generateBtn.innerHTML;
            generateBtn.disabled = true;
            generateBtn.innerHTML = '生成中...';
    
            try {
                // 获取会话上下文
                const context = this.getSessionContext(sessionId);
    
                // 构建生成标题的 prompt
                let systemPrompt = '你是一个专业的助手，擅长根据会话内容生成简洁、准确的标题。';
                let userPrompt = '请根据以下会话内容，生成一个简洁、准确的标题（不超过20个字，不要包含“.md”后缀）：\n\n';
    
                // 添加页面信息
                if (context.title) {
                    userPrompt += `页面标题：${stripMdSuffix(context.title)}\n`;
                }
                if (context.url) {
                    userPrompt += `页面URL：${context.url}\n`;
                }
    
                // 添加消息历史
                if (context.messages.length > 0) {
                    userPrompt += '\n会话内容：\n';
                    context.messages.slice(0, 10).forEach((msg, index) => {
                        const role = msg.type === 'user' ? '用户' : '助手';
                        const content = msg.content.trim();
                        if (content) {
                            userPrompt += `${role}：${content.substring(0, 200)}\n`;
                        }
                    });
                } else if (context.pageContent) {
                    // 如果没有消息历史，使用页面内容
                    userPrompt += '\n页面内容摘要：\n';
                    userPrompt += context.pageContent.substring(0, 500);
                }
    
                userPrompt += '\n\n请直接返回标题，不要包含其他说明文字。';
    
                // 构建请求 payload
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
                // 使用 chatModels 的 default 字段
                if (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) {
                    payload.parameters.model = PET_CONFIG.chatModels.default;
                }
                if (oldPayload.conversation_id) {
                    payload.parameters.conversation_id = oldPayload.conversation_id;
                }
    
                // 调用 services.ai.chat_service 接口
                const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.getAuthHeaders(),
                    },
                    body: JSON.stringify(payload),
                });
    
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
    
                // 先获取响应文本，检查是否是 SSE 格式
                const responseText = await response.text();
                let result;
    
                try {
                    // 检查是否包含 SSE 格式（包含 "data: "）
                    if (responseText.includes('data: ')) {
                        // 处理 SSE 格式响应
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
    
                                    // 尝试解析 JSON
                                    const chunk = JSON.parse(dataStr);
    
                                    // 检查是否完成
                                    if (chunk.done === true) {
                                        break;
                                    }
    
                                    // 累积内容
                                    if (chunk.content) {
                                        accumulatedData += chunk.content;
                                        lastValidData = chunk;
                                    } else if (chunk.data) {
                                        accumulatedData += (typeof chunk.data === 'string' ? chunk.data : chunk.data.content || '');
                                        lastValidData = chunk;
                                    } else if (chunk.message && chunk.message.content) {
                                        accumulatedData += chunk.message.content;
                                        lastValidData = chunk;
                                    }
                                } catch (e) {
                                    console.warn('解析 SSE 数据块失败:', trimmedLine, e);
                                }
                            }
                        }
    
                        // 如果有累积的内容，使用它
                        if (accumulatedData) {
                            result = { content: accumulatedData, data: accumulatedData };
                        } else if (lastValidData) {
                            result = lastValidData;
                        } else {
                            // 尝试从最后一行提取 JSON
                            const sseMatch = responseText.match(/data:\s*({.+?})/s);
                            if (sseMatch) {
                                result = JSON.parse(sseMatch[1]);
                            } else {
                                throw new Error('无法解析 SSE 响应');
                            }
                        }
                    } else {
                        // 普通 JSON 响应
                        result = JSON.parse(responseText);
                    }
                } catch (parseError) {
                    console.error('解析响应失败:', parseError, '响应内容:', responseText.substring(0, 200));
                    throw new Error('解析响应失败: ' + parseError.message);
                }
    
                let generatedTitle = extractChatReplyText(result);
    
                // 去除 think 内容
                if (this.stripThinkContent) {
                    generatedTitle = this.stripThinkContent(generatedTitle);
                }
    
                // 清理标题（移除可能的引号、换行等）
                generatedTitle = generatedTitle.replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim();
                generatedTitle = stripMdSuffix(generatedTitle);
                generatedTitle = ensureMdSuffix(generatedTitle);
    
                // 限制长度
                if (generatedTitle.length > 50) {
                    generatedTitle = generatedTitle.substring(0, 50);
                }
    
                if (generatedTitle) {
                    titleInput.value = generatedTitle;
                    titleInput.focus();
                } else {
                    alert('生成标题失败，请重试');
                }
            } catch (error) {
                console.error('生成标题失败:', error);
                alert('生成标题失败：' + error.message);
            } finally {
                // 恢复按钮状态
                generateBtn.disabled = false;
                generateBtn.innerHTML = originalText;
            }
        };

        // 智能生成会话描述
        proto.generateSessionDescription = async function(sessionId) {
            if (!sessionId || !this.sessions[sessionId]) {
                console.warn('会话不存在，无法生成描述:', sessionId);
                return;
            }
    
            const modal = document.body.querySelector('#pet-session-info-editor');
            if (!modal) {
                return;
            }
    
            const overlay = (this.chatWindow ? this.chatWindow.querySelector('#pet-session-info-editor') : null) 
                || document.body.querySelector('#pet-session-info-editor');
            const generateBtn = overlay?.querySelector('.session-editor-generate-description');
            const descriptionInput = overlay?.querySelector('#session-edit-description');
    
            if (!generateBtn || !descriptionInput) {
                return;
            }
    
            // 设置按钮为加载状态
            const originalText = generateBtn.innerHTML;
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span>生成中...</span>';
    
            try {
                // 获取会话上下文
                const context = this.getSessionContext(sessionId);
    
                // 构建生成描述的 prompt
                let systemPrompt = '你是一个专业的助手，擅长根据会话内容生成简洁、准确的网页描述。';
                let userPrompt = '请根据以下会话内容，生成一个简洁、准确的网页描述：\n\n';
    
                // 添加页面信息
                if (context.title) {
                    userPrompt += `页面标题：${stripMdSuffix(context.title)}\n`;
                }
                if (context.url) {
                    userPrompt += `页面URL：${context.url}\n`;
                }
    
                // 添加消息历史
                if (context.messages.length > 0) {
                    userPrompt += '\n会话内容：\n';
                    context.messages.slice(0, 15).forEach((msg, index) => {
                        const role = msg.type === 'user' ? '用户' : '助手';
                        const content = msg.content.trim();
                        if (content) {
                            userPrompt += `${role}：${content.substring(0, 300)}\n`;
                        }
                    });
                } else if (context.pageContent) {
                    // 如果没有消息历史，使用页面内容
                    userPrompt += '\n页面内容摘要：\n';
                    userPrompt += context.pageContent.substring(0, 1000);
                }
    
                userPrompt += '\n\n请直接返回描述，不要包含其他说明文字。描述应该简洁明了，概括会话或页面的主要内容。';
    
                // 构建请求 payload
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
                // 使用 chatModels 的 default 字段
                if (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) {
                    payload.parameters.model = PET_CONFIG.chatModels.default;
                }
                if (oldPayload.conversation_id) {
                    payload.parameters.conversation_id = oldPayload.conversation_id;
                }
    
                // 调用 services.ai.chat_service 接口
                const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.getAuthHeaders(),
                    },
                    body: JSON.stringify(payload),
                });
    
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
    
                // 先获取响应文本，检查是否是 SSE 格式
                const responseText = await response.text();
                let result;
    
                try {
                    // 检查是否包含 SSE 格式（包含 "data: "）
                    if (responseText.includes('data: ')) {
                        // 处理 SSE 格式响应
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
    
                                    // 尝试解析 JSON
                                    const chunk = JSON.parse(dataStr);
    
                                    // 检查是否完成
                                    if (chunk.done === true) {
                                        break;
                                    }
    
                                    // 累积内容
                                    if (chunk.content) {
                                        accumulatedData += chunk.content;
                                        lastValidData = chunk;
                                    } else if (chunk.data) {
                                        accumulatedData += (typeof chunk.data === 'string' ? chunk.data : chunk.data.content || '');
                                        lastValidData = chunk;
                                    } else if (chunk.message && chunk.message.content) {
                                        accumulatedData += chunk.message.content;
                                        lastValidData = chunk;
                                    }
                                } catch (e) {
                                    console.warn('解析 SSE 数据块失败:', trimmedLine, e);
                                }
                            }
                        }
    
                        // 如果有累积的内容，使用它
                        if (accumulatedData) {
                            result = { content: accumulatedData, data: accumulatedData };
                        } else if (lastValidData) {
                            result = lastValidData;
                        } else {
                            // 尝试从最后一行提取 JSON
                            const sseMatch = responseText.match(/data:\s*({.+?})/s);
                            if (sseMatch) {
                                result = JSON.parse(sseMatch[1]);
                            } else {
                                throw new Error('无法解析 SSE 响应');
                            }
                        }
                    } else {
                        // 普通 JSON 响应
                        result = JSON.parse(responseText);
                    }
                } catch (parseError) {
                    console.error('解析响应失败:', parseError, '响应内容:', responseText.substring(0, 200));
                    throw new Error('解析响应失败: ' + parseError.message);
                }
    
                let generatedDescription = extractChatReplyText(result);
    
                // 去除 think 内容
                if (this.stripThinkContent) {
                    generatedDescription = this.stripThinkContent(generatedDescription);
                }
    
                // 清理描述（移除可能的引号等）
                generatedDescription = generatedDescription.replace(/^["']|["']$/g, '').trim();
    
                // 不再限制长度，保留完整内容
    
                if (generatedDescription) {
                    descriptionInput.value = generatedDescription;
                    descriptionInput.focus();
                } else {
                    alert('生成描述失败，请重试');
                }
            } catch (error) {
                console.error('生成描述失败:', error);
                alert('生成描述失败：' + error.message);
            } finally {
                // 恢复按钮状态
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<span>✨ AI生成</span>';
            }
        };
        proto.optimizeSessionDescription = async function(sessionId) {
            if (!sessionId || !this.sessions[sessionId]) {
                console.warn('会话不存在，无法优化描述:', sessionId);
                return;
            }
    
            const modal = document.body.querySelector('#pet-session-info-editor');
            if (!modal) {
                return;
            }
    
            const optimizeBtn = modal.querySelector('.session-editor-optimize-description');
            const descriptionInput = modal.querySelector('.session-editor-description-input');
    
            if (!optimizeBtn || !descriptionInput) {
                return;
            }
    
            // 检查是否有现有描述
            const currentDescription = descriptionInput.value.trim();
            if (!currentDescription) {
                alert('请先输入描述内容，然后再进行优化');
                descriptionInput.focus();
                return;
            }
    
            // 设置按钮为加载状态
            const originalText = optimizeBtn.innerHTML;
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '优化中...';
    
            try {
                // 获取会话上下文
                const context = this.getSessionContext(sessionId);
    
                // 构建优化描述的 prompt
                let systemPrompt = '你是一个专业的助手，擅长优化和润色网页描述，使其更加简洁、准确、吸引人。';
                let userPrompt = '请优化以下网页描述，使其更加简洁、准确、吸引人（50-200字）：\n\n';
                userPrompt += `当前描述：${currentDescription}\n\n`;
    
                // 添加页面信息以提供上下文
                if (context.title) {
                    userPrompt += `页面标题：${stripMdSuffix(context.title)}\n`;
                }
                if (context.url) {
                    userPrompt += `页面URL：${context.url}\n`;
                }
    
                // 添加消息历史以提供更多上下文
                if (context.messages.length > 0) {
                    userPrompt += '\n会话内容（供参考）：\n';
                    context.messages.slice(0, 10).forEach((msg, index) => {
                        const role = msg.type === 'user' ? '用户' : '助手';
                        const content = msg.content.trim();
                        if (content) {
                            userPrompt += `${role}：${content.substring(0, 200)}\n`;
                        }
                    });
                } else if (context.pageContent) {
                    // 如果没有消息历史，使用页面内容
                    userPrompt += '\n页面内容摘要（供参考）：\n';
                    userPrompt += context.pageContent.substring(0, 800);
                }
    
                userPrompt += '\n\n请直接返回优化后的描述，不要包含其他说明文字。优化后的描述应该：\n';
                userPrompt += '1. 保持原意不变\n';
                userPrompt += '2. 更加简洁明了\n';
                userPrompt += '3. 语言更加流畅自然\n';
                userPrompt += '4. 突出关键信息';
    
                // 构建请求 payload
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
                // 使用 chatModels 的 default 字段
                if (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) {
                    payload.parameters.model = PET_CONFIG.chatModels.default;
                }
                if (oldPayload.conversation_id) {
                    payload.parameters.conversation_id = oldPayload.conversation_id;
                }
    
                // 调用 services.ai.chat_service 接口
                const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.getAuthHeaders(),
                    },
                    body: JSON.stringify(payload),
                });
    
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
    
                // 先获取响应文本，检查是否是 SSE 格式
                const responseText = await response.text();
                let result;
    
                try {
                    // 检查是否包含 SSE 格式（包含 "data: "）
                    if (responseText.includes('data: ')) {
                        // 处理 SSE 格式响应
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
    
                                    // 尝试解析 JSON
                                    const chunk = JSON.parse(dataStr);
    
                                    // 检查是否完成
                                    if (chunk.done === true) {
                                        break;
                                    }
    
                                    // 累积内容
                                    if (chunk.content) {
                                        accumulatedData += chunk.content;
                                        lastValidData = chunk;
                                    } else if (chunk.data) {
                                        accumulatedData += (typeof chunk.data === 'string' ? chunk.data : chunk.data.content || '');
                                        lastValidData = chunk;
                                    } else if (chunk.message && chunk.message.content) {
                                        accumulatedData += chunk.message.content;
                                        lastValidData = chunk;
                                    }
                                } catch (e) {
                                    console.warn('解析 SSE 数据块失败:', trimmedLine, e);
                                }
                            }
                        }
    
                        // 如果有累积的内容，使用它
                        if (accumulatedData) {
                            result = { content: accumulatedData, data: accumulatedData };
                        } else if (lastValidData) {
                            result = lastValidData;
                        } else {
                            // 尝试从最后一行提取 JSON
                            const sseMatch = responseText.match(/data:\s*({.+?})/s);
                            if (sseMatch) {
                                result = JSON.parse(sseMatch[1]);
                            } else {
                                throw new Error('无法解析 SSE 响应');
                            }
                        }
                    } else {
                        // 普通 JSON 响应
                        result = JSON.parse(responseText);
                    }
                } catch (parseError) {
                    console.error('解析响应失败:', parseError, '响应内容:', responseText.substring(0, 200));
                    throw new Error('解析响应失败: ' + parseError.message);
                }
    
                let optimizedDescription = extractChatReplyText(result);
    
                // 去除 think 内容
                if (this.stripThinkContent) {
                    optimizedDescription = this.stripThinkContent(optimizedDescription);
                }
    
                // 清理描述（移除可能的引号等）
                optimizedDescription = optimizedDescription.replace(/^["']|["']$/g, '').trim();
    
                // 限制长度
                if (optimizedDescription.length > 500) {
                    optimizedDescription = optimizedDescription.substring(0, 500);
                }
    
                if (optimizedDescription) {
                    descriptionInput.value = optimizedDescription;
                    descriptionInput.focus();
                } else {
                    alert('优化描述失败，请重试');
                }
            } catch (error) {
                console.error('优化描述失败:', error);
                alert('优化描述失败：' + error.message);
            } finally {
                // 恢复按钮状态
                optimizeBtn.disabled = false;
                optimizeBtn.innerHTML = originalText;
            }
        };

        // 翻译会话字段（标题或描述）
        proto.translateSessionField = async function(fieldType, inputElement, targetLanguage) {
            if (!inputElement) return;
    
            const originalText = inputElement.value.trim();
            if (!originalText) {
                this.showNotification('请先输入内容', 'warning');
                return;
            }
    
            // 禁用按钮，显示加载状态
            const modal = document.body.querySelector('#pet-session-info-editor');
            const overlay = (this.chatWindow ? this.chatWindow.querySelector('#pet-session-info-editor') : null) 
                || document.body.querySelector('#pet-session-info-editor');
            const translateBtn = overlay ? overlay.querySelector(`button[data-translate-field="${fieldType}"][data-target-lang="${targetLanguage}"]`) : null;
            const originalBtnText = translateBtn ? translateBtn.textContent : '';
            if (translateBtn) {
                translateBtn.disabled = true;
                translateBtn.textContent = '翻译中...';
            }
    
            try {
                // 构建翻译提示词
                const languageName = targetLanguage === 'zh' ? '中文' : '英文';
                const systemPrompt = `你是一个专业的翻译专家，擅长准确、流畅地翻译文本。请将用户提供的文本翻译成${languageName}，要求：
    1. 保持原文的意思和语气不变
    2. 翻译自然流畅，符合${languageName}的表达习惯
    3. 保留原文的格式和结构
    
    请直接返回翻译后的文本，不要包含任何说明文字、引号或其他格式标记。`;
    
                const userPrompt = `请将以下文本翻译成${languageName}：
    
    ${originalText}
    
    请直接返回翻译后的文本，不要包含任何说明文字、引号或其他格式标记。`;
    
                // 构建请求 payload
                const payload = this.buildPromptPayload(
                    systemPrompt,
                    userPrompt
                );
    
                // 显示加载动画
                this._showLoadingAnimation();
    
                // 调用 services.ai.chat_service 接口
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
    
                // 先获取文本响应，检查是否是SSE格式
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
                        throw new Error(`无法解析响应: ${e.message}`);
                    }
                }
    
                // 隐藏加载动画
                this._hideLoadingAnimation();
    
                // 解析响应内容
                let translatedText = result.data.message;
    
                // 去除 think 内容
                if (this.stripThinkContent) {
                    translatedText = this.stripThinkContent(translatedText);
                }
    
                // 清理翻译后的文本
                translatedText = translatedText.trim();
    
                // 移除可能的引号包裹（支持多种引号类型）
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
    
                // 移除常见的AI回复前缀
                const prefixes = [
                    /^翻译后的[内容文本]：?\s*/i,
                    /^以下是翻译后的[内容文本]：?\s*/i,
                    /^翻译结果：?\s*/i,
                    /^翻译后的文本：?\s*/i,
                    /^翻译后的[内容文本]如下：?\s*/i,
                    /^[内容文本]翻译如下：?\s*/i
                ];
    
                for (const prefix of prefixes) {
                    translatedText = translatedText.replace(prefix, '').trim();
                }
    
                // 清理多余的空白字符（但保留格式）
                translatedText = translatedText.replace(/\n{4,}/g, '\n\n\n');
                translatedText = translatedText.replace(/[ \t]+/g, ' ');
                translatedText = translatedText.trim();
    
                // 验证翻译后的文本是否有效
                if (!translatedText || translatedText.length < 1) {
                    throw new Error('翻译后的文本为空，可能翻译失败，请重试');
                }
    
                // 如果翻译后的文本与原文完全相同，给出提示
                if (translatedText === originalText) {
                    this.showNotification('翻译后的内容与原文相同', 'info');
                }
    
                // 更新输入框内容
                inputElement.value = translatedText;
    
                // 触发 input 事件，确保值被正确更新
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    
                this.showNotification('翻译完成', 'success');
            } catch (error) {
                console.error('翻译失败:', error);
                this.showNotification('翻译失败：' + error.message, 'error');
            } finally {
                // 恢复按钮状态
                if (translateBtn) {
                    translateBtn.disabled = false;
                    translateBtn.textContent = originalBtnText;
                }
                // 隐藏加载动画
                this._hideLoadingAnimation();
            }
        };
    
    console.log('[SessionEditor] 所有方法已添加到原型');
})();
