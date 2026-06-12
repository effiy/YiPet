/* ═══════════════════════════════════════════════════════════
   kg-viewer.js — YiPet 知识图谱共享查看器

   从一个 <script type="application/json" id="kg-data"> 元素
   读取图谱数据，用 Cytoscape.js 渲染交互式知识图谱。

   使用方式:
     <script type="application/json" id="kg-data">
       { "nodes": [...], "edges": [...] }
     </script>
     <script src="../../shared/kg-viewer.js"></script>

   需要: cytoscape, html2canvas, jspdf (CDN 加载)
   ═══════════════════════════════════════════════════════════ */

;(function () {
  'use strict'

  var dataEl = document.getElementById('kg-data')
  if (!dataEl) {
    console.error('kg-viewer: 找不到 #kg-data 元素')
    return
  }

  var graphData
  try {
    graphData = JSON.parse(dataEl.textContent)
  } catch (e) {
    console.error('kg-viewer: JSON 解析失败', e)
    return
  }

  // ── Node style by type ──────────────────
  var NODE_STYLES = {
    story: { bg: 'rgba(236, 72, 153, 0.35)', border: '#EC4899', w: 70, h: 70, shape: 'rectangle', fw: '700' },
    scene: { bg: 'rgba(139, 92, 246, 0.35)', border: '#8B5CF6', w: 62, h: 62, shape: 'round-rectangle', fw: '600' },
    source: { bg: 'rgba(59, 130, 246, 0.35)', border: '#3B82F6', w: 50, h: 50, shape: 'ellipse', fw: '400' },
    lib: { bg: 'rgba(251, 191, 36, 0.3)', border: '#fbbf24', w: 48, h: 48, shape: 'ellipse', fw: '400' },
    config: { bg: 'rgba(34, 211, 238, 0.3)', border: '#22d3ee', w: 48, h: 48, shape: 'ellipse', fw: '400' },
    test: { bg: 'rgba(52, 211, 153, 0.3)', border: '#34d399', w: 48, h: 48, shape: 'ellipse', fw: '400' },
  }

  function styleForType(type) {
    return NODE_STYLES[type] || NODE_STYLES.source
  }

  // ── Build cytoscape styles ──────────────
  var cyStyles = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'font-family': 'JetBrains Mono, monospace',
        'font-size': '9px',
        color: '#e2e8f0',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '100px',
        'border-width': 2,
        'background-opacity': 0.9,
        'transition-property': 'background-color, border-color, width, height',
        'transition-duration': '0.2s',
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.2,
        'line-color': '#334155',
        'target-arrow-color': '#334155',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.8,
        'curve-style': 'bezier',
        opacity: 0.6,
      },
    },
    {
      selector: 'node:selected',
      style: { 'border-width': 3, 'border-color': '#fff', 'z-index': 999 },
    },
    {
      selector: 'edge:selected',
      style: { width: 3, 'line-color': '#fff', 'target-arrow-color': '#fff', opacity: 1, 'z-index': 999 },
    },
  ]

  // Per-type styles
  Object.keys(NODE_STYLES).forEach(function (type) {
    var s = NODE_STYLES[type]
    cyStyles.push({
      selector: 'node[type="' + type + '"]',
      style: {
        'background-color': s.bg,
        'border-color': s.border,
        width: s.w,
        height: s.h,
        'font-weight': s.fw,
        shape: s.shape,
      },
    })
  })

  // Per-layer styles (fallback when type is generic 'source')
  var LAYER_COLORS = {
    core: { bg: 'rgba(59, 130, 246, 0.35)', border: '#3B82F6' },
    libs: { bg: 'rgba(251, 191, 36, 0.3)', border: '#fbbf24' },
    cdn: { bg: 'rgba(167, 139, 250, 0.35)', border: '#a78bfa' },
    pet: { bg: 'rgba(52, 211, 153, 0.35)', border: '#34d399' },
    extension: { bg: 'rgba(251, 113, 133, 0.35)', border: '#fb7185' },
    faq: { bg: 'rgba(148, 163, 184, 0.35)', border: '#94a3b8' },
    L1: { bg: 'rgba(251, 191, 36, 0.25)', border: '#fbbf24' },
    L2: { bg: 'rgba(139, 92, 246, 0.3)', border: '#8B5CF6' },
    L3: { bg: 'rgba(59, 130, 246, 0.3)', border: '#3B82F6' },
  }

  Object.keys(LAYER_COLORS).forEach(function (layer) {
    var c = LAYER_COLORS[layer]
    cyStyles.push({
      selector: 'node[layer="' + layer + '"]',
      style: {
        'background-color': c.bg,
        'border-color': c.border,
      },
    })
  })

  // Edge type styles
  var EDGE_STYLES = {
    contains: { color: '#8B5CF6', width: 1.5, opacity: 0.7, style: 'solid' },
    depends_on: { color: '#3B82F6', width: 1.5, opacity: 0.7, style: 'solid' },
    references: { color: '#22d3ee', width: 1.2, opacity: 0.6, style: 'solid' },
    imports: { color: '#22d3ee', width: 1, opacity: 0.5, style: 'dashed' },
    shares: { color: '#fbbf24', width: 1, opacity: 0.5, style: 'dashed' },
    validates: { color: '#34d399', width: 1.2, opacity: 0.6, style: 'solid' },
    configures: { color: '#a78bfa', width: 1, opacity: 0.5, style: 'dashed' },
    declared_in: { color: '#94a3b8', width: 1, opacity: 0.4, style: 'dotted' },
  }

  Object.keys(EDGE_STYLES).forEach(function (type) {
    var s = EDGE_STYLES[type]
    cyStyles.push({
      selector: 'edge[type="' + type + '"]',
      style: {
        'line-color': s.color,
        'target-arrow-color': s.color,
        width: s.width,
        opacity: s.opacity,
        'line-style': s.style,
      },
    })
  })

  // ── Initialize Cytoscape ────────────────
  var cy = cytoscape({
    container: document.getElementById('cy'),
    style: cyStyles,
    elements: graphData,
    layout: {
      name: 'breadthfirst',
      directed: true,
      spacingFactor: 1.4,
      padding: 30,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
    },
    wheelSensitivity: 0.3,
    minZoom: 0.3,
    maxZoom: 3,
  })

  // ── Click to highlight neighbors ────────
  cy.on('tap', 'node', function (evt) {
    var node = evt.target
    var hood = node.closedNeighborhood()
    cy.elements().style('opacity', 0.15)
    hood.style('opacity', 1)
    node.style('opacity', 1)
  })

  cy.on('tap', function (evt) {
    if (evt.target === cy) {
      cy.elements().style('opacity', 0.85)
    }
  })

  // ── Export: Copy as image ──────────────
  window.kgCopyAsImage = function (btn) {
    var orig = btn.textContent
    try {
      var el = document.getElementById('report-container')
      var r = el.getBoundingClientRect()
      var pad = 32
      html2canvas(document.body, {
        backgroundColor: '#020617',
        scale: 2,
        useCORS: true,
        ignoreElements: function (e) {
          return e.classList && e.classList.contains('toolbar')
        },
        x: r.left + window.scrollX - pad,
        y: r.top + window.scrollY - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      })
        .then(function (canvas) {
          return new Promise(function (resolve) {
            canvas.toBlob(resolve, 'image/png')
          })
        })
        .then(function (blob) {
          return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        })
        .then(function () {
          btn.textContent = '✓ Copied!'
        })
        .catch(function () {
          btn.textContent = '✗ Failed'
        })
    } catch (e) {
      btn.textContent = '✗ Failed'
    }
    setTimeout(function () {
      btn.textContent = orig
    }, 2000)
  }

  // ── Export: Download PNG ───────────────
  window.kgDownloadPNG = function (btn) {
    var orig = btn.textContent
    btn.textContent = '⏳ ...'
    try {
      var el = document.getElementById('report-container')
      var r = el.getBoundingClientRect()
      var pad = 32
      html2canvas(document.body, {
        backgroundColor: '#020617',
        scale: 2,
        useCORS: true,
        ignoreElements: function (e) {
          return e.classList && e.classList.contains('toolbar')
        },
        x: r.left + window.scrollX - pad,
        y: r.top + window.scrollY - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      })
        .then(function (canvas) {
          var link = document.createElement('a')
          link.download = 'knowledge-graph.png'
          link.href = canvas.toDataURL('image/png')
          link.click()
          btn.textContent = '✓ Done!'
        })
        .catch(function () {
          btn.textContent = '✗ Failed'
        })
    } catch (e) {
      btn.textContent = '✗ Failed'
    }
    setTimeout(function () {
      btn.textContent = orig
    }, 2000)
  }

  // ── Export: Download PDF ───────────────
  window.kgDownloadPDF = function (btn) {
    var orig = btn.textContent
    btn.textContent = '⏳ ...'
    try {
      var el = document.getElementById('report-container')
      var r = el.getBoundingClientRect()
      var pad = 32
      html2canvas(document.body, {
        backgroundColor: '#020617',
        scale: 2,
        useCORS: true,
        ignoreElements: function (e) {
          return e.classList && e.classList.contains('toolbar')
        },
        x: r.left + window.scrollX - pad,
        y: r.top + window.scrollY - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      })
        .then(function (canvas) {
          var imgData = canvas.toDataURL('image/png')
          var jsPDF = window.jspdf.jsPDF
          var orientation = canvas.width > canvas.height ? 'landscape' : 'portrait'
          var pdf = new jsPDF({
            orientation: orientation,
            unit: 'px',
            format: [canvas.width, canvas.height],
            hotfixes: ['px_scaling'],
          })
          pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
          pdf.save('knowledge-graph.pdf')
          btn.textContent = '✓ Done!'
        })
        .catch(function () {
          btn.textContent = '✗ Failed'
        })
    } catch (e) {
      btn.textContent = '✗ Failed'
    }
    setTimeout(function () {
      btn.textContent = orig
    }, 2000)
  }
})()
