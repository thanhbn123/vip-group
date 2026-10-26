// V-13417 — chạy THẬT script đổi mount Caddy dưới /bin/bash. Docker, curl, python3, stat là giả lập CÓ TRẠNG THÁI
// (container nào tồn tại, đang chạy, gắn tệp hay thư mục) viết bằng node — không cần máy chủ, Docker, mạng hay python3.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'ops', 'caddy-dung-chung', 'doi-mount-thu-muc-root.sh');
const IMG = 'sha256:0c994536bddb66445885237f1a5dcc1916bccea922661c76b4e9fc24061f9b52';
const CADDY = 'hub.staging.vipgroup.com.vn {\n\treverse_proxy 127.0.0.1:19000\n}\nvipgroup.com.vn, http://vipgroup.com.vn {\n\tredir https://www.vipgroup.com.vn{uri} permanent\n}\n*.vipgroup.com.vn {\n\trespond "x"\n}\n';
const tao = [];
after(() => { for (const d of tao) rmSync(d, { recursive: true, force: true }); });

const DOCKER = String.raw`#!/usr/bin/env node
const fs = require('fs'); const [, , ...a] = process.argv; const ST = process.env.ST_FILE; const O = JSON.parse(process.env.STUB_OPT);
const s = JSON.parse(fs.readFileSync(ST, 'utf8')); const save = () => fs.writeFileSync(ST, JSON.stringify(s));
fs.appendFileSync(process.env.DOCKER_LOG, a.join(' ') + '\n');
const out = (x) => process.stdout.write(x + '\n'); const C = 'vip-staging-caddy';
const cmd = a[0];
if (cmd === 'inspect') {
  const n = a[1]; const c = s.c[n]; if (!c) process.exit(1);
  const fi = a.indexOf('--format'); if (fi < 0) { out('{"Name":"' + n + '"}'); process.exit(0); }
  const f = a[fi + 1];
  if (f.includes('.Mounts')) {
    out(c.mount === 'dir' ? 'bind::' + O.srv + ':/etc/caddy:false' : 'bind::' + O.srv + '/Caddyfile:/etc/caddy/Caddyfile:false');
    out('volume:' + (O.volName || 'vip-staging-caddy-config') + ':/var/lib/docker/volumes/vip-staging-caddy-config/_data:/config:true');
    out('volume:vip-staging-caddy-data:/var/lib/docker/volumes/vip-staging-caddy-data/_data:/data:true');
  } else if (f.includes('.Config.Env')) {
    out('PATH=/usr/bin'); out('CADDY_VERSION=v2.11.4'); out('XDG_CONFIG_HOME=/config'); out('XDG_DATA_HOME=' + (O.dataHome || '/data'));
    if (O.extraEnv) out('SECRET_X=1');
  } else if (f === '{{.State.Running}}') out(String(c.running));
  else if (f.startsWith('{{.State.Running}}|')) out(c.running + '|' + (O.image || '${IMG}') + '|host|unless-stopped|["caddy","run","--config","/etc/caddy/Caddyfile","--adapter","caddyfile"]|null||/srv|false|false|json-file');
  else if (f.includes('IpcMode')) out(JSON.stringify(O.ipcMode === undefined ? 'private' : O.ipcMode));
  else if (f.startsWith('{{json ')) out(O.nonDefault && f.includes(O.nonDefault) ? '[{"Name":"nofile"}]' : (f.includes('Memory') || f.includes('NanoCpus') ? '0' : 'null'));
  else out('?');
} else if (cmd === 'exec') {
  const c = s.c[a[1]]; const rest = a.slice(2).join(' ');
  if (rest.startsWith('stat -c')) out(c.mount === 'dir' ? '528439' : '528434');
  else if (rest.includes('caddy reload')) process.exit(O.reloadFails ? 1 : 0);
} else if (cmd === 'run') {
  if (a.includes('--rm')) {
    if (a.includes('adapt')) { out(O.adaptJson || '{"apps":{"http":{"x":1}},"admin":{}}'); }
    else process.exit(O.validateOk === false ? 1 : 0);
  } else {
    if (O.runFails) process.exit(1);
    const n = a[a.indexOf('--name') + 1]; if (s.c[n]) process.exit(1);
    s.c[n] = { role: 'new', running: true, mount: O.newMount || 'dir' }; save(); out('newid');
  }
} else if (cmd === 'stop') {
  const c = s.c[a[a.length - 1]]; if (!c) process.exit(1);
  if (O.slowStop && c.role === 'old' && !s.slept) { s.slept = 1; save(); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, O.slowStop); }
  if (!(O.newStopFails && c.role === 'new')) c.running = false; save();
} else if (cmd === 'rename') {
  if (O.renameFails && !s.renamed) { s.renamed = 1; save(); process.exit(1); }
  if (!s.c[a[1]] || s.c[a[2]]) process.exit(1);
  s.c[a[2]] = s.c[a[1]]; delete s.c[a[1]]; save();
} else if (cmd === 'start') { const c = s.c[a[1]]; if (!c) process.exit(1); c.running = true; if (c.role === 'old') s.rolledBack = 1; save(); }
`;
const CURL = String.raw`#!/usr/bin/env node
const fs = require('fs'); const a = process.argv.slice(2); const O = JSON.parse(process.env.STUB_OPT);
const s = JSON.parse(fs.readFileSync(process.env.ST_FILE, 'utf8'));
const run = Object.values(s.c).filter((c) => c.running);
const one = run.length === 1 ? run[0] : null;
if (a.join(' ').includes('2019/config')) {
  if (!one || (one.role === 'new' && O.adminDown) || (one.role === 'old' && s.rolledBack && O.oldAdminDown)) process.exit(7);
  if (!a.includes('/dev/null')) process.stdout.write(O.runningJson || '{"admin":{},"apps":{"http":{"x":1}}}');
  process.exit(0);
}
let code = '200';
if (!one || O.allDown) code = '000';
else if (one.role === 'new' && O.codesChange) code = '502';
else if (one.role === 'old' && s.rolledBack && O.codesAfterRollback) code = '503';
process.stdout.write(code); process.exit(code === '000' ? 7 : 0);
`;
const PY = String.raw`#!/usr/bin/env node
let d = ''; process.stdin.on('data', (x) => (d += x)).on('end', () => {
  const sort = (v) => (Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v);
  try { process.stdout.write(JSON.stringify(sort(JSON.parse(d))) + '\n'); } catch { process.exit(1); }
});
`;

