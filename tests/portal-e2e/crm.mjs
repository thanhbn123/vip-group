// Adapter CRM cho bộ E2E. MODE=mock dùng CRM giả của VIP ID (scripts/khach_mock_crm.py) + CLI khach-duyet-dev;
// MODE=real gọi API CRM thật (vip-group-khoqctq, server/modules/portal/review.js) — xem README.md mục "Real mode".
import fs from 'node:fs';
import { vipidCli, crmScript, crmSql } from './stack.mjs';
import { account, internalPost } from './vipid.mjs';
import { raw } from './http.mjs';

export class MockCrm {
  constructor(cfg, stack) { this.cfg = cfg; this.stack = stack; this.kind = 'mock'; }

  /** Lệnh signup mà CRM giả đã nhận (đã kiểm HMAC hợp lệ) cho subject. */
  signupsReceived(subject) {
    return this.stack.mockCrmCalls().filter((c) => c.path === '/api/internal/portal/signups' && c.body.subject === subject).map((c) => c.body);
  }

  revokesReceived(subject) {
    return this.stack.mockCrmCalls().filter((c) => c.path === '/api/internal/portal/thu-hoi' && c.body.subject === subject).map((c) => c.body);
  }

  /** Duyệt: CLI dev đi qua đúng hàm ket_qua_duyet của VIP ID (thay CRM). Trả {ok, portalCode, out}. */
  async approve({ phone, subject, portalCode }) {
    const r = vipidCli(this.cfg, ['khach-duyet-dev', subject || phone, '--portal-code', portalCode]);
    return { ok: r.code === 0, portalCode, out: (r.out + r.err).trim() };
  }

  async reject({ phone, subject }) {
    const r = vipidCli(this.cfg, ['khach-duyet-dev', subject || phone, '--tu-choi']);
    return { ok: r.code === 0, out: (r.out + r.err).trim() };
  }

  /** Nhân viên cấp link đặt lại: ở mock bộ test đóng vai CRM, ký HMAC "crm->vipid" gọi VIP ID tao-link-dat-lai. */
  async resetLink(subject) {
    const r = await internalPost(this.cfg, '/api/internal/khach/tao-link-dat-lai', { subject, requested_by: 'e2e-nhan-vien', e2e_n: Math.random().toString(36).slice(2) });
    return { ok: r.status === 200, url: r.json?.data?.url, via: 'HMAC trực tiếp (CRM giả)', status: r.status };
  }

  async down() { await this.stack.stopMockCrm(); }
  async up() { await this.stack.startMockCrm(); }
  get canToggle() { return this.cfg.START; }
}

/**
 * CRM thật (vip-group-khoqctq). START=1: stack tự tạo DB vipcrm5_e2e_portal, migrate + seed demo, chạy server/index.js.
 * Env (tuỳ chọn, mặc định cho stack local):
 *   CRM_STAFF_URL     gốc API nhân viên (mặc định http://127.0.0.1:$CRM_PORT — Host ≠ PORTAL_HOST nên là host nhân viên)
 *   CRM_ADMIN_TOKEN   Bearer vip_admin, HOẶC CRM_ADMIN_USER (mặc định vip.admin) + CRM_ADMIN_PASSWORD
 *                     (mặc định: đọc TEST_PASSWORD của seed dev trong server/lib/seed.js — không in ra)
 */
export class RealCrm {
  constructor(cfg, stack, env = process.env) {
    this.cfg = cfg; this.stack = stack; this.env = env; this.kind = 'real';
    this.base = (env.CRM_STAFF_URL || `http://127.0.0.1:${cfg.CRM_PORT}`).replace(/\/+$/, '');
    this.token = env.CRM_ADMIN_TOKEN || null;
    this.user = env.CRM_ADMIN_USER || 'vip.admin';
  }

