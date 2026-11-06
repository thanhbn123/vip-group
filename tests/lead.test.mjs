// VIPG-WEB-023 — Thu lead: worker /api/lead, form bật/tắt, CSP, Apps Script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = await import(pathToFileURL(join(root, 'public/_worker.js')).href);

const ENV = { TURNSTILE_SECRET: 'ts-secret', SHEET_WEBHOOK_URL: 'https://script.example/exec', SHEET_WEBHOOK_SECRET: 'sheet-secret-xxxxxxxxxxxxxxxxxxxxxxxx', ZALO_BOT_TOKEN: '123:zalo', ZALO_NOTIFY_CHAT_ID: 'chat-1' };
const NOW = Date.UTC(2026, 10, 6, 1, 0, 0);
const good = (o = {}) => ({
  name: 'Nguyễn Văn Thử', phone: '0961 102 655', email: '', need: 'bao-gia-van-chuyen', weight_kg: '120', message: 'Hàng nội thất',
  consent: true, website: '', started_at: NOW - 10_000, idempotency_key: 'abcdef1234567890abcd', turnstile_token: 'tok', page: '/lien-he/',
  utm: { source: 'google', medium: 'organic', campaign: '' }, ...o,
});
const req = (body, { origin = 'https://www.vipgroup.com.vn', method = 'POST', ct = 'application/json', raw } = {}) =>
  new Request('https://www.vipgroup.com.vn/api/lead', {
    method, headers: { 'Content-Type': ct, ...(origin ? { Origin: origin } : {}), 'CF-Connecting-IP': '203.0.113.9' },
    body: method === 'GET' ? undefined : raw ?? JSON.stringify(body),
  });

/** fetch giả: ghi lại lời gọi, trả lời theo cấu hình. */
function mockFetch({ turnstile = true, sheet = { ok: true, lead_id: 'VG-20261106-AAAAAA', duplicate: false }, sheetStatus = 200, zaloOk = true, throwSheet = false } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('turnstile')) return Response.json({ success: turnstile });
    if (String(url).startsWith(ENV.SHEET_WEBHOOK_URL)) { if (throwSheet) throw new Error('down'); return Response.json(sheet, { status: sheetStatus }); }
    if (String(url).includes('bot-api.zapps.me')) return new Response('{}', { status: zaloOk ? 200 : 500 });
    throw new Error('unexpected ' + url);
  };
  return { fn, calls, of: (s) => calls.filter((c) => c.url.includes(s)) };
}
const run = async (request, env = ENV, f = mockFetch()) => {
  const waits = [];
  const res = await W.handleLead(request, env, { waitUntil: (p) => waits.push(p) }, f.fn, NOW);
  await Promise.all(waits);
  return { res, body: await res.json(), f };
};

test('worker: chỉ nhận POST; thiếu cấu hình → 503 not_configured (không gọi ra ngoài)', async () => {
  assert.equal((await run(req(null, { method: 'GET' }))).res.status, 405);
  const f = mockFetch();
  const { res, body } = await run(req(good()), { ...ENV, TURNSTILE_SECRET: '' }, f);
  assert.equal(res.status, 503); assert.equal(body.error, 'not_configured'); assert.equal(f.calls.length, 0);
});

test('worker: chặn khác nguồn, sai Content-Type, body quá lớn, JSON hỏng', async () => {
  assert.equal((await run(req(good(), { origin: 'https://evil.example' }))).res.status, 403);
  assert.equal((await run(req(good(), { origin: null }))).res.status, 403);
  assert.equal((await run(req(good(), { ct: 'text/plain' }))).res.status, 415);
  assert.equal((await run(req(null, { raw: '{"a":"' + 'x'.repeat(9000) + '"}' }))).res.status, 413);
  assert.equal((await run(req(null, { raw: '{bad' }))).res.status, 400);
});

test('worker: bot (ô bẫy có chữ / gửi quá nhanh) → trả 201 giả, KHÔNG lưu, KHÔNG báo', async () => {
  for (const b of [good({ website: 'http://spam' }), good({ started_at: NOW - 500 }), good({ started_at: 'x' })]) {
    const { res, body, f } = await run(req(b));
    assert.equal(res.status, 201); assert.equal(body.lead_id, null); assert.equal(f.calls.length, 0);
  }
});