function setup(o = {}) {
  const { uid = '0', mountMode = 'file', running = true, env = {}, noContainer = false } = o;
  const dir = mkdtempSync(join(tmpdir(), 'vipg-mount-')); tao.push(dir);
  const bin = join(dir, 'bin'); mkdirSync(bin);
  const srv = join(dir, 'srv'); mkdirSync(srv);
  writeFileSync(join(srv, 'Caddyfile'), CADDY);
  const st = join(dir, 'st.json');
  writeFileSync(st, JSON.stringify({ c: noContainer ? {} : { 'vip-staging-caddy': { role: 'old', running, mount: mountMode } } }));
  const w = (n, body) => { const f = join(bin, n); writeFileSync(f, body); chmodSync(f, 0o755); };
  w('docker', DOCKER); w('curl', CURL); w('python3', PY);
  w('id', `#!/bin/bash\necho ${uid}\n`); w('stat', '#!/bin/bash\necho 528439\n'); w('sleep', '#!/bin/bash\nexit 0\n');
  const dlog = join(dir, 'docker.log');
  const ENV = { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, CADDY_DIR: srv, TRASH_ROOT: join(dir, 'thung-rac'),
    WAIT_TRIES: '2', CMP_TRIES: '2', ST_FILE: st, DOCKER_LOG: dlog, STUB_OPT: JSON.stringify({ ...o, srv }), CHAY_NGOAI_TMUX: '1', ...env };
  for (const k of Object.keys(ENV)) if (ENV[k] === undefined) delete ENV[k];
  const run = () => spawnSync('/bin/bash', [SCRIPT], { encoding: 'utf8', env: ENV });
  // Chạy trong NHÓM TIẾN TRÌNH riêng rồi gửi tín hiệu cho cả nhóm (giống ssh đứt / Ctrl-C) sau `sauMs`.
  const runSignal = (sig, sauMs) => new Promise((res) => {
    const p = spawn('/bin/bash', [SCRIPT], { env: ENV, detached: true });
    let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
    // Gửi đúng lúc docker stop container cũ đang chạy (stub ghi cờ `slept`), cộng thêm `sauMs`.
    const tm = setInterval(() => {
      try { if (JSON.parse(readFileSync(st, 'utf8')).slept) { clearInterval(tm); setTimeout(() => { try { process.kill(-p.pid, sig); } catch {} }, sauMs); } } catch {}
    }, 50);
    const giet = setTimeout(() => { try { process.kill(-p.pid, 'SIGKILL'); } catch {} }, 30000);
    p.on('close', (code, signal) => { clearInterval(tm); clearTimeout(giet); res({ code, signal, out }); });
  });
  const log = () => (existsSync(dlog) ? readFileSync(dlog, 'utf8') : '');
  const state = () => JSON.parse(readFileSync(st, 'utf8'));
  const boxes = () => (existsSync(join(dir, 'thung-rac')) ? readdirSync(join(dir, 'thung-rac')) : []);
  return { dir, srv, run, runSignal, log, state, boxes };
}
const daDung = (log) => /^(stop|run -d|rename|update|start) /m.test(log);
const all = (r) => r.stdout + r.stderr;

