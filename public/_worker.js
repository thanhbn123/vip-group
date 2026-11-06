// VIP GROUP — nhận lead từ form website (VIPG-WEB-023). Cloudflare Pages "advanced mode".
// public/_routes.json chỉ cho /api/* đi qua file này; mọi trang tĩnh vẫn phục vụ thẳng (giữ nguyên _headers).
//
// Luồng POST /api/lead:
//   1. kiểm Origin cùng tên miền, JSON ≤ 8 KB, bẫy bot (honeypot + thời gian điền), dữ liệu hợp lệ
//   2. kiểm Cloudflare Turnstile (siteverify)
//   3. GHI Google Sheet qua Google Apps Script (sổ gốc) — chỉ báo "đã nhận" khi bước này thành công
//   4. báo Zalo Bot tới nhân viên (lỗi Zalo không ảnh hưởng khách)
//   Apps Script tự đẩy lead sang CRM V5 và gửi lại khi lỗi (ops/lead-sheet/Code.gs).
//
// Biến môi trường (đặt trong Cloudflare Pages → Settings → Variables and Secrets — KHÔNG vào git):
//   TURNSTILE_SECRET, SHEET_WEBHOOK_URL, SHEET_WEBHOOK_SECRET  (bắt buộc — thiếu thì trả 503 not_configured)
//   ZALO_BOT_TOKEN, ZALO_NOTIFY_CHAT_ID                         (tuỳ chọn — thiếu thì không báo Zalo)
// Không ghi họ tên / SĐT / nội dung vào log.

const MAX_BODY = 8 * 1024;
const MIN_FILL_MS = 3000;
export const NEEDS = {
  'bao-gia-van-chuyen': 'Báo giá vận chuyển Trung Quốc – Việt Nam',
  'nhap-khau-chinh-ngach': 'Nhập khẩu chính ngạch / hải quan',
  'hop-tac': 'Hợp tác',
  'khac': 'Khác',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '');

export function normalizePhone(raw) {
  const p = clean(raw, 20).replace(/[\s.\-()]/g, '').replace(/^\+84/, '0').replace(/^84(?=\d{9}$)/, '0');
  return /^0(3|5|7|8|9)\d{8}$/.test(p) ? p : null;
}

/** Kiểm dữ liệu form. Trả { lead } hoặc { errors: [tên trường] }. */
export function validate(body, now = Date.now()) {
  const errors = [];
  const name = clean(body.name, 80);
  if (name.length < 2) errors.push('name');
  const phone = normalizePhone(body.phone);
  if (!phone) errors.push('phone');
  const email = clean(body.email, 120) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('email');
  const need = clean(body.need, 40);
  if (!Object.hasOwn(NEEDS, need)) errors.push('need');
  let weight = null;
  if (body.weight_kg !== undefined && body.weight_kg !== null && body.weight_kg !== '') {
    weight = Number(String(body.weight_kg).replace(',', '.'));
    if (!Number.isFinite(weight) || weight < 0 || weight > 1_000_000) errors.push('weight_kg');
  }
  const message = clean(body.message, 1000);
  if (body.consent !== true) errors.push('consent');
  const key = clean(body.idempotency_key, 64);
  if (!/^[A-Za-z0-9-]{16,64}$/.test(key)) errors.push('idempotency_key');
  const page = clean(body.page, 200);
  const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  if (errors.length) return { errors };
  return {
    lead: {
      idempotency_key: key,
      source: 'vipgroup.com.vn',
      page: page.startsWith('/') ? page : '/',
      utm: { source: clean(utm.source, 80), medium: clean(utm.medium, 80), campaign: clean(utm.campaign, 120) },
      name, phone, email, need, weight_kg: weight, message,
      consent_at: new Date(now).toISOString(),
      created_at: new Date(now).toISOString(),
    },
  };
}

/** Bot: ô bẫy có chữ, hoặc gửi quá nhanh sau khi mở form. */
export function looksLikeBot(body, now = Date.now()) {
  if (clean(body.website, 200) !== '') return true;
  const started = Number(body.started_at);
  return !Number.isFinite(started) || now - started < MIN_FILL_MS || now - started > 24 * 3600 * 1000;
}

