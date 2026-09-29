/* 지도: Leaflet + 배경 지도(여러 종류 중 선택) + 화성시 행정동 경계
   배경 지도는 인터넷에서 받아오고, 행정동·구 경계와 이름은 앱 안에 들어 있어 인터넷이 막혀도 보인다. */
window.M = (() => {
  const BOUNDARY_ATTR = '행정동 경계: 통계청 SGIS, <a href="https://github.com/vuski/admdongkor" target="_blank" rel="noopener">admdongkor</a> (CC BY 4.0)';
  /** 배경 지도 종류. 키 없이 쓸 수 있는 것을 먼저 둔다 */
  const BASES = [
    { key: 'esri', label: '일반 지도', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri', maxNativeZoom: 18 },
    { key: 'sat', label: '위성 사진', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Imagery &copy; Esri', maxNativeZoom: 18 },
    { key: 'osm', label: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>', maxNativeZoom: 19 },
    { key: 'vworld', label: '브이월드', needsKey: true, url: key => `https://api.vworld.kr/req/wmts/1.0.0/${key}/Base/{z}/{y}/{x}.png`, attr: '&copy; 국토교통부 브이월드', maxNativeZoom: 19 },
    { key: 'none', label: '배경 없음 (경계만)' },
  ];
  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 불가 */ } };
  const vworldKey = () => (window.S && S.get() && S.get().settings.vworldKey) || '';
  const available = () => BASES.filter(b => !b.needsKey || vworldKey());
  const baseKey = () => { const k = lsGet('ardim.basemap'); return available().some(b => b.key === k) ? k : 'esri'; };

  const maps = new Map();
  let tilesOk = null; // null: 모름, true: 배경 지도 받아옴, false: 못 받아옴
  const pin = () => L.divIcon({ className: '', html: '<div class="pick-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 26] });
  const toLatLng = rings => rings.map(r => r.map(([x, y]) => [y, x]));

  /** 행정동·구 경계와 이름 */
  function boundaryLayer(map) {
    const H = window.HWASEONG || { areas: [], gus: [] };
    const areaPolys = H.areas.map(b => {
      const color = (D.GU[b.gu] || {}).color || '#667085';
      return L.polygon(toLatLng(b.p), { color, weight: .8, opacity: .55, fillColor: color, fillOpacity: .1, interactive: false });
    });
    const guLines = (H.gus || []).map(g => L.polygon(toLatLng(g.p), { color: (D.GU[g.name] || {}).color || '#344054', weight: 2.6, opacity: .95, fill: false, interactive: false }));
    const label = (c, html, cls) => L.marker(c, { interactive: false, keyboard: false, icon: L.divIcon({ className: cls, html, iconSize: null }) });
    const areaLabels = H.areas.map(b => label(b.c, `<span>${b.name}</span>`, 'area-label'));
    const guLabels = (H.gus || []).map(g => label(g.c, `<span style="--c:${(D.GU[g.name] || {}).color}">${g.name}</span>`, 'gu-label'));
    L.layerGroup([...areaPolys, ...guLines, ...guLabels, ...areaLabels]).addTo(map);
    const style = () => {
      const bare = tilesOk === false || map._arBase === 'none';
      areaPolys.forEach(p => p.setStyle({ fillOpacity: bare ? .22 : .1 }));
      const c = map.getContainer();
      c.classList.toggle('offline', bare);
      c.classList.toggle('z-high', map.getZoom() >= 12);
    };
    map.on('zoomend', style);
    style();
    return { style };
  }

  function create(el, opts = {}) {
    if (!window.L) { el.innerHTML = '<div class="empty"><strong>지도를 불러오지 못했습니다</strong>페이지를 새로고침해 보세요.</div>'; return null; }
    const old = maps.get(el);
    if (old) old.remove();
    const map = L.map(el, { zoomControl: opts.zoomControl !== false, scrollWheelZoom: opts.scroll !== false, attributionControl: true })
      .setView(opts.center || D.CITY_CENTER, opts.zoom || 11);
    map.attributionControl.addAttribution(BOUNDARY_ATTR);
    const note = L.control({ position: 'bottomleft' });
    note.onAdd = () => { const d = L.DomUtil.create('div', 'map-note'); d.textContent = '배경 지도를 불러오지 못해 행정구역 경계만 표시합니다. 오른쪽 위 버튼에서 다른 배경 지도를 골라 보세요.'; return d; };
    map._arNote = note;
    const setOk = ok => {
      if (tilesOk === ok) return;
      tilesOk = ok;
      maps.forEach(m => { m._arBoundary && m._arBoundary.style(); if (m._arNote) { if (ok) m._arNote.remove(); else if (m._arBase !== 'none') m._arNote.addTo(m); } });
    };
    // 배경 지도 선택
    const layers = {};
    available().forEach(b => {
      if (b.key === 'none') { layers[b.label] = L.layerGroup(); layers[b.label]._arKey = 'none'; return; }
      const t = L.tileLayer(typeof b.url === 'function' ? b.url(vworldKey()) : b.url, { attribution: b.attr, maxZoom: 19, maxNativeZoom: b.maxNativeZoom });
      let loaded = 0, failed = 0;
      t.on('tileload', () => { loaded++; setOk(true); });
      t.on('tileerror', () => { failed++; if (!loaded && failed >= 3 && map._arBase === b.key) setOk(false); });
      t._arKey = b.key;
      layers[b.label] = t;
    });
    const cur = baseKey();
    const first = Object.values(layers).find(l => l._arKey === cur);
    map._arBase = cur;
    first.addTo(map);
    L.control.layers(layers, null, { position: 'topright', collapsed: !opts.showLayers }).addTo(map);
    map.on('baselayerchange', e => {
      map._arBase = e.layer._arKey;
      lsSet('ardim.basemap', map._arBase);
      tilesOk = null;
      if (map._arBase === 'none') note.remove();
      bl.style();
    });
    const bl = boundaryLayer(map);
    map._arBoundary = bl;
    setTimeout(() => { if (tilesOk === null && map._arBase !== 'none') setOk(false); }, 7000);
    if (tilesOk === false && cur !== 'none') note.addTo(map);
    maps.set(el, map);
    setTimeout(() => map.invalidateSize(), 60);
    return map;
  }

  /** 구(또는 화성시 전체) 경계에 맞춰 보기 */
  function guBounds(gu) {
    const pts = D.BOUNDS.filter(b => !gu || b.gu === gu).flatMap(b => b.p.flat().map(([x, y]) => [y, x]));
    return pts.length ? L.latLngBounds(pts) : null;
  }

  /** hot: 이번 달 발굴처럼 강조할 곳이면 크게, 진한 테두리 */
  function bizMarker(b, hot) {
    const st = D.STAGE[b.stage] || D.STAGE['발굴'];
    return L.circleMarker([b.lat, b.lng], {
      radius: hot ? 10 : (b.stage === '채용연계' ? 8 : 7), color: hot ? '#172033' : '#fff', weight: hot ? 3 : 2, fillColor: st.hex, fillOpacity: b.stage === '보류' ? .75 : .95,
    });
  }
  function cardMarker(c) {
    return L.marker([c.lat, c.lng], { icon: L.divIcon({ className: '', html: '<div class="card-pin"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }) });
  }
  function netMarker(n) {
    return L.marker([n.lat, n.lng], { icon: L.divIcon({ className: '', html: `<div class="net-pin" style="${n.status === '휴면' ? 'opacity:.55' : ''}"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] }) });
  }
  const hasPos = x => x && x.lat != null && x.lng != null && !isNaN(x.lat) && !isNaN(x.lng) && x.lat !== '' && x.lng !== '';

  function popupHtml(kind, x) {
    if (kind === 'card') {
      return `<div class="pop-name">${U.esc(x.org || x.name)}</div><div class="pop-meta">분류 대기 명함 · ${U.esc(x.name)} ${U.esc(x.title || '')}<br>${U.esc(x.address || '')}</div>
        <div class="inline">${V.triageButtons(x)}</div>`;
    }
    const meta = kind === 'biz'
      ? `${U.esc(x.stage)} · ${U.esc(x.industry || '')} · ${U.esc(x.area || '')}`
      : `${U.esc(x.category)} · 관계 ${U.esc(x.status)} · ${U.esc(x.area || '')}`;
    return `<div class="pop-name">${U.esc(x.name)}</div><div class="pop-meta">${meta}${x.approx ? '<br>읍면동 중심의 대략적 위치' : ''}</div>
      <button class="btn btn-sm btn-primary" type="button" data-act="open" data-kind="${kind}" data-id="${x.id}">상세 보기</button>`;
  }

  /** 위치 지정용 지도: 클릭하면 핀 이동 */
  function picker(el, pos, onPick) {
    const has = pos && hasPos(pos);
    const map = create(el, { center: has ? [pos.lat, pos.lng] : D.CITY_CENTER, zoom: has ? 15 : 11 });
    if (!map) return null;
    let marker = has ? L.marker([pos.lat, pos.lng], { draggable: true, icon: pin() }).addTo(map) : null;
    const set = (lat, lng, zoom) => {
      lat = +lat.toFixed(6); lng = +lng.toFixed(6);
      if (!marker) { marker = L.marker([lat, lng], { draggable: true, icon: pin() }).addTo(map); marker.on('dragend', () => { const p = marker.getLatLng(); onPick(+p.lat.toFixed(6), +p.lng.toFixed(6)); }); }
      else marker.setLatLng([lat, lng]);
      if (zoom) map.setView([lat, lng], zoom);
      onPick(lat, lng);
    };
    if (marker) marker.on('dragend', () => { const p = marker.getLatLng(); onPick(+p.lat.toFixed(6), +p.lng.toFixed(6)); });
    map.on('click', e => set(e.latlng.lat, e.latlng.lng));
    return { map, set };
  }

  /** 주소 → 좌표 (OpenStreetMap Nominatim, 인터넷 필요. 한국 도로명 주소는 못 찾을 수 있음) */
  async function geocode(address) {
    const q = String(address || '').trim();
    if (!q) return null;
    const tries = [q, q.replace(/\s*\d+(-\d+)?\s*$/, ''), q.includes('화성') ? null : '화성시 ' + q].filter(Boolean);
    for (const t of tries) {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&accept-language=ko&q=${encodeURIComponent(t)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('geocode ' + res.status);
      const j = await res.json();
      if (j[0]) return { lat: +(+j[0].lat).toFixed(6), lng: +(+j[0].lon).toFixed(6), label: j[0].display_name };
    }
    return null;
  }

  const kakaoLink = x => `https://map.kakao.com/link/map/${encodeURIComponent(x.name)},${x.lat},${x.lng}`;
  const naverSearch = x => `https://map.naver.com/p/search/${encodeURIComponent(x.address || x.name)}`;

  return { BASES, create, guBounds, bizMarker, netMarker, cardMarker, hasPos, popupHtml, picker, geocode, kakaoLink, naverSearch };
})();
