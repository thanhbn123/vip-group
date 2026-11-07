#!/usr/bin/env node
// Bộ kiểm hợp đồng VIP ID ⇄ CRM (cổng khách P1) — CHỈ dev/test, CHỈ dữ liệu tổng hợp.
// Không phụ thuộc gói ngoài (Node ≥ 20; đã chạy trên Node 26). Bám mã VIP ID @5e1effe
// (cowork/khach.py, cowork/khach_web.py) — xem ../BAN_GIAO_VIPID_CHO_CRM.md.
//
// Chế độ:
//   node contract-test.mjs crm       Kiểm PHÍA NHẬN của CRM (VIP ID → CRM + launch token). Mặc định.
//   node contract-test.mjs vipid     Kiểm một bên "VIP ID" (VIP ID dev thật hoặc chế độ receiver) — đóng vai CRM gửi.
//   node contract-test.mjs receiver  Máy nhận giả VIP ID: /api/internal/khach/* (ket-qua-duyet, tam-khoa, thu-hoi)
//                                    để CRM thử chữ ký chiều ra (outbox) mà không cần VIP ID.
//   node contract-test.mjs crm-ref   CRM tham chiếu tối giản (dùng để tự kiểm bộ kit với VIP ID thật).
//   node contract-test.mjs mint      In một launch token (stdout) từ KIT_LAUNCH_SUB/CRM_ID/PORTAL_CODE — thử tay.
//
// Bí mật: đọc từ TỆP (KIT_SECRET_FILE, dự phòng VIPID_PORTAL_SECRET_FILE). Không bao giờ in bí mật/chữ ký đầy đủ.
// Mã thoát: 0 = không có FAIL; 1 = có FAIL; 2 = cấu hình sai.

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

// ───────────────────────────── hằng số hợp đồng (từ mã VIP ID) ─────────────────────────────
export const HUONG_RA = 'vipid->crm';            // khach.py:35
export const HUONG_VAO = 'crm->vipid';           // khach.py:36
export const PATH_SIGNUP = '/api/internal/portal/signups';   // khach.py:37
export const PATH_THU_HOI_CRM = '/api/internal/portal/thu-hoi'; // khach.py:38
export const VIPID_PATHS = {
  ket_qua_duyet: '/api/internal/khach/ket-qua-duyet',      // khach_web.py:583
  tam_khoa: '/api/internal/khach/tam-khoa',                // khach_web.py:588
  thu_hoi: '/api/internal/khach/thu-hoi',                  // khach_web.py:593
};
export const AUD_LAUNCH = 'vip-crm-portal';      // khach.py:34
export const MAX_SKEW = 300;                     // khach.py:977
export const BODY_LIMIT = 10_000;                // khach_web.py:535 (10 000 byte, không phải 10 240)
export const LAUNCH_PATH = '/portal/auth/launch'; // khach.py:949

const env = process.env;
const now = () => Math.floor(Date.now() / 1000);

// ───────────────────────────── bí mật ─────────────────────────────
function loadSecret({ required = true } = {}) {
  const file = env.KIT_SECRET_FILE || env.VIPID_PORTAL_SECRET_FILE;
  if (!file) {
    if (!required) return null;
    die('Thiếu KIT_SECRET_FILE (đường dẫn tệp chứa VIPID_PORTAL_SECRET).');
  }
  let s;
  try { s = fs.readFileSync(file, 'utf8').trim(); } catch (e) { die(`Không đọc được tệp bí mật (${e.code}).`); }
  // VIP ID: config._secret() strip() ⇒ so sánh trên chuỗi đã bỏ khoảng trắng đầu/cuối.
  if (Buffer.byteLength(s, 'utf8') < 32) die('Bí mật < 32 byte (VIP ID từ chối khởi động với bí mật này).');
  return s;
}

function die(msg) { console.error(`[kit] LỖI CẤU HÌNH: ${msg}`); process.exit(2); }

