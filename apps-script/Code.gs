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
  'reviewed_at', 'reviewed_by', 'checked_in_at', 'checked_in_by',
  // Payments & refunds
  'amount', 'refund_account', 'refund_reason', 'refund_requested_at',
  'refund_amount', 'refund_ref', 'refund_receipt_file_id', 'refunded_at', 'refunded_by',
  // Weekly archive
  'is_archived', 'archived_at', 'archive_batch',
  // Group bookings (one payment, one row + QR pass per passenger)
  'group_id', 'group_size', 'booked_by_name', 'booked_by_phone'
];
var CANCELLED = ['refund_requested', 'refunded', 'cancelled'];
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
    ensureBookingHeader_();
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
  requestRefund: requestRefund_,
  processRefund: processRefund_,
  getRefundReceipt: getRefundReceipt_,
  archiveAll: archiveAll_,
  updateGroupStatus: updateGroupStatus_,
  deleteBooking: deleteBooking_,
  listUsers: listUsers_,
  getUserByUsername: getUserByUsername_,
  getUser: getUser_,
  createUser: createUser_,
  setUserActive: setUserActive_,
  deleteUser: deleteUser_
};

/* ───────────── Bookings ───────────── */

/**
 * Creates one row per passenger. A group shares one payment (and one receipt for transfers).
 * p.passengers = [{ full_name, phone, area, pickup_spot, amount }]  (old single-passenger payloads still work)
 */
function createBooking_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var passengers = p.passengers && p.passengers.length ? p.passengers
      : [{ full_name: p.full_name, phone: p.phone, area: p.area, pickup_spot: p.pickup_spot, amount: p.amount }];

    var rows = readAll_();
    var dups = passengers.filter(function (x) {
      return rows.some(function (r) {
        return r.is_archived !== 'TRUE' && r.phone === x.phone && r.trip_code === p.trip_code && r.trip_date === p.trip_date &&
          (r.status === 'pending' || r.status === 'approved');
      });
    }).map(function (x) { return x.phone; });
    if (dups.length) return { error: 'duplicate:' + dups.join(',') };

    var fileId = '';
    if (p.receipt && p.receipt.base64) {
      var blob = Utilities.newBlob(Utilities.base64Decode(p.receipt.base64), p.receipt.mimeType,
        p.trip_date + '_' + p.trip_code + '_' + passengers[0].phone + '_x' + passengers.length);
      fileId = receiptsFolder_().createFile(blob).getId();
    }

    var groupId = passengers.length > 1 ? Utilities.getUuid() : '';
    var now = new Date().toISOString();
    var sh = sheet_(BOOKINGS);
    var out = passengers.map(function (x) {
      return {
        id: Utilities.getUuid(), created_at: now, status: 'pending',
        trip_code: p.trip_code, trip_date: p.trip_date, direction: p.direction, area: x.area,
        pickup_spot: x.pickup_spot, full_name: x.full_name, phone: x.phone,
        sender_account: p.sender_account || '', payment_method: p.payment_method, receipt_file_id: fileId,
        pass_token: '', reviewed_at: '', reviewed_by: '', checked_in_at: '', checked_in_by: '',
        amount: x.amount === undefined || x.amount === null ? '' : String(x.amount),
        group_id: groupId, group_size: groupId ? String(passengers.length) : '',
        booked_by_name: groupId ? passengers[0].full_name : '', booked_by_phone: groupId ? passengers[0].phone : ''
      };
    });
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, out.length, COLS.length).setNumberFormat('@')
      .setValues(out.map(function (rec) { return COLS.map(function (c) { return rec[c] === undefined ? '' : rec[c]; }); }));
    return { ok: true, ids: out.map(function (r) { return r.id; }), id: out[0].id, group_id: groupId };
  } finally {
    lock.releaseLock();
  }
}

/** Approve or reject every pending passenger of a group in one go. p.tokens = fresh pass tokens (one per row). */
function updateGroupStatus_(p) {
  if (!p.group_id) return { error: 'Missing group' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(BOOKINGS);
    var last = sh.getLastRow();
    if (last < 2) return { bookings: [] };
    var vals = sh.getRange(2, 1, last - 1, COLS.length).getValues();
    var gi = COLS.indexOf('group_id');
    var now = new Date().toISOString();
    var t = 0, changed = [];
    for (var i = 0; i < vals.length; i++) {
      if (str_(vals[i][gi]) !== p.group_id) continue;
      var r = toRecord_(vals[i]);
      if (r.status !== 'pending') continue;
      r.status = p.status;
      if (p.status === 'approved' && !r.pass_token) r.pass_token = (p.tokens || [])[t++] || '';
      r.reviewed_at = now; r.reviewed_by = p.by || '';
      writeRow_(i + 2, r);
      changed.push(r);
    }
    return { bookings: changed };
  } finally {
    lock.releaseLock();
  }
}

