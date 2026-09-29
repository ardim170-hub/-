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

  /** PDF → 줄 단위 글자 (앞쪽 3쪽까지) */
  async function pdfText(file) {
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const lines = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 3); n++) {
      const page = await pdf.getPage(n);
      const { items } = await page.getTextContent();
      const rows = new Map();
      items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const y = Math.round(it.transform[5] / 3);
        (rows.get(y) || rows.set(y, []).get(y)).push({ x: it.transform[4], s: it.str });
      });
      [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) => lines.push(r.sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ').trim()));
    }
    return lines.filter(Boolean).join('\n');
  }

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

  return { pdfText, parseBiz };
})();
