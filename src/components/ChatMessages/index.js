/**
 * ChatMessages Component (YiPetChatMessages)
 * Renders loading/error/empty state or list of chat message items.
 */
(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const CHAT_MESSAGES_TEMPLATES_RESOURCE_PATH = 'src/components/ChatMessages/index.html';
    let chatMessagesTemplateCache = '';

    async function loadTemplate() {
        if (chatMessagesTemplateCache) return chatMessagesTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        chatMessagesTemplateCache = await DomHelper.loadHtmlTemplate(
            CHAT_MESSAGES_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-chat-messages-template',
            'Failed to load ChatMessages template'
        );
        return chatMessagesTemplateCache;
    }

    function createComponent(params) {
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, ref: vueRef, computed, onMounted: vueOnMounted, onUpdated, nextTick } = Vue;
        if (typeof defineComponent !== 'function') return null;

        const resolvedTemplate = String(template || chatMessagesTemplateCache || '').trim();
        if (!resolvedTemplate) return null;

        const ChatMessages = defineComponent({
            name: 'YiPetChatMessages',
            props: {
                instance: { type: Object, required: true },
                manager: { type: Object, required: true }
            },
            setup(props) {
                const viewState = vueRef('empty');
                const viewStatePayload = vueRef(null);
                const messages = vueRef([]);
                const listEl = vueRef(null);

                vueOnMounted(() => {
                    const inst = props.instance;
                    if (!inst) return;
                    inst._setMessagesViewState = (state, payload) => {
                        viewState.value = state;
                        viewStatePayload.value = payload;
                    };
                    inst._messagesSet = (list) => {
                        messages.value = Array.isArray(list) ? [...list] : [];
                        viewState.value = 'messages';
                    };
                    inst._messagesAppend = (msg) => {
                        messages.value.push(msg);
                        viewState.value = 'messages';
                    };
                    inst._messagesUpdateContent = (idx, content) => {
                        if (messages.value[idx]) messages.value[idx].content = content;
                    };
                    inst._messagesSetStreaming = (idx, streaming) => {
                        if (messages.value[idx]) messages.value[idx].streaming = !!streaming;
                    };
                    inst._messagesClear = () => {
                        messages.value = [];
                    };
                    inst._messagesUpdateWelcome = (html) => {
                        if (messages.value.length > 0 && messages.value[0].isWelcome) {
                            messages.value[0].welcomeHtml = html;
                        }
                    };
                    inst._getMessagesList = () => messages.value;
                });

                const loadingPayload = computed(() => viewStatePayload.value ?? '正在加载会话...');
                const errorPayload = computed(() => viewStatePayload.value ?? '发生错误');
                const emptyPayload = computed(() => {
                    const p = viewStatePayload.value;
                    return p && typeof p === 'object' ? p : { title: '未选择会话', subtitle: '从左侧会话列表选择一个会话开始聊天', hint: '也可以在左侧搜索框输入关键词快速定位' };
                });

                const emptyTitle = computed(() => emptyPayload.value?.title || '未选择会话');
                const emptySubtitle = computed(() => emptyPayload.value?.subtitle || '从左侧会话列表选择一个会话开始聊天');
                const emptyHint = computed(() => emptyPayload.value?.hint || '');

                const messageKey = (msg, idx) => `${(msg && msg.timestamp) || idx}-${idx}`;

                const messageClass = (msg) => {
                    if (!msg) return '';
                    const isUser = msg.type === 'user';
                    return [
                        isUser ? 'is-user' : 'is-pet',
                        msg.streaming ? 'is-streaming' : '',
                        msg.error ? 'is-error' : '',
                        msg.aborted ? 'is-aborted' : ''
                    ].filter(Boolean).join(' ');
                };

                const messageIsoTime = (msg) => (msg && msg.timestamp ? new Date(msg.timestamp).toISOString() : '');

                const messageTimeText = (msg) => {
                    if (!msg) return '';
                    if (props.manager && typeof props.manager.formatTimestamp === 'function') return props.manager.formatTimestamp(msg.timestamp);
                    return msg.timestamp ? new Date(msg.timestamp).toISOString() : '';
                };

                const messageHtml = (msg) => {
                    if (!msg) return '';
                    if (msg.isWelcome) return msg.welcomeHtml || '';
                    if (props.manager && typeof props.manager.renderMarkdown === 'function') return props.manager.renderMarkdown(msg.content || '') || '';
                    return msg.content || '';
                };

                const processMessageDom = () => {
                    const container = listEl.value;
                    if (!container) return;
                    const manager = props.manager;
                    const instance = props.instance;

                    const messageEls = Array.from(container.querySelectorAll('.pet-chat-message'));
                    if (instance && typeof instance.addActionButtonsToMessage === 'function') {
                        messageEls.forEach((el) => {
                            try {
                                instance.addActionButtonsToMessage(el);
                            } catch (_) {}
                        });
                    }

                    if (manager && typeof manager.bindWelcomeCardEvents === 'function') {
                        messageEls.forEach((el) => {
                            if (el.getAttribute('data-welcome-message') !== 'true') return;
                            const bubble = el.querySelector('[data-message-type="pet-bubble"]');
                            if (!bubble) return;
                            try {
                                manager.bindWelcomeCardEvents(bubble);
                            } catch (_) {}
                        });
                    }

                    if (manager && typeof manager.processMermaidBlocks === 'function') {
                        messageEls.forEach((el) => {
                            if (el.getAttribute('data-chat-type') !== 'pet') return;
                            const contentDiv = el.querySelector('.pet-chat-content');
                            if (!contentDiv) return;
                            if (contentDiv.hasAttribute('data-mermaid-rendered')) return;
                            contentDiv.setAttribute('data-mermaid-rendered', 'true');
                            manager.processMermaidBlocks(contentDiv).catch(() => {});
                        });
                    }
                };

                vueOnMounted(() => {
                    nextTick(() => processMessageDom());
                });

                onUpdated(() => {
                    nextTick(() => processMessageDom());
                });

                return {
                    viewState,
                    messages,
                    listEl,
                    loadingPayload,
                    errorPayload,
                    emptyTitle,
                    emptySubtitle,
                    emptyHint,
                    messageKey,
                    messageClass,
                    messageHtml,
                    messageIsoTime,
                    messageTimeText
                };
            },
            template: resolvedTemplate
        });

        return ChatMessages;
    }

    window.PetManager.Components.ChatMessages = {
        loadTemplate,
        createComponent
    };
})();
