/**
 * Mermaid 渲染核心模块
 * 负责 Mermaid CDN 加载、图表渲染核心逻辑
 */
(function (global) {
  const proto = global.PetManager.prototype
  const logger = (typeof window !== 'undefined' && window.LoggerUtils && typeof window.LoggerUtils.getLogger === 'function')
    ? window.LoggerUtils.getLogger('mermaid')
    : console

  // 加载 Mermaid.js (CDN)
  proto.loadMermaid = async function () {
    if (this.mermaidLoaded || this.mermaidLoading) {
      return this.mermaidLoaded
    }

    this.mermaidLoading = true

    return new Promise((resolve, reject) => {
      // 检查是否已经加载（从 content_scripts 自动加载或之前动态加载）
      const mermaidLib = (typeof mermaid !== 'undefined')
        ? mermaid
        : (typeof window !== 'undefined' && window.mermaid) ? window.mermaid : null

      if (mermaidLib && typeof mermaidLib.initialize === 'function') {
        try {
          // 初始化 mermaid
          mermaidLib.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            // 优化自适应配置
            flowchart: {
              useMaxWidth: false, // 不使用最大宽度限制，让图表根据内容自适应
              htmlLabels: true,
              wrap: false // 不自动换行，保持原始布局
            },
            // 其他图表类型也优化自适应
            sequence: {
              useMaxWidth: false,
              wrap: false
            },
            gantt: {
              useMaxWidth: false
            },
            class: {
              useMaxWidth: false
            },
            state: {
              useMaxWidth: false
            },
            pie: {
              useMaxWidth: false
            }
          })
          this.mermaidLoaded = true
          this.mermaidLoading = false
          logger.info('Mermaid.js 已加载并初始化')
          resolve(true)
          return
        } catch (error) {
          logger.error('初始化 Mermaid 失败:', error)
          this.mermaidLoading = false
          reject(error)
          return
        }
      }

      // 使用注入脚本在页面上下文中加载 mermaid
      // 这样可以确保 mermaid 在页面的 window 对象中可用
      const scriptUrl = chrome.runtime.getURL('libs/mermaid.min.js')
      const loadScriptUrl = chrome.runtime.getURL('modules/mermaid/page/load-mermaid.js')
      logger.debug('尝试在页面上下文中加载 Mermaid.js，URL:', scriptUrl)
      const DomHelper = window.DomHelper
      if (!DomHelper || typeof DomHelper.runPageScriptWithData !== 'function') {
        this.mermaidLoading = false
        reject(new Error('DomHelper 不可用，无法加载 Mermaid'))
        return
      }

      DomHelper.runPageScriptWithData({
        scriptSrc: loadScriptUrl,
        dataContainerId: '__mermaid_url_container__',
        dataAttributes: {
          'data-mermaid-url': scriptUrl
        },
        successEvent: 'mermaid-loaded',
        errorEvent: 'mermaid-error',
        timeoutMs: 30000,
        cleanupDelayMs: 1000
      }).then(() => {
        logger.debug('[Content] 收到 Mermaid 加载完成事件')
        this.mermaidLoaded = true
        this.mermaidLoading = false
        logger.info('[Content] Mermaid.js 在页面上下文中已加载')
        resolve(true)
      }).catch((eventOrError) => {
        logger.error('[Content] 收到 Mermaid 加载失败事件', eventOrError)
        this.mermaidLoading = false
        const errorMsg = (eventOrError && eventOrError.detail && eventOrError.detail.error)
          ? eventOrError.detail.error
          : (eventOrError && eventOrError.message ? eventOrError.message : '页面上下文中的 Mermaid.js 加载失败')
        reject(new Error(errorMsg))
      })
    })
  }

  // 处理 Markdown 中的 Mermaid 代码块
  proto.processMermaidBlocks = async function (container) {
    if (!container) return

    // 检查是否需要加载 mermaid - 更全面的选择器
    // 1. 查找 code.language-mermaid（原始代码块）
    // 2. 查找已转换为 div.mermaid 的元素（renderMarkdown 转换后的）
    const mermaidCodeBlocks = container.querySelectorAll('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]')
    const mermaidDivs = container.querySelectorAll('div.mermaid:not([data-mermaid-rendered])')

    // 合并两种类型的元素
    const allMermaidElements = [...Array.from(mermaidCodeBlocks), ...Array.from(mermaidDivs)]

    if (allMermaidElements.length === 0) return

    // 过滤掉已经处理过的块
    const unprocessedBlocks = allMermaidElements.filter(element => {
      // 如果是 div.mermaid，检查是否已渲染
      if (element.tagName === 'DIV' && element.classList.contains('mermaid')) {
        // 如果已经有 SVG 子元素，说明已经渲染过
        if (element.querySelector('svg')) {
          return false
        }
        // 如果已标记为已成功渲染（值为 "true"），跳过
        const rendered = element.getAttribute('data-mermaid-rendered')
        if (rendered === 'true') {
          return false
        }
        // 如果值为 "false" 或没有属性，说明需要处理（可能是首次处理或之前处理失败）
        return true
      }

      // 如果是 code 元素，检查是否已处理
      if (element.tagName === 'CODE') {
        const preElement = element.parentElement
        if (preElement && preElement.tagName === 'PRE') {
          // 如果父元素的下一个兄弟元素是 mermaid div，说明已经处理过
          const nextSibling = preElement.nextElementSibling
          if (nextSibling && nextSibling.classList.contains('mermaid')) {
            return false
          }
          // 检查是否有处理标记
          if (element.classList.contains('mermaid-processed')) {
            return false
          }
        }
        return true
      }

      return true
    })

    if (unprocessedBlocks.length === 0) return

    // 加载 mermaid（如果需要）
    const mermaidAvailable = await this.loadMermaid().catch(() => false)
    if (!mermaidAvailable) {
      logger.warn('Mermaid.js 未加载，无法渲染图表')
      return
    }

    // 处理每个未处理的 mermaid 代码块
    unprocessedBlocks.forEach((element, index) => {
      const mermaidId = `mermaid-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
      let mermaidDiv = null
      let mermaidContent = ''

      // 如果已经是 div.mermaid，直接使用
      if (element.tagName === 'DIV' && element.classList.contains('mermaid')) {
        mermaidDiv = element
        mermaidContent = element.textContent || element.innerText || ''

        // 确保有 ID
        if (!mermaidDiv.id) {
          mermaidDiv.id = mermaidId
        } else {
          mermaidId = mermaidDiv.id
        }

        // 保存源代码（如果还没有）
        if (!mermaidDiv.hasAttribute('data-mermaid-source')) {
          mermaidDiv.setAttribute('data-mermaid-source', mermaidContent)
        }

        // 确保样式正确（使用 CSS 类，样式已在 content.css 中定义）
        // 添加自适应容器样式
        if (!mermaidDiv.classList.contains('mermaid-container')) {
          mermaidDiv.classList.add('mermaid-container')
        }
        mermaidDiv.style.display = 'inline-block'
        mermaidDiv.style.width = 'auto'
        mermaidDiv.style.height = 'auto'
        mermaidDiv.style.minWidth = '0'
        mermaidDiv.style.minHeight = '0'
      } else if (element.tagName === 'CODE') {
        // 如果是 code 元素，需要替换为 div
        const preElement = element.parentElement
        if (preElement && preElement.tagName === 'PRE') {
          mermaidContent = element.textContent || element.innerText || ''

          if (!mermaidContent.trim()) {
            return // 跳过空内容
          }

          // 创建 mermaid 容器（样式已通过 CSS 类定义）
          mermaidDiv = document.createElement('div')
          mermaidDiv.className = 'mermaid mermaid-container'
          mermaidDiv.id = mermaidId
          mermaidDiv.textContent = mermaidContent
          // 保存源代码以便后续复制功能使用
          mermaidDiv.setAttribute('data-mermaid-source', mermaidContent)
          // 添加自适应容器样式
          mermaidDiv.style.display = 'inline-block'
          mermaidDiv.style.width = 'auto'
          mermaidDiv.style.height = 'auto'
          mermaidDiv.style.minWidth = '0'
          mermaidDiv.style.minHeight = '0'

          // 标记为已处理
          element.classList.add('mermaid-processed')

          // 替换代码块
          try {
            preElement.parentNode.replaceChild(mermaidDiv, preElement)
          } catch (error) {
            logger.error('替换 Mermaid 代码块时出错:', error)
            return
          }
        } else {
          return // 如果不是在 pre 中，跳过
        }
      } else {
        return // 未知类型，跳过
      }

      if (!mermaidContent.trim()) {
        return // 跳过空内容
      }

      // 继续处理渲染逻辑
      try {
        // 标记为正在处理（避免重复处理）
        mermaidDiv.setAttribute('data-mermaid-rendered', 'false')

        // 渲染 mermaid 图表 - 使用页面上下文中的 mermaid
        // 因为 mermaid 在页面上下文中，我们需要通过注入脚本执行渲染
        const DomHelper = window.DomHelper
        if (!DomHelper || typeof DomHelper.runPageScriptWithData !== 'function') {
          throw new Error('DomHelper 不可用，无法渲染 Mermaid')
        }

        // 延迟加载渲染脚本，确保 mermaid div 已经添加到 DOM 且事件监听器已设置
        // 增加延迟时间，确保 DOM 完全更新
        setTimeout(() => {
          // 再次检查 mermaid div 是否存在（确保 DOM 已更新）
          const checkDiv = document.getElementById(mermaidId)
          if (!checkDiv) {
            logger.warn('[ProcessMermaid] mermaid div 尚未准备好，延迟渲染:', mermaidId)
            // 如果还没准备好，再等一会
            setTimeout(() => {
              DomHelper.runPageScriptWithData({
                scriptSrc: chrome.runtime.getURL('modules/mermaid/page/render-mermaid.js'),
                dataContainerId: `__mermaid_render_id_container__${mermaidId}`,
                dataAttributes: { 'data-mermaid-id': mermaidId },
                successEvent: 'mermaid-rendered',
                timeoutMs: 15000,
                cleanupDelayMs: 3000,
                isSuccess: (e) => e && e.detail && e.detail.id === mermaidId
              }).then((event) => {
                if (!event.detail.success) {
                  const errorDiv = document.createElement('div')
                  errorDiv.className = 'mermaid-error'
                  errorDiv.innerHTML = `
                                        <div>❌ Mermaid 图表渲染失败</div>
                                        <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                                    `
                  if (mermaidDiv.parentNode) {
                    mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv)
                  }
                } else {
                  mermaidDiv.setAttribute('data-mermaid-rendered', 'true')
                  setTimeout(() => {
                    this.addMermaidActions(mermaidDiv, event.detail.svgContent || '', mermaidContent)
                  }, 100)
                }
              }).catch((error) => {
                logger.warn('[ProcessMermaid] Mermaid 渲染失败:', error)
              })
            }, 150)
            return
          }

          DomHelper.runPageScriptWithData({
            scriptSrc: chrome.runtime.getURL('modules/mermaid/page/render-mermaid.js'),
            dataContainerId: `__mermaid_render_id_container__${mermaidId}`,
            dataAttributes: { 'data-mermaid-id': mermaidId },
            successEvent: 'mermaid-rendered',
            timeoutMs: 15000,
            cleanupDelayMs: 3000,
            isSuccess: (e) => e && e.detail && e.detail.id === mermaidId
          }).then((event) => {
            if (!event.detail.success) {
              const errorDiv = document.createElement('div')
              errorDiv.className = 'mermaid-error'
              errorDiv.innerHTML = `
                                <div>❌ Mermaid 图表渲染失败</div>
                                <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                            `
              if (mermaidDiv.parentNode) {
                mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv)
              }
            } else {
              mermaidDiv.setAttribute('data-mermaid-rendered', 'true')
              setTimeout(() => {
                this.addMermaidActions(mermaidDiv, event.detail.svgContent || '', mermaidContent)
              }, 100)
            }
          }).catch((error) => {
            logger.warn('[ProcessMermaid] Mermaid 渲染失败:', error)
          })
        }, 200)
      } catch (error) {
        logger.error('处理 Mermaid 代码块时出错:', error)
        // 出错时显示错误信息，但保留原始代码
        const errorDiv = document.createElement('div')
        errorDiv.className = 'mermaid-error'
        // 样式已通过 CSS 类定义
        errorDiv.innerHTML = `
                        <div>❌ Mermaid 图表渲染失败</div>
                        <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                    `
        if (mermaidDiv && mermaidDiv.parentNode) {
          mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv)
        }
      }
    })
  }

  // 渲染 Markdown 为 HTML（使用 petManager.message.js 中的实现，确保 mermaid 处理一致）
  proto.renderMarkdown = function (markdown) {
    if (!markdown) return ''

    try {
      // 检查 marked 是否可用
      if (typeof marked !== 'undefined') {
        // 创建自定义渲染器（与 petManager.message.js 保持一致）
        const renderer = new marked.Renderer()

        // 覆盖 link 渲染（安全处理）
        renderer.link = (href, title, text) => {
          let resolvedHref = href
          let resolvedTitle = title
          let resolvedText = text
          if (href && typeof href === 'object') {
            resolvedHref = href.href
            resolvedTitle = href.title
            resolvedText = href.text
          }

          const safeHref = this._sanitizeUrl ? this._sanitizeUrl(resolvedHref) : resolvedHref
          const safeText = resolvedText || ''
          if (!safeHref) return safeText
          const safeTitle = resolvedTitle ? ` title="${this.escapeHtml(resolvedTitle)}"` : ''
          return `<a href="${this.escapeHtml(safeHref)}"${safeTitle} target="_blank" rel="noopener noreferrer">${safeText}</a>`
        }

        // 覆盖 image 渲染（安全处理）
        renderer.image = (href, title, text) => {
          let resolvedHref = href
          let resolvedTitle = title
          let resolvedAlt = text
          if (href && typeof href === 'object') {
            resolvedHref = href.href
            resolvedTitle = href.title
            resolvedAlt = href.text
          }

          const safeHref = this._sanitizeImageSrc
            ? this._sanitizeImageSrc(resolvedHref)
            : (this._sanitizeUrl ? this._sanitizeUrl(resolvedHref) : resolvedHref)
          const alt = this.escapeHtml(resolvedAlt || '')
          if (!safeHref) return alt
          const safeTitle = resolvedTitle ? ` title="${this.escapeHtml(resolvedTitle)}"` : ''
          return `<img src="${this.escapeHtml(safeHref)}" alt="${alt}" loading="lazy"${safeTitle} />`
        }

        // 覆盖 html 渲染（安全渲染 HTML）
        renderer.html = (token) => {
          return (typeof token === 'string')
            ? token
            : (token && (token.raw || token.text)) || ''
        }

        // 覆盖 code 渲染（处理 mermaid）- 关键：将 mermaid 转换为 div.mermaid
        renderer.code = (code, language, isEscaped) => {
          let resolvedCode = code
          let resolvedLang = language
          if (code && typeof code === 'object') {
            resolvedCode = code.text
            resolvedLang = code.lang
          }

          const lang = (resolvedLang || '').trim().toLowerCase()
          if (lang === 'mermaid' || lang === 'mmd') {
            return `<div class="mermaid">${resolvedCode || ''}</div>`
          }
          const escaped = this.escapeHtml(String(resolvedCode || ''))
          const classAttr = lang ? ` class="language-${this.escapeHtml(lang)}"` : ''
          return `<pre><code${classAttr}>${escaped}</code></pre>`
        }

        // 配置 marked
        marked.setOptions({
          renderer,
          breaks: true, // 支持换行
          gfm: true, // GitHub Flavored Markdown
          sanitize: false // 允许 HTML，但我们会通过手动处理确保安全
        })
        const rendered = marked.parse(markdown)
        if (typeof this._sanitizeMarkdownHtml === 'function') {
          return this._sanitizeMarkdownHtml(rendered)
        }
        return rendered
      } else {
        // 如果 marked 不可用，返回转义的纯文本
        return this.escapeHtml(markdown)
      }
    } catch (error) {
      logger.error('渲染 Markdown 失败:', error)
      return this.escapeHtml(markdown)
    }
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

  // URL 净化辅助函数（与 petManager.message.js 保持一致）
  proto._sanitizeUrl = function (url) {
    if (!url) return ''
    try {
      const prot = decodeURIComponent(url)
        .replace(/[^A-Za-z0-9/:]/g, '')
        .toLowerCase()
      if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
        return ''
      }
    } catch (e) {
      return ''
    }
    return url
  }

  // HTML 转义辅助函数（使用 DomHelper，保留兼容性）
  proto.escapeHtml = function (text) {
    if (typeof DomHelper !== 'undefined' && typeof DomHelper.escapeHtml === 'function') {
      return DomHelper.escapeHtml(text)
    }
    // 降级实现
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  if (typeof proto._isSafeCssColor !== 'function') {
    proto._isSafeCssColor = function (color) {
      if (!color || typeof color !== 'string') return false
      const value = color.trim()
      if (!value || value.length > 48) return false
      if (/^#[0-9a-fA-F]{3}$/.test(value) || /^#[0-9a-fA-F]{6}$/.test(value)) return true
      if (/^[a-zA-Z]+$/.test(value)) return true
      const rgbMatch = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
      if (rgbMatch) {
        const r = Number(rgbMatch[1])
        const g = Number(rgbMatch[2])
        const b = Number(rgbMatch[3])
        return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255
      }
      const rgbaMatch = value.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i)
      if (rgbaMatch) {
        const r = Number(rgbaMatch[1])
        const g = Number(rgbaMatch[2])
        const b = Number(rgbaMatch[3])
        const a = Number(rgbaMatch[4])
        return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255 && a >= 0 && a <= 1
      }
      return false
    }
  }

  if (typeof proto._isSafeCssLength !== 'function') {
    proto._isSafeCssLength = function (value) {
      if (!value || typeof value !== 'string') return false
      const v = value.trim()
      if (/^-?0+(?:\.0+)?$/.test(v)) return true
      const m = v.match(/^(-?\d+(?:\.\d+)?)(px|em|rem|%|vh|vw)$/i)
      if (!m) return false
      const num = Number(m[1])
      if (!Number.isFinite(num)) return false
      return num >= -2000 && num <= 2000
    }
  }

  if (typeof proto._sanitizeClassName !== 'function') {
    proto._sanitizeClassName = function (className) {
      if (!className || typeof className !== 'string') return ''
      const cleaned = className.replace(/[^a-zA-Z0-9 _-]/g, ' ').replace(/\s+/g, ' ').trim()
      return cleaned.length > 128 ? cleaned.slice(0, 128).trim() : cleaned
    }
  }

  if (typeof proto._sanitizeStyleText !== 'function') {
    proto._sanitizeStyleText = function (styleText) {
      if (!styleText || typeof styleText !== 'string') return ''
      const text = styleText.trim()
      if (!text) return ''
      const lowered = text.toLowerCase()
      if (lowered.includes('expression(') || lowered.includes('javascript:') || lowered.includes('vbscript:') || lowered.includes('url(')) {
        return ''
      }

      const allowedProps = new Set([
        'color',
        'background-color',
        'font-weight',
        'font-style',
        'text-decoration',
        'font-size',
        'line-height',
        'font-family',
        'text-align',
        'white-space',
        'word-break',
        'overflow',
        'overflow-x',
        'overflow-y',
        'max-width',
        'min-width',
        'width',
        'height',
        'max-height',
        'padding',
        'padding-left',
        'padding-right',
        'padding-top',
        'padding-bottom',
        'margin',
        'margin-left',
        'margin-right',
        'margin-top',
        'margin-bottom',
        'border',
        'border-radius',
        'border-color',
        'border-width',
        'border-style',
        'display',
        'content',
        'position',
        'top',
        'right',
        'bottom',
        'left',
        'inset',
        'z-index',
        'opacity',
        'transform',
        'pointer-events'
      ])

      const safeDecls = []
      const parts = text.split(';')
      for (const part of parts) {
        const p = part.trim()
        if (!p) continue
        const idx = p.indexOf(':')
        if (idx <= 0) continue
        const prop = p.slice(0, idx).trim().toLowerCase()
        let value = p.slice(idx + 1).trim()
        if (!allowedProps.has(prop)) continue
        const hasImportant = /\s*!important\s*$/i.test(value)
        if (hasImportant) {
          value = value.replace(/\s*!important\s*$/i, '').trim()
          if (!value) continue
        }
        if (/\!important/i.test(value)) continue

        if (prop === 'color' || prop === 'background-color' || prop === 'border-color') {
          if (!this._isSafeCssColor(value)) continue
          safeDecls.push(`${prop}:${value}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'font-weight') {
          const v = value.toLowerCase()
          if (v === 'normal' || v === 'bold' || v === 'bolder' || v === 'lighter' || /^\d{3}$/.test(v)) {
            safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          }
          continue
        }

        if (prop === 'font-style') {
          const v = value.toLowerCase()
          if (v === 'normal' || v === 'italic' || v === 'oblique') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'text-decoration') {
          const v = value.toLowerCase()
          if (v === 'none' || v === 'underline' || v === 'line-through') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'text-align') {
          const v = value.toLowerCase()
          if (v === 'left' || v === 'right' || v === 'center' || v === 'justify') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'white-space') {
          const v = value.toLowerCase()
          if (v === 'normal' || v === 'nowrap' || v === 'pre' || v === 'pre-wrap' || v === 'pre-line') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'word-break') {
          const v = value.toLowerCase()
          if (v === 'normal' || v === 'break-all' || v === 'keep-all' || v === 'break-word') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'overflow' || prop === 'overflow-x' || prop === 'overflow-y') {
          const v = value.toLowerCase()
          if (v === 'visible' || v === 'hidden' || v === 'scroll' || v === 'auto') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'display') {
          const v = value.toLowerCase()
          if (v === 'inline' || v === 'block' || v === 'inline-block' || v === 'flex' || v === 'inline-flex' || v === 'none') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'content') {
          const v = value.trim()
          const lowerV = v.toLowerCase()
          if (lowerV === 'none' || lowerV === 'normal' || lowerV === 'open-quote' || lowerV === 'close-quote' || lowerV === 'no-open-quote' || lowerV === 'no-close-quote') {
            safeDecls.push(`${prop}:${lowerV}${hasImportant ? ' !important' : ''}`)
            continue
          }
          if (/^(['"])(?:\\.|(?!\1)[^\\\n\r])*?\1$/.test(v) && v.length <= 120) {
            safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
            continue
          }
          continue
        }

        if (prop === 'position') {
          const v = value.toLowerCase()
          if (!(v === 'static' || v === 'relative' || v === 'absolute' || v === 'sticky')) continue
          safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'top' || prop === 'right' || prop === 'bottom' || prop === 'left') {
          const v = value.toLowerCase()
          if (!(v === 'auto' || this._isSafeCssLength(v))) continue
          safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'inset') {
          const tokens = value.split(/\s+/).filter(Boolean).map(t => t.toLowerCase())
          if (tokens.length < 1 || tokens.length > 4) continue
          if (!tokens.every(t => t === 'auto' || this._isSafeCssLength(t))) continue
          safeDecls.push(`${prop}:${tokens.join(' ')}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'z-index') {
          const v = value.trim()
          if (!/^-?\d{1,5}$/.test(v)) continue
          const num = Number(v)
          if (!Number.isFinite(num) || num < -9999 || num > 9999) continue
          safeDecls.push(`${prop}:${num}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'opacity') {
          const v = value.trim()
          if (!/^(0|1|0?\.\d+)$/.test(v)) continue
          const num = Number(v)
          if (!Number.isFinite(num) || num < 0 || num > 1) continue
          safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'pointer-events') {
          const v = value.toLowerCase()
          if (!(v === 'auto' || v === 'none')) continue
          safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'transform') {
          const v = value.trim()
          const lowerV = v.toLowerCase()
          if (lowerV === 'none') {
            safeDecls.push(`${prop}:none${hasImportant ? ' !important' : ''}`)
            continue
          }
          if (v.length > 120) continue
          if (!/^[0-9a-zA-Z().,%+\- \t]+$/.test(v)) continue
          if (lowerV.includes('url(') || lowerV.includes('expression(') || lowerV.includes('javascript:') || lowerV.includes('vbscript:')) continue
          const allowedFns = new Set(['translate', 'translatex', 'translatey', 'scale', 'scalex', 'scaley', 'rotate', 'skew', 'skewx', 'skewy', 'perspective'])
          const fnMatches = lowerV.match(/[a-z-]+\(/g) || []
          let ok = true
          for (const m of fnMatches) {
            const name = m.slice(0, -1)
            if (!allowedFns.has(name)) { ok = false; break }
          }
          if (!ok) continue
          safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'border-style') {
          const v = value.toLowerCase()
          if (v === 'none' || v === 'solid' || v === 'dashed' || v === 'dotted' || v === 'double') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'border-width') {
          const v = value.toLowerCase()
          if (this._isSafeCssLength(v) || /^\d{1,3}$/.test(v)) safeDecls.push(`${prop}:${value}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'border-radius') {
          const v = value.toLowerCase()
          if (this._isSafeCssLength(v)) safeDecls.push(`${prop}:${value}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'font-size' || prop === 'line-height' || prop === 'max-width' || prop === 'min-width' || prop === 'width' || prop === 'height' || prop === 'max-height') {
          const v = value.toLowerCase()
          if (this._isSafeCssLength(v) || /^\d{1,4}$/.test(v)) safeDecls.push(`${prop}:${value}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'padding' || prop === 'padding-left' || prop === 'padding-right' || prop === 'padding-top' || prop === 'padding-bottom' ||
                    prop === 'margin' || prop === 'margin-left' || prop === 'margin-right' || prop === 'margin-top' || prop === 'margin-bottom') {
          const v = value.toLowerCase()
          if (this._isSafeCssLength(v) || /^0$/.test(v)) safeDecls.push(`${prop}:${value}${hasImportant ? ' !important' : ''}`)
          continue
        }

        if (prop === 'border') {
          const v = value.toLowerCase()
          if (v.includes('url(') || v.includes('expression(') || v.includes('javascript:') || v.includes('vbscript:')) continue
          safeDecls.push(`${prop}:${value}`.slice(0, 120) + (hasImportant ? ' !important' : ''))
          continue
        }

        if (prop === 'font-family') {
          const cleaned = value.replace(/[^a-zA-Z0-9 ,'"-]/g, '').trim()
          if (cleaned) safeDecls.push(`${prop}:${cleaned}`.slice(0, 120) + (hasImportant ? ' !important' : ''))
          continue
        }
      }

      return safeDecls.join(';')
    }
  }

  if (typeof proto._sanitizeImageSrc !== 'function') {
    proto._sanitizeImageSrc = function (src) {
      if (!src || typeof src !== 'string') return ''
      const s = src.trim()
      if (/^data:image\/(png|jpeg|jpg|gif|webp|bmp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(s)) {
        return s
      }
      return this._sanitizeUrl(s)
    }
  }

  if (typeof proto._sanitizeStyleSheetText !== 'function') {
    proto._sanitizeStyleSheetText = function (cssText) {
      if (!cssText || typeof cssText !== 'string') return ''
      const text = cssText.trim()
      if (!text) return ''
      const lowered = text.toLowerCase()
      if (lowered.includes('@') || lowered.includes('url(') || lowered.includes('expression(') || lowered.includes('javascript:') || lowered.includes('vbscript:')) {
        return ''
      }

      const scopeSelector = (sel) => {
        if (!sel) return ''
        let s = String(sel).trim()
        if (!s) return ''
        if (s.startsWith('.markdown-content')) return s
        s = s.replace(/#pet-context-preview\b/g, '.markdown-content')
        s = s.replace(/#pet-message-preview\b/g, '.markdown-content')
        s = s.replace(/\.context-editor-preview\b/g, '.markdown-content')
        s = s.replace(/^(:root|html|body)\b/g, '.markdown-content')
        s = s.trim()
        if (!s) return ''
        if (s.startsWith('.markdown-content')) return s
        return `.markdown-content ${s}`
      }

      const rules = []
      const blocks = text.split('}')
      for (const block of blocks) {
        const b = block.trim()
        if (!b) continue
        const idx = b.indexOf('{')
        if (idx <= 0) continue
        const selectorPart = b.slice(0, idx).trim()
        const declPart = b.slice(idx + 1).trim()
        if (!selectorPart || !declPart) continue

        const safeDecls = this._sanitizeStyleText(declPart)
        if (!safeDecls) continue

        const selectors = selectorPart.split(',').map(s => s.trim()).filter(Boolean)
        if (selectors.length === 0) continue

        const needsDefaultContent = selectors.some(sel => /(^|[^-])::?(before|after)\b/i.test(sel)) && !/content\s*:/i.test(safeDecls)
        const finalDecls = needsDefaultContent ? `${safeDecls};content:""` : safeDecls

        const scopedSelectors = selectors.map(scopeSelector).filter(Boolean).join(', ')
        if (!scopedSelectors) continue

        rules.push(`${scopedSelectors}{${finalDecls}}`)
      }

      return rules.join('\n')
    }
  }

  if (typeof proto._sanitizeMarkdownHtml !== 'function') {
    proto._sanitizeMarkdownHtml = function (html) {
      if (!html) return ''
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        return this.escapeHtml(String(html))
      }

      const raw = String(html)
      const template = document.createElement('template')
      try {
        template.innerHTML = raw
      } catch (e) {
        return this.escapeHtml(raw)
      }

      const allowedTags = new Set([
        'a', 'b', 'blockquote', 'br', 'code', 'del', 'details', 'div', 'em',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'kbd', 'li',
        'mark', 'ol', 'p', 'pre', 'small', 'span', 'strong', 'sub', 'summary',
        'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul', 'style'
      ])

      const removeTags = new Set(['script', 'iframe', 'object', 'embed', 'link', 'meta'])

      const sanitizeElement = (el) => {
        const tag = String(el.tagName || '').toLowerCase()

        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            sanitizeElement(child)
          } else if (child.nodeType === Node.COMMENT_NODE) {
            child.parentNode && child.parentNode.removeChild(child)
          }
        }

        if (removeTags.has(tag)) {
          el.parentNode && el.parentNode.removeChild(el)
          return
        }

        if (!allowedTags.has(tag)) {
          const parent = el.parentNode
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el)
            }
            parent.removeChild(el)
          }
          return
        }

        if (tag === 'style') {
          for (const attr of Array.from(el.attributes)) {
            el.removeAttribute(attr.name)
          }
          const safeCss = this._sanitizeStyleSheetText(el.textContent || '')
          el.textContent = safeCss || ''
          if (!safeCss) {
            el.parentNode && el.parentNode.removeChild(el)
          }
          return
        }

        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase()
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name)
            continue
          }
          if (name === 'style') {
            const safeStyle = this._sanitizeStyleText(attr.value || '')
            if (safeStyle) el.setAttribute('style', safeStyle)
            else el.removeAttribute('style')
            continue
          }
          if (name === 'class') {
            const safeClass = this._sanitizeClassName(attr.value || '')
            if (safeClass) el.setAttribute('class', safeClass)
            else el.removeAttribute('class')
            continue
          }

          if (tag === 'a' && (name === 'href' || name === 'title' || name === 'target' || name === 'rel')) {
            if (name === 'href') {
              const safeHref = this._sanitizeUrl(attr.value || '')
              if (safeHref) el.setAttribute('href', safeHref)
              else el.removeAttribute('href')
            } else if (name === 'target') {
              const v = String(attr.value || '').toLowerCase()
              if (v === '_blank' || v === '_self') el.setAttribute('target', v)
              else el.removeAttribute('target')
            } else if (name === 'rel') {
              el.setAttribute('rel', 'noopener noreferrer')
            } else {
              el.setAttribute(name, String(attr.value || '').slice(0, 120))
            }
            continue
          }

          if (tag === 'img' && (name === 'src' || name === 'alt' || name === 'title' || name === 'width' || name === 'height' || name === 'loading')) {
            if (name === 'src') {
              const safeSrc = this._sanitizeImageSrc(attr.value || '')
              if (safeSrc) el.setAttribute('src', safeSrc)
              else el.removeAttribute('src')
            } else if (name === 'width' || name === 'height') {
              const v = String(attr.value || '').trim()
              if (/^\d{1,4}$/.test(v)) el.setAttribute(name, v)
              else el.removeAttribute(name)
            } else if (name === 'loading') {
              const v = String(attr.value || '').toLowerCase()
              if (v === 'lazy' || v === 'eager') el.setAttribute('loading', v)
              else el.setAttribute('loading', 'lazy')
            } else {
              el.setAttribute(name, this.escapeHtml(String(attr.value || '')).slice(0, 200))
            }
            continue
          }

          if ((name === 'title' || name === 'aria-label') && attr.value) {
            el.setAttribute(name, String(attr.value).slice(0, 200))
            continue
          }

          el.removeAttribute(attr.name)
        }

        if (tag === 'a' && el.getAttribute('target') === '_blank') {
          el.setAttribute('rel', 'noopener noreferrer')
        }

        if (tag === 'img') {
          if (!el.getAttribute('loading')) el.setAttribute('loading', 'lazy')
        }
      }

      for (const node of Array.from(template.content.childNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          sanitizeElement(node)
        } else if (node.nodeType === Node.COMMENT_NODE) {
          node.parentNode && node.parentNode.removeChild(node)
        }
      }

      const container = document.createElement('div')
      container.appendChild(template.content.cloneNode(true))
      return container.innerHTML
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window))
