/**
 * AI 提示词管理模块
 * 负责角色配置、系统提示词、UI 交互
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

  proto.showSettingsModal = function () {
    if (!this.chatWindow) return
    this.ensureAiSettingsUi()
    const overlay = this.chatWindow.querySelector('#pet-ai-settings')
    if (!overlay) return
    const store = overlay._store
    if (!store) return

    const models = (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.chatModels && Array.isArray(PET_CONFIG.chatModels.models)) ? PET_CONFIG.chatModels.models : []
    store.models = models
    store.selectedModel = this.currentModel || (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || ''
    if (typeof this.lockSidebarToggle === 'function') {
      this.lockSidebarToggle('ai-settings')
    }
  }

  proto.ensureAiSettingsUi = function () {
    if (!this.chatWindow) return
    const existing = this.chatWindow.querySelector('#pet-ai-settings')
    if (existing) return

    const Vue = window.Vue || {}
    const { createApp, reactive } = Vue
    if (typeof createApp !== 'function' || typeof reactive !== 'function') return

    const canUseTemplate = (() => {
      if (typeof Vue?.compile !== 'function') return false
      try {
        Function('return 1')()
        return true
      } catch (_) {
        return false
      }
    })()

    const overlay = document.createElement('div')
    overlay.id = 'pet-ai-settings'
    try {
      if (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.ui && PET_CONFIG.ui.zIndex && PET_CONFIG.ui.zIndex.modal) {
        overlay.style.setProperty('z-index', `${PET_CONFIG.ui.zIndex.modal}`, 'important')
      }
    } catch (_) {}

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeAiSettingsModal()
      }
    })

    const store = reactive({
      selectedModel: '',
      models: []
    })
    overlay._store = store

    overlay._mountPromise = (async () => {
      try {
        const mod = window.PetManager?.Components?.AiSettingsModal
        if (!mod || typeof mod.createComponent !== 'function') return
        const template = canUseTemplate && typeof mod.loadTemplate === 'function' ? await mod.loadTemplate() : ''
        const ctor = mod.createComponent({ manager: this, store, template })
        if (!ctor) return
        overlay._vueApp = createApp(ctor)
        overlay._vueInstance = overlay._vueApp.mount(overlay)
      } catch (_) {}
    })()

    this.chatWindow.appendChild(overlay)
  }

  proto.closeAiSettingsModal = function () {
    if (!this.chatWindow) return
    const overlay = this.chatWindow.querySelector('#pet-ai-settings')
    if (!overlay) return

    try {
      if (overlay._vueApp) overlay._vueApp.unmount()
    } catch (_) {}

    try {
      overlay.remove()
    } catch (_) {}
    if (typeof this.unlockSidebarToggle === 'function') {
      this.unlockSidebarToggle('ai-settings')
    }
  }

  proto._aiFormatMarkdownPreserveContent = async function (text, model) {
    const originalText = String(text || '')
    if (!originalText.trim()) return originalText

    const systemPrompt = `你是一个"高级 Markdown 排版设计师"。
你的任务是：对用户给定的内容进行"模块识别 + Markdown 排版优化"，识别并优化：主标题、副标题/元信息、章节标题、小节/条目、正文段落、代码块/命令块、引用块。
目标：明显提升阅读体验（更有层次、更干净、更像排版精良的文章），同时 100% 保留原文内容。

硬性约束（必须遵守）：
1. 绝对不允许删除任何信息：原文中每一个非空白字符都必须保留（允许调整空格/换行/缩进）
2. 绝对不允许改写/替换任何词句/标点/数字/链接 URL（只能在原文外"添加"Markdown结构符号或空白）
3. 不总结、不提炼、不下结论，不新增原文没有的新信息
4. 原文中出现的链接、图片、媒体标签必须原样保留（URL 不能改写、不能置空）
5. 不改变信息顺序：只允许把原文按原顺序包裹到更好的 Markdown 结构中
6. 所有标题文字必须来自原文某一整行：只能添加 #/##/### 前缀，不能发明标题文字
7. 只输出 Markdown 正文，不要解释、不要额外前后缀`

    const userPrompt = `请对以下内容做"Markdown 二次排版美化 + 模块识别"，目标是明显提升阅读体验（更有层次、更干净、更像高质量文章排版）：

【模块识别与排版规则（按优先级）】
1. 主标题：把最像文章标题的一行（通常是最开头的第一行）变成一级标题：在行首添加 "# "（不改标题文字）
2. 副标题/元信息：把"来源/作者/Original/时间/提示/公众号名/日期"等元信息区域用引用块 > 包裹；必要时可对标签加粗（如 **来源**），但不能改字
3. 章节标题：把"第一部分/第二部分/第X章/结语/参考资料"等变成二级标题（##）
4. 小节/条目：把类似"1. /init —..." "2. ..."这类"编号 + 短标题"识别成小节标题（建议 ###），并保证条目之间有空行
5. 正文段落：把长段落拆成更易读的段落（仅调整换行/空行，不改字）
6. 代码/命令块：识别命令/CLI片段/代码片段（如以 "!", "$", "claude ", "git " 开头的命令，或多条命令连在一起一行），用 fenced code block 包裹：
   - Shell 命令优先用 \`\`\`bash
   - 其他用 \`\`\`
   要求：命令内容逐字保留，只允许把连在一起的多条命令拆成多行
7. 视觉节奏：标题与正文之间留空行；大块之间可用 --- 分隔（可添加）
8. 重点突出：对命令、快捷键、参数、文件路径等，优先用行内代码 \`...\` 包裹（只加反引号，不改内容）

【严格禁止】
- 不允许删除任何信息
- 不允许替换任何非空白字符（包括引号/标点/大小写/URL），只能添加 Markdown 结构符号与空白
- 不允许改变信息顺序

原始内容：
${originalText}

请直接返回美化后的 Markdown 内容。`

    const oldPayload = this.buildPromptPayload(systemPrompt, userPrompt)
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
    const selectedModel = model || this.currentModel || (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || ''
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
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (!result || typeof result !== 'object') {
      throw new Error('响应格式错误')
    }
    if (result.code !== 0) {
      throw new Error(result.message || `请求失败 (code=${result.code})`)
    }

    const data = result.data || {}
    let improved =
              (typeof data.message === 'string' ? data.message : '') ||
              (typeof data.content === 'string' ? data.content : '') ||
              (typeof result.content === 'string' ? result.content : '')

    improved = this.stripThinkContent ? this.stripThinkContent(improved) : improved
    improved = String(improved || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

    const quotePairs = [
      ['"', '"'],
      ['"', '"'],
      ['"', '"'],
      ["'", "'"],
      ['`', '`'],
      ['「', '」'],
      ['『', '』']
    ]
    for (const [startQuote, endQuote] of quotePairs) {
      if (improved.startsWith(startQuote) && improved.endsWith(endQuote)) {
        improved = improved.slice(startQuote.length, -endQuote.length).trim()
      }
    }
    return improved
  }

  proto.optimizeContext = async function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (!textarea) return

    const rawText = textarea.value || ''
    const originalText = String(rawText || '')
    if (!originalText.trim()) {
      if (this.showNotification) this.showNotification('请先输入内容', 'warning')
      return
    }

    const optimizeBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-optimize-btn') : null
    const originalBtnText = optimizeBtn ? optimizeBtn.textContent : ''

    if (optimizeBtn) {
      optimizeBtn.disabled = true
      optimizeBtn.setAttribute('data-optimizing', 'true')
      optimizeBtn.textContent = '⏳'
    }

    try {
      if (this._showLoadingAnimation) this._showLoadingAnimation()

      const formattedText = this._formatMarkdownLossless ? this._formatMarkdownLossless(originalText) : originalText
      const normalizeForCompare = (value) => String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/ /g, ' ')
        .replace(/\s+/g, '')
      const isSubsequence = (needle, haystack) => {
        let i = 0
        for (let j = 0; j < haystack.length && i < needle.length; j++) {
          if (needle[i] === haystack[j]) i++
        }
        return i === needle.length
      }
      const extractUrls = (text) => (String(text || '').match(/https?:\/\/[^\s)\]>"]+/g) || [])
      const originalUrls = extractUrls(originalText)

      const originalNorm = normalizeForCompare(originalText)
      const formattedNorm = normalizeForCompare(formattedText)
      if (!isSubsequence(originalNorm, formattedNorm)) {
        throw new Error('检测到格式化结果可能丢失或改写原文，已取消替换')
      }
      const formattedUrls = extractUrls(formattedText)
      if (formattedUrls.length < originalUrls.length) {
        throw new Error('检测到格式化结果可能丢失链接，已取消替换')
      }

      let finalText = formattedText
      try {
        const aiImprovedText = await this._aiFormatMarkdownPreserveContent(formattedText)
        if (aiImprovedText && aiImprovedText.trim()) {
          const aiNorm = normalizeForCompare(aiImprovedText)
          if (!isSubsequence(originalNorm, aiNorm)) {
            throw new Error('AI 二次排版可能丢失或改写原文')
          }
          const aiUrls = extractUrls(aiImprovedText)
          if (aiUrls.length < originalUrls.length) {
            throw new Error('AI 二次排版可能丢失链接')
          }
          finalText = aiImprovedText
        }
      } catch (e) {
        logger.warn('AI 二次排版失败，已回退到本地格式化:', e)
      }

      if (finalText === originalText) {
        if (this.showNotification) this.showNotification('格式化后的内容与原文相同', 'info')
      }

      textarea.value = finalText
      textarea.setAttribute('data-optimized-text', finalText)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))

      const charCount = finalText.length
      const originalCharCount = originalText.length
      const changeInfo = charCount !== originalCharCount
        ? `（${originalCharCount}字 → ${charCount}字）`
        : `（${charCount}字）`
      if (this.showNotification) this.showNotification(`格式化完成 ${changeInfo}`, 'success')

      if (optimizeBtn) {
        optimizeBtn.setAttribute('data-status', 'success')
        setTimeout(() => {
          try {
            optimizeBtn.removeAttribute('data-status')
          } catch (_) {}
        }, 1600)
      }
    } catch (error) {
      logger.error('格式化上下文失败:', error)

      let errorMessage = '格式化失败，请稍后重试'
      if (error.message) {
        errorMessage = error.message
      }

      if (this.showNotification) this.showNotification(errorMessage, 'error')

      if (optimizeBtn) {
        optimizeBtn.setAttribute('data-status', 'error')
        setTimeout(() => {
          try {
            optimizeBtn.removeAttribute('data-status')
          } catch (_) {}
        }, 2000)
      }
    } finally {
      if (this._hideLoadingAnimation) this._hideLoadingAnimation()
      if (optimizeBtn) {
        optimizeBtn.disabled = false
        optimizeBtn.removeAttribute('data-optimizing')
        optimizeBtn.textContent = originalBtnText
      }
    }
  }

  proto.optimizeMessageEditorContent = async function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor-textarea') : null
    if (!textarea) return

    const rawText = textarea.value || ''
    const originalText = rawText.trim()
    if (!originalText) {
      if (this.showNotification) this.showNotification('请先输入内容', 'warning')
      return
    }

    const optimizeBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-message-optimize-btn') : null
    const originalBtnText = optimizeBtn ? optimizeBtn.textContent : ''

    if (optimizeBtn) {
      optimizeBtn.disabled = true
      optimizeBtn.setAttribute('data-optimizing', 'true')
      optimizeBtn.textContent = '⏳'
    }

    try {
      const systemPrompt = `你是一个专业的"消息内容清理与排版"助手。
你的任务不是总结或改写，而是：在不新增信息、不遗漏关键信息的前提下，把消息内容清理干净并排版成更易读的 Markdown。

必须遵守：
1. 不总结、不提炼、不下结论，不添加原文没有的新信息
2. 保持原文的语气与信息顺序，只做清理与格式化
3. 保持代码块、表格、列表、链接文字等结构；必要时仅做轻量的结构化（如把连续短句整理成列表）
4. 输出必须是有效的 Markdown，且只输出 Markdown 正文，不要任何说明`

      const userPrompt = `请智能优化以下消息内容，要求：

【核心要求】
1. 必须保留原文的核心信息与完整内容，不能丢失重要信息
2. 不要总结/提炼/改写成"摘要"
3. 智能格式化（不新增信息）：修正标题层级、段落切分、列表化、表格排版、代码块保持不变，使阅读更顺畅
4. 保持 Markdown 格式有效：不要输出 HTML 标签；不要在内容前后加引号或说明文字

原始内容：
${originalText}

请直接返回优化后的Markdown内容，不要包含任何说明文字、引号或其他格式标记。`

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
      const response = await fetch(apiUrl, {
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

      const result = await response.json()
      if (!result || typeof result !== 'object') {
        throw new Error('响应格式错误')
      }
      if (result.code !== 0) {
        throw new Error(result.message || `请求失败 (code=${result.code})`)
      }

      if (this._hideLoadingAnimation) this._hideLoadingAnimation()

      const data = result.data || {}
      let optimizedText =
                (typeof data.message === 'string' ? data.message : '') ||
                (typeof data.content === 'string' ? data.content : '') ||
                (typeof result.content === 'string' ? result.content : '')

      optimizedText = this.stripThinkContent ? this.stripThinkContent(optimizedText) : optimizedText
      optimizedText = optimizedText.trim()

      const quotePairs = [
        ['"', '"'],
        ['"', '"'],
        ['"', '"'],
        ["'", "'"],
        ['`', '`'],
        ['「', '」'],
        ['『', '』']
      ]

      for (const [startQuote, endQuote] of quotePairs) {
        if (optimizedText.startsWith(startQuote) && optimizedText.endsWith(endQuote)) {
          optimizedText = optimizedText.slice(startQuote.length, -endQuote.length).trim()
        }
      }

      const prefixes = [
        /^优化后的消息：?\s*/i,
        /^以下是优化后的消息：?\s*/i,
        /^优化结果：?\s*/i,
        /^优化后的文本：?\s*/i
      ]

      for (const prefix of prefixes) {
        optimizedText = optimizedText.replace(prefix, '').trim()
      }

      optimizedText = this._cleanAndOptimizeText ? this._cleanAndOptimizeText(optimizedText) : optimizedText

      if (!optimizedText || optimizedText.length < 5) {
        throw new Error('优化后的文本过短，可能优化失败，请重试')
      }

      if (optimizedText === originalText) {
        if (this.showNotification) this.showNotification('优化后的内容与原文相同', 'info')
      }

      textarea.value = optimizedText
      textarea.setAttribute('data-optimized-text', optimizedText)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))

      const charCount = optimizedText.length
      const originalCharCount = originalText.length
      const changeInfo = charCount !== originalCharCount
        ? `（${originalCharCount}字 → ${charCount}字）`
        : `（${charCount}字）`
      if (this.showNotification) this.showNotification(`优化完成 ${changeInfo}`, 'success')

      if (optimizeBtn) {
        optimizeBtn.setAttribute('data-status', 'success')
        setTimeout(() => {
          try {
            optimizeBtn.removeAttribute('data-status')
          } catch (_) {}
        }, 1600)
      }
    } catch (error) {
      if (this._hideLoadingAnimation) this._hideLoadingAnimation()
      logger.error('优化消息失败:', error)

      let errorMessage = '优化失败，请稍后重试'
      if (error.message) {
        if (error.message.includes('HTTP error')) {
          errorMessage = '网络请求失败，请检查网络连接'
        } else if (error.message.includes('无法解析')) {
          errorMessage = '服务器响应格式异常，请稍后重试'
        } else if (error.message.includes('过短')) {
          errorMessage = error.message
        } else {
          errorMessage = error.message
        }
      }

      if (this.showNotification) this.showNotification(errorMessage, 'error')

      if (optimizeBtn) {
        optimizeBtn.setAttribute('data-status', 'error')
        setTimeout(() => {
          try {
            optimizeBtn.removeAttribute('data-status')
          } catch (_) {}
        }, 2000)
      }
    } finally {
      if (optimizeBtn) {
        optimizeBtn.disabled = false
        optimizeBtn.removeAttribute('data-optimizing')
        optimizeBtn.textContent = originalBtnText
      }
    }
  }

  proto.translateContext = async function (targetLang) {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (!textarea) return

    const rawText = textarea.value || ''
    const originalText = rawText.trim()
    if (!originalText) {
      if (this.showNotification) this.showNotification('请先输入内容', 'warning')
      return
    }

    const translateZhBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-translate-zh-btn') : null
    const translateEnBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-translate-en-btn') : null

    if (translateZhBtn) {
      translateZhBtn.disabled = true
      translateZhBtn.setAttribute('data-translating', 'true')
      if (targetLang === 'zh') {
        translateZhBtn.textContent = '⏳'
      }
    }
    if (translateEnBtn) {
      translateEnBtn.disabled = true
      translateEnBtn.setAttribute('data-translating', 'true')
      if (targetLang === 'en') {
        translateEnBtn.textContent = '⏳'
      }
    }

    try {
      const targetLanguage = targetLang === 'zh' ? '中文' : '英文'
      const systemPrompt = `你是一个专业的翻译专家，擅长将各种语言的内容准确、流畅地翻译成${targetLanguage}。请保持原文的格式、结构和语义，确保翻译准确、自然、流畅。`

      const userPrompt = `请将以下内容翻译成${targetLanguage}，要求：
1. 保持原文的格式和结构（包括Markdown格式）
2. 翻译准确、自然、流畅
3. 保持专业术语的准确性
4. 不要添加任何说明文字、引号或其他格式标记
5. 直接返回翻译后的内容

原文内容：
${originalText}

请直接返回翻译后的${targetLanguage}内容，不要包含任何说明文字、引号或其他格式标记。`

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
      const response = await fetch(apiUrl, {
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

      const result = await response.json()
      if (!result || typeof result !== 'object') {
        throw new Error('响应格式错误')
      }
      if (result.code !== 0) {
        throw new Error(result.message || `请求失败 (code=${result.code})`)
      }

      if (this._hideLoadingAnimation) this._hideLoadingAnimation()

      const data = result.data || {}
      let translatedText =
                (typeof data.message === 'string' ? data.message : '') ||
                (typeof data.content === 'string' ? data.content : '') ||
                (typeof result.content === 'string' ? result.content : '')

      translatedText = this.stripThinkContent ? this.stripThinkContent(translatedText) : translatedText
      translatedText = translatedText.trim()

      const quotePairs = [
        ['"', '"'],
        ['"', '"'],
        ['"', '"'],
        ["'", "'"],
        ['`', '`'],
        ['「', '」'],
        ['『', '』']
      ]

      for (const [startQuote, endQuote] of quotePairs) {
        if (translatedText.startsWith(startQuote) && translatedText.endsWith(endQuote)) {
          translatedText = translatedText.slice(startQuote.length, -endQuote.length).trim()
        }
      }

      const prefixes = [
        /^翻译后的[内容上下文]：?\s*/i,
        /^以下是翻译后的[内容上下文]：?\s*/i,
        /^翻译结果：?\s*/i,
        /^翻译后的文本：?\s*/i,
        /^翻译后的[内容上下文]如下：?\s*/i,
        /^[内容上下文]翻译如下：?\s*/i,
        /^以下是翻译成[中文英文]的[内容上下文]：?\s*/i
      ]

      for (const prefix of prefixes) {
        translatedText = translatedText.replace(prefix, '').trim()
      }

      translatedText = translatedText.replace(/\n{4,}/g, '\n\n\n')
      translatedText = translatedText.replace(/[ \t]+/g, ' ')
      translatedText = translatedText.trim()

      if (!translatedText || translatedText.length < 10) {
        throw new Error('翻译后的文本过短，可能翻译失败，请重试')
      }

      if (translatedText === originalText) {
        if (this.showNotification) this.showNotification('翻译后的内容与原文相同，可能已经是目标语言', 'info')
      }

      textarea.value = translatedText
      textarea.setAttribute('data-translated-text', translatedText)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))

      const charCount = translatedText.length
      const originalCharCount = originalText.length
      const changeInfo = charCount !== originalCharCount
        ? `（${originalCharCount}字 → ${charCount}字）`
        : `（${charCount}字）`
      if (this.showNotification) this.showNotification(`翻译完成 ${changeInfo}`, 'success')
    } catch (error) {
      if (this._hideLoadingAnimation) this._hideLoadingAnimation()
      logger.error('翻译上下文失败:', error)

      let errorMessage = '翻译失败，请稍后重试'
      if (error.message) {
        if (error.message.includes('HTTP error')) {
          errorMessage = '网络请求失败，请检查网络连接'
        } else if (error.message.includes('无法解析')) {
          errorMessage = '服务器响应格式异常，请稍后重试'
        } else if (error.message.includes('过短')) {
          errorMessage = error.message
        } else {
          errorMessage = error.message
        }
      }

      if (this.showNotification) this.showNotification(errorMessage, 'error')
    } finally {
      if (translateZhBtn) {
        translateZhBtn.disabled = false
        translateZhBtn.removeAttribute('data-translating')
        translateZhBtn.textContent = '🇨🇳'
      }
      if (translateEnBtn) {
        translateEnBtn.disabled = false
        translateEnBtn.removeAttribute('data-translating')
        translateEnBtn.textContent = '🇺🇸'
      }
    }
  }

  proto.buildConversationContext = function () {
    const context = {
      messages: [],
      pageContent: '',
      hasHistory: false
    }

    if (this.currentSessionId && this.sessions && this.sessions[this.currentSessionId]) {
      const session = this.sessions[this.currentSessionId]

      if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
        context.messages = session.messages.filter(msg => {
          return msg.type === 'user' || msg.type === 'pet'
        })
        context.hasHistory = context.messages.length > 0
      }

      if (session.pageContent && session.pageContent.trim()) {
        context.pageContent = session.pageContent.trim()
      }
    }

    return context
  }

  proto.buildFromUserWithContext = function (baseUserPrompt, roleLabel) {
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

    const context = this.buildConversationContext()
    const pageContent = _truncateText(context.pageContent, 12000)

    let finalBasePrompt = baseUserPrompt
    if (baseUserPrompt.includes('页面内容（Markdown 格式）：')) {
      if (includeContext && context.pageContent) {
        const pageContentMatch = baseUserPrompt.match(/页面内容（Markdown 格式）：\s*\n([\s\S]*?)(?=\n\n|$)/)
        if (pageContentMatch) {
          finalBasePrompt = baseUserPrompt.replace(
            /页面内容（Markdown 格式）：\s*\n[\s\S]*?(?=\n\n|$)/,
                      `页面内容（Markdown 格式）：\n${pageContent}`
          )
        }
      } else if (!includeContext) {
        finalBasePrompt = baseUserPrompt.replace(
          /页面内容（Markdown 格式）：\s*\n[\s\S]*?(?=\n\n|$)/,
          '页面内容（Markdown 格式）：\n无内容（页面上下文已关闭）'
        )
      }
    }

    if (!context.hasHistory) {
      if (includeContext && pageContent && !finalBasePrompt.includes('页面内容（Markdown 格式）：')) {
        const pageContext = '\n\n## 页面内容：\n\n' + pageContent
        return finalBasePrompt + pageContext
      }
      return finalBasePrompt
    }

    let conversationContext = ''
    if (context.messages.length > 0) {
      conversationContext = '\n\n## 会话历史：\n\n'
      context.messages.slice(-30).forEach((msg, index) => {
        const role = msg.type === 'user' ? '用户' : '助手'
        const contentText = _truncateText(String(msg?.content || '').trim(), 12000)
        const imageList = Array.isArray(msg?.imageDataUrls)
          ? msg.imageDataUrls
          : (typeof msg?.imageDataUrl === 'string' && msg.imageDataUrl.trim() ? [msg.imageDataUrl.trim()] : [])
        const content = (() => {
          if (contentText) return contentText
          if (imageList.length > 0) return imageList.length === 1 ? '[图片]' : `[图片 x${imageList.length}]`
          return ''
        })()
        if (!content) return
        conversationContext += `${role}：${content}\n\n`
      })
    }

    let pageContext = ''
    if (includeContext && pageContent && !finalBasePrompt.includes('页面内容（Markdown 格式）：')) {
      pageContext = '\n\n## 页面内容：\n\n' + pageContent
    }

    return finalBasePrompt + conversationContext + pageContext
  }
})()
