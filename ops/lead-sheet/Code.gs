/**
 * VIP GROUP — Sổ lead website (Google Apps Script gắn với Google Sheet "Lead vipgroup.com.vn").
 * VIPG-WEB-023. Hướng dẫn cài: docs/HUONG_DAN_CAI_DAT_THU_LEAD.md.
 *
 * Script Properties (Project Settings → Script properties — KHÔNG ghi vào code):
 *   SHEET_WEBHOOK_SECRET   chuỗi bí mật dài, trùng với biến SHEET_WEBHOOK_SECRET trên Cloudflare (bắt buộc)
 *   CRM_INTAKE_URL         https://…/api/intake/leads của CRM V5 (để trống = chưa đồng bộ CRM)
 *   LEAD_INTAKE_SECRET     khoá HMAC chung với CRM V5
 *   ZALO_BOT_TOKEN, ZALO_NOTIFY_CHAT_ID  (tuỳ chọn) để báo sự cố đồng bộ CRM qua Zalo; không có thì gửi email
 *   ALERT_EMAIL            (tuỳ chọn) email nhận cảnh báo — mặc định email tài khoản chạy script
 *
 * Website gọi doPost với {secret, action:'append', lead}. Trả {ok, lead_id, duplicate}.
 * Hàm syncPendingToCrm chạy theo trigger 10 phút: đẩy lead chưa đồng bộ sang CRM, ký HMAC trên đúng chuỗi gửi đi.
 */

var SHEET_NAME = 'Leads';
var HEADERS = ['lead_id', 'thời gian', 'họ tên', 'số điện thoại', 'email', 'nhu cầu', 'khối lượng (kg)', 'nội dung',
  'trang', 'utm_source', 'utm_medium', 'utm_campaign', 'đồng ý lúc', 'idempotency_key',
  'trạng thái CRM', 'CRM lead id', 'lần thử CRM', 'lỗi CRM gần nhất', 'ghi chú nhân viên',
  // V1.2 — thêm cột MỚI ở CUỐI để không lệch cột cũ.
  'tuyến'];
var COL = {}; HEADERS.forEach(function (h, i) { COL[h] = i + 1; });

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  } else if (sh.getLastColumn() < HEADERS.length) {
    // Sheet tạo từ phiên bản cũ: bổ sung tiêu đề cột mới (không đụng dữ liệu cũ).
    var from = sh.getLastColumn() + 1;
    sh.getRange(1, from, 1, HEADERS.length - from + 1).setValues([HEADERS.slice(from - 1)]).setFontWeight('bold');
  }
  return sh;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length || a.length === 0) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Chặn công thức bảng tính (=, +, -, @) do khách nhập. */
function cell_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function newLeadId_() {
  var d = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd');
  var r = Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  return 'VG-' + d + '-' + r;
}

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'json' }); }
  if (!safeEqual_(body.secret, props.getProperty('SHEET_WEBHOOK_SECRET'))) return out_({ ok: false, error: 'auth' });
  if (body.action !== 'append' || !body.lead) return out_({ ok: false, error: 'action' });

  var lead = body.lead;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();
    var last = sh.getLastRow();
    // Chống trùng (khách bấm gửi 2 lần / mạng gửi lại): tìm idempotency_key trong 500 dòng gần nhất.
    if (last > 1) {
      var from = Math.max(2, last - 499);
      var keys = sh.getRange(from, COL['idempotency_key'], last - from + 1, 1).getValues();
      for (var i = keys.length - 1; i >= 0; i--) {
        if (keys[i][0] === lead.idempotency_key) {
          return out_({ ok: true, lead_id: sh.getRange(from + i, COL['lead_id']).getValue(), duplicate: true });
        }
      }
    }
    var id = newLeadId_();
    var u = lead.utm || {};
    // Thời gian ISO ghi dạng CHỮ (dấu ' đầu) để Sheets không tự đổi sang ngày theo múi giờ → gửi CRM đúng nguyên văn.
    sh.appendRow([id, "'" + lead.created_at, cell_(lead.name), "'" + lead.phone, cell_(lead.email), lead.need,
      lead.weight_kg === null ? '' : lead.weight_kg, cell_(lead.message), cell_(lead.page),
      cell_(u.source), cell_(u.medium), cell_(u.campaign), "'" + lead.consent_at, lead.idempotency_key,
      props.getProperty('CRM_INTAKE_URL') ? 'chờ đồng bộ' : 'chưa cấu hình CRM', '', 0, '', '', lead.route || 'chua-ro']);
    SpreadsheetApp.flush();
    return out_({ ok: true, lead_id: id, duplicate: false });
  } finally {
    lock.releaseLock();
  }
}

