// 배포 파일을 만든다.  사용: node scripts/build.mjs
//  1) dist/아르딤_취업지원.html  : 모든 CSS·JS를 한 파일에 합친 버전. 더블클릭하면 이 PC에서만 쓰는 로컬 모드로 실행된다.
//  2) dist/apps-script/          : 구글 Apps Script에 붙여 넣는 팀 공유 버전 (Code.gs, index.html, appsscript.json)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
/* Apps Script 파일은 1MB를 넘으면 저장되지 않으므로, 공유 버전은 esbuild로 줄인다(주석·공백 제거). 글자는 utf8 그대로 */
let esb = null;
try { esb = await import('esbuild'); } catch { console.warn('⚠ esbuild가 없어 줄이지 않고 만듭니다. (npm i 후 다시 빌드하세요)'); }
// 한 줄이 너무 길면 편집기가 버거워하므로 줄바꿈은 남긴다 (JS: 주석 제거·이름 줄임만, CSS: 규칙마다 한 줄)
const mini = (code, loader) => {
  if (!esb) return code;
  if (loader === 'css') return esb.transformSync(code, { loader, minify: true, charset: 'utf8', legalComments: 'none' }).code.replace(/\}/g, '}\n');
  return esb.transformSync(code, { loader, minifySyntax: true, minifyIdentifiers: true, minifyWhitespace: false, charset: 'utf8', target: 'es2020', legalComments: 'none' }).code;
};
const inlineJs = (p, forGas) => `<script>\n${(forGas ? gasSafe(/hwaseong/.test(p) ? read(p) : mini(read(p), 'js')) : read(p)).replace(/<\/script/gi, '<\\/script')}\n</script>`;

/* Apps Script는 페이지를 내보낼 때 JS의 // 주석을 지우는데, '…' "…" 문자열만 알고 `…` 템플릿 문자열은 모른다.
 * 그래서 `https://…` 같은 템플릿 안의 // 뒤를 주석으로 잘라 버려 코드가 깨진다.
 * 그래서 모든 :// 를 문자열·정규식 안에서 같은 뜻인 :\/\/ 로 바꾸고, 바꾼 결과를 흉내 낸 주석 지우기로 다시 검사한다. */
const gasSafe = js => js.replace(/:\/\//g, ':\\/\\/');
function gasStrip(js) {
  let out = '', q = null;
  for (let i = 0; i < js.length; i++) {
    const c = js[i];
    if (c === '\\') { out += c + (js[++i] || ''); continue; }
    if (q) { out += c; if (c === q || c === '\n') q = null; continue; }
    if (c === "'" || c === '"') { q = c; out += c; continue; }
    if (c === '/' && js[i + 1] === '*') { const end = js.indexOf('*/', i + 2); i = end < 0 ? js.length : end + 1; out += ' '; continue; }
    if (c === '/' && js[i + 1] === '/') { while (i < js.length && js[i] !== '\n') i++; out += '\n'; continue; }
    out += c;
  }
  return out;
}
function checkGas(html) {
  const bad = [];
  for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    try { new vm.Script(gasStrip(code)); } catch (e) { bad.push(`${e.message}: ${code.trim().split('\n')[0].slice(0, 60)}`); }
  }
  if (bad.length) throw new Error('Apps Script에서 깨질 코드가 있습니다:\n' + bad.join('\n'));
}
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
    .replace(/<link rel="stylesheet" href="((?:css|vendor)\/[^"]+)">/g, (_, p) => (useCdn && CDN[p]) || `<style>\n${useCdn ? mini(read(p), 'css') : read(p)}\n</style>`)
    .replace(/<script src="((?:js|vendor)\/[^"]+)"><\/script>/g, (_, p) => (useCdn && CDN[p]) || inlineJs(p, useCdn));
}

mkdirSync(join(root, 'dist', 'apps-script'), { recursive: true });
const single = join(root, 'dist', '아르딤_취업지원.html');
writeFileSync(single, build(false));
const gasHtml = build(true);
checkGas(gasHtml);
/* Apps Script는 파일 하나가 1MB를 넘으면 저장이 안 되므로 나눈다:
 * index.html(뼈대) + style.html(CSS) + app1~app3.html(JS, 순서대로 크기를 고르게). Code.gs의 include()가 합친다 */
const GAS_DIR = join(root, 'dist', 'apps-script');
const APP_PARTS = 3;
function splitGas(html) {
  const styles = [], scripts = [];
  let out = html.replace(/<style>\n[\s\S]*?\n<\/style>/g, m => { styles.push(m); return styles.length === 1 ? "<?!= include('style'); ?>" : ''; });
  out = out.replace(/<script>\n[\s\S]*?\n<\/script>/g, m => { scripts.push(m); return scripts.length === 1 ? Array.from({ length: APP_PARTS }, (_, i) => `<?!= include('app${i + 1}'); ?>`).join('\n') : ''; });
  const total = scripts.reduce((a, x) => a + x.length, 0), parts = Array.from({ length: APP_PARTS }, () => []);
  let acc = 0;
  scripts.forEach(x => { const k = Math.min(APP_PARTS - 1, Math.floor(acc / (total / APP_PARTS))); parts[k].push(x); acc += x.length; });
  if (out.includes('<?') && (out.match(/<\?/g) || []).length !== APP_PARTS + 1) throw new Error('index.html 뼈대에 템플릿 기호(<?)가 더 있습니다');
  return { index: out, files: { style: styles.join('\n'), ...Object.fromEntries(parts.map((p, i) => [`app${i + 1}`, p.join('\n')])) } };
}
const parts = splitGas(gasHtml);
writeFileSync(join(GAS_DIR, 'index.html'), parts.index);
for (const [n, c] of Object.entries(parts.files)) writeFileSync(join(GAS_DIR, `${n}.html`), c);
const big = Object.entries({ index: parts.index, ...parts.files }).map(([n, c]) => [n, Buffer.byteLength(c)]);
console.log('Apps Script 파일: ' + big.map(([n, b]) => `${n}.html ${Math.round(b / 1024)}KB`).join(' · '));
if (big.some(([, b]) => b > 950000)) throw new Error('1MB에 가까운 파일이 있습니다. APP_PARTS를 늘리세요.');
copyFileSync(join(root, 'apps-script', 'Code.gs'), join(root, 'dist', 'apps-script', 'Code.gs'));
copyFileSync(join(root, 'apps-script', 'appsscript.json'), join(root, 'dist', 'apps-script', 'appsscript.json'));
const kb = p => (readFileSync(p).length / 1024).toFixed(0) + ' KB';
console.log(`로컬 버전: ${single} (${kb(single)})`);
console.log('공유 버전: dist/apps-script/ (index·style·app1~app3.html, Code.gs, appsscript.json)');
