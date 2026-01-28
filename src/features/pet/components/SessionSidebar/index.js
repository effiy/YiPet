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
        const { store, computedProps, methods, manager, template } = params || {};
        const Vue = window.Vue || {};
        const { defineComponent, computed, ref, watch, onMounted, onBeforeUnmount, h } = Vue;
        if (typeof defineComponent !== 'function') return null;
        const resolvedStore = store || createStore(manager || {});
        const resolvedComputedProps = computedProps || useComputed(resolvedStore);
        const resolvedMethods = methods || useMethods({ manager: manager || {}, store: resolvedStore });

        const resolvedTemplate =
            String(template || sessionSidebarTemplateCache || '').trim() ||
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

        return defineComponent({
            name: 'YiPetSessionSidebar',
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
})();
