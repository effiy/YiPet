/**
 * ChatMessages Component (YiPetChatMessages)
 * Renders loading/error/empty state or list of chat message items.
 */
(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    function createComponent() {
        const Vue = window.Vue || {};
        const { defineComponent, ref: vueRef, computed, onMounted: vueOnMounted, onUpdated, nextTick, h } = Vue;
        if (typeof defineComponent !== 'function') return null;

        const MessageItem = defineComponent({
            name: 'YiPetMessageItem',
            props: {
                message: { type: Object, required: true },
                index: { type: Number, required: true },
                manager: { type: Object, required: true },
                instance: { type: Object, required: true }
            },
            setup(props) {
                const rootEl = vueRef(null);
                vueOnMounted(() => {
                    if (props.instance && typeof props.instance.addActionButtonsToMessage === 'function' && rootEl.value) {
                        props.instance.addActionButtonsToMessage(rootEl.value);
                    }
                });
                onUpdated(() => {
                    const msg = props.message;
                    const el = rootEl.value;
                    if (!el || !msg) return;
                    if (msg.isWelcome && props.manager && typeof props.manager.bindWelcomeCardEvents === 'function') {
                        const bubble = el.querySelector('[data-message-type="pet-bubble"]');
                        if (bubble) props.manager.bindWelcomeCardEvents(bubble);
                    }
                    if (msg.type === 'pet' && msg.content && props.manager && typeof props.manager.processMermaidBlocks === 'function') {
                        nextTick(() => {
                            const contentDiv = el.querySelector('.pet-chat-content');
                            if (contentDiv && !contentDiv.hasAttribute('data-mermaid-rendered')) {
                                contentDiv.setAttribute('data-mermaid-rendered', 'true');
                                props.manager.processMermaidBlocks(contentDiv).catch(() => {});
                            }
                        });
                    }
                });
                return () => {
                    const msg = props.message;
                    if (!msg) return h('div', { class: 'pet-chat-message' });
                    const isUser = msg.type === 'user';
                    const bubbleType = isUser ? 'user-bubble' : 'pet-bubble';
                    const contentHtml = msg.isWelcome
                        ? (msg.welcomeHtml || '')
                        : (props.manager && typeof props.manager.renderMarkdown === 'function' ? props.manager.renderMarkdown(msg.content || '') : (msg.content || ''));
                    const timeText = props.manager && typeof props.manager.formatTimestamp === 'function'
                        ? props.manager.formatTimestamp(msg.timestamp)
                        : (msg.timestamp ? new Date(msg.timestamp).toISOString() : '');
                    const attrs = {
                        class: ['pet-chat-message', isUser ? 'is-user' : 'is-pet', msg.streaming ? 'is-streaming' : '', msg.error ? 'is-error' : '', msg.aborted ? 'is-aborted' : ''].filter(Boolean).join(' '),
                        'data-chat-timestamp': String(msg.timestamp || ''),
                        'data-chat-type': msg.type || 'pet',
                        'data-chat-idx': String(props.index)
                    };
                    if (msg.isWelcome) attrs['data-welcome-message'] = 'true';
                    return h('div', { ref: rootEl, ...attrs }, [
                        h('div', {
                            class: 'pet-chat-bubble',
                            'data-message-type': bubbleType,
                            'data-original-text': msg.content || ''
                        }, [
                            msg.imageDataUrl
                                ? h('img', { src: msg.imageDataUrl, class: 'pet-chat-image', alt: '图片消息' })
                                : null,
                            contentHtml
                                ? h('div', { class: 'pet-chat-content md-preview-body', innerHTML: contentHtml })
                                : (!msg.isWelcome && !msg.imageDataUrl ? h('div', { class: 'pet-chat-typing', 'aria-label': '生成中' }, '...') : null),
                            h('div', { class: 'pet-chat-meta' }, [
                                h('div', { class: 'pet-chat-meta-actions', 'data-copy-button-container': 'true' }),
                                h('time', { class: 'pet-chat-time', 'data-message-time': 'true', datetime: msg.timestamp ? new Date(msg.timestamp).toISOString() : '' }, timeText)
                            ])
                        ].filter(Boolean))
                    ]);
                };
            }
        });

        const ChatMessages = defineComponent({
            name: 'YiPetChatMessages',
            components: { MessageItem },
            props: {
                instance: { type: Object, required: true },
                manager: { type: Object, required: true }
            },
            setup(props) {
                const viewState = vueRef('empty');
                const viewStatePayload = vueRef(null);
                const messages = vueRef([]);

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

                return () => {
                    const state = viewState.value;
                    if (state === 'loading') {
                        return h('div', { class: 'yi-pet-chat-loading', role: 'status', 'aria-live': 'polite' }, [
                            h('div', { class: 'loading-spinner', 'aria-hidden': 'true' }),
                            h('div', { class: 'loading-text' }, loadingPayload.value)
                        ]);
                    }
                    if (state === 'error') {
                        return h('div', { class: 'yi-pet-chat-error', role: 'alert', 'aria-live': 'polite' }, [
                            h('div', { class: 'error-text' }, errorPayload)
                        ]);
                    }
                    if (state === 'empty') {
                        const p = emptyPayload.value;
                        const title = (p && p.title) || '未选择会话';
                        const subtitle = (p && p.subtitle) || '从左侧会话列表选择一个会话开始聊天';
                        const hint = (p && p.hint) || '';
                        return h('div', { class: 'yi-pet-chat-empty' }, [
                            h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' }, subtitle),
                            h('div', { class: 'pet-chat-empty-card' }, [
                                h('div', { class: 'pet-chat-empty-icon', 'aria-hidden': 'true' }, [h('i', { class: 'fas fa-comments' })]),
                                h('div', { class: 'pet-chat-empty-title' }, title),
                                h('div', { class: 'pet-chat-empty-subtitle' }, subtitle),
                                hint ? h('div', { class: 'pet-chat-empty-hint' }, hint) : null
                            ])
                        ]);
                    }
                    return h('div', { class: 'yi-pet-chat-messages-inner' }, messages.value.map((msg, idx) =>
                        h(MessageItem, { key: `${msg.timestamp || idx}-${idx}`, message: msg, index: idx, manager: props.manager, instance: props.instance })
                    ));
                };
            }
        });

        return ChatMessages;
    }

    window.PetManager.Components.ChatMessages = {
        createComponent
    };
})();
