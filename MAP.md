# Resume 项目地图

## 目标与状态

Resume 是优先交付、用于真实简历制作的 Chrome 侧边栏扩展。首版仅本人在当前 Mac、当前 Chrome 自用：侧边栏内快速编辑多个命名的简历方向并通过 Chrome 打印导出 PDF。每个方向只有一个自动保存的当前稿；新方向从已有方向复制后独立演进；不再提供快照、废纸篓或历史版本。以用户指定妙搭稿为初稿及版面基础，保持单张 A4，超页时缩小文字。首版不读取网页、不接 AI、不申请网站权限。Career-Next 继续作为长期优化项目；两边独立保存资料、独立发版，实际使用经验人工反馈。

2026-10-16：自动排版算法 L-19 获用户批准并冻结，见`SPEC.md`。本轮形态调整后，`extension/`是 Chrome 侧边栏实现：`extension/sidepanel.mjs`负责方向室、纸面编辑、快捷键、自动保存和 Chrome 打印，`extension/domain-*.mjs`保存领域规则副本，`extension/service-worker.js`只负责打开侧边栏。`src/domain/`和`server/`保留为旧的本机 App 实现与排版测试参考，不能作为侧边栏运行依赖。当前扩展先加载试用，再验收真实侧边栏宽度、Mac 快捷键、中文输入和打印结果。

## 阅读入口

- [产品规格](SPEC.md)：产品行为、功能约束、字号范围与快捷键的唯一维护入口；区分已确认、待确认建议和来源事实。
- [协作约定](AGENTS.md)：后续agent的阅读与维护规则。
- [抽离设计讨论](docs/extraction-design.md)：已确定目标、源码调查事实、待回答问题与实施边界。
- [侧边栏 UI/UX 设计方向](docs/design/sidepanel-ui-directions.md)：外围界面四个风格方向（纸面工坊/便签投递台/暗房灯箱/活字排版间）与共同可用性基线；纸面冻结规则不动，**方向 A 纸面工坊已选定（2026-10-21）**，待完整实现与 SPEC §7 验收。
- [UI 方向首屏对比页](design-handoff/ui-directions/style-explorer.html)：四个方向的 720×900 首屏实画与并排对比页（`design-handoff/ui-directions/`；round 05 已把纸面换成 v34 真实渲染样并对联系图标做光学归一，**已选定方向 A 纸面工坊**）。
- [无上下文对抗审查](docs/review/first-version-adversarial.md)：6组待确认建议及审查范围。
- [自动排版算法对抗审查](docs/review/spacing-auto-layout-algorithms.md)：从页面约束和真实排版出发，对比三种重构方案并给出未定稿的推荐；不构成已确认产品规则。
- [Gemini间距算法对抗审查](docs/review/gemini-spacing-adversarial-20261016.md)：Gemini独立审查七处候选间距，提出一个共用松紧旋钮方案；含本地复核与不应照抄的项目冲突，不构成已确认产品规则。
- [八处排版数值的独立对抗审查](docs/review/spacing-eight-gaps-adversarial-20261016.md)：新子代理核对行高倒挂、八处间隙比例与自动排布次序；结果是试用建议，不是冻结规则。
- [自动排版算法研究](docs/research/spacing-algorithm-alternatives.md)：用户提出字号和间距按固定比例联动、超出时逐档缩字号的新候选；系数和纸面效果待测试，不构成已确认产品规则。
- [A4字号与缩页演示](prototypes/a4-typography-demo.html) / [演示说明](prototypes/README.md)：独立HTML讨论演示，资料均为虚构；README说明怎么打开和试用，CHANGELOG保留各版记录；演示操作不是正式App验收。
- [第十四版历史交互演示](prototypes/a4-typography-demo-v14.html)：包含⌘S快照、⌘F收藏馆、废纸篓、9mm边距、A4 PDF打印、可选链接、纸面编辑、要点/经历拖动等交互探索；刷新会重置，PDF使用浏览器打印。它早期的间距滑杆和候选范围已被后续版本取代，当前冻结算法以`SPEC.md` L-19为准。[演示说明](prototypes/README.md)。
- [第二十三版四个间隔标注](prototypes/a4-spacing-algorithm-demo-v23.html)：编辑页A4纸用彩色数字标出四个间隔，左侧同号对应；侧栏用三步和简单算式说明排版。候选范围与正式算法仍待确认。[演示说明](prototypes/README.md)。
- [第三十四版间距对齐演示](prototypes/a4-spacing-eight-gaps-demo-v34.html)：第4处“上一分区内容到下一个大标题”与第7处使用相同的字号×0.60×(1＋0.30×松紧度)。整套算法已写入`SPEC.md`并获批准；此网页仅作视觉参考，不代表正式App实现。[演示说明](prototypes/README.md)。
- [第三十三版空隙微调演示](prototypes/a4-spacing-eight-gaps-demo-v33.html)：以第三十二版为底，只把第4处“上一分区内容到下一个大标题”从字号×0.92调至×0.84，其他比例和功能不动；字号步长为0.01pt。仍是视觉审核原型，不代表正式规格或App实现。[演示说明](prototypes/README.md)。
- [第三十二版 Gemini 算法试用演示](prototypes/a4-spacing-eight-gaps-demo-v32.html)：在第三十一版完整演示上，只换成 Gemini 推荐的八项比例与排字顺序；以虚构稿展示编辑后自动适配，保留9mm虚线框和整页/100%切换。算法仍待用户审批，不是正式实现；字号步长为0.01pt。[演示说明](prototypes/README.md)。
- [第三十一版八处间隙试用演示](prototypes/a4-spacing-eight-gaps-demo-v31.html)：加入八处编号、自动联动候选比例及第8处可变间隙；保留纸面编辑、9mm虚线框和整页/100%视图，是第三十二版的前一版。[演示说明](prototypes/README.md)。
- [Gemini UI/UX协作记录](design-handoff/editor-versions/BRIEF.md)：记录给Gemini的提示核对、等待过程、设计建议及采纳边界；Gemini不改产品规则，首版已进入实现与验收。
- [术语](GLOSSARY.md)：明确两个产品名称，后续按已确认的业务规则补充。
- [独立交付决定](docs/adr/0001-independent-delivery.md)：首版不依赖两项目自动同步。
- [简历身份归属](docs/adr/0002-resume-owned-identity.md)：每个方向独立维护身份，模板复制后互不影响。
- [侧边栏与简历方向](docs/adr/0003-sidepanel-directions.md)：Chrome 侧边栏形态、自动保存、方向替代快照及 Chrome 打印边界。
- 来源：`/Users/frog/Projects/Career-Next` 与 `/Users/frog/Projects/Career` 的简历相关模块。

确定首版结构和主要流程后更新本地图。来源项目的已通过验收不等于独立 Resume 已通过验收。
