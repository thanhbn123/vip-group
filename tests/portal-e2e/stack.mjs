// Quản lý stack local cho bộ E2E cổng khách (chỉ dữ liệu tổng hợp, chỉ 127.0.0.1).
//
// MODE=mock + START=1 (mặc định): bộ test TỰ khởi động một stack CÔ LẬP:
//   - VIP ID realm khách (uvicorn, repo VIPID_REPO, cổng VIPID_PORT=8898) với COWORK_DATA_DIR/DB riêng trong thư mục tạm
//     (không đụng data/khach-dev.db của repo VIP ID; repo VIP ID không bị sửa — chỉ chạy mã của nó);
//   - CRM giả của VIP ID (scripts/khach_mock_crm.py, cổng CRM_PORT=8897), stderr ghi vào tệp log để đọc các lệnh signup/thu-hồi;
//   - proxy dev same-origin (proxy.mjs, cổng PROXY_PORT=8890).
// Env cấu hình y như `scripts/khach-dev.sh --mock-crm` + lệnh owner đưa (COWORK_KHACH_HOSTS, COWORK_TIN_PROXY=1, …),
// khác duy nhất: DATA_DIR riêng và COWORK_KHACH_SIGNUP_IP_PER_HOUR nâng lên (bộ test tạo > 5 đăng ký từ cùng IP 127.0.0.1).
//
// START=0: dùng stack đang chạy sẵn (vd do người chạy tự bật khach-dev.sh + proxy); khi đó CLI helper (khach-outbox,
// khach-duyet-dev, khach-dong-bo) dùng VIPID_DATA_DIR/VIPID_DB_PATH (mặc định data/khach-dev của repo VIP ID) và
// các kiểm "CRM sập" bị PENDING (không tự tắt/bật được CRM của người khác).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { raw } from './http.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function stackConfig(env = process.env) {
  const VIPID_REPO = env.VIPID_REPO || '/Users/viporder/code/vip-group-id-khach';
  const PY = env.PY || '/Users/viporder/code/vip-group-id/.venv/bin/python';
  const PROXY_PORT = Number(env.PROXY_PORT || 8890);
  const VIPID_PORT = Number(env.VIPID_PORT || 8898);
  const MODE = String(env.MODE || 'mock').toLowerCase();
  const CRM_PORT = Number(env.CRM_PORT || (MODE === 'real' ? 5195 : 8897));
  const START = (env.START ?? '1') === '1';
  const CRM_REPO = env.CRM_REPO || '/Users/viporder/Projects/vip-group-khoqctq';
  const CRM_DB = env.CRM_DB || 'vipcrm5_e2e_portal';
  if (MODE === 'real' && !/^vipcrm5_/.test(CRM_DB)) throw new Error('CRM_DB phải có tiền tố vipcrm5_ (DB dev tổng hợp)');
  const runDir = START ? fs.mkdtempSync(path.join(os.tmpdir(), 'portal-e2e-')) : null;
  const dataDir = START ? path.join(runDir, 'vipid-data') : (env.VIPID_DATA_DIR || path.join(VIPID_REPO, 'data/khach-dev'));
  const dbPath = START ? path.join(runDir, 'vipid.db') : (env.VIPID_DB_PATH || path.join(VIPID_REPO, 'data/khach-dev.db'));
  const forbidden = [4321, 4322, 4351, 8899];
  for (const p of [PROXY_PORT, VIPID_PORT, CRM_PORT]) {
    if (forbidden.includes(p)) throw new Error(`Cổng ${p} bị cấm dùng cho bộ test`);
  }
  // §15: TOPO=multi — dangky.localhost (đăng ký) · dangnhap.localhost (đăng nhập/tài khoản + API nội bộ) · khachhang.localhost (CRM /portal)
  //      TOPO=single — một host khach.localhost (cấu hình cũ; mặc định ở real mode tới khi CRM có §15)
  const TOPO = (env.TOPO || (MODE === 'real' ? 'single' : 'multi')).toLowerCase();
  // HOST_SUFFIX: mặc định 'vipgroup.localhost' ⇒ ba host CÙNG một site (như *.vipgroup.com.vn ở production). Với 'localhost'
  // trần, trình duyệt coi mỗi *.localhost là một site riêng ⇒ cookie SameSite=Strict (vg_portal) bị bỏ ở chuỗi chuyển hướng
  // dangnhap → khachhang (xem báo cáo). Dùng HOST_SUFFIX=localhost để tái hiện.
  const SUF = (env.HOST_SUFFIX || 'vipgroup.localhost').toLowerCase();
  const H = TOPO === 'multi'
    ? { dangky: `dangky.${SUF}:${PROXY_PORT}`, dangnhap: `dangnhap.${SUF}:${PROXY_PORT}`, portal: `khachhang.${SUF}:${PROXY_PORT}` }
    : { dangky: `khach.localhost:${PROXY_PORT}`, dangnhap: `khach.localhost:${PROXY_PORT}`, portal: `khach.localhost:${PROXY_PORT}` };
  return {
    TOPO, H,
    MODE, VIPID_REPO, PY, PROXY_PORT, VIPID_PORT, CRM_PORT, START, runDir, dataDir, dbPath, CRM_REPO, CRM_DB,
    CRM_DATABASE_URL: `postgres:///${CRM_DB}`,
    KHACH_HOST: H.dangnhap, // host mặc định cho trang /tai-khoan/* (single: khach.localhost)
    KHACH_HOST_DIRECT: TOPO === 'multi' ? `dangnhap.${SUF}:${VIPID_PORT}` : `khach.localhost:${VIPID_PORT}`,
    HOST_SUFFIX: SUF, // gọi thẳng VIP ID (API nội bộ)
    STAFF_HOST: env.VIPID_STAFF_HOST || '127.0.0.1:8899', // chỉ là giá trị header Host; KHÔNG nghe cổng 8899
    secretFile: env.VIPID_PORTAL_SECRET_FILE || path.join(dataDir, 'portal_secret.key'),
    mockLog: runDir ? path.join(runDir, 'mock-crm.log') : null,
  };
}

