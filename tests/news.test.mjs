// VIPG-WEB-030 · Tin tức từ CRM qua public/_worker.js (chạy trên bản build dist/, CRM giả). Chạy: npm run build && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const W = await import(pathToFileURL(join(root, 'public/_worker.js')).href);
const ORIGIN = 'https://www.vipgroup.com.vn';
const KEY = 'k'.repeat(40);
const IMG = '11111111-2222-4333-8444-555555555555';

const ASSETS = { async fetch(req) {
  const p = new URL(req.url).pathname;
  const file = p.endsWith('.html') ? join(dist, p) : join(dist, p, 'index.html');
  if (!existsSync(file)) return new Response('nf', { status: 404 });
  return new Response(readFileSync(file, 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
} };
const POST = { slug: 'khai-truong-kho', category: 'company', title: 'Khai trương <kho> "Bắc Ninh"', summary: 'Tóm tắt & giới thiệu', seo_title: 'Khai trương kho', seo_description: 'Mô tả SEO',
  langs: ['vi', 'zh'], publish_at: '2026-11-13T03:00:00.000Z', updated_at: '2026-11-13T03:00:00.000Z', cover: { id: IMG, width: 640, height: 480 }, media: { [IMG]: { width: 640, height: 480 } },
  blocks: [{ type: 'h2', text: 'Mục <1>' }, { type: 'p', spans: [{ t: 'Đậm', b: true }, { t: ' link', href: 'javascript:alert(1)' }, { t: ' ngoài', href: 'https://example.com/x' }] },
    { type: 'ul', items: [[{ t: 'A' }], [{ t: 'B' }]] }, { type: 'image', media_id: IMG, caption: 'Ảnh "kho"' }, { type: 'script', text: 'alert(1)' }] };
function crmFetch(calls, { down = false } = {}) {
  return async (url, init) => {
    calls.push({ url: String(url), key: init?.headers?.['x-news-key'] });
    if (down) throw new Error('down');
    const u = new URL(url);
    if (init?.headers?.['x-news-key'] !== KEY) return new Response('{}', { status: 404 });
    if (u.pathname === '/api/public/news') return Response.json({ items: [{ ...POST, cover: POST.cover }] });
    if (u.pathname === `/api/public/news/${POST.slug}`) return Response.json(u.searchParams.get('lang') === 'zh' ? { ...POST, title: '北宁仓库开业', lang: 'zh' } : POST);
    if (u.pathname === `/api/public/news-media/${IMG}`) return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'content-type': 'image/jpeg' } });
    return new Response('{}', { status: 404 });
  };
}
async function call(path, { env = { CRM_NEWS_URL: 'https://crm.example', NEWS_PUBLIC_KEY: KEY }, down = false } = {}) {
  const calls = []; const orig = globalThis.fetch;
  globalThis.fetch = crmFetch(calls, { down });
  try {
    const r = await W.default.fetch(new Request(ORIGIN + path), { ...env, ASSETS }, { waitUntil() {} });
    return { r, text: r.headers.get('content-type')?.includes('image') ? '' : await r.text(), calls };
  } finally { globalThis.fetch = orig; }
}

test('chưa cấu hình CRM → trang tĩnh y như cũ, không gọi CRM', async () => {
  const { r, text, calls } = await call('/tin-tuc/', { env: {} });
  assert.equal(r.status, 200); assert.match(text, /Chưa có tin tức/); assert.equal(calls.length, 0);
});

