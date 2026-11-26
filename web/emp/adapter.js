/* 고용지원 업무판 → 아르딤 앱 연결 파일
 * 업무판 화면들은 원래 claude.ai 안에서 window.claude.use("mcp"|"sample"|"downloads")로
 * 구글 시트 읽기·쓰기, AI 초안, 파일 내려받기를 했다. 아르딤 앱(ardim-jobs.web.app) 안에서는 이 파일이 대신한다.
 *   - mcp(Google Sheets)  → 앱에 로그인한 구글 계정의 출입증으로 Google Sheets API(v4) 직접 호출
 *   - sample(AI 초안)     → 앱의 AI 도우미(Apps Script 서버가 AI 키로 대신 호출, 키는 브라우저에 없음)
 *   - downloads(내려받기) → 브라우저 다운로드 (.hwpx.zip 이름은 .hwpx로 바꿔 바로 한글에서 열리게)
 * 앱 화면(업무도구) 안에서 열린다. 따로 연 창에서도 로그인 정보가 있으면 시트는 쓸 수 있다(AI는 앱 안에서만). */
(function () {
  'use strict';
  var app = (function () { try { return window.top !== window && window.top.S && window.top.AppAuth ? window.top : null; } catch (e) { return null; } })();
  window.APP_ME = (app && app.S.me && app.S.me()) || '';
  var fail = function (code, msg) { var e = new Error(msg); e.code = code; return e; };

  function token() {
    if (app) return app.AppAuth.token();
    try { var o = JSON.parse(localStorage.getItem('ardim.app.token') || sessionStorage.getItem('ardim.app.token') || 'null'); return o && o.exp > Date.now() ? o.t : ''; } catch (e) { return ''; }
  }
  var SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets/';
  async function sheets(tool, input) {
    var t = token();
    if (!t) { if (app && app.AppAuth.needLogin) app.AppAuth.needLogin(); throw fail('needs_reauth', '로그인을 다시 확인해야 해요. 위쪽 "확인하기"를 눌러 주세요.'); }
    var id = encodeURIComponent(input.spreadsheetId), rg = encodeURIComponent(input.range), res;
    if (tool === 'get_values') {
      res = await fetch(SHEETS + id + '/values/' + rg, { headers: { Authorization: 'Bearer ' + t } });
    } else if (tool === 'update_values') {
      // USER_ENTERED로 쓰고, null 칸은 Sheets API가 건너뛴다(자동 수식 칸을 지키려고)
      res = await fetch(SHEETS + id + '/values/' + rg + '?valueInputOption=USER_ENTERED', {
        method: 'PUT', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: input.range, majorDimension: 'ROWS', values: input.values }),
      });
    } else throw fail('tool_error', '지원하지 않는 기능: ' + tool);
    if (res.status === 401) { if (app && app.AppAuth.needLogin) app.AppAuth.needLogin(); throw fail('needs_reauth', '로그인을 다시 확인해야 해요.'); }
    if (res.status === 403 || res.status === 404) {
      var body = ''; try { body = JSON.stringify(await res.clone().json()); } catch (e) { /* 내용 없음 */ }
      if (/has not been used|SERVICE_DISABLED|is disabled/i.test(body)) throw fail('tool_error', '구글 클라우드(ardim-jobs)에서 "Google Sheets API"가 꺼져 있어요. 관리자가 한 번 켜 주면 돼요.');
      throw fail('tool_error', '업무판 구글 시트를 열 권한이 없어요. 시트 주인에게 이 계정(' + ((app && app.AppAuth.email()) || '') + ')으로 공유를 요청해 주세요.');
    }
    if (!res.ok) throw fail('tool_error', '구글 시트 오류 ' + res.status);
    return { payload: await res.json() };
  }
  var mcp = { callTool: function (server, tool, input) { return sheets(tool, input || {}); } };

  /** AI 답에서 JSON만 꺼내기 (``` 묶음·앞뒤 설명이 붙어도) */
  function pickJson(t) {
    t = String(t || '').replace(/```(?:json)?/gi, '').trim();
    try { return JSON.parse(t); } catch (e) { /* 아래에서 다시 */ }
    var a = t.search(/[[{]/); if (a < 0) throw fail('tool_error', 'AI 답을 읽지 못했어요.');
    var open = t[a], close = open === '{' ? '}' : ']', b = t.lastIndexOf(close);
    return JSON.parse(t.slice(a, b + 1));
  }
  function makeSample() {
    if (!(app && app.AI && app.AI.run && app.AI.available())) return null; // AI 키가 없으면 AI 버튼이 꺼진다
    // sample(글, {onText}) → {text}  (직업평가 화면) / sample.json(글) → JSON (업무판 화면)
    var ask = async function (prompt, opts) {
      var msg = await app.AI.run({ max_tokens: 8000, messages: [{ role: 'user', content: String(prompt) }] });
      var text = app.AI.textOf(msg);
      if (opts && typeof opts.onText === 'function') { try { opts.onText({ text: text }); } catch (e) { /* 화면 쪽 오류 무시 */ } }
      return { text: text };
    };
    ask.json = async function (prompt, opts) {
      var complex = opts && opts.modelTier === 'complex';
      var msg = await app.AI.run({ max_tokens: complex ? 8000 : 4000, messages: [{ role: 'user', content: String(prompt) + '\n\n답은 JSON 값 하나만 주세요. 설명이나 ``` 표시는 붙이지 마세요.' }] });
      return pickJson(app.AI.textOf(msg));
    };
    return ask;
  }
  var downloads = {
    save: async function (o) {
      var name = String(o.filename || '파일').replace(/\.hwpx\.zip$/i, '.hwpx');
      var url = URL.createObjectURL(o.data);
      var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
      return true;
    },
  };
  /* ---------- db: 직업평가 기록 저장 ----------
   * claude.ai의 '사람마다 따로 저장'을 우리 팀 구글 시트의 '직업평가' 탭으로 대신한다.
   * 한 줄 = 기록 하나: A 기록ID · B 작성자(메일) · C 고친 때 · D~ 기록(JSON, 셀 한 칸 5만 자 제한이라 나눠 담음)
   * 화면은 'data/users/<내 메일>' 묶음만 보므로, 각자 자기 기록만 보인다(시트에는 팀 기록이 모인다). */
  var DB_SHEET = (app && app.APP_CONFIG && app.APP_CONFIG.dbSheet) || '';
  var TAB = '직업평가', CHUNK = 45000, NCOL = 8; // D~K: 최대 약 36만 자
  var colL = function (i) { return String.fromCharCode(65 + i); };
  async function api(path, opt) {
    var t = token(); if (!t) throw fail('needs_reauth', '로그인을 다시 확인해야 해요.');
    opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, opt.headers || {});
    var r = await fetch(SHEETS + encodeURIComponent(DB_SHEET) + path, opt);
    if (!r.ok) throw fail('tool_error', '직업평가 기록 저장소(구글 시트) 오류 ' + r.status);
    return r.json();
  }
  var tabReady = null;
  function ensureTab() {
    if (!tabReady) tabReady = (async function () {
      var meta = await api('?fields=sheets.properties.title');
      if ((meta.sheets || []).some(function (x) { return x.properties.title === TAB; })) return;
      await api(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB, gridProperties: { rowCount: 500, columnCount: 3 + NCOL } } } }] }) });
      await api('/values/' + encodeURIComponent(TAB + '!A1:D1') + '?valueInputOption=RAW', { method: 'PUT', body: JSON.stringify({ values: [['기록ID', '작성자', '고친 때', '기록(JSON)']] }) });
    })().catch(function (e) { tabReady = null; throw e; });
    return tabReady;
  }
  async function readAll() {
    await ensureTab();
    var j = await api('/values/' + encodeURIComponent(TAB + '!A2:' + colL(2 + NCOL)));
    return (j.values || []).map(function (r, i) { return { row: i + 2, id: r[0] || '', owner: r[1] || '', at: +r[2] || 0, json: r.slice(3).join('') }; });
  }
  function docOf(x) { var d = null; try { d = JSON.parse(x.json); } catch (e) { d = null; } return { id: x.id, exists: !!d, data: function () { return d; } }; }
  function collection(path) {
    var owner = String(path).split('/').pop();
    var mine = function (rows) { return rows.filter(function (x) { return x.id && x.owner === owner; }); };
    var seen = {};
    var col = {
      get: async function () { var rows = mine(await readAll()); rows.forEach(function (x) { seen[x.id] = x.at; }); return { docs: rows.map(docOf) }; },
      doc: function (id) {
        return {
          set: async function (data) {
            var copy = JSON.parse(JSON.stringify(data)); delete copy.aiLog; // AI 원문 기록은 이 기기에만 (칸 크기 줄이기)
            var json = JSON.stringify(copy), parts = [];
            for (var i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
            if (parts.length > NCOL) throw fail('tool_error', '기록이 너무 길어 시트에 다 담을 수 없어요.');
            while (parts.length < NCOL) parts.push('');
            var at = copy.updatedAt || Date.now(), row = [id, owner, String(at)].concat(parts);
            var hit = (await readAll()).find(function (x) { return x.id === id; }); // 쓰기 직전에 다시 확인
            if (hit) await api('/values/' + encodeURIComponent(TAB + '!A' + hit.row + ':' + colL(2 + NCOL) + hit.row) + '?valueInputOption=RAW', { method: 'PUT', body: JSON.stringify({ values: [row] }) });
            else await api('/values/' + encodeURIComponent(TAB + '!A:' + colL(2 + NCOL)) + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', body: JSON.stringify({ values: [row] }) });
            seen[id] = at;
          },
          delete: async function () {
            var hit = (await readAll()).find(function (x) { return x.id === id && x.owner === owner; });
            if (hit) await api('/values/' + encodeURIComponent(TAB + '!A' + hit.row + ':' + colL(2 + NCOL) + hit.row) + ':clear', { method: 'POST', body: '{}' });
            delete seen[id];
          },
        };
      },
      // 다른 기기에서 고친 기록: 1분마다 확인해서 알려 준다
      onSnapshot: function (cb) {
        var tick = async function () {
          try {
            var rows = mine(await readAll()), changes = [];
            rows.forEach(function (x) { if ((seen[x.id] || 0) < x.at) { changes.push({ type: seen[x.id] ? 'modified' : 'added', doc: docOf(x) }); seen[x.id] = x.at; } });
            if (changes.length) cb({ docChanges: function () { return changes; } });
          } catch (e) { /* 다음에 다시 */ }
        };
        var t = setInterval(tick, 60000);
        return function () { clearInterval(t); };
      },
    };
    return col;
  }
  var db = DB_SHEET ? { collection: collection } : null;
  var user = { id: async function () { return (app && app.AppAuth.email()) || ''; } };

  window.claude = {
    use: async function (name) {
      if (name === 'mcp') return mcp;
      if (name === 'sample') return makeSample();
      if (name === 'downloads') return downloads;
      if (name === 'db') return db;
      if (name === 'user') return (app && app.AppAuth.email()) ? user : null;
      return null;
    },
  };
  // 업무판 화면끼리 오가는 링크는 새 창 대신 같은 칸에서 (구글 시트 같은 바깥 주소는 그대로 새 창)
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[target="_blank"]');
    if (!a) return;
    try { var u = new URL(a.href, location.href); if (u.origin === location.origin && /\/emp\//.test(u.pathname)) a.target = '_self'; } catch (err) { /* 그대로 */ }
  }, true);
})();