/** Env bổ sung lúc chạy (bật pilot, …) — áp cho server VIP ID/CRM khởi động sau đó và cho CLI VIP ID. */
export const runtime = { vipidExtra: {}, crmExtra: {} };

/** Bí mật COWORK → CRM (cowork-launch/1): một tệp 0600, VIP ID đọc tệp (COWORK_CRM_LAUNCH_SECRET_FILE), CRM nhận giá trị (COWORK_SHARED_SECRET). */
export function coworkSecretFile(cfg) { return path.join(cfg.dataDir, 'crm_launch_secret.key'); }
export function ensureCoworkSecret(cfg) {
  const f = coworkSecretFile(cfg);
  if (!fs.existsSync(f)) { fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 }); fs.writeFileSync(f, crypto.randomBytes(36).toString('base64url'), { mode: 0o600 }); }
  return fs.readFileSync(f, 'utf8').trim();
}
const readOr = (f) => { try { return fs.readFileSync(f, 'utf8').trim(); } catch { return ''; } };

/** Env cho mọi tiến trình Python của VIP ID (server + CLI helper). */
export function vipidEnv(cfg, extra = {}) {
  return {
    ...process.env,
    COWORK_ENV: 'local',
    COWORK_DATA_DIR: cfg.dataDir,
    COWORK_DB_PATH: cfg.dbPath,
    COWORK_PORT: String(cfg.VIPID_PORT),
    COWORK_PUBLIC_URL: `http://${cfg.STAFF_HOST}`,
    COWORK_INTERNAL_URL: `http://${cfg.STAFF_HOST}`,
    COWORK_BRAIN_ENABLED: '0',
    COWORK_COOKIE_SECURE: '0',
    COWORK_KHACH_ENABLED: '1',
    ...(cfg.TOPO === 'multi' ? {
      COWORK_KHACH_HOSTS: '',
      COWORK_KHACH_HOST_DANGKY: `dangky.${cfg.HOST_SUFFIX}`, COWORK_KHACH_HOST_DANGNHAP: `dangnhap.${cfg.HOST_SUFFIX}`, // không cổng ⇒ khớp mọi cổng (proxy 8890 + gọi thẳng 8898)
      COWORK_KHACH_DANGKY_URL: `http://${cfg.H.dangky}`, COWORK_KHACH_DANGNHAP_URL: `http://${cfg.H.dangnhap}`,
      COWORK_KHACH_TIEP_CHO_PHEP: `http://${cfg.H.portal}/portal`,
    } : { COWORK_KHACH_HOSTS: `${cfg.KHACH_HOST},${cfg.KHACH_HOST_DIRECT}` }),
    COWORK_STAFF_HOSTS: cfg.STAFF_HOST,
    COWORK_KHACH_PUBLIC_URL: `http://${cfg.KHACH_HOST}`,
    CRM_PORTAL_INTERNAL_URL: `http://127.0.0.1:${cfg.CRM_PORT}`,
    CRM_PORTAL_PUBLIC_URL: `http://${cfg.H.portal}`,
    COWORK_TIN_PROXY: '1',
    VIPID_PORTAL_SECRET_FILE: cfg.secretFile,
    COWORK_KHACH_SIGNUP_IP_PER_HOUR: process.env.COWORK_KHACH_SIGNUP_IP_PER_HOUR || '200',
    CRM_PORTAL_TIMEOUT: '2',
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONUNBUFFERED: '1',
    // COWORK → CRM nội bộ (§15.6): CRM staff host = 127.0.0.1:$CRM_PORT
    COWORK_CRM_PUBLIC_URL: `http://127.0.0.1:${cfg.CRM_PORT}`,
    COWORK_CRM_LAUNCH_SECRET_FILE: coworkSecretFile(cfg),
    COWORK_KHACH_PILOT: '0',
    ...runtime.vipidExtra,
    ...extra,
  };
}

