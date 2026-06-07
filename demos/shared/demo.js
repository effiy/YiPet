/* ═══════════════════════════════════════════════════════════
   demo.js — YiPet Demo 中心共享 JavaScript
   所有 demo 页面通过 <script> 引用此文件，消除重复的工具函数
   ═══════════════════════════════════════════════════════════ */

window.YipDemo = window.YipDemo || {};

/* ── Color utilities ───────────────────── */

/** 6 位 hex (#RRGGBB) → { r, g, b } */
YipDemo.toRgbFromHex = function (hex) {
  var m = String(hex || '').trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return null;
  var v = m[1];
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16)
  };
};

/** 整数钳制，非数字返回 min */
YipDemo.clampInt = function (n, min, max) {
  var x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(Math.max(x, min), max);
};

/** 颜色加深/减淡，ratio < 0 为加深 */
YipDemo.shadeHexColor = function (hex, ratio) {
  var rgb = YipDemo.toRgbFromHex(hex);
  if (!rgb) return null;
  var t = ratio < 0 ? 0 : 255;
  var p = Math.abs(Number(ratio));
  var r = YipDemo.clampInt((t - rgb.r) * p + rgb.r, 0, 255);
  var g = YipDemo.clampInt((t - rgb.g) * p + rgb.g, 0, 255);
  var b = YipDemo.clampInt((t - rgb.b) * p + rgb.b, 0, 255);
  return '#' + [r, g, b].map(function (c) { return c.toString(16).padStart(2, '0'); }).join('');
};

/* ── Logging helper ────────────────────── */

/** 向 output 元素追加日志行 */
YipDemo.log = function (elId, message, className) {
  var el = document.getElementById(elId);
  if (!el) return;
  var div = document.createElement('div');
  div.className = className || '';
  div.textContent = message;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
};

/** 清空 output 元素 */
YipDemo.clearLog = function (elId) {
  var el = document.getElementById(elId);
  if (el) el.innerHTML = '';
};

/* ── Clipboard ──────────────────────────── */

/** 复制文本到剪贴板 */
YipDemo.copyToClipboard = function (text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('Clipboard not available'));
};

/* ── Footer builder ────────────────────── */

/** 构建标准 demo 页脚 HTML */
YipDemo.footerHTML = function (sourceFiles, testFiles) {
  var html = '<footer><p>YiPet Demos · <a href="../">Demo 中心</a> · <a href="../../docs/">文档中心</a> · <a href="../../CLAUDE.md">CLAUDE.md</a></p>';
  if (sourceFiles || testFiles) {
    html += '<p style="margin-top:4px;">';
    if (sourceFiles) html += '相关源文件: <code>' + sourceFiles + '</code> ';
    if (testFiles) html += '· 相关测试: <code>' + testFiles + '</code>';
    html += '</p>';
  }
  html += '</footer>';
  return html;
};

/* ── Back to top ───────────────────────── */

YipDemo.initBackToTop = function () {
  var btn = document.getElementById('backTop');
  if (!btn) return;
  window.addEventListener('scroll', function () {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
};
