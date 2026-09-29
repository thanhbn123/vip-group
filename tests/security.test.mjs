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

test('script nội tuyến thực thi nằm SAU thẻ CSP (để trình duyệt kiểm hash)', () => {
  for (const file of allHtml()) {
    const html = readFileSync(file, 'utf8');
    const cspAt = html.indexOf('http-equiv="content-security-policy"');
    assert.ok(cspAt > 0, `${file}: thiếu CSP`);
    for (const m of html.matchAll(/<script([^>]*)>/g)) {
      if (/type="application\/ld\+json"/.test(m[1])) continue;
      assert.ok(m.index > cspAt, `${file}: <script${m[1]}> đứng trước thẻ CSP`);
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

// Tách workflow theo job: văn bản từ `  <tên>:` (thụt 2) tới job kế tiếp.
function jobs(wf) {
  const body = wf.slice(wf.indexOf('\njobs:') + 6);
  const out = {};
  const re = /^  ([a-z][\w-]*):\s*$/gm;
  const marks = [...body.matchAll(re)];
  marks.forEach((m, i) => { out[m[1]] = body.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : undefined); });
  return out;
}

test('workflow staging không bao giờ deploy nhánh production', () => {
  const wf = readFileSync(join(root, '.github/workflows/staging.yml'), 'utf8');
  assert.match(wf, /case "\$BRANCH" in main\|master\|production\)/, 'job build phải chặn nhánh production');
  assert.ok(wf.includes('[[ "$TARGET_BRANCH" =~ ^(staging|pr-[0-9]+)$ ]]'), 'job deploy chỉ nhận đúng staging | pr-<số>');
  assert.doesNotMatch(wf, /--branch=["']?main/);
  assert.match(wf, /--commit-hash=/, 'deploy phải gắn SHA thật');
  // Preview PR phải build từ đúng PR HEAD — trùng với SHA gắn vào --commit-hash.
  assert.match(wf, /uses: actions\/checkout@v\d+\s*\n\s+with:\s*\n\s+ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(wf, /SHA="\$\{\{ github\.event\.pull_request\.head\.sha \}\}"/);
  assert.match(wf, /SHA="\$\{\{ github\.sha \}\}"/);
});

test('workflow staging cô lập credential: job chạy mã repo không cầm secret, job cầm secret không chạy mã repo', () => {
  const wf = readFileSync(join(root, '.github/workflows/staging.yml'), 'utf8');
  const j = jobs(wf);
  assert.deepEqual(Object.keys(j).sort(), ['build', 'deploy']);
  assert.doesNotMatch(wf.slice(0, wf.indexOf('\njobs:')), /secrets\./, 'secret không được ở cấp workflow');
  assert.doesNotMatch(j.build, /secrets\./, 'job build (chạy npm ci/build/test) không được cầm secret');
  for (const bad of [/actions\/checkout/, /npm (ci|install|run)/, /node_modules/]) {
    assert.doesNotMatch(j.deploy, bad, `job deploy không được chạy mã repo: ${bad}`);
  }
  assert.match(j.deploy, /needs: build/);
  assert.match(j.deploy, /actions\/download-artifact@v\d+/, 'job deploy chỉ dùng artifact dist');
  assert.match(j.build, /actions\/upload-artifact@v\d+/);
  // Trong job deploy, secret chỉ ở env của bước kiểm credential và bước deploy.
  const stepEnvSecrets = j.deploy.split('\n      - ').filter((st) => /secrets\./.test(st));
  assert.equal(stepEnvSecrets.length, 2);
  assert.ok(stepEnvSecrets.every((st) => /Kiểm credential|Deploy lên Cloudflare Pages/.test(st)));
  assert.doesNotMatch(j.deploy.split('steps:')[0], /secrets\./, 'secret không được ở env cấp job deploy');
});

test('workflow staging: job deploy tự tính nhánh/SHA mong đợi và so khớp output của build', () => {
  const wf = readFileSync(join(root, '.github/workflows/staging.yml'), 'utf8');
  const d = jobs(wf).deploy;
  for (const v of ['EVENT_NAME: ${{ github.event_name }}', 'EVENT_PR_NUMBER: ${{ github.event.pull_request.number }}',
                   'EVENT_PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}', 'EVENT_SHA: ${{ github.sha }}']) {
    assert.ok(d.includes(v), `job deploy thiếu ${v}`);
  }
  assert.match(d, /if \[ "\$TARGET_BRANCH" != "\$EXPECT_BRANCH" \] \|\| \[ "\$TARGET_SHA" != "\$EXPECT_SHA" \]; then[\s\S]*?exit 1/);
  // Chốt so khớp phải đứng trước bước kiểm credential / deploy.
  assert.ok(d.indexOf('EXPECT_BRANCH') < d.indexOf('Kiểm credential'));
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
  const j = jobs(wf);
  assert.match(j.build, /if: github\.event_name != 'workflow_dispatch' \|\| github\.ref == 'refs\/heads\/develop'/);
  assert.match(j.deploy, /needs: build/, 'deploy phụ thuộc build → build bị chặn thì deploy cũng không chạy');
});
