// 모든 CSS·JS를 index.html 한 파일에 합쳐 dist/아르딤_취업지원.html 을 만든다.
// 사용: node scripts/build.mjs  → 만들어진 파일을 더블클릭하면 바로 실행된다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="((?:css|vendor)\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}\n</style>`);
html = html.replace(/<script src="((?:js|vendor)\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p).replace(/<\/script/gi, '<\\/script')}\n</script>`);

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', '아르딤_취업지원.html');
writeFileSync(out, html);
console.log(`만들었습니다: ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
