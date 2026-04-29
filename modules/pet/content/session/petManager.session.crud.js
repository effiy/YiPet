/**
 * Session CRUD Module
 * 会话增删改查模块
 */
(function () {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  const proto = window.PetManager.prototype
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)))
  const normalizeNameSpaces = (value) => String(value ?? '').trim().replace(/\s+/g, '_')

  // ========== 会话初始化与核心流程 ==========

  proto.initSession = async function () {
    const pageInfo = this.getPageInfo()
    const currentUrl = pageInfo.url
    const isSamePage = this.currentPageUrl === currentUrl

    await this.loadAllSessions()

    if (isSamePage && this.hasAutoCreatedSessionForPage && this.currentSessionId) {
      if (this.sessions[this.currentSessionId]) {
        const needsUpdate = this.ensureSessionConsistency(this.currentSessionId)
        if (needsUpdate) {
          await this.updateSessionUI({ updateTitle: true })
        } else {
          const session = this.sessions[this.currentSessionId]
          const now = Date.now()
          if (!session.lastAccessTime || (now - session.lastAccessTime) > 60000) {
            session.lastAccessTime = now
          }
        }
        await this.updateSessionUI({ updateSidebar: true })
      }
      return this.currentSessionId
    }

    if (!isSamePage) {
      this.currentPageUrl = currentUrl
      this.hasAutoCreatedSessionForPage = false
    }

    let matchedSessionId = null
    for (const [sessionId, session] of Object.entries(this.sessions)) {
      if (session && session.url === currentUrl) {
        matchedSessionId = sessionId
        break
      }
    }

    if (matchedSessionId) {
      const existingSession = this.sessions[matchedSessionId]
      if (existingSession) {
        this.updateSessionPageInfo(matchedSessionId, pageInfo)
        await this.activateSession(matchedSessionId, {
          saveCurrent: false,
          updateConsistency: true,
          updateUI: true
        })
        return matchedSessionId
      }
    }

    const sessionId = await this.generateSessionId(currentUrl)
    const existingSession = this.sessions[sessionId]

    if (existingSession) {
      this.updateSessionPageInfo(sessionId, pageInfo)
      await this.activateSession(sessionId, {
        saveCurrent: false,
        updateConsistency: true,
        updateUI: true
      })
      return sessionId
    } else {
      const newSession = this.createSessionObject(pageInfo)
      this.sessions[sessionId] = newSession
      if (typeof this.writeSessionPageContent === 'function') {
        await this.writeSessionPageContent(sessionId)
      }
      await this.saveAllSessions(true, true)
      await this.activateSession(sessionId, {
        saveCurrent: false,
        updateConsistency: true,
        updateUI: true
      })
      return sessionId
    }
  }

  proto.activateSession = async function (sessionId, options = {}) {
    const {
      saveCurrent = true,
      updateConsistency = true,
      updateUI = true,
      syncToBackend = true,
      skipBackendFetch = false,
      keepApiRequestListView = false,
      preserveOrder = false
    } = options

    const targetSession = this.sessions[sessionId]
    if (!targetSession) {
      console.error('目标会话不存在:', sessionId)
      return
    }

    this.currentSessionId = sessionId
    this.currentPageUrl = targetSession.url || null
    const pageInfo = this.getPageInfo()
    const isUrlMatched = targetSession.url === pageInfo.url

    this.hasAutoCreatedSessionForPage = isUrlMatched

    const isBlankSession = !targetSession.url ||
                          targetSession.url.startsWith('blank-session://') ||
                          targetSession._isBlankSession
    const isNewSession = targetSession.createdAt && (Date.now() - targetSession.createdAt) < 5000

    if (!skipBackendFetch && !isNewSession && this.sessionApi && this.sessionApi.isEnabled() && !this.isChatWindowFirstOpen) {
      try {
        const sessionKey = targetSession.key || sessionId
        if (!this._sessionQueryCache) {
          this._sessionQueryCache = {}
        }
        const now = Date.now()
        const lastQueryTime = this._sessionQueryCache[sessionKey]
        const QUERY_CACHE_INTERVAL = 2000

        if (lastQueryTime && (now - lastQueryTime) < QUERY_CACHE_INTERVAL) {
          console.log('会话最近已查询过，跳过重复查询:', sessionKey)
        } else {
          console.log('会话高亮，正在从后端获取完整数据:', sessionKey)
          const fullSession = await this.sessionApi.getSession(sessionKey, true)
          this._sessionQueryCache[sessionKey] = now

          if (fullSession) {
            const existingSession = this.sessions[sessionId]
            if (existingSession) {
              if (fullSession.messages && Array.isArray(fullSession.messages)) {
                existingSession.messages = fullSession.messages
              }
              if (fullSession.pageDescription) {
                existingSession.pageDescription = fullSession.pageDescription
              }
              const isAicrSession = String(existingSession.url || '').startsWith('aicr-session://') ||
                                    String(existingSession.pageDescription || '').includes('文件：')
              if (!isAicrSession && fullSession.pageContent) {
                existingSession.pageContent = fullSession.pageContent
              }
              const title = fullSession.title || existingSession.title
              existingSession.title = normalizeNameSpaces(title)
              if (!preserveOrder) {
                existingSession.updatedAt = fullSession.updatedAt || existingSession.updatedAt
                existingSession.createdAt = fullSession.createdAt || existingSession.createdAt
                existingSession.lastAccessTime = fullSession.lastAccessTime || existingSession.lastAccessTime
              }
            } else {
              const title = normalizeNameSpaces(fullSession.title || '')
              if (!fullSession.key) {
                fullSession.key = this._generateUUID()
              }
              this.sessions[sessionId] = {
                ...fullSession,
                title
              }
            }

            if (sessionId === this.currentSessionId && this.isChatOpen) {
              this.updateChatHeaderTitle()
            }
          }
        }
      } catch (error) {
        const is404 = error.message && (
          error.message.includes('404') ||
          error.message.includes('Not Found') ||
          error.status === 404 ||
          error.response?.status === 404
        )
        if (is404) {
          console.log('会话在后端不存在，使用本地数据:', sessionId)
        } else {
          console.warn('从后端获取会话完整数据失败:', error.message)
        }
      }
    } else if (skipBackendFetch || isNewSession) {
      if (skipBackendFetch) {
        console.log('跳过从后端获取数据:', sessionId)
      } else if (isNewSession) {
        console.log('跳过从后端获取数据:', sessionId)
      }
    }

    if (updateConsistency && isUrlMatched) {
      const needsUpdate = this.ensureSessionConsistency(sessionId)
    } else if (!isUrlMatched && !preserveOrder) {
      console.log(`切换到会话 ${sessionId}：URL不匹配，不更新页面信息`)
      const now = Date.now()
      if (!targetSession.lastAccessTime || (now - targetSession.lastAccessTime) > 60000) {
        targetSession.lastAccessTime = now
      }
    } else if (preserveOrder) {
      console.log(`切换到会话 ${sessionId}：保持排列位置不变`)
    }

    if (updateUI) {
      await this.updateSessionUI({
        updateSidebar: true,
        updateTitle: true,
        loadMessages: this.isChatOpen,
        keepApiRequestListView
      })
    }
  }

  proto.createSessionObject = function (pageInfo, existingSession = null) {
    const now = Date.now()
    const messages = existingSession?.messages || []
    const createdAt = existingSession?.createdAt || now
    const lastAccessTime = now
    const rawTitle = normalizeNameSpaces(pageInfo.title || '')
    let title = rawTitle || '新会话'
    const tags = existingSession?.tags ? [...existingSession.tags] : []

    if (!existingSession) {
      const addMdSuffix = (str) => {
        if (!str || !str.trim()) return str
        return str.trim().endsWith('.md') ? str.trim() : str.trim() + '.md'
      }

      if (rawTitle) {
        title = addMdSuffix(rawTitle)
      } else {
        title = '新会话.md'
      }

      if (pageInfo.url && typeof pageInfo.url === 'string') {
        try {
          const customProtocols = ['blank-session://', 'import-session://', 'aicr-session://']
          const isCustomProtocol = customProtocols.some(protocol => pageInfo.url.startsWith(protocol))
          if (!isCustomProtocol) {
            let urlToProcess = pageInfo.url
            if (!urlToProcess.startsWith('http://') && !urlToProcess.startsWith('https://')) {
              urlToProcess = 'https://' + urlToProcess
            }
            const urlObj = new URL(urlToProcess)
            const domain = urlObj.hostname
            const mainDomain = domain.startsWith('www.') ? domain.substring(4) : domain
            if (mainDomain && !tags.includes(mainDomain)) {
              tags.push(mainDomain)
            }
          }
        } catch (error) {
          console.warn('[createSessionObject] 从URL提取域名失败:', pageInfo.url, error)
        }
      }
    }

    return {
      url: pageInfo.url,
      title: normalizeNameSpaces(title),
      pageDescription: pageInfo.description || '',
      pageContent: pageInfo.content || '',
      messages,
      tags,
      createdAt,
      updatedAt: now,
      lastAccessTime
    }
  }

  proto.ensureSessionConsistency = function (sessionId) {
    if (!sessionId || !this.sessions[sessionId]) {
      return false
    }

    const session = this.sessions[sessionId]
    const pageInfo = this.getPageInfo()

    const isBlankSession = session._isBlankSession ||
                          !session.url ||
                          session.url.startsWith('blank-session://')

    if (isBlankSession) {
      console.log(`确保会话一致性 ${sessionId}：空白会话`)
      let updated = false
      if (!Array.isArray(session.messages)) {
        session.messages = []
        updated = true
      }
      if (!session.createdAt) {
        session.createdAt = Date.now()
        updated = true
      }
      if (!session.updatedAt) {
        session.updatedAt = Date.now()
        updated = true
      }
      return updated
    }

    if (session.url !== pageInfo.url) {
      console.log(`确保会话一致性 ${sessionId}：URL不匹配`)
      return false
    }

    let updated = false

    if (session.url !== pageInfo.url) {
      session.url = pageInfo.url
      updated = true
    }

    const currentPageTitle = normalizeNameSpaces(pageInfo.title || '')
    let sessionTitle = session.title || ''
    const normalizedSessionTitle = sessionTitle ? normalizeNameSpaces(sessionTitle) : ''
    if (sessionTitle && normalizedSessionTitle && normalizedSessionTitle !== sessionTitle) {
      session.title = normalizedSessionTitle
      sessionTitle = normalizedSessionTitle
      updated = true
    }
    const isDefaultTitle = !sessionTitle ||
                          sessionTitle.trim() === '' ||
                          sessionTitle === '未命名会话' ||
                          sessionTitle === '新会话' ||
                          sessionTitle === '未命名页面' ||
                          sessionTitle === '当前页面' ||
                          sessionTitle === '新会话.md'

    const addMdSuffix = (str) => {
      if (!str || !str.trim()) return str
      return str.trim().endsWith('.md') ? str.trim() : str.trim() + '.md'
    }

    const nextTitle = currentPageTitle ? addMdSuffix(currentPageTitle) : ''

    if (isDefaultTitle && nextTitle && nextTitle !== sessionTitle) {
      session.title = normalizeNameSpaces(nextTitle)
      updated = true
    }

    const pageDescription = pageInfo.description || ''
    if (session.pageDescription !== pageDescription) {
      session.pageDescription = pageDescription
      updated = true
    }

    if (!session.pageContent || session.pageContent.trim() === '') {
      session.pageContent = pageInfo.content
      updated = true
    }

    if (!Array.isArray(session.messages)) {
      session.messages = []
      updated = true
    }

    if (!session.createdAt) {
      session.createdAt = Date.now()
      updated = true
    }

    if (!session.updatedAt) {
      session.updatedAt = Date.now()
      updated = true
    }

    const now = Date.now()
    if (!session.lastAccessTime || (now - session.lastAccessTime) > 60000) {
      session.lastAccessTime = now
      updated = true
    }

    return updated
  }

  proto.updateSessionPageInfo = function (sessionId, pageInfo) {
    if (!this.sessions[sessionId]) return false

    const session = this.sessions[sessionId]

    const isBlankSession = session._isBlankSession ||
                          !session.url ||
                          session.url.startsWith('blank-session://')
    if (isBlankSession) {
      console.log(`更新会话页面信息 ${sessionId}：空白会话`)
      const now = Date.now()
      Object.assign(session, {
        updatedAt: now,
        lastAccessTime: now
      })
      return true
    }

    if (session.url !== pageInfo.url) {
      console.log(`更新会话页面信息 ${sessionId}：URL不匹配`)
      return false
    }

    const sessionData = this.createSessionObject(pageInfo, session)
    const now = Date.now()

    Object.assign(session, {
      url: sessionData.url,
      title: sessionData.title,
      pageDescription: sessionData.pageDescription || '',
      pageContent: sessionData.pageContent || session.pageContent || '',
      updatedAt: sessionData.updatedAt,
      lastAccessTime: now
    })

    return true
  }

  // ========== 数据同步与持久化 ==========

  proto.loadAllSessions = async function () {
    if (this.isChatOpen) {
      await this.loadSessionsFromBackend(true)
    }
    if (!this.sessions) {
      this.sessions = {}
    }
  }

  proto.saveAllSessions = async function (force = false, syncToBackend = true) {
    const now = Date.now()

    if (!force && (now - this.lastSessionSaveTime) < this.SESSION_SAVE_THROTTLE) {
      this.pendingSessionUpdate = true
      if (this.sessionUpdateTimer) {
        clearTimeout(this.sessionUpdateTimer)
      }
      return new Promise((resolve) => {
        this.sessionUpdateTimer = setTimeout(async () => {
          this.pendingSessionUpdate = false
          await this._doSaveAllSessions(syncToBackend)
          resolve()
        }, this.SESSION_SAVE_THROTTLE - (now - this.lastSessionSaveTime))
      })
    }

    this.pendingSessionUpdate = false
    if (this.sessionUpdateTimer) {
      clearTimeout(this.sessionUpdateTimer)
      this.sessionUpdateTimer = null
    }
    return await this._doSaveAllSessions(syncToBackend)
  }

  proto._doSaveAllSessions = async function (syncToBackend = true) {
    this.lastSessionSaveTime = Date.now()

    if (this.isChatOpen && syncToBackend && PET_CONFIG.api.syncSessionsToBackend && this.currentSessionId) {
      this.syncSessionToBackend(this.currentSessionId, false).catch(err => {
        console.warn('同步会话到后端失败:', err)
      })
    }
  }

  proto.syncSessionToBackend = async function (sessionId, immediate = false, includePageContent = false) {
    try {
      if (!this.isChatOpen) {
        console.debug('聊天窗口未打开，跳过同步会话到后端:', sessionId)
        return
      }

      if (!PET_CONFIG.api.syncSessionsToBackend) {
        return
      }

      const session = this.sessions[sessionId]
      if (!session) {
        console.warn('会话不存在，无法同步:', sessionId)
        return
      }

      const isBlankSession = session._isBlankSession ||
                            !session.url ||
                            session.url.startsWith('blank-session://') ||
                            session.url.startsWith('aicr-session://')

      let sessionUrl = ''
      if (isBlankSession) {
        if (session._originalUrl && (session._originalUrl.startsWith('blank-session://') || session._originalUrl.startsWith('aicr-session://'))) {
          sessionUrl = session._originalUrl
        } else if (session.url && (session.url.startsWith('blank-session://') || session.url.startsWith('aicr-session://'))) {
          sessionUrl = session.url
        } else {
          sessionUrl = session._originalUrl || `aicr-session://${session.createdAt || Date.now()}-${Math.random().toString(36).substr(2, 11)}`
        }
      } else {
        sessionUrl = session.url || ''
      }

      const pageDescription = session.pageDescription || ''
      const pageContent = session.pageContent || ''
      const title = session.title || '新会话'

      const sessionKey = session.key || this._generateUUID()
      if (!session.key) {
        session.key = sessionKey
      }

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

      const sessionData = {
        key: sessionKey,
        url: sessionUrl,
        title,
        pageDescription,
        messages: normalizeMessagesForBackend(session.messages),
        tags: session.tags || [],
        createdAt: session.createdAt || Date.now(),
        updatedAt: session.updatedAt || Date.now(),
        lastAccessTime: session.lastAccessTime || Date.now(),
        isFavorite: session.isFavorite !== undefined ? !!session.isFavorite : false
      }

      const isAicrSession = String(sessionUrl || '').startsWith('aicr-session://') || String(pageDescription || '').includes('文件：')
      if (!isAicrSession && (includePageContent || (session._isApiRequestSession && pageContent && pageContent.trim() !== ''))) {
        sessionData.pageContent = pageContent
      }

      if (this.sessionApi) {
        if (immediate) {
          try {
            const result = await this.sessionApi.saveSession(sessionData)
            if (result?.data?.session) {
              const updatedSession = result.data.session
              if (this.sessions[sessionId]) {
                const localSession = this.sessions[sessionId]
                this.sessions[sessionId] = {
                  ...updatedSession,
                  messages: localSession.messages?.length > updatedSession.messages?.length ? localSession.messages : updatedSession.messages,
                  pageContent: (localSession.pageContent && localSession.pageContent.trim() !== '') ? localSession.pageContent : (updatedSession.pageContent || localSession.pageContent || ''),
                  isFavorite: localSession.isFavorite !== undefined ? !!localSession.isFavorite : (updatedSession.isFavorite !== undefined ? !!updatedSession.isFavorite : false)
                }
                if (!this.sessions[sessionId].title) {
                  this.sessions[sessionId].title = updatedSession.title || localSession.title || '新会话'
                }
              }
            }
            this.lastSessionListLoadTime = 0
            console.log(`会话 ${sessionId} 已立即同步到后端`)
          } catch (error) {
            throw error
          }
        } else {
          this.sessionApi.queueSave(sessionData)
          console.log(`会话 ${sessionId} 已加入保存队列`)
        }
      }
    } catch (error) {
      console.warn('同步会话到后端时出错:', error.message)
    }
  }

  proto.loadSessionsFromBackend = async function (forceRefresh = false) {
    try {
      if (!forceRefresh) { return }
      if (!this.isChatOpen) { return }
      if (this.hasLoadedSessionsForChat && this.lastSessionListLoadTime && (Date.now() - this.lastSessionListLoadTime) < this.SESSION_LIST_RELOAD_INTERVAL) {
        return
      }

      if (!this.sessionApi) {
        console.log('sessionApi 未初始化，跳过从后端加载')
        return
      }

      console.log('从后端加载会话列表...')
      const backendSessions = await this.sessionApi.getSessionsList({ forceRefresh })

      if (!Array.isArray(backendSessions)) {
        console.warn('后端返回的会话列表格式不正确')
        return
      }

      if (!this.sessions) {
        this.sessions = {}
      }

      const parseTime = (timeVal) => {
        if (!timeVal) return 0
        if (typeof timeVal === 'number') return timeVal
        if (typeof timeVal === 'string') {
          const d = new Date(timeVal)
          if (!isNaN(d.getTime())) return d.getTime()
        }
        return 0
      }

      const newSessions = {}
      for (const backendSession of backendSessions) {
        if (!backendSession.key) {
          console.warn('会话缺少 key 字段，跳过:', backendSession)
          continue
        }

        const sessionUrl = backendSession.url || ''
        const isBlankSession = sessionUrl.startsWith('blank-session://') ||
                              sessionUrl.startsWith('aicr-session://') ||
                              backendSession._isBlankSession

        const createdAt = parseTime(backendSession.createdAt) ||
                         parseTime(backendSession.createdTime) ||
                         parseTime(backendSession.created_time) ||
                         Date.now()
        const updatedAt = parseTime(backendSession.updatedAt) ||
                         parseTime(backendSession.updatedTime) ||
                         parseTime(backendSession.updated_time) ||
                         Date.now()
        const lastAccessTime = parseTime(backendSession.lastAccessTime) ||
                              parseTime(backendSession.last_access_time) ||
                              updatedAt

        const localSession = {
          key: backendSession.key,
          url: sessionUrl,
          title: (backendSession.title || '新会话'),
          pageDescription: backendSession.pageDescription || '',
          pageContent: isBlankSession ? (backendSession.pageContent || '') : ((sessionUrl.startsWith('aicr-session://') || String(backendSession.pageDescription || '').includes('文件：')) ? '' : (backendSession.pageContent || '')),
          messages: backendSession.messages || [],
          tags: backendSession.tags || [],
          createdAt,
          updatedAt,
          lastAccessTime,
          isFavorite: backendSession.isFavorite !== undefined ? !!backendSession.isFavorite : false
        }

        if (isBlankSession) {
          localSession._isBlankSession = true
          localSession._originalUrl = sessionUrl
        }
        newSessions[backendSession.key] = localSession
      }

      this.sessions = newSessions
      this.lastSessionListLoadTime = Date.now()
      this.hasLoadedSessionsForChat = true
      await this.updateSessionUI({ updateSidebar: true })
      console.log('会话列表已从后端加载，当前会话数量:', Object.keys(this.sessions).length)
    } catch (error) {
      console.warn('从后端加载会话列表失败:', error)
    }
  }

  // ========== 辅助方法 ==========

  proto.findSessionByUrl = function (url) {
    return Object.values(this.sessions).find(session => session.url === url) || null
  }

  proto.generateSessionId = async function (url) {
    if (typeof md5 !== 'function') {
      throw new Error('MD5函数未找到')
    }
    return md5(String(url || ''))
  }

  proto._generateUUID = function () {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  proto.createBlankSession = async function () {
    const title = window.prompt('新建会话名称：')
    if (!title || !title.trim()) {
      return
    }

    let sessionTitle = title.trim()

    const addMdSuffix = (str) => {
      if (!str || !str.trim()) return str
      return str.trim().endsWith('.md') ? str.trim() : str.trim() + '.md'
    }

    sessionTitle = addMdSuffix(sessionTitle)
    await this.loadAllSessions()

    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 11)
    const uniqueUrl = `aicr-session://${timestamp}-${randomStr}`
    const now = Date.now()

    const sessionDataForCreate = {
      url: uniqueUrl,
      title: sessionTitle,
      pageDescription: '',
      pageContent: '',
      messages: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
      lastAccessTime: now,
      isFavorite: false
    }

    try {
      let createdSessionKey = null
      if (this.sessionApi && this.sessionApi.isEnabled()) {
        try {
          const result = typeof this.sessionApi.createSession === 'function'
            ? await this.sessionApi.createSession(sessionDataForCreate)
            : null
          createdSessionKey =
            result?.data?.key ||
            result?.data?._id ||
            result?.data?.id ||
            result?.data?.session?.key ||
            result?.data?.session?._id ||
            result?.data?.session?.id ||
            result?.data?.document?.key ||
            result?.data?.document?._id ||
            result?.data?.document?.id ||
            result?.key ||
            result?._id ||
            result?.id ||
            null
          if (!createdSessionKey) {
            throw new Error('后端未返回会话 key')
          }
          console.log('[createBlankSession] 会话已通过 create_document 创建:', createdSessionKey)
        } catch (error) {
          console.error('[createBlankSession] 创建会话失败:', error)
          this.showNotification('创建会话失败：' + (error.message || '未知错误'), 'error')
          return
        }
      }

      const finalSessionKey = createdSessionKey || this._generateUUID()
      const sessionData = {
        ...sessionDataForCreate,
        key: finalSessionKey
      }

      this.sessions[finalSessionKey] = sessionData
      await this.saveAllSessions(false, true)

      if (typeof this.writeSessionPageContent === 'function') {
        try {
          await this.writeSessionPageContent(finalSessionKey)
        } catch (writeError) {
          console.warn('[createBlankSession] write-file 接口调用失败:', writeError?.message)
        }
      }

      if (this.sessionApi && this.sessionApi.isEnabled()) {
        try {
          await this.loadSessionsFromBackend(true)
        } catch (refreshError) {
          console.warn('[createBlankSession] 刷新会话列表失败:', refreshError?.message)
        }
      }

      if (!this.sessions[finalSessionKey]) {
        this.sessions[finalSessionKey] = sessionData
      }

      await this.activateSession(finalSessionKey, {
        saveCurrent: false,
        updateConsistency: false,
        updateUI: true,
        syncToBackend: false,
        skipBackendFetch: true
      })

      this.showNotification('会话创建成功', 'success')
      return finalSessionKey
    } catch (error) {
      console.error('[createBlankSession] 创建会话失败:', error)
      this.showNotification('创建会话失败：' + (error.message || '未知错误'), 'error')
      throw error
    }
  }

  proto.deleteSession = async function (sessionId, skipConfirm = false) {
    if (!sessionId || !this.sessions[sessionId]) return

    const session = this.sessions[sessionId]
    const sessionTitle = session?.title || sessionId || '未命名会话'

    if (!skipConfirm) {
      const confirmDelete = confirm(`确定要删除会话"${sessionTitle}"吗？`)
      if (!confirmDelete) return
    }

    if (typeof this.deleteSessionFile === 'function') {
      await this.deleteSessionFile(sessionId)
    }

    const isCurrentSession = sessionId === this.currentSessionId

    if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
      try {
        const sessionKey = session.key
        if (sessionKey) {
          await this.sessionApi.deleteSession(sessionKey)
          console.log('会话已从后端删除:', sessionKey)
        }
      } catch (error) {
        console.warn('从后端删除会话失败:', error)
      }
    }

    delete this.sessions[sessionId]

    if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
      try {
        await this.loadSessionsFromBackend(true)
      } catch (error) {
        console.warn('刷新会话列表失败:', error)
      }
    }

    if (isCurrentSession) {
      const otherSessions = Object.values(this.sessions)
      if (otherSessions.length > 0) {
        const latestSession = otherSessions.sort((a, b) => {
          const aTime = a.lastAccessTime || a.createdAt || 0
          const bTime = b.lastAccessTime || b.createdAt || 0
          return bTime - aTime
        })[0]
        const latestSessionKey = latestSession.key
        if (!latestSessionKey) {
          console.warn('最新会话缺少 key 字段:', latestSession)
          return
        }
        await this.activateSession(latestSessionKey, {
          saveCurrent: false,
          syncToBackend: false
        })
      } else {
        this.currentSessionId = null
        this.hasAutoCreatedSessionForPage = false
        if (this.chatWindow && this.isChatOpen) {
          const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages')
          if (messagesContainer) {
            messagesContainer.innerHTML = ''
          }
        }
      }
    }

    await this.updateSessionUI({ updateSidebar: true })
    console.log('会话已删除:', sessionId)
  }

  proto.duplicateSession = async function (sessionId) {
    if (!sessionId || !this.sessions[sessionId]) {
      this.showNotification('会话不存在', 'error')
      return
    }

    let sourceSession = this.sessions[sessionId]

    try {
      if (this.sessionApi) {
        try {
          const fullSessionData = await this.sessionApi.getSession(sessionId)
          if (fullSessionData) {
            sourceSession = {
              ...sourceSession,
              ...fullSessionData,
              pageContent: fullSessionData.pageContent !== undefined ? fullSessionData.pageContent : sourceSession.pageContent
            }
          }
        } catch (error) {
          console.warn('从后端获取源会话详情失败:', error)
        }
      }

      const newSessionId = await this.generateSessionId(`duplicate_${Date.now()}_${Math.random()}`)
      const newUrl = sourceSession.url ? `${sourceSession.url}#duplicate_${Date.now()}` : ''
      const now = Date.now()

      const duplicatedSession = {
        key: this._generateUUID(),
        url: newUrl,
        title: (() => {
          const base = sourceSession.title || '新会话.md'
          const s = String(base || '').trim()
          if (!s) return '新会话 (副本).md'
          if (s.endsWith('.md')) {
            return `${s.slice(0, -3)} (副本).md`
          }
          return `${s} (副本)`
        })(),
        pageDescription: sourceSession.pageDescription || '',
        pageContent: sourceSession.pageContent || '',
        messages: [],
        tags: sourceSession.tags ? [...sourceSession.tags] : [],
        isFavorite: sourceSession.isFavorite !== undefined ? sourceSession.isFavorite : false,
        createdAt: now,
        updatedAt: now,
        lastAccessTime: now
      }

      if (this.isChatOpen && this.sessionApi) {
        try {
          await this.sessionApi.saveSession(duplicatedSession)
          this.sessions[newSessionId] = duplicatedSession
          if (PET_CONFIG.api.syncSessionsToBackend && this.isChatOpen) {
            try {
              await this.loadSessionsFromBackend(true)
            } catch (loadError) {
              console.warn('从后端加载会话列表失败:', loadError)
            }
          }
          await this.updateSessionUI({ updateSidebar: true })
          this.showNotification('会话副本已创建', 'success')
        } catch (error) {
          console.error('保存会话副本到后端失败:', error)
          this.showNotification('创建副本失败：' + error.message, 'error')
        }
      } else {
        this.sessions[newSessionId] = duplicatedSession
        await this.updateSessionUI({ updateSidebar: true })
        this.showNotification('会话副本已创建', 'success')
      }
    } catch (error) {
      console.error('创建会话副本失败:', error)
      this.showNotification('创建副本失败：' + error.message, 'error')
    }
  }

  proto.formatSessionTime = function (timestamp) {
    return TimeUtils.formatRelativeTime(timestamp)
  }

  proto.toggleSessionFavorite = async function (sessionId) {
    if (!sessionId || !this.sessions[sessionId]) {
      console.warn('会话不存在，无法切换收藏状态:', sessionId)
      return
    }

    const session = this.sessions[sessionId]
    const currentFavorite = session.isFavorite || false
    session.isFavorite = !currentFavorite
    session.updatedAt = Date.now()

    if (this.isChatOpen && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
      try {
        await this.syncSessionToBackend(sessionId, true)
      } catch (error) {
        console.warn('同步收藏状态到后端失败:', error)
      }
    }

    if (this.sessionSidebar) {
      await this.updateSessionSidebar()
    }
  }

  proto.setSessionFavorite = async function (sessionKey, isFavorite) {
    if (!sessionKey) {
      console.warn('会话 key 为空，无法更新收藏状态')
      return
    }

    let sessionId = null
    if (this.sessions && this.sessions[sessionKey]) {
      sessionId = sessionKey
    } else if (this.sessions) {
      for (const [id, s] of Object.entries(this.sessions)) {
        if (s && s.key === sessionKey) {
          sessionId = id
          break
        }
      }
    }

    if (!sessionId || !this.sessions || !this.sessions[sessionId]) {
      console.warn('未找到对应会话，无法更新收藏状态:', sessionKey)
      return
    }

    const session = this.sessions[sessionId]
    session.isFavorite = !!isFavorite
    session.updatedAt = Date.now()

    if (this.isChatOpen && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
      try {
        await this.syncSessionToBackend(sessionId, true)
      } catch (error) {
        console.warn('同步收藏状态到后端失败:', error)
      }
    }

    if (typeof this.updateSessionSidebar === 'function') {
      await this.updateSessionSidebar(false, false)
    }
  }

  console.log('[PetManager] Session CRUD module loaded')
})()
