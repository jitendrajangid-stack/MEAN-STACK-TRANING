/**
 * MEAN Training Plan — progress storage backend (Google Apps Script)
 * Stores each trainee's per-day status in a Google Sheet.
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
  var key = String(name).trim().toLowerCase();
  var vals = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
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

function doGet(e) {
  var name = (e && e.parameter && e.parameter.name || '').trim();
  if (!name) return json_({ name: '', statuses: {} });
  var sh = sheet_();
  var row = findRow_(sh, name);
  if (row < 0) return json_({ name: name, statuses: {} });
  var data = sh.getRange(row, 6).getValue();
  var statuses = {};
  try { statuses = JSON.parse(data) || {}; } catch (err) {}
  var updated = sh.getRange(row, 5).getValue();
  return json_({ name: name, statuses: statuses, updatedAt: updated });
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {
    return json_({ ok: false, error: 'bad json' });
  }
  var name = (body.name || '').trim();
  var statuses = body.statuses || {};
  if (!name) return json_({ ok: false, error: 'name required' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();
    var s = summarize_(statuses);
    var now = new Date();
    var payload = JSON.stringify(statuses);
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
