/* 실적 목표 달성률
   - 기준 실적: 올해(6개월) 실제 실적. 내년 목표 = 기준 × (12 ÷ 기준 개월 수) → 6개월이면 2배
   - 두 가지 세는 법
     1) 복지관 기준: 실적 건수 (실적 입력 줄 수 + 활동 기록 자동 집계 건수)
     2) 장애인개발원 기준 (중증장애인직업재활지원사업 성과 기준): 실인원(실제 인원 수)·연인원(총 횟수·출석일)
        · 실인원은 실적 입력의 '참여인원(신규)', 연인원은 '참여인원'(없으면 1건 = 1명)으로 센다
        · 사업체개발은 개발원 인원 실적이 아니라 복지관 기준으로만 본다 */
window.GL = (() => {
  const e = U.esc;
  const SET = '현장중심직업재활센터';
  // 2026년 실적(6개월). [개발원 연인원, 개발원 실인원, 복지관 건수] · null = 해당 없음
  const DEFAULT = {
    baseYear: 2026, months: 6, staffNeed: 3, staffNow: 2,
    rows: {
      '직업상담(현장중심)': [60, 60, 60],
      '직업평가': [30, 30, 30],
      '현장중심 직업훈련': [1080, 9, 120],
      '사업체개발': [null, null, 60],
      '취업알선(현장중심)': [42, 42, 42],
      '취업': [24, 24, 24],
      '취업후적응지도': [50, 25, 50],
    },
  };
  // 개발원 성과 기준에서 각 항목의 실인원·연인원이 무엇을 세는지 (규정 정리 한글 파일)
  const HOW = {
    '직업상담(현장중심)': ['상담받은 실제 인원', '상담 총 횟수'],
    '직업평가': ['평가받은 실제 인원', '평가 도구 수'],
    '현장중심 직업훈련': ['훈련 참여 실제 인원', '훈련 인원의 실제 출석일'],
    '사업체개발': ['', ''],
    '취업알선(현장중심)': ['알선 실제 인원', '알선 총 횟수'],
    '취업': ['', '취업 횟수 (근로계약서 필수)'],
    '취업후적응지도': ['적응지원 실제 인원', '적응지원 횟수'],
  };

  function goal() {
    let g = S.get().settings.perfGoal;
    if (typeof g === 'string') { try { g = JSON.parse(g); } catch { g = null; } }
    g = g && typeof g === 'object' ? g : {};
    return { ...DEFAULT, ...g, rows: { ...DEFAULT.rows, ...(g.rows || {}) } };
  }
  /** 목표 연도: 고른 달의 해. 기준 연도(올해)를 보고 있으면 내년 목표를 보여 준다 */
  // 보고 있는 달의 연도가 기본 (2026년이면 2026년 실적이 먼저). 기준 연도보다 앞이면 기준 연도
  const yearOf = (month, g) => Math.max(+month.slice(0, 4), g.baseYear);
  const factor = g => 12 / (Number(g.months) || 12);

  /** 한 해 실제 실적: 항목별 { cnt: 복지관 건수, yeon: 연인원, sil: 실인원 } (팀 전체) */
  function actual(year) {
    const rows = S.perfTable(String(year), SET, true, S.get());
    const out = {};
    D.PERF_SETS[SET].items.forEach(i => { out[i] = { cnt: 0, yeon: 0, sil: 0 }; });
    rows.forEach(r => {
      const o = out[r.item]; if (!o) return;
      const n = r.kind === 'auto' ? (r.n || 1) : 1;
      o.cnt += n;
      o.yeon += Number(r.people) || n;
      o.sil += Number(r.newPeople) || 0;
    });
    return out;
  }
  /** 올해 몇 달이 지났는지 (속도 비교용) */
  function elapsed(year) {
    const T = U.today(), y = +T.slice(0, 4);
    if (year < y) return 12;
    if (year > y) return 0;
    const m = +T.slice(5, 7), d = +T.slice(8, 10);
    return m - 1 + d / 31;
  }
  const pct = (a, t) => (t ? Math.round(a / t * 1000) / 10 : null);
  const fmt = n => Math.round(n).toLocaleString('ko-KR');

  const tone = (p, pace) => (p >= 100 ? 'done' : pace == null || p >= pace - 5 ? 'ok' : p >= pace - 20 ? 'warn' : 'low');
  /** 운영 기간 중 지난 비율(%): 기준 연도는 기준 개월 수(예: 7~12월), 그 다음 해부터는 1~12월 */
  function paceOf(year, g) {
    const T = U.today(), y = +T.slice(0, 4), mo = +T.slice(5, 7) - 1 + (+T.slice(8, 10)) / 31;
    const months = year === g.baseYear ? (Number(g.months) || 12) : 12;
    const start = 12 - months; // 시작 전 지난 달 수
    if (year < y) return 100;
    if (year > y) return 0;
    return Math.max(0, Math.min(100, Math.round((mo - start) / months * 1000) / 10));
  }
  const ALIAS = { '직업상담(현장중심)': '직업상담', '취업알선(현장중심)': '취업알선', '현장중심 직업훈련': '직업훈련', '취업후적응지도': '적응지도' };

  function panel(month, mode, pickYear) {
    const g = goal();
    const year = pickYear || yearOf(month, g);
    const isBase = year === g.baseYear;
    const f = isBase ? 1 : factor(g);
    const act = actual(year);
    const pace = paceOf(year, g);
    const monthsLeft = Math.max(0, (isBase ? (Number(g.months) || 12) : 12) * (1 - pace / 100));
    const now = Math.max(1, Number(g.staffNow) || 1), need = Number(g.staffNeed) || now;
    const items = D.PERF_SETS[SET].items;
    const tgt = (i, k) => { const v = (g.rows[i] || [])[k]; return v == null || v === '' ? null : Math.round(Number(v) * f); };
    const dev = mode === 'dev';
    // 지표: 복지관 = 건수 1개, 개발원 = 실인원·연인원 2개
    const metrics = dev ? [['sil', 1, '실인원'], ['yeon', 0, '연인원']] : [['cnt', 2, '건수']];
    const parts = items.flatMap(i => metrics.map(([k, ix]) => [act[i][k], tgt(i, ix)])).filter(([, t]) => t);
    const overall = parts.length ? Math.round(parts.reduce((a, [x, t]) => a + Math.min(1, x / t), 0) / parts.length * 1000) / 10 : 0;
    const fmtN = n => (n == null ? '-' : fmt(n));
    const perMonth = (a, t) => (t == null ? '-' : a >= t ? '달성' : monthsLeft > 0 ? `월 ${fmt(Math.ceil((t - a) / monthsLeft))}` : `${fmt(t - a)} 부족`);
    const years = [g.baseYear, g.baseYear + 1];
    // 막대그래프: 세부사업마다 막대(개발원은 실·연 두 개), 높이 = 달성률(100%까지), 가로 점선 = 오늘까지 가야 할 선
    const chart = `<div class="glc" role="img" aria-label="${year}년 세부사업별 달성률 그래프">
      <div class="glc-axis"><span>100%</span><span>50%</span><span>0</span></div>
      <div class="glc-plot">
        ${pace > 0 && pace < 100 ? `<div class="glc-pace" style="bottom:${pace}%"><span>오늘 기준 ${pace}%</span></div>` : ''}
        ${items.map(i => `<div class="glc-col">${metrics.map(([k, ix, l]) => { const t = tgt(i, ix); const p = pct(act[i][k], t); return `<div class="glc-bar-wrap" title="${e(i)} ${l}: ${fmt(act[i][k])} / ${fmtN(t)}">${p == null ? '<div class="glc-na">해당<br>없음</div>' : `<div class="glc-bar ${tone(p, pace || null)}" style="height:${Math.max(1.5, Math.min(100, p))}%"><b>${p}%</b></div>`}${dev ? `<small>${l.slice(0, 1)}</small>` : ''}</div>`; }).join('')}</div>`).join('')}
      </div>
      <div class="glc-names">${items.map(i => `<span>${e(ALIAS[i] || i)}</span>`).join('')}</div>
    </div>`;
    const row = (label, cellFn, cls = '') => `<tr class="${cls}"><th>${label}</th>${items.map(i => `<td>${cellFn(i)}</td>`).join('')}</tr>`;
    const body = metrics.map(([k, ix, l]) => `
      ${row(`${dev ? l + ' ' : ''}목표`, i => `<span class="num">${fmtN(tgt(i, ix))}</span>`, 'g-t')}
      ${row(`${dev ? l + ' ' : ''}실적`, i => `<b class="num">${tgt(i, ix) == null ? '-' : fmt(act[i][k])}</b>`)}
      ${row(`${dev ? l + ' ' : ''}달성률`, i => { const p = pct(act[i][k], tgt(i, ix)); return p == null ? '<span class="sub">해당 없음</span>' : `<span class="gl-pill ${tone(p, pace || null)}">${p}%</span>`; }, 'g-p')}
      ${row('남은 기간 필요', i => `<span class="sub">${perMonth(act[i][k], tgt(i, ix))}</span>`)}
      ${row(`1인당 목표 <small>(${now}명)</small>`, i => { const t = tgt(i, ix); return `<span class="sub num">${t == null ? '-' : fmt(t / now)}</span>`; })}`).join('<tr class="gap"><td colspan="' + (items.length + 1) + '"></td></tr>');
    const baseTbl = `<div class="gl-base">
      <h3>기준 실적 <span class="sub">${g.baseYear}년 ${g.months}개월 · 보내 주신 표 · ${isBase ? `${year}년 목표 = 이 숫자 그대로` : `${year}년 목표 = 이 숫자 × ${f % 1 ? f.toFixed(1) : f}`}</span></h3>
      <div class="table-wrap"><table class="tbl gl-htbl gl-btbl"><thead><tr><th>구분</th>${items.map(i => `<th>${e(ALIAS[i] || i)}</th>`).join('')}</tr></thead><tbody>
        <tr><th>개발원 연인원</th>${items.map(i => `<td class="num">${fmtN((g.rows[i] || [])[0])}</td>`).join('')}</tr>
        <tr><th>개발원 실인원</th>${items.map(i => `<td class="num">${fmtN((g.rows[i] || [])[1])}</td>`).join('')}</tr>
        <tr><th>복지관 건수</th>${items.map(i => `<td class="num">${fmtN((g.rows[i] || [])[2])}</td>`).join('')}</tr>
        <tr class="how"><th>개발원 세는 법</th>${items.map(i => { const h = HOW[i] || []; return `<td>${h[0] ? `<div>실: ${e(h[0])}</div>` : ''}${h[1] ? `<div>연: ${e(h[1])}</div>` : ''}${!h[0] && !h[1] ? '<span class="sub">복지관 기준만</span>' : ''}</td>`; }).join('')}</tr>
      </tbody></table></div></div>`;
    return `<section class="panel gl">
      <div class="gl-head">
        <div>
          <h2 class="section-title">📈 목표 달성률 <span class="sub">현장중심직업재활센터</span></h2>
          <div class="gl-years" role="tablist">${years.map(y => `<button type="button" role="tab" class="chip ${y === year ? 'on' : ''}" data-act="gl-year" data-year="${y}">${y}년${y === g.baseYear ? ` <small>(${g.months}개월)</small>` : ' <small>(12개월)</small>'}</button>`).join('')}</div>
          <p class="sub gl-desc">${isBase ? `${year}년은 기준 실적(${g.months}개월)을 목표로 봐요.` : `${year}년 목표 = ${g.baseYear}년 ${g.months}개월 실적 × ${f % 1 ? f.toFixed(1) : f}배.`} ${pace > 0 && pace < 100 ? `오늘은 운영 기간의 <b>${pace}%</b> 지점이에요 (그래프의 점선).` : pace === 0 ? '아직 시작 전인 기간이에요.' : ''}</p>
        </div>
        <div class="gl-overall"><span class="sub">${dev ? '개발원' : '복지관'} 기준 전체</span><b class="num">${overall}%</b></div>
      </div>
      <div class="gl-tools">
        <div class="seg" role="group" aria-label="실적 세는 법"><button type="button" class="${dev ? '' : 'on'}" data-act="gl-mode" data-mode="hall">① 복지관 기준 (건수)</button><button type="button" class="${dev ? 'on' : ''}" data-act="gl-mode" data-mode="dev">② 장애인개발원 기준 (실인원·연인원)</button></div>
        <span class="gl-staff ${now < need ? 'short' : ''}">👥 전문인력 <b>${now}</b> / ${need}명${now < need ? ` · ${need - now}명 부족 → 1인당 목표 ${Math.round(need / now * 100)}%` : ''}</span>
      </div>
      ${chart}
      <div class="table-wrap"><table class="tbl gl-htbl"><thead><tr><th>${year}년</th>${items.map(i => `<th>${e(ALIAS[i] || i)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>
      ${baseTbl}
      <p class="sub gl-note">${dev ? '개발원 기준: <b>실인원</b>은 실적 입력의 <b>참여인원(신규)</b>, <b>연인원</b>은 <b>참여인원</b>을 더해서 세요. 증빙서류(초기면접지·상담기록지·근로계약서 등)가 있어야 인정돼요.' : '복지관 기준: 실적 입력 한 줄 = 1건, 사업체·기관 활동 기록(방문·전화 등)도 자동으로 1건씩 셉니다.'} 팀 전체 실적으로 계산해요.</p>
      ${S.isAdmin() ? editor(g) : ''}
    </section>`;
  }

  function editor(g) {
    const items = D.PERF_SETS[SET].items;
    const cell = (i, k) => { const v = (g.rows[i] || [])[k]; return `<input class="input sm num" data-gl="${e(i)}" data-k="${k}" value="${v == null ? '' : v}" placeholder="-" inputmode="numeric">`; };
    return `<details class="gl-edit"><summary>기준 실적·인원 고치기 <span class="sub">(관리자)</span></summary>
      <div class="gl-edit-body">
        <div class="inline gl-edit-top">
          <label>기준 연도 <input class="input sm" id="glYear" value="${g.baseYear}" style="width:70px" inputmode="numeric"></label>
          <label>기준 개월 수 <input class="input sm" id="glMonths" value="${g.months}" style="width:50px" inputmode="numeric"></label>
          <label>전문인력 정원 <input class="input sm" id="glNeed" value="${g.staffNeed}" style="width:50px" inputmode="numeric"></label>
          <label>현재 인원 <input class="input sm" id="glNow" value="${g.staffNow}" style="width:50px" inputmode="numeric"></label>
        </div>
        <table class="tbl gl-edit-tbl"><thead><tr><th>세부사업</th><th>개발원 연인원</th><th>개발원 실인원</th><th>복지관 건수</th></tr></thead>
          <tbody>${items.map(i => `<tr><td>${e(i)}</td><td>${cell(i, 0)}</td><td>${cell(i, 1)}</td><td>${cell(i, 2)}</td></tr>`).join('')}</tbody></table>
        <p class="sub">빈칸은 "해당 없음"이에요. 목표는 이 숫자 × (12 ÷ 기준 개월 수)로 자동 계산돼요.</p>
        <button class="btn btn-primary btn-sm" type="button" data-act="gl-save">저장</button>
      </div></details>`;
  }

  function readEditor() {
    const n = id => Number(String(document.getElementById(id).value).replace(/[^0-9.]/g, '')) || 0;
    const rows = {};
    document.querySelectorAll('[data-gl]').forEach(el => {
      const i = el.dataset.gl; rows[i] = rows[i] || [null, null, null];
      const v = String(el.value).replace(/[^0-9.]/g, '');
      rows[i][+el.dataset.k] = v === '' ? null : Number(v);
    });
    return { baseYear: n('glYear') || DEFAULT.baseYear, months: n('glMonths') || 6, staffNeed: n('glNeed') || 3, staffNow: n('glNow') || 1, rows };
  }

  return { SET, DEFAULT, goal, actual, panel, readEditor, yearOf };
})();
