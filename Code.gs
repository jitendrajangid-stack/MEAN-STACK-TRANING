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

function allTrainees_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 5).getValues(); // Name, Done, InProgress, Left, Updated
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    out.push({ name: vals[i][0], done: vals[i][1], ip: vals[i][2], left: vals[i][3], updated: vals[i][4] });
  }
  return out;
}

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
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}
