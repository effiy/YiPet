/**
 * faq-panel.js — FAQ accordion panel
 *
 * Static FAQ data with cross-panel links.
 * Depends on: panel-hub.js (loaded first)
 */
(function() {
  'use strict';
  var H = window.PanelHub;
  if (!H) { console.error('faq-panel: PanelHub required'); return; }

  var faqPanelBody = document.getElementById('faqPanelBody');

  /* ── Registration ───────────────────────── */
  H.register('faq', null, 'faqPanel', 'faqOverlay', null);

  /* ── FAQ data ───────────────────────────── */
  var faqs = [
    { q: 'YrY 是什么？', a: 'YrY 是一个<strong>故事驱动的 SDLC 编排系统</strong>（Story-driven SDLC orchestrator），运行在 Claude Code 插件之上。它用自身管线管理自身演进（自托管），包含 18 个技能、9 个 Agent 角色、12 条规则和 9 维度健康检查。其运行状态通过四个面板实时呈现：' + H.panelLink('notify', '🔔 通知中心') + '、' + H.panelLink('cron', '⏰ 调度任务') + '、' + H.panelLink('selfimprove', '🧬 自改进分析') + ' 和本 FAQ。' },
    { q: '如何使用 /rui 命令？', a: '在 Claude Code 中输入 <code>/rui</code> 即可启动<strong>故事驱动的开发管线</strong>。该管线包含：创建故事 → 设计场景 → 生成文档 → 编码实现 → 测试验证 → 交付收口。每个阶段都有 Gate 检查，确保 P0 问题清零后才进入下一模块。各阶段产出的通知会汇总到 ' + H.panelLink('notify', '🔔 通知中心') + '。详见 <a href="../skills/rui/SKILL.md" target="_blank">rui 技能规约</a>。' },
    { q: '四个面板之间有什么关系？', a: '四个面板构成<strong>观察-调度-诊断-解惑</strong>闭环：<br>1. ' + H.panelLink('cron', '⏰ 调度任务面板') + ' 是引擎 — 定时触发健康检查、自循环报告等任务；<br>2. ' + H.panelLink('notify', '🔔 通知中心') + ' 是汇总 — 接收调度任务产出的健康/循环/趋势三类通知，展示最新结果和变化摘要；<br>3. ' + H.panelLink('selfimprove', '🧬 自改进分析面板') + ' 是深度分析 — 从通知的原始数据中提取趋势、诊断覆盖率、效果评级，按日/周/月/全景四个维度展示；<br>4. ❓ FAQ 是知识入口 — 解释以上三个面板的用途和关系。<br><strong>数据流</strong>：Cron 触发 → 技能执行 → 通知产出 → 通知面板展示 → 数据写入 memory → 自改进分析消费。' },
    { q: '页面上的面板按钮分别是什么？', a: '页面顶部 ' + H.panelLink('notify', '<span style="color:#ef4444">🔔 通知</span>') + ' 按钮打开通知中心面板；<br>' + H.panelLink('cron', '<span style="color:#22d3ee">⏰ 调度</span>') + ' 按钮打开调度任务面板；<br>' + H.panelLink('selfimprove', '<span style="color:#a78bfa">🧬 自改进</span>') + ' 按钮打开自改进分析面板；<br><span style="color:#22c55e">❓ FAQ</span> 按钮打开本面板。<br>所有面板按钮集中在顶部的<strong>实时监控栏</strong>中，各面板<strong>互斥打开</strong>— 打开一个会自动关闭其他已打开的面板。' },
    { q: '健康检查如何工作？', a: '系统每 30 分钟自动运行一次<strong>9 维度健康诊断</strong>（通过 ' + H.panelLink('cron', '⏰ 调度任务') + ' 触发），覆盖：插件一致性、技能规约、Agent 角色、规则、共享库、测试、文档、Git 状态、自改进。每次诊断结果写入 <code>.memory/health-trend.jsonl</code>，可生成 HTML 报告并通过企微机器人推送。运行 <code>node skills/rui-bot/send.mjs health</code> 可手动触发。结果查看：' + H.panelLink('notify', '🔔 通知面板') + ' 的「健康」标签 或 ' + H.panelLink('selfimprove', '🧬 自改进面板') + ' 的日报/周报视图。' },
    { q: '技能（Skill）、Agent、规则（Rule）三者有什么区别？', a: '<strong>技能（Skill）</strong> 是可执行的能力单元，每个技能有完整的 SKILL.md 规约和可执行脚本；<strong>Agent</strong> 是角色化的决策者，有独立的行为纪律和判断准则，可调用技能完成复杂任务；<strong>规则（Rule）</strong> 是行为约束和设计原则，定义了不可妥协的底线和最佳实践。三者关系：Agent 调用 Skill，Rule 约束 Agent。' },
    { q: '如何参与贡献或修改 YrY？', a: 'YrY 通过自身 <code>/rui</code> 管线管理演进：<br>1. 在 <code>docs/故事任务面板/</code> 创建或认领一个故事<br>2. 使用 <code>feat/&lt;name&gt;</code> 分支隔离工作<br>3. 按场景（Scene）逐步实现，每个场景通过 Gate A/B 检查<br>4. 交付前通过 rui-bot 通知收口（通知会出现在 ' + H.panelLink('notify', '🔔 通知中心') + '）<br>详见 <a href="../agents/AGENT.md" target="_blank">Agent 角色与规则</a>。' },
    { q: '文档中心（本页）展示什么内容？', a: '本页是 YrY 的<strong>文档索引中心</strong>，按六层结构组织：依赖/框架 → 19 技能 → 4 故事 → 21 场景 → Agent 角色与规则 → 参考入口。每张卡片可点击跳转到对应规约文件。顶部的实时监控栏可打开通知/调度/自改进/FAQ 四个面板，提供系统运行状态的实时视图。' },
    { q: '调度任务（Cron）面板显示什么？', a: '调度任务面板读取 <code>.claude/scheduled_tasks.json</code> 文件，展示所有通过 <code>/loop</code> 命令创建的定时任务。每个任务显示 cron 表达式、人类可读描述、创建时间、上次触发时间、预计下次触发时间和原始 prompt。绿色脉冲点表示活跃任务，灰色点表示空闲。' + H.panelLink('cron', '点击打开调度面板') + ' 查看当前所有任务。' },
    { q: '自改进分析面板如何使用？', a: '自改进面板读取 <code>.memory/health-trend.jsonl</code> 和 <code>.memory/summary.json</code>，提供四个时间维度：<br><strong>日报</strong> — 当日所有健康检查的时间线，含分数、诊断标签、分支信息；<br><strong>周报</strong> — 本周每日汇总、维度矩阵、趋势信号；<br><strong>月报</strong> — 月度汇总、评级分布、改进/退化信号；<br><strong>全景</strong> — 最新快照、分支对比、诊断覆盖率图表。' + H.panelLink('selfimprove', '点击打开自改进面板') + ' 查看详细分析。' },
    { q: '哪些技能与监控面板相关？', a: '<strong>技能 → 面板映射</strong>：<br>🩺 <strong>rui-bot</strong> → ' + H.panelLink('notify', '通知面板') + '（健康检查、自循环、趋势三类通知的产出者）<br>🔄 <strong>rui-import</strong> → ' + H.panelLink('notify', '通知面板') + '（文档同步结果通知）<br>🧬 <strong>rui-claude</strong> → ' + H.panelLink('selfimprove', '自改进面板') + '（.claude/ 健康分析与诊断）<br>📋 <strong>rui-story</strong> → ' + H.panelLink('cron', '调度面板') + '（故事状态轮询任务）<br>📄 <strong>rui-html</strong> → ' + H.panelLink('notify', '通知面板') + '（文档生成事件通知）<br>💬 <strong>rui-bot</strong> → ' + H.panelLink('selfimprove', '自改进面板') + '（企微推送结果计入趋势）' },
    { q: '通知面板中的三类通知有什么区别？', a: '<strong>🩺 健康通知</strong> — 来自 <code>node skills/rui-bot/send.mjs health</code> 的输出，展示 9 维度健康评分（A/B/C/D 四级）、触发的诊断 ID（D0-D7）、机器人就绪状态、维度评分分布和建议措施。<br><strong>🔄 自循环通知</strong> — 来自 12 个技能的定时巡检报告，每个报告包含通过/告警/异常状态、发现清单（按 info/warn/fail 分级）、健康交叉引用和建议措施。<br><strong>📡 趋势通知</strong> — 来自 GitHub Trending / OSS Insight / TrendShift / Top-Starred 的外部数据源扫描，展示可达性、条目数、可达率、趋势方向（上升/下降/平稳）和关键词标签。' },
    { q: '自改进面板的诊断等级（A/B/C/D）如何评定？', a: '诊断等级基于 9 维度的加权综合评分：<br><strong>A 级（≥90）</strong> — 全部维度健康，无 P0 阻断。<br><strong>B 级（≥75）</strong> — 少量维度需关注，建议修复 P1。<br><strong>C 级（≥60）</strong> — 多个维度告警，P0 需清零。<br><strong>D 级（＜60）</strong> — 严重退化，立即阻断并回溯根因。<br>等级分布和趋势走势可在自改进面板的「全景」视图和日/周/月报中查看。' },
    { q: 'YrY 的设计原则是什么？', a: 'YrY 遵循<strong>六条自有设计哲学</strong>（涌现 · 简化 · 消失 · 校准 · 释义 · 对等）和<strong>九条工程原则</strong>（单一职责 · 高内聚 · 低耦合 · 依赖倒置 · 开闭原则 · 接口隔离 · DRY · YAGNI · 组合优于继承）。详见 <a href="../rules/design-principles.md" target="_blank">设计原则规约</a>。每项 Agent/Skill/Lib 审查时两套原则并用：六条定方向，九条定结构。' },
    { q: '如何进行版本升级？', a: '使用 <code>/rui-version --up</code>（或 <code>/rui version --up</code>）触发全自主版本升级：分析变更范围 → 判定 PATCH/MINOR/MAJOR → 同步更新 plugin.json、marketplace.json、CLAUDE.md、README.md 四个版本文件 → git commit + tag + push。使用 <code>/rui-version --rollback &lt;name&gt;</code> 可回退。版本管理严格遵循：不降级、四文件同步、不跳号、仅 main 分支操作。' },
    { q: '如何生成健康报告 HTML？', a: '运行 <code>node skills/rui-bot/send.mjs health --html</code> 生成最新健康报告并保存到 <code>docs/健康报告/</code> 目录。报告包含：综合评分卡片、9 维度详细评分（含建议措施）、D0-D7 诊断触发、机器人就绪状态、执行记忆统计。生成后自动出现在 ' + H.panelLink('notify', '🔔 通知面板') + ' 的「健康」标签中。若配置了企微机器人，还会通过 Webhook 推送 Rich/Verbose 格式通知。' },
    { q: '通知面板的数据来自哪里？如何保证新鲜度？', a: '通知面板的三类数据源各有独立的新鲜度保障：<br><strong>健康报告</strong> — 由 ' + H.panelLink('cron', '⏰ 调度任务') + ' 中的 <code>health-check</code> 任务每 30 分钟自动运行 <code>send.mjs health --html</code> 生成。<br><strong>自循环报告</strong> — 由 12 个技能的独立 cron 任务按各自间隔触发（从每 5 分钟到每周一），见 ' + H.panelLink('cron', '调度面板') + ' 中的任务列表。<br><strong>趋势报告</strong> — 从 GitHub Trending / OSS Insight 等外部源扫描，结果写入 <code>docs/趋势报告/reports.json</code> 清单。<br>面板每次打开时自动拉取最新索引，支持手动刷新（点击 🔄 按钮）。' }
  ];

  /* ── Render ─────────────────────────────── */
  function renderFaq() {
    var ctxHtml = '<div style="padding:10px 20px;font-size:.64rem;color:var(--text-muted);border-bottom:1px solid rgba(255,255,255,.04);line-height:1.6">'
      + '<strong>YrY 知识库</strong> — ' + faqs.length + ' 个常见问题，覆盖：系统概念 · 命令使用 · 面板关系 · 健康检查 · 设计原则 · 版本管理。<br>点击问题展开答案。彩色链接可快速打开对应面板。</div>';
    var html = ctxHtml + '<ul class="faq-list">';
    for (var i = 0; i < faqs.length; i++) {
      html += '<li class="faq-item">'
        + '<div class="faq-q" data-index="' + i + '"><span class="faq-q-icon">Q:</span>' + H.escHtml(faqs[i].q) + '</div>'
        + '<div class="faq-a">' + faqs[i].a + '</div>'
        + '</li>';
    }
    html += '</ul>';
    faqPanelBody.innerHTML = html;
  }

  /* ── Accordion ──────────────────────────── */
  faqPanelBody.addEventListener('click', function(e) {
    if (e.target.closest('a')) return;
    var q = e.target.closest('.faq-q');
    if (!q) return;
    e.stopPropagation();
    var item = q.closest('.faq-item');
    if (item.classList.contains('open')) {
      item.classList.remove('open');
    } else {
      var allItems = faqPanelBody.querySelectorAll('.faq-item.open');
      for (var i = 0; i < allItems.length; i++) { allItems[i].classList.remove('open'); }
      item.classList.add('open');
    }
  });

  /* ── Initial render ─────────────────────── */
  renderFaq();
})();
