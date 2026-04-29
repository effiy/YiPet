/**
 * PetManager Session Module (Compatibility Layer)
 * 会话模块兼容层 - 代码已拆分到 session/ 目录
 *
 * 此文件保留以确保向后兼容，所有功能已迁移到以下文件：
 * - session/petManager.session.crud.js     - 会话增删改查
 * - session/petManager.session.filter.js   - 会话过滤搜索
 * - session/petManager.session.tag.js      - 会话标签管理
 * - session/petManager.session.batch.js    - 会话批量操作
 */
(function () {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  const proto = window.PetManager.prototype
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)))
  const normalizeNameSpaces = (value) => String(value ?? '').trim().replace(/\s+/g, '_')

  console.log('[PetManager] Session compatibility layer loaded')

  proto.addMessageToSession = async function (type, content, timestamp = null, syncToBackend = true, imageDataUrl = null, allowEmpty = false) {
    if (!this.currentSessionId) {
      console.warn('没有当前会话，无法添加消息')
      return
    }

    if (!this.sessions[this.currentSessionId]) {
      console.warn('会话不存在，无法添加消息:', this.currentSessionId)
      return
    }

    const session = this.sessions[this.currentSessionId]

    if (!Array.isArray(session.messages)) {
      session.messages = []
    }

    const hasTextContent = content && typeof content === 'string' && content.trim()
    const hasSingleImage = typeof imageDataUrl === 'string' && imageDataUrl.trim()
    const hasMultiImages = Array.isArray(imageDataUrl) && imageDataUrl.some(v => typeof v === 'string' && v.trim())
    const hasImage = hasSingleImage || hasMultiImages

    if (!hasTextContent && !hasImage && !allowEmpty) {
      console.warn('消息内容为空或无效，跳过保存')
      return
    }

    const message = {
      type,
      content: hasTextContent ? content.trim() : '',
      message: hasTextContent ? content.trim() : '',
      timestamp: timestamp || Date.now()
    }

    if (hasImage) {
      if (hasSingleImage) {
        message.imageDataUrl = imageDataUrl.trim()
        message.imageDataUrls = [imageDataUrl.trim()]
      } else {
        const list = imageDataUrl
          .filter(v => typeof v === 'string')
          .map(v => v.trim())
          .filter(Boolean)
        if (list.length > 0) {
          message.imageDataUrls = list
          message.imageDataUrl = list[0]
        }
      }
    }

    const lastMessage = session.messages[session.messages.length - 1]
    if (lastMessage &&
        lastMessage.type === message.type &&
        String(lastMessage.content ?? lastMessage.message ?? '') === String(message.content ?? message.message ?? '') &&
        String(lastMessage.imageDataUrl || '') === String(message.imageDataUrl || '') &&
        (Date.now() - lastMessage.timestamp) < 1000) {
      const previewText = hasTextContent ? message.content.substring(0, 30) : (hasImage ? '[图片]' : '')
      console.log('检测到重复消息，跳过保存:', previewText)
      return
    }

    if (type === 'pet' && session.messages.length === 0) {
      return
    }

    session.messages.push(message)
    session.updatedAt = Date.now()

    const previewText = hasTextContent ? message.content.substring(0, 50) : (hasImage ? '[图片消息]' : '')
    console.log(`消息已添加到会话 ${this.currentSessionId} (${session.messages.length} 条):`,
      message.type, previewText)

    if (session.messages.length === 1) {
      setTimeout(async () => {
        try {
          if (typeof this.refreshWelcomeMessage === 'function') {
            await this.refreshWelcomeMessage()
          }
        } catch (error) {
          console.warn('刷新欢迎消息失败:', error)
        }
      }, 100)
    }
  }

  proto.callUpdateDocument = async function (sessionId, newMessages = []) {
    if (!sessionId) {
      console.warn('没有会话 ID，无法调用 update_document')
      return
    }

    try {
      const session = this.sessions[sessionId] || {}
      const existingMessages = Array.isArray(session.messages) ? session.messages : []
      const updatedMessages = [...existingMessages, ...newMessages]

      const normalizeMessagesForBackend = (messages) => {
        const list = Array.isArray(messages) ? messages : []
        return list.map((m) => {
          const type = (m && m.type === 'pet') ? 'pet' : 'user'
          const message = String(m?.message ?? m?.content ?? '').trim()
          const timestamp = Number(m?.timestamp) || Date.now()
          const imageDataUrls = Array.isArray(m?.imageDataUrls) ? m.imageDataUrls.filter(Boolean) : []
          const imageDataUrl = String(m?.imageDataUrl || '').trim()
          const payload = { type, message, timestamp }
          if (imageDataUrls.length > 0) {
            payload.imageDataUrls = imageDataUrls
            payload.imageDataUrl = imageDataUrls[0]
          } else if (imageDataUrl) {
            payload.imageDataUrl = imageDataUrl
            payload.imageDataUrls = [imageDataUrl]
          }
          if (m?.error) payload.error = true
          if (m?.aborted) payload.aborted = true
          return payload
        })
      }

      const sessionUrl = session.url || ''
      const pageDescription = session.pageDescription || ''
      const now = Date.now()

      const localSessionData = {
        key: sessionId,
        url: sessionUrl,
        title: session.title || '',
        pageDescription,
        messages: updatedMessages,
        tags: Array.isArray(session.tags) ? session.tags : [],
        isFavorite: session.isFavorite !== undefined ? Boolean(session.isFavorite) : false,
        createdAt: session.createdAt || now,
        updatedAt: now,
        lastAccessTime: now
      }

      if (!this.sessions[sessionId]) {
        this.sessions[sessionId] = {}
      }
      Object.assign(this.sessions[sessionId], localSessionData)

      if (this.sessionApi && this.sessionApi.isEnabled()) {
        const isAicrSession = String(sessionUrl || '').startsWith('aicr-session://') || String(pageDescription || '').includes('文件：')
        const backendSessionData = {
          key: sessionId,
          url: sessionUrl,
          title: localSessionData.title,
          pageDescription,
          messages: normalizeMessagesForBackend(updatedMessages),
          tags: localSessionData.tags,
          isFavorite: localSessionData.isFavorite,
          createdAt: localSessionData.createdAt,
          updatedAt: localSessionData.updatedAt,
          lastAccessTime: localSessionData.lastAccessTime
        }
        if (!isAicrSession && session._isApiRequestSession && session.pageContent && String(session.pageContent).trim() !== '') {
          backendSessionData.pageContent = String(session.pageContent || '')
        }

        const payload = {
          module_name: 'services.database.data_service',
          method_name: 'update_document',
          parameters: {
            cname: 'sessions',
            key: sessionId,
            data: backendSessionData
          }
        }

        const apiUrl = this.sessionApi.baseUrl || (typeof PET_CONFIG !== 'undefined' ? PET_CONFIG.api.yiaiBaseUrl : '')
        const response = await fetch(`${apiUrl}/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.getAuthHeaders ? this.getAuthHeaders() : {})
          },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const envelope = await response.json()
        if (!envelope || typeof envelope !== 'object') {
          throw new Error('响应格式错误')
        }
        if (envelope.code !== 0) {
          throw new Error(envelope.message || `请求失败 (code=${envelope.code})`)
        }
        console.log('[callUpdateDocument] update_document 接口调用成功:', sessionId)
        return envelope.data
      } else {
        console.warn('[callUpdateDocument] 会话 API 未启用')
      }
    } catch (error) {
      console.error('[callUpdateDocument] 调用 update_document 接口失败:', error)
      throw error
    }
  }

  proto.saveCurrentSession = async function (force = false, syncToBackend = true) {
    if (!this.currentSessionId) return

    if (!this.sessions[this.currentSessionId]) {
      console.warn('会话不存在，无法保存:', this.currentSessionId)
      return
    }

    const session = this.sessions[this.currentSessionId]

    let pageInfo = null
    let isUrlMatched = false
    try {
      pageInfo = this.getPageInfo()
      isUrlMatched = session.url === pageInfo.url
    } catch (error) {
      console.warn('获取页面信息失败，使用会话中已有的信息', {
        error: String(error && error.message || error)
      })
      pageInfo = {
        url: session.url || window.location.href,
        title: normalizeNameSpaces(session.title || document.title || '未命名页面'),
        description: session.pageDescription || '',
        content: session.pageContent || ''
      }
      isUrlMatched = session.url === pageInfo.url
    }

    if (this.chatWindow) {
      const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages')
      if (messagesContainer) {
        const messageElements = Array.from(messagesContainer.children)
        const messages = []

        for (const msgEl of messageElements) {
          const userBubble = msgEl.querySelector('[data-message-type="user-bubble"]')
          const petBubble = msgEl.querySelector('[data-message-type="pet-bubble"]')

          if (userBubble) {
            const content = userBubble.getAttribute('data-original-text') || userBubble.textContent || ''
            const imgElement = userBubble.querySelector('img')
            const imageDataUrl = imgElement ? imgElement.src : null

            if (content.trim() || imageDataUrl) {
              const message = {
                type: 'user',
                content: content.trim() || '',
                timestamp: this.getMessageTimestamp ? this.getMessageTimestamp(msgEl) : Date.now()
              }

              if (imageDataUrl) {
                message.imageDataUrl = imageDataUrl
              }

              messages.push(message)
            }
          }
        }
      }
    }

    await this.saveAllSessions(force, syncToBackend)
  }

  proto.initSessionWithDelay = async function () {
    if (this.sessionInitPending) {
      return
    }
    this.sessionInitPending = true

    const isPageLoaded = document.readyState === 'complete'

    if (isPageLoaded) {
      console.log('页面已加载完成，等待1秒后初始化会话')
      await sleep(1000)
      await this.initSession()
    } else {
      console.log('等待页面加载完成，然后延迟1秒后初始化会话')
      const handleLoad = async () => {
        window.removeEventListener('load', handleLoad)
        await sleep(1000)
        await this.initSession()
      }
      window.addEventListener('load', handleLoad)
    }
  }

  proto.isSessionInBackendList = async function (sessionId = null) {
    const targetSessionId = sessionId || this.currentSessionId
    if (!targetSessionId) {
      return false
    }

    if (this.sessionApi && !this.isChatWindowFirstOpen) {
      try {
        const backendSessions = await this.sessionApi.getSessionsList({ forceRefresh: false })
        const currentPageUrl = window.location.href
        for (const backendSession of backendSessions) {
          if (backendSession.url === currentPageUrl) {
            const sessionKey = backendSession.key || backendSession.conversation_id
            if (sessionKey) {
              console.log('当前页面URL在会话列表中，正在加载会话详情:', sessionKey)
              try {
                const sessionDetail = await this.sessionApi.getSession(sessionKey, true)
                if (sessionDetail) {
                  console.log('会话详情加载成功:', sessionKey)
                  const sessionUrl = backendSession.url || ''
                  if (sessionUrl && this.sessions) {
                    const sid = await this.generateSessionId(sessionUrl)
                    const title = sessionDetail.title || ''
                    const existingKey = this.sessions[sid]?.key
                    if (this.sessions[sid]) {
                      this.sessions[sid] = {
                        ...this.sessions[sid],
                        ...sessionDetail,
                        key: sessionDetail.key || existingKey || this._generateUUID(),
                        title: title || this.sessions[sid].title || ''
                      }
                    }
                  }
                }
              } catch (error) {
                console.warn('加载会话详情失败:', error)
              }
            }
            break
          }
        }
      } catch (error) {
        console.warn('获取后端会话列表失败:', error)
        return false
      }
    }

    return false
  }

  proto.manualRefresh = async function () {
    console.log('[petManager] manualRefresh called')
    try {
      console.log('[petManager] Starting refresh...')
      await this.loadAllSessions()
      console.log('刷新完成')
      if (typeof this.showNotification === 'function') {
        this.showNotification('刷新成功', 'success')
      }
    } catch (error) {
      console.warn('刷新失败:', error)
      if (typeof this.showNotification === 'function') {
        this.showNotification('刷新失败：' + error.message, 'error')
      }
    }
  }

  proto.getMessageTimestamp = function (msgEl) {
    const timeEl = msgEl.querySelector('[data-message-time="true"]')
    if (timeEl) {
      const timeText = timeEl.textContent.trim()
    }
    return Date.now()
  }

  proto.switchSession = async function (sessionId) {
    if (this.isSwitchingSession || sessionId === this.currentSessionId) {
      return
    }

    if (!this.sessions[sessionId]) {
      console.error('会话不存在:', sessionId)
      this.showNotification('会话不存在', 'error')
      return
    }

    this.isSwitchingSession = true

    const clickedItem = this.sessionSidebar?.querySelector(`[data-session-id="${sessionId}"]`)
    const previousActiveItem = this.sessionSidebar?.querySelector('.session-item.active')
    const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages')

    if (clickedItem) {
      clickedItem.classList.add('switching')
      if (previousActiveItem && previousActiveItem !== clickedItem) {
        previousActiveItem.classList.remove('active')
      }
    }

    if (messagesContainer && this.isChatOpen) {
      messagesContainer.classList.add('pet-is-fading')
    }

    try {
      await this.activateSession(sessionId, {
        saveCurrent: false,
        updateConsistency: false,
        updateUI: false,
        syncToBackend: false,
        preserveOrder: true
      })

      if (typeof this.fetchSessionPageContent === 'function') {
        await this.fetchSessionPageContent(sessionId)
      }

      await new Promise(resolve => {
        requestAnimationFrame(async () => {
          await this.updateSessionSidebar()
          resolve()
        })
      })

      if (this.chatWindow && this.isChatOpen) {
        if (!this.sessions[sessionId]) {
          await this.loadAllSessions()
        }

        if (typeof this.loadSessionMessages === 'function') {
          await this.loadSessionMessages()
        }

        if (typeof this.updateChatHeaderTitle === 'function') {
          this.updateChatHeaderTitle()
        }

        const loadedMessagesCount = messagesContainer?.querySelectorAll('[data-message-type="user-bubble"], [data-message-type="pet-bubble"]:not([data-welcome-message])').length || 0
        const sessionMessagesCount = this.sessions[sessionId]?.messages?.length || 0
        console.log(`会话切换完成，已加载 ${loadedMessagesCount} 条消息 (会话中存储了 ${sessionMessagesCount} 条)`)

        requestAnimationFrame(() => {
          if (messagesContainer) {
            messagesContainer.classList.remove('pet-is-fading')
          }
        })
      }
    } catch (error) {
      console.error('切换会话时出错:', error)

      if (previousActiveItem) {
        previousActiveItem.classList.add('active')
      }
      if (clickedItem) {
        clickedItem.classList.remove('switching')
      }
      if (messagesContainer) {
        messagesContainer.classList.remove('pet-is-fading')
      }

      this.showNotification('切换会话失败，请重试', 'error')
      throw error
    } finally {
      if (clickedItem) {
        clickedItem.classList.remove('switching')
      }
      this.isSwitchingSession = false
    }
  }

  proto.writeSessionPageContent = async function (sessionId) {
    if (!this.isChatOpen) {
      console.log('[writeSessionPageContent] 聊天对话框未打开')
      return
    }

    const session = this.sessions[sessionId]
    if (!session) {
      console.warn('[writeSessionPageContent] 会话不存在:', sessionId)
      return
    }

    const apiUrl = (window.API_URL && /^https?:\/\//i.test(window.API_URL))
      ? String(window.API_URL).replace(/\/+$/, '')
      : (PET_CONFIG?.api?.yiaiBaseUrl || '')

    if (!apiUrl) {
      console.warn('[writeSessionPageContent] API_URL 未配置')
      return
    }

    const tags = Array.isArray(session.tags) ? session.tags : []
    let currentPath = ''
    tags.forEach((folderName) => {
      const folder = normalizeNameSpaces(folderName)
      if (!folder || folder.toLowerCase() === 'default') return
      currentPath = currentPath ? currentPath + '/' + folder : folder
    })

    let fileName = normalizeNameSpaces(session.title || 'Untitled')
    fileName = String(fileName).replace(/\//g, '-')
    let cleanPath = currentPath ? currentPath + '/' + fileName : fileName
    cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '')

    if (cleanPath.startsWith('static/')) {
      cleanPath = cleanPath.substring(7)
    }
    cleanPath = cleanPath.replace(/^\/+/, '')

    if (!cleanPath && session.key) {
      cleanPath = `session_${session.key}.txt`
    }

    if (!cleanPath) {
      console.warn('[writeSessionPageContent] 无法确定文件路径')
      return
    }

    const pageContent = session.pageContent || ''

    try {
      console.log('[writeSessionPageContent] 调用 write-file 接口，路径:', cleanPath, '内容长度:', pageContent.length)
      const res = await fetch(`${apiUrl}/write-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_file: cleanPath,
          content: pageContent,
          is_base64: false
        })
      })

      if (res.ok) {
        const json = await res.json()
        if (json.code === 0) {
          console.log('[writeSessionPageContent] write-file 接口调用成功，文件路径:', cleanPath)
          if (session.pageDescription && session.pageDescription.includes('文件：')) {
            session.pageDescription = session.pageDescription.replace(/文件：.*/, `文件：${cleanPath}`)
          }

          if (typeof this.loadSessionsFromBackend === 'function') {
            try {
              await this.loadSessionsFromBackend(true)
            } catch (refreshError) {
              console.warn('[writeSessionPageContent] 刷新会话列表失败:', refreshError)
            }
          }
        } else {
          console.warn('[writeSessionPageContent] write-file 接口返回异常:', json)
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.warn('[writeSessionPageContent] write-file 接口调用失败，状态码:', res.status, errorData.message || '')
      }
    } catch (error) {
      console.warn('[writeSessionPageContent] write-file 接口调用异常:', error?.message)
    }
  }

  proto.fetchSessionPageContent = async function (sessionId) {
    const session = this.sessions[sessionId]
    if (!session) {
      console.warn('[fetchSessionPageContent] 会话不存在:', sessionId)
      return
    }

    const apiUrl = (window.API_URL && /^https?:\/\//i.test(window.API_URL))
      ? String(window.API_URL).replace(/\/+$/, '')
      : (PET_CONFIG?.api?.yiaiBaseUrl || '')

    if (!apiUrl) {
      console.warn('[fetchSessionPageContent] API_URL 未配置')
      return
    }

    const tags = Array.isArray(session.tags) ? session.tags : []
    let currentPath = ''
    tags.forEach((folderName) => {
      const folder = normalizeNameSpaces(folderName)
      if (!folder || folder.toLowerCase() === 'default') return
      currentPath = currentPath ? currentPath + '/' + folder : folder
    })

    let fileName = normalizeNameSpaces(session.title || 'Untitled')
    fileName = String(fileName).replace(/\//g, '-')
    let cleanPath = currentPath ? currentPath + '/' + fileName : fileName
    cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '')
    if (cleanPath.startsWith('static/')) {
      cleanPath = cleanPath.substring(7)
    }
    cleanPath = cleanPath.replace(/^\/+/, '')

    const getDescPath = () => {
      const pageDesc = session.pageDescription || ''
      if (!pageDesc || !pageDesc.includes('文件：')) return ''
      let p = pageDesc.replace('文件：', '').trim()
      p = p.replace(/\\/g, '/').replace(/^\/+/, '')
      if (p.startsWith('static/')) {
        p = p.substring(7)
      }
      p = p.replace(/^\/+/, '')
      return p
    }
    const descPath = getDescPath()

    if (!cleanPath && session.key) {
      cleanPath = `session_${session.key}.txt`
    }

    if (!cleanPath) {
      console.warn('[fetchSessionPageContent] 无法确定文件路径')
      return
    }

    try {
      const readOnce = async (targetFile) => {
        if (!targetFile) return { ok: false }
        console.log('[fetchSessionPageContent] 调用 read-file 接口，路径:', targetFile)
        const res = await fetch(`${apiUrl}/read-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_file: targetFile })
        })
        if (!res.ok) return { ok: false, status: res.status }
        const json = await res.json().catch(() => null)
        if (!json || json.code !== 0 || !json.data || !json.data.content) return { ok: false, json }
        if (json.data.type === 'base64') return { ok: false, json }
        return { ok: true, content: json.data.content }
      }

      let result = await readOnce(cleanPath)
      if ((!result || !result.ok) && descPath && descPath !== cleanPath) {
        result = await readOnce(descPath)
      }
      if (result && result.ok) {
        session.pageContent = result.content
        console.log('[fetchSessionPageContent] 已更新会话页面上下文')
      } else {
        console.warn('[fetchSessionPageContent] read-file 接口返回异常')
      }
    } catch (error) {
      console.error('[fetchSessionPageContent] read-file 接口调用异常:', error)
    }
  }

  proto.deleteSessionFile = async function (sessionId) {
    const session = this.sessions[sessionId]
    if (!session) {
      console.warn('[deleteSessionFile] 会话不存在:', sessionId)
      return
    }

    const apiUrl = (window.API_URL && /^https?:\/\//i.test(window.API_URL))
      ? String(window.API_URL).replace(/\/+$/, '')
      : ((typeof PET_CONFIG !== 'undefined' ? PET_CONFIG.api.yiaiBaseUrl : '') || '')

    if (!apiUrl) {
      console.warn('[deleteSessionFile] API_URL 未配置')
      return
    }

    const tags = Array.isArray(session.tags) ? session.tags : []
    let currentPath = ''
    tags.forEach((folderName) => {
      const folder = normalizeNameSpaces(folderName)
      if (!folder || folder.toLowerCase() === 'default') return
      currentPath = currentPath ? currentPath + '/' + folder : folder
    })

    let fileName = normalizeNameSpaces(session.title || 'Untitled')
    fileName = String(fileName).replace(/\//g, '-')
    let cleanPath = currentPath ? currentPath + '/' + fileName : fileName
    cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '')

    if (cleanPath.startsWith('static/')) {
      cleanPath = cleanPath.substring(7)
    }
    cleanPath = cleanPath.replace(/^\/+/, '')

    const getDescPath = () => {
      const pageDesc = session.pageDescription || ''
      if (!pageDesc || !pageDesc.includes('文件：')) return ''
      let p = pageDesc.replace('文件：', '').trim()
      p = p.replace(/\\/g, '/').replace(/^\/+/, '')
      if (p.startsWith('static/')) {
        p = p.substring(7)
      }
      p = p.replace(/^\/+/, '')
      return p
    }
    const descPath = getDescPath()

    if (!cleanPath && session.key) {
      cleanPath = `session_${session.key}.txt`
    }

    if (!cleanPath) {
      console.warn('[deleteSessionFile] 无法确定文件路径')
      return
    }

    try {
      const deleteOnce = async (targetFile) => {
        if (!targetFile) return { ok: false }
        console.log('[deleteSessionFile] 调用 delete-file 接口，路径:', targetFile)
        const res = await fetch(`${apiUrl}/delete-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_file: targetFile })
        })
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          return { ok: false, status: res.status, message: errorData.message || '' }
        }
        const json = await res.json().catch(() => null)
        if (json && json.code === 0) return { ok: true }
        return { ok: false, json }
      }

      let result = await deleteOnce(cleanPath)
      if ((!result || !result.ok) && descPath && descPath !== cleanPath) {
        result = await deleteOnce(descPath)
      }
      if (result && result.ok) {
        console.log('[deleteSessionFile] delete-file 接口调用成功')
      } else {
        console.warn('[deleteSessionFile] delete-file 接口返回异常')
      }
    } catch (error) {
      console.warn('[deleteSessionFile] delete-file 接口调用异常:', error?.message)
    }
  }

  proto.editSessionTitle = async function (sessionId) {
    if (!sessionId || !this.sessions[sessionId]) {
      console.warn('会话不存在，无法编辑标题:', sessionId)
      return
    }

    const session = this.sessions[sessionId]
    const originalTitle = session.title || '未命名会话'
    const originalDescription = session.pageDescription || ''

    if (typeof this.openSessionInfoEditor === 'function') {
      this.openSessionInfoEditor(sessionId, originalTitle, originalDescription)
    } else {
      console.error('openSessionInfoEditor 方法不存在，请确保 petManager.sessionEditor.js 已正确加载')
      if (typeof this.showNotification === 'function') {
        this.showNotification('编辑功能不可用：编辑器模块未加载', 'error')
      }
    }
  }

  console.log('[PetManager] Session compatibility layer fully loaded')
})()
