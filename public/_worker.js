// VIP GROUP — nhận lead từ form website (VIPG-WEB-023, VIPG-WEB-031). Cloudflare Pages "advanced mode".
// public/_routes.json cho /api/* (lead) và trang chủ + /tin-tuc/… (tin tức, VIPG-WEB-030 bên dưới) đi qua file này; trang khác vẫn tĩnh (giữ _headers).
//
// Luồng POST /api/lead:
//   1. kiểm Origin cùng tên miền, JSON ≤ 8 KB, bẫy bot (honeypot + thời gian điền), dữ liệu hợp lệ
//   2. kiểm Cloudflare Turnstile (siteverify)
//   3. LƯU — VIPG-WEB-031 (chủ dự án 13/11/2026, "cách 2"): gửi THẲNG vào CRM (POST {CRM}/api/intake/leads, ký HMAC theo hợp đồng
//      CRM: X-Lead-Timestamp + X-Lead-Signature = hex(HMAC-SHA256(LEAD_INTAKE_SECRET, ts + "." + body)) + Idempotency-Key = lead_id).
//      Chưa cấu hình CRM mà còn cấu hình Google Sheet cũ → ghi Sheet như trước. Chỉ báo "đã nhận" khi lưu thành công.
//   4. báo Zalo Bot tới nhân viên (lỗi Zalo không ảnh hưởng khách)
//
// Biến môi trường (đặt trong Cloudflare Pages → Settings → Variables and Secrets — KHÔNG vào git):
//   TURNSTILE_SECRET                                   (bắt buộc)
//   LEAD_INTAKE_SECRET + CRM_INTAKE_URL hoặc CRM_NEWS_URL   (đích lưu chính — CRM; CRM_INTAKE_URL mặc định = CRM_NEWS_URL + /api/intake/leads)
//   SHEET_WEBHOOK_URL, SHEET_WEBHOOK_SECRET            (đích cũ — chỉ dùng khi chưa cấu hình CRM)
//   Không có đích lưu nào → 503 not_configured.
//   ZALO_BOT_TOKEN, ZALO_NOTIFY_CHAT_ID                (tuỳ chọn — thiếu thì không báo Zalo)
// Không ghi họ tên / SĐT / nội dung vào log.

const MAX_BODY = 8 * 1024;
const MIN_FILL_MS = 3000;
export const ROUTES = {
  'tham-quyen': 'Thâm Quyến', 'quang-chau': 'Quảng Châu', 'ha-mon': 'Hạ Môn', 'nghia-o': 'Nghĩa Ô',
  'khac': 'Nơi khác tại Trung Quốc', 'chua-ro': 'Chưa rõ',
};
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
  const route = clean(body.route, 40) || 'chua-ro';
  if (!Object.hasOwn(ROUTES, route)) errors.push('route');
  let weight = null;
  if (body.weight_kg !== undefined && body.weight_kg !== null && body.weight_kg !== '') {
    weight = Number(String(body.weight_kg).replace(',', '.'));
    if (!Number.isFinite(weight) || weight < 0 || weight > 1_000_000) errors.push('weight_kg');
  }
  const message = clean(body.message, 1000);
  if (body.consent !== true) errors.push('consent');
  const key = clean(body.idempotency_key, 64);
  if (!/^[A-Za-z0-9-]{16,64}$/.test(key)) errors.push('idempotency_key');
  // Chỉ nhận đường dẫn nội bộ dạng "/…" (không "//host", không ký tự lạ) — giá trị này vào Sheet và tin Zalo (QA P2-5).
  const pageRaw = clean(body.page, 200);
  const page = /^\/(?!\/)[\w\-./%?=&#]*$/.test(pageRaw) ? pageRaw : '/';
  const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  if (errors.length) return { errors };
  return {
    lead: {
      idempotency_key: key,
      source: 'vipgroup.com.vn',
      page,
      utm: { source: clean(utm.source, 80), medium: clean(utm.medium, 80), campaign: clean(utm.campaign, 120) },
      name, phone, email, need, route, weight_kg: weight, message,
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
    const r = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) });
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
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok !== true || typeof d.lead_id !== 'string') throw new Error(`sheet ${r.status} ${d.error ?? ''}`);
  return { lead_id: d.lead_id, duplicate: d.duplicate === true };
}

