/**
 * MarkdownRenderer — 独立的 Markdown 渲染组件
 * 提供 markdown→安全 HTML 的渲染能力，内建 XSS 防护。
 * 挂载到 window.MarkdownRenderer
 *
 * 依赖: libs/marked.min.js (需先加载)
 */
;(function () {
  'use strict'

  if (typeof window === 'undefined') return
  if (window.MarkdownRenderer) return

  var RENDER_MARKDOWN_ERROR_MESSAGE = '⚠️ 内容渲染失败，显示原始文本'

  // ========== 工具方法 ==========

  function escapeHtml(text) {
    if (typeof DomHelper !== 'undefined' && typeof DomHelper.escapeHtml === 'function') {
      return DomHelper.escapeHtml(text)
    }
    if (!text) return ''
    var div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  function sanitizeUrl(url) {
    if (!url) return ''
    var s = String(url).trim()
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return s
    try {
      var prot = decodeURIComponent(s)
        .replace(/[^A-Za-z0-9/:]/g, '')
        .toLowerCase()
      if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) return ''
    } catch (e) {
      return ''
    }
    return s
  }

  function isSafeCssColor(color) {
    if (!color || typeof color !== 'string') return false
    var value = color.trim()
    if (!value || value.length > 48) return false
    if (/^#[0-9a-fA-F]{3}$/.test(value) || /^#[0-9a-fA-F]{6}$/.test(value)) return true
    if (/^[a-zA-Z]+$/.test(value)) return true
    var rgbMatch = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
    if (rgbMatch) {
      var r = Number(rgbMatch[1]),
        g = Number(rgbMatch[2]),
        b = Number(rgbMatch[3])
      return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255
    }
    var rgbaMatch = value.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i)
    if (rgbaMatch) {
      ;((r = Number(rgbaMatch[1])), (g = Number(rgbaMatch[2])), (b = Number(rgbaMatch[3])))
      var a = Number(rgbaMatch[4])
      return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255 && a >= 0 && a <= 1
    }
    return false
  }

  function isSafeCssLength(value) {
    if (!value || typeof value !== 'string') return false
    var v = value.trim()
    if (/^-?0+(?:\.0+)?$/.test(v)) return true
    var m = v.match(/^(-?\d+(?:\.\d+)?)(px|em|rem|%|vh|vw)$/i)
    if (!m) return false
    var num = Number(m[1])
    if (!Number.isFinite(num)) return false
    return num >= -2000 && num <= 2000
  }

  function sanitizeClassName(className) {
    if (!className || typeof className !== 'string') return ''
    var cleaned = className
      .replace(/[^a-zA-Z0-9 _-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return cleaned.length > 128 ? cleaned.slice(0, 128).trim() : cleaned
  }

  function sanitizeStyleText(styleText) {
    if (!styleText || typeof styleText !== 'string') return ''
    var text = styleText.trim()
    if (!text) return ''
    var lowered = text.toLowerCase()
    if (
      lowered.includes('expression(') ||
      lowered.includes('javascript:') ||
      lowered.includes('vbscript:') ||
      lowered.includes('url(')
    )
      return ''

    var allowedProps = new Set([
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
      'margin',
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left',
      'padding',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
      'border',
      'border-radius',
      'border-width',
      'border-style',
      'border-color',
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
      'pointer-events',
    ])

    var parts = text.split(';')
    var safeDecls = []

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim()
      if (!p) continue
      var idx = p.indexOf(':')
      if (idx <= 0) continue
      var prop = p.slice(0, idx).trim().toLowerCase()
      var val = p.slice(idx + 1).trim()
      if (!prop || !val) continue
      if (!allowedProps.has(prop)) continue
      if (val.length > 160) continue
      if (/[\u0000-\u001f\u007f]/.test(val)) continue

      var hasImportant = /\s*!important\s*$/i.test(val)
      if (hasImportant) {
        val = val.replace(/\s*!important\s*$/i, '').trim()
        if (!val) continue
      }
      if (/\!important/i.test(val)) continue

      if (prop === 'color' || prop === 'background-color' || prop.indexOf('border-color') >= 0) {
        if (!isSafeCssColor(val)) continue
        safeDecls.push(prop + ':' + val + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'font-weight') {
        var vLo = val.toLowerCase()
        if (!(vLo === 'normal' || vLo === 'bold' || vLo === 'bolder' || vLo === 'lighter' || /^[1-9]00$/.test(vLo)))
          continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'font-style') {
        vLo = val.toLowerCase()
        if (!(vLo === 'normal' || vLo === 'italic' || vLo === 'oblique')) continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'text-decoration') {
        vLo = val.toLowerCase()
        if (!(vLo === 'none' || vLo === 'underline' || vLo === 'line-through' || vLo === 'overline')) continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'text-align') {
        vLo = val.toLowerCase()
        if (
          !(
            vLo === 'left' ||
            vLo === 'right' ||
            vLo === 'center' ||
            vLo === 'justify' ||
            vLo === 'start' ||
            vLo === 'end'
          )
        )
          continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'white-space') {
        vLo = val.toLowerCase()
        if (!(vLo === 'normal' || vLo === 'nowrap' || vLo === 'pre' || vLo === 'pre-wrap' || vLo === 'pre-line'))
          continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'word-break') {
        vLo = val.toLowerCase()
        if (!(vLo === 'normal' || vLo === 'break-all' || vLo === 'keep-all' || vLo === 'break-word')) continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'overflow' || prop === 'overflow-x' || prop === 'overflow-y') {
        vLo = val.toLowerCase()
        if (!(vLo === 'visible' || vLo === 'hidden' || vLo === 'scroll' || vLo === 'auto' || vLo === 'clip')) continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'display') {
        vLo = val.toLowerCase()
        if (!(vLo === 'inline' || vLo === 'block' || vLo === 'inline-block' || vLo === 'none' || vLo === 'flex'))
          continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'content') {
        var vTrim = val.trim()
        var lowerV = vTrim.toLowerCase()
        if (
          lowerV === 'none' ||
          lowerV === 'normal' ||
          lowerV === 'open-quote' ||
          lowerV === 'close-quote' ||
          lowerV === 'no-open-quote' ||
          lowerV === 'no-close-quote'
        ) {
          safeDecls.push(prop + ':' + lowerV + (hasImportant ? ' !important' : ''))
          continue
        }
        if (/^(['"])(?:\\.|(?!\1)[^\\\n\r])*?\1$/.test(vTrim) && vTrim.length <= 120) {
          safeDecls.push(prop + ':' + vTrim + (hasImportant ? ' !important' : ''))
          continue
        }
        continue
      }

      if (prop === 'position') {
        vLo = val.toLowerCase()
        if (!(vLo === 'static' || vLo === 'relative' || vLo === 'absolute' || vLo === 'sticky')) continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'top' || prop === 'right' || prop === 'bottom' || prop === 'left') {
        vLo = val.toLowerCase()
        if (!(vLo === 'auto' || isSafeCssLength(vLo))) continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'inset') {
        var tokens = val.split(/\s+/).filter(Boolean)
        var tokensOk = true
        for (var tIdx = 0; tIdx < tokens.length; tIdx++) {
          var t = tokens[tIdx].toLowerCase()
          if (!(t === 'auto' || isSafeCssLength(t))) {
            tokensOk = false
            break
          }
        }
        if (!tokensOk || tokens.length < 1 || tokens.length > 4) continue
        safeDecls.push(prop + ':' + tokens.join(' ') + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'z-index') {
        var zVal = val.trim()
        if (!/^-?\d{1,5}$/.test(zVal)) continue
        var n = Number(zVal)
        if (!Number.isFinite(n) || n < -9999 || n > 9999) continue
        safeDecls.push(prop + ':' + n + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'opacity') {
        var oVal = val.trim()
        if (!/^(0|1|0?\.\d+)$/.test(oVal)) continue
        n = Number(oVal)
        if (!Number.isFinite(n) || n < 0 || n > 1) continue
        safeDecls.push(prop + ':' + oVal + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'pointer-events') {
        vLo = val.toLowerCase()
        if (!(vLo === 'auto' || vLo === 'none')) continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'transform') {
        var tVal = val.trim()
        var tLower = tVal.toLowerCase()
        if (tLower === 'none') {
          safeDecls.push(prop + ':none' + (hasImportant ? ' !important' : ''))
          continue
        }
        if (tVal.length > 120) continue
        if (!/^[0-9a-zA-Z().,%+\- \t]+$/.test(tVal)) continue
        if (
          tLower.includes('url(') ||
          tLower.includes('expression(') ||
          tLower.includes('javascript:') ||
          tLower.includes('vbscript:')
        )
          continue
        var allowedFns = {
          translate: 1,
          translatex: 1,
          translatey: 1,
          scale: 1,
          scalex: 1,
          scaley: 1,
          rotate: 1,
          skew: 1,
          skewx: 1,
          skewy: 1,
          perspective: 1,
        }
        var fnMatches = tLower.match(/[a-z-]+\(/g) || []
        var fnOk = true
        for (var fIdx = 0; fIdx < fnMatches.length; fIdx++) {
          if (!allowedFns[fnMatches[fIdx].slice(0, -1)]) {
            fnOk = false
            break
          }
        }
        if (!fnOk) continue
        safeDecls.push(prop + ':' + tVal + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'font-family') {
        var fVal = val.replace(/["<>]/g, '').trim()
        if (!fVal || fVal.length > 80) continue
        if (!/^[a-zA-Z0-9 ,_-]+$/.test(fVal)) continue
        safeDecls.push(prop + ':' + fVal + (hasImportant ? ' !important' : ''))
        continue
      }

      if (
        prop === 'font-size' ||
        prop === 'line-height' ||
        prop === 'width' ||
        prop === 'height' ||
        prop === 'max-width' ||
        prop === 'min-width' ||
        prop === 'border-radius' ||
        prop.indexOf('margin') >= 0 ||
        prop.indexOf('padding') >= 0 ||
        prop.indexOf('border-width') >= 0
      ) {
        tokens = val.split(/\s+/).filter(Boolean)
        tokensOk = true
        for (tIdx = 0; tIdx < tokens.length; tIdx++) {
          if (!isSafeCssLength(tokens[tIdx])) {
            tokensOk = false
            break
          }
        }
        if (!tokensOk || tokens.length < 1 || tokens.length > 4) continue
        safeDecls.push(prop + ':' + tokens.join(' ') + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'border-style') {
        vLo = val.toLowerCase()
        if (!(vLo === 'none' || vLo === 'solid' || vLo === 'dashed' || vLo === 'dotted' || vLo === 'double')) continue
        safeDecls.push(prop + ':' + vLo + (hasImportant ? ' !important' : ''))
        continue
      }

      if (prop === 'border') {
        var bVal = val.toLowerCase().replace(/["<>]/g, '').trim()
        if (!bVal || bVal.length > 80) continue
        if (bVal.includes('url(') || bVal.includes('expression(')) continue
        safeDecls.push(prop + ':' + bVal + (hasImportant ? ' !important' : ''))
        continue
      }
    }

    return safeDecls.join(';')
  }

  function sanitizeImageSrc(src) {
    if (!src || typeof src !== 'string') return ''
    var s = src.trim()
    if (/^data:image\/[a-zA-Z0-9.+_-]+;base64,[a-z0-9+/\s=]+$/i.test(s)) return s
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return s
    return sanitizeUrl(s)
  }

  function sanitizeStyleSheetText(cssText) {
    if (!cssText || typeof cssText !== 'string') return ''
    var text = cssText.trim()
    if (!text) return ''
    var lowered = text.toLowerCase()
    if (
      lowered.includes('@') ||
      lowered.includes('url(') ||
      lowered.includes('expression(') ||
      lowered.includes('javascript:') ||
      lowered.includes('vbscript:')
    )
      return ''

    function scopeSelector(sel) {
      if (!sel) return ''
      var s = String(sel).trim()
      if (!s) return ''
      if (s.indexOf('.markdown-content') === 0) return s
      s = s.replace(/#pet-context-preview\b/g, '.markdown-content')
      s = s.replace(/#pet-message-preview\b/g, '.markdown-content')
      s = s.replace(/\.context-editor-preview\b/g, '.markdown-content')
      s = s.replace(/^(:root|html|body)\b/g, '.markdown-content')
      s = s.trim()
      if (!s) return ''
      if (s.indexOf('.markdown-content') === 0) return s
      return '.markdown-content ' + s
    }

    var rules = []
    var blocks = text.split('}')
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i].trim()
      if (!b) continue
      var idx = b.indexOf('{')
      if (idx <= 0) continue
      var selectorPart = b.slice(0, idx).trim()
      var declPart = b.slice(idx + 1).trim()
      if (!selectorPart || !declPart) continue

      var safeDecls = sanitizeStyleText(declPart)
      if (!safeDecls) continue

      var selectors = selectorPart
        .split(',')
        .map(function (s) {
          return s.trim()
        })
        .filter(Boolean)
      if (selectors.length === 0) continue

      var needsDefaultContent = false
      for (var sIdx = 0; sIdx < selectors.length; sIdx++) {
        if (/(^|[^-])::?(before|after)\b/i.test(selectors[sIdx])) {
          needsDefaultContent = true
          break
        }
      }
      var finalDecls = needsDefaultContent ? safeDecls + ';content:""' : safeDecls

      var scopedSelectors = selectors.map(scopeSelector).filter(Boolean).join(', ')
      if (!scopedSelectors) continue

      rules.push(scopedSelectors + '{' + finalDecls + '}')
    }

    return rules.join('\n')
  }

  function sanitizeMarkdownHtml(html) {
    if (!html) return ''
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return escapeHtml(String(html))
    }

    var raw = String(html)
    var template = document.createElement('template')
    try {
      template.innerHTML = raw
    } catch (e) {
      return escapeHtml(raw)
    }

    var allowedTags = {
      a: 1,
      b: 1,
      blockquote: 1,
      br: 1,
      code: 1,
      del: 1,
      details: 1,
      div: 1,
      em: 1,
      h1: 1,
      h2: 1,
      h3: 1,
      h4: 1,
      h5: 1,
      h6: 1,
      hr: 1,
      i: 1,
      img: 1,
      kbd: 1,
      li: 1,
      mark: 1,
      ol: 1,
      p: 1,
      pre: 1,
      small: 1,
      span: 1,
      strong: 1,
      sub: 1,
      summary: 1,
      sup: 1,
      table: 1,
      tbody: 1,
      td: 1,
      th: 1,
      thead: 1,
      tr: 1,
      u: 1,
      ul: 1,
      style: 1,
      input: 1,
      label: 1,
    }
    var removeTags = { script: 1, iframe: 1, object: 1, embed: 1, link: 1, meta: 1 }

    function sanitizeElement(el) {
      var tag = String(el.tagName || '').toLowerCase()

      var children = Array.from(el.childNodes)
      for (var cIdx = 0; cIdx < children.length; cIdx++) {
        var child = children[cIdx]
        if (child.nodeType === Node.ELEMENT_NODE) sanitizeElement(child)
        else if (child.nodeType === Node.COMMENT_NODE) child.parentNode && child.parentNode.removeChild(child)
      }

      if (removeTags[tag]) {
        el.parentNode && el.parentNode.removeChild(el)
        return
      }
      if (!allowedTags[tag]) {
        var parent = el.parentNode
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el)
          parent.removeChild(el)
        }
        return
      }

      if (tag === 'style') {
        var attrs = Array.from(el.attributes)
        for (var aIdx = 0; aIdx < attrs.length; aIdx++) el.removeAttribute(attrs[aIdx].name)
        var safeCss = sanitizeStyleSheetText(el.textContent || '')
        el.textContent = safeCss || ''
        if (!safeCss) el.parentNode && el.parentNode.removeChild(el)
        return
      }

      attrs = Array.from(el.attributes)
      for (aIdx = 0; aIdx < attrs.length; aIdx++) {
        var attr = attrs[aIdx]
        var name = attr.name.toLowerCase()
        if (name.indexOf('on') === 0) {
          el.removeAttribute(attr.name)
          continue
        }
        if (name === 'style') {
          var safeStyle = sanitizeStyleText(attr.value || '')
          if (safeStyle) el.setAttribute('style', safeStyle)
          else el.removeAttribute('style')
          continue
        }
        if (name === 'class') {
          var safeClass = sanitizeClassName(attr.value || '')
          if (safeClass) el.setAttribute('class', safeClass)
          else el.removeAttribute('class')
          continue
        }

        if (tag === 'a' && (name === 'href' || name === 'title' || name === 'target' || name === 'rel')) {
          if (name === 'href') {
            var safeHref = sanitizeUrl(attr.value || '')
            if (safeHref) el.setAttribute('href', safeHref)
            else el.removeAttribute('href')
          } else if (name === 'target') {
            var tv = String(attr.value || '').toLowerCase()
            if (tv === '_blank' || tv === '_self') el.setAttribute('target', tv)
            else el.removeAttribute('target')
          } else if (name === 'rel') {
            el.setAttribute('rel', 'noopener noreferrer')
          } else {
            el.setAttribute(name, String(attr.value || '').slice(0, 120))
          }
          continue
        }

        if (
          tag === 'img' &&
          (name === 'src' ||
            name === 'alt' ||
            name === 'title' ||
            name === 'width' ||
            name === 'height' ||
            name === 'loading')
        ) {
          if (name === 'src') {
            var safeSrc = sanitizeImageSrc(attr.value || '')
            if (safeSrc) el.setAttribute('src', safeSrc)
            else el.removeAttribute('src')
          } else if (name === 'width' || name === 'height') {
            var wv = String(attr.value || '').trim()
            if (/^\d{1,4}$/.test(wv)) el.setAttribute(name, wv)
            else el.removeAttribute(name)
          } else if (name === 'loading') {
            var lv = String(attr.value || '').toLowerCase()
            if (lv === 'lazy' || lv === 'eager') el.setAttribute('loading', lv)
            else el.setAttribute('loading', 'lazy')
          } else {
            el.setAttribute(name, escapeHtml(String(attr.value || '')).slice(0, 200))
          }
          continue
        }

        if (tag === 'input' && (name === 'type' || name === 'checked' || name === 'disabled')) {
          if (name === 'type') {
            var iv = String(attr.value || '').toLowerCase()
            if (iv === 'checkbox') el.setAttribute('type', 'checkbox')
            else el.removeAttribute('type')
          } else {
            el.setAttribute(name, '')
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
      if (tag === 'img' && !el.getAttribute('loading')) {
        el.setAttribute('loading', 'lazy')
      }

      if (tag === 'input') {
        var it = String(el.getAttribute('type') || '').toLowerCase()
        if (it !== 'checkbox') {
          el.parentNode && el.parentNode.removeChild(el)
          return
        }
        el.setAttribute('type', 'checkbox')
        el.setAttribute('disabled', '')
        if (el.hasAttribute('checked')) el.setAttribute('checked', '')
      }
    }

    var childNodes = Array.from(template.content.childNodes)
    for (cIdx = 0; cIdx < childNodes.length; cIdx++) {
      var node = childNodes[cIdx]
      if (node.nodeType === Node.ELEMENT_NODE) sanitizeElement(node)
      else if (node.nodeType === Node.COMMENT_NODE) node.parentNode && node.parentNode.removeChild(node)
    }

    var container = document.createElement('div')
    container.appendChild(template.content.cloneNode(true))
    return container.innerHTML
  }

  // ========== 核心渲染 ==========

  function render(markdown) {
    if (!markdown) return ''

    try {
      if (typeof marked !== 'undefined') {
        var renderer = new marked.Renderer()

        renderer.link = function (href, title, text) {
          var resolvedHref = href,
            resolvedTitle = title,
            resolvedText = text
          if (href && typeof href === 'object') {
            resolvedHref = href.href
            resolvedTitle = href.title
            resolvedText = href.text
          }
          var safeHref = sanitizeUrl(resolvedHref)
          var safeText = resolvedText || ''
          if (!safeHref) return safeText
          var safeTitle = resolvedTitle ? ' title="' + escapeHtml(resolvedTitle) + '"' : ''
          return (
            '<a href="' +
            escapeHtml(safeHref) +
            '"' +
            safeTitle +
            ' target="_blank" rel="noopener noreferrer">' +
            safeText +
            '</a>'
          )
        }

        renderer.image = function (href, title, text) {
          var resolvedHref = href,
            resolvedTitle = title,
            resolvedAlt = text
          if (href && typeof href === 'object') {
            resolvedHref = href.href
            resolvedTitle = href.title
            resolvedAlt = href.text
          }
          var safeHref = sanitizeImageSrc(resolvedHref)
          var alt = escapeHtml(resolvedAlt || '')
          if (!safeHref) return alt
          var safeTitle = resolvedTitle ? ' title="' + escapeHtml(resolvedTitle) + '"' : ''
          return '<img src="' + escapeHtml(safeHref) + '" alt="' + alt + '" loading="lazy"' + safeTitle + ' />'
        }

        renderer.html = function (token) {
          return typeof token === 'string' ? token : (token && (token.raw || token.text)) || ''
        }

        renderer.code = function (code, language) {
          var resolvedCode = code,
            resolvedLang = language
          if (code && typeof code === 'object') {
            resolvedCode = code.text
            resolvedLang = code.lang
          }
          var lang = (resolvedLang || '').trim().toLowerCase()
          if (lang === 'mermaid' || lang === 'mmd') {
            return '<div class="mermaid">' + (resolvedCode || '') + '</div>'
          }
          var escaped = escapeHtml(String(resolvedCode || ''))
          var classAttr = lang ? ' class="language-' + escapeHtml(lang) + '"' : ''
          return '<pre><code' + classAttr + '>' + escaped + '</code></pre>'
        }

        marked.setOptions({ renderer: renderer, breaks: true, gfm: true, sanitize: false })
        var rendered = marked.parse(markdown)
        return sanitizeMarkdownHtml(rendered)
      } else {
        return escapeHtml(markdown)
      }
    } catch (error) {
      var escapedMarkdown = escapeHtml(markdown)
      return (
        '<div class="pet-markdown-error">' +
        '<div class="pet-markdown-error__message">' +
        escapeHtml(RENDER_MARKDOWN_ERROR_MESSAGE) +
        '</div>' +
        '<pre class="pet-markdown-error__content">' +
        escapedMarkdown +
        '</pre>' +
        '</div>'
      )
    }
  }

  // ========== 导出 ==========

  window.MarkdownRenderer = {
    render: render,
    escapeHtml: escapeHtml,
    // 供 mermaid 组件等外部使用的净化方法
    _sanitizeUrl: sanitizeUrl,
    _sanitizeImageSrc: sanitizeImageSrc,
    _sanitizeMarkdownHtml: sanitizeMarkdownHtml,
    _sanitizeStyleText: sanitizeStyleText,
    _sanitizeStyleSheetText: sanitizeStyleSheetText,
  }
})()
