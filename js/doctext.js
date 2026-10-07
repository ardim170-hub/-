/* AI 없이 문서에서 사업체 정보 읽기
 * PDF에 글자가 들어 있으면(고용24 구인공고, 전자 발급 사업자등록증 등) 글자를 꺼내
 * '상호', '대표자', '등록번호', '소재지' 같은 항목 이름을 찾아 채운다. 스캔 PDF·사진은 읽지 못한다. */
window.DT = (() => {
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  let loading = null;

  /** pdf.js는 필요할 때만 불러온다 (인터넷 필요) */
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = async () => {
        const lib = window.pdfjsLib;
        if (!lib) return rej(new Error('PDF 도구를 불러오지 못했습니다.'));
        // 다른 주소의 워커는 바로 못 쓰므로 받아서 blob 주소로 띄운다. 안 되면 워커 없이 읽는다.
        try {
          const code = await (await fetch(PDFJS + 'pdf.worker.min.js')).text();
          lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        } catch { lib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; }
        res(lib);
      };
      s.onerror = () => { loading = null; rej(new Error('PDF 도구를 불러오지 못했습니다. 인터넷 연결을 확인하세요.')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  const openPdf = async file => (await loadPdfJs()).getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  /** 한 쪽의 글자를 위→아래 줄 단위로 */
  async function pageLines(page) {
    const { items } = await page.getTextContent();
    const rows = new Map();
    items.forEach(it => {
      if (!it.str || !it.str.trim()) return;
      const y = Math.round(it.transform[5] / 3);
      (rows.get(y) || rows.set(y, []).get(y)).push({ x: it.transform[4], s: it.str });
    });
    return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  }
  /** PDF → 줄 단위 글자 (앞쪽 3쪽까지) */
  async function pdfText(file) {
    const pdf = await openPdf(file);
    const lines = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 3); n++) lines.push(...await pageLines(await pdf.getPage(n)));
    return lines.join('\n');
  }
  /** PDF 쪽마다 글자 + 그림(명함 사진으로 쓸 JPG). 최대 max쪽 */
  async function pdfPages(file, max = 40, imgW = 1000) {
    const pdf = await openPdf(file);
    const out = [];
    for (let n = 1; n <= Math.min(pdf.numPages, max); n++) {
      const page = await pdf.getPage(n);
      const lines = await pageLines(page);
      let img = '';
      try {
        const vp0 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(3, imgW / vp0.width) });
        const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        img = cv.toDataURL('image/jpeg', .78);
      } catch { img = ''; }
      out.push({ page: n, lines, text: lines.join('\n'), img });
    }
    return { pages: out, total: pdf.numPages };
  }

  /* ---------- 명함 글자 → 연락처 (AI 없이) ---------- */
  const TITLES = '대표이사|대표|회장|사장|부사장|전무|상무|이사|본부장|국장|센터장|관장|원장|소장|실장|부장|차장|과장|팀장|대리|주임|계장|사원|매니저|책임|선임|수석|연구원|사회복지사|간사|코디네이터|위원|담당|주무관|팀원|교사|선생님';
  const TITLE_RE = new RegExp('(' + TITLES + ')');
  const ORG_RE = /\(주\)|㈜|주식회사|유한회사|\(유\)|협동조합|사회적협동조합|재단|법인|협회|공단|센터|복지관|병원|의원|학교|대학교|청$|시청|구청|군청|주민센터|행정복지센터|조합|회사|그룹|산업|테크|푸드|식품|물류|건설|\bInc\b|Co\.|Corp/i;
  const PHONE = /(?:\+82[-\s]?)?0\d{1,2}[-)\s.]*\d{3,4}[-\s.]*\d{4}/g;
  const ADDR_RE = /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|충청|전라|경상)[^\n]*?(시|군|구)\s[^\n]*?(로|길|동|읍|면|리)\s?\d/;
  const fmtTel = t => t.replace(/^\+82[-\s]?/, '0').replace(/[)\s.]+/g, '-').replace(/-+/g, '-').replace(/^0(1\d)(\d{3,4})(\d{4})$/, '0$1-$2-$3');
  function parseCard(text) {
    const lines = String(text || '').replace(/\r/g, '').replace(/[(（]\s*([주유사재])\s*[)）]\s*/g, '($1)').split('\n').map(l => l.trim()).filter(Boolean);
    const all = lines.join('\n');
    const r = { name: '', title: '', dept: '', org: '', mobile: '', phone: '', fax: '', email: '', address: '', homepage: '' };
    r.email = (all.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [''])[0];
    r.homepage = ((all.match(/(?:https?:\/\/)?www\.[a-z0-9.-]+\.[a-z]{2,}[^\s]*/i) || [''])[0]);
    lines.forEach(l => {
      const nums = l.match(PHONE) || [];
      nums.forEach(n => {
        const before = l.slice(0, l.indexOf(n)).slice(-8);
        const t = fmtTel(n);
        if (/fax|팩스|F[.:\s]*$/i.test(before)) { if (!r.fax) r.fax = t; }
        else if (/^01/.test(t.replace(/^\+82-?/, '0'))) { if (!r.mobile) r.mobile = t; }
        else if (!r.phone) r.phone = t;
      });
    });
    const addrLine = lines.find(l => ADDR_RE.test(l)) || lines.find(l => /^(주소|A[.:)]|Add)/i.test(l));
    if (addrLine) r.address = addrLine.replace(/^(주소|A[.:)]|Add(ress)?)\s*[:.]?\s*/i, '').replace(PHONE, '').replace(/(T|Tel|F|Fax|전화|팩스)[.:\s]*$/i, '').trim();
    const hasTel = l => new RegExp(PHONE.source).test(l);
    const plain = lines.filter(l => l !== addrLine && !hasTel(l) && !/@/.test(l) && !/www\./i.test(l));
    // 소속: (주)·복지관·센터처럼 분명한 이름을 먼저, 없으면 재단·법인 등
    const STRONG = /\(주\)|㈜|주식회사|유한회사|복지관|센터|병원|의원|학교|시청|구청|군청|공단|협회|조합/;
    const orgLine = plain.find(l => STRONG.test(l) && !/(팀|부|과)\s/.test(l + ' ')) || plain.find(l => ORG_RE.test(l));
    if (orgLine) r.org = orgLine.replace(/\s+/g, ' ').trim();
    const isDeptWord = w => /(팀|부|과|실|본부|사업단)$/.test(w);
    const isName = w => /^[가-힣]{2,4}$/.test(w) && !TITLE_RE.test(w) && !isDeptWord(w) && !ORG_RE.test(w);
    // 이름: 한글 2~4글자만 있는 줄이 가장 확실, 다음은 '홍길동 과장'·'과장 홍길동'
    const solo = plain.find(l => l !== orgLine && isName(l.replace(/\s/g, '')) && /^[가-힣](\s?[가-힣]){1,3}$/.test(l));
    if (solo) r.name = solo.replace(/\s/g, '');
    for (const l of plain) {
      if (l === orgLine) continue;
      // '이 수 영'처럼 한 글자씩 띄운 이름은 붙인다
      const words = l.replace(/(^|\s)([가-힣](?:\s[가-힣]){1,3})(?=\s|$)/g, (m0, sp, nm) => sp + nm.replace(/\s/g, '')).split(/[\s/·|,]+/).filter(Boolean);
      words.forEach((w, i) => {
        if (isDeptWord(w) && w.length <= 12 && !r.dept) r.dept = w;
        const t = w.match(TITLE_RE);
        if (t && t[0] === w && !r.title) r.title = w;
        if (!r.name && t && t[0] === w) { const nb = [words[i - 1], words[i + 1]].find(x => x && isName(x)); if (nb) r.name = nb; }
      });
    }
    return r;
  }
  /** 연락처가 하나라도 있으면 명함으로 본다 */
  const isCard = c => !!(c.mobile || c.phone || c.email);

  // '상 호', '상호(법인명)'처럼 글자 사이에 빈칸이 있어도 찾는다
  const lab = w => w.split('').map(c => c.replace(/[()]/g, '\\$&')).join('\\s*');
  const STOP = ['상호', '법인명', '사업장명', '회사명', '기업명', '업체명', '대표자명', '대표자', '대표전화', '전화번호', '성명', '등록번호', '사업자등록번호', '개업연월일', '법인등록번호', '사업장소재지', '소재지', '본점소재지', '주소', '업태', '종목', '전화', '연락처', '홈페이지', '업종', '모집직종', '모집분야', '직종', '근무지주소', '근무예정지', '근무지', '생년월일', '발급', '사업의종류'];
  const stopRe = new RegExp('\\s(?:' + STOP.map(lab).join('|') + ')(?:\\s*[:：]|\\s|$)', 'u');
  function pick(text, labels) {
    for (const l of labels) {
      const m = text.match(new RegExp('(?:^|\\n|\\s)' + lab(l) + '(?:\\s*\\((?:법인명|단체명|상호)[^)]*\\))?\\s*[:：]?\\s*([^\\n]+)', 'u'));
      if (m) {
        let v = m[1].split(stopRe)[0].trim().replace(/^[:：\s]+/, '');
        if (v) return v.slice(0, 120);
      }
    }
    return '';
  }
  /** 글자에서 사업체 항목 뽑기 */
  function parseBiz(text) {
    const t = String(text || '').replace(/\r/g, '').replace(/[(（]\s*주\s*[)）]/g, '(주)');
    const bizNo = (t.match(/\b(\d{3})\s*-\s*(\d{2})\s*-\s*(\d{5})\b/) || []).slice(1).join('-');
    const phone = pick(t, ['대표전화', '전화번호', '연락처', '전화']).match(/0\d{1,2}[-)\s.]*\d{3,4}[-\s.]*\d{4}/)?.[0]
      || (t.match(/0(?:31|2|70|1\d)[-)\s.]*\d{3,4}[-\s.]*\d{4}/) || [])[0] || '';
    const homepage = (t.match(/(?:https?:\/\/)?www\.[a-z0-9.-]+\.[a-z]{2,}[^\s]*/i) || [])[0] || '';
    const name = pick(t, ['상호(법인명)', '법인명(단체명)', '상호', '법인명', '사업장명', '회사명', '기업명', '업체명']);
    const industry = [pick(t, ['업태']), pick(t, ['종목'])].filter(Boolean).join(' · ') || pick(t, ['업종']);
    return {
      name, bizNo, phone: phone.replace(/[)\s.]+/g, '-').replace(/-+/g, '-'), homepage,
      ceo: pick(t, ['대표자명', '대표자', '성명', '대표']).replace(/\s*\(.*$/, ''),
      address: pick(t, ['사업장소재지', '사업장 소재지', '본점소재지', '근무지주소', '근무예정지', '소재지', '주소']),
      industry, jobs: pick(t, ['모집직종', '직종', '모집분야']),
    };
  }

  return { pdfText, pdfPages, parseCard, isCard, parseBiz };
})();
