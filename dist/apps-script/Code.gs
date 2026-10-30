/**
 * 아르딤 취업지원 CRM - 팀 공유용 구글 Apps Script 서버
 *
 * 이 스크립트는 구글 시트에 연결(확장 프로그램 > Apps Script)해서 씁니다.
 * 데이터는 모두 이 스프레드시트의 시트(사업체, 네트워크, 명함, 활동기록, 일정, 직원, 설정, 명함사진)에 저장됩니다.
 * 웹 앱 배포 시 "다음 사용자 인증 정보로 실행: 웹 앱에 액세스하는 사용자"로 두면
 * 이 스프레드시트를 공유받은 사람만 사용할 수 있습니다.

 */

var SETTINGS_SHEET = '설정';
var PHOTO_SHEET = '명함사진';
var PHOTO_CHUNK = 45000; // 셀 하나에 5만 자까지 들어가므로 나눠 저장

/* ---------- 화면 파일 자동 업데이트 ----------
 * 화면 파일(index·style·app1~app3)은 GitHub 저장소의 live 갈래에서 가져온다.
 * 새 버전을 올리면 10분 안에 모든 컴퓨터에 반영되고, 여기에 다시 붙여넣거나 새 버전 배포를 하지 않아도 된다.
 * 가져오지 못하면(인터넷·GitHub 문제) 이 프로젝트 안에 있는 파일로 연다. 주소 끝에 ?local=1 을 붙이면 늘 안의 파일로 연다.
 * 바로 반영하고 싶으면 편집기에서 clearUpdateCache 를 한 번 실행한다. */
var UPDATE_ON = true; // true = GitHub live 갈래에서 화면 파일을 받아 옴 (false = 이 프로젝트에 붙여 넣은 파일로만 연다)
var UPDATE_BASE = 'https://raw.githubusercontent.com/ardim170-hub/-/live/dist/apps-script/';
var UPDATE_FILES = ['index', 'style', 'app1', 'app2', 'app3'];
var UPDATE_TTL = 600; // 초 (10분)
var UPDATE_CHUNK = 25000; // 캐시 한 칸 100KB 제한 → 한글 3바이트 기준으로 나눠 담는다
var remoteFiles_ = null; // 이번 요청에서 쓸 파일들 (null = 안의 파일)

function doGet(e) {
  remoteFiles_ = !UPDATE_ON || (e && e.parameter && e.parameter.local === '1') ? null : loadRemote_();
  // 화면 파일은 1MB 제한 때문에 index(뼈대) + style + app1~app3 으로 나눠 두고 여기서 합친다
  var out = null;
  if (remoteFiles_) {
    try { out = HtmlService.createTemplate(remoteFiles_.index).evaluate(); }
    catch (err) { console.warn('GitHub 화면 파일로 열지 못해 안의 파일로 엽니다: ' + err); remoteFiles_ = null; }
  }
  if (!out) out = HtmlService.createTemplateFromFile('index').evaluate();
  return out
    .setTitle('화성시 아르딤복지관 직업지원팀')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    // 탭 아이콘: 복지관 로고 심볼 (GitHub 공개 저장소의 assets/favicon.png, 바뀌지 않게 커밋 주소로 고정)
    .setFaviconUrl('https://raw.githubusercontent.com/ardim170-hub/-/183ba21486d494520e3107fe6c996c1eb6ba4c14/assets/favicon.png');
}

