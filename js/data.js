/* 기준 코드값과 예시 데이터 생성기. 화면 코드는 여기의 예시 데이터를 직접 참조하지 않는다. */
window.D = (() => {
  /** 화성시 읍·면·동 대략 중심 좌표 (위치 미지정 시 기본값) */
  const AREAS = [
    ['남양읍', 37.2045, 126.8205], ['봉담읍', 37.2170, 126.9470], ['우정읍', 37.0800, 126.8120],
    ['향남읍', 37.1320, 126.9150], ['매송면', 37.2640, 126.9000], ['비봉면', 37.2380, 126.8700],
    ['마도면', 37.2000, 126.7800], ['송산면', 37.2150, 126.7300], ['서신면', 37.1650, 126.7150],
    ['팔탄면', 37.1600, 126.8800], ['장안면', 37.0820, 126.8500], ['양감면', 37.0820, 126.9500],
    ['정남면', 37.1600, 126.9700], ['새솔동', 37.2230, 126.8280], ['진안동', 37.2120, 127.0300],
    ['병점1동', 37.2070, 127.0350], ['병점2동', 37.2150, 127.0420], ['반월동', 37.2310, 127.0620],
    ['기배동', 37.2250, 127.0150], ['화산동', 37.2080, 127.0080], ['동탄1동', 37.2020, 127.0740],
    ['동탄2동', 37.2100, 127.0620], ['동탄3동', 37.1950, 127.0620], ['동탄4동', 37.1780, 127.0760],
    ['동탄5동', 37.1880, 127.1000], ['동탄6동', 37.1650, 127.1030], ['동탄7동', 37.1760, 127.1150],
    ['동탄8동', 37.1500, 127.0900], ['동탄9동', 37.1630, 127.1180],
  ].map(([name, lat, lng]) => ({ name, lat, lng }));

  /** 화성특례시 4개 일반구 (2026년 2월 출범). 읍·면·동 → 구 */
  const GUS = [
    { name: '만세구', color: '#3A7D6B', areas: ['남양읍', '우정읍', '향남읍', '마도면', '송산면', '서신면', '팔탄면', '장안면', '양감면', '새솔동'] },
    { name: '효행구', color: '#8A6A2E', areas: ['봉담읍', '매송면', '비봉면', '정남면', '기배동'] },
    { name: '병점구', color: '#7A4E8C', areas: ['진안동', '병점1동', '병점2동', '반월동', '화산동'] },
    { name: '동탄구', color: '#2F5E9E', areas: ['동탄1동', '동탄2동', '동탄3동', '동탄4동', '동탄5동', '동탄6동', '동탄7동', '동탄8동', '동탄9동'] },
  ];
  const GU_OF_AREA = Object.fromEntries(GUS.flatMap(g => g.areas.map(a => [a, g.name])));
  const GU = Object.fromEntries(GUS.map(g => [g.name, g]));
  /** 도로명 주소에 행정동 대신 나오는 법정동 이름 → 가까운 행정동 */
  const LEGAL_DONG = {
    반송동: '동탄1동', 석우동: '동탄1동', 능동: '동탄3동', 솔빛: '동탄2동', 청계동: '동탄4동', 영천동: '동탄6동', 오산동: '동탄5동', 목동: '동탄7동', 산척동: '동탄8동', 장지동: '동탄9동', 송동: '동탄7동', 방교동: '동탄3동', 금곡동: '동탄8동', 신동: '동탄9동', 중동: '동탄1동',
    병점동: '병점1동', 진안동: '진안동', 기산동: '진안동', 반월동: '반월동', 황계동: '화산동', 안녕동: '화산동', 송산동: '화산동', 기안동: '기배동', 배양동: '기배동',
  };
  const guOf = area => GU_OF_AREA[area] || '';
  /** 주소 글자에서 읍·면·동을 찾아낸다. 못 찾으면 '' */
  function detectArea(address) {
    const a = String(address || '').replace(/\s+/g, ' ');
    if (!a) return '';
    const hit = AREAS.find(x => a.includes(x.name));
    if (hit) return hit.name;
    const legal = Object.keys(LEGAL_DONG).find(k => new RegExp(k + '(\\s|\\d|$|,|\\))').test(a));
    if (legal) return LEGAL_DONG[legal];
    const gu = GUS.find(g => a.includes(g.name));
    return gu ? gu.areas[0] : '';
  }
  /** 기관 이름으로 네트워크 분류 짐작 */
  function guessCategory(name) {
    const n = String(name || '');
    if (/학교|대학|학원|교육|학습관/.test(n)) return '교육기관';
    if (/병원|의원|보건|정신건강|치과|한의원/.test(n)) return '의료기관';
    if (/신문|방송|라디오|소식지|언론|미디어|매거진/.test(n)) return '언론·홍보';
    if (/봉사|후원|로타리|라이온스|재단/.test(n)) return '후원·자원봉사';
    if (/시청|구청|행정복지|주민센터|공단|고용|센터$|청$|사무소|경찰|소방/.test(n) && !/복지관|자립|주간|보호/.test(n)) return '공공기관';
    if (/협회|연합|조합|상공|협의회|단지/.test(n)) return '기업·경제단체';
    return '복지기관';
  }
  /** 대시보드 바로가기 기본값 */
  const DEFAULT_LINKS = [
    { label: '고용24', url: 'https://www.work24.go.kr' },
    { label: '워크투게더 (장애인 구인구직)', url: 'https://www.worktogether.or.kr' },
    { label: '한국장애인고용공단', url: 'https://www.kead.or.kr' },
    { label: '한국장애인개발원', url: 'https://www.koddi.or.kr' },
    { label: '화성시아르딤복지관', url: '' },
  ];
  // 실제 행정동 경계가 있으면 이름 표시 위치(경계 안쪽 중심)를 기준 좌표로 쓴다
  const BOUNDS = (window.HWASEONG && window.HWASEONG.areas) || [];
  BOUNDS.forEach(b => { const a = AREAS.find(x => x.name === b.name); if (a) { a.lat = b.c[0]; a.lng = b.c[1]; } });
  const AREA_BY_NAME = Object.fromEntries(AREAS.map(a => [a.name, a]));
  /** 좌표가 속한 읍·면·동 (경계 데이터로 판정, 화성시 밖이면 '') */
  function areaAt(lat, lng) {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return '';
    const inRing = r => { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
    const hit = BOUNDS.find(b => b.p.some(inRing));
    return hit ? hit.name : '';
  }
  const CITY_CENTER = [37.175, 126.905];
  /** 화성시 통합 대시보드 공유 링크 (지도 화면 '화성시 대시보드' 탭) */
  const CITY_DASHBOARD_URL = 'https://total.hscity.go.kr/web2/dashboard-main/shares/415bf387db01b77eb8d2f6ae700b8934';

  const STAGES = [
    { key: '발굴', color: 'var(--st-discover)', hex: '#8A94A6', desc: '채용 가능성이 있는 사업체를 찾아 기록한 단계' },
    { key: '접촉', color: 'var(--st-contact)', hex: '#6B9BEF', desc: '전화·이메일로 첫 연락을 한 단계' },
    { key: '방문상담', color: 'var(--st-visit)', hex: '#2563EB', desc: '사업체를 방문해 직무와 환경을 확인한 단계' },
    { key: '채용협의', color: 'var(--st-negotiate)', hex: '#C98A1B', desc: '직무·근무조건·채용 인원을 협의 중인 단계' },
    { key: '채용연계', color: 'var(--st-placed)', hex: '#2F7D57', desc: '장애인 근로자 채용이 이루어진 단계' },
    { key: '보류', color: 'var(--st-hold)', hex: '#B8BFCC', desc: '당장은 진행이 어려워 보류한 사업체' },
  ];
  const STAGE = Object.fromEntries(STAGES.map((s, i) => [s.key, { ...s, i }]));
  const ACTIVE_STAGES = ['접촉', '방문상담', '채용협의'];

  /** 직원 소속 사업 (같은 업무라도 지원 기관별로 실적을 나눠 본다) */
  const PROGRAMS = [
    { key: '장애인개발원', short: '개발원', color: 'var(--prog-a)' },
    { key: '고용공단', short: '공단', color: 'var(--prog-b)' },
  ];
  const PROGRAM = Object.fromEntries(PROGRAMS.map(p => [p.key, p]));

  const INDUSTRIES = {
    '전자부품 제조': { suf: ['전자', '테크', '일렉트론'], jobs: ['부품 조립 보조', '제품 검수', '포장'], acc: '작업대 높이 조절 가능, 1층 작업장' },
    '자동차부품 제조': { suf: ['정밀', '오토텍', '기공'], jobs: ['부품 검수', '자재 정리', '포장'], acc: '소음 있음, 안전교육 필수' },
    '식품 제조': { suf: ['푸드', '식품', '에프앤비'], jobs: ['식품 포장', '원료 계량 보조', '용기 세척'], acc: '위생복 착용, 보건증 필요' },
    '제과·제빵': { suf: ['베이커리', '제과'], jobs: ['제빵 보조', '포장', '매장 정리'], acc: '오전 이른 출근, 서서 하는 작업' },
    '물류·유통': { suf: ['로지스', '물류', '유통센터'], jobs: ['물품 분류', '바코드 스캔', '소형 상품 피킹'], acc: '넓은 동선, 엘리베이터 있음' },
    '도소매': { suf: ['마트', '상회', '유통'], jobs: ['상품 진열', '재고 정리', '카트 정리'], acc: '고객 응대 일부 있음' },
    '카페·외식': { suf: ['커피', '카페', '키친'], jobs: ['바리스타', '주방 보조', '홀 정리'], acc: '직무 매뉴얼 사진화 가능' },
    '세탁·환경': { suf: ['크린', '환경', '클린텍'], jobs: ['세탁물 분류', '미화', '재활용 선별'], acc: '반복 작업 위주, 동료 지원 가능' },
    '사무·서비스': { suf: ['서비스', '솔루션', '컨설팅'], jobs: ['사무 보조', '데이터 입력', '문서 스캔'], acc: '휠체어 접근 가능, 장애인 화장실 있음' },
    '요양·돌봄': { suf: ['요양원', '케어', '실버센터'], jobs: ['환경 정리', '배식 보조', '세탁'], acc: '근무 시간 조정 가능' },
    '농업·스마트팜': { suf: ['농원', '팜', '영농조합'], jobs: ['수확 보조', '선별·포장', '모종 관리'], acc: '야외 작업 포함, 통근 차량 운영' },
    '숙박·호텔': { suf: ['호텔', '리조트'], jobs: ['객실 정비', '린넨 관리', '주방 보조'], acc: '교대 근무 없음(주간 고정)' },
  };
  const INDUSTRY_LIST = Object.keys(INDUSTRIES);

  const SOURCES = ['현장 발굴', '구인 공고', '네트워크 소개', '고용센터 의뢰', '기존 사업체 추천', '박람회·행사'];
  const NET_CATEGORIES = ['공공기관', '복지기관', '교육기관', '기업·경제단체', '언론·홍보', '후원·자원봉사', '의료기관'];
  const NET_STATUS = ['활발', '보통', '휴면'];
  const ACT_TYPES = ['발굴', '전화', '방문', '이메일', '미팅', '행사', '채용연계', '홍보', '기타'];
  const EVENT_TYPES = ['방문', '전화', '미팅', '면접 동행', '행사', '홍보', '기타'];

  /** 장애인고용촉진법: 상시근로자 50인 이상 민간 사업주 의무고용률 3.1% (소수점 이하 버림) */
  const MANDATORY = { threshold: 50, rate: 0.031 };
  const mandatoryCount = emp => (Number(emp) >= MANDATORY.threshold ? Math.floor(Number(emp) * MANDATORY.rate) : 0);

  /* ---------------- 예시 데이터 ---------------- */
  function demo(seed = 20260929) {
    let s = seed;
    const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = a => a[Math.floor(rnd() * a.length)];
    const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const T = U.today();
    const d4 = () => String(int(1000, 9999));

    const SUR = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '유', '홍'];
    const GIV = ['민준', '서연', '지훈', '하은', '도윤', '수빈', '현우', '지아', '준호', '예린', '성민', '유진', '태희', '동현', '수아', '재원', '미정', '영수', '혜진', '상훈', '경아', '은비', '진우', '나래'];
    const person = () => pick(SUR) + pick(GIV);
    const STAFF_LIST = [{ name: '김정배', program: '장애인개발원' }, { name: '이수정', program: '장애인개발원' }, { name: '박현우', program: '장애인개발원' }, { name: '최유나', program: '고용공단' }];
    const STAFF = STAFF_LIST.map(s => s.name);
    const PRE = ['동탄', '향남', '봉담', '남양', '송산', '우정', '서해', '제부', '비봉', '정남', '팔탄', '매송', '마도', '새솔', '병점', '기안', '청명', '한울', '늘푸른', '새빛', '다온', '도담', '가온', '라온', '해솔', '온누리', '푸른들', '한결', '누리', '바른'];
    const used = new Set();
    const coName = ind => {
      for (let k = 0; k < 50; k++) {
        const n = pick(PRE) + pick(INDUSTRIES[ind].suf);
        if (!used.has(n)) { used.add(n); return (rnd() < .35 ? '(주)' : '') + n; }
      }
      return pick(PRE) + pick(INDUSTRIES[ind].suf) + int(2, 9);
    };
    const place = () => {
      const a = pick(AREAS);
      // 실제 경계 안에 들어오는 점을 고른다 (경계 데이터가 없으면 중심 근처)
      let lat = a.lat, lng = a.lng;
      for (let t = 0; t < 30; t++) {
        const la = +(a.lat + (rnd() - .5) * .03).toFixed(5), ln = +(a.lng + (rnd() - .5) * .03).toFixed(5);
        if (!BOUNDS.length || areaAt(la, ln) === a.name) { lat = la; lng = ln; break; }
      }
      return { area: a.name, lat, lng, address: `경기도 화성시 ${a.name} ${pick(['산단로', '공단로', '중앙로', '시청로', '삼성로', '효행로', '상신하길로', '남양로'])} ${int(10, 480)}` };
    };

    const businesses = [], networks = [], cards = [], activities = [], events = [];
    let cardN = 0, actN = 0, evN = 0;
    const addCard = (o) => { cards.push({ id: 'C' + String(++cardN).padStart(3, '0'), tags: [], photo: null, memo: '', ...o }); };
    const addAct = (o) => activities.push({ id: 'A' + String(++actN).padStart(4, '0'), ...o });
    const addEv = (o) => events.push({ id: 'E' + String(++evN).padStart(3, '0'), done: false, memo: '', time: '', ...o });

    const stagePlan = [['발굴', 10], ['접촉', 9], ['방문상담', 7], ['채용협의', 5], ['채용연계', 8], ['보류', 4]];
    let bN = 0;
    for (const [stage, count] of stagePlan) {
      for (let k = 0; k < count; k++) {
        const industry = pick(INDUSTRY_LIST);
        const info = INDUSTRIES[industry];
        const p = place();
        const id = 'B' + String(++bN).padStart(3, '0');
        const emp = rnd() < .3 ? int(52, 320) : int(6, 48);
        const si = STAGE[stage].i;
        const staff = pick(STAFF);
        // 발굴일: 단계가 진행될수록 더 오래전
        const discoveredAt = U.addDays(T, -int(10 + si * 25, 60 + si * 55));
        const jobs = [...new Set([pick(info.jobs), pick(info.jobs)])].join(', ');
        const b = {
          id, name: coName(industry), industry, bizNo: `${int(120, 699)}-${int(10, 99)}-${int(10000, 99999)}`,
          ceo: person(), phone: `031-${int(350, 379)}-${d4()}`, employees: emp, ...p, stage, jobs,
          workConditions: pick(['주 5일, 09:00~16:00', '주 5일, 09:00~18:00', '주 3일, 10:00~15:00 (시간제)', '주 5일, 08:30~15:30', '평일 오전 4시간']),
          accessibility: info.acc, placements: stage === '채용연계' ? int(1, 3) : 0,
          source: pick(SOURCES), discoveredAt, staff,
          memo: pick(['', '', '대표님이 장애인 고용에 관심 많음. 지원금 제도 안내 필요.', '인사담당자 통화는 오후 2시 이후가 편하다고 함.', '작년에 다른 기관 통해 채용한 경험 있음.', '의무고용 부담금 문의 있었음.', '현장 견학 가능. 방문 전 전화 필수.']),
        };
        businesses.push(b);

        // 담당자 명함
        if (si >= 1 && stage !== '보류' || (stage === '보류' && rnd() < .7)) {
          const n = rnd() < .3 ? 2 : 1;
          for (let j = 0; j < n; j++) {
            addCard({
              name: person(), org: b.name, dept: pick(['경영지원팀', '인사팀', '총무팀', '생산관리팀', '']),
              title: j === 0 ? pick(['인사팀장', '관리부장', '총무과장', '공장장', '실장', '대표']) : pick(['주임', '대리', '매니저']),
              phone: `031-${int(350, 379)}-${d4()}`, mobile: `010-${d4()}-${d4()}`, email: `contact${cardN + 1}@example.com`,
              address: b.address, linkType: 'biz', linkId: id, tags: [pick(['사업체 담당자', '인사 담당', '현장 관리자'])],
              metAt: U.addDays(discoveredAt, int(3, 20)), metWhere: pick(['사업체 방문', '전화 후 명함 교환', '채용박람회']),
            });
          }
        }

        // 단계 흐름에 맞춘 활동 기록
        const steps = [['발굴', `${b.source}로 사업체 발굴. ${industry}, 상시근로자 ${emp}명`]];
        if (si >= 1) steps.push(['전화', '첫 연락. 장애인 채용 지원 제도와 복지관 직업지원 서비스 안내']);
        if (si >= 2) steps.push(['방문', `현장 방문. ${jobs} 직무 확인, 작업 환경 점검`]);
        if (si >= 3) steps.push(['미팅', '채용 조건 협의. 근무시간·급여·훈련 기간 논의']);
        if (stage === '채용연계') steps.push(['채용연계', `장애인 근로자 ${b.placements}명 채용 연계, 초기 적응 지원 시작`]);
        if (stage === '보류') steps.push(['전화', pick(['올해 채용 계획 없음. 하반기 재연락 요청', '업무 특성상 당분간 어렵다는 답변', '담당자 변경으로 보류'])]);
        let d = discoveredAt;
        const span = Math.max(1, U.diffDays(discoveredAt, T) - 2);
        steps.forEach(([type, content], idx) => {
          if (idx > 0) d = U.addDays(d, Math.max(1, Math.floor(span / steps.length) + int(-3, 3)));
          if (U.diffDays(d, T) < 0) d = T;
          addAct({ targetType: 'biz', targetId: id, date: d, type, content, staff });
        });

        // 다음 일정
        if (ACTIVE_STAGES.includes(stage) && rnd() < .8) {
          const off = rnd() < .18 ? -int(1, 5) : int(0, 20);
          const type = stage === '접촉' ? pick(['전화', '방문']) : stage === '방문상담' ? pick(['방문', '미팅']) : pick(['미팅', '면접 동행']);
          addEv({ date: U.addDays(T, off), time: pick(['10:00', '11:00', '14:00', '15:30', '']), type, title: `${type} - ${b.name}`, targetType: 'biz', targetId: id });
        }
        if (stage === '채용연계' && rnd() < .5) {
          addEv({ date: U.addDays(T, int(1, 25)), time: '14:00', type: '방문', title: `채용 후 적응 모니터링 - ${b.name}`, targetType: 'biz', targetId: id });
        }
      }
    }

    // 네트워크 기관 (가상)
    const NETS = [
      ['공공기관', '화성시 장애인일자리 협의체', '구인 정보 공유, 분기별 사례 회의', '협의체 회의 자료 배포'],
      ['공공기관', '서부권 고용복지 상담창구', '구직 장애인 의뢰 및 취업 알선 연계', '리플릿 비치'],
      ['공공기관', '향남 행정복지 민원센터', '복지 대상자 취업 상담 의뢰', '리플릿 비치, 게시판 홍보'],
      ['복지기관', '새솔 발달장애인 주간활동센터', '졸업생 취업 전환 연계', '보호자 설명회 공동 개최'],
      ['복지기관', '늘봄 장애인자립생활지원센터', '자립 준비 당사자 직업 상담 연계', 'SNS 공동 홍보'],
      ['복지기관', '해솔 지역아동센터', '청소년 직업체험 프로그램 협력', '소식지 교환'],
      ['교육기관', '다온 특수학교 (예시)', '전공과 학생 현장실습처 연계', '학부모 대상 취업 설명회'],
      ['교육기관', '봉담 평생학습관', '직업훈련 강좌 공동 운영', '강좌 안내문 게시'],
      ['교육기관', '화성권 직업훈련학교 (예시)', '바리스타·제과 훈련 과정 연계', '훈련생 모집 공동 홍보'],
      ['기업·경제단체', '화성 서부 산업단지 협의회', '입주 기업 대상 장애인 고용 설명회', '협의회 소식지 게재'],
      ['기업·경제단체', '동탄 소상공인 연합회', '소규모 사업장 채용 발굴', '회원사 단체 문자 안내'],
      ['기업·경제단체', '향남 사회적경제 네트워크', '사회적기업 일자리 연계', '공동 박람회 부스'],
      ['언론·홍보', '화성 생활정보 소식지 (예시)', '복지관 취업 성공 사례 기사 게재', '분기별 기사 게재'],
      ['언론·홍보', '지역 공동체 라디오 (예시)', '인터뷰 출연, 채용 캠페인', '캠페인 방송'],
      ['후원·자원봉사', '남양 로타리 봉사단 (예시)', '취업 준비물(면접 정장) 후원', '후원 감사 행사'],
      ['후원·자원봉사', '청명 기업 봉사 모임', '직무 멘토링 자원봉사', '봉사자 모집 공동 홍보'],
      ['의료기관', '동탄 재활의원 (예시)', '취업 전 건강 상담 협력', '대기실 리플릿 비치'],
      ['의료기관', '서부 정신건강 상담센터 (예시)', '정신장애 당사자 취업 연계 사례 협력', '공동 캠페인'],
      ['복지기관', '비봉 노인복지관', '중장년 장애인 일자리 정보 공유', '게시판 홍보'],
      ['공공기관', '동탄 청년 일자리 지원 창구', '청년 장애인 구직 연계', '청년 대상 설명회'],
    ];
    NETS.forEach(([category, name, relation, promo], i) => {
      const p = place();
      const id = 'N' + String(i + 1).padStart(3, '0');
      const status = i % 5 === 3 ? '휴면' : i % 3 === 0 ? '활발' : pick(['활발', '보통']);
      const since = U.addDays(T, -int(90, 900));
      const staff = pick(STAFF);
      networks.push({ id, name, category, ...p, relation, promo, status, since, staff, memo: pick(['', '', '연말 감사 행사 초대 대상', '담당자 교체 잦음, 기관 대표번호로 연락', '분기 1회 방문 약속']) });
      addCard({
        name: person(), org: name, dept: pick(['운영지원팀', '사업팀', '대외협력팀', '']), title: pick(['팀장', '사회복지사', '주무관', '실장', '간사', '과장']),
        phone: `031-${int(350, 379)}-${d4()}`, mobile: rnd() < .7 ? `010-${d4()}-${d4()}` : '', email: `partner${cardN + 1}@example.com`,
        address: p.address, linkType: 'net', linkId: id, tags: ['네트워크'], metAt: U.addDays(since, int(0, 30)), metWhere: pick(['기관 방문', '협의체 회의', '지역 행사']),
      });
      const n = status === '휴면' ? 1 : int(2, 4);
      let d = since;
      for (let j = 0; j < n; j++) {
        d = U.addDays(d, int(20, Math.max(25, Math.floor(U.diffDays(since, T) / n))));
        if (U.diffDays(d, T) < 0) d = U.addDays(T, -int(1, 10));
        addAct({ targetType: 'net', targetId: id, date: d, type: j === 0 ? '미팅' : pick(['홍보', '행사', '전화', '이메일']), content: j === 0 ? `협력 논의: ${relation}` : `${promo} 진행`, staff });
      }
      if (status !== '휴면' && rnd() < .45) {
        const type = pick(['행사', '홍보', '미팅']);
        addEv({ date: U.addDays(T, int(-2, 24)), time: pick(['10:00', '13:30', '16:00']), type, title: `${type} - ${name}`, targetType: 'net', targetId: id });
      }
    });

    // 행사에서 받은 미연결 명함
    for (let k = 0; k < 4; k++) {
      addCard({
        name: person(), org: pick(['경기 서남부 채용박람회 참가사', '지역 상공인 모임', '직업재활 세미나 참석자']), dept: '', title: pick(['과장', '대표', '매니저']),
        phone: '', mobile: `010-${d4()}-${d4()}`, email: `card${cardN + 1}@example.com`, address: '', linkType: '', linkId: '',
        tags: ['행사 명함'], metAt: U.addDays(T, -int(5, 60)), metWhere: pick(['채용박람회', '지역 세미나']), memo: '추후 사업체 발굴 대상 검토',
      });
    }

    // 사업체 없는 일반 일정
    addEv({ date: U.addDays(T, 3), time: '10:00', type: '행사', title: '장애인 채용 설명회 준비 회의', targetType: '', targetId: '' });
    addEv({ date: U.addDays(T, 9), time: '13:00', type: '홍보', title: '복지관 소식지 취업 사례 원고 마감', targetType: '', targetId: '' });

    return {
      version: 1, isDemo: true,
      settings: { orgName: '화성시아르딤복지관 직업지원팀', staff: STAFF_LIST, cityMapUrl: CITY_DASHBOARD_URL },
      businesses, networks, cards, activities, events,
    };
  }

  function empty() {
    return {
      version: 1, isDemo: false,
      settings: { orgName: '화성시아르딤복지관 직업지원팀', staff: [{ name: '김정배', program: '' }], cityMapUrl: CITY_DASHBOARD_URL },
      businesses: [], networks: [], cards: [], activities: [], events: [],
    };
  }

  return { BOUNDS, areaAt, GUS, GU, guOf, detectArea, guessCategory, DEFAULT_LINKS, AREAS, AREA_BY_NAME, CITY_CENTER, CITY_DASHBOARD_URL, STAGES, STAGE, ACTIVE_STAGES, PROGRAMS, PROGRAM, INDUSTRIES, INDUSTRY_LIST, SOURCES, NET_CATEGORIES, NET_STATUS, ACT_TYPES, EVENT_TYPES, MANDATORY, mandatoryCount, demo, empty };
})();
