#!/usr/bin/env node
// Bản DEMO nghiệm thu cho chủ dự án (chỉ local, chỉ dữ liệu tổng hợp). Dùng lại stack.mjs / crm.mjs / vipid.mjs của bộ E2E.
//
//   node tests/portal-e2e/demo.mjs start                  # clone CRM @CRM_SHA, tạo DB vipcrm5_demo_portal, chạy nền VIP ID + CRM + proxy, tạo K1..K4
//   node tests/portal-e2e/demo.mjs status
//   node tests/portal-e2e/demo.mjs smoke                  # đăng nhập K1 bằng HTTP, đếm kiện (không in mật khẩu)
//   node tests/portal-e2e/demo.mjs reset-link <SĐT|VGxxxx> # nhân viên cấp link đặt lại mật khẩu (thay nút CRM, tới khi CRM có)
//   node tests/portal-e2e/demo.mjs lock <VGxxxx> | unlock <VGxxxx>   # khoá / mở cổng của khách (API nhân viên CRM)
//   node tests/portal-e2e/demo.mjs stop                   # tắt đúng các tiến trình của demo, dropdb, xoá bản clone CRM
//   Mặc định §15: dangky. / dangnhap. / khachhang.vipgroup.localhost:8890; TOPO=single …start → một host khach.localhost (CRM cũ)
//
// Mật khẩu demo CHỈ ghi vào $DEMO_DIR/TAI_KHOAN_DEMO.txt (0600), không bao giờ in ra màn hình.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stackConfig, vipidEnv, crmEnv, crmScript, crmSql, waitHttp, proxyEnv, ensureCoworkSecret } from './stack.mjs';
import { raw } from './http.mjs';
import { KhachClient, account, internalPost } from './vipid.mjs';
import { RealCrm, waitFor } from './crm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH = '/private/tmp/claude-501/-Users-viporder-Projects-vip-group-com-vn/f0e353b3-67b8-4871-acf6-2392a2d2f35f/scratchpad';
const DEMO_DIR = path.resolve(process.env.DEMO_DIR || (fs.existsSync(SCRATCH) ? path.join(SCRATCH, 'demo-data') : path.join(os.tmpdir(), 'vipgroup-portal-demo')));
const PIDS = path.join(DEMO_DIR, 'pids');
const ACC_FILE = path.join(DEMO_DIR, 'TAI_KHOAN_DEMO.txt');
const STATE = path.join(DEMO_DIR, 'state.json');
const CRM_SRC = process.env.CRM_SRC || '/Users/viporder/Projects/vip-group-khoqctq';
const CLONE = path.join(DEMO_DIR, 'crm-clone');
const VIPID_SRC = process.env.VIPID_SRC || (fs.existsSync('/Users/viporder/code/vip-group-id-cowork-crm') ? '/Users/viporder/code/vip-group-id-cowork-crm' : '/Users/viporder/code/vip-group-id-khach');
const VIPID_CLONE = path.join(DEMO_DIR, 'vipid-clone');
const DB = 'vipcrm5_demo_portal';
// Owner 07/11 (CRM d5666fc): duyệt không cần "đã gọi xác minh SĐT"; nhân viên cấp link đặt lại qua CRM.
// Fallback cho CRM cũ: verify-phone khi CRM đòi (PHONE_NOT_VERIFIED); HMAC thẳng VIP ID khi CRM chưa có route (404).
process.env.CRM_SKIP_VERIFY_PHONE ??= '1';
process.env.CRM_VERIFY_FALLBACK ??= '1';
process.env.CRM_RESET_LINK_ROUTE ??= '/api/portal/customers/:id/reset-link';
// §15: mặc định ba host dangky / dangnhap / khachhang .vipgroup.localhost (cùng một site như *.vipgroup.com.vn)
process.env.TOPO ??= 'multi';

function config() {
  const cfg = stackConfig({
    ...process.env, MODE: 'real', START: '0', CRM_REPO: CLONE, CRM_DB: DB, VIPID_REPO: VIPID_CLONE,
    VIPID_DATA_DIR: path.join(DEMO_DIR, 'vipid-data'), VIPID_DB_PATH: path.join(DEMO_DIR, 'vipid.db'),
    VIPID_PORTAL_SECRET_FILE: path.join(DEMO_DIR, 'vipid-data', 'portal_secret.key'),
  });
  cfg.runDir = DEMO_DIR; // crmEnv: STORAGE_DIR/BACKUP_DIR trong thư mục demo
  return cfg;
}