test('worker: dữ liệu sai → 400 kèm tên trường, không gọi Turnstile/Sheet', async () => {
  const { res, body, f } = await run(req(good({ name: 'A', phone: '12345', email: 'x@', need: 'hack', consent: false, weight_kg: '-1', idempotency_key: 'short' })));
  assert.equal(res.status, 400);
  assert.deepEqual(body.fields.sort(), ['consent', 'email', 'idempotency_key', 'name', 'need', 'phone', 'weight_kg']);
  assert.equal(f.calls.length, 0);
});

test('worker: số điện thoại chuẩn hoá (+84, dấu cách, dấu chấm)', () => {
  assert.equal(W.normalizePhone('+84 961.102.655'), '0961102655');
  assert.equal(W.normalizePhone('84961102655'), '0961102655');
  assert.equal(W.normalizePhone('0161102655'), null);
  assert.equal(W.normalizePhone('09611026'), null);
});

test('worker: Turnstile không đạt → 403, không lưu', async () => {
  const f = mockFetch({ turnstile: false });
  const { res, body } = await run(req(good()), ENV, f);
  assert.equal(res.status, 403); assert.equal(body.error, 'turnstile');
  assert.equal(f.of('script.example').length, 0);
  const sent = f.of('turnstile')[0].init.body;
  assert.equal(sent.get('secret'), 'ts-secret'); assert.equal(sent.get('remoteip'), '203.0.113.9');
});

test('worker: thành công → lưu Sheet (kèm secret) rồi báo Zalo; trả 201 + mã lead', async () => {
  const { res, body, f } = await run(req(good()));
  assert.equal(res.status, 201); assert.deepEqual(body, { ok: true, lead_id: 'VG-20261106-AAAAAA' });
  const sheet = JSON.parse(f.of('script.example')[0].init.body);
  assert.equal(sheet.secret, ENV.SHEET_WEBHOOK_SECRET);
  assert.equal(sheet.action, 'append');
  assert.equal(sheet.lead.phone, '0961102655');
  assert.equal(sheet.lead.weight_kg, 120);
  assert.equal(sheet.lead.source, 'vipgroup.com.vn');
  const zalo = f.of('bot-api.zapps.me')[0];
  assert.equal(zalo.url, 'https://bot-api.zapps.me/bot123:zalo/sendMessage');
  const z = JSON.parse(zalo.init.body);
  assert.equal(z.chat_id, 'chat-1');
  assert.match(z.text, /LEAD MỚI/); assert.match(z.text, /VG-20261106-AAAAAA/); assert.match(z.text, /0961102655/);
  assert.doesNotMatch(z.text, /sheet-secret|ts-secret/);
  assert.ok(!JSON.stringify(body).includes('0961102655'), 'phản hồi không trả lại dữ liệu cá nhân');
});

test('worker: gửi trùng (Sheet báo duplicate) → 200, KHÔNG báo Zalo lần 2', async () => {
  const f = mockFetch({ sheet: { ok: true, lead_id: 'VG-1', duplicate: true } });
  const { res, body } = await run(req(good()), ENV, f);
  assert.equal(res.status, 200); assert.equal(body.duplicate, true); assert.equal(f.of('zapps').length, 0);
});

test('worker: Sheet lỗi → vẫn báo Zalo "CHƯA LƯU", trả 503 notified; không log dữ liệu khách', async () => {
  const logs = []; const orig = console.error; console.error = (...a) => logs.push(a.join(' '));
  try {
    for (const f of [mockFetch({ throwSheet: true }), mockFetch({ sheetStatus: 500, sheet: { ok: false, error: 'x' } })]) {
      const { res, body } = await run(req(good()), ENV, f);
      assert.equal(res.status, 503); assert.equal(body.error, 'store_failed'); assert.equal(body.notified, true);
      assert.match(JSON.parse(f.of('zapps')[0].init.body).text, /CHƯA LƯU ĐƯỢC SHEET/);
    }
  } finally { console.error = orig; }
  assert.ok(logs.length > 0);
  for (const l of logs) assert.doesNotMatch(l, /0961102655|Nguyễn|Hàng nội thất/);
});

