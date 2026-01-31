(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.SessionSidebarHooks) window.PetManager.Components.SessionSidebarHooks = {};

    window.PetManager.Components.SessionSidebarHooks.createStore = function createStore(manager) {
        const { ref } = window.Vue;
        return {
            searchValue: ref((manager && manager.sessionTitleFilter) || '')
        };
    };
})();
