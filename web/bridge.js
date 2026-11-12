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
  window.APP_MODE = 'app';

  /* ---------- 1) 구글 로그인에서 돌아왔으면 출입증을 꺼내 저장 ---------- */
  var h = location.hash || '';
  if (/access_token=|error=/.test(h)) {
    var q = {};
    h.slice(1).split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    var okState = q.state && q.state === ss.get(STATE_KEY);
    ss.del(STATE_KEY);
    if (q.access_token && okState) {
      ls.set(TOKEN_KEY, JSON.stringify({ t: q.access_token, exp: Date.now() + (Number(q.expires_in) || 3600) * 1000 - 60000 }));
    } else if (q.error) {
      window.__loginError = q.error === 'access_denied' ? '구글 로그인에서 허용을 누르지 않았어요.' : '구글 로그인 오류: ' + q.error;
    }
    var ret = ss.get(RET_KEY) || '#/dashboard';
    ss.del(RET_KEY);
    history.replaceState(null, '', location.pathname + location.search + ret);
  }

  function token() {
    try { var o = JSON.parse(ls.get(TOKEN_KEY) || 'null'); return o && o.exp > Date.now() ? o.t : ''; } catch (e) { return ''; }
  }
  /** 구글 로그인 화면으로 갔다가 이 주소로 돌아온다 (지금 보던 화면은 기억해 둔다) */
  function login(choose) {
    var st = Math.random().toString(36).slice(2) + Date.now().toString(36);
    ss.set(STATE_KEY, st);
    ss.set(RET_KEY, /access_token=/.test(location.hash) ? '#/dashboard' : (location.hash || '#/dashboard'));
    var p = {
      client_id: C.clientId,
      redirect_uri: location.origin + location.pathname.replace(/index\.html$/, ''),
      response_type: 'token',
      scope: SCOPES.join(' '),
      include_granted_scopes: 'true',
      state: st,
    };
    var hint = ls.get(HINT_KEY);
    if (choose) p.prompt = 'select_account';
    else if (hint) p.login_hint = hint;
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + Object.keys(p).map(function (k) { return k + '=' + encodeURIComponent(p[k]); }).join('&');
  }
  function logout() {
    var t = token();
    ls.del(TOKEN_KEY); ls.del(HINT_KEY);
    if (t) { try { fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t), { method: 'POST' }); } catch (e) {} }
    setTimeout(function () { location.reload(); }, 300);
  }
  window.AppAuth = { login: login, logout: logout, token: token, email: function () { return ls.get(HINT_KEY) || ''; } };

  /* ---------- 2) 로그인 화면 ---------- */
  var gateShown = false;
  function gate(html) {
    gateShown = true;
    var show = function () {
      var d = document.getElementById('appGate');
      if (!d) { d = document.createElement('div'); d.id = 'appGate'; d.className = 'app-gate'; document.body.appendChild(d); }
      d.innerHTML = '<div class="app-gate-box">' + html + '</div>';
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }
  function loginGate() {
    var hint = ls.get(HINT_KEY);
    gate('<img src="icons/icon-192.png" alt="" width="72" height="72"><h1>아르딤 직업지원팀</h1>' +
      (window.__loginError ? '<p class="app-gate-err">' + window.__loginError + '</p>' : '') +
      '<p>복지관 구글 계정으로 로그인하면 지금 사이트와 같은 데이터(구글 시트)를 그대로 써요.</p>' +
      '<button type="button" class="btn btn-primary app-gate-btn" id="appLoginBtn">구글 계정으로 로그인</button>' +
      (hint ? '<p class="sub">' + hint.replace(/[<>&"]/g, '') + ' · <a href="#" id="appOtherAcc">다른 계정</a></p>' : ''));
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'appLoginBtn') login(false);
      if (e.target && e.target.id === 'appOtherAcc') { e.preventDefault(); login(true); }
    });
  }

  var waiters = [];
  var expiredShown = false;
  function needLogin() {
    // 쓰는 도중 출입증(1시간)이 끝나면: 고치던 내용은 그대로 두고, 위에 '다시 로그인' 띠를 띄운다
    if (expiredShown || gateShown) return;
    expiredShown = true;
    var bar = document.createElement('div');
    bar.className = 'app-relogin';
    bar.innerHTML = '로그인 시간이 끝났어요. 입력한 기록은 이 휴대폰에 보관돼 있고, 다시 로그인하면 이어서 저장돼요. <button type="button" class="btn btn-sm btn-primary">다시 로그인</button>';
    bar.querySelector('button').onclick = function () { login(false); };
    document.body.appendChild(bar);
  }

  if (!configured) {
    gate('<h1>앱 설정이 아직 안 됐어요</h1><p>web/config.js 에 구글 클라우드 OAuth 클라이언트 ID와 Apps Script 스크립트 ID를 넣어야 해요.</p><p class="sub">설치 안내: docs/앱_설치_안내.md</p>');
  } else if (!token()) {
    // 전에 로그인했던 휴대폰이면 버튼 없이 바로 구글로 (이미 허용했으면 화면이 잠깐 깜빡이고 돌아와요)
    if (ls.get(HINT_KEY) && !window.__loginError) login(false); else loginGate();
  }
  // 앱을 한참 뒤에 다시 열었을 때: 열려 있는 입력 창이 없으면 바로 다시 로그인
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !configured || token()) return;
    if (document.querySelector('#drawer.open, .modal.open, form:focus-within')) needLogin(); else login(false);
  });

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
          if (res.status === 401) { ls.del(TOKEN_KEY); needLogin(); throw new Error('로그인 시간이 끝났어요. 다시 로그인해 주세요.'); }
          if (res.status === 404 && k < ids.length - 1) { k++; return tryNext(); }
          if (j && j.error) {
            var d = (j.error.details || [])[0] || {};
            var msg = d.errorMessage || j.error.message || ('오류 ' + res.status);
            if (/has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) msg = '구글 클라우드에서 Apps Script API가 꺼져 있어요. 설치 안내의 2단계를 확인해 주세요. (' + msg + ')';
            else if (/insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(msg)) { ls.del(TOKEN_KEY); msg = '로그인할 때 허용하지 않은 항목이 있어요. 다시 로그인해서 모두 허용해 주세요.'; needLogin(); }
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
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
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