function listBookings_(p) {
  var scope = p.archived || 'active'; // active | archived | all
  var rows = readAll_().filter(function (r) {
    var arch = r.is_archived === 'TRUE';
    if (scope === 'active' && arch) return false;
    if (scope === 'archived' && !arch) return false;
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
    var now = new Date().toISOString();
    if (p.status === 'approved') {
      if (r.status !== 'pending' && r.status !== 'rejected' && r.status !== 'no_show') return { error: 'Only pending, rejected or no-show bookings can be approved.' };
      if (!r.pass_token) r.pass_token = p.pass_token;
      r.reviewed_at = now; r.reviewed_by = p.by || '';
    } else if (p.status === 'rejected') {
      if (r.status !== 'pending') return { error: 'Only pending bookings can be rejected.' };
      r.reviewed_at = now; r.reviewed_by = p.by || '';
    } else if (p.status === 'no_show') {
      if (r.status !== 'approved' || r.checked_in_at) return { error: 'Only approved passengers who did not board can be marked no-show.' };
      r.reviewed_at = now; r.reviewed_by = p.by || '';
    } else if (p.status === 'pending') {
      if (r.status !== 'rejected' && r.status !== 'approved') return { error: 'This booking cannot be moved back to pending.' };
      if (r.checked_in_at) return { error: 'Passenger already boarded.' };
      r.reviewed_at = ''; r.reviewed_by = '';
    } else {
      return { error: 'Unknown status' };
    }
    r.status = p.status;
    writeRow_(found.row, r);
    return { booking: r };
  } finally {
    lock.releaseLock();
  }
}

/** Student cancels from their pass page. The server has already checked the 6-hour cutoff. */
function requestRefund_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = findRow_('pass_token', p.token);
    if (!found) return { error: 'Pass not found.' };
    var r = found.record;
    if (r.status !== 'approved' || r.is_archived === 'TRUE') return { error: 'This booking can no longer be cancelled.' };
    if (r.checked_in_at) return { error: 'You already boarded this trip.' };
    // Cash-on-bus seats were never paid, so they're simply cancelled
    r.status = r.payment_method === 'cash_on_bus' ? 'cancelled' : 'refund_requested';
    r.refund_account = p.refund_account;
    r.refund_reason = p.refund_reason || '';
    r.refund_requested_at = new Date().toISOString();
    writeRow_(found.row, r);
    return { booking: r };
  } finally {
    lock.releaseLock();
  }
}

/** Admin confirms the refund transfer. */
function processRefund_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = findRow_('id', p.id);
    if (!found) return { error: 'Not found' };
    var r = found.record;
    if (r.status !== 'refund_requested') return { error: 'Only refund requests can be refunded.' };
    if (p.receipt && p.receipt.base64) {
      var blob = Utilities.newBlob(Utilities.base64Decode(p.receipt.base64), p.receipt.mimeType,
        'REFUND_' + r.trip_date + '_' + r.phone + '_' + r.id.slice(0, 8));
      r.refund_receipt_file_id = receiptsFolder_().createFile(blob).getId();
    }
    r.status = 'refunded';
    r.refund_amount = String(p.amount);
    r.refund_ref = p.ref || '';
    r.refunded_at = new Date().toISOString();
    r.refunded_by = p.by || '';
    writeRow_(found.row, r);
    return { booking: r };
  } finally {
    lock.releaseLock();
  }
}

/** "Start new week": archives every active booking in one batch. Nothing is deleted. */
function archiveAll_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = sheet_(BOOKINGS);
    var last = sh.getLastRow();
    if (last < 2) return { archived: 0 };
    var colArch = COLS.indexOf('is_archived') + 1;
    var range = sh.getRange(2, colArch, last - 1, 3); // is_archived, archived_at, archive_batch
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    var vals = range.getValues();
    var now = new Date().toISOString();
    var batch = p.batch || now.slice(0, 10);
    var n = 0;
    for (var i = 0; i < vals.length; i++) {
      if (!ids[i][0] || str_(vals[i][0]) === 'TRUE') continue;
      vals[i] = ['TRUE', now, batch];
      n++;
    }
    range.setNumberFormat('@').setValues(vals);
    return { archived: n, batch: batch };
  } finally {
    lock.releaseLock();
  }
}

/** Permanently deletes a booking row and moves its receipt images to Drive trash. */
function deleteBooking_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var found = findRow_('id', p.id);
    if (!found) return { error: 'Not found' };
    var shared = found.record.receipt_file_id && readAll_().some(function (r) {
      return r.id !== found.record.id && r.receipt_file_id === found.record.receipt_file_id;
    });
    [shared ? '' : found.record.receipt_file_id, found.record.refund_receipt_file_id].forEach(function (fid) {
      if (!fid) return;
      try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) { /* already gone */ }
    });
    sheet_(BOOKINGS).deleteRow(found.row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function getRefundReceipt_(p) {
  var found = findRow_('id', p.id);
  if (!found || !found.record.refund_receipt_file_id) return { error: 'Not found' };
  var blob = DriveApp.getFileById(found.record.refund_receipt_file_id).getBlob();
  return { mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
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
    if (b.is_archived === 'TRUE') return { result: 'invalid', message: 'This pass is from a past week (archived).', booking: b };
    if (CANCELLED.indexOf(b.status) >= 0) {
      return { result: 'cancelled', message: 'CANCELLED / REFUNDED TICKET - DO NOT BOARD', booking: b };
    }
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

/** Adds any new columns to the Bookings header (safe to run on every request). */
function ensureBookingHeader_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(BOOKINGS);
  if (!sh) return;
  var head = sh.getRange(1, 1, 1, COLS.length).getValues()[0];
  if (str_(head[COLS.length - 1]) === COLS[COLS.length - 1]) return;
  sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold').setBackground('#a31515').setFontColor('#ffffff');
}

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
