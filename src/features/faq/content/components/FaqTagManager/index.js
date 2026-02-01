(function () {
    'use strict';

    if (!window.PetManager) return;
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const FAQ_TAG_MANAGER_TEMPLATES_RESOURCE_PATH = 'src/features/faq/content/components/FaqTagManager/index.html';
    let faqTagManagerTemplateCache = '';

    function canUseVueTemplate(Vue) {
        if (typeof Vue?.compile !== 'function') return false;
        try {
            Function('return 1')();
            return true;
        } catch (_) {
            return false;
        }
    }

    async function loadTemplate() {
        if (faqTagManagerTemplateCache) return faqTagManagerTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        faqTagManagerTemplateCache = await DomHelper.loadHtmlTemplate(
            FAQ_TAG_MANAGER_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-faq-tag-manager-template',
            'Failed to load FaqTagManager template'
        );
        return faqTagManagerTemplateCache;
    }

    function createComponent(params) {
        const manager = params?.manager;
        const store = params?.store;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, ref, onMounted, nextTick, h } = Vue;
        if (typeof defineComponent !== 'function' || !store) return null;

        const useTemplate = canUseVueTemplate(Vue);
        const resolvedTemplate = useTemplate ? String(template || faqTagManagerTemplateCache || '').trim() : '';
        if (useTemplate && !resolvedTemplate) return null;
        if (!useTemplate) return null;

        const quickTags = ['工具', '开源项目', '家庭', '工作', '娱乐', '文档', '日记'];

        const componentOptions = {
            name: 'YiPetFaqTagManager',
            setup() {
                const tagInputEl = ref(null);

                const focusInput = () => {
                    if (typeof nextTick !== 'function') return;
                    nextTick(() => {
                        try {
                            tagInputEl.value?.focus?.();
                        } catch (_) {}
                    });
                };

                const close = () => {
                    if (typeof manager?.closeFaqTagManager === 'function') manager.closeFaqTagManager();
                };

                const addFromInput = () => {
                    if (typeof manager?.addFaqTagFromInput === 'function') manager.addFaqTagFromInput(store.faqIndex);
                };

                const addQuickTag = (tag) => {
                    if (typeof manager?.addFaqQuickTag === 'function') manager.addFaqQuickTag(store.faqIndex, tag);
                };

                const removeTag = (idx) => {
                    if (typeof manager?.removeFaqTag === 'function') manager.removeFaqTag(store.faqIndex, idx);
                };

                const save = async () => {
                    if (typeof manager?.saveFaqTags === 'function') await manager.saveFaqTags(store.faqIndex);
                };

                const smartGenerate = async (e) => {
                    void e;
                    if (typeof manager?.generateFaqSmartTags === 'function') await manager.generateFaqSmartTags(store.faqIndex);
                };

                const onInputKeydown = (e) => {
                    if (!e || e.key !== 'Enter') return;
                    e.preventDefault();
                    addFromInput();
                };

                onMounted(() => {
                    focusInput();
                });

                if (useTemplate) {
                    return {
                        store,
                        quickTags,
                        tagInputEl,
                        close,
                        addFromInput,
                        addQuickTag,
                        removeTag,
                        save,
                        smartGenerate,
                        onInputKeydown
                    };
                }

                const safeCurrentTags = () => (Array.isArray(store.currentTags) ? store.currentTags : []);

                return () => {
                    const isVisible = !!store.visible;
                    const rootClass = [
                        'pet-faq-tag-manager',
                        'tw-fixed',
                        'tw-inset-0',
                        'tw-bg-black-25',
                        'tw-items-center',
                        'tw-justify-center',
                        'tw-z-modal',
                        isVisible ? 'tw-flex' : 'tw-hidden'
                    ];

                    const quickTagButtons = quickTags.map((tag) =>
                        h(
                            'button',
                            {
                                key: tag,
                                type: 'button',
                                class: [
                                    'faq-tag-manager-quick-tag-btn',
                                    'tw-chip',
                                    safeCurrentTags().includes(tag) ? 'is-selected' : ''
                                ],
                                disabled: safeCurrentTags().includes(tag),
                                onClick: () => addQuickTag(tag)
                            },
                            tag
                        )
                    );

                    const tagChips = safeCurrentTags().map((tag, idx) =>
                        h('div', { key: `${tag}::${idx}`, class: 'faq-tag-chip' }, [
                            h('span', null, tag),
                            h(
                                'button',
                                {
                                    type: 'button',
                                    class: 'faq-tag-chip-remove',
                                    title: '删除标签',
                                    onClick: () => removeTag(idx)
                                },
                                '✕'
                            )
                        ])
                    );

                    return h(
                        'div',
                        {
                            class: rootClass,
                            role: 'dialog',
                            'aria-modal': 'true',
                            'aria-label': '管理标签',
                            onClick: (e) => {
                                if (e?.target === e?.currentTarget) close();
                            }
                        },
                        [
                            h('div', { class: ['tw-bg-white', 'tw-rounded-lg', 'tw-p-4', 'tw-w-full', 'tw-max-w-90', 'tw-max-h-80vh', 'tw-overflow-y-auto', 'tw-shadow'] }, [
                                h('div', { class: ['tw-flex', 'tw-justify-between', 'tw-items-center', 'tw-mb-2'] }, [
                                    h('h3', { class: ['tw-text-base', 'tw-font-semibold', 'tw-text-gray-700'] }, '管理标签'),
                                    h(
                                        'button',
                                        { class: ['tw-btn', 'tw-btn-light', 'faq-tag-manager-close'], type: 'button', onClick: close },
                                        '✕'
                                    )
                                ]),
                                h('div', { class: ['faq-tag-manager-input-group', 'tw-flex', 'tw-gap-2', 'tw-mb-2'] }, [
                                    h('input', {
                                        ref: tagInputEl,
                                        type: 'text',
                                        placeholder: '输入标签名称，按回车添加',
                                        class: ['faq-tag-manager-input', 'tw-input'],
                                        value: store.inputValue,
                                        onInput: (e) => {
                                            store.inputValue = e?.target?.value ?? '';
                                        },
                                        onKeydown: onInputKeydown
                                    }),
                                    h('button', { class: ['faq-tag-manager-add-btn', 'tw-btn'], type: 'button', onClick: addFromInput }, '添加'),
                                    h(
                                        'button',
                                        {
                                            class: ['faq-tag-manager-smart-generate', 'tw-btn'],
                                            type: 'button',
                                            onClick: (e) => smartGenerate(e)
                                        },
                                        '✨ 智能生成'
                                    )
                                ]),
                                h('div', { class: ['faq-tag-manager-quick-tags', 'tw-flex', 'tw-flex-wrap', 'tw-gap-2', 'tw-mb-2'] }, quickTagButtons),
                                h('div', { class: ['faq-tag-manager-tags', 'tw-overflow-y-auto', 'faq-tag-manager-tags-box'] }, tagChips),
                                h('div', { class: ['tw-flex', 'tw-justify-end', 'tw-gap-2'] }, [
                                    h('button', { class: ['tw-btn', 'tw-btn-light'], type: 'button', onClick: close }, '取消'),
                                    h(
                                        'button',
                                        { class: ['faq-tag-manager-save', 'tw-btn', 'faq-tag-manager-save-btn'], type: 'button', onClick: save },
                                        '保存'
                                    )
                                ])
                            ])
                        ]
                    );
                };
            }
        };

        if (useTemplate) {
            componentOptions.template = resolvedTemplate;
        }

        return defineComponent(componentOptions);
    }

    window.PetManager.Components.FaqTagManager = {
        loadTemplate,
        createComponent
    };
})();