// ───────────────────────────── chữ ký (khach.py:953-964) ─────────────────────────────
/** Chuỗi ký chuẩn: "<direction>.<METHOD>.<path>.<ts>." + body (byte). */
export function canonical(direction, method, path, ts, body) {
  return Buffer.concat([Buffer.from(`${direction}.${String(method).toUpperCase()}.${path}.${ts}.`, 'utf8'), toBuf(body)]);
}
export function sign(secret, direction, method, path, ts, body) {
  return crypto.createHmac('sha256', secret).update(canonical(direction, method, path, ts, body)).digest('hex');
}
/** Chuỗi ký CŨ (v1.1) — chỉ dùng để kiểm bên kia TỪ CHỐI nó. */
export function signLegacy(secret, direction, ts, body) {
  return crypto.createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${direction}.${ts}.`, 'utf8'), toBuf(body)])).digest('hex');
}
export function headersFor(secret, direction, method, path, body, ts = now()) {
  return { 'X-Portal-Ts': String(ts), 'X-Portal-Sig': sign(secret, direction, method, path, ts, body) };
}
const toBuf = (b) => (Buffer.isBuffer(b) ? b : Buffer.from(String(b ?? ''), 'utf8'));
function verifyIncoming(secret, direction, method, path, ts, sig, body) {
  sig = String(sig || '').trim().toLowerCase();
  ts = String(ts || '').trim();
  if (!/^[0-9a-f]{64}$/.test(sig) || !/^\d{1,12}$/.test(ts)) return 'sai';
  if (Math.abs(now() - Number(ts)) > MAX_SKEW) return 'sai';
  const want = Buffer.from(sign(secret, direction, method, path, ts, body), 'hex');
  const got = Buffer.from(sig, 'hex');
  return crypto.timingSafeEqual(want, got) ? 'ok' : 'sai';
}

// ───────────────────────────── launch token (khach.py:926-949) ─────────────────────────────
const b64u = (buf) => Buffer.from(buf).toString('base64url');
/** Nonce giống security.token_moi(18) = secrets.token_urlsafe(18): 24 ký tự base64url. */
export const newNonce = () => crypto.randomBytes(18).toString('base64url');
/**
 * Ký launch token ĐÚNG NHƯ VIP ID: header {"alg":"HS256","typ":"JWT"}, payload JSON gọn (không khoảng trắng),
 * thứ tự khoá ver, aud, sub, crm_customer_id, portal_code, iat, exp, nonce; base64url không padding.
 */
export function mintLaunch(secret, { sub, crm_customer_id, portal_code, iat = now(), ttl = 60, exp, nonce = newNonce(), ver = 1, aud = AUD_LAUNCH, header } = {}) {
  const h = b64u(JSON.stringify(header || { alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ ver, aud, sub, crm_customer_id, portal_code, iat, exp: exp ?? iat + ttl, nonce }));
  return `${h}.${p}.${b64u(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest())}`;
}
export function verifyLaunch(secret, token, nonces) {
  if (typeof token !== 'string' || token.length > 4096) return { error: 'TOKEN_INVALID' };
  const parts = token.split('.');
  if (parts.length !== 3 || !parts.every((x) => /^[A-Za-z0-9_-]+$/.test(x))) return { error: 'TOKEN_INVALID' };
  const [h, p, s] = parts;
  const want = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
  const got = Buffer.from(s, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { error: 'TOKEN_SIGNATURE' };
  let hd, c;
  try { hd = JSON.parse(Buffer.from(h, 'base64url')); c = JSON.parse(Buffer.from(p, 'base64url')); } catch { return { error: 'TOKEN_INVALID' }; }
  if (hd.alg !== 'HS256') return { error: 'TOKEN_ALG' };
  if (c.ver !== 1) return { error: 'TOKEN_VERSION' };
  if (c.aud !== AUD_LAUNCH) return { error: 'TOKEN_AUDIENCE' };
  if (!Number.isInteger(c.iat) || !Number.isInteger(c.exp) || c.exp <= c.iat || c.exp - c.iat > 60) return { error: 'TOKEN_TTL' };
  if (c.exp <= now()) return { error: 'TOKEN_EXPIRED' };
  if (c.iat - now() > 30) return { error: 'TOKEN_IAT_FUTURE' };
  if (typeof c.sub !== 'string' || !c.sub.startsWith('cust:') || !/^VG\d{6}$/.test(String(c.portal_code)) || !c.nonce) return { error: 'TOKEN_CLAIMS' };
  if (nonces) { if (nonces.has(c.nonce)) return { error: 'TOKEN_REPLAYED' }; nonces.add(c.nonce); }
  return { claims: c };
}

// ───────────────────────────── HTTP thô (cần đặt Host, gửi chunked, giữ nguyên byte) ─────────────────────────────
function request(url, { method = 'POST', headers = {}, body, chunked = false, host, timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const h = { ...headers };
    if (host) h.Host = host;
    const buf = body === undefined ? null : toBuf(body);
    if (buf && !chunked) h['Content-Length'] = String(buf.length);
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    const req = mod.request(u, { method, headers: h }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => fin({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', () => fin({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); fin({ status: 0, error: 'TIMEOUT', text: '' }); });
    req.on('error', (e) => fin({ status: 0, error: e.code || 'NETWORK', text: '' }));
    if (buf && chunked) { req.write(buf); req.end(); } else req.end(buf || undefined);
  });
}
const jparse = (t) => { try { return JSON.parse(t); } catch { return null; } };
/** Mã lỗi trong thân: VIP ID {"ok":false,"loi":{"ma"}} hoặc CRM {"error":{"code"}}. */
const errCode = (t) => { const j = jparse(t); return j?.loi?.ma ?? j?.error?.code ?? (typeof j?.error === 'string' ? j.error : '') ?? ''; };
const rand = (n) => Array.from(crypto.randomBytes(n), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
/** subject giống VIP ID: 'cust:kh_' + 26 ký tự [a-z0-9] (khach.py:600,608). */
const fakeSubject = () => `cust:kh_${rand(26)}`;
/** Thân JSON giống json.dumps(..., ensure_ascii=False, separators=(",",":")) của VIP ID (khach.py:1008). */
const vipJson = (o) => JSON.stringify(o);

// ───────────────────────────── bảng kết quả ─────────────────────────────
const results = [];
function record(id, name, status, detail = '') { results.push({ id, name, status, detail }); }
function expect(id, name, res, ok, want) {
  const got = res.status ? `${res.status}${errCode(res.text) ? ' ' + errCode(res.text) : ''}` : `lỗi mạng ${res.error}`;
  record(id, name, ok ? 'PASS' : 'FAIL', `mong ${want}; nhận ${got}`);
}
function printTable(title) {
  const w = (s, n) => (String(s).length >= n ? String(s) : String(s) + ' '.repeat(n - String(s).length));
  console.log(`\n== ${title} ==`);
  console.log(`${w('ID', 5)} ${w('KẾT QUẢ', 7)} ${w('KIỂM', 62)} CHI TIẾT`);
  for (const r of results) console.log(`${w(r.id, 5)} ${w(r.status, 7)} ${w(r.name, 62)} ${r.detail}`);
  const c = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nTổng: ${c('PASS')} PASS · ${c('FAIL')} FAIL · ${c('MANUAL')} MANUAL · ${c('SKIP')} SKIP · ${c('INFO')} INFO`);
  return c('FAIL') ? 1 : 0;
}

