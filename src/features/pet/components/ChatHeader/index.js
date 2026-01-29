(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const CHAT_HEADER_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/ChatHeader/index.html';

    async function loadTemplate() {
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        return await DomHelper.loadHtmlTemplate(
            CHAT_HEADER_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-chat-header-template',
            'Failed to load ChatHeader template'
        );
    }

    function createComponent(params) {
        const manager = params?.manager;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent } = Vue;
        if (typeof defineComponent !== 'function') return null;

        const fallbackTemplate = `
            <div class="yi-pet-chat-header" title="拖拽移动窗口 | 双击全屏" style="position: relative">
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
            </div>
        `;

        const resolvedTemplate = String(template || '').trim() || fallbackTemplate;

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

    /**
     * 创建 fallback 模式下的 header DOM（无 Vue 时使用）
     * @param {Object} manager - PetManager 实例
     * @param {Object} chatWindowInstance - ChatWindow 实例（用于 toggleSidebar、updateSidebarToggleButton）
     * @returns {HTMLElement}
     */
    function createHeaderElement(manager, chatWindowInstance) {
        const chatHeader = document.createElement('div');
        chatHeader.className = 'yi-pet-chat-header';
        chatHeader.title = '拖拽移动窗口 | 双击全屏';
        chatHeader.style.position = 'relative';

        const headerTitle = document.createElement('div');
        headerTitle.className = 'yi-pet-chat-header-title';
        headerTitle.id = 'yi-pet-chat-header-title';
        headerTitle.innerHTML = `
            <span style="font-size: 20px;">💕</span>
            <span id="yi-pet-chat-header-title-text" style="font-weight: 600; font-size: 16px;">与我聊天</span>
        `;

        const headerButtons = document.createElement('div');
        headerButtons.className = 'yi-pet-chat-header-buttons';

        const createBtn = (id, label, path, onClick) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.className = 'yi-pet-chat-header-btn';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
            btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                onClick(e, btn);
            });
            return btn;
        };

        const authBtn = createBtn(
            'yi-pet-chat-auth-btn',
            'API 鉴权',
            '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 4a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1Z"/>',
            () => { if (typeof manager?.openAuth === 'function') manager.openAuth(); }
        );
        const refreshBtn = createBtn(
            'yi-pet-chat-refresh-btn',
            '刷新',
            '<path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 1 0 19 12c0-1.93-.78-3.68-2.05-4.95Z"/>',
            (e, btn) => { if (typeof manager?.manualRefresh === 'function') manager.manualRefresh(btn); }
        );
        refreshBtn.classList.add('pet-chat-refresh-btn');

        headerButtons.appendChild(authBtn);
        headerButtons.appendChild(refreshBtn);

        chatHeader.appendChild(headerTitle);
        chatHeader.appendChild(headerButtons);

        const sidebarToggleBtn = document.createElement('button');
        sidebarToggleBtn.id = 'sidebar-toggle-btn';
        sidebarToggleBtn.className = 'yi-pet-chat-header-btn sidebar-toggle-btn';
        sidebarToggleBtn.setAttribute('aria-label', '折叠/展开会话列表');
        sidebarToggleBtn.setAttribute('title', '折叠会话列表');
        sidebarToggleBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
        sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (chatWindowInstance?.toggleSidebar) chatWindowInstance.toggleSidebar();
        });
        chatHeader.appendChild(sidebarToggleBtn);

        if (chatWindowInstance?.updateSidebarToggleButton && manager) {
            requestAnimationFrame(() => {
                chatWindowInstance.updateSidebarToggleButton(manager.sidebarCollapsed || false);
            });
        }

        return chatHeader;
    }

    window.PetManager.Components.ChatHeader = {
        loadTemplate,
        createComponent,
        createHeaderElement
    };
})();
