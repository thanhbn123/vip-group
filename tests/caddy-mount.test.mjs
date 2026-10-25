// V-13417 — chạy THẬT script đổi mount Caddy dưới /bin/bash với docker/curl/stat giả lập CÓ TRẠNG THÁI.
// Không cần máy chủ, Docker hay mạng. Mỗi cửa chặn và mỗi đường "trả về container cũ" có ca thử riêng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'ops', 'caddy-dung-chung', 'doi-mount-thu-muc-root.sh');
const IMG = 'sha256:0c994536bddb66445885237f1a5dcc1916bccea922661c76b4e9fc24061f9b52';
const CADDY = 'hub.staging.vipgroup.com.vn {\n\treverse_proxy 127.0.0.1:19000\n}\nvipgroup.com.vn, http://vipgroup.com.vn {\n\tredir https://www.vipgroup.com.vn{uri} permanent\n}\n*.vipgroup.com.vn {\n\trespond "x"\n}\n';

function setup(o = {}) {
  const {
    uid = '0', image = IMG, extraEnv = false, mountMode = 'file', hashSame = true,
    validateOk = true, runOk = true, adminUp = true, codesChange = false, newMountMode = 'dir', env = {},
  } = o;
  const dir = mkdtempSync(join(tmpdir(), 'vipg-mount-'));
  const bin = join(dir, 'bin'); mkdirSync(bin);
  const srv = join(dir, 'srv'); mkdirSync(srv);
  const st = join(dir, 'st'); mkdirSync(st);
  writeFileSync(join(srv, 'Caddyfile'), CADDY);
  writeFileSync(join(st, 'phase'), 'truoc');
  writeFileSync(join(st, 'mount'), mountMode);
  const s = (name, body) => { const f = join(bin, name); writeFileSync(f, `#!/bin/bash\n${body}\n`); chmodSync(f, 0o755); };
  s('id', `echo ${uid}`);
  s('stat', 'echo 528439');
  s('sha256sum', 'if command -v shasum >/dev/null; then exec shasum -a 256 "$@"; else exec /usr/bin/sha256sum "$@"; fi');
  const MOUNT_FILE = `bind::${srv}/Caddyfile:/etc/caddy/Caddyfile:false`;
  const MOUNT_DIR = `bind::${srv}:/etc/caddy:false`;
  s('docker', `
ST="${st}"; echo "$*" >> "${dir}/docker.log"
case "$1" in
  inspect)
    case "$*" in
      *.Mounts*) m=$(cat "$ST/mount"); [ "$m" = dir ] && echo "${MOUNT_DIR}" || echo "${MOUNT_FILE}"
        echo "volume:vip-staging-caddy-config:/var/lib/docker/volumes/vip-staging-caddy-config/_data:/config:true"
        echo "volume:vip-staging-caddy-data:/var/lib/docker/volumes/vip-staging-caddy-data/_data:/data:true";;
      *.Config.Env*) printf 'PATH=/x\\nCADDY_VERSION=v2.11.4\\nXDG_CONFIG_HOME=/config\\nXDG_DATA_HOME=/data\\n'; ${extraEnv ? "echo 'SECRET_X=1'" : 'true'};;
      *.Image*) echo '${image}|host|unless-stopped|["caddy","run","--config","/etc/caddy/Caddyfile","--adapter","caddyfile"]|null||null|false|json-file';;
      *) echo '{"Name":"cu"}';;
    esac;;
  exec)
    case "$*" in
      *sha256sum*) ${hashSame ? `sha256sum "${srv}/Caddyfile"` : "echo 'ffff  /tmp/Caddyfile.host'"};;
      *"stat -c"*) [ "$(cat "$ST/mount")" = dir ] && echo 528439 || echo 528434;;
      *cat*) cat "${srv}/Caddyfile";;
      *) exit 0;;
    esac;;
  run)
    case "$*" in
      *--rm*) ${validateOk ? 'exit 0' : 'exit 1'};;
      *-d*) ${runOk ? `echo truoc-sau > /dev/null; echo sau > "$ST/phase"; echo ${newMountMode} > "$ST/mount"; echo newid` : 'exit 1'};;
    esac;;
  rename) case "$3" in *-cu-*) echo file > "$ST/mount";; vip-staging-caddy) echo file > "$ST/mount"; echo truoc > "$ST/phase";; esac; exit 0;;
  *) exit 0;;
esac`);
  s('curl', `
case "$*" in
  *2019*) ${adminUp ? 'exit 0' : 'exit 7'};;
  *) if [ "$(cat "${st}/phase")" = sau ] && ${codesChange ? 'true' : 'false'}; then printf 502; else printf 200; fi;;
esac`);
  s('sleep', 'exit 0');
  const run = () => spawnSync('/bin/bash', [SCRIPT], {
    encoding: 'utf8',
    env: { PATH: `${bin}:/usr/bin:/bin`, CADDY_DIR: srv, TRASH_ROOT: join(dir, 'thung-rac'), WAIT_TRIES: '2', CMP_TRIES: '2', ...env },
  });
  const log = () => (existsSync(join(dir, 'docker.log')) ? readFileSync(join(dir, 'docker.log'), 'utf8') : '');
  const boxes = () => (existsSync(join(dir, 'thung-rac')) ? readdirSync(join(dir, 'thung-rac')) : []);
  return { dir, srv, run, log, boxes };
}
const dungHayDung = (log) => /^(stop|run -d|rename|update) /m.test(log);

test('mount: chạy khô → chỉ đo + validate, KHÔNG dừng/đổi tên/dựng gì, in CHƯA LÀM', () => {
  const t = setup({ env: { DRY_RUN: '1' } });
  const r = t.run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /CHẠY KHÔ — CHƯA LÀM/);
  assert.match(t.log(), /run --rm --network none -v .*:\/etc\/caddy:ro sha256:0c99/);
  assert.equal(dungHayDung(t.log()), false, t.log());
  assert.deepEqual(t.boxes(), []);
});