/** index.html 안의 <?!= include('style'); ?> 자리에 그 파일 내용을 그대로 넣는다 */
function include(name) {
  if (remoteFiles_ && remoteFiles_[name]) return wrapRemote_(remoteFiles_[name]);
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** GitHub에서 받은 파일은 구글이 화면을 내보낼 때 주석을 지우면서 코드를 망가뜨릴 수 있어서,
 * 글자를 base64로 감싸 보내고 브라우저에서 풀어 그 자리에 넣는다 */
function wrapRemote_(text) {
  var b = Utilities.base64EncodeWebSafe(text, Utilities.Charset.UTF_8);
  return '<script>(function(b){var s=document.currentScript,t=atob(b.split("-").join("+").split("_").join("/")),u=new Uint8Array(t.length);' +
    'for(var i=0;i<t.length;i++)u[i]=t.charCodeAt(i);' +
    's.parentNode.insertBefore(document.createRange().createContextualFragment(new TextDecoder("utf-8").decode(u)),s);})("' + b + '");</script>';
}

/** GitHub의 최신 화면 파일 5개 (캐시 10분). 하나라도 못 받으면 섞이지 않게 전부 안의 파일로 */
function loadRemote_() {
  var cache = CacheService.getScriptCache();
  try {
    var meta = cache.get('upd:meta');
    if (meta) {
      var m = JSON.parse(meta), keys = [];
      UPDATE_FILES.forEach(function (f) { for (var i = 0; i < m[f]; i++) keys.push('upd:' + f + ':' + i); });
      var got = cache.getAll(keys), out = {}, ok = true;
      UPDATE_FILES.forEach(function (f) {
        var parts = [];
        for (var i = 0; i < m[f]; i++) { var v = got['upd:' + f + ':' + i]; if (v == null) { ok = false; return; } parts.push(v); }
        out[f] = parts.join('');
      });
      if (ok) return out;
    }
    var res = UrlFetchApp.fetchAll(UPDATE_FILES.map(function (f) { return { url: UPDATE_BASE + f + '.html?t=' + Math.floor(Date.now() / (UPDATE_TTL * 1000)), muteHttpExceptions: true }; }));
    var files = {};
    for (var k = 0; k < res.length; k++) {
      if (res[k].getResponseCode() !== 200) return null;
      var text = res[k].getContentText('UTF-8');
      if (text.length < 200) return null;
      files[UPDATE_FILES[k]] = text;
    }
    if (files.index.indexOf("include('app3')") < 0) return null; // 뼈대가 이상하면 쓰지 않는다
    var put = {}, counts = {};
    UPDATE_FILES.forEach(function (f) {
      var t = files[f], n = Math.ceil(t.length / UPDATE_CHUNK);
      counts[f] = n;
      for (var i = 0; i < n; i++) put['upd:' + f + ':' + i] = t.slice(i * UPDATE_CHUNK, (i + 1) * UPDATE_CHUNK);
    });
    try { cache.putAll(put, UPDATE_TTL); cache.put('upd:meta', JSON.stringify(counts), UPDATE_TTL - 5); } catch (e) { /* 캐시가 가득 차도 이번엔 그대로 쓴다 */ }
    return files;
  } catch (err) {
    return null;
  }
}

/** 편집기에서 실행: 자동 업데이트가 되는지 단계별로 실행 로그에 적는다 */
function checkUpdate() {
  clearUpdateCache();
  var t0 = Date.now(), files = loadRemote_();
  if (!files) { Logger.log('GitHub에서 화면 파일을 받지 못했어요. 사이트는 이 프로젝트 안의 파일로 열려요.'); return; }
  UPDATE_FILES.forEach(function (f) { Logger.log(f + '.html: ' + files[f].length + '자'); });
  Logger.log('받기 ' + (Date.now() - t0) + 'ms · 캐시 ' + (CacheService.getScriptCache().get('upd:meta') ? '저장됨' : '저장 안 됨(매번 새로 받음)'));
  remoteFiles_ = files;
  var html = HtmlService.createTemplate(files.index).evaluate().getContent();
  Logger.log('화면 만들기 성공: ' + html.length + '자. 사이트를 새로고침해 보세요.');
}

/** 편집기에서 실행: 다음에 열 때 GitHub에서 바로 새로 받는다 */
function clearUpdateCache() {
  var cache = CacheService.getScriptCache(), keys = ['upd:meta'];
  UPDATE_FILES.forEach(function (f) { for (var i = 0; i < 40; i++) keys.push('upd:' + f + ':' + i); });
  cache.removeAll(keys);
  Logger.log('업데이트 캐시를 비웠어요. 사이트를 새로고침하면 최신 화면 파일을 받아와요.');
}

function book_() {
  return SpreadsheetApp.getActive();
}

/** 시트가 없으면 만들고, 없는 열 제목은 오른쪽에 추가한다. 모든 칸은 텍스트 형식(날짜·전화번호 자동 변환 방지). */
function ensureSheet_(name, headers) {
  var ss = book_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var need = headers ? headers.length : 1;
    if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');
  }
  if (headers && headers.length) {
    var lastCol = sh.getLastColumn();
    var cur = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    var missing = headers.filter(function (h) { return cur.indexOf(h) < 0; });
    if (missing.length) {
      if (sh.getMaxColumns() < cur.length + missing.length) sh.insertColumnsAfter(sh.getMaxColumns(), cur.length + missing.length - sh.getMaxColumns());
      sh.getRange(1, cur.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold').setBackground('#EEF2F7');
      sh.getRange(1, cur.length + 1, sh.getMaxRows(), missing.length).setNumberFormat('@');
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function headers_(sh) {
  var lastCol = sh.getLastColumn();
  return lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
}

function readSheet_(name) {
  var sh = book_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
  var head = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    if (values[r].join('') === '') continue;
    var o = {};
    for (var c = 0; c < head.length; c++) if (head[c]) o[head[c]] = values[r][c];
    out.push(o);
  }
  return out;
}

function readSettings_() {
  var o = {};
  readSheet_(SETTINGS_SHEET).forEach(function (r) { if (r['항목']) o[r['항목']] = r['값']; });
  return o;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- 사용 권한 ----------
 * 관리자: 이 스프레드시트 소유자 + 설정 시트 'admins'에 적힌 이메일.
 *   설정·직원 목록·AI 키·전체 교체는 관리자만 할 수 있다.
 * 사용자 명단: 설정 시트 'members'에 이메일이 있으면 그 사람(과 관리자)만 사이트를 쓸 수 있다. 비어 있으면 제한 없음.
 */
var DATA_LOCKED = [SETTINGS_SHEET, '직원', PHOTO_SHEET]; // api_apply로 직접 쓸 수 없는 시트

function me_() {
  try { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
}
function owner_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('owner');
  if (hit != null) return hit;
  var email = '';
  try { var o = book_().getOwner(); email = o ? String(o.getEmail() || '').toLowerCase() : ''; } catch (e) { email = ''; }
  cache.put('owner', email, 21600);
  return email;
}
function emails_(s) {
  return String(s || '').toLowerCase().split(/[\s,;]+/).filter(function (x) { return x.indexOf('@') > 0; });
}
function access_() {
  var st = readSettings_();
  var me = me_();
  var admins = emails_(st.admins);
  var owner = owner_();
  if (owner) admins.push(owner);
  var members = emails_(st.members);
  // 소유자도 관리자 명단도 알 수 없으면 잠기지 않도록 모두 관리자로 둔다
  var admin = admins.length ? (!!me && admins.indexOf(me) >= 0) : true;
  var allowed = admin || !members.length || (!!me && members.indexOf(me) >= 0);
  var perms = {};
  if (!admin && me) { try { perms = (JSON.parse(st.perms || '{}') || {})[me] || {}; } catch (e) { perms = {}; } }
  return { me: me, owner: owner, admin: admin, allowed: allowed, perms: perms };
}

/* ---------- 메뉴별 권한 ----------
 * 설정 시트 'perms' = { 이메일: { biz: 'none'|'view'|'edit'|'full', ... } }. 정하지 않은 메뉴는 'full'(전부 허용). 관리자는 늘 'full'. */
var PERM_RANK = { none: 0, view: 1, edit: 2, full: 3 };
var SHEET_MENU = { '사업체': ['biz'], '네트워크': ['network'], '명함': ['cards'], '일정': ['schedule'], '실적입력': ['perf'], '출장특근': ['orders'], '활동기록': ['biz', 'network', 'contacts'], '일자리참여자': ['attend'], '출석부': ['attend'], '훈련일정': ['schedule'] };
function level_(acc, menu) {
  if (acc.admin) return 3;
  var v = acc.perms && acc.perms[menu];
  return PERM_RANK[v] == null ? 3 : PERM_RANK[v];
}
function requirePerm_(acc, sheet, need) {
  var menus = SHEET_MENU[sheet];
  if (!menus) return;
  var ok = menus.some(function (m) { return level_(acc, m) >= need; });
  if (!ok) throw new Error(sheet + ' ' + (need >= 3 ? '삭제' : '등록·수정') + ' 권한이 없습니다. 관리자에게 권한을 요청하세요.');
}
function requireMember_() {
  var a = access_();
  if (!a.allowed) throw new Error('이 사이트를 쓸 권한이 없습니다. 관리자에게 ' + (a.me || '내 구글 계정') + ' 을(를) 사용자 명단에 넣어 달라고 요청하세요.');
  return a;
}
function requireAdmin_() {
  var a = requireMember_();
  if (!a.admin) throw new Error('설정은 관리자만 바꿀 수 있습니다.');
  return a;
}

/** 전체 데이터 읽기. schema = { 시트이름: [열 제목...] } */
/** 현재 접속자: 화면이 1분마다 알려 오고, 2분 안에 알려 온 사람만 보여 준다 (구글 캐시에 잠깐 보관) */
function api_presence(info) {
  var acc = requireMember_();
  info = info || {};
  var cache = CacheService.getScriptCache();
  var list = {};
  try { list = JSON.parse(cache.get('presence') || '{}') || {}; } catch (e) { list = {}; }
  var now = Date.now();
  var key = acc.me || ('익명-' + String(info.id || '').slice(0, 8));
  list[key] = { email: acc.me || '', name: String(info.name || '').slice(0, 20), page: String(info.page || '').slice(0, 20), at: now };
  Object.keys(list).forEach(function (k) { if (now - list[k].at > 120000) delete list[k]; });
  cache.put('presence', JSON.stringify(list), 600);
  return Object.keys(list).map(function (k) { return list[k]; });
}

function api_load(schema) {
  var acc = requireMember_();
  return withLock_(function () {
    var sheets = {};
    Object.keys(schema || {}).forEach(function (name) {
      ensureSheet_(name, schema[name]);
      sheets[name] = readSheet_(name);
    });
    ensureSheet_(SETTINGS_SHEET, ['항목', '값']);
    var settings = readSettings_();
    if (!acc.admin) { delete settings.admins; delete settings.members; delete settings.perms; }
    // 숨김 메뉴의 시트는 아예 보내지 않는다
    Object.keys(SHEET_MENU).forEach(function (name) { if (sheets[name] && name !== '활동기록' && !SHEET_MENU[name].some(function (m) { return level_(acc, m) >= 1; })) sheets[name] = []; });
    return { sheets: sheets, settings: settings, ai: !!aiKey_(), access: { me: acc.me, owner: acc.owner, admin: acc.admin, perms: acc.perms } };
  });
}

/** 여러 건 저장·삭제. ops = [{ sheet, op: 'put'|'del', id, row: { 열 제목: 값 } }] */
function api_apply(ops) {
  var acc = requireMember_();
  (ops || []).forEach(function (o) {
    if (DATA_LOCKED.indexOf(o.sheet) >= 0) throw new Error(o.sheet + ' 시트는 데이터 관리 화면에서만 바꿀 수 있습니다.');
    // 사업체·기관을 지우거나 합칠 때 명함의 연결만 바꾸는 것은 명함 권한이 없어도 허용 (연결 칸만 쓴다)
    if (o.sheet === '명함' && o.op !== 'del' && level_(acc, 'cards') < 2 && (level_(acc, 'biz') >= 2 || level_(acc, 'network') >= 2)) {
      o.row = { '명함ID': o.row && o.row['명함ID'], '연결 구분(biz/net)': o.row && o.row['연결 구분(biz/net)'], '연결ID': o.row && o.row['연결ID'] };
      o.linkOnly = true; // 있는 명함의 연결만 바꾼다. 새 명함은 만들지 않는다
      return;
    }
    // 연락이력에서 처음 보는 사업체명을 쓰면 사업체도 새로 만든다 (연락이력 등록 권한으로 허용, 삭제는 안 됨)
    if (o.sheet === '사업체' && o.op !== 'del' && level_(acc, 'contacts') >= 2) return;
    requirePerm_(acc, o.sheet, o.op === 'del' ? 3 : 2);
  });
  return withLock_(function () {
    var bySheet = writeOps_(ops);
    // 일정은 연결한 구글 캘린더에도 반영 (실패해도 시트 저장은 그대로)
    var calErr = bySheet['일정'] ? calApply_(bySheet['일정']) : '';
    return { ok: true, at: new Date().toISOString(), calErr: calErr };
  });
}
/** 저장 점검: 시트마다 시험 줄을 쓰고, 다시 읽고, 지운다. 어느 시트가 왜 안 되는지 돌려준다 */
function api_selfTest() {
  var acc = requireMember_();
  var out = [];
  Object.keys(SHEET_MENU).forEach(function (name) {
    var t0 = Date.now(), id = 'TEST_' + t0;
    var canWrite = SHEET_MENU[name].some(function (m) { return level_(acc, m) >= 2; }) || (name === '사업체' && level_(acc, 'contacts') >= 2);
    if (!canWrite) { out.push({ sheet: name, ok: null, msg: '이 계정은 등록 권한이 없어 점검하지 않음' }); return; }
    try {
      var sh = book_().getSheetByName(name);
      if (!sh || !sh.getLastColumn()) { out.push({ sheet: name, ok: true, msg: '아직 기록이 없어요 (첫 기록 때 시트가 자동으로 생겨요)' }); return; }
      withLock_(function () {
        var h = headers_(sh)[0], row = {}, found = false; row[h] = id;
        try {
          writeOps_([{ sheet: name, op: 'put', id: id, row: row }]);
          if (SpreadsheetApp.flush) SpreadsheetApp.flush();
          var last = sh.getLastRow();
          found = last > 1 && sh.getRange(2, 1, last - 1, 1).getDisplayValues().some(function (r) { return r[0] === id; });
        } finally { writeOps_([{ sheet: name, op: 'del', id: id }]); } // 시험 줄은 꼭 지운다
        out.push({ sheet: name, ok: found, msg: found ? '쓰기·읽기·지우기 정상 (' + (Date.now() - t0) + 'ms)' : '쓴 줄을 다시 찾지 못했어요. 첫 열이 ID 열인지 확인하세요.' });
      });
    } catch (e) { out.push({ sheet: name, ok: false, msg: String(e && e.message || e) }); }
  });
  return { me: acc.me, admin: acc.admin, at: new Date().toISOString(), sheets: out };
}

/** 시트에 줄 저장·삭제 (잠금 안에서 부른다). 시트별로 묶은 ops를 돌려준다 */
function writeOps_(ops) {
    var bySheet = {};
    (ops || []).forEach(function (o) { (bySheet[o.sheet] = bySheet[o.sheet] || []).push(o); });
    Object.keys(bySheet).forEach(function (name) {
      var list = bySheet[name];
      var heads = [];
      list.forEach(function (o) { if (o.row) Object.keys(o.row).forEach(function (h) { if (heads.indexOf(h) < 0) heads.push(h); }); });
      var sh = ensureSheet_(name, heads);
      var head = headers_(sh);
      var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return r[0]; }) : [];
      var dels = [];
      list.forEach(function (o) {
        var idx = ids.indexOf(String(o.id));
        if (o.linkOnly && idx < 0) return;
        if (o.op === 'del') {
          if (idx >= 0) { dels.push(idx + 2); ids[idx] = null; }
          return;
        }
        var rowNum;
        var line;
        if (idx >= 0) {
          rowNum = idx + 2;
          line = sh.getRange(rowNum, 1, 1, head.length).getValues()[0];
        } else {
          rowNum = sh.getLastRow() + 1;
          if (rowNum > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
          line = head.map(function () { return ''; });
          ids.push(String(o.id));
        }
        head.forEach(function (h, i) { if (o.row && Object.prototype.hasOwnProperty.call(o.row, h)) line[i] = o.row[h] == null ? '' : String(o.row[h]); });
        var range = sh.getRange(rowNum, 1, 1, head.length);
        range.setNumberFormat('@');
        range.setValues([line]);
      });
      dels.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
    });
    return bySheet;
}

/* ================= 구글 캘린더 연결 =================
 * 설정 'calId' = 팀 캘린더 ID. 사이트 일정을 추가·수정·삭제하면 그 캘린더에도 똑같이 반영한다.
 * 웹앱은 '접속한 사람' 권한으로 실행되므로, 팀 캘린더를 팀원 모두에게 '일정 변경' 권한으로 공유해 둔다.
 * 사이트 일정 ID ↔ 캘린더 일정 ID 짝은 스크립트 속성 'cal:<일정ID>'에 둔다. */
var CAL_MARK = '아르딤 취업지원 사이트에서 만든 일정 (사이트에서 고치면 여기도 바뀌어요)';
function calOf_(id) {
  id = String(id || '').trim();
  if (!id) return null;
  var cal = id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(id);
  if (!cal) throw new Error('캘린더를 찾지 못했어요. 캘린더 ID를 확인하고, 이 계정에 그 캘린더의 "일정 변경" 권한이 있는지 확인하세요.');
  return cal;
}
/** '14:00', '오후 2시', '10시 30분' → [시, 분]. 모르면 null (종일 일정) */
function calTime_(t) {
  var s = String(t || '').replace(/\s/g, '');
  var m = s.match(/(오전|오후)?(\d{1,2})(?:[:시.](\d{1,2}))?/);
  if (!m || !/\d/.test(s)) return null;
  var h = +m[2], mi = +(m[3] || 0);
  if (m[1] === '오후' && h < 12) h += 12;
  if (!m[1] && h >= 1 && h <= 7) h += 12; // 1~7시는 오후로 본다 (근무시간)
  return h <= 23 && mi <= 59 ? [h, mi] : null;
}
function calPlaces_() {
  var o = {};
  readSheet_('사업체').forEach(function (r) { o[r['사업체ID']] = { name: r['사업체명'], addr: r['주소'] }; });
  readSheet_('네트워크').forEach(function (r) { o[r['기관ID']] = { name: r['기관명'], addr: r['주소'] }; });
  return o;
}
function calPut_(cal, props, row, places) {
  var id = String(row['일정ID'] || '');
  var d = String(row['날짜'] || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!id || !d) return;
  var old = props.getProperty('cal:' + id);
  if (old) { try { var ev0 = cal.getEventById(old); if (ev0) ev0.deleteEvent(); } catch (e) { /* 이미 지워졌으면 그대로 */ } }
  var place = places[row['대상ID']] || null;
  var title = (row['완료(Y/N)'] === 'Y' ? '✔ ' : '') + (row['유형'] ? '[' + row['유형'] + '] ' : '') + (row['제목'] || '(제목 없음)') + (row['담당 직원'] ? ' · ' + row['담당 직원'] : '');
  var desc = [row['메모'], place ? '대상: ' + place.name : '', CAL_MARK].filter(function (x) { return x; }).join('\n');
  var opt = { description: desc, location: place && place.addr ? place.addr : '' };
  var tm = calTime_(row['시간']);
  var ev;
  if (tm) {
    var st = new Date(+d[1], +d[2] - 1, +d[3], tm[0], tm[1]);
    ev = cal.createEvent(title, st, new Date(st.getTime() + 60 * 60 * 1000), opt);
  } else {
    ev = cal.createAllDayEvent(title, new Date(+d[1], +d[2] - 1, +d[3]), opt);
  }
  props.setProperty('cal:' + id, ev.getId());
}
function calDel_(cal, props, id) {
  var gid = props.getProperty('cal:' + id);
  if (!gid) return;
  try { var ev = cal.getEventById(gid); if (ev) ev.deleteEvent(); } catch (e) { /* 이미 없음 */ }
  props.deleteProperty('cal:' + id);
}
/** api_apply에서 부른다. 오류는 글로 돌려준다 */
function calApply_(ops) {
  var calId = readSettings_().calId;
  if (!calId) return '';
  try {
    var cal = calOf_(calId), props = PropertiesService.getScriptProperties();
    var places = ops.some(function (o) { return o.op !== 'del'; }) ? calPlaces_() : {};
    var rows = {};
    readSheet_('일정').forEach(function (r) { rows[r['일정ID']] = r; });
    ops.forEach(function (o) { if (o.op === 'del') calDel_(cal, props, o.id); else if (rows[o.id]) calPut_(cal, props, rows[o.id], places); });
    return '';
  } catch (e) { return String(e && e.message || e); }
}
/** 연결 확인: 캘린더 이름을 돌려준다 */
function api_calCheck(calId) {
  requireAdmin_();
  var cal = calOf_(calId);
  return { name: cal.getName(), id: cal.getId() };
}
/** 지금까지의 일정(최근 90일 이후)을 캘린더에 한 번에 보낸다 */
function api_calPushAll() {
  requireAdmin_();
  var calId = readSettings_().calId;
  if (!calId) throw new Error('먼저 캘린더 ID를 넣고 저장하세요.');
  var cal = calOf_(calId), props = PropertiesService.getScriptProperties(), places = calPlaces_();
  var from = Utilities.formatDate(new Date(Date.now() - 90 * 86400000), 'Asia/Seoul', 'yyyy-MM-dd');
  var n = 0, t0 = Date.now();
  readSheet_('일정').forEach(function (r) {
    if (Date.now() - t0 > 270000) return; // 실행 시간 제한(6분) 안에서
    if (String(r['날짜']) < from) return;
    calPut_(cal, props, r, places); n++;
  });
  return { sent: n };
}

/** 전체 교체 (엑셀 가져오기, 예시 데이터, 전체 삭제). payload = { sheets: { 이름: [행] }, settings: {} } */
function api_replaceAll(payload) {
  requireAdmin_();
  return withLock_(function () {
    Object.keys(payload.sheets || {}).forEach(function (name) {
      var rows = payload.sheets[name] || [];
      var sh = book_().getSheetByName(name);
      var heads = rows.length ? Object.keys(rows[0]) : (sh ? headers_(sh) : []);
      if (sh) sh.clearContents();
      sh = ensureSheet_(name, heads);
      var head = headers_(sh);
      if (!rows.length) return;
      if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
      var data = rows.map(function (r) { return head.map(function (h) { return r[h] == null ? '' : String(r[h]); }); });
      var range = sh.getRange(2, 1, data.length, head.length);
      range.setNumberFormat('@');
      range.setValues(data);
    });
    writeSettings_(payload.settings || {});
    var ph = book_().getSheetByName(PHOTO_SHEET);
    if (ph) ph.clearContents();
    return { ok: true };
  });
}

function writeSettings_(settings) {
  var sh = ensureSheet_(SETTINGS_SHEET, ['항목', '값']);
  var cur = readSettings_();
  Object.keys(settings).forEach(function (k) { cur[k] = settings[k]; });
  var rows = Object.keys(cur).map(function (k) { return [k, cur[k] == null ? '' : String(cur[k])]; });
  sh.clearContents();
  sh.getRange(1, 1, 1, 2).setValues([['항목', '값']]).setFontWeight('bold');
  if (rows.length) { sh.getRange(2, 1, rows.length, 2).setNumberFormat('@'); sh.getRange(2, 1, rows.length, 2).setValues(rows); }
}

/** 설정과 직원 목록 저장. staffRows = [{ 이름, 소속 사업 }] */
function api_saveSettings(settings, staffRows) {
  var acc = requireAdmin_();
  settings = settings || {};
  // 관리자 명단을 바꿀 때 저장하는 사람은 늘 관리자로 남긴다 (소유자를 못 읽는 경우에도 잠기지 않게)
  if (Object.prototype.hasOwnProperty.call(settings, 'admins') && acc.me && acc.me !== acc.owner) {
    var list = emails_(settings.admins);
    if (list.indexOf(acc.me) < 0) { list.push(acc.me); settings.admins = list.join(','); }
    var mem = emails_(settings.members);
    if (mem.length && mem.indexOf(acc.me) < 0) { mem.push(acc.me); settings.members = mem.join(','); }
  }
  return withLock_(function () {
    writeSettings_(settings || {});
    if (staffRows) {
      var sh = ensureSheet_('직원', ['이름', '소속 사업']);
      sh.clearContents();
      sh.getRange(1, 1, 1, 2).setValues([['이름', '소속 사업']]).setFontWeight('bold');
      if (staffRows.length) {
        var data = staffRows.map(function (r) { return [String(r['이름'] || ''), String(r['소속 사업'] || '')]; });
        sh.getRange(2, 1, data.length, 2).setNumberFormat('@');
        sh.getRange(2, 1, data.length, 2).setValues(data);
      }
    }
    return { ok: true };
  });
}

/* ---------- 명함 사진: '명함사진' 시트에 나눠 저장 ---------- */
function photoRow_(sh, id) {
  if (sh.getLastRow() < 1) return -1;
  var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getDisplayValues().map(function (r) { return r[0]; });
  return ids.indexOf(String(id)) + 1; // 0이면 없음
}

function api_putPhoto(id, dataUrl) {
  requirePerm_(requireMember_(), '명함', 2);
  return withLock_(function () {
    var sh = ensureSheet_(PHOTO_SHEET);
    var parts = [String(id)];
    for (var i = 0; i < dataUrl.length; i += PHOTO_CHUNK) parts.push(dataUrl.slice(i, i + PHOTO_CHUNK));
    var row = photoRow_(sh, id);
    if (row > 0) sh.getRange(row, 1, 1, sh.getLastColumn()).clearContent(); else row = sh.getLastRow() + 1;
    if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 20);
    if (sh.getMaxColumns() < parts.length) sh.insertColumnsAfter(sh.getMaxColumns(), parts.length - sh.getMaxColumns());
    sh.getRange(row, 1, 1, parts.length).setNumberFormat('@').setValues([parts]);
    return { ok: true };
  });
}

function api_getPhoto(id) {
  requireMember_();
  var sh = book_().getSheetByName(PHOTO_SHEET);
  if (!sh) return null;
  var row = photoRow_(sh, id);
  if (row <= 0) return null;
  var vals = sh.getRange(row, 2, 1, Math.max(1, sh.getLastColumn() - 1)).getValues()[0];
  return vals.join('') || null;
}

function api_delPhoto(id) {
  requirePerm_(requireMember_(), '명함', 2);
  return withLock_(function () {
    var sh = book_().getSheetByName(PHOTO_SHEET);
    if (!sh) return { ok: true };
    var row = photoRow_(sh, id);
    if (row > 0) sh.deleteRow(row);
    return { ok: true };
  });
}

/* ---------- AI (Claude API) ----------
   API 키는 '프로젝트 설정 > 스크립트 속성'의 ANTHROPIC_API_KEY 에 보관합니다 (사이트의 데이터 관리 화면에서도 저장 가능).
   브라우저로는 키가 전달되지 않고, 이 서버가 대신 호출합니다. */
var AI_KEY_PROP = 'ANTHROPIC_API_KEY';

function aiKey_() {
  return PropertiesService.getScriptProperties().getProperty(AI_KEY_PROP) || '';
}

function api_setAiKey(key) {
  requireAdmin_();
  var props = PropertiesService.getScriptProperties();
  key = String(key || '').trim();
  if (key) props.setProperty(AI_KEY_PROP, key); else props.deleteProperty(AI_KEY_PROP);
  return { ok: true, ai: !!key };
}

/* ---------- 브이월드 주소 검색 (서버가 대신 묻는다) ----------
 * 브이월드 키는 발급 때 등록한 사이트 주소에서만 쓸 수 있다. 공유 사이트는 구글이 정한 주소에서 돌아가므로
 * 서버에서 domain(등록한 주소)을 직접 적어 보낸다. 키와 주소는 설정 시트(vworldKey, vworldDomain)에 있다. */
function api_geocode(address) {
  requireMember_();
  var st = readSettings_();
  var q = String(address || '').trim();
  if (!q) return null;
  var v = String(st.vworldKey || '').trim() ? vworldGeocode_(q, st) : null;
  if (v && v.lat) return v;
  return kakaoGeocode_(q) || googleGeocode_(q) || v;
}

/* ---------- 카카오 (무료 REST 키: 카카오 디벨로퍼스) ----------
 * 키는 스크립트 속성 KAKAO_REST_KEY에 두고 브라우저로 내려보내지 않는다.
 * 주소 → 위치: 카카오 로컬, 도로 거리·시간: 카카오모빌리티 길찾기 */
var KAKAO_PROP = 'KAKAO_REST_KEY';
function kakaoKey_() { return PropertiesService.getScriptProperties().getProperty(KAKAO_PROP) || ''; }
function kakaoGet_(url) {
  var key = kakaoKey_();
  if (!key) return null;
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'KakaoAK ' + key }, muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code === 401 || code === 403) throw new Error('카카오 키가 맞지 않거나 이 기능이 꺼져 있어요 (' + code + ')');
  return code === 200 ? JSON.parse(res.getContentText() || '{}') : null;
}
function kakaoGeocode_(q) {
  try {
    var j = kakaoGet_('https://dapi.kakao.com/v2/local/search/address.json?size=1&query=' + encodeURIComponent(q));
    var d = j && j.documents && j.documents[0];
    if (d) return { lat: Number(d.y), lng: Number(d.x), label: d.address_name || q, by: 'kakao', approx: d.address_type === 'REGION' };
    j = kakaoGet_('https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=' + encodeURIComponent(q));
    d = j && j.documents && j.documents[0];
    if (d) return { lat: Number(d.y), lng: Number(d.x), label: d.place_name || q, by: 'kakao' };
  } catch (e) { /* 키 없음·오류면 다음 방법 */ }
  return null;
}
/** 관리자: 카카오 REST 키 저장 (빈 값이면 지움). 저장 전에 주소 하나로 시험한다 */
/** 두 곳 사이 자동차 도로 거리(km)·시간(분)·경로 */
function api_route(a, b) {
  requireMember_();
  var j = kakaoGet_('https://apis-navi.kakaomobility.com/v1/directions?priority=RECOMMEND&origin=' + a.lng + ',' + a.lat + '&destination=' + b.lng + ',' + b.lat);
  var r = j && j.routes && j.routes[0];
  if (!r || r.result_code !== 0) return null;
  var path = [];
  (r.sections || []).forEach(function (sec) { (sec.roads || []).forEach(function (rd) { for (var i = 0; i + 1 < rd.vertexes.length; i += 2) path.push([rd.vertexes[i + 1], rd.vertexes[i]]); }); });
  return { km: r.summary.distance / 1000, min: Math.round(r.summary.duration / 60), path: path, by: 'kakao' };
}
/** 구글 지도(Apps Script 지도 서비스, 키 필요 없음)로 주소 → 위치 */
function googleGeocode_(q) {
  try {
    var r = Maps.newGeocoder().setRegion('kr').setLanguage('ko').geocode(q);
    var hit = r && r.status === 'OK' && r.results && r.results[0];
    if (!hit) return null;
    var g = hit.geometry || {};
    return { lat: Number(g.location.lat), lng: Number(g.location.lng), label: hit.formatted_address || q, by: 'google', approx: g.location_type === 'APPROXIMATE' };
  } catch (e) { return null; }
}
function vworldGeocode_(q, st) {
  var key = String(st.vworldKey || '').trim();
  var domain = String(st.vworldDomain || 'https://script.google.com').trim();
  var types = ['road', 'parcel'];
  for (var i = 0; i < types.length; i++) {
    var url = 'https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=epsg:4326&refine=true&simple=true&format=json'
      + '&type=' + types[i] + '&key=' + encodeURIComponent(key) + '&domain=' + encodeURIComponent(domain) + '&address=' + encodeURIComponent(q);
    try {
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var j = JSON.parse(res.getContentText() || '{}');
      var r = j.response || {};
      if (r.status === 'OK' && r.result && r.result.point) return { lat: Number(r.result.point.y), lng: Number(r.result.point.x), label: q, by: 'vworld' };
      if (r.status === 'ERROR') return { error: (r.error && (r.error.text || r.error.code)) || '브이월드 오류' };
    } catch (e) { return { error: String(e.message || e) }; }
  }
  return null;
}

