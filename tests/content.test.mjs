// Chốt trung thực nội dung trên bản build: không để lọt lại dữ liệu chưa có nguồn.
// Danh sách dưới là các chuỗi đã từng xuất hiện ở bản nháp hoặc bị verifier gắn cờ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function allHtml(dir = dist) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return allHtml(p);
    return p.endsWith('.html') ? [p] : [];
  });
}

const text = (html) =>
  html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');

const FORBIDDEN = [
  ['VIP TECHNOLOGY', 'tên công ty thành viên tự đặt'],
  ['VIP PROPERTY', 'tên công ty thành viên tự đặt'],
  ['Bắc Ninh', 'địa chỉ chưa được owner cung cấp'],
  ['Việt Nam', 'khẳng định địa lý chưa có trong brief'],
  ['tập đoàn', 'danh xưng pháp lý chưa được xác nhận'],
  ['∞', 'chỉ số vô nghĩa'],
];

test('không có chuỗi chưa có nguồn trong nội dung hiển thị', () => {
  for (const file of allHtml()) {
    const t = text(readFileSync(file, 'utf8'));
    for (const [needle, why] of FORBIDDEN) {
      assert.ok(!t.includes(needle), `${file.replace(dist, '')}: "${needle}" — ${why}`);
    }
  }
});

test('chỉ có một email và không có số điện thoại trong bản build', () => {
  for (const file of allHtml()) {
    const html = readFileSync(file, 'utf8');
    const emails = new Set(html.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []);
    assert.deepEqual([...emails].filter((e) => e !== 'contact@vipgroup.com.vn'), [], file);
    assert.doesNotMatch(html, /href="tel:/, `${file}: có link tel: khi hotline chưa chốt`);
    // Số điện thoại VN: 0xxx hoặc +84, 9–11 chữ số, cho phép khoảng trắng/dấu chấm.
    assert.doesNotMatch(text(html), /(?:\+84|\b0)(?:[\s.]?\d){8,10}\b/, `${file}: có chuỗi giống số điện thoại`);
  }
});
