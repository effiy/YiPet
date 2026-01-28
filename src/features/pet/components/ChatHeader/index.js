(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const CHAT_HEADER_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/ChatHeader/index.html';
    let chatHeaderTemplatePromise = null;
    let chatHeaderTemplateCache = null;

    function resolveExtensionResourceUrl(relativePath) {
        try {
            if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) return chrome.runtime.getURL(relativePath);
        } catch (_) {}
        return relativePath;
    }

    async function loadTemplate() {
        if (chatHeaderTemplateCache) return chatHeaderTemplateCache;
        if (!chatHeaderTemplatePromise) {
            chatHeaderTemplatePromise = (async () => {
                const url = resolveExtensionResourceUrl(CHAT_HEADER_TEMPLATES_RESOURCE_PATH);
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Failed to load ChatHeader template: ${res.status}`);
                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const el = doc.querySelector('#yi-pet-chat-header-template');
                chatHeaderTemplateCache = el ? el.innerHTML : '';
                return chatHeaderTemplateCache;
            })();
        }
        return chatHeaderTemplatePromise;
    }

    function createComponent(params) {
        const manager = params?.manager;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent } = Vue;
        if (typeof defineComponent !== 'function') return null;

        const fallbackTemplate = `
            <div class="yi-pet-chat-header-inner">
                <div class="yi-pet-chat-header-title" id="yi-pet-chat-header-title">
                    <span style="font-size: 20px;">💕</span>
                    <span id="yi-pet-chat-header-title-text" style="font-weight: 600; font-size: 16px;">与我聊天</span>
                </div>
                <div class="yi-pet-chat-header-buttons">
                    <button id="yi-pet-chat-auth-btn" class="yi-pet-chat-header-btn" aria-label="API 鉴权" title="API 鉴权" @click.stop="onAuthClick">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 4a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1Z" />
                        </svg>
                    </button>
                    <button id="yi-pet-chat-refresh-btn" class="yi-pet-chat-header-btn pet-chat-refresh-btn" aria-label="刷新" title="刷新" @click.stop="onRefreshClick">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 1 0 19 12c0-1.93-.78-3.68-2.05-4.95Z" />
                        </svg>
                    </button>
                </div>
                <button id="sidebar-toggle-btn" class="yi-pet-chat-header-btn sidebar-toggle-btn" aria-label="折叠/展开会话列表" title="折叠会话列表" @click.stop="onSidebarToggleClick">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                    </svg>
                </button>
            </div>
        `;

        const resolvedTemplate = String(template || chatHeaderTemplateCache || '').trim() || fallbackTemplate;

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
