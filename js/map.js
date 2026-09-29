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

  /** 사업체: 노랑(개발) / 빨강(지원고용·현장훈련 진행). hot = 이번 달 발굴이면 크게, 진한 테두리 */
  const bizColor = b => D.MAP_COLORS[S.bizTone(b)];
  function bizMarker(b, hot) {
    const size = hot ? 22 : 17;
    const dim = b.stage === '보류' ? 'opacity:.6;' : '';
    return L.marker([b.lat, b.lng], {
      riseOnHover: true, zIndexOffset: hot ? 300 : 100,
      icon: L.divIcon({ className: '', html: `<div class="bz-pin ${hot ? 'hot' : ''} ${S.bizTone(b) === 'placed' ? 'placed' : ''} ${S.bizTone(b) !== 'placed' && S.supportOf(b).types.length === 2 ? 'both' : ''}" style="--c:${bizColor(b)};${dim}"></div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] }),
    });
  }
  function cardMarker(c) {
    return L.marker([c.lat, c.lng], { icon: L.divIcon({ className: '', html: '<div class="card-pin"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }) });
  }
  /** 기관: 검정 마름모. 우리 복지관은 금색 별 + 이름표 */
  const STAR = '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M12 1.8l3.1 6.5 7.1.9-5.2 4.9 1.3 7.1L12 17.8l-6.3 3.4 1.3-7.1L1.8 9.2l7.1-.9z" fill="var(--c)" stroke="#3B2A00" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  function netMarker(n) {
    if (S.isHome(n)) {
      return L.marker([n.lat, n.lng], {
        zIndexOffset: 1000, riseOnHover: true,
        icon: L.divIcon({ className: '', html: `<div class="home-pin" style="--c:${D.MAP_COLORS.home}">${STAR}<span>${U.esc(n.name)}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] }),
      });
    }
    return L.marker([n.lat, n.lng], { riseOnHover: true, icon: L.divIcon({ className: '', html: `<div class="net-pin" style="--c:${D.MAP_COLORS.net};${n.status === '휴면' ? 'opacity:.55' : ''}"></div>`, iconSize: [15, 15], iconAnchor: [7.5, 7.5] }) });
  }
  const hasPos = x => x && x.lat != null && x.lng != null && !isNaN(x.lat) && !isNaN(x.lng) && x.lat !== '' && x.lng !== '';

  function popupHtml(kind, x) {
    if (kind === 'card') {
      return `<div class="pop-name">${U.esc(x.org || x.name)}</div><div class="pop-meta">분류 대기 명함 · ${U.esc(x.name)} ${U.esc(x.title || '')}<br>${U.esc(x.address || '')}</div>
        <div class="inline">${V.triageButtons(x)}</div>`;
    }
    const sup = kind === 'biz' ? S.supportOf(x).types : [];
    const meta = kind === 'biz'
      ? `${sup.map(t => `<b style="color:${t === '지원고용' ? D.MAP_COLORS.employ : D.MAP_COLORS.training}">${t}</b> · `).join('')}${U.esc(x.stage)} · ${U.esc(x.industry || '')} · ${U.esc(x.area || '')}`
      : `${U.esc(x.category)} · 관계 ${U.esc(x.status)} · ${U.esc(x.area || '')}`;
    // 연결된 명함: 이름을 누르면 명함 상세, 전화 아이콘은 바로 걸기
    const cards = S.cardsOf(kind, x.id);
    const telOf = c => String(c.mobile || c.phone || '').replace(/[^0-9+]/g, '');
    const tone = kind === 'biz' ? S.bizTone(x) : S.isHome(x) ? 'home' : 'net';
    const cardList = cards.length
      ? `<ul class="pop-cards">${cards.slice(0, 4).map(c => `<li><button type="button" class="linklike" data-act="open" data-kind="card" data-id="${c.id}">${U.esc(c.name)}</button> <span class="pop-meta">${U.esc([c.dept, c.title].filter(Boolean).join(' · '))}</span>${telOf(c) ? ` <a class="pop-tel" href="tel:${telOf(c)}">${U.esc(c.mobile || c.phone)}</a>` : ''}</li>`).join('')}${cards.length > 4 ? `<li class="pop-meta">외 ${cards.length - 4}장</li>` : ''}</ul>`
      : '<div class="pop-meta pop-nocard">연결된 명함 없음</div>';
    return `<div class="pop tone-${tone}"><div class="pop-kind">${{ biz: '사업체 개발', placed: '취업 연계', employ: '지원고용 진행', training: '현장훈련 진행', net: '기관', home: '우리 복지관' }[tone]}</div>
      <div class="pop-name">${U.esc(x.name)}</div><div class="pop-meta">${meta}${x.approx ? '<br>읍면동 중심의 대략적 위치' : ''}</div>
      ${cardList}
      <div class="inline pop-actions"><button class="btn btn-sm btn-primary" type="button" data-act="open" data-kind="${kind}" data-id="${x.id}">상세 보기</button><button class="btn btn-sm" type="button" data-act="cards-of" data-kind="${kind}" data-id="${x.id}">명함 관리에서 보기${cards.length ? ` (${cards.length})` : ''}</button></div>
      <div class="inline pop-actions"><button class="btn btn-sm btn-route" type="button" data-act="route-to" data-kind="${kind}" data-id="${x.id}">여기까지 길찾기</button><button class="btn btn-ghost btn-sm" type="button" data-act="route-from" data-kind="${kind}" data-id="${x.id}">여기서 출발</button></div></div>`;
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
  /** 브이월드 주소 검색 (도로명·지번 모두, 한국 주소에 가장 정확). 키가 있을 때만, JSONP로 부른다 */
  function vworldGeocode(q, type) {
    return new Promise(res => {
      const cb = '__vw' + Math.random().toString(36).slice(2);
      const s = document.createElement('script');
      const done = v => { delete window[cb]; s.remove(); res(v); };
      window[cb] = j => { const p = j && j.response && j.response.status === 'OK' && j.response.result && j.response.result.point; done(p ? { lat: +(+p.y).toFixed(6), lng: +(+p.x).toFixed(6), label: q } : null); };
      s.src = `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=epsg:4326&refine=true&simple=true&format=json&type=${type}&key=${encodeURIComponent(vworldKey())}&address=${encodeURIComponent(q)}&callback=${cb}`;
      s.onerror = () => done(null);
      setTimeout(() => window[cb] && done(null), 8000);
      document.head.appendChild(s);
    });
  }
  async function geocode(address) {
    const q = String(address || '').trim();
    if (!q) return null;
    if (vworldKey()) for (const type of ['road', 'parcel']) { const r = await vworldGeocode(q, type); if (r) return r; }
    // OpenStreetMap 검색: 전체 주소 → 번지 뺀 주소 → (화성시 안에서만) 도로 이름. 도로 이름으로 찾으면 그 도로의 대략 위치다
    const road = q.match(/([가-힣A-Za-z0-9·]+(?:대로|로|길))\s*(\d+(?:-\d+)?)?/);
    const tries = [[q], [q.replace(/\s*\d+(-\d+)?\s*$/, '')], [q.includes('화성') ? null : '화성시 ' + q],
      [road && road[2] ? `${road[1]} ${road[2]}` : null, true], [road ? road[1] : null, true, true]];
    for (const [t, bounded, approx] of tries) {
      if (!t) continue;
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&accept-language=ko&q=${encodeURIComponent(t)}${bounded ? `&viewbox=${HS_BOX}&bounded=1` : ''}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('geocode ' + res.status);
      const j = await res.json();
      if (j[0]) return { lat: +(+j[0].lat).toFixed(6), lng: +(+j[0].lon).toFixed(6), label: j[0].display_name, approx: !!approx };
    }
    return null;
  }
  const HS_BOX = '126.55,37.35,127.22,36.95'; // 화성시를 감싸는 네모 (서,북,동,남)

  /* ---------- 길찾기 ----------
   * 두 곳 사이 직선거리로 대략 시간을 어림하고, 정확한 경로는 네이버·카카오 길찾기로 넘긴다 */
  function distKm(a, b) {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }
  /** 도로는 직선보다 1.35배 길고, 차 평균 35km/h · 버스 평균 15km/h(+기다림 10분) · 걸음 4.5km/h로 어림 */
  function estimate(km) {
    const road = km * 1.35;
    return { road, car: Math.max(3, Math.round(road / 35 * 60)), transit: Math.round(road / 15 * 60 + 10), walk: Math.round(road / 4.5 * 60) };
  }
  // 네이버 지도 길찾기 주소는 웹 메르카토르(EPSG:3857) 좌표를 쓴다
  const merc = (lat, lng) => [lng * 20037508.34 / 180, Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180) * 20037508.34 / 180].map(v => v.toFixed(2));
  const naverRoute = (a, b, mode) => `https://map.naver.com/p/directions/${merc(a.lat, a.lng).join(',')},${encodeURIComponent(a.name)},,/${merc(b.lat, b.lng).join(',')},${encodeURIComponent(b.name)},,/-/${mode}`;
  const kakaoRoute = (a, b) => `https://map.kakao.com/link/from/${encodeURIComponent(a.name)},${a.lat},${a.lng}/to/${encodeURIComponent(b.name)},${b.lat},${b.lng}`;

  /** 도로를 따라가는 자동차 경로 (OpenStreetMap 기반 무료 OSRM). 실패하면 null → 직선으로 대신 그린다. 교통 상황은 반영하지 않는다 */
  const routeCache = new Map();
  async function roadRoute(a, b) {
    const key = [a.lat, a.lng, b.lat, b.lng].join(',');
    if (routeCache.has(key)) return routeCache.get(key);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 10000);
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { signal: ctl.signal });
      clearTimeout(timer);
      const j = await res.json();
      const r = j && j.code === 'Ok' && j.routes && j.routes[0];
      const out = r ? { km: r.distance / 1000, min: Math.round(r.duration / 60), path: r.geometry.coordinates.map(([x, y]) => [y, x]) } : null;
      routeCache.set(key, out);
      return out;
    } catch { return null; }
  }

  const kakaoLink = x => `https://map.kakao.com/link/map/${encodeURIComponent(x.name)},${x.lat},${x.lng}`;
  const naverSearch = x => `https://map.naver.com/p/search/${encodeURIComponent(x.address || x.name)}`;

  return { BASES, create, guBounds, distKm, estimate, roadRoute, naverRoute, kakaoRoute, bizColor, bizMarker, netMarker, cardMarker, hasPos, popupHtml, picker, geocode, kakaoLink, naverSearch };
})();
