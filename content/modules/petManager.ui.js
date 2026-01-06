(function () {
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return;
  }
  const proto = window.PetManager.prototype;

  proto.updateSessionSidebar = async function (forceRefresh = false, skipBackendRefresh = false) {
    if (!this.sessionSidebar) {
      return;
    }

    if (typeof this.attachTagDragStyles === 'function') {
      this.attachTagDragStyles();
    }

    const apiRequestList = this.sessionSidebar.querySelector('.api-request-list');
    if (apiRequestList) {
      apiRequestList.style.display = 'none';
    }
    const apiRequestTagFilterContainer = this.sessionSidebar.querySelector('.api-request-tag-filter-container');
    if (apiRequestTagFilterContainer) {
      apiRequestTagFilterContainer.style.display = 'none';
    }
    const tagFilterContainer = this.sessionSidebar.querySelector('.tag-filter-container');
    const batchToolbar = this.sessionSidebar.querySelector('#batch-toolbar');
    const scrollableContent = this.sessionSidebar.querySelector('.session-sidebar-scrollable-content');
    if (tagFilterContainer) {
      tagFilterContainer.style.display = 'block';
    }
    if (batchToolbar && this.batchMode) {
      batchToolbar.style.display = 'flex';
    }
    if (scrollableContent) {
      scrollableContent.style.display = 'flex';
    }
    const searchInput = this.sessionSidebar.querySelector('#session-search-input');
    if (searchInput) {
      searchInput.placeholder = '搜索会话...';
    }
    if (this.tagFilterNoTags === undefined) {
      this.tagFilterNoTags = false;
    }
    this.updateTagFilterUI();
    this.applyViewMode();

    const sessionList = this.sessionSidebar.querySelector('.session-list');
    if (!sessionList) {
      return;
    }
    sessionList.style.display = 'block';

    let allSessions = this._getFilteredSessions();
    sessionList.innerHTML = '';

    if (allSessions.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = `
        padding: 20px !important;
        text-align: center !important;
        color: #9ca3af !important;
        font-size: 12px !important;
      `;
      emptyMsg.textContent = '暂无会话';
      sessionList.appendChild(emptyMsg);
      return;
    }

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
      if (!aFavorite && !bFavorite) {
        if (aHasNoTags !== bHasNoTags) {
          return bHasNoTags ? 1 : -1;
        }
      }
      if (!hasFilter) {
        const aTime = a.updatedAt || a.lastAccessTime || a.lastActiveAt || a.createdAt || 0;
        const bTime = b.updatedAt || b.lastAccessTime || b.lastActiveAt || b.createdAt || 0;
        if (aTime !== bTime) {
          return bTime - aTime;
        }
        const aId = a.id || '';
        const bId = b.id || '';
        return aId.localeCompare(bId);
      } else {
        const aTitle = (a.pageTitle || a.title || '').trim();
        const bTitle = (b.pageTitle || b.title || '').trim();
        const titleCompare = aTitle.localeCompare(bTitle, 'zh-CN', { numeric: true, sensitivity: 'base' });
        if (titleCompare !== 0) {
          return titleCompare;
        }
        const aTime = a.updatedAt || a.createdAt || 0;
        const bTime = b.updatedAt || b.createdAt || 0;
        if (aTime !== bTime) {
          return bTime - aTime;
        }
        const aId = a.id || '';
        const bId = b.id || '';
        return aId.localeCompare(bId);
      }
    });

    for (let index = 0; index < sortedSessions.length; index++) {
      const session = sortedSessions[index];
      if (!session || !session.id) continue;
      const sessionItem = document.createElement('div');
      sessionItem.className = 'session-item';
      sessionItem.dataset.sessionId = session.id;
      let isActive = false;
      if (session.id === this.currentSessionId) {
        isActive = true;
        sessionItem.classList.add('active');
      }
      if (this.batchMode && this.selectedSessionIds.has(session.id)) {
        sessionItem.classList.add('selected');
      }
      sessionItem.style.cssText = `
        padding: 12px !important;
        margin-bottom: 8px !important;
        background: ${isActive ? '#eff6ff' : '#ffffff'} !important;
        border: 1px solid ${isActive ? '#3b82f6' : '#e5e7eb'} !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        box-shadow: ${isActive ? '0 2px 4px rgba(59, 130, 246, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.05)'} !important;
        position: relative !important;
      `;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'session-checkbox';
      checkbox.dataset.sessionId = session.id;
      checkbox.checked = this.selectedSessionIds.has(session.id);
      checkbox.style.cssText = `
        width: 16px !important;
        height: 16px !important;
        cursor: pointer !important;
        margin-right: 8px !important;
        flex-shrink: 0 !important;
        display: ${this.batchMode ? 'block' : 'none'} !important;
      `;
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const sessionId = e.target.dataset.sessionId;
        if (e.target.checked) {
          this.selectedSessionIds.add(sessionId);
          sessionItem.classList.add('selected');
        } else {
          this.selectedSessionIds.delete(sessionId);
          sessionItem.classList.remove('selected');
        }
        this.updateBatchToolbar();
      });
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      const fullTitle = this._getSessionDisplayTitle(session);
      const sessionInfo = document.createElement('div');
      sessionInfo.className = 'session-info';
      sessionInfo.style.cssText = `
        margin-bottom: ${this.batchMode ? '0' : '8px'} !important;
      `;
      const itemInner = document.createElement('div');
      itemInner.style.cssText = `
        display: flex !important;
        align-items: flex-start !important;
        width: 100% !important;
        gap: 8px !important;
      `;
      itemInner.appendChild(checkbox);
      const contentWrapper = document.createElement('div');
      contentWrapper.style.cssText = `
        flex: 1 !important;
        min-width: 0 !important;
      `;
      const titleRow = document.createElement('div');
      titleRow.style.cssText = `
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 8px !important;
        width: 100% !important;
        margin-bottom: 6px !important;
      `;
      const titleContainer = document.createElement('div');
      titleContainer.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        flex: 1 !important;
        min-width: 0 !important;
      `;
      const titleDiv = document.createElement('div');
      titleDiv.className = 'session-title';
      titleDiv.textContent = fullTitle;
      titleDiv.style.cssText = `
        font-size: 14px !important;
        font-weight: 600 !important;
        color: #111827 !important;
        line-height: 1.4 !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        flex: 1 !important;
        min-width: 0 !important;
      `;
      titleContainer.appendChild(titleDiv);
      titleRow.appendChild(titleContainer);
      const shouldShowEditBtn = session && session.id;
      let editBtn = null;
      if (shouldShowEditBtn) {
        editBtn = document.createElement('button');
        editBtn.className = 'session-edit-btn';
        editBtn.innerHTML = '✏️';
        editBtn.title = '编辑标题';
        editBtn.style.cssText = `
          background: none !important;
          border: none !important;
          cursor: pointer !important;
          padding: 2px 4px !important;
          font-size: 12px !important;
          opacity: 0.6 !important;
          transition: opacity 0.2s ease !important;
          line-height: 1 !important;
          flex-shrink: 0 !important;
        `;
        editBtn.addEventListener('mouseenter', () => {
          editBtn.style.opacity = '1';
        });
        editBtn.addEventListener('mouseleave', () => {
          editBtn.style.opacity = '0.6';
        });
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.editSessionTitle(session.id);
        });
      }
      const tagBtn = document.createElement('button');
      tagBtn.className = 'session-tag-btn';
      tagBtn.innerHTML = '🏷️';
      tagBtn.title = '管理标签';
      tagBtn.style.cssText = `
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        padding: 2px 4px !important;
        font-size: 12px !important;
        opacity: 0.6 !important;
        transition: opacity 0.2s ease !important;
        line-height: 1 !important;
        flex-shrink: 0 !important;
      `;
      tagBtn.addEventListener('mouseenter', () => {
        tagBtn.style.opacity = '1';
      });
      tagBtn.addEventListener('mouseleave', () => {
        tagBtn.style.opacity = '0.6';
      });
      tagBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openTagManager(session.id);
      });
      const duplicateBtn = document.createElement('button');
      duplicateBtn.className = 'session-duplicate-btn';
      duplicateBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      `;
      duplicateBtn.title = '创建副本';
      duplicateBtn.style.cssText = `
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        padding: 4px !important;
        opacity: 0.6 !important;
        transition: all 0.2s ease !important;
        line-height: 1 !important;
        flex-shrink: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: inherit !important;
        border-radius: 4px !important;
      `;
      duplicateBtn.addEventListener('mouseenter', () => {
        duplicateBtn.style.opacity = '1';
        duplicateBtn.style.background = 'rgba(255, 255, 255, 0.1) !important';
      });
      duplicateBtn.addEventListener('mouseleave', () => {
        duplicateBtn.style.opacity = '0.6';
        duplicateBtn.style.background = 'none !important';
      });
      duplicateBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.duplicateSession(session.id);
      });
      const contextBtn = document.createElement('button');
      contextBtn.className = 'session-context-btn';
      contextBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      `;
      contextBtn.title = '页面上下文';
      contextBtn.style.cssText = `
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        padding: 4px !important;
        opacity: 0.6 !important;
        transition: all 0.2s ease !important;
        line-height: 1 !important;
        flex-shrink: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: inherit !important;
        border-radius: 4px !important;
      `;
      contextBtn.addEventListener('mouseenter', () => {
        contextBtn.style.opacity = '1';
        contextBtn.style.background = 'rgba(255, 255, 255, 0.1) !important';
      });
      contextBtn.addEventListener('mouseleave', () => {
        contextBtn.style.opacity = '0.6';
        contextBtn.style.background = 'none !important';
      });
      contextBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (session.id !== this.currentSessionId) {
          await this.activateSession(session.id);
        }
        if (!this.chatWindow || !this.isChatOpen) {
          await this.openChatWindow();
        }
        this.openContextEditor();
      });
      let openUrlBtn = null;
      if (session.url && session.url.startsWith('https://')) {
        openUrlBtn = document.createElement('button');
        openUrlBtn.className = 'session-open-url-btn';
        openUrlBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        `;
        openUrlBtn.title = '在新标签页打开';
        openUrlBtn.style.cssText = `
          background: none !important;
          border: none !important;
          cursor: pointer !important;
          padding: 4px !important;
          opacity: 0.6 !important;
          transition: all 0.2s ease !important;
          line-height: 1 !important;
          flex-shrink: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: inherit !important;
          border-radius: 4px !important;
        `;
        openUrlBtn.addEventListener('mouseenter', () => {
          openUrlBtn.style.opacity = '1';
          openUrlBtn.style.background = 'rgba(255, 255, 255, 0.1) !important';
        });
        openUrlBtn.addEventListener('mouseleave', () => {
          openUrlBtn.style.opacity = '0.6';
          openUrlBtn.style.background = 'none !重要';
        });
        openUrlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.open(session.url, '_blank');
        });
      }
      const buttonGroup = document.createElement('div');
      buttonGroup.style.cssText = `
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        flex-shrink: 0 !important;
      `;
      if (editBtn) buttonGroup.appendChild(editBtn);
      if (tagBtn) buttonGroup.appendChild(tagBtn);
      if (duplicateBtn) buttonGroup.appendChild(duplicateBtn);
      if (contextBtn) buttonGroup.appendChild(contextBtn);
      if (openUrlBtn) buttonGroup.appendChild(openUrlBtn);
      titleRow.appendChild(buttonGroup);
      contentWrapper.appendChild(titleRow);
      itemInner.appendChild(contentWrapper);
      sessionItem.appendChild(itemInner);
      sessionItem.addEventListener('click', async () => {
        if (this.batchMode) {
          if (this.selectedSessionIds.has(session.id)) {
            this.selectedSessionIds.delete(session.id);
            sessionItem.classList.remove('selected');
          } else {
            this.selectedSessionIds.add(session.id);
            sessionItem.classList.add('selected');
          }
          this.updateBatchToolbar();
          return;
        }
        if (session.id === this.currentSessionId) {
          return;
        }
        await this.activateSession(session.id);
      });
      sessionList.appendChild(sessionItem);
    }
  };

  proto.updateTagFilterUI = function () {
    if (!this.sessionSidebar) return;
    const reverseFilterBtn = this.sessionSidebar.querySelector('.tag-filter-reverse');
    if (reverseFilterBtn) {
      reverseFilterBtn.style.color = this.tagFilterReverse ? '#4CAF50' : '#9ca3af';
      reverseFilterBtn.style.opacity = this.tagFilterReverse ? '1' : '0.6';
    }
    const noTagsFilterBtn = this.sessionSidebar.querySelector('.tag-filter-no-tags');
    if (noTagsFilterBtn) {
      noTagsFilterBtn.style.color = this.tagFilterNoTags ? '#4CAF50' : '#9ca3af';
      noTagsFilterBtn.style.opacity = this.tagFilterNoTags ? '1' : '0.6';
    }
    const clearFilterBtn = this.sessionSidebar.querySelector('.tag-filter-clear');
    if (clearFilterBtn) {
      const hasSelectedTags = this.selectedFilterTags && this.selectedFilterTags.length > 0;
      const hasSearchKeyword = this.tagFilterSearchKeyword && this.tagFilterSearchKeyword.trim() !== '';
      const hasActiveFilter = hasSelectedTags || this.tagFilterNoTags || hasSearchKeyword;
      clearFilterBtn.style.opacity = hasActiveFilter ? '0.8' : '0.4';
      clearFilterBtn.style.cursor = hasActiveFilter ? 'pointer' : 'default';
    }
    const tagFilterList = this.sessionSidebar.querySelector('.tag-filter-list');
    if (!tagFilterList) return;
    tagFilterList.innerHTML = '';
    const allTags = this.getAllTags();
    let filteredTags = allTags;
    const searchKeyword = (this.tagFilterSearchKeyword || '').trim().toLowerCase();
    if (searchKeyword) {
      filteredTags = allTags.filter(tag =>
        tag.toLowerCase().includes(searchKeyword)
      );
    }
    if (filteredTags.length === 0) {
      const expandToggleBtn = this.sessionSidebar.querySelector('.tag-filter-expand-btn');
      if (expandToggleBtn) {
        expandToggleBtn.style.display = 'none';
      }
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = searchKeyword ? '未找到匹配的标签' : '暂无标签';
      emptyMsg.style.cssText = `
        padding: 8px !important;
        text-align: center !important;
        color: #9ca3af !important;
        font-size: 11px !important;
      `;
      tagFilterList.appendChild(emptyMsg);
      return;
    }
    const selectedTags = this.selectedFilterTags || [];
    let visibleTags;
    let hasMoreTags;
    if (this.tagFilterExpanded || searchKeyword) {
      visibleTags = filteredTags;
      hasMoreTags = false;
    } else {
      const defaultVisible = filteredTags.slice(0, this.tagFilterVisibleCount);
      const selectedNotInDefault = selectedTags.filter(tag => !defaultVisible.includes(tag));
      const visibleSet = new Set([...defaultVisible, ...selectedNotInDefault]);
      visibleTags = filteredTags.filter(tag => visibleSet.has(tag));
      hasMoreTags = filteredTags.length > visibleTags.length;
    }
    const expandToggleBtn = this.sessionSidebar.querySelector('.tag-filter-expand-btn');
    if (expandToggleBtn) {
      if (searchKeyword) {
        expandToggleBtn.style.display = 'none';
      } else if (hasMoreTags || this.tagFilterExpanded) {
        expandToggleBtn.style.display = 'block';
        if (this.tagFilterExpanded) {
          expandToggleBtn.innerHTML = '▲';
          expandToggleBtn.title = '收起标签';
        } else {
          expandToggleBtn.innerHTML = '▼';
          expandToggleBtn.title = '展开标签';
        }
      } else {
        expandToggleBtn.style.display = 'none';
      }
    }
    const tagCounts = {};
    const allSessions = this._getSessionsFromLocal();
    let noTagsCount = 0;
    allSessions.forEach(session => {
      const sessionTags = session.tags || [];
      const hasTags = sessionTags.length > 0 && sessionTags.some(t => t && t.trim());
      if (!hasTags) {
        noTagsCount++;
      } else if (Array.isArray(sessionTags)) {
        sessionTags.forEach(t => {
          if (t && t.trim()) {
            const normalizedTag = t.trim();
            tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
          }
        });
      }
    });
    tagFilterList.style.cssText += `
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 6px !important;
      position: relative !important;
    `;
    if (typeof this.attachTagDragStyles === 'function') {
      this.attachTagDragStyles();
    }
    const noTagsBtn = document.createElement('button');
    noTagsBtn.className = 'tag-filter-item tag-filter-no-tags-item';
    noTagsBtn.draggable = false;
    noTagsBtn.dataset.tagName = '__no_tags__';
    noTagsBtn.textContent = `没有标签 (${noTagsCount})`;
    noTagsBtn.title = '点击筛选没有标签的会话';
    const isNoTagsSelected = this.tagFilterNoTags || false;
    noTagsBtn.style.cssText = `
      padding: 4px 10px !important;
      border-radius: 12px !important;
      border: 1.5px solid ${isNoTagsSelected ? '#4CAF50' : '#e5e7eb'} !important;
      background: ${isNoTagsSelected ? '#4CAF50' : '#f9fafb'} !important;
      color: ${isNoTagsSelected ? 'white' : '#6b7280'} !important;
      font-size: 10px !important;
      font-weight: ${isNoTagsSelected ? '500' : '400'} !important;
      cursor: pointer !important;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      white-space: nowrap !important;
      line-height: 1.4 !important;
      position: relative !important;
      user-select: none !important;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
    `;
    noTagsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.tagFilterNoTags = !this.tagFilterNoTags;
      this.updateTagFilterUI();
      this.updateSessionSidebar();
    });
    noTagsBtn.addEventListener('mouseenter', () => {
      if (!isNoTagsSelected) {
        noTagsBtn.style.background = '#f3f4f6';
        noTagsBtn.style.borderColor = '#d1d5db';
      }
    });
    noTagsBtn.addEventListener('mouseleave', () => {
      if (!isNoTagsSelected) {
        noTagsBtn.style.background = '#f9fafb';
        noTagsBtn.style.borderColor = '#e5e7eb';
      }
    });
    tagFilterList.appendChild(noTagsBtn);
    visibleTags.forEach((tag) => {
      const tagBtn = document.createElement('button');
      tagBtn.className = 'tag-filter-item';
      tagBtn.draggable = true;
      tagBtn.dataset.tagName = tag;
      const count = tagCounts[tag] || 0;
      tagBtn.textContent = `${tag} (${count})`;
      tagBtn.title = `拖拽调整顺序 | 点击筛选`;
      const isSelected = this.selectedFilterTags && this.selectedFilterTags.includes(tag);
      tagBtn.style.cssText = `
        padding: 4px 10px !important;
        border-radius: 12px !important;
        border: 1.5px solid ${isSelected ? '#4CAF50' : '#e5e7eb'} !important;
        background: ${isSelected ? '#4CAF50' : '#f9fafb'} !important;
        color: ${isSelected ? 'white' : '#6b7280'} !important;
        font-size: 10px !important;
        font-weight: ${isSelected ? '500' : '400'} !important;
        cursor: grab !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        white-space: nowrap !important;
        line-height: 1.4 !important;
        position: relative !important;
        user-select: none !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
      `;
      if (typeof this.attachDragHandlersToTag === 'function') {
        this.attachDragHandlersToTag(tagBtn, tag);
      }
      tagFilterList.appendChild(tagBtn);
    });
  };

  proto.toggleSidebar = function () {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    if (typeof this.applySidebarCollapsedState === 'function') {
      this.applySidebarCollapsedState();
    }
    if (typeof this.saveSidebarCollapsed === 'function') {
      this.saveSidebarCollapsed();
    }
    const toggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('.toggle-icon');
      if (icon) {
        icon.style.opacity = '0.3';
        icon.style.transform = 'scale(0.8)';
        setTimeout(() => {
          icon.textContent = this.sidebarCollapsed ? '▶' : '◀';
          icon.style.opacity = '1';
          icon.style.transform = 'scale(1)';
        }, 125);
      }
      toggleBtn.title = this.sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏';
      if (this.sidebarCollapsed) {
        toggleBtn.style.left = '0px';
      } else {
        toggleBtn.style.left = `${this.sidebarWidth}px`;
      }
      const currentTransform = toggleBtn.style.transform;
      const baseTransform = 'translateY(-50%) translateX(14px)';
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
    }
  };

  proto.loadSidebarWidth = function () {
    try {
      chrome.storage.local.get(['sessionSidebarWidth'], (result) => {
        if (result.sessionSidebarWidth && typeof result.sessionSidebarWidth === 'number') {
          const width = Math.max(150, Math.min(500, result.sessionSidebarWidth));
          this.sidebarWidth = width;
          if (this.sessionSidebar) {
            this.sessionSidebar.style.setProperty('width', `${width}px`, 'important');
          }
        }
      });
    } catch (error) {
    }
  };

  proto.saveSidebarWidth = function () {
    try {
      chrome.storage.local.set({ sessionSidebarWidth: this.sidebarWidth }, () => {
      });
    } catch (error) {
    }
  };

  proto.loadSidebarCollapsed = function () {
    try {
      chrome.storage.local.get(['sessionSidebarCollapsed'], (result) => {
        if (result.sessionSidebarCollapsed !== undefined) {
          this.sidebarCollapsed = result.sessionSidebarCollapsed;
          if (this.sessionSidebar) {
            this.applySidebarCollapsedState();
          }
        }
      });
    } catch (error) {
    }
  };

  proto.saveSidebarCollapsed = function () {
    try {
      chrome.storage.local.set({ sessionSidebarCollapsed: this.sidebarCollapsed }, () => {
      });
    } catch (error) {
    }
  };

  proto.applySidebarCollapsedState = function () {
    if (!this.sessionSidebar) return;
    if (this.sidebarCollapsed) {
      this.sessionSidebar.style.setProperty('display', 'none', 'important');
    } else {
      this.sessionSidebar.style.setProperty('display', 'flex', 'important');
    }
  };

  proto.createSidebarResizer = function () {
    if (!this.sessionSidebar) return;
    const resizer = document.createElement('div');
    resizer.className = 'sidebar-resizer';
    resizer.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      right: -4px !important;
      width: 8px !important;
      height: 100% !important;
      cursor: col-resize !important;
      z-index: 10 !important;
      background: transparent !important;
      transition: background 0.2s ease !important;
    `;
    resizer.addEventListener('mouseenter', () => {
      if (!this.isResizingSidebar) {
        resizer.style.setProperty('background', 'rgba(59, 130, 246, 0.3)', 'important');
      }
    });
    resizer.addEventListener('mouseleave', () => {
      if (!this.isResizingSidebar) {
        resizer.style.setProperty('background', 'transparent', 'important');
      }
    });
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizingSidebar = true;
      resizer.style.setProperty('background', 'rgba(59, 130, 246, 0.5)', 'important');
      resizer.style.setProperty('cursor', 'col-resize', 'important');
      const startX = e.clientX;
      const startWidth = this.sidebarWidth;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      const handleMouseMove = (e2) => {
        if (!this.isResizingSidebar) return;
        const diffX = e2.clientX - startX;
        let newWidth = startWidth + diffX;
        newWidth = Math.max(150, Math.min(500, newWidth));
        this.sidebarWidth = newWidth;
        if (this.sessionSidebar) {
          this.sessionSidebar.style.setProperty('width', `${newWidth}px`, 'important');
        }
        const toggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        if (toggleBtn && !this.sidebarCollapsed) {
          toggleBtn.style.left = `${newWidth}px`;
          const currentTransform = toggleBtn.style.transform;
          const baseTransform = 'translateY(-50%) translateX(14px)';
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
        }
      };
      const handleMouseUp = () => {
        this.isResizingSidebar = false;
        resizer.style.setProperty('background', 'transparent', 'important');
        resizer.style.setProperty('cursor', 'col-resize', 'important');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        this.saveSidebarWidth();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
    this.sessionSidebar.appendChild(resizer);
  };

  proto.loadInputContainerCollapsed = function () {
    try {
      chrome.storage.local.get(['chatInputContainerCollapsed'], (result) => {
        if (result.chatInputContainerCollapsed !== undefined) {
          this.inputContainerCollapsed = result.chatInputContainerCollapsed;
          if (this.chatWindow) {
            this.applyInputContainerCollapsedState();
          }
        }
      });
    } catch (error) {
    }
  };

  proto.saveInputContainerCollapsed = function () {
    try {
      chrome.storage.local.set({ chatInputContainerCollapsed: this.inputContainerCollapsed }, () => {
      });
    } catch (error) {
    }
  };

  proto.applyInputContainerCollapsedState = function () {
    if (!this.chatWindow) return;
    const inputContainer = this.chatWindow.querySelector('.chat-input-container');
    if (!inputContainer) return;
    if (this.inputContainerCollapsed) {
      inputContainer.style.setProperty('display', 'none', 'important');
    } else {
      inputContainer.style.setProperty('display', 'flex', 'important');
    }
    const toggleBtn = this.chatWindow.querySelector('#input-container-toggle-btn');
    if (toggleBtn) {
      setTimeout(() => {
        const inputHeight = inputContainer.offsetHeight || 160;
        if (this.inputContainerCollapsed) {
          toggleBtn.style.bottom = '0px';
        } else {
          toggleBtn.style.bottom = `${inputHeight}px`;
        }
      }, 50);
    }
  };

  proto.toggleInputContainer = function () {
    this.inputContainerCollapsed = !this.inputContainerCollapsed;
    this.applyInputContainerCollapsedState();
    this.saveInputContainerCollapsed();
    const toggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('.toggle-icon');
      if (icon) {
        icon.style.opacity = '0.3';
        icon.style.transform = 'scale(0.8)';
        setTimeout(() => {
          icon.textContent = this.inputContainerCollapsed ? '▲' : '▼';
          icon.style.opacity = '1';
          icon.style.transform = 'scale(1)';
        }, 125);
      }
      toggleBtn.title = this.inputContainerCollapsed ? '展开输入框' : '折叠输入框';
      const inputContainer = this.chatWindow?.querySelector('.chat-input-container');
      if (inputContainer) {
        if (this.inputContainerCollapsed) {
          toggleBtn.style.bottom = '0px';
        } else {
          const inputHeight = inputContainer.offsetHeight || 160;
          toggleBtn.style.bottom = `${inputHeight}px`;
        }
      }
      const currentTransform = toggleBtn.style.transform;
      const baseTransform = 'translateX(-50%) translateY(-8px)';
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
    }
  };

    // 统一更新UI（侧边栏、标题等）
    proto.updateSessionUI = async function(options = {}) {
        const {
            updateSidebar = true,
            updateTitle = true,
            loadMessages = false,
            highlightSessionId = null,
            keepApiRequestListView = false
        } = options;

        if (updateSidebar && this.sessionSidebar) {
            await this.updateSessionSidebar(false, false);
        }

        if (updateTitle) {
            this.updateChatHeaderTitle();
        }

        if (loadMessages && this.chatWindow && this.isChatOpen) {
            await this.loadSessionMessages();

            // 高亮显示新会话
            if (highlightSessionId) {
                setTimeout(() => {
                    const sessionItem = this.sessionSidebar?.querySelector(`[data-session-id="${highlightSessionId}"]`);
                    if (sessionItem) {
                        sessionItem.classList.add('new-session-highlight');
                        setTimeout(() => {
                            sessionItem.classList.remove('new-session-highlight');
                        }, 1500);
                    }
                }, 100);
            }
    }
  };

  proto.loadSidebarWidth = function() {
    try {
      chrome.storage.local.get(['sessionSidebarWidth'], (result) => {
        if (result.sessionSidebarWidth && typeof result.sessionSidebarWidth === 'number') {
          const width = Math.max(150, Math.min(500, result.sessionSidebarWidth));
          this.sidebarWidth = width;
          if (this.sessionSidebar) {
            this.sessionSidebar.style.setProperty('width', `${width}px`, 'important');
          }
        }
      });
    } catch (e) {}
  };

  proto.saveSidebarWidth = function() {
    try {
      chrome.storage.local.set({ sessionSidebarWidth: this.sidebarWidth }, () => {});
    } catch (e) {}
  };

  proto.loadSidebarCollapsed = function() {
    try {
      chrome.storage.local.get(['sessionSidebarCollapsed'], (result) => {
        if (result.sessionSidebarCollapsed !== undefined) {
          this.sidebarCollapsed = result.sessionSidebarCollapsed;
          if (this.sessionSidebar) {
            this.applySidebarCollapsedState();
          }
        }
      });
    } catch (e) {}
  };

  proto.saveSidebarCollapsed = function() {
    try {
      chrome.storage.local.set({ sessionSidebarCollapsed: this.sidebarCollapsed }, () => {});
    } catch (e) {}
  };

  proto.applySidebarCollapsedState = function() {
    if (!this.sessionSidebar) return;
    if (this.sidebarCollapsed) {
      this.sessionSidebar.style.setProperty('display', 'none', 'important');
    } else {
      this.sessionSidebar.style.setProperty('display', 'flex', 'important');
    }
  };

  proto.toggleSidebar = function() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.applySidebarCollapsedState();
    this.saveSidebarCollapsed();
    const toggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('.toggle-icon');
      if (icon) {
        icon.style.opacity = '0.3';
        icon.style.transform = 'scale(0.8)';
        setTimeout(() => {
          icon.textContent = this.sidebarCollapsed ? '▶' : '◀';
          icon.style.opacity = '1';
          icon.style.transform = 'scale(1)';
        }, 125);
      }
      toggleBtn.title = this.sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏';
      if (this.sidebarCollapsed) {
        toggleBtn.style.left = '0px';
      } else {
        toggleBtn.style.left = `${this.sidebarWidth}px`;
      }
      const currentTransform = toggleBtn.style.transform;
      const baseTransform = 'translateY(-50%) translateX(14px)';
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
    }
  };

  proto.loadInputContainerCollapsed = function() {
    try {
      chrome.storage.local.get(['chatInputContainerCollapsed'], (result) => {
        if (result.chatInputContainerCollapsed !== undefined) {
          this.inputContainerCollapsed = result.chatInputContainerCollapsed;
          if (this.chatWindow) {
            this.applyInputContainerCollapsedState();
          }
        }
      });
    } catch (e) {}
  };

  proto.saveInputContainerCollapsed = function() {
    try {
      chrome.storage.local.set({ chatInputContainerCollapsed: this.inputContainerCollapsed }, () => {});
    } catch (e) {}
  };

  proto.applyInputContainerCollapsedState = function() {
    if (!this.chatWindow) return;
    const inputContainer = this.chatWindow.querySelector('.chat-input-container');
    if (!inputContainer) return;
    if (this.inputContainerCollapsed) {
      inputContainer.style.setProperty('display', 'none', 'important');
    } else {
      inputContainer.style.setProperty('display', 'flex', 'important');
    }
    const toggleBtn = this.chatWindow.querySelector('#input-container-toggle-btn');
    if (toggleBtn) {
      setTimeout(() => {
        const inputHeight = inputContainer.offsetHeight || 160;
        if (this.inputContainerCollapsed) {
          toggleBtn.style.bottom = '0px';
        } else {
          toggleBtn.style.bottom = `${inputHeight}px`;
        }
      }, 50);
    }
  };

  proto.toggleInputContainer = function() {
    this.inputContainerCollapsed = !this.inputContainerCollapsed;
    this.applyInputContainerCollapsedState();
    this.saveInputContainerCollapsed();
    const toggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('.toggle-icon');
      if (icon) {
        icon.style.opacity = '0.3';
        icon.style.transform = 'scale(0.8)';
        setTimeout(() => {
          icon.textContent = this.inputContainerCollapsed ? '▲' : '▼';
          icon.style.opacity = '1';
          icon.style.transform = 'scale(1)';
        }, 125);
      }
      toggleBtn.title = this.inputContainerCollapsed ? '展开输入框' : '折叠输入框';
      const inputContainer = this.chatWindow?.querySelector('.chat-input-container');
      if (inputContainer) {
        if (this.inputContainerCollapsed) {
          toggleBtn.style.bottom = '0px';
        } else {
          const inputHeight = inputContainer.offsetHeight || 160;
          toggleBtn.style.bottom = `${inputHeight}px`;
        }
      }
      const currentTransform = toggleBtn.style.transform;
      const baseTransform = 'translateX(-50%) translateY(-8px)';
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
    }
  };

  proto.createSidebarResizer = function() {
    if (!this.sessionSidebar) return;
    const resizer = document.createElement('div');
    resizer.className = 'sidebar-resizer';
    resizer.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      right: -4px !important;
      width: 8px !important;
      height: 100% !important;
      cursor: col-resize !important;
      z-index: 10 !important;
      background: transparent !important;
      transition: background 0.2s ease !important;
    `;
    resizer.addEventListener('mouseenter', () => {
      resizer.style.background = 'rgba(59, 130, 246, 0.08)';
    });
    resizer.addEventListener('mouseleave', () => {
      resizer.style.background = 'transparent';
    });
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;
    const applyWidth = (w) => {
      const clamped = Math.max(150, Math.min(500, w));
      this.sidebarWidth = clamped;
      if (this.sessionSidebar) {
        this.sessionSidebar.style.setProperty('width', `${clamped}px`, 'important');
      }
      const toggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
      if (toggleBtn && !this.sidebarCollapsed) {
        toggleBtn.style.left = `${clamped}px`;
      }
    };
    resizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = this.sidebarWidth;
      resizer.style.background = 'rgba(59, 130, 246, 0.2)';
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });
    const onMouseMove = (e) => {
      if (!isDragging) return;
      const delta = e.clientX - startX;
      const newWidth = startWidth + delta;
      applyWidth(newWidth);
    };
    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      resizer.style.background = 'transparent';
      document.body.style.cursor = '';
      this.saveSidebarWidth();
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    this.sessionSidebar.appendChild(resizer);
  };
})();

