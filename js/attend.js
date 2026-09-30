/* 장애인일자리 출석부 (참여자 근태 현황)
   - 칸 값: 근무 시간 숫자, '휴'(휴무), 또는 '시간|상태' (상태: 공=공가, 특=특휴, 병=병가, 결=결근)
   - 토요일 칸은 그 주 시간 합계, 일요일은 비움 (기존 엑셀 양식과 같게)
   - 실적건수 = 시간이 적힌 날 수, 실근무 일수 = 기준일수 − 근태(공가·특휴·병가·결근) − 휴무
   - 아래 줄: 근무 인원(무엇이든 적힌 사람), 병가·공가 사용 인원(휴무·근태), 실 근무 인원 */
window.AT = (() => {
  const e = U.esc;
  V.I.att = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M4 9h16M8.5 14.5l2 2 4-4"/></svg>';
  const ST = {
    공: { label: '공가', color: '#92D050', ink: '#1F3B06' },
    특: { label: '특휴', color: '#36A0F8', ink: '#fff' },
    병: { label: '병가', color: '#B850D8', ink: '#fff' },
    결: { label: '결근', color: '#1B1F24', ink: '#fff' },
  };
  const TYPES = ['복지형', '일반형'];
  const SUBS = ['참여형', '시간제', '전일제'];
  const DEFAULT_PATTERN = { 참여형: '3,3,3,3,2', 시간제: '4,4,4,4,4', 전일제: '8,8,8,8,8' };
  const OFF_LIMIT = 3; // 한 달 휴무 사용 기준
  const GOAL_HOURS = 56; // 한 달 목표 훈련시간 (달마다 바꿀 수 있음)
  // 공휴일 (대체공휴일 포함). 달마다 출석부 화면에서 고칠 수 있다
  const HOLIDAYS = {
    '2026-01': [1], '2026-02': [16, 17, 18], '2026-03': [2], '2026-05': [5, 25], '2026-06': [3], '2026-08': [17],
    '2026-09': [24, 25], '2026-10': [5, 9], '2026-12': [25],
    '2027-01': [1], '2027-02': [8, 9], '2027-03': [1], '2027-05': [5, 13], '2027-06': [7], '2027-08': [16], '2027-09': [14, 15, 16], '2027-10': [4, 11], '2027-12': [27],
  };
  const ui = { month: U.today().slice(0, 7), shortOnly: false, showSrc: false, view: 'month', pasteTbl: false, brush: '공', num: '3', group: '', showPeople: false, imp: null, paste: false };

  /* ---------- 데이터 ---------- */
  const people = () => [...S.get().jobPeople].sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || SUBS.indexOf(a.sub) - SUBS.indexOf(b.sub) || (Number(a.no) || 999) - (Number(b.no) || 999) || (a.name || '').localeCompare(b.name || ''));
  const dim = m => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
  const wd = (m, d) => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, d).getDay();
  const dstr = (m, d) => `${m}-${U.pad(d)}`;
  const normDate = v => { const s = String(v || '').trim().replace(/\.$/, ''); const k = s.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/); return k ? `${k[1]}-${U.pad(+k[2])}-${U.pad(+k[3])}` : s; };
  /** 그 달에 참여 중인 사람 (시작일 ≤ 말일, 종료일 ≥ 1일) */
  const recOf = (pid, m) => S.get().attends.find(a => a.pid === pid && a.month === m) || null;
  /** 그 달에 기록이 있거나 참여 기간 안인 사람 */
  const activeIn = (p, m) => {
    const r = recOf(p.id, m);
    if (r && r.days && r.days !== '{}') return true;
    const s = normDate(p.start), en = normDate(p.end);
    return (!s || !/^\d{4}-/.test(s) || s <= dstr(m, dim(m))) && (!en || !/^\d{4}-/.test(en) || en >= dstr(m, 1));
  };
  // 같은 글자는 한 번만 풀어 둔다 (표를 다시 그릴 때 빠르게). 고칠 수 있게 늘 복사본을 돌려준다
  const dayCache = new Map();
  const parseDays = r => {
    if (!r || !r.days) return {};
    if (typeof r.days !== 'string') return { ...r.days };
    let o = dayCache.get(r.days);
    if (!o) { try { o = JSON.parse(r.days); } catch { o = {}; } if (dayCache.size > 3000) dayCache.clear(); dayCache.set(r.days, o); }
    return { ...o };
  };
  const daysOf = (pid, m) => parseDays(recOf(pid, m));
  function meta(m) {
    const d = daysOf('_', m);
    const holidays = Array.isArray(d.holidays) ? d.holidays : (HOLIDAYS[m] || []);
    let weekdays = 0; for (let i = 1; i <= dim(m); i++) { const w = wd(m, i); if (w > 0 && w < 6) weekdays++; }
    return { holidays, base: Number(d.base) || weekdays, weekdays, goal: Number(d.goal) || GOAL_HOURS };
  }
  /** 요일별 기본 시간 (월~금) */
  const patternOf = p => { const arr = String(p.pattern || DEFAULT_PATTERN[p.sub] || DEFAULT_PATTERN.참여형).split(/[,\s/]+/).map(Number).filter(n => !isNaN(n)); while (arr.length < 5) arr.push(arr[arr.length - 1] || 0); return arr; };
  const baseHours = (p, m, d) => { const w = wd(m, d); return w > 0 && w < 6 ? patternOf(p)[w - 1] : 0; };
  function cell(v) {
    const s = String(v ?? '');
    if (!s) return { empty: true };
    if (s === '휴' || s === '휴무') return { off: true };
    const [h, st] = s.split('|');
    return { h: h === '' || isNaN(+h) ? null : +h, st: ST[st] ? st : '' };
  }

  /** 한 사람의 한 달 합계 */
  function sums(p, m, days = daysOf(p.id, m), mt = meta(m)) {
    const o = { hours: 0, cnt: 0, 공: 0, 특: 0, 병: 0, 결: 0, off: 0 };
    for (let d = 1; d <= dim(m); d++) {
      const w = wd(m, d); if (w === 0 || w === 6) continue;
      const c = cell(days[d]);
      if (c.off) o.off++;
      if (c.h != null) { o.hours += c.h; o.cnt++; }
      if (c.st) o[c.st]++;
    }
    o.gt = o.공 + o.특 + o.병 + o.결;
    o.real = Math.max(0, mt.base - o.gt - o.off);
    return o;
  }
  /** 날짜별 인원 */
  function daily(list, m, all) {
    const out = {};
    for (let d = 1; d <= dim(m); d++) {
      let work = 0, use = 0;
      const place = {};
      list.forEach(p => { const c = cell(all[p.id][d]); if (c.empty) return; work++; if (c.off || c.st) use++; else if (p.place) place[p.place] = (place[p.place] || 0) + 1; });
      out[d] = { work, use, real: work - use, place };
    }
    return out;
  }

  /* ---------- 화면 ---------- */
  function page() {
    return `
      <div class="page-head">
        <div><h1 class="page-title">출석부 <span class="sub">장애인일자리</span></h1><div class="page-desc">참여자 근태를 달력처럼 칠해서 기록하고, 시간·실적건수·실근무 일수를 자동으로 셉니다. 인쇄하면 A4 가로 한 장이에요.</div></div>
        <div class="inline"><button class="btn" type="button" data-act="at-import">엑셀 파일 불러오기</button><button class="btn" type="button" data-act="at-pastetbl">표 붙여넣기</button><button class="btn btn-primary" type="button" data-act="at-print" ${ui.view === 'year' ? 'disabled' : ''}>🖨 인쇄</button></div>
      </div>
      <div class="toolbar perf-bar at-bar">
        <div class="month-nav"><button class="icon-btn" type="button" data-act="at-year" data-d="-1" aria-label="이전 해">${V.I.back}</button><b class="num">${ui.month.slice(0, 4)}년</b><button class="icon-btn" type="button" data-act="at-year" data-d="1" aria-label="다음 해" style="transform:scaleX(-1)">${V.I.back}</button></div>
        <div class="at-months" role="tablist" aria-label="달 고르기">${monthStrip()}</div>
      </div>
      <div id="atResults"></div>`;
  }

  /** 1~12월 버튼: 기록이 있는 달은 인원·시간을 보여 준다 */
  function monthStrip() {
    const y = ui.month.slice(0, 4);
    const ppl = S.get().jobPeople;
    return `<button type="button" class="am ${ui.view === 'year' ? 'on' : ''}" data-act="at-view" data-v="year"><b>연간</b><small>요약</small></button>` + Array.from({ length: 12 }, (_, i) => {
      const m = `${y}-${U.pad(i + 1)}`;
      const recs = S.get().attends.filter(a => a.month === m && a.pid !== '_' && a.days && a.days !== '{}');
      const hours = recs.reduce((t, r) => { const p = ppl.find(x => x.id === r.pid); return t + (p ? sums(p, m, parseDays(r)).hours : 0); }, 0);
      const on = ui.view === 'month' && ui.month === m;
      return `<button type="button" role="tab" aria-selected="${on}" class="am ${on ? 'on' : ''} ${recs.length ? 'has' : ''} ${m === U.today().slice(0, 7) ? 'now' : ''}" data-act="at-goto" data-m="${m}"><b>${i + 1}월</b><small>${recs.length ? `${recs.length}명 · ${hours}h` : '-'}</small></button>`;
    }).join('');
  }
  /** 연간 요약: 참여자 × 월 (실근무 일수 / 시간) */
  function yearTable() {
    const y = ui.month.slice(0, 4);
    const months = Array.from({ length: 12 }, (_, i) => `${y}-${U.pad(i + 1)}`);
    const ppl = people().filter(p => months.some(m => recOf(p.id, m)));
    if (!ppl.length) return `<div class="empty"><strong>${y}년 출석 기록이 없어요</strong>달을 골라 기록하거나 엑셀을 불러오세요.</div>`;
    const mts = Object.fromEntries(months.map(m => [m, meta(m)]));
    const colT = months.map(() => ({ h: 0, r: 0, n: 0 }));
    const rows = ppl.map((p, i) => {
      let th = 0, tr = 0;
      const tds = months.map((m, k) => { const r = recOf(p.id, m); if (!r) return '<td class="nil">-</td>'; const s = sums(p, m, parseDays(r), mts[m]); th += s.hours; tr += s.real; colT[k].h += s.hours; colT[k].r += s.real; colT[k].n++; return `<td class="num" title="${s.hours}시간 · 실적 ${s.cnt}일 · 근태 ${s.gt} · 휴무 ${s.off}"><b>${s.real}</b><small>${s.hours}h</small></td>`; }).join('');
      return `<tr><td class="num">${i + 1}</td><th class="nm">${e(p.name)}</th><td class="sub">${e([p.type, p.sub].filter(Boolean).join(' '))}</td>${tds}<td class="num tot"><b>${tr}</b><small>${th}h</small></td></tr>`;
    }).join('');
    return `<div class="at-wrap"><table class="at-tbl at-ytbl"><thead><tr><th>번호</th><th class="nm">성명</th><th>구분</th>${months.map((m, k) => `<th><button type="button" class="linklike" data-act="at-goto" data-m="${m}">${k + 1}월</button></th>`).join('')}<th>합계</th></tr></thead>
      <tbody>${rows}<tr class="tot"><th colspan="3">합계 · 인원</th>${colT.map(c => `<td class="num">${c.n ? `<b>${c.r}</b><small>${c.h}h · ${c.n}명</small>` : ''}</td>`).join('')}<td class="num"><b>${colT.reduce((a, c) => a + c.r, 0)}</b><small>${colT.reduce((a, c) => a + c.h, 0)}h</small></td></tr></tbody></table></div>
      <p class="sub" style="margin:8px 16px 0">칸의 굵은 숫자 = 실근무 일수, 작은 숫자 = 근무 시간. 달 이름을 누르면 그 달 출석부로 가요.</p>`;
  }
  function results() {
    if (ui.view === 'year') return `<section class="panel at">${ui.imp ? importPanel() : ''}${ui.pasteTbl ? pastePanel() : ''}${yearTable()}</section>`;
    const m = ui.month, mt = meta(m);
    const all = people();
    const list = gridList();
    const groups = [...new Set(all.filter(p => activeIn(p, m)).map(p => `${p.type}·${p.sub}`))];
    const days = Object.fromEntries(list.map(p => [p.id, daysOf(p.id, m)]));
    const n = dim(m);
    const hol = new Set(mt.holidays.map(Number));
    const dayCls = d => { const w = wd(m, d); return w === 6 ? 'sat' : w === 0 ? 'sun' : hol.has(d) ? 'hol' : ''; };
    const brushes = [['base', '기본 시간'], ['휴', '휴무'], ...Object.entries(ST).map(([k, v]) => [k, v.label]), ['clear', '지우기']];
    const tot = { hours: 0, cnt: 0, real: 0 };
    const sm = Object.fromEntries(list.map(p => { const s = sums(p, m, days[p.id], mt); tot.hours += s.hours; tot.cnt += s.cnt; tot.real += s.real; return [p.id, s]; }));
    const dl = daily(list, m, days);
    const weekSum = (p, d) => { let s = 0; for (let k = d - 5; k < d; k++) if (k >= 1) { const c = cell(days[p.id][k]); if (c.h != null) s += c.h; } return s; };
    const rows = [];
    let lastG = null;
    list.forEach((p, i) => {
      const g = `${p.type}·${p.sub}`;
      const span = g !== lastG ? list.filter(x => `${x.type}·${x.sub}` === g).length : 0;
      lastG = g;
      const s = sm[p.id];
      let tds = '';
      for (let d = 1; d <= n; d++) {
        const cls = dayCls(d);
        if (cls === 'sat') { tds += `<td class="wk num">${weekSum(p, d) || ''}</td>`; continue; }
        if (cls === 'sun') { tds += '<td class="sun"></td>'; continue; }
        const c = cell(days[p.id][d]);
        tds += `<td class="c ${cls} ${c.st ? 'st-' + c.st : ''} ${c.off ? 'off' : ''}" data-r="${i}" data-d="${d}">${c.off ? '휴무' : c.h != null ? c.h : ''}</td>`;
      }
      // 마지막 주 (토요일이 없이 끝나는 달)
      const lastW = wd(m, n);
      if (lastW > 0 && lastW < 6) tds += `<td class="wk num">${weekSum(p, n + 1) || ''}</td>`;
      rows.push(`<tr>${span ? `<th rowspan="${span}" class="grp"><span>${e(p.type || '')}</span><span>${e(p.sub || '')}</span></th>` : ''}
        <td class="no num">${i + 1}</td><th class="nm c" data-r="${i}" data-d="0" title="${e(p.name)} (두 번 누르거나 글자를 치면 이름 고치기)">${e(p.name) || '<span class="sub">(이름)</span>'}<span class="at-rbtns"><button type="button" class="at-rfill" data-act="at-fill-one" data-id="${p.id}" aria-label="${e(p.name)} 기본 시간 채우기" title="이 사람만 기본 시간으로 빈 칸 채우기">⤓</button><button type="button" class="at-rdel" data-act="at-pdel" data-id="${p.id}" aria-label="${e(p.name)} 삭제" title="이 참여자 삭제">×</button></span>${s.hours < mt.goal ? `<span class="at-short-dot" title="${mt.goal}시간 미만">▼</span>` : ''}</th>${tds}
        <td class="s hours num ${s.hours < mt.goal ? 'short' : ''}" title="${s.hours < mt.goal ? `${mt.goal}시간까지 ${mt.goal - s.hours}시간 부족` : ''}">${s.hours}시간</td><td class="s num">${s.cnt}일</td><td class="s num">${s.real}일</td>
        <td class="s st-공 num">${s.공}</td><td class="s st-특 num">${s.특}</td><td class="s st-병 num">${s.병}</td><td class="s st-결 num">${s.결}</td><td class="s num">${s.gt + s.off}</td>
        <td class="s num ${s.off > OFF_LIMIT ? 'over' : 'offuse'}">${s.off}/${OFF_LIMIT}</td></tr>`);
    });
    const tailCols = (lastW => (lastW > 0 && lastW < 6 ? 1 : 0))(wd(m, n));
    const foot = (label, key) => `<tr class="ft"><th colspan="3">${label}</th>${Array.from({ length: n }, (_, k) => { const d = k + 1, cls = dayCls(d); return cls === 'sat' || cls === 'sun' ? `<td class="${cls === 'sat' ? 'wk' : 'sun'}"></td>` : `<td class="num ${cls}">${hol.has(d) && key !== 'work' ? '' : dl[d][key] || ''}</td>`; }).join('')}${tailCols ? '<td class="wk"></td>' : ''}`;
    const realSum = Object.entries(dl).filter(([d]) => { const c = dayCls(+d); return !c || c === ''; }).reduce((a, [, v]) => a + v.real, 0);
    return `<section class="panel at">
      <div class="at-tools">
        <div class="at-brush" role="group" aria-label="고른 칸에 넣기"><span class="sub">고른 칸에</span>${brushes.map(([k, l]) => `<button type="button" class="br ${ST[k] ? 'st-' + k : ''} br-${k === '휴' ? 'off' : k}" data-act="at-apply" data-v="${k}" tabindex="-1">${l}</button>`).join('')}
          <button type="button" class="br" data-act="at-undo" tabindex="-1" title="Ctrl+Z">↶ 되돌리기</button></div>
        <div class="inline at-acts">
          <button class="btn btn-sm" type="button" data-act="at-fill" ${list.length ? '' : 'disabled'}>📅 기본 시간으로 이 달 채우기</button>
          <button class="btn btn-sm" type="button" data-act="at-xlsx" ${list.length ? '' : 'disabled'}>엑셀로 받기</button>
        </div>
      </div>
      <div class="at-meta">
        <label>공휴일 <input class="input sm" id="atHol" value="${e(mt.holidays.join(', '))}" style="width:110px" placeholder="예: 24, 25"> 일</label>
        <label>기준 일수 <input class="input sm" id="atBase" value="${mt.base}" style="width:48px" inputmode="numeric"> 일 <span class="sub">(평일 ${mt.weekdays}일)</span></label>
        <label>목표 훈련시간 <input class="input sm" id="atGoal" value="${mt.goal}" style="width:52px" inputmode="numeric"> 시간</label>
        <button class="btn btn-sm" type="button" data-act="at-meta">저장</button>
        ${groups.length > 1 ? `<span class="chips at-groups"><button type="button" class="chip ${!ui.group ? 'on' : ''}" data-act="at-group" data-g="">전체</button>${groups.map(g => `<button type="button" class="chip ${ui.group === g ? 'on' : ''}" data-act="at-group" data-g="${e(g)}">${e(g)}</button>`).join('')}</span>` : ''}
        <details class="at-keys"><summary>⌨️ 엑셀처럼 쓰기 (단축키)</summary><div class="sub">
          칸을 누르고 <kbd>←↑→↓</kbd>로 이동, 숫자를 치고 <kbd>Enter</kbd>(아래로)·<kbd>Tab</kbd>(오른쪽으로). <kbd>Shift</kbd>+방향키·끌기로 여러 칸 고르기.
          <b>휴</b>=휴무, <b>공</b>=공가, <b>특</b>=특휴, <b>병</b>=병가, <b>결</b>=결근 (예: <b>3병</b> = 3시간 병가). <kbd>Delete</kbd> 지우기, <kbd>F2</kbd>·두 번 누르기 = 고치기,
          <kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd> 복사·붙여넣기(엑셀에서 복사한 것도 됨), <kbd>Ctrl</kbd>+<kbd>D</kbd> 위 칸 아래로 채우기, <kbd>Ctrl</kbd>+<kbd>Z</kbd> 되돌리기.
          성명 칸에서 이름을 치면 이름이 바뀌고, 맨 아래 <b>+ 새 참여자</b> 줄에 이름을 치면 한 줄이 생겨요. 이름 여러 개를 붙여넣어도 돼요.</div></details>
      </div>
      ${ui.imp ? importPanel() : ''}${ui.pasteTbl ? pastePanel() : ''}
      ${shortBoard(m, mt)}
      ${`<div class="at-wrap" id="atWrap"><input class="at-ed" id="atEd" autocomplete="off" spellcheck="false" aria-label="출석부 칸 입력"><table class="at-tbl" id="atTbl"><thead>
        <tr><th rowspan="2" class="grp">구분</th><th rowspan="2" class="no">번호</th><th rowspan="2" class="nm">성명</th><th colspan="${n + tailCols}">${+m.slice(5, 7)}월</th><th colspan="9" class="s-head">${mt.base}일 기준</th></tr>
        <tr>${Array.from({ length: n }, (_, k) => { const d = k + 1, w = wd(m, d); return `<th class="d ${dayCls(d)}">${d}<small>${U.WD[w]}</small></th>`; }).join('')}${tailCols ? '<th class="d sat">계</th>' : ''}
          <th class="s hours">시간</th><th class="s">실적건수</th><th class="s">실근무 일수</th><th class="s st-공">공가</th><th class="s st-특">특휴</th><th class="s st-병">병가</th><th class="s st-결">결근</th><th class="s">근태</th><th class="s">휴무사용</th></tr></thead>
        <tbody>${rows.join('')}
          <tr class="newrow"><td class="grp"></td><td class="no">+</td><th class="nm c" data-r="${list.length}" data-d="0"><span class="sub">+ 새 참여자</span></th><td colspan="${n + tailCols + 9}" class="sub newrow-hint">이름을 치고 Enter · 이름 여러 개를 붙여넣으면 한꺼번에 추가돼요</td></tr>
          <tr class="tot"><th colspan="3">합계 (${list.length}명)</th><td colspan="${n + tailCols}"></td><td class="s num">${tot.hours}시간</td><td class="s num">${tot.cnt}일</td><td class="s num">${tot.real}일</td><td colspan="6"></td></tr>
          ${foot('근무 인원', 'work')}<td colspan="9"></td></tr>
          ${foot('병가·공가 사용 인원', 'use')}<td colspan="9"></td></tr>
          ${foot('실 근무 인원 (실인원)', 'real')}<td class="s num" colspan="3">${realSum}</td><td colspan="6"></td></tr>
          ${places(list).map(pl => `<tr class="ft pl"><th colspan="3">${e(pl)} 인원</th>${Array.from({ length: n }, (_, k) => { const d = k + 1, cls = dayCls(d); return cls === 'sat' || cls === 'sun' ? `<td class="${cls === 'sat' ? 'wk' : 'sun'}"></td>` : `<td class="num ${cls}">${dl[d].place[pl] || ''}</td>`; }).join('')}${tailCols ? '<td class="wk"></td>' : ''}<td colspan="9"></td></tr>`).join('')}
        </tbody></table></div>`}
      ${srcPanel()}
      ${peoplePanel(all)}
    </section>`;
  }

  /** 불러온 자료(엑셀·붙여넣기)별 묶음: 잘못 올렸으면 한꺼번에 지운다 */
  function srcList() {
    const map = new Map();
    S.get().attends.forEach(a => { if (!a.src) return; const g = map.get(a.src) || { src: a.src, recs: 0, months: new Set(), people: 0 }; g.recs++; g.months.add(a.month); map.set(a.src, g); });
    S.get().jobPeople.forEach(p => { if (p.src && map.has(p.src)) map.get(p.src).people++; });
    return [...map.values()].reverse();
  }
  function srcPanel() {
    const list = srcList();
    const m = ui.month;
    const monthRecs = S.get().attends.filter(a => a.month === m && a.pid !== '_').length;
    return `<details class="at-src" ${ui.showSrc ? 'open' : ''} id="atSrc"><summary><b>불러온 자료 · 지우기</b> <span class="sub">${list.length ? `${list.length}개` : '없음'}</span></summary>
      <div class="at-src-body">
        ${list.length ? `<ul class="at-src-list">${list.map(g => `<li><span><b>${e(g.src)}</b> <span class="sub">${[...g.months].sort().map(x => V.monthLabel(x)).join(', ')} · 기록 ${g.recs}건${g.people ? ` · 새로 만든 참여자 ${g.people}명` : ''}</span></span><button class="btn btn-sm btn-danger-ghost" type="button" data-act="at-src-del" data-src="${e(g.src)}">이 자료 지우기</button></li>`).join('')}</ul>` : '<p class="sub" style="margin:0">엑셀 파일이나 붙여넣기로 불러온 자료가 여기 나와요. 잘못 올렸으면 여기서 통째로 지울 수 있어요.</p>'}
        <div class="inline"><button class="btn btn-sm btn-danger-ghost" type="button" data-act="at-month-clear" ${monthRecs ? '' : 'disabled'}>${V.monthLabel(m)} 출석 기록 모두 지우기 (${monthRecs}명)</button><span class="sub">참여자 명단은 그대로 두고 이 달 칸만 비워요.</span></div>
      </div></details>`;
  }
  /** 불러온 자료 지우기: 그 자료로 들어온 기록 + 그 자료로 새로 만든 참여자(다른 기록이 없는 사람만) */
  function removeSrc(src) {
    const recIds = S.get().attends.filter(a => a.src === src).map(a => a.id);
    const pidsLeft = new Set(S.get().attends.filter(a => a.src !== src && a.pid !== '_').map(a => a.pid));
    const pplIds = S.get().jobPeople.filter(p => p.src === src && !pidsLeft.has(p.id)).map(p => p.id);
    const u1 = recIds.length ? S.removeMany('att', recIds) : null;
    const u2 = pplIds.length ? S.removeMany('jp', pplIds) : null;
    return { recs: recIds.length, people: pplIds.length, undo: () => { u1 && u1(); u2 && u2(); } };
  }
  function clearMonth(m = ui.month) {
    const ids = S.get().attends.filter(a => a.month === m && a.pid !== '_').map(a => a.id);
    return { n: ids.length, undo: ids.length ? S.removeMany('att', ids) : null };
  }
  /** 목표 훈련시간(기본 56시간) 미만인 사람을 모아 보는 판 */
  function shortBoard(m, mt) {
    const base = people().filter(p => activeIn(p, m) && (!ui.group || `${p.type}·${p.sub}` === ui.group));
    const short = base.map(p => ({ p, s: sums(p, m, daysOf(p.id, m), mt) })).filter(x => x.s.hours < mt.goal).sort((a, b) => a.s.hours - b.s.hours);
    if (!base.length) return '';
    const why = s => [s.off && `휴무 ${s.off}`, s.병 && `병가 ${s.병}`, s.특 && `특휴 ${s.특}`, s.공 && `공가 ${s.공}`, s.결 && `결근 ${s.결}`].filter(Boolean).join(' · ');
    return `<div class="at-short ${short.length ? '' : 'ok'}">
      <div class="at-short-head">
        <b>${short.length ? `⚠ ${mt.goal}시간 미만 <span class="num">${short.length}</span>명` : `✅ 모두 ${mt.goal}시간 이상`}</b>
        <span class="sub">${V.monthLabel(m)} · ${base.length}명 중</span>
        ${short.length || ui.shortOnly ? `<button type="button" class="chip ${ui.shortOnly ? 'on' : ''}" data-act="at-shortonly">${ui.shortOnly ? '전체 다시 보기' : '표에서 이 사람들만 보기'}</button>` : ''}
      </div>
      ${short.length ? `<div class="at-short-list">${short.map(({ p, s }) => `<button type="button" class="at-short-card" data-act="at-find" data-id="${p.id}" title="표에서 이 사람 줄로 가기"><b>${e(p.name)}</b><span class="num"><b>${s.hours}</b>/${mt.goal}시간</span><span class="gap num">−${mt.goal - s.hours}시간</span><small>${why(s) || '기록 부족'}</small></button>`).join('')}</div>` : ''}
    </div>`;
  }
  /** 표에서 그 사람 줄로 이동 */
  function findRow(pid) {
    let i = gridList().findIndex(p => p.id === pid);
    if (i < 0) { ui.shortOnly = false; ui.group = ''; return -1; }
    const m = ui.month; let d = 1; while (d <= dim(m) && !editable(m, d)) d++;
    select(i, d);
    return i;
  }
  const places = list => [...new Set(list.map(p => p.place).filter(Boolean))].sort();
  function pastePanel() {
    return `<div class="at-imp"><b>엑셀 표 붙여넣기</b> <span class="sub">엑셀에서 "구분 … 성명 … 1일 2일 …"부터 맨 아래 줄까지 드래그해 복사(Ctrl+C)한 뒤 아래에 붙여넣으세요(Ctrl+V).</span>
      <textarea class="textarea" id="atTblText" rows="6" placeholder="구분	성명	9월 …"></textarea>
      <p class="sub" style="margin:4px 0">붙여넣은 글에는 칸 색이 없어서, 오른쪽 요약 칸을 보고 <b>공휴일 = 공가</b>, <b>결근 수만큼 빈 평일 = 결근</b>으로 채워요. 병가·특휴는 날짜를 알 수 없어서 불러온 뒤 칠하기로 표시해 주세요. 색까지 가져오려면 <b>엑셀 파일 불러오기</b>가 정확해요.</p>
      <div class="inline"><button class="btn btn-sm btn-primary" type="button" data-act="at-pastetbl-read">표 읽기</button><button class="btn btn-sm" type="button" data-act="at-pastetbl">닫기</button></div></div>`;
  }
  function peoplePanel(all) {
    const inp = (p, k, w, ph = '', type = 'text') => `<input class="input sm" style="width:${w}px" data-chg="jp-field" data-id="${p.id}" data-field="${k}" value="${e(p[k] || '')}" placeholder="${ph}" ${type === 'date' ? 'type="date"' : ''}>`;
    const sel = (p, k, list) => `<select class="select sm" data-chg="jp-field" data-id="${p.id}" data-field="${k}">${list.map(v => `<option ${p[k] === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    return `<details class="at-people" ${ui.showPeople ? 'open' : ''} id="atPeople"><summary><b>참여자 상세 정보</b> <span class="sub">${all.length}명 · 구분·생년월일·참여기간·요일별 시간·근무처</span></summary>
      <div class="at-people-body">
        <div class="inline"><button class="btn btn-sm btn-primary" type="button" data-act="at-padd">+ 참여자 추가</button><button class="btn btn-sm" type="button" data-act="at-paste">이름 여러 명 붙여넣기</button></div>
        ${ui.paste ? `<div class="at-paste"><textarea class="textarea" id="atPasteText" rows="5" placeholder="한 줄에 한 명: 성명 [탭] 생년월일 [탭] 참여시작일 [탭] 참여종료일 (엑셀에서 그대로 복사해 붙여넣어도 돼요)"></textarea><div class="inline"><select class="select sm" id="atPasteType">${TYPES.map(t => `<option>${t}</option>`).join('')}</select><select class="select sm" id="atPasteSub">${SUBS.map(t => `<option>${t}</option>`).join('')}</select><button class="btn btn-sm btn-primary" type="button" data-act="at-paste-commit">추가</button></div></div>` : ''}
        ${all.length ? `<div class="table-wrap"><table class="tbl at-ptbl"><thead><tr><th>번호</th><th>구분</th><th>유형</th><th>성명</th><th>생년월일</th><th>참여시작일</th><th>참여종료일</th><th>요일별 시간 (월~금)</th><th>근무처</th><th></th></tr></thead><tbody>
          ${all.map(p => `<tr class="${activeIn(p, ui.month) ? '' : 'inactive'}"><td>${inp(p, 'no', 44)}</td><td>${sel(p, 'type', TYPES)}</td><td>${sel(p, 'sub', SUBS)}</td><td>${inp(p, 'name', 84)}</td><td>${inp(p, 'birth', 104, 'YYYY-MM-DD')}</td><td>${inp(p, 'start', 104, 'YYYY-MM-DD')}</td><td>${inp(p, 'end', 104, '중도포기일')}</td><td>${inp(p, 'pattern', 96, DEFAULT_PATTERN[p.sub] || '3,3,3,3,2')}</td><td>${inp(p, 'place', 110, '예: 다다샵')}</td>
            <td><button class="icon-btn" type="button" aria-label="참여자 삭제" data-act="at-pdel" data-id="${p.id}">${V.I.close}</button></td></tr>`).join('')}
        </tbody></table></div>` : ''}
        <p class="sub" style="margin:0">요일별 시간은 "기본 시간" 칠하기와 "이 달 채우기"에 쓰여요. 예: 월~목 3시간, 금 2시간 → 3,3,3,3,2</p>
      </div></details>`;
  }

  /* ---------- 엑셀처럼 칸 고르기·입력 ---------- */
  // sel: { r, d } 현재 칸, anc: 여러 칸을 고를 때 시작 칸. d=0 은 성명 칸
  const G = { sel: null, anc: null, editing: false, active: false, down: false, undo: [] };
  // 화면에 보이는 줄 목록 (구분 필터·목표시간 미만만 보기 반영). 칸 고르기와 표가 같은 목록을 쓴다
  const gridList = () => { const m = ui.month, mt = meta(m); return people().filter(p => activeIn(p, m) && (!ui.group || `${p.type}·${p.sub}` === ui.group) && (!ui.shortOnly || sums(p, m, daysOf(p.id, m), mt).hours < mt.goal)); };
  const editable = (m, d) => { const w = wd(m, d); return d >= 1 && d <= dim(m) && w > 0 && w < 6; };
  const tdAt = (r, d) => document.querySelector(`#atTbl [data-r="${r}"][data-d="${d}"]`);
  function range() {
    if (!G.sel) return [];
    const a = G.anc || G.sel, b = G.sel;
    const r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r), d0 = Math.min(a.d, b.d), d1 = Math.max(a.d, b.d);
    const out = [];
    for (let r = r0; r <= r1; r++) for (let d = d0; d <= d1; d++) out.push({ r, d });
    return out;
  }
  function paintSel() {
    document.querySelectorAll('#atTbl .sel, #atTbl .cur').forEach(x => x.classList.remove('sel', 'cur'));
    if (!G.sel) return;
    range().forEach(({ r, d }) => tdAt(r, d)?.classList.add('sel'));
    const td = tdAt(G.sel.r, G.sel.d);
    td?.classList.add('cur');
    placeEditor();
  }
  function placeEditor() {
    const ed = document.getElementById('atEd'), wrap = document.getElementById('atWrap'), td = G.sel && tdAt(G.sel.r, G.sel.d);
    if (!ed || !wrap || !td) { if (ed) ed.style.display = 'none'; return; }
    const tr = td.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    Object.assign(ed.style, { display: 'block', left: `${tr.left - wr.left + wrap.scrollLeft}px`, top: `${tr.top - wr.top + wrap.scrollTop}px`, width: `${G.editing ? Math.max(tr.width, G.sel.d === 0 ? 110 : 60) : tr.width}px`, height: `${tr.height}px` });
    ed.classList.toggle('editing', G.editing);
  }
  function focusEd() { const ed = document.getElementById('atEd'); if (ed && document.activeElement !== ed) ed.focus({ preventScroll: true }); }
  function select(r, d, extend) {
    const list = gridList(), m = ui.month;
    r = Math.max(0, Math.min(r, list.length)); // list.length = 새 참여자 줄
    if (r === list.length) d = 0;
    d = Math.max(0, Math.min(d, dim(m)));
    if (!extend) G.anc = null; else if (!G.anc) G.anc = G.sel;
    G.sel = { r, d };
    G.active = true;
    paintSel();
    const td = tdAt(r, d); td?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    placeEditor(); focusEd();
  }
  /** 방향으로 한 칸 이동 (토·일 칸은 건너뜀) */
  function move(dr, dd, extend) {
    if (!G.sel) return select(0, 1);
    const m = ui.month;
    let { r, d } = G.sel;
    r += dr;
    if (dd) { let k = d; do { k += dd; } while (k >= 1 && k <= dim(m) && !editable(m, k)); d = k < 0 ? 0 : k > dim(m) ? d : k; }
    select(r, d, extend);
  }
  /** 입력 글 → 칸 값. cur는 지금 칸, bh는 그 날 기본 시간 */
  function parseInput(txt, cur, bh) {
    const t = String(txt ?? '').replace(/\s+/g, '');
    if (!t) return '';
    if (/^(휴|휴무|ㅎ|h|H)$/.test(t)) return '휴';
    const num = t.match(/\d+(?:\.\d+)?/);
    const n = num ? +num[0] : null;
    const st = /결|ㄱㄱ|결근/.test(t) ? '결' : /병/.test(t) ? '병' : /특/.test(t) ? '특' : /공/.test(t) ? '공' : '';
    if (st === '결') return `${n ?? ''}|결`;
    if (st) return `${n ?? cur.h ?? bh}|${st}`;
    if (n == null) return null; // 알 수 없는 글자
    return cur.st && cur.st !== '결' ? `${n}|${cur.st}` : String(n);
  }
  const showVal = v => { const c = cell(v); return c.off ? '휴무' : c.st ? `${c.h ?? ''}${ST[c.st].label}` : c.h != null ? String(c.h) : ''; };
  /** 여러 칸 한꺼번에 저장 (되돌리기 기록 남김). changes = [{ r, d, v }] */
  function write(changes) {
    const list = gridList(), m = ui.month;
    const by = {};
    changes.forEach(({ r, d, v }) => {
      const p = list[r]; if (!p || !editable(m, d) || v == null) return;
      const days = by[p.id] ||= daysOf(p.id, m);
      if (v) days[d] = v; else delete days[d];
    });
    const ids = Object.keys(by); if (!ids.length) return;
    G.undo.push({ m, before: ids.map(pid => { const r = recOf(pid, m); return { pid, id: r && r.id, days: r ? r.days : null }; }) });
    if (G.undo.length > 50) G.undo.shift();
    S.putMany('att', ids.map(pid => { const r = recOf(pid, m); return { ...(r ? { id: r.id } : {}), pid, month: m, days: JSON.stringify(by[pid]) }; }));
  }
  function undo() {
    const u = G.undo.pop();
    if (!u) return toastMsg('되돌릴 것이 없어요.');
    const keep = u.before.filter(b => b.id);
    S.putMany('att', keep.map(b => ({ id: b.id, pid: b.pid, month: u.m, days: b.days || '{}' })));
    const fresh = u.before.filter(b => !b.id).map(b => recOf(b.pid, u.m)).filter(Boolean).map(r => r.id);
    if (fresh.length) S.removeMany('att', fresh);
  }
  let toastMsg = () => {};
  /** 고른 칸 모두에 같은 값 (도구 버튼·Enter로 여러 칸) */
  function applyAll(kind, txt) {
    const list = gridList(), m = ui.month;
    const cells = range().filter(({ r, d }) => list[r] && editable(m, d));
    if (!cells.length) return;
    const cur = ({ r, d }) => cell(daysOf(list[r].id, m)[d]);
    const allHave = ST[kind] ? cells.every(x => cur(x).st === kind) : kind === '휴' ? cells.every(x => cur(x).off) : false;
    write(cells.map(x => {
      const c = cur(x), bh = baseHours(list[x.r], m, x.d);
      let v;
      if (kind === 'clear') v = '';
      else if (kind === 'base') v = String(bh);
      else if (kind === '휴') v = allHave ? String(bh) : '휴';
      else if (ST[kind]) v = allHave ? (kind === '결' ? String(bh) : String(c.h ?? bh)) : kind === '결' ? '|결' : `${c.h ?? bh}|${kind}`;
      else v = parseInput(txt, c, bh);
      return { ...x, v };
    }));
  }
  /** 성명 칸 입력: 이름 바꾸기 또는 새 참여자 */
  function writeName(r, name) {
    name = String(name || '').trim();
    const list = gridList();
    if (r < list.length) { if (name && name !== list[r].name) S.upsert('jp', { id: list[r].id, name }); return; }
    if (!name) return;
    addPeople([name]);
  }
  function addPeople(names) {
    const list = gridList(), m = ui.month;
    const last = list[list.length - 1];
    const type = last ? last.type : '복지형', sub = last ? last.sub : '참여형';
    let no = S.get().jobPeople.reduce((a, p) => Math.max(a, Number(p.no) || 0), 0);
    const ppl = names.map(n => String(n).trim()).filter(Boolean).map(name => ({ id: U.uid('J'), no: String(++no), name, type, sub, start: `${m}-01`, end: '', pattern: (last && last.pattern) || DEFAULT_PATTERN[sub], staff: S.me() }));
    if (!ppl.length) return [];
    S.putMany('jp', ppl);
    // 이 달 출석부에 바로 보이게 빈 기록을 만든다
    S.putMany('att', ppl.map(p => ({ pid: p.id, month: m, days: '{}' })));
    return ppl;
  }
  function commitEdit(dr, dd) {
    const ed = document.getElementById('atEd');
    if (!ed || !G.sel) return;
    const txt = ed.value; ed.value = ''; const was = G.editing; G.editing = false;
    if (was) {
      if (G.sel.d === 0) writeName(G.sel.r, txt);
      else {
        const list = gridList(), p = list[G.sel.r];
        if (p) {
          const cur = cell(daysOf(p.id, ui.month)[G.sel.d]);
          const v = parseInput(txt, cur, baseHours(p, ui.month, G.sel.d));
          if (v == null) toastMsg(`"${txt}"은(는) 넣을 수 없어요. 숫자나 휴·공·특·병·결을 쳐 주세요.`);
          else if (range().length > 1) applyAll('text', txt); else write([{ r: G.sel.r, d: G.sel.d, v }]);
        }
      }
    }
    if (dr || dd) move(dr, dd); else placeEditor();
  }
  function copySel() {
    const list = gridList(), m = ui.month;
    const rs = range(); if (!rs.length) return '';
    const r0 = Math.min(...rs.map(x => x.r)), r1 = Math.max(...rs.map(x => x.r)), d0 = Math.min(...rs.map(x => x.d)), d1 = Math.max(...rs.map(x => x.d));
    const lines = [];
    for (let r = r0; r <= r1; r++) { const p = list[r]; if (!p) continue; const days = daysOf(p.id, m); const row = []; for (let d = d0; d <= d1; d++) row.push(d === 0 ? p.name : editable(m, d) ? showVal(days[d]) : ''); lines.push(row.join('\t')); }
    return lines.join('\n');
  }
  /** 붙여넣기: 엑셀에서 복사한 표도 그대로. 성명 칸에서 시작하면 첫 열은 이름(모자라면 새 참여자) */
  function pasteText(text) {
    if (!G.sel) return;
    const rows = String(text).replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
    const m = ui.month;
    let list = gridList();
    const { r: r0, d: d0 } = G.sel;
    if (d0 === 0) {
      const names = rows.map(c => (c[0] || '').trim());
      names.slice(0, Math.max(0, list.length - r0)).forEach((n, i) => { if (n && n !== list[r0 + i].name) S.upsert('jp', { id: list[r0 + i].id, name: n }); });
      const extra = names.slice(Math.max(0, list.length - r0)).filter(Boolean);
      if (extra.length) addPeople(extra);
      list = gridList();
    }
    const changes = [];
    rows.forEach((cols, i) => {
      const p = list[r0 + i]; if (!p) return;
      const days = daysOf(p.id, m);
      cols.forEach((txt, j) => {
        const d = d0 === 0 ? j : d0 + j;
        if (d0 === 0 && j === 0) return;
        if (!editable(m, d)) return;
        const v = parseInput(txt, cell(days[d]), baseHours(p, m, d));
        if (v != null) changes.push({ r: r0 + i, d, v });
      });
    });
    write(changes);
  }
  function fillDown() {
    const rs = range(); if (!rs.length) return;
    const list = gridList(), m = ui.month;
    const r0 = Math.min(...rs.map(x => x.r));
    const src = daysOf(list[r0]?.id, m);
    write(rs.filter(x => x.r > r0 && x.d > 0).map(x => ({ ...x, v: src[x.d] || '' })));
  }
  function onKey(ev) {
    const ed = ev.target;
    if (ev.isComposing || ev.keyCode === 229) {
      if (ev.key === 'Enter') setTimeout(() => commitEdit(ev.shiftKey ? -1 : 1, 0), 0);
      return;
    }
    const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && (k === 'z' || k === 'Z')) { ev.preventDefault(); undo(); return; }
    if (ctrl && (k === 'd' || k === 'D')) { ev.preventDefault(); fillDown(); return; }
    if (ctrl && (k === 'c' || k === 'C') && !G.editing) { ev.preventDefault(); const t = copySel(); navigator.clipboard?.writeText(t).catch(() => {}); ed.value = t; ed.select(); setTimeout(() => { ed.value = ''; }, 0); return; }
    if (ctrl) return; // Ctrl+V는 paste 이벤트에서
    if (k === 'Enter') { ev.preventDefault(); if (G.editing) commitEdit(ev.shiftKey ? -1 : 1, 0); else move(ev.shiftKey ? -1 : 1, 0); return; }
    if (k === 'Tab') { ev.preventDefault(); if (G.editing) commitEdit(0, ev.shiftKey ? -1 : 1); else move(0, ev.shiftKey ? -1 : 1); return; }
    if (k === 'Escape') { ed.value = ''; G.editing = false; placeEditor(); return; }
    if (k === 'F2') { ev.preventDefault(); startEdit(true); return; }
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) {
      if (G.editing && (k === 'ArrowLeft' || k === 'ArrowRight') && ed.dataset.f2) return; // F2로 고칠 때는 글자 안에서 이동
      ev.preventDefault();
      if (G.editing) commitEdit(...arrows[k]); else move(...arrows[k], ev.shiftKey);
      return;
    }
    if (k === 'Home' || k === 'End') { ev.preventDefault(); if (!G.sel) return; let d = k === 'Home' ? 1 : dim(ui.month); const m = ui.month; while (!editable(m, d) && d > 0 && d <= dim(m)) d += k === 'Home' ? 1 : -1; select(G.sel.r, d, ev.shiftKey); return; }
    if ((k === 'Delete' || k === 'Backspace') && !G.editing) { ev.preventDefault(); if (G.sel.d === 0) return; applyAll('clear'); return; }
  }
  function startEdit(withValue) {
    const ed = document.getElementById('atEd'); if (!ed || !G.sel) return;
    const list = gridList(), p = list[G.sel.r];
    G.editing = true;
    ed.dataset.f2 = withValue ? '1' : '';
    if (withValue) { ed.value = G.sel.d === 0 ? (p ? p.name : '') : p ? showVal(daysOf(p.id, ui.month)[G.sel.d]) : ''; ed.select(); }
    placeEditor();
  }
  function bindGrid(toast) {
    if (toast) toastMsg = toast;
    const tbl = document.getElementById('atTbl'), ed = document.getElementById('atEd');
    if (!tbl || !ed) return;
    tbl.addEventListener('pointerdown', ev => {
      if (ev.button !== 0 || ev.target.closest('button')) return;
      const td = ev.target.closest('[data-r][data-d]'); if (!td) return;
      ev.preventDefault();
      if (G.editing) commitEdit(0, 0);
      G.down = true;
      select(+td.dataset.r, +td.dataset.d, ev.shiftKey);
    });
    // 누른 채로 끌 때만 여러 칸 (버튼을 떼면 끝)
    tbl.addEventListener('pointerover', ev => { if (!G.down || !(ev.buttons & 1)) { G.down = false; return; } const td = ev.target.closest('[data-r][data-d]'); if (td && (+td.dataset.r !== G.sel.r || +td.dataset.d !== G.sel.d)) { if (!G.anc) G.anc = G.sel; G.sel = { r: +td.dataset.r, d: +td.dataset.d }; paintSel(); } });
    tbl.addEventListener('dblclick', ev => { const td = ev.target.closest('[data-r][data-d]'); if (td) startEdit(true); });
    ed.addEventListener('keydown', onKey);
    ed.addEventListener('input', () => { if (!G.editing && ed.value) { G.editing = true; ed.dataset.f2 = ''; placeEditor(); } });
    ed.addEventListener('paste', ev => { if (G.editing) return; ev.preventDefault(); pasteText(ev.clipboardData.getData('text/plain')); });
    ed.addEventListener('blur', () => { setTimeout(() => { if (document.activeElement !== ed && G.editing) commitEdit(0, 0); }, 0); });
    document.getElementById('atWrap').addEventListener('scroll', placeEditor);
    // 다시 그린 뒤에도 고른 칸·커서를 그대로
    if (G.sel) { paintSel(); if (G.active) focusEd(); }
  }
  const releaseGrid = () => { G.active = false; };
  window.addEventListener('pointerup', () => { if (G.down) { G.down = false; focusEd(); } });
  window.addEventListener('pointercancel', () => { G.down = false; });
  window.addEventListener('pointerdown', ev => { if (!ev.target.closest('#atWrap, .at-brush')) G.active = false; }, true);

  /** 기본 시간으로 빈 칸 채우기 (참여 기간 안의 평일만, 공휴일은 공가) */
  function fillMonth(pids) {
    const m = ui.month, mt = meta(m), hol = new Set(mt.holidays.map(Number));
    const recs = [];
    let n = 0;
    (pids ? people().filter(p => pids.includes(p.id)) : gridList()).forEach(p => {
      const days = daysOf(p.id, m);
      const s = normDate(p.start), en = normDate(p.end);
      let changed = false;
      for (let d = 1; d <= dim(m); d++) {
        const w = wd(m, d); if (w === 0 || w === 6) continue;
        const ds = dstr(m, d);
        if ((s && /^\d{4}-/.test(s) && ds < s) || (en && /^\d{4}-/.test(en) && ds > en)) continue;
        if (days[d]) continue;
        const bh = baseHours(p, m, d);
        days[d] = hol.has(d) ? `${bh}|공` : String(bh);
        changed = true; n++;
      }
      if (changed) { const r = recOf(p.id, m); recs.push({ ...(r ? { id: r.id } : {}), pid: p.id, month: m, days: JSON.stringify(days) }); }
    });
    if (recs.length) S.putMany('att', recs);
    return n;
  }
  function saveMeta(holText, base, goal) {
    const m = ui.month;
    const holidays = String(holText || '').split(/[,\s]+/).map(Number).filter(d => d >= 1 && d <= dim(m));
    const r = recOf('_', m);
    S.putMany('att', [{ ...(r ? { id: r.id } : {}), pid: '_', month: m, days: JSON.stringify({ holidays, base: Number(base) || meta(m).weekdays, goal: Number(goal) || GOAL_HOURS }) }]);
  }

  /* ---------- 참여자 ---------- */
  function addPerson() {
    const m = ui.month;
    const no = S.get().jobPeople.reduce((a, p) => Math.max(a, Number(p.no) || 0), 0) + 1;
    ui.showPeople = true;
    return S.upsert('jp', { no: String(no), name: '', type: '복지형', sub: '참여형', start: `${m}-01`, end: '', pattern: DEFAULT_PATTERN.참여형, staff: S.me() });
  }
  function pasteCommit(text, type, sub) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.split('\t').map(x => x.trim())).filter(l => l[0]);
    let no = S.get().jobPeople.reduce((a, p) => Math.max(a, Number(p.no) || 0), 0);
    const have = new Set(S.get().jobPeople.map(p => p.name + '|' + normDate(p.birth)));
    const fresh = lines.filter(([name, birth]) => !have.has(name + '|' + normDate(birth))).map(([name, birth, start, end]) => ({ no: String(++no), name, type, sub, birth: normDate(birth), start: normDate(start) || `${ui.month}-01`, end: normDate(end), pattern: DEFAULT_PATTERN[sub], staff: S.me() }));
    if (fresh.length) S.upsertMany('jp', fresh);
    return { added: fresh.length, skipped: lines.length - fresh.length };
  }
  function removePerson(id) {
    const undo1 = S.remove('jp', id);
    const recs = S.get().attends.filter(a => a.pid === id).map(a => a.id);
    const undo2 = recs.length ? S.removeMany('att', recs) : null;
    return undo1 ? () => { undo1(); undo2 && undo2(); } : null;
  }

  /* ---------- 엑셀 출석부 불러오기 ---------- */
  const FILL = { '92D050': '공', '00B0F0': '특', '36A0F8': '특', B850D8: '병', BC8FDD: '병', '7030A0': '병', '000000': '결' };
  /** 표(엑셀 시트 또는 붙여넣은 글)에서 출석부를 찾는다.
   *  G = { r0, r1, c0, c1, txt(r,c), fill(r,c), top(r,c) } — top은 합쳐진 칸(구분)의 값 */
  function parseGrid(G, year, sheet, hol) {
    const found = [];
    for (let r = G.r0; r <= G.r1; r++) {
      let nameCol = -1;
      for (let c = G.c0; c <= Math.min(G.c1, 15); c++) if (G.txt(r, c).replace(/\s/g, '') === '성명') { nameCol = c; break; }
      if (nameCol < 0) continue;
      // 머리줄: 이 줄 또는 다음 줄에 "1일".."31일", 이 줄에 "9월". 요약 칸(결근·병가 등)도 찾아 둔다
      const head = {}; let month = 0;
      for (const rr of [r, r + 1]) for (let c = nameCol; c <= G.c1; c++) {
        const t = G.txt(rr, c).replace(/\s/g, '');
        if (rr === r && /^\d{1,2}월$/.test(t)) month = +t.replace('월', '');
        if (/생년/.test(t)) head.birth = c; if (/시작/.test(t)) head.start = c; if (/종료|포기/.test(t)) head.end = c;
        if (ST_BY_LABEL[t]) head[ST_BY_LABEL[t]] = c;
      }
      const dayCol = {};
      for (const rr of [r, r + 1]) for (let c = nameCol; c <= G.c1; c++) { const k = G.txt(rr, c).replace(/\s/g, '').match(/^(\d{1,2})일$/); if (k) dayCol[+k[1]] = c; }
      if (!month || !Object.keys(dayCol).length) continue;
      const m = `${year}-${U.pad(month)}`;
      const holSet = new Set((hol ? hol(m) : HOLIDAYS[m] || []).map(Number));
      const rows = [];
      let colorless = 0, guessed = 0;
      for (let rr = r + 2; rr <= G.r1; rr++) {
        const nm = G.txt(rr, nameCol);
        if (!nm) { if (/인원|합계/.test(G.txt(rr, G.c0) + G.txt(rr, nameCol - 3) + G.txt(rr, nameCol - 1))) break; continue; }
        if (nm.replace(/\s/g, '') === '성명' || /인원/.test(nm)) break;
        const days = {};
        let anyColor = false;
        Object.entries(dayCol).forEach(([d, c]) => {
          const w = new Date(year, month - 1, +d).getDay(); if (w === 0 || w === 6) return;
          const v = G.txt(rr, c);
          const st = FILL[G.fill(rr, c)] || '';
          if (st) anyColor = true;
          if (/휴/.test(v)) days[d] = '휴';
          else if (st === '결') days[d] = `${v && !isNaN(+v) ? +v : ''}|결`;
          else if (v !== '' && !isNaN(+v)) days[d] = st ? `${+v}|${st}` : String(+v);
          else if (st) days[d] = `|${st}`;
        });
        // 색이 없는 표(붙여넣기): 오른쪽 요약 칸 숫자로 채울 수 있는 것은 채운다
        //  - 공휴일에 시간이 적힌 날 = 공가, - 결근 수만큼의 빈 평일 = 결근
        if (!anyColor) {
          const want = k => (head[k] != null ? Number(String(G.txt(rr, head[k])).replace(/[^0-9]/g, '')) || 0 : 0);
          holSet.forEach(d => { const c = cell(days[d]); if (c.h != null && !c.st && want('공') > 0) days[d] = `${c.h}|공`; });
          const blanks = Object.keys(dayCol).map(Number).filter(d => { const w = new Date(year, month - 1, d).getDay(); return w > 0 && w < 6 && !days[d]; });
          if (want('결') && blanks.length === want('결')) blanks.forEach(d => { days[d] = '|결'; });
          const got = k => Object.values(days).filter(v => cell(v).st === k).length;
          if (want('병') > got('병') || want('특') > got('특')) colorless++;
          if (want('결') || want('공')) guessed++;
        }
        // 요일별 기본 시간: 요일마다 가장 많이 나온 시간
        const pat = [1, 2, 3, 4, 5].map(w => { const cnt = {}; Object.entries(days).forEach(([d, v]) => { const c = cell(v); if (c.h != null && new Date(year, month - 1, +d).getDay() === w) cnt[c.h] = (cnt[c.h] || 0) + 1; }); const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]; return best ? best[0] : ''; });
        rows.push({ name: nm, type: G.top(rr, nameCol - 3), sub: G.top(rr, nameCol - 2), birth: head.birth != null ? normDate(G.txt(rr, head.birth)) : '', start: head.start != null ? normDate(G.txt(rr, head.start)) : '', end: head.end != null ? normDate(G.txt(rr, head.end)) : '', days, pattern: pat.every(Boolean) ? pat.join(',') : '' });
      }
      if (rows.length) {
        const t = rows[0].type || '', s0 = rows[0].sub || '';
        found.push({ sheet, month: m, label: `${[t, s0].filter(Boolean).join(' ') || '구분 없음'} ${rows.length}명`, rows, on: true, colorless });
      }
      r += 2;
    }
    return found;
  }
  const ST_BY_LABEL = { 공가: '공', 특휴: '특', 병가: '병', 결근: '결' };
  /** 지금 쓰는 엑셀 양식(구분·성명·생년월일·참여시작일·참여종료일·1일~31일)을 읽는다 */
  function parseWorkbook(wb, fileName) {
    const found = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws['!ref']) continue;
      const rg = XLSX.utils.decode_range(ws['!ref']);
      const at = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
      const txt = (r, c) => { const x = at(r, c); return x && x.v != null ? String(x.w ?? x.v).trim() : ''; };
      const top = (r, c) => { const mg = (ws['!merges'] || []).find(g => r >= g.s.r && r <= g.e.r && c >= g.s.c && c <= g.e.c); return mg ? txt(mg.s.r, mg.s.c) : txt(r, c); };
      const fill = (r, c) => { const x = at(r, c); return x && x.s && x.s.fgColor && x.s.fgColor.rgb ? String(x.s.fgColor.rgb).toUpperCase().slice(-6) : ''; };
      let year = 0;
      for (let r = rg.s.r; r <= Math.min(rg.e.r, 3) && !year; r++) for (let c = rg.s.c; c <= Math.min(rg.e.c, 20); c++) { const k = txt(r, c).match(/(20\d{2})\s*년/); if (k) { year = +k[1]; break; } }
      if (!year) { const k = String(fileName || '').match(/(20\d{2})/); year = k ? +k[1] : +ui.month.slice(0, 4); }
      found.push(...parseGrid({ r0: rg.s.r, r1: rg.e.r, c0: rg.s.c, c1: rg.e.c, txt, fill, top }, year, name, m => meta(m).holidays));
    }
    return found;
  }
  /** 엑셀에서 복사해 붙여넣은 글(탭으로 나뉜 표). 색은 없으므로 요약 칸으로 공가·결근을 채운다 */
  function parsePaste(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.split('\t'));
    const c1 = Math.max(0, ...lines.map(l => l.length - 1));
    const txt = (r, c) => String((lines[r] || [])[c] ?? '').trim();
    // 합쳐진 칸(구분)은 위쪽의 마지막 값
    const top = (r, c) => { for (let k = r; k >= 0; k--) { const v = txt(k, c); if (v) return /구분|성명/.test(v) ? '' : v; } return ''; };
    return parseGrid({ r0: 0, r1: lines.length - 1, c0: 0, c1, txt, fill: () => '', top }, +ui.month.slice(0, 4), '붙여넣기', m => meta(m).holidays);
  }
  function importPanel() {
    const g = ui.imp;
    return `<div class="at-imp"><b>엑셀에서 찾은 명단</b> <span class="sub">${e(g.file)}</span>
      <div class="at-imp-list">${g.found.map((x, i) => `<label class="check"><input type="checkbox" data-act="at-imp-toggle" data-i="${i}" ${x.on ? 'checked' : ''}>${e(V.monthLabel(x.month))} · ${e(x.label)}${x.colorless ? ` <span class="tv-over">· 병가·특휴 날짜 확인 필요 ${x.colorless}명</span>` : ''}</label>`).join('')}</div>
      <p class="sub" style="margin:4px 0">같은 이름·생년월일인 참여자는 새로 만들지 않고 그 달 기록만 덮어써요. 칸 색(공가 초록·특휴 파랑·병가 보라·결근 검정)도 읽어요.</p>
      <div class="inline"><button class="btn btn-sm btn-primary" type="button" data-act="at-imp-commit">불러오기</button><button class="btn btn-sm" type="button" data-act="at-imp-cancel">취소</button></div></div>`;
  }
  function commitImport() {
    const picked = ui.imp.found.filter(x => x.on);
    const now = new Date();
    const src = `${ui.imp.file} · ${U.today().slice(5).replace('-', '/')} ${U.pad(now.getHours())}:${U.pad(now.getMinutes())}`;
    const byKey = new Map(S.get().jobPeople.map(p => [p.name + '|' + normDate(p.birth), p]));
    let no = S.get().jobPeople.reduce((a, p) => Math.max(a, Number(p.no) || 0), 0);
    const newPeople = [], recs = [];
    let months = new Set();
    picked.forEach(g => g.rows.forEach(r => {
      const key = r.name + '|' + r.birth;
      let p = byKey.get(key) || [...byKey.values()].find(x => x.name === r.name && !r.birth);
      const type = TYPES.find(t => (r.type || '').includes(t.slice(0, 2))) || '복지형';
      const sub = SUBS.find(t => (r.sub || '').includes(t.slice(0, 2))) || '참여형';
      if (!p) { p = { id: U.uid('J'), no: String(++no), name: r.name, type, sub, birth: r.birth, start: r.start, end: r.end, pattern: r.pattern || DEFAULT_PATTERN[sub], staff: S.me(), src }; newPeople.push(p); byKey.set(key, p); }
      const old = recOf(p.id, g.month);
      recs.push({ ...(old ? { id: old.id } : {}), pid: p.id, month: g.month, days: JSON.stringify(r.days), src });
      months.add(g.month);
    }));
    if (newPeople.length) S.putMany('jp', newPeople);
    if (recs.length) S.putMany('att', recs);
    ui.imp = null;
    if (months.size) ui.month = [...months].sort().pop();
    return { people: newPeople.length, recs: recs.length };
  }

  /* ---------- 인쇄 · 엑셀 ---------- */
  function doc(scale = 1) {
    const m = ui.month, mt = meta(m), n = dim(m);
    const list = people().filter(p => activeIn(p, m) && (!ui.group || `${p.type}·${p.sub}` === ui.group));
    const hol = new Set(mt.holidays.map(Number));
    const all = Object.fromEntries(list.map(p => [p.id, daysOf(p.id, m)]));
    const dl = daily(list, m, all);
    const rowMm = +(Math.min(5.2, 165 / Math.max(20, list.length + 4)) * scale).toFixed(2);
    const fs = +(Math.min(7.5, rowMm * 1.55) ).toFixed(2);
    const cls = d => { const w = wd(m, d); return w === 6 ? 'sat' : w === 0 ? 'sun' : hol.has(d) ? 'hol' : ''; };
    const weekSum = (pid, d) => { let s = 0; for (let k = d - 5; k < d; k++) if (k >= 1) { const c = cell(all[pid][k]); if (c.h != null) s += c.h; } return s; };
    const tail = wd(m, n) > 0 && wd(m, n) < 6;
    const tot = { hours: 0, cnt: 0, real: 0 };
    let lastG = null;
    const body = list.map((p, i) => {
      const s = sums(p, m, all[p.id], mt); tot.hours += s.hours; tot.cnt += s.cnt; tot.real += s.real;
      const g = `${p.type}·${p.sub}`; const span = g !== lastG ? list.filter(x => `${x.type}·${x.sub}` === g).length : 0; lastG = g;
      let tds = '';
      for (let d = 1; d <= n; d++) {
        const c0 = cls(d);
        if (c0 === 'sat') { tds += `<td class="wk">${weekSum(p.id, d) || ''}</td>`; continue; }
        if (c0 === 'sun') { tds += '<td class="sun"></td>'; continue; }
        const c = cell(all[p.id][d]);
        tds += `<td class="${c.st ? 'st-' + c.st : ''} ${c.off ? 'off' : ''}">${c.off ? '휴무' : c.h != null ? c.h : ''}</td>`;
      }
      if (tail) tds += `<td class="wk">${weekSum(p.id, n + 1) || ''}</td>`;
      return `<tr style="height:${rowMm}mm">${span ? `<td rowspan="${span}" class="grp">${e(p.type)}<br>${e(p.sub)}</td>` : ''}<td>${i + 1}</td><td class="nm">${e(p.name)}</td>${tds}<td>${s.hours}</td><td>${s.cnt}</td><td>${s.real}</td><td class="st-공">${s.공}</td><td class="st-특">${s.특}</td><td class="st-병">${s.병}</td><td class="st-결">${s.결}</td><td>${s.gt + s.off}</td><td>${s.off}/${OFF_LIMIT}</td></tr>`;
    }).join('');
    const foot = (label, key) => `<tr style="height:${rowMm}mm" class="ft"><td colspan="3">${label}</td>${Array.from({ length: n }, (_, k) => { const d = k + 1, c0 = cls(d); return c0 === 'sat' ? '<td class="wk"></td>' : c0 === 'sun' ? '<td class="sun"></td>' : `<td>${hol.has(d) && key !== 'work' ? '' : dl[d][key] || ''}</td>`; }).join('')}${tail ? '<td class="wk"></td>' : ''}`;
    const sign = '<table class="sign"><tr><th rowspan="2" class="sign-side">결<br>재</th><th>담 당</th><th>팀 장</th></tr><tr><td></td><td></td></tr></table>';
    return `<article class="doc at-doc" style="font-size:${fs}pt">
      <div class="at-doc-head"><h1>${m.slice(0, 4)}년 장애인일자리사업 참여자 근태 현황 <span>(${+m.slice(5, 7)}월)</span></h1>${sign}</div>
      <table class="at-dtbl"><colgroup><col style="width:3.2%"><col style="width:2.2%"><col style="width:4.6%">${Array.from({ length: n + (tail ? 1 : 0) }, () => '<col>').join('')}<col style="width:3.6%"><col style="width:3%"><col style="width:3%"><col style="width:2.2%"><col style="width:2.2%"><col style="width:2.2%"><col style="width:2.2%"><col style="width:2.2%"><col style="width:2.8%"></colgroup>
        <thead><tr><th rowspan="2">구분</th><th rowspan="2">번호</th><th rowspan="2">성명</th><th colspan="${n + (tail ? 1 : 0)}">${+m.slice(5, 7)}월</th><th colspan="9">기준 ${mt.base}일</th></tr>
          <tr>${Array.from({ length: n }, (_, k) => `<th class="${cls(k + 1)}">${k + 1}</th>`).join('')}${tail ? '<th class="wk">계</th>' : ''}<th>시간</th><th>실적<br>건수</th><th>실근무<br>일수</th><th class="st-공">공가</th><th class="st-특">특휴</th><th class="st-병">병가</th><th class="st-결">결근</th><th>근태</th><th>휴무<br>사용</th></tr></thead>
        <tbody>${body}
          <tr style="height:${rowMm}mm" class="ft"><td colspan="3">합계 (${list.length}명)</td><td colspan="${n + (tail ? 1 : 0)}"></td><td>${tot.hours}</td><td>${tot.cnt}</td><td>${tot.real}</td><td colspan="6"></td></tr>
          ${foot('근무 인원', 'work')}<td colspan="9"></td></tr>${foot('병가·공가 사용 인원', 'use')}<td colspan="9"></td></tr>${foot('실 근무 인원', 'real')}<td colspan="9"></td></tr>
          ${places(list).map(pl => `<tr style="height:${rowMm}mm" class="ft"><td colspan="3">${e(pl)} 인원</td>${Array.from({ length: n }, (_, k) => { const d = k + 1, c0 = cls(d); return c0 === 'sat' ? '<td class="wk"></td>' : c0 === 'sun' ? '<td class="sun"></td>' : `<td>${dl[d].place[pl] || ''}</td>`; }).join('')}${tail ? '<td class="wk"></td>' : ''}<td colspan="9"></td></tr>`).join('')}
        </tbody></table>
      <p class="at-doc-legend"><span class="st-공">공가</span><span class="st-특">특휴</span><span class="st-병">병가</span><span class="st-결">결근</span> 토요일 칸은 주간 시간 합계</p>
    </article>`;
  }
  function xlsx() {
    const m = ui.month, mt = meta(m), n = dim(m);
    const list = people().filter(p => activeIn(p, m));
    const head = ['구분', '유형', '번호', '성명', '생년월일', '참여시작일', '참여종료일', ...Array.from({ length: n }, (_, k) => `${k + 1}일(${U.WD[wd(m, k + 1)]})`), '시간', '실적건수', '실근무 일수', '공가', '특휴', '병가', '결근', '근태', '휴무사용'];
    const rows = list.map((p, i) => {
      const days = daysOf(p.id, m), s = sums(p, m, days, mt);
      return [p.type, p.sub, i + 1, p.name, p.birth, p.start, p.end, ...Array.from({ length: n }, (_, k) => { const c = cell(days[k + 1]); return c.off ? '휴무' : c.st ? `${c.h ?? ''}(${ST[c.st].label})` : c.h ?? ''; }), s.hours, s.cnt, s.real, s.공, s.특, s.병, s.결, s.gt + s.off, `${s.off}/${OFF_LIMIT}`];
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`${m.slice(0, 4)}년 장애인일자리사업 참여자 근태 현황 (${+m.slice(5, 7)}월) · 기준 ${mt.base}일`], head, ...rows]), `${+m.slice(5, 7)}월`);
    XLSX.writeFile(wb, `${V.monthLabel(m)} 장애인일자리 출석부.xlsx`);
  }

  return { ui, ST, findRow, srcList, removeSrc, clearMonth, parsePaste, parseInput, applyAll, undo, releaseGrid, page, results, bindGrid, fillMonth, saveMeta, addPerson, pasteCommit, removePerson, parseWorkbook, commitImport, doc, xlsx, sums, cell, meta, people, daysOf };
})();
