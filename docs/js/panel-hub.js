/**
 * PanelHub — unified floating panel manager
 *
 * Responsibilities:
 *   - Register panels (bell + panel + overlay)
 *   - Mutual exclusivity: opening one closes others
 *   - Unified Escape key handling
 *   - Cross-panel link helper
 *   - Data source path constants (single source of truth)
 */
(function() {
  'use strict';

  var registry = {};   // name → { bell, panel, overlay, onOpen }

  /* ── Data source paths ──────────────────── */
  var PATHS = {
    healthIndex:   './健康报告/index.html',
    loopIndex:     './自循环报告/index.html',
    trendManifest: './趋势报告/reports.json',
    summaryJson:   './自我改进/summary.json',
    healthTrend:   '../.memory/health-trend.jsonl',
    scheduledTasks:'../.claude/scheduled_tasks.json'
  };

  /* ── API ────────────────────────────────── */
  function register(name, bellId, panelId, overlayId, onOpen) {
    var bell = bellId ? document.getElementById(bellId) : null;
    var panel = document.getElementById(panelId);
    var overlay = document.getElementById(overlayId);
    if (!panel || !overlay) return;

    registry[name] = {
      bell:   bell,
      panel:  panel,
      overlay: overlay,
      onOpen: onOpen || null
    };
    var r = registry[name];

    // Wire toggle on bell click (only if bell exists)
    if (r.bell) {
      r.bell.addEventListener('click', function() {
        toggle(name);
      });
    }

    // Wire close on overlay click
    r.overlay.addEventListener('click', function() {
      close(name);
    });

    // Unified Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && r.panel.classList.contains('open')) {
        close(name);
      }
    });
  }

  function closeAllExcept(name) {
    Object.keys(registry).forEach(function(k) {
      if (k !== name) close(k);
    });
  }

  function open(name) {
    var r = registry[name];
    if (!r) return;
    closeAllExcept(name);
    r.panel.classList.add('open');
    r.overlay.classList.add('open');
    if (r.onOpen) r.onOpen();
  }

  function close(name) {
    var r = registry[name];
    if (!r) return;
    r.panel.classList.remove('open');
    r.overlay.classList.remove('open');
  }

  function toggle(name) {
    var r = registry[name];
    if (!r) return;
    if (r.panel.classList.contains('open')) {
      close(name);
    } else {
      open(name);
    }
  }

  function isOpen(name) {
    var r = registry[name];
    return r ? r.panel.classList.contains('open') : false;
  }

  /* ── Cross-panel link helper ────────────── */
  function panelLink(name, label) {
    return '<a href="#" onclick="event.preventDefault();event.stopPropagation();PanelHub.open(\'' + name + '\')" style="color:inherit;text-decoration:underline;text-underline-offset:2px;text-decoration-color:rgba(255,255,255,.2)">' + label + '</a>';
  }

  /* ── Shared XSS escape ──────────────────── */
  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ── Shared relative time ───────────────── */
  function relativeTime(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      var now = new Date();
      var diffMin = Math.floor((now - d) / 60000);
      var diffHr  = Math.floor((now - d) / 3600000);
      var diffDay = Math.floor((now - d) / 86400000);
      if (diffMin < 1)  return '刚刚';
      if (diffMin < 60) return diffMin + '分钟前';
      if (diffHr < 24)  return diffHr + '小时前';
      if (diffDay === 1) return '昨天';
      if (diffDay < 7)  return diffDay + '天前';
      if (diffDay < 30) return diffDay + '天前';
      var months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      return months[d.getMonth()] + d.getDate() + '日';
    } catch(e) { return dateStr; }
  }

  /* ── Expose ─────────────────────────────── */
  window.PanelHub = {
    register: register,
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    closeAllExcept: closeAllExcept,
    panelLink: panelLink,
    escHtml: escHtml,
    relativeTime: relativeTime,
    PATHS: PATHS
  };

  // Backward compat: window.openPanel dispatches through PanelHub
  window.openPanel = function(name) {
    PanelHub.open(name);
  };
})();
