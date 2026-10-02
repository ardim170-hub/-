/* 직업훈련 반별 월간 일정표 (JOB이음터 · 일과놀이반): 월~금 × 오전·오후 칸에 훈련 구분과 내용을 적는다
   - 칸 하나 = 기록 한 줄 { date, slot: 오전|오후|종일, cat: 훈련 구분, content: 내용, color }
   - 날짜 옆 표시(예: 7 (건강관리))는 slot '라벨', 아래 안내 문구는 그 달 1일의 slot '안내'
   - 엑셀(지금 쓰는 일정표 양식)·한글 파일을 여러 개 불러와 한 달에 합칠 수 있다 */
window.TR = (() => {
  const e = U.esc;
  const CLASSES = ['JOB이음터', '일과놀이반'];
  const ui = { month: U.today().slice(0, 7), cls: CLASSES[0], edit: null, imp: null };
  const SLOTS = ['오전', '오후'];
  const TIMES = { 오전: '10:00~12:00', 오후: '13:30~16:00' };
  // 칸 색: 엑셀에서 쓰던 색 그대로
  const COLORS = [['', '없음'], ['F2DCDB', '분홍 (외부 활동)'], ['D7E4BD', '연두 (견학·탐색)'], ['DBEEF4', '하늘 (대회·행사)'], ['E6E0EC', '보라 (특별 교육)'], ['FDEADA', '살구'], ['FFFF00', '노랑 (강조)'], ['EEECE1', '회색 (휴관·미운영)']];
  // 반 칸이 비어 있는 예전 기록은 JOB이음터로 본다
  const clsOf = x => x.cls || CLASSES[0];
  const plans = (m, cls = ui.cls) => S.get().trainPlans.filter(x => (x.date || '').startsWith(m) && clsOf(x) === cls);
  const at = (m, d, slot, cls = ui.cls) => plans(m, cls).find(x => x.date === `${m}-${U.pad(d)}` && x.slot === slot);
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
  const FONTS = [['', '기본 글씨체'], ['Malgun Gothic, 맑은 고딕', '맑은 고딕'], ['NanumGothic, 나눔고딕', '나눔고딕'], ['Gulim, 굴림', '굴림'], ['Dotum, 돋움', '돋움'], ['Batang, 바탕, serif', '바탕'], ['Gungsuh, 궁서, serif', '궁서']];
  const SIZES = [9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28];
  const TEXT_COLORS = ['111111', 'DC2626', 'C2410C', 'B08800', '15803D', '1D4ED8', '7C3AED', '6B7280'];
  const CAT_LIST = ['직업탐색훈련', '직업준비훈련', '작업훈련', '권익옹호훈련', '사회적응훈련', '직업탐색훈련 / 작업훈련', '직업탐색훈련 / 직업준비훈련', '직업준비훈련 / 작업훈련', '직업준비훈련 / 권익옹호훈련', '권익옹호훈련 / 작업훈련', '사회적응훈련 / 직업탐색훈련', '사회적응훈련 / 직업준비훈련'];
  const catList = () => [...new Set([...CAT_LIST, ...S.get().trainPlans.map(p => p.cat).filter(Boolean)])];
  const fmtOf = x => (x && x.fmt && typeof x.fmt === 'object' ? x.fmt : {});
  /** 칸 서식 → style (배경·글자색·크기·글씨체·굵게·기울임·밑줄·정렬) */
  function styleOf(x, print) {
    if (!x) return '';
    const f = fmtOf(x), st = [];
    if (x.color) st.push(`background:#${x.color}`);
    if (f.fc) st.push(`color:#${f.fc}`);
    if (f.size) st.push(print ? `font-size:calc(${f.size * 0.62}pt * var(--tps, 1))` : `font-size:${f.size}px`);
    if (f.font) st.push(`font-family:${f.font}, sans-serif`);
    if (f.b) st.push('font-weight:800');
    if (f.i) st.push('font-style:italic');
    if (f.u) st.push('text-decoration:underline');
    if (f.al) st.push(`text-align:${f.al}`);
    return st.length ? `style="${st.join(';')}"` : '';
  }
  function cellHtml(m, d, slot, rowspan, R, c, print) {
    const x = at(m, d, slot);
    const bg = styleOf(x, print);
    const f = fmtOf(x);
    const lines = x ? String(x.content || '').split('\n').filter(Boolean) : [];
    const big = x && !x.cat && lines.length <= 2 && /휴관|미운영|휴가|연휴|추석|공휴일/.test(x.content || '');
    return `<td class="tp-cell ${x ? '' : 'empty'} ${big ? 'big' : ''}" ${rowspan ? `rowspan="${rowspan}"` : ''} ${bg} data-r="${R}" data-c="${c}" ${rowspan ? `data-r2="${R + 1}"` : ''}>
      ${f.chk ? `<span class="tp-chk ${f.on ? 'on' : ''}" data-act="tp-check" data-r="${R}" data-c="${c}" role="checkbox" aria-checked="${!!f.on}" title="눌러서 체크">${f.on ? '☑' : '☐'}</span>` : ''}${x && (x.cat || x.content) ? `${x.cat ? `<div class="tp-cat">${e(x.cat)}</div>` : ''}<div class="tp-txt">${lines.map(l => e(l)).join('<br>')}</div>` : ''}<button type="button" class="tp-dd" data-act="tp-dd" data-r="${R}" data-c="${c}" tabindex="-1" aria-label="훈련 구분 고르기" title="훈련 구분 고르기">▾</button></td>`;
  }
  function grid(m, forPrint) {
    const ws = weeks(m);
    const label = d => { const x = at(m, d, '라벨'); return x && x.content ? x.content : ''; };
    return `<table class="tp-tbl ${forPrint ? 'print' : ''}"><colgroup><col style="width:9%">${'<col style="width:18.2%">'.repeat(5)}</colgroup>
      <thead><tr><th></th>${['월', '화', '수', '목', '금'].map(w => `<th>${w}</th>`).join('')}</tr></thead>
      <tbody>${ws.map((wk, wi) => `
        <tr class="tp-date"><td></td>${wk.map((d, c) => d ? `<td class="tp-dcell ${label(d) ? 'lab' : ''}" data-r="${wi * 3}" data-c="${c}" title="글자를 치면 날짜 옆 표시 (예: 건강관리)">${d}${label(d) ? ` <b>(${e(label(d))})</b>` : ''}</td>` : '<td class="none"></td>').join('')}</tr>
        ${SLOTS.map((slot, si) => `<tr class="tp-slot"><th>${slot}<small>(${TIMES[slot]})</small></th>${wk.map((d, c) => {
          if (!d) return si === 0 ? '<td class="none" rowspan="2"></td>' : '';
          const full = at(m, d, '종일');
          if (full) return si === 0 ? cellHtml(m, d, '종일', 2, wi * 3 + 1, c, forPrint) : '';
          return cellHtml(m, d, slot, 0, wi * 3 + 1 + si, c, forPrint);
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
      <div class="chips tp-classes" role="tablist" aria-label="반 고르기">${CLASSES.map(c => `<button type="button" role="tab" class="chip ${ui.cls === c ? 'on' : ''}" data-act="tp-cls" data-cls="${e(c)}">${e(c)} <span class="n">${plans(m, c).filter(x => SLOTS.includes(x.slot) || x.slot === '종일').length}</span></button>`).join('')}</div>
      <div class="tp-head">
        <div class="month-nav"><button class="icon-btn" type="button" data-act="tp-month" data-d="-1" aria-label="이전 달">${V.I.back}</button><b class="num">${V.monthLabel(m)}</b><button class="icon-btn" type="button" data-act="tp-month" data-d="1" aria-label="다음 달" style="transform:scaleX(-1)">${V.I.back}</button></div>
        <h2 class="tp-title">${e(ui.cls)} ${+m.slice(5)}월 일정표</h2>
        <div class="inline">
          <button class="btn" type="button" data-act="tp-import">📂 엑셀·한글 불러오기</button>
          <button class="btn" type="button" data-act="tp-copy-prev" title="지난달 같은 요일 프로그램으로 빈 칸 채우기">지난달 요일별로 채우기</button>
          <button class="btn btn-primary" type="button" data-act="tp-print" ${n ? '' : 'disabled'}>🖨 인쇄</button>
        </div>
      </div>
      <p class="sub tp-staff">직업훈련 담당: ${names.length ? names.map(x => `<b>${e(x)}</b>`).join(', ') : '<span class="tv-over">데이터 관리에서 직원 소속을 "직업훈련"으로 정해 주세요</span>'}</p>
      ${ui.imp ? importPanel() : ''}
      <div class="tp-tools tp-ribbon">
        <select class="select sm" id="tpFont" data-tpfmt="font" title="글씨체" tabindex="-1">${FONTS.map(([v, l]) => `<option value="${e(v)}">${l}</option>`).join('')}</select>
        <select class="select sm" id="tpSize" data-tpfmt="size" title="글씨 크기" tabindex="-1"><option value="">크기</option>${SIZES.map(z => `<option value="${z}">${z}</option>`).join('')}</select>
        <button type="button" class="tp-tb" data-act="tp-fmt" data-k="b" title="굵게 (Ctrl+B)" tabindex="-1"><b>가</b></button>
        <button type="button" class="tp-tb" data-act="tp-fmt" data-k="i" title="기울임 (Ctrl+I)" tabindex="-1"><i>가</i></button>
        <button type="button" class="tp-tb" data-act="tp-fmt" data-k="u" title="밑줄 (Ctrl+U)" tabindex="-1"><u>가</u></button>
        <span class="tp-sep"></span>
        <span class="tp-grp" title="글자색"><span class="tp-lbl">글자</span>${TEXT_COLORS.map(c => `<button type="button" class="tp-sw sm" style="background:#${c}" data-act="tp-fc" data-color="${c}" title="글자색" tabindex="-1"></button>`).join('')}<input type="color" class="tp-pick" data-tpfmt="fc" title="글자색 직접 고르기" tabindex="-1"></span>
        <span class="tp-sep"></span>
        <button type="button" class="tp-tb" data-act="tp-align" data-al="left" title="왼쪽 정렬" tabindex="-1">⬅</button>
        <button type="button" class="tp-tb" data-act="tp-align" data-al="center" title="가운데 정렬" tabindex="-1">↔</button>
        <button type="button" class="tp-tb" data-act="tp-align" data-al="right" title="오른쪽 정렬" tabindex="-1">➡</button>
        <span class="tp-sep"></span>
        <button type="button" class="tp-tb wide" data-act="tp-chkbox" title="고른 칸에 체크박스 넣기/빼기" tabindex="-1">☑ 체크박스</button>
        <select class="select sm" id="tpCatSel" data-tpfmt="cat" title="고른 칸의 훈련 구분 (드롭다운)" tabindex="-1"><option value="">▾ 훈련 구분 고르기</option>${catList().map(c => `<option>${e(c)}</option>`).join('')}<option value="-">(훈련 구분 지우기)</option></select>
        <button type="button" class="tp-tb wide" data-act="tp-fmt-clear" title="고른 칸의 글씨 서식 지우기" tabindex="-1">서식 지우기</button>
      </div>
      <div class="tp-tools">
        <span class="sub">칸 색</span>
        ${COLORS.map(([c, l]) => `<button type="button" class="tp-sw ${c ? '' : 'none'}" style="${c ? `background:#${c}` : ''}" data-act="tp-color" data-color="${c}" title="칸 색: ${l}" tabindex="-1">${c ? '' : '색 없음'}</button>`).join('')}<input type="color" class="tp-pick" data-tpfmt="bg" title="칸 색 직접 고르기" tabindex="-1">
        <button type="button" class="btn btn-sm" data-act="tp-merge" tabindex="-1" title="오전·오후를 한 칸으로 합치거나 나눠요">⇕ 오전·오후 합치기/나누기</button>
        <button type="button" class="btn btn-sm" data-act="tp-undo" tabindex="-1">↶ 되돌리기</button>
        <details class="at-keys tp-keys"><summary>⌨️ 엑셀처럼 쓰기</summary><div class="sub">칸을 누르고 바로 글자를 치면 새로 써져요. <kbd>Enter</kbd> 저장 후 아래로, <kbd>Alt</kbd>+<kbd>Enter</kbd> 칸 안에서 줄 바꿈, <kbd>Tab</kbd> 오른쪽으로, <kbd>←↑→↓</kbd> 이동, <kbd>F2</kbd>·두 번 누르기 = 있던 글 고치기, <kbd>Delete</kbd> 지우기, <kbd>Shift</kbd>+방향키·끌기 = 여러 칸, <kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd> 복사·붙여넣기(엑셀에서 복사한 칸도 됨), <kbd>Ctrl</kbd>+<kbd>Z</kbd> 되돌리기.
          칸의 첫 줄이 "직업탐색훈련 / 작업훈련"처럼 훈련 이름이면 훈련 구분(밑줄)으로 들어가요. 날짜 칸에 글자를 치면 "(건강관리)" 같은 표시가 붙어요.</div></details>
      </div>
      <div class="tp-wrap" id="tpWrap"><textarea class="tp-ed" id="tpEd" spellcheck="false" aria-label="일정표 칸 입력"></textarea>${grid(m)}<div class="tp-ddlist" id="tpDD" hidden></div></div>
      <div class="tp-notes"><label>아래 안내 문구 <span class="sub">(한 줄에 하나, 인쇄할 때 표 아래에 나와요)</span><textarea class="textarea" id="tpNotes" rows="3" placeholder="※복지관 상황에 따라 일정이 변동될 수 있습니다.">${e(notesOf(m))}</textarea></label>
        <div class="inline"><button class="btn btn-sm" type="button" data-act="tp-notes-save">안내 저장</button>${n ? `<button class="btn btn-sm btn-danger-ghost" type="button" data-act="tp-clear">${+m.slice(5)}월 일정표 비우기 (${n}칸)</button>` : ''}</div></div>
    </section>`;
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
    if (rec.cat || rec.content) S.putMany('tp', [{ ...(keep ? { id: keep.id } : {}), ...rec, cls: ui.cls, slot: full ? '종일' : (slot === '종일' ? '오전' : slot) }]);
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
    S.putMany('tp', [{ ...(x ? { id: x.id } : {}), date, slot: '라벨', cat: '', content: text, color: '', cls: ui.cls }]);
  }
  function saveNotes(text) {
    const m = ui.month, x = at(m, 1, '안내');
    if (!text.trim()) { if (x) S.removeMany('tp', [x.id]); return; }
    S.putMany('tp', [{ ...(x ? { id: x.id } : {}), date: `${m}-01`, slot: '안내', cat: '', content: text.trim(), color: '', cls: ui.cls }]);
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
        recs.push({ date: `${m}-${U.pad(d)}`, slot, cat, content, color: '', cls: ui.cls });
      });
    }
    if (recs.length) S.putMany('tp', recs);
    return { n: recs.length, from: pm };
  }

  /* ---------- 엑셀처럼 표에서 바로 입력 ---------- */
  // 행 번호 R: 주마다 3줄 (날짜 · 오전 · 오후), 열 c: 0~4 (월~금)
  const G = { sel: null, anc: null, editing: false, down: false, active: false, undo: [] };
  const CAT_RE = /^\s*[가-힣+·]+(훈련|교육)(\s*\/\s*[가-힣+·]+(훈련|교육))*\s*$/;
  function cellInfo(R, c, m = ui.month) {
    const wk = weeks(m)[Math.floor(R / 3)]; if (!wk) return null;
    const d = wk[c]; if (!d) return null;
    const row = R % 3;
    if (row === 0) return { d, slot: '라벨', date: `${m}-${U.pad(d)}` };
    const full = at(m, d, '종일');
    return { d, slot: full ? '종일' : SLOTS[row - 1], date: `${m}-${U.pad(d)}`, full: !!full };
  }
  const textOf = x => (x ? [x.cat, x.content].filter(Boolean).join('\n') : '');
  const tdAt = (R, c) => document.querySelector(`#tpWrap [data-r="${R}"][data-c="${c}"]`) || document.querySelector(`#tpWrap [data-r2="${R}"][data-c="${c}"]`);
  function rangeCells() {
    if (!G.sel) return [];
    const a = G.anc || G.sel, b = G.sel, out = [];
    for (let R = Math.min(a.R, b.R); R <= Math.max(a.R, b.R); R++) for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) if (cellInfo(R, c)) out.push({ R, c });
    return out;
  }
  function paint() {
    document.querySelectorAll('#tpWrap .sel, #tpWrap .cur').forEach(x => x.classList.remove('sel', 'cur'));
    if (!G.sel) return;
    rangeCells().forEach(({ R, c }) => tdAt(R, c)?.classList.add('sel'));
    tdAt(G.sel.R, G.sel.c)?.classList.add('cur');
    place(); syncRibbon(); closeDD();
  }
  function place() {
    const ed = document.getElementById('tpEd'), wrap = document.getElementById('tpWrap'), td = G.sel && tdAt(G.sel.R, G.sel.c);
    if (!ed || !wrap || !td) { if (ed) ed.style.display = 'none'; return; }
    const tr = td.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    Object.assign(ed.style, { display: 'block', left: `${tr.left - wr.left + wrap.scrollLeft}px`, top: `${tr.top - wr.top + wrap.scrollTop}px`, width: `${tr.width}px`, height: `${G.editing ? Math.max(tr.height, 90) : tr.height}px` });
    ed.classList.toggle('editing', G.editing);
  }
  const focusEd = () => { const ed = document.getElementById('tpEd'); if (ed && document.activeElement !== ed) ed.focus({ preventScroll: true }); };
  function select(R, c, extend) {
    const maxR = weeks(ui.month).length * 3 - 1;
    R = Math.max(0, Math.min(maxR, R)); c = Math.max(0, Math.min(4, c));
    if (!extend) G.anc = null; else if (!G.anc) G.anc = G.sel;
    G.sel = { R, c }; G.active = true;
    paint(); tdAt(R, c)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); focusEd();
  }
  /** 다음 칸으로 (날짜 없는 칸·합쳐진 칸은 건너뜀) */
  function move(dR, dc, extend) {
    if (!G.sel) return select(1, 0);
    let { R, c } = G.sel;
    const info = cellInfo(R, c);
    if (dR > 0 && info && info.full && R % 3 === 1) R++; // 합쳐진 칸 아래로
    if (dR < 0 && info && info.full && R % 3 === 2) R--;
    const maxR = weeks(ui.month).length * 3 - 1;
    for (let i = 0; i < 40; i++) { R += dR; c += dc; if (R < 0 || R > maxR || c < 0 || c > 4) return; if (cellInfo(R, c)) break; }
    const ni = cellInfo(R, c);
    if (ni && ni.full && R % 3 === 2) R--; // 합쳐진 칸은 위쪽 칸으로
    select(R, c, extend);
  }
  /** 한 칸에 글 넣기: 날짜 칸은 표시, 나머지는 훈련 구분 + 내용 */
  function recFor(R, c, text) {
    const info = cellInfo(R, c); if (!info) return null;
    const m = ui.month;
    const old = at(m, info.d, info.slot);
    const t = String(text ?? '').replace(/\r/g, '').replace(/\s+$/, '');
    if (info.slot === '라벨') return { old, rec: t ? { date: info.date, slot: '라벨', cat: '', content: t.replace(/^\(|\)$/g, ''), color: '', cls: ui.cls } : null };
    if (!t.trim()) return { old, rec: old && fmtOf(old).chk ? { ...old, cat: '', content: '' } : null };
    const lines = t.split('\n');
    const isCat = lines.length > 1 && CAT_RE.test(lines[0]);
    return { old, rec: { date: info.date, slot: info.slot, cat: isCat ? lines[0].trim() : '', content: (isCat ? lines.slice(1) : lines).join('\n').trim(), color: old ? old.color || '' : '', fmt: old ? old.fmt || null : null, cls: ui.cls } };
  }
  /** 여러 칸 저장 + 되돌리기 기록 */
  function apply(list) {
    const put = [], drop = [], before = [];
    list.forEach(({ old, rec }) => {
      if (old) before.push({ ...old });
      if (rec) put.push({ ...(old ? { id: old.id } : {}), ...rec });
      else if (old) drop.push(old.id);
    });
    if (!put.length && !drop.length) return;
    const created = put.filter(p => !p.id).map(p => (p.id = U.uid('R'), p.id));
    G.undo.push({ before, created });
    if (G.undo.length > 50) G.undo.shift();
    if (drop.length) S.removeMany('tp', drop);
    if (put.length) S.putMany('tp', put);
  }
  function undo(toast) {
    const u = G.undo.pop(); if (!u) return toast && toast('되돌릴 것이 없어요.');
    if (u.created.length) S.removeMany('tp', u.created);
    if (u.before.length) S.putMany('tp', u.before);
  }
  function commitEdit(dR, dc) {
    const ed = document.getElementById('tpEd'); if (!ed || !G.sel) return;
    if (G.editing) {
      const txt = ed.value; G.editing = false; ed.value = '';
      const cells = rangeCells().length > 1 ? rangeCells() : [G.sel];
      apply(cells.map(({ R, c }) => recFor(R, c, txt)).filter(Boolean));
    }
    if (dR || dc) move(dR, dc); else place();
  }
  function startEdit(withValue) {
    const ed = document.getElementById('tpEd'); if (!ed || !G.sel) return;
    const info = cellInfo(G.sel.R, G.sel.c); if (!info) return;
    G.editing = true;
    if (withValue) { const x = at(ui.month, info.d, info.slot); ed.value = info.slot === '라벨' ? (x ? x.content : '') : textOf(x); ed.setSelectionRange(ed.value.length, ed.value.length); }
    place();
  }
  /** 엑셀 복사 형식(TSV, 줄 바꿈 있는 칸은 "따옴표") 읽기·쓰기 */
  function parseTsv(t) {
    const rows = [[]]; let cur = '', q = false;
    t = String(t).replace(/\r\n?/g, '\n');
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
      if (ch === '"' && cur === '') q = true;
      else if (ch === '\t') { rows[rows.length - 1].push(cur); cur = ''; }
      else if (ch === '\n') { rows[rows.length - 1].push(cur); cur = ''; rows.push([]); }
      else cur += ch;
    }
    rows[rows.length - 1].push(cur);
    if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
    return rows;
  }
  const tsvCell = v => (/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  function copySel() {
    const cells = rangeCells(); if (!cells.length) return '';
    const Rs = [...new Set(cells.map(x => x.R))].sort((a, b) => a - b), cs = [...new Set(cells.map(x => x.c))].sort((a, b) => a - b);
    return Rs.map(R => cs.map(c => { const i = cellInfo(R, c); if (!i) return ''; const x = at(ui.month, i.d, i.slot); return tsvCell(i.slot === '라벨' ? (x ? x.content : '') : textOf(x)); }).join('\t')).join('\n');
  }
  function paste(text) {
    if (!G.sel) return;
    const rows = parseTsv(text);
    const list = [];
    let R = G.sel.R;
    rows.forEach(cols => {
      cols.forEach((v, j) => { const r = recFor(R, G.sel.c + j, v); if (r) list.push(r); });
      // 다음 줄: 합쳐진 칸은 한 줄로 친다
      const i = cellInfo(R, G.sel.c); R += i && i.full && R % 3 === 1 ? 2 : 1;
    });
    apply(list);
  }
  function setColor(color) {
    const list = rangeCells().map(({ R, c }) => { const i = cellInfo(R, c); if (!i || i.slot === '라벨') return null; const old = at(ui.month, i.d, i.slot); return old ? { old, rec: { ...old, color } } : null; }).filter(Boolean);
    apply(list);
  }
  /** 고른 칸 서식 바꾸기. 빈 칸에도 서식을 걸 수 있다 (나중에 글을 치면 그 서식으로) */
  function setFmt(patch, toggleKey) {
    const cells = rangeCells().map(({ R, c }) => ({ R, c, i: cellInfo(R, c) })).filter(x => x.i && x.i.slot !== '라벨');
    if (!cells.length) return;
    const all = toggleKey ? cells.every(x => fmtOf(at(ui.month, x.i.d, x.i.slot))[toggleKey]) : false;
    apply(cells.map(({ i }) => {
      const old = at(ui.month, i.d, i.slot);
      const f = { ...fmtOf(old), ...(toggleKey ? { [toggleKey]: !all } : patch) };
      Object.keys(f).forEach(k => { if (f[k] === '' || f[k] == null || f[k] === false) delete f[k]; });
      const base = old ? { ...old } : { date: i.date, slot: i.slot, cat: '', content: '', color: '', cls: ui.cls };
      return { old, rec: { ...base, fmt: Object.keys(f).length ? f : null } };
    }));
  }
  function clearFmt() { setFmt({ font: '', size: '', b: false, i: false, u: false, fc: '', al: '' }); }
  function toggleCheck(R, c) {
    const i = cellInfo(R, c); if (!i) return;
    const old = at(ui.month, i.d, i.slot); if (!old) return;
    const f = { ...fmtOf(old), on: !fmtOf(old).on };
    apply([{ old, rec: { ...old, fmt: f } }]);
  }
  function setCat(cat) {
    const list = rangeCells().map(({ R, c }) => { const i = cellInfo(R, c); if (!i || i.slot === '라벨') return null; const old = at(ui.month, i.d, i.slot); const base = old ? { ...old } : { date: i.date, slot: i.slot, cat: '', content: '', color: '', cls: ui.cls }; return { old, rec: { ...base, cat: cat === '-' ? '' : cat } }; }).filter(Boolean);
    apply(list);
  }
  /** 칸 오른쪽 아래 ▾ : 훈련 구분 목록 */
  function openDD(R, c) {
    const dd = document.getElementById('tpDD'), wrap = document.getElementById('tpWrap'), td = tdAt(R, c);
    if (!dd || !td) return;
    G.sel = { R, c }; G.anc = null; paint();
    const tr = td.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    dd.innerHTML = catList().map(v => `<button type="button" data-act="tp-dd-pick" data-v="${e(v)}">${e(v)}</button>`).join('') + '<button type="button" class="clr" data-act="tp-dd-pick" data-v="-">훈련 구분 지우기</button>';
    Object.assign(dd.style, { left: `${tr.left - wr.left + wrap.scrollLeft}px`, top: `${tr.bottom - wr.top + wrap.scrollTop}px`, minWidth: `${tr.width}px` });
    dd.hidden = false;
  }
  const closeDD = () => { const dd = document.getElementById('tpDD'); if (dd) dd.hidden = true; };
  /** 지금 칸의 서식을 도구 막대에 보여 준다 */
  function syncRibbon() {
    const i = G.sel && cellInfo(G.sel.R, G.sel.c); const x = i && at(ui.month, i.d, i.slot); const f = fmtOf(x);
    document.querySelectorAll('.tp-ribbon [data-act="tp-fmt"]').forEach(b => b.classList.toggle('on', !!f[b.dataset.k]));
    document.querySelectorAll('.tp-ribbon [data-act="tp-align"]').forEach(b => b.classList.toggle('on', (f.al || '') === b.dataset.al));
    document.querySelector('.tp-ribbon [data-act="tp-chkbox"]')?.classList.toggle('on', !!f.chk);
    const fs = document.getElementById('tpFont'), sz = document.getElementById('tpSize'), cs = document.getElementById('tpCatSel');
    if (fs) fs.value = f.font || ''; if (sz) sz.value = f.size || ''; if (cs) cs.value = '';
  }
  /** 오전·오후 합치기/나누기: 합치면 두 칸 글을 이어 붙이고, 나누면 오전 칸으로 옮긴다 */
  function toggleMerge() {
    const m = ui.month, list = [];
    const days = [...new Set(rangeCells().map(({ R, c }) => { const i = cellInfo(R, c); return i && i.slot !== '라벨' ? i.d : null; }).filter(Boolean))];
    days.forEach(d => {
      const date = `${m}-${U.pad(d)}`;
      const full = at(m, d, '종일'), am = at(m, d, '오전'), pm = at(m, d, '오후');
      if (full) {
        list.push({ old: full, rec: null });
        list.push({ old: null, rec: { date, slot: '오전', cat: full.cat || '', content: full.content || '', color: full.color || '', cls: ui.cls } });
      } else {
        const lines = [textOf(am), textOf(pm)].filter(Boolean).join('\n').split('\n');
        const isCat = lines.length > 1 && CAT_RE.test(lines[0]);
        if (am) list.push({ old: am, rec: null });
        if (pm) list.push({ old: pm, rec: null });
        list.push({ old: null, rec: { date, slot: '종일', cat: isCat ? lines[0].trim() : '', content: (isCat ? lines.slice(1) : lines).join('\n').trim(), color: (am && am.color) || (pm && pm.color) || 'EEECE1', cls: ui.cls } });
      }
    });
    apply(list);
    if (G.sel && G.sel.R % 3 === 2) G.sel.R--;
  }
  function onKey(ev) {
    const ed = ev.target, k = ev.key, ctrl = ev.ctrlKey || ev.metaKey;
    if (ev.isComposing || ev.keyCode === 229) { if (k === 'Enter' && !ev.altKey) setTimeout(() => commitEdit(1, 0), 0); return; }
    if (ctrl && (k === 'z' || k === 'Z')) { ev.preventDefault(); undo(toastFn); return; }
    if (ctrl && !G.editing && ['b', 'i', 'u', 'B', 'I', 'U'].includes(k)) { ev.preventDefault(); setFmt(null, k.toLowerCase()); return; }
    if (ev.altKey && k === 'ArrowDown' && !G.editing) { ev.preventDefault(); openDD(G.sel.R, G.sel.c); return; }
    if (ctrl && (k === 'c' || k === 'C') && !G.editing) { ev.preventDefault(); const t = copySel(); navigator.clipboard?.writeText(t).catch(() => {}); ed.value = t; ed.select(); setTimeout(() => { ed.value = ''; }, 0); return; }
    if (ctrl) return;
    if (k === 'Enter' && ev.altKey) { ev.preventDefault(); if (!G.editing) startEdit(true); const p = ed.selectionStart; ed.value = ed.value.slice(0, p) + '\n' + ed.value.slice(ed.selectionEnd); ed.setSelectionRange(p + 1, p + 1); return; }
    if (k === 'Enter') { ev.preventDefault(); if (G.editing) commitEdit(ev.shiftKey ? -1 : 1, 0); else move(ev.shiftKey ? -1 : 1, 0); return; }
    if (k === 'Tab') { ev.preventDefault(); if (G.editing) commitEdit(0, ev.shiftKey ? -1 : 1); else move(0, ev.shiftKey ? -1 : 1); return; }
    if (k === 'Escape') { ed.value = ''; G.editing = false; place(); return; }
    if (k === 'F2') { ev.preventDefault(); startEdit(true); return; }
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k] && !G.editing) { ev.preventDefault(); move(...arrows[k], ev.shiftKey); return; }
    if ((k === 'Delete' || k === 'Backspace') && !G.editing) { ev.preventDefault(); apply(rangeCells().map(({ R, c }) => recFor(R, c, '')).filter(Boolean)); }
  }
  let toastFn = null;
  function bindGrid(toast) {
    toastFn = toast;
    const wrap = document.getElementById('tpWrap'), ed = document.getElementById('tpEd');
    if (!wrap || !ed) return;
    wrap.addEventListener('pointerdown', ev => {
      const td = ev.target.closest('[data-r][data-c]'); if (!td || ev.button !== 0 || ev.target === ed) return;
      ev.preventDefault();
      if (G.editing) commitEdit(0, 0);
      G.down = true; select(+td.dataset.r, +td.dataset.c, ev.shiftKey);
    });
    wrap.addEventListener('pointerover', ev => { if (!G.down || !(ev.buttons & 1)) { G.down = false; return; } const td = ev.target.closest('[data-r][data-c]'); if (td && G.sel && (+td.dataset.r !== G.sel.R || +td.dataset.c !== G.sel.c)) { if (!G.anc) G.anc = G.sel; G.sel = { R: +td.dataset.r, c: +td.dataset.c }; paint(); } });
    wrap.addEventListener('dblclick', ev => { if (ev.target.closest('[data-r][data-c]')) startEdit(true); });
    ed.addEventListener('keydown', onKey);
    ed.addEventListener('input', () => { if (!G.editing && ed.value) { G.editing = true; place(); } });
    ed.addEventListener('paste', ev => { if (G.editing) return; ev.preventDefault(); paste(ev.clipboardData.getData('text/plain')); });
    ed.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== ed && G.editing) commitEdit(0, 0); }, 0));
    wrap.addEventListener('scroll', place);
    if (G.sel) { paint(); if (G.active) focusEd(); }
  }
  window.addEventListener('pointerdown', ev => { if (!ev.target.closest('#tpWrap, .tp-tools')) { G.active = false; closeDD(); } }, true);
  window.addEventListener('pointerup', () => { if (G.down) { G.down = false; if (G.active) focusEd(); } });
  const resetGrid = () => { G.sel = null; G.anc = null; G.editing = false; G.active = false; };

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
    // 반: 제목(예: 일과놀이반 10월 일정표)·시트·파일 이름에서, 없으면 지금 보고 있는 반
    let cls = '';
    const findCls = t => { const n = String(t || '').replace(/\s/g, ''); const c = CLASSES.find(k => n.includes(k.replace(/\s/g, '')) || (k === 'JOB이음터' && /JOB|이음터/i.test(n))); if (c && !cls) cls = c; };
    for (let r = G.r0; r < head; r++) for (let c = G.c0; c <= G.c1; c++) findCls(G.txt(r, c));
    findCls(hint.sheet); findCls(hint.file);
    if (!cls) cls = ui.cls;
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
        // 첫 줄이 '직업탐색훈련 / 작업훈련'처럼 훈련 이름만으로 되어 있으면 훈련 구분
        const isCat = lines.length > 1 && /^\s*[가-힣+·]+(훈련|교육)(\s*\/\s*[가-힣+·]+(훈련|교육))*\s*$/.test(first);
        const color = (G.fill(tr, tc) || '').toUpperCase();
        out.push({ date: `${m}-${U.pad(info.d)}`, slot: sl, cat: isCat ? first.trim() : '', content: (isCat ? lines.slice(1) : lines).join('\n').trim(), color: color === 'FFFFFF' ? '' : color });
      });
    }
    // 표 아래 안내 문구
    const notes = [];
    for (let r = last + 1; r <= G.r1; r++) for (let c = G.c0; c <= G.c1; c++) { const t = G.txt(r, c); if (t && t.length > 3 && !notes.includes(t)) notes.push(t.replace(/\r/g, '')); }
    if (notes.length) out.push({ date: `${m}-01`, slot: '안내', cat: '', content: notes.join('\n'), color: '' });
    out.forEach(r => { r.cls = cls; });
    return { month: m, cls, recs: out };
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
      <div class="at-imp-list">${g.found.map((x, i) => { const have = plans(x.month, x.cls).filter(p => SLOTS.includes(p.slot) || p.slot === '종일').length; const cells = x.recs.filter(p => SLOTS.includes(p.slot) || p.slot === '종일').length; return `<label class="check"><input type="checkbox" data-act="tp-imp-toggle" data-i="${i}" ${x.on ? 'checked' : ''}><b>${e(x.cls)}</b> ${e(V.monthLabel(x.month))} · ${cells}칸${have ? ` <span class="sub">(지금 ${have}칸 있음)</span>` : ''}</label>`; }).join('')}</div>
      <div class="inline" style="margin-top:6px"><label class="check"><input type="radio" name="tpMerge" value="over" ${g.mode === 'over' ? 'checked' : ''} data-act="tp-imp-mode">같은 칸은 새 파일로 바꾸기</label><label class="check"><input type="radio" name="tpMerge" value="keep" ${g.mode === 'keep' ? 'checked' : ''} data-act="tp-imp-mode">이미 적힌 칸은 그대로 두고 빈 칸만 채우기</label></div>
      <div class="inline" style="margin-top:6px"><button class="btn btn-sm btn-primary" type="button" data-act="tp-imp-commit">합치기</button><button class="btn btn-sm" type="button" data-act="tp-imp-cancel">취소</button></div></div>`;
  }
  function commitImport() {
    const g = ui.imp; let put = [], drop = [], skipped = 0;
    const months = [];
    g.found.filter(x => x.on).forEach(x => {
      months.push(x.month);
      x.recs.forEach(r => {
        const m = r.date.slice(0, 7), d = +r.date.slice(8), c = r.cls;
        const same = at(m, d, r.slot, c);
        const clash = r.slot === '종일' ? [at(m, d, '오전', c), at(m, d, '오후', c)].filter(Boolean) : SLOTS.includes(r.slot) ? [at(m, d, '종일', c)].filter(Boolean) : [];
        if (g.mode === 'keep' && (same || clash.length)) { skipped++; return; }
        clash.forEach(c => drop.push(c.id));
        put.push({ ...(same ? { id: same.id } : {}), ...r, src: g.files.join(', ') });
      });
    });
    if (drop.length) S.removeMany('tp', drop);
    if (put.length) S.putMany('tp', put);
    if (months.length) ui.month = months.sort()[months.length - 1];
    const lastCls = g.found.filter(x => x.on).map(x => x.cls).pop(); if (lastCls) ui.cls = lastCls;
    ui.imp = null;
    return { put: put.length, skipped, months };
  }

  /** 인쇄: A4 가로 한 장, 엑셀 양식과 같은 모양 */
  function doc(m = ui.month, cls = ui.cls, scale = 1) {
    const keep = ui.cls; ui.cls = cls;
    try {
    const notes = notesOf(m).split('\n').filter(Boolean);
    const names = staffNames();
    return `<article class="doc tp-doc" style="--tps:${scale}">
      <h1>${e(cls)} ${+m.slice(5)}월 일정표</h1>
      ${grid(m, true)}
      <div class="tp-doc-notes">${notes.map(n => `<div>${e(n)}</div>`).join('')}${names.length && !notes.some(n => /담당/.test(n)) ? `<div class="r">담당: 직업지원팀 ${names.map(e).join(', ')}</div>` : ''}</div>
    </article>`;
    } finally { ui.cls = keep; }
  }

  /* ---------- 업무 일정 불러오기 (엑셀·한글 표: 날짜·시간·제목/내용·유형·담당·메모) ---------- */
  const EV_HEAD = { date: /^(날짜|일자|일시|일정일|월일)$/, time: /^(시간|시각)$/, title: /^(제목|일정|내용|일정내용|업무|업무내용|행사명|프로그램)$/, type: /^(유형|구분|종류)$/, staff: /^(담당|담당자|담당직원|성명|직원)$/, memo: /^(메모|비고|장소)$/ };
  function eventsFromRows(rows, year) {
    const out = [];
    for (let h = 0; h < Math.min(rows.length, 15); h++) {
      const head = (rows[h] || []).map(c => String(c ?? '').replace(/\s/g, ''));
      const col = {};
      head.forEach((t, i) => Object.entries(EV_HEAD).forEach(([k, re]) => { if (col[k] == null && re.test(t)) col[k] = i; }));
      if (col.date == null || col.title == null) continue;
      for (let r = h + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const raw = row[col.date];
        let date = '';
        if (typeof raw === 'number' && raw > 30000) { const d = new Date(Math.round((raw - 25569) * 864e5)); const y = d.getUTCFullYear() < 2015 ? year : d.getUTCFullYear(); date = `${y}-${U.pad(d.getUTCMonth() + 1)}-${U.pad(d.getUTCDate())}`; }
        else { const t = String(raw ?? ''); const k = t.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/) || t.match(/^\s*(\d{1,2})[.\-/월\s]+(\d{1,2})/); if (k) date = k.length === 4 ? `${k[1]}-${U.pad(+k[2])}-${U.pad(+k[3])}` : `${year}-${U.pad(+k[1])}-${U.pad(+k[2])}`; }
        const title = String(row[col.title] ?? '').replace(/\s+/g, ' ').trim();
        if (!date || !title) continue;
        const tm = String(row[col.time] ?? '').match(/(\d{1,2})[:시]?\s*(\d{2})?/);
        const staff = String(row[col.staff] ?? '').trim();
        out.push({ date, time: tm ? `${U.pad(+tm[1])}:${tm[2] || '00'}` : '', title, type: D.EVENT_TYPES.find(t => String(row[col.type] ?? '').includes(t)) || '기타', staff: S.staff().some(s => s.name === staff) ? staff : '', memo: String(row[col.memo] ?? '').trim(), targetType: '', targetId: '' });
      }
      break;
    }
    return out;
  }
  function eventsFromWorkbook(wb, file) {
    const year = +((String(file).match(/(20\d{2})/) || [])[1] || U.today().slice(0, 4));
    return wb.SheetNames.flatMap(n => eventsFromRows(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }), year));
  }
  const eventsFromHwp = (tables, file) => { const year = +((String(file).match(/(20\d{2})/) || [])[1] || U.today().slice(0, 4)); return tables.flatMap(t => eventsFromRows(t.rows, year)); };

  return { ui, setFmt, clearFmt, toggleCheck, setCat, openDD, closeDD, bindGrid, resetGrid, setColor, toggleMerge, undo: t => undo(t), CLASSES, eventsFromWorkbook, eventsFromHwp, view, doc, save, remove, setLabel, saveNotes, clearMonth, copyPrev, fromWorkbook, fromHwpTables, commitImport, plans, at };
})();
