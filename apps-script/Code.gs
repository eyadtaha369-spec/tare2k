/**
 * TARE2K — Google Sheets backend (Apps Script Web App)
 *
 * Setup:
 *  1. Create a Google Sheet → Extensions → Apps Script → paste this file.
 *  2. Project Settings → Script properties → add SECRET = <long random string>
 *     (the same value goes in Vercel as APPS_SCRIPT_SECRET).
 *  3. Run the `setup` function once (accept permissions).
 *  4. Deploy → New deployment → Web app
 *       Execute as: Me    Who has access: Anyone
 *     Copy the /exec URL into Vercel as APPS_SCRIPT_URL.
 *  After editing this code: Deploy → Manage deployments → Edit → Version: New version.
 */

var BOOKINGS = 'Bookings';
var OVERRIDES = 'Overrides';
var USERS = 'Users';
var USER_COLS = ['id', 'name', 'username', 'password_hash', 'role', 'is_active', 'created_at', 'created_by'];
var COLS = [
  'id', 'created_at', 'status', 'trip_code', 'trip_date', 'direction', 'area', 'pickup_spot',
  'full_name', 'phone', 'sender_account', 'payment_method', 'receipt_file_id', 'pass_token',
  'reviewed_at', 'reviewed_by', 'checked_in_at', 'checked_in_by'
];
var OV_COLS = ['trip_code', 'trip_date', 'mode', 'updated_at', 'updated_by'];
var TZ = 'Africa/Cairo';

function setup() {
  var ss = SpreadsheetApp.getActive();
  var b = ss.getSheetByName(BOOKINGS) || ss.insertSheet(BOOKINGS);
  b.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold').setBackground('#a31515').setFontColor('#ffffff');
  b.setFrozenRows(1);
  b.getRange(2, 1, b.getMaxRows() - 1, COLS.length).setNumberFormat('@'); // keep phones/dates as text
  var o = ss.getSheetByName(OVERRIDES) || ss.insertSheet(OVERRIDES);
  o.getRange(1, 1, 1, OV_COLS.length).setValues([OV_COLS]).setFontWeight('bold');
  o.setFrozenRows(1);
  o.getRange(2, 1, o.getMaxRows() - 1, OV_COLS.length).setNumberFormat('@');
  var u = ss.getSheetByName(USERS) || ss.insertSheet(USERS);
  u.getRange(1, 1, 1, USER_COLS.length).setValues([USER_COLS]).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
  u.setFrozenRows(1);
  u.getRange(2, 1, u.getMaxRows() - 1, USER_COLS.length).setNumberFormat('@');
  receiptsFolder_();
}

/* ───────────── HTTP entry ───────────── */

