/* 연락이력 · 방문 보고 · 출장/특근 명령부 · 개발대장
   복지관이 지금 쓰는 구글 시트·한글 서식과 같은 열 순서로 보여주고 복사할 수 있게 한다. */
window.R = (() => {
  const e = U.esc;
  const ui = {
    contacts: { month: U.today().slice(0, 7), tab: 'log', q: '' },
    orders: { month: U.today().slice(0, 7), kind: '출장', who: '' },
  };
  const CONTACT_TYPES = ['전화', '방문', '이메일', '미팅'];
  const md = d => { if (!U.isDate(d)) return d || ''; const x = U.parse(d); return `${x.getMonth() + 1}월 ${x.getDate()}일`; };
  const clean = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim();
  const tsv = rows => rows.map(r => r.map(clean).join('\t')).join('\n');
  const monthNav = (act, month) => `<div class="month-nav"><button class="icon-btn" type="button" data-act="${act}" data-d="-1" aria-label="이전 달">${V.I.back}</button><b class="num">${V.monthLabel(month)}</b><button class="icon-btn" type="button" data-act="${act}" data-d="1" aria-label="다음 달" style="transform:scaleX(-1)">${V.I.back}</button></div>`;
  const opts = (list, sel, blank) => (blank != null ? `<option value="">${e(blank)}</option>` : '') + list.map(v => `<option ${v === sel ? 'selected' : ''}>${e(v)}</option>`).join('');

  /* ================= 연락이력 ================= */
  const contactOf = b => { const c = S.cardsOf('biz', b.id)[0]; return c ? `${c.name}${c.title ? ' ' + c.title : ''}` : ''; };
  const phoneOf = b => b.phone || (S.cardsOf('biz', b.id)[0] || {}).phone || (S.cardsOf('biz', b.id)[0] || {}).mobile || '';
  /** 이 달 사업체 연락 기록 (전화·방문·이메일·미팅) */
  function contactRows(month) {
    return S.view().activities
      .filter(a => a.targetType === 'biz' && CONTACT_TYPES.includes(a.type) && a.date.startsWith(month))
      .map(a => ({ a, b: S.find('biz', a.targetId) })).filter(r => r.b)
      .sort((x, y) => x.a.date.localeCompare(y.a.date) || x.a.id.localeCompare(y.a.id));
  }
  function contactKpis(rows) {
    const visits = rows.filter(r => r.a.type === '방문');
    return {
      contacted: new Set(rows.map(r => r.b.id)).size,
      visits: visits.length,
      willing: new Set(rows.filter(r => r.a.result === '채용의향 있음').map(r => r.b.id)).size,
      recall: rows.filter(r => r.a.status === '재연락').length,
      perf: visits.filter(r => /실적/.test(r.a.procedure || '')).length,
    };
  }

  function contactsPage() {
    const f = ui.contacts;
    const names = S.get().businesses.map(b => b.name);
    return `
      <div class="page-head">
        <div><h1 class="page-title">연락이력</h1><div class="page-desc">사업체 연락·방문을 한 줄씩 기록하고, 공유 시트의 연락이력·보고용 시트 모양 그대로 복사합니다.</div></div>
        <div class="inline"><button class="btn" type="button" data-act="ct-paste">시트에서 붙여넣어 가져오기</button></div>
      </div>
      <div class="toolbar perf-bar">${monthNav('ct-month', f.month)}
        <div class="chips"><button type="button" class="chip ${f.tab === 'log' ? 'on' : ''}" data-act="ct-tab" data-tab="log">연락이력</button><button type="button" class="chip ${f.tab === 'report' ? 'on' : ''}" data-act="ct-tab" data-tab="report">보고용 (방문 사업체)</button></div>
      </div>
      <section class="panel panel-pad perf-input">
        <h2 class="section-title">연락 기록 추가 <span class="sub">처음 보는 사업체명은 사업체 개발에 자동으로 등록됩니다</span></h2>
        <form class="perf-form" data-form="ct-add" autocomplete="off">
          <label>날짜<input class="input" type="date" name="date" value="${f.month === U.today().slice(0, 7) ? U.today() : f.month + '-01'}" required></label>
          <label>방식<select class="select" name="type">${opts(CONTACT_TYPES, '전화')}</select></label>
          <label class="grow">사업체명<input class="input" name="name" list="ctBizList" required placeholder="예: (주)한결테크"></label>
          <label>전화번호<input class="input" name="phone" inputmode="tel"></label>
          <label>담당자<input class="input" name="contactName" placeholder="예: 김재윤 부장"></label>
          <label>직종<input class="input" name="jobType" placeholder="예: 단순 제조 종사원"></label>
          <label class="grow">결과<input class="input" name="content" required placeholder="예: 전화 안받음 / 장애인 채용 안함"></label>
          <label>연락결과<select class="select" name="result">${opts(D.CONTACT_RESULTS, '', '선택')}</select></label>
          <label>상태<select class="select" name="status">${opts(D.CONTACT_STATUS, '연락완료')}</select></label>
          <label class="grow">주소 <span class="sub">(새 사업체일 때)</span><input class="input" name="address"></label>
          <label class="grow">구인공고 주소 <span class="sub">(고용24·알바몬·알바천국·사람인·잡코리아 등, 사이트 주소만)</span><input class="input" name="jobUrl" inputmode="url" autocomplete="off" placeholder="https://www.albamon.com/..."></label>
          <button class="btn btn-primary" type="submit">추가</button>
          <datalist id="ctBizList">${names.map(n => `<option value="${e(n)}">`).join('')}</datalist>
        </form>
      </section>
      <div id="ctResults"></div>`;
  }

  function contactsResults() {
    const f = ui.contacts;
    const rows = contactRows(f.month);
    const k = contactKpis(rows);
    const kpi = `<section class="panel perf-sum report-kpi">
      <div><span class="l">총 사업체 연락 수</span><b class="num">${k.contacted}</b><span class="sub">곳</span></div>
      <div><span class="l">총 방문</span><b class="num">${k.visits}</b><span class="sub">회</span></div>
      <div><span class="l">채용의향 있음</span><b class="num">${k.willing}</b><span class="sub">곳</span></div>
      <div><span class="l">실적 (절차: 실적입력)</span><b class="num">${k.perf}</b><span class="sub">곳</span></div>
      <div><span class="l">재연락 필요</span><b class="num">${k.recall}</b><span class="sub">건</span></div></section>`;
    if (f.tab === 'report') {
      const visits = rows.filter(r => r.a.type === '방문');
      return kpi + `<section class="panel">
        <div class="panel-pad perf-actions"><h2 class="section-title">방문 사업체 <span class="sub num">${visits.length}건</span></h2>
          <button class="btn btn-primary" type="button" data-act="ct-copy-report" ${visits.length ? '' : 'disabled'}>${V.I.copy}보고용 시트용 복사</button></div>
        <p class="sub perf-help">보고용 시트의 <b>방문 사업체 수</b> 표에서 <b>날짜</b> 칸을 누르고 Ctrl+V 하세요. (날짜 · 업체명 · 주소 · 연락처/담당자 · 결과 · 현장훈련 유/무 · 절차)</p>
        ${visits.length ? `<div class="table-wrap"><table class="tbl perf-tbl"><thead><tr><th>날짜</th><th>업체명</th><th>주소</th><th>연락처/담당자</th><th>결과</th><th>현장훈련 유/무</th><th>절차</th></tr></thead><tbody>
          ${visits.map(({ a, b }) => `<tr><td class="num">${U.dateDot(a.date)}</td><td><b class="link" data-act="open" data-kind="biz" data-id="${b.id}">${e(b.name)}</b></td><td class="clip" title="${e(b.address)}">${e(b.address || '')}</td>
            <td>${e(phoneOf(b))}<div class="meta">${e(a.contactName || contactOf(b))}</div></td><td class="wrap">${e(a.content)}</td>
            <td><select class="select sm" data-chg="act-field" data-id="${a.id}" data-field="training">${opts(['유', '무'], a.training, '-')}</select></td>
            <td><select class="select sm" data-chg="act-field" data-id="${a.id}" data-field="procedure">${opts(D.PROCEDURES, a.procedure, '-')}</select></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="empty"><strong>${V.monthLabel(f.month)}에 방문 기록이 없습니다</strong>방식을 '방문'으로 골라 기록하면 여기에 나옵니다.</div>`}
      </section>`;
    }
    return kpi + `<section class="panel">
      <div class="panel-pad perf-actions"><h2 class="section-title">${V.monthLabel(f.month)} 연락이력 <span class="sub num">${rows.length}건</span></h2>
        <button class="btn btn-primary" type="button" data-act="ct-copy" ${rows.length ? '' : 'disabled'}>${V.I.copy}연락이력 시트용 복사</button></div>
      <p class="sub perf-help">공유 시트 <b>○월 연락이력</b> 탭에서 새 줄의 <b>날짜</b> 칸을 누르고 Ctrl+V 하세요. (날짜 · 사업체명 · 주소 · 전화번호 · 담당자 · 직종 · 결과 · 연락결과 · 상태 · 상담자)</p>
      ${rows.length ? `<div class="table-wrap"><table class="tbl perf-tbl"><thead><tr><th class="r">번호</th><th>날짜</th><th>사업체명</th><th>주소</th><th>전화번호</th><th>담당자</th><th>직종</th><th>결과</th><th>연락결과</th><th>상태</th><th>상담자</th><th>방식</th><th>구인공고</th></tr></thead><tbody>
        ${rows.map(({ a, b }, i) => `<tr><td class="r num">${i + 1}</td><td class="num">${a.date}</td><td><b class="link" data-act="open" data-kind="biz" data-id="${b.id}">${e(b.name)}</b></td><td class="clip" title="${e(b.address)}">${e(b.address || '')}</td>
          <td class="num">${e(phoneOf(b))}</td><td>${e(a.contactName || contactOf(b))}</td><td class="clip">${e(a.jobType || b.jobs || '')}</td><td class="wrap">${e(a.content)}</td>
          <td><select class="select sm" data-chg="act-field" data-id="${a.id}" data-field="result">${opts(D.CONTACT_RESULTS, a.result, '-')}</select></td>
          <td><select class="select sm" data-chg="act-field" data-id="${a.id}" data-field="status">${opts(D.CONTACT_STATUS, a.status, '-')}</select></td>
          <td>${e(a.staff || '')}</td><td><span class="badge">${e(a.type)}</span></td>
          <td class="nowrap">${jobLink(a.jobUrl) ? `<a class="btn btn-sm btn-job" href="${e(jobLink(a.jobUrl))}" target="_blank" rel="noopener" title="${e(a.jobUrl)}">공고 보기 · ${e(siteName(a.jobUrl))}</a><button class="icon-btn" type="button" style="width:28px;height:28px" aria-label="공고 주소 바꾸기" data-act="ct-url" data-id="${a.id}">${V.I.edit}</button>`
            : `<input class="input sm url-in" data-chg="act-field" data-id="${a.id}" data-field="jobUrl" placeholder="공고 주소 붙여넣기" aria-label="구인공고 주소">`}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty"><strong>${V.monthLabel(f.month)} 연락이력이 없습니다</strong>위 칸에 기록하거나, 공유 시트의 연락이력을 복사해 <b>시트에서 붙여넣어 가져오기</b>로 옮겨 오세요.</div>`}
    </section>`;
  }
  const contactTsv = () => tsv(contactRows(ui.contacts.month).map(({ a, b }) => [a.date, b.name, b.address, phoneOf(b), a.contactName || contactOf(b), a.jobType || b.jobs, a.content, a.result, a.status, a.staff]));
  const reportTsv = () => tsv(contactRows(ui.contacts.month).filter(r => r.a.type === '방문').map(({ a, b }) => [U.dateDot(a.date), b.name, b.address, [phoneOf(b), a.contactName || contactOf(b)].filter(Boolean).join(' / '), a.content, a.training, a.procedure]));

  /** 연락 기록 한 줄 저장 (새 사업체면 등록, 단계도 자연스럽게 올림) */
  function addContact(fd) {
    const key = n => U.orgKey(n);
    const name = fd.name.trim();
    let b = S.get().businesses.find(x => key(x.name) === key(name));
    const me = fd.staff && S.staff().some(x => x.name === fd.staff) ? fd.staff : S.me();
    if (!b) {
      b = S.upsert('biz', { name, phone: fd.phone || '', address: fd.address || '', stage: fd.type === '방문' ? '방문상담' : '접촉', discoveredAt: fd.date, source: '현장 발굴', staff: me, placements: 0, jobs: fd.jobType || '' });
      S.upsert('act', { targetType: 'biz', targetId: b.id, date: fd.date, type: '발굴', content: '연락이력에서 사업체 등록', staff: me });
    } else {
      const patch = {};
      if (!b.phone && fd.phone) patch.phone = fd.phone;
      if (!b.address && fd.address) patch.address = fd.address;
      if (b.stage === '발굴') patch.stage = fd.type === '방문' ? '방문상담' : '접촉';
      else if (b.stage === '접촉' && fd.type === '방문') patch.stage = '방문상담';
      if (Object.keys(patch).length) S.upsert('biz', { id: b.id, ...patch });
    }
    S.upsert('act', { targetType: 'biz', targetId: b.id, date: fd.date, type: fd.type, content: fd.content.trim(), staff: me, contactName: fd.contactName || '', jobType: fd.jobType || '', result: fd.result || '', status: fd.status || '', jobUrl: (fd.jobUrl || '').trim(), perf: '', people: '' });
    return b;
  }
  /** 공고 사이트 이름 (버튼에 표시) */
  const SITES = [[/work24\.go\.kr|worknet/, '고용24'], [/worktogether/, '워크투게더'], [/albamon/, '알바몬'], [/alba\.co\.kr/, '알바천국'], [/saramin/, '사람인'], [/jobkorea/, '잡코리아'], [/incruit/, '인크루트'], [/kead\.or\.kr/, '장애인고용공단'], [/hscity|hwaseong/, '화성시'], [/danggeun|daangn/, '당근'], [/indeed/, '인디드']];
  function siteName(u) {
    const url = jobLink(u);
    if (!url) return '';
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
    const hit = SITES.find(([re]) => re.test(host));
    return hit ? hit[1] : host;
  }
  /** 구인공고 주소를 열 수 있는 링크로: http(s)만, www.로 시작하면 https를 붙인다. 사이트 주소가 아니면 빈 문자열 */
  function jobLink(u) {
    const s = String(u || '').trim();
    if (/^https?:\/\/\S+$/i.test(s)) return s;
    if (/^www\.\S+$/i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(s)) return 'https://' + s;
    return '';
  }

  /* ---------- 공유 시트에서 붙여넣어 가져오기 ---------- */
  const COLS = [['date', ['날짜', '일자']], ['name', ['사업체명', '업체명', '사업체', '업체']], ['address', ['주소', '소재지']], ['phone', ['전화번호', '연락처', '전화']], ['contactName', ['담당자', '대표명']], ['jobType', ['직종', '직무']], ['content', ['결과', '내용']], ['result', ['연락결과']], ['status', ['상태']], ['staff', ['상담자', '담당직원']], ['jobUrl', ['구인공고', '공고주소', '공고 링크', '공고링크', '링크', 'URL', 'url']]];
  // 머리글이 없으면 공유 시트 '○월 연락이력' 열 순서로 본다: 번호, 날짜, 사업체명, 주소, 전화번호, 담당자, 직종, 결과, 연락결과, 상태, 상담자
  const DEFAULT_ORDER = ['no', 'date', 'name', 'address', 'phone', 'contactName', 'jobType', 'content', 'result', 'status', 'staff'];
  function parsePaste(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (!lines.length) return { rows: [], map: null };
    const cells = lines.map(l => l.split('\t').map(c => c.trim()));
    const hdrIdx = cells.findIndex(r => r.filter(c => COLS.some(([, syn]) => syn.includes(c.replace(/\s/g, '')))).length >= 3);
    let order;
    if (hdrIdx >= 0) {
      order = cells[hdrIdx].map(c => { const n = c.replace(/\s/g, ''); const hit = COLS.find(([, syn]) => syn.some(s => n === s)) || COLS.find(([, syn]) => syn.some(s => n.includes(s))); return hit ? hit[0] : ''; });
    } else {
      // 첫 칸이 날짜처럼 보이면 번호 열 없이 붙여넣은 것
      const first = cells[0][0] || '';
      order = /\d{4}[-.\s]/.test(first) ? DEFAULT_ORDER.slice(1) : DEFAULT_ORDER;
    }
    const body = hdrIdx >= 0 ? cells.slice(hdrIdx + 1) : cells;
    const rows = body.map(r => {
      const o = {};
      order.forEach((k, i) => { if (k && r[i] != null && o[k] == null) o[k] = r[i]; });
      o.date = U.toDateStr(String(o.date || '').replace(/\s/g, ''));
      o.type = /방문/.test(o.content || '') ? '방문' : '전화';
      return o;
    }).filter(o => o.name && o.date);
    return { rows, order };
  }
  function pasteDialog(state) {
    const rows = state.rows || [];
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">연락이력 가져오기</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div></div>
      <div class="dr-body">
        <ol class="steps-help"><li>공유 시트 <b>○월 연락이력</b> 탭에서 가져올 줄을 머리글(날짜·사업체명…)과 함께 드래그해 <b>Ctrl+C</b></li><li>아래 칸을 누르고 <b>Ctrl+V</b></li><li>미리보기를 확인하고 <b>가져오기</b></li></ol>
        <textarea class="textarea" id="ctPasteBox" rows="7" placeholder="여기에 붙여넣기 (Ctrl+V)">${e(state.text || '')}</textarea>
        ${rows.length ? `<p class="sub">${rows.length}줄을 읽었습니다. 처음 보는 사업체 ${state.newCount}곳은 사업체 개발에 새로 등록됩니다. 상담자 칸이 비어 있으면 '${e(S.me())}'로 기록합니다.</p>
          <div class="table-wrap"><table class="tbl bulk-tbl"><thead><tr><th>날짜</th><th>사업체명</th><th>전화번호</th><th>담당자</th><th>결과</th><th>연락결과</th><th>상태</th><th>상담자</th></tr></thead><tbody>
          ${rows.slice(0, 30).map(r => `<tr><td class="num">${e(r.date)}</td><td><b>${e(r.name)}</b></td><td class="num">${e(r.phone || '')}</td><td>${e(r.contactName || '')}</td><td>${e(r.content || '')}</td><td>${e(r.result || '')}</td><td>${e(r.status || '')}</td><td>${e(r.staff || '')}</td></tr>`).join('')}
          </tbody></table></div>${rows.length > 30 ? `<p class="sub">처음 30줄만 보여줍니다.</p>` : ''}`
          : state.text ? '<p class="sub" style="color:var(--danger)">날짜와 사업체명이 있는 줄을 찾지 못했습니다. 머리글 줄까지 함께 복사해 보세요.</p>' : ''}
      </div>
      <div class="dr-foot"><button class="btn" type="button" data-act="dr-close">취소</button><button class="btn btn-primary" type="button" data-act="ct-paste-commit" ${rows.length ? '' : 'disabled'}>${rows.length}줄 가져오기</button></div>`;
  }
  function commitPaste(rows) {
    const staffNames = new Set(S.staff().map(s => s.name));
    let n = 0;
    rows.forEach(r => {
      const result = D.CONTACT_RESULTS.find(x => (r.result || '').replace(/\s/g, '') === x.replace(/\s/g, '')) || r.result || '';
      addContact({ ...r, content: r.content || '(내용 없음)', result, staff: staffNames.has(r.staff) ? r.staff : '' });
      n++;
    });
    return n;
  }

  /* ================= 출장·특근 명령부 ================= */
  // 명령부는 팀 문서라 보기 범위(전체 팀/직원)와 상관없이 모든 직원 줄을 쓴다. 사람별로는 위 담당자 버튼으로 거른다
  const trips = (month, kind) => S.get().trips.filter(t => t.kind === kind && (t.date || '').startsWith(month)).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.staff || '').localeCompare(b.staff || ''));
  function ordersPage() {
    const f = ui.orders;
    return `
      <div class="page-head">
        <div><h1 class="page-title">출장·특근 명령부</h1><div class="page-desc">현장중심센터 월별 관내출장 명령부와 특근 명령부를 만들고, 한글 서식 모양으로 인쇄합니다.</div></div>
      </div>
      <div class="toolbar perf-bar">${monthNav('od-month', f.month)}
        <div class="chips"><button type="button" class="chip ${f.kind === '출장' ? 'on' : ''}" data-act="od-kind" data-kind="출장">관내출장 명령부</button><button type="button" class="chip ${f.kind === '특근' ? 'on' : ''}" data-act="od-kind" data-kind="특근">특근 명령부</button><button type="button" class="chip ${f.kind === '여비' ? 'on' : ''}" data-act="od-kind" data-kind="여비">💰 여비 정산</button></div>
      </div>
      <div id="odResults"></div>`;
  }
  function ordersResults() {
    const f = ui.orders;
    if (f.kind === '여비') return TV.page(f.month);
    const all = trips(f.month, f.kind);
    const list = f.who ? all.filter(t => (t.staff || '(담당자 없음)') === f.who) : all;
    // 여비: 담당자·날짜별 하루 계산을 줄마다 붙인다 (하루 첫 줄에 그날 합계)
    const trip0 = f.kind === '출장';
    const tvDays = trip0 ? TV.days(all) : TV.otDays(all);
    const tvRow = {}, tvStaff = {};
    // 담당자 합계·특근 식비는 정산(출장·특근 식비 합쳐 하루 2만원)과 같은 숫자를 쓴다
    const stl = TV.settle(f.month);
    stl.people.forEach(p => { tvStaff[p.name] = trip0 ? p.inTotal + p.outTotal : p.otTotal; });
    const otMeal = {}; stl.people.forEach(p => p.ot.forEach(r => { otMeal[`${p.name}|${r.date}`] = r; }));
    tvDays.forEach(d => { if (!trip0) { const r = otMeal[`${d.staff}|${d.date}`]; if (r) { d.meal = r.meal; d.total = r.total; d.over = r.capped; } } d.rows.forEach((r, i) => { tvRow[(r.t || r).id] = { d, r, first: i === 0 }; }); });
    const won = n => Math.round(n).toLocaleString('ko-KR');
    const mealIn = t => `<td class="od-meal"><input class="input sm num" data-chg="trip-field" data-id="${t.id}" data-field="meal" value="${e(t.meal || '')}" placeholder="0" inputmode="numeric" aria-label="식비"></td>`;
    const tvCell = t => {
      const x = tvRow[t.id]; if (!x) return '<td></td>';
      const { d, r, first } = x;
      if (!trip0) return `<td class="od-tv ${first ? '' : 'same'}">${first ? `<b class="num">${won(d.total)}원</b>` : '<span class="sub">같은 날 ↑</span>'}<small>${first ? `식비 ${won(d.meal)}${d.over ? ' (출장 식비와 합쳐 하루 2만원까지)' : ''}` : ''}</small></td>`;
      const parts = [first && `일비 ${won(d.daily)}`, first && d.meal && `식비 ${won(d.meal)}${!d.out ? '' : ''}`, r.c.fuel && `유류 ${won(r.c.fuel)}`, r.c.toll + r.c.parking && `통행·주차 ${won(r.c.toll + r.c.parking)}`, r.c.fare + r.c.lodge && `운임·숙박 ${won(r.c.fare + r.c.lodge)}`].filter(Boolean);
      return `<td class="od-tv ${first ? '' : 'same'}" title="${e(d.why)}">${first ? `<b class="num">${won(d.total)}원</b>` : '<span class="sub">같은 날 ↑</span>'}<small>${parts.join(' · ') || (first ? '' : '')}</small>${first && d.noTime ? '<small class="tv-over">시간 입력 필요</small>' : ''}</td>`;
    };
    const staffBar = staffManager(all);
    const staffOpts = sel => opts([...new Set([...S.staff().map(s => s.name), sel].filter(Boolean))], sel);
    const cell = (t, k, attrs = '') => `<input class="input sm" data-chg="trip-field" data-id="${t.id}" data-field="${k}" value="${e(t[k] || '')}" ${attrs}>`;
    const trip = f.kind === '출장';
    const imported = new Set(S.get().trips.map(t => t.actId).filter(Boolean));
    const visitsLeft = trip ? S.view().activities.filter(a => (a.type === '방문' || (a.targetType === 'net' && ['미팅', '행사', '홍보'].includes(a.type))) && a.date.startsWith(f.month) && !imported.has(a.id)).length : 0;
    return `<section class="panel">
      ${staffBar}
      ${f.bulk ? bulkPanel() : ''}
      <div class="panel-pad perf-actions">
        <div class="inline">
          ${trip ? `<button class="btn" type="button" data-act="od-import" ${visitsLeft ? '' : 'disabled'}>이 달 방문 기록 불러오기${visitsLeft ? ` (${visitsLeft}건)` : ''}</button>` : ''}
          <button class="btn" type="button" data-act="od-add">+ 줄 추가</button>
          <button class="btn" type="button" data-act="od-hwp">한글 명령부 불러오기</button>
        </div>
        <div class="inline"><button class="btn" type="button" data-act="od-bulk">🗂 여러 달 한꺼번에 인쇄</button><button class="btn" type="button" data-act="od-copy" ${list.length ? '' : 'disabled'}>${V.I.copy}한글 표용 복사</button><button class="btn btn-primary" type="button" data-act="od-print" ${list.length ? '' : 'disabled'}>전체 한 장 인쇄</button></div>
      </div>
      ${`<div class="panel-pad od-each">
        <div class="od-each-head"><b>담당자별 명령부</b><span class="sub">한 사람당 한 장씩, 결재란(담당·팀장)이 따로 들어갑니다.</span>
          <span class="inline"><button class="btn btn-sm" type="button" data-act="od-print-each" ${all.length ? '' : 'disabled'}>기록 있는 사람 모두 인쇄</button><button class="btn btn-sm" type="button" data-act="od-file" ${all.length ? '' : 'disabled'}>기록 있는 사람 모두 파일</button></span></div>
        <div class="od-each-list">${orderStaff().map(s => { const n = all.filter(t => (t.staff || '(담당자 없음)') === s).length; return `<div class="od-each-item ${n ? '' : 'empty'}"><span><b>${e(s)}</b> <span class="sub">${n ? `${n}건` : '0건 · 빈 양식'}</span>${tvStaff[s] != null ? ` <span class="od-tv-sum" title="${trip ? '규정집 기준 여비 합계' : '특근 식비 합계'}">💰 ${won(tvStaff[s])}원</span>` : ''}</span><span class="inline"><button class="btn btn-sm" type="button" data-act="od-print" data-staff="${e(s)}">인쇄 · PDF</button><button class="btn btn-sm" type="button" data-act="od-file" data-staff="${e(s)}">파일 받기</button></span></div>`; }).join('')}</div>
      </div>`}
      <p class="sub perf-help">${trip ? '방문 기록을 불러오면 출장일·성명·출장지·출장용무가 채워집니다. 함께 간 직원은 <b>동행 추가</b>로 한 줄 더 만드세요.' : '특근한 날짜와 시간, 업무 내용을 적습니다.'} 칸을 고치면 바로 저장됩니다.</p>
      ${list.length ? `<div class="table-wrap"><table class="tbl od-tbl"><thead><tr>${trip
        ? '<th>출장일</th><th>성명</th><th>출장지</th><th>출장용무</th><th>방법</th><th>출장시간</th><th>출장복명</th><th>비고</th><th>식비</th><th>여비 <button type="button" class="linklike" data-act="od-kind" data-kind="여비">자세히</button></th><th></th>'
        : '<th>특근일자</th><th>성명</th><th>부서명</th><th>특근시간</th><th>특근 업무내용</th><th>비고</th><th>식비</th><th>여비(식비)</th><th></th>'}</tr></thead><tbody>
        ${list.map(t => `<tr>
          <td>${cell(t, 'date', 'type="date"')}</td>
          <td><select class="select sm" data-chg="trip-field" data-id="${t.id}" data-field="staff">${staffOpts(t.staff)}</select></td>
          ${trip ? `<td>${cell(t, 'place')}</td><td>${cell(t, 'purpose')}</td>
            <td><input class="input sm" list="odMethods" data-chg="trip-field" data-id="${t.id}" data-field="method" value="${e(t.method || '')}"></td>
            <td>${cell(t, 'time', 'placeholder="9 ~ 12시"')}</td>
            <td class="nowrap">${D.TRIP_REPORTS.map(r => `<label class="check"><input type="checkbox" data-chg="trip-report" data-id="${t.id}" value="${r}" ${(t.report || []).includes(r) ? 'checked' : ''}>${r}</label>`).join(' ')}</td>
            <td>${cell(t, 'note')}</td>${mealIn(t)}${tvCell(t)}`
          : `<td>${cell(t, 'dept', 'placeholder="직업"')}</td><td>${cell(t, 'time', 'placeholder="14 ~ 18시"')}</td><td>${cell(t, 'purpose')}</td><td>${cell(t, 'note')}</td>${mealIn(t)}${tvCell(t)}`}
          <td class="nowrap">${trip ? `<button class="btn btn-ghost btn-sm" type="button" data-act="od-dup" data-id="${t.id}">동행 추가</button>` : ''}<button class="icon-btn" type="button" aria-label="삭제" data-act="od-del" data-id="${t.id}">${V.I.close}</button></td>
        </tr>`).join('')}
      </tbody>${tvDays.length ? `<tfoot><tr><th colspan="${trip ? 9 : 7}" class="r">${f.who ? e(f.who) + ' ' : ''}${trip ? '여비 합계' : '특근 식비 합계'} <span class="sub">(${trip ? '규정집 2026 기준 · 일비·유류비·통행료·주차료·식비 등을 같이 계산' : '적은 식비를 날마다 2만원까지 더함'})</span></th><th class="od-tv"><b class="num">${won(tvDays.filter(d => !f.who || d.staff === f.who).reduce((a, d) => a + d.total, 0))}원</b></th><th></th></tr></tfoot>` : ''}</table></div><datalist id="odMethods">${D.TRIP_METHODS.map(m => `<option value="${e(m)}">`).join('')}</datalist>`
      : `<div class="empty"><strong>${V.monthLabel(f.month)} ${trip ? '관내출장' : '특근'} 명령부가 비어 있습니다</strong>${trip ? '방문 기록을 불러오거나, 예전에 쓴 한글 명령부를 불러오거나, 줄을 추가하세요.' : '한글 명령부를 불러오거나 줄 추가로 특근 기록을 넣으세요.'}</div>`}
    </section>`;
  }
  /** 담당자 추가·삭제 (직원 목록은 모든 화면이 같이 쓴다). 이름을 누르면 그 사람 줄만 보기 */
  function staffManager(all) {
    const f = ui.orders;
    const admin = S.isAdmin();
    const staff = S.staff();
    const cnt = n => all.filter(t => (t.staff || '(담당자 없음)') === n).length;
    return `<div class="panel-pad od-staff">
      <b>담당자</b>
      <button type="button" class="chip ${!f.who ? 'on' : ''}" data-act="od-who" data-who="">전체 <span class="n">${all.length}</span></button>
      ${staff.map(s => `<span class="od-staff-chip ${f.who === s.name ? 'on' : ''}"><button type="button" class="chip ${f.who === s.name ? 'on' : ''}" data-act="od-who" data-who="${e(s.name)}">${e(s.name)} <span class="n">${cnt(s.name)}</span></button>${admin ? `<button type="button" class="od-staff-del" data-act="od-staff-del" data-name="${e(s.name)}" aria-label="${e(s.name)} 담당자 삭제" title="담당자 목록에서 빼기">×</button>` : ''}</span>`).join('')}
      ${admin ? `<span class="od-staff-add"><input class="input sm" id="odStaffNew" placeholder="새 담당자 이름" style="width:120px"><select class="select sm" id="odStaffProg" aria-label="소속 사업"><option value="">소속 미지정</option>${D.PROGRAMS.map(p => `<option>${e(p.key)}</option>`).join('')}</select><button class="btn btn-sm" type="button" data-act="od-staff-add">+ 추가</button></span>` : '<span class="sub">담당자 추가·삭제는 관리자만 할 수 있어요.</span>'}
    </div>`;
  }
  function importVisits() {
    const f = ui.orders;
    const imported = new Set(S.get().trips.map(t => t.actId).filter(Boolean));
    const acts = S.view().activities.filter(a => (a.type === '방문' || (a.targetType === 'net' && ['미팅', '행사', '홍보'].includes(a.type))) && a.date.startsWith(f.month) && !imported.has(a.id));
    return S.upsertMany('trip', acts.map(a => {
      const t = S.targetOf(a);
      return { kind: '출장', date: a.date, staff: a.staff || S.me(), place: t ? t.name : '', purpose: a.targetType === 'biz' ? '사업체개발' : '홍보', method: '복지관 차량', time: '', report: [], dept: '', note: a.content || '', actId: a.id };
    })).length;
  }
  const reportText = t => D.TRIP_REPORTS.map(r => `${r} ${(t.report || []).includes(r) ? '■' : '□'}`).join(' / ');
  const ordersTsv = () => {
    const f = ui.orders;
    return tsv(trips(f.month, f.kind).map(t => f.kind === '출장'
      ? [md(t.date), t.staff, t.place, t.purpose, t.method, t.time, reportText(t), t.note]
      : [md(t.date), t.staff, t.dept || '직업', t.time, [t.purpose, t.note].filter(Boolean).join(' / ')]));
  };
  /** 담당자별 명령부: 직원 목록의 모든 사람(이 달 기록이 없으면 빈 양식) + 목록에 없는 이름으로 적힌 줄 */
  const orderStaff = () => { const f = ui.orders; return [...new Set([...S.staff().map(s => s.name), ...trips(f.month, f.kind).map(t => t.staff || '(담당자 없음)')])]; };
  const orderTitle = kind => kind === '출장' ? '관내출장 명령부' : '특근 명령부';
  /** staff를 주면 그 담당자 줄만 모아 결재란이 따로 있는 한 장을 만든다. 없으면 전체 */
  /* 명령부 양식: 칸 너비는 늘 같은 비율(%)로 고정하고, 표는 최소 MIN_ROWS 줄(빈 줄 채움)로 매달 같은 모양.
   * 줄이 많으면 줄 높이·글자 크기를 줄여 A4 세로 한 쪽에 담는다. scale은 인쇄 전에 실제 크기를 재서 더 줄일 때 쓴다 */
  const MIN_ROWS = 14;
  const COLS_TRIP = [['출장일', 10], ['성명', 8], ['출장지', 17], ['출장용무', 12], ['방 법', 10], ['출장시간', 10], ['출장복명', 13], ['비고', 20]];
  const COLS_OT = [['특근일자', 12], ['특근자 성명', 12], ['부서명', 10], ['특근시간', 14], ['특 근 업 무 내 용', 52]];
  function orderDoc(staff, scale = 1) {
    const f = ui.orders;
    if (staff === undefined || staff === '') staff = null;
    const list = trips(f.month, f.kind).filter(t => staff == null || (t.staff || '(담당자 없음)') === staff);
    const trip = f.kind === '출장';
    const cols = trip ? COLS_TRIP : COLS_OT;
    const n = Math.max(MIN_ROWS, list.length);
    // 표 본문에 쓸 수 있는 높이 약 205mm (A4 297 − 여백 20 − 결재란·제목 약 60 − 머리줄 12)
    const rowMm = +(Math.min(13, 205 / n) * scale).toFixed(2);
    const fs = +((rowMm >= 11 ? 10 : rowMm >= 9 ? 9.5 : rowMm >= 7.5 ? 8.5 : 8) * Math.min(1, scale + 0.08)).toFixed(2);
    const cell = (v, cls = '') => `<td${cls ? ` class="${cls}"` : ''}>${v}</td>`;
    const rep = t => `<span class="rep">${D.TRIP_REPORTS.map(r => `${r} ${(t.report || []).includes(r) ? '■' : '□'}`).join('<br>')}</span>`;
    const rows = list.map(t => trip
      ? cell(e(md(t.date))) + cell(e(t.staff)) + cell(e(t.place), 'l') + cell(e(t.purpose)) + cell(e(t.method)) + cell(e(t.time)) + cell(rep(t)) + cell(e(t.note), 'l')
      : cell(e(md(t.date))) + cell(e(t.staff)) + cell(e(t.dept || '직업')) + cell(e(t.time)) + cell(`${e(t.purpose)}${t.note ? `<br>${e(t.note)}` : ''}`, 'l'));
    while (rows.length < n) rows.push(cols.map(([h]) => cell(h === '출장복명' ? rep({}) : '&nbsp;')).join(''));
    const sign = '<table class="sign"><tr><th rowspan="2" class="sign-side">결<br>재</th><th>담 당</th><th>팀 장</th></tr><tr><td></td><td></td></tr></table>';
    return `<article class="doc order-doc" style="font-size:${fs}pt">
      <div class="order-head">${sign}</div>
      <h1>${orderTitle(f.kind)}</h1>
      <p class="order-sub">${V.monthLabel(f.month)} · 화성시아르딤복지관 직업지원팀 (현장중심직업재활센터)${staff != null ? ` · <b>${trip ? '출장자' : '특근자'}: ${e(staff)}</b>` : ''}</p>
      <table class="doc-tbl order-tbl" style="font-size:${fs}pt"><colgroup>${cols.map(([, w]) => `<col style="width:${w}%">`).join('')}</colgroup>
        <thead><tr>${cols.map(([h]) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr style="height:${rowMm}mm">${r}</tr>`).join('')}</tbody></table>
    </article>`;
  }
  /** 담당자마다 한 장씩, 페이지를 나눠 이어 붙인다 (fit: 인쇄 전에 한 쪽에 맞추는 함수) */
  // 전원 인쇄·파일은 이 달 기록이 있는 사람만 (빈 양식은 사람별 버튼으로)
  const orderDocsEach = (fit = s => orderDoc(s)) => { const f = ui.orders, have = new Set(trips(f.month, f.kind).map(t => t.staff || '(담당자 없음)')); return orderStaff().filter(s => have.has(s)).map(s => fit(s)).join(''); };
  /** 한글에서 열 수 있는 워드 호환 문서(.doc)로 저장 */
  /* ---------- 여러 달 한꺼번에 (사람 → 달 → 출장·특근 순서) ---------- */
  const monthsBetween = (a, b) => { const out = []; let [y, m] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); while ((y < y2 || (y === y2 && m <= m2)) && out.length < 24) { out.push(`${y}-${U.pad(m)}`); m++; if (m > 12) { m = 1; y++; } } return out; };
  /** 직원 목록 + 명령부에 적힌 이름 (목록에 없는 사람도 고를 수 있게) */
  const bulkNames = () => [...new Set([...S.staff().map(x => x.name), ...S.get().trips.map(t => t.staff).filter(Boolean)])];
  function bulkState() {
    const f = ui.orders;
    if (!f.bulk) {
      const to = f.month, [y, m] = to.split('-').map(Number), d = new Date(y, m - 4, 1);
      const from = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
      const have = new Set(S.get().trips.filter(t => t.date >= from && t.date <= to + '-31').map(t => t.staff));
      f.bulk = { from, to, staff: bulkNames().filter(n => have.has(n)), kinds: ['출장', '특근'], empty: false, summary: true };
    }
    return f.bulk;
  }
  /** 사람·달별 금액: 출장 여비(규정집 기준) + 특근 식비 */
  function bulkSummary(b = bulkState()) {
    const months = monthsBetween(b.from, b.to);
    const rows = b.staff.map(name => {
      const per = months.map(m => {
        const tr = trips(m, '출장').filter(t => t.staff === name), ot = trips(m, '특근').filter(t => t.staff === name);
        const p = TV.settle(m).people.find(x => x.name === name) || { in: [], out: [], ot: [], inTotal: 0, outTotal: 0, otTotal: 0, total: 0 };
        return { m, trips: tr.length, tv: p.inTotal + p.outTotal, inT: p.inTotal, outT: p.outTotal, ots: ot.length, meal: p.otTotal, otMin: p.ot.reduce((a, r) => a + r.min, 0), noTime: [...p.in].filter(r => r.noTime).length, total: p.total };
      });
      return { name, per, total: per.reduce((a, x) => a + x.total, 0) };
    });
    return { months, rows, total: rows.reduce((a, r) => a + r.total, 0) };
  }
  const won = n => Math.round(n).toLocaleString('ko-KR');
  const hrs = min => (min ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : '-');
  function bulkPanel() {
    const b = bulkState();
    const sm = bulkSummary(b);
    const pages = b.staff.length * sm.months.length * b.kinds.length;
    const realPages = b.staff.reduce((a, n) => a + sm.months.reduce((c, m) => c + b.kinds.filter(k => b.empty || trips(m, k).some(t => t.staff === n)).length, 0), 0);
    return `<div class="panel-pad od-bulk" id="odBulk">
      <div class="od-bulk-head"><b>🗂 여러 달 한꺼번에 인쇄</b><span class="sub">사람마다 달별로 출장 → 특근 순서로 이어서 인쇄해요.</span><button class="icon-btn" type="button" data-act="od-bulk" aria-label="닫기">${V.I.close}</button></div>
      <div class="od-bulk-form">
        <label>기간 <input class="input sm" type="month" data-bulk="from" value="${b.from}"> ~ <input class="input sm" type="month" data-bulk="to" value="${b.to}"></label>
        <span class="od-bulk-grp"><span class="sub">담당자</span>${bulkNames().map(n => `<label class="check"><input type="checkbox" data-bulk="staff" value="${e(n)}" ${b.staff.includes(n) ? 'checked' : ''}>${e(n)}</label>`).join('')}</span>
        <span class="od-bulk-grp"><span class="sub">명령부</span>${['출장', '특근'].map(k => `<label class="check"><input type="checkbox" data-bulk="kinds" value="${k}" ${b.kinds.includes(k) ? 'checked' : ''}>${k === '출장' ? '관내출장' : '특근'}</label>`).join('')}</span>
        <label class="check"><input type="checkbox" data-bulk="empty" ${b.empty ? 'checked' : ''}>기록 없는 달도 빈 양식으로</label>
        <label class="check"><input type="checkbox" data-bulk="summary" ${b.summary ? 'checked' : ''}>맨 뒤에 금액 요약 한 장</label>
      </div>
      ${b.staff.length && b.kinds.length ? `<div class="table-wrap"><table class="tbl od-bulk-tbl"><thead><tr><th>담당자</th>${sm.months.map(m => `<th>${+m.slice(5)}월</th>`).join('')}<th>합계</th></tr></thead><tbody>
        ${sm.rows.map(r => `<tr><th>${e(r.name)}</th>${r.per.map(x => `<td><b class="num">${won(x.total)}원</b><small>관내 ${won(x.inT)} · 관외 ${won(x.outT)}원 (출장 ${x.trips}건)${x.noTime ? ` <span class="tv-over">(시간 없는 날 ${x.noTime})</span>` : ''}</small><small>특근 ${x.ots}건 · ${hrs(x.otMin)} · 식비 ${won(x.meal)}원</small></td>`).join('')}<td class="tot"><b class="num">${won(r.total)}원</b></td></tr>`).join('')}
        <tr class="tot"><th>합계</th>${sm.months.map((m, i) => `<td><b class="num">${won(sm.rows.reduce((a, r) => a + r.per[i].total, 0))}원</b></td>`).join('')}<td class="tot"><b class="num">${won(sm.total)}원</b></td></tr>
      </tbody></table></div>` : '<p class="sub">담당자와 명령부 종류를 골라 주세요.</p>'}
      <div class="inline od-bulk-acts"><button class="btn btn-primary" type="button" data-act="od-bulk-print" ${realPages ? '' : 'disabled'}>🖨 한꺼번에 인쇄 (${realPages}장${b.summary && realPages ? ' + 요약 1장' : ''})</button><button class="btn" type="button" data-act="od-bulk-file" ${realPages ? '' : 'disabled'}>한 파일로 받기 (.doc)</button>
        <span class="sub">출장 여비 = 규정집 2026 기준(일비·유류비·통행료·주차료·식비 등), 특근 = 적은 식비(하루 2만원까지). ${pages > realPages ? `기록 없는 ${pages - realPages}장은 빠져요.` : ''}</span></div>
    </div>`;
  }
  /** 인쇄할 문서들: fit(staff) 은 지금 ui.orders 의 달·종류로 한 장을 만든다 */
  function bulkDocs(fit) {
    const b = bulkState(), f = ui.orders, keep = { month: f.month, kind: f.kind };
    const months = monthsBetween(b.from, b.to);
    let html = '';
    try {
      b.staff.forEach(name => months.forEach(m => b.kinds.forEach(k => {
        if (!b.empty && !trips(m, k).some(t => t.staff === name)) return;
        f.month = m; f.kind = k;
        html += fit(name);
      })));
    } finally { f.month = keep.month; f.kind = keep.kind; }
    if (b.summary && html) html += bulkSummaryDoc();
    return html;
  }
  function bulkSummaryDoc() {
    const sm = bulkSummary();
    return `<article class="doc order-doc" style="font-size:10pt">
      <h1>출장 여비 · 특근 식비 요약</h1>
      <p class="order-sub">${V.monthLabel(sm.months[0])} ~ ${V.monthLabel(sm.months[sm.months.length - 1])} · 화성시아르딤복지관 직업지원팀</p>
      <table class="doc-tbl order-tbl"><thead><tr><th>담당자</th><th>월</th><th>출장</th><th>출장 여비</th><th>특근</th><th>특근 시간</th><th>특근 식비</th><th>합계</th></tr></thead><tbody>
        ${sm.rows.map(r => r.per.map((x, i) => `<tr style="height:8mm">${i === 0 ? `<td rowspan="${r.per.length + 1}"><b>${e(r.name)}</b></td>` : ''}<td>${+x.m.slice(5)}월</td><td>${x.trips}건</td><td class="r">${won(x.tv)}</td><td>${x.ots}건</td><td>${hrs(x.otMin)}</td><td class="r">${won(x.meal)}</td><td class="r"><b>${won(x.total)}</b></td></tr>`).join('') + `<tr style="height:8mm" class="tv-doc-total"><th colspan="6">소계</th><th class="r">${won(r.total)}</th></tr>`).join('')}
        <tr class="tv-doc-total" style="height:9mm"><th colspan="7">총 합계</th><th class="r">${won(sm.total)}</th></tr>
      </tbody></table>
      <p class="order-sub tv-doc-note">출장 여비: 중증장애인직업재활지원사업 규정집 2026 여비 기준(근무지 내 일비 4시간 기준·차량배치 유무, 유류비, 통행료, 주차료, 식비). 특근: 명령부에 적은 식비(1일 2만원 이내).</p>
    </article>`;
  }
  function bulkFile(fit) {
    const b = bulkState();
    const body = bulkDocs(fit).replace(/<\/article>\s*<article/g, '</article><br style="page-break-before:always"><article');
    const css = 'body{font-family:"맑은 고딕",sans-serif}@page{size:A4 portrait;margin:10mm}h1{text-align:center;font-size:18pt;letter-spacing:4px;margin:4pt 0}.order-head{text-align:right}.sign{margin-left:auto;border-collapse:collapse}.sign th,.sign td{border:1px solid #000;width:56pt;text-align:center;padding:2pt}.sign td{height:40pt}.sign .sign-side{width:18pt}.order-sub{text-align:center;margin:0 0 6pt}.doc-tbl{width:100%;border-collapse:collapse;table-layout:fixed}.doc-tbl th,.doc-tbl td{border:1px solid #000;padding:1pt 2pt;text-align:center;vertical-align:middle;word-break:keep-all}.doc-tbl td.l{text-align:left}.doc-tbl td.r,.doc-tbl th.r{text-align:right}.doc-tbl th{background:#eee}.rep{font-size:90%}';
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>출장·특근 명령부</title><style>${css}</style></head><body>${body}</body></html>`;
    const name = `${V.monthLabel(b.from)}~${+b.to.slice(5)}월 출장·특근 명령부_${b.staff.join('·')}.doc`.replace(/[\\/:*?"<>|]/g, '');
    return { name, blob: new Blob(['\ufeff' + html], { type: 'application/msword' }) };
  }
  function orderFile(staff, fit = s => orderDoc(s)) {
    const f = ui.orders;
    const css = 'body{font-family:"맑은 고딕",sans-serif}@page{size:A4 portrait;margin:10mm}h1{text-align:center;font-size:18pt;letter-spacing:4px;margin:4pt 0}.order-head{text-align:right}.sign{margin-left:auto;border-collapse:collapse}.sign th,.sign td{border:1px solid #000;width:56pt;text-align:center;padding:2pt}.sign td{height:40pt}.sign .sign-side{width:18pt}.order-sub{text-align:center;margin:0 0 6pt}.doc-tbl{width:100%;border-collapse:collapse;table-layout:fixed}.doc-tbl th,.doc-tbl td{border:1px solid #000;padding:1pt 2pt;text-align:center;vertical-align:middle;word-break:keep-all}.doc-tbl td.l{text-align:left}.doc-tbl th{background:#eee}.rep{font-size:90%}';
    const body = staff == null ? orderDocsEach(fit).replace(/<\/article>\s*<article/g, '</article><br style="page-break-before:always"><article') : fit(staff);
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${orderTitle(f.kind)}</title><style>${css}</style></head><body>${body}</body></html>`;
    const name = `${V.monthLabel(f.month)} ${orderTitle(f.kind)}${staff != null ? '_' + staff : '_담당자별'}.doc`.replace(/[\\/:*?"<>|]/g, '');
    return { name, blob: new Blob(['\ufeff' + html], { type: 'application/msword' }) };
  }

  /* ---------- 한글 명령부 불러오기 ---------- */
  const HEAD = { 출장일: 'date', 특근일자: 'date', 성명: 'staff', 특근자성명: 'staff', 출장지: 'place', 출장용무: 'purpose', 방법: 'method', 출장시간: 'time', 특근시간: 'time', 출장복명: 'report', 비고: 'note', 부서명: 'dept', 특근업무내용: 'purpose' };
  /** HWP.readTables 결과 → 명령부 줄. year는 파일 이름에서 찾은 해 */
  function parseOrderTables(tables, year) {
    const out = [];
    tables.forEach(t => {
      const hi = t.rows.findIndex(r => r.some(c => /^(출장일|특근일자)$/.test(c.replace(/\s/g, ''))));
      if (hi < 0) return;
      const kind = t.rows[hi].some(c => c.replace(/\s/g, '') === '출장일') ? '출장' : '특근';
      const cols = [];
      t.rows[hi].forEach((c, i) => { const k = HEAD[c.replace(/\s/g, '')]; if (k) cols.push({ k, from: i, to: i + ((t.spans[hi] || [])[i] || 1) }); });
      t.rows.slice(hi + 1).forEach(r => {
        const o = {};
        cols.forEach(c => { o[c.k] = r.slice(c.from, c.to).filter(Boolean).join('\n').trim(); });
        const m = (o.date || '').match(/(\d{1,2})\s*월\s*(\d{1,2})/);
        if (!m || !o.staff) return;
        const lines = s => (s || '').split('\n').map(x => x.trim()).filter(Boolean);
        const pur = lines(o.purpose);
        out.push({
          kind, date: `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`, staff: o.staff.replace(/\s/g, ''),
          place: lines(o.place).join(' '),
          purpose: kind === '특근' ? pur[0] || '' : pur.join(' '),
          method: lines(o.method).join(' '), time: lines(o.time).join(' ').replace(/∼/g, '~'),
          report: D.TRIP_REPORTS.filter(x => new RegExp(x + '\\s*■').test(o.report || '')),
          dept: kind === '특근' ? lines(o.dept).join(' ') || '직업' : '',
          note: [...(kind === '특근' ? pur.slice(1) : []), ...lines(o.note)].join(' / '), actId: '',
        });
      });
    });
    // 동행 줄은 출장시간·방법을 비워 두는 경우가 많아, 같은 날·같은 곳·같은 용무 줄에서 채운다
    out.forEach(r => ['time', 'method'].forEach(k => {
      if (r[k]) return;
      const mate = out.find(o => o !== r && o[k] && o.kind === r.kind && o.date === r.date && U.norm(o.place) === U.norm(r.place) && U.norm(o.purpose) === U.norm(r.purpose));
      if (mate) r[k] = mate[k];
    }));
    return out;
  }
  const tripKey = t => [t.kind, t.date, t.staff, U.norm(t.place || ''), U.norm(t.purpose || ''), (t.time || '').replace(/\s/g, '')].join('|');
  function markDup(rows) {
    const have = new Set(S.get().trips.map(tripKey));
    rows.forEach(r => { r.dup = have.has(tripKey(r)); });
    return rows;
  }
  function hwpDialog(state) {
    const rows = state.rows || [];
    const fresh = rows.filter(r => !r.dup);
    const months = [...new Set(rows.map(r => r.date.slice(0, 7)))].sort();
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">한글 명령부 불러오기</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div></div>
      <div class="dr-body">
        <p class="sub">${e(state.files.join(', '))}</p>
        ${state.errors.length ? `<p class="sub" style="color:var(--danger)">${state.errors.map(e).join('<br>')}</p>` : ''}
        ${rows.length ? `<p class="sub">${months.map(V.monthLabel).join(', ')} · 관내출장 ${rows.filter(r => r.kind === '출장').length}줄, 특근 ${rows.filter(r => r.kind === '특근').length}줄을 읽었습니다.${rows.length - fresh.length ? ` 이미 있는 ${rows.length - fresh.length}줄은 건너뜁니다.` : ''}</p>
          <div class="table-wrap"><table class="tbl bulk-tbl"><thead><tr><th>구분</th><th>날짜</th><th>성명</th><th>출장지</th><th>용무·내용</th><th>시간</th><th>복명</th><th>비고</th></tr></thead><tbody>
          ${rows.map(r => `<tr class="${r.dup ? 'muted' : ''}"><td>${r.kind}${r.dup ? ' <span class="sub">(있음)</span>' : ''}</td><td class="num">${e(r.date)}</td><td><b>${e(r.staff)}</b></td><td>${e(r.place)}</td><td>${e(r.purpose)}</td><td class="nowrap">${e(r.time)}</td><td>${e(r.report.join(', '))}</td><td>${e(r.note)}</td></tr>`).join('')}
          </tbody></table></div>` : state.errors.length ? '' : '<p class="sub">명령부 표(출장일 또는 특근일자 칸)를 찾지 못했습니다.</p>'}
      </div>
      <div class="dr-foot"><button class="btn" type="button" data-act="dr-close">취소</button><button class="btn btn-primary" type="button" data-act="od-hwp-commit" ${fresh.length ? '' : 'disabled'}>${fresh.length}줄 가져오기</button></div>`;
  }
  function commitHwp(rows) {
    const fresh = rows.filter(r => !r.dup).map(({ dup, ...r }) => r);
    S.upsertMany('trip', fresh);
    const last = fresh.map(r => r.date.slice(0, 7)).sort().pop();
    if (last) { ui.orders.month = last; ui.orders.kind = fresh.some(r => r.kind === '출장' && r.date.startsWith(last)) ? '출장' : '특근'; }
    return fresh.length;
  }

  /* ================= 개발대장 ================= */
  /** 공유 시트 '구인업체 개발 대장' 열 순서: 등록일, 업체명, 주소, 전화번호, 대표명(담당자), 직종/직무, 근무시간, 복리후생(기타), 비고, 실적 진행도, 상담자 */
  const progressOf = b => b.progress || ((b.jobAnalyses || []).length ? '직무분석지 작성완료' : S.actsOf('biz', b.id).some(a => a.type === '방문') ? '방문완료' : '');
  function ledgerTsv(list) {
    return tsv([...list].sort((a, b) => (a.discoveredAt || '').localeCompare(b.discoveredAt || '')).map(b => {
      const people = S.cardsOf('biz', b.id).map(c => `${c.name}${c.title ? ' ' + c.title : ''}`).join(' ') || b.ceo || '';
      return [b.discoveredAt, b.name, b.address, b.phone || phoneOf(b), people, b.jobs, b.workConditions, b.welfare, b.memo, progressOf(b), b.staff];
    }));
  }

  return { ui, bulkState, bulkSummary, bulkDocs, bulkFile, jobLink, siteName, contactsPage, contactsResults, contactTsv, reportTsv, addContact, parsePaste, pasteDialog, commitPaste, ordersPage, ordersResults, importVisits, ordersTsv, orderDoc, orderDocsEach, orderFile, parseOrderTables, markDup, hwpDialog, commitHwp, ledgerTsv, progressOf };
})();
