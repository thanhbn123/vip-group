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
  assert.ok(blocks.length >= 1);
  for (const b of blocks) {
    if (/status: 'placeholder'/.test(b)) {
      assert.match(b, /legalName: null/, 'placeholder không được có legalName');
      assert.match(b, /url: null/, 'placeholder không được có url');
    }
  }
  assert.match(src('subsidiaries.ts'), /name: 'VIPORDER'[\s\S]*?status: 'active'/);
  // Owner chốt 24/10/2026: VIPORDER và VIP GROUP là hai công ty CÙNG CHỦ SỞ HỮU, không phải mẹ – con.
  assert.match(src('subsidiaries.ts'), /relation: 'Cùng chủ sở hữu với VIP GROUP'/);
});

test('liên hệ: đúng dữ liệu giấy ĐKDN + owner chốt 24/10/2026, form chưa có backend', () => {
  const c = src('contact.ts');
  assert.match(c, /email: 'viporder@vipgroup\.com\.vn'/);
  assert.match(c, /hotline: '0968961962'/);
  assert.match(c, /address: 'Số 183 đường Bắc Sơn, Phường Kỳ Lừa, Tỉnh Lạng Sơn, Việt Nam'/);
  const co = src('company.ts');
  assert.match(co, /legalName: 'CÔNG TY TNHH VIP GROUP'/);
  assert.match(co, /taxId: '4900951703'/);
  assert.match(co, /foundingDate: '2026-10-21'/);
  assert.match(co, /slogan: 'Con người - Công nghệ - Cơ hội'/);
  assert.match(c, /formBackendReady: false/);
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
