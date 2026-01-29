(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.SessionSidebarHooks) window.PetManager.Components.SessionSidebarHooks = {};

    window.PetManager.Components.SessionSidebarHooks.useMethods = function useMethods(params) {
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
})();
