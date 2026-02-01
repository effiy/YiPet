(function () {
    'use strict';

    if (!window.PetManager) return;
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const SESSION_TAG_MANAGER_TEMPLATES_RESOURCE_PATH = 'src/features/petManager/content/components/sessionTagManager/SessionTagManager/index.html';
    let sessionTagManagerTemplateCache = '';

    async function loadTemplate() {
        if (sessionTagManagerTemplateCache) return sessionTagManagerTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        sessionTagManagerTemplateCache = await DomHelper.loadHtmlTemplate(
            SESSION_TAG_MANAGER_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-session-tag-manager-template',
            'Failed to load SessionTagManager template'
        );
        return sessionTagManagerTemplateCache;
    }

    function canUseVueTemplate(Vue) {
        if (typeof Vue?.compile !== 'function') return false;
        try {
            Function('return 1')();
            return true;
        } catch (_) {
            return false;
        }
    }

    function createComponent(params) {
        const manager = params?.manager;
        const store = params?.store;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, ref, computed, watch, nextTick, h } = Vue;
        if (typeof defineComponent !== 'function' || !store) return null;

        const useTemplate = canUseVueTemplate(Vue);
        const resolvedTemplate = useTemplate ? String(template || sessionTagManagerTemplateCache || '').trim() : '';
        if (useTemplate && !resolvedTemplate) return null;
        if (!useTemplate && typeof h !== 'function') return null;

        const componentOptions = {
            name: 'YiPetSessionTagManager',
            setup() {
                const tagInputEl = ref(null);
                const isComposing = ref(false);

                const sessionId = computed(() => String(store.sessionId || '').trim());
                const currentTags = computed(() => (Array.isArray(store.currentTags) ? store.currentTags : []));
                const quickTags = computed(() => {
                    const list = Array.isArray(store.quickTags) ? store.quickTags : null;
                    if (list) return list;
                    if (typeof manager?.getAllTags === 'function') return manager.getAllTags() || [];
                    return [];
                });

                const focusInput = () => {
                    nextTick(() => {
                        try {
                            tagInputEl.value?.focus?.();
                        } catch (_) {}
                    });
                };

                if (typeof watch === 'function') {
                    watch(
                        () => store.visible,
                        (v) => {
                            if (v) focusInput();
                        },
                        { immediate: true }
                    );
                }

                const close = () => {
                    manager?.closeTagManager?.();
                };

                const addFromInput = () => {
                    const id = sessionId.value;
                    if (!id) return;
                    manager?.addTagFromInput?.(id);
                    focusInput();
                };

                const onCompositionStart = () => {
                    isComposing.value = true;
                };
                const onCompositionEnd = () => {
                    isComposing.value = false;
                };

                const onInputKeydown = (e) => {
                    if (e?.isComposing || isComposing.value) return;
                    if (e?.key !== 'Enter') return;
                    e?.preventDefault?.();
                    addFromInput();
                };

                const addQuickTag = (tag) => {
                    const id = sessionId.value;
                    if (!id) return;
                    const t = String(tag ?? '').trim();
                    if (!t) return;
                    manager?.addQuickTag?.(id, t);
                    focusInput();
                };

                const removeTag = (idx) => {
                    const id = sessionId.value;
                    if (!id) return;
                    manager?.removeTag?.(id, idx);
                    focusInput();
                };

                const save = () => {
                    const id = sessionId.value;
                    if (!id) return;
                    manager?.saveTags?.(id);
                };

                const tagItemClass = (idx) => {
                    const base = ['tag-manager-tag-item', `tag-color-${idx % 8}`];
                    const draggingIndex = Number.isFinite(store.draggingIndex) ? store.draggingIndex : -1;
                    const dragOverIndex = Number.isFinite(store.dragOverIndex) ? store.dragOverIndex : -1;
                    const dragOverPosition = String(store.dragOverPosition || '');
                    const isDragging = draggingIndex === idx;
                    const isOver = dragOverIndex === idx && draggingIndex !== idx;
                    if (isDragging) base.push('tag-dragging');
                    if (isOver) {
                        base.push('tag-drag-hover');
                        if (dragOverPosition === 'top') base.push('tag-drag-over-top');
                        if (dragOverPosition === 'bottom') base.push('tag-drag-over-bottom');
                    }
                    return base;
                };

                const onDragStart = (idx, e) => {
                    store.draggingIndex = idx;
                    store.dragOverIndex = -1;
                    store.dragOverPosition = '';
                    try {
                        if (e?.dataTransfer) {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('application/tag-index', String(idx));
                            e.dataTransfer.setData('text/plain', String(currentTags.value?.[idx] ?? ''));
                        }
                    } catch (_) {}
                };

                const onDragEnd = () => {
                    store.draggingIndex = -1;
                    store.dragOverIndex = -1;
                    store.dragOverPosition = '';
                };

                const onDragOver = (idx, e) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    if (store.draggingIndex === idx) return;
                    const rect = e?.currentTarget?.getBoundingClientRect?.();
                    if (!rect) return;
                    const midY = rect.top + rect.height / 2;
                    store.dragOverIndex = idx;
                    store.dragOverPosition = e?.clientY < midY ? 'top' : 'bottom';
                    try {
                        if (e?.dataTransfer) e.dataTransfer.dropEffect = 'move';
                    } catch (_) {}
                };

                const onDragLeave = (idx, e) => {
                    const rect = e?.currentTarget?.getBoundingClientRect?.();
                    if (!rect) return;
                    const x = e?.clientX;
                    const y = e?.clientY;
                    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                        if (store.dragOverIndex === idx) {
                            store.dragOverIndex = -1;
                            store.dragOverPosition = '';
                        }
                    }
                };

                const onDrop = (idx, e) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    const id = sessionId.value;
                    if (!id) return;

                    let fromIndex = Number.isFinite(store.draggingIndex) ? store.draggingIndex : -1;
                    try {
                        const raw = e?.dataTransfer?.getData?.('application/tag-index');
                        const parsed = Number.parseInt(String(raw || ''), 10);
                        if (Number.isFinite(parsed)) fromIndex = parsed;
                    } catch (_) {}

                    if (!Number.isFinite(fromIndex) || fromIndex < 0) return;
                    if (fromIndex === idx) return;

                    const pos = String(store.dragOverPosition || '');
                    let insertIndex = idx;
                    if (pos === 'bottom') insertIndex = idx + 1;
                    if (fromIndex < insertIndex) insertIndex -= 1;

                    manager?.reorderTag?.(id, fromIndex, insertIndex);
                    onDragEnd();
                };

                return {
                    store,
                    tagInputEl,
                    currentTags,
                    quickTags,
                    close,
                    addFromInput,
                    onCompositionStart,
                    onCompositionEnd,
                    onInputKeydown,
                    addQuickTag,
                    removeTag,
                    save,
                    tagItemClass,
                    onDragStart,
                    onDragEnd,
                    onDragOver,
                    onDragLeave,
                    onDrop
                };
            }
        };

        if (useTemplate) {
            componentOptions.template = resolvedTemplate;
        } else {
            componentOptions.render = function () {
                const tags = Array.isArray(store.currentTags) ? store.currentTags : [];
                const allTags = Array.isArray(store.quickTags) ? store.quickTags : typeof manager?.getAllTags === 'function' ? manager.getAllTags() || [] : [];
                const id = String(store.sessionId || '').trim();
                return h('div', { class: 'tag-manager-modal-container', role: 'dialog', 'aria-modal': 'true', 'aria-label': '管理标签' }, [
                    h('div', { class: 'tag-manager-header' }, [
                        h('div', { class: 'tag-manager-title' }, '🏷️ 管理标签'),
                        h(
                            'div',
                            {
                                class: 'tag-manager-close',
                                role: 'button',
                                tabindex: '0',
                                'aria-label': '关闭',
                                title: '关闭',
                                onClick: () => manager?.closeTagManager?.()
                            },
                            '✕'
                        )
                    ]),
                    h('div', { class: 'tag-manager-content' }, [
                        h('div', { class: 'tag-manager-input-group' }, [
                            h('input', {
                                ref: 'tagInputEl',
                                class: 'tag-manager-input',
                                type: 'text',
                                placeholder: '输入标签名称，按回车添加',
                                value: store.inputValue || '',
                                onInput: (e) => {
                                    store.inputValue = e?.target?.value ?? '';
                                },
                                onKeydown: (e) => {
                                    if (e?.isComposing) return;
                                    if (e?.key !== 'Enter') return;
                                    e?.preventDefault?.();
                                    if (!id) return;
                                    manager?.addTagFromInput?.(id);
                                }
                            }),
                            h(
                                'button',
                                {
                                    class: 'tag-manager-add-btn',
                                    type: 'button',
                                    onClick: () => {
                                        if (!id) return;
                                        manager?.addTagFromInput?.(id);
                                    }
                                },
                                '添加'
                            )
                        ]),
                        h(
                            'div',
                            { class: 'tag-manager-quick-tags' },
                            (Array.isArray(allTags) ? allTags : []).length
                                ? (Array.isArray(allTags) ? allTags : []).map((t) =>
                                      h(
                                          'button',
                                          {
                                              type: 'button',
                                              class: ['tag-manager-quick-tag-btn', tags.includes(t) ? 'added' : ''],
                                              disabled: tags.includes(t),
                                              onClick: () => {
                                                  if (!id) return;
                                                  if (tags.includes(t)) return;
                                                  manager?.addQuickTag?.(id, t);
                                              }
                                          },
                                          String(t || '')
                                      )
                                  )
                                : [h('div', { class: 'tag-manager-empty-msg' }, '暂无可用标签')]
                        ),
                        h(
                            'div',
                            { class: 'tag-manager-tags', role: 'list', 'aria-label': '标签列表' },
                            tags.length
                                ? tags.map((t, idx) =>
                                      h(
                                          'div',
                                          {
                                              role: 'listitem',
                                              class: ['tag-manager-tag-item', `tag-color-${idx % 8}`],
                                              draggable: true
                                          },
                                          [
                                              h('span', null, String(t || '')),
                                              h(
                                                  'button',
                                                  {
                                                      type: 'button',
                                                      class: 'tag-remove-btn',
                                                      title: '删除标签',
                                                      'aria-label': '删除标签',
                                                      onClick: () => {
                                                          if (!id) return;
                                                          manager?.removeTag?.(id, idx);
                                                      }
                                                  },
                                                  '✕'
                                              )
                                          ]
                                      )
                                  )
                                : [h('div', { class: 'tag-manager-empty-msg' }, '暂无标签')]
                        ),
                        h('div', { class: 'tag-manager-footer' }, [
                            h(
                                'button',
                                {
                                    class: 'tag-manager-cancel-btn',
                                    type: 'button',
                                    onClick: () => manager?.closeTagManager?.()
                                },
                                '取消'
                            ),
                            h(
                                'button',
                                {
                                    class: 'tag-manager-save',
                                    type: 'button',
                                    onClick: () => {
                                        if (!id) return;
                                        manager?.saveTags?.(id);
                                    }
                                },
                                '保存'
                            )
                        ])
                    ])
                ]);
            };
        }

        return defineComponent(componentOptions);
    }

    window.PetManager.Components.SessionTagManager = {
        loadTemplate,
        createComponent
    };
})();