// ═════════════════════════════ CHẾ ĐỘ crm — kiểm phía nhận của CRM ═════════════════════════════
async function modeCrm() {
  const secret = loadSecret();
  const base = (env.KIT_CRM_URL || 'http://127.0.0.1:5175').replace(/\/+$/, '');           // CRM nội bộ (VIP ID gọi vào đây)
  const portalBase = (env.KIT_CRM_PORTAL_URL || base).replace(/\/+$/, '');              // nơi trình duyệt mở launch
  const portalHost = env.KIT_CRM_PORTAL_HOST || null;                                   // Host gửi kèm khi gọi launch
  const phone = env.KIT_PHONE || '+84900000009';
  const adminTokFile = env.KIT_CRM_ADMIN_TOKEN_FILE;
  const adminTok = adminTokFile ? fs.readFileSync(adminTokFile, 'utf8').trim() : null;
  const subject = fakeSubject();
  const tag = subject.slice(-6);
  const signupBody = (n) => vipJson({ subject, display_name: `Khách Kit ${tag}`, phone_e164: phone, email: `kit-${tag}@example.test`,
    phone_conflict: n > 0, phone_conflict_count: n });
  const idem = (n) => `signup:${subject}${n ? `:xung-dot-${n}` : ''}`;
  const post = (path, body, hdrs, opts = {}) => request(base + path, { body, headers: { 'Content-Type': 'application/json', ...hdrs }, ...opts });
  const signed = (path, body, extra = {}, ts) => ({ 'Idempotency-Key': extra.idem, ...headersFor(secret, HUONG_RA, 'POST', path, body, ts) });

  console.log(`[kit] crm: CRM=${base} · subject thử=${subject.slice(0, 14)}… · SĐT=${phone}`);
  // C01 đăng ký hợp lệ
  const b0 = signupBody(0);
  const h0 = signed(PATH_SIGNUP, b0, { idem: idem(0) });
  let r = await post(PATH_SIGNUP, b0, h0);
  expect('C01', 'signup hợp lệ (chuỗi ký mới) được nhận', r, r.status >= 200 && r.status < 300, '2xx');
  const accepted = r.status >= 200 && r.status < 300;
  // C02 phát lại y hệt
  r = await post(PATH_SIGNUP, b0, h0);
  expect('C02', 'phát lại y hệt (cùng ts+sig+body) bị từ chối', r, r.status === 409 || r.status === 401, '409 PHAT_LAI (hoặc 401)');
  // C03 ký cho path khác
  r = await post(PATH_SIGNUP, b0, { ...headersFor(secret, HUONG_RA, 'POST', PATH_THU_HOI_CRM, b0) });
  expect('C03', 'chữ ký của path khác (/thu-hoi) dùng ở /signups', r, r.status === 401, '401');
  // C04 ký method khác
  r = await post(PATH_SIGNUP, b0, { ...headersFor(secret, HUONG_RA, 'PUT', PATH_SIGNUP, b0) });
  expect('C04', 'chữ ký METHOD=PUT gửi bằng POST', r, r.status === 401, '401');
  // C05/C06 lệch giờ
  r = await post(PATH_SIGNUP, b0, headersFor(secret, HUONG_RA, 'POST', PATH_SIGNUP, b0, now() - 301));
  expect('C05', 'ts cũ 301 giây', r, r.status === 401, '401');
  r = await post(PATH_SIGNUP, b0, headersFor(secret, HUONG_RA, 'POST', PATH_SIGNUP, b0, now() + 301));
  expect('C06', 'ts tương lai +301 giây', r, r.status === 401, '401');
  // C07 chuỗi ký cũ
  { const ts = now(); r = await post(PATH_SIGNUP, b0, { 'X-Portal-Ts': String(ts), 'X-Portal-Sig': signLegacy(secret, HUONG_RA, ts, b0) }); }
  expect('C07', 'chuỗi ký CŨ "<dir>.<ts>.<body>" bị từ chối', r, r.status === 401, '401');
  // C08 sai chiều
  r = await post(PATH_SIGNUP, b0, headersFor(secret, HUONG_VAO, 'POST', PATH_SIGNUP, b0));
  expect('C08', 'chiều sai (crm->vipid) bị từ chối', r, r.status === 401, '401');
  // C09 body sửa sau khi ký
  r = await post(PATH_SIGNUP, b0.replace('Kit', 'Kjt'), headersFor(secret, HUONG_RA, 'POST', PATH_SIGNUP, b0));
  expect('C09', 'thân bị sửa sau khi ký', r, r.status === 401, '401');
  // C10 thiếu header
  r = await post(PATH_SIGNUP, b0, {});
  expect('C10', 'thiếu X-Portal-Ts/X-Portal-Sig', r, r.status === 401, '401');
  // C11 body > 10 000 byte, chữ ký hợp lệ (cùng subject ⇒ nếu lọt cũng chỉ là bản trùng)
  const pad = (n) => b0.slice(0, -1) + ' '.repeat(n - Buffer.byteLength(b0)) + '}';
  let big = pad(10_241); // vượt cả hai cách hiểu "10 KB" (10 000 của VIP ID và 10 240)
  r = await post(PATH_SIGNUP, big, headersFor(secret, HUONG_RA, 'POST', PATH_SIGNUP, big));
  expect('C11', `thân ${Buffer.byteLength(big)} byte (> 10 KB) có chữ ký đúng`, r, r.status === 413, '413');
  big = pad(BODY_LIMIT + 1); // VIP ID tự từ chối từ 10 001 byte (khach_web.py:535) — CRM nên dùng cùng ngưỡng
  r = await post(PATH_SIGNUP, big, headersFor(secret, HUONG_RA, 'POST', PATH_SIGNUP, big));
  record('C11b', `thân ${Buffer.byteLength(big)} byte (ngưỡng của VIP ID là 10 000)`, r.status === 413 ? 'PASS' : 'INFO',
    `nhận ${r.status} ${errCode(r.text)} (khuyến nghị 413; VIP ID không bao giờ gửi > 10 000)`);
  // C12 chunked không Content-Length — VIP ID tự từ chối kiểu này (413); CRM: chỉ ghi nhận
  r = await post(PATH_SIGNUP, b0, headersFor(secret, HUONG_RA, 'POST', PATH_SIGNUP, b0), { chunked: true });
  record('C12', 'chunked, không Content-Length (VIP ID không bao giờ gửi kiểu này)', 'INFO', `nhận ${r.status} ${errCode(r.text)}`);

  // C13/C14 upsert theo subject khi có xung đột SĐT (khach.py:698-707)
  const findRow = async () => {
    const rr = await request(`${base}/api/portal/signups?status=all`, { method: 'GET', headers: { Authorization: `Bearer ${adminTok}`, 'X-Requested-With': 'kit' } });
    const items = jparse(rr.text)?.items;
    return Array.isArray(items) ? { rows: items.filter((x) => x.subject === subject), status: rr.status } : { rows: null, status: rr.status };
  };
  for (const n of [1, 2]) {
    const b = signupBody(n);
    r = await post(PATH_SIGNUP, b, signed(PATH_SIGNUP, b, { idem: idem(n) }));
    expect(`C1${2 + n}`, `cập nhật signup phone_conflict_count=${n} (Idempotency-Key …:xung-dot-${n}) được nhận`, r,
      r.status >= 200 && r.status < 300, '2xx (409 = VIP ID coi là xong ⇒ cờ bị mất)');
    if (!accepted) continue;
    if (!adminTok) { record(`C1${2 + n}b`, `cờ phone_conflict hiện trên CÙNG dòng (n=${n})`, 'MANUAL', 'đặt KIT_CRM_ADMIN_TOKEN_FILE hoặc xem màn duyệt: 1 dòng, cờ + số lần'); continue; }
    const f = await findRow();
    if (!f.rows) { record(`C1${2 + n}b`, `cờ phone_conflict hiện trên CÙNG dòng (n=${n})`, 'MANUAL', `API quản trị trả ${f.status}`); continue; }
    const row = f.rows[0] || {};
    const ok = f.rows.length === 1 && row.phone_conflict === true && Number(row.phone_conflict_count) === n;
    record(`C1${2 + n}b`, `cờ phone_conflict hiện trên CÙNG dòng (n=${n})`, ok ? 'PASS' : 'FAIL',
      `số dòng=${f.rows.length}; phone_conflict=${row.phone_conflict}; phone_conflict_count=${row.phone_conflict_count}`);
  }
  // C15 thu-hoi cho subject lạ (VIP ID chỉ gửi cho subject của mình; CRM phải trả 2xx, không để VIP ID thử lại mãi)
  { const s2 = fakeSubject(); const b = vipJson({ subject: s2, reason: 'dang_xuat' });
    r = await post(PATH_THU_HOI_CRM, b, signed(PATH_THU_HOI_CRM, b, { idem: `thu-hoi:${s2}:dang_xuat:${rand(8)}` }));
    expect('C15', 'thu-hoi {subject, reason:"dang_xuat"} chữ ký đúng', r, r.status >= 200 && r.status < 300, '2xx'); }
  // C16 endpoint nội bộ trên host cổng khách
  if (portalHost) {
    r = await post(PATH_SIGNUP, b0, headersFor(secret, HUONG_RA, 'POST', PATH_SIGNUP, b0), { host: portalHost });
    expect('C16', `/api/internal/portal/* trên Host cổng (${portalHost}) bị chặn`, r, r.status === 404, '404');
  } else record('C16', '/api/internal/portal/* trên Host cổng bị chặn', 'SKIP', 'đặt KIT_CRM_PORTAL_HOST');

  // ── launch token
  const launch = (tok) => request(`${portalBase}${LAUNCH_PATH}?token=${encodeURIComponent(tok)}`, { method: 'GET', host: portalHost || undefined });
  const L = { sub: env.KIT_LAUNCH_SUB, crm_customer_id: env.KIT_LAUNCH_CRM_ID, portal_code: env.KIT_LAUNCH_PORTAL_CODE };
  const have = !!(L.sub && L.crm_customer_id && L.portal_code);
  const fake = { sub: fakeSubject(), crm_customer_id: crypto.randomUUID(), portal_code: 'VG999999' };
  const id0 = have ? L : fake;
  const deny = (id, name, res) => expect(id, name, res, res.status === 401, '401 (trang lỗi chung)');
  deny('L01', 'launch: sai bí mật', await launch(mintLaunch(secret + 'x', id0)));
  deny('L02', 'launch: aud sai ("vip-crm")', await launch(mintLaunch(secret, { ...id0, aud: 'vip-crm' })));
  deny('L03', 'launch: hết hạn (iat=now-120, exp=now-60)', await launch(mintLaunch(secret, { ...id0, iat: now() - 120, exp: now() - 60 })));
  deny('L04', 'launch: exp-iat = 120 (> 60)', await launch(mintLaunch(secret, { ...id0, ttl: 120 })));
  deny('L05', 'launch: header alg=HS512', await launch(mintLaunch(secret, { ...id0, header: { alg: 'HS512', typ: 'JWT' } })));
  deny('L06', 'launch: ver=2', await launch(mintLaunch(secret, { ...id0, ver: 2 })));
  deny('L07', 'launch: sub không tồn tại', await launch(mintLaunch(secret, fake)));
  if (!have) {
    for (const [id, n] of [['L08', 'launch hợp lệ → 303 /portal/ + cookie vg_portal'], ['L09', 'launch: phát lại cùng nonce'],
      ['L10', 'launch: portal_code không khớp'], ['L11', 'launch: crm_customer_id không khớp']]) record(id, n, 'SKIP', 'cần KIT_LAUNCH_SUB/CRM_ID/PORTAL_CODE của một khách đã duyệt');
  } else {
    const tok = mintLaunch(secret, L);
    r = await launch(tok);
    const loc = String(r.headers?.location || ''); const ck = String(r.headers?.['set-cookie'] || '');
    expect('L08', 'launch hợp lệ → 303 /portal/ + cookie vg_portal', r, r.status === 303 && loc.endsWith('/portal/') && ck.includes('vg_portal='), '303 Location …/portal/ + Set-Cookie vg_portal');
    deny('L09', 'launch: phát lại cùng token (nonce đã dùng)', await launch(tok));
    deny('L10', 'launch: portal_code không khớp (VG999998)', await launch(mintLaunch(secret, { ...L, portal_code: L.portal_code === 'VG999998' ? 'VG999997' : 'VG999998' })));
    deny('L11', 'launch: crm_customer_id không khớp', await launch(mintLaunch(secret, { ...L, crm_customer_id: crypto.randomUUID() })));
    if (env.KIT_DESTRUCTIVE === '1') {
      const b = vipJson({ subject: L.sub, reason: 'dang_xuat' });
      const rr = await post(PATH_THU_HOI_CRM, b, signed(PATH_THU_HOI_CRM, b, { idem: `thu-hoi:${L.sub}:dang_xuat:${rand(8)}` }));
      r = await launch(mintLaunch(secret, L));
      expect('L12', 'sau thu-hoi "dang_xuat" khách vẫn đăng nhập lại được (launch mới → 303)', r, rr.status < 300 && r.status === 303,
        `thu-hoi 2xx rồi launch 303 (thu-hoi=${rr.status})`);
    } else record('L12', 'sau thu-hoi "dang_xuat" khách vẫn đăng nhập lại được', 'SKIP', 'KIT_DESTRUCTIVE=1 (CRM hiện khoá vĩnh viễn user!)');
  }
  return printTable(`Kiểm CRM (${base})`);
}