/** 사이트가 만든 Messages API 요청을 그대로 전달한다 */
function api_claude(body) {
  requireMember_();
  var key = aiKey_();
  if (!key) return { error: { message: 'AI 키가 설정되지 않았습니다. 데이터 관리 화면에서 키를 저장하세요.' } };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  var text = res.getContentText();
  var json;
  try { json = JSON.parse(text); } catch (e) { return { error: { message: 'AI 응답을 읽지 못했습니다 (HTTP ' + res.getResponseCode() + ')' } }; }
  if (res.getResponseCode() >= 300) return { error: json.error || { message: 'HTTP ' + res.getResponseCode() } };
  return json;
}


function subFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/* ================= 자동 백업 (구글 드라이브) ================= */
function backupFolder_() {
  var st = readSettings_();
  if (st.backupFolderId) { try { return DriveApp.getFolderById(st.backupFolderId); } catch (e) { /* 다시 만든다 */ } }
  var parents = DriveApp.getFileById(book_().getId()).getParents();
  var base = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var f = subFolder_(base, '아르딤 취업지원 백업');
  withLock_(function () { writeSettings_({ backupFolderId: f.getId() }); });
  return f;
}
/** 시트 전체를 백업 폴더에 복사하고 30개보다 오래된 것은 휴지통으로 */
function backupNow_() {
  var ss = book_(), folder = backupFolder_();
  var name = '백업 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') + ' · ' + ss.getName();
  var copy = DriveApp.getFileById(ss.getId()).makeCopy(name, folder);
  var list = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) list.push(f); }
  list.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); }).slice(30).forEach(function (f) { f.setTrashed(true); });
  withLock_(function () { writeSettings_({ lastBackup: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') }); });
  return { name: name, url: copy.getUrl() };
}
function api_backupNow() { requireAdmin_(); return backupNow_(); }
function api_backupList() {
  requireAdmin_();
  var folder = backupFolder_(), out = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) out.push({ name: f.getName(), url: f.getUrl(), at: f.getDateCreated().getTime() }); }
  out.sort(function (a, b) { return b.at - a.at; });
  return { folder: folder.getUrl(), list: out.slice(0, 10) };
}

/* ================= 구글 캘린더 → 사이트 (가져오기) =================
 * 팀 캘린더에서 직접 넣은 일정을 사이트 일정(출처: 구글 캘린더)으로 가져온다.
 * 사이트에서 만든 일정은 사이트가 기준이고, 캘린더에서 만든 일정은 캘린더가 기준(고치거나 지우면 따라온다). */
var CAL_SRC = '구글 캘린더';
function calTitle_(t, staff) {
  var s = String(t || '').replace(/^✔\s*/, '');
  var type = '';
  var m = s.match(/^\[([^\]]+)\]\s*/);
  if (m) { type = m[1]; s = s.slice(m[0].length); }
  var who = '';
  staff.forEach(function (n) { if (n && s.slice(-(n.length + 3)) === ' · ' + n) { who = n; s = s.slice(0, -(n.length + 3)); } });
  return { title: s.trim() || '(제목 없음)', type: type, staff: who };
}
function calPull_() {
  var st = readSettings_();
  if (!st.calId || st.calPull === 'N') return { added: 0, changed: 0, removed: 0, off: true };
  var cal = calOf_(st.calId), props = PropertiesService.getScriptProperties();
  var now = Date.now(), from = new Date(now - 30 * 86400000), to = new Date(now + 120 * 86400000);
  var fmt = function (d, f) { return Utilities.formatDate(d, 'Asia/Seoul', f); };
  var gevs = cal.getEvents(from, to);
  var all = props.getProperties(), rev = {};
  Object.keys(all).forEach(function (k) { if (k.indexOf('cal:') === 0) rev[all[k]] = k.slice(4); });
  var staff = readSheet_('직원').map(function (r) { return r['이름']; });
  var rows = {};
  readSheet_('일정').forEach(function (r) { rows[r['일정ID']] = r; });
  var ops = [], seen = {}, added = 0, changed = 0, removed = 0;
  gevs.forEach(function (ge) {
    var gid = ge.getId(); seen[gid] = 1;
    var sid = rev[gid];
    var row = sid && rows[sid];
    if (row && row['출처'] !== CAL_SRC) return; // 사이트에서 만든 일정은 사이트가 기준
    if (!sid && String(ge.getDescription() || '').indexOf(CAL_MARK) >= 0) return; // 짝을 잃은 사이트 일정
    var allDay = ge.isAllDayEvent(), start = allDay ? ge.getAllDayStartDate() : ge.getStartTime();
    var p = calTitle_(ge.getTitle(), staff);
    var next = { '날짜': fmt(start, 'yyyy-MM-dd'), '시간': allDay ? '' : fmt(start, 'HH:mm'), '제목': p.title, '유형': p.type || (row && row['유형']) || '기타', '메모': String(ge.getDescription() || '').replace(CAL_MARK, '').trim(), '담당 직원': p.staff || (row && row['담당 직원']) || '', '출처': CAL_SRC };
    if (!row) {
      sid = 'G' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, gid)).replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
      props.setProperty('cal:' + sid, gid);
      next['일정ID'] = sid; next['완료(Y/N)'] = 'N'; next['대상 구분(biz/net)'] = ''; next['대상ID'] = '';
      ops.push({ sheet: '일정', op: 'put', id: sid, row: next }); added++;
      return;
    }
    var diff = Object.keys(next).some(function (k) { return String(row[k] || '') !== String(next[k] || ''); });
    if (diff) { next['일정ID'] = sid; ops.push({ sheet: '일정', op: 'put', id: sid, row: next }); changed++; }
  });
  // 캘린더에서 지운 일정 (가져온 것만, 확인한 기간 안)
  var f0 = fmt(from, 'yyyy-MM-dd'), t0 = fmt(to, 'yyyy-MM-dd');
  Object.keys(rows).forEach(function (sid) {
    var r = rows[sid];
    if (r['출처'] !== CAL_SRC || r['날짜'] < f0 || r['날짜'] > t0) return;
    var gid = props.getProperty('cal:' + sid);
    if (!gid || !seen[gid]) { ops.push({ sheet: '일정', op: 'del', id: sid }); props.deleteProperty('cal:' + sid); removed++; }
  });
  if (ops.length) withLock_(function () { writeOps_(ops); });
  return { added: added, changed: changed, removed: removed };
}
function api_calPull() { requireMember_(); return calPull_(); }

