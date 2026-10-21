# 扩展图标候选 — GitHub 小猫 · 金色系

`sheet.png` 为八候选对比图（浅/深工具栏 × 128/48/16 真实尺寸 × 16px 四倍像素放大）。

## 定稿（2026-10-21）

**用户选定 D · 徽章金章**，已装入 `extension/icons/icon-{16,32,48,128}.png` 并写入 `manifest.json`
（`action.default_icon` + 根部 `icons`）。用户追加的几何要求：**猫裹着的圆圈与外部方块相切**。

最终结构（D 定稿版）：

- 外：深金圆角方块 full-bleed（渐变 #C9930A→#6E4E00，rx=27）
- 中：奶油圆（mark 路径盘面 #FFF3B0）**内切于方块**，与四边中点相切——mark 自带 r=8 圆盘，
  `scale(8)` → r=64 内切于 128 画布；原亮金内框与圆几何冲突，已移除
- 内：深金负形猫（透出方块渐变），官方 octicon v17.11.0 路径，长尾弧线
- 描边 #8A6400（0.34，随 scale(8) 约 2.7px 有效宽）勾勒盘面与猫的轮廓，切点处被 viewport 干净裁齐

提拔命令（已执行）：

```bash
mkdir -p extension/icons
cp design-handoff/extension-icon/candidates/d-{16,32,48,128}.png extension/icons/icon-{16,32,48,128}.png
node scripts/build-extension.mjs   # 整目录复制，icons/ 自动进入 dist-extension
```

## 猫形基准（2026-10-21 校正）

猫形已换成 **GitHub 官方 octicon v17.11.0 经典版路径**（长尾弧线、圆身、双耳，与 github.com 同一只猫）。
此前用的是 simple-icons 简化重描版——尾巴又短又秃，用户验收发现"长歪"后逐字节核对官方 SVG 整体替换。
`extension/sidepanel.mjs`（纸面联系区图标）、`web/app.mjs`、本生成器三处同步。勿再手工改写路径。

## 参考图色系（用户提供，F/G/H 据此重做）

参考图实测（260×250，`/Users/frog/.workbuddy/blobs/20/20188ce…`）：

- 圆盘占画面 86.5%，金色**纵向渐变**：顶 `#D9A91D` → 中 `#C29215` → 底 `#9B7205`
- 顶部有亮金高光（`#FFD94E`，约 50% 不透明度径向）
- 猫为**奶油负形** `#F5F1ED`（透出底色）
- 整体即"金币版 GitHub mark"：金盘 + 负形猫

## 候选

| 键 | 名称 | 外色 | 内色 | 特点 |
|---|---|---|---|---|
| A | 双色金｜外深内亮 | 深金 #6E4E00 轮廓 | 亮金渐变 #FFE888→#DFA41C | 干净、猫形纯粹；16px 可读 |
| B | 双色金｜外亮内深 | 亮金 #FFD94D 描边 | 深金渐变 #D9A51C→#8A6400 | A 的反相；深底更跳 |
| C | 金箔浮雕 | 细深金勾边 #7A5C00 | 三段金 #FFF6C8→#B87F0A + 高光/暗影 | 厚度感最强，单色相多深浅 |
| D | 徽章金章 | 深金圆角方底 #C9930A→#6E4E00 + 亮金内框 | 米金猫 #FFF3B0 | 纯双色块；工具栏存在感最强 |
| E | 描边金 | — | 单色金 #C9930A 细线 | 与纸面"白猫"同风格；16px 偏细 |
| F | 金盘负形·奶油猫 ★ | 金盘渐变 #D9A91D→#9B7205 + 顶部高光 | 奶油负形猫 #F5F1ED | **复刻参考图**；深浅底均稳 |
| G | 金盘负形·透明猫 ★ | 同 F | 镂空（透出工具栏底色） | 深底猫显深、浅底显浅，全自适应 |
| H | 金盘双色·亮金猫 ★ | 深金盘 #C99716→#8A6400 | 亮金猫 #FFD94E | 参考色系的双色猫版，猫形最明确 |

★ = 按用户参考图色系重做。

## 复现与提拔

```bash
# 重新生成四档 PNG（16/32/48/128）
node design-handoff/extension-icon/generate-icons.mjs   # 需 managed workspace 的 sharp
# 重新拼对比图
python3 design-handoff/extension-icon/make-sheet.py
```

用户选定键（如 `f`）后：
1. `mkdir extension/icons`，把 `candidates/<键>-{16,32,48,128}.png` 复制为 `extension/icons/icon-*.png`；
2. `manifest.json` 的 `action` 增加 `default_icon`（16/32/48），根部增加 `icons`（16/32/48/128）；
3. 跑 `node scripts/build-extension.mjs` 重建 dist-extension，提交。

约束：纸面联系区的"白猫"是冻结项（D-02/L-16，细线轮廓），不随本选择改动；此处仅限扩展自身图标。
