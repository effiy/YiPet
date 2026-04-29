(function (global) {
  'use strict'

  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  const proto = global.PetManager.prototype

  const EDITOR_PREVIEW_DEBOUNCE = 150
  const MERMAID_RENDER_DEBOUNCE = 150
  const MIN_CONTEXT_LENGTH = 50
  const AD_LINE_MIN_LENGTH = 180

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

    const adLineRe =
      /^(?:广告|推广|赞助|赞助内容|广告内容|Sponsored|Advertisement|Promoted\s+Content|Ad\s+Choice|Cookie\s+Policy|Privacy\s+Policy|Terms\s+of\s+Service|Terms\s+&\s+Conditions)\s*$/i
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
      if (adLineRe.test(t)) {
        removedLines++
        continue
      }
      const isNavigationLine = navigationKeywords.some(keyword => t === keyword)
      if (isNavigationLine && t.length < 10) {
        removedLines++
        continue
      }
      if (t === last) continue
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

  proto.getRenderedHTMLAsMarkdown = function () {
    try {
      return this.getRenderedMainContentAsMarkdown()
    } catch (error) {
      console.error('将渲染后的 HTML 转换为 Markdown 时出错:', error)
      return this.getFullPageText()
    }
  }

  proto.refreshContextFromPage = async function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (!textarea) {
      throw new Error('未找到上下文编辑器')
    }

    try {
      const pageContent = this.buildPageContextMarkdownForEditor()

      textarea.value = pageContent || ''
      textarea.setAttribute('data-user-edited', '0')
      textarea.setAttribute('data-last-synced-text', textarea.value || '')

      this.updateContextPreview()

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
        session.updatedAt = Date.now()
        session.lastAccessTime = Date.now()
        this.saveAllSessions(true, true).catch(err => {
          console.error('自动保存更新的上下文失败:', err)
        })
      }
    } catch (error) {
      console.error('拉取网页上下文失败:', error)
      throw error
    }
  }

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

      session.pageContent = editedContent
      session.updatedAt = Date.now()
      session.lastAccessTime = Date.now()

      if (!session.title || session.title === '当前页面') {
        const documentTitle = normalizeNameSpaces(document.title || '当前页面')
        const ensureMdSuffix = (str) => {
          if (!str || !String(str).trim()) return ''
          const s = String(str).trim()
          return s.endsWith('.md') ? s : `${s}.md`
        }
        session.title = ensureMdSuffix(documentTitle)
      }

      await this.saveAllSessions(true, true)
      await this.syncSessionToBackend(this.currentSessionId, true, true)

      if (typeof this.writeSessionPageContent === 'function') {
        try {
          await this.writeSessionPageContent(this.currentSessionId)
        } catch (writeError) {
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

    const iconEl = button.querySelector('.save-btn-icon')
    const textEl = button.querySelector('.save-btn-text')
    const loaderEl = button.querySelector('.save-btn-loader')

    try {
      button.disabled = true
      button.classList.add('loading')
      if (textEl) {
        textEl.textContent = '保存中...'
      }
      if (loaderEl) {
        loaderEl.classList.add('visible')
      }

      const session = this.sessions[this.currentSessionId]

      const pageContent = this.getPageContentAsMarkdown()
      session.pageContent = pageContent || ''

      const pageInfo = this.getPageInfo()
      const currentPageTitle = normalizeNameSpaces(pageInfo.title || document.title || '当前页面')
      const sessionTitle = session.title || ''
      const isDefaultTitle = !sessionTitle ||
        sessionTitle.trim() === '' ||
        sessionTitle === '未命名会话' ||
        sessionTitle === '新会话' ||
        sessionTitle === '未命名页面' ||
        sessionTitle === '当前页面'

      const ensureMdSuffix = (str) => {
        if (!str || !String(str).trim()) return ''
        const s = String(str).trim()
        return s.endsWith('.md') ? s : `${s}.md`
      }
      session.title = isDefaultTitle ? ensureMdSuffix(currentPageTitle) : sessionTitle
      session.pageDescription = pageInfo.description || session.pageDescription || ''
      session.url = pageInfo.url || session.url || window.location.href

      session.updatedAt = Date.now()
      session.lastAccessTime = Date.now()

      await this.saveAllSessions(true, true)
      await this.syncSessionToBackend(this.currentSessionId, true, true)

      await this.refreshWelcomeMessage()

      this._showManualSaveStatus(button, true)

      console.log('会话已手动保存:', this.currentSessionId)
    } catch (error) {
      console.error('手动保存会话失败:', error)
      this._showManualSaveStatus(button, false)
    }
  }

  proto._showManualSaveStatus = function (button, success) {
    const iconEl = button.querySelector('.save-btn-icon')
    const textEl = button.querySelector('.save-btn-text')
    const loaderEl = button.querySelector('.save-btn-loader')

    button.classList.remove('loading')
    if (loaderEl) loaderEl.classList.remove('visible')

    if (success) {
      button.classList.add('success')
      button.classList.remove('error')
      if (iconEl) {
        iconEl.textContent = '✓'
      }
      if (textEl) textEl.textContent = '已保存'
    } else {
      button.classList.add('error')
      button.classList.remove('success')
      if (iconEl) {
        iconEl.textContent = '✕'
      }
      if (textEl) textEl.textContent = '保存失败'
    }

    setTimeout(() => {
      button.disabled = false
      button.classList.remove('success', 'error')
      if (iconEl) {
        iconEl.textContent = '💾'
      }
      if (textEl) textEl.textContent = '保存会话'
    }, 2500)
  }

  proto.loadContextIntoEditor = async function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
    if (!textarea) return
    try {
      if (this.currentSessionId && this.sessions[this.currentSessionId]) {
        if (typeof this.fetchSessionPageContent === 'function') {
          await this.fetchSessionPageContent(this.currentSessionId)
        }

        const session = this.sessions[this.currentSessionId]
        const md = (session.pageContent && session.pageContent.trim() !== '') ? session.pageContent : ''
        textarea.value = md || ''
      } else {
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

  proto._updatePreview = function (textareaId, previewId) {
    const textarea = this.chatWindow ? this.chatWindow.querySelector(textareaId) : null
    const preview = this.chatWindow ? this.chatWindow.querySelector(previewId) : null
    if (!textarea || !preview) return

    const markdown = textarea.value || ''
    logger.debug('更新预览', { textareaId, length: markdown.length })

    if (preview._mermaidTimer) {
      clearTimeout(preview._mermaidTimer)
      preview._mermaidTimer = null
    }
    if (preview._mermaidCancelled) {
      preview._mermaidCancelled()
      preview._mermaidCancelled = null
    }

    preview.innerHTML = this.renderMarkdown(markdown)

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
    } catch (e) {}
  }

  proto.copyContextEditor = function () {
    const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null
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
      const copyBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-copy-btn') : null
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
            } catch (_) {}
          }, 80)
        } else {
          if (contentDiv) contentDiv.remove()
        }

        if (this.chatWindowComponent && typeof this.chatWindowComponent.addActionButtonsToMessage === 'function') {
          this.chatWindowComponent.addActionButtonsToMessage(targetDiv, true)
        }
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

  console.log('[PetManager] petManager.editor.core.js 已加载')
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this)))