/* ================= 아침 메일 (Gmail) =================
 * 평일 아침, 사용 권한에 이름을 넣은 사람에게 '오늘 일정 · 지난 미완료 · 재연락할 곳'을 보낸다 */
function morningMail_(onlyTo) {
  var st = readSettings_();
  var names = {}; try { names = JSON.parse(st.accNames || '{}') || {}; } catch (e) { names = {}; }
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var evs = readSheet_('일정'), acts = readSheet_('활동기록');
  var places = calPlaces_();
  var esc = function (x) { return String(x || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
  var sent = 0;
  Object.keys(names).forEach(function (email) {
    if (onlyTo && email !== onlyTo) return;
    var name = names[email];
    var mine = function (r) { return r['담당 직원'] === name || (!r['담당 직원'] && !onlyTo); };
    var todayList = evs.filter(function (r) { return r['날짜'] === today && r['완료(Y/N)'] !== 'Y' && (r['담당 직원'] === name || !r['담당 직원']); }).sort(function (a, b) { return String(a['시간']).localeCompare(String(b['시간'])); });
    var late = evs.filter(function (r) { return r['날짜'] < today && r['완료(Y/N)'] !== 'Y' && r['담당 직원'] === name; });
    var recall = acts.filter(function (r) { return r['상태'] === '재연락' && r['담당 직원'] === name; }).slice(-10);
    if (!todayList.length && !late.length && !recall.length && !onlyTo) return;
    var li = function (r) { var p = places[r['대상ID']]; return '<li><b>' + esc(r['시간'] || '종일') + '</b> ' + esc(r['제목']) + (p ? ' · ' + esc(p.name) + (p.addr ? ' <span style="color:#888">(' + esc(p.addr) + ')</span>' : '') : '') + '</li>'; };
    var html = '<div style="font-family:sans-serif;font-size:14px;line-height:1.6">'
      + '<h2 style="color:#F39800;margin:0 0 8px">' + esc(name) + '님, 오늘(' + today + ') 일정 ' + todayList.length + '건</h2>'
      + (todayList.length ? '<ul>' + todayList.map(li).join('') + '</ul>' : '<p>오늘 일정이 없어요.</p>')
      + (late.length ? '<h3 style="color:#D9485F">지난 미완료 일정 ' + late.length + '건</h3><ul>' + late.slice(0, 10).map(function (r) { return '<li>' + esc(r['날짜']) + ' · ' + esc(r['제목']) + '</li>'; }).join('') + '</ul>' : '')
      + (recall.length ? '<h3 style="color:#2F7FE0">재연락할 곳 ' + recall.length + '곳</h3><ul>' + recall.map(function (r) { var p = places[r['대상ID']]; return '<li>' + esc(p ? p.name : '') + ' · ' + esc(r['내용']) + ' <span style="color:#888">(' + esc(r['날짜']) + ')</span></li>'; }).join('') + '</ul>' : '')
      + '<p style="color:#888;font-size:12px">아르딤 취업지원 사이트에서 보낸 메일 · 데이터 관리 → 구글 연결에서 끌 수 있어요.</p></div>';
    MailApp.sendEmail({ to: email, subject: '[아르딤] ' + today + ' 오늘 일정 ' + todayList.length + '건' + (recall.length ? ' · 재연락 ' + recall.length + '곳' : ''), htmlBody: html, name: '아르딤 취업지원' });
    sent++;
  });
  return { sent: sent };
}
function api_mailTest() { var acc = requireAdmin_(); if (!acc.me) throw new Error('내 계정 메일을 알 수 없어요.'); return morningMail_(acc.me); }

/* ================= 자동 작업 (트리거) =================
 * 관리자가 한 번 켜면: 매일 새벽 2시 백업, 15분마다 캘린더 가져오기, 평일 아침 8시 메일 */
var CRON = ['cron_daily', 'cron_cal', 'cron_morning'];
function cron_daily() { try { if (readSettings_().backupOn !== 'N') backupNow_(); } catch (e) { console.error(e); } }

/* ================= 달별 정리 파일 (구글 드라이브) =================
 * 화면에서 만든 표를 받아 '아르딤 취업지원 정리 / 현장중심 / 연락이력 / 2026-10 연락이력' 처럼 폴더별·달별 시트 파일로 쓴다.
 * 같은 이름 파일이 있으면 내용만 새로 고친다 (링크가 바뀌지 않음) */
function archiveRoot_() {
  var st = readSettings_();
  if (st.archiveFolderId) { try { return DriveApp.getFolderById(st.archiveFolderId); } catch (e) { /* 다시 만든다 */ } }
  var parents = DriveApp.getFileById(book_().getId()).getParents();
  var f = subFolder_(parents.hasNext() ? parents.next() : DriveApp.getRootFolder(), '아르딤 취업지원 정리');
  withLock_(function () { writeSettings_({ archiveFolderId: f.getId() }); });
  return f;
}
/* ---------- 복지관 사업실적 시트로 보내기 ----------
 * 사이트 실적 화면에 넣은 한 달 실적을 복지관 '사업실적' 스프레드시트의 노란 칸에만 적는다.
 *  - 사람마다 세는 항목(직업상담·취업알선 등) → 실적(일반): 이름(C)·사업날짜(J)·세부사업명(M)
 *  - 건수만 세는 항목(사업체개발·고용자원개발·사업체관리 등) → 실적(기타): 사업날짜(B)·세부사업명(E)·참여인원(F)·비고(I)
 * 이미 같은 줄(일반: 이름·날짜·세부사업, 기타: 날짜·세부사업·비고)이 그 달에 있으면 건너뛰어서 여러 번 보내도 두 번 들어가지 않는다. */
var ORG_PERF_DEFAULT = '1kp0eFtA_clfOTDsyCAbdFujQe-S-TN4SbGVizMj2wKQ';
function orgPerfId_(v) {
  var s = String(v || readSettings_().orgPerfSheet || ORG_PERF_DEFAULT).trim();
  var m = s.match(/\/d\/([\w-]{20,})/);
  return m ? m[1] : s;
}
/** 복지관 시트에 쓰는 동안만 잠근다 (두 사람이 동시에 보내 줄이 겹치지 않게). 읽기만 할 때는 잠그지 않는다 */
function orgLock_(write, fn) {
  if (!write) return fn();
  var c = CacheService.getScriptCache();
  if (c.get('orgsync:busy')) throw new Error('다른 선생님이 지금 복지관 시트로 보내는 중이에요. 1분 뒤 다시 눌러 주세요.');
  c.put('orgsync:busy', '1', 120);
  try { return fn(); } finally { c.remove('orgsync:busy'); }
}
function api_orgPerfSync(p) {
  var acc = requireMember_();
  if (level_(acc, 'orgsync') < 2) throw new Error('복지관 실적 시트 보내기 권한이 없어요. 관리자에게 요청하세요.');
  var ss = SpreadsheetApp.openById(orgPerfId_(p.sheet));
  var gen = ss.getSheetByName('실적(일반)'), etc = ss.getSheetByName('실적(기타)'), cls = ss.getSheetByName('실적분류설정'), users = ss.getSheetByName('이용자입력');
  if (!gen || !etc || !cls) throw new Error('보낼 시트에 실적(일반)·실적(기타)·실적분류설정 탭이 없어요. 주소를 확인하세요.');
  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Seoul', month = String(p.month || '');
  var day = function (v) { return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v || '').trim().slice(0, 10); };
  var norm = function (v) { return String(v == null ? '' : v).replace(/\s+/g, '').toLowerCase(); };
  var col = function (sh, c, n) { return n > 0 ? sh.getRange(2, c, n, 1).getValues().map(function (r) { return r[0]; }) : []; };
  var items = {};
  col(cls, 3, cls.getLastRow() - 1).forEach(function (v) { if (String(v).trim()) items[String(v).trim()] = 1; });
  var known = {};
  if (users) col(users, 3, users.getLastRow() - 1).forEach(function (v) { if (String(v).trim()) known[norm(v)] = 1; });

  // 우리 시트 저장에 쓰는 잠금(withLock_)은 쓰지 않는다: 복지관 시트를 읽는 동안 다른 저장이 막혀 '잠금 시간초과'가 났다
  return orgLock_(p.commit, function () {
    // 실적(일반): 체크박스 칸 때문에 getLastRow가 끝까지 가므로 이름·세부사업 칸으로 마지막 줄을 찾는다
    var gn = gen.getLastRow() - 1, gC = col(gen, 3, gn), gJ = col(gen, 10, gn), gM = col(gen, 13, gn), gLast = 0, have = {};
    for (var i = 0; i < gn; i++) {
      if (String(gC[i]).trim() || String(gM[i]).trim()) gLast = i + 1;
      var d = day(gJ[i]);
      if (d.indexOf(month) === 0) { var k = norm(gC[i]) + '|' + d + '|' + norm(gM[i]); have[k] = (have[k] || 0) + 1; }
    }
    var en = etc.getLastRow() - 1, eB = col(etc, 2, en), eE = col(etc, 5, en), eI = col(etc, 9, en), eLast = 0, haveE = {};
    for (var j = 0; j < en; j++) {
      if (String(eE[j]).trim() || (eB[j] !== '' && eB[j] != null)) eLast = j + 1;
      var d2 = day(eB[j]);
      if (d2.indexOf(month) === 0) { var k2 = d2 + '|' + norm(eE[j]) + '|' + norm(eI[j]); haveE[k2] = (haveE[k2] || 0) + 1; }
    }
    // st: 보낸 줄마다 결과 (add = 새로 넣음, dup = 이미 있음, bad = 실적분류설정에 없는 세부사업, skip = 다른 달)
    var out = { title: ss.getName(), url: ss.getUrl(), add: { gen: 0, etc: 0 }, dup: { gen: 0, etc: 0 }, badItems: {}, unknown: {}, st: { gen: [], etc: [] }, wrote: false };
    var addG = [], addE = [];
    (p.gen || []).forEach(function (r) {
      var st = out.st.gen;
      if (String(r.date || '').indexOf(month) !== 0) return st.push('skip');
      if (!items[r.item]) { out.badItems[r.item] = (out.badItems[r.item] || 0) + 1; return st.push('bad'); }
      var k = norm(r.name) + '|' + r.date + '|' + norm(r.item);
      if (have[k]) { have[k]--; out.dup.gen++; return st.push('dup'); }
      var who = known[norm(r.name)];
      if (!who) out.unknown[r.name] = (out.unknown[r.name] || 0) + 1;
      st.push(who ? 'add' : 'add-nouser');
      addG.push(r);
    });
    (p.etc || []).forEach(function (r) {
      var st = out.st.etc;
      if (String(r.date || '').indexOf(month) !== 0) return st.push('skip');
      if (!items[r.item]) { out.badItems[r.item] = (out.badItems[r.item] || 0) + 1; return st.push('bad'); }
      var k = r.date + '|' + norm(r.item) + '|' + norm(r.note);
      if (haveE[k]) { haveE[k]--; out.dup.etc++; return st.push('dup'); }
      st.push('add');
      addE.push(r);
    });
    out.add.gen = addG.length; out.add.etc = addE.length;
    if (!p.commit) { if (users && Object.keys(out.unknown).length) out.userForm = orgUserForm_(users, tz); return out; }
    var dt = function (s) { var a = String(s).split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); };
    var put = function (sh, row, c, vals) { if (vals.length) sh.getRange(row, c, vals.length, 1).setValues(vals.map(function (v) { return [v]; })); };
    if (addG.length) {
      var r0 = gLast + 2;
      if (gen.getMaxRows() < r0 + addG.length) gen.insertRowsAfter(gen.getMaxRows(), r0 + addG.length - gen.getMaxRows());
      put(gen, r0, 3, addG.map(function (r) { return r.name; }));
      put(gen, r0, 10, addG.map(function (r) { return dt(r.date); }));
      gen.getRange(r0, 10, addG.length, 1).setNumberFormat('yyyy-mm-dd');
      put(gen, r0, 13, addG.map(function (r) { return r.item; }));
    }
    if (addE.length) {
      var e0 = eLast + 2;
      if (etc.getMaxRows() < e0 + addE.length) etc.insertRowsAfter(etc.getMaxRows(), e0 + addE.length - etc.getMaxRows());
      put(etc, e0, 2, addE.map(function (r) { return dt(r.date); }));
      etc.getRange(e0, 2, addE.length, 1).setNumberFormat('yyyy-mm-dd');
      put(etc, e0, 5, addE.map(function (r) { return r.item; }));
      put(etc, e0, 6, addE.map(function (r) { return r.people === '' || r.people == null ? '' : r.people; }));
      put(etc, e0, 9, addE.map(function (r) { return r.note || ''; }));
      // 대분류·중분류 칸: 위 줄처럼 실적분류설정에서 찾는 식을 넣는다 (이미 식이 있으면 그대로)
      var fC = etc.getRange(e0, 3, addE.length, 2).getFormulas();
      var fs = addE.map(function (_, i) {
        var r = e0 + i;
        return [fC[i][0] || '=IF(E' + r + '="","",IFERROR(INDEX(\'실적분류설정\'!A:A,MATCH(E' + r + ',\'실적분류설정\'!C:C,0)),""))',
          fC[i][1] || '=IF(E' + r + '="","",IFERROR(INDEX(\'실적분류설정\'!B:B,MATCH(E' + r + ',\'실적분류설정\'!C:C,0)),""))'];
      });
      etc.getRange(e0, 3, addE.length, 2).setFormulas(fs);
    }
    out.wrote = true;
    return out;
  });
}

