/**
 * SessionItem Component
 * Handles rendering and interaction for a single session item in the sidebar.
 */
(function () {
    'use strict';

    // Ensure namespace exists
    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const SESSION_ITEM_TEMPLATES_RESOURCE_PATH = 'src/features/petManager/ui/components/sessionSidebar/SessionItem/index.html';
    let sessionItemTemplateCache = null;

    async function loadTemplate() {
        if (sessionItemTemplateCache) return sessionItemTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        const tpl = await DomHelper.loadHtmlTemplate(
            SESSION_ITEM_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-session-item-template',
            'Failed to load SessionItem template'
        );
        sessionItemTemplateCache = tpl;
        return sessionItemTemplateCache;
    }

    function expandHtmlTemplates(root) {
        if (!root || typeof root.querySelector !== 'function') return;
        let tpl = root.querySelector('template');
        while (tpl) {
            const fragment = tpl.content ? tpl.content.cloneNode(true) : document.createDocumentFragment();
            tpl.replaceWith(fragment);
            tpl = root.querySelector('template');
        }
    }

    const hooks = window.PetManager.Components.SessionItemHooks || {};

    const createStore =
        hooks.createStore ||
        function createStore(params) {
            const { manager, session } = params || {};
            const sessionKey = session?.key;
            const sessionTitle = manager?.getSessionTitle ? manager.getSessionTitle(session) : session?.title || '未命名会话';
            const normalizedTags = Array.isArray(session?.tags)
                ? session.tags.map((tag) => (tag ? String(tag).trim() : '')).filter((tag) => tag.length > 0)
                : [];
            const sessionTime = session?.lastAccessTime || session?.lastActiveAt || session?.updatedAt || session?.createdAt || 0;

            return {
                sessionKey,
                sessionTitle,
                normalizedTags,
                sessionTime
            };
        };

    const useComputed =
        hooks.useComputed ||
        function useComputed(params) {
            const { manager, store } = params || {};
            const sessionKey = store?.sessionKey;
            const isSelected = !!sessionKey && manager?.currentSessionId === sessionKey;
            const isBatchSelected = !!sessionKey && !!manager?.selectedSessionIds?.has?.(sessionKey);
            const showCheckbox = !!manager?.batchMode;
            const showFavorite = !manager?.batchMode;
            const showActions = !manager?.batchMode;

            return {
                isSelected,
                isBatchSelected,
                showCheckbox,
                showFavorite,
                showActions
            };
        };

    const useMethods =
        hooks.useMethods ||
        function useMethods(params) {
            const { session, store } = params || {};
            const resolvedStore = store || {};

            const getSessionKey = () => resolvedStore?.sessionKey || session?.key;

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

            return {
                getSessionKey,
                createFooterButton
            };
        };

    class SessionItem {
        constructor(manager, session, options) {
            this.manager = manager;
            this.session = session;
            this.options = options || {};
            this.store = createStore({ manager, session });
            this.computedProps = useComputed({ manager, session, store: this.store });
            this.methods = useMethods({ manager, session, store: this.store, computedProps: this.computedProps });
            this.element = this.create();
        }

        create() {
            const session = this.session;
            const manager = this.manager;

            const sessionItem = document.createElement('div');
            sessionItem.className = 'session-item';
            // 只使用 key 作为会话标识符（与后端保持一致）
            const sessionKey = this.store?.sessionKey || this.methods.getSessionKey();
            if (!sessionKey) {
                console.warn('会话缺少 key 字段:', session);
                return sessionItem; // 返回空元素，避免错误
            }
            sessionItem.dataset.sessionId = sessionKey;

            // Selected state - 检查 currentSessionId 是否匹配 key
            if (this.computedProps?.isSelected) {
                sessionItem.classList.add('active');
            }

            const itemInner = document.createElement('div');
            itemInner.className = 'session-item-inner';

            // Content (checkbox will be added inside title group when in batch mode)
            const contentWrapper = this.createContent(sessionItem);
            itemInner.appendChild(contentWrapper);

            sessionItem.appendChild(itemInner);

            // Long press logic
            if (typeof this.methods.setupLongPress === 'function') {
                this.methods.setupLongPress(sessionItem);
            }

            // Click handler (activate session)
            sessionItem.addEventListener('click', async (e) => {
                if (typeof this.methods.handleClick === 'function') {
                    await this.methods.handleClick(sessionItem, e);
                }
            });

            // Context menu
            sessionItem.addEventListener('contextmenu', (e) => {
                if (typeof this.methods.handleContextMenu === 'function') {
                    this.methods.handleContextMenu(e);
                    return;
                }
                e.preventDefault();
                manager.showSessionContext(e, session);
            });

            return sessionItem;
        }

        createContent(sessionItem) {
            const template = String((this.options && this.options.template) || sessionItemTemplateCache || '').trim();
            const contentWrapper = template ? this.createContentFromTemplate(sessionItem, template) : null;
            if (contentWrapper) return contentWrapper;

            const fallback = document.createElement('div');
            fallback.className = 'session-item-content';
            return fallback;
        }

        createContentFromTemplate(sessionItem, template) {
            const session = this.session;
            const manager = this.manager;

            const wrapper = document.createElement('div');
            wrapper.innerHTML = String(template || '').trim();
            expandHtmlTemplates(wrapper);
            const contentWrapper = wrapper.firstElementChild;
            if (!contentWrapper) return null;

            const titleGroup =
                contentWrapper.querySelector('.js-title-group') || contentWrapper.querySelector('.session-item-title-group');
            const titleText = contentWrapper.querySelector('.js-title-text') || contentWrapper.querySelector('.session-title-text');
            const favoriteSlot = contentWrapper.querySelector('.js-favorite-slot');
            const tagsContainer = contentWrapper.querySelector('.js-tags') || contentWrapper.querySelector('.session-item-tags');
            const timeSpan = contentWrapper.querySelector('.js-time') || contentWrapper.querySelector('.session-item-time');
            const footerButtonContainer =
                contentWrapper.querySelector('.js-action-buttons') || contentWrapper.querySelector('.session-action-buttons');

            if (titleGroup) {
                const existingCheckbox = titleGroup.querySelector('.session-batch-checkbox');
                if (existingCheckbox) existingCheckbox.remove();
            }

            if (titleGroup && this.computedProps?.showCheckbox) {
                const checkbox =
                    typeof this.methods.createCheckbox === 'function' ? this.methods.createCheckbox(sessionItem) : null;
                if (checkbox) {
                    titleGroup.insertBefore(checkbox, titleGroup.firstChild);
                }
            }

            const sessionTitle = this.store?.sessionTitle || (manager.getSessionTitle ? manager.getSessionTitle(session) : session.title || '未命名会话');
            if (titleText) {
                titleText.textContent = sessionTitle;
                titleText.title = sessionTitle;
                if (session.isFavorite) {
                    titleText.classList.add('session-title-text--favorite');
                }
            }

            if (favoriteSlot) {
                favoriteSlot.innerHTML = '';
                if (this.computedProps?.showFavorite) {
                    const favIcon =
                        typeof this.methods.createFavoriteButton === 'function'
                            ? this.methods.createFavoriteButton({ titleText, sessionItem })
                            : null;
                    if (favIcon) favoriteSlot.appendChild(favIcon);
                }
            }

            if (tagsContainer) {
                tagsContainer.innerHTML = '';
                const normalizedTags = Array.isArray(this.store?.normalizedTags) ? this.store.normalizedTags : [];

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
            }

            if (timeSpan) {
                timeSpan.textContent = '';
                const sessionTime = this.store?.sessionTime || 0;
                if (sessionTime) {
                    const date = new Date(sessionTime);
                    if (!isNaN(date.getTime()) && typeof manager.formatDate === 'function') {
                        timeSpan.textContent = manager.formatDate(date);
                    }
                }
            }

            if (footerButtonContainer) {
                footerButtonContainer.classList.add('session-action-buttons');
                if (!this.computedProps?.showActions) {
                    footerButtonContainer.classList.add('js-hidden');
                } else {
                    footerButtonContainer.classList.remove('js-hidden');
                }

                const bindAction = (selector, handler) => {
                    const btn = footerButtonContainer.querySelector(selector);
                    if (!btn) return;
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await handler(e);
                    });
                };

                bindAction('.session-edit-btn', async () => {
                    const sessionKey = this.methods.getSessionKey();
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

                bindAction('.session-tag-btn', async () => {
                    const sessionKey = this.methods.getSessionKey();
                    if (!sessionKey) {
                        console.warn('会话缺少 key 字段，无法管理标签:', session);
                        manager.showNotification('无法管理标签：会话缺少标识符', 'error');
                        return;
                    }
                    if (typeof manager.openTagManager === 'function') {
                        await manager.openTagManager(sessionKey);
                    }
                });

                bindAction('.session-duplicate-btn', async () => {
                    const sessionKey = this.methods.getSessionKey();
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

                bindAction('.session-context-btn', async () => {
                    const sessionKey = this.methods.getSessionKey();
                    if (!sessionKey) {
                        console.warn('会话缺少 key 字段，无法显示上下文:', session);
                        manager.showNotification('无法显示上下文：会话缺少标识符', 'error');
                        return;
                    }
                    if (typeof manager.showSessionContext === 'function') {
                        manager.showSessionContext(sessionKey);
                    }
                });
            }

            return contentWrapper;
        }
    }

    SessionItem.createComponent = function createComponent(params) {
        const manager = params?.manager;
        const bumpUiTick = typeof params?.bumpUiTick === 'function' ? params.bumpUiTick : null;
        const template = params?.template;
        const { defineComponent, computed } = window.Vue || {};
        if (typeof defineComponent !== 'function' || typeof computed !== 'function') return null;

        const contentTemplate = String(template || sessionItemTemplateCache || '').trim() || '<div class="session-item-content"></div>';
        const resolvedTemplate = `<div class="session-item" :class="{ active: isSelected, 'batch-selected': isBatchSelected }" :data-session-id="sessionKey || ''" @click="onRootClick" @contextmenu="onContextMenu"><div class="session-item-inner">${contentTemplate}</div></div>`;

        return defineComponent({
            name: 'YiPetSessionItem',
            props: {
                session: { type: Object, required: true },
                uiTick: { type: Number, required: true }
            },
            setup(props) {
                const getSessionKey = () => props.session?.key;

                const sessionKey = computed(() => {
                    props.uiTick;
                    return getSessionKey();
                });

                const sessionTitle = computed(() => {
                    props.uiTick;
                    return manager?.getSessionTitle ? manager.getSessionTitle(props.session) : props.session?.title || '未命名会话';
                });

                const tags = computed(() => {
                    props.uiTick;
                    const rawTags = Array.isArray(props.session?.tags) ? props.session.tags : [];
                    return rawTags.map((t) => (t ? String(t).trim() : '')).filter((t) => t.length > 0);
                });

                const sessionTime = computed(() => {
                    props.uiTick;
                    return props.session?.lastAccessTime || props.session?.lastActiveAt || props.session?.updatedAt || props.session?.createdAt || 0;
                });

                const timeText = computed(() => {
                    const ts = sessionTime.value || 0;
                    if (!ts) return '';
                    const date = new Date(ts);
                    if (isNaN(date.getTime())) return '';
                    if (typeof manager?.formatDate === 'function') return manager.formatDate(date);
                    return date.toLocaleString();
                });

                const sessionIsFavorite = computed(() => {
                    props.uiTick;
                    return !!props.session?.isFavorite;
                });

                const isSelected = computed(() => {
                    props.uiTick;
                    const key = getSessionKey();
                    return !!key && manager?.currentSessionId === key;
                });

                const isBatchSelected = computed(() => {
                    props.uiTick;
                    const key = getSessionKey();
                    return !!key && !!manager?.selectedSessionIds?.has?.(key);
                });

                const showCheckbox = computed(() => {
                    props.uiTick;
                    return !!manager?.batchMode;
                });

                const showFavorite = computed(() => {
                    props.uiTick;
                    return !manager?.batchMode;
                });

                const showActions = computed(() => {
                    props.uiTick;
                    return !manager?.batchMode;
                });

                const shouldIgnoreClickTarget = (target) => {
                    return (
                        !!target?.closest?.('.session-batch-checkbox') ||
                        !!target?.closest?.('.session-favorite-btn') ||
                        !!target?.closest?.('button') ||
                        !!target?.closest?.('.session-tag-item')
                    );
                };

                const toggleBatchSelection = () => {
                    const sessionKey = getSessionKey();
                    if (!sessionKey) return;
                    if (!manager.selectedSessionIds) manager.selectedSessionIds = new Set();
                    if (manager.selectedSessionIds.has(sessionKey)) {
                        manager.selectedSessionIds.delete(sessionKey);
                    } else {
                        manager.selectedSessionIds.add(sessionKey);
                    }
                    if (typeof manager.updateBatchToolbar === 'function') manager.updateBatchToolbar();
                    if (bumpUiTick) bumpUiTick();
                };

                const onRootClick = async (e) => {
                    if (shouldIgnoreClickTarget(e?.target)) return;

                    if (manager?.isSwitchingSession) {
                        e?.preventDefault?.();
                        e?.stopPropagation?.();
                        return;
                    }

                    if (manager?.batchMode) {
                        e?.preventDefault?.();
                        e?.stopPropagation?.();
                        toggleBatchSelection();
                        return;
                    }

                    const sessionKey = getSessionKey();
                    if (!sessionKey) return;

                    try {
                        if (typeof manager?.switchSession === 'function') {
                            await manager.switchSession(sessionKey);
                        } else if (typeof manager?.activateSession === 'function') {
                            await manager.activateSession(sessionKey);
                        }
                    } finally {
                        if (bumpUiTick) bumpUiTick();
                    }
                };

                const onContextMenu = (e) => {
                    e?.preventDefault?.();
                    if (typeof manager?.showSessionContext === 'function') manager.showSessionContext(e, props.session);
                };

                const onFavoriteClick = async (e) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    const sessionKey = getSessionKey();
                    if (!sessionKey) return;
                    const newVal = !props.session?.isFavorite;
                    try {
                        await manager?.setSessionFavorite?.(sessionKey, newVal);
                        props.session.isFavorite = newVal;
                        if (typeof manager?.updateSessionSidebar === 'function') {
                            await manager.updateSessionSidebar(false, false);
                        }
                        manager?.showNotification?.(newVal ? '已收藏会话' : '已取消收藏', 'success');
                    } catch (err) {
                        manager?.showNotification?.('更新收藏状态失败', 'error');
                    } finally {
                        if (bumpUiTick) bumpUiTick();
                    }
                };

                const onEditClick = async (e) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    const sessionKey = getSessionKey();
                    if (!sessionKey) return;
                    if (typeof manager?.editSessionTitle === 'function') await manager.editSessionTitle(sessionKey);
                    if (bumpUiTick) bumpUiTick();
                };

                const onTagClick = async (e) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    const sessionKey = getSessionKey();
                    if (!sessionKey) return;
                    if (typeof manager?.openTagManager === 'function') await manager.openTagManager(sessionKey);
                    if (bumpUiTick) bumpUiTick();
                };

                const onDuplicateClick = async (e) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    const sessionKey = getSessionKey();
                    if (!sessionKey) return;
                    try {
                        await manager?.duplicateSession?.(sessionKey);
                        if (typeof manager?.updateSessionSidebar === 'function') {
                            await manager.updateSessionSidebar(false, false);
                        }
                        manager?.showNotification?.('副本已创建', 'success');
                    } catch (err) {
                        manager?.showNotification?.('创建副本失败', 'error');
                    } finally {
                        if (bumpUiTick) bumpUiTick();
                    }
                };

                const onPageContextClick = (e) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    const sessionKey = getSessionKey();
                    if (!sessionKey) return;
                    if (typeof manager?.showSessionContext === 'function') manager.showSessionContext(sessionKey);
                    if (bumpUiTick) bumpUiTick();
                };

                const getTagStyle = (tag) => {
                    const style = {};
                    if (typeof manager?.getTagColor === 'function') {
                        const tagColor = manager.getTagColor(tag);
                        if (tagColor) {
                            if (tagColor.background) style['--tag-bg'] = tagColor.background;
                            if (tagColor.text) style['--tag-text'] = tagColor.text;
                            if (tagColor.border) style['--tag-border'] = tagColor.border;
                        }
                    }
                    return style;
                };

                return {
                    sessionKey,
                    sessionTitle,
                    tags,
                    timeText,
                    sessionIsFavorite,
                    isSelected,
                    isBatchSelected,
                    showCheckbox,
                    showFavorite,
                    showActions,
                    onRootClick,
                    onContextMenu,
                    toggleBatchSelection,
                    onFavoriteClick,
                    onEditClick,
                    onTagClick,
                    onDuplicateClick,
                    onPageContextClick,
                    getTagStyle
                };
            },
            template: resolvedTemplate
        });
    };

    // Expose to window
    SessionItem.loadTemplate = loadTemplate;
    window.PetManager.Components.SessionItem = SessionItem;
})();
