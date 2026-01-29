(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const SESSION_LIST_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/SessionList/index.html';

    async function loadTemplate() {
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        return await DomHelper.loadHtmlTemplate(
            SESSION_LIST_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-session-list-template',
            'Failed to load SessionList template'
        );
    }

    function createComponent(params) {
        const SessionItem = params?.SessionItem;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent } = Vue;
        if (typeof defineComponent !== 'function') return null;

        const fallbackTemplate = `
            <div>
                <div v-if="!sessions || sessions.length === 0" class="session-list-empty">暂无会话</div>
                <div v-else class="session-list-items">
                    <SessionItem v-for="session in sessions" :key="sessionKey(session)" :session="session" :uiTick="uiTick" />
                </div>
            </div>
        `;

        const resolvedTemplate = String(template || '').trim() || fallbackTemplate;

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
