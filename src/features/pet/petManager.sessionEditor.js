(function() {
    'use strict';

    function extendPetManager() {
        if (typeof window.PetManager === 'undefined') {
            setTimeout(extendPetManager, 100);
            return;
        }

        const proto = window.PetManager.prototype;

        // 打开会话信息编辑对话框
        proto.openSessionInfoEditor = function(sessionId, originalTitle, originalDescription) {
            // 确保对话框UI存在
            this.ensureSessionInfoEditorUi();
    
            const modal = document.body.querySelector('#pet-session-info-editor');
            if (!modal) {
                console.error('会话信息编辑对话框未找到');
                return;
            }
    
            // 显示对话框
            modal.style.display = 'flex';
            modal.dataset.sessionId = sessionId;
    
            // 填充当前值
            const titleInput = modal.querySelector('.session-editor-title-input');
            const descriptionInput = modal.querySelector('.session-editor-description-input');
            const updatedAtInput = modal.querySelector('.session-editor-updatedat-input');
    
            if (titleInput) {
                titleInput.value = originalTitle;
            }
            if (descriptionInput) {
                descriptionInput.value = originalDescription;
            }
    
            // 填充更新时间，默认是今天
            if (updatedAtInput) {
                const session = this.sessions[sessionId];
                // 优先使用 updatedAt，如果没有则使用当前时间（今天）
                let updatedAt = session.updatedAt || Date.now();
    
                // 将时间戳转换为 datetime-local 格式 (YYYY-MM-DDTHH:mm)
                const date = new Date(updatedAt);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                updatedAtInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
    
            // 聚焦到标题输入框
            if (titleInput) {
                setTimeout(() => {
                    titleInput.focus();
                    titleInput.select();
                }, 100);
            }
    
            // 添加关闭事件
            const closeBtn = modal.querySelector('.session-editor-close');
            if (closeBtn) {
                closeBtn.onclick = () => this.closeSessionInfoEditor();
            }
    
            // 添加保存事件
            const saveBtn = modal.querySelector('.session-editor-save');
            if (saveBtn) {
                saveBtn.onclick = () => this.saveSessionInfo(sessionId);
            }
    
            // 添加取消事件
            const cancelBtn = modal.querySelector('.session-editor-cancel');
            if (cancelBtn) {
                cancelBtn.onclick = () => this.closeSessionInfoEditor();
            }
    
            // 添加智能生成标题事件
            const generateTitleBtn = modal.querySelector('.session-editor-generate-title');
            if (generateTitleBtn) {
                generateTitleBtn.onclick = () => this.generateSessionTitle(sessionId);
            }
    
            // 添加智能生成描述事件
            const generateDescriptionBtn = modal.querySelector('.session-editor-generate-description');
            if (generateDescriptionBtn) {
                generateDescriptionBtn.onclick = () => this.generateSessionDescription(sessionId);
            }
    
            // 添加智能优化描述事件
            const optimizeDescriptionBtn = modal.querySelector('.session-editor-optimize-description');
            if (optimizeDescriptionBtn) {
                optimizeDescriptionBtn.onclick = () => this.optimizeSessionDescription(sessionId);
            }
    
            // 添加翻译标题中文事件
            const translateTitleZhBtn = modal.querySelector('.session-editor-translate-title-zh');
            if (translateTitleZhBtn) {
                translateTitleZhBtn.onclick = () => this.translateSessionField('title', titleInput, 'zh');
            }
    
            // 添加翻译标题英文事件
            const translateTitleEnBtn = modal.querySelector('.session-editor-translate-title-en');
            if (translateTitleEnBtn) {
                translateTitleEnBtn.onclick = () => this.translateSessionField('title', titleInput, 'en');
            }
    
            // 添加翻译描述中文事件
            const translateDescriptionZhBtn = modal.querySelector('.session-editor-translate-description-zh');
            if (translateDescriptionZhBtn) {
                translateDescriptionZhBtn.onclick = () => this.translateSessionField('description', descriptionInput, 'zh');
            }
    
            // 添加翻译描述英文事件
            const translateDescriptionEnBtn = modal.querySelector('.session-editor-translate-description-en');
            if (translateDescriptionEnBtn) {
                translateDescriptionEnBtn.onclick = () => this.translateSessionField('description', descriptionInput, 'en');
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

        // 确保会话信息编辑对话框UI存在
        proto.ensureSessionInfoEditorUi = function() {
            if (document.body.querySelector('#pet-session-info-editor')) return;
    
            const modal = document.createElement('div');
            modal.id = 'pet-session-info-editor';
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
                z-index: 2147483653 !important;
            `;
    
            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeSessionInfoEditor();
                }
            });
    
            const panel = document.createElement('div');
            panel.style.cssText = `
                background: white !important;
                border-radius: 12px !important;
                padding: 32px !important;
                width: 90% !important;
                max-width: 700px !important;
                max-height: 85vh !important;
                overflow-y: auto !important;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2) !important;
                position: relative !important;
                z-index: 2147483654 !important;
            `;
    
            // 标题
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 24px !important;
            `;
    
            const title = document.createElement('h3');
            title.textContent = '编辑会话信息';
            title.style.cssText = `
                margin: 0 !important;
                font-size: 20px !important;
                font-weight: 600 !important;
                color: #333 !important;
            `;
    
            const closeBtn = document.createElement('button');
            closeBtn.className = 'session-editor-close';
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
                closeBtn.style.color = '#333';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'none';
                closeBtn.style.color = '#999';
            });
    
            header.appendChild(title);
            header.appendChild(closeBtn);
    
            // 标题输入区域
            const titleGroup = document.createElement('div');
            titleGroup.style.cssText = `
                margin-bottom: 24px !important;
            `;
    
            const titleLabel = document.createElement('label');
            titleLabel.textContent = '会话标题';
            titleLabel.style.cssText = `
                display: block !important;
                margin-bottom: 10px !important;
                font-size: 15px !important;
                font-weight: 500 !important;
                color: #333 !important;
            `;
    
            const titleInputWrapper = document.createElement('div');
            titleInputWrapper.style.cssText = `
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
            `;
    
            const titleInput = document.createElement('input');
            titleInput.className = 'session-editor-title-input';
            titleInput.type = 'text';
            titleInput.placeholder = '请输入会话标题';
            titleInput.style.cssText = `
                width: 100% !important;
                padding: 12px 14px !important;
                border: 2px solid #e0e0e0 !important;
                border-radius: 6px !important;
                font-size: 15px !important;
                outline: none !important;
                transition: border-color 0.2s ease !important;
                box-sizing: border-box !important;
            `;
    
            titleInput.addEventListener('focus', () => {
                titleInput.style.borderColor = '#4CAF50';
            });
            titleInput.addEventListener('blur', () => {
                titleInput.style.borderColor = '#e0e0e0';
            });
    
            // 按钮容器
            const titleButtonContainer = document.createElement('div');
            titleButtonContainer.style.cssText = `
                display: flex !important;
                gap: 8px !important;
                justify-content: flex-end !important;
            `;
    
            const generateTitleBtn = document.createElement('button');
            generateTitleBtn.className = 'session-editor-generate-title';
            generateTitleBtn.innerHTML = '✨ 智能生成';
            generateTitleBtn.style.cssText = `
                padding: 12px 16px !important;
                background: #2196F3 !important;
                color: white !important;
                border: none !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                transition: background 0.2s ease !important;
                white-space: nowrap !important;
            `;
            generateTitleBtn.addEventListener('mouseenter', () => {
                generateTitleBtn.style.background = '#1976D2';
            });
            generateTitleBtn.addEventListener('mouseleave', () => {
                generateTitleBtn.style.background = '#2196F3';
            });
    
            // 翻译中文按钮
            const translateTitleZhBtn = document.createElement('button');
            translateTitleZhBtn.className = 'session-editor-translate-title-zh';
            translateTitleZhBtn.setAttribute('data-translate-field', 'title');
            translateTitleZhBtn.setAttribute('data-target-lang', 'zh');
            translateTitleZhBtn.innerHTML = '🇨🇳 翻译中文';
            translateTitleZhBtn.style.cssText = `
                padding: 12px 16px !important;
                background: #FF9800 !important;
                color: white !important;
                border: none !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                transition: background 0.2s ease !important;
                white-space: nowrap !important;
            `;
            translateTitleZhBtn.addEventListener('mouseenter', () => {
                translateTitleZhBtn.style.background = '#F57C00';
            });
            translateTitleZhBtn.addEventListener('mouseleave', () => {
                translateTitleZhBtn.style.background = '#FF9800';
            });
    
            // 翻译英文按钮
            const translateTitleEnBtn = document.createElement('button');
            translateTitleEnBtn.className = 'session-editor-translate-title-en';
            translateTitleEnBtn.setAttribute('data-translate-field', 'title');
            translateTitleEnBtn.setAttribute('data-target-lang', 'en');
            translateTitleEnBtn.innerHTML = '🇺🇸 翻译英文';
            translateTitleEnBtn.style.cssText = `
                padding: 12px 16px !important;
                background: #9C27B0 !important;
                color: white !important;
                border: none !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                transition: background 0.2s ease !important;
                white-space: nowrap !important;
            `;
            translateTitleEnBtn.addEventListener('mouseenter', () => {
                translateTitleEnBtn.style.background = '#7B1FA2';
            });
            translateTitleEnBtn.addEventListener('mouseleave', () => {
                translateTitleEnBtn.style.background = '#9C27B0';
            });
    
            titleButtonContainer.appendChild(generateTitleBtn);
            titleButtonContainer.appendChild(translateTitleZhBtn);
            titleButtonContainer.appendChild(translateTitleEnBtn);
    
            titleInputWrapper.appendChild(titleInput);
            titleInputWrapper.appendChild(titleButtonContainer);
    
            titleGroup.appendChild(titleLabel);
            titleGroup.appendChild(titleInputWrapper);
    
            // 描述输入区域
            const descriptionGroup = document.createElement('div');
            descriptionGroup.style.cssText = `
                margin-bottom: 24px !important;
            `;
    
            const descriptionLabel = document.createElement('label');
            descriptionLabel.textContent = '网页描述';
            descriptionLabel.style.cssText = `
                display: block !important;
                margin-bottom: 10px !important;
                font-size: 15px !important;
                font-weight: 500 !important;
                color: #333 !important;
            `;
    
            const descriptionInputWrapper = document.createElement('div');
            descriptionInputWrapper.style.cssText = `
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
            `;
    
            const descriptionInput = document.createElement('textarea');
            descriptionInput.className = 'session-editor-description-input';
            descriptionInput.placeholder = '请输入网页描述（可选）';
            descriptionInput.rows = 6;
            descriptionInput.style.cssText = `
                width: 100% !important;
                padding: 12px 14px !important;
                border: 2px solid #e0e0e0 !important;
                border-radius: 6px !important;
                font-size: 14px !important;
                outline: none !important;
                transition: border-color 0.2s ease !important;
                resize: vertical !important;
                font-family: inherit !important;
                box-sizing: border-box !important;
                min-height: 120px !important;
            `;
    
            descriptionInput.addEventListener('focus', () => {
                descriptionInput.style.borderColor = '#4CAF50';
            });
            descriptionInput.addEventListener('blur', () => {
                descriptionInput.style.borderColor = '#e0e0e0';
            });
    
            // 按钮容器
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex !important;
                gap: 8px !important;
                justify-content: flex-end !important;
            `;
    
            const generateDescriptionBtn = document.createElement('button');
            generateDescriptionBtn.className = 'session-editor-generate-description';
            generateDescriptionBtn.innerHTML = '✨ 智能生成描述';
            generateDescriptionBtn.style.cssText = `
                padding: 12px 16px !important;
                background: #2196F3 !important;
                color: white !important;
                border: none !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                transition: background 0.2s ease !important;
                white-space: nowrap !important;
            `;
            generateDescriptionBtn.addEventListener('mouseenter', () => {
                generateDescriptionBtn.style.background = '#1976D2';
            });
            generateDescriptionBtn.addEventListener('mouseleave', () => {
                generateDescriptionBtn.style.background = '#2196F3';
            });
    
            const optimizeDescriptionBtn = document.createElement('button');
            optimizeDescriptionBtn.className = 'session-editor-optimize-description';
            optimizeDescriptionBtn.innerHTML = '🚀 智能优化';
            optimizeDescriptionBtn.style.cssText = `
                padding: 12px 16px !important;
                background: #4CAF50 !important;
                color: white !important;
                border: none !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                transition: background 0.2s ease !important;
                white-space: nowrap !important;
            `;
            optimizeDescriptionBtn.addEventListener('mouseenter', () => {
                optimizeDescriptionBtn.style.background = '#45a049';
            });
            optimizeDescriptionBtn.addEventListener('mouseleave', () => {
                optimizeDescriptionBtn.style.background = '#4CAF50';
            });
    
            // 翻译中文按钮
            const translateDescriptionZhBtn = document.createElement('button');
            translateDescriptionZhBtn.className = 'session-editor-translate-description-zh';
            translateDescriptionZhBtn.setAttribute('data-translate-field', 'description');
            translateDescriptionZhBtn.setAttribute('data-target-lang', 'zh');
            translateDescriptionZhBtn.innerHTML = '🇨🇳 翻译中文';
            translateDescriptionZhBtn.style.cssText = `
                padding: 12px 16px !important;
                background: #FF9800 !important;
                color: white !important;
                border: none !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                transition: background 0.2s ease !important;
                white-space: nowrap !important;
            `;
            translateDescriptionZhBtn.addEventListener('mouseenter', () => {
                translateDescriptionZhBtn.style.background = '#F57C00';
            });
            translateDescriptionZhBtn.addEventListener('mouseleave', () => {
                translateDescriptionZhBtn.style.background = '#FF9800';
            });
    
            // 翻译英文按钮
            const translateDescriptionEnBtn = document.createElement('button');
            translateDescriptionEnBtn.className = 'session-editor-translate-description-en';
            translateDescriptionEnBtn.setAttribute('data-translate-field', 'description');
            translateDescriptionEnBtn.setAttribute('data-target-lang', 'en');
            translateDescriptionEnBtn.innerHTML = '🇺🇸 翻译英文';
            translateDescriptionEnBtn.style.cssText = `
                padding: 12px 16px !important;
                background: #9C27B0 !important;
                color: white !important;
                border: none !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                transition: background 0.2s ease !important;
                white-space: nowrap !important;
            `;
            translateDescriptionEnBtn.addEventListener('mouseenter', () => {
                translateDescriptionEnBtn.style.background = '#7B1FA2';
            });
            translateDescriptionEnBtn.addEventListener('mouseleave', () => {
                translateDescriptionEnBtn.style.background = '#9C27B0';
            });
    
            buttonContainer.appendChild(optimizeDescriptionBtn);
            buttonContainer.appendChild(generateDescriptionBtn);
            buttonContainer.appendChild(translateDescriptionZhBtn);
            buttonContainer.appendChild(translateDescriptionEnBtn);
    
            descriptionInputWrapper.appendChild(descriptionInput);
            descriptionInputWrapper.appendChild(buttonContainer);
    
            descriptionGroup.appendChild(descriptionLabel);
            descriptionGroup.appendChild(descriptionInputWrapper);
    
            // 更新时间输入区域
            const updatedAtGroup = document.createElement('div');
            updatedAtGroup.style.cssText = `
                margin-bottom: 24px !important;
            `;
    
            const updatedAtLabel = document.createElement('label');
            updatedAtLabel.textContent = '更新时间';
            updatedAtLabel.style.cssText = `
                display: block !important;
                margin-bottom: 10px !important;
                font-size: 15px !important;
                font-weight: 500 !important;
                color: #333 !important;
            `;
    
            const updatedAtInput = document.createElement('input');
            updatedAtInput.className = 'session-editor-updatedat-input';
            updatedAtInput.type = 'datetime-local';
            updatedAtInput.style.cssText = `
                width: 100% !important;
                padding: 12px 14px !important;
                border: 2px solid #e0e0e0 !important;
                border-radius: 6px !important;
                font-size: 15px !important;
                outline: none !important;
                transition: border-color 0.2s ease !important;
                box-sizing: border-box !important;
            `;
    
            updatedAtInput.addEventListener('focus', () => {
                updatedAtInput.style.borderColor = '#4CAF50';
            });
            updatedAtInput.addEventListener('blur', () => {
                updatedAtInput.style.borderColor = '#e0e0e0';
            });
    
            updatedAtGroup.appendChild(updatedAtLabel);
            updatedAtGroup.appendChild(updatedAtInput);
    
            // 按钮区域
            const buttonGroup = document.createElement('div');
            buttonGroup.style.cssText = `
                display: flex !important;
                gap: 12px !important;
                justify-content: flex-end !important;
            `;
    
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'session-editor-cancel';
            cancelBtn.textContent = '取消';
            cancelBtn.style.cssText = `
                padding: 12px 24px !important;
                background: #f5f5f5 !important;
                color: #333 !important;
                border: none !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-size: 15px !important;
                font-weight: 500 !important;
                transition: background 0.2s ease !important;
            `;
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = '#e0e0e0';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = '#f5f5f5';
            });
    
            const saveBtn = document.createElement('button');
            saveBtn.className = 'session-editor-save';
            saveBtn.textContent = '保存';
            saveBtn.style.cssText = `
                padding: 12px 24px !important;
                background: #4CAF50 !important;
                color: white !important;
                border: none !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                font-size: 15px !important;
                font-weight: 500 !important;
                transition: background 0.2s ease !important;
            `;
            saveBtn.addEventListener('mouseenter', () => {
                saveBtn.style.background = '#45a049';
            });
            saveBtn.addEventListener('mouseleave', () => {
                saveBtn.style.background = '#4CAF50';
            });
    
            buttonGroup.appendChild(cancelBtn);
            buttonGroup.appendChild(saveBtn);
    
            // 组装面板
            panel.appendChild(header);
            panel.appendChild(titleGroup);
            panel.appendChild(descriptionGroup);
            panel.appendChild(updatedAtGroup);
            panel.appendChild(buttonGroup);
    
            // 组装模态框
            modal.appendChild(panel);
            document.body.appendChild(modal);
        };

        // 关闭会话信息编辑对话框
        proto.closeSessionInfoEditor = function() {
            const modal = document.body.querySelector('#pet-session-info-editor');
            if (modal) {
                modal.style.display = 'none';
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
    
            const titleInput = modal.querySelector('.session-editor-title-input');
            const descriptionInput = modal.querySelector('.session-editor-description-input');
            const updatedAtInput = modal.querySelector('.session-editor-updatedat-input');
    
            if (!titleInput) {
                console.error('标题输入框未找到');
                return;
            }
    
            const newTitle = titleInput.value.trim();
            const newDescription = descriptionInput ? descriptionInput.value.trim() : '';
    
            // 获取更新的时间
            let newUpdatedAt = Date.now();
            if (updatedAtInput && updatedAtInput.value) {
                // 将 datetime-local 格式转换为时间戳
                const dateValue = new Date(updatedAtInput.value);
                if (!isNaN(dateValue.getTime())) {
                    newUpdatedAt = dateValue.getTime();
                }
            }
    
            // 如果标题为空，不进行更新
            if (newTitle === '') {
                alert('会话标题不能为空');
                titleInput.focus();
                return;
            }
    
            const session = this.sessions[sessionId];
            const originalTitle = session.pageTitle || '未命名会话';
            const originalDescription = session.pageDescription || '';
            const originalUpdatedAt = session.updatedAt || Date.now();
    
            // 如果标题、描述和更新时间都没有变化，不需要更新
            if (newTitle === originalTitle && newDescription === originalDescription && newUpdatedAt === originalUpdatedAt) {
                this.closeSessionInfoEditor();
                return;
            }
    
            try {
                // 更新会话信息
                session.pageTitle = newTitle;
                session.pageDescription = newDescription;
                session.updatedAt = newUpdatedAt;
    
                // 保存会话到本地
                await this.saveAllSessions(false, true);
    
                // 更新UI显示
                await this.updateSessionSidebar(true);
    
                // 如果这是当前会话，同时更新聊天窗口标题和第一条消息
                if (sessionId === this.currentSessionId) {
                    this.updateChatHeaderTitle();
                    // 刷新第一条欢迎消息
                    await this.refreshWelcomeMessage();
                }
    
                console.log('会话信息已更新:', { title: newTitle, description: newDescription });
    
                // 关闭对话框
                this.closeSessionInfoEditor();
            } catch (error) {
                console.error('更新会话信息失败:', error);
                alert('更新信息失败，请重试');
            }
        };

        // 获取会话上下文信息
        proto.getSessionContext = function(sessionId) {
            const context = {
                messages: [],
                pageContent: '',
                pageTitle: '',
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
            if (session.pageTitle) {
                context.pageTitle = session.pageTitle;
            }
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
    
            const generateBtn = modal.querySelector('.session-editor-generate-title');
            const titleInput = modal.querySelector('.session-editor-title-input');
    
            if (!generateBtn || !titleInput) {
                return;
            }
    
            // 设置按钮为加载状态
            const originalText = generateBtn.innerHTML;
            generateBtn.disabled = true;
            generateBtn.innerHTML = '生成中...';
            generateBtn.style.opacity = '0.6';
            generateBtn.style.cursor = 'not-allowed';
    
            try {
                // 获取会话上下文
                const context = this.getSessionContext(sessionId);
    
                // 构建生成标题的 prompt
                let systemPrompt = '你是一个专业的助手，擅长根据会话内容生成简洁、准确的标题。';
                let userPrompt = '请根据以下会话内容，生成一个简洁、准确的标题（不超过20个字）：\n\n';
    
                // 添加页面信息
                if (context.pageTitle) {
                    userPrompt += `页面标题：${context.pageTitle}\n`;
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
                const payload = this.buildPromptPayload(
                    systemPrompt,
                    userPrompt
                );
    
                // 调用 prompt 接口
                const response = await fetch(PET_CONFIG.api.promptUrl, {
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
    
                // 提取生成的标题（适配不同的响应格式）
                let generatedTitle = '';
                if (result.status === 200 && result.data) {
                    // 成功响应，提取 data 字段
                    generatedTitle = typeof result.data === 'string' ? result.data.trim() : (result.data.content || '').trim();
                } else if (result && result.content) {
                    generatedTitle = result.content.trim();
                } else if (result && result.data && result.data.content) {
                    generatedTitle = result.data.content.trim();
                } else if (result && result.message) {
                    generatedTitle = result.message.trim();
                } else if (typeof result === 'string') {
                    generatedTitle = result.trim();
                }
    
                // 去除 think 内容
                if (this.stripThinkContent) {
                    generatedTitle = this.stripThinkContent(generatedTitle);
                }
    
                // 清理标题（移除可能的引号、换行等）
                generatedTitle = generatedTitle.replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim();
    
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
                generateBtn.style.opacity = '1';
                generateBtn.style.cursor = 'pointer';
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
    
            const generateBtn = modal.querySelector('.session-editor-generate-description');
            const descriptionInput = modal.querySelector('.session-editor-description-input');
    
            if (!generateBtn || !descriptionInput) {
                return;
            }
    
            // 设置按钮为加载状态
            const originalText = generateBtn.innerHTML;
            generateBtn.disabled = true;
            generateBtn.innerHTML = '生成中...';
            generateBtn.style.opacity = '0.6';
            generateBtn.style.cursor = 'not-allowed';
    
            try {
                // 获取会话上下文
                const context = this.getSessionContext(sessionId);
    
                // 构建生成描述的 prompt
                let systemPrompt = '你是一个专业的助手，擅长根据会话内容生成简洁、准确的网页描述。';
                let userPrompt = '请根据以下会话内容，生成一个简洁、准确的网页描述：\n\n';
    
                // 添加页面信息
                if (context.pageTitle) {
                    userPrompt += `页面标题：${context.pageTitle}\n`;
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
                const payload = this.buildPromptPayload(
                    systemPrompt,
                    userPrompt
                );
    
                // 调用 prompt 接口
                const response = await fetch(PET_CONFIG.api.promptUrl, {
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
    
                // 提取生成的描述（适配不同的响应格式）
                let generatedDescription = '';
                if (result.status === 200 && result.data) {
                    // 成功响应，提取 data 字段
                    generatedDescription = typeof result.data === 'string' ? result.data.trim() : (result.data.content || '').trim();
                } else if (result && result.content) {
                    generatedDescription = result.content.trim();
                } else if (result && result.data && result.data.content) {
                    generatedDescription = result.data.content.trim();
                } else if (result && result.message) {
                    generatedDescription = result.message.trim();
                } else if (typeof result === 'string') {
                    generatedDescription = result.trim();
                }
    
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
                generateBtn.innerHTML = originalText;
                generateBtn.style.opacity = '1';
                generateBtn.style.cursor = 'pointer';
            }
        };

        // 智能优化会话描述
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
            optimizeBtn.style.opacity = '0.6';
            optimizeBtn.style.cursor = 'not-allowed';
    
            try {
                // 获取会话上下文
                const context = this.getSessionContext(sessionId);
    
                // 构建优化描述的 prompt
                let systemPrompt = '你是一个专业的助手，擅长优化和润色网页描述，使其更加简洁、准确、吸引人。';
                let userPrompt = '请优化以下网页描述，使其更加简洁、准确、吸引人（50-200字）：\n\n';
                userPrompt += `当前描述：${currentDescription}\n\n`;
    
                // 添加页面信息以提供上下文
                if (context.pageTitle) {
                    userPrompt += `页面标题：${context.pageTitle}\n`;
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
                const payload = this.buildPromptPayload(
                    systemPrompt,
                    userPrompt
                );
    
                // 调用 prompt 接口
                const response = await fetch(PET_CONFIG.api.promptUrl, {
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
    
                // 提取优化后的描述（适配不同的响应格式）
                let optimizedDescription = '';
                if (result.status === 200 && result.data) {
                    // 成功响应，提取 data 字段
                    optimizedDescription = typeof result.data === 'string' ? result.data.trim() : (result.data.content || '').trim();
                } else if (result && result.content) {
                    optimizedDescription = result.content.trim();
                } else if (result && result.data && result.data.content) {
                    optimizedDescription = result.data.content.trim();
                } else if (result && result.message) {
                    optimizedDescription = result.message.trim();
                } else if (typeof result === 'string') {
                    optimizedDescription = result.trim();
                }
    
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
                optimizeBtn.style.opacity = '1';
                optimizeBtn.style.cursor = 'pointer';
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
            const translateBtn = modal ? modal.querySelector(`button[data-translate-field="${fieldType}"][data-target-lang="${targetLanguage}"]`) : null;
            const originalBtnText = translateBtn ? translateBtn.textContent : '';
            if (translateBtn) {
                translateBtn.disabled = true;
                translateBtn.textContent = '翻译中...';
                translateBtn.style.opacity = '0.6';
                translateBtn.style.cursor = 'not-allowed';
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
    
                // 调用 prompt 接口
                const response = await fetch(PET_CONFIG.api.promptUrl, {
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
                let translatedText;
                // 优先检查 status 字段，如果存在且不等于 200，则抛出错误
                if (result.status !== undefined && result.status !== 200) {
                    throw new Error(result.msg || result.message || '翻译失败');
                }
    
                // 按优先级提取翻译后的文本
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
                    // 如果所有字段都不存在，尝试从对象中查找可能的文本字段
                    const possibleFields = ['output', 'response', 'result', 'answer'];
                    for (const field of possibleFields) {
                        if (result[field] && typeof result[field] === 'string') {
                            translatedText = result[field];
                            break;
                        }
                    }
    
                    // 如果仍然找不到，抛出错误
                    if (!translatedText) {
                        console.error('无法解析响应内容，响应对象:', result);
                        throw new Error('无法解析响应内容，请检查服务器响应格式');
                    }
                }
    
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
                    translateBtn.style.opacity = '1';
                    translateBtn.style.cursor = 'pointer';
                }
                // 隐藏加载动画
                this._hideLoadingAnimation();
            }
        };
    }

    extendPetManager();
})();
