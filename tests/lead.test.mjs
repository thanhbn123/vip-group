// VIPG-WEB-023 — Thu lead: worker /api/lead, form bật/tắt, CSP, Apps Script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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

test('build mặc định: có _worker.js + _routes.json chỉ /api/*; form giữ trạng thái chưa gửi', () => {
  const dist = join(root, 'dist');
  assert.equal(readFileSync(join(dist, '_worker.js'), 'utf8'), readFileSync(join(root, 'public/_worker.js'), 'utf8'));
  assert.deepEqual(JSON.parse(readFileSync(join(dist, '_routes.json'), 'utf8')), { version: 1, include: ['/api/*'], exclude: [] });
  const html = readFileSync(join(dist, 'lien-he/index.html'), 'utf8');
  assert.match(html, /data-backend-ready="false"/);
  assert.doesNotMatch(html, /class="cf-turnstile"|<script[^>]*challenges\.cloudflare\.com/);
  assert.doesNotMatch(readFileSync(join(dist, 'index.html'), 'utf8'), /Gửi yêu cầu báo giá/);
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
