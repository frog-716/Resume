# Resume 项目状态审查报告

- 审查时间：2026-10-21
- 审查范围：仓库整体状态、已完成工作、进行中任务、阻塞问题、潜在风险、优先推进事项
- 依据：`SPEC.md`（产品规则唯一正本）、`MAP.md`、`AGENTS.md`、`GLOSSARY.md`、`docs/`、`extension/`、`src/`、`server/`、Git 状态、GitHub Issues、`node --test` 实测

---

## 1. 总体结论

**产品实现已接近首版完整度，但"工程交付与治理"明显落后于"功能代码"。**

- ✅ 已冻结的 L-19 自动排版算法、内容模型与校验、方向室、自动保存、撤销、打印、中文输入法处理、粘贴纯文本、拖拽排序等核心能力，在 `extension/` 中均已实现，且与 `SPEC.md` 已确认规则高度一致。
- ✅ 算法与内容模型有自动化测试且全过（`node --test`：27 通过 / 0 失败）。
- ⚠️ **全部实现均未提交 Git**（仅有 3 个无关紧要的初始提交），存在严重的数据丢失与无法回滚风险。
- ⚠️ **GitHub Issues 数量为 0**，而 `AGENTS.md` 明确规定所有工作事项走 Issue 跟踪——当前无任何工作追踪、无分诊标签、无验收清单。
- ⚠️ `docs/handoff/rewrite-mission-brief.md`（clean-room 分层重写，M0–M3）与现有 `extension/sidepanel.mjs` 单体实现存在**文档/实现冲突**，且重写任务书仍处于"待用户拍板后生效"。
- ⚠️ 侧边栏主体 `extension/sidepanel.mjs`（808 行，产品绝大部分逻辑）**没有任何自动化测试**，仅能靠真机 Mac 验收。

**一句话**：功能基本做完了，但还没"收口"——没提交、没跟踪、没真机验收、没清掉冗余与文档冲突。

---

## 2. 已完成工作

| 模块 | 状态 | 证据 |
| --- | --- | --- |
| L-19 自动排版算法 | 已实现并测试 | `extension/domain-auto-layout.mjs` 与 `SPEC.md` L-19 公式逐条对应；`src/domain/auto-layout.test.mjs` 通过 |
| 内容模型 + 校验 | 已实现并测试 | `domain-resume-content.mjs`：固定四板块、可选链接、对齐、HTML 白名单校验；`resume-content.test.mjs` 通过 |
| 自动保存（S-02） | 已实现 | `scheduleSave`/`saveNow`/`persistStore`；失败有 toast + 重试；`visibilitychange`/`pagehide` 兜底保存 |
| 撤销（E-05/⌘Z） | 已实现 | `pushUndo`/`undo`；跨方向不串稿（`directionId` 校验）；观看缩放/光标不算改动 |
| 简历方向室（S-03/S-06/S-07） | 已实现 | ⌘F 进入、搜索、改名、从模板复制新建、删除（至少保留一份、二次确认、删除当前自动切换） |
| 纸面编辑（E-01~E-03/E-08） | 已实现 | Enter/Shift+Enter 分字段行为、多行纯文本粘贴、加粗、对齐、空要点/经历删除 |
| 中文输入法（E-04） | 已实现（待真机） | `compositionstart/end` 期间不保存半句、不更新排版 |
| 拖拽排序（E-07） | 已实现（适配形态，待真机） | `sort-handle` + `pointercapture` 实现要点/经历排序（侧边栏形态下替代了 Demo 的三指手势） |
| 打印导出（S-04/L-04） | 已实现（待真机） | `window.print()` + `@media print` 仅输出 A4、零页边距、隐藏全部 UI；超页/联系冲突/缺字暂停 |
| 联系区与 GitHub 可选（D-03/L-13/L-16） | 已实现（待真机） | 两行固定、溢出暂停、`+GitHub`/`+个人网页` 悬浮添加、白猫 SVG 图标 |
| manifest / 权限 | 已实现 | MV3，`sidePanel`+`storage` 仅两项权限，不读网页、不接 AI |
| 术语与 ADR | 已完成 | `GLOSSARY.md` 已更新；`docs/adr/0001~0003` 已落 |

---

## 3. 进行中 / 待验收

