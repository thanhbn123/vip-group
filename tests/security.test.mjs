// CSP + header bảo mật cho staging Cloudflare Pages (VIPG-WEB-003).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function allHtml(dir = dist) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return allHtml(p);
    return p.endsWith('.html') ? [p] : [];
  });
}
const sha256 = (s) => `sha256-${createHash('sha256').update(s).digest('base64')}`;
const cspOf = (html) => html.match(/<meta http-equiv="content-security-policy" content="([^"]+)"/)?.[1];

test('mọi trang có CSP <meta>, không có unsafe-inline / unsafe-eval', () => {
  for (const file of allHtml()) {
    const csp = cspOf(readFileSync(file, 'utf8'));
    assert.ok(csp, `${file}: thiếu CSP`);
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /form-action 'none'/, 'form chưa có backend → không cho submit đi đâu');
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  }
});

test('mọi script nội tuyến thực thi đều có hash trong CSP của trang đó', () => {
  for (const file of allHtml()) {
    const html = readFileSync(file, 'utf8');
    const csp = cspOf(html);
    for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/\ssrc=/.test(attrs) || /type="application\/ld\+json"/.test(attrs)) continue;
      assert.ok(csp.includes(`'${sha256(body)}'`), `${file}: script nội tuyến không có hash: ${body.slice(0, 60)}`);
    }
  }
});

test('public/_headers: header bảo mật + noindex cho *.pages.dev', () => {
  const p = join(dist, '_headers');
  assert.ok(existsSync(p), 'dist/_headers phải được copy từ public/');
  const h = readFileSync(p, 'utf8');
  for (const line of [
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'X-Frame-Options: DENY',
    "Content-Security-Policy: frame-ancestors 'none'",
  ]) assert.ok(h.includes(line), `thiếu: ${line}`);
  assert.match(h, /https:\/\/:project\.pages\.dev\/\*\n\s+X-Robots-Tag: noindex/);
  assert.match(h, /https:\/\/:version\.:project\.pages\.dev\/\*\n\s+X-Robots-Tag: noindex/);
});

test('workflow staging không bao giờ deploy nhánh production và không lộ secret cho bước build', () => {
  const wf = readFileSync(join(root, '.github/workflows/staging.yml'), 'utf8');
  assert.match(wf, /case "\$BRANCH" in main\|master\|production\)/, 'phải chặn nhánh production');
  assert.doesNotMatch(wf, /--branch=["']?main/);
  // Secret chỉ xuất hiện trong env của bước, không ở env cấp job.
  const jobEnv = wf.split('steps:')[0];
  assert.doesNotMatch(jobEnv, /secrets\./, 'secret không được đặt ở env cấp job');
  assert.match(wf, /--commit-hash=/, 'deploy phải gắn SHA thật');
});

test('workflow staging: deploy hỏng thì bước phải FAIL, không báo deploy giả', () => {
  const wf = readFileSync(join(root, '.github/workflows/staging.yml'), 'utf8');
  // shell: bash tường minh → GitHub chạy `bash -eo pipefail`, lỗi trong `| tee` không bị nuốt.
  assert.match(wf, /defaults:\s*\n\s+run:\s*\n\s+shell: bash\b/, 'phải khai báo defaults.run.shell: bash');
  const deploy = wf.slice(wf.indexOf('- name: Deploy lên Cloudflare Pages'));
  assert.match(deploy, /set -euo pipefail/, 'bước deploy phải set -euo pipefail');
  assert.match(deploy, /if \[ -z "\$URL" \]; then[\s\S]*?exit 1/, 'không có URL deployment → exit 1');
  assert.ok(deploy.indexOf('exit 1') < deploy.indexOf('## Staging deploy'), 'kiểm URL phải đứng trước khi in bảng deploy');
});

test('workflow staging: workflow_dispatch chỉ chạy từ develop', () => {
  const wf = readFileSync(join(root, '.github/workflows/staging.yml'), 'utf8');
  assert.match(wf, /if: github\.event_name != 'workflow_dispatch' \|\| github\.ref == 'refs\/heads\/develop'/);
});
