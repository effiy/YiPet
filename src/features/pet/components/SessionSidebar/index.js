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
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.zip';
                fileInput.className = 'js-hidden';
                fileInput.addEventListener('change', async (e) => {
                    const file = e?.target?.files?.[0];
                    if (file && typeof manager?.importSessionsFromZip === 'function') {
                        await manager.importSessionsFromZip(file);
                    }
                });
                document.body.appendChild(fileInput);
                fileInput.click();
                document.body.removeChild(fileInput);
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

    const SESSION_SIDEBAR_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/SessionSidebar/index.html';
    let sessionSidebarTemplatePromise = null;
    let sessionSidebarTemplateCache = null;

    function resolveExtensionResourceUrl(relativePath) {
        try {
            if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) return chrome.runtime.getURL(relativePath);
        } catch (_) {}
        return relativePath;
    }

    async function loadTemplate() {
        if (sessionSidebarTemplateCache) return sessionSidebarTemplateCache;
        if (!sessionSidebarTemplatePromise) {
            sessionSidebarTemplatePromise = (async () => {
                const url = resolveExtensionResourceUrl(SESSION_SIDEBAR_TEMPLATES_RESOURCE_PATH);
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Failed to load SessionSidebar template: ${res.status}`);

                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const sessionSidebarEl = doc.querySelector('#yi-pet-session-sidebar-template');
                sessionSidebarTemplateCache = sessionSidebarEl ? sessionSidebarEl.innerHTML : '';
                return sessionSidebarTemplateCache;
            })();
        }
        return sessionSidebarTemplatePromise;
    }

    function createComponent(params) {
        const { canUseTemplate, template, store, computedProps, methods, manager } = params || {};
        const { defineComponent } = window.Vue;
        const resolvedStore = store || createStore(manager || {});
        const resolvedComputedProps = computedProps || useComputed(resolvedStore);
        const resolvedMethods = methods || useMethods({ manager: manager || {}, store: resolvedStore });

        if (canUseTemplate && template) {
            return defineComponent({
                name: 'YiPetSessionSidebar',
                setup() {
                    return {
                        searchValue: resolvedStore.searchValue,
                        clearVisible: resolvedComputedProps.clearVisible,
                        clearSearch: resolvedMethods.clearSearch,
                        onSearchInput: resolvedMethods.onSearchInput,
                        onSearchKeydown: resolvedMethods.onSearchKeydown,
                        onBatchToggleClick: resolvedMethods.onBatchToggleClick,
                        onExportClick: resolvedMethods.onExportClick,
                        onImportClick: resolvedMethods.onImportClick,
                        onAddClick: resolvedMethods.onAddClick
                    };
                },
                template
            });
        }

        const { h, Fragment } = window.Vue;
        return defineComponent({
            name: 'YiPetSessionSidebar',
            setup() {
                return () =>
                    h(Fragment, null, [
                        h('div', { class: 'session-sidebar-header' }, [
                            h('div', { class: 'session-sidebar-search-row' }, [
                                h('div', { class: 'session-search-container' }, [
                                    h('input', {
                                        id: 'session-search-input',
                                        class: 'session-search-input',
                                        type: 'text',
                                        placeholder: '搜索会话...',
                                        value: resolvedStore.searchValue.value,
                                        onInput: resolvedMethods.onSearchInput,
                                        onKeydown: resolvedMethods.onSearchKeydown,
                                        onClick: (e) => e?.stopPropagation?.()
                                    }),
                                    h(
                                        'button',
                                        {
                                            class: ['session-search-clear-btn', { visible: resolvedComputedProps.clearVisible.value }],
                                            type: 'button',
                                            onClick: (e) => {
                                                e?.stopPropagation?.();
                                                resolvedMethods.clearSearch();
                                            }
                                        },
                                        '✕'
                                    )
                                ])
                            ])
                        ]),
                        h('div', { class: 'session-sidebar-scrollable-content' }, [
                            h('div', { id: 'yi-pet-tag-filter-mount' }),
                            h('div', { class: 'session-sidebar-actions-row' }, [
                                h('div', { class: 'session-actions-left-group' }, [
                                    h(
                                        'button',
                                        {
                                            type: 'button',
                                            class: ['session-action-btn', 'session-action-btn--batch'],
                                            title: '批量选择',
                                            onClick: (e) => {
                                                e?.stopPropagation?.();
                                                resolvedMethods.onBatchToggleClick();
                                            }
                                        },
                                        '☑️ 批量'
                                    ),
                                    h(
                                        'button',
                                        {
                                            type: 'button',
                                            class: ['session-action-btn', 'session-action-btn--export'],
                                            onClick: (e) => {
                                                e?.stopPropagation?.();
                                                resolvedMethods.onExportClick();
                                            }
                                        },
                                        '⬇️ 导出'
                                    ),
                                    h(
                                        'button',
                                        {
                                            type: 'button',
                                            class: ['session-action-btn', 'session-action-btn--import'],
                                            onClick: (e) => {
                                                e?.stopPropagation?.();
                                                resolvedMethods.onImportClick();
                                            }
                                        },
                                        '⬆️ 导入'
                                    )
                                ]),
                                h('div', { class: 'session-actions-right-group' }, [
                                    h(
                                        'button',
                                        {
                                            type: 'button',
                                            class: ['session-action-btn', 'session-action-btn--add'],
                                            onClick: (e) => {
                                                e?.stopPropagation?.();
                                                resolvedMethods.onAddClick();
                                            }
                                        },
                                        '➕ 新建'
                                    )
                                ])
                            ]),
                            h('div', { id: 'yi-pet-batch-toolbar-mount' }),
                            h('div', { class: 'session-list', id: 'session-list' })
                        ])
                    ]);
            }
        });
    }

    window.PetManager.Components.SessionSidebar.loadTemplate = loadTemplate;
    window.PetManager.Components.SessionSidebar.createComponent = createComponent;
})();
