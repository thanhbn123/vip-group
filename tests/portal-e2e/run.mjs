#!/usr/bin/env node
// E2E Cổng khách hàng P1 (VIP ID realm khách ⇄ CRM) — Playwright + HTTP thô, chỉ dữ liệu tổng hợp.
//
//   node tests/portal-e2e/run.mjs [thư-mục-ảnh]          # MODE=mock (mặc định): tự bật stack cô lập rồi tắt
//   MODE=real START=0 BASE=http://khach.localhost:8890 CRM_STAFF_URL=… CRM_ADMIN_TOKEN=… node tests/portal-e2e/run.mjs
//
// Kết quả: bảng PASS / FAIL / PENDING / XFAIL (+ results.json, ảnh chụp) trong thư mục ảnh (mặc định /tmp/portal-e2e-shots).
// Mã thoát ≠ 0 khi có FAIL (hoặc XPASS-lỗi-thời không tính là lỗi). Xem README.md.
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { stackConfig, Stack, vipidCli, sqlRead, crmSql } from './stack.mjs';
import { raw, absorb, cookieHeader, formField } from './http.mjs';
import { KhachClient, PW_STRONG, outbox, account, syncRows, internalPost, decodeLaunch, portalSecret, signV11, synth } from './vipid.mjs';
import { MockCrm, RealCrm, waitFor } from './crm.mjs';
import { launchBrowser, MOBILE, guard, overflow, shotPath } from './browser.mjs';

