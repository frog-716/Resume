// 生成 Resume 扩展图标候选：GitHub 小猫 · 金色系（深浅双色）。
// 输出 16/32/48/128 四档 PNG 到 candidates/，供审核与后续提拔到 extension/icons/。
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire('/Users/frog/.workbuddy/binaries/node/workspace/package.json');
const sharp = require('sharp');

const OUT = '/Users/frog/Projects/Resume/design-handoff/extension-icon/candidates';

// GitHub Octocat 官方路径（octicons v17.11.0 经典版：长尾弧线、圆身、双耳，
// 与 GitHub 网站同一只猫）。经与官方 SVG 逐字节核对后整体替换，勿再手工改写。
const CAT = 'M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z';

// 猫在 128 画布中的摆放：8px 边距，112px 见方
const CAT_T = 'translate(8,8) scale(7)';

// 五个候选设计。描边一律用“底层粗描边 + 上层填充”实现，避免依赖 paint-order。
const designs = {
  // A 双色金·外深内亮：深金轮廓在外，亮金渐变身体在内
  a: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="aBody" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="#FFE888"/><stop offset=".5" stop-color="#F7C948"/><stop offset="1" stop-color="#DFA41C"/>
    </linearGradient>
  </defs>
  <g transform="${CAT_T}">
    <path d="${CAT}" fill="none" stroke="#6E4E00" stroke-width="0.72" stroke-linejoin="round"/>
    <path d="${CAT}" fill="url(#aBody)"/>
  </g>
</svg>`,

  // B 双色金·外亮内深：亮金描边在外，深金渐变身体在内（A 的反相）
  b: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bBody" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="#D9A51C"/><stop offset="1" stop-color="#8A6400"/>
    </linearGradient>
  </defs>
  <g transform="${CAT_T}">
    <path d="${CAT}" fill="none" stroke="#FFD94D" stroke-width="0.72" stroke-linejoin="round"/>
    <path d="${CAT}" fill="url(#bBody)"/>
  </g>
</svg>`,

  // C 金箔浮雕：三段渐变出厚度，顶部高光 + 底部暗影，细深金勾边
  c: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="cBody" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#FFF6C8"/><stop offset=".45" stop-color="#FFD34D"/><stop offset="1" stop-color="#B87F0A"/>
    </linearGradient>
    <clipPath id="cClip"><path d="${CAT}" transform="${CAT_T}"/></clipPath>
  </defs>
  <g transform="${CAT_T}">
    <path d="${CAT}" fill="none" stroke="#7A5C00" stroke-width="0.66" stroke-linejoin="round"/>
    <path d="${CAT}" fill="url(#cBody)"/>
  </g>
  <g clip-path="url(#cClip)">
    <ellipse cx="64" cy="30" rx="56" ry="26" fill="#FFFFFF" opacity="0.34"/>
    <ellipse cx="64" cy="128" rx="62" ry="24" fill="#4A3200" opacity="0.16"/>
  </g>
</svg>`,

  // D 徽章金章（2026-10-21 用户定稿为扩展图标）：
  // 外深金圆角方块 full-bleed + 猫裹着的奶油圆与方块四边相切（内切圆）+ 深金负形猫。
  // 几何：mark 路径自带 r=8 圆盘（16 视图），scale(8) → r=64 内切于 128 方块，
  // 与四边中点相切；原亮金内框与圆几何冲突，移除。描边被 viewport 在切点处干净裁齐。
  d: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="dBg" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="#C9930A"/><stop offset="1" stop-color="#6E4E00"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="128" height="128" rx="27" fill="url(#dBg)"/>
  <g transform="scale(8)">
    <path d="${CAT}" fill="#FFF3B0"/>
    <path d="${CAT}" fill="none" stroke="#8A6400" stroke-width="0.34" stroke-linejoin="round"/>
  </g>
</svg>`,

  // E 描边金：与纸面“白猫”同款细线风格，单色金，最小尺寸用非缩放描边保清晰
  e: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <g transform="translate(10,10) scale(6.75)">
    <path d="${CAT}" fill="none" stroke="#C9930A" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </g>
</svg>`,

  // ---- 以下三个按用户参考图色系（外圈上亮下深金盘 + 猫为负形/内猫）重做 ----
  // 参考图实测：圆盘占画面 86.5%，金色纵向渐变 #D9A91D→#9B7205，顶部亮金高光，
  // 猫为奶油负形 #F5F1ED。统一圆盘 r=56（直径 112，占 87.5%），猫 translate(8,8) scale(7)。

  // F 金盘负形·奶油猫：复刻参考图——金盘渐变 + 顶部高光，猫填奶油色
  f: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="fDisc" x1="0" y1="0" x2="0.12" y2="1">
      <stop offset="0" stop-color="#D9A91D"/><stop offset="0.5" stop-color="#C29215"/><stop offset="1" stop-color="#9B7205"/>
    </linearGradient>
    <radialGradient id="fSpec" cx="0.5" cy="0.16" r="0.8">
      <stop offset="0" stop-color="#FFD94E" stop-opacity="0.5"/><stop offset="0.55" stop-color="#FFD94E" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="64" cy="64" r="56" fill="url(#fDisc)"/>
  <circle cx="64" cy="64" r="56" fill="url(#fSpec)"/>
  <g transform="translate(8,8) scale(7)">
    <path d="${CAT}" fill="#F5F1ED"/>
  </g>
</svg>`,

  // G 金盘负形·透明猫：同 F 但猫为镂空（透出工具栏底色，深浅工具栏自适应）
  g: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="gDisc" x1="0" y1="0" x2="0.12" y2="1">
      <stop offset="0" stop-color="#D9A91D"/><stop offset="0.5" stop-color="#C29215"/><stop offset="1" stop-color="#9B7205"/>
    </linearGradient>
    <radialGradient id="gSpec" cx="0.5" cy="0.16" r="0.8">
      <stop offset="0" stop-color="#FFD94E" stop-opacity="0.5"/><stop offset="0.55" stop-color="#FFD94E" stop-opacity="0"/>
    </radialGradient>
    <mask id="gCut">
      <circle cx="64" cy="64" r="56" fill="#ffffff"/>
      <g transform="translate(8,8) scale(7)"><path d="${CAT}" fill="#000000"/></g>
    </mask>
  </defs>
  <circle cx="64" cy="64" r="56" fill="url(#gDisc)" mask="url(#gCut)"/>
  <circle cx="64" cy="64" r="56" fill="url(#gSpec)" mask="url(#gCut)"/>
</svg>`,

  // H 金盘双色·亮金猫：深金盘在外，亮金 #FFD94E 猫在内 —— 参考色系的双色猫版本
  h: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="hDisc" x1="0" y1="0" x2="0.12" y2="1">
      <stop offset="0" stop-color="#C99716"/><stop offset="1" stop-color="#8A6400"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="56" fill="url(#hDisc)"/>
  <g transform="translate(8,8) scale(7)">
    <path d="${CAT}" fill="#FFD94E"/>
    <path d="${CAT}" fill="none" stroke="#B8890A" stroke-width="0.28" stroke-linejoin="round"/>
  </g>
</svg>`,
};

await mkdir(OUT, { recursive: true });
for (const [key, svg] of Object.entries(designs)) {
  for (const size of [16, 32, 48, 128]) {
    // 以 128 栅格渲染后再缩到目标尺寸，小尺寸边缘更平滑
    await sharp(Buffer.from(svg)).resize(size, size, { kernel: 'lanczos3' }).png().toFile(`${OUT}/${key}-${size}.png`);
  }
  console.log(`design ${key}: 16/32/48/128 rendered`);
}
console.log('done');
