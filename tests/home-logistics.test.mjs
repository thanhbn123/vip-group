// VIPG-WEB-034 — Trang chủ ưu tiên vận chuyển: bảng giá + ví dụ tính cước ngay sau banner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    assert.match(text(sec), /÷ 5000/);
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
  assert.deepEqual(await ok.json(), { ok: true, rate: 3650.5, updated_at: '2026-11-17T03:00:00Z' });
  assert.match(ok.headers.get('cache-control'), /max-age=300/);
});
