(function (global) {
  const proto = global.PetManager.prototype

  // 获取角色图标（优先自定义，其次从角色配置列表中查找）
  proto.getRoleIcon = function (roleConfig, allConfigs = null) {
    if (!roleConfig) return '🙂'

    // 优先使用配置中的自定义图标
    if (roleConfig.icon && typeof roleConfig.icon === 'string') {
      const icon = roleConfig.icon.trim()
      if (icon) return icon
    }

    // 如果没有自定义图标，从角色配置列表中查找
    const actionKey = roleConfig.actionKey
    if (actionKey && allConfigs && Array.isArray(allConfigs)) {
      const foundConfig = allConfigs.find(c => c && c.actionKey === actionKey)
      if (foundConfig && foundConfig.icon && typeof foundConfig.icon === 'string') {
        const icon = foundConfig.icon.trim()
        if (icon) return icon
      }
    }

    // 如果还是找不到，使用默认映射
    const defaultIcons = {
      summary: '📝',
      mindmap: '🧠',
      flashcard: '🎴',
      report: '📊',
      bestPractice: '💡'
    }
    if (actionKey && defaultIcons[actionKey]) {
      return defaultIcons[actionKey]
    }

    return '🙂'
  }

  // 统一获取角色标签/名称（优先自定义，其次从角色配置列表中查找）
  proto.getRoleLabel = function (roleConfig, allConfigs = null) {
    if (!roleConfig) return '自定义角色'

    // 优先使用配置中的自定义标签
    if (roleConfig.label && typeof roleConfig.label === 'string') {
      const label = roleConfig.label.trim()
      if (label) return label
    }

    // 如果没有自定义标签，从角色配置列表中查找
    const actionKey = roleConfig.actionKey
    if (actionKey && allConfigs && Array.isArray(allConfigs)) {
      const foundConfig = allConfigs.find(c => c && c.actionKey === actionKey)
      if (foundConfig && foundConfig.label && typeof foundConfig.label === 'string') {
        const label = foundConfig.label.trim()
        if (label) return label
      }
    }

    // 如果还是找不到，使用actionKey作为默认标签
    if (actionKey) {
      return actionKey
    }

    return '自定义角色'
  }

  // 统一获取角色提示语（用于按钮的 title 属性，支持自定义）
  proto.getRoleTooltip = function (roleConfig) {
    // 优先使用配置中的自定义提示语
    if (roleConfig && roleConfig.tooltip && typeof roleConfig.tooltip === 'string') {
      const tooltip = roleConfig.tooltip.trim()
      if (tooltip) return tooltip
    }

    // 如果没有自定义提示语，使用标签作为提示语
    return this.getRoleLabel(roleConfig)
  }

  // 统一获取角色完整信息（图标、标签、提示语等）
  proto.getRoleInfoForAction = async function (actionKey) {
    try {
      const configs = await this.getRoleConfigs()
      const cfg = Array.isArray(configs) ? configs.find(c => c && c.actionKey === actionKey) : null

      return {
        icon: this.getRoleIcon(cfg || { actionKey }, configs),
        label: this.getRoleLabel(cfg || { actionKey }, configs),
        tooltip: this.getRoleTooltip(cfg || { actionKey }),
        config: cfg
      }
    } catch (error) {
      console.error('获取角色信息失败:', error)
      // 降级处理
      const fallbackConfig = { actionKey }
      return {
        icon: this.getRoleIcon(fallbackConfig, null),
        label: this.getRoleLabel(fallbackConfig, null),
        tooltip: this.getRoleTooltip(fallbackConfig),
        config: null
      }
    }
  }

  // 根据 actionKey 从角色配置中获取提示语（必须从角色配置中获取 prompt）
  proto.getRolePromptForAction = async function (actionKey, pageInfo) {
    // 获取角色信息（图标、标签等）
    const roleInfo = await this.getRoleInfoForAction(actionKey)
    const cfg = roleInfo.config

    // 检查角色配置中是否有 prompt
    if (!cfg || !cfg.prompt || !cfg.prompt.trim()) {
      throw new Error(`角色 ${actionKey} 未配置 prompt，请在角色设置中配置提示词`)
    }

    const title = pageInfo.title || document.title || '当前页面'
    const pageUrl = pageInfo.url || window.location.href
    const pageDescription = pageInfo.description || ''
    const pageContent = pageInfo.content || ''

    // 构建 userPrompt
    const userPrompt = `页面标题：${title}
页面URL：${pageUrl}
${pageDescription ? `页面描述：${pageDescription}` : ''}

页面内容（Markdown 格式）：
${pageContent || '无内容'}

请根据以上信息进行分析和处理。`

    return {
      systemPrompt: cfg.prompt.trim(),
      userPrompt,
      label: roleInfo.label,
      icon: roleInfo.icon
    }
  }

  // 将角色设置应用到欢迎消息下方的动作按钮（根据 actionKey 动态更新图标、标题和提示语）
  proto.applyRoleConfigToActionIcon = async function (iconEl, actionKey) {
    try {
      if (!iconEl || !actionKey) return

      // 使用统一的角色信息获取函数
      const roleInfo = await this.getRoleInfoForAction(actionKey)

      // 更新按钮的图标、标题和提示语
      iconEl.innerHTML = roleInfo.icon || iconEl.innerHTML
      iconEl.title = roleInfo.tooltip
    } catch (_) { /* 忽略展示更新错误 */ }
  }

  // 创建动作按钮（根据角色配置动态创建）
  proto.createActionButton = async function (actionKey) {
    const button = document.createElement('span')
    button.setAttribute('data-action-key', actionKey)

    // 从角色配置中动态获取图标、标签和提示语
    try {
      const roleInfo = await this.getRoleInfoForAction(actionKey)
      button.innerHTML = roleInfo.icon || '🙂'
      button.title = roleInfo.tooltip
    } catch (error) {
      // 降级到默认值
      const fallbackInfo = await this.getRoleInfoForAction(actionKey)
      button.innerHTML = fallbackInfo.icon || '🙂'
      button.title = fallbackInfo.tooltip
    }

    // 统一的按钮样式（使用 CSS 类）
    button.className = 'role-button'

    return button
  }

  // 获取按角色设置列表顺序排列的已绑定角色的 actionKey 列表
  // 此方法与 renderRoleSettingsList() 共享相同的顺序逻辑
  proto.getOrderedBoundRoleKeys = async function () {
    const configsRaw = await this.getRoleConfigs()
    const configs = Array.isArray(configsRaw) ? configsRaw : []

    // 返回所有有 actionKey 的角色的 actionKey（保持配置中的顺序）
    const orderedKeys = []
    const seenKeys = new Set()
    for (const config of configs) {
      if (config && config.actionKey && !seenKeys.has(config.actionKey)) {
        orderedKeys.push(config.actionKey)
        seenKeys.add(config.actionKey)
      }
    }

    return orderedKeys
  }

  // 刷新欢迎消息操作按钮：显示角色列表作为按钮（设置按钮已移动到 chat-request-status-button 后面）
  proto.refreshWelcomeActionButtons = async function () {
    if (!this.chatWindow) return
    const container = this.chatWindow.querySelector('#pet-welcome-actions')
    if (!container) return

    // 重建容器
    container.innerHTML = ''

    // 确保按钮样式容器正确（横向排列）
    container.className = 'role-button-container'

    // 获取所有角色配置
    const configsRaw = await this.getRoleConfigs()

    // 确保 actionIcons 和 buttonHandlers 已初始化
    if (!this.actionIcons) {
      this.actionIcons = {}
    }
    if (!this.buttonHandlers) {
      this.buttonHandlers = {}
    }
    // 用于存储没有 actionKey 的角色按钮
    if (!this.roleButtonsById) {
      this.roleButtonsById = {}
    }

    // 先显示已绑定按钮的角色（按按钮顺序）
    const orderedKeys = await this.getOrderedBoundRoleKeys()
    const boundRoleIds = new Set()

    for (const key of orderedKeys) {
      const config = (configsRaw || []).find(c => c && c.actionKey === key)
      if (config) {
        boundRoleIds.add(config.id)

        // 创建角色按钮
        let button = this.actionIcons[key]
        if (!button) {
          button = await this.createActionButton(key)
          this.actionIcons[key] = button
        } else {
          // 更新现有按钮的样式
          await this.applyRoleConfigToActionIcon(button, key)
        }

        // 绑定点击事件（确保只绑定一次）
        if (!this.buttonHandlers[key]) {
          // 使用 processingFlag 对象来传递状态
          const processingFlag = { value: false }
          this.buttonHandlers[key] = this.createRoleButtonHandler(key, button, processingFlag)
          button.onclick = this.buttonHandlers[key]
        }

        container.appendChild(button)
      }
    }

    // 再显示其他角色（没有绑定按钮的角色）作为可点击按钮
    const otherRoles = (configsRaw || []).filter(c => c && c.id && !boundRoleIds.has(c.id))
    for (const config of otherRoles) {
      // 创建或复用角色按钮（没有 actionKey，点击时请求 services.ai.chat_service 接口）
      let button = this.roleButtonsById[config.id]
      if (!button) {
        button = document.createElement('span')
        button.setAttribute('data-role-id', config.id)
        button.className = 'role-button'

        // hover 效果已通过 CSS 类定义

        this.roleButtonsById[config.id] = button
      }

      // 更新按钮内容
      const displayIcon = this.getRoleIcon(config, configsRaw)
      button.innerHTML = displayIcon || '🙂'
      button.title = config.label || '(未命名)'

      // 创建 processing flag 用于防止重复点击
      if (!this.roleButtonsProcessingFlags) {
        this.roleButtonsProcessingFlags = {}
      }
      if (!this.roleButtonsProcessingFlags[config.id]) {
        this.roleButtonsProcessingFlags[config.id] = { value: false }
      }
      const processingFlag = this.roleButtonsProcessingFlags[config.id]

      // 移除旧的点击事件（通过克隆节点来移除所有事件监听器）
      if (button.parentNode) {
        const oldButton = button
        const newButton = oldButton.cloneNode(true)
        oldButton.parentNode.replaceChild(newButton, oldButton)
        button = newButton
        this.roleButtonsById[config.id] = button

        // hover 效果已通过 CSS 类定义
      }

      // 绑定点击事件
      button.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (processingFlag.value) return

        processingFlag.value = true
        const originalIcon = button.innerHTML

        // 获取消息容器
        const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#yi-pet-chat-messages') : null
        if (!messagesContainer) {
          console.error('无法找到消息容器')
          processingFlag.value = false
          return
        }

        // 获取页面信息
        let pageInfo
        if (this.currentSessionId && this.sessions && this.sessions[this.currentSessionId]) {
          const session = this.sessions[this.currentSessionId]
          pageInfo = {
            title: session.title || document.title || '当前页面',
            url: session.url || window.location.href,
            description: session.pageDescription || '',
            content: session.pageContent || ''
          }
        } else {
          pageInfo = this.getPageInfo()
        }

        // 准备角色提示词
        const roleLabel = this.getRoleLabel(config, configsRaw)
        let rolePrompt = config.prompt
        if (!rolePrompt || !rolePrompt.trim()) {
          rolePrompt = `你现在是${roleLabel}。请以${roleLabel}的身份和语气来回答用户的问题。`
        }

        // 准备上下文信息
        const title = pageInfo.title || document.title || '当前页面'
        const pageUrl = pageInfo.url || window.location.href
        const pageDescription = pageInfo.description || ''
        const pageContent = pageInfo.content || ''
        const baseUserPrompt = `页面标题：${title}
页面URL：${pageUrl}
${pageDescription ? `页面描述：${pageDescription}` : ''}

页面内容（Markdown 格式）：
${pageContent || '无内容'}

请根据以上信息进行分析和处理。`

        // 构建 fromUser
        const fromUser = this.buildFromUserWithContext(baseUserPrompt, roleLabel)

        // 更新UI状态
        button.classList.add('js-loading')
        button.innerHTML = '⏳'

        try {
          // 调用 AI 接口
          const response = await this.callAiApi(
            rolePrompt,
            fromUser,
            (text) => { }, // 不需要在流式输出中更新
            null
          )

          // 处理响应结果
          let content = ''
          if (response && response.content) {
            content = response.content
          } else if (typeof response === 'string') {
            content = response
          }

          if (content) {
            await this.addMessageToSession('pet', content, null, false)
          }
        } catch (error) {
          console.error('角色处理失败:', error)
          this.showNotification('处理失败，请重试', 'error')
        } finally {
          processingFlag.value = false
          button.innerHTML = originalIcon
          button.classList.remove('js-loading')
        }
      })

      container.appendChild(button)
    }

    // 添加企微机器人按钮到欢迎消息
    const robotConfigs = await this.getWeWorkRobotConfigs()
    for (const robotConfig of robotConfigs) {
      if (!robotConfig || !robotConfig.webhookUrl) continue

      const robotButton = document.createElement('span')
      robotButton.className = 'robot-button'
      robotButton.setAttribute('data-robot-id', robotConfig.id)
      robotButton.innerHTML = robotConfig.icon || '🤖'
      robotButton.title = robotConfig.name || '企微机器人'

      robotButton.addEventListener('click', async (e) => {
        e.stopPropagation()

        // 获取欢迎消息的内容
        const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#yi-pet-chat-messages') : null
        if (!messagesContainer) return

        const welcomeMessage = messagesContainer.querySelector('[data-welcome-message]')
        if (!welcomeMessage) return

        const messageBubble = welcomeMessage.querySelector('[data-message-type="pet-bubble"]')
        let messageContent = ''
        if (messageBubble) {
          messageContent = messageBubble.getAttribute('data-original-text') ||
                        messageBubble.innerText ||
                        messageBubble.textContent || ''
        }

        if (!messageContent || !messageContent.trim()) {
          this.showNotification('消息内容为空，无法发送', 'error')
          return
        }

        const trimmedContent = messageContent.trim()
        const originalIcon = robotButton.innerHTML
        const originalColor = robotButton.style.color
        robotButton.innerHTML = '⏳'
        robotButton.classList.add('js-loading')
        robotButton.style.color = '#3b82f6' /* 信息蓝 */

        try {
          let finalContent = ''
          if (this.isMarkdownFormat(trimmedContent)) {
            finalContent = trimmedContent
          } else {
            finalContent = await this.convertToMarkdown(trimmedContent)
          }

          await this.sendToWeWorkRobot(robotConfig.webhookUrl, finalContent)
          robotButton.innerHTML = '✓'
          robotButton.classList.remove('js-loading')
          robotButton.classList.add('js-success')
          robotButton.style.color = '#22c55e' /* 现代绿 */
          this.showNotification(`已发送到 ${robotConfig.name || '企微机器人'}`, 'success')

          setTimeout(() => {
            robotButton.innerHTML = originalIcon
            robotButton.classList.remove('js-success')
            robotButton.style.color = originalColor
          }, 2000)
        } catch (error) {
          console.error('发送到企微机器人失败:', error)
          robotButton.innerHTML = '✕'
          robotButton.classList.remove('js-loading')
          robotButton.classList.add('js-error')
          robotButton.style.color = '#ef4444' /* 量子红 */
          this.showNotification(`发送失败：${error.message || '未知错误'}`, 'error')

          setTimeout(() => {
            robotButton.innerHTML = originalIcon
            robotButton.classList.remove('js-error')
            robotButton.style.color = originalColor
          }, 2000)
        }
      })

      container.appendChild(robotButton)
    }
  }

  // 刷新所有消息中的操作按钮（用于角色配置更新后同步所有按钮图标和提示语）
  proto.refreshAllMessageActionButtons = async function () {
    if (!this.chatWindow) return

    const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages')
    if (!messagesContainer) return

    // 查找所有有按钮容器的消息（不包括第一条欢迎消息）
    const allMessages = Array.from(messagesContainer.children).filter(
      child => child.querySelector('[data-message-type="pet-bubble"]')
    )

    // 跳过第一条消息，从第二条开始刷新
    for (let i = 1; i < allMessages.length; i++) {
      const messageDiv = allMessages[i]
      // 强制刷新按钮 - 使用 ChatWindow 的统一方法
      if (this.chatWindowComponent && typeof this.chatWindowComponent.addActionButtonsToMessage === 'function') {
        await this.chatWindowComponent.addActionButtonsToMessage(messageDiv, true)
      }
    }
  }

  // 创建角色按钮点击处理函数
  proto.createRoleButtonHandler = function (actionKey, iconEl, processingFlag) {
    return async () => {
      if (processingFlag.value) return

      processingFlag.value = true

      // 获取消息容器
      const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null
      if (!messagesContainer) {
        console.error('无法找到消息容器')
        processingFlag.value = false
        return
      }

      // 获取页面信息：优先使用当前会话保存的页面上下文
      let pageInfo
      if (this.currentSessionId && this.sessions[this.currentSessionId]) {
        const session = this.sessions[this.currentSessionId]
        pageInfo = {
          title: session.title || document.title || '当前页面',
          url: session.url || window.location.href,
          description: session.pageDescription || '',
          content: session.pageContent || '' // 使用会话保存的页面内容
        }
      } else {
        // 如果没有当前会话，使用当前页面信息
        pageInfo = this.getPageInfo()
      }

      // 从角色配置中获取提示语、名称、图标
      let roleInfo
      try {
        roleInfo = await this.getRolePromptForAction(actionKey, pageInfo)
      } catch (error) {
        console.error('获取角色信息失败:', error)
        roleInfo = {
          systemPrompt: '',
          userPrompt: '',
          label: '自定义角色',
          icon: '🙂'
        }
      }

      // 构建包含会话上下文的 fromUser 参数（会使用会话保存的页面上下文）
      const fromUser = this.buildFromUserWithContext(roleInfo.userPrompt, roleInfo.label)

      // 找到按钮所在的消息元素（向上查找包含用户消息的元素）
      let userMessageDiv = null
      let currentElement = iconEl
      while (currentElement && currentElement !== messagesContainer) {
        // 检查当前元素是否包含 user-bubble
        if (currentElement.querySelector) {
          const userBubble = currentElement.querySelector('[data-message-type="user-bubble"]')
          if (userBubble) {
            userMessageDiv = currentElement
            break
          }
        }
        // 如果当前元素有 data-message-id 属性，也检查它是否包含 user-bubble（消息元素有该属性）
        if (currentElement.hasAttribute && currentElement.hasAttribute('data-message-id')) {
          const userBubble = currentElement.querySelector('[data-message-type="user-bubble"]')
          if (userBubble) {
            userMessageDiv = currentElement
            break
          }
        }
        currentElement = currentElement.parentElement
      }

      // 创建新的消息（按钮操作生成的消息）
      const message = this.createMessageElement('', 'pet')
      message.setAttribute('data-button-action', 'true') // 标记为按钮操作生成
      messagesContainer.appendChild(message)
      const messageText = message.querySelector('[data-message-type="pet-bubble"]')
      const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]')

      // 显示加载动画
      if (messageAvatar) {
        messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite'
      }

      // 使用角色配置中的图标显示加载文本
      const loadingIcon = roleInfo.icon || '📖'
      if (messageText) {
        messageText.textContent = `${loadingIcon} 正在${roleInfo.label || '处理'}...`
      }

      try {
        // 使用 services.ai.chat_service 接口生成内容（非流式）
        console.log('调用大模型生成内容，角色:', roleInfo.label, '页面标题:', pageInfo.title || '当前页面')

        // 创建 AbortController 用于终止请求
        const abortController = new AbortController()

        // 设置标志，避免 prompt 调用后触发会话列表刷新接口
        this.skipSessionListRefresh = true

        // 使用统一的 payload 构建函数，自动包含会话 ID
        // 如果找到了用户消息元素，将其传递给 buildPromptPayload，以便从正确的消息中提取图片
        const oldPayload = this.buildPromptPayload(
          roleInfo.systemPrompt,
          fromUser,
          { messageDiv: userMessageDiv }
        )

        // 转换为 services.ai.chat_service 格式
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
        const selectedModel = this.currentModel || (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || 'qwen3'
        if (selectedModel) payload.parameters.model = selectedModel
        if (oldPayload.conversation_id) {
          payload.parameters.conversation_id = oldPayload.conversation_id
        }

        const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders()
          },
          body: JSON.stringify(payload),
          signal: abortController.signal
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
        }

        const envelope = await response.json()
        if (!envelope || typeof envelope !== 'object') {
          throw new Error('响应格式错误')
        }
        if (envelope.code !== 0) {
          throw new Error(envelope.message || `请求失败 (code=${envelope.code})`)
        }

        const data = envelope.data || {}

        // 处理后端返回的会话 ID（如果返回了）
        if (data.conversation_id) {
          const conversationId = data.conversation_id
          if (conversationId && !this.currentSessionId) {
            // 如果当前没有会话 ID，使用后端返回的会话 ID
            this.currentSessionId = conversationId
            console.log('从后端同步会话 ID:', conversationId)
            // 确保会话存在
            if (!this.sessions[this.currentSessionId]) {
              // 创建基础会话对象
              const pageInfo = this.getPageInfo()
              const newSession = this.createSessionObject(pageInfo)
              this.sessions[conversationId] = newSession
              // 标记当前页面已自动创建会话
              this.hasAutoCreatedSessionForPage = true
              this.currentPageUrl = pageInfo.url
            }
          } else if (conversationId && this.currentSessionId !== conversationId) {
            // 如果后端返回的会话 ID 与当前不同，记录日志
            console.log('后端返回的会话 ID 与当前不同:', conversationId, 'vs', this.currentSessionId)
          }
        }

        let content = typeof data.message === 'string' ? data.message : ''

        // 停止加载动画
        if (messageAvatar) {
          messageAvatar.style.animation = ''
        }

        // 显示生成的内容
        if (messageText) {
          // 确保内容不为空
          if (!content || !content.trim()) {
            content = '抱歉，未能获取到有效内容。'
          }
          messageText.innerHTML = this.renderMarkdown(content)
          if (typeof this.processTabs === 'function') this.processTabs(messageText)
          // 更新原始文本用于复制功能
          messageText.setAttribute('data-original-text', content)
          // 添加复制按钮
          if (content && content.trim()) {
            // 按钮现在由 ChatWindow.addActionButtonsToMessage 统一管理
            // 不再需要单独调用 addCopyButton
            // 添加 try again 按钮（仅当不是第一条消息时）
            const petMessages = Array.from(messagesContainer.children).filter(
              child => child.querySelector('[data-message-type="pet-bubble"]')
            )
            if (petMessages.length > 1) {
              const tryAgainContainer = message.querySelector('[data-try-again-button-container]')
              if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                this.addTryAgainButton(tryAgainContainer, message)
              }
            }
          }
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }

        // 设置标志，避免触发会话列表刷新接口（prompt 接口调用完成后会触发 session/save）
        this.skipSessionListRefresh = true
        if (content && content.trim()) {
          await this.addMessageToSession('pet', content, null, false)
        }

        // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
        await this.saveCurrentSession(false, false)

        // 请求结束后调用 session/save 保存会话到后端
        if (this.currentSessionId) {
          if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            try {
              await this.syncSessionToBackend(this.currentSessionId, true)
              console.log(`角色按钮操作后，会话 ${this.currentSessionId} 已保存到后端`)
            } catch (error) {
              console.warn('保存会话到后端失败:', error)
            }
          } else {
            console.warn('无法保存会话：sessionApi 未初始化或后端同步未启用')
          }
        } else {
          console.warn('无法保存会话：当前会话 ID 不存在')
        }

        iconEl.innerHTML = '✓'
        iconEl.classList.remove('js-error')
        iconEl.classList.add('js-success')

        // 2秒后恢复初始状态，允许再次点击（根据角色设置恢复图标与标题）
        setTimeout(() => {
          this.applyRoleConfigToActionIcon(iconEl, actionKey)
          iconEl.classList.remove('js-success')
          processingFlag.value = false
        }, 2000)
      } catch (error) {
        // 检查是否是取消错误
        const isAbortError = error.name === 'AbortError' || error.message === '请求已取消'

        if (!isAbortError) {
          console.error(`生成${roleInfo.label}失败:`, error)
        }

        // 显示错误消息（取消时不显示）
        if (!isAbortError && messageText) {
          const errorMessage = error.message && error.message.includes('HTTP error')
            ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${loadingIcon}`
            : `抱歉，无法生成"${pageInfo.title || '当前页面'}"的${roleInfo.label || '内容'}。${error.message ? `错误信息：${error.message}` : '请稍后重试。'}${loadingIcon}`
          messageText.innerHTML = this.renderMarkdown(errorMessage)
          if (typeof this.processTabs === 'function') this.processTabs(messageText)
          // 添加 try again 按钮（仅当不是第一条消息时）
          const petMessages = Array.from(messagesContainer.children).filter(
            child => child.querySelector('[data-message-type="pet-bubble"]')
          )
          if (petMessages.length > 1) {
            const tryAgainContainer = message.querySelector('[data-try-again-button-container]')
            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
              this.addTryAgainButton(tryAgainContainer, message)
            }
          }
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        } else if (isAbortError && messageText) {
          // 请求被取消，移除消息
          message.remove()
        }

        if (!isAbortError) {
          iconEl.innerHTML = '✕'
          iconEl.classList.remove('js-success')
          iconEl.classList.add('js-error')

          // 1.5秒后恢复初始状态，允许再次点击（根据角色设置恢复图标与标题）
          setTimeout(() => {
            this.applyRoleConfigToActionIcon(iconEl, actionKey)
            iconEl.classList.remove('js-error')
            processingFlag.value = false
          }, 1500)
        } else {
          // 请求被取消，立即恢复状态
          this.applyRoleConfigToActionIcon(iconEl, actionKey)
          iconEl.classList.remove('js-success', 'js-error')
          processingFlag.value = false
        }
      } finally {
        // 确保停止加载动画
        if (messageAvatar) {
          messageAvatar.style.animation = ''
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }
    }
  }

  // -------- 角色设置弹框（新增/编辑/删除） --------
  proto.openRoleSettingsModal = function (editId = null) {
    if (!this.chatWindow) return
    let overlay = this.chatWindow.querySelector('#pet-role-settings')
    const currentColor = this.colors[this.colorIndex]
    const mainColor = this.getMainColorFromGradient(currentColor)
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id = 'pet-role-settings'
      const chatHeaderEl = this.chatWindow.querySelector('.chat-header')
      const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60
      overlay.className = 'pet-role-settings-overlay'
      overlay.style.top = `${headerH}px`
      overlay.style.zIndex = String(PET_CONFIG.ui.zIndex.inputContainer + 1)

      const panel = document.createElement('div')
      panel.id = 'pet-role-settings-panel'
      panel.className = 'pet-role-settings-panel'

      const header = document.createElement('div')
      header.className = 'pet-role-settings-header'
      const title = document.createElement('div')
      title.textContent = '角色设置'
      title.className = 'pet-role-settings-header-title'

      const headerBtns = document.createElement('div')
      headerBtns.className = 'pet-role-settings-header-btns'
      const closeBtn = document.createElement('button')
      closeBtn.id = 'pet-role-settings-close-btn'
      closeBtn.setAttribute('aria-label', '关闭角色设置 (Esc)')
      closeBtn.setAttribute('title', '关闭 (Esc)')
      closeBtn.textContent = '✕'
      closeBtn.className = 'pet-role-settings-close-btn'
      closeBtn.addEventListener('click', () => this.closeRoleSettingsModal())
      headerBtns.appendChild(closeBtn)
      header.appendChild(title)
      header.appendChild(headerBtns)

      const body = document.createElement('div')
      body.id = 'pet-role-settings-body'
      body.className = 'pet-role-settings-body'

      // 左侧：角色列表
      const listContainer = document.createElement('div')
      listContainer.className = 'pet-role-settings-list-container'

      // 新增角色按钮（放在列表顶部）
      const addBtn = document.createElement('button')
      addBtn.textContent = '新增角色'
      addBtn.className = 'pet-role-settings-add-btn'
      addBtn.addEventListener('click', () => this.renderRoleSettingsForm(null, false))
      listContainer.appendChild(addBtn)

      const list = document.createElement('div')
      list.id = 'pet-role-list'
      list.className = 'pet-role-settings-list'
      listContainer.appendChild(list)

      // 右侧：表单区
      const form = document.createElement('div')
      form.id = 'pet-role-form'
      form.className = 'pet-role-settings-form'

      body.appendChild(listContainer)
      body.appendChild(form)
      panel.appendChild(header)
      panel.appendChild(body)
      overlay.appendChild(panel)
      this.chatWindow.appendChild(overlay)
    }

    overlay.classList.add('pet-is-visible')

    if (typeof this.lockSidebarToggle === 'function') {
      this.lockSidebarToggle('role-settings')
    }

    // 直接渲染当前配置（不再强制补齐默认项，便于"删除"生效）
    this.renderRoleSettingsList()
    if (editId) {
      this.renderRoleSettingsForm(editId)
    } else {
      this.renderRoleSettingsForm(null, true) // 第二个参数表示显示空白状态
    }
  }

  proto.closeRoleSettingsModal = function () {
    if (!this.chatWindow) return
    const overlay = this.chatWindow.querySelector('#pet-role-settings')
    if (overlay) overlay.classList.remove('pet-is-visible')

    if (typeof this.unlockSidebarToggle === 'function') {
      this.unlockSidebarToggle('role-settings')
    }
  }

  proto.renderRoleSettingsList = async function () {
    if (!this.chatWindow) return
    const list = this.chatWindow.querySelector('#pet-role-list')
    if (!list) return
    const configsRaw = await this.getRoleConfigs()
    list.innerHTML = ''

    // 先显示已绑定按钮的角色（按按钮顺序）
    // 使用 getOrderedBoundRoleKeys() 确保与 refreshWelcomeActionButtons() 顺序一致
    const orderedKeys = await this.getOrderedBoundRoleKeys()
    const boundRoleIds = new Set()
    for (const key of orderedKeys) {
      const config = (configsRaw || []).find(c => c && c.actionKey === key)
      if (config) {
        boundRoleIds.add(config.id)
        // 使用统一的角色信息获取函数获取标签
        const roleInfo = await this.getRoleInfoForAction(key)
        const row = this.createRoleListItem(config, roleInfo.label, configsRaw)
        list.appendChild(row)
      }
    }

    // 再显示其他角色（没有绑定按钮的角色）
    const otherRoles = (configsRaw || []).filter(c => c && c.id && !boundRoleIds.has(c.id))
    if (otherRoles.length > 0) {
      // 如果有已绑定的角色，添加分隔线
      if (orderedKeys.length > 0) {
        const separator = document.createElement('div')
        separator.className = 'pet-role-settings-separator'
        list.appendChild(separator)
      }

      otherRoles.forEach(config => {
        const row = this.createRoleListItem(config, '', configsRaw)
        list.appendChild(row)
      })
    }

    if (list.children.length === 0) {
      const empty = document.createElement('div')
      empty.textContent = '暂无自定义角色。点击"新增角色"开始创建'
      empty.className = 'pet-role-settings-empty'
      list.appendChild(empty)
    }
  }

  proto.createRoleListItem = function (c, buttonLabel, allConfigs = null) {
    const row = document.createElement('div')
    row.className = 'pet-role-settings-item'
    const info = document.createElement('div')
    info.className = 'pet-role-settings-item-info'
    const name = document.createElement('div')
    const displayIcon = this.getRoleIcon(c, allConfigs)
    name.textContent = `${displayIcon ? (displayIcon + ' ') : ''}${c.label || '(未命名)'}`
    name.className = 'pet-role-settings-item-name'
    info.appendChild(name)
    if (buttonLabel && buttonLabel.trim()) {
      const sub = document.createElement('div')
      sub.textContent = buttonLabel
      sub.className = 'pet-role-settings-item-sub'
      info.appendChild(sub)
    }

    const btns = document.createElement('div')
    btns.className = 'pet-role-settings-item-btns'
    const edit = document.createElement('button')
    edit.textContent = '编辑'
    edit.className = 'pet-role-settings-item-edit'
    edit.addEventListener('click', () => this.renderRoleSettingsForm(c.id))
    const del = document.createElement('button')
    del.textContent = '删除'
    del.className = 'pet-role-settings-item-del'
    del.addEventListener('click', async () => {
      const next = (await this.getRoleConfigs()).filter(x => x.id !== c.id)
      await this.setRoleConfigs(next)
      this.renderRoleSettingsList()
      this.renderRoleSettingsForm(null, true) // 显示空白状态
      // 同步刷新欢迎消息下的动作按钮
      await this.refreshWelcomeActionButtons()
      // 刷新所有消息下的按钮
      await this.refreshAllMessageActionButtons()
    })
    btns.appendChild(edit)
    btns.appendChild(del)

    row.appendChild(info)
    row.appendChild(btns)
    return row
  }

  proto.renderRoleSettingsForm = async function (editId = null, showEmptyState = false) {
    if (!this.chatWindow) return
    const form = this.chatWindow.querySelector('#pet-role-form')
    if (!form) return
    const configsAll = await this.getRoleConfigs()
    // 用于查找已绑定按钮的角色列表（用于检查占用情况）
    const configs = (configsAll || []).filter(c => c && c.actionKey)
    // 当前编辑的角色（从所有角色中查找）
    const current = editId ? (configsAll || []).find(c => c && c.id === editId) : null

    form.innerHTML = ''

    // 如果显示空白状态（没有选中角色且不是主动新增）
    if (showEmptyState && !editId && !current) {
      const emptyState = document.createElement('div')
      emptyState.className = 'pet-role-settings-empty-state'

      const icon = document.createElement('div')
      icon.textContent = '👤'
      icon.className = 'pet-role-settings-empty-icon'

      const title = document.createElement('div')
      title.textContent = '选择一个角色开始编辑'
      title.className = 'pet-role-settings-empty-title'

      const desc = document.createElement('div')
      desc.textContent = '从左侧列表选择角色进行编辑，或点击"新增角色"创建新角色'
      desc.className = 'pet-role-settings-empty-desc'

      const actionBtn = document.createElement('button')
      actionBtn.textContent = '新增角色'
      actionBtn.className = 'pet-role-settings-empty-action'
      actionBtn.addEventListener('click', () => {
        this.renderRoleSettingsForm(null, false)
      })

      emptyState.appendChild(icon)
      emptyState.appendChild(title)
      emptyState.appendChild(desc)
      emptyState.appendChild(actionBtn)
      form.appendChild(emptyState)
      return
    }

    const title = document.createElement('div')
    title.textContent = current ? '编辑角色' : '新增角色'
    title.className = 'pet-role-settings-form-title'

    const row = (labelText, inputEl) => {
      const wrap = document.createElement('div')
      wrap.className = 'pet-role-settings-field'
      const lab = document.createElement('label')
      lab.textContent = labelText
      lab.className = 'pet-role-settings-label'
      wrap.appendChild(lab)
      wrap.appendChild(inputEl)
      return wrap
    }

    const labelInput = document.createElement('input')
    labelInput.type = 'text'
    labelInput.value = current?.label || ''
    labelInput.placeholder = '角色名称，如：翻译官'
    labelInput.className = 'pet-role-settings-input'

    const iconInput = document.createElement('input')
    iconInput.type = 'text'
    iconInput.value = current?.icon || '🙂'
    iconInput.placeholder = '图标（Emoji）'
    iconInput.className = 'pet-role-settings-icon-input'

    const promptInput = document.createElement('textarea')
    promptInput.value = current?.prompt || ''
    promptInput.placeholder = '角色提示词（System Prompt）。\n例如：你是一个专业的翻译官，请将我发送的内容翻译成英文。'
    promptInput.className = 'pet-role-settings-textarea'

    // 按钮绑定部分（可选）
    const actionKeyWrap = document.createElement('div')
    actionKeyWrap.className = 'pet-role-settings-action-key-wrap'

    const actionKeyLabel = document.createElement('div')
    actionKeyLabel.className = 'pet-role-settings-action-key-label'
    actionKeyLabel.textContent = '绑定到快捷按钮'

    // 添加提示信息
    const actionKeyTip = document.createElement('span')
    actionKeyTip.textContent = '开启后将在欢迎消息下方显示快捷按钮'
    actionKeyTip.className = 'pet-role-settings-action-key-tip'
    actionKeyLabel.appendChild(actionKeyTip)

    const actionKeySwitch = document.createElement('div')
    actionKeySwitch.className = 'pet-role-settings-action-key-switch'

    const switchBtn = document.createElement('div')
    const isBound = !!current?.actionKey
    switchBtn.className = 'pet-role-settings-switch'
    switchBtn.style.background = isBound ? '#3b82f6' : 'rgba(255,255,255,0.2)'
    const switchDot = document.createElement('div')
    switchDot.className = 'pet-role-settings-switch-dot'
    switchDot.style.left = isBound ? '18px' : '2px'
    switchBtn.appendChild(switchDot)

    const switchText = document.createElement('span')
    switchText.textContent = isBound ? '已启用' : '未启用'
    switchText.className = 'pet-role-settings-switch-text'
    switchText.style.color = isBound ? '#fff' : '#94a3b8'

    actionKeySwitch.appendChild(switchBtn)
    actionKeySwitch.appendChild(switchText)

    let bindActionKey = isBound
    actionKeySwitch.addEventListener('click', () => {
      bindActionKey = !bindActionKey
      switchBtn.style.background = bindActionKey ? '#3b82f6' : 'rgba(255,255,255,0.2)'
      switchDot.style.left = bindActionKey ? '18px' : '2px'
      switchText.textContent = bindActionKey ? '已启用' : '未启用'
      switchText.style.color = bindActionKey ? '#fff' : '#94a3b8'
    })

    actionKeyWrap.appendChild(actionKeyLabel)
    actionKeyWrap.appendChild(actionKeySwitch)

    const btns = document.createElement('div')
    btns.className = 'pet-role-settings-form-btns'
    const saveBtn = document.createElement('button')
    saveBtn.textContent = '保存'
    saveBtn.className = 'pet-role-settings-save-btn'
    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '取消'
    cancelBtn.className = 'pet-role-settings-cancel-btn'

    saveBtn.addEventListener('click', async () => {
      const originalText = saveBtn.textContent
      const isLoading = saveBtn.dataset.loading === 'true'
      if (isLoading) return

      saveBtn.dataset.loading = 'true'
      saveBtn.textContent = '保存中...'
      saveBtn.disabled = true
      saveBtn.classList.add('is-loading')

      try {
        if (!labelInput.value.trim()) {
          throw new Error('角色名称不能为空')
        }
        if (!promptInput.value.trim()) {
          throw new Error('角色提示词不能为空')
        }

        const next = {
          id: current?.id || ('role_' + Math.random().toString(36).slice(2, 10)),
          label: labelInput.value.trim(),
          icon: iconInput.value.trim() || '🙂',
          prompt: promptInput.value.trim(),
          // 保持原有的 actionKey 或生成新的（如果绑定）
          actionKey: bindActionKey ? (current?.actionKey || ('custom_' + Math.random().toString(36).slice(2, 8))) : null,
          tooltip: labelInput.value.trim(),
          includeCharts: current?.includeCharts || false
        }

        const arr = await this.getRoleConfigs()

        // 检查 actionKey 冲突（如果是绑定状态）
        if (next.actionKey) {
          const conflict = arr.find(x => x.actionKey === next.actionKey && x.id !== next.id)
          if (conflict) {
            // 如果有冲突，重新生成一个
            next.actionKey = 'custom_' + Math.random().toString(36).slice(2, 8)
          }
        }

        const idx = arr.findIndex(x => x.id === next.id)
        const isEdit = idx >= 0
        if (isEdit) {
          arr[idx] = next
        } else {
          arr.push(next)
        }

        await this.setRoleConfigs(arr)

        // 稍微延迟一下，让动画效果更自然
        await new Promise(resolve => setTimeout(resolve, 300))

        this.renderRoleSettingsList()
        this.renderRoleSettingsForm(null, true) // 显示空白状态，提升体验

        // 同步刷新欢迎消息下的动作按钮
        await this.refreshWelcomeActionButtons()
        // 刷新所有消息下的按钮
        await this.refreshAllMessageActionButtons()

        const successMessage = isEdit ? `✅ 角色 "${next.label}" 已更新` : `✅ 角色 "${next.label}" 已创建`
        this.showNotification(successMessage, 'success')
      } catch (error) {
        console.error('保存角色配置失败:', error)
        this.showNotification(`❌ 保存失败：${error.message || '未知错误'}`, 'error')
      } finally {
        saveBtn.dataset.loading = 'false'
        saveBtn.textContent = originalText
        saveBtn.disabled = false
        saveBtn.classList.remove('is-loading')
      }
    })

    cancelBtn.addEventListener('click', () => {
      this.renderRoleSettingsForm(null, true)
    })

    form.appendChild(title)
    form.appendChild(row('角色名称', labelInput))
    form.appendChild(row('图标', iconInput))
    form.appendChild(row('提示词 (System Prompt)', promptInput))
    form.appendChild(actionKeyWrap)
    form.appendChild(btns)
    btns.appendChild(saveBtn)
    btns.appendChild(cancelBtn)
  }

  proto.getRoleConfigs = async function () {
    return new Promise((resolve) => {
      chrome.storage.local.get(['roleConfigs'], (result) => {
        resolve(Array.isArray(result.roleConfigs) ? result.roleConfigs : [])
      })
    })
  }

  proto.setRoleConfigs = async function (configs) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ roleConfigs: configs }, () => resolve(true))
    })
  }

  // 读取内置角色定义并转为默认配置（从已有配置中获取label、icon和prompt，如果没有则使用默认值）
  proto.buildDefaultRoleConfigsFromBuiltins = function (existingConfigs = null) {
    const keys = ['summary', 'mindmap', 'flashcard', 'report', 'bestPractice']
    const includeChartsMap = {
      summary: false,
      mindmap: true,
      flashcard: false,
      report: true,
      bestPractice: true
    }
    const arr = []
    keys.forEach(k => {
      // 从已有配置中查找对应的label、icon和prompt
      let label = k // 默认使用actionKey
      let icon = '' // 默认icon为空，由用户配置
      let prompt = '' // 默认prompt为空，由用户配置
      if (existingConfigs && Array.isArray(existingConfigs)) {
        const existing = existingConfigs.find(c => c && c.actionKey === k)
        if (existing) {
          if (existing.label && typeof existing.label === 'string') {
            const trimmedLabel = existing.label.trim()
            if (trimmedLabel) {
              label = trimmedLabel
            }
          }
          if (existing.icon && typeof existing.icon === 'string') {
            const trimmedIcon = existing.icon.trim()
            if (trimmedIcon) {
              icon = trimmedIcon
            }
          }
          if (existing.prompt && typeof existing.prompt === 'string') {
            const trimmedPrompt = existing.prompt.trim()
            if (trimmedPrompt) {
              prompt = trimmedPrompt
            }
          }
        }
      }
      arr.push({
        id: 'builtin_' + k,
        label,
        actionKey: k,
        icon,
        includeCharts: includeChartsMap[k] || false,
        prompt
      })
    })
    return arr
  }

  // 确保默认角色已存在（仅在为空或缺少时补齐）
  // 注意：消息按钮的创建逻辑已移至 ChatWindow.addActionButtonsToMessage 统一管理
  // 此方法已删除，请使用 chatWindowComponent.addActionButtonsToMessage

  proto.ensureDefaultRoleConfigs = async function () {
    const existing = await this.getRoleConfigs()
    const defaults = this.buildDefaultRoleConfigsFromBuiltins(existing)
    if (!existing || existing.length === 0) {
      await this.setRoleConfigs(defaults)
      return true
    }
    // 补齐缺失的内置项
    const haveKeys = new Set(existing.map(c => c.actionKey))
    let updated = false
    defaults.forEach(d => {
      if (!haveKeys.has(d.actionKey)) {
        existing.push({
          id: d.id,
          label: d.label,
          actionKey: d.actionKey,
          icon: d.icon,
          includeCharts: d.includeCharts,
          prompt: d.prompt
        })
        updated = true
      }
    })
    if (updated) {
      await this.setRoleConfigs(existing)
    }
    return true
  }
})(typeof window !== 'undefined' ? window : this)
