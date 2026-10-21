import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, 'web'), output, { recursive: true });
await cp(resolve(root, 'src/domain'), resolve(output, 'domain'), {
  recursive: true,
  filter: (source) => !source.endsWith('.test.mjs'),
});
process.stdout.write(`已准备前端文件：${output}\n`);
