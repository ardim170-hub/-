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

  return { pad, fmt, today, parse, isDate, addDays, diffDays, WD, dday, ago, md, dateKo, dateDot, esc, num, uid, norm, hl, debounce, toDateStr };
})();