function doGet() {
  return json_({ ok: true, service: 'TARE2K' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || req.secret !== secret) return json_({ error: 'Unauthorized' });
    var fn = ACTIONS[req.action];
    if (!fn) return json_({ error: 'Unknown action' });
    return json_(fn(req.payload || {}));
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

var ACTIONS = {
  createBooking: createBooking_,
  listBookings: listBookings_,
  findByToken: findByToken_,
  updateStatus: updateStatus_,
  checkin: checkin_,
  getReceipt: getReceipt_,
  getOverrides: getOverrides_,
  setOverride: setOverride_,
  listUsers: listUsers_,
  getUserByUsername: getUserByUsername_,
  getUser: getUser_,
  createUser: createUser_,
  setUserActive: setUserActive_,
  deleteUser: deleteUser_
};

/* ───────────── Bookings ───────────── */

function createBooking_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var rows = readAll_();
    var dup = rows.some(function (r) {
      return r.phone === p.phone && r.trip_code === p.trip_code && r.trip_date === p.trip_date &&
        (r.status === 'pending' || r.status === 'approved');
    });
    if (dup) return { error: 'duplicate' };

    var id = Utilities.getUuid();
    var bytes = Utilities.base64Decode(p.receipt.base64);
    var blob = Utilities.newBlob(bytes, p.receipt.mimeType, p.trip_date + '_' + p.trip_code + '_' + p.phone + '_' + id.slice(0, 8));
    var file = receiptsFolder_().createFile(blob);

    var rec = {
      id: id, created_at: new Date().toISOString(), status: 'pending',
      trip_code: p.trip_code, trip_date: p.trip_date, direction: p.direction, area: p.area,
      pickup_spot: p.pickup_spot, full_name: p.full_name, phone: p.phone,
      sender_account: p.sender_account, payment_method: p.payment_method, receipt_file_id: file.getId(),
      pass_token: '', reviewed_at: '', reviewed_by: '', checked_in_at: '', checked_in_by: ''
    };
    appendText_(sheet_(BOOKINGS), COLS.map(function (c) { return rec[c]; }));
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function listBookings_(p) {
  var rows = readAll_().filter(function (r) {
    if (p.status && p.status !== 'all' && r.status !== p.status) return false;
    if (p.trip_code && p.trip_code !== 'all' && r.trip_code !== p.trip_code) return false;
    if (p.trip_date && r.trip_date !== p.trip_date) return false;
    return true;
  });
  rows.sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
  return { bookings: rows };
}

function findByToken_(p) {
  if (!p.token) return { booking: null };
  var r = readAll_().filter(function (x) { return x.pass_token === p.token; })[0];
  return { booking: r || null };
}

function updateStatus_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = findRow_('id', p.id);
    if (!found) return { error: 'Not found' };
    var r = found.record;
    r.status = p.status;
    if (p.status === 'approved') {
      if (!r.pass_token) r.pass_token = p.pass_token;
      r.reviewed_at = new Date().toISOString();
      r.reviewed_by = p.by || '';
    } else if (p.status === 'rejected') {
      r.reviewed_at = new Date().toISOString();
      r.reviewed_by = p.by || '';
    } else {
      r.reviewed_at = '';
      r.reviewed_by = '';
    }
    writeRow_(found.row, r);
    return { booking: r };
  } finally {
    lock.releaseLock();
  }
}

function checkin_(p) {
  if (p.staff_id && p.staff_id !== 'admin') {
    var u = findUser_('id', p.staff_id);
    if (!u || u.record.is_active !== 'TRUE') return { result: 'invalid', message: 'Your account is deactivated.', revoked: true };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = findRow_('pass_token', p.token);
    if (!found) return { result: 'invalid', message: 'Pass not found.' };
    var b = found.record;
    if (b.status !== 'approved') return { result: 'invalid', message: 'Booking is ' + b.status + '.', booking: b };
    if (p.trip_code && p.trip_date && (b.trip_code !== p.trip_code || b.trip_date !== p.trip_date)) {
      return { result: 'wrong_trip', message: 'This pass is for a different trip.', booking: b };
    }
    if (b.checked_in_at) return { result: 'already', message: 'Already boarded.', booking: b };
    if (!p.confirm) return { result: 'valid', booking: b };
    b.checked_in_at = new Date().toISOString();
    b.checked_in_by = p.by || '';
    writeRow_(found.row, b);
    return { result: 'boarded', booking: b };
  } finally {
    lock.releaseLock();
  }
}