/** 복지관 시트에 이미 두 번 이상 들어간 줄 찾기·지우기 (그 달·우리 세부사업만).
 *  실적(일반) = 이름·날짜·세부사업이 같은 줄, 실적(기타) = 날짜·세부사업·비고가 같은 줄. 맨 위 한 줄만 남긴다 */
function api_orgPerfDedupe(p) {
  var acc = requireMember_();
  if (level_(acc, 'orgsync') < 2) throw new Error('복지관 실적 시트 보내기 권한이 없어요. 관리자에게 요청하세요.');
  var ss = SpreadsheetApp.openById(orgPerfId_(p.sheet));
  var gen = ss.getSheetByName('실적(일반)'), etc = ss.getSheetByName('실적(기타)');
  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Seoul', month = String(p.month || ''), items = {};
  (p.items || []).forEach(function (i) { items[i] = 1; });
  var day = function (v) { return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v || '').trim().slice(0, 10); };
  var norm = function (v) { return String(v == null ? '' : v).replace(/\s+/g, '').toLowerCase(); };
  function scan(sh, cols, keyOf) {
    var n = sh.getLastRow() - 1; if (n < 1) return [];
    var data = {}; cols.forEach(function (c) { data[c] = sh.getRange(2, c, n, 1).getValues(); });
    var seen = {}, dups = [];
    for (var i = 0; i < n; i++) {
      var row = {}; cols.forEach(function (c) { row[c] = data[c][i][0]; });
      var k = keyOf(row); if (!k) continue;
      if (seen[k]) dups.push({ r: i + 2, k: k, row: row }); else seen[k] = 1;
    }
    return dups;
  }
  var gd = scan(gen, [3, 10, 13], function (r) { var d = day(r[10]), it = String(r[13]).trim(); return d.indexOf(month) === 0 && items[it] && String(r[3]).trim() ? norm(r[3]) + '|' + d + '|' + it : ''; });
  var ed = scan(etc, [2, 5, 9], function (r) { var d = day(r[2]), it = String(r[5]).trim(); return d.indexOf(month) === 0 && items[it] ? d + '|' + it + '|' + norm(r[9]) : ''; });
  var out = { gen: gd.map(function (x) { return { row: x.r, name: String(x.row[3]), date: day(x.row[10]), item: String(x.row[13]) }; }), etc: ed.map(function (x) { return { row: x.r, date: day(x.row[2]), item: String(x.row[5]), note: String(x.row[9]) }; }), removed: 0 };
  if (!p.commit || (!gd.length && !ed.length)) return out;
  return orgLock_(true, function () {
    // 아래 줄부터 지운다 (위 줄 번호가 바뀌지 않게). 시트 전체에 식을 퍼뜨리는 줄(ARRAYFORMULA)은 지우지 않고 노란 칸만 비운다
    function drop(sh, rows, yellow) {
      rows.sort(function (a, b) { return b - a; }).forEach(function (r) {
        var f = String(sh.getRange(r, 1).getFormula() || '') + String(sh.getRange(r, 2).getFormula() || '');
        if (/ARRAYFORMULA/i.test(f)) yellow.forEach(function (c) { sh.getRange(r, c).clearContent(); });
        else sh.deleteRow(r);
        out.removed++;
      });
    }
    drop(gen, gd.map(function (x) { return x.r; }), [3, 10, 13, 14, 15]);
    drop(etc, ed.map(function (x) { return x.r; }), [2, 5, 6, 7, 8, 9]);
    return out;
  });
}

