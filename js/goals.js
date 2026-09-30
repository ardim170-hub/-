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
  const yearOf = (month, g) => Math.max(+month.slice(0, 4), g.baseYear + 1);
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

  function bar(a, t, pace) {
    const p = pct(a, t);
    if (p == null) return '<span class="sub">해당 없음</span>';
    const tone = p >= 100 ? 'done' : pace == null || p >= pace - 5 ? 'ok' : p >= pace - 20 ? 'warn' : 'low';
    return `<div class="gl-bar ${tone}" title="${fmt(a)} / ${fmt(t)}"><i style="width:${Math.min(100, p)}%"></i>${pace != null && pace > 0 && pace < 100 ? `<u style="left:${pace}%"></u>` : ''}</div>
      <div class="gl-num"><b class="num">${p}%</b> <span class="sub num">${fmt(a)} / ${fmt(t)}</span></div>`;
  }

  function panel(month, mode) {
    const g = goal();
    const year = yearOf(month, g);
    const f = factor(g);
    const act = actual(year);
    const el = elapsed(year);
    const pace = Math.round(el / 12 * 1000) / 10;
    const left = Math.max(0, 12 - el);
    const now = Math.max(1, Number(g.staffNow) || 1), need = Number(g.staffNeed) || now;
    const items = D.PERF_SETS[SET].items;
    const tgt = (i, k) => { const v = (g.rows[i] || [])[k]; return v == null || v === '' ? null : Math.round(Number(v) * f); };
    const dev = mode === 'dev';
    // 전체 달성률: 항목별 달성률(최대 100%)의 평균
    const parts = items.flatMap(i => dev ? [[act[i].sil, tgt(i, 1)], [act[i].yeon, tgt(i, 0)]] : [[act[i].cnt, tgt(i, 2)]]).filter(([, t]) => t);
    const overall = parts.length ? Math.round(parts.reduce((s, [a, t]) => s + Math.min(1, a / t), 0) / parts.length * 1000) / 10 : 0;
    const perMonth = (a, t) => (t && left > 0 && a < t ? `월 ${fmt(Math.ceil((t - a) / left))}` : t && a >= t ? '달성' : '');
    return `<section class="panel gl">
      <div class="gl-head">
        <div>
          <h2 class="section-title">📈 ${year}년 목표 달성률 <span class="sub">현장중심직업재활센터</span></h2>
          <p class="sub gl-desc">목표 = ${g.baseYear}년 ${g.months}개월 실적 × ${f % 1 ? f.toFixed(1) : f}배 (12개월 기준). ${el > 0 && el < 12 ? `오늘은 한 해의 <b>${pace}%</b> 지점이에요 (막대의 세로선).` : el === 0 ? '아직 시작 전인 해예요. 실적이 쌓이면 여기 채워져요.' : ''}</p>
        </div>
        <div class="gl-overall"><span class="sub">${dev ? '개발원' : '복지관'} 기준 전체</span><b class="num">${overall}%</b></div>
      </div>
      <div class="gl-tools">
        <div class="seg" role="group" aria-label="실적 세는 법"><button type="button" class="${dev ? '' : 'on'}" data-act="gl-mode" data-mode="hall">① 복지관 기준 (건수)</button><button type="button" class="${dev ? 'on' : ''}" data-act="gl-mode" data-mode="dev">② 장애인개발원 기준 (실인원·연인원)</button></div>
        <span class="gl-staff ${now < need ? 'short' : ''}">👥 전문인력 <b>${now}</b> / ${need}명${now < need ? ` · ${need - now}명 부족 → 1인당 목표 ${Math.round(need / now * 100)}%` : ''}</span>
      </div>
      <div class="table-wrap"><table class="tbl gl-tbl"><thead><tr><th>세부사업</th>
        ${dev ? '<th>실인원</th><th class="r">남은 기간 필요</th><th>연인원</th><th class="r">남은 기간 필요</th>' : '<th>건수</th><th class="r">남은 기간 필요</th>'}
        <th class="r">1인당 목표<small>(${now}명)</small></th></tr></thead><tbody>
        ${items.map(i => {
          const h = HOW[i] || [];
          if (dev) {
            const ts = tgt(i, 1), ty = tgt(i, 0);
            return `<tr><td><b>${e(i)}</b>${h[0] || h[1] ? `<div class="sub gl-how">${[h[0] && `실: ${e(h[0])}`, h[1] && `연: ${e(h[1])}`].filter(Boolean).join(' · ')}</div>` : ''}</td>
              <td class="gl-cell">${ts == null ? '<span class="sub">해당 없음 (복지관 기준만)</span>' : bar(act[i].sil, ts, el ? pace : null)}</td><td class="r sub">${perMonth(act[i].sil, ts)}</td>
              <td class="gl-cell">${ty == null ? '<span class="sub">해당 없음</span>' : bar(act[i].yeon, ty, el ? pace : null)}</td><td class="r sub">${perMonth(act[i].yeon, ty)}</td>
              <td class="r sub num">${ts == null && ty == null ? '-' : [ts != null && `실 ${fmt(ts / now)}`, ty != null && `연 ${fmt(ty / now)}`].filter(Boolean).join(' · ')}</td></tr>`;
          }
          const t = tgt(i, 2);
          return `<tr><td><b>${e(i)}</b></td><td class="gl-cell">${t == null ? '<span class="sub">해당 없음</span>' : bar(act[i].cnt, t, el ? pace : null)}</td><td class="r sub">${perMonth(act[i].cnt, t)}</td><td class="r sub num">${t == null ? '-' : fmt(t / now)}</td></tr>`;
        }).join('')}
      </tbody></table></div>
      <p class="sub gl-note">${dev ? '개발원 기준: <b>실인원</b>은 실적 입력의 <b>참여인원(신규)</b>, <b>연인원</b>은 <b>참여인원</b>을 더해서 세요. 같은 사람이 여러 번 오면 두 번째부터는 신규 칸을 비우세요. 증빙서류(초기면접지·상담기록지·근로계약서 등)가 있어야 인정돼요.' : '복지관 기준: 실적 입력 한 줄 = 1건, 사업체·기관 활동 기록(방문·전화 등)도 자동으로 1건씩 셉니다.'} 팀 전체(모든 직원) 실적으로 계산해요.</p>
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
