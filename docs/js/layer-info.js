/**
 * layer-info.js — layer detail popup panel
 *
 * Each layer-header dot opens this panel with layer-specific content.
 */
var layerInfo = (function() {
  'use strict';
  var H = window.PanelHub;

  var overlay = document.getElementById('layerInfoOverlay');
  var panel   = document.getElementById('layerInfoPanel');
  var title   = document.getElementById('layerInfoTitle');
  var body    = document.getElementById('layerInfoBody');

  var DATA = {
    deps: {
      title: '&#128230; 第三方依赖与框架',
      content: '<p style="color:var(--text-secondary);margin-bottom:12px">YrY 运行和开发所依赖的外部资源，按职责分为运行时和开发两类。</p>'
        + '<h3 style="color:var(--color-accent);font-size:.78rem;margin:12px 0 6px">运行时依赖 (6)</h3>'
        + '<table style="width:100%;font-size:.7rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.04)"><code>yry-cdn-lib</code></td><td>自建 CDN 共享库 — 双主题 + 21 CSS 组件 + 9 JS API</td></tr>'
        + '<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.04)"><code>Cytoscape.js</code></td><td>知识图谱交互式可视化引擎</td></tr>'
        + '<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.04)"><code>html2canvas</code></td><td>架构图 DOM → Canvas 截图导出</td></tr>'
        + '<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.04)"><code>jsPDF</code></td><td>客户端 PDF 生成引擎</td></tr>'
        + '<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.04)"><code>api.effiy.cn</code></td><td>远端文档 CRUD API（自建）</td></tr>'
        + '<tr><td style="padding:4px 8px"><code>企业微信 Webhook</code></td><td>企微群机器人消息推送</td></tr>'
        + '</table>'
        + '<h3 style="color:var(--color-accent);font-size:.78rem;margin:12px 0 6px">开发依赖 (4)</h3>'
        + '<table style="width:100%;font-size:.7rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.04)"><code>Node.js 内置模块</code></td><td>fs/path/child_process/crypto/http — 零 npm 运行时依赖</td></tr>'
        + '<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.04)"><code>vitest</code></td><td>ESM 原生测试框架 + 覆盖率</td></tr>'
        + '<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.04)"><code>@vitest/ui</code></td><td>测试可视化仪表盘</td></tr>'
        + '<tr><td style="padding:4px 8px"><code>chrome-devtools-mcp</code></td><td>程序化浏览器验证（CDN 加载链路）</td></tr>'
        + '</table>'
    },
    story: {
      title: '&#128214; 故事 — 项目核心工作单元',
      content: '<p style="color:var(--text-secondary);margin-bottom:12px">故事是管线中单一、独立、可完成的作业单元。每个故事内聚在 <code>docs/故事任务面板/&lt;name&gt;/</code> 目录。</p>'
        + '<table style="width:100%;font-size:.7rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)">yry-arch</td><td style="padding:6px 8px">系统架构知识固化 — 4 场景：模块定位 · 数据流追踪 · 新人上手 · 依赖变更影响</td><td style="padding:6px 8px;white-space:nowrap;color:var(--color-accent)">v1.0.0</td></tr>'
        + '<tr><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)">yry-self-test</td><td style="padding:6px 8px">自主测试方案 — 项目的免疫系统：4 场景全量/增量自检</td><td style="padding:6px 8px;white-space:nowrap;color:var(--color-accent)">v1.1.0</td></tr>'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)">rui-npm</td><td style="padding:6px 8px">npm 包管理工具 — 5 场景：搜索/安装/发布/审计/账号管理。32 文件 · 77 测试</td><td style="padding:6px 8px;white-space:nowrap;color:var(--color-accent)">v1.1.0</td></tr>'
        + '<tr><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)">yry-cdn</td><td style="padding:6px 8px">CDN 共享前端资源库 — 5 场景：双主题系统 · 21 组件 · 9 API</td><td style="padding:6px 8px;white-space:nowrap;color:var(--color-accent)">v1.0.0</td></tr>'
        + '</table>'
        + '<p style="font-size:.64rem;color:var(--text-muted);margin-top:10px">📖 每个故事含：故事任务.md + 场景-N-&lt;slug&gt;.md §0-§4 + knowledge-graph.json</p>'
    },
    scene: {
      title: '&#127916; 场景 — 21 个独立可验证的交付切片',
      content: '<p style="color:var(--text-secondary);margin-bottom:12px">每个场景含 7 类标准 HTML 文档：计划清单 · 架构图 · 知识图谱 · 源码 · 测试面板 · 演示 · 审查。</p>'
        + '<h3 style="color:var(--color-accent);font-size:.78rem;margin:12px 0 6px">按故事分组</h3>'
        + '<table style="width:100%;font-size:.68rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)">📐 yry-arch</td><td style="padding:4px 8px">4 场景</td><td style="padding:4px 8px">模块定位 · 数据流追踪 · 新人上手 · 依赖变更影响</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)">🧪 yry-self-test</td><td style="padding:4px 8px">4 场景</td><td style="padding:4px 8px">init 后全量自检 · commit 前增量 · 文档代码一致性 · 安全面回归</td></tr>'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)">📦 rui-npm</td><td style="padding:4px 8px">5 场景</td><td style="padding:4px 8px">搜索与发现 · 安装与版本 · 发布与 npx · 审计与卸载 · 账号管理</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)">🌐 yry-cdn</td><td style="padding:4px 8px">5 场景</td><td style="padding:4px 8px">资源加载 · 双主题 · 组件与 API · 页面迁移 · 发布与版本</td></tr>'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)">🎬 演示中心</td><td style="padding:4px 8px">3 场景</td><td style="padding:4px 8px">架构/自检/npm 三大演示入口</td></tr>'
        + '</table>'
    },
    skills: {
      title: '&#9889; 技能 — 19 能力模块',
      content: '<p style="color:var(--text-secondary);margin-bottom:12px">技能是单一职责的能力模块，通过 <code>/rui</code> 编排器路由。按 SRP 拆分为编排入口、管线子技能、支撑技能、新增技能四组。</p>'
        + '<h3 style="color:var(--color-accent);font-size:.78rem;margin:12px 0 6px">编排入口 (1)</h3>'
        + '<table style="width:100%;font-size:.68rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr><td style="padding:3px 8px"><code>rui</code></td><td style="padding:3px 8px">故事驱动 SDLC 编排器 — 命令路由 + 推荐引擎，委托 7 子技能</td></tr>'
        + '</table>'
        + '<h3 style="color:var(--color-accent);font-size:.78rem;margin:12px 0 6px">管线子技能 (7)</h3>'
        + '<table style="width:100%;font-size:.68rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr><td style="padding:3px 8px"><code>rui-init</code></td><td style="padding:3px 8px">项目基线建立 — detect → explore → generate → arch → setup → verify</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-doc</code></td><td style="padding:3px 8px">Markdown 文档基线 — 需求→故事拆分→文档基线，3 模式</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-plan</code></td><td style="padding:3px 8px">实施计划 — 文件映射→任务分解→六项自审查→plan.html</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-code</code></td><td style="padding:3px 8px">源码实现管线 — 分支隔离→Gate A→逐模块 P0 清零→Gate B→交付</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-update</code></td><td style="padding:3px 8px">增量更新 — T1/T2/T3 变更范围自动裁剪管线</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-yry</code></td><td style="padding:3px 8px">自改进闭环 — 全自主扫描→诊断→实现→验证→版本升级</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-version</code></td><td style="padding:3px 8px">版本管理 — 语义版本判定→四文件更新→commit+tag+push</td></tr>'
        + '</table>'
        + '<h3 style="color:var(--color-accent);font-size:.78rem;margin:12px 0 6px">支撑技能 (8)</h3>'
        + '<table style="width:100%;font-size:.68rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr><td style="padding:3px 8px"><code>rui-html</code></td><td style="padding:3px 8px">HTML 文档生成 — 7 类标准 HTML（计划/架构/图谱/源码/测试/演示/审查）</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-story</code></td><td style="padding:3px 8px">故事面板管理 — list/sync/remove/health</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-claude</code></td><td style="padding:3px 8px">.claude/ 配置管理 — sync/update/retro/history</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-import</code></td><td style="padding:3px 8px">文档同步 — 本地↔远端 API 双向同步，并发≤4</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-skills</code></td><td style="padding:3px 8px">技能市场 — 发现和安装 Claude/Agent 技能包 <span style="color:var(--color-accent)">v5.0</span></td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-bot</code></td><td style="padding:3px 8px">企微消息推送 — Rich/Verbose + Dry-Run + 失败队列重试</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-health</code></td><td style="padding:3px 8px">系统健康诊断 — 9 维度 + 7 工程成熟度 · HTML 报告 <span style="color:var(--color-accent)">v5.0</span></td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-trends</code></td><td style="padding:3px 8px">技术趋势发现 — GitHub Trending/OSS Insight/TrendShift</td></tr>'
        + '</table>'
        + '<h3 style="color:var(--color-accent);font-size:.78rem;margin:12px 0 6px">npm 支撑 (1)</h3>'
        + '<table style="width:100%;font-size:.68rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr><td style="padding:3px 8px"><code>rui-npm</code></td><td style="padding:3px 8px">npm 包管理 — 14 子命令：search/install/publish/npx/audit/cdn 等</td></tr>'
        + '</table>'
        + '<h3 style="color:var(--color-accent);font-size:.78rem;margin:12px 0 6px">新增技能 (2) — v5.0.0</h3>'
        + '<table style="width:100%;font-size:.68rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr><td style="padding:3px 8px"><code>rui-analysis</code></td><td style="padding:3px 8px">代码与架构静态分析 — 复杂度/耦合/文件膨胀/架构边界</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-reporter</code></td><td style="padding:3px 8px">过程报告与知识策展 — 证据驱动，≥2 来源</td></tr>'
        + '</table>'
        + '<p style="font-size:.64rem;color:var(--text-muted);margin-top:10px">自改进闭环 <code>self-improve</code> 为独立 Agent 级技能，见 Agent 角色层</p>'
    },
    agents: {
      title: '&#129302; Agent 角色 — 9 角色 + 1 拓扑总纲',
      content: '<p style="color:var(--text-secondary);margin-bottom:12px">Agent 是管线中的角色定义，各有职责边界和读写权限。由 <code>agents/AGENT.md</code> 拓扑总纲统一协调。</p>'
        + '<table style="width:100%;font-size:.68rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr style="background:rgba(255,255,255,.03)"><td style="padding:5px 8px;font-weight:600;color:var(--text-primary)" colspan="3">核心角色 (4) — 读写权限，驱动管线执行</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)"><code>pm</code></td><td style="padding:4px 8px">产品决策者</td><td style="padding:4px 8px;font-size:.62rem">需求解析→自适应规划→委派子 PM</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)"><code>planner</code></td><td style="padding:4px 8px">实施规划者</td><td style="padding:4px 8px;font-size:.62rem">步骤拆分→方案评估→委派 coder</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)"><code>coder</code></td><td style="padding:4px 8px">代码实现者</td><td style="padding:4px 8px;font-size:.62rem">逐模块实现·P0 强制清零·Gate 审查</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)"><code>tester</code></td><td style="padding:4px 8px">质量保障者</td><td style="padding:4px 8px;font-size:.62rem">测试先行·Gate A 准入·Gate B 交付</td></tr>'
        + '<tr style="background:rgba(255,255,255,.03)"><td style="padding:5px 8px;font-weight:600;color:var(--text-primary)" colspan="3">只读角色 (4) — 分析/审查/设计，不修改代码</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)"><code>architect</code></td><td style="padding:4px 8px">系统架构设计者</td><td style="padding:4px 8px;font-size:.62rem">架构设计·影响分析·ADR</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)"><code>code-reviewer</code></td><td style="padding:4px 8px">代码质量审查者</td><td style="padding:4px 8px;font-size:.62rem">正确性·设计模式·反模式·简化</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)"><code>reporter</code></td><td style="padding:4px 8px">过程报告者</td><td style="padding:4px 8px;font-size:.62rem">自改进复盘·交付文档生成·知识策展</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)"><code>security</code></td><td style="padding:4px 8px">安全专家</td><td style="padding:4px 8px;font-size:.62rem">威胁建模·约束注入·安全审查</td></tr>'
        + '<tr style="background:rgba(255,255,255,.03)"><td style="padding:5px 8px;font-weight:600;color:var(--text-primary)" colspan="3">闭环角色 (1) — 驱动项目持续进化</td></tr>'
        + '<tr><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)"><code>self-improve</code></td><td style="padding:4px 8px">自改进引擎</td><td style="padding:4px 8px;font-size:.62rem">D0-D7 诊断·E1-E4 评估·数据驱动提案</td></tr>'
        + '</table>'
        + '<p style="font-size:.64rem;color:var(--text-muted);margin-top:10px">📋 角色拓扑总纲 <a href="../agents/AGENT.md" target="_blank" style="color:var(--cyan)">agents/AGENT.md</a> — 行为纪律·设计原则·ADR·多 Agent 协作模式</p>'
    },
    rules: {
      title: '&#128220; 治理规则 — 16 条约束',
      content: '<p style="color:var(--text-secondary);margin-bottom:12px">规则定义不可妥协的底线和最佳实践，约束 Agent 行为和项目治理。</p>'
        + '<table style="width:100%;font-size:.68rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)" colspan="2">管线与执行 (4)</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>code-pipeline</code></td><td style="padding:3px 8px">分支隔离 · Gate A/B · 逐模块 P0 清零</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>code-pipeline-techniques</code></td><td style="padding:3px 8px">10 项支撑技术</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>delivery-gate</code></td><td style="padding:3px 8px">交付收口三步</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>plan-execution</code></td><td style="padding:3px 8px">计划创建→审查→执行→验证</td></tr>'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)" colspan="2">文档 (3)</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>doc-generation</code></td><td style="padding:3px 8px">表达优先：图→文→表</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>doc-generation-lifecycle</code></td><td style="padding:3px 8px">补充文档与策展</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>knowledge-graph</code></td><td style="padding:3px 8px">三层 schema：story→scene→source</td></tr>'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)" colspan="2">设计与质量 (4)</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>design-principles</code></td><td style="padding:3px 8px">9 条工程原则</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>agent-handoff</code></td><td style="padding:3px 8px">Agent 交接契约</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>doc-quality</code></td><td style="padding:3px 8px">A/B/C/D 证据等级</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>knowledge-graph-ownership</code></td><td style="padding:3px 8px">KG 三方写入解耦</td></tr>'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:4px 8px;font-weight:600;color:var(--text-primary)" colspan="2">其他 (5)</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>security-guardrails</code></td><td style="padding:3px 8px">安全底线</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>self-improve</code></td><td style="padding:3px 8px">D0-D7 + E1-E4</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>rui-claude</code></td><td style="padding:3px 8px">.claude/ 管理</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>architecture-diagram</code></td><td style="padding:3px 8px">架构图约束</td></tr>'
        + '<tr><td style="padding:3px 8px"><code>mermaid-theme</code></td><td style="padding:3px 8px">Mermaid 统一配色</td></tr>'
        + '</table>'
    },
    refs: {
      title: '&#128279; 参考入口 — 项目元信息',
      content: '<p style="color:var(--text-secondary);margin-bottom:12px">项目最重要的入口文档和外部资源。</p>'
        + '<table style="width:100%;font-size:.7rem;color:var(--text-muted);border-collapse:collapse">'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)"><a href="../README.md" target="_blank" style="color:var(--cyan)">README.md</a></td><td style="padding:6px 8px">项目总览 — 系统全景图 · 管线架构 · 快速开始 · 命令参考 · 领域语言（20 术语）</td></tr>'
        + '<tr><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)"><a href="../CLAUDE.md" target="_blank" style="color:var(--cyan)">CLAUDE.md</a></td><td style="padding:6px 8px">AI 项目指令 — 四大铁律 · 项目画像 · 不可妥协底线 · 退化三因与四层防御</td></tr>'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)"><a href="../skills/rui/formulas.md" target="_blank" style="color:var(--cyan)">formulas.md</a></td><td style="padding:6px 8px">故事文档公式 — 生成模板与公式定义（通用元素 · 故事主线 · 补充文档）</td></tr>'
        + '<tr><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)"><a href="../skills/rui-bot/SKILL.md" target="_blank" style="color:var(--cyan)">企微 Bot 配置</a></td><td style="padding:6px 8px">Webhook 配置 — 消息格式定义 · 通知触发条件 · 发送演示</td></tr>'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)"><a href="../tests/index.html" target="_blank" style="color:var(--cyan)">🧪 自检中心</a></td><td style="padding:6px 8px">测试仪表盘 — vitest 77+ 用例 · 覆盖率报告</td></tr>'
        + '<tr><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)"><a href="./健康报告/" target="_blank" style="color:var(--cyan)">🩺 健康报告</a></td><td style="padding:6px 8px">9 维度健康仪表板 + 历史趋势 + D0-D7 诊断</td></tr>'
        + '<tr style="background:rgba(255,255,255,.02)"><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)"><a href="./自循环报告/" target="_blank" style="color:var(--cyan)">🔄 自循环报告</a></td><td style="padding:6px 8px">12 技能定期巡检报告汇总</td></tr>'
        + '<tr><td style="padding:6px 8px;font-weight:600;color:var(--text-primary)"><a href="./趋势报告/" target="_blank" style="color:var(--cyan)">📡 趋势报告</a></td><td style="padding:6px 8px">GitHub Trending / OSS Insight / TrendShift 扫描结果</td></tr>'
        + '</table>'
    }
  };

  function show(name) {
    var d = DATA[name];
    if (!d) return;
    if (title) title.innerHTML = d.title;
    if (body) body.innerHTML = d.content;
    if (panel) {
      panel.style.opacity = '1';
      panel.style.pointerEvents = 'auto';
      panel.style.transform = 'translateY(0)';
    }
    if (overlay) {
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'auto';
    }
  }

  function close() {
    if (panel) {
      panel.style.opacity = '0';
      panel.style.pointerEvents = 'none';
      panel.style.transform = 'translateY(-8px)';
    }
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
    }
  }

  if (overlay) overlay.addEventListener('click', close);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && panel && panel.style.opacity === '1') close();
  });

  return { show: show, close: close };
})();
