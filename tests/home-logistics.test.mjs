// VIPG-WEB-034 — Trang chủ ưu tiên vận chuyển: bảng giá + ví dụ tính cước ngay sau banner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, 'dist', p), 'utf8');
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const home = read('index.html');

test('nút chính ở banner là Báo giá vận chuyển, trỏ tới công cụ Báo giá nhanh', () => {
  const hero = home.slice(home.indexOf('class="hero-actions"'), home.indexOf('</div>', home.indexOf('class="hero-actions"')));
  const first = hero.match(/<a [^>]*>[^<]*/)[0];
  assert.match(first, /href="\/logistics\/bang-gia\/#bao-gia-nhanh"/);
  assert.match(first, /btn-primary/);
  assert.match(first, /Báo giá vận chuyển/);
  assert.match(hero, /Khám phá hệ sinh thái/, 'vẫn giữ lối vào hệ sinh thái');
});

test('thứ tự trang chủ: banner → bảng giá → ví dụ tính cước → giới thiệu', () => {
  const at = (needle) => { const i = home.indexOf(needle); assert.ok(i > 0, `thiếu ${needle}`); return i; };
  const hero = at('id="hero-title"');
  const price = at('id="bang-gia"');
  const ex = at('id="vi-du-tinh-cuoc"');
  const about = at('id="about-title"');
  assert.ok(hero < price && price < ex && ex < about, `sai thứ tự: ${[hero, price, ex, about]}`);
});

// Kỳ vọng tính tay theo bảng giá owner 06–07/11/2026 + hệ số 6000 (chủ dự án 18/11/2026; 17/11 từng là 5000).
const EXPECTED = [
  ['Kiện nhỏ', '3 kg', '20.000đ/kg', '60.000đ'], // 30×20×15 → 1,5 kg quy đổi < 3 kg thực
  ['Kiện vừa', '20 kg', '16.000đ/kg', '320.000đ'], // 50×40×30 → 10 kg quy đổi < 20 kg thực
  ['Kiện nhẹ nhưng cồng kềnh', '20 kg', '16.000đ/kg', '320.000đ'], // 60×50×40 → 20 kg quy đổi > 8 kg thực
];

for (const page of ['index.html', 'logistics/bang-gia/index.html']) {
  test(`${page}: ví dụ tính cước đúng số, tính từ bảng giá`, () => {
    const html = read(page);
    const s = html.indexOf('id="vi-du-tinh-cuoc"');
    assert.ok(s > 0, 'thiếu khối ví dụ');
    const sec = html.slice(s, html.indexOf('</section>', s));
    const cards = [...sec.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g)].map((m) => text(m[1]));
    assert.equal(cards.length, EXPECTED.length);
    EXPECTED.forEach(([name, ck, unit, total], i) => {
      assert.ok(cards[i].includes(name), `thẻ ${i + 1}: ${cards[i]}`);
      assert.ok(cards[i].includes(`Cân tính cước ${ck}`), `thẻ ${i + 1} cân tính cước: ${cards[i]}`);
      assert.ok(cards[i].includes(unit), `thẻ ${i + 1} đơn giá: ${cards[i]}`);
      assert.ok(cards[i].trim().endsWith(total), `thẻ ${i + 1} thành tiền: ${cards[i]}`);
    });
    assert.match(text(sec), /Cước chỉ từ 12\.000đ\/kg/);
    assert.match(text(sec), /÷ 6000/);
    assert.match(text(sec), /chưa gồm phụ phí và thuế/);
  });
}