test('mount: chạy khô → chỉ đo + adapt + validate, KHÔNG dừng/đổi tên/dựng gì, in CHƯA LÀM', () => {
  const t = setup({ env: { DRY_RUN: '1' } });
  const r = t.run();
  assert.equal(r.status, 0, all(r));
  assert.match(r.stdout, /CHẠY KHÔ — CHƯA LÀM/);
  assert.match(t.log(), /run --rm --network none -v .*:\/etc\/caddy:ro sha256:0c99\S+ caddy validate/);
  assert.equal(daDung(t.log()), false, t.log());
  assert.deepEqual(t.boxes(), []);
});

test('mount: chạy thật đúng → giữ cũ (đổi tên, restart=no), dựng mới gắn THƯ MỤC chỉ đọc, ghim ảnh, cất bằng chứng', () => {
  const t = setup();
  const r = t.run();
  assert.equal(r.status, 0, all(r));
  const log = t.log();
  assert.match(log, /^stop -t 15 vip-staging-caddy$/m);
  assert.match(log, /^rename vip-staging-caddy vip-staging-caddy-cu-\d{8}-\d{6}$/m);
  assert.match(log, /^update --restart=no vip-staging-caddy-cu-/m);
  const runLine = log.split('\n').find((l) => l.startsWith('run -d'));
  for (const p of ['--name vip-staging-caddy', '--network host', '--restart unless-stopped', '-v vip-staging-caddy-config:/config',
    '-v vip-staging-caddy-data:/data', `-v ${t.srv}:/etc/caddy:ro`, `${IMG} caddy run --config /etc/caddy/Caddyfile --adapter caddyfile`]) {
    assert.ok(runLine.includes(p), `thiếu "${p}" trong: ${runLine}`);
  }
  assert.ok(!runLine.includes('/Caddyfile:/etc/caddy'), 'không được gắn theo tệp nữa');
  assert.ok(log.indexOf('caddy validate') < log.indexOf('stop '), 'validate phải trước khi dừng');
  assert.doesNotMatch(log, /^rm /m);
  const s = t.state();
  assert.equal(s.c['vip-staging-caddy'].role, 'new'); assert.equal(s.c['vip-staging-caddy'].running, true);
  const cu = Object.keys(s.c).find((k) => k.includes('-cu-')); assert.equal(s.c[cu].running, false);
  const [box] = t.boxes();
  assert.deepEqual(readdirSync(join(t.dir, 'thung-rac', box)).sort(), ['LY-DO.txt', 'inspect-container-cu.json', 'ma-sau.txt', 'ma-truoc.txt', 'nhat-ky.txt']);
  const truoc = readFileSync(join(t.dir, 'thung-rac', box, 'ma-truoc.txt'), 'utf8');
  assert.match(truoc, /^hub\.staging\.vipgroup\.com\.vn 200$/m);
  assert.match(truoc, /^vipgroup\.com\.vn 200$/m);
  assert.doesNotMatch(truoc, /\*|http:/);
});

