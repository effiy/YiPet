// 防止重复声明 PetManager
(function () {
  'use strict'
  try {
    if (typeof window.PetManager !== 'undefined') {
      return // 如果已经存在，直接返回
    }

    // 检查必要的依赖
    if (typeof window === 'undefined') {
      console.error('[PetManager.core] window 对象未定义')
      return
    }

    if (typeof PET_CONFIG === 'undefined') {
      console.warn('[PetManager.core] PET_CONFIG 未定义，将使用默认值')
    }

    class PetManager extends LoadingAnimationMixin {
      constructor () {
        super()
        this.pet = null
        this.isVisible = PET_CONFIG.pet.defaultVisible
        this.colorIndex = PET_CONFIG.pet.defaultColorIndex
        this.size = PET_CONFIG.pet.defaultSize
        this.position = getPetDefaultPosition()
        this.role = '教师' // 默认角色为教师
        this.chatWindow = null
        this.isChatOpen = false
        this.currentModel = (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || 'qwen3'

        this.colors = PET_CONFIG.pet.colors
        this.mermaidLoaded = false
        this.mermaidLoading = false
        this.jszipLoaded = false
        this.jszipLoading = false

        // 会话管理相关属性
        this.currentSessionId = null
        this.sessions = {} // 存储所有会话，key为sessionId，value为会话数据
        this.sessionSidebar = null // 会话侧边栏元素
        this.isSwitchingSession = false // 是否正在切换会话（防抖标志）
        this.currentPageUrl = null // 当前页面URL，用于判断是否为新页面
        this.hasAutoCreatedSessionForPage = false // 当前页面是否已经自动创建了会话
        this.sessionInitPending = false // 会话初始化是否正在进行中
        this.sidebarWidth = 320 // 侧边栏宽度（像素）
        this.isResizingSidebar = false // 是否正在调整侧边栏宽度
        this.sidebarCollapsed = false // 侧边栏是否折叠
        this.inputContainerCollapsed = false // 输入框容器是否折叠

        // 会话更新优化相关
        this.sessionUpdateTimer = null // 会话更新防抖定时器
        this.pendingSessionUpdate = false // 是否有待处理的会话更新
        this.lastSessionSaveTime = 0 // 上次保存会话的时间
        this.SESSION_UPDATE_DEBOUNCE = 300 // 会话更新防抖时间（毫秒）
        this.SESSION_SAVE_THROTTLE = 1000 // 会话保存节流时间（毫秒）

        // 标签过滤相关
        this.selectedFilterTags = [] // 选中的过滤标签（会话，默认不选中任何标签）
        this.tagFilterReverse = false // 是否反向过滤会话
        this.tagFilterNoTags = false // 是否筛选无标签的会话（默认不选中）
        this.tagFilterExpanded = false // 标签列表是否展开（会话）
        this.tagFilterVisibleCount = 8 // 折叠时显示的标签数量（会话）
        this.tagFilterSearchKeyword = '' // 标签搜索关键词
        this.tagOrder = null // 标签顺序

        this.sessionTitleFilter = '' // 会话标题搜索过滤关键词
        this.dateRangeFilter = null // 日期区间过滤 { startDate: Date, endDate: Date } 或 null，支持只选择结束日期来筛选结束日期之前的记录

        // 批量操作相关
        this.batchMode = false // 是否处于批量选择模式
        this.selectedSessionIds = new Set() // 选中的会话ID集合

        // 会话API管理器
        this.sessionApi = null
        this.lastSessionListLoadTime = 0
        this.SESSION_LIST_RELOAD_INTERVAL = 10000 // 会话列表重新加载间隔（10秒）
        this.isPageFirstLoad = true // 标记是否是页面首次加载/刷新
        this.skipSessionListRefresh = false // 标记是否跳过会话列表刷新（prompt调用后使用）
        this.isChatWindowFirstOpen = true // 标记是否是第一次打开聊天窗口
        this.hasLoadedSessionsForChat = false // 当前聊天周期是否已加载过会话列表

        // FAQ API管理器
        this.faqApi = null

        // 状态保存节流相关
        this.lastStateSaveTime = 0 // 上次保存状态的时间
        this.STATE_SAVE_THROTTLE = 2000 // 状态保存节流时间（毫秒），避免写入过于频繁
        this.stateSaveTimer = null // 状态保存防抖定时器
        this.pendingStateUpdate = null // 待保存的状态数据
        // 加载动画计数器
        this.activeRequestCount = 0

        this.init()
      }

      async init () {
        // 加载标签顺序
        await this.loadTagOrder()
        console.log('初始化宠物管理器')

        // 初始化会话API管理器
        if (typeof SessionService !== 'undefined' && PET_CONFIG.api.syncSessionsToBackend) {
          this.sessionApi = new SessionService(PET_CONFIG.api.yiaiBaseUrl, {
            enabled: PET_CONFIG.api.syncSessionsToBackend
          })
          console.log('会话API管理器已初始化')
        } else {
          console.log('会话API管理器未启用')
        }

        // 初始化FAQ API管理器
        if (typeof FaqService !== 'undefined') {
          const faqApiUrl = PET_CONFIG?.api?.faqApiUrl || 'http://localhost:8000'
          this.faqApi = new FaqService(faqApiUrl, { enabled: true })
          console.log('FAQ API管理器已初始化，URL:', faqApiUrl)
        } else {
          console.log('FAQ API管理器未启用')
        }

        this.loadState() // 加载保存的状态
        this.setupMessageListener()
        this.createPet()

        // 延迟检查并更新宠物显示状态，确保状态加载完成后样式正确
        setTimeout(() => {
          if (this.pet) {
            console.log('延迟检查：更新宠物样式，可见性:', this.isVisible)
            this.updatePetStyle()
            // 如果宠物已创建但还没有添加到页面，尝试再次添加
            if (!this.pet.parentNode) {
              console.log('延迟检查：宠物未添加到页面，尝试重新添加')
              this.addPetToPage()
            }
          }
        }, 500)

        // 启动定期同步，确保状态一致性
        this.startPeriodicSync()

        // 添加键盘快捷键支持
        this.setupKeyboardShortcuts()

        // 初始化会话：等待页面加载完成后1秒再创建新会话
        this.initSessionWithDelay()

        // 监听页面标题变化，以便在标题改变时更新会话
        this.setupTitleChangeListener()

        // 监听URL变化，以便在URL改变时创建新会话（支持单页应用）
        this.setupUrlChangeListener()
      }

      // 清理资源
      cleanup () {
        console.log('清理宠物管理器资源...')

        // 停止定期同步
        this.stopPeriodicSync()

        // 移除键盘快捷键监听器
        if (this._keyboardShortcutHandler) {
          window.removeEventListener('keydown', this._keyboardShortcutHandler, true)
          document.removeEventListener('keydown', this._keyboardShortcutHandler, true)
          this._keyboardShortcutHandler = null
        }

        // 移除宠物
        this.removePet()

        // 关闭聊天窗口
        if (this.chatWindow) {
          this.closeChatWindow()
        }

        // 清理截图预览
        this.closeScreenshotPreview()

        console.log('资源清理完成')
      }

      // 更新接口请求列表侧边栏
      /**
             * 获取过滤后的接口请求列表（统一过滤逻辑）
             * @returns {Array} 过滤后的请求列表
             */
      /**
             * 获取请求的唯一标识（使用 key 字段）
             * @param {Object} req - 请求对象
             * @returns {string|null} 唯一标识（key 字段）
             */

      // 优化页面上下文内容
      /**
             * 清理和优化文本内容
             * 去除HTML标签、无意义内容，保留核心信息
             * @param {string} text - 待清理的文本
             * @returns {string} 清理后的文本
             */

      // 根据标签名称生成颜色（确保相同标签颜色一致）

      // 清除所有选中状态（切换视图时调用）
      clearAllSelections () {
        // 清除当前选中的会话
        this.currentSessionId = null

        // 清除批量选中的状态
        if (this.selectedSessionIds) {
          this.selectedSessionIds.clear()
        }
        if (this.selectedApiRequestIds) {
          this.selectedApiRequestIds.clear()
        }

        // 清除所有 active 类的元素
        if (this.sessionSidebar) {
          // 清除会话项的 active 状态
          const activeSessionItems = this.sessionSidebar.querySelectorAll('.session-item.active')
          activeSessionItems.forEach(item => {
            item.classList.remove('active')
          })
        }

        console.log('已清除所有选中状态')
      }

      // 清空聊天会话内容
      clearChatMessages () {
        if (!this.chatWindow || !this.isChatOpen) {
          return
        }

        const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages')
        if (messagesContainer) {
          messagesContainer.innerHTML = ''
          console.log('已清空聊天会话内容')
        }
      }

      // 设置视图模式（会话列表）
      async setViewMode (mode) {
        // 强制使用会话视图，忽略传入的 mode 参数

        // 切换视图前，清除所有选中状态
        this.clearAllSelections()

        // 切换视图时，清空聊天会话内容
        this.clearChatMessages()

        // 默认会话视图
        await this.updateSessionSidebar()
        // 确保视图模式状态与列表数据一致
        this.applyViewMode()
      }

      // 应用视图模式样式（参考上下文弹框的applyContextPreviewMode）

      // 进入批量选择模式
      enterBatchMode () {
        this.batchMode = true
        if (this.selectedSessionIds) this.selectedSessionIds.clear()

        // 显示批量操作工具栏（参考 YiWeb：直接显示，不需要动画）
        const batchToolbar = document.getElementById('batch-toolbar')
        if (batchToolbar) {
          batchToolbar.classList.add('js-visible')
        }

        // 更新批量模式按钮状态
        const batchModeBtn = this.sessionSidebar.querySelector('.session-action-btn--batch')
        if (batchModeBtn) {
          batchModeBtn.classList.add('active')
          batchModeBtn.classList.remove('batch-mode-btn-inactive')
          batchModeBtn.classList.remove('batch-mode-btn-active')
          batchModeBtn.innerHTML = '☑️ 退出批量'
          batchModeBtn.title = '退出批量选择模式'
        }

        // 更新会话列表，显示复选框
        const sessionList = this.sessionSidebar.querySelector('.session-list')
        if (sessionList && sessionList.style.display !== 'none') {
          this.updateSessionSidebar()
        }

        // 更新批量工具栏状态
        setTimeout(() => {
          this.updateBatchToolbar()
        }, 100)

        // 显示通知
        this.showNotification('已进入批量选择模式', 'info')
      }

      // 退出批量选择模式
      exitBatchMode () {
        this.batchMode = false
        if (this.selectedSessionIds) this.selectedSessionIds.clear()
        if (this.selectedApiRequestIds) this.selectedApiRequestIds.clear()

        // 隐藏批量操作工具栏（参考 YiWeb：直接隐藏）
        const batchToolbar = document.getElementById('batch-toolbar')
        if (batchToolbar) {
          batchToolbar.classList.remove('js-visible')
        }

        // 更新批量模式按钮状态
        const batchModeBtn = this.sessionSidebar.querySelector('.session-action-btn--batch')
        if (batchModeBtn) {
          batchModeBtn.classList.remove('active')
          batchModeBtn.classList.remove('batch-mode-btn-active')
          batchModeBtn.classList.remove('batch-mode-btn-inactive')
          batchModeBtn.innerHTML = '☑️ 批量'
          batchModeBtn.title = '批量选择'
        }
        // 更新会话列表，隐藏复选框
        const sessionList = this.sessionSidebar.querySelector('.session-list')
        if (sessionList && sessionList.style.display !== 'none') {
          this.updateSessionSidebar()
        }

        // 显示通知
        this.showNotification('已退出批量选择模式', 'info')
      }

      // 更新批量操作工具栏

      // 删除会话
      async deleteSession (sessionId, skipConfirm = false) {
        if (!sessionId || !this.sessions[sessionId]) return

        // 获取会话标题用于提示
        const session = this.sessions[sessionId]
        const sessionTitle = session?.title || sessionId || '未命名会话'

        // 确认删除（如果未跳过确认）
        if (!skipConfirm) {
          const confirmDelete = confirm(`确定要删除会话"${sessionTitle}"吗？`)
          if (!confirmDelete) return
        }

        // 记录是否删除的是当前会话
        const isCurrentSession = sessionId === this.currentSessionId

        // 从选中集合中移除
        if (this.selectedSessionIds && this.selectedSessionIds.has(sessionId)) {
          this.selectedSessionIds.delete(sessionId)
          if (typeof this.updateBatchToolbar === 'function') {
            this.updateBatchToolbar()
          }
        }

        // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
        // 删除会话前不再自动保存当前会话

        // 从后端删除会话（如果启用了后端同步）
        if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
          try {
            // 确保使用 session.key 作为统一标识
            const unifiedSessionId = session.key || sessionId

            await this.sessionApi.deleteSession(unifiedSessionId)
            console.log('会话已从后端删除:', unifiedSessionId)
          } catch (error) {
            console.warn('从后端删除会话失败:', error)
            // 即使后端删除失败，也继续本地删除，确保用户界面响应
          }
        }

        // 从本地删除会话
        delete this.sessions[sessionId]
        // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
        // 删除操作通过后端API完成持久化

        // 删除会话后，重新从接口获取会话列表（强制刷新）
        if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend && this.isChatOpen) {
          try {
            await this.loadSessionsFromBackend(true)
            console.log('会话列表已从后端刷新')
          } catch (error) {
            console.warn('刷新会话列表失败:', error)
          }
        }

        // 如果删除的是当前会话，切换到其他会话或清空
        if (isCurrentSession) {
          // 查找最新的其他会话
          const otherSessions = Object.values(this.sessions)

          if (otherSessions.length > 0) {
            // 切换到最近访问的会话（使用 lastAccessTime，更符合"最新使用"的概念）
            // 如果没有 lastAccessTime，则使用 createdAt 作为备选
            const latestSession = otherSessions.sort((a, b) => {
              const aTime = a.lastAccessTime || a.createdAt || 0
              const bTime = b.lastAccessTime || b.createdAt || 0
              return bTime - aTime // 最近访问的在前
            })[0]

            await this.activateSession(latestSession.id, {
              saveCurrent: false, // 已经在前面保存了
              updateUI: true,
              syncToBackend: false // 删除会话后的自动切换不调用 session/save 接口
            })
          } else {
            // 没有其他会话，清空当前会话
            this.currentSessionId = null
            this.hasAutoCreatedSessionForPage = false

            // 清空消息显示
            if (this.chatWindow && this.isChatOpen) {
              const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages')
              if (messagesContainer) {
                messagesContainer.innerHTML = ''
              }
            }
          }
        }

        // 更新侧边栏
        await this.updateSessionUI({ updateSidebar: true })

        console.log('会话已删除:', sessionId)
      }

      // 处理 Markdown 中的 Mermaid 代码块
      createMessageElement (text, sender, imageDataUrl = null, timestamp = null, options = {}) {
        // 与 YiWeb 保持完全一致的消息结构
        const messageDiv = document.createElement('div')
        messageDiv.className = 'pet-chat-message'
        if (sender === 'user') {
          messageDiv.classList.add('is-user')
        } else {
          messageDiv.classList.add('is-pet')
        }

        // 处理额外状态类
        if (options.error) {
          messageDiv.classList.add('is-error')
        }
        if (options.aborted) {
          messageDiv.classList.add('is-aborted')
        }
        if (options.streaming) {
          messageDiv.classList.add('is-streaming')
        }

        // 设置消息索引和时间戳（用于后续操作，与 YiWeb 保持一致）
        if (timestamp) {
          messageDiv.setAttribute('data-chat-timestamp', timestamp.toString())
        } else {
          // 如果没有提供时间戳，使用当前时间
          messageDiv.setAttribute('data-chat-timestamp', Date.now().toString())
        }
        messageDiv.setAttribute('data-chat-type', sender === 'pet' ? 'pet' : 'user')

        // 设置消息索引（将在添加到容器时设置）
        // messageDiv.setAttribute('data-chat-idx', idx.toString());

        // 创建消息气泡容器（与 YiWeb 一致）
        const bubble = document.createElement('div')
        bubble.className = 'pet-chat-bubble'

        // 添加标识以便后续更新
        if (sender === 'pet') {
          bubble.setAttribute('data-message-type', 'pet-bubble')
        } else {
          bubble.setAttribute('data-message-type', 'user-bubble')
        }

        // 为消息保存原始文本用于复制和编辑功能
        if (text) {
          bubble.setAttribute('data-original-text', text)
        }

        // 添加图片（与 YiWeb 一致）
        if (imageDataUrl) {
          // 支持多图片（imageDataUrls）和单图片（imageDataUrl）
          const images = Array.isArray(imageDataUrl) ? imageDataUrl : [imageDataUrl]
          if (images.length > 1) {
            const imageContainer = document.createElement('div')
            imageContainer.className = 'pet-chat-images'
            images.forEach((imgSrc) => {
              const img = document.createElement('img')
              img.src = imgSrc
              img.className = 'pet-chat-image'
              img.alt = '图片消息'
              img.addEventListener('click', () => {
                this.showImagePreview(imgSrc)
              })
              imageContainer.appendChild(img)
            })
            bubble.appendChild(imageContainer)
          } else if (images.length === 1) {
            const img = document.createElement('img')
            img.src = images[0]
            img.className = 'pet-chat-image'
            img.alt = '图片消息'
            img.addEventListener('click', () => {
              this.showImagePreview(images[0])
            })
            bubble.appendChild(img)
          }
        }

        // 添加文本内容（与 YiWeb 一致）
        if (text && text.trim()) {
          const contentDiv = document.createElement('div')
          contentDiv.className = 'pet-chat-content md-preview-body markdown-content'

          // 渲染 Markdown
          const displayText = this.renderMarkdown(text)
          contentDiv.innerHTML = displayText
          if (typeof this.processTabs === 'function') this.processTabs(contentDiv)

          bubble.appendChild(contentDiv)

          // 处理 Mermaid 图表（异步处理，不阻塞渲染）
          if (!bubble.hasAttribute('data-mermaid-processing')) {
            bubble.setAttribute('data-mermaid-processing', 'true')
            setTimeout(async () => {
              try {
                await this.loadMermaid()
                // 检查 mermaid 代码块（code.language-mermaid）和已转换的 div.mermaid
                const hasMermaidCode = contentDiv.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"], div.mermaid')
                if (hasMermaidCode) {
                  await this.processMermaidBlocks(contentDiv)
                }
              } catch (error) {
                console.error('处理 Mermaid 图表时出错:', error)
              }
              bubble.removeAttribute('data-mermaid-processing')
            }, 100)
          }
        } else if (!imageDataUrl) {
          // 如果没有文本也没有图片，显示占位符（仅在流式生成时，与 YiWeb 一致）
          const typingDiv = document.createElement('div')
          typingDiv.className = 'pet-chat-typing'
          typingDiv.setAttribute('aria-label', '生成中')
          typingDiv.textContent = '...'
          bubble.appendChild(typingDiv)
        }

        // 创建元数据容器（与 YiWeb 一致）
        const meta = document.createElement('div')
        meta.className = 'pet-chat-meta'

        // 创建操作按钮容器
        const metaActions = document.createElement('div')
        metaActions.className = 'pet-chat-meta-actions'
        metaActions.setAttribute('data-copy-button-container', 'true')
        meta.appendChild(metaActions)

        // 创建时间元素
        const messageTime = document.createElement('time')
        messageTime.className = 'pet-chat-time'
        messageTime.setAttribute('data-message-time', 'true')
        const timeText = timestamp ? this.formatTimestamp(timestamp) : this.getCurrentTime()
        messageTime.textContent = timeText
        if (timestamp) {
          messageTime.setAttribute('datetime', new Date(timestamp).toISOString())
        }
        meta.appendChild(messageTime)

        // 将元数据添加到气泡
        bubble.appendChild(meta)

        // 将气泡添加到消息容器
        messageDiv.appendChild(bubble)

        // 为消息添加操作按钮（延迟添加，确保 DOM 已渲染）
        // 按钮现在由 ChatWindow.addActionButtonsToMessage 统一管理
        setTimeout(() => {
          // 通过 chatWindowComponent 添加按钮
          if (this.chatWindowComponent && typeof this.chatWindowComponent.addActionButtonsToMessage === 'function') {
            this.chatWindowComponent.addActionButtonsToMessage(messageDiv)
          }
        }, 0)

        return messageDiv
      }

      // 注意：消息操作按钮的创建逻辑已移至 ChatWindow.addActionButtonsToMessage 统一管理
      // 此方法已删除，请使用 chatWindowComponent.addActionButtonsToMessage

      // 删除消息（与 YiWeb 一致）
      async deleteMessage (messageDiv) {
        if (!messageDiv || !this.currentSessionId) return

        const session = this.sessions[this.currentSessionId]
        if (!session || !session.messages) return

        const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages')
        if (!messagesContainer) return

        const allMessages = Array.from(messagesContainer.children).filter(div => {
          return !div.hasAttribute('data-welcome-message') &&
                        (div.querySelector('[data-message-type="user-bubble"]') ||
                            div.querySelector('[data-message-type="pet-bubble"]'))
        })

        let index = typeof this.findMessageIndexByDiv === 'function'
          ? this.findMessageIndexByDiv(messageDiv)
          : -1
        if (index < 0) {
          index = allMessages.indexOf(messageDiv)
        }

        if (index < 0 || index >= session.messages.length) return

        // 删除消息（如果是用户消息，同时删除对应的宠物回复）
        const target = session.messages[index]
        const next = session.messages[index + 1]
        const shouldDeleteNext = target && target.type !== 'pet' && next && next.type === 'pet'

        if (shouldDeleteNext) {
          session.messages.splice(index, 2)
        } else {
          session.messages.splice(index, 1)
        }

        session.updatedAt = Date.now()

        // 动画删除消息
        messageDiv.classList.add('js-deleting')

        // 如果需要同时删除下一条宠物消息，也添加删除动画
        let nextMessageDiv = null
        if (shouldDeleteNext && index + 1 < allMessages.length) {
          nextMessageDiv = allMessages[index + 1]
          if (nextMessageDiv) {
            nextMessageDiv.classList.add('js-deleting')
          }
        }

        setTimeout(() => {
          messageDiv.remove()
          if (nextMessageDiv) {
            nextMessageDiv.remove()
          }
          // 保存会话
          this.saveCurrentSession().then(() => {
            if (this.syncSessionToBackend) {
              this.syncSessionToBackend(this.currentSessionId, true).catch(err => {
                console.error('删除消息后同步到后端失败:', err)
              })
            }
          }).catch(err => {
            console.error('删除消息后保存会话失败:', err)
          })
        }, 300)
      }

      // 重新发送消息（仅用户消息）
      // 滚动到指定索引的消息（与 YiWeb 保持一致，使用 ChatWindow 的方法）
      _scrollToMessageIndex (idx) {
        const i = Number(idx)
        if (!Number.isFinite(i) || i < 0) return
        if (this.chatWindowComponent && typeof this.chatWindowComponent.scrollToIndex === 'function') {
          this.chatWindowComponent.scrollToIndex(i)
        }
      }

      // 重新发送消息（与 YiWeb 保持一致，使用索引）
      async resendMessageAt (idx) {
        if (!this.currentSessionId) return

        const session = this.sessions[this.currentSessionId]
        if (!session || !Array.isArray(session.messages)) return

        const i = Number(idx)
        if (!Number.isFinite(i) || i < 0 || i >= session.messages.length) return

        const userMsg = session.messages[i]
        if (!userMsg || userMsg.type === 'pet') return

        const text = String(userMsg.content ?? userMsg.message ?? '').trim()
        const userTimestamp = Number(userMsg.timestamp)
        const images = (() => {
          const list = Array.isArray(userMsg.imageDataUrls) ? userMsg.imageDataUrls.filter(Boolean) : []
          const first = String(userMsg.imageDataUrl || '').trim()
          if (first) list.unshift(first)
          return Array.from(new Set(list)).slice(0, 4)
        })()
        if (!text && images.length === 0) return

        // 删除原消息
        session.messages.splice(i, 1)

        // 更新 DOM
        const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages')
        if (messagesContainer) {
          if (Number.isFinite(userTimestamp) && userTimestamp > 0) {
            const target = messagesContainer.querySelector(`[data-chat-timestamp="${userTimestamp}"][data-chat-type="user"]`)
            if (target) {
              target.remove()
            } else {
              const allMessages = Array.from(messagesContainer.children).filter(msg =>
                !msg.hasAttribute('data-welcome-message')
              )
              if (i < allMessages.length) {
                allMessages[i].remove()
              }
            }
          } else {
            const allMessages = Array.from(messagesContainer.children).filter(msg =>
              !msg.hasAttribute('data-welcome-message')
            )
            if (i < allMessages.length) {
              allMessages[i].remove()
            }
          }
        }

        // 保存会话
        session.updatedAt = Date.now()
        await this.saveAllSessions()
        if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
          await this.syncSessionToBackend(this.currentSessionId, true)
        }

        // 重新发送消息（通过设置输入框内容并发送）
        const chatWindowComponent = this.chatWindowComponent
        if (chatWindowComponent && chatWindowComponent.messageInput) {
          const textarea = chatWindowComponent.messageInput
          textarea.value = text

          // 设置图片
          if (images.length > 0 && chatWindowComponent.draftImages) {
            chatWindowComponent.draftImages = [...images]
            // 更新图片预览
            if (chatWindowComponent.updateDraftImagesDisplay) {
              chatWindowComponent.updateDraftImagesDisplay()
            }
          }

          // 触发输入事件以更新高度
          textarea.dispatchEvent(new Event('input', { bubbles: true }))

          // 发送消息
          if (typeof chatWindowComponent.sendMessage === 'function') {
            await chatWindowComponent.sendMessage()
          }
        }
      }

      // 重新生成消息（仅宠物消息）
      async regenerateMessage (messageDiv) {
        if (!messageDiv || !this.currentSessionId) return

        const session = this.sessions[this.currentSessionId]
        if (!session || !session.messages) return

        const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages')
        if (!messagesContainer) return

        let index = typeof this.findMessageIndexByDiv === 'function'
          ? this.findMessageIndexByDiv(messageDiv)
          : -1
        if (index < 0) {
          const allMessages = Array.from(messagesContainer.children).filter(msg =>
            !msg.hasAttribute('data-welcome-message')
          )
          index = allMessages.indexOf(messageDiv)
        }

        if (index < 0 || index >= session.messages.length) return

        // 找到对应的用户消息
        let userMessageIndex = index - 1
        while (userMessageIndex >= 0 && session.messages[userMessageIndex].type === 'pet') {
          userMessageIndex--
        }

        if (userMessageIndex < 0) return

        const userMessage = session.messages[userMessageIndex]
        const userContent = userMessage.content || ''
        const userImageDataUrl = userMessage.imageDataUrl || null

        // 删除当前的宠物回复
        session.messages.splice(index, 1)
        messageDiv.remove()

        // 重新发送用户消息以生成新的回复
        if (this.sendMessage) {
          await this.sendMessage(userContent, userImageDataUrl)
        }
      }

      // 为消息添加导出图片按钮
      addExportButtonForMessage (buttonContainer, messageDiv, messageType) {
        if (!buttonContainer || !messageDiv) {
          return
        }

        // 检查是否已经存在导出按钮
        if (buttonContainer.querySelector('.export-message-button')) {
          return
        }

        // 创建导出按钮
        const exportBtn = document.createElement('button')
        // 使用 SVG 图标替代 emoji，更专业美观
        exportBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `
        exportBtn.title = '导出消息为图片'
        exportBtn.className = 'pet-chat-meta-btn chat-message-action-btn'

        // 点击事件
        exportBtn.addEventListener('click', async (e) => {
          e.preventDefault()
          e.stopPropagation()

          // 调用导出函数
          if (window.exportSingleMessageToPNG) {
            await window.exportSingleMessageToPNG(messageDiv, messageType)
          } else {
            console.error('导出函数未加载')
            const exportError = (PET_CONFIG && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES)
              ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED
              : '导出功能未加载'
            this.showNotification(exportError, 'error')
          }
        })

        // 将按钮添加到容器中（在编辑按钮后面）
        buttonContainer.appendChild(exportBtn)
      }

      // 创建打字指示器（有趣的等待动画）
      createTypingIndicator () {
        const currentColor = this.colors[this.colorIndex]

        // 获取第一个聊天下面第一个按钮的图标
        let indicatorIcon = '🐾' // 默认图标
        if (this.chatWindow) {
          const welcomeActions = this.chatWindow.querySelector('#pet-welcome-actions')
          if (welcomeActions) {
            const firstButton = welcomeActions.querySelector('[data-action-key]')
            if (firstButton && firstButton.innerHTML) {
              indicatorIcon = firstButton.innerHTML.trim()
            }
          }
        }

        const messageDiv = document.createElement('div')
        messageDiv.setAttribute('data-typing-indicator', 'true')
        messageDiv.className = 'chat-message'

        const avatar = document.createElement('div')
        avatar.className = 'chat-message-typing-avatar'
        avatar.style.setProperty('background', currentColor, 'important')

        avatar.textContent = indicatorIcon
        avatar.setAttribute('data-message-type', 'pet-avatar')

        const content = document.createElement('div')
        content.className = 'chat-message-content'

        const messageText = document.createElement('div')
        messageText.className = 'chat-message-typing-bubble'
        messageText.style.setProperty('background', currentColor, 'important')

        messageText.setAttribute('data-message-type', 'pet-bubble')
        messageText.textContent = '💭 正在思考中...'

        const messageTime = document.createElement('div')
        messageTime.className = 'chat-message-typing-time'

        content.appendChild(messageText)
        content.appendChild(messageTime)
        messageDiv.appendChild(avatar)
        messageDiv.appendChild(content)

        return messageDiv
      }

      // 上移消息
      // 移动消息
      async _moveMessageBlock (idx, direction) {
        if (!this.currentSessionId) return

        const session = this.sessions[this.currentSessionId]
        if (!session || !Array.isArray(session.messages)) return

        const i = Number(idx)
        if (!Number.isFinite(i) || i < 0 || i >= session.messages.length) return

        if (String(direction) === 'up') {
          const nextMessages = [...session.messages]
          let newIndex

          if (i <= 0) {
            // 如果是第一条消息，移到末尾（循环移动）
            const msg = nextMessages.splice(i, 1)[0]
            nextMessages.push(msg)
            newIndex = nextMessages.length - 1
          } else {
            // 正常上移
            const tmp = nextMessages[i - 1]
            nextMessages[i - 1] = nextMessages[i]
            nextMessages[i] = tmp
            newIndex = i - 1
          }

          session.messages = nextMessages
          session.updatedAt = Date.now()
          session.lastAccessTime = Date.now()

          // 更新 DOM
          const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages')
          if (messagesContainer) {
            const allMessages = Array.from(messagesContainer.children).filter(msg =>
              !msg.hasAttribute('data-welcome-message')
            )
            if (i >= 0 && i < allMessages.length) {
              const currentMsg = allMessages[i]
              if (i <= 0) {
                // 移到末尾
                messagesContainer.appendChild(currentMsg)
              } else {
                // 正常上移
                const previousMsg = allMessages[i - 1]
                messagesContainer.insertBefore(currentMsg, previousMsg)
              }

              // 更新 data-chat-idx 属性
              Array.from(messagesContainer.children)
                .filter(msg => !msg.hasAttribute('data-welcome-message'))
                .forEach((msg, idx) => {
                  msg.setAttribute('data-chat-idx', idx.toString())
                })
            }
          }

          // 保存会话
          await this.saveAllSessions()
          if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            await this.syncSessionToBackend(this.currentSessionId, true)
          }

          // 滚动到新位置
          this._scrollToMessageIndex(newIndex)
          return
        }

        if (String(direction) === 'down') {
          const nextMessages = [...session.messages]
          let newIndex

          if (i >= session.messages.length - 1) {
            // 如果是最后一条消息，移到开头（循环移动）
            const msg = nextMessages.splice(i, 1)[0]
            nextMessages.unshift(msg)
            newIndex = 0
          } else {
            // 正常下移
            const tmp = nextMessages[i + 1]
            nextMessages[i + 1] = nextMessages[i]
            nextMessages[i] = tmp
            newIndex = i + 1
          }

          session.messages = nextMessages
          session.updatedAt = Date.now()
          session.lastAccessTime = Date.now()

          // 更新 DOM
          const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages')
          if (messagesContainer) {
            const allMessages = Array.from(messagesContainer.children).filter(msg =>
              !msg.hasAttribute('data-welcome-message')
            )
            if (i >= 0 && i < allMessages.length) {
              const currentMsg = allMessages[i]
              if (i >= allMessages.length - 1) {
                // 移到开头
                const firstMsg = messagesContainer.querySelector('.pet-chat-message:not([data-welcome-message])')
                if (firstMsg) {
                  messagesContainer.insertBefore(currentMsg, firstMsg)
                } else {
                  messagesContainer.insertBefore(currentMsg, messagesContainer.firstChild)
                }
              } else {
                // 正常下移
                const nextMsg = allMessages[i + 1]
                if (nextMsg.nextSibling) {
                  messagesContainer.insertBefore(currentMsg, nextMsg.nextSibling)
                } else {
                  messagesContainer.appendChild(currentMsg)
                }
              }

              // 更新 data-chat-idx 属性
              Array.from(messagesContainer.children)
                .filter(msg => !msg.hasAttribute('data-welcome-message'))
                .forEach((msg, idx) => {
                  msg.setAttribute('data-chat-idx', idx.toString())
                })
            }
          }

          // 保存会话
          await this.saveAllSessions()
          if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            await this.syncSessionToBackend(this.currentSessionId, true)
          }

          // 滚动到新位置
          this._scrollToMessageIndex(newIndex)
        }
      }

      // 上移消息（与 YiWeb 保持一致，使用索引）
      async moveMessageUpAt (idx) {
        await this._moveMessageBlock(idx, 'up')
      }

      // 下移消息（与 YiWeb 保持一致，使用索引）
      async moveMessageDownAt (idx) {
        await this._moveMessageBlock(idx, 'down')
      }

      // 更新所有消息的排序按钮状态
      updateAllSortButtons () {
        const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages')
        if (!messagesContainer) return

        // 获取所有消息元素（排除欢迎消息）
        const allMessages = Array.from(messagesContainer.children).filter(msg =>
          !msg.hasAttribute('data-welcome-message')
        )

        allMessages.forEach((messageDiv, index) => {
          const copyButtonContainer = messageDiv.querySelector('[data-copy-button-container]')
          if (!copyButtonContainer) return

          const sortUpButton = copyButtonContainer.querySelector('.sort-up-button')
          const sortDownButton = copyButtonContainer.querySelector('.sort-down-button')

          if (sortUpButton) {
            sortUpButton.classList.remove('chat-message-sort-btn--disabled')
          }

          if (sortDownButton) {
            sortDownButton.classList.remove('chat-message-sort-btn--disabled')
          }
        })
      }

      // 媒体处理功能已迁移至 petManager.media.js

      // 获取当前时间
      // 获取页面图标URL（辅助方法）
      getPageIconUrl () {
        let iconUrl = ''
        const linkTags = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
        if (linkTags.length > 0) {
          iconUrl = linkTags[0].href
          if (!iconUrl.startsWith('http')) {
            iconUrl = new URL(iconUrl, window.location.origin).href
          }
        }
        if (!iconUrl) {
          iconUrl = '/favicon.ico'
          if (!iconUrl.startsWith('http')) {
            iconUrl = new URL(iconUrl, window.location.origin).href
          }
        }
        return iconUrl
      }
    } // 结束 PetManager 类

    // 将 PetManager 赋值给 window，防止重复声明
    window.PetManager = PetManager
  } catch (error) {
    console.error('[PetManager.core] 初始化失败:', error)
    console.error('[PetManager.core] 错误堆栈:', error.stack)
  }
})() // 结束立即执行函数
