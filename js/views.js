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
  };
  const ui = {
    biz: { stage: '전체', q: '', area: '', industry: '', mandatory: false, sort: 'recent' },
    net: { cat: '전체', q: '', status: '' },
    cards: { q: '', link: 'all', sort: 'recent' },
    map: { biz: true, net: true, stages: new Set(D.STAGES.map(s => s.key)), q: '', mode: 'ours' },
    sched: { month: U.today().slice(0, 7), sel: '', showDone: false },
  };

  const stageBadge = s => { const st = D.STAGE[s] || D.STAGE['발굴']; return `<span class="badge stage-badge" style="--c:${st.color}"><span class="dot"></span>${e(s)}</span>`; };
  const statusBadge = s => `<span class="badge ${s === '활발' ? 'success' : s === '휴면' ? '' : 'navy'}">${e(s)}</span>`;
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
    const kpi = (label, value, unit, foot, href) => `<a class="kpi" href="${href}"><div class="kpi-label">${label}</div><div class="kpi-value">${U.num(value)}<small>${unit}</small></div><div class="kpi-foot">${foot}</div></a>`;
    return `
      <div class="page-head"><div><h1 class="page-title">대시보드</h1><div class="page-desc">${U.dateKo(U.today())} · ${e(org)}</div></div></div>
      <section class="panel kpis" aria-label="주요 현황">
        ${kpi('발굴 사업체', st.total, '곳', `이번 달 신규 ${st.newThisMonth}곳`, '#/biz')}
        ${kpi('진행 중', st.active, '곳', '접촉 · 방문상담 · 채용협의', '#/biz')}
        ${kpi('채용 연계', st.placedPeople, '명', `채용연계 사업체 ${st.placedBiz}곳`, '#/biz')}
        ${kpi('네트워크 기관', st.netTotal, '곳', `활발히 협력 중 ${st.netActive}곳`, '#/network')}
        ${kpi('등록 명함', st.cardTotal, '장', `이번 달 받은 명함 ${st.cardsThisMonth}장`, '#/cards')}
      </section>
      <div class="dash-grid">
        <div class="stack">
          <section class="panel panel-pad">
            <div class="section-head"><h2 class="section-title">오늘 확인할 일</h2><a href="#/schedule" class="sub">일정 전체 보기</a></div>
            ${pr.length ? `<ul class="prio">${pr.map(p => `
              <li data-act="${p.target ? 'open' : 'go'}" data-kind="${p.target?.kind || ''}" data-id="${p.target?.id || ''}" data-href="#/schedule">
                <span class="dday">${p.kind === 'gap' ? '<span class="badge warn">연락 필요</span>' : ddayBadge(p.date)}</span>
                <span style="min-width:0"><span class="who">${e(p.name)}</span> <span class="why">· ${e(p.why)}</span></span>
                <span class="when">${p.kind === 'gap' ? '' : e(U.dateKo(p.date))}</span>
              </li>`).join('')}</ul>` : emptyState('오늘 확인할 일이 없습니다', '다가오는 일정이나 연락이 필요한 사업체가 생기면 여기에 표시됩니다.')}
          </section>
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
    const all = S.get().businesses;
    const count = k => k === '전체' ? all.length : all.filter(b => b.stage === k).length;
    const areas = [...new Set(all.map(b => b.area).filter(Boolean))].sort();
    return `
      <div class="page-head">
        <div><h1 class="page-title">사업체 개발</h1><div class="page-desc">장애인 채용 가능 사업체를 발굴하고 채용연계까지 단계별로 관리합니다.</div></div>
        <div class="inline"><a class="btn" href="#/map">지도에서 보기</a><button class="btn btn-primary" type="button" data-act="new-biz">+ 사업체 발굴 등록</button></div>
      </div>
      <div class="chips" style="margin-bottom:12px">${['전체', ...D.STAGES.map(s => s.key)].map(k => `<button type="button" class="chip ${f.stage === k ? 'on' : ''}" data-act="biz-stage" data-stage="${k}" ${k !== '전체' ? `style="--c:${D.STAGE[k].color}"` : ''}>${k !== '전체' ? '<span class="dot"></span>' : ''}${k}<span class="n">${count(k)}</span></button>`).join('')}</div>
      <div class="toolbar">
        <input class="input" id="bizQ" type="search" placeholder="사업체명, 직무, 담당자 이름·연락처" value="${e(f.q)}">
        <select class="select" id="bizArea" aria-label="지역">${opts(areas, f.area, '전체 지역')}</select>
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
    let list = S.get().businesses.filter(b => {
      if (f.stage !== '전체' && b.stage !== f.stage) return false;
      if (f.area && b.area !== f.area) return false;
      if (f.industry && b.industry !== f.industry) return false;
      if (f.mandatory && !D.mandatoryCount(b.employees)) return false;
      if (nq) {
        const hay = [b.name, b.industry, b.jobs, b.address, b.ceo, b.memo, ...S.cardsOf('biz', b.id).flatMap(c => [c.name, c.mobile, c.phone])].map(U.norm).join('|');
        if (!hay.includes(nq)) return false;
      }
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

  function bizResults() {
    const f = ui.biz;
    const rows = bizFiltered();
    const applied = [];
    if (f.q) applied.push(['q', `검색: ${f.q}`]);
    if (f.area) applied.push(['area', f.area]);
    if (f.industry) applied.push(['industry', f.industry]);
    if (f.mandatory) applied.push(['mandatory', '의무고용 대상']);
    if (f.stage !== '전체') applied.push(['stage', f.stage]);
    const chipsHtml = applied.length ? `<div class="chips" style="margin-bottom:10px">${applied.map(([k, l]) => `<button type="button" class="chip chip-applied" data-act="biz-unfilter" data-k="${k}">${e(l)} ✕</button>`).join('')}<button type="button" class="btn btn-ghost btn-sm" data-act="biz-reset">전체 초기화</button></div>` : '';
    if (!S.get().businesses.length) return `<div class="panel">${emptyState('등록된 사업체가 없습니다', '발굴한 사업체를 등록하면 지도와 대시보드에 함께 표시됩니다.', 'new-biz', '+ 사업체 발굴 등록')}</div>`;
    if (!rows.length) return chipsHtml + `<div class="panel"><div class="empty"><strong>조건에 맞는 사업체가 없습니다</strong>검색어나 필터를 바꿔 보세요.<div><button class="btn" type="button" data-act="biz-reset">필터 초기화</button></div></div></div>`;
    return chipsHtml + `<div class="panel">
      <div class="table-wrap has-mobile"><table class="tbl">
        <thead><tr><th>사업체</th><th>단계</th><th>가능 직무</th><th>담당자</th><th>최근 활동</th><th>다음 일정</th><th class="r">상시근로자</th><th class="r">채용</th></tr></thead>
        <tbody>${rows.map(({ b, la, ne, pc }) => `
          <tr data-act="open" data-kind="biz" data-id="${b.id}">
            <td><div class="name">${U.hl(b.name, f.q)}</div><div class="meta">${e(b.industry)} · ${e(b.area || '지역 미지정')}</div></td>
            <td>${stageBadge(b.stage)}</td>
            <td><div class="clip" title="${e(b.jobs)}">${e(b.jobs || '-')}</div></td>
            <td>${pc ? `<div>${e(pc.name)} <span class="meta">${e(pc.title || '')}</span></div><div class="meta num">${e(tel(pc))}</div>` : '<span class="meta">명함 없음</span>'}</td>
            <td class="nowrap">${la ? `<div class="num">${U.dateDot(la.date)}</div><div class="meta">${e(la.type)} · ${U.ago(la.date)}</div>` : '<span class="meta">-</span>'}</td>
            <td class="nowrap">${ne ? `${ddayBadge(ne.date)}<div class="meta">${e(ne.type)}</div>` : '<span class="meta">-</span>'}</td>
            <td class="r">${b.employees ? U.num(b.employees) + '명' : '-'}${D.mandatoryCount(b.employees) ? `<div class="meta">의무 ${D.mandatoryCount(b.employees)}명</div>` : ''}</td>
            <td class="r">${b.placements ? `<b>${b.placements}명</b>` : '<span class="meta">-</span>'}</td>
          </tr>`).join('')}</tbody>
      </table></div>
      <div class="mlist">${rows.map(({ b, la, ne, pc }) => `
        <div class="mrow" data-act="open" data-kind="biz" data-id="${b.id}">
          <div class="mrow-top"><span class="name">${U.hl(b.name, f.q)}</span>${stageBadge(b.stage)}</div>
          <div class="meta">${e(b.industry)} · ${e(b.area || '')}${pc ? ` · ${e(pc.name)} ${e(tel(pc))}` : ''}</div>
          <div class="meta">${la ? `최근 ${e(la.type)} ${U.ago(la.date)}` : ''}${ne ? ` · 다음 ${e(ne.type)} ${U.dday(ne.date).label}` : ''}</div>
        </div>`).join('')}</div>
      <div class="list-count num">${rows.length}곳 표시 · 전체 ${S.get().businesses.length}곳</div>
    </div>`;
  }

  /* ================= 네트워크 ================= */
  function netPage() {
    const f = ui.net;
    const all = S.get().networks;
    const count = k => k === '전체' ? all.length : all.filter(n => n.category === k).length;
    return `
      <div class="page-head">
        <div><h1 class="page-title">네트워크</h1><div class="page-desc">복지관 홍보와 협력을 위한 지역 기관을 관리합니다.</div></div>
        <div class="inline"><a class="btn" href="#/map" data-act="map-net-only">지도에서 보기</a><button class="btn btn-primary" type="button" data-act="new-net">+ 기관 등록</button></div>
      </div>
      <div class="chips" style="margin-bottom:12px">${['전체', ...D.NET_CATEGORIES].map(k => `<button type="button" class="chip ${f.cat === k ? 'on' : ''}" data-act="net-cat" data-cat="${k}">${k}<span class="n">${count(k)}</span></button>`).join('')}</div>
      <div class="toolbar">
        <input class="input" id="netQ" type="search" placeholder="기관명, 협력 내용, 담당자" value="${e(f.q)}">
        <select class="select" id="netStatus" aria-label="관계 상태">${opts(D.NET_STATUS, f.status, '전체 관계 상태')}</select>
      </div>
      <div id="netResults"></div>`;
  }
  function netResults() {
    const f = ui.net;
    const nq = U.norm(f.q);
    const all = S.get().networks;
    if (!all.length) return `<div class="panel">${emptyState('등록된 기관이 없습니다', '협력·홍보 기관을 등록하면 지도에 함께 표시됩니다.', 'new-net', '+ 기관 등록')}</div>`;
    const rows = all.filter(n => (f.cat === '전체' || n.category === f.cat) && (!f.status || n.status === f.status) &&
      (!nq || [n.name, n.relation, n.promo, n.memo, n.address, ...S.cardsOf('net', n.id).flatMap(c => [c.name, c.mobile, c.phone])].map(U.norm).join('|').includes(nq)))
      .map(n => ({ n, la: S.lastAct('net', n.id), ne: S.nextEvent('net', n.id), pc: primaryContact('net', n.id) }))
      .sort((x, y) => (y.la?.date || '').localeCompare(x.la?.date || ''));
    if (!rows.length) return `<div class="panel"><div class="empty"><strong>조건에 맞는 기관이 없습니다</strong>검색어나 분류를 바꿔 보세요.</div></div>`;
    return `<div class="panel">
      <div class="table-wrap has-mobile"><table class="tbl">
        <thead><tr><th>기관</th><th>관계</th><th>협력 내용</th><th>담당자</th><th>최근 활동</th><th>다음 일정</th></tr></thead>
        <tbody>${rows.map(({ n, la, ne, pc }) => `
          <tr data-act="open" data-kind="net" data-id="${n.id}">
            <td><div class="name">${U.hl(n.name, f.q)}</div><div class="meta">${e(n.category)} · ${e(n.area || '')}</div></td>
            <td>${statusBadge(n.status)}</td>
            <td><div class="clip" title="${e(n.relation)}">${e(n.relation || '-')}</div><div class="meta clip">홍보: ${e(n.promo || '-')}</div></td>
            <td>${pc ? `<div>${e(pc.name)} <span class="meta">${e(pc.title || '')}</span></div><div class="meta num">${e(tel(pc))}</div>` : '<span class="meta">명함 없음</span>'}</td>
            <td class="nowrap">${la ? `<div class="num">${U.dateDot(la.date)}</div><div class="meta">${e(la.type)} · ${U.ago(la.date)}</div>` : '-'}</td>
            <td class="nowrap">${ne ? `${ddayBadge(ne.date)}<div class="meta">${e(ne.type)}</div>` : '<span class="meta">-</span>'}</td>
          </tr>`).join('')}</tbody></table></div>
      <div class="mlist">${rows.map(({ n, la, pc }) => `
        <div class="mrow" data-act="open" data-kind="net" data-id="${n.id}">
          <div class="mrow-top"><span class="name">${U.hl(n.name, f.q)}</span>${statusBadge(n.status)}</div>
          <div class="meta">${e(n.category)} · ${e(n.relation || '')}</div>
          <div class="meta">${pc ? `${e(pc.name)} ${e(tel(pc))}` : ''}${la ? ` · 최근 ${U.ago(la.date)}` : ''}</div>
        </div>`).join('')}</div>
      <div class="list-count num">${rows.length}곳 표시 · 전체 ${all.length}곳</div>
    </div>`;
  }

  /* ================= 명함 ================= */
  function cardsPage() {
    const f = ui.cards;
    const all = S.get().cards;
    const cnt = k => all.filter(c => k === 'all' ? true : k === 'none' ? !c.linkType : c.linkType === k).length;
    return `
      <div class="page-head">
        <div><h1 class="page-title">명함 관리</h1><div class="page-desc">받은 명함을 사업체·기관과 연결해 두면 상세 화면에서 바로 연락할 수 있습니다.</div></div>
        <button class="btn btn-primary" type="button" data-act="new-card">+ 명함 등록</button>
      </div>
      <div class="chips" style="margin-bottom:12px">${[['all', '전체'], ['biz', '사업체 담당자'], ['net', '네트워크 기관'], ['none', '연결 안 됨']].map(([k, l]) => `<button type="button" class="chip ${f.link === k ? 'on' : ''}" data-act="card-link" data-link="${k}">${l}<span class="n">${cnt(k)}</span></button>`).join('')}</div>
      <div class="toolbar">
        <input class="input" id="cardQ" type="search" placeholder="이름, 소속, 전화번호, 이메일, 태그" value="${e(f.q)}">
        <span class="spacer"></span>
        <select class="select" id="cardSort" aria-label="정렬">
          <option value="recent" ${f.sort === 'recent' ? 'selected' : ''}>최근 받은 순</option>
          <option value="name" ${f.sort === 'name' ? 'selected' : ''}>이름순</option>
          <option value="org" ${f.sort === 'org' ? 'selected' : ''}>소속순</option>
        </select>
      </div>
      <div id="cardResults"></div>`;
  }
  function cardResults() {
    const f = ui.cards;
    const nq = U.norm(f.q);
    const all = S.get().cards;
    if (!all.length) return `<div class="panel">${emptyState('등록된 명함이 없습니다', '명함 사진과 연락처를 등록해 보세요.', 'new-card', '+ 명함 등록')}</div>`;
    const rows = all.filter(c => (f.link === 'all' || (f.link === 'none' ? !c.linkType : c.linkType === f.link)) &&
      (!nq || [c.name, c.org, c.dept, c.title, c.mobile, c.phone, c.email, (c.tags || []).join(','), c.memo].map(U.norm).join('|').includes(nq)))
      .sort({
        recent: (a, b) => (b.metAt || '').localeCompare(a.metAt || ''),
        name: (a, b) => a.name.localeCompare(b.name, 'ko'),
        org: (a, b) => (a.org || '').replace(/^\(주\)/, '').localeCompare((b.org || '').replace(/^\(주\)/, ''), 'ko'),
      }[f.sort]);
    if (!rows.length) return `<div class="panel"><div class="empty"><strong>검색 결과가 없습니다</strong>이름 일부나 전화번호 뒷자리로도 찾을 수 있어요.</div></div>`;
    return `<div class="card-grid">${rows.map(c => {
      const link = S.linkOf(c);
      return `<article class="bcard" data-act="open" data-kind="card" data-id="${c.id}" tabindex="0">
        <div class="org">${c.linkType === 'biz' ? `<span class="badge stage-badge" style="--c:${D.STAGE[link?.stage]?.color || 'var(--muted)'}"><span class="dot"></span>사업체</span>` : c.linkType === 'net' ? '<span class="badge navy">기관</span>' : ''}<span>${U.hl(c.org || '소속 미기재', f.q)}</span></div>
        <div class="pname">${U.hl(c.name, f.q)}<span class="ptitle">${e([c.dept, c.title].filter(Boolean).join(' · '))}</span></div>
        <div class="contact">
          ${c.mobile ? `<div>M ${U.hl(c.mobile, f.q)}</div>` : ''}
          ${c.phone ? `<div>T ${U.hl(c.phone, f.q)}</div>` : ''}
          ${c.email ? `<div>${e(c.email)}</div>` : ''}
        </div>
        ${c.photo ? '<span class="tagline photo-flag">사진 있음</span>' : ''}
      </article>`;
    }).join('')}</div><p class="sub num" style="margin-top:12px">${rows.length}장 표시 · 전체 ${all.length}장</p>`;
  }

  /* ================= 지도 ================= */
  function mapPage() {
    const f = ui.map;
    const st = S.get();
    const noPos = st.businesses.filter(b => !M.hasPos(b)).length + st.networks.filter(n => !M.hasPos(n)).length;
    return `
      <div class="page-head">
        <div><h1 class="page-title">화성시 지도</h1><div class="page-desc">발굴 사업체는 진행 단계별 색상 원, 네트워크 기관은 남색 마름모로 표시합니다.</div></div>
        <div class="inline"><button class="btn" type="button" data-act="new-net">+ 기관 등록</button><button class="btn btn-primary" type="button" data-act="new-biz">+ 사업체 발굴 등록</button></div>
      </div>
      <div class="chips" style="margin-bottom:12px" role="tablist">
        <button type="button" role="tab" class="chip ${f.mode === 'ours' ? 'on' : ''}" data-act="map-mode" data-mode="ours" aria-selected="${f.mode === 'ours'}">사업체·네트워크 지도</button>
        <button type="button" role="tab" class="chip ${f.mode === 'city' ? 'on' : ''}" data-act="map-mode" data-mode="city" aria-selected="${f.mode === 'city'}">화성시 대시보드</button>
      </div>
      ${f.mode === 'city' ? cityMap() : `<section class="panel map-layout">
        <div class="map-side">
          <div class="map-side-head">
            <input class="input" id="mapQ" type="search" placeholder="지도에서 이름 찾기" value="${e(f.q)}">
            <div class="chips">
              <button type="button" class="chip ${f.biz ? 'on' : ''}" data-act="map-layer" data-layer="biz">사업체 개발</button>
              <button type="button" class="chip ${f.net ? 'on' : ''}" data-act="map-layer" data-layer="net">네트워크</button>
            </div>
            <div class="map-legend">${D.STAGES.map(s => `<span><label class="check"><input type="checkbox" data-act="map-stage" data-stage="${s.key}" ${f.stages.has(s.key) ? 'checked' : ''} ${f.biz ? '' : 'disabled'}><i style="--c:${s.color}"></i>${s.key}</label></span>`).join('')}<span><i class="sq" style="--c:var(--navy)"></i>네트워크 기관</span></div>
            ${noPos ? `<div class="sub">위치가 없는 곳 ${noPos}곳은 지도에 표시되지 않습니다.</div>` : ''}
          </div>
          <div class="map-list" id="mapList"></div>
        </div>
        <div class="map-canvas"><div class="map-box" id="bigMap"></div></div>
      </section>`}`;
  }
  /** 화성시 통합 대시보드(공유 링크)를 그대로 보여준다. 사이트가 다른 곳 안에 표시되는 것을 막으면 새 창 링크를 쓴다. */
  function cityMap() {
    const url = S.get().settings.cityMapUrl || '';
    if (!url) return `<div class="panel">${emptyState('화성시 대시보드 주소가 없습니다', '데이터 관리 > 화성시 대시보드 주소에 공유 링크를 넣어 주세요.')}</div>`;
    return `<section class="panel" style="overflow:hidden">
      <div class="panel-pad" style="display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding-block:12px">
        <span class="sub">화성시 통합 대시보드 공유 화면입니다. 화면이 비어 보이면 새 창에서 여세요.</span>
        <a class="btn btn-sm" href="${e(url)}" target="_blank" rel="noopener">새 창에서 열기</a>
      </div>
      <iframe class="city-frame" src="${e(url)}" title="화성시 통합 대시보드" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allow="fullscreen; geolocation"></iframe>
    </section>`;
  }
  function mapItems() {
    const f = ui.map;
    const nq = U.norm(f.q);
    const st = S.get();
    const items = [];
    if (f.biz) st.businesses.filter(b => f.stages.has(b.stage)).forEach(b => items.push({ kind: 'biz', x: b }));
    if (f.net) st.networks.forEach(n => items.push({ kind: 'net', x: n }));
    return items.filter(({ x }) => !nq || U.norm(x.name + x.area + (x.industry || x.category)).includes(nq));
  }
  function mapList(items) {
    if (!items.length) return '<div class="empty"><strong>표시할 곳이 없습니다</strong>레이어나 단계 선택을 확인하세요.</div>';
    return items.map(({ kind, x }) => `
      <div class="map-item" data-act="map-focus" data-kind="${kind}" data-id="${x.id}">
        <span class="mk ${kind === 'net' ? 'sq' : ''}" style="--c:${kind === 'biz' ? D.STAGE[x.stage].color : 'var(--navy)'}"></span>
        <div style="min-width:0"><div class="name">${e(x.name)}</div><div class="meta">${kind === 'biz' ? `${e(x.stage)} · ${e(x.industry)}` : `${e(x.category)} · ${e(x.status)}`} · ${e(x.area || '')}${M.hasPos(x) ? '' : ' · 위치 없음'}</div></div>
      </div>`).join('');
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
    let evs = [...S.get().events].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
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
  function calendar() {
    const f = ui.sched;
    const [y, m] = f.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(y, m - 1, 1 - first.getDay());
    const T = U.today();
    const byDate = {};
    S.get().events.forEach(x => { (byDate[x.date] ||= []).push(x); });
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const s = U.fmt(d);
      const evs = (byDate[s] || []).filter(x => !x.done);
      cells += `<button type="button" class="cal-day ${d.getMonth() !== m - 1 ? 'out' : ''} ${s === T ? 'today' : ''} ${s === f.sel ? 'sel' : ''}" data-act="cal-pick" data-date="${s}" aria-label="${U.dateKo(s)} 일정 ${evs.length}건">
        ${d.getDate()}<span class="dots">${evs.slice(0, 3).map(x => `<i class="${x.date < T ? 'late' : ''}"></i>`).join('')}</span></button>`;
    }
    return `<div class="cal"><div class="cal-head"><button class="icon-btn" type="button" data-act="cal-move" data-d="-1" aria-label="이전 달">${I.back}</button><b class="num">${y}년 ${m}월</b><button class="icon-btn" type="button" data-act="cal-move" data-d="1" aria-label="다음 달" style="transform:scaleX(-1)">${I.back}</button></div>
      <div class="cal-grid">${U.WD.map(w => `<div class="cal-dow">${w}</div>`).join('')}${cells}</div></div>`;
  }

  /* ================= 데이터 관리 ================= */
  function dataPage() {
    const st = S.get();
    return `
      <div class="page-head"><div><h1 class="page-title">데이터 관리</h1><div class="page-desc">데이터는 지금 쓰는 브라우저에만 저장됩니다. 정기적으로 엑셀로 백업하세요.</div></div></div>
      <div class="data-grid">
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
        <section class="panel panel-pad">
          <h2 class="section-title">엑셀에서 가져오기</h2>
          <p>내보내기 양식과 같은 시트·열 이름의 엑셀을 올리면 <b>현재 데이터 전체를 교체</b>합니다. 위도·경도가 비어 있으면 읍면동 중심 위치로 표시합니다.</p>
          <input type="file" id="xlsxFile" accept=".xlsx,.xls" hidden>
          <button class="btn" type="button" data-act="xlsx-import">엑셀 파일 선택</button>
        </section>
        <section class="panel panel-pad">
          <h2 class="section-title">전체 백업 (사진 포함)</h2>
          <p>명함 사진까지 모두 담긴 백업 파일(JSON)을 받거나, 백업 파일로 복원합니다.</p>
          <input type="file" id="jsonFile" accept=".json,application/json" hidden>
          <div class="inline"><button class="btn" type="button" data-act="json-export">백업 파일 받기</button><button class="btn" type="button" data-act="json-import">백업에서 복원</button></div>
        </section>
        <section class="panel panel-pad">
          <h2 class="section-title">담당 직원</h2>
          <p>활동 기록과 사업체 담당자 선택에 쓰는 직원 이름입니다. 쉼표로 구분하세요.</p>
          <div class="inline" style="width:100%"><input class="input" id="staffInput" value="${e(st.settings.staff.join(', '))}"><button class="btn" type="button" data-act="save-staff">저장</button></div>
        </section>
        <section class="panel panel-pad">
          <h2 class="section-title">화성시 대시보드 주소</h2>
          <p>지도 화면의 '화성시 대시보드' 탭에 보여줄 화성시 통합 대시보드 공유 링크입니다.</p>
          <div class="inline" style="width:100%"><input class="input" id="cityMapInput" type="url" value="${e(st.settings.cityMapUrl || '')}" placeholder="https://total.hscity.go.kr/..."><button class="btn" type="button" data-act="save-citymap">저장</button></div>
        </section>
        <section class="panel panel-pad">
          <h2 class="section-title">처음부터 시작</h2>
          <p>예시 데이터를 지우고 빈 상태로 시작하거나, 예시 데이터를 다시 불러옵니다. 되돌릴 수 없으니 먼저 백업하세요.</p>
          <div class="inline"><button class="btn btn-danger" type="button" data-act="data-clear">모든 데이터 지우기</button><button class="btn" type="button" data-act="data-demo">예시 데이터 불러오기</button></div>
        </section>
      </div>`;
  }

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
    return `<section class="dr-sec"><h3>담당자 <button class="btn btn-ghost btn-sm" type="button" data-act="new-card" data-link="${kind}:${id}">+ 명함 추가</button></h3>
      ${cs.length ? `<div class="people">${cs.map(c => `<div class="person"><div style="min-width:0"><div class="pn" data-act="open" data-kind="card" data-id="${c.id}">${e(c.name)} <span class="pm">${e([c.dept, c.title].filter(Boolean).join(' · '))}</span></div>
        <div class="pm">${[c.mobile && `휴대 ${e(c.mobile)}`, c.phone && `사무실 ${e(c.phone)}`, c.email && e(c.email)].filter(Boolean).join(' · ')}</div></div>
        <div class="inline">${tel(c) ? `<a class="icon-btn" href="tel:${e(tel(c).replace(/[^0-9+]/g, ''))}" aria-label="전화">${I.phone}</a>` : ''}${c.email ? `<a class="icon-btn" href="mailto:${e(c.email)}" aria-label="이메일">${I.mail}</a>` : ''}</div></div>`).join('')}</div>`
        : '<p class="sub" style="margin:0">연결된 명함이 없습니다. 담당자 명함을 등록하면 여기서 바로 전화할 수 있어요.</p>'}</section>`;
  };
  const eventsSec = (kind, id) => {
    const evs = S.eventsOf(kind, id).filter(x => !x.done);
    return `<section class="dr-sec"><h3>다가오는 일정 <button class="btn btn-ghost btn-sm" type="button" data-act="new-event" data-target="${kind}:${id}">+ 일정</button></h3>
      ${evs.length ? `<div class="people">${evs.map(x => `<div class="person"><div><div style="font-weight:600">${e(x.title)}</div><div class="pm">${U.dateKo(x.date)} ${e(x.time || '')} · ${e(x.type)}</div></div>
        <div class="inline"><span class="badge ${U.dday(x.date).tone} num">${U.dday(x.date).label}</span><input type="checkbox" aria-label="완료 표시" data-act="ev-toggle" data-id="${x.id}" style="width:18px;height:18px"></div></div>`).join('')}</div>` : '<p class="sub" style="margin:0">예정된 일정이 없습니다.</p>'}</section>`;
  };
  const actsSec = (kind, id) => {
    const acts = S.actsOf(kind, id);
    const staff = S.get().settings.staff;
    return `<section class="dr-sec"><h3>활동 기록</h3>
      <form class="quick-log" data-form="quick-log" data-kind="${kind}" data-id="${id}">
        <input class="input" type="date" name="date" value="${U.today()}" aria-label="날짜" required>
        <select class="select" name="type" aria-label="유형">${opts(D.ACT_TYPES.filter(t => t !== '발굴'), '전화')}</select>
        <input class="input grow" name="content" id="quickLogContent" placeholder="예: 인사팀장 통화, 다음 주 방문 약속" aria-label="내용" required>
        <button class="btn btn-primary" type="submit">기록</button>
        <input type="hidden" name="staff" value="${e(staff[0] || '')}">
      </form>
      ${acts.length ? `<ul class="timeline">${acts.map(a => `<li><span class="d">${U.dateDot(a.date)}</span><span><span class="type">${e(a.type)}</span>${e(a.content)}${a.staff ? ` <span class="sub">· ${e(a.staff)}</span>` : ''}</span><button class="icon-btn" type="button" aria-label="기록 삭제" data-act="act-del" data-id="${a.id}" style="width:28px;height:28px">${I.close}</button></li>`).join('')}</ul>` : '<p class="sub" style="margin:0">아직 기록이 없습니다.</p>'}</section>`;
  };
  const locSec = x => `<section class="dr-sec"><h3>위치 ${M.hasPos(x) ? `<span class="inline"><a class="btn btn-ghost btn-sm" href="${M.kakaoLink(x)}" target="_blank" rel="noopener">카카오맵</a><a class="btn btn-ghost btn-sm" href="${M.naverSearch(x)}" target="_blank" rel="noopener">네이버지도</a></span>` : ''}</h3>
    <div class="sub" style="margin-bottom:8px">${e(x.address || '주소 미입력')}${x.approx ? ' · 읍면동 중심의 대략적 위치' : ''}</div>
    ${M.hasPos(x) ? '<div class="mini-map" id="miniMap"></div>' : '<p class="sub" style="margin:0">위치가 지정되지 않았습니다. 수정에서 지도를 클릭해 위치를 지정하세요.</p>'}</section>`;
  const kv = pairs => `<dl class="kv">${pairs.filter(([, v]) => v !== undefined).map(([k, v]) => `<dt>${e(k)}</dt><dd>${v === '' || v == null ? '<span class="sub">-</span>' : v}</dd>`).join('')}</dl>`;

  function detailBiz(b, canBack) {
    const st = D.STAGE[b.stage];
    const mand = D.mandatoryCount(b.employees);
    const la = S.lastAct('biz', b.id);
    const pc = primaryContact('biz', b.id);
    const steps = D.STAGES.filter(s => s.key !== '보류');
    return {
      html: drHead(e(b.name),
        `${stageBadge(b.stage)}<span class="badge outline">${e(b.industry || '업종 미입력')}</span><span class="badge outline">${e(b.area || '지역 미지정')}</span>${mand ? '<span class="badge navy">의무고용 대상</span>' : ''}`,
        `${callBtn(pc)}<button class="btn btn-sm" type="button" data-act="focus-log">활동 기록</button><button class="btn btn-sm" type="button" data-act="new-event" data-target="biz:${b.id}">일정 추가</button><button class="btn btn-sm" type="button" data-act="edit" data-kind="biz" data-id="${b.id}">${I.edit}수정</button>`, canBack) +
        `<div class="dr-body">
          <section class="dr-sec"><h3>진행 단계 <button class="btn btn-ghost btn-sm" type="button" data-act="stage-set" data-id="${b.id}" data-stage="${b.stage === '보류' ? '접촉' : '보류'}">${b.stage === '보류' ? '보류 해제' : '보류로 변경'}</button></h3>
            <div class="stepper">${steps.map(s => `<button type="button" class="step ${s.key === b.stage ? 'cur' : st.i > s.i && b.stage !== '보류' ? 'past' : ''}" style="--c:${s.color}" data-act="stage-set" data-id="${b.id}" data-stage="${s.key}" title="${e(s.desc)}">${s.key}</button>`).join('')}</div>
            ${b.stage === '보류' ? '<p class="sub" style="margin:8px 0 0">현재 보류 상태입니다. 단계를 누르면 다시 진행합니다.</p>' : ''}
          </section>
          <div class="summary">
            <div><div class="l">상시근로자</div><div class="v">${b.employees ? U.num(b.employees) : '-'}<small>명</small></div></div>
            <div><div class="l">의무고용 인원</div><div class="v">${mand ? mand + '<small>명</small>' : '<small>대상 아님</small>'}</div></div>
            <div><div class="l">채용 연계</div><div class="v">${Number(b.placements) || 0}<small>명</small></div></div>
            <div><div class="l">최근 연락</div><div class="v" style="font-size:16px">${la ? U.ago(la.date) : '-'}</div></div>
          </div>
          ${b.memo ? `<div class="memo-box">${e(b.memo)}</div>` : ''}
          ${people('biz', b.id)}
          ${eventsSec('biz', b.id)}
          ${actsSec('biz', b.id)}
          <section class="dr-sec"><h3>채용 정보</h3>${kv([['가능 직무', e(b.jobs)], ['근무 조건', e(b.workConditions)], ['편의시설·고려사항', e(b.accessibility)]])}</section>
          ${locSec(b)}
          <section class="dr-sec"><h3>기본 정보</h3>${kv([['사업자등록번호', e(b.bizNo)], ['대표자', e(b.ceo)], ['주소', e(b.address)], ['발굴 경로', e(b.source)], ['발굴일', U.dateDot(b.discoveredAt)], ['담당 직원', e(b.staff)]])}</section>
          <div><button class="btn btn-ghost btn-sm" type="button" data-act="delete" data-kind="biz" data-id="${b.id}" style="color:var(--danger)">이 사업체 삭제</button></div>
        </div>`,
      after: () => miniMap(b, 'biz'),
    };
  }

  function detailNet(n, canBack) {
    const la = S.lastAct('net', n.id);
    const pc = primaryContact('net', n.id);
    return {
      html: drHead(e(n.name), `<span class="badge navy">${e(n.category)}</span>${statusBadge(n.status)}<span class="badge outline">${e(n.area || '지역 미지정')}</span>`,
        `${callBtn(pc)}<button class="btn btn-sm" type="button" data-act="focus-log">활동 기록</button><button class="btn btn-sm" type="button" data-act="new-event" data-target="net:${n.id}">일정 추가</button><button class="btn btn-sm" type="button" data-act="edit" data-kind="net" data-id="${n.id}">${I.edit}수정</button>`, canBack) +
        `<div class="dr-body">
          <div class="summary">
            <div><div class="l">협력 시작</div><div class="v" style="font-size:16px">${n.since ? U.dateDot(n.since) : '-'}</div></div>
            <div><div class="l">최근 활동</div><div class="v" style="font-size:16px">${la ? U.ago(la.date) : '-'}</div></div>
            <div><div class="l">활동 기록</div><div class="v">${S.actsOf('net', n.id).length}<small>건</small></div></div>
            <div><div class="l">담당자 명함</div><div class="v">${S.cardsOf('net', n.id).length}<small>장</small></div></div>
          </div>
          ${n.memo ? `<div class="memo-box">${e(n.memo)}</div>` : ''}
          <section class="dr-sec"><h3>협력 · 홍보</h3>${kv([['협력 내용', e(n.relation)], ['홍보 방식', e(n.promo)], ['관계 상태', e(n.status)], ['담당 직원', e(n.staff)]])}</section>
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
        `${tel(c) ? `<a class="btn btn-sm btn-primary" href="tel:${e(tel(c).replace(/[^0-9+]/g, ''))}">${I.phone}전화</a>` : ''}${c.mobile ? `<a class="btn btn-sm" href="sms:${e(c.mobile.replace(/[^0-9+]/g, ''))}">문자</a>` : ''}${c.email ? `<a class="btn btn-sm" href="mailto:${e(c.email)}">${I.mail}이메일</a>` : ''}<button class="btn btn-sm" type="button" data-act="vcard" data-id="${c.id}">연락처 파일(vcf)</button><button class="btn btn-sm" type="button" data-act="edit" data-kind="card" data-id="${c.id}">${I.edit}수정</button>`, canBack) +
        `<div class="dr-body">
          ${c.photo ? `<img class="card-photo" src="${c.photo}" alt="${e(c.name)} 명함 사진">` : ''}
          <section class="dr-sec"><h3>연락처</h3>${kv([['소속', e(c.org)], ['부서', e(c.dept)], ['휴대전화', copy(c.mobile)], ['사무실 전화', copy(c.phone)], ['이메일', copy(c.email)], ['주소', e(c.address)]])}</section>
          <section class="dr-sec"><h3>연결된 곳</h3>${link ? `<div class="people"><div class="person"><div><div class="pn" data-act="open" data-kind="${c.linkType}" data-id="${link.id}">${e(link.name)}</div><div class="pm">${c.linkType === 'biz' ? `사업체 개발 · ${e(link.stage)}` : `네트워크 · ${e(link.category)}`}</div></div><button class="btn btn-sm" type="button" data-act="open" data-kind="${c.linkType}" data-id="${link.id}">열기</button></div></div>` : '<p class="sub" style="margin:0">연결된 사업체나 기관이 없습니다. 수정에서 연결할 수 있어요.</p>'}</section>
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

  return { I, ui, dashboard, bizPage, bizResults, netPage, netResults, cardsPage, cardResults, mapPage, mapItems, mapList, schedPage, evList, calendar, dataPage, detailBiz, detailNet, detailCard, drHead, stageBadge, opts };
})();
