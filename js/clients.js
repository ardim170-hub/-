/* 이용자 관리 (현장중심): 복지관 시트 '이용자입력'에서 이용자를 골라 등록하고,
 * 과정도(초기면접 → 직업상담 → 사례회의 → 직업재활계획서 → 현장훈련 대기 → 취업 대기)에서 지금 어디까지 왔는지 관리한다.
 * 우리 시트에는 이용자번호·이름·단계·직업욕구·메모만 두고, 성별·나이·장애정보는 복지관 시트에서 그때그때 불러온다 */
window.CL = (() => {
  const e = U.esc;
  const ui = { q: '', view: 'board', find: '', found: null, finding: false, info: {}, infoAsked: new Set() };
  const STAGES = D.CLIENT_STAGES;
  const list = () => (S.view().clients || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const stageIdx = c => Math.max(0, STAGES.indexOf(c.stage));
  const stageDate = (c, st) => ((c.stages || {})[st] || '');
  /** 복지관 시트에서 기본 정보(성별·나이·장애유형 등) 불러오기: 화면에 보이는 사람만, 한 번씩 */
  function loadInfo(nos, done) {
    const want = nos.filter(n => n && !ui.infoAsked.has(n));
    if (!want.length || !S.REMOTE) return;
    want.forEach(n => ui.infoAsked.add(n));
    S.call('api_orgUserInfo', { nos: want, sheet: S.get().settings.orgPerfSheet || '' }).then(r => { Object.assign(ui.info, r || {}); done && done(); }).catch(() => {});
  }
  const infoLine = c => {
    const i = ui.info[c.no];
    if (!c.no) return '<span class="sub">이용자입력에 없음</span>';
    if (!i) return S.REMOTE ? '<span class="sub">기본 정보 불러오는 중…</span>' : '';
    return [i.sex, i.age && `${i.age}세`, i.type, i.grade && i.grade.replace('장애의 정도가 ', '').replace(' 장애인', ''), i.town].filter(Boolean).map(e).join(' · ');
  };
  /** 이 사람 이름으로 넣은 실적 (실적 화면에서 참여자로 적은 것) */
  const perfsOf = c => [...S.get().perfs.filter(p => S.pplOf(p).includes(c.name)).map(p => ({ d: p.date, item: p.item, staff: p.staff })),
    ...S.get().activities.filter(a => a.fromPerf === 'Y' && S.pplOf(a).includes(c.name)).map(a => ({ d: a.date, item: a.perf, staff: a.staff }))].sort((a, b) => b.d.localeCompare(a.d));

  function page() {
    const all = list(), q = ui.q.trim();
    const rows = all.filter(c => !q || U.match(q, c.name, c.no, c.job, c.memo));
    const counts = STAGES.map(st => rows.filter(c => c.stage === st).length);
    const board = `<div class="cl-board">${STAGES.map((st, k) => `<section class="cl-col"><h3>${k + 1}. ${e(st)} <span class="n">${counts[k]}</span></h3>
        ${rows.filter(c => c.stage === st).map(card).join('') || '<p class="sub cl-none">없음</p>'}</section>`).join('')}</div>`;
    const table = `<div class="table-wrap"><table class="tbl cl-tbl"><thead><tr><th>이름</th><th>이용자번호</th><th>기본 정보</th><th>현재 단계</th><th>희망 직종</th><th>담당</th></tr></thead><tbody>
      ${rows.map(c => `<tr data-act="cl-open" data-id="${c.id}" class="click"><td><b>${e(c.name)}</b></td><td class="num">${e(c.no || '-')}</td><td>${infoLine(c)}</td><td>${stageBadge(c)}</td><td>${e(c.job || '')}</td><td>${e(c.staff || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="sub">아직 등록한 이용자가 없어요.</td></tr>'}</tbody></table></div>`;
    return `<div class="page-head"><div><h1 class="page-title">이용자</h1><div class="page-desc">복지관 이용자 명단에서 이용자를 골라 등록하고, 과정도에서 지금 어디까지 진행됐는지 관리해요. 성별·나이·장애정보는 복지관 시트에서 그때그때 불러와요.</div></div></div>
      <section class="panel panel-pad cl-add">
        <h2 class="section-title">+ 이용자 추가 <span class="sub">복지관 시트 '이용자입력'에서 찾아요</span></h2>
        <form class="inline" data-form="cl-find" autocomplete="off"><input class="input" id="clFind" value="${e(ui.find)}" placeholder="이름 또는 이용자번호 (예: 홍길동, 2026-00012)" style="max-width:320px"><button class="btn btn-primary" type="submit" ${ui.finding ? 'disabled' : ''}>${ui.finding ? '찾는 중…' : '찾기'}</button></form>
        ${foundHtml()}
      </section>
      <div class="toolbar"><input class="input" id="clQ" value="${e(ui.q)}" placeholder="등록한 이용자 찾기 (이름·번호·희망 직종)" style="max-width:320px">
        <div class="seg"><button type="button" class="${ui.view === 'board' ? 'on' : ''}" data-act="cl-view" data-v="board">과정도 보기</button><button type="button" class="${ui.view === 'table' ? 'on' : ''}" data-act="cl-view" data-v="table">목록 보기</button></div>
        <span class="sub">${rows.length}명</span></div>
      ${ui.view === 'table' ? table : board}`;
  }
  const stageBadge = c => `<span class="cl-stage s${stageIdx(c)}">${stageIdx(c) + 1}. ${e(c.stage || STAGES[0])}</span>`;
  const card = c => `<button type="button" class="cl-card" data-act="cl-open" data-id="${c.id}"><b>${e(c.name)}</b> <span class="sub num">${e(c.no || '')}</span>
      <span class="cl-card-i">${infoLine(c)}</span>${c.job ? `<span class="cl-card-j">희망: ${e(c.job)}</span>` : ''}
      <span class="cl-dots">${STAGES.map((st, k) => `<i class="${k <= stageIdx(c) ? 'on' : ''}" title="${e(st)} ${e(stageDate(c, st))}"></i>`).join('')}</span><span class="sub">${e(stageDate(c, c.stage))}${c.staff ? ' · ' + e(c.staff) : ''}</span></button>`;
  function foundHtml() {
    if (!ui.found) return S.REMOTE ? '<div class="inline" style="margin-top:6px"><button class="btn btn-sm btn-ghost" type="button" data-act="cl-add-manual">이용자입력에 없는 사람으로 추가</button></div>' : '<p class="sub">팀 공유 사이트(구글 시트 연결)에서 복지관 이용자 명단을 찾을 수 있어요. 여기서는 이름만 적어 추가할 수 있어요.</p><div class="inline"><button class="btn btn-sm" type="button" data-act="cl-add-manual">이름만으로 추가</button></div>';
    const have = new Set(S.get().clients.map(c => c.no).filter(Boolean));
    return `<div class="cl-found">${ui.found.length ? ui.found.map((u, i) => `<div class="cl-found-row"><b>${e(u.name)}</b> <span class="num sub">${e(u.no)}</span>
        <span class="sub">${[u.sex, u.age && u.age + '세', u.type, u.grade, u.town].filter(Boolean).map(e).join(' · ')}</span>
        ${have.has(u.no) ? '<span class="badge">이미 등록됨</span>' : `<button class="btn btn-sm btn-primary" type="button" data-act="cl-add" data-i="${i}">추가</button>`}</div>`).join('')
      : `<p class="sub">'${e(ui.find)}'을(를) 이용자입력에서 찾지 못했어요. 이름을 확인하거나, 복지관 시트에 먼저 등록해 주세요.</p>`}
      <div class="inline" style="margin-top:6px"><button class="btn btn-sm" type="button" data-act="cl-add-manual">이용자입력에 없는 사람으로 추가</button></div></div>`;
  }

  /** 상세 (오른쪽 창) */
  function detailHtml(c) {
    const i = ui.info[c.no] || {}, k = stageIdx(c), ps = perfsOf(c);
    const staff = S.staffHere().map(s => s.name);
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">${e(c.name)} <span class="sub num">${e(c.no || '')}</span></h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div>
      <p class="sub" style="margin:0">${c.no ? (ui.info[c.no] ? [i.sex, i.birth && `${i.birth} (${i.age}세)`, i.type, i.grade, [i.city, i.town].filter(Boolean).join(' '), i.income].filter(Boolean).map(e).join(' · ') : '기본 정보 불러오는 중…') : '이용자입력에 없는 사람이에요.'}</p></div>
      <div class="dr-body">
        <h3 class="dp-dr-h">과정도 <span class="sub">단계를 누르면 지금 단계가 바뀌고 그날 날짜가 남아요</span></h3>
        <ol class="cl-steps">${STAGES.map((st, j) => `<li class="${j < k ? 'done' : j === k ? 'cur' : ''}"><button type="button" data-act="cl-stage" data-id="${c.id}" data-stage="${e(st)}"><b>${j + 1}</b><span>${e(st)}</span></button>
          <input class="input sm" type="date" data-cl-date="${e(st)}" data-id="${c.id}" value="${e(stageDate(c, st))}" aria-label="${e(st)} 날짜"></li>`).join('')}</ol>
        <form id="clForm" data-id="${c.id}" autocomplete="off">
          <h3 class="dp-dr-h">직업욕구</h3>
          <div class="cl-needs">${D.CLIENT_NEEDS.map(([key, l]) => `<label>${l}<input class="input" name="${key}" value="${e(c[key] || '')}"></label>`).join('')}</div>
          <label class="cl-memo">메모<textarea class="textarea" name="memo" rows="3">${e(c.memo || '')}</textarea></label>
          <label>담당<select class="select" name="staff"><option value="">-</option>${[...new Set([...staff, c.staff].filter(Boolean))].map(n => `<option ${n === c.staff ? 'selected' : ''}>${e(n)}</option>`).join('')}</select></label>
          <div class="inline" style="margin-top:10px"><button class="btn btn-primary" type="button" data-act="cl-save" data-id="${c.id}">저장</button><button class="btn btn-danger-ghost" type="button" data-act="cl-del" data-id="${c.id}">이용자 목록에서 빼기</button></div>
        </form>
        <h3 class="dp-dr-h">이 사람 실적 <span class="sub">실적 화면에서 참여자로 넣은 것 ${ps.length}건</span></h3>
        ${ps.length ? `<table class="tbl"><tbody>${ps.slice(0, 50).map(p => `<tr><td class="num nowrap">${U.dateDot(p.d)}</td><td>${e(p.item)}</td><td class="sub">${e(p.staff || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="sub">아직 없어요. 실적을 넣을 때 참여자 칸에 이 이름을 적으면 여기 모여요.</p>'}
      </div>`;
  }

  /** 단계 바꾸기: 고른 단계가 지금 단계가 되고, 날짜가 비어 있으면 오늘로 */
  function setStage(c, st) {
    const stages = { ...(c.stages || {}) };
    if (!stages[st]) stages[st] = U.today();
    return S.upsert('cl', { id: c.id, stage: st, stages });
  }
  function addFrom(u) {
    return S.upsert('cl', { no: u.no || '', name: u.name, stage: STAGES[0], stages: { [STAGES[0]]: U.today() }, staff: S.me(), job: '', area: '', hours: '', pay: '', move: '', cert: '', memo: '' });
  }
  return { ui, page, detailHtml, loadInfo, setStage, addFrom, list, STAGES };
})();