/** Đích lưu CRM (VIPG-WEB-031): URL nhận lead của CRM + khóa ký; null nếu chưa cấu hình. */
export function crmTarget(env) {
  const secret = env.LEAD_INTAKE_SECRET;
  const base = (env.CRM_INTAKE_URL || (env.CRM_NEWS_URL ? `${String(env.CRM_NEWS_URL).replace(/\/+$/, '')}/api/intake/leads` : '')).trim();
  return secret && /^https:\/\//.test(base) ? { url: base, secret } : null;
}
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function signLead(secret, ts, raw) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${raw}`)));
}
/** Payload đúng hợp đồng CRM (server/modules/leads/intake.js validateLead). Tuyến ghi vào đầu nội dung như Apps Script cũ. */
export function crmPayload(lead) {
  const msg = `${lead.route && lead.route !== 'chua-ro' ? `[Tuyến: ${ROUTES[lead.route] || lead.route}] ` : ''}${lead.message || ''}`.trim();
  const utm = Object.fromEntries(Object.entries(lead.utm || {}).filter(([, v]) => v));
  return {
    lead_id: lead.idempotency_key, source: lead.source, page: lead.page, utm: Object.keys(utm).length ? utm : null,
    name: lead.name, phone: lead.phone, email: lead.email, need: lead.need, weight_kg: lead.weight_kg, message: msg || null,
    consent_at: lead.consent_at, created_at: lead.created_at,
  };
}
async function saveToCrm(target, lead, fetchImpl, now = Date.now()) {
  const raw = JSON.stringify(crmPayload(lead));
  const ts = String(Math.floor(now / 1000));
  const r = await fetchImpl(target.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lead-Timestamp': ts, 'X-Lead-Signature': await signLead(target.secret, ts, raw), 'Idempotency-Key': lead.idempotency_key },
    body: raw,
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json().catch(() => ({}));
  if ((r.status !== 201 && r.status !== 200) || typeof d.crm_lead_id !== 'string') throw new Error(`crm ${r.status} ${d?.error?.code ?? ''}`);
  return { lead_id: d.crm_lead_id, duplicate: d.duplicate === true };
}
export function zaloText(lead, leadId, saved) {
  const lines = [
    saved ? '🔔 LEAD MỚI — vipgroup.com.vn' : '⚠️ LEAD MỚI — CHƯA LƯU ĐƯỢC, GỌI LẠI KHÁCH NGAY',
    leadId ? `Mã: ${leadId}` : null,
    `Khách: ${lead.name}`,
    `SĐT: ${lead.phone}`,
    lead.email ? `Email: ${lead.email}` : null,
    `Nhu cầu: ${NEEDS[lead.need]}`,
    `Tuyến: ${ROUTES[lead.route]}`,
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
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function handleLead(request, env, ctx = {}, fetchImpl = fetch, now = Date.now()) {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' });
  const crmT = crmTarget(env);
  const sheetOk = !!(env.SHEET_WEBHOOK_URL && env.SHEET_WEBHOOK_SECRET);
  if (!env.TURNSTILE_SECRET || (!crmT && !sheetOk)) return json(503, { ok: false, error: 'not_configured' });

  const url = new URL(request.url);
  // Cùng nguồn (scheme + host). Origin "null"/hỏng → 403, không để lỗi 500 (QA P2-1, P2-2).
  const origin = request.headers.get('Origin');
  let sameOrigin = false;
  try { sameOrigin = !!origin && new URL(origin).origin === url.origin; } catch { sameOrigin = false; }
  if (!sameOrigin) return json(403, { ok: false, error: 'origin' });
  if (!(request.headers.get('Content-Type') ?? '').startsWith('application/json')) return json(415, { ok: false, error: 'content_type' });
  // Chặn sớm theo Content-Length trước khi đọc body (QA P2-3); vẫn kiểm lại độ dài thực sau khi đọc.
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return json(413, { ok: false, error: 'too_large' });
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
    saved = crmT ? await saveToCrm(crmT, lead, fetchImpl, now) : await saveToSheet(env, lead, fetchImpl);
  } catch (e) {
    console.error(crmT ? 'lead: lưu CRM lỗi' : 'lead: lưu Sheet lỗi', String(e).slice(0, 120));
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


// ═════════════════════════════════════════════════════════════════════════════════════════════════════
// VIPG-WEB-030 · Tin tức từ CRM (chủ dự án 13/11/2026: đăng trong CRM là lên website ngay; SEO đầy đủ; tiếng Việt + tiếng Trung).
// _routes.json cho thêm "/", "/tin-tuc/*", "/zh/tin-tuc/*" đi qua file này; trang khác vẫn tĩnh.
// Biến môi trường (Cloudflare Pages → Settings → Variables and Secrets):
//   CRM_NEWS_URL     https://crm.vipgroup.com.vn   (không có "/" cuối)
//   NEWS_PUBLIC_KEY  (Secret) — trùng NEWS_PUBLIC_KEY của CRM
// Thiếu một trong hai → các trang trên chạy y như trước (trang tĩnh "Chưa có tin tức"), không lỗi.
// Dựng HTML: KHUNG là trang tĩnh /tin-tuc/ (hoặc trang chủ), thay đoạn giữa hai mốc <template data-news-…-start/end> và thẻ
// <title> / description / canonical / og:*. Mọi chữ từ CRM đều được escape; CRM chỉ gửi KHỐI JSON, không gửi HTML.
// CRM lỗi / chậm (> 4 s) → dùng bản lưu gần nhất (≤ 7 ngày) trong bộ đệm Cloudflare; không có → giữ trang tĩnh.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════
const SITE_NAME = 'VIP GROUP';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const T = {
  vi: {
    base: '/tin-tuc/', html: 'vi', og: 'vi_VN', home: 'Trang chủ', news: 'Tin tức', all: 'Tất cả', back: '← Tất cả tin tức', read: 'Đọc tiếp →',
    listTitle: 'Tin tức', listLead: 'Tin tức, thông báo và hoạt động chính thức của VIP GROUP và các công ty thành viên.',
    listDesc: 'Tin tức, thông báo và hoạt động chính thức của VIP GROUP cùng các công ty thành viên trong hệ sinh thái.',
    empty: 'Chưa có tin tức.', emptySub: 'Thông tin chính thức từ VIP GROUP sẽ được đăng tại đây.', other: '中文', otherLang: 'zh', published: 'Đăng ngày',
    cats: { company: 'Tin công ty', announcement: 'Thông báo', logistics: 'Kiến thức logistics', careers: 'Tuyển dụng' },
  },
  zh: {
    base: '/zh/tin-tuc/', html: 'zh-CN', og: 'zh_CN', home: '首页', news: '新闻', all: '全部', back: '← 返回新闻列表', read: '阅读全文 →',
    listTitle: '新闻资讯', listLead: 'VIP GROUP 及成员公司的官方新闻、公告与动态。', listDesc: 'VIP GROUP 及成员公司的官方新闻、公告与动态。',
    empty: '暂无新闻。', emptySub: 'VIP GROUP 的官方信息将在此发布。', other: 'Tiếng Việt', otherLang: 'vi', published: '发布日期',
    cats: { company: '公司新闻', announcement: '通知公告', logistics: '物流知识', careers: '招聘信息' },
  },
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = esc;

/** Liên kết an toàn (CRM đã kiểm; kiểm lại ở đây): http(s), mailto:, tel:, đường dẫn nội bộ "/…". */
export function safeHref(h) {
  const s = String(h || '').trim();
  if (/^\/(?!\/)/.test(s)) return s;
  if (/^(mailto|tel):[^\s<>"']+$/i.test(s)) return s;
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch { return null; }
}
const isExternal = (href) => /^https?:/i.test(href) && !/^https?:\/\/(www\.)?vipgroup\.com\.vn(\/|$)/i.test(href);

function spansHtml(spans) {
  return (spans || []).map((sp) => {
    let h = esc(sp.t).replace(/\n/g, '<br>');
    if (sp.i) h = `<em>${h}</em>`;
    if (sp.b) h = `<strong>${h}</strong>`;
    const href = sp.href ? safeHref(sp.href) : null;
    if (href) h = `<a href="${attr(href)}"${isExternal(href) ? ' rel="noopener nofollow" target="_blank"' : ''}>${h}</a>`;
    return h;
  }).join('');
}
const imgUrl = (base, id) => `${base}anh/${id}`;

/** Khối nội dung → HTML (mọi chữ đã escape; loại khối lạ bỏ qua). */
export function blocksHtml(blocks, { base = '/tin-tuc/', media = {} } = {}) {
  return (blocks || []).map((b) => {
    switch (b.type) {
      case 'p': return `<p>${spansHtml(b.spans)}</p>`;
      case 'quote': return `<blockquote><p>${spansHtml(b.spans)}</p></blockquote>`;
      case 'h2': return `<h2>${esc(b.text)}</h2>`;
      case 'h3': return `<h3>${esc(b.text)}</h3>`;
      case 'ul': case 'ol': return `<${b.type}>${(b.items || []).map((it) => `<li>${spansHtml(it)}</li>`).join('')}</${b.type}>`;
      case 'image': {
        if (!UUID.test(b.media_id || '')) return '';
        const m = media[b.media_id] || {};
        const dim = m.width && m.height ? ` width="${Number(m.width)}" height="${Number(m.height)}"` : '';
        return `<figure><img src="${imgUrl(base, b.media_id)}" alt="${attr(b.caption || m.alt || '')}"${dim} loading="lazy" decoding="async">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
      }
      default: return '';
    }
  }).join('\n');
}

