// 배포 파일을 만든다.  사용: node scripts/build.mjs
//  1) dist/아르딤_취업지원.html  : 모든 CSS·JS를 한 파일에 합친 버전. 더블클릭하면 이 PC에서만 쓰는 로컬 모드로 실행된다.
//  2) dist/apps-script/          : 구글 Apps Script에 붙여 넣는 팀 공유 버전 (Code.gs, index.html, appsscript.json)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const inlineJs = p => `<script>\n${read(p).replace(/<\/script/gi, '<\\/script')}\n</script>`;
// 화면에 보이는 버전: 만든 날짜·시각 (예전 파일을 열고 있는지 확인하는 용도)
const stamp = (() => { const d = new Date(Date.now() + 9 * 3600e3).toISOString(); return `${d.slice(0, 10).replace(/-/g, '.')} ${d.slice(11, 16)}`; })();
const src = read('index.html').replace('<script src="vendor/leaflet.js"></script>', `<script>window.APP_VERSION = ${JSON.stringify(stamp)};</script>\n<script src="vendor/leaflet.js"></script>`);

// Apps Script 파일 크기를 줄이기 위해 공유 버전은 라이브러리를 CDN에서 불러온다
const CDN = {
  'vendor/leaflet.css': '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">',
  'vendor/leaflet.js': '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>',
  'vendor/xlsx.full.min.js': '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>',
};

function build(useCdn) {
  return src
    .replace(/<link rel="stylesheet" href="((?:css|vendor)\/[^"]+)">/g, (_, p) => (useCdn && CDN[p]) || `<style>\n${read(p)}\n</style>`)
    .replace(/<script src="((?:js|vendor)\/[^"]+)"><\/script>/g, (_, p) => (useCdn && CDN[p]) || inlineJs(p));
}

mkdirSync(join(root, 'dist', 'apps-script'), { recursive: true });
const single = join(root, 'dist', '아르딤_취업지원.html');
writeFileSync(single, build(false));
writeFileSync(join(root, 'dist', 'apps-script', 'index.html'), build(true));
copyFileSync(join(root, 'apps-script', 'Code.gs'), join(root, 'dist', 'apps-script', 'Code.gs'));
copyFileSync(join(root, 'apps-script', 'appsscript.json'), join(root, 'dist', 'apps-script', 'appsscript.json'));
const kb = p => (readFileSync(p).length / 1024).toFixed(0) + ' KB';
console.log(`로컬 버전: ${single} (${kb(single)})`);
console.log(`공유 버전: dist/apps-script/index.html (${kb(join(root, 'dist', 'apps-script', 'index.html'))}), Code.gs, appsscript.json`);
