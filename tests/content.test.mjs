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

// VIPG-WEB-021: "Bắc Ninh" là địa chỉ VIPORDER (đơn vị vận hành logistics) công bố tại viporder.com.vn —
// chỉ được xuất hiện trong khu /logistics/. Trang tập đoàn vẫn cấm (địa chỉ VIP GROUP là Lạng Sơn).
const LOGISTICS_ONLY = new Set(['Bắc Ninh']);
const isLogistics = (file) => file.replace(dist, '').startsWith('/logistics/');

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
    const raw = readFileSync(file, 'utf8');
    const t = text(raw);
    // V1.1: trên trang tập đoàn, "Bắc Ninh" CHỈ được nằm trong chữ của link trỏ vào /logistics/ (tên dịch vụ, không phải địa chỉ VIP GROUP).
    const tNoLogisticsLinks = text(raw.replace(/<a [^>]*href="\/logistics\/[^"]*"[^>]*>[^<]*<\/a>/g, ' '));
    for (const [needle, why] of FORBIDDEN) {
      if (LOGISTICS_ONLY.has(needle) && isLogistics(file)) continue;
      if (LOGISTICS_ONLY.has(needle)) { assert.ok(!tNoLogisticsLinks.includes(needle), `${file.replace(dist, '')}: "${needle}" — ${why}`); continue; }
      assert.ok(!t.includes(needle), `${file.replace(dist, '')}: "${needle}" — ${why}`);
    }
  }
});

test('chỉ có email và số điện thoại đã chốt trong bản build', () => {
  const PHONES = new Set(['0961102655', '+84961102655']);
  for (const file of allHtml()) {
    const html = readFileSync(file, 'utf8');
    const emails = new Set(html.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []);
    assert.deepEqual([...emails].filter((e) => e !== 'viporder@vipgroup.com.vn'), [], file);
    for (const [, tel] of html.matchAll(/href="tel:([^"]+)"/g)) assert.equal(tel, '0961102655', `${file}: tel lạ ${tel}`);
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

test('công ty thành viên (owner 07/11/2026 tách VIPORDER): trang thành viên có ghi chú ĐKDN; trang chủ không còn khối thành viên', () => {
  assert.ok(!readFileSync(join(dist, 'index.html'), 'utf8').includes('id="members-title"'), 'trang chủ không hiện khối Công ty thành viên khi chưa có thành viên');
  for (const f of ['cong-ty-thanh-vien/index.html']) {
    const t = text(readFileSync(join(dist, f), 'utf8'));
    assert.ok(!t.includes('Đang hoàn thiện'), `${f}: còn thẻ giữ chỗ`);
    assert.ok(!t.includes('Công ty thành viên khối'), `${f}: còn nhãn giữ chỗ`);
    assert.ok(t.includes('chưa có công ty thành viên riêng'), `${f}: thiếu ghi chú`);
    assert.ok(t.includes('CÔNG TY TNHH VIP GROUP trực tiếp thực hiện theo ngành nghề đăng ký'), `${f}: ghi chú thiếu nguồn`);
  }
  const tuyen = readFileSync(join(dist, 'tuyen-dung/index.html'), 'utf8');
  assert.ok(tuyen.includes('mailto:viporder@vipgroup.com.vn'), 'tuyển dụng phải gửi về email chính thức');
});

test('owner 07/11/2026: website TÁCH khỏi VIPORDER — không link viporder.com.vn, không nhắc tên VIPORDER / VIP ORDER (trừ email đã chốt)', () => {
  for (const file of allHtml()) {
    const html = readFileSync(file, 'utf8').replace(/viporder@vipgroup\.com\.vn/g, 'EMAIL');
    assert.doesNotMatch(html, /viporder\.com\.vn|khachhang\.viporder/i, `${file.replace(dist, '')}: còn link VIPORDER`);
    assert.doesNotMatch(html, /VIPORDER|VIP ORDER|XUẤT NHẬP KHẨU LOGISTICS VIP/i, `${file.replace(dist, '')}: còn tên VIPORDER`);
    assert.doesNotMatch(text(html), /Số 62 Khu đô thị Nam Hồng|Đồng Nguyên/, `${file.replace(dist, '')}: còn địa chỉ văn phòng VIPORDER`);
  }
});
