(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const SESSION_LIST_TEMPLATES_RESOURCE_PATH = 'src/features/petManager/ui/components/sessionSidebar/SessionList/index.html';
    let sessionListTemplateCache = '';

    async function loadTemplate() {
        if (sessionListTemplateCache) return sessionListTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        sessionListTemplateCache = await DomHelper.loadHtmlTemplate(
            SESSION_LIST_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-session-list-template',
            'Failed to load SessionList template'
        );
        return sessionListTemplateCache;
    }

    function createComponent(params) {
        const SessionItem = params?.SessionItem;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent } = Vue;
        if (typeof defineComponent !== 'function') return null;

        const resolvedTemplate = String(template || sessionListTemplateCache || '').trim();
        if (!resolvedTemplate) return null;

        return defineComponent({
            name: 'YiPetSessionList',
            components: { SessionItem },
            props: {
                sessions: { type: Array, required: true },
                uiTick: { type: Number, required: true }
            },
            setup() {
                const sessionKey = (session) => {
                    if (!session) return '';
                    return session.key || session.id || session.title || '';
                };
                return { sessionKey };
            },
            template: resolvedTemplate
        });
    }

    window.PetManager.Components.SessionList = {
        loadTemplate,
        createComponent
    };
})();