async function verifyTurnstile(env, token, ip, fetchImpl) {
  if (!token || typeof token !== 'string' || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const r = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const d = await r.json();
    return d.success === true;
  } catch {
    return false;
  }
}

async function saveToSheet(env, lead, fetchImpl) {
  const r = await fetchImpl(env.SHEET_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: env.SHEET_WEBHOOK_SECRET, action: 'append', lead }),
    redirect: 'follow',
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok !== true || typeof d.lead_id !== 'string') throw new Error(`sheet ${r.status} ${d.error ?? ''}`);
  return { lead_id: d.lead_id, duplicate: d.duplicate === true };
}

export function zaloText(lead, leadId, saved) {
  const lines = [
    saved ? '🔔 LEAD MỚI — vipgroup.com.vn' : '⚠️ LEAD MỚI — CHƯA LƯU ĐƯỢC SHEET, GỌI LẠI KHÁCH NGAY',
    leadId ? `Mã: ${leadId}` : null,
    `Khách: ${lead.name}`,
    `SĐT: ${lead.phone}`,
    lead.email ? `Email: ${lead.email}` : null,
    `Nhu cầu: ${NEEDS[lead.need]}`,
    lead.weight_kg !== null ? `Khối lượng: ${lead.weight_kg} kg` : null,
    lead.message ? `Nội dung: ${lead.message.slice(0, 500)}` : null,
    `Trang: ${lead.page}${lead.utm.source ? ` · nguồn ${lead.utm.source}` : ''}`,
    `Lúc: ${new Date(lead.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
  ];
  return lines.filter(Boolean).join('\n');
}

async function notifyZalo(env, text, fetchImpl) {
  if (!env.ZALO_BOT_TOKEN || !env.ZALO_NOTIFY_CHAT_ID) return false;
  try {
    const r = await fetchImpl(`https://bot-api.zapps.me/bot${env.ZALO_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.ZALO_NOTIFY_CHAT_ID, text }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function handleLead(request, env, ctx = {}, fetchImpl = fetch, now = Date.now()) {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!env.TURNSTILE_SECRET || !env.SHEET_WEBHOOK_URL || !env.SHEET_WEBHOOK_SECRET) return json(503, { ok: false, error: 'not_configured' });

  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (!origin || new URL(origin).host !== url.host) return json(403, { ok: false, error: 'origin' });
  if (!(request.headers.get('Content-Type') ?? '').startsWith('application/json')) return json(415, { ok: false, error: 'content_type' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { ok: false, error: 'too_large' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: 'json' }); }
  if (!body || typeof body !== 'object') return json(400, { ok: false, error: 'json' });

  // Bot: trả như thành công để bot không dò được luật, nhưng KHÔNG lưu, KHÔNG báo.
  if (looksLikeBot(body, now)) return json(201, { ok: true, lead_id: null });

  const { lead, errors } = validate(body, now);
  if (errors) return json(400, { ok: false, error: 'invalid', fields: errors });

  const ip = request.headers.get('CF-Connecting-IP');
  if (!(await verifyTurnstile(env, body.turnstile_token, ip, fetchImpl))) return json(403, { ok: false, error: 'turnstile' });

  let saved = null;
  try {
    saved = await saveToSheet(env, lead, fetchImpl);
  } catch (e) {
    console.error('lead: lưu Sheet lỗi', String(e).slice(0, 120));
  }
  if (saved?.duplicate) return json(200, { ok: true, lead_id: saved.lead_id, duplicate: true });

  const zalo = notifyZalo(env, zaloText(lead, saved?.lead_id ?? null, !!saved), fetchImpl);
  if (!saved) {
    // Không lưu được: vẫn báo Zalo (kênh dự phòng) và nói thật với khách.
    const notified = await zalo;
    return json(503, { ok: false, error: 'store_failed', notified });
  }
  if (ctx.waitUntil) ctx.waitUntil(zalo); else await zalo;
  return json(201, { ok: true, lead_id: saved.lead_id });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/lead') return handleLead(request, env, ctx);
    if (pathname.startsWith('/api/')) return json(404, { ok: false, error: 'not_found' });
    return env.ASSETS.fetch(request);
  },
};