/** Chuỗi JSON gửi CRM — ký HMAC trên ĐÚNG chuỗi này (CRM yêu cầu raw body đúng từng byte). */
function crmPayload_(row) {
  var g = function (h) { return row[COL[h] - 1]; };
  var phone = String(g('số điện thoại')).replace(/^'/, '');
  var strip = function (v) { return String(v || '').replace(/^'/, ''); };
  return JSON.stringify({
    lead_id: g('lead_id'), source: 'vipgroup.com.vn', page: strip(g('trang')),
    utm: { source: strip(g('utm_source')), medium: strip(g('utm_medium')), campaign: strip(g('utm_campaign')) },
    name: strip(g('họ tên')), phone: phone, email: strip(g('email')) || null, need: g('nhu cầu'),
    weight_kg: g('khối lượng (kg)') === '' ? null : Number(g('khối lượng (kg)')),
    // Hợp đồng CRM V5 không có trường tuyến → ghép vào đầu nội dung (không đổi hợp đồng).
    message: (g('tuyến') && g('tuyến') !== 'chua-ro' ? '[Tuyến: ' + g('tuyến') + '] ' : '') + strip(g('nội dung')), consent_at: strip(g('đồng ý lúc')), created_at: strip(g('thời gian')),
  });
}

function hmacHex_(secret, text) {
  var bytes = Utilities.computeHmacSha256Signature(text, secret, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Trigger mỗi 10 phút. Đẩy lead "chờ đồng bộ"/"lỗi tạm" sang CRM. 4xx (trừ 401/408/429) = lỗi dữ liệu, không gửi lại. */
function syncPendingToCrm() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('CRM_INTAKE_URL');
  var secret = props.getProperty('LEAD_INTAKE_SECRET');
  if (!url || !secret) return;
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return;
  var rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var sent = 0;
  for (var i = 0; i < rows.length && sent < 50; i++) {
    // Nghỉ 2,5 s giữa các lần gửi → ~24 lead/phút, luôn dưới ngưỡng CRM 30/phút/IP (50 lead ≈ 2 phút < giới hạn 6 phút).
    var st = rows[i][COL['trạng thái CRM'] - 1];
    if (st !== 'chờ đồng bộ' && st !== 'chưa cấu hình CRM' && st !== 'lỗi tạm') continue;
    var rowNo = i + 2;
    if (sent > 0) Utilities.sleep(2500);
    var payload = crmPayload_(rows[i]);
    var ts = String(Math.floor(Date.now() / 1000));
    var res, code, text;
    try {
      res = UrlFetchApp.fetch(url, {
        method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true,
        headers: { 'X-Lead-Timestamp': ts, 'X-Lead-Signature': hmacHex_(secret, ts + '.' + payload), 'Idempotency-Key': rows[i][0] },
      });
      code = res.getResponseCode(); text = res.getContentText().slice(0, 300);
    } catch (err) { code = 0; text = String(err).slice(0, 300); }
    sent++;
    var tries = Number(rows[i][COL['lần thử CRM'] - 1] || 0) + 1;
    sh.getRange(rowNo, COL['lần thử CRM']).setValue(tries);
    if (code === 401) {
      // Khoá sai / lệch đồng hồ: gửi tiếp vô ích. Dừng lượt này; 3 lượt liên tiếp → cảnh báo owner MỘT lần.
      sh.getRange(rowNo, COL['trạng thái CRM']).setValue('lỗi tạm');
      sh.getRange(rowNo, COL['lỗi CRM gần nhất']).setValue('401 ' + text);
      var streak = Number(props.getProperty('CRM_AUTH_FAIL_STREAK') || 0) + 1;
      props.setProperty('CRM_AUTH_FAIL_STREAK', String(streak));
      if (streak >= 3 && props.getProperty('CRM_AUTH_ALERTED') !== '1') {
        alertOwner_('⚠️ VIP GROUP Lead: CRM từ chối chữ ký (401) ' + streak + ' lượt liên tiếp. Kiểm tra LEAD_INTAKE_SECRET trong Script Properties (khớp khoá CRM) hoặc đồng hồ. Lead vẫn an toàn trong Sheet, sẽ tự gửi lại khi sửa xong.');
        props.setProperty('CRM_AUTH_ALERTED', '1');
      }
      return;
    }
    props.deleteProperty('CRM_AUTH_FAIL_STREAK');
    props.deleteProperty('CRM_AUTH_ALERTED');
    if (code === 200 || code === 201) {
      var crmId = ''; try { crmId = JSON.parse(text).crm_lead_id || ''; } catch (e2) {}
      sh.getRange(rowNo, COL['trạng thái CRM']).setValue('đã đồng bộ');
      sh.getRange(rowNo, COL['CRM lead id']).setValue(crmId);
      sh.getRange(rowNo, COL['lỗi CRM gần nhất']).setValue('');
    } else if (code >= 400 && code < 500 && [401, 408, 429].indexOf(code) < 0) {
      sh.getRange(rowNo, COL['trạng thái CRM']).setValue('lỗi dữ liệu');
      sh.getRange(rowNo, COL['lỗi CRM gần nhất']).setValue(code + ' ' + text);
    } else {
      sh.getRange(rowNo, COL['trạng thái CRM']).setValue('lỗi tạm');
      sh.getRange(rowNo, COL['lỗi CRM gần nhất']).setValue(code + ' ' + text);
    }
  }
}

/** Cảnh báo vận hành cho owner: Zalo Bot nếu có cấu hình, nếu không thì email. Không chứa dữ liệu khách. */
function alertOwner_(text) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('ZALO_BOT_TOKEN'), chat = props.getProperty('ZALO_NOTIFY_CHAT_ID');
  try {
    if (token && chat) {
      UrlFetchApp.fetch('https://bot-api.zapps.me/bot' + token + '/sendMessage', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify({ chat_id: chat, text: text }),
      });
      return;
    }
  } catch (e) { /* rơi xuống email */ }
  MailApp.sendEmail(props.getProperty('ALERT_EMAIL') || Session.getEffectiveUser().getEmail(), 'VIP GROUP Lead — cảnh báo đồng bộ CRM', text);
}

/** Chạy tay MỘT lần sau khi dán code: tạo trigger 10 phút + kiểm cấu hình. */
function caiDat() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncPendingToCrm') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncPendingToCrm').timeBased().everyMinutes(10).create();
  sheet_();
  var s = PropertiesService.getScriptProperties().getProperty('SHEET_WEBHOOK_SECRET');
  Logger.log(s && s.length >= 32 ? 'OK: đã tạo trigger, SHEET_WEBHOOK_SECRET hợp lệ' : 'THIẾU: đặt SHEET_WEBHOOK_SECRET (≥ 32 ký tự) trong Script properties');
}