/** 이용자입력 탭: 칸마다 이미 쓰는 값(고를 수 있게) + 다음 이용자번호 */
function orgUserForm_(users, tz) {
  var n = users.getLastRow() - 1, rows = n > 0 ? users.getRange(2, 1, n, 12).getValues() : [];
  var pick = function (c) { var cnt = {}; rows.forEach(function (r) { var v = String(r[c] || '').trim(); if (v) cnt[v] = (cnt[v] || 0) + 1; }); return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 80); };
  var y = Utilities.formatDate(new Date(), tz, 'yyyy'), max = 0;
  rows.forEach(function (r) { var m = String(r[1] || '').match(/^(\d{4})-(\d+)$/); if (m && m[1] === y) max = Math.max(max, +m[2]); });
  return { sex: pick(3), type: pick(6), grade: pick(7), city: pick(8), town: pick(9), income: pick(10), year: y, next: max + 1 };
}
/** 사이트에서 적은 이용자를 복지관 시트 '이용자입력' 맨 아래에 더한다. 같은 이름·같은 이용자번호가 이미 있으면 건너뛴다 */
function api_orgUserAdd(p) {
  var acc = requireMember_();
  if (level_(acc, 'orgsync') < 2) throw new Error('복지관 실적 시트 보내기 권한이 없어요. 관리자에게 요청하세요.');
  var ss = SpreadsheetApp.openById(orgPerfId_(p.sheet)), sh = ss.getSheetByName('이용자입력');
  if (!sh) throw new Error('보낼 시트에 이용자입력 탭이 없어요.');
  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Seoul';
  return orgLock_(true, function () {
    var n = sh.getLastRow() - 1, rows = n > 0 ? sh.getRange(2, 1, n, 3).getValues() : [];
    var last = 0, maxNo = 0, nos = {}, names = {};
    rows.forEach(function (r, i) {
      if (String(r[1]).trim() || String(r[2]).trim()) last = i + 1;
      if (+r[0] > maxNo) maxNo = +r[0];
      nos[String(r[1]).trim()] = 1; names[String(r[2]).replace(/\s+/g, '')] = 1;
    });
    var now = new Date(), out = { added: [], skipped: [] }, put = [];
    (p.users || []).forEach(function (u) {
      var name = String(u.name || '').trim(), no = String(u.no || '').trim();
      if (!name) return;
      if (names[name.replace(/\s+/g, '')]) { out.skipped.push(name + ' (이미 있는 이름)'); return; }
      if (!/^\d{4}-\d{5}$/.test(no)) { out.skipped.push(name + ' (이용자번호 모양이 2026-00262 같지 않아요)'); return; }
      if (nos[no]) { out.skipped.push(name + ' (이용자번호 ' + no + ' 이미 있음)'); return; }
      var b = String(u.birth || '').split('-'), birth = b.length === 3 ? new Date(+b[0], +b[1] - 1, +b[2]) : '';
      var age = birth ? now.getFullYear() - birth.getFullYear() - ((now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) ? 1 : 0) : '';
      put.push([++maxNo, no, name, u.sex || '', birth, age, u.type || '', u.grade || '', u.city || '', u.town || '', u.income || '', u.note || '']);
      nos[no] = 1; names[name.replace(/\s+/g, '')] = 1; out.added.push(name);
    });
    if (put.length) {
      var r0 = last + 2;
      if (sh.getMaxRows() < r0 + put.length) sh.insertRowsAfter(sh.getMaxRows(), r0 + put.length - sh.getMaxRows());
      sh.getRange(r0, 1, put.length, 12).setValues(put);
      sh.getRange(r0, 5, put.length, 1).setNumberFormat('yyyy-mm-dd');
    }
    return out;
  });
}

