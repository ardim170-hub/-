/* 연락이력 · 방문 보고 · 출장/특근 명령부 · 개발대장
   복지관이 지금 쓰는 구글 시트·한글 서식과 같은 열 순서로 보여주고 복사할 수 있게 한다. */
window.R = (() => {
  const e = U.esc;
  const ui = {
    contacts: { month: U.today().slice(0, 7), tab: 'log', q: '' },
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
  /** 연락이력은 그 구역 담당자가 남긴 것만 (다른 구역 직원이 같은 사업체에 연락한 기록은 그 구역 화면에) */
  function contactRows(month, v = S.view(), sc = S.getScope()) {
    return v.activities
      .filter(a => a.targetType === 'biz' && a.fromPerf !== 'Y' && CONTACT_TYPES.includes(a.type) && a.date.startsWith(month) && S.inScope(a.staff, sc)) // 실적 화면에서 넣은 것은 연락이력이 아님
      .map(a => ({ a, b: S.find('biz', a.targetId) })).filter(r => r.b)
      .sort((x, y) => x.a.date.localeCompare(y.a.date) || x.a.id.localeCompare(y.a.id));
  }
  /** 연락 결과 세 가지: 완료(체크한 것) / 진행중 / 실패. 체크 안 한 줄은 연락결과로 짐작 (채용안함·채용마감 = 실패) */
  const OUTCOMES = [['완료', 'done', '✔'], ['진행중', 'going', '…'], ['실패', 'fail', '✕']];
  const outcomeOf = a => (['완료', '진행중', '실패'].includes(a.outcome) ? a.outcome : a.type === '채용연계' ? '완료' : ['채용안함', '채용마감'].includes(a.result) ? '실패' : '진행중');
  const ocCls = a => OUTCOMES.find(o => o[0] === outcomeOf(a))[1];
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

  /** 이 구역 담당자: 이름표(색) + 빼기 ×, 이름 넣고 + 추가 (관리자). 고른 사람만 연락이력 상담자로 고를 수 있다 */
  function secStaffBar() {
    const sc = S.getScope(), prog = sc.startsWith('p:') ? sc.slice(2) : '';
    if (!prog) return '';
    const list = S.staffHere(), admin = S.isAdmin(), label = D.progLabel(prog);
    return `<section class="panel panel-pad sec-staff">
      <b>${e(label)} 담당자</b>
      ${list.length ? list.map(x => `<span class="sec-staff-chip">${V.staffDot(x.name)}${e(x.name)}${admin ? `<button type="button" class="od-staff-del" data-act="od-staff-del" data-name="${e(x.name)}" aria-label="${e(x.name)} 빼기" title="담당자 목록에서 빼기">×</button>` : ''}</span>`).join('') : '<span class="sub">아직 이 구역 담당자가 없어요. 이름을 넣고 추가해야 연락·실적 기록을 넣을 수 있어요.</span>'}
      ${admin ? `<span class="od-staff-add"><input class="input sm" id="secStaffNew" placeholder="담당자 이름" style="width:130px"><button class="btn btn-sm" type="button" data-act="sec-staff-add" data-prog="${e(prog)}">+ 추가</button></span>` : '<span class="sub">담당자 추가·빼기는 관리자만 할 수 있어요.</span>'}
    </section>`;
  }

  function contactsPage() {
    const f = ui.contacts;
    const names = S.get().businesses.map(b => b.name);
    return `
      <div class="page-head">
        <div><h1 class="page-title">연락이력</h1><div class="page-desc">사업체 연락·방문을 한 줄씩 기록하고, 공유 시트의 연락이력·보고용 시트 모양 그대로 복사합니다.</div></div>
        <div class="inline"><button class="btn" type="button" data-act="ct-paste">붙여넣기·엑셀 파일로 한 번에 가져오기</button><button class="btn btn-primary" type="button" data-act="month-xlsx" data-month="${f.month}">📊 ${V.monthLabel(f.month)} 엑셀로 정리</button></div>
      </div>
      <div class="toolbar perf-bar">${monthNav('ct-month', f.month)}
        <div class="chips"><button type="button" class="chip ${f.tab === 'log' ? 'on' : ''}" data-act="ct-tab" data-tab="log">연락이력</button><button type="button" class="chip ${f.tab === 'report' ? 'on' : ''}" data-act="ct-tab" data-tab="report">보고용 (방문 사업체)</button></div>
      </div>
      ${secStaffBar()}
      <section class="panel panel-pad perf-input">
        <div class="ct-add-head"><h2 class="section-title">연락 기록 추가 <span class="sub">처음 보는 곳은 <b>미등록</b>으로 연락이력에만 남아요. 아래 목록에서 <b>사업체 등록</b>을 눌러야 사업체 개발·지도에 올라가요</span></h2>
          <span class="ct-shot"><button class="btn btn-sm" type="button" data-act="ct-shot">📷 캡처로 채우기</button><span class="sub">구인공고·문자 캡처를 고르거나, 이 화면에서 <b>Ctrl+V</b>로 붙여넣으면 칸을 채워 줘요</span></span></div>
        <form class="perf-form" data-form="ct-add" autocomplete="off">
          <label>날짜<input class="input" type="date" name="date" value="${f.month === U.today().slice(0, 7) ? U.today() : f.month + '-01'}" required></label>
          <label>방식<select class="select" name="type">${opts(CONTACT_TYPES, '전화')}</select></label>
          <label>상담자<select class="select" name="staff">${S.staffHere().map(x => `<option ${x.name === S.me() ? 'selected' : ''}>${e(x.name)}</option>`).join('')}</select></label>
          <label class="grow">사업체명<input class="input" name="name" list="ctBizList" required placeholder="예: (주)한결테크"></label>
          <label>전화번호<input class="input" name="phone" inputmode="tel"></label>
          <label>담당자<input class="input" name="contactName" placeholder="예: 김재윤 부장"></label>
          <label>직종<input class="input" name="jobType" placeholder="예: 단순 제조 종사원"></label>
          <label class="grow">결과<input class="input" name="content" placeholder="예: 전화 안받음 / 장애인 채용 안함 (비우면 '전화 연락'으로)"></label>
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

  /* ---------- 담당자별 연락 현황 (상급자 보기용): 사람마다 한 줄, 방식별로 나눈 막대 + 숫자 ---------- */
  const TYPE_COLOR = { '전화': '#2a78d6', '방문': '#eb6834', '이메일': '#1baf7a', '미팅': '#eda100' }; // 검증한 순서 (색맹 구분 통과)
  function staffChart(rows, month) {
    const names = [...new Set([...S.staffHere().map(x => x.name), ...rows.map(r => r.a.staff).filter(Boolean)])];
    if (!names.length) return '';
    const by = names.map(n => {
      const mine = rows.filter(r => r.a.staff === n);
      const t = Object.fromEntries(CONTACT_TYPES.map(k => [k, mine.filter(r => r.a.type === k).length]));
      return { n, t, total: mine.length, biz: new Set(mine.map(r => r.b.id)).size, willing: new Set(mine.filter(r => r.a.result === '채용의향 있음').map(r => r.b.id)).size, days: new Set(mine.map(r => r.a.date)).size };
    });
    const max = Math.max(1, ...by.map(x => x.total));
    const legend = CONTACT_TYPES.map(k => `<span><i style="background:${TYPE_COLOR[k]}"></i>${k}</span>`).join('');
    const bar = x => CONTACT_TYPES.filter(k => x.t[k]).map(k => `<i class="scb-seg" style="width:${x.t[k] / max * 100}%;background:${TYPE_COLOR[k]}" title="${e(x.n)} · ${k} ${x.t[k]}건"></i>`).join('');
    return `<section class="panel panel-pad staff-chart">
      <div class="sc-head"><h2 class="section-title">👥 담당자별 연락 현황 <span class="sub">${V.monthLabel(month)} · 누가 얼마나 연락했는지</span></h2><div class="scb-legend">${legend}</div></div>
      <div class="scb-rows">${by.map(x => `<div class="scb-row">
        <span class="scb-name">${e(x.n)}</span>
        <div class="scb-track" role="img" aria-label="${e(x.n)} ${x.total}건: ${CONTACT_TYPES.map(k => `${k} ${x.t[k]}`).join(', ')}">${bar(x) || '<span class="scb-zero">이 달 기록 없음</span>'}</div>
        <span class="scb-total"><b class="num">${x.total}</b>건</span>
        <span class="scb-meta">${CONTACT_TYPES.filter(k => x.t[k]).map(k => `${k} ${x.t[k]}`).join(' · ') || '-'}<br>사업체 ${x.biz}곳 · ${x.days}일${x.willing ? ` · 채용의향 ${x.willing}곳` : ''}</span>
      </div>`).join('')}</div>
      <details class="scb-table"><summary>표로 보기</summary><div class="table-wrap"><table class="tbl"><thead><tr><th>담당자</th>${CONTACT_TYPES.map(k => `<th class="r">${k}</th>`).join('')}<th class="r">합계</th><th class="r">사업체</th><th class="r">연락한 날</th><th class="r">채용의향</th></tr></thead>
        <tbody>${by.map(x => `<tr><th>${e(x.n)}</th>${CONTACT_TYPES.map(k => `<td class="r num">${x.t[k]}</td>`).join('')}<td class="r num"><b>${x.total}</b></td><td class="r num">${x.biz}</td><td class="r num">${x.days}</td><td class="r num">${x.willing}</td></tr>`).join('')}</tbody></table></div></details>
    </section>`;
  }

  /** 예전에 연락이력(입력·가져오기)으로 자동 등록된 사업체: 연락 기록만 있고 명함·일정·실적·지원 진행이 없는 곳 */
  function autoBiz() {
    const st = S.get();
    const by = new Map();
    st.activities.forEach(a => { if (a.targetType === 'biz') { const l = by.get(a.targetId) || []; l.push(a); by.set(a.targetId, l); } });
    const evIds = new Set(st.events.filter(x => x.targetType === 'biz').map(x => x.targetId));
    const cardIds = new Set(st.cards.filter(c => c.linkType === 'biz').map(c => c.linkId));
    return st.businesses.filter(b => !S.isPending(b) && (b.source === '현장 발굴' || b.source === '연락이력') && b.stage !== '채용연계' && !S.supportOf(b).types.length && !cardIds.has(b.id) && !evIds.has(b.id) && S.inScope(b.staff)
      && (by.get(b.id) || []).length && (by.get(b.id) || []).every(a => a.fromPerf !== 'Y' && (CONTACT_TYPES.includes(a.type) || (a.type === '발굴' && /연락이력/.test(a.content || '')))))
      .map(b => ({ b, acts: (by.get(b.id) || []).filter(a => a.type !== '발굴') })).sort((x, y) => (x.b.discoveredAt || '').localeCompare(y.b.discoveredAt || ''));
  }
  function autoBizPanel() {
    if (ui.contacts.autoHide) return '';
    const list = autoBiz();
    if (!list.length) return '';
    return `<details class="panel-pad reg-clean" ${ui.contacts.autoOpen ? 'open' : ''}><summary data-act="ct-auto-open"><b>🧹 연락이력으로 자동 등록됐던 사업체 ${list.length}곳 정리</b> <span class="sub">연락만 한 곳이 사업체 개발·지도에 올라가 있어요. 뺄 곳을 골라 미등록으로 돌리세요 (연락 기록은 그대로)</span></summary>
      <div class="inline" style="margin:8px 0"><button class="btn btn-sm" type="button" data-act="ct-auto-all" data-v="1">모두 고르기</button><button class="btn btn-sm" type="button" data-act="ct-auto-all" data-v="0">모두 풀기</button><button class="btn btn-sm btn-primary" type="button" data-act="ct-unreg">고른 곳 미등록으로 (사업체·지도에서 빼기)</button><button class="btn btn-sm btn-ghost" type="button" data-act="ct-auto-hide">이대로 두기</button></div>
      <div class="table-wrap" style="max-height:420px"><table class="tbl"><thead><tr><th></th><th>사업체명</th><th>단계</th><th>처음 연락</th><th class="r">연락</th><th>최근 결과</th><th>담당</th></tr></thead><tbody>
        ${list.map(({ b, acts }) => { const last = acts.slice().sort((x, y) => y.date.localeCompare(x.date))[0] || {}; return `<tr><td><input type="checkbox" class="reg-pick" value="${b.id}" checked aria-label="${e(b.name)} 미등록으로"></td><td><b class="link" data-act="open" data-kind="biz" data-id="${b.id}">${e(b.name)}</b></td><td>${e(b.stage || '')}</td><td class="num nowrap">${e(b.discoveredAt || '')}</td><td class="r num">${acts.length}</td><td class="clip" title="${e(last.content || '')}">${e(last.result || last.content || '')}</td><td>${e(b.staff || '')}</td></tr>`; }).join('')}
      </tbody></table></div></details>`;
  }
  /** 이미 네트워크에 있는 같은 기관 (이름·전화로) */
  function sameNet(b) {
    const o = resolveOrg(b.name, b.phone, orgIndex().filter(x => x.kind === 'net'));
    return o ? o.x : null;
  }
  /** 미등록 → 사업체(그대로 보이게) 또는 기관(네트워크로 옮기고 연락 기록도 기관 기록으로) */
  function registerBiz(id, kind) {
    const b = S.find('biz', id);
    if (!b) return null;
    if (kind !== 'net') { S.upsert('biz', { id, pending: '' }); return { kind: 'biz', x: b }; }
    // 네트워크에 같은 기관이 이미 있으면 새로 만들지 않고 그 기관으로 옮긴다
    const same = sameNet(b);
    const n = same || S.upsert('net', { name: b.name, category: D.guessCategory(b.name) || '복지기관', status: '보통', phone: b.phone || '', address: b.address || '', since: b.discoveredAt || U.today(), staff: b.staff || S.me(), programs: b.programs || [], relation: '', promo: '', memo: b.memo || '' });
    const moves = S.get().activities.filter(a => a.targetType === 'biz' && a.targetId === id).map(a => ({ id: a.id, targetType: 'net', targetId: n.id }));
    if (moves.length) S.putMany('act', moves);
    const cards = S.get().cards.filter(c => c.linkType === 'biz' && c.linkId === id).map(c => ({ id: c.id, linkType: 'net', linkId: n.id }));
    if (cards.length) S.putMany('card', cards);
    S.remove('biz', id);
    return { kind: 'net', x: n };
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
          ${visits.map(({ a, b }) => `<tr class="sc-row" style="--sc:${V.staffColor(a.staff)}" title="${e(a.staff || '')}"><td class="num">${U.dateDot(a.date)}</td><td><b class="link" data-act="open" data-kind="biz" data-id="${b.id}">${e(b.name)}</b></td><td class="clip" title="${e(b.address)}">${e(b.address || '')}</td>
            <td>${e(phoneOf(b))}<div class="meta">${e(a.contactName || contactOf(b))}</div></td><td class="wrap">${e(a.content)}</td>
            <td><select class="select sm" data-chg="act-field" data-id="${a.id}" data-field="training">${opts(['유', '무'], a.training, '-')}</select></td>
            <td><select class="select sm" data-chg="act-field" data-id="${a.id}" data-field="procedure">${opts(D.PROCEDURES, a.procedure, '-')}</select></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="empty"><strong>${V.monthLabel(f.month)}에 방문 기록이 없습니다</strong>방식을 '방문'으로 골라 기록하면 여기에 나옵니다.</div>`}
      </section>`;
    }
    const all = rows, ocN = k => all.filter(r => outcomeOf(r.a) === k).length;
    const shown = f.oc ? all.filter(r => outcomeOf(r.a) === f.oc) : all;
    const ocBar = `<div class="oc-bar"><div class="chips" role="tablist" aria-label="진행 결과로 거르기"><button type="button" class="chip ${!f.oc ? 'on' : ''}" data-act="ct-ocf" data-v="">전체 <span class="n">${all.length}</span></button>${OUTCOMES.map(([k, c, ic]) => `<button type="button" class="chip oc-chip ${c} ${f.oc === k ? 'on' : ''}" data-act="ct-ocf" data-v="${k}"><i class="oc-dot ${c}"></i>${k} <span class="n">${ocN(k)}</span></button>`).join('')}</div>
      <span class="sub">줄 오른쪽 <b>✔ 완료 · … 진행중 · ✕ 실패</b>를 눌러 체크하세요. 체크하지 않은 줄은 연락결과가 채용안함·채용마감이면 실패, 나머지는 진행중으로 보여요.</span></div>`;
    return kpi + staffChart(rows, f.month) + `<section class="panel">
      <div class="panel-pad perf-actions"><h2 class="section-title">${V.monthLabel(f.month)} 연락이력 <span class="sub num">${rows.length}건</span> <span class="oc-sum"><i class="oc-dot done"></i>완료 ${ocN('완료')} · <i class="oc-dot going"></i>진행중 ${ocN('진행중')} · <i class="oc-dot fail"></i>실패 ${ocN('실패')}</span></h2>
        <button class="btn btn-primary" type="button" data-act="ct-copy" ${rows.length ? '' : 'disabled'}>${V.I.copy}연락이력 시트용 복사</button></div>
      <p class="sub perf-help">공유 시트 <b>○월 연락이력</b> 탭에서 새 줄의 <b>날짜</b> 칸을 누르고 Ctrl+V 하세요. (날짜 · 사업체명 · 주소 · 전화번호 · 담당자 · 직종 · 결과 · 연락결과 · 상태 · 상담자)</p>
      ${rows.length ? ocBar : ''}
      ${(() => { const pend = [...new Map(all.filter(r => S.isPending(r.b)).map(r => [r.b.id, r.b])).values()]; return pend.length ? `<div class="reg-bar"><span><span class="badge reg-no">미등록</span> 이 달 연락한 곳 중 <b>${pend.length}곳</b>은 사업체·지도에 안 올라가 있어요. 올릴 곳만 줄의 <b>✏️ 사업체 등록</b> / <b>✏️ 기관 등록</b>을 눌러 직접 입력하세요. (연락 기록은 등록한 곳으로 이어져요)</span></div>` : ''; })()}
      ${autoBizPanel()}
      ${shown.length ? `<div class="table-wrap"><table class="tbl perf-tbl ct-tbl"><thead><tr><th>진행</th><th class="r">번호</th><th>날짜</th><th>사업체명</th><th>주소</th><th>전화번호</th><th>담당자</th><th>직종</th><th>결과</th><th>연락결과</th><th>상태</th><th>상담자</th><th>방식</th><th>구인공고</th><th></th></tr></thead><tbody>
        ${shown.map(({ a, b }, i) => `<tr class="sc-row oc-row ${ocCls(a)}${f.flash === a.id ? ' pt-new' : ''}" data-row="${a.id}" style="--sc:${V.staffColor(a.staff)}" title="기록: ${e(a.staff || '')}"><td class="oc-cell"><div class="oc-seg" role="group" aria-label="진행 결과">${OUTCOMES.map(([k, c, ic]) => `<button type="button" class="${c} ${outcomeOf(a) === k ? 'on' : ''} ${a.outcome === k ? 'set' : ''}" data-act="ct-oc" data-id="${a.id}" data-v="${k}" title="${k}${a.outcome === k ? ' (체크함)' : outcomeOf(a) === k ? ' (자동으로 짐작 · 눌러서 확정)' : ''}" aria-pressed="${outcomeOf(a) === k}">${ic} ${k}</button>`).join('')}</div></td><td class="r num">${i + 1}</td><td class="num"><input class="input sm ct-date" type="date" value="${a.date}" data-chg="act-field" data-id="${a.id}" data-field="date" aria-label="날짜"></td><td><b class="link" data-act="open" data-kind="biz" data-id="${b.id}">${e(b.name)}</b>${S.isPending(b) ? (() => { const sn = sameNet(b), inst = !!sn || INST.test(b.name); return `<div class="reg-box"><span class="badge reg-no" title="연락만 한 곳 · 사업체 개발·지도에 안 나와요">미등록</span><button class="btn btn-sm reg-btn ${inst ? '' : 'pri'}" type="button" data-act="ct-reg-form" data-kind="biz" data-id="${b.id}" title="사업체 등록 화면을 열어요. 내용을 직접 넣고 저장하면 사업체·지도에 올라가요">✏️ 사업체 등록</button>${sn ? `<button class="btn btn-sm reg-btn pri" type="button" data-act="ct-reg" data-kind="net" data-id="${b.id}" title="네트워크에 이미 있는 '${e(sn.name)}'에 이 연락 기록을 붙여요">↪ 기관 '${e(sn.name)}'에 붙이기</button>` : `<button class="btn btn-sm reg-btn ${inst ? 'pri' : ''}" type="button" data-act="ct-reg-form" data-kind="net" data-id="${b.id}" title="기관 등록 화면을 열어요. 내용을 직접 넣고 저장하면 네트워크·지도에 올라가요">✏️ 기관 등록</button>`}</div>`; })() : ''}</td><td class="clip" title="${e(b.address)}">${e(b.address || '')}</td>
          <td class="num">${e(phoneOf(b))}</td><td>${e(a.contactName || contactOf(b))}</td><td class="clip">${e(a.jobType || b.jobs || '')}</td><td class="wrap"><textarea class="input sm ct-txt" rows="1" data-chg="act-field" data-id="${a.id}" data-field="content" aria-label="결과">${e(a.content)}</textarea></td>
          <td><select class="select sm" data-chg="act-field" data-id="${a.id}" data-field="result">${opts(D.CONTACT_RESULTS, a.result, '-')}</select></td>
          <td><select class="select sm" data-chg="act-field" data-id="${a.id}" data-field="status">${opts(D.CONTACT_STATUS, a.status, '-')}</select></td>
          <td>${e(a.staff || '')}</td><td><span class="badge">${e(a.type)}</span></td>
          <td class="nowrap">${jobLink(a.jobUrl) ? `<a class="btn btn-sm btn-job" href="${e(jobLink(a.jobUrl))}" target="_blank" rel="noopener" title="${e(a.jobUrl)}">공고 보기 · ${e(siteName(a.jobUrl))}</a><button class="icon-btn" type="button" style="width:28px;height:28px" aria-label="공고 주소 바꾸기" data-act="ct-url" data-id="${a.id}">${V.I.edit}</button>`
            : `<input class="input sm url-in" data-chg="act-field" data-id="${a.id}" data-field="jobUrl" placeholder="공고 주소 붙여넣기" aria-label="구인공고 주소">`}</td>
          <td><button class="icon-btn" type="button" aria-label="이 연락 기록 삭제" title="삭제" data-act="act-del" data-id="${a.id}">${V.I.close}</button></td></tr>`).join('')}
      </tbody></table></div>` : rows.length ? `<div class="empty"><strong>'${e(f.oc)}'인 연락이 없습니다</strong>위에서 전체를 눌러 보세요.</div>` : `<div class="empty"><strong>${V.monthLabel(f.month)} 연락이력이 없습니다</strong>위 칸에 기록하거나, 공유 시트의 연락이력을 복사해 <b>시트에서 붙여넣어 가져오기</b>로 옮겨 오세요.</div>`}
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
      // 연락만 한 곳은 아직 '개발'이 아니므로 미등록으로 둔다. 연락이력 줄의 '등록'을 눌러야 사업체·지도에 나온다
      b = S.upsert('biz', { name, phone: fd.phone || '', address: fd.address || '', stage: fd.type === '방문' ? '방문상담' : '접촉', discoveredAt: fd.date, source: '연락이력', staff: me, placements: 0, jobs: fd.jobType || '', pending: 'Y' });
    } else {
      const patch = {};
      if (!b.phone && fd.phone) patch.phone = fd.phone;
      if (!b.address && fd.address) patch.address = fd.address;
      if (b.stage === '발굴') patch.stage = fd.type === '방문' ? '방문상담' : '접촉';
      else if (b.stage === '접촉' && fd.type === '방문') patch.stage = '방문상담';
      if (Object.keys(patch).length) S.upsert('biz', { id: b.id, ...patch });
    }
    const act = S.upsert('act', { targetType: 'biz', targetId: b.id, date: fd.date, type: fd.type, content: fd.content.trim(), staff: me, contactName: fd.contactName || '', jobType: fd.jobType || '', result: fd.result || '', status: fd.status || '', jobUrl: (fd.jobUrl || '').trim(), perf: '', people: '' });
    ui.contacts.flash = act.id;
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

  /* ---------- 공유 시트에서 붙여넣거나 엑셀·CSV 파일로 한 번에 가져오기 ---------- */
  const COLS = [['no', ['번호', '연번', 'no', 'No']], ['date', ['날짜', '일자', '연락일', '방문일', '등록일']], ['name', ['사업체명', '업체명', '사업체', '업체', '회사명', '기관명']], ['address', ['주소', '소재지']], ['phone', ['전화번호', '연락처', '전화']], ['contactName', ['담당자', '대표명', '담당자명']], ['jobType', ['직종', '직무', '모집직종']], ['content', ['결과', '내용', '비고', '메모']], ['result', ['연락결과']], ['status', ['상태']], ['staff', ['상담자', '담당직원', '작성자']], ['jobUrl', ['구인공고', '공고주소', '공고 링크', '공고링크', '링크', 'URL', 'url']],
    // 시트마다 있는 덧칸: 내용에 붙이거나(임금·근무시간) 상태로 쓰거나(연락이력), 개발대장 표시(실적 진행도)
    ['wage', ['임금', '급여']], ['hours', ['근무시간']], ['log', ['연락이력']], ['progress', ['실적진행도', '진행도']], ['training', ['현장훈련유/무', '현장훈련']], ['step', ['절차']], ['welfare', ['복리후생']], ['how', ['방식', '연락방식', '유형']]];
  // 머리글이 없거나 모자라면 공유 시트 '○월 연락이력' 열 순서로 본다: 번호, 날짜, 사업체명, 주소, 전화번호, 담당자, 직종, 결과, 연락결과, 상태, 상담자
  const DEFAULT_ORDER = ['no', 'date', 'name', 'address', 'phone', 'contactName', 'jobType', 'content', 'result', 'status', 'staff'];
  /** 엑셀 복사 형식(TSV) 읽기: 줄 바꿈이 든 칸은 "따옴표"로 감싸져 온다 */
  function parseTsv(t) {
    const rows = [[]]; let cur = '', q = false;
    t = String(t).replace(/\r\n?/g, '\n');
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
      if (ch === '"' && cur.trim() === '') { q = true; cur = ''; }
      else if (ch === '\t') { rows[rows.length - 1].push(cur); cur = ''; }
      else if (ch === '\n') { rows[rows.length - 1].push(cur); cur = ''; rows.push([]); }
      else cur += ch;
    }
    rows[rows.length - 1].push(cur);
    return rows;
  }
  const hdrKey = c => { const n = String(c).replace(/\s/g, ''); if (!n) return ''; const hit = COLS.find(([, syn]) => syn.some(s => n === s.replace(/\s/g, ''))) || COLS.find(([, syn]) => syn.some(s => s.length > 1 && n.includes(s))); return hit ? hit[0] : ''; };
  /** 날짜처럼 보이는 칸 → YYYY-MM-DD (연도가 없으면 보고 있는 달의 연도) */
  function dateOf(v, year) {
    if (typeof v === 'number') return v > 20000 && v < 80000 ? U.toDateStr(v) : '';
    const s = String(v || '').replace(/\s/g, '').replace(/[년월]/g, '-').replace(/일$/, '');
    const full = U.toDateStr(s);
    if (full) return full;
    const m = s.match(/^(\d{1,2})[-./](\d{1,2})\.?$/);
    return m && +m[1] <= 12 && +m[2] <= 31 ? `${year}-${U.pad(m[1])}-${U.pad(m[2])}` : '';
  }
  const oneLine = (v, sep = ' ') => String(v ?? '').split('\n').map(x => x.trim()).filter(Boolean).join(sep);
  /** 앞자리 0이 빠진 번호 고치기: 10-1234-5678 → 010-…, 70-… → 070-… */
  const fixPhone = p => oneLine(p, ' / ').replace(/(^|[\s/])(1[016789]\d{7,8}|[3-6]\d{8,9}|70\d{8})(?=$|[\s/])/g, '$10$2').replace(/(^|[\s/])(1[016789]|70)(?=[-)\s]\d)/g, '$10$2');
  /** 결과 글에서 연락결과 고르기 */
  function guessResult(t) {
    const s = String(t || '').replace(/\s/g, '');
    if (!s) return '';
    if (/채용의향있|의향있|채용하니|면접요청|면접진행|협약/.test(s)) return '채용의향 있음';
    if (/마감/.test(s)) return '채용마감';
    if (/채용안|안뽑|거부|거절|채용하지않|힘들|어렵|필요성이없|아님/.test(s)) return '채용안함';
    if (/안받|받지않|부재|자리를비|미응답|신호음|삐소리/.test(s)) return '부재·미응답';
    if (/검토|확인|상의|문의|회의|보고후|연락주기|예정/.test(s)) return '검토중';
    return '';
  }
  const STATUS_WORDS = /^(연락완료|재연락|부재|미연락|연락중|방문완료|방문예정|완료|보류)$/;
  /** 표 한 장(2차원 배열) → 연락 기록 줄 (합치기 전). 머리글 칸 수가 모자라거나 번호 칸이 빠져도 '날짜 칸'을 기준으로 맞춘다 */
  function readTable(cells, year, sheet = '') {
    cells = cells.map(r => (r || []).map(c => (typeof c === 'number' ? c : String(c ?? '').trim())));
    const hdrIdx = cells.slice(0, 30).findIndex(r => r.filter(c => hdrKey(c)).length >= 3 && !r.some(c => dateOf(c, year)));
    let order;
    if (hdrIdx >= 0) {
      order = cells[hdrIdx].map(hdrKey);
      // '연락처/담당자'(전화) 칸과 따로 '담당자' 칸이 결과 뒤에 있으면 그건 우리 직원(상담자)
      const ci = order.indexOf('content');
      if (!order.includes('staff') && ci >= 0) { const late = order.findIndex((k, i) => k === 'contactName' && i > ci); if (late >= 0) order[late] = 'staff'; }
      // 빈 머리글 칸은 앞 칸 다음 순서로 채운다 (예: 전화번호 뒤 이름 없는 칸들 → 담당자·직종·결과…)
      // 단, 아래에 글이 거의 없는 칸(병합된 머리글 자리)은 채우지 않는다
      const body = cells.slice(hdrIdx + 1).filter(r => r.some(c => c !== ''));
      const used = i => body.filter(r => r[i] !== '' && r[i] != null).length >= Math.min(3, body.length);
      for (let i = 0; i < Math.max(order.length, 12); i++) {
        if (order[i] || !used(i)) continue;
        const prev = order[i - 1], at = DEFAULT_ORDER.indexOf(prev);
        const next = at >= 0 ? DEFAULT_ORDER.slice(at + 1).find(k => !order.includes(k)) : '';
        order[i] = next || '';
      }
    } else order = DEFAULT_ORDER.slice();
    // 개발대장(사업체 목록)은 연락 기록이 아니라 사업체만 등록·보완한다
    const ledger = /개발대장/.test(sheet) || order.includes('progress');
    // 개발 현황·보고용 시트는 방문 정리라 기본을 '방문'으로
    const report = order.includes('training') || /현황|보고/.test(sheet);
    const dCol = order.indexOf('date');
    const body = hdrIdx >= 0 ? cells.slice(hdrIdx + 1) : cells;
    const out = [];
    let lastDate = '', skipped = 0;
    body.forEach(r => {
      if (!r.some(c => c !== '' && c != null)) return;
      // 날짜 칸 찾기 (머리글 위치 근처를 먼저)
      const cand = [dCol, dCol + 1, dCol - 1, ...r.keys()].filter(i => i >= 0 && i < r.length);
      let di = cand.find(i => dateOf(r[i], year));
      let date = di == null ? '' : dateOf(r[di], year);
      // 날짜 칸을 비워 둔 줄(같은 날 이어 적기)은 바로 위 줄 날짜로 본다
      if (di == null && lastDate && dCol >= 0 && (r[dCol] === '' || r[dCol] == null)) { di = dCol; date = lastDate; }
      if (di == null) { skipped++; return; }
      const shift = dCol >= 0 ? di - dCol : 0;
      const o = {};
      order.forEach((k, i) => { const v = r[i + shift]; if (k && v != null && v !== '' && o[k] == null) o[k] = v; });
      o.date = date;
      o.name = oneLine(o.name).replace(/\s+/g, ' ');
      if (!o.name || /^\d+$/.test(o.name) || hdrKey(o.name) === 'name') { skipped++; return; }
      lastDate = date;
      o.address = String(o.address || '').trim();
      // 주소 칸에 공고 설명을 적어 둔 줄 → 결과(내용)로 옮긴다
      if (/^\*|직무내용|근무시간|수습기간|급여|우대/.test(o.address)) { o.content = [oneLine(o.address, ' · ').replace(/^\*\s*/, '').replace(/\s*·\s*\*\s*/g, ' · '), o.content].filter(Boolean).join(' / '); o.address = ''; }
      o.address = oneLine(o.address).replace(/,\s*$/, '');
      // '연락처/담당자' 한 칸에 번호와 이름이 같이 있으면 나눈다
      const ph = String(o.phone || '').split('\n').map(x => x.trim()).filter(Boolean);
      const nums = ph.filter(x => /\d{3,}/.test(x)), names = ph.filter(x => !/\d{3,}/.test(x));
      if (names.length && nums.length) { o.phone = nums.join('\n'); if (!o.contactName) o.contactName = names.join(' / '); }
      else if (names.length && !nums.length) { o.phone = ''; if (!o.contactName) o.contactName = names.join(' / '); }
      o.phone = fixPhone(String(o.phone || '').replace(/\(0?(\d{2,3})\)\s*/g, '0$1-').replace(/[ \t]*-[ \t]*/g, '-').replace(/(\d)[ \t]+(\d)/g, '$1-$2'));
      o.contactName = oneLine(o.contactName, ' / ');
      o.jobType = oneLine(o.jobType);
      o.content = oneLine(o.content);
      ['result', 'status', 'staff', 'jobUrl', 'log', 'hours', 'wage', 'progress', 'step'].forEach(k => { o[k] = oneLine(o[k]); });
      // 연락이력 칸: '연락완료·재연락' 같은 짧은 말은 상태, 긴 글은 결과(내용)
      if (o.log) { if (STATUS_WORDS.test(o.log.replace(/\s/g, '')) && !o.status) o.status = o.log; else if (!o.content) o.content = o.log; else if (!o.content.includes(o.log)) o.content += ' / ' + o.log; }
      const extra = [o.hours && !/\d+\s*[:시~]/.test(o.hours) ? o.hours : '', o.hours && /\d+\s*[:시~]/.test(o.hours) ? `근무 ${o.hours}` : '', o.wage ? `임금 ${o.wage}` : ''].filter(Boolean);
      if (extra.length) o.content = [o.content, ...extra].filter(Boolean).join(' · ');
      ['address', 'phone', 'contactName', 'jobType', 'content', 'result', 'status', 'staff'].forEach(k => { if (/^[`'"\-·.\s]+$/.test(o[k] || '')) o[k] = ''; });
      o.result = D.CONTACT_RESULTS.find(x => o.result.replace(/\s/g, '') === x.replace(/\s/g, '')) || guessResult(o.content);
      o.type = /방문/.test(o.content) && !/방문\s*(예정|요청|일정)/.test(o.content) ? '방문' : /메일/.test(o.content) ? '이메일' : report ? '방문' : '전화';
      const how = oneLine(o.how).replace(/\s/g, '');
      if (D.ACT_TYPES.includes(how) && how !== '발굴') o.type = how;
      if (ledger) { o.ledger = true; o.type = '발굴'; }
      o.sheet = sheet;
      out.push(o);
    });
    return { rows: out, skipped };
  }
  /* 이름이 조금 달라도 같은 곳 찾기: 사업체·기관 이름 → 전화번호 → 이름 낱말 */
  const INST = /특수반|특수학급|학교|복지센터|부모회|협회|연합회|복지관|행정복지|고용정보센터|고용센터|공단|장애인복지회|주민센터/;
  const words = n => String(n || '').replace(/[(（][^)）]*[)）]|㈜|주식회사|사단법인|\(사\)|\[.*?\]/g, ' ').replace(/화성시|화성/g, ' ').split(/[\s/,·]+/)
    .map(w => w.replace(/특수반|특수학급$/, '').replace(/^(.{2,})고$/, '$1고등학교').replace(/^(.{2,}?)(점|지점)$/, '$1')).filter(w => w.length >= 2);
  const subseq = (w, k) => { let i = 0; for (const ch of k) if (ch === w[i]) i++; return i >= w.length; };
  const digits = p => String(p || '').split(/[\/\n]/).map(x => x.replace(/\D/g, '')).filter(x => x.length >= 9);
  function orgIndex() {
    const st = S.get();
    const list = [...st.businesses.map(x => ({ kind: 'biz', x })), ...st.networks.filter(n => !S.isHome(n)).map(x => ({ kind: 'net', x }))];
    return list.map(o => ({ ...o, key: U.orgKey(o.x.name), tel: digits(o.x.phone) }));
  }
  function resolveOrg(name, phone, idx) {
    const k = U.orgKey(name);
    let hit = idx.filter(o => o.key === k);
    if (hit.length) return hit[0];
    const tel = digits(phone);
    hit = tel.length ? idx.filter(o => o.tel.some(t => tel.includes(t))) : [];
    if (hit.length === 1) return hit[0];
    // 낱말이 모두 들어 있고(하나는 그대로, 나머지는 글자 순서대로) 그런 곳이 하나뿐이면 같은 곳
    const ws = words(name).map(w => U.norm(w));
    if (!ws.length || !ws.some(w => w.length >= 3)) return null;
    hit = idx.filter(o => ws.some(w => w.length >= 3 && o.key.includes(w)) && ws.every(w => o.key.includes(w) || subseq(w, o.key)));
    if (hit.length > 1) { const exact = hit.filter(o => o.key === ws.join('')); if (exact.length && new Set(exact.map(o => o.key)).size === 1) return exact.find(o => o.kind === 'biz') || exact[0]; }
    return hit.length === 1 ? hit[0] : null;
  }
  /** 여러 표에서 읽은 줄을 합치고, 사이트에 이미 있는 기록은 표시 */
  function finishRows(list) {
    // 같은 날 같은 사업체가 여러 번(연락이력 + 보고용 시트 등) 적혀 있으면 한 줄로 합친다 (빈 칸은 채우고, 결과는 긴 쪽)
    const merged = new Map();
    const fill = (prev, o) => ['address', 'phone', 'contactName', 'jobType', 'result', 'status', 'staff', 'jobUrl'].forEach(f => { if (!prev[f] && o[f]) prev[f] = o[f]; });
    list.filter(o => !o.ledger).forEach(o => {
      const k = o.date + '|' + U.orgKey(o.name);
      const prev = merged.get(k);
      if (prev) {
        fill(prev, o);
        if ((o.content || '').length > (prev.content || '').length) prev.content = o.content;
        if (o.type === '방문') prev.type = '방문';
        prev.n = (prev.n || 1) + 1;
      } else merged.set(k, { ...o });
    });
    // 개발대장 줄: 연락 기록에 나온 사업체면 빈 칸만 채우고, 처음 보는 사업체면 '사업체만 등록' 줄로 남긴다
    const seenOrg = new Map([...merged.values()].map(o => [U.orgKey(o.name), o]));
    const ledger = new Map();
    list.filter(o => o.ledger).forEach(o => {
      const k = U.orgKey(o.name), hit = seenOrg.get(k);
      if (hit) { fill(hit, { ...o, content: '', result: '', status: '' }); return; }
      const prev = ledger.get(k);
      if (prev) fill(prev, o); else ledger.set(k, { ...o });
    });
    const idx = orgIndex();
    const have = new Set(S.get().activities.map(a => a.date + '|' + a.targetType + a.targetId));
    const rows = [...merged.values(), ...ledger.values()].sort((a, b) => a.date.localeCompare(b.date));
    rows.forEach(r => {
      const o = resolveOrg(r.name, r.phone, idx);
      r.match = o ? { kind: o.kind, id: o.x.id, name: o.x.name } : null;
      r.inst = !o && INST.test(r.name) && !r.jobType;
      r.dup = r.ledger ? !!o : !!o && have.has(r.date + '|' + o.kind + o.x.id);
      r.who = matchStaff(r.staff);
    });
    return rows;
  }
  function parseCells(cells, year = ui.contacts.month.slice(0, 4)) {
    const { rows, skipped } = readTable(cells, year);
    return { rows: finishRows(rows), skipped };
  }
  /** 엑셀 파일의 시트마다 머리글을 따로 읽는다 (빈 양식·참고 시트는 건너뜀) */
  function parseSheets(sheets, year = ui.contacts.month.slice(0, 4)) {
    let all = [], skipped = 0;
    const used = [];
    sheets.filter(sh => !/양식|template|^참고/i.test(sh.name)).forEach(sh => {
      const r = readTable(sh.cells, year, sh.name);
      if (r.rows.length) used.push(`${sh.name} ${r.rows.length}줄`);
      all = all.concat(r.rows); skipped += r.skipped;
    });
    return { rows: finishRows(all), skipped, used };
  }
  /** 상담자 칸 글자 → 직원 이름. '김정배 선생님', '정배쌤', '김정배/이유진'(앞사람)도 맞춘다. 못 맞추면 '' */
  function matchStaff(raw) {
    const t = String(raw || '').split(/[\/,·\n]/)[0].replace(/\s|선생님|쌤|샘|님|팀장|과장|대리|주임|사원|복지사|직업재활사|상담사|\(.*?\)/g, '');
    if (!t) return '';
    const names = [...new Set([...S.staffHere(), ...S.staff()].map(s => s.name))];
    const hit = names.find(n => n === t) || names.find(n => n.length >= 2 && (t.includes(n) || n.includes(t) && t.length >= 2));
    if (hit) return hit;
    const given = names.filter(n => n.length >= 3 && n.slice(1) === t);
    return given.length === 1 ? given[0] : '';
  }
  const parsePaste = text => parseCells(parseTsv(text));
  /** 엑셀·CSV 파일 → 시트별 표 */
  async function readFileSheets(f) {
    const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), { type: 'string' }) : XLSX.read(new Uint8Array(await f.arrayBuffer()));
    return wb.SheetNames.map(n => ({ name: n, cells: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) }));
  }
  function pasteDialog(state) {
    const rows = state.rows || [];
    const fresh = rows.filter(r => !r.dup);
    const newCount = new Set(fresh.filter(r => !r.match && !r.inst).map(r => U.orgKey(r.name))).size;
    const newInst = new Set(fresh.filter(r => !r.match && r.inst).map(r => U.orgKey(r.name))).size;
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">연락이력 한 번에 가져오기</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div></div>
      <div class="dr-body">
        <ol class="steps-help"><li>시트·엑셀에서 가져올 줄을 드래그해 <b>Ctrl+C</b> → 아래 칸에 <b>Ctrl+V</b> (머리글 줄은 있어도 없어도 됩니다)</li><li>또는 <button class="btn btn-sm" type="button" data-act="ct-file">엑셀·CSV 파일 열기</button></li><li>미리보기를 확인하고 <b>가져오기</b></li></ol>
        <textarea class="textarea" id="ctPasteBox" rows="7" placeholder="여기에 붙여넣기 (Ctrl+V)">${e(state.text || '')}</textarea>
        ${state.file ? `<p class="sub">파일: <b>${e(state.file)}</b></p>` : ''}
        ${rows.length ? `<div class="inline" style="margin:6px 0"><label class="sub" for="ctPasteWho">상담자 칸이 비었거나 모르는 이름이면</label><select class="select sm" id="ctPasteWho">${(S.staffHere().length ? S.staffHere() : S.staff()).map(s => `<option ${s.name === (state.who || S.me()) ? 'selected' : ''}>${e(s.name)}</option>`).join('')}</select><span class="sub">으로 기록</span></div>
          ${state.used && state.used.length ? `<p class="sub">읽은 시트: ${state.used.map(e).join(' · ')} (빈 양식·참고 시트는 건너뜀)</p>` : ''}
          ${state.skipped ? `<p class="sub">날짜·사업체명이 없는 줄 ${state.skipped}줄(제목·빈 줄·메모)은 뺐습니다.</p>` : ''}
          <p class="sub">${rows.length}줄을 읽었습니다${rows.length - fresh.length ? ` (그중 <b>${rows.length - fresh.length}줄은 같은 날 같은 사업체 기록이 이미 있어 건너뜁니다</b>)` : ''}. 처음 보는 곳 <b>${newCount + newInst}곳</b>은 <b>미등록</b>으로 연락이력에만 들어가요(사업체 개발·지도에는 안 나와요. 올리려면 연락이력 줄의 '사업체 등록'으로 등록 화면에서 직접 넣어 주세요). 이름이 조금 달라도(예: 다이소 마도점 = 다이소 마도) 전화번호·이름 낱말이 같으면 이미 있는 곳으로 붙입니다. 같은 날 같은 사업체가 두 번 적힌 줄은 한 줄로 합쳤고, 연락결과는 결과 글을 보고 골라 두었습니다. 날짜 칸이 빈 줄은 바로 위 줄과 같은 날로 봤어요. 같은 파일을 두 번 넣어도 이미 있는 줄은 다시 들어가지 않아요.</p>
          <div class="table-wrap"><table class="tbl bulk-tbl"><thead><tr><th></th><th>날짜</th><th>사업체명</th><th>주소</th><th>전화번호</th><th>담당자</th><th>직종</th><th>결과</th><th>연락결과</th><th>방식</th><th>상담자</th></tr></thead><tbody>
          ${rows.slice(0, 200).map(r => `<tr class="${r.dup ? 'dup' : ''}"><td class="nowrap">${r.dup ? '<span class="badge">있음</span>' : r.ledger ? '<span class="badge accent">사업체 정보만 (미등록)</span>' : r.match ? '' : r.inst ? '<span class="badge accent">새 곳 · 미등록</span>' : '<span class="badge accent">새 곳 · 미등록</span>'}</td><td class="num nowrap">${e(r.date)}</td><td><b>${e(r.name)}</b>${r.match && U.orgKey(r.match.name) !== U.orgKey(r.name) ? ` <span class="sub">→ ${e(r.match.name)}</span>` : ''}${r.n > 1 ? ` <span class="sub">(${r.n}줄 합침)</span>` : ''}</td><td class="clip" title="${e(r.address)}">${e(r.address)}</td><td class="num">${e(r.phone)}</td><td>${e(r.contactName)}</td><td class="clip">${e(r.jobType)}</td><td class="wrap">${e(r.content)}</td><td>${e(r.result)}</td><td>${e(r.type)}</td><td class="nowrap">${r.who ? e(r.who) : `<span class="sub" title="${e(r.staff || '')}">${r.staff ? `${e(r.staff)} → ` : ''}${e(state.who || S.me())}</span>`}</td></tr>`).join('')}
          </tbody></table></div>${rows.length > 200 ? `<p class="sub">처음 200줄만 보여줍니다.</p>` : ''}`
          : state.text ? '<p class="sub" style="color:var(--danger)">날짜와 사업체명이 있는 줄을 찾지 못했습니다. 날짜 칸이 들어가게 복사해 보세요.</p>' : ''}
      </div>
      <div class="dr-foot"><button class="btn" type="button" data-act="dr-close">취소</button><button class="btn btn-primary" type="button" data-act="ct-paste-commit" ${fresh.length ? '' : 'disabled'}>${fresh.length}줄 가져오기</button></div>`;
  }
  /** 한 번에 저장 (새 사업체·새 기관·기존 곳 보완·연락 기록을 각각 한 번씩 보낸다) */
  function commitPaste(rows, fallback) {
    const me = fallback || S.me(), key = n => U.orgKey(n);
    const list = rows.filter(r => !r.dup);
    const progs = S.getScope().startsWith('p:') ? [S.getScope().slice(2)] : [];
    // 처음 보는 곳: 이름(정리한 글자)이 같으면 한 곳으로
    const bizSpecs = new Map(), netSpecs = new Map();
    list.filter(r => !r.match).forEach(r => {
      const k = key(r.name), who = r.who || me;
      if (false) {
        const x = netSpecs.get(k) || { name: r.name, category: D.guessCategory(r.name) || '복지기관', status: '보통', phone: '', address: '', since: r.date, staff: who, programs: progs, relation: '', memo: '' };
        if (!x.phone && r.phone) x.phone = r.phone;
        if (!x.address && r.address) x.address = r.address;
        if (r.date < x.since) x.since = r.date;
        netSpecs.set(k, x);
        return;
      }
      const x = bizSpecs.get(k) || { name: r.name, phone: '', address: '', stage: '접촉', discoveredAt: r.date, source: '연락이력', staff: who, placements: 0, jobs: '', programs: progs, pending: 'Y' };
      if (!x.phone && r.phone) x.phone = r.phone;
      if (!x.address && r.address) x.address = r.address;
      if (!x.jobs && r.jobType) x.jobs = r.jobType;
      if (r.type === '방문' || /방문|실적|직무분석/.test(r.progress || '')) x.stage = '방문상담';
      if (r.date < x.discoveredAt) x.discoveredAt = r.date;
      bizSpecs.set(k, x);
    });
    const madeBiz = bizSpecs.size ? S.upsertMany('biz', [...bizSpecs.values()]) : [];
    const madeNet = netSpecs.size ? S.upsertMany('net', [...netSpecs.values()]) : [];
    const target = new Map([...madeBiz.map(b => [key(b.name), { kind: 'biz', x: b }]), ...madeNet.map(n => [key(n.name), { kind: 'net', x: n }])]);
    const tOf = r => r.match ? { kind: r.match.kind, x: S.find(r.match.kind, r.match.id) } : target.get(key(r.name));
    // 이미 있던 곳: 빈 전화·주소만 채우고, 사업체 단계는 앞으로만
    const patches = new Map();
    list.filter(r => r.match).forEach(r => {
      const t = tOf(r); if (!t || !t.x) return;
      const id = t.kind + t.x.id, p = patches.get(id) || { kind: t.kind, id: t.x.id };
      if (!t.x.phone && !p.phone && r.phone) p.phone = r.phone;
      if (!t.x.address && !p.address && r.address) p.address = r.address;
      if (t.kind === 'biz') {
        const st = p.stage || t.x.stage;
        if (st === '발굴') p.stage = r.type === '방문' ? '방문상담' : '접촉';
        else if (st === '접촉' && r.type === '방문') p.stage = '방문상담';
      }
      patches.set(id, p);
    });
    ['biz', 'net'].forEach(kind => { const fix = [...patches.values()].filter(p => p.kind === kind && Object.keys(p).length > 2).map(({ kind: _, ...p }) => p); if (fix.length) S.putMany(kind, fix); });
    const acts = list.filter(r => !r.ledger).map(r => { const t = tOf(r); return t && t.x ? { targetType: t.kind, targetId: t.x.id, date: r.date, type: r.type, content: r.content || '(내용 없음)', staff: r.who || me, contactName: r.contactName || '', jobType: r.jobType || '', result: r.result || '', status: r.status || '연락완료', jobUrl: jobLink(r.jobUrl), perf: '', people: '' } : null; }).filter(Boolean);
    if (acts.length) S.upsertMany('act', acts);
    const queue = [...madeBiz.filter(b => b.address).map(b => ['biz', b.id]), ...madeNet.filter(n => n.address).map(n => ['net', n.id])].slice(0, 80);
    (async () => { for (const [k, id] of queue) { await S.refine(k, id); await new Promise(res => setTimeout(res, 1100)); } })();
    return { n: acts.length, biz: madeBiz.length, net: madeNet.length };
  }

  /* ================= 출장·특근 명령부 ================= */
  // 명령부는 팀 문서라 보기 범위(전체 팀/직원)와 상관없이 모든 직원 줄을 쓴다. 사람별로는 위 담당자 버튼으로 거른다
  /* ---------- 업무 일정 불러오기 (엑셀·한글 표: 날짜·시간·제목/내용·유형·담당·메모) ---------- */
  const EV_HEAD = { date: /^(날짜|일자|일시|일정일|월일)$/, time: /^(시간|시각)$/, title: /^(제목|일정|내용|일정내용|업무|업무내용|행사명|프로그램)$/, type: /^(유형|구분|종류)$/, staff: /^(담당|담당자|담당직원|성명|직원)$/, memo: /^(메모|비고|장소)$/ };
  function eventsFromRows(rows, year) {
    const out = [];
    for (let h = 0; h < Math.min(rows.length, 15); h++) {
      const head = (rows[h] || []).map(c => String(c ?? '').replace(/\s/g, ''));
      const col = {};
      head.forEach((t, i) => Object.entries(EV_HEAD).forEach(([k, re]) => { if (col[k] == null && re.test(t)) col[k] = i; }));
      if (col.date == null || col.title == null) continue;
      for (let r = h + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const raw = row[col.date];
        let date = '';
        if (typeof raw === 'number' && raw > 30000) { const d = new Date(Math.round((raw - 25569) * 864e5)); const y = d.getUTCFullYear() < 2015 ? year : d.getUTCFullYear(); date = `${y}-${U.pad(d.getUTCMonth() + 1)}-${U.pad(d.getUTCDate())}`; }
        else { const t = String(raw ?? ''); const k = t.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/) || t.match(/^\s*(\d{1,2})[.\-/월\s]+(\d{1,2})/); if (k) date = k.length === 4 ? `${k[1]}-${U.pad(+k[2])}-${U.pad(+k[3])}` : `${year}-${U.pad(+k[1])}-${U.pad(+k[2])}`; }
        const title = String(row[col.title] ?? '').replace(/\s+/g, ' ').trim();
        if (!date || !title) continue;
        const tm = String(row[col.time] ?? '').match(/(\d{1,2})[:시]?\s*(\d{2})?/);
        const staff = String(row[col.staff] ?? '').trim();
        out.push({ date, time: tm ? `${U.pad(+tm[1])}:${tm[2] || '00'}` : '', title, type: D.EVENT_TYPES.find(t => String(row[col.type] ?? '').includes(t)) || '기타', staff: S.staff().some(s => s.name === staff) ? staff : '', memo: String(row[col.memo] ?? '').trim(), targetType: '', targetId: '' });
      }
      break;
    }
    return out;
  }
  function eventsFromWorkbook(wb, file) {
    const year = +((String(file).match(/(20\d{2})/) || [])[1] || U.today().slice(0, 4));
    return wb.SheetNames.flatMap(n => eventsFromRows(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }), year));
  }
  const eventsFromHwp = (tables, file) => { const year = +((String(file).match(/(20\d{2})/) || [])[1] || U.today().slice(0, 4)); return tables.flatMap(t => eventsFromRows(t.rows, year)); };

  /** 공유 시트 '구인업체 개발 대장' 열 순서: 등록일, 업체명, 주소, 전화번호, 대표명(담당자), 직종/직무, 근무시간, 복리후생(기타), 비고, 실적 진행도, 상담자 */
  const progressOf = b => b.progress || ((b.jobAnalyses || []).length ? '직무분석지 작성완료' : S.actsOf('biz', b.id).some(a => a.type === '방문') ? '방문완료' : '');
  function ledgerTsv(list) {
    return tsv([...list].sort((a, b) => (a.discoveredAt || '').localeCompare(b.discoveredAt || '')).map(b => {
      const people = S.cardsOf('biz', b.id).map(c => `${c.name}${c.title ? ' ' + c.title : ''}`).join(' ') || b.ceo || '';
      return [b.discoveredAt, b.name, b.address, b.phone || phoneOf(b), people, b.jobs, b.workConditions, b.welfare, b.memo, progressOf(b), b.staff];
    }));
  }

  /* ---------- 달별 엑셀 정리: 연락이력·방문·실적·출장·특근·신규 사업체·일정·명함을 달마다 한 파일로 ---------- */
  const byDate = k => (x, y) => String(x[k] || '').localeCompare(String(y[k] || ''));
  function monthData(month, v = S.view(), sc = S.getScope()) {
    const contact = contactRows(month, v, sc).map(({ a, b }) => ({ '날짜': a.date, '방식': a.type, '사업체명': b.name, '주소': b.address || '', '전화번호': phoneOf(b), '담당자': a.contactName || contactOf(b), '직종': a.jobType || b.jobs || '', '결과': a.content || '', '연락결과': a.result || '', '상태': a.status || '', '진행 결과': outcomeOf(a), '상담자': a.staff || '', '현장훈련 유/무': a.training || '', '절차': a.procedure || '', '구인공고': jobLink(a.jobUrl) || '' }));
    const perf = [
      ...S.perfRows(month, v).map(({ a, p, t, d }) => ({ '날짜': d, '사업': p.set || '', '세부사업': p.item, '사업체·기관': t ? t.name : '', '내용': a.content || '', '담당': a.staff || '', '구분': `${a.type} 기록` })),
      ...v.perfs.filter(p => (p.date || '').startsWith(month)).map(p => ({ '날짜': p.date, '사업': p.set || '', '세부사업': p.item, '사업체·기관': p.place || '', '내용': p.note || '', '담당': p.staff || '', '구분': '직접 입력' })),
    ].sort(byDate('날짜'));
    const newBiz = v.businesses.filter(b => (S.bizFirst(b) || b.discoveredAt || '').startsWith(month)).map(b => ({ '최초 등록일': S.bizFirst(b) || b.discoveredAt || '', '사업체명': b.name, '업종': b.industry || '', '진행 단계': b.stage || '', '주소': b.address || '', '대표 전화': b.phone || '', '사업체 담당자': contactOf(b), '발굴 경로': b.source || '', '가능 직무': b.jobs || '', '담당 직원': b.staff || '', '메모': b.memo || '' })).sort(byDate('최초 등록일'));
    const ev = v.events.filter(x => (x.date || '').startsWith(month)).map(x => { const t = S.targetOf(x); return { '날짜': x.date, '시간': x.time || '', '유형': x.type || '', '제목': x.title || '', '사업체·기관': t ? t.name : '', '담당': x.staff || (t && t.staff) || '', '완료': x.done ? 'Y' : '', '메모': x.memo || '' }; }).sort(byDate('날짜'));
    const cards = v.cards.filter(c => (c.metAt || '').startsWith(month)).map(c => ({ '받은 날': c.metAt, '이름': c.name, '직함': c.title || '', '소속': c.org || '', '휴대전화': c.mobile || '', '사무실 전화': c.phone || '', '이메일': c.email || '', '받은 곳': c.metWhere || '' })).sort(byDate('받은 날'));
    return { contact, visit: contact.filter(r => r['방식'] === '방문'), perf, newBiz, ev, cards };
  }
  const BOOK = [['contact', '연락이력'], ['visit', '방문 사업체'], ['perf', '실적'], ['newBiz', '신규 사업체'], ['ev', '일정'], ['cards', '받은 명함']];
  function sheetOf(rows, head) {
    const ws = rows.length ? XLSX.utils.json_to_sheet(rows, { header: head }) : XLSX.utils.aoa_to_sheet([head, ['(기록 없음)']]);
    ws['!cols'] = head.map(h => ({ wch: Math.min(45, Math.max(String(h).length * 2 + 2, ...rows.map(r => String(r[h] ?? '').replace(/[^\x00-\x7f]/g, 'xx').length + 2))) }));
    if (rows.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } }) };
    return ws;
  }
  const HEADS = d => Object.fromEntries(BOOK.map(([k]) => [k, d[k][0] ? Object.keys(d[k][0]) : null]));
  /** months: ['2026-10'] 한 달이면 그 달 파일, 여러 달이면 한 해 파일(시트마다 '월' 칸 + 월별 요약) */
  function monthBook(months) {
    const wb = XLSX.utils.book_new();
    const per = months.map(m => [m, monthData(m)]);
    const headOf = k => { const hit = per.find(([, d]) => d[k].length); return hit ? Object.keys(hit[1][k][0]) : ({ contact: ['날짜', '방식', '사업체명', '주소', '전화번호', '담당자', '직종', '결과', '연락결과', '상태', '진행 결과', '상담자'], visit: ['날짜', '사업체명', '주소', '결과'], perf: ['날짜', '사업', '세부사업', '사업체·기관', '내용', '담당', '구분'], trip: ['출장일', '성명', '출장지', '출장용무', '방법', '출장시간', '출장복명', '비고', '식비'], ot: ['특근일자', '성명', '부서명', '특근시간', '업무내용', '비고', '식비'], newBiz: ['최초 등록일', '사업체명', '업종', '진행 단계', '주소', '대표 전화', '사업체 담당자', '발굴 경로', '담당 직원'], ev: ['날짜', '시간', '유형', '제목', '사업체·기관', '담당', '완료', '메모'], cards: ['받은 날', '이름', '직함', '소속', '휴대전화', '사무실 전화', '이메일', '받은 곳'] })[k]; };
    const label = m => `${+m.slice(5, 7)}월`;
    const one = months.length === 1;
    // 요약
    const sumRow = d => [new Set(d.contact.map(r => r['사업체명'])).size, d.contact.length, d.visit.length, d.contact.filter(r => r['연락결과'] === '채용의향 있음').length, d.contact.filter(r => r['상태'] === '재연락').length, d.perf.length, d.newBiz.length, d.ev.length, d.cards.length];
    const sumHead = ['연락한 사업체(곳)', '연락 건수', '방문', '채용의향 있음', '재연락 필요', '실적 줄', '신규 사업체', '일정', '받은 명함'];
    const sum = one ? [['항목', `${months[0].slice(0, 4)}년 ${label(months[0])}`], ...sumHead.map((h, i) => [h, sumRow(per[0][1])[i]])]
      : [['월', ...sumHead], ...per.map(([m, d]) => [label(m), ...sumRow(d)]), ['합계', ...sumHead.map((_, i) => per.reduce((a, [, d]) => a + sumRow(d)[i], 0))]];
    const ws0 = XLSX.utils.aoa_to_sheet([[`아르딤 취업지원 ${one ? `${months[0].slice(0, 4)}년 ${label(months[0])}` : `${months[0].slice(0, 4)}년 ${label(months[0])}~${label(months[months.length - 1])}`} 정리 · ${S.scopeLabel()} · 만든 날 ${U.today()}`], [], ...sum]);
    ws0['!cols'] = [{ wch: 18 }, ...sumHead.map(() => ({ wch: 13 }))];
    XLSX.utils.book_append_sheet(wb, ws0, '요약');
    BOOK.forEach(([k, name]) => {
      const head = headOf(k);
      const rows = one ? per[0][1][k] : per.flatMap(([m, d]) => d[k].map(r => ({ '월': label(m), ...r })));
      XLSX.utils.book_append_sheet(wb, sheetOf(rows, one ? head : ['월', ...head]), name);
    });
    // 한 해 파일에는 달마다 연락이력 시트도 따로 (시트에 바로 붙여 넣기 좋게)
    if (!one) per.filter(([, d]) => d.contact.length).forEach(([m, d]) => XLSX.utils.book_append_sheet(wb, sheetOf(d.contact, headOf('contact')), `${label(m)} 연락이력`));
    const file = one ? `아르딤_월별정리_${months[0]}.xlsx` : `아르딤_월별정리_${months[0].slice(0, 4)}년_${label(months[0])}-${label(months[months.length - 1])}.xlsx`;
    XLSX.writeFile(wb, file);
    return { file, rows: per.reduce((a, [, d]) => a + BOOK.reduce((b, [k]) => b + d[k].length, 0), 0) };
  }

  /* ---------- 구글 드라이브 달별 정리: 구역 / 분류 폴더 / 'YYYY-MM 분류' 파일 ---------- */
  const ARCHIVE_SECTIONS = [{ section: '현장중심', scope: 'p:장애인개발원' }];
  const toAoa = rows => { const head = rows[0] ? Object.keys(rows[0]) : null; return { head, rows: rows.map(r => Object.values(r).map(x => (x == null ? '' : String(x)))) }; };
  const sheet = (name, rows, head) => { const t = toAoa(rows); return { name, head: t.head || head, rows: t.rows }; };
  function archiveFiles(month, sc) {
    const v = S.view(sc), d = monthData(month, v, sc);
    const bizActs = v.activities.filter(a => a.targetType === 'biz' && (a.date || '').startsWith(month)).map(a => ({ a, b: S.find('biz', a.targetId) })).filter(r => r.b)
      .sort((x, y) => x.a.date.localeCompare(y.a.date)).map(({ a, b }) => ({ '날짜': a.date, '유형': a.type, '사업체명': b.name, '진행 단계': b.stage || '', '내용': a.content || '', '실적 세부사업': (S.perfOf(a) || {}).item || '', '담당 직원': a.staff || '' }));
    const status = v.businesses.map(b => { const la = S.lastAct('biz', b.id); return { '사업체명': b.name, '진행 단계': b.stage || '', '최초 등록일': S.bizFirst(b) || b.discoveredAt || '', '업종': b.industry || '', '주소': b.address || '', '대표 전화': b.phone || '', '사업체 담당자': contactOf(b), '가능 직무': b.jobs || '', '발굴 경로': b.source || '', '담당 직원': b.staff || '', '최근 활동': la ? `${la.date} ${la.type}` : '' }; }).sort((x, y) => x['최초 등록일'].localeCompare(y['최초 등록일']));
    const sheetRows = window.GL ? S.perfTable(month, GL.SET, true, v).map(r => ({ '사업날짜': r.date, '대분류': r.big, '중분류': r.mid, '세부사업명': r.item, '비고': r.note, '출처': r.src })) : [];
    const ym = month;
    const files = [
      { folder: '사업체 개발', name: `${ym} 사업체 개발`, has: d.newBiz.length + bizActs.length, sheets: [sheet('신규 등록 사업체', d.newBiz, ['최초 등록일', '사업체명']), sheet('사업체 활동', bizActs, ['날짜', '유형', '사업체명']), sheet('사업체 현황(만든 날 기준)', status, ['사업체명'])] },
      { folder: '연락이력', name: `${ym} 연락이력`, has: d.contact.length, sheets: [sheet('연락이력', d.contact, ['날짜', '사업체명']), sheet('방문 사업체(보고용)', d.visit, ['날짜', '사업체명'])] },
      { folder: '실적', name: `${ym} 실적`, has: d.perf.length, sheets: [sheet('실적 목록', d.perf, ['날짜', '세부사업']), sheet('구글 시트용(실적 기타)', sheetRows, ['사업날짜', '세부사업명'])] },
      { folder: '일정·명함', name: `${ym} 일정·명함`, has: d.ev.length + d.cards.length, sheets: [sheet('일정', d.ev, ['날짜', '제목']), sheet('받은 명함', d.cards, ['받은 날', '이름'])] },
    ];
    return files.filter(f => f.has).map(({ has, ...f }) => f); // eslint-disable-line no-unused-vars
  }
  /** 기록이 있는 달 (가장 이른 달부터 이번 달까지) */
  function archiveMonths(sc) {
    const v = S.view(sc);
    const ds = [...v.activities.map(a => a.date), ...v.perfs.map(p => p.date), ...v.trips.map(t => t.date), ...v.events.map(x => x.date), ...v.cards.map(c => c.metAt), ...v.businesses.map(b => S.bizFirst(b) || b.discoveredAt)].filter(x => /^\d{4}-\d{2}/.test(x || '')).sort();
    if (!ds.length) return [];
    const out = []; let [y, m] = ds[0].slice(0, 7).split('-').map(Number); const end = U.today().slice(0, 7);
    while (`${y}-${U.pad(m)}` <= end && out.length < 60) { out.push(`${y}-${U.pad(m)}`); if (++m > 12) { m = 1; y++; } }
    return out;
  }

  return { ARCHIVE_SECTIONS, archiveFiles, archiveMonths, monthData, monthBook, ui, jobLink, siteName, contactsPage, contactsResults, contactRows, secStaffBar, contactTsv, reportTsv, addContact, registerBiz, parsePaste, parseCells, parseSheets, readFileSheets, pasteDialog, commitPaste, eventsFromWorkbook, eventsFromHwp, ledgerTsv, progressOf };
})();
