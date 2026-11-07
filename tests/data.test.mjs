// Kiểm tra quy tắc dữ liệu: không bịa pháp nhân, placeholder phải là null.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'vi');
const src = (f) => readFileSync(join(dataDir, f), 'utf8');

test('đủ sáu nhóm dữ liệu', () => {
  const files = readdirSync(dataDir);
  for (const f of ['company.ts', 'sectors.ts', 'subsidiaries.ts', 'news.ts', 'careers.ts', 'contact.ts']) {
    assert.ok(files.includes(f), `thiếu ${f}`);
  }
});

test('công ty thành viên placeholder không có tên pháp lý hay website', () => {
  const blocks = src('subsidiaries.ts').split(/\n  \{/).slice(1);
  // Owner directive 07/11/2026: tách khỏi VIPORDER — hiện không công bố công ty thành viên nào.
  assert.equal(blocks.length, 0);
  for (const b of blocks) {
    if (/status: 'placeholder'/.test(b)) {
      assert.match(b, /legalName: null/, 'placeholder không được có legalName');
      assert.match(b, /url: null/, 'placeholder không được có url');
    }
  }
  assert.match(src('subsidiaries.ts'), /export const subsidiaries: Subsidiary\[\] = \[\];/);
  assert.doesNotMatch(src('subsidiaries.ts'), /name: 'VIPORDER'|viporder\.com\.vn/);
});

test('liên hệ: đúng dữ liệu giấy ĐKDN + owner chốt 24/10/2026, form chưa có backend', () => {
  const c = src('contact.ts');
  assert.match(c, /email: 'viporder@vipgroup\.com\.vn'/);
  assert.match(c, /hotline: '0961102655'/);
  assert.match(c, /address: 'Số 183 đường Bắc Sơn, Phường Kỳ Lừa, Tỉnh Lạng Sơn, Việt Nam'/);
  const co = src('company.ts');
  assert.match(co, /legalName: 'CÔNG TY TNHH VIP GROUP'/);
  assert.match(co, /taxId: '4900951703'/);
  assert.match(co, /foundingDate: '2026-10-21'/);
  assert.match(co, /slogan: 'Con người - Công nghệ - Cơ hội'/);
  // VIPG-WEB-023: form chỉ bật khi owner ghi mã site Turnstile (công khai). Chưa cài → null → form như cũ.
  // Mã site Turnstile công khai (0x… ) — owner tạo 06/11/2026.
  assert.match(c, /const TURNSTILE_SITE_KEY: string \| null = '0x[0-9A-Za-z_-]{20,}';/);
  assert.match(c, /formBackendReady: siteKey !== null/);
});

test('không có secret trong mã nguồn', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const srcRoot = join(dataDir, '..', '..');
  for (const f of walk(srcRoot)) {
    const text = readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}/i, f);
  }
});

test('VIPG-WEB-013: không còn thẻ giữ chỗ công ty thành viên; email tuyển dụng là email chính thức', () => {
  // Owner giao đề xuất 24/10/2026: khối Công nghệ và Bất động sản chưa có pháp nhân riêng → không đặt thẻ giữ chỗ.
  assert.doesNotMatch(src('subsidiaries.ts'), /status: 'placeholder'/);
  assert.match(src('careers.ts'), /applyEmail: 'viporder@vipgroup\.com\.vn'/);
});
