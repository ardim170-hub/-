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
  // 공휴일 (대체공휴일 포함). 달마다 출석부 화면에서 고칠 수 있다
  const HOLIDAYS = {
    '2026-01': [1], '2026-02': [16, 17, 18], '2026-03': [2], '2026-05': [5, 25], '2026-06': [3], '2026-08': [17],
    '2026-09': [24, 25], '2026-10': [5, 9], '2026-12': [25],
    '2027-01': [1], '2027-02': [8, 9], '2027-03': [1], '2027-05': [5, 13], '2027-06': [7], '2027-08': [16], '2027-09': [14, 15, 16], '2027-10': [4, 11], '2027-12': [27],
  };
  const ui = { month: U.today().slice(0, 7), view: 'month', pasteTbl: false, brush: '공', num: '3', group: '', showPeople: false, imp: null, paste: false };

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
  const parseDays = r => { if (!r || !r.days) return {}; try { return typeof r.days === 'string' ? JSON.parse(r.days) : { ...r.days }; } catch { return {}; } };
  const daysOf = (pid, m) => parseDays(recOf(pid, m));
  function meta(m) {
    const d = daysOf('_', m);
    const holidays = Array.isArray(d.holidays) ? d.holidays : (HOLIDAYS[m] || []);
    let weekdays = 0; for (let i = 1; i <= dim(m); i++) { const w = wd(m, i); if (w > 0 && w < 6) weekdays++; }
    return { holidays, base: Number(d.base) || weekdays, weekdays };
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
    const list = all.filter(p => activeIn(p, m) && (!ui.group || `${p.type}·${p.sub}` === ui.group));
    const groups = [...new Set(all.filter(p => activeIn(p, m)).map(p => `${p.type}·${p.sub}`))];
    const days = Object.fromEntries(list.map(p => [p.id, daysOf(p.id, m)]));
    const n = dim(m);
    const hol = new Set(mt.holidays.map(Number));
    const dayCls = d => { const w = wd(m, d); return w === 6 ? 'sat' : w === 0 ? 'sun' : hol.has(d) ? 'hol' : ''; };
    const brushes = [['base', '기본 시간'], ['num', '시간 직접'], ['휴', '휴무'], ...Object.entries(ST).map(([k, v]) => [k, v.label]), ['clear', '지우기']];
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
        tds += `<td class="c ${cls} ${c.st ? 'st-' + c.st : ''} ${c.off ? 'off' : ''}" data-p="${p.id}" data-d="${d}">${c.off ? '휴무' : c.h != null ? c.h : ''}</td>`;
      }
      // 마지막 주 (토요일이 없이 끝나는 달)
      const lastW = wd(m, n);
      if (lastW > 0 && lastW < 6) tds += `<td class="wk num">${weekSum(p, n + 1) || ''}</td>`;
      rows.push(`<tr>${span ? `<th rowspan="${span}" class="grp"><span>${e(p.type || '')}</span><span>${e(p.sub || '')}</span></th>` : ''}
        <td class="no num">${i + 1}</td><th class="nm" title="${e(p.name)}">${e(p.name)}</th>${tds}
        <td class="s hours num">${s.hours}시간</td><td class="s num">${s.cnt}일</td><td class="s num">${s.real}일</td>
        <td class="s st-공 num">${s.공}</td><td class="s st-특 num">${s.특}</td><td class="s st-병 num">${s.병}</td><td class="s st-결 num">${s.결}</td><td class="s num">${s.gt + s.off}</td>
        <td class="s num ${s.off > OFF_LIMIT ? 'over' : 'offuse'}">${s.off}/${OFF_LIMIT}</td></tr>`);
    });
    const tailCols = (lastW => (lastW > 0 && lastW < 6 ? 1 : 0))(wd(m, n));
    const foot = (label, key) => `<tr class="ft"><th colspan="3">${label}</th>${Array.from({ length: n }, (_, k) => { const d = k + 1, cls = dayCls(d); return cls === 'sat' || cls === 'sun' ? `<td class="${cls === 'sat' ? 'wk' : 'sun'}"></td>` : `<td class="num ${cls}">${hol.has(d) && key !== 'work' ? '' : dl[d][key] || ''}</td>`; }).join('')}${tailCols ? '<td class="wk"></td>' : ''}`;
    const realSum = Object.entries(dl).filter(([d]) => { const c = dayCls(+d); return !c || c === ''; }).reduce((a, [, v]) => a + v.real, 0);
    return `<section class="panel at">
      <div class="at-tools">
        <div class="at-brush" role="group" aria-label="칠하기 도구"><span class="sub">칠하기</span>${brushes.map(([k, l]) => `<button type="button" class="br ${ui.brush === k ? 'on' : ''} ${ST[k] ? 'st-' + k : ''} br-${k === '휴' ? 'off' : k}" data-act="at-brush" data-brush="${k}">${l}</button>`).join('')}
          ${ui.brush === 'num' ? `<input class="input sm" id="atNum" value="${e(ui.num)}" style="width:52px" inputmode="decimal" aria-label="칠할 시간">` : ''}</div>
        <div class="inline at-acts">
          <button class="btn btn-sm" type="button" data-act="at-fill" ${list.length ? '' : 'disabled'}>📅 기본 시간으로 이 달 채우기</button>
          <button class="btn btn-sm" type="button" data-act="at-xlsx" ${list.length ? '' : 'disabled'}>엑셀로 받기</button>
        </div>
      </div>
      <div class="at-meta">
        <label>공휴일 <input class="input sm" id="atHol" value="${e(mt.holidays.join(', '))}" style="width:110px" placeholder="예: 24, 25"> 일</label>
        <label>기준 일수 <input class="input sm" id="atBase" value="${mt.base}" style="width:48px" inputmode="numeric"> 일 <span class="sub">(평일 ${mt.weekdays}일)</span></label>
        <button class="btn btn-sm" type="button" data-act="at-meta">저장</button>
        ${groups.length > 1 ? `<span class="chips at-groups"><button type="button" class="chip ${!ui.group ? 'on' : ''}" data-act="at-group" data-g="">전체</button>${groups.map(g => `<button type="button" class="chip ${ui.group === g ? 'on' : ''}" data-act="at-group" data-g="${e(g)}">${e(g)}</button>`).join('')}</span>` : ''}
        <span class="sub at-help">도구를 고른 뒤 칸을 누르거나 끌면 칠해져요. 같은 칸을 다시 칠하면 지워져요. 공휴일은 채우기 때 공가로 들어가요.</span>
      </div>
      ${ui.imp ? importPanel() : ''}${ui.pasteTbl ? pastePanel() : ''}
      ${list.length ? `<div class="at-wrap" id="atWrap"><table class="at-tbl" id="atTbl"><thead>
        <tr><th rowspan="2" class="grp">구분</th><th rowspan="2" class="no">번호</th><th rowspan="2" class="nm">성명</th><th colspan="${n + tailCols}">${+m.slice(5, 7)}월</th><th colspan="9" class="s-head">${mt.base}일 기준</th></tr>
        <tr>${Array.from({ length: n }, (_, k) => { const d = k + 1, w = wd(m, d); return `<th class="d ${dayCls(d)}">${d}<small>${U.WD[w]}</small></th>`; }).join('')}${tailCols ? '<th class="d sat">계</th>' : ''}
          <th class="s hours">시간</th><th class="s">실적건수</th><th class="s">실근무 일수</th><th class="s st-공">공가</th><th class="s st-특">특휴</th><th class="s st-병">병가</th><th class="s st-결">결근</th><th class="s">근태</th><th class="s">휴무사용</th></tr></thead>
        <tbody>${rows.join('')}
          <tr class="tot"><th colspan="3">합계 (${list.length}명)</th><td colspan="${n + tailCols}"></td><td class="s num">${tot.hours}시간</td><td class="s num">${tot.cnt}일</td><td class="s num">${tot.real}일</td><td colspan="6"></td></tr>
          ${foot('근무 인원', 'work')}<td colspan="9"></td></tr>
          ${foot('병가·공가 사용 인원', 'use')}<td colspan="9"></td></tr>
          ${foot('실 근무 인원 (실인원)', 'real')}<td class="s num" colspan="3">${realSum}</td><td colspan="6"></td></tr>
          ${places(list).map(pl => `<tr class="ft pl"><th colspan="3">${e(pl)} 인원</th>${Array.from({ length: n }, (_, k) => { const d = k + 1, cls = dayCls(d); return cls === 'sat' || cls === 'sun' ? `<td class="${cls === 'sat' ? 'wk' : 'sun'}"></td>` : `<td class="num ${cls}">${dl[d].place[pl] || ''}</td>`; }).join('')}${tailCols ? '<td class="wk"></td>' : ''}<td colspan="9"></td></tr>`).join('')}
        </tbody></table></div>`
      : `<div class="empty"><strong>${V.monthLabel(m)}에 참여 중인 사람이 없어요</strong>아래 참여자 명단에서 추가하거나, 지금 쓰는 엑셀 출석부를 불러오세요.</div>`}
      ${peoplePanel(all)}
    </section>`;
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
    return `<details class="at-people" ${ui.showPeople ? 'open' : ''} id="atPeople"><summary><b>참여자 명단</b> <span class="sub">${all.length}명 · 추가·수정·삭제</span></summary>
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

  /* ---------- 칠하기 ---------- */
  let draft = null; // { pid: days } 끄는 동안 바뀐 것
  let strokeErase = null;
  function paint(td) {
    const pid = td.dataset.p, d = +td.dataset.d, m = ui.month;
    const p = S.get().jobPeople.find(x => x.id === pid);
    if (!p) return;
    draft ||= {};
    const days = draft[pid] ||= daysOf(pid, m);
    const cur = cell(days[d]);
    const bh = baseHours(p, m, d);
    const b = ui.brush;
    const has = b === 'base' ? cur.h === bh && !cur.st : b === 'num' ? cur.h === +ui.num && !cur.st : b === '휴' ? cur.off : ST[b] ? cur.st === b : false;
    if (strokeErase == null) strokeErase = has && b !== 'clear';
    let v;
    if (b === 'clear' || (strokeErase && b !== 'base' && b !== 'num' && b !== '휴' && !ST[b])) v = '';
    else if (strokeErase) v = b === '휴' || b === 'base' || b === 'num' ? '' : b === '결' ? String(bh) : String(cur.h ?? bh);
    else if (b === 'base') v = String(bh);
    else if (b === 'num') v = String(+ui.num || 0);
    else if (b === '휴') v = '휴';
    else if (b === '결') v = '|결';
    else v = `${cur.h ?? bh}|${b}`;
    if (v) days[d] = v; else delete days[d];
    const c = cell(v);
    td.className = `c ${td.classList.contains('hol') ? 'hol' : ''} ${c.st ? 'st-' + c.st : ''} ${c.off ? 'off' : ''} painted`;
    td.textContent = c.off ? '휴무' : c.h != null ? c.h : '';
  }
  function commit() {
    if (!draft) return;
    const m = ui.month;
    const recs = Object.entries(draft).map(([pid, days]) => { const r = recOf(pid, m); return { ...(r ? { id: r.id } : {}), pid, month: m, days: JSON.stringify(days) }; });
    draft = null; strokeErase = null;
    S.putMany('att', recs);
  }
  let down = false;
  window.addEventListener('pointerup', () => { if (!down) return; down = false; commit(); });
  function bindGrid() {
    const tbl = document.getElementById('atTbl');
    if (!tbl) return;
    tbl.addEventListener('pointerdown', ev => {
      const td = ev.target.closest('td.c'); if (!td || ev.button !== 0) return;
      if (!S.can('attend', 2)) return;
      ev.preventDefault(); down = true; strokeErase = null; paint(td);
    });
    tbl.addEventListener('pointerover', ev => { if (!down) return; const td = ev.target.closest('td.c'); if (td && !td.classList.contains('painted')) paint(td); });
  }

  /** 기본 시간으로 빈 칸 채우기 (참여 기간 안의 평일만, 공휴일은 공가) */
  function fillMonth() {
    const m = ui.month, mt = meta(m), hol = new Set(mt.holidays.map(Number));
    const recs = [];
    let n = 0;
    people().filter(p => activeIn(p, m) && (!ui.group || `${p.type}·${p.sub}` === ui.group)).forEach(p => {
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
  function saveMeta(holText, base) {
    const m = ui.month;
    const holidays = String(holText || '').split(/[,\s]+/).map(Number).filter(d => d >= 1 && d <= dim(m));
    const r = recOf('_', m);
    S.putMany('att', [{ ...(r ? { id: r.id } : {}), pid: '_', month: m, days: JSON.stringify({ holidays, base: Number(base) || meta(m).weekdays }) }]);
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
    const byKey = new Map(S.get().jobPeople.map(p => [p.name + '|' + normDate(p.birth), p]));
    let no = S.get().jobPeople.reduce((a, p) => Math.max(a, Number(p.no) || 0), 0);
    const newPeople = [], recs = [];
    let months = new Set();
    picked.forEach(g => g.rows.forEach(r => {
      const key = r.name + '|' + r.birth;
      let p = byKey.get(key) || [...byKey.values()].find(x => x.name === r.name && !r.birth);
      const type = TYPES.find(t => (r.type || '').includes(t.slice(0, 2))) || '복지형';
      const sub = SUBS.find(t => (r.sub || '').includes(t.slice(0, 2))) || '참여형';
      if (!p) { p = { id: U.uid('J'), no: String(++no), name: r.name, type, sub, birth: r.birth, start: r.start, end: r.end, pattern: r.pattern || DEFAULT_PATTERN[sub], staff: S.me() }; newPeople.push(p); byKey.set(key, p); }
      const old = recOf(p.id, g.month);
      recs.push({ ...(old ? { id: old.id } : {}), pid: p.id, month: g.month, days: JSON.stringify(r.days) });
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

  return { ui, ST, parsePaste, page, results, bindGrid, fillMonth, saveMeta, addPerson, pasteCommit, removePerson, parseWorkbook, commitImport, doc, xlsx, sums, cell, meta, people, daysOf };
})();
