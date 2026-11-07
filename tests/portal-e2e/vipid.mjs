// Trợ giúp phía VIP ID realm khách: client HTTP thô qua proxy, đọc outbox (CLI khach-outbox), ký HMAC nội bộ.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { raw, absorb, cookieHeader, formField } from './http.mjs';
import { vipidCli, sqlRead } from './stack.mjs';

export const PW_STRONG = 'Tong-Hop-E2E-2026!a';

/** Client trình duyệt giả (HTTP thô) cho host khách qua proxy: jar cookie, tự gửi Origin same-origin. */
export class KhachClient {
  constructor(cfg, { ip } = {}) { this.cfg = cfg; this.jar = {}; this.ip = ip; }
  get origin() { return `http://${this.cfg.KHACH_HOST}`; }

  async req(method, path, { form, json, headers = {}, noOrigin = false } = {}) {
    const h = { ...headers };
    if (Object.keys(this.jar).length) h.cookie = cookieHeader(this.jar);
    let body;
    if (form) {
      body = new URLSearchParams(form).toString();
      h['content-type'] = 'application/x-www-form-urlencoded';
      if (!noOrigin) h.origin = this.origin;
    } else if (json !== undefined) {
      body = JSON.stringify(json);
      h['content-type'] = 'application/json';
      h['x-requested-with'] = 'XMLHttpRequest';
      if (!noOrigin) h.origin = this.origin;
    }
    const r = await raw({ port: this.cfg.PROXY_PORT, method, path, hostHeader: this.cfg.KHACH_HOST, headers: h, body });
    absorb(this.jar, r.setCookies);
    return r;
  }

  async csrfOf(path) {
    const r = await this.req('GET', path);
    return { r, csrf: formField(r.body, '_csrf') };
  }

  async register({ name, phone, email, password = PW_STRONG }) {
    const { csrf } = await this.csrfOf('/tai-khoan/dang-ky');
    return this.req('POST', '/tai-khoan/dang-ky', { form: { _csrf: csrf, ho_ten: name, sdt: phone, email, mat_khau: password, mat_khau_2: password, dong_y: '1' } });
  }

  /** GET link xác minh (không tiêu) rồi POST xác nhận. Trả {get, post}. */
  async verifyEmail(link) {
    const u = new URL(link);
    const get = await this.req('GET', u.pathname + u.search);
    const csrf = formField(get.body, '_csrf');
    const t = formField(get.body, 't');
    const post = await this.req('POST', '/tai-khoan/xac-minh-email', { form: { _csrf: csrf || '', t: t || u.searchParams.get('t') } });
    return { get, post };
  }

  async login(dinhDanh, password = PW_STRONG) {
    const { csrf } = await this.csrfOf('/tai-khoan/dang-nhap');
    return this.req('POST', '/tai-khoan/dang-nhap', { form: { _csrf: csrf, dinh_danh: dinhDanh, mat_khau: password } });
  }

  async logout() {
    const g = await this.req('GET', '/tai-khoan/dang-xuat');
    const csrf = formField(g.body, '_csrf');
    if (!csrf) return { get: g, post: null };
    return { get: g, post: await this.req('POST', '/tai-khoan/dang-xuat', { form: { _csrf: csrf } }) };
  }

  async forgot(dinhDanh) {
    const { csrf } = await this.csrfOf('/tai-khoan/quen-mat-khau');
    return this.req('POST', '/tai-khoan/quen-mat-khau', { form: { _csrf: csrf, dinh_danh: dinhDanh } });
  }

  /** Còn phiên VIP ID? /tai-khoan/vao-cong: có phiên → 303 sang CRM launch; không → 303 /tai-khoan/dang-nhap. */
  async hasSession() {
    const r = await this.req('GET', '/tai-khoan/vao-cong');
    return r.status === 303 && /\/portal\/auth\/launch\?token=/.test(r.headers.location || '');
  }
}