// ───── Điều khoản owner 17/11/2026 (src/data/vi/service-terms.ts) ─────
test('trang Bảng giá: phí dịch vụ order đúng 3 bậc owner, đơn đầu miễn phí, ví dụ tính đúng', () => {
  const html = read('logistics/bang-gia/index.html');
  const s = html.indexOf('id="phi-dich-vu-order"');
  assert.ok(s > 0, 'thiếu khối phí order');
  const sec = html.slice(s, html.indexOf('</section>', s));
  const rows = [...sec.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(1).map((m) => text(m[1]).trim());
  assert.deepEqual(rows, ['Đến 1.000.000đ 3%', 'Trên 1.000.000đ đến 5.000.000đ 2%', 'Trên 5.000.000đ 1%']);
  const t = text(sec);
  assert.match(t, /Miễn phí dịch vụ cho đơn hàng đầu tiên/);
  assert.match(t, /đơn 3\.000\.000đ tiền hàng → phí 2% = 60\.000đ/);
  assert.match(t, /đơn hàng đầu tiên: 0đ/);
  assert.match(sec, /data-fx hidden/, 'tỷ giá ẩn cho tới khi CRM trả số');
  assert.doesNotMatch(sec, /data-fx-rate>\s*\d/, 'không gõ tỷ giá vào HTML');
});

test('dải cam kết trên trang chủ và /logistics/: đúng nguyên ý owner, không thêm cam kết khác', () => {
  for (const p of ['index.html', 'logistics/index.html']) {
    const html = read(p);
    const s = html.indexOf('id="cam-ket"');
    assert.ok(s > 0, `${p}: thiếu dải cam kết`);
    const cards = [...html.slice(s, html.indexOf('</section>', s)).matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
    assert.deepEqual(cards, ['2 ngày về kho Việt Nam', 'Đền bù gấp 10 lần tiền cước', 'Đơn đầu tiên miễn phí dịch vụ', 'Phí order chỉ 1–3%'], p);
    assert.match(text(html), /Mất hàng, hỏng hàng: đền bù gấp 10 lần tiền cước và hoàn lại tiền cước\./);
    const t = text(html.slice(html.indexOf('>', s) + 1, html.indexOf('</section>', s)));
    assert.match(t, /Thời gian vận chuyển 2 ngày từ kho Trung Quốc về kho Việt Nam\./);
    assert.match(t, /Đặt hàng 1688, Taobao, Pinduoduo lần đầu không mất phí dịch vụ order\./);
    assert.match(t, /Theo giá trị tiền hàng, đơn càng lớn phí càng thấp\./);
    assert.doesNotMatch(t.replace(/2 ngày|10 lần|1–3%|1688/g, ''), /\d/, `${p}: số lạ trong dải cam kết`);
  }
});

test('data-owner-terms chỉ có đúng 3 chỗ: cam kết ở / và /logistics/, phí order ở /logistics/bang-gia/', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
  const hits = walk(join(root, 'dist')).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/id="([^"]+)"[^>]*data-owner-terms/g)].map((m) => `${f.replace(join(root, 'dist'), '')}#${m[1]}`)).sort();
  assert.deepEqual(hits, ['/index.html#cam-ket', '/logistics/bang-gia/index.html#phi-dich-vu-order', '/logistics/index.html#cam-ket']);
  const sec = read('logistics/bang-gia/index.html').split('id="phi-dich-vu-order"')[1].split('</section>')[0];
  const nums = text(sec).match(/[\d.]+(?:đ|%)/g);
  assert.deepEqual(nums, ['1.000.000đ', '3%', '1.000.000đ', '5.000.000đ', '2%', '5.000.000đ', '1%', '3.000.000đ', '2%', '60.000đ', '0đ'], 'số trong khối phí order');
});

test('FAQ: thời gian, đền bù, phí order đã có căn cứ owner', () => {
  const t = text(read('logistics/cau-hoi-thuong-gap/index.html'));
  assert.match(t, /Thời gian vận chuyển 2 ngày từ kho Trung Quốc về kho Việt Nam/);
  assert.match(t, /đền bù gấp 10 lần tiền cước và hoàn lại tiền cước/);
  assert.match(t, /Miễn phí dịch vụ cho đơn hàng đầu tiên\. Từ đơn thứ hai, phí tính theo giá trị tiền hàng: 3%, 2%, 1%/);
  assert.doesNotMatch(t, /bồi thường đang được cập nhật/);
});

test('/api/fx: chuyển tỷ giá từ CRM, ẩn khi chưa cấu hình / chưa đặt / lỗi', async () => {
  const { handleFx } = await import('../public/_worker.js');
  const ENV = { CRM_NEWS_URL: 'https://crm.example', NEWS_PUBLIC_KEY: 'k' };
  const req = (init) => new Request('https://vipgroup.com.vn/api/fx', init);
  const fake = (status, body) => async (url, init) => {
    assert.equal(url, 'https://crm.example/api/public/fx-rate');
    assert.equal(init.headers['x-news-key'], 'k');
    return new Response(JSON.stringify(body), { status });
  };
  assert.equal((await handleFx(req(), {})).status, 503);
  assert.equal((await handleFx(req({ method: 'POST', body: '{}' }), ENV)).status, 405);
  assert.equal((await handleFx(req(), ENV, fake(404, {}))).status, 404);
  assert.equal((await handleFx(req(), ENV, fake(200, { rate: 0 }))).status, 502);
  assert.equal((await handleFx(req(), ENV, fake(200, { rate: 'abc' }))).status, 502);
  assert.equal((await handleFx(req(), ENV, fake(200, { rate: 3.65 }))).status, 502, 'gõ nhầm tỷ giá');
  assert.equal((await handleFx(req(), ENV, fake(200, { rate: true }))).status, 502);
  assert.equal((await handleFx(req(), ENV, fake(200, { rate: 99999 }))).status, 502);
  assert.equal((await handleFx(req(), ENV, async () => { throw new Error('x'); })).status, 502);
  const ok = await handleFx(req(), ENV, fake(200, { exchange_rate: '3650.5', updated_at: '2026-11-17T03:00:00Z' }));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, rate: 3650.5, updated_at: '2026-11-17T03:00:00Z', tiers: [] }, 'CRM cũ không có tiers → bảng rỗng');
  assert.match(ok.headers.get('cache-control'), /max-age=300/);
});

