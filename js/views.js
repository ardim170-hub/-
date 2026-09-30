/* 화면 렌더링: 각 페이지와 상세 Drawer */
window.V = (() => {
  const e = U.esc;
  const I = {
    dash: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    biz: '<svg viewBox="0 0 24 24"><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M8 8h3M8 12h3M8 16h3M3 21h18"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    card: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.2c.7-1.5 1.9-2.2 3.2-2.2s2.5.7 3.2 2.2M14.5 10h4M14.5 13.5h3"/></svg>',
    net: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    data: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M5 4h3.5l1.5 4-2 1.3a11 11 0 0 0 6.7 6.7L16 14l4 1.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
    perf: '<svg viewBox="0 0 24 24"><path d="M5 20V11M11 20V5M17 20v-7M3 20h18"/></svg>',
    log: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/></svg>',
    trip: '<svg viewBox="0 0 24 24"><path d="M4 16l1.5-5h13L20 16v3H4z"/><path d="M6.5 11 8 6h8l1.5 5"/><circle cx="7.5" cy="16.5" r="1"/><circle cx="16.5" cy="16.5" r="1"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  };
  const ui = {
    biz: { stage: '전체', q: '', area: '', industry: '', mandatory: false, dup: false, prog: '', sort: 'recent', period: 'all', month: U.today().slice(0, 7) },
    net: { cat: '전체', q: '', status: '', dup: false },
    cards: { q: '', link: 'all', sort: 'recent', idx: '', dup: false, of: null },
    map: { biz: true, net: true, card: true, stages: new Set(D.STAGES.map(s => s.key)), q: '', mode: 'ours', gu: '', month: U.today().slice(0, 7), listAll: false, cityFit: 'fit', solo: null, pick: false, rprov: 'naver', rmode: 'car', rauto: true },
    sched: { month: U.today().slice(0, 7), sel: '', showDone: false },
    dash: { month: U.today().slice(0, 7), sel: U.today() },
    perf: { month: U.today().slice(0, 7), set: '', withActs: true, withNo: false, glMode: 'hall' },
  };

  /** 기간 필터: 발굴일이 기간 안에 드는지 */
  const PERIODS = [['all', '전체 기간'], ['this', '이번 달'], ['last', '지난 달'], ['3m', '최근 3개월'], ['year', '올해'], ['month', '월 선택']];
  function inPeriod(date, period, month) {
    if (period === 'all') return true;
    if (!date) return false;
    const T = U.today();
    const ym = T.slice(0, 7);
    const prev = (() => { const d = U.parse(T); d.setDate(1); d.setMonth(d.getMonth() - 1); return U.fmt(d).slice(0, 7); })();
    if (period === 'this') return date.startsWith(ym);
    if (period === 'last') return date.startsWith(prev);
    if (period === '3m') return U.diffDays(date, T) <= 92 && date <= T;
    if (period === 'year') return date.startsWith(T.slice(0, 4));
    if (period === 'month') return date.startsWith(month);
    return true;
  }
  const periodLabel = (p, m) => p === 'month' ? `${m.replace('-', '년 ')}월` : (PERIODS.find(x => x[0] === p) || [])[1];
  /** 지역 선택: 구 → 읍면동 */
  const areaOptions = sel => `<option value="">전체 지역</option>${D.GUS.map(g => `<optgroup label="${g.name}"><option value="gu:${g.name}" ${sel === 'gu:' + g.name ? 'selected' : ''}>${g.name} 전체</option>${g.areas.map(a => `<option ${sel === a ? 'selected' : ''}>${a}</option>`).join('')}</optgroup>`).join('')}`;
  const inArea = (x, sel) => !sel || (sel.startsWith('gu:') ? D.guOf(x.area) === sel.slice(3) : x.area === sel);
  /** 사업체 한 줄 요약 (기록에서 자동으로 만든다) */
  function bizLine(b) {
    const la = S.lastAct('biz', b.id);
    const ne = S.nextEvent('biz', b.id);
    const mand = D.mandatoryCount(b.employees);
    return [
      [b.industry, D.guOf(b.area) && `${D.guOf(b.area)} ${b.area}`].filter(Boolean).join(' · '),
      b.employees ? `상시 ${U.num(b.employees)}명${mand ? `(의무고용 ${mand}명)` : ''}` : '',
      `${b.stage} 단계${b.discoveredAt ? ` · ${U.dateDot(b.discoveredAt)} 발굴` : ''}`,
      la ? `최근 ${la.type} ${U.ago(la.date)}` : '연락 기록 없음',
      ne ? `다음 ${ne.type} ${U.dday(ne.date).label}` : '',
      b.placements ? `채용 ${b.placements}명` : '',
    ].filter(Boolean).join(' · ');
  }
  const SEARCH_SITES = [
    ['네이버', q => `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`],
    ['구글', q => `https://www.google.com/search?q=${encodeURIComponent(q)}`],
    ['카카오맵', q => `https://map.kakao.com/?q=${encodeURIComponent(q)}`],
    ['사람인', q => `https://www.saramin.co.kr/zf_user/search?searchword=${encodeURIComponent(q)}`],
    ['잡코리아', q => `https://www.jobkorea.co.kr/Search/?stext=${encodeURIComponent(q)}`],
  ];

  const stageBadge = s => { const st = D.STAGE[s] || D.STAGE['발굴']; return `<span class="badge stage-badge" style="--c:${st.color}"><span class="dot"></span>${e(s)}</span>`; };
  const statusBadge = s => `<span class="badge ${s === '활발' ? 'success' : s === '휴면' ? '' : 'navy'}">${e(s)}</span>`;
  const progBadge = prog => { const p = D.PROGRAM[prog]; return p ? `<span class="badge prog" style="--c:${p.color}" title="${e(p.key)}">${e(p.short)}</span>` : ''; };
  const staffTag = name => name ? `<span class="staff-tag">${e(name)}${progBadge(S.programOf(name))}</span>` : '<span class="meta">담당 미지정</span>';
  const scopeNote = () => S.getScope() === 'all' ? '' : ` · <b>${e(S.scopeLabel())}</b> 기준`;
  const ddayBadge = date => { const d = U.dday(date); return `<span class="badge ${d.tone} num">${d.label}</span>`; };
  const primaryContact = (kind, id) => S.cardsOf(kind, id)[0] || null;
  const tel = c => c ? (c.mobile || c.phone || '') : '';
  const opts = (list, sel, blank) => (blank != null ? `<option value="">${e(blank)}</option>` : '') + list.map(v => `<option ${v === sel ? 'selected' : ''}>${e(v)}</option>`).join('');
  const emptyState = (title, body, act, label) => `<div class="empty"><strong>${e(title)}</strong>${e(body)}${act ? `<div><button class="btn btn-primary" type="button" data-act="${act}">${e(label)}</button></div>` : ''}</div>`;

  /* ================= 대시보드 ================= */
  function dashboard() {
    const st = S.stats();
    const pr = S.priorities().slice(0, 10);
    const feed = S.recentActs(9);
    const org = S.get().settings.orgName;
    const kpi = (label, value, unit, foot, href, tone = '') => `<a class="kpi ${tone ? 'tone-' + tone : ''}" href="${href}"><div class="kpi-label">${label}</div><div class="kpi-value">${U.num(value)}<small>${unit}</small></div><div class="kpi-foot">${foot}</div></a>`;
    return `
      <div class="page-head"><div><h1 class="page-title">대시보드</h1><div class="page-desc">${U.dateKo(U.today())} · ${e(org)}${scopeNote()}</div></div></div>
      ${quickLinks()}
      <section class="panel kpis" aria-label="주요 현황">
        ${kpi('발굴 사업체', st.total, '곳', `이번 달 신규 ${st.newThisMonth}곳`, '#/biz', 'biz')}
        ${kpi('진행 중', st.active, '곳', '접촉 · 방문상담 · 채용협의', '#/biz', 'biz')}
        ${kpi('채용 연계', st.placedPeople, '명', `채용연계 사업체 ${st.placedBiz}곳`, '#/biz', 'placed')}
        ${kpi('네트워크 기관', st.netTotal, '곳', `활발히 협력 중 ${st.netActive}곳`, '#/network', 'net')}
        ${kpi('등록 명함', st.cardTotal, '장', `이번 달 받은 명함 ${st.cardsThisMonth}장`, '#/cards', 'card')}
      </section>
      <div class="dash-grid dash-top">
          <section class="panel panel-pad">
            <div class="section-head"><h2 class="section-title">오늘 확인할 일</h2><a href="#/schedule" class="sub">일정 전체 보기</a></div>
            ${pr.length ? `<ul class="prio">${pr.map(p => `
              <li data-act="${p.target ? 'open' : 'go'}" data-kind="${p.target?.kind || ''}" data-id="${p.target?.id || ''}" data-href="#/schedule">
                <span class="dday">${p.kind === 'gap' ? '<span class="badge warn">연락 필요</span>' : ddayBadge(p.date)}</span>
                <span style="min-width:0"><span class="who">${e(p.name)}</span> <span class="why">· ${e(p.why)}</span>${p.staff && S.getScope() === 'all' ? ` <span class="why">· ${e(p.staff)}</span>` : ''}</span>
                <span class="when">${p.kind === 'gap' ? '' : e(U.dateKo(p.date))}</span>
              </li>`).join('')}</ul>` : emptyState('오늘 확인할 일이 없습니다', '다가오는 일정이나 연락이 필요한 사업체가 생기면 여기에 표시됩니다.')}
          </section>
          <section class="panel dash-cal" id="dashCal">${dashCal()}</section>
      </div>
      <div class="dash-grid">
        <div class="stack">
          ${staffPanel()}
          <section class="panel panel-pad">
            <div class="section-head"><h2 class="section-title">월별 발굴 · 채용연계</h2>
              <div class="legend"><span><i style="--c:var(--accent)"></i>신규 발굴 사업체</span><span><i style="--c:var(--success)"></i>채용연계 건수</span></div></div>
            <div class="chart">${chart(S.monthly())}</div>
          </section>
        </div>
        <div class="stack">
          <section class="panel panel-pad">
            <div class="section-head"><h2 class="section-title">단계별 사업체</h2><span class="sub num">전체 ${st.total}곳</span></div>
            <div class="pipeline">${D.STAGES.map(s => {
              const n = st.byStage[s.key] || 0;
              const w = st.total ? Math.max(n ? 3 : 0, n / Math.max(...Object.values(st.byStage), 1) * 100) : 0;
              return `<div class="pipe-row" data-act="biz-stage" data-stage="${s.key}" title="${e(s.desc)}"><span>${s.key}</span><span class="pipe-bar"><span style="width:${w}%;--c:${s.color}"></span></span><span class="n">${n}</span></div>`;
            }).join('')}</div>
            ${st.mandatoryBiz ? `<p class="sub" style="margin:12px 0 0">장애인 의무고용 대상(상시 50인 이상) 사업체 <b class="num">${st.mandatoryBiz}</b>곳</p>` : ''}
          </section>
          <section class="panel panel-pad">
            <div class="section-head"><h2 class="section-title">최근 활동</h2></div>
            ${feed.length ? `<ul class="feed">${feed.map(a => {
              const t = S.targetOf(a);
              return `<li><span class="d">${U.md(a.date)}</span><span class="t">${t ? `<b data-act="open" data-kind="${a.targetType}" data-id="${t.id}">${e(t.name)}</b> · ` : ''}<span>${e(a.type)}</span> <span class="c">${e(a.content)}</span></span></li>`;
            }).join('')}</ul>` : emptyState('아직 활동 기록이 없습니다', '사업체나 기관 상세 화면에서 전화·방문 기록을 남겨 보세요.')}
          </section>
        </div>
      </div>`;
  }

  /** 대시보드 달력: 날짜를 누르면 그날 일정을 바로 아래에 보여준다 */
  function dashCal() {
    const f = ui.dash;
    const evs = S.view().events.filter(x => x.date === f.sel).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return `<div class="section-head" style="padding:16px 18px 0"><h2 class="section-title">달력</h2><a href="#/schedule" class="sub">일정 화면</a></div>
      ${calendar(f, 'dash-pick', 'dash-move')}
      <div class="dash-day">
        <div class="dash-day-head"><b>${e(U.dateKo(f.sel))}${f.sel === U.today() ? ' · 오늘' : ''}</b><button class="btn btn-ghost btn-sm" type="button" data-act="new-event" data-date="${f.sel}">+ 일정</button></div>
        ${evs.length ? evs.map(evRow).join('') : '<p class="sub" style="margin:0;padding:6px 16px 14px">이 날은 일정이 없습니다.</p>'}
      </div>`;
  }

  function quickLinks() {
    const links = S.get().settings.links || [];
    if (!links.length) return '';
    return `<nav class="quick-links" aria-label="바로가기">${links.map(l => l.url
      ? `<a class="qlink" href="${e(l.url)}" target="_blank" rel="noopener">${e(l.label)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>`
      : `<a class="qlink empty" href="#/data" title="데이터 관리에서 주소를 입력하세요">${e(l.label)} <span>주소 입력</span></a>`).join('')}
      <a class="qlink edit" href="#/data" title="바로가기 편집">편집</a></nav>`;
  }

  function staffPanel() {
    const ss = S.staffStats();
    const row = (label, r, cls = '', act = '') => `<tr class="${cls}" ${act}><td>${label}</td><td class="r">${r.biz}</td><td class="r">${r.active}</td><td class="r"><b>${r.placed}</b><span class="meta">명</span></td><td class="r">${r.net}</td><td class="r">${r.actsMonth}</td></tr>`;
    return `<section class="panel panel-pad">
      <div class="section-head"><h2 class="section-title">담당자별 현황</h2><span class="sub">팀 전체 · 행을 누르면 그 범위로 봅니다</span></div>
      <div class="table-wrap"><table class="tbl staff-tbl">
        <thead><tr><th>담당</th><th class="r">사업체</th><th class="r">진행 중</th><th class="r">채용</th><th class="r">기관</th><th class="r">이번 달 활동</th></tr></thead>
        <tbody>${ss.groups.map(g => `
          ${ss.groups.length > 1 || g.key ? row(g.key ? `<span class="prog-dot" style="--c:${D.PROGRAM[g.key].color}"></span><b>${e(g.key)}</b> <span class="meta">${g.people.length}명</span>` : '<b>소속 미지정</b>', g.total, 'grp', g.key ? `data-act="scope-set" data-scope="p:${e(g.key)}"` : '') : ''}
          ${g.people.map(p => row(`<span class="indent">${e(p.name)}${p.name === S.me() ? ' <span class="meta">(나)</span>' : ''}</span>`, p, '', `data-act="scope-set" data-scope="s:${e(p.name)}"`)).join('')}`).join('')}
          ${row('<b>팀 전체</b>', ss.total, 'grp total', 'data-act="scope-set" data-scope="all"')}
        </tbody></table></div>
      ${ss.orphan ? `<p class="sub" style="margin:10px 0 0">담당 직원이 직원 목록에 없는 사업체 ${ss.orphan}곳은 위 표에 들어가지 않습니다. 데이터 관리에서 직원 목록을 확인하세요.</p>` : ''}
    </section>`;
  }

  function chart(months) {
    const W = 640, H = 210, L = 30, R = 8, T = 16, B = 26;
    const max = Math.max(1, ...months.map(m => Math.max(m.discovered, m.placed)));
    const top = Math.max(2, Math.ceil(max / 2) * 2);
    const y = v => T + (H - T - B) * (1 - v / top);
    const gw = (W - L - R) / months.length;
    const bw = Math.min(14, gw / 3.2);
    const ticks = [0, top / 2, top];
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 12개월 신규 발굴 사업체 수와 채용연계 건수">
      ${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
      ${months.map((m, i) => {
        const cx = L + gw * i + gw / 2;
        const bar = (v, x, c, label) => v ? `<rect x="${x}" y="${y(v)}" width="${bw}" height="${y(0) - y(v)}" rx="2" fill="${c}"><title>${m.label} ${label} ${v}</title></rect><text x="${x + bw / 2}" y="${y(v) - 4}" text-anchor="middle" style="fill:var(--text);font-weight:600">${v}</text>` : '';
        return `${bar(m.discovered, cx - bw - 1, 'var(--accent)', '신규 발굴')}${bar(m.placed, cx + 1, 'var(--success)', '채용연계')}
          <text x="${cx}" y="${H - 8}" text-anchor="middle" ${i === months.length - 1 ? 'style="fill:var(--text);font-weight:700"' : ''}>${m.label}</text>`;
      }).join('')}
    </svg>`;
  }

  /* ================= 사업체 개발 ================= */
  function bizPage() {
    const f = ui.biz;
    const all = S.view().businesses;
    const count = k => k === '전체' ? all.length : all.filter(b => b.stage === k).length;
    return `
      <div class="page-head">
        <div><h1 class="page-title">사업체 개발</h1><div class="page-desc">장애인 채용 가능 사업체를 발굴하고 채용연계까지 단계별로 관리합니다.${scopeNote()}</div></div>
        <div class="inline"><a class="btn" href="#/map">지도에서 보기</a><button class="btn" type="button" data-act="biz-ledger" title="공유 시트 '구인업체 개발 대장' 열 순서로 복사">개발대장 복사</button><button class="btn" type="button" data-act="biz-upload" title="엑셀·CSV 목록이나 사업자등록증·구인공고 사진/PDF">파일로 등록</button><button class="btn btn-primary" type="button" data-act="new-biz">+ 사업체 발굴 등록</button></div>
      </div>

      <div class="chips" style="margin-bottom:8px">${['전체', ...D.STAGES.map(s => s.key)].map(k => `<button type="button" class="chip ${f.stage === k ? 'on' : ''}" data-act="biz-stage" data-stage="${k}" ${k !== '전체' ? `style="--c:${D.STAGE[k].color}"` : ''}>${k !== '전체' ? '<span class="dot"></span>' : ''}${k}<span class="n">${count(k)}</span></button>`).join('')}</div>
      <div class="chips prog-chips" style="margin-bottom:12px"><span class="sub" style="align-self:center">진행 사업</span>${[['', '전체'], ['placed', '취업 연계'], ['employ', '지원고용'], ['training', '현장훈련'], ['biz', '해당 없음']].map(([k, l]) => `<button type="button" class="chip tone-chip ${k ? 'tc-' + k : ''} ${f.prog === k ? 'on' : ''}" data-act="biz-prog" data-prog="${k}">${k && k !== 'biz' ? '<span class="dot"></span>' : ''}${l}<span class="n">${k ? all.filter(b => k === 'employ' || k === 'training' ? S.supportOf(b).types.includes(k === 'employ' ? '지원고용' : '현장훈련') : S.bizTone(b) === k).length : all.length}</span></button>`).join('')}</div>
      <div class="toolbar">
        <input class="input" id="bizQ" type="search" placeholder="사업체명, 직무, 담당자 이름·연락처" value="${e(f.q)}">
        <select class="select" id="bizPeriod" aria-label="발굴 기간">${PERIODS.map(([k, l]) => `<option value="${k}" ${f.period === k ? 'selected' : ''}>${k === 'all' ? l : '발굴 ' + l}</option>`).join('')}</select>
        <input class="input month-input" id="bizMonth" type="month" value="${e(f.month)}" aria-label="발굴 월" ${f.period === 'month' ? '' : 'hidden'}>
        <select class="select" id="bizArea" aria-label="지역">${areaOptions(f.area)}</select>
        <select class="select" id="bizInd" aria-label="업종">${opts(D.INDUSTRY_LIST, f.industry, '전체 업종')}</select>
        <label class="check"><input type="checkbox" id="bizMand" ${f.mandatory ? 'checked' : ''}>의무고용 대상만</label>
        <span class="spacer"></span>
        <select class="select" id="bizSort" aria-label="정렬">
          <option value="recent" ${f.sort === 'recent' ? 'selected' : ''}>최근 활동순</option>
          <option value="next" ${f.sort === 'next' ? 'selected' : ''}>다음 일정 빠른순</option>
          <option value="found" ${f.sort === 'found' ? 'selected' : ''}>최근 발굴순</option>
          <option value="name" ${f.sort === 'name' ? 'selected' : ''}>이름순</option>
        </select>
      </div>
      <div id="bizResults"></div>`;
  }

  function bizFiltered() {
    const f = ui.biz;
    const nq = U.norm(f.q);
    const dup = S.dupIndex('biz');
    let list = S.view().businesses.filter(b => {
      if (f.dup && !dup.has(b.id)) return false;
      if (f.prog === 'employ' || f.prog === 'training') { if (!S.supportOf(b).types.includes(f.prog === 'employ' ? '지원고용' : '현장훈련')) return false; }
      else if (f.prog && S.bizTone(b) !== f.prog) return false;
      if (f.stage !== '전체' && b.stage !== f.stage) return false;
      if (!inArea(b, f.area)) return false;
      if (f.industry && b.industry !== f.industry) return false;
      if (f.mandatory && !D.mandatoryCount(b.employees)) return false;
      if (!inPeriod(b.discoveredAt, f.period, f.month)) return false;
      if (nq && !U.match(f.q, b.name, b.industry, b.jobs, b.address, b.ceo, b.memo, b.staff, b.phone, b.research, ...S.cardsOf('biz', b.id).flatMap(c => [c.name, c.mobile, c.phone]))) return false;
      return true;
    }).map(b => ({ b, la: S.lastAct('biz', b.id), ne: S.nextEvent('biz', b.id), pc: primaryContact('biz', b.id) }));
    const sorters = {
      recent: (x, y) => (y.la?.date || '').localeCompare(x.la?.date || ''),
      next: (x, y) => (x.ne?.date || '9999').localeCompare(y.ne?.date || '9999'),
      found: (x, y) => (y.b.discoveredAt || '').localeCompare(x.b.discoveredAt || ''),
      name: (x, y) => x.b.name.replace(/^\(주\)/, '').localeCompare(y.b.name.replace(/^\(주\)/, ''), 'ko'),
    };
    return list.sort(sorters[f.sort] || sorters.recent);
  }

  /** 중복 의심 표시 · 지원고용 표시 */
  const dupTag = (idx, id) => (idx.has(id) ? ` <span class="badge dup" title="${e(idx.get(id).map(d => d.x.name + ' (' + d.why.join(', ') + ')').join(' / '))}">중복?</span>` : '');
  const supTag = b => S.supportOf(b).types.map(t => ` <span class="badge ${t === '지원고용' ? 'employ' : 'training'}">${t}</span>`).join('');
  const dupBar = (kind, n, on) => (n ? `<div class="dup-bar"><span>${{ biz: '사업체', net: '기관', card: '명함' }[kind]} <b>${n}</b>건이 다른 것과 겹쳐 보여요. 같은 곳이면 상세 화면에서 합칠 수 있어요.</span><button class="btn btn-sm" type="button" data-act="dup-toggle" data-kind="${kind}">${on ? '전체 보기' : '겹치는 것만 보기'}</button></div>` : '');
  function dupSec(kind, x) {
    const list = S.dupIndex(kind).get(x.id) || [];
    if (!list.length) return '';
    const label = y => (kind === 'card' ? `${y.name} · ${y.org || '소속 없음'}` : y.name);
    const meta = y => (kind === 'card' ? [y.mobile, y.email].filter(Boolean).join(' · ') : [y.address, y.phone].filter(Boolean).join(' · '));
    return `<section class="dr-sec dup-sec"><h3>중복 의심 <span class="badge dup">${list.length}</span></h3>
      <p class="sub" style="margin:0 0 8px">같은 ${kind === 'card' ? '사람' : '곳'}이 두 번 등록된 것 같아요. <b>이쪽으로 합치기</b>를 누르면 빈 칸을 채우고${kind === 'card' ? '' : ' 활동·일정·명함을 옮긴 뒤'} 다른 쪽을 지웁니다.</p>
      <div class="people">${list.map(d => `<div class="person"><div style="min-width:0"><div class="pn" data-act="open" data-kind="${kind}" data-id="${d.x.id}">${e(label(d.x))}</div><div class="pm"><b>${e(d.why.join(' · '))}</b>${meta(d.x) ? ' · ' + e(meta(d.x)) : ''}</div></div>
        <div class="inline"><button class="btn btn-sm" type="button" data-act="open" data-kind="${kind}" data-id="${d.x.id}">열기</button><button class="btn btn-sm btn-primary" type="button" data-act="merge" data-kind="${kind}" data-keep="${x.id}" data-drop="${d.x.id}">이쪽으로 합치기</button></div></div>`).join('')}</div></section>`;
  }

  function bizResults() {
    const f = ui.biz;
    const rows = bizFiltered();
    const applied = [];
    if (f.q) applied.push(['q', `검색: ${f.q}`]);
    if (f.area) applied.push(['area', f.area.replace('gu:', '')]);
    if (f.period !== 'all') applied.push(['period', `발굴 ${periodLabel(f.period, f.month)}`]);
    if (f.industry) applied.push(['industry', f.industry]);
    if (f.mandatory) applied.push(['mandatory', '의무고용 대상']);
    if (f.stage !== '전체') applied.push(['stage', f.stage]);
    if (f.dup) applied.push(['dup', '중복 의심만']);
    if (f.prog) applied.push(['prog', { placed: '취업 연계', employ: '지원고용', training: '현장훈련', biz: '진행 사업 없음' }[f.prog]]);
    const dup = S.dupIndex('biz');
    const chipsHtml = applied.length ? `<div class="chips" style="margin-bottom:10px">${applied.map(([k, l]) => `<button type="button" class="chip chip-applied" data-act="biz-unfilter" data-k="${k}">${e(l)} ✕</button>`).join('')}<button type="button" class="btn btn-ghost btn-sm" data-act="biz-reset">전체 초기화</button></div>` : '';
    if (!S.view().businesses.length) return `<div class="panel">${emptyState('등록된 사업체가 없습니다', '발굴한 사업체를 등록하면 지도와 대시보드에 함께 표시됩니다.', 'new-biz', '+ 사업체 발굴 등록')}</div>`;
    if (!rows.length) return chipsHtml + `<div class="panel"><div class="empty"><strong>조건에 맞는 사업체가 없습니다</strong>검색어나 필터를 바꿔 보세요.<div><button class="btn" type="button" data-act="biz-reset">필터 초기화</button></div></div></div>`;
    return chipsHtml + dupBar('biz', dup.size, f.dup) + `<div class="panel">
      <div class="table-wrap has-mobile"><table class="tbl">
        <thead><tr><th>사업체</th><th>단계</th><th>발굴일</th><th>가능 직무</th><th>사업체 담당자</th><th>우리 담당</th><th>최근 활동</th><th>다음 일정</th><th class="r">상시근로자</th><th class="r">채용</th></tr></thead>
        <tbody>${rows.map(({ b, la, ne, pc }) => `
          <tr data-act="open" data-kind="biz" data-id="${b.id}" class="row-biz is-${S.bizTone(b)}">
            <td><div class="name">${U.hl(b.name, f.q)}${supTag(b)}${dupTag(dup, b.id)}${M.hasPos(b) ? '' : ` <button type="button" class="badge nopos" data-act="edit-loc" data-kind="biz" data-id="${b.id}" title="지도에 안 나와요. 눌러서 위치 지정">📍 위치 없음</button>`}</div><div class="meta">${e(b.industry)} · ${D.guOf(b.area) ? e(D.guOf(b.area)) + ' ' : ''}${e(b.area || '지역 미지정')}</div></td>
            <td>${stageBadge(b.stage)}</td>
            <td class="nowrap num">${b.discoveredAt ? U.dateDot(b.discoveredAt) : '-'}</td>
            <td><div class="clip" title="${e(b.jobs)}">${e(b.jobs || '-')}</div></td>
            <td>${pc ? `<div>${e(pc.name)} <span class="meta">${e(pc.title || '')}</span></div><div class="meta num">${e(tel(pc))}</div>` : '<span class="meta">명함 없음</span>'}</td>
            <td class="nowrap">${staffTag(b.staff)}</td>
            <td class="nowrap">${la ? `<div class="num">${U.dateDot(la.date)}</div><div class="meta">${e(la.type)} · ${U.ago(la.date)}</div>` : '<span class="meta">-</span>'}</td>
            <td class="nowrap">${ne ? `${ddayBadge(ne.date)}<div class="meta">${e(ne.type)}</div>` : '<span class="meta">-</span>'}</td>
            <td class="r">${b.employees ? U.num(b.employees) + '명' : '-'}${D.mandatoryCount(b.employees) ? `<div class="meta">의무 ${D.mandatoryCount(b.employees)}명</div>` : ''}</td>
            <td class="r">${b.placements ? `<b>${b.placements}명</b>` : '<span class="meta">-</span>'}</td>
          </tr>`).join('')}</tbody>
      </table></div>
      <div class="mlist">${rows.map(({ b, la, ne, pc }) => `
        <div class="mrow row-biz is-${S.bizTone(b)}" data-act="open" data-kind="biz" data-id="${b.id}">
          <div class="mrow-top"><span class="name">${U.hl(b.name, f.q)}${supTag(b)}${dupTag(dup, b.id)}</span>${stageBadge(b.stage)}</div>
          ${b.jobs ? `<div class="meta">가능 직무: ${e(b.jobs)}</div>` : ''}
          <div class="meta">${e(b.industry)} · ${e(b.area || '')} · ${b.discoveredAt ? U.dateDot(b.discoveredAt) + ' 발굴' : ''}${pc ? ` · ${e(pc.name)} ${e(tel(pc))}` : ''}</div>
          <div class="meta">${staffTag(b.staff)}</div>
          <div class="meta">${la ? `최근 ${e(la.type)} ${U.ago(la.date)}` : ''}${ne ? ` · 다음 ${e(ne.type)} ${U.dday(ne.date).label}` : ''}</div>
        </div>`).join('')}</div>
      <div class="list-count num">${rows.length}곳 표시 · ${e(S.scopeLabel())} ${S.view().businesses.length}곳</div>
    </div>`;
  }

  /* ================= 네트워크 ================= */
  function netPage() {
    const f = ui.net;
    const all = S.view().networks;
    const count = k => k === '전체' ? all.length : all.filter(n => n.category === k).length;
    return `
      <div class="page-head">
        <div><h1 class="page-title">네트워크</h1><div class="page-desc">복지관 홍보와 협력을 위한 지역 기관을 관리합니다.${scopeNote()}</div></div>
        <div class="inline"><a class="btn" href="#/map" data-act="map-net-only">지도에서 보기</a><button class="btn btn-primary" type="button" data-act="new-net">+ 기관 등록</button></div>
      </div>
      <div class="chips" style="margin-bottom:12px">${['전체', ...new Set([...D.NET_CATEGORIES, ...all.map(n => n.category).filter(Boolean)])].filter(k => k === '전체' || D.NET_CATEGORIES.slice(0, 3).includes(k) || count(k)).map(k => `<button type="button" class="chip ${f.cat === k ? 'on' : ''}" data-act="net-cat" data-cat="${k}">${k}<span class="n">${count(k)}</span></button>`).join('')}</div>
      <div class="toolbar">
        <input class="input" id="netQ" type="search" placeholder="기관명, 협력 내용, 담당자" value="${e(f.q)}">
        <select class="select" id="netStatus" aria-label="관계 상태">${opts(D.NET_STATUS, f.status, '전체 관계 상태')}</select>
      </div>
      ${triagePanel()}
      <div id="netResults"></div>`;
  }
  /** 연결 안 된 명함을 사업체/네트워크로 나누는 목록 */
  function triagePanel(limit = 8) {
    const list = S.get().cards.filter(c => !c.linkType && !(c.tags || []).includes('개인')).sort((a, b) => (b.metAt || '').localeCompare(a.metAt || ''));
    if (!list.length) return '';
    return `<section class="panel panel-pad triage">
      <div class="section-head"><h2 class="section-title">분류 대기 명함 <span class="num sub">${list.length}장</span></h2><span class="sub">버튼 하나로 사업체 개발이나 네트워크에 등록되고 지도에 표시됩니다</span></div>
      <ul class="triage-list">${list.slice(0, limit).map(c => `<li>
        <div style="min-width:0"><b data-act="open" data-kind="card" data-id="${c.id}">${e(c.org || c.name)}</b> <span class="sub">${e(c.name)} ${e(c.title || '')}${c.area ? ' · ' + e(D.guOf(c.area) + ' ' + c.area) : ''}</span></div>
        <div class="inline">${triageButtons(c)}</div></li>`).join('')}</ul>
      ${list.length > limit ? `<a class="sub" href="#/cards" data-act="card-link-none">나머지 ${list.length - limit}장 보기</a>` : ''}
    </section>`;
  }
  /** 연결 안 된 명함: 소속이 같은 곳이 있으면 '연결'을 먼저, 없으면 새로 등록 */
  const triageButtons = c => S.matchPlaces(c).slice(0, 2).map(m => `<button class="btn btn-sm btn-link-to ${m.kind}" type="button" data-act="card-link-to" data-id="${c.id}" data-kind="${m.kind}" data-target="${m.x.id}" title="${m.kind === 'biz' ? '사업체' : '네트워크'}에 이미 있어요">🔗 ${e(m.x.name)}에 연결</button>`).join('') + triageNew(c);
  const triageNew = c => `<button class="btn btn-sm" type="button" data-act="triage" data-to="biz" data-id="${c.id}">사업체로</button><button class="btn btn-sm" type="button" data-act="triage" data-to="net" data-id="${c.id}">네트워크로</button><button class="btn btn-ghost btn-sm" type="button" data-act="triage" data-to="personal" data-id="${c.id}" title="개인 연락처로 두고 이 목록에서 뺍니다">개인</button>`;
  function netResults() {
    const f = ui.net;
    const nq = U.norm(f.q);
    const all = S.view().networks;
    if (!all.length) return `<div class="panel">${emptyState('등록된 기관이 없습니다', '협력·홍보 기관을 등록하면 지도에 함께 표시됩니다.', 'new-net', '+ 기관 등록')}</div>`;
    const dup = S.dupIndex('net');
    const rows = all.filter(n => (!f.dup || dup.has(n.id)) && (f.cat === '전체' || n.category === f.cat) && (!f.status || n.status === f.status) &&
      (!nq || U.match(f.q, n.name, n.relation, n.promo, n.memo, n.address, n.staff, ...S.cardsOf('net', n.id).flatMap(c => [c.name, c.mobile, c.phone]))))
      .map(n => ({ n, la: S.lastAct('net', n.id), ne: S.nextEvent('net', n.id), pc: primaryContact('net', n.id) }))
      .sort((x, y) => (y.la?.date || '').localeCompare(x.la?.date || ''));
    if (!rows.length) return `<div class="panel"><div class="empty"><strong>조건에 맞는 기관이 없습니다</strong>검색어나 분류를 바꿔 보세요.</div></div>`;
    return dupBar('net', dup.size, f.dup) + `<div class="panel">
      <div class="table-wrap has-mobile"><table class="tbl">
        <thead><tr><th>기관</th><th>관계</th><th>협력 내용</th><th>기관 담당자</th><th>우리 담당</th><th>최근 활동</th><th>다음 일정</th></tr></thead>
        <tbody>${rows.map(({ n, la, ne, pc }) => `
          <tr data-act="open" data-kind="net" data-id="${n.id}" class="row-net ${S.isHome(n) ? 'is-home' : ''}">
            <td><div class="name">${S.isHome(n) ? '<span class="home-star" aria-hidden="true">★</span>' : ''}${U.hl(n.name, f.q)}${dupTag(dup, n.id)}${M.hasPos(n) ? '' : ` <button type="button" class="badge nopos" data-act="edit-loc" data-kind="net" data-id="${n.id}" title="지도에 안 나와요. 눌러서 위치 지정">📍 위치 없음</button>`}</div><div class="meta">${e(n.category)} · ${e(n.area || '')}</div></td>
            <td>${statusBadge(n.status)}</td>
            <td><div class="clip" title="${e(n.relation)}">${e(n.relation || '-')}</div><div class="meta clip">홍보: ${e(n.promo || '-')}</div></td>
            <td>${pc ? `<div>${e(pc.name)} <span class="meta">${e(pc.title || '')}</span></div><div class="meta num">${e(tel(pc))}</div>` : '<span class="meta">명함 없음</span>'}</td>
            <td class="nowrap">${staffTag(n.staff)}</td>
            <td class="nowrap">${la ? `<div class="num">${U.dateDot(la.date)}</div><div class="meta">${e(la.type)} · ${U.ago(la.date)}</div>` : '-'}</td>
            <td class="nowrap">${ne ? `${ddayBadge(ne.date)}<div class="meta">${e(ne.type)}</div>` : '<span class="meta">-</span>'}</td>
          </tr>`).join('')}</tbody></table></div>
      <div class="mlist">${rows.map(({ n, la, pc }) => `
        <div class="mrow" data-act="open" data-kind="net" data-id="${n.id}">
          <div class="mrow-top"><span class="name">${U.hl(n.name, f.q)}</span>${statusBadge(n.status)}</div>
          <div class="meta">${e(n.category)} · ${e(n.relation || '')}</div>
          <div class="meta">${pc ? `${e(pc.name)} ${e(tel(pc))}` : ''}${la ? ` · 최근 ${U.ago(la.date)}` : ''}</div>
        </div>`).join('')}</div>
      <div class="list-count num">${rows.length}곳 표시 · ${e(S.scopeLabel())} ${all.length}곳</div>
    </div>`;
  }

  /* ================= 명함 ================= */
  function cardsPage() {
    const f = ui.cards;
    const all = S.view().cards;
    const cnt = k => all.filter(c => k === 'all' ? true : k === 'none' ? !c.linkType : c.linkType === k).length;
    return `
      <div class="page-head">
        <div><h1 class="page-title">명함 관리</h1><div class="page-desc">휴대폰으로 명함을 찍어 올리면 ${AI.available() ? 'AI가 이름·연락처를 읽어 채워 줍니다' : '사진과 함께 보관됩니다'}. 사업체·기관과 연결하면 지도와 상세 화면에 함께 나옵니다.</div></div>
        <div class="inline"><button class="btn" type="button" data-act="new-card">직접 입력</button><button class="btn btn-primary" type="button" data-act="card-photo">${I.camera}명함 사진으로 등록</button></div>
      </div>

      <div class="chips" style="margin-bottom:12px">${[['all', '전체'], ['biz', '사업체 담당자'], ['net', '네트워크 기관'], ['none', '연결 안 됨']].map(([k, l]) => `<button type="button" class="chip ${f.link === k ? 'on' : ''}" data-act="card-link" data-link="${k}">${l}<span class="n">${cnt(k)}</span></button>`).join('')}</div>
      <div class="toolbar">
        <input class="input" id="cardQ" type="search" placeholder="이름·소속·전화 뒷자리·초성(ㄱㅈㅂ)" value="${e(f.q)}">
        <span class="spacer"></span>
        <select class="select" id="cardSort" aria-label="정렬">
          <option value="recent" ${f.sort === 'recent' ? 'selected' : ''}>최근 받은 순</option>
          <option value="name" ${f.sort === 'name' ? 'selected' : ''}>이름순</option>
          <option value="org" ${f.sort === 'org' ? 'selected' : ''}>소속순</option>
        </select>
      </div>
      <div class="index-bar" role="toolbar" aria-label="가나다 색인">${['', ...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split(''), 'A-Z'].map(k => `<button type="button" class="${f.idx === k ? 'on' : ''}" data-act="card-idx" data-idx="${k}">${k || '전체'}</button>`).join('')}</div>
      <div id="cardResults"></div>`;
  }
  function cardResults() {
    const f = ui.cards;
    const nq = U.norm(f.q);
    const all = S.view().cards;
    if (!all.length) return `<div class="panel">${emptyState('등록된 명함이 없습니다', '명함 사진과 연락처를 등록해 보세요.', 'new-card', '+ 명함 등록')}</div>`;
    const dup = S.dupIndex('card');
    const rows = all.filter(c => (!f.dup || dup.has(c.id)) && (!f.of || (c.linkType === f.of.kind && c.linkId === f.of.id)) && (f.link === 'all' || (f.link === 'none' ? !c.linkType : c.linkType === f.link)) &&
      (!f.idx || U.indexOf(f.sort === 'org' ? c.org : c.name) === f.idx) &&
      (!nq || U.match(f.q, c.name, c.org, c.dept, c.title, c.mobile, c.phone, c.email, (c.tags || []).join(','), c.memo, c.address)))
      .sort({
        recent: (a, b) => (b.metAt || '').localeCompare(a.metAt || ''),
        name: (a, b) => a.name.localeCompare(b.name, 'ko'),
        org: (a, b) => (a.org || '').replace(/^\(주\)/, '').localeCompare((b.org || '').replace(/^\(주\)/, ''), 'ko'),
      }[f.sort]);
    const ofChip = f.of ? `<div class="chips" style="margin-bottom:10px"><button type="button" class="chip chip-applied" data-act="cards-of-clear">${e(f.of.name)}의 명함만 ✕</button></div>` : '';
    if (!rows.length && f.of) return ofChip + `<div class="panel"><div class="empty"><strong>${e(f.of.name)}에 연결된 명함이 없습니다</strong>명함을 등록할 때 이곳과 연결하면 여기에 모입니다.</div></div>`;
    if (!rows.length) return `<div class="panel"><div class="empty"><strong>검색 결과가 없습니다</strong>이름 일부, 전화번호 뒷자리, 초성(ㄱㅈㅂ)으로도 찾을 수 있어요.${f.idx ? '<div><button class="btn" type="button" data-act="card-idx" data-idx="">색인 해제</button></div>' : ''}</div></div>`;
    const linkable = all.filter(c => !c.linkType && !(c.tags || []).includes('개인') && S.matchPlaces(c).length === 1).length;
    const linkBar = linkable ? `<div class="dup-bar link-bar"><span>🔗 소속이 같은 사업체·기관이 이미 있는데 <b>연결 안 된 명함 ${linkable}장</b>이 있어요. 연결하면 지도와 상세 화면에 같이 나와요.</span><button class="btn btn-sm btn-primary" type="button" data-act="card-autolink">한꺼번에 연결</button></div>` : '';
    return ofChip + linkBar + dupBar('card', dup.size, f.dup) + `<div class="card-grid">${rows.map(c => {
      const link = S.linkOf(c);
      const tone = c.linkType === 'biz' ? 'k-' + S.bizTone(link) : c.linkType === 'net' ? (link && S.isHome(link) ? 'k-home' : 'k-net') : 'k-none';
      return `<article class="bcard ${tone}" data-act="open" data-kind="card" data-id="${c.id}" tabindex="0">
        <div class="org">${c.linkType === 'biz' ? `<span class="badge stage-badge" style="--c:${D.STAGE[link?.stage]?.color || 'var(--muted)'}"><span class="dot"></span>사업체</span>` : c.linkType === 'net' ? '<span class="badge navy">기관</span>' : ''}<span>${U.hl(c.org || '소속 미기재', f.q)}</span></div>
        <div class="pname">${U.hl(c.name, f.q)}${dupTag(dup, c.id)}<span class="ptitle">${e([c.dept, c.title].filter(Boolean).join(' · '))}</span></div>
        <div class="contact">
          ${c.mobile ? `<div>M ${U.hl(c.mobile, f.q)}</div>` : ''}
          ${c.phone ? `<div>T ${U.hl(c.phone, f.q)}</div>` : ''}
          ${c.email ? `<div>${e(c.email)}</div>` : ''}
        </div>
        ${c.photo ? '<span class="tagline photo-flag">사진 있음</span>' : ''}${link && link.staff ? `<span class="card-staff">우리 담당 ${e(link.staff)}</span>` : ''}
      </article>`;
    }).join('')}</div><p class="sub num" style="margin-top:12px">${rows.length}장 표시 · ${e(S.scopeLabel())} ${all.length}장</p>`;
  }

  /* ================= 지도 ================= */
  function mapPage() {
    const f = ui.map;
    const st = S.view();
    const noPos = st.businesses.filter(b => !M.hasPos(b)).length + st.networks.filter(n => !M.hasPos(n)).length;
    const pending = st.cards.filter(c => !c.linkType && M.hasPos(c) && !(c.tags || []).includes('개인')).length;
    const guCount = g => st.businesses.filter(b => D.guOf(b.area) === g).length + st.networks.filter(n => D.guOf(n.area) === g).length;
    return `
      <div class="page-head">
        <div><h1 class="page-title">화성시 지도</h1><div class="page-desc">모든 사업체·기관을 지도에 표시하고, 옆 목록에는 고른 달에 발굴한 사업체만 보여줍니다.${scopeNote()}</div></div>
        <div class="inline"><button class="btn" type="button" data-act="new-net">+ 기관 등록</button><button class="btn btn-primary" type="button" data-act="new-biz">+ 사업체 발굴 등록</button></div>
      </div>
      <div class="map-bar"><div class="chips" role="tablist">
        <button type="button" role="tab" class="chip ${f.mode === 'ours' ? 'on' : ''}" data-act="map-mode" data-mode="ours" aria-selected="${f.mode === 'ours'}">사업체·네트워크 지도</button>
        <button type="button" role="tab" class="chip ${f.mode === 'city' ? 'on' : ''}" data-act="map-mode" data-mode="city" aria-selected="${f.mode === 'city'}">화성시 대시보드</button>
      </div>
      ${f.mode === 'city' ? '' : `<div class="chips gu-chips">${[['', '화성시 전체'], ...D.GUS.map(g => [g.name, g.name])].map(([k, l]) => `<button type="button" class="chip ${f.gu === k ? 'on' : ''}" data-act="map-gu" data-gu="${k}" ${k ? `style="--c:${D.GU[k].color}"` : ''}>${k ? '<span class="dot"></span>' : ''}${l}${k ? `<span class="n">${guCount(k)}</span>` : ''}</button>`).join('')}</div>`}</div>
      ${f.mode === 'city' ? cityMap() : `
      <section class="panel map-layout">
        <div class="map-main">
          <div class="map-tools">
            <input class="input" id="mapQ" type="search" placeholder="이름 찾기 (초성 가능)" value="${e(f.q)}">
            <div class="chips">
              <button type="button" class="chip ${f.biz ? 'on' : ''}" data-act="map-layer" data-layer="biz">사업체 개발</button>
              <button type="button" class="chip ${f.net ? 'on' : ''}" data-act="map-layer" data-layer="net">네트워크</button>
              <button type="button" class="chip ${f.card ? 'on' : ''}" data-act="map-layer" data-layer="card">분류 대기 명함${pending ? ` <span class="n">${pending}</span>` : ''}</button>
            </div>
            <details class="map-dd"><summary>단계 <b class="num">${f.stages.size}/${D.STAGES.length}</b></summary>
              <div class="map-dd-body">${D.STAGES.map(s => `<label class="check"><input type="checkbox" data-act="map-stage" data-stage="${s.key}" ${f.stages.has(s.key) ? 'checked' : ''} ${f.biz ? '' : 'disabled'}>${s.key}</label>`).join('')}</div>
            </details>
            <button type="button" class="btn btn-sm btn-pick ${f.pick ? 'on' : ''}" data-act="route-pick" id="routePickBtn" aria-pressed="${!!f.pick}">${f.pick ? '✔ 두 곳 찍는 중' : '📍 두 곳 찍어 길찾기'}</button>
            ${S.view().networks.some(n => S.isHome(n) && M.hasPos(n)) ? '' : `<button class="btn btn-sm" type="button" data-act="home-add">★ 복지관 위치 등록</button>`}
          </div>
          <div class="map-canvas">
            <div class="map-box" id="bigMap"></div>
            <div class="map-solo" id="mapSolo">${soloBar()}</div>
            <div class="map-legend map-key map-float">
              <span><i class="dot-lg" style="--c:${D.MAP_COLORS.biz}"></i>사업체 개발</span>
              <span><i class="dot-lg" style="--c:${D.MAP_COLORS.placed}"></i>취업 연계</span>
              <span><i class="dot-lg" style="--c:${D.MAP_COLORS.employ}"></i>지원고용</span>
              <span><i class="dot-lg" style="--c:${D.MAP_COLORS.training}"></i>현장훈련</span>
              <span><i class="sq" style="--c:${D.MAP_COLORS.net}"></i>기관</span>
              <span><i class="star" style="--c:${D.MAP_COLORS.home}"></i>아르딤복지관</span>
              <span><i class="sq" style="--c:${D.MAP_COLORS.card}"></i>명함</span>
              <span><i class="ring"></i>이 달 발굴</span>
            </div>
          </div>
        </div>
        <div class="map-side">
          <div id="routeBox">${routePanel()}</div>
          <div class="map-side-head">
            <div class="month-nav">
              <button class="icon-btn" type="button" data-act="map-month" data-d="-1" aria-label="이전 달">${I.back}</button>
              <b class="num" id="mapMonthLabel">${monthLabel(f.month)}</b>
              <button class="icon-btn" type="button" data-act="map-month" data-d="1" aria-label="다음 달" style="transform:scaleX(-1)">${I.back}</button>
              <button class="btn btn-ghost btn-sm" type="button" data-act="map-listmode" id="mapListMode">${f.listAll ? '이 달만' : '전체 목록'}</button>
            </div>
            ${noPos ? `<button type="button" class="nopos-bar ${f.noPos ? 'on' : ''}" data-act="map-nopos">📍 위치가 없어 지도에 안 나오는 곳 <b>${noPos}</b>곳 · ${f.noPos ? '지도 목록으로 돌아가기' : '보고 위치 정하기'}</button>` : ''}
          </div>
          <div class="map-list" id="mapList"></div>
        </div>
      </section>`}`;
  }
  /** 화성시 통합 대시보드(공유 링크). 1920×1080 화면으로 그린 뒤 칸 너비에 맞춰 줄여 비율을 유지한다 */
  function cityMap() {
    const url = S.get().settings.cityMapUrl || '';
    const f = ui.map;
    if (!url) return `<div class="panel">${emptyState('화성시 대시보드 주소가 없습니다', '데이터 관리 > 화성시 대시보드 주소에 공유 링크를 넣어 주세요.')}</div>`;
    return `<section class="panel" style="overflow:hidden">
      <div class="panel-pad" style="display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding-block:12px">
        <span class="sub">화성시 통합 대시보드 공유 화면입니다. 화면이 비어 보이면 새 창에서 여세요.</span>
        <div class="inline">
          <select class="select" id="cityFit" aria-label="화면 크기">${[['fit', '화면 맞춤 (16:9)'], ['wide', '넓은 화면 (21:9)'], ['full', '원래 크기']].map(([k, l]) => `<option value="${k}" ${f.cityFit === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <a class="btn btn-sm" href="${e(url)}" target="_blank" rel="noopener">새 창에서 열기</a>
        </div>
      </div>
      <div class="city-wrap" id="cityWrap"><iframe class="city-frame" id="cityFrame" src="${e(url)}" title="화성시 통합 대시보드" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allow="fullscreen; geolocation"></iframe></div>
    </section>`;
  }
  const monthLabel = m => `${m.slice(0, 4)}년 ${+m.slice(5, 7)}월`;
  const inMonth = (x, m) => (x.discoveredAt || x.since || x.metAt || x.createdAt || '').startsWith(m);
  /** 지도에 찍을 전체 목록 (구·레이어·단계·검색 반영) */
  function mapItems() {
    const f = ui.map;
    const st = S.view();
    const items = [];
    if (f.biz && S.can('biz', 1)) st.businesses.filter(b => f.stages.has(b.stage)).forEach(b => items.push({ kind: 'biz', x: b }));
    // 우리 복지관(금색 별)은 기준점이라 네트워크를 꺼도, 구·검색으로 걸러도 늘 보인다
    st.networks.forEach(n => { if ((f.net && S.can('network', 1)) || S.isHome(n)) items.push({ kind: 'net', x: n, home: S.isHome(n) }); });
    if (f.card && S.can('cards', 1)) st.cards.filter(c => !c.linkType && !(c.tags || []).includes('개인')).forEach(c => items.push({ kind: 'card', x: c }));
    return items.filter(({ x, home }) => home || ((!f.gu || D.guOf(x.area) === f.gu) && U.match(f.q, x.name, x.org, x.area, D.guOf(x.area), x.industry, x.category)))
      .map(it => ({ ...it, month: it.kind === 'biz' && inMonth(it.x, f.month) }));
  }
  /** 이것만 보기 중이면 지도 위에 이름과 "전체 보기" 버튼 */
  function soloBar() {
    const so = ui.map.solo;
    const x = so && S.find(so.kind, so.id);
    if (!x) return '';
    return `<span>👁 <b>${e(so.kind === 'card' ? (x.org || x.name) : x.name)}</b>만 보는 중</span><button class="btn btn-sm btn-primary" type="button" data-act="map-solo-off">전체 보기</button>`;
  }
  /** 길찾기 끝점: 사업체·기관·명함이거나, 지도에서 직접 찍은 점({kind:'pt'}). 출발이 비면 우리 복지관 */
  function routeEnd(ref, fallbackHome) {
    if (!ref) return fallbackHome ? S.get().networks.find(n => S.isHome(n) && M.hasPos(n)) || null : null;
    if (ref.kind === 'pt') return { id: `pt${ref.lat},${ref.lng}`, name: ref.name || '찍은 위치', lat: ref.lat, lng: ref.lng };
    const x = S.find(ref.kind, ref.id);
    return x ? { ...x, name: ref.kind === 'card' ? (x.org || x.name) : x.name } : null;
  }
  const ROUTE_MODES = [['car', '🚗 자동차'], ['transit', '🚌 대중교통'], ['walk', '🚶 도보']];
  /** 오른쪽 길찾기 칸: 두 곳을 고르면 도로 경로를 그리고, 네이버·카카오 길찾기 창을 오른쪽에 띄운다 */
  function routePanel() {
    const f = ui.map, r = f.route;
    const head = (x = true) => `<div class="route-head"><b>🧭 길찾기</b>${x ? `<button class="icon-btn" type="button" data-act="route-clear" aria-label="길찾기 지우기" style="width:28px;height:28px">${I.close}</button>` : ''}</div>`;
    const opts = `<div class="route-opts">
        <div class="seg" role="group" aria-label="길찾기 지도">${[['naver', '네이버'], ['kakao', '카카오']].map(([k, l]) => `<button type="button" class="${f.rprov === k ? 'on' : ''}" data-act="route-prov" data-prov="${k}">${l}</button>`).join('')}</div>
        ${f.rprov === 'naver' ? `<div class="seg" role="group" aria-label="이동 수단">${ROUTE_MODES.map(([k, l]) => `<button type="button" class="${f.rmode === k ? 'on' : ''}" data-act="route-mode" data-mode="${k}">${l}</button>`).join('')}</div>` : ''}
        <label class="check sub"><input type="checkbox" data-act="route-auto" ${f.rauto ? 'checked' : ''}>두 곳을 고르면 길찾기 창 자동으로 열기</label>
      </div>`;
    const from = r ? routeEnd(r.from, true) : null;
    const to = r ? routeEnd(r.to) : null;
    const end = (cls, label, x, ph) => `<span class="${cls}">${label} <b>${x ? e(x.name) : `<span class="sub">${ph}</span>`}</b></span>`;
    if (!r || !r.to) return `<div class="route-box ${r ? '' : 'idle'}">${head(!!r)}
      <div class="route-ends">${end('from', '출발', from, f.pick ? '지도에서 첫 번째 곳을 찍으세요' : '복지관 (위치 등록 필요)')}${end('to', '도착', null, f.pick ? '두 번째 곳을 찍으세요' : '지도에서 고르기')}</div>
      <p class="sub" style="margin:0">${f.pick ? '지도에서 <b>점(사업체·기관)</b>이나 <b>아무 곳</b>을 차례로 두 번 찍으면 바로 경로를 그리고 오른쪽에 길찾기 창을 띄워요.' : '지도 위 <b>📍 두 곳 찍어 길찾기</b>를 누르고 두 곳을 찍거나, 점을 눌러 <b>여기까지 길찾기</b>를 누르세요.'}</p>
      ${opts}</div>`;
    if (!to || !M.hasPos(to)) return `<div class="route-box">${head()}<span class="sub">도착지 위치가 없습니다.</span></div>`;
    if (!from || !M.hasPos(from)) return `<div class="route-box">${head()}<div class="route-ends">${end('to', '도착', to)}</div><span class="sub">출발지가 없어요. 지도에서 다른 곳을 찍거나, 복지관 위치를 등록해 주세요.</span><button class="btn btn-sm" type="button" data-act="home-add" style="align-self:flex-start">★ 복지관 위치 등록</button></div>`;
    const info = f.routeInfo && f.routeInfo.key === [from.id, to.id].join('>') ? f.routeInfo : null;
    const road = info && info.road;
    const km = road ? road.km : M.distKm(from, to);
    return `<div class="route-box">${head()}
      <div class="route-ends">${end('from', '출발', from)}<button class="icon-btn" type="button" data-act="route-swap" aria-label="출발·도착 바꾸기" title="출발·도착 바꾸기" style="width:28px;height:28px">⇅</button>${end('to', '도착', to)}</div>
      <div class="route-est"><span>${road ? '도로' : '직선'} <b class="num">${km.toFixed(1)}km</b></span><span class="sub">${info && info.loading ? '도로 경로 찾는 중…' : road ? '지도의 파란 선이 도로 경로' : ''}</span></div>
      <button class="btn btn-route route-open" type="button" data-act="route-open">${f.rprov === 'kakao' ? '카카오맵' : '네이버 지도'} 길찾기 창 열기 →</button>
      ${opts}
      <p class="sub route-note">걸리는 시간·실시간 교통은 오른쪽에 뜨는 ${f.rprov === 'kakao' ? '카카오맵' : '네이버 지도'} 창에서 보세요. 창이 안 뜨면 브라우저 주소창 오른쪽의 <b>팝업 차단</b>을 풀어 주세요.</p>
    </div>`;
  }
  /** 옆 목록: 기본은 고른 달에 발굴한 사업체만, 구별로 묶어서 */
  function mapList(items) {
    const f = ui.map;
    if (f.noPos) {
      const st = S.view();
      const list = [...st.businesses.filter(b => !M.hasPos(b)).map(x => ({ kind: 'biz', x })), ...st.networks.filter(n => !M.hasPos(n)).map(x => ({ kind: 'net', x }))];
      if (!list.length) return '<div class="empty"><strong>모두 지도에 표시되고 있어요</strong></div>';
      const withAddr = list.filter(i => i.x.address).length;
      return `${withAddr ? `<div class="panel-pad" style="padding:10px 12px"><button class="btn btn-sm btn-primary" type="button" data-act="nopos-refind">주소가 있는 ${withAddr}곳 한꺼번에 다시 찾기</button></div>` : ''}<div class="map-group"><h4>위치 없음 <span class="num">${list.length}</span></h4>${list.map(({ kind, x }) => `
        <div class="map-item nopos-item"><span class="mk ${kind === 'net' ? 'sq' : ''}" style="--c:${kind === 'biz' ? M.bizColor(x) : D.MAP_COLORS.net}"></span>
          <div style="min-width:0;flex:1"><div class="name" data-act="open" data-kind="${kind}" data-id="${x.id}">${e(x.name)}</div><div class="meta">${kind === 'biz' ? '사업체' : '기관'} · ${e(x.address || '주소 없음')}</div></div>
          <button class="btn btn-sm btn-primary" type="button" data-act="edit-loc" data-kind="${kind}" data-id="${x.id}">위치 지정</button></div>`).join('')}</div>`;
    }
    const list = f.listAll ? items : items.filter(i => i.month);
    if (!list.length) return `<div class="empty"><strong>${f.listAll ? '표시할 곳이 없습니다' : `${monthLabel(f.month)}에 발굴한 사업체가 없습니다`}</strong>${f.listAll ? '레이어나 단계 선택을 확인하세요.' : '다른 달을 보거나 전체 목록을 눌러 보세요.'}</div>`;
    const groups = [...D.GUS.map(g => g.name), ''].map(g => [g, list.filter(i => D.guOf(i.x.area) === g)]).filter(([, l]) => l.length);
    return groups.map(([g, l]) => `<div class="map-group"><h4>${g ? `<span class="prog-dot" style="--c:${D.GU[g].color}"></span>${g}` : '구 미지정'} <span class="num">${l.length}</span></h4>${l.map(({ kind, x }) => `
      <div class="map-item ${f.solo && f.solo.kind === kind && f.solo.id === x.id ? 'on' : ''}" data-act="map-solo" data-kind="${kind}" data-id="${x.id}" title="누르면 지도에 이곳만 보여요">
        <span class="mk ${kind === 'net' && S.isHome(x) ? 'star' : kind !== 'biz' ? 'sq' : ''}" style="--c:${kind === 'biz' ? M.bizColor(x) : kind === 'net' ? (S.isHome(x) ? D.MAP_COLORS.home : D.MAP_COLORS.net) : D.MAP_COLORS.card}"></span>
        <div style="min-width:0"><div class="name">${e(kind === 'card' ? (x.org || x.name) : x.name)}</div><div class="meta">${kind === 'biz' ? `${e(x.stage)} · ${e(x.industry)} · ${U.md(x.discoveredAt)} 발굴` : kind === 'net' ? `${e(x.category)} · ${e(x.status)}` : `명함 · ${e(x.name)}`} · ${e(x.area || '')}${M.hasPos(x) ? '' : ' · 위치 없음'}</div></div>
      </div>`).join('')}</div>`).join('');
  }

  /* ================= 일정 ================= */
  function schedPage() {
    return `
      <div class="page-head">
        <div><h1 class="page-title">일정</h1><div class="page-desc">사업체 방문, 면접 동행, 기관 행사 등 업무 일정을 관리합니다.</div></div>
        <button class="btn btn-primary" type="button" data-act="new-event">+ 일정 등록</button>
      </div>
      <div class="sched">
        <section class="panel" id="evList"></section>
        <section class="panel cal-panel" id="calBox"></section>
      </div>`;
  }
  function evRow(ev) {
    const t = S.targetOf(ev);
    const d = U.dday(ev.date);
    return `<div class="ev ${ev.done ? 'done' : ''}">
      <input type="checkbox" aria-label="완료 표시" data-act="ev-toggle" data-id="${ev.id}" ${ev.done ? 'checked' : ''}>
      <div class="ev-when">${U.md(ev.date)} ${e(ev.time || '')}</div>
      <div style="min-width:0"><div class="ev-title">${e(ev.title)}</div>
        <div class="ev-target">${t ? `<span data-act="open" data-kind="${ev.targetType}" data-id="${t.id}">${e(t.name)}</span> · ` : ''}${e(ev.type)}${ev.memo ? ' · ' + e(ev.memo) : ''}</div></div>
      <div class="inline">${ev.done ? '<span class="badge success">완료</span>' : `<span class="badge ${d.tone} num">${d.label}</span>`}<button class="icon-btn" type="button" aria-label="일정 수정" data-act="edit-event" data-id="${ev.id}">${I.edit}</button></div>
    </div>`;
  }
  function evList() {
    const f = ui.sched;
    const T = U.today();
    let evs = [...S.view().events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    if (f.sel) evs = evs.filter(x => x.date === f.sel);
    const groups = f.sel ? [[U.dateKo(f.sel), evs.filter(x => f.showDone || !x.done)]] : [
      ['지난 일정 (완료 안 됨)', evs.filter(x => !x.done && x.date < T)],
      ['오늘', evs.filter(x => !x.done && x.date === T)],
      ['7일 이내', evs.filter(x => !x.done && x.date > T && U.diffDays(T, x.date) <= 7)],
      ['이후', evs.filter(x => !x.done && U.diffDays(T, x.date) > 7)],
      ...(f.showDone ? [['완료한 일정', evs.filter(x => x.done).reverse().slice(0, 30)]] : []),
    ];
    const body = groups.filter(([, l]) => l.length).map(([h, l]) => `<div class="ev-group"><h3>${e(h)} <span class="num">${l.length}</span></h3>${l.map(evRow).join('')}</div>`).join('');
    return `<div class="panel-pad" style="padding-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <h2 class="section-title">${f.sel ? e(U.dateKo(f.sel)) + ' 일정' : '다가오는 일정'}</h2>
        <div class="inline">${f.sel ? '<button class="btn btn-sm" type="button" data-act="cal-clear">전체 일정 보기</button>' : ''}<label class="check"><input type="checkbox" data-act="ev-showdone" ${f.showDone ? 'checked' : ''}>완료 포함</label></div>
      </div>${body || `<div class="empty"><strong>${f.sel ? '이 날은 일정이 없습니다' : '예정된 일정이 없습니다'}</strong>사업체 방문이나 기관 행사를 등록해 보세요.<div><button class="btn btn-primary" type="button" data-act="new-event" data-date="${f.sel || ''}">+ 일정 등록</button></div></div>`}`;
  }
  /** 달력. f: {month, sel}, pick/move: 날짜 선택·달 이동 액션 이름 */
  function calendar(f = ui.sched, pick = 'cal-pick', move = 'cal-move') {
    const [y, m] = f.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(y, m - 1, 1 - first.getDay());
    const T = U.today();
    const byDate = {};
    S.view().events.forEach(x => { (byDate[x.date] ||= []).push(x); });
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const s = U.fmt(d);
      const evs = (byDate[s] || []).filter(x => !x.done);
      cells += `<button type="button" class="cal-day ${d.getMonth() !== m - 1 ? 'out' : ''} ${s === T ? 'today' : ''} ${s === f.sel ? 'sel' : ''}" data-act="${pick}" data-date="${s}" aria-label="${U.dateKo(s)} 일정 ${evs.length}건">
        ${d.getDate()}<span class="dots">${evs.slice(0, 3).map(x => `<i class="${x.date < T ? 'late' : ''}"></i>`).join('')}</span></button>`;
    }
    return `<div class="cal"><div class="cal-head"><button class="icon-btn" type="button" data-act="${move}" data-d="-1" aria-label="이전 달">${I.back}</button><b class="num">${y}년 ${m}월</b><button class="icon-btn" type="button" data-act="${move}" data-d="1" aria-label="다음 달" style="transform:scaleX(-1)">${I.back}</button></div>
      <div class="cal-grid">${U.WD.map(w => `<div class="cal-dow">${w}</div>`).join('')}${cells}</div></div>`;
  }

  /* ================= 실적 ================= */
  /** 보기 범위 안의 직원들이 쓰는 실적 분류표 */
  function perfSets() {
    const sets = [...new Set(S.staff().map(st => S.perfSetOf(st.name)).filter(Boolean))];
    return sets.length ? sets : Object.keys(D.PERF_SETS);
  }
  function perfPage() {
    const f = ui.perf;
    const sets = perfSets();
    if (!sets.includes(f.set)) f.set = sets.includes(S.perfSetOf(S.me())) ? S.perfSetOf(S.me()) : sets[0];
    const def = D.PERF_SETS[f.set];
    return `
      <div class="page-head">
        <div><h1 class="page-title">실적</h1><div class="page-desc">실적을 입력하고, 구글 시트 '실적(기타)'에 그대로 붙여넣을 수 있게 정리합니다.${scopeNote()}</div></div>
      </div>
      <div class="toolbar perf-bar">
        <div class="month-nav"><button class="icon-btn" type="button" data-act="perf-month" data-d="-1" aria-label="이전 달">${I.back}</button><b class="num">${monthLabel(f.month)}</b><button class="icon-btn" type="button" data-act="perf-month" data-d="1" aria-label="다음 달" style="transform:scaleX(-1)">${I.back}</button></div>
        <div class="chips">${sets.map(k => `<button type="button" class="chip ${f.set === k ? 'on' : ''}" data-act="perf-set" data-set="${e(k)}">${e(k)}</button>`).join('')}</div>
      </div>
      ${f.set === GL.SET ? GL.panel(f.month, f.glMode) : ''}
      <section class="panel panel-pad perf-input">
        <h2 class="section-title">실적 입력 <span class="sub">${e(def.big)} › ${e(def.mid)}</span></h2>
        <form class="perf-form" data-form="perf-add">
          <label>사업날짜<input class="input" type="date" name="date" value="${f.month === U.today().slice(0, 7) ? U.today() : f.month + '-01'}" required></label>
          <label>세부사업명<select class="select" name="item">${def.items.map(i => `<option>${e(i)}</option>`).join('')}</select></label>
          <label>참여인원<input class="input" type="number" min="0" name="people" inputmode="numeric"></label>
          <label>참여인원(신규)<input class="input" type="number" min="0" name="newPeople" inputmode="numeric"></label>
          <label>회차<input class="input" name="round"></label>
          <label class="grow">비고<input class="input" name="note"></label>
          <button class="btn btn-primary" type="submit">추가</button>
        </form>
        <p class="sub" style="margin:8px 0 0">사업체·기관 상세 화면에서 남긴 활동 기록(방문·전화 등)은 따로 입력하지 않아도 아래 표에 날짜·세부사업별로 자동 집계됩니다.</p>
      </section>
      <div id="perfResults"></div>`;
  }
  function perfResults() {
    const f = ui.perf;
    const def = D.PERF_SETS[f.set];
    const rows = S.perfTable(f.month, f.set, f.withActs);
    const counts = def.items.map(i => [i, rows.filter(r => r.item === i).length, rows.filter(r => r.item === i).reduce((t, r) => t + (Number(r.people) || 0), 0)]);
    return `<section class="panel perf-sum">${counts.map(([i, n, p]) => `<div class="${n ? '' : 'zero'}"><span class="l">${e(i)}</span><b class="num">${n}</b><span class="sub">줄${p ? ` · ${p}명` : ''}</span></div>`).join('')}</section>
      <section class="panel">
        <div class="panel-pad perf-actions">
          <div class="inline">
            <label class="check"><input type="checkbox" data-act="perf-acts" ${f.withActs ? 'checked' : ''}>활동 기록 자동 집계 포함</label>
            <label class="check"><input type="checkbox" data-act="perf-no" ${f.withNo ? 'checked' : ''}>연번 포함해서 복사</label>
          </div>
          <div class="inline"><button class="btn btn-primary" type="button" data-act="perf-copy" ${rows.length ? '' : 'disabled'}>${I.copy}구글 시트용 복사 (${rows.length}줄)</button><button class="btn" type="button" data-act="perf-xlsx" ${rows.length ? '' : 'disabled'}>엑셀로 받기</button></div>
        </div>
        <p class="sub perf-help">구글 시트 <b>실적(기타)</b> 탭에서 새로 입력할 줄의 <b>${f.withNo ? '연번(A열)' : '사업날짜(B열)'}</b> 칸을 누르고 <kbd>Ctrl</kbd>+<kbd>V</kbd> 하세요.</p>
        ${rows.length ? `<div class="table-wrap"><table class="tbl perf-tbl">
          <thead><tr><th class="r">연번</th><th>사업날짜</th><th>대분류</th><th>중분류</th><th>세부사업명</th><th class="r">참여인원</th><th class="r">참여인원(신규)</th><th>회차</th><th>비고</th><th>출처</th><th></th></tr></thead>
          <tbody>${rows.map((r, i) => `<tr class="${r.kind}"><td class="r num">${i + 1}</td><td class="num nowrap">${r.date}</td><td class="clip" title="${e(r.big)}">${e(r.big)}</td><td>${e(r.mid)}</td><td><b>${e(r.item)}</b></td><td class="r num">${e(r.people)}</td><td class="r num">${e(r.newPeople)}</td><td>${e(r.round)}</td><td>${e(r.note)}</td>
            <td class="src"><div class="clip" title="${e(r.src)}">${r.kind === 'auto' ? '<span class="badge accent">자동</span> ' : '<span class="badge">직접</span> '}${e(r.src)}</div></td>
            <td>${r.kind === 'manual' ? `<button class="icon-btn" type="button" aria-label="삭제" data-act="perf-del" data-id="${r.id}">${I.close}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
          : `<div class="empty"><strong>${monthLabel(f.month)} 실적이 없습니다</strong>위에서 실적을 입력하거나, 사업체·기관 상세 화면에서 활동을 기록하세요.</div>`}
      </section>`;
  }
  /** 구글 시트에 붙여넣을 탭 구분 글 */
  function perfTsv() {
    const f = ui.perf;
    const clean = v => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
    return S.perfTable(f.month, f.set, f.withActs).map((r, i) => [...(f.withNo ? [i + 1] : []), r.date, r.big, r.mid, r.item, r.people, r.newPeople, r.round, r.note].map(clean).join('\t')).join('\n');
  }

  /* ================= 데이터 관리 ================= */
  /** 사용자별 메뉴 권한 { 이메일: { 메뉴: 'none'|'view'|'edit'|'full' } } */
  function permsAll() { try { return JSON.parse(S.get().settings.perms || '{}') || {}; } catch { return {}; } }
  const permOf = (email, menu) => (permsAll()[email] || {})[menu] || (menu === 'map' ? 'view' : 'full');
  function permSummary(email) {
    const p = permsAll()[email] || {};
    const diff = D.PERM_MENUS.filter(([k]) => p[k] && p[k] !== (k === 'map' ? 'view' : 'full'));
    if (!diff.length) return '전부 허용';
    const L = Object.fromEntries(D.PERM_LEVELS);
    return diff.map(([k, l]) => `${l} ${L[p[k]]}`).join(' · ');
  }
  function permPanel(email) {
    const L = D.PERM_LEVELS;
    return `<li class="acc-perm"><div class="perm-presets"><span class="sub">한 번에:</span>
        <button class="btn btn-sm" type="button" data-act="acc-preset" data-email="${e(email)}" data-preset="full">전부 허용</button>
        <button class="btn btn-sm" type="button" data-act="acc-preset" data-email="${e(email)}" data-preset="edit">삭제만 막기</button>
        <button class="btn btn-sm" type="button" data-act="acc-preset" data-email="${e(email)}" data-preset="view">보기만</button></div>
      <div class="perm-grid">${D.PERM_MENUS.map(([k, l]) => `<label class="perm-cell lv-${k === 'map' && permOf(email, k) === 'view' ? 'full' : permOf(email, k)}"><span>${l}</span><select class="select sm" data-chg="acc-perm" data-email="${e(email)}" data-menu="${k}" aria-label="${e(l)} 권한">${(k === 'map' ? L.slice(0, 2) : L).map(([v, t]) => `<option value="${v}" ${permOf(email, k) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`).join('')}</div>
      <p class="sub" style="margin:6px 0 0">숨김 = 메뉴가 안 보여요 · 보기만 = 볼 수만 있어요 · 등록·수정 = 삭제만 못 해요 · 삭제까지 = 전부. 구글 시트 서버에서도 같은 기준으로 막고, 그 사람 화면에는 1분 안에 반영돼요.</p></li>`;
  }
  /** 사용 권한 목록: 관리자·사용자 이메일을 한 줄씩 */
  function accRows() {
    const st = S.get().settings;
    const split = v => String(v || '').toLowerCase().split(/[\s,;]+/).filter(x => x.includes('@'));
    const admins = split(st.admins), members = split(st.members);
    return [...new Set([...admins, ...members])].map(email => ({ email, admin: admins.includes(email) }));
  }
  function dataPage() {
    const st = S.get();
    const admin = S.isAdmin();
    const acc = S.accessInfo();
    return `
      <div class="page-head"><div><h1 class="page-title">데이터 관리 <span class="badge outline num" title="프로그램 버전">버전 ${e(window.APP_VERSION || '개발용')}</span></h1><div class="page-desc">${S.REMOTE ? '팀 공유 모드입니다. 모든 데이터는 구글 시트에 저장되고 팀원과 함께 봅니다.' : '데이터는 지금 쓰는 브라우저에만 저장됩니다. 정기적으로 엑셀로 백업하세요.'}</div></div></div>
      ${S.REMOTE && !admin ? `<div class="notice">설정(직원 목록, 바로가기, AI 키, 엑셀로 전체 교체 등)은 <b>관리자${acc.owner ? ` (${e(acc.owner)})` : ''}</b>만 바꿀 수 있습니다. 사업체·명함·실적·명령부 등록과 수정은 그대로 할 수 있어요.<br><span class="sub">내 계정: <b>${e(acc.me || '(구글이 계정을 알려 주지 않음)')}</b> · 관리자가 되어야 한다면 이 주소를 관리자에게 알려 주세요.</span></div>` : ''}
      <div class="data-grid">
        ${S.REMOTE && admin ? `<section class="panel panel-pad staff-editor">
          <h2 class="section-title">사용 권한 <span class="sub">바꾸면 바로 저장돼요</span></h2>
          <p>지금 로그인: <b>${e(acc.me || '(구글이 계정을 알려 주지 않음)')}</b> · <span class="badge success">관리자</span></p>
          <p class="sub" style="margin:0">관리자는 설정·직원 목록·AI 키·엑셀 전체 교체·사용 권한을 바꿀 수 있고, 사용자는 등록·수정만 해요.
            <b>목록에 한 명이라도 있으면 목록에 있는 사람만</b> 들어올 수 있어요. 비어 있으면 복지관 계정 누구나 들어와요.</p>
          <ul class="acc-list">
            ${acc.owner ? `<li class="acc-owner"><span class="acc-mail">${e(acc.owner)}</span><span class="badge admin">관리자</span><span class="sub">시트 소유자 · 항상 관리자</span></li>` : ''}
            ${accRows().filter(r => r.email !== acc.owner).map(r => `<li><span class="acc-mail">${e(r.email)}${r.email === acc.me ? ' <span class="sub">(나)</span>' : ''}</span>
              <select class="select sm" data-chg="acc-role" data-email="${e(r.email)}" aria-label="${e(r.email)} 권한"><option value="admin" ${r.admin ? 'selected' : ''}>관리자</option><option value="user" ${r.admin ? '' : 'selected'}>사용자</option></select>
              ${r.admin ? '' : `<button class="btn btn-sm perm-btn ${ui.accOpen === r.email ? 'on' : ''}" type="button" data-act="acc-perm-open" data-email="${e(r.email)}">메뉴 권한 ▾</button>`}
              <button class="icon-btn" type="button" data-act="acc-del" data-email="${e(r.email)}" aria-label="${e(r.email)} 빼기" title="목록에서 빼기">${I.close}</button>
              <span class="sub perm-sum">${r.admin ? '모든 메뉴' : e(permSummary(r.email))}</span></li>
              ${!r.admin && ui.accOpen === r.email ? permPanel(r.email) : ''}`).join('')}
            ${!accRows().some(r => r.email !== acc.owner) ? '<li class="sub acc-empty">아직 추가한 사람이 없어요.</li>' : ''}
          </ul>
          <div class="acc-add"><input class="input" id="accNew" type="email" inputmode="email" autocomplete="off" placeholder="추가할 구글 계정 이메일 (예: ardim169@ardim.or.kr)" aria-label="추가할 이메일"><select class="select" id="accNewRole" aria-label="권한"><option value="user">사용자</option><option value="admin">관리자</option></select><button class="btn btn-primary" type="button" data-act="acc-add">+ 추가</button></div>
        </section>` : ''}
        <section class="panel panel-pad">
          <h2 class="section-title">현재 데이터</h2>
          <div class="stat-line"><span>사업체 <b>${st.businesses.length}</b></span><span>네트워크 <b>${st.networks.length}</b></span><span>명함 <b>${st.cards.length}</b></span><span>활동 기록 <b>${st.activities.length}</b></span><span>일정 <b>${st.events.length}</b></span></div>
          ${st.isDemo ? '<p><span class="badge warn">예시 데이터 사용 중</span> 실제 업무 전에 비우거나 엑셀로 교체하세요.</p>' : ''}
        </section>
        <section class="panel panel-pad">
          <h2 class="section-title">엑셀로 내보내기</h2>
          <p>사업체·네트워크·명함·활동기록·일정을 시트별로 담은 엑셀 파일을 받습니다. 팀원과 공유하거나 백업할 때 사용하세요. (명함 사진은 제외)</p>
          <div class="inline"><button class="btn btn-primary" type="button" data-act="xlsx-export">엑셀 내보내기</button><button class="btn" type="button" data-act="xlsx-template">빈 엑셀 양식 받기</button></div>
        </section>
        ${admin ? `
        <section class="panel panel-pad">
          <h2 class="section-title">엑셀에서 가져오기</h2>
          <p>내보내기 양식과 같은 시트·열 이름의 엑셀을 올리면 <b>현재 데이터 전체를 교체</b>합니다. 위도·경도가 비어 있으면 읍면동 중심 위치로 표시합니다.</p>
          <input type="file" id="xlsxFile" accept=".xlsx,.xls" hidden>
          <button class="btn" type="button" data-act="xlsx-import">엑셀 파일 선택</button>
        </section>
        ` : ''}
        <section class="panel panel-pad">
          <h2 class="section-title">전체 백업 (사진 포함)</h2>
          <p>명함 사진까지 모두 담긴 백업 파일(JSON)을 받거나, 백업 파일로 복원합니다.</p>
          <input type="file" id="jsonFile" accept=".json,application/json" hidden>
          <div class="inline"><button class="btn" type="button" data-act="json-export">백업 파일 받기</button>${admin ? '<button class="btn" type="button" data-act="json-import">백업에서 복원</button>' : ''}</div>
        </section>
        ${admin ? `
        <section class="panel panel-pad staff-editor">
          <h2 class="section-title">담당 직원과 소속 사업</h2>
          <p>같은 업무라도 장애인개발원·고용공단 소속을 나눠 두면 목록과 대시보드에서 구분해 볼 수 있습니다.</p>
          <div class="staff-rows" id="staffRows">${st.settings.staff.map(s => staffRow(s)).join('')}</div>
          <div class="inline"><button class="btn btn-sm" type="button" data-act="staff-add">+ 직원 추가</button><button class="btn btn-sm btn-primary" type="button" data-act="save-staff">저장</button></div>
        </section>
        ` : ''}
        ${admin ? `
        <section class="panel panel-pad">
          <h2 class="section-title">소속별 실적 분류표</h2>
          <p>활동 기록을 어느 실적표(대분류·중분류·세부사업명)로 집계할지 정합니다.</p>
          ${D.PROGRAMS.map(pr => `<div class="inline" style="width:100%"><span style="min-width:96px;font-weight:600">${e(pr.key)}</span><select class="select" data-perfmap="${e(pr.key)}" style="flex:1">${Object.keys(D.PERF_SETS).map(k => `<option ${st.settings.perfByProgram[pr.key] === k ? 'selected' : ''}>${e(k)}</option>`).join('')}<option value="" ${!st.settings.perfByProgram[pr.key] ? 'selected' : ''}>실적 집계 안 함</option></select></div>`).join('')}
          <button class="btn btn-sm" type="button" data-act="save-perfmap">저장</button>
        </section>
        ` : ''}
        <section class="panel panel-pad">
          <h2 class="section-title">이 PC를 쓰는 사람</h2>
          <p>활동 기록을 남길 때 기록한 사람으로 저장됩니다. PC마다 따로 기억합니다.</p>
          <div class="inline" style="width:100%"><select class="select" id="meSel" data-act-change="me-set">${st.settings.staff.map(s => `<option ${s.name === S.me() ? 'selected' : ''}>${e(s.name)}</option>`).join('')}</select></div>
        </section>
        ${admin ? `
        <section class="panel panel-pad staff-editor">
          <h2 class="section-title">대시보드 바로가기</h2>
          <p>취업알선 사이트, 복지관 홈페이지 등 자주 여는 사이트를 대시보드 위쪽 버튼으로 둡니다.</p>
          <div class="staff-rows" id="linkRows">${(st.settings.links || []).map(l => linkRow(l)).join('')}</div>
          <div class="inline"><button class="btn btn-sm" type="button" data-act="link-add">+ 바로가기 추가</button><button class="btn btn-sm btn-primary" type="button" data-act="save-links">저장</button></div>
        </section>
        ` : ''}
        ${admin ? `
        <section class="panel panel-pad">
          <h2 class="section-title">AI 도우미 (명함 읽기 · 기초 조사 · 요약)</h2>
          <p>Claude API 키를 넣으면 명함 사진 자동 입력, 사업체 인터넷 기초 조사, 3줄 요약을 쓸 수 있습니다. 키는 <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a>에서 발급하고, 쓴 만큼 요금이 나옵니다.</p>
          <p>${S.REMOTE ? '키는 구글 서버(스크립트 속성)에만 저장되고 팀원 브라우저에는 전달되지 않습니다.' : '키는 이 PC 브라우저에만 저장됩니다. 공용 PC라면 쓰지 마세요.'} 명함 사진과 사업체 정보가 AI 서비스로 전송되니 기관 개인정보 지침을 확인하세요.</p>
          <div class="inline" style="width:100%"><input class="input" id="aiKeyInput" type="password" autocomplete="off" placeholder="${AI.available() ? '저장됨 · 바꾸려면 새 키 입력' : 'sk-ant-...'}"><button class="btn" type="button" data-act="save-aikey">저장</button>${AI.available() ? '<button class="btn btn-ghost" type="button" data-act="clear-aikey">키 삭제</button>' : ''}</div>
          <p>${AI.available() ? '<span class="badge success">사용 중</span>' : '<span class="badge">꺼짐</span>'}</p>
        </section>
        ` : ''}
        ${admin ? `
        <section class="panel panel-pad">
          <h2 class="section-title">지도 배경</h2>
          <p>지도 오른쪽 위 버튼에서 일반 지도·위성 사진·OpenStreetMap·배경 없음 중 고를 수 있고, 고른 것은 이 PC에서 기억합니다. 한글 지명이 잘 나오는 <b>브이월드</b>를 쓰려면 <a href="https://www.vworld.kr/dev/v4api.do" target="_blank" rel="noopener">브이월드 오픈API</a>에서 무료 인증키를 받아 넣으세요. 키를 받을 때 등록하는 사이트 주소가 실제 여는 주소와 달라도 되는지는 브이월드 발급 조건을 확인하세요.</p>
          <div class="inline" style="width:100%"><input class="input" id="vworldKeyInput" value="${e(st.settings.vworldKey || '')}" placeholder="브이월드 인증키 (선택)"><button class="btn" type="button" data-act="save-vworld">저장</button></div>
          ${S.REMOTE ? `<label class="field" style="width:100%"><span>키를 받을 때 등록한 서비스 URL</span><input class="input" id="vworldDomainInput" value="${e(st.settings.vworldDomain || 'https://script.google.com')}" placeholder="https://script.google.com"></label>` : ''}
          ${st.settings.vworldKey ? '<div class="inline"><button class="btn btn-sm" type="button" data-act="vworld-test">주소 찾기 시험</button><button class="btn btn-sm" type="button" data-act="vworld-refind">등록된 곳 위치 브이월드로 다시 찾기</button></div>' : ''}
        </section>
        ` : ''}
        ${admin ? `
        <section class="panel panel-pad">
          <h2 class="section-title">화성시 대시보드 주소</h2>
          <p>지도 화면의 '화성시 대시보드' 탭에 보여줄 화성시 통합 대시보드 공유 링크입니다.</p>
          <div class="inline" style="width:100%"><input class="input" id="cityMapInput" type="url" value="${e(st.settings.cityMapUrl || '')}" placeholder="https://total.hscity.go.kr/..."><button class="btn" type="button" data-act="save-citymap">저장</button></div>
        </section>
        ` : ''}
        ${admin ? `
        <section class="panel panel-pad">
          <h2 class="section-title">처음부터 시작</h2>
          <p>예시 데이터를 지우고 빈 상태로 시작하거나, 예시 데이터를 다시 불러옵니다. 되돌릴 수 없으니 먼저 백업하세요.</p>
          <div class="inline"><button class="btn btn-danger" type="button" data-act="data-clear">모든 데이터 지우기</button><button class="btn" type="button" data-act="data-demo">예시 데이터 불러오기</button></div>
        </section>
        ` : ''}
      </div>`;
  }

  const linkRow = (l = { label: '', url: '' }) => `<div class="staff-row"><input class="input" name="linkLabel" value="${e(l.label)}" placeholder="이름 (예: 고용24)" aria-label="바로가기 이름"><input class="input" name="linkUrl" value="${e(l.url)}" placeholder="https://..." aria-label="주소"><button class="icon-btn" type="button" data-act="staff-del" aria-label="바로가기 삭제">${I.close}</button></div>`;
  const staffRow = (s = { name: '', program: '' }) => `<div class="staff-row"><input class="input" name="staffName" value="${e(s.name)}" placeholder="이름" aria-label="직원 이름"><select class="select" name="staffProg" aria-label="소속 사업"><option value="">소속 미지정</option>${D.PROGRAMS.map(p => `<option ${p.key === s.program ? 'selected' : ''}>${e(p.key)}</option>`).join('')}</select><button class="icon-btn" type="button" data-act="staff-del" aria-label="직원 삭제">${I.close}</button></div>`;

  /* ================= 상세 Drawer ================= */
  function drHead(title, badges, actions, canBack) {
    return `<div class="dr-head">
      <div class="dr-top">
        <div class="inline" style="min-width:0;flex-wrap:nowrap">${canBack ? `<button class="icon-btn" type="button" data-act="dr-back" aria-label="뒤로">${I.back}</button>` : ''}<h2 class="dr-title">${title}</h2></div>
        <button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${I.close}</button>
      </div>
      ${badges ? `<div class="dr-badges">${badges}</div>` : ''}
      ${actions ? `<div class="dr-actions">${actions}</div>` : ''}
    </div>`;
  }
  const callBtn = c => (tel(c) ? `<a class="btn btn-sm" href="tel:${e(tel(c).replace(/[^0-9+]/g, ''))}">${I.phone}${e(c.name)} 전화</a>` : '');
  const people = (kind, id) => {
    const cs = S.cardsOf(kind, id);
    return `<section class="dr-sec"><h3>담당자 명함 <span class="inline" style="gap:4px">${cs.length ? `<button class="btn btn-ghost btn-sm" type="button" data-act="cards-of" data-kind="${kind}" data-id="${id}">명함 관리에서 보기</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-act="new-card" data-link="${kind}:${id}">+ 명함 추가</button></span></h3>
      ${cs.length ? `<div class="people">${cs.map(c => `<div class="person"><div style="min-width:0"><div class="pn" data-act="open" data-kind="card" data-id="${c.id}">${e(c.name)} <span class="pm">${e([c.dept, c.title].filter(Boolean).join(' · '))}</span></div>
        <div class="pm">${[c.mobile && `휴대 ${e(c.mobile)}`, c.phone && `사무실 ${e(c.phone)}`, c.email && e(c.email)].filter(Boolean).join(' · ')}</div></div>
        <div class="inline">${tel(c) ? `<a class="icon-btn" href="tel:${e(tel(c).replace(/[^0-9+]/g, ''))}" aria-label="전화">${I.phone}</a>` : ''}${c.email ? `<a class="icon-btn" href="mailto:${e(c.email)}" aria-label="이메일">${I.mail}</a>` : ''}</div></div>`).join('')}</div>`
        : (() => { const x = S.find(kind, id); const sug = x ? S.get().cards.filter(c => !c.linkType && S.matchPlaces(c).some(m => m.x.id === id)) : []; return sug.length ? `<p class="sub" style="margin:0 0 6px">소속이 같은데 연결 안 된 명함이 있어요.</p><div class="people">${sug.map(c => `<div class="person"><div style="min-width:0"><div class="pn" data-act="open" data-kind="card" data-id="${c.id}">${e(c.name)} <span class="pm">${e(c.title || '')}</span></div><div class="pm">${e(c.org || '')}</div></div><button class="btn btn-sm btn-primary" type="button" data-act="card-link-to" data-id="${c.id}" data-kind="${kind}" data-target="${id}">🔗 연결</button></div>`).join('')}</div>` : '<p class="sub" style="margin:0">연결된 명함이 없습니다. 담당자 명함을 등록하면 여기서 바로 전화할 수 있어요.</p>'; })()}</section>`;
  };
  const eventsSec = (kind, id) => {
    const evs = S.eventsOf(kind, id).filter(x => !x.done);
    return `<section class="dr-sec"><h3>다가오는 일정 <button class="btn btn-ghost btn-sm" type="button" data-act="new-event" data-target="${kind}:${id}">+ 일정</button></h3>
      ${evs.length ? `<div class="people">${evs.map(x => `<div class="person"><div><div style="font-weight:600">${e(x.title)}</div><div class="pm">${U.dateKo(x.date)} ${e(x.time || '')} · ${e(x.type)}</div></div>
        <div class="inline"><span class="badge ${U.dday(x.date).tone} num">${U.dday(x.date).label}</span><input type="checkbox" aria-label="완료 표시" data-act="ev-toggle" data-id="${x.id}" style="width:18px;height:18px"></div></div>`).join('')}</div>` : '<p class="sub" style="margin:0">예정된 일정이 없습니다.</p>'}</section>`;
  };
  /** 활동 기록 입력 칸 아래의 실적 선택 (이 PC 사용자의 실적 분류표) */
  const perfSelect = (kind, id) => {
    const set = S.perfSetOf(S.me());
    const def = D.PERF_SETS[set];
    if (!def) return '';
    const auto = D.suggestPerf(set, { targetType: kind, type: '전화', content: '' }, S.find(kind, id));
    return `<div class="quick-perf"><span class="sub">실적</span>
      <select class="select" name="perf" aria-label="실적 세부사업"><option value="">자동${auto ? ` (${e(auto)})` : ' (실적 아님)'}</option>${def.items.map(i => `<option>${e(i)}</option>`).join('')}<option value="제외">실적 아님</option></select>
      <input class="input" type="number" min="0" name="people" placeholder="참여인원" aria-label="참여인원"></div>`;
  };
  const actsSec = (kind, id) => {
    const acts = S.actsOf(kind, id);
    return `<section class="dr-sec"><h3>활동 기록</h3>
      <form class="quick-log" data-form="quick-log" data-kind="${kind}" data-id="${id}">
        <input class="input" type="date" name="date" value="${U.today()}" aria-label="날짜" required>
        <select class="select" name="type" aria-label="유형">${opts(D.ACT_TYPES.filter(t => t !== '발굴'), '전화')}</select>
        <input class="input grow" name="content" id="quickLogContent" placeholder="예: 인사팀장 통화, 다음 주 방문 약속" aria-label="내용" required>
        <button class="btn btn-primary" type="submit">기록</button>
        <input type="hidden" name="staff" value="${e(S.me())}">
        ${perfSelect(kind, id)}
      </form>
      ${acts.length ? `<ul class="timeline">${acts.map(a => `<li><span class="d">${U.dateDot(a.date)}</span><span><span class="type">${e(a.type)}</span>${e(a.content)}${R.jobLink(a.jobUrl) ? ` <a class="btn-job-inline" href="${e(R.jobLink(a.jobUrl))}" target="_blank" rel="noopener">구인공고 · ${e(R.siteName(a.jobUrl))}</a>` : ''}${a.staff ? ` <span class="sub">· ${e(a.staff)}</span>${progBadge(S.programOf(a.staff))}` : ''}${(() => { const p = S.perfOf(a); return p ? ` <span class="perf-tag" title="${e(p.set)}">${e(p.item)}${a.people ? ` ${a.people}명` : ''}</span>` : ''; })()}</span><button class="icon-btn" type="button" aria-label="기록 삭제" data-act="act-del" data-id="${a.id}" style="width:28px;height:28px">${I.close}</button></li>`).join('')}</ul>` : '<p class="sub" style="margin:0">아직 기록이 없습니다.</p>'}</section>`;
  };
  const locSec = x => `<section class="dr-sec"><h3>위치 ${M.hasPos(x) ? `<span class="inline"><a class="btn btn-ghost btn-sm" href="${M.kakaoLink(x)}" target="_blank" rel="noopener">카카오맵</a><a class="btn btn-ghost btn-sm" href="${M.naverSearch(x)}" target="_blank" rel="noopener">네이버지도</a></span>` : ''}</h3>
    <div class="sub" style="margin-bottom:8px">${e(x.address || '주소 미입력')}${x.approx ? ' · 읍면동 중심의 대략적 위치' : ''}</div>
    ${M.hasPos(x) ? '<div class="mini-map" id="miniMap"></div>' : `<div class="nopos-bar on" style="cursor:default">📍 위치가 없어 지도에 안 나와요. <button class="btn btn-sm btn-primary" type="button" data-act="edit-loc" data-kind="${x.category !== undefined ? 'net' : 'biz'}" data-id="${x.id}">위치 지정</button></div>`}</section>`;
  /** 글 속 인터넷 주소를 누를 수 있는 링크로 */
  const linkify = t => e(t).replace(/https?:\/\/[^\s<)\]]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  const kv = pairs => `<dl class="kv">${pairs.filter(([, v]) => v !== undefined).map(([k, v]) => `<dt>${e(k)}</dt><dd>${v === '' || v == null ? '<span class="sub">-</span>' : v}</dd>`).join('')}</dl>`;

  /** 지도에서 보기 (위치가 없으면 위치 지정) */
  const mapBtn = (kind, x) => (M.hasPos(x) ? `<button class="btn btn-sm btn-map" type="button" data-act="map-show" data-kind="${kind}" data-id="${x.id}">📍 지도에서 보기</button>` : `<button class="btn btn-sm nopos-btn" type="button" data-act="edit-loc" data-kind="${kind}" data-id="${x.id}">📍 위치 지정</button>`);
  function detailBiz(b, canBack) {
    const st = D.STAGE[b.stage];
    const mand = D.mandatoryCount(b.employees);
    const la = S.lastAct('biz', b.id);
    const pc = primaryContact('biz', b.id);
    const steps = D.STAGES.filter(s => s.key !== '보류');
    return {
      html: drHead(e(b.name),
        `${stageBadge(b.stage)}<span class="badge outline">${e(b.industry || '업종 미입력')}</span><span class="badge outline">${e(b.area || '지역 미지정')}</span>${mand ? '<span class="badge navy">의무고용 대상</span>' : ''}${b.staff ? `<span class="badge outline">담당 ${e(b.staff)}</span>${progBadge(S.programOf(b.staff))}` : ''}`,
        `${callBtn(pc)}<button class="btn btn-sm" type="button" data-act="focus-log">활동 기록</button><button class="btn btn-sm" type="button" data-act="new-event" data-target="biz:${b.id}">일정 추가</button>${mapBtn('biz', b)}<button class="btn btn-sm" type="button" data-act="edit" data-kind="biz" data-id="${b.id}">${I.edit}수정</button>`, canBack) +
        `<div class="dr-body">
          <section class="dr-sec"><h3>진행 단계 <button class="btn btn-ghost btn-sm" type="button" data-act="stage-set" data-id="${b.id}" data-stage="${b.stage === '보류' ? '접촉' : '보류'}">${b.stage === '보류' ? '보류 해제' : '보류로 변경'}</button></h3>
            <div class="stepper">${steps.map(s => `<button type="button" class="step ${s.key === b.stage ? 'cur' : st.i > s.i && b.stage !== '보류' ? 'past' : ''}" style="--c:${s.color}" data-act="stage-set" data-id="${b.id}" data-stage="${s.key}" title="${e(s.desc)}">${s.key}</button>`).join('')}</div>
            ${b.stage === '보류' ? '<p class="sub" style="margin:8px 0 0">현재 보류 상태입니다. 단계를 누르면 다시 진행합니다.</p>' : ''}
          </section>
          <section class="dr-sec"><h3>진행 사업 <span class="sub">누르면 바로 바뀌어요</span></h3>
            <div class="sup-pick">${D.SUPPORT_TYPES.map(t => { const on = (b.support || []).includes(t); return `<button type="button" class="sup-opt sup-${t === '지원고용' ? 'employ' : 'training'} ${on ? 'on' : ''}" data-act="sup-toggle" data-id="${b.id}" data-type="${t}" aria-pressed="${on}"><span>${on ? '✓ ' : ''}${D.SUPPORT_LABEL[t]}</span></button>`; }).join('')}</div>
            ${S.supportOf(b).auto ? `<p class="sub" style="margin:6px 0 0">출장 명령부·활동 기록에서 <b>${e(S.supportOf(b).types.filter(t => !(b.support || []).includes(t)).join('·'))}</b> 기록을 찾아 지도에 같이 표시하고 있어요.</p>` : ''}
          </section>
          <div class="summary">
            <div><div class="l">상시근로자</div><div class="v">${b.employees ? U.num(b.employees) : '-'}<small>명</small></div></div>
            <div><div class="l">의무고용 인원</div><div class="v">${mand ? mand + '<small>명</small>' : '<small>대상 아님</small>'}</div></div>
            <div><div class="l">채용 연계</div><div class="v">${Number(b.placements) || 0}<small>명</small></div></div>
            <div><div class="l">최근 연락</div><div class="v" style="font-size:16px">${la ? U.ago(la.date) : '-'}</div></div>
          </div>
          <section class="dr-sec summary-sec"><h3>요약 ${AI.available() ? `<button class="btn btn-ghost btn-sm" type="button" data-act="ai-summary" data-id="${b.id}">${b.aiSummary ? 'AI 요약 다시 하기' : 'AI로 3줄 요약'}</button>` : ''}</h3>
            <p class="one-line">${e(bizLine(b))}</p>
            ${b.aiSummary ? `<div class="ai-box"><span class="ai-tag">AI 요약</span><div>${e(b.aiSummary)}</div></div>` : ''}
          </section>
          ${dupSec('biz', b)}
          ${b.memo ? `<div class="memo-box">${e(b.memo)}</div>` : ''}
          ${people('biz', b.id)}
          ${eventsSec('biz', b.id)}
          ${actsSec('biz', b.id)}
          <section class="dr-sec"><h3>기초 조사</h3>
            ${SV.section(b)}
            <h4 class="sub-h">인터넷 조사 메모 ${b.researchAt ? `<span class="sub">${U.dateDot(b.researchAt)} 조사</span>` : ''}</h4>
            ${b.research ? `<div class="memo-box research">${linkify(b.research)}</div>` : '<p class="sub" style="margin:0 0 8px">아직 조사 내용이 없습니다. 아래 버튼으로 인터넷 검색 결과를 확인하고 정리해 두세요.</p>'}
            <div class="inline research-actions">
              ${AI.available() ? `<button class="btn btn-sm btn-primary" type="button" data-act="ai-research" data-id="${b.id}">AI로 인터넷 조사</button>` : ''}
              <button class="btn btn-sm" type="button" data-act="edit-research" data-id="${b.id}">${b.research ? '조사 내용 고치기' : '직접 작성'}</button>
              <span class="sub">검색:</span>${SEARCH_SITES.map(([l, fn]) => `<a class="btn btn-ghost btn-sm" href="${fn(b.name + (b.area ? ' ' + b.area : ''))}" target="_blank" rel="noopener">${l}</a>`).join('')}
            </div>
          </section>
          <section class="dr-sec"><h3>채용 정보</h3>${kv([['최근 구인공고', (() => { const a = S.actsOf('biz', b.id).find(x => R.jobLink(x.jobUrl)); return a ? `<a class="btn btn-sm btn-job" href="${e(R.jobLink(a.jobUrl))}" target="_blank" rel="noopener">공고 보기 · ${e(R.siteName(a.jobUrl))}</a> <span class="sub">${U.dateDot(a.date)} 연락 기록</span>` : ''; })()], ['가능 직무', e(b.jobs)], ['근무 조건', e(b.workConditions)], ['편의시설·고려사항', e(b.accessibility)]])}</section>
          ${locSec(b)}
          <section class="dr-sec"><h3>기본 정보</h3>${kv([['사업자등록번호', e(b.bizNo)], ['대표자', e(b.ceo)], ['대표 전화', b.phone ? `<a href="tel:${e(b.phone.replace(/[^0-9+]/g, ''))}">${e(b.phone)}</a>` : ''], ['홈페이지', b.homepage ? `<a href="${e(/^https?:/.test(b.homepage) ? b.homepage : 'https://' + b.homepage)}" target="_blank" rel="noopener">${e(b.homepage)}</a>` : ''], ['주소', e(b.address)], ['발굴 경로', e(b.source)], ['발굴일', U.dateDot(b.discoveredAt)], ['실적 진행도', e(R.progressOf(b))], ['복리후생', e(b.welfare)], ['담당 직원', staffTag(b.staff)]])}</section>
          <div><button class="btn btn-ghost btn-sm" type="button" data-act="delete" data-kind="biz" data-id="${b.id}" style="color:var(--danger)">이 사업체 삭제</button></div>
        </div>`,
      after: () => miniMap(b, 'biz'),
    };
  }

  function detailNet(n, canBack) {
    const la = S.lastAct('net', n.id);
    const pc = primaryContact('net', n.id);
    return {
      html: drHead(e(n.name), `<span class="badge navy">${e(n.category)}</span>${statusBadge(n.status)}<span class="badge outline">${e(n.area || '지역 미지정')}</span>${n.staff ? `<span class="badge outline">담당 ${e(n.staff)}</span>${progBadge(S.programOf(n.staff))}` : ''}`,
        `${callBtn(pc)}<button class="btn btn-sm" type="button" data-act="focus-log">활동 기록</button><button class="btn btn-sm" type="button" data-act="new-event" data-target="net:${n.id}">일정 추가</button>${mapBtn('net', n)}<button class="btn btn-sm" type="button" data-act="edit" data-kind="net" data-id="${n.id}">${I.edit}수정</button>`, canBack) +
        `<div class="dr-body">
          <div class="summary">
            <div><div class="l">협력 시작</div><div class="v" style="font-size:16px">${n.since ? U.dateDot(n.since) : '-'}</div></div>
            <div><div class="l">최근 활동</div><div class="v" style="font-size:16px">${la ? U.ago(la.date) : '-'}</div></div>
            <div><div class="l">활동 기록</div><div class="v">${S.actsOf('net', n.id).length}<small>건</small></div></div>
            <div><div class="l">담당자 명함</div><div class="v">${S.cardsOf('net', n.id).length}<small>장</small></div></div>
          </div>
          ${dupSec('net', n)}
          ${n.memo ? `<div class="memo-box">${e(n.memo)}</div>` : ''}
          <section class="dr-sec"><h3>협력 · 홍보</h3>${kv([['협력 내용', e(n.relation)], ['홍보 방식', e(n.promo)], ['관계 상태', e(n.status)], ['담당 직원', staffTag(n.staff)]])}</section>
          ${people('net', n.id)}
          ${eventsSec('net', n.id)}
          ${actsSec('net', n.id)}
          ${locSec(n)}
          <div><button class="btn btn-ghost btn-sm" type="button" data-act="delete" data-kind="net" data-id="${n.id}" style="color:var(--danger)">이 기관 삭제</button></div>
        </div>`,
      after: () => miniMap(n, 'net'),
    };
  }

  function detailCard(c, canBack) {
    const link = S.linkOf(c);
    const copy = v => v ? `<span class="inline" style="gap:4px"><span class="num">${e(v)}</span><button class="icon-btn" type="button" style="width:30px;height:30px" aria-label="복사" data-act="copy" data-v="${e(v)}">${I.copy}</button></span>` : '';
    return {
      html: drHead(`${e(c.name)} <span class="sub" style="font-size:14px;font-weight:500">${e(c.title || '')}</span>`,
        `${c.linkType === 'biz' && link ? stageBadge(link.stage) : ''}${c.linkType === 'net' ? '<span class="badge navy">네트워크 기관</span>' : ''}${(c.tags || []).map(t => `<span class="badge outline">${e(t)}</span>`).join('')}`,
        `${tel(c) ? `<a class="btn btn-sm btn-primary" href="tel:${e(tel(c).replace(/[^0-9+]/g, ''))}">${I.phone}전화</a>` : ''}${c.mobile ? `<a class="btn btn-sm" href="sms:${e(c.mobile.replace(/[^0-9+]/g, ''))}">문자</a>` : ''}${c.email ? `<a class="btn btn-sm" href="mailto:${e(c.email)}">${I.mail}이메일</a>` : ''}<button class="btn btn-sm" type="button" data-act="vcard" data-id="${c.id}">연락처 파일(vcf)</button>${link ? mapBtn(c.linkType, link) : ''}<button class="btn btn-sm" type="button" data-act="edit" data-kind="card" data-id="${c.id}">${I.edit}수정</button>`, canBack) +
        `<div class="dr-body">
          ${c.photo ? (S.photo(c) ? `<img class="card-photo" src="${S.photo(c)}" alt="${e(c.name)} 명함 사진">` : '<div class="skel" style="height:180px"></div>') : ''}
          ${dupSec('card', c)}
          <section class="dr-sec"><h3>연락처</h3>${kv([['소속', e(c.org)], ['부서', e(c.dept)], ['휴대전화', copy(c.mobile)], ['사무실 전화', copy(c.phone)], ['이메일', copy(c.email)], ['주소', e(c.address)]])}</section>
          <section class="dr-sec"><h3>연결된 곳</h3>${link ? `<div class="people"><div class="person"><div><div class="pn" data-act="open" data-kind="${c.linkType}" data-id="${link.id}">${e(link.name)}</div><div class="pm">${c.linkType === 'biz' ? `사업체 개발 · ${e(link.stage)}` : `네트워크 · ${e(link.category)}`}</div></div><button class="btn btn-sm" type="button" data-act="open" data-kind="${c.linkType}" data-id="${link.id}">열기</button></div></div>` : `<p class="sub" style="margin:0 0 8px">연결된 사업체나 기관이 없습니다. ${S.matchPlaces(c).length ? '소속이 같은 곳이 이미 있어요. <b>🔗 연결</b>을 누르면 그곳의 담당자 명함이 되고 지도에도 같이 나와요.' : `아래 버튼을 누르면 소속(${e(c.org || c.name)})으로 새로 등록하고 연결합니다.`}</p><div class="inline">${triageButtons(c)}</div>`}</section>
          <section class="dr-sec"><h3>받은 정보</h3>${kv([['받은 날', U.dateDot(c.metAt)], ['받은 곳', e(c.metWhere)]])}</section>
          ${c.memo ? `<section class="dr-sec"><h3>메모</h3><div class="memo-box">${e(c.memo)}</div></section>` : ''}
          <div><button class="btn btn-ghost btn-sm" type="button" data-act="delete" data-kind="card" data-id="${c.id}" style="color:var(--danger)">이 명함 삭제</button></div>
        </div>`,
    };
  }

  function miniMap(x, kind) {
    const el = document.getElementById('miniMap');
    if (!el || !M.hasPos(x)) return;
    const map = M.create(el, { center: [x.lat, x.lng], zoom: x.approx ? 13 : 15, scroll: false });
    if (!map) return;
    (kind === 'biz' ? M.bizMarker(x) : M.netMarker(x)).addTo(map);
    // 주변 1.5km 이내 다른 곳도 흐리게 표시
    const st = S.get();
    [...st.businesses.map(b => ['biz', b]), ...st.networks.map(n => ['net', n])].forEach(([k, o]) => {
      if (o.id === x.id || !M.hasPos(o)) return;
      if (Math.abs(o.lat - x.lat) < .014 && Math.abs(o.lng - x.lng) < .017) {
        const m = (k === 'biz' ? M.bizMarker(o) : M.netMarker(o)).addTo(map);
        if (m.setStyle) m.setStyle({ fillOpacity: .45 }); else m.setOpacity(.5);
        m.bindTooltip(o.name);
      }
    });
  }

  return { I, ui, perfPage, perfResults, perfTsv, dashCal, monthLabel, linkRow, triagePanel, triageButtons, SEARCH_SITES, bizLine, inPeriod, inArea, areaOptions, progBadge, staffRow, dashboard, bizPage, bizResults, netPage, netResults, cardsPage, cardResults, mapPage, mapItems, mapList, routePanel, routeEnd, soloBar, accRows, schedPage, evList, calendar, dataPage, detailBiz, detailNet, detailCard, drHead, stageBadge, opts };
})();