// ═════════════════════════════ CHẾ ĐỘ vipid — kiểm một bên VIP ID (thật hoặc receiver) ═════════════════════════════
async function modeVipid() {
  const secret = loadSecret();
  const base = (env.KIT_VIPID_URL || 'http://127.0.0.1:8898').replace(/\/+$/, '');
  const host = env.KIT_VIPID_HOST || 'khach.localhost:8890';
  const post = (path, body, hdrs, opts = {}) => request(base + path, { body, host, headers: { 'Content-Type': 'application/json', ...hdrs }, ...opts });
  const H = (path, body, ts, method = 'POST', dir = HUONG_VAO) => headersFor(secret, dir, method, path, body, ts);
  const unk = `cust:khong-co-${rand(10)}`;
  const P = VIPID_PATHS;
  console.log(`[kit] vipid: VIP ID=${base} · Host=${host}`);
  let r;
  const b = vipJson({ subject: unk, action: 'khoa', reason: 'kit' });
  r = await request(base + P.tam_khoa, { body: b, host: 'la.example.test', headers: { 'Content-Type': 'application/json', ...H(P.tam_khoa, b) } });
  expect('V01', 'Host lạ → 421', r, r.status === 421, '421');
  r = await post(P.tam_khoa, b, {});
  expect('V02', 'thiếu chữ ký → 401 CHU_KY_SAI', r, r.status === 401 && errCode(r.text) === 'CHU_KY_SAI', '401 CHU_KY_SAI');
  const hv = H(P.tam_khoa, b);
  r = await post(P.tam_khoa, b, hv);
  expect('V03', 'chữ ký đúng, subject lạ → 404 KHONG_TIM_THAY (chữ ký đã qua)', r, r.status === 404 && errCode(r.text) === 'KHONG_TIM_THAY', '404 KHONG_TIM_THAY');
  r = await post(P.tam_khoa, b, hv);
  expect('V04', 'phát lại y hệt → 409 PHAT_LAI', r, r.status === 409 && errCode(r.text) === 'PHAT_LAI', '409 PHAT_LAI');
  r = await post(P.tam_khoa, b, H(P.thu_hoi, b));
  expect('V05', 'chữ ký của /thu-hoi dùng ở /tam-khoa → 401', r, r.status === 401, '401');
  r = await post(P.tam_khoa, b, H(P.tam_khoa, b, now(), 'PUT'));
  expect('V06', 'chữ ký METHOD=PUT → 401', r, r.status === 401, '401');
  r = await post(P.tam_khoa, b, H(P.tam_khoa, b, now() - 301));
  expect('V07', 'ts cũ 301 giây → 401', r, r.status === 401, '401');
  { const ts = now(); r = await post(P.tam_khoa, b, { 'X-Portal-Ts': String(ts), 'X-Portal-Sig': signLegacy(secret, HUONG_VAO, ts, b) }); }
  expect('V08', 'chuỗi ký CŨ (CRM đang gửi trong X-Portal-Sig) → 401', r, r.status === 401, '401');
  r = await post(P.tam_khoa, b, H(P.tam_khoa, b, now(), 'POST', HUONG_RA));
  expect('V09', 'chiều sai (vipid->crm) → 401', r, r.status === 401, '401');
  { const ts = now(); r = await post(P.tam_khoa, b, { 'X-Portal-Ts': '+' + ts, 'X-Portal-Sig': sign(secret, HUONG_VAO, 'POST', P.tam_khoa, '+' + ts, b) }); }
  expect('V10', 'X-Portal-Ts không phải số thuần ("+N") → 401', r, r.status === 401, '401');
  const big = b.slice(0, -1) + ' '.repeat(BODY_LIMIT + 1 - Buffer.byteLength(b)) + '}';
  r = await post(P.tam_khoa, big, H(P.tam_khoa, big));
  expect('V11', `thân ${Buffer.byteLength(big)} byte → 413 QUA_LON`, r, r.status === 413 && errCode(r.text) === 'QUA_LON', '413 QUA_LON');
  r = await post(P.tam_khoa, b, H(P.tam_khoa, b), { chunked: true });
  expect('V12', 'chunked, không Content-Length → 413', r, r.status === 413, '413');
  r = await post(P.tam_khoa, '[1]', H(P.tam_khoa, '[1]'));
  expect('V13', 'chữ ký đúng, thân không phải JSON object → 400 JSON_SAI', r, r.status === 400 && errCode(r.text) === 'JSON_SAI', '400 JSON_SAI');
  for (const [id, k] of [['V14', 'thu_hoi'], ['V15', 'ket_qua_duyet']]) {
    const bb = vipJson({ subject: unk, decision: 'approved', reason: 'kit' });
    r = await post(P[k], bb, H(P[k], bb));
    expect(id, `${P[k]} subject lạ → 404`, r, r.status === 404, '404 KHONG_TIM_THAY');
  }
  // Luồng nghiệp vụ (cần subject đang chờ duyệt có thật trên VIP ID)
  const s1 = env.KIT_VIPID_PENDING_SUBJECT, s2 = env.KIT_VIPID_PENDING_SUBJECT2, sR = env.KIT_VIPID_REJECT_SUBJECT;
  const code = env.KIT_VIPID_PORTAL_CODE || 'VG900001';
  const crmId = env.KIT_VIPID_CRM_ID || crypto.randomUUID();
  // Mỗi lần gửi một ts KHÁC: VIP ID chống phát lại theo chữ ký, ts tính bằng giây ⇒ cùng thân + cùng giây = PHAT_LAI.
  let lech = 0;
  const send = async (k, o) => { const bb = vipJson(o); lech = (lech + 1) % 200; return post(P[k], bb, H(P[k], bb, now() - lech)); };
  if (s1) {
    const ok = (o) => ({ subject: s1, decision: 'approved', crm_customer_id: crmId, portal_code: code, customer_code: code, phone_verified_by: 'nv-kit', ...o });
    r = await send('ket_qua_duyet', ok({ portal_code: 'ABC' }));
    expect('V20', 'duyệt: portal_code sai định dạng → 400 DU_LIEU_SAI', r, r.status === 400 && errCode(r.text) === 'DU_LIEU_SAI', '400 DU_LIEU_SAI');
    r = await send('ket_qua_duyet', ok({ phone_verified_by: '' }));
    expect('V21', 'duyệt: thiếu phone_verified_by → 400', r, r.status === 400, '400 DU_LIEU_SAI');
    r = await send('ket_qua_duyet', ok());
    expect('V22', 'duyệt hợp lệ → 200 status=hoat_dong', r, r.status === 200 && jparse(r.text)?.data?.status === 'hoat_dong', '200 {ok:true,data:{status:"hoat_dong"}}');
    r = await send('ket_qua_duyet', ok());
    expect('V23', 'duyệt lại cùng dữ liệu (ts mới) → 200 idempotent', r, r.status === 200 && jparse(r.text)?.data?.idempotent === true, '200 idempotent:true');
    r = await send('ket_qua_duyet', ok({ crm_customer_id: crypto.randomUUID() }));
    expect('V24', 'duyệt lại với crm_customer_id khác → 409 XUNG_DOT', r, r.status === 409 && errCode(r.text) === 'XUNG_DOT', '409 XUNG_DOT');
    if (s2) {
      r = await send('ket_qua_duyet', { ...ok(), subject: s2, crm_customer_id: crypto.randomUUID() });
      expect('V25', 'subject khác dùng portal_code đã cấp → 409 XUNG_DOT', r, r.status === 409, '409 XUNG_DOT');
      r = await send('ket_qua_duyet', { ...ok(), subject: s2, portal_code: code.replace(/\d$/, (d) => String((+d + 1) % 10)) });
      expect('V26', 'subject khác dùng crm_customer_id đã cấp → 409 XUNG_DOT', r, r.status === 409, '409 XUNG_DOT');
    } else record('V25', 'trùng portal_code/crm_customer_id giữa hai subject → 409', 'SKIP', 'đặt KIT_VIPID_PENDING_SUBJECT2');
    r = await send('tam_khoa', { subject: s1, action: 'khoa', reason: 'kit' });
    expect('V27', 'tam-khoa khoa → 200 tam_khoa', r, r.status === 200 && jparse(r.text)?.data?.status === 'tam_khoa', '200 status=tam_khoa');
    r = await send('tam_khoa', { subject: s1, action: 'mo_khoa', reason: 'kit' });
    expect('V28', 'tam-khoa mo_khoa → 200 hoat_dong', r, r.status === 200 && jparse(r.text)?.data?.status === 'hoat_dong', '200 status=hoat_dong');
    r = await send('tam_khoa', { subject: s1, action: 'xoa', reason: 'kit' });
    expect('V29', 'tam-khoa action lạ → 400', r, r.status === 400, '400 DU_LIEU_SAI');
    r = await send('thu_hoi', { subject: s1, reason: 'kit' });
    expect('V30', 'thu-hoi → 200 {phien_thu_hoi}', r, r.status === 200 && Number.isInteger(jparse(r.text)?.data?.phien_thu_hoi), '200 data.phien_thu_hoi');
  } else record('V20', 'luồng duyệt/khoá/thu hồi', 'SKIP', 'đặt KIT_VIPID_PENDING_SUBJECT (subject đang cho_duyet)');
  if (sR) {
    r = await send('ket_qua_duyet', { subject: sR, decision: 'rejected', reason: 'kit: sai chủ số' });
    expect('V31', 'từ chối → 200 tu_choi', r, r.status === 200 && jparse(r.text)?.data?.status === 'tu_choi', '200 status=tu_choi');
    r = await send('ket_qua_duyet', { subject: sR, decision: 'rejected', reason: 'kit' });
    expect('V32', 'từ chối lại → 200 idempotent', r, r.status === 200 && jparse(r.text)?.data?.idempotent === true, '200 idempotent:true');
    r = await send('ket_qua_duyet', { subject: sR, decision: 'approved', crm_customer_id: crypto.randomUUID(), portal_code: 'VG900009', phone_verified_by: 'nv' });
    expect('V33', 'duyệt sau khi đã từ chối → 409 XUNG_DOT', r, r.status === 409, '409 XUNG_DOT');
    r = await send('tam_khoa', { subject: sR, action: 'khoa', reason: 'kit' });
    expect('V34', 'tam-khoa tài khoản đã từ chối → 409', r, r.status === 409, '409 XUNG_DOT');
  }
  return printTable(`Kiểm bên VIP ID (${base}, Host ${host})`);
}

