(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const TAG_FILTER_TEMPLATES_RESOURCE_PATH = 'src/features/petManager/content/components/sessionSidebar/TagFilter/index.html';
    let tagFilterTemplateCache = '';

    async function loadTemplate() {
        if (tagFilterTemplateCache) return tagFilterTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        tagFilterTemplateCache = await DomHelper.loadHtmlTemplate(
            TAG_FILTER_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-tag-filter-template',
            'Failed to load TagFilter template'
        );
        return tagFilterTemplateCache;
    }

    function createComponent(params) {
        const manager = params?.manager;
        const bumpUiTick = typeof params?.bumpUiTick === 'function' ? params.bumpUiTick : null;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, ref, computed, onMounted, onUpdated, nextTick } = Vue;
        if (typeof defineComponent !== 'function' || typeof ref !== 'function' || typeof computed !== 'function') return null;

        const resolvedTemplate = String(template || tagFilterTemplateCache || '').trim();
        if (!resolvedTemplate) return null;

        return defineComponent({
            name: 'YiPetTagFilter',
            props: {
                uiTick: { type: Number, required: true }
            },
            setup(props) {
                const rootEl = ref(null);
                const keyword = ref('');
                let timer = null;

                const selectedTags = computed(() => {
                    props.uiTick;
                    return Array.isArray(manager?.selectedFilterTags) ? manager.selectedFilterTags : [];
                });

                const tagFilterReverse = computed(() => {
                    props.uiTick;
                    return !!manager?.tagFilterReverse;
                });

                const tagFilterNoTags = computed(() => {
                    props.uiTick;
                    return !!manager?.tagFilterNoTags;
                });

                const tagFilterExpanded = computed(() => {
                    props.uiTick;
                    return !!manager?.tagFilterExpanded;
                });

                const keywordLower = computed(() => {
                    props.uiTick;
                    const v = String(manager?.tagFilterSearchKeyword || '').trim();
                    if (keyword.value !== v) keyword.value = v;
                    return String(keyword.value || '').trim().toLowerCase();
                });

                const allTags = computed(() => {
                    props.uiTick;
                    if (typeof manager?.getAllTags === 'function') return manager.getAllTags() || [];
                    return [];
                });

                const filteredTags = computed(() => {
                    const kw = keywordLower.value;
                    const list = Array.isArray(allTags.value) ? allTags.value : [];
                    if (!kw) return list;
                    return list.filter((t) => String(t || '').toLowerCase().includes(kw));
                });

                const visibleCount = computed(() => {
                    props.uiTick;
                    return typeof manager?.tagFilterVisibleCount === 'number' ? manager.tagFilterVisibleCount : 8;
                });

                const tagsToShow = computed(() => {
                    const list = Array.isArray(filteredTags.value) ? filteredTags.value : [];
                    if (tagFilterExpanded.value) return list;
                    return list.slice(0, visibleCount.value);
                });

                const remainingCount = computed(() => {
                    const list = Array.isArray(filteredTags.value) ? filteredTags.value : [];
                    return Math.max(0, list.length - visibleCount.value);
                });

                const showExpandButton = computed(() => {
                    const list = Array.isArray(filteredTags.value) ? filteredTags.value : [];
                    return !keywordLower.value && !tagFilterExpanded.value && list.length > visibleCount.value;
                });

                const hasActiveFilter = computed(() => {
                    return !!keywordLower.value || !!tagFilterNoTags.value || (selectedTags.value || []).length > 0;
                });

                const tagCounts = computed(() => {
                    props.uiTick;
                    const counts = {};
                    const sessions = typeof manager?._getSessionsFromLocal === 'function' ? manager._getSessionsFromLocal() : [];
                    (Array.isArray(sessions) ? sessions : []).forEach((session) => {
                        if (Array.isArray(session?.tags) && session.tags.length > 0) {
                            session.tags.forEach((tag) => {
                                if (!tag) return;
                                const t = String(tag).trim();
                                if (!t) return;
                                counts[t] = (counts[t] || 0) + 1;
                            });
                        }
                    });
                    return counts;
                });

                const noTagsCount = computed(() => {
                    props.uiTick;
                    const sessions = typeof manager?._getSessionsFromLocal === 'function' ? manager._getSessionsFromLocal() : [];
                    let count = 0;
                    (Array.isArray(sessions) ? sessions : []).forEach((session) => {
                        const tags = Array.isArray(session?.tags) ? session.tags.map((t) => String(t || '').trim()) : [];
                        const hasTags = tags.length > 0 && tags.some((t) => t);
                        if (!hasTags) count += 1;
                    });
                    return count;
                });

                const isTagSelected = (tag) => {
                    const t = String(tag || '');
                    return (selectedTags.value || []).includes(t);
                };

                const onTagClick = (tag) => {
                    if (!manager) return;
                    const t = String(tag || '').trim();
                    if (!t) return;
                    if (manager.selectedFilterTags === undefined) manager.selectedFilterTags = [];
                    if (!Array.isArray(manager.selectedFilterTags)) manager.selectedFilterTags = [];
                    const idx = manager.selectedFilterTags.indexOf(t);
                    if (idx > -1) manager.selectedFilterTags.splice(idx, 1);
                    else manager.selectedFilterTags.push(t);
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                    if (bumpUiTick) bumpUiTick();
                };

                const toggleExpanded = () => {
                    if (!manager) return;
                    manager.tagFilterExpanded = !manager.tagFilterExpanded;
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                    if (bumpUiTick) bumpUiTick();
                };

                const toggleReverse = () => {
                    if (!manager) return;
                    manager.tagFilterReverse = !manager.tagFilterReverse;
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                    if (bumpUiTick) bumpUiTick();
                };

                const toggleNoTags = () => {
                    if (!manager) return;
                    manager.tagFilterNoTags = !manager.tagFilterNoTags;
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                    if (bumpUiTick) bumpUiTick();
                };

                const clearFilters = () => {
                    if (!manager || !hasActiveFilter.value) return;
                    manager.selectedFilterTags = [];
                    manager.tagFilterNoTags = false;
                    manager.tagFilterSearchKeyword = '';
                    keyword.value = '';
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                    if (bumpUiTick) bumpUiTick();
                };

                const onKeywordInput = (e) => {
                    const v = String(e?.target?.value || '');
                    keyword.value = v;
                    if (timer) clearTimeout(timer);
                    timer = setTimeout(() => {
                        if (!manager) return;
                        manager.tagFilterSearchKeyword = v;
                        if (bumpUiTick) bumpUiTick();
                    }, 300);
                };

                const clearKeyword = () => {
                    keyword.value = '';
                    if (timer) clearTimeout(timer);
                    timer = null;
                    if (manager) manager.tagFilterSearchKeyword = '';
                    if (bumpUiTick) bumpUiTick();
                };

                const bindDragHandlers = () => {
                    const el = rootEl.value;
                    if (!el) return;
                    if (typeof manager?.attachDragHandlersToTag !== 'function') return;
                    const buttons = el.querySelectorAll('.tag-filter-item');
                    buttons.forEach((btn) => {
                        if (!btn || typeof btn.getAttribute !== 'function') return;
                        if (btn.getAttribute('data-drag-bound') === 'true') return;
                        const tagName = btn.getAttribute('data-tag-name') || btn.dataset?.tagName;
                        if (!tagName || tagName === '__no_tags__' || tagName === '__expand__') return;
                        btn.setAttribute('data-drag-bound', 'true');
                        manager.attachDragHandlersToTag(btn, tagName, {
                            skipClick: true,
                            skipDomUpdate: true,
                            onAfterReorder: () => {
                                if (bumpUiTick) bumpUiTick();
                            }
                        });
                    });
                };

                onMounted(() => {
                    if (typeof nextTick === 'function') nextTick(bindDragHandlers);
                    else bindDragHandlers();
                });
                onUpdated(() => {
                    if (typeof nextTick === 'function') nextTick(bindDragHandlers);
                    else bindDragHandlers();
                });

                return {
                    rootEl,
                    keyword,
                    keywordLower,
                    tagFilterReverse,
                    tagFilterNoTags,
                    tagFilterExpanded,
                    hasActiveFilter,
                    tagCounts,
                    noTagsCount,
                    tagsToShow,
                    showExpandButton,
                    remainingCount,
                    isTagSelected,
                    onTagClick,
                    toggleExpanded,
                    toggleReverse,
                    toggleNoTags,
                    clearFilters,
                    onKeywordInput,
                    clearKeyword
                };
            },
            template: resolvedTemplate
        });
    }

    window.PetManager.Components.TagFilter = {
        loadTemplate,
        createComponent
    };
})();