/** Env cho CRM thật (server/index.js + scripts/*). STORAGE/BACKUP trỏ ra thư mục tạm: không ghi gì vào repo CRM. */
export function crmEnv(cfg, extra = {}) {
  const st = cfg.runDir ? path.join(cfg.runDir, 'crm-storage') : undefined;
  return {
    ...process.env,
    APP_ENV: 'local', HOST: '127.0.0.1', PORT: String(cfg.CRM_PORT),
    DATABASE_URL: cfg.CRM_DATABASE_URL,
    PORTAL_ENABLED: '1', PORTAL_HOST: cfg.H.portal, PORTAL_PUBLIC_URL: `http://${cfg.H.portal}`,
    // §15: Host CRM gửi khi gọi thẳng VIP ID (API nội bộ chỉ ở host dangnhap); CRM cũ dùng PORTAL_HOST
    ...(cfg.TOPO === 'multi' ? {
      VIPID_PORTAL_HOST: cfg.KHACH_HOST_DIRECT,
      PORTAL_LOGIN_URL: `http://${cfg.H.dangnhap}/tai-khoan/dang-nhap`,
    } : {}),
    VIPID_PUBLIC_URL: `http://${cfg.H.dangnhap}`,
    COWORK_SHARED_SECRET: readOr(coworkSecretFile(cfg)),
    ...(cfg.runDir ? { PORTAL_OFF_FILE: path.join(cfg.runDir, 'portal.off') } : {}),
    ...runtime.crmExtra,
    VIPID_PORTAL_URL: `http://127.0.0.1:${cfg.VIPID_PORT}`, VIPID_PORTAL_SECRET_FILE: cfg.secretFile,
    ...(st ? { STORAGE_DIR: path.join(st, 'docs'), BACKUP_DIR: path.join(st, 'backups') } : {}),
    ...extra,
  };
}

/** Env cho proxy dev (proxy.mjs): cổng + sơ đồ host. */
export function proxyEnv(cfg) {
  return { ...process.env, PROXY_PORT: String(cfg.PROXY_PORT), VIPID_PORT: String(cfg.VIPID_PORT), CRM_PORT: String(cfg.CRM_PORT),
    PROXY_TOPO: cfg.TOPO, PROXY_HOST_DANGKY: cfg.H.dangky, PROXY_HOST_DANGNHAP: cfg.H.dangnhap, PROXY_HOST_PORTAL: cfg.H.portal };
}

