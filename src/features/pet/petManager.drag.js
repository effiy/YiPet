(function () {
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return;
  }
  const proto = window.PetManager.prototype;

  proto.attachDragHandlersToTag = function (tagBtn, tag) {
    if (!tagBtn || !tag) return;
    
    // 跳过无标签按钮和展开按钮的拖拽处理
    if (tagBtn.classList.contains('tag-no-tags') || tagBtn.classList.contains('tag-expand-btn')) {
      return;
    }
    
    let isDragging = false;
    let dragStartTime = 0;
    
    tagBtn.addEventListener('dragstart', (e) => {
      isDragging = true;
      dragStartTime = Date.now();
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', tagBtn.outerHTML);
      e.dataTransfer.setData('text/plain', tag);
      tagBtn.classList.add('dragging');
      const dragImage = tagBtn.cloneNode(true);
      dragImage.classList.add('pet-drag-image-preview');
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY);
      setTimeout(() => {
        if (dragImage.parentNode) {
          dragImage.parentNode.removeChild(dragImage);
        }
      }, 0);
    });
    tagBtn.addEventListener('dragend', () => {
      tagBtn.classList.remove('dragging');
      // 延迟重置 isDragging，避免触发 click 事件
      setTimeout(() => {
        isDragging = false;
      }, 100);
      document.querySelectorAll('.tag-filter-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-hover');
      });
    });
    tagBtn.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (tagBtn.classList.contains('dragging') || 
          tagBtn.classList.contains('tag-no-tags') || 
          tagBtn.classList.contains('tag-expand-btn')) {
        return;
      }
      const rect = tagBtn.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      document.querySelectorAll('.tag-filter-item').forEach(item => {
        if (!item.classList.contains('dragging') && 
            !item.classList.contains('tag-no-tags') && 
            !item.classList.contains('tag-expand-btn')) {
          item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-hover');
        }
      });
      if (e.clientY < midY) {
        tagBtn.classList.add('drag-over-top');
        tagBtn.classList.remove('drag-over-bottom');
      } else {
        tagBtn.classList.add('drag-over-bottom');
        tagBtn.classList.remove('drag-over-top');
      }
      tagBtn.classList.add('drag-hover');
    });
    tagBtn.addEventListener('dragleave', (e) => {
      const rect = tagBtn.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        tagBtn.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-hover');
      }
    });
    tagBtn.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const draggedTag = e.dataTransfer.getData('text/plain');
      const targetTag = tagBtn.dataset.tagName;
      if (draggedTag === targetTag) {
        return;
      }
      const allTags = this.getAllTags();
      const draggedIndex = allTags.indexOf(draggedTag);
      const targetIndex = allTags.indexOf(targetTag);
      if (draggedIndex === -1 || targetIndex === -1) {
        return;
      }
      const rect = tagBtn.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      let insertIndex = targetIndex;
      insertIndex = e.clientY < midY ? targetIndex : targetIndex + 1;
      if (draggedIndex < insertIndex) {
        insertIndex -= 1;
      }
      const newOrder = [...allTags];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(insertIndex, 0, draggedTag);
      this.saveTagOrder(newOrder);
      this.showNotification('标签顺序已更新', 'success');
      setTimeout(() => {
        this.updateTagFilterUI();
      }, 100);
    });
    // 移除内联样式，使用 CSS 类控制 hover 效果
    // hover 效果现在由 CSS 统一管理
    tagBtn.addEventListener('click', (e) => {
      // 如果刚刚完成拖拽，不触发点击事件
      if (isDragging || Date.now() - dragStartTime < 200) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.detail === 0) {
        return;
      }
      if (this.selectedFilterTags === undefined) {
        this.selectedFilterTags = [];
      }
      if (this.tagFilterNoTags === undefined) {
        this.tagFilterNoTags = false;
      }
      const index = this.selectedFilterTags.indexOf(tag);
      if (index > -1) {
        this.selectedFilterTags.splice(index, 1);
      } else {
        this.selectedFilterTags.push(tag);
      }
      this.updateTagFilterUI();
      this.updateSessionSidebar();
    });
  };

  proto.addInteractions = function() {
    if (!this.pet) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    this.pet.classList.add('pet-draggable');

    this.pet.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = this.position.x;
        startTop = this.position.y;
        this.pet.classList.add('pet-is-dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging && this.pet) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            this.position.x = Math.max(0, Math.min(window.innerWidth - this.size, startLeft + deltaX));
            this.position.y = Math.max(0, Math.min(window.innerHeight - this.size, startTop + deltaY));
            this.pet.style.left = this.position.x + 'px';
            this.pet.style.top = this.position.y + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        if (this.pet) {
            this.pet.classList.remove('pet-is-dragging');
            this.saveState(); // 拖拽结束后保存状态
            // 立即同步到全局状态
            this.syncToGlobalState();
        }
    });

    this.pet.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.pet.classList.add('pet-is-zooming');
        setTimeout(() => {
            if (this.pet) {
                this.pet.classList.remove('pet-is-zooming');
            }
        }, 150);

        // 切换聊天窗口
        this.toggleChatWindow();
    });
  };
})();
