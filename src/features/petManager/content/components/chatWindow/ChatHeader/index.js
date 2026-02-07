(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const CHAT_HEADER_TEMPLATES_RESOURCE_PATH = 'src/features/petManager/content/components/chatWindow/ChatHeader/index.html';
    let chatHeaderTemplateCache = '';

    function stopEvent(e) {
        e?.stopPropagation?.();
        e?.preventDefault?.();
    }

    function resolveExternalUrl(key, fallbackUrl) {
        const urls = window.PET_CONFIG?.constants?.URLS;
        const value = urls && typeof urls[key] === 'string' ? urls[key] : '';
        return String(value || fallbackUrl || '').trim();
    }

    function openExternal(url) {
        const targetUrl = String(url || '').trim();
        if (!targetUrl) return;
        const newWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
        if (newWindow) {
            try {
                newWindow.opener = null;
            } catch (_) {}
        }
    }

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
                    stopEvent(e);
                    if (typeof manager?.openAuth === 'function') manager.openAuth();
                };

                const onCloseClick = (e) => {
                    stopEvent(e);
                    if (typeof manager?.closeChatWindow === 'function') {
                        manager.closeChatWindow();
                        return;
                    }
                    if (typeof manager?.toggleChatWindowVisibility === 'function') {
                        manager.toggleChatWindowVisibility();
                        return;
                    }
                    const chatWindowElement = document.getElementById('pet-chat-window');
                    if (chatWindowElement) {
                        chatWindowElement.classList.add('js-hidden');
                        chatWindowElement.setAttribute('hidden', '');
                    }
                };

                const onAicrClick = (e) => {
                    stopEvent(e);
                    openExternal(
                        resolveExternalUrl('AICR_REVIEW_PAGE', 'https://effiy.cn/src/views/aicr/index.html')
                    );
                };

                const onNewsClick = (e) => {
                    stopEvent(e);
                    openExternal(
                        resolveExternalUrl('NEWS_ASSISTANT_PAGE', 'https://effiy.cn/src/views/news/index.html')
                    );
                };

                return { onAuthClick, onCloseClick, onAicrClick, onNewsClick };
            },
            template: resolvedTemplate
        });
    }

    window.PetManager.Components.ChatHeader = {
        loadTemplate,
        createComponent
    };
})();
