/* ========================================================================== */
/* ==  PASSWORDS  — the only things you normally edit. Change, then redeploy. == */
/* ========================================================================== */

// Admin (Jitendra Jangid): sees the "All trainees" overview AND can open any board.
var ADMIN_PW = 'Jitendra@admin';

// One line per trainee — 'Exact Name': 'their password'.
// Each dev can only open/update the board matching their own name + password.
// Add more devs by adding more lines.
var USERS = {
  'Priyanshu Mishra': 'HSOE&5634N',
};
/* ========================================================================== */

/**
 * MEAN Training Plan — progress storage backend (Google Apps Script)
 * Stores each trainee's per-day status + daily log in a Google Sheet.
 *
 * Sheet layout (auto-created): Name | Done | InProgress | Left | Updated | Data(JSON)
 *   - "Data(JSON)" is the source of truth the web app reads/writes.
 *   - The other columns are a human-readable summary you can glance at.
 *
 * Endpoints:
 *   GET  ?name=Ram%20Jangid   -> { name, statuses:{...}, updatedAt }
 *   POST body {name, statuses} -> upserts the row, returns { ok:true }
 *
 * SETUP: see README.md. In short — paste this into a Sheet-bound Apps Script,
 * Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone,
 * then copy the /exec URL into API_URL in index.html.
 */

var TOTAL_ITEMS = 65; // 30 plan + 30 project + 5 final

// Case-insensitive lookup of a trainee's password by name.
function userPw_(name) {
  var key = String(name || '').trim().toLowerCase();
  for (var k in USERS) { if (k.toLowerCase() === key) return USERS[k]; }
  return null;
}

// Returns 'admin' | 'user' | '' for the given (name, pw).
// Admin pw works for any name; a user pw only works for its own name.
function auth_(name, pw) {
  pw = String(pw || '');
  if (pw && pw === ADMIN_PW) return 'admin';
  var up = userPw_(name);
  if (up != null && pw === up) return 'user';
  return '';
}

// Human-readable labels so the Sheet + admin view show topics, not just "Day 3".
var PLAN_TOPICS = ['JavaScript basics','Functions, arrays & objects (ES6)','Async JavaScript','TypeScript fundamentals','Node & npm intro + modules','Angular setup & components','Templates & directives','Component communication & DI','Routing & navigation','Forms & validation','HttpClient & REST','RxJS in practice','Pipes, custom directives, lifecycle','Guards, interceptors, shared state','Angular Material + review','Node.js deeper','Express basics','REST API design (CRUD)','Validation, errors, config','Auth basics (JWT)','MongoDB basics','Mongoose ODM','Express + MongoDB integration','Testing basics','Git, GitHub & deployment','Capstone: plan & design','Capstone: backend','Capstone: frontend','Capstone: integrate & polish','Capstone: deploy & demo'];
var PROJECT_TOPICS = ['features.md + user stories','UI sketches + entity list','sample-data.json','Git repo + README','seed / print script','running Angular app','task list UI','add / delete works','multi-route app','task form + validation','tasks load over HTTP','filter / search','custom pipe + directive','guarded board','Frontend MVP (mock data)','server boots','tasks CRUD API','projects API','validated, safe API','auth-protected API','DB + connection','schemas / models','persistent API','passing tests','live API URL','FE talks to live API','tasks work live','projects work live','release-ready app','Live full-stack app'];
var FINAL_TOPICS = ['Setup & backend foundation','Backend CRUD & validation','Frontend foundation','Frontend features','Ship it'];

function countSection_(statuses, prefix, n) {
  var done = 0, ip = 0;
  for (var i = 1; i <= n; i++) {
    var v = statuses[prefix + i] || statuses[(prefix === '' ? i : (prefix + i))];
    if (v === 'Done') done++; else if (v === 'In progress') ip++;
  }
  return { done: done, ip: ip, n: n };
}

function blobAt_(sh, row) {
  try { return JSON.parse(sh.getRange(row, 6).getValue()) || {}; } catch (e) { return {}; }
}
function statusesOf_(blob) { return blob.statuses || (blob.logs ? {} : blob) || {}; }