const fmtDate = (iso, lang) => new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso));

/** Thẻ tin (dùng cho trang danh sách + trang chủ). */
export function cardsHtml(items, { lang = 'vi', heading = 'h2' } = {}) {
  const t = T[lang];
  if (!items.length) return `<div class="empty-state"><p><strong>${esc(t.empty)}</strong></p><p>${esc(t.emptySub)}</p></div>`;
  return `<div class="grid grid-3 news-grid">${items.map((n) => {
    const href = `${t.base}${n.slug}/`;
    const cover = n.cover && UUID.test(n.cover.id || '')
      ? `<a href="${attr(href)}" tabindex="-1" aria-hidden="true"><img src="${imgUrl(t.base, n.cover.id)}" alt=""${n.cover.width ? ` width="${Number(n.cover.width)}" height="${Number(n.cover.height)}"` : ''} loading="lazy" decoding="async"></a>` : '';
    return `<article class="card">${cover}<div class="news-card-body"><span class="card-index">${esc(t.cats[n.category] || '')}</span>`
      + `<${heading}><a href="${attr(href)}">${esc(n.title)}</a></${heading}><time datetime="${attr(n.publish_at)}" class="muted">${esc(fmtDate(n.publish_at, lang))}</time>`
      + `<p>${esc(n.summary)}</p></div></article>`;
  }).join('')}</div>`;
}

