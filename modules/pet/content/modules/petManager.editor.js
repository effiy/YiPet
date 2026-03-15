(function (global) {
  const proto = global.PetManager.prototype

  // ========== 常量定义 ==========
  const EDITOR_PREVIEW_DEBOUNCE = 150 // 编辑器预览防抖时间（毫秒）
  const MERMAID_RENDER_DEBOUNCE = 150 // Mermaid 渲染防抖时间（毫秒）
  const MIN_CONTEXT_LENGTH = 50 // 最小上下文内容长度
  const AD_LINE_MIN_LENGTH = 180 // 广告行最小长度阈值

  const normalizeNameSpaces = (value) => String(value ?? '').trim().replace(/\s+/g, '_')
  const sanitizePathSegment = (value) => {
    const s = String(value ?? '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
    return (s && s.length <= 80 ? s : s.slice(0, 80)) || 'page'
  }

  const logger = (typeof global !== 'undefined' && global.LoggerUtils && typeof global.LoggerUtils.getLogger === 'function')
    ? global.LoggerUtils.getLogger('editor')
    : console

  const parseImageDataUrl = (dataUrl) => {
    const raw = String(dataUrl || '')
    const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i)
    if (!m) return null
    const mime = String(m[1] || '').toLowerCase()
    const base64 = String(m[2] || '').trim()
    if (!base64) return null
    const extMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg'
    }
    const ext = extMap[mime] || 'png'
    return { mime, base64, ext }
  }

  // ========== 页面上下文编辑器 ==========

  // 确保上下文编辑器 UI 存在
  proto.ensureContextEditorUi = function () {
    if (!this.chatWindow) return
    if (document.getElementById('pet-context-editor')) return

    const overlay = document.createElement('div')
    overlay.id = 'pet-context-editor'
    // 样式已通过 CSS 类定义

    const modal = document.createElement('div')
    modal.className = 'context-editor-modal'

    const header = document.createElement('div')
    header.className = 'context-editor-header'
    const title = document.createElement('div')
    title.className = 'context-editor-title'
    title.textContent = '📝 页面上下文（Markdown）'
    const headerBtns = document.createElement('div')
    headerBtns.className = 'editor-header-btns'
    // 简洁模式切换：并排 / 仅编辑 / 仅预览
    const modeGroup = document.createElement('div')
    modeGroup.className = 'editor-mode-group'
    const makeModeBtn = (id, icon, mode, tooltip) => {
      const btn = document.createElement('button')
      btn.id = id
      btn.textContent = icon
      btn.className = 'editor-mode-btn'
      if (tooltip) {
        btn.setAttribute('title', tooltip)
        btn.setAttribute('aria-label', tooltip)
      }
      btn.addEventListener('click', () => this.setContextMode(mode))
      return btn
    }
    const btnSplit = makeModeBtn('pet-context-mode-split', '▦', 'split', '并排模式')
    const btnEdit = makeModeBtn('pet-context-mode-edit', '✏️', 'edit', '仅编辑模式')
    const btnPreview = makeModeBtn('pet-context-mode-preview', '👁️', 'preview', '仅预览模式')
    modeGroup.appendChild(btnSplit)
    modeGroup.appendChild(btnEdit)
    modeGroup.appendChild(btnPreview)
    const closeBtn = document.createElement('div')
    closeBtn.id = 'pet-context-close-btn'
    closeBtn.setAttribute('aria-label', '关闭上下文面板 (Esc)')
    closeBtn.setAttribute('title', '关闭 (Esc)')
    closeBtn.innerHTML = '✕'
    // 样式已通过 CSS 类定义
    closeBtn.onclick = () => this.closeContextEditor()
    headerBtns.appendChild(modeGroup)
    // 复制按钮
    const copyBtn = document.createElement('button')
    copyBtn.id = 'pet-context-copy-btn'
    copyBtn.className = 'chat-toolbar-btn'
    copyBtn.setAttribute('title', '复制内容')
    copyBtn.setAttribute('aria-label', '复制内容')
    copyBtn.textContent = '📋'
    copyBtn.classList.add('context-copy-btn')
    copyBtn.addEventListener('click', () => this.copyContextEditor())

    // 智能优化按钮组
    const optimizeBtnGroup = document.createElement('div')
    optimizeBtnGroup.className = 'optimize-btn-group'

    const optimizeBtn = document.createElement('button')
    optimizeBtn.id = 'pet-context-optimize-btn'
    optimizeBtn.textContent = '✨'
    optimizeBtn.setAttribute('title', '智能优化上下文内容')
    optimizeBtn.setAttribute('aria-label', '智能优化上下文内容')
    optimizeBtn.setAttribute('type', 'button')
    optimizeBtn.className = 'chat-toolbar-btn context-optimize-btn'
    optimizeBtn.addEventListener('click', async () => {
      await this.optimizeContext()
    })

    optimizeBtnGroup.appendChild(optimizeBtn)

    // 拉取当前网页上下文按钮
    const refreshBtn = document.createElement('button')
    refreshBtn.id = 'pet-context-refresh-btn'
    refreshBtn.className = 'chat-toolbar-btn'
    refreshBtn.setAttribute('title', '拉取当前网页上下文')
    refreshBtn.setAttribute('aria-label', '拉取当前网页上下文')
    refreshBtn.textContent = '🔄'
    let refreshConfirmTimer = null
    refreshBtn.addEventListener('click', async () => {
      if (refreshBtn.hasAttribute('data-refreshing')) return

      const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
      const isDirty = !!textarea &&
                textarea.getAttribute('data-user-edited') === '1' &&
                String(textarea.value || '').trim().length > 0

      if (isDirty && !refreshBtn.hasAttribute('data-confirm')) {
        refreshBtn.setAttribute('data-confirm', 'true')
        refreshBtn.setAttribute('data-status', 'warn')
        refreshBtn.textContent = '⚠️'
        this.showNotification('再次点击将覆盖当前编辑内容', 'warning')
        if (refreshConfirmTimer) clearTimeout(refreshConfirmTimer)
        refreshConfirmTimer = setTimeout(() => {
          refreshBtn.removeAttribute('data-confirm')
          refreshBtn.removeAttribute('data-status')
          refreshBtn.textContent = '🔄'
        }, 2500)
        return
      }

      refreshBtn.removeAttribute('data-confirm')
      if (refreshConfirmTimer) {
        clearTimeout(refreshConfirmTimer)
        refreshConfirmTimer = null
      }

      refreshBtn.setAttribute('data-refreshing', 'true')
      refreshBtn.removeAttribute('data-status')
      refreshBtn.textContent = '⏳'

      if (textarea) {
        textarea.removeAttribute('data-original-text')
        textarea.removeAttribute('data-undo-notification')
      }

      try {
        await new Promise((resolve) => requestAnimationFrame(resolve))
      } catch (_) {}

      try {
        await this.refreshContextFromPage()

        // 显示成功提示
        refreshBtn.textContent = '✅'
        refreshBtn.setAttribute('data-status', 'success')

        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor') : null
        if (overlay) {
          overlay.setAttribute('data-flash', 'true')
          setTimeout(() => overlay.removeAttribute('data-flash'), 420)
        }

        setTimeout(() => {
          refreshBtn.textContent = '🔄'
          refreshBtn.removeAttribute('data-refreshing')
          refreshBtn.removeAttribute('data-status')
        }, 2000)
      } catch (error) {
        console.error('拉取网页上下文失败:', error)

        // 显示失败提示
        refreshBtn.textContent = '✕'
        refreshBtn.setAttribute('data-status', 'error')

        setTimeout(() => {
          refreshBtn.textContent = '🔄'
          refreshBtn.removeAttribute('data-refreshing')
          refreshBtn.removeAttribute('data-status')
        }, 2000)
      }
    })

    // 保存按钮
    const saveBtn = document.createElement('button')
    saveBtn.id = 'pet-context-save-btn'
    saveBtn.className = 'chat-toolbar-btn'
    saveBtn.setAttribute('title', '保存修改 (Ctrl+S / Cmd+S)')
    saveBtn.setAttribute('aria-label', '保存修改')
    saveBtn.textContent = '💾'
    saveBtn.addEventListener('click', async () => {
      if (saveBtn.hasAttribute('data-saving')) return

      saveBtn.setAttribute('data-saving', 'true')
      saveBtn.removeAttribute('data-status')
      const originalText = saveBtn.textContent
      saveBtn.textContent = '⏳'

      try {
        const success = await this.saveContextEditor()
        // 传递原始文本，确保恢复正确
        this._showSaveStatus(saveBtn, success, originalText)
      } catch (error) {
        console.error('保存失败:', error)
        // 传递原始文本，确保恢复正确
        this._showSaveStatus(saveBtn, false, originalText)
      } finally {
        // 在状态提示显示2秒后，移除禁用状态
        setTimeout(() => {
          saveBtn.removeAttribute('data-saving')
        }, 2000)
      }
    })

    // 下载按钮（导出 Markdown）
    const downloadBtn = document.createElement('button')
    downloadBtn.id = 'pet-context-download-btn'
    downloadBtn.className = 'chat-toolbar-btn'
    downloadBtn.setAttribute('title', '下载当前上下文为 Markdown (.md)')
    downloadBtn.setAttribute('aria-label', '下载当前上下文为 Markdown (.md)')
    downloadBtn.textContent = '⬇️'
    downloadBtn.addEventListener('click', () => this.downloadContextMarkdown())

    // 翻译按钮组
    const translateBtnGroup = document.createElement('div')
    translateBtnGroup.className = 'translate-btn-group'

    // 翻译成中文按钮
    const translateToZhBtn = document.createElement('button')
    translateToZhBtn.id = 'pet-context-translate-zh-btn'
    translateToZhBtn.className = 'chat-toolbar-btn'
    translateToZhBtn.setAttribute('title', '翻译成中文')
    translateToZhBtn.setAttribute('aria-label', '翻译成中文')
    translateToZhBtn.textContent = '🇨🇳'
    translateToZhBtn.addEventListener('click', async () => {
      await this.translateContext('zh')
    })

    // 翻译成英文按钮
    const translateToEnBtn = document.createElement('button')
    translateToEnBtn.id = 'pet-context-translate-en-btn'
    translateToEnBtn.className = 'chat-toolbar-btn'
    translateToEnBtn.setAttribute('title', '翻译成英文')
    translateToEnBtn.setAttribute('aria-label', '翻译成英文')
    translateToEnBtn.textContent = '🇺🇸'
    translateToEnBtn.addEventListener('click', async () => {
      await this.translateContext('en')
    })

    translateBtnGroup.appendChild(translateToZhBtn)
    translateBtnGroup.appendChild(translateToEnBtn)

    headerBtns.appendChild(refreshBtn)
    headerBtns.appendChild(optimizeBtnGroup)
    headerBtns.appendChild(translateBtnGroup)
    headerBtns.appendChild(copyBtn)
    headerBtns.appendChild(saveBtn)
    headerBtns.appendChild(downloadBtn)
    headerBtns.appendChild(closeBtn)
    header.appendChild(title)
    header.appendChild(headerBtns)

    // 内容区域
    const content = document.createElement('div')
    content.className = 'context-editor-content'

    const body = document.createElement('div')
    body.className = 'context-editor-body'
    const textarea = document.createElement('textarea')
    textarea.id = 'pet-context-editor-textarea'
    const preview = document.createElement('div')
    preview.id = 'pet-context-preview'
    preview.className = 'context-editor-preview markdown-content'
    preview.addEventListener('click', (e) => {
      const target = e?.target
      const img = target && typeof target.closest === 'function' ? target.closest('img') : null
      const src = img ? (img.getAttribute('src') || img.src) : ''
      if (!src) return
      if (typeof this.showImagePreview === 'function') {
        e.preventDefault?.()
        e.stopPropagation?.()
        this.showImagePreview(src, img.getAttribute('alt') || '')
      }
    })
    // 防止滚动事件冒泡到父级，保证自身滚动有效
    preview.addEventListener('wheel', (e) => { e.stopPropagation() }, { passive: true })
    preview.addEventListener('touchmove', (e) => { e.stopPropagation() }, { passive: true })
    // 编辑时实时更新预览（防抖）
    textarea.addEventListener('input', () => {
      try {
        textarea.setAttribute('data-user-edited', '1')
      } catch (_) {}
      if (this._contextPreviewTimer) clearTimeout(this._contextPreviewTimer)
      this._contextPreviewTimer = setTimeout(() => {
        this.updateContextPreview()
      }, 150)
    })
    textarea.addEventListener('paste', async (e) => {
      const items = e?.clipboardData?.items ? Array.from(e.clipboardData.items) : []
      const imageItems = items.filter((item) => item && typeof item.type === 'string' && item.type.includes('image'))
      if (imageItems.length === 0) return
      e.preventDefault()

      const fileList = imageItems
        .map((item) => {
          try {
            return item.getAsFile()
          } catch (_) {
            return null
          }
        })
        .filter(Boolean)
      if (fileList.length === 0) return

      const insertTextAtCursor = (el, text) => {
        const value = String(el.value || '')
        const start = Number.isFinite(el.selectionStart) ? el.selectionStart : value.length
        const end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : start
        el.value = value.slice(0, start) + text + value.slice(end)
        const nextPos = start + text.length
        try {
          el.selectionStart = nextPos
          el.selectionEnd = nextPos
        } catch (_) {}
        try {
          el.dispatchEvent(new Event('input', { bubbles: true }))
        } catch (_) {
          this.updateContextPreview()
        }
      }

      const replaceTokenInTextarea = (token, replacement) => {
        const v = String(textarea.value || '')
        if (!v.includes(token)) return
        textarea.value = v.split(token).join(replacement)
        try {
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
        } catch (_) {
          this.updateContextPreview()
        }
      }

      const fileToDataUrl = (file) => {
        if (!file) return Promise.resolve('')
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = (event) => resolve(String(event?.target?.result || ''))
          reader.onerror = () => resolve('')
          reader.readAsDataURL(file)
        })
      }

      const uploadDataUrlToStaticUrl = async (dataUrl) => {
        const parsed = parseImageDataUrl(dataUrl)
        if (!parsed) throw new Error('无效的图片数据')

        const apiBase = (window.API_URL && /^https?:\/\//i.test(window.API_URL))
          ? String(window.API_URL).replace(/\/+$/, '')
          : (PET_CONFIG?.api?.yiaiBaseUrl || '')
        if (!apiBase) throw new Error('API_URL 未配置')

        const sessionSeg = sanitizePathSegment(this.currentSessionId || 'page')
        const name = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${parsed.ext}`
        const targetFile = `uploads/${sessionSeg}/${name}`

        const res = await fetch(`${apiBase}/write-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_file: targetFile,
            content: parsed.base64,
            is_base64: true
          })
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`)
        }
        const json = await res.json().catch(() => null)
        if (!json || typeof json !== 'object' || json.code !== 0) {
          const msg = json && json.message ? String(json.message) : '上传失败'
          throw new Error(msg)
        }

        return `${apiBase}/static/${targetFile}`
      }

      for (const file of fileList) {
        const token = `__PET_CONTEXT_IMG_${Date.now()}_${Math.random().toString(36).slice(2, 8)}__`
        insertTextAtCursor(textarea, `![](${token})\n`)
        const dataUrl = await fileToDataUrl(file)
        if (!dataUrl) {
          replaceTokenInTextarea(token, '')
          continue
        }
        try {
          const url = await uploadDataUrlToStaticUrl(dataUrl)
          replaceTokenInTextarea(token, url)
        } catch (err) {
          replaceTokenInTextarea(token, dataUrl)
          this.showNotification?.(`图片上传失败，已使用本地图片：${err?.message || '未知错误'}`, 'warning')
        }
      }
    })
    // 同步滚动（比例映射）
    textarea.addEventListener('scroll', () => {
      const previewEl = this.chatWindow ? this.chatWindow.querySelector('#pet-context-preview') : null
      if (!previewEl) return
      const tMax = textarea.scrollHeight - textarea.clientHeight
      const pMax = previewEl.scrollHeight - previewEl.clientHeight
      if (tMax > 0 && pMax >= 0) {
        const ratio = textarea.scrollTop / tMax
        previewEl.scrollTop = ratio * pMax
      }
    }, { passive: true })
    body.appendChild(textarea)
    body.appendChild(preview)
    content.appendChild(body)
    modal.appendChild(header)
    modal.appendChild(content)
    overlay.appendChild(modal)
    // 确保聊天窗口容器为定位上下文
    const currentPosition = window.getComputedStyle(this.chatWindow).position
    if (currentPosition === 'static') {
      this.chatWindow.style.position = 'relative'
    }
    this.chatWindow.appendChild(overlay)
  }

  proto.openContextEditor = async function () {
    this.ensureContextEditorUi()
    const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor') : null
    if (!overlay) return
    overlay.classList.add('js-visible')
    // 打开时根据当前 header 高度校正位置
    this.updateContextEditorPosition()
    // 先调用 read-file 接口读取内容，再加载到编辑器
    await this.loadContextIntoEditor()
    this.updateContextPreview()
    // 隐藏撤销按钮（打开编辑器时重置状态）
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (textarea) {
      textarea.removeAttribute('data-original-text')
      textarea.removeAttribute('data-undo-notification')
    }
    // 默认并排模式
    this._contextPreviewMode = this._contextPreviewMode || 'split'
    this.applyContextPreviewMode()
    this.chatWindow.classList.add('context-editor-open')
    // 键盘快捷键：Esc 关闭，Ctrl+S / Cmd+S 保存
    this._contextKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeContextEditor()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        const saveBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-save-btn') : null
        if (saveBtn && !saveBtn.hasAttribute('data-saving')) {
          saveBtn.click()
        }
      }
    }
    document.addEventListener('keydown', this._contextKeydownHandler, { capture: true })
    // 监听窗口尺寸变化，动态更新覆盖层位置
    this._contextResizeHandler = () => this.updateContextEditorPosition()
    window.addEventListener('resize', this._contextResizeHandler, { passive: true })
  }

  proto.closeContextEditor = function () {
    const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor') : null
    if (overlay) overlay.classList.remove('js-visible')

    if (this.chatWindow) this.chatWindow.classList.remove('context-editor-open')

    if (this._contextKeydownHandler) {
      document.removeEventListener('keydown', this._contextKeydownHandler, { capture: true })
      this._contextKeydownHandler = null
    }
    if (this._contextResizeHandler) {
      window.removeEventListener('resize', this._contextResizeHandler)
      this._contextResizeHandler = null
    }
  }

  /**
     * 显示指定会话的页面上下文
     * 支持两种调用方式：
     * 1. showSessionContext(sessionId) - 从按钮调用
     * 2. showSessionContext(event, session) - 从右键菜单调用
     * @param {string|Event} sessionIdOrEvent - 会话ID或事件对象
     * @param {Object} [session] - 会话对象（可选，用于右键菜单调用）
     */
  proto.showSessionContext = async function (sessionIdOrEvent, session) {
    let sessionId = null

    // 处理两种调用方式
    if (typeof sessionIdOrEvent === 'string') {
      // 方式1: showSessionContext(sessionId)
      sessionId = sessionIdOrEvent
    } else if (sessionIdOrEvent && session) {
      // 方式2: showSessionContext(event, session)
      sessionId = session.key
    } else {
      console.warn('无效的参数，无法显示上下文')
      this.showNotification('无法显示上下文：参数无效', 'error')
      return
    }

    if (!sessionId) {
      console.warn('会话ID为空，无法显示上下文')
      this.showNotification('无法显示上下文：会话ID为空', 'error')
      return
    }

    // 检查会话是否存在
    if (!this.sessions || !this.sessions[sessionId]) {
      console.warn('会话不存在，无法显示上下文:', sessionId)
      this.showNotification('无法显示上下文：会话不存在', 'error')
      return
    }

    try {
      const waitFor = async (predicate, timeoutMs) => {
        const timeout = Math.max(0, Number(timeoutMs) || 0)
        const start = Date.now()
        while (true) {
          try {
            if (predicate()) return true
          } catch (_) {}
          if (timeout && Date.now() - start > timeout) return false
          await new Promise(r => setTimeout(r, 30))
        }
      }

      // 如果指定的会话不是当前会话，先切换到该会话
      if (this.currentSessionId !== sessionId) {
        console.log('切换到会话以显示上下文:', sessionId)

        // 使用 switchSession 方法切换会话
        if (typeof this.switchSession === 'function') {
          await this.switchSession(sessionId)
        } else if (typeof this.activateSession === 'function') {
          // 如果 switchSession 不存在，使用 activateSession
          await this.activateSession(sessionId, {
            saveCurrent: false,
            updateConsistency: true,
            updateUI: true,
            syncToBackend: false
          })
        } else {
          // 如果都没有，直接设置当前会话ID
          this.currentSessionId = sessionId
        }

        const switched = await waitFor(() => this.currentSessionId === sessionId, 1500)
        if (!switched) {
          throw new Error('会话切换超时')
        }

        // 切换会话后，调用 read-file 接口获取页面上下文
        if (typeof this.fetchSessionPageContent === 'function') {
          await this.fetchSessionPageContent(sessionId)
        }
      } else {
        // 即使不切换会话，也要调用 read-file 接口读取最新内容
        if (typeof this.fetchSessionPageContent === 'function') {
          await this.fetchSessionPageContent(sessionId)
        }
      }

      // 打开上下文编辑器（会自动加载当前会话的上下文，已通过 read-file 接口获取）
      await this.openContextEditor()

      console.log('已打开会话的页面上下文:', sessionId)
    } catch (error) {
      console.error('显示会话上下文失败:', error)
      this.showNotification('显示上下文失败：' + (error.message || '未知错误'), 'error')
    }
  }

  proto.setContextMode = function (mode) {
    this._contextPreviewMode = mode // 'split' | 'edit' | 'preview'
    this.applyContextPreviewMode()
  }

  proto.applyContextPreviewMode = function () {
    if (!this.chatWindow) return
    const textarea = this.chatWindow.querySelector('#pet-context-editor-textarea')
    const preview = this.chatWindow.querySelector('#pet-context-preview')
    const btnSplit = this.chatWindow.querySelector('#pet-context-mode-split')
    const btnEdit = this.chatWindow.querySelector('#pet-context-mode-edit')
    const btnPreview = this.chatWindow.querySelector('#pet-context-mode-preview')
    const overlay = this.chatWindow.querySelector('#pet-context-editor')
    if (!textarea || !preview) return
    const mode = this._contextPreviewMode
    if (overlay) {
      overlay.setAttribute('data-mode', mode || 'split')
      const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex])
      overlay.style.setProperty('--pet-context-active-color', currentMainColor)
    }
    if (btnSplit) btnSplit.classList.toggle('is-active', mode === 'split')
    if (btnEdit) btnEdit.classList.toggle('is-active', mode === 'edit')
    if (btnPreview) btnPreview.classList.toggle('is-active', mode === 'preview')
  }

  // 动态更新上下文覆盖层的位置与尺寸，避免遮挡 chat-header
  proto.updateContextEditorPosition = function () {
    if (!this.chatWindow) return
    const overlay = this.chatWindow.querySelector('#pet-context-editor')
    if (!overlay) return
    const chatHeaderEl = this.chatWindow.querySelector('.chat-header')
    const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60
    overlay.style.setProperty('--pet-context-editor-top', headerH + 'px')
  }

  /**
     * 从当前网页拉取上下文并更新编辑器
     * @returns {Promise<void>}
     */
  proto.refreshContextFromPage = async function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (!textarea) {
      throw new Error('未找到上下文编辑器')
    }

    try {
      const pageContent = this.buildPageContextMarkdownForEditor()

      // 更新编辑器内容
      textarea.value = pageContent || ''
      textarea.setAttribute('data-user-edited', '0')
      textarea.setAttribute('data-last-synced-text', textarea.value || '')

      // 更新预览
      this.updateContextPreview()

      // 如果当前有会话，也更新会话中的页面内容
      if (this.currentSessionId && this.sessions[this.currentSessionId]) {
        const session = this.sessions[this.currentSessionId]
        session.pageContent = pageContent
        const documentTitle = normalizeNameSpaces(document.title || '当前页面')
        const currentTitle = session.title || ''
        const ensureMdSuffix = (str) => {
          if (!str || !String(str).trim()) return ''
          const s = String(str).trim()
          return s.endsWith('.md') ? s : `${s}.md`
        }
        const isDefaultTitle = !currentTitle ||
                    currentTitle.trim() === '' ||
                    currentTitle === '未命名会话' ||
                    currentTitle === '新会话' ||
                    currentTitle === '未命名页面' ||
                    currentTitle === '当前页面'
        if (isDefaultTitle) {
          session.title = ensureMdSuffix(documentTitle)
        }
        // 更新会话时间戳，确保保存逻辑识别到变化
        session.updatedAt = Date.now()
        session.lastAccessTime = Date.now()
        // 静默保存，不显示提示（同步到后端）
        this.saveAllSessions(true, true).catch(err => {
          console.error('自动保存更新的上下文失败:', err)
        })
      }
    } catch (error) {
      console.error('拉取网页上下文失败:', error)
      throw error
    }
  }

  /**
     * 获取当前网页渲染后的 HTML 内容并转换为 Markdown
     * 该方法专门用于刷新按钮功能，确保获取最新的渲染内容
     */
  proto.getRenderedHTMLAsMarkdown = function () {
    try {
      return this.getRenderedMainContentAsMarkdown()
    } catch (error) {
      console.error('将渲染后的 HTML 转换为 Markdown 时出错:', error)
      // 出错时返回纯文本
      return this.getFullPageText()
    }
  }

  proto._getContextExcludeSelectors = function () {
    const assistantId =
            (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.ids)
              ? PET_CONFIG.constants.ids.assistantElement
              : 'chat-assistant-element'
    return [
      'script',
      'style',
      'noscript',
      'nav',
      'aside',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '[role="complementary"]',
      '[role="dialog"]',
      '[role="alert"]',
      '[role="alertdialog"]',
      '[aria-modal="true"]',
      '[aria-hidden="true"]',
      '[hidden]',
      '.ad',
      '.advertisement',
      '.ads',
      '.advertisement-container',
      '[class*="ad-"]',
      '[class*="advert"]',
      '[class*="banner"]',
      '[class*="promo"]',
      '[class*="sponsor"]',
      '[class*="cookie"]',
      '[class*="consent"]',
      '[class*="subscribe"]',
      '[class*="newsletter"]',
      '[class*="breadcrumb"]',
      '[class*="pagination"]',
      '[class*="pager"]',
      '[class*="toc"]',
      '[class*="table-of-contents"]',
      '[class*="share"]',
      '[class*="social"]',
      '[class*="comment"]',
      '[class*="related"]',
      '[class*="recommend"]',
      '[id*="ad"]',
      '[id*="advert"]',
      '[id*="banner"]',
      '[id*="promo"]',
      '[id*="sponsor"]',
      '[id*="cookie"]',
      '[id*="consent"]',
      '[id*="subscribe"]',
      '[id*="newsletter"]',
      '[id*="breadcrumb"]',
      '[id*="pagination"]',
      '[id*="pager"]',
      '[id*="toc"]',
      '[id*="table-of-contents"]',
      '[id*="share"]',
      '[id*="social"]',
      '[id*="comment"]',
      '[id*="related"]',
      '[id*="recommend"]',
            `#${assistantId}`,
            '[id^="pet-"]',
            '[class*="pet-"]',
            '[id*="pet-chat"]',
            '[class*="pet-chat"]',
            '[id*="pet-context"]',
            '[class*="pet-context"]',
            '[id*="pet-faq"]',
            '[class*="pet-faq"]',
            '[id*="pet-api"]',
            '[class*="pet-api"]',
            '[id*="pet-session"]',
            '[class*="pet-session"]'
    ]
  }

  proto._cloneAndCleanElementForContext = function (rootEl) {
    if (!rootEl) return null
    const collectCanvasDataUrls = () => {
      const urls = []
      try {
        const canvases = Array.from(rootEl.querySelectorAll('canvas'))
        canvases.forEach((c) => {
          try {
            urls.push(c.toDataURL('image/png'))
          } catch (_) {
            urls.push(null)
          }
        })
      } catch (_) {}
      return urls
    }
    const collectMediaInfo = () => {
      const info = { video: [], audio: [], iframe: [], bg: [] }
      const safeAbsUrl = (u) => {
        const raw = String(u || '').trim()
        if (!raw) return ''
        if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw
        try {
          return new URL(raw, document.baseURI).href
        } catch (_) {
          return raw
        }
      }
      const extractCssUrl = (bg) => {
        const s = String(bg || '').trim()
        if (!s || s === 'none') return ''
        const m = s.match(/url\((['"]?)(.*?)\1\)/i)
        return m ? safeAbsUrl(m[2]) : ''
      }
      const collectNodes = (sel, fn) => {
        try {
          Array.from(rootEl.querySelectorAll(sel)).forEach(fn)
        } catch (_) {}
      }
      collectNodes('video', (v) => {
        try {
          const src = v.currentSrc || v.getAttribute('src') || ''
          const poster = v.getAttribute('poster') || ''
          info.video.push({
            src: safeAbsUrl(src),
            poster: safeAbsUrl(poster),
            sources: Array.from(v.querySelectorAll('source')).map((s) => ({
              src: safeAbsUrl(s.getAttribute('src') || ''),
              type: String(s.getAttribute('type') || '').trim()
            }))
          })
        } catch (_) {
          info.video.push({ src: '', poster: '', sources: [] })
        }
      })
      collectNodes('audio', (a) => {
        try {
          const src = a.currentSrc || a.getAttribute('src') || ''
          info.audio.push({
            src: safeAbsUrl(src),
            sources: Array.from(a.querySelectorAll('source')).map((s) => ({
              src: safeAbsUrl(s.getAttribute('src') || ''),
              type: String(s.getAttribute('type') || '').trim()
            }))
          })
        } catch (_) {
          info.audio.push({ src: '', sources: [] })
        }
      })
      collectNodes('iframe', (f) => {
        try {
          info.iframe.push({ src: safeAbsUrl(f.getAttribute('src') || '') })
        } catch (_) {
          info.iframe.push({ src: '' })
        }
      })
      try {
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT)
        let idx = -1
        while (walker.nextNode()) {
          idx++
          const el = walker.currentNode
          try {
            if (!el || el.nodeType !== 1) continue
            if (el.tagName && ['IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'SVG', 'IFRAME', 'PICTURE', 'SOURCE', 'SCRIPT', 'STYLE'].includes(el.tagName)) continue
            if (el.querySelector && el.querySelector('img,video,audio,svg,canvas')) continue
            const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null
            if (rect && rect.width * rect.height < 1600) continue
            const bg = window.getComputedStyle ? window.getComputedStyle(el).backgroundImage : ''
            const url = extractCssUrl(bg)
            if (!url) continue
            info.bg.push({ index: idx, url })
          } catch (_) {}
        }
      } catch (_) {}
      return info
    }

    const canvasDataUrls = collectCanvasDataUrls()
    const mediaInfo = collectMediaInfo()
    let cloned = null
    try {
      cloned = rootEl.cloneNode(true)
    } catch (_) {
      return null
    }
    if (!cloned) return null

    try {
      const walker = document.createTreeWalker(cloned, NodeFilter.SHOW_ELEMENT)
      let idx = -1
      let bgCursor = 0
      let nextBg = mediaInfo.bg && mediaInfo.bg.length ? mediaInfo.bg[bgCursor] : null
      while (walker.nextNode()) {
        idx++
        const el = walker.currentNode
        if (!nextBg || idx < nextBg.index) continue
        if (idx !== nextBg.index) continue
        const url = nextBg.url
        if (url) {
          const img = document.createElement('img')
          img.setAttribute('src', url)
          img.setAttribute('alt', 'background')
          try {
            el.insertBefore(img, el.firstChild)
          } catch (_) {}
        }
        bgCursor++
        nextBg = mediaInfo.bg[bgCursor] || null
      }
    } catch (_) {}

    const excludeSelectors = this._getContextExcludeSelectors()
    excludeSelectors.forEach((sel) => {
      try {
        const nodes = cloned.querySelectorAll(sel)
        nodes.forEach((n) => n && n.remove && n.remove())
      } catch (_) {}
    })

    const keywordRe = /(advert|ad-|ads|banner|promo|sponsor|cookie|consent|subscribe|newsletter|breadcrumb|pagination|pager|toc|table-of-contents|share|social|comment|related|recommend)/i
    const removeIfBoilerplate = (el) => {
      if (!el || el.nodeType !== 1) return
      const tag = String(el.tagName || '').toLowerCase()
      if (tag === 'main' || tag === 'article') return
      const idClass = `${el.id || ''} ${el.className || ''}`.trim()
      if (idClass && keywordRe.test(idClass)) {
        try {
          el.remove()
        } catch (_) {}
      }
    }

    try {
      const all = Array.from(cloned.querySelectorAll('*'))
      all.forEach((el) => {
        if (el.hasAttribute('hidden')) {
          try {
            el.remove()
          } catch (_) {}
          return
        }
        const ariaHidden = String(el.getAttribute('aria-hidden') || '').toLowerCase()
        if (ariaHidden === 'true') {
          try {
            el.remove()
          } catch (_) {}
          return
        }
        const style = String(el.getAttribute('style') || '').toLowerCase()
        if (style.includes('display:none') || style.includes('visibility:hidden') || style.includes('opacity:0')) {
          try {
            el.remove()
          } catch (_) {}
          return
        }
        const role = String(el.getAttribute('role') || '').toLowerCase()
        if (role && ['navigation', 'banner', 'contentinfo', 'complementary', 'dialog', 'alert', 'alertdialog'].includes(role)) {
          try {
            el.remove()
          } catch (_) {}
          return
        }
        removeIfBoilerplate(el)
      })
    } catch (_) {}

    try {
      const blocks = Array.from(cloned.querySelectorAll('nav, aside, form, button, input, select, textarea'))
      blocks.forEach((el) => el && el.remove && el.remove())
    } catch (_) {}

    try {
      const canvases = Array.from(cloned.querySelectorAll('canvas'))
      canvases.forEach((c, i) => {
        const dataUrl = canvasDataUrls[i]
        if (!dataUrl) return
        const img = document.createElement('img')
        img.setAttribute('src', dataUrl)
        img.setAttribute('alt', 'canvas')
        try {
          c.replaceWith(img)
        } catch (_) {}
      })
    } catch (_) {}

    try {
      const videos = Array.from(cloned.querySelectorAll('video'))
      videos.forEach((v, i) => {
        const info = mediaInfo.video[i]
        if (!v.hasAttribute('controls')) v.setAttribute('controls', '')
        if (info && info.poster && !v.getAttribute('poster')) v.setAttribute('poster', info.poster)
        if (info && info.src) v.setAttribute('src', info.src)
        if (info && Array.isArray(info.sources) && info.sources.length) {
          try {
            v.querySelectorAll('source').forEach((s) => s.remove())
          } catch (_) {}
          info.sources.forEach((s) => {
            if (!s || !s.src) return
            const sourceEl = document.createElement('source')
            sourceEl.setAttribute('src', s.src)
            if (s.type) sourceEl.setAttribute('type', s.type)
            v.appendChild(sourceEl)
          })
        }
      })
    } catch (_) {}

    try {
      const audios = Array.from(cloned.querySelectorAll('audio'))
      audios.forEach((a, i) => {
        const info = mediaInfo.audio[i]
        if (!a.hasAttribute('controls')) a.setAttribute('controls', '')
        if (info && info.src) a.setAttribute('src', info.src)
        if (info && Array.isArray(info.sources) && info.sources.length) {
          try {
            a.querySelectorAll('source').forEach((s) => s.remove())
          } catch (_) {}
          info.sources.forEach((s) => {
            if (!s || !s.src) return
            const sourceEl = document.createElement('source')
            sourceEl.setAttribute('src', s.src)
            if (s.type) sourceEl.setAttribute('type', s.type)
            a.appendChild(sourceEl)
          })
        }
      })
    } catch (_) {}

    try {
      const iframes = Array.from(cloned.querySelectorAll('iframe'))
      iframes.forEach((f, i) => {
        const info = mediaInfo.iframe[i]
        if (info && info.src) f.setAttribute('src', info.src)
      })
    } catch (_) {}

    const calcLinkDensity = (el) => {
      try {
        const text = String(el.textContent || '').replace(/\s+/g, ' ').trim()
        const total = text.length
        if (!total) return 0
        const links = Array.from(el.querySelectorAll('a'))
        const linkTextLen = links.reduce((sum, a) => sum + String(a.textContent || '').replace(/\s+/g, ' ').trim().length, 0)
        return linkTextLen / total
      } catch (_) {
        return 0
      }
    }

    const maybeRemoveLinkHeavy = (el) => {
      const density = calcLinkDensity(el)
      if (density < 0.65) return
      const textLen = String(el.textContent || '').replace(/\s+/g, ' ').trim().length
      if (textLen < 800) {
        try {
          el.remove()
        } catch (_) {}
      }
    }

    try {
      const candidates = Array.from(cloned.querySelectorAll('ul, ol, nav, aside, header, footer, section, div'))
      candidates.forEach((el) => maybeRemoveLinkHeavy(el))
    } catch (_) {}

    return cloned
  }

  proto._scoreContextCandidate = function (el) {
    if (!el || el.nodeType !== 1) return -Infinity
    const tag = String(el.tagName || '').toLowerCase()
    if (['script', 'style', 'noscript'].includes(tag)) return -Infinity

    const cleaned = this._cloneAndCleanElementForContext(el)
    if (!cleaned) return -Infinity
    const text = String(cleaned.textContent || '').replace(/\s+/g, ' ').trim()
    const textLen = text.length
    if (textLen < 200 && el !== document.body) return -Infinity

    let linkDensity = 0
    try {
      const links = Array.from(cleaned.querySelectorAll('a'))
      const linkTextLen = links.reduce((sum, a) => sum + String(a.textContent || '').replace(/\s+/g, ' ').trim().length, 0)
      linkDensity = textLen ? linkTextLen / textLen : 0
    } catch (_) {}

    const idClass = `${el.id || ''} ${el.className || ''}`.trim()
    const keywordRe = /(advert|ad-|ads|banner|promo|sponsor|cookie|consent|subscribe|newsletter|breadcrumb|pagination|pager|toc|table-of-contents|share|social|comment|related|recommend)/i
    const penalty = idClass && keywordRe.test(idClass) ? 2500 : 0

    const densityFactor = 1 - Math.min(Math.max(linkDensity, 0), 0.9)
    return textLen * densityFactor - penalty
  }

  proto._selectBestContextRootElement = function () {
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '[role="article"]',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.post-body',
      '.article-body',
      '.text-content',
      '.content',
      '.main-content',
      '.page-content',
      '.article',
      '.blog-post',
      '.entry',
      '.post',
      '#content',
      '#main-content',
      '#main',
      '.content-area',
      '.content-wrapper',
      '.text-wrapper',
      '.text-container'
    ]

    const seen = new Set()
    const candidates = []
    selectors.forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (!el || seen.has(el)) return
          seen.add(el)
          candidates.push(el)
        })
      } catch (_) {}
    })

    if (document.body) candidates.push(document.body)

    let best = null
    let bestScore = -Infinity
    for (const el of candidates) {
      let score = -Infinity
      try {
        score = this._scoreContextCandidate(el)
      } catch (_) {
        score = -Infinity
      }
      if (score > bestScore) {
        bestScore = score
        best = el
      }
    }
    return best || document.body || document.documentElement || null
  }

  proto._turndownForContext = function (clonedRoot) {
    if (!clonedRoot) return ''
    if (typeof TurndownService === 'undefined') {
      const textContent = clonedRoot.textContent || clonedRoot.innerText || ''
      return String(textContent || '').trim()
    }

    const safeAbsUrl = (u) => {
      const raw = String(u || '').trim()
      if (!raw) return ''
      if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw
      try {
        return new URL(raw, document.baseURI).href
      } catch (_) {
        return raw
      }
    }
    const markdownUrl = (u) => {
      const s = String(u || '').trim()
      if (!s) return ''
      if (/[<>\s()]/.test(s)) return `<${s}>`
      return s
    }
    const escapeHtmlAttr = (v) =>
      String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '_',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
      preformattedCode: true
    })

    turndownService.addRule('preserveLineBreaks', {
      filter: ['br'],
      replacement: () => '\n'
    })

    turndownService.addRule('mediaCanvas', {
      filter: function (node) {
        return node && node.nodeName === 'CANVAS'
      },
      replacement: function (_content, node) {
        const html = node && node.outerHTML ? String(node.outerHTML) : ''
        if (!html) return ''
        return `\n\n${html}\n\n`
      }
    })

    turndownService.addRule('cleanImage', {
      filter: ['img'],
      replacement: function (_content, node) {
        const alt = String(node.getAttribute('alt') || '').trim()
        const title = String(node.getAttribute('title') || '').trim()
        const getBestSrc = () => {
          const direct = node.getAttribute('src') || ''
          const dataSrc =
                        node.getAttribute('data-src') ||
                        node.getAttribute('data-original') ||
                        node.getAttribute('data-url') ||
                        node.getAttribute('data-lazy-src') ||
                        node.getAttribute('data-actualsrc') ||
                        node.getAttribute('data-image') ||
                        ''
          const srcset = node.getAttribute('srcset') || node.getAttribute('data-srcset') || ''
          const pickFromSrcset = (s) => {
            const raw = String(s || '').trim()
            if (!raw) return ''
            const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
            if (!parts.length) return ''
            const last = parts[parts.length - 1]
            const url = last.split(/\s+/)[0]
            return url || ''
          }
          return direct || dataSrc || pickFromSrcset(srcset)
        }
        const rawSrc = getBestSrc()
        const src = safeAbsUrl(rawSrc)
        if (!src) return ''
        const label = String(alt || title || '').replace(/[\[\]\n\r]/g, ' ').trim()
        const urlPart = markdownUrl(src)
        const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : ''
        return `![${label}](${urlPart}${titlePart})`
      }
    })

    turndownService.addRule('mediaVideo', {
      filter: function (node) {
        return node && node.nodeName === 'VIDEO'
      },
      replacement: function (_content, node) {
        const src = safeAbsUrl(node.getAttribute('src') || '')
        const poster = safeAbsUrl(node.getAttribute('poster') || '')
        const sources = Array.from(node.querySelectorAll('source')).map((s) => ({
          src: safeAbsUrl(s.getAttribute('src') || ''),
          type: String(s.getAttribute('type') || '').trim()
        })).filter((s) => s.src)
        const attrs = []
        attrs.push('controls')
        if (poster) attrs.push(`poster="${escapeHtmlAttr(poster)}"`)
        if (src) attrs.push(`src="${escapeHtmlAttr(src)}"`)
        const inner = sources.map((s) => `<source src="${escapeHtmlAttr(s.src)}"${s.type ? ` type="${escapeHtmlAttr(s.type)}"` : ''}>`).join('')
        const html = `<video ${attrs.join(' ')}>${inner}</video>`
        const url = src || (sources[0] ? sources[0].src : '')
        const link = url ? `\n\n[视频链接](${markdownUrl(url)})\n\n` : '\n\n'
        return `\n\n${html}${link}`
      }
    })

    turndownService.addRule('mediaAudio', {
      filter: function (node) {
        return node && node.nodeName === 'AUDIO'
      },
      replacement: function (_content, node) {
        const src = safeAbsUrl(node.getAttribute('src') || '')
        const sources = Array.from(node.querySelectorAll('source')).map((s) => ({
          src: safeAbsUrl(s.getAttribute('src') || ''),
          type: String(s.getAttribute('type') || '').trim()
        })).filter((s) => s.src)
        const attrs = []
        attrs.push('controls')
        if (src) attrs.push(`src="${escapeHtmlAttr(src)}"`)
        const inner = sources.map((s) => `<source src="${escapeHtmlAttr(s.src)}"${s.type ? ` type="${escapeHtmlAttr(s.type)}"` : ''}>`).join('')
        const html = `<audio ${attrs.join(' ')}>${inner}</audio>`
        const url = src || (sources[0] ? sources[0].src : '')
        const link = url ? `\n\n[音频链接](${markdownUrl(url)})\n\n` : '\n\n'
        return `\n\n${html}${link}`
      }
    })

    turndownService.addRule('mediaIframe', {
      filter: function (node) {
        return node && node.nodeName === 'IFRAME'
      },
      replacement: function (_content, node) {
        const src = safeAbsUrl(node.getAttribute('src') || '')
        if (!src) return ''
        return `\n\n[嵌入内容](${markdownUrl(src)})\n\n`
      }
    })

    turndownService.addRule('mediaSvg', {
      filter: function (node) {
        return node && node.nodeName === 'SVG'
      },
      replacement: function (_content, node) {
        const html = node && node.outerHTML ? String(node.outerHTML) : ''
        if (!html) return ''
        return `\n\n${html}\n\n`
      }
    })

    const escapeTableCell = (s) => String(s || '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')
    const buildTableMarkdown = (tableEl) => {
      const rows = Array.from(tableEl.querySelectorAll('tr'))
      if (rows.length === 0) return ''
      const rowCells = rows.map((tr) => Array.from(tr.querySelectorAll('th,td')).map((cell) => escapeTableCell(cell.textContent || '')))
      const maxCols = rowCells.reduce((m, r) => Math.max(m, r.length), 0)
      if (maxCols === 0) return ''
      const normalized = rowCells.map((r) => {
        const out = r.slice(0, maxCols)
        while (out.length < maxCols) out.push('')
        return out
      })
      const firstRowIsHeader = rows[0].querySelectorAll('th').length > 0
      const header = firstRowIsHeader ? normalized[0] : normalized[0]
      const body = firstRowIsHeader ? normalized.slice(1) : normalized.slice(1)
      const sep = new Array(maxCols).fill('---')
      const lines = []
      lines.push(`| ${header.join(' | ')} |`)
      lines.push(`| ${sep.join(' | ')} |`)
      body.forEach((r) => {
        if (r.every((c) => !String(c || '').trim())) return
        lines.push(`| ${r.join(' | ')} |`)
      })
      return lines.join('\n')
    }

    turndownService.addRule('tableToMarkdown', {
      filter: function (node) {
        return node.nodeName === 'TABLE'
      },
      replacement: function (_content, node) {
        const md = buildTableMarkdown(node)
        if (!md) return ''
        return `\n\n${md}\n\n`
      }
    })

    let markdown = ''
    try {
      markdown = turndownService.turndown(clonedRoot)
    } catch (_) {
      const textContent = clonedRoot.textContent || clonedRoot.innerText || ''
      markdown = String(textContent || '').trim()
    }
    return String(markdown || '')
  }

  proto._postProcessContextMarkdown = function (markdown) {
    let md = String(markdown || '')
    md = md.replace(/\r\n/g, '\n')
    md = md.replace(/[ \t]+\n/g, '\n')
    md = md.replace(/\n{4,}/g, '\n\n\n')

    // 优化广告过滤正则：更精确地匹配广告行，避免误删有用内容
    const adLineRe =
            /^(?:广告|推广|赞助|赞助内容|广告内容|Sponsored|Advertisement|Promoted\s+Content|Ad\s+Choice|Cookie Policy|Privacy Policy|Terms of Service|Terms & Conditions)\s*$/i
    // 单独处理更常见的导航/操作项，允许它们出现在内容中
    const navigationKeywords = ['订阅', '登录', '注册', '分享', '关注我们', '立即购买', '加入购物车',
      '推荐阅读', '相关阅读', '相关文章', '你可能还喜欢', '更多推荐', '展开全文', '阅读原文']

    const lines = md.split('\n')
    const out = []
    let last = ''
    let removedLines = 0

    for (const line of lines) {
      const t = String(line || '').trim()
      if (!t) {
        out.push('')
        last = ''
        continue
      }
      // 严格匹配广告行
      if (adLineRe.test(t)) {
        removedLines++
        continue
      }
      // 对于导航关键词，只有单独一行且很短时才过滤
      const isNavigationLine = navigationKeywords.some(keyword => t === keyword)
      if (isNavigationLine && t.length < 10) {
        removedLines++
        continue
      }
      if (t === last) continue
      // 优化导航链接行过滤：提高长度阈值，避免误删
      if (/[|›»·•]\s*[^|›»·•]+(?:\s*[|›»·•]\s*[^|›»·•]+){3,}/.test(t) && t.length < AD_LINE_MIN_LENGTH) {
        removedLines++
        continue
      }
      out.push(line)
      last = t
    }
    md = out.join('\n')
    md = md.replace(/\n{4,}/g, '\n\n\n').trim()

    if (removedLines > 0) {
      logger.debug('上下文后处理完成', { removedLines, originalLength: markdown.length, finalLength: md.length })
    }

    return md
  }

  proto.getRenderedMainContentAsMarkdown = function () {
    try {
      const root = this._selectBestContextRootElement()
      const cloned = this._cloneAndCleanElementForContext(root)
      if (!cloned) return this.getFullPageText()
      const markdown = this._turndownForContext(cloned)
      const cleaned = this._postProcessContextMarkdown(markdown)
      if (!cleaned || cleaned.length < MIN_CONTEXT_LENGTH) {
        logger.debug('Markdown 内容太短，回退到纯文本', {
          markdownLength: cleaned ? cleaned.length : 0,
          threshold: MIN_CONTEXT_LENGTH
        })
        const textContent = cloned.textContent || cloned.innerText || ''
        return String(textContent || '').trim()
      }
      return cleaned
    } catch (error) {
      logger.warn('获取渲染的主要内容失败，回退到纯文本', {
        error: String(error && error.message || error)
      })
      return this.getFullPageText()
    }
  }

  proto.buildPageContextMarkdownForEditor = function () {
    const title = String(document.title || '当前页面').trim()
    const url = String(window.location && window.location.href ? window.location.href : '').trim()
    const metaDescription = document.querySelector('meta[name="description"]')
    const description = metaDescription ? String(metaDescription.content || '').trim() : ''

    let content = this.getRenderedMainContentAsMarkdown()
    content = String(content || '').trim()

    const firstHeadingMatch = content.match(/^#{1,6}\s+(.+)\s*$/m)
    if (firstHeadingMatch && title) {
      const heading = String(firstHeadingMatch[1] || '').trim()
      const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[·•\-\—\|]/g, '')
      if (norm(heading) && norm(heading) === norm(title)) {
        content = content.replace(firstHeadingMatch[0], '').trim()
      }
    }

    const parts = []
    if (url) parts.push(`来源: ${url}`)
    if (title) parts.push(`# ${title}`)
    if (description) parts.push(`> ${description}`)
    if (content) parts.push(content)
    return parts.join('\n\n').trim()
  }

  /**
     * 处理手动保存会话（从欢迎消息按钮触发）
     * @param {HTMLElement} button - 保存按钮元素
     */
  proto.handleManualSaveSession = async function (button) {
    if (!this.currentSessionId) {
      console.warn('当前没有活动会话')
      this._showManualSaveStatus(button, false)
      return
    }

    if (!this.sessions[this.currentSessionId]) {
      console.warn('会话不存在')
      this._showManualSaveStatus(button, false)
      return
    }

    // 获取按钮元素
    const iconEl = button.querySelector('.save-btn-icon')
    const textEl = button.querySelector('.save-btn-text')
    const loaderEl = button.querySelector('.save-btn-loader')

    try {
      // 设置 loading 状态
      button.disabled = true
      button.classList.add('loading')
      if (textEl) {
        textEl.textContent = '保存中...'
      }
      if (loaderEl) {
        loaderEl.classList.add('visible')
      }

      const session = this.sessions[this.currentSessionId]

      // 获取当前页面内容并更新到会话
      const pageContent = this.getPageContentAsMarkdown()
      session.pageContent = pageContent || ''

      // 更新页面信息（确保信息是最新的）
      const pageInfo = this.getPageInfo()
      const currentPageTitle = normalizeNameSpaces(pageInfo.title || document.title || '当前页面')
      const sessionTitle = session.title || ''
      const isDefaultTitle = !sessionTitle ||
                                  sessionTitle.trim() === '' ||
                                  sessionTitle === '未命名会话' ||
                                  sessionTitle === '新会话' ||
                                  sessionTitle === '未命名页面' ||
                                  sessionTitle === '当前页面'

      // 只有当标题是默认值时才更新，否则保留原有标题
      const ensureMdSuffix = (str) => {
        if (!str || !String(str).trim()) return ''
        const s = String(str).trim()
        return s.endsWith('.md') ? s : `${s}.md`
      }
      session.title = isDefaultTitle ? ensureMdSuffix(currentPageTitle) : sessionTitle
      session.pageDescription = pageInfo.description || session.pageDescription || ''
      session.url = pageInfo.url || session.url || window.location.href

      // 更新会话时间戳
      session.updatedAt = Date.now()
      session.lastAccessTime = Date.now()

      // 先保存到本地存储
      await this.saveAllSessions(true, true)

      // 手动保存时，同步到后端并包含 pageContent 字段
      await this.syncSessionToBackend(this.currentSessionId, true, true)

      // 刷新欢迎消息以隐藏保存按钮（因为现在已存在于后端列表中）
      await this.refreshWelcomeMessage()

      // 显示成功状态
      this._showManualSaveStatus(button, true)

      console.log('会话已手动保存:', this.currentSessionId)
    } catch (error) {
      console.error('手动保存会话失败:', error)
      this._showManualSaveStatus(button, false)
    }
  }

  /**
     * 显示手动保存按钮的状态
     * @param {HTMLElement} button - 按钮元素
     * @param {boolean} success - 是否成功
     */
  proto._showManualSaveStatus = function (button, success) {
    const iconEl = button.querySelector('.save-btn-icon')
    const textEl = button.querySelector('.save-btn-text')
    const loaderEl = button.querySelector('.save-btn-loader')

    // 移除 loading 状态
    button.classList.remove('loading')
    if (loaderEl) loaderEl.classList.remove('visible')

    if (success) {
      // 成功状态
      button.classList.add('success')
      button.classList.remove('error')
      if (iconEl) {
        iconEl.textContent = '✓'
      }
      if (textEl) textEl.textContent = '已保存'
    } else {
      // 失败状态
      button.classList.add('error')
      button.classList.remove('success')
      if (iconEl) {
        iconEl.textContent = '✕'
      }
      if (textEl) textEl.textContent = '保存失败'
    }

    // 2.5秒后恢复按钮状态
    setTimeout(() => {
      button.disabled = false
      button.classList.remove('success', 'error')
      if (iconEl) {
        iconEl.textContent = '💾'
      }
      if (textEl) textEl.textContent = '保存会话'
    }, 2500)
  }

  /**
     * 保存页面上下文编辑器内容到会话
     * @returns {Promise<boolean>} 保存是否成功
     */
  proto.saveContextEditor = async function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (!textarea) {
      console.warn('未找到上下文编辑器')
      return false
    }

    if (!this.currentSessionId) {
      console.warn('当前没有活动会话')
      return false
    }

    if (!this.sessions[this.currentSessionId]) {
      console.warn('会话不存在')
      return false
    }

    try {
      const editedContent = textarea.value || ''
      const session = this.sessions[this.currentSessionId]

      // 更新页面内容
      session.pageContent = editedContent
      // 更新会话时间戳，确保保存逻辑识别到变化
      session.updatedAt = Date.now()
      session.lastAccessTime = Date.now()

      // 如果页面标题还没有设置，同时更新页面标题
      if (!session.title || session.title === '当前页面') {
        const documentTitle = normalizeNameSpaces(document.title || '当前页面')
        const ensureMdSuffix = (str) => {
          if (!str || !String(str).trim()) return ''
          const s = String(str).trim()
          return s.endsWith('.md') ? s : `${s}.md`
        }
        session.title = ensureMdSuffix(documentTitle)
      }

      // 异步保存到存储（同步到后端）
      await this.saveAllSessions(true, true)

      // 手动保存页面上下文时，需要同步到后端并包含 pageContent 字段
      await this.syncSessionToBackend(this.currentSessionId, true, true)

      // 调用 write-file 接口写入页面上下文（参考 YiWeb 的 handleSessionCreate）
      if (typeof this.writeSessionPageContent === 'function') {
        try {
          await this.writeSessionPageContent(this.currentSessionId)
        } catch (writeError) {
          // write-file 调用失败不影响保存流程，只记录警告
          console.warn('[saveContextEditor] write-file 接口调用失败（已忽略）:', writeError?.message)
        }
      }

      console.log('页面上下文已保存到会话:', this.currentSessionId)
      textarea.setAttribute('data-user-edited', '0')
      textarea.setAttribute('data-last-synced-text', textarea.value || '')
      return true
    } catch (error) {
      console.error('保存页面上下文失败:', error)
      return false
    }
  }

  /**
     * 显示保存状态提示
     * @param {HTMLElement} button - 保存按钮元素
     * @param {boolean} success - 是否成功
     * @param {string} originalText - 原始按钮文本（可选，默认使用 '保存'）
     */
  proto._showSaveStatus = function (button, success, originalText = '保存') {
    if (success) {
      button.textContent = '✅'
      button.setAttribute('data-status', 'success')
    } else {
      button.textContent = '⚠️'
      button.setAttribute('data-status', 'error')
    }

    // 2秒后恢复原状态
    setTimeout(() => {
      button.textContent = originalText
      button.removeAttribute('data-status')
    }, 2000)
  }

  // 复制页面上下文编辑器内容
  proto.copyContextEditor = function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (!textarea) return

    const content = textarea.value || ''
    if (!content.trim()) return

    // 复制到剪贴板
    const textArea = document.createElement('textarea')
    textArea.value = content
    textArea.className = 'pet-clipboard-temp'
    document.body.appendChild(textArea)
    textArea.select()

    try {
      document.execCommand('copy')
      // 显示复制成功反馈
      const copyBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-copy-btn') : null
      if (copyBtn) {
        const originalText = copyBtn.textContent
        copyBtn.textContent = '✅'
        copyBtn.setAttribute('data-status', 'success')
        setTimeout(() => {
          copyBtn.textContent = originalText
          copyBtn.removeAttribute('data-status')
        }, 1500)
      }
    } catch (err) {
      console.error('复制失败:', err)
    }

    document.body.removeChild(textArea)
  }

  proto.downloadContextMarkdown = function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (!textarea) return
    const content = textarea.value || ''
    const title = (document.title || 'page').replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '')
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
    const filename = `${title}_${stamp}.md`
    try {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        if (a.parentNode) a.parentNode.removeChild(a)
      }, 0)
    } catch (e) {
      // 忽略下载错误
    }
  }

  proto.loadContextIntoEditor = async function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (!textarea) return
    try {
      // 如果有当前会话，先调用 read-file 接口读取页面上下文
      if (this.currentSessionId && this.sessions[this.currentSessionId]) {
        // 调用 read-file 接口获取页面上下文
        if (typeof this.fetchSessionPageContent === 'function') {
          await this.fetchSessionPageContent(this.currentSessionId)
        }

        // 读取接口返回后，使用会话保存的页面内容
        const session = this.sessions[this.currentSessionId]
        // 如果会话的pageContent字段为空，则弹框内容也为空
        const md = (session.pageContent && session.pageContent.trim() !== '') ? session.pageContent : ''
        textarea.value = md || ''
      } else {
        // 没有会话时，从当前页面获取
        const md = this.buildPageContextMarkdownForEditor()
        textarea.value = md || ''
      }
      textarea.setAttribute('data-user-edited', '0')
      textarea.setAttribute('data-last-synced-text', textarea.value || '')
    } catch (e) {
      console.error('加载页面上下文到编辑器失败:', e)
      textarea.value = '获取页面上下文失败。'
      textarea.setAttribute('data-user-edited', '0')
      textarea.setAttribute('data-last-synced-text', textarea.value || '')
    }
  }

  /**
     * 统一的预览更新函数
     * @param {string} textareaId - 文本框元素 ID
     * @param {string} previewId - 预览区域元素 ID
     */
  proto._updatePreview = function (textareaId, previewId) {
    const textarea = this.chatWindow ? this.chatWindow.querySelector(textareaId) : null
    const preview = this.chatWindow ? this.chatWindow.querySelector(previewId) : null
    if (!textarea || !preview) return

    const markdown = textarea.value || ''
    logger.debug('更新预览', { textareaId, length: markdown.length })

    // 取消之前的 Mermaid 渲染
    if (preview._mermaidTimer) {
      clearTimeout(preview._mermaidTimer)
      preview._mermaidTimer = null
    }
    if (preview._mermaidCancelled) {
      preview._mermaidCancelled()
      preview._mermaidCancelled = null
    }

    // 使用已存在的 Markdown 渲染
    preview.innerHTML = this.renderMarkdown(markdown)

    // 渲染 mermaid（若有）- 防抖，避免频繁触发
    let cancelled = false
    preview._mermaidCancelled = () => { cancelled = true }

    preview._mermaidTimer = setTimeout(async () => {
      if (cancelled) {
        logger.debug('Mermaid 渲染已取消')
        return
      }
      await this.processMermaidBlocks(preview)
      if (typeof this.processTabs === 'function') this.processTabs(preview)
      preview._mermaidTimer = null
      preview._mermaidCancelled = null
    }, MERMAID_RENDER_DEBOUNCE)
  }

  proto.updateContextPreview = function () {
    this._updatePreview('#pet-context-editor-textarea', '#pet-context-preview')
  }

  proto.ensureMessageEditorUi = function () {
    if (!this.chatWindow) return
    if (document.getElementById('pet-message-editor')) return

    const overlay = document.createElement('div')
    overlay.id = 'pet-message-editor'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', '编辑消息')

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeMessageEditor()
      }
    })

    const modal = document.createElement('div')
    modal.className = 'context-editor-modal'

    const header = document.createElement('div')
    header.className = 'context-editor-header'

    const title = document.createElement('div')
    title.className = 'context-editor-title'
    title.textContent = '✏️ 编辑消息（Markdown）'

    const headerBtns = document.createElement('div')
    headerBtns.className = 'editor-header-btns'

    const copyBtn = document.createElement('button')
    copyBtn.id = 'pet-message-copy-btn'
    copyBtn.className = 'chat-toolbar-btn'
    copyBtn.setAttribute('title', '复制内容')
    copyBtn.setAttribute('aria-label', '复制内容')
    copyBtn.textContent = '📋'
    copyBtn.addEventListener('click', () => this.copyMessageEditor())

    const optimizeBtnGroup = document.createElement('div')
    optimizeBtnGroup.className = 'optimize-btn-group'

    const optimizeBtn = document.createElement('button')
    optimizeBtn.id = 'pet-message-optimize-btn'
    optimizeBtn.textContent = '✨'
    optimizeBtn.setAttribute('title', '智能优化消息内容')
    optimizeBtn.setAttribute('aria-label', '智能优化消息内容')
    optimizeBtn.setAttribute('type', 'button')
    optimizeBtn.className = 'chat-toolbar-btn context-optimize-btn'
    optimizeBtn.addEventListener('click', async () => {
      if (typeof this.optimizeMessageEditorContent === 'function') {
        await this.optimizeMessageEditorContent()
      }
    })

    optimizeBtnGroup.appendChild(optimizeBtn)

    const saveBtn = document.createElement('button')
    saveBtn.id = 'pet-message-save-btn'
    saveBtn.className = 'chat-toolbar-btn'
    saveBtn.setAttribute('title', '保存修改 (Ctrl+S / Cmd+S)')
    saveBtn.setAttribute('aria-label', '保存修改')
    saveBtn.textContent = '💾'
    saveBtn.addEventListener('click', async () => {
      if (saveBtn.hasAttribute('data-saving')) return
      saveBtn.setAttribute('data-saving', 'true')
      saveBtn.removeAttribute('data-status')
      const ok = await this.saveMessageEditor()
      saveBtn.removeAttribute('data-saving')
      if (typeof this._showSaveStatus === 'function') {
        this._showSaveStatus(saveBtn, !!ok, '💾')
      }
    })

    const closeBtn = document.createElement('div')
    closeBtn.id = 'pet-message-close-btn'
    closeBtn.setAttribute('aria-label', '关闭编辑器 (Esc)')
    closeBtn.setAttribute('title', '关闭 (Esc)')
    closeBtn.innerHTML = '✕'
    closeBtn.onclick = () => this.closeMessageEditor()

    headerBtns.appendChild(copyBtn)
    headerBtns.appendChild(optimizeBtnGroup)
    headerBtns.appendChild(saveBtn)
    headerBtns.appendChild(closeBtn)
    header.appendChild(title)
    header.appendChild(headerBtns)

    const content = document.createElement('div')
    content.className = 'context-editor-content'

    const body = document.createElement('div')
    body.className = 'context-editor-body'

    const textarea = document.createElement('textarea')
    textarea.id = 'pet-message-editor-textarea'

    const preview = document.createElement('div')
    preview.id = 'pet-message-preview'
    preview.className = 'context-editor-preview markdown-content'
    preview.addEventListener('wheel', (e) => { e.stopPropagation() }, { passive: true })
    preview.addEventListener('touchmove', (e) => { e.stopPropagation() }, { passive: true })

    textarea.addEventListener('input', () => {
      if (this._messagePreviewTimer) clearTimeout(this._messagePreviewTimer)
      this._messagePreviewTimer = setTimeout(() => {
        this.updateMessagePreview()
      }, 150)
    })

    textarea.addEventListener('scroll', () => {
      const previewEl = this.chatWindow ? this.chatWindow.querySelector('#pet-message-preview') : null
      if (!previewEl) return
      const tMax = textarea.scrollHeight - textarea.clientHeight
      const pMax = previewEl.scrollHeight - previewEl.clientHeight
      if (tMax > 0 && pMax >= 0) {
        const ratio = textarea.scrollTop / tMax
        previewEl.scrollTop = ratio * pMax
      }
    }, { passive: true })

    body.appendChild(textarea)
    body.appendChild(preview)
    content.appendChild(body)
    modal.appendChild(header)
    modal.appendChild(content)
    overlay.appendChild(modal)

    const currentPosition = window.getComputedStyle(this.chatWindow).position
    if (currentPosition === 'static') {
      this.chatWindow.style.position = 'relative'
    }

    this.chatWindow.appendChild(overlay)
  }

  proto.updateMessageEditorPosition = function () {
    if (!this.chatWindow) return
    const overlay = this.chatWindow.querySelector('#pet-message-editor')
    if (!overlay) return
    const chatHeaderEl = this.chatWindow.querySelector('.chat-header')
    const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60
    overlay.style.setProperty('--pet-message-editor-top', headerH + 'px')
  }

  proto.openMessageEditor = function (messageDiv) {
    if (!messageDiv) return
    this.ensureMessageEditorUi()
    const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor-textarea') : null
    if (!overlay || !textarea) return

    const found = (typeof this.findMessageObjectByDiv === 'function') ? this.findMessageObjectByDiv(messageDiv) : null
    if (!found || !found.message) {
      if (typeof this.showNotification === 'function') this.showNotification('未找到要编辑的消息', 'error')
      return
    }

    const originalText = String(found.message.content ?? found.message.message ?? '')
    textarea.value = originalText
    textarea.setAttribute('data-original-text', originalText)

    overlay.dataset.messageIndex = String(found.index)
    overlay.dataset.messageType = String(found.message.type || '')

    overlay.classList.add('js-visible')
    this.updateMessageEditorPosition()
    this.updateMessagePreview()

    this._messageEditorTargetDiv = messageDiv

    setTimeout(() => {
      try {
        textarea.focus()
        textarea.select()
      } catch (_) { }
    }, 0)

    this._messageKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeMessageEditor()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        const saveBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-message-save-btn') : null
        if (saveBtn && !saveBtn.hasAttribute('data-saving')) {
          saveBtn.click()
        }
      }
    }
    document.addEventListener('keydown', this._messageKeydownHandler, { capture: true })

    this._messageResizeHandler = () => this.updateMessageEditorPosition()
    window.addEventListener('resize', this._messageResizeHandler, { passive: true })
  }

  proto.closeMessageEditor = function () {
    const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null
    if (overlay) overlay.classList.remove('js-visible')

    if (this._messageKeydownHandler) {
      document.removeEventListener('keydown', this._messageKeydownHandler, { capture: true })
      this._messageKeydownHandler = null
    }
    if (this._messageResizeHandler) {
      window.removeEventListener('resize', this._messageResizeHandler)
      this._messageResizeHandler = null
    }
    this._messageEditorTargetDiv = null
  }

  proto.updateMessagePreview = function () {
    this._updatePreview('#pet-message-editor-textarea', '#pet-message-preview')
  }

  proto.copyMessageEditor = function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor-textarea') : null
    if (!textarea) return

    const content = textarea.value || ''
    if (!content.trim()) return

    const textArea = document.createElement('textarea')
    textArea.value = content
    textArea.className = 'pet-clipboard-temp'
    document.body.appendChild(textArea)
    textArea.select()

    try {
      document.execCommand('copy')
      const copyBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-message-copy-btn') : null
      if (copyBtn) {
        const originalText = copyBtn.textContent
        copyBtn.textContent = '✅'
        copyBtn.setAttribute('data-status', 'success')
        setTimeout(() => {
          copyBtn.textContent = originalText
          copyBtn.removeAttribute('data-status')
        }, 1500)
      }
    } catch (err) {
      console.error('复制失败:', err)
    }

    document.body.removeChild(textArea)
  }

  proto.saveMessageEditor = async function () {
    if (!this.chatWindow || !this.currentSessionId || !this.sessions[this.currentSessionId]) {
      return false
    }

    const overlay = this.chatWindow.querySelector('#pet-message-editor')
    const textarea = this.chatWindow.querySelector('#pet-message-editor-textarea')
    if (!overlay || !textarea) return false

    const editedText = String(textarea.value ?? '')
    const session = this.sessions[this.currentSessionId]

    let messageIndex = -1
    if (this._messageEditorTargetDiv && typeof this.findMessageObjectByDiv === 'function') {
      const found = this.findMessageObjectByDiv(this._messageEditorTargetDiv)
      if (found && typeof found.index === 'number') {
        messageIndex = found.index
      }
    }
    if (messageIndex < 0) {
      const idx = Number(overlay.dataset.messageIndex)
      if (Number.isFinite(idx)) messageIndex = idx
    }
    if (messageIndex < 0 || messageIndex >= (session.messages ? session.messages.length : 0)) {
      if (typeof this.showNotification === 'function') this.showNotification('消息定位失败，无法保存', 'error')
      return false
    }

    const msg = session.messages[messageIndex]
    if (!msg) return false

    msg.content = editedText
    msg.message = editedText
    session.updatedAt = Date.now()
    session.lastAccessTime = Date.now()

    const targetDiv = this._messageEditorTargetDiv
    if (targetDiv) {
      const isUserMessage = !!targetDiv.querySelector('[data-message-type="user-bubble"]')
      const bubble = targetDiv.querySelector(isUserMessage ? '[data-message-type="user-bubble"]' : '[data-message-type="pet-bubble"]')
      if (bubble) {
        bubble.setAttribute('data-original-text', editedText)

        let contentDiv = bubble.querySelector('.pet-chat-content')
        const typingDiv = bubble.querySelector('.pet-chat-typing')
        if (typingDiv) typingDiv.remove()

        if (editedText.trim()) {
          if (!contentDiv) {
            contentDiv = document.createElement('div')
            contentDiv.className = 'pet-chat-content md-preview-body markdown-content'
            const meta = bubble.querySelector('.pet-chat-meta')
            if (meta) {
              bubble.insertBefore(contentDiv, meta)
            } else {
              bubble.appendChild(contentDiv)
            }
          }
          contentDiv.innerHTML = this.renderMarkdown(editedText)
          setTimeout(async () => {
            try {
              await this.processMermaidBlocks(contentDiv)
              if (typeof this.processTabs === 'function') this.processTabs(contentDiv)
            } catch (_) { }
          }, 80)
        } else {
          if (contentDiv) contentDiv.remove()
        }
      }

      if (this.chatWindowComponent && typeof this.chatWindowComponent.addActionButtonsToMessage === 'function') {
        this.chatWindowComponent.addActionButtonsToMessage(targetDiv, true)
      }
    }

    try {
      if (typeof this.saveCurrentSession === 'function') {
        await this.saveCurrentSession(false, true)
      } else if (typeof this.saveAllSessions === 'function') {
        await this.saveAllSessions(false, true)
      }
      if (this.sessionApi && typeof this.syncSessionToBackend === 'function' && PET_CONFIG.api.syncSessionsToBackend) {
        await this.syncSessionToBackend(this.currentSessionId, true, false)
      }
    } catch (e) {
      if (typeof this.showNotification === 'function') this.showNotification('保存失败', 'error')
      return false
    }

    if (typeof this.showNotification === 'function') this.showNotification('已保存', 'success')
    this.closeMessageEditor()
    return true
  }
})(typeof window !== 'undefined' ? window : this)