// ═════════════════════════════ máy chủ dùng chung ═════════════════════════════
function readBody(req, limit) {
  // Như khach_web._doc_body: thiếu/sai Content-Length hoặc > limit ⇒ null (413), đọc luồng và cắt.
  return new Promise((resolve) => {
    const cl = req.headers['content-length'];
    if (cl === undefined || !/^\d+$/.test(cl) || Number(cl) > limit) { req.resume(); return resolve(null); }
    const chunks = []; let n = 0; let over = false;
    req.on('data', (d) => { n += d.length; if (n > limit) over = true; else chunks.push(d); });
    req.on('end', () => resolve(over ? null : Buffer.concat(chunks)));
    req.on('error', () => resolve(null));
  });
}
function send(res, status, obj, ctype = 'application/json; charset=utf-8') {
  const b = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));
  res.writeHead(status, { 'Content-Type': ctype, 'Content-Length': b.length, 'Cache-Control': 'no-store' });
  res.end(b);
}
const normHost = (h) => String(h || '').trim().toLowerCase().replace(/\.(?=(:\d+)?$)/, '');
function listenAddr(def) {
  const [h, p] = (env.KIT_LISTEN || def).split(':');
  return { host: h, port: Number(p) };
}
const log = (o) => console.log(JSON.stringify({ t: new Date().toISOString(), ...o }));
class SeenSigs { // chống phát lại theo chữ ký, giữ 900 s (khach.py:983)
  constructor() { this.m = new Map(); }
  add(sig) { const t = now(); for (const [k, v] of this.m) if (v < t - 900) this.m.delete(k); if (this.m.has(sig)) return false; this.m.set(sig, t); return true; }
}