function getReceipt_(p) {
  var found = findRow_('id', p.id);
  if (!found || !found.record.receipt_file_id) return { error: 'Not found' };
  var blob = DriveApp.getFileById(found.record.receipt_file_id).getBlob();
  return { mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

/* ───────────── Overrides ───────────── */

function getOverrides_() {
  var sh = sheet_(OVERRIDES);
  var last = sh.getLastRow();
  if (last < 2) return { overrides: [] };
  var vals = sh.getRange(2, 1, last - 1, OV_COLS.length).getValues();
  return {
    overrides: vals.filter(function (v) { return v[0]; }).map(function (v) {
      return { trip_code: str_(v[0]), trip_date: str_(v[1]), mode: str_(v[2]) };
    })
  };
}

function setOverride_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(OVERRIDES);
    var last = sh.getLastRow();
    var vals = last >= 2 ? sh.getRange(2, 1, last - 1, OV_COLS.length).getValues() : [];
    for (var i = vals.length - 1; i >= 0; i--) {
      if (str_(vals[i][0]) === p.trip_code && str_(vals[i][1]) === p.trip_date) sh.deleteRow(i + 2);
    }
    if (p.mode === 'open' || p.mode === 'closed') {
      appendText_(sh, [p.trip_code, p.trip_date, p.mode, new Date().toISOString(), p.by || '']);
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ───────────── Users (supervisors) ───────────── */

function userSheet_() { return sheet_(USERS); }

function readUsers_() {
  var sh = userSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, USER_COLS.length).getValues()
    .filter(function (v) { return v[0]; })
    .map(function (v) { var r = {}; USER_COLS.forEach(function (c, i) { r[c] = str_(v[i]); }); return r; });
}

function findUser_(col, value) {
  if (!value) return null;
  var sh = userSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var idx = USER_COLS.indexOf(col);
  var vals = sh.getRange(2, 1, last - 1, USER_COLS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (str_(vals[i][idx]).toLowerCase() === String(value).toLowerCase()) {
      var r = {}; USER_COLS.forEach(function (c, j) { r[c] = str_(vals[i][j]); });
      return { row: i + 2, record: r };
    }
  }
  return null;
}

function publicUser_(u) {
  return { id: u.id, name: u.name, username: u.username, role: u.role, is_active: u.is_active === 'TRUE', created_at: u.created_at, created_by: u.created_by };
}

function listUsers_() {
  return { users: readUsers_().map(publicUser_).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }) };
}

/** Used only by the server for login — includes the password hash. */
function getUserByUsername_(p) {
  var f = findUser_('username', p.username);
  return { user: f ? f.record : null };
}

function getUser_(p) {
  var f = findUser_('id', p.id);
  return { user: f ? publicUser_(f.record) : null };
}

function createUser_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (findUser_('username', p.username)) return { error: 'username_taken' };
    var rec = {
      id: Utilities.getUuid(), name: p.name, username: String(p.username).toLowerCase(),
      password_hash: p.password_hash, role: 'supervisor', is_active: 'TRUE',
      created_at: new Date().toISOString(), created_by: p.by || ''
    };
    appendText_(userSheet_(), USER_COLS.map(function (c) { return rec[c]; }));
    return { user: publicUser_(rec) };
  } finally {
    lock.releaseLock();
  }
}

function setUserActive_(p) {
  var f = findUser_('id', p.id);
  if (!f) return { error: 'Not found' };
  userSheet_().getRange(f.row, USER_COLS.indexOf('is_active') + 1).setNumberFormat('@').setValues([[p.active ? 'TRUE' : 'FALSE']]);
  f.record.is_active = p.active ? 'TRUE' : 'FALSE';
  return { user: publicUser_(f.record) };
}

function deleteUser_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var f = findUser_('id', p.id);
    if (!f) return { error: 'Not found' };
    userSheet_().deleteRow(f.row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ───────────── Helpers ───────────── */

function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) { setup(); sh = SpreadsheetApp.getActive().getSheetByName(name); }
  return sh;
}

function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}

function readAll_() {
  var sh = sheet_(BOOKINGS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, COLS.length).getValues();
  return vals.filter(function (v) { return v[0]; }).map(toRecord_);
}

function toRecord_(v) {
  var r = {};
  COLS.forEach(function (c, i) { r[c] = str_(v[i]); });
  return r;
}

function findRow_(col, value) {
  if (!value) return null;
  var sh = sheet_(BOOKINGS);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var idx = COLS.indexOf(col);
  var vals = sh.getRange(2, 1, last - 1, COLS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (str_(vals[i][idx]) === value) return { row: i + 2, record: toRecord_(vals[i]) };
  }
  return null;
}

function writeRow_(row, rec) {
  sheet_(BOOKINGS).getRange(row, 1, 1, COLS.length).setNumberFormat('@')
    .setValues([COLS.map(function (c) { return rec[c]; })]);
}

/** Appends a row stored as plain text (stops Sheets turning phones/dates into numbers). */
function appendText_(sh, values) {
  sh.getRange(sh.getLastRow() + 1, 1, 1, values.length).setNumberFormat('@').setValues([values]);
}

function receiptsFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('RECEIPTS_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* recreate */ }
  }
  var folder = DriveApp.createFolder('TARE2K Receipts');
  props.setProperty('RECEIPTS_FOLDER_ID', folder.getId());
  return folder;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
