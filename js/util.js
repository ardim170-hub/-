/* 공통 유틸: 날짜, 문자열, 포맷 */
window.U = (() => {
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => fmt(new Date());
  const parse = s => {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
  /** b - a (일) */
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const WD = ['일', '월', '화', '수', '목', '금', '토'];

  function dday(s) {
    const n = diffDays(today(), s);
    if (n === 0) return { label: '오늘', tone: 'warn', n };
    if (n > 0) return { label: `D-${n}`, tone: n <= 3 ? 'accent' : 'outline', n };
    return { label: `${-n}일 지남`, tone: 'danger', n };
  }
  function ago(s) {
    if (!isDate(s)) return '';
    const n = diffDays(s, today());
    if (n < 0) return `${-n}일 후`;
    if (n === 0) return '오늘';
    if (n === 1) return '어제';
    if (n < 30) return `${n}일 전`;
    if (n < 365) return `${Math.floor(n / 30)}개월 전`;
    return `${Math.floor(n / 365)}년 전`;
  }
  const md = s => { if (!isDate(s)) return ''; const d = parse(s); return `${d.getMonth() + 1}.${pad(d.getDate())}`; };
  const dateKo = s => { if (!isDate(s)) return ''; const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`; };
  const dateDot = s => isDate(s) ? s.replace(/-/g, '.') : '';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString('ko-KR');
  const uid = p => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
  const norm = s => String(s ?? '').toLowerCase().replace(/[\s\-().]/g, '');
  /** 회사 이름 비교용: (주)·㈜·주식회사 같은 회사 형태 표기를 지우고 norm (norm이 괄호를 먼저 지우므로 순서가 중요) */
  const orgKey = s => norm(String(s ?? '').replace(/[(（]\s*(주|유|재|사|합|의)\s*[)）]|㈜|주식회사|유한회사|유한책임회사|재단법인|사단법인|합자회사|의료법인|사회복지법인/g, ''));

  /** 검색어를 강조 표시 (이스케이프 후) */
  function hl(text, q) {
    const t = esc(text);
    if (!q) return t;
    const i = String(text ?? '').toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return t;
    const raw = String(text);
    return esc(raw.slice(0, i)) + '<mark>' + esc(raw.slice(i, i + q.length)) + '</mark>' + esc(raw.slice(i + q.length));
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  /** 엑셀 날짜(숫자·Date·문자열)를 YYYY-MM-DD로 */
  function toDateStr(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return fmt(v);
    if (typeof v === 'number') {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return fmt(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    const s = String(v).trim().replace(/[./]/g, '-');
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : '';
  }

  /* 초성 검색: 'ㄱㅈㅂ' → '김정배' */
  const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const cho = s => String(s ?? '').replace(/[가-힣]/g, ch => CHO[Math.floor((ch.charCodeAt(0) - 0xAC00) / 588)]).replace(/\s/g, '');
  const isCho = q => /^[ㄱ-ㅎ]+$/.test(q);
  /** 여러 값 중 하나라도 검색어를 포함하는지 (띄어쓰기·하이픈 무시, 초성 검색 지원) */
  function match(q, ...vals) {
    const nq = norm(q);
    if (!nq) return true;
    if (isCho(nq)) return vals.some(v => cho(v).includes(nq));
    return vals.some(v => norm(v).includes(nq));
  }
  /** 가나다 색인용 첫 자음 (ㄲ→ㄱ 등으로 묶음) */
  const indexOf = s => {
    const c = cho(String(s ?? '').replace(/^\(주\)|^주식회사\s*/, '').trim()).charAt(0);
    return ({ 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' })[c] || (/[ㄱ-ㅎ]/.test(c) ? c : (c ? 'A-Z' : ''));
  };

  /* 문서보안(DRM)이 걸린 엑셀은 암호화돼 있어 표를 읽을 수 없다. 겉모양으로 알아보고 이유를 알려 준다 */
  const DRM_MARKS = [['DocuRay', 'DocuRay'], ['DRMONE', 'DRM ONE'], ['Fasoo', 'Fasoo'], ['FSN-', 'Fasoo'], ['SCDSA', 'SoftCamp'], ['NASCA', 'NASCA'], ['MarkAny', 'MarkAny'], ['MADRM', 'MarkAny'], ['SealDocument', 'Seal']];
  function drmOf(data) {
    let head = '';
    try {
      if (typeof data === 'string') head = data.slice(0, 600);
      else { const u = data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data); head = String.fromCharCode(...u.subarray(0, 600)); }
    } catch { return ''; }
    if (/^PK/.test(head)) return '';
    const hit = DRM_MARKS.find(([m]) => head.includes(m));
    return hit ? hit[1] : '';
  }
  const drmError = name => Object.assign(new Error(`이 파일은 문서보안(DRM${name ? ' · ' + name : ''})이 걸려 있어 열 수 없어요. 회사 PC의 엑셀에서 보안 해제(복호화·반출) 후 '다른 이름으로 저장'해서 올리거나, 엑셀에서 표를 드래그해 복사(Ctrl+C)한 뒤 붙여넣기로 넣어 주세요.`), { drm: true });
  if (window.XLSX && !XLSX.__drm) {
    const read = XLSX.read;
    XLSX.read = function (data, opts) { const d = drmOf(data); if (d) throw drmError(d); return read.call(this, data, opts); };
    XLSX.__drm = true;
  }

  return { drmOf, orgKey, cho, isCho, match, indexOf, pad, fmt, today, parse, isDate, addDays, diffDays, WD, dday, ago, md, dateKo, dateDot, esc, num, uid, norm, hl, debounce, toDateStr };
})();
