/**
 * MermaidRenderer — 独立的 Mermaid 图表渲染组件
 * 负责 mermaid 库加载、图表渲染和 UI 交互。
 * 挂载到 window.MermaidRenderer
 *
 * 依赖: DomHelper.runPageScriptWithData, chrome.runtime.getURL
 *       Page scripts: cdn/markdown/mermaid-page-load.js
 *                     cdn/markdown/mermaid-page-render.js
 */
(function () {
  'use strict'

  if (typeof window === 'undefined') return
  if (window.MermaidRenderer) return

  var loaded = false
  var loading = false

  var logger = (typeof console !== 'undefined') ? console : { info: function () {}, warn: function () {}, error: function () {}, debug: function () {} }

  // ========== 加载 Mermaid 库 ==========

  function loadMermaid() {
    if (loaded || loading) return Promise.resolve(loaded)

    loading = true

    return new Promise(function (resolve, reject) {
      // 检查是否已加载
      var mermaidLib = (typeof mermaid !== 'undefined') ? mermaid : (window.mermaid || null)
      if (mermaidLib && typeof mermaidLib.initialize === 'function') {
        try {
          mermaidLib.initialize({
            startOnLoad: false, theme: 'default', securityLevel: 'loose',
            flowchart: { useMaxWidth: false, htmlLabels: true, wrap: false },
            sequence: { useMaxWidth: false, wrap: false },
            gantt: { useMaxWidth: false }, class: { useMaxWidth: false },
            state: { useMaxWidth: false }, pie: { useMaxWidth: false }
          })
          loaded = true
          loading = false
          resolve(true)
          return
        } catch (error) {
          loading = false
          reject(error)
          return
        }
      }

      var scriptUrl = chrome.runtime.getURL('libs/mermaid.min.js')
      var loadScriptUrl = chrome.runtime.getURL('cdn/markdown/mermaid-page-load.js')

      if (typeof DomHelper === 'undefined' || typeof DomHelper.runPageScriptWithData !== 'function') {
        loading = false
        reject(new Error('DomHelper 不可用'))
        return
      }

      DomHelper.runPageScriptWithData({
        scriptSrc: loadScriptUrl,
        dataContainerId: '__mermaid_url_container__',
        dataAttributes: { 'data-mermaid-url': scriptUrl },
        successEvent: 'mermaid-loaded',
        errorEvent: 'mermaid-error',
        timeoutMs: 30000,
        cleanupDelayMs: 1000
      }).then(function () {
        loaded = true
        loading = false
        resolve(true)
      }).catch(function (eventOrError) {
        loading = false
        var errorMsg = (eventOrError && eventOrError.detail && eventOrError.detail.error)
          ? eventOrError.detail.error
          : (eventOrError && eventOrError.message ? eventOrError.message : 'Mermaid.js 加载失败')
        reject(new Error(errorMsg))
      })
    })
  }

  // ========== 渲染 Mermaid 块 ==========

  function renderBlocks(container) {
    if (!container) return Promise.resolve()

    var mermaidCodeBlocks = container.querySelectorAll('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]')
    var mermaidDivs = container.querySelectorAll('div.mermaid:not([data-mermaid-rendered])')

    var allMermaidElements = Array.from(mermaidCodeBlocks).concat(Array.from(mermaidDivs))
    if (allMermaidElements.length === 0) return Promise.resolve()

    // 过滤已处理的
    var unprocessed = allMermaidElements.filter(function (element) {
      if (element.tagName === 'DIV' && element.classList.contains('mermaid')) {
        if (element.querySelector('svg')) return false
        return element.getAttribute('data-mermaid-rendered') !== 'true'
      }
      if (element.tagName === 'CODE') {
        var pre = element.parentElement
        if (pre && pre.tagName === 'PRE') {
          var next = pre.nextElementSibling
          if (next && next.classList.contains('mermaid')) return false
          if (element.classList.contains('mermaid-processed')) return false
        }
        return true
      }
      return true
    })

    if (unprocessed.length === 0) return Promise.resolve()

    return loadMermaid().then(function () {
      unprocessed.forEach(function (element, index) {
        var mermaidId = 'mermaid-' + Date.now() + '-' + index + '-' + Math.random().toString(36).substr(2, 9)
        var mermaidDiv = null
        var mermaidContent = ''

        if (element.tagName === 'DIV' && element.classList.contains('mermaid')) {
          mermaidDiv = element
          mermaidContent = element.textContent || element.innerText || ''
          if (!mermaidDiv.id) mermaidDiv.id = mermaidId
          if (!element.hasAttribute('data-mermaid-source')) element.setAttribute('data-mermaid-source', mermaidContent)
          if (!element.classList.contains('mermaid-container')) element.classList.add('mermaid-container')
          element.style.display = 'inline-block'
          element.style.width = 'auto'
        } else if (element.tagName === 'CODE') {
          var preElement = element.parentElement
          if (!preElement || preElement.tagName !== 'PRE') return
          mermaidContent = element.textContent || element.innerText || ''
          if (!mermaidContent.trim()) return

          mermaidDiv = document.createElement('div')
          mermaidDiv.className = 'mermaid mermaid-container'
          mermaidDiv.id = mermaidId
          mermaidDiv.textContent = mermaidContent
          mermaidDiv.setAttribute('data-mermaid-source', mermaidContent)
          mermaidDiv.style.display = 'inline-block'
          mermaidDiv.style.width = 'auto'

          element.classList.add('mermaid-processed')
          try { preElement.parentNode.replaceChild(mermaidDiv, preElement) } catch (e) { return }
        } else { return }

        if (!mermaidContent.trim()) return
        mermaidDiv.setAttribute('data-mermaid-rendered', 'false')

        if (typeof DomHelper === 'undefined' || typeof DomHelper.runPageScriptWithData !== 'function') return

        setTimeout(function () {
          var checkDiv = document.getElementById(mermaidId)
          if (!checkDiv) {
            setTimeout(function () {
              renderSingleBlock(mermaidId, mermaidDiv, mermaidContent)
            }, 150)
            return
          }
          renderSingleBlock(mermaidId, mermaidDiv, mermaidContent)
        }, 200)
      })
    }).catch(function () { return Promise.resolve() })
  }

  function renderSingleBlock(mermaidId, mermaidDiv, mermaidContent) {
    DomHelper.runPageScriptWithData({
      scriptSrc: chrome.runtime.getURL('cdn/markdown/mermaid-page-render.js'),
      dataContainerId: '__mermaid_render_id_container__' + mermaidId,
      dataAttributes: { 'data-mermaid-id': mermaidId },
      successEvent: 'mermaid-rendered',
      timeoutMs: 15000,
      cleanupDelayMs: 3000,
      isSuccess: function (e) { return e && e.detail && e.detail.id === mermaidId }
    }).then(function (event) {
      if (!event.detail.success) {
        showMermaidError(mermaidDiv, mermaidContent)
      } else {
        mermaidDiv.setAttribute('data-mermaid-rendered', 'true')
        setTimeout(function () { addActions(mermaidDiv, event.detail.svgContent || '', mermaidContent) }, 100)
      }
    }).catch(function () {
      showMermaidError(mermaidDiv, mermaidContent)
    })
  }

  function showMermaidError(mermaidDiv, mermaidContent) {
    var errorDiv = document.createElement('div')
    errorDiv.className = 'mermaid-error'
    var escaped = escapeHtmlText(mermaidContent)
    errorDiv.innerHTML = '<div>❌ Mermaid 图表渲染失败</div><pre style="font-size:10px;margin-top:5px;overflow-x:auto;">' + escaped + '</pre>'
    if (mermaidDiv && mermaidDiv.parentNode) {
      mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv)
    }
  }

  // ========== UI 交互 ==========

  function escapeHtmlText(text) {
    if (typeof DomHelper !== 'undefined' && typeof DomHelper.escapeHtml === 'function') return DomHelper.escapeHtml(text)
    if (!text) return ''
    var div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  function addActions(mermaidDiv, svgContent, mermaidSourceCode) {
    if (!mermaidDiv) return
    if (mermaidDiv.querySelector('.mermaid-actions')) return

    var currentPosition = window.getComputedStyle(mermaidDiv).position
    if (currentPosition === 'static') mermaidDiv.classList.add('mermaid-has-relative-position')

    var actionsContainer = document.createElement('div')
    actionsContainer.className = 'mermaid-actions'

    // 复制按钮
    var copyButton = makeButton('📋', '复制 Mermaid 代码', 'mermaid-copy-button')
    copyButton.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault()
      var code = mermaidSourceCode || mermaidDiv.getAttribute('data-mermaid-source') || ''
      if (!code) return
      navigator.clipboard.writeText(code).then(function () {
        copyButton.innerHTML = '✓'
        setTimeout(function () { copyButton.innerHTML = '📋' }, 1000)
      }).catch(function () {
        copyButton.innerHTML = '✗'
        setTimeout(function () { copyButton.innerHTML = '📋' }, 1000)
      })
    })
    actionsContainer.appendChild(copyButton)

    // 下载 SVG
    var downloadButton = makeButton('💾', '下载 SVG', 'mermaid-download-button')
    downloadButton.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault()
      getSvgContent(mermaidDiv, svgContent).then(function (svg) {
        if (!svg) throw new Error('无 SVG')
        downloadBlob(svg, 'image/svg+xml;charset=utf-8', 'mermaid-diagram-' + Date.now() + '.svg')
        downloadButton.innerHTML = '✓'
        setTimeout(function () { downloadButton.innerHTML = '💾' }, 1000)
      }).catch(function () {
        downloadButton.innerHTML = '✗'
        setTimeout(function () { downloadButton.innerHTML = '💾' }, 1000)
      })
    })
    actionsContainer.appendChild(downloadButton)

    // 下载 PNG
    var pngButton = makeButton('🖼️', '下载 PNG', 'mermaid-download-png-button')
    pngButton.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault()
      getSvgContent(mermaidDiv, svgContent).then(function (svg) {
        if (!svg) throw new Error('无 SVG')
        pngButton.innerHTML = '⏳'
        return svgToPng(mermaidDiv, svg)
      }).then(function (pngBlob) {
        downloadBlob(pngBlob, 'image/png', 'mermaid-diagram-' + Date.now() + '.png')
        pngButton.innerHTML = '✓'
        setTimeout(function () { pngButton.innerHTML = '🖼️' }, 1000)
      }).catch(function () {
        pngButton.innerHTML = '✗'
        setTimeout(function () { pngButton.innerHTML = '🖼️' }, 1000)
      })
    })
    actionsContainer.appendChild(pngButton)

    // Live Editor
    var editButton = makeButton('✏️', '在 Mermaid Live Editor 中打开', 'mermaid-edit-button')
    editButton.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault()
      var code = mermaidSourceCode || mermaidDiv.getAttribute('data-mermaid-source') || ''
      if (code && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(function () {})
      }
      window.open('https://mermaid.live/edit', '_blank')
    })
    actionsContainer.appendChild(editButton)

    // 全屏
    var fullscreenButton = makeButton('⛶', '全屏查看', 'mermaid-fullscreen-button')
    fullscreenButton.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault()
      openFullscreen(mermaidDiv, mermaidSourceCode)
    })
    actionsContainer.appendChild(fullscreenButton)

    mermaidDiv.appendChild(actionsContainer)
  }

  function makeButton(html, title, className) {
    var btn = document.createElement('button')
    btn.innerHTML = html
    btn.title = title
    btn.className = className
    return btn
  }

  function getSvgContent(mermaidDiv, fallbackSvg) {
    return new Promise(function (resolve) {
      if (fallbackSvg) { resolve(fallbackSvg); return }

      var svgElement = mermaidDiv.querySelector('svg')
      if (svgElement) {
        try {
          var clone = svgElement.cloneNode(true)
          if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
          resolve(new XMLSerializer().serializeToString(clone))
          return
        } catch (e) {}
      }

      // fallback: inject script
      var script = document.createElement('script')
      script.textContent = '(function(){var d=document.getElementById("' + mermaidDiv.id + '");if(d){var s=d.querySelector("svg");if(s){var c=s.cloneNode(true);c.getAttribute("xmlns")||c.setAttribute("xmlns","http://www.w3.org/2000/svg");window.postMessage({type:"mermaid-svg-content",id:"' + mermaidDiv.id + '",svgContent:new XMLSerializer().serializeToString(c)},"*")}})()'
      document.documentElement.appendChild(script)

      function handler(event) {
        if (event.data && event.data.type === 'mermaid-svg-content' && event.data.id === mermaidDiv.id) {
          window.removeEventListener('message', handler)
          if (script.parentNode) script.parentNode.removeChild(script)
          resolve(event.data.svgContent || '')
        }
      }
      window.addEventListener('message', handler)
      setTimeout(function () {
        window.removeEventListener('message', handler)
        if (script.parentNode) script.parentNode.removeChild(script)
        resolve('')
      }, 1000)
    })
  }

  function downloadBlob(data, mimeType, filename) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mimeType })
    var url = URL.createObjectURL(blob)
    var link = document.createElement('a')
    link.href = url
    link.download = filename
    link.classList.add('tw-hidden')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function svgToPng(mermaidDiv, svgString) {
    return new Promise(function (resolve, reject) {
      // 优先从 DOM 中的 SVG 绘制
      var svgEl = mermaidDiv.querySelector('svg')
      if (svgEl) {
        try {
          var bbox = svgEl.getBBox()
          var w = Math.max(100, bbox.width || parseFloat(svgEl.getAttribute('width')) || 800)
          var h = Math.max(100, bbox.height || parseFloat(svgEl.getAttribute('height')) || 600)

          var canvas = document.createElement('canvas')
          var ctx = canvas.getContext('2d')
          var scale = 2
          canvas.width = w * scale
          canvas.height = h * scale
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          var clone = svgEl.cloneNode(true)
          if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
          clone.setAttribute('width', String(w))
          clone.setAttribute('height', String(h))
          var svgUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone))

          var img = new Image()
          img.onload = function () {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            canvas.toBlob(function (blob) { if (blob) resolve(blob); else tryStringMethod(svgString, w, h, resolve, reject) }, 'image/png')
          }
          img.onerror = function () { tryStringMethod(svgString, w, h, resolve, reject) }
          img.src = svgUri
          return
        } catch (e) {}
      }
      tryStringMethod(svgString, 800, 600, resolve, reject)
    })
  }

  function tryStringMethod(svgString, defaultW, defaultH, resolve, reject) {
    if (!svgString || typeof svgString !== 'string') { reject(new Error('SVG 为空')); return }
    try {
      var parser = new DOMParser()
      var svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
      if (svgDoc.querySelector('parsererror')) { reject(new Error('SVG 格式错误')); return }

      var svgEl = svgDoc.documentElement
      if (!svgEl.getAttribute('xmlns')) svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

      var w = parseFloat(svgEl.getAttribute('width')) || defaultW
      var h = parseFloat(svgEl.getAttribute('height')) || defaultH
      var viewBox = svgEl.getAttribute('viewBox')
      if (viewBox) { var parts = viewBox.split(/\s+/); if (parts.length >= 4) { w = parseFloat(parts[2]) || w; h = parseFloat(parts[3]) || h } }

      w = Math.max(100, w)
      h = Math.max(100, h)

      var svgUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svgEl))
      var img = new Image()
      img.onload = function () {
        var canvas = document.createElement('canvas')
        var ctx = canvas.getContext('2d')
        var scale = 2
        canvas.width = (img.width || w) * scale
        canvas.height = (img.height || h) * scale
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(function (blob) { if (blob) resolve(blob); else reject(new Error('Canvas 转换失败')) }, 'image/png')
      }
      img.onerror = function () { reject(new Error('加载 SVG 失败')) }
      img.src = svgUri
    } catch (e) { reject(e) }
  }

  // ========== 全屏查看 ==========

  function openFullscreen(mermaidDiv, mermaidSourceCode) {
    var existing = document.getElementById('mermaid-fullscreen-container')
    if (existing) existing.remove()

    var chatWindow = document.getElementById('pet-chat-window')
    if (!chatWindow) return

    var chatRect = chatWindow.getBoundingClientRect()

    var fullscreenContainer = document.createElement('div')
    fullscreenContainer.id = 'mermaid-fullscreen-container'
    fullscreenContainer.className = 'mermaid-fullscreen-container'
    fullscreenContainer.style.top = chatRect.top + 'px'
    fullscreenContainer.style.left = chatRect.left + 'px'
    fullscreenContainer.style.width = chatRect.width + 'px'
    fullscreenContainer.style.height = chatRect.height + 'px'
    fullscreenContainer.style.zIndex = '2147483649'

    var headerBar = document.createElement('div')
    headerBar.className = 'mermaid-fullscreen-header'

    var title = document.createElement('div')
    title.textContent = 'Mermaid 图表全屏查看'
    title.className = 'mermaid-fullscreen-title'

    var closeButton = document.createElement('button')
    closeButton.innerHTML = '✕'
    closeButton.title = '关闭全屏'
    closeButton.className = 'mermaid-fullscreen-close'
    closeButton.addEventListener('click', function () { fullscreenContainer.remove() })

    headerBar.appendChild(title)
    headerBar.appendChild(closeButton)

    var contentArea = document.createElement('div')
    contentArea.className = 'mermaid-fullscreen-content'

    var clonedMermaid = mermaidDiv.cloneNode(true)
    clonedMermaid.classList.add('mermaid-fullscreen-mermaid')
    var clonedActions = clonedMermaid.querySelector('.mermaid-actions')
    if (clonedActions) clonedActions.remove()

    contentArea.appendChild(clonedMermaid)
    fullscreenContainer.appendChild(headerBar)
    fullscreenContainer.appendChild(contentArea)
    document.body.appendChild(fullscreenContainer)

    // 如果克隆的图表 SVG 不存在，需要重新渲染
    if (!clonedMermaid.querySelector('svg')) {
      var content = mermaidSourceCode || clonedMermaid.getAttribute('data-mermaid-source') || clonedMermaid.textContent || ''
      if (content.trim()) {
        var clonedId = 'mermaid-fullscreen-' + Date.now()
        clonedMermaid.id = clonedId
        clonedMermaid.textContent = content

        setTimeout(function () {
          DomHelper.runPageScriptWithData({
            scriptSrc: chrome.runtime.getURL('cdn/markdown/mermaid-page-render.js'),
            dataContainerId: '__mermaid_render_id_container__' + clonedId,
            dataAttributes: { 'data-mermaid-id': clonedId },
            successEvent: 'mermaid-rendered',
            timeoutMs: 15000,
            cleanupDelayMs: 1000,
            isSuccess: function (e) { return e && e.detail && e.detail.id === clonedId }
          })
        }, 100)
      }
    }
  }

  // ========== 导出 ==========

  window.MermaidRenderer = {
    loadMermaid: loadMermaid,
    renderBlocks: renderBlocks,
    addActions: addActions,
    openFullscreen: openFullscreen
  }
})()