test('worker: Zalo lỗi hoặc chưa cấu hình Zalo → khách vẫn nhận 201', async () => {
  assert.equal((await run(req(good()), ENV, mockFetch({ zaloOk: false }))).res.status, 201);
  const f = mockFetch();
  const { res } = await run(req(good()), { ...ENV, ZALO_BOT_TOKEN: '' }, f);
  assert.equal(res.status, 201); assert.equal(f.of('zapps').length, 0);
});

test('worker: router chỉ xử lý /api/*, còn lại trả về tài sản tĩnh', async () => {
  let served = 0;
  const env = { ...ENV, ASSETS: { fetch: async () => { served++; return new Response('static'); } } };
  assert.equal(await (await W.default.fetch(new Request('https://www.vipgroup.com.vn/lien-he/'), env, {})).text(), 'static');
  assert.equal((await W.default.fetch(new Request('https://www.vipgroup.com.vn/api/khac'), env, {})).status, 404);
  assert.equal(served, 1);
});

test('build mặc định: có _worker.js + _routes.json chỉ /api/*; form bật với mã site Turnstile thật', () => {
  const dist = join(root, 'dist');
  assert.equal(readFileSync(join(dist, '_worker.js'), 'utf8'), readFileSync(join(root, 'public/_worker.js'), 'utf8'));
  assert.deepEqual(JSON.parse(readFileSync(join(dist, '_routes.json'), 'utf8')), { version: 1, include: ['/api/*'], exclude: [] });
  // V1.1: mã site Turnstile thật đã ghi (contact.ts) → form bật trong bản build chính.
  const html = readFileSync(join(dist, 'lien-he/index.html'), 'utf8');
  assert.match(html, /data-backend-ready="true"/);
  assert.match(html, /class="cf-turnstile" data-sitekey="0x4AAAAAAF2QZNcXX6-6puJf"/);
  assert.match(readFileSync(join(dist, 'index.html'), 'utf8'), /Gửi yêu cầu báo giá/);
  assert.ok(existsSync(join(dist, 'chinh-sach-bao-mat/index.html')));
});

