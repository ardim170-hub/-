/* 데이터 저장소: 모든 화면은 이 한 곳의 데이터에서 계산한다.
   저장 위치는 이 브라우저의 IndexedDB (없으면 localStorage). */
window.S = (() => {
  const DB_NAME = 'ardim-jobs-crm';
  const KEY = 'state';
  let state = null;
  const listeners = new Set();

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
  let saveError = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { await writeRaw(state); saveError = null; }
      catch (e) { saveError = e; App.toast('저장하지 못했습니다. 저장 공간이 부족할 수 있어요. 명함 사진을 줄이거나 엑셀로 백업하세요.', 'error'); }
    }, 150);
  }

  async function init() {
    const raw = await readRaw();
    state = raw && raw.version ? raw : D.demo();
    for (const k of ['businesses', 'networks', 'cards', 'activities', 'events']) state[k] ||= [];
    state.settings ||= { orgName: '화성시아르딤복지관 직업지원팀', staff: ['김정배'] };
    if (state.settings.cityMapUrl == null) state.settings.cityMapUrl = D.CITY_DASHBOARD_URL;
    if (!raw) persist();
    return state;
  }

  const get = () => state;
  function commit() { persist(); listeners.forEach(fn => fn()); }
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  function replace(next) { state = next; commit(); }

  const COL = { biz: 'businesses', net: 'networks', card: 'cards', act: 'activities', ev: 'events' };
  const PREFIX = { biz: 'B', net: 'N', card: 'C', act: 'A', ev: 'E' };
  const find = (kind, id) => state[COL[kind]].find(x => x.id === id);
  function upsert(kind, obj) {
    const list = state[COL[kind]];
    if (!obj.id) obj.id = U.uid(PREFIX[kind]);
    const i = list.findIndex(x => x.id === obj.id);
    obj.updatedAt = U.today();
    if (i >= 0) list[i] = { ...list[i], ...obj }; else { obj.createdAt = U.today(); list.push(obj); }
    commit();
    return find(kind, obj.id);
  }
  function remove(kind, id) {
    const list = state[COL[kind]];
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return null;
    const [gone] = list.splice(i, 1);
    const removedLinks = { acts: [], evs: [], cards: [] };
    if (kind === 'biz' || kind === 'net') {
      removedLinks.acts = state.activities.filter(a => a.targetType === kind && a.targetId === id);
      removedLinks.evs = state.events.filter(e => e.targetType === kind && e.targetId === id);
      state.activities = state.activities.filter(a => !(a.targetType === kind && a.targetId === id));
      state.events = state.events.filter(e => !(e.targetType === kind && e.targetId === id));
      state.cards.forEach(c => { if (c.linkType === kind && c.linkId === id) { removedLinks.cards.push(c.id); c.linkType = ''; c.linkId = ''; } });
    }
    commit();
    return () => { // 되돌리기
      list.splice(Math.min(i, list.length), 0, gone);
      state.activities.push(...removedLinks.acts);
      state.events.push(...removedLinks.evs);
      state.cards.forEach(c => { if (removedLinks.cards.includes(c.id)) { c.linkType = kind; c.linkId = id; } });
      commit();
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

  function stats() {
    const T = U.today();
    const ym = T.slice(0, 7);
    const b = state.businesses;
    const byStage = Object.fromEntries(D.STAGES.map(s => [s.key, 0]));
    b.forEach(x => { byStage[x.stage] = (byStage[x.stage] || 0) + 1; });
    const placedPeople = b.reduce((s, x) => s + (Number(x.placements) || 0), 0);
    const newThisMonth = b.filter(x => (x.discoveredAt || '').startsWith(ym)).length;
    const active = D.ACTIVE_STAGES.reduce((s, k) => s + (byStage[k] || 0), 0);
    const mandatoryBiz = b.filter(x => D.mandatoryCount(x.employees) > 0).length;
    const netActive = state.networks.filter(n => n.status === '활발').length;
    const cardsThisMonth = state.cards.filter(c => (c.metAt || c.createdAt || '').startsWith(ym)).length;
    return { total: b.length, byStage, placedPeople, newThisMonth, active, mandatoryBiz, netTotal: state.networks.length, netActive, cardTotal: state.cards.length, cardsThisMonth, placedBiz: byStage['채용연계'] || 0 };
  }

  /** 최근 12개월: 신규 발굴 수, 채용연계 활동 수 */
  function monthly() {
    const T = U.parse(U.today());
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(T.getFullYear(), T.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`, label: `${d.getMonth() + 1}월`, discovered: 0, placed: 0 });
    }
    const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
    state.businesses.forEach(b => { const i = idx[(b.discoveredAt || '').slice(0, 7)]; if (i != null) months[i].discovered++; });
    state.activities.forEach(a => { if (a.type === '채용연계') { const i = idx[a.date.slice(0, 7)]; if (i != null) months[i].placed++; } });
    return months;
  }

  /** 오늘 확인할 일: 지난 미완료 일정, 7일 내 일정, 연락 공백이 긴 진행 중 사업체 */
  function priorities() {
    const T = U.today();
    const out = [];
    state.events.filter(e => !e.done && U.diffDays(T, e.date) <= 7).forEach(e => {
      const t = targetOf(e);
      out.push({ kind: 'ev', id: e.id, date: e.date, name: t ? t.name : e.title, why: t ? `${e.type}${e.time ? ' · ' + e.time : ''}` : e.type, target: t ? { kind: e.targetType, id: t.id } : null, sort: U.diffDays(T, e.date) });
    });
    state.businesses.filter(b => D.ACTIVE_STAGES.includes(b.stage) && !nextEvent('biz', b.id)).forEach(b => {
      const la = lastAct('biz', b.id);
      const gap = la ? U.diffDays(la.date, T) : 999;
      if (gap >= 21) out.push({ kind: 'gap', id: b.id, date: la?.date, name: b.name, why: `${b.stage} 단계 · 마지막 연락 ${gap}일 전`, gap, target: { kind: 'biz', id: b.id }, sort: 8 + (60 - Math.min(gap, 60)) / 100 });
    });
    return out.sort((a, b) => a.sort - b.sort);
  }

  function recentActs(n = 8) {
    return [...state.activities].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, n);
  }

  /* ---------- 검색 ---------- */
  function search(q) {
    const nq = U.norm(q);
    if (!nq) return { biz: [], net: [], card: [] };
    const hit = (...vals) => vals.some(v => U.norm(v).includes(nq));
    const biz = state.businesses.filter(b => hit(b.name, b.industry, b.ceo, b.address, b.area, b.bizNo, b.jobs, b.memo) || cardsOf('biz', b.id).some(c => hit(c.name, c.mobile, c.phone, c.email)));
    const net = state.networks.filter(n => hit(n.name, n.category, n.address, n.area, n.relation, n.memo) || cardsOf('net', n.id).some(c => hit(c.name, c.mobile, c.phone, c.email)));
    const card = state.cards.filter(c => hit(c.name, c.org, c.title, c.dept, c.phone, c.mobile, c.email, (c.tags || []).join(' '), c.memo));
    return { biz: biz.slice(0, 8), net: net.slice(0, 6), card: card.slice(0, 8) };
  }

  /* ---------- 엑셀 ---------- */
  const SHEETS = {
    businesses: ['사업체', [['id', '사업체ID'], ['name', '사업체명'], ['industry', '업종'], ['stage', '진행 단계'], ['bizNo', '사업자등록번호'], ['ceo', '대표자'], ['employees', '상시근로자 수'], ['address', '주소'], ['area', '읍면동'], ['lat', '위도'], ['lng', '경도'], ['jobs', '가능 직무'], ['workConditions', '근무 조건'], ['accessibility', '편의시설·고려사항'], ['placements', '채용 연계 인원'], ['source', '발굴 경로'], ['discoveredAt', '발굴일'], ['staff', '담당 직원'], ['memo', '메모']]],
    networks: ['네트워크', [['id', '기관ID'], ['name', '기관명'], ['category', '분류'], ['status', '관계 상태'], ['address', '주소'], ['area', '읍면동'], ['lat', '위도'], ['lng', '경도'], ['relation', '협력 내용'], ['promo', '홍보 방식'], ['since', '협력 시작일'], ['staff', '담당 직원'], ['memo', '메모']]],
    cards: ['명함', [['id', '명함ID'], ['name', '이름'], ['org', '소속'], ['dept', '부서'], ['title', '직함'], ['mobile', '휴대전화'], ['phone', '사무실 전화'], ['email', '이메일'], ['address', '주소'], ['linkType', '연결 구분(biz/net)'], ['linkId', '연결ID'], ['tags', '태그'], ['metAt', '받은 날'], ['metWhere', '받은 곳'], ['memo', '메모']]],
    activities: ['활동기록', [['id', '활동ID'], ['targetType', '대상 구분(biz/net)'], ['targetId', '대상ID'], ['date', '날짜'], ['type', '유형'], ['content', '내용'], ['staff', '담당 직원']]],
    events: ['일정', [['id', '일정ID'], ['date', '날짜'], ['time', '시간'], ['type', '유형'], ['title', '제목'], ['targetType', '대상 구분(biz/net)'], ['targetId', '대상ID'], ['done', '완료(Y/N)'], ['memo', '메모']]],
  };
  const DATE_KEYS = new Set(['discoveredAt', 'since', 'metAt', 'date']);
  const NUM_KEYS = new Set(['employees', 'placements', 'lat', 'lng']);

  function exportXlsx() {
    const wb = XLSX.utils.book_new();
    for (const [col, [sheet, cols]] of Object.entries(SHEETS)) {
      const rows = state[col].map(x => Object.fromEntries(cols.map(([k, h]) => {
        let v = x[k];
        if (k === 'tags') v = (v || []).join(', ');
        if (k === 'done') v = v ? 'Y' : 'N';
        return [h, v ?? ''];
      })));
      const ws = XLSX.utils.json_to_sheet(rows, { header: cols.map(c => c[1]) });
      ws['!cols'] = cols.map(([k]) => ({ wch: ['name', 'address', 'memo', 'content', 'relation', 'jobs', 'accessibility', 'title', 'org'].includes(k) ? 28 : 13 }));
      XLSX.utils.book_append_sheet(wb, ws, sheet);
    }
    XLSX.writeFile(wb, `아르딤_취업지원_${U.today()}.xlsx`);
  }

  function parseXlsx(buf) {
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const next = D.empty();
    next.settings = { ...state.settings };
    const found = [];
    for (const [col, [sheet, cols]] of Object.entries(SHEETS)) {
      const ws = wb.Sheets[sheet];
      if (!ws) continue;
      found.push(sheet);
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      next[col] = rows.map(r => {
        const o = {};
        for (const [k, h] of cols) {
          let v = r[h];
          if (DATE_KEYS.has(k)) v = U.toDateStr(v);
          else if (NUM_KEYS.has(k)) v = v === '' ? (k === 'lat' || k === 'lng' ? null : 0) : Number(v);
          else if (k === 'tags') v = String(v || '').split(',').map(t => t.trim()).filter(Boolean);
          else if (k === 'done') v = /^(y|yes|o|완료|true|1)$/i.test(String(v).trim());
          else v = v == null ? '' : String(v).trim();
          o[k] = v;
        }
        if (!o.id) o.id = U.uid(col[0].toUpperCase());
        return o;
      }).filter(o => (col === 'activities' ? o.content || o.type : col === 'events' ? o.title || o.date : o.name));
    }
    next.businesses.forEach(b => {
      if (!D.STAGE[b.stage]) b.stage = '발굴';
      if ((b.lat == null || isNaN(b.lat)) && D.AREA_BY_NAME[b.area]) { b.lat = D.AREA_BY_NAME[b.area].lat; b.lng = D.AREA_BY_NAME[b.area].lng; b.approx = true; }
    });
    next.networks.forEach(n => {
      if (!D.NET_STATUS.includes(n.status)) n.status = '보통';
      if ((n.lat == null || isNaN(n.lat)) && D.AREA_BY_NAME[n.area]) { n.lat = D.AREA_BY_NAME[n.area].lat; n.lng = D.AREA_BY_NAME[n.area].lng; n.approx = true; }
    });
    return { next, found };
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `아르딤_취업지원_백업_${U.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function templateXlsx() {
    const wb = XLSX.utils.book_new();
    for (const [, [sheet, cols]] of Object.entries(SHEETS)) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cols.map(c => c[1])]), sheet);
    }
    XLSX.writeFile(wb, '아르딤_취업지원_엑셀양식.xlsx');
  }

  return { init, get, commit, subscribe, replace, find, upsert, remove, actsOf, eventsOf, cardsOf, lastAct, nextEvent, targetOf, linkOf, stats, monthly, priorities, recentActs, search, exportXlsx, parseXlsx, exportJson, templateXlsx, SHEETS, get saveError() { return saveError; } };
})();