const MODE = (process.env.MODE || 'mock').toLowerCase();
if (!['mock', 'real'].includes(MODE)) { console.error('MODE phải là mock hoặc real'); process.exit(2); }
const SHOTS = path.resolve(process.argv[2] || '/tmp/portal-e2e-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const cfg = stackConfig();
const BASE = (process.env.BASE || `http://${cfg.KHACH_HOST}`).replace(/\/+$/, '');
const RUN = Date.now().toString(36).slice(-6);
const PW2 = 'Mat-Khau-Moi-E2E-2026#b';
const PW3 = 'Doi-Mat-Khau-E2E-2026$c';
// Quy tắc mã khách: v1 = VG + 6 số (VG000001…); v2 (owner đổi 07/11) = VG1001, VG1002… không đệm số 0.
const CODE_RULE = (process.env.CODE_RULE || 'v2').toLowerCase();
const CODE_RE = CODE_RULE === 'v2' ? /^VG[1-9]\d{3,8}$/ : /^VG\d{6}$/;
const FIRST_CODE = CODE_RULE === 'v2' ? 'VG1001' : 'VG000001';
const codeNum = (c) => Number(String(c).slice(2));

// ───────── khung kiểm ─────────
class Pending extends Error {}
class XFail extends Error {}
class Blocked extends Error {}
const SHAS = {};
let crmBlocked = null; // lý do: CRM chưa cấp mã theo quy tắc mới (VG1001…)
const results = [];
const pages = []; // {name, url, overflow, status}
let events = [];
const extraEvents = [];

async function check(id, title, scope, fn) {
  const t0 = Date.now();
  const notes = [];
  const t = {
    note: (s) => notes.push(s),
    ok(cond, msg) { if (!cond) throw new Error(msg); notes.push(`✓ ${msg}`); },
    eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: mong ${JSON.stringify(b)}, nhận ${JSON.stringify(a)}`); notes.push(`✓ ${msg}`); },
    pending(reason) { throw new Pending(reason); },
    xfail(reason) { throw new XFail(reason); },
  };
  let status = 'PASS'; let detail = '';
  if (scope === 'real' && MODE !== 'real') { status = 'PENDING'; detail = 'cần CRM thật (MODE=real)'; }
  else {
    try { await fn(t); }
    catch (e) {
      if (e instanceof Pending) { status = 'PENDING'; detail = e.message; }
      else if (e instanceof XFail) { status = 'XFAIL'; detail = e.message; }
      else if (e instanceof Blocked) { status = 'BLOCKED'; detail = e.message; }
      else if (crmBlocked && MODE === 'real') { status = 'BLOCKED'; detail = `blocked by CRM VG1001 (${crmBlocked}) — ${e?.message || e}`; }
      else { status = 'FAIL'; detail = e?.message || String(e); }
    }
  }
  const r = { id, title, scope, status, detail, notes, ms: Date.now() - t0 };
  results.push(r);
  const icon = { PASS: 'PASS ', FAIL: 'FAIL ', PENDING: 'PEND ', XFAIL: 'XFAIL', BLOCKED: 'BLOCK' }[status];
  console.log(`[${icon}] ${id} ${title}${detail ? ` — ${detail}` : ''}`);
  if (process.env.VERBOSE && notes.length) for (const n of notes) console.log(`         ${n}`);
  return r;
}

async function inspect(page, name, { expectStatus } = {}) {
  await page.waitForLoadState('load');
  const o = await overflow(page);
  await page.screenshot({ path: shotPath(SHOTS, name), fullPage: true });
  pages.push({ name, url: page.url(), ...o, expectStatus });
  return o;
}

const textOf = async (page, sel) => ((await page.locator(sel).first().textContent({ timeout: 5000 })) || '').trim();
let workaround = false;
/** Context 390px có theo dõi; nếu BUG-VIPID-01 (Origin null) được phát hiện thì vá header Origin cho POST cùng host. */
async function newCtx() {
  const ctx = await browser.newContext(MOBILE);
  ctx._e2eEvents = await guard(ctx);
  if (workaround) {
    const origin = new URL(BASE).origin;
    await ctx.route((u) => u.origin === origin && u.pathname.startsWith('/tai-khoan/'), (route) => {
      const req = route.request();
      if (req.method() === 'POST' && req.headers().origin === 'null') return route.continue({ headers: { ...req.headers(), origin } });
      return route.continue();
    });
  }
  return ctx;
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
/** Đóng context an toàn (route handler đang treo có thể làm close() chờ mãi). */
async function closeCtx(ctx) {
  if (!ctx) return;
  await withTimeout(ctx.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {}), 3000);
  await withTimeout(ctx.close().catch(() => {}), 5000);
}
/** Đăng nhập VIP ID (HTTP thô) rồi đi launch → client có vg_portal (real) hoặc đã qua launch CRM giả (mock). */
async function portalClient(u, pw = u.pw || PW_STRONG) {
  const c = new KhachClient(cfg);
  const lr = await c.login(u.phone, pw);
  if (lr.status !== 303 || !/\/portal\/auth\/launch/.test(lr.headers.location || '')) throw new Error(`đăng nhập ${u.key} → ${lr.status} ${lr.headers.location || ''}`);
  const loc = new URL(lr.headers.location, BASE);
  c.launch = await c.req('GET', loc.pathname + loc.search);
  return c;
}
async function papi(c, p, o = {}) {
  const r = await c.req(o.method || 'GET', p, { json: o.json, headers: o.headers || {} });
  let json = null; try { json = JSON.parse(r.body); } catch { /* không phải JSON */ }
  return { ...r, json };
}
/** CRM cấp mã không theo quy tắc mới → VIP ID từ chối ket-qua-duyet: đánh dấu BLOCKED (không phải lỗi VIP ID). */
function noteBlocked(r) {
  if (MODE !== 'real' || r.ok || !r.portalCode || CODE_RE.test(r.portalCode)) return;
  crmBlocked = `CRM cấp ${r.portalCode}, VIP ID yêu cầu ${CODE_RE} — outbox: ${r.outboxError || '?'}`;
  throw new Blocked(`blocked by CRM VG1001: ${crmBlocked}`);
}
const needsStart = (t) => { if (!cfg.START) t.pending('cần START=1 (stack do bộ test quản lý)'); };

// ───────── chạy ─────────
const stack = new Stack(cfg);
const crm = MODE === 'mock' ? new MockCrm(cfg, stack) : new RealCrm(cfg, stack);
let browser;
const P = {}; // người dùng tổng hợp
const mk = (key, i, name) => { P[key] = { key, name, ...synth(RUN, i) }; return P[key]; };

async function main() {
  if (MODE === 'real') {
    const miss = crm.missing();
    if (miss.length) console.log(`[real] thiếu cấu hình: ${miss.join(', ')} — các kiểm cần CRM sẽ FAIL/PENDING`);
  }
  const sha = (repo) => { const r = spawnSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }); const d = spawnSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf8' }); return `${(r.stdout || '?').trim()}${(d.stdout || '').trim() ? '+dirty' : ''}`; };
  SHAS.vipid = sha(cfg.VIPID_REPO); SHAS.crm = sha(cfg.CRM_REPO);
  console.log(`SHA: VIP ID ${SHAS.vipid} · CRM ${SHAS.crm}${MODE === 'mock' ? ' (CRM: chỉ dùng vipid-client.js/internal.js/web-portal để đối chiếu)' : ''}`);
  await stack.start();
  console.log(`MODE=${MODE} START=${cfg.START ? 1 : 0} BASE=${BASE} run=${RUN}${cfg.runDir ? ` runDir=${cfg.runDir}` : ''}\nẢnh: ${SHOTS}\n`);
  browser = await launchBrowser();

  // ════════════ TIỀN KIỂM TRÌNH DUYỆT ════════════
  await check('FLOW-00', 'Trình duyệt thật gửi form POST của VIP ID được chấp nhận (CSRF cùng nguồn với Origin trình duyệt tự đặt)', 'both', async (t) => {
    const ctx0 = await browser.newContext(MOBILE);
    try {
      const p0 = await ctx0.newPage();
      let origin;
      p0.on('request', (r) => { if (r.method() === 'POST') origin = r.headers().origin; });
      await p0.goto(`${BASE}/tai-khoan/dang-nhap`);
      await p0.fill('input[name=dinh_danh]', '0900099999');
      await p0.fill('input[name=mat_khau]', 'khong-dung-mat-khau-1');
      const [resp] = await Promise.all([p0.waitForResponse((r) => r.request().method() === 'POST'), p0.click('form[action="/tai-khoan/dang-nhap"] button[type=submit]')]);
      await p0.waitForLoadState('load');
      await p0.screenshot({ path: shotPath(SHOTS, '00-form-post-trinh-duyet'), fullPage: true });
      t.note(`Origin trình duyệt gửi: ${origin}`);
      const meta = await p0.evaluate(() => document.querySelector('meta[name=referrer]')?.content || null);
      if (resp.status() === 403) {
        workaround = !process.env.STRICT_BROWSER;
        throw new Error(`BUG-VIPID-01: POST đăng nhập từ Chromium → 403 "Phiên biểu mẫu đã hết hạn". Trình duyệt gửi Origin: ${origin} vì trang có <meta name="referrer" content="${meta}"> (Fetch: referrer policy no-referrer ⇒ Origin "null" cho POST), còn khach_web._cung_nguon từ chối Origin "null" ⇒ khách thật KHÔNG đăng ký/xác minh/đăng nhập/đặt lại được.${workaround ? ' Các kiểm trình duyệt sau chạy với vá tạm (Playwright đổi Origin null → origin thật) để đo phần còn lại; STRICT_BROWSER=1 để tắt vá.' : ''}`);
      }
      t.eq(resp.status(), 401, 'POST sai mật khẩu → 401 (đi tới kiểm mật khẩu, không bị chặn CSRF)');
    } finally { await closeCtx(ctx0); }
  });

  const ctxA = await newCtx();
  events = ctxA._e2eEvents;
  const page = await ctxA.newPage();
  const K1 = mk('K1', 1, 'Nguyễn Văn Tổng Hợp');
  K1.pw = PW_STRONG;
  let seedCache = null;
  let ctxB = null;

  // ════════════ LUỒNG ĐẦY ĐỦ ════════════
  await check('FLOW-01', 'Đăng ký (trình duyệt 390px, không Turnstile ở dev) → ngay "chờ duyệt", signup sang CRM (không xác minh email)', 'both', async (t) => {
    await page.goto(`${BASE}/tai-khoan/dang-ky`);
    t.ok(!(await page.content()).includes('challenges.cloudflare.com'), 'dev không cấu hình Turnstile: trang đăng ký không nạp script Cloudflare');
    await inspect(page, '01-dang-ky');
    await page.fill('input[name=ho_ten]', K1.name);
    await page.fill('input[name=sdt]', K1.phoneLocal);
    await page.fill('input[name=email]', K1.email);
    await page.fill('input[name=mat_khau]', PW_STRONG);
    await page.fill('input[name=mat_khau_2]', PW_STRONG);
    await page.check('input[name=dong_y]');
    await Promise.all([page.waitForURL(/\/tai-khoan\/cho-duyet$/), page.click('form[action="/tai-khoan/dang-ky"] button[type=submit]')]);
    t.eq(await textOf(page, 'h1'), 'Đã nhận đăng ký, chờ VIP GROUP duyệt', 'trang "đã nhận đăng ký, chờ duyệt"');
    await inspect(page, '02-da-nhan-dang-ky');
    const acc = account(cfg, 'phone_e164=?', [K1.phone])[0];
    t.ok(acc && acc.status === 'cho_duyet', 'tài khoản tạo thẳng ở cho_duyet');
    t.eq(acc.email_norm, K1.email, 'email (tuỳ chọn) được chuẩn hoá');
    K1.subject = acc.subject;
    t.ok(/^cust:kh_[a-z0-9]{26}$/.test(acc.subject), 'subject dạng cust:kh_…');
    const got = await waitFor(async () => (await crm.signupsReceived(K1.subject)).length > 0, 12_000);
    t.ok(got, `CRM (${crm.kind}) nhận signup có chữ ký hợp lệ ngay khi đăng ký`);
    const sg = (await crm.signupsReceived(K1.subject))[0];
    t.eq(sg.phone_e164, K1.phone, 'signup mang SĐT E.164');
    t.ok(!sg.phone_conflict, 'signup không cờ xung đột SĐT');
    t.ok(syncRows(cfg, K1.subject).filter((r) => r.kind === 'signup').every((r) => r.done_at), 'crm_sync_pending: signup đã gửi xong');
    t.eq(outbox(cfg).length, 0, 'không có email nào trong outbox (email tắt mặc định)');
  });

  await check('FLOW-02', 'Đăng ký KHÔNG email → chờ duyệt, signup email=null; các trang xác minh email cũ đã gỡ (404)', 'both', async (t) => {
    const N = mk('NE', 7, 'Khách Không Email');
    const c = new KhachClient(cfg);
    const r = await c.register({ name: N.name, phone: N.phoneLocal, email: '' });
    t.ok(r.status === 303 && r.headers.location === '/tai-khoan/cho-duyet', `đăng ký không email → 303 /tai-khoan/cho-duyet (${r.status})`);
    const acc = account(cfg, 'phone_e164=?', [N.phone])[0];
    t.ok(acc && acc.status === 'cho_duyet' && acc.email_norm === null, 'tài khoản cho_duyet, email_norm NULL');
    N.subject = acc.subject;
    const got = await waitFor(async () => (await crm.signupsReceived(N.subject)).length > 0, 12_000);
    t.ok(got, `CRM (${crm.kind}) nhận signup không email`);
    t.ok((await crm.signupsReceived(N.subject))[0].email == null, 'signup mang email = null');
    for (const p of ['/tai-khoan/xac-minh-email?t=x', '/tai-khoan/da-gui-email', '/tai-khoan/gui-lai-xac-minh']) {
      t.eq((await c.req('GET', p)).status, 404, `${p} → 404 (đã gỡ)`);
    }
    const bad = await new KhachClient(cfg).register({ name: 'Email Sai', phone: synth(RUN, 8).phoneLocal, email: 'khong-phai-email' });
    t.ok(bad.status === 400 && bad.body.includes('Địa chỉ email không hợp lệ'), 'email có nhập nhưng sai định dạng → 400');
  });

  await check('FLOW-03', 'Đăng nhập khi chưa duyệt → trang "đang được xem xét" (không vào CRM)', 'both', async (t) => {
    await page.goto(`${BASE}/tai-khoan/dang-nhap`);
    await page.fill('input[name=dinh_danh]', K1.phoneLocal);
    await page.fill('input[name=mat_khau]', PW_STRONG);
    await Promise.all([page.waitForURL(/\/tai-khoan\/cho-duyet$/), page.click('form[action="/tai-khoan/dang-nhap"] button[type=submit]')]);
    t.eq(await textOf(page, 'h1'), 'Đã nhận đăng ký, chờ VIP GROUP duyệt', 'trang chờ duyệt');
    await inspect(page, '06-cho-duyet');
    const ck = (await ctxA.cookies()).find((c) => c.name === 'vg_khach');
    t.ok(!ck, 'không cấp cookie phiên vg_khach');
  });

  await check('FLOW-04', `Duyệt + cấp mã VG (${MODE === 'mock' ? 'khach-duyet-dev' : 'API nhân viên CRM'})`, 'both', async (t) => {
    const r = await crm.approve({ phone: K1.phone, subject: K1.subject, portalCode: K1.code });
    noteBlocked(r);
    t.ok(r.ok, `duyệt thành công ${r.out ? `(${r.out.slice(0, 120)})` : ''}`);
    if (MODE === 'real' && process.env.CRM_SKIP_VERIFY_PHONE === '1') {
      const sg = await crm.findSignup(K1.subject);
      t.ok(!sg.phone_verified_at && !sg.phone_verified_by, 'duyệt KHÔNG qua verify-phone (CRM_SKIP_VERIFY_PHONE=1): signup không có phone_verified_*');
    }
    K1.code = r.portalCode || K1.code;
    const acc = account(cfg, 'subject=?', [K1.subject])[0];
    t.eq(acc.status, 'hoat_dong', 'VIP ID: hoat_dong');
    t.eq(acc.portal_code, K1.code, 'VIP ID: portal_code khớp mã CRM cấp');
    t.ok(CODE_RE.test(acc.portal_code), `mã đúng quy tắc ${CODE_RULE} (${acc.portal_code})`);
    if (MODE === 'real') t.eq(K1.code, FIRST_CODE, 'đăng ký đầu tiên trên DB mới nhận mã đầu tiên');
  });

  async function loginBrowser(ctxPage, ident, pw = PW_STRONG) {
    await ctxPage.goto(`${BASE}/tai-khoan/dang-nhap`);
    await ctxPage.fill('input[name=dinh_danh]', ident);
    await ctxPage.fill('input[name=mat_khau]', pw);
    await Promise.all([ctxPage.waitForURL(/\/portal\/(auth\/launch\?token=|$|#)/, { timeout: 15000 }), ctxPage.click('form[action="/tai-khoan/dang-nhap"] button[type=submit]')]);
  }

  async function assertLanded(t, pg, ctx, who, shot) {
    const hist = pg.url();
    if (MODE === 'mock') {
      t.ok(/\/portal\/auth\/launch\?token=/.test(hist), 'chuyển sang CRM /portal/auth/launch?token=…');
      t.ok((await pg.content()).includes('CRM giả: launch hợp lệ'), 'CRM giả chấp nhận launch token');
      const token = new URL(hist).searchParams.get('token');
      const d = decodeLaunch(cfg, token);
      const acc = account(cfg, 'subject=?', [who.subject])[0];
      t.ok(d.sigOk && d.header.alg === 'HS256', 'chữ ký HS256 hợp lệ với VIPID_PORTAL_SECRET');
      t.eq(d.claims.aud, 'vip-crm-portal', 'aud');
      t.eq(d.claims.ver, 1, 'ver');
      t.eq(d.claims.sub, who.subject, 'sub = subject khách');
      t.eq(d.claims.portal_code, who.code, 'portal_code');
      t.eq(d.claims.crm_customer_id, acc.crm_customer_id, 'crm_customer_id');
      t.ok(d.claims.exp - d.claims.iat <= 60 && d.claims.exp > Date.now() / 1000, 'TTL ≤ 60 s');
      t.ok(typeof d.claims.nonce === 'string' && d.claims.nonce.length >= 16, 'có nonce');
      await inspect(pg, shot);
      return hist;
    }
    await pg.waitForURL(/\/portal\/(#.*)?$/, { timeout: 15000 });
    await pg.waitForSelector('#portal-code', { timeout: 15000 });
    t.eq((await textOf(pg, '#portal-code')), who.code, 'cổng CRM hiển thị đúng mã VG');
    const vp = (await ctx.cookies(BASE)).find((c) => c.name === 'vg_portal');
    t.ok(vp && vp.httpOnly && vp.path === '/' && !vp.domain.startsWith('.'), 'cookie vg_portal host-only, HttpOnly, Path=/');
    t.eq(vp.sameSite, 'Strict', 'vg_portal SameSite=Strict');
    await inspect(pg, shot);
    return null;
  }

  await check('FLOW-05', 'Đăng nhập VIP ID bằng SĐT (định dạng có khoảng trắng) → launch vào CRM portal', 'both', async (t) => {
    const spaced = `${K1.phoneLocal.slice(0, 4)} ${K1.phoneLocal.slice(4, 7)} ${K1.phoneLocal.slice(7)}`;
    await loginBrowser(page, spaced);
    await assertLanded(t, page, ctxA, K1, '07-launch-sdt');
    const ck = (await ctxA.cookies()).find((c) => c.name === 'vg_khach');
    t.ok(ck && ck.httpOnly && ck.path === '/tai-khoan' && ck.sameSite === 'Lax' && !ck.domain.startsWith('.'), 'cookie vg_khach: Path=/tai-khoan, HttpOnly, SameSite=Lax, host-only');
  });

  await check('FLOW-06', 'Đăng nhập VIP ID bằng mã VG (chữ thường) ở thiết bị thứ hai → launch vào CRM portal', 'both', async (t) => {
    ctxB = await newCtx();
    extraEvents.push(ctxB._e2eEvents);
    const pb = await ctxB.newPage();
    await loginBrowser(pb, K1.code.toLowerCase());
    await assertLanded(t, pb, ctxB, K1, '08-launch-ma-vg');
    if (CODE_RULE === 'v2') {
      for (const old of ['VG0' + codeNum(K1.code), 'VG000001']) {
        const r = await new KhachClient(cfg).login(old, K1.pw || PW_STRONG);
        t.eq(r.status, 401, `mã định dạng cũ/đệm 0 ${old} (đúng mật khẩu K1) bị từ chối`);
      }
    }
    await pb.close();
  });

  await check('FLOW-07', 'Launch token dùng một lần; token bị sửa / sai aud / hết hạn bị CRM từ chối', 'both', async (t) => {
    const c = new KhachClient(cfg);
    const lr = await c.login(K1.phone);
    t.eq(lr.status, 303, 'đăng nhập HTTP thô → 303');
    const url = new URL(lr.headers.location, BASE);
    t.ok(url.pathname === '/portal/auth/launch', 'Location = /portal/auth/launch');
    const go = (pathq) => raw({ port: cfg.PROXY_PORT, path: pathq, hostHeader: cfg.KHACH_HOST });
    const first = await go(url.pathname + url.search);
    t.ok(first.status === 200 || first.status === 303, `lần 1 chấp nhận (${first.status})`);
    const second = await go(url.pathname + url.search);
    t.ok(second.status >= 400 && !(second.setCookies || []).some((s) => s.startsWith('vg_portal=')), `phát lại → từ chối (${second.status}), không cấp vg_portal`);
    const tok = url.searchParams.get('token');
    const [h, p, s] = tok.split('.');
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    const forge = (patch, resign) => {
      const np = Buffer.from(JSON.stringify({ ...claims, nonce: claims.nonce + 'x' + Math.random().toString(36).slice(2), ...patch })).toString('base64url');
      if (!resign) return `${h}.${np}.${s}`;
      return `${h}.${np}.${signHs(`${h}.${np}`)}`;
    };
    const tampered = await go(`/portal/auth/launch?token=${forge({ portal_code: 'VG000000' }, false)}`);
    t.ok(tampered.status >= 400, `payload bị sửa (chữ ký cũ) → ${tampered.status}`);
    const now = Math.floor(Date.now() / 1000);
    const wrongAud = await go(`/portal/auth/launch?token=${forge({ aud: 'vip-crm' }, true)}`);
    t.ok(wrongAud.status >= 400, `aud sai (ký đúng) → ${wrongAud.status}`);
    const expired = await go(`/portal/auth/launch?token=${forge({ iat: now - 120, exp: now - 60 }, true)}`);
    t.ok(expired.status >= 400, `hết hạn (ký đúng) → ${expired.status}`);
    const longTtl = await go(`/portal/auth/launch?token=${forge({ iat: now, exp: now + 3600 }, true)}`);
    t.ok(longTtl.status >= 400, `TTL > 60 s (ký đúng) → ${longTtl.status}`);
    if (MODE === 'mock') t.note('Ghi chú: ở mock mode phía kiểm token là CRM giả của VIP ID (scripts/khach_mock_crm.py)');
  });

  await check('FLOW-08', 'Xem kiện của tôi trong CRM portal (#/kien-hang, /portal/api/parcels)', 'real', async (t) => {
    const seed = await ensureSeed(t);
    await page.goto(`${BASE}/portal/#/kien-hang`);
    await page.waitForSelector('#parcel-list article.parcel', { timeout: 15000 });
    const shown = await page.locator('#parcel-list article.parcel .trk').allTextContents();
    for (const trk of seed.K1) t.ok(shown.includes(trk), `hiện kiện ${trk}`);
    for (const trk of seed.K2) t.ok(!shown.includes(trk), `không hiện kiện K2 ${trk}`);
    t.ok(!shown.includes(seed.K1_PENDING[0]), `không hiện kiện chưa xác nhận chủ ${seed.K1_PENDING[0]}`);
    t.eq(shown.length, seed.K1.length, 'số thẻ kiện = số kiện đã xác nhận của K1');
    await inspect(page, '09-kien-hang');
    const api = await ctxA.request.get(`${BASE}/portal/api/parcels`);
    t.eq(api.status(), 200, '/portal/api/parcels 200');
    const items = (await api.json()).items.map((x) => x.tracking_no);
    t.ok(seed.K1.every((x) => items.includes(x)) && !seed.K2.some((x) => items.includes(x)), 'API chỉ trả kiện của K1');
  });

  await check('FLOW-09', 'Tra cứu vận đơn (#/tra-cuu) — thấy kiện của mình', 'real', async (t) => {
    const seed = await ensureSeed(t);
    await page.goto(`${BASE}/portal/#/tra-cuu`);
    await page.fill('#trk-q', seed.K1[0]);
    await page.click('#search-form button[type=submit]');
    await page.waitForSelector('#search-out article.parcel, #search-out .msg', { timeout: 10000 });
    const trk = await page.locator('#search-out article.parcel .trk').allTextContents();
    t.ok(trk.includes(seed.K1[0]), `tra cứu ${seed.K1[0]} hiện thẻ kiện (UI)`);
    await inspect(page, '10-tra-cuu');
    const api = await ctxA.request.get(`${BASE}/portal/api/parcels/search?tracking=${encodeURIComponent(seed.K1[0])}`);
    t.eq(api.status(), 200, 'API search 200');
  });

  await check('FLOW-12', 'Danh mục kho trong cổng: 4 kho, XM/YW "Sắp mở" (planned), SZ/GZ hoạt động', 'real', async (t) => {
    const r = await ctxA.request.get(`${BASE}/portal/api/warehouses`);
    t.eq(r.status(), 200, '/portal/api/warehouses 200');
    const items = (await r.json()).items;
    t.eq(items.length, 4, '4 kho');
    const st = Object.fromEntries(items.map((w) => [w.code, w.status]));
    t.ok(st.SZ === 'active' && st.GZ === 'active', 'SZ, GZ active');
    t.ok(st.XM === 'planned' && st.YW === 'planned', 'XM, YW planned');
    await page.goto(`${BASE}/portal/#/kho`);
    await page.waitForSelector('section.wh', { timeout: 10000 });
    t.eq(await page.locator('section.wh').count(), 4, 'UI hiện 4 thẻ kho');
    t.eq(await page.locator('section.wh .pill', { hasText: 'Sắp mở' }).count(), 2, 'UI: 2 kho "Sắp mở"');
    await inspect(page, '10b-kho');
  });

  await check('FLOW-10', 'Đăng xuất → phiên VIP ID bị thu hồi, CRM nhận thu-hồi', 'both', async (t) => {
    if (MODE === 'mock') {
      await page.goto(`${BASE}/tai-khoan/dang-xuat`);
      t.eq(await textOf(page, 'h1'), 'Đăng xuất', 'trang xác nhận đăng xuất');
      await inspect(page, '11-dang-xuat');
      await Promise.all([page.waitForURL(/\/tai-khoan\/dang-nhap\?da_thoat=1$/), page.click('form[action="/tai-khoan/dang-xuat"] button[type=submit]')]);
    } else {
      // web-portal: POST /portal/api/logout (huỷ vg_portal) rồi sang GET /tai-khoan/dang-xuat (trang xác nhận của VIP ID)
      await page.goto(`${BASE}/portal/#/tong-quan`);
      await page.waitForSelector('#logout-form button', { state: 'visible', timeout: 10000 });
      const sawLogout = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/portal/api/logout'), { timeout: 10000 });
      await Promise.all([page.waitForURL(/\/tai-khoan\/dang-xuat$/, { timeout: 15000 }), page.click('#logout-form button')]);
      t.ok(await sawLogout, 'cổng gọi POST /portal/api/logout trước khi chuyển trang');
      const me = await ctxA.request.get(`${BASE}/portal/api/me`);
      t.eq(me.status(), 401, '/portal/api/me sau bước 1 → 401 (vg_portal đã huỷ)');
      t.eq(await textOf(page, 'h1'), 'Đăng xuất', 'đến trang xác nhận đăng xuất của VIP ID');
      await inspect(page, '11-dang-xuat-tu-cong');
      await Promise.all([page.waitForURL(/\/tai-khoan\/dang-nhap\?da_thoat=1$/), page.click('form[action="/tai-khoan/dang-xuat"] button[type=submit]')]);
    }
    await page.waitForSelector('text=Bạn đã đăng xuất.');
    await inspect(page, '12-da-dang-xuat');
    t.ok(!(await ctxA.cookies()).some((c) => c.name === 'vg_khach'), 'cookie vg_khach bị xoá');
    await page.goto(`${BASE}/tai-khoan/vao-cong`);
    t.ok(/\/tai-khoan\/dang-nhap$/.test(page.url()), '/tai-khoan/vao-cong → về trang đăng nhập (không còn phiên)');
    if (MODE === 'mock') {
      const ok = await waitFor(() => crm.revokesReceived(K1.subject).some((x) => x.reason === 'dang_xuat'), 5000);
      t.ok(ok, 'CRM giả nhận /api/internal/portal/thu-hoi reason=dang_xuat (HMAC hợp lệ)');
    }
  });

  await check('FLOW-10b', 'Hồi quy G7: đăng xuất VIP ID → thu-hoi chỉ huỷ phiên cổng; khách đăng nhập lại được ngay, users/customers vẫn active', 'both', async (t) => {
    const c = await portalClient(K1);
    if (MODE === 'real') t.eq((await papi(c, '/portal/api/me')).status, 200, 'đã có phiên cổng');
    await new Promise((r) => setTimeout(r, 1500)); // tách khỏi giây tạo phiên (xem INTEROP-05)
    const lo = await c.logout();
    t.ok(lo.post && lo.post.status === 303, 'đăng xuất qua trang xác nhận VIP ID (có _csrf) → 303');
    if (MODE === 'real') {
      t.ok(await waitFor(async () => (await papi(c, '/portal/api/me')).status === 401, 10_000), 'CRM nhận thu-hoi: phiên vg_portal của khách bị huỷ');
    } else {
      t.ok(await waitFor(() => crm.revokesReceived(K1.subject).length >= 2, 5000), 'CRM giả nhận thu-hoi');
    }
    const again = await portalClient(K1);
    if (MODE === 'real') {
      t.ok((again.launch.setCookies || []).some((x) => x.startsWith('vg_portal=')), 'đăng nhập lại → launch cấp vg_portal mới');
      t.eq((await papi(again, '/portal/api/me')).status, 200, '/portal/api/me sau đăng nhập lại → 200');
      t.eq(crmSql(cfg, `SELECT u.active::text || ',' || c.active::text FROM users u JOIN customers c ON c.user_id=u.id WHERE u.vip_subject='${K1.subject}'`)[0], 'true,true', 'CRM users.active và customers.active vẫn true sau thu-hoi');
    } else t.ok(again.launch.status === 200, 'đăng nhập lại sau đăng xuất → launch được');
  });

  await check('FLOW-11', 'Khôi phục do nhân viên: quên MK chỉ hiện hotline; nhân viên cấp link (tao-link-dat-lai) → GET xác nhận, POST tiêu; MK cũ hỏng, MK mới dùng được, phiên cũ bị thu hồi', 'both', async (t) => {
    t.ok(ctxB, 'có phiên thiết bị 2 từ FLOW-06');
    const pb = await ctxB.newPage();
    await pb.goto(`${BASE}/tai-khoan/dang-nhap`);
    t.eq(await textOf(pb, 'h1'), `Xin chào, ${K1.name}`, 'thiết bị 2 đang đăng nhập (trước khi đặt lại)');
    const tv0 = account(cfg, 'subject=?', [K1.subject])[0].token_version;
    await page.goto(`${BASE}/tai-khoan/quen-mat-khau`);
    const qbody = await page.locator('main').innerText();
    t.ok(/hotline\/Zalo\s+[\d ]{9,}/.test(qbody), 'trang quên mật khẩu hiện hotline/Zalo');
    t.eq(await page.locator('form[action="/tai-khoan/quen-mat-khau"]').count(), 0, 'không có form tự gửi link (email tắt)');
    await inspect(page, '13-quen-mat-khau-hotline');
    const qpost = await new KhachClient(cfg).req('POST', '/tai-khoan/quen-mat-khau', { form: { dinh_danh: K1.phone } });
    t.eq(qpost.status, 404, 'POST /tai-khoan/quen-mat-khau → 404 (khôi phục tự phục vụ tắt)');
    // Nhân viên (CRM) xác nhận danh tính qua điện thoại rồi cấp link
    const l1 = await crm.resetLink(K1.subject, { direct: true });
    t.ok(l1.ok && l1.url.startsWith(`${BASE}/tai-khoan/dat-lai?t=`), `cấp link qua VIP ID tao-link-dat-lai (HMAC như CRM gọi; đường CRM kiểm ở FLOW-11b) (${l1.status})`);
    const l2 = await crm.resetLink(K1.subject, { direct: true });
    t.ok(l2.ok && l2.url !== l1.url, 'cấp link lần 2 → link mới');
    const r1 = await page.goto(l1.url);
    t.eq(r1.status(), 400, 'link cũ bị vô hiệu khi nhân viên cấp link mới');
    await inspect(page, '14-dat-lai-link-bi-thay', { expectStatus: 400 });
    const link = l2.url;
    await page.goto(link);
    await page.reload();
    t.ok(await page.locator('form[action="/tai-khoan/dat-lai"]').count() === 1, 'GET (2 lần) vẫn hiện form — không tiêu token');
    await inspect(page, '15-dat-lai');
    await page.fill('input[name=mat_khau]', PW2);
    await page.fill('input[name=mat_khau_2]', PW2);
    await page.click('form[action="/tai-khoan/dat-lai"] button[type=submit]');
    await page.waitForSelector('text=Đã đặt mật khẩu mới');
    await inspect(page, '16-dat-lai-xong');
    t.eq(account(cfg, 'subject=?', [K1.subject])[0].token_version, tv0 + 1, 'token_version tăng');
    const c = new KhachClient(cfg);
    const old = await c.login(K1.phone, PW_STRONG);
    t.ok(old.status === 401 && old.body.includes('Thông tin đăng nhập không đúng'), 'mật khẩu cũ → 401 thông báo chung');
    K1.pw = PW2;
    const neu = await c.login(K1.phone, K1.pw);
    t.ok(neu.status === 303 && /\/portal\/auth\/launch\?token=/.test(neu.headers.location || ''), 'mật khẩu mới → đăng nhập được');
    await pb.goto(`${BASE}/tai-khoan/vao-cong`);
    t.ok(/\/tai-khoan\/dang-nhap$/.test(pb.url()), 'phiên cũ ở thiết bị 2 bị thu hồi');
    if (MODE === 'real') {
      const me = await ctxB.request.get(`${BASE}/portal/api/me`);
      t.eq(me.status(), 401, 'phiên CRM portal cũ ở thiết bị 2 bị thu hồi (thu-hoi)');
    }
    await pb.close();
    const reuse = await page.goto(link);
    t.eq(reuse.status(), 400, 'dùng lại link đặt lại → 400');
    // (owner) sau đặt lại: đăng xuất rồi đăng nhập lại bằng mật khẩu MỚI
    const s1 = await portalClient(K1, PW2);
    const lo1 = await s1.logout();
    t.ok(lo1.post?.status === 303 && !(await s1.hasSession()), 'đăng xuất sau khi đặt lại');
    const s2 = await portalClient(K1, PW2);
    t.ok(await s2.hasSession(), 'đăng nhập LẠI bằng mật khẩu mới sau khi đăng xuất → có phiên, launch được');
    if (MODE === 'real') t.eq((await papi(s2, '/portal/api/me')).status, 200, '… vào cổng (/portal/api/me 200)');
    await inspect(page, '17-dat-lai-link-cu', { expectStatus: 400 });
    if (MODE === 'mock') t.ok(await waitFor(() => crm.revokesReceived(K1.subject).some((x) => x.reason === 'dat_lai_mat_khau'), 5000), 'CRM nhận thu-hoi reason=dat_lai_mat_khau');
    // tao-link-dat-lai là API nội bộ: ký sai / thiếu requested_by / subject lạ / qua host công khai đều bị từ chối
    const P_ = '/api/internal/khach/tao-link-dat-lai';
    t.eq((await internalPost(cfg, P_, { subject: K1.subject, requested_by: 'x' }, { secret: 'y'.repeat(48) })).status, 401, 'tao-link-dat-lai ký sai → 401');
    t.eq((await internalPost(cfg, P_, { subject: K1.subject, requested_by: '' })).status, 400, 'thiếu requested_by → 400');
    t.eq((await internalPost(cfg, P_, { subject: 'cust:khong-co', requested_by: 'e2e' })).status, 404, 'subject lạ → 404');
    t.eq((await raw({ port: cfg.PROXY_PORT, method: 'POST', path: P_, hostHeader: cfg.KHACH_HOST, headers: { 'content-type': 'application/json' }, body: '{}' })).status, 404, 'qua host công khai → 404');
  });

  await check('FLOW-11b', 'Nhân viên cấp link đặt lại qua CRM (POST /api/portal/customers/:id/reset-link) → khách đặt lại ở /dat-lai; khoá cổng → 409; link không lưu trong DB/audit CRM', 'real', async (t) => {
    if (!process.env.CRM_RESET_LINK_ROUTE) t.pending('CRM_RESET_LINK_ROUTE chưa đặt (CRM chưa có route nhân viên cấp link đặt lại)');
    const before = await portalClient(K1);
    t.eq((await papi(before, '/portal/api/me')).status, 200, 'thiết bị đang dùng: có phiên cổng');
    const noReason = await crm.resetLink(K1.subject, { reason: null });
    t.ok(noReason.status === 400, `thiếu lý do → ${noReason.status} ${noReason.code || ''}`);
    const l = await crm.resetLink(K1.subject);
    if (l.status === 502 && l.code === 'VIPID_UNAVAILABLE') {
      throw new Error('CRM bug: POST /api/portal/customers/:id/reset-link → 502 VIPID_UNAVAILABLE dù VIP ID trả 200 — review.js đọc r.json.url, nhưng VIP ID trả {ok:true,data:{url,expires_at}} (phải đọc r.json.data.url). Hệ quả phụ: VIP ID ĐÃ cấp link mới (link cũ của khách bị huỷ) mà nhân viên không nhận được link; audit portal.customer.reset_link ghi outcome=denied, vipid_status=200');
    }
    t.ok(l.ok, `CRM cấp link (${l.status} ${l.code || ''})`);
    t.ok(l.url.startsWith(`${BASE}/tai-khoan/dat-lai?t=`), 'url trỏ về host khách công khai /tai-khoan/dat-lai?t=');
    t.eq(l.portal_code, K1.code, 'phản hồi kèm đúng portal_code');
    t.ok(/no-store/.test(l.headers['cache-control'] || ''), `Cache-Control: no-store (${l.headers['cache-control']})`);
    const tok = new URL(l.url).searchParams.get('t');
    const dump = spawnSync('pg_dump', ['-a', '-d', cfg.CRM_DB], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    t.ok(dump.status === 0 && !dump.stdout.includes(tok) && !dump.stdout.includes(l.url), 'token/url KHÔNG có trong DB CRM (pg_dump -a, gồm audit_log)');
    const logTxt = ['crm.log'].map((f) => { try { return fs.readFileSync(path.join(cfg.runDir, f), 'utf8'); } catch { return ''; } }).join('');
    t.ok(!logTxt.includes(tok), 'token không có trong log CRM');
    const c = new KhachClient(cfg);
    const g = await c.req('GET', `/tai-khoan/dat-lai?t=${tok}`);
    t.ok(g.status === 200 && formField(g.body, 't') === tok, 'GET /dat-lai hiện form (không tiêu)');
    const neu = 'Dat-Lai-Qua-CRM-2026&e';
    const p = await c.req('POST', '/tai-khoan/dat-lai', { form: { _csrf: formField(g.body, '_csrf'), t: tok, mat_khau: neu, mat_khau_2: neu } });
    t.ok(p.status === 200 && p.body.includes('Đã đặt mật khẩu mới'), 'POST /dat-lai → đã đặt mật khẩu mới');
    const oldPw = K1.pw; K1.pw = neu;
    t.eq((await new KhachClient(cfg).login(K1.phone, oldPw)).status, 401, 'mật khẩu cũ → 401');
    const ok = await new KhachClient(cfg).login(K1.phone, neu);
    t.ok(ok.status === 303 && /\/portal\/auth\/launch/.test(ok.headers.location || ''), 'mật khẩu mới → đăng nhập được');
    t.ok(!(await before.hasSession()), 'phiên VIP ID cũ bị thu hồi');
    t.ok(await waitFor(async () => (await papi(before, '/portal/api/me')).status === 401, 15_000), 'phiên cổng CRM cũ bị thu hồi');
    t.eq((await c.req('GET', `/tai-khoan/dat-lai?t=${tok}`)).status, 400, 'dùng lại link → 400');
    // (owner) sau đặt lại: đăng xuất rồi đăng nhập lại bằng mật khẩu MỚI
    const s1 = await portalClient(K1, neu);
    t.eq((await papi(s1, '/portal/api/me')).status, 200, 'đăng nhập bằng mật khẩu mới → vào cổng');
    const lo = await s1.logout();
    t.ok(lo.post?.status === 303 && !(await s1.hasSession()), 'đăng xuất (trang xác nhận VIP ID)');
    const s2 = await portalClient(K1, neu);
    t.eq((await papi(s2, '/portal/api/me')).status, 200, 'đăng nhập LẠI bằng mật khẩu mới sau khi đăng xuất → vào cổng');
  });

  await check('FLOW-11c', 'CRM từ chối cấp link đặt lại khi khách đang bị khoá cổng (409 CUSTOMER_INACTIVE); thiếu lý do → 400', 'real', async (t) => {
    if (!process.env.CRM_RESET_LINK_ROUTE) t.pending('CRM_RESET_LINK_ROUTE chưa đặt');
    await ensureSeed(t);
    const nr = await crm.resetLink(P.K2.subject, { reason: null });
    t.ok(nr.status === 400, `thiếu lý do → ${nr.status} ${nr.code || ''}`);
    const K2 = P.K2;
    t.eq((await crm.lock(K2.subject, 'khoa')).status, 200, 'khoá cổng K2');
    try {
      const lk = await crm.resetLink(K2.subject);
      t.ok(lk.status === 409 && lk.code === 'CUSTOMER_INACTIVE', `khách đang khoá → ${lk.status} ${lk.code || ''}`);
    } finally {
      t.eq((await crm.lock(K2.subject, 'mo_khoa')).status, 200, 'mở lại cổng K2');
    }
  });

  await check('FLOW-14', 'Trang hồ sơ /tai-khoan/ho-so: tên, mã VG, SĐT che bớt (390px)', 'both', async (t) => {
    const ctxC = await newCtx(); extraEvents.push(ctxC._e2eEvents);
    const pc = await ctxC.newPage();
    try {
      await loginBrowser(pc, K1.phoneLocal, K1.pw);
      await pc.goto(`${BASE}/tai-khoan/ho-so`);
      t.eq(await textOf(pc, 'h1'), K1.name, 'h1 = tên khách');
      const body = await pc.locator('main').innerText();
      t.ok(body.includes(K1.code), `hiện mã khách ${K1.code}`);
      t.ok(!body.includes(K1.phone) && !body.includes(K1.phoneLocal) && /\+8490\*{4}\d{3}/.test(body), 'SĐT bị che (+8490****xxx), không lộ đầy đủ');
      await inspect(pc, '19-ho-so');
      const anon = await raw({ port: cfg.PROXY_PORT, path: '/tai-khoan/ho-so', hostHeader: cfg.KHACH_HOST });
      t.ok(anon.status === 303 && anon.headers.location === '/tai-khoan/dang-nhap', 'không phiên → 303 đăng nhập');
    } finally { await closeCtx(ctxC); }
  });

  await check('FLOW-13', 'Đổi mật khẩu khi đã đăng nhập: MK cũ hỏng, MK mới dùng được, thiết bị khác bị đăng xuất, phiên cổng kết thúc, vào lại qua vao-cong được', 'both', async (t) => {
    const other = await portalClient(K1);
    if (MODE === 'real') t.eq((await papi(other, '/portal/api/me')).status, 200, 'thiết bị khác: có phiên cổng');
    t.ok(await other.hasSession(), 'thiết bị khác: có phiên VIP ID');
    const ctxC = await newCtx(); extraEvents.push(ctxC._e2eEvents);
    const pc = await ctxC.newPage();
    try {
      await loginBrowser(pc, K1.code, K1.pw);
      const r0 = await pc.goto(`${BASE}/tai-khoan/doi-mat-khau`);
      t.eq(r0.status(), 200, 'trang đổi mật khẩu 200');
      await inspect(pc, '20-doi-mat-khau');
      await pc.fill('input[name=mat_khau_cu]', 'sai-mat-khau-hien-tai-1');
      await pc.fill('input[name=mat_khau]', PW3); await pc.fill('input[name=mat_khau_2]', PW3);
      await pc.click('form[action="/tai-khoan/doi-mat-khau"] button[type=submit]');
      await pc.waitForSelector('text=Mật khẩu hiện tại không đúng.');
      await inspect(pc, '21-doi-mat-khau-sai', { expectStatus: 400 });
      await pc.fill('input[name=mat_khau_cu]', K1.pw);
      await pc.fill('input[name=mat_khau]', PW3); await pc.fill('input[name=mat_khau_2]', PW3);
      await Promise.all([pc.waitForURL(/\/tai-khoan\/ho-so\?da_doi=1$/), pc.click('form[action="/tai-khoan/doi-mat-khau"] button[type=submit]')]);
      await inspect(pc, '22-doi-mat-khau-xong');
      const oldPw = K1.pw; K1.pw = PW3;
      const a = await new KhachClient(cfg).login(K1.phone, oldPw);
      t.ok(a.status === 401, `mật khẩu cũ → ${a.status}`);
      const b = await new KhachClient(cfg).login(K1.phone, PW3);
      t.ok(b.status === 303 && /\/portal\/auth\/launch/.test(b.headers.location || ''), 'mật khẩu mới → đăng nhập được');
      t.ok(!(await other.hasSession()), 'thiết bị khác: phiên VIP ID bị thu hồi');
      if (MODE === 'real') t.ok(await waitFor(async () => (await papi(other, '/portal/api/me')).status === 401, 10_000), 'thiết bị khác: phiên cổng CRM kết thúc (thu-hoi)');
      else t.ok(await waitFor(() => crm.revokesReceived(K1.subject).some((x) => x.reason === 'doi_mat_khau'), 5000), 'CRM giả nhận thu-hoi reason=doi_mat_khau');
      await pc.goto(`${BASE}/tai-khoan/vao-cong`);
      if (MODE === 'real') {
        await pc.waitForURL(/\/portal\//); await pc.waitForSelector('#portal-code');
        t.eq(await textOf(pc, '#portal-code'), K1.code, 'trình duyệt đổi mật khẩu: vao-cong → vào lại cổng');
      } else t.ok(/\/portal\/auth\/launch\?token=/.test(pc.url()) && (await pc.content()).includes('launch hợp lệ'), 'trình duyệt đổi mật khẩu: vao-cong → launch được (phiên mới)');
    } finally { await closeCtx(ctxC); }
  });

  // ════════════ BẢO MẬT ════════════
  async function ensureSeed(t) {
    if (seedCache) return seedCache;
    // K1 duyệt trước (VG000001 trên DB mới), K2 duyệt sau (VG000002); seed bằng scripts/portal-dev-seed.js của CRM
    const K2 = P.K2 || await makeApproved('K2', 2, 'Trần Thị Hai');
    const a = crm.seedParcels(K1.code, 5);
    const b = crm.seedParcels(K2.code, 3);
    seedCache = { K1: a.created.map((x) => x.tracking_no), K1_PENDING: [a.pending_unowned], K2: b.created.map((x) => x.tracking_no), K2_PENDING: [b.pending_unowned] };
    t.note(`seed: K1=${K1.code} ${seedCache.K1.length} kiện, K2=${K2.code} ${seedCache.K2.length} kiện`);
    return seedCache;
  }

  async function makeRegistered(key, i, name, { phoneLocal } = {}) {
    const u = mk(key, i, name);
    if (phoneLocal) { u.phoneLocal = phoneLocal; u.phone = '+84' + phoneLocal.slice(1); }
    const c = new KhachClient(cfg);
    const r = await c.register({ name, phone: u.phoneLocal, email: u.email });
    if (r.status !== 303 || r.headers.location !== '/tai-khoan/cho-duyet') throw new Error(`đăng ký ${key} → ${r.status} ${r.headers.location || ''}`);
    u.subject = account(cfg, 'phone_e164=?', [u.phone])[0].subject;
    u.client = c;
    return u;
  }
  async function makeApproved(key, i, name) {
    const u = await makeRegistered(key, i, name);
    const r = await crm.approve({ phone: u.phone, subject: u.subject, portalCode: u.code });
    noteBlocked(r);
    if (!r.ok) throw new Error(`duyệt ${key} thất bại: ${r.out}`);
    u.code = r.portalCode || u.code;
    return u;
  }

  await check('SEC-01', 'K1 không thấy kiện K2: danh sách + tra cứu mã K2/kiện chưa rõ chủ → 404 giống hệt mã không tồn tại (hai chiều)', 'real', async (t) => {
    const seed = await ensureSeed(t);
    const c1 = await portalClient(K1);
    const c2 = await portalClient(P.K2);
    const sameNotFound = async (c, label, trk) => {
      const a = await papi(c, `/portal/api/parcels/search?tracking=${encodeURIComponent(trk)}`);
      const z = await papi(c, `/portal/api/parcels/search?tracking=E2E-KHONG-TON-TAI-${RUN}`);
      t.eq(a.status, 404, `${label}: tra ${trk} → 404`);
      t.eq(a.body, z.body, `${label}: thân 404 giống hệt mã không tồn tại`);
      const h = (r) => JSON.stringify(Object.fromEntries(Object.entries(r.headers).filter(([k]) => !['date', 'content-length', 'x-request-id', 'connection', 'keep-alive'].includes(k)).sort()));
      t.eq(h(a), h(z), `${label}: header 404 giống hệt (trừ date/request-id)`);
    };
    await sameNotFound(c1, 'K1→K2', seed.K2[0]);
    await sameNotFound(c2, 'K2→K1', seed.K1[0]);
    await sameNotFound(c1, 'K1→kiện chưa rõ chủ', seed.K1_PENDING[0]);
    const own = await papi(c1, `/portal/api/parcels/search?tracking=${encodeURIComponent(seed.K1[0])}`);
    t.eq(own.status, 200, 'đối chứng: K1 tra kiện của mình → 200');
    const l1 = (await papi(c1, '/portal/api/parcels')).json.items.map((x) => x.tracking_no).sort();
    const l2 = (await papi(c2, '/portal/api/parcels')).json.items.map((x) => x.tracking_no).sort();
    t.eq(JSON.stringify(l1), JSON.stringify([...seed.K1].sort()), 'danh sách K1 = đúng kiện đã xác nhận của K1');
    t.eq(JSON.stringify(l2), JSON.stringify([...seed.K2].sort()), 'danh sách K2 = đúng kiện đã xác nhận của K2');
    const inj = await papi(c1, `/portal/api/parcels?customer_id=${encodeURIComponent('00000000-0000-0000-0000-000000000000')}&tenant_id=x`);
    t.eq(JSON.stringify(inj.json.items.map((x) => x.tracking_no).sort()), JSON.stringify(l1), 'tham số customer_id/tenant_id lạ bị bỏ qua (phạm vi lấy từ phiên)');
    const me2 = await papi(c2, '/portal/api/me');
    t.eq(me2.json.portal_code, P.K2.code, '/me của K2 đúng mã K2');
  });

  await check('SEC-02', 'Khách đại lý K3 (A1): trùng SĐT → không tự liên kết; nhân viên "liên kết hồ sơ có sẵn" giữ mã K3-A1 + cấp mã VG; cách ly kiện với K1/K2', 'real', async (t) => {
    const seed = await ensureSeed(t);
    const ag = crm.agentCustomer('+84900000003');
    t.ok(ag.tenant === 'A1' && ag.customer_id, `seed khách đại lý A1 ${ag.code} có SĐT +84900000003 (trước khi K3 đăng ký)`);
    const K3 = await makeRegistered('K3', 3, 'Khách Đại Lý Ba', { phoneLocal: '0900000003' });
    const sg = await waitFor(async () => !!(await crm.findSignup(K3.subject)), 10_000) && await crm.findSignup(K3.subject);
    t.ok(sg, 'CRM nhận signup của K3');
    const det = await crm.signupDetail(sg.id);
    t.ok((det.json?.duplicates?.customers || []).some((x) => x.id === ag.customer_id), 'màn duyệt hiện trùng SĐT với khách đại lý K3-A1');
    t.ok(det.json.status === 'cho_duyet' && !det.json.customer_id && !det.json.linked_customer_id, 'KHÔNG tự liên kết (signup vẫn chờ duyệt)');
    const ap = await crm.approve({ subject: K3.subject });
    t.ok(!ap.ok && ap.status === 409 && ap.code === 'DUPLICATE_CUSTOMER', `"duyệt tạo mới" khi trùng SĐT bị chặn (${ap.status} ${ap.code})`);
    t.eq(account(cfg, 'subject=?', [K3.subject])[0].status, 'cho_duyet', 'VIP ID: K3 vẫn chờ duyệt');
    const ln = await crm.link({ subject: K3.subject, customerId: ag.customer_id });
    t.ok(ln.ok, `nhân viên liên kết hồ sơ có sẵn (${ln.out || 'ok'})`);
    t.eq(ln.customer.code, 'K3-A1', 'giữ mã nội bộ cũ K3-A1');
    t.ok(CODE_RE.test(ln.portalCode) && codeNum(ln.portalCode) > codeNum(P.K2.code) && ![K1.code, P.K2.code].includes(ln.portalCode), `cấp thêm mã VG riêng (${ln.portalCode})`);
    K3.code = ln.portalCode;
    t.eq(account(cfg, 'subject=?', [K3.subject])[0].portal_code, K3.code, 'VIP ID nhận đúng mã VG của K3');
    const s3 = crm.seedParcels(K3.code, 2);
    const t3 = s3.created.map((x) => x.tracking_no);
    const c3 = await portalClient(K3);
    const me = await papi(c3, '/portal/api/me');
    t.ok(me.status === 200 && me.json.tenant_code === 'A1' && me.json.portal_code === K3.code, `K3 đăng nhập bằng SĐT, /me tenant A1 + ${K3.code}`);
    const c3b = new KhachClient(cfg);
    const lr = await c3b.login(K3.code, PW_STRONG);
    t.ok(lr.status === 303 && /\/portal\/auth\/launch/.test(lr.headers.location || ''), 'K3 đăng nhập bằng mã VG');
    const c3c = new KhachClient(cfg);
    t.ok((await c3c.login('K3-A1', PW_STRONG)).status === 401, 'mã nội bộ đại lý K3-A1 KHÔNG dùng làm tên đăng nhập');
    const l3 = (await papi(c3, '/portal/api/parcels')).json.items.map((x) => x.tracking_no).sort();
    t.eq(JSON.stringify(l3), JSON.stringify([...t3].sort()), 'K3 chỉ thấy kiện của mình (không thấy kiện khách khác của A1 / tenant VIP)');
    const c1 = await portalClient(K1);
    for (const [c, who, trk] of [[c3, 'K3→K1', seed.K1[0]], [c3, 'K3→K2', seed.K2[0]], [c1, 'K1→K3', t3[0]]]) {
      t.eq((await papi(c, `/portal/api/parcels/search?tracking=${encodeURIComponent(trk)}`)).status, 404, `${who}: tra ${trk} → 404`);
    }
    t.ok(!(await papi(c1, '/portal/api/parcels')).json.items.some((x) => t3.includes(x.tracking_no)), 'danh sách K1 không có kiện K3');
  });

  await check('SEC-03a', 'Không trùng mã VG phía VIP ID: duyệt lặp idempotent, mã/crm_customer_id đã dùng → 409', 'both', async (t) => {
    const D1 = await makeRegistered('D1', 11, 'Lê Văn Một');
    const D2 = await makeRegistered('D2', 12, 'Phạm Thị Hai');
    const path_ = '/api/internal/khach/ket-qua-duyet';
    let seq = 0; // thân khác nhau mỗi lần (cùng giây + cùng thân = cùng chữ ký ⇒ VIP ID coi là phát lại, đúng thiết kế)
    const ap = (u, code, crmId) => internalPost(cfg, path_, { subject: u.subject, decision: 'approved', crm_customer_id: crmId, portal_code: code, customer_code: code, phone_verified_by: 'e2e', e2e_seq: ++seq });
    const r1 = await ap(D1, D1.code, `e2e-${RUN}-d1`);
    t.eq(r1.status, 200, 'duyệt D1 → 200');
    const r2 = await ap(D1, D1.code, `e2e-${RUN}-d1`);
    t.ok(r2.status === 200 && r2.json?.data?.idempotent === true, 'duyệt lặp cùng dữ liệu → 200 idempotent');
    const r3 = await ap(D1, D2.code, `e2e-${RUN}-d1`);
    t.eq(r3.status, 409, 'duyệt lại D1 với mã khác → 409');
    const r4 = await ap(D2, D1.code, `e2e-${RUN}-d2`);
    t.eq(r4.status, 409, 'D2 nhận mã VG của D1 → 409');
    const r5 = await ap(D2, D2.code, `e2e-${RUN}-d1`);
    t.eq(r5.status, 409, 'D2 nhận crm_customer_id của D1 → 409');
    t.eq(account(cfg, 'subject=?', [D2.subject])[0].status, 'cho_duyet', 'D2 vẫn cho_duyet sau các lần bị từ chối');
    const cli = vipidCli(cfg, ['khach-duyet-dev', D2.subject, '--portal-code', K1.code]);
    t.ok(cli.code !== 0 && /409/.test(cli.out), 'khach-duyet-dev với mã của K1 → 409');
    const codes = sqlRead(cfg, 'SELECT portal_code, COUNT(*) n FROM customer_accounts WHERE portal_code IS NOT NULL GROUP BY portal_code HAVING n>1');
    t.eq(codes.length, 0, 'không có portal_code trùng trong DB VIP ID');
    const r6 = await ap(D2, D2.code, `e2e-${RUN}-d2`);
    t.eq(r6.status, 200, 'D2 với mã + crm id riêng → 200');
  });

  await check('SEC-03b', 'Không trùng mã VG phía CRM: duyệt đồng thời nhiều đăng ký → mã khác nhau; duyệt lại cùng đăng ký không cấp mã mới', 'real', async (t) => {
    const us = [];
    for (let i = 0; i < 5; i++) us.push(await makeRegistered(`C${i}`, 30 + i, `Khách Đồng Thời ${i}`));
    const before = crmSql(cfg, 'SELECT portal_code FROM customers WHERE portal_code IS NOT NULL').map(codeNum);
    const rs = await Promise.all(us.map((u) => crm.approve({ phone: u.phone, subject: u.subject })));
    const codes = rs.map((r) => r.portalCode);
    t.ok(codes.every((c) => CODE_RE.test(c)), `mã đúng quy tắc ${CODE_RULE}: ${codes.join(',')}`);
    t.ok(Math.min(...codes.map(codeNum)) > Math.max(...before), 'mã mới lớn hơn mọi mã đã cấp (tăng dần)');
    const s1 = await makeRegistered('C5', 35, 'Khách Tuần Tự 1'); const s2 = await makeRegistered('C6', 36, 'Khách Tuần Tự 2');
    const q1 = await crm.approve({ subject: s1.subject }); const q2 = await crm.approve({ subject: s2.subject });
    t.ok(q1.ok && q2.ok && codeNum(q2.portalCode) > codeNum(q1.portalCode), `duyệt tuần tự: mã tăng dần (${q1.portalCode} < ${q2.portalCode})`);
    t.ok(rs.every((r) => r.ok), 'mọi lần duyệt thành công');
    t.eq(new Set(codes).size, codes.length, 'mã VG khác nhau');
    const again = await crm.approve({ phone: us[0].phone, subject: us[0].subject });
    t.ok(!again.ok && again.status === 409, `duyệt lại đăng ký đã duyệt bị từ chối (${again.status} ${again.code || ''})`);
    t.eq(crmSql(cfg, "SELECT count(*) FROM (SELECT portal_code FROM customers WHERE portal_code IS NOT NULL GROUP BY portal_code HAVING count(*)>1) d")[0], '0', 'CRM DB: không portal_code trùng');
    t.eq(new Set(us.map((u) => account(cfg, 'subject=?', [u.subject])[0].portal_code)).size, us.length, 'VIP ID nhận đúng 5 mã khác nhau');
  });

  await check('SEC-04', 'Trùng SĐT: đăng ký lần 2 cùng SĐT không chiếm tài khoản, phản hồi giống hệt, gửi cờ xung đột; bị từ chối thì SĐT được giải phóng', 'both', async (t) => {
    const PC = await makeRegistered('PC', 6, 'Chủ Thật Số Sáu');
    t.ok(await waitFor(async () => (await crm.signupsReceived(PC.subject)).length > 0, 12_000), 'CRM nhận signup của chủ thật');
    const attackerEmail = `ke-gia-${RUN}@example.test`;
    const fresh = await new KhachClient(cfg).register({ name: 'Người Mới', phone: synth(RUN, 40).phoneLocal, email: `moi-${RUN}@example.test` });
    const att = new KhachClient(cfg);
    const r = await att.register({ name: 'Kẻ Giả Danh', phone: `+84 ${PC.phone.slice(3, 6)} ${PC.phone.slice(6)}`, email: attackerEmail, password: 'Ke-Gia-Danh-2026!!' });
    t.ok(r.status === fresh.status && r.headers.location === fresh.headers.location, `phản hồi giống hệt đăng ký mới (${r.status} → ${r.headers.location})`);
    t.eq(account(cfg, 'email_norm=?', [attackerEmail]).length, 0, 'không tạo tài khoản cho kẻ giả');
    const acc = account(cfg, 'subject=?', [PC.subject])[0];
    t.ok(acc.email_norm === PC.email && acc.status === 'cho_duyet' && acc.phone_e164 === PC.phone, 'tài khoản chủ thật không đổi (email, trạng thái, SĐT)');
    t.eq(acc.phone_conflict_count, 1, 'phone_conflict_count = 1');
    const ok = await waitFor(async () => (await crm.signupsReceived(PC.subject)).some((x) => x.phone_conflict === true), 12_000);
    t.ok(ok, `CRM (${crm.kind}) nhận bản signup cập nhật phone_conflict=true`);
    if (MODE === 'mock') {
      const last = crm.signupsReceived(PC.subject).at(-1);
      t.ok(last.phone_conflict_count === 1 && last.email === PC.email && last.display_name === PC.name, 'bản cập nhật giữ tên + email chủ thật (không lấy dữ liệu kẻ giả), count=1');
    }
    const lg = await att.login(PC.phone, 'Ke-Gia-Danh-2026!!');
    t.ok(lg.status === 401 && lg.body.includes('Thông tin đăng nhập không đúng'), 'kẻ giả đăng nhập SĐT đó bằng mật khẩu của mình → 401 thông báo chung');
    const rj = await crm.reject({ phone: PC.phone, subject: PC.subject });
    t.ok(rj.ok, 'nhân viên từ chối đăng ký (giả định: chủ không xác nhận được)');
    const after = account(cfg, 'subject=?', [PC.subject])[0];
    t.ok(after.status === 'tu_choi' && after.phone_e164.startsWith('released:'), 'tài khoản bị từ chối → SĐT được giải phóng');
    const r2 = await new KhachClient(cfg).register({ name: 'Chủ Thật Đăng Ký Lại', phone: PC.phoneLocal, email: '' });
    t.ok(r2.status === 303 && r2.headers.location === '/tai-khoan/cho-duyet', 'đăng ký lại cùng SĐT → 303 chờ duyệt');
    const neu = account(cfg, 'phone_e164=?', [PC.phone])[0];
    t.ok(neu && neu.status === 'cho_duyet' && neu.subject !== PC.subject && neu.phone_conflict_count === 0, 'SĐT gắn tài khoản mới (subject mới), chờ duyệt, không cờ xung đột');
    t.ok(await waitFor(async () => (await crm.signupsReceived(neu.subject)).length > 0, 12_000), 'CRM nhận signup mới cho SĐT đã giải phóng');
  });

  // Phiên nhân viên VIP ID (để kiểm tách realm)
  let staffJar = null;
  async function staffSession(t) {
    if (staffJar) return staffJar;
    needsStart(t);
    const pw = 'Nhan-Vien-E2E-2026!x';
    const cr = vipidCli(cfg, ['create-owner', '--id', `e2e-owner-${RUN}`, '--name', 'E2E Owner'], { E2E_OWNER_PW: pw, COWORK_OWNER_PASSWORD: pw });
    if (cr.code !== 0) throw new Error(`create-owner lỗi: ${cr.err || cr.out}`);
    const jar = {};
    const g = await raw({ port: cfg.VIPID_PORT, path: '/dang-nhap', hostHeader: cfg.STAFF_HOST });
    absorb(jar, g.setCookies);
    const csrf = formField(g.body, '_csrf') || jar.cowork_csrf;
    const p = await raw({ port: cfg.VIPID_PORT, method: 'POST', path: '/dang-nhap', hostHeader: cfg.STAFF_HOST,
      headers: { cookie: cookieHeader(jar), 'content-type': 'application/x-www-form-urlencoded', origin: `http://${cfg.STAFF_HOST}` },
      body: new URLSearchParams({ _csrf: csrf, userId: `e2e-owner-${RUN}`, matKhau: pw, next: '/' }).toString() });
    absorb(jar, p.setCookies);
    if (!jar.cowork_session) throw new Error(`không đăng nhập được nhân viên: ${p.status} ${p.headers.location || ''}`);
    staffJar = jar;
    return jar;
  }

  await check('SEC-05a', 'Không phiên / cookie giả → không vào được (VIP ID) ; /api/internal/* qua host công khai → 404', 'both', async (t) => {
    const go = (p, headers = {}, method = 'GET') => raw({ port: cfg.PROXY_PORT, method, path: p, hostHeader: cfg.KHACH_HOST, headers });
    let r = await go('/tai-khoan/vao-cong');
    t.ok(r.status === 303 && r.headers.location === '/tai-khoan/dang-nhap', 'vao-cong không cookie → 303 đăng nhập');
    r = await go('/tai-khoan/vao-cong', { cookie: 'vg_khach=' + 'A'.repeat(43) });
    t.ok(r.status === 303 && r.headers.location === '/tai-khoan/dang-nhap', 'vao-cong cookie giả → 303 đăng nhập');
    r = await go('/tai-khoan/dang-nhap', { cookie: 'vg_khach=forged; vg_khach_tb=forged.1.2.3.4' });
    t.ok(r.status === 200 && formField(r.body, 'dinh_danh') !== undefined && !r.body.includes('Xin chào'), 'trang đăng nhập với cookie giả → chưa đăng nhập');
    for (const p of ['/api/internal/khach/ket-qua-duyet', '/api/internal/khach/tam-khoa', '/api/internal/khach/thu-hoi', '/api/internal/portal/signups', '/api/internal/portal/thu-hoi', '/api/internal/', '/API/internal/khach/thu-hoi', '/api/internal%2Fkhach/thu-hoi']) {
      const rp = await raw({ port: cfg.PROXY_PORT, method: 'POST', path: p, hostHeader: cfg.KHACH_HOST, headers: { 'content-type': 'application/json' }, body: '{}' });
      t.ok(rp.status === 404, `POST ${p} qua host công khai → ${rp.status}`);
    }
    r = await raw({ port: cfg.PROXY_PORT, path: '/tai-khoan/dang-nhap', hostHeader: 'evil.example' });
    t.eq(r.status, 421, 'proxy: Host lạ → 421');
    r = await raw({ port: cfg.VIPID_PORT, path: '/tai-khoan/dang-nhap', hostHeader: 'evil.example' });
    t.eq(r.status, 421, 'VIP ID: Host lạ → 421');
    const ni = await internalPost(cfg, '/api/internal/khach/thu-hoi', { subject: K1.subject, reason: 'x' }, { noSig: true, noTs: true });
    t.eq(ni.status, 401, 'VIP ID internal không chữ ký → 401');
  });

  await check('SEC-05b', 'CRM portal API (/portal/api/*) không phiên / vg_portal giả / cookie & Bearer nhân viên / cookie VIP ID → 401; ghi không CSRF → chặn', 'real', async (t) => {
    const staffTok = await crm.login();
    const variants = [['không cookie', {}], ['vg_portal giả', { cookie: 'vg_portal=' + 'B'.repeat(43) }], ['cookie nhân viên vip_session', { cookie: `vip_session=${staffTok}` }],
      ['Bearer nhân viên', { authorization: `Bearer ${staffTok}` }], ['token nhân viên làm vg_portal', { cookie: `vg_portal=${staffTok}` }], ['cookie VIP ID khách', { cookie: 'vg_khach=x' }]];
    for (const p of ['/portal/api/me', '/portal/api/parcels', '/portal/api/parcels/search?tracking=X', '/portal/api/warehouses']) {
      for (const [label, headers] of variants) {
        const r = await raw({ port: cfg.PROXY_PORT, path: p, hostHeader: cfg.KHACH_HOST, headers });
        t.ok(r.status === 401, `${p} ${label} → ${r.status}`);
      }
    }
    const c1 = await portalClient(K1);
    const vp = c1.jar.vg_portal;
    const lo = await raw({ port: cfg.PROXY_PORT, method: 'POST', path: '/portal/api/logout', hostHeader: cfg.KHACH_HOST, headers: { cookie: `vg_portal=${vp}`, 'content-type': 'text/plain', origin: 'https://evil.example' }, body: '{}' });
    t.eq(lo.status, 403, 'POST /portal/api/logout từ Origin lạ, không JSON/X-Requested-With → 403 (CSRF)');
    t.eq((await papi(c1, '/portal/api/me')).status, 200, '… phiên vẫn còn (không bị đăng xuất hộ)');
  });

  await check('SEC-06a', 'Tách realm VIP ID: cookie khách trên host nhân viên và cookie nhân viên trên host khách đều vô hiệu', 'both', async (t) => {
    const kc = new KhachClient(cfg);
    const lr = await kc.login(K1.phone, K1.pw);
    t.ok(lr.status === 303 && /\/portal\/auth\/launch/.test(lr.headers.location || ''), 'K1 đăng nhập (lấy vg_khach thật)');
    const kcookie = cookieHeader(kc.jar);
    const staff = (p, cookie) => raw({ port: cfg.VIPID_PORT, path: p, hostHeader: cfg.STAFF_HOST, headers: cookie ? { cookie } : {} });
    let r = await staff('/tai-khoan/vao-cong', kcookie);
    t.eq(r.status, 404, 'host nhân viên: /tai-khoan/* không tồn tại (404) dù có vg_khach');
    r = await staff('/', kcookie);
    t.ok(r.status === 303 && /\/dang-nhap/.test(r.headers.location || ''), 'host nhân viên: vg_khach không phải phiên nhân viên (303 /dang-nhap)');
    const sj = await staffSession(t);
    const scookie = cookieHeader(sj);
    r = await staff('/', scookie);
    t.eq(r.status, 200, 'đối chứng: cookie nhân viên hợp lệ trên host nhân viên → 200');
    const kh = (p, cookie) => raw({ port: cfg.PROXY_PORT, path: p, hostHeader: cfg.KHACH_HOST, headers: cookie ? { cookie } : {} });
    for (const p of ['/', '/dang-nhap', '/ho-so', '/quan-tri']) {
      r = await kh(p, scookie);
      t.ok(r.status === 404, `host khách: route nhân viên ${p} với cookie nhân viên → ${r.status}`);
    }
    r = await kh('/tai-khoan/vao-cong', scookie);
    t.ok(r.status === 303 && r.headers.location === '/tai-khoan/dang-nhap', 'host khách: cookie nhân viên không mở phiên khách');
    r = await raw({ port: cfg.VIPID_PORT, path: '/tai-khoan/dang-nhap', hostHeader: cfg.KHACH_HOST_DIRECT, headers: { cookie: scookie } });
    t.ok(r.status === 200 && !r.body.includes('Xin chào'), 'host khách trực tiếp: cookie nhân viên → chưa đăng nhập');
    const sc = lr.setCookies.find((s) => s.startsWith('vg_khach='));
    t.ok(/Path=\/tai-khoan/i.test(sc) && /HttpOnly/i.test(sc) && /SameSite=lax/i.test(sc) && !/Domain=/i.test(sc), 'Set-Cookie vg_khach: Path=/tai-khoan; HttpOnly; SameSite=Lax; không Domain');
  });

  await check('SEC-06b', 'Tách realm CRM: vg_portal của khách trên API nhân viên CRM → 401; phiên nhân viên trên /portal/api → 401; route chéo host → 404', 'real', async (t) => {
    const c1 = await portalClient(K1);
    const vp = c1.jar.vg_portal;
    t.ok(vp, 'có vg_portal của K1');
    const staffApi = async (p, headers) => (await crm.api('GET', p, undefined, { token: null, headers })).status;
    for (const [label, headers] of [['cookie vg_portal', { cookie: `vg_portal=${vp}` }], ['token khách làm vip_session', { cookie: `vip_session=${vp}` }], ['token khách làm Bearer', { authorization: `Bearer ${vp}` }]]) {
      for (const p of ['/api/me', '/api/portal/signups']) {
        const st = await staffApi(p, headers);
        t.ok(st === 401, `host nhân viên CRM ${p} với ${label} → ${st}`);
      }
    }
    const staffTok = await crm.login();
    t.eq(await staffApi('/api/me', { authorization: `Bearer ${staffTok}` }), 200, 'đối chứng: Bearer nhân viên trên host nhân viên → 200');
    const onPortalHost = await raw({ port: cfg.CRM_PORT, path: '/api/me', hostHeader: cfg.KHACH_HOST, headers: { authorization: `Bearer ${staffTok}` } });
    t.eq(onPortalHost.status, 404, 'CRM trực tiếp, Host cổng: /api/me (route nhân viên) → 404');
    const sig = await raw({ port: cfg.CRM_PORT, method: 'POST', path: '/api/internal/portal/signups', hostHeader: cfg.KHACH_HOST, headers: { 'content-type': 'application/json' }, body: '{}' });
    t.eq(sig.status, 404, 'CRM trực tiếp, Host cổng: /api/internal/portal/* → 404');
    for (const target of [`http://${cfg.KHACH_HOST}/api/me`, `http://127.0.0.1:${cfg.CRM_PORT}/api/me`, `http://${cfg.KHACH_HOST}/api/internal/portal/signups`]) {
      const ab = await raw({ port: cfg.CRM_PORT, path: target, hostHeader: cfg.KHACH_HOST, headers: { authorization: `Bearer ${staffTok}` } });
      t.eq(ab.status, 404, `Host cổng + request-target tuyệt đối ${target} → 404`);
    }
    const portalOnStaff = await raw({ port: cfg.CRM_PORT, path: '/portal/api/me', hostHeader: `127.0.0.1:${cfg.CRM_PORT}`, headers: { cookie: `vg_portal=${vp}` } });
    t.eq(portalOnStaff.status, 404, 'host nhân viên CRM: /portal/api/me (kể cả có vg_portal) → 404');
    const launchOnStaff = await raw({ port: cfg.CRM_PORT, path: '/portal/auth/launch?token=x', hostHeader: `127.0.0.1:${cfg.CRM_PORT}` });
    t.eq(launchOnStaff.status, 404, 'host nhân viên CRM: /portal/auth/launch → 404');
    const sc = (c1.launch.setCookies || []).find((x) => x.startsWith('vg_portal='));
    t.ok(/HttpOnly/i.test(sc) && /SameSite=Strict/i.test(sc) && /Path=\//i.test(sc) && !/Domain=/i.test(sc), 'Set-Cookie vg_portal: HttpOnly; SameSite=Strict; Path=/; không Domain');
  });

  await check('SEC-06c', 'Khách không dùng được CRM nhân viên: (a) tài khoản khách do VIP ID tạo không đăng nhập local; (c) khách cũ có mật khẩu local: mặc định được phép, STAFF_HOST_ALLOW_LEGACY_CUSTOMERS=0 → 403', 'real', async (t) => {
    needsStart(t);
    const legacy = async () => {
      const r = await crm.api('POST', '/api/auth/login', { username: 'khach.x', password: crm.password() }, { token: null });
      if (r.status !== 200) return { login: r.status };
      const me = await crm.api('GET', '/api/me', undefined, { token: r.json.token });
      return { login: 200, me: me.status, code: me.json?.error?.code };
    };
    const d = await legacy();
    t.ok(d.login === 200 && d.me === 200, `(c) mặc định (STAFF_HOST_ALLOW_LEGACY_CUSTOMERS không đặt): khách cũ khach.x dùng host nhân viên → login ${d.login}, /api/me ${d.me}`);
    await stack.stopCrm();
    stack.crmExtra = { STAFF_HOST_ALLOW_LEGACY_CUSTOMERS: '0' };
    try {
      await stack.startCrm();
      await waitFor(async () => (await crm.api('GET', '/api/health', undefined, { token: null })).status < 500, 10_000);
      const z = await legacy();
      t.ok(z.login !== 200 || (z.me === 403 && z.code === 'CUSTOMER_ON_STAFF_HOST'), `(c) STAFF_HOST_ALLOW_LEGACY_CUSTOMERS=0: khách cũ khach.x → login ${z.login}, /api/me ${z.me} ${z.code || ''}`);
      const st = await crm.api('GET', '/api/me', undefined, { token: await crm.login() });
      t.eq(st.status, 200, 'đối chứng: nhân viên vip.admin vẫn dùng được (200)');
      const c1 = await portalClient(K1);
      t.eq((await crm.api('GET', '/api/me', undefined, { token: null, headers: { cookie: `vg_portal=${c1.jar.vg_portal}` } })).status, 401, '(b) vg_portal trên API nhân viên → 401 (chế độ =0)');
    } finally {
      await stack.stopCrm();
      stack.crmExtra = {};
      await stack.startCrm();
    }
    const uname = crmSql(cfg, `SELECT username FROM users WHERE vip_subject='${K1.subject}' AND kind='customer'`)[0];
    t.ok(uname, `CRM có user kind=customer cho K1 (${uname})`);
    t.eq(crmSql(cfg, `SELECT (password_hash IS NULL)::text FROM users WHERE username='${uname}'`)[0], 'true', 'user khách do VIP ID tạo: password_hash NULL');
    for (const [label, pw] of [['mật khẩu VIP ID của khách', K1.pw || PW_STRONG], ['mật khẩu dev seed', crm.password()], ['chuỗi rỗng', '']]) {
      const r = await crm.api('POST', '/api/auth/login', { username: uname, password: pw }, { token: null });
      t.ok(r.status === 401 || r.status === 400, `(a) đăng nhập local ${uname} bằng ${label} → ${r.status}`);
    }
  });

  await check('SEC-07', 'Chữ ký HMAC CRM→VIP ID: sửa thân / phát lại / sai path / sai chiều / lệch giờ / sai bí mật / quá lớn → từ chối', 'both', async (t) => {
    const D = P.D2 || await makeApproved('D3', 13, 'Đinh Văn Ba');
    const PTH = '/api/internal/khach/thu-hoi';
    const ok = await internalPost(cfg, PTH, { subject: D.subject, reason: 'e2e' });
    t.eq(ok.status, 200, 'đối chứng: chữ ký đúng → 200');
    const replay = await raw({ port: cfg.VIPID_PORT, method: 'POST', path: PTH, hostHeader: cfg.KHACH_HOST_DIRECT, headers: { 'content-type': 'application/json', 'x-portal-ts': ok.ts, 'x-portal-sig': ok.sig }, body: ok.body });
    t.eq(replay.status, 409, 'phát lại nguyên văn → 409 PHAT_LAI');
    const tam = await internalPost(cfg, '/api/internal/khach/tam-khoa', { subject: D.subject, action: 'khoa', reason: 'e2e' }, { signPath: PTH });
    t.eq(tam.status, 401, 'chữ ký của /thu-hoi dùng ở /tam-khoa → 401');
    t.ok(account(cfg, 'subject=?', [D.subject])[0].status === 'hoat_dong', '… tài khoản không bị khoá');
    const tamp = await internalPost(cfg, PTH, null, { rawBody: JSON.stringify({ subject: D.subject, reason: 'sua' }), signBody: JSON.stringify({ subject: D.subject, reason: 'goc' }) });
    t.eq(tamp.status, 401, 'thân bị sửa → 401');
    const dir = await internalPost(cfg, PTH, { subject: D.subject, reason: 'dir' }, { direction: 'vipid->crm' });
    t.eq(dir.status, 401, 'sai chiều (vipid->crm) → 401');
    const meth = await internalPost(cfg, PTH, { subject: D.subject, reason: 'm' }, { signMethod: 'PUT' });
    t.eq(meth.status, 401, 'ký METHOD khác → 401');
    const now = Math.floor(Date.now() / 1000);
    t.eq((await internalPost(cfg, PTH, { subject: D.subject, reason: 'old' }, { ts: now - 301 })).status, 401, 'ts lệch -301 s → 401');
    t.eq((await internalPost(cfg, PTH, { subject: D.subject, reason: 'fut' }, { ts: now + 301 })).status, 401, 'ts lệch +301 s → 401');
    t.eq((await internalPost(cfg, PTH, { subject: D.subject, reason: 'sec' }, { secret: 'x'.repeat(48) })).status, 401, 'bí mật sai → 401');
    t.eq((await internalPost(cfg, PTH, { subject: D.subject, reason: 'nosig' }, { noSig: true })).status, 401, 'thiếu X-Portal-Sig → 401');
    t.eq((await internalPost(cfg, PTH, { subject: D.subject, reason: 'v2' }, { noSig: true, headers: { 'x-portal-sig-v2': 'a'.repeat(64) } })).status, 401, 'chỉ có X-Portal-Sig-V2 rác → 401');
    const big = JSON.stringify({ subject: D.subject, reason: 'x'.repeat(10_050) });
    t.eq((await internalPost(cfg, PTH, null, { rawBody: big })).status, 413, 'thân > 10 KB (ký đúng) → 413');
    const chunked = await new Promise((resolve, reject) => {
      const body = JSON.stringify({ subject: D.subject, reason: 'chunk' });
      const ts = String(now);
      const req = http.request({ host: '127.0.0.1', port: cfg.VIPID_PORT, method: 'POST', path: PTH, agent: false, headers: { host: cfg.KHACH_HOST_DIRECT, 'content-type': 'application/json', 'transfer-encoding': 'chunked', 'x-portal-ts': ts, 'x-portal-sig': signV11(portalSecret(cfg), 'crm->vipid', 'POST', PTH, ts, body) } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject); req.write(body); req.end();
    });
    t.eq(chunked, 413, 'thiếu Content-Length (chunked) → 413');
    const forged = await internalPost(cfg, '/api/internal/khach/ket-qua-duyet', null, { rawBody: JSON.stringify({ subject: D.subject, decision: 'rejected' }), signBody: '{}' });
    t.eq(forged.status, 401, 'ket-qua-duyet giả (chữ ký không khớp thân) → 401');
    const st = await internalPost(cfg, PTH, { subject: D.subject, reason: 'staff' }, { hostHeader: cfg.STAFF_HOST });
    t.eq(st.status, 404, 'host nhân viên: /api/internal/khach/* không tồn tại → 404');
    t.ok(account(cfg, 'subject=?', [D.subject])[0].status === 'hoat_dong', 'sau mọi lần giả mạo: tài khoản vẫn hoat_dong');
  });

  await check('SEC-08a', 'CRM sập khi khách đăng ký → VIP ID vẫn nhận đăng ký (cho_duyet), xếp hàng crm_sync_pending, khách thấy trang an toàn; khach-dong-bo gửi khi CRM lên', 'both', async (t) => {
    if (!crm.canToggle) t.pending(MODE === 'mock' ? 'cần START=1 để bật/tắt CRM giả' : 'cần START=1 (stack bật/tắt CRM thật)');
    const K4 = mk('K4', 4, 'Khách Lúc Sập');
    const c = new KhachClient(cfg);
    await crm.down();
    try {
      const reg = await c.register({ name: K4.name, phone: K4.phoneLocal, email: K4.email });
      t.ok(reg.status === 303 && reg.headers.location === '/tai-khoan/cho-duyet', `đăng ký khi CRM sập → 303 chờ duyệt (${reg.status})`);
      const pg = await c.req('GET', '/tai-khoan/cho-duyet');
      t.ok(pg.status === 200 && pg.body.includes('Đã nhận đăng ký'), 'khách thấy "Đã nhận đăng ký, chờ duyệt"');
      t.ok(!/Traceback|ConnectError|Exception|127\.0\.0\.1|8897|5195|crm_sync|HTTP 5\d\d/i.test(reg.body + pg.body), 'không lộ chi tiết lỗi nội bộ');
      const bp = await browser.newPage(MOBILE);
      await bp.setContent(pg.body.replace('<head>', `<head><base href="${BASE}/">`));
      await bp.screenshot({ path: shotPath(SHOTS, '18-dang-ky-khi-crm-sap'), fullPage: true });
      await bp.close();
      K4.subject = account(cfg, 'phone_e164=?', [K4.phone])[0].subject;
      t.eq(account(cfg, 'subject=?', [K4.subject])[0].status, 'cho_duyet', 'tài khoản ở cho_duyet');
      await waitFor(() => (syncRows(cfg, K4.subject).find((x) => x.kind === 'signup')?.attempts || 0) >= 1, 15_000);
      const row = syncRows(cfg, K4.subject).find((x) => x.kind === 'signup');
      t.ok(row && !row.done_at && row.attempts >= 1 && row.last_error, `crm_sync_pending giữ signup (attempts=${row?.attempts}, lỗi: ${String(row?.last_error).slice(0, 60)})`);
      const d1 = vipidCli(cfg, ['khach-dong-bo', '--tat-ca']);
      t.ok(d1.code !== 0 && /còn chờ [1-9]/.test(d1.out), `khach-dong-bo khi CRM vẫn sập → thoát ≠0 (${d1.out.trim()})`);
    } finally {
      await crm.up();
    }
    const d2 = vipidCli(cfg, ['khach-dong-bo', '--tat-ca']);
    const otherPending = sqlRead(cfg, "SELECT subject, last_error FROM crm_sync_pending WHERE done_at IS NULL AND subject<>?", [K4.subject]);
    t.ok(/thành công [1-9]/.test(d2.out) || syncRows(cfg, K4.subject).every((x) => x.done_at), `khach-dong-bo sau khi CRM lên gửi được (${d2.out.trim()})`);
    if (otherPending.length) t.note(`còn ${otherPending.length} mục của khách KHÁC chưa gửi được: ${[...new Set(otherPending.map((x) => String(x.last_error).slice(0, 60)))].join(' | ')}`);
    t.ok(syncRows(cfg, K4.subject).every((x) => x.done_at), 'mọi mục của K4 đã gửi');
    const got = await waitFor(async () => (await crm.signupsReceived(K4.subject)).length === 1, 8000);
    t.ok(got, 'CRM nhận đúng 1 signup cho K4');
    t.note('Vòng nền VIP ID (5 s) tôn trọng next_at backoff (≥60 s sau lần lỗi đầu) — bộ test dùng CLI để không phải chờ.');
  });

  await check('SEC-08b', 'VIP ID sập: phiên CRM portal đang mở vẫn đọc được (độc lập), đăng xuất cổng vẫn huỷ vg_portal, trang /tai-khoan báo lỗi an toàn; VIP ID lên lại → đăng nhập được', 'real', async (t) => {
    needsStart(t);
    const c1 = await portalClient(K1);
    t.eq((await papi(c1, '/portal/api/me')).status, 200, 'trước sự cố: /me 200');
    await stack.stopVipid();
    try {
      t.eq((await papi(c1, '/portal/api/me')).status, 200, 'VIP ID sập: /portal/api/me vẫn 200 (phiên vg_portal 2 h độc lập)');
      t.eq((await papi(c1, '/portal/api/parcels')).status, 200, 'VIP ID sập: /portal/api/parcels vẫn 200');
      const dn = await raw({ port: cfg.PROXY_PORT, path: '/tai-khoan/dang-nhap', hostHeader: cfg.KHACH_HOST });
      t.ok(dn.status === 502 && !/Traceback|ECONNREFUSED|127\.0\.0\.1|8898/.test(dn.body), `/tai-khoan/dang-nhap → ${dn.status}, thân không lộ chi tiết`);
      const lo = await papi(c1, '/portal/api/logout', { method: 'POST', json: {} });
      t.eq(lo.status, 200, 'đăng xuất cổng khi VIP ID sập → 200');
      t.eq((await papi(c1, '/portal/api/me')).status, 401, 'sau đăng xuất: /me 401 (vg_portal đã huỷ ở CRM)');
      const relaunch = await c1.req('GET', '/tai-khoan/vao-cong');
      t.eq(relaunch.status, 502, 'không thể launch lại khi VIP ID sập (fail-closed)');
    } finally {
      await stack.startVipid();
    }
    const c2 = await portalClient(K1);
    t.eq((await papi(c2, '/portal/api/me')).status, 200, 'VIP ID lên lại: đăng nhập + launch → /me 200');
  });

  await check('INTEROP-01', 'Client ký của CRM thật (vipid-client.js) → VIP ID chấp nhận (thu-hoi)', 'both', async (t) => {
    const mod = await import(process.env.CRM_VIPID_CLIENT || '/Users/viporder/Projects/vip-group-khoqctq/server/modules/portal/vipid-client.js').catch(() => null);
    if (!mod?.createVipidClient) t.pending('không nạp được vipid-client.js của CRM');
    const D = P.D2 || P.D3;
    const client = mod.createVipidClient({ baseUrl: `http://127.0.0.1:${cfg.VIPID_PORT}`, secret: portalSecret(cfg), portalHost: cfg.KHACH_HOST_DIRECT });
    const r = await client.send('thu_hoi', { subject: D.subject, reason: 'interop' });
    t.ok(r.ok, `VIP ID chấp nhận lệnh thu_hoi do client CRM ký (${r.status}${r.error ? ' ' + r.error : ''})`);
    const r2 = await client.send('tam_khoa', { subject: D.subject, action: 'mo_khoa', reason: 'interop' });
    t.ok(r2.ok, `VIP ID chấp nhận tam_khoa(mo_khoa) do client CRM ký (${r2.status}${r2.error ? ' ' + r2.error : ''})`);
  });

  await check('INTEROP-02', 'Lệnh VIP ID→CRM (bắt trên dây: signup + thu-hoi) qua bộ kiểm chữ ký + kiểm thân của CRM thật (internal.js)', 'both', async (t) => {
    needsStart(t);
    if (MODE !== 'mock') t.pending('real mode: CRM thật kiểm trực tiếp (FLOW-02 signup được nhận, FLOW-11 thu-hoi huỷ phiên cũ)');
    const crmMod = await import(process.env.CRM_INTERNAL_JS || '/Users/viporder/Projects/vip-group-khoqctq/server/modules/portal/internal.js').catch((e) => ({ err: e }));
    if (!crmMod.checkSignature) t.note(`không nạp được internal.js của CRM (${String(crmMod.err?.message).slice(0, 80)}) — kiểm theo chuỗi HĐ v1.1 §11.8`);
    const verify = (cap) => {
      const args = { secret: portalSecret(cfg), ts: cap.headers['x-portal-ts'], sig: cap.headers['x-portal-sig'], rawBody: cap.body, method: 'POST', path: cap.path.split('?')[0] };
      if (crmMod.checkSignature) return crmMod.checkSignature(args);
      const want = signV11(args.secret, 'vipid->crm', 'POST', args.path, args.ts, args.rawBody);
      return { ok: want === args.sig, code: 'SIGNATURE_INVALID' };
    };
    // Thay CRM giả bằng máy bắt gói trong chốc lát, kích VIP ID gửi signup + thu-hoi, rồi trả CRM giả về.
    await crm.down();
    const captured = [];
    const srv = http.createServer((req, res) => { const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => { captured.push({ path: req.url, headers: req.headers, body: Buffer.concat(ch).toString('utf8') }); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); }); });
    await new Promise((r) => srv.listen(cfg.CRM_PORT, '127.0.0.1', r));
    try {
      const K5 = mk('K5', 5, 'Khách Bắt Gói');
      const rk5 = await new KhachClient(cfg).register({ name: K5.name, phone: K5.phoneLocal, email: '' });
      if (rk5.status !== 303) throw new Error(`đăng ký K5 → ${rk5.status}`);
      K5.subject = account(cfg, 'phone_e164=?', [K5.phone])[0].subject;
      const c = new KhachClient(cfg);
      await c.login(K1.phone, K1.pw);
      await c.logout();
      await waitFor(() => captured.some((x) => x.path === '/api/internal/portal/thu-hoi') && captured.some((x) => x.path === '/api/internal/portal/signups' && x.body.includes(P.K5.subject)), 12_000);
    } finally {
      await new Promise((r) => srv.close(r));
      await crm.up();
    }
    for (const pth of ['/api/internal/portal/signups', '/api/internal/portal/thu-hoi']) {
      const cap = captured.find((x) => x.path === pth && (pth.endsWith('/thu-hoi') || x.body.includes(P.K5.subject)));
      t.ok(cap, `bắt được VIP ID → CRM ${pth}`);
      t.ok(Number(cap.headers['content-length']) === Buffer.byteLength(cap.body) && Buffer.byteLength(cap.body) <= 10_000, `${pth}: có Content-Length, thân ≤ 10 KB`);
      const v = verify(cap);
      t.ok(v.ok, `${pth}: bộ kiểm chữ ký CRM chấp nhận (${v.code || 'ok'})`);
      t.ok(cap.headers['idempotency-key'], `${pth}: có Idempotency-Key`);
    }
    const sg = captured.find((x) => x.path === '/api/internal/portal/signups' && x.body.includes(P.K5.subject));
    if (crmMod.validateSignup) {
      const vs = crmMod.validateSignup(JSON.parse(sg.body));
      t.ok(vs.ok, `thân signup KHÔNG email (email=null) hợp lệ theo validateSignup của CRM${vs.ok ? '' : ': ' + JSON.stringify(vs.errors)}`);
    }
    t.ok(/^[\x21-\x7e]{1,200}$/.test(sg.headers['idempotency-key']) && sg.headers['idempotency-key'].includes(P.K5.subject), `Idempotency-Key signup hợp lệ với IDEM_RE của CRM và gắn subject (${sg.headers['idempotency-key'].slice(0, 20)}…)`);
    const done = await waitFor(() => vipidCli(cfg, ['khach-dong-bo', '--tat-ca']).code === 0, 5000);
    t.ok(done, 'hàng đợi VIP ID sạch sau khi trả CRM giả');
  });

  await check('INTEROP-03', 'Đăng xuất từ web-portal CRM: form GET /tai-khoan/dang-xuat → trang xác nhận VIP ID có _csrf → POST kết thúc phiên; POST không _csrf vẫn bị chặn', 'both', async (t) => {
    let idx = '';
    try { idx = fs.readFileSync(`${cfg.CRM_REPO}/web-portal/index.html`, 'utf8'); } catch { /* không có repo CRM */ }
    const form = /<form[^>]*id="logout-form"[^>]*>/.exec(idx)?.[0] || '';
    t.ok(/method="get"/i.test(form) && /action="\/tai-khoan\/dang-xuat"/.test(form), `web-portal: form đăng xuất là GET /tai-khoan/dang-xuat (${form.slice(0, 80)})`);
    const c = new KhachClient(cfg);
    const lr = await c.login(K1.phone, K1.pw);
    t.ok(lr.status === 303 && /\/portal\/auth\/launch/.test(lr.headers.location || ''), 'K1 đăng nhập (có phiên VIP ID)');
    const csrfLess = await c.req('POST', '/tai-khoan/dang-xuat', { form: {} });
    t.ok(csrfLess.status === 403 && await c.hasSession(), 'POST đăng xuất không _csrf (giả mạo chéo trang) → 403, phiên còn nguyên');
    const lo = await c.logout();
    t.ok(lo.get.status === 200 && formField(lo.get.body, '_csrf'), 'GET /tai-khoan/dang-xuat → trang xác nhận có _csrf');
    t.ok(lo.post && lo.post.status === 303 && lo.post.headers.location === '/tai-khoan/dang-nhap?da_thoat=1', 'POST xác nhận → 303 /tai-khoan/dang-nhap?da_thoat=1');
    t.ok(!(await c.hasSession()), 'phiên VIP ID bị thu hồi');
  });

  await check('INTEROP-04', 'Đổi mật khẩu → vào cổng NGAY qua vao-cong: phiên cổng mới không bị thu-hoi bất đồng bộ (do lần đổi MK) huỷ nhầm', 'real', async (t) => {
    const c = new KhachClient(cfg);
    const lr = await c.login(K1.phone, K1.pw);
    t.ok(lr.status === 303 && /\/portal\/auth\/launch/.test(lr.headers.location || ''), 'K1 đăng nhập');
    const g = await c.req('GET', '/tai-khoan/doi-mat-khau');
    const neu = K1.pw === PW3 ? 'Doi-Lan-Hai-E2E-2026%d' : PW3;
    const r = await c.req('POST', '/tai-khoan/doi-mat-khau', { form: { _csrf: formField(g.body, '_csrf'), mat_khau_cu: K1.pw, mat_khau: neu, mat_khau_2: neu } });
    t.ok(r.status === 303 && /ho-so\?da_doi=1/.test(r.headers.location || ''), 'đổi mật khẩu → 303 hồ sơ');
    K1.pw = neu;
    const vc = await c.req('GET', '/tai-khoan/vao-cong');
    const loc = new URL(vc.headers.location, BASE);
    const la = await c.req('GET', loc.pathname + loc.search);
    t.ok((la.setCookies || []).some((x) => x.startsWith('vg_portal=')), 'vao-cong ngay sau đổi MK → launch cấp vg_portal');
    t.eq((await papi(c, '/portal/api/me')).status, 200, 'ngay sau launch: /portal/api/me 200');
    // chờ thu-hoi (VIP ID gửi ngay hoặc vòng nền 5 s; CRM xử lý) rồi kiểm lại phiên mới
    await new Promise((res) => setTimeout(res, 12_000));
    const after = (await papi(c, '/portal/api/me')).status;
    if (after !== 200) throw new Error(`INTEROP race: phiên cổng MỚI (cấp sau đổi mật khẩu) bị huỷ sau ~12 s (/portal/api/me ${after}) — thu-hoi reason=doi_mat_khau đến CRM sau launch và CRM huỷ mọi phiên/ chặn token theo portal_revoked_at ≥ thời điểm cấp`);
    t.ok(true, 'phiên cổng mới vẫn 200 sau 12 s');
  });

  await check('INTEROP-05', 'Đăng xuất VIP ID trong CÙNG giây với lúc vào cổng: thu-hoi (revoked_at theo giây) vẫn huỷ phiên cổng vừa tạo', 'real', async (t) => {
    const c = new KhachClient(cfg);
    const lr = await c.login(K1.phone, K1.pw);
    t.ok(lr.status === 303 && /\/portal\/auth\/launch/.test(lr.headers.location || ''), 'K1 đăng nhập');
    // chờ tới đầu một giây mới để launch + đăng xuất chắc chắn cùng giây
    await new Promise((r) => setTimeout(r, 1000 - (Date.now() % 1000) + 20));
    const loc = new URL(lr.headers.location, BASE);
    const la = await c.req('GET', loc.pathname + loc.search);
    t.ok((la.setCookies || []).some((x) => x.startsWith('vg_portal=')), 'launch cấp vg_portal');
    const g = await c.req('GET', '/tai-khoan/dang-xuat');
    const p = await c.req('POST', '/tai-khoan/dang-xuat', { form: { _csrf: formField(g.body, '_csrf') } });
    t.note(`launch → đăng xuất trong ${Date.now() % 1000} ms của cùng giây`);
    t.eq(p.status, 303, 'đăng xuất VIP ID → 303');
    const dead = await waitFor(async () => (await papi(c, '/portal/api/me')).status === 401, 15_000);
    if (!dead) throw new Error('INTEROP: phiên cổng tạo trong cùng giây với đăng xuất KHÔNG bị huỷ — VIP ID gửi revoked_at = int(time.time()) (làm tròn XUỐNG giây), CRM chỉ huỷ phiên created_at < revoked_at ⇒ phiên mới tạo trong giây đó sống tiếp tới TTL 2 h dù khách đã đăng xuất. Sửa: VIP ID gửi revoked_at làm tròn LÊN (hoặc ms), hoặc CRM so created_at < revoked_at + 1 s');
    t.ok(true, 'phiên cổng bị huỷ');
  });

  // ─── Owner: đăng ký đồng thời ───
  await check('SEC-10a', 'Đăng ký đồng thời: 10 lượt song song CÙNG một SĐT mới → đúng 1 tài khoản, 1 đăng ký ở CRM, 10 phản hồi giống hệt', 'both', async (t) => {
    const u = synth(RUN, 60);
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => new KhachClient(cfg).register({ name: `Khách Đồng Thời ${i}`, phone: u.phoneLocal, email: '' })));
    const sig = new Set(rs.map((r) => `${r.status} ${r.headers.location}`));
    t.ok(sig.size === 1 && [...sig][0] === '303 /tai-khoan/cho-duyet', `10 phản hồi giống hệt (${[...sig].join(' | ')})`);
    const accs = sqlRead(cfg, 'SELECT subject, phone_conflict_count FROM customer_accounts WHERE phone_e164=?', [u.phone]);
    t.eq(accs.length, 1, 'VIP ID: đúng 1 tài khoản cho SĐT');
    t.note(`phone_conflict_count = ${accs[0].phone_conflict_count} (9 lượt sau bị coi là trùng)`);
    t.ok(await waitFor(async () => (await crm.signupsReceived(accs[0].subject)).length > 0, 15_000), 'CRM nhận signup');
    await new Promise((r) => setTimeout(r, 6000)); // cho vòng gửi 5 s chạy hết
    if (MODE === 'real') {
      t.eq(crmSql(cfg, `SELECT count(*) FROM portal_signups WHERE phone_e164='${u.phone}'`)[0], '1', 'CRM: đúng 1 dòng portal_signups cho SĐT');
    } else {
      const subs = new Set(stack.mockCrmCalls().filter((c) => c.path === '/api/internal/portal/signups' && c.body.phone_e164 === u.phone).map((c) => c.body.subject));
      t.eq(subs.size, 1, 'CRM giả: mọi signup cho SĐT này cùng 1 subject');
    }
  });

  await check('SEC-10b', 'Đồng thời: 10 đăng ký SĐT khác nhau song song + 10 lượt duyệt song song (API CRM) → 10 mã VG khác nhau, tăng dần', 'real', async (t) => {
    const us = Array.from({ length: 10 }, (_, i) => mk(`P${i}`, 70 + i, `Khách Song Song ${i}`));
    const rs = await Promise.all(us.map((u) => new KhachClient(cfg).register({ name: u.name, phone: u.phoneLocal, email: '' })));
    t.ok(rs.every((r) => r.status === 303 && r.headers.location === '/tai-khoan/cho-duyet'), '10 đăng ký song song → 303 chờ duyệt');
    for (const u of us) u.subject = account(cfg, 'phone_e164=?', [u.phone])[0]?.subject;
    t.ok(us.every((u) => u.subject), 'VIP ID: 10 tài khoản');
    t.ok(await waitFor(async () => (await Promise.all(us.map((u) => crm.findSignup(u.subject)))).every(Boolean), 20_000), 'CRM nhận đủ 10 signup');
    const before = Math.max(...crmSql(cfg, 'SELECT portal_code FROM customers WHERE portal_code IS NOT NULL').map(codeNum));
    const ap = await Promise.all(us.map((u) => crm.approve({ subject: u.subject })));
    const codes = ap.map((r) => r.portalCode);
    t.ok(ap.every((r) => r.ok), `10 lượt duyệt song song thành công (${ap.filter((r) => !r.ok).map((r) => r.out).join(' | ')})`);
    t.eq(new Set(codes).size, 10, `10 mã khác nhau: ${codes.join(',')}`);
    t.ok(codes.every((c) => CODE_RE.test(c) && codeNum(c) > before), 'đúng quy tắc VG1001… và lớn hơn mọi mã cũ');
    t.eq(new Set(us.map((u) => account(cfg, 'subject=?', [u.subject])[0].portal_code)).size, 10, 'VIP ID nhận đủ 10 mã khác nhau');
  });

  // ─── Owner: chức năng nội bộ CRM (API nhân viên) ───
  const staffGet = async (tok, p) => crm.api('GET', p, undefined, { token: tok });
  const custIdOf = (u) => crm.customerIdOf(u.subject);
  const searchHas = async (tok, q, u) => {
    const r = await staffGet(tok, `/api/crm/customers?q=${encodeURIComponent(q)}`);
    return { status: r.status, found: (r.json?.items || []).some((c) => c.id === custIdOf(u)), n: r.json?.total };
  };
  for (const [id, label, qf] of [['STAFF-01a', 'mã VG', (u) => u.code], ['STAFF-01b', 'tên (một phần)', (u) => u.name.split(' ').slice(-2).join(' ')],
    ['STAFF-01c', 'SĐT dạng +84', (u) => u.phone], ['STAFF-01d', 'SĐT dạng 0…', (u) => u.phoneLocal], ['STAFF-01e', 'SĐT dạng 0… có khoảng trắng', (u) => `${u.phoneLocal.slice(0, 4)} ${u.phoneLocal.slice(4, 7)} ${u.phoneLocal.slice(7)}`]]) {
    await check(id, `Nhân viên tìm khách cổng theo ${label} (GET /api/crm/customers?q=) — vip.admin thấy K1, a1.admin không thấy K1 (tenant VIP)`, 'real', async (t) => {
      const vip = await crm.login();
      const q = qf(K1);
      const r = await searchHas(vip, q, K1);
      t.ok(r.status === 200 && r.found, `vip.admin q="${q}" → ${r.status}, thấy K1: ${r.found}`);
      const a1 = await crm.loginAs('a1.admin');
      const r2 = await searchHas(a1, q, K1);
      t.ok(r2.status === 200 && !r2.found, `a1.admin q="${q}" → ${r2.status}, KHÔNG thấy K1 (khác tenant)`);
    });
  }

  await check('STAFF-02', 'Hồ sơ khách: xem/sửa trong phạm vi quyền; không sửa trạng thái cổng qua API chung; đại lý không đụng khách tenant khác', 'real', async (t) => {
    const vip = await crm.login();
    const a1 = await crm.loginAs('a1.admin');
    const b = await crm.loginAs('b.admin');
    const k1 = custIdOf(K1); const k3 = custIdOf(P.K3);
    const v = await staffGet(vip, `/api/crm/customers/${k1}`);
    t.ok(v.status === 200 && v.json.code === K1.code, `vip.admin xem hồ sơ K1 → ${v.status} (code ${v.json?.code})`);
    const up = await crm.api('PATCH', `/api/crm/customers/${k1}`, { address: 'Số 1 Đường Tổng Hợp, Hà Nội', reason: 'E2E' }, { token: vip });
    t.ok(up.status === 200 && up.json.address === 'Số 1 Đường Tổng Hợp, Hà Nội', `vip.admin sửa địa chỉ K1 → ${up.status}`);
    const act = await crm.api('PATCH', `/api/crm/customers/${k1}`, { active: false, reason: 'E2E' }, { token: vip });
    t.ok(act.status === 409 && act.json?.error?.code === 'USE_PORTAL_LOCK', `đổi active khách cổng qua API chung → ${act.status} ${act.json?.error?.code || ''} (phải dùng khoá cổng)`);
    const pc = await crm.api('PATCH', `/api/crm/customers/${k1}`, { portal_code: 'VG9999', reason: 'E2E' }, { token: vip });
    t.eq(crmSql(cfg, `SELECT portal_code FROM customers WHERE id='${k1}'`)[0], K1.code, `portal_code không sửa được qua API (${pc.status})`);
    const a3 = await staffGet(a1, `/api/crm/customers/${k3}`);
    t.ok(a3.status === 200 && a3.json.code === 'K3-A1', `a1.admin xem K3 (đại lý A1) → ${a3.status}`);
    const a3u = await crm.api('PATCH', `/api/crm/customers/${k3}`, { address: 'Địa chỉ đại lý A1 (E2E)', reason: 'E2E' }, { token: a1 });
    t.eq(a3u.status, 200, 'a1.admin sửa địa chỉ K3 (trong quyền) → 200');
    const a3a = await crm.api('PATCH', `/api/crm/customers/${k3}`, { active: false, reason: 'E2E' }, { token: a1 });
    t.ok(a3a.status === 409 || a3a.status === 403, `a1.admin khoá K3 qua API chung → ${a3a.status} ${a3a.json?.error?.code || ''}`);
    const a3c = await crm.api('PATCH', `/api/crm/customers/${k3}`, { code: 'DOI-MA', reason: 'E2E' }, { token: a1 });
    t.note(`a1.admin đổi mã nội bộ K3 → ${a3c.status} ${a3c.json?.error?.code || ''}`);
    if (a3c.status === 200) await crm.api('PATCH', `/api/crm/customers/${k3}`, { code: 'K3-A1', reason: 'E2E hoàn tác' }, { token: a1 });
    t.eq(crmSql(cfg, `SELECT portal_code FROM customers WHERE id='${k3}'`)[0], P.K3.code, 'portal_code K3 không đổi');
    const a1k1 = await staffGet(a1, `/api/crm/customers/${k1}`);
    t.ok(a1k1.status === 404 || a1k1.status === 403, `a1.admin xem K1 (tenant VIP) → ${a1k1.status}`);
    const a1k1u = await crm.api('PATCH', `/api/crm/customers/${k1}`, { address: 'x', reason: 'E2E' }, { token: a1 });
    t.ok(a1k1u.status === 404 || a1k1u.status === 403, `a1.admin sửa K1 → ${a1k1u.status}`);
    const bk3 = await staffGet(b, `/api/crm/customers/${k3}`);
    t.ok(bk3.status === 404 || bk3.status === 403, `b.admin (đại lý B) xem K3 (A1) → ${bk3.status}`);
  });

  await check('STAFF-03', 'Quản lý trạng thái: khoá cổng (POST /api/portal/customers/:id/lock) → VIP ID tam_khoa, khách không đăng nhập/launch được, phiên cổng bị huỷ; mở lại → dùng được; đại lý không khoá được', 'real', async (t) => {
    const K2 = P.K2;
    const live = await portalClient(K2);
    t.eq((await papi(live, '/portal/api/me')).status, 200, 'K2 đang có phiên cổng');
    const pending = await new KhachClient(cfg).login(K2.phone, K2.pw || PW_STRONG); // launch token cấp TRƯỚC khi khoá
    const a1 = await crm.loginAs('a1.admin');
    const den = await crm.api('POST', `/api/portal/customers/${custIdOf(K2)}/lock`, { action: 'khoa', reason: 'E2E đại lý' }, { token: a1 });
    t.ok(den.status === 403, `a1.admin khoá cổng K2 → ${den.status}`);
    t.eq((await crm.lock(K2.subject, 'khoa')).status, 200, 'vip.admin khoá cổng K2 → 200');
    try {
      t.ok(await waitFor(() => account(cfg, 'subject=?', [K2.subject])[0].status === 'tam_khoa', 30_000), 'VIP ID nhận tam-khoa → tam_khoa');
      t.ok(await waitFor(async () => (await papi(live, '/portal/api/me')).status === 401, 10_000), 'phiên cổng đang mở bị huỷ');
      const lg = await new KhachClient(cfg).login(K2.phone, K2.pw || PW_STRONG);
      t.ok(lg.status === 403 && !/portal\/auth\/launch/.test(lg.headers.location || ''), `đăng nhập khi bị khoá → ${lg.status} (không launch)`);
      const loc = new URL(pending.headers.location, BASE);
      const la = await raw({ port: cfg.PROXY_PORT, path: loc.pathname + loc.search, hostHeader: cfg.KHACH_HOST });
      t.ok(la.status >= 400 && !(la.setCookies || []).some((x) => x.startsWith('vg_portal=')), `launch token cấp trước khi khoá → ${la.status}, không cấp phiên`);
    } finally {
      t.eq((await crm.lock(K2.subject, 'mo_khoa')).status, 200, 'vip.admin mở cổng K2 → 200');
    }
    t.ok(await waitFor(() => account(cfg, 'subject=?', [K2.subject])[0].status === 'hoat_dong', 30_000), 'VIP ID → hoat_dong');
    const again = await portalClient(K2);
    t.eq((await papi(again, '/portal/api/me')).status, 200, 'sau mở khoá: K2 đăng nhập + vào cổng được');
  });

  await check('STAFF-04', 'Lịch sử kiện / vận đơn theo khách (GET /api/inventory/parcels?q=, /:id/movements) trong phạm vi quyền', 'real', async (t) => {
    const seed = await ensureSeed(t);
    const vip = await crm.login();
    const a1 = await crm.loginAs('a1.admin');
    const r = await staffGet(vip, `/api/inventory/parcels?q=${encodeURIComponent(`E2E-${K1.code}-`)}`);
    const trks = (r.json?.items || []).map((p) => p.tracking_no);
    t.ok(r.status === 200 && seed.K1.every((x) => trks.includes(x)), `vip.admin thấy đủ kiện K1 (${trks.length})`);
    const one = (r.json?.items || []).find((p) => p.tracking_no === seed.K1[0]);
    t.ok(one && (one.customer_code === K1.code || one.customer_id === custIdOf(K1) || JSON.stringify(one).includes(K1.code)), 'kiện gắn đúng khách K1');
    const mv = await staffGet(vip, `/api/inventory/parcels/${one.id}/movements`);
    t.eq(mv.status, 200, `lịch sử di chuyển kiện → 200 (${(mv.json?.items || mv.json || []).length ?? '?'} dòng)`);
    const det = await staffGet(vip, `/api/inventory/parcels/${one.id}`);
    t.ok(det.status === 200 && det.json.tracking_no === seed.K1[0], 'chi tiết kiện → 200');
    const ra = await staffGet(a1, `/api/inventory/parcels?q=${encodeURIComponent(`E2E-${K1.code}-`)}`);
    t.ok(ra.status === 200 && !(ra.json?.items || []).length, `a1.admin tìm kiện K1 (tenant VIP) → ${(ra.json?.items || []).length} kiện`);
    const rd = await staffGet(a1, `/api/inventory/parcels/${one.id}`);
    t.ok(rd.status === 404 || rd.status === 403, `a1.admin mở chi tiết kiện K1 → ${rd.status}`);
    const r3 = await staffGet(a1, `/api/inventory/parcels?q=${encodeURIComponent(`E2E-${P.K3.code}-`)}`);
    t.ok(r3.status === 200 && (r3.json?.items || []).length >= 2, `a1.admin thấy kiện của khách đại lý mình K3 (${(r3.json?.items || []).length})`);
  });

  await check('STAFF-05', 'Audit CRM: approve / link / reset_link / lock / unlock có actor (vip.admin), không chứa link/token', 'real', async (t) => {
    const vip = await crm.login();
    const want = ['portal.signup.approve', 'portal.signup.link', 'portal.customer.reset_link', 'portal.customer.lock', 'portal.customer.unlock'];
    for (const a of want) {
      const r = await staffGet(vip, `/api/reports/audit?action=${encodeURIComponent(a)}&limit=200`);
      const rows = (r.json?.items || []).filter((x) => x.action === a);
      t.ok(r.status === 200 && rows.length > 0 && rows.every((x) => x.actor_username === 'vip.admin'), `${a}: ${rows.length} dòng, actor ${[...new Set(rows.map((x) => x.actor_username))].join(',')}`);
      if (a === 'portal.customer.reset_link') t.ok(!JSON.stringify(rows).includes('/tai-khoan/dat-lai?t='), 'audit reset_link không chứa url/token');
    }
  });

  await check('STAFF-06', 'Cấp link đặt lại: đại lý (a1.admin, a1.nv) bị từ chối, kể cả với khách của chính đại lý', 'real', async (t) => {
    for (const user of ['a1.admin', 'a1.nv']) {
      const tok = await crm.loginAs(user);
      for (const u of [P.K3, K1]) {
        const r = await crm.resetLink(u.subject, { token: tok });
        t.ok(r.status === 403, `${user} cấp link cho ${u.key} → ${r.status} ${r.code || ''}`);
      }
    }
  });

  await check('SEC-09', 'Trình duyệt 390px: mọi trang khách không tràn ngang, không console error, không vi phạm CSP', 'both', async (t) => {
    const ctxS = await newCtx();
    const evS = ctxS._e2eEvents;
    const ps = await ctxS.newPage();
    const visit = async (name, url, expectStatus = 200) => {
      const resp = await ps.goto(url);
      t.ok(resp.status() === expectStatus, `${name}: HTTP ${resp.status()}`);
      await inspect(ps, `sweep-${name}`, { expectStatus });
    };
    await visit('dang-ky', `${BASE}/tai-khoan/dang-ky`);
    await ps.fill('input[name=ho_ten]', 'A'); await ps.fill('input[name=sdt]', '123'); await ps.fill('input[name=email]', 'x');
    await ps.click('form[action="/tai-khoan/dang-ky"] button[type=submit]'); await ps.waitForLoadState('load');
    await inspect(ps, 'sweep-dang-ky-loi', { expectStatus: 400 });
    await visit('xac-minh-email-da-go', `${BASE}/tai-khoan/xac-minh-email?t=sai`, 404);
    await visit('dang-nhap', `${BASE}/tai-khoan/dang-nhap`);
    await ps.fill('input[name=dinh_danh]', '0900000000'); await ps.fill('input[name=mat_khau]', 'sai-mat-khau-123');
    await ps.click('form[action="/tai-khoan/dang-nhap"] button[type=submit]'); await ps.waitForLoadState('load');
    await inspect(ps, 'sweep-dang-nhap-loi', { expectStatus: 401 });
    await visit('cho-duyet', `${BASE}/tai-khoan/cho-duyet`);
    await visit('quen-mat-khau', `${BASE}/tai-khoan/quen-mat-khau`);
    await visit('dat-lai-sai', `${BASE}/tai-khoan/dat-lai?t=sai`, 400);
    await visit('dang-xuat-khong-phien', `${BASE}/tai-khoan/dang-xuat`);
    await visit('404', `${BASE}/tai-khoan/khong-co`, 404);
    // Trang khi đã đăng nhập (VIP ID): đăng nhập K1, rồi trang "Xin chào" + trang xác nhận đăng xuất
    await ps.goto(`${BASE}/tai-khoan/dang-nhap`);
    await ps.fill('input[name=dinh_danh]', K1.code); await ps.fill('input[name=mat_khau]', K1.pw);
    await Promise.all([ps.waitForURL(/\/portal\//), ps.click('form[action="/tai-khoan/dang-nhap"] button[type=submit]')]);
    await visit('dang-nhap-da-co-phien', `${BASE}/tai-khoan/dang-nhap`);
    await visit('ho-so', `${BASE}/tai-khoan/ho-so`);
    await visit('doi-mat-khau', `${BASE}/tai-khoan/doi-mat-khau`);
    await visit('dang-xuat-co-phien', `${BASE}/tai-khoan/dang-xuat`);
    if (MODE === 'real') {
      for (const r of ['tong-quan', 'kien-hang', 'tra-cuu', 'kho']) {
        await ps.goto(`${BASE}/portal/#/${r}`);
        await ps.waitForSelector('#main:not([aria-busy="true"])', { timeout: 10000 }).catch(() => {});
        await inspect(ps, `sweep-portal-${r}`);
      }
    }
    await closeCtx(ctxS);
    for (const ev of [evS, ...extraEvents]) events.push(...ev);
    // Header CSP phải có trên tài liệu của trang khách (nếu thiếu thì "không vi phạm CSP" là vô nghĩa)
    const cspOf = async (p) => (await raw({ port: cfg.PROXY_PORT, path: p, hostHeader: cfg.KHACH_HOST })).headers['content-security-policy'] || '';
    for (const p of ['/tai-khoan/dang-nhap', ...(MODE === 'real' ? ['/portal/', '/portal/app.js'] : [])]) {
      const c = await cspOf(p);
      t.ok(/default-src 'none'/.test(c) && !/unsafe-inline|unsafe-eval/.test(c), `${p}: có CSP chặt (${c.slice(0, 60)}…)`);
    }
    const customer = (u) => { try { const p = new URL(u).pathname; return p.startsWith('/tai-khoan') || (MODE === 'real' && p.startsWith('/portal')); } catch { return false; } };
    const custPages = pages.filter((p) => customer(p.url));
    t.note(`sự kiện console/CSP/JS thu được: ${events.length} (trang khách: ${events.filter((e) => customer(e.url)).length})`);
    t.ok(custPages.length >= 20, `đã đo ${custPages.length} trang khách (luồng + quét)`);
    const over = custPages.filter((p) => p.overflow);
    t.ok(!over.length, `không tràn ngang ở 390px${over.length ? ': ' + over.map((p) => `${p.name} (${p.scrollWidth}px: ${p.wide.join(',')})`).join('; ') : ''}`);
    // Lỗi tải tài nguyên cho CHÍNH tài liệu ở trang cố ý trả 4xx là hành vi đúng (Chrome ghi "Failed to load resource" cho document 4xx)
    const expected4xx = new Set(pages.filter((p) => p.expectStatus && p.expectStatus >= 400).map((p) => p.url));
    const bad = events.filter((e) => customer(e.url) && !(e.kind === 'console' && /Failed to load resource: the server responded with a status of 4\d\d/.test(e.text) && expected4xx.has(e.url)));
    const csp = bad.filter((e) => e.kind === 'csp');
    t.ok(!csp.length, `không vi phạm CSP${csp.length ? ': ' + csp.slice(0, 3).map((e) => e.text).join(' | ') : ''}`);
    const other = bad.filter((e) => e.kind !== 'csp');
    t.ok(!other.length, `không console error / lỗi JS${other.length ? ': ' + other.slice(0, 3).map((e) => `${new URL(e.url).pathname}: ${e.text}`).join(' | ') : ''}`);
    const mockNoise = events.filter((e) => !customer(e.url));
    if (mockNoise.length) t.note(`bỏ qua ${mockNoise.length} sự kiện ở trang không phải trang khách (CRM giả): ${[...new Set(mockNoise.map((e) => e.text))].slice(0, 2).join(' | ')}`);
  });

  await closeCtx(ctxA);
  await closeCtx(ctxB);
}

/** HS256 bằng bí mật portal (để thử token "ký đúng nhưng sai nội dung"). */
function signHs(input) {
  return crypto.createHmac('sha256', portalSecret(cfg)).update(input).digest('base64url');
}

// ───────── báo cáo ─────────
function report() {
  const w = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
  console.log('\n' + '─'.repeat(118));
  console.log(`${w('ID', 11)} ${w('KẾT QUẢ', 8)} ${w('PHẠM VI', 7)} ${w('KIỂM', 62)} GHI CHÚ`);
  console.log('─'.repeat(118));
  for (const r of results) console.log(`${w(r.id, 11)} ${w(r.status, 8)} ${w(r.scope, 7)} ${w(r.title, 62)} ${r.detail ? r.detail.slice(0, 160) : `${r.notes.filter((n) => n.startsWith('✓')).length} điều kiện`}`);
  console.log('─'.repeat(118));
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`SHA: VIP ID ${SHAS.vipid} · CRM ${SHAS.crm}`);
  console.log(`PASS ${count('PASS')} · FAIL ${count('FAIL')} · BLOCKED ${count('BLOCKED')} · PENDING ${count('PENDING')} · XFAIL ${count('XFAIL')}  (MODE=${MODE}, CODE_RULE=${CODE_RULE})`);
  fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify({ mode: MODE, base: BASE, run: RUN, shas: SHAS, at: new Date().toISOString(), results, pages, events }, null, 2));
  console.log(`Chi tiết: ${path.join(SHOTS, 'results.json')} · ảnh: ${SHOTS}`);
  return count('FAIL') + count('BLOCKED');
}

let fails = 1;
try {
  await main();
} catch (e) {
  console.error('LỖI KHUNG:', e);
  results.push({ id: 'HARNESS', title: 'khung chạy', scope: 'both', status: 'FAIL', detail: String(e?.message || e), notes: [] });
} finally {
  try { if (browser) await withTimeout(browser.close(), 8000); } catch { /* bỏ qua */ }
  await stack.stop();
  fails = report();
  if (cfg.runDir && !process.env.KEEP) fs.rmSync(cfg.runDir, { recursive: true, force: true });
  else if (cfg.runDir) console.log(`Giữ stack data (KEEP=1): ${cfg.runDir}`);
}
process.exit(fails ? 1 : 0);