function heroHtml(lang, { crumb, kicker, title, lead, meta = '' }) {
  const t = T[lang];
  return `<section class="page-hero"><div class="container"><nav class="breadcrumb" aria-label="${lang === 'zh' ? '路径' : 'Đường dẫn'}"><ol>`
    + `<li><a href="/">${esc(t.home)}</a></li>${crumb ? `<li><a href="${t.base}">${esc(t.news)}</a></li><li aria-current="page">${esc(crumb)}</li>` : `<li aria-current="page">${esc(t.news)}</li>`}`
    + `</ol></nav><span class="kicker">${esc(kicker)}</span><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}${meta}</div></section>`;
}

export function listPageHtml(data, { lang = 'vi', category = null } = {}) {
  const t = T[lang];
  const cats = `<nav class="news-cats" aria-label="${lang === 'zh' ? '分类' : 'Chuyên mục'}"><a href="${t.base}"${category ? '' : ' aria-current="page"'}>${esc(t.all)}</a>`
    + Object.entries(t.cats).map(([k, v]) => `<a href="${t.base}?chuyen-muc=${k}"${category === k ? ' aria-current="page"' : ''}>${esc(v)}</a>`).join('') + '</nav>';
  const items = category ? data.items.filter((n) => n.category === category) : data.items;
  return heroHtml(lang, { kicker: t.news, title: t.listTitle, lead: t.listLead })
    + `<section class="section" aria-label="${esc(t.listTitle)}"><div class="container">${cats}${cardsHtml(items, { lang })}</div></section>`;
}

