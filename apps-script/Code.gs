/**
 * 아르딤 취업지원 CRM - 팀 공유용 구글 Apps Script 서버
 *
 * 이 스크립트는 구글 시트에 연결(확장 프로그램 > Apps Script)해서 씁니다.
 * 데이터는 모두 이 스프레드시트의 시트(사업체, 네트워크, 명함, 활동기록, 일정, 직원, 설정, 명함사진)에 저장됩니다.
 * 웹 앱 배포 시 "다음 사용자 인증 정보로 실행: 웹 앱에 액세스하는 사용자"로 두면
 * 이 스프레드시트를 공유받은 사람만 사용할 수 있습니다.
 *
 * @OnlyCurrentDoc
 */

var SETTINGS_SHEET = '설정';
var PHOTO_SHEET = '명함사진';
var PHOTO_CHUNK = 45000; // 셀 하나에 5만 자까지 들어가므로 나눠 저장

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('아르딤 취업지원')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico');
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

/** 전체 데이터 읽기. schema = { 시트이름: [열 제목...] } */
function api_load(schema) {
  return withLock_(function () {
    var sheets = {};
    Object.keys(schema || {}).forEach(function (name) {
      ensureSheet_(name, schema[name]);
      sheets[name] = readSheet_(name);
    });
    ensureSheet_(SETTINGS_SHEET, ['항목', '값']);
    return { sheets: sheets, settings: readSettings_(), ai: !!aiKey_() };
  });
}

/** 여러 건 저장·삭제. ops = [{ sheet, op: 'put'|'del', id, row: { 열 제목: 값 } }] */
function api_apply(ops) {
  return withLock_(function () {
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
    return { ok: true, at: new Date().toISOString() };
  });
}

/** 전체 교체 (엑셀 가져오기, 예시 데이터, 전체 삭제). payload = { sheets: { 이름: [행] }, settings: {} } */
function api_replaceAll(payload) {
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
  var sh = book_().getSheetByName(PHOTO_SHEET);
  if (!sh) return null;
  var row = photoRow_(sh, id);
  if (row <= 0) return null;
  var vals = sh.getRange(row, 2, 1, Math.max(1, sh.getLastColumn() - 1)).getValues()[0];
  return vals.join('') || null;
}

function api_delPhoto(id) {
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
  var props = PropertiesService.getScriptProperties();
  key = String(key || '').trim();
  if (key) props.setProperty(AI_KEY_PROP, key); else props.deleteProperty(AI_KEY_PROP);
  return { ok: true, ai: !!key };
}

/** 사이트가 만든 Messages API 요청을 그대로 전달한다 */
function api_claude(body) {
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
