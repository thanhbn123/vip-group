// Test HÀNH VI của .github/workflows/staging.yml: trích nguyên văn script `run:` của bước
// chốt nhánh đích và bước deploy, chạy thật bằng bash (-eo pipefail như GitHub runner).
// Bổ sung cho tests/security.test.mjs (kiểm cấu trúc). Trên CI chạy bằng bash 5 của Ubuntu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wf = readFileSync(join(root, '.github/workflows/staging.yml'), 'utf8');

/** Lấy khối `run: |` của bước có tên bắt đầu bằng `name`, bỏ thụt lề chung. */
function stepScript(name) {
  const lines = wf.split('\n');
  const start = lines.findIndex((l) => l.trimStart().startsWith(`- name: ${name}`));
  assert.ok(start >= 0, `không thấy bước "${name}"`);
  // Chỉ tìm trong phạm vi bước này: tới `- ` (bước kế tiếp) cùng mức thụt, hoặc dòng thụt nông hơn (job kế tiếp).
  const stepIndent = lines[start].match(/^\s*/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '') continue;
    const ind = l.match(/^\s*/)[0].length;
    if (ind < stepIndent || (ind === stepIndent && l.trimStart().startsWith('- '))) { end = i; break; }
  }
  const runAt = lines.findIndex((l, i) => i > start && i < end && /^\s+run: \|\s*$/.test(l));
  assert.ok(runAt > start, `bước "${name}" không có khối \`run: |\` trong phạm vi của nó`);
  const indent = lines[runAt].match(/^\s*/)[0].length + 2;
  const body = [];
  for (let i = runAt + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() !== '' && l.match(/^\s*/)[0].length < indent) break;
    body.push(l.slice(indent));
  }
  return body.join('\n') + '\n';
}

const tmp = mkdtempSync(join(tmpdir(), 'vipg-wf-'));
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));
const guardFile = join(tmp, 'guard.sh');
writeFileSync(guardFile, stepScript('Kiểm lại nhánh đích'));
const deployFile = join(tmp, 'deploy.sh');
writeFileSync(deployFile, stepScript('Deploy lên Cloudflare Pages'));

// Cờ shell như GitHub runner: `defaults.run.shell: bash` → `bash -eo pipefail`; không khai báo → `bash -e`.
const RUNNER_FLAGS = /\ndefaults:\s*\n\s+run:\s*\n\s+shell: bash\b/.test(wf) ? ['-eo', 'pipefail'] : ['-e'];

const bashRun = (file, env, cwd = tmp) =>
  spawnSync('bash', ['--noprofile', '--norc', ...RUNNER_FLAGS, file], {
    cwd, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8',
  });

const A = 'a'.repeat(40);
const B = 'b'.repeat(40); // SHA của merge ref (EVENT_SHA trong ca PR)
const C = 'c'.repeat(40); // một SHA khác hẳn
const push = (branch, sha) => ({ EVENT_NAME: 'push', EVENT_SHA: A, TARGET_BRANCH: branch, TARGET_SHA: sha });
const pr = (branch, sha, num = '12') => ({ EVENT_NAME: 'pull_request', EVENT_PR_NUMBER: num, EVENT_PR_HEAD_SHA: A, EVENT_SHA: B, TARGET_BRANCH: branch, TARGET_SHA: sha });

test('guard: output hợp lệ của job build được cho qua', () => {
  for (const [label, env] of [
    ['push staging@sha', push('staging', A)],
    ['PR pr-12@head', pr('pr-12', A)],
    ['dispatch staging@sha', { ...push('staging', A), EVENT_NAME: 'workflow_dispatch' }],
  ]) {
    const r = bashRun(guardFile, env);
    assert.equal(r.status, 0, `${label}: ${r.stdout}${r.stderr}`);
  }
});

test('guard: output bị sửa hoặc không hợp lệ bị chặn', () => {
  for (const [label, env] of [
    ['PR ghi đè alias staging', pr('staging', A)],
    ['PR trỏ sang pr-13', pr('pr-13', A)],
    ['PR đổi sang SHA lạ', pr('pr-12', C)],
    ['PR dùng SHA merge ref', pr('pr-12', B)],
    ['push đổi SHA', push('staging', B)],
    ['push đẩy main', push('main', A)],
    ['push đẩy production', push('production', A)],
    ['push mang tên pr-12', push('pr-12', A)],
    ['nhánh có ký tự lạ', push('staging;x', A)],
    ['SHA sai định dạng', push('staging', 'abc')],
    ['SHA viết hoa', push('staging', 'A'.repeat(40))],
    ['PR thiếu số', pr('pr-', A, '')],
    ['SHA rỗng', push('staging', '')],
  ]) {
    const r = bashRun(guardFile, env);
    assert.notEqual(r.status, 0, `${label} phải bị chặn`);
  }
});

function fakeNpx(mode) {
  const bin = join(tmp, `bin-${mode}`);
  if (!existsSync(bin)) mkdirSync(bin);
  const out = { fail: 'echo "ERROR auth" ; exit 1',
    // In URL rồi mới lỗi (vd. upload dở) — chỉ pipefail mới bắt được, kiểm URL thì không.
    failurl: 'echo "https://1a2b3c4d.vip-group.pages.dev"; echo "ERROR upload"; exit 1', nourl: 'echo "Uploaded 0 files"; exit 0', ok: 'echo "Deployment complete! https://1a2b3c4d.vip-group.pages.dev"; exit 0' }[mode];
  writeFileSync(join(bin, 'npx'), `#!/bin/bash\n${out}\n`);
  chmodSync(join(bin, 'npx'), 0o755);
  return bin;
}

function deploy(mode) {
  const summary = join(tmp, `summary-${mode}`);
  const r = spawnSync('bash', ['--noprofile', '--norc', ...RUNNER_FLAGS, deployFile], {
    cwd: tmp, encoding: 'utf8',
    env: { PATH: `${fakeNpx(mode)}:${process.env.PATH}`, GITHUB_STEP_SUMMARY: summary, CF_PAGES_PROJECT: 'vip-group',
           WRANGLER_VERSION: '0.0.0', TARGET_BRANCH: 'staging', TARGET_SHA: A },
  });
  const table = existsSync(summary) && readFileSync(summary, 'utf8').includes('## Staging deploy');
  return { status: r.status, table };
}

test('deploy: wrangler lỗi → bước FAIL, không in bảng deploy', () => {
  assert.deepEqual(deploy('fail'), { status: 1, table: false });
});

test('deploy: wrangler in URL rồi lỗi → bước FAIL (cần pipefail), không in bảng deploy', () => {
  assert.deepEqual(deploy('failurl'), { status: 1, table: false });
});

test('deploy: wrangler không in URL → bước FAIL, không in bảng deploy', () => {
  assert.deepEqual(deploy('nourl'), { status: 1, table: false });
});

test('deploy: wrangler thành công có URL → bước đạt và in bảng', () => {
  assert.deepEqual(deploy('ok'), { status: 0, table: true });
});