| 事项 | 说明 | 阻塞/依赖 |
| --- | --- | --- |
| **真机 Mac 验收（SPEC §7 全部 9 项）** | 中文输入法、侧边栏 ⌘F/Esc、原生快捷键、拖拽排序、真实打印 PDF、字体一致性、四板块/排序边界——这些**必须由用户在当前 Mac 的 Chrome 实测**，无法用自动测试冒充 PASS。 | 需用户在本机 `chrome://extensions` 加载 `extension/` 实测 |
| **真实原稿采集入库（D-01/D-02）** | `.private/sources` 已建，但"妙搭当前稿采集到本机"是否已完成、首份真实简历是否已能用，需确认。 | 用户本机私密资料，不进仓库 |
| **提交首版实现** | 当前所有代码均为未提交状态，需建立可回滚的历史。 | 见下方阻塞/风险 |

---

## 4. 阻塞问题（需决策/处理才能推进）

1. **B1 — 全部代码未提交 Git（最高优先级风险）**
   `git status` 显示 `SPEC.md`/`MAP.md`/`AGENTS.md`/`GLOSSARY.md` 已修改未提交；`extension/`、`dist/`、`dist-extension/`、`src/`、`server/`、`web/`、`native/`、`scripts/`、`docs/`、`package.json` 等全部为未跟踪。Git 历史仅 3 个无关提交（`Initialize Resume project history` / `Add v16 spacing review prototype` / `Configure Matt Pockock engineering skills`）。一旦发生误删或磁盘故障，**数月工作无法恢复**。

2. **B2 — 工作事项零跟踪（与 AGENTS.md 冲突）**
   `gh issue list --state all` 返回 0。AGENTS.md 要求所有事项走 GitHub Issues 并打 `needs-triage`/`ready-for-agent` 等标签，但当前无一条 Issue、无分诊、无验收清单。无法回答"正在做什么/被什么卡住"。

3. **B3 — 重写任务书与现有实现的文档冲突**
   `docs/handoff/rewrite-mission-brief.md` 要求 clean-room 分层架构（domain/application/adapters/ui）、里程碑 M0–M3、且 B5 规定"不许跳级"、B4 规定只暴露 `check`/`test`/`build` 三命令。但现实路径是 `extension/sidepanel.mjs` 单体（808 行混合领域/UI/存储/撤销），且 `package.json` **没有 `check` 命令**。该任务书标注"待用户在数据迁移一项拍板后生效"——即从未激活。两者并存造成"哪份是权威路线"的歧义。

---

## 5. 潜在风险点

| 编号 | 风险 | 影响 | 建议 |
| --- | --- | --- | --- |
| R1 | **领域逻辑三处副本、会漂移** | `src/domain/auto-layout.mjs` ≡ `extension/domain-auto-layout.mjs` ≡ `dist-extension/...`（diff 完全相同）。测试只跑 `src/domain`，扩展运行的是 `extension/` 副本。任一处改了另一处没改，测试全绿但扩展出错。 | 明确单一事实源；扩展改为引用或构建期注入 `src/domain`，消除手工副本 |
| R2 | **侧边栏主体零单测** | `sidepanel.mjs`（编辑/撤销/排序/方向/打印接线，808 行）无任何自动化测试，仅依赖真机验收，回归风险高。 | 抽取纯逻辑（撤销栈、排序重排、方向 CRUD）补单测，至少覆盖 SPEC 已确认规则 |
| R3 | **两套并行实现、易混淆** | `web/`+`server/`+`native/`（旧 Mac App、Swift launcher）与 `extension/`（交付目标）共存且均未提交。读者难辨"产品到底是什么"。 | 明确冻结 `web/server/native` 为只读参考；考虑移入 `archive/` 或加醒目说明，避免误改 |
| R4 | **残留的"快照/废纸篓"死代码** | `sidepanel.css` 仍含 `.trash-view`、`.trash-card-actions`、`restore`/`permanent-delete`、`.danger-button` 等已被 S-05/S-06 移除的快照/废纸篓样式。 | 删除死代码，避免与当前方向体系混淆 |
| R5 | **构建产物未明确纳入忽略** | `dist/`、`dist-extension/` 为构建输出且未提交（靠未跟踪隐藏），但 `.gitignore` 未列它们；`out/`（含 `Resume.app`、验证图）已被忽略。 | 把 `dist/`、`dist-extension/` 加入 `.gitignore`，避免误提交大体积产物 |
| R6 | **真实原稿/导入路径未闭环** | 重写任务书把"数据迁移"列为开工前置决策（空库 vs 一次性导入器），但侧边栏路径下该决策未显式落定；当前靠手动粘贴真实稿（D-01/D-02）。首用体验是否顺畅待验证。 | 明确"首装空库 + 手动采集"为既定路径，并在 README 写清步骤 |
| R7 | **prototypes 膨胀** | `prototypes/` 已有 45 个 HTML 演示（v10–v34 等），多数明确"非规格、非实现"。长期堆积易误导。 | 保留 V34 为唯一视觉参考，其余加索引或归档，不在正式评审中引用 |
| R8 | **文档修改未提交** | SPEC/MAP/AGENTS/GLOSSARY 的近期更新（含 2026-10-16 启动开发、2026-10-20/21 状态）均在工作区未提交，与代码一样面临丢失风险。 | 与代码一并提交（见 P1） |

