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
        'src/features/petManager/ui/components/sessionSidebar/SessionSidebar/index.html';

    async function loadTemplate() {
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        return await DomHelper.loadHtmlTemplate(
            SESSION_SIDEBAR_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-session-sidebar-template',
            'Failed to load SessionSidebar template'
        );
    }

    function createSidebarHeaderElement(manager) {
        const header = document.createElement('div');
        header.className = 'session-sidebar-header';

        const SessionSearchModule = window.PetManager?.Components?.SessionSearch;
        const searchRow =
            SessionSearchModule && typeof SessionSearchModule.createSearchElement === 'function'
                ? SessionSearchModule.createSearchElement(manager || {})
                : null;
        if (searchRow) header.appendChild(searchRow);

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

    function createTagFilterFallbackElement() {
        const container = document.createElement('div');
        container.className = 'tag-filter-container';
        const list = document.createElement('div');
        list.className = 'tag-filter-list';
        container.appendChild(list);
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

        const TagFilterModule = window.PetManager?.Components?.TagFilter;
        const tagFilterContainer =
            TagFilterModule && typeof TagFilterModule.createTagFilterElement === 'function'
                ? TagFilterModule.createTagFilterElement(manager || {})
                : createTagFilterFallbackElement();
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

                        const sessionSearchEl = el.querySelector('sessionsearch');
                        if (sessionSearchEl) {
                            const sessionSearchModule = window.PetManager?.Components?.SessionSearch;
                            if (sessionSearchModule && typeof sessionSearchModule.createSearchElement === 'function') {
                                sessionSearchEl.replaceWith(sessionSearchModule.createSearchElement(manager || {}));
                            } else {
                                sessionSearchEl.remove();
                            }
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
