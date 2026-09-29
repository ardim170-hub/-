/* AI 도우미 (Claude API)
   - 공유 모드: 구글 Apps Script 서버가 대신 호출한다 (API 키는 스크립트 속성에 보관, 브라우저에 노출되지 않음)
   - 파일 모드: 이 PC 브라우저에 저장한 API 키로 직접 호출한다
   API 키가 없으면 모든 AI 기능은 숨고, 직접 입력으로 대신한다. */
window.AI = (() => {
  const MODEL = 'claude-opus-5-5';
  const KEY_LS = 'ardim.anthropicKey';
  const localKey = () => { try { return localStorage.getItem(KEY_LS) || ''; } catch { return ''; } };
  const available = () => (S.REMOTE ? S.aiServer : !!localKey());

  async function setKey(key) {
    if (S.REMOTE) { await S.call('api_setAiKey', key); return; }
    try { if (key) localStorage.setItem(KEY_LS, key); else localStorage.removeItem(KEY_LS); } catch { /* 저장 불가 */ }
  }

  /** Messages API 한 번 호출. 공유 모드는 서버 프록시, 파일 모드는 직접 */
  async function post(body) {
    if (S.REMOTE) {
      const r = await S.call('api_claude', body);
      if (r && r.error) throw new Error(r.error.message || JSON.stringify(r.error));
      return r;
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': localKey(),
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((j.error && j.error.message) || `HTTP ${res.status}`);
    return j;
  }

  /** 서버 도구(웹 검색)가 pause_turn으로 멈추면 이어서 요청한다 */
  async function run(body) {
    body = { model: MODEL, fallbacks: 'default', ...body };
    let msg;
    for (let i = 0; i < 4; i++) {
      msg = await post(body);
      if (msg.stop_reason !== 'pause_turn') break;
      body = { ...body, messages: [...body.messages, { role: 'assistant', content: msg.content }] };
    }
    if (msg.stop_reason === 'refusal') throw new Error('AI가 이 요청을 처리하지 않았습니다.');
    return msg;
  }
  const textOf = msg => (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  const imageBlock = dataUrl => {
    const [, type, data] = dataUrl.match(/^data:([^;]+);base64,(.*)$/) || [];
    if (!data) throw new Error('이미지 형식을 읽지 못했습니다.');
    return type === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: type, data } }
      : { type: 'image', source: { type: 'base64', media_type: type, data } };
  };
  const obj = props => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
  const str = description => ({ type: 'string', description });

  /* ---------- 명함 사진 → 연락처 ---------- */
  const CARD_SCHEMA = obj({
    name: str('사람 이름'), title: str('직함/직위'), dept: str('부서'), org: str('회사·기관 이름'),
    mobile: str('휴대전화 010-0000-0000 형식'), phone: str('사무실 전화 (대표번호 포함)'), fax: str('팩스'),
    email: str('이메일'), address: str('주소 전체'), homepage: str('홈페이지 주소'),
  });
  async function readCard(dataUrl) {
    const msg = await run({
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: CARD_SCHEMA } },
      messages: [{ role: 'user', content: [imageBlock(dataUrl), { type: 'text', text: '이 명함 사진에서 연락처 정보를 읽어 주세요. 사진에 없는 항목은 빈 문자열로 두고, 짐작해서 채우지 마세요. 전화번호는 하이픈을 넣어 주세요.' }] }],
    });
    return JSON.parse(textOf(msg));
  }

  /* ---------- 사업자등록증·구인공고 등 사진/PDF → 사업체 정보 ---------- */
  const BIZ_SCHEMA = obj({
    name: str('상호(사업체명)'), ceo: str('대표자'), bizNo: str('사업자등록번호 000-00-00000'), address: str('사업장 소재지'),
    industry: str('업태/종목을 짧게'), phone: str('대표 전화'), employees: str('근로자 수(숫자만, 모르면 빈 문자열)'),
    jobs: str('모집 직무가 있으면 쉼표로'), workConditions: str('근무 조건이 있으면 한 줄로'), memo: str('그 밖에 참고할 내용 한두 줄'),
  });
  async function readBizDoc(dataUrl) {
    const msg = await run({
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: BIZ_SCHEMA } },
      messages: [{ role: 'user', content: [imageBlock(dataUrl), { type: 'text', text: '이 문서(사업자등록증, 구인공고, 회사 소개서 등)에서 사업체 정보를 읽어 주세요. 문서에 없는 항목은 빈 문자열로 두고 짐작하지 마세요.' }] }],
    });
    return JSON.parse(textOf(msg));
  }

  /* ---------- 인터넷 기초 조사 ---------- */
  async function research(b) {
    const msg = await run({
      max_tokens: 8000,
      output_config: { effort: 'low' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', country: 'KR', city: 'Hwaseong' } }],
      system: '당신은 장애인 취업지원 기관(화성시아르딤복지관 직업지원팀)의 사업체 개발 담당자를 돕습니다. 장애인 채용 가능성을 판단하는 데 필요한 공개 정보를 찾아 한국어로 짧게 정리합니다. 확인되지 않은 내용은 쓰지 말고 "확인 안 됨"이라고 적습니다.',
      messages: [{ role: 'user', content: `다음 사업체를 인터넷에서 조사해 아래 형식 그대로 정리해 주세요.

사업체: ${b.name}
주소: ${b.address || '모름'}
업종: ${b.industry || '모름'}

형식:
- 회사 개요: (무엇을 하는 회사인지 1~2줄)
- 규모: (직원 수, 매출 등 확인된 것)
- 홈페이지: (주소)
- 주요 제품·서비스:
- 최근 채용 공고: (직무, 조건, 게시처)
- 장애인 고용 관련: (장애인 고용 사례, 인증, 기사 등)
- 참고할 점: (방문·연락 전에 알아둘 것)
- 출처: (참고한 웹페이지 주소 목록)` }],
    });
    return textOf(msg);
  }

  /* ---------- 요약 ---------- */
  async function summarize(b) {
    const acts = S.actsOf('biz', b.id).slice(0, 15).map(a => `${a.date} ${a.type}: ${a.content}`).join('\n');
    const msg = await run({
      max_tokens: 2000,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: `아래 사업체 기록을 직업지원팀 동료가 10초 안에 파악하도록 한국어 3줄로 요약해 주세요. 각 줄은 "• "로 시작하고, 1줄: 어떤 곳인지, 2줄: 지금까지 진행 상황, 3줄: 다음에 할 일. 기록에 없는 내용은 만들지 마세요.

사업체: ${b.name} (${b.industry || '업종 미입력'}, ${b.area || ''}, 상시근로자 ${b.employees || '미입력'}명)
진행 단계: ${b.stage}
가능 직무: ${b.jobs || '-'} / 근무 조건: ${b.workConditions || '-'} / 고려사항: ${b.accessibility || '-'}
메모: ${b.memo || '-'}
기초 조사: ${b.research || '-'}
활동 기록:
${acts || '-'}` }],
    });
    return textOf(msg);
  }

  return { MODEL, available, setKey, localKey, readCard, readBizDoc, research, summarize };
})();
