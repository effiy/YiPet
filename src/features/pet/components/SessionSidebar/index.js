(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.SessionSidebar) window.PetManager.Components.SessionSidebar = {};

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
        const { canUseTemplate, template, store, computedProps, methods } = params || {};
        const { defineComponent } = window.Vue;

        if (canUseTemplate && template) {
            return defineComponent({
                name: 'YiPetSessionSidebar',
                setup() {
                    return {
                        searchValue: store.searchValue,
                        clearVisible: computedProps.clearVisible,
                        clearSearch: methods.clearSearch,
                        onSearchInput: methods.onSearchInput,
                        onSearchKeydown: methods.onSearchKeydown,
                        onBatchToggleClick: methods.onBatchToggleClick,
                        onExportClick: methods.onExportClick,
                        onImportClick: methods.onImportClick,
                        onAddClick: methods.onAddClick
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
                                        value: store.searchValue.value,
                                        onInput: methods.onSearchInput,
                                        onKeydown: methods.onSearchKeydown,
                                        onClick: (e) => e?.stopPropagation?.()
                                    }),
                                    h(
                                        'button',
                                        {
                                            class: ['session-search-clear-btn', { visible: computedProps.clearVisible.value }],
                                            type: 'button',
                                            onClick: (e) => {
                                                e?.stopPropagation?.();
                                                methods.clearSearch();
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
                                                methods.onBatchToggleClick();
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
                                                methods.onExportClick();
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
                                                methods.onImportClick();
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
                                                methods.onAddClick();
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
