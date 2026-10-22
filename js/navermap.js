/* 네이버 지도(실험): 데이터 관리에 넣은 네이버 지도 키(Client ID)로 네이버 지도 JavaScript API v3를 띄운다.
   기본 지도(Leaflet·브이월드)와 같은 장소·목록·말풍선을 쓰고, '나란히 비교'에서는 두 지도가 같이 움직인다.
   길찾기·여기에 추가·위치 옮기기는 기본 지도에서만 된다. */
window.NM = (() => {
  let loading = null, map = null, info = null, markers = {}, authFailed = false, el = null;
  const key = () => String((S.get().settings || {}).naverKey || '').trim();
  const param = () => String((S.get().settings || {}).naverKeyParam || 'ncpKeyId');
  const ready = () => !!(window.naver && naver.maps && naver.maps.Map);

  /** 지도 스크립트 불러오기 (한 번만) */
  function load() {
    if (ready()) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      // 키가 틀리거나 이 사이트 주소가 등록되지 않으면 네이버가 이 함수를 부른다
      window.navermap_authFailure = () => { authFailed = true; showFail(); };
      const s = document.createElement('script');
      s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?${param()}=${encodeURIComponent(key())}`;
      s.onload = () => (ready() ? res() : rej(new Error('네이버 지도를 불러오지 못했어요.')));
      s.onerror = () => { loading = null; rej(new Error('네이버 지도 스크립트를 받지 못했어요. 인터넷 연결이나 회사 방화벽을 확인하세요.')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function showFail(msg) {
    if (!el) return;
    el.innerHTML = `<div class="nm-fail"><b>네이버 지도 인증에 실패했어요</b>
      <p>${msg ? U.esc(msg) : '키(Client ID)가 맞는지, 네이버 클라우드 콘솔의 <b>Maps → Application → Web 서비스 URL</b>에 아래 주소가 들어 있는지 확인하세요.'}</p>
      <code>${U.esc(location.origin)}</code>${S.REMOTE ? '<code>https://script.google.com</code>' : ''}
      <p class="sub">주소를 넣은 뒤 몇 분 지나 새로고침하세요. 데이터 관리 → 네이버 지도에서 키 방식(ncpKeyId / ncpClientId)을 바꿔 볼 수도 있어요.</p></div>`;
  }

  const LL = (lat, lng) => new naver.maps.LatLng(+lat, +lng);
  /** 지도 만들기 (컨테이너가 바뀌면 새로 만든다) */
  async function mount(box, view) {
    el = box;
    if (!key()) { box.innerHTML = '<div class="nm-fail"><b>네이버 지도 키가 없어요</b><p>데이터 관리 → 네이버 지도에 Client ID를 넣어 주세요.</p></div>'; return false; }
    try { await load(); } catch (err) { showFail(err.message); return false; }
    if (authFailed) { showFail(); return false; }
    if (map && map.getElement && map.getElement() === box) return true;
    markers = {};
    map = new naver.maps.Map(box, {
      center: LL(view ? view.lat : D.CITY_CENTER[0], view ? view.lng : D.CITY_CENTER[1]), zoom: view ? Math.round(view.zoom) : 11,
      zoomControl: true, zoomControlOptions: { position: naver.maps.Position.TOP_LEFT }, mapTypeControl: true, scaleControl: true,
    });
    info = new naver.maps.InfoWindow({ content: '', borderWidth: 1, borderColor: '#C9D3E0', backgroundColor: '#fff', anchorSize: new naver.maps.Size(12, 8), pixelOffset: new naver.maps.Point(0, -6), maxWidth: 340 });
    naver.maps.Event.addListener(map, 'zoom_changed', labels);
    naver.maps.Event.addListener(map, 'click', () => info.close());
    return true;
  }
  const color = (kind, x) => (kind === 'biz' ? M.bizColor(x) : kind === 'net' ? (S.isHome(x) ? D.MAP_COLORS.home : D.MAP_COLORS.net) : D.MAP_COLORS.card);
  const nameOf = (kind, x) => (kind === 'card' ? (x.org || x.name) : x.name);
  function labels() {
    if (!map || !el) return;
    el.classList.toggle('nm-labels', map.getZoom() >= 14 || Object.keys(markers).length <= 30);
  }
  /** 점 맞추기: 바뀐 점만 다시 만든다 */
  function update(shown) {
    if (!map || authFailed) return;
    const seen = new Set();
    shown.forEach(({ kind, x, month }) => {
      if (!M.hasPos(x)) return;
      const k = kind + x.id, sig = [x.lat, x.lng, nameOf(kind, x), color(kind, x), month ? 1 : 0].join('|');
      seen.add(k);
      const old = markers[k];
      if (old && old._sig === sig) return;
      if (old) old.setMap(null);
      const home = kind === 'net' && S.isHome(x), shape = home ? 'star' : kind === 'biz' ? 'dot' : 'sq';
      const mk = new naver.maps.Marker({
        position: LL(x.lat, x.lng), map, zIndex: home ? 1000 : month ? 300 : 100,
        icon: { content: `<div class="nm-pin ${shape} ${month ? 'hot' : ''}" style="--c:${color(kind, x)}"><i></i><span>${U.esc(nameOf(kind, x))}</span></div>`, anchor: new naver.maps.Point(8, 8) },
      });
      mk._sig = sig; mk._ref = { kind, id: x.id };
      naver.maps.Event.addListener(mk, 'click', () => open(kind, x.id));
      markers[k] = mk;
    });
    Object.keys(markers).forEach(k => { if (!seen.has(k)) { markers[k].setMap(null); delete markers[k]; } });
    labels();
  }
  function open(kind, id) {
    const mk = markers[kind + id], x = S.find(kind, id);
    if (!mk || !x) return;
    info.setContent(`<div class="nm-pop">${M.popupHtml(kind, x)}</div>`);
    info.open(map, mk);
    if (NM.onOpen) NM.onOpen(kind, id);
  }
  /** 목록에서 고르면 부드럽게 옮긴 뒤 말풍선 */
  function focus(kind, id) {
    const mk = markers[kind + id];
    if (!mk) return false;
    info.close();
    map.morph(mk.getPosition(), Math.max(map.getZoom(), 16), { duration: 600 });
    setTimeout(() => open(kind, id), 650);
    return true;
  }
  function fit(shown) {
    if (!map) return;
    const pts = shown.filter(i => M.hasPos(i.x));
    if (!pts.length) return;
    const b = new naver.maps.LatLngBounds(LL(pts[0].x.lat, pts[0].x.lng), LL(pts[0].x.lat, pts[0].x.lng));
    pts.forEach(i => b.extend(LL(i.x.lat, i.x.lng)));
    map.fitBounds(b, { top: 30, right: 30, bottom: 30, left: 30 });
  }
  const getView = () => (map ? { lat: map.getCenter().lat(), lng: map.getCenter().lng(), zoom: map.getZoom() } : null);
  const setView = v => { if (map && v) map.setCenter(LL(v.lat, v.lng)), map.setZoom(Math.round(v.zoom), false); };
  const onIdle = fn => { if (map) naver.maps.Event.addListener(map, 'idle', fn); };
  const resize = () => { if (map && el) map.setSize(new naver.maps.Size(el.clientWidth, el.clientHeight)); };
  const reset = () => { map = null; markers = {}; el = null; };
  return { key, ready, mount, update, focus, open, fit, getView, setView, onIdle, resize, reset, close: () => info && info.close(), failed: () => authFailed };
})();