/** Chạy script node của CRM (migrate, seed, portal-dev-seed) với DB E2E. */
export function crmScript(cfg, args) {
  const r = spawnSync(process.execPath, args, { cwd: cfg.CRM_REPO, env: crmEnv(cfg), encoding: 'utf8', timeout: 120_000 });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

/** psql chỉ đọc vào DB E2E của CRM (kiểm trạng thái; không ghi). */
export function crmSql(cfg, sql) {
  const r = spawnSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', cfg.CRM_DB, '-c', `SET default_transaction_read_only=on; ${sql}`], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql: ${r.stderr}`);
  return r.stdout.trim().split('\n').filter(Boolean);
}

/** Chạy `python -m cowork.cli …` của VIP ID với DB của stack. Trả {code, out, err}. */
export function vipidCli(cfg, args, extraEnv = {}) {
  const r = spawnSync(cfg.PY, ['-m', 'cowork.cli', ...args], {
    cwd: cfg.VIPID_REPO, env: vipidEnv(cfg, extraEnv), encoding: 'utf8', timeout: 60_000,
  });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

/** Chạy một đoạn Python ngắn (chỉ ĐỌC DB của stack để kiểm trạng thái; sqlite3 stdlib, không import mã VIP ID). */
export function sqlRead(cfg, sql, params = []) {
  const code = `import json,sqlite3,sys\nc=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True)\nc.row_factory=sqlite3.Row\n` +
    `print(json.dumps([dict(r) for r in c.execute(sys.argv[2],json.loads(sys.argv[3]))],default=str))`;
  const r = spawnSync(cfg.PY, ['-I', '-c', code, cfg.dbPath, sql, JSON.stringify(params)], { encoding: 'utf8', timeout: 20_000 });
  if (r.status !== 0) throw new Error(`sqlRead lỗi: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}

export async function waitHttp(port, { host = '127.0.0.1', timeoutMs = 30_000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const ok = await new Promise((resolve) => {
        const req = net.connect(port, host, () => { req.end(); resolve(true); });
        req.on('error', () => resolve(false));
      });
      if (ok) return true;
    } catch { /* thử lại */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Không chờ được cổng ${port}`);
}

export class Stack {
  constructor(cfg) { this.cfg = cfg; this.procs = {}; }

  async start() {
    const c = this.cfg;
    if (!c.START) return this;
    for (const p of [c.PROXY_PORT, c.VIPID_PORT, c.CRM_PORT]) {
      if (!(await portFree(p))) throw new Error(`Cổng ${p} đang bận — tắt tiến trình đang dùng hoặc đặt START=0 / cổng khác.`);
    }
    fs.mkdirSync(c.dataDir, { recursive: true, mode: 0o700 });
    // Tạo bí mật portal (0600) trước để CRM giả đọc cùng tệp — đúng như khach-dev.sh
    const r = spawnSync(c.PY, ['-c', 'from cowork import khach; khach.portal_secret()'], { cwd: c.VIPID_REPO, env: vipidEnv(c), encoding: 'utf8' });
    if (r.status !== 0) throw new Error('Không tạo được portal secret: ' + r.stderr);
    ensureCoworkSecret(c);
    if (c.MODE === 'real') { this.setupCrmDb(); await this.startCrm(); } else await this.startMockCrm();
    await this.startVipid();
    this.procs.proxy = this.spawnLogged('proxy', process.execPath, [path.join(HERE, 'proxy.mjs')], {
      cwd: HERE, env: proxyEnv(c),
    });
    await waitHttp(c.PROXY_PORT);
    return this;
  }

  setupCrmDb() {
    const c = this.cfg;
    spawnSync('dropdb', ['--if-exists', c.CRM_DB], { encoding: 'utf8' });
    const cr = spawnSync('createdb', [c.CRM_DB], { encoding: 'utf8' });
    if (cr.status !== 0) throw new Error(`createdb ${c.CRM_DB}: ${cr.stderr}`);
    this.dbCreated = true;
    for (const s of [['scripts/migrate.js'], ['scripts/seed-if-empty.js']]) {
      const r = crmScript(c, s);
      fs.appendFileSync(path.join(c.runDir, 'crm-setup.log'), `$ ${s.join(' ')}\n${r.out}${r.err}\n`);
      if (r.code !== 0) throw new Error(`${s[0]} lỗi: ${r.err.slice(0, 300)}`);
    }
  }

  async startCrm() {
    const c = this.cfg;
    if (this.procs.crm && this.procs.crm.exitCode === null) return;
    this.procs.crm = this.spawnLogged('crm', process.execPath, ['server/index.js'], { cwd: c.CRM_REPO, env: crmEnv(c, this.crmExtra || {}) });
    await waitHttp(c.CRM_PORT);
  }

  async stopCrm() {
    const p = this.procs.crm;
    if (!p || p.exitCode !== null) return;
    await killWait(p);
    this.procs.crm = null;
  }

  async startVipid() {
    const c = this.cfg;
    if (this.procs.vipid && this.procs.vipid.exitCode === null) return;
    this.procs.vipid = this.spawnLogged('vipid', c.PY, ['-m', 'uvicorn', 'cowork.main:app', '--host', '127.0.0.1', '--port', String(c.VIPID_PORT),
      '--no-access-log', '--no-proxy-headers'], { cwd: c.VIPID_REPO, env: vipidEnv(c) });
    await waitHttp(c.VIPID_PORT);
    const t0 = Date.now();
    while (Date.now() - t0 < 30_000) {
      try {
        const res = await raw({ port: c.PROXY_PORT, path: '/tai-khoan/dang-nhap', hostHeader: c.KHACH_HOST });
        if (res.status === 200) break;
      } catch { /* chưa sẵn sàng */ }
      await new Promise((r2) => setTimeout(r2, 250));
    }
  }

  async stopVipid() {
    const p = this.procs.vipid;
    if (!p || p.exitCode !== null) return;
    await killWait(p);
    this.procs.vipid = null;
  }

  spawnLogged(name, cmd, args, opts) {
    const logFile = path.join(this.cfg.runDir, `${name}.log`);
    const fd = fs.openSync(logFile, 'a');
    const p = spawn(cmd, args, { ...opts, stdio: ['ignore', fd, fd], detached: false });
    p.logFile = logFile;
    p.on('exit', () => { try { fs.closeSync(fd); } catch { /* đã đóng */ } });
    return p;
  }

  async startMockCrm() {
    const c = this.cfg;
    if (this.procs.crm && this.procs.crm.exitCode === null) return;
    this.procs.crm = this.spawnLogged('mock-crm', c.PY, ['scripts/khach_mock_crm.py'], {
      cwd: c.VIPID_REPO, env: { ...vipidEnv(c), MOCK_CRM_PORT: String(c.CRM_PORT) },
    });
    await waitHttp(c.CRM_PORT);
  }

  async stopMockCrm() {
    const p = this.procs.crm;
    if (!p || p.exitCode !== null) return;
    await killWait(p);
    this.procs.crm = null;
  }

  /** Dòng log CRM giả: `[mock-crm] <path> <body-json>` → [{path, body}] */
  mockCrmCalls() {
    if (!this.cfg.mockLog || !fs.existsSync(this.cfg.mockLog)) return [];
    return fs.readFileSync(this.cfg.mockLog, 'utf8').split('\n').map((l) => {
      const m = /^\[mock-crm\] (\S+) (\{.*\})$/.exec(l);
      if (!m) return null;
      try { return { path: m[1], body: JSON.parse(m[2]) }; } catch { return null; }
    }).filter(Boolean);
  }

  async stop() {
    for (const k of ['proxy', 'vipid', 'crm']) {
      const p = this.procs[k];
      if (p && p.exitCode === null) await killWait(p);
    }
    if (this.dbCreated && !process.env.KEEP) {
      const r = spawnSync('dropdb', ['--if-exists', this.cfg.CRM_DB], { encoding: 'utf8' });
      this.dbDropped = r.status === 0;
    }
  }
}

function killWait(p) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* đã thoát */ } }, 4000);
    p.once('exit', () => { clearTimeout(t); resolve(); });
    try { p.kill('SIGTERM'); } catch { clearTimeout(t); resolve(); }
  });
}
