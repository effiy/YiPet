(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.SessionItemHooks) window.PetManager.Components.SessionItemHooks = {};

    window.PetManager.Components.SessionItemHooks.createStore = function createStore(params) {
        const { manager, session } = params || {};
        const sessionKey = session?.key;
        const sessionTitle = manager?.getSessionTitle ? manager.getSessionTitle(session) : session?.title || '未命名会话';
        const normalizedTags = Array.isArray(session?.tags)
            ? session.tags.map((tag) => (tag ? String(tag).trim() : '')).filter((tag) => tag.length > 0)
            : [];
        const sessionTime = session?.lastAccessTime || session?.lastActiveAt || session?.updatedAt || session?.createdAt || 0;

        return {
            sessionKey,
            sessionTitle,
            normalizedTags,
            sessionTime
        };
    };
})();
