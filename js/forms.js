/* 등록·수정 폼 (Desktop: 우측 Drawer, Mobile: 전체 화면) */
window.F = (() => {
  const e = U.esc;
  const field = (label, input, opt = {}) => `<div class="field ${opt.full ? 'full' : ''}" data-f="${opt.name || ''}"><label ${opt.for ? `for="${opt.for}"` : ''}>${label}${opt.req ? ' <span class="req">*</span>' : ''}</label>${input}${opt.hint ? `<span class="hint">${opt.hint}</span>` : ''}</div>`;
  const inp = (name, v, attrs = '') => `<input class="input" id="f_${name}" name="${name}" value="${e(v ?? '')}" ${attrs}>`;
  const ta = (name, v, attrs = '') => `<textarea class="textarea" id="f_${name}" name="${name}" ${attrs}>${e(v ?? '')}</textarea>`;
  const staffSel = v => `<select class="select" id="f_staff" name="staff"><option value="">선택</option>${S.staff().map(st => `<option value="${e(st.name)}" ${st.name === v ? 'selected' : ''}>${e(st.name)}${st.program ? ' · ' + e(st.program) : ''}</option>`).join('')}${v && !S.staff().some(st => st.name === v) ? `<option selected>${e(v)}</option>` : ''}</select>`;
  const sel = (name, list, v, blank) => `<select class="select" id="f_${name}" name="${name}">${V.opts(list, v, blank)}</select>`;
  const foot = (label) => `<div class="dr-foot"><button class="btn" type="button" data-act="dr-cancel">취소</button><button class="btn btn-primary" type="submit" form="entityForm">${label}</button></div>`;
  const head = (title) => `<div class="dr-head"><div class="dr-top"><h2 class="dr-title">${title}</h2><button class="icon-btn" type="button" data-act="dr-cancel" aria-label="닫기">${V.I.close}</button></div></div>`;

  /** 네트워크 분류 목록: 기본 분류 + 지금까지 쓴 분류 */
  const netCats = () => [...new Set([...D.NET_CATEGORIES, ...S.get().networks.map(n => n.category).filter(Boolean)])];
  const netCatList = () => `<datalist id="netCatList">${netCats().map(c => `<option value="${e(c)}">`).join('')}</datalist>`;
  function linkOptions(value) {
    const st = S.get();
    const byName = (a, b) => a.name.replace(/^\(주\)/, '').localeCompare(b.name.replace(/^\(주\)/, ''), 'ko');
    return `<option value="">연결 안 함</option>
      <optgroup label="사업체 개발">${[...st.businesses].sort(byName).map(b => `<option value="biz:${b.id}" ${value === 'biz:' + b.id ? 'selected' : ''}>${e(b.name)} (${e(b.stage)})</option>`).join('')}</optgroup>
      <optgroup label="네트워크">${[...st.networks].sort(byName).map(n => `<option value="net:${n.id}" ${value === 'net:' + n.id ? 'selected' : ''}>${e(n.name)}</option>`).join('')}</optgroup>`;
  }

  function locationSection(x) {
    const has = M.hasPos(x);
    return `<div class="fsec"><h3>위치</h3>
      <div class="frow">
        ${field('주소', `<div class="inline">${inp('address', x.address, 'placeholder="경기도 화성시 ..."')}<button class="btn" type="button" data-act="geocode">주소로 찾기</button></div>`, { full: true, for: 'f_address', hint: '주소로 못 찾으면 읍면동을 고른 뒤 아래 지도를 클릭해 정확한 위치를 찍어 주세요.' })}
        ${field('읍·면·동', sel('area', D.AREAS.map(a => a.name), x.area, '선택'), { for: 'f_area' })}
        ${field('좌표', `<div class="input num" id="posLabel" style="display:flex;align-items:center;color:var(--text-2)">${has ? `${x.lat}, ${x.lng}${x.approx ? ' (대략)' : ''}` : '지도를 클릭해 지정'}</div>`)}
      </div>
      <div class="pick-map" id="pickMap" aria-label="지도를 클릭해 위치 지정"></div>
      <input type="hidden" name="lat" value="${has ? x.lat : ''}"><input type="hidden" name="lng" value="${has ? x.lng : ''}"><input type="hidden" name="approx" value="${x.approx ? '1' : ''}">
    </div>`;
  }

  function bindLocation(form) {
    const lat = form.elements.lat, lng = form.elements.lng, approx = form.elements.approx;
    const label = form.querySelector('#posLabel');
    const show = () => { label.textContent = lat.value ? `${lat.value}, ${lng.value}${approx.value ? ' (대략)' : ''}` : '지도를 클릭해 지정'; };
    const pk = M.picker(form.querySelector('#pickMap'), lat.value ? { lat: +lat.value, lng: +lng.value } : null, (a, b) => { lat.value = a; lng.value = b; approx.value = ''; const ar = D.areaAt(a, b); if (ar) form.elements.area.value = ar; show(); });
    form.elements.area.addEventListener('change', () => {
      const a = D.AREA_BY_NAME[form.elements.area.value];
      if (a && (!lat.value || approx.value) && pk) { pk.set(a.lat, a.lng, 14); approx.value = '1'; show(); }
    });
    form._geocode = async () => {
      const q = form.elements.address.value;
      if (!q.trim()) { App.toast('주소를 먼저 입력하세요.', 'error'); return; }
      const btn = form.querySelector('[data-act="geocode"]');
      btn.disabled = true; btn.textContent = '찾는 중…';
      try {
        const r = await M.geocode(q);
        if (r && pk) { pk.set(r.lat, r.lng, 16); App.toast('위치를 찾았습니다. 핀이 맞는지 확인하고, 다르면 지도를 클릭해 옮기세요.'); }
        else App.toast('주소로 위치를 찾지 못했습니다. 읍면동을 고르고 지도를 클릭해 지정하세요.', 'error');
      } catch { App.toast('위치 검색 서비스에 연결하지 못했습니다. 인터넷 연결을 확인하거나 지도를 클릭해 지정하세요.', 'error'); }
      finally { btn.disabled = false; btn.textContent = '주소로 찾기'; }
    };
  }

  /* ---------- 사업체 ---------- */
  const notice = t => t ? `<div class="form-notice">${e(t)}</div>` : '';
  function biz(b, preset = {}, focus) {
    const x = b || { stage: '발굴', discoveredAt: U.today(), staff: S.me(), source: '현장 발굴', placements: 0, ...preset };
    return {
      html: head(b ? '사업체 정보 수정' : '사업체 발굴 등록') + `<div class="dr-body"><form class="form" id="entityForm" data-form="biz" data-id="${b ? b.id : ''}" data-focus="${e(focus || '')}" novalidate>${notice(preset._notice)}
        <div class="fsec"><h3>기본 정보</h3><div class="frow">
          ${field('사업체명', inp('name', x.name, 'required autocomplete="off"'), { req: true, full: true, name: 'name', for: 'f_name' })}
          ${field('업종', `<input class="input" id="f_industry" name="industry" list="indList" value="${e(x.industry || '')}"><datalist id="indList">${D.INDUSTRY_LIST.map(i => `<option value="${e(i)}">`).join('')}</datalist>`, { for: 'f_industry' })}
          ${field('상시근로자 수', inp('employees', x.employees || '', 'type="number" min="0" inputmode="numeric"'), { for: 'f_employees', hint: '50명 이상이면 장애인 의무고용 대상(3.1%)으로 표시됩니다.' })}
          ${field('사업자등록번호', inp('bizNo', x.bizNo, 'placeholder="000-00-00000"'), { for: 'f_bizNo' })}
          ${field('대표자', inp('ceo', x.ceo), { for: 'f_ceo' })}
          ${field('대표 전화', inp('phone', x.phone, 'type="tel" inputmode="tel" placeholder="031-000-0000"'), { for: 'f_phone' })}
          ${field('홈페이지', inp('homepage', x.homepage, 'placeholder="www..."'), { for: 'f_homepage' })}
        </div></div>
        ${locationSection(x)}
        <div class="fsec"><h3>채용 정보</h3><div class="frow">
          ${field('진행 단계', sel('stage', D.STAGES.map(s => s.key), x.stage), { for: 'f_stage' })}
          ${field('진행 사업', `<div class="sup-pick">${D.SUPPORT_TYPES.map(t => `<label class="sup-opt sup-${t === '지원고용' ? 'employ' : 'training'}"><input type="checkbox" name="support" value="${t}" ${(x.support || []).includes(t) ? 'checked' : ''}><span>${D.SUPPORT_LABEL[t]}</span></label>`).join('')}</div>`, { full: true, hint: '지도에 지원고용은 빨강, 현장훈련은 보라로 표시돼요. 채용연계가 되면 주황이에요.' })}
          ${field('채용 연계 인원', inp('placements', x.placements || 0, 'type="number" min="0" inputmode="numeric"'), { for: 'f_placements' })}
          ${field('가능 직무', inp('jobs', x.jobs, 'placeholder="예: 포장, 검수, 사무 보조"'), { full: true, for: 'f_jobs' })}
          ${field('근무 조건', inp('workConditions', x.workConditions, 'placeholder="예: 주 5일, 09:00~16:00"'), { full: true, for: 'f_workConditions' })}
          ${field('복리후생(기타)', inp('welfare', x.welfare, 'placeholder="예: 중식 제공, 통근버스"'), { full: true, for: 'f_welfare' })}
          ${field('실적 진행도', sel('progress', D.PROCEDURES, x.progress, '자동 (방문·직무분석지 기록으로 판단)'), { full: true, for: 'f_progress' })}
          ${field('편의시설·고려사항', ta('accessibility', x.accessibility, 'rows="2" placeholder="예: 엘리베이터 있음, 서서 하는 작업, 통근버스 운영"'), { full: true, for: 'f_accessibility' })}
        </div></div>
        <div class="fsec"><h3>기초 조사</h3><div class="frow">
          ${field('조사 내용', ta('research', x.research, 'rows="7" placeholder="회사 개요, 규모, 주요 제품, 최근 채용 공고, 장애인 고용 관련 내용, 참고할 점, 출처 등"'), { full: true, for: 'f_research', hint: '사업체 상세 화면의 검색 버튼(네이버·구글·사람인 등)으로 찾은 내용을 정리해 두세요.' })}
          ${field('조사일', inp('researchAt', x.researchAt, 'type="date"'), { for: 'f_researchAt' })}
        </div></div>
        <div class="fsec"><h3>운영 정보</h3><div class="frow">
          ${field('발굴 경로', sel('source', D.SOURCES, x.source, '선택'), { for: 'f_source' })}
          ${field('발굴일', inp('discoveredAt', x.discoveredAt, 'type="date"'), { for: 'f_discoveredAt' })}
          ${field('담당 직원', staffSel(x.staff), { for: 'f_staff' })}
          ${progPick(x)}
          ${field('메모', ta('memo', x.memo, 'rows="3" placeholder="예: 인사팀장 통화는 오후 2시 이후"'), { full: true, for: 'f_memo' })}
        </div></div>
      </form></div>` + foot(b ? '저장' : '등록'),
      after: form => bindLocation(form),
    };
  }

  /** 어느 사업 지도에 나올지 (여러 개 가능). 아무것도 안 고르면 담당 직원의 소속 사업을 따른다 */
  const progPick = x => field('사업 구분 (지도)', `<div class="prog-pick">${D.PROGRAMS.filter(p => p.map).map(p => `<label class="prog-opt" style="--c:${p.hex}"><input type="checkbox" name="programs" value="${U.esc(p.key)}" ${(x.programs || []).includes(p.key) ? 'checked' : ''}><span>${U.esc(p.map)}</span></label>`).join('')}</div>`, { full: true, hint: '고른 사업의 지도에 나와요. 비워 두면 담당 직원의 소속 사업 지도에 나와요.' });

  /* ---------- 네트워크 ---------- */
  function net(n, preset = {}) {
    const x = n || { category: '복지기관', status: '활발', since: U.today(), staff: S.me(), ...preset };
    return {
      html: head(n ? '기관 정보 수정' : '네트워크 기관 등록') + `<div class="dr-body"><form class="form" id="entityForm" data-form="net" data-id="${n ? n.id : ''}" novalidate>
        <div class="fsec"><h3>기본 정보</h3><div class="frow">
          ${field('기관명', inp('name', x.name, 'required autocomplete="off"'), { req: true, full: true, name: 'name', for: 'f_name' })}
          ${field('분류', `${inp('category', x.category, 'list="netCatList" autocomplete="off" placeholder="고르거나 직접 입력"')}${netCatList()}`, { for: 'f_category', hint: '예: 정신건강복지센터. 목록에 없으면 직접 쓰면 돼요.' })}
          ${field('관계 상태', sel('status', D.NET_STATUS, x.status), { for: 'f_status' })}
        </div></div>
        ${locationSection(x)}
        <div class="fsec"><h3>협력 · 홍보</h3><div class="frow">
          ${field('협력 내용', ta('relation', x.relation, 'rows="2" placeholder="예: 구직 장애인 의뢰, 채용박람회 공동 개최"'), { full: true, for: 'f_relation' })}
          ${field('홍보 방식', inp('promo', x.promo, 'placeholder="예: 리플릿 비치, 소식지 게재, SNS 공동 홍보"'), { full: true, for: 'f_promo' })}
          ${field('협력 시작일', inp('since', x.since, 'type="date"'), { for: 'f_since' })}
          ${field('담당 직원', staffSel(x.staff), { for: 'f_staff' })}
          ${progPick(x)}
          ${field('메모', ta('memo', x.memo, 'rows="3"'), { full: true, for: 'f_memo' })}
        </div></div>
      </form></div>` + foot(n ? '저장' : '등록'),
      after: form => bindLocation(form),
    };
  }

  /* ---------- 명함 ---------- */
  function card(c, preset = {}) {
    const x = c || { metAt: U.today(), tags: [], linkType: '', linkId: '', ...preset };
    const linkVal = x.linkType && x.linkId ? `${x.linkType}:${x.linkId}` : '';
    const regMode = linkVal ? 'link' : (preset.regMode || 'none');
    return {
      html: head(c ? '명함 수정' : '명함 등록') + `<div class="dr-body"><form class="form" id="entityForm" data-form="card" data-id="${c ? c.id : ''}" novalidate>${notice(preset._notice)}
        <div class="fsec"><h3>명함 사진</h3>
          <div class="photo-drop" id="photoDrop">
            <img id="photoPreview" ${S.photo(x) ? `src="${S.photo(x)}"` : 'hidden'} alt="명함 사진 미리보기">
            <span id="photoHint">${x.photo ? '' : '명함을 찍은 사진을 올려 두면 원본을 다시 확인할 수 있어요.'}</span>
            <div class="inline"><label class="btn btn-sm" for="f_photoFile">사진 선택</label>${x.photo ? '<button class="btn btn-ghost btn-sm" type="button" data-act="photo-clear">사진 삭제</button>' : ''}</div>
            <input type="file" id="f_photoFile" accept="image/*" capture="environment" hidden>
          </div>
          <input type="hidden" name="photo" value="">
        </div>
        <div class="fsec"><h3>인적 정보</h3><div class="frow">
          ${field('이름', inp('name', x.name, 'required autocomplete="off"'), { req: true, name: 'name', for: 'f_name' })}
          ${field('직함', inp('title', x.title, 'placeholder="예: 인사팀장"'), { for: 'f_title' })}
          ${field('소속', inp('org', x.org), { for: 'f_org' })}
          ${field('부서', inp('dept', x.dept), { for: 'f_dept' })}
        </div></div>
        <div class="fsec"><h3>연락처</h3><div class="frow">
          ${field('휴대전화', inp('mobile', x.mobile, 'type="tel" inputmode="tel" placeholder="010-0000-0000"'), { for: 'f_mobile' })}
          ${field('사무실 전화', inp('phone', x.phone, 'type="tel" inputmode="tel" placeholder="031-000-0000"'), { for: 'f_phone' })}
          ${field('이메일', inp('email', x.email, 'type="email" inputmode="email"'), { full: true, for: 'f_email' })}
          ${field('주소', inp('address', x.address), { full: true, for: 'f_address' })}
        </div></div>
        <div class="fsec"><h3>어디에 둘까요?</h3>
          <div class="reg-choice" role="radiogroup" aria-label="명함을 둘 곳">
            ${[['none', '나중에 정하기', '분류 대기 명함으로 둡니다'], ['net', '네트워크로 새로 등록', '기관 · 지도에 검정'], ['biz', '사업체 개발로 새로 등록', '사업체 · 지도에 노랑'], ['link', '이미 있는 곳에 연결', '등록된 사업체·기관']].map(([k, l, d]) => `<label class="reg-opt reg-${k}"><input type="radio" name="regMode" value="${k}" ${regMode === k ? 'checked' : ''}><span><b>${l}</b><small>${d}</small></span></label>`).join('')}
          </div>
          <div class="frow" data-show="net biz">
            ${field('등록 이름', inp('regName', x.org || '', 'autocomplete="off" placeholder="예: 향남 정신건강복지센터"'), { full: true, for: 'f_regName', hint: '지도와 목록에 이 이름으로 나와요. 비우면 소속 이름을 씁니다.' })}
            <div class="field" data-show="net"><label for="f_regCat">기관 분류</label><input class="input" id="f_regCat" name="regCat" list="netCatList" autocomplete="off" value="${e(D.guessCategory(x.org || ''))}" placeholder="고르거나 직접 입력 (예: 정신건강복지센터)">${netCatList()}</div>
          </div>
          <div class="frow" data-show="link">
            ${field('연결할 사업체·기관', `<select class="select" id="f_link" name="link">${linkOptions(linkVal)}</select>`, { full: true, for: 'f_link', hint: '연결하면 그 사업체·기관 상세 화면의 담당자로 표시됩니다.' })}
          </div>
        </div>
        <div class="fsec"><h3>메모</h3><div class="frow">
          ${field('받은 날', inp('metAt', x.metAt, 'type="date"'), { for: 'f_metAt' })}
          ${field('받은 곳', inp('metWhere', x.metWhere, 'placeholder="예: 사업체 방문, 채용박람회"'), { for: 'f_metWhere' })}
          ${field('태그', inp('tags', (x.tags || []).join(', '), 'placeholder="쉼표로 구분. 예: 인사 담당, 행사 명함"'), { full: true, for: 'f_tags' })}
          ${field('메모', ta('memo', x.memo, 'rows="3"'), { full: true, for: 'f_memo' })}
        </div></div>
      </form></div>` + foot(c ? '저장' : '등록'),
      after: form => {
        // 고른 곳에 맞는 칸만 보이게. 소속을 쓰면 등록 이름·분류도 따라 채운다(직접 고치기 전까지)
        const showFor = () => { const m = form.elements.regMode.value; form.querySelectorAll('[data-show]').forEach(el => { el.hidden = !el.dataset.show.split(' ').includes(m); }); };
        form.querySelectorAll('[name=regMode]').forEach(r => r.addEventListener('change', showFor));
        showFor();
        let nameTouched = false, catTouched = false;
        form.elements.regName.addEventListener('input', () => { nameTouched = true; });
        form.elements.regCat.addEventListener('input', () => { catTouched = true; });
        const follow = () => { const o = form.elements.org.value.trim(); if (!nameTouched) form.elements.regName.value = o; if (!catTouched) form.elements.regCat.value = D.guessCategory(form.elements.regName.value || o); };
        form.elements.org.addEventListener('input', follow);
        form.elements.regName.addEventListener('input', () => { if (!catTouched) form.elements.regCat.value = D.guessCategory(form.elements.regName.value); });
        form.elements.photo.value = !c && x.photo ? x.photo : 'keep';
        const file = form.querySelector('#f_photoFile');
        const prev = form.querySelector('#photoPreview');
        file.addEventListener('change', async () => {
          const f = file.files[0];
          if (!f) return;
          try {
            const data = await resizeImage(f, 1000, .72);
            form.elements.photo.value = data; prev.src = data; prev.hidden = false;
            form.querySelector('#photoHint').textContent = '';
          } catch { App.toast('사진을 읽지 못했습니다. JPG나 PNG 파일인지 확인하세요.', 'error'); }
        });
        form.elements.link.addEventListener('change', () => {
          const [k, id] = form.elements.link.value.split(':');
          const t = k ? S.find(k, id) : null;
          if (t && !form.elements.org.value) form.elements.org.value = t.name;
          if (t && !form.elements.address.value && t.address) form.elements.address.value = t.address;
        });
      },
    };
  }

  function resizeImage(file, max, q) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = rej;
      r.onload = () => {
        const img = new Image();
        img.onerror = rej;
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', q));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  /* ---------- 일정 ---------- */
  function event(ev, preset = {}) {
    const x = ev || { date: U.today(), time: '', type: '방문', targetType: '', targetId: '', staff: S.me(), ...preset };
    const tval = x.targetType && x.targetId ? `${x.targetType}:${x.targetId}` : '';
    const who = x.staff || (ev ? (S.targetOf(ev) || {}).staff || '' : S.me());
    return {
      html: head(ev ? '일정 수정' : '일정 등록') + `<div class="dr-body"><form class="form" id="entityForm" data-form="ev" data-id="${ev ? ev.id : ''}" novalidate>
        <div class="fsec"><div class="frow">
          ${field('관련 사업체·기관', `<select class="select" id="f_link" name="link">${linkOptions(tval)}</select>`, { full: true, for: 'f_link' })}
          ${field('담당 직원', `<select class="select" id="f_staff" name="staff"><option value="">팀 공통</option>${S.staff().map(s => `<option ${s.name === who ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</select>`, { for: 'f_staff' })}
          ${field('유형', sel('type', D.EVENT_TYPES, x.type), { for: 'f_type' })}
          ${field('제목', inp('title', x.title, 'placeholder="비워 두면 \'유형 - 사업체명\'으로 저장"'), { full: true, for: 'f_title' })}
          ${field('날짜', inp('date', x.date, 'type="date" required'), { req: true, name: 'date', for: 'f_date' })}
          ${field('시간', inp('time', x.time, 'type="time"'), { for: 'f_time' })}
          ${field('메모', ta('memo', x.memo, 'rows="3" placeholder="예: 구직자 2명 동행, 이력서 지참"'), { full: true, for: 'f_memo' })}
        </div></div>
        ${ev ? `<div><button class="btn btn-ghost btn-sm" type="button" data-act="delete" data-kind="ev" data-id="${ev.id}" style="color:var(--danger)">이 일정 삭제</button></div>` : ''}
      </form></div>` + foot(ev ? '저장' : '등록'),
    };
  }

  /* ---------- 수집 + 검증 ---------- */
  function collect(form) {
    const kind = form.dataset.form;
    const fd = Object.fromEntries(new FormData(form).entries());
    const errs = [];
    form.querySelectorAll('.field.err').forEach(f => { f.classList.remove('err'); f.querySelector('.errmsg')?.remove(); });
    const need = (k, msg) => { if (!String(fd[k] || '').trim()) errs.push([k, msg]); };
    let obj, extra = null;
    const pos = () => ({ lat: fd.lat ? +fd.lat : null, lng: fd.lng ? +fd.lng : null, approx: !!fd.approx });
    if (kind === 'biz') {
      need('name', '사업체명을 입력하세요.');
      obj = { name: fd.name.trim(), industry: fd.industry.trim(), employees: fd.employees ? +fd.employees : 0, bizNo: fd.bizNo.trim(), ceo: fd.ceo.trim(), phone: fd.phone.trim(), homepage: fd.homepage.trim(), welfare: fd.welfare.trim(), progress: fd.progress, support: [...form.querySelectorAll('[name=support]:checked')].map(c => c.value), programs: [...form.querySelectorAll('[name=programs]:checked')].map(c => c.value), research: fd.research.trim(), researchAt: fd.researchAt || (fd.research.trim() ? U.today() : ''), address: fd.address.trim(), area: fd.area, ...pos(), stage: fd.stage, placements: fd.placements ? +fd.placements : 0, jobs: fd.jobs.trim(), workConditions: fd.workConditions.trim(), accessibility: fd.accessibility.trim(), source: fd.source, discoveredAt: fd.discoveredAt, staff: fd.staff, memo: fd.memo.trim() };
    } else if (kind === 'net') {
      need('name', '기관명을 입력하세요.');
      obj = { name: fd.name.trim(), category: fd.category, status: fd.status, address: fd.address.trim(), area: fd.area, ...pos(), relation: fd.relation.trim(), promo: fd.promo.trim(), since: fd.since, staff: fd.staff, memo: fd.memo.trim(), programs: [...form.querySelectorAll('[name=programs]:checked')].map(c => c.value) };
    } else if (kind === 'card') {
      need('name', '이름을 입력하세요.');
      const [lt, li] = fd.regMode === 'link' ? (fd.link || '').split(':') : [];
      if (fd.regMode === 'net' || fd.regMode === 'biz') extra = { to: fd.regMode, name: (fd.regName || '').trim(), cat: (fd.regCat || '').trim() };
      obj = { name: fd.name.trim(), title: fd.title.trim(), org: fd.org.trim(), dept: fd.dept.trim(), mobile: fd.mobile.trim(), phone: fd.phone.trim(), email: fd.email.trim(), address: fd.address.trim(), linkType: lt || '', linkId: li || '', metAt: fd.metAt, metWhere: fd.metWhere.trim(), tags: fd.tags.split(',').map(t => t.trim()).filter(Boolean), memo: fd.memo.trim(), photo: fd.photo === 'keep' ? undefined : (fd.photo || null) };
    } else if (kind === 'ev') {
      need('date', '날짜를 입력하세요.');
      const [lt, li] = (fd.link || '').split(':');
      const t = lt ? S.find(lt, li) : null;
      obj = { targetType: lt || '', targetId: li || '', type: fd.type, title: fd.title.trim() || (t ? `${fd.type} - ${t.name}` : fd.type), date: fd.date, time: fd.time, memo: fd.memo.trim(), staff: fd.staff || '' };
    }
    errs.forEach(([k, msg]) => {
      const f = form.querySelector(`[data-f="${k}"]`);
      if (f) { f.classList.add('err'); f.insertAdjacentHTML('beforeend', `<span class="errmsg">${msg}</span>`); }
    });
    if (errs.length) form.querySelector(`[name="${errs[0][0]}"]`)?.focus();
    return errs.length ? null : { kind, obj, extra };
  }

  return { biz, net, card, event, collect, resizeImage };
})();
