/**
 * PetManager - 消息处理相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  const proto = window.PetManager.prototype

  // 提取媒体URL（图片和视频）
  proto.extractMediaUrls = function (text) {
    const images = []
    const videos = []
    let cleanedText = text || ''

    if (!text || typeof text !== 'string') {
      return { images, videos, cleanedText }
    }

    // 提取 data URL 格式的图片（data:image/...）
    const dataImageRegex = /data:image\/[^;]+;base64,[^\s"'<>]+/gi
    const dataImageMatches = text.match(dataImageRegex)
    if (dataImageMatches) {
      images.push(...dataImageMatches)
      // 从文本中移除这些 data URL
      dataImageMatches.forEach(url => {
        cleanedText = cleanedText.replace(url, '')
      })
    }

    // 提取普通 URL 格式的图片（http:// 或 https:// 结尾是图片扩展名）
    const imageUrlRegex = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s"'<>]*)?/gi
    const imageUrlMatches = text.match(imageUrlRegex)
    if (imageUrlMatches) {
      imageUrlMatches.forEach(url => {
        if (!images.includes(url)) {
          images.push(url)
        }
        // 从文本中移除这些 URL
        cleanedText = cleanedText.replace(url, '')
      })
    }

    // 提取视频 URL（http:// 或 https:// 结尾是视频扩展名）
    const videoUrlRegex = /https?:\/\/[^\s"'<>]+\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)(\?[^\s"'<>]*)?/gi
    const videoUrlMatches = text.match(videoUrlRegex)
    if (videoUrlMatches) {
      videos.push(...videoUrlMatches)
      // 从文本中移除这些 URL
      videoUrlMatches.forEach(url => {
        cleanedText = cleanedText.replace(url, '')
      })
    }

    // 提取 data URL 格式的视频（data:video/...）
    const dataVideoRegex = /data:video\/[^;]+;base64,[^\s"'<>]+/gi
    const dataVideoMatches = text.match(dataVideoRegex)
    if (dataVideoMatches) {
      videos.push(...dataVideoMatches)
      // 从文本中移除这些 data URL
      dataVideoMatches.forEach(url => {
        cleanedText = cleanedText.replace(url, '')
      })
    }

    // 清理多余的空白字符
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim()

    return { images, videos, cleanedText }
  }

  // 从消息 DOM 元素找到对应的消息索引（更准确的方法）
  proto.findMessageIndexByDiv = function (messageDiv) {
    if (!messageDiv || !this.currentSessionId || !this.sessions[this.currentSessionId]) {
      return -1
    }

    const session = this.sessions[this.currentSessionId]
    if (!session.messages || !Array.isArray(session.messages)) {
      return -1
    }

    const timestampAttr = messageDiv.getAttribute('data-chat-timestamp')
    const messageTimestamp = timestampAttr ? Number(timestampAttr) : NaN
    if (Number.isFinite(messageTimestamp) && messageTimestamp > 0) {
      const chatType = messageDiv.getAttribute('data-chat-type')
      const messageType = chatType === 'pet' ? 'pet' : (chatType === 'user' ? 'user' : null)
      for (let i = session.messages.length - 1; i >= 0; i--) {
        const msg = session.messages[i]
        if (!msg) continue
        if (Number(msg.timestamp) === messageTimestamp && (!messageType || msg.type === messageType)) {
          return i
        }
      }
    }

    // 获取消息容器
    const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages')
    if (!messagesContainer) {
      return -1
    }

    // 获取所有消息DOM元素（排除欢迎消息）
    const allMessageDivs = Array.from(messagesContainer.children).filter(div => {
      // 排除欢迎消息和其他非消息元素
      return !div.hasAttribute('data-welcome-message') &&
                   (div.querySelector('[data-message-type="user-bubble"]') ||
                    div.querySelector('[data-message-type="pet-bubble"]'))
    })

    // 找到当前消息在DOM中的索引
    const domIndex = allMessageDivs.indexOf(messageDiv)
    if (domIndex < 0) {
      return -1
    }

    // DOM中的消息顺序应该与session.messages数组顺序一致
    // 但需要排除欢迎消息，所以直接使用domIndex
    if (domIndex >= 0 && domIndex < session.messages.length) {
      return domIndex
    }

    return -1
  }

  // 从消息 DOM 元素找到对应的消息对象
  proto.findMessageObjectByDiv = function (messageDiv) {
    if (!messageDiv || !this.currentSessionId || !this.sessions[this.currentSessionId]) {
      return null
    }

    const session = this.sessions[this.currentSessionId]
    if (!session.messages || !Array.isArray(session.messages)) {
      return null
    }

    // 首先尝试通过索引匹配（更准确）
    const messageIndex = this.findMessageIndexByDiv(messageDiv)
    if (messageIndex >= 0 && messageIndex < session.messages.length) {
      const msg = session.messages[messageIndex]
      // 验证消息类型是否匹配
      const isUserMessage = messageDiv.querySelector('[data-message-type="user-bubble"]')
      const messageType = isUserMessage ? 'user' : 'pet'
      if (msg && msg.type === messageType) {
        return { message: msg, index: messageIndex }
      }
    }

    return null
  }

  proto.escapeHtml = function (text) {
    return window.MarkdownRenderer.escapeHtml(text)
  }

  // 渲染 Markdown（委托给 MarkdownRenderer 组件）
  proto.renderMarkdown = function (markdown) {
    return window.MarkdownRenderer.render(markdown)
  }

  proto.processTabs = function (container) {
    const root = container && container.nodeType === Node.ELEMENT_NODE ? container : null
    if (!root || typeof root.querySelectorAll !== 'function') return

    const tabsEls = Array.from(root.querySelectorAll('.pet-tabs'))
    tabsEls.forEach((tabsEl) => {
      if (!tabsEl || tabsEl.__petTabsBound) return
      const nav = tabsEl.querySelector('.pet-tabs__nav')
      const panelsWrap = tabsEl.querySelector('.pet-tabs__panels')
      if (!nav || !panelsWrap) return
      const tabButtons = Array.from(nav.querySelectorAll('.pet-tabs__tab'))
      const panels = Array.from(panelsWrap.querySelectorAll('.pet-tabs__panel'))
      if (!tabButtons.length || !panels.length) return

      const activate = (index) => {
        const idx = Math.max(0, Math.min(index, Math.min(tabButtons.length, panels.length) - 1))
        tabButtons.forEach((btn, i) => {
          btn.classList.toggle('is-active', i === idx)
        })
        panels.forEach((panel, i) => {
          panel.classList.toggle('is-active', i === idx)
        })
      }

      let initial = tabButtons.findIndex((btn) => btn.classList.contains('is-active'))
      if (initial < 0) initial = 0
      activate(initial)

      tabButtons.forEach((btn, i) => {
        btn.addEventListener('click', (e) => {
          if (e && typeof e.preventDefault === 'function') e.preventDefault()
          activate(i)
        })
      })
      tabsEl.__petTabsBound = true
    })
  }

  // 渲染 Markdown 并处理 Mermaid（完整流程）
  proto.renderMarkdownWithMermaid = async function (markdown, container) {
    // 先渲染 Markdown
    const html = this.renderMarkdown(markdown)

    // 如果提供了容器，处理其中的 Mermaid 代码块
    if (container) {
      // 需要等待 DOM 更新后再处理
      setTimeout(async () => {
        await this.processMermaidBlocks(container)
        if (typeof this.processTabs === 'function') this.processTabs(container)
      }, 100)
    }

    return html
  }
})()
