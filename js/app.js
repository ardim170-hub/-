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
    const moreActive = ['network', 'schedule', 'data'].includes(r);
    $('#bottomNav').innerHTML = MOBILE.map(([k, l, ic]) => `<a href="#/${k}" class="${r === k ? 'active' : ''}">${V.I[ic]}${l}</a>`).join('') +
      `<button type="button" class="${moreActive ? 'active' : ''}" data-act="more">${V.I.more}더보기</button>`;
    $('#sideFoot').innerHTML = `${U.esc(S.get().settings.orgName)}<br>데이터는 이 브라우저에 저장됩니다.`;
    $('#demoBanner').hidden = !S.get().isDemo;
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
    if (V.ui.map.mode === 'city') return;
    bigMap = M.create($('#bigMap'));
    refreshMap(true);
    $('#mapQ').addEventListener('input', U.debounce(ev => { V.ui.map.q = ev.target.value.trim(); refreshMap(false); }, 150));
  }
  function refreshMap(fit) {
    const items = V.mapItems();
    $('#mapList').innerHTML = V.mapList(items);
    if (!bigMap) return;
    if (markerGroup) markerGroup.remove();
    markerIndex = {};
    markerGroup = L.featureGroup();
    items.filter(i => M.hasPos(i.x)).forEach(({ kind, x }) => {
      const m = (kind === 'biz' ? M.bizMarker(x) : M.netMarker(x)).bindPopup(M.popupHtml(kind, x)).bindTooltip(x.name, { direction: 'top', offset: [0, -6] });
      m.addTo(markerGroup);
      markerIndex[kind + x.id] = m;
    });
    markerGroup.addTo(bigMap);
    if (fit && markerGroup.getLayers().length) bigMap.fitBounds(markerGroup.getBounds(), { padding: [30, 30], maxZoom: 14 });
  }
  function bindSched() {
    $('#evList').innerHTML = V.evList();
    $('#calBox').innerHTML = V.calendar();
  }
  function bindData() {
    $('#xlsxFile').onchange = async ev => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const { next, found } = S.parseXlsx(await file.arrayBuffer());
        if (!found.length) { toast('알맞은 시트를 찾지 못했습니다. 시트 이름이 사업체·네트워크·명함·활동기록·일정인지 확인하세요.', 'error'); return; }
        const ok = await confirmBox('엑셀 데이터로 교체할까요?', `${found.join(', ')} 시트에서 사업체 ${next.businesses.length}곳, 기관 ${next.networks.length}곳, 명함 ${next.cards.length}장, 활동 ${next.activities.length}건, 일정 ${next.events.length}건을 읽었습니다. 지금 데이터는 모두 교체됩니다.`, '교체');
        if (!ok) return;
        // 사진은 엑셀에 없으므로 같은 ID의 기존 사진을 유지
        const photos = Object.fromEntries(S.get().cards.filter(c => c.photo).map(c => [c.id, c.photo]));
        next.cards.forEach(c => { c.photo = photos[c.id] || null; });
        S.replace(next);
        toast('엑셀 데이터를 불러왔습니다.');
      } catch (err) { console.error(err); toast('엑셀 파일을 읽지 못했습니다. 내보내기 양식과 같은 형식인지 확인하세요.', 'error'); }
    };
    $('#jsonFile').onchange = async ev => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const next = JSON.parse(await file.text());
        if (!next.version || !Array.isArray(next.businesses)) throw new Error('형식 오류');
        if (!(await confirmBox('백업 파일로 복원할까요?', `사업체 ${next.businesses.length}곳, 명함 ${next.cards.length}장이 들어 있습니다. 지금 데이터는 모두 교체됩니다.`, '복원'))) return;
        S.replace(next);
        toast('백업에서 복원했습니다.');
      } catch { toast('백업 파일을 읽지 못했습니다. 이 프로그램에서 받은 JSON 파일인지 확인하세요.', 'error'); }
    };
  }

  /* ---------- Drawer ---------- */
  let stack = [];
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
    if (top.type === 'detail') {
      const x = S.find(top.kind, top.id);
      if (!x) { stack.pop(); return renderDrawer(); }
      v = { biz: V.detailBiz, net: V.detailNet, card: V.detailCard }[top.kind](x, stack.length > 1);
    } else {
      const x = top.id ? S.find(top.kind, top.id) : null;
      v = { biz: () => F.biz(x), net: () => F.net(x), card: () => F.card(x, top.preset), ev: () => F.event(x, top.preset) }[top.kind]();
    }
    inner.innerHTML = v.html;
    showDrawer();
    const form = inner.querySelector('#entityForm');
    if (v.after) v.after(form);
    const body = inner.querySelector('.dr-body');
    if (body && oldScroll) body.scrollTop = oldScroll;
    if (!keepScroll) (form ? form.querySelector('input:not([type=hidden]):not([type=file]), select') : inner.querySelector('.dr-title'))?.focus?.({ preventScroll: true });
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
    if (!id && kind === 'biz') S.upsert('act', { targetType: 'biz', targetId: saved.id, date: saved.discoveredAt || U.today(), type: '발굴', content: `${saved.source || '발굴'}로 사업체 등록`, staff: saved.staff });
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

  /* ---------- More sheet (mobile) ---------- */
  function closeMore() { document.querySelector('.more-sheet')?.remove(); }
  function toggleMore() {
    if (document.querySelector('.more-sheet')) return closeMore();
    const el = document.createElement('div');
    el.className = 'more-sheet';
    el.innerHTML = '<a href="#/network">네트워크</a><a href="#/schedule">일정</a><a href="#/data">데이터 관리</a>';
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
      S.upsert('act', { targetType: 'biz', targetId: b.id, date: U.today(), type: '기타', content: `진행 단계 변경: ${from} → ${to}`, staff: S.get().settings.staff[0] || '' });
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
    'biz-unfilter': el => { const k = el.dataset.k; const f = V.ui.biz; if (k === 'stage') f.stage = '전체'; else if (k === 'mandatory') f.mandatory = false; else f[k] = ''; render(); },
    'biz-reset': () => { Object.assign(V.ui.biz, { stage: '전체', q: '', area: '', industry: '', mandatory: false }); render(); },
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
    'cal-clear': () => { V.ui.sched.sel = ''; bindSched(); },
    'ev-showdone': el => { V.ui.sched.showDone = el.checked; bindSched(); },
    'xlsx-export': () => { S.exportXlsx(); toast('엑셀 파일을 내려받았습니다.'); },
    'xlsx-template': () => S.templateXlsx(),
    'xlsx-import': () => $('#xlsxFile').click(),
    'json-export': () => { S.exportJson(); toast('백업 파일을 내려받았습니다.'); },
    'json-import': () => $('#jsonFile').click(),
    'save-staff': () => {
      const list = $('#staffInput').value.split(',').map(s => s.trim()).filter(Boolean);
      if (!list.length) return toast('직원 이름을 한 명 이상 입력하세요.', 'error');
      S.get().settings.staff = list; S.commit(); toast('담당 직원 목록을 저장했습니다.');
    },
    'save-citymap': () => {
      const v = $('#cityMapInput').value.trim();
      if (v && !/^https?:\/\//.test(v)) return toast('http:// 또는 https:// 로 시작하는 주소를 입력하세요.', 'error');
      S.get().settings.cityMapUrl = v; S.commit(); toast('화성시 대시보드 주소를 저장했습니다.');
    },
    'data-clear': async () => {
      if (!(await confirmBox('모든 데이터를 지울까요?', '사업체, 명함, 기관, 활동 기록, 일정이 모두 삭제됩니다. 되돌릴 수 없으니 먼저 엑셀이나 백업 파일로 저장해 두세요.', '모두 지우기'))) return;
      const next = D.empty();
      next.settings = { ...S.get().settings, staff: S.get().settings.staff };
      S.replace(next);
      toast('모든 데이터를 지웠습니다. 새로 등록을 시작하세요.');
    },
    'data-demo': async () => {
      if (!(await confirmBox('예시 데이터를 불러올까요?', '지금 데이터가 예시 데이터로 교체됩니다.', '불러오기'))) return;
      S.replace(D.demo());
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
    document.addEventListener('submit', ev => {
      const form = ev.target;
      ev.preventDefault();
      if (form.id === 'entityForm') return onSubmit(form);
      if (form.dataset.form === 'quick-log') {
        const fd = Object.fromEntries(new FormData(form).entries());
        if (!fd.content.trim()) { form.elements.content.focus(); return toast('기록할 내용을 입력하세요.', 'error'); }
        S.upsert('act', { targetType: form.dataset.kind, targetId: form.dataset.id, date: fd.date || U.today(), type: fd.type, content: fd.content.trim(), staff: fd.staff });
        toast('활동을 기록했습니다.');
      }
    });
    window.addEventListener('hashchange', () => { render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });
    S.subscribe(() => {
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
      view.innerHTML = `<div class="panel"><div class="empty"><strong>데이터를 불러오지 못했습니다</strong>브라우저 저장소에 접근할 수 없습니다. 시크릿 창이라면 일반 창에서 열어 주세요.<div><button class="btn" type="button" onclick="location.reload()">다시 시도</button></div></div></div>`;
      return;
    }
    bindGlobal();
    render();
  }

  return { start, toast, confirm: confirmBox, render };
})();

App.start();
