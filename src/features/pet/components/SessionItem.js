/**
 * SessionItem Component
 * Handles rendering and interaction for a single session item in the sidebar.
 */
(function() {
    'use strict';

    // Ensure namespace exists
    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    class SessionItem {
        constructor(manager, session) {
            this.manager = manager;
            this.session = session;
            this.element = this.create();
        }

        create() {
            const session = this.session;
            const manager = this.manager;

        const sessionItem = document.createElement('div');
        sessionItem.className = 'session-item';
        sessionItem.dataset.sessionId = session.id;
        

        // Selected state
        if (manager.currentSessionId === session.id) {
            sessionItem.classList.add('selected');
        }

        const itemInner = document.createElement('div');
        itemInner.className = 'session-item-inner';

        // Checkbox
        const checkboxContainer = this.createCheckbox(sessionItem);
        itemInner.appendChild(checkboxContainer);

        // Content
        const contentWrapper = this.createContent();
        itemInner.appendChild(contentWrapper);

        sessionItem.appendChild(itemInner);

        // Long press logic
        this.setupLongPress(sessionItem);

            // Click handler (activate session)
            sessionItem.addEventListener('click', async (e) => {
                // Ignore if clicking checkbox, favorite icon, or action buttons
                if (e.target.closest('.session-checkbox') || 
                    e.target.closest('.favorite-icon') ||
                    e.target.closest('button') ||
                    e.target.closest('.session-tag-item')) {
                    return;
                }

                if (manager.isSwitchingSession) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                // Batch mode handling
                if (manager.batchMode) {
                    const checkbox = sessionItem.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                    return;
                }

                // Switch session
                sessionItem.classList.add('clicked');
                sessionItem.style.pointerEvents = 'none';
                try {
                    if (typeof manager.switchSession === 'function') {
                        await manager.switchSession(session.id);
                    } else if (typeof manager.activateSession === 'function') {
                        await manager.activateSession(session.id);
                    }
                } catch (error) {
                    console.error('切换会话失败:', error);
                    sessionItem.classList.remove('clicked');
                } finally {
                    setTimeout(() => {
                        sessionItem.style.pointerEvents = '';
                        sessionItem.classList.remove('clicked');
                    }, 300);
                }
            });

            // Context menu
            sessionItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                manager.showSessionContext(e, session);
            });

            return sessionItem;
        }

        createCheckbox(sessionItem) {
            const manager = this.manager;
            const session = this.session;

        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'session-checkbox';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = manager.selectedSessionIds && manager.selectedSessionIds.has(session.id);
            
            checkbox.addEventListener('change', (e) => {
                const checked = e.target.checked;
                if (!manager.selectedSessionIds) {
                    manager.selectedSessionIds = new Set();
                }
                
                if (checked) {
                    manager.selectedSessionIds.add(session.id);
                    sessionItem.classList.add('selected');
                } else {
                    manager.selectedSessionIds.delete(session.id);
                    sessionItem.classList.remove('selected');
                }
                
                if (typeof manager.updateBatchToolbar === 'function') {
                    manager.updateBatchToolbar();
                }
            });

            checkboxContainer.appendChild(checkbox);
            return checkboxContainer;
        }

        createContent() {
            const session = this.session;
            const manager = this.manager;

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'session-item-content';

        // 1. Header (Title + Fav)
        const header = document.createElement('div');
        header.className = 'session-item-header';

        const title = document.createElement('div');
        title.className = 'session-item-title';

        // Fav Icon
        const favIcon = document.createElement('span');
        favIcon.className = 'favorite-icon';
        favIcon.textContent = session.isFavorite ? '★' : '☆';
        if (session.isFavorite) {
            favIcon.classList.add('favorite-icon--active');
        }
        favIcon.title = session.isFavorite ? '取消收藏' : '收藏会话';
        favIcon.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newVal = !session.isFavorite;
            try {
                await manager.setSessionFavorite(session.id, newVal);
                favIcon.textContent = newVal ? '★' : '☆';
                if (newVal) {
                    favIcon.classList.add('favorite-icon--active');
                } else {
                    favIcon.classList.remove('favorite-icon--active');
                }
                
                const titleText = title.querySelector('.title-text');
                if (titleText) {
                    if (newVal) {
                        titleText.classList.add('title-text--favorite');
                    } else {
                        titleText.classList.remove('title-text--favorite');
                    }
                }
                
                // Note: Calling updateSessionSidebar might be too heavy here if we just updated DOM
                // But to be safe and consistent with original code:
                await manager.updateSessionSidebar(false, false);
                manager.showNotification(newVal ? '已收藏会话' : '已取消收藏', 'success');
            } catch (err) {
                console.error('更新收藏状态失败:', err);
                manager.showNotification('更新收藏状态失败', 'error');
            }
        });

        // Title Text
        const titleText = document.createElement('span');
        titleText.className = 'title-text';
        const sessionTitle = manager.getSessionTitle ? manager.getSessionTitle(session) : (session.pageTitle || session.id);
        titleText.textContent = sessionTitle;
        titleText.title = sessionTitle;
        if (session.isFavorite) {
            titleText.classList.add('title-text--favorite');
        }

        title.appendChild(favIcon);
        title.appendChild(titleText);
        header.appendChild(title);
        contentWrapper.appendChild(header);

        // 2. Session Info (Tags + Footer)
        const sessionInfo = document.createElement('div');
        sessionInfo.className = 'session-item-info';

        // Tags
        if (session.tags && session.tags.length > 0) {
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'session-tags';

            const normalizedTags = session.tags.map(tag => tag ? tag.trim() : '').filter(tag => tag.length > 0);
            normalizedTags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'session-tag-item';
                tagElement.textContent = tag;
                const tagColor = manager.getTagColor(tag);
                tagElement.style.setProperty('--tag-bg', tagColor.background);
                tagElement.style.setProperty('--tag-text', tagColor.text);
                tagElement.style.setProperty('--tag-border', tagColor.border);
                
                // Add click handler for tag filtering if needed
                // tagElement.addEventListener('click', (e) => { ... });

                tagsContainer.appendChild(tagElement);
            });
            sessionInfo.appendChild(tagsContainer);
        }

        // Footer (Time + Buttons)
        const footer = document.createElement('div');
        footer.className = 'session-item-footer';

        // Time
        const timeSpan = document.createElement('span');
        const sessionTime = session.lastAccessTime || session.lastActiveAt || session.updatedAt || session.createdAt || 0;
        if (sessionTime) {
            const date = new Date(sessionTime);
            if (!isNaN(date.getTime())) {
                timeSpan.textContent = manager.formatDate(date);
            }
        }
        footer.appendChild(timeSpan);

        // Action Buttons
        const footerButtonContainer = document.createElement('div');
        footerButtonContainer.className = 'session-action-buttons';

        // Create buttons
        const createBtn = (text, title, onClick) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.title = title;
            btn.className = 'session-footer-btn';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick(e);
            });
            return btn;
        };

            // Edit
            const editBtn = createBtn('编辑', '编辑会话标题', async () => {
                const newTitle = prompt('编辑会话标题', sessionTitle);
                if (newTitle && newTitle.trim()) {
                    try {
                        await manager.renameSession(session.id, newTitle.trim());
                        titleText.textContent = newTitle.trim();
                        manager.showNotification('标题已更新', 'success');
                    } catch (err) {
                        console.error('更新标题失败:', err);
                        manager.showNotification('更新标题失败', 'error');
                    }
                }
            });

            // Tag
            const tagBtn = createBtn('标签', '管理该会话的标签', async () => {
                if (typeof manager.openTagManager === 'function') {
                    await manager.openTagManager(session.id);
                }
            });

            // Duplicate
            const duplicateBtn = createBtn('副本', '创建会话副本', async () => {
                try {
                    await manager.duplicateSession(session.id);
                    await manager.updateSessionSidebar(false, false);
                    manager.showNotification('副本已创建', 'success');
                } catch (err) {
                    console.error('创建副本失败:', err);
                    manager.showNotification('创建副本失败', 'error');
                }
            });

            // Context
            const contextBtn = createBtn('上下文', '查看页面上下文', () => {
                if (typeof manager.showSessionContext === 'function') {
                    manager.showSessionContext(session.id);
                }
            });

            // Open
            const openUrlBtn = createBtn('打开', '在新标签页打开', async () => {
                if (session.url) {
                    try {
                        await manager.openUrl(session.url);
                    } catch (err) {
                        console.error('打开链接失败:', err);
                        manager.showNotification('打开链接失败', 'error');
                    }
                }
            });

            footerButtonContainer.appendChild(editBtn);
            footerButtonContainer.appendChild(tagBtn);
            footerButtonContainer.appendChild(duplicateBtn);
            footerButtonContainer.appendChild(contextBtn);
            footerButtonContainer.appendChild(openUrlBtn);

            footer.appendChild(footerButtonContainer);
            sessionInfo.appendChild(footer);
            contentWrapper.appendChild(sessionInfo);

            return contentWrapper;
        }

        setupLongPress(element) {
            const manager = this.manager;
            const session = this.session;
            
        let longPressTimer = null;
        let longPressProgressTimer = null;
        const longPressThreshold = 800;
        let isLongPressing = false;
        let hasMoved = false;
        let startX = 0;
        let startY = 0;
        let longPressStartTime = 0;
        const moveThreshold = 10;

        const progressBar = document.createElement('div');
        progressBar.className = 'long-press-progress';
        element.appendChild(progressBar);

        const hintText = document.createElement('div');
        hintText.className = 'long-press-hint';
        hintText.textContent = '继续按住以删除';
        element.appendChild(hintText);

        const clearLongPress = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            if (longPressProgressTimer) {
                clearInterval(longPressProgressTimer);
                longPressProgressTimer = null;
            }
            if (isLongPressing) {
                element.classList.remove('long-pressing', 'long-press-start', 'long-press-active');
                progressBar.style.width = '0%';
                isLongPressing = false;
            }
        };

        const startLongPress = (e) => {
            // Ignore right click
                if (e.button === 2) return;
                
                hasMoved = false;
                startX = e.clientX;
                startY = e.clientY;
                longPressStartTime = Date.now();

                clearLongPress();

                longPressTimer = setTimeout(async () => {
                    if (hasMoved) return;
                    
                    isLongPressing = true;
                    element.classList.add('long-press-active');
                    
                    // Trigger delete
                    try {
                        if (confirm(`确定要删除会话 "${manager.getSessionTitle ? manager.getSessionTitle(session) : session.id}" 吗？`)) {
                            await manager.deleteSession(session.id);
                        }
                    } catch (err) {
                        console.error('删除会话失败:', err);
                        manager.showNotification('删除会话失败', 'error');
                    }
                    
                    clearLongPress();
                }, longPressThreshold);

                // Start progress animation
                let progress = 0;
                const interval = 50; // update every 50ms
                longPressProgressTimer = setInterval(() => {
                    if (hasMoved) {
                        clearLongPress();
                        return;
                    }
                    
                    const elapsed = Date.now() - longPressStartTime;
                    progress = Math.min(100, (elapsed / longPressThreshold) * 100);
                    
                    if (progress > 10) { // Show visual feedback after a bit
                        element.classList.add('long-press-start');
                        progressBar.style.width = `${progress}%`;
                    }
                }, interval);
            };

            element.addEventListener('mousedown', startLongPress);
            element.addEventListener('touchstart', (e) => {
                startLongPress(e.touches[0]);
            });

            const onMove = (e) => {
                if (!longPressTimer) return;
                
                const clientX = e.clientX || (e.touches && e.touches[0].clientX);
                const clientY = e.clientY || (e.touches && e.touches[0].clientY);
                
                if (Math.abs(clientX - startX) > moveThreshold || Math.abs(clientY - startY) > moveThreshold) {
                    hasMoved = true;
                    clearLongPress();
                }
            };

            element.addEventListener('mousemove', onMove);
            element.addEventListener('touchmove', onMove);

            const onEnd = () => {
                clearLongPress();
            };

            element.addEventListener('mouseup', onEnd);
            element.addEventListener('mouseleave', onEnd);
            element.addEventListener('touchend', onEnd);
            element.addEventListener('touchcancel', onEnd);
        }
    }

    // Expose to window
    window.PetManager.Components.SessionItem = SessionItem;
})();
