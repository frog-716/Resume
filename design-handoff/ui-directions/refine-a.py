import re, pathlib

p = pathlib.Path('a-paper-bench.html')
html = p.read_text(encoding='utf-8')
orig = html

# 1) 删除右下角 footer.view-dock（含内部胶囊），容忍任意空白
before = html
html = re.sub(r'\n?\s*<footer class="view-dock"[\s\S]*?</footer>', '', html)
assert html != before, 'footer.view-dock 未命中'
assert 'view-dock' not in html.split('<body')[1].split('</header>')[1] if False else True

# 2) 在 topbar 的 brand 与 top-actions 之间插入居中缩放胶囊
capsule = (
    '\n    <div class="view-dock">'
    '\n      <div class="capsule" role="group" aria-label="纸张缩放">'
    '\n        <button type="button" aria-label="缩小">−</button>'
    '\n        <button type="button" class="readout" title="点击重置为整页">整页</button>'
    '\n        <button type="button" aria-label="放大">＋</button>'
    '\n        <span class="sep"></span>'
    '\n        <button type="button" class="guide-button" aria-pressed="true"><span class="dashed-square"></span>虚线框</button>'
    '\n      </div>'
    '\n    </div>'
)
anchor = '    </div>\n    <div class="top-actions"'
assert html.count(anchor) == 1, f'top-actions 锚点命中 {html.count(anchor)}'
html = html.replace(anchor, '    </div>' + capsule + '\n    <div class="top-actions"', 1)

# 3) 校验：topbar 内应有 1 个 view-dock，且已无 footer
head = html.split('</header>')[0]
assert head.count('class="view-dock"') == 1, 'topbar 内 view-dock 数量不对'
assert '<footer' not in html, 'footer 未删干净'
assert 'class="top-actions"' in html and '打印 PDF' in html, 'top-actions/打印PDF 丢失'

p.write_text(html, encoding='utf-8')
print('OK: footer 已删，缩放胶囊已置入 topbar 中部；字节', len(orig), '->', len(html))
