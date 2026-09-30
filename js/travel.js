/* 출장 여비 계산 (중증장애인직업재활지원사업 규정집 2026 여비 기준 + 복지관 정산 기준)
   - 근무지 내(관내, 화성시 안): 일비 4시간 미만 5천원 · 4시간 이상 1만원 (기관차량·자차 같음) + 유류비 + 통행료 + 주차료
   - 식비: 한 사람 하루 최대 2만원 (출장·특근 식비를 합쳐서)
   - 근무지 외(관외): 운임 + 숙박비(상한) + 식비(1일 2만원 이내) + 일비(1일 2만원 이내)
   - 하루에 여러 번 나가면 출장시간을 모두 더해 계산하되 1일 기준 금액을 넘지 않는다
   - 하루에 관내·관외를 같이 가면 관외 기준으로 준다 */
window.TV = (() => {
  const e = U.esc;
  const RULE = {
    daily: { long: { car: 10000, nocar: 10000 }, short: { car: 5000, nocar: 5000 } }, // 관내 일비: 4시간 이상 1만원 / 미만 5천원 (복지관 정산 기준: 기관차량·자차 같음)
    outDaily: 20000, // 관외 일비 1일 상한
    meal: 20000, // 식비 1일 상한 (관외는 안 적으면 상한으로 잡음, 관내·특근은 적은 금액을 같이 계산)
    lodge: { 특별시: 70000, 광역시: 60000, '그 외': 50000 }, // 숙박비 1박 상한
  };
  const LODGE_REGIONS = Object.keys(RULE.lodge);
  const METRO = /서울|인천|대전|대구|광주광역|울산|부산/;
  // 화성시 밖 지명 (관외 자동 판단용). 화성시 안 지명은 D.AREAS에서 본다
  const OTHER_CITY = /서울|인천|대전|대구|광주|울산|부산|세종|수원|오산|평택|안산|용인|시흥|안양|군포|의왕|광명|부천|성남|과천|하남|이천|안성|여주|김포|고양|파주|의정부|남양주|구리|천안|아산|당진|청주|춘천|원주|강릉|전주|제주|창원|포항|경주|양평|가평|포천|동두천|양주|연천|충청|전라|경상|강원/;
  const num = v => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };
  const won = n => `${Math.round(n).toLocaleString('ko-KR')}`;

  /** "9 ~ 12시", "09:00~12:30", "14시~18시", "1~5시"(오후) → 분. 모르면 0 */
  function minutesOf(text) {
    const s = String(text || '').replace(/\s/g, '');
    const m = s.match(/(오전|오후)?(\d{1,2})(?:[:시.](\d{2}))?(?:분)?(?:시)?[~\-–〜](오전|오후)?(\d{1,2})(?:[:시.](\d{2}))?/);
    if (!m) return 0;
    let a = +m[2] + (+m[3] || 0) / 60, b = +m[5] + (+m[6] || 0) / 60;
    if (m[1] === '오후' && a < 12) a += 12;
    if ((m[4] === '오후' || (m[1] === '오후' && !m[4])) && b < 12) b += 12;
    if (!m[1] && a >= 1 && a <= 7) a += 12; // 1~7시는 오후로 본다 (근무시간)
    if (!m[4] && !m[1] && b >= 1 && b <= 8 && b < a) b += 12;
    if (b <= a && b + 12 > a) b += 12;
    const min = Math.round((b - a) * 60);
    return min > 0 && min <= 24 * 60 ? min : 0;
  }
  const hm = min => (min ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : '');

  /** 출장지 이름으로 지도에 있는 사업체·기관을 찾는다 */
  function placeOf(t) {
    const key = U.orgKey(t.place || '');
    if (key.length < 2) return null;
    const st = S.view();
    const all = [...st.businesses, ...st.networks];
    return all.find(x => U.orgKey(x.name) === key) || all.find(x => { const k = U.orgKey(x.name); return k.length >= 2 && (k.includes(key) || key.includes(k)); }) || null;
  }
  const homeOf = () => S.get().networks.find(n => S.isHome(n) && M.hasPos(n)) || null;
  /** 관내·관외: 직접 고른 값이 먼저, 없으면 출장지·주소로 판단 (모르면 관내 = 관내출장 명령부) */
  function zoneOf(t) {
    if (t.zone === '관내' || t.zone === '관외') return t.zone;
    const p = placeOf(t);
    const text = [t.place, p && p.address].filter(Boolean).join(' ');
    if (/화성/.test(text)) return '관내';
    if (p && p.area && D.AREA_BY_NAME && D.AREA_BY_NAME[p.area]) return '관내';
    return OTHER_CITY.test(text) ? '관외' : '관내';
  }
  function regionOf(t) {
    if (LODGE_REGIONS.includes(t.lodgeRegion)) return t.lodgeRegion;
    const p = placeOf(t);
    const text = [t.place, p && p.address].filter(Boolean).join(' ');
    return /서울/.test(text) ? '특별시' : METRO.test(text) ? '광역시' : '그 외';
  }
  const hasCar = t => /복지관|기관|관용|공용/.test(t.method || '');
  const ownCar = t => /개인|자가|본인/.test(t.method || '');
  /** 왕복 거리(km): 적은 값이 먼저, 없으면 복지관↔출장지 직선거리 × 1.35(도로 보정) × 2 로 어림 */
  function kmOf(t) {
    if (num(t.km)) return { km: num(t.km), est: false };
    const p = placeOf(t), h = homeOf();
    if (!p || !h || !M.hasPos(p)) return { km: 0, est: true };
    return { km: Math.round(M.distKm(h, p) * 1.35 * 2 * 10) / 10, est: true };
  }
  const settings = () => S.get().settings || {};
  const effOf = t => num(t.fuelEff) || num(settings().fuelEff);
  const priceOf = t => num(t.fuelPrice) || num(settings().fuelPrice);
  /** 한 줄(출장 1건)의 실비: 유류비·통행료·주차료·운임·숙박비 */
  function rowCost(t) {
    const zone = zoneOf(t);
    const { km, est } = kmOf(t);
    const eff = effOf(t), price = priceOf(t);
    const fuel = ownCar(t) && km && eff && price ? Math.round(km * price / eff) : 0;
    const need = ownCar(t) ? [!km && '거리', !price && '유가', !eff && '연비'].filter(Boolean) : [];
    const lodgeCap = RULE.lodge[regionOf(t)] * Math.max(1, num(t.lodgeNights) || 1);
    const lodge = zone === '관외' ? Math.min(num(t.lodging), lodgeCap) : 0;
    const fare = zone === '관외' ? num(t.fare) : 0;
    return { zone, km, est, fuel, need, toll: num(t.toll), parking: num(t.parking), fare, lodge, lodgeCap, lodgeOver: zone === '관외' && num(t.lodging) > lodgeCap };
  }
  /** 담당자·날짜별로 묶어 일비·식비를 하루 단위로 계산 */
  function days(list) {
    const map = new Map();
    list.forEach(t => { const k = `${t.staff || ''}|${t.date || ''}`; if (!map.has(k)) map.set(k, []); map.get(k).push(t); });
    return [...map.values()].map(g => {
      const rows = g.map(t => ({ t, c: rowCost(t), min: minutesOf(t.time) }));
      const out = rows.some(r => r.c.zone === '관외');
      const min = rows.reduce((s, r) => s + r.min, 0);
      const car = rows.some(r => hasCar(r.t));
      let daily, why;
      if (out) { daily = RULE.outDaily; why = '관외 1일 정액'; } else {
        const long = min >= 240;
        daily = RULE.daily[long ? 'long' : 'short'][car ? 'car' : 'nocar'];
        why = `관내 ${min ? hm(min) : '시간 미입력'}${min ? (long ? ' (4시간 이상)' : ' (4시간 미만)') : ''}`;
      }
      // 식비는 관외 출장일에만. 적은 금액이 없으면 상한(2만원)으로 잡는다
      // 식비: 그날 줄마다 적은 금액을 더해 1일 2만원까지. 관외인데 아무것도 안 적었으면 2만원
      const mealTyped = rows.some(r => String(r.t.meal ?? '').trim() !== '');
      const mealSum = rows.reduce((a, r) => a + num(r.t.meal), 0);
      const meal = Math.min(RULE.meal, mealTyped ? mealSum : out ? RULE.meal : 0);
      const sum = k => rows.reduce((s, r) => s + r.c[k], 0);
      const actual = sum('fuel') + sum('toll') + sum('parking') + sum('fare') + sum('lodge');
      return { staff: g[0].staff || '(담당자 없음)', date: g[0].date, rows, out, min, car, daily, why, meal, actual, total: daily + meal + actual, noTime: !out && !min };
    }).sort((a, b) => (a.staff).localeCompare(b.staff) || (a.date || '').localeCompare(b.date || ''));
  }
  /** 특근: 담당자·날짜별 식비 (적은 금액, 1일 2만원까지) */
  function otDays(list) {
    const map = new Map();
    list.forEach(t => { const k = `${t.staff || ''}|${t.date || ''}`; if (!map.has(k)) map.set(k, []); map.get(k).push(t); });
    return [...map.values()].map(g => {
      const sum = g.reduce((a, t) => a + num(t.meal), 0);
      const meal = Math.min(RULE.meal, sum);
      return { staff: g[0].staff || '(담당자 없음)', date: g[0].date, rows: g, meal, over: sum > RULE.meal, total: meal, min: g.reduce((a, t) => a + minutesOf(t.time), 0) };
    });
  }
  /** 한 달 정산: 사람마다 관내 출장 · 관외 출장 · 특근(식비) 묶음. 식비는 출장·특근 합쳐 하루 2만원까지 */
  function settle(month) {
    const ds = days(monthTrips(month));
    const ots = S.get().trips.filter(t => t.kind === '특근' && (t.date || '').startsWith(month));
    const people = new Map();
    const P = name => { if (!people.has(name)) people.set(name, { name, in: [], out: [], ot: [], inTotal: 0, outTotal: 0, otTotal: 0, total: 0 }); return people.get(name); };
    const tripMeal = new Map();
    ds.forEach(d => {
      const p = P(d.staff);
      const c = k => d.rows.reduce((a, r) => a + r.c[k], 0);
      const row = { date: d.date, where: d.rows.map(r => r.t.place).filter(Boolean).join(', '), time: d.rows.map(r => r.t.time).filter(Boolean).join(', '), min: d.min, why: d.why, daily: d.daily, fuel: c('fuel'), tollPark: c('toll') + c('parking'), fareLodge: c('fare') + c('lodge'), meal: d.meal, total: d.total, noTime: d.noTime };
      (d.out ? p.out : p.in).push(row);
      tripMeal.set(`${d.staff}|${d.date}`, d.meal);
    });
    otDays(ots).forEach(o => {
      const p = P(o.staff);
      const left = Math.max(0, RULE.meal - (tripMeal.get(`${o.staff}|${o.date}`) || 0));
      const typed = o.rows.reduce((a, t) => a + num(t.meal), 0);
      const meal = Math.min(typed, left);
      p.ot.push({ date: o.date, where: o.rows.map(t => t.purpose).filter(Boolean).join(', '), time: o.rows.map(t => t.time).filter(Boolean).join(', '), min: o.min, meal, typed, capped: typed > meal, total: meal, ids: o.rows.map(t => t.id) });
    });
    const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');
    const list = [...people.values()].map(p => {
      p.in.sort(byDate); p.out.sort(byDate); p.ot.sort(byDate);
      p.inTotal = p.in.reduce((a, r) => a + r.total, 0); p.outTotal = p.out.reduce((a, r) => a + r.total, 0); p.otTotal = p.ot.reduce((a, r) => a + r.total, 0);
      p.total = p.inTotal + p.outTotal + p.otTotal;
      return p;
    });
    const order = S.staff().map(x => x.name);
    list.sort((a, b) => ((order.indexOf(a.name) + 1) || 99) - ((order.indexOf(b.name) + 1) || 99));
    const sum = k => list.reduce((a, p) => a + p[k], 0);
    return { month, people: list, inTotal: sum('inTotal'), outTotal: sum('outTotal'), otTotal: sum('otTotal'), total: sum('total') };
  }
  const PART = { in: '관내 출장', out: '관외 출장', ot: '특근 (식비)', all: '전체 정산' };
  /** 정산 판: 월 전체 합계 + 사람마다 관내·관외·특근 금액과 인쇄 버튼 */
  function settlePanel(month) {
    const st = settle(month);
    if (!st.people.length) return '';
    const cell = (rows, total) => rows.length ? `<b class="num">${won(total)}원</b><small>${rows.length}일</small>` : '<span class="sub">-</span>';
    const pbtn = (name, part, n) => `<button class="btn btn-sm" type="button" data-act="tv-print-part" data-staff="${e(name)}" data-part="${part}" ${n ? '' : 'disabled'}>${PART[part].replace(' (식비)', '')}</button>`;
    return `<div class="tv-settle">
      <div class="tv-settle-head"><h3>📋 ${V.monthLabel(month)} 현장중심센터 여비 정산</h3><span class="tv-settle-total">전 직원 합계 <b class="num">${won(st.total)}원</b></span></div>
      <div class="table-wrap"><table class="tbl tv-settle-tbl"><thead><tr><th>담당자</th><th>관내 출장<small>(화성시 안)</small></th><th>관외 출장<small>(화성시 밖)</small></th><th>특근 식비</th><th class="tot">정산 받을 금액</th><th>인쇄</th></tr></thead><tbody>
        ${st.people.map(p => `<tr><th>${e(p.name)}</th><td>${cell(p.in, p.inTotal)}</td><td>${cell(p.out, p.outTotal)}</td><td>${cell(p.ot, p.otTotal)}${p.ot.some(r => r.capped) ? '<small class="tv-over">하루 2만원까지만</small>' : ''}</td><td class="tot"><b class="num">${won(p.total)}원</b></td>
          <td class="nowrap">${pbtn(p.name, 'in', p.in.length)}${pbtn(p.name, 'out', p.out.length)}${pbtn(p.name, 'ot', p.ot.length)}<button class="btn btn-sm btn-primary" type="button" data-act="tv-print-part" data-staff="${e(p.name)}" data-part="all">전체</button></td></tr>`).join('')}
        <tr class="tot"><th>전 직원 합계</th><td><b class="num">${won(st.inTotal)}원</b></td><td><b class="num">${won(st.outTotal)}원</b></td><td><b class="num">${won(st.otTotal)}원</b></td><td class="tot"><b class="num">${won(st.total)}원</b></td>
          <td class="nowrap"><button class="btn btn-sm" type="button" data-act="tv-print-sum">전체 요약 인쇄</button><button class="btn btn-sm btn-primary" type="button" data-act="tv-print-all">전원 정산서 인쇄</button></td></tr>
      </tbody></table></div>
      <p class="sub" style="margin:4px 0 0">관내: 4시간 미만 5천원 · 4시간 이상 1만원(기관차량·자차 같음) + 유류비·통행료·주차료 / 관외: 일비 2만원 + 운임·숙박비 / 하루에 관내·관외를 같이 가면 관외 / 식비는 출장·특근 합쳐 한 사람 하루 최대 2만원. 특근 식비는 특근 명령부의 식비 칸에서 적어요.</p>
    </div>`;
  }
  /** 정산서 한 장: part = in | out | ot | all */
  function settleDoc(month, name, part, scale = 1) {
    const p = settle(month).people.find(x => x.name === name) || { name, in: [], out: [], ot: [], inTotal: 0, outTotal: 0, otTotal: 0, total: 0 };
    const parts = part === 'all' ? ['in', 'out', 'ot'] : [part];
    const rowsOf = k => p[k];
    const nRows = parts.reduce((a, k) => a + Math.max(3, rowsOf(k).length) + 2, 0);
    const rowMm = +(Math.min(9, 190 / Math.max(14, nRows)) * scale).toFixed(2);
    const fs = +((rowMm >= 8 ? 10 : rowMm >= 6.5 ? 9 : 8) * Math.min(1, scale + 0.08)).toFixed(2);
    const COLS = { in: [['날짜', 9], ['출장지', 25], ['출장시간', 14], ['일비', 11], ['유류·통행·주차', 14], ['식비', 11], ['합계', 16]], out: [['날짜', 9], ['출장지', 25], ['출장시간', 14], ['일비', 11], ['운임·숙박', 14], ['식비', 11], ['합계', 16]], ot: [['날짜', 9], ['특근 업무', 36], ['특근시간', 17], ['식비', 18], ['합계', 20]] };
    const sec = k => {
      const rows = rowsOf(k), cols = COLS[k];
      const body = rows.map(r => `<tr style="height:${rowMm}mm"><td>${U.md(r.date)}</td><td class="l">${e(r.where)}</td><td>${e(r.time)}</td>${k === 'ot' ? `<td class="r">${won(r.meal)}${r.capped ? '*' : ''}</td>` : `<td class="r">${won(r.daily)}</td><td class="r">${won(k === 'in' ? r.fuel + r.tollPark : r.fareLodge + r.fuel + r.tollPark)}</td><td class="r">${won(r.meal)}</td>`}<td class="r"><b>${won(r.total)}</b></td></tr>`);
      while (body.length < 3) body.push(`<tr style="height:${rowMm}mm">${cols.map(() => '<td>&nbsp;</td>').join('')}</tr>`);
      return `<h2 class="tv-doc-sec">${PART[k]}</h2><table class="doc-tbl order-tbl" style="font-size:${fs}pt"><colgroup>${cols.map(([, w]) => `<col style="width:${w}%">`).join('')}</colgroup>
        <thead><tr>${cols.map(([h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body.join('')}
        <tr class="tv-doc-total"><th colspan="${cols.length - 1}">${PART[k]} 소계 (${rows.length}일)</th><th class="r">${won(p[k + 'Total'])}</th></tr></tbody></table>`;
    };
    const total = parts.reduce((a, k) => a + p[k + 'Total'], 0);
    const sign = '<table class="sign"><tr><th rowspan="2" class="sign-side">결<br>재</th><th>담 당</th><th>팀 장</th></tr><tr><td></td><td></td></tr></table>';
    return `<article class="doc order-doc tv-settle-doc" style="font-size:${fs}pt">
      <div class="order-head">${sign}</div>
      <h1>${part === 'all' ? '여비 정산서' : `${PART[part]} 정산서`}</h1>
      <p class="order-sub">${V.monthLabel(month)} · 화성시아르딤복지관 직업지원팀 (현장중심직업재활센터) · <b>${e(name)}</b></p>
      ${parts.map(sec).join('')}
      <table class="doc-tbl tv-grand"><tr><th>정산 받을 금액${part === 'all' ? ' (관내 + 관외 + 특근)' : ''}</th><td class="r"><b>${won(total)}원</b></td></tr></table>
      <p class="order-sub tv-doc-note">관내 일비 4시간 미만 5천원·이상 1만원(기관차량·자차 같음), 관외 일비 2만원, 하루에 관내·관외를 같이 가면 관외. 식비는 출장·특근 합쳐 1인 1일 2만원 이내${p.ot.some(r => r.capped) ? ' (*표시: 상한 적용)' : ''}. 유류비·통행료·주차료·운임·숙박비는 영수증 첨부.</p>
    </article>`;
  }
  /** 전 직원 월 합계 한 장 */
  function settleSumDoc(month) {
    const st = settle(month);
    return `<article class="doc order-doc" style="font-size:10pt">
      <div class="order-head"><table class="sign"><tr><th rowspan="2" class="sign-side">결<br>재</th><th>담 당</th><th>팀 장</th></tr><tr><td></td><td></td></tr></table></div>
      <h1>여비 정산 총괄표</h1>
      <p class="order-sub">${V.monthLabel(month)} · 화성시아르딤복지관 직업지원팀 (현장중심직업재활센터)</p>
      <table class="doc-tbl order-tbl"><colgroup><col style="width:16%"><col style="width:10%"><col style="width:14%"><col style="width:10%"><col style="width:14%"><col style="width:10%"><col style="width:12%"><col style="width:14%"></colgroup>
        <thead><tr><th>담당자</th><th>관내 일수</th><th>관내 금액</th><th>관외 일수</th><th>관외 금액</th><th>특근 일수</th><th>특근 식비</th><th>정산 금액</th></tr></thead><tbody>
        ${st.people.map(p => `<tr style="height:10mm"><td><b>${e(p.name)}</b></td><td>${p.in.length}</td><td class="r">${won(p.inTotal)}</td><td>${p.out.length}</td><td class="r">${won(p.outTotal)}</td><td>${p.ot.length}</td><td class="r">${won(p.otTotal)}</td><td class="r"><b>${won(p.total)}</b></td></tr>`).join('')}
        <tr class="tv-doc-total" style="height:11mm"><th>합계</th><th></th><th class="r">${won(st.inTotal)}</th><th></th><th class="r">${won(st.outTotal)}</th><th></th><th class="r">${won(st.otTotal)}</th><th class="r">${won(st.total)}원</th></tr>
      </tbody></table>
      <p class="order-sub tv-doc-note">관내 일비 4시간 미만 5천원·이상 1만원(기관차량·자차 같음) + 유류비·통행료·주차료 / 관외 일비 2만원 + 운임·숙박비 / 식비 1인 1일 2만원 이내(출장·특근 합산).</p>
    </article>`;
  }
  const monthTrips = month => S.get().trips.filter(t => t.kind === '출장' && (t.date || '').startsWith(month));

  /* ---------- 화면 ---------- */
  function page(month) {
    const list = monthTrips(month);
    const ds = days(list);
    const st = settings();
    const admin = S.isAdmin();
    const staffs = [...new Set(ds.map(d => d.staff))];
    const inp = (t, k, ph = '', w = 78, type = 'text') => `<input class="input sm tv-in" style="width:${w}px" data-chg="trip-field" data-id="${t.id}" data-field="${k}" value="${e(t[k] ?? '')}" placeholder="${ph}" ${type === 'num' ? 'inputmode="numeric"' : ''}>`;
    const sel = (t, k, list, auto) => `<select class="select sm tv-in" data-chg="trip-field" data-id="${t.id}" data-field="${k}"><option value="">자동(${auto})</option>${list.map(v => `<option ${t[k] === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    const staffTotal = s => ds.filter(d => d.staff === s).reduce((a, d) => a + d.total, 0);
    const warn = ds.filter(d => d.noTime).length;
    const fuelNeed = ds.reduce((n, d) => n + d.rows.filter(r => r.c.need.length).length, 0);
    return `<section class="panel">
      ${settlePanel(month)}
      <div class="panel-pad tv-top">
        <details class="tv-rule"><summary><b>여비 지급 기준</b> <span class="sub">규정집 2026 · 누르면 펼쳐져요</span></summary>
          <div class="tv-rule-body">
            <table class="tbl tv-rule-tbl"><thead><tr><th>구분</th><th>일비</th></tr></thead>
              <tbody><tr><td>근무지 내 (화성시 안) 4시간 미만</td><td>${won(RULE.daily.short.car)}원</td></tr><tr><td>근무지 내 4시간 이상</td><td>${won(RULE.daily.long.car)}원</td></tr><tr><td>근무지 외 (화성시 밖)</td><td>${won(RULE.outDaily)}원</td></tr><tr><td>식비 (출장·특근 합쳐 1인 1일)</td><td>최대 ${won(RULE.meal)}원</td></tr></tbody></table>
            <ul class="sub">
              <li><b>근무지 내(화성시 안)</b>: 일비 + 유류비(출장거리 × 유가 ÷ 연비, 개인 차량일 때) + 통행료 + 주차료(영수증)</li>
              <li><b>근무지 외</b>: 운임(실비) + 숙박비(1박 상한 특별시 7만 · 광역시 6만 · 그 외 5만원) + 식비(1일 2만원 이내) + 일비(1일 2만원 이내)</li>
              <li>하루에 여러 번 나가면 <b>출장시간을 모두 더해</b> 계산하고, 1일 기준 금액을 넘지 않아요. 하루에 관내·관외를 같이 가면 <b>관외 기준</b>으로 줘요.</li>
              <li>관내 일비는 <b>기관차량·자차 상관없이</b> 4시간 미만 5천원, 4시간 이상 1만원이에요. 자차는 유류비를 따로 더해요.</li>
              <li>식비는 출장 식비와 특근 식비를 합쳐 <b>한 사람 하루 최대 2만원</b>이에요.</li>
            </ul>
          </div>
        </details>
        <div class="tv-set">
          <span class="sub">개인 차량 유류비 기본값</span>
          <label>연비 <input class="input sm" style="width:64px" id="tvEff" value="${e(st.fuelEff || '')}" placeholder="km/L" inputmode="decimal" ${admin ? '' : 'disabled'}> km/L</label>
          <label>유가 <input class="input sm" style="width:76px" id="tvPrice" value="${e(st.fuelPrice || '')}" placeholder="원/L" inputmode="numeric" ${admin ? '' : 'disabled'}> 원/L</label>
          ${admin ? '<button class="btn btn-sm" type="button" data-act="tv-save-set">저장</button>' : '<span class="sub">(관리자가 정해요 · 줄마다 따로 적을 수 있어요)</span>'}
          <span class="grow"></span>
          <button class="btn btn-sm" type="button" data-act="tv-road" ${list.length ? '' : 'disabled'}>🚗 개인 차량 거리 도로로 채우기</button>
          <button class="btn btn-sm" type="button" data-act="tv-copy" ${list.length ? '' : 'disabled'}>${V.I.copy}표 복사</button>
          <button class="btn btn-sm btn-primary" type="button" data-act="tv-print" ${list.length ? '' : 'disabled'}>여비 명세 인쇄</button>
        </div>
        ${warn || fuelNeed ? `<p class="tv-warn">${warn ? `⏰ 출장시간이 없는 날 <b>${warn}</b>일은 4시간 미만으로 계산했어요. 시간 칸에 <b>9~12시</b>처럼 적어 주세요. ` : ''}${fuelNeed ? `⛽ 개인 차량 <b>${fuelNeed}</b>건은 거리·유가·연비가 모자라 유류비가 0원이에요.` : ''}</p>` : ''}
      </div>
      ${list.length ? `<h3 class="tv-detail-h">출장 날짜별 계산 <span class="sub">시간·방법·영수증 금액을 여기서 고치면 위 정산에 바로 반영돼요</span></h3>
      <div class="table-wrap"><table class="tbl tv-tbl"><thead><tr>
        <th>날짜·성명</th><th>출장지</th><th>출장시간</th><th>방법 · 구분</th><th>유류비 계산<small>개인 차량</small></th><th>통행료 · 주차료</th><th>관외 비용<small>운임·숙박·식비</small></th>
        <th class="tv-c">유류비</th><th class="tv-c">일비<small>(하루)</small></th><th class="tv-c">하루 합계</th></tr></thead><tbody>
        ${ds.map(d => d.rows.map((r, i) => { const { t, c } = r; const n = d.rows.length; const lab = (l, h) => `<label class="tv-f"><span>${l}</span>${h}</label>`; return `<tr class="${i === 0 ? 'tv-day' : ''}">
          ${i === 0 ? `<td rowspan="${n}" class="nowrap"><b>${U.md(d.date)}</b><div class="sub">${e(d.staff)}</div></td>` : ''}
          <td class="tv-place">${e(t.place || '')}</td>
          <td>${inp(t, 'time', '9~12시', 84)}${r.min ? `<div class="sub tv-h">${hm(r.min)}</div>` : ''}</td>
          <td><div class="tv-stack"><select class="select sm tv-in" data-chg="trip-field" data-id="${t.id}" data-field="method">${[...new Set([...D.TRIP_METHODS, t.method].filter(Boolean))].map(m => `<option ${t.method === m ? 'selected' : ''}>${e(m)}</option>`).join('')}</select>${sel(t, 'zone', ['관내', '관외'], zoneOf({ ...t, zone: '' }))}</div></td>
          <td>${ownCar(t) ? `<div class="tv-stack">${lab('왕복', inp(t, 'km', c.km ? `${c.km}${c.est ? ' 어림' : ''}` : 'km', 70, 'num'))}${lab('유가', inp(t, 'fuelPrice', priceOf(t) ? String(priceOf(t)) : '원/L', 70, 'num'))}${lab('연비', inp(t, 'fuelEff', effOf(t) ? String(effOf(t)) : 'km/L', 70, 'num'))}</div>` : '<span class="sub">-</span>'}</td>
          <td><div class="tv-stack">${lab('통행', inp(t, 'toll', '0', 70, 'num'))}${lab('주차', inp(t, 'parking', '0', 70, 'num'))}</div></td>
          <td>${c.zone === '관외' ? `<div class="tv-stack">${lab('운임', inp(t, 'fare', '0', 76, 'num'))}${lab('숙박', inp(t, 'lodging', '0', 76, 'num'))}${lab('지역', sel(t, 'lodgeRegion', LODGE_REGIONS, regionOf({ ...t, lodgeRegion: '' })))}${c.lodgeOver ? `<div class="tv-over">숙박 상한 ${won(c.lodgeCap)}원까지</div>` : ''}${lab('식비', inp(t, 'meal', i === 0 && d.out ? won(RULE.meal) : '0', 76, 'num'))}</div>` : `<div class="tv-stack">${lab('식비', inp(t, 'meal', '0', 76, 'num'))}</div>`}</td>
          <td class="tv-c num">${c.fuel ? won(c.fuel) : ownCar(t) && c.need.length ? `<span class="tv-over">${c.need.join('·')}<br>필요</span>` : '-'}</td>
          ${i === 0 ? `<td rowspan="${n}" class="tv-c"><b class="num">${won(d.daily)}</b><div class="sub tv-h">${e(d.why)}</div>${d.meal ? `<div class="sub tv-h">식비 ${won(d.meal)}</div>` : ''}</td><td rowspan="${n}" class="tv-c tv-total num">${won(d.total)}</td>` : ''}
        </tr>`; }).join('')).join('')}
      </tbody></table></div>`
      : `<div class="empty"><strong>이 달 관내출장 기록이 없습니다</strong>관내출장 명령부에 출장을 넣으면 여기서 여비가 계산돼요.</div>`}
      <p class="sub perf-help">출장지·날짜·성명은 <b>관내출장 명령부</b>에서 고치고, 여기서는 시간·방법과 영수증 금액만 적으면 돼요. 구분(관내/관외)과 거리는 자동으로 잡고, 필요하면 직접 바꿀 수 있어요. 금액은 원 단위 숫자만 적으세요.</p>
    </section>`;
  }

  /** 한글·엑셀에 붙여 넣을 표 */
  function tsv(month) {
    const head = ['날짜', '성명', '출장지', '출장시간', '방법', '구분', '왕복km', '유류비', '통행료', '주차료', '운임', '숙박비', '식비', '일비', '하루합계'];
    const lines = [head];
    days(monthTrips(month)).forEach(d => d.rows.forEach((r, i) => lines.push([U.md(d.date), d.staff, r.t.place || '', r.t.time || '', r.t.method || '', r.c.zone, r.c.km || '', r.c.fuel, r.c.toll, r.c.parking, r.c.fare, r.c.lodge, i ? '' : d.meal, i ? '' : d.daily, i ? '' : d.total])));
    return lines.map(l => l.map(v => String(v ?? '').replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
  }

  /** 담당자별 여비 지급 명세 (명령부와 같은 모양: 고정 칸 너비, 최소 줄 수, A4 한 장) */
  const COLS = [['출장일', 8], ['출장지', 18], ['출장시간', 10], ['구분', 6], ['일비', 9], ['유류비', 9], ['통행·주차', 10], ['운임·숙박', 10], ['식비', 9], ['합계', 11]];
  function doc(month, staff, scale = 1) {
    const ds = days(monthTrips(month)).filter(d => d.staff === staff);
    const rows = [];
    ds.forEach(d => d.rows.forEach((r, i) => rows.push([U.md(d.date), e(r.t.place || ''), e(r.t.time || ''), r.c.zone, i ? '' : won(d.daily), r.c.fuel ? won(r.c.fuel) : '', r.c.toll + r.c.parking ? won(r.c.toll + r.c.parking) : '', r.c.fare + r.c.lodge ? won(r.c.fare + r.c.lodge) : '', !i && d.meal ? won(d.meal) : '', i ? '' : won(d.total)])));
    const n = Math.max(14, rows.length);
    const rowMm = +(Math.min(12, 200 / n) * scale).toFixed(2);
    const fs = +((rowMm >= 10 ? 10 : rowMm >= 8.5 ? 9.5 : rowMm >= 7.5 ? 8.5 : 8) * Math.min(1, scale + 0.08)).toFixed(2);
    while (rows.length < n) rows.push(COLS.map(() => '&nbsp;'));
    const total = ds.reduce((a, d) => a + d.total, 0);
    const sign = '<table class="sign"><tr><th rowspan="2" class="sign-side">결<br>재</th><th>담 당</th><th>팀 장</th></tr><tr><td></td><td></td></tr></table>';
    return `<article class="doc order-doc" style="font-size:${fs}pt">
      <div class="order-head">${sign}</div>
      <h1>출장 여비 지급 명세</h1>
      <p class="order-sub">${V.monthLabel(month)} · 화성시아르딤복지관 직업지원팀 · <b>출장자: ${e(staff)}</b></p>
      <table class="doc-tbl order-tbl" style="font-size:${fs}pt"><colgroup>${COLS.map(([, w]) => `<col style="width:${w}%">`).join('')}</colgroup>
        <thead><tr>${COLS.map(([h]) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr style="height:${rowMm}mm">${r.map((v, i) => `<td${i === 1 ? ' class="l"' : i >= 4 ? ' class="r"' : ''}>${v}</td>`).join('')}</tr>`).join('')}
          <tr class="tv-doc-total"><th colspan="9">합 계 (${ds.length}일)</th><th class="r">${won(total)}</th></tr></tbody></table>
      <p class="order-sub tv-doc-note">근무지 내 일비: 4시간 이상 차량배치 유 1만원·무 2만원 / 4시간 미만 유 5천원·무 1만원. 유류비 = 출장거리 × 유가 ÷ 연비. 통행료·주차료·운임·숙박비는 영수증 첨부.</p>
    </article>`;
  }
  const staffOf = month => [...new Set(days(monthTrips(month)).map(d => d.staff))];

  return { RULE, settle, settleDoc, settleSumDoc, PART, otDays, minutesOf, zoneOf, regionOf, rowCost, days, page, tsv, doc, staffOf, monthTrips, placeOf, homeOf, ownCar };
})();
