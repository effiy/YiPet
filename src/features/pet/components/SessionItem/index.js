/**
 * SessionItem Component
 * Handles rendering and interaction for a single session item in the sidebar.
 */
(function () {
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
            // 只使用 key 作为会话标识符（与后端保持一致）
            const sessionKey = session.key;
            if (!sessionKey) {
                console.warn('会话缺少 key 字段:', session);
                return sessionItem; // 返回空元素，避免错误
            }
            sessionItem.dataset.sessionId = sessionKey;

            // Selected state - 检查 currentSessionId 是否匹配 key
            const currentSessionId = manager.currentSessionId;
            if (currentSessionId === sessionKey) {
                sessionItem.classList.add('selected');
            }

            const itemInner = document.createElement('div');
            itemInner.className = 'session-item-inner';

            // Content (checkbox will be added inside title group when in batch mode)
            const contentWrapper = this.createContent(sessionItem);
            itemInner.appendChild(contentWrapper);

            sessionItem.appendChild(itemInner);

            // Long press logic
            this.setupLongPress(sessionItem);

            // Click handler (activate session)
            sessionItem.addEventListener('click', async (e) => {
                // Ignore if clicking checkbox, favorite button, or action buttons
                if (
                    e.target.closest('.session-batch-checkbox') ||
                    e.target.closest('.session-favorite-btn') ||
                    e.target.closest('button') ||
                    e.target.closest('.session-tag-item')
                ) {
                    return;
                }

                if (manager.isSwitchingSession) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                // Batch mode handling - 直接切换选中状态，参考 YiWeb 实现
                if (manager.batchMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleBatchSelection(sessionItem);
                    return;
                }

                // Switch session
                sessionItem.classList.add('clicked');
                sessionItem.style.pointerEvents = 'none';
                try {
                    // 只使用 key 作为会话标识符
                    const sessionKey = session.key;
                    if (!sessionKey) {
                        console.warn('会话缺少 key 字段，无法切换:', session);
                        return;
                    }
                    if (typeof manager.switchSession === 'function') {
                        await manager.switchSession(sessionKey);
                    } else if (typeof manager.activateSession === 'function') {
                        await manager.activateSession(sessionKey);
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

        // 创建复选框（仅在批量模式下显示，位置在标题组内）
        createCheckbox(sessionItem) {
            const manager = this.manager;
            const session = this.session;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'session-batch-checkbox';
            const sessionKey = session.key;
            if (!sessionKey) {
                console.warn('会话缺少 key 字段，无法设置复选框:', session);
                return null;
            }

            // 初始化选中状态
            const isSelected = manager.selectedSessionIds && manager.selectedSessionIds.has(sessionKey);
            checkbox.checked = isSelected;

            // 更新会话项的选中状态类
            if (isSelected) {
                sessionItem.classList.add('batch-selected');
            }

            // 点击复选框时切换选中状态（阻止事件冒泡）
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleBatchSelection(sessionItem);
            });

            return checkbox;
        }

        // 切换批量选中状态（参考 YiWeb 的 handleBatchSelect）
        toggleBatchSelection(sessionItem) {
            const manager = this.manager;
            const session = this.session;
            const sessionKey = session.key;

            if (!sessionKey) {
                console.warn('会话缺少 key 字段，无法切换选中状态:', session);
                return;
            }

            if (!manager.selectedSessionIds) {
                manager.selectedSessionIds = new Set();
            }

            const checkbox = sessionItem.querySelector('.session-batch-checkbox');
            const isCurrentlySelected = manager.selectedSessionIds.has(sessionKey);

            if (isCurrentlySelected) {
                manager.selectedSessionIds.delete(sessionKey);
                sessionItem.classList.remove('batch-selected');
                if (checkbox) checkbox.checked = false;
            } else {
                manager.selectedSessionIds.add(sessionKey);
                sessionItem.classList.add('batch-selected');
                if (checkbox) checkbox.checked = true;
            }

            // 更新批量工具栏
            if (typeof manager.updateBatchToolbar === 'function') {
                manager.updateBatchToolbar();
            }
        }

        createContent(sessionItem) {
            const session = this.session;
            const manager = this.manager;

            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'session-item-content';

            const header = document.createElement('div');
            header.className = 'session-item-header';

            const titleGroup = document.createElement('div');
            titleGroup.className = 'session-item-title-group';

            if (manager.batchMode) {
                const checkbox = this.createCheckbox(sessionItem);
                if (checkbox) {
                    titleGroup.appendChild(checkbox);
                }
            }

            const titleText = document.createElement('span');
            titleText.className = 'session-title-text';
            const sessionTitle = manager.getSessionTitle ? manager.getSessionTitle(session) : session.title || '未命名会话';
            titleText.textContent = sessionTitle;
            titleText.title = sessionTitle;
            if (session.isFavorite) {
                titleText.classList.add('session-title-text--favorite');
            }
            titleGroup.appendChild(titleText);
            header.appendChild(titleGroup);

            let favIcon = null;
            if (!manager.batchMode) {
                favIcon = document.createElement('button');
                favIcon.type = 'button';
                favIcon.className = 'session-favorite-btn';
                favIcon.textContent = session.isFavorite ? '❤️' : '🤍';
                if (session.isFavorite) {
                    favIcon.classList.add('active');
                }
                favIcon.title = session.isFavorite ? '取消收藏' : '收藏';
                favIcon.setAttribute('aria-label', session.isFavorite ? '取消收藏' : '收藏');
                favIcon.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newVal = !session.isFavorite;
                    try {
                        const sessionKey = session.key;
                        if (!sessionKey) {
                            console.warn('会话缺少 key 字段，无法更新收藏状态:', session);
                            return;
                        }
                        await manager.setSessionFavorite(sessionKey, newVal);
                        favIcon.textContent = newVal ? '❤️' : '🤍';
                        if (newVal) {
                            favIcon.classList.add('active');
                            titleText.classList.add('session-title-text--favorite');
                        } else {
                            favIcon.classList.remove('active');
                            titleText.classList.remove('session-title-text--favorite');
                        }
                        favIcon.title = newVal ? '取消收藏' : '收藏';
                        favIcon.setAttribute('aria-label', newVal ? '取消收藏' : '收藏');
                        await manager.updateSessionSidebar(false, false);
                        manager.showNotification(newVal ? '已收藏会话' : '已取消收藏', 'success');
                    } catch (err) {
                        console.error('更新收藏状态失败:', err);
                        manager.showNotification('更新收藏状态失败', 'error');
                    }
                });
                header.appendChild(favIcon);
            }
            contentWrapper.appendChild(header);

            const sessionInfo = document.createElement('div');
            sessionInfo.className = 'session-item-info';

            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'session-item-tags';
            const normalizedTags = Array.isArray(session.tags) ? session.tags.map((tag) => (tag ? tag.trim() : '')).filter((tag) => tag.length > 0) : [];

            if (normalizedTags.length > 0) {
                normalizedTags.forEach((tag) => {
                    const tagElement = document.createElement('span');
                    tagElement.className = 'session-tag-item';
                    tagElement.textContent = tag;
                    if (typeof manager.getTagColor === 'function') {
                        const tagColor = manager.getTagColor(tag);
                        if (tagColor) {
                            if (tagColor.background) tagElement.style.setProperty('--tag-bg', tagColor.background);
                            if (tagColor.text) tagElement.style.setProperty('--tag-text', tagColor.text);
                            if (tagColor.border) tagElement.style.setProperty('--tag-border', tagColor.border);
                        }
                    }
                    tagsContainer.appendChild(tagElement);
                });
            } else {
                const tagElement = document.createElement('span');
                tagElement.className = 'session-tag-item session-tag-no-tags';
                tagElement.textContent = '没有标签';
                tagsContainer.appendChild(tagElement);
            }
            sessionInfo.appendChild(tagsContainer);

            const footer = document.createElement('div');
            footer.className = 'session-item-footer';

            const timeSpan = document.createElement('span');
            timeSpan.className = 'session-item-time';
            const sessionTime = session.lastAccessTime || session.lastActiveAt || session.updatedAt || session.createdAt || 0;
            if (sessionTime) {
                const date = new Date(sessionTime);
                if (!isNaN(date.getTime())) {
                    timeSpan.textContent = manager.formatDate(date);
                }
            }
            footer.appendChild(timeSpan);

            // Action Buttons（批量模式下隐藏，参考 YiWeb 实现）
            const footerButtonContainer = document.createElement('div');
            footerButtonContainer.className = 'session-action-buttons';
            if (manager.batchMode) {
                footerButtonContainer.classList.add('js-hidden');
            }

            const createBtn = (icon, title, className, onClick) => {
                const btn = document.createElement('button');
                btn.innerHTML = icon;
                btn.title = title;
                btn.className = `session-footer-btn ${className}`;
                btn.setAttribute('aria-label', title);
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClick(e);
                });
                return btn;
            };

            const editBtn = createBtn('✏️', '编辑会话', 'session-edit-btn', async () => {
                const sessionKey = session.key;
                if (!sessionKey) {
                    console.warn('会话缺少 key 字段，无法编辑:', session);
                    manager.showNotification('无法编辑：会话缺少标识符', 'error');
                    return;
                }
                if (typeof manager.editSessionTitle === 'function') {
                    await manager.editSessionTitle(sessionKey);
                } else {
                    console.warn('editSessionTitle 方法不存在');
                    manager.showNotification('编辑功能不可用', 'error');
                }
            });

            const tagBtn = createBtn('🏷️', '管理标签', 'session-tag-btn', async () => {
                const sessionKey = session.key;
                if (!sessionKey) {
                    console.warn('会话缺少 key 字段，无法管理标签:', session);
                    manager.showNotification('无法管理标签：会话缺少标识符', 'error');
                    return;
                }
                if (typeof manager.openTagManager === 'function') {
                    await manager.openTagManager(sessionKey);
                }
            });

            const duplicateBtn = createBtn('📋', '创建副本', 'session-duplicate-btn', async () => {
                const sessionKey = session.key;
                if (!sessionKey) {
                    console.warn('会话缺少 key 字段，无法创建副本:', session);
                    manager.showNotification('无法创建副本：会话缺少标识符', 'error');
                    return;
                }
                try {
                    await manager.duplicateSession(sessionKey);
                    await manager.updateSessionSidebar(false, false);
                    manager.showNotification('副本已创建', 'success');
                } catch (err) {
                    console.error('创建副本失败:', err);
                    manager.showNotification('创建副本失败', 'error');
                }
            });

            const contextBtn = createBtn('📝', '页面上下文', 'session-context-btn', () => {
                const sessionKey = session.key;
                if (!sessionKey) {
                    console.warn('会话缺少 key 字段，无法显示上下文:', session);
                    manager.showNotification('无法显示上下文：会话缺少标识符', 'error');
                    return;
                }
                if (typeof manager.showSessionContext === 'function') {
                    manager.showSessionContext(sessionKey);
                }
            });

            footerButtonContainer.appendChild(editBtn);
            footerButtonContainer.appendChild(tagBtn);
            footerButtonContainer.appendChild(duplicateBtn);
            footerButtonContainer.appendChild(contextBtn);

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
                        const sessionKey = session.key;
                        if (!sessionKey) {
                            console.warn('会话缺少 key 字段，无法删除:', session);
                            manager.showNotification('无法删除：会话缺少标识符', 'error');
                            return;
                        }
                        const sessionTitle = manager.getSessionTitle ? manager.getSessionTitle(session) : session.title || '未命名会话';
                        if (confirm(`确定要删除会话 "${sessionTitle}" 吗？`)) {
                            await manager.deleteSession(sessionKey);
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
