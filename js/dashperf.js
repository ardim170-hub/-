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

  return { ui, panel, itemHtml, setOfScope, lines, goals };
})();