test('mount: chạy thật đúng → giữ container cũ (đổi tên, restart=no), dựng mới gắn THƯ MỤC chỉ đọc, ghim ảnh, cất bằng chứng', () => {
  const t = setup();
  const r = t.run();
  assert.equal(r.status, 0, r.stderr);
  const log = t.log();
  assert.match(log, /^stop -t 15 vip-staging-caddy$/m);
  assert.match(log, /^rename vip-staging-caddy vip-staging-caddy-cu-\d{8}-\d{6}$/m);
  assert.match(log, /^update --restart=no vip-staging-caddy-cu-/m);
  const runLine = log.split('\n').find((l) => l.startsWith('run -d'));
  assert.ok(runLine, log);
  for (const p of ['--name vip-staging-caddy', '--network host', '--restart unless-stopped', '-v vip-staging-caddy-config:/config', '-v vip-staging-caddy-data:/data', `-v ${t.srv}:/etc/caddy:ro`, `${IMG} caddy run --config /etc/caddy/Caddyfile --adapter caddyfile`]) {
    assert.ok(runLine.includes(p), `thiếu "${p}" trong: ${runLine}`);
  }
  assert.ok(!runLine.includes('/Caddyfile:/etc/caddy/Caddyfile'), 'không được gắn theo tệp nữa');
  assert.ok(log.indexOf('run --rm') < log.indexOf('stop '), 'validate phải trước khi dừng');
  assert.doesNotMatch(log, /^rm /m, 'không xoá container nào');
  const [box] = t.boxes();
  assert.match(box, /^V-13417-doi-mount-caddy-/);
  const files = readdirSync(join(t.dir, 'thung-rac', box)).sort();
  assert.deepEqual(files, ['LY-DO.txt', 'inspect-container-cu.json', 'ma-sau.txt', 'ma-truoc.txt']);
  const truoc = readFileSync(join(t.dir, 'thung-rac', box, 'ma-truoc.txt'), 'utf8');
  assert.match(truoc, /^hub\.staging\.vipgroup\.com\.vn 200$/m);
  assert.match(truoc, /^vipgroup\.com\.vn 200$/m);
  assert.doesNotMatch(truoc, /\*|http:/, 'bỏ wildcard và địa chỉ http://');
});

test('mount: đã gắn thư mục từ trước → mã 0, không làm gì', () => {
  const t = setup({ mountMode: 'dir' });
  const r = t.run();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /ĐÃ VÁ từ trước/);
  assert.equal(dungHayDung(t.log()), false);
});

test('mount: cấu hình container khác bản đo (ảnh khác / thêm biến môi trường) → mã 3, không đụng gì', () => {
  for (const o of [{ image: 'sha256:deadbeef' }, { extraEnv: true }]) {
    const t = setup(o);
    assert.equal(t.run().status, 3, JSON.stringify(o));
    assert.equal(dungHayDung(t.log()), false);
  }
});

test('mount: tệp máy chủ KHÁC bản đang chạy → mã 4 không đụng gì; ALLOW_CONFIG_CHANGE=1 mới đi tiếp', () => {
  const t = setup({ hashSame: false });
  assert.equal(t.run().status, 4);
  assert.equal(dungHayDung(t.log()), false);
  const t2 = setup({ hashSame: false, env: { ALLOW_CONFIG_CHANGE: '1' } });
  assert.equal(t2.run().status, 0);
});

test('mount: validate hỏng → mã 5, không dừng container', () => {
  const t = setup({ validateOk: false });
  assert.equal(t.run().status, 5);
  assert.equal(dungHayDung(t.log()), false);
});

for (const [ten, o] of [
  ['docker run hỏng', { runOk: false }],
  ['cổng quản trị không lên', { adminUp: false }],
  ['mã trả về site đổi sau khi dựng', { codesChange: true }],
  ['container mới vẫn đọc tệp cũ (inode lệch)', { newMountMode: 'file' }],
]) {
  test(`mount: ${ten} → TỰ TRẢ VỀ container cũ, nạp lại tệp máy chủ qua /tmp, mã 6`, () => {
    const t = setup(o);
    const r = t.run();
    assert.equal(r.status, 6, r.stderr);
    assert.match(r.stderr, /TRẢ VỀ container cũ/);
    const log = t.log();
    assert.match(log, /^rename vip-staging-caddy-cu-\d{8}-\d{6} vip-staging-caddy$/m, log);
    assert.match(log, /^update --restart=unless-stopped vip-staging-caddy$/m);
    assert.match(log, /^start vip-staging-caddy$/m);
    assert.match(log, /^exec vip-staging-caddy caddy reload --config \/tmp\/Caddyfile\.host/m);
    assert.doesNotMatch(log, /^rm /m);
  });
}

test('mount: không phải root → mã 2', () => {
  const t = setup({ uid: '1000' });
  assert.equal(t.run().status, 2);
  assert.equal(t.log(), '');
});

test('mount: phần lệnh không xoá file/container, không tắt tiến trình theo mẫu', () => {
  const lenh = readFileSync(SCRIPT, 'utf8').split('\n').filter((l) => !/^\s*#/.test(l) && !/^\s*docker stop \$C && docker rename/.test(l)).join('\n');
  assert.doesNotMatch(lenh.replace(/Xoá hẳn container cũ.*$/m, ''), /docker rm |(^|[\s;&|])rm\s+-/m);
  assert.doesNotMatch(lenh, new RegExp('\\b(p' + 'kill|kill' + 'all)\\b'));
});