test('mount: IpcMode "private" (mặc định Docker, đo 26/10) hoặc rỗng → không bị coi là lệch', () => {
  for (const ipcMode of ['private', '']) {
    const t = setup({ ipcMode, env: { DRY_RUN: '1' } });
    const r = t.run();
    assert.equal(r.status, 0, ipcMode + '\n' + all(r));
  }
});

test('mount: đã gắn thư mục từ trước → mã 0, không làm gì', () => {
  const t = setup({ mountMode: 'dir' });
  const r = t.run();
  assert.equal(r.status, 0); assert.match(r.stdout, /ĐÃ VÁ từ trước/); assert.equal(daDung(t.log()), false);
});

for (const [ten, o] of [
  ['ảnh khác', { image: 'sha256:deadbeef' }], ['thêm biến môi trường', { extraEnv: true }],
  ['XDG_DATA_HOME khác (mất chứng chỉ)', { dataHome: '/khac' }], ['ulimit không mặc định', { nonDefault: 'Ulimits' }],
  ['ổ dữ liệu khác tên', { volName: 'caddy-config-khac' }], ['IpcMode host', { ipcMode: 'host' }], ['IpcMode shareable', { ipcMode: 'shareable' }], ['container đang dừng', { running: false }], ['không có container', { noContainer: true }],
]) {
  test(`mount: cấu hình lệch — ${ten} → mã 3, không đụng gì`, () => {
    const t = setup(o);
    const r = t.run();
    assert.equal(r.status, 3, all(r)); assert.equal(daDung(t.log()), false);
  });
}

test('mount: cấu hình ĐANG CHẠY khác tệp máy chủ → mã 4, không đụng gì (không có lối "cho phép áp")', () => {
  const t = setup({ runningJson: '{"apps":{"http":{"x":2}}}', env: { ALLOW_CONFIG_CHANGE: '1' } });
  const r = t.run();
  assert.equal(r.status, 4, all(r)); assert.equal(daDung(t.log()), false);
});

test('mount: validate hỏng → mã 5, không dừng container', () => {
  const t = setup({ validateOk: false });
  assert.equal(t.run().status, 5); assert.equal(daDung(t.log()), false);
});

test('mount: trước khi làm không site nào trả lời → mã 3 (phép so vô nghĩa), không đụng gì', () => {
  const t = setup({ allDown: true });
  assert.equal(t.run().status, 3); assert.equal(daDung(t.log()), false);
});

for (const [ten, o] of [
  ['docker run hỏng', { runFails: true }],
  ['cổng quản trị không lên', { adminDown: true }],
  ['mã trả về site đổi sau khi dựng', { codesChange: true }],
  ['container mới vẫn đọc tệp cũ (inode lệch)', { newMount: 'file' }],
]) {
  test(`mount: ${ten} → dừng mới, cất mới (restart=no), trả cũ về tên cũ, bật, nạp /tmp, đo lại khớp → mã 6`, () => {
    const t = setup(o);
    const r = t.run();
    assert.equal(r.status, 6, all(r));
    assert.match(all(r), /TRẢ VỀ container cũ/);
    const s = t.state();
    assert.equal(s.c['vip-staging-caddy'].role, 'old'); assert.equal(s.c['vip-staging-caddy'].running, true);
    assert.equal(Object.values(s.c).filter((c) => c.running).length, 1, 'chỉ đúng MỘT Caddy chạy');
    const log = t.log();
    if (!o.runFails) {
      assert.match(log, /^rename vip-staging-caddy vip-staging-caddy-moi-hong-\d{8}-\d{6}$/m);
      assert.match(log, /^update --restart=no vip-staging-caddy-moi-hong-/m);
    }
    assert.match(log, /^rename vip-staging-caddy-cu-\d{8}-\d{6} vip-staging-caddy$/m);
    assert.match(log, /^update --restart=unless-stopped vip-staging-caddy$/m);
    assert.match(log, /^exec vip-staging-caddy caddy reload --config \/tmp\/Caddyfile\.host/m);
    assert.doesNotMatch(log, /^rm /m);
  });
}

