(function (global) {
  'use strict'

  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  const proto = global.PetManager.prototype

  proto.ensureContextEditorUi = function () {
    if (!this.chatWindow) return
    if (document.getElementById('pet-context-editor')) return

    const overlay = document.createElement('div')
    overlay.id = 'pet-context-editor'

    const modal = document.createElement('div')
    modal.className = 'context-editor-modal'

    const header = document.createElement('div')
    header.className = 'context-editor-header'
    const title = document.createElement('div')
    title.className = 'context-editor-title'
    title.textContent = '📝 页面上下文（Markdown）'
    const headerBtns = document.createElement('div')
    headerBtns.className = 'editor-header-btns'
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
    closeBtn.onclick = () => this.closeContextEditor()
    headerBtns.appendChild(modeGroup)

    const copyBtn = document.createElement('button')
    copyBtn.id = 'pet-context-copy-btn'
    copyBtn.className = 'chat-toolbar-btn'
    copyBtn.setAttribute('title', '复制内容')
    copyBtn.setAttribute('aria-label', '复制内容')
    copyBtn.textContent = '📋'
    copyBtn.addEventListener('click', () => this.copyContextEditor())

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

        refreshBtn.textContent = '✓'
        refreshBtn.setAttribute('data-status', 'success')

        const overlayEl = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor') : null
        if (overlayEl) {
          overlayEl.setAttribute('data-flash', 'true')
          setTimeout(() => overlayEl.removeAttribute('data-flash'), 420)
        }

        setTimeout(() => {
          refreshBtn.textContent = '🔄'
          refreshBtn.removeAttribute('data-refreshing')
          refreshBtn.removeAttribute('data-status')
        }, 2000)
      } catch (error) {
        console.error('拉取网页上下文失败:', error)

        refreshBtn.textContent = '✕'
        refreshBtn.setAttribute('data-status', 'error')

        setTimeout(() => {
          refreshBtn.textContent = '🔄'
          refreshBtn.removeAttribute('data-refreshing')
          refreshBtn.removeAttribute('data-status')
        }, 2000)
      }
    })

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
        this._showSaveStatus(saveBtn, success, originalText)
      } catch (error) {
        console.error('保存失败:', error)
        this._showSaveStatus(saveBtn, false, originalText)
      } finally {
        setTimeout(() => {
          saveBtn.removeAttribute('data-saving')
        }, 2000)
      }
    })

    const downloadBtn = document.createElement('button')
    downloadBtn.id = 'pet-context-download-btn'
    downloadBtn.className = 'chat-toolbar-btn'
    downloadBtn.setAttribute('title', '下载当前上下文为 Markdown (.md)')
    downloadBtn.setAttribute('aria-label', '下载当前上下文为 Markdown (.md)')
    downloadBtn.textContent = '⬇️'
    downloadBtn.addEventListener('click', () => this.downloadContextMarkdown())

    const translateBtnGroup = document.createElement('div')
    translateBtnGroup.className = 'translate-btn-group'

    const translateToZhBtn = document.createElement('button')
    translateToZhBtn.id = 'pet-context-translate-zh-btn'
    translateToZhBtn.className = 'chat-toolbar-btn'
    translateToZhBtn.setAttribute('title', '翻译成中文')
    translateToZhBtn.setAttribute('aria-label', '翻译成中文')
    translateToZhBtn.textContent = '🇨🇳'
    translateToZhBtn.addEventListener('click', async () => {
      await this.translateContext('zh')
    })

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
    preview.addEventListener('wheel', (e) => { e.stopPropagation() }, { passive: true })
    preview.addEventListener('touchmove', (e) => { e.stopPropagation() }, { passive: true })
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
          this.showNotification?.('图片上传失败，已使用本地图片', 'warning')
        }
      }
    })
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
    this.updateContextEditorPosition()
    await this.loadContextIntoEditor()
    this.updateContextPreview()
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (textarea) {
      textarea.removeAttribute('data-original-text')
      textarea.removeAttribute('data-undo-notification')
    }
    this._contextPreviewMode = this._contextPreviewMode || 'split'
    this.applyContextPreviewMode()
    this.chatWindow.classList.add('context-editor-open')
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

  proto.setContextMode = function (mode) {
    this._contextPreviewMode = mode
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

  proto.updateContextEditorPosition = function () {
    if (!this.chatWindow) return
    const overlay = this.chatWindow.querySelector('#pet-context-editor')
    if (!overlay) return
    const chatHeaderEl = this.chatWindow.querySelector('.chat-header')
    const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60
    overlay.style.setProperty('--pet-context-editor-top', headerH + 'px')
  }

  proto._showSaveStatus = function (button, success, originalText) {
    if (success) {
      button.textContent = '✓'
      button.setAttribute('data-status', 'success')
    } else {
      button.textContent = '⚠️'
      button.setAttribute('data-status', 'error')
    }

    setTimeout(() => {
      button.textContent = originalText
      button.removeAttribute('data-status')
    }, 2000)
  }

  proto.showSessionContext = async function (sessionIdOrEvent, session) {
    let sessionId = null

    if (typeof sessionIdOrEvent === 'string') {
      sessionId = sessionIdOrEvent
    } else if (sessionIdOrEvent && session) {
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

      if (this.currentSessionId !== sessionId) {
        console.log('切换到会话以显示上下文:', sessionId)

        if (typeof this.switchSession === 'function') {
          await this.switchSession(sessionId)
        } else if (typeof this.activateSession === 'function') {
          await this.activateSession(sessionId, {
            saveCurrent: false,
            updateConsistency: true,
            updateUI: true,
            syncToBackend: false
          })
        } else {
          this.currentSessionId = sessionId
        }

        const switched = await waitFor(() => this.currentSessionId === sessionId, 1500)
        if (!switched) {
          throw new Error('会话切换超时')
        }

        if (typeof this.fetchSessionPageContent === 'function') {
          await this.fetchSessionPageContent(sessionId)
        }
      } else {
        if (typeof this.fetchSessionPageContent === 'function') {
          await this.fetchSessionPageContent(sessionId)
        }
      }

      await this.openContextEditor()

      console.log('已打开会话的页面上下文:', sessionId)
    } catch (error) {
      console.error('显示会话上下文失败:', error)
      this.showNotification('显示上下文失败：' + (error.message || '未知错误'), 'error')
    }
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
      } catch (_) {}
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
        copyBtn.textContent = '✓'
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

  console.log('[PetManager] petManager.editor.ui.js 已加载')
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this)))
