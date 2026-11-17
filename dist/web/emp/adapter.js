/* 고용지원 업무판 → 아르딤 앱 연결 파일
 * 업무판 화면들은 원래 claude.ai 안에서 window.claude.use("mcp"|"sample"|"downloads")로
 * 구글 시트 읽기·쓰기, AI 초안, 파일 내려받기를 했다. 아르딤 앱(ardim-jobs.web.app) 안에서는 이 파일이 대신한다.
 *   - mcp(Google Sheets)  → 앱에 로그인한 구글 계정의 출입증으로 Google Sheets API(v4) 직접 호출
 *   - sample(AI 초안)     → 앱의 AI 도우미(Apps Script 서버가 AI 키로 대신 호출, 키는 브라우저에 없음)
 *   - downloads(내려받기) → 브라우저 다운로드 (.hwpx.zip 이름은 .hwpx로 바꿔 바로 한글에서 열리게)
 * 앱 화면(고용공단 → 고용지원 업무판) 안에서 열린다. 따로 연 창에서도 로그인 정보가 있으면 시트는 쓸 수 있다(AI는 앱 안에서만). */
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
    return {
      json: async function (prompt, opts) {
        var complex = opts && opts.modelTier === 'complex';
        var msg = await app.AI.run({ max_tokens: complex ? 8000 : 4000, messages: [{ role: 'user', content: String(prompt) + '\n\n답은 JSON 값 하나만 주세요. 설명이나 ``` 표시는 붙이지 마세요.' }] });
        return pickJson(app.AI.textOf(msg));
      },
    };
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
  window.claude = {
    use: async function (name) {
      if (name === 'mcp') return mcp;
      if (name === 'sample') return makeSample();
      if (name === 'downloads') return downloads;
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
