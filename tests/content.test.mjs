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
  ['tập đoàn', 'danh xưng pháp lý chưa được xác nhận'],
  ['∞', 'chỉ số vô nghĩa'],
  ['Kết nối giá trị', 'slogan cũ — owner chốt slogan logo 24/10/2026'],
  ['Kiến tạo tương lai', 'slogan cũ — owner chốt slogan logo 24/10/2026'],
  ['contact@vipgroup.com.vn', 'email cũ — owner chốt viporder@vipgroup.com.vn 24/10/2026'],
  ['công ty mẹ', 'giấy tờ chỉ cho thấy cùng chủ sở hữu'],
  ['công ty con', 'giấy tờ chỉ cho thấy cùng chủ sở hữu'],
];

test('không có chuỗi chưa có nguồn trong nội dung hiển thị', () => {
  for (const file of allHtml()) {
    const t = text(readFileSync(file, 'utf8'));
    for (const [needle, why] of FORBIDDEN) {
      assert.ok(!t.includes(needle), `${file.replace(dist, '')}: "${needle}" — ${why}`);
    }
  }
});

test('chỉ có email và số điện thoại đã chốt trong bản build', () => {
  const PHONES = new Set(['0968961962', '+84968961962']);
  for (const file of allHtml()) {
    const html = readFileSync(file, 'utf8');
    const emails = new Set(html.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []);
    assert.deepEqual([...emails].filter((e) => e !== 'viporder@vipgroup.com.vn'), [], file);
    for (const [, tel] of html.matchAll(/href="tel:([^"]+)"/g)) assert.equal(tel, '0968961962', `${file}: tel lạ ${tel}`);
    // Số điện thoại VN: 0xxx hoặc +84, 9–11 chữ số — chỉ được là số đã chốt (trong chữ hiển thị và JSON-LD).
    for (const [m] of (text(html) + ' ' + html).matchAll(/(?:\+84|\b0)(?:[\s.]?\d){8,10}\b/g)) {
      assert.ok(PHONES.has(m.replace(/[\s.]/g, '')), `${file}: số điện thoại lạ ${m}`);
    }
  }
});

test('dữ liệu pháp nhân hiển thị trên site (không còn "Đang cập nhật" cho hotline/địa chỉ)', () => {
  for (const file of allHtml()) {
    const t = text(readFileSync(file, 'utf8'));
    assert.match(t, /CÔNG TY TNHH VIP GROUP/, `${file}: thiếu tên pháp lý`);
    assert.match(t, /4900951703/, `${file}: thiếu mã số doanh nghiệp`);
    assert.match(t, /Số 183 đường Bắc Sơn, Phường Kỳ Lừa, Tỉnh Lạng Sơn, Việt Nam/, `${file}: thiếu địa chỉ`);
    assert.doesNotMatch(t, /Hotline:\s*Đang cập nhật|Địa chỉ:\s*Đang cập nhật/, file);
  }
});
