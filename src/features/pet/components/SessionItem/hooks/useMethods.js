(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.SessionItemHooks) window.PetManager.Components.SessionItemHooks = {};

    window.PetManager.Components.SessionItemHooks.useMethods = function useMethods(params) {
        const { manager, session, store } = params || {};
        const resolvedStore = store || {};

        const getSessionKey = () => resolvedStore?.sessionKey || session?.key;

        const shouldIgnoreClickTarget = (target) => {
            return (
                !!target?.closest?.('.session-batch-checkbox') ||
                !!target?.closest?.('.session-favorite-btn') ||
                !!target?.closest?.('button') ||
                !!target?.closest?.('.session-tag-item')
            );
        };

        const toggleBatchSelection = (sessionItem) => {
            const sessionKey = getSessionKey();
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

            if (typeof manager.updateBatchToolbar === 'function') {
                manager.updateBatchToolbar();
            }
        };

        const createCheckbox = (sessionItem) => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'session-batch-checkbox';

            const sessionKey = getSessionKey();
            if (!sessionKey) {
                console.warn('会话缺少 key 字段，无法设置复选框:', session);
                return null;
            }

            const isSelected = manager.selectedSessionIds && manager.selectedSessionIds.has(sessionKey);
            checkbox.checked = isSelected;

            if (isSelected) {
                sessionItem.classList.add('batch-selected');
            }

            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleBatchSelection(sessionItem);
            });

            return checkbox;
        };

        const createFavoriteButton = (params) => {
            const { titleText } = params || {};
            const favIcon = document.createElement('button');
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
                    const sessionKey = getSessionKey();
                    if (!sessionKey) {
                        console.warn('会话缺少 key 字段，无法更新收藏状态:', session);
                        return;
                    }
                    await manager.setSessionFavorite(sessionKey, newVal);
                    favIcon.textContent = newVal ? '❤️' : '🤍';
                    if (newVal) {
                        favIcon.classList.add('active');
                        titleText?.classList?.add('session-title-text--favorite');
                    } else {
                        favIcon.classList.remove('active');
                        titleText?.classList?.remove('session-title-text--favorite');
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
            return favIcon;
        };

        const createFooterButton = (params) => {
            const { icon, title, className, onClick } = params || {};
            const btn = document.createElement('button');
            btn.innerHTML = icon;
            btn.title = title;
            btn.className = `session-footer-btn ${className}`;
            btn.setAttribute('aria-label', title);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof onClick === 'function') onClick(e);
            });
            return btn;
        };

        const handleClick = async (sessionItem, e) => {
            if (shouldIgnoreClickTarget(e.target)) return;

            if (manager.isSwitchingSession) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (manager.batchMode) {
                e.preventDefault();
                e.stopPropagation();
                toggleBatchSelection(sessionItem);
                return;
            }

            sessionItem.classList.add('clicked');
            sessionItem.style.pointerEvents = 'none';
            try {
                const sessionKey = getSessionKey();
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
        };

        const handleContextMenu = (e) => {
            e.preventDefault();
            manager.showSessionContext(e, session);
        };

        const setupLongPress = (element) => {
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

                    try {
                        const sessionKey = getSessionKey();
                        if (!sessionKey) {
                            console.warn('会话缺少 key 字段，无法删除:', session);
                            manager.showNotification('无法删除：会话缺少标识符', 'error');
                            return;
                        }
                        const sessionTitle =
                            resolvedStore?.sessionTitle ||
                            (manager.getSessionTitle ? manager.getSessionTitle(session) : session.title || '未命名会话');
                        if (confirm(`确定要删除会话 "${sessionTitle}" 吗？`)) {
                            await manager.deleteSession(sessionKey);
                        }
                    } catch (err) {
                        console.error('删除会话失败:', err);
                        manager.showNotification('删除会话失败', 'error');
                    }

                    clearLongPress();
                }, longPressThreshold);

                let progress = 0;
                const interval = 50;
                longPressProgressTimer = setInterval(() => {
                    if (hasMoved) {
                        clearLongPress();
                        return;
                    }

                    const elapsed = Date.now() - longPressStartTime;
                    progress = Math.min(100, (elapsed / longPressThreshold) * 100);

                    if (progress > 10) {
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
        };

        return {
            getSessionKey,
            createCheckbox,
            toggleBatchSelection,
            createFavoriteButton,
            createFooterButton,
            handleClick,
            handleContextMenu,
            setupLongPress
        };
    };
})();
