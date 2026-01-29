(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.ChatWindowHooks) window.PetManager.Components.ChatWindowHooks = {};

    window.PetManager.Components.ChatWindowHooks.useMethods = function useMethods(params) {
        const { manager, instance, store } = params;
        const createSidebarMethods = () => {
            const sidebarHooks = window.PetManager?.Components?.SessionSidebarHooks || {};
            if (typeof sidebarHooks.useMethods === 'function') {
                return sidebarHooks.useMethods({ manager, store });
            }

            let timer = null;

            const clearSearch = () => {
                store.searchValue.value = '';
                manager.sessionTitleFilter = '';
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            };

            const onSearchInput = (e) => {
                store.searchValue.value = e?.target?.value ?? '';
                manager.sessionTitleFilter = (store.searchValue.value || '').trim();
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                }, 300);
            };

            const onSearchKeydown = (e) => {
                if (e?.key === 'Escape') {
                    clearSearch();
                }
            };

            const onBatchToggleClick = () => {
                if (manager.batchMode) {
                    if (typeof manager.exitBatchMode === 'function') manager.exitBatchMode();
                } else {
                    if (typeof manager.enterBatchMode === 'function') manager.enterBatchMode();
                }
            };

            const onExportClick = () => {
                if (typeof manager.exportSessionsToZip === 'function') manager.exportSessionsToZip();
            };

            const onImportClick = () => {
                const DomHelper = window.DomHelper;
                if (!DomHelper || typeof DomHelper.pickFile !== 'function') return;
                DomHelper.pickFile({ accept: '.zip' })
                    .then(async (file) => {
                        if (file && typeof manager.importSessionsFromZip === 'function') {
                            await manager.importSessionsFromZip(file);
                        }
                    })
                    .catch(() => {});
            };

            const onAddClick = () => {
                if (typeof manager.createBlankSession === 'function') manager.createBlankSession();
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

        const sidebarMethods = createSidebarMethods();

        const onAuthClick = (e) => {
            e?.stopPropagation?.();
            e?.preventDefault?.();
            manager.openAuth();
        };

        const onRefreshClick = (e) => {
            e?.stopPropagation?.();
            e?.preventDefault?.();
            manager.manualRefresh(e.currentTarget);
        };

        const onSidebarToggleClick = (e) => {
            e?.stopPropagation?.();
            e?.preventDefault?.();
            if (instance.toggleSidebar) instance.toggleSidebar();
        };

        return {
            ...sidebarMethods,
            onAuthClick,
            onRefreshClick,
            onSidebarToggleClick
        };
    };
})();
