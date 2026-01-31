(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.ChatWindowHooks) window.PetManager.Components.ChatWindowHooks = {};

    window.PetManager.Components.ChatWindowHooks.useComputed = function useComputed(store) {
        const { computed } = window.Vue;
        return {
            clearVisible: computed(() => !!(store.searchValue.value || '').trim())
        };
    };
})();
