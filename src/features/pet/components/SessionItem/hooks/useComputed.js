(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.SessionItemHooks) window.PetManager.Components.SessionItemHooks = {};

    window.PetManager.Components.SessionItemHooks.useComputed = function useComputed(params) {
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
})();