function api_archiveWrite(p) {
  var acc = requireMember_();
  if (!p || !p.section || !p.files) throw new Error('보낼 내용이 없어요.');
  var root = archiveRoot_(), sec = subFolder_(root, String(p.section));
  var out = [];
  p.files.forEach(function (f) {
    var folder = subFolder_(sec, String(f.folder));
    var it = folder.getFilesByName(String(f.name)), ss;
    if (it.hasNext()) ss = SpreadsheetApp.openById(it.next().getId());
    else { ss = SpreadsheetApp.create(String(f.name)); DriveApp.getFileById(ss.getId()).moveTo(folder); }
    var names = f.sheets.map(function (t) { return String(t.name); });
    f.sheets.forEach(function (t, i) {
      var sh = ss.getSheetByName(String(t.name)) || ss.insertSheet(String(t.name), i);
      var fl = sh.getFilter(); if (fl) fl.remove();
      sh.clear();
      var head = t.head.map(String);
      var rows = (t.rows || []).map(function (r) { return head.map(function (_, c) { return r[c] == null ? '' : String(r[c]); }); });
      var data = [head].concat(rows.length ? rows : [[t.empty || '(기록 없음)'].concat(head.slice(1).map(function () { return ''; }))]);
      if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
      if (sh.getMaxRows() < data.length) sh.insertRowsAfter(sh.getMaxRows(), data.length - sh.getMaxRows());
      sh.getRange(1, 1, data.length, head.length).setNumberFormat('@').setValues(data);
      sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#EEF2F7');
      sh.setFrozenRows(1);
      if (rows.length) sh.getRange(1, 1, data.length, head.length).createFilter();
      try { sh.autoResizeColumns(1, head.length); } catch (e) { /* 너비 조절 실패는 무시 */ }
    });
    ss.getSheets().forEach(function (sh) { if (names.indexOf(sh.getName()) < 0 && ss.getSheets().length > 1) ss.deleteSheet(sh); });
    out.push({ name: f.name, url: ss.getUrl() });
  });
  withLock_(function () { writeSettings_({ archiveAt: new Date().toISOString(), archiveBy: acc.me }); });
  return { root: root.getUrl(), files: out };
}
function cron_cal() { try { calPull_(); } catch (e) { console.error(e); } }
function cron_morning() {
  var d = +Utilities.formatDate(new Date(), 'Asia/Seoul', 'u'); // 1=월 … 7=일
  if (d >= 6) return;
  try { if (readSettings_().mailOn === 'Y') morningMail_(''); } catch (e) { console.error(e); }
}
function api_autoSetup(on) {
  var acc = requireAdmin_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (CRON.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  if (on) {
    ScriptApp.newTrigger('cron_daily').timeBased().everyDays(1).atHour(2).inTimezone('Asia/Seoul').create();
    ScriptApp.newTrigger('cron_cal').timeBased().everyMinutes(15).create();
    ScriptApp.newTrigger('cron_morning').timeBased().everyDays(1).atHour(8).inTimezone('Asia/Seoul').create();
  }
  withLock_(function () { writeSettings_({ autoOn: on ? 'Y' : '', autoBy: on ? acc.me : '' }); });
  return api_autoStatus();
}
function api_autoStatus() {
  requireAdmin_();
  var mine = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }).filter(function (h) { return CRON.indexOf(h) >= 0; });
  var st = readSettings_();
  return { on: st.autoOn === 'Y', by: st.autoBy || '', mine: mine, lastBackup: st.lastBackup || '' };
}