// VIPG-WEB-038 (owner 27/11/2026): bảng tỷ giá CNY góc trái trang chủ — mức đã cộng từ CRM V12.3 (#/fx-board)
const T4 = [
  { label: 'Dưới 1.000 tệ', min_cny: null, min_inclusive: false, max_cny: 1000, max_inclusive: false, rate: 3970 },
  { label: 'Từ 1.000 đến dưới 3.000 tệ', min_cny: 1000, min_inclusive: true, max_cny: 3000, max_inclusive: false, rate: 3950 },
  { label: 'Từ 3.000 đến 5.000 tệ', min_cny: 3000, min_inclusive: true, max_cny: 5000, max_inclusive: true, rate: 3940 },
  { label: 'Trên 5.000 tệ', min_cny: 5000, min_inclusive: false, max_cny: null, max_inclusive: false, rate: 3930 },
];
test('/api/fx: chuyển bảng tỷ giá theo số tiền; sai một mức → bỏ cả bảng, rate vẫn dùng', async () => {
  const { handleFx, fxTiers } = await import('../public/_worker.js');
  const ENV = { CRM_NEWS_URL: 'https://crm.example', NEWS_PUBLIC_KEY: 'k' };
  const fake = (body) => async () => new Response(JSON.stringify(body), { status: 200 });
  const r = await handleFx(new Request('https://vipgroup.com.vn/api/fx'), ENV, fake({ rate: 3950, updated_at: '2026-11-27T02:00:00Z', tiers: [...T4.map((t) => ({ ...t, base: 3920 }))] }));
  const b = await r.json();
  assert.equal(b.rate, 3950);
  assert.deepEqual(b.tiers, T4, 'giữ đúng 4 mức, bỏ trường lạ');
  assert.deepEqual(fxTiers([{ ...T4[0], rate: 39.7 }, T4[1]]), [], 'gõ nhầm một mức');
  assert.deepEqual(fxTiers([{ ...T4[0], label: '' }]), []);
  assert.deepEqual(fxTiers([{ ...T4[0], min_cny: '1000' }]), []);
  assert.deepEqual(fxTiers('x'), []);
  assert.deepEqual(fxTiers(Array(9).fill(T4[0])), []);
});

test('trang chủ: khung tỷ giá góc trái ẩn tới khi CRM trả bảng, không số cứng', () => {
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
  const m = html.match(/<aside[^>]*data-fxb[^>]*>[\s\S]*?<\/aside>/);
  assert.ok(m, 'có khung tỷ giá');
  assert.match(m[0], /hidden/);
  assert.match(m[0], /aria-expanded="false"/);
  assert.doesNotMatch(m[0], /\d\.\d{3}đ|39\d\d/, 'không gõ tỷ giá vào HTML');
});

// VIPG-WEB-040 (owner 27/11/2026, CRM V12.5 "2b"): gọi giao hàng trên trang chủ
test('trang chủ: khung "Gọi giao hàng" — form ẩn sẵn, không action / name (gửi bằng fetch /api/delivery)', () => {
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
  const m = html.match(/<section class="section dr-section"[\s\S]*?<\/section>/);
  assert.ok(m, 'có khung gọi giao hàng');
  assert.match(m[0], /id="goi-giao-hang"/);
  assert.match(m[0], /<form[^>]*hidden/);
  assert.doesNotMatch(m[0], /<form[^>]*action=/);
  assert.doesNotMatch(m[0], /<(input|textarea)[^>]*\sname=/);
  assert.match(m[0], /data-dr="customer_phone"/);
});

