(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.SessionSidebar) window.PetManager.Components.SessionSidebar = {};

    const hooks = window.PetManager.Components.SessionSidebarHooks || {};

    const createStore =
        hooks.createStore ||
        function createStore(manager) {
            const { ref } = window.Vue;
            return {
                searchValue: ref((manager && manager.sessionTitleFilter) || '')
            };
        };

    const useComputed =
        hooks.useComputed ||
        function useComputed(store) {
            const { computed } = window.Vue;
            return {
                clearVisible: computed(() => !!(store?.searchValue?.value || '').trim())
            };
        };

    const useMethods =
        hooks.useMethods ||
        function useMethods(params) {
            const { manager, store } = params || {};
            let timer = null;

            const clearSearch = () => {
                if (store?.searchValue) store.searchValue.value = '';
                if (manager) manager.sessionTitleFilter = '';
                if (typeof manager?.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            };

            const onSearchInput = (e) => {
                if (store?.searchValue) store.searchValue.value = e?.target?.value ?? '';
                if (manager) manager.sessionTitleFilter = (store?.searchValue?.value || '').trim();
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    if (typeof manager?.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                }, 300);
            };

            const onSearchKeydown = (e) => {
                if (e?.key === 'Escape') {
                    clearSearch();
                }
            };

            const onBatchToggleClick = () => {
                if (manager?.batchMode) {
                    if (typeof manager?.exitBatchMode === 'function') manager.exitBatchMode();
                } else {
                    if (typeof manager?.enterBatchMode === 'function') manager.enterBatchMode();
                }
            };

            const onExportClick = () => {
                if (typeof manager?.exportSessionsToZip === 'function') manager.exportSessionsToZip();
            };

            const onImportClick = () => {
                const DomHelper = window.DomHelper;
                if (!DomHelper || typeof DomHelper.pickFile !== 'function') return;
                DomHelper.pickFile({ accept: '.zip' })
                    .then(async (file) => {
                        if (file && typeof manager?.importSessionsFromZip === 'function') {
                            await manager.importSessionsFromZip(file);
                        }
                    })
                    .catch(() => {});
            };

            const onAddClick = () => {
                if (typeof manager?.createBlankSession === 'function') manager.createBlankSession();
            };

            return {
                clearSearch,
                onSearchInput,
                onSearchKeydown,
                onBatchToggleClick,
                onExportClick,
                onImportClick,
                onAddClick
            };
        };

    const SESSION_SIDEBAR_TEMPLATES_RESOURCE_PATH =
        'src/features/petManager/content/components/sessionSidebar/SessionSidebar/index.html';

    async function loadTemplate() {
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        return await DomHelper.loadHtmlTemplate(
            SESSION_SIDEBAR_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-session-sidebar-template',
            'Failed to load SessionSidebar template'
        );
    }

    function createSessionSearchFallbackElement(manager) {
        const row = document.createElement('div');
        row.className = 'session-sidebar-search-row';

        const container = document.createElement('div');
        container.className = 'session-search-container';

        const input = document.createElement('input');
        input.id = 'session-search-input';
        input.className = 'session-search-input';
        input.type = 'text';
        input.placeholder = '搜索会话...';
        input.value = String(manager?.sessionTitleFilter || '');

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'session-search-clear-btn';
        clearBtn.textContent = '✕';
        if (String(manager?.sessionTitleFilter || '').trim()) {
            clearBtn.classList.add('visible');
        }

        container.appendChild(input);
        container.appendChild(clearBtn);
        row.appendChild(container);
        return row;
    }

    function createSidebarHeaderElement(manager) {
        const header = document.createElement('div');
        header.className = 'session-sidebar-header';
        header.appendChild(createSessionSearchFallbackElement(manager || {}));

        return header;
    }

    function createSessionActionsRowElement() {
        const row = document.createElement('div');
        row.className = 'session-sidebar-actions-row';

        const leftGroup = document.createElement('div');
        leftGroup.className = 'session-actions-left-group';

        const batchBtn = document.createElement('button');
        batchBtn.type = 'button';
        batchBtn.className = 'session-action-btn session-action-btn--batch';
        batchBtn.title = '批量选择';
        batchBtn.innerHTML = '☑️ 批量';

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'session-action-btn session-action-btn--export';
        exportBtn.innerHTML = '⬇️ 导出';

        const importBtn = document.createElement('button');
        importBtn.type = 'button';
        importBtn.className = 'session-action-btn session-action-btn--import';
        importBtn.innerHTML = '⬆️ 导入';

        leftGroup.appendChild(batchBtn);
        leftGroup.appendChild(exportBtn);
        leftGroup.appendChild(importBtn);

        const rightGroup = document.createElement('div');
        rightGroup.className = 'session-actions-right-group';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'session-action-btn session-action-btn--add';
        addBtn.innerHTML = '➕ 新建';

        rightGroup.appendChild(addBtn);

        row.appendChild(leftGroup);
        row.appendChild(rightGroup);

        return row;
    }

    function createTagFilterFallbackElement(manager) {
        const container = document.createElement('div');
        container.className = 'tag-filter-container';
        container.setAttribute('data-pet-tag-filter', 'dom');

        const header = document.createElement('div');
        header.className = 'tag-filter-header';

        const searchContainer = document.createElement('div');
        searchContainer.className = 'tag-filter-search-container';

        const input = document.createElement('input');
        input.className = 'tag-filter-search tag-filter-search-input';
        input.type = 'text';
        input.placeholder = '搜索标签...';

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'tag-filter-search-clear';
        clearBtn.title = '清除';
        clearBtn.setAttribute('aria-label', '清除');
        clearBtn.textContent = '✕';

        searchContainer.appendChild(input);
        searchContainer.appendChild(clearBtn);

        const actions = document.createElement('div');
        actions.className = 'tag-filter-actions';

        const reverseBtn = document.createElement('button');
        reverseBtn.type = 'button';
        reverseBtn.className = 'tag-filter-action-btn tag-filter-reverse';
        reverseBtn.title = '反向过滤';
        reverseBtn.setAttribute('aria-label', '反向过滤');
        reverseBtn.textContent = '⇄';

        const noTagsBtn = document.createElement('button');
        noTagsBtn.type = 'button';
        noTagsBtn.className = 'tag-filter-action-btn tag-filter-no-tags';
        noTagsBtn.title = '筛选无标签';
        noTagsBtn.setAttribute('aria-label', '筛选无标签');
        noTagsBtn.textContent = '∅';

        const expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.className = 'tag-filter-action-btn tag-filter-expand';
        expandBtn.title = '展开/收起更多标签';
        expandBtn.setAttribute('aria-label', '展开/收起更多标签');
        expandBtn.textContent = '⋮';

        const clearFiltersBtn = document.createElement('button');
        clearFiltersBtn.type = 'button';
        clearFiltersBtn.className = 'tag-filter-clear-btn';
        clearFiltersBtn.title = '清除筛选';
        clearFiltersBtn.setAttribute('aria-label', '清除筛选');
        clearFiltersBtn.textContent = '×';

        actions.appendChild(reverseBtn);
        actions.appendChild(noTagsBtn);
        actions.appendChild(expandBtn);
        actions.appendChild(clearFiltersBtn);

        header.appendChild(searchContainer);
        header.appendChild(actions);

        const list = document.createElement('div');
        list.className = 'tag-filter-list';

        container.appendChild(header);
        container.appendChild(list);

        const normalizedManager = manager && typeof manager === 'object' ? manager : null;
        const debounce = (fn, wait) => {
            let timer = null;
            return (...args) => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => fn(...args), wait);
            };
        };

        const getAllTags = () => {
            if (typeof normalizedManager?.getAllTags === 'function') {
                const tags = normalizedManager.getAllTags();
                return Array.isArray(tags) ? tags : [];
            }
            return [];
        };

        const getSessions = () => {
            if (typeof normalizedManager?._getSessionsFromLocal === 'function') {
                const sessions = normalizedManager._getSessionsFromLocal();
                return Array.isArray(sessions) ? sessions : [];
            }
            return [];
        };

        const computeCounts = () => {
            const sessions = getSessions();
            const tagCounts = Object.create(null);
            let noTagsCount = 0;

            sessions.forEach((session) => {
                const tags = Array.isArray(session?.tags) ? session.tags.map((t) => String(t ?? '').trim()).filter((t) => t) : [];
                if (!tags.length) {
                    noTagsCount += 1;
                    return;
                }
                tags.forEach((tag) => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            });

            return { tagCounts, noTagsCount };
        };

        const renderList = () => {
            if (!normalizedManager) {
                list.innerHTML = '';
                return;
            }

            if (normalizedManager.selectedFilterTags === undefined) normalizedManager.selectedFilterTags = [];
            if (!Array.isArray(normalizedManager.selectedFilterTags)) normalizedManager.selectedFilterTags = [];

            const selected = normalizedManager.selectedFilterTags;
            const reverse = !!normalizedManager.tagFilterReverse;
            const noTags = !!normalizedManager.tagFilterNoTags;
            const expanded = !!normalizedManager.tagFilterExpanded;
            const visibleCount = typeof normalizedManager.tagFilterVisibleCount === 'number' ? normalizedManager.tagFilterVisibleCount : 8;
            const keyword = String(normalizedManager.tagFilterSearchKeyword || '').trim();
            const keywordLower = keyword.toLowerCase();

            if (input.value !== keyword) input.value = keyword;
            searchContainer.classList.toggle('has-keyword', !!keywordLower);
            clearBtn.classList.toggle('visible', !!keywordLower);
            reverseBtn.classList.toggle('active', reverse);
            noTagsBtn.classList.toggle('active', noTags);
            expandBtn.classList.toggle('active', expanded);
            clearFiltersBtn.classList.toggle('active', !!keywordLower || !!noTags || (selected && selected.length > 0));

            const allTags = getAllTags();
            const filteredTags = keywordLower ? allTags.filter((t) => String(t || '').toLowerCase().includes(keywordLower)) : allTags;
            const tagsToShow = expanded ? filteredTags : filteredTags.slice(0, Math.max(0, visibleCount));
            const remainingCount = Math.max(0, filteredTags.length - Math.max(0, visibleCount));
            const showExpandButton = !keywordLower && !expanded && filteredTags.length > Math.max(0, visibleCount);

            const { tagCounts, noTagsCount } = computeCounts();

            list.innerHTML = '';

            if (noTagsCount > 0) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tag-filter-item tag-no-tags';
                btn.dataset.tagName = '__no_tags__';
                btn.setAttribute('data-tag-name', '__no_tags__');
                btn.title = noTags ? '取消筛选无标签会话' : '筛选没有标签的会话';
                btn.classList.toggle('selected', noTags);
                btn.setAttribute('draggable', 'false');
                btn.textContent = `没有标签 (${noTagsCount})`;
                btn.addEventListener('click', (e) => {
                    e?.stopPropagation?.();
                    normalizedManager.tagFilterNoTags = !normalizedManager.tagFilterNoTags;
                    if (typeof normalizedManager.updateSessionSidebar === 'function') normalizedManager.updateSessionSidebar();
                    renderList();
                });
                list.appendChild(btn);
            }

            tagsToShow.forEach((tag) => {
                const t = String(tag ?? '').trim();
                if (!t) return;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tag-filter-item';
                btn.dataset.tagName = t;
                btn.setAttribute('data-tag-name', t);
                const isSelected = selected.includes(t);
                btn.classList.toggle('selected', isSelected);
                btn.title = isSelected ? '取消选择 | 拖拽调整顺序' : '选择标签 | 拖拽调整顺序';
                btn.setAttribute('draggable', 'true');
                btn.textContent = `${t} (${tagCounts[t] || 0})`;
                btn.addEventListener('click', (e) => {
                    e?.stopPropagation?.();
                    const idx = normalizedManager.selectedFilterTags.indexOf(t);
                    if (idx > -1) normalizedManager.selectedFilterTags.splice(idx, 1);
                    else normalizedManager.selectedFilterTags.push(t);
                    if (typeof normalizedManager.updateSessionSidebar === 'function') normalizedManager.updateSessionSidebar();
                    renderList();
                });

                if (typeof normalizedManager.attachDragHandlersToTag === 'function') {
                    normalizedManager.attachDragHandlersToTag(btn, t, {
                        skipClick: true,
                        skipDomUpdate: true,
                        onAfterReorder: () => {
                            renderList();
                        }
                    });
                }

                list.appendChild(btn);
            });

            if (showExpandButton) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tag-filter-item tag-expand-btn';
                btn.dataset.tagName = '__expand__';
                btn.setAttribute('data-tag-name', '__expand__');
                btn.title = expanded ? '收起标签' : '展开标签';
                btn.setAttribute('draggable', 'false');
                btn.textContent = expanded ? '收起' : `展开 (${remainingCount})`;
                btn.addEventListener('click', (e) => {
                    e?.stopPropagation?.();
                    normalizedManager.tagFilterExpanded = !normalizedManager.tagFilterExpanded;
                    if (typeof normalizedManager.updateSessionSidebar === 'function') normalizedManager.updateSessionSidebar();
                    renderList();
                });
                list.appendChild(btn);
            }
        };

        container._render = renderList;

        const onKeywordInput = debounce((value) => {
            if (!normalizedManager) return;
            normalizedManager.tagFilterSearchKeyword = String(value || '');
            renderList();
        }, 300);

        input.addEventListener('input', (e) => {
            e?.stopPropagation?.();
            onKeywordInput(e?.target?.value ?? '');
        });
        input.addEventListener('click', (e) => e?.stopPropagation?.());
        clearBtn.addEventListener('click', (e) => {
            e?.stopPropagation?.();
            if (!normalizedManager) return;
            normalizedManager.tagFilterSearchKeyword = '';
            renderList();
        });
        reverseBtn.addEventListener('click', (e) => {
            e?.stopPropagation?.();
            if (!normalizedManager) return;
            normalizedManager.tagFilterReverse = !normalizedManager.tagFilterReverse;
            if (typeof normalizedManager.updateSessionSidebar === 'function') normalizedManager.updateSessionSidebar();
            renderList();
        });
        noTagsBtn.addEventListener('click', (e) => {
            e?.stopPropagation?.();
            if (!normalizedManager) return;
            normalizedManager.tagFilterNoTags = !normalizedManager.tagFilterNoTags;
            if (typeof normalizedManager.updateSessionSidebar === 'function') normalizedManager.updateSessionSidebar();
            renderList();
        });
        expandBtn.addEventListener('click', (e) => {
            e?.stopPropagation?.();
            if (!normalizedManager) return;
            normalizedManager.tagFilterExpanded = !normalizedManager.tagFilterExpanded;
            if (typeof normalizedManager.updateSessionSidebar === 'function') normalizedManager.updateSessionSidebar();
            renderList();
        });
        clearFiltersBtn.addEventListener('click', (e) => {
            e?.stopPropagation?.();
            if (!normalizedManager) return;
            normalizedManager.selectedFilterTags = [];
            normalizedManager.tagFilterNoTags = false;
            normalizedManager.tagFilterSearchKeyword = '';
            normalizedManager.tagFilterExpanded = false;
            if (typeof normalizedManager.updateSessionSidebar === 'function') normalizedManager.updateSessionSidebar();
            renderList();
        });

        renderList();

        return container;
    }

    function createBatchToolbarElement(manager) {
        if (manager && typeof manager.buildBatchToolbar === 'function') return manager.buildBatchToolbar();
        const toolbar = document.createElement('div');
        toolbar.id = 'batch-toolbar';
        toolbar.className = 'session-batch-toolbar';
        return toolbar;
    }

    function createSidebarScrollableContentElement(manager) {
        const scrollableContent = document.createElement('div');
        scrollableContent.className = 'session-sidebar-scrollable-content';

        const tagFilterContainer = createTagFilterFallbackElement(manager);
        if (tagFilterContainer) scrollableContent.appendChild(tagFilterContainer);

        scrollableContent.appendChild(createSessionActionsRowElement());
        scrollableContent.appendChild(createBatchToolbarElement(manager));

        const sessionList = document.createElement('div');
        sessionList.className = 'session-list';
        sessionList.id = 'session-list';
        scrollableContent.appendChild(sessionList);

        return scrollableContent;
    }

    function createSidebarElement(manager) {
        const sidebar = document.createElement('div');
        sidebar.className = 'session-sidebar';
        sidebar.appendChild(createSidebarHeaderElement(manager));
        sidebar.appendChild(createSidebarScrollableContentElement(manager));
        return sidebar;
    }

    function createComponent(params) {
        const { store, computedProps, methods, manager, template, SessionSearch, TagFilter, BatchToolbar } = params || {};
        const Vue = window.Vue || {};
        const { defineComponent, computed, ref, watch, onMounted, onBeforeUnmount, h } = Vue;
        if (typeof defineComponent !== 'function') return null;
        const resolvedStore = store || createStore(manager || {});
        const resolvedComputedProps = computedProps || useComputed(resolvedStore);
        const resolvedMethods = methods || useMethods({ manager: manager || {}, store: resolvedStore });

        const resolvedTemplate =
            String(template || '').trim() ||
            '<div><div class="session-sidebar-header"></div><div class="session-sidebar-scrollable-content"><div id="yi-pet-tag-filter-mount"></div><div id="yi-pet-batch-toolbar-mount"></div><div class="session-list" id="session-list"></div></div></div>';

        const evalAllowed = (() => {
            try {
                Function('return 1')();
                return true;
            } catch (_) {
                return false;
            }
        })();
        const canUseTemplate = typeof Vue?.compile === 'function' && evalAllowed;

        if (!canUseTemplate || typeof h !== 'function' || typeof ref !== 'function') {
            return defineComponent({
                name: 'YiPetSessionSidebar',
                props: {
                    uiTick: { type: Number, required: true }
                },
                setup() {
                    const rootEl = ref(null);
                    const cleanups = [];

                    const getClearVisible = () => {
                        const v = resolvedComputedProps?.clearVisible;
                        if (v && typeof v === 'object' && 'value' in v) return !!v.value;
                        return !!v;
                    };

                    const bind = (el, eventName, handler, options) => {
                        if (!el || typeof el.addEventListener !== 'function') return;
                        el.addEventListener(eventName, handler, options);
                        cleanups.push(() => {
                            try {
                                el.removeEventListener(eventName, handler, options);
                            } catch (_) {}
                        });
                    };

                    onMounted(() => {
                        const el = rootEl.value;
                        if (!el) return;
                        el.innerHTML = resolvedTemplate;

                        while (true) {
                            const sessionSearchEl = el.querySelector('sessionsearch');
                            if (!sessionSearchEl) break;
                            sessionSearchEl.replaceWith(createSessionSearchFallbackElement(manager || {}));
                        }

                        const searchInput = el.querySelector('#session-search-input');
                        const clearBtn = el.querySelector('.session-search-clear-btn');
                        const batchBtn = el.querySelector('.session-action-btn--batch');
                        const exportBtn = el.querySelector('.session-action-btn--export');
                        const importBtn = el.querySelector('.session-action-btn--import');
                        const addBtn = el.querySelector('.session-action-btn--add');

                        const updateClearBtn = () => {
                            if (!clearBtn) return;
                            clearBtn.classList.toggle('visible', getClearVisible());
                        };

                        if (searchInput) {
                            searchInput.value = String(resolvedStore?.searchValue?.value || '');
                            bind(searchInput, 'input', (e) => resolvedMethods?.onSearchInput?.(e));
                            bind(searchInput, 'keydown', (e) => resolvedMethods?.onSearchKeydown?.(e));
                            bind(searchInput, 'click', (e) => e?.stopPropagation?.());
                        }

                        if (clearBtn) {
                            bind(clearBtn, 'click', (e) => {
                                e?.stopPropagation?.();
                                resolvedMethods?.clearSearch?.();
                            });
                        }

                        bind(batchBtn, 'click', (e) => {
                            e?.stopPropagation?.();
                            resolvedMethods?.onBatchToggleClick?.();
                        });
                        bind(exportBtn, 'click', (e) => {
                            e?.stopPropagation?.();
                            resolvedMethods?.onExportClick?.();
                        });
                        bind(importBtn, 'click', (e) => {
                            e?.stopPropagation?.();
                            resolvedMethods?.onImportClick?.();
                        });
                        bind(addBtn, 'click', (e) => {
                            e?.stopPropagation?.();
                            resolvedMethods?.onAddClick?.();
                        });

                        updateClearBtn();

                        if (typeof watch === 'function') {
                            const stop = watch(
                                () => String(resolvedStore?.searchValue?.value || ''),
                                (v) => {
                                    if (searchInput && searchInput.value !== v) searchInput.value = v;
                                    updateClearBtn();
                                },
                                { immediate: true }
                            );
                            if (typeof stop === 'function') cleanups.push(stop);
                        }
                    });

                    onBeforeUnmount(() => {
                        while (cleanups.length) {
                            const fn = cleanups.pop();
                            try {
                                fn && fn();
                            } catch (_) {}
                        }
                    });

                    return () => h('div', { ref: rootEl });
                }
            });
        }

        const SessionSearchComponent =
            SessionSearch ||
            defineComponent({
                name: 'YiPetSessionSearchStub',
                props: { uiTick: { type: Number, required: true } },
                template: '<div></div>'
            });

        const TagFilterComponent =
            TagFilter ||
            defineComponent({
                name: 'YiPetTagFilterStub',
                props: { uiTick: { type: Number, required: true } },
                template: '<div class="tag-filter-container"></div>'
            });
        const BatchToolbarComponent =
            BatchToolbar ||
            defineComponent({
                name: 'YiPetBatchToolbarStub',
                props: { uiTick: { type: Number, required: true } },
                template: '<div id="batch-toolbar" class="session-batch-toolbar"></div>'
            });

        return defineComponent({
            name: 'YiPetSessionSidebar',
            components: { SessionSearch: SessionSearchComponent, TagFilter: TagFilterComponent, BatchToolbar: BatchToolbarComponent },
            props: {
                uiTick: { type: Number, required: true }
            },
            setup() {
                const clearVisible = typeof computed === 'function'
                    ? computed(() => {
                          const v = resolvedComputedProps?.clearVisible;
                          if (v && typeof v === 'object' && 'value' in v) return !!v.value;
                          return !!v;
                      })
                    : resolvedComputedProps?.clearVisible;

                const searchValue =
                    typeof computed === 'function'
                        ? computed(() => resolvedStore?.searchValue?.value || '')
                        : resolvedStore?.searchValue?.value || '';

                return {
                    searchValue,
                    clearVisible,
                    clearSearch: resolvedMethods?.clearSearch,
                    onSearchInput: resolvedMethods?.onSearchInput,
                    onSearchKeydown: resolvedMethods?.onSearchKeydown,
                    onBatchToggleClick: resolvedMethods?.onBatchToggleClick,
                    onExportClick: resolvedMethods?.onExportClick,
                    onImportClick: resolvedMethods?.onImportClick,
                    onAddClick: resolvedMethods?.onAddClick
                };
            },
            template: resolvedTemplate
        });
    }

    window.PetManager.Components.SessionSidebar.loadTemplate = loadTemplate;
    window.PetManager.Components.SessionSidebar.createComponent = createComponent;
    window.PetManager.Components.SessionSidebar.createSidebarElement = createSidebarElement;
    window.PetManager.Components.SessionSidebar.createSidebarHeaderElement = createSidebarHeaderElement;
    window.PetManager.Components.SessionSidebar.createSidebarScrollableContentElement = createSidebarScrollableContentElement;
    window.PetManager.Components.SessionSidebar.createSessionActionsRowElement = createSessionActionsRowElement;
    window.PetManager.Components.SessionSidebar.createBatchToolbarElement = createBatchToolbarElement;
    window.PetManager.Components.SessionSidebar.createTagFilterFallbackElement = createTagFilterFallbackElement;
})();