export function articlePageHtml(a, { lang = 'vi' } = {}) {
  const t = T[lang];
  const other = a.langs?.includes(t.otherLang) ? ` · <a href="${T[t.otherLang].base}${a.slug}/" hreflang="${T[t.otherLang].html}" lang="${T[t.otherLang].html}">${esc(t.other)}</a>` : '';
  const meta = `<p class="news-meta"><span>${esc(t.published)} <time datetime="${attr(a.publish_at)}">${esc(fmtDate(a.publish_at, lang))}</time></span>${other ? `<span>${other.slice(3)}</span>` : ''}</p>`;
  const cover = a.cover && UUID.test(a.cover.id || '')
    ? `<figure class="news-cover"><img src="${imgUrl(t.base, a.cover.id)}" alt="${attr(a.cover.alt || a.title)}"${a.cover.width ? ` width="${Number(a.cover.width)}" height="${Number(a.cover.height)}"` : ''} decoding="async"></figure>` : '';
  return heroHtml(lang, { crumb: a.title, kicker: t.cats[a.category] || t.news, title: a.title, lead: a.summary, meta })
    + `<section class="section"><div class="container"><article class="news-article">${cover}${blocksHtml(a.blocks, { base: t.base, media: a.media || {} })}</article>`
    + `<p class="news-back"><a class="text-link" href="${t.base}">${esc(t.back)}</a></p></div></section>`;
}

/** Thay đoạn giữa <template data-X-start…></template> và <template data-X-end></template>. */
export function replaceBetween(html, name, inner) {
  const re = new RegExp(`(<template data-${name}-start[^>]*></template>)[\\s\\S]*?(<template data-${name}-end></template>)`);
  return re.test(html) ? html.replace(re, `$1${inner}$2`) : html;
}

