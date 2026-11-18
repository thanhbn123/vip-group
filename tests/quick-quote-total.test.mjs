// VIPG-WEB-036 — Báo giá nhanh tính như phiếu xuất kho (chủ dự án 18/11/2026 "1a 2a 3a 4a"): dòng chỉ hiện cân,
// đơn giá + thành tiền ở Tổng (bậc theo TỔNG cân), nhập nhanh tổng cân + số kiện, gợi ý bậc rẻ hơn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'dist', 'logistics/bang-gia/index.html'), 'utf8');
const qq = html.slice(html.indexOf('id="bao-gia-nhanh"'));
// script của QuickQuote được Astro đóng gói thành file riêng trong dist/_astro
const js = readdirSync(join(root, 'dist', '_astro')).filter((f) => f.startsWith('QuickQuote') && f.endsWith('.js'))
  .map((f) => readFileSync(join(root, 'dist', '_astro', f), 'utf8')).join('\n');

test('2a: cột từng dòng = cân thực / cân quy đổi / cân tính cước — không còn Đơn giá / Thành tiền từng dòng', () => {
  const head = qq.slice(qq.indexOf('<thead'), qq.indexOf('</thead>'));
  for (const k of ['Cân thực', 'Cân quy đổi', 'Cân tính cước', 'Số kiện']) assert.ok(head.includes(k), k);
  assert.ok(!head.includes('Đơn giá') && !head.includes('Thành tiền'), head);
});

test('3a: có ô nhập nhanh tổng cân + số kiện (gửi total_weight_kg)', () => {
  assert.match(qq, /id="qq-quick"/); assert.match(qq, /id="qq-qkg"/); assert.match(qq, /id="qq-qn"/);
  assert.ok(js.includes('total_weight_kg'), 'script gửi total_weight_kg');
});

test('1a + 4a: Tổng hiện bậc theo tổng cân, đơn giá, thành tiền; gợi ý bậc kế tiếp; song ngữ', () => {
  for (const k of ['Tổng cân tính cước', 'Tính như phiếu xuất kho', 'next_tier', '总计费重', '与出库单相同']) assert.ok(js.includes(k), k);
});
