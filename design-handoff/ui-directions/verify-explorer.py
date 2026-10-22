import re
base = '/Users/frog/Projects/Resume/'
v34 = open(base + 'prototypes/a4-spacing-eight-gaps-demo-v34.html', encoding='utf-8').read()
V34_GH = re.search(r'(<svg class="github-cat".*?</svg>)', v34, re.S).group(1)
src = open(base + 'design-handoff/ui-directions/style-explorer.html', encoding='utf-8').read()
# explorer 内嵌候选的转义形式：< -> < 、> -> >（字面）、" -> "
decoded = src.replace('\\u003c', '<').replace('\\"', '"')
svgs = re.findall(r'<svg class="github-cat".*?</svg>', decoded, re.S)
print('embedded github-cat svgs:', len(svgs))
ok = sum(1 for s in svgs if s == V34_GH)
print('byte-exact vs v34:', ok, '/', len(svgs))
print('stroke leftovers:', src.count('stroke="#24292f"'))