/** Sửa phần đầu trang: tiêu đề, mô tả, canonical, og:*, lang, hreflang, JSON-LD bài viết. */
export function patchHead(html, { lang, title, description, url, ogType = 'website', image = null, alternates = null, jsonLd = null }) {
  const t = T[lang];
  const full = `${title} | ${SITE_NAME}`;
  let out = html
    .replace(/<html lang="[^"]*"/, `<html lang="${t.html}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(full)}</title>`)
    .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${attr(description)}"`)
    .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${attr(url)}"`)
    .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${attr(full)}"`)
    .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${attr(description)}"`)
    .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${attr(url)}"`)
    .replace(/<meta property="og:type" content="[^"]*"/, `<meta property="og:type" content="${ogType}"`)
    .replace(/<meta property="og:locale" content="[^"]*"/, `<meta property="og:locale" content="${t.og}"`);
  if (image) {
    out = out.replace(/<meta property="og:image" content="[^"]*"/, `<meta property="og:image" content="${attr(image.url)}"`)
      .replace(/<meta property="og:image:width" content="[^"]*"/, `<meta property="og:image:width" content="${Number(image.width) || 1200}"`)
      .replace(/<meta property="og:image:height" content="[^"]*"/, `<meta property="og:image:height" content="${Number(image.height) || 630}"`)
      .replace(/<meta property="og:image:alt" content="[^"]*"/, `<meta property="og:image:alt" content="${attr(title)}"`);
  }
  const extra = [];
  if (alternates) for (const [l, href] of Object.entries(alternates)) extra.push(`<link rel="alternate" hreflang="${T[l].html}" href="${attr(href)}">`);
  // JSON-LD không chạy như script → không vướng CSP; "<" được thoát để không đóng thẻ sớm
  if (jsonLd) extra.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`);
  return extra.length ? out.replace('</head>', `${extra.join('')}</head>`) : out;
}

// ───────── Gọi CRM (có bộ đệm dự phòng) ─────────
const STALE_HOST = 'https://news-stale.vipgroup.internal';
async function crm(env, path, ctx, { binary = false } = {}) {
  const url = `${env.CRM_NEWS_URL}/api/public/${path}`;
  const staleKey = new Request(`${STALE_HOST}/${path}`);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  try {
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 4000);
    const r = await fetch(url, { headers: { 'x-news-key': env.NEWS_PUBLIC_KEY, accept: binary ? '*/*' : 'application/json' }, signal: ac.signal,
      cf: { cacheTtl: binary ? 86400 : 30, cacheEverything: true } });
    clearTimeout(timer);
    if (r.status === 404) return { notFound: true };
    if (!r.ok) throw new Error(`CRM ${r.status}`);
    if (binary) return { res: r };
    const data = await r.json();
    if (cache && ctx?.waitUntil) ctx.waitUntil(cache.put(staleKey, new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=604800' } })));
    return { data };
  } catch {
    if (!binary && cache) { const s = await cache.match(staleKey); if (s) return { data: await s.json(), stale: true }; }
    return { error: true };
  }
}

// Header bảo mật như public/_headers (phản hồi do hàm dựng không chắc được Cloudflare gắn _headers) + noindex trên tên miền xem trước của Cloudflare Pages
export function secHeaders(url, extra = {}) {
  const h = new Headers({ 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()', 'x-frame-options': 'DENY',
    'content-security-policy': "frame-ancestors 'none'", 'cross-origin-opener-policy': 'same-origin', ...extra });
  if (/\.pages\.dev$/i.test(new URL(url).hostname)) h.set('x-robots-tag', 'noindex');
  return h;
}
const htmlResponse = (request, body, status = 200) => new Response(body, { status, headers: secHeaders(request.url, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' }) });
async function notFound(env, request) {
  const r = await env.ASSETS.fetch(new Request(new URL('/404.html', request.url)));
  return new Response(await r.text(), { status: 404, headers: secHeaders(request.url, { 'content-type': 'text/html; charset=utf-8' }) });
}

export async function handleNews(request, env, ctx) {
  const url = new URL(request.url);
  const configured = env.CRM_NEWS_URL && env.NEWS_PUBLIC_KEY;
  const method = request.method;
  if (!configured || (method !== 'GET' && method !== 'HEAD')) return env.ASSETS.fetch(request);
  const origin = url.origin;
  const path = url.pathname;

  // Trang chủ: khối "Tin mới" (3 bài)
  if (path === '/') {
    const page = await env.ASSETS.fetch(request);
    if (!page.ok || !(page.headers.get('content-type') || '').includes('text/html')) return page;
    const r = await crm(env, 'news?lang=vi&limit=3', ctx);
    if (!r.data) return page;
    const html = replaceBetween(await page.text(), 'news-list', cardsHtml(r.data.items.slice(0, 3), { lang: 'vi', heading: 'h3' }));
    return new Response(html, { status: 200, headers: secHeaders(request.url, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' }) });
  }

  const m = path.match(/^\/(zh\/)?tin-tuc(\/.*)?$/);
  if (!m) return env.ASSETS.fetch(request);
  const lang = m[1] ? 'zh' : 'vi';
  const t = T[lang];
  const rest = (m[2] || '/').replace(/^\//, '');

  // Ảnh: /tin-tuc/anh/<id> (chỉ ảnh của bài đang đăng — CRM kiểm)
  const img = rest.match(/^anh\/([0-9a-f-]{36})$/i);
  if (img) {
    if (!UUID.test(img[1])) return notFound(env, request);
    const r = await crm(env, `news-media/${img[1].toLowerCase()}`, ctx, { binary: true });
    if (!r.res) return r.notFound ? notFound(env, request) : new Response('', { status: 503 });
    return new Response(r.res.body, { status: 200, headers: secHeaders(request.url, { 'content-type': r.res.headers.get('content-type') || 'image/jpeg', 'cache-control': 'public, max-age=86400' }) });
  }

  // Sitemap tin tức
  if (rest === 'sitemap.xml' && lang === 'vi') {
    const [vi, zh] = await Promise.all([crm(env, 'news?lang=vi&limit=200', ctx), crm(env, 'news?lang=zh&limit=200', ctx)]);
    const urls = [`${origin}/tin-tuc/`, ...((vi.data?.items || []).map((n) => `${origin}/tin-tuc/${n.slug}/`)),
      ...((zh.data?.items || []).length ? [`${origin}/zh/tin-tuc/`] : []), ...((zh.data?.items || []).map((n) => `${origin}/zh/tin-tuc/${n.slug}/`))];
    const lastmod = new Map([...(vi.data?.items || [])].map((n) => [`${origin}/tin-tuc/${n.slug}/`, n.updated_at || n.publish_at]));
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc>${lastmod.get(u) ? `<lastmod>${esc(String(lastmod.get(u)).slice(0, 10))}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
    return new Response(body, { headers: secHeaders(request.url, { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' }) });
  }

  const tpl = await env.ASSETS.fetch(new Request(new URL('/tin-tuc/', request.url)));
  if (!tpl.ok) return tpl;
  const template = await tpl.text();

  // Danh sách
  if (rest === '') {
    const category = T.vi.cats[url.searchParams.get('chuyen-muc') || ''] ? url.searchParams.get('chuyen-muc') : null;
    const r = await crm(env, `news?lang=${lang}&limit=200`, ctx);
    if (!r.data) return lang === 'zh' ? notFound(env, request) : htmlResponse(template);
    const self = `${origin}${t.base}${category ? `?chuyen-muc=${category}` : ''}`;
    let html = replaceBetween(template, 'news-page', listPageHtml(r.data, { lang, category }));
    html = patchHead(html, { lang, title: category ? `${t.cats[category]} — ${t.listTitle}` : t.listTitle, description: t.listDesc, url: self,
      alternates: lang === 'zh' || r.data.items.some((n) => n.langs?.includes('zh')) ? { vi: `${origin}/tin-tuc/`, zh: `${origin}/zh/tin-tuc/` } : null });
    return htmlResponse(request, html);
  }

  // Bài viết: /tin-tuc/<slug>/ (thiếu "/" cuối → chuyển hướng)
  const sm = rest.match(/^([a-z0-9-]+)(\/)?$/);
  if (!sm || !SLUG.test(sm[1])) return notFound(env, request);
  if (!sm[2]) return Response.redirect(`${origin}${t.base}${sm[1]}/${url.search}`, 301);
  const r = await crm(env, `news/${sm[1]}?lang=${lang}`, ctx);
  if (r.notFound) return notFound(env, request);
  if (!r.data) return htmlResponse(request, template, 503);
  const a = r.data;
  const self = `${origin}${t.base}${a.slug}/`;
  const alternates = a.langs?.includes('zh') ? { vi: `${origin}/tin-tuc/${a.slug}/`, zh: `${origin}/zh/tin-tuc/${a.slug}/` } : null;
  const image = a.cover ? { url: `${origin}${imgUrl(t.base, a.cover.id)}`, width: a.cover.width, height: a.cover.height } : null;
  let html = replaceBetween(template, 'news-page', articlePageHtml(a, { lang }));
  html = patchHead(html, { lang, title: a.seo_title || a.title, description: a.seo_description || a.summary, url: self, ogType: 'article', image, alternates,
    jsonLd: { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: a.title, description: a.summary, datePublished: a.publish_at,
      dateModified: a.updated_at || a.publish_at, inLanguage: t.html, mainEntityOfPage: self, ...(image ? { image: [image.url] } : {}),
      publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${origin}/logo-vip-group.png` } } } });
  return htmlResponse(request, html);
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/lead') return handleLead(request, env, ctx);
    if (pathname.startsWith('/api/')) return json(404, { ok: false, error: 'not_found' });
    // VIPG-WEB-030: trang chủ + /tin-tuc/… + /zh/tin-tuc/… (tin tức từ CRM)
    if (pathname === '/' || /^\/(zh\/)?tin-tuc(\/|$)/.test(pathname)) return handleNews(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
