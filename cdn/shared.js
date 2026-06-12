/* ═══════════════════════════════════════════════════════════════════════════
   YrY Shared JS — 所有故事面板 HTML 页面的公共脚本
   适用: 审查 · 测试面板 · 演示 · 计划清单 · 架构图 · 知识图谱

   使用方式:
     <script src="../../../../cdn/shared.js"></script>
     然后调用: YrY.toast('消息') / YrY.copyCmd(btn, cmd) / YrY.switchPanel(name)

   对应场景文档:
     - docs/故事任务面板/yry-cdn/场景-1-cdn资源加载与页面渲染/
     - docs/故事任务面板/yry-cdn/场景-3-组件库与JS工具API/
     - docs/故事任务面板/yry-cdn/场景-4-存量页面迁移/
     - docs/故事任务面板/yry-cdn/场景-5-npm包发布与版本管理/
   ═══════════════════════════════════════════════════════════════════════════ */

const YrY = (function() {
  'use strict';

  /* ── Toast ────────────────────────────────────────────────────────────── */
  function toast(msg, duration) {
    duration = duration || 1800;
    var el = document.querySelector('.yry-toast');
    if (!el) { el = document.createElement('div'); el.className = 'yry-toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function() { el.classList.remove('show'); }, duration);
  }

  /* ── Copy command to clipboard ────────────────────────────────────────── */
  function copyCmd(btn, cmd) {
    var orig = btn.textContent;
    navigator.clipboard.writeText(cmd).then(function() {
      btn.textContent = '✅';
      btn.classList.add('done');
      setTimeout(function() { btn.textContent = orig; btn.classList.remove('done'); }, 1500);
    }).catch(function() { toast('复制失败'); });
  }

  /* ── Tab panel switching ──────────────────────────────────────────────── */
  function switchPanel(name, tabSelector, panelSelector) {
    tabSelector = tabSelector || '.yry-tab';
    panelSelector = panelSelector || '.yry-panel';
    document.querySelectorAll(tabSelector).forEach(function(t) {
      t.classList.toggle('on', t.dataset.panel === name);
    });
    document.querySelectorAll(panelSelector).forEach(function(p) {
      p.classList.toggle('on', p.id === 'panel' + name.charAt(0).toUpperCase() + name.slice(1));
    });
  }

  /* ── Suite / Collapsible toggle ───────────────────────────────────────── */
  function initSuiteToggle(containerSelector) {
    var container = document.querySelector(containerSelector || '.yry-container');
    if (!container) container = document;
    container.addEventListener('click', function(e) {
      var head = e.target.closest('.yry-suite-head');
      if (!head) return;
      head.closest('.yry-suite').classList.toggle('open');
    });
  }

  /* ── Expand / Collapse all suites ─────────────────────────────────────── */
  function expandAllSuites(scope) {
    (scope || document).querySelectorAll('.yry-suite').forEach(function(s) { s.classList.add('open'); });
  }
  function collapseAllSuites(scope) {
    (scope || document).querySelectorAll('.yry-suite').forEach(function(s) { s.classList.remove('open'); });
  }

  /* ── Format duration (ms → human readable) ────────────────────────────── */
  function fmtDur(ms) {
    if (ms == null) return '';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return Math.round(ms) + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }

  /* ── HTML escape ──────────────────────────────────────────────────────── */
  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Clipboard write fallback ─────────────────────────────────────────── */
  function clipboardWrite(text, onSuccess, onFail) {
    navigator.clipboard.writeText(text).then(function() {
      if (onSuccess) onSuccess();
    }).catch(function() {
      if (onFail) onFail(); else toast('复制失败');
    });
  }

  /* ── Public API ───────────────────────────────────────────────────────── */
  return {
    toast: toast,
    copyCmd: copyCmd,
    switchPanel: switchPanel,
    initSuiteToggle: initSuiteToggle,
    expandAllSuites: expandAllSuites,
    collapseAllSuites: collapseAllSuites,
    fmtDur: fmtDur,
    esc: esc,
    clipboardWrite: clipboardWrite
  };
})();
