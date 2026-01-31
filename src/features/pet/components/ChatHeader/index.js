(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const CHAT_HEADER_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/ChatHeader/index.html';
    let chatHeaderTemplateCache = '';

    async function loadTemplate() {
        if (chatHeaderTemplateCache) return chatHeaderTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        chatHeaderTemplateCache = await DomHelper.loadHtmlTemplate(
            CHAT_HEADER_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-chat-header-template',
            'Failed to load ChatHeader template'
        );
        return chatHeaderTemplateCache;
    }

    function createComponent(params) {
        const manager = params?.manager;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent } = Vue;
        if (typeof defineComponent !== 'function') return null;

        const resolvedTemplate = String(template || chatHeaderTemplateCache || '').trim();
        if (!resolvedTemplate) return null;

        return defineComponent({
            name: 'YiPetChatHeader',
            props: {
                uiTick: { type: Number, required: true }
            },
            setup() {
                const onAuthClick = (e) => {
                    e?.stopPropagation?.();
                    e?.preventDefault?.();
                    if (typeof manager?.openAuth === 'function') manager.openAuth();
                };

                const onRefreshClick = (e) => {
                    e?.stopPropagation?.();
                    e?.preventDefault?.();
                    if (typeof manager?.manualRefresh === 'function') manager.manualRefresh(e?.currentTarget);
                };

                const onSidebarToggleClick = (e) => {
                    e?.stopPropagation?.();
                    e?.preventDefault?.();
                    if (typeof manager?.toggleSidebar === 'function') manager.toggleSidebar();
                };

                return { onAuthClick, onRefreshClick, onSidebarToggleClick };
            },
            template: resolvedTemplate
        });
    }

    window.PetManager.Components.ChatHeader = {
        loadTemplate,
        createComponent
    };
})();