// ═════════════════════════════ CHẾ ĐỘ receiver — VIP ID giả cho CRM thử chiều ra ═════════════════════════════
async function modeReceiver() {
  const secret = loadSecret();
  const hosts = (env.KIT_RECEIVER_HOSTS || 'khach.localhost:8890,khach.localhost:8898').split(',').map(normHost).filter(Boolean);
  const seen = new SeenSigs();
  const acc = new Map(); // subject → {status, crm_customer_id, portal_code}
  const get = (s) => { if (!acc.has(s)) acc.set(s, { status: 'cho_duyet' }); return acc.get(s); };
  const known = (s) => typeof s === 'string' && s.startsWith('cust:') && !s.startsWith('cust:khong-co');
  const loi = (res, st, ma, tb) => send(res, st, { ok: false, loi: { ma, thongBao: tb } });
  const handlers = {
    [VIPID_PATHS.ket_qua_duyet]: (d) => {
      if (!known(d.subject)) return [404, 'KHONG_TIM_THAY'];
      const a = get(d.subject);
      if (d.decision === 'approved') {
        const cid = String(d.crm_customer_id ?? '').trim(); const code = String(d.portal_code ?? '').trim().toUpperCase();
        const nv = String(d.phone_verified_by ?? '').trim(); const cc = String(d.customer_code ?? '').trim();
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(cid) || !/^VG\d{6}$/.test(code) || !nv || nv.length > 120 || cc.length > 40) return [400, 'DU_LIEU_SAI'];
        if ((a.status === 'hoat_dong' || a.status === 'tam_khoa') && a.crm_customer_id) {
          return a.crm_customer_id === cid && a.portal_code === code ? [200, { subject: d.subject, status: a.status, idempotent: true }] : [409, 'XUNG_DOT'];
        }
        if (a.status !== 'cho_duyet') return [409, 'XUNG_DOT'];
        for (const [s, o] of acc) if (s !== d.subject && (o.crm_customer_id === cid || o.portal_code === code)) return [409, 'XUNG_DOT'];
        Object.assign(a, { status: 'hoat_dong', crm_customer_id: cid, portal_code: code });
        return [200, { subject: d.subject, status: 'hoat_dong' }];
      }
      if (d.decision === 'rejected') {
        if (a.status === 'tu_choi') return [200, { subject: d.subject, status: 'tu_choi', idempotent: true }];
        if (a.status !== 'cho_duyet') return [409, 'XUNG_DOT'];
        a.status = 'tu_choi'; return [200, { subject: d.subject, status: 'tu_choi' }];
      }
      return [400, 'DU_LIEU_SAI'];
    },
    [VIPID_PATHS.tam_khoa]: (d) => {
      if (!known(d.subject)) return [404, 'KHONG_TIM_THAY'];
      const a = get(d.subject);
      if (a.status === 'tu_choi') return [409, 'XUNG_DOT'];
      if (d.action === 'khoa') { a.status = 'tam_khoa'; return [200, { subject: d.subject, status: 'tam_khoa' }]; }
      if (d.action === 'mo_khoa') { if (a.status === 'tam_khoa') a.status = a.crm_customer_id ? 'hoat_dong' : 'cho_duyet'; return [200, { subject: d.subject, status: a.status }]; }
      return [400, 'DU_LIEU_SAI'];
    },
    [VIPID_PATHS.thu_hoi]: (d) => (known(d.subject) ? [200, { subject: d.subject, phien_thu_hoi: 0 }] : [404, 'KHONG_TIM_THAY']),
  };
  const srv = http.createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    const host = normHost(req.headers.host);
    const entry = { mode: 'receiver', method: req.method, path, host };
    if (!hosts.includes(host)) { req.resume(); log({ ...entry, kq: 421 }); return send(res, 421, '421 Misdirected Request', 'text/plain; charset=utf-8'); }
    const h = handlers[path];
    if (!h) { req.resume(); log({ ...entry, kq: 404 }); return loi(res, 404, 'HTTP_404', 'Không tìm thấy.'); }
    if (req.method !== 'POST') { req.resume(); log({ ...entry, kq: 405 }); return loi(res, 405, 'HTTP_405', 'Yêu cầu không hợp lệ.'); }
    const raw = await readBody(req, BODY_LIMIT);
    if (!raw) { log({ ...entry, kq: 413 }); return loi(res, 413, 'QUA_LON', 'Thiếu Content-Length hoặc yêu cầu quá lớn (tối đa 10 KB).'); }
    const sig = req.headers['x-portal-sig'];
    let v = verifyIncoming(secret, HUONG_VAO, req.method, path, req.headers['x-portal-ts'], sig, raw);
    let why = v;
    if (v === 'sai' && sig) {
      // Chẩn đoán (không ảnh hưởng kết quả): có phải chuỗi ký cũ không?
      const ts = String(req.headers['x-portal-ts'] || '');
      if (/^[0-9a-f]{64}$/i.test(sig) && signLegacy(secret, HUONG_VAO, ts, raw) === String(sig).toLowerCase()) why = 'sai:chuoi_ky_cu_v1.1';
    }
    if (v === 'ok' && !seen.add(String(sig).toLowerCase())) v = why = 'phat_lai';
    if (v === 'phat_lai') { log({ ...entry, kq: 409, ly_do: why }); return loi(res, 409, 'PHAT_LAI', 'Chữ ký này đã được dùng; ký lại với X-Portal-Ts mới.'); }
    if (v !== 'ok') { log({ ...entry, kq: 401, ly_do: why, coSigV2: 'x-portal-sig-v2' in req.headers }); return loi(res, 401, 'CHU_KY_SAI', 'Chữ ký nội bộ không hợp lệ hoặc đã hết hạn.'); }
    const d = jparse(raw.toString('utf8'));
    if (!d || typeof d !== 'object' || Array.isArray(d)) { log({ ...entry, kq: 400 }); return loi(res, 400, 'JSON_SAI', 'Body phải là JSON object.'); }
    const [st, out] = h(d);
    log({ ...entry, kq: st, subject: String(d.subject || '').slice(0, 20), event: d.decision || d.action || 'thu_hoi' });
    return st >= 400 ? loi(res, st, out, out) : send(res, 200, { ok: true, data: out });
  });
  const a = listenAddr('127.0.0.1:8895');
  srv.listen(a.port, a.host, () => console.error(`[kit] receiver (VIP ID giả) nghe http://${a.host}:${a.port} · Host hợp lệ: ${hosts.join(', ')}`));
  stopOn(srv);
}

