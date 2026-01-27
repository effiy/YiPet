(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.ChatWindowHooks) window.PetManager.Components.ChatWindowHooks = {};

    window.PetManager.Components.ChatWindowHooks.useMethods = function useMethods(params) {
        const { manager, instance, store } = params;
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
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.zip';
            fileInput.className = 'js-hidden';
            fileInput.addEventListener('change', async (e) => {
                const file = e?.target?.files?.[0];
                if (file && typeof manager.importSessionsFromZip === 'function') {
                    await manager.importSessionsFromZip(file);
                }
            });
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        };

        const onAddClick = () => {
            if (typeof manager.createBlankSession === 'function') manager.createBlankSession();
        };

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
            clearSearch,
            onSearchInput,
            onSearchKeydown,
            onBatchToggleClick,
            onExportClick,
            onImportClick,
            onAddClick,
            onAuthClick,
            onRefreshClick,
            onSidebarToggleClick
        };
    };
})();