/** Env VIP ID cho demo: realm khách bật, KHÔNG Turnstile, KHÔNG email (outbox tắt). */
function demoVipidEnv(cfg) {
  const e = vipidEnv(cfg, { COWORK_KHACH_EMAIL_ENABLED: '0' });
  for (const k of Object.keys(e)) if (k.startsWith('COWORK_KHACH_TURNSTILE')) delete e[k];
  e.COWORK_KHACH_TURNSTILE_SECRET_FILE = path.join(cfg.dataDir, 'khong-co-turnstile.key');
  return e;
}

const readPids = () => { try { return JSON.parse(fs.readFileSync(PIDS, 'utf8')); } catch { return {}; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const cmdOf = (pid) => (spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).stdout || '').trim();
const EXPECT = { vipid: 'uvicorn cowork.main:app', crm: 'server/index.js', proxy: 'portal-e2e/proxy.mjs' };

function bg(name, cmd, args, opts) {
  fs.mkdirSync(path.join(DEMO_DIR, 'logs'), { recursive: true });
  const fd = fs.openSync(path.join(DEMO_DIR, 'logs', `${name}.log`), 'a');
  const p = spawn(cmd, args, { ...opts, detached: true, stdio: ['ignore', fd, fd] });
  p.unref();
  fs.closeSync(fd);
  return p.pid;
}

function strongPassword() {
  // ≥ 20 ký tự, đủ chữ thường/hoa/số/ký tự đặc biệt
  return `Vg-${crypto.randomBytes(12).toString('base64url')}-${crypto.randomInt(10, 99)}aZ!`;
}

async function portalFree(ports) {
  for (const p of ports) {
    const r = spawnSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    if ((r.stdout || '').trim()) throw new Error(`Cổng ${p} đang bận — chạy "demo.mjs stop" hoặc tắt tiến trình đang dùng.`);
  }
}

async function start() {
  if (Object.values(readPids()).some(alive)) throw new Error('Demo đang chạy (xem "demo.mjs status"); chạy "demo.mjs stop" trước.');
  const sha = process.env.CRM_SHA || spawnSync('git', ['-C', CRM_SRC, 'rev-parse', 'main'], { encoding: 'utf8' }).stdout.trim();
  if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error(`Không xác định được CRM_SHA (${sha})`);
  fs.rmSync(DEMO_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(DEMO_DIR, 'logs'), { recursive: true, mode: 0o700 });
  fs.chmodSync(DEMO_DIR, 0o700);
  const cfg = config();
  await portalFree([cfg.PROXY_PORT, cfg.VIPID_PORT, cfg.CRM_PORT]);

  // 1) CRM: clone chỉ-đọc từ repo gốc tại đúng SHA (không chạm repo gốc), dùng chung node_modules (chỉ đọc)
  console.log(`• Clone CRM @ ${sha.slice(0, 7)} …`);
  let r = spawnSync('git', ['clone', '-q', '--no-hardlinks', CRM_SRC, CLONE], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git clone: ${r.stderr}`);
  r = spawnSync('git', ['-C', CLONE, 'checkout', '-q', sha], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git checkout ${sha}: ${r.stderr}`);
  fs.symlinkSync(path.join(CRM_SRC, 'node_modules'), path.join(CLONE, 'node_modules'));
  fs.appendFileSync(path.join(CLONE, '.git/info/exclude'), 'node_modules\n');
  // VIP ID: clone tại VIPID_SHA (mặc định HEAD đã commit của worktree — không chạy thay đổi chưa commit đang làm dở)
  const vipFull = process.env.VIPID_SHA || spawnSync('git', ['-C', VIPID_SRC, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  console.log(`• Clone VIP ID @ ${vipFull.slice(0, 7)} …`);
  r = spawnSync('git', ['clone', '-q', '--no-hardlinks', VIPID_SRC, VIPID_CLONE], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git clone VIP ID: ${r.stderr}`);
  r = spawnSync('git', ['-C', VIPID_CLONE, 'checkout', '-q', vipFull], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git checkout VIP ID ${vipFull}: ${r.stderr}`);
  const vipSha = vipFull.slice(0, 7);

  // 2) DB CRM tổng hợp
  console.log(`• Tạo DB ${DB}, migrate + seed …`);
  spawnSync('dropdb', ['--if-exists', DB]);
  r = spawnSync('createdb', [DB], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`createdb: ${r.stderr}`);
  for (const s of [['scripts/migrate.js'], ['scripts/seed-if-empty.js']]) {
    const x = crmScript(cfg, s);
    fs.appendFileSync(path.join(DEMO_DIR, 'logs', 'crm-setup.log'), `$ ${s.join(' ')}\n${x.out}${x.err}\n`);
    if (x.code !== 0) throw new Error(`${s[0]}: ${x.err.slice(0, 300)}`);
  }

  // 3) VIP ID (worktree HEAD, dữ liệu riêng), CRM, proxy — chạy nền
  fs.mkdirSync(cfg.dataDir, { recursive: true, mode: 0o700 });
  r = spawnSync(cfg.PY, ['-c', 'from cowork import khach; khach.portal_secret()'], { cwd: cfg.VIPID_REPO, env: demoVipidEnv(cfg), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`portal secret: ${r.stderr}`);
  ensureCoworkSecret(cfg); // COWORK → CRM (cowork-launch/1): VIP ID đọc tệp, CRM nhận COWORK_SHARED_SECRET
  const pids = {};
  pids.crm = bg('crm', process.execPath, ['server/index.js'], { cwd: CLONE, env: crmEnv(cfg) });
  pids.vipid = bg('vipid', cfg.PY, ['-m', 'uvicorn', 'cowork.main:app', '--host', '127.0.0.1', '--port', String(cfg.VIPID_PORT), '--no-access-log', '--no-proxy-headers'],
    { cwd: cfg.VIPID_REPO, env: demoVipidEnv(cfg) });
  pids.proxy = bg('proxy', process.execPath, [path.join(HERE, 'proxy.mjs')], {
    cwd: HERE, env: proxyEnv(cfg),
  });
  fs.writeFileSync(PIDS, JSON.stringify(pids, null, 1), { mode: 0o600 });
  await Promise.all([waitHttp(cfg.CRM_PORT), waitHttp(cfg.VIPID_PORT), waitHttp(cfg.PROXY_PORT)]);
  const ready = await waitFor(async () => (await raw({ port: cfg.PROXY_PORT, path: '/tai-khoan/dang-nhap', hostHeader: cfg.KHACH_HOST })).status === 200, 30_000);
  if (!ready) throw new Error('VIP ID chưa sẵn sàng (xem logs/vipid.log)');

  // 4) Khách tổng hợp qua ĐÚNG luồng thật: đăng ký VIP ID → signup sang CRM → nhân viên duyệt/liên kết qua API CRM
  const crm = new RealCrm(cfg, null);
  const P = {
    K1: { name: 'Nguyễn Văn Demo Một', phone: '0900000011', email: 'k1.demo@example.test', pw: strongPassword() },
    K2: { name: 'Trần Thị Demo Hai', phone: '0900000012', email: '', pw: strongPassword() },
    K3: { name: 'Lê Văn Đại Lý Ba', phone: '0900000003', email: 'k3.demo@example.test', pw: strongPassword() },
    K4: { name: 'Phạm Thị Chờ Duyệt', phone: '0900000014', email: '', pw: strongPassword() },
  };
  const reg = async (key) => {
    const u = P[key];
    const res = await new KhachClient(cfg).register({ name: u.name, phone: u.phone, email: u.email, password: u.pw });
    if (res.status !== 303 || res.headers.location !== '/tai-khoan/cho-duyet') throw new Error(`đăng ký ${key} → ${res.status}`);
    u.subject = account(cfg, 'phone_e164=?', ['+84' + u.phone.slice(1)])[0].subject;
    if (!(await waitFor(async () => !!(await crm.findSignup(u.subject)), 20_000))) throw new Error(`CRM chưa nhận signup ${key}`);
  };
  console.log('• Tạo khách demo K1, K2 (duyệt), K3 (đại lý A1, liên kết), K4 (chờ duyệt) …');
  for (const k of ['K1', 'K2']) {
    await reg(k);
    const a = await crm.approve({ subject: P[k].subject });
    if (!a.ok) throw new Error(`duyệt ${k}: ${a.out}`);
    P[k].code = a.portalCode;
  }
  const ag = crm.agentCustomer('+84900000003');
  await reg('K3');
  const ln = await crm.link({ subject: P.K3.subject, customerId: ag.customer_id });
  if (!ln.ok) throw new Error(`liên kết K3: ${ln.out}`);
  P.K3.code = ln.portalCode;
  P.K3.agentCode = ln.customer?.code;
  const seeds = { K1: crm.seedParcels(P.K1.code, 5), K2: crm.seedParcels(P.K2.code, 3), K3: crm.seedParcels(P.K3.code, 2) };
  await reg('K4');

  // 5) Tệp tài khoản (0600) — mật khẩu chỉ nằm ở đây
  const admPw = crm.password();
  const lines = [
    'TÀI KHOẢN DEMO CỔNG KHÁCH HÀNG VIP GROUP — DỮ LIỆU TỔNG HỢP, CHỈ DÙNG TRÊN MÁY NÀY',
    `Tạo lúc: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · VIP ID ${vipSha} · CRM ${sha.slice(0, 7)}`,
    'KHÔNG chia sẻ tệp này. Xoá khi chạy "demo.mjs stop".',
    '',
    `Cổng khách: http://${cfg.H.dangnhap}/tai-khoan/dang-nhap   (đăng ký: http://${cfg.H.dangky}/tai-khoan/dang-ky)`,
    '',
    ...['K1', 'K2', 'K3'].map((k) => {
      const u = P[k];
      return [`[${k}] ${u.name}${k === 'K3' ? ` — khách đại lý A1, mã nội bộ ${P.K3.agentCode}` : ''}`,
        `  Đăng nhập: SĐT ${u.phone}  hoặc  mã khách ${u.code}`,
        `  Mật khẩu : ${u.pw}`,
        `  Kiện mẫu : ${seeds[k].created.map((x) => x.tracking_no).join(', ')}`,
        `  (kiện ${seeds[k].pending_unowned} chưa rõ chủ — KHÔNG được hiện với ai)`, ''].join('\n');
    }),
    `[K4] ${P.K4.name} — SĐT ${P.K4.phone}: đã đăng ký, ĐANG CHỜ DUYỆT (để thử duyệt ở CRM). Mật khẩu: ${P.K4.pw}`,
    '',
    `[Nhân viên CRM] http://127.0.0.1:${cfg.CRM_PORT}/  →  menu "Đăng ký khách (cổng)"`,
    `  Tài khoản: vip.admin   Mật khẩu (mật khẩu dev của seed CRM): ${admPw}`,
    '',
  ];
  fs.writeFileSync(ACC_FILE, lines.join('\n'), { mode: 0o600 });
  fs.chmodSync(ACC_FILE, 0o600);
  fs.writeFileSync(STATE, JSON.stringify({ crmSha: sha, vipidSha: vipSha, codes: Object.fromEntries(['K1', 'K2', 'K3'].map((k) => [k, P[k].code])), k1Phone: P.K1.phone }, null, 1), { mode: 0o600 });

  console.log(`
Demo đã chạy nền (VIP ID ${vipSha} · CRM ${sha.slice(0, 7)} · DB ${DB} · sơ đồ host ${cfg.TOPO}).
  Cổng khách — đăng nhập : http://${cfg.H.dangnhap}/tai-khoan/dang-nhap
  Cổng khách — đăng ký   : http://${cfg.H.dangky}/tai-khoan/dang-ky${cfg.TOPO === 'multi' ? `\n  Cổng khách — kiện hàng : http://${cfg.H.portal}/portal/` : ''}
  CRM nhân viên          : http://127.0.0.1:${cfg.CRM_PORT}/   (menu "Đăng ký khách (cổng)")
  Khách demo             : K1 ${P.K1.code} (5 kiện) · K2 ${P.K2.code} (3 kiện) · K3 ${P.K3.code} (đại lý A1, ${P.K3.agentCode}) · K4 chờ duyệt
  Tài khoản + mật khẩu   : ${ACC_FILE}  (chỉ chủ máy đọc được, 0600)
  Tắt demo               : node tests/portal-e2e/demo.mjs stop`);
}

async function status() {
  const pids = readPids();
  if (!Object.keys(pids).length) { console.log('Demo không chạy.'); return 1; }
  const cfg = config();
  let ok = true;
  for (const [k, pid] of Object.entries(pids)) {
    const up = alive(pid) && cmdOf(pid).includes(EXPECT[k]);
    ok &&= up;
    console.log(`  ${k.padEnd(6)} pid ${pid}: ${up ? 'đang chạy' : 'KHÔNG chạy'}`);
  }
  for (const [label, port, p, host] of [['VIP ID (qua proxy)', cfg.PROXY_PORT, '/tai-khoan/dang-nhap', cfg.KHACH_HOST], ['CRM nhân viên', cfg.CRM_PORT, '/api/health', `127.0.0.1:${cfg.CRM_PORT}`]]) {
    const r = await raw({ port, path: p, hostHeader: host }).catch(() => ({ status: 0 }));
    ok &&= r.status === 200;
    console.log(`  ${label}: HTTP ${r.status}`);
  }
  try { const s = JSON.parse(fs.readFileSync(STATE, 'utf8')); console.log(`  VIP ID ${s.vipidSha} · CRM ${s.crmSha.slice(0, 7)} · mã ${Object.entries(s.codes).map(([k, v]) => `${k}=${v}`).join(' ')}`); } catch { /* chưa có */ }
  console.log(`  Tài khoản: ${ACC_FILE}`);
  return ok ? 0 : 1;
}

function accountsFromFile() {
  const txt = fs.readFileSync(ACC_FILE, 'utf8');
  const m = /\[K1\][^\n]*\n\s*Đăng nhập: SĐT (\S+)[^\n]*\n\s*Mật khẩu : (\S+)/.exec(txt);
  return { phone: m[1], pw: m[2] };
}

async function smoke() {
  const cfg = config();
  const k1 = accountsFromFile();
  const c = new KhachClient(cfg);
  const lr = await c.login(k1.phone, k1.pw);
  if (lr.status !== 303 || !/\/portal\/auth\/launch/.test(lr.headers.location || '')) throw new Error(`đăng nhập K1 → ${lr.status}`);
  const loc = new URL(lr.headers.location, `http://${cfg.H.portal}`);
  await c.req('GET', loc.pathname + loc.search);
  const me = JSON.parse((await c.req('GET', '/portal/api/me')).body);
  const pr = await c.req('GET', '/portal/api/parcels');
  const items = JSON.parse(pr.body).items || [];
  const s = await c.req('GET', '/portal/api/parcels/search?tracking=' + encodeURIComponent(`E2E-${me.portal_code}-001`));
  console.log(`smoke: K1 đăng nhập OK (mã ${me.portal_code}), /portal/api/parcels ${pr.status} → ${items.length} kiện, tra cứu E2E-${me.portal_code}-001 → ${s.status}`);
  return pr.status === 200 && items.length === 5 && s.status === 200 ? 0 : 1;
}

async function resetLink(ident) {
  const cfg = config();
  const raw_ = String(ident || '').trim();
  const phone = /^0\d{9}$/.test(raw_) ? '+84' + raw_.slice(1) : raw_;
  const acc = account(cfg, 'phone_e164=? OR portal_code=?', [phone, raw_.toUpperCase()])[0];
  if (!acc) throw new Error('Không có khách với SĐT / mã này');
  const crm = new RealCrm(cfg, null);
  let r = await crm.resetLink(acc.subject, { reason: 'Demo: khách gọi hotline, nhân viên đã xác nhận danh tính' });
  // CRM chưa có route (404) hoặc bản d5666fc đọc sai thân phản hồi VIP ID (502 VIPID_UNAVAILABLE) → gọi thẳng VIP ID
  // eab8425: CRM đòi url https — demo local là http ⇒ 502 VIPID_BAD_RESPONSE (VIP ID đã cấp link) → cũng gọi thẳng
  if ((r.status === 404 && r.code !== 'NOT_FOUND_CUSTOMER') || (r.status === 502 && /^VIPID_(UNAVAILABLE|BAD_RESPONSE)$/.test(r.code || ''))) {
    // CRM chưa có route nhân viên → ký HMAC như CRM, gọi thẳng VIP ID
    const x = await internalPost(cfg, '/api/internal/khach/tao-link-dat-lai', { subject: acc.subject, requested_by: 'demo-nhan-vien', n: crypto.randomUUID() });
    r = { ok: x.status === 200, status: x.status, url: x.json?.data?.url, expires_at: x.json?.data?.expires_at, via: `HMAC thẳng VIP ID (CRM trả ${r.status} ${r.code || ''})`, code: x.json?.loi?.ma };
  }
  if (!r.ok) throw new Error(`cấp link → ${r.status} ${r.code || ''}`);
  console.log(`Link đặt lại mật khẩu (${r.via}; dùng 1 lần, hết hạn ${r.expires_at}) — gửi cho khách qua Zalo:\n${r.url}`);
}

async function lock(code, action) {
  const cfg = config();
  const id = crmSql(cfg, `SELECT id FROM customers WHERE portal_code='${String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')}'`)[0];
  if (!id) throw new Error('Không có khách cổng với mã này');
  const crm = new RealCrm(cfg, null);
  await crm.login();
  const r = await crm.api('POST', `/api/portal/customers/${id}/lock`, { action, reason: 'Demo nghiệm thu: ' + (action === 'khoa' ? 'khoá cổng' : 'mở cổng') });
  console.log(`${action === 'khoa' ? 'Khoá' : 'Mở'} cổng ${code}: HTTP ${r.status}${r.json?.error ? ' ' + r.json.error.code : ''}`);
}

async function stop() {
  const pids = readPids();
  for (const [k, pid] of Object.entries(pids)) {
    if (!alive(pid)) continue;
    if (!cmdOf(pid).includes(EXPECT[k])) { console.log(`  bỏ qua pid ${pid} (${k}): không phải tiến trình của demo`); continue; }
    try { process.kill(pid, 'SIGTERM'); } catch { /* đã thoát */ }
    await waitFor(() => !alive(pid), 5000, 100);
    if (alive(pid)) try { process.kill(pid, 'SIGKILL'); } catch { /* đã thoát */ }
    console.log(`  đã tắt ${k} (pid ${pid})`);
  }
  const d = spawnSync('dropdb', ['--if-exists', DB], { encoding: 'utf8' });
  console.log(`  dropdb ${DB}: ${d.status === 0 ? 'OK' : d.stderr.trim()}`);
  fs.rmSync(DEMO_DIR, { recursive: true, force: true });
  console.log(`  đã xoá ${DEMO_DIR} (bản clone CRM + VIP ID, dữ liệu VIP ID, tệp tài khoản, log)`);
}

const [cmd, arg] = process.argv.slice(2);
const run = { start, stop, status, smoke, 'reset-link': () => resetLink(arg), lock: () => lock(arg, 'khoa'), unlock: () => lock(arg, 'mo_khoa') }[cmd];
if (!run) { console.log('Dùng: demo.mjs start | status | smoke | reset-link <SĐT|VG…> | lock <VG…> | unlock <VG…> | stop'); process.exit(2); }
try {
  const code = await run();
  process.exit(typeof code === 'number' ? code : 0);
} catch (e) {
  console.error(`Lỗi: ${e.message}`);
  if (cmd === 'start' && !/Demo đang chạy|Cổng \d+ đang bận/.test(e.message)) {
    const logs = path.join(DEMO_DIR, 'logs');
    for (const f of fs.existsSync(logs) ? fs.readdirSync(logs) : []) console.error(`--- ${f} (cuối)\n` + fs.readFileSync(path.join(logs, f), 'utf8').split('\n').slice(-8).join('\n'));
    console.error('Đang dọn (stop) …');
    await stop();
  }
  process.exit(1);
}