// ═════════════════════════════ CHẾ ĐỘ crm-ref — CRM tham chiếu tối giản (tự kiểm kit) ═════════════════════════════
async function modeCrmRef() {
  const secret = loadSecret();
  const seen = new SeenSigs();
  const nonces = new Set();
  const signups = new Map(); // subject → row
  const approved = new Map(); // subject → {crm_customer_id, portal_code, active}
  const adminTok = env.KIT_CRM_ADMIN_TOKEN_FILE ? fs.readFileSync(env.KIT_CRM_ADMIN_TOKEN_FILE, 'utf8').trim() : null;
  const portalHost = env.KIT_CRM_PORTAL_HOST ? normHost(env.KIT_CRM_PORTAL_HOST) : null;
  const vipBase = (env.KIT_VIPID_URL || 'http://127.0.0.1:8898').replace(/\/+$/, '');
  const vipHost = env.KIT_VIPID_HOST || 'khach.localhost:8890';
  const err = (res, st, code) => send(res, st, { error: { code, message: code } });
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const host = normHost(req.headers.host);
    const entry = { mode: 'crm-ref', method: req.method, path: u.pathname };
    const onPortal = portalHost && host === portalHost;
    if (u.pathname === LAUNCH_PATH && req.method === 'GET') {
      if (portalHost && !onPortal) return err(res, 404, 'NOT_FOUND');
      const v = verifyLaunch(secret, u.searchParams.get('token') || '', nonces);
      let reason = v.error;
      if (!reason) {
        const a = approved.get(v.claims.sub);
        if (!a) reason = 'SUBJECT_UNKNOWN';
        else if (!a.active) reason = 'USER_INACTIVE';
        else if (a.crm_customer_id !== v.claims.crm_customer_id) reason = 'CUSTOMER_MISMATCH';
        else if (a.portal_code !== v.claims.portal_code) reason = 'PORTAL_CODE_MISMATCH';
      }
      log({ ...entry, kq: reason ? 401 : 303, ly_do: reason || 'ok', sub: v.claims?.sub?.slice(0, 20) });
      if (reason) return send(res, 401, '<h1>Không thể mở cổng khách hàng</h1>', 'text/html; charset=utf-8');
      res.writeHead(303, { Location: '/portal/', 'Set-Cookie': `vg_portal=${rand(32)}; Path=/; HttpOnly; SameSite=Strict`, 'Cache-Control': 'no-store' });
      return res.end();
    }
    if (u.pathname === '/api/portal/signups' && req.method === 'GET') {
      if (!adminTok || req.headers.authorization !== `Bearer ${adminTok}`) return err(res, 401, 'UNAUTHENTICATED');
      return send(res, 200, { items: [...signups.values()] });
    }
    if (u.pathname === '/kit/duyet' && req.method === 'POST') { // trợ giúp tự kiểm: CRM gửi ket-qua-duyet sang VIP ID
      const raw = await readBody(req, BODY_LIMIT); const d = jparse(String(raw || '')) || {};
      const s = signups.get(d.subject);
      const payload = d.decision === 'rejected'
        ? { subject: d.subject, decision: 'rejected', crm_customer_id: null, portal_code: null, phone_verified_by: null, reason: d.reason || 'kit' }
        : { subject: d.subject, decision: 'approved', crm_customer_id: d.crm_customer_id || crypto.randomUUID(), portal_code: d.portal_code,
          customer_code: d.portal_code, phone_verified_by: crypto.randomUUID() };
      const body = JSON.stringify(payload);
      const r = await request(vipBase + VIPID_PATHS.ket_qua_duyet, { body, host: vipHost,
        headers: { 'Content-Type': 'application/json', ...headersFor(secret, HUONG_VAO, 'POST', VIPID_PATHS.ket_qua_duyet, body) } });
      if (r.status === 200 && payload.decision === 'approved') approved.set(d.subject, { crm_customer_id: payload.crm_customer_id, portal_code: payload.portal_code, active: true });
      if (s) s.status = r.status === 200 ? (payload.decision === 'approved' ? 'da_duyet' : 'tu_choi') : s.status;
      log({ ...entry, kq: r.status, vipid: errCode(r.text) || 'ok' });
      return send(res, 200, { vipid_status: r.status, vipid_body: jparse(r.text), sent: payload });
    }
    const isSignup = u.pathname === PATH_SIGNUP, isThuHoi = u.pathname === PATH_THU_HOI_CRM;
    if (!isSignup && !isThuHoi) { req.resume(); return err(res, 404, 'NOT_FOUND'); }
    if (onPortal) { req.resume(); return err(res, 404, 'NOT_FOUND'); }
    if (req.method !== 'POST') { req.resume(); return err(res, 405, 'METHOD'); }
    const raw = await readBody(req, BODY_LIMIT);
    if (!raw) { log({ ...entry, kq: 413 }); return err(res, 413, 'BODY_TOO_LARGE'); }
    const sig = String(req.headers['x-portal-sig'] || '').toLowerCase();
    let v = verifyIncoming(secret, HUONG_RA, req.method, u.pathname, req.headers['x-portal-ts'], sig, raw);
    if (v === 'ok' && !seen.add(sig)) v = 'phat_lai';
    if (v === 'phat_lai') { log({ ...entry, kq: 409, ly_do: 'PHAT_LAI' }); return err(res, 409, 'PHAT_LAI'); }
    if (v !== 'ok') { log({ ...entry, kq: 401 }); return err(res, 401, 'SIGNATURE_INVALID'); }
    const d = jparse(raw.toString('utf8'));
    if (!d || typeof d !== 'object' || Array.isArray(d) || !/^cust:/.test(String(d.subject))) return err(res, 422, 'INVALID');
    if (isThuHoi) {
      // Thu hồi = huỷ PHIÊN, không khoá vĩnh viễn tài khoản (VIP ID gửi khi đăng xuất / đặt lại mật khẩu).
      log({ ...entry, kq: 200, reason: d.reason, idem: req.headers['idempotency-key']?.slice(0, 40) });
      return send(res, 200, { ok: true, revoked_sessions: 0 });
    }
    const prev = signups.get(d.subject);
    const row = { subject: d.subject, display_name: d.display_name, phone_e164: d.phone_e164, email: d.email,
      phone_conflict: d.phone_conflict === true, phone_conflict_count: Number(d.phone_conflict_count) || 0,
      status: prev?.status || 'cho_duyet', idempotency_key: req.headers['idempotency-key'] || null };
    if (prev && prev.status !== 'cho_duyet') { log({ ...entry, kq: 200, upsert: 'bo_qua_da_quyet_dinh' }); return send(res, 200, { status: prev.status, duplicate: true }); }
    signups.set(d.subject, row);
    log({ ...entry, kq: prev ? 200 : 201, upsert: prev ? 'cap_nhat' : 'moi', phone_conflict_count: row.phone_conflict_count, idem: row.idempotency_key });
    return send(res, prev ? 200 : 201, { status: row.status, updated: !!prev });
  });
  const a = listenAddr('127.0.0.1:8894');
  srv.listen(a.port, a.host, () => console.error(`[kit] crm-ref nghe http://${a.host}:${a.port}`));
  stopOn(srv);
}