test('danh sách /tin-tuc/: thẻ tin từ CRM, escape, canonical / tiêu đề đúng, gửi khóa; header bảo mật', async () => {
  const { r, text, calls } = await call('/tin-tuc/');
  assert.equal(r.status, 200);
  assert.ok(calls.every((c) => c.key === KEY));
  assert.match(text, /href="\/tin-tuc\/khai-truong-kho\/"/);
  assert.match(text, /Khai trương &lt;kho&gt; &quot;Bắc Ninh&quot;/);
  assert.ok(!text.includes('<kho>'));
  assert.match(text, /<title>Tin tức \| VIP GROUP<\/title>/);
  assert.match(text, /<link rel="canonical" href="https:\/\/www\.vipgroup\.com\.vn\/tin-tuc\/"/);
  assert.match(text, /hreflang="zh-CN"/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY'); assert.equal(r.headers.get('x-robots-tag'), null);
  assert.match(text, /<meta http-equiv="content-security-policy"/i, 'giữ CSP của khung');
});

test('bài viết: khối → HTML an toàn (bỏ javascript:, bỏ khối lạ, link ngoài nofollow), SEO + JSON-LD, ảnh qua /tin-tuc/anh/', async () => {
  const { r, text } = await call('/tin-tuc/khai-truong-kho/');
  assert.equal(r.status, 200);
  assert.match(text, /<h1>Khai trương &lt;kho&gt; &quot;Bắc Ninh&quot;<\/h1>/);
  assert.match(text, /<h2>Mục &lt;1&gt;<\/h2>/);
  assert.ok(!/javascript:/i.test(text.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')), 'lọt javascript:');
  assert.ok(!text.includes('alert(1)'), 'lọt khối lạ');
  assert.match(text, /<a href="https:\/\/example\.com\/x" rel="noopener nofollow" target="_blank">/);
  assert.match(text, /<img src="\/tin-tuc\/anh\/11111111-2222-4333-8444-555555555555" alt="Ảnh &quot;kho&quot;" width="640" height="480"/);
  assert.match(text, /<title>Khai trương kho \| VIP GROUP<\/title>/);
  assert.match(text, /<meta name="description" content="Mô tả SEO"/);
  assert.match(text, /<meta property="og:type" content="article"/);
  assert.match(text, /"@type":"NewsArticle"/);
  assert.match(text, /href="\/zh\/tin-tuc\/khai-truong-kho\/"/);
});

test('tiếng Trung /zh/tin-tuc/<slug>/: lang zh-CN, nhãn tiếng Trung; thiếu "/" → 301; slug lạ / CRM 404 → 404', async () => {
  const zh = await call('/zh/tin-tuc/khai-truong-kho/');
  assert.equal(zh.r.status, 200); assert.match(zh.text, /<html lang="zh-CN"/); assert.match(zh.text, /北宁仓库开业/); assert.match(zh.text, /公司新闻/);
  const red = await call('/tin-tuc/khai-truong-kho');
  assert.equal(red.r.status, 301); assert.equal(red.r.headers.get('location'), `${ORIGIN}/tin-tuc/khai-truong-kho/`);
  assert.equal((await call('/tin-tuc/khong-co/')).r.status, 404);
  assert.equal((await call('/tin-tuc/<script>/')).r.status, 404);
});

test('trang chủ: khối Tin mới lấy từ CRM (h3, 3 bài); CRM sập → trang chủ tĩnh vẫn chạy', async () => {
  const ok = await call('/');
  assert.equal(ok.r.status, 200); assert.match(ok.text, /<h3><a href="\/tin-tuc\/khai-truong-kho\/">/);
  const down = await call('/', { down: true });
  assert.equal(down.r.status, 200); assert.match(down.text, /Chưa có tin tức/);
});

test('ảnh + sitemap tin tức; robots.txt trỏ sitemap tin tức; _routes.json gồm trang tin tức', async () => {
  const img = await call(`/tin-tuc/anh/${IMG}`);
  assert.equal(img.r.status, 200); assert.equal(img.r.headers.get('content-type'), 'image/jpeg');
  const sm = await call('/tin-tuc/sitemap.xml');
  assert.match(sm.text, /<loc>https:\/\/www\.vipgroup\.com\.vn\/tin-tuc\/khai-truong-kho\/<\/loc>/);
  assert.match(sm.text, /zh\/tin-tuc\/khai-truong-kho\//);
  assert.match(readFileSync(join(dist, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/www\.vipgroup\.com\.vn\/tin-tuc\/sitemap\.xml/);
  const routes = JSON.parse(readFileSync(join(dist, '_routes.json'), 'utf8'));
  assert.ok(routes.include.includes('/tin-tuc/*') && routes.include.includes('/'));
});

test('staging *.pages.dev: noindex trên trang tin tức', async () => {
  const calls = []; const orig = globalThis.fetch; globalThis.fetch = crmFetch(calls);
  try {
    const r = await W.default.fetch(new Request('https://staging.vip-group.pages.dev/tin-tuc/'), { CRM_NEWS_URL: 'https://crm.example', NEWS_PUBLIC_KEY: KEY, ASSETS }, { waitUntil() {} });
    assert.equal(r.headers.get('x-robots-tag'), 'noindex');
  } finally { globalThis.fetch = orig; }
});
