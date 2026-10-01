/* JOB이음터 일정표 (직업훈련): 월~금 × 오전·오후 칸에 훈련 구분과 내용을 적는 월간 일정표
   - 칸 하나 = 기록 한 줄 { date, slot: 오전|오후|종일, cat: 훈련 구분, content: 내용, color }
   - 날짜 옆 표시(예: 7 (건강관리))는 slot '라벨', 아래 안내 문구는 그 달 1일의 slot '안내'
   - 엑셀(지금 쓰는 일정표 양식)·한글 파일을 여러 개 불러와 한 달에 합칠 수 있다 */
window.TR = (() => {
  const e = U.esc;
  const ui = { month: U.today().slice(0, 7), edit: null, imp: null };
  const SLOTS = ['오전', '오후'];
  const TIMES = { 오전: '10:00~12:00', 오후: '13:30~16:00' };
  // 칸 색: 엑셀에서 쓰던 색 그대로
  const COLORS = [['', '없음'], ['F2DCDB', '분홍 (외부 활동)'], ['D7E4BD', '연두 (견학·탐색)'], ['DBEEF4', '하늘 (대회·행사)'], ['E6E0EC', '보라 (특별 교육)'], ['FDEADA', '살구'], ['FFFF00', '노랑 (강조)'], ['EEECE1', '회색 (휴관·미운영)']];
  const plans = m => S.get().trainPlans.filter(x => (x.date || '').startsWith(m));
  const at = (m, d, slot) => plans(m).find(x => x.date === `${m}-${U.pad(d)}` && x.slot === slot);
  const dim = m => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
  const wd = (m, d) => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, d).getDay();
  const staffNames = () => S.staff().filter(s => s.program === '직업훈련').map(s => s.name);

  /** 월~금 주 단위로 날짜 묶기 */
  function weeks(m) {
    const out = []; let cur = null;
    for (let d = 1; d <= dim(m); d++) {
      const w = wd(m, d); if (w === 0 || w === 6) continue;
      if (!cur || w === 1) { cur = [null, null, null, null, null]; out.push(cur); }
      cur[w - 1] = d;
    }
    return out;
  }
  function cellHtml(m, d, slot, rowspan) {
    const x = at(m, d, slot);
    const bg = x && x.color ? `style="background:#${x.color}"` : '';
    const lines = x ? String(x.content || '').split('\n').filter(Boolean) : [];
    const big = x && !x.cat && lines.length <= 2 && /휴관|미운영|휴가|연휴|추석|공휴일/.test(x.content || '');
    return `<td class="tp-cell ${x ? '' : 'empty'} ${big ? 'big' : ''}" ${rowspan ? `rowspan="${rowspan}"` : ''} ${bg} data-act="tp-edit" data-date="${m}-${U.pad(d)}" data-slot="${slot}" title="눌러서 고치기">
      ${x ? `${x.cat ? `<div class="tp-cat">${e(x.cat)}</div>` : ''}<div class="tp-txt">${lines.map(l => e(l)).join('<br>')}</div>` : '<span class="tp-plus">+</span>'}</td>`;
  }
  function grid(m, forPrint) {
    const ws = weeks(m);
    const label = d => { const x = at(m, d, '라벨'); return x && x.content ? x.content : ''; };
    return `<table class="tp-tbl ${forPrint ? 'print' : ''}"><colgroup><col style="width:9%">${'<col style="width:18.2%">'.repeat(5)}</colgroup>
      <thead><tr><th></th>${['월', '화', '수', '목', '금'].map(w => `<th>${w}</th>`).join('')}</tr></thead>
      <tbody>${ws.map(wk => `
        <tr class="tp-date"><td></td>${wk.map(d => d ? `<td class="${label(d) ? 'lab' : ''} ${D.AREAS && (AT_HOL(m).includes(d)) ? 'hol' : ''}" data-act="tp-label" data-date="${m}-${U.pad(d)}" title="날짜 옆 표시 고치기">${d}${label(d) ? ` <b>(${e(label(d))})</b>` : ''}</td>` : '<td class="none"></td>').join('')}</tr>
        ${SLOTS.map((slot, si) => `<tr class="tp-slot"><th>${slot}<small>(${TIMES[slot]})</small></th>${wk.map(d => {
          if (!d) return si === 0 ? '<td class="none" rowspan="2"></td>' : '';
          const full = at(m, d, '종일');
          if (full) return si === 0 ? cellHtml(m, d, '종일', 2) : '';
          return cellHtml(m, d, slot);
        }).join('')}</tr>`).join('')}`).join('')}
      </tbody></table>`;
  }
  // 출석부와 같은 공휴일 목록을 쓴다 (없으면 빈 목록)
  const AT_HOL = m => { try { return (window.AT && AT.meta(m).holidays || []).map(Number); } catch { return []; } };
  const notesOf = m => { const x = at(m, 1, '안내'); return x ? x.content || '' : ''; };

  function view() {
    const m = ui.month, names = staffNames();
    const n = plans(m).filter(x => SLOTS.includes(x.slot) || x.slot === '종일').length;
    return `<section class="panel tp">
      <div class="tp-head">
        <div class="month-nav"><button class="icon-btn" type="button" data-act="tp-month" data-d="-1" aria-label="이전 달">${V.I.back}</button><b class="num">${V.monthLabel(m)}</b><button class="icon-btn" type="button" data-act="tp-month" data-d="1" aria-label="다음 달" style="transform:scaleX(-1)">${V.I.back}</button></div>
        <h2 class="tp-title">JOB이음터 ${+m.slice(5)}월 일정표</h2>
        <div class="inline">
          <button class="btn" type="button" data-act="tp-import">📂 엑셀·한글 불러오기</button>
          <button class="btn" type="button" data-act="tp-copy-prev" title="지난달 같은 요일 프로그램으로 빈 칸 채우기">지난달 요일별로 채우기</button>
          <button class="btn btn-primary" type="button" data-act="tp-print" ${n ? '' : 'disabled'}>🖨 인쇄</button>
        </div>
      </div>
      <p class="sub tp-staff">직업훈련 담당: ${names.length ? names.map(x => `<b>${e(x)}</b>`).join(', ') : '<span class="tv-over">데이터 관리에서 직원 소속을 "직업훈련"으로 정해 주세요</span>'} · 칸을 누르면 고칠 수 있어요. 날짜를 누르면 "(건강관리)" 같은 표시를 붙여요.</p>
      ${ui.imp ? importPanel() : ''}
      <div class="tp-wrap">${grid(m)}</div>
      <div class="tp-notes"><label>아래 안내 문구 <span class="sub">(한 줄에 하나, 인쇄할 때 표 아래에 나와요)</span><textarea class="textarea" id="tpNotes" rows="3" placeholder="※복지관 상황에 따라 일정이 변동될 수 있습니다.">${e(notesOf(m))}</textarea></label>
        <div class="inline"><button class="btn btn-sm" type="button" data-act="tp-notes-save">안내 저장</button>${n ? `<button class="btn btn-sm btn-danger-ghost" type="button" data-act="tp-clear">${+m.slice(5)}월 일정표 비우기 (${n}칸)</button>` : ''}</div></div>
    </section>
    ${ui.edit ? editDialog() : ''}`;
  }
  function editDialog() {
    const { date, slot } = ui.edit;
    const m = date.slice(0, 7), d = +date.slice(8);
    const x = at(m, d, slot) || at(m, d, '종일') || {};
    const full = slot === '종일' || !!at(m, d, '종일');
    return `<div class="modal-layer tp-modal" id="tpModal"><div class="modal" role="dialog" aria-label="일정표 칸 고치기">
      <h2>${+date.slice(5, 7)}월 ${d}일 (${['일', '월', '화', '수', '목', '금', '토'][wd(m, d)]}) ${full ? '하루 종일' : slot}</h2>
      <label>훈련 구분 <input class="input" id="tpCat" value="${e(x.cat || '')}" list="tpCats" placeholder="예: 직업탐색훈련 / 작업훈련"></label>
      <datalist id="tpCats">${[...new Set(S.get().trainPlans.map(p => p.cat).filter(Boolean))].slice(0, 40).map(c => `<option value="${e(c)}">`).join('')}</datalist>
      <label>내용 <textarea class="textarea" id="tpContent" rows="4" placeholder="- 바리스타&#10;- 댄스 유산소">${e(x.content || '')}</textarea></label>
      <label>칸 색 <select class="select" id="tpColor">${COLORS.map(([c, l]) => `<option value="${c}" ${(x.color || '') === c ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="tpFull" ${full ? 'checked' : ''}> 오전·오후 합쳐서 하루 종일 (휴관·외부 일정 등)</label>
      <div class="inline tp-modal-acts"><button class="btn btn-primary" type="button" data-act="tp-save">저장</button>${x.id ? '<button class="btn btn-danger-ghost" type="button" data-act="tp-del">칸 비우기</button>' : ''}<button class="btn" type="button" data-act="tp-cancel">닫기</button></div>
    </div></div>`;
  }
  function save() {
    const { date, slot } = ui.edit;
    const m = date.slice(0, 7), d = +date.slice(8);
    const full = document.getElementById('tpFull').checked;
    const rec = { date, cat: document.getElementById('tpCat').value.trim(), content: document.getElementById('tpContent').value.replace(/\r/g, '').trim(), color: document.getElementById('tpColor').value };
    const old = full ? [at(m, d, '오전'), at(m, d, '오후'), at(m, d, '종일')] : [at(m, d, '종일')];
    const keep = full ? at(m, d, '종일') : at(m, d, slot);
    const drop = old.filter(o => o && (!keep || o.id !== keep.id)).map(o => o.id);
    if (drop.length) S.removeMany('tp', drop);
    if (rec.cat || rec.content) S.putMany('tp', [{ ...(keep ? { id: keep.id } : {}), ...rec, slot: full ? '종일' : (slot === '종일' ? '오전' : slot) }]);
    else if (keep) S.removeMany('tp', [keep.id]);
    ui.edit = null;
  }
  function remove() {
    const { date, slot } = ui.edit; const m = date.slice(0, 7), d = +date.slice(8);
    const ids = [at(m, d, slot), at(m, d, '종일')].filter(Boolean).map(x => x.id);
    ui.edit = null;
    return ids.length ? S.removeMany('tp', ids) : null;
  }
  function setLabel(date, text) {
    const m = date.slice(0, 7), d = +date.slice(8);
    const x = at(m, d, '라벨');
    if (!text) { if (x) S.removeMany('tp', [x.id]); return; }
    S.putMany('tp', [{ ...(x ? { id: x.id } : {}), date, slot: '라벨', cat: '', content: text, color: '' }]);
  }
  function saveNotes(text) {
    const m = ui.month, x = at(m, 1, '안내');
    if (!text.trim()) { if (x) S.removeMany('tp', [x.id]); return; }
    S.putMany('tp', [{ ...(x ? { id: x.id } : {}), date: `${m}-01`, slot: '안내', cat: '', content: text.trim(), color: '' }]);
  }
  function clearMonth() {
    const ids = plans(ui.month).map(x => x.id);
    return ids.length ? S.removeMany('tp', ids) : null;
  }
  /** 지난달 같은 요일(마지막 주 기준이 아니라 가장 흔한 내용)로 이번 달 빈 칸 채우기. 휴관·특별 일정은 빼고 */
  function copyPrev() {
    const m = ui.month, [y, mo] = m.split('-').map(Number), pd = new Date(y, mo - 2, 1);
    const pm = `${pd.getFullYear()}-${U.pad(pd.getMonth() + 1)}`;
    const src = plans(pm).filter(x => SLOTS.includes(x.slot) && !x.color && x.cat);
    const best = {};
    src.forEach(x => { const k = `${wd(pm, +x.date.slice(8))}|${x.slot}`; const v = `${x.cat}\u0000${x.content}`; (best[k] ||= {})[v] = ((best[k] || {})[v] || 0) + 1; });
    const hol = AT_HOL(m);
    const recs = [];
    for (let d = 1; d <= dim(m); d++) {
      const w = wd(m, d); if (w === 0 || w === 6 || hol.includes(d) || at(m, d, '종일')) continue;
      SLOTS.forEach(slot => {
        if (at(m, d, slot)) return;
        const c = best[`${w}|${slot}`]; if (!c) return;
        const [v] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
        const [cat, content] = v.split('\u0000');
        recs.push({ date: `${m}-${U.pad(d)}`, slot, cat, content, color: '' });
      });
    }
    if (recs.length) S.putMany('tp', recs);
    return { n: recs.length, from: pm };
  }

  /* ---------- 엑셀·한글 불러오기 ---------- */
  /** G = { r0, r1, c0, c1, txt(r,c), fill(r,c), merge(r,c) → {r0,r1,c0,c1}|null } */
  function parseGrid(G, hint) {
    const out = [];
    // 요일 머리줄 찾기
    let head = -1, cols = {};
    for (let r = G.r0; r <= G.r1 && head < 0; r++) {
      const found = {};
      for (let c = G.c0; c <= G.c1; c++) { const t = G.txt(r, c).replace(/\s/g, ''); const i = ['월', '화', '수', '목', '금'].indexOf(t); if (i >= 0) found[i + 1] = c; }
      if (Object.keys(found).length >= 4) { head = r; cols = found; }
    }
    if (head < 0) return null;
    // 해·월: 시트 이름·제목·파일 이름에서
    let year = 0, month = 0;
    const scan = s => { const k = String(s || '').match(/(20\d{2})\s*년/); if (k && !year) year = +k[1]; const mm = String(s || '').match(/(\d{1,2})\s*월/); if (mm && !month) month = +mm[1]; };
    scan(hint.sheet); for (let r = G.r0; r < head; r++) for (let c = G.c0; c <= G.c1; c++) scan(G.txt(r, c)); scan(hint.file);
    if (!year) year = +ui.month.slice(0, 4);
    if (!month) return null;
    const m = `${year}-${U.pad(month)}`;
    const slotOf = r => { for (let c = G.c0; c < Math.min(...Object.values(cols)); c++) { const t = G.txt(r, c); if (/오전/.test(t)) return '오전'; if (/오후/.test(t)) return '오후'; } return ''; };
    const dateRow = r => { const ds = {}; Object.entries(cols).forEach(([w, c]) => { const k = G.txt(r, c).match(/^\s*(\d{1,2})\s*(?:일)?\s*(?:\(?\s*([^)]*?)\s*\)?)?\s*$/); if (k && +k[1] >= 1 && +k[1] <= 31) ds[w] = { d: +k[1], label: (k[2] || '').replace(/^\(|\)$/g, '').trim() }; }); return Object.keys(ds).length ? ds : null; };
    let cur = null, last = head;
    const seen = new Set();
    for (let r = head + 1; r <= G.r1; r++) {
      const dr = dateRow(r);
      if (dr) { cur = dr; Object.values(dr).forEach(x => { if (x.label) out.push({ date: `${m}-${U.pad(x.d)}`, slot: '라벨', cat: '', content: x.label, color: '' }); }); last = r; continue; }
      const slot = slotOf(r);
      if (!slot || !cur) continue;
      last = r;
      Object.entries(cols).forEach(([w, c]) => {
        const info = cur[w]; if (!info) return;
        const mg = G.merge(r, c);
        const tr = mg ? mg.r0 : r, tc = mg ? mg.c0 : c;
        const raw = G.txt(tr, tc); if (!raw) return;
        const span2 = mg && mg.r1 > mg.r0 && slotOf(mg.r1) !== slotOf(mg.r0);
        const sl = span2 ? '종일' : slot;
        const key = `${info.d}|${sl}`; if (seen.has(key)) return; seen.add(key);
        const lines = raw.replace(/\r/g, '').split('\n').map(x => x.replace(/\s+$/, ''));
        while (lines.length && !lines[0].trim()) lines.shift();
        const first = lines[0] || '';
        const isCat = /훈련|교육$/.test(first) && /훈련/.test(first) && lines.length > 1;
        const color = (G.fill(tr, tc) || '').toUpperCase();
        out.push({ date: `${m}-${U.pad(info.d)}`, slot: sl, cat: isCat ? first.trim() : '', content: (isCat ? lines.slice(1) : lines).join('\n').trim(), color: color === 'FFFFFF' ? '' : color });
      });
    }
    // 표 아래 안내 문구
    const notes = [];
    for (let r = last + 1; r <= G.r1; r++) for (let c = G.c0; c <= G.c1; c++) { const t = G.txt(r, c); if (t && t.length > 3 && !notes.includes(t)) notes.push(t.replace(/\r/g, '')); }
    if (notes.length) out.push({ date: `${m}-01`, slot: '안내', cat: '', content: notes.join('\n'), color: '' });
    return { month: m, recs: out };
  }
  function fromWorkbook(wb, file) {
    return wb.SheetNames.map(name => {
      const ws = wb.Sheets[name]; if (!ws['!ref']) return null;
      const rg = XLSX.utils.decode_range(ws['!ref']);
      const cellAt = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
      const merges = ws['!merges'] || [];
      return parseGrid({ r0: rg.s.r, r1: rg.e.r, c0: rg.s.c, c1: rg.e.c,
        txt: (r, c) => { const x = cellAt(r, c); return x && x.v != null ? String(x.v).trim() : ''; },
        fill: (r, c) => { const x = cellAt(r, c); return x && x.s && x.s.fgColor && x.s.fgColor.rgb ? String(x.s.fgColor.rgb).slice(-6) : ''; },
        merge: (r, c) => { const g = merges.find(g => r >= g.s.r && r <= g.e.r && c >= g.s.c && c <= g.e.c); return g ? { r0: g.s.r, r1: g.e.r, c0: g.s.c, c1: g.e.c } : null; } }, { sheet: name, file });
    }).filter(Boolean);
  }
  /** 한글 표: 칸 합치기(가로·세로)를 펼쳐 엑셀과 같은 격자로 만든다 */
  function fromHwpTables(tables, file) {
    return tables.map(t => {
      const grid = [], owner = [];
      t.rows.forEach((row, r) => (row || []).forEach((v, c) => {
        if (v == null) return;
        const cs = (t.spans[r] || [])[c] || 1, rs = ((t.rspans || [])[r] || [])[c] || 1;
        for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) { (owner[r + i] ||= [])[c + j] = { r0: r, c0: c, r1: r + rs - 1, c1: c + cs - 1 }; }
        (grid[r] ||= [])[c] = v;
      }));
      const rows = Math.max(grid.length, owner.length), cols = Math.max(0, ...owner.map(x => (x || []).length));
      return parseGrid({ r0: 0, r1: rows - 1, c0: 0, c1: cols - 1, txt: (r, c) => String((grid[r] || [])[c] ?? '').trim(), fill: () => '', merge: (r, c) => { const o = (owner[r] || [])[c]; return o && (o.r1 > o.r0 || o.c1 > o.c0) ? o : null; } }, { sheet: '', file });
    }).filter(Boolean);
  }
  function importPanel() {
    const g = ui.imp;
    return `<div class="at-imp tp-imp"><b>불러온 일정표</b> <span class="sub">${e(g.files.join(', '))}</span>
      <div class="at-imp-list">${g.found.map((x, i) => { const have = plans(x.month).filter(p => SLOTS.includes(p.slot) || p.slot === '종일').length; const cells = x.recs.filter(p => SLOTS.includes(p.slot) || p.slot === '종일').length; return `<label class="check"><input type="checkbox" data-act="tp-imp-toggle" data-i="${i}" ${x.on ? 'checked' : ''}>${e(V.monthLabel(x.month))} · ${cells}칸${have ? ` <span class="sub">(지금 ${have}칸 있음)</span>` : ''}</label>`; }).join('')}</div>
      <div class="inline" style="margin-top:6px"><label class="check"><input type="radio" name="tpMerge" value="over" ${g.mode === 'over' ? 'checked' : ''} data-act="tp-imp-mode">같은 칸은 새 파일로 바꾸기</label><label class="check"><input type="radio" name="tpMerge" value="keep" ${g.mode === 'keep' ? 'checked' : ''} data-act="tp-imp-mode">이미 적힌 칸은 그대로 두고 빈 칸만 채우기</label></div>
      <div class="inline" style="margin-top:6px"><button class="btn btn-sm btn-primary" type="button" data-act="tp-imp-commit">합치기</button><button class="btn btn-sm" type="button" data-act="tp-imp-cancel">취소</button></div></div>`;
  }
  function commitImport() {
    const g = ui.imp; let put = [], drop = [], skipped = 0;
    const months = [];
    g.found.filter(x => x.on).forEach(x => {
      months.push(x.month);
      x.recs.forEach(r => {
        const m = r.date.slice(0, 7), d = +r.date.slice(8);
        const same = at(m, d, r.slot);
        const clash = r.slot === '종일' ? [at(m, d, '오전'), at(m, d, '오후')].filter(Boolean) : SLOTS.includes(r.slot) ? [at(m, d, '종일')].filter(Boolean) : [];
        if (g.mode === 'keep' && (same || clash.length)) { skipped++; return; }
        clash.forEach(c => drop.push(c.id));
        put.push({ ...(same ? { id: same.id } : {}), ...r, src: g.files.join(', ') });
      });
    });
    if (drop.length) S.removeMany('tp', drop);
    if (put.length) S.putMany('tp', put);
    if (months.length) ui.month = months.sort()[months.length - 1];
    ui.imp = null;
    return { put: put.length, skipped, months };
  }

  /** 인쇄: A4 가로 한 장, 엑셀 양식과 같은 모양 */
  function doc(m = ui.month) {
    const notes = notesOf(m).split('\n').filter(Boolean);
    const names = staffNames();
    return `<article class="doc tp-doc">
      <h1>JOB이음터 ${+m.slice(5)}월 일정표</h1>
      ${grid(m, true)}
      <div class="tp-doc-notes">${notes.map(n => `<div>${e(n)}</div>`).join('')}${names.length && !notes.some(n => /담당/.test(n)) ? `<div class="r">담당: 직업지원팀 ${names.map(e).join(', ')}</div>` : ''}</div>
    </article>`;
  }

  return { ui, view, doc, save, remove, setLabel, saveNotes, clearMonth, copyPrev, fromWorkbook, fromHwpTables, commitImport, plans, at };
})();
