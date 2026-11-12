/* 현장 모드: 밖에서 휴대폰으로 쓰는 첫 화면.
 * ① 사업체·기관 찾기 → 그곳의 연락이력(최신순)·명함·전화·길찾기
 * ② 내가 최근 연락한 곳, 다시 연락할 곳
 * ③ 큰 버튼: + 연락 기록 / 📷 명함 찍기
 * 데이터는 기존 연락이력(활동기록)·사업체·기관·명함을 그대로 쓴다 */
window.FM = (() => {
  const e = U.esc;
  const ui = { q: '', sel: null, adding: false, type: '전화', creating: null };
  const TYPES = ['전화', '방문', '문자', '이메일', '미팅'];
  const find = (kind, id) => S.find(kind, id);
  const telOf = p => String(p || '').replace(/[^0-9+]/g, '');
  const ago = d => { if (!U.isDate(d)) return ''; const n = U.diffDays(d, U.today()); return n <= 0 ? '오늘' : n === 1 ? '어제' : n < 30 ? `${n}일 전` : U.dateDot(d); };

  /** 찾기: 사업체(미등록 포함)와 기관을 이름·주소·전화·담당자로 */
  function search(q) {
    if (!q.trim()) return [];
    const v = S.view();
    const biz = v.businesses.concat(S.get().businesses.filter(b => S.isPending(b) && !v.businesses.includes(b)))
      .filter(b => U.match(q, b.name, b.address, b.phone, b.area)).map(x => ({ kind: 'biz', x }));
    const net = v.networks.filter(n => U.match(q, n.name, n.address, n.phone, n.area)).map(x => ({ kind: 'net', x }));
    const cards = v.cards.filter(c => U.match(q, c.name, c.org, c.mobile)).map(c => { const t = c.linkId && find(c.linkType, c.linkId); return t ? { kind: c.linkType, x: t, via: c.name } : null; }).filter(Boolean);
    const seen = new Set();
    return [...biz, ...net, ...cards].filter(r => { const k = r.kind + r.x.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 30);
  }
  /** 내가 최근 연락한 곳 (곳마다 한 번, 최근 순) */
  function recent(n = 10) {
    const me = S.me(), seen = new Set(), out = [];
    [...S.get().activities].filter(a => a.staff === me && (a.targetType === 'biz' || a.targetType === 'net')).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).some(a => {
      const k = a.targetType + a.targetId; if (seen.has(k)) return false; seen.add(k);
      const x = find(a.targetType, a.targetId); if (x) out.push({ kind: a.targetType, x, a });
      return out.length >= n;
    });
    return out;
  }
  /** 다시 연락할 곳: 진행 중인데 마지막 연락이 21일 넘은 내 담당 사업체 */
  function again(n = 8) {
    const me = S.me();
    return S.priorities().filter(p => p.kind === 'gap' && (!p.staff || p.staff === me)).slice(0, n).map(p => ({ kind: 'biz', x: find('biz', p.id), why: p.why })).filter(r => r.x);
  }

  const rowHtml = r => {
    const la = r.a || S.lastAct(r.kind, r.x.id);
    return `<button type="button" class="fm-row" data-act="fm-open" data-kind="${r.kind}" data-id="${r.x.id}">
      <span class="fm-row-t"><b>${e(r.x.name)}</b>${r.kind === 'net' ? ' <span class="fm-tag net">기관</span>' : S.isPending(r.x) ? ' <span class="fm-tag">미등록</span>' : r.x.stage ? ` <span class="fm-tag">${e(r.x.stage)}</span>` : ''}</span>
      <span class="fm-row-s">${r.why ? e(r.why) : la ? `${ago(la.date)} · ${e(la.type || '')} ${e((la.content || '').slice(0, 40))}` : '아직 연락 기록 없음'}${r.via ? ` · 명함 ${e(r.via)}` : ''}</span></button>`;
  };

  function page() {
    if (ui.creating != null) return newHtml(ui.creating);
    if (ui.sel) { const x = find(ui.sel.kind, ui.sel.id); if (x) return placeHtml(ui.sel.kind, x); ui.sel = null; }
    const q = ui.q.trim(), found = search(q), rec = recent(), ag = again();
    return `<div class="fm">
      <div class="fm-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6"/><path d="m14 14 4 4"/></svg>
        <input class="input" id="fmQ" type="search" value="${e(ui.q)}" placeholder="사업체·기관·명함 이름 (두세 글자)" autocomplete="off" enterkeyhint="search"></div>
      <div id="fmList">${q ? listHtml(found, q) : `
        ${ag.length ? `<section class="fm-sec"><h2>⏰ 다시 연락할 곳 <span class="sub">마지막 연락 3주 넘음</span></h2>${ag.map(rowHtml).join('')}</section>` : ''}
        <section class="fm-sec"><h2>🕘 내가 최근 연락한 곳</h2>${rec.map(rowHtml).join('') || '<p class="sub fm-none">아직 없어요. 아래 "+ 연락 기록"으로 시작해 보세요.</p>'}</section>`}</div>
      <div class="fm-dock"><button type="button" class="btn btn-primary fm-big" data-act="fm-new">＋ 연락 기록</button><button type="button" class="btn fm-big" data-act="card-photo">📷 명함 찍기</button></div>
    </div>`;
  }
  function listHtml(found, q) {
    return `<section class="fm-sec"><h2>찾은 곳 <span class="sub">${found.length}곳</span></h2>${found.map(rowHtml).join('')}
      <button type="button" class="fm-row fm-new" data-act="fm-new" data-name="${e(q)}"><b>＋ '${e(q)}' 새로 연락 기록</b><span class="fm-row-s">목록에 없는 곳이면 미등록으로 남아요. 나중에 사업체로 등록할 수 있어요</span></button></section>`;
  }

  /** 한 곳: 전화·길찾기, 명함, 연락이력, 기록 추가 */
  function placeHtml(kind, x) {
    const acts = S.actsOf(kind, x.id), cards = S.cardsOf ? S.cardsOf(kind, x.id) : [];
    const pos = M.hasPos(x);
    const navUrl = pos ? `https://map.kakao.com/link/to/${encodeURIComponent(x.name)},${x.lat},${x.lng}` : x.address ? `https://map.kakao.com/link/search/${encodeURIComponent(x.address)}` : '';
    const phones = [x.phone && { label: '대표', name: '', tel: x.phone }, ...cards.filter(c => c.mobile || c.phone).map(c => ({ label: c.title || '담당', name: c.name, tel: c.mobile || c.phone }))].filter(Boolean);
    return `<div class="fm fm-place">
      <div class="fm-top"><button type="button" class="btn btn-ghost btn-sm" data-act="fm-back">‹ 목록</button><button type="button" class="btn btn-ghost btn-sm" data-act="open" data-kind="${kind}" data-id="${x.id}">자세히</button></div>
      <h1 class="fm-name">${e(x.name)}</h1>
      <p class="sub fm-meta">${[kind === 'net' ? x.category : (S.isPending(x) ? '미등록' : x.stage), x.industry, x.staff && '담당 ' + x.staff].filter(Boolean).map(e).join(' · ')}${x.address ? `<br>${e(x.address)}` : ''}</p>
      <div class="fm-acts">
        ${phones[0] ? `<a class="btn fm-act" href="tel:${e(telOf(phones[0].tel))}">📞 전화<small>${e(phones[0].name || phones[0].label)}</small></a>` : '<span class="btn fm-act off">📞 전화<small>번호 없음</small></span>'}
        ${navUrl ? `<a class="btn fm-act" href="${e(navUrl)}" target="_blank" rel="noopener">🗺️ 길찾기<small>카카오맵</small></a>` : '<span class="btn fm-act off">🗺️ 길찾기<small>주소 없음</small></span>'}
        <button type="button" class="btn btn-primary fm-act" data-act="fm-add">✏️ 기록<small>오늘 연락</small></button>
      </div>
      ${phones.length > 1 ? `<div class="fm-phones">${phones.slice(1).map(p => `<a href="tel:${e(telOf(p.tel))}">📞 ${e(p.name || p.label)} <span class="sub">${e(p.label !== '대표' ? p.label : '')} ${e(p.tel)}</span></a>`).join('')}</div>` : ''}
      ${ui.adding ? addHtml(kind, x) : ''}
      <section class="fm-sec"><h2>연락이력 <span class="sub">${acts.length}건 · 최신순</span></h2>
        ${acts.length ? acts.slice(0, 40).map(a => `<article class="fm-log">
          <div class="fm-log-h"><b class="num">${U.dateDot(a.date)}</b> <span class="fm-tag">${e(a.type || '')}</span> <span class="sub">${ago(a.date)}${a.staff ? ' · ' + e(a.staff) : ''}</span></div>
          <p>${e(a.content || '')}</p>
          ${[a.contactName && '담당자 ' + a.contactName, a.result, a.jobType && '직종 ' + a.jobType].filter(Boolean).length ? `<p class="sub">${[a.contactName && '담당자 ' + a.contactName, a.result, a.jobType && '직종 ' + a.jobType].filter(Boolean).map(e).join(' · ')}</p>` : ''}
        </article>`).join('') : '<p class="sub fm-none">아직 연락 기록이 없어요. 위 "✏️ 기록"으로 첫 기록을 남겨 보세요.</p>'}
      </section>
    </div>`;
  }
  function addHtml(kind, x, name) {
    return `<form class="fm-add" data-form="fm-add" data-kind="${kind || ''}" data-id="${x ? x.id : ''}" autocomplete="off">
      ${x ? '' : `<label>어디에 연락했나요?<input class="input" name="name" list="fmBizList" value="${e(name || '')}" placeholder="사업체 이름" required></label>
        <datalist id="fmBizList">${S.get().businesses.map(b => `<option value="${e(b.name)}">`).join('')}</datalist>`}
      <div class="fm-types" role="radiogroup" aria-label="방식">${TYPES.map(t => `<button type="button" class="chip ${ui.type === t ? 'on' : ''}" data-act="fm-type" data-t="${t}" role="radio" aria-checked="${ui.type === t}">${t}</button>`).join('')}</div>
      <label>무슨 이야기를 했나요? <span class="sub">키보드의 🎤로 말해도 돼요</span><textarea class="textarea" name="content" rows="3" placeholder="예: 인사담당 김 과장 면담. 12월 채용 계획 있음, 이력서 보내기로"></textarea></label>
      <div class="fm-add-row"><label>담당자<input class="input" name="contactName" placeholder="예: 김재윤 부장"></label>
        <label>결과<select class="select" name="result"><option value="">선택</option>${D.CONTACT_RESULTS.map(r => `<option>${e(r)}</option>`).join('')}</select></label></div>
      <div class="fm-add-row"><label>날짜<input class="input" type="date" name="date" value="${U.today()}"></label><label>상태<select class="select" name="status">${D.CONTACT_STATUS.map(s => `<option>${e(s)}</option>`).join('')}</select></label></div>
      <div class="fm-add-btns"><button type="button" class="btn" data-act="fm-add-cancel">취소</button><button type="submit" class="btn btn-primary">저장</button></div>
    </form>`;
  }
  /** 새 연락 기록 (곳을 아직 안 고른 경우) */
  function newHtml(name) {
    return `<div class="fm fm-place"><div class="fm-top"><button type="button" class="btn btn-ghost btn-sm" data-act="fm-back">‹ 목록</button></div>
      <h1 class="fm-name">새 연락 기록</h1>${addHtml('', null, name)}</div>`;
  }
  /** 저장: 사업체는 연락이력 화면과 같은 방법(R.addContact)으로, 기관은 활동기록으로 */
  function save(form) {
    const fd = Object.fromEntries(new FormData(form).entries());
    const type = ui.type || '전화';
    const content = (fd.content || '').trim() || fd.result || `${type} 연락`;
    const date = U.isDate(fd.date) ? fd.date : U.today();
    const kind = form.dataset.kind, id = form.dataset.id;
    if (kind === 'net' && id) {
      S.upsert('act', { targetType: 'net', targetId: id, date, type, content, staff: S.me(), contactName: fd.contactName || '', result: fd.result || '', status: fd.status || '연락완료' });
      return { kind: 'net', x: find('net', id) };
    }
    const name = id ? (find('biz', id) || {}).name : String(fd.name || '').trim();
    if (!name) return null;
    const b = R.addContact({ date, type, staff: S.me(), name, phone: '', contactName: fd.contactName || '', jobType: '', content, result: fd.result || '', status: fd.status || '연락완료', address: '', jobUrl: '' });
    return { kind: 'biz', x: b };
  }
  return { ui, page, newHtml, save, TYPES };
})();
