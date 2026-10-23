import { readFileSync, writeFileSync } from 'node:fs';

const dir = '/Users/frog/Projects/Resume/extension';
const html = readFileSync(`${dir}/sidepanel.html`, 'utf8');
const css = readFileSync(`${dir}/sidepanel.css`, 'utf8');

const deps = [
  'domain-resume-content.mjs',
  'domain-auto-layout.mjs',
  'text-runs.mjs',
];

// 把 ES module 拆成可被单个内联 <script type=module> 直接执行的代码：
// 去掉 import 行（本地相对路径在 file:// 下无法再加载），去掉 export 关键字。
function stripModuleSyntax(code) {
  code = code.replace(/^\s*import\s+[^;]*?from\s*['"][^'"]*['"];?\s*$/gm, '');
  code = code.replace(/^\s*import\s*['"][^'"]*['"];?\s*$/gm, '');
  code = code.replace(/\bexport\s+(default\s+)?/g, '');
  return code;
}

let js = '';
for (const dep of deps) {
  js += `\n/* ===== ${dep} ===== */\n` + stripModuleSyntax(readFileSync(`${dir}/${dep}`, 'utf8'));
}
js += `\n/* ===== sidepanel.mjs ===== */\n` + stripModuleSyntax(readFileSync(`${dir}/sidepanel.mjs`, 'utf8'));

const inlined = html
  .replace('<link rel="stylesheet" href="sidepanel.css">', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="sidepanel.mjs"></script>', `<script type="module">\n${js}\n</script>`);

const out = '/Users/frog/Projects/Resume/sidepanel-debug.html';
writeFileSync(out, inlined, 'utf8');
console.log('written', out, inlined.length, 'bytes');