test('mount: container mới KHÔNG dừng được khi trả về → mã 7, KHÔNG bật cũ (tránh hai Caddy giành cổng)', () => {
  const t = setup({ codesChange: true, newStopFails: true });
  const r = t.run();
  assert.equal(r.status, 7, all(r));
  assert.doesNotMatch(t.log(), /^start /m);
  assert.equal(Object.values(t.state().c).filter((c) => c.running).length, 1);
});

test('mount: trả về xong mà đo lại vẫn khác lúc trước → mã 7 (không báo "đã trả về" giả)', () => {
  const t = setup({ codesChange: true, codesAfterRollback: true });
  const r = t.run();
  assert.equal(r.status, 7, all(r));
  assert.match(all(r), /mã site KHÁC lúc trước/);
});

test('mount: lệnh hỏng giữa chừng (đổi tên cũ hỏng sau khi dừng) → bẫy ERR trả về: bật lại cũ, mã 6', () => {
  const t = setup({ renameFails: true });
  const r = t.run();
  assert.equal(r.status, 6, all(r));
  assert.match(all(r), /lệnh hỏng giữa chừng/);
  const s = t.state();
  assert.equal(s.c['vip-staging-caddy'].role, 'old'); assert.equal(s.c['vip-staging-caddy'].running, true);
});

test('mount: trả về nhưng container cũ bật lên mà cổng 2019 không lên → mã 7', () => {
  const t = setup({ codesChange: true, oldAdminDown: true });
  const r = t.run();
  assert.equal(r.status, 7, all(r));
  assert.match(all(r), /cổng 2019 không lên/);
  assert.doesNotMatch(t.log(), /caddy reload/);
});

test('mount: chạy thật ngoài tmux/screen → mã 2, không đụng gì; chạy khô thì được', () => {
  const t = setup({ env: { CHAY_NGOAI_TMUX: undefined } });
  const r = t.run();
  assert.equal(r.status, 2, all(r)); assert.match(all(r), /tmux/); assert.equal(daDung(t.log()), false);
  const t2 = setup({ env: { CHAY_NGOAI_TMUX: undefined, DRY_RUN: '1' } });
  assert.equal(t2.run().status, 0);
  const t3 = setup({ env: { CHAY_NGOAI_TMUX: undefined, TMUX: '/tmp/tmux-0/default,1,0' } });
  assert.equal(t3.run().status, 0);
});

for (const sig of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
  test(`mount: ${sig} gửi cho cả nhóm tiến trình lúc đang dừng container cũ → script KHÔNG chết bỏ dở: kết thúc 0 hoặc trả về (6), đúng MỘT Caddy chạy`, async () => {
    const t = setup({ slowStop: 1500 });
    const r = await t.runSignal(sig, 300);
    assert.ok(r.signal === null && [0, 6].includes(r.code), `code=${r.code} signal=${r.signal}\n${r.out}`);
    const s = t.state();
    assert.equal(Object.values(s.c).filter((c) => c.running).length, 1, JSON.stringify(s));
    assert.ok(s.c['vip-staging-caddy'] && s.c['vip-staging-caddy'].running, 'tên vip-staging-caddy phải đang chạy');
    if (sig !== 'SIGHUP') assert.equal(r.code, 6, r.out);
  });
}

test('mount: không phải root → mã 2', () => {
  const t = setup({ uid: '1000' });
  assert.equal(t.run().status, 2); assert.equal(t.log(), '');
});

test('mount: phần lệnh không xoá file/container, không tắt tiến trình theo mẫu', () => {
  const lenh = readFileSync(SCRIPT, 'utf8').split('\n').filter((l) => !/^\s*#/.test(l) && !/^\s*docker stop \$C && docker rename/.test(l) && !/^Xoá hẳn container cũ/.test(l)).join('\n');
  assert.doesNotMatch(lenh, /docker rm |(^|[\s;&|])rm\s+-/m);
  assert.doesNotMatch(lenh, new RegExp('\\b(p' + 'kill|kill' + 'all)\\b'));
});
