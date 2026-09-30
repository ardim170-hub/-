/* 데이터 저장소: 모든 화면은 이 한 곳의 데이터에서 계산한다.
   - 파일로 열면(로컬 모드): 이 브라우저의 IndexedDB에 저장
   - 구글 Apps Script 웹 앱으로 열면(공유 모드): 구글 시트에 저장하고 팀원과 함께 본다 */
window.S = (() => {
  const DB_NAME = 'ardim-jobs-crm';
  const KEY = 'state';
  const REMOTE = !!(window.google && google.script && google.script.run);
  let state = null;
  const listeners = new Set();

  /* ---------- 시트/엑셀 열 정의 (공유 모드의 구글 시트와 엑셀 내보내기가 같은 양식을 쓴다) ---------- */
  const SHEETS = {
    businesses: ['사업체', [['id', '사업체ID'], ['name', '사업체명'], ['industry', '업종'], ['stage', '진행 단계'], ['bizNo', '사업자등록번호'], ['ceo', '대표자'], ['phone', '대표 전화'], ['homepage', '홈페이지'], ['employees', '상시근로자 수'], ['address', '주소'], ['area', '읍면동'], ['lat', '위도'], ['lng', '경도'], ['approx', '대략 위치(Y)'], ['jobs', '가능 직무'], ['workConditions', '근무 조건'], ['accessibility', '편의시설·고려사항'], ['placements', '채용 연계 인원'], ['source', '발굴 경로'], ['discoveredAt', '발굴일'], ['staff', '담당 직원'], ['memo', '메모'], ['research', '기초 조사'], ['researchAt', '조사일'], ['aiSummary', '요약'], ['survey', '사업체정보지(JSON)'], ['jobAnalyses', '직무분석지(JSON)'], ['welfare', '복리후생(기타)'], ['progress', '실적 진행도'], ['support', '진행 사업(지원고용·현장훈련)'], ['createdAt', '등록일'], ['updatedAt', '수정일']]],
    networks: ['네트워크', [['id', '기관ID'], ['name', '기관명'], ['category', '분류'], ['status', '관계 상태'], ['address', '주소'], ['area', '읍면동'], ['lat', '위도'], ['lng', '경도'], ['approx', '대략 위치(Y)'], ['relation', '협력 내용'], ['promo', '홍보 방식'], ['since', '협력 시작일'], ['staff', '담당 직원'], ['memo', '메모'], ['createdAt', '등록일'], ['updatedAt', '수정일']]],
    cards: ['명함', [['id', '명함ID'], ['name', '이름'], ['org', '소속'], ['dept', '부서'], ['title', '직함'], ['mobile', '휴대전화'], ['phone', '사무실 전화'], ['email', '이메일'], ['address', '주소'], ['area', '읍면동'], ['lat', '위도'], ['lng', '경도'], ['linkType', '연결 구분(biz/net)'], ['linkId', '연결ID'], ['tags', '태그'], ['metAt', '받은 날'], ['metWhere', '받은 곳'], ['memo', '메모'], ['photo', '사진(Y)'], ['createdAt', '등록일'], ['updatedAt', '수정일']]],
    activities: ['활동기록', [['id', '활동ID'], ['targetType', '대상 구분(biz/net)'], ['targetId', '대상ID'], ['date', '날짜'], ['type', '유형'], ['content', '내용'], ['staff', '담당 직원'], ['perf', '실적 세부사업(비우면 자동)'], ['people', '참여인원'], ['contactName', '담당자'], ['jobType', '직종'], ['result', '연락결과'], ['status', '상태'], ['training', '현장훈련 유/무'], ['procedure', '절차'], ['jobUrl', '구인공고 주소']]],
    events: ['일정', [['id', '일정ID'], ['date', '날짜'], ['time', '시간'], ['type', '유형'], ['title', '제목'], ['targetType', '대상 구분(biz/net)'], ['targetId', '대상ID'], ['done', '완료(Y/N)'], ['memo', '메모']]],
  };
  SHEETS.perfs = ['실적입력', [['id', '실적ID'], ['date', '사업날짜'], ['set', '사업'], ['item', '세부사업명'], ['people', '참여인원'], ['newPeople', '참여인원(신규)'], ['round', '회차'], ['note', '비고'], ['staff', '입력한 직원']]];
  SHEETS.trips = ['출장특근', [['id', '명령ID'], ['kind', '구분(출장/특근)'], ['date', '일자'], ['staff', '성명'], ['place', '출장지'], ['purpose', '용무·업무내용'], ['method', '방법'], ['time', '시간'], ['report', '출장복명'], ['dept', '부서명'], ['note', '비고'], ['actId', '활동ID'], ['zone', '관내·관외'], ['km', '왕복거리(km)'], ['fuelPrice', '유가(원/L)'], ['fuelEff', '연비(km/L)'], ['toll', '통행료'], ['parking', '주차료'], ['fare', '운임'], ['lodging', '숙박비'], ['lodgeRegion', '숙박지역'], ['lodgeNights', '숙박일수'], ['meal', '식비']]];
  const STAFF_SHEET = ['직원', [['name', '이름'], ['program', '소속 사업']]];
  const DATE_KEYS = new Set(['discoveredAt', 'since', 'metAt', 'date', 'createdAt', 'updatedAt', 'researchAt']);
  const NUM_KEYS = new Set(['employees', 'placements', 'lat', 'lng', 'people', 'newPeople']);
  const JSON_KEYS = new Set(['survey', 'jobAnalyses']);
  const COLS = Object.keys(SHEETS);

  function toRow(col, x) {
    return Object.fromEntries(SHEETS[col][1].map(([k, h]) => {
      let v = x[k];
      if (k === 'tags' || k === 'report' || k === 'support') v = (v || []).join(', ');
      else if (k === 'done' || k === 'approx') v = v ? 'Y' : (k === 'done' ? 'N' : '');
      else if (k === 'photo') v = v ? 'Y' : '';
      else if (JSON_KEYS.has(k)) v = v && (Array.isArray(v) ? v.length : Object.keys(v).length) ? JSON.stringify(v) : '';
      return [h, v ?? ''];
    }));
  }
  function fromRow(col, r) {
    const o = {};
    for (const [k, h] of SHEETS[col][1]) {
      let v = r[h];
      if (v === undefined) continue;
      if (DATE_KEYS.has(k)) v = U.toDateStr(v);
      else if (NUM_KEYS.has(k)) v = v === '' || v == null ? (k === 'lat' || k === 'lng' ? null : 0) : Number(v);
      else if (k === 'tags' || k === 'report' || k === 'support') v = String(v || '').split(',').map(t => t.trim()).filter(Boolean);
      else if (k === 'done' || k === 'approx') v = /^(y|yes|o|완료|true|1)$/i.test(String(v).trim());
      else if (k === 'photo') v = /^y$/i.test(String(v).trim()) ? 'Y' : null;
      else if (JSON_KEYS.has(k)) { try { v = v ? JSON.parse(v) : (k === 'jobAnalyses' ? [] : null); } catch { v = k === 'jobAnalyses' ? [] : null; } }
      else v = v == null ? '' : String(v).trim();
      o[k] = v;
    }
    if (!o.id) o.id = U.uid(col[0].toUpperCase());
    return o;
  }
  const keepRow = (col, o) => (col === 'activities' ? o.content || o.type : col === 'events' ? o.title || o.date : col === 'perfs' ? o.item : col === 'trips' ? o.date : o.name);
  function normalize(next) {
    for (const k of COLS) next[k] ||= [];
    next.settings ||= {};
    next.settings.orgName ||= '화성시아르딤복지관 직업지원팀';
    if (next.settings.cityMapUrl == null) next.settings.cityMapUrl = D.CITY_DASHBOARD_URL;
    next.settings.staff = (next.settings.staff || []).map(s => (typeof s === 'string' ? { name: s, program: '' } : { name: String(s.name || '').trim(), program: s.program || '' })).filter(s => s.name);
    if (!next.settings.staff.length) next.settings.staff = [{ name: '김정배', program: '' }];
    if (typeof next.settings.links === 'string') { try { next.settings.links = JSON.parse(next.settings.links); } catch { next.settings.links = null; } }
    if (!Array.isArray(next.settings.links)) next.settings.links = D.DEFAULT_LINKS.map(l => ({ ...l }));
    if (typeof next.settings.perfByProgram === 'string') { try { next.settings.perfByProgram = JSON.parse(next.settings.perfByProgram); } catch { next.settings.perfByProgram = null; } }
    next.settings.perfByProgram = { ...D.DEFAULT_PERF_BY_PROGRAM, ...(next.settings.perfByProgram || {}) };
    next.cards.forEach(c => place(c));
    next.businesses.forEach(b => { if (!D.STAGE[b.stage]) b.stage = '발굴'; place(b); });
    next.networks.forEach(n => { if (!D.NET_STATUS.includes(n.status)) n.status = '보통'; place(n); });
    return next;
  }

  /** 좌표가 없으면 주소에서 읍·면·동을 찾아 그 중심에 대략 표시 */
  function place(x) {
    const has = x.lat != null && x.lng != null && x.lat !== '' && !isNaN(x.lat) && !isNaN(x.lng);
    if (!x.area && has) x.area = D.areaAt(+x.lat, +x.lng);
    if (!x.area && x.address) x.area = D.detectArea(x.address);
    if (!has && D.AREA_BY_NAME[x.area]) { x.lat = D.AREA_BY_NAME[x.area].lat; x.lng = D.AREA_BY_NAME[x.area].lng; x.approx = true; }
    return x;
  }

  /* ---------- 로컬 저장 (IndexedDB) ---------- */
  function openDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function readRaw() {
    try {
      const db = await openDb();
      return await new Promise((res, rej) => {
        const q = db.transaction('kv').objectStore('kv').get(KEY);
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => rej(q.error);
      });
    } catch (e) {
      try { return JSON.parse(localStorage.getItem(DB_NAME) || 'null'); } catch { return null; }
    }
  }
  async function writeRaw(v) {
    try {
      const db = await openDb();
      await new Promise((res, rej) => {
        const t = db.transaction('kv', 'readwrite');
        t.objectStore('kv').put(v, KEY);
        t.oncomplete = res; t.onerror = () => rej(t.error);
      });
    } catch (e) {
      localStorage.setItem(DB_NAME, JSON.stringify(v));
    }
  }
  let saveTimer = null;
  function persistLocal() {
    if (REMOTE) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { await writeRaw(state); }
      catch (e) { App.toast('저장하지 못했습니다. 저장 공간이 부족할 수 있어요. 명함 사진을 줄이거나 엑셀로 백업하세요.', 'error'); }
    }, 150);
  }

  /* ---------- 공유 모드 (구글 Apps Script) ---------- */
  const sync = { status: REMOTE ? 'loading' : 'local', at: null, error: null };
  const syncListeners = new Set();
  const setSync = (status, error = null) => { sync.status = status; sync.error = error; if (status === 'saved') sync.at = new Date(); syncListeners.forEach(fn => fn(sync)); };
  const call = (fn, ...args) => new Promise((res, rej) => google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn](...args));
  let pending = 0;
  function send(fn, ...args) {
    if (!REMOTE) return Promise.resolve();
    pending++;
    setSync('saving');
    return call(fn, ...args)
      .then(r => { if (--pending === 0) setSync('saved'); return r; })
      .catch(err => {
        pending--;
        setSync('error', err);
        App.toast('구글 시트에 저장하지 못했습니다. 인터넷 연결을 확인하고 새로고침하세요. (' + (err && err.message || err) + ')', 'error');
        throw err;
      });
  }
  const opPut = (col, x) => ({ sheet: SHEETS[col][0], op: 'put', id: x.id, row: toRow(col, x) });
  const opDel = (col, id) => ({ sheet: SHEETS[col][0], op: 'del', id });
  const schema = () => Object.fromEntries([...COLS.map(c => [SHEETS[c][0], SHEETS[c][1].map(x => x[1])]), [STAFF_SHEET[0], STAFF_SHEET[1].map(x => x[1])]]);

  function fromServer(res) {
    const next = { version: 1 };
    for (const col of COLS) next[col] = (res.sheets[SHEETS[col][0]] || []).map(r => fromRow(col, r)).filter(o => keepRow(col, o));
    const st = res.settings || {};
    next.settings = {
      orgName: st.orgName || '', cityMapUrl: st.cityMapUrl ?? null, links: st.links || null, vworldKey: st.vworldKey || '', vworldDomain: st.vworldDomain || '', perfByProgram: st.perfByProgram || null,
      admins: st.admins || '', members: st.members || '', perms: st.perms || '',
      staff: (res.sheets[STAFF_SHEET[0]] || []).map(r => ({ name: r['이름'], program: r['소속 사업'] || '' })),
    };
    next.isDemo = st.isDemo === 'Y';
    aiServer = !!res.ai;
    if (res.access) access = { me: res.access.me || '', owner: res.access.owner || '', admin: !!res.access.admin, perms: res.access.perms || {} };
    return normalize(next);
  }
  function serverPayload(s) {
    const sheets = {};
    for (const col of COLS) sheets[SHEETS[col][0]] = s[col].map(x => toRow(col, x));
    sheets[STAFF_SHEET[0]] = s.settings.staff.map(x => ({ '이름': x.name, '소속 사업': x.program || '' }));
    return { sheets, settings: { orgName: s.settings.orgName, cityMapUrl: s.settings.cityMapUrl || '', links: JSON.stringify(s.settings.links || []), vworldKey: s.settings.vworldKey || '', vworldDomain: s.settings.vworldDomain || '', fuelEff: s.settings.fuelEff || '', fuelPrice: s.settings.fuelPrice || '', perfGoal: typeof s.settings.perfGoal === 'string' ? s.settings.perfGoal : s.settings.perfGoal ? JSON.stringify(s.settings.perfGoal) : '', perfByProgram: JSON.stringify(s.settings.perfByProgram || {}), isDemo: s.isDemo ? 'Y' : '', ...(access.admin ? { admins: s.settings.admins || '', members: s.settings.members || '', perms: s.settings.perms || '' } : {}) } };
  }
  /** 팀 공유 모드의 사용 권한. 파일 버전은 늘 관리자 */
  let access = { me: '', owner: '', admin: true, perms: {} };
  const isAdmin = () => !REMOTE || access.admin;
  /** 이 사람의 메뉴 권한 (0 숨김 · 1 보기만 · 2 등록·수정 · 3 삭제까지). 파일 버전·관리자·정하지 않은 메뉴는 3 */
  const level = menu => (isAdmin() ? 3 : D.PERM_RANK[(access.perms || {})[menu]] ?? 3);
  const can = (menu, need) => level(menu) >= need;
  const accessInfo = () => ({ ...access });

  let lastSig = '';
  let aiServer = false;
  async function refresh() {
    if (!REMOTE || pending) return;
    try {
      const res = await call('api_load', schema());
      if (pending) return; // 불러오는 사이 저장이 시작되면 다음 기회에
      const before = JSON.stringify(access);
      const next = fromServer(res);
      const sig = JSON.stringify(next);
      if (before !== JSON.stringify(access)) lastSig = ''; // 내 권한이 바뀌면 화면을 다시 그린다
      if (sig !== lastSig) { lastSig = sig; state = next; notify(); }
      setSync('saved');
    } catch (err) { setSync('error', err); }
  }

  /* ---------- 초기화 ---------- */
  async function init() {
    if (REMOTE) {
      const res = await call('api_load', schema());
      state = fromServer(res);
      lastSig = JSON.stringify(state);
      setSync('saved');
      setInterval(refresh, 60000);
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
      return state;
    }
    const raw = await readRaw();
    state = normalize(raw && raw.version ? raw : D.demo());
    if (!raw) persistLocal();
    return state;
  }

  const get = () => state;
  function notify() { listeners.forEach(fn => fn()); }
  function commit() { persistLocal(); if (REMOTE) lastSig = JSON.stringify(state); notify(); }
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  async function replace(next) {
    next = normalize(next);
    if (REMOTE) {
      // 사진은 시트 밖에서 따로 올린다
      const photos = next.cards.filter(c => typeof c.photo === 'string' && c.photo.startsWith('data:'));
      photos.forEach(c => { photoCache.set(c.id, c.photo); c.photo = 'Y'; });
      await send('api_replaceAll', serverPayload(next));
      for (const c of photos) await send('api_putPhoto', c.id, photoCache.get(c.id));
    }
    state = next; commit();
  }
  async function saveSettings(patch) {
    Object.assign(state.settings, patch);
    normalize(state);
    commit();
    if (REMOTE) await send('api_saveSettings', serverPayload(state).settings, serverPayload(state).sheets[STAFF_SHEET[0]]);
  }

  /* ---------- CRUD ---------- */
  const COL = { biz: 'businesses', net: 'networks', card: 'cards', act: 'activities', ev: 'events', perf: 'perfs', trip: 'trips' };
  const PREFIX = { biz: 'B', net: 'N', card: 'C', act: 'A', ev: 'E', perf: 'P', trip: 'T' };
  const find = (kind, id) => state[COL[kind]].find(x => x.id === id);
  const photoCache = new Map();

  function upsert(kind, obj) {
    const col = COL[kind];
    const list = state[col];
    if (!obj.id) obj.id = U.uid(PREFIX[kind]);
    Object.keys(obj).forEach(k => obj[k] === undefined && delete obj[k]);
    const i = list.findIndex(x => x.id === obj.id);
    const before = i >= 0 ? list[i] : null;
    if (!['act', 'ev', 'perf', 'trip'].includes(kind)) { obj.updatedAt = U.today(); if (!before) obj.createdAt = U.today(); }
    let photoOp = null;
    if (REMOTE && kind === 'card' && 'photo' in obj) {
      if (typeof obj.photo === 'string' && obj.photo.startsWith('data:')) { photoCache.set(obj.id, obj.photo); photoOp = ['api_putPhoto', obj.id, obj.photo]; obj.photo = 'Y'; }
      else if (!obj.photo && before && before.photo) { photoCache.delete(obj.id); photoOp = ['api_delPhoto', obj.id]; obj.photo = null; }
    }
    const rec = before ? { ...before, ...obj } : obj;
    if (kind === 'biz' || kind === 'net' || kind === 'card') place(rec);
    if (i >= 0) list[i] = rec; else list.push(rec);
    commit();
    if ((kind === 'biz' || kind === 'net' || kind === 'card') && rec.address && (rec.approx || rec.lat == null) && (!before || before.address !== rec.address || before.lat == null)) refine(kind, rec.id);
    if (REMOTE) {
      send('api_apply', [opPut(col, rec)]).catch(() => {});
      if (photoOp) send(...photoOp).catch(() => {});
    }
    return rec;
  }

  /** 주소로 정확한 좌표를 찾아 대략 위치를 바꾼다 (인터넷 필요, 실패하면 그대로 둔다) */
  const refining = new Map(); // 같은 곳을 동시에 두 번 찾지 않게
  function refine(kind, id) {
    const k = kind + id;
    if (!refining.has(k)) refining.set(k, refineOnce(kind, id).finally(() => refining.delete(k)));
    return refining.get(k);
  }
  async function refineOnce(kind, id) {
    if (!window.M || !M.geocode) return;
    const x = find(kind, id);
    if (!x || !x.address) return;
    try {
      const r = await M.geocode(x.address);
      if (!r || r.lat < 36.9 || r.lat > 37.4 || r.lng < 126.5 || r.lng > 127.25) return false; // 화성시 밖이면 무시
      const cur = find(kind, id);
      if (cur && (cur.approx || cur.lat == null)) upsert(kind, { id, lat: r.lat, lng: r.lng, approx: !!r.approx, area: D.areaAt(r.lat, r.lng) || cur.area || '' });
      return true;
    } catch { return false; /* 오프라인 등 */ }
  }

  /** 여러 건을 한 번에 추가 (파일로 일괄 등록) */
  function upsertMany(kind, objs) {
    const col = COL[kind];
    const recs = objs.map(o => {
      const rec = { ...o, id: o.id || U.uid(PREFIX[kind]) };
      if (kind !== 'act' && kind !== 'ev') { rec.createdAt = rec.createdAt || U.today(); rec.updatedAt = U.today(); }
      if (kind === 'biz' || kind === 'net' || kind === 'card') place(rec);
      state[col].push(rec);
      return rec;
    });
    commit();
    if (REMOTE && recs.length) send('api_apply', recs.map(r => opPut(col, r))).catch(() => {});
    return recs;
  }

  function remove(kind, id) {
    const col = COL[kind];
    const list = state[col];
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return null;
    const [gone] = list.splice(i, 1);
    const removed = { acts: [], evs: [], cards: [] };
    if (kind === 'biz' || kind === 'net') {
      removed.acts = state.activities.filter(a => a.targetType === kind && a.targetId === id);
      removed.evs = state.events.filter(e => e.targetType === kind && e.targetId === id);
      state.activities = state.activities.filter(a => !(a.targetType === kind && a.targetId === id));
      state.events = state.events.filter(e => !(e.targetType === kind && e.targetId === id));
      state.cards.forEach(c => { if (c.linkType === kind && c.linkId === id) { removed.cards.push(c); c.linkType = ''; c.linkId = ''; } });
    }
    commit();
    if (REMOTE) {
      send('api_apply', [opDel(col, id), ...removed.acts.map(a => opDel('activities', a.id)), ...removed.evs.map(e => opDel('events', e.id)), ...removed.cards.map(c => opPut('cards', c))]).catch(() => {});
      if (kind === 'card' && gone.photo) send('api_delPhoto', id).catch(() => {}); // 되돌리기 시 사진은 복구되지 않음
    }
    return () => { // 되돌리기
      list.splice(Math.min(i, list.length), 0, gone);
      state.activities.push(...removed.acts);
      state.events.push(...removed.evs);
      removed.cards.forEach(c => { c.linkType = kind; c.linkId = id; });
      if (kind === 'card' && REMOTE && gone.photo) gone.photo = photoCache.has(id) ? gone.photo : null;
      commit();
      if (REMOTE) {
        send('api_apply', [opPut(col, gone), ...removed.acts.map(a => opPut('activities', a)), ...removed.evs.map(e => opPut('events', e)), ...removed.cards.map(c => opPut('cards', c))]).catch(() => {});
        if (kind === 'card' && photoCache.has(id)) send('api_putPhoto', id, photoCache.get(id)).catch(() => {});
      }
    };
  }

  /* ---------- 중복 찾기 · 합치기 ---------- */
  const orgKey = U.orgKey;
  const digits = s => String(s || '').replace(/\D/g, '');
  /** 같은 곳·같은 사람으로 볼 열쇠들. 열쇠 하나라도 같으면 중복 의심 */
  function dupKeys(kind, x) {
    const k = [];
    if (kind === 'card') {
      if (digits(x.mobile).length >= 10) k.push(['m' + digits(x.mobile), '휴대전화 같음']);
      if (x.email && x.email.includes('@')) k.push(['e' + x.email.trim().toLowerCase(), '이메일 같음']);
      if (U.norm(x.name) && orgKey(x.org)) k.push(['o' + U.norm(x.name) + '|' + orgKey(x.org), '이름·소속 같음']);
    } else {
      if (orgKey(x.name).length >= 2) k.push(['n' + orgKey(x.name), '이름 같음']);
      if (kind === 'biz' && digits(x.bizNo).length === 10) k.push(['b' + digits(x.bizNo), '사업자번호 같음']);
      if (digits(x.phone).length >= 9) k.push(['p' + digits(x.phone), '대표 전화 같음']);
    }
    return k;
  }
  /** kind 전체에서 중복 의심 묶음: id → [{ x, why }] */
  function dupIndex(kind) {
    const list = state[COL[kind]];
    const bucket = new Map();
    list.forEach(x => dupKeys(kind, x).forEach(([key, why]) => { if (!bucket.has(key)) bucket.set(key, []); bucket.get(key).push([x, why]); }));
    const out = new Map();
    bucket.forEach(group => {
      if (group.length < 2) return;
      group.forEach(([x]) => group.forEach(([y, why]) => {
        if (x.id === y.id) return;
        const arr = out.get(x.id) || out.set(x.id, []).get(x.id);
        const hit = arr.find(d => d.x.id === y.id);
        if (hit) { if (!hit.why.includes(why)) hit.why.push(why); } else arr.push({ x: y, why: [why] });
      }));
    });
    return out;
  }
  /** 새로 등록하려는 것과 겹치는 기존 항목 */
  function dupesOf(kind, obj) {
    const keys = new Map(dupKeys(kind, obj));
    const out = [];
    state[COL[kind]].forEach(y => {
      if (y.id === obj.id) return;
      const why = dupKeys(kind, y).filter(([k]) => keys.has(k)).map(([, w]) => w);
      if (why.length) out.push({ x: y, why });
    });
    return out;
  }
  /** dropId를 keepId에 합친다: 빈 칸 채우기, 활동·일정·명함 연결 옮기기, dropId 삭제 */
  function merge(kind, keepId, dropId) {
    const col = COL[kind];
    let keep = find(kind, keepId), drop = find(kind, dropId);
    if (!keep || !drop || keep === drop) return null;
    if (kind === 'card' && !keep.photo && drop.photo) [keep, drop] = [drop, keep]; // 사진 있는 쪽을 남긴다
    const patch = { id: keep.id };
    const empty = v => v == null || v === '' || v === 0 || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
    Object.keys(drop).forEach(k => {
      if (['id', 'createdAt', 'updatedAt', 'photo', 'lat', 'lng', 'approx', 'area'].includes(k)) return;
      const kv = keep[k], dv = drop[k];
      if (empty(dv)) return;
      if (k === 'jobAnalyses') patch[k] = [...(kv || []), ...dv.filter(j => !(kv || []).some(o => o.id === j.id))];
      else if (Array.isArray(dv)) patch[k] = [...new Set([...(kv || []), ...dv])];
      else if (k === 'memo' && kv && !String(kv).includes(dv)) patch[k] = `${kv}\n${dv}`;
      else if (empty(kv)) patch[k] = dv;
    });
    if (kind !== 'card' ? (keep.approx || keep.lat == null) && drop.lat != null && !drop.approx : keep.lat == null && drop.lat != null) Object.assign(patch, { lat: drop.lat, lng: drop.lng, approx: !!drop.approx, area: drop.area || keep.area });
    if (kind === 'biz' && D.STAGE[drop.stage] && D.STAGE[keep.stage] && drop.stage !== '보류' && (keep.stage === '보류' || D.STAGE[drop.stage].i > D.STAGE[keep.stage].i)) patch.stage = drop.stage;
    if (kind === 'biz') patch.placements = Math.max(Number(keep.placements) || 0, Number(drop.placements) || 0);
    const moved = [];
    if (kind !== 'card') {
      state.activities.forEach(a => { if (a.targetType === kind && a.targetId === drop.id) { a.targetId = keep.id; moved.push(['activities', a]); } });
      state.events.forEach(v => { if (v.targetType === kind && v.targetId === drop.id) { v.targetId = keep.id; moved.push(['events', v]); } });
      state.cards.forEach(c => { if (c.linkType === kind && c.linkId === drop.id) { c.linkId = keep.id; moved.push(['cards', c]); } });
    }
    state[col] = state[col].filter(x => x.id !== drop.id);
    upsert(kind, patch); // commit + 저장
    if (REMOTE) {
      send('api_apply', [...moved.map(([c, r]) => opPut(c, r)), opDel(col, drop.id)]).catch(() => {});
      if (kind === 'card' && drop.photo) send('api_delPhoto', drop.id).catch(() => {});
    }
    return keep.id;
  }

  /** 명함 소속과 이름이 겹치는 사업체·기관 (예: '화성시정신건강복지센터 화성시자살예방센터' ↔ '화성시정신건강복지센터') */
  function matchPlaces(c) {
    const words = String(c.org || '').split(/[\s,/·]+/).map(orgKey).filter(w => w.length >= 2);
    const whole = orgKey(c.org);
    if (!whole) return [];
    const hit = n => { const k = orgKey(n); return k.length >= 2 && (k === whole || whole.includes(k) || k.includes(whole) || words.includes(k)); };
    const all = [...state.businesses.filter(b => hit(b.name)).map(x => ({ kind: 'biz', x })), ...state.networks.filter(n => hit(n.name)).map(x => ({ kind: 'net', x }))];
    // 같은 종류·같은 이름이 중복 등록돼 있으면 하나(먼저 등록한 것)만 보여 준다. 나중에 합치면 명함 연결도 같이 옮겨진다
    const seen = new Set();
    return all.filter(m => { const k = m.kind + orgKey(m.x.name); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  /** 명함을 사업체·기관에 연결. 그곳에 위치가 없고 명함에 있으면 명함 위치를 가져온다 */
  function linkCard(cardId, kind, id) {
    const c = find('card', cardId), x = find(kind, id);
    if (!c || !x) return null;
    upsert('card', { id: c.id, linkType: kind, linkId: x.id });
    const hasP = o => o.lat != null && o.lng != null && o.lat !== '' && !isNaN(o.lat);
    if (!hasP(x) && hasP(c)) upsert(kind, { id: x.id, lat: c.lat, lng: c.lng, approx: !!c.approx, area: x.area || c.area || '', address: x.address || c.address || '' });
    else if (!x.address && c.address) upsert(kind, { id: x.id, address: c.address });
    return x;
  }

  /** 명함 사진: 로컬 모드는 data URL, 공유 모드는 필요할 때 시트에서 불러온다 */
  const photoLoading = new Set();
  function photo(c) {
    if (!c || !c.photo) return null;
    if (typeof c.photo === 'string' && c.photo.startsWith('data:')) return c.photo;
    if (!REMOTE) return null;
    if (photoCache.has(c.id)) return photoCache.get(c.id);
    if (!photoLoading.has(c.id)) {
      photoLoading.add(c.id);
      call('api_getPhoto', c.id).then(d => { photoCache.set(c.id, d || null); notify(); }).catch(() => {}).finally(() => photoLoading.delete(c.id));
    }
    return null;
  }

  /* ---------- 직원 · 소속 · 보기 범위 ---------- */
  const staff = () => state.settings.staff;
  const programOf = name => (staff().find(s => s.name === name) || {}).program || '';
  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } };
  let scope = lsGet('ardim.scope') || 'all';
  const getScope = () => scope;
  function setScope(v) { scope = v; lsSet('ardim.scope', v); notify(); }
  function me() { const m = lsGet('ardim.me'); return staff().some(s => s.name === m) ? m : (staff()[0]?.name || ''); }
  function setMe(v) { lsSet('ardim.me', v); notify(); }
  function staffInScope(name) {
    if (scope === 'all') return true;
    if (scope.startsWith('p:')) return programOf(name) === scope.slice(2);
    if (scope.startsWith('s:')) return name === scope.slice(2);
    return true;
  }
  function scopeLabel() {
    if (scope.startsWith('p:')) return scope.slice(2);
    if (scope.startsWith('s:')) return scope.slice(2) + ' 담당';
    return '전체 팀';
  }
  /** 현재 보기 범위(전체 팀/소속/직원)에 해당하는 데이터 */
  function view() {
    if (scope === 'all') return state;
    const biz = state.businesses.filter(b => staffInScope(b.staff));
    const net = state.networks.filter(n => staffInScope(n.staff));
    const ids = new Set([...biz.map(b => 'biz' + b.id), ...net.map(n => 'net' + n.id)]);
    const inT = x => !x.targetType || ids.has(x.targetType + x.targetId);
    return {
      ...state,
      businesses: biz, networks: net,
      cards: state.cards.filter(c => !c.linkType || ids.has(c.linkType + c.linkId)),
      activities: state.activities.filter(a => staffInScope(a.staff) || (a.targetType && ids.has(a.targetType + a.targetId))),
      events: state.events.filter(inT),
      perfs: state.perfs.filter(p => staffInScope(p.staff)),
      trips: state.trips.filter(t => staffInScope(t.staff)),
    };
  }

  /* ---------- 파생 조회 ---------- */
  const actsOf = (kind, id) => state.activities.filter(a => a.targetType === kind && a.targetId === id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const eventsOf = (kind, id) => state.events.filter(e => e.targetType === kind && e.targetId === id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const cardsOf = (kind, id) => state.cards.filter(c => c.linkType === kind && c.linkId === id);
  const lastAct = (kind, id) => actsOf(kind, id)[0] || null;
  const nextEvent = (kind, id) => eventsOf(kind, id).find(e => !e.done) || null;
  const targetOf = x => (x.targetType && x.targetId ? find(x.targetType, x.targetId) : null);
  const linkOf = c => (c.linkType && c.linkId ? find(c.linkType, c.linkId) : null);

  function stats(v = view()) {
    const ym = U.today().slice(0, 7);
    const b = v.businesses;
    const byStage = Object.fromEntries(D.STAGES.map(s => [s.key, 0]));
    b.forEach(x => { byStage[x.stage] = (byStage[x.stage] || 0) + 1; });
    const placedPeople = b.reduce((s, x) => s + (Number(x.placements) || 0), 0);
    const newThisMonth = b.filter(x => (x.discoveredAt || '').startsWith(ym)).length;
    const active = D.ACTIVE_STAGES.reduce((s, k) => s + (byStage[k] || 0), 0);
    const mandatoryBiz = b.filter(x => D.mandatoryCount(x.employees) > 0).length;
    const netActive = v.networks.filter(n => n.status === '활발').length;
    const cardsThisMonth = v.cards.filter(c => (c.metAt || c.createdAt || '').startsWith(ym)).length;
    return { total: b.length, byStage, placedPeople, newThisMonth, active, mandatoryBiz, netTotal: v.networks.length, netActive, cardTotal: v.cards.length, cardsThisMonth, placedBiz: byStage['채용연계'] || 0 };
  }

  /** 직원별·소속별 실적 (전체 팀 기준) */
  function staffStats() {
    const ym = U.today().slice(0, 7);
    const row = name => {
      const b = state.businesses.filter(x => x.staff === name);
      return {
        biz: b.length,
        active: b.filter(x => D.ACTIVE_STAGES.includes(x.stage)).length,
        placedBiz: b.filter(x => x.stage === '채용연계').length,
        placed: b.reduce((s, x) => s + (Number(x.placements) || 0), 0),
        net: state.networks.filter(x => x.staff === name).length,
        actsMonth: state.activities.filter(a => a.staff === name && a.date.startsWith(ym)).length,
      };
    };
    const people = staff().map(s => ({ ...s, ...row(s.name) }));
    const sum = list => list.reduce((t, r) => { for (const k of ['biz', 'active', 'placedBiz', 'placed', 'net', 'actsMonth']) t[k] = (t[k] || 0) + r[k]; return t; }, {});
    const groups = [...D.PROGRAMS.map(p => p.key), ''].map(key => ({ key, people: people.filter(p => (p.program || '') === key) })).filter(g => g.people.length).map(g => ({ ...g, total: sum(g.people) }));
    const known = new Set(staff().map(s => s.name));
    const orphan = state.businesses.filter(b => !known.has(b.staff)).length;
    return { groups, total: sum(people), orphan };
  }

  /* ---------- 실적 ---------- */
  /** 직원의 실적 분류표 이름 (현장중심직업재활센터 / 고용지원사업) */
  const perfSetOf = staffName => state.settings.perfByProgram[programOf(staffName)] || '';
  /** 활동 기록의 실적 분류: {set, big, mid, item} 또는 null */
  function perfOf(a) {
    const set = perfSetOf(a.staff);
    const def = D.PERF_SETS[set];
    if (!def) return null;
    let item = a.perf;
    if (item === '제외') return null;
    if (!item || !def.items.includes(item)) item = D.suggestPerf(set, a, targetOf(a));
    return item ? { set, big: def.big, mid: def.mid, item } : null;
  }
  /** 기간(YYYY-MM) 안의 실적 기록 */
  function perfRows(month, v = view()) {
    return v.activities.filter(a => a.date.startsWith(month)).map(a => ({ a, p: perfOf(a), t: targetOf(a) })).filter(r => r.p)
      .sort((x, y) => x.a.date.localeCompare(y.a.date) || x.p.item.localeCompare(y.p.item));
  }

  /** 실적 표 (구글 시트 '실적(기타)' 열 순서). 직접 입력한 실적 + 활동 기록 자동 집계(날짜·세부사업별 한 줄) */
  function perfTable(month, set, withActs = true, v = view()) {
    const def = D.PERF_SETS[set];
    if (!def) return [];
    const rows = v.perfs.filter(p => p.set === set && (p.date || '').startsWith(month)).map(p => ({
      kind: 'manual', id: p.id, date: p.date, big: def.big, mid: def.mid, item: p.item,
      people: p.people || '', newPeople: p.newPeople || '', round: p.round || '', note: p.note || '', src: `직접 입력 · ${p.staff || ''}`,
    }));
    if (withActs) {
      const groups = new Map();
      perfRows(month, v).filter(r => r.p.set === set).forEach(({ a, p, t }) => {
        const k = a.date + '|' + p.item;
        const g = groups.get(k) || { kind: 'auto', date: a.date, big: def.big, mid: def.mid, item: p.item, people: 0, targets: new Map(), n: 0 };
        g.n++; g.people += Number(a.people) || 0;
        if (t) g.targets.set(t.id, t.name);
        groups.set(k, g);
      });
      groups.forEach(g => rows.push({ ...g, people: g.people || '', newPeople: '', round: '', note: g.targets.size || g.n, src: `활동 ${g.n}건: ${[...g.targets.values()].join(', ')}` }));
    }
    return rows.sort((x, y) => x.date.localeCompare(y.date) || def.items.indexOf(x.item) - def.items.indexOf(y.item));
  }

  /** 최근 12개월: 신규 발굴 수, 채용연계 활동 수 */
  function monthly(v = view()) {
    const T = U.parse(U.today());
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(T.getFullYear(), T.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`, label: `${d.getMonth() + 1}월`, discovered: 0, placed: 0 });
    }
    const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
    v.businesses.forEach(b => { const i = idx[(b.discoveredAt || '').slice(0, 7)]; if (i != null) months[i].discovered++; });
    v.activities.forEach(a => { if (a.type === '채용연계') { const i = idx[a.date.slice(0, 7)]; if (i != null) months[i].placed++; } });
    return months;
  }

  /** 오늘 확인할 일: 지난 미완료 일정, 7일 내 일정, 연락 공백이 긴 진행 중 사업체 */
  function priorities(v = view()) {
    const T = U.today();
    const out = [];
    v.events.filter(e => !e.done && U.diffDays(T, e.date) <= 7).forEach(e => {
      const t = targetOf(e);
      out.push({ kind: 'ev', id: e.id, date: e.date, name: t ? t.name : e.title, why: t ? `${e.type}${e.time ? ' · ' + e.time : ''}` : e.type, staff: t?.staff || '', target: t ? { kind: e.targetType, id: t.id } : null, sort: U.diffDays(T, e.date) });
    });
    v.businesses.filter(b => D.ACTIVE_STAGES.includes(b.stage) && !nextEvent('biz', b.id)).forEach(b => {
      const la = lastAct('biz', b.id);
      const gap = la ? U.diffDays(la.date, T) : 999;
      if (gap >= 21) out.push({ kind: 'gap', id: b.id, date: la?.date, name: b.name, why: `${b.stage} 단계 · 마지막 연락 ${gap}일 전`, staff: b.staff, gap, target: { kind: 'biz', id: b.id }, sort: 8 + (60 - Math.min(gap, 60)) / 100 });
    });
    return out.sort((a, b) => a.sort - b.sort);
  }

  function recentActs(n = 8, v = view()) {
    return [...v.activities].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, n);
  }

  /* ---------- 검색 (보기 범위와 관계없이 팀 전체) ---------- */
  function search(q) {
    const nq = U.norm(q);
    if (!nq) return { biz: [], net: [], card: [] };
    const hit = (...vals) => U.match(q, ...vals);
    const biz = state.businesses.filter(b => hit(b.name, b.industry, b.ceo, b.address, b.area, b.bizNo, b.jobs, b.memo, b.staff, b.phone) || cardsOf('biz', b.id).some(c => hit(c.name, c.mobile, c.phone, c.email)));
    const net = state.networks.filter(n => hit(n.name, n.category, n.address, n.area, n.relation, n.memo, n.staff) || cardsOf('net', n.id).some(c => hit(c.name, c.mobile, c.phone, c.email)));
    const card = state.cards.filter(c => hit(c.name, c.org, c.title, c.dept, c.phone, c.mobile, c.email, (c.tags || []).join(' '), c.memo));
    return { biz: can('biz', 1) ? biz.slice(0, 8) : [], net: can('network', 1) ? net.slice(0, 6) : [], card: can('cards', 1) ? card.slice(0, 8) : [] };
  }

  /* ---------- 엑셀 ---------- */
  function exportXlsx() {
    const wb = XLSX.utils.book_new();
    for (const col of COLS) {
      const [sheet, cols] = SHEETS[col];
      const ws = XLSX.utils.json_to_sheet(state[col].map(x => toRow(col, x)), { header: cols.map(c => c[1]) });
      ws['!cols'] = cols.map(([k]) => ({ wch: ['name', 'address', 'memo', 'content', 'relation', 'jobs', 'accessibility', 'title', 'org'].includes(k) ? 28 : 13 }));
      XLSX.utils.book_append_sheet(wb, ws, sheet);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.settings.staff.map(s => ({ '이름': s.name, '소속 사업': s.program })), { header: ['이름', '소속 사업'] }), STAFF_SHEET[0]);
    XLSX.writeFile(wb, `아르딤_취업지원_${U.today()}.xlsx`);
  }

  function parseXlsx(buf) {
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const next = D.empty();
    next.settings = { ...state.settings };
    const found = [];
    for (const col of COLS) {
      const ws = wb.Sheets[SHEETS[col][0]];
      if (!ws) continue;
      found.push(SHEETS[col][0]);
      next[col] = XLSX.utils.sheet_to_json(ws, { defval: '' }).map(r => fromRow(col, r)).filter(o => keepRow(col, o));
    }
    const sw = wb.Sheets[STAFF_SHEET[0]];
    if (sw) {
      const list = XLSX.utils.sheet_to_json(sw, { defval: '' }).map(r => ({ name: String(r['이름'] || '').trim(), program: String(r['소속 사업'] || '').trim() })).filter(s => s.name);
      if (list.length) { next.settings.staff = list; found.push(STAFF_SHEET[0]); }
    }
    // 사진은 엑셀에 없으므로 같은 ID의 기존 사진을 유지
    const old = Object.fromEntries(state.cards.filter(c => c.photo).map(c => [c.id, c.photo]));
    next.cards.forEach(c => { c.photo = old[c.id] || null; });
    return { next: normalize(next), found };
  }

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function exportJson() {
    const copy = { ...state, cards: state.cards.map(c => ({ ...c, photo: photo(c) || (REMOTE ? null : c.photo) })) };
    download(`아르딤_취업지원_백업_${U.today()}.json`, new Blob([JSON.stringify(copy)], { type: 'application/json' }));
  }
  function templateXlsx() {
    const wb = XLSX.utils.book_new();
    for (const col of COLS) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([SHEETS[col][1].map(c => c[1])]), SHEETS[col][0]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['이름', '소속 사업']]), STAFF_SHEET[0]);
    XLSX.writeFile(wb, '아르딤_취업지원_엑셀양식.xlsx');
  }

  /** 지원고용·현장훈련 진행 여부: 직접 체크한 것 + 활동 기록(현장훈련 유, 내용)·출장 명령부에서 찾은 것 */
  function supportOf(b) {
    const set = new Set((b.support || []).filter(t => D.SUPPORT_TYPES.includes(t)));
    const found = new Set();
    const scan = txt => { if (/현장\s*훈련/.test(txt || '')) found.add('현장훈련'); if (/지원\s*고용/.test(txt || '')) found.add('지원고용'); };
    actsOf('biz', b.id).forEach(a => { if (a.training === '유') found.add('현장훈련'); scan(a.content); });
    const key = U.orgKey(b.name).replace(/점$/, '');
    if (key.length >= 2) state.trips.forEach(t => { const p = U.orgKey(t.place || '').replace(/점$/, ''); if (p && (p.includes(key) || key.includes(p)) && p.length >= 2) scan(t.purpose); });
    found.forEach(t => set.add(t));
    return { types: D.SUPPORT_TYPES.filter(t => set.has(t)), auto: [...found].some(t => !(b.support || []).includes(t)) };
  }
  /** 사업체 종류 색: 취업 연계(채용연계 단계이거나 채용 인원이 있음) > 지원고용 > 현장훈련 > 사업체 개발 */
  const bizTone = b => {
    if (!b) return 'biz';
    if (b.stage === '채용연계' || Number(b.placements) > 0) return 'placed';
    const t = supportOf(b).types;
    return t.includes('지원고용') ? 'employ' : t.includes('현장훈련') ? 'training' : 'biz';
  };
  /** 지도에 별로 표시할 우리 복지관 (네트워크에 '아르딤'이 들어간 기관) */
  const isHome = n => /아르딤/.test(n.name || '');

  return {
    REMOTE, isAdmin, level, can, accessInfo, supportOf, bizTone, isHome, dupIndex, dupesOf, merge, matchPlaces, linkCard, init, get, commit, subscribe, replace, saveSettings, find, upsert, upsertMany, remove, photo, refine,
    get aiServer() { return aiServer; }, call: (fn, ...a) => call(fn, ...a),
    staff, programOf, perfSetOf, perfOf, perfRows, perfTable, getScope, setScope, scopeLabel, me, setMe, view,
    actsOf, eventsOf, cardsOf, lastAct, nextEvent, targetOf, linkOf, stats, staffStats, monthly, priorities, recentActs, search,
    exportXlsx, parseXlsx, exportJson, templateXlsx, refresh, SHEETS,
    sync, onSync: fn => { syncListeners.add(fn); return () => syncListeners.delete(fn); },
  };
})();
