// VIP CHAT V1.0 — khung "Phòng chat chung" trang chủ: cờ tắt mặc định, CSP, cấu hình API, base path demo.
// Kiểm thử giao diện bằng trình duyệt: node tests/chat-widget/run.mjs (xem tests/chat-widget/README.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewriteHtml } from '../scripts/astro-base-rewrite.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cspOf = (html) => html.match(/<meta http-equiv="content-security-policy" content="([^"]+)"/)?.[1] ?? '';
const build = (outDir, env) => {
  const clean = { ...process.env };
  for (const k of ['PUBLIC_CHAT_WIDGET', 'PUBLIC_CHAT_API_BASE', 'VIPG_BASE', 'VIPG_OUTDIR']) delete clean[k];
  const r = spawnSync('npx', ['astro', 'build'], { cwd: root, encoding: 'utf8', env: { ...clean, VIPG_OUTDIR: outDir, ...env } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return join(root, outDir);
};

test('mặc định TẮT: build production không có khung chat, CSP connect-src chỉ self',
  { skip: process.env.PUBLIC_CHAT_WIDGET === '1' && 'dist/ đang build với PUBLIC_CHAT_WIDGET=1' }, () => {
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
  assert.doesNotMatch(html, /phong-chat|data-cc-|cc-fab|cc-panel/, 'cả markup lẫn CSS của khung chat không được lọt vào');
  assert.match(cspOf(html), /connect-src 'self';/);
  const astroDir = join(root, 'dist/_astro');
  assert.ok(!existsSync(astroDir) || !readdirSync(astroDir).some((f) => /CommunityChat|community-chat/i.test(f)), 'không phát hành script khung chat khi tắt');
});

test('bật PUBLIC_CHAT_WIDGET=1: khung + nút nổi + sheet; CSP mở đúng origin API; script không dùng innerHTML', () => {
  const out = build('./dist-chat-test', { PUBLIC_CHAT_WIDGET: '1' });
  try {
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    assert.match(html, /<h2 id="cc-title"[^>]*>Phòng chat chung VIP GROUP<\/h2>/);
    assert.match(html, /data-api="https:\/\/khachhang\.vipgroup\.com\.vn"/);
    assert.match(html, /href="https:\/\/khachhang\.vipgroup\.com\.vn\/portal\/#\/cong-dong"/);
    assert.match(html, /Muốn tham gia chat, vui lòng đăng nhập \/ đăng ký VIP ID \(tài khoản đã có mã VG\)/);
    assert.match(html, /href="https:\/\/dangnhap\.vipgroup\.com\.vn\/"[^>]*data-track-location="community_chat"/);
    assert.match(html, /<dialog class="cc-sheet[^"]*" id="cc-sheet"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(cspOf(html), /connect-src 'self' https:\/\/khachhang\.vipgroup\.com\.vn;/);
    assert.doesNotMatch(cspOf(html), /unsafe-inline|unsafe-eval/);
    // Trang khác không có khung.
    assert.doesNotMatch(readFileSync(join(out, 'gioi-thieu/index.html'), 'utf8'), /data-cc-root/);
    const js = readdirSync(join(out, '_astro')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(out, '_astro', f), 'utf8')).join('\n');
    assert.match(js, /portal\/public\/community/);
    assert.match(js, /credentials:["`']omit["`']/);
    assert.doesNotMatch(js.slice(js.indexOf('portal/public/community') - 8000, js.indexOf('portal/public/community') + 8000), /innerHTML|insertAdjacentHTML|outerHTML/);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('PUBLIC_CHAT_API_BASE rỗng + VIPG_BASE=/demo-home/: gọi cùng origin, CSP chỉ self, tài nguyên dưới /demo-home/', () => {
  const out = build('./dist-chat-test-demo', { PUBLIC_CHAT_WIDGET: '1', PUBLIC_CHAT_API_BASE: '', VIPG_BASE: '/demo-home/' });
  try {
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    assert.match(html, /data-cc-root data-api(="")? data-join/, 'data-api rỗng');
    assert.match(html, /data-join="\/portal\/#\/cong-dong"/);
    assert.match(html, /href="\/portal\/#\/cong-dong"/, '/portal/ thuộc máy chủ CRM → không gắn base');
    assert.match(cspOf(html), /connect-src 'self';/);
    assert.match(html, /<script type="module" src="\/demo-home\/_astro\//);
    assert.match(html, /href="\/demo-home\/gioi-thieu\/"/);
    assert.doesNotMatch(html, /\s(?:href|src)="\/(?!demo-home\/|portal\/|\/)/, 'mọi đường dẫn tuyệt đối phải nằm dưới /demo-home/');
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('PUBLIC_CHAT_API_BASE sai định dạng → build dừng', () => {
  const r = spawnSync('npx', ['astro', 'build'], { cwd: root, encoding: 'utf8', env: { ...process.env, VIPG_OUTDIR: './dist-chat-test-bad', PUBLIC_CHAT_WIDGET: '1', PUBLIC_CHAT_API_BASE: 'javascript:alert(1)' } });
  rmSync(join(root, 'dist-chat-test-bad'), { recursive: true, force: true });
  assert.notEqual(r.status, 0);
});

test('rewriteHtml: gắn base cho href/src/srcset tuyệt đối, giữ URL ngoài, //, /portal/ và đường đã có base', () => {
  const out = rewriteHtml('<a href="/lien-he/"><img src="/a.png" srcset="/a-400.webp 400w, /a-600.webp 600w"><a href="https://x.vn/"><a href="//cdn/x"><a href="/portal/#/x"><a href="/b/_astro/y.js">', '/b/');
  assert.equal(out, '<a href="/b/lien-he/"><img src="/b/a.png" srcset="/b/a-400.webp 400w, /b/a-600.webp 600w"><a href="https://x.vn/"><a href="//cdn/x"><a href="/portal/#/x"><a href="/b/_astro/y.js">');
});

test('mock + kịch bản Playwright có trong repo', () => {
  for (const f of ['tests/chat-widget/mock-server.mjs', 'tests/chat-widget/run.mjs', 'tests/chat-widget/README.md']) assert.ok(existsSync(join(root, f)), f);
});
