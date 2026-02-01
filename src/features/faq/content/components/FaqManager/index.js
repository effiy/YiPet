(function () {
    'use strict';

    if (!window.PetManager) return;
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const FAQ_MANAGER_TEMPLATES_RESOURCE_PATH = 'src/features/faq/content/components/FaqManager/index.html';
    let faqManagerTemplateCache = '';

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
        if (faqManagerTemplateCache) return faqManagerTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        faqManagerTemplateCache = await DomHelper.loadHtmlTemplate(
            FAQ_MANAGER_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-faq-manager-template',
            'Failed to load FaqManager template'
        );
        return faqManagerTemplateCache;
    }

    function createComponent(params) {
        const manager = params?.manager;
        const store = params?.store;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, computed, ref, onMounted, onBeforeUnmount, nextTick, watch, h } = Vue;
        if (typeof defineComponent !== 'function' || !store) return null;

        const useTemplate = canUseVueTemplate(Vue);
        const resolvedTemplate = useTemplate ? String(template || faqManagerTemplateCache || '').trim() : '';
        if (useTemplate && !resolvedTemplate) return null;
        if (!useTemplate && typeof h !== 'function') return null;

        const normalizeTags = (tags) => {
            if (!tags) return [];
            const raw = Array.isArray(tags) ? tags : String(tags).split(',');
            const seen = new Set();
            const out = [];
            for (const t of raw) {
                const s = String(t ?? '').trim();
                if (!s) continue;
                const k = s.toLowerCase();
                if (seen.has(k)) continue;
                seen.add(k);
                out.push(s);
            }
            return out;
        };

        const componentOptions = {
            name: 'YiPetFaqManager',
            setup() {
                const rootEl = ref(null);
                const searchInputEl = ref(null);
                let previousActiveElement = null;

                const allTags = computed(() => {
                    const tagSet = new Set();
                    const faqs = Array.isArray(store.allFaqs) ? store.allFaqs : [];
                    faqs.forEach((faq) => {
                        const tags = normalizeTags(faq?.tags);
                        tags.forEach((t) => {
                            const s = String(t ?? '').trim();
                            if (!s) return;
                            tagSet.add(s);
                        });
                    });
                    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-CN'));
                });

                const tagSearchKw = computed(() => String(store.tagFilterSearchKeyword || '').trim().toLowerCase());
                const filteredTags = computed(() => {
                    const kw = tagSearchKw.value;
                    const list = allTags.value;
                    return kw ? list.filter((t) => String(t).toLowerCase().includes(kw)) : list;
                });

                const visibleTags = computed(() => {
                    const list = filteredTags.value;
                    const expanded = !!store.tagFilterExpanded;
                    const visibleCount = Math.max(0, Number(store.tagFilterVisibleCount) || 20);
                    return expanded ? list : list.slice(0, visibleCount);
                });

                const moreToggleVisible = computed(() => {
                    const list = filteredTags.value;
                    const visibleCount = Math.max(0, Number(store.tagFilterVisibleCount) || 20);
                    return list.length > visibleCount;
                });

                const filteredFaqs = computed(() => {
                    const list = Array.isArray(store.allFaqs) ? store.allFaqs : [];
                    let out = list;

                    const searchKw = String(store.searchFilter || '').trim().toLowerCase();
                    if (searchKw) {
                        out = out.filter((faq) => {
                            const hay = `${String(faq?.title || '')}\n${String(faq?.prompt || '')}`.toLowerCase();
                            return hay.includes(searchKw);
                        });
                    }

                    const selectedTags = Array.isArray(store.selectedTags) ? store.selectedTags : [];
                    const reverse = !!store.tagFilterReverse;
                    const noTags = !!store.tagFilterNoTags;

                    out = out.filter((faq) => {
                        const tags = normalizeTags(faq?.tags);
                        if (noTags) return tags.length === 0;
                        if (selectedTags.length === 0) return true;
                        const hasAny = tags.some((t) => selectedTags.includes(t));
                        return reverse ? !hasAny : hasAny;
                    });

                    return out;
                });

                const summaryText = computed(() => {
                    const total = Array.isArray(store.allFaqs) ? store.allFaqs.length : 0;
                    const matched = filteredFaqs.value.length;
                    return `共 ${total} 条，匹配 ${matched} 条`;
                });

                const focusSearch = () => {
                    if (typeof nextTick !== 'function') return;
                    nextTick(() => {
                        try {
                            searchInputEl.value?.focus?.();
                        } catch (_) {}
                    });
                };

                let previousBodyOverflow = '';
                let bodyOverflowLocked = false;
                const lockBodyScrollIfNeeded = () => {
                    try {
                        if (!bodyOverflowLocked) {
                            previousBodyOverflow = document.body.style.overflow || '';
                            document.body.style.overflow = 'hidden';
                            bodyOverflowLocked = true;
                        }
                    } catch (_) {}
                };
                const unlockBodyScrollIfNeeded = () => {
                    try {
                        if (!bodyOverflowLocked) return;
                        document.body.style.overflow = previousBodyOverflow;
                    } catch (_) {}
                    bodyOverflowLocked = false;
                };

                const restoreFocusIfNeeded = () => {
                    try {
                        const root = rootEl.value;
                        if (root?.closest && root.closest('#pet-chat-window')) return;
                    } catch (_) {}
                    try {
                        if (!previousActiveElement) return;
                        if (!document.contains(previousActiveElement)) return;
                        previousActiveElement.focus?.();
                    } catch (_) {}
                    previousActiveElement = null;
                };

                const getFocusableElements = (root) => {
                    if (!root || typeof root.querySelectorAll !== 'function') return [];
                    const nodes = root.querySelectorAll(
                        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
                    );
                    return Array.from(nodes).filter((el) => {
                        try {
                            if (!(el instanceof HTMLElement)) return false;
                            if (el.hasAttribute('disabled')) return false;
                            const rect = el.getClientRects?.();
                            if (!rect || rect.length === 0) return false;
                            return true;
                        } catch (_) {
                            return false;
                        }
                    });
                };

                const onRootKeydown = (e) => {
                    if (!e || !store.visible) return;
                    if (e.key === 'Escape') {
                        try {
                            e.preventDefault();
                            e.stopPropagation();
                        } catch (_) {}
                        close();
                        return;
                    }
                    if (e.key !== 'Tab') return;

                    const root = rootEl.value;
                    const focusables = getFocusableElements(root);
                    if (focusables.length === 0) {
                        try {
                            e.preventDefault();
                            e.stopPropagation();
                            root?.focus?.();
                        } catch (_) {}
                        return;
                    }

                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    const active = document.activeElement;

                    if (e.shiftKey) {
                        if (active === first || active === root) {
                            try {
                                e.preventDefault();
                                e.stopPropagation();
                                last.focus?.();
                            } catch (_) {}
                        }
                        return;
                    }

                    if (active === last) {
                        try {
                            e.preventDefault();
                            e.stopPropagation();
                            first.focus?.();
                        } catch (_) {}
                    }
                };

                const close = () => {
                    if (typeof manager?.closeFaqManagerOnly === 'function') manager.closeFaqManagerOnly();
                };

                const clearSearch = () => {
                    store.searchFilter = '';
                    focusSearch();
                };

                const toggleReverse = () => {
                    store.tagFilterReverse = !store.tagFilterReverse;
                    if (store.tagFilterNoTags) store.tagFilterNoTags = false;
                };

                const toggleNoTags = () => {
                    store.tagFilterNoTags = !store.tagFilterNoTags;
                    if (store.tagFilterNoTags) {
                        store.selectedTags = [];
                        store.tagFilterReverse = false;
                    }
                };

                const clearTagFilters = () => {
                    store.selectedTags = [];
                    store.tagFilterReverse = false;
                    store.tagFilterNoTags = false;
                };

                const toggleTagManager = () => {
                    store.tagManagerVisible = !store.tagManagerVisible;
                };

                const refresh = async () => {
                    if (typeof manager?.loadFaqsIntoManager === 'function') await manager.loadFaqsIntoManager(true);
                };

                const clearTagSearch = () => {
                    store.tagFilterSearchKeyword = '';
                };

                const toggleMoreTags = () => {
                    store.tagFilterExpanded = !store.tagFilterExpanded;
                };

                const toggleTag = (tag) => {
                    const target = String(tag ?? '').trim();
                    if (!target) return;
                    if (!Array.isArray(store.selectedTags)) store.selectedTags = [];
                    const idx = store.selectedTags.indexOf(target);
                    if (idx >= 0) {
                        store.selectedTags.splice(idx, 1);
                        return;
                    }
                    store.selectedTags.push(target);
                    if (store.tagFilterNoTags) store.tagFilterNoTags = false;
                };

                const renameTag = async (tag) => {
                    if (typeof manager?.renameFaqTag === 'function') await manager.renameFaqTag(tag);
                };

                const deleteTag = async (tag) => {
                    if (typeof manager?.deleteFaqTag === 'function') await manager.deleteFaqTag(tag);
                };

                const onNewFaqKeydown = (e) => {
                    if (!e) return;
                    const isEnter = e.key === 'Enter';
                    if (!isEnter) return;
                    const withMeta = !!(e.ctrlKey || e.metaKey || e.shiftKey);
                    if (!withMeta) return;
                    e.preventDefault();
                    if (typeof manager?.addFaqFromInput === 'function') manager.addFaqFromInput();
                };

                const onFaqInsert = (faq) => {
                    if (typeof manager?.applyFaqItem === 'function') manager.applyFaqItem(faq, 'insert');
                    close();
                };

                const onFaqSend = (faq) => {
                    if (typeof manager?.applyFaqItem === 'function') manager.applyFaqItem(faq, 'send');
                    close();
                };

                const onFaqKeydown = (e, faq) => {
                    if (!e || e.key !== 'Enter') return;
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        onFaqSend(faq);
                        return;
                    }
                    if (!e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        onFaqInsert(faq);
                    }
                };

                const deleteFaq = async (faq) => {
                    if (typeof manager?.deleteFaq === 'function') await manager.deleteFaq(faq);
                };

                const editTags = (index) => {
                    if (typeof manager?.openFaqTagManager === 'function') manager.openFaqTagManager(index);
                };

                onMounted(() => {
                    try {
                        const root = rootEl.value;
                        if (root && typeof root.addEventListener === 'function') {
                            root.addEventListener('keydown', onRootKeydown, true);
                        }
                    } catch (_) {}
                    focusSearch();
                });

                if (typeof watch === 'function') {
                    watch(
                        () => !!store.visible,
                        (visible) => {
                            if (visible) {
                                try {
                                    previousActiveElement = document.activeElement || null;
                                } catch (_) {
                                    previousActiveElement = null;
                                }
                                lockBodyScrollIfNeeded();
                                focusSearch();
                                return;
                            }
                            unlockBodyScrollIfNeeded();
                            restoreFocusIfNeeded();
                        }
                    );
                }

                if (typeof onBeforeUnmount === 'function') {
                    onBeforeUnmount(() => {
                        try {
                            const root = rootEl.value;
                            if (root && typeof root.removeEventListener === 'function') {
                                root.removeEventListener('keydown', onRootKeydown, true);
                            }
                        } catch (_) {}
                        unlockBodyScrollIfNeeded();
                        restoreFocusIfNeeded();
                    });
                }

                if (useTemplate) {
                    return {
                        store,
                        rootEl,
                        searchInputEl,
                        allTags,
                        visibleTags,
                        moreToggleVisible,
                        filteredFaqs,
                        summaryText,
                        close,
                        clearSearch,
                        toggleReverse,
                        toggleNoTags,
                        clearTagFilters,
                        toggleTagManager,
                        refresh,
                        clearTagSearch,
                        toggleMoreTags,
                        toggleTag,
                        renameTag,
                        deleteTag,
                        onNewFaqKeydown,
                        onFaqInsert,
                        onFaqSend,
                        onFaqKeydown,
                        deleteFaq,
                        editTags
                    };
                }

                const safeBool = (v) => !!v;
                const getDeletingMap = () => {
                    const m = store?.deletingFaqKeys;
                    return m && typeof m === 'object' ? m : Object.create(null);
                };

                return () => {
                    const deletingMap = getDeletingMap();
                    const tags = Array.isArray(visibleTags.value) ? visibleTags.value : [];
                    const faqs = Array.isArray(filteredFaqs.value) ? filteredFaqs.value : [];

                    const tagButtons = tags.map((tag) =>
                        h(
                            'button',
                            {
                                key: tag,
                                type: 'button',
                                class: ['pet-faq-tag', Array.isArray(store.selectedTags) && store.selectedTags.includes(tag) ? 'active' : ''],
                                role: 'listitem',
                                'aria-label': `筛选标签：${tag}`,
                                onClick: () => toggleTag(tag)
                            },
                            tag
                        )
                    );

                    if (safeBool(moreToggleVisible.value)) {
                        tagButtons.push(
                            h(
                                'button',
                                {
                                    key: '__more__',
                                    type: 'button',
                                    class: ['pet-faq-tag', 'more'],
                                    role: 'listitem',
                                    'aria-label': '展开或收起标签',
                                    onClick: toggleMoreTags
                                },
                                store.tagFilterExpanded ? '收起' : '更多'
                            )
                        );
                    }

                    const tagManagerPanel = store.tagManagerVisible
                        ? h('div', { class: 'pet-faq-tag-manager', 'aria-label': '标签管理面板' }, [
                              h('div', { class: 'pet-faq-tag-manager-header' }, [
                                  h('div', { class: 'pet-faq-tag-manager-title' }, '标签管理'),
                                  h(
                                      'button',
                                      {
                                          type: 'button',
                                          class: 'pet-faq-filter-btn',
                                          'aria-label': '关闭标签管理',
                                          onClick: toggleTagManager
                                      },
                                      '关闭'
                                  )
                              ]),
                              h(
                                  'div',
                                  { class: 'pet-faq-tag-manager-list', role: 'list', 'aria-label': '可管理标签列表' },
                                  (Array.isArray(allTags.value) ? allTags.value : []).map((tag) =>
                                      h('div', { key: tag, class: 'pet-faq-tag-manager-item', role: 'listitem' }, [
                                          h('div', { class: 'pet-faq-tag-manager-item-tag' }, tag),
                                          h('div', { class: 'pet-faq-tag-manager-item-actions' }, [
                                              h(
                                                  'button',
                                                  {
                                                      type: 'button',
                                                      class: 'pet-faq-tag-manager-btn',
                                                      'aria-label': '重命名标签',
                                                      onClick: () => renameTag(tag)
                                                  },
                                                  '重命名'
                                              ),
                                              h(
                                                  'button',
                                                  {
                                                      type: 'button',
                                                      class: ['pet-faq-tag-manager-btn', 'danger'],
                                                      'aria-label': '删除标签',
                                                      onClick: () => deleteTag(tag)
                                                  },
                                                  '删除'
                                              )
                                          ])
                                      ])
                                  )
                              )
                          ])
                        : null;

                    const faqItems = faqs.length
                        ? faqs.map((faq, index) => {
                              const tagsRow =
                                  Array.isArray(faq?.tags) && faq.tags.length
                                      ? h(
                                            'div',
                                            { class: 'pet-faq-item-tags', 'aria-label': '问题标签' },
                                            faq.tags.map((t) =>
                                                h(
                                                    'button',
                                                    {
                                                        key: t,
                                                        type: 'button',
                                                        class: 'pet-faq-item-tag',
                                                        'aria-label': `筛选标签：${t}`,
                                                        onClick: (e) => {
                                                            try {
                                                                e?.stopPropagation?.();
                                                            } catch (_) {}
                                                            toggleTag(t);
                                                        }
                                                    },
                                                    t
                                                )
                                            )
                                        )
                                      : null;

                              const key = String(faq?.key || '');
                              const isDeleting = !!(key && deletingMap && deletingMap[key]);

                              return h(
                                  'div',
                                  {
                                      key: faq?.key || `${index}`,
                                      class: 'pet-faq-item',
                                      role: 'listitem',
                                      tabindex: 0,
                                      onClick: () => onFaqInsert(faq),
                                      onKeydown: (e) => onFaqKeydown(e, faq)
                                  },
                                  [
                                      h('div', { class: 'pet-faq-item-header' }, [
                                          h('div', { class: 'pet-faq-item-title' }, faq?.title || '常见问题'),
                                          h('div', { class: 'pet-faq-item-actions' }, [
                                              h(
                                                  'button',
                                                  {
                                                      type: 'button',
                                                      class: 'pet-faq-item-btn',
                                                      'aria-label': '标签',
                                                      onClick: (e) => {
                                                          try {
                                                              e?.stopPropagation?.();
                                                          } catch (_) {}
                                                          editTags(index);
                                                      }
                                                  },
                                                  '标签'
                                              ),
                                              h(
                                                  'button',
                                                  {
                                                      type: 'button',
                                                      class: 'pet-faq-item-btn',
                                                      'aria-label': '插入',
                                                      onClick: (e) => {
                                                          try {
                                                              e?.stopPropagation?.();
                                                          } catch (_) {}
                                                          onFaqInsert(faq);
                                                      }
                                                  },
                                                  '插入'
                                              ),
                                              h(
                                                  'button',
                                                  {
                                                      type: 'button',
                                                      class: ['pet-faq-item-btn', 'primary'],
                                                      'aria-label': '发送',
                                                      onClick: (e) => {
                                                          try {
                                                              e?.stopPropagation?.();
                                                          } catch (_) {}
                                                          onFaqSend(faq);
                                                      }
                                                  },
                                                  '发送'
                                              ),
                                              h(
                                                  'button',
                                                  {
                                                      type: 'button',
                                                      class: ['pet-faq-item-btn', 'danger'],
                                                      'aria-label': '删除',
                                                      disabled: isDeleting,
                                                      onClick: (e) => {
                                                          try {
                                                              e?.stopPropagation?.();
                                                          } catch (_) {}
                                                          deleteFaq(faq);
                                                      }
                                                  },
                                                  isDeleting ? '删除中...' : '删除'
                                              )
                                          ])
                                      ]),
                                      tagsRow,
                                      h('div', { class: 'pet-faq-item-prompt' }, faq?.prompt || '')
                                  ]
                              );
                          })
                        : [h('div', { key: '__empty__', class: 'pet-faq-empty', role: 'listitem' }, '未找到匹配的常见问题')];

                    return h(
                        'div',
                        {
                            id: 'pet-faq-manager',
                            ref: rootEl,
                            class: ['pet-faq-manager', store.visible ? 'pet-is-visible' : ''],
                            role: 'dialog',
                            'aria-modal': 'true',
                            'aria-label': '常见问题',
                            tabindex: 0,
                            onClick: (e) => {
                                if (e?.target === e?.currentTarget) close();
                            },
                            onKeydown: (e) => {
                                if (!e || e.key !== 'Escape') return;
                                try {
                                    e.preventDefault();
                                    e.stopPropagation();
                                } catch (_) {}
                                close();
                            }
                        },
                        [
                            h('div', { class: 'pet-faq-manager-modal', role: 'document' }, [
                                h('div', { class: 'pet-faq-manager-header' }, [
                                    h('div', { class: 'pet-faq-manager-title' }, [
                                        '💡 常见问题 ',
                                        h('span', { class: 'pet-faq-manager-title-sub' }, '（一键插入/发送）')
                                    ]),
                                    h(
                                        'button',
                                        {
                                            type: 'button',
                                            class: 'pet-faq-modal-close',
                                            'aria-label': '关闭',
                                            onClick: close
                                        },
                                        '✕'
                                    )
                                ]),
                                h('div', { class: 'pet-faq-modal-content' }, [
                                    h('div', { class: 'pet-faq-layout' }, [
                                        h('div', { class: 'pet-faq-sidebar', 'aria-label': '筛选与标签' }, [
                                            h('div', { class: 'pet-faq-search-row' }, [
                                                h('input', {
                                                    ref: searchInputEl,
                                                    type: 'text',
                                                    class: 'pet-faq-search-input',
                                                    placeholder: '搜索常见问题...',
                                                    'aria-label': '搜索常见问题',
                                                    value: store.searchFilter,
                                                    onInput: (e) => {
                                                        store.searchFilter = e?.target?.value ?? '';
                                                    }
                                                }),
                                                h(
                                                    'button',
                                                    {
                                                        type: 'button',
                                                        class: 'pet-faq-search-clear',
                                                        title: '清除搜索',
                                                        'aria-label': '清除搜索',
                                                        disabled: !store.searchFilter,
                                                        onClick: clearSearch
                                                    },
                                                    '清除'
                                                )
                                            ]),
                                            h('div', { class: 'pet-faq-filter-row', 'aria-label': '常见问题标签筛选' }, [
                                                h('div', { class: 'pet-faq-filter-actions' }, [
                                                    h(
                                                        'button',
                                                        {
                                                            type: 'button',
                                                            class: ['pet-faq-filter-btn', store.tagFilterReverse ? 'active' : ''],
                                                            title: '不包含选中标签',
                                                            'aria-label': '反选',
                                                            onClick: toggleReverse
                                                        },
                                                        '反选'
                                                    ),
                                                    h(
                                                        'button',
                                                        {
                                                            type: 'button',
                                                            class: ['pet-faq-filter-btn', store.tagFilterNoTags ? 'active' : ''],
                                                            title: '只显示无标签问题',
                                                            'aria-label': '无标签',
                                                            onClick: toggleNoTags
                                                        },
                                                        '无标签'
                                                    ),
                                                    h(
                                                        'button',
                                                        {
                                                            type: 'button',
                                                            class: 'pet-faq-filter-btn',
                                                            title: '清除标签筛选',
                                                            'aria-label': '清除标签筛选',
                                                            disabled:
                                                                (Array.isArray(store.selectedTags) ? store.selectedTags.length : 0) === 0 &&
                                                                !store.tagFilterReverse &&
                                                                !store.tagFilterNoTags,
                                                            onClick: clearTagFilters
                                                        },
                                                        '清除标签'
                                                    ),
                                                    h(
                                                        'button',
                                                        {
                                                            type: 'button',
                                                            class: ['pet-faq-filter-btn', store.tagManagerVisible ? 'active' : ''],
                                                            title: '标签管理',
                                                            'aria-label': '标签管理',
                                                            onClick: toggleTagManager
                                                        },
                                                        '标签管理'
                                                    ),
                                                    h(
                                                        'button',
                                                        {
                                                            type: 'button',
                                                            class: 'pet-faq-filter-btn',
                                                            title: '从接口刷新',
                                                            'aria-label': '刷新',
                                                            disabled: !!store.isLoading,
                                                            onClick: refresh
                                                        },
                                                        '刷新'
                                                    )
                                                ]),
                                                h('div', { class: 'pet-faq-tag-search' }, [
                                                    h('input', {
                                                        type: 'text',
                                                        class: 'pet-faq-tag-search-input',
                                                        placeholder: '搜索标签...',
                                                        'aria-label': '搜索标签',
                                                        value: store.tagFilterSearchKeyword,
                                                        onInput: (e) => {
                                                            store.tagFilterSearchKeyword = e?.target?.value ?? '';
                                                        }
                                                    }),
                                                    h(
                                                        'button',
                                                        {
                                                            type: 'button',
                                                            class: 'pet-faq-filter-btn',
                                                            title: '清除标签搜索',
                                                            'aria-label': '清除标签搜索',
                                                            disabled: !store.tagFilterSearchKeyword,
                                                            onClick: clearTagSearch
                                                        },
                                                        '清除'
                                                    )
                                                ]),
                                                h('div', { class: 'pet-faq-tag-list', role: 'list', 'aria-label': '标签列表' }, tagButtons),
                                                tagManagerPanel
                                            ])
                                        ]),
                                        h('div', { class: 'pet-faq-main', 'aria-label': '常见问题列表' }, [
                                            h(
                                                'div',
                                                { class: 'pet-faq-summary', role: 'status', 'aria-label': '筛选结果' },
                                                summaryText.value
                                            ),
                                            h('div', { class: 'pet-faq-input-row', 'aria-label': '添加常见问题' }, [
                                                h('textarea', {
                                                    class: 'pet-faq-input',
                                                    placeholder: '输入问题内容，按 Ctrl+Enter 或 Shift+Enter 添加',
                                                    'aria-label': '新增常见问题',
                                                    value: store.newFaqText,
                                                    onInput: (e) => {
                                                        store.newFaqText = e?.target?.value ?? '';
                                                    },
                                                    onKeydown: onNewFaqKeydown
                                                }),
                                                h('div', { class: 'pet-faq-input-hint' }, '支持多行内容，首行作为标题，余下作为正文。')
                                            ]),
                                            store.isLoading
                                                ? h('div', { class: 'pet-faq-status', role: 'status' }, '正在加载常见问题...')
                                                : null,
                                            store.error ? h('div', { class: 'pet-faq-error', role: 'status' }, store.error) : null,
                                            h('div', { class: 'pet-faq-list', role: 'list', 'aria-label': '常见问题列表' }, faqItems)
                                        ])
                                    ])
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

    window.PetManager.Components.FaqManager = {
        loadTemplate,
        createComponent
    };
})();
