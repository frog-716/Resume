# 工作事项：GitHub Issues

本仓库的开发工作和待办事项记在 GitHub Issues。使用 `gh` 命令操作。

`SPEC.md` 是已确认产品规则的唯一维护入口。Issue 可以记录问题、待办和讨论，但不能代替或悄悄改写产品规格。

## 隐私约定

- 不要把真实简历原稿、姓名、联系方式或真实经历复制到 Issue、评论或公开链接中。
- 讨论字段和排版时使用虚构例子；真实原稿只在本机私密目录核对。
- 这个仓库不把外部 Pull Request 当作用户需求入口。

## 常用操作

- **新建工作事项**：`gh issue create --title "标题" --body "说明"`。多行内容使用 heredoc。
- **查看**：`gh issue view <编号> --json number,title,body,labels,comments`。
- **列出**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，按需增加 `--label` 或状态筛选。
- **评论**：`gh issue comment <编号> --body "评论"`。
- **加/移除标签**：`gh issue edit <编号> --add-label "标签"` / `gh issue edit <编号> --remove-label "标签"`。
- **关闭**：`gh issue close <编号> --comment "原因"`。

在本仓库目录运行时，`gh` 会从 Git 远端判断仓库。

## PR 是否进入需求整理

**否。** 本仓库的外部 Pull Request 不作为需求来源，也不走 Issue 的标签流程。

## Wayfinder 工作地图

供 `/wayfinder` 使用：用一条标有 `wayfinder:map` 的 Issue 做工作地图，用子 Issue 记录具体任务。

- **工作地图**：创建一条 `wayfinder:map` Issue，记录 Notes、Decisions-so-far 和 Fog。
- **子任务**：优先将任务关联为工作地图的子 Issue；不可用时，在地图任务清单中列出，并在子任务开头写 `Part of #<地图编号>`。类型标签使用 `wayfinder:research`、`wayfinder:prototype`、`wayfinder:grilling` 或 `wayfinder:task`。
- **阻塞关系**：优先使用 GitHub 的 Issue 依赖关系。通过 `gh api` 添加依赖时，传入阻塞事项的数据库编号，不是页面上的 `#编号`。功能不可用时，在子任务正文写 `Blocked by: #<编号>`。
- **可开始任务**：从地图中按顺序查看未关闭的子任务，跳过仍被其他事项阻塞或已有人接手的任务。
- **接手任务**：`gh issue edit <编号> --add-assignee @me`。这是该流程中的第一次写操作。
- **完成任务**：在 Issue 留下结论并关闭，然后把 Issue 链接和简要决定记回工作地图。不要把项目上下文复制到仓库外的 gist 或公开页面。

## Skills 与 Issue 的对应

- Skill 要求把工作发布到跟踪器时，新建 GitHub Issue。
- Skill 要求读取事项时，使用上面的查看命令。
- GitHub 的 Issue 和 Pull Request 共用编号；遇到不确定的 `#编号`，先用 `gh pr view <编号>` 判断，再查看 Issue。
