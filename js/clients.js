/* 이용자 관리 (현장중심): 복지관 시트 '이용자입력'에서 이용자를 골라 등록하고,
 * 과정도(대기자 → 초기면접 → 직업상담 → 사례회의 → 직업재활계획서 → 현장훈련 → 취업알선 → 취업)에서 지금 어디까지 왔는지 관리한다.
 * 현장훈련·취업알선·취업은 사업체와 연결하고(예: 문○○ - ○○병원 (취업)), 퇴사·중단하면 대기자로 돌아가며 지난 기록(log)은 남긴다.
 * 우리 시트에는 이용자번호·이름·단계·직업욕구·메모만 두고, 성별·나이·장애정보는 복지관 시트에서 그때그때 불러온다 */
window.CL = (() => {
  const e = U.esc;
  const ui = { q: '', view: 'board', find: '', found: null, finding: false, info: {}, infoAsked: new Set(), pick: null };
  const STAGES = D.CLIENT_STAGES, BIZ = D.CLIENT_BIZ_STAGES;
  // 예전 단계 이름 → 새 이름
  const OLD = { '현장훈련 대기': '현장훈련', '취업 대기': '취업알선' };
  const stageOf = c => { const st = OLD[c.stage] || c.stage; return STAGES.includes(st) ? st : STAGES[0]; };
  const list = () => (S.view().clients || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const stageIdx = c => STAGES.indexOf(stageOf(c));
  const stageDate = (c, st) => { const m = c.stages || {}; return m[st] || m[Object.keys(OLD).find(k => OLD[k] === st)] || ''; };
  const logOf = c => (Array.isArray(c.log) ? c.log : []);
  /** 전에 취업·훈련했다가 그만두고 돌아온 적이 있나 */
  const ends = c => logOf(c).filter(x => x.ev === 'end');
  const bizLine = c => (c.biz && BIZ.includes(stageOf(c)) ? `${c.biz} (${stageOf(c)})` : '');
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
    const counts = STAGES.map(st => rows.filter(c => stageOf(c) === st).length);
    const board = `<div class="cl-board">${STAGES.map((st, k) => `<section class="cl-col${st === '대기자' ? ' wait' : BIZ.includes(st) ? ' biz' : ''}"><h3>${st === '대기자' ? '' : k + '. '}${e(st)} <span class="n">${counts[k]}</span></h3>
        ${rows.filter(c => stageOf(c) === st).map(card).join('') || '<p class="sub cl-none">없음</p>'}</section>`).join('')}</div>`;
    const table = `<div class="table-wrap"><table class="tbl cl-tbl"><thead><tr><th>이름</th><th>이용자번호</th><th>기본 정보</th><th>현재 단계</th><th>연결 사업체</th><th>희망 직종</th><th>담당</th></tr></thead><tbody>
      ${rows.map(c => `<tr data-act="cl-open" data-id="${c.id}" class="click"><td><b>${e(c.name)}</b>${ends(c).length ? ' <span class="cl-re">재등록</span>' : ''}</td><td class="num">${e(c.no || '-')}</td><td>${infoLine(c)}</td><td>${stageBadge(c)}</td><td>${e(bizLine(c))}</td><td>${e(c.job || '')}</td><td>${e(c.staff || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="sub">아직 등록한 이용자가 없어요.</td></tr>'}</tbody></table></div>`;
    return `<div class="page-head"><div><h1 class="page-title">이용자</h1><div class="page-desc">복지관 이용자 명단에서 이용자를 골라 등록하고, 과정도에서 지금 어디까지 진행됐는지 관리해요. 현장훈련·취업알선·취업은 사업체와 연결하고, 퇴사하면 대기자로 돌아가도 지난 기록이 남아요. 성별·나이·장애정보는 복지관 시트에서 그때그때 불러와요.</div></div></div>
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
  const stageBadge = c => `<span class="cl-stage s${stageIdx(c)}">${stageIdx(c) ? stageIdx(c) + '. ' : ''}${e(stageOf(c))}</span>`;
  const card = c => { const re = ends(c), last = re[re.length - 1];
    return `<button type="button" class="cl-card" data-act="cl-open" data-id="${c.id}"><b>${e(c.name)}${re.length ? ' <span class="cl-re">재등록</span>' : ''}</b> <span class="sub num">${e(c.no || '')}</span>
      <span class="cl-card-i">${infoLine(c)}</span>${bizLine(c) ? `<span class="cl-card-b">🏢 ${e(bizLine(c))}</span>` : ''}${c.job ? `<span class="cl-card-j">희망: ${e(c.job)}</span>` : ''}
      ${last && stageOf(c) === '대기자' ? `<span class="cl-card-j">이전: ${e(last.biz || '')} ${e(last.stage)} → ${U.dateDot(last.d)} ${e(last.note || '종료')}</span>` : ''}
      <span class="cl-dots">${STAGES.slice(1).map((st, k) => `<i class="${k + 1 <= stageIdx(c) ? 'on' : ''}" title="${e(st)} ${e(stageDate(c, st))}"></i>`).join('')}</span><span class="sub">${stageDate(c, stageOf(c)) ? U.dateDot(stageDate(c, stageOf(c))) : ''}${c.staff ? ' · ' + e(c.staff) : ''}</span></button>`; };
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
    const i = ui.info[c.no] || {}, k = stageIdx(c), ps = perfsOf(c), cur = stageOf(c), log = logOf(c);
    const staff = S.staffHere().map(s => s.name);
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">${e(c.name)} <span class="sub num">${e(c.no || '')}</span></h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div>
      <p class="sub" style="margin:0">${c.no ? (ui.info[c.no] ? [i.sex, i.birth && `${i.birth} (${i.age}세)`, i.type, i.grade, [i.city, i.town].filter(Boolean).join(' '), i.income].filter(Boolean).map(e).join(' · ') : '기본 정보 불러오는 중…') : '이용자입력에 없는 사람이에요.'}</p></div>
      <div class="dr-body">
        <h3 class="dp-dr-h">과정도 <span class="sub">단계를 누르면 지금 단계가 바뀌고 그날 날짜가 남아요. 현장훈련·취업알선·취업은 사업체를 골라 연결해요</span></h3>
        ${bizLine(c) ? `<div class="cl-now">🏢 <b>${e(c.biz)}</b> (${e(cur)}) ${stageDate(c, cur) ? `<span class="sub">${U.dateDot(stageDate(c, cur))}부터</span>` : ''}
          <button class="btn btn-sm" type="button" data-act="cl-end" data-id="${c.id}">퇴사·중단 → 대기자로</button></div>` : ''}
        <ol class="cl-steps">${STAGES.map((st, j) => `<li class="${st === '대기자' ? (cur === st ? 'cur wait' : 'wait') : j < k ? 'done' : j === k ? 'cur' : ''}"><button type="button" data-act="cl-stage" data-id="${c.id}" data-stage="${e(st)}"><b>${st === '대기자' ? '⏸' : j}</b><span>${e(st)}${BIZ.includes(st) && cur === st && c.biz ? ` · ${e(c.biz)}` : ''}</span></button>
          <input class="input sm" type="date" data-cl-date="${e(st)}" data-id="${c.id}" value="${e(stageDate(c, st))}" aria-label="${e(st)} 날짜"></li>
          ${ui.pick && ui.pick.id === c.id && ui.pick.stage === st ? pickHtml(c, st) : ''}`).join('')}</ol>
        ${cur !== '대기자' && !bizLine(c) ? `<div class="inline" style="margin-top:8px"><button class="btn btn-sm btn-ghost" type="button" data-act="cl-end" data-id="${c.id}">중단 → 대기자로</button></div>` : ''}
        <h3 class="dp-dr-h">지난 기록 <span class="sub">단계가 바뀔 때마다 남아요${ends(c).length ? ` · 퇴사·중단 ${ends(c).length}번` : ''}</span></h3>
        ${log.length ? `<ul class="cl-log">${log.slice().reverse().map(x => `<li class="${x.ev === 'end' ? 'end' : ''}"><span class="num">${U.dateDot(x.d)}</span> ${x.ev === 'end' ? `<b>퇴사·중단</b> ${e(x.biz ? x.biz + ' ' : '')}${e(x.stage)}${x.note ? ' · ' + e(x.note) : ''} → 대기자` : `${e(x.stage)}${x.biz ? ' · 🏢 ' + e(x.biz) : ''}`}${x.by ? ` <span class="sub">${e(x.by)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="sub">아직 없어요.</p>'}
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

  /** 사업체 고르기 (현장훈련·취업알선·취업): 이름을 쓰면 등록된 사업체에서 찾고, 없으면 쓴 이름 그대로 */
  function pickHtml(c, st) {
    const names = [...new Set(S.get().businesses.filter(b => !S.isPending(b)).map(b => b.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
    const def = BIZ.includes(stageOf(c)) ? c.biz || '' : (logOf(c).filter(x => x.biz).pop() || {}).biz || '';
    return `<li class="cl-pick"><form data-form="cl-biz" data-id="${c.id}" data-stage="${e(st)}" autocomplete="off">
      <label>${e(st)}할 사업체<input class="input" name="biz" list="clBizList" value="${e(st === '취업' || st === '현장훈련' ? def : '')}" placeholder="사업체 이름 (예: 빈센트병원)" required></label>
      <datalist id="clBizList">${names.map(n => `<option value="${e(n)}">`).join('')}</datalist>
      <label>날짜<input class="input" type="date" name="d" value="${U.today()}"></label>
      <div class="inline"><button class="btn btn-sm btn-primary" type="submit">연결</button><button class="btn btn-sm" type="button" data-act="cl-pick-cancel">취소</button></div></form></li>`;
  }
  const logAdd = (c, x) => [...logOf(c), { by: S.me(), ...x }].slice(-200);
  /** 단계 바꾸기: 고른 단계가 지금 단계가 되고, 날짜가 비어 있으면 오늘로. 사업체 단계면 사업체도 함께 */
  function setStage(c, st, biz, d) {
    const stages = { ...(c.stages || {}) };
    const day = d || stages[st] || U.today();
    stages[st] = day;
    const patch = { id: c.id, stage: st, stages, log: logAdd(c, { d: day, stage: st, biz: BIZ.includes(st) ? (biz && biz.name) || '' : '' }) };
    if (BIZ.includes(st)) { patch.biz = (biz && biz.name) || ''; patch.bizId = (biz && biz.id) || ''; }
    else if (st !== '대기자') { patch.biz = ''; patch.bizId = ''; }
    return S.upsert('cl', patch);
  }
  /** 퇴사·중단: 지금 단계·사업체를 지난 기록에 남기고 대기자로. 이번 과정의 단계 날짜는 비운다 */
  function endNow(c, note, d) {
    const day = d || U.today();
    return S.upsert('cl', { id: c.id, stage: '대기자', stages: { '대기자': day }, biz: '', bizId: '', log: logAdd(c, { d: day, ev: 'end', stage: stageOf(c), biz: c.biz || '', note: note || '' }) });
  }
  function addFrom(u) {
    return S.upsert('cl', { no: u.no || '', name: u.name, stage: '초기면접', stages: { '초기면접': U.today() }, log: [{ d: U.today(), stage: '초기면접', by: S.me() }], biz: '', bizId: '', staff: S.me(), job: '', area: '', hours: '', pay: '', move: '', cert: '', memo: '' });
  }
  return { ui, page, detailHtml, loadInfo, setStage, endNow, addFrom, list, stageOf, STAGES, BIZ };
})();
