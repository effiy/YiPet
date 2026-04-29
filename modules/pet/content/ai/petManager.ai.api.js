/**
 * AI API 封装模块
 * 负责 API 调用、请求重试、流式响应处理
 */
(function (global) {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  const proto = global.PetManager.prototype
  const logger = (typeof window !== 'undefined' && window.LoggerUtils && typeof window.LoggerUtils.getLogger === 'function')
    ? window.LoggerUtils.getLogger('ai')
    : console

  const DEFAULT_SYSTEM_PROMPT = '你是一个俏皮活泼、古灵精怪的小女友，聪明有趣，时而调侃时而贴心。语气活泼可爱，会开小玩笑，但也会关心用户。'

  // 工具函数
  const normalizeNameSpaces = (value) => String(value ?? '').trim().replace(/\s+/g, '_')
  const ensureMdSuffix = (str) => {
    if (!str || !String(str).trim()) return ''
    const s = String(str).trim()
    return s.endsWith('.md') ? s : `${s}.md`
  }
  const isDefaultSessionTitle = (title) => {
    const currentTitle = String(title ?? '')
    return !currentTitle ||
            currentTitle.trim() === '' ||
            currentTitle === '未命名会话' ||
            currentTitle === '新会话' ||
            currentTitle === '未命名页面' ||
            currentTitle === '当前页面'
  }
  const extractSseText = (chunk) => {
    if (!chunk) return null
    if (chunk.message && chunk.message.content) return chunk.message.content
    if (chunk.data && chunk.data.message) return chunk.data.message
    if (chunk.content) return chunk.content
    if (chunk.type === 'content') return chunk.data
    return null
  }
  const handleSseMetaChunk = (manager, chunk) => {
    if (!chunk || typeof chunk !== 'object') return false
    if (chunk.type === 'context_info') {
      const contextData = chunk.data || {}
      if (contextData.chats_count > 0) {
        logger.info(`检索到 ${contextData.chats_count} 条聊天记录`)
      }
      return true
    }
    if (chunk.type === 'chat_saved') {
      const conversationId = chunk.conversation_id
      if (conversationId && !manager.currentSessionId) {
        manager.currentSessionId = conversationId
        logger.info('从后端同步会话 ID:', conversationId)
      } else if (conversationId && manager.currentSessionId !== conversationId) {
        logger.info('后端返回的会话 ID 与当前不同:', conversationId, 'vs', manager.currentSessionId)
      }
      return true
    }
    return false
  }

  // 去除 think 内容（思考过程）
  proto.stripThinkContent = function (content) {
    if (!content || typeof content !== 'string') {
      return content
    }
    let cleaned = String(content)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '')
    cleaned = cleaned.replace(/```think[\s\S]*?```/gi, '')
    return cleaned.trim()
  }

  // 构建 prompt 请求 payload，自动包含会话 ID
  proto.buildPromptPayload = function (fromSystem, fromUser, options = {}) {
    const payload = {
      fromSystem: fromSystem || DEFAULT_SYSTEM_PROMPT,
      fromUser
    }

    if (fromUser && typeof fromUser === 'string') {
      const { images, videos, cleanedText } = this.extractMediaUrls ? this.extractMediaUrls(fromUser) : { images: [], videos: [], cleanedText: fromUser }

      payload.fromUser = cleanedText || ''

      const allImages = [...images]

      let imageDataUrls = []
      if (options.imageDataUrl) {
        imageDataUrls = Array.isArray(options.imageDataUrl) ? options.imageDataUrl : [options.imageDataUrl]
      }

      if (imageDataUrls.length === 0 && options.messageDiv) {
        const userBubble = options.messageDiv.querySelector('[data-message-type="user-bubble"]')
        if (userBubble) {
          const imgElements = userBubble.querySelectorAll('img')
          imgElements.forEach(img => {
            if (img.src && !imageDataUrls.includes(img.src)) {
              imageDataUrls.push(img.src)
            }
          })
        }

        if (imageDataUrls.length === 0 && this.findMessageObjectByDiv) {
          const messageResult = this.findMessageObjectByDiv(options.messageDiv)
          if (messageResult && messageResult.message && messageResult.message.imageDataUrl) {
            const imgUrl = messageResult.message.imageDataUrl
            if (typeof imgUrl === 'string') {
              imageDataUrls.push(imgUrl)
            } else if (Array.isArray(imgUrl)) {
              imageDataUrls = imgUrl
            }
          }
        }
      }

      imageDataUrls.forEach(imgUrl => {
        if (imgUrl && typeof imgUrl === 'string' && !allImages.includes(imgUrl)) {
          allImages.push(imgUrl)
        }
      })

      if (options.images && Array.isArray(options.images)) {
        options.images.forEach(img => {
          if (!allImages.includes(img)) {
            allImages.push(img)
          }
        })
      }
      if (allImages.length > 0) {
        payload.images = allImages
      }

      const allVideos = [...videos]
      if (options.videos && Array.isArray(options.videos)) {
        options.videos.forEach(video => {
          if (!allVideos.includes(video)) {
            allVideos.push(video)
          }
        })
      }
      if (allVideos.length > 0) {
        payload.videos = allVideos
      }
    } else {
      if (options.images !== undefined) {
        payload.images = options.images
      }
      if (options.videos !== undefined) {
        payload.videos = options.videos
      }
    }

    if (this.currentSessionId) {
      payload.conversation_id = this.currentSessionId
    }

    if (options.user_id) {
      payload.user_id = options.user_id
    }

    return payload
  }

  // 通用的流式响应处理方法
  proto.processStreamingResponse = async function (response, onContent) {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      const messages = buffer.split('\n\n')
      buffer = messages.pop() || ''

      for (const message of messages) {
        if (message.startsWith('data: ')) {
          try {
            const dataStr = message.substring(6)
            const chunk = JSON.parse(dataStr)

            if (handleSseMetaChunk(this, chunk)) continue

            const text = extractSseText(chunk)
            if (text !== null && text !== undefined) {
              fullContent += text
              if (onContent) onContent(text, fullContent)
            } else if (chunk.done === true) {
              logger.info('流式响应完成')
            } else if (chunk.type === 'error' || chunk.error) {
              const errorMsg = chunk.data || chunk.error || '未知错误'
              logger.error('流式响应错误:', errorMsg)
              throw new Error(errorMsg)
            }
          } catch (e) {
            logger.warn('解析 SSE 消息失败:', message, e)
          }
        }
      }
    }

    if (buffer.trim()) {
      const message = buffer.trim()
      if (message.startsWith('data: ')) {
        try {
          const chunk = JSON.parse(message.substring(6))
          if (chunk.done === true || chunk.type === 'done') {
            logger.info('流式响应完成')
          } else if (chunk.type === 'error' || chunk.error) {
            const errorMsg = chunk.data || chunk.error || '未知错误'
            throw new Error(errorMsg)
          }
        } catch (e) {
          logger.warn('解析最后的 SSE 消息失败:', message, e)
        }
      }
    }

    if (this.currentSessionId && this.sessionApi && typeof PET_CONFIG !== 'undefined' && PET_CONFIG.api && PET_CONFIG.api.syncSessionsToBackend) {
      try {
        if (this.saveCurrentSession) await this.saveCurrentSession(false, false)
        if (this.syncSessionToBackend) await this.syncSessionToBackend(this.currentSessionId, true)
        logger.info(`processStreamingResponse 完成后，会话 ${this.currentSessionId} 已保存到后端`)
      } catch (error) {
        logger.warn('processStreamingResponse 完成后保存会话失败:', error)
      }
    }

    return fullContent
  }

  // 生成宠物响应（流式版本）
  proto.generatePetResponseStream = async function (message, onContent, abortController = null, options = {}) {
    if (this.showLoadingAnimation) {
      this.showLoadingAnimation().catch(err => {
        logger.warn('显示加载动画失败:', err)
      })
    }

    try {
      const _truncateText = (v, maxLen) => {
        const s = String(v ?? '')
        const limit = Math.max(0, Number(maxLen) || 0)
        if (!limit || s.length <= limit) return s
        return `${s.slice(0, limit)}\n\n...(内容已截断)`
      }

      let includeContext = true
      const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null
      if (contextSwitch) {
        includeContext = contextSwitch.checked
      }

      let fullPageMarkdown = ''
      let contextTitle = normalizeNameSpaces(document.title || '当前页面')

      if (this.currentSessionId && this.sessions && this.sessions[this.currentSessionId]) {
        const session = this.sessions[this.currentSessionId]

        const isBlankSession = session._isBlankSession ||
                    !session.url ||
                    session.url.startsWith('blank-session://')

        if (session.pageContent && session.pageContent.trim() !== '') {
          fullPageMarkdown = session.pageContent
          contextTitle = session.title || contextTitle
        } else if (!isBlankSession) {
          if (this.getPageContentAsMarkdown) {
            fullPageMarkdown = this.getPageContentAsMarkdown()
            contextTitle = normalizeNameSpaces(document.title || '当前页面')
            session.pageContent = fullPageMarkdown
          }
          const currentTitle = session.title || ''
          if (isDefaultSessionTitle(currentTitle)) {
            session.title = ensureMdSuffix(normalizeNameSpaces(contextTitle))
          }
        } else {
          fullPageMarkdown = ''
          contextTitle = session.title || '新会话'
          logger.info('空白会话，不填充页面内容')
        }
      } else {
        if (this.getPageContentAsMarkdown) {
          fullPageMarkdown = this.getPageContentAsMarkdown()
        }
      }

      const images = Array.isArray(options?.images)
        ? options.images.filter(Boolean).slice(0, 4)
        : []
      const baseText = (() => {
        const t = String(message ?? '').trim()
        if (t) return t
        if (images.length > 0) return '用户发送了图片，请结合图片内容回答。'
        return ''
      })()
      const currentText = _truncateText(baseText, 8000)
      const pageMd = _truncateText(fullPageMarkdown, 12000)

      let userPrompt = currentText
      if (includeContext && pageMd) {
        userPrompt = `【当前页面上下文】\n页面标题：${contextTitle}\n页面内容（Markdown 格式）：\n${pageMd}\n\n【用户问题】\n${currentText}`
      }

      const apiUrl = typeof PET_CONFIG !== 'undefined' && PET_CONFIG.api && PET_CONFIG.api.yiaiBaseUrl ? PET_CONFIG.api.yiaiBaseUrl : ''

      if (typeof this.buildFromUserWithContext === 'function') {
        userPrompt = this.buildFromUserWithContext(userPrompt)
      }

      const oldPayload = this.buildPromptPayload(
        DEFAULT_SYSTEM_PROMPT,
        userPrompt,
        { images }
      )

      const payload = {
        module_name: 'services.ai.chat_service',
        method_name: 'chat',
        parameters: {
          system: oldPayload.fromSystem,
          user: oldPayload.fromUser,
          stream: true
        }
      }
      if (oldPayload.images && Array.isArray(oldPayload.images) && oldPayload.images.length > 0) {
        payload.parameters.images = oldPayload.images
      }
      const selectedModel = this.currentModel || (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || ''
      if (selectedModel) payload.parameters.model = selectedModel
      if (oldPayload.conversation_id) {
        payload.parameters.conversation_id = oldPayload.conversation_id
      }

      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.getAuthHeaders ? this.getAuthHeaders() : {})
        },
        body: JSON.stringify(payload)
      }

      if (abortController) {
        fetchOptions.signal = abortController.signal
      }

      const response = await fetch(apiUrl, fetchOptions)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let processedContent = ''

      while (true) {
        if (abortController && abortController.signal.aborted) {
          reader.cancel()
          throw new Error('请求已取消')
        }

        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        const messages = buffer.split('\n\n')
        buffer = messages.pop() || ''

        for (const message of messages) {
          if (message.startsWith('data: ')) {
            try {
              const dataStr = message.substring(6)
              const chunk = JSON.parse(dataStr)

              if (handleSseMetaChunk(this, chunk)) continue

              const text = extractSseText(chunk)
              if (text !== null && text !== undefined) {
                fullContent += text
                processedContent = this.stripThinkContent(fullContent)
                if (onContent) onContent(text, processedContent)
              } else if (chunk.done === true) {
                logger.info('流式响应完成')
              } else if (chunk.type === 'error' || chunk.error) {
                const errorMsg = chunk.data || chunk.error || '未知错误'
                logger.error('流式响应错误:', errorMsg)
                throw new Error(errorMsg)
              }
            } catch (e) {
              logger.warn('解析 SSE 消息失败:', message, e)
            }
          }
        }
      }

      if (buffer.trim()) {
        const message = buffer.trim()
        if (message.startsWith('data: ')) {
          try {
            const chunk = JSON.parse(message.substring(6))
            if (chunk.done === true || chunk.type === 'done') {
              logger.info('流式响应完成')
            } else if (chunk.type === 'error' || chunk.error) {
              const errorMsg = chunk.data || chunk.error || '未知错误'
              throw new Error(errorMsg)
            }
          } catch (e) {
            logger.warn('解析最后的 SSE 消息失败:', message, e)
          }
        }
      }

      return processedContent || this.stripThinkContent(fullContent)
    } catch (error) {
      if (error.name === 'AbortError' || error.message === '请求已取消') {
        logger.info('请求已取消')
        throw error
      }
      logger.error('API 调用失败:', error)
      throw error
    } finally {
      if (this.stopLoadingAnimation) {
        this.stopLoadingAnimation()
      }
    }
  }

  // 生成宠物响应
  proto.generatePetResponse = async function (message) {
    if (this.showLoadingAnimation) {
      this.showLoadingAnimation().catch(err => {
        logger.warn('显示加载动画失败:', err)
      })
    }

    try {
      let includeContext = true
      const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null
      if (contextSwitch) {
        includeContext = contextSwitch.checked
      }

      let fullPageMarkdown = ''
      let contextTitle = normalizeNameSpaces(document.title || '当前页面')

      if (this.currentSessionId && this.sessions && this.sessions[this.currentSessionId]) {
        const session = this.sessions[this.currentSessionId]

        const isBlankSession = session._isBlankSession ||
                    !session.url ||
                    session.url.startsWith('blank-session://')

        if (session.pageContent && session.pageContent.trim() !== '') {
          fullPageMarkdown = session.pageContent
          contextTitle = session.title || contextTitle
        } else if (!isBlankSession) {
          if (this.getPageContentAsMarkdown) {
            fullPageMarkdown = this.getPageContentAsMarkdown()
            contextTitle = normalizeNameSpaces(document.title || '当前页面')
            session.pageContent = fullPageMarkdown
          }
          const currentTitle = session.title || ''
          if (isDefaultSessionTitle(currentTitle)) {
            session.title = ensureMdSuffix(normalizeNameSpaces(contextTitle))
          }
        } else {
          fullPageMarkdown = ''
          contextTitle = session.title || '新会话'
          logger.info('空白会话，不填充页面内容')
        }
      } else {
        if (this.getPageContentAsMarkdown) {
          fullPageMarkdown = this.getPageContentAsMarkdown()
        }
      }

      let userPrompt = message
      if (includeContext && fullPageMarkdown) {
        userPrompt = `【当前页面上下文】\n页面标题：${contextTitle}\n页面内容（Markdown 格式）：\n${fullPageMarkdown}\n\n【用户问题】\n${message}`
      }

      const oldPayload = this.buildPromptPayload(
        DEFAULT_SYSTEM_PROMPT,
        userPrompt
      )

      const payload = {
        module_name: 'services.ai.chat_service',
        method_name: 'chat',
        parameters: {
          system: oldPayload.fromSystem,
          user: oldPayload.fromUser,
          stream: false
        }
      }
      if (oldPayload.images && Array.isArray(oldPayload.images) && oldPayload.images.length > 0) {
        payload.parameters.images = oldPayload.images
      }
      const selectedModel = this.currentModel || (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || ''
      if (selectedModel) payload.parameters.model = selectedModel
      if (oldPayload.conversation_id) {
        payload.parameters.conversation_id = oldPayload.conversation_id
      }

      if (this._showLoadingAnimation) this._showLoadingAnimation()

      const apiUrl = typeof PET_CONFIG !== 'undefined' && PET_CONFIG.api && PET_CONFIG.api.yiaiBaseUrl ? PET_CONFIG.api.yiaiBaseUrl : ''
      let response, result
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.getAuthHeaders ? this.getAuthHeaders() : {})
          },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        result = await response.json()
        if (!result || typeof result !== 'object') {
          throw new Error('响应格式错误')
        }
        if (result.code !== 0) {
          throw new Error(result.message || `请求失败 (code=${result.code})`)
        }

        if (this._hideLoadingAnimation) this._hideLoadingAnimation()
      } catch (error) {
        if (this._hideLoadingAnimation) this._hideLoadingAnimation()
        throw error
      }

      const data = result.data || {}
      if (data.conversation_id && !this.currentSessionId) {
        this.currentSessionId = data.conversation_id
      }

      let responseContent = typeof data.message === 'string' ? data.message : ''

      responseContent = this.stripThinkContent(responseContent)

      if (this.currentSessionId && this.sessionApi && typeof PET_CONFIG !== 'undefined' && PET_CONFIG.api && PET_CONFIG.api.syncSessionsToBackend) {
        try {
          if (this.saveCurrentSession) await this.saveCurrentSession(false, false)
          if (this.syncSessionToBackend) await this.syncSessionToBackend(this.currentSessionId, true)
          logger.info(`非流式 prompt 接口调用后，会话 ${this.currentSessionId} 已保存到后端`)
        } catch (error) {
          logger.warn('非流式 prompt 接口调用后保存会话失败:', error)
        }
      }

      return responseContent
    } catch (error) {
      logger.error('API 调用失败:', error)
      return '抱歉，我现在无法连接到服务器，请稍后重试 😔'
    } finally {
      if (this.stopLoadingAnimation) {
        this.stopLoadingAnimation()
      }
    }
  }

  // 获取随机响应
  proto.getRandomResponse = function (responses) {
    return responses[Math.floor(Math.random() * responses.length)]
  }

  // 通用的流式生成函数，支持动态 systemPrompt 和 userPrompt
  proto.generateContentStream = async function (systemPrompt, userPrompt, onContent, loadingText = '正在处理...') {
    try {
      logger.debug('调用大模型生成内容，systemPrompt 长度:', systemPrompt ? systemPrompt.length : 0)

      const oldPayload = this.buildPromptPayload(
        systemPrompt,
        userPrompt
      )

      const payload = {
        module_name: 'services.ai.chat_service',
        method_name: 'chat',
        parameters: {
          system: oldPayload.fromSystem,
          user: oldPayload.fromUser,
          stream: true
        }
      }
      if (oldPayload.images && Array.isArray(oldPayload.images) && oldPayload.images.length > 0) {
        payload.parameters.images = oldPayload.images
      }
      const selectedModel = this.currentModel || (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || ''
      if (selectedModel) payload.parameters.model = selectedModel
      if (oldPayload.conversation_id) {
        payload.parameters.conversation_id = oldPayload.conversation_id
      }

      const apiUrl = typeof PET_CONFIG !== 'undefined' && PET_CONFIG.api && PET_CONFIG.api.yiaiBaseUrl ? PET_CONFIG.api.yiaiBaseUrl : ''
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.getAuthHeaders ? this.getAuthHeaders() : {})
        },
        body: JSON.stringify(payload)
      })

      return await this.processStreamingResponse(response, onContent)
    } catch (error) {
      logger.error('生成内容失败:', error)
      throw error
    }
  }

  // 清理和优化文本
  proto._cleanAndOptimizeText = function (text) {
    if (!text || typeof text !== 'string') return ''
    let cleaned = String(text)
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    const placeholders = []
    const protect = (regex) => {
      cleaned = cleaned.replace(regex, (match) => {
        const placeholder = `__PET_PROTECTED_${placeholders.length}__`
        placeholders.push(match)
        return placeholder
      })
    }

    protect(/```[\s\S]*?```/g)
    protect(/`[^`\n]+`/g)

    protect(/<img\b[^>]*>/gi)
    protect(/<iframe\b[\s\S]*?<\/iframe>/gi)
    protect(/<video\b[\s\S]*?<\/video>/gi)
    protect(/<audio\b[\s\S]*?<\/audio>/gi)
    protect(/<embed\b[^>]*>/gi)
    protect(/<object\b[\s\S]*?<\/object>/gi)
    protect(/<source\b[^>]*>/gi)
    protect(/<a\b[\s\S]*?<\/a>/gi)
    protect(/<table\b[\s\S]*?<\/table>/gi)
    protect(/<pre\b[\s\S]*?<\/pre>/gi)
    protect(/<code\b[\s\S]*?<\/code>/gi)

    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n')
    cleaned = cleaned.replace(/<\/?[a-z][a-z0-9-]*(?:\s[^<>]*?)?\/?>/g, '')

    cleaned = cleaned.replace(/&nbsp;/gi, ' ')
    cleaned = cleaned.replace(/&lt;/gi, '<')
    cleaned = cleaned.replace(/&gt;/gi, '>')
    cleaned = cleaned.replace(/&amp;/gi, '&')
    cleaned = cleaned.replace(/&quot;/gi, '"')
    cleaned = cleaned.replace(/&#39;/g, "'")
    cleaned = cleaned.replace(/&#(\d+);/g, (m, dec) => {
      const codePoint = Number(dec)
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return m
      try {
        return String.fromCodePoint(codePoint)
      } catch (_) {
        return m
      }
    })
    cleaned = cleaned.replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => {
      const codePoint = Number.parseInt(hex, 16)
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return m
      try {
        return String.fromCodePoint(codePoint)
      } catch (_) {
        return m
      }
    })

    cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n')
    cleaned = cleaned.replace(/^#{7,}\s+/gm, '')

    placeholders.forEach((value, index) => {
      cleaned = cleaned.replaceAll(`__PET_PROTECTED_${index}__`, value)
    })

    cleaned = cleaned.trim()
    return cleaned
  }

  proto._formatMarkdownLossless = function (text) {
    if (text == null) return ''
    let formatted = String(text)
    formatted = formatted.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    formatted = formatted.replace(/ /g, ' ')

    const placeholders = []
    const protect = (regex) => {
      formatted = formatted.replace(regex, (match) => {
        const placeholder = `__PET_FORMAT_PROTECTED_${placeholders.length}__`
        placeholders.push(match)
        return placeholder
      })
    }

    protect(/```[\s\S]*?```/g)
    protect(/`[^`\n]+`/g)
    protect(/<(iframe|video|audio|table|pre|code|object)\b[\s\S]*?<\/\1>/gi)
    protect(/<(img|embed|source)\b[^>]*>/gi)

    formatted = formatted.replace(/^\s+#{1,6}\s+/gm, (m) => m.trimStart())
    formatted = formatted.replace(/[ \t]+\n/g, '\n')
    formatted = formatted.replace(/\n{3,}/g, '\n\n')
    formatted = formatted.replace(/([^\n])((?:Ctrl\+\w+|Shift\+Tab|Tab|Enter|Esc)(?:\s*[:：])?)/g, '$1\n$2')
    formatted = formatted.replace(/([。！？.!?])\s*(\d{1,2}\.\s)/g, '$1\n\n$2')
    formatted = formatted.replace(/([：:])\s*(!\s+)/g, '$1\n\n$2')
    formatted = formatted.replace(/(!\s+[^\n!]+)\s*(?=!\s+)/g, '$1\n')
    formatted = formatted.replace(/^(#{1,6} .+)\n(?!\n)/gm, '$1\n\n')
    formatted = formatted.replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2')
    formatted = formatted.replace(/([^\n])\n(\d{1,2}\.\s)/g, '$1\n\n$2')
    formatted = formatted.replace(/^(\s*来源:\s*`https?:\/\/[^\s)`]+`\s*)$/gm, '> $1')

    formatted = formatted.replace(/(你的命令：)\s*(!\s*[\s\S]*?)(?=(这会立即执行|没有模型处理延迟|不消耗 Token|一天用上|$))/g, (m, lead, cmds, stop) => {
      const normalizedCmds = String(cmds).replace(/(\S)(!\s+)/g, '$1\n$2')
      return `${lead}\n\n\`\`\`bash\n${normalizedCmds.trim()}\n\`\`\`\n${stop || ''}`
    })

    placeholders.forEach((value, index) => {
      formatted = formatted.replaceAll(`__PET_FORMAT_PROTECTED_${index}__`, value)
    })

    return formatted
  }
})()
