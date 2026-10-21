# 拼合图标候选对比图：浅/深工具栏底色 × 128/48/16 真实尺寸 × 16px 四倍放大
from PIL import Image, ImageDraw, ImageFont

BASE = '/Users/frog/Projects/Resume/design-handoff/extension-icon/candidates'
OUT = '/Users/frog/Projects/Resume/design-handoff/extension-icon/sheet.png'

# ---- 字体：Hiragino Sans GB（W3 常规 / W6 半粗）----
CJK = '/System/Library/Fonts/Hiragino Sans GB.ttc'

def load_font(size, semibold=False):
    return ImageFont.truetype(CJK, size, index=2 if semibold else 0)

F_TITLE = load_font(30, semibold=True)
F_SUB = load_font(16)
F_NAME = load_font(19, semibold=True)
F_DESC = load_font(14)
F_CAP = load_font(13)

ROWS = [
    ('a', 'A · 双色金｜外深内亮', '深金轮廓 #6E4E00 在外，亮金渐变在内'),
    ('b', 'B · 双色金｜外亮内深', 'A 的反相：亮金描边在外，深金渐变在内'),
    ('c', 'C · 金箔浮雕', '三段渐变拉出厚度，顶部高光 + 底部暗影'),
    ('d', 'D · 徽章金章 ★已选定', '深金圆角方块 + 奶油圆与四边相切 + 深金负形猫（长尾）'),
    ('e', 'E · 描边金', '与纸面“白猫”同款细线风格，单色金'),
    ('f', 'F · 金盘负形·奶油猫 ★', '复刻参考图：金盘渐变 #D9A91D→#9B7205，猫为奶油负形'),
    ('g', 'G · 金盘负形·透明猫 ★', '同 F 但猫镂空，透出工具栏底色，深浅自适应'),
    ('h', 'H · 金盘双色·亮金猫 ★', '深金盘 + 亮金 #FFD94E 猫，参考色系的双色猫版'),
]

LIGHT = ('#F4F1EC', '#DFDBD3')   # 浅色工具栏（底色, 边）
DARK = ('#2E2B33', '#46424E')    # 深色工具栏

MARGIN = 44
LABEL_W = 336
CELLS = [(128, 'LIGHT', '128 · 浅底'), (128, 'DARK', '128 · 深底'),
         (48, 'LIGHT', '48 · 浅底'), (48, 'DARK', '48 · 深底'),
         (16, 'LIGHT', '16 · 浅底'), (16, 'DARK', '16 · 深底')]
ZOOM_W = 80   # 16px × 4 最近邻放大单元
ROW_H = 156
HEAD_H = 116
W = MARGIN * 2 + LABEL_W + 162 * 2 + 102 * 2 + 102 * 2 + ZOOM_W + 20
H = HEAD_H + ROW_H * len(ROWS) + 30

sheet = Image.new('RGB', (W, H), '#FFFFFF')
draw = ImageDraw.Draw(sheet)

draw.text((MARGIN, 40), 'Resume 扩展图标候选 — GitHub 小猫 · 金色系', font=F_TITLE, fill='#2B2635')
draw.text((MARGIN, 82), '猫形已按官方 octicon 经典版校正（长尾弧线）。F/G/H 按你参考图的色系重做；16px 是工具栏真实尺寸，末格为其 4 倍像素放大。', font=F_SUB, fill='#7A7386')

def paste_icon(canvas, icon, cx, cy):
    rgba = icon.convert('RGBA')
    canvas.paste(rgba, (cx - rgba.width // 2, cy - rgba.height // 2), rgba)

y = HEAD_H
for key, name, desc in ROWS:
    draw.text((MARGIN, y + 34), name, font=F_NAME, fill='#2B2635')
    draw.text((MARGIN, y + 66), desc, font=F_DESC, fill='#8A8299')

    x = MARGIN + LABEL_W
    for size, side, cap in CELLS:
        bg, border = LIGHT if side == 'LIGHT' else DARK
        pad = {128: 11, 48: 21, 16: 37}[size]
        cell = max(size + pad * 2, 72)
        top = y + (ROW_H - cell - 22) // 2
        draw.rounded_rectangle([x, top, x + cell, top + cell], radius=10, fill=bg, outline=border, width=1)
        icon = Image.open(f'{BASE}/{key}-{size}.png')
        paste_icon(sheet, icon, x + cell // 2, top + cell // 2)
        draw.text((x + cell // 2, top + cell + 6), cap, font=F_CAP, fill='#9A93A8', anchor='ma')
        x += cell + 12

    # 16px 浅底 4 倍放大（最近邻，看真实像素）
    icon16 = Image.open(f'{BASE}/{key}-16.png').resize((16 * 4, 16 * 4), Image.NEAREST)
    bg, border = LIGHT
    top = y + (ROW_H - 64 - 22) // 2
    draw.rounded_rectangle([x, top, x + 80, top + 64], radius=8, fill=bg, outline=border, width=1)
    paste_icon(sheet, icon16, x + 40, top + 32)
    draw.text((x + 40, top + 64 + 6), '16 · 4倍放大', font=F_CAP, fill='#9A93A8', anchor='ma')
    y += ROW_H

sheet.save(OUT)
print('sheet saved:', OUT, sheet.size)
