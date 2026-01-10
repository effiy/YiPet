/**
 * ChatWindow Component
 * Handles the creation and management of the chat window UI.
 */
(function() {
    'use strict';

    // Ensure namespace exists
    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    class ChatWindow {
        constructor(manager) {
            this.manager = manager;
            this.element = null;
            this.header = null;
            this.sidebar = null;
            this.mainContent = null;
            this.messagesContainer = null;
            this.inputContainer = null;
            this.sessionListContainer = null;
            this.robotSettingsButton = null;
            this.requestStatusButton = null;
            this.settingsButton = null;
            this.resizeHandles = {};
            this.isResizing = false;
            this.isDragging = false;
            
            // UI State
            this.sidebarWidth = manager.sidebarWidth || 250;
            this.inputHeight = manager.inputHeight || 150;
            this._currentAbortController = null;
            this._searchTimer = null;
            this.isResizingSidebar = false;
            this._suppressDragUntil = 0;
            this._fullscreenAnimating = false;
        }

        getMainColorFromGradient(gradient) {
            if (!gradient) return '#3b82f6';
            const match = gradient.match(/#[0-9a-fA-F]{6}/);
            return match ? match[0] : '#3b82f6';
        }

        create() {
            const manager = this.manager;
            
            // Create chat window container
            this.element = document.createElement('div');
            this.element.id = 'pet-chat-window';
            this.updateChatWindowStyle();
            
            // Get current color
            const currentColor = manager.colors[manager.colorIndex];
            
            // Initial Theme Setup
            this.updateTheme();

            // Create Header
            this.header = this.createHeader(currentColor);
            this.element.appendChild(this.header);

            // Create Main Content Container
            this.mainContent = document.createElement('div');
            this.mainContent.className = 'pet-chat-main-content';
            
            // Create Sidebar
            // Load states first
            if (typeof manager.loadSidebarWidth === 'function') manager.loadSidebarWidth();
            if (typeof manager.loadCalendarCollapsed === 'function') manager.loadCalendarCollapsed();

            this.sidebar = this.createSidebar();
            this.mainContent.appendChild(this.sidebar);

            // Create Messages Area (Right side)
            const rightPanel = document.createElement('div');
            rightPanel.className = 'pet-chat-right-panel';

            // Messages Container
            this.messagesContainer = document.createElement('div');
            this.messagesContainer.id = 'pet-chat-messages';
            rightPanel.appendChild(this.messagesContainer);

            // Create Input Container
            this.inputContainer = this.createInputContainer(currentColor);
            rightPanel.appendChild(this.inputContainer);

            this.mainContent.appendChild(rightPanel);
            this.element.appendChild(this.mainContent);

            // Create Resize Handles
            this.createResizeHandles();

            // Bind Events
            this.bindEvents();

            return this.element;
        }

        createHeader(currentColor) {
            const manager = this.manager;
            const chatHeader = document.createElement('div');
            chatHeader.className = 'pet-chat-header';
            chatHeader.title = '拖拽移动窗口 | 双击全屏';

            // Title
            const headerTitle = document.createElement('div');
            headerTitle.className = 'pet-chat-header-title';
            headerTitle.id = 'pet-chat-header-title';
            headerTitle.innerHTML = `
                <span style="font-size: 20px;">💕</span>
                <span id="pet-chat-header-title-text" style="font-weight: 600; font-size: 16px;">与我聊天</span>
            `;

            // Buttons Container
            const headerButtons = document.createElement('div');
            headerButtons.className = 'pet-chat-header-buttons';

            // Auth Button
            const authBtn = this.createHeaderButton(
                'pet-chat-auth-btn',
                'API 鉴权',
                '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 4a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1Z"/>',
                () => manager.openAuth()
            );

            // Refresh Button
            const refreshBtn = this.createHeaderButton(
                'pet-chat-refresh-btn',
                '刷新',
                '<path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 1 0 19 12c0-1.93-.78-3.68-2.05-4.95Z"/>',
                () => manager.manualRefresh()
            );

            // Close Button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'pet-chat-close-btn';
            closeBtn.innerHTML = '✕';
            closeBtn.setAttribute('aria-label', '关闭');
            closeBtn.setAttribute('title', '关闭');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof manager.closeChatWindow === 'function') {
                    manager.closeChatWindow();
                } else {
                    console.error('manager.closeChatWindow is not a function');
                    // Fallback to hiding the element directly
                    if (this.element) this.element.style.display = 'none';
                }
            });
            
            headerButtons.appendChild(authBtn);
            headerButtons.appendChild(refreshBtn);
            headerButtons.appendChild(closeBtn);

            chatHeader.appendChild(headerTitle);
            chatHeader.appendChild(headerButtons);

            return chatHeader;
        }

        createHeaderButton(id, label, path, onClick) {
            const btn = document.createElement('button');
            btn.id = id;
            btn.className = 'pet-chat-header-btn';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
            btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                onClick();
            });
            return btn;
        }

        createSidebar() {
            const manager = this.manager;
            const sidebar = document.createElement('div');
            sidebar.className = 'session-sidebar';
            sidebar.style.setProperty('--session-sidebar-width', `${manager.sidebarWidth}px`);
            
            // Expose sidebar to manager for legacy compatibility
            manager.sessionSidebar = sidebar;

            // Sidebar Header
            const sidebarHeader = document.createElement('div');
            sidebarHeader.className = 'session-sidebar-header';

            // Calendar Component (if available)
            if (typeof manager.createCalendarComponent === 'function') {
                const calendarContainer = manager.createCalendarComponent();
                sidebarHeader.appendChild(calendarContainer);
            }

            // First Row: Search
            const firstRow = document.createElement('div');
            firstRow.className = 'session-sidebar-search-row';

            const searchContainer = document.createElement('div');
            searchContainer.className = 'session-search-container';

            const searchIcon = document.createElement('span');
            searchIcon.textContent = '🔍';
            searchIcon.className = 'session-search-icon';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = '搜索会话...';
            searchInput.value = manager.sessionTitleFilter || '';
            searchInput.id = 'session-search-input';
            searchInput.className = 'session-search-input';

            // Clear Button
            const clearBtn = document.createElement('button');
            clearBtn.innerHTML = '✕';
            clearBtn.type = 'button';
            clearBtn.className = 'session-search-clear-btn';
            
            const updateClearButton = () => {
                const visible = !!searchInput.value;
                clearBtn.classList.toggle('visible', visible);
            };
            
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                searchInput.value = '';
                manager.sessionTitleFilter = '';
                updateClearButton();
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            });

            searchInput.addEventListener('input', (e) => {
                manager.sessionTitleFilter = e.target.value.trim();
                updateClearButton();
                if (this._searchTimer) clearTimeout(this._searchTimer);
                this._searchTimer = setTimeout(() => {
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                }, 300);
            });
            
            searchInput.addEventListener('click', (e) => e.stopPropagation());
            updateClearButton();

            searchContainer.appendChild(searchIcon);
            searchContainer.appendChild(searchInput);
            searchContainer.appendChild(clearBtn);
            firstRow.appendChild(searchContainer);

            // Second Row: Buttons
            const secondRow = document.createElement('div');
            secondRow.className = 'session-sidebar-actions-row';

            // Left Group: Batch, Export, Import
            const leftButtonGroup = document.createElement('div');
            leftButtonGroup.className = 'session-actions-left-group';

            const createSessionActionButton = (text, className, onClick) => {
                const btn = document.createElement('span');
                btn.innerHTML = text;
                btn.className = `session-action-btn ${className}`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (onClick) onClick(e);
                });
                return btn;
            };

            const batchModeBtn = createSessionActionButton('☑️ 批量', 'session-action-btn--batch', () => {
                if (typeof manager.enterBatchMode === 'function') manager.enterBatchMode();
            });

            const exportBtn = createSessionActionButton('⬇️ 导出', 'session-action-btn--export', () => {
                if (typeof manager.exportSessionsToZip === 'function') manager.exportSessionsToZip();
            });

            const importBtn = createSessionActionButton('⬆️ 导入', 'session-action-btn--import', () => {
                 const fileInput = document.createElement('input');
                 fileInput.type = 'file';
                 fileInput.accept = '.zip';
                 fileInput.style.display = 'none';
                 fileInput.addEventListener('change', async (e) => {
                     const file = e.target.files[0];
                     if (file && typeof manager.importSessionsFromZip === 'function') {
                         await manager.importSessionsFromZip(file);
                     }
                 });
                 document.body.appendChild(fileInput);
                 fileInput.click();
                 document.body.removeChild(fileInput);
            });

            leftButtonGroup.appendChild(batchModeBtn);
            leftButtonGroup.appendChild(exportBtn);
            leftButtonGroup.appendChild(importBtn);

            // Right Group: Add New
            const addSessionBtn = document.createElement('button');
            addSessionBtn.innerHTML = '➕ 新建';
            addSessionBtn.className = 'session-action-btn session-action-btn--add';
            addSessionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof manager.createBlankSession === 'function') manager.createBlankSession();
            });

            secondRow.appendChild(leftButtonGroup);
            secondRow.appendChild(addSessionBtn);

            sidebarHeader.appendChild(firstRow);
            sidebarHeader.appendChild(secondRow);
            sidebar.appendChild(sidebarHeader);

            // Batch Toolbar
            const batchToolbar = this.buildBatchToolbar();
            sidebar.appendChild(batchToolbar);

            // Scrollable Content Container
            const scrollableContent = document.createElement('div');
            scrollableContent.className = 'session-sidebar-scrollable-content';
            
            // Tag Filter Container
            const tagFilterContainer = this.createTagFilter();
            scrollableContent.appendChild(tagFilterContainer);

            // Session List Container
            const sessionList = document.createElement('div');
            this.sessionListContainer = sessionList;
            sessionList.className = 'session-list';
            sessionList.id = 'session-list';
            
            scrollableContent.appendChild(sessionList);
            sidebar.appendChild(scrollableContent);

            // Resizer
            this.createSidebarResizer(sidebar);

            // Initial load
            setTimeout(() => {
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            }, 0);

            return sidebar;
        }

        createTagFilter() {
            const manager = this.manager;
            
            // Tag Filter Container
            const tagFilterContainer = document.createElement('div');
            tagFilterContainer.className = 'tag-filter-container';

            // Filter Header
            const filterHeader = document.createElement('div');
            filterHeader.className = 'tag-filter-header';

            // Filter Actions
            const filterActions = document.createElement('div');
            filterActions.className = 'tag-filter-actions';

            // Reverse Filter Button
            const reverseFilterBtn = document.createElement('button');
            reverseFilterBtn.className = 'tag-filter-action-btn tag-filter-reverse';
            if (manager.tagFilterReverse) reverseFilterBtn.classList.add('active');
            reverseFilterBtn.title = '反向过滤';
            reverseFilterBtn.innerHTML = '⇄';
            
            reverseFilterBtn.addEventListener('click', () => {
                manager.tagFilterReverse = !manager.tagFilterReverse;
                reverseFilterBtn.classList.toggle('active', manager.tagFilterReverse);
                if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            });

            // No Tags Filter Button
            const noTagsFilterBtn = document.createElement('button');
            noTagsFilterBtn.className = 'tag-filter-action-btn tag-filter-no-tags';
            if (manager.tagFilterNoTags) noTagsFilterBtn.classList.add('active');
            noTagsFilterBtn.title = '筛选无标签';
            noTagsFilterBtn.innerHTML = '∅';
            
            noTagsFilterBtn.addEventListener('click', () => {
                manager.tagFilterNoTags = !manager.tagFilterNoTags;
                noTagsFilterBtn.classList.toggle('active', manager.tagFilterNoTags);
                if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            });

            // Clear Filter Button
            const clearFilterBtn = document.createElement('button');
            clearFilterBtn.className = 'tag-filter-clear-btn';
            clearFilterBtn.textContent = '×';
            clearFilterBtn.title = '清除筛选';
            
            const updateClearFilterBtnStyle = () => {
                const hasSelectedTags = manager.selectedFilterTags && manager.selectedFilterTags.length > 0;
                const hasSearchKeyword = manager.tagFilterSearchKeyword && manager.tagFilterSearchKeyword.trim() !== '';
                const hasActiveFilter = hasSelectedTags || manager.tagFilterNoTags || hasSearchKeyword;
                
                clearFilterBtn.classList.toggle('active', hasActiveFilter);
            };
            
            // Initial check
            updateClearFilterBtnStyle();
            
            clearFilterBtn.addEventListener('click', () => {
                const hasSelectedTags = manager.selectedFilterTags && manager.selectedFilterTags.length > 0;
                const hasSearchKeyword = manager.tagFilterSearchKeyword && manager.tagFilterSearchKeyword.trim() !== '';
                const hasActiveFilter = hasSelectedTags || manager.tagFilterNoTags || hasSearchKeyword;
                
                if (hasActiveFilter) {
                    manager.selectedFilterTags = [];
                    manager.tagFilterNoTags = false;
                    manager.tagFilterSearchKeyword = '';
                    
                    // Reset search input
                    const tagSearchInput = tagFilterContainer.querySelector('.tag-filter-search');
                    const tagSearchClearBtn = tagFilterContainer.querySelector('.tag-filter-search-clear');
                    if (tagSearchInput) tagSearchInput.value = '';
                    if (tagSearchClearBtn) tagSearchClearBtn.classList.remove('visible');
                    
                    if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                }
            });

            filterActions.appendChild(reverseFilterBtn);
            filterActions.appendChild(noTagsFilterBtn);
            filterActions.appendChild(expandToggleBtn);
            filterActions.appendChild(clearFilterBtn);

            // Search Input
            if (typeof manager.createSearchInput === 'function') {
                const searchComp = manager.createSearchInput({
                    className: 'tag-filter-search',
                    placeholder: '搜索标签...',
                    value: manager.tagFilterSearchKeyword || '',
                    onChange: (v) => {
                        manager.tagFilterSearchKeyword = v;
                        if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                    },
                    onClear: () => {
                        manager.tagFilterSearchKeyword = '';
                        if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                    },
                    debounce: 300
                });
                filterHeader.appendChild(searchComp.container);
            }
            
            filterHeader.appendChild(filterActions);

            // Tag List Container
            const tagFilterList = document.createElement('div');
            tagFilterList.className = 'tag-filter-list';

            tagFilterContainer.appendChild(filterHeader);
            tagFilterContainer.appendChild(tagFilterList);

            return tagFilterContainer;
        }

        buildBatchToolbar() {
            const toolbar = document.createElement('div');
            toolbar.id = 'batch-toolbar';
            toolbar.className = 'batch-toolbar';

            const selectedCount = document.createElement('span');
            selectedCount.id = 'selected-count';
            selectedCount.textContent = '已选择 0 个';
            selectedCount.className = 'batch-selected-count';

            const createBtn = (text, className, onClick) => {
                const btn = document.createElement('button');
                btn.textContent = text;
                btn.className = className;
                btn.addEventListener('click', onClick);
                return btn;
            };

            const selectAllBtn = createBtn('全选', 'batch-toolbar-btn batch-toolbar-btn--default', () => {
                if (typeof this.manager.toggleSelectAll === 'function') this.manager.toggleSelectAll();
            });
            selectAllBtn.id = 'select-all-btn';

            const batchDeleteBtn = createBtn('删除', 'batch-toolbar-btn batch-toolbar-btn--danger', async () => {
                if (typeof this.manager.batchDeleteSessions === 'function') await this.manager.batchDeleteSessions();
            });
            batchDeleteBtn.id = 'batch-delete-btn';

            const cancelBtn = createBtn('取消', 'batch-toolbar-btn batch-toolbar-btn--default', () => {
                if (typeof this.manager.exitBatchMode === 'function') this.manager.exitBatchMode();
            });

            toolbar.appendChild(selectedCount);
            toolbar.appendChild(selectAllBtn);
            toolbar.appendChild(batchDeleteBtn);
            toolbar.appendChild(cancelBtn);

            return toolbar;
        }

        createSidebarResizer(sidebar) {
            const resizer = document.createElement('div');
            resizer.className = 'sidebar-resizer';

            resizer.addEventListener('mouseenter', () => {
                if (!this.isResizingSidebar) {
                    resizer.classList.add('hover');
                }
            });

            resizer.addEventListener('mouseleave', () => {
                if (!this.isResizingSidebar) {
                    resizer.classList.remove('hover');
                }
            });

            resizer.addEventListener('mousedown', (e) => this.initSidebarResize(e, sidebar, resizer));

            sidebar.appendChild(resizer);
        }

        initSidebarResize(e, sidebar, resizer) {
            e.preventDefault();
            e.stopPropagation();
            this.isResizingSidebar = true;
            resizer.classList.add('active');
            
            const startX = e.clientX;
            const startWidth = parseInt(getComputedStyle(sidebar).width, 10);
            const manager = this.manager;

            const onMouseMove = (e) => {
                if (!this.isResizingSidebar) return;
                const deltaX = e.clientX - startX;
                const newWidth = Math.min(Math.max(startWidth + deltaX, 150), 500);
                sidebar.style.setProperty('width', `${newWidth}px`, 'important');
                manager.sidebarWidth = newWidth;
            };

            const onMouseUp = () => {
                this.isResizingSidebar = false;
                resizer.classList.remove('active');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // Save width preference
                if (chrome && chrome.storage) {
                    chrome.storage.local.set({ sidebarWidth: manager.sidebarWidth });
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        createContextSwitch() {
            const manager = this.manager;
            
            // Context Switch Container
            const contextSwitchContainer = document.createElement('div');
            contextSwitchContainer.className = 'context-switch-container';
            contextSwitchContainer.title = '开启/关闭页面上下文，帮助AI理解当前页面内容';

            // Label
            const contextSwitchLabel = document.createElement('span');
            contextSwitchLabel.className = 'context-switch-label';
            contextSwitchLabel.textContent = '页面上下文';

            // Switch Wrapper
            const switchWrapper = document.createElement('div');
            switchWrapper.className = 'context-switch-wrapper';

            // Switch Thumb
            const switchThumb = document.createElement('div');
            switchThumb.className = 'context-switch-thumb';

            // Hidden Checkbox
            const contextSwitch = document.createElement('input');
            contextSwitch.type = 'checkbox';
            contextSwitch.id = 'context-switch';
            contextSwitch.className = 'context-switch-input';
            contextSwitch.checked = true; // Default

            // Update State Function
            const updateSwitchState = (isChecked) => {
                if (isChecked) {
                    contextSwitchContainer.classList.add('active');
                } else {
                    contextSwitchContainer.classList.remove('active');
                }
            };

            // Initial State
            updateSwitchState(contextSwitch.checked);

            // Assembly
            switchWrapper.appendChild(switchThumb);
            contextSwitchContainer.appendChild(contextSwitchLabel);
            contextSwitchContainer.appendChild(switchWrapper);
            contextSwitchContainer.appendChild(contextSwitch);

            // Toggle logic
            const toggleSwitch = (e) => {
                e.stopPropagation();
                contextSwitch.checked = !contextSwitch.checked;
                updateSwitchState(contextSwitch.checked);
                contextSwitch.dispatchEvent(new Event('change'));
            };

            contextSwitchContainer.addEventListener('click', toggleSwitch);

            // Load from storage
            if (chrome && chrome.storage) {
                chrome.storage.local.get(['contextSwitchEnabled'], (result) => {
                    if (result.contextSwitchEnabled !== undefined) {
                        contextSwitch.checked = result.contextSwitchEnabled;
                        updateSwitchState(contextSwitch.checked);
                    }
                });
            }

            // Save to storage
            contextSwitch.addEventListener('change', () => {
                updateSwitchState(contextSwitch.checked);
                if (chrome && chrome.storage) {
                    chrome.storage.local.set({ contextSwitchEnabled: contextSwitch.checked });
                }
            });
            
            // Store reference and update function
            this.contextSwitchContainer = contextSwitchContainer;
            this.contextSwitchContainer.updateColor = () => {
                // No-op as CSS variables handle this now
            };

            return contextSwitchContainer;
        }

        createInputContainer(currentColor) {
            const manager = this.manager;
            
            const inputContainer = document.createElement('div');
            inputContainer.className = 'chat-input-container';

            // Top Toolbar
            const topToolbar = document.createElement('div');
            topToolbar.className = 'chat-input-toolbar';

            // Left Button Group
            const inputLeftButtonGroup = document.createElement('div');
            inputLeftButtonGroup.className = 'chat-input-btn-group';

            // Mention Button
            const mentionButton = manager.createButton({
                text: '@',
                className: 'chat-input-btn chat-input-icon-btn ui-btn ui-btn--icon ui-btn--primary',
                attrs: { title: '提及' }
            });
            inputLeftButtonGroup.appendChild(mentionButton);

            // Context Editor Button
            const contextBtn = manager.createButton({
                text: '📝 页面上下文',
                className: 'chat-input-btn chat-input-text-btn ui-btn ui-btn--md ui-btn--primary',
                attrs: { title: '编辑页面上下文' },
                onClick: () => {
                    if (typeof manager.openContextEditor === 'function') manager.openContextEditor();
                }
            });
            inputLeftButtonGroup.appendChild(contextBtn);

            // FAQ Button
            const faqBtn = manager.createButton({
                text: '💡 常见问题',
                className: 'chat-input-btn chat-input-text-btn ui-btn ui-btn--md ui-btn--primary',
                attrs: { title: '常见问题' },
                onClick: () => {
                    if (typeof manager.openFaqManager === 'function') manager.openFaqManager();
                }
            });
            inputLeftButtonGroup.appendChild(faqBtn);

            // Settings Button
            this.robotSettingsButton = document.createElement('button');
            this.robotSettingsButton.className = 'chat-input-btn chat-input-icon-btn chat-input-settings-btn';
            this.robotSettingsButton.innerHTML = '⚙️';
            this.robotSettingsButton.title = 'AI 设置';
            
            this.robotSettingsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                manager.showSettingsModal();
            });
            inputLeftButtonGroup.appendChild(this.robotSettingsButton);

            topToolbar.appendChild(inputLeftButtonGroup);

            // Right Button Group
            const inputRightButtonGroup = document.createElement('div');
            inputRightButtonGroup.className = 'chat-input-btn-group';

            // Context Switch
            const contextSwitch = this.createContextSwitch();
            inputRightButtonGroup.appendChild(contextSwitch);

            // Request Status Button
            this.requestStatusButton = document.createElement('button');
            this.requestStatusButton.id = 'request-status-btn';
            this.requestStatusButton.className = 'chat-input-status-btn';
            this.requestStatusButton.innerHTML = '⏹️';
            this.requestStatusButton.title = '请求状态：空闲';
            this.requestStatusButton.disabled = true;
            
            this.requestStatusButton.addEventListener('click', () => this.abortRequest());
            inputRightButtonGroup.appendChild(this.requestStatusButton);
            
            // Clear Context Button
            const clearContextBtn = document.createElement('button');
            clearContextBtn.innerHTML = '🧹 清除上下文';
            clearContextBtn.className = 'chat-input-clear-btn';
            
            clearContextBtn.addEventListener('click', () => {
                if (typeof manager.clearContext === 'function') manager.clearContext();
            });
            inputRightButtonGroup.appendChild(clearContextBtn);

            topToolbar.appendChild(inputRightButtonGroup);

            // Input Wrapper
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'chat-input-wrapper';

            const textarea = document.createElement('textarea');
            this.messageInput = textarea; // Store reference
            textarea.id = 'pet-chat-input';
            textarea.className = 'chat-message-input';
            textarea.placeholder = '输入消息... (Enter 发送, Shift+Enter 换行)';
            textarea.rows = 2;
            
            
            // Input State Management
            const updateInputState = () => {
                const hasContent = textarea.value.trim().length > 0;
                if (hasContent) {
                    textarea.classList.add('chat-message-input--has-content');
                } else {
                    textarea.classList.remove('chat-message-input--has-content');
                }
            };

            // Auto-resize
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                const newHeight = Math.max(60, textarea.scrollHeight);
                textarea.style.height = newHeight + 'px';
                updateInputState();
                
                // Scroll messages to bottom if needed
                if (this.messagesContainer) {
                    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
                }
            });

            // Focus effects
            textarea.addEventListener('focus', () => {
                // Background and box shadow handled by CSS
            });

            textarea.addEventListener('blur', () => {
                // Background and box shadow handled by CSS
            });

            // Paste Image Support
            textarea.addEventListener('paste', async (e) => {
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.indexOf('image') !== -1) {
                        e.preventDefault();
                        const file = item.getAsFile();
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            if (typeof manager.sendImageMessage === 'function') {
                                manager.sendImageMessage(event.target.result);
                            }
                        };
                        reader.readAsDataURL(file);
                        break;
                    }
                }
            });

            // Composition State (IME)
            let isComposing = false;
            let compositionEndTime = 0;
            const COMPOSITION_END_DELAY = 100;

            textarea.addEventListener('compositionstart', () => { isComposing = true; compositionEndTime = 0; });
            textarea.addEventListener('compositionupdate', () => { isComposing = true; compositionEndTime = 0; });
            textarea.addEventListener('compositionend', () => { isComposing = false; compositionEndTime = Date.now(); });

            // Send Logic
            const triggerSend = () => {
                this.sendMessage();
                updateInputState();
            };

            
            textarea.addEventListener('keydown', (e) => {
                if (e.isComposing || isComposing) return;
                
                if (e.key === 'Enter' && compositionEndTime > 0) {
                    if (Date.now() - compositionEndTime < COMPOSITION_END_DELAY) return;
                }

                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    triggerSend();
                    compositionEndTime = 0;
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    textarea.value = '';
                    textarea.style.height = '60px';
                    updateInputState();
                    textarea.blur();
                }
            });

            inputWrapper.appendChild(textarea);

            inputContainer.appendChild(topToolbar);
            inputContainer.appendChild(inputWrapper);

            return inputContainer;
        }
        async sendMessage() {
            const manager = this.manager;
            const textarea = this.messageInput;
            const message = textarea.value.trim();
            if (!message) return;

            // Ensure session exists
            if (!manager.currentSessionId) {
                if (typeof manager.initSession === 'function') await manager.initSession();
                if (typeof manager.updateChatHeaderTitle === 'function') manager.updateChatHeaderTitle();
            }

            // Add User Message
            if (typeof manager.createMessageElement === 'function') {
                const userMessage = manager.createMessageElement(message, 'user');
                this.messagesContainer.appendChild(userMessage);
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

                // Add to session data
                if (typeof manager.addMessageToSession === 'function') {
                    await manager.addMessageToSession('user', message, null, false);
                }

                // Add action buttons
                if (typeof manager.addActionButtonsToMessage === 'function') {
                    await manager.addActionButtonsToMessage(userMessage);
                }

                // Add delete/edit/resend buttons
                const userBubble = userMessage.querySelector('[data-message-type="user-bubble"]');
                const copyButtonContainer = userMessage.querySelector('[data-copy-button-container]');
                if (copyButtonContainer && userBubble) {
                    if (!copyButtonContainer.querySelector('.delete-button')) {
                        if (typeof manager.addDeleteButtonForUserMessage === 'function') {
                            manager.addDeleteButtonForUserMessage(copyButtonContainer, userBubble);
                        }
                    }
                    if (typeof manager.addSortButtons === 'function') {
                        manager.addSortButtons(copyButtonContainer, userMessage);
                    }
                }
            }

            // Clear Input
            textarea.value = '';
            textarea.style.height = '';
            void textarea.offsetHeight; // Force reflow
            textarea.style.height = '60px';

            // Create Pet Message Placeholder
            let petMessageElement = null;
            let petBubble = null;
            if (typeof manager.createMessageElement === 'function') {
                petMessageElement = manager.createMessageElement('', 'pet');
                // Add thinking indicator or initial state if needed
                petBubble = petMessageElement.querySelector('.pet-message-bubble') || petMessageElement.querySelector('[data-message-type="pet-bubble"]');
                if (petBubble) {
                    petBubble.innerHTML = '<span class="typing-indicator">...</span>'; // Simple typing indicator
                }
                this.messagesContainer.appendChild(petMessageElement);
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }

            // Prepare for streaming
            this._currentAbortController = new AbortController();
            this.updateRequestStatus('loading');
            
            let fullContent = '';

            try {
                // Call generatePetResponseStream
                if (typeof manager.generatePetResponseStream === 'function') {
                    await manager.generatePetResponseStream(
                        message,
                        (content) => {
                            // On content update
                            fullContent = content;
                            if (petBubble) {
                                // Render Markdown if available
                                if (typeof manager.renderMarkdown === 'function') {
                                    petBubble.innerHTML = manager.renderMarkdown(content);
                                } else {
                                    petBubble.textContent = content;
                                }
                                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
                            }
                        },
                        this._currentAbortController
                    );
                } else {
                    // Fallback or error if method missing
                    throw new Error('generatePetResponseStream method not found');
                }

                // Add to session after stream complete
                if (typeof manager.addMessageToSession === 'function') {
                    await manager.addMessageToSession('pet', fullContent, null, false);
                }
                
                // Add action buttons for pet message
                if (petMessageElement && typeof manager.addActionButtonsToMessage === 'function') {
                    await manager.addActionButtonsToMessage(petMessageElement);
                }

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('Request aborted');
                    if (petBubble) petBubble.innerHTML += ' [已取消]';
                } else {
                    console.error('Error generating response:', error);
                    if (petBubble) petBubble.innerHTML += `\n[错误: ${error.message}]`;
                }
            } finally {
                this._currentAbortController = null;
                this.updateRequestStatus('idle');

                // Save Session
                try {
                    if (typeof manager.saveCurrentSession === 'function') {
                        await manager.saveCurrentSession(false, false);
                    }
                    
                    if (manager.currentSessionId && manager.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                        if (typeof manager.syncSessionToBackend === 'function') {
                            await manager.syncSessionToBackend(manager.currentSessionId, true);
                            console.log('会话已保存到后端:', manager.currentSessionId);
                        }
                    }
                } catch (error) {
                    console.error('保存会话失败:', error);
                }
            }
        }

        updateRequestStatus(status) {
            const btn = this.requestStatusButton;
            if (!btn) return;

            // Reset classes
            btn.classList.remove('active', 'stopping');
            btn.disabled = true;

            if (status === 'idle') {
                btn.innerHTML = '⏹️';
                btn.title = '请求状态：空闲';
            } else if (status === 'loading') {
                btn.innerHTML = '⏸️';
                btn.title = '点击终止请求';
                btn.classList.add('active');
                btn.disabled = false;
            } else if (status === 'stopping') {
                btn.innerHTML = '⏹️';
                btn.title = '正在终止请求...';
                btn.classList.add('stopping');
            }
        }

        abortRequest() {
            if (this._currentAbortController) {
                this.updateRequestStatus('stopping');
                this._currentAbortController.abort();
                this._currentAbortController = null;
                
                // Show notification
                if (typeof this.manager.showNotification === 'function') {
                    this.manager.showNotification('请求已取消', 'info');
                }
            }
        }

        createResizeHandles() {
            const positions = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];
            
            positions.forEach(pos => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${pos}`;
                
                handle.addEventListener('mousedown', (e) => this.initResize(e, pos));
                this.element.appendChild(handle);
                this.resizeHandles[pos] = handle;
            });
        }

        bindEvents() {
            // Drag support
            this.header.addEventListener('mousedown', (e) => {
                if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;
                if (Date.now() < this._suppressDragUntil) return;
                this.initDrag(e);
            });
            
            // Double click to maximize
            this.header.addEventListener('dblclick', (e) => {
                if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;
                if (this._fullscreenAnimating) return;
                this._fullscreenAnimating = true;
                this._suppressDragUntil = Date.now() + 300;
                requestAnimationFrame(() => {
                    this.toggleFullscreen();
                    this._fullscreenAnimating = false;
                });
            });

            // Prevent scrolling propagation
            this.messagesContainer.addEventListener('wheel', (e) => {
                e.stopPropagation();
            }, { passive: true });
        }

        initDrag(e) {
            if (this.isResizing || this.manager.isFullscreen) return;
            
            // Don't start dragging immediately
            // Wait for movement threshold to avoid conflict with double click
            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = this.element.offsetLeft;
            const startTop = this.element.offsetTop;
            
            let isDragStarted = false;
            const dragThreshold = 5; // pixels
            
            const onMouseMove = (e) => {
                // If not yet started, check threshold
                if (!isDragStarted) {
                    const moveX = Math.abs(e.clientX - startX);
                    const moveY = Math.abs(e.clientY - startY);
                    
                    if (moveX > dragThreshold || moveY > dragThreshold) {
                        isDragStarted = true;
                        this.isDragging = true;
                        this.element.classList.add('dragging');
                    } else {
                        return; // Not moved enough yet
                    }
                }
                
                if (!this.isDragging) return;
                
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                this.element.style.left = `${startLeft + dx}px`;
                this.element.style.top = `${startTop + dy}px`;
                this.element.style.bottom = 'auto';
                this.element.style.right = 'auto';
            };
            
            const onMouseUp = () => {
                if (isDragStarted) {
                    this.isDragging = false;
                    this.element.classList.remove('dragging');
                    
                    // Save position only if actually dragged
                    if (typeof this.manager.saveWindowPosition === 'function') {
                        this.manager.saveWindowPosition();
                    }
                }
                
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        initResize(e, pos) {
            if (this.manager.isFullscreen) return;
            
            e.preventDefault();
            e.stopPropagation();
            this.isResizing = true;
            this.element.classList.add('resizing');
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startRect = this.element.getBoundingClientRect();
            const minWidth = 400;
            const minHeight = 300;
            
            const onMouseMove = (e) => {
                if (!this.isResizing) return;
                
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                let newWidth = startRect.width;
                let newHeight = startRect.height;
                let newLeft = startRect.left;
                let newTop = startRect.top;
                
                if (pos.includes('e')) newWidth = Math.max(minWidth, startRect.width + dx);
                if (pos.includes('s')) newHeight = Math.max(minHeight, startRect.height + dy);
                if (pos.includes('w')) {
                    const width = Math.max(minWidth, startRect.width - dx);
                    newLeft = startRect.left + (startRect.width - width);
                    newWidth = width;
                }
                if (pos.includes('n')) {
                    const height = Math.max(minHeight, startRect.height - dy);
                    newTop = startRect.top + (startRect.height - height);
                    newHeight = height;
                }
                
                this.element.style.width = `${newWidth}px`;
                this.element.style.height = `${newHeight}px`;
                this.element.style.left = `${newLeft}px`;
                this.element.style.top = `${newTop}px`;
            };
            
            const onMouseUp = () => {
                this.isResizing = false;
                this.element.classList.remove('resizing');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // Save size
                if (typeof this.manager.saveWindowSize === 'function') {
                    this.manager.saveWindowSize();
                }
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        toggleFullscreen() {
            const manager = this.manager;
             // Sync with manager.chatWindowState
            if (!manager.chatWindowState) {
                manager.chatWindowState = {};
            }

            if (!manager.isFullscreen) {
                // Enter fullscreen
                manager.preFullscreenStyle = {
                    width: this.element.style.width,
                    height: this.element.style.height,
                    top: this.element.style.top,
                    left: this.element.style.left,
                    bottom: this.element.style.bottom,
                    right: this.element.style.right,
                    transform: this.element.style.transform
                };
                
                // Clear inline styles to ensure CSS class with !important takes precedence
                // Because inline styles with !important (set by updateChatWindowStyle) would override CSS !important
                this.element.style.removeProperty('width');
                this.element.style.removeProperty('height');
                this.element.style.removeProperty('top');
                this.element.style.removeProperty('left');
                this.element.style.removeProperty('bottom');
                this.element.style.removeProperty('right');
                this.element.style.removeProperty('transform');
                
                manager.isFullscreen = true;
                manager.chatWindowState.isFullscreen = true;
                this.element.classList.add('fullscreen');
                
                if (this.header) {
                    this.header.title = '双击退出全屏';
                    // header borderRadius handled by CSS class
                }
            } else {
                // Exit fullscreen
                if (manager.preFullscreenStyle) {
                    Object.assign(this.element.style, manager.preFullscreenStyle);
                }
                // borderRadius handled by CSS class
                
                manager.isFullscreen = false;
                manager.chatWindowState.isFullscreen = false;
                this.element.classList.remove('fullscreen');
                
                if (this.header) {
                    this.header.title = '拖拽移动窗口 | 双击全屏';
                    // header borderRadius handled by CSS class
                }
            }
        }

        /**
         * 更新聊天窗口标题（显示当前会话名称）
         */
        updateChatHeaderTitle() {
            if (!this.element) return;
            
            const titleTextEl = this.element.querySelector('#pet-chat-header-title-text');
            if (!titleTextEl) return;
            
            const manager = this.manager;
            
            // 获取当前会话名称
            if (manager.currentSessionId && manager.sessions && manager.sessions[manager.currentSessionId]) {
                const session = manager.sessions[manager.currentSessionId];
                // 优先使用 pageTitle，如果没有则使用 title（兼容后端可能返回 title 字段的情况）
                const sessionTitle = session.pageTitle || session.title || '未命名会话';
                // 如果标题太长，截断并添加省略号
                const displayTitle = sessionTitle.length > 20 
                    ? sessionTitle.substring(0, 20) + '...' 
                    : sessionTitle;
                titleTextEl.textContent = displayTitle;
            } else {
                // 如果没有会话，显示默认文本
                titleTextEl.textContent = '与我聊天';
            }
        }

        /**
         * 更新聊天窗口主题颜色
         */
        updateTheme() {
            if (!this.element) return;
            const manager = this.manager;

            // 获取当前宠物颜色
            const currentColor = manager.colors[manager.colorIndex];
            const mainColor = this.getMainColorFromGradient(currentColor);

            // Update CSS variables
            this.element.style.setProperty('--pet-chat-primary-color', currentColor, 'important');
            this.element.style.setProperty('--pet-chat-main-color', mainColor, 'important');

            // 其余组件通过 CSS 变量生效，无需逐一设置
        }

        updateChatWindowStyle() {
            if (!this.element) return;
            
            const state = this.manager.chatWindowState || {};

            // Ensure fullscreen class is synced with state
            if (state.isFullscreen) {
                this.element.classList.add('fullscreen');
                // In fullscreen, we don't apply specific width/height/pos
                // relying on CSS class instead
                return;
            } else {
                this.element.classList.remove('fullscreen');
            }

            const width = state.width || 850;
            const height = state.height || 600;
            const left = state.x;
            const top = state.y;
            
            // Dynamic values only
            this.element.style.setProperty('width', `${width}px`, 'important');
            this.element.style.setProperty('height', `${height}px`, 'important');
            this.element.style.setProperty('z-index', `${PET_CONFIG.ui.zIndex.chatWindow}`, 'important');
            if (left !== undefined && top !== undefined) {
                this.element.style.setProperty('left', `${left}px`, 'important');
                this.element.style.setProperty('top', `${top}px`, 'important');
                this.element.style.setProperty('bottom', `auto`, 'important');
                this.element.style.setProperty('right', `auto`, 'important');
            } else {
                this.element.style.setProperty('bottom', `100px`, 'important');
                this.element.style.setProperty('right', `20px`, 'important');
                this.element.style.setProperty('left', `auto`, 'important');
                this.element.style.setProperty('top', `auto`, 'important');
            }
            // Initial animation can be controlled via CSS; ensure opacity/transform are reset if previously set
            this.element.style.removeProperty('opacity');
            this.element.style.removeProperty('transform');
        }

        initializeChatScroll() {
            // Wait for messages to be populated
            setTimeout(() => {
                if (this.messagesContainer) {
                    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
                }
            }, 100);
        }

    /**
     * 查找与宠物消息对应的用户消息
     * @param {HTMLElement} messageDiv - 宠物消息元素
     * @param {HTMLElement} messagesContainer - 消息容器
     * @returns {string|null} 用户消息文本，如果未找到则返回 null
     */
    _findUserMessageForRetry(messageDiv, messagesContainer) {
        const allMessages = Array.from(messagesContainer.children);
        const currentIndex = allMessages.indexOf(messageDiv);

        if (currentIndex === -1) {
            throw new Error('当前消息不在消息容器中');
        }

        // 向前遍历所有消息，找到最近的用户消息
        for (let i = currentIndex - 1; i >= 0; i--) {
            const messageElement = allMessages[i];
            const userBubble = messageElement.querySelector('[data-message-type="user-bubble"]');

            if (userBubble) {
                // 优先使用 data-original-text，如果没有则使用文本内容
                const userMessageText = userBubble.getAttribute('data-original-text') ||
                                       userBubble.textContent ||
                                       userBubble.innerText;

                if (userMessageText && userMessageText.trim()) {
                    return userMessageText.trim();
                }
            }
        }

        return null;
    }

    /**
     * 获取等待图标（从欢迎动作按钮中获取）
     * @returns {string} 等待图标
     */
    _getWaitingIcon() {
        if (this.element) {
            const welcomeActions = this.element.querySelector('#pet-welcome-actions');
            if (welcomeActions) {
                const firstButton = welcomeActions.querySelector('[data-action-key]');
                if (firstButton && firstButton.innerHTML) {
                    return firstButton.innerHTML.trim();
                }
            }
        }
        return '⏳'; // 默认图标
    }

    /**
     * 更新重新生成按钮的状态
     * @param {HTMLElement} button - 按钮元素
     * @param {string} state - 状态: 'idle' | 'loading' | 'success' | 'error'
     */
    _updateTryAgainButtonState(button, state) {
        const states = {
            idle: {
                icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                    <path d="M23 4v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`
            },
            loading: {
                icon: this._getWaitingIcon()
            },
            success: {
                icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                    <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`
            },
            error: {
                icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`
            }
        };

        const buttonState = states[state] || states.idle;
        button.innerHTML = buttonState.icon;
        
        // 移除所有状态类
        button.classList.remove('try-again-button--loading', 'try-again-button--success', 'try-again-button--error');
        
        // 添加当前状态类
        if (state !== 'idle') {
            button.classList.add(`try-again-button--${state}`);
        }
        
        // 清理可能存在的内联样式
        button.style.opacity = '';
        button.style.cursor = '';
        button.style.color = '';
    }

    /**
     * 更新请求状态（loading/idle）
     * @param {string} status - 状态: 'loading' | 'idle'
     * @param {AbortController|null} abortController - 中止控制器
     */
    _updateRequestStatus(status, abortController = null) {
        if (this._setAbortController) {
            this._setAbortController(abortController);
        }
        // Also update local state if needed
    }

    // Helper to set abort controller (migrated from logic in _updateRequestStatus)
    _setAbortController(controller) {
        this.abortController = controller;
    }

    /**
     * 创建流式内容更新回调
     * @param {HTMLElement} messageBubble - 消息气泡元素
     * @param {HTMLElement} messagesContainer - 消息容器
     * @returns {Function} 内容更新回调函数
     */
    _createStreamContentCallback(messageBubble, messagesContainer) {
        let fullContent = '';

        return (chunk, accumulatedContent) => {
            fullContent = accumulatedContent;
            messageBubble.innerHTML = this.manager.renderMarkdown(fullContent);
            messageBubble.setAttribute('data-original-text', fullContent);

            // 处理可能的 Mermaid 图表
            if (messageBubble._mermaidTimeout) {
                clearTimeout(messageBubble._mermaidTimeout);
            }
            messageBubble._mermaidTimeout = setTimeout(async () => {
                await this.manager.processMermaidBlocks(messageBubble);
                messageBubble._mermaidTimeout = null;
            }, 500);

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return fullContent;
        };
    }

    /**
     * 执行重新生成回复的核心逻辑
     * @param {HTMLElement} messageDiv - 宠物消息元素
     * @param {string} userMessageText - 用户消息文本
     * @param {HTMLElement} messagesContainer - 消息容器
     * @returns {Promise<string>} 生成的回复内容
     */
    async _retryGenerateResponse(messageDiv, userMessageText, messagesContainer) {
        const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
        if (!messageBubble) {
            throw new Error('未找到消息气泡');
        }

        const waitingIcon = this._getWaitingIcon();
        messageBubble.innerHTML = this.manager.renderMarkdown(`${waitingIcon} 正在重新生成回复...`);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 创建流式内容更新回调
        const onStreamContent = this._createStreamContentCallback(messageBubble, messagesContainer);

        // 创建 AbortController 用于终止请求
        const abortController = new AbortController();
        this._updateRequestStatus('loading', abortController);

        try {
            // 调用 API 重新生成
            const reply = await this.manager.generatePetResponseStream(userMessageText, onStreamContent, abortController);

            // 确保最终内容被显示（流式更新可能已经完成，但再次确认）
            if (reply && reply.trim()) {
                messageBubble.innerHTML = this.manager.renderMarkdown(reply);
                messageBubble.setAttribute('data-original-text', reply);
                setTimeout(async () => {
                    await this.manager.processMermaidBlocks(messageBubble);
                }, 100);
            }

            // 更新复制按钮
            const copyButtonContainer = messageDiv.querySelector('[data-copy-button-container]');
            if (copyButtonContainer && reply && reply.trim()) {
                this.manager.addCopyButton(copyButtonContainer, messageBubble);
            }

            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            return reply;
        } finally {
            this._updateRequestStatus('idle', null);
        }
    }

    /**
     * 处理重新生成失败的情况
     * @param {HTMLElement} messageDiv - 宠物消息元素
     * @param {Error} error - 错误对象
     */
    _handleRetryError(messageDiv, error) {
        const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

        if (!isAbortError) {
            console.error('重新生成回复失败:', error);

            const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
            if (messageBubble) {
                const originalText = messageBubble.getAttribute('data-original-text') ||
                                   '抱歉，重新生成失败，请稍后重试。';
                messageBubble.innerHTML = this.manager.renderMarkdown(originalText);
            }
        }

        return isAbortError;
    }

    // 为消息添加动作按钮（复制欢迎消息的按钮，设置按钮已移动到 chat-request-status-button 后面）
    async addActionButtonsToMessage(messageDiv, forceRefresh = false) {
        // 检查是否是欢迎消息，如果是则不添加（因为它已经有按钮了）
        const messagesContainer = this.element ? this.element.querySelector('#pet-chat-messages') : null;
        if (!messagesContainer) return;

        // 检查当前消息是否是欢迎消息，如果是则跳过（欢迎消息已经有按钮了）
        const isWelcome = messageDiv.hasAttribute('data-welcome-message');
        if (isWelcome) return;

        // 获取时间容器（需要在早期获取，因为后续逻辑需要使用）
        let timeAndCopyContainer = messageDiv.querySelector('[data-message-time]')?.parentElement?.parentElement;
        // 如果时间容器不存在，可能是消息结构还没准备好，尝试等待一下
        if (!timeAndCopyContainer) {
            // 等待消息结构完全准备好（最多等待500ms）
            for (let i = 0; i < 5; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                timeAndCopyContainer = messageDiv.querySelector('[data-message-time]')?.parentElement?.parentElement;
                if (timeAndCopyContainer) break;
            }
        }

        // 如果强制刷新，先移除现有按钮容器
        const existingContainer = messageDiv.querySelector('[data-message-actions]');
        const isUserMessage = messageDiv.querySelector('[data-message-type="user-bubble"]');

        // 对于用户消息，如果找不到timeAndCopyContainer，尝试直接从messageDiv查找copyButtonContainer
        let copyButtonContainer = null;
        if (timeAndCopyContainer) {
            copyButtonContainer = timeAndCopyContainer.querySelector('[data-copy-button-container]');
        } else if (isUserMessage) {
            // 用户消息：直接从messageDiv查找copyButtonContainer
            copyButtonContainer = messageDiv.querySelector('[data-copy-button-container]');
            // 如果找到了copyButtonContainer，尝试找到它的父容器作为timeAndCopyContainer
            if (copyButtonContainer && copyButtonContainer.parentElement) {
                timeAndCopyContainer = copyButtonContainer.parentElement;
            }
        }

        // 如果仍然找不到timeAndCopyContainer（且不是用户消息），则返回
        if (!timeAndCopyContainer && !isUserMessage) {
            console.warn('无法找到消息时间容器，按钮添加失败');
            return;
        }

        // 对于用户消息，如果仍然找不到copyButtonContainer，尝试创建它
        if (isUserMessage && !copyButtonContainer) {
            // 尝试找到用户消息的content容器
            const content = messageDiv.querySelector('div[style*="flex: 1"]') ||
                           messageDiv.querySelector('div:last-child');
            if (content) {
                // 查找是否已有timeAndCopyContainer
                let existingTimeAndCopyContainer = content.querySelector('div[style*="justify-content: space-between"]');
                if (!existingTimeAndCopyContainer) {
                    // 创建timeAndCopyContainer
                    existingTimeAndCopyContainer = document.createElement('div');
                    existingTimeAndCopyContainer.style.cssText = `
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        max-width: 80% !important;
                        width: 100% !important;
                        margin-top: 4px !important;
                        margin-left: auto !important;
                        box-sizing: border-box !important;
                    `;
                    content.appendChild(existingTimeAndCopyContainer);
                }
                timeAndCopyContainer = existingTimeAndCopyContainer;

                // 创建copyButtonContainer
                copyButtonContainer = document.createElement('div');
                copyButtonContainer.setAttribute('data-copy-button-container', 'true');
                copyButtonContainer.style.cssText = 'display: flex;';
                timeAndCopyContainer.insertBefore(copyButtonContainer, timeAndCopyContainer.firstChild);
            }
        }

        if (forceRefresh && existingContainer) {
            // 对于用户消息，如果按钮已经在 copyButtonContainer 内部，需要移除它们
            if (isUserMessage && copyButtonContainer) {
                // 查找所有带有 data-action-key 或其他标识的按钮（角色按钮等）
                // 这些按钮可能是之前添加的，需要移除
                const actionButtons = copyButtonContainer.querySelectorAll('[data-action-key], [data-robot-id]');
                actionButtons.forEach(btn => btn.remove());
            }
            existingContainer.remove();
        } else if (existingContainer) {
            // 如果按钮容器存在但没有按钮（子元素为空），强制刷新
            if (existingContainer.children.length === 0) {
                existingContainer.remove();
                // 继续执行后续逻辑添加按钮
            } else {
                // 对于用户消息，如果按钮容器不在 copyButtonContainer 内部，需要移动
                if (isUserMessage && copyButtonContainer) {
                    // 将按钮移动到 copyButtonContainer 内部
                    while (existingContainer.firstChild) {
                        copyButtonContainer.appendChild(existingContainer.firstChild);
                    }
                    existingContainer.remove();
                    // 确保 copyButtonContainer 使用 flex 布局，保留原有样式
                    if (!copyButtonContainer.style.display || copyButtonContainer.style.display === 'none') {
                        copyButtonContainer.style.display = 'flex';
                    }
                    copyButtonContainer.style.alignItems = 'center';
                    copyButtonContainer.style.gap = '8px';
                } else {
                    // 宠物消息：如果已经有按钮容器且不强制刷新，则需要确保它在编辑按钮之前
                    if (copyButtonContainer && existingContainer.nextSibling !== copyButtonContainer) {
                        // 如果顺序不对，重新插入到正确位置
                        timeAndCopyContainer.insertBefore(existingContainer, copyButtonContainer);
                    }
                }
                return;
            }
        }

        // 获取欢迎消息的按钮容器
        const welcomeActions = this.element.querySelector('#pet-welcome-actions');
        
        // 创建按钮容器
        const actionsContainer = document.createElement('div');
        actionsContainer.setAttribute('data-message-actions', 'true');

        // 检查是用户消息还是宠物消息，设置不同的样式
        if (isUserMessage) {
            // 用户消息：按钮容器紧跟在其他按钮后面，不需要左边距
            actionsContainer.style.cssText = `
                display: inline-flex !important;
                align-items: center !important;
                gap: 8px !important;
                flex-shrink: 0 !important;
                margin-left: 4px !important;
            `;
        } else {
            // 宠物消息：保持原有样式
            actionsContainer.style.cssText = `
                display: inline-flex !important;
                align-items: center !important;
                gap: 8px !important;
                flex-shrink: 0 !important;
                margin-left: 8px !important;
            `;
        }

        // 获取所有角色配置（用于没有 actionKey 的按钮）
        const configsRaw = await this.manager.getRoleConfigs();

        // 获取已绑定的角色键，用于检查哪些角色已经有按钮
        const orderedKeys = await this.manager.getOrderedBoundRoleKeys();
        const boundRoleIds = new Set();
        const configsByActionKey = {};
        const configsById = {};

        for (const config of (configsRaw || [])) {
            if (config && config.id) {
                configsById[config.id] = config;
                if (config.actionKey) {
                    configsByActionKey[config.actionKey] = config;
                    if (orderedKeys.includes(config.actionKey)) {
                        boundRoleIds.add(config.id);
                    }
                }
            }
        }

        // 复制欢迎消息中的所有按钮（包括设置按钮）
        const buttonsToCopy = welcomeActions ? Array.from(welcomeActions.children) : [];
        const copiedButtonIds = new Set(); // 记录已复制的按钮ID

        for (const originalButton of buttonsToCopy) {
            // 创建新按钮（通过克隆并重新绑定事件）
            const newButton = originalButton.cloneNode(true);

            // 如果是设置按钮，绑定点击事件
            if (newButton.innerHTML.trim() === '⚙️' || newButton.innerHTML.trim() === '👤' || newButton.title === '角色设置') {
                newButton.innerHTML = '👤';
                newButton.title = '角色设置';
                newButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.manager.openRoleSettingsModal();
                });
                actionsContainer.appendChild(newButton);
                continue;
            } else if (newButton.hasAttribute('data-action-key')) {
                // 如果是角色按钮（有 actionKey），创建使用消息内容的处理函数
                const actionKey = newButton.getAttribute('data-action-key');
                const config = configsByActionKey[actionKey];
                if (config && config.id) {
                    copiedButtonIds.add(config.id);
                }

                // 为消息下的按钮创建特殊的处理函数（使用消息内容而不是页面内容）
                newButton.addEventListener('click', async (e) => {
                    e.stopPropagation();

                    // 获取当前消息的内容（根据消息类型选择正确的元素）
                    let messageBubble = null;
                    if (isUserMessage) {
                        // 用户消息：从 user-bubble 获取内容
                        messageBubble = messageDiv.querySelector('[data-message-type="user-bubble"]');
                    } else {
                        // 宠物消息：从 pet-bubble 获取内容
                        messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                    }
                    let messageContent = '';
                    if (messageBubble) {
                        // 优先使用 data-original-text（原始文本），如果没有则使用文本内容
                        messageContent = messageBubble.getAttribute('data-original-text') ||
                                       messageBubble.innerText ||
                                       messageBubble.textContent || '';
                    }

                    // 获取角色信息
                    const pageInfo = this.manager.getPageInfo(); // 保留用于获取角色配置，但不用于 userPrompt
                    let roleInfo;
                    try {
                        roleInfo = await this.manager.getRolePromptForAction(actionKey, pageInfo);
                    } catch (error) {
                        console.error('获取角色信息失败:', error);
                        roleInfo = {
                            systemPrompt: '',
                            userPrompt: '',
                            label: '自定义角色',
                            icon: '🙂'
                        };
                    }

                    // 检查页面上下文开关状态
                    let includeContext = true; // 默认包含上下文
                    const contextSwitch = this.element ? this.element.querySelector('#context-switch') : null;
                    if (contextSwitch) {
                        includeContext = contextSwitch.checked;
                    }

                    // 构建 fromUser：以当前消息内容为主，包含会话上下文
                    const baseMessageContent = messageContent.trim() || '无内容';
                    let fromUser = baseMessageContent;

                    // 如果没有开启页面上下文，直接使用消息内容
                    if (!includeContext) {
                        fromUser = baseMessageContent;
                    } else {
                        // 获取会话上下文，添加相关的上下文信息
                        const context = this.manager.buildConversationContext();

                        // 如果存在会话历史，在消息内容前添加上下文
                        if (context.hasHistory && context.messages.length > 0) {
                            // 构建消息历史上下文（只包含当前消息之前的历史）
                            let conversationContext = '\n\n## 会话历史：\n\n';
                            context.messages.forEach((msg) => {
                                const role = msg.type === 'user' ? '用户' : '助手';
                                const content = msg.content.trim();
                                if (content && content !== baseMessageContent) { // 排除当前消息本身
                                    conversationContext += `${role}：${content}\n\n`;
                                }
                            });
                            // 将上下文放在前面，当前消息内容放在后面
                            fromUser = conversationContext + `## 当前需要处理的消息：\n\n${baseMessageContent}`;
                        }

                        // 如果有页面内容且角色提示词包含页面内容，也添加页面内容
                        if (context.pageContent && roleInfo.userPrompt && roleInfo.userPrompt.includes('页面内容')) {
                            fromUser += `\n\n## 页面内容：\n\n${context.pageContent}`;
                        }
                    }

                    // 获取消息容器
                    const messagesContainer = this.element ? this.element.querySelector('#pet-chat-messages') : null;
                    if (!messagesContainer) {
                        console.error('无法找到消息容器');
                        return;
                    }

                    // 创建新的消息
                    const message = this.manager.createMessageElement('', 'pet');
                    message.setAttribute('data-button-action', 'true');
                    messagesContainer.appendChild(message);
                    const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                    const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');

                    // 显示加载动画
                    if (messageAvatar) {
                        messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                    }
                    const loadingIcon = roleInfo.icon || '📖';
                    if (messageText) {
                        messageText.textContent = `${loadingIcon} 正在${roleInfo.label || '处理'}...`;
                    }

                    try {
                        // 创建 AbortController 用于终止请求
                        const abortController = new AbortController();
                        this._updateRequestStatus('loading', abortController);

                        // 发送请求
                        const response = await this.manager.chatService.sendMessage({
                            model: this.manager.currentModel,
                            systemPrompt: roleInfo.systemPrompt,
                            userPrompt: fromUser,
                            onProgress: (text) => {
                                // 实时更新消息内容
                                if (messageText) {
                                    // 检查是否包含Mermaid图表代码块
                                    const hasMermaid = text.includes('```mermaid');
                                    messageText.innerHTML = this.manager.renderMarkdown(text);
                                    // 如果有Mermaid图表，需要处理渲染
                                    if (hasMermaid && this.manager.processMermaidBlocks) {
                                        this.manager.processMermaidBlocks(messageText);
                                    }
                                }
                                // 滚动到底部
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            },
                            signal: abortController.signal
                        });

                        // 请求完成
                        if (messageAvatar) {
                            messageAvatar.style.animation = '';
                        }
                        this._updateRequestStatus('idle');

                        // 为新消息添加按钮
                        this.addActionButtonsToMessage(message);
                        this.addTryAgainButton(message.querySelector('[data-message-actions]')?.parentElement || message, message);

                    } catch (error) {
                        if (error.name === 'AbortError') {
                            console.log('请求被取消');
                            if (messageText) messageText.textContent += ' (已取消)';
                        } else {
                            console.error('请求失败:', error);
                            if (messageText) messageText.textContent += ' (请求失败)';
                        }
                        if (messageAvatar) {
                            messageAvatar.style.animation = '';
                        }
                        this._updateRequestStatus('error');
                    }
                });
                actionsContainer.appendChild(newButton);
            }
        }

        // 添加其他已绑定的角色按钮（不在欢迎消息中的）
        for (const roleId of orderedKeys) {
            // 如果已经复制了，跳过
            // 注意：orderedKeys 是 actionKey，需要找到对应的 id
            const config = configsByActionKey[roleId]; // roleId here is actionKey
            if (!config || copiedButtonIds.has(config.id)) continue;

            // 创建新按钮
            const newButton = document.createElement('button');
            newButton.innerHTML = config.icon || '🙂';
            newButton.title = config.label || '自定义角色';
            newButton.setAttribute('data-action-key', config.actionKey);
            newButton.className = 'action-button'; // 使用通用样式类

            // 绑定点击事件（代码同上，应该提取为公共函数）
            const actionKey = config.actionKey;
            newButton.addEventListener('click', async (e) => {
                e.stopPropagation();

                // 获取当前消息的内容
                let messageBubble = null;
                if (isUserMessage) {
                    messageBubble = messageDiv.querySelector('[data-message-type="user-bubble"]');
                } else {
                    messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                }
                let messageContent = '';
                if (messageBubble) {
                    messageContent = messageBubble.getAttribute('data-original-text') ||
                                   messageBubble.innerText ||
                                   messageBubble.textContent || '';
                }

                // 获取角色信息
                const pageInfo = this.manager.getPageInfo();
                let roleInfo;
                try {
                    roleInfo = await this.manager.getRolePromptForAction(actionKey, pageInfo);
                } catch (error) {
                    console.error('获取角色信息失败:', error);
                    roleInfo = {
                        systemPrompt: '',
                        userPrompt: '',
                        label: '自定义角色',
                        icon: '🙂'
                    };
                }

                // 检查页面上下文开关状态
                let includeContext = true;
                const contextSwitch = this.element ? this.element.querySelector('#context-switch') : null;
                if (contextSwitch) {
                    includeContext = contextSwitch.checked;
                }

                const baseMessageContent = messageContent.trim() || '无内容';
                let fromUser = baseMessageContent;

                if (!includeContext) {
                    fromUser = baseMessageContent;
                } else {
                    const context = this.manager.buildConversationContext();
                    if (context.hasHistory && context.messages.length > 0) {
                        let conversationContext = '\n\n## 会话历史：\n\n';
                        context.messages.forEach((msg) => {
                            const role = msg.type === 'user' ? '用户' : '助手';
                            const content = msg.content.trim();
                            if (content && content !== baseMessageContent) {
                                conversationContext += `${role}：${content}\n\n`;
                            }
                        });
                        fromUser = conversationContext + `## 当前需要处理的消息：\n\n${baseMessageContent}`;
                    }

                    if (context.pageContent && roleInfo.userPrompt && roleInfo.userPrompt.includes('页面内容')) {
                        fromUser += `\n\n## 页面内容：\n\n${context.pageContent}`;
                    }
                }

                const messagesContainer = this.element ? this.element.querySelector('#pet-chat-messages') : null;
                if (!messagesContainer) return;

                const message = this.manager.createMessageElement('', 'pet');
                message.setAttribute('data-button-action', 'true');
                messagesContainer.appendChild(message);
                const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');

                if (messageAvatar) {
                    messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                }
                const loadingIcon = roleInfo.icon || '📖';
                if (messageText) {
                    messageText.textContent = `${loadingIcon} 正在${roleInfo.label || '处理'}...`;
                }

                try {
                    const abortController = new AbortController();
                    this._updateRequestStatus('loading', abortController);

                    await this.manager.chatService.sendMessage({
                        model: this.manager.currentModel,
                        systemPrompt: roleInfo.systemPrompt,
                        userPrompt: fromUser,
                        onProgress: (text) => {
                            if (messageText) {
                                const hasMermaid = text.includes('```mermaid');
                                messageText.innerHTML = this.manager.renderMarkdown(text);
                                if (hasMermaid && this.manager.processMermaidBlocks) {
                                    this.manager.processMermaidBlocks(messageText);
                                }
                            }
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        },
                        signal: abortController.signal
                    });

                    if (messageAvatar) {
                        messageAvatar.style.animation = '';
                    }
                    this._updateRequestStatus('idle');

                    this.addActionButtonsToMessage(message);
                    this.addTryAgainButton(message.querySelector('[data-message-actions]')?.parentElement || message, message);

                } catch (error) {
                    if (error.name === 'AbortError') {
                        console.log('请求被取消');
                        if (messageText) messageText.textContent += ' (已取消)';
                    } else {
                        console.error('请求失败:', error);
                        if (messageText) messageText.textContent += ' (请求失败)';
                    }
                    if (messageAvatar) {
                        messageAvatar.style.animation = '';
                    }
                    this._updateRequestStatus('error');
                }
            });

            actionsContainer.appendChild(newButton);
        }

        // 将按钮容器添加到消息中
        if (isUserMessage && copyButtonContainer) {
            // 用户消息：添加到 copyButtonContainer 内部
            copyButtonContainer.appendChild(actionsContainer);
            // 确保 copyButtonContainer 使用 flex 布局
            if (!copyButtonContainer.style.display || copyButtonContainer.style.display === 'none') {
                copyButtonContainer.style.display = 'flex';
            }
            copyButtonContainer.style.alignItems = 'center';
            copyButtonContainer.style.gap = '8px';
        } else {
            // 宠物消息：插入到复制按钮之前
            const copyButton = timeAndCopyContainer.querySelector('.copy-button');
            if (copyButton) {
                timeAndCopyContainer.insertBefore(actionsContainer, copyButton);
            } else {
                timeAndCopyContainer.appendChild(actionsContainer);
            }
        }
    }

    /**
     * 为宠物消息添加重新生成按钮
     * @param {HTMLElement} container - 按钮容器
     * @param {HTMLElement} messageDiv - 宠物消息元素
     */
    addTryAgainButton(container, messageDiv) {
        // 如果已经添加过，就不再添加
        if (container.querySelector('.try-again-button')) {
            return;
        }

        // 如果是按钮操作生成的消息，不添加 try again 按钮
        if (messageDiv.hasAttribute('data-button-action')) {
            return;
        }

        const messagesContainer = this.element ? this.element.querySelector('#pet-chat-messages') : null;
        if (!messagesContainer) {
            return;
        }

        // 创建重新生成按钮
        const tryAgainButton = document.createElement('button');
        tryAgainButton.className = 'try-again-button';
        tryAgainButton.setAttribute('title', '重新生成回复');
        tryAgainButton.setAttribute('aria-label', '重新生成回复');
        // 图标：刷新/重试
        tryAgainButton.innerHTML = '🔄';

        // 初始化按钮状态
        this._updateTryAgainButtonState(tryAgainButton, 'idle');

        // 点击重新生成
        tryAgainButton.addEventListener('click', async (e) => {
            e.stopPropagation();

            // 防止重复点击
            if (tryAgainButton.hasAttribute('data-retrying')) {
                return;
            }

            tryAgainButton.setAttribute('data-retrying', 'true');
            this._updateTryAgainButtonState(tryAgainButton, 'loading');

            try {
                // 查找对应的用户消息
                const userMessageText = this._findUserMessageForRetry(messageDiv, messagesContainer);

                if (!userMessageText) {
                    // 如果找不到用户消息，可能是通过按钮触发的操作
                    console.warn('未找到对应的用户消息，无法重新生成回复');

                    const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                    if (messageBubble) {
                        const originalText = messageBubble.getAttribute('data-original-text') ||
                                           messageBubble.textContent ||
                                           '此消息无法重新生成';
                        messageBubble.innerHTML = this.manager.renderMarkdown(
                            `${originalText}\n\n💡 **提示**：此消息可能是通过按钮操作生成的，无法重新生成。`
                        );
                    }

                    this._updateTryAgainButtonState(tryAgainButton, 'idle');
                    tryAgainButton.removeAttribute('data-retrying');
                    return;
                }

                // 执行重新生成
                await this._retryGenerateResponse(messageDiv, userMessageText, messagesContainer);

                // 显示成功状态
                this._updateTryAgainButtonState(tryAgainButton, 'success');

                // 1.5秒后恢复为初始状态
                setTimeout(() => {
                    this._updateTryAgainButtonState(tryAgainButton, 'idle');
                    tryAgainButton.removeAttribute('data-retrying');
                }, 1500);

            } catch (error) {
                // 处理错误
                let isAbortError = this._handleRetryError(messageDiv, error);

                if (!isAbortError) {
                    // 显示错误状态
                    this._updateTryAgainButtonState(tryAgainButton, 'error');

                    // 1.5秒后恢复为初始状态
                    setTimeout(() => {
                        this._updateTryAgainButtonState(tryAgainButton, 'idle');
                        tryAgainButton.removeAttribute('data-retrying');
                    }, 1500);
                } else {
                    // 请求被取消，直接恢复状态
                    this._updateTryAgainButtonState(tryAgainButton, 'idle');
                    tryAgainButton.removeAttribute('data-retrying');
                }
            }
        });

        container.appendChild(tryAgainButton);
        container.style.display = 'flex';
        container.style.gap = '8px';

        // 确保容器可见
        if (container.style.display === 'none') {
            container.style.display = 'flex';
        }
    }

    // 为用户消息添加删除和编辑按钮
    addDeleteButtonForUserMessage(container, messageTextElement) {
        // 如果已经添加过，就不再添加
        if (container.querySelector('.delete-button') &&
            container.querySelector('.edit-button') &&
            container.querySelector('.resend-button')) {
            return;
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '🗑️';
        deleteButton.setAttribute('title', '删除消息');

        // 点击删除
        deleteButton.addEventListener('click', async (e) => {
            e.stopPropagation();

            // 防止重复点击
            if (deleteButton.disabled || deleteButton.dataset.deleting === 'true') {
                return;
            }

            // 确认删除
            if (!confirm('确定要删除这条消息吗？')) {
                return;
            }

            // 标记为正在删除
            deleteButton.disabled = true;
            deleteButton.dataset.deleting = 'true';
            const originalHTML = deleteButton.innerHTML;
            deleteButton.innerHTML = '...';
            deleteButton.style.opacity = '0.5';

            try {
                // 找到包含删除按钮容器的消息元素
                let currentMessage = container.parentElement;
                let foundMessageDiv = null;

                while (currentMessage &&
                       currentMessage !== document.body &&
                       currentMessage !== document.documentElement) {
                    // 检查是否包含消息气泡
                    const hasBubble = currentMessage.querySelector('[data-message-type="user-bubble"]') ||
                                    currentMessage.querySelector('[data-message-type="pet-bubble"]');

                    if (hasBubble) {
                        // 检查是否包含头像（通过检查子元素中是否有包含 👤 或 🐾 的元素）
                        const children = Array.from(currentMessage.children);
                        const hasAvatar = children.some(child => {
                            const text = child.textContent || '';
                            return text.includes('👤') || text.includes('🐾');
                        });

                        // 如果同时包含气泡和头像，说明找到了完整的 messageDiv
                        if (hasAvatar) {
                            foundMessageDiv = currentMessage;
                            break;
                        }
                    }

                    currentMessage = currentMessage.parentElement;
                }

                // 如果没找到包含头像的 messageDiv，回退到只包含气泡的元素
                if (!foundMessageDiv && currentMessage) {
                    let parentElement = currentMessage.parentElement;
                    while (parentElement &&
                           parentElement !== document.body &&
                           parentElement !== document.documentElement) {
                        const children = Array.from(parentElement.children);
                        const hasAvatar = children.some(child => {
                            const text = child.textContent || '';
                            return text.includes('👤') || text.includes('🐾');
                        });
                        const hasBubble = parentElement.querySelector('[data-message-type="user-bubble"]') ||
                                        parentElement.querySelector('[data-message-type="pet-bubble"]');
                        if (hasAvatar && hasBubble) {
                            foundMessageDiv = parentElement;
                            break;
                        }
                        parentElement = parentElement.parentElement;
                    }
                }

                currentMessage = foundMessageDiv || currentMessage;

                if (!currentMessage) {
                    console.warn('无法找到消息元素');
                    deleteButton.disabled = false;
                    deleteButton.dataset.deleting = 'false';
                    deleteButton.innerHTML = originalHTML;
                    deleteButton.style.opacity = '';
                    return;
                }

                // 从会话中删除对应的消息
                if (this.manager.currentSessionId && this.manager.sessions[this.manager.currentSessionId]) {
                    const session = this.manager.sessions[this.manager.currentSessionId];
                    if (session.messages && Array.isArray(session.messages)) {
                        // 使用改进的消息匹配方法
                        const messageResult = this.manager.findMessageObjectByDiv(currentMessage);

                        if (messageResult && messageResult.index !== undefined && messageResult.index >= 0) {
                            // 从本地会话中删除消息
                            session.messages.splice(messageResult.index, 1);
                            session.updatedAt = Date.now();

                            console.log(`已从会话 ${this.manager.currentSessionId} 中删除消息，剩余 ${session.messages.length} 条消息`);

                            // 动画删除消息
                            currentMessage.style.transition = 'opacity 0.3s ease';
                            currentMessage.style.opacity = '0';
                            setTimeout(() => {
                                currentMessage.remove();
                                // 删除后保存会话并同步到后端（确保数据同步）
                                this.manager.saveCurrentSession().then(() => {
                                    // 同步到后端
                                    if (this.manager.currentSessionId && this.manager.sessionManager && this.manager.sessionManager.enableBackendSync) {
                                        this.manager.sessionManager.syncSessionToBackend(this.manager.currentSessionId, true).catch(err => {
                                            console.error('删除消息后同步到后端失败:', err);
                                        });
                                    }
                                }).catch(err => {
                                    console.error('删除消息后保存会话失败:', err);
                                });
                            }, 300);
                        } else {
                            console.warn('无法找到对应的消息对象，尝试通过DOM索引删除');
                            // 如果找不到消息对象，尝试通过DOM索引来删除
                            const messagesContainer = this.element ? this.element.querySelector('#pet-chat-messages') : null;
                            if (messagesContainer) {
                                const allMessageDivs = Array.from(messagesContainer.children).filter(div => {
                                    return !div.hasAttribute('data-welcome-message') &&
                                           (div.querySelector('[data-message-type="user-bubble"]') ||
                                            div.querySelector('[data-message-type="pet-bubble"]'));
                                });
                                const domIndex = allMessageDivs.indexOf(currentMessage);
                                if (domIndex >= 0 && domIndex < session.messages.length) {
                                    // 通过DOM索引删除消息
                                    session.messages.splice(domIndex, 1);
                                    session.updatedAt = Date.now();
                                    console.log(`已通过DOM索引从会话 ${this.manager.currentSessionId} 中删除消息，剩余 ${session.messages.length} 条消息`);

                                    // 动画删除消息
                                    currentMessage.style.transition = 'opacity 0.3s ease';
                                    currentMessage.style.opacity = '0';
                                    setTimeout(() => {
                                        currentMessage.remove();
                                        // 删除后保存会话并同步到后端
                                        this.manager.saveCurrentSession().then(() => {
                                            if (this.manager.currentSessionId && this.manager.sessionManager && this.manager.sessionManager.enableBackendSync) {
                                                this.manager.sessionManager.syncSessionToBackend(this.manager.currentSessionId, true).catch(err => {
                                                    console.error('删除消息后同步到后端失败:', err);
                                                });
                                            }
                                        }).catch(err => {
                                            console.error('删除消息后保存会话失败:', err);
                                        });
                                    }, 300);
                                } else {
                                    currentMessage.style.transition = 'opacity 0.3s ease';
                                    currentMessage.style.opacity = '0';
                                    setTimeout(() => {
                                        currentMessage.remove();
                                    }, 300);
                                }
                            } else {
                                currentMessage.style.transition = 'opacity 0.3s ease';
                                currentMessage.style.opacity = '0';
                                setTimeout(() => {
                                    currentMessage.remove();
                                }, 300);
                            }
                        }
                    }
                } else {
                    // 如果没有会话，直接删除DOM元素
                    currentMessage.style.transition = 'opacity 0.3s ease';
                    currentMessage.style.opacity = '0';
                    setTimeout(() => {
                        currentMessage.remove();
                    }, 300);
                }
            } catch (error) {
                console.error('删除消息时发生错误:', error);
            } finally {
                // 恢复按钮状态
                if (deleteButton.isConnected) {
                    deleteButton.disabled = false;
                    deleteButton.dataset.deleting = 'false';
                    deleteButton.innerHTML = originalHTML;
                    deleteButton.style.opacity = '';
                }
            }
        });

        // 创建编辑按钮
        const editButton = document.createElement('button');
        editButton.className = 'edit-button';
        editButton.innerHTML = '✏️';
        editButton.setAttribute('title', '编辑消息');

        // 点击编辑 - 打开弹窗编辑器
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (messageTextElement) {
                this.manager.openMessageEditor(messageTextElement, 'user');
            }
        });

        // 创建重新发送按钮
        const resendButton = document.createElement('button');
        resendButton.className = 'resend-button';
        resendButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
        `;
        resendButton.setAttribute('title', '重新发送 prompt 请求');
        resendButton.style.cssText = `
            background: transparent !important;
            border: none !important;
            cursor: pointer !important;
            padding: 4px 8px !important;
            opacity: 0.7 !important;
            transition: opacity 0.2s ease, color 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: currentColor !important;
            min-width: 24px !important;
            min-height: 24px !important;
        `;

        resendButton.addEventListener('mouseenter', () => {
            resendButton.style.opacity = '1';
        });
        resendButton.addEventListener('mouseleave', () => {
            resendButton.style.opacity = '0.7';
        });

        // 点击重新发送
        let isResending = false;
        resendButton.addEventListener('click', async (e) => {
            e.stopPropagation();

            if (isResending) return;
            isResending = true;

            try {
                // 获取用户消息的原始文本
                let userMessageText = messageTextElement.getAttribute('data-original-text');
                if (!userMessageText) {
                    userMessageText = messageTextElement.textContent || messageTextElement.innerText || '';
                }

                if (!userMessageText || !userMessageText.trim()) {
                    console.warn('无法获取用户消息内容');
                    isResending = false;
                    return;
                }

                // 获取消息容器
                const messagesContainer = this.element ? this.element.querySelector('#pet-chat-messages') : null;
                if (!messagesContainer) {
                    console.warn('无法找到消息容器');
                    isResending = false;
                    return;
                }

                // 找到当前用户消息元素
                let currentMessage = container.parentElement;
                while (currentMessage && !currentMessage.style.cssText.includes('margin-bottom: 15px')) {
                    currentMessage = currentMessage.parentElement;
                }

                if (!currentMessage) {
                    console.warn('无法找到当前消息元素');
                    isResending = false;
                    return;
                }

                // 更新按钮状态
                resendButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="31.416" opacity="0.3">
                            <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/>
                            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                `;
                resendButton.style.opacity = '0.6';
                resendButton.style.cursor = 'not-allowed';
                resendButton.style.color = '';

                // 创建打字指示器
                const typingIndicator = this.manager.createTypingIndicator();

                // 在当前用户消息之后插入打字指示器
                if (currentMessage.nextSibling) {
                    messagesContainer.insertBefore(typingIndicator, currentMessage.nextSibling);
                } else {
                    messagesContainer.appendChild(typingIndicator);
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                // 生成回复
                let fullContent = '';
                const messageBubble = typingIndicator.querySelector('[data-message-type="pet-bubble"]');

                const onStreamContent = (chunk, accumulatedContent) => {
                    fullContent = accumulatedContent;
                    if (messageBubble) {
                        messageBubble.innerHTML = this.manager.renderMarkdown(fullContent);
                        messageBubble.setAttribute('data-original-text', fullContent);

                        // 处理可能的 Mermaid 图表
                        if (messageBubble._mermaidTimeout) {
                            clearTimeout(messageBubble._mermaidTimeout);
                        }
                        messageBubble._mermaidTimeout = setTimeout(async () => {
                            await this.manager.processMermaidBlocks(messageBubble);
                            messageBubble._mermaidTimeout = null;
                        }, 500);

                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                };

                // 创建 AbortController 用于终止请求
                const abortController = new AbortController();
                this._updateRequestStatus('loading', abortController);

                // 调用 API 生成回复
                const reply = await this.manager.generatePetResponseStream(userMessageText.trim(), onStreamContent, abortController);

                // 移除打字指示器，创建正式的消息元素
                typingIndicator.remove();

                // 创建正式的宠物消息
                const petMessage = this.manager.createMessageElement(reply, 'pet');
                if (currentMessage.nextSibling) {
                    messagesContainer.insertBefore(petMessage, currentMessage.nextSibling);
                } else {
                    messagesContainer.appendChild(petMessage);
                }

                // 确保最终内容被显示
                const finalMessageBubble = petMessage.querySelector('[data-message-type="pet-bubble"]');
                if (finalMessageBubble && fullContent !== reply) {
                    finalMessageBubble.innerHTML = this.manager.renderMarkdown(reply);
                    finalMessageBubble.setAttribute('data-original-text', reply);
                    setTimeout(async () => {
                        await this.manager.processMermaidBlocks(finalMessageBubble);
                    }, 100);
                }

                // 添加复制按钮等操作按钮
                const copyButtonContainer = petMessage.querySelector('[data-copy-button-container]');
                if (copyButtonContainer && reply && reply.trim()) {
                    this.manager.addCopyButton(copyButtonContainer, finalMessageBubble);
                }

                // 添加排序按钮
                if (copyButtonContainer) {
                    this.manager.addSortButtons(copyButtonContainer, petMessage);
                }

                // 添加重试按钮
                const tryAgainButtonContainer = petMessage.querySelector('[data-try-again-button-container]');
                if (tryAgainButtonContainer) {
                    this.addTryAgainButton(tryAgainButtonContainer, petMessage);
                }

                // 添加消息到会话
                if (this.manager.currentSessionId && reply && reply.trim()) {
                    await this.manager.addMessageToSession('pet', reply, null, true);

                    // 调用 session/save 保存会话到后端
                    if (this.manager.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                        await this.manager.syncSessionToBackend(this.manager.currentSessionId, true);
                    }
                }

                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                this._updateRequestStatus('idle');

                // 恢复按钮状态
                resendButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                        <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                resendButton.style.color = '#4caf50';

                setTimeout(() => {
                    resendButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                            <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        </svg>
                    `;
                    resendButton.style.color = '';
                    resendButton.style.opacity = '0.7';
                    resendButton.style.cursor = 'pointer';
                    isResending = false;
                }, 1500);

            } catch (error) {
                const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

                if (!isAbortError) {
                    console.error('重新发送 prompt 请求失败:', error);
                }

                this._updateRequestStatus('idle');

                resendButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                `;
                resendButton.style.color = '#f44336';

                setTimeout(() => {
                    resendButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                            <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        </svg>
                    `;
                    resendButton.style.color = '';
                    resendButton.style.opacity = '0.7';
                    resendButton.style.cursor = 'pointer';
                    isResending = false;
                }, 1500);
            }
        });

        if (!container.querySelector('.edit-button')) {
            container.appendChild(editButton);
        }
        if (!container.querySelector('.resend-button')) {
            container.appendChild(resendButton);
        }
        if (!container.querySelector('.delete-button')) {
            container.appendChild(deleteButton);
        }
        container.style.display = 'flex';
        container.style.gap = '8px';
    }
}

// Export to namespace
window.PetManager.Components.ChatWindow = ChatWindow;

})();
