/* 대시보드 위 '실적 대시보드': 구역(현장중심·고용공단)의 실적 분류표로
 * 연간/월간 KPI · 세부사업별 목표 대비 달성률 표 · 월별 실적 막대를 보여 주고, 세부사업을 누르면 담당자별·기록 목록이 열린다 */
window.DP = (() => {
  const e = U.esc;
  const now = () => U.today().slice(0, 7);
  const ui = { mode: 'year', year: +U.today().slice(0, 4), month: now() };
  // 고용지원사업 기본 연간 목표(횟수) — 기관 사업계획 2026 기준. 데이터 관리에서 바꾸려면 settings.goalsBySet
  const GOALS = { '고용지원사업': { '직업상담': 120, '취업알선': 66, '취업확정': 54, '사후관리': 60, '취업자자조모임': 7, '고용자원개발': 60, '사업체관리': 120, '고용네트워크': 2 } };
  const SEC_LABEL = { '장애인개발원': '현장중심', '고용공단': '고용공단' };

  /** 지금 보는 구역의 실적 분류표 */
  function setOfScope() {
    const sc = S.getScope();
    if (!sc.startsWith('p:')) return '';
    return (S.get().settings.perfByProgram || {})[sc.slice(2)] || '';
  }
  const progOfScope = () => (S.getScope().startsWith('p:') ? S.getScope().slice(2) : '');

  /** 기간(YYYY 또는 YYYY-MM)의 실적 줄: 방문·전화 기록에서 자동으로 잡힌 것 + 직접 입력 */
  function lines(set, prefix, v = S.view()) {
    const acts = S.perfRows(prefix, v).filter(r => r.p.set === set).map(r => ({ id: r.a.id, kind: 'act', item: r.p.item, staff: r.a.staff || '', d: r.d, name: r.t ? r.t.name : '', tk: r.a.targetType, tid: r.t ? r.t.id : '', content: r.a.content || '', how: r.a.type, ppl: S.pplOf(r.a), n: Number(r.a.people) || 1, key: r.a.targetId }));
    const mans = v.perfs.filter(p => p.set === set && (p.date || '').startsWith(prefix)).map(p => ({ id: p.id, kind: 'perf', item: p.item, staff: p.staff || '', d: p.date, name: p.place || '', content: p.note || '', how: '직접 입력', ppl: S.pplOf(p), n: Number(p.people) || 1, key: U.orgKey(p.place) }));
    return [...acts, ...mans].sort((a, b) => a.d.localeCompare(b.d));
  }

  /** 목표: { year(i): 연간 목표, month(i, m): 그 달 목표 } (현장중심은 실적 목표 설정을, 나머지는 기본 사업계획을 쓴다) */
  function goals(set, Y) {
    if (set === GL.SET) {
      const g = GL.goal(), months = Number(g.months) || 12;
      const base = i => { const v = (g.rows[i] || [])[2]; return v == null || v === '' ? null : Number(v); };
      const active = m => Y !== g.baseYear || m > 12 - months;
      return { year: i => (base(i) == null ? null : Math.round(base(i) * (Y === g.baseYear ? 1 : 12 / months))), month: (i, m) => (base(i) == null || !active(m) ? null : Math.max(1, Math.round(base(i) / months))), note: Y === g.baseYear ? `${g.baseYear}년은 ${13 - months}~12월(${months}개월) 기준` : '연간 = 기준 실적 × 12 ÷ 기준 개월 수' };
    }
    let custom = S.get().settings.goalsBySet; if (typeof custom === 'string') { try { custom = JSON.parse(custom); } catch { custom = null; } }
    const G = { ...(GOALS[set] || {}), ...((custom || {})[set] || {}) };
    return { year: i => (G[i] == null ? null : Number(G[i])), month: i => (G[i] == null ? null : Math.max(1, Math.round(G[i] / 12))), note: '연간 사업계획(횟수) 기준 · 월 목표 = 연간 ÷ 12' };
  }

  const pc = (a, t) => (t ? Math.round(a / t * 1000) / 10 : null);

  /* ---------- 실시간 코칭: 목표 대비 지금 어디쯤인지, 무엇을 더 하면 되는지 ---------- */
  /** 그 달 평일(주말·공휴일 빼고) 목록 */
  function workdays(ym) {
    let hol = []; try { hol = window.AT ? (AT.meta(ym).holidays || []).map(Number) : []; } catch { hol = []; }
    const [y, m] = ym.split('-').map(Number), last = new Date(y, m, 0).getDate(), out = [];
    for (let d = 1; d <= last; d++) { const wd = new Date(y, m - 1, d).getDay(); if (wd && wd !== 6 && !hol.includes(d)) out.push(`${ym}-${U.pad(d)}`); }
    return out;
  }
  // 세부사업마다 바로 할 일 (버튼)
  const ACTION = item => /사업체개발|고용자원개발/.test(item) ? `<button class="btn btn-sm btn-primary" type="button" data-act="new-biz">+ 사업체 발굴 등록</button><a class="btn btn-sm" href="#/map">지도에서 찾기</a>`
    : /사업체관리|고용네트워크/.test(item) ? `<a class="btn btn-sm" href="#/contacts">연락이력 쓰기</a>`
    : `<button class="btn btn-sm" type="button" data-act="dp-goperf" data-item="${e(item)}">실적 입력하기</button>`;
  /** 코칭 문장 목록 [{ lv: 'bad'|'warn'|'good'|'info', t, d, act }] + AI에 보낼 요약 */
  function coachData(set, items, G, Y, M, yLines, mon, cum) {
    const T = U.today(), curYM = T.slice(0, 7), live = M === curYM;
    const out = [], facts = [];
    const cnt = (list, i) => S.perfCount(list, i).cnt;
    const wd = workdays(M), passed = live ? wd.filter(d => d < T).length : wd.length, left = live ? wd.filter(d => d >= T).length : 0;
    const frac = wd.length ? passed / wd.length : 1, mm = +M.slice(5, 7);
    const yPace = set === GL.SET ? GL.paceOf(Y, GL.goal()) / 100 : (Y < +T.slice(0, 4) ? 1 : (+T.slice(5, 7) - 1 + (+T.slice(8, 10)) / 31) / 12);
    items.forEach(i => {
      const mt = G.month(i, mm), yt = G.year(i), done = cnt(mon, i), c = cnt(cum, i);
      // 연간 속도: 지금쯤 가 있어야 할 만큼에서 얼마나 늦었는지
      let yr = '', ysc = 0;
      if (yt && Y === +T.slice(0, 4)) {
        const exp = Math.round(yt * yPace), gap = exp - c, monthsLeft = Math.max(1, 12 - +T.slice(5, 7) + 1);
        if (gap >= Math.max(3, yt * .15)) { yr = `연간으로는 ${yt}건 중 ${c}건(지금쯤 ${exp}건)이라 남은 ${monthsLeft}달 동안 <b>월 ${Math.ceil((yt - c) / monthsLeft)}건</b>씩 해야 해요.`; ysc = gap / yt; }
      }
      if (!mt) { if (yr) out.push({ lv: 'warn', sc: ysc, t: `${i} 연간 목표보다 늦어요`, d: yr, act: ACTION(i) }); return; }
      const need = mt - done, expect = Math.round(mt * frac), behind = expect - done;
      facts.push(`${i}: 이번 달 ${done}/${mt}건 (지금쯤 ${expect}건이면 맞음), 누적 ${c}/${yt ?? '-'}건`);
      if (need <= 0) { out.push({ lv: yr ? 'info' : 'good', sc: -1 + ysc, t: `${i} 이번 달 목표 달성 (${done}/${mt}건)`, d: [done > mt ? `${done - mt}건 넘었어요. 넘친 실적은 다음 달로 이월돼요.` : '목표만큼 했어요.', yr].filter(Boolean).join(' '), act: yr ? ACTION(i) : '' }); return; }
      if (!live) { out.push({ lv: 'bad', sc: need / mt, t: `${i} ${need}건 모자랐어요 (${done}/${mt}건)`, d: '지난 기간이라 다음 달에 더 채워야 해요.' }); return; }
      const perDay = left ? need / left : need;
      const how = left ? `이번 달 목표 ${mt}건까지 ${need}건 남았어요. 남은 평일 ${left}일 동안 ${perDay >= 1 ? `<b>하루 ${Math.ceil(perDay)}건</b>` : `<b>주 ${Math.ceil(perDay * 5)}건</b>`}씩 하면 맞출 수 있어요.` : `이번 달이 끝나 ${need}건은 다음 달에 더 채워야 해요.`;
      if (behind > 0) out.push({ lv: behind / mt >= .3 || (left <= 5 && need > left) ? 'bad' : 'warn', sc: behind / mt + ysc + (left ? 0 : 1), t: `${i} 실적이 부족해요 — 지금쯤 ${expect}건인데 ${done}건`, d: [how, yr].filter(Boolean).join(' '), act: ACTION(i) });
      else out.push({ lv: yr ? 'warn' : 'info', sc: ysc, t: `${i} 이번 달은 순조로워요 (${done}/${mt}건)`, d: [`${need}건 남았고 남은 평일 ${left}일이에요.`, yr].filter(Boolean).join(' '), act: yr ? ACTION(i) : '' });
    });
    // 오래 연락이 끊긴 진행 중 사업체
    if (live) {
      const v = S.view();
      const stale = v.businesses.filter(b => D.ACTIVE_STAGES.includes(b.stage) && S.inScope(b.staff)).map(b => ({ b, last: S.actsOf('biz', b.id).map(a => a.date).sort().pop() || b.discoveredAt || '' })).filter(x => x.last && U.diffDays(x.last, T) >= 21).sort((a, b) => a.last.localeCompare(b.last));
      if (stale.length) out.push({ lv: 'warn', sc: .25, t: `3주 넘게 연락이 끊긴 진행 중 사업체 ${stale.length}곳`, d: `${stale.slice(0, 3).map(x => `<b class="link" data-act="open" data-kind="biz" data-id="${x.b.id}">${e(x.b.name)}</b>(${U.ago ? U.ago(x.last) : x.last})`).join(', ')}${stale.length > 3 ? ` 외 ${stale.length - 3}곳` : ''} — 다시 연락하면 사업체관리·취업 실적으로 이어져요.`, act: '<a class="btn btn-sm" href="#/contacts">연락이력 쓰기</a>' });
      facts.push(`3주 넘게 연락 없는 진행 중 사업체 ${stale.length}곳`);
      // 직원별 이번 달 실적
      const staffs = S.staffHere().map(x => x.name);
      const per = staffs.map(n => [n, items.reduce((a, i) => a + cnt(mon.filter(l => l.staff === n), i), 0)]);
      facts.push('직원별 이번 달 실적: ' + per.map(([n, c]) => `${n} ${c}건`).join(', '));
      const zero = per.filter(([, c]) => !c).map(([n]) => n);
      if (zero.length && frac >= .3) out.push({ lv: 'warn', sc: .2, t: `이번 달 실적이 아직 없는 선생님: ${zero.join(', ')}`, d: '방문·전화 기록을 남기면 실적에 자동으로 들어가요. 빠뜨린 기록이 없는지 확인해 주세요.' });
      // 참여자 이름 없는 실적 (실인원이 부정확해짐)
      if (set === GL.SET) {
        const noName = mon.filter(l => !S.NO_PEOPLE.has(l.item) && !(l.ppl || []).length).length;
        if (noName) out.push({ lv: 'info', sc: .1, t: `참여자 이름이 없는 실적 ${noName}줄`, d: '실적표에서 참여자 이름을 넣으면 실인원(받은 사람 수)이 정확해져요.', act: '<a class="btn btn-sm" href="#/perf">실적표 열기</a>' });
      }
    }
    const order = { bad: 0, warn: 1, info: 2, good: 3 };
    out.sort((a, b) => order[a.lv] - order[b.lv] || b.sc - a.sc);
    return { list: out, facts, live, left, passed, total: wd.length };
  }
  function coachHtml(cd, label, periodLabel) {
    const icon = { bad: '🔴', warn: '🟠', info: '🔵', good: '✅' };
    const top = cd.list.filter(x => x.lv !== 'good').slice(0, 5), rest = cd.list.filter(x => !top.includes(x));
    const item = x => `<li class="dpc-i ${x.lv}"><span class="dpc-ic" aria-hidden="true">${icon[x.lv]}</span><div><b>${x.t}</b><p>${x.d}</p>${x.act ? `<div class="inline dpc-act">${x.act}</div>` : ''}</div></li>`;
    const ai = ui.ai && ui.ai.key === label + periodLabel ? ui.ai : null;
    return `<section class="dpc">
      <div class="dpc-head"><h3>🧭 실시간 코칭 <span class="sub">${e(periodLabel)}${cd.live ? ` · 평일 ${cd.passed}/${cd.total}일 지남, ${cd.left}일 남음` : ''} · 기록을 넣으면 바로 바뀌어요</span></h3>
        ${AI.available() ? `<button class="btn btn-sm btn-primary" type="button" data-act="dp-ai" ${ui.aiBusy ? 'disabled' : ''}>${ui.aiBusy ? 'AI가 보는 중…' : '✨ AI 코칭 받기'}</button>` : '<span class="sub">데이터 관리에서 AI 키를 넣으면 AI 코칭도 받을 수 있어요</span>'}</div>
      ${ai ? `<div class="dpc-ai"><b>✨ AI 코칭</b> <span class="sub">${e(ai.at)}</span><div class="dpc-ai-t">${e(ai.text).replace(/\n/g, '<br>')}</div></div>` : ''}
      ${top.length ? `<ul class="dpc-list">${top.map(item).join('')}</ul>` : '<p class="sub" style="margin:0">지금은 모든 항목이 목표대로 가고 있어요. 👏</p>'}
      ${rest.length ? `<details class="dpc-more"><summary>나머지 ${rest.length}개 보기 (달성·순조)</summary><ul class="dpc-list">${rest.map(item).join('')}</ul></details>` : ''}
    </section>`;
  }
  const tone = p => (p == null ? '' : p >= 100 ? 'done' : p >= 70 ? 'ok' : p >= 40 ? 'warn' : 'low');
  const pill = p => (p == null ? '<span class="sub">-</span>' : `<span class="dp-pc ${tone(p)}">${p}%</span>`);

  function panel() {
    const set = setOfScope();
    if (!set || !D.PERF_SETS[set]) return '';
    const items = D.PERF_SETS[set].items, Y = ui.year, M = ui.mode === 'month' ? ui.month : (String(Y) === now().slice(0, 4) ? now() : `${Y}-12`);
    const mm = +M.slice(5, 7), G = goals(set, Y);
    const yLines = lines(set, String(Y)), cum = yLines.filter(l => l.d.slice(0, 7) <= M), mon = yLines.filter(l => l.d.startsWith(M));
    // 실적 수 = 횟수 (현장중심 직업훈련은 훈련한 날짜 수)
    const cnt = (list, i) => S.perfCount(list, i).cnt;
    const sumC = list => items.reduce((a, i) => a + cnt(list, i), 0);
    const totY = items.reduce((a, i) => a + (G.year(i) || 0), 0), totM = items.reduce((a, i) => a + (G.month(i, mm) || 0), 0);
    const v = S.view(), label = SEC_LABEL[progOfScope()] || progOfScope();
    const contacts = v.activities.filter(a => a.targetType === 'biz' && ['전화', '방문', '이메일', '미팅'].includes(a.type) && S.inScope(a.staff) && (ui.mode === 'month' ? a.date.startsWith(M) : a.date.startsWith(String(Y))));
    const newBiz = v.businesses.filter(b => (S.bizFirst(b) || b.discoveredAt || '').startsWith(ui.mode === 'month' ? M : String(Y))).length;
    const outreach = v.activities.filter(a => a.targetType === 'net' && ['홍보', '방문', '미팅', '행사'].includes(a.type) && (ui.mode === 'month' ? a.date.startsWith(M) : a.date.startsWith(String(Y))));
    const periodLabel = ui.mode === 'month' ? `${Y}년 ${mm}월` : `${Y}년`;
    const card = (t, val, unit, sub, cls = '', act = '') => `<div class="dp-kpi ${cls}" ${act}><span class="dp-kpi-t">${t}</span><b class="num">${val}<small>${unit}</small></b><span class="dp-kpi-s">${sub}</span></div>`;
    const cumN = sumC(cum), monN = sumC(mon);
    const cumP = pc(cumN, totY), monP = pc(monN, totM);
    const kpis = [
      card(ui.mode === 'month' ? `누적 실적 (1~${mm}월)` : '누적 실적', U.num(cumN), '건', `연간 목표 ${U.num(totY)}건`, 'k1'),
      card('누적 달성률', cumP ?? '-', cumP == null ? '' : '%', '누적 실적 ÷ 연간 목표', `k2 ${tone(cumP)}`),
      card(`${mm}월 실적`, U.num(monN), '건', `월 목표 ${U.num(totM)}건 · ${monP ?? '-'}%`, 'k3'),
      card(`연락 (${periodLabel})`, U.num(contacts.length), '건', `사업체 ${new Set(contacts.map(a => a.targetId)).size}곳 · 담당 ${new Set(contacts.map(a => a.staff)).size}명`, 'k4'),
      card(`신규 사업체 (${periodLabel})`, U.num(newBiz), '곳', '최초 등록일 기준', 'k5'),
      ...(set === GL.SET ? [card(`홍보·방문 (${periodLabel})`, U.num(outreach.length), '건', `기관 ${new Set(outreach.map(a => a.targetId)).size}곳`, 'k6')] : []),
    ].join('');
    const row = i => { const yt = G.year(i), mt = G.month(i, mm), cc = S.perfCount(cum, i), c = cc.cnt, m = cnt(mon, i); return `<tr data-act="dp-item" data-item="${e(i)}" class="dp-row" title="눌러서 ${e(i)} 자세히 보기">
        <th><span class="link">${e(i)}</span></th><td class="r num">${yt ?? '-'}</td><td class="r num dp-strong">${c}${cc.yeon != null && c ? `<small class="dp-ys" title="연인원 / 실인원">연 ${cc.yeon} · 실 ${cc.sil}</small>` : ''}</td><td class="r">${pill(pc(c, yt))}</td><td class="r num dp-strong">${m}</td><td class="r num">${mt ?? '-'}</td><td class="r">${pill(pc(m, mt))}</td></tr>`; };
    // 월별 막대: 그 해 1~12월 실적 건수 + 그 달 목표 표시
    const byM = Array.from({ length: 12 }, (_, k) => sumC(yLines.filter(l => +l.d.slice(5, 7) === k + 1)));
    const gM = Array.from({ length: 12 }, (_, k) => items.reduce((a, i) => a + (G.month(i, k + 1) || 0), 0));
    const max = Math.max(1, ...byM, ...gM);
    const bars = byM.map((n, k) => { const key = `${Y}-${U.pad(k + 1)}`, on = key === M; return `<button type="button" class="dp-col ${on ? 'on' : ''} ${key > now() ? 'future' : ''}" data-act="dp-month" data-month="${key}" title="${k + 1}월 실적 ${n}건${gM[k] ? ` · 목표 ${gM[k]}건` : ''}">
        <span class="dp-col-plot">${gM[k] ? `<i class="dp-goal" style="bottom:${gM[k] / max * 100}%"></i>` : ''}<span class="dp-bar" style="height:${n / max * 100}%">${n ? `<em class="num">${n}</em>` : ''}</span></span><span class="dp-col-l">${k + 1}월</span></button>`; }).join('');
    return `<section class="dp">
      <div class="dp-top"><h2 class="dp-title">📊 ${e(label)} 실적 대시보드 <span class="num">${Y}</span></h2>
        <div class="dp-ctl"><div class="seg"><button type="button" class="${ui.mode === 'year' ? 'on' : ''}" data-act="dp-mode" data-mode="year">연간</button><button type="button" class="${ui.mode === 'month' ? 'on' : ''}" data-act="dp-mode" data-mode="month">월간</button></div>
          <button class="icon-btn" type="button" data-act="dp-move" data-d="-1" aria-label="이전">◀</button><b class="num dp-period">${periodLabel}</b><button class="icon-btn" type="button" data-act="dp-move" data-d="1" aria-label="다음">▶</button></div></div>
      <div class="dp-kpis">${kpis}</div>
      ${coachHtml(coachData(set, items, G, Y, M, yLines, mon, cum), label, periodLabel)}
      ${set === GL.SET ? `<div class="dp-sec-t">연인원 / 실인원 / 횟수 <span class="sub">기관 실적표와 같은 모양 · ${mm}월 · 누적 · 연간 목표</span></div>${GL.triHtml(M)}` : ''}
      <div class="dp-sec-t">세부사업별 실적 요약 <span class="sub">(목표 대비 달성률 · ${e(G.note)}) · 세부사업을 누르면 담당자별·기록이 보여요</span></div>
      <div class="table-wrap"><table class="tbl dp-tbl">
        <thead><tr><th rowspan="2">세부사업</th><th>연간 목표</th><th colspan="2">누적 실적 (1~${mm}월)</th><th colspan="3">${mm}월 실적</th></tr>
          <tr><th class="r">건</th><th class="r">건</th><th class="r">달성률</th><th class="r">건</th><th class="r">월 목표</th><th class="r">달성률</th></tr></thead>
        <tbody><tr class="dp-sum"><th>합계</th><td class="r num">${U.num(totY)}</td><td class="r num dp-strong">${cumN}</td><td class="r">${pill(cumP)}</td><td class="r num dp-strong">${monN}</td><td class="r num">${totM}</td><td class="r">${pill(monP)}</td></tr>${items.map(row).join('')}</tbody></table></div>
      <div class="dp-sec-t">월별 실적 현황 <span class="sub">${Y}년 · 막대 = 실적 건수, 가로선 = 그 달 목표 · 막대를 누르면 그 달로</span></div>
      <div class="dp-chart" role="img" aria-label="${Y}년 월별 실적: ${byM.map((n, k) => `${k + 1}월 ${n}건`).join(', ')}">${bars}</div>
    </section>`;
  }

  /** 세부사업 자세히: 담당자별 (당월·누적) + 기록 목록 */
  function itemHtml(st) {
    const set = setOfScope(), Y = ui.year, M = ui.mode === 'month' ? ui.month : (String(Y) === now().slice(0, 4) ? now() : `${Y}-12`), mm = +M.slice(5, 7);
    const all = lines(set, String(Y)).filter(l => l.item === st.item && l.d.slice(0, 7) <= M);
    const staffs = [...new Set([...S.staffHere().map(x => x.name), ...all.map(l => l.staff).filter(Boolean)])];
    const list = all.filter(l => !st.who || l.staff === st.who).slice().reverse();
    const C = l => S.perfCount(l, st.item), fmt = c => (c.yeon == null ? `${c.cnt}` : `${c.yeon}/${c.sil}/${c.cnt}`);
    const unit = S.NO_PEOPLE.has(st.item) ? '건' : '연/실/횟수';
    return `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">[${e(st.item)}] 실적 현황</h2><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div>
      <p class="sub" style="margin:0">${Y}년 1~${mm}월 누적 ${fmt(C(all))} · ${mm}월 ${fmt(C(all.filter(l => l.d.startsWith(M))))} <span class="sub">(${unit})</span></p></div>
      <div class="dr-body">
        <div class="table-wrap"><table class="tbl"><thead><tr><th>담당자</th><th class="r">${mm}월 <small>${unit}</small></th><th class="r">누적 (1~${mm}월)</th></tr></thead><tbody>
          ${staffs.map(n => `<tr class="${st.who === n ? 'on' : ''}"><th><button type="button" class="linklike" data-act="dp-who" data-who="${e(n)}">${V.staffDot(n)}${e(n)}</button></th><td class="r num">${fmt(C(all.filter(l => l.staff === n && l.d.startsWith(M))))}</td><td class="r num"><b>${fmt(C(all.filter(l => l.staff === n)))}</b></td></tr>`).join('')}
        </tbody></table></div>
        <h3 style="margin:16px 0 6px">기록 ${list.length}건 ${st.who ? `<span class="sub">· ${e(st.who)}</span> <button type="button" class="linklike" data-act="dp-who" data-who="">전체 보기</button>` : ''}</h3>
        ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>날짜</th><th>사업체·기관</th><th>참여자</th><th>내용</th><th>담당</th><th>구분</th></tr></thead><tbody>
          ${list.slice(0, 300).map(l => `<tr class="sc-row" style="--sc:${V.staffColor(l.staff)}"><td class="num nowrap">${U.dateDot(l.d)}</td><td>${l.tid ? `<b class="link" data-act="open" data-kind="${l.tk}" data-id="${l.tid}">${e(l.name)}</b>` : `<b>${e(l.name || '-')}</b>`}</td><td>${e((l.ppl || []).join(', '))}</td><td class="wrap">${e(l.content)}</td><td class="nowrap">${e(l.staff)}</td><td class="nowrap sub">${e(l.how)}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="sub">아직 기록이 없어요.</p>'}
      </div>`;
  }

  /** AI 코칭에 보낼 숫자 요약 (참여자 이름 같은 개인정보는 넣지 않는다) */
  function coachFacts() {
    const set = setOfScope();
    if (!set) return null;
    const items = D.PERF_SETS[set].items, Y = ui.year, M = ui.mode === 'month' ? ui.month : (String(Y) === now().slice(0, 4) ? now() : `${Y}-12`);
    const yLines = lines(set, String(Y)), cum = yLines.filter(l => l.d.slice(0, 7) <= M), mon = yLines.filter(l => l.d.startsWith(M));
    const cd = coachData(set, items, goals(set, Y), Y, M, yLines, mon, cum);
    const label = SEC_LABEL[progOfScope()] || progOfScope(), periodLabel = ui.mode === 'month' ? `${Y}년 ${+M.slice(5, 7)}월` : `${Y}년`;
    return { key: label + periodLabel, set, label, M, text: [`부서: ${label} (${set})`, `기준: ${M} (오늘 ${U.today()}, 이번 달 남은 평일 ${cd.left}일)`, ...cd.facts].join('\n') };
  }

  return { ui, panel, itemHtml, setOfScope, lines, goals, coachFacts };
})();
