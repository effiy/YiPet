(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const TAG_FILTER_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/TagFilter/index.html';

    async function loadTemplate() {
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        return await DomHelper.loadHtmlTemplate(
            TAG_FILTER_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-tag-filter-template',
            'Failed to load TagFilter template'
        );
    }

    function createComponent(params) {
        const manager = params?.manager;
        const bumpUiTick = typeof params?.bumpUiTick === 'function' ? params.bumpUiTick : null;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, ref, computed, onMounted, onUpdated, nextTick } = Vue;
        if (typeof defineComponent !== 'function' || typeof ref !== 'function' || typeof computed !== 'function') return null;

        const fallbackTemplate = `
            <div class="tag-filter-container" ref="rootEl" data-pet-tag-filter="vue">
                <div class="tag-filter-header">
                    <div class="tag-filter-search-container" :class="{ 'has-keyword': keywordLower }">
                        <input
                            class="tag-filter-search tag-filter-search-input"
                            type="text"
                            placeholder="搜索标签..."
                            :value="keyword"
                            @input="onKeywordInput"
                            @click.stop
                        />
                        <button
                            type="button"
                            class="tag-filter-search-clear"
                            :class="{ visible: keywordLower }"
                            title="清除"
                            aria-label="清除"
                            @click.stop="clearKeyword"
                        >✕</button>
                    </div>
                    <div class="tag-filter-actions">
                        <button
                            type="button"
                            class="tag-filter-action-btn tag-filter-reverse"
                            :class="{ active: tagFilterReverse }"
                            title="反向过滤"
                            aria-label="反向过滤"
                            @click.stop="toggleReverse"
                        >⇄</button>
                        <button
                            type="button"
                            class="tag-filter-action-btn tag-filter-no-tags"
                            :class="{ active: tagFilterNoTags }"
                            title="筛选无标签"
                            aria-label="筛选无标签"
                            @click.stop="toggleNoTags"
                        >∅</button>
                        <button
                            type="button"
                            class="tag-filter-action-btn tag-filter-expand"
                            :class="{ active: tagFilterExpanded }"
                            title="展开/收起更多标签"
                            aria-label="展开/收起更多标签"
                            @click.stop="toggleExpanded"
                        >⋮</button>
                        <button
                            type="button"
                            class="tag-filter-clear-btn"
                            :class="{ active: hasActiveFilter }"
                            title="清除筛选"
                            aria-label="清除筛选"
                            @click.stop="clearFilters"
                        >×</button>
                    </div>
                </div>
                <div class="tag-filter-list">
                    <button
                        v-if="noTagsCount > 0"
                        type="button"
                        class="tag-filter-item tag-no-tags"
                        :class="{ selected: tagFilterNoTags }"
                        data-tag-name="__no_tags__"
                        :title="tagFilterNoTags ? '取消筛选无标签会话' : '筛选没有标签的会话'"
                        @click.stop="toggleNoTags"
                        draggable="false"
                    >没有标签 ({{ noTagsCount }})</button>
                    <button
                        v-for="tag in tagsToShow"
                        :key="tag"
                        type="button"
                        class="tag-filter-item"
                        :class="{ selected: isTagSelected(tag) }"
                        :data-tag-name="tag"
                        :title="isTagSelected(tag) ? '取消选择 | 拖拽调整顺序' : '选择标签 | 拖拽调整顺序'"
                        @click.stop="onTagClick(tag)"
                        draggable="true"
                    >{{ tag }} ({{ tagCounts[tag] || 0 }})</button>
                    <button
                        v-if="showExpandButton"
                        type="button"
                        class="tag-filter-item tag-expand-btn"
                        data-tag-name="__expand__"
                        :title="tagFilterExpanded ? '收起标签' : '展开标签'"
                        @click.stop="toggleExpanded"
                        draggable="false"
                    >{{ tagFilterExpanded ? '收起' : \`展开 (\${remainingCount})\` }}</button>
                </div>
            </div>
        `;

        const resolvedTemplate = String(template || '').trim() || fallbackTemplate;

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

    /**
     * 创建 fallback 模式下的 tag-filter DOM（无 Vue 时使用，如 ChatWindow.createSidebar）
     * @param {Object} manager - PetManager 实例
     * @returns {HTMLElement} tag-filter-container 根元素
     */
    function createTagFilterElement(manager) {
        const tagFilterContainer = document.createElement('div');
        tagFilterContainer.className = 'tag-filter-container';

        const filterHeader = document.createElement('div');
        filterHeader.className = 'tag-filter-header';

        const filterActions = document.createElement('div');
        filterActions.className = 'tag-filter-actions';

        const expandToggleBtn = document.createElement('button');
        expandToggleBtn.className = 'tag-filter-action-btn tag-filter-expand';
        if (manager.tagFilterExpanded) expandToggleBtn.classList.add('active');
        expandToggleBtn.title = '展开/收起更多标签';
        expandToggleBtn.innerHTML = '⋮';

        expandToggleBtn.addEventListener('click', () => {
            manager.tagFilterExpanded = !manager.tagFilterExpanded;
            expandToggleBtn.classList.toggle('active', manager.tagFilterExpanded);
            if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
            if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
        });

        const reverseFilterBtn = document.createElement('button');
        reverseFilterBtn.className = 'tag-filter-action-btn tag-filter-reverse';
        if (manager.tagFilterReverse) reverseFilterBtn.classList.add('active');
        reverseFilterBtn.title = '反向过滤';
        reverseFilterBtn.innerHTML = '⇄';

        reverseFilterBtn.addEventListener('click', () => {
            manager.tagFilterReverse = !manager.tagFilterReverse;
            reverseFilterBtn.classList.toggle('active', manager.tagFilterReverse);
            if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
            if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
        });

        const noTagsFilterBtn = document.createElement('button');
        noTagsFilterBtn.className = 'tag-filter-action-btn tag-filter-no-tags';
        if (manager.tagFilterNoTags) noTagsFilterBtn.classList.add('active');
        noTagsFilterBtn.title = '筛选无标签';
        noTagsFilterBtn.innerHTML = '∅';

        noTagsFilterBtn.addEventListener('click', () => {
            manager.tagFilterNoTags = !manager.tagFilterNoTags;
            noTagsFilterBtn.classList.toggle('active', manager.tagFilterNoTags);
            if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
            if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
        });

        const clearFilterBtn = document.createElement('button');
        clearFilterBtn.className = 'tag-filter-clear-btn';
        clearFilterBtn.textContent = '×';
        clearFilterBtn.title = '清除筛选';

        const updateClearFilterBtnStyle = () => {
            const hasSelectedTags = manager.selectedFilterTags && manager.selectedFilterTags.length > 0;
            const hasSearchKeyword = manager.tagFilterSearchKeyword && manager.tagFilterSearchKeyword.trim() !== '';
            const hasActiveFilter = hasSelectedTags || manager.tagFilterNoTags || hasSearchKeyword;
            clearFilterBtn.classList.toggle('active', hasActiveFilter);
        };

        updateClearFilterBtnStyle();

        clearFilterBtn.addEventListener('click', () => {
            const hasSelectedTags = manager.selectedFilterTags && manager.selectedFilterTags.length > 0;
            const hasSearchKeyword = manager.tagFilterSearchKeyword && manager.tagFilterSearchKeyword.trim() !== '';
            const hasActiveFilter = hasSelectedTags || manager.tagFilterNoTags || hasSearchKeyword;

            if (hasActiveFilter) {
                manager.selectedFilterTags = [];
                manager.tagFilterNoTags = false;
                manager.tagFilterSearchKeyword = '';

                const tagSearchInput = tagFilterContainer.querySelector('.tag-filter-search');
                const tagSearchClearBtn = tagFilterContainer.querySelector('.tag-filter-search-clear');
                if (tagSearchInput) tagSearchInput.value = '';
                if (tagSearchClearBtn) tagSearchClearBtn.classList.remove('visible');

                if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            }
        });

        filterActions.appendChild(reverseFilterBtn);
        filterActions.appendChild(noTagsFilterBtn);
        filterActions.appendChild(expandToggleBtn);
        filterActions.appendChild(clearFilterBtn);

        if (typeof manager.createSearchInput === 'function') {
            const searchComp = manager.createSearchInput({
                className: 'tag-filter-search',
                placeholder: '搜索标签...',
                value: manager.tagFilterSearchKeyword || '',
                onChange: (v) => {
                    manager.tagFilterSearchKeyword = v;
                    if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                },
                onClear: () => {
                    manager.tagFilterSearchKeyword = '';
                    if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                },
                debounce: 300
            });
            filterHeader.appendChild(searchComp.container);
        }

        filterHeader.appendChild(filterActions);

        const tagFilterList = document.createElement('div');
        tagFilterList.className = 'tag-filter-list';

        tagFilterContainer.appendChild(filterHeader);
        tagFilterContainer.appendChild(tagFilterList);

        return tagFilterContainer;
    }

    window.PetManager.Components.TagFilter = {
        loadTemplate,
        createComponent,
        createTagFilterElement
    };
})();
