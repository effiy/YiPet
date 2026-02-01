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

        const searchContainer = document.createElement('div');
        searchContainer.className = 'tag-filter-search-container';

        const searchInput = document.createElement('input');
        searchInput.className = 'tag-filter-search tag-filter-search-input';
        searchInput.type = 'text';
        searchInput.placeholder = '搜索标签...';
        searchInput.value = String(manager?.tagFilterSearchKeyword || '');

        const searchClearBtn = document.createElement('button');
        searchClearBtn.type = 'button';
        searchClearBtn.className = 'tag-filter-search-clear';
        searchClearBtn.textContent = '✕';
        searchClearBtn.title = '清除';
        searchClearBtn.setAttribute('aria-label', '清除');

        const filterActions = document.createElement('div');
        filterActions.className = 'tag-filter-actions';

        const expandToggleBtn = document.createElement('button');
        expandToggleBtn.className = 'tag-filter-action-btn tag-filter-expand';
        expandToggleBtn.title = '展开/收起更多标签';
        expandToggleBtn.innerHTML = '⋮';

        const reverseFilterBtn = document.createElement('button');
        reverseFilterBtn.className = 'tag-filter-action-btn tag-filter-reverse';
        reverseFilterBtn.title = '反向过滤';
        reverseFilterBtn.innerHTML = '⇄';

        const noTagsFilterBtn = document.createElement('button');
        noTagsFilterBtn.className = 'tag-filter-action-btn tag-filter-no-tags';
        noTagsFilterBtn.title = '筛选无标签';
        noTagsFilterBtn.innerHTML = '∅';

        const clearFilterBtn = document.createElement('button');
        clearFilterBtn.className = 'tag-filter-clear-btn';
        clearFilterBtn.textContent = '×';
        clearFilterBtn.title = '清除筛选';

        filterActions.appendChild(reverseFilterBtn);
        filterActions.appendChild(noTagsFilterBtn);
        filterActions.appendChild(expandToggleBtn);
        filterActions.appendChild(clearFilterBtn);

        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(searchClearBtn);
        filterHeader.appendChild(searchContainer);
        filterHeader.appendChild(filterActions);

        const tagFilterList = document.createElement('div');
        tagFilterList.className = 'tag-filter-list';

        tagFilterContainer.appendChild(filterHeader);
        tagFilterContainer.appendChild(tagFilterList);

        const syncSearchUi = () => {
            const kw = String(manager?.tagFilterSearchKeyword || '').trim();
            if (searchInput.value !== kw) searchInput.value = kw;
            searchContainer.classList.toggle('has-keyword', !!kw);
            searchClearBtn.classList.toggle('visible', !!kw);
        };

        const syncActionUi = () => {
            reverseFilterBtn.classList.toggle('active', !!manager?.tagFilterReverse);
            noTagsFilterBtn.classList.toggle('active', !!manager?.tagFilterNoTags);
            expandToggleBtn.classList.toggle('active', !!manager?.tagFilterExpanded);
            const selected = Array.isArray(manager?.selectedFilterTags) ? manager.selectedFilterTags : [];
            const hasSelectedTags = selected.length > 0;
            const kw = String(manager?.tagFilterSearchKeyword || '').trim();
            const hasActiveFilter = hasSelectedTags || !!manager?.tagFilterNoTags || !!kw;
            clearFilterBtn.classList.toggle('active', !!hasActiveFilter);
        };

        const render = () => {
            if (!manager) return;

            syncSearchUi();
            syncActionUi();

            const allTags = typeof manager.getAllTags === 'function' ? manager.getAllTags() : [];
            const keyword = String(manager.tagFilterSearchKeyword || '').trim().toLowerCase();
            const filtered = keyword ? allTags.filter((t) => String(t || '').toLowerCase().includes(keyword)) : allTags;
            const visibleCount = typeof manager.tagFilterVisibleCount === 'number' ? manager.tagFilterVisibleCount : 8;

            const tagCounts = {};
            let noTagsCount = 0;
            const allSessions = typeof manager._getSessionsFromLocal === 'function' ? manager._getSessionsFromLocal() : [];
            (Array.isArray(allSessions) ? allSessions : []).forEach((session) => {
                if (Array.isArray(session?.tags) && session.tags.length > 0) {
                    session.tags.forEach((tag) => {
                        if (!tag) return;
                        const t = String(tag).trim();
                        if (!t) return;
                        tagCounts[t] = (tagCounts[t] || 0) + 1;
                    });
                } else {
                    noTagsCount += 1;
                }
            });

            const selected = Array.isArray(manager.selectedFilterTags) ? manager.selectedFilterTags : [];
            const hasMoreTags = !manager.tagFilterExpanded && filtered.length > visibleCount;
            const tagsToShow = manager.tagFilterExpanded ? filtered : filtered.slice(0, visibleCount);

            tagFilterList.innerHTML = '';

            if (noTagsCount > 0) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tag-filter-item tag-no-tags';
                btn.textContent = `没有标签 (${noTagsCount})`;
                btn.dataset.tagName = '__no_tags__';
                btn.draggable = false;
                btn.classList.toggle('selected', !!manager.tagFilterNoTags);
                btn.title = manager.tagFilterNoTags ? '取消筛选无标签会话' : '筛选没有标签的会话';
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    manager.tagFilterNoTags = !manager.tagFilterNoTags;
                    render();
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                });
                tagFilterList.appendChild(btn);
            }

            tagsToShow.forEach((tag) => {
                const t = String(tag || '').trim();
                if (!t) return;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tag-filter-item';
                const count = tagCounts[t] || 0;
                btn.textContent = `${t} (${count})`;
                btn.dataset.tagName = t;
                const isSelected = selected.includes(t);
                btn.classList.toggle('selected', isSelected);
                btn.title = isSelected ? '取消选择 | 拖拽调整顺序' : '选择标签 | 拖拽调整顺序';
                btn.draggable = true;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (manager.selectedFilterTags === undefined) manager.selectedFilterTags = [];
                    if (!Array.isArray(manager.selectedFilterTags)) manager.selectedFilterTags = [];
                    const idx = manager.selectedFilterTags.indexOf(t);
                    if (idx > -1) manager.selectedFilterTags.splice(idx, 1);
                    else manager.selectedFilterTags.push(t);
                    render();
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                });
                if (typeof manager.attachDragHandlersToTag === 'function') {
                    manager.attachDragHandlersToTag(btn, t, {
                        skipClick: true,
                        skipDomUpdate: true,
                        onAfterReorder: () => {
                            render();
                        }
                    });
                }
                tagFilterList.appendChild(btn);
            });

            if (hasMoreTags && !keyword) {
                const expandBtn = document.createElement('button');
                expandBtn.type = 'button';
                expandBtn.className = 'tag-filter-item tag-expand-btn';
                expandBtn.dataset.tagName = '__expand__';
                expandBtn.draggable = false;
                const remainingCount = filtered.length - visibleCount;
                expandBtn.textContent = manager.tagFilterExpanded ? '收起' : `展开 (${remainingCount})`;
                expandBtn.title = manager.tagFilterExpanded ? '收起标签' : '展开标签';
                expandBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    manager.tagFilterExpanded = !manager.tagFilterExpanded;
                    render();
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                });
                tagFilterList.appendChild(expandBtn);
            }
        };

        tagFilterContainer._render = render;

        searchInput.addEventListener('focus', () => {
            searchContainer.classList.add('focused');
        });
        searchInput.addEventListener('blur', () => {
            searchContainer.classList.remove('focused');
        });

        let searchTimer = null;
        const commitKeyword = (v) => {
            manager.tagFilterSearchKeyword = String(v || '');
            render();
            if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
        };

        searchInput.addEventListener('input', (e) => {
            const v = String(e?.target?.value || '');
            searchClearBtn.classList.toggle('visible', !!String(v || '').trim());
            searchContainer.classList.toggle('has-keyword', !!String(v || '').trim());
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(() => commitKeyword(v), 300);
        });

        searchClearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = null;
            searchInput.value = '';
            commitKeyword('');
        });

        expandToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            manager.tagFilterExpanded = !manager.tagFilterExpanded;
            render();
            if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
        });

        reverseFilterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            manager.tagFilterReverse = !manager.tagFilterReverse;
            render();
            if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
        });

        noTagsFilterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            manager.tagFilterNoTags = !manager.tagFilterNoTags;
            render();
            if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
        });

        clearFilterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const selected = Array.isArray(manager.selectedFilterTags) ? manager.selectedFilterTags : [];
            const hasSelectedTags = selected.length > 0;
            const kw = String(manager.tagFilterSearchKeyword || '').trim();
            const hasActiveFilter = hasSelectedTags || !!manager.tagFilterNoTags || !!kw;
            if (!hasActiveFilter) return;
            manager.selectedFilterTags = [];
            manager.tagFilterNoTags = false;
            manager.tagFilterSearchKeyword = '';
            searchInput.value = '';
            render();
            if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
        });

        render();
        return tagFilterContainer;
    }

    window.PetManager.Components.TagFilter = {
        loadTemplate,
        createComponent,
        createTagFilterElement
    };
})();
