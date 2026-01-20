(function(global) {
    const proto = global.PetManager.prototype;

    // ========== 页面上下文编辑器 ==========

    // 确保上下文编辑器 UI 存在
    proto.ensureContextEditorUi = function() {
        if (!this.chatWindow) return;
        if (document.getElementById('pet-context-editor')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pet-context-editor';
        // 初始使用顶部不遮住 chat-header 的定位（根据当前 header 高度）
        const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
        const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
        overlay.style.cssText = `
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            top: ${headerH}px !important;
            background: transparent !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: ${PET_CONFIG.ui.zIndex.inputContainer + 1} !important;
            pointer-events: none !important;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            width: calc(100% - 24px) !important;
            height: calc(100% - 12px) !important;
            margin: 0 12px 12px 12px !important;
            background: #1f1f1f !important;
            color: #fff !important;
            border-radius: 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            min-height: 0 !important;
            pointer-events: auto !important;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 10px 14px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            background: rgba(255,255,255,0.04) !important;
        `;
        const title = document.createElement('div');
        title.textContent = '页面上下文（Markdown）';
        title.style.cssText = 'font-weight: 600;';
        const headerBtns = document.createElement('div');
        headerBtns.className = 'editor-header-btns';
        // 简洁模式切换：并排 / 仅编辑 / 仅预览
        const modeGroup = document.createElement('div');
        modeGroup.className = 'editor-mode-group';
        const makeModeBtn = (id, label, mode) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.textContent = label;
            btn.className = 'editor-mode-btn';
            btn.addEventListener('click', () => this.setContextMode(mode));
            return btn;
        };
        const btnSplit = makeModeBtn('pet-context-mode-split', '并排', 'split');
        const btnEdit = makeModeBtn('pet-context-mode-edit', '仅编辑', 'edit');
        const btnPreview = makeModeBtn('pet-context-mode-preview', '仅预览', 'preview');
        modeGroup.appendChild(btnSplit);
        modeGroup.appendChild(btnEdit);
        modeGroup.appendChild(btnPreview);
        const closeBtn = document.createElement('button');
        closeBtn.id = 'pet-context-close-btn';
        closeBtn.className = 'chat-toolbar-btn';
        closeBtn.setAttribute('aria-label', '关闭上下文面板 (Esc)');
        closeBtn.setAttribute('title', '关闭 (Esc)');
        closeBtn.textContent = '✕';
        closeBtn.classList.add('context-close-btn');
        closeBtn.addEventListener('click', () => this.closeContextEditor());
        headerBtns.appendChild(modeGroup);
        // 复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.id = 'pet-context-copy-btn';
        copyBtn.className = 'chat-toolbar-btn';
        copyBtn.setAttribute('title', '复制内容');
        copyBtn.textContent = '复制';
        copyBtn.classList.add('context-copy-btn');
        copyBtn.addEventListener('click', () => this.copyContextEditor());

        // 智能优化按钮组
        const optimizeBtnGroup = document.createElement('div');
        optimizeBtnGroup.className = 'optimize-btn-group';

        const optimizeBtn = document.createElement('button');
        optimizeBtn.id = 'pet-context-optimize-btn';
        optimizeBtn.textContent = '✨ 智能优化';
        optimizeBtn.setAttribute('title', '智能优化上下文内容');
        optimizeBtn.className = 'context-optimize-btn';
        optimizeBtn.addEventListener('click', async () => {
            await this.optimizeContext();
        });

        const undoBtn = document.createElement('button');
        undoBtn.id = 'pet-context-undo-btn';
        undoBtn.textContent = '↶ 撤销';
        undoBtn.setAttribute('title', '撤销优化');
        undoBtn.style.cssText = `
            padding: 4px 12px !important;
            border-radius: 4px !important;
            border: 1px solid rgba(255, 152, 0, 0.3) !important;
            background: rgba(255, 152, 0, 0.15) !important;
            color: #ff9800 !important;
            cursor: pointer !important;
            font-size: 12px !important;
            white-space: nowrap !important;
            display: none !important;
            transition: all 0.2s !important;
        `;
        undoBtn.addEventListener('click', () => {
            const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
            if (textarea) {
                const originalText = textarea.getAttribute('data-original-text');
                if (originalText !== null) {
                    textarea.value = originalText;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    undoBtn.style.display = 'none';
                    this.showNotification('已撤销优化', 'info');
                }
            }
        });
        undoBtn.addEventListener('mouseenter', () => {
            undoBtn.style.background = 'rgba(255, 152, 0, 0.25)';
        });
        undoBtn.addEventListener('mouseleave', () => {
            undoBtn.style.background = 'rgba(255, 152, 0, 0.15)';
        });

        optimizeBtnGroup.appendChild(optimizeBtn);
        optimizeBtnGroup.appendChild(undoBtn);

        // 拉取当前网页上下文按钮
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'pet-context-refresh-btn';
        refreshBtn.className = 'chat-toolbar-btn';
        refreshBtn.setAttribute('title', '拉取当前网页上下文');
        refreshBtn.setAttribute('aria-label', '拉取当前网页上下文');
        refreshBtn.textContent = '刷新';
        refreshBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease, color .12s ease !important;
            outline: none !important;
        `;
        refreshBtn.addEventListener('mouseenter', () => {
            if (!refreshBtn.hasAttribute('data-refreshing')) {
                refreshBtn.style.background = 'rgba(255,255,255,0.12)';
                refreshBtn.style.borderColor = 'rgba(255,255,255,0.25)';
            }
        });
        refreshBtn.addEventListener('mouseleave', () => {
            if (!refreshBtn.hasAttribute('data-refreshing')) {
                refreshBtn.style.background = 'rgba(255,255,255,0.04)';
                refreshBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            }
        });
        refreshBtn.addEventListener('click', async () => {
            if (refreshBtn.hasAttribute('data-refreshing')) return;

            refreshBtn.setAttribute('data-refreshing', 'true');
            const originalText = refreshBtn.textContent;
            refreshBtn.textContent = '拉取中...';
            refreshBtn.style.opacity = '0.6';
            refreshBtn.style.cursor = 'not-allowed';

            try {
                await this.refreshContextFromPage();

                // 显示成功提示
                refreshBtn.textContent = '✓ 已更新';
                refreshBtn.style.background = 'rgba(76, 175, 80, 0.2)';
                refreshBtn.style.color = '#22c55e';  /* 现代绿 */
                refreshBtn.style.borderColor = 'rgba(76, 175, 80, 0.4)';

                setTimeout(() => {
                    refreshBtn.textContent = originalText;
                    refreshBtn.style.background = 'rgba(255,255,255,0.04)';
                    refreshBtn.style.color = '#e5e7eb';
                    refreshBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                    refreshBtn.removeAttribute('data-refreshing');
                    refreshBtn.style.opacity = '1';
                    refreshBtn.style.cursor = 'pointer';
                }, 2000);
            } catch (error) {
                console.error('拉取网页上下文失败:', error);

                // 显示失败提示
                refreshBtn.textContent = '✕ 失败';
                refreshBtn.style.background = 'rgba(244, 67, 54, 0.2)';
                refreshBtn.style.color = '#ef4444';  /* 量子红 */
                refreshBtn.style.borderColor = 'rgba(244, 67, 54, 0.4)';

                setTimeout(() => {
                    refreshBtn.textContent = originalText;
                    refreshBtn.style.background = 'rgba(255,255,255,0.04)';
                    refreshBtn.style.color = '#e5e7eb';
                    refreshBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                    refreshBtn.removeAttribute('data-refreshing');
                    refreshBtn.style.opacity = '1';
                    refreshBtn.style.cursor = 'pointer';
                }, 2000);
            }
        });

        // 保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.id = 'pet-context-save-btn';
        saveBtn.className = 'chat-toolbar-btn';
        saveBtn.setAttribute('title', '保存修改 (Ctrl+S / Cmd+S)');
        saveBtn.setAttribute('aria-label', '保存修改');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease, color .12s ease !important;
            outline: none !important;
        `;
        saveBtn.addEventListener('mouseenter', () => {
            if (!saveBtn.hasAttribute('data-saving')) {
                saveBtn.style.background = 'rgba(255,255,255,0.12)';
                saveBtn.style.borderColor = 'rgba(255,255,255,0.25)';
            }
        });
        saveBtn.addEventListener('mouseleave', () => {
            if (!saveBtn.hasAttribute('data-saving')) {
                saveBtn.style.background = 'rgba(255,255,255,0.04)';
                saveBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            }
        });
        saveBtn.addEventListener('click', async () => {
            if (saveBtn.hasAttribute('data-saving')) return;

            saveBtn.setAttribute('data-saving', 'true');
            const originalText = saveBtn.textContent; // 保存原始文本（应该是"保存"）
            saveBtn.textContent = '保存中...';
            saveBtn.style.opacity = '0.6';
            saveBtn.style.cursor = 'not-allowed';

            try {
                const success = await this.saveContextEditor();
                // 传递原始文本，确保恢复正确
                this._showSaveStatus(saveBtn, success, originalText);
            } catch (error) {
                console.error('保存失败:', error);
                // 传递原始文本，确保恢复正确
                this._showSaveStatus(saveBtn, false, originalText);
            } finally {
                // 在状态提示显示2秒后，移除禁用状态
                setTimeout(() => {
                    saveBtn.removeAttribute('data-saving');
                    saveBtn.style.opacity = '1';
                    saveBtn.style.cursor = 'pointer';
                }, 2000);
            }
        });

        // 下载按钮（导出 Markdown）
        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'pet-context-download-btn';
        downloadBtn.className = 'chat-toolbar-btn';
        downloadBtn.setAttribute('title', '下载当前上下文为 Markdown (.md)');
        downloadBtn.textContent = '下载';
        downloadBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
        `;
        downloadBtn.addEventListener('click', () => this.downloadContextMarkdown());

        // 翻译按钮组
        const translateBtnGroup = document.createElement('div');
        translateBtnGroup.style.cssText = 'display: flex; gap: 6px; align-items: center;';

        // 翻译成中文按钮
        const translateToZhBtn = document.createElement('button');
        translateToZhBtn.id = 'pet-context-translate-zh-btn';
        translateToZhBtn.className = 'chat-toolbar-btn';
        translateToZhBtn.setAttribute('title', '翻译成中文');
        translateToZhBtn.textContent = '🇨🇳 中文';
        translateToZhBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(33, 150, 243, 0.3) !important;
            background: rgba(33, 150, 243, 0.15) !important;
            color: #3b82f6 !important;  /* 信息蓝 */
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
            white-space: nowrap !important;
        `;
        translateToZhBtn.addEventListener('mouseenter', () => {
            if (!translateToZhBtn.hasAttribute('data-translating')) {
                translateToZhBtn.style.background = 'rgba(33, 150, 243, 0.25)';
                translateToZhBtn.style.borderColor = 'rgba(33, 150, 243, 0.4)';
            }
        });
        translateToZhBtn.addEventListener('mouseleave', () => {
            if (!translateToZhBtn.hasAttribute('data-translating')) {
                translateToZhBtn.style.background = 'rgba(33, 150, 243, 0.15)';
                translateToZhBtn.style.borderColor = 'rgba(33, 150, 243, 0.3)';
            }
        });
        translateToZhBtn.addEventListener('click', async () => {
            await this.translateContext('zh');
        });

        // 翻译成英文按钮
        const translateToEnBtn = document.createElement('button');
        translateToEnBtn.id = 'pet-context-translate-en-btn';
        translateToEnBtn.className = 'chat-toolbar-btn';
        translateToEnBtn.setAttribute('title', '翻译成英文');
        translateToEnBtn.textContent = '🇺🇸 英文';
        translateToEnBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(156, 39, 176, 0.3) !important;
            background: rgba(156, 39, 176, 0.15) !important;
            color: #9c27b0 !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
            white-space: nowrap !important;
        `;
        translateToEnBtn.addEventListener('mouseenter', () => {
            if (!translateToEnBtn.hasAttribute('data-translating')) {
                translateToEnBtn.style.background = 'rgba(156, 39, 176, 0.25)';
                translateToEnBtn.style.borderColor = 'rgba(156, 39, 176, 0.4)';
            }
        });
        translateToEnBtn.addEventListener('mouseleave', () => {
            if (!translateToEnBtn.hasAttribute('data-translating')) {
                translateToEnBtn.style.background = 'rgba(156, 39, 176, 0.15)';
                translateToEnBtn.style.borderColor = 'rgba(156, 39, 176, 0.3)';
            }
        });
        translateToEnBtn.addEventListener('click', async () => {
            await this.translateContext('en');
        });

        translateBtnGroup.appendChild(translateToZhBtn);
        translateBtnGroup.appendChild(translateToEnBtn);

        headerBtns.appendChild(copyBtn);
        headerBtns.appendChild(optimizeBtnGroup);
        headerBtns.appendChild(translateBtnGroup);
        headerBtns.appendChild(refreshBtn);
        headerBtns.appendChild(saveBtn);
        headerBtns.appendChild(downloadBtn);
        headerBtns.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(headerBtns);

        const body = document.createElement('div');
        body.style.cssText = `
            flex: 1 !important;
            display: flex !important;
            padding: 10px !important;
            gap: 10px !important;
            min-height: 0 !important;
        `;
        const textarea = document.createElement('textarea');
        textarea.id = 'pet-context-editor-textarea';
        textarea.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #121212 !important;
            color: #fff !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace !important;
            font-size: 12px !important;
            line-height: 1.6 !important;
            outline: none !important;
            resize: none !important;
            white-space: pre-wrap !important;
            min-height: 0 !important;
            overflow: auto !important;
            -webkit-overflow-scrolling: touch !important;
        `;
        const preview = document.createElement('div');
        preview.id = 'pet-context-preview';
        preview.className = 'markdown-content'; // 添加 markdown-content 类以应用样式
        preview.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #0e0e0e !important;
            color: #e5e7eb !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            pointer-events: auto !important;
            font-size: 14px !important;
            line-height: 1.6 !important;
        `;
        // 防止滚动事件冒泡到父级，保证自身滚动有效
        preview.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
        preview.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
        // 编辑时实时更新预览（防抖）
        textarea.addEventListener('input', () => {
            if (this._contextPreviewTimer) clearTimeout(this._contextPreviewTimer);
            this._contextPreviewTimer = setTimeout(() => {
                this.updateContextPreview();
            }, 150);
        });
        // 同步滚动（比例映射）
        textarea.addEventListener('scroll', () => {
            const previewEl = this.chatWindow ? this.chatWindow.querySelector('#pet-context-preview') : null;
            if (!previewEl) return;
            const tMax = textarea.scrollHeight - textarea.clientHeight;
            const pMax = previewEl.scrollHeight - previewEl.clientHeight;
            if (tMax > 0 && pMax >= 0) {
                const ratio = textarea.scrollTop / tMax;
                previewEl.scrollTop = ratio * pMax;
            }
        }, { passive: true });
        body.appendChild(textarea);
        body.appendChild(preview);

        panel.appendChild(header);
        panel.appendChild(body);
        overlay.appendChild(panel);
        // 确保聊天窗口容器为定位上下文
        const currentPosition = window.getComputedStyle(this.chatWindow).position;
        if (currentPosition === 'static') {
            this.chatWindow.style.position = 'relative';
        }
        this.chatWindow.appendChild(overlay);
    };

    proto.openContextEditor = function() {
        this.ensureContextEditorUi();
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor') : null;
        if (!overlay) return;
        overlay.style.display = 'flex';
        // 打开时根据当前 header 高度校正位置
        this.updateContextEditorPosition();
        this.loadContextIntoEditor();
        this.updateContextPreview();
        // 隐藏撤销按钮（打开编辑器时重置状态）
        const undoBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-undo-btn') : null;
        if (undoBtn) {
            undoBtn.style.display = 'none';
        }
        // 默认并排模式
        this._contextPreviewMode = this._contextPreviewMode || 'split';
        this.applyContextPreviewMode();
        // 隐藏折叠按钮
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
        if (inputToggleBtn) inputToggleBtn.style.display = 'none';
        // 键盘快捷键：Esc 关闭，Ctrl+S / Cmd+S 保存
        this._contextKeydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeContextEditor();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const saveBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-save-btn') : null;
                if (saveBtn && !saveBtn.hasAttribute('data-saving')) {
                    saveBtn.click();
                }
            }
        };
        document.addEventListener('keydown', this._contextKeydownHandler, { capture: true });
        // 监听窗口尺寸变化，动态更新覆盖层位置
        this._contextResizeHandler = () => this.updateContextEditorPosition();
        window.addEventListener('resize', this._contextResizeHandler, { passive: true });
    };

    proto.closeContextEditor = function() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor') : null;
        if (overlay) overlay.style.display = 'none';

        // 显示折叠按钮
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
        if (inputToggleBtn) inputToggleBtn.style.display = 'flex';

        if (this._contextKeydownHandler) {
            document.removeEventListener('keydown', this._contextKeydownHandler, { capture: true });
            this._contextKeydownHandler = null;
        }
        if (this._contextResizeHandler) {
            window.removeEventListener('resize', this._contextResizeHandler);
            this._contextResizeHandler = null;
        }
    };

    /**
     * 显示指定会话的页面上下文
     * 支持两种调用方式：
     * 1. showSessionContext(sessionId) - 从按钮调用
     * 2. showSessionContext(event, session) - 从右键菜单调用
     * @param {string|Event} sessionIdOrEvent - 会话ID或事件对象
     * @param {Object} [session] - 会话对象（可选，用于右键菜单调用）
     */
    proto.showSessionContext = async function(sessionIdOrEvent, session) {
        let sessionId = null;

        // 处理两种调用方式
        if (typeof sessionIdOrEvent === 'string') {
            // 方式1: showSessionContext(sessionId)
            sessionId = sessionIdOrEvent;
        } else if (sessionIdOrEvent && session) {
            // 方式2: showSessionContext(event, session)
            sessionId = session.key || session.id || session.sessionId;
        } else {
            console.warn('无效的参数，无法显示上下文');
            this.showNotification('无法显示上下文：参数无效', 'error');
            return;
        }

        if (!sessionId) {
            console.warn('会话ID为空，无法显示上下文');
            this.showNotification('无法显示上下文：会话ID为空', 'error');
            return;
        }

        // 检查会话是否存在
        if (!this.sessions || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法显示上下文:', sessionId);
            this.showNotification('无法显示上下文：会话不存在', 'error');
            return;
        }

        try {
            // 如果指定的会话不是当前会话，先切换到该会话
            if (this.currentSessionId !== sessionId) {
                console.log('切换到会话以显示上下文:', sessionId);
                
                // 使用 switchSession 方法切换会话
                if (typeof this.switchSession === 'function') {
                    await this.switchSession(sessionId);
                } else if (typeof this.activateSession === 'function') {
                    // 如果 switchSession 不存在，使用 activateSession
                    await this.activateSession(sessionId, {
                        saveCurrent: false,
                        updateConsistency: true,
                        updateUI: true,
                        syncToBackend: false
                    });
                } else {
                    // 如果都没有，直接设置当前会话ID
                    this.currentSessionId = sessionId;
                }

                // 等待会话切换完成，确保页面上下文已加载
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 打开上下文编辑器（会自动加载当前会话的上下文）
            this.openContextEditor();

            console.log('已打开会话的页面上下文:', sessionId);
        } catch (error) {
            console.error('显示会话上下文失败:', error);
            this.showNotification('显示上下文失败：' + (error.message || '未知错误'), 'error');
        }
    };

    proto.setContextMode = function(mode) {
        this._contextPreviewMode = mode; // 'split' | 'edit' | 'preview'
        this.applyContextPreviewMode();
    };

    proto.applyContextPreviewMode = function() {
        if (!this.chatWindow) return;
        const textarea = this.chatWindow.querySelector('#pet-context-editor-textarea');
        const preview = this.chatWindow.querySelector('#pet-context-preview');
        const btnSplit = this.chatWindow.querySelector('#pet-context-mode-split');
        const btnEdit = this.chatWindow.querySelector('#pet-context-mode-edit');
        const btnPreview = this.chatWindow.querySelector('#pet-context-mode-preview');
        if (!textarea || !preview) return;
        const mode = this._contextPreviewMode;
        const isPreviewOnly = mode === 'preview';
        const isEditOnly = mode === 'edit';
        textarea.style.display = isPreviewOnly ? 'none' : 'block';
        preview.style.display = isEditOnly ? 'none' : 'block';
        textarea.style.width = isEditOnly ? '100%' : (isPreviewOnly ? '0%' : '50%');
        preview.style.width = isPreviewOnly ? '100%' : (isEditOnly ? '0%' : '50%');
        // 激活态样式更简单：当前模式高亮底色
        const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
        const resetBtn = (b) => { if (!b) return; b.style.background = 'transparent'; b.style.color = '#e5e7eb'; b.style.border = 'none'; };
        const activateBtn = (b) => { if (!b) return; b.style.background = currentMainColor; b.style.color = '#fff'; b.style.border = 'none'; };
        resetBtn(btnSplit); resetBtn(btnEdit); resetBtn(btnPreview);
        if (mode === 'split') activateBtn(btnSplit);
        if (mode === 'edit') activateBtn(btnEdit);
        if (mode === 'preview') activateBtn(btnPreview);
    };

    // 动态更新上下文覆盖层的位置与尺寸，避免遮挡 chat-header
    proto.updateContextEditorPosition = function() {
        if (!this.chatWindow) return;
        const overlay = this.chatWindow.querySelector('#pet-context-editor');
        if (!overlay) return;
        const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
        const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
        overlay.style.top = headerH + 'px';
        overlay.style.left = '0px';
        overlay.style.right = '0px';
        overlay.style.bottom = '0px';
    };

    /**
     * 从当前网页拉取上下文并更新编辑器
     * @returns {Promise<void>}
     */
    proto.refreshContextFromPage = async function() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) {
            throw new Error('未找到上下文编辑器');
        }

        try {
            // 获取当前网页渲染后的 HTML 内容并转换为 Markdown
            const pageContent = this.getRenderedHTMLAsMarkdown();

            // 更新编辑器内容
            textarea.value = pageContent || '';

            // 更新预览
            this.updateContextPreview();

            // 如果当前有会话，也更新会话中的页面内容
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const pageTitle = document.title || '当前页面';
                const session = this.sessions[this.currentSessionId];
                session.pageContent = pageContent;
                session.pageTitle = pageTitle;
                // 更新会话时间戳，确保保存逻辑识别到变化
                session.updatedAt = Date.now();
                session.lastAccessTime = Date.now();
                // 静默保存，不显示提示（同步到后端）
                this.saveAllSessions(true, true).catch(err => {
                    console.error('自动保存更新的上下文失败:', err);
                });
            }
        } catch (error) {
            console.error('拉取网页上下文失败:', error);
            throw error;
        }
    };

    /**
     * 获取当前网页渲染后的 HTML 内容并转换为 Markdown
     * 该方法专门用于刷新按钮功能，确保获取最新的渲染内容
     */
    proto.getRenderedHTMLAsMarkdown = function() {
        try {
            // 检查 Turndown 是否可用
            if (typeof TurndownService === 'undefined') {
                console.warn('Turndown 未加载，返回纯文本内容');
                return this.getFullPageText();
            }

            // 定义需要排除的选择器
            const excludeSelectors = [
                'script', 'style', 'noscript', 'iframe', 'embed', 'object',
                'svg', 'canvas', 'video', 'audio',
                '.ad', '.advertisement', '.ads', '.advertisement-container',
                '[class*="ad-"]', '[class*="banner"]', '[class*="promo"]',
                '[id*="ad-"]', '[id*="banner"]', '[id*="promo"]',
                'nav', 'header', 'footer', 'aside',
                '.sidebar', '.menu', '.navigation', '.navbar', '.nav',
                '.header', '.footer', '.comment', '.comments', '.social-share',
                '.related-posts', '.related', '.widget', '.sidebar-widget',
                // 排除插件相关元素
                `#${(typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.ids) ? PET_CONFIG.constants.ids.assistantElement : 'chat-assistant-element'}`, '[id^="pet-"]', '[class*="pet-"]',
                '[id*="pet-chat"]', '[class*="pet-chat"]',
                '[id*="pet-context"]', '[class*="pet-context"]',
                '[id*="pet-faq"]', '[class*="pet-faq"]',
                '[id*="pet-api"]', '[class*="pet-api"]',
                '[id*="pet-session"]', '[class*="pet-session"]'
            ];

            // 定义主要正文内容选择器（优先级从高到低）
            const contentSelectors = [
                'article',
                'main',
                '[role="main"]',
                '[role="article"]',
                '.post-content', '.entry-content', '.article-content',
                '.post-body', '.article-body', '.text-content',
                '.content', '.main-content', '.page-content',
                '.article', '.blog-post', '.entry', '.post',
                '#content', '#main-content', '#main',
                '.content-area', '.content-wrapper',
                '.text-wrapper', '.text-container'
            ];

            // 尝试从主要内容区域获取渲染后的 HTML
            let mainContent = null;
            for (const selector of contentSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim().length > 100) {
                    mainContent = element;
                    break;
                }
            }

            // 如果没有找到主要内容区域，使用 body（但排除导航、侧边栏等）
            if (!mainContent) {
                mainContent = document.body;
            }

            // 深度克隆内容，保留所有渲染后的属性和状态
            const cloned = mainContent.cloneNode(true);

            // 移除不需要的元素
            excludeSelectors.forEach(sel => {
                try {
                    const elements = cloned.querySelectorAll(sel);
                    elements.forEach(el => {
                        if (el && el.parentNode) {
                            el.parentNode.removeChild(el);
                        }
                    });
                } catch (e) {
                    console.warn('移除元素失败:', sel, e);
                }
            });

            // 配置 Turndown 服务
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                hr: '---',
                bulletListMarker: '-',
                codeBlockStyle: 'fenced',
                fence: '```',
                emDelimiter: '_',
                strongDelimiter: '**',
                linkStyle: 'inlined',
                linkReferenceStyle: 'full',
                preformattedCode: true
            });

            // 添加自定义规则，更好地处理特殊元素
            turndownService.addRule('preserveLineBreaks', {
                filter: ['br'],
                replacement: () => '\n'
            });

            // 转换为 Markdown
            let markdown = turndownService.turndown(cloned);

            // 清理多余的空行（保留双空行用于段落分隔）
            markdown = markdown
                .replace(/\n{4,}/g, '\n\n\n')  // 最多保留三个换行（两个空行）
                .trim();

            // 如果 Markdown 内容太短或为空，尝试获取纯文本
            if (!markdown || markdown.trim().length < 50) {
                console.warn('Markdown 内容过短，尝试获取纯文本');
                const textContent = cloned.textContent || cloned.innerText || '';
                return textContent.trim();
            }

            return markdown;
        } catch (error) {
            console.error('将渲染后的 HTML 转换为 Markdown 时出错:', error);
            // 出错时返回纯文本
            return this.getFullPageText();
        }
    };

    /**
     * 处理手动保存会话（从欢迎消息按钮触发）
     * @param {HTMLElement} button - 保存按钮元素
     */
    proto.handleManualSaveSession = async function(button) {
        if (!this.currentSessionId) {
            console.warn('当前没有活动会话');
            this._showManualSaveStatus(button, false);
            return;
        }

        if (!this.sessions[this.currentSessionId]) {
            console.warn('会话不存在');
            this._showManualSaveStatus(button, false);
            return;
        }

        // 获取按钮元素
        const iconEl = button.querySelector('.save-btn-icon');
        const textEl = button.querySelector('.save-btn-text');
        const loaderEl = button.querySelector('.save-btn-loader');

        try {
            // 设置 loading 状态
            button.disabled = true;
            button.classList.add('loading');
            // 隐藏图标和文本，显示 loader
            if (iconEl) {
                iconEl.style.opacity = '0';
                iconEl.style.display = 'none';
            }
            if (textEl) {
                textEl.style.opacity = '0';
                textEl.textContent = '保存中...';
            }
            if (loaderEl) {
                loaderEl.style.display = 'block';
            }

            const session = this.sessions[this.currentSessionId];

            // 获取当前页面内容并更新到会话
            const pageContent = this.getPageContentAsMarkdown();
            session.pageContent = pageContent || '';

            // 更新页面信息（确保信息是最新的）
            // 优先保留会话的 pageTitle（如果已有有效标题），避免覆盖从后端加载的标题
            const pageInfo = this.getPageInfo();
            const currentPageTitle = pageInfo.title || pageInfo.pageTitle || document.title || '当前页面';
            const sessionPageTitle = session.pageTitle || session.title || '';
            const isDefaultTitle = !sessionPageTitle ||
                                  sessionPageTitle.trim() === '' ||
                                  sessionPageTitle === '未命名会话' ||
                                  sessionPageTitle === '新会话' ||
                                  sessionPageTitle === '未命名页面' ||
                                  sessionPageTitle === '当前页面';

            // 只有当标题是默认值时才更新，否则保留原有标题
            session.pageTitle = isDefaultTitle ? currentPageTitle : sessionPageTitle;
            session.pageDescription = pageInfo.description || session.pageDescription || '';
            session.url = pageInfo.url || session.url || window.location.href;

            // 更新会话时间戳
            session.updatedAt = Date.now();
            session.lastAccessTime = Date.now();

            // 先保存到本地存储
            await this.saveAllSessions(true, true);

            // 手动保存时，同步到后端并包含 pageContent 字段
            await this.syncSessionToBackend(this.currentSessionId, true, true);


            // 刷新欢迎消息以隐藏保存按钮（因为现在已存在于后端列表中）
            await this.refreshWelcomeMessage();

            // 显示成功状态
            this._showManualSaveStatus(button, true);

            console.log('会话已手动保存:', this.currentSessionId);
        } catch (error) {
            console.error('手动保存会话失败:', error);
            this._showManualSaveStatus(button, false);
        }
    };

    /**
     * 显示手动保存按钮的状态
     * @param {HTMLElement} button - 按钮元素
     * @param {boolean} success - 是否成功
     */
    proto._showManualSaveStatus = function(button, success) {
        const iconEl = button.querySelector('.save-btn-icon');
        const textEl = button.querySelector('.save-btn-text');
        const loaderEl = button.querySelector('.save-btn-loader');

        // 移除 loading 状态
        button.classList.remove('loading');
        if (loaderEl) loaderEl.style.display = 'none';

        if (success) {
            // 成功状态
            button.classList.add('success');
            button.classList.remove('error');
            if (iconEl) {
                iconEl.textContent = '✓';
                iconEl.style.display = 'inline-flex';
            }
            if (textEl) textEl.textContent = '已保存';
        } else {
            // 失败状态
            button.classList.add('error');
            button.classList.remove('success');
            if (iconEl) {
                iconEl.textContent = '✕';
                iconEl.style.display = 'inline-flex';
            }
            if (textEl) textEl.textContent = '保存失败';
        }

        // 2.5秒后恢复按钮状态
        setTimeout(() => {
            button.disabled = false;
            button.classList.remove('success', 'error');
            if (iconEl) {
                iconEl.textContent = '💾';
                iconEl.style.display = 'inline-flex';
            }
            if (textEl) textEl.textContent = '保存会话';
        }, 2500);
    };

    /**
     * 保存页面上下文编辑器内容到会话
     * @returns {Promise<boolean>} 保存是否成功
     */
    proto.saveContextEditor = async function() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) {
            console.warn('未找到上下文编辑器');
            return false;
        }

        if (!this.currentSessionId) {
            console.warn('当前没有活动会话');
            return false;
        }

        if (!this.sessions[this.currentSessionId]) {
            console.warn('会话不存在');
            return false;
        }

        try {
            const editedContent = textarea.value || '';
            const session = this.sessions[this.currentSessionId];

            // 更新页面内容
            session.pageContent = editedContent;
            // 更新会话时间戳，确保保存逻辑识别到变化
            session.updatedAt = Date.now();
            session.lastAccessTime = Date.now();

            // 如果页面标题还没有设置，同时更新页面标题
            if (!session.pageTitle || session.pageTitle === '当前页面') {
                session.pageTitle = document.title || '当前页面';
            }

            // 异步保存到存储（同步到后端）
            await this.saveAllSessions(true, true);

            // 手动保存页面上下文时，需要同步到后端并包含 pageContent 字段
            await this.syncSessionToBackend(this.currentSessionId, true, true);

            // 调用 write-file 接口写入页面上下文（参考 YiWeb 的 handleSessionCreate）
            if (editedContent && editedContent.trim() && typeof this.writeSessionPageContent === 'function') {
                try {
                    await this.writeSessionPageContent(this.currentSessionId);
                } catch (writeError) {
                    // write-file 调用失败不影响保存流程，只记录警告
                    console.warn('[saveContextEditor] write-file 接口调用失败（已忽略）:', writeError?.message);
                }
            }

            console.log('页面上下文已保存到会话:', this.currentSessionId);
            return true;
        } catch (error) {
            console.error('保存页面上下文失败:', error);
            return false;
        }
    };

    /**
     * 显示保存状态提示
     * @param {HTMLElement} button - 保存按钮元素
     * @param {boolean} success - 是否成功
     * @param {string} originalText - 原始按钮文本（可选，默认使用 '保存'）
     */
    proto._showSaveStatus = function(button, success, originalText = '保存') {
        const originalBackground = button.style.background;
        const originalColor = button.style.color;

        if (success) {
            button.textContent = '✓ 已保存';
            button.style.background = 'rgba(76, 175, 80, 0.2)';
            button.style.color = '#22c55e';  /* 现代绿 */
            button.style.borderColor = 'rgba(76, 175, 80, 0.4)';
        } else {
            button.textContent = '✕ 保存失败';
            button.style.background = 'rgba(244, 67, 54, 0.2)';
            button.style.color = '#ef4444';  /* 量子红 */
            button.style.borderColor = 'rgba(244, 67, 54, 0.4)';
        }

        // 2秒后恢复原状态
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = originalBackground;
            button.style.color = originalColor;
            button.style.borderColor = 'rgba(255,255,255,0.15)';
        }, 2000);
    };

    // 复制页面上下文编辑器内容
    proto.copyContextEditor = function() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;

        const content = textarea.value || '';
        if (!content.trim()) return;

        // 复制到剪贴板
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            document.execCommand('copy');
            // 显示复制成功反馈
            const copyBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-copy-btn') : null;
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '已复制';
                copyBtn.style.background = 'rgba(76, 175, 80, 0.3)';
                copyBtn.style.color = '#22c55e';  /* 现代绿 */
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = 'rgba(255,255,255,0.04)';
                    copyBtn.style.color = '#e5e7eb';
                }, 1500);
            }
        } catch (err) {
            console.error('复制失败:', err);
        }

        document.body.removeChild(textArea);
    };

    proto.downloadContextMarkdown = function() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;
        const content = textarea.value || '';
        const title = (document.title || 'page').replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '');
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        const filename = `${title}_${stamp}.md`;
        try {
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                if (a.parentNode) a.parentNode.removeChild(a);
            }, 0);
        } catch (e) {
            // 忽略下载错误
        }
    };

    proto.loadContextIntoEditor = function() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;
        try {
            // 优先使用会话保存的页面内容
            let md = '';
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                // 如果会话的pageContent字段为空，则弹框内容也为空
                md = (session.pageContent && session.pageContent.trim() !== '') ? session.pageContent : '';
            } else {
                md = this.getPageContentAsMarkdown();
            }
            textarea.value = md || '';
        } catch (e) {
            textarea.value = '获取页面上下文失败。';
        }
    };

    proto.updateContextPreview = function() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        const preview = this.chatWindow ? this.chatWindow.querySelector('#pet-context-preview') : null;
        if (!textarea || !preview) return;
        const markdown = textarea.value || '';
        // 使用已存在的 Markdown 渲染
        preview.innerHTML = this.renderMarkdown(markdown);
        // 渲染 mermaid（若有）- 防抖，避免频繁触发
        if (preview._mermaidTimer) {
            clearTimeout(preview._mermaidTimer);
            preview._mermaidTimer = null;
        }
        preview._mermaidTimer = setTimeout(async () => {
            await this.processMermaidBlocks(preview);
            preview._mermaidTimer = null;
        }, 200);
    };

    // ========== 消息编辑器（类似上下文编辑器） ==========

    // 确保消息编辑器 UI 存在
    proto.ensureMessageEditorUi = function() {
        if (!this.chatWindow) return;
        if (document.getElementById('pet-message-editor')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pet-message-editor';
        const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
        const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
        overlay.style.cssText = `
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            top: ${headerH}px !important;
            background: transparent !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 10002 !important;
            pointer-events: none !important;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            width: calc(100% - 24px) !important;
            height: calc(100% - 12px) !important;
            margin: 0 12px 12px 12px !important;
            background: #1f1f1f !important;
            color: #fff !important;
            border-radius: 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            min-height: 0 !important;
            pointer-events: auto !important;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 10px 14px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            background: rgba(255,255,255,0.04) !important;
        `;
        const title = document.createElement('div');
        title.textContent = '编辑消息';
        title.style.cssText = 'font-weight: 600;';
        const headerBtns = document.createElement('div');
        headerBtns.style.cssText = 'display:flex; gap:8px; align-items:center;';

        // 模式切换：并排 / 仅编辑 / 仅预览
        const modeGroup = document.createElement('div');
        modeGroup.style.cssText = `
            display: inline-flex !important;
            gap: 6px !important;
            background: rgba(255,255,255,0.04) !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            border-radius: 8px !important;
            padding: 4px !important;
        `;
        const makeModeBtn = (id, label, mode) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.textContent = label;
            btn.style.cssText = `
                padding: 4px 8px !important;
                font-size: 12px !important;
                border-radius: 6px !important;
                border: none !important;
                background: transparent !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
            `;
            btn.addEventListener('click', () => this.setMessageEditorMode(mode));
            return btn;
        };
        const btnSplit = makeModeBtn('pet-message-mode-split', '并排', 'split');
        const btnEdit = makeModeBtn('pet-message-mode-edit', '仅编辑', 'edit');
        const btnPreview = makeModeBtn('pet-message-mode-preview', '仅预览', 'preview');
        modeGroup.appendChild(btnSplit);
        modeGroup.appendChild(btnEdit);
        modeGroup.appendChild(btnPreview);

        // 保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.id = 'pet-message-save-btn';
        saveBtn.className = 'chat-toolbar-btn';
        saveBtn.setAttribute('title', '保存修改 (Ctrl+S / Cmd+S)');
        saveBtn.setAttribute('aria-label', '保存修改');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 4px 12px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(76, 175, 80, 0.3) !important;
            color: #22c55e !important;  /* 现代绿 */
            cursor: pointer !important;
        `;
        saveBtn.addEventListener('click', async () => {
            if (saveBtn.hasAttribute('data-saving')) return;

            saveBtn.setAttribute('data-saving', 'true');
            const originalText = saveBtn.textContent; // 保存原始文本（应该是"保存"）
            saveBtn.textContent = '保存中...';
            saveBtn.style.opacity = '0.6';
            saveBtn.style.cursor = 'not-allowed';

            try {
                const success = await this.saveMessageEditor();
                // 传递原始文本，确保恢复正确
                this._showSaveStatus(saveBtn, success, originalText);
            } catch (error) {
                console.error('保存失败:', error);
                // 传递原始文本，确保恢复正确
                this._showSaveStatus(saveBtn, false, originalText);
            } finally {
                // 在状态提示显示2秒后，移除禁用状态
                setTimeout(() => {
                    saveBtn.removeAttribute('data-saving');
                    saveBtn.style.opacity = '1';
                    saveBtn.style.cursor = 'pointer';
                }, 2000);
            }
        });

        // 复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.id = 'pet-message-copy-btn';
        copyBtn.className = 'chat-toolbar-btn';
        copyBtn.setAttribute('title', '复制内容');
        copyBtn.textContent = '复制';
        copyBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
        `;
        copyBtn.addEventListener('mouseenter', () => {
            copyBtn.style.background = 'rgba(255,255,255,0.12)';
            copyBtn.style.borderColor = 'rgba(255,255,255,0.25)';
        });
        copyBtn.addEventListener('mouseleave', () => {
            copyBtn.style.background = 'rgba(255,255,255,0.04)';
            copyBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        copyBtn.addEventListener('click', () => this.copyMessageEditor());

        // 下载按钮（导出 Markdown）
        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'pet-message-download-btn';
        downloadBtn.className = 'chat-toolbar-btn';
        downloadBtn.setAttribute('title', '下载为 Markdown (.md)');
        downloadBtn.textContent = '下载';
        downloadBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
        `;
        downloadBtn.addEventListener('click', () => this.downloadMessageMarkdown());

        // 取消/关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.id = 'pet-message-close-btn';
        closeBtn.className = 'chat-toolbar-btn';
        closeBtn.setAttribute('aria-label', '关闭编辑器 (Esc)');
        closeBtn.setAttribute('title', '取消 (Esc)');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            width: 28px !important;
            height: 28px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.12)';
            closeBtn.style.borderColor = 'rgba(255,255,255,0.25)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.04)';
            closeBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        closeBtn.addEventListener('click', () => this.closeMessageEditor());

        headerBtns.appendChild(modeGroup);
        headerBtns.appendChild(copyBtn);
        headerBtns.appendChild(downloadBtn);
        headerBtns.appendChild(saveBtn);
        headerBtns.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(headerBtns);

        const body = document.createElement('div');
        body.style.cssText = `
            flex: 1 !important;
            display: flex !important;
            padding: 10px !important;
            gap: 10px !important;
            min-height: 0 !important;
        `;
        const textarea = document.createElement('textarea');
        textarea.id = 'pet-message-editor-textarea';
        textarea.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #121212 !important;
            color: #fff !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace !important;
            font-size: 12px !important;
            line-height: 1.6 !important;
            outline: none !important;
            resize: none !important;
            white-space: pre-wrap !important;
            min-height: 0 !important;
            overflow: auto !important;
            -webkit-overflow-scrolling: touch !important;
        `;
        const preview = document.createElement('div');
        preview.id = 'pet-message-preview';
        preview.className = 'markdown-content';
        preview.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #0e0e0e !important;
            color: #e5e7eb !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            pointer-events: auto !important;
        `;
        // 防止滚动事件冒泡
        preview.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
        preview.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });

        // 编辑时实时更新预览（防抖）
        textarea.addEventListener('input', () => {
            if (this._messagePreviewTimer) clearTimeout(this._messagePreviewTimer);
            this._messagePreviewTimer = setTimeout(() => {
                this.updateMessagePreview();
            }, 150);
        });

        // 同步滚动
        textarea.addEventListener('scroll', () => {
            const previewEl = this.chatWindow ? this.chatWindow.querySelector('#pet-message-preview') : null;
            if (!previewEl) return;
            const tMax = textarea.scrollHeight - textarea.clientHeight;
            const pMax = previewEl.scrollHeight - previewEl.clientHeight;
            if (tMax > 0 && pMax >= 0) {
                const ratio = textarea.scrollTop / tMax;
                previewEl.scrollTop = ratio * pMax;
            }
        }, { passive: true });

        // Ctrl+Enter 保存，Esc 关闭
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.saveMessageEditor();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.closeMessageEditor();
            }
        });

        body.appendChild(textarea);
        body.appendChild(preview);

        panel.appendChild(header);
        panel.appendChild(body);
        overlay.appendChild(panel);

        // 确保聊天窗口容器为定位上下文
        const currentPosition = window.getComputedStyle(this.chatWindow).position;
        if (currentPosition === 'static') {
            this.chatWindow.style.position = 'relative';
        }
        this.chatWindow.appendChild(overlay);
    };

    proto.openMessageEditor = function(messageElement, sender) {
        this.ensureMessageEditorUi();
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        if (!overlay) return;

        // 保存当前编辑的消息元素和发送者
        this._editingMessageElement = messageElement;
        this._editingMessageSender = sender;

        // 获取原始内容
        let originalText = messageElement.getAttribute('data-original-text') || '';
        if (!originalText) {
            originalText = messageElement.innerText || messageElement.textContent || '';
        }

        const textarea = overlay.querySelector('#pet-message-editor-textarea');
        if (textarea) {
            textarea.value = originalText;
        }

        overlay.style.display = 'flex';
        this.updateContextEditorPosition(); // 复用位置更新函数
        this.updateMessagePreview();

        // 隐藏折叠按钮（避免在弹框中显示两个折叠按钮）
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
        if (inputToggleBtn) inputToggleBtn.style.display = 'none';

        // 默认并排模式
        this._messageEditorMode = this._messageEditorMode || 'split';
        this.applyMessageEditorMode();

        // 键盘快捷键：Esc 关闭，Ctrl+S / Cmd+S 保存
        this._messageKeydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeMessageEditor();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const saveBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-message-save-btn') : null;
                if (saveBtn && !saveBtn.hasAttribute('data-saving')) {
                    saveBtn.click();
                }
            }
        };
        document.addEventListener('keydown', this._messageKeydownHandler, { capture: true });

        // 监听窗口尺寸变化
        this._messageResizeHandler = () => this.updateContextEditorPosition();
        window.addEventListener('resize', this._messageResizeHandler, { passive: true });

        // 聚焦到文本区域
        setTimeout(() => {
            if (textarea) {
                textarea.focus();
            }
        }, 100);
    };

    proto.closeMessageEditor = function() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        if (overlay) overlay.style.display = 'none';

        // 显示折叠按钮
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
        if (inputToggleBtn) inputToggleBtn.style.display = 'flex';

        this._editingMessageElement = null;
        this._editingMessageSender = null;

        if (this._messageKeydownHandler) {
            document.removeEventListener('keydown', this._messageKeydownHandler, { capture: true });
            this._messageKeydownHandler = null;
        }
        if (this._messageResizeHandler) {
            window.removeEventListener('resize', this._messageResizeHandler);
            this._messageResizeHandler = null;
        }
        if (this._messagePreviewTimer) {
            clearTimeout(this._messagePreviewTimer);
            this._messagePreviewTimer = null;
        }
    };

    proto.setMessageEditorMode = function(mode) {
        this._messageEditorMode = mode; // 'split' | 'edit' | 'preview'
        this.applyMessageEditorMode();
    };

    proto.applyMessageEditorMode = function() {
        if (!this.chatWindow) return;
        const textarea = this.chatWindow.querySelector('#pet-message-editor-textarea');
        const preview = this.chatWindow.querySelector('#pet-message-preview');
        const btnSplit = this.chatWindow.querySelector('#pet-message-mode-split');
        const btnEdit = this.chatWindow.querySelector('#pet-message-mode-edit');
        const btnPreview = this.chatWindow.querySelector('#pet-message-mode-preview');
        if (!textarea || !preview) return;

        const mode = this._messageEditorMode;
        const isPreviewOnly = mode === 'preview';
        const isEditOnly = mode === 'edit';
        textarea.style.display = isPreviewOnly ? 'none' : 'block';
        preview.style.display = isEditOnly ? 'none' : 'block';
        textarea.style.width = isEditOnly ? '100%' : (isPreviewOnly ? '0%' : '50%');
        preview.style.width = isPreviewOnly ? '100%' : (isEditOnly ? '0%' : '50%');

        // 激活态样式
        const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
        const resetBtn = (b) => { if (!b) return; b.style.background = 'transparent'; b.style.color = '#e5e7eb'; b.style.border = 'none'; };
        const activateBtn = (b) => { if (!b) return; b.style.background = currentMainColor; b.style.color = '#fff'; b.style.border = 'none'; };
        resetBtn(btnSplit); resetBtn(btnEdit); resetBtn(btnPreview);
        if (mode === 'split') activateBtn(btnSplit);
        if (mode === 'edit') activateBtn(btnEdit);
        if (mode === 'preview') activateBtn(btnPreview);
    };

    proto.updateMessagePreview = function() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor-textarea') : null;
        const preview = this.chatWindow ? this.chatWindow.querySelector('#pet-message-preview') : null;
        if (!textarea || !preview) return;

        const markdown = textarea.value || '';
        preview.innerHTML = this.renderMarkdown(markdown);

        // 渲染 mermaid（若有）- 防抖
        if (preview._mermaidTimer) {
            clearTimeout(preview._mermaidTimer);
            preview._mermaidTimer = null;
        }
        preview._mermaidTimer = setTimeout(async () => {
            await this.processMermaidBlocks(preview);
            preview._mermaidTimer = null;
        }, 200);
    };

    proto.saveMessageEditor = async function() {
        if (!this._editingMessageElement || !this._editingMessageSender) {
            return false;
        }

        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        const textarea = overlay ? overlay.querySelector('#pet-message-editor-textarea') : null;
        if (!textarea) {
            return false;
        }

        const newText = textarea.value.trim();
        if (!newText) {
            // 如果内容为空，关闭编辑器
            this.closeMessageEditor();
            return false;
        }

        try {
            const messageElement = this._editingMessageElement;
            const sender = this._editingMessageSender;

            if (sender === 'pet') {
                // 对于宠物消息，使用Markdown渲染
                const oldText = messageElement.getAttribute('data-original-text') || messageElement.textContent || '';
                messageElement.innerHTML = this.renderMarkdown(newText);
                messageElement.classList.add('markdown-content');
                messageElement.setAttribute('data-original-text', newText);

                // 更新会话中对应的消息内容
                if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                    const session = this.sessions[this.currentSessionId];
                    if (session.messages && Array.isArray(session.messages)) {
                        // 找到对应的消息并更新
                        const messageIndex = session.messages.findIndex(msg =>
                            msg.type === 'pet' &&
                            (msg.content === oldText || msg.content.trim() === oldText.trim())
                        );

                        if (messageIndex !== -1) {
                            session.messages[messageIndex].content = newText;
                            session.updatedAt = Date.now();
                            // 异步保存会话
                            await this.saveAllSessions();
                            console.log(`已更新会话 ${this.currentSessionId} 中的消息内容`);
                        }
                    }
                }

                // 处理可能的 Mermaid 图表
                setTimeout(async () => {
                    try {
                        await this.loadMermaid();
                        const hasMermaidCode = messageElement.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                        if (hasMermaidCode) {
                            await this.processMermaidBlocks(messageElement);
                        }
                    } catch (error) {
                        console.error('处理编辑后的 Mermaid 图表时出错:', error);
                    }
                }, 200);
            } else {
                // 对于用户消息，使用 Markdown 渲染（与 pet 消息一致）
                const oldText = messageElement.getAttribute('data-original-text') || messageElement.textContent || '';
                messageElement.innerHTML = this.renderMarkdown(newText);
                messageElement.classList.add('markdown-content');
                messageElement.setAttribute('data-original-text', newText);

                // 处理可能的 Mermaid 图表
                setTimeout(async () => {
                    try {
                        await this.loadMermaid();
                        const hasMermaidCode = messageElement.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                        if (hasMermaidCode) {
                            await this.processMermaidBlocks(messageElement);
                        }
                    } catch (error) {
                        console.error('处理编辑后的 Mermaid 图表时出错:', error);
                    }
                }, 200);

                // 更新会话中对应的消息内容
                if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                    const session = this.sessions[this.currentSessionId];
                    if (session.messages && Array.isArray(session.messages)) {
                        // 找到对应的消息并更新
                        const messageIndex = session.messages.findIndex(msg =>
                            msg.type === 'user' &&
                            (msg.content === oldText || msg.content.trim() === oldText.trim())
                        );

                        if (messageIndex !== -1) {
                            session.messages[messageIndex].content = newText;
                            session.updatedAt = Date.now();
                            // 异步保存会话
                            await this.saveAllSessions();
                            console.log(`已更新会话 ${this.currentSessionId} 中的用户消息内容`);
                        }
                    }
                }
            }

            messageElement.setAttribute('data-edited', 'true');

            // 保存后不关闭编辑器，允许继续编辑
            // 更新预览
            this.updateMessagePreview();

            return true;
        } catch (error) {
            console.error('保存消息失败:', error);
            return false;
        }
    };

    // 复制消息编辑器内容
    proto.copyMessageEditor = function() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        const textarea = overlay ? overlay.querySelector('#pet-message-editor-textarea') : null;
        if (!textarea) return;

        const content = textarea.value || '';
        if (!content.trim()) return;

        // 复制到剪贴板
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            document.execCommand('copy');
            // 显示复制成功反馈
            const copyBtn = overlay ? overlay.querySelector('#pet-message-copy-btn') : null;
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '已复制';
                copyBtn.style.background = 'rgba(76, 175, 80, 0.3)';
                copyBtn.style.color = '#22c55e';  /* 现代绿 */
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = 'rgba(255,255,255,0.04)';
                    copyBtn.style.color = '#e5e7eb';
                }, 1500);
            }
        } catch (err) {
            console.error('复制失败:', err);
        }

        document.body.removeChild(textArea);
    };

    // 下载消息编辑器内容为 Markdown
    proto.downloadMessageMarkdown = function() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        const textarea = overlay ? overlay.querySelector('#pet-message-editor-textarea') : null;
        if (!textarea) return;

        const content = textarea.value || '';
        if (!content.trim()) return;

        // 生成文件名（使用时间戳）
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const filename = `message_${stamp}.md`;

        try {
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                if (a.parentNode) a.parentNode.removeChild(a);
            }, 0);
        } catch (e) {
            console.error('下载失败:', e);
        }
    };

})(typeof window !== 'undefined' ? window : this);
