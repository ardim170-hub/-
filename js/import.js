/* 파일로 사업체 여러 곳 등록: 엑셀·CSV의 열 이름을 알아서 맞춘 뒤 미리보기에서 확인하고 등록한다 */
window.IMP = (() => {
  const e = U.esc;
  // 앞쪽일수록 먼저 짝을 찾는다 ('담당자 연락처'가 '담당자'나 '연락처'보다 먼저)
  const FIELDS = [
    ['contactPhone', '담당자 연락처', ['담당자연락처', '담당자전화', '담당자휴대폰', '휴대폰', '핸드폰', '휴대전화']],
    ['contact', '담당자', ['담당자', '담당자명', '인사담당자']],
    ['name', '사업체명', ['사업체명', '업체명', '회사명', '상호', '기업명', '사업장명', '사업체', '업체', '회사', '상호명']],
    ['address', '주소', ['주소', '소재지', '사업장주소', '도로명주소', '지번주소', '사업장소재지']],
    ['industry', '업종', ['업종', '업태', '종목', '산업', '업종명']],
    ['phone', '대표 전화', ['대표전화', '전화번호', '전화', '연락처', '대표번호']],
    ['ceo', '대표자', ['대표자', '대표자명', '대표']],
    ['bizNo', '사업자등록번호', ['사업자등록번호', '사업자번호', '등록번호']],
    ['employees', '상시근로자 수', ['상시근로자수', '상시근로자', '근로자수', '직원수', '종업원수', '인원', '근로자']],
    ['jobs', '가능 직무', ['모집직종', '모집분야', '직무', '직종', '업무']],
    ['homepage', '홈페이지', ['홈페이지', '웹사이트', 'url']],
    ['discoveredAt', '발굴일', ['발굴일', '등록일', '날짜', '일자', '조사일']],
    ['memo', '메모', ['비고', '메모', '특이사항', '참고']],
  ];
  const SHOW = ['name', 'address', 'industry', 'phone', 'ceo', 'bizNo', 'employees', 'jobs', 'homepage', 'discoveredAt', 'memo', 'contact', 'contactPhone'];
  const nh = h => String(h ?? '').toLowerCase().replace(/[\s()\[\]·._-]/g, '');

  function guessMap(headers) {
    const map = {};
    const used = new Set();
    const norm = headers.map(nh);
    for (const pass of ['exact', 'part']) {
      for (const [key, , syn] of FIELDS) {
        if (map[key] != null) continue;
        const i = norm.findIndex((h, j) => !used.has(j) && h && syn.some(s => (pass === 'exact' ? h === s : h.includes(s))));
        if (i >= 0) { map[key] = i; used.add(i); }
      }
    }
    return map;
  }

  async function readTable(file) {
    const buf = await file.arrayBuffer();
    let wb;
    if (/\.csv$/i.test(file.name)) {
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { text = new TextDecoder('euc-kr').decode(buf); }
      wb = XLSX.read(text, { type: 'string', raw: true });
    } else {
      wb = XLSX.read(buf, { type: 'array', cellDates: true });
    }
    const ws = wb.Sheets[wb.SheetNames[0]];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
    // 제목 줄이 위에 있는 공문서 양식도 있으므로, 알아볼 수 있는 열 이름이 2개 이상인 첫 줄을 머리글로 본다
    let hi = 0;
    for (let i = 0; i < Math.min(grid.length, 15); i++) {
      if (Object.keys(guessMap(grid[i])).length >= 2) { hi = i; break; }
    }
    const headers = (grid[hi] || []).map(h => String(h).trim());
    const rows = grid.slice(hi + 1).filter(r => r.some(v => String(v).trim() !== ''));
    return { headers, rows, sheet: wb.SheetNames[0] };
  }

  /** 미리보기 상태 */
  async function start(file) {
    const t = await readTable(file);
    if (!t.headers.length || !t.rows.length) throw new Error('표를 찾지 못했습니다');
    return { fileName: file.name, ...t, map: guessMap(t.headers), staff: S.me(), stage: '발굴', date: U.today(), includeDup: false };
  }

  function records(st) {
    const existing = new Set(S.get().businesses.map(b => U.norm(b.name).replace(/^\(주\)|주식회사/g, '')));
    const seen = new Set();
    const cell = (r, k) => (st.map[k] != null ? String(r[st.map[k]] ?? '').trim() : '');
    return st.rows.map(r => {
      const name = cell(r, 'name');
      const key = U.norm(name).replace(/^\(주\)|주식회사/g, '');
      const dup = !name ? false : existing.has(key) || seen.has(key);
      if (name) seen.add(key);
      return {
        name, dup,
        address: cell(r, 'address'), industry: cell(r, 'industry'), phone: cell(r, 'phone'), ceo: cell(r, 'ceo'), bizNo: cell(r, 'bizNo'),
        employees: Number(String(cell(r, 'employees')).replace(/[^0-9]/g, '')) || 0, jobs: cell(r, 'jobs'), homepage: cell(r, 'homepage'),
        memo: cell(r, 'memo'), discoveredAt: U.toDateStr(cell(r, 'discoveredAt')), contact: cell(r, 'contact'), contactPhone: cell(r, 'contactPhone'),
      };
    }).filter(x => x.name);
  }

  function html(st) {
    const recs = records(st);
    const add = recs.filter(r => st.includeDup || !r.dup);
    const dupN = recs.filter(r => r.dup).length;
    const colOpts = sel => `<option value="">(없음)</option>${st.headers.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${e(h || `${i + 1}번째 열`)}</option>`).join('')}`;
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">파일로 사업체 등록</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div>
        <div class="sub">${e(st.fileName)} · ${e(st.sheet)} 시트 · ${st.rows.length}줄</div></div>
      <div class="dr-body" id="bulkBody">
        <section class="dr-sec"><h3>열 맞추기</h3>
          <p class="sub" style="margin:0 0 8px">파일의 열 이름을 보고 자동으로 맞췄습니다. 틀린 곳만 고치세요. 사업체명은 꼭 필요합니다.</p>
          <div class="map-grid">${SHOW.map(k => FIELDS.find(f => f[0] === k)).map(([k, label]) => `<label>${label}${k === 'name' ? ' <span class="req">*</span>' : ''}<select class="select" data-bulk-map="${k}">${colOpts(st.map[k])}</select></label>`).join('')}</div>
        </section>
        <section class="dr-sec"><h3>등록 설정</h3>
          <div class="frow three">
            <div class="field"><label for="bulkStaff">담당 직원</label><select class="select" id="bulkStaff">${S.staff().map(s => `<option ${s.name === st.staff ? 'selected' : ''}>${e(s.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="bulkStage">진행 단계</label><select class="select" id="bulkStage">${D.STAGES.map(s => `<option ${s.key === st.stage ? 'selected' : ''}>${s.key}</option>`).join('')}</select></div>
            <div class="field"><label for="bulkDate">발굴일 (파일에 없을 때)</label><input class="input" type="date" id="bulkDate" value="${e(st.date)}"></div>
          </div>
          ${dupN ? `<label class="check" style="margin-top:8px"><input type="checkbox" id="bulkDup" ${st.includeDup ? 'checked' : ''}>이미 있는 이름 ${dupN}곳도 새로 등록</label>` : ''}
        </section>
        <section class="dr-sec"><h3>미리보기 <span class="sub num">${add.length}곳 등록 예정${dupN && !st.includeDup ? ` · 중복 ${dupN}곳 제외` : ''}</span></h3>
          <div class="table-wrap"><table class="tbl bulk-tbl"><thead><tr><th>사업체명</th><th>주소</th><th>업종</th><th>전화</th><th>담당자</th></tr></thead>
          <tbody>${recs.slice(0, 40).map(r => `<tr class="${r.dup && !st.includeDup ? 'dup' : ''}"><td><b>${e(r.name)}</b>${r.dup ? ' <span class="badge warn">이미 있음</span>' : ''}</td><td>${e(r.address)}${r.address && D.detectArea(r.address) ? ` <span class="sub">(${e(D.detectArea(r.address))})</span>` : ''}</td><td>${e(r.industry)}</td><td class="num">${e(r.phone)}</td><td>${e(r.contact)} <span class="num sub">${e(r.contactPhone)}</span></td></tr>`).join('')}</tbody></table></div>
          ${recs.length > 40 ? `<p class="sub">처음 40줄만 보여줍니다. 나머지 ${recs.length - 40}줄도 함께 등록됩니다.</p>` : ''}
        </section>
      </div>
      <div class="dr-foot"><button class="btn" type="button" data-act="dr-close">취소</button><button class="btn btn-primary" type="button" data-act="bulk-commit" ${add.length ? '' : 'disabled'}>${add.length}곳 등록</button></div>`;
  }

  function bind(st, rerender) {
    document.querySelectorAll('[data-bulk-map]').forEach(sel => sel.onchange = () => { const k = sel.dataset.bulkMap; if (sel.value === '') delete st.map[k]; else st.map[k] = +sel.value; rerender(); });
    const dup = document.getElementById('bulkDup');
    if (dup) dup.onchange = () => { st.includeDup = dup.checked; rerender(); };
    document.getElementById('bulkStaff').onchange = ev => { st.staff = ev.target.value; };
    document.getElementById('bulkStage').onchange = ev => { st.stage = ev.target.value; };
    document.getElementById('bulkDate').onchange = ev => { st.date = ev.target.value || U.today(); };
  }

  /** 등록하고, 대략 위치인 곳은 인터넷 주소 검색으로 조금씩 정확하게 바꾼다 */
  function commit(st) {
    const recs = records(st).filter(r => st.includeDup || !r.dup);
    const bizs = S.upsertMany('biz', recs.map(r => ({
      name: r.name, address: r.address, industry: r.industry, phone: r.phone, ceo: r.ceo, bizNo: r.bizNo, employees: r.employees, jobs: r.jobs, homepage: r.homepage,
      memo: r.memo, discoveredAt: r.discoveredAt || st.date, stage: st.stage, staff: st.staff, source: '파일 등록', placements: 0,
    })));
    S.upsertMany('act', bizs.map(b => ({ targetType: 'biz', targetId: b.id, date: b.discoveredAt, type: '발굴', content: `파일(${st.fileName})로 일괄 등록`, staff: st.staff })));
    const cards = recs.map((r, i) => (r.contact ? { name: r.contact, org: r.name, mobile: /^01/.test(r.contactPhone) ? r.contactPhone : '', phone: /^01/.test(r.contactPhone) ? '' : r.contactPhone, address: r.address, linkType: 'biz', linkId: bizs[i].id, tags: ['사업체 담당자'], metAt: bizs[i].discoveredAt, metWhere: '파일 등록', memo: '' } : null)).filter(Boolean);
    if (cards.length) S.upsertMany('card', cards);
    const queue = bizs.filter(b => b.address).slice(0, 60).map(b => b.id);
    (async () => { for (const id of queue) { await S.refine('biz', id); await new Promise(r => setTimeout(r, 1100)); } })();
    return { biz: bizs.length, cards: cards.length };
  }

  return { start, html, bind, commit };
})();
