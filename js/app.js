/* 앱 셸: 라우팅, Drawer, 검색, 액션 처리 */
window.App = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view');
  const NAV = [
    ['dashboard', '대시보드', 'dash'],
    ['biz', '사업체 개발', 'biz', () => S.get().businesses.length],
    ['map', '지도', 'map'],
    ['cards', '명함 관리', 'card', () => S.get().cards.length],
    ['network', '네트워크', 'net', () => S.get().networks.length],
    ['schedule', '일정', 'cal', () => S.get().events.filter(x => !x.done && U.diffDays(U.today(), x.date) <= 7).length || ''],
    ['contacts', '연락이력', 'log'],
    ['perf', '실적', 'perf'],
    ['orders', '출장·특근', 'trip'],
    ['data', '데이터 관리', 'data'],
  ];
  const MOBILE = [['dashboard', '홈', 'dash'], ['biz', '사업체', 'biz'], ['map', '지도', 'map'], ['cards', '명함', 'card']];
  const route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard');

  /* ---------- Toast / Confirm ---------- */
  function toast(msg, type = '', opt = {}) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<span>${U.esc(msg)}</span>`;
    if (opt.undo) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = '되돌리기';
      b.onclick = () => { opt.undo(); el.remove(); toast('되돌렸습니다.'); };
      el.appendChild(b);
    }
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), opt.undo ? 6000 : type === 'error' ? 5000 : 2600);
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

  /* ---------- Nav ---------- */
  function renderNav() {
    const r = route();
    $('#sideNav').innerHTML = NAV.map(([k, l, ic, cnt]) => `<a href="#/${k}" class="${r === k ? 'active' : ''}" ${r === k ? 'aria-current="page"' : ''}>${V.I[ic]}<span>${l}</span>${cnt ? `<span class="count">${cnt()}</span>` : ''}</a>`).join('');
    const moreActive = ['network', 'schedule', 'contacts', 'perf', 'orders', 'data'].includes(r);
    $('#bottomNav').innerHTML = MOBILE.map(([k, l, ic]) => `<a href="#/${k}" class="${r === k ? 'active' : ''}">${V.I[ic]}${l}</a>`).join('') +
      `<button type="button" class="${moreActive ? 'active' : ''}" data-act="more">${V.I.more}더보기</button>`;
    $('#sideFoot').innerHTML = `${U.esc(S.get().settings.orgName)}<br>${S.REMOTE ? '팀 공유 모드 · 구글 시트에 저장' : '이 브라우저에만 저장됩니다.'}<br>사용자: <b>${U.esc(S.me())}</b><br><span class="num">버전 ${U.esc(window.APP_VERSION || '개발용')}</span>`;
    $('#demoBanner').hidden = !S.get().isDemo;
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
    closeMore();
    const pages = {
      dashboard: [V.dashboard],
      biz: [V.bizPage, bindBiz],
      map: [V.mapPage, bindMap],
      cards: [V.cardsPage, bindCards],
      network: [V.netPage, bindNet],
      schedule: [V.schedPage, bindSched],
      perf: [V.perfPage, bindPerf],
      contacts: [R.contactsPage, () => { $('#ctResults').innerHTML = R.contactsResults(); }],
      orders: [R.ordersPage, () => { $('#odResults').innerHTML = R.ordersResults(); }],
      data: [V.dataPage, bindData],
    };
    const [html, after] = pages[r] || pages.dashboard;
    try {
      view.innerHTML = html();
      after && after();
    } catch (err) {
      console.error(err);
      view.innerHTML = `<div class="panel"><div class="empty"><strong>화면을 그리는 중 문제가 생겼습니다</strong>${U.esc(err.message)}<div><button class="btn" type="button" onclick="location.reload()">다시 시도</button></div></div></div>`;
    }
    renderNav();
  }

  function bindList(inputId, target, fn, setter) {
    const box = $(target);
    const draw = () => { box.innerHTML = fn(); };
    draw();
    const q = $(inputId);
    if (q) q.addEventListener('input', U.debounce(() => { setter(q.value.trim()); draw(); }, 120));
    return draw;
  }
  function bindBiz() {
    const f = V.ui.biz;
    const draw = bindList('#bizQ', '#bizResults', V.bizResults, v => { f.q = v; });
    $('#bizArea').onchange = ev => { f.area = ev.target.value; draw(); };
    $('#bizInd').onchange = ev => { f.industry = ev.target.value; draw(); };
    $('#bizMand').onchange = ev => { f.mandatory = ev.target.checked; draw(); };
    $('#bizSort').onchange = ev => { f.sort = ev.target.value; draw(); };
    $('#bizPeriod').onchange = ev => { f.period = ev.target.value; $('#bizMonth').hidden = f.period !== 'month'; draw(); };
    $('#bizMonth').onchange = ev => { f.month = ev.target.value || U.today().slice(0, 7); draw(); };
  }
  function bindNet() {
    const draw = bindList('#netQ', '#netResults', V.netResults, v => { V.ui.net.q = v; });
    $('#netStatus').onchange = ev => { V.ui.net.status = ev.target.value; draw(); };
  }
  function bindCards() {
    const draw = bindList('#cardQ', '#cardResults', V.cardResults, v => { V.ui.cards.q = v; });
    $('#cardSort').onchange = ev => { V.ui.cards.sort = ev.target.value; draw(); };
  }
  function bindMap() {
    bigMap = null;
    if (V.ui.map.mode === 'city') return fitCity();
    bigMap = M.create($('#bigMap'), { showLayers: true });
    refreshMap(true);
    $('#mapQ').addEventListener('input', U.debounce(ev => { V.ui.map.q = ev.target.value.trim(); refreshMap(false); }, 150));
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
    const items = V.mapItems();
    $('#mapList').innerHTML = V.mapList(items);
    if (!bigMap) return;
    if (markerGroup) markerGroup.remove();
    markerIndex = {};
    markerGroup = L.featureGroup();
    const label = (kind, x) => kind === 'card' ? (x.org || x.name) : x.name;
    // 이 달 발굴은 맨 위에 그린다
    items.filter(i => M.hasPos(i.x)).sort((a, b) => (a.month ? 1 : 0) - (b.month ? 1 : 0)).forEach(({ kind, x, month }) => {
      const m = (kind === 'biz' ? M.bizMarker(x, month) : kind === 'net' ? M.netMarker(x) : M.cardMarker(x))
        .bindPopup(M.popupHtml(kind, x)).bindTooltip(label(kind, x), { direction: 'top', offset: [0, -6] });
      m.addTo(markerGroup);
      markerIndex[kind + x.id] = m;
    });
    markerGroup.addTo(bigMap);
    if (fit) {
      const gu = V.ui.map.gu;
      const gb = M.guBounds(gu || '');
      if (gb) bigMap.fitBounds(gb, { padding: [12, 12] });
      else if (markerGroup.getLayers().length) bigMap.fitBounds(markerGroup.getBounds(), { padding: [30, 30], maxZoom: 14 });
    }
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
      } catch (err) { console.error(err); toast('엑셀 파일을 읽지 못했습니다. 내보내기 양식과 같은 형식인지 확인하세요.', 'error'); }
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
    const oldScroll = keepScroll ? inner.querySelector('.dr-body')?.scrollTop : 0;
    let v;
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
        const key = n => U.norm(n).replace(/^\(주\)|주식회사|\(주\)/g, '');
        const have = new Set(S.get().businesses.map(b => key(b.name)));
        top.state = { text: box.value, rows, newCount: new Set(rows.filter(r => !have.has(key(r.name))).map(r => key(r.name))).size };
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
    showDrawer();
    const form = inner.querySelector('#entityForm');
    if (v.after) v.after(form);
    const body = inner.querySelector('.dr-body');
    if (body && oldScroll) body.scrollTop = oldScroll;
    const focusEl = form && form.dataset.focus ? form.querySelector(`[name="${form.dataset.focus}"]`) : null;
    if (focusEl) { focusEl.scrollIntoView({ block: 'center' }); focusEl.focus({ preventScroll: true }); }
    else if (!keepScroll) (form ? form.querySelector('input:not([type=hidden]):not([type=file]), select') : inner.querySelector('.dr-title'))?.focus?.({ preventScroll: true });
  }
  function push(entry, fromDrawer) {
    if (!fromDrawer) stack = [];
    stack.push(entry);
    renderDrawer();
  }
  const openDetail = (kind, id, fromDrawer) => (kind === 'ev' ? push({ type: 'form', kind: 'ev', id }, fromDrawer) : push({ type: 'detail', kind, id }, fromDrawer));

  function onSubmit(form) {
    const res = F.collect(form);
    if (!res) return;
    const { kind, obj } = res;
    const id = form.dataset.id;
    if (id) obj.id = id;
    const saved = S.upsert(kind, obj);
    if (!id && kind === 'biz') S.upsert('act', { targetType: 'biz', targetId: saved.id, date: saved.discoveredAt || U.today(), type: '발굴', content: `${saved.source || '발굴'}로 사업체 등록`, staff: saved.staff || S.me() });
    toast(id ? '저장했습니다.' : '등록했습니다.');
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
      catch (err) { console.error(err); toast('파일에서 표를 읽지 못했습니다. 첫 줄(또는 제목 아래 줄)에 사업체명·주소 같은 열 이름이 있는지 확인하세요.', 'error'); }
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
    const k = U.norm(org).replace(/^\(주\)|주식회사|\(주\)/g, '');
    if (k.length < 2) return null;
    const hit = (list, kind) => { const x = list.find(o => { const n = U.norm(o.name).replace(/^\(주\)|주식회사|\(주\)/g, ''); return n && (n === k || n.includes(k) || k.includes(n)); }); return x ? { kind, x } : null; };
    return hit(S.get().businesses, 'biz') || hit(S.get().networks, 'net');
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
    el.innerHTML = '<a href="#/network">네트워크</a><a href="#/schedule">일정</a><a href="#/contacts">연락이력</a><a href="#/perf">실적</a><a href="#/orders">출장·특근 명령부</a><a href="#/data">데이터 관리</a>';
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
    'new-biz': (el, fd) => push({ type: 'form', kind: 'biz' }, fd),
    'new-net': (el, fd) => push({ type: 'form', kind: 'net' }, fd),
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
      push({ type: 'form', kind: 'ev', preset: { ...(lt ? { targetType: lt, targetId: li } : {}), ...(el.dataset.date ? { date: el.dataset.date } : {}) } }, fd);
    },
    edit: (el) => push({ type: 'form', kind: el.dataset.kind, id: el.dataset.id }, true),
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
    'biz-unfilter': el => { const k = el.dataset.k; const f = V.ui.biz; if (k === 'stage') f.stage = '전체'; else if (k === 'mandatory') f.mandatory = false; else if (k === 'period') f.period = 'all'; else f[k] = ''; render(); },
    'biz-reset': () => { Object.assign(V.ui.biz, { stage: '전체', q: '', area: '', industry: '', mandatory: false, period: 'all' }); render(); },
    'biz-upload': () => $('#globalBizFile').click(),
    'card-photo': () => $('#globalCardPhoto').click(),
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
    triage: (el, fd) => {
      const c = S.find('card', el.dataset.id);
      if (!c) return;
      const to = el.dataset.to;
      if (to === 'personal') { S.upsert('card', { id: c.id, tags: [...new Set([...(c.tags || []), '개인'])] }); toast('개인 연락처로 두었습니다. 분류 대기 목록에서 빠집니다.'); return; }
      const name = c.org || c.name;
      const base = { name, address: c.address || '', area: c.area || '', lat: c.lat ?? null, lng: c.lng ?? null, approx: !!c.approx, staff: S.me() };
      const rec = to === 'biz'
        ? S.upsert('biz', { ...base, stage: '발굴', discoveredAt: U.today(), source: '명함', phone: c.phone || '', placements: 0 })
        : S.upsert('net', { ...base, category: D.guessCategory(name), status: '보통', since: c.metAt || U.today(), relation: '', promo: '' });
      if (to === 'biz') S.upsert('act', { targetType: 'biz', targetId: rec.id, date: U.today(), type: '발굴', content: `명함(${c.name})으로 사업체 등록`, staff: S.me() });
      S.upsert('card', { id: c.id, linkType: to, linkId: rec.id });
      bigMap?.closePopup();
      toast(`'${name}'을(를) ${to === 'biz' ? '사업체 개발' : '네트워크'}에 등록하고 명함을 연결했습니다.`);
      openDetail(to, rec.id, fd);
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
    'map-stage': el => { const s = V.ui.map.stages; const k = el.dataset.stage; if (el.checked) s.add(k); else s.delete(k); refreshMap(false); },
    'map-mode': el => { V.ui.map.mode = el.dataset.mode; render(); },
    'map-net-only': () => { Object.assign(V.ui.map, { biz: false, net: true, mode: 'ours' }); },
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
    'od-print': el => printHtml(R.orderDoc(el.dataset.staff)),
    'od-hwp': () => $('#hwpFile').click(),
    'od-hwp-commit': () => { const top = stack[stack.length - 1]; if (!top || top.type !== 'hwp') return; const n = R.commitHwp(top.state.rows); closeDrawer(); toast(`명령부 ${n}줄을 가져왔습니다.`); render(); },
    'od-print-each': () => printHtml(R.orderDocsEach()),
    'od-file': el => { const { name, blob } = R.orderFile(el.dataset.staff); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast(`${name} 파일을 받았습니다. 한글 또는 워드로 열 수 있습니다.`); },
    'od-month': el => { const f = R.ui.orders; const [y, m] = f.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); f.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; render(); },
    'od-kind': el => { R.ui.orders.kind = el.dataset.kind; render(); },
    'od-import': () => { const n = R.importVisits(); toast(`방문 기록 ${n}건을 관내출장 명령부로 불러왔습니다. 출장시간·출장복명을 채워 주세요.`); },
    'od-add': () => { const f = R.ui.orders; const d = f.month === U.today().slice(0, 7) ? U.today() : f.month + '-01'; S.upsert('trip', { kind: f.kind, date: d, staff: S.me(), place: '', purpose: f.kind === '특근' ? '사업체 개발' : '사업체개발', method: f.kind === '출장' ? '복지관 차량' : '', time: '', report: [], dept: f.kind === '특근' ? '직업' : '', note: '' }); },
    'od-dup': el => { const t = S.find('trip', el.dataset.id); if (!t) return; const other = S.staff().map(s => s.name).find(n => n !== t.staff) || t.staff; S.upsert('trip', { ...t, id: undefined, staff: other, actId: '' }); toast(`${other} 동행 줄을 추가했습니다. 성명을 확인하세요.`); },
    'od-del': el => { const undo = S.remove('trip', el.dataset.id); if (undo) toast('한 줄을 삭제했습니다.', '', { undo }); },
    'od-copy': async () => { const ok = await copyText(R.ordersTsv()); toast(ok ? '복사했습니다. 한글 명령부 표에서 첫 칸을 블록 지정한 뒤 붙여넣으세요.' : '복사하지 못했습니다.', ok ? '' : 'error'); },
    'ct-month': el => { const f = R.ui.contacts; const [y, m] = f.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.d, 1); f.month = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; render(); },
    'ct-tab': el => { R.ui.contacts.tab = el.dataset.tab; render(); },
    'ct-copy': async () => { const ok = await copyText(R.contactTsv()); toast(ok ? '복사했습니다. 공유 시트 연락이력 탭의 날짜 칸을 누르고 Ctrl+V 하세요.' : '복사하지 못했습니다.', ok ? '' : 'error'); },
    'ct-copy-report': async () => { const ok = await copyText(R.reportTsv()); toast(ok ? '복사했습니다. 보고용 시트 방문 사업체 표의 날짜 칸을 누르고 Ctrl+V 하세요.' : '복사하지 못했습니다.', ok ? '' : 'error'); },
    'ct-paste': () => push({ type: 'paste', state: { text: '', rows: [] } }, false),
    'ct-paste-commit': () => { const top = stack[stack.length - 1]; if (!top || top.type !== 'paste') return; const n = R.commitPaste(top.state.rows); closeDrawer(); toast(`연락이력 ${n}줄을 가져왔습니다.`); },
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
    'staff-add': () => { $('#staffRows').insertAdjacentHTML('beforeend', V.staffRow()); $('#staffRows .staff-row:last-child input').focus(); },
    'staff-del': el => el.closest('.staff-row').remove(),
    'scope-set': el => { S.setScope(el.dataset.scope); toast(`${S.scopeLabel()} 기준으로 봅니다.`); },
    'save-access': async () => {
      const clean = v => [...new Set(v.toLowerCase().split(/[\s,;]+/).filter(x => x.includes('@')))];
      const admins = clean($('#accAdmins').value), members = clean($('#accMembers').value);
      const me = S.accessInfo().me;
      if (members.length && me && !members.includes(me) && !admins.includes(me) && me !== S.accessInfo().owner) members.push(me);
      await S.saveSettings({ admins: admins.join(','), members: members.join(',') });
      toast(members.length ? `사용할 수 있는 사람 ${members.length}명을 저장했습니다.` : '사용 권한을 저장했습니다. 명단이 비어 있어 들어올 수 있는 사람 모두 씁니다.');
    },
    'save-vworld': async () => { await S.saveSettings({ vworldKey: $('#vworldKeyInput').value.trim() }); toast('브이월드 키를 저장했습니다. 지도 오른쪽 위 배경 목록에 브이월드가 나타납니다.'); },
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
      if (el.tagName === 'A' && act !== 'map-net-only') ev.preventDefault();
      if (el.closest('.menu')) $('#quickMenu').hidden = true;
      A[act](el, !!el.closest('#drawer'));
    });
    document.addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); openSearch(); return; }
      if (ev.key === 'Escape') {
        if (!$('#confirmLayer').hidden) return $('#confirmCancel').click();
        if (!$('#searchLayer').hidden) return closeSearch();
        if (drawerOpen()) return (stack.length > 1 ? A['dr-back']() : closeDrawer());
      }
      if (ev.key === 'Enter' && ev.target.matches('[data-act][tabindex]')) ev.target.click();
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
      const el = ev.target.closest('[data-chg]');
      if (!el) return;
      const { id, field } = el.dataset;
      inlineEdit = true;
      if (el.dataset.chg === 'act-field') S.upsert('act', { id, [field]: el.value });
      else if (el.dataset.chg === 'trip-field') S.upsert('trip', { id, [field]: el.value });
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
      if (form.id === 'entityForm') return onSubmit(form);
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
        const b = R.addContact(fd);
        toast(`${b.name} 연락을 기록했습니다.`);
        setTimeout(() => { const f = document.querySelector('[data-form="ct-add"]'); if (f) { f.elements.name.focus(); } }, 50);
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
      if (inlineEdit) { inlineEdit = false; if (route() === 'contacts') $('#ctResults').innerHTML = R.contactsResults(); return; }
      if (route() !== 'map' || !drawerOpen()) render(); else { refreshMap(false); renderNav(); }
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
    } catch (err) {
      console.error(err);
      view.innerHTML = `<div class="panel"><div class="empty"><strong>화면을 열지 못했습니다</strong>${window.U ? U.esc(err.message || String(err)) : String(err.message || err)}<div><button class="btn" type="button" onclick="location.reload()">다시 시도</button></div></div></div>`;
    }
  }

  return { start, toast, confirm: confirmBox, render };
})();

App.start();
