// VIPG-WEB-015 — chạy THẬT script root nối Caddy dưới /bin/bash, giả lập id/getent/docker/curl/sleep.
// Không cần máy chủ, không cần Docker, không cần mạng. Mỗi cửa chặn có ca thử ngược.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'ops', 'apex-redirect', 'noi-caddy-apex-root.sh');
const BASE = 'vip-hq.example {\n\treverse_proxy 127.0.0.1:9000\n}\n';

function setup({ uid = '0', ip = '160.22.170.20', validateOk = true, caddy = BASE } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vipg-apex-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const stub = (name, body) => {
    const f = join(bin, name);
    writeFileSync(f, `#!/bin/bash\n${body}\n`);
    chmodSync(f, 0o755);
  };
  stub('id', `echo ${uid}`);
  stub('getent', ip ? `echo "${ip}   $2"` : 'exit 2');
  stub('docker', `echo "$*" >> "${dir}/docker.log"; case "$*" in *validate*) ${validateOk ? 'exit 0' : 'exit 1'};; esac; exit 0`);
  stub('curl', 'echo "301 https://www.vipgroup.com.vn/"');
  stub('sleep', 'exit 0');
  const cf = join(dir, 'Caddyfile');
  writeFileSync(cf, caddy);
  const run = () => spawnSync('/bin/bash', [SCRIPT], { encoding: 'utf8', env: { PATH: `${bin}:/usr/bin:/bin`, CADDYFILE: cf } });
  const dockerLog = () => (existsSync(join(dir, 'docker.log')) ? readFileSync(join(dir, 'docker.log'), 'utf8') : '');
  const backups = () => readdirSync(dir).filter((f) => f.startsWith('Caddyfile.bak-truoc-vipg-web-015-'));
  return { dir, cf, run, dockerLog, backups };
}
const count = (s, sub) => s.split(sub).length - 1;

test('apex: chạy đúng → nối đúng MỘT khối redir 301 sang www, validate rồi reload, có sao lưu', () => {
  const t = setup();
  const r = t.run();
  assert.equal(r.status, 0, r.stderr);
  const cf = readFileSync(t.cf, 'utf8');
  assert.ok(cf.startsWith(BASE), 'nội dung cũ phải giữ nguyên ở đầu');
  assert.equal(count(cf, '\nvipgroup.com.vn {\n'), 1);
  assert.match(cf, /redir https:\/\/www\.vipgroup\.com\.vn\{uri\} permanent/);
  assert.match(t.dockerLog(), /validate[\s\S]*reload/);
  assert.equal(t.backups().length, 1);
  assert.equal(readFileSync(join(t.dir, t.backups()[0]), 'utf8'), BASE);
});

test('apex: chạy lại → không nối đôi, không reload thêm', () => {
  const t = setup();
  assert.equal(t.run().status, 0);
  const sau1 = readFileSync(t.cf, 'utf8');
  const r = t.run();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /không nối lại/);
  assert.equal(readFileSync(t.cf, 'utf8'), sau1);
  assert.equal(count(t.dockerLog(), 'reload'), 1);
});

test('apex: validate hỏng → KHÔI PHỤC Caddyfile nguyên byte, KHÔNG reload, mã 5', () => {
  const t = setup({ validateOk: false });
  const r = t.run();
  assert.equal(r.status, 5);
  assert.equal(readFileSync(t.cf, 'utf8'), BASE);
  assert.doesNotMatch(t.dockerLog(), /reload/);
});

test('apex: không phải root → mã 2, không đụng file', () => {
  const t = setup({ uid: '1000' });
  assert.equal(t.run().status, 2);
  assert.equal(readFileSync(t.cf, 'utf8'), BASE);
  assert.equal(t.dockerLog(), '');
});

test('apex: DNS chưa trỏ về VPS (sai IP hoặc rỗng) → mã 3, không đụng file', () => {
  for (const ip of ['1.2.3.4', '']) {
    const t = setup({ ip });
    assert.equal(t.run().status, 3, `ip=${ip}`);
    assert.equal(readFileSync(t.cf, 'utf8'), BASE);
    assert.equal(t.backups().length, 0);
  }
});

test('apex: Caddyfile đã có khối khác khai báo tên miền gốc → mã 4, không nối trùng', () => {
  for (const head of ['vipgroup.com.vn {', 'https://vipgroup.com.vn, other.example {', '  vipgroup.com.vn']) {
    const caddy = BASE + `\n${head}\n\trespond "cu"\n}\n`;
    const t = setup({ caddy });
    assert.equal(t.run().status, 4, head);
    assert.equal(readFileSync(t.cf, 'utf8'), caddy);
  }
});

test('apex: khối www / tên miền con / tên gần giống KHÔNG bị nhận nhầm là tên miền gốc', () => {
  const caddy = BASE + '\nwww.vipgroup.com.vn {\n\trespond "x"\n}\nhq.vipgroup.com.vn {\n\trespond "y"\n}\nvipgroupXcomXvn {\n\trespond "z"\n}\n';
  const t = setup({ caddy });
  assert.equal(t.run().status, 0);
});

test('apex: phần lệnh của script không xoá file, không tắt tiến trình theo mẫu, không chạm bản ghi DNS', () => {
  const lenh = readFileSync(SCRIPT, 'utf8').replace(/^\s*#.*$/gm, '');
  const cam = [/\brm\s/, new RegExp('\\b(p' + 'kill|kill' + 'all)\\b'), /\b(dig|nsupdate)\b/];
  for (const re of cam) assert.doesNotMatch(lenh, re);
});
