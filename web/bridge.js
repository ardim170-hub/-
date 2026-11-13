/* 앱(Firebase) 버전에서 구글 시트와 이어 주는 통로.
 * 지금 사이트(구글 Apps Script 웹 앱)에서는 화면이 google.script.run 으로 서버 함수(api_load 등)를 부른다.
 * 앱 버전은 구글 주소 밖에서 열리므로, 구글 계정으로 로그인해 받은 출입증(토큰)으로
 * Apps Script API(scripts.run)를 통해 '같은 서버 함수'를 부른다. 그래서 화면 코드는 하나도 바꾸지 않는다.
 * 권한은 지금과 같다: 서버 함수는 로그인한 사람의 계정으로 돌고, 시트를 공유받지 않은 사람은 데이터를 못 본다. */
(function () {
  var C = window.APP_CONFIG || {};
  var TOKEN_KEY = 'ardim.app.token', HINT_KEY = 'ardim.app.email', RET_KEY = 'ardim.app.ret', STATE_KEY = 'ardim.app.state', RUN_KEY = 'ardim.app.runId';
  // 서버(Code.gs)가 쓰는 구글 서비스: 시트·드라이브(백업)·캘린더·메일(아침 알림)·외부 주소 찾기·자동 실행 예약·내 메일 주소
  var SCOPES = C.scopes || [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/script.send_mail',
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/userinfo.email',
  ];
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  var ss = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  var configured = !!(C.clientId && (C.scriptId || C.deployId));
  var KEEP_KEY = 'ardim.app.keep';
  window.APP_MODE = 'app';
  /** 로그인 상태 유지: 켜 두면 출입증을 이 기기에 두고(앱을 닫아도 유지), 1시간마다 자동으로 새로 받는다.
   *  끄면 앱(창)을 닫을 때 로그아웃된다. 처음엔 켜짐 */
  function keep() { return ls.get(KEEP_KEY) !== '0'; }
  var box = function () { return keep() ? ls : ss; };

  /* ---------- 1) 구글 로그인에서 돌아왔으면 출입증을 꺼내 저장 ---------- */
  var h = location.hash || '';
  if (/access_token=|error=/.test(h)) {
    var q = {};
    h.slice(1).split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    var okState = q.state && q.state === ss.get(STATE_KEY);
    ss.del(STATE_KEY);
    if (q.access_token && okState) {
      ls.del(TOKEN_KEY); ss.del(TOKEN_KEY);
      box().set(TOKEN_KEY, JSON.stringify({ t: q.access_token, exp: Date.now() + (Number(q.expires_in) || 3600) * 1000 - 60000 }));
    } else if (q.error) {
      window.__loginError = q.error === 'access_denied' ? '로그인 화면에서 "허용"을 누르지 않아 로그인하지 못했어요. 다시 눌러 모두 허용해 주세요.'
        : q.error === 'interaction_required' || q.error === 'login_required' ? '' : '구글 로그인 오류: ' + q.error;
      if (q.error === 'interaction_required' || q.error === 'login_required') ls.set('ardim.app.needClick', '1');
    }
    var ret = ss.get(RET_KEY) || '#/';
    ss.del(RET_KEY);
    history.replaceState(null, '', location.pathname + location.search + (ret === '#/' ? '' : ret));
  }

  function tokenInfo() {
    try { return JSON.parse(ls.get(TOKEN_KEY) || ss.get(TOKEN_KEY) || 'null'); } catch (e) { return null; }
  }
  function token() { var o = tokenInfo(); return o && o.exp > Date.now() ? o.t : ''; }
  /** 구글 확인 화면으로 갔다가 이 주소로 돌아온다 (지금 보던 화면은 기억해 둔다).
   *  이미 허용했고 구글에 로그인돼 있으면 사람이 누를 것 없이 바로 돌아온다 */
  function login(choose, silent) {
    var st = Math.random().toString(36).slice(2) + Date.now().toString(36);
    ss.set(STATE_KEY, st);
    ss.set(RET_KEY, location.hash || '#/');
    var p = {
      client_id: C.clientId,
      redirect_uri: location.origin + location.pathname.replace(/index\.html$/, ''),
      response_type: 'token',
      scope: SCOPES.join(' '),
      include_granted_scopes: 'true',
      state: st,
    };
    if (C.domain) p.hd = C.domain; // 복지관 계정만 고를 수 있게
    var hint = ls.get(HINT_KEY);
    if (choose) p.prompt = 'select_account';
    else if (hint) p.login_hint = hint;
    if (silent) splash('로그인 확인 중…');
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + Object.keys(p).map(function (k) { return k + '=' + encodeURIComponent(p[k]); }).join('&');
  }
  function logout() {
    var t = token();
    ls.del(TOKEN_KEY); ss.del(TOKEN_KEY); ls.del(HINT_KEY); ls.del(RUN_KEY);
    if (t) { try { fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t), { method: 'POST' }); } catch (e) {} }
    // 이 기기에 저장해 둔 데이터(빠른 시작용)도 지운다
    Promise.resolve(window.S && S.clearCache ? S.clearCache() : null).then(function () { location.replace(location.pathname); });
  }
  window.AppAuth = { login: login, logout: logout, token: token, keep: keep, email: function () { return ls.get(HINT_KEY) || ''; } };

  /* ---------- 2) 로그인 화면 (앱 첫 화면) ---------- */
  var gateShown = false;
  function gate(html, cls) {
    gateShown = true;
    var show = function () {
      var d = document.getElementById('appGate');
      if (!d) { d = document.createElement('div'); d.id = 'appGate'; document.body.appendChild(d); }
      d.className = 'app-gate' + (cls ? ' ' + cls : '');
      d.innerHTML = '<div class="app-gate-box">' + html + '</div>';
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }
  var esc = function (s) { return String(s || '').replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); };
  function splash(msg) {
    gate('<img class="app-gate-logo" src="icons/icon-192.png" alt="" width="88" height="88"><h1>아르딤 직업지원팀</h1><p class="app-gate-wait"><span class="app-spin" aria-hidden="true"></span>' + esc(msg) + '</p>', 'splash');
  }
  var G_ICON = '<svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-3.9 7-9.7 7-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
  function loginGate() {
    var hint = ls.get(HINT_KEY);
    gate('<img class="app-gate-logo" src="icons/icon-192.png" alt="" width="88" height="88">' +
      '<h1>아르딤 직업지원팀</h1><p class="app-gate-sub">화성시 아르딤복지관 직업지원팀 업무 앱</p>' +
      (window.__loginError ? '<p class="app-gate-err">' + esc(window.__loginError) + '</p>' : '') +
      '<button type="button" class="app-gate-google" id="appLoginBtn">' + G_ICON + '<span>' + (hint ? esc(hint) + '(으)로 계속' : 'Google 계정으로 로그인') + '</span></button>' +
      '<label class="app-gate-keep"><input type="checkbox" id="appKeep" ' + (keep() ? 'checked' : '') + '> 로그인 상태 유지</label>' +
      (hint ? '<button type="button" class="app-gate-link" id="appOtherAcc">다른 계정으로 로그인</button>' : '') +
      '<p class="app-gate-note">복지관 구글 계정' + (C.domain ? '(@' + esc(C.domain) + ')' : '') + '으로 로그인해요.<br>비밀번호는 구글 화면에서만 넣고, 이 앱에는 저장되지 않아요.<br>로그인 상태 유지를 켜 두면 다음부터는 바로 열려요.</p>');
    document.addEventListener('click', function (e) {
      var id = e.target && e.target.closest && (e.target.closest('#appLoginBtn') ? 'go' : e.target.closest('#appOtherAcc') ? 'other' : '');
      if (!id) return;
      var k = document.getElementById('appKeep');
      ls.set(KEEP_KEY, k && !k.checked ? '0' : '1');
      ls.del('ardim.app.needClick');
      login(id === 'other');
    });
  }

  var expiredShown = false;
  function needLogin() {
    // 쓰는 도중 출입증이 끝났는데 입력 중이면: 고치던 내용은 그대로 두고, 위에 '다시 확인' 띠를 띄운다
    if (expiredShown || gateShown) return;
    expiredShown = true;
    var bar = document.createElement('div');
    bar.className = 'app-relogin';
    bar.innerHTML = '<span>로그인을 다시 확인해야 해요. 입력한 기록은 이 기기에 보관돼 있고, 확인하면 이어서 저장돼요.</span> <button type="button" class="btn btn-sm btn-primary">확인하기</button>';
    bar.querySelector('button').onclick = function () { login(false, true); };
    document.body.appendChild(bar);
  }
  /** 지금 무언가 입력 중인가 (그때는 화면을 옮기지 않는다) */
  function busy() {
    var a = document.activeElement;
    return !!(document.querySelector('#drawer.open, .modal.open, .modal-back') || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'fmQ'));
  }
  /** 로그인 유지: 출입증이 곧 끝나면 입력 중이 아닐 때 조용히 새로 받는다 (구글이 1시간짜리만 주기 때문) */
  function refreshCheck() {
    if (!configured || gateShown || document.visibilityState !== 'visible') return;
    var o = tokenInfo(), left = o ? o.exp - Date.now() : -1;
    if (left > 5 * 60000) return;
    if (!keep() || !ls.get(HINT_KEY)) { if (left <= 0) needLogin(); return; }
    if (!busy()) login(false, true); else if (left <= 0) needLogin();
  }

  if (!configured) {
    gate('<h1>앱 설정이 아직 안 됐어요</h1><p>web/config.js 에 구글 클라우드 OAuth 클라이언트 ID와 Apps Script 스크립트 ID를 넣어야 해요.</p><p class="sub">설치 안내: docs/앱_설치_안내.md</p>');
  } else if (!token()) {
    // 로그인 유지를 켜 둔 기기면 버튼 없이 바로 확인 (이미 허용했으면 잠깐 로고가 보였다가 열려요)
    if (keep() && ls.get(HINT_KEY) && !window.__loginError && !ls.get('ardim.app.needClick')) login(false, true); else loginGate();
  }
  document.addEventListener('visibilitychange', refreshCheck);
  setInterval(refreshCheck, 30000);

  /* ---------- 3) google.script.run 대신 Apps Script API로 서버 함수 부르기 ---------- */
  var ids = [ls.get(RUN_KEY), C.deployId, C.scriptId].filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  function post(id, fn, args, t) {
    return fetch('https://script.googleapis.com/v1/scripts/' + encodeURIComponent(id) + ':run', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'function': fn, parameters: args, devMode: false }),
    });
  }
  function exec(fn, args) {
    var t = token();
    if (!configured) return Promise.reject(new Error('앱 설정(web/config.js)이 비어 있어요.'));
    if (!t) { needLogin(); return Promise.reject(new Error('로그인이 필요해요.')); }
    while (args.length && args[args.length - 1] === undefined) args.pop();
    args = args.map(function (a) { return a === undefined ? null : a; });
    var k = 0;
    var tryNext = function () {
      var id = ids[k];
      return post(id, fn, args, t).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (res.status === 401) { ls.del(TOKEN_KEY); ss.del(TOKEN_KEY); needLogin(); throw new Error('로그인 시간이 끝났어요. 다시 로그인해 주세요.'); }
          if (res.status === 404 && k < ids.length - 1) { k++; return tryNext(); }
          if (j && j.error) {
            var d = (j.error.details || [])[0] || {};
            var msg = d.errorMessage || j.error.message || ('오류 ' + res.status);
            if (/has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) msg = '구글 클라우드에서 Apps Script API가 꺼져 있어요. 설치 안내의 2단계를 확인해 주세요. (' + msg + ')';
            else if (/insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(msg)) { ls.del(TOKEN_KEY); ss.del(TOKEN_KEY); msg = '로그인할 때 허용하지 않은 항목이 있어요. 다시 로그인해서 모두 허용해 주세요.'; needLogin(); }
            else if (res.status === 404) msg = '서버 함수를 찾지 못했어요. Apps Script에서 "API 실행 파일"로 배포했는지, 스크립트 ID가 맞는지 확인해 주세요. (' + fn + ')';
            else if (res.status === 403 && !d.errorMessage) msg = '이 계정으로는 서버를 실행할 수 없어요: ' + msg;
            var err = new Error(msg); err.name = d.errorType || 'ScriptError';
            throw err;
          }
          if (!res.ok) throw new Error('서버 연결 오류 (' + res.status + ')');
          if (ids[k] !== ls.get(RUN_KEY)) ls.set(RUN_KEY, ids[k]);
          var r = j.response ? j.response.result : undefined;
          // 내 계정 메일은 다음 로그인 때 계정 고르기를 건너뛰는 데 쓴다
          if (fn === 'api_load' && r && r.access && r.access.me) ls.set(HINT_KEY, r.access.me);
          return r;
        });
      });
    };
    return tryNext().catch(function (e) {
      if (e instanceof TypeError) throw new Error('인터넷에 연결되지 않았어요.');
      throw e;
    });
  }
  function runner(ok, fail) {
    return new Proxy({}, {
      get: function (_, name) {
        if (name === 'withSuccessHandler') return function (f) { return runner(f, fail); };
        if (name === 'withFailureHandler') return function (f) { return runner(ok, f); };
        if (name === 'withUserObject') return function () { return runner(ok, fail); };
        if (typeof name !== 'string') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          exec(name, args).then(function (r) { ok && ok(r); }, function (e) { if (fail) fail(e); else console.error(e); });
        };
      },
    });
  }
  window.google = window.google || {};
  window.google.script = { run: runner(null, null) };

  /* ---------- 4) 휴대폰에 화면 저장 (앱 설치·빠른 실행) ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').then(function (r) { r.update(); }).catch(function () {}); });
    // 새 버전을 받아 두었으면 알려 준다 (누르면 바로 적용, 안 눌러도 다음에 열 때 적용)
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (!e.data || e.data.type !== 'app-updated' || document.getElementById('appUpd')) return;
      var b = document.createElement('button');
      b.id = 'appUpd'; b.type = 'button'; b.className = 'app-upd';
      b.textContent = '✨ 새 버전이 있어요 · 눌러서 적용';
      b.onclick = function () { location.reload(); };
      document.body.appendChild(b);
    });
  }
  // 설치 버튼: 안드로이드 크롬은 설치 가능할 때 알려 준다 → 화면 위쪽 '앱 설치' 버튼으로 보여 준다
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    if (document.getElementById('appInstall')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'appInstall'; b.className = 'btn btn-primary app-install';
    b.textContent = '📲 앱으로 설치';
    b.onclick = function () { e.prompt(); e.userChoice.finally(function () { b.remove(); }); };
    document.body.appendChild(b);
  });
  window.addEventListener('appinstalled', function () { var b = document.getElementById('appInstall'); if (b) b.remove(); });
})();
