(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.ChatWindowHooks) window.PetManager.Components.ChatWindowHooks = {};

    window.PetManager.Components.ChatWindowHooks.createStore = function createStore(manager) {
        const { ref } = window.Vue;
        return {
            searchValue: ref(manager.sessionTitleFilter || '')
        };
    };
})();
