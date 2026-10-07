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
    ['orders', '출장·특근', 'trip'],
    ['attend', '출석부', 'att', () => S.get().jobPeople.length],
    ['data', '데이터 관리', 'data'],
  ];
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
    'new-biz': [['biz', 2]], 'biz-upload': [['biz', 2]], 'bulk-commit': [['biz', 2]], 'stage-set': [['biz', 2]], 'sup-toggle': [['biz', 2]],
    'ai-summary': [['biz', 2]], 'ai-research': [['biz', 2]], 'edit-research': [['biz', 2]], 'sv-biz-edit': [['biz', 2]], 'sv-job-edit': [['biz', 2]], 'sv-clear': [['biz', 2]], 'sv-job-del': [['biz', 3]],
    'nopos-refind': [['biz', 2]], 'new-net': [['network', 2]], 'home-add': [['network', 2]],
    'new-card': [['cards', 2]], 'card-link-to': [['cards', 2]], 'card-autolink': [['cards', 2]], 'card-photo': [['cards', 2]], 'card-pdf': [['cards', 2]], 'card-bulk-commit': [['cards', 2]], 'photo-clear': [['cards', 2]],
    'map-addmode': [['biz', 2]],
    'new-event': [['schedule', 2]], 'tp-save': [['schedule', 2]], 'tp-color': [['schedule', 2]], 'tp-fmt': [['schedule', 2]], 'tp-fc': [['schedule', 2]], 'tp-align': [['schedule', 2]], 'tp-chkbox': [['schedule', 2]], 'tp-fmt-clear': [['schedule', 2]], 'tp-check': [['schedule', 2]], 'tp-dd-pick': [['schedule', 2]], 'tp-merge': [['schedule', 2]], 'tp-undo': [['schedule', 2]], 'tp-del': [['schedule', 3]], 'tp-clear': [['schedule', 3]], 'tp-import': [['schedule', 2]], 'tp-imp-commit': [['schedule', 2]], 'tp-copy-prev': [['schedule', 2]], 'tp-label': [['schedule', 2]], 'tp-notes-save': [['schedule', 2]], 'ev-import': [['schedule', 2]], 'edit-event': [['schedule', 2]], 'ev-toggle': [['schedule', 2]], 'ev-del': [['schedule', 3]],
    'ct-paste': [['contacts', 2]], 'ct-file': [['contacts', 2]], 'ct-paste-commit': [['contacts', 2]], 'ct-url': [['contacts', 2]],
    'perf-del': [['perf', 3]], 'od-hwp': [['orders', 2]], 'od-hwp-commit': [['orders', 2]], 'od-import': [['orders', 2]], 'od-add': [['orders', 2]], 'od-dup': [['orders', 2]], 'od-del': [['orders', 3]], 'tv-road': [['orders', 2]], 'tv-save-set': [['orders', 2]], 'gl-save': [['perf', 2]], 'at-fill': [['attend', 2]], 'at-meta': [['attend', 2]], 'at-padd': [['attend', 2]], 'at-paste-commit': [['attend', 2]], 'at-pdel': [['attend', 3]], 'at-apply': [['attend', 2]], 'at-fill-one': [['attend', 2]], 'at-undo': [['attend', 2]], 'at-src-del': [['attend', 3]], 'at-month-clear': [['attend', 3]], 'at-import': [['attend', 2]], 'at-imp-commit': [['attend', 2]], 'at-pastetbl-read': [['attend', 2]],
  };
  function gateOf(act, el) {
    const d = el.dataset || {};
    if (act === 'edit' || act === 'edit-loc' || act === 'map-move') return [[KIND_MENU[d.kind], 2]];
    if (act === 'map-add-here') return [[d.kind === 'net' ? 'network' : 'biz', 2]];
    if (act === 'delete' || act === 'merge') return [[KIND_MENU[d.kind], 3]];
    if (act === 'triage') return d.to === 'personal' ? [['cards', 2]] : [['cards', 2], [KIND_MENU[d.to], 2]];
    if (act === 'act-del') { const x = S.find('act', d.id); return [[x && x.targetType === 'net' ? 'network' : 'biz', 3]]; }
    if (act === 'focus-log') { const top = stack[stack.length - 1]; return [[KIND_MENU[top && top.kind] || 'biz', 2]]; }
    if (act === 'open') return [[KIND_MENU[d.kind], 1]];
    return GATES[act] || null;
  }
  const FORM_GATES = { 'perf-item-add': [['perf', 2]], 'ct-add': [['contacts', 2]], 'perf-add': [['perf', 2]], 'sv-biz': [['biz', 2]], 'sv-job': [['biz', 2]] };
  const CHG_GATES = { 'pa-field': [['perf', 2]], 'pf-field': [['perf', 2]], 'jp-field': [['attend', 2]], 'act-field': [['contacts', 2]], 'trip-field': [['orders', 2]], 'trip-report': [['orders', 2]] };
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

  /* ---------- Nav ---------- */
  function renderNav() {
    const r = route();
    // 데이터 관리는 관리자에게만 보인다 (팀원은 등록·수정·삭제만)
    applyPermClasses();
    const n = navOf(r);
    $('#sideNav').innerHTML = NAV.filter(([k]) => (k !== 'data' || S.isAdmin()) && canSee(k)).map(([k, l, ic, cnt]) => `<a href="#/${hrefOf(k)}" data-nav="${k}" class="${n === k ? 'active' : ''}" ${n === k ? 'aria-current="page"' : ''}>${V.I[ic]}<span>${l}</span>${cnt ? `<span class="count">${cnt()}</span>` : ''}</a>`).join('');
    const moreActive = ['network', 'schedule', 'contacts', 'perf', 'orders', 'attend', 'data'].includes(r);
    $('#bottomNav').innerHTML = MOBILE.filter(([k]) => !MENU_NAME[k] || S.level(k) >= 1).map(([k, l, ic]) => `<a href="#/${k}" class="${r === k ? 'active' : ''}">${V.I[ic]}${l}</a>`).join('') +
      `<button type="button" class="${moreActive ? 'active' : ''}" data-act="more">${V.I.more}더보기</button>`;
    $('#sideFoot').innerHTML = `${U.esc(S.get().settings.orgName)}<br>${S.REMOTE ? '팀 공유 모드 · 구글 시트에 저장' : '이 브라우저에만 저장됩니다.'}<br><label class="me-quick">사용자 <select id="meQuick" aria-label="이 PC를 쓰는 사람">${S.staff().map(s => `<option ${s.name === S.me() ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</select></label><br><span class="num">버전 ${U.esc(window.APP_VERSION || '개발용')}</span>`;
    $('#demoBanner').hidden = !S.get().isDemo;
    $('#meQuick').onchange = ev => { S.setMe(ev.target.value); toast(`이 PC 사용자를 ${ev.target.value}(으)로 정했습니다. 활동 기록의 기록자로 남아요.`); render(); };
    renderScope();
  }

  /* ---------- 보기 범위 · 동기화 상태 ---------- */
  function renderScope() {
    const sel = $('#scopeSel');
    const staff = S.staff();
    const cur = S.getScope();
    const progs = D.PROGRAMS.filter(p => staff.some(s => s.program === p.key));
    sel.innerHTML = `<option value="all">전체 팀 (${staff.length}명)</option>` +
      progs.map(p => `<option value="p:${U.esc(p.key)}">${U.esc(p.key)} (${staff.filter(s => s.program === p.key).length}명)</option>`).join('') +
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
    const map = { loading: ['불러오는 중', ''], saving: ['저장 중…', 'busy'], saved: [`저장됨 ${t}`, 'ok'], error: ['저장 오류', 'err'] };
    const [label, cls] = map[sync.status] || ['', ''];
    el.className = 'sync ' + cls;
    el.textContent = label;
    el.title = sync.status === 'error' ? '구글 시트와 연결되지 않았습니다. 새로고침해 보세요.' : '팀원이 바꾼 내용은 1분마다, 또는 이 창으로 돌아올 때 반영됩니다.';
  }

  /* ---------- Pages ---------- */
  let bigMap = null, markerIndex = {}, markerGroup = null;
  function render() {
    const r = route();
    document.body.dataset.route = r; // 화면마다 제목 색을 다르게
    closeMore();
    const pages = {
      dashboard: [V.dashboard],
      biz: [V.bizPage, bindBiz], // 사업체·네트워크 메뉴의 세 탭

      map: [V.mapPage, bindMap],
      cards: [V.cardsPage, bindCards],
      network: [V.netPage, bindNet],
      schedule: [V.schedPage, bindSched],
      perf: [V.perfPage, bindPerf],
      contacts: [R.contactsPage, () => { $('#ctResults').innerHTML = R.contactsResults(); }],
      orders: [R.ordersPage, () => { $('#odResults').innerHTML = R.ordersResults(); }],
      attend: [AT.page, bindAttend],
      data: S.isAdmin() ? [V.dataPage, bindData] : [() => `<div class="panel"><div class="empty"><strong>데이터 관리는 관리자만 볼 수 있어요</strong>사업체·네트워크·명함·연락이력·일정·실적·명령부 등록과 삭제는 그대로 할 수 있어요.<br>내 계정: <b>${U.esc(S.accessInfo().me || '(확인 안 됨)')}</b> · 이 PC 사용자는 왼쪽 아래에서 바꿀 수 있어요.<div><a class="btn" href="#/dashboard">대시보드로</a></div></div></div>`],
    };
    let [html, after] = pages[r] || pages.dashboard;
    if (MENU_NAME[r] && S.level(r) < 1) [html, after] = [() => `<div class="panel"><div class="empty"><strong>${MENU_NAME[r]} 메뉴는 볼 권한이 없어요</strong>관리자에게 권한을 요청하세요.<div><a class="btn" href="#/dashboard">대시보드로</a></div></div></div>`, null];
    try {
      view.innerHTML = html();
      after && after();
    } catch (err) {
      console.error(err);
      view.innerHTML = `<div class="panel"><div class="empty"><strong>화면을 그리는 중 문제가 생겼습니다</strong>${U.esc(err.message)}<div><button class="btn" type="button" onclick="location.reload()">다시 시도</button></div></div></div>`;
    }
    renderNav();
    renderSync(S.sync);
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
    refreshMap(true);
    const fx = V.ui.map.focus;
    if (fx) { V.ui.map.focus = null; setTimeout(() => A['map-focus']({ dataset: fx }), 350); }
    $('#mapQ').addEventListener('input', U.debounce(ev => { V.ui.map.q = ev.target.value.trim(); refreshMap(false); }, 150));
    // 두 곳 찍기 중에 빈 곳을 찍으면 그 자리를 출발·도착으로 쓴다
    // 오른쪽 클릭(휴대폰은 길게 누르기)은 언제든 "여기에 추가"
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
  function refreshMap(fit) {
    const f = V.ui.map;
    const items = V.mapItems();
    $('#mapList').innerHTML = V.mapList(items);
    const bar = $('#mapSolo');
    if (bar) { bar.innerHTML = V.soloBar(); bar.hidden = !bar.innerHTML; }
    if (!bigMap) return;
    if (markerGroup) markerGroup.remove();
    markerIndex = {};
    markerGroup = L.featureGroup();
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
    // 이 달 발굴은 맨 위에 그린다
    shown.sort((a, b) => (a.month ? 1 : 0) - (b.month ? 1 : 0)).forEach(({ kind, x, month }) => {
      const m = (kind === 'biz' ? M.bizMarker(x, month) : kind === 'net' ? M.netMarker(x) : M.cardMarker(x))
        .bindTooltip(label(kind, x), { direction: 'top', offset: [0, -6] });
      // 두 곳 찍기 중에는 말풍선 대신 바로 출발·도착으로 고른다
      if (f.pick) m.on('click', ev => { L.DomEvent.stop(ev); pickRoute({ kind, id: x.id }); });
      else m.bindPopup(M.popupHtml(kind, x), { autoPanPaddingTopLeft: [20, 70] });
      m.addTo(markerGroup);
      markerIndex[kind + x.id] = m;
    });
    markerGroup.addTo(bigMap);
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
    if (d.lat && d.lng) { out.lat = +d.lat; out.lng = +d.lng; out.area = D.areaAt(+d.lat, +d.lng) || ''; }
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
      <div class="inline pop-actions"><button class="btn btn-sm btn-primary" type="button" data-act="map-add-here" data-kind="biz" data-lat="${lat}" data-lng="${lng}">사업체 개발 등록</button><button class="btn btn-sm" type="button" data-act="map-add-here" data-kind="net" data-lat="${lat}" data-lng="${lng}">기관 등록</button></div></div>`).openOn(bigMap);
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
  const PAGE_NAME = { dashboard: '대시보드', biz: '사업체 개발', map: '지도', cards: '명함', network: '네트워크', schedule: '일정', contacts: '연락이력', perf: '실적', orders: '출장·특근', attend: '출석부', data: '데이터 관리' };
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
    const label = p => p.name || (p.email ? p.email.split('@')[0] : '사용자');
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
  async function handleHwpFiles(files) {
    push({ type: 'loading', title: '한글 명령부 불러오기', body: `${files.length}개 파일을 읽는 중입니다.` });
    const rows = [], errors = [];
    for (const f of files) {
      try {
        const year = (f.name.match(/20\d\d/) || [])[0] || R.ui.orders.month.slice(0, 4);
        const got = R.parseOrderTables(await HWP.readTables(await f.arrayBuffer()), year);
        if (!got.length) errors.push(`${f.name}: 명령부 표를 찾지 못했습니다.`);
        rows.push(...got);
      } catch (err) { errors.push(`${f.name}: ${err.message}`); }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
    push({ type: 'hwp', state: { files: files.map(f => f.name), rows: R.markDup(rows), errors } });
  }
  /** 명령부를 A4 세로 한 쪽에 맞춘다: 화면 밖에서 실제 크기(190mm 폭)를 재고, 넘치면 줄 높이·글자를 조금씩 줄여 다시 그린다 */
  function fitOrder(staff) {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:-10000px;top:0;width:190mm;visibility:hidden';
    document.body.appendChild(box);
    const limit = 272 * 96 / 25.4; // A4 297mm − 위아래 여백 20mm − 여유 5mm
    let html = '';
    for (const scale of [1, 0.93, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56]) {
      html = R.orderDoc(staff, scale);
      box.innerHTML = html;
      const art = box.querySelector('.order-doc');
      art.classList.add('measure');
      if (art.getBoundingClientRect().height <= limit) break;
    }
    box.remove();
    return html;
  }
  /** 아무 문서나 A4 세로 한 쪽에 맞추기: make(scale) → html */
  function fitA4(make) {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:-10000px;top:0;width:190mm;visibility:hidden';
    document.body.appendChild(box);
    const limit = 272 * 96 / 25.4;
    let html = '';
    for (const scale of [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52]) {
      html = make(scale); box.innerHTML = html;
      const art = box.querySelector('.order-doc'); art.classList.add('measure');
      if (art.getBoundingClientRect().height <= limit) break;
    }
    box.remove();
    return html;
  }
  /** 여비 명세도 명령부와 같이 A4 한 쪽에 맞춘다 */
  function fitTravel(staff) {
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:-10000px;top:0;width:190mm;visibility:hidden';
    document.body.appendChild(box);
    const limit = 272 * 96 / 25.4;
    let html = '';
    for (const scale of [1, 0.93, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56]) {
      html = TV.doc(R.ui.orders.month, staff, scale);
      box.innerHTML = html;
      const art = box.querySelector('.order-doc');
      art.classList.add('measure');
      if (art.getBoundingClientRect().height <= limit) break;
    }
    box.remove();
    return html;
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
    if (V.ui.sched.view === 'train') {
      const b = $('#tpBox'); if (!b) return;
      const w0 = $('#tpWrap'), sx = w0 ? w0.scrollLeft : 0, y = window.scrollY;
      b.innerHTML = TR.view(); TR.bindGrid(toast);
      const w = $('#tpWrap'); if (w) w.scrollLeft = sx; window.scrollTo(0, y);
      return;
    }
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
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const { next, found } = S.parseXlsx(await file.arrayBuffer());
        if (!found.length) { toast('알맞은 시트를 찾지 못했습니다. 시트 이름이 사업체·네트워크·명함·활동기록·일정인지 확인하세요.', 'error'); return; }
        const ok = await confirmBox('엑셀 데이터로 교체할까요?', `${found.join(', ')} 시트에서 사업체 ${next.businesses.length}곳, 기관 ${next.networks.length}곳, 명함 ${next.cards.length}장, 활동 ${next.activities.length}건, 일정 ${next.events.length}건을 읽었습니다. 지금 데이터는 모두 교체됩니다.`, '교체');
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
  function closeDrawer() {
    stack = [];
    drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
    $('#scrim').hidden = true;
    document.body.style.overflow = '';
    setTimeout(() => { if (!drawerOpen()) $('#drawerInner').innerHTML = ''; }, 250);
  }
  function renderDrawer(keepScroll) {
    const top = stack[stack.length - 1];
    if (!top) return closeDrawer();
    const inner = $('#drawerInner');
    inner.dataset.tone = '';
    const oldScroll = keepScroll ? inner.querySelector('.dr-body')?.scrollTop : 0;
    let v;
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
        const { rows } = R.parsePaste(box.value);
        top.state = { text: box.value, rows };
        renderDrawer(true);
        $('#ctPasteBox').focus();
        $('#ctPasteBox').setSelectionRange(9e9, 9e9);
      }, 250);
      if (!keepScroll) box.focus();
      return;
    }
    if (top.type === 'hwp') {
      inner.innerHTML = R.hwpDialog(top.state);
      showDrawer();
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
    const before = id && kind === 'biz' ? (S.find('biz', id) || {}).discoveredAt : null;
    const saved = S.upsert(kind, obj);
    if (id && kind === 'biz' && U.isDate(saved.discoveredAt) && before !== saved.discoveredAt) {
      const disc = S.get().activities.filter(a => a.targetType === 'biz' && a.targetId === id && a.type === '발굴');
      if (disc.length) S.putMany('act', disc.map(a => ({ id: a.id, date: saved.discoveredAt })));
    }
    if (kind === 'card' && res.extra) {
      stack.pop();
      registerFromCard(saved, res.extra.to, res.extra.name, res.extra.cat, false);
      return;
    }
    if (!id && kind === 'biz') S.upsert('act', { targetType: 'biz', targetId: saved.id, date: saved.discoveredAt || U.today(), type: '발굴', content: `${saved.source || '발굴'}로 사업체 등록`, staff: saved.staff || S.me() });
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
    el.innerHTML = '<a href="#/network">기관·네트워크</a><a href="#/attend">출석부</a><a href="#/schedule">일정</a><a href="#/contacts">연락이력</a><a href="#/perf">실적</a><a href="#/orders">출장·특근 명령부</a>' + (S.isAdmin() ? '<a href="#/data">데이터 관리</a>' : '');
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
    'sched-view': el => { V.ui.sched.view = el.dataset.v; render(); },
    'tp-cls': el => { TR.ui.cls = el.dataset.cls; TR.resetGrid(); bindSched(); },
    'tp-color': el => TR.setColor(el.dataset.color),
    'tp-merge': () => TR.toggleMerge(),
    'tp-fmt': el => TR.setFmt(null, el.dataset.k),
    'tp-fc': el => TR.setFmt({ fc: el.dataset.color }),
    'tp-align': el => TR.setFmt({ al: el.dataset.al }),
    'tp-chkbox': () => TR.setFmt(null, 'chk'),
    'tp-fmt-clear': () => TR.clearFmt(),
    'tp-check': el => TR.toggleCheck(+el.dataset.r, +el.dataset.c),
    'tp-dd': el => TR.openDD(+el.dataset.r, +el.dataset.c),
    'tp-dd-pick': el => { TR.setCat(el.dataset.v); TR.closeDD(); },
    'tp-undo': () => TR.undo(toast),
    'tp-month': el => { const [y, m] = TR.ui.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); TR.ui.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; TR.resetGrid(); bindSched(); },
    'tp-edit': el => { TR.ui.edit = { date: el.dataset.date, slot: el.dataset.slot }; bindSched(); setTimeout(() => $('#tpCat')?.focus(), 30); },
    'tp-cancel': () => { TR.ui.edit = null; bindSched(); },
    'tp-save': () => { TR.save(); bindSched(); toast('일정표 칸을 저장했어요.'); },
    'tp-del': () => { const undo = TR.remove(); bindSched(); toast('칸을 비웠어요.', '', undo ? { undo } : {}); },
    'tp-label': el => { const cur = (TR.at(el.dataset.date.slice(0, 7), +el.dataset.date.slice(8), '라벨') || {}).content || ''; const v = prompt(`${+el.dataset.date.slice(5, 7)}월 ${+el.dataset.date.slice(8)}일 옆에 붙일 표시 (예: 건강관리, 식권 발급 X). 비우면 지워요.`, cur); if (v == null) return; TR.setLabel(el.dataset.date, v.trim()); },
    'tp-notes-save': () => { TR.saveNotes($('#tpNotes').value); toast('안내 문구를 저장했어요.'); },
    'tp-clear': async () => { if (!(await confirmBox(`${TR.ui.cls} ${+TR.ui.month.slice(5)}월 일정표를 비울까요?`, '이 반의 이 달 칸·표시·안내를 모두 지워요. 바로 되돌릴 수 있어요.', '비우기'))) return; const undo = TR.clearMonth(); toast('일정표를 비웠어요.', '', undo ? { undo } : {}); },
    'tp-copy-prev': () => { const r = TR.copyPrev(); toast(r.n ? `${V.monthLabel(r.from)} 요일별 프로그램으로 빈 칸 ${r.n}개를 채웠어요. 휴관·특별 일정은 직접 고쳐 주세요.` : `${V.monthLabel(r.from)}에 가져올 요일별 프로그램이 없어요.`); },
    'tp-print': () => {
      // A4 가로 한 장에 들어가게 글자·칸 크기를 줄여 가며 잰다
      const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:-10000px;top:0;width:281mm;visibility:hidden';
      document.body.appendChild(box);
      const limit = 192 * 96 / 25.4; let html = '';
      for (const sc of [1, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6]) { html = TR.doc(undefined, undefined, sc); box.innerHTML = html; if (box.firstElementChild.getBoundingClientRect().height <= limit) break; }
      box.remove(); printHtml(html);
    },
    'tp-import': () => pickFiles('.xlsx,.xls,.hwp', true, async files => {
      const found = [];
      for (const f of files) {
        try {
          if (/\.hwp$/i.test(f.name)) found.push(...TR.fromHwpTables(await HWP.readTables(await f.arrayBuffer()), f.name));
          else found.push(...TR.fromWorkbook(XLSX.read(new Uint8Array(await f.arrayBuffer()), { cellStyles: true }), f.name));
        } catch (err) { toast(`${f.name}을(를) 읽지 못했어요: ${err.message}`, 'error'); }
      }
      if (!found.length) return toast('일정표를 찾지 못했어요. 월·화·수·목·금 머리줄과 오전·오후 칸이 있는 표인지 확인해 주세요.', 'error');
      found.forEach(x => { x.on = true; });
      TR.ui.imp = { files: files.map(f => f.name), found, mode: 'over' }; bindSched();
    }),
    'tp-imp-toggle': el => { TR.ui.imp.found[+el.dataset.i].on = el.checked; },
    'tp-imp-mode': el => { TR.ui.imp.mode = el.value; },
    'tp-imp-cancel': () => { TR.ui.imp = null; bindSched(); },
    'tp-imp-commit': () => { const r = TR.commitImport(); toast(`${r.put}칸을 합쳤어요.${r.skipped ? ` 이미 적힌 ${r.skipped}칸은 그대로 뒀어요.` : ''}`); render(); },
    'ev-import': () => pickFiles('.xlsx,.xls,.csv,.hwp', true, async files => {
      let evs = [];
      for (const f of files) {
        try {
          if (/\.hwp$/i.test(f.name)) evs.push(...TR.eventsFromHwp(await HWP.readTables(await f.arrayBuffer()), f.name));
          else if (/\.csv$/i.test(f.name)) evs.push(...TR.eventsFromWorkbook(XLSX.read(await f.text(), { type: 'string' }), f.name));
          else evs.push(...TR.eventsFromWorkbook(XLSX.read(new Uint8Array(await f.arrayBuffer())), f.name));
        } catch (err) { toast(`${f.name}을(를) 읽지 못했어요: ${err.message}`, 'error'); }
      }
      const have = new Set(S.get().events.map(x => `${x.date}|${x.title}`));
      const fresh = evs.filter(x => !have.has(`${x.date}|${x.title}`) && (have.add(`${x.date}|${x.title}`), true));
      if (!evs.length) return toast('일정을 찾지 못했어요. 표 첫 줄에 "날짜"와 "제목(또는 내용·일정)" 칸이 있어야 해요. 직업훈련 일정표는 위 "직업훈련 일정표" 탭에서 불러오세요.', 'error');
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
      $('#mapMonthLabel').textContent = V.monthLabel(V.ui.map.month);
      refreshMap(false);
    },
    'map-listmode': () => { V.ui.map.listAll = !V.ui.map.listAll; $('#mapListMode').textContent = V.ui.map.listAll ? '이 달만' : '전체 목록'; refreshMap(false); },
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
    'map-focus': el => {
      const { kind, id } = el.dataset;
      const m = markerIndex[kind + id];
      if (!m || !bigMap) return openDetail(kind, id, false);
      bigMap.setView(m.getLatLng(), Math.max(bigMap.getZoom(), 15));
      m.openPopup();
      if (window.innerWidth <= 860) $('#bigMap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
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
    'od-print': el => printHtml(fitOrder(el.dataset.staff || null)),
    'od-hwp': () => $('#hwpFile').click(),
    'od-hwp-commit': () => { const top = stack[stack.length - 1]; if (!top || top.type !== 'hwp') return; const n = R.commitHwp(top.state.rows); closeDrawer(); toast(`명령부 ${n}줄을 가져왔습니다.`); render(); },
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
    'od-print-each': () => printHtml(R.orderDocsEach(fitOrder)),
    'od-bulk': () => { const f = R.ui.orders; if (f.bulk && f.bulkOpen) { f.bulkOpen = false; f.bulk = null; } else { f.bulkOpen = true; R.bulkState(); } $('#odResults').innerHTML = R.ordersResults(); },
    'od-bulk-print': () => { const html = R.bulkDocs(fitOrder); if (html) printHtml(html); },
    'od-bulk-file': () => { const { name, blob } = R.bulkFile(fitOrder); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast(`${name} 파일을 받았어요. 한글 또는 워드로 열 수 있어요.`); },
    'od-file': el => { const { name, blob } = R.orderFile(el.dataset.staff || null, fitOrder); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast(`${name} 파일을 받았습니다. 한글 또는 워드로 열 수 있습니다.`); },
    'od-month': el => { const f = R.ui.orders; const [y, m] = f.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); f.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; render(); },
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
    'gl-save': async () => {
      const g = GL.readEditor();
      await S.saveSettings({ perfGoal: JSON.stringify(g) });
      toast(`실적 목표 기준을 저장했어요 (${g.baseYear}년 ${g.months}개월 기준 · 인원 ${g.staffNow}/${g.staffNeed}명).`);
    },
    'od-who': el => { R.ui.orders.who = el.dataset.who; $('#odResults').innerHTML = R.ordersResults(); },
    'od-staff-add': async () => {
      if (!S.isAdmin()) return toast('담당자 추가는 관리자만 할 수 있어요.', 'error');
      const name = ($('#odStaffNew').value || '').trim();
      if (!name) return $('#odStaffNew').focus();
      if (S.staff().some(s => s.name === name)) return toast(`${name}은(는) 이미 담당자 목록에 있어요.`, 'error');
      await S.saveSettings({ staff: [...S.staff(), { name, program: $('#odStaffProg').value }] });
      toast(`담당자 ${name}을(를) 추가했어요. 일정·실적·지도 등 모든 화면의 담당자 목록에 같이 들어가요.`);
    },
    'od-staff-del': async el => {
      const name = el.dataset.name;
      if (!S.isAdmin()) return toast('담당자 삭제는 관리자만 할 수 있어요.', 'error');
      if (S.staff().length <= 1) return toast('담당자가 한 명은 있어야 해요.', 'error');
      const n = S.get().trips.filter(t => t.staff === name).length;
      if (!(await confirmBox(`담당자 ${name}을(를) 목록에서 뺄까요?`, `담당자 목록에서만 빠지고, 이미 적힌 명령부${n ? ` ${n}건` : ''}·일정·사업체 기록은 그대로 남아요.`, '빼기'))) return;
      const before = S.staff().map(s => ({ ...s }));
      await S.saveSettings({ staff: S.staff().filter(s => s.name !== name) });
      if (R.ui.orders.who === name) R.ui.orders.who = '';
      toast(`${name}을(를) 담당자 목록에서 뺐어요.`, '', { undo: () => S.saveSettings({ staff: before }) });
    },
    'od-kind': el => { R.ui.orders.kind = el.dataset.kind; render(); },
    'tv-save-set': async () => {
      const eff = $('#tvEff').value.replace(/[^0-9.]/g, ''), price = $('#tvPrice').value.replace(/[^0-9]/g, '');
      const otS = ($('#tvOtS')?.value || '').replace(/[^0-9]/g, ''), otL = ($('#tvOtL')?.value || '').replace(/[^0-9]/g, '');
      await S.saveSettings({ fuelEff: eff, fuelPrice: price, otShort: otS, otLong: otL });
      const r = TV.otRate();
      toast(`저장했어요: 연비 ${eff || '-'}km/L · 유가 ${price ? (+price).toLocaleString() : '-'}원/L · 특근비 4시간 미만 ${r.short.toLocaleString()}원 · 이상 ${r.long.toLocaleString()}원`);
    },
    'tv-copy': async () => { const ok = await copyText(TV.tsv(R.ui.orders.month)); toast(ok ? '여비 표를 복사했어요. 엑셀·한글 표에 붙여 넣으세요.' : '복사하지 못했습니다.', ok ? '' : 'error'); },
    'tv-print-part': el => { const m = R.ui.orders.month; printHtml(fitA4(sc => TV.settleDoc(m, el.dataset.staff, el.dataset.part, sc))); },
    'tv-print-sum': () => printHtml(TV.settleSumDoc(R.ui.orders.month)),
    'tv-print-all': () => { const m = R.ui.orders.month; printHtml(TV.settle(m).people.map(p => fitA4(sc => TV.settleDoc(m, p.name, 'all', sc))).join('') + TV.settleSumDoc(m)); },
    'tv-print': () => { const list = TV.staffOf(R.ui.orders.month); if (list.length) printHtml(list.map(fitTravel).join('')); },
    'tv-road': async () => {
      // 개인 차량으로 간 줄 중 거리를 안 적은 곳: 복지관 ↔ 출장지 도로 거리 × 2(왕복)를 채운다
      const home = TV.homeOf();
      if (!home) return toast('복지관 위치가 없어 거리를 잴 수 없어요. 지도에서 ★ 복지관 위치를 먼저 등록해 주세요.', 'error');
      const list = TV.monthTrips(R.ui.orders.month).filter(t => TV.ownCar(t) && !Number(t.km));
      if (!list.length) return toast('거리를 채울 개인 차량 출장이 없어요. (방법이 "개인 차량"인 줄만 채워요)');
      let ok = 0, miss = 0;
      const patch = [];
      for (const t of list) {
        const p = TV.placeOf(t);
        if (!p || !M.hasPos(p)) { miss++; continue; }
        const road = await M.roadRoute(home, p);
        const km = road ? road.km * 2 : M.distKm(home, p) * 1.35 * 2;
        patch.push({ id: t.id, km: String(Math.round(km * 10) / 10) });
        ok++;
      }
      patch.forEach(p => S.upsert('trip', p));
      toast(`${ok}건의 왕복 거리를 채웠어요.${miss ? ` ${miss}건은 출장지를 지도에서 못 찾아 직접 적어 주세요.` : ''}`);
    },
    'od-import': () => { const n = R.importVisits(); toast(`방문 기록 ${n}건을 관내출장 명령부로 불러왔습니다. 출장시간·출장복명을 채워 주세요.`); },
    'od-add': () => { const f = R.ui.orders; const d = f.month === U.today().slice(0, 7) ? U.today() : f.month + '-01'; S.upsert('trip', { kind: f.kind, date: d, staff: f.who || S.me(), place: '', purpose: f.kind === '특근' ? '사업체 개발' : '사업체개발', method: f.kind === '출장' ? '복지관 차량' : '', time: '', report: [], dept: f.kind === '특근' ? '직업' : '', note: '' }); },
    'od-dup': el => { const t = S.find('trip', el.dataset.id); if (!t) return; const other = S.staff().map(s => s.name).find(n => n !== t.staff) || t.staff; S.upsert('trip', { ...t, id: undefined, staff: other, actId: '' }); toast(`${other} 동행 줄을 추가했습니다. 성명을 확인하세요.`); },
    'od-del': el => { const undo = S.remove('trip', el.dataset.id); if (undo) toast('한 줄을 삭제했습니다.', '', { undo }); },
    'od-copy': async () => { const ok = await copyText(R.ordersTsv()); toast(ok ? '복사했습니다. 한글 명령부 표에서 첫 칸을 블록 지정한 뒤 붙여넣으세요.' : '복사하지 못했습니다.', ok ? '' : 'error'); },
    'ct-month': el => { const f = R.ui.contacts; const [y, m] = f.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); f.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; render(); },
    'ct-tab': el => { R.ui.contacts.tab = el.dataset.tab; render(); },
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
    'ct-paste-commit': () => { const top = stack[stack.length - 1]; if (!top || top.type !== 'paste') return; const r = R.commitPaste(top.state.rows); closeDrawer(); toast(`연락이력 ${r.n}줄을 가져왔습니다.${r.biz ? ` 새 사업체 ${r.biz}곳은 사업체 개발·지도에도 올렸어요.` : ''}`); },
    'ct-file': () => pickFiles('.xlsx,.xls,.csv', true, async files => {
      const top = stack[stack.length - 1]; if (!top || top.type !== 'paste') return;
      let cells = [];
      let drm = false;
      for (const f of files) { try { cells = cells.concat(await R.readFileCells(f)); } catch (err) { drm = drm || err.drm; toast(`${f.name}을(를) 읽지 못했어요: ${err.message}`, 'error'); } }
      const { rows } = R.parseCells(cells);
      top.state = { text: '', file: files.map(f => f.name).join(', '), rows };
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
    'xlsx-import': () => $('#xlsxFile').click(),
    'json-export': () => { S.exportJson(); toast('백업 파일을 내려받았습니다.'); },
    'json-import': () => $('#jsonFile').click(),
    'save-staff': async () => {
      const list = [...document.querySelectorAll('#staffRows .staff-row')].map(r => ({ name: r.querySelector('[name=staffName]').value.trim(), program: r.querySelector('[name=staffProg]').value })).filter(s => s.name);
      if (!list.length) return toast('직원 이름을 한 명 이상 입력하세요.', 'error');
      if (new Set(list.map(s => s.name)).size !== list.length) return toast('같은 이름이 두 번 있습니다. 동명이인은 "김정배A"처럼 구분해 주세요.', 'error');
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
    'scope-set': el => { S.setScope(el.dataset.scope); toast(`${S.scopeLabel()} 기준으로 봅니다.`); },
    'acc-add': async () => {
      const inp = $('#accNew');
      const email = inp.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { inp.focus(); return toast('이메일 주소를 확인해 주세요. 예: ardim169@ardim.or.kr', 'error'); }
      const { owner } = S.accessInfo();
      const rows = V.accRows();
      if (email === owner || rows.some(r => r.email === email)) return toast('이미 목록에 있어요.', 'error');
      rows.push({ email, admin: $('#accNewRole').value === 'admin' });
      await saveAcc(rows);
      toast(`${email}을(를) ${$('#accNewRole')?.value === 'admin' ? '관리자' : '사용자'}로 추가했습니다.`);
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
      if (!(await confirmBox('목록에서 뺄까요?', `${email}은(는) 이제 이 사이트에 들어올 수 없게 됩니다${V.accRows().length <= 1 ? ' (목록이 비면 복지관 계정 누구나 들어올 수 있어요)' : ''}.`, '빼기'))) return;
      await saveAcc(V.accRows().filter(r => r.email !== email));
      await savePerms(email, {});
      toast(`${email}을(를) 뺐습니다.`);
    },
    'save-vworld': async () => {
      const patch = { vworldKey: $('#vworldKeyInput').value.trim() };
      if ($('#vworldDomainInput')) patch.vworldDomain = $('#vworldDomainInput').value.trim();
      await S.saveSettings(patch);
      toast('브이월드 키를 저장했습니다. 아래 "주소 찾기 시험"으로 확인해 보세요. 지도 배경 목록에도 브이월드가 나타납니다.');
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
      if (ev.key === 'Enter' && ev.target.id === 'odStaffNew' && !ev.isComposing) { ev.preventDefault(); A['od-staff-add'](); }
    });
    $('#searchTrigger').onclick = openSearch;
    $('#hwpFile').onchange = ev => { const files = [...ev.target.files]; ev.target.value = ''; if (files.length) handleHwpFiles(files); };
    $('#globalBizFile').onchange = ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) handleBizFile(f); };
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
      // 일정표 도구: 글씨체·크기·글자색·칸 색·훈련 구분
      const tf = ev.target.closest('[data-tpfmt]');
      if (tf) {
        if (!allowed([['schedule', 2]])) return;
        const k = tf.dataset.tpfmt, v = tf.value;
        if (k === 'font') TR.setFmt({ font: v });
        else if (k === 'size') TR.setFmt({ size: v ? +v : '' });
        else if (k === 'fc') TR.setFmt({ fc: v.replace('#', '').toUpperCase() });
        else if (k === 'bg') TR.setColor(v.replace('#', '').toUpperCase());
        else if (k === 'cat' && v) TR.setCat(v);
        return;
      }
      const bk = ev.target.closest('#odBulk [data-bulk]');
      if (bk) {
        const b = R.bulkState(), k = bk.dataset.bulk, box = $('#odBulk');
        if (k === 'from' || k === 'to') b[k] = bk.value || b[k];
        else if (k === 'staff' || k === 'kinds') b[k] = [...box.querySelectorAll(`[data-bulk="${k}"]:checked`)].map(x => x.value);
        else b[k] = bk.checked;
        if (b.from > b.to) [b.from, b.to] = [b.to, b.from];
        $('#odResults').innerHTML = R.ordersResults();
        return;
      }
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
        const v = field === 'people' ? (el.value === '' ? '' : Math.max(0, +el.value || 0)) : field === 'content' || field === 'note' ? el.value.trim() : el.value;
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
      else if (el.dataset.chg === 'trip-field') S.upsert('trip', { id, [field]: el.value });
      else if (el.dataset.chg === 'jp-field') S.upsert('jp', { id, [field]: el.value.trim() });
      else if (el.dataset.chg === 'trip-report') {
        const t = S.find('trip', id);
        const set = new Set(t.report || []);
        if (el.checked) set.add(el.value); else set.delete(el.value);
        S.upsert('trip', { id, report: D.TRIP_REPORTS.filter(r => set.has(r)) });
      }
    });
    document.addEventListener('submit', ev => {
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
        if (!fd.name.trim() || !fd.content.trim()) return toast('사업체명과 결과를 입력하세요.', 'error');
        if ((fd.jobUrl || '').trim() && !R.jobLink(fd.jobUrl)) { form.elements.jobUrl.focus(); return toast('구인공고 칸에는 사이트 주소만 넣을 수 있어요. 공고 화면 위쪽 주소창의 주소(https://…)를 복사해 붙여 넣으세요.', 'error'); }
        fd.jobUrl = R.jobLink(fd.jobUrl);
        const b = R.addContact(fd);
        toast(`${b.name} 연락을 기록했습니다.`);
        setTimeout(() => { const f = document.querySelector('[data-form="ct-add"]'); if (f) { f.elements.name.focus(); } }, 50);
        return;
      }
      if (form.dataset.form === 'perf-item-add') {
        const fd = Object.fromEntries(new FormData(form).entries());
        const item = form.dataset.item, name = (fd.name || '').trim();
        if (!U.isDate(fd.date)) return toast('날짜를 입력하세요.', 'error');
        const k = U.orgKey(name);
        const b = name && S.get().businesses.find(x => U.orgKey(x.name) === k), n = !b && name && S.get().networks.find(x => U.orgKey(x.name) === k);
        const people = fd.people ? +fd.people : '';
        V.ui.perf.pdOpen = item;
        if (b || n) {
          S.upsert('act', { targetType: b ? 'biz' : 'net', targetId: (b || n).id, date: fd.date, type: fd.type, content: fd.content.trim() || `${item} 실적`, staff: S.me(), perf: item, people });
          toast(`${(b || n).name} 기록을 ${item}에 추가했습니다.`);
        } else {
          S.upsert('perf', { date: fd.date, set: V.ui.perf.set, item, people, newPeople: '', round: '', note: [name, fd.content.trim()].filter(Boolean).join(' · '), staff: S.me() });
          toast(`${item} 실적을 추가했습니다.${name ? ' (등록되지 않은 이름이라 직접 입력으로 넣었어요)' : ''}`);
        }
        return;
      }
      if (form.dataset.form === 'perf-add') {
        const fd = Object.fromEntries(new FormData(form).entries());
        if (!fd.date) return toast('사업날짜를 입력하세요.', 'error');
        S.upsert('perf', { date: fd.date, set: V.ui.perf.set, item: fd.item, people: fd.people ? +fd.people : '', newPeople: fd.newPeople ? +fd.newPeople : '', round: fd.round.trim(), note: fd.note.trim(), staff: S.me() });
        toast(`${fd.date} ${fd.item} 실적을 추가했습니다.`);
        return;
      }
      if (form.dataset.form === 'quick-log') {
        const fd = Object.fromEntries(new FormData(form).entries());
        if (!fd.content.trim()) { form.elements.content.focus(); return toast('기록할 내용을 입력하세요.', 'error'); }
        S.upsert('act', { targetType: form.dataset.kind, targetId: form.dataset.id, date: fd.date || U.today(), type: fd.type, content: fd.content.trim(), staff: fd.staff, perf: fd.perf || '', people: fd.people ? +fd.people : '' });
        toast('활동을 기록했습니다.');
      }
    });
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
        // 여비 계산은 금액이 바로 바뀌어야 하므로 다시 그리되, 커서가 있던 칸으로 돌아간다
        if (route() === 'orders') setTimeout(() => {
          // Tab으로 다음 칸에 커서가 옮겨 간 뒤에 다시 그려야 그 칸을 기억할 수 있다
          const a = document.activeElement, id = a && a.dataset && a.dataset.id, fd = a && a.dataset && a.dataset.field;
          const y = window.scrollY, wrap = $('.tv-tbl, .od-tbl')?.closest('.table-wrap'), x = wrap ? wrap.scrollLeft : 0;
          $('#odResults').innerHTML = R.ordersResults();
          const w2 = $('.tv-tbl, .od-tbl')?.closest('.table-wrap'); if (w2) w2.scrollLeft = x;
          window.scrollTo(0, y);
          if (id && fd) $(`[data-id="${id}"][data-field="${fd}"]`)?.focus({ preventScroll: true });
        }, 0);
        return;
      }
      if (route() === 'attend' && $('#atResults')) { bindAttend(); renderNav(); }
      else if (route() === 'schedule' && V.ui.sched.view === 'train' && $('#tpBox') && !drawerOpen()) { bindSched(); renderNav(); }
      else if (route() !== 'map' || !drawerOpen()) render(); else { refreshMap(false); renderNav(); }
      if (drawerOpen() && stack[stack.length - 1]?.type === 'detail') renderDrawer(true);
    });
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
      if (missing.length) throw new Error(`프로그램 일부(${missing.join(', ')})를 불러오지 못했습니다. index.html을 처음부터 끝까지 다시 붙여 넣고 새 버전으로 배포해 주세요.`);
      bindGlobal();
      render();
      // 현재 접속자: 바로 한 번, 그 뒤 1분마다·페이지를 옮길 때마다 알린다
      pingPresence(); setInterval(pingPresence, 60000);
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
