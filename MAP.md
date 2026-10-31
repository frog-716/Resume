# Resume 项目地图

## 目标与状态

Resume 是优先交付、用于真实简历制作的 Chrome 侧边栏扩展。首版仅本人在当前 Mac、当前 Chrome 自用：侧边栏内快速编辑多个命名的简历方向并通过 Chrome 打印导出 PDF。每个方向只有一个自动保存的当前稿；新方向从已有方向复制后独立演进；不再提供快照、废纸篓或历史版本。以用户指定妙搭稿为初稿及版面基础，保持单张 A4，超页时缩小文字。首版不读取网页、不接 AI、不申请网站权限。Career-Next 继续作为长期优化项目；两边独立保存资料、独立发版，实际使用经验人工反馈。

2026-10-22：项目收敛为**唯一前端 `extension/`**（Chrome 侧边栏，加载该目录即可用）：`extension/sidepanel.html` 是侧边栏入口，`sidepanel.mjs` 负责方向室、纸面编辑、快捷键、自动保存和 Chrome 打印，`domain-*.mjs` 是领域规则及其测试的唯一住所（测试随源码同目录，`npm test` 全绿），`print.html`/`print.mjs` 是打印预览页，`service-worker.js` 只负责打开侧边栏。旧本机 App 路径（`web/`、`server/`、`native/`、`src/`）及其构建产物（`dist/`、`out/`）已于 2026-10-22 全部移入废纸篓（`~/.Trash/resume-cleanup-20261022-161028/`，git 跟踪部分可用 `git checkout` 找回）；被文档引用的 8 个原型演示 HTML 已于 2026-11-01 全部清理，仅保留 `prototypes/README.md` 与 `CHANGELOG.md` 作历史记录。构建与测试：`npm run build:extension` 生成 `dist-extension/`（可再生产物），`npm test` 跑 `extension/*.test.mjs`。

2026-10-23：方向室按用户反馈做视觉精修：名称点击改名、删除仅保留 `🗑️`、去掉“当前方向”和“最近编辑”前缀；JSON 导入与来源记忆按 S-08 确认取消，已有方向保留。

2026-10-31：首版已完成真机验收。`docs/handoff/rewrite-mission-brief.md`（clean-room 重写）已作废；`extension/` 单体侧边栏为既定首版路径，不再考虑分层重构。领域纯逻辑（方向生命周期、排序重排、删除守卫）已抽到 `extension/domain-editor.mjs` 并补单测。

## 阅读入口

- [产品规格](SPEC.md)：产品行为、功能约束、字号范围与快捷键的唯一维护入口；区分已确认、待确认建议和来源事实。
- [协作约定](AGENTS.md)：后续agent的阅读与维护规则。
- [抽离设计讨论](docs/extraction-design.md)：已确定目标、源码调查事实、待回答问题与实施边界。
- [侧边栏 UI/UX 设计说明](docs/design/sidepanel-ui-directions.md)：外围界面已定稿为**方向 A「纸面工坊 · 极简专业」**（墨蓝 #3D5A80 + 灰卡纸底），含色板/字体/组件规则与共同可用性基线；纸面冻结规则不动。其余三个备选方向已于 round 08 移出工作区。待办：弹窗/toast/排序手柄/联系添加菜单/超页边界、动效、SPEC §7 真机验收。
- [UI 首屏对比页](design-handoff/ui-directions/style-explorer.html)：方向 A 的 720×900 首屏实画与对比页（`design-handoff/ui-directions/`；纸面为 v34 真实渲染抽取源，联系图标容器 9×9px、墨迹含描边最长边齐边界）。
- [侧边栏 UI/UX 优化 Demo](design-handoff/ui-ux-refactor-demo/)：沿用方向 A 的独立可操作视觉原型；含编辑页、方向室、创建/删除弹窗与超页拦截状态，不修改正式实现或产品规格。
- [无上下文对抗审查](docs/review/first-version-adversarial.md)：6组待确认建议及审查范围。
- [自动排版算法对抗审查](docs/review/spacing-auto-layout-algorithms.md)：从页面约束和真实排版出发，对比三种重构方案并给出未定稿的推荐；不构成已确认产品规则。
- [Gemini间距算法对抗审查](docs/review/gemini-spacing-adversarial-20261016.md)：Gemini独立审查七处候选间距，提出一个共用松紧旋钮方案；含本地复核与不应照抄的项目冲突，不构成已确认产品规则。
- [八处排版数值的独立对抗审查](docs/review/spacing-eight-gaps-adversarial-20261016.md)：新子代理核对行高倒挂、八处间隙比例与自动排布次序；结果是试用建议，不是冻结规则。
- [自动排版算法研究](docs/research/spacing-algorithm-alternatives.md)：用户提出字号和间距按固定比例联动、超出时逐档缩字号的新候选；系数和纸面效果待测试，不构成已确认产品规则。
- [原型历史记录](prototypes/README.md) / [逐版日志](prototypes/CHANGELOG.md)：A4 排版探索期的第 1～34 版单文件 HTML 演示已于 2026-11-01 按用户要求全部清理（含 v34），冻结后的规则只保留在`SPEC.md`（L-19 等条文）与本机生产实现`extension/`中；本目录只留说明与逐版日志作历史依据，不再提供可打开的演示页。
- [Gemini UI/UX协作记录](design-handoff/editor-versions/BRIEF.md)：记录给Gemini的提示核对、等待过程、设计建议及采纳边界；Gemini不改产品规则，首版已进入实现与验收。
- [术语](GLOSSARY.md)：明确两个产品名称，后续按已确认的业务规则补充。
- [独立交付决定](docs/adr/0001-independent-delivery.md)：首版不依赖两项目自动同步。
- [简历身份归属](docs/adr/0002-resume-owned-identity.md)：每个方向独立维护身份，模板复制后互不影响。
- [侧边栏与简历方向](docs/adr/0003-sidepanel-directions.md)：Chrome 侧边栏形态、自动保存、方向替代快照及 Chrome 打印边界。
- 来源：`/Users/frog/Projects/Career-Next` 与 `/Users/frog/Projects/Career` 的简历相关模块。

确定首版结构和主要流程后更新本地图。来源项目的已通过验收不等于独立 Resume 已通过验收。
