/* 홍보·방문처: 행정복지센터·직업재활시설·장애인단체·특수학급 고등학교·특수학교·임대아파트 등
 * 엑셀(기관 목록)을 한 번에 넣고, 분류별로 몇 곳 중 몇 곳을 다녀왔는지 한눈에 보고, 방문을 바로 기록한다.
 * 데이터는 네트워크 기관(분류·주소·연락처·세부 정보)으로 저장해 지도·상세 화면에도 같이 나온다. */
window.OR = (() => {
  const e = U.esc;
  const ui = { cat: '', q: '', todo: false };
  const VISIT_TYPES = ['방문', '홍보', '미팅', '행사', '전화'];
  const clean = v => String(v ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const num = v => { const n = Number(String(v).replace(/[^0-9.]/g, '')); return String(v).trim() !== '' && !isNaN(n) ? n : null; };

  /* ---------- 엑셀 읽기 ---------- */
  /** 시트마다 모양을 보고 알맞게 읽는다. 돌려주는 것: [{ category, name, address, phone, note, area, info }] */
  function parse(buf) {
    const wb = XLSX.read(buf, { type: 'array' });
    const out = [];
    wb.SheetNames.forEach(sn => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }).map(r => r.map(clean));
      const hi = rows.findIndex(r => r.some(c => /^주\s?소$/.test(c)) && r.some(c => /명$|학교명|단지명/.test(c)));
      const head = hi >= 0 ? rows[hi] : [];
      const col = re => head.findIndex(c => re.test(c));
      if (head.some(c => c === '단지명')) return apartments(rows, hi, col, out);
      if (head.some(c => c === '학교명')) return schools(rows, hi, col, sn, out);
      if (rows.some(r => r.some(c => c === '유')) && rows.some(r => r.some(c => /특수학교/.test(c)))) return specialSchools(rows, out);
      if (hi >= 0) return grouped(rows, hi, col, sn, out);
    });
    // 같은 이름이 여러 곳이면 읍면동을 붙여 구분 (예: 화성시정신건강복지센터 (마도면))
    const cnt = {}; out.forEach(x => { cnt[x.name] = (cnt[x.name] || 0) + 1; });
    out.forEach(x => { if (cnt[x.name] > 1) { const a = D.detectArea(x.address); x.name = `${x.name} (${a || x.address.split(' ').slice(-2).join(' ')})`; } });
    // 다른 분류에 이미 쓴 전화번호가 또 나오면 잘못 복사한 번호일 수 있어 비우고 알려 준다
    const seen = new Map();
    out.forEach(x => {
      const d = x.phone.replace(/\D/g, '');
      if (d.length < 8) return;
      if (seen.has(d) && seen.get(d) !== x.category) { x.phoneWarn = x.phone; x.phone = ''; } else if (!seen.has(d)) seen.set(d, x.category);
    });
    return out;
  }
  /** 분류 칸(예: 행정복지센터·직업재활시설)이 왼쪽에 한 번만 적힌 목록 */
  function grouped(rows, hi, col, sn, out) {
    const nc = col(/명$/), ac = col(/^주\s?소$/), pc = col(/연락처|전화/), rc = col(/비고/);
    let group = '';
    rows.slice(hi + 1).forEach(r => {
      const g = r.slice(0, nc).find(c => c && !/^\d+$/.test(c));
      if (g) group = g;
      const name = r[nc];
      if (!name || name === '계') return;
      out.push({ category: group || sn, name, address: r[ac] || '', phone: r[pc] || '', note: rc >= 0 ? r[rc] : '', info: {} });
    });
  }
  function schools(rows, hi, col, sn, out) {
    const nc = col(/학교명/), ac = col(/^주\s?소$/), pc = col(/연락처/), rc = col(/비고/);
    const sc = col(/특수학급 학급/), tc = col(/순회학급 학급/), ss = col(/특수학급 학생/), ts = col(/순회학급 학생/), tot = col(/^계$/);
    rows.slice(hi + 1).forEach(r => {
      const name = r[nc];
      if (!name || r.some(c => c === '계') && !num(r[col(/^순$/)])) return;
      const info = {};
      if (num(r[sc])) info['특수학급'] = `${num(r[sc])}학급`;
      if (num(r[tc])) info['순회학급'] = `${num(r[tc])}학급`;
      const st = num(r[tot]) ?? ((num(r[ss]) || 0) + (num(r[ts]) || 0));
      if (st) info['학생'] = `${st}명`;
      out.push({ category: /고등/.test(sn) || /고등학교/.test(name) ? '특수학급 고등학교' : sn, name, address: r[ac] || '', phone: r[pc] || '', note: rc >= 0 ? r[rc] : '', info });
    });
  }
  /** 특수학교: 유·초·중·고 칸마다 학교 줄이 있고, 주소는 아래 '1. 성심학교: 주소 (☏전화)' 글에 있다 */
  function specialSchools(rows, out) {
    const GR = { '유': 1, '초': 6, '중': 3, '고': 3 };
    const base = n => n.replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
    const by = new Map();
    let level = '';
    rows.forEach(r => {
      const lv = r.find(c => GR[c]);
      if (lv && r.some(c => c === '학교명')) { level = lv; return; }
      const ni = r.findIndex(c => /학교/.test(c) && !/학교명|특수학교|[:<>*☏]|^\d+\./.test(c)); // 안내 글(* 고등학교: 1학급 당 7인, 1. 성심학교: 주소) 빼기
      if (!level || ni < 0) return;
      const name = r[ni], k = base(name);
      const x = by.get(k) || { name: k, kind: (name.match(/\((사립|공립)\)/) || [])[1] || '', levels: {} };
      let cls = 0, st = 0;
      for (let g = 0; g < GR[level]; g++) { cls += num(r[ni + 1 + g * 2]) || 0; st += num(r[ni + 2 + g * 2]) || 0; }
      if (cls || st) x.levels[level] = { cls, st };
      by.set(k, x);
    });
    // 주소·전화
    rows.flat().forEach(c => {
      const m = c.match(/^\d+\.\s*(.+?학교)\s*:\s*(.+?)\s*\(\s*☏?\s*([\d-]+)\s*\)/);
      if (!m) return;
      const x = by.get(base(m[1])) || { name: base(m[1]), kind: '', levels: {} };
      x.address = m[2]; x.phone = m[3]; by.set(base(m[1]), x);
    });
    by.forEach(x => {
      const info = {};
      if (x.kind) info['설립'] = x.kind;
      ['유', '초', '중', '고'].forEach(l => { if (x.levels[l]) info[`${l === '유' ? '유치' : l}부`] = `${x.levels[l].st}명`; });
      const all = Object.values(x.levels).reduce((a, v) => a + v.st, 0);
      if (all) info['학생'] = `${all}명`;
      out.push({ category: '특수학교', name: x.name, address: x.address || '', phone: x.phone || '', note: '', info });
    });
  }
  function apartments(rows, hi, col, out) {
    const nc = col(/단지명/), ac = col(/^주\s?소$/), pc = col(/전화/), rc = col(/비고/), tc = col(/유형/), hc = col(/세대수/), dc = col(/동수/), ec = col(/읍면동/);
    rows.slice(hi + 1).forEach(r => {
      const name = r[nc];
      if (!name) return;
      const info = {};
      if (r[tc]) info['유형'] = r[tc];
      if (num(r[hc])) info['세대'] = `${num(r[hc]).toLocaleString('ko-KR')}세대`;
      if (num(r[dc])) info['동'] = `${num(r[dc])}개 동`;
      out.push({ category: '임대아파트', name, address: r[ac] || '', phone: r[pc] || '', note: r[rc] || '', area: ec >= 0 ? r[ec] : '', info });
    });
  }

  /* ---------- 미리 보기 → 반영 ---------- */
  function plan(list) {
    const nets = S.get().networks, bizs = S.get().businesses;
    return list.map(x => {
      const k = U.orgKey(x.name);
      const ex = nets.find(n => U.orgKey(n.name) === k);
      const biz = !ex && bizs.find(b => U.orgKey(b.name) === k);
      return { ...x, match: ex ? ex.id : '', biz: biz ? biz.name : '', on: !biz };
    });
  }
  function previewHtml(st) {
    const fresh = st.rows.filter(r => r.on && !r.match).length, upd = st.rows.filter(r => r.on && r.match).length;
    const cats = [...new Set(st.rows.map(r => r.category))];
    const warn = st.rows.filter(r => r.phoneWarn);
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">홍보·방문처 가져오기</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div>
      <p class="sub" style="margin:0">${e(st.file)} · ${cats.map(c => `${e(c)} ${st.rows.filter(r => r.category === c).length}`).join(' · ')}</p></div>
      <div class="dr-body">
        <p class="sub">새로 <b>${fresh}곳</b>을 기관으로 등록하고, 이미 있는 <b>${upd}곳</b>은 분류·세부 정보·빈 칸을 채워요. 주소로 지도 위치를 차례로 찾아요.</p>
        ${warn.length ? `<p class="form-notice">⚠ 다른 분류와 전화번호가 같은 ${warn.length}곳은 잘못 복사된 번호 같아서 비워 두었어요: ${warn.slice(0, 6).map(r => `${e(r.name)}(${e(r.phoneWarn)})`).join(', ')}${warn.length > 6 ? ' …' : ''}</p>` : ''}
        <div class="table-wrap"><table class="tbl bulk-tbl"><thead><tr><th></th><th>분류</th><th>이름</th><th>주소</th><th>연락처</th><th>세부 정보</th></tr></thead><tbody>
        ${st.rows.map((r, i) => `<tr class="${r.on ? '' : 'dup'}"><td><input type="checkbox" data-act="or-pick" data-i="${i}" ${r.on ? 'checked' : ''} aria-label="넣기"></td><td class="nowrap">${e(r.category)}</td>
          <td><b>${e(r.name)}</b>${r.match ? ' <span class="badge">채움</span>' : r.biz ? `<div class="meta">사업체 '${e(r.biz)}'로 이미 있음</div>` : ' <span class="badge accent">새로</span>'}</td>
          <td class="clip">${e(r.address)}</td><td class="nowrap num">${e(r.phone)}</td><td class="wrap">${Object.entries(r.info).map(([k, v]) => `${e(k)} ${e(v)}`).join(' · ')}${r.note ? `<div class="meta">${e(r.note)}</div>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
      <div class="dr-foot"><button class="btn" type="button" data-act="dr-close">취소</button><button class="btn btn-primary" type="button" data-act="or-commit" ${fresh + upd ? '' : 'disabled'}>새로 ${fresh}곳 · 채움 ${upd}곳 넣기</button></div>`;
  }
  function commit(st) {
    const me = S.me(), today = U.today();
    const rows = st.rows.filter(r => r.on);
    const fresh = rows.filter(r => !r.match).map(r => ({ name: r.name, category: r.category, status: '보통', address: r.address, area: r.area || '', phone: r.phone, relation: '', promo: '', since: today, staff: me, memo: r.note || '', info: r.info }));
    const added = fresh.length ? S.upsertMany('net', fresh) : [];
    const patches = rows.filter(r => r.match).map(r => {
      const n = S.find('net', r.match) || {};
      return { id: r.match, category: r.category, info: { ...(n.info || {}), ...r.info }, ...(n.address ? {} : { address: r.address }), ...(n.phone ? {} : { phone: r.phone }), ...(r.note && !(n.memo || '').includes(r.note) ? { memo: [n.memo, r.note].filter(Boolean).join('\n') } : {}) };
    });
    if (patches.length) S.putMany('net', patches);
    // 주소로 지도 위치 찾기 (서버 부담을 줄이려고 1초에 한 곳씩)
    const queue = [...added, ...patches.map(p => S.find('net', p.id))].filter(n => n && n.address && (n.lat == null || n.approx)).map(n => n.id);
    (async () => { for (const id of queue) { await S.refine('net', id); await new Promise(r => setTimeout(r, 1100)); } })();
    return { added: added.length, filled: patches.length, locating: queue.length };
  }

  /* ---------- 화면 ---------- */
  const CAT_ORDER = ['행정복지센터', '직업재활시설', '장애인단체', '정신건강복지센터', '특수학급 고등학교', '특수학교', '임대아파트'];
  /** 홍보·방문처로 보는 기관: 엑셀로 넣은 분류 + 세부 정보가 있는 기관 */
  const isTarget = n => CAT_ORDER.includes(n.category) || (n.info && Object.keys(n.info).length);
  const visitsOf = n => S.actsOf('net', n.id).filter(a => VISIT_TYPES.includes(a.type));
  function page() {
    const nets = S.view().networks.filter(isTarget);
    const cats = [...new Set([...CAT_ORDER.filter(c => nets.some(n => n.category === c)), ...nets.map(n => n.category)])];
    const yr = U.today().slice(0, 4);
    const visitedThisYear = n => visitsOf(n).some(a => a.date.startsWith(yr));
    const cards = cats.map(c => {
      const list = nets.filter(n => n.category === c), done = list.filter(visitedThisYear).length, pct = list.length ? Math.round(done / list.length * 100) : 0;
      return `<button type="button" class="or-card ${ui.cat === c ? 'on' : ''}" data-act="or-cat" data-cat="${e(c)}"><span class="or-card-t">${e(c)}</span><b class="num">${list.length}<small>곳</small></b>
        <span class="or-bar"><i style="width:${pct}%"></i></span><span class="or-card-s">올해 방문 <b class="num">${done}</b>곳 · ${pct}%</span></button>`;
    }).join('');
    return `
      <div class="page-head"><div><h1 class="page-title">홍보·방문처</h1><div class="page-desc">행정복지센터·직업재활시설·장애인단체·특수학교·임대아파트 등 홍보하러 갈 곳을 분류별로 모아 보고, 다녀온 날을 바로 기록해요.</div></div>
        <div class="inline"><button class="btn btn-primary" type="button" data-act="or-file">기관 목록 엑셀 넣기</button><input type="file" id="orFile" accept=".xlsx,.xls" hidden><a class="btn" href="#/map">지도에서 보기</a></div></div>
      ${nets.length ? `<div class="or-cards"><button type="button" class="or-card ${!ui.cat ? 'on' : ''}" data-act="or-cat" data-cat=""><span class="or-card-t">전체</span><b class="num">${nets.length}<small>곳</small></b><span class="or-bar"><i style="width:${nets.length ? Math.round(nets.filter(visitedThisYear).length / nets.length * 100) : 0}%"></i></span><span class="or-card-s">올해 방문 <b class="num">${nets.filter(visitedThisYear).length}</b>곳</span></button>${cards}</div>
      <div class="toolbar"><input class="input" id="orQ" placeholder="이름·주소·읍면동으로 찾기" value="${e(ui.q)}" style="max-width:320px"><label class="check"><input type="checkbox" data-act="or-todo" ${ui.todo ? 'checked' : ''}>올해 아직 안 간 곳만</label></div>
      <div id="orList">${listHtml(nets)}</div>`
      : `<div class="panel"><div class="empty"><strong>아직 홍보·방문처가 없어요</strong>기관 목록 엑셀(행정복지센터·특수학급·특수학교·임대아파트 등)을 넣으면 분류별로 정리돼요.<div><button class="btn btn-primary" type="button" data-act="or-file">기관 목록 엑셀 넣기</button></div></div></div>`}`;
  }
  function listHtml(nets = S.view().networks.filter(isTarget)) {
    const yr = U.today().slice(0, 4);
    let list = nets.filter(n => (!ui.cat || n.category === ui.cat) && U.match(ui.q, n.name, n.address, n.area, n.category));
    if (ui.todo) list = list.filter(n => !visitsOf(n).some(a => a.date.startsWith(yr)));
    const cats = [...new Set([...CAT_ORDER, ...list.map(n => n.category)])].filter(c => list.some(n => n.category === c));
    if (!list.length) return '<div class="panel"><div class="empty">조건에 맞는 곳이 없어요.</div></div>';
    return cats.map(c => {
      const rows = list.filter(n => n.category === c).sort((a, b) => (a.area || '').localeCompare(b.area || '', 'ko') || a.name.localeCompare(b.name, 'ko'));
      return `<section class="panel or-sec"><div class="panel-pad or-sec-h"><h2 class="section-title">${e(c)} <span class="sub num">${rows.length}곳</span></h2></div>
        <div class="table-wrap"><table class="tbl or-tbl"><thead><tr><th>이름</th><th>읍면동</th><th>주소</th><th>연락처</th><th>세부 정보</th><th>최근 방문</th><th></th></tr></thead><tbody>
        ${rows.map(n => { const v = visitsOf(n)[0]; const thisYear = v && v.date.startsWith(yr); return `<tr class="${thisYear ? 'or-done' : ''}">
          <td><b class="link" data-act="open" data-kind="net" data-id="${n.id}">${e(n.name)}</b>${n.memo ? `<div class="meta">${e(n.memo.split('\n')[0])}</div>` : ''}</td>
          <td class="nowrap">${e(n.area || '')}</td><td class="clip" title="${e(n.address || '')}">${e(n.address || '')}</td>
          <td class="nowrap num">${n.phone ? `<a href="tel:${e(n.phone.replace(/[^0-9+]/g, ''))}">${e(n.phone)}</a>` : '<span class="sub">-</span>'}</td>
          <td>${Object.entries(n.info || {}).map(([k, val]) => `<span class="or-chip">${e(k)} <b>${e(val)}</b></span>`).join('')}</td>
          <td class="nowrap">${v ? `<b class="num">${U.dateDot(v.date)}</b><div class="meta">${e(v.type)}${v.staff ? ' · ' + e(v.staff) : ''}</div>` : '<span class="sub">아직 없음</span>'}</td>
          <td class="nowrap"><button class="btn btn-sm ${thisYear ? '' : 'btn-primary'}" type="button" data-act="or-visit" data-id="${n.id}">오늘 방문</button></td></tr>`; }).join('')}
        </tbody></table></div></section>`;
    }).join('');
  }
  function bind() {
    const q = document.getElementById('orQ');
    if (q) q.addEventListener('input', U.debounce(() => { ui.q = q.value.trim(); document.getElementById('orList').innerHTML = listHtml(); }, 150));
  }

  return { ui, parse, plan, previewHtml, commit, page, listHtml, bind, isTarget, CAT_ORDER };
})();
