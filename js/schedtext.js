/* 일정 칠판: 한 줄로 쓰면 날짜·시간·종류·대상을 알아서 나눠 일정으로 만든다.
 * 예) "11/20~22 오후2시~4시 다온식품 면접 동행"  → 11/20, 11/21, 11/22 세 건 · 14:00~16:00 · 면접 동행 · 다온식품 연결
 *     "내일 10시 매송면 행정복지센터 홍보"       → 내일 하루 · 10:00 · 홍보
 *     "다음주 수 15:30 김정배 라온요양원 방문"    → 다음 주 수요일 · 담당 김정배
 * 달력에서 날짜를 끌어(드래그) 고르면 그 기간이 앞에 채워진다 */
window.ST = (() => {
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const WD = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
  const TYPE_WORDS = [['면접', '면접 동행'], ['동행', '면접 동행'], ['방문', '방문'], ['전화', '전화'], ['통화', '전화'], ['미팅', '미팅'], ['회의', '미팅'], ['상담', '미팅'], ['행사', '행사'], ['교육', '행사'], ['박람회', '행사'], ['설명회', '행사'], ['홍보', '홍보']];

  /** 날짜 하나 읽기. 돌려주는 것: { date: 'YYYY-MM-DD', len } (못 읽으면 null) */
  function dateAt(s, base) {
    const T = new Date(base + 'T00:00:00');
    let m;
    if ((m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})일?/))) return { date: `${m[1]}-${pad(m[2])}-${pad(m[3])}`, len: m[0].length };
    if ((m = s.match(/^(\d{1,2})월\s*(\d{1,2})일?/)) || (m = s.match(/^(\d{1,2})[/.](\d{1,2})(?![\d:])/))) return { date: guessYear(+m[1], +m[2], T), len: m[0].length };
    if ((m = s.match(/^(오늘|내일|모레)/))) { const d = new Date(T); d.setDate(d.getDate() + { 오늘: 0, 내일: 1, 모레: 2 }[m[1]]); return { date: ymd(d), len: m[0].length }; }
    if ((m = s.match(/^(이번\s*주|다음\s*주|담주|다다음\s*주)?\s*([일월화수목금토])요?일?(?![가-힣])/)) && (m[1] || /요일/.test(m[0]))) {
      const add = !m[1] ? 0 : /다다음/.test(m[1]) ? 14 : /다음|담주/.test(m[1]) ? 7 : 0;
      const d = new Date(T); const mon = new Date(T); mon.setDate(T.getDate() - ((T.getDay() + 6) % 7)); // 이번 주 월요일
      d.setTime(mon.getTime()); d.setDate(mon.getDate() + ((WD[m[2]] + 6) % 7) + add);
      if (!m[1] && d < T) d.setDate(d.getDate() + 7); // '수요일'만 쓰면 다가오는 수요일
      return { date: ymd(d), len: m[0].length };
    }
    return null;
  }
  /** 연도 없이 쓴 날짜: 지금보다 두 달 넘게 지난 날이면 내년으로 */
  function guessYear(mo, d, T) {
    let y = T.getFullYear();
    const cand = new Date(y, mo - 1, d);
    if ((T - cand) / 86400000 > 60) y++;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  /** 시간 하나 읽기 → [시, 분] */
  function timeAt(s) {
    let m = s.match(/^(오전|오후|아침|저녁|낮)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시\s*(?:(\d{1,2})\s*분|(반))?)/);
    if (!m) return null;
    if (!m[3] && !/시/.test(m[0])) return null; // '14' 처럼 숫자만은 시간으로 보지 않는다
    let h = +m[2]; const mi = m[3] ? +m[3] : m[4] ? +m[4] : m[5] ? 30 : 0;
    if ((m[1] === '오후' || m[1] === '저녁') && h < 12) h += 12;
    else if (!m[1] && h >= 1 && h <= 7) h += 12; // 1~7시는 오후(근무시간)
    if (h > 23 || mi > 59) return null;
    return { hm: `${pad(h)}:${pad(mi)}`, len: m[0].length };
  }
  const RANGE = /^\s*(?:~|-|–|부터|에서)\s*/;
  const UNTIL = /^\s*까지/;

  function parse(text, opt = {}) {
    const base = opt.today || U.today();
    let s = String(text || '').replace(/\s+/g, ' ').trim();
    const out = { from: '', to: '', time: '', type: '', title: '', staff: '', target: null, dates: [] };
    const cut = []; // 날짜·시간으로 쓴 부분은 제목에서 뺀다
    // 앞에서부터 훑으며 날짜·시간 찾기
    for (let i = 0; i < s.length; i++) {
      if (i && /[0-9가-힣]/.test(s[i - 1]) && /[0-9]/.test(s[i])) continue; // 숫자 중간에서는 시작하지 않는다
      const rest = s.slice(i);
      if (!out.from) {
        const a = dateAt(rest, base);
        if (a) {
          let len = a.len; out.from = a.date;
          const r = rest.slice(len).match(RANGE);
          if (r) {
            const after = rest.slice(len + r[0].length);
            const b = dateAt(after, base) || (() => { const m = after.match(/^(\d{1,2})일?(?![\d:시/.])/); return m ? { date: a.date.slice(0, 8) + pad(m[1]), len: m[0].length } : null; })();
            if (b) { out.to = b.date; len += r[0].length + b.len; const u = rest.slice(len).match(UNTIL); if (u) len += u[0].length; }
          }
          cut.push([i, i + len]); i += len - 1; continue;
        }
      }
      if (!out.time) {
        const t = timeAt(rest);
        if (t) {
          let len = t.len; let tt = t.hm;
          const r = rest.slice(len).match(RANGE);
          if (r) { const t2 = timeAt(rest.slice(len + r[0].length)) || (() => { const m = rest.slice(len + r[0].length).match(/^(\d{1,2})(?:시|:(\d{2}))?/); if (!m) return null; let h = +m[1]; if (h <= 7) h += 12; if (h < +t.hm.slice(0, 2)) h += 12; return h <= 23 ? { hm: `${pad(h)}:${pad(m[2] || 0)}`, len: m[0].length } : null; })(); if (t2) { tt += '~' + t2.hm; len += r[0].length + t2.len; const u = rest.slice(len).match(UNTIL); if (u) len += u[0].length; } }
          out.time = tt; cut.push([i, i + len]); i += len - 1; continue;
        }
      }
    }
    let title = s;
    cut.sort((a, b) => b[0] - a[0]).forEach(([a, b]) => { title = title.slice(0, a) + ' ' + title.slice(b); });
    // 종류
    const tw = TYPE_WORDS.find(([w]) => title.includes(w));
    out.type = tw ? tw[1] : '기타';
    // 담당 직원 이름이 들어 있으면 그 사람 일정
    const staff = (S.staff() || []).map(x => x.name).filter(Boolean).sort((a, b) => b.length - a.length).find(n => title.includes(n));
    if (staff) { out.staff = staff; title = title.replace(staff, ' '); }
    // 사업체·기관 이름이 들어 있으면 연결 (긴 이름 먼저)
    const key = x => U.orgKey(x);
    const tk = key(title);
    const cands = [...S.get().businesses.map(x => ['biz', x]), ...S.get().networks.map(x => ['net', x])].filter(([, x]) => x.name && key(x.name).length >= 2 && tk.includes(key(x.name))).sort((a, b) => b[1].name.length - a[1].name.length);
    if (cands[0]) out.target = { kind: cands[0][0], id: cands[0][1].id, name: cands[0][1].name };
    out.title = title.replace(/\s+/g, ' ').replace(/^[\s,·/-]+|[\s,·/-]+$/g, '').trim();
    // 날짜 목록 (주말 빼기 선택)
    if (!out.from) out.from = base;
    const to = out.to && out.to >= out.from ? out.to : out.from;
    for (let d = out.from, n = 0; d <= to && n < 62; d = U.addDays(d, 1), n++) {
      const wd = U.parse(d).getDay();
      if (opt.skipWeekend && out.to && (wd === 0 || wd === 6)) continue;
      out.dates.push(d);
    }
    return out;
  }
  /** 일정으로 만들기 */
  function toEvents(p) {
    const title = p.title || (p.target ? `${p.type} - ${p.target.name}` : p.type);
    return p.dates.map(date => ({ date, time: p.time, type: p.type, title, targetType: p.target ? p.target.kind : '', targetId: p.target ? p.target.id : '', memo: '', staff: p.staff || S.me(), src: '칠판' }));
  }
  return { parse, toEvents };
})();
