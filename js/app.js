/* 앱 셸: 라우팅, Drawer, 검색, 액션 처리 */
window.App = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  const NAV = [
    ['dashboard', '대시보드', 'dash'],
    ['biz', '사업체·네트워크', 'biz', () => S.get().businesses.length + S.get().networks.length],
    ['map', '지도', 'map'],
    ['schedule', '일정', 'cal', () => S.get().events.filter(x => !x.done && U.diffDays(U.today(), x.date) <= 7).length || ''],
    ['contacts', '연락이력', 'log'],
    ['perf', '실적', 'perf'],
    ['outreach', '홍보·방문처', 'map', () => S.view().networks.filter(n => OR.isTarget(n)).length || ''],
    ['attend', '출석부', 'att', () => S.get().jobPeople.length],
    ['data', '데이터 관리', 'data'],
  ];
  /* 상단 사업 구역: 고른 구역에 필요한 기능만 왼쪽에 보인다 */
  const SECS = [
    { k: 'field', label: '현장중심', prog: '장애인개발원', items: ['dashboard', 'biz', 'map', 'schedule', 'contacts', 'perf', 'outreach'], desc: '현장중심직업재활센터 (한국장애인개발원) · 사업체 개발·연락·실적·홍보' },
    { k: 'emp', label: '고용공단', prog: '고용공단', items: ['dashboard', 'biz', 'map', 'schedule', 'contacts', 'perf'], desc: '고용지원사업 (한국장애인고용공단) · 사업체·연락·실적' },
    { k: 'jobs', label: '장애인일자리', prog: '장애인일자리', items: ['attend', 'map', 'schedule'], desc: '장애인일자리사업 · 참여자 출석·근무처' },
    { k: 'data', label: '데이터 관리', prog: '', items: ['data'], desc: '직원·계정·권한, 엑셀 백업·가져오기' },
  ];
  const SEC_HINT = {
    dashboard: () => '오늘 할 일·달력', biz: () => `사업체 ${S.view().businesses.length} · 기관 ${S.view().networks.length} · 명함 ${S.view().cards.length}`, map: () => '사업체·기관 위치',
    schedule: () => { const n = S.view().events.filter(x => !x.done && U.diffDays(U.today(), x.date) <= 7 && x.date >= U.today()).length; return n ? `이번 주 ${n}건` : '업무 일정'; },
    contacts: () => '사업체 연락·방문', outreach: () => { const n = S.view().networks.filter(x => OR.isTarget(x)).length; return n ? `${n}곳 · 방문 기록` : '행정복지센터·학교·아파트'; }, perf: () => '월 목표·실적표', attend: () => `참여자 ${S.get().jobPeople.length}명`, data: () => '백업·가져오기·권한',
  };
  const lsGetSec = () => { try { return localStorage.getItem('ardim.sec') || ''; } catch { return ''; } };
  const lsSetSec = v => { try { localStorage.setItem('ardim.sec', v); } catch { /* 저장 못 해도 동작 */ } };
  let secKey = lsGetSec() || 'field';
  /** 지금 구역: 보고 있는 화면이 들어 있는 구역 (지금 구역에 없으면 그 화면이 있는 첫 구역) */
  function curSec() {
    const n = (r => (['biz', 'network', 'cards'].includes(r) ? 'biz' : r))(route());
    const cur = SECS.find(x => x.k === secKey);
    if (cur && cur.items.includes(n)) return cur;
    const hit = SECS.find(x => x.items.includes(n)) || SECS[0];
    secKey = hit.k; lsSetSec(hit.k);
    return hit;
  }
  const MOBILE = [['dashboard', '홈', 'dash'], ['biz', '사업체', 'biz'], ['map', '지도', 'map'], ['cards', '명함', 'card']];
  const route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard');
  // 사업체·기관·명함은 한 메뉴(사업체·네트워크)의 탭: 주소는 #/biz · #/network · #/cards 그대로
  const HUB_R = ['biz', 'network', 'cards'];
  const navOf = r => (HUB_R.includes(r) ? 'biz' : r);
  /** 메뉴를 눌렀을 때 갈 곳: 사업체·네트워크는 볼 수 있는 첫 탭 */
  const hrefOf = k => (k === 'biz' ? HUB_R.find(x => S.level(x) >= 1) || 'biz' : k);
  const canSee = k => (k === 'biz' ? HUB_R.some(x => S.level(x) >= 1) : !MENU_NAME[k] || S.level(k) >= 1);

  /* ---------- Toast / Confirm ---------- */
  function toast(msg, type = '', opt = {}) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<span>${U.esc(msg)}</span>`;
    if (opt.action) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = opt.action.label;
      b.onclick = () => { el.remove(); opt.action.run(); };
      el.appendChild(b);
    }
    if (opt.undo) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = '되돌리기';
      b.onclick = () => { opt.undo(); el.remove(); toast('되돌렸습니다.'); };
      el.appendChild(b);
    }
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), opt.undo || opt.action ? 6500 : type === 'error' ? (String(msg).length > 80 ? 10000 : 5000) : 2600);
  }
  function confirmBox(title, body, ok = '확인') {
    return new Promise(res => {
      const layer = $('#confirmLayer');
      $('#confirmTitle').textContent = title;
      $('#confirmBody').textContent = body;
      $('#confirmOk').textContent = ok;
      layer.hidden = false;
      $('#confirmOk').focus();
      const done = v => { layer.hidden = true; $('#confirmOk').onclick = $('#confirmCancel').onclick = null; res(v); };
      $('#confirmOk').onclick = () => done(true);
      $('#confirmCancel').onclick = () => done(false);
    });
  }

  /* ---------- 메뉴별 권한 ----------
   * 버튼 동작마다 필요한 [메뉴, 단계]. 2 = 등록·수정, 3 = 삭제. 서버(Code.gs)도 같은 기준으로 막는다 */
  const KIND_MENU = { biz: 'biz', net: 'network', card: 'cards', ev: 'schedule' };
  const GATES = {
    'new-biz': [['biz', 2]], 'biz-upload': [['biz', 2]], 'kead-commit': [['biz', 2]], 'bulk-commit': [['biz', 2]], 'stage-set': [['biz', 2]], 'sup-toggle': [['biz', 2]],
    'ai-summary': [['biz', 2]], 'ai-research': [['biz', 2]], 'edit-research': [['biz', 2]], 'sv-biz-edit': [['biz', 2]], 'sv-job-edit': [['biz', 2]], 'sv-clear': [['biz', 2]], 'sv-job-del': [['biz', 3]],
    'nopos-refind': [['biz', 2]], 'new-net': [['network', 2]], 'or-commit': [['network', 2]], 'or-visit': [['network', 2]], 'or-file': [['network', 2]], 'home-add': [['network', 2]],
    'new-card': [['cards', 2]], 'card-link-to': [['cards', 2]], 'card-autolink': [['cards', 2]], 'card-photo': [['cards', 2]], 'card-pdf': [['cards', 2]], 'card-bulk-commit': [['cards', 2]], 'photo-clear': [['cards', 2]],
    'map-addmode': [['biz', 2]],
    'new-event': [['schedule', 2]], 'ev-import': [['schedule', 2]], 'edit-event': [['schedule', 2]], 'ev-toggle': [['schedule', 2]], 'ev-del': [['schedule', 3]],
    'ct-paste': [['contacts', 2]], 'ct-oc': [['contacts', 2]], 'ct-reg-form': [['contacts', 2]], 'ct-reg': [['contacts', 2]], 'ct-reg-all': [['contacts', 2]], 'ct-unreg': [['contacts', 2]], 'ct-file': [['contacts', 2]], 'ct-paste-commit': [['contacts', 2]], 'ct-url': [['contacts', 2]],
    'perf-del': [['perf', 3]], 'org-sync': [['orgsync', 2]], 'org-sync-commit': [['orgsync', 2]], 'org-user-add': [['orgsync', 2]], 'gl-save': [['perf', 2]], 'goal-save': [['perf', 2]], 'dp-mgr-save': [['perf', 2]], 'dp-mgr-add': [['perf', 2]], 'dp-mgr-del': [['perf', 3]], 'perf-fix-move': [['perf', 2]], 'perf-fix-del': [['perf', 3]], 'pt-add': [['perf', 2]], 'at-fill': [['attend', 2]], 'at-meta': [['attend', 2]], 'at-padd': [['attend', 2]], 'at-paste-commit': [['attend', 2]], 'at-pdel': [['attend', 3]], 'at-apply': [['attend', 2]], 'at-fill-one': [['attend', 2]], 'at-undo': [['attend', 2]], 'at-src-del': [['attend', 3]], 'at-month-clear': [['attend', 3]], 'at-import': [['attend', 2]], 'at-imp-commit': [['attend', 2]], 'at-pastetbl-read': [['attend', 2]],
  };
  function gateOf(act, el) {
    const d = el.dataset || {};
    if (act === 'edit' || act === 'edit-loc' || act === 'map-move') return [[KIND_MENU[d.kind], 2]];
    if (act === 'map-add-here' || act === 'place-add') return [[d.kind === 'net' ? 'network' : 'biz', 2]];
    if (act === 'delete' || act === 'merge' || act === 'dedupe-open') return [[KIND_MENU[d.kind], 3]];
    if (act === 'dedupe-commit') { const top = stack[stack.length - 1]; return [[KIND_MENU[top && top.kind] || 'biz', 3]]; }
    if (act === 'triage') return d.to === 'personal' ? [['cards', 2]] : [['cards', 2], [KIND_MENU[d.to], 2]];
    if (act === 'act-del') { const x = S.find('act', d.id); return [[x && x.targetType === 'net' ? 'network' : 'biz', 3]]; }
    if (act === 'focus-log') { const top = stack[stack.length - 1]; return [[KIND_MENU[top && top.kind] || 'biz', 2]]; }
    if (act === 'open') return [[KIND_MENU[d.kind], 1]];
    return GATES[act] || null;
  }
  const FORM_GATES = { 'ct-add': [['contacts', 2]], 'perf-add': [['perf', 2]], 'sv-biz': [['biz', 2]], 'sv-job': [['biz', 2]] };
  const CHG_GATES = { 'pa-field': [['perf', 2]], 'pf-field': [['perf', 2]], 'jp-field': [['attend', 2]], 'act-field': [['contacts', 2]] };
  const MENU_NAME = Object.fromEntries(D.PERM_MENUS);
  /** 권한이 모자라면 알리고 false */
  function allowed(gates) {
    const miss = (gates || []).find(([m, n]) => m && !S.can(m, n));
    if (!miss) return true;
    toast(`${MENU_NAME[miss[0]] || ''} ${miss[1] >= 3 ? '삭제' : miss[1] >= 2 ? '등록·수정' : '보기'} 권한이 없어요. 관리자에게 요청하세요.`, 'error');
    return false;
  }
  /** 보기만·삭제 불가인 메뉴의 버튼을 숨기도록 body에 표시 */
  function applyPermClasses() {
    D.PERM_MENUS.forEach(([m]) => { const l = S.level(m); document.body.classList.toggle(`ro-${m}`, l < 2); document.body.classList.toggle(`nodel-${m}`, l < 3); });
  }

  /** 브이월드처럼 제목 위에 '홈 › 구역 › 메뉴' 길 표시 */
  function crumb(r) {
    const head = view.querySelector('.page-head'); if (!head || head.querySelector('.crumb')) return;
    const item = NAV.find(x => x[0] === navOf(r)), sec = curSec();
    const nav = document.createElement('nav'); nav.className = 'crumb'; nav.setAttribute('aria-label', '현재 위치');
    nav.innerHTML = `<a href="#/dashboard">홈</a><span>›</span><b>${U.esc(sec.label)}</b>${item && item[1] !== sec.label ? `<span>›</span><b class="here">${U.esc(item[1])}</b>` : ''}`;
    head.prepend(nav);
  }
  /* ---------- Nav ---------- */
  function renderNav() {
    const r = route();
    // 데이터 관리는 관리자에게만 보인다 (팀원은 등록·수정·삭제만)
    applyPermClasses();
    const n = navOf(r);
    const sec = curSec();
    const seeSec = x => (x.k === 'data' ? S.isAdmin() : x.items.some(k => canSee(k)));
    $('#secNav').innerHTML = SECS.filter(seeSec).map(x => `<button type="button" class="sec-btn sec-${x.k} ${x.k === sec.k ? 'on' : ''}" data-act="sec" data-sec="${x.k}" ${x.k === sec.k ? 'aria-current="true"' : ''}>${x.label}</button>`).join('');
    $('#secTitle').innerHTML = `<b>${U.esc(sec.label)}</b><span>${U.esc(sec.desc)}</span>`;
    const byKey = Object.fromEntries(NAV.map(x => [x[0], x]));
    $('#sideNav').innerHTML = sec.items.filter(k => canSee(k)).map(k => { const [, l, ic] = byKey[k]; const hint = SEC_HINT[k] ? SEC_HINT[k]() : ''; return `<a href="#/${hrefOf(k)}" data-nav="${k}" class="${n === k ? 'active' : ''}" ${n === k ? 'aria-current="page"' : ''}>${V.I[ic]}<span class="sn-t"><b>${l}</b>${hint ? `<small>${U.esc(hint)}</small>` : ''}</span></a>`; }).join('');
    const mItems = sec.items.filter(k => canSee(k)).slice(0, 4);
    const moreActive = !mItems.includes(n);
    const SHORT = { dashboard: '홈', biz: '사업체', map: '지도', schedule: '일정', contacts: '연락', perf: '실적', attend: '출석부', data: '데이터' };
    $('#bottomNav').innerHTML = mItems.map(k => `<a href="#/${hrefOf(k)}" class="${n === k ? 'active' : ''}">${V.I[byKey[k][2]]}${SHORT[k] || byKey[k][1]}</a>`).join('') +
      `<button type="button" class="${moreActive ? 'active' : ''}" data-act="more">${V.I.more}더보기</button>`;
    $('#sideFoot').innerHTML = `${U.esc(S.get().settings.orgName)}<br>${S.REMOTE ? '팀 공유 모드 · 구글 시트에 저장' : '이 브라우저에만 저장됩니다.'}<br><label class="me-quick">사용자 <select id="meQuick" aria-label="이 PC를 쓰는 사람">${S.staff().map(s => `<option ${s.name === S.me() ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</select></label><br><span class="num">버전 ${U.esc(window.APP_VERSION || '개발용')}</span>`;
    $('#demoBanner').hidden = !S.get().isDemo;
    $('#meQuick').onchange = ev => { S.setMe(ev.target.value); toast(`이 PC 사용자를 ${ev.target.value}(으)로 정했습니다. 활동 기록의 기록자로 남아요.`); render(); };
    renderScope();
  }

  /** 공유 사이트(Apps Script) 파일들이 같은 때 만든 것인지 확인. 예전 파일이 섞이면 화면이 깨지므로 위에 알린다 */
  function verCheck() {
    const v = window.APP_VERSION, parts = window.__ver;
    if (!v || !parts) return; // 파일 하나로 여는 버전은 확인 안 함
    const cssV = getComputedStyle(document.documentElement).getPropertyValue('--css-ver').replace(/["']/g, '').trim();
    const old = [...(cssV === v ? [] : ['style']), ...['app1', 'app2', 'app3'].filter(k => parts[k] !== v)];
    if (!old.length) return;
    const bar = document.createElement('div');
    bar.className = 'ver-warn';
    bar.innerHTML = `⚠ 파일이 서로 다른 때 것이 섞여 있어요: <b>${old.map(k => k + '.html').join(', ')}</b>이(가) index.html(${U.esc(v)})과 달라요. 그래서 화면 모양이 깨지거나 기능이 안 될 수 있어요. 받은 파일 중 <b>${old.map(k => k + '.html').join(', ')}</b>을(를) 처음부터 끝까지 다시 붙여넣고(Ctrl+A → Ctrl+V) 새 버전으로 배포해 주세요. <button type="button" onclick="this.parentNode.remove()">닫기</button>`;
    document.body.prepend(bar);
  }
  /* ---------- 보기 범위 · 동기화 상태 ---------- */
  function renderScope() {
    const sel = $('#scopeSel');
    const staff = S.staff();
    const cur = S.getScope();
    // 현장중심·고용공단 같은 구역 안에서는 그 구역과 그 구역 직원만 고를 수 있다 (다른 구역 자료로 넘어가지 않게)
    const sec = SECS.find(x => x.k === secKey) || {}; // 읽기만 (curSec은 구역을 바꿀 수 있어 여기서 부르지 않는다)
    if (sec.prog) {
      const mine = staff.filter(s => s.program === sec.prog);
      // 구역 안에서는 늘 구역 전체로 본다. 사람별로는 각 화면의 이름 버튼(전체·김정배·이유진)으로 거른다 (거르는 곳이 두 군데면 헷갈려서)
      sel.innerHTML = `<option value="p:${U.esc(sec.prog)}">${U.esc(sec.label)} 전체 (${mine.length}명)</option>`;
      sel.value = 'p:' + sec.prog;
      if (cur !== 'p:' + sec.prog) setTimeout(() => S.setScope('p:' + sec.prog), 0);
      sel.classList.add('scoped');
      return;
    }
    const progs = D.PROGRAMS.filter(p => staff.some(s => s.program === p.key) || S.getScope() === 'p:' + p.key); // 지금 구역은 담당자가 없어도 보이게
    sel.innerHTML = `<option value="all">전체 팀 (${staff.length}명)</option>` +
      progs.map(p => `<option value="p:${U.esc(p.key)}">${U.esc(D.progLabel(p.key))} (${staff.filter(s => s.program === p.key).length}명)</option>`).join('') +
      `<optgroup label="직원별">${staff.map(s => `<option value="s:${U.esc(s.name)}">${U.esc(s.name)}${s.name === S.me() ? ' (나)' : ''}</option>`).join('')}</optgroup>`;
    sel.value = cur;
    if (sel.value !== cur) { sel.value = 'all'; }
    sel.classList.toggle('scoped', cur !== 'all');
  }
  function renderSync(sync) {
    const btn = $('#syncBtn');
    if (btn && !btn.disabled) btn.textContent = S.isAdmin() ? '💾 저장·새로고침' : '⟳ 새로고침';
    const el = $('#syncState');
    if (!S.REMOTE) { el.hidden = true; return; }
    el.hidden = false;
    const t = sync.at ? `${U.pad(sync.at.getHours())}:${U.pad(sync.at.getMinutes())}` : '';
    const wait = S.outboxSize ? S.outboxSize() : 0;
    const map = { loading: ['불러오는 중', ''], saving: ['저장 중…', 'busy'], saved: [`저장됨 ${t}`, 'ok'], error: [wait ? `저장 대기 ${wait}건 · 다시 보내기` : '저장 오류', 'err'] };
    const [label, cls] = map[sync.status] || ['', ''];
    el.className = 'sync ' + cls;
    el.textContent = label;
    el.title = sync.status === 'error' ? (wait ? `구글 시트에 아직 못 보낸 기록 ${wait}건이 이 컴퓨터에 보관돼 있어요. 누르면 바로 다시 보내고, 연결되면 자동으로도 보내요. (${(sync.error && sync.error.message) || ''})` : '구글 시트와 연결되지 않았습니다. 새로고침해 보세요.') : '팀원이 바꾼 내용은 30초마다, 또는 이 창으로 돌아올 때 반영됩니다.';
    el.onclick = sync.status === 'error' && wait ? () => S.flush() : null;
    el.style.cursor = el.onclick ? 'pointer' : '';
  }

  /* ---------- Pages ---------- */
  let bigMap = null, markerIndex = {}, markerGroup = null;
  /* ---------- 쓰다 만 입력 지키기 ----------
   * 다른 창에서 전화번호를 찾고 돌아오면 최신 내용을 받아 화면을 다시 그리는데,
   * 그때 추가 칸에 쓰던 글이 지워지지 않게 칸마다 적어 두었다가 다시 채운다 (저장하면 비움) */
  const drafts = (() => { try { return JSON.parse(sessionStorage.getItem('ardim.drafts') || '{}') || {}; } catch { return {}; } })();
  const saveDrafts = () => { try { sessionStorage.setItem('ardim.drafts', JSON.stringify(drafts)); } catch {} };
  const clearDraft = name => { if (drafts[name]) { delete drafts[name]; saveDrafts(); } };
  const noteDraft = ev => {
    const el = ev.target, f = el && el.closest && el.closest('#view form[data-form]');
    if (!f || !el.name || el.type === 'file' || el.type === 'checkbox' || el.type === 'radio' || f.dataset.form === 'place-q') return;
    (drafts[f.dataset.form] ||= {})[el.name] = el.value; saveDrafts();
  };
  document.addEventListener('input', noteDraft, true);
  document.addEventListener('change', noteDraft, true);
  function keepDrafts(fn) {
    const a = document.activeElement, f = a && a.closest && a.closest('#view form[data-form]');
    const focus = f && a.name ? { form: f.dataset.form, name: a.name, s: a.selectionStart, e: a.selectionEnd } : null;
    fn();
    view.querySelectorAll('form[data-form]').forEach(fm => {
      const d = drafts[fm.dataset.form]; if (!d) return;
      Object.entries(d).forEach(([k, v]) => { const el = fm.querySelector(`[name="${k}"]`); if (el && el.value !== v) el.value = v; });
    });
    if (focus) {
      const el = view.querySelector(`form[data-form="${focus.form}"] [name="${focus.name}"]`);
      if (el) { el.focus({ preventScroll: true }); try { if (focus.s != null) el.setSelectionRange(focus.s, focus.e); } catch {} }
    }
  }
  function render() {
    const r = route();
    document.body.dataset.route = r; // 화면마다 제목 색을 다르게
    document.body.dataset.sec = curSec().k; // 구역 색
    // 지도는 지금 구역의 사업만 (현장중심이면 현장중심 지도만)
    { const sp = curSec().prog, P = sp && D.PROGRAM[sp]; if (P && P.map) { V.ui.map.prog = sp; V.ui.map.lock = true; } else V.ui.map.lock = false; }
    if (r === 'schedule' || r === 'dashboard') maybeCalPull(false);
    // 예전 실적 줄의 사업체 이름을 비고에서 '사업체·기관' 칸으로 한 번 옮긴다
    if (r === 'perf' && !perfSplitDone && S.can('perf', 2)) { perfSplitDone = true; setTimeout(() => { const n = S.splitPerfPlaces(); if (n) toast(`예전 실적 ${n}줄의 사업체 이름을 굵은 칸으로 옮겼어요.`); }, 300); }
    closeMore();
    const pages = {
      dashboard: [V.dashboard],
      biz: [V.bizPage, bindBiz], // 사업체·네트워크 메뉴의 세 탭

      map: [V.mapPage, bindMap],
      cards: [V.cardsPage, bindCards],
      network: [V.netPage, bindNet],
      schedule: [() => { V.ui.sched.view = 'work'; return V.schedPage(); }, bindSched],
      perf: [V.perfPage, bindPerf],
      contacts: [R.contactsPage, () => { $('#ctResults').innerHTML = R.contactsResults(); }],
      outreach: [OR.page, bindOutreach],
      attend: [AT.page, bindAttend],
      data: S.isAdmin() ? [V.dataPage, bindData] : [() => `<div class="panel"><div class="empty"><strong>데이터 관리는 관리자만 볼 수 있어요</strong>사업체·네트워크·명함·연락이력·일정·실적·명령부 등록과 삭제는 그대로 할 수 있어요.<br>내 계정: <b>${U.esc(S.accessInfo().me || '(확인 안 됨)')}</b> · 이 PC 사용자는 왼쪽 아래에서 바꿀 수 있어요.<div><a class="btn" href="#/dashboard">대시보드로</a></div></div></div>`],
    };
    let [html, after] = pages[r] || pages.dashboard;
    if (MENU_NAME[r] && S.level(r) < 1) [html, after] = [() => `<div class="panel"><div class="empty"><strong>${MENU_NAME[r]} 메뉴는 볼 권한이 없어요</strong>관리자에게 권한을 요청하세요.<div><a class="btn" href="#/dashboard">대시보드로</a></div></div></div>`, null];
    try {
      keepDrafts(() => { view.innerHTML = html(); after && after(); });
      crumb(r);
      scopeBanner();
    } catch (err) {
      console.error(err);
      view.innerHTML = `<div class="panel"><div class="empty"><strong>화면을 그리는 중 문제가 생겼습니다</strong>${U.esc(err.message)}<div><button class="btn" type="button" onclick="location.reload()">다시 시도</button></div></div></div>`;
    }
    renderNav();
    renderSync(S.sync);
  }

  /** 연락이력: 캡처(구인공고·문자 등) → AI가 필요한 정보만 뽑아 '연락 기록 추가' 칸을 채운다. 저장은 확인 후 직접 */
  async function fillContactFromShot(file) {
    const form = document.querySelector('[data-form="ct-add"]');
    if (!form) return;
    if (!AI.available()) return toast('캡처 읽기는 AI 키가 있어야 해요. 데이터 관리 → AI 도우미에서 키를 넣어 주세요.', 'error');
    toast('캡처를 읽는 중이에요… (10초쯤)');
    let r;
    try {
      const data = file.type === 'application/pdf' ? await readDataUrl(file) : await F.resizeImage(file, 1800, .85);
      r = await AI.readContactShot(data);
    } catch (err) { return toast('캡처를 읽지 못했어요: ' + err.message, 'error'); }
    const set = (k, v) => { const el = form.elements[k]; if (!el || !v) return 0; el.value = v; el.classList.add('ai-filled'); return 1; };
    const n = set('name', r.name) + set('phone', r.phone) + set('address', r.address) + set('contactName', r.contactName) + set('jobType', r.jobType) + set('content', r.content) + set('jobUrl', R.jobLink(r.jobUrl) ? r.jobUrl : '');
    if (!n) return toast('캡처에서 쓸 만한 정보를 찾지 못했어요. 공고 화면이 잘 보이게 다시 찍어 보세요.', 'error');
    form.scrollIntoView({ block: 'center', behavior: 'smooth' });
    toast(`캡처에서 ${n}칸을 채웠어요. 노란 칸을 확인·수정하고 방식·결과를 고른 뒤 '추가'를 누르세요.`);
  }
  /** 방금 넣은 기록의 담당이 지금 보는 범위(한 사람)에 없으면 바로 알려 준다 */
  function hiddenHere(who) {
    const sc = S.getScope();
    if (!sc.startsWith('s:') || sc.slice(2) === who) return;
    const sec = SECS.find(x => x.k === secKey) || {};
    setTimeout(() => toast(`저장은 됐어요. 그런데 지금 '${sc.slice(2)}' 선생님 기록만 보는 중이라 ${who} 선생님 기록은 이 화면에 안 보여요.`, 'error', sec.prog ? { action: { label: `${sec.label} 전체 보기`, run: () => S.setScope('p:' + sec.prog) } } : {}), 400);
  }
  /** 한 사람 기록만 보는 중이면 화면 위에 크게 알린다 (다른 직원이 넣은 기록이 안 보여 헷갈리지 않게) */
  function scopeBanner() {
    const sc = S.getScope();
    if (!sc.startsWith('s:') || route() === 'data') return;
    const sec = SECS.find(x => x.k === secKey) || {};
    const bar = document.createElement('div');
    bar.className = 'scope-banner';
    bar.innerHTML = `👤 지금 <b>${U.esc(sc.slice(2))}</b> 선생님 기록만 보고 있어요. 다른 선생님이 넣은 기록은 안 보여요.${sec.prog ? ` <button class="btn btn-sm btn-primary" type="button" data-act="scope-set" data-scope="p:${U.esc(sec.prog)}">${U.esc(sec.label)} 전체 보기</button>` : ''}`;
    view.prepend(bar);
  }
  function bindOutreach() {
    OR.bind();
    const f = $('#orFile');
    if (f) f.onchange = async ev => {
      const file = ev.target.files[0]; ev.target.value = '';
      if (!file) return;
      try {
        const list = OR.parse(await file.arrayBuffer());
        if (!list.length) return toast('이 파일에서 기관 목록(이름·주소 칸)을 찾지 못했어요.', 'error');
        push({ type: 'orprev', file: file.name, rows: OR.plan(list) }, false);
      } catch (err) { console.error(err); toast(err.drm ? err.message : '엑셀 파일을 읽지 못했어요: ' + err.message, 'error'); }
    };
  }
  function bindList(inputId, target, fn, setter) {
    const box = $(target);
    const draw = () => { box.innerHTML = fn(); };
    draw();
    const q = $(inputId);
    if (q) q.addEventListener('input', U.debounce(() => { setter(q.value.trim()); draw(); }, 120));
    return draw;
  }
  /** 세 탭이 같은 검색어를 쓴다: 다른 탭으로 가도 검색어가 남고, 탭 옆 숫자가 바로 바뀐다 */
  function syncQ(v) {
    V.ui.hub.q = V.ui.biz.q = V.ui.net.q = V.ui.cards.q = v;
    const t = $('#hubTabs'); if (t) t.innerHTML = V.hubTabsInner(route());
  }
  function bindBiz() {
    const f = V.ui.biz;
    syncQ(V.ui.hub.q);
    const draw = bindList('#bizQ', '#bizResults', V.bizResults, syncQ);
    $('#bizProg').onchange = ev => { f.prog = ev.target.value; draw(); };
    $('#bizArea').onchange = ev => { f.area = ev.target.value; draw(); };
    $('#bizInd').onchange = ev => { f.industry = ev.target.value; draw(); };
    $('#bizMand').onchange = ev => { f.mandatory = ev.target.checked; draw(); };
    $('#bizSort').onchange = ev => { f.sort = ev.target.value; draw(); };
    $('#bizPeriod').onchange = ev => { f.period = ev.target.value; $('#bizMonth').hidden = f.period !== 'month'; draw(); };
    $('#bizMonth').onchange = ev => { f.month = ev.target.value || U.today().slice(0, 7); draw(); };
  }
  function bindNet() {
    syncQ(V.ui.hub.q);
    const draw = bindList('#netQ', '#netResults', V.netResults, syncQ);
    $('#netStatus').onchange = ev => { V.ui.net.status = ev.target.value; draw(); };
  }
  function bindCards() {
    syncQ(V.ui.hub.q);
    const draw = bindList('#cardQ', '#cardResults', V.cardResults, syncQ);
    $('#cardSort').onchange = ev => { V.ui.cards.sort = ev.target.value; draw(); };
  }
  function bindMap() {
    bigMap = null;
    if (V.ui.map.mode === 'city') return fitCity();
    bigMap = M.create($('#bigMap'), { showLayers: false });
    markerGroup = null; markerIndex = {};
    refreshMap(true);
    const fx = V.ui.map.focus;
    if (fx) { V.ui.map.focus = null; setTimeout(() => A['map-focus']({ dataset: fx }), 350); }
    $('#mapQ').addEventListener('input', U.debounce(ev => { V.ui.map.q = ev.target.value.trim(); refreshMap(false); }, 150));
    // 두 곳 찍기 중에 빈 곳을 찍으면 그 자리를 출발·도착으로 쓴다
    // 오른쪽 클릭(휴대폰은 길게 누르기)은 언제든 "여기에 추가"
    bigMap.on('zoomend', mapLabels); mapLabels();
    bigMap.on('popupopen', ev => { const s = ev.popup._source; if (s && s._icon) s._icon.classList.add('mk-sel'); if (s && s._arKey) selPlace(s._arKey.kind, s._arKey.id, true); });
    // 목록에 마우스를 올리면 지도 점도 같이 표시
    const list = $('#mapList');
    let hovKey = '';
    const hov = key => {
      if (key === hovKey) return;
      [hovKey, key].forEach((k, i) => { const m = k && markerIndex[k]; if (!m) return; m._icon?.classList.toggle('mk-hov', !!i); m.getTooltip()?.getElement()?.classList.toggle('hov', !!i); });
      hovKey = key;
    };
    list.addEventListener('mouseover', ev => hov(ev.target.closest('[data-key]')?.dataset.key || ''));
    list.addEventListener('mouseleave', () => hov(''));
    bigMap.on('popupclose', ev => { const s = ev.popup._source; if (s && s._icon) s._icon.classList.remove('mk-sel'); });
    bigMap.on('contextmenu', ev => { if (S.can('biz', 2) || S.can('network', 2)) addHerePopup(ev.latlng); });
    bigMap.on('click', ev => {
      if (V.ui.map.addMode && !V.ui.map.pick) { addHerePopup(ev.latlng); A['map-addmode'](); return; }
      if (!V.ui.map.pick) return;
      const lat = +ev.latlng.lat.toFixed(6), lng = +ev.latlng.lng.toFixed(6);
      const r = V.ui.map.route;
      pickRoute({ kind: 'pt', lat, lng, name: !r || !r.from || r.to ? '찍은 출발지' : '찍은 도착지' });
    });
  }
  /** 화성시 대시보드를 기준 화면 크기로 그린 뒤 칸 너비에 맞춰 축소 */
  let cityRO = null;
  function fitCity() {
    const wrap = $('#cityWrap'), frame = $('#cityFrame'), sel = $('#cityFit');
    if (!wrap || !frame) return;
    const apply = () => {
      const mode = V.ui.map.cityFit;
      if (mode === 'full') { frame.style.cssText = ''; wrap.style.height = ''; wrap.classList.add('full'); return; }
      wrap.classList.remove('full');
      const baseW = 1920, baseH = mode === 'wide' ? 823 : 1080;
      const k = wrap.clientWidth / baseW;
      frame.style.cssText = `width:${baseW}px;height:${baseH}px;transform:scale(${k});transform-origin:0 0`;
      wrap.style.height = Math.round(baseH * k) + 'px';
    };
    sel.onchange = () => { V.ui.map.cityFit = sel.value; apply(); };
    cityRO?.disconnect();
    cityRO = new ResizeObserver(apply);
    cityRO.observe(wrap);
    apply();
  }
  /** 이름표: 가까이 보거나 점이 적으면 늘 보이게 */
  function mapLabels() {
    if (!bigMap) return;
    const on = bigMap.getZoom() >= 14 || Object.keys(markerIndex).length <= 30;
    $('#bigMap')?.classList.toggle('labels-on', on);
  }
  /** 목록에서 고른 곳 표시 (지도 점을 눌러도 목록이 따라온다) */
  function selPlace(kind, id, scroll) {
    V.ui.map.sel = { kind, id };
    const box = $('#mapList'); if (!box) return;
    box.querySelectorAll('.map-item.on').forEach(x => x.classList.remove('on'));
    const it = box.querySelector(`[data-key="${kind + id}"]`);
    if (!it) return;
    it.classList.add('on');
    if (scroll && (it.offsetTop < box.scrollTop || it.offsetTop + it.offsetHeight > box.scrollTop + box.clientHeight)) box.scrollTo({ top: Math.max(0, it.offsetTop - box.clientHeight / 3), behavior: 'smooth' });
  }
  /** 고른 곳으로 부드럽게 날아간 뒤 말풍선을 연다 (점은 다시 그리지 않는다) */
  function focusPlace(kind, id) {
    const key = kind + id;
    const m = markerIndex[key];
    if (!m || !bigMap) return openDetail(kind, id, false);
    selPlace(kind, id, false);
    bigMap.closePopup();
    const ll = m.getLatLng();
    let done = false;
    const open = () => { if (done) return; done = true; markerIndex[key]?.openPopup(); };
    const px = bigMap.latLngToContainerPoint(ll).distanceTo(bigMap.getSize().divideBy(2));
    if (bigMap.getZoom() >= 15 && px < 8) open();
    else {
      bigMap.once('moveend', open);
      setTimeout(open, 1200);
      if (bigMap.getZoom() >= 15 && bigMap.getBounds().pad(-0.1).contains(ll)) bigMap.panTo(ll, { animate: true, duration: 0.35 });
      else bigMap.flyTo(ll, Math.max(bigMap.getZoom(), 16), { duration: 0.7 });
    }
    if (window.innerWidth <= 860) $('#bigMap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  /** 점 모양이 바뀌는 값들. 같으면 그 점은 그대로 둔다 */
  const markSig = (kind, x, month, pick) => [x.lat, x.lng, kind === 'card' ? (x.org || x.name) : x.name, kind === 'biz' ? `${S.bizTone(x)}${S.supportOf(x).types.length}${x.stage}` : x.status, month ? 1 : 0, pick ? 1 : 0].join('|');
  function refreshMap(fit) {
    const f = V.ui.map;
    const all = V.mapItems(true);
    const items = V.mapItems();
    const fd = $('#mapFolder'); if (fd) fd.innerHTML = V.mapFolder(all);
    const box = $('#mapList');
    if (box) { const y = box.scrollTop; box.innerHTML = V.mapList(items); box.scrollTop = y; }
    const bar = $('#mapSolo');
    if (bar) { bar.innerHTML = V.soloBar(); bar.hidden = !bar.innerHTML; }
    if (!bigMap) return;
    if (!markerGroup) { markerGroup = L.featureGroup().addTo(bigMap); markerIndex = {}; }
    const label = (kind, x) => kind === 'card' ? (x.org || x.name) : x.name;
    // 이것만 보기: 고른 곳(+ 길찾기 출발·도착)만 지도에 남긴다
    const so = f.solo && S.find(f.solo.kind, f.solo.id) ? f.solo : (f.solo = null);
    const r = f.route;
    const keep = so ? new Set([so, r && r.from, r && r.to].filter(Boolean).map(k => k.kind + k.id)) : null;
    let shown = items.filter(i => M.hasPos(i.x) && (!keep || keep.has(i.kind + i.x.id) || i.home));
    if (so && !shown.some(i => i.kind === so.kind && i.x.id === so.id)) {
      // 레이어·검색에 걸려 빠졌어도 고른 곳은 보여 준다
      const x = S.find(so.kind, so.id);
      if (M.hasPos(x)) shown.push({ kind: so.kind, x, home: so.kind === 'net' && S.isHome(x) });
    }
    // 바뀐 점만 새로 만들고, 없어진 점만 뺀다 (열린 말풍선은 그대로)
    const seen = new Set();
    shown.forEach(({ kind, x, month }) => {
      const key = kind + x.id;
      seen.add(key);
      const sig = markSig(kind, x, month, f.pick), data = JSON.stringify(x);
      let m = markerIndex[key];
      if (m && m._arSig === sig) {
        if (m._arData !== data) { m._arData = data; if (m.isPopupOpen && m.isPopupOpen()) m.getPopup().update(); m.setTooltipContent(label(kind, x)); }
        return;
      }
      const reopen = m && m.isPopupOpen && m.isPopupOpen();
      if (m) markerGroup.removeLayer(m);
      m = (kind === 'biz' ? M.bizMarker(x, month) : kind === 'net' ? M.netMarker(x) : M.cardMarker(x))
        // 이름표: 가까이 보면 늘, 멀리서는 마우스를 올린 핀만 (네이버 지도처럼)
        .bindTooltip(label(kind, x), { permanent: true, direction: 'bottom', offset: [0, 4], className: 'mk-label', interactive: false });
      m._arSig = sig; m._arData = data; m._arKey = { kind, id: x.id };
      m.on('mouseover', () => m.getTooltip()?.getElement()?.classList.add('hov'));
      m.on('mouseout', () => m.getTooltip()?.getElement()?.classList.remove('hov'));
      // 두 곳 찍기 중에는 말풍선 대신 바로 출발·도착으로 고른다
      if (f.pick) m.on('click', ev => { L.DomEvent.stop(ev); pickRoute({ kind, id: x.id }); });
      // 말풍선 내용은 열 때마다 최신 자료로 만든다
      else m.bindPopup(() => M.popupHtml(kind, S.find(kind, x.id) || x), { autoPanPaddingTopLeft: [20, 70] });
      m.addTo(markerGroup);
      markerIndex[key] = m;
      if (reopen) m.openPopup();
    });
    Object.keys(markerIndex).forEach(k => { if (!seen.has(k)) { markerGroup.removeLayer(markerIndex[k]); delete markerIndex[k]; } });
    mapLabels();
    $('#bigMap')?.classList.toggle('picking', !!f.pick);
    drawRoute();
    if (so) {
      const m = markerIndex[so.kind + so.id];
      if (m && fit !== false) bigMap.setView(m.getLatLng(), Math.max(bigMap.getZoom(), 15));
      return;
    }
    if (fit) {
      const gu = f.gu;
      const gb = M.guBounds(gu || '');
      if (gb) bigMap.fitBounds(gb, { padding: [12, 12] });
      else if (markerGroup.getLayers().length) bigMap.fitBounds(markerGroup.getBounds(), { padding: [30, 30], maxZoom: 14 });
    }
  }
  /** 자료가 바뀔 때(30초 동기화·주소 찾기 등) 지도는 통째로 다시 그리지 않고 점만 맞춘다. 몰려 오면 한 번에 */
  let mapSoftT = 0;
  function softMap() {
    clearTimeout(mapSoftT);
    mapSoftT = setTimeout(() => { if (route() === 'map' && $('#mapList')) { refreshMap(false); renderNav(); } else render(); }, 250);
  }
  /** 지도에서 두 곳 찍기: 첫 번째 = 출발, 두 번째 = 도착, 세 번째부터는 새로 시작 */
  function pickRoute(ref) {
    const r = V.ui.map.route;
    if (!r || !r.from || r.to) {
      V.ui.map.route = { from: ref, to: null };
      drawRoute(false);
      toast('출발지를 찍었어요. 이제 도착할 곳을 찍으세요.');
    } else {
      V.ui.map.route = { from: r.from, to: ref };
      routeChanged(true);
    }
  }
  /** 출발·도착이 정해지면 경로를 그리고, 켜 두었으면 길찾기 창을 오른쪽에 띄운다 (누른 순간에 열어야 팝업이 막히지 않는다) */
  function routeChanged(zoom) {
    drawRoute(zoom);
    if (V.ui.map.rauto) openRouteWin(true);
  }
  let routeWin = null;
  function openRouteWin(auto) {
    const f = V.ui.map, r = f.route;
    const from = r && V.routeEnd(r.from, true), to = r && V.routeEnd(r.to);
    if (!from || !to || !M.hasPos(from) || !M.hasPos(to)) { if (!auto) toast('출발과 도착을 먼저 골라 주세요.'); return; }
    const url = f.rprov === 'kakao' ? M.kakaoRoute(from, to) : M.naverRoute(from, to, f.rmode);
    // 같은 이름의 창을 다시 쓰므로, 새로 고를 때마다 그 창 내용만 바뀐다. 처음 열 때는 화면 오른쪽 절반에 붙인다
    const W = Math.max(480, Math.round(screen.availWidth * 0.42)), H = screen.availHeight;
    const left = (screen.availLeft || 0) + screen.availWidth - W, top = screen.availTop || 0;
    try {
      if (routeWin && !routeWin.closed) { routeWin.location.href = url; routeWin.focus(); return; }
    } catch { /* 다른 사이트로 넘어간 창은 주소만 바꿀 수 있다 */ }
    routeWin = window.open(url, 'ardimRoute', `popup=yes,width=${W},height=${H},left=${left},top=${top}`);
    if (!routeWin) toast('길찾기 창이 팝업 차단으로 막혔어요. 주소창 오른쪽의 팝업 차단 아이콘에서 "항상 허용"을 눌러 주세요.');
  }
  /** 길찾기: 옆 칸을 다시 그리고, 지도에 출발→도착 경로를 표시 */
  let routeLayer = null, routeDots = null;
  function drawRoute(zoom) {
    const box = $('#routeBox');
    if (box) box.innerHTML = V.routePanel();
    if (!bigMap) return;
    if (routeLayer) { routeLayer.remove(); routeLayer = null; }
    if (routeDots) { routeDots.remove(); routeDots = null; }
    const r = V.ui.map.route;
    if (!r) return;
    const from = V.routeEnd(r.from, true);
    const to = V.routeEnd(r.to);
    // 찍은 점(사업체가 아닌 곳)은 출발 A·도착 B 표시로 보여 준다
    const dot = (p, t) => L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: `<span class="route-dot ${t === 'A' ? 'a' : 'b'}">${t}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false, zIndexOffset: 1000 });
    routeDots = L.layerGroup();
    if (from && M.hasPos(from)) dot(from, 'A').addTo(routeDots);
    if (to && M.hasPos(to)) dot(to, 'B').addTo(routeDots);
    routeDots.addTo(bigMap);
    if (!from || !to || !M.hasPos(from) || !M.hasPos(to)) return;
    const km = M.distKm(from, to);
    const key = [from.id, to.id].join('>');
    const info = V.ui.map.routeInfo && V.ui.map.routeInfo.key === key ? V.ui.map.routeInfo : null;
    const line = (path, road) => L.polyline(path, road ? { color: '#1D4ED8', weight: 6, opacity: .85, interactive: false, lineCap: 'round' } : { color: '#172033', weight: 3, dashArray: '8 7', opacity: .85, interactive: false });
    const tip = info && info.road ? `${info.road.km.toFixed(1)}km` : `직선 ${km.toFixed(1)}km`;
    routeLayer = line(info && info.road ? info.road.path : [[from.lat, from.lng], [to.lat, to.lng]], !!(info && info.road))
      .bindTooltip(tip, { permanent: true, direction: 'center', className: 'route-tip' }).addTo(bigMap);
    if (zoom) bigMap.fitBounds(routeLayer.getBounds(), { padding: [60, 60], maxZoom: 15 });
    if (!info) {
      // 도로 경로를 받아 오면 직선 대신 도로를 따라 다시 그린다 (받는 사이 다른 곳을 고르면 버림)
      V.ui.map.routeInfo = { key, loading: true };
      if (box) box.innerHTML = V.routePanel();
      M.roadRoute(from, to).then(road => {
        if (!V.ui.map.route || !V.ui.map.routeInfo || V.ui.map.routeInfo.key !== key) return;
        V.ui.map.routeInfo = { key, road };
        drawRoute(false);
      });
    }
  }
  /** 새 사업체·기관 등록 때 미리 채울 값: 지도에서 찍은 위치, 보고 있는 사업 지도 */
  function newPreset(el) {
    const d = el.dataset || {};
    const out = {};
    if (d.lat && d.lng) { out.lat = +d.lat; out.lng = +d.lng; out.area = D.areaAt(+d.lat, +d.lng) || ''; out.approx = false; }
    if (d.address) out.address = d.address;
    if (d.pname) out.name = d.pname;
    if (d.phone) out.phone = d.phone;
    if (d.cat && d.kind !== 'net') out.industry = d.cat;
    if (d.kind === 'net' && d.pname) out.category = D.guessCategory(d.pname);
    const prog = d.programs || (route() === 'map' ? V.ui.map.prog : '');
    if (prog) out.programs = [prog];
    return out;
  }
  /** 지도 빈 곳을 찍었을 때 "여기에 추가" 말풍선 */
  function addHerePopup(latlng) {
    const lat = +latlng.lat.toFixed(6), lng = +latlng.lng.toFixed(6);
    const area = D.areaAt(lat, lng);
    const prog = V.ui.map.prog && D.PROGRAM[V.ui.map.prog];
    L.popup({ className: 'add-pop' }).setLatLng(latlng).setContent(`<div class="pop"><div class="pop-kind">여기에 추가</div><div class="pop-name">${area ? U.esc(area) : '화성시 밖'}</div>${prog ? `<div class="pop-meta">${U.esc(prog.map)} 지도에 넣어요</div>` : ''}
      <div class="pop-addr" id="addHereAddr">📍 주소 찾는 중…</div>
      <div class="inline pop-actions"><button class="btn btn-sm btn-primary" type="button" data-act="map-add-here" data-kind="biz" data-lat="${lat}" data-lng="${lng}">사업체 개발 등록</button><button class="btn btn-sm" type="button" data-act="map-add-here" data-kind="net" data-lat="${lat}" data-lng="${lng}">기관 등록</button></div></div>`).openOn(bigMap);
    M.revGeo(lat, lng).then(r => {
      const box = $('#addHereAddr'); if (!box) return;
      const addr = r && (r.road || r.addr);
      box.innerHTML = addr ? `📍 ${U.esc(addr)}${r.bldg ? ` <b>${U.esc(r.bldg)}</b>` : ''}` : '주소를 찾지 못했어요 (등록 후 직접 적어 주세요)';
      if (addr) document.querySelectorAll('.add-pop [data-act="map-add-here"]').forEach(b => { b.dataset.address = addr; });
    });
  }
  /* ---------- 네이버 지도처럼: 장소 검색 → 결과 → 카드 → 등록 ---------- */
  let placeList = [], placeMarker = null;
  async function placeSearch(q) {
    const box = $('#placeRes'); if (!box) return;
    V.ui.map.pq = q;
    if (!q) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '<div class="ps-empty">찾는 중…</div>';
    const r = S.search(q);
    const mine = [...r.biz.map(x => ['biz', x]), ...r.net.map(x => ['net', x])].slice(0, 4);
    placeList = await M.placeSearch(q);
    const reg = p => { const k = U.orgKey(p.name); return S.get().businesses.find(b => U.orgKey(b.name) === k) || S.get().networks.find(n => U.orgKey(n.name) === k); };
    box.innerHTML = `<div class="ps-head"><b>'${U.esc(q)}' 검색 결과</b><button class="icon-btn" type="button" data-act="place-close" aria-label="닫기">${V.I.close}</button></div>
      ${mine.length ? `<div class="ps-sec">등록된 곳</div>${mine.map(([k, x]) => `<button type="button" class="ps-item mine" data-act="map-focus" data-kind="${k}" data-id="${x.id}"><b>${U.esc(x.name)}</b><span>${U.esc(k === 'biz' ? (x.industry || '사업체') : (x.category || '기관'))} · ${U.esc(x.address || x.area || '')}</span><em>등록됨</em></button>`).join('')}` : ''}
      <div class="ps-sec">새로 찾은 곳 ${placeList.length ? `<span class="sub">${placeList.length}곳</span>` : ''}</div>
      ${placeList.length ? placeList.map((p, i) => { const g = reg(p); return `<button type="button" class="ps-item" data-act="place-pick" data-i="${i}"><b>${U.esc(p.name)}</b><span>${U.esc([p.cat, p.road || p.addr].filter(Boolean).join(' · '))}</span>${p.phone ? `<span>📞 ${U.esc(p.phone)}</span>` : ''}${g ? '<em>등록됨</em>' : ''}</button>`; }).join('')
        : `<div class="ps-empty">찾지 못했어요. 주소(예: 향남읍 발안로 1)나 다른 이름으로 찾아보세요.</div>`}`;
  }
  function placeCard(p) {
    const k = U.orgKey(p.name);
    const g = S.get().businesses.find(b => U.orgKey(b.name) === k) || S.get().networks.find(n => U.orgKey(n.name) === k) || (p.phone && S.get().businesses.find(b => b.phone && b.phone.replace(/\D/g, '') === p.phone.replace(/\D/g, '')));
    const kind = g ? (S.get().businesses.includes(g) ? 'biz' : 'net') : '';
    const data = `data-lat="${p.lat}" data-lng="${p.lng}" data-pname="${U.esc(p.name)}" data-address="${U.esc(p.road || p.addr || '')}" data-phone="${U.esc(p.phone || '')}" data-cat="${U.esc(p.cat === '주소' ? '' : p.cat || '')}"`;
    return `<div class="pop place-pop"><div class="pop-kind">${U.esc(p.cat || '장소')}</div><div class="pop-name">${U.esc(p.name)}</div>
      ${p.road ? `<div class="pop-addr">📍 ${U.esc(p.road)}</div>` : ''}${p.addr && p.addr !== p.road ? `<div class="pop-meta">지번 ${U.esc(p.addr)}</div>` : ''}
      ${p.phone ? `<div class="pop-addr">📞 <a href="tel:${U.esc(p.phone.replace(/[^0-9+]/g, ''))}">${U.esc(p.phone)}</a></div>` : ''}
      ${g ? `<div class="pop-meta" style="margin-top:6px">이미 등록된 <b>${U.esc(g.name)}</b>이 있어요.</div><div class="inline pop-actions"><button class="btn btn-sm btn-primary" type="button" data-act="open" data-kind="${kind}" data-id="${g.id}">상세 보기</button></div>`
        : `<div class="inline pop-actions"><button class="btn btn-sm btn-primary" type="button" data-act="place-add" data-kind="biz" ${data}>사업체로 등록</button><button class="btn btn-sm" type="button" data-act="place-add" data-kind="net" ${data}>기관으로 등록</button></div>`}</div>`;
  }
  /** 출석부: 표를 다시 그려도 가로·세로 스크롤 자리를 지킨다 */
  function bindAttend() {
    const box = $('#atResults'); if (!box) return;
    const w0 = $('#atWrap'), sx = w0 ? w0.scrollLeft : 0, sy = w0 ? w0.scrollTop : 0, y = window.scrollY;
    box.innerHTML = AT.results();
    AT.bindGrid(toast);
    const w = $('#atWrap'); if (w) { w.scrollLeft = sx; w.scrollTop = sy; }
    window.scrollTo(0, y);
    $('#atPeople')?.addEventListener('toggle', ev => { AT.ui.showPeople = ev.target.open; });
    $('#atSrc')?.addEventListener('toggle', ev => { AT.ui.showSrc = ev.target.open; });
  }
  /** 출석부 A4 가로 한 장에 맞추기 */
  function fitAttend() {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:-10000px;top:0;width:281mm;visibility:hidden';
    document.body.appendChild(box);
    const limit = 192 * 96 / 25.4;
    let html = '';
    for (const scale of [1, 0.92, 0.85, 0.78, 0.7, 0.62]) {
      html = AT.doc(scale); box.innerHTML = html;
      const art = box.querySelector('.at-doc'); art.classList.add('measure');
      if (art.getBoundingClientRect().height <= limit) break;
    }
    box.remove();
    return html;
  }
  /* ---------- 현재 접속자 ---------- */
  const TAB_ID = Math.random().toString(36).slice(2);
  let online = [];
  const PAGE_NAME = { dashboard: '대시보드', biz: '사업체 개발', map: '지도', cards: '명함', network: '네트워크', schedule: '일정', contacts: '연락이력', perf: '실적', attend: '출석부', data: '데이터 관리' };
  async function pingPresence() {
    if (!S.REMOTE) return;
    const r = await S.presence({ id: TAB_ID, name: S.me(), page: route() });
    if (Array.isArray(r)) { online = r; drawPresence(); }
  }
  function drawPresence() {
    const box = $('#presence'); if (!box) return;
    if (!S.REMOTE || !online.length) { box.hidden = true; return; }
    box.hidden = false;
    const me = S.accessInfo().me;
    const label = p => V.accName(p.email) || p.name || (p.email ? p.email.split('@')[0] : '사용자');
    const ago = at => { const s = Math.round((Date.now() - at) / 1000); return s < 60 ? '지금' : `${Math.floor(s / 60)}분 전`; };
    const sorted = [...online].sort((a, b) => (b.email === me) - (a.email === me) || b.at - a.at);
    box.innerHTML = `<button type="button" class="presence-btn" data-act="presence-toggle" aria-haspopup="true" title="지금 사이트를 쓰고 있는 사람">
        <span class="presence-dot"></span><span class="presence-avs">${sorted.slice(0, 4).map(p => `<i title="${U.esc(label(p))}">${U.esc(label(p).slice(0, 1))}</i>`).join('')}</span><b>${sorted.length}명</b> 접속 중</button>
      <div class="presence-menu" id="presenceMenu" hidden><div class="sub">최근 2분 안에 사이트를 쓴 사람</div>
        ${sorted.map(p => `<div class="presence-row"><i>${U.esc(label(p).slice(0, 1))}</i><span><b>${U.esc(label(p))}</b>${p.email === me ? ' <span class="sub">(나)</span>' : ''}<small>${U.esc(p.email || '')}</small></span><span class="sub">${U.esc(PAGE_NAME[p.page] || p.page || '')} · ${ago(p.at)}</span></div>`).join('')}</div>`;
  }
  /** 파일 고르기 창 (여러 개 가능) */
  function pickFiles(accept, multiple, onPick) {
    const f = document.createElement('input'); f.type = 'file'; f.accept = accept; f.multiple = multiple;
    f.onchange = () => { const files = [...f.files]; if (files.length) onPick(files); };
    f.click();
  }
  function bindPerf() { $('#perfResults').innerHTML = V.perfResults(); }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove(); return ok;
    }
  }
  function printHtml(html) {
    const root = $('#printRoot');
    root.innerHTML = html;
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 1000); }, 50);
  }
  function bindSched() {
    $('#evList').innerHTML = V.evList();
    $('#calBox').innerHTML = V.calendar();
  }
  /** 한 사람의 메뉴 권한 저장. 전부 기본값이면 지운다 */
  async function savePerms(email, p) {
    let all = {};
    try { all = JSON.parse(S.get().settings.perms || '{}') || {}; } catch { all = {}; }
    const clean = Object.fromEntries(Object.entries(p || {}).filter(([k, v]) => v !== (k === 'map' ? 'view' : 'full')));
    if (Object.keys(clean).length) all[email] = clean; else delete all[email];
    await S.saveSettings({ perms: JSON.stringify(all) });
  }
  /** 사용 권한 저장: 관리자 = 관리자로 고른 사람, 사용할 수 있는 사람 = 목록 전체. 저장하는 나는 늘 목록에 남긴다 */
  async function saveAcc(rows) {
    const { me, owner } = S.accessInfo();
    if (me && me !== owner && !rows.some(r => r.email === me)) rows.push({ email: me, admin: true });
    await S.saveSettings({ admins: rows.filter(r => r.admin).map(r => r.email).join(','), members: rows.map(r => r.email).join(',') });
  }
  function bindData() {
    if ($('#xlsxFile')) $('#xlsxFile').onchange = async ev => {
      if (!['merge', 'replace'].includes(xlsxMode)) xlsxMode = 'replace';
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const { next, found } = S.parseXlsx(await file.arrayBuffer());
        if (!found.length) { toast('알맞은 시트를 찾지 못했습니다. 시트 이름이 사업체·네트워크·명함·활동기록·일정인지 확인하세요.', 'error'); return; }
        if (xlsxMode === 'merge') {
          const names = { businesses: '사업체', networks: '기관', cards: '명함', activities: '활동', events: '일정', perfs: '실적', trips: '출장·특근', jobPeople: '일자리참여자', attends: '출석부', trainPlans: '훈련일정' };
          if (!(await confirmBox('엑셀 내용을 합칠까요?', `${found.join(', ')} 시트를 읽었어요. 지금 데이터는 그대로 두고, 이 파일에만 있는 기록을 더해요. 이미 있는 기록(같은 ID)은 건너뛰어요.`, '합치기'))) return;
          const r = await S.mergeIn(next);
          const parts = Object.entries(r.added).map(([k, n]) => `${names[k] || k} ${n}`);
          toast(r.total || r.staff ? `합쳤어요: ${[...parts, r.staff ? `직원 ${r.staff}명` : ''].filter(Boolean).join(' · ')}` : '새로 더할 기록이 없어요. 이미 모두 들어 있어요.');
          return;
        }
        const ok = await confirmBox('엑셀 데이터로 교체할까요?', `${found.join(', ')} 시트에서 사업체 ${next.businesses.length}곳, 기관 ${next.networks.length}곳, 명함 ${next.cards.length}장, 활동 ${next.activities.length}건, 일정 ${next.events.length}건, 실적 ${next.perfs.length}건, 출장·특근 ${next.trips.length}건, 일자리참여자 ${next.jobPeople.length}명, 출석부 ${next.attends.length}줄, 훈련일정 ${next.trainPlans.length}칸, 직원 ${(next.settings.staff || []).length}명을 읽었습니다. 지금 데이터는 모두 이 파일 내용으로 교체됩니다.`, '교체');
        if (!ok) return;
        next.isDemo = false;
        await S.replace(next);
        toast('엑셀 데이터를 불러왔습니다.');
      } catch (err) { console.error(err); toast(err.drm ? err.message : '엑셀 파일을 읽지 못했습니다. 내보내기 양식과 같은 형식인지 확인하세요.', 'error'); }
    };
    if ($('#jsonFile')) $('#jsonFile').onchange = async ev => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const next = JSON.parse(await file.text());
        if (!next.version || !Array.isArray(next.businesses)) throw new Error('형식 오류');
        if (!(await confirmBox('백업 파일로 복원할까요?', `사업체 ${next.businesses.length}곳, 명함 ${next.cards.length}장이 들어 있습니다. 지금 데이터는 모두 교체됩니다.`, '복원'))) return;
        next.isDemo = false;
        await S.replace(next);
        toast('백업에서 복원했습니다.');
      } catch { toast('백업 파일을 읽지 못했습니다. 이 프로그램에서 받은 JSON 파일인지 확인하세요.', 'error'); }
    };
    if ($('#accNew')) $('#accNew').onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); A['acc-add'](); } };
    if ($('#meSel')) $('#meSel').onchange = ev => { S.setMe(ev.target.value); toast(`이 PC 사용자를 ${ev.target.value}(으)로 정했습니다.`); };
  }

  /* ---------- Drawer ---------- */
  let stack = [];
  let inlineEdit = false;
  const drawer = $('#drawer');
  function drawerOpen() { return drawer.classList.contains('open'); }
  function showDrawer() {
    drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    $('#scrim').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  /** 구글 캘린더에서 넣은 일정 가져오기 (3분에 한 번까지) */
  let calPullAt = 0;
  function maybeCalPull(force) {
    const st = S.get().settings;
    if (!S.REMOTE || !st.calId || st.calPull === 'N') return Promise.resolve(null);
    if (!force && Date.now() - calPullAt < 180000) return Promise.resolve(null);
    calPullAt = Date.now();
    return S.call('api_calPull').then(r => { if (r && (r.added || r.changed || r.removed)) return S.reload().then(() => r); return r; }).catch(err => { if (force) throw err; return null; });
  }
  function closeDrawer() {
    stack = [];
    drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
    $('#scrim').hidden = true;
    document.body.style.overflow = '';
    setTimeout(() => { if (!drawerOpen()) $('#drawerInner').innerHTML = ''; }, 250);
  }
  /* ---------- 담당자 정리: 고른 직원의 이름과 그 사람이 담당한 기록을 지운다 ---------- */
  function staffRecords(name) {
    const st = S.get(), none = name === '';
    const mine = x => (none ? !x.staff : x.staff === name);
    const biz = st.businesses.filter(mine), net = st.networks.filter(mine);
    const ids = new Set([...biz.map(b => 'biz' + b.id), ...net.map(n => 'net' + n.id)]);
    const onT = x => x.targetType && ids.has(x.targetType + x.targetId);
    return {
      biz, net,
      cards: st.cards.filter(c => c.linkType && ids.has(c.linkType + c.linkId)),
      acts: st.activities.filter(a => (none ? false : a.staff === name) || onT(a)),
      evs: st.events.filter(x => (none ? false : x.staff === name) || onT(x)),
      perfs: none ? [] : st.perfs.filter(mine), trips: none ? [] : st.trips.filter(mine),
    };
  }
  function staffCleanHtml(st) {
    const rows = [...S.staff().map(x => x.name), ''].map(n => {
      const r = staffRecords(n), tot = r.biz.length + r.net.length + r.acts.length + r.evs.length + r.perfs.length + r.trips.length;
      if (n === '' && !r.biz.length && !r.net.length) return '';
      const prog = n ? S.programOf(n) : '';
      return `<label class="sc-item ${st.pick.has(n) ? 'on' : ''}"><input type="checkbox" data-act="sc-pick" data-name="${U.esc(n)}" ${st.pick.has(n) ? 'checked' : ''}>
        <span class="sc-main"><span class="sc-top">${n ? V.staffDot(n) : ''}<b>${n ? U.esc(n) : '(담당 직원 없음)'}</b> <span class="sub">${n ? U.esc(prog || '소속 미지정') : '담당 칸이 빈 사업체·기관'}</span></span>
        <span class="meta">사업체 ${r.biz.length} · 기관 ${r.net.length} · 연결 명함 ${r.cards.length} · 활동 ${r.acts.length} · 일정 ${r.evs.length} · 실적 ${r.perfs.length} · 출장·특근 ${r.trips.length}${tot ? '' : ' · 기록 없음'}</span>
        ${r.biz.length ? `<span class="meta">사업체: ${r.biz.slice(0, 6).map(b => U.esc(b.name)).join(', ')}${r.biz.length > 6 ? ` 외 ${r.biz.length - 6}곳` : ''}</span>` : ''}</span></label>`;
    }).join('');
    const n = st.pick.size;
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">담당자 정리</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div>
      <p class="sub" style="margin:0">고른 직원이 담당한 <b>사업체·기관과 그 활동·일정·연결 명함, 실적·출장·특근 기록</b>을 지우고, 직원 목록에서도 뺍니다.</p></div>
      <div class="dr-body"><div class="sc-list">${rows}</div>
        <div class="sc-move"><b>지우지 말고 옮기기</b><span class="sub">잘못된 이름으로 들어간 기록이면, 고른 사람의 기록을 아래 직원 이름으로 바꿔요.</span>
          <div class="inline"><select class="select" id="scMoveTo">${S.staff().filter(x => !st.pick.has(x.name)).map(x => `<option>${U.esc(x.name)}</option>`).join('')}</select><button class="btn" type="button" data-act="sc-move" ${n ? '' : 'disabled'}>고른 사람 기록을 이 직원으로 옮기기</button></div></div>
        <label class="check" style="margin-top:12px"><input type="checkbox" data-act="sc-keepname" ${st.keepName ? 'checked' : ''}>직원 이름은 목록에 남기기 (기록만 지우기)</label>
        <p class="form-notice" style="margin-top:12px">지운 기록은 되돌릴 수 없어요. 필요하면 먼저 <b>엑셀로 내보내기</b>로 백업해 두세요.</p></div>
      <div class="dr-foot"><button class="btn" type="button" data-act="dr-close">취소</button><button class="btn btn-primary btn-danger" type="button" data-act="sc-commit" ${n ? '' : 'disabled'}>고른 ${n}명 정리</button></div>`;
  }

  /* ---------- 중복 한 번에 정리 ----------
   * 이름·전화·사업자번호(명함은 휴대전화·이메일·이름+소속)가 같은 것끼리 묶고, 묶음마다 하나만 남긴다 */
  const DEDUPE_WHAT = { biz: '사업체', net: '기관', card: '명함' };
  function dedupeGroups(kind) {
    const idx = S.dupIndex(kind), seen = new Set(), groups = [];
    const filled = x => Object.values(x).filter(v => v != null && v !== '' && !(Array.isArray(v) && !v.length)).length
      + (kind === 'card' ? (x.photo ? 5 : 0) : S.get().activities.filter(a => a.targetType === kind && a.targetId === x.id).length * 2);
    idx.forEach((_, id) => {
      if (seen.has(id)) return;
      const g = [], q = [id]; seen.add(id);
      while (q.length) { const cur = q.shift(); const x = S.find(kind, cur); if (x) g.push(x); (idx.get(cur) || []).forEach(d => { if (!seen.has(d.x.id)) { seen.add(d.x.id); q.push(d.x.id); } }); }
      if (g.length < 2) return;
      g.sort((a, b) => filled(b) - filled(a) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      const why = [...new Set(g.flatMap(x => (idx.get(x.id) || []).flatMap(d => d.why)))];
      groups.push({ items: g, keep: g[0].id, on: true, why });
    });
    return groups;
  }
  function dedupeHtml(st) {
    const e = U.esc;
    const what = DEDUPE_WHAT[st.kind], n = st.groups.filter(g => g.on).reduce((a, g) => a + g.items.length - 1, 0);
    const meta = x => (st.kind === 'card' ? [x.org, x.mobile, x.email] : [x.address, x.phone, x.bizNo]).filter(Boolean).map(e).join(' · ');
    const acts = x => (st.kind === 'card' ? '' : S.get().activities.filter(a => a.targetType === st.kind && a.targetId === x.id).length);
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">${what} 중복 한 번에 정리</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div>
      <p class="sub" style="margin:0">겹치는 묶음 <b>${st.groups.length}개</b>. 묶음마다 <b>남길 것</b>을 고르면 나머지의 빈 칸·${st.kind === 'card' ? '정보' : '활동 기록·일정·명함'}을 옮기고 지워요.</p></div>
      <div class="dr-body dd-body">${st.groups.length ? st.groups.map((g, gi) => `<section class="dd-grp ${g.on ? '' : 'off'}">
          <label class="dd-gh"><input type="checkbox" data-act="dedupe-on" data-g="${gi}" ${g.on ? 'checked' : ''}><b>묶음 ${gi + 1}</b> <span class="sub">${e(g.why.join(' · '))} · ${g.items.length}건</span>${g.on ? '' : ' <span class="badge">건너뜀</span>'}</label>
          ${g.items.map(x => `<label class="dd-item ${g.keep === x.id ? 'keep' : ''}"><input type="radio" name="dd${gi}" data-act="dedupe-keep" data-g="${gi}" data-id="${x.id}" ${g.keep === x.id ? 'checked' : ''} ${g.on ? '' : 'disabled'}>
            <span class="dd-main"><b>${e(x.name)}</b>${g.keep === x.id ? ' <span class="badge accent">남김</span>' : g.on ? ' <span class="badge dup">합쳐서 지움</span>' : ''}<span class="meta">${meta(x) || '정보 없음'}${acts(x) ? ` · 활동 ${acts(x)}건` : ''}${x.createdAt ? ` · 등록 ${U.dateDot(String(x.createdAt).slice(0, 10))}` : ''}</span></span></label>`).join('')}
        </section>`).join('') : `<p class="empty">겹치는 ${what}가 없어요. 깔끔해요 👍</p>`}</div>
      <div class="dr-foot"><button class="btn" type="button" data-act="dr-close">닫기</button><button class="btn btn-primary" type="button" data-act="dedupe-commit" ${n ? '' : 'disabled'}>${n}건 합쳐서 정리</button></div>`;
  }
  /* ---------- 복지관 사업실적 시트로 보내기 ---------- */
  /** 한 달 실적(실적 화면에서 넣은 것)을 기관 시트 모양으로: 사람마다 세는 항목 → gen(실적(일반)), 건수만 → etc(실적(기타)) */
  function orgPerfRows(month) {
    const st = S.get(), gen = [], etc = [], noName = [];
    Object.keys(D.PERF_SETS).forEach(set => DP.lines(set, month, st).forEach(l => {
      const rec = l.kind === 'perf' ? S.find('perf', l.id) || {} : {};
      const where = l.name || '';
      if (S.NO_PEOPLE.has(l.item)) {
        etc.push({ date: l.d, item: l.item, people: rec.people || '', newPeople: rec.newPeople || '', round: rec.round || '', note: where || l.content || '' });
      } else if ((l.ppl || []).length) {
        l.ppl.forEach(name => gen.push({ name, date: l.d, item: l.item, round: rec.round || '', note: where }));
      } else noName.push(l);
    }));
    return { gen, etc, noName };
  }
  /** 이용자입력에 없는 이름: 미리보기에서 바로 적어 복지관 시트 '이용자입력'에 등록 */
  function orgUserFormHtml(r) {
    const e = U.esc, f = r.userForm || {}, names = Object.keys(r.unknown);
    const dl = (id, list) => `<datalist id="${id}">${(list || []).map(v => `<option value="${e(v)}">`).join('')}</datalist>`;
    const sel = (k, list, def = '') => `<select class="select sm" data-ou="${k}"><option value="">-</option>${(list || []).map(v => `<option ${v === def ? 'selected' : ''}>${e(v)}</option>`).join('')}</select>`;
    const no = i => (f.year && f.next ? `${f.year}-${String(f.next + i).padStart(5, '0')}` : '');
    return `<div class="ou-box"><p class="form-notice">⚠ 복지관 시트 <b>이용자입력</b>에 없는 이름 ${names.length}명이에요. 이대로 보내면 이용자번호·장애유형 칸이 비고 <b>월별 이용자명단에서 빠져요</b>. 아래에 적고 <b>이용자입력에 등록</b>을 누르세요. 이름이 틀린 거면 실적 화면에서 이름을 고쳐 주세요.</p>
      ${dl('ouType', f.type)}${dl('ouTown', f.town)}${dl('ouIncome', f.income)}${dl('ouCity', f.city)}
      <div class="table-wrap"><table class="tbl ou-tbl"><thead><tr><th></th><th>이름</th><th>이용자번호</th><th>성별</th><th>생년월일</th><th>장애유형</th><th>장애정도</th><th>지역</th><th>읍면동</th><th>소득구분</th><th>비고</th></tr></thead><tbody>
      ${names.map((n, i) => `<tr data-ou-row="${e(n)}"><td><input type="checkbox" data-ou="on" checked aria-label="${e(n)} 등록"></td><th class="nowrap">${e(n)} <span class="sub">${r.unknown[n]}줄</span></th>
        <td><input class="input sm num" data-ou="no" value="${e(no(i))}" placeholder="2026-00000" style="width:110px"></td>
        <td>${sel('sex', f.sex && f.sex.length ? f.sex : ['남', '여'])}</td>
        <td><input class="input sm" type="date" data-ou="birth"></td>
        <td><input class="input sm" data-ou="type" list="ouType" style="width:110px"></td>
        <td>${sel('grade', f.grade)}</td>
        <td><input class="input sm" data-ou="city" list="ouCity" value="${e((f.city || [])[0] || '화성시')}" style="width:80px"></td>
        <td><input class="input sm" data-ou="town" list="ouTown" style="width:90px"></td>
        <td><input class="input sm" data-ou="income" list="ouIncome" style="width:120px"></td>
        <td><input class="input sm" data-ou="note" style="width:100px"></td></tr>`).join('')}
      </tbody></table></div>
      <div class="inline" style="margin-top:8px"><button class="btn btn-primary" type="button" data-act="org-user-add">✔ 고른 사람 이용자입력에 등록</button><span class="sub">이용자번호는 지금 시트의 마지막 번호 다음으로 채워 뒀어요. 복지관 시스템 번호가 따로 있으면 그 번호로 고쳐 주세요.</span></div></div>`;
  }
  async function orgSyncRun(top, commit) {
    const rows = orgPerfRows(top.month);
    top.rows = rows; top.busy = true; top.err = ''; renderDrawer(true);
    try {
      top.res = await S.call('api_orgPerfSync', { month: top.month, gen: rows.gen, etc: rows.etc, commit: !!commit, sheet: S.get().settings.orgPerfSheet || '' });
      if (commit) top.done = top.res;
    } catch (err) { top.err = (err && err.message) || String(err); }
    top.busy = false; renderDrawer(true);
  }
  function orgSyncHtml(top) {
    const e = U.esc, r = top.res, rows = top.rows || { gen: [], etc: [], noName: [] }, m = +top.month.slice(5);
    const list = (o, f) => Object.entries(o || {}).map(([k, n]) => `<li>${f(k)} <span class="sub">${n}줄</span></li>`).join('');
    let body;
    if (top.busy) body = `<p class="sub">${top.done === undefined && !r ? '복지관 실적 시트를 읽고 비교하는 중이에요… (10~30초)' : '처리하는 중이에요…'}</p><div class="skel" style="height:22px;width:70%"></div><div class="skel" style="height:120px"></div>`;
    else if (top.err) body = `<p class="form-notice">보내지 못했어요: ${e(top.err)}</p><p class="sub">처음 쓸 때는 다른 스프레드시트에 쓰는 권한이 새로 필요해요. Code.gs를 새로 붙여 넣고 새 버전으로 배포한 뒤, 사이트를 열 때 나오는 권한 창에서 허용해 주세요. 복지관 실적 시트에 <b>편집 권한</b>이 있어야 해요.</p>`;
    else if (top.done) body = `<div class="st-sum good">✅ 보냈어요: 실적(일반) <b>${top.done.add.gen}줄</b> · 실적(기타) <b>${top.done.add.etc}줄</b>${top.done.dup.gen + top.done.dup.etc ? `<br><small>이미 들어 있던 ${top.done.dup.gen + top.done.dup.etc}줄은 건너뛰었어요.</small>` : ''}</div><p><a class="btn" href="${e(top.done.url)}" target="_blank" rel="noopener">복지관 실적 시트 열기 ↗</a></p>`;
    else if (r) body = `<p>보낼 곳: <b>${e(r.title)}</b> <a class="sub" href="${e(r.url)}" target="_blank" rel="noopener">열기 ↗</a></p>
        <table class="tbl"><thead><tr><th>탭</th><th class="r">새로 넣을 줄</th><th class="r">이미 있어서 건너뜀</th></tr></thead><tbody>
          <tr><th>실적(일반) <span class="sub">이름별 · 직업상담·취업알선 등</span></th><td class="r num"><b>${r.add.gen}</b></td><td class="r num">${r.dup.gen}</td></tr>
          <tr><th>실적(기타) <span class="sub">건수만 · 사업체개발·사업체관리 등</span></th><td class="r num"><b>${r.add.etc}</b></td><td class="r num">${r.dup.etc}</td></tr></tbody></table>
        ${Object.keys(r.unknown || {}).length ? orgUserFormHtml(r) : ''}
        ${Object.keys(r.badItems || {}).length ? `<p class="form-notice">⚠ 복지관 시트 <b>실적분류설정</b>에 없는 세부사업이라 빼고 보내요.</p><ul class="sub">${list(r.badItems, e)}</ul>` : ''}`;
    else body = '';
    const nn = rows.noName.length ? `<details class="pd-grp" open><summary><b>참여자 이름이 없어 못 보내는 실적 ${rows.noName.length}줄</b></summary><p class="sub">실적(일반)은 이름마다 한 줄이라 이름이 있어야 해요. 실적 화면에서 참여자 이름을 넣고 다시 확인하세요.</p><ul class="sub">${rows.noName.slice(0, 30).map(l => `<li>${U.dateDot(l.d)} · ${e(l.item)} · ${e(l.name || l.content || '')} · ${e(l.staff)}</li>`).join('')}</ul></details>` : '';
    const can = r && !top.done && !top.busy && !top.err && r.add.gen + r.add.etc > 0;
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">📤 ${m}월 실적을 복지관 실적 시트로</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div>
      <p class="sub" style="margin:0">실적 화면에 넣은 ${m}월 실적(현장중심·고용지원)을 복지관 시트의 노란 칸에만 적어요. 여러 번 눌러도 같은 줄은 두 번 들어가지 않아요.</p></div>
      <div class="dr-body">${body}${nn}</div>
      <div class="dr-foot"><button class="btn" type="button" data-act="dr-close">닫기</button>${top.done ? '' : `<button class="btn" type="button" data-act="org-sync-check" ${top.busy ? 'disabled' : ''}>다시 확인</button><button class="btn btn-primary" type="button" data-act="org-sync-commit" ${can ? '' : 'disabled'}>${r ? `${r.add.gen + r.add.etc}줄 보내기` : '보내기'}</button>`}</div>`;
  }
  function renderDrawer(keepScroll) {
    const top = stack[stack.length - 1];
    if (!top) return closeDrawer();
    const inner = $('#drawerInner');
    inner.dataset.tone = '';
    const oldScroll = keepScroll ? inner.querySelector('.dr-body')?.scrollTop : 0;
    let v;
    if (top.type === 'kead') {
      inner.innerHTML = IMP.keadHtml(top.state);
      showDrawer();
      return;
    }
    if (top.type === 'dpsum') {
      inner.innerHTML = DP.sumHtml(top);
      showDrawer();
      return;
    }
    if (top.type === 'dpitem') {
      inner.innerHTML = DP.itemHtml(top);
      showDrawer();
      return;
    }
    if (top.type === 'orgsync') {
      inner.innerHTML = orgSyncHtml(top);
      showDrawer();
      return;
    }
    if (top.type === 'orprev') {
      inner.innerHTML = OR.previewHtml(top);
      showDrawer();
      return;
    }
    if (top.type === 'staffclean') {
      inner.innerHTML = staffCleanHtml(top);
      showDrawer();
      return;
    }
    if (top.type === 'selftest') {
      const r = top.res, ok = r.sheets.filter(x => x.ok === true).length, bad = r.sheets.filter(x => x.ok === false);
      inner.innerHTML = `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">저장 점검 결과</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div>
        <p class="sub" style="margin:0">${U.esc(r.me || '')} · ${r.admin ? '관리자' : '사용자'} · 구글 시트에 시험 줄을 쓰고 지워 봤어요.</p></div>
        <div class="dr-body">
          <div class="st-sum ${bad.length ? 'bad' : 'good'}">${bad.length ? `⚠ ${bad.length}개 시트에 저장이 안 돼요` : `✅ ${ok}개 시트 모두 정상 저장돼요`}${top.wait ? `<br><small>이 컴퓨터에 아직 못 보낸 기록 ${top.wait}건이 있어요. 아래 '지금 다시 보내기'를 누르세요.</small>` : '<br><small>보관함에 못 보낸 기록도 없어요.</small>'}</div>
          <table class="tbl st-tbl"><thead><tr><th>시트</th><th>결과</th><th>내용</th></tr></thead><tbody>${r.sheets.map(x => `<tr><th>${U.esc(x.sheet)}</th><td>${x.ok === true ? '<span class="badge success">정상</span>' : x.ok === false ? '<span class="badge dup">안 됨</span>' : '<span class="badge">건너뜀</span>'}</td><td class="wrap">${U.esc(x.msg)}</td></tr>`).join('')}</tbody></table>
          ${bad.some(x => /Authorization|권한|authoriz/i.test(x.msg)) ? '<p class="form-notice">Apps Script 권한 승인이 필요해 보여요. Apps Script 편집기에서 <b>api_selfTest</b> 함수를 한 번 실행해 권한을 허용한 뒤, 배포 관리 → 새 버전으로 다시 배포하세요.</p>' : ''}
        </div>
        <div class="dr-foot"><button class="btn" type="button" data-act="dr-close">닫기</button>${top.wait ? '<button class="btn btn-primary" type="button" data-act="outbox-flush">지금 다시 보내기</button>' : ''}<button class="btn" type="button" data-act="self-test">다시 점검</button></div>`;
      showDrawer();
      return;
    }
    if (top.type === 'dedupe') {
      inner.innerHTML = dedupeHtml(top);
      showDrawer();
      return;
    }
    if (top.type === 'cardbulk') {
      inner.innerHTML = cardBulkHtml(top.state);
      showDrawer();
      bindCardBulk(top.state);
      if (oldScroll) inner.querySelector('.dr-body').scrollTop = oldScroll;
      return;
    }
    if (top.type === 'bulk') {
      inner.innerHTML = IMP.html(top.state);
      showDrawer();
      IMP.bind(top.state, () => renderDrawer(true));
      if (oldScroll) inner.querySelector('.dr-body').scrollTop = oldScroll;
      return;
    }
    if (top.type === 'paste') {
      inner.innerHTML = R.pasteDialog(top.state);
      showDrawer();
      const box = $('#ctPasteBox');
      box.oninput = U.debounce(() => {
        const { rows, skipped } = R.parsePaste(box.value);
        top.state = { text: box.value, rows, skipped, who: $('#ctPasteWho')?.value || top.state.who };
        renderDrawer(true);
        $('#ctPasteBox').focus();
        $('#ctPasteBox').setSelectionRange(9e9, 9e9);
      }, 250);
      if (!keepScroll) box.focus();
      return;
    }
    if (top.type === 'loading') {
      inner.innerHTML = `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">${U.esc(top.title)}</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div></div>
        <div class="dr-body"><p class="sub">${U.esc(top.body || '')}</p><div class="skel" style="height:22px;width:60%"></div><div class="skel" style="height:22px;width:85%"></div><div class="skel" style="height:160px"></div></div>`;
      showDrawer();
      return;
    }
    if (top.type.startsWith('sv')) {
      const b = S.find('biz', top.id);
      if (!b) { stack.pop(); return renderDrawer(); }
      const j = (b.jobAnalyses || []).find(x => x.id === top.job);
      inner.innerHTML = top.type === 'svBiz' ? SV.bizForm(b)
        : top.type === 'svJob' ? SV.jobForm(b, j)
        : top.type === 'svBizView' ? SV.viewer(`사업체정보지 · ${U.esc(b.name)}`, SV.bizDoc(b), 'sv-biz-edit', b.id)
        : SV.viewer(`직무분석지 · ${U.esc(j?.jobName || '')}`, SV.jobDoc(b, j || {}), 'sv-job-edit', b.id, top.job);
      showDrawer();
      if (!keepScroll) inner.querySelector('.dr-body').scrollTop = 0; else if (oldScroll) inner.querySelector('.dr-body').scrollTop = oldScroll;
      return;
    }
    if (top.type === 'detail') {
      const x = S.find(top.kind, top.id);
      if (!x) { stack.pop(); return renderDrawer(); }
      v = { biz: V.detailBiz, net: V.detailNet, card: V.detailCard }[top.kind](x, stack.length > 1);
    } else {
      const x = top.id ? S.find(top.kind, top.id) : null;
      v = { biz: () => F.biz(x, top.preset, top.focus), net: () => F.net(x, top.preset), card: () => F.card(x, top.preset), ev: () => F.event(x, top.preset) }[top.kind]();
    }
    inner.innerHTML = v.html;
    // 무엇을 보고 있는지 색으로 구분: 사업체(노랑)·지원고용(빨강)·기관(검정)·복지관(금색)·명함(청록)·일정(파랑)
    const cur = top.id ? S.find(top.kind, top.id) : null;
    inner.dataset.tone = top.kind === 'biz' ? S.bizTone(cur) : top.kind === 'net' ? (cur && S.isHome(cur) ? 'home' : 'net') : top.kind === 'card' ? 'card' : 'ev';
    showDrawer();
    const form = inner.querySelector('#entityForm');
    if (v.after) v.after(form);
    const body = inner.querySelector('.dr-body');
    if (body && oldScroll) body.scrollTop = oldScroll;
    const fkey = form && (form.dataset.focus || top.focus);
    const focusEl = fkey ? form.querySelector(`[name="${fkey}"]`) : null;
    if (focusEl) { focusEl.scrollIntoView({ block: 'center' }); focusEl.focus({ preventScroll: true }); }
    else if (!keepScroll) (form ? form.querySelector('input:not([type=hidden]):not([type=file]), select') : inner.querySelector('.dr-title'))?.focus?.({ preventScroll: true });
  }
  function push(entry, fromDrawer) {
    if (!fromDrawer) stack = [];
    stack.push(entry);
    renderDrawer();
  }
  const openDetail = (kind, id, fromDrawer) => (kind === 'ev' ? push({ type: 'form', kind: 'ev', id }, fromDrawer) : push({ type: 'detail', kind, id }, fromDrawer));

  /** 명함으로 네트워크 기관·사업체를 새로 만들고 명함을 연결한다. 위치를 못 정하면 바로 위치 입력 창을 연다 */
  async function registerFromCard(c, to, name, category, fromDrawer) {
    name = name || c.org || c.name;
    // 같은 곳이 이미 있으면 새로 만들지 말고 연결할지 먼저 묻는다
    const same = S.dupesOf(to, { name, phone: c.phone || '' })[0] || S.matchPlaces({ org: name }).find(m => m.kind === to);
    const ex = same && (same.x || same);
    if (ex && ex.id && (await confirmBox('이미 등록된 곳이 있어요', `${to === 'biz' ? '사업체 개발' : '네트워크'}에 '${ex.name}'이(가) 있어요. 새로 만들지 않고 여기에 명함을 연결할까요?`, '기존 곳에 연결'))) {
      S.linkCard(c.id, to, ex.id);
      toast(`명함을 '${ex.name}'에 연결했어요.`);
      openDetail(to, ex.id, fromDrawer);
      return ex;
    }
    const base = { name, address: c.address || '', area: c.area || '', lat: c.lat ?? null, lng: c.lng ?? null, approx: !!c.approx, staff: S.me() };
    const rec = to === 'biz'
      ? S.upsert('biz', { ...base, stage: '발굴', discoveredAt: U.isDate(c.metAt) ? c.metAt : U.today(), source: '명함', phone: c.phone || '', placements: 0 })
      : S.upsert('net', { ...base, category: category || D.guessCategory(name), status: '보통', since: c.metAt || U.today(), relation: '', promo: '' });
    if (to === 'biz') S.upsert('act', { targetType: 'biz', targetId: rec.id, date: rec.discoveredAt, type: '발굴', content: `명함(${c.name})으로 사업체 등록`, staff: S.me() });
    S.upsert('card', { id: c.id, linkType: to, linkId: rec.id });
    bigMap?.closePopup();
    const where = to === 'biz' ? '사업체 개발' : `네트워크(${rec.category})`;
    if (!M.hasPos(S.find(to, rec.id)) && rec.address) {
      // 도로명 주소처럼 읍면동이 없으면 인터넷 지도에서 주소로 위치를 먼저 찾아 본다
      push({ type: 'loading', title: '지도 위치를 찾는 중', body: `${rec.address} 의 위치를 찾고 있어요.` }, fromDrawer);
      await Promise.race([S.refine(to, rec.id), new Promise(r => setTimeout(r, 12000))]);
      stack.pop();
    }
    if (!M.hasPos(S.find(to, rec.id))) {
      // 주소가 없거나 읍면동을 못 찾으면 지도에 못 나오므로 바로 위치를 정하게 한다
      toast(`'${name}'을(를) ${where}에 등록했어요. ${rec.address ? '주소로 지도 위치를 찾지 못했어요' : '명함에 주소가 없어 지도 위치를 못 정했어요'}. 주소를 고치거나 지도를 눌러 위치를 정해 주세요.`, 'error');
      push({ type: 'form', kind: to, id: rec.id, focus: 'address' }, fromDrawer);
      return rec;
    }
    toast(`'${name}'을(를) ${where}에 등록하고 명함을 연결했습니다.${S.find(to, rec.id).approx ? ' (지도에는 대략적인 위치로 표시돼요)' : ''}`);
    openDetail(to, rec.id, fromDrawer);
    return rec;
  }
  /** 저장 알림 + 지도 연결: 위치가 있으면 "지도에서 보기", 없으면 "위치 정하기" */
  function mapToast(kind, rec, msg) {
    if (!['biz', 'net', 'card'].includes(kind)) return toast(msg);
    if (kind === 'card' && rec.linkType) {
      const t = S.find(rec.linkType, rec.linkId);
      return toast(`${msg} ${t ? `'${t.name}'에 연결된 명함이라 지도에서 그곳을 누르면 보여요.` : ''}`, '', t && M.hasPos(t) ? { action: { label: '📍 지도에서 보기', run: () => A['map-show']({ dataset: { kind: rec.linkType, id: t.id } }) } } : {});
    }
    const run = () => A['map-show']({ dataset: { kind, id: rec.id } });
    // 주소로 위치를 찾는 중이면 잠시 뒤 다시 확인한다
    const cur = S.find(kind, rec.id) || rec;
    if (M.hasPos(cur)) return toast(`${msg} 지도에도 ${cur.approx ? '대략적인 위치로 ' : ''}표시돼요.`, '', { action: { label: '📍 지도에서 보기', run } });
    if (kind === 'card') return toast(`${msg} 명함에 주소가 없어 지도에는 안 나와요. 사업체·기관에 연결하면 그곳 위치로 보여요.`);
    toast(`${msg} 주소가 없어 아직 지도에 안 나와요.`, 'error', { action: { label: '위치 정하기', run: () => push({ type: 'form', kind, id: rec.id, focus: 'address' }, true) } });
  }
  async function onSubmit(form) {
    const res = F.collect(form);
    if (!res) return;
    const { kind, obj } = res;
    const id = form.dataset.id;
    if (id) obj.id = id;
    if (!id && ['biz', 'net', 'card'].includes(kind)) {
      const d = S.dupesOf(kind, obj);
      const list = d.slice(0, 3).map(x => `'${x.x.name}${kind === 'card' && x.x.org ? ' · ' + x.x.org : ''}' (${x.why.join(', ')})`).join(', ');
      if (d.length && !(await confirmBox('이미 비슷한 게 있어요', `${list}${d.length > 3 ? ` 외 ${d.length - 3}건` : ''}. 그래도 새로 등록할까요? 등록한 뒤에도 상세 화면에서 합칠 수 있어요.`, '그래도 등록'))) return;
    }
    // 연락이력에만 있던 같은 이름의 곳(미등록)이 있으면 그 기록을 이어받는다
    const top0 = stack[stack.length - 1] || {};
    const adopt = top0.adopt && S.find('biz', top0.adopt);
    const pend = !id && (kind === 'biz' || kind === 'net') ? (adopt && S.isPending(adopt) ? adopt : S.get().businesses.find(b => S.isPending(b) && U.orgKey(b.name) === U.orgKey(obj.name))) : null;
    if (pend && kind === 'biz') { obj.id = pend.id; obj.pending = ''; }
    const before = id && kind === 'biz' ? (S.find('biz', id) || {}).discoveredAt : null;
    const saved = S.upsert(kind, obj);
    if (pend && kind === 'net') {
      const moves = S.get().activities.filter(a => a.targetType === 'biz' && a.targetId === pend.id).map(a => ({ id: a.id, targetType: 'net', targetId: saved.id }));
      if (moves.length) S.putMany('act', moves);
      S.remove('biz', pend.id);
    }
    if (id && kind === 'biz' && U.isDate(saved.discoveredAt) && before !== saved.discoveredAt) {
      const disc = S.get().activities.filter(a => a.targetType === 'biz' && a.targetId === id && a.type === '발굴');
      if (disc.length) S.putMany('act', disc.map(a => ({ id: a.id, date: saved.discoveredAt })));
    }
    if (kind === 'card' && res.extra) {
      stack.pop();
      registerFromCard(saved, res.extra.to, res.extra.name, res.extra.cat, false);
      return;
    }
    if (!id && kind === 'biz' && !pend) S.upsert('act', { targetType: 'biz', targetId: saved.id, date: saved.discoveredAt || U.today(), type: '발굴', content: saved.source ? `${saved.source}에서 찾아 사업체 등록` : '사업체 발굴 등록', staff: saved.staff || S.me() });
    // 간단 등록에서 담당자를 쓰면 명함도 만들어 이 사업체에 연결한다
    if (!id && kind === 'biz' && res.extra && res.extra.contact) {
      const ct = res.extra.contact, mob = /^01/.test(ct.phone.replace(/\D/g, ''));
      S.upsert('card', { name: ct.name, title: ct.title, org: saved.name, mobile: mob ? ct.phone : '', phone: mob ? '' : ct.phone, email: '', address: saved.address || '', linkType: 'biz', linkId: saved.id, metAt: saved.discoveredAt || U.today(), metWhere: saved.source || '', tags: ['사업체 담당자'], memo: '' });
    }
    mapToast(kind, saved, id ? '저장했습니다.' : '등록했습니다.');
    stack.pop();
    if (!id && kind !== 'ev' && !stack.length) stack.push({ type: 'detail', kind, id: saved.id });
    renderDrawer();
  }

  /* ---------- Search ---------- */
  let srIndex = 0, srItems = [];
  function openSearch() {
    $('#searchLayer').hidden = false;
    const q = $('#searchInput');
    q.value = ''; drawSearch('');
    setTimeout(() => q.focus(), 10);
  }
  function closeSearch() { $('#searchLayer').hidden = true; }
  function drawSearch(q) {
    const box = $('#searchResults');
    if (!q.trim()) { box.innerHTML = '<div class="empty">사업체명, 담당자 이름, 전화번호 뒷자리, 기관명으로 찾을 수 있습니다.</div>'; srItems = []; return; }
    const r = S.search(q);
    srItems = [];
    const row = (kind, x, main, meta, side) => { srItems.push([kind, x.id]); return `<div class="sr ${srItems.length - 1 === srIndex ? 'hi' : ''}" data-act="sr-open" data-i="${srItems.length - 1}"><div style="min-width:0"><div class="name">${main}</div><div class="meta">${meta}</div></div><div class="side">${side}</div></div>`; };
    const contactSide = (kind, id, la) => { const c = S.cardsOf(kind, id)[0]; return `${c ? `<div class="phone">${U.esc(c.name)} ${U.esc(c.mobile || c.phone || '')}</div>` : ''}${la ? `<div>최근 ${U.esc(la.type)} ${U.dateDot(la.date)}</div>` : ''}`; };
    let html = '';
    if (r.biz.length) html += `<div class="sr-group"><h4>사업체 개발</h4>${r.biz.map(b => row('biz', b, U.hl(b.name, q), `${U.esc(b.stage)} · ${U.esc(b.industry)} · ${U.esc(b.area || '')}`, contactSide('biz', b.id, S.lastAct('biz', b.id)))).join('')}</div>`;
    if (r.card.length) html += `<div class="sr-group"><h4>명함</h4>${r.card.map(c => row('card', c, `${U.hl(c.name, q)} <span class="meta">${U.esc(c.title || '')}</span>`, U.hl(c.org || '', q), `<div class="phone">${U.hl(c.mobile || c.phone || '', q)}</div>`)).join('')}</div>`;
    if (r.net.length) html += `<div class="sr-group"><h4>네트워크</h4>${r.net.map(n => row('net', n, U.hl(n.name, q), `${U.esc(n.category)} · 관계 ${U.esc(n.status)}`, contactSide('net', n.id, S.lastAct('net', n.id)))).join('')}</div>`;
    box.innerHTML = html || `<div class="empty"><strong>'${U.esc(q)}' 검색 결과가 없습니다</strong>이름 일부나 전화번호 뒷자리 4자리로 다시 찾아보세요.</div>`;
  }

  /* ---------- 파일·사진으로 등록 ---------- */
  const replaceTop = entry => { if (!stack.length) stack.push(entry); else stack[stack.length - 1] = entry; renderDrawer(); };
  const readDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

  async function handleBizFile(file) {
    if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
      try { push({ type: 'bulk', state: await IMP.start(file) }, false); }
      catch (err) { console.error(err); toast(err.drm ? err.message : '파일에서 표를 읽지 못했습니다. 첫 줄(또는 제목 아래 줄)에 사업체명·주소 같은 열 이름이 있는지 확인하세요.', 'error'); }
      return;
    }
    if (file.size > 20 * 1024 * 1024) return toast('파일이 너무 큽니다. 20MB 이하로 올려 주세요.', 'error');
    if (!AI.available()) return readBizFileLocal(file);
    push({ type: 'loading', title: '문서를 읽는 중', body: 'AI가 사업자등록증·구인공고에서 사업체 정보를 찾고 있습니다. 10~20초 걸립니다.' }, false);
    try {
      const data = file.type === 'application/pdf' ? await readDataUrl(file) : await F.resizeImage(file, 1800, .85);
      const r = await AI.readBizDoc(data);
      replaceTop({ type: 'form', kind: 'biz', preset: { ...r, employees: Number(String(r.employees).replace(/[^0-9]/g, '')) || '', source: '현장 발굴', _notice: 'AI가 문서에서 읽은 내용입니다. 틀린 곳이 없는지 확인한 뒤 등록하세요.' } });
    } catch (err) { closeDrawer(); toast('문서를 읽지 못했습니다: ' + err.message, 'error'); }
  }

  /** AI 키가 없을 때: PDF 글자를 직접 읽어 채우고, 못 읽으면 빈 등록 양식을 연다 */
  async function readBizFileLocal(file) {
    const blank = why => replaceTop({ type: 'form', kind: 'biz', preset: { source: '현장 발굴', _notice: why } });
    push({ type: 'loading', title: '문서를 읽는 중', body: 'PDF에서 사업체 정보를 찾고 있습니다.' }, false);
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      return blank(`사진(${file.name})은 AI 키가 있어야 글자를 읽을 수 있어요. 사진을 보며 아래 칸을 직접 채워 주세요. 데이터 관리 > AI 도우미에 키를 넣으면 다음부터 자동으로 채워집니다.`);
    }
    try {
      const text = await DT.pdfText(file);
      const r = DT.parseBiz(text);
      const got = ['name', 'ceo', 'bizNo', 'address', 'phone'].filter(k => r[k]);
      if (text.replace(/\s/g, '').length < 20) return blank('이 PDF는 스캔한 그림이라 글자를 읽을 수 없어요. 문서를 보며 아래 칸을 직접 채워 주세요. (AI 키가 있으면 스캔본도 읽을 수 있습니다)');
      replaceTop({ type: 'form', kind: 'biz', preset: { ...r, source: '현장 발굴', memo: r.name ? '' : text.slice(0, 400), _notice: got.length ? `PDF 글자에서 ${got.length}개 항목을 찾아 채웠어요. 틀린 곳이 없는지 꼭 확인하고 등록하세요.` : 'PDF에서 사업체 항목을 찾지 못해 읽은 글자를 메모 칸에 넣었어요. 필요한 내용을 옮겨 적어 주세요.' } });
    } catch (err) {
      console.error(err);
      blank('PDF를 읽지 못했어요 (' + err.message + '). 문서를 보며 아래 칸을 직접 채워 주세요.');
    }
  }

  function guessLink(org) {
    const k = U.orgKey(org);
    if (k.length < 2) return null;
    const hit = (list, kind) => { const x = list.find(o => { const n = U.orgKey(o.name); return n && (n === k || n.includes(k) || k.includes(n)); }); return x ? { kind, x } : null; };
    return hit(S.get().businesses, 'biz') || hit(S.get().networks, 'net');
  }

  /* ---------- 명함 PDF로 등록: 한 장이면 등록 양식, 여러 장이면 확인 목록 ---------- */
  const cardMemo = r => [r.fax && `팩스 ${r.fax}`, r.homepage && `홈페이지 ${r.homepage}`].filter(Boolean).join('\n');
  async function handleCardPdf(files) {
    push({ type: 'loading', title: '명함 PDF를 읽는 중', body: AI.available() ? 'AI가 PDF 안의 명함을 찾고 있습니다. 쪽이 많으면 30초쯤 걸립니다.' : 'PDF에서 이름·연락처를 찾고 있습니다.' }, false);
    const found = [];
    let scanned = null;
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) { toast(`${f.name}: 25MB 이하 PDF만 올릴 수 있어요.`, 'error'); continue; }
      let pages = null, perr = null;
      try { ({ pages } = await DT.pdfPages(f, 40)); } catch (err) { perr = err; }
      if (AI.available()) {
        try {
          const list = await AI.readCardsPdf(await readDataUrl(f));
          list.filter(c => c.name || c.mobile || c.phone || c.email).forEach(c => found.push({ ...c, photo: (pages && pages[(c.page || 1) - 1] || {}).img || '', file: f.name }));
          continue;
        } catch (err) { toast(`AI로 읽지 못해 PDF 글자로 읽어요: ${err.message}`, 'error'); }
      }
      if (!pages) { toast(`${f.name}을(를) 열지 못했어요${perr ? ` (${perr.message})` : ''}.`, 'error'); continue; }
      pages.forEach(pg => {
        const c = DT.parseCard(pg.text);
        if (DT.isCard(c)) found.push({ ...c, page: pg.page, photo: pg.img, file: f.name });
        else if (!pg.text.replace(/\s/g, '') && !scanned) scanned = { img: pg.img, file: f.name };
      });
    }
    if (!found.length) {
      if (scanned) return replaceTop({ type: 'form', kind: 'card', preset: { photo: scanned.img, _notice: `${scanned.file}은(는) 스캔한 그림 PDF라 글자를 읽을 수 없어요. 첫 쪽을 명함 사진으로 넣어 두었으니 보면서 칸을 채워 주세요. (데이터 관리 > AI 도우미에 키를 넣으면 스캔본도 자동으로 읽어요)` } });
      closeDrawer();
      return toast('PDF에서 명함(전화번호·이메일)을 찾지 못했어요.', 'error');
    }
    const rows = found.map(c => {
      const link = guessLink(c.org);
      const dup = S.dupesOf('card', { name: c.name || '', org: c.org || '', mobile: c.mobile || '', email: c.email || '' })[0];
      return { ...c, on: !dup, dup: dup ? `${dup.x.name}${dup.x.org ? ' · ' + dup.x.org : ''}` : '', linkType: link ? link.kind : '', linkId: link ? link.x.id : '', linkName: link ? link.x.name : '' };
    });
    if (rows.length === 1 && !rows[0].dup) {
      const r = rows[0];
      return replaceTop({ type: 'form', kind: 'card', preset: { name: r.name, title: r.title, dept: r.dept, org: r.org, mobile: r.mobile, phone: r.phone, email: r.email, address: r.address, memo: cardMemo(r), photo: r.photo, linkType: r.linkType, linkId: r.linkId,
        _notice: `PDF(${r.file})에서 읽은 내용입니다. 틀린 곳이 없는지 확인한 뒤 등록하세요.${r.linkName ? ` 소속이 같은 '${r.linkName}'에 연결해 두었습니다.` : ''}` } });
    }
    replaceTop({ type: 'cardbulk', state: { rows, metAt: U.today(), metWhere: '' } });
  }
  function cardBulkHtml(st) {
    const n = st.rows.filter(r => r.on).length;
    const inp = (i, k, w) => `<input class="input sm" style="width:${w}px" data-cbf="${i}" data-k="${k}" value="${U.esc(st.rows[i][k] || '')}">`;
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">명함 PDF 등록 · ${st.rows.length}장</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div>
      <p class="sub" style="margin:0">PDF에서 찾은 명함입니다. 칸을 고칠 수 있고, 이미 있는 명함은 빼 두었어요. 소속이 같은 사업체·기관이 있으면 자동으로 연결됩니다.</p></div>
      <div class="dr-body">
        <div class="table-wrap"><table class="tbl bulk-tbl cb-tbl"><thead><tr><th><input type="checkbox" data-cball ${n === st.rows.length ? 'checked' : ''} aria-label="모두 선택"></th><th></th><th>이름</th><th>직함</th><th>소속</th><th>휴대전화</th><th>전화</th><th>이메일</th><th>연결</th></tr></thead><tbody>
        ${st.rows.map((r, i) => `<tr class="${r.on ? '' : 'dup'}"><td><input type="checkbox" data-cbon="${i}" ${r.on ? 'checked' : ''} aria-label="등록"></td>
          <td>${r.photo ? `<img class="cb-thumb" src="${r.photo}" alt="">` : ''}<div class="sub">${r.page ? r.page + '쪽' : ''}</div></td>
          <td>${inp(i, 'name', 90)}${r.dup ? `<div class="sub" style="color:var(--danger)">이미 있음: ${U.esc(r.dup)}</div>` : ''}</td><td>${inp(i, 'title', 80)}</td><td>${inp(i, 'org', 150)}</td><td>${inp(i, 'mobile', 125)}</td><td>${inp(i, 'phone', 125)}</td><td>${inp(i, 'email', 150)}</td>
          <td class="nowrap">${r.linkName ? `🔗 ${U.esc(r.linkName)}` : '<span class="sub">분류 대기</span>'}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="perf-form" style="margin-top:12px"><label>받은 날<input class="input" type="date" id="cbMet" value="${U.esc(st.metAt)}"></label><label class="grow">받은 곳 <span class="sub">(행사·방문처 등)</span><input class="input" id="cbWhere" value="${U.esc(st.metWhere)}" placeholder="예: 경기 서남부 채용박람회"></label></div>
      </div>
      <div class="dr-foot"><button class="btn" type="button" data-act="dr-close">취소</button><button class="btn btn-primary" type="button" data-act="card-bulk-commit" ${n ? '' : 'disabled'}>선택한 ${n}장 등록</button></div>`;
  }
  function bindCardBulk(st) {
    const inner = $('#drawerInner');
    inner.querySelectorAll('[data-cbf]').forEach(el => { el.oninput = () => { st.rows[+el.dataset.cbf][el.dataset.k] = el.value; }; });
    inner.querySelectorAll('[data-cbon]').forEach(el => { el.onchange = () => { st.rows[+el.dataset.cbon].on = el.checked; renderDrawer(true); }; });
    const all = inner.querySelector('[data-cball]'); if (all) all.onchange = () => { st.rows.forEach(r => { r.on = all.checked; }); renderDrawer(true); };
    $('#cbMet').onchange = ev => { st.metAt = ev.target.value || U.today(); };
    $('#cbWhere').oninput = ev => { st.metWhere = ev.target.value; };
  }

  async function handleCardPhoto(file) {
    let photo;
    try { photo = await F.resizeImage(file, 1000, .72); } catch { return toast('사진을 읽지 못했습니다. JPG나 PNG 파일인지 확인하세요.', 'error'); }
    if (!AI.available()) {
      push({ type: 'form', kind: 'card', preset: { photo, _notice: 'AI 키가 없어 내용을 직접 입력해야 합니다. 키를 넣으면 사진만 올려도 자동으로 채워집니다 (데이터 관리 > AI 도우미).' } }, false);
      return;
    }
    push({ type: 'loading', title: '명함을 읽는 중', body: 'AI가 이름·연락처를 읽고 있습니다. 5~10초 걸립니다.' }, false);
    try {
      const r = await AI.readCard(await F.resizeImage(file, 1600, .85));
      const link = guessLink(r.org);
      const memo = [r.fax && `팩스 ${r.fax}`, r.homepage && `홈페이지 ${r.homepage}`].filter(Boolean).join('\n');
      replaceTop({ type: 'form', kind: 'card', preset: {
        name: r.name, title: r.title, dept: r.dept, org: r.org, mobile: r.mobile, phone: r.phone, email: r.email, address: r.address, memo, photo,
        linkType: link ? link.kind : '', linkId: link ? link.x.id : '', metWhere: '',
        _notice: `AI가 명함에서 읽은 내용입니다. 틀린 곳이 없는지 확인한 뒤 등록하세요.${link ? ` 소속이 같은 '${link.x.name}'에 연결해 두었습니다.` : ' 연결할 곳이 없으면 등록 후 분류 대기 목록에서 사업체/네트워크로 나눌 수 있습니다.'}`,
      } });
    } catch (err) {
      replaceTop({ type: 'form', kind: 'card', preset: { photo, _notice: 'AI가 명함을 읽지 못했습니다 (' + err.message + '). 직접 입력해 주세요.' } });
    }
  }

  /* ---------- More sheet (mobile) ---------- */
  function closeMore() { document.querySelector('.more-sheet')?.remove(); }
  function toggleMore() {
    if (document.querySelector('.more-sheet')) return closeMore();
    const el = document.createElement('div');
    el.className = 'more-sheet';
    const sec = curSec(), byKey = Object.fromEntries(NAV.map(x => [x[0], x]));
    el.innerHTML = sec.items.slice(4).map(k => `<a href="#/${k}">${byKey[k][1]}</a>`).join('') + '<div class="more-secs">' + SECS.filter(x => x.k !== 'data' || S.isAdmin()).map(x => `<button type="button" class="${x.k === sec.k ? 'on' : ''}" data-act="sec" data-sec="${x.k}">${x.label}</button>`).join('') + '</div>';
    document.body.appendChild(el);
  }

  /* ---------- vCard ---------- */
  function vcard(c) {
    const esc = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${esc(c.name.slice(0, 1))};${esc(c.name.slice(1))};;;`, `FN:${esc(c.name)}`];
    if (c.org) lines.push(`ORG:${esc(c.org)}${c.dept ? ';' + esc(c.dept) : ''}`);
    if (c.title) lines.push(`TITLE:${esc(c.title)}`);
    if (c.mobile) lines.push(`TEL;TYPE=CELL:${c.mobile}`);
    if (c.phone) lines.push(`TEL;TYPE=WORK:${c.phone}`);
    if (c.email) lines.push(`EMAIL;TYPE=WORK:${c.email}`);
    if (c.address) lines.push(`ADR;TYPE=WORK:;;${esc(c.address)};;;;`);
    if (c.memo) lines.push(`NOTE:${esc(c.memo)}`);
    lines.push('END:VCARD');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' }));
    a.download = `${c.name}.vcf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- Actions ---------- */
  const A = {
    'toggle-quick': () => { $('#quickMenu').hidden = !$('#quickMenu').hidden; },
    more: toggleMore,
    go: el => { location.hash = el.dataset.href; },
    open: (el, fromDrawer) => { closeSearch(); if (el.dataset.kind && el.dataset.id) openDetail(el.dataset.kind, el.dataset.id, fromDrawer); },
    'sr-open': el => { const [k, id] = srItems[+el.dataset.i]; closeSearch(); openDetail(k, id, false); },
    'close-search': closeSearch,
    'new-biz': (el, fd) => push({ type: 'form', kind: 'biz', preset: newPreset(el) }, fd),
    'new-net': (el, fd) => push({ type: 'form', kind: 'net', preset: newPreset(el) }, fd),
    // 지도에서 찍은 자리에 바로 등록 (위치·읍면동·사업 구분이 미리 채워진다)
    'place-close': () => { const b = $('#placeRes'); if (b) b.hidden = true; if (placeMarker) { placeMarker.remove(); placeMarker = null; } },
    'place-pick': el => {
      const p = placeList[+el.dataset.i]; if (!p || !bigMap) return;
      if (placeMarker) placeMarker.remove();
      placeMarker = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: '<div class="place-pin"></div>', iconSize: [26, 34], iconAnchor: [13, 34] }) }).addTo(bigMap);
      placeMarker.bindPopup(placeCard(p), { autoPanPaddingTopLeft: [360, 70] }).openPopup();
      bigMap.setView([p.lat, p.lng], Math.max(bigMap.getZoom(), 16));
      document.querySelectorAll('#placeRes .ps-item').forEach(b => b.classList.toggle('on', b === el));
    },
    'place-add': el => {
      bigMap?.closePopup();
      if (placeMarker) { placeMarker.remove(); placeMarker = null; }
      A[el.dataset.kind === 'net' ? 'new-net' : 'new-biz'](el, false);
    },
    'map-add-here': el => {
      bigMap?.closePopup();
      A[el.dataset.kind === 'net' ? 'new-net' : 'new-biz'](el, false);
    },
    'map-addmode': () => {
      const f = V.ui.map;
      f.addMode = !f.addMode;
      if (f.addMode && f.pick) A['route-pick']();
      const b = $('#mapAddBtn');
      if (b) { b.classList.toggle('on', f.addMode); b.textContent = f.addMode ? '✔ 추가할 곳을 찍으세요' : '＋ 여기에 추가'; }
      $('#bigMap')?.classList.toggle('adding', f.addMode);
      if (f.addMode) toast('지도에서 새로 등록할 자리를 누르세요. (오른쪽 클릭으로도 언제든 추가할 수 있어요)');
    },
    'map-move': el => {
      const { kind, id } = el.dataset;
      const m = markerIndex[kind + id];
      const x = S.find(kind, id);
      if (!m || !x) return;
      bigMap.closePopup();
      m.dragging.enable();
      m.getElement()?.classList.add('moving');
      toast(`'${x.name}' 핀을 원하는 자리로 끌어다 놓으세요.`);
      m.once('dragend', () => {
        const p = m.getLatLng();
        const before = { lat: x.lat, lng: x.lng, area: x.area, approx: x.approx };
        const lat = +p.lat.toFixed(6), lng = +p.lng.toFixed(6);
        S.upsert(kind, { id, lat, lng, approx: false, area: D.areaAt(lat, lng) || x.area });
        toast(`'${x.name}' 위치를 옮겼어요.`, '', { undo: () => S.upsert(kind, { id, ...before }) });
      });
    },
    'home-add': () => {
      const home = S.get().networks.find(S.isHome);
      if (home) return push({ type: 'form', kind: 'net', id: home.id });
      push({ type: 'form', kind: 'net', preset: { name: '화성시아르딤복지관', category: '복지기관', relation: '우리 기관 (지도 기준점)' } });
    },
    'new-card': (el, fd) => {
      const [lt, li] = (el.dataset.link || '').split(':');
      const t = lt ? S.find(lt, li) : null;
      push({ type: 'form', kind: 'card', preset: t ? { linkType: lt, linkId: li, org: t.name, address: t.address || '' } : {} }, fd);
    },
    'new-event': (el, fd) => {
      const [lt, li] = (el.dataset.target || '').split(':');
      const who = el.dataset.staff || (V.ui.sched.who && V.ui.sched.who !== '-' && route() === 'schedule' ? V.ui.sched.who : '');
      push({ type: 'form', kind: 'ev', preset: { ...(lt ? { targetType: lt, targetId: li } : {}), ...(el.dataset.date ? { date: el.dataset.date } : {}), ...(who ? { staff: who } : {}) } }, fd);
    },
    'sched-view': () => { location.hash = '#/schedule'; },
    /** 상단 구역 바꾸기: 보기 범위를 그 사업 직원으로, 지도는 그 사업 지도로 맞추고 첫 기능으로 간다 */
    sec: el => {
      const x = SECS.find(s => s.k === el.dataset.sec); if (!x) return;
      closeMore();
      secKey = x.k; lsSetSec(x.k);
      // 주소를 먼저 그 구역 첫 화면으로 바꿔 둔다 (범위를 바꾸면 바로 다시 그리는데, 그때 옛 화면 주소면 구역이 되돌아간다)
      const first0 = x.items.find(k => canSee(k)) || x.items[0];
      const target0 = '#/' + hrefOf(first0), moved = location.hash !== target0;
      if (moved) history.pushState(null, '', target0);
      if (x.prog) {
        // 구역마다 그 구역 기록만 (담당자가 아직 없어도 다른 구역 기록을 보여 주지 않는다)
        S.setScope('p:' + x.prog);
        const P = D.PROGRAM[x.prog];
        Object.assign(V.ui.map, { mode: 'ours', prog: P && P.map ? x.prog : '', solo: null });
      }
      render();
      if (moved) window.scrollTo(0, 0);
    },
    'ev-import': () => pickFiles('.xlsx,.xls,.csv,.hwp', true, async files => {
      let evs = [];
      for (const f of files) {
        try {
          if (/\.hwp$/i.test(f.name)) evs.push(...R.eventsFromHwp(await HWP.readTables(await f.arrayBuffer()), f.name));
          else if (/\.csv$/i.test(f.name)) evs.push(...R.eventsFromWorkbook(XLSX.read(await f.text(), { type: 'string' }), f.name));
          else evs.push(...R.eventsFromWorkbook(XLSX.read(new Uint8Array(await f.arrayBuffer())), f.name));
        } catch (err) { toast(`${f.name}을(를) 읽지 못했어요: ${err.message}`, 'error'); }
      }
      const have = new Set(S.get().events.map(x => `${x.date}|${x.title}`));
      const fresh = evs.filter(x => !have.has(`${x.date}|${x.title}`) && (have.add(`${x.date}|${x.title}`), true));
      if (!evs.length) return toast('일정을 찾지 못했어요. 표 첫 줄에 "날짜"와 "제목(또는 내용·일정)" 칸이 있어야 해요.', 'error');
      if (!fresh.length) return toast(`${evs.length}건 모두 이미 있는 일정이에요.`);
      if (!(await confirmBox(`일정 ${fresh.length}건을 추가할까요?`, `${files.map(f => f.name).join(', ')}에서 ${evs.length}건을 찾았고, 날짜·제목이 같은 ${evs.length - fresh.length}건은 빼요.`, '추가'))) return;
      S.upsertMany('ev', fresh); toast(`일정 ${fresh.length}건을 추가했어요.`);
    }),
    'sched-who': el => { V.ui.sched.who = el.dataset.who; render(); },
    'ev-del': el => {
      const ev = S.find('ev', el.dataset.id);
      if (!ev) return;
      const undo = S.remove('ev', ev.id);
      if (undo) toast(`'${ev.title}' 일정을 삭제했어요.`, '', { undo });
    },
    edit: (el) => push({ type: 'form', kind: el.dataset.kind, id: el.dataset.id }, true),
    'edit-loc': el => push({ type: 'form', kind: el.dataset.kind, id: el.dataset.id, focus: 'address' }, !!el.closest('#drawer')),
    'map-nopos': () => { V.ui.map.noPos = !V.ui.map.noPos; render(); },
    'nopos-refind': async el => {
      // 주소가 있는데 위치가 없는 곳을 차례로 다시 찾는다 (무료 지도 검색은 1초에 한 번만)
      const st = S.view();
      const list = [...st.businesses.filter(b => !M.hasPos(b) && b.address).map(x => ['biz', x]), ...st.networks.filter(n => !M.hasPos(n) && n.address).map(x => ['net', x])];
      if (!list.length) return toast('주소가 적힌 곳이 없어요. 위치 지정으로 하나씩 정해 주세요.', 'error');
      el.disabled = true;
      let found = 0;
      for (const [i, [kind, x]] of list.entries()) {
        el.textContent = `찾는 중… ${i + 1}/${list.length}`;
        if (await S.refine(kind, x.id)) found++;
        await new Promise(r => setTimeout(r, 1100));
      }
      toast(`${list.length}곳 중 ${found}곳의 위치를 찾았어요.${found < list.length ? ' 나머지는 위치 지정으로 정해 주세요.' : ''}`, found ? '' : 'error');
      render();
    },
    'edit-event': (el, fd) => push({ type: 'form', kind: 'ev', id: el.dataset.id }, fd),
    delete: async el => {
      const { kind, id } = el.dataset;
      const x = S.find(kind, id);
      if (!x) return;
      const label = { biz: '사업체', net: '기관', card: '명함', ev: '일정' }[kind];
      const extra = kind === 'biz' || kind === 'net' ? ' 이곳의 활동 기록과 일정도 함께 지워지고, 연결된 명함은 연결만 해제됩니다.' : '';
      if (!(await confirmBox(`${label}을(를) 삭제할까요?`, `'${x.name || x.title}'을(를) 삭제합니다.${extra}`, '삭제'))) return;
      const undo = S.remove(kind, id);
      stack = stack.filter(s => !(s.kind === kind && s.id === id));
      renderDrawer();
      toast(`${label}을(를) 삭제했습니다.`, '', { undo });
    },
    'stage-set': el => {
      const b = S.find('biz', el.dataset.id);
      const to = el.dataset.stage;
      if (!b || b.stage === to) return;
      const from = b.stage;
      S.upsert('act', { targetType: 'biz', targetId: b.id, date: U.today(), type: '기타', content: `진행 단계 변경: ${from} → ${to}`, staff: S.me() });
      S.upsert('biz', { id: b.id, stage: to });
      toast(`${b.name}: ${to} 단계로 변경했습니다.${to === '채용연계' && !Number(b.placements) ? ' 채용 인원은 수정에서 입력하세요.' : ''}`);
    },
    'ev-toggle': el => {
      const ev = S.find('ev', el.dataset.id);
      if (!ev) return;
      S.upsert('ev', { id: ev.id, done: !ev.done });
      toast(!ev.done ? '완료로 표시했습니다.' : '완료 표시를 해제했습니다.');
    },
    'act-del': el => {
      const undo = S.remove('act', el.dataset.id);
      if (undo) toast('활동 기록을 삭제했습니다.', '', { undo });
    },
    'focus-log': () => { const i = $('#quickLogContent'); i?.scrollIntoView({ block: 'center', behavior: 'smooth' }); i?.focus({ preventScroll: true }); },
    copy: async el => {
      try { await navigator.clipboard.writeText(el.dataset.v); toast('복사했습니다.'); }
      catch { toast(`복사하지 못했습니다: ${el.dataset.v}`, 'error'); }
    },
    vcard: el => { const c = S.find('card', el.dataset.id); if (c) vcard(c); },
    'photo-clear': el => {
      const form = el.closest('form');
      form.elements.photo.value = '';
      form.querySelector('#photoPreview').hidden = true;
      el.remove();
    },
    geocode: el => el.closest('form')._geocode?.(),
    'dr-close': closeDrawer,
    'dr-back': () => { stack.pop(); renderDrawer(); },
    'dr-cancel': () => { stack.pop(); renderDrawer(); },
    'biz-stage': el => { V.ui.biz.stage = el.dataset.stage; if (route() === 'biz') render(); else location.hash = '#/biz'; },
    'biz-unfilter': el => { const k = el.dataset.k; const f = V.ui.biz; if (k === 'stage') f.stage = '전체'; else if (k === 'mandatory') f.mandatory = false; else if (k === 'period') f.period = 'all'; else if (k === 'q') syncQ(''); else f[k] = ''; render(); },
    'biz-reset': () => { Object.assign(V.ui.biz, { stage: '전체', area: '', industry: '', mandatory: false, period: 'all', dup: false, prog: '' }); syncQ(''); render(); },
    'hub-triage': () => { V.ui.hub.triage = !V.ui.hub.triage; render(); },
    'biz-prog': el => { V.ui.biz.prog = el.dataset.prog; render(); },
    'sup-toggle': el => {
      const b = S.find('biz', el.dataset.id);
      if (!b) return;
      const t = el.dataset.type;
      const cur = new Set(b.support || []);
      if (cur.has(t)) cur.delete(t); else cur.add(t);
      S.upsert('biz', { id: b.id, support: D.SUPPORT_TYPES.filter(x => cur.has(x)) });
      toast(`${b.name}: ${D.SUPPORT_LABEL[t]} ${cur.has(t) ? '진행으로 표시했어요' : '표시를 뺐어요'}.`);
    },
    'map-show': el => {
      // 지도로 가서 그곳을 바로 보여 준다 (필터는 풀어서 반드시 보이게)
      Object.assign(V.ui.map, { mode: 'ours', gu: '', q: '', prog: '', biz: true, net: true, card: el.dataset.kind === 'card' ? true : V.ui.map.card, noPos: false, stages: new Set(D.STAGES.map(s => s.key)), solo: { kind: el.dataset.kind, id: el.dataset.id }, focus: { kind: el.dataset.kind, id: el.dataset.id } });
      closeDrawer();
      if (location.hash === '#/map') render(); else location.hash = '#/map';
    },
    'staff-clean': () => {
      // 현장중심(장애인개발원) 소속이 아닌 직원을 미리 골라 둔다
      const keep = new Set(S.staff().filter(x => x.program === '장애인개발원').map(x => x.name));
      push({ type: 'staffclean', pick: new Set(S.staff().map(x => x.name).filter(n => !keep.has(n))), keepName: false }, false);
    },
    'sc-pick': el => { const top = stack[stack.length - 1]; if (!top || top.type !== 'staffclean') return; const n = el.dataset.name; top.pick.has(n) ? top.pick.delete(n) : top.pick.add(n); renderDrawer(true); },
    'sc-keepname': () => { const top = stack[stack.length - 1]; if (top && top.type === 'staffclean') { top.keepName = !top.keepName; renderDrawer(true); } },
    'sc-move': async () => {
      const top = stack[stack.length - 1]; if (!top || top.type !== 'staffclean') return;
      const to = ($('#scMoveTo') || {}).value, from = [...top.pick].filter(Boolean);
      if (!to || !from.length) return toast('옮길 사람(위에서 체크)과 받을 직원을 고르세요.', 'error');
      const st = S.get(), has = x => from.includes(x.staff);
      const sets = { biz: st.businesses, net: st.networks, act: st.activities, ev: st.events, perf: st.perfs, trip: st.trips };
      const cnt = Object.fromEntries(Object.entries(sets).map(([k, l]) => [k, l.filter(has).length]));
      const total = Object.values(cnt).reduce((a, b) => a + b, 0);
      if (!total) return toast('옮길 기록이 없어요.', 'error');
      if (!(await confirmBox(`${from.join(', ')} → ${to} 로 옮길까요?`, `사업체 ${cnt.biz} · 기관 ${cnt.net} · 활동 ${cnt.act} · 일정 ${cnt.ev} · 실적 ${cnt.perf} · 출장·특근 ${cnt.trip}건의 담당 이름을 ${to}(으)로 바꿔요. 기록은 지워지지 않아요.`, '옮기기'))) return;
      Object.entries(sets).forEach(([k, l]) => { const ps = l.filter(has).map(x => ({ id: x.id, staff: to })); if (ps.length) S.putMany(k, ps); });
      toast(`${total}건을 ${to}(으)로 옮겼어요. 이제 ${S.programOf(to) || '그 구역'} 화면에 보여요.`);
      renderDrawer(true);
    },
    'sc-commit': async () => {
      const top = stack[stack.length - 1]; if (!top || top.type !== 'staffclean') return;
      const names = [...top.pick];
      const all = names.map(staffRecords);
      const sum = k => all.reduce((a, r) => a + r[k].length, 0);
      const label = names.map(n => n || '(담당 없음)').join(', ');
      if (!(await confirmBox(`${label} 정리할까요?`, `사업체 ${sum('biz')}곳 · 기관 ${sum('net')}곳 · 연결 명함 ${sum('cards')}장 · 활동 ${sum('acts')}건 · 일정 ${sum('evs')}건 · 실적 ${sum('perfs')}건 · 출장·특근 ${sum('trips')}건을 지웁니다.${top.keepName ? '' : ' 직원 목록에서도 뺍니다.'} 되돌릴 수 없어요.`, '지우기'))) return;
      const ids = k => [...new Set(all.flatMap(r => r[k].map(x => x.id)))];
      S.removeMany('act', ids('acts')); S.removeMany('ev', ids('evs')); S.removeMany('card', ids('cards'));
      S.removeMany('perf', ids('perfs')); S.removeMany('trip', ids('trips'));
      S.removeMany('biz', ids('biz')); S.removeMany('net', ids('net'));
      const drop = new Set(names.filter(Boolean));
      if (!top.keepName && drop.size) {
        const left = S.staff().filter(x => !drop.has(x.name));
        if (left.length) await S.saveSettings({ staff: left });
      }
      closeDrawer();
      toast(`${label} 정리를 마쳤어요. 사업체 ${sum('biz')}곳 · 활동 ${sum('acts')}건을 지웠어요.`);
      render();
    },
    'month-xlsx': el => {
      if (!window.XLSX) return toast('엑셀 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침하세요.', 'error');
      let months;
      if (el.dataset.range) {
        const a = ($('#mxFrom') || {}).value, b = ($('#mxTo') || {}).value;
        if (!a || !b) return toast('시작 달과 끝 달을 고르세요.', 'error');
        const [from, to] = a <= b ? [a, b] : [b, a];
        months = []; let [y, m] = from.split('-').map(Number);
        while (`${y}-${U.pad(m)}` <= to && months.length < 24) { months.push(`${y}-${U.pad(m)}`); if (++m > 12) { m = 1; y++; } }
      } else months = [el.dataset.month || ($('#mxFrom') || {}).value || U.today().slice(0, 7)];
      try {
        const r = R.monthBook(months);
        toast(`${r.file} 파일을 만들었어요. (${r.rows}줄 · 요약·연락이력·방문·실적·신규 사업체·일정·명함 시트)`);
      } catch (err) { console.error(err); toast('엑셀 파일을 만들지 못했어요: ' + err.message, 'error'); }
    },
    'archive-now': async el => {
      if (!S.REMOTE) return toast('구글 드라이브 정리는 팀 공유 사이트(구글 시트 연결)에서 돼요. 이 버전에서는 위 "달별 엑셀 정리"로 파일을 받아 주세요.');
      const all = el.dataset.all === '1';
      const months = all ? [...new Set(R.ARCHIVE_SECTIONS.flatMap(sec => R.archiveMonths(sec.scope)))].sort() : [prevYm(), U.today().slice(0, 7)];
      if (all && !(await confirmBox(`${months.length}개월을 정리할까요?`, `${months[0]} ~ ${months[months.length - 1]} 기록을 구글 드라이브 '아르딤 취업지원 정리' 폴더에 달별 파일로 만들어요. 달마다 몇 초씩 걸려요. 창을 닫지 마세요.`, '정리 시작'))) return;
      el.disabled = true; const label = el.textContent;
      try {
        await S.whenSaved();
        const r = await archiveSync(months, (i, n, m) => { el.textContent = `정리 중… ${i}/${n} (${m})`; });
        toast(`구글 드라이브에 정리 파일 ${r.n}개를 만들거나 새로 고쳤어요.`, '', r.root ? { action: { label: '폴더 열기', run: () => window.open(r.root, '_blank') } } : {});
        await S.reload().catch(() => {});
      } catch (err) { toast('드라이브에 정리하지 못했어요: ' + (err && err.message || err) + ' — Code.gs를 새로 붙여 넣고 새 버전으로 배포했는지 확인하세요.', 'error'); }
      finally { el.disabled = false; el.textContent = label; render(); }
    },
    'archive-toggle': async () => { const on = S.get().settings.archiveAuto === 'N'; await S.saveSettings({ archiveAuto: on ? '' : 'N' }); toast(on ? '자동 정리를 켰어요. 관리자가 사이트를 열면 하루 한 번 이번 달·지난달 파일을 새로 고쳐요.' : '자동 정리를 껐어요.'); render(); },
    'self-test': async () => {
      if (!S.REMOTE) return toast('지금은 이 브라우저에만 저장하는 파일 버전이에요. 입력하면 바로 이 컴퓨터에 쌓여요. (팀 공유 사이트에서 점검하면 구글 시트 저장을 확인해요)');
      const fromDrawer = drawerOpen();
      if (fromDrawer) stack.pop();
      push({ type: 'loading', title: '저장 점검 중', body: '구글 시트마다 시험 줄을 쓰고 지워 보는 중이에요. 10~30초 걸려요.' }, false);
      try { const res = await S.call('api_selfTest'); replaceTop({ type: 'selftest', res, wait: S.outboxSize() }); }
      catch (err) { closeDrawer(); toast('점검하지 못했어요: ' + (err && err.message || err) + ' — Code.gs를 새로 붙여 넣고 새 버전으로 배포했는지 확인하세요.', 'error'); }
    },
    'outbox-flush': async () => { await S.flush(); const n = S.outboxSize(); toast(n ? `아직 ${n}건을 못 보냈어요. 인터넷 연결을 확인해 주세요.` : '보관해 둔 기록을 모두 저장했어요.', n ? 'error' : ''); if (stack[stack.length - 1]?.type === 'selftest') { stack[stack.length - 1].wait = n; renderDrawer(); } },
    'dedupe-open': el => { const kind = el.dataset.kind; push({ type: 'dedupe', kind, groups: dedupeGroups(kind) }, false); },
    'dedupe-on': el => { const top = stack[stack.length - 1]; if (!top || top.type !== 'dedupe') return; const g = top.groups[+el.dataset.g]; g.on = !g.on; renderDrawer(true); },
    'dedupe-keep': el => { const top = stack[stack.length - 1]; if (!top || top.type !== 'dedupe') return; top.groups[+el.dataset.g].keep = el.dataset.id; renderDrawer(true); },
    'dedupe-commit': async () => {
      const top = stack[stack.length - 1]; if (!top || top.type !== 'dedupe') return;
      const what = DEDUPE_WHAT[top.kind], gs = top.groups.filter(g => g.on);
      const n = gs.reduce((a, g) => a + g.items.length - 1, 0);
      if (!n || !(await confirmBox(`${what} ${n}건을 합칠까요?`, `묶음 ${gs.length}개에서 '남김'으로 고른 것만 남기고, 나머지 ${n}건의 내용을 옮긴 뒤 지웁니다. 되돌릴 수 없으니 필요하면 먼저 엑셀로 받아 두세요.`, '합쳐서 정리'))) return;
      let done = 0;
      gs.forEach(g => g.items.forEach(x => { if (x.id !== g.keep && S.find(top.kind, x.id) && S.find(top.kind, g.keep)) { S.merge(top.kind, g.keep, x.id); done++; } }));
      closeDrawer();
      toast(`${what} 중복 ${done}건을 합쳐서 정리했습니다.`);
      render();
    },
    'dup-toggle': el => { const f = V.ui[el.dataset.kind === 'card' ? 'cards' : el.dataset.kind]; f.dup = !f.dup; render(); },
    'cards-of': el => {
      const x = S.find(el.dataset.kind, el.dataset.id);
      if (!x) return;
      Object.assign(V.ui.cards, { of: { kind: el.dataset.kind, id: x.id, name: x.name }, q: '', idx: '', link: 'all', dup: false });
      closeDrawer();
      if (location.hash === '#/cards') render(); else location.hash = '#/cards';
    },
    'cards-of-clear': () => { V.ui.cards.of = null; render(); },
    merge: async el => {
      const { kind, keep, drop } = el.dataset;
      const a = S.find(kind, keep), b = S.find(kind, drop);
      if (!a || !b) return;
      const what = { biz: '사업체', net: '기관', card: '명함' }[kind];
      if (!(await confirmBox(`${what}를 하나로 합칠까요?`, `'${b.name}'의 내용을 '${a.name}'에 합칩니다. 비어 있는 칸만 채우고${kind === 'card' ? '' : ', 활동 기록·일정·명함 연결을 옮긴'} 뒤 '${b.name}'은(는) 지웁니다.${kind === 'card' && !a.photo && b.photo ? ' (사진이 있는 쪽을 남깁니다)' : ''}`, '합치기'))) return;
      const kept = S.merge(kind, keep, drop);
      toast(`${what}를 합쳤습니다.`);
      stack = [{ type: 'detail', kind, id: kept }];
      renderDrawer();
    },
    'biz-upload': () => $('#globalBizFile').click(),
    'card-photo': () => $('#globalCardPhoto').click(),
    'kead-commit': () => {
      const top = stack[stack.length - 1]; if (!top || top.type !== 'kead') return;
      const r = IMP.keadCommit(top.state);
      closeDrawer();
      toast(`장애인개발원 자료 반영: 새 사업체 ${r.added}곳 추가, ${r.filled}곳 채움${r.cards ? `, 담당자 명함 ${r.cards}장` : ''}.`);
      if (route() !== 'biz') location.hash = '#/biz'; else render();
    },
    'card-pdf': () => pickFiles('.pdf,application/pdf', true, files => handleCardPdf(files)),
    'card-bulk-commit': () => {
      const top = stack[stack.length - 1]; if (!top || top.type !== 'cardbulk') return;
      const st = top.state, list = st.rows.filter(r => r.on && (r.name || r.mobile || r.phone || r.email));
      list.forEach(r => S.upsert('card', { name: (r.name || '').trim() || '(이름 없음)', title: r.title || '', dept: r.dept || '', org: (r.org || '').trim(), mobile: r.mobile || '', phone: r.phone || '', email: r.email || '', address: r.address || '', linkType: r.linkType || '', linkId: r.linkId || '', metAt: st.metAt || U.today(), metWhere: st.metWhere || '', tags: [], memo: cardMemo(r), photo: r.photo || '' }));
      closeDrawer();
      const linked = list.filter(r => r.linkId).length;
      toast(`명함 ${list.length}장을 등록했어요.${linked ? ` ${linked}장은 사업체·기관에 연결했고,` : ''}${list.length - linked ? ` ${list.length - linked}장은 '분류 대기'에서 사업체·기관으로 나눌 수 있어요.` : ''}`);
      if (route() !== 'cards') location.hash = '#/cards'; else render();
    },
    'card-idx': el => { V.ui.cards.idx = el.dataset.idx; render(); },
    'card-link-none': () => { V.ui.cards.link = 'none'; },
    'bulk-commit': () => {
      const top = stack[stack.length - 1];
      if (!top || top.type !== 'bulk') return;
      const r = IMP.commit(top.state);
      closeDrawer();
      V.ui.biz.period = 'all';
      if (route() !== 'biz') location.hash = '#/biz';
      toast(`사업체 ${r.biz}곳을 등록했습니다${r.cards ? ` (담당자 명함 ${r.cards}장 포함)` : ''}. 주소로 지도 위치를 찾는 중입니다.`);
    },
    'card-link-to': el => {
      const { id, kind, target } = el.dataset;
      const x = S.linkCard(id, kind, target);
      if (!x) return;
      bigMap?.closePopup();
      toast(`명함을 '${x.name}'에 연결했어요.${M.hasPos(S.find(kind, target)) ? '' : ' 그곳에 위치가 없어 지도에는 아직 안 나와요. 위치를 지정해 주세요.'}`);
      if (drawerOpen()) renderDrawer(true);
    },
    'card-autolink': async () => {
      const list = S.get().cards.filter(c => !c.linkType && !(c.tags || []).includes('개인')).map(c => [c, S.matchPlaces(c)]).filter(([, m]) => m.length === 1);
      if (!list.length) return;
      if (!(await confirmBox(`명함 ${list.length}장을 연결할까요?`, list.slice(0, 6).map(([c, [m]]) => `${c.org} → ${m.x.name}(${m.kind === 'biz' ? '사업체' : '네트워크'})`).join(', ') + (list.length > 6 ? ` 외 ${list.length - 6}장` : '') + '. 그곳에 위치가 없으면 명함의 위치를 가져와요.', '연결'))) return;
      list.forEach(([c, [m]]) => S.linkCard(c.id, m.kind, m.x.id));
      toast(`명함 ${list.length}장을 연결했어요.`);
    },
    triage: (el, fd) => {
      const c = S.find('card', el.dataset.id);
      if (!c) return;
      const to = el.dataset.to;
      if (to === 'personal') { S.upsert('card', { id: c.id, tags: [...new Set([...(c.tags || []), '개인'])] }); toast('개인 연락처로 두었습니다. 분류 대기 목록에서 빠집니다.'); return; }
      registerFromCard(c, to, c.org || c.name, D.guessCategory(c.org || c.name), fd);
    },
    'ai-summary': async el => {
      const b = S.find('biz', el.dataset.id);
      if (!b) return;
      el.disabled = true; el.textContent = '요약하는 중…';
      try { const t = await AI.summarize(b); S.upsert('biz', { id: b.id, aiSummary: t }); toast('AI 요약을 저장했습니다.'); }
      catch (err) { toast('요약하지 못했습니다: ' + err.message, 'error'); el.disabled = false; el.textContent = 'AI로 3줄 요약'; }
    },
    'ai-research': async el => {
      const b = S.find('biz', el.dataset.id);
      if (!b) return;
      el.disabled = true; el.textContent = '인터넷에서 찾는 중… (30초~1분)';
      try {
        const t = await AI.research(b);
        const cur = S.find('biz', b.id);
        const research = cur.research ? `[AI 조사 ${U.dateDot(U.today())}]\n${t}\n\n[이전 내용]\n${cur.research}` : t;
        S.upsert('biz', { id: b.id, research, researchAt: U.today() });
        toast('기초 조사 결과를 저장했습니다. 내용을 꼭 확인하세요.');
      } catch (err) { toast('조사하지 못했습니다: ' + err.message, 'error'); el.disabled = false; el.textContent = 'AI로 인터넷 조사'; }
    },
    'edit-research': el => push({ type: 'form', kind: 'biz', id: el.dataset.id, focus: 'research' }, true),
    'map-gu': el => { V.ui.map.gu = el.dataset.gu; render(); },
    'map-month': el => {
      const [y, m] = V.ui.map.month.split('-').map(Number);
      const d = new Date(y, m - 1 + +el.dataset.d, 1);
      V.ui.map.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
      refreshMap(false);
    },
    'map-tab': el => { V.ui.map.tab = el.dataset.tab; refreshMap(false); $('#mapList').scrollTop = 0; },
    'map-sort': el => { V.ui.map.sort = el.dataset.sort; refreshMap(false); $('#mapList').scrollTop = 0; },
    'link-add': () => { $('#linkRows').insertAdjacentHTML('beforeend', V.linkRow()); $('#linkRows .staff-row:last-child input').focus(); },
    'save-links': async () => {
      const links = [...document.querySelectorAll('#linkRows .staff-row')].map(r => ({ label: r.querySelector('[name=linkLabel]').value.trim(), url: r.querySelector('[name=linkUrl]').value.trim() })).filter(l => l.label);
      const bad = links.find(l => l.url && !/^https?:\/{2}/.test(l.url));
      if (bad) return toast(`'${bad.label}' 주소는 http:// 또는 https:// 로 시작해야 합니다.`, 'error');
      await S.saveSettings({ links });
      toast('바로가기를 저장했습니다.');
    },
    'save-aikey': async () => {
      const k = $('#aiKeyInput').value.trim();
      if (!/^sk-ant-/.test(k)) return toast('Claude API 키는 sk-ant- 로 시작합니다. 다시 확인해 주세요.', 'error');
      try { await AI.setKey(k); if (S.REMOTE) await S.refresh(); render(); toast('AI 키를 저장했습니다. 이제 AI 도우미를 쓸 수 있습니다.'); }
      catch (err) { toast('키를 저장하지 못했습니다: ' + err.message, 'error'); }
    },
    'clear-aikey': async () => {
      if (!(await confirmBox('AI 키를 삭제할까요?', '명함 자동 입력, 기초 조사, 요약 기능이 꺼집니다.', '삭제'))) return;
      await AI.setKey(''); if (S.REMOTE) await S.refresh(); render(); toast('AI 키를 삭제했습니다.');
    },
    'net-cat': el => { V.ui.net.cat = el.dataset.cat; render(); },
    'card-link': el => { V.ui.cards.link = el.dataset.link; render(); },
    'map-layer': el => { const k = el.dataset.layer; V.ui.map[k] = !V.ui.map[k]; render(); },
    'map-stage': el => {
      const s = V.ui.map.stages; const k = el.dataset.stage; if (el.checked) s.add(k); else s.delete(k);
      const n = el.closest('.map-dd')?.querySelector('summary b'); if (n) n.textContent = `${s.size}/${D.STAGES.length}`;
      refreshMap(false);
    },
    'map-mode': el => { V.ui.map.mode = el.dataset.mode; render(); },
    'map-prog': el => { Object.assign(V.ui.map, { mode: 'ours', prog: el.dataset.prog, solo: null }); render(); },
    'map-net-only': () => { Object.assign(V.ui.map, { biz: false, net: true, mode: 'ours' }); },
    'route-to': el => { const r = V.ui.map.route; V.ui.map.route = { from: r && r.from ? r.from : null, to: { kind: el.dataset.kind, id: el.dataset.id } }; bigMap?.closePopup(); routeChanged(true); },
    'route-from': el => { const r = V.ui.map.route; V.ui.map.route = { from: { kind: el.dataset.kind, id: el.dataset.id }, to: r ? r.to : null }; bigMap?.closePopup(); if (r && r.to) routeChanged(true); else { drawRoute(false); toast('출발지를 정했어요. 이제 도착할 곳을 누르고 여기까지 길찾기를 누르세요.'); } },
    'route-swap': () => {
      const r = V.ui.map.route; if (!r || !r.to) return;
      const home = S.get().networks.find(n => S.isHome(n) && M.hasPos(n));
      const from = r.from || (home ? { kind: 'net', id: home.id } : null);
      if (!from) return;
      V.ui.map.route = { from: r.to, to: from }; routeChanged(false);
    },
    'route-clear': () => { V.ui.map.route = null; drawRoute(false); },
    'route-pick': () => {
      const f = V.ui.map;
      f.pick = !f.pick;
      if (f.pick) { f.route = null; bigMap?.closePopup(); toast('지도에서 출발할 곳을 찍으세요. 점이나 아무 곳이나 찍을 수 있어요.'); }
      const b = $('#routePickBtn');
      if (b) { b.classList.toggle('on', f.pick); b.setAttribute('aria-pressed', f.pick); b.textContent = f.pick ? '✔ 두 곳 찍는 중' : '📍 두 곳 찍어 길찾기'; }
      refreshMap(false);
    },
    'route-prov': el => { V.ui.map.rprov = el.dataset.prov; drawRoute(false); if (routeWin && !routeWin.closed) openRouteWin(true); },
    'route-mode': el => { V.ui.map.rmode = el.dataset.mode; drawRoute(false); if (routeWin && !routeWin.closed) openRouteWin(true); },
    'route-auto': el => { V.ui.map.rauto = el.checked; },
    'route-open': () => openRouteWin(false),
    'map-solo': el => {
      const { kind, id } = el.dataset;
      V.ui.map.solo = { kind, id };
      bigMap?.closePopup();
      refreshMap(false);
      A['map-focus'](el);
    },
    'map-solo-off': () => {
      V.ui.map.solo = null;
      bigMap?.closePopup();
      refreshMap(false);
      if (bigMap && markerGroup.getLayers().length) bigMap.fitBounds(markerGroup.getBounds(), { padding: [30, 30], maxZoom: 14 });
    },
    'map-focus': el => focusPlace(el.dataset.kind, el.dataset.id),
    'cal-pick': el => { V.ui.sched.sel = V.ui.sched.sel === el.dataset.date ? '' : el.dataset.date; bindSched(); },
    'cal-move': el => { const [y, m] = V.ui.sched.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); V.ui.sched.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; bindSched(); },
    'perf-month': el => { const [y, m] = V.ui.perf.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); V.ui.perf.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; render(); },
    'perf-set': el => { V.ui.perf.set = el.dataset.set; render(); },
    'perf-acts': el => { V.ui.perf.withActs = el.checked; bindPerf(); },
    'perf-no': el => { V.ui.perf.withNo = el.checked; bindPerf(); },
    'perf-copy': async () => {
      const ok = await copyText(V.perfTsv());
      toast(ok ? '복사했습니다. 구글 시트의 실적(기타) 탭에서 붙여넣을 칸을 누르고 Ctrl+V 하세요.' : '복사하지 못했습니다. 엑셀로 받기를 이용하세요.', ok ? '' : 'error');
    },
    'perf-xlsx': () => {
      const f = V.ui.perf;
      const rows = S.perfTable(f.month, f.set, f.withActs).map((r, i) => ({ '연번': i + 1, '사업날짜': r.date, '대분류': r.big, '중분류': r.mid, '세부사업명': r.item, '참여인원': r.people, '참여인원(신규)': r.newPeople, '회차': r.round, '비고': r.note, '출처(참고)': r.src }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '실적(기타)');
      XLSX.writeFile(wb, `실적_${f.set}_${f.month}.xlsx`);
    },
    'org-sync': () => {
      if (!S.REMOTE) return toast('복지관 실적 시트로 보내기는 팀 공유 사이트(구글 시트 연결)에서 돼요.');
      const top = { type: 'orgsync', month: V.ui.perf.month };
      push(top, false); orgSyncRun(top, false);
    },
    'org-user-add': async () => {
      const top = stack[stack.length - 1]; if (!top || top.type !== 'orgsync') return;
      const users = [...document.querySelectorAll('#drawerInner [data-ou-row]')].filter(tr => tr.querySelector('[data-ou="on"]').checked).map(tr => {
        const u = { name: tr.dataset.ouRow }; tr.querySelectorAll('[data-ou]').forEach(el => { if (el.dataset.ou !== 'on') u[el.dataset.ou] = el.value.trim(); }); return u;
      });
      if (!users.length) return toast('등록할 사람을 골라 주세요.', 'error');
      const bad = users.find(u => !/^\d{4}-\d{5}$/.test(u.no));
      if (bad) return toast(`${bad.name}: 이용자번호를 2026-00262 모양으로 적어 주세요.`, 'error');
      const miss = users.filter(u => !u.sex || !u.birth || !u.type || !u.grade).map(u => u.name);
      if (miss.length && !(await confirmBox('빈 칸이 있어요', `${miss.join(', ')}: 성별·생년월일·장애유형·장애정도 중 빈 칸이 있어요. 비워 둔 채 등록할까요? (나중에 복지관 시트에서 직접 채울 수 있어요)`, '그래도 등록'))) return;
      top.busy = true; renderDrawer(true);
      try {
        const res = await S.call('api_orgUserAdd', { users, sheet: S.get().settings.orgPerfSheet || '' });
        toast(`이용자입력에 ${res.added.length}명을 등록했어요.${res.skipped.length ? ` 건너뜀: ${res.skipped.join(', ')}` : ''}`, res.skipped.length ? 'error' : '');
      } catch (err) { toast('등록하지 못했어요: ' + ((err && err.message) || err), 'error'); }
      orgSyncRun(top, false);
    },
    'org-sync-check': () => { const top = stack[stack.length - 1]; if (top && top.type === 'orgsync') orgSyncRun(top, false); },
    'org-sync-commit': async () => {
      const top = stack[stack.length - 1]; if (!top || top.type !== 'orgsync' || !top.res) return;
      const n = top.res.add.gen + top.res.add.etc;
      if (!(await confirmBox(`${n}줄을 복지관 실적 시트에 보낼까요?`, `${top.res.title}의 실적(일반) ${top.res.add.gen}줄 · 실적(기타) ${top.res.add.etc}줄을 맨 아래에 더해요. 다른 칸(식)은 건드리지 않아요.`, '보내기'))) return;
      orgSyncRun(top, true);
    },
    'perf-who': el => { V.ui.perf.who = el.dataset.who; bindPerf(); },
    'gl-open': () => { V.ui.perf.glOpen = !V.ui.perf.glOpen; },
    'pt-add': el => {
      V.ui.perf.lastItem = el.dataset.item;
      const fm = document.querySelector('[data-form="perf-add"]'); if (!fm) return;
      fm.querySelector('[name=item]').value = el.dataset.item;
      fm.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => fm.elements.name.focus(), 250);
    },
    'perf-del': el => { const undo = S.remove('perf', el.dataset.id); if (undo) toast('실적을 삭제했습니다.', '', { undo }); },
    'save-perfmap': async () => {
      const map = Object.fromEntries([...document.querySelectorAll('[data-perfmap]')].map(sel => [sel.dataset.perfmap, sel.value]));
      await S.saveSettings({ perfByProgram: map });
      toast('실적 분류표 연결을 저장했습니다.');
    },
    'sv-biz-edit': (el, fd) => push({ type: 'svBiz', id: el.dataset.id }, true),
    'sv-biz-view': (el, fd) => push({ type: 'svBizView', id: el.dataset.id }, true),
    'sv-job-edit': (el, fd) => push({ type: 'svJob', id: el.dataset.id, job: el.dataset.job || '' }, true),
    'sv-job-view': (el, fd) => push({ type: 'svJobView', id: el.dataset.id, job: el.dataset.job }, true),
    'sv-job-del': async el => {
      const b = S.find('biz', el.dataset.id);
      const j = (b?.jobAnalyses || []).find(x => x.id === el.dataset.job);
      if (!j || !(await confirmBox('직무분석지를 삭제할까요?', `'${j.jobName || '직무명 없음'}' 직무분석지를 삭제합니다.`, '삭제'))) return;
      S.upsert('biz', { id: b.id, jobAnalyses: b.jobAnalyses.filter(x => x.id !== j.id) });
      toast('직무분석지를 삭제했습니다.');
    },
    'sv-clear': el => { el.closest('form').querySelectorAll(`[name="${el.dataset.name}"]`).forEach(x => { x.checked = false; }); },
    'sv-print': () => printHtml($('#svDoc').innerHTML),
    'presence-toggle': () => { const m = $('#presenceMenu'); if (m) m.hidden = !m.hidden; },
    'sync-now': async el => {
      const btn = el || $('#syncBtn');
      if (btn.disabled) return;
      // 입력 중인 칸이 있으면 먼저 확정(저장)한다
      const a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'searchInput') { a.dispatchEvent(new Event('change', { bubbles: true })); a.blur(); }
      btn.disabled = true; btn.classList.add('spinning');
      try {
        const r = await S.reload();
        render();
        const t = new Date(), hm = `${U.pad(t.getHours())}:${U.pad(t.getMinutes())}`;
        toast(r.remote ? `${r.saved ? '저장 완료 · ' : ''}팀원이 바꾼 최신 내용까지 불러왔어요 (${hm})` : `이 컴퓨터에 저장했어요 (${hm}). 팀과 함께 보려면 공유 사이트 주소로 여세요.`);
      } catch (err) {
        toast('새로 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. (' + (err && err.message || err) + ')', 'error');
      } finally { btn.disabled = false; btn.classList.remove('spinning'); }
    },
    'at-month': el => { const [y, m] = AT.ui.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); AT.ui.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; render(); },
    'at-year': el => { const y = +AT.ui.month.slice(0, 4) + +el.dataset.d; AT.ui.month = `${y}-${AT.ui.month.slice(5, 7)}`; render(); },
    'at-goto': el => { AT.ui.month = el.dataset.m; AT.ui.view = 'month'; render(); },
    'at-view': el => { AT.ui.view = el.dataset.v; render(); },
    'at-pastetbl': () => { AT.ui.pasteTbl = !AT.ui.pasteTbl; bindAttend(); $('#atTblText')?.focus(); },
    'at-pastetbl-read': () => {
      const found = AT.parsePaste($('#atTblText').value);
      if (!found.length) return toast('표를 찾지 못했어요. "성명"과 "9월", "1일 2일 …" 머리줄까지 함께 복사해 주세요.', 'error');
      AT.ui.pasteTbl = false; AT.ui.imp = { file: '붙여넣은 표', found }; bindAttend();
    },
    'at-apply': el => { AT.applyAll(el.dataset.v); },
    'at-undo': () => AT.undo(),
    'at-src-del': async el => {
      const src = el.dataset.src;
      if (!(await confirmBox('불러온 자료를 지울까요?', `'${src}'로 들어온 출석 기록과, 그때 새로 만든 참여자(다른 달 기록이 없는 사람)를 지워요. 바로 되돌릴 수 있어요.`, '지우기'))) return;
      const r = AT.removeSrc(src); toast(`기록 ${r.recs}건${r.people ? `, 참여자 ${r.people}명` : ''}을 지웠어요.`, '', { undo: r.undo });
    },
    'at-month-clear': async () => {
      if (!(await confirmBox(`${V.monthLabel(AT.ui.month)} 출석 기록을 모두 지울까요?`, '참여자 명단은 그대로 두고 이 달 칸만 비워요. 바로 되돌릴 수 있어요.', '모두 지우기'))) return;
      const r = AT.clearMonth(); toast(`${r.n}명의 이 달 기록을 지웠어요.`, '', { undo: r.undo });
    },
    'at-group': el => { AT.ui.group = el.dataset.g; bindAttend(); },
    'at-fill': async () => {
      if (!(await confirmBox('기본 시간으로 채울까요?', `${V.monthLabel(AT.ui.month)} 평일 중 비어 있는 칸만 참여자별 요일 시간으로 채워요. 공휴일은 공가로 들어가요. 이미 적힌 칸은 그대로 둬요.`, '채우기'))) return;
      const n = AT.fillMonth(); toast(n ? `${n}칸을 채웠어요. 휴무·병가 등은 칠하기로 바꾸세요.` : '채울 빈 칸이 없어요.');
    },
    'at-meta': () => { AT.saveMeta($('#atHol').value, $('#atBase').value, $('#atGoal').value); toast('공휴일·기준 일수·목표 훈련시간을 저장했어요.'); },
    'at-fill-one': el => { const p = S.find('jp', el.dataset.id); const n = AT.fillMonth([el.dataset.id]); toast(n ? `${p ? p.name : ''}: 빈 칸 ${n}개를 기본 시간으로 채웠어요.` : `${p ? p.name : ''}: 채울 빈 칸이 없어요.`); },
    'at-shortonly': () => { AT.ui.shortOnly = !AT.ui.shortOnly; bindAttend(); },
    'at-find': el => { if (AT.findRow(el.dataset.id) < 0) { bindAttend(); AT.findRow(el.dataset.id); } },
    'at-xlsx': () => AT.xlsx(),
    'at-print': () => printHtml(fitAttend()),
    'at-padd': () => { AT.addPerson(); toast('참여자 줄을 추가했어요. 이름과 날짜를 적어 주세요.'); setTimeout(() => { const i = [...document.querySelectorAll('#atPeople [data-field="name"]')].find(x => !x.value); i?.focus(); }, 50); },
    'at-paste': () => { AT.ui.paste = !AT.ui.paste; AT.ui.showPeople = true; bindAttend(); $('#atPasteText')?.focus(); },
    'at-paste-commit': () => { const r = AT.pasteCommit($('#atPasteText').value, $('#atPasteType').value, $('#atPasteSub').value); AT.ui.paste = false; toast(`${r.added}명을 추가했어요.${r.skipped ? ` (이미 있는 ${r.skipped}명은 건너뜀)` : ''}`); bindAttend(); },
    'at-pdel': async el => { const p = S.find('jp', el.dataset.id); if (!p) return; if (!(await confirmBox('참여자를 삭제할까요?', `'${p.name || '이름 없음'}'과 이 사람의 출석 기록을 모두 지워요. 바로 되돌릴 수 있어요.`, '삭제'))) return; const undo = AT.removePerson(p.id); toast('참여자를 삭제했어요.', '', { undo }); },
    'at-import': () => {
      const f = document.createElement('input'); f.type = 'file'; f.accept = '.xlsx,.xls';
      f.onchange = async () => {
        const file = f.files[0]; if (!file) return;
        try {
          const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { cellStyles: true });
          const found = AT.parseWorkbook(wb, file.name);
          if (!found.length) return toast('출석부 표를 찾지 못했어요. "성명"과 "1일, 2일…" 머리줄이 있는 엑셀인지 확인하세요.', 'error');
          AT.ui.imp = { file: file.name, found }; bindAttend();
        } catch (err) { toast('엑셀을 읽지 못했어요: ' + err.message, 'error'); }
      };
      f.click();
    },
    'at-imp-toggle': el => { AT.ui.imp.found[+el.dataset.i].on = el.checked; },
    'at-imp-cancel': () => { AT.ui.imp = null; bindAttend(); },
    'at-imp-commit': () => { const r = AT.commitImport(); toast(`참여자 ${r.people}명 추가, 출석 기록 ${r.recs}건을 불러왔어요.`); render(); },
    'gl-mode': el => { V.ui.perf.glMode = el.dataset.mode; render(); },
    'gl-year': el => { V.ui.perf.glYear = +el.dataset.year; render(); },
    'goal-save': async () => {
      const set = V.ui.perf.set, num = v => { const t = String(v).replace(/[^0-9.]/g, ''); return t === '' ? null : Number(t); };
      if (set === GL.SET) {
        const g = GL.goal(), rows = JSON.parse(JSON.stringify(g.rows));
        document.querySelectorAll('[data-goal]').forEach(el => { const i = el.dataset.goal; rows[i] = rows[i] || [null, null, null]; rows[i][+el.dataset.k] = num(el.value); });
        const by = num($('#goalBaseYear')?.value), mo = num($('#goalMonths')?.value);
        await S.saveSettings({ perfGoal: JSON.stringify({ ...g, rows, baseYear: by || g.baseYear, months: Math.min(12, Math.max(1, mo || g.months)) }) });
      } else {
        let custom = S.get().settings.goalsBySet; if (typeof custom === 'string') { try { custom = JSON.parse(custom); } catch { custom = {}; } }
        const mine = {};
        document.querySelectorAll('[data-goal]').forEach(el => { const v = num(el.value); mine[el.dataset.goal] = v == null ? '' : v; });
        await S.saveSettings({ goalsBySet: JSON.stringify({ ...(custom || {}), [set]: mine }) });
      }
      toast('목표를 저장했어요. 월 목표·달성률·대시보드에 바로 반영돼요.');
      render();
    },
    'perf-fix-move': () => {
      const to = $('#perfFixTo')?.value, set = V.ui.perf.set, items = D.PERF_SETS[set].items; if (!to) return;
      const st = S.get();
      const ps = st.perfs.filter(p => p.set === set && S.perfSetOf(p.staff) !== set).map(p => ({ id: p.id, staff: to }));
      const as = st.activities.filter(a => a.fromPerf === 'Y' && items.includes(a.perf) && S.perfSetOf(a.staff) !== set && !(D.PERF_SETS[S.perfSetOf(a.staff)] || { items: [] }).items.includes(a.perf)).map(a => ({ id: a.id, staff: to }));
      if (ps.length) S.putMany('perf', ps); if (as.length) S.putMany('act', as);
      toast(`${ps.length + as.length}건을 ${to} 이름으로 옮겼어요.`);
    },
    'perf-fix-del': async () => {
      const set = V.ui.perf.set, items = D.PERF_SETS[set].items, st = S.get();
      const ps = st.perfs.filter(p => p.set === set && S.perfSetOf(p.staff) !== set), as = st.activities.filter(a => a.fromPerf === 'Y' && items.includes(a.perf) && S.perfSetOf(a.staff) !== set && !(D.PERF_SETS[S.perfSetOf(a.staff)] || { items: [] }).items.includes(a.perf));
      if (!(await confirmBox(`${ps.length + as.length}건을 지울까요?`, '다른 구역 직원 이름으로 잘못 들어간 이 사업 실적이에요. 지우면 되돌릴 수 없어요.', '지우기'))) return;
      ps.forEach(p => S.remove('perf', p.id)); as.forEach(a => S.remove('act', a.id));
      toast('지웠어요.');
    },
    'dp-mgr': () => { DP.ui.mgr = !DP.ui.mgr; },
    'dp-mgr-open': () => { DP.ui.mgr = true; location.hash = '#/dashboard'; setTimeout(() => $('#dpMgr')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 400); },
    /** 대시보드 세부사업·목표 저장: 목표 + 직접 더한 항목의 이름·세는 법. 이름을 바꾸면 그동안 넣은 실적도 옮긴다 */
    'dp-mgr-save': async () => {
      const set = DP.setOfScope(); if (!set) return;
      const num = v => { const t = String(v ?? '').replace(/[^0-9.]/g, ''); return t === '' ? null : Number(t); };
      const st = S.get(), list = D.customItems(set).map(x => ({ ...x }));
      // 이름 바꾸기
      const renames = [];
      document.querySelectorAll('[data-mgr-name]').forEach(el => { const from = el.dataset.mgrName, to = el.value.trim(); if (to && to !== from) renames.push([from, to]); });
      for (const [from, to] of renames) {
        if (D.PERF_SETS[set].items.includes(to) && !renames.some(r => r[0] === to)) return toast(`'${to}'은(는) 이미 있는 세부사업 이름이에요.`, 'error');
      }
      const newName = n => (renames.find(r => r[0] === n) || [, n])[1];
      list.forEach(x => { x.name = newName(x.name); });
      document.querySelectorAll('[data-mgr-only]').forEach(el => { const it = list.find(x => x.name === newName(el.dataset.mgrOnly)); if (it) it.countOnly = el.checked; });
      // 목표
      const goalsIn = {};
      document.querySelectorAll('[data-mgr-goal]').forEach(el => { const i = newName(el.dataset.mgrGoal); (goalsIn[i] = goalsIn[i] || [null, null, null])[+el.dataset.k] = num(el.value); });
      const patch = { perfItems: { ...(st.settings.perfItems || {}), [set]: list } };
      if (set === GL.SET) {
        const g = GL.goal(), rows = {};
        Object.entries(g.rows).forEach(([i, r]) => { rows[newName(i)] = r; });
        Object.entries(goalsIn).forEach(([i, r]) => { rows[i] = r; });
        patch.perfGoal = JSON.stringify({ ...g, rows, baseYear: num($('#mgrBaseYear')?.value) || g.baseYear, months: Math.min(12, Math.max(1, num($('#mgrMonths')?.value) || g.months)) });
      } else {
        let custom = st.settings.goalsBySet; if (typeof custom === 'string') { try { custom = JSON.parse(custom); } catch { custom = {}; } }
        const mine = {};
        Object.entries(goalsIn).forEach(([i, r]) => { mine[i] = r[0] == null ? '' : r[0]; });
        patch.goalsBySet = JSON.stringify({ ...(custom || {}), [set]: mine });
      }
      // 그동안 넣은 실적도 새 이름으로
      if (renames.length) {
        const ps = st.perfs.filter(p => p.set === set && renames.some(r => r[0] === p.item)).map(p => ({ id: p.id, item: newName(p.item) }));
        const as = st.activities.filter(a => a.fromPerf === 'Y' && renames.some(r => r[0] === a.perf)).map(a => ({ id: a.id, perf: newName(a.perf) }));
        if (ps.length) S.putMany('perf', ps); if (as.length) S.putMany('act', as);
      }
      await S.saveSettings(patch);
      toast(`세부사업·목표를 저장했어요.${renames.length ? ` 이름을 바꾼 ${renames.length}개 항목의 실적도 옮겼어요.` : ''} 실적 탭에 바로 반영돼요.`);
      render();
    },
    'dp-mgr-add': async () => {
      const set = DP.setOfScope(); if (!set) return;
      const name = ($('#mgrNewName')?.value || '').trim();
      if (!name) return $('#mgrNewName')?.focus();
      if (D.PERF_SETS[set].items.includes(name)) return toast(`'${name}'은(는) 이미 있어요.`, 'error');
      const num = id => { const t = String($(id)?.value || '').replace(/[^0-9.]/g, ''); return t === '' ? null : Number(t); };
      const st = S.get(), list = [...D.customItems(set), { name, countOnly: !!$('#mgrNewOnly')?.checked }];
      const patch = { perfItems: { ...(st.settings.perfItems || {}), [set]: list } };
      if (set === GL.SET) { const g = GL.goal(); patch.perfGoal = JSON.stringify({ ...g, rows: { ...g.rows, [name]: [num('#mgrNewG0'), num('#mgrNewG1'), num('#mgrNewG2')] } }); }
      else { let custom = st.settings.goalsBySet; if (typeof custom === 'string') { try { custom = JSON.parse(custom); } catch { custom = {}; } } patch.goalsBySet = JSON.stringify({ ...(custom || {}), [set]: { ...((custom || {})[set] || {}), [name]: num('#mgrNewG0') ?? '' } }); }
      DP.ui.mgr = true;
      await S.saveSettings(patch);
      toast(`'${name}' 세부사업을 더했어요. 실적 탭 입력칸에서도 바로 고를 수 있어요.`);
      render();
    },
    'dp-mgr-del': async el => {
      const set = DP.setOfScope(), name = el.dataset.item; if (!set) return;
      if (!(await confirmBox(`'${name}' 세부사업을 지울까요?`, '목표도 같이 지워져요. (기록이 있는 항목은 지울 수 없어요)', '지우기'))) return;
      const st = S.get();
      await S.saveSettings({ perfItems: { ...(st.settings.perfItems || {}), [set]: D.customItems(set).filter(x => x.name !== name) } });
      toast(`'${name}'을(를) 지웠어요.`); render();
    },
    'goal-open': () => { V.ui.perf.goalOpen = !V.ui.perf.goalOpen; },
    'gl-save': async () => {
      const g = GL.readEditor();
      await S.saveSettings({ perfGoal: JSON.stringify(g) });
      toast(`실적 목표 기준을 저장했어요 (${g.baseYear}년 ${g.months}개월 기준 · 인원 ${g.staffNow}/${g.staffNeed}명).`);
    },
    'dp-mode': el => { DP.ui.mode = el.dataset.mode; if (DP.ui.mode === 'month' && !DP.ui.month.startsWith(String(DP.ui.year))) DP.ui.month = String(DP.ui.year) === U.today().slice(0, 4) ? U.today().slice(0, 7) : `${DP.ui.year}-12`; render(); },
    'dp-move': el => {
      const d = +el.dataset.d;
      if (DP.ui.mode === 'year') DP.ui.year += d;
      else { let [y, m] = DP.ui.month.split('-').map(Number); m += d; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } DP.ui.month = `${y}-${U.pad(m)}`; DP.ui.year = y; }
      render();
    },
    'dp-month': el => { DP.ui.mode = 'month'; DP.ui.month = el.dataset.month; DP.ui.year = +el.dataset.month.slice(0, 4); render(); },
    'dp-item': el => push({ type: 'dpitem', item: el.dataset.item, who: '' }, false),
    'dp-sum': el => { const top = stack[stack.length - 1]; if (top && top.type === 'dpsum') { top.kind = el.dataset.kind; renderDrawer(true); } else push({ type: 'dpsum', kind: el.dataset.kind }, false); },
    'dp-link': el => { location.hash = el.dataset.href; },
    'dp-view': el => { DP.ui.view = el.dataset.v; render(); },
    'dp-tables': () => { DP.ui.tables = !DP.ui.tables; },
    'dp-goperf': el => { V.ui.perf.lastItem = el.dataset.item; location.hash = '#/perf'; setTimeout(() => { const fm = document.querySelector('[data-form="perf-add"]'); if (fm) { fm.elements.item.value = el.dataset.item; fm.scrollIntoView({ block: 'center', behavior: 'smooth' }); fm.elements.ppl?.focus(); } }, 300); },
    'dp-ai': async () => {
      const f = DP.coachFacts(); if (!f) return;
      DP.ui.aiBusy = true; render();
      try { const text = await AI.coach(f.text); DP.ui.ai = { key: f.key, text, at: new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' 기준' }; }
      catch (err) { toast('AI 코칭을 받지 못했어요: ' + err.message, 'error'); }
      finally { DP.ui.aiBusy = false; render(); }
    },
    'dp-who': el => { const top = stack[stack.length - 1]; if (top && top.type === 'dpitem') { top.who = el.dataset.who; renderDrawer(true); } },
    'or-file': () => $('#orFile') && $('#orFile').click(),
    'or-cat': el => { OR.ui.cat = el.dataset.cat || ''; render(); },
    'or-todo': el => { OR.ui.todo = el.checked; $('#orList').innerHTML = OR.listHtml(); },
    'or-pick': el => { const top = stack[stack.length - 1]; if (!top || top.type !== 'orprev') return; top.rows[+el.dataset.i].on = el.checked; renderDrawer(true); },
    'or-commit': () => {
      const top = stack[stack.length - 1]; if (!top || top.type !== 'orprev') return;
      const r = OR.commit(top);
      closeDrawer();
      toast(`홍보·방문처를 넣었어요: 새로 ${r.added}곳 · 채움 ${r.filled}곳.${r.locating ? ` 지도 위치를 ${r.locating}곳 찾는 중이에요(1~2분).` : ''}`);
      if (route() !== 'outreach') location.hash = '#/outreach'; else render();
    },
    'or-visit': async el => {
      const n = S.find('net', el.dataset.id); if (!n) return;
      S.upsert('act', { targetType: 'net', targetId: n.id, date: U.today(), type: '홍보', content: '홍보 방문', staff: S.me() });
      toast(`${n.name} 오늘 홍보 방문을 기록했어요. 이름을 누르면 내용을 고칠 수 있어요.`);
    },
    'sec-staff-add': async el => {
      if (!S.isAdmin()) return toast('담당자 추가는 관리자만 할 수 있어요.', 'error');
      const inp = $('#secStaffNew'), name = ((inp && inp.value) || '').trim(), prog = el.dataset.prog;
      if (!name) return inp && inp.focus();
      const ex = S.staff().find(s => s.name === name);
      if (ex && ex.program === prog) return toast(`${name}은(는) 이미 이 구역 담당자예요.`, 'error');
      if (ex && !(await confirmBox(`${name}을(를) 이 구역으로 옮길까요?`, `${name}은(는) 지금 '${ex.program || '소속 없음'}' 담당자예요. '${prog}'(으)로 바꾸면 그쪽 화면에서는 빠져요.`, '옮기기'))) return;
      await S.saveSettings({ staff: ex ? S.staff().map(s => (s.name === name ? { ...s, program: prog } : s)) : [...S.staff(), { name, program: prog }] });
      toast(`${name}을(를) ${prog} 담당자로 ${ex ? '옮겼어요' : '추가했어요'}. 바로 상담자로 고를 수 있어요.`);
      render();
    },
    'ct-month': el => { const f = R.ui.contacts; const [y, m] = f.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); f.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; render(); },
    'ct-tab': el => { R.ui.contacts.tab = el.dataset.tab; render(); },
    'ct-reg': el => { const r = R.registerBiz(el.dataset.id, el.dataset.kind); if (r) toast(r.kind === 'net' ? `${r.x.name} 기관(네트워크)에 연락 기록을 옮겼어요. 기관 상세·홍보·방문처에서 볼 수 있어요.` : `${r.x.name}을(를) 사업체로 등록했어요. 사업체 개발·지도에 나와요.`); },
    'ct-shot': () => pickFiles('image/*,.pdf', false, files => files[0] && fillContactFromShot(files[0])),
    'ct-reg-form': el => {
      // 연락만 한 곳 → 등록 화면을 열어 직접 입력 (저장하면 이 연락 기록도 그곳으로 이어진다)
      const b = S.find('biz', el.dataset.id); if (!b) return;
      const kind = el.dataset.kind === 'net' ? 'net' : 'biz';
      // 연락이력에 적은 담당자(예: '김재윤 부장')를 이름·직함으로 나눠 채우고, 전화번호도 넘긴다 → 저장하면 명함까지 만들어져 사업체 탭에 보인다
      const cn = (S.actsOf('biz', b.id).find(a => a.contactName) || {}).contactName || '';
      const m = cn.split(/[\/,]/)[0].trim().match(/^(\S+)\s*(.*)$/) || [];
      const preset = { name: b.name, phone: b.phone || '', address: b.address || '', cName: m[1] || '', cTitle: (m[2] || '').trim(), cPhone: b.phone || '', ...(b.programs && b.programs.length ? { programs: b.programs } : {}), ...(kind === 'net' ? { category: D.guessCategory(b.name) || '' } : { stage: b.stage, discoveredAt: b.discoveredAt, jobs: b.jobs || '' }) };
      push({ type: 'form', kind, preset, adopt: b.id }, false);
    },
    'ct-reg-all': async () => {
      const ids = [...new Set(R.contactRows(R.ui.contacts.month).filter(r => S.isPending(r.b)).map(r => r.b.id))];
      if (!ids.length || !(await confirmBox(`미등록 ${ids.length}곳을 모두 사업체로 등록할까요?`, '사업체 개발 목록과 지도에 올라가요.', '모두 등록'))) return;
      S.putMany('biz', ids.map(id => ({ id, pending: '' }))); toast(`${ids.length}곳을 사업체로 등록했어요.`);
    },
    'ct-auto-open': () => { R.ui.contacts.autoOpen = !R.ui.contacts.autoOpen; },
    'ct-auto-hide': () => { R.ui.contacts.autoHide = true; render(); },
    'ct-auto-all': el => { document.querySelectorAll('.reg-pick').forEach(c => { c.checked = el.dataset.v === '1'; }); },
    'ct-unreg': async () => {
      const ids = [...document.querySelectorAll('.reg-pick:checked')].map(c => c.value);
      if (!ids.length) return toast('뺄 곳을 골라 주세요.', 'error');
      if (!(await confirmBox(`${ids.length}곳을 미등록으로 돌릴까요?`, '사업체 개발 목록·지도·대시보드에서 빠지고 연락이력에만 남아요. 연락 기록은 그대로이고, 나중에 연락이력 줄에서 다시 등록할 수 있어요.', '미등록으로'))) return;
      S.putMany('biz', ids.map(id => ({ id, pending: 'Y' }))); R.ui.contacts.autoOpen = false; toast(`${ids.length}곳을 미등록으로 돌렸어요.`);
    },
    'ct-ocf': el => { R.ui.contacts.oc = el.dataset.v; render(); },
    'ct-oc': el => { const a = S.find('act', el.dataset.id); if (!a) return; S.upsert('act', { id: a.id, outcome: a.outcome === el.dataset.v ? '' : el.dataset.v }); },
    'ct-copy': async () => { const ok = await copyText(R.contactTsv()); toast(ok ? '복사했습니다. 공유 시트 연락이력 탭의 날짜 칸을 누르고 Ctrl+V 하세요.' : '복사하지 못했습니다.', ok ? '' : 'error'); },
    'ct-copy-report': async () => { const ok = await copyText(R.reportTsv()); toast(ok ? '복사했습니다. 보고용 시트 방문 사업체 표의 날짜 칸을 누르고 Ctrl+V 하세요.' : '복사하지 못했습니다.', ok ? '' : 'error'); },
    'ct-paste': () => push({ type: 'paste', state: { text: '', rows: [] } }, false),
    'ct-url': el => {
      const a = S.find('act', el.dataset.id);
      if (!a) return;
      const v = window.prompt('구인공고 주소 (지우려면 비워 두세요)', a.jobUrl || '');
      if (v == null) return;
      if (v.trim() && !R.jobLink(v)) return toast('구인공고 칸에는 사이트 주소만 넣을 수 있어요. 공고 화면 위쪽 주소창의 주소(https://…)를 복사해 붙여 넣으세요.', 'error');
      S.upsert('act', { id: a.id, jobUrl: R.jobLink(v) });
      toast(v.trim() ? '공고 주소를 바꿨습니다.' : '공고 주소를 지웠습니다.');
    },
    'ct-paste-commit': () => { const top = stack[stack.length - 1]; if (!top || top.type !== 'paste') return; const r = R.commitPaste(top.state.rows, $('#ctPasteWho')?.value); closeDrawer(); toast(`연락이력 ${r.n}줄을 가져왔습니다.${r.biz ? ` 새 사업체 ${r.biz}곳은 사업체 개발·지도에,` : ''}${r.net ? ` 새 기관 ${r.net}곳은 네트워크에` : ''}${r.biz || r.net ? ' 올렸어요.' : ''}`); },
    'ct-file': () => pickFiles('.xlsx,.xls,.csv', true, async files => {
      const top = stack[stack.length - 1]; if (!top || top.type !== 'paste') return;
      let sheets = [];
      let drm = false;
      for (const f of files) { try { sheets = sheets.concat(await R.readFileSheets(f)); } catch (err) { drm = drm || err.drm; toast(`${f.name}을(를) 읽지 못했어요: ${err.message}`, 'error'); } }
      const { rows, skipped, used } = R.parseSheets(sheets);
      top.state = { text: '', file: files.map(f => f.name).join(', '), rows, skipped, used, who: $('#ctPasteWho')?.value || top.state.who };
      renderDrawer(true);
      if (!rows.length && !drm) toast('날짜와 사업체명이 있는 줄을 찾지 못했어요.', 'error');
    }),
    'biz-ledger': async () => { const ok = await copyText(R.ledgerTsv(S.view().businesses)); toast(ok ? `사업체 ${S.view().businesses.length}곳을 복사했습니다. 개발대장 시트의 등록일 칸을 누르고 Ctrl+V 하세요.` : '복사하지 못했습니다.', ok ? '' : 'error'); },
    'dash-pick': el => { V.ui.dash.sel = el.dataset.date; $('#dashCal').innerHTML = V.dashCal(); },
    'dash-move': el => { const [y, m] = V.ui.dash.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); V.ui.dash.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; $('#dashCal').innerHTML = V.dashCal(); },
    'cal-clear': () => { V.ui.sched.sel = ''; bindSched(); },
    'ev-showdone': el => { V.ui.sched.showDone = el.checked; bindSched(); },
    'xlsx-export': () => { S.exportXlsx(); toast('엑셀 파일을 내려받았습니다.'); },
    'xlsx-template': () => S.templateXlsx(),
    'xlsx-import': el => { xlsxMode = el.dataset.mode || 'replace'; $('#xlsxFile').click(); },
    'json-export': () => { S.exportJson(); toast('백업 파일을 내려받았습니다.'); },
    'json-import': () => $('#jsonFile').click(),
    'save-staff': async () => {
      const list = [...document.querySelectorAll('#staffRows .staff-row')].map(r => ({ name: r.querySelector('[name=staffName]').value.trim(), program: r.querySelector('[name=staffProg]').value })).filter(s => s.name);
      if (!list.length) return toast('직원 이름을 한 명 이상 입력하세요.', 'error');
      if (new Set(list.map(s => s.name)).size !== list.length) return toast('같은 이름이 두 번 있습니다. 동명이인은 "김정배A"처럼 구분해 주세요.', 'error');
      // 소속이 없으면 어느 구역(현장중심·고용공단 등)에서도 담당자로 고를 수 없고 기록도 안 보인다
      const noProg = list.filter(s => !s.program).map(s => s.name);
      if (noProg.length && !(await confirmBox(`소속이 없는 직원이 ${noProg.length}명 있어요`, `${noProg.join(', ')}: 소속을 정하지 않으면 현장중심·고용공단 같은 구역 화면에서 담당자로 고를 수 없고, 그 이름으로 된 기록도 안 보여요. 그래도 저장할까요?`, '그래도 저장'))) return;
      // 소속을 바꾼 직원: 그 사람 기록도 새 구역으로 옮겨 보인다
      const moved = list.filter(s => { const o = S.staff().find(x => x.name === s.name); return o && o.program && s.program && o.program !== s.program; });
      if (moved.length && !(await confirmBox('소속을 바꾼 직원이 있어요', `${moved.map(s => `${s.name} → ${s.program}`).join(', ')}: 이 직원 이름으로 된 사업체·연락·실적·일정이 모두 새 구역 화면으로 옮겨 보여요. 계속할까요?`, '저장'))) return;
      await S.saveSettings({ staff: list });
      toast('직원 목록을 저장했습니다.');
    },
    'prog-add': async () => {
      const k = ($('#progNew').value || '').trim();
      if (!k) return $('#progNew').focus();
      if (D.PROGRAMS.some(p => p.key === k)) return toast(`'${k}' 소속은 이미 있어요.`, 'error');
      await S.saveSettings({ programs: [...(S.get().settings.programs || []), k] });
      toast(`'${k}' 소속을 추가했어요. 아래 직원 목록에서 고를 수 있어요.`);
    },
    'prog-del': async el => {
      const k = el.dataset.key;
      const n = S.staff().filter(s => s.program === k).length;
      if (!(await confirmBox(`'${k}' 소속을 지울까요?`, n ? `이 소속인 직원 ${n}명은 '소속 미지정'으로 바뀌어요.` : '이 소속을 쓰는 직원은 없어요.', '지우기'))) return;
      await S.saveSettings({ programs: (S.get().settings.programs || []).filter(x => x !== k), ...(n ? { staff: S.staff().map(s => (s.program === k ? { ...s, program: '' } : s)) } : {}) });
      toast(`'${k}' 소속을 지웠어요.`);
    },
    'staff-add': () => { $('#staffRows').insertAdjacentHTML('beforeend', V.staffRow()); $('#staffRows .staff-row:last-child input').focus(); },
    'staff-del': el => el.closest('.staff-row').remove(),
    'scope-set': el => {
      // 구역 안에서는 다른 구역·전체 팀으로 못 넘어간다
      const sec = curSec(), sc = el.dataset.scope;
      if (sec.prog && sc.startsWith('s:') && S.programOf(sc.slice(2)) === sec.prog) { // 사람별은 화면 안 이름 버튼으로
        const n = sc.slice(2); V.ui.perf.who = n; R.ui.contacts.who = n; return toast(`${n} 선생님 것만 보려면 실적·연락이력 화면의 '${n}' 이름 버튼을 누르세요.`);
      }
      if (sec.prog && sc !== 'p:' + sec.prog) return toast(`${sec.label}에서는 ${sec.label} 자료만 볼 수 있어요. 다른 구역은 위쪽 메뉴에서 고르세요.`);
      S.setScope(sc); toast(`${S.scopeLabel()} 기준으로 봅니다.`);
    },
    'cal-pull': async el => {
      el.disabled = true;
      try { const r = await maybeCalPull(true); toast(r ? `구글 캘린더에서 새로 ${r.added}건, 바뀐 것 ${r.changed}건, 지운 것 ${r.removed}건을 반영했어요.` : '가져올 일정이 없어요.'); }
      catch (err) { toast('가져오지 못했어요: ' + (err.message || err), 'error'); }
      el.disabled = false;
    },
    'cal-pull-toggle': async el => { await S.saveSettings({ calPull: el.checked ? '' : 'N' }); toast(el.checked ? '캘린더 일정도 가져와요.' : '캘린더 일정은 가져오지 않아요.'); },
    'backup-now': async el => {
      el.disabled = true; el.textContent = '백업 중…';
      try { const r = await S.call('api_backupNow'); toast(`백업했어요: ${r.name}`, '', { action: { label: '열기', run: () => window.open(r.url, '_blank') } }); A['backup-list'](); }
      catch (err) { toast('백업하지 못했어요: ' + (err.message || err), 'error'); }
      el.disabled = false; el.textContent = '지금 백업';
    },
    'backup-list': async () => {
      const box = $('#gBackups'); if (!box) return;
      box.textContent = '불러오는 중…';
      try { const r = await S.call('api_backupList'); box.innerHTML = `<ul class="bf-ul">${r.list.map(f => `<li><a href="${U.esc(f.url)}" target="_blank" rel="noopener">💾 ${U.esc(f.name)}</a></li>`).join('') || '<li class="sub">아직 백업이 없어요.</li>'}</ul><a class="sub" href="${U.esc(r.folder)}" target="_blank" rel="noopener">백업 폴더 열기 ↗</a>`; }
      catch (err) { box.textContent = '못 불러왔어요: ' + (err.message || err); }
    },
    'backup-toggle': async el => { await S.saveSettings({ backupOn: el.checked ? '' : 'N' }); toast(el.checked ? '매일 자동 백업해요 (자동 작업이 켜져 있어야 해요).' : '자동 백업을 껐어요.'); },
    'mail-toggle': async el => { await S.saveSettings({ mailOn: el.checked ? 'Y' : '' }); toast(el.checked ? '평일 아침 8시에 메일을 보내요 (자동 작업이 켜져 있어야 해요).' : '아침 메일을 껐어요.'); render(); },
    'mail-test': async el => {
      el.disabled = true;
      try { const r = await S.call('api_mailTest'); toast(r.sent ? '내 메일함을 확인해 보세요. 미리보기를 보냈어요.' : '사용 권한에서 내 계정에 이름을 넣어 주세요. 그 이름으로 일정을 찾아요.', r.sent ? '' : 'error'); }
      catch (err) { toast('보내지 못했어요: ' + (err.message || err), 'error'); }
      el.disabled = false;
    },
    'auto-on': async el => {
      el.disabled = true;
      try { await S.call('api_autoSetup', true); await S.reload(); toast('자동 작업을 켰어요: 15분마다 캘린더 가져오기 · 새벽 2시 백업 · 평일 8시 아침 메일(켠 경우)'); render(); }
      catch (err) { toast('켜지 못했어요: ' + (err.message || err), 'error'); el.disabled = false; }
    },
    'auto-off': async () => { await S.call('api_autoSetup', false); await S.reload(); toast('자동 작업을 껐어요.'); render(); },
    'cal-goto': () => { setTimeout(() => document.querySelector('.cal-panel')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300); },
    'cal-check': async () => {
      const id = ($('#calIdIn')?.value || '').trim();
      if (!id) return toast('캘린더 ID를 붙여넣어 주세요. (캘린더 설정 → 캘린더 통합 → 캘린더 ID)', 'error');
      try {
        const r = await S.call('api_calCheck', id);
        await S.saveSettings({ calId: r.id || id, calName: r.name || '' });
        toast(`'${r.name}' 캘린더에 연결했어요. 이제 일정을 넣으면 캘린더에도 들어가요.`);
        render();
      } catch (err) { toast('연결하지 못했어요: ' + (err.message || err) + ' — 배포를 새 버전으로 했는지, 캘린더 권한을 허용했는지도 확인하세요.', 'error'); }
    },
    'cal-push': async el => {
      el.disabled = true; el.textContent = '보내는 중…';
      try { const r = await S.call('api_calPushAll'); toast(`일정 ${r.sent}건을 구글 캘린더에 보냈어요.`); }
      catch (err) { toast('보내지 못했어요: ' + (err.message || err), 'error'); }
      el.disabled = false; el.textContent = '지금까지 일정 보내기';
    },
    'cal-off': async () => {
      if (!(await confirmBox('구글 캘린더 연결을 끊을까요?', '이미 캘린더에 들어간 일정은 그대로 남고, 앞으로 바뀌는 일정만 반영되지 않아요.', '연결 끊기'))) return;
      await S.saveSettings({ calId: '', calName: '' }); toast('연결을 끊었어요.'); render();
    },
    'acc-add': async () => {
      const inp = $('#accNew');
      const email = inp.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { inp.focus(); return toast('이메일 주소를 확인해 주세요. 예: ardim169@ardim.or.kr', 'error'); }
      const { owner } = S.accessInfo();
      const rows = V.accRows();
      if (email === owner || rows.some(r => r.email === email)) return toast('이미 목록에 있어요.', 'error');
      rows.push({ email, admin: $('#accNewRole').value === 'admin' });
      const nm = ($('#accNewName')?.value || '').trim();
      if (nm) await S.saveSettings({ accNames: JSON.stringify({ ...V.accNames(), [email]: nm }) });
      await saveAcc(rows);
      toast(`${V.accName(email) ? V.accName(email) + ' (' + email + ')' : email}을(를) 추가했습니다.`);
    },
    'acc-perm-open': el => { V.ui.accOpen = V.ui.accOpen === el.dataset.email ? '' : el.dataset.email; render(); },
    'acc-preset': async el => {
      const { email, preset } = el.dataset;
      const p = D.PERM_MENUS.reduce((o, [k]) => ({ ...o, [k]: k === 'map' ? (preset === 'none' ? 'none' : 'view') : preset }), {});
      await savePerms(email, p);
      toast(`${email}: ${{ full: '전부 허용', edit: '삭제만 막기', view: '보기만' }[preset]}으로 정했어요.`);
    },
    'acc-del': async el => {
      const email = el.dataset.email;
      if (email === S.accessInfo().me) return toast('자기 자신은 뺄 수 없어요. 다른 관리자가 빼 주세요.', 'error');
      if (!(await confirmBox('목록에서 뺄까요?', `${V.accName(email) ? V.accName(email) + ' (' + email + ')' : email}은(는) 이제 이 사이트에 들어올 수 없게 됩니다${V.accRows().length <= 1 ? ' (목록이 비면 복지관 계정 누구나 들어올 수 있어요)' : ''}.`, '빼기'))) return;
      await saveAcc(V.accRows().filter(r => r.email !== email));
      await savePerms(email, {});
      toast(`${email}을(를) 뺐습니다.`);
    },
    'save-vworld': async () => {
      const patch = { vworldKey: $('#vworldKeyInput').value.trim() };
      if ($('#vworldDomainInput')) patch.vworldDomain = $('#vworldDomainInput').value.trim();
      await S.saveSettings(patch);
      try { localStorage.removeItem('ardim.basemap.picked'); } catch { /* 저장 불가 */ }
      toast(patch.vworldKey ? '브이월드 키를 저장했어요. 이제 지도 배경이 브이월드(한국 지도)로 나와요. 아래 "주소 찾기 시험"으로도 확인해 보세요.' : '브이월드 키를 지웠어요.');
      render();
    },
    'vworld-test': async el => {
      el.disabled = true; el.textContent = '찾는 중…';
      const addr = '경기도 화성시 향남읍 발안로 12';
      let r = null, err = '';
      try {
        if (S.REMOTE) { r = await S.call('api_geocode', addr); if (r && r.error) { err = r.error; r = null; } }
        else r = await M.geocode(addr);
      } catch (e) { err = e.message; }
      el.disabled = false; el.textContent = '주소 찾기 시험';
      if (r && r.lat) toast(`성공: "${addr}" → ${(+r.lat).toFixed(5)}, ${(+r.lng).toFixed(5)}`);
      else toast(`브이월드에서 찾지 못했어요${err ? ` (${err})` : ''}. 키와 등록한 서비스 URL이 맞는지 확인해 주세요.`, 'error');
    },
    'vworld-refind': async el => {
      // 위치가 없거나 대략 위치(읍면동 중심·도로 이름)인 곳을 브이월드로 다시 찾는다
      const st = S.get();
      const list = [...st.businesses.map(x => ['biz', x]), ...st.networks.map(x => ['net', x])].filter(([, x]) => x.address && (!M.hasPos(x) || x.approx));
      if (!list.length) return toast('다시 찾을 곳이 없어요. 모두 정확한 위치예요.');
      if (!(await confirmBox('브이월드로 위치를 다시 찾을까요?', `주소가 있고 위치가 없거나 대략적인 ${list.length}곳을 차례로 찾습니다. 몇 분 걸릴 수 있어요.`, '찾기'))) return;
      el.disabled = true;
      let found = 0;
      for (const [i, [kind, x]] of list.entries()) {
        el.textContent = `찾는 중… ${i + 1}/${list.length}`;
        // 위치가 없거나 대략 위치면 새로 찾은 위치로 바뀐다 (못 찾으면 그대로)
        await S.refine(kind, x.id);
        const now = S.find(kind, x.id);
        if (now && M.hasPos(now) && !now.approx) found++;
      }
      el.disabled = false; el.textContent = '등록된 곳 위치 브이월드로 다시 찾기';
      toast(`${list.length}곳 중 ${found}곳을 정확한 위치로 바꿨어요.`);
    },
    'save-citymap': () => {
      const v = $('#cityMapInput').value.trim();
      if (v && !/^https?:\/{2}/.test(v)) return toast('http:// 또는 https:// 로 시작하는 주소를 입력하세요.', 'error');
      S.saveSettings({ cityMapUrl: v }); toast('화성시 대시보드 주소를 저장했습니다.');
    },
    'data-clear': async () => {
      if (!(await confirmBox('모든 데이터를 지울까요?', '사업체, 명함, 기관, 활동 기록, 일정이 모두 삭제됩니다. 되돌릴 수 없으니 먼저 엑셀이나 백업 파일로 저장해 두세요.', '모두 지우기'))) return;
      const next = D.empty();
      next.settings = { ...S.get().settings };
      await S.replace(next);
      toast('모든 데이터를 지웠습니다. 새로 등록을 시작하세요.');
    },
    'data-demo': async () => {
      if (!(await confirmBox('예시 데이터를 불러올까요?', '지금 데이터가 예시 데이터로 교체됩니다.', '불러오기'))) return;
      await S.replace(D.demo());
      toast('예시 데이터를 불러왔습니다.');
    },
  };

  function bindGlobal() {
    // 연락이력 화면에서 캡처 이미지를 Ctrl+V 하면 그 캡처로 칸을 채운다
    document.addEventListener('paste', ev => {
      if (route() !== 'contacts' || drawerOpen()) return;
      const f = [...((ev.clipboardData && ev.clipboardData.files) || [])].find(x => /^image\//.test(x.type));
      if (!f) return;
      ev.preventDefault();
      fillContactFromShot(f);
    });
    document.addEventListener('click', ev => {
      if (!ev.target.closest('.menu-wrap')) $('#quickMenu').hidden = true;
      if (!ev.target.closest('.more-sheet, [data-act="more"]')) closeMore();
      const el = ev.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act;
      if (!A[act]) return;
      if (!allowed(gateOf(act, el))) { ev.preventDefault(); return; }
      if (el.tagName === 'A' && act !== 'map-net-only') ev.preventDefault();
      if (el.closest('.menu')) $('#quickMenu').hidden = true;
      A[act](el, !!el.closest('#drawer'));
    });
    document.addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); openSearch(); return; }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); A['sync-now']($('#syncBtn')); return; }
      if (ev.key === 'Escape') {
        if (!$('#confirmLayer').hidden) return $('#confirmCancel').click();
        if (!$('#searchLayer').hidden) return closeSearch();
        if (drawerOpen()) return (stack.length > 1 ? A['dr-back']() : closeDrawer());
      }
      if (ev.key === 'Enter' && ev.target.matches('[data-act][tabindex]')) ev.target.click();
    });
    $('#searchTrigger').onclick = openSearch;
    $('#globalBizFile').onchange = async ev => {
      const files = [...ev.target.files]; ev.target.value = '';
      if (!files.length) return;
      // 장애인개발원 시스템 엑셀(사업체정보·직무분석)은 여러 개를 한 번에 합쳐서
      const reads = [];
      for (const f of files) { try { const k = await IMP.keadRead(f); if (k) reads.push(k); } catch (err) { if (err.drm) return toast(err.message, 'error'); } }
      if (reads.length) { push({ type: 'kead', state: IMP.keadPlan(reads) }, false); return; }
      handleBizFile(files[0]);
    };
    $('#globalCardPhoto').onchange = ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) handleCardPhoto(f); };
    $('#scopeSel').onchange = ev => S.setScope(ev.target.value);
    S.onSync(renderSync);
    renderSync(S.sync);
    $('#searchLayer').addEventListener('click', ev => { if (ev.target.id === 'searchLayer') closeSearch(); });
    $('#searchInput').addEventListener('input', ev => { srIndex = 0; drawSearch(ev.target.value); });
    $('#searchInput').addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!srItems.length) return;
        srIndex = (srIndex + (ev.key === 'ArrowDown' ? 1 : -1) + srItems.length) % srItems.length;
        drawSearch(ev.target.value);
        $('.sr.hi')?.scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter' && srItems[srIndex]) {
        const [k, id] = srItems[srIndex]; closeSearch(); openDetail(k, id, false);
      }
    });
    $('#scrim').onclick = closeDrawer;
    document.addEventListener('change', ev => {
      const el = ev.target.closest('[data-chg]');
      if (!el) return;
      const { id, field } = el.dataset;
      inlineEdit = true;
      if (!allowed(CHG_GATES[el.dataset.chg])) { inlineEdit = false; render(); return; }
      if (el.dataset.chg === 'acc-perm') {
        inlineEdit = false;
        const { email, menu } = el.dataset;
        let cur = {};
        try { cur = (JSON.parse(S.get().settings.perms || '{}') || {})[email] || {}; } catch { cur = {}; }
        savePerms(email, { ...cur, [menu]: el.value }).then(() => toast(`${email}: ${Object.fromEntries(D.PERM_MENUS)[menu]} → ${Object.fromEntries(D.PERM_LEVELS)[el.value]}`));
        return;
      }
      if (el.dataset.chg === 'acc-name') {
        inlineEdit = false;
        const map = { ...V.accNames() }, email = el.dataset.email.toLowerCase(), v = el.value.trim();
        if (v) map[email] = v; else delete map[email];
        S.saveSettings({ accNames: JSON.stringify(map) }).then(() => toast(v ? `${email} → ${v}` : `${email} 이름을 지웠어요.`));
        return;
      }
      if (el.dataset.chg === 'acc-role') {
        inlineEdit = false;
        const email = el.dataset.email;
        if (email === S.accessInfo().me && el.value !== 'admin') { el.value = 'admin'; toast('자기 자신을 사용자로 내릴 수는 없어요. 다른 관리자가 바꿔 주세요.', 'error'); return; }
        saveAcc(V.accRows().map(r => (r.email === email ? { ...r, admin: el.value === 'admin' } : r))).then(() => toast(`${email}을(를) ${el.value === 'admin' ? '관리자' : '사용자'}로 바꿨습니다.`));
        return;
      }
      if (field === 'date' && /^(act|pa|pf)-field$/.test(el.dataset.chg) && !U.isDate(el.value)) { inlineEdit = false; render(); return; }
      if (el.dataset.chg === 'pa-field' || el.dataset.chg === 'pf-field') {
        inlineEdit = false;
        const v = field === 'people' || field === 'newPeople' ? (el.value === '' ? '' : Math.max(0, +el.value || 0)) : field === 'content' || field === 'note' || field === 'round' ? el.value.trim() : el.value;
        S.upsert(el.dataset.chg === 'pa-field' ? 'act' : 'perf', { id, [field]: v });
        const ax = el.dataset.chg === 'pa-field' && field === 'date' ? S.find('act', id) : null;
        if (ax && ax.type === '발굴' && ax.targetType === 'biz' && S.find('biz', ax.targetId)) S.upsert('biz', { id: ax.targetId, discoveredAt: v });
        if (field === 'perf' && v === '제외') toast('이 기록을 실적에서 뺐습니다. 아래 "실적에서 뺀 기록"에서 다시 넣을 수 있어요.');
        return;
      }
      if (el.dataset.chg === 'act-field' && field === 'date') { inlineEdit = false; S.upsert('act', { id, date: el.value }); return; }
      if (el.dataset.chg === 'act-field' && field === 'jobUrl') {
        if (el.value.trim() && !R.jobLink(el.value)) { inlineEdit = false; toast('구인공고 칸에는 사이트 주소만 넣을 수 있어요. 공고 화면 위쪽 주소창의 주소(https://…)를 복사해 붙여 넣으세요.', 'error'); el.select(); return; }
        S.upsert('act', { id, jobUrl: R.jobLink(el.value) });
      } else if (el.dataset.chg === 'act-field') S.upsert('act', { id, [field]: el.value });
      else if (el.dataset.chg === 'jp-field') S.upsert('jp', { id, [field]: el.value.trim() });
    });
    document.addEventListener('submit', async ev => {
      const form = ev.target;
      ev.preventDefault();
      if (form.id === 'entityForm') { const k = KIND_MENU[form.dataset.form]; if (!allowed(k ? [[k, 2]] : null)) return; const m = form.elements.regMode?.value; if ((m === 'net' || m === 'biz') && !allowed([[KIND_MENU[m], 2]])) return; return onSubmit(form); }
      if (form.dataset.form === 'quick-log' && !allowed([[KIND_MENU[form.dataset.kind] || 'biz', 2]])) return;
      if (!allowed(FORM_GATES[form.dataset.form])) return;
      if (form.dataset.form === 'sv-biz' || form.dataset.form === 'sv-job') {
        const b = S.find('biz', form.dataset.id);
        if (!b) return;
        if (form.dataset.form === 'sv-biz') {
          S.upsert('biz', { id: b.id, survey: SV.collectBiz(form) });
          stack[stack.length - 1] = { type: 'svBizView', id: b.id };
          toast('사업체정보지를 저장했습니다.');
        } else {
          const j = SV.collectJob(form);
          if (!j.jobName) { form.elements.jobName.focus(); return toast('담당직무명을 입력하세요.', 'error'); }
          const list = [...(b.jobAnalyses || [])];
          const i = list.findIndex(x => x.id === j.id);
          if (i >= 0) list[i] = j; else list.push(j);
          S.upsert('biz', { id: b.id, jobAnalyses: list });
          stack[stack.length - 1] = { type: 'svJobView', id: b.id, job: j.id };
          toast('직무분석지를 저장했습니다.');
        }
        renderDrawer();
        return;
      }
      if (form.dataset.form === 'ct-add') {
        const fd = Object.fromEntries(new FormData(form).entries());
        if (!fd.name.trim()) { form.elements.name.focus(); return toast('사업체명을 입력하세요.', 'error'); }
        if (!fd.staff) return toast('이 구역 담당자가 없어요. 위 담당자 칸에서 이름을 추가한 뒤 기록하세요.', 'error');
        if (!fd.content.trim()) fd.content = fd.result || `${fd.type || '전화'} 연락`; // 결과를 비워도 기록은 남긴다
        if ((fd.jobUrl || '').trim() && !R.jobLink(fd.jobUrl)) { form.elements.jobUrl.focus(); return toast('구인공고 칸에는 사이트 주소만 넣을 수 있어요. 공고 화면 위쪽 주소창의 주소(https://…)를 복사해 붙여 넣으세요.', 'error'); }
        fd.jobUrl = R.jobLink(fd.jobUrl);
        clearDraft('ct-add'); // 저장하면 쓰던 칸은 비운다 (다시 그리기 전에)
        if (U.isDate(fd.date) && fd.date.slice(0, 7) !== R.ui.contacts.month) R.ui.contacts.month = fd.date.slice(0, 7); // 넣은 달의 목록으로
        const b = R.addContact(fd);
        const fl = R.ui.contacts.flash;
        setTimeout(() => {
          const row = document.querySelector(`#ctResults [data-row="${fl}"]`);
          if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          else toast('기록은 저장했는데 지금 보는 범위(위쪽 소속 선택)에서는 안 보여요. 범위를 "전체 팀"으로 바꿔 확인하세요.', 'error');
        }, 120);
        setTimeout(() => { if (R.ui.contacts.flash === fl) { R.ui.contacts.flash = null; document.querySelector(`#ctResults [data-row="${fl}"]`)?.classList.remove('pt-new'); } }, 4000);
        toast(S.isPending(b) ? `${b.name} 연락을 기록했어요. 아직 미등록이라 사업체·지도에는 안 나와요. 목록에서 '사업체로 등록'을 누르면 올라가요.` : `${b.name} 연락을 기록했습니다.`);
        setTimeout(() => { const f = document.querySelector('[data-form="ct-add"]'); if (f) { f.elements.name.focus(); } }, 50);
        return;
      }
      if (form.dataset.form === 'perf-add') {
        const fd = Object.fromEntries(new FormData(form).entries());
        if (!U.isDate(fd.date)) return toast('사업날짜를 입력하세요.', 'error');
        // 담당은 꼭 이 구역(실적 분류표) 직원으로 (다른 구역 직원 이름으로 들어가 안 보이는 일이 없게)
        if (!fd.staff || S.perfSetOf(fd.staff) !== V.ui.perf.set) return toast('이 구역 담당자가 없어요. 위 담당자 칸에서 이름을 추가한 뒤 입력하세요.', 'error');
        const item = fd.item, name = (fd.name || '').trim(), note = (fd.note || '').trim();
        const k = U.orgKey(name);
        let b = name && S.get().businesses.find(x => U.orgKey(x.name) === k);
        // 실적에서 사업체개발로 넣으면 그 사업체는 등록(사업체·지도에 나옴). 연락만 했던 곳(미등록)이면 등록으로 바꾼다
        if (b && S.isPending(b) && item === '사업체개발') b = S.upsert('biz', { id: b.id, pending: '' });
        const n = !b && name && S.get().networks.find(x => U.orgKey(x.name) === k);
        // 사업체개발인데 처음 보는 이름이면 사업체로 바로 등록한다 (목록·지도에도 나오고 실적표에 굵게 표시)
        let newBiz = false;
        if (!b && !n && name && item === '사업체개발') {
          b = S.upsert('biz', { name, stage: '발굴', discoveredAt: fd.date, staff: fd.staff || S.me(), source: '실적 입력', placements: 0, phone: '', address: '' });
          newBiz = true;
        }
        const people = fd.people ? +fd.people : '';
        const ppl = String(fd.ppl || '').split(/[,，、/·;\n]+/).map(x => x.trim()).filter(Boolean).join(', ');
        const isAct = !!(b || n), newId = U.uid(isAct ? 'A' : 'P'), who = fd.staff || S.me();
        // 끝 날짜가 있으면 그날까지 날마다 한 줄씩 (주말·공휴일은 빼고, '주말 포함'이면 주말도)
        if (U.isDate(fd.dateTo) && fd.dateTo > fd.date) {
          const days = [];
          for (let d = fd.date; d <= fd.dateTo && days.length < 93; d = U.addDays(d, 1)) {
            const wd = U.parse(d).getDay();
            if (!fd.withWeekend && (wd === 0 || wd === 6)) continue;
            let hol = []; try { hol = window.AT ? (AT.meta(d.slice(0, 7)).holidays || []).map(Number) : []; } catch { hol = []; }
            if (!fd.withWeekend && hol.includes(+d.slice(8, 10))) continue;
            days.push(d);
          }
          if (!days.length) return toast('그 기간에 넣을 날이 없어요. (주말·공휴일은 빼고 세요)', 'error');
          if (!(await confirmBox(`${days.length}일에 한 줄씩 넣을까요?`, `${U.dateDot(days[0])} ~ ${U.dateDot(days[days.length - 1])} ${fd.withWeekend ? '' : '평일 '}${days.length}일 · ${item} · ${who}${name ? ` · ${name}` : ''}`, `${days.length}줄 넣기`))) { if (newBiz) S.remove('biz', b.id); return; }
          clearDraft('perf-add');
          const ids = days.map(() => U.uid(isAct ? 'A' : 'P'));
          Object.assign(V.ui.perf, { lastItem: item, lastDate: days[days.length - 1], lastStaff: who, flash: ids[0] });
          if (isAct) S.upsertMany('act', days.map((d, i) => ({ id: ids[i], targetType: b ? 'biz' : 'net', targetId: (b || n).id, date: d, type: fd.type || '방문', content: note || `${item} 실적`, staff: who, perf: item, people, ppl, fromPerf: 'Y' })));
          else S.upsertMany('perf', days.map((d, i) => ({ id: ids[i], date: d, set: V.ui.perf.set, item, people, newPeople: '', round: '', place: name, note, staff: who, ppl })));
          toast(`${item} ${days.length}줄을 넣었어요. (${U.dateDot(days[0])} ~ ${U.dateDot(days[days.length - 1])})`);
          hiddenHere(who);
          return;
        }
        clearDraft('perf-add');
        Object.assign(V.ui.perf, { lastItem: item, lastDate: fd.date, lastStaff: who, flash: newId }); // 다시 그릴 때 고른 항목·날짜를 그대로 두고 새 줄을 표시
        let rec;
        if (b || n) {
          const extra = [fd.newPeople && `신규 ${fd.newPeople}명`, fd.round && `${fd.round}회차`].filter(Boolean).join(' · ');
          rec = S.upsert('act', { id: newId, targetType: b ? 'biz' : 'net', targetId: (b || n).id, date: fd.date, type: fd.type || '방문', content: [note || `${item} 실적`, extra].filter(Boolean).join(' / '), staff: who, perf: item, people, ppl, fromPerf: 'Y' });
        } else {
          rec = S.upsert('perf', { id: newId, date: fd.date, set: V.ui.perf.set, item, people, newPeople: fd.newPeople ? +fd.newPeople : '', round: (fd.round || '').trim(), place: name, note, staff: who, ppl });
        }
        toast(`${fd.date} ${item} · ${who}에 한 줄 추가했어요.${newBiz ? ` '${name}'을(를) 사업체로 새로 등록했어요. 주소를 넣으면 지도에도 나와요.` : ''}`);
        hiddenHere(who);
        setTimeout(() => { const r = document.querySelector(`#perfResults [data-row="${rec.id}"]`); if (r) r.scrollIntoView({ block: 'center', behavior: 'smooth' }); const fm = document.querySelector('[data-form="perf-add"]'); if (fm) fm.elements.name.focus(); }, 80);
        setTimeout(() => { if (V.ui.perf.flash === rec.id) V.ui.perf.flash = null; }, 4000);
        return;
      }
      if (form.dataset.form === 'place-q') { placeSearch(($('#placeQ')?.value || '').trim()); return; }
      if (form.dataset.form === 'quick-log') {
        const fd = Object.fromEntries(new FormData(form).entries());
        if (!fd.content.trim()) { form.elements.content.focus(); return toast('기록할 내용을 입력하세요.', 'error'); }
        S.upsert('act', { targetType: form.dataset.kind, targetId: form.dataset.id, date: fd.date || U.today(), type: fd.type, content: fd.content.trim(), staff: fd.staff, perf: fd.perf || '', people: fd.people ? +fd.people : '' });
        toast('활동을 기록했습니다.');
      }
    });
    // 빈 필수 칸 때문에 '추가'가 안 될 때, 어느 칸인지 크게 알려 준다
    let invalidAt = 0;
    document.addEventListener('invalid', ev => {
      const el = ev.target; el.classList.add('need');
      el.addEventListener('input', () => el.classList.remove('need'), { once: true });
      if (Date.now() - invalidAt < 800) return; invalidAt = Date.now();
      const lab = el.closest('label, .field'); const name = lab ? (lab.querySelector('label') || lab).firstChild.textContent.replace('*', '').trim() : '';
      toast(`${name ? `'${name}'` : '빨간'} 칸을 채워야 추가돼요.`, 'error');
    }, true);
    window.addEventListener('hashchange', () => { if (drawerOpen()) closeDrawer(); render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });
    S.subscribe(() => {
      // 표 안에서 칸을 고칠 때는 화면 전체를 다시 그리지 않아 입력 위치가 유지되게 한다
      if (inlineEdit) {
        inlineEdit = false;
        if (route() === 'contacts') $('#ctResults').innerHTML = R.contactsResults();
        if (route() === 'attend') setTimeout(() => {
          const a = document.activeElement, id = a && a.dataset && a.dataset.id, fd = a && a.dataset && a.dataset.field;
          bindAttend();
          if (id && fd) $(`#atPeople [data-id="${id}"][data-field="${fd}"]`)?.focus({ preventScroll: true });
        }, 0);

      }
      if (route() === 'attend' && $('#atResults')) { bindAttend(); renderNav(); }
      else if (route() === 'map' && V.ui.map.mode !== 'city' && bigMap && $('#mapList')) softMap();
      else if (route() !== 'map' || !drawerOpen()) render(); else { refreshMap(false); renderNav(); }
      if (drawerOpen() && stack[stack.length - 1]?.type === 'detail') renderDrawer(true);
    });
  }

  /* ---------- 구글 드라이브 달별 정리 ---------- */
  const prevYm = () => { const t = U.parse(U.today()); const d = new Date(t.getFullYear(), t.getMonth() - 1, 1); return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; };
  let archiving = false, perfSplitDone = false;
  let xlsxMode = 'merge';
  async function archiveSync(months, onStep) {
    if (archiving) throw new Error('이미 정리하는 중이에요.');
    archiving = true;
    let n = 0, root = '', i = 0;
    try {
      const jobs = R.ARCHIVE_SECTIONS.flatMap(sec => months.map(m => [sec, m]));
      for (const [sec, m] of jobs) {
        i++;
        const files = R.archiveFiles(m, sec.scope);
        if (onStep) onStep(i, jobs.length, m, files.length);
        if (!files.length) continue;
        const r = await S.call('api_archiveWrite', { section: sec.section, files });
        n += r.files.length; root = r.root;
      }
    } finally { archiving = false; }
    return { n, root };
  }
  async function archiveAuto() {
    const st = S.get().settings;
    if (!S.REMOTE || !S.isAdmin() || st.archiveAuto === 'N' || (st.archiveAt || '').slice(0, 10) === U.today()) return;
    if (!(await S.whenSaved())) return;
    try { await archiveSync([prevYm(), U.today().slice(0, 7)]); } catch (err) { console.warn('드라이브 정리 실패', err); }
  }
  async function start() {
    view.innerHTML = `<div class="skel" style="height:28px;width:180px;margin-bottom:18px"></div><div class="skel" style="height:110px;margin-bottom:18px"></div><div class="skel" style="height:320px"></div>`;
    try {
      await S.init();
    } catch (err) {
      console.error(err);
      view.innerHTML = `<div class="panel"><div class="empty"><strong>데이터를 불러오지 못했습니다</strong>${S.REMOTE ? '구글 시트에 연결하지 못했습니다. 시트를 공유받았는지 확인하고 새로고침해 보세요. (' + U.esc(err.message || err) + ')' : '브라우저 저장소에 접근할 수 없습니다. 시크릿 창이라면 일반 창에서 열어 주세요.'}<div><button class="btn" type="button" onclick="location.reload()">다시 시도</button></div></div></div>`;
      return;
    }
    try {
      const missing = ['U', 'D', 'S', 'M', 'V', 'F', 'SV', 'R'].filter(k => !window[k]);
      if (missing.length) {
        const parts = window.__parts, order = parts ? parts.join(' → ') : '';
        const bad = parts && order !== 'app1 → app2 → app3' ? ` 파일이 읽힌 순서: ${order} (app1 → app2 → app3 이어야 해요. 파일 이름과 내용이 맞는지 확인하세요).` : '';
        const errs = (window.__errs || []).slice(0, 3).join(' / ');
        throw new Error(`프로그램 일부(${missing.join(', ')})를 불러오지 못했습니다.${bad}${errs ? ` 오류: ${errs}.` : ''} ${parts ? 'app1~app3.html' : 'index.html'}을 처음부터 끝까지 다시 붙여 넣고 새 버전으로 배포해 주세요.`);
      }
      bindGlobal();
      verCheck();
      // 열 때도 지금 구역의 기록만 보이게 (예전에 '전체 팀'으로 저장돼 있으면 구역으로 맞춘다)
      { const sp = curSec().prog; if (sp && S.getScope() !== 'p:' + sp) S.setScope('p:' + sp); } // 예전에 한 사람만 보게 저장돼 있어도 구역 전체로
      render();
      // 현재 접속자: 바로 한 번, 그 뒤 1분마다·페이지를 옮길 때마다 알린다
      pingPresence(); setInterval(pingPresence, 60000);
      setTimeout(archiveAuto, 8000); // 관리자가 열면 하루 한 번 이번 달·지난달 정리 파일을 드라이브에 새로 고친다
      window.addEventListener('hashchange', () => setTimeout(pingPresence, 300));
      document.addEventListener('click', ev => { if (!ev.target.closest('#presence')) { const m = $('#presenceMenu'); if (m) m.hidden = true; } });
    } catch (err) {
      console.error(err);
      view.innerHTML = `<div class="panel"><div class="empty"><strong>화면을 열지 못했습니다</strong>${window.U ? U.esc(err.message || String(err)) : String(err.message || err)}<div><button class="btn" type="button" onclick="location.reload()">다시 시도</button></div></div></div>`;
    }
  }

  return { start, toast, confirm: confirmBox, render };
})();

App.start();
