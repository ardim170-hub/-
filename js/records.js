/* 연락이력 · 방문 보고 · 출장/특근 명령부 · 개발대장
   복지관이 지금 쓰는 구글 시트·한글 서식과 같은 열 순서로 보여주고 복사할 수 있게 한다. */
window.R = (() => {
  const e = U.esc;
  const ui = {
    contacts: { month: U.today().slice(0, 7), tab: 'log', q: '' },
    orders: { month: U.today().slice(0, 7), kind: '출장' },
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
  const trips = (month, kind) => S.view().trips.filter(t => t.kind === kind && (t.date || '').startsWith(month)).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.staff || '').localeCompare(b.staff || ''));
  function ordersPage() {
    const f = ui.orders;
    return `
      <div class="page-head">
        <div><h1 class="page-title">출장·특근 명령부</h1><div class="page-desc">현장중심센터 월별 관내출장 명령부와 특근 명령부를 만들고, 한글 서식 모양으로 인쇄합니다.</div></div>
      </div>
      <div class="toolbar perf-bar">${monthNav('od-month', f.month)}
        <div class="chips"><button type="button" class="chip ${f.kind === '출장' ? 'on' : ''}" data-act="od-kind" data-kind="출장">관내출장 명령부</button><button type="button" class="chip ${f.kind === '특근' ? 'on' : ''}" data-act="od-kind" data-kind="특근">특근 명령부</button></div>
      </div>
      <div id="odResults"></div>`;
  }
  function ordersResults() {
    const f = ui.orders;
    const list = trips(f.month, f.kind);
    const staffOpts = sel => opts([...new Set([...S.staff().map(s => s.name), sel].filter(Boolean))], sel);
    const cell = (t, k, attrs = '') => `<input class="input sm" data-chg="trip-field" data-id="${t.id}" data-field="${k}" value="${e(t[k] || '')}" ${attrs}>`;
    const trip = f.kind === '출장';
    const imported = new Set(S.get().trips.map(t => t.actId).filter(Boolean));
    const visitsLeft = trip ? S.view().activities.filter(a => (a.type === '방문' || (a.targetType === 'net' && ['미팅', '행사', '홍보'].includes(a.type))) && a.date.startsWith(f.month) && !imported.has(a.id)).length : 0;
    return `<section class="panel">
      <div class="panel-pad perf-actions">
        <div class="inline">
          ${trip ? `<button class="btn" type="button" data-act="od-import" ${visitsLeft ? '' : 'disabled'}>이 달 방문 기록 불러오기${visitsLeft ? ` (${visitsLeft}건)` : ''}</button>` : ''}
          <button class="btn" type="button" data-act="od-add">+ 줄 추가</button>
          <button class="btn" type="button" data-act="od-hwp">한글 명령부 불러오기</button>
        </div>
        <div class="inline"><button class="btn" type="button" data-act="od-copy" ${list.length ? '' : 'disabled'}>${V.I.copy}한글 표용 복사</button><button class="btn btn-primary" type="button" data-act="od-print" ${list.length ? '' : 'disabled'}>전체 한 장 인쇄</button></div>
      </div>
      ${list.length ? `<div class="panel-pad od-each">
        <div class="od-each-head"><b>담당자별 명령부</b><span class="sub">한 사람당 한 장씩, 결재란(담당·팀장)이 따로 들어갑니다.</span>
          <span class="inline"><button class="btn btn-sm" type="button" data-act="od-print-each">전원 한 장씩 인쇄</button><button class="btn btn-sm" type="button" data-act="od-file">전원 파일 받기</button></span></div>
        <div class="od-each-list">${orderStaff().map(s => { const n = list.filter(t => (t.staff || '(담당자 없음)') === s).length; return `<div class="od-each-item"><span><b>${e(s)}</b> <span class="sub">${n}건</span></span><span class="inline"><button class="btn btn-sm" type="button" data-act="od-print" data-staff="${e(s)}">인쇄 · PDF</button><button class="btn btn-sm" type="button" data-act="od-file" data-staff="${e(s)}">파일 받기</button></span></div>`; }).join('')}</div>
      </div>` : ''}
      <p class="sub perf-help">${trip ? '방문 기록을 불러오면 출장일·성명·출장지·출장용무가 채워집니다. 함께 간 직원은 <b>동행 추가</b>로 한 줄 더 만드세요.' : '특근한 날짜와 시간, 업무 내용을 적습니다.'} 칸을 고치면 바로 저장됩니다.</p>
      ${list.length ? `<div class="table-wrap"><table class="tbl od-tbl"><thead><tr>${trip
        ? '<th>출장일</th><th>성명</th><th>출장지</th><th>출장용무</th><th>방법</th><th>출장시간</th><th>출장복명</th><th>비고</th><th></th>'
        : '<th>특근일자</th><th>성명</th><th>부서명</th><th>특근시간</th><th>특근 업무내용</th><th>비고</th><th></th>'}</tr></thead><tbody>
        ${list.map(t => `<tr>
          <td>${cell(t, 'date', 'type="date"')}</td>
          <td><select class="select sm" data-chg="trip-field" data-id="${t.id}" data-field="staff">${staffOpts(t.staff)}</select></td>
          ${trip ? `<td>${cell(t, 'place')}</td><td>${cell(t, 'purpose')}</td>
            <td><input class="input sm" list="odMethods" data-chg="trip-field" data-id="${t.id}" data-field="method" value="${e(t.method || '')}"></td>
            <td>${cell(t, 'time', 'placeholder="9 ~ 12시"')}</td>
            <td class="nowrap">${D.TRIP_REPORTS.map(r => `<label class="check"><input type="checkbox" data-chg="trip-report" data-id="${t.id}" value="${r}" ${(t.report || []).includes(r) ? 'checked' : ''}>${r}</label>`).join(' ')}</td>
            <td>${cell(t, 'note')}</td>`
          : `<td>${cell(t, 'dept', 'placeholder="직업"')}</td><td>${cell(t, 'time', 'placeholder="14 ~ 18시"')}</td><td>${cell(t, 'purpose')}</td><td>${cell(t, 'note')}</td>`}
          <td class="nowrap">${trip ? `<button class="btn btn-ghost btn-sm" type="button" data-act="od-dup" data-id="${t.id}">동행 추가</button>` : ''}<button class="icon-btn" type="button" aria-label="삭제" data-act="od-del" data-id="${t.id}">${V.I.close}</button></td>
        </tr>`).join('')}
      </tbody></table></div><datalist id="odMethods">${D.TRIP_METHODS.map(m => `<option value="${e(m)}">`).join('')}</datalist>`
      : `<div class="empty"><strong>${V.monthLabel(f.month)} ${trip ? '관내출장' : '특근'} 명령부가 비어 있습니다</strong>${trip ? '방문 기록을 불러오거나, 예전에 쓴 한글 명령부를 불러오거나, 줄을 추가하세요.' : '한글 명령부를 불러오거나 줄 추가로 특근 기록을 넣으세요.'}</div>`}
    </section>`;
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
  const orderStaff = () => { const f = ui.orders; return [...new Set(trips(f.month, f.kind).map(t => t.staff || '(담당자 없음)'))]; };
  const orderTitle = kind => kind === '출장' ? '관내출장 명령부' : '특근 명령부';
  /** staff를 주면 그 담당자 줄만 모아 결재란이 따로 있는 한 장을 만든다. 없으면 전체 */
  function orderDoc(staff) {
    const f = ui.orders;
    const list = trips(f.month, f.kind).filter(t => staff == null || (t.staff || '(담당자 없음)') === staff);
    const trip = f.kind === '출장';
    const sign = '<table class="sign"><tr><th rowspan="2" class="sign-side">결<br>재</th><th>담 당</th><th>팀 장</th></tr><tr><td></td><td></td></tr></table>';
    return `<article class="doc order-doc">
      <div class="order-head">${sign}</div>
      <h1>${orderTitle(f.kind)}</h1>
      <p class="order-sub">${V.monthLabel(f.month)} · 화성시아르딤복지관 직업지원팀 (현장중심직업재활센터)${staff != null ? ` · <b>${trip ? '출장자' : '특근자'}: ${e(staff)}</b>` : ''}</p>
      <table class="doc-tbl"><thead><tr>${trip ? '<th>출장일</th><th>성명</th><th>출장지</th><th>출장용무</th><th>방 법</th><th>출장시간</th><th>출장복명</th><th>비고</th>' : '<th>특근일자</th><th>특근자 성명</th><th>부서명</th><th>특근시간</th><th>특 근 업 무 내 용</th>'}</tr></thead><tbody>
      ${list.map(t => trip
        ? `<tr><td>${e(md(t.date))}</td><td>${e(t.staff)}</td><td>${e(t.place)}</td><td>${e(t.purpose)}</td><td>${e(t.method)}</td><td>${e(t.time)}</td><td class="nowrap">${D.TRIP_REPORTS.map(r => `${r} ${(t.report || []).includes(r) ? '■' : '□'}`).join('<br>')}</td><td>${e(t.note)}</td></tr>`
        : `<tr><td>${e(md(t.date))}</td><td>${e(t.staff)}</td><td>${e(t.dept || '직업')}</td><td>${e(t.time)}</td><td>${e(t.purpose)}${t.note ? `<br>${e(t.note)}` : ''}</td></tr>`).join('')}
      </tbody></table>
    </article>`;
  }
  /** 담당자마다 한 장씩, 페이지를 나눠 이어 붙인다 */
  const orderDocsEach = () => orderStaff().map(orderDoc).join('');
  /** 한글에서 열 수 있는 워드 호환 문서(.doc)로 저장 */
  function orderFile(staff) {
    const f = ui.orders;
    const css = 'body{font-family:"맑은 고딕",sans-serif;font-size:10pt}h1{text-align:center;font-size:18pt;letter-spacing:4px;margin:6pt 0}.order-head{text-align:right}.sign{margin-left:auto;border-collapse:collapse}.sign th,.sign td{border:1px solid #000;width:60pt;text-align:center;padding:2pt}.sign td{height:40pt}.sign .sign-side{width:18pt}.order-sub{text-align:center}.doc-tbl{width:100%;border-collapse:collapse}.doc-tbl th,.doc-tbl td{border:1px solid #000;padding:3pt;text-align:center}.doc-tbl th{background:#eee}';
    const body = staff == null ? orderDocsEach().replace(/<\/article><article/g, '</article><br style="page-break-before:always"><article') : orderDoc(staff);
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

  return { ui, jobLink, siteName, contactsPage, contactsResults, contactTsv, reportTsv, addContact, parsePaste, pasteDialog, commitPaste, ordersPage, ordersResults, importVisits, ordersTsv, orderDoc, orderDocsEach, orderFile, parseOrderTables, markDup, hwpDialog, commitHwp, ledgerTsv, progressOf };
})();
