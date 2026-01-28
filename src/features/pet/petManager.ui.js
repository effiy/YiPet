(function () {
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return;
  }
  const proto = window.PetManager.prototype;

  proto.updateTagFilterUI = function () {
    if (!this.sessionSidebar) return;
    if (this.sessionSidebar.querySelector('[data-pet-tag-filter="vue"]')) return;
    const tagList = this.sessionSidebar.querySelector('.tag-filter-list');
    if (!tagList) return;
    const reverseBtn = this.sessionSidebar.querySelector('.tag-filter-reverse');
    const noTagsBtn = this.sessionSidebar.querySelector('.tag-filter-no-tags');
    const clearBtn = this.sessionSidebar.querySelector('.tag-filter-clear-btn');
    const searchInput = this.sessionSidebar.querySelector('.tag-filter-search');
    const searchContainer = this.sessionSidebar.querySelector('.tag-filter-search-container');
    const allTags = typeof this.getAllTags === 'function' ? this.getAllTags() : [];
    const keyword = (this.tagFilterSearchKeyword || '').trim().toLowerCase();
    const filtered = keyword ? allTags.filter(t => t.toLowerCase().includes(keyword)) : allTags;
    const visibleCount = typeof this.tagFilterVisibleCount === 'number' ? this.tagFilterVisibleCount : 8;
    if (reverseBtn) {
      reverseBtn.classList.toggle('active', !!this.tagFilterReverse);
    }
    if (noTagsBtn) {
      noTagsBtn.classList.toggle('active', !!this.tagFilterNoTags);
    }
    if (clearBtn) {
      const hasSelectedTags = this.selectedFilterTags && this.selectedFilterTags.length > 0;
      const hasSearchKeyword = keyword.length > 0;
      const hasActiveFilter = hasSelectedTags || this.tagFilterNoTags || hasSearchKeyword;
      clearBtn.classList.toggle('active', !!hasActiveFilter);
    }
    if (searchInput && searchContainer) {
      searchContainer.classList.toggle('has-keyword', !!keyword);
    }
    tagList.innerHTML = '';

    // Calculate tag counts and no-tags count
    const tagCounts = {};
    let noTagsCount = 0;
    const allSessions = this._getSessionsFromLocal(); // Get all sessions
    allSessions.forEach(session => {
      if (Array.isArray(session.tags) && session.tags.length > 0) {
        session.tags.forEach(tag => {
          if (tag) {
            const t = tag.trim();
            tagCounts[t] = (tagCounts[t] || 0) + 1;
          }
        });
      } else {
        noTagsCount++;
      }
    });

    const selected = Array.isArray(this.selectedFilterTags) ? this.selectedFilterTags : [];
    const hasMoreTags = !this.tagFilterExpanded && filtered.length > visibleCount;
    const tagsToShow = this.tagFilterExpanded ? filtered : filtered.slice(0, visibleCount);

    // 添加"无标签"按钮（如果有无标签的会话）
    if (noTagsCount > 0) {
      const noTagsBtn = document.createElement('button');
      noTagsBtn.className = 'tag-filter-item tag-no-tags';
      noTagsBtn.textContent = `没有标签 (${noTagsCount})`;
      noTagsBtn.dataset.tagName = '__no_tags__';
      noTagsBtn.draggable = false;
      if (this.tagFilterNoTags) {
        noTagsBtn.classList.add('selected');
      }
      noTagsBtn.title = this.tagFilterNoTags ? '取消筛选无标签会话' : '筛选没有标签的会话';
      noTagsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tagFilterNoTags = !this.tagFilterNoTags;
        this.updateTagFilterUI();
        this.updateSessionSidebar();
      });
      tagList.appendChild(noTagsBtn);
    }

    // 添加标签项
    tagsToShow.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'tag-filter-item';
      const count = tagCounts[tag] || 0;
      btn.textContent = `${tag} (${count})`;
      btn.dataset.tagName = tag;
      const isSelected = selected.includes(tag);
      if (isSelected) {
        btn.classList.add('selected');
      }
      btn.title = isSelected ? '取消选择 | 拖拽调整顺序' : '选择标签 | 拖拽调整顺序';
      btn.draggable = true;
      if (typeof this.attachDragHandlersToTag === 'function') {
        this.attachDragHandlersToTag(btn, tag);
      }
      tagList.appendChild(btn);
    });

    // 添加展开/折叠按钮（如果有更多标签且没有搜索关键词）
    if (hasMoreTags && !keyword) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'tag-filter-item tag-expand-btn';
      expandBtn.draggable = false;
      const remainingCount = filtered.length - visibleCount;
      expandBtn.textContent = this.tagFilterExpanded ? '收起' : `展开 (${remainingCount})`;
      expandBtn.title = this.tagFilterExpanded ? '收起标签' : '展开标签';
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tagFilterExpanded = !this.tagFilterExpanded;
        if (typeof this.updateTagFilterUI === 'function') this.updateTagFilterUI();
      });
      tagList.appendChild(expandBtn);
    }
  };

  proto.createSearchInput = function (options) {
    const container = document.createElement('div');
    container.className = 'tag-filter-search-container';

    const input = document.createElement('input');
    if (options.className) input.className = options.className;
    input.classList.add('tag-filter-search-input');
    input.type = 'text';
    input.placeholder = options.placeholder || '';
    input.value = options.value || '';

    input.addEventListener('focus', () => {
      container.classList.add('focused');
    });
    input.addEventListener('blur', () => {
      container.classList.remove('focused');
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'tag-filter-search-clear';
    if (input.value) {
      clearBtn.classList.add('visible');
    }
    clearBtn.textContent = '✕';
    clearBtn.title = '清除';

    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      clearBtn.classList.remove('visible');
      if (typeof options.onClear === 'function') options.onClear();
    });

    let timer = null;
    const debounceMs = typeof options.debounce === 'number' ? options.debounce : 300;
    input.addEventListener('input', (e) => {
      const v = e.target.value || '';
      if (v) {
        clearBtn.classList.add('visible');
      } else {
        clearBtn.classList.remove('visible');
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (typeof options.onChange === 'function') options.onChange(v);
      }, debounceMs);
    });

    container.appendChild(input);
    container.appendChild(clearBtn);
    return { container, input, clearBtn };
  };

  proto.createButton = function (options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const classes = [];
    if (options.className) classes.push(options.className);
    if (options.variant) classes.push(`ui-btn--${options.variant}`);
    if (options.size) classes.push(`ui-btn--${options.size}`);
    classes.push('ui-btn');
    btn.className = classes.join(' ');
    if (options.text) btn.textContent = options.text;
    if (options.icon) btn.innerHTML = options.icon + (options.text ? ` ${options.text}` : '');
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([k, v]) => btn.setAttribute(k, v));
    }
    if (options.onClick) {
      btn.addEventListener('click', options.onClick);
    }
    if (options.style) {
      Object.assign(btn.style, options.style);
    }
    return btn;
  };

  proto.applyViewMode = function () {
    if (!this.sessionSidebar) return;
    const btnSession = this.sessionSidebar.querySelector('#view-toggle-session');
    if (!btnSession) return;
    this.sessionSidebar.dataset.petColorIndex = String(this.colorIndex ?? 0);
    btnSession.classList.add('pet-view-toggle-btn', 'pet-view-toggle-active');
  };
  proto.updateSessionSidebar = async function (forceRefresh = false, skipBackendRefresh = false) {
    if (!this.sessionSidebar) {
      console.log('会话侧边栏未创建，跳过更新');
      return;
    }
    const apiRequestList = this.sessionSidebar.querySelector('.api-request-list');
    if (apiRequestList) {
      apiRequestList.classList.add('js-hidden');
    }
    const apiRequestTagFilterContainer = this.sessionSidebar.querySelector('.api-request-tag-filter-container');
    if (apiRequestTagFilterContainer) {
      apiRequestTagFilterContainer.classList.add('js-hidden');
    }
    const tagFilterContainer = this.sessionSidebar.querySelector('.tag-filter-container');
    const batchToolbar = this.sessionSidebar.querySelector('#batch-toolbar');
    const scrollableContent = this.sessionSidebar.querySelector('.session-sidebar-scrollable-content');
    if (tagFilterContainer) {
      tagFilterContainer.classList.add('js-visible');
    }
    if (batchToolbar) {
      if (this.batchMode) {
        batchToolbar.classList.add('visible', 'js-visible');
        if (this.sessionSidebar) this.sessionSidebar.classList.add('batch-mode-active');
      } else {
        batchToolbar.classList.remove('visible', 'js-visible');
        if (this.sessionSidebar) this.sessionSidebar.classList.remove('batch-mode-active');
      }
    }
    if (scrollableContent) {
      scrollableContent.classList.add('js-visible');
    }
    const searchInput = this.sessionSidebar.querySelector('#session-search-input');
    if (searchInput) {
      searchInput.placeholder = '搜索会话...';
    }
    if (this.tagFilterNoTags === undefined) {
      this.tagFilterNoTags = false;
    }
    this.updateTagFilterUI();
    if (typeof this.applyViewMode === 'function') {
      this.applyViewMode();
    }
    const sessionList = this.sessionSidebar.querySelector('.session-list');
    if (!sessionList) {
      console.log('会话列表容器未找到，跳过更新');
      return;
    }
    sessionList.classList.add('js-visible');
    const prevScrollTop = sessionList.scrollTop;
    let allSessions = this._getFilteredSessions();
    console.log('当前会话数量:', allSessions.length);
    const q = (this.sessionTitleFilter || '').trim();
    const hasFilter = q ||
      (this.selectedFilterTags && this.selectedFilterTags.length > 0) ||
      this.tagFilterNoTags ||
      this.dateRangeFilter;
    const sortedSessions = allSessions.sort((a, b) => {
      const aTags = Array.isArray(a.tags) ? a.tags.map((t) => String(t).trim()) : [];
      const bTags = Array.isArray(b.tags) ? b.tags.map((t) => String(t).trim()) : [];
      const aHasNoTags = aTags.length === 0 || !aTags.some((t) => t);
      const bHasNoTags = bTags.length === 0 || !bTags.some((t) => t);
      const aFavorite = a.isFavorite || false;
      const bFavorite = b.isFavorite || false;
      if (aFavorite !== bFavorite) {
        return bFavorite ? 1 : -1;
      }
      if (aHasNoTags !== bHasNoTags) {
        return aHasNoTags ? -1 : 1;
      }
      const aTime = a.lastAccessTime || a.lastActiveAt || a.updatedAt || a.createdAt || 0;
      const bTime = b.lastAccessTime || b.lastActiveAt || b.updatedAt || b.createdAt || 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      const aTitle = String(a.title || a.id || '').trim();
      const bTitle = String(b.title || b.id || '').trim();
      return aTitle.localeCompare(bTitle);
    });

    const Vue = window.Vue;
    const canRenderWithVue =
      Vue &&
      typeof Vue.createApp === 'function' &&
      typeof Vue.defineComponent === 'function' &&
      typeof Vue.h === 'function' &&
      typeof Vue.ref === 'function' &&
      typeof Vue.nextTick === 'function';

    const evalAllowed = (() => {
      try {
        Function('return 1')();
        return true;
      } catch (_) {
        return false;
      }
    })();
    const canUseTemplate = typeof Vue?.compile === 'function' && evalAllowed;

    const SessionItemCtor = window.PetManager && window.PetManager.Components ? window.PetManager.Components.SessionItem : null;
    const SessionItemFactory = SessionItemCtor && typeof SessionItemCtor.createComponent === 'function'
      ? SessionItemCtor.createComponent
      : null;

    if (canRenderWithVue && canUseTemplate && SessionItemFactory) {
      if (!this._sessionListVueState || this._sessionListVueMount !== sessionList) {
        if (this._sessionListVueApp) {
          try {
            this._sessionListVueApp.unmount();
          } catch (_) { }
        }
        this._sessionListVueApp = null;
        this._sessionListVueMount = sessionList;

        const { createApp, defineComponent, h, ref } = Vue;
        const sessionsRef = ref([]);
        const uiTick =
          this._sidebarUiTickRef && typeof this._sidebarUiTickRef === 'object' && this._sidebarUiTickRef && 'value' in this._sidebarUiTickRef
            ? this._sidebarUiTickRef
            : ref(0);
        this._sidebarUiTickRef = uiTick;
        const bumpUiTick = () => {
          uiTick.value += 1;
        };
        this._bumpSidebarUiTick = bumpUiTick;
        let sessionItemTemplate = '';
        try {
          if (SessionItemCtor && typeof SessionItemCtor.loadTemplate === 'function') {
            sessionItemTemplate = await SessionItemCtor.loadTemplate();
          }
        } catch (_) {
          sessionItemTemplate = '';
        }
        const SessionItem = SessionItemFactory({ manager: this, bumpUiTick, template: sessionItemTemplate });

        const SessionListRoot = defineComponent({
          name: 'YiPetSessionList',
          setup() {
            return { sessionsRef, uiTick };
          },
          render() {
            const sessions = Array.isArray(sessionsRef.value) ? sessionsRef.value : [];
            if (!sessions.length) {
              return h('div', { class: 'session-list-empty' }, '暂无会话');
            }
            return h('div', { class: 'session-list-items' },
              sessions.map((session) =>
                h(SessionItem, { session, uiTick: uiTick.value, key: session?.key || session?.id || session?.title })
              )
            );
          }
        });

        sessionList.innerHTML = '';
        this._sessionListVueState = { sessionsRef, uiTick, bumpUiTick };
        this._sessionListVueApp = createApp(SessionListRoot);
        this._sessionListVueApp.mount(sessionList);
      }

      this._sessionListVueState.sessionsRef.value = sortedSessions;
      this._sessionListVueState.uiTick.value += 1;
      Vue.nextTick(() => {
        sessionList.scrollTop = prevScrollTop;
      });
      console.log('会话侧边栏已更新，显示', sortedSessions.length, '个会话');
      return;
    }

    sessionList.innerHTML = '';
    const listItems = document.createElement('div');
    listItems.className = 'session-list-items';
    let sessionItemTemplate = '';
    try {
      if (SessionItemCtor && typeof SessionItemCtor.loadTemplate === 'function') {
        sessionItemTemplate = await SessionItemCtor.loadTemplate();
      }
    } catch (_) {
      sessionItemTemplate = '';
    }
    for (const session of sortedSessions) {
      if (window.PetManager && window.PetManager.Components && window.PetManager.Components.SessionItem) {
        const sessionItem = new window.PetManager.Components.SessionItem(this, session, { template: sessionItemTemplate });
        listItems.appendChild(sessionItem.element || sessionItem.create());
      }
    }
    sessionList.appendChild(listItems);
    sessionList.scrollTop = prevScrollTop;
    console.log('会话侧边栏已更新，显示', sortedSessions.length, '个会话');
  };

  proto.updateSessionUI = async function (options = {}) {
    const {
      updateSidebar = false,
      updateTitle = false,
      loadMessages = false,
      keepApiRequestListView = false
    } = options;

    if (updateSidebar && typeof this.updateSessionSidebar === 'function') {
      await this.updateSessionSidebar(false, false);
    }

    if (updateTitle && typeof this.updateChatHeaderTitle === 'function') {
      this.updateChatHeaderTitle();
    }

    if (loadMessages && typeof this.loadSessionMessages === 'function') {
      await this.loadSessionMessages();
    }
  };

  proto.loadSidebarWidth = function () {
    try {
      if (typeof chrome === 'undefined' || !chrome?.storage?.local || typeof chrome.storage.local.get !== 'function') return;
      chrome.storage.local.get(['sessionSidebarWidth'], (result) => {
        if (result.sessionSidebarWidth && typeof result.sessionSidebarWidth === 'number') {
          const width = Math.max(320, Math.min(800, result.sessionSidebarWidth));
          this.sidebarWidth = width;
          if (this.sessionSidebar) {
            this.sessionSidebar.style.setProperty('width', `${width}px`, 'important');
          }
        }
      });
    } catch (error) { }
  };
  proto.saveSidebarWidth = function () {
    try {
      if (typeof chrome === 'undefined' || !chrome?.storage?.local || typeof chrome.storage.local.set !== 'function') return;
      chrome.storage.local.set({ sessionSidebarWidth: this.sidebarWidth }, () => { });
    } catch (error) { }
  };
  proto.loadSidebarCollapsed = function () {
    try {
      if (typeof chrome === 'undefined' || !chrome?.storage?.local || typeof chrome.storage.local.get !== 'function') {
        this.sidebarCollapsed = false;
        if (this.chatWindowComponent) {
          this.applySidebarCollapsedState();
        }
        return;
      }
      chrome.storage.local.get(['sessionSidebarCollapsed'], (result) => {
        if (result.sessionSidebarCollapsed !== undefined) {
          this.sidebarCollapsed = result.sessionSidebarCollapsed;
        } else {
          // 如果存储中没有状态，默认显示侧边栏
          this.sidebarCollapsed = false;
        }
        // 应用状态
        if (this.chatWindowComponent) {
          this.applySidebarCollapsedState();
        }
      });
    } catch (error) {
      // 出错时默认显示侧边栏
      this.sidebarCollapsed = false;
      if (this.chatWindowComponent) {
        this.applySidebarCollapsedState();
      }
    }
  };
  proto.saveSidebarCollapsed = function () {
    try {
      if (typeof chrome === 'undefined' || !chrome?.storage?.local || typeof chrome.storage.local.set !== 'function') return;
      chrome.storage.local.set({ sessionSidebarCollapsed: this.sidebarCollapsed }, () => { });
    } catch (error) { }
  };
  proto.applySidebarCollapsedState = function () {
    if (this.chatWindowComponent && typeof this.chatWindowComponent.setSidebarCollapsed === 'function') {
      this.chatWindowComponent.setSidebarCollapsed(this.sidebarCollapsed);
      return;
    }
  };
  
  // 强制显示侧边栏（用于恢复显示）
  proto.showSidebar = function () {
    this.sidebarCollapsed = false;
    this.applySidebarCollapsedState();
    this.saveSidebarCollapsed();
  };
  proto.toggleSidebar = function () {
    if (this.chatWindowComponent && typeof this.chatWindowComponent.toggleSidebar === 'function') {
      this.chatWindowComponent.toggleSidebar();
      return;
    }
  };
  proto.loadInputContainerCollapsed = function () {
    try {
      if (typeof chrome === 'undefined' || !chrome?.storage?.local || typeof chrome.storage.local.get !== 'function') return;
      chrome.storage.local.get(['chatInputContainerCollapsed'], (result) => {
        if (result.chatInputContainerCollapsed !== undefined) {
          this.inputContainerCollapsed = result.chatInputContainerCollapsed;
          if (this.chatWindowComponent) {
            this.applyInputContainerCollapsedState();
          }
        }
      });
    } catch (error) { }
  };
  proto.saveInputContainerCollapsed = function () {
    try {
      if (typeof chrome === 'undefined' || !chrome?.storage?.local || typeof chrome.storage.local.set !== 'function') return;
      chrome.storage.local.set({ chatInputContainerCollapsed: this.inputContainerCollapsed }, () => { });
    } catch (error) { }
  };
  proto.applyInputContainerCollapsedState = function () {
    if (this.chatWindowComponent && typeof this.chatWindowComponent.setInputContainerCollapsed === 'function') {
      this.chatWindowComponent.setInputContainerCollapsed(this.inputContainerCollapsed);
      return;
    }
  };
  proto.toggleInputContainer = function () {
    if (this.chatWindowComponent && typeof this.chatWindowComponent.toggleInputContainer === 'function') {
      this.chatWindowComponent.toggleInputContainer();
      return;
    }
  };
  proto.updateBatchToolbar = function () {
    if (this.sessionSidebar && this.sessionSidebar.querySelector('[data-pet-batch-toolbar="vue"]')) {
      return;
    }
    const selectedCount = document.getElementById('selected-count');
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    const selectAllCheckbox = this._selectAllCheckbox || document.getElementById('select-all-checkbox');

    const count = this.selectedSessionIds.size;

    // 更新已选数量显示（参考 YiWeb 格式：已选 X 项）
    if (selectedCount) {
      if (count > 0) {
        selectedCount.textContent = `已选 ${count} 项`;
        selectedCount.classList.remove('js-hidden');
      } else {
        selectedCount.textContent = '';
        selectedCount.classList.add('js-hidden');
      }
    }

    // 更新删除按钮状态
    if (batchDeleteBtn) {
      batchDeleteBtn.disabled = count === 0;
    }

    // 更新全选 checkbox 状态（参考 YiWeb 实现）
    if (selectAllCheckbox) {
      const filteredSessions = this._getFilteredSessions();
      const allSelected = filteredSessions.length > 0 &&
        filteredSessions.every(session => session.key && this.selectedSessionIds.has(session.key));
      selectAllCheckbox.checked = allSelected;
    }
  };

  // 切换全选/取消全选（参考 YiWeb 实现）
  proto.toggleSelectAll = function () {
    // 会话列表模式
    const filteredSessions = this._getFilteredSessions();
    const allSelected = filteredSessions.length > 0 &&
      filteredSessions.every(session => session.key && this.selectedSessionIds.has(session.key));

    if (allSelected) {
      // 取消全选：只取消当前显示的会话
      filteredSessions.forEach(session => {
        if (session.key) {
          this.selectedSessionIds.delete(session.key);
        }
      });
    } else {
      // 全选：选中所有当前显示的会话
      filteredSessions.forEach(session => {
        if (session.key) {
          this.selectedSessionIds.add(session.key);
        }
      });
    }

    const hasVueSessionList = !!this._sessionListVueApp && this._sessionListVueMount === this.sessionSidebar?.querySelector?.('.session-list');
    const hasVueBatchToolbar = !!this.sessionSidebar?.querySelector?.('[data-pet-batch-toolbar="vue"]');
    if (hasVueSessionList || hasVueBatchToolbar) {
      if (typeof this._bumpSidebarUiTick === 'function') {
        this._bumpSidebarUiTick();
      } else if (typeof this.updateSessionSidebar === 'function') {
        this.updateSessionSidebar();
      }
      return;
    }

    // 更新所有复选框状态和选中类（使用 batch-selected 类，参考 YiWeb）
    const sessionItems = this.sessionSidebar.querySelectorAll('.session-item');
    sessionItems.forEach(item => {
      const sessionId = item.dataset.sessionId;
      const checkbox = item.querySelector('.session-batch-checkbox');
      const isSelected = this.selectedSessionIds.has(sessionId);

      if (checkbox) {
        checkbox.checked = isSelected;
      }

      // 使用 batch-selected 类标记批量选中的会话项
      if (isSelected) {
        item.classList.add('batch-selected');
      } else {
        item.classList.remove('batch-selected');
      }
    });

    // 更新批量工具栏
    this.updateBatchToolbar();
  };

  proto.buildBatchToolbar = function () {
    // 参考 YiWeb 的 session-batch-toolbar 结构
    const toolbar = document.createElement('div');
    toolbar.id = 'batch-toolbar';
    toolbar.className = 'session-batch-toolbar';

    // Left section: 全选 checkbox + 已选数量
    const leftSection = document.createElement('div');
    leftSection.className = 'batch-toolbar-left';

    // 全选 checkbox (参考 YiWeb 的 batch-select-all)
    const selectAllLabel = document.createElement('label');
    selectAllLabel.className = 'batch-select-all';
    
    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.id = 'select-all-checkbox';
    selectAllCheckbox.addEventListener('change', () => {
      this.toggleSelectAll();
    });

    const selectAllText = document.createElement('span');
    selectAllText.textContent = '全选';

    selectAllLabel.appendChild(selectAllCheckbox);
    selectAllLabel.appendChild(selectAllText);
    leftSection.appendChild(selectAllLabel);

    // 已选数量
    const selectedCount = document.createElement('span');
    selectedCount.id = 'selected-count';
    selectedCount.className = 'batch-selected-count';
    selectedCount.classList.add('js-hidden');
    selectedCount.textContent = '';
    leftSection.appendChild(selectedCount);

    // Right section: 删除按钮 + 取消按钮
    const rightSection = document.createElement('div');
    rightSection.className = 'batch-toolbar-right';

    // 删除按钮
    const batchDeleteBtn = document.createElement('button');
    batchDeleteBtn.type = 'button';
    batchDeleteBtn.id = 'batch-delete-btn';
    batchDeleteBtn.className = 'batch-action-btn batch-delete-btn';
    batchDeleteBtn.disabled = true;
    batchDeleteBtn.title = '删除选中会话';

    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'fas fa-trash-alt';
    const deleteText = document.createTextNode(' 删除');
    batchDeleteBtn.appendChild(deleteIcon);
    batchDeleteBtn.appendChild(deleteText);

    batchDeleteBtn.addEventListener('click', async () => {
      if (batchDeleteBtn.disabled) return;
      const originalContent = batchDeleteBtn.innerHTML;
      batchDeleteBtn.disabled = true;
      batchDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';
      try {
        await this.batchDeleteSessions();
      } finally {
        batchDeleteBtn.disabled = false;
        batchDeleteBtn.innerHTML = originalContent;
      }
    });

    // 取消按钮
    const cancelBatchBtn = document.createElement('button');
    cancelBatchBtn.type = 'button';
    cancelBatchBtn.className = 'batch-action-btn batch-cancel-btn';
    cancelBatchBtn.textContent = '取消';
    cancelBatchBtn.title = '退出批量模式';
    cancelBatchBtn.addEventListener('click', () => {
      this.exitBatchMode();
    });

    rightSection.appendChild(batchDeleteBtn);
    rightSection.appendChild(cancelBatchBtn);

    toolbar.appendChild(leftSection);
    toolbar.appendChild(rightSection);

    // 保存 checkbox 引用以便更新状态
    this._selectAllCheckbox = selectAllCheckbox;

    return toolbar;
  };
  // 批量删除（支持会话、文件和请求接口）
  proto.batchDeleteSessions = async function () {
    const sessionList = this.sessionSidebar.querySelector('.session-list');
    // 批量删除会话
    if (this.selectedSessionIds.size === 0) {
      this.showNotification('请先选择要删除的会话', 'error');
      return;
    }

    const count = this.selectedSessionIds.size;
    const confirmMessage = `确定要删除选中的 ${count} 个会话吗？此操作不可撤销。`;
    if (!confirm(confirmMessage)) {
      return;
    }

    const sessionIds = Array.from(this.selectedSessionIds);

    try {
      // 同时收集会话信息用于删除 aicr 项目文件
      const sessionsToDelete = [];
      sessionIds.forEach(sessionId => {
        const session = this.sessions[sessionId];
        if (session) {
          sessionsToDelete.push({
            sessionId,
            unifiedSessionId: session.key || sessionId
          });
        }
      });

      // 从本地删除
      sessionIds.forEach(sessionId => {
        if (this.sessions[sessionId]) {
          delete this.sessions[sessionId];
        }
        // 如果删除的是当前会话，清空当前会话ID
        if (sessionId === this.currentSessionId) {
          this.currentSessionId = null;
          this.hasAutoCreatedSessionForPage = false;
        }
      });

      // 保存本地更改
      if (this.sessionManager) {
        // 使用 SessionManager 批量删除
        for (const sessionId of sessionIds) {
          await this.sessionManager.deleteSession(sessionId);
        }
      } else {
        // 保存到本地存储
        await this.saveAllSessions(true);
      }

      // 从后端删除（如果启用了后端同步）
      if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
        try {
          await this.sessionApi.deleteSessions(sessionIds);
          console.log('批量删除会话已同步到后端:', sessionIds);
        } catch (error) {
          console.warn('从后端批量删除会话失败:', error);
          // 即使后端删除失败，也继续执行，因为本地已删除
        }
      }

      // 清空选中状态
      this.selectedSessionIds.clear();

      // 退出批量模式
      this.exitBatchMode();

      // 刷新会话列表
      await this.updateSessionSidebar(true);

      // 显示成功通知
      this.showNotification(`已成功删除 ${count} 个会话`, 'success');

    } catch (error) {
      console.error('批量删除会话失败:', error);
      this.showNotification('批量删除会话失败: ' + error.message, 'error');
    }
  };

  // 创建侧边栏拖拽调整边框
  proto.createSidebarResizer = function () {
    if (!this.sessionSidebar) return;

    const resizer = document.createElement('div');
    resizer.className = 'sidebar-resizer';

    // 鼠标悬停效果
    resizer.addEventListener('mouseenter', () => {
      if (!this.isResizingSidebar) {
        resizer.classList.add('hover');
      }
    });

    resizer.addEventListener('mouseleave', () => {
      if (!this.isResizingSidebar) {
        resizer.classList.remove('hover');
      }
    });

    // 双击重置宽度
    let lastClickTime = 0;
    resizer.addEventListener('click', (e) => {
      const currentTime = Date.now();
      if (currentTime - lastClickTime < 300) {
        // 双击重置为默认宽度
        const defaultWidth = 320;
        this.sidebarWidth = defaultWidth;
        if (this.sessionSidebar) {
          this.sessionSidebar.style.setProperty('width', `${defaultWidth}px`, 'important');
        }
        this.updateToggleButtonPosition(defaultWidth);
        this.saveSidebarWidth();
        e.preventDefault();
        e.stopPropagation();
      }
      lastClickTime = currentTime;
    });

    // 拖拽开始
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      this.isResizingSidebar = true;
      resizer.classList.add('dragging');
      resizer.classList.remove('hover');

      // 记录初始位置和宽度
      const startX = e.clientX;
      const startWidth = this.sidebarWidth;

      // 添加全局样式，禁用文本选择
      document.body.classList.add('pet-is-resizing');

      // 使用 requestAnimationFrame 优化性能
      let rafId = null;
      let pendingWidth = startWidth;

      // 更新宽度和按钮位置的辅助函数
      const updateWidth = (newWidth) => {
        // 限制宽度范围
        newWidth = Math.max(150, Math.min(500, newWidth));
        pendingWidth = newWidth;
        
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            this.sidebarWidth = pendingWidth;
            if (this.sessionSidebar) {
              this.sessionSidebar.style.setProperty('width', `${pendingWidth}px`, 'important');
            }
            this.updateToggleButtonPosition(pendingWidth);
            rafId = null;
          });
        }
      };

      // 拖拽中
      const handleMouseMove = (e) => {
        if (!this.isResizingSidebar) return;

        const diffX = e.clientX - startX;
        const newWidth = startWidth + diffX;
        updateWidth(newWidth);
      };

      // 防抖保存函数
      let saveTimeout = null;
      const debouncedSave = () => {
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
          this.saveSidebarWidth();
        }, 300);
      };

      // 拖拽结束
      const handleMouseUp = () => {
        // 取消待处理的动画帧
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }

        // 确保最终宽度已应用
        if (this.sessionSidebar) {
          this.sessionSidebar.style.setProperty('width', `${pendingWidth}px`, 'important');
        }
        this.sidebarWidth = pendingWidth;
        this.updateToggleButtonPosition(pendingWidth);

        this.isResizingSidebar = false;
        resizer.classList.remove('dragging');
        resizer.classList.remove('hover');

        // 恢复全局样式
      document.body.classList.remove('pet-is-resizing');

        // 立即保存宽度
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }
        this.saveSidebarWidth();

        // 移除事件监听器
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      // 添加全局事件监听器
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });

    this.sessionSidebar.appendChild(resizer);
  };

  // 更新折叠按钮位置的辅助方法
  // 按钮位置现在由 CSS 控制，始终在 title 左边，不再需要根据侧边栏宽度动态设置
  proto.updateToggleButtonPosition = function (width) {
    const toggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
    if (toggleBtn) {
      // 按钮位置由 CSS 控制，始终在 title 左边
      // 只需要确保 transform 样式正确（保留scale用于hover效果）
      const currentTransform = toggleBtn.style.transform;
      const baseTransform = 'translateY(-50%)';
      if (!currentTransform.includes('scale')) {
        toggleBtn.style.transform = baseTransform;
      } else {
        const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
        if (scaleMatch) {
          toggleBtn.style.transform = `${baseTransform} ${scaleMatch[0]}`;
        } else {
          toggleBtn.style.transform = baseTransform;
        }
      }
      // 注意：不在这里调用 chatWindowComponent.updateSidebarToggleButton，避免循环调用
      // updateSidebarToggleButton 会在 setSidebarCollapsed 时自动调用
    }
  };

})();