/** Đọc outbox qua CLI `cowork.cli khach-outbox` (đúng công cụ dev của VIP ID). Trả [{id, kind, to, subject, body}] */
export function outbox(cfg, n = 200) {
  const r = vipidCli(cfg, ['khach-outbox', '-n', String(n)]);
  if (r.code !== 0) throw new Error(`khach-outbox lỗi: ${r.err}`);
  const out = [];
  for (const block of r.out.split(/^--- /m).slice(1)) {
    const m = /^#(\d+) (\S+) \[([a-z_]+)\] → (\S+)\nTiêu đề: (.*)\n([\s\S]*)$/.exec(block);
    if (m) out.push({ id: Number(m[1]), at: m[2], kind: m[3], to: m[4], subject: m[5], body: m[6] });
  }
  return out;
}

export function lastMail(cfg, to, kind) {
  return outbox(cfg).filter((x) => x.to === to && (!kind || x.kind === kind)).at(-1) || null;
}

export function linkIn(mail, pathPart) {
  if (!mail) return null;
  const m = new RegExp(`https?://[^\\s]+${pathPart.replace(/[-/]/g, '\\$&')}\\?t=[A-Za-z0-9_-]+`).exec(mail.body);
  return m ? m[0] : null;
}

export function account(cfg, where, params) {
  return sqlRead(cfg, `SELECT id, subject, phone_e164, email_norm, status, portal_code, crm_customer_id, phone_conflict_count, token_version FROM customer_accounts WHERE ${where}`, params);
}

export function syncRows(cfg, subject) {
  return sqlRead(cfg, 'SELECT id, idem_key, kind, path, attempts, done_at, last_error FROM crm_sync_pending WHERE subject=? ORDER BY id', [subject]);
}

// ───────── HMAC nội bộ (CRM → VIP ID), đúng hợp đồng v1.1 §11.8 ─────────
export function portalSecret(cfg) {
  return (process.env.VIPID_PORTAL_SECRET || fs.readFileSync(cfg.secretFile, 'utf8')).trim();
}
export function signV11(secret, direction, method, path, ts, body) {
  return crypto.createHmac('sha256', secret).update(`${direction}.${method.toUpperCase()}.${path}.${ts}.${body}`).digest('hex');
}

/** POST thẳng tới VIP ID (không qua proxy), Host = host khách trực tiếp. Tuỳ biến từng phần để thử giả mạo. */
export async function internalPost(cfg, path, payload, o = {}) {
  const body = o.rawBody ?? JSON.stringify(payload);
  const ts = String(o.ts ?? Math.floor(Date.now() / 1000));
  const secret = o.secret ?? portalSecret(cfg);
  const sig = o.sig ?? signV11(secret, o.direction ?? 'crm->vipid', o.signMethod ?? 'POST', o.signPath ?? path, ts, o.signBody ?? body);
  const headers = { 'content-type': 'application/json', ...(o.noTs ? {} : { 'x-portal-ts': ts }), ...(o.noSig ? {} : { 'x-portal-sig': sig }), ...(o.headers || {}) };
  const r = await raw({ port: o.port ?? cfg.VIPID_PORT, method: 'POST', path, hostHeader: o.hostHeader ?? cfg.KHACH_HOST_DIRECT, headers, body });
  let json = null; try { json = JSON.parse(r.body); } catch { /* không phải JSON */ }
  return { ...r, json, sig, ts, body };
}

/** Giải mã launch token (không kiểm) + kiểm chữ ký HS256 bằng bí mật portal. */
export function decodeLaunch(cfg, token) {
  const [h, p, s] = token.split('.');
  const dec = (x) => JSON.parse(Buffer.from(x, 'base64url').toString('utf8'));
  const want = crypto.createHmac('sha256', portalSecret(cfg)).update(`${h}.${p}`).digest('base64url');
  return { header: dec(h), claims: dec(p), sigOk: want === s };
}

/** Mã định danh tổng hợp duy nhất cho mỗi lượt chạy (SĐT +849000xxxxx, email @example.test, mã VG9xxxxx). */
export function synth(runTag, i) {
  let n = (Number.parseInt(runTag, 36) + i * 7919) % 100000;
  if (n < 100) n += 100; // tránh +84900000001..99 (SĐT seed demo CRM và SĐT cố định của kịch bản)
  const tail = String(n).padStart(5, '0');
  return {
    phoneLocal: `09000${tail}`, phone: `+849000${tail}`,
    email: `e2e-${runTag}-${i}@example.test`,
    code: `VG9${String((n + i) % 100000).padStart(5, '0')}`,
  };
}
