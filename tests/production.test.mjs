// Chế độ PRODUCTION: chặn việc production vô tình mang hành vi staging (noindex, URL staging),
// và kiểm workflow production chỉ phát hành được từ main, có cổng, không tự chạy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, mkdirSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const PROD = 'https://vipgroup.com.vn';

// ---------- _headers: mô phỏng cách Cloudflare Pages áp header theo host ----------
function parseHeaders(text) {
  const rules = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) { cur = { pattern: raw.trim(), headers: {} }; rules.push(cur); continue; }
    const m = raw.trim().match(/^([^:]+):\s*(.*)$/);
    assert.ok(cur && m, `dòng _headers không hợp lệ: ${raw}`);
    cur.headers[m[1].toLowerCase()] = m[2];
  }
  return rules;
}
function ruleMatches(pattern, url) {
  const u = new URL(url);
  if (pattern.startsWith('/')) {
    const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return re.test(u.pathname);
  }
  const p = new URL(pattern.replace(/:(\w+)/g, 'PH$1PH'));
  const hostRe = new RegExp('^' + p.hostname.replace(/\./g, '\\.').replace(/ph\w+ph/g, '[^.]+') + '$');
  const pathRe = new RegExp('^' + p.pathname.replace(/\*/g, '.*') + '$');
  return u.protocol === p.protocol && hostRe.test(u.hostname) && pathRe.test(u.pathname);
}
const headerRules = parseHeaders(readFileSync(join(dist, '_headers'), 'utf8'));
const headersFor = (url) => Object.assign({}, ...headerRules.filter((r) => ruleMatches(r.pattern, url)).map((r) => r.headers));

test('_headers: tên miền production KHÔNG bị noindex, vẫn giữ header bảo mật', () => {
  for (const path of ['/', '/lien-he/', '/khong-ton-tai/']) {
    for (const host of ['https://vipgroup.com.vn', 'https://www.vipgroup.com.vn']) {
      const h = headersFor(host + path);
      assert.equal(h['x-robots-tag'], undefined, `${host}${path} không được có X-Robots-Tag`);
      assert.equal(h['x-content-type-options'], 'nosniff');
      assert.equal(h['x-frame-options'], 'DENY');
      assert.equal(h['content-security-policy'], "frame-ancestors 'none'");
      assert.ok(h['referrer-policy'] && h['permissions-policy'] && h['cross-origin-opener-policy']);
    }
  }
});

test('_headers: mọi host *.pages.dev (production alias, staging, preview) đều noindex', () => {
  for (const host of ['https://vip-group.pages.dev', 'https://staging.vip-group.pages.dev', 'https://pr-12.vip-group.pages.dev', 'https://df7f0124.vip-group.pages.dev']) {
    assert.equal(headersFor(host + '/')['x-robots-tag'], 'noindex', host);
  }
});

test('_headers: rule "/*" không chứa X-Robots-Tag (noindex chỉ được gắn theo host pages.dev)', () => {
  for (const r of headerRules.filter((r) => r.pattern.startsWith('/'))) {
    assert.equal(r.headers['x-robots-tag'], undefined, `rule ${r.pattern} có X-Robots-Tag`);
  }
});

// ---------- dist: nội dung sẵn cho production ----------
function allFiles(dir = dist) {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? allFiles(p) : [p]; });
}
const PAGES = ['/', '/gioi-thieu/', '/linh-vuc-hoat-dong/', '/cong-ty-thanh-vien/', '/tin-tuc/', '/tuyen-dung/', '/lien-he/'];

test('trang production cho phép lập chỉ mục; chỉ 404 có noindex', () => {
  for (const p of PAGES) {
    const html = readFileSync(join(dist, p, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /<meta name="robots" content="[^"]*noindex/, `${p} có meta noindex`);
    assert.match(html, new RegExp(`<link rel="canonical" href="${PROD}${p}"`), `${p} canonical`);
  }
  assert.match(readFileSync(join(dist, '404.html'), 'utf8'), /<meta name="robots" content="noindex"/);
});