test('build đã bật (mã Turnstile thử): form gửi thật, an toàn khi tắt JS, CSP cho Turnstile', { timeout: 180000 }, () => {
  const out = join(root, 'dist-lead');
  const r = spawnSync('npx', ['astro', 'build'], { cwd: root, encoding: 'utf8', env: { ...process.env, VIPG_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', VIPG_OUTDIR: './dist-lead' } });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const html = readFileSync(join(out, 'lien-he/index.html'), 'utf8');
  const start = html.indexOf('<form '); const form = html.slice(start, html.indexOf('</form>', start));
  assert.match(form, /data-backend-ready="true"/);
  assert.match(form, /data-endpoint="\/api\/lead"/);
  assert.match(form, /class="cf-turnstile" data-sitekey="1x00000000000000000000AA"/);
  assert.match(form, /<input id="cf-consent" type="checkbox" required/);
  assert.match(form, /href="\/chinh-sach-bao-mat\/"/);
  assert.doesNotMatch(form.slice(0, form.indexOf('>') + 1), /\saction=|\smethod=/);
  for (const [tag] of form.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)) assert.doesNotMatch(tag, /\sname=/, tag);
  assert.match(form, /<button [^>]*type="submit"[^>]*\sdisabled[\s>]/);
  assert.doesNotMatch(form, /chưa gửi được dữ liệu/);
  const csp = html.match(/<meta http-equiv="content-security-policy" content="([^"]+)"/)[1];
  assert.match(csp, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /script-src 'self' https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /form-action 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(readFileSync(join(out, 'index.html'), 'utf8'), /href="\/lien-he\/\?nhu-cau=bao-gia-van-chuyen#form-lien-he"[^>]*>Gửi yêu cầu báo giá/);
});

test('Apps Script: không có bí mật trong mã, chống công thức, so khoá constant-time, ký HMAC đúng chuỗi gửi đi', () => {
  const gs = readFileSync(join(root, 'ops/lead-sheet/Code.gs'), 'utf8');
  assert.doesNotMatch(gs, /(secret|token)\s*[:=]\s*['"][^'"]{8,}/i);
  assert.match(gs, /getProperty\('SHEET_WEBHOOK_SECRET'\)/);
  assert.match(gs, /safeEqual_\(body\.secret/);
  assert.match(gs, /\/\^\[=\+\\-@\\t\\r\]\//, 'chặn ô bắt đầu bằng = + - @');
  // Chuỗi được ký (ts + '.' + payload) chính là chuỗi gửi đi (payload: payload).
  assert.match(gs, /payload: payload,[\s\S]{0,200}hmacHex_\(secret, ts \+ '\.' \+ payload\)/);
  assert.match(gs, /'Idempotency-Key': rows\[i\]\[0\]/);
  assert.match(gs, /LockService/);
});

test('Apps Script → CRM V5: chữ ký HMAC khớp thuật toán CRM; payload đúng hợp đồng cuối', async () => {
  const { createHmac } = await import('node:crypto');
  const vm = await import('node:vm');
  const gs = readFileSync(join(root, 'ops/lead-sheet/Code.gs'), 'utf8');
  // Giả lập Utilities của Apps Script: computeHmacSha256Signature trả mảng byte CÓ DẤU (-128..127) như Java.
  const Utilities = {
    Charset: { UTF_8: 'UTF-8' },
    computeHmacSha256Signature: (text, key) => [...createHmac('sha256', key).update(text, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
  };
  const ctx = { Utilities, JSON, String, Number, Math, Date };
  vm.createContext(ctx);
  vm.runInContext(gs, ctx);
  const secret = 'crm-secret-ví-dụ';
  const ts = '1793952000';
  const body = '{"lead_id":"VG-1","name":"Nguyễn Văn Thử"}';
  // Thuật toán CRM V5 (server/modules/leads/intake.js signLead): hmac-sha256(secret, `${ts}.${raw}`) hex.
  assert.equal(ctx.hmacHex_(secret, ts + '.' + body), createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex'));

  // Dòng Sheet (sau khi Sheets bỏ dấu ' ở ô chữ) → payload gửi CRM.
  const row = ['VG-20261106-AB12CD', '2026-11-06T07:30:01.000Z', 'Nguyễn Văn Thử', '0961102655', '', 'bao-gia-van-chuyen', 120, 'Hàng nội thất',
    '/lien-he/', 'google', 'organic', '', '2026-11-06T07:30:00.000Z', 'key-1234567890abcdef', 'chờ đồng bộ', '', 0, '', ''];
  const p = JSON.parse(ctx.crmPayload_(row));
  assert.equal(p.lead_id, 'VG-20261106-AB12CD');
  assert.equal(p.source, 'vipgroup.com.vn');
  assert.equal(p.phone, '0961102655');
  assert.equal(p.email, null);
  assert.equal(p.weight_kg, 120);
  assert.equal(p.consent_at, '2026-11-06T07:30:00.000Z');
  assert.ok(['bao-gia-van-chuyen', 'nhap-khau-chinh-ngach', 'hop-tac', 'khac'].includes(p.need));
  assert.ok(Buffer.byteLength(ctx.crmPayload_(row)) < 16 * 1024, 'body ≤ 16 KB');
  assert.equal(JSON.parse(ctx.crmPayload_([...row.slice(0, 6), '', ...row.slice(7)])).weight_kg, null);
});

test('Apps Script đồng bộ CRM: nghỉ 2,5 s/lead; 401 dừng lượt, 3 lượt liên tiếp mới cảnh báo MỘT lần; thành công thì xoá đếm', async () => {
  const vm = await import('node:vm');
  const gs = readFileSync(join(root, 'ops/lead-sheet/Code.gs'), 'utf8');
  const props = { CRM_INTAKE_URL: 'https://crm.example/api/intake/leads', LEAD_INTAKE_SECRET: 's' };
  const header = ['lead_id'];
  const mkRow = (id) => [id, '2026-11-06T07:30:01.000Z', 'A B', '0961102655', '', 'khac', '', '', '/', '', '', '', '2026-11-06T07:30:00.000Z', 'k' + id, 'chờ đồng bộ', '', 0, '', ''];
  let data = [mkRow('VG-1'), mkRow('VG-2'), mkRow('VG-3')];
  let codes = []; const sleeps = []; const alerts = []; let fetched = 0;
  const sheet = {
    getLastRow: () => data.length + 1,
    getLastColumn: () => 20,
    getRange: (r, c, nr, nc) => nr ? { getValues: () => data.slice(r - 2, r - 2 + nr).map((x) => x.slice(0, nc)) } : { setValue: (v) => { data[r - 2][c - 1] = v; } },
    appendRow() {}, setFrozenRows() {},
  };
  const ctx = {
    JSON, String, Number, Math, Date,
    Utilities: { sleep: (ms) => sleeps.push(ms), Charset: { UTF_8: 'u' }, computeHmacSha256Signature: () => [1, 2, 3] },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: (k) => { delete props[k]; } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
    UrlFetchApp: { fetch: (url) => { fetched++; if (url.includes('zapps')) { alerts.push('zalo'); return {}; } const c = codes.shift() ?? 201; return { getResponseCode: () => c, getContentText: () => (c === 201 ? '{"crm_lead_id":"LD-1"}' : '{}') }; } },
    MailApp: { sendEmail: () => alerts.push('mail') }, Session: { getEffectiveUser: () => ({ getEmail: () => 'o@x' }) },
  };
  vm.createContext(ctx); vm.runInContext(gs, ctx);
  void header;

  // Lượt 1–3: 401 ngay lead đầu → dừng lượt (không gửi lead 2, 3); cảnh báo đúng 1 lần ở lượt 3.
  for (let k = 1; k <= 4; k++) { codes = [401]; fetched = 0; ctx.syncPendingToCrm(); assert.equal(fetched, 1, `lượt ${k} chỉ gửi 1 lead rồi dừng`); assert.equal(alerts.length, k >= 3 ? 1 : 0, `lượt ${k}: số cảnh báo`); }
  assert.deepEqual(alerts, ['mail'], 'cảnh báo một lần (email vì chưa cấu hình Zalo)');
  assert.equal(data[0][14], 'lỗi tạm'); assert.equal(data[1][14], 'chờ đồng bộ');
  // Sửa khoá: cả 3 lead đồng bộ, nghỉ 2,5 s giữa các lần gửi, xoá bộ đếm.
  sleeps.length = 0; codes = [201, 201, 201]; ctx.syncPendingToCrm();
  assert.deepEqual(data.map((r) => r[14]), ['đã đồng bộ', 'đã đồng bộ', 'đã đồng bộ']);
  assert.deepEqual(sleeps, [2500, 2500]);
  assert.equal(props.CRM_AUTH_FAIL_STREAK, undefined); assert.equal(props.CRM_AUTH_ALERTED, undefined);
});

test('V1.2: tuyến vận chuyển — hợp lệ thì vào Sheet + Zalo, lạ thì 400; mặc định "chưa rõ"', async () => {
  const ok = await run(req(good({ route: 'tham-quyen' })));
  assert.equal(ok.res.status, 201);
  assert.equal(JSON.parse(ok.f.of('script.example')[0].init.body).lead.route, 'tham-quyen');
  assert.match(JSON.parse(ok.f.of('zapps')[0].init.body).text, /Tuyến: Thâm Quyến/);
  const bad = await run(req(good({ route: 'mars' })));
  assert.equal(bad.res.status, 400); assert.deepEqual(bad.body.fields, ['route']);
  const def = await run(req(good()));
  assert.equal(JSON.parse(def.f.of('script.example')[0].init.body).lead.route, 'chua-ro');
});

test('V1.2 G09: hotline khai ở MỘT nơi (contact.ts); mọi trang dùng tel:0961102655, Zalo đúng số, không còn số cũ', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  const holders = walk(join(root, 'src')).filter((f) => /0961\s?102\s?655/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(holders.map((f) => f.replace(root + '/', '')), ['src/data/vi/contact.ts']);
  const pages = walk(join(root, 'dist')).filter((x) => x.endsWith('.html'));
  assert.ok(pages.length >= 15);
  for (const f of pages) {
    const html = readFileSync(f, 'utf8');
    for (const [, tel] of html.matchAll(/href="tel:([^"]+)"/g)) assert.equal(tel, '0961102655', f);
    for (const [, z] of html.matchAll(/href="(https:\/\/zalo\.me\/[^"]+)"/g)) assert.equal(z, 'https://zalo.me/0961102655', f);
    assert.doesNotMatch(html, /0968\s?961\s?962/, `${f}: số cũ`);
  }
});
