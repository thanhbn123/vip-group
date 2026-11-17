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

// Kỳ vọng tính tay theo bảng giá owner 06–07/11/2026 + hệ số 5000 (17/11/2026).
const EXPECTED = [
  ['Kiện nhỏ', '3 kg', '20.000đ/kg', '60.000đ'], // 30×20×15 → 1,8 kg quy đổi < 3 kg thực
  ['Kiện vừa', '20 kg', '16.000đ/kg', '320.000đ'], // 50×40×30 → 12 kg quy đổi < 20 kg thực
  ['Kiện nhẹ nhưng cồng kềnh', '24 kg', '16.000đ/kg', '384.000đ'], // 60×50×40 → 24 kg quy đổi > 8 kg thực
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