test('robots.txt và sitemap.xml trỏ tên miền production', () => {
  const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
  assert.match(robots, /^User-agent: \*\nAllow: \//m);
  assert.doesNotMatch(robots, /Disallow: \/\s*$/m);
  assert.match(robots, new RegExp(`Sitemap: ${PROD}/sitemap.xml`));
  const locs = [...readFileSync(join(dist, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, PAGES.length);
  for (const l of locs) assert.ok(l.startsWith(`${PROD}/`), l);
});

test('dist không chứa URL/nhãn staging (ngoài _headers)', () => {
  for (const f of allFiles().filter((f) => /\.(html|xml|txt|js|css|svg|json)$/.test(f))) {
    const t = readFileSync(f, 'utf8');
    assert.doesNotMatch(t, /pages\.dev|staging/i, `${f.replace(dist, '')} có chuỗi staging`);
  }
});

// ---------- workflow production: cấu trúc ----------
const wfText = readFileSync(join(root, '.github/workflows/production.yml'), 'utf8');
function jobs(wf) {
  const body = wf.slice(wf.indexOf('\njobs:') + 6);
  const out = {};
  const marks = [...body.matchAll(/^  ([a-z][\w-]*):\s*$/gm)];
  marks.forEach((m, i) => { out[m[1]] = body.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : undefined); });
  return out;
}

test('workflow production: chỉ chạy tay, chỉ từ main, có cổng environment', () => {
  const on = wfText.slice(wfText.indexOf('\non:'), wfText.indexOf('\npermissions:'));
  assert.match(on, /workflow_dispatch:/);
  assert.doesNotMatch(on, /\n  (push|pull_request|pull_request_target|schedule|workflow_run|release):/, 'production không được có trigger tự động');
  const j = jobs(wfText);
  assert.deepEqual(Object.keys(j).sort(), ['build', 'deploy']);
  assert.match(j.build, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(j.deploy, /needs: build/);
  assert.match(j.deploy, /environment: production/);
  assert.match(j.deploy, /\[ "\$EVENT_REF" = "refs\/heads\/main" \]/);
  assert.match(wfText, /permissions:\s*\n\s+contents: read/);
});

test('workflow production: chỉ deploy --branch=main, secret chỉ ở job deploy, input qua env', () => {
  const branches = [...wfText.matchAll(/--branch=("?)([^\s"\\]+)\1/g)].map((m) => m[2]);
  assert.deepEqual(branches, ['main']);
  const j = jobs(wfText);
  assert.doesNotMatch(j.build, /secrets\./);
  for (const bad of [/actions\/checkout/, /npm (ci|install|run)/]) assert.doesNotMatch(j.deploy, bad);
  assert.doesNotMatch(j.deploy.split('steps:')[0], /secrets\./);
  // Input người dùng không được nội suy thẳng vào script.
  for (const run of wfText.split(/\n\s+run: \|\n/).slice(1)) assert.doesNotMatch(run.split(/\n\s+- /)[0], /\$\{\{\s*inputs\./);
  assert.match(wfText, /CONFIRM_SHA: \$\{\{ inputs\.confirm_sha \}\}/);
});

test('staging không bao giờ deploy nhánh main; production không bao giờ deploy nhánh khác main', () => {
  const stg = readFileSync(join(root, '.github/workflows/staging.yml'), 'utf8');
  assert.ok(stg.includes('[[ "$TARGET_BRANCH" =~ ^(staging|pr-[0-9]+)$ ]]'));
  assert.doesNotMatch(stg, /--branch=["']?main/);
  assert.doesNotMatch(wfText, /TARGET_BRANCH|--branch=["']?(staging|pr-)/);
});

// ---------- workflow: hành vi (chạy thật script bằng bash) ----------
function stepScript(wf, name) {
  const lines = wf.split('\n');
  const start = lines.findIndex((l) => l.trimStart().startsWith(`- name: ${name}`));
  assert.ok(start >= 0, `không thấy bước "${name}"`);
  const stepIndent = lines[start].match(/^\s*/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]; if (l.trim() === '') continue;
    const ind = l.match(/^\s*/)[0].length;
    if (ind < stepIndent || (ind === stepIndent && l.trimStart().startsWith('- '))) { end = i; break; }
  }
  const runAt = lines.findIndex((l, i) => i > start && i < end && /^\s+run: \|\s*$/.test(l));
  assert.ok(runAt > start, `bước "${name}" không có khối \`run: |\` trong phạm vi`);
  const indent = lines[runAt].match(/^\s*/)[0].length + 2;
  const body = [];
  for (let i = runAt + 1; i < end; i++) { const l = lines[i]; if (l.trim() !== '' && l.match(/^\s*/)[0].length < indent) break; body.push(l.slice(indent)); }
  return body.join('\n') + '\n';
}
const tmp = mkdtempSync(join(tmpdir(), 'vipg-prod-'));
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));
const FLAGS = (wf) => (/\ndefaults:\s*\n\s+run:\s*\n\s+shell: bash\b/.test(wf) ? ['-eo', 'pipefail'] : ['-e']);
function runStep(wf, name, env, binDir) {
  const f = join(tmp, `s-${Math.random().toString(36).slice(2)}.sh`);
  writeFileSync(f, stepScript(wf, name));
  const r = spawnSync('bash', ['--noprofile', '--norc', ...FLAGS(wf), f], {
    cwd: tmp, encoding: 'utf8', env: { PATH: binDir ? `${binDir}:${process.env.PATH}` : process.env.PATH, ...env },
  });
  return r.status;
}
function fakeCurl(json, code = 0) {
  const bin = join(tmp, `curl-${Math.random().toString(36).slice(2)}`); mkdirSync(bin);
  writeFileSync(join(bin, 'curl'), `#!/bin/bash\n${code ? `exit ${code}` : `cat <<'J'\n${json}\nJ`}\n`); chmodSync(join(bin, 'curl'), 0o755);
  return bin;
}
const A = 'a'.repeat(40);
const CRED = { CLOUDFLARE_API_TOKEN: 'x', CLOUDFLARE_ACCOUNT_ID: 'y', CF_PAGES_PROJECT: 'vip-group' };

test('production: chỉ SHA gõ lại đúng mới qua', () => {
  const n = 'Xác nhận SHA phát hành';
  assert.equal(runStep(wfText, n, { CONFIRM_SHA: A, RUN_SHA: A }), 0);
  assert.notEqual(runStep(wfText, n, { CONFIRM_SHA: 'b'.repeat(40), RUN_SHA: A }), 0);
  assert.notEqual(runStep(wfText, n, { CONFIRM_SHA: '', RUN_SHA: A }), 0);
  assert.notEqual(runStep(wfText, n, { CONFIRM_SHA: 'abc', RUN_SHA: 'abc' }), 0);
});

test('production: ref khác main bị chặn; thiếu credential → FAIL', () => {
  const g = 'Kiểm lại ref và SHA (chỉ main)';
  assert.equal(runStep(wfText, g, { EVENT_REF: 'refs/heads/main', EVENT_SHA: A }), 0);
  for (const ref of ['refs/heads/develop', 'refs/heads/staging', 'refs/tags/v1', '']) assert.notEqual(runStep(wfText, g, { EVENT_REF: ref, EVENT_SHA: A }), 0, ref);
  const c = 'Kiểm credential Cloudflare (thiếu → FAIL)';
  assert.equal(runStep(wfText, c, { HAS_TOKEN: 'true', HAS_ACCOUNT: 'true', CF_PAGES_PROJECT: 'vip-group' }), 0);
  assert.notEqual(runStep(wfText, c, { HAS_TOKEN: 'false', HAS_ACCOUNT: 'true', CF_PAGES_PROJECT: 'vip-group' }), 0);
  assert.notEqual(runStep(wfText, c, { HAS_TOKEN: 'true', HAS_ACCOUNT: 'true', CF_PAGES_PROJECT: '' }), 0);
});

test('preflight production_branch (production + staging): chỉ "main" mới qua', () => {
  const stg = readFileSync(join(root, '.github/workflows/staging.yml'), 'utf8');
  const name = 'Kiểm production branch của project Cloudflare = main';
  for (const wf of [wfText, stg]) {
    assert.equal(runStep(wf, name, CRED, fakeCurl('{"success":true,"result":{"production_branch":"main"}}')), 0);
    assert.notEqual(runStep(wf, name, CRED, fakeCurl('{"success":true,"result":{"production_branch":"staging"}}')), 0);
    assert.notEqual(runStep(wf, name, CRED, fakeCurl('{"success":false,"errors":[{"code":10000}]}')), 0);
    assert.notEqual(runStep(wf, name, CRED, fakeCurl('', 22)), 0, 'curl lỗi HTTP phải FAIL');
  }
});