test('/api/delivery: chuyển sang CRM (khóa + IP), chỉ trường cho phép; lỗi xác minh trả lại thông điệp; kết quả không có dữ liệu hồ sơ', async () => {
  const { handleDelivery } = await import('../public/_worker.js');
  const ENV = { CRM_NEWS_URL: 'https://crm.example', NEWS_PUBLIC_KEY: 'k' };
  const req = (body, init = {}) => new Request('https://vipgroup.com.vn/api/delivery', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' }, body: typeof body === 'string' ? body : JSON.stringify(body), ...init });
  let sent = null;
  const fake = (status, out) => async (url, init) => { assert.equal(url, 'https://crm.example/api/public/delivery-order'); assert.equal(init.headers['x-news-key'], 'k'); assert.equal(init.headers['x-client-ip'], '1.2.3.4'); sent = JSON.parse(init.body); return new Response(JSON.stringify(out), { status }); };
  assert.equal((await handleDelivery(new Request('https://vipgroup.com.vn/api/delivery'), ENV)).status, 405);
  assert.equal((await handleDelivery(req({}), {})).status, 503);
  assert.equal((await handleDelivery(req('{x'), ENV)).status, 400);
  const ok = await handleDelivery(req({ customer_code: 'VG1', customer_phone: '0900', address: 'abc', codes: 'A\nB', evil: 1 }), ENV, fake(200, { ok: true, code: 'GH-261127-001', status: 'pending_verify', status_label: 'Chờ xác minh', package_count: 2, name: 'lộ' }));
  assert.deepEqual(await ok.json(), { ok: true, code: 'GH-261127-001', status_label: 'Chờ xác minh', package_count: 2 });
  assert.ok(!('evil' in sent)); assert.equal(sent.codes, 'A\nB');
  const bad = await handleDelivery(req({ customer_code: 'VG1' }), ENV, fake(400, { error: { code: 'DELIVERY_VERIFY_FAILED', message: 'Mã khách hàng hoặc số điện thoại không khớp hồ sơ.' } }));
  assert.equal(bad.status, 400); assert.equal((await bad.json()).error, 'DELIVERY_VERIFY_FAILED');
  assert.equal((await handleDelivery(req({}), ENV, fake(500, {}))).status, 502);
});

// VIPG-WEB-041: Check cước giao hàng nội địa (Allingo) — /api/ship/quote + /api/ship/request
test('/api/ship/quote: chuyển CRM (khóa + IP), chỉ trường cho phép, chỉ trả giá khách; 429 / SHIP_DISABLED / sai đầu vào', async () => {
  const { handleShip } = await import('../public/_worker.js');
  const ENV = { CRM_NEWS_URL: 'https://crm.example/', NEWS_PUBLIC_KEY: 'k' };
  const req = (body) => new Request('https://vipgroup.com.vn/api/ship/quote', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  let sent = null;
  const fake = (status, out) => async (url, init) => { assert.equal(url, 'https://crm.example/api/public/ship/quote'); assert.equal(init.headers['x-news-key'], 'k'); assert.equal(init.headers['x-client-ip'], '1.2.3.4'); sent = JSON.parse(init.body); return new Response(JSON.stringify(out), { status }); };
  const good = { dest: { address: 'Hà Nội', lat: 21.03, lng: 105.85, evil: 1 }, weight_kg: '5', length_cm: 30, cod_amount: 0, evil: 1 };
  assert.equal((await handleShip(new Request('https://vipgroup.com.vn/api/ship/quote'), ENV, 'quote')).status, 405);
  assert.equal((await handleShip(req(good), {}, 'quote')).status, 503);
  assert.equal((await handleShip(req('{x'), ENV, 'quote')).status, 400);
  assert.equal((await handleShip(req({ ...good, dest: { lat: 0, lng: 0 } }), ENV, 'quote')).status, 400);
  assert.equal((await handleShip(req({ ...good, weight_kg: 0 }), ENV, 'quote')).status, 400);
  const ok = await handleShip(req(good), ENV, 'quote', fake(200, { quote_id: 'Q1', expires_at: '2026-11-27T10:00:00Z', note: 'n', options: [
    { key: 'a|b', carrier_code: 'a', carrier_name: 'A', service_code: 'b', service_name: 'B', eta_text: '1-2 ngày', customer_price: 30000, allingo_cost: 20000, markup: 5 }, { carrier_code: 'x' }] }));
  const d = await ok.json();
  assert.equal(d.ok, true); assert.equal(d.quote_id, 'Q1'); assert.equal(d.options.length, 1);
  assert.deepEqual(Object.keys(d.options[0]).sort(), ['carrier_code', 'carrier_name', 'customer_price', 'eta_text', 'key', 'service_code', 'service_name']);
  assert.deepEqual(sent, { dest: { address: 'Hà Nội', lat: 21.03, lng: 105.85 }, weight_kg: 5, length_cm: 30 });
  assert.equal((await handleShip(req(good), ENV, 'quote', fake(429, { error: { code: 'RATE' } }))).status, 429);
  const off = await handleShip(req(good), ENV, 'quote', fake(503, { error: { code: 'SHIP_DISABLED' } }));
  assert.equal(off.status, 503); assert.equal((await off.json()).error, 'ship_disabled');
  assert.equal((await handleShip(req(good), ENV, 'quote', fake(500, {}))).status, 502);
});

test('/api/ship/request: bắt buộc Turnstile, chỉ trường cho phép, 400 lệch mã/SĐT trả lại thông điệp, kết quả chỉ có order.code + status', async () => {
  const { handleShip } = await import('../public/_worker.js');
  const ENV = { CRM_NEWS_URL: 'https://crm.example', NEWS_PUBLIC_KEY: 'k', TURNSTILE_SECRET: 's' };
  const body = { customer_code: 'VG1', customer_phone: '0900000000', quote_id: 'Q1', option: { carrier_code: 'a', service_code: 'b', price: 1 }, address: 'abc', phone: '0911', codes: 'A\nB', package_count: 2, note: 'n', lat: 21, lng: 105, turnstile_token: 't', evil: 1 };
  const req = (b) => new Request('https://vipgroup.com.vn/api/ship/request', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' }, body: JSON.stringify(b) });
  let sent = null; let tsOk = true; let crmCalls = 0;
  const fake = (status, out) => async (url, init) => {
    if (String(url).includes('siteverify')) return new Response(JSON.stringify({ success: tsOk }));
    crmCalls++; assert.equal(url, 'https://crm.example/api/public/ship/request'); assert.equal(init.headers['x-news-key'], 'k'); sent = JSON.parse(init.body);
    return new Response(JSON.stringify(out), { status });
  };
  assert.equal((await handleShip(req(body), { ...ENV, TURNSTILE_SECRET: '' }, 'request', fake(200, {}))).status, 503);
  assert.equal((await handleShip(req({ ...body, quote_id: '' }), ENV, 'request', fake(200, {}))).status, 400);
  tsOk = false;
  assert.equal((await handleShip(req(body), ENV, 'request', fake(200, {}))).status, 403);
  assert.equal(crmCalls, 0, 'Turnstile hỏng → không gọi CRM');
  tsOk = true;
  const ok = await handleShip(req(body), ENV, 'request', fake(200, { order: { code: 'GH-261127-001', status: 'pending_verify', customer: 'lộ' }, secret: 1 }));
  assert.deepEqual(await ok.json(), { ok: true, order: { code: 'GH-261127-001', status: 'pending_verify' } });
  assert.ok(!('evil' in sent) && !('turnstile_token' in sent)); assert.deepEqual(sent.option, { carrier_code: 'a', service_code: 'b' }); assert.equal(sent.package_count, 2);
  const bad = await handleShip(req(body), ENV, 'request', fake(400, { error: { code: 'DELIVERY_VERIFY_FAILED', message: 'Mã khách hàng hoặc số điện thoại không khớp hồ sơ.' } }));
  assert.equal(bad.status, 400); assert.equal((await bad.json()).error, 'DELIVERY_VERIFY_FAILED');
  assert.equal((await handleShip(req(body), ENV, 'request', fake(429, {}))).status, 429);
});

test('/logistics/giao-hang-noi-dia/: bản đồ tự host, nhãn giá tạm tính, CSP cho ô OSM, không action / name; Leaflet 1.9.4 có đủ tệp', () => {
  const html = readFileSync(join(root, 'dist/logistics/giao-hang-noi-dia/index.html'), 'utf8');
  assert.match(html, /Giá tạm tính, VIP xác nhận khi duyệt/);
  assert.match(html, /src="\/vendor\/leaflet\/leaflet\.js"/);
  assert.doesNotMatch(html, /unpkg|cdnjs|jsdelivr/);
  assert.match(html, /img-src 'self' data: https:\/\/tile\.openstreetmap\.org https:\/\/\*\.tile\.openstreetmap\.org;/);
  assert.match(html, /connect-src 'self';/);
  assert.doesNotMatch(html, /<form[^>]*action=/);
  assert.doesNotMatch(html, /<(input|textarea)[^>]*\sname="(?!sq-opt)/);
  for (const f of ['leaflet.js', 'leaflet.css', 'images/marker-icon.png', 'images/marker-shadow.png', 'images/layers.png']) assert.ok(existsSync(join(root, 'dist/vendor/leaflet', f)), f);
  assert.match(readFileSync(join(root, 'dist/vendor/leaflet/leaflet.js'), 'utf8').slice(0, 200), /Leaflet 1\.9\.4/);
});
