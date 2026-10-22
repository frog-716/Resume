# Resume 侧边栏 UI · 方向 A「纸面工坊 · 极简专业」定稿件

- 日期：2026-10-21
- 状态：**方向 A 已选定并实装到扩展**（round 08 起只保留 A；B/C/D 三个备选方向已从工作区移除）
- 配套文档：`docs/design/sidepanel-ui-directions.md`
- 真实前端：`extension/sidepanel.{html,css,mjs}`（已迁移到方向 A）

## 怎么打开

1. `style-explorer.html`——离线可用，单张方向卡 + "实际尺寸 100%"
2. 或直接打开首屏：`a-paper-bench.html`（720×900 固定画布，模拟侧边栏编辑主视图）

## 画布说明

- 首屏是固定的 720×900 画布（manifest 里 `nativeViewport`），纸面按"整页"模式适配可用面积
- 首屏纸面整体 `scale(.68)` 做整页预览，所以 CSS 尺寸与屏幕像素是 0.68 倍关系；真实侧边栏与打印结果以真机验收为准

## 冻结边界

纸面保持冻结规则：A4 210×297mm、四边 9mm 边距、四固定板块、姓名 18pt / 联系 8.5pt / 分区标题 12pt、正文 10.5pt、中文苹方与英文数字 Times 分轨、GitHub 白猫图标。示例简历为虚构稿（林亦舟），不含真实原稿。

## 联系图标规格（round 08 定稿）

- 容器：**9×9px**（首屏因 0.68 预览写作 13.235px，屏幕上正好 9px）
- 归一：viewBox = 「含描边的墨迹框」正方形，最长边方向满格齐边界，另一方向居中
- viewBox 一览：电话 `1.201 1.100 21.728 21.728` / 邮箱 `2.100 2.100 19.800 19.800` / 微信 `-0.120 1.140 22.440 22.440`（path 保留 `translate(-2.4 -2.4) scale(1.2)`） / 网站 `2.097 2.098 19.803 19.803` / GitHub 白猫 `0 -0.197 16 16`
- 实测：五个图标墨迹（含描边）最长边均 = 9px（100%），描边完整未被视口裁剪

## 文件清单

| 文件 | 说明 |
| --- | --- |
| `style-explorer.html` | 对比页（生成物，改 manifest 后需重新生成） |
| `manifest.json` | 对比页输入：方向卡、色板、特征（现仅含方向 A） |
| `a-paper-bench.html` | 方向 A 首屏（纸面为 v34 真实渲染抽取源） |
| `icon-boxes-compare.html` | 联系图标 9×9px 容器占比 + 墨水修复前后对照 |
| `extract-v34.cjs` | 从 v34 抽取纸面 DOM + 精选 CSS，并做图标墨迹归一（含描边） |
| `re-inject-and-resize.py` | 把抽取结果幂等注入首屏，并写容器 13.235px |
| `measure-boxes.cjs` | 实测容器盒 / 墨迹外切盒 / 占比 → `icon-boxes.json` |
| `verify-no-clip.cjs` | 校验描边未被裁剪且最长边齐边界（demo 与 v34 双端） |
| `shoot-explorer.cjs` / `shoot-extension.cjs` | 对比页截图 / 真实扩展前端截图（playwright + 本地 http） |
| `v34-paper-core.css` / `v34-paper-inner-normalized.html` | 抽取产物（纸面 CSS 与 DOM） |
| `icons_extracted.json` | 五个图标字形与 viewBox 快照（供对比图使用） |
| `shots/` | 首屏与细节截图（自查证据） |

重新生成对比页：

```text
python3 <oil-ui skill>/scripts/build_explorer.py manifest.json --force
```

## 下一步

方向 A 的实现主体已落地（主题变量层、顶栏、缩放控件、方向室按钮）。剩余细节按需推进：联系添加菜单、超页红边界、排序手柄等小件。