function allTrainees_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, 6).getValues(); // Name, Done, InProgress, Left, Updated, Data
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var st = statusesOf_(safeParse_(rows[i][5]));
    var logs = (safeParse_(rows[i][5]).logs) || {};
    var logDays = 0; for (var k in logs) { var e = logs[k] || {}; if (e.a || e.l || e.b || e.c) logDays++; }
    out.push({
      name: rows[i][0], done: rows[i][1], ip: rows[i][2], left: rows[i][3], updated: rows[i][4],
      plan: countSection_(st, '', 30), project: countSection_(st, 'P', 30), final: countSection_(st, 'F', 5),
      logDays: logDays
    });
  }
  return out;
}

function safeParse_(s) { try { return JSON.parse(s) || {}; } catch (e) { return {}; } }

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Progress');
  if (!sh) {
    sh = ss.insertSheet('Progress');
    sh.appendRow(['Name', 'Done', 'InProgress', 'Left', 'Updated', 'Data(JSON)']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function findRow_(sh, name) {
  var last = sh.getLastRow();
  if (last < 2) return -1; // header only, no data rows yet
  var key = String(name).trim().toLowerCase();
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === key) return i + 2; // 1-based + header
  }
  return -1;
}

function summarize_(statuses) {
  var done = 0, ip = 0;
  for (var k in statuses) {
    if (statuses[k] === 'Done') done++;
    else if (statuses[k] === 'In progress') ip++;
  }
  return { done: done, ip: ip, left: TOTAL_ITEMS - done - ip };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---- Per-trainee formatted tab (rebuilt on every save) ------------------- */
function sanitizeTab_(name) {
  var s = String(name).replace(/[\[\]:*?\/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  return s || 'Trainee';
}
function stColor_(v) { return v === 'Done' ? '#e6f4ea' : v === 'In progress' ? '#fef7e0' : '#f1f3f4'; }
function stFont_(v)  { return v === 'Done' ? '#137333' : v === 'In progress' ? '#996a00' : '#5f6368'; }

function writeUserTab_(name, statuses, logs) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sanitizeTab_(name)) || ss.insertSheet(sanitizeTab_(name));
  sh.clear();
  var COLS = 7, rows = [], statusCells = [];
  function pad(a) { while (a.length < COLS) a.push(''); return a; }
  function stat(key) { return statuses[key] || 'Not started'; }

  var p = countSection_(statuses, '', 30), pr = countSection_(statuses, 'P', 30), f = countSection_(statuses, 'F', 5);
  var totalDone = p.done + pr.done + f.done, pct = Math.round(totalDone / 65 * 100);

  rows.push(pad([name]));
  rows.push(pad(['Plan ' + p.done + '/30   ·   Project ' + pr.done + '/30   ·   Final ' + f.done + '/5   ·   Overall ' + pct + '%  (' + totalDone + '/65)']));
  rows.push(pad(['Last updated: ' + new Date()]));
  rows.push(pad(['']));

  rows.push(pad(['6-WEEK PLAN']));
  rows.push(pad(['Day', 'Topic', 'Status']));
  for (var i = 1; i <= 30; i++) { var v = stat(String(i)); rows.push(pad(['Day ' + i, PLAN_TOPICS[i - 1], v])); statusCells.push([rows.length, 3, v]); }
  rows.push(pad(['']));

  rows.push(pad(['DAILY LOG']));
  rows.push(pad(['Day', 'Topic', 'Planned hrs', 'Actual hrs', 'What I learned / built', 'Blockers & questions', 'Confidence 1-5']));
  for (var i = 1; i <= 30; i++) {
    var e = logs[String(i)] || logs[i] || {};
    rows.push(pad(['Day ' + i, PLAN_TOPICS[i - 1], (e.p != null && e.p !== '' ? e.p : '8'), e.a || '', e.l || '', e.b || '', e.c || '']));
  }
  rows.push(pad(['']));

  rows.push(pad(['PROJECT BUILD']));
  rows.push(pad(['Day', 'Deliverable', 'Status']));
  for (var i = 1; i <= 30; i++) { var v = stat('P' + i); rows.push(pad(['Day ' + i, PROJECT_TOPICS[i - 1], v])); statusCells.push([rows.length, 3, v]); }
  rows.push(pad(['']));

  rows.push(pad(['FINAL PROJECT · 5-day']));
  rows.push(pad(['Day', 'Focus', 'Status']));
  for (var i = 1; i <= 5; i++) { var v = stat('F' + i); rows.push(pad(['Day ' + i, FINAL_TOPICS[i - 1], v])); statusCells.push([rows.length, 3, v]); }

  sh.getRange(1, 1, rows.length, COLS).setValues(rows).setWrap(true).setVerticalAlignment('middle');
  sh.setFrozenRows(3);
  sh.getRange(1, 1, 1, COLS).merge().setFontSize(15).setFontWeight('bold').setBackground('#188038').setFontColor('#ffffff');
  sh.setRowHeight(1, 32);
  sh.getRange(2, 1, 1, COLS).merge().setFontWeight('bold').setFontColor('#0f5f2b');
  sh.getRange(3, 1, 1, COLS).merge().setFontColor('#5f6368').setFontStyle('italic');
  for (var r = 1; r <= rows.length; r++) {
    var a = rows[r - 1][0];
    if (a === '6-WEEK PLAN' || a === 'DAILY LOG' || a === 'PROJECT BUILD' || a === 'FINAL PROJECT · 5-day')
      sh.getRange(r, 1, 1, COLS).merge().setFontWeight('bold').setBackground('#e6f4ea').setFontColor('#0f5f2b').setFontSize(12);
    else if (a === 'Day')
      sh.getRange(r, 1, 1, COLS).setFontWeight('bold').setBackground('#f1f3f4').setFontColor('#5f6368');
  }
  for (var s = 0; s < statusCells.length; s++) {
    var sc = statusCells[s];
    sh.getRange(sc[0], sc[1]).setBackground(stColor_(sc[2])).setFontColor(stFont_(sc[2])).setFontWeight('bold').setHorizontalAlignment('center');
  }
  var w = [60, 250, 130, 90, 340, 240, 110];
  for (var c = 0; c < COLS; c++) sh.setColumnWidth(c + 1, w[c]);
}

// The Data(JSON) column stores { statuses:{...}, logs:{...} } for each trainee.
function doGet(e) {
  var p = (e && e.parameter) || {};
  var name = (p.name || '').trim();
  var action = p.action || '';

  if (action === 'all') {
    if (auth_('', p.pw) !== 'admin') return json_({ error: 'auth' });
    return json_({ ok: true, trainees: allTrainees_() });
  }

  var role = auth_(name, p.pw);
  if (action === 'ping') return json_({ ok: !!role, role: role });

  if (!role) return json_({ error: 'auth' }); // correct name+password (or admin) needed
  if (!name) return json_({ name: '', statuses: {}, logs: {} });
  var sh = sheet_();
  var row = findRow_(sh, name);
  if (row < 0) return json_({ name: name, statuses: {}, logs: {} });
  var blob = {};
  try { blob = JSON.parse(sh.getRange(row, 6).getValue()) || {}; } catch (err) {}
  // back-compat: older rows stored a bare statuses object
  var statuses = blob.statuses || (blob.logs ? {} : blob) || {};
  var logs = blob.logs || {};
  var updated = sh.getRange(row, 5).getValue();
  return json_({ name: name, statuses: statuses, logs: logs, updatedAt: updated });
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {
    return json_({ ok: false, error: 'bad json' });
  }
  var name = (body.name || '').trim();
  if (!auth_(name, body.pw)) return json_({ error: 'auth' });
  var statuses = body.statuses || {};
  var logs = body.logs || {};
  if (!name) return json_({ ok: false, error: 'name required' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();
    var s = summarize_(statuses);
    var now = new Date();
    var payload = JSON.stringify({ statuses: statuses, logs: logs });
    var row = findRow_(sh, name);
    if (row < 0) {
      sh.appendRow([name, s.done, s.ip, s.left, now, payload]);
    } else {
      sh.getRange(row, 1, 1, 6).setValues([[name, s.done, s.ip, s.left, now, payload]]);
    }
    writeUserTab_(name, statuses, logs); // rebuild the trainee's formatted tab
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}
