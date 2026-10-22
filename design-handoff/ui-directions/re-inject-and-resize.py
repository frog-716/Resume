import re, pathlib

ROOT = pathlib.Path('.')
inner = (ROOT / 'v34-paper-inner-normalized.html').read_text(encoding='utf-8')

demos = ['a-paper-bench.html']  # 方向 A 已定稿，B/C/D 于 round 08 移除

# 纸面 DOM：从 <div class="paper-content" ...> 到 </article>（兼容带 data-page-node-id 属性）
paper_re = re.compile(r'<div class="paper-content"[^>]*>[\s\S]*?</article>')

# demo 预览缩放 0.68，要让用户在屏幕上看到 9px 容器 → CSS = 9 / 0.68 = 13.235px
DEMO_PX = '13.235px'

for d in demos:
    p = ROOT / d
    html = p.read_text(encoding='utf-8')

    # 1) 重注入 K=1.0 归一后的纸面 DOM
    n = len(paper_re.findall(html))
    assert n == 1, f'{d}: paper-content 命中 {n}（应为1）'
    html = paper_re.sub(
        lambda m: '<div class="paper-content">\n            ' + inner + '\n          </div>\n        </article>',
        html, count=1)

    # 2) 容器尺寸 14px → 13.235px（屏幕上呈现 9px）
    html = html.replace(
        '.contact-icon { width: 14px; height: 14px; display: inline-block; flex: 0 0 14px; color: rgb(85, 85, 85); }',
        f'.contact-icon {{ width: {DEMO_PX}; height: {DEMO_PX}; display: inline-block; flex: 0 0 {DEMO_PX}; color: rgb(85, 85, 85); }}')
    html = html.replace(
        '.github-cat { display: inline-block; width: 14px; height: 14px; flex: 0 0 14px; color: rgb(85, 85, 85); }',
        f'.github-cat {{ display: inline-block; width: {DEMO_PX}; height: {DEMO_PX}; flex: 0 0 {DEMO_PX}; color: rgb(85, 85, 85); }}')

    p.write_text(html, encoding='utf-8')

    # 校验
    vbs = re.findall(r'viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"', html)
    sq = sum(1 for x, y, w, h in vbs if abs(float(w) - float(h)) < 0.01)
    has13 = (DEMO_PX in html)
    print(f'{d}: 重注入完成（正方形viewBox={sq}），容器13.235px={has13}')

print('ALL DONE')
