/* 기초조사 양식: 사업체정보지 + 직무분석지 (복지관 한글 서식 항목 그대로)
   양식은 아래 정의(스키마) 하나로 입력 화면과 인쇄 화면을 함께 그린다. */
window.SV = (() => {
  const e = U.esc;
  const LV = ['상', '중', '하'];

  /* 필드: [키, 이름, 종류, 옵션]  종류: text, num, date, textarea, radio, checks */
  const BIZ = [
    { title: '사업체 현황', fields: [
      ['name', '사업체명', 'text', { from: b => b.name }], ['ceo', '대표자명', 'text', { from: b => b.ceo }], ['jobs', '적합직무', 'text', { from: b => b.jobs }],
      ['phone', '전화번호', 'text', { from: b => b.phone }], ['fax', 'FAX', 'text'], ['homepage', '홈페이지', 'text', { from: b => b.homepage }],
      ['contact', '담당자', 'text', { from: b => { const c = S.cardsOf('biz', b.id)[0]; return c ? `${c.name} ${c.title || ''} ${c.mobile || c.phone || ''}`.trim() : ''; } }],
      ['address', '소재지', 'text', { from: b => b.address, full: true }],
      ['workers', '근로자수(총)', 'num', { from: b => b.employees || '' }], ['workersM', '근로자수(남)', 'num'], ['workersF', '근로자수(여)', 'num'],
      ['bizNo', '사업장등록번호', 'text', { from: b => b.bizNo }],
    ] },
    { title: '사업체 환경', fields: [
      ['toilet', '장애인용 화장실', 'radio', { opts: ['입식', '좌식', '없음'] }],
      ['stairs', '계단·경사로', 'checks', { opts: ['계단없음(무단차)', '경사로 설치'] }],
      ['elevator', '엘리베이터', 'radio', { opts: ['있음', '없음'] }],
      ['entrance', '출입구', 'checks', { opts: ['자동문', '수동문', '문턱없음'] }],
      ['wheelchair', 'W/C(휠체어) 사용', 'radio', { opts: ['가능', '불가'] }],
      ['blind', '시각 안내', 'checks', { opts: ['점자 안내판', '음성 안내', '점자블록'] }],
      ['alarm', '경보·알림', 'checks', { opts: ['시각 경보장치(화재, 긴급)', '음향알림'] }],
      ['deaf', '의사소통 지원', 'checks', { opts: ['수어통역 가능', '문자 안내 가능'] }],
      ['space', '작업·휴식 공간', 'checks', { opts: ['조용한 작업공간', '분리공간', '시각자료 안내(작업 순서도 등)', '휴식 공간 제공'] }],
      ['facilityEtc', '편의시설 기타', 'text'],
      ['location', '작업장 위치', 'text'],
      ['clean', '청결성', 'radio', { opts: ['청결', '보통', '불결'] }], ['safety', '안전성', 'radio', { opts: ['안전', '보통', '염려'] }],
      ['noise', '소음도', 'radio', { opts: ['높음', '보통', '낮음'] }], ['temp', '온도', 'radio', { opts: ['추움', '보통', '더움'] }],
      ['light', '조명', 'radio', { opts: ['어두움', '보통', '밝음'] }], ['hazard', '위험물질 노출', 'text', { ph: '예: 없음' }],
      ['toolRisk', '작업도구 위험요소', 'text', { ph: '예: 작업도구 중 위험요소 없음' }],
      ['subway', '교통편 - 지하철', 'text'], ['bus', '교통편 - 버스', 'text'],
      ['shuttle', '통근차량', 'radio', { opts: ['유', '무'] }], ['shuttleNote', '통근차량 내용', 'text'],
      ['route', '이용자 이동시간과 경로', 'text', { full: true }],
      ['envLevel', '(전반적) 사업체 환경 정도', 'radio', { opts: ['상(높은 환경수준)', '중(보통의 환경수준)', '하(낮은 환경수준)'], full: true }],
    ] },
    { title: '장애인 고용환경', fields: [
      ['awareness', '고용주 및 동료의 장애인식 정도', 'radio', { opts: LV }], ['workEnv', '작업환경', 'radio', { opts: LV }],
      ['jobCond', '장애인 배치 직무조건', 'radio', { opts: LV }], ['accommodation', '정당한 편의제공 현황', 'textarea', { full: true }],
    ] },
    { title: '장애인 고용현황 및 복리후생', fields: [
      ['employing', '고용상태', 'radio', { opts: ['예', '아니요'] }], ['employedInfo', '고용인원/장애유형', 'text'],
      ['empForm', '고용형태', 'checks', { opts: ['정규직', '비정규직', '시간제'] }],
      ['empGroup', '고용직군', 'checks', { opts: ['관리직', '사무직', '생산직', '정규직', '서비스직', '기타'] }], ['empGroupEtc', '고용직군 기타', 'text'],
      ['dorm', '기숙사', 'radio', { opts: ['예', '아니오'] }],
      ['meal', '식사제공', 'radio', { opts: ['예', '아니오'] }], ['mealType', '식사제공 방식', 'checks', { opts: ['식당', '도시락', '식비'] }],
      ['commute', '출퇴근 지원', 'radio', { opts: ['예', '아니오'] }],
    ] },
    { title: '구인·근로 조건', fields: [
      ['hireType', '구인유형', 'checks', { opts: ['고용', '부업', '훈련'] }],
      ['hireM', '구인인원(남)', 'num'], ['hireF', '구인인원(여)', 'num'], ['hireAny', '구인인원(무관)', 'num'],
      ['curMain', '기존 직무 - 주 직무', 'text'], ['curSub', '기존 직무 - 보조 직무', 'text'], ['curTrain', '기존 직무 - 훈련필요 여부', 'text'], ['curAdjust', '기존 직무 - 직무조정 사항', 'text'],
      ['newMain', '신규 직무개발 - 주 직무', 'text'], ['newSub', '신규 직무개발 - 보조 직무', 'text'], ['newTrain', '신규 직무개발 - 훈련필요 여부', 'text'], ['newAdjust', '신규 직무개발 - 직무조정 사항', 'text'],
      ['age', '구인연령', 'text'], ['edu', '교육수준', 'text'], ['license', '학력 및 자격증', 'text', { full: true }],
      ['docs', '구비서류', 'checks', { opts: ['이력서', '자기소개서', '성적증명서', '졸업증명서', '주민등록등본'] }], ['docsEtc', '구비서류 기타', 'text'],
      ['wantType', '희망장애유형', 'text'], ['wantReason', '희망 사유', 'text'],
    ] },
    { title: '근무 여건', fields: [
      ['wType', '고용형태', 'radio', { opts: ['상용', '일용', '시간제 상용', '시간제 일용', '기타'] }], ['wTypeEtc', '고용형태 기타', 'text'],
      ['wPeriod', '고용기간', 'radio', { opts: ['정규직', '계약직', '일용직', '시간제'] }], ['probation', '수습(개월)', 'num'],
      ['hours', '근무시간', 'text', { ph: '09:00 ~ 18:00' }], ['overtime', '잔업시간', 'text', { ph: '18:00 ~ 19:00' }],
      ['shift', '교대 근무', 'radio', { opts: ['없음', '2교대', '3교대'] }], ['extraWork', '연장근로', 'text', { ph: '주 평균 ○시간 (주 ○회)' }],
      ['payType', '급여 형태', 'radio', { opts: ['월급제', '일급제'] }],
      ['payBase', '기본급(원)', 'text'], ['payAllow', '제수당(원)', 'text'], ['payTotal', '합계(원)', 'text'], ['payDays', '일급제 근무일수', 'text'],
      ['allowances', '제수당 종류', 'checks', { opts: ['야근수당', '연/월차수당', '기타수당'] }], ['allowEtc', '기타수당 내용', 'text'],
      ['bonus', '상여금(%)', 'text'], ['payday', '급여지급일', 'text'],
      ['severance', '퇴직금', 'radio', { opts: ['유', '무'] }], ['severanceNote', '퇴직금 없음 사유', 'text'],
      ['insurance', '4대보험', 'checks', { opts: ['산재보험', '고용보험', '건강보험', '국민연금'] }],
      ['hireLevel', '(전반적) 구인조건 정보', 'radio', { opts: ['상(높은 구인조건)', '중(보통의 구인조건)', '하(낮은 구인조건)'], full: true }],
    ] },
  ];

  /* 직무분석지 요구도 (①~④ 4단계) */
  const HRS = ['1시간미만', '1-2시간미만', '2-4시간미만', '4-8시간이상'];
  const NONE = '요구되지 않음';
  const REQ = [
    ['신체능력', [
      ['lift', '배근력(들기)', ['10㎏미만', '10-20㎏미만', '20-40㎏미만', '40㎏이상']],
      ['bend', '허리굽히기', HRS], ['sit', '의자앉기', HRS], ['squat', '쪼그려앉기', HRS], ['stand', '서기', HRS], ['stairs', '계단오르기', HRS], ['walk', '보행', HRS],
      ['finger', '손가락기민성', [NONE, '연필크기 물건 집기', '동전크기 물건 집기', '바늘크기 물건 집기']],
      ['eyeHand', '눈손협응', [NONE, '어느 정도 요구됨', '중요함', '매우 중요함']],
      ['twoHand', '양손협응', [NONE, '우세손만 사용', '주: 우세손 / 보: 비우세손', '양손 동시 사용']],
      ['hearing', '청력', [NONE, '보청기로 소리/신호 확인', '보청기로 일상대화 가능', '전화사용 및 일상대화 가능']],
      ['vision', '시력', [NONE, '표지판 등 큰 글씨 확인', '상품설명 같은 작은 글씨 확인', '전자부품 등 세밀한 글씨 확인']],
    ]],
    ['인지', [
      ['understand', '지식이해', [NONE, '언어지시, 모델링 후 견본 제시', '언어지시와 함께 모델링', '언어지시만으로 이해']],
      ['write', '쓰기', [NONE, '1~2단어 받아 쓰기', '3~4단어 받아 쓰기', '편지 등 작문하기']],
      ['read', '읽기', [NONE, '1~2단어 읽고 이해', '단문 읽고 이해', '설명서 등의 장문 읽고 이해']],
      ['count', '수 세기', [NONE, '1~10까지 세기', '1~100까지 세기', '100이상 세기']],
      ['math', '수리능력', [NONE, '수 세기', '덧셈·뺄셈 가능', '사칙연산 가능']],
      ['money', '금전관리기술', [NONE, '화폐종류 인지 가능', '거스름 돈 주고 받기', '금전관리 계획 및 실행']],
      ['time', '시간개념', [NONE, '시계보기 가능', '시간에 맞춰 자신이 수행할 일을 확인', '시간계획 및 배분']],
    ]],
    ['작업수행', [
      ['endure', '지속력', ['2시간 미만', '2~3시간 미만', '3~4시간 미만', '4시간 이상']],
      ['speed', '작업속도', ['느린 속도 수용 가능함', '보통의 꾸준한 작업속도가 요구됨', '종종 빠른 작업속도가 요구됨', '지속적으로 빠른 작업속도가 요구됨']],
      ['initiative', '작업주도성', [NONE, '자신의 직무를 스스로 할 수 있어야 함', '자발적으로 하는 것이 도움이 됨', '직원이 다음과제를 지시하거나 단서를 제공할 수 있음']],
      ['sequence', '업무의 순차적 수행', ['한가지 업무', '2~3가지 업무의 순차적 수행이 요구됨', '4~6가지 업무의 순차적 수행이 요구됨', '7가지 이상 업무의 순차적 수행이 요구됨']],
      ['change', '일과상의 변화', ['변화 없음', '하루에 2~3회 변화', '하루에 4~6회 변화', '하루에 7회이상 변화']],
    ]],
    ['변별력', [
      ['size', '크기변별', ['매우 낮음', '낮음', '높음', '매우 높음']], ['shape', '형태변별', ['매우 낮음', '낮음', '높음', '매우 높음']], ['color', '색변별', ['매우 낮음', '낮음', '높음', '매우 높음']],
    ]],
    ['사회성', [
      ['looks', '개인용모', ['중요하지 않음', '청결만 요구', '청결/단정한 복장', '청결/단정한 복장과 외모']],
      ['express', '표현언어', [NONE, '1단어 표현', '2~3단어 조합의 단문 표현', '정확한 문장 표현']],
      ['receive', '수용언어', [NONE, '1단어 수용', '2~3단어 조합의 단문 수용', '긴 문장 수용']],
    ]],
  ];
  const STEP_ROWS = 6, TASK_ROWS = 5;
  const METHODS = ['관찰', '면접', '설문지', '과거자료 분석결과', '체험', '기타'];

  /* ---------- 입력 칸 ---------- */
  function input([k, label, type, o = {}], v) {
    const id = 'sv_' + k;
    const val = v ?? '';
    let ctl;
    if (type === 'textarea') ctl = `<textarea class="textarea" id="${id}" name="${k}" rows="3">${e(val)}</textarea>`;
    else if (type === 'radio') ctl = `<div class="opt-row" role="radiogroup" aria-label="${e(label)}">${o.opts.map(op => `<label class="opt"><input type="radio" name="${k}" value="${e(op)}" ${val === op ? 'checked' : ''}><span>${e(op)}</span></label>`).join('')}<button type="button" class="opt-clear" data-act="sv-clear" data-name="${k}" title="선택 지우기">지우기</button></div>`;
    else if (type === 'checks') ctl = `<div class="opt-row">${o.opts.map(op => `<label class="opt"><input type="checkbox" name="${k}" value="${e(op)}" ${(val || []).includes(op) ? 'checked' : ''}><span>${e(op)}</span></label>`).join('')}</div>`;
    else ctl = `<input class="input" id="${id}" name="${k}" ${type === 'num' ? 'type="number" min="0" inputmode="numeric"' : type === 'date' ? 'type="date"' : ''} value="${e(val)}" ${o.ph ? `placeholder="${e(o.ph)}"` : ''}>`;
    const wide = o.full || type === 'radio' || type === 'checks' || type === 'textarea';
    return `<div class="field ${wide ? 'full' : ''}">${type === 'radio' || type === 'checks' ? `<span class="flabel">${e(label)}</span>` : `<label for="${id}">${e(label)}</label>`}${ctl}</div>`;
  }
  function collectFields(form, fields) {
    const out = {};
    fields.forEach(([k, , type]) => {
      if (type === 'checks') out[k] = [...form.querySelectorAll(`[name="${k}"]:checked`)].map(x => x.value);
      else if (type === 'radio') out[k] = form.querySelector(`[name="${k}"]:checked`)?.value || '';
      else out[k] = (form.elements[k]?.value || '').trim();
    });
    return out;
  }

  const head = t => `<div class="dr-head"><div class="dr-top"><div class="inline" style="flex-wrap:nowrap;min-width:0"><button class="icon-btn" type="button" data-act="dr-back" aria-label="뒤로">${V.I.back}</button><h2 class="dr-title">${t}</h2></div><button class="icon-btn" type="button" data-act="dr-close" aria-label="닫기">${V.I.close}</button></div></div>`;
  const foot = `<div class="dr-foot"><button class="btn" type="button" data-act="dr-back">취소</button><button class="btn btn-primary" type="submit" form="svForm">저장</button></div>`;

  /** 사업체정보지 입력 (처음이면 사업체 정보로 미리 채움) */
  function bizForm(b) {
    const d = b.survey || {};
    const first = !b.survey;
    const val = f => (first && f[3]?.from ? f[3].from(b) : d[f[0]]);
    return head(`사업체정보지 · ${e(b.name)}`) + `<div class="dr-body"><form class="form sv-form" id="svForm" data-form="sv-biz" data-id="${b.id}" novalidate>
      ${first ? '<div class="form-notice">사업체 정보에 이미 입력된 내용을 미리 채웠습니다. 방문해서 확인한 내용으로 고쳐 주세요.</div>' : ''}
      <div class="fsec"><div class="frow">${input(['writtenAt', '작성일', 'date'], d.writtenAt || U.today())}${input(['writer', '담당자', 'text'], d.writer || S.me())}</div></div>
      ${BIZ.map(sec => `<div class="fsec"><h3>${e(sec.title)}</h3><div class="frow">${sec.fields.map(f => input(f, val(f))).join('')}</div></div>`).join('')}
    </form></div>` + foot;
  }
  function collectBiz(form) {
    const out = collectFields(form, [['writtenAt', '', 'date'], ['writer', '', 'text'], ...BIZ.flatMap(s => s.fields)]);
    out.writtenAt ||= U.today();
    return out;
  }

  /** 직무분석지 입력 */
  function jobForm(b, j) {
    const d = j || { id: U.uid('J'), writtenAt: U.today(), writer: S.me(), manager: (() => { const c = S.cardsOf('biz', b.id)[0]; return c ? `${c.name} ${c.title || ''}`.trim() : ''; })(), req: {}, steps: [], tasks: [] };
    const reqRow = ([k, label, lv]) => `<tr><th>${e(label)}</th>${lv.map((l, i) => `<td><label class="req-opt"><input type="radio" name="req_${k}" value="${i + 1}" ${String((d.req[k] || {}).lv) === String(i + 1) ? 'checked' : ''}><span><b>${'①②③④'[i]}</b> ${e(l)}</span></label></td>`).join('')}<td><input class="input" name="reqnote_${k}" value="${e((d.req[k] || {}).note || '')}" aria-label="${e(label)} 비고"></td></tr>`;
    const row = (name, i, cols) => `<tr><td class="num">${i + 1}</td>${cols.map(c => `<td><input class="input" name="${name}_${i}_${c}" value="${e(((d[name] || [])[i] || {})[c] || '')}"></td>`).join('')}</tr>`;
    return head(`직무분석지 · ${e(b.name)}`) + `<div class="dr-body"><form class="form sv-form" id="svForm" data-form="sv-job" data-id="${b.id}" data-job="${d.id}" novalidate>
      <div class="fsec"><div class="frow">
        ${input(['jobName', '담당직무명', 'text'], d.jobName)}${input(['writtenAt', '작성일', 'date'], d.writtenAt)}
        ${input(['writer', '담당자', 'text'], d.writer)}${input(['manager', '사업주(인사담당자)', 'text'], d.manager)}
        ${input(['method', '자료수집방법', 'checks', { opts: METHODS }], d.method || [])}${input(['methodEtc', '자료수집방법 기타', 'text'], d.methodEtc)}
        ${input(['summary', '직무개요', 'textarea'], d.summary)}
      </div></div>
      ${REQ.map(([g, items]) => `<div class="fsec"><h3>${e(g)} <span class="sub">요구도 ①~④ 중 하나를 고르세요</span></h3>
        <div class="table-wrap"><table class="req-tbl"><thead><tr><th>항목</th><th>①</th><th>②</th><th>③</th><th>④</th><th>비고</th></tr></thead><tbody>${items.map(reqRow).join('')}</tbody></table></div></div>`).join('')}
      <div class="fsec"><h3>직무 수행과정</h3><div class="table-wrap"><table class="grid-tbl"><thead><tr><th>순번</th><th>세부직무</th><th>수행과업</th><th>세부과업</th><th>필요도구</th></tr></thead>
        <tbody>${Array.from({ length: STEP_ROWS }, (_, i) => row('steps', i, ['duty', 'work', 'sub', 'tools'])).join('')}</tbody></table></div></div>
      <div class="fsec"><h3>과업 분석</h3><div class="table-wrap"><table class="grid-tbl"><thead><tr><th>순번</th><th>세부과업순서</th><th>작업요구수준 (필요기능/작업량/작업속도/무게 등)</th><th>작업도구</th></tr></thead>
        <tbody>${Array.from({ length: TASK_ROWS }, (_, i) => row('tasks', i, ['order', 'level', 'tools'])).join('')}</tbody></table></div></div>
      <div class="fsec"><div class="frow">${input(['caution', '직무수행 시 유의사항 (특성, 위험요소 등)', 'textarea'], d.caution)}${input(['opinion', '종합 소견', 'textarea'], d.opinion)}</div></div>
    </form></div>` + foot;
  }
  function collectJob(form) {
    const out = collectFields(form, [['jobName', '', 'text'], ['writtenAt', '', 'date'], ['writer', '', 'text'], ['manager', '', 'text'], ['method', '', 'checks'], ['methodEtc', '', 'text'], ['summary', '', 'textarea'], ['caution', '', 'textarea'], ['opinion', '', 'textarea']]);
    out.id = form.dataset.job;
    out.req = {};
    REQ.forEach(([, items]) => items.forEach(([k]) => {
      const lv = form.querySelector(`[name="req_${k}"]:checked`)?.value || '';
      const note = (form.elements['reqnote_' + k]?.value || '').trim();
      if (lv || note) out.req[k] = { lv, note };
    }));
    const rows = (name, n, cols) => Array.from({ length: n }, (_, i) => Object.fromEntries(cols.map(c => [c, (form.elements[`${name}_${i}_${c}`]?.value || '').trim()]))).filter(r => Object.values(r).some(Boolean));
    out.steps = rows('steps', STEP_ROWS, ['duty', 'work', 'sub', 'tools']);
    out.tasks = rows('tasks', TASK_ROWS, ['order', 'level', 'tools']);
    return out;
  }

  /* ---------- 인쇄용 문서 (한글 서식처럼 표로) ---------- */
  const box = on => (on ? '■' : '□');
  function show([k, label, type, o = {}], d) {
    const v = d[k];
    if (type === 'radio') return o.opts.map(op => `${box(v === op)} ${e(op)}`).join('&nbsp;&nbsp; ');
    if (type === 'checks') return o.opts.map(op => `${box((v || []).includes(op))} ${e(op)}`).join('&nbsp;&nbsp; ');
    return e(v ?? '').replace(/\n/g, '<br>');
  }
  function bizDoc(b) {
    const d = b.survey || {};
    return `<article class="doc">
      <h1>사업체정보지</h1>
      <table class="doc-meta"><tr><th>작성일</th><td>${e(U.dateDot(d.writtenAt))}</td><th>담당자</th><td>${e(d.writer || '')} &nbsp;&nbsp;(서명/인)</td></tr></table>
      ${BIZ.map(sec => `<table class="doc-tbl"><caption>${e(sec.title)}</caption>${sec.fields.map(f => `<tr><th>${e(f[1])}</th><td>${show(f, d)}</td></tr>`).join('')}</table>`).join('')}
      <p class="doc-foot">화성시아르딤복지관 직업지원팀 · 아르딤 취업지원에서 출력</p>
    </article>`;
  }
  function jobDoc(b, j) {
    return `<article class="doc">
      <h1>직무분석지</h1>
      <table class="doc-meta"><tr><th>작성일</th><td>${e(U.dateDot(j.writtenAt))}</td><th>담당자</th><td>${e(j.writer || '')} &nbsp;&nbsp;(서명/인)</td></tr>
        <tr><th>사업체명</th><td>${e(b.name)}</td><th>사업주(인사담당자)</th><td>${e(j.manager || '')}</td></tr>
        <tr><th>자료수집방법</th><td colspan="3">${METHODS.map(m => `${box((j.method || []).includes(m))} ${m}${m === '기타' && j.methodEtc ? `(${e(j.methodEtc)})` : ''}`).join('&nbsp;&nbsp; ')}</td></tr>
        <tr><th>담당직무명</th><td colspan="3"><b>${e(j.jobName || '')}</b></td></tr>
        <tr><th>직무개요</th><td colspan="3">${e(j.summary || '').replace(/\n/g, '<br>')}</td></tr></table>
      <table class="doc-tbl req-doc"><thead><tr><th>구분</th><th>항목</th><th>①</th><th>②</th><th>③</th><th>④</th><th>비고</th></tr></thead><tbody>
        ${REQ.map(([g, items]) => items.map(([k, label, lv], i) => `<tr>${i === 0 ? `<th rowspan="${items.length}" class="grp">${g}</th>` : ''}<th>${e(label)}</th>${lv.map((l, n) => `<td class="${String((j.req?.[k] || {}).lv) === String(n + 1) ? 'on' : ''}">${e(l)}<br>${box(String((j.req?.[k] || {}).lv) === String(n + 1))}</td>`).join('')}<td>${e((j.req?.[k] || {}).note || '')}</td></tr>`).join('')).join('')}
      </tbody></table>
      <table class="doc-tbl"><caption>직무 수행과정</caption><thead><tr><th>순번</th><th>세부직무</th><th>수행과업</th><th>세부과업</th><th>필요도구</th></tr></thead><tbody>
        ${Array.from({ length: Math.max(STEP_ROWS, (j.steps || []).length) }, (_, i) => { const r = (j.steps || [])[i] || {}; return `<tr><td>${i + 1}</td><td>${e(r.duty || '')}</td><td>${e(r.work || '')}</td><td>${e(r.sub || '')}</td><td>${e(r.tools || '')}</td></tr>`; }).join('')}
      </tbody></table>
      <table class="doc-tbl"><caption>과업 분석</caption><thead><tr><th>순번</th><th>수행사진</th><th>세부과업순서</th><th>작업요구수준</th><th>작업도구</th></tr></thead><tbody>
        ${Array.from({ length: Math.max(TASK_ROWS, (j.tasks || []).length) }, (_, i) => { const r = (j.tasks || [])[i] || {}; return `<tr><td>${i + 1}</td><td class="photo-cell"></td><td>${e(r.order || '')}</td><td>${e(r.level || '')}</td><td>${e(r.tools || '')}</td></tr>`; }).join('')}
      </tbody></table>
      <table class="doc-tbl"><tr><th>직무수행 시<br>유의사항</th><td>${e(j.caution || '').replace(/\n/g, '<br>')}</td></tr><tr><th>종합 소견</th><td>${e(j.opinion || '').replace(/\n/g, '<br>')}</td></tr></table>
      <p class="doc-foot">화성시아르딤복지관 직업지원팀 · 아르딤 취업지원에서 출력</p>
    </article>`;
  }
  /** 보기 화면: 문서 + 인쇄/수정 버튼 */
  function viewer(title, doc, editAct, id, jobId) {
    return head(title) + `<div class="dr-body doc-wrap">
      <div class="inline"><button class="btn btn-primary btn-sm" type="button" data-act="sv-print">인쇄 · PDF 저장</button><button class="btn btn-sm" type="button" data-act="${editAct}" data-id="${id}" ${jobId ? `data-job="${jobId}"` : ''}>${V.I.edit}수정</button></div>
      <div id="svDoc">${doc}</div></div>`;
  }

  /** 사업체 상세 화면의 기초조사 요약 칸 */
  function section(b) {
    const js = b.jobAnalyses || [];
    const filled = d => d ? Object.values(d).filter(v => (Array.isArray(v) ? v.length : v)).length : 0;
    return `<div class="sv-list">
      <div class="sv-item"><div><b>사업체정보지</b> ${b.survey ? `<span class="sub">${U.dateDot(b.survey.writtenAt)} · ${e(b.survey.writer || '')} · ${filled(b.survey)}개 항목</span>` : '<span class="sub">아직 작성하지 않음</span>'}</div>
        <div class="inline">${b.survey ? `<button class="btn btn-sm" type="button" data-act="sv-biz-view" data-id="${b.id}">보기·인쇄</button>` : ''}<button class="btn btn-sm ${b.survey ? '' : 'btn-primary'}" type="button" data-act="sv-biz-edit" data-id="${b.id}">${b.survey ? '수정' : '작성'}</button></div></div>
      ${js.map(j => `<div class="sv-item"><div><b>직무분석지</b> ${e(j.jobName || '(직무명 없음)')} <span class="sub">${U.dateDot(j.writtenAt)} · ${e(j.writer || '')}</span></div>
        <div class="inline"><button class="btn btn-sm" type="button" data-act="sv-job-view" data-id="${b.id}" data-job="${j.id}">보기·인쇄</button><button class="btn btn-sm" type="button" data-act="sv-job-edit" data-id="${b.id}" data-job="${j.id}">수정</button><button class="icon-btn" type="button" aria-label="직무분석지 삭제" data-act="sv-job-del" data-id="${b.id}" data-job="${j.id}">${V.I.close}</button></div></div>`).join('')}
      <div class="sv-item add"><span class="sub">직무마다 한 장씩 작성합니다.</span><button class="btn btn-sm" type="button" data-act="sv-job-edit" data-id="${b.id}">+ 직무분석지 추가</button></div>
    </div>`;
  }

  return { bizForm, collectBiz, jobForm, collectJob, bizDoc, jobDoc, viewer, section };
})();
