# Resume

- 从 `MAP.md` 阅读项目状态与入口，再读 `SPEC.md` 的相关规则。
- `SPEC.md` 是独立 Resume 的产品行为、功能约束和快捷键唯一维护入口。变更功能时先同步规格与确认状态，再修改实现和相应验证；不得把“待确认建议”或“来源事实”当作已批准规则。
- 重大工程取舍记入 `docs/adr/`，术语澄清记入 `GLOSSARY.md`；不在其他文档维护另一套产品规格。
- 首版产品规则已逐项确认，自动排版算法已冻结；用户于2026-10-16明确确认开始开发。当前进入首版实现与验收阶段；实现不得超出`SPEC.md`已确认规则。
- Resume 独立保存资料、独立发版；不得让运行依赖 Career/Career-Next 的工作目录，不修改它们的冻结规格或无关未提交改动。
- 真实原稿与用户数据放 `.private/` 或用户数据目录，不提交 Git、不写入规格/测试夹具、不嵌入发布包。自动验证用合成资料，真实原稿只在本机核对。

## Agent skills

### Issue tracker

本仓库的工作事项记在 GitHub Issues，通过 `gh` CLI 操作。已确认的产品规则仍以 `SPEC.md` 为唯一准绳。详见 `docs/agents/issue-tracker.md`。

### Triage labels

工作事项使用 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix` 五个标签。详见 `docs/agents/triage-labels.md`。

### Domain docs

本仓库采用单一业务上下文；按工作主题阅读根目录 `GLOSSARY.md` 和 `docs/adr/`。详见 `docs/agents/domain.md`。