function stopOn(srv) {
  const stop = () => srv.close(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

// ═════════════════════════════ CHẾ ĐỘ mint ═════════════════════════════
function modeMint() {
  const secret = loadSecret();
  const L = { sub: env.KIT_LAUNCH_SUB, crm_customer_id: env.KIT_LAUNCH_CRM_ID, portal_code: env.KIT_LAUNCH_PORTAL_CODE };
  if (!L.sub || !L.crm_customer_id || !L.portal_code) die('mint cần KIT_LAUNCH_SUB, KIT_LAUNCH_CRM_ID, KIT_LAUNCH_PORTAL_CODE.');
  const o = { ...L };
  if (env.KIT_MINT_IAT) o.iat = Number(env.KIT_MINT_IAT);
  if (env.KIT_MINT_NONCE) o.nonce = env.KIT_MINT_NONCE;
  console.log(mintLaunch(secret, o));
  return 0;
}

// ═════════════════════════════ main ═════════════════════════════
const mode = process.argv[2] || 'crm';
const modes = { crm: modeCrm, vipid: modeVipid, receiver: modeReceiver, 'crm-ref': modeCrmRef, mint: modeMint };
if (!modes[mode]) die(`chế độ không hợp lệ: ${mode} (crm | vipid | receiver | crm-ref | mint)`);
const rc = await modes[mode]();
if (typeof rc === 'number') process.exitCode = rc;