---

## 6. 优先推进清单（建议顺序）

| 优先级 | 事项 | 动作 | 负责/依赖 |
| --- | --- | --- | --- |
| **P0** | 冻结当前工作、建立可回滚历史 | 先 `git add` 并提交全部实现与文档（一个清晰的"首版实现快照"提交），再在此基础上继续。 | 需用户确认提交范围（不含 `.private/`，已被忽略） |
| **P0** | 建立工作跟踪 | 按 `AGENTS.md` 创建 GitHub Issues：把"真机验收清单（SPEC §7 共 9 项）"、"R1~R7 风险清理"、"提交与 CI"等转为 Issue 并打 `needs-triage`/`ready-for-agent` 标签。 | 可授权后由我批量建 Issue |
| **P1** | 消除文档/实现冲突 | 明确路线：要么关闭/归档 `rewrite-mission-brief.md` 并声明"侧边栏单体为既定首版路径"，要么按任务书重构。建议前者（功能已落地，重写的成本收益不划算）。 | 需用户拍板 |
| **P1** | 解决领域逻辑三副本（R1） | 选定单一事实源，扩展在构建期复用 `src/domain`，删除手工副本。 | 实现 |
| **P1** | 补侧边栏核心逻辑单测（R2） | 对撤销栈、排序重排、方向 CRUD 抽取纯函数并补测。 | 实现 |
| **P2** | 真机 Mac 验收（SPEC §7） | 用户在 Chrome 加载 `extension/`，逐项验收并登记结果到 Issue。 | 需用户本机操作 |
| **P2** | 清理死代码与冗余（R3/R4/R5/R7） | 删废纸篓样式、冻结 `web/server/native`、忽略 `dist*`、收敛 prototypes。 | 实现 |
| **P3** | 真实原稿入库与首用走查（R6） | 确认妙搭稿采集完成，走通"新建方向→粘贴真实稿→打印 PDF"全链路。 | 需用户本机资料 |
| **P3** | 暴露 `check` 命令（若确认沿用任务书约束） | 在 `package.json` 加 `check`（汇总 lint/类型/测试）；否则从任务书移除该约束。 | 取决于 P1 路线决策 |

---

## 7. 核查证据（可复现）

- `git status`：8 个文件已修改未提交；`extension/`、`src/`、`server/`、`web/`、`native/`、`dist/`、`dist-extension/`、`scripts/`、`docs/`、`package.json` 等未跟踪。
- `git log`：仅 3 提交，最新 `99bb32f Configure Matt Pockock engineering skills`，与产品实现无关。
- `gh issue list --state all`：0 条。
- `node --test src/domain/*.test.mjs server/*.test.mjs`：**27 passed / 0 failed**。
- `diff src/domain/auto-layout.mjs extension/domain-auto-layout.mjs`：**完全相同**（resume-content 同理）。
- 侧边栏关键能力经源码核对已落地：⌘F(788)/⌘Z(789)/⌘S 抑制(787)、`compositionstart/end`(748-749)、`window.print()`+`@media print`(sidepanel.css 第 5、78 行)、方向室/改名/删除/复制(`openDirections`/`createDirection`/`deleteDirection`)。
- `.gitignore` 已含 `.private/`、`data/`、`out/`、`node_modules/`、`.DS_Store`；但**未含 `dist/`、`dist-extension/`**。
- 无 `node_modules`，扩展为零依赖纯 JS，可直接 `chrome://extensions` 加载。