/* ================= 지도에서 장소 찾기 · 찍은 곳 주소 (네이버 지도처럼 찾아서 바로 등록) ================= */
function vworldDomain_(st) { return String(st.vworldDomain || 'https://script.google.com').trim(); }
/** 장소·주소 검색: 카카오 → 브이월드 → 구글 순서. [{ name, cat, addr, road, phone, lat, lng, by }] */
function api_placeSearch(q) {
  requireMember_();
  q = String(q || '').trim();
  if (!q) return [];
  var out = [];
  try {
    var j = kakaoGet_('https://dapi.kakao.com/v2/local/search/keyword.json?size=15&x=126.83&y=37.2&query=' + encodeURIComponent(q));
    (j && j.documents || []).forEach(function (d) { out.push({ name: d.place_name, cat: String(d.category_name || '').split('>').pop().trim(), addr: d.address_name, road: d.road_address_name, phone: d.phone, lat: +d.y, lng: +d.x, by: 'kakao' }); });
    if (!out.length) {
      j = kakaoGet_('https://dapi.kakao.com/v2/local/search/address.json?size=10&query=' + encodeURIComponent(q));
      (j && j.documents || []).forEach(function (d) { out.push({ name: d.address_name, cat: '주소', addr: d.address_name, road: d.road_address && d.road_address.address_name, phone: '', lat: +d.y, lng: +d.x, by: 'kakao' }); });
    }
  } catch (e) { /* 카카오 키 없음 */ }
  var st = readSettings_(), key = String(st.vworldKey || '').trim();
  if (!out.length && key) {
    ['place', 'address'].forEach(function (type) {
      if (out.length) return;
      try {
        var url = 'https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:4326&size=15&page=1&format=json&errorformat=json&type=' + type
          + (type === 'address' ? '&category=road' : '') + '&key=' + encodeURIComponent(key) + '&domain=' + encodeURIComponent(vworldDomain_(st)) + '&query=' + encodeURIComponent(q);
        var r = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText() || '{}').response || {};
        ((r.result && r.result.items) || []).forEach(function (it) {
          var a = it.address || {};
          out.push({ name: it.title || a.road || a.parcel || q, cat: type === 'place' ? String(it.category || '').split('>').pop().trim() : '주소', addr: a.parcel || '', road: a.road || '', phone: '', lat: +it.point.y, lng: +it.point.x, by: 'vworld' });
        });
      } catch (e) { /* 다음 방법 */ }
    });
  }
  if (!out.length) { var g = googleGeocode_(q); if (g) out.push({ name: q, cat: '주소', addr: g.label, road: '', phone: '', lat: g.lat, lng: g.lng, by: 'google' }); }
  return out;
}
/** 찍은 자리의 주소: 카카오 → 브이월드 → 구글 */
function api_revGeo(lat, lng) {
  requireMember_();
  try {
    var j = kakaoGet_('https://dapi.kakao.com/v2/local/geo/coord2address.json?x=' + lng + '&y=' + lat);
    var d = j && j.documents && j.documents[0];
    if (d) return { road: d.road_address ? d.road_address.address_name : '', addr: d.address ? d.address.address_name : '', bldg: d.road_address ? d.road_address.building_name : '' };
  } catch (e) { /* 다음 방법 */ }
  var st = readSettings_(), key = String(st.vworldKey || '').trim();
  if (key) {
    try {
      var url = 'https://api.vworld.kr/req/address?service=address&request=getAddress&version=2.0&crs=epsg:4326&format=json&type=both&point=' + lng + ',' + lat + '&key=' + encodeURIComponent(key) + '&domain=' + encodeURIComponent(vworldDomain_(st));
      var r = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText() || '{}').response || {};
      if (r.status === 'OK' && r.result && r.result.length) {
        var road = r.result.filter(function (x) { return x.type === 'road'; })[0], par = r.result.filter(function (x) { return x.type === 'parcel'; })[0];
        return { road: road ? road.text : '', addr: par ? par.text : '', bldg: '' };
      }
    } catch (e) { /* 다음 방법 */ }
  }
  try {
    var g = Maps.newGeocoder().setLanguage('ko').reverseGeocode(lat, lng);
    if (g && g.status === 'OK' && g.results && g.results[0]) return { road: '', addr: String(g.results[0].formatted_address || '').replace(/^대한민국\s*/, ''), bldg: '' };
  } catch (e) { /* 없음 */ }
  return null;
}