  password() {
    if (this.env.CRM_ADMIN_PASSWORD) return this.env.CRM_ADMIN_PASSWORD;
    const src = fs.readFileSync(`${this.cfg.CRM_REPO}/server/lib/seed.js`, 'utf8');
    return /export const TEST_PASSWORD = '([^']+)'/.exec(src)?.[1];
  }

  missing() { return this.password() || this.token ? [] : ['CRM_ADMIN_TOKEN hoặc CRM_ADMIN_PASSWORD']; }

  async api(method, path, body, { token = this.token, headers: extra = {} } = {}) {
    const u = new URL(this.base + path);
    const headers = { accept: 'application/json', ...extra };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const r = await raw({ host: u.hostname, port: Number(u.port || 80), method, path: u.pathname + u.search, hostHeader: this.env.CRM_STAFF_HOST || u.host, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = JSON.parse(r.body); } catch { /* không phải JSON */ }
    return { status: r.status, json, body: r.body, headers: r.headers };
  }

  /** Đăng nhập một tài khoản nhân viên khác (vd a1.admin) → Bearer token (mật khẩu dev của seed). */
  async loginAs(username) {
    const r = await this.api('POST', '/api/auth/login', { username, password: this.password() }, { token: null });
    if (r.status !== 200 || !r.json?.token) throw new Error(`CRM login ${username}: HTTP ${r.status}`);
    return r.json.token;
  }

  async login() {
    if (this.token) return this.token;
    const r = await this.api('POST', '/api/auth/login', { username: this.user, password: this.password() }, { token: null });
    if (r.status !== 200 || !r.json?.token) throw new Error(`CRM login ${this.user} thất bại: HTTP ${r.status}`);
    if (r.json.must_change_password) throw new Error('Tài khoản CRM admin đang must_change_password');
    this.token = r.json.token;
    return this.token;
  }

  async findSignup(subject) {
    await this.login();
    const r = await this.api('GET', '/api/portal/signups?status=all');
    if (r.status !== 200) throw new Error(`GET /api/portal/signups → ${r.status}`);
    return (r.json?.items || []).find((s) => s.subject === subject) || null;
  }

  async signupDetail(id) { await this.login(); return this.api('GET', `/api/portal/signups/${id}`); }

  async signupsReceived(subject) { const s = await this.findSignup(subject); return s ? [s] : []; }

  async waitVipid(subject, status) {
    return waitFor(() => account(this.cfg, 'subject=?', [subject])[0]?.status === status, 45_000, 500);
  }

  async approve({ subject }) {
    const s = await waitForValue(() => this.findSignup(subject), 10_000);
    if (!s) return { ok: false, out: 'CRM chưa nhận signup' };
    await this.verifyPhone(s);
    const a = await this.decide(s, 'approve', {});
    const portalCode = a.json?.customer?.portal_code;
    if (a.status !== 200 || !portalCode) return { ok: false, status: a.status, code: a.json?.error?.code, out: `approve ${a.status} ${a.json?.error?.code || ''}` };
    // CRM gửi ket-qua-duyet qua portal_outbox (worker 15 s) → chờ VIP ID nhận
    const ok = await this.waitVipid(subject, 'hoat_dong');
    let outboxError = null;
    if (!ok) {
      const ob = await this.api('GET', '/api/portal/outbox');
      const it = (ob.json?.items || []).find((x) => x.subject === subject && x.event === 'ket_qua_duyet');
      outboxError = it ? `${it.status} attempts=${it.attempts} ${it.last_error || ''}` : null;
    }
    return { ok, portalCode, customer: a.json.customer, outboxError, out: ok ? '' : `VIP ID chưa nhận ket-qua-duyet sau 45 s (outbox: ${outboxError})` };
  }

  async link({ subject, customerId }) {
    const s = await waitForValue(() => this.findSignup(subject), 10_000);
    if (!s) return { ok: false, out: 'CRM chưa nhận signup' };
    await this.verifyPhone(s);
    const a = await this.decide(s, 'link', { customer_id: customerId });
    if (a.status !== 200) return { ok: false, status: a.status, out: `link ${a.status} ${a.json?.error?.code || ''}` };
    const ok = await this.waitVipid(subject, 'hoat_dong');
    return { ok, portalCode: a.json?.customer?.portal_code, customer: a.json?.customer, out: ok ? '' : 'VIP ID chưa nhận kết quả liên kết' };
  }

  /**
   * CRM ≤ f51dfd7 BẮT BUỘC verify-phone trước approve/link; từ d5666fc (migration 707) chỉ là ghi chú tuỳ chọn.
   * CRM_SKIP_VERIFY_PHONE=1 để bỏ. Gửi kèm SĐT nhân viên đã thấy (409 PHONE_CHANGED nếu đổi).
   */
  /** approve/link: luôn gửi SĐT nhân viên đã thấy; khi bỏ verify-phone thì KHÔNG gửi phone_verified.
   *  CRM_VERIFY_FALLBACK=1 (demo): CRM cũ trả 409 PHONE_NOT_VERIFIED → gọi verify-phone rồi thử lại một lần. */
  async decide(s, kind, extra) {
    const skip = this.env.CRM_SKIP_VERIFY_PHONE === '1';
    const body = { ...extra, phone_e164: s.phone_e164, ...(skip ? {} : { phone_verified: true }) };
    let a = await this.api('POST', `/api/portal/signups/${s.id}/${kind}`, body);
    if (skip && a.status === 409 && a.json?.error?.code === 'PHONE_NOT_VERIFIED' && this.env.CRM_VERIFY_FALLBACK === '1') {
      await this.api('POST', `/api/portal/signups/${s.id}/verify-phone`, { phone_e164: s.phone_e164 });
      a = await this.api('POST', `/api/portal/signups/${s.id}/${kind}`, { ...body, phone_verified: true });
    }
    return a;
  }

  async verifyPhone(s) {
    if (this.env.CRM_SKIP_VERIFY_PHONE === '1') return null;
    return this.api('POST', `/api/portal/signups/${s.id}/verify-phone`, { phone_e164: s.phone_e164 });
  }

  async reject({ subject }) {
    const s = await waitForValue(() => this.findSignup(subject), 10_000);
    if (!s) return { ok: false, out: 'CRM chưa nhận signup' };
    const r = await this.api('POST', `/api/portal/signups/${s.id}/reject`, { reason: 'E2E từ chối tổng hợp' });
    const ok = r.status === 200 && await this.waitVipid(subject, 'tu_choi');
    return { ok, out: `HTTP ${r.status}` };
  }

  /** scripts/portal-dev-seed.js parcels <VG> n → {created:[…], pending_unowned} */
  seedParcels(code, n) {
    const r = crmScript(this.cfg, ['scripts/portal-dev-seed.js', 'parcels', code, String(n)]);
    if (r.code !== 0) throw new Error(`portal-dev-seed parcels ${code}: ${r.err}`);
    return JSON.parse(r.out);
  }

  /** scripts/portal-dev-seed.js agent-customer <+84…> → {tenant, customer_id, code} */
  agentCustomer(phone) {
    const r = crmScript(this.cfg, ['scripts/portal-dev-seed.js', 'agent-customer', phone]);
    if (r.code !== 0) throw new Error(`portal-dev-seed agent-customer: ${r.err}`);
    return JSON.parse(r.out);
  }

  /** customers.id (CRM) của khách cổng theo subject VIP ID — đọc psql chỉ-đọc. */
  customerIdOf(subject) {
    return crmSql(this.cfg, `SELECT c.id FROM customers c JOIN users u ON u.id=c.user_id WHERE u.vip_subject='${String(subject).replace(/[^A-Za-z0-9:_-]/g, '')}'`)[0] || null;
  }

  /**
   * Nhân viên CRM cấp link đặt lại mật khẩu: CRM_RESET_LINK_ROUTE (vd "/api/portal/customers/:id/reset-link", ":id" = customers.id,
   * body {reason}) → CRM gọi VIP ID tao-link-dat-lai. Chưa đặt route (CRM cũ) → bộ test ký HMAC như CRM và gọi thẳng VIP ID.
   */
  async resetLink(subject, { reason = 'E2E: khách gọi hotline, đã xác nhận danh tính', raw: rawResp = false, direct = false, token } = {}) {
    const route = direct ? null : this.env.CRM_RESET_LINK_ROUTE;
    if (route) {
      if (!token) await this.login();
      const id = this.customerIdOf(subject);
      const r = await this.api('POST', route.replace(':id', id).replace(':subject', encodeURIComponent(subject)), reason === null ? {} : { reason }, token ? { token } : {});
      const out = { ok: r.status === 200 && !!r.json?.url, url: r.json?.url, expires_at: r.json?.expires_at, portal_code: r.json?.portal_code, via: `CRM ${route}`, status: r.status, code: r.json?.error?.code, headers: r.headers, customerId: id };
      return rawResp ? { ...out, json: r.json } : out;
    }
    const r = await internalPost(this.cfg, '/api/internal/khach/tao-link-dat-lai', { subject, requested_by: 'e2e-nhan-vien', e2e_n: Math.random().toString(36).slice(2) });
    return { ok: r.status === 200, url: r.json?.data?.url, via: 'HMAC trực tiếp — CRM chưa có route nhân viên (CRM_RESET_LINK_ROUTE)', status: r.status };
  }

  /** Khoá / mở cổng của khách: POST /api/portal/customers/:id/lock {action, reason}. */
  async lock(subject, action) {
    await this.login();
    return this.api('POST', `/api/portal/customers/${this.customerIdOf(subject)}/lock`, { action, reason: `E2E ${action}` });
  }

  get canToggle() { return this.cfg.START; }
  async down() { await this.stack.stopCrm(); }
  async up() { await this.stack.startCrm(); }
  revokesReceived() { return null; }
}

async function waitForValue(fn, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* thử lại */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

export async function waitFor(fn, timeoutMs = 10_000, stepMs = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await fn()) return true; } catch { /* thử lại */ }
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return false;
}
