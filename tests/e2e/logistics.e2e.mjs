// E2E trình duyệt thật cho khu Logistics (VIPG-WEB-021). KHÔNG nằm trong `npm test` (cần Chromium).
// Chạy: npm run preview (4321) + npm run preview:demo (4322), rồi
//   PLAYWRIGHT=/đường/dẫn/tới/node_modules/playwright node tests/e2e/logistics.e2e.mjs [thư-mục-ảnh]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pw = await import(process.env.PLAYWRIGHT ?? 'playwright');
const chromium = pw.chromium ?? pw.default?.chromium;
const PROD = process.env.PROD_URL ?? 'http://localhost:4321';
const DEMO = process.env.DEMO_URL ?? 'http://localhost:4322';
const OUT = process.argv[2] ?? 'evidence/screenshots';
mkdirSync(OUT, { recursive: true });

const PAGES = ['/logistics/', '/logistics/van-chuyen-trung-quoc-bac-ninh/', '/logistics/van-chuyen-trung-quoc-viet-nam/',
  '/logistics/van-chuyen-tham-quyen-viet-nam/', '/logistics/quy-trinh-gui-hang/', '/logistics/bang-gia/',
  '/logistics/tra-cuu-van-don/', '/logistics/cau-hoi-thuong-gap/', '/logistics/lien-he/', '/', '/lien-he/', '/chinh-sach-bao-mat/'];
const DEMO_ONLY = ['/logistics/kho-quang-chau/', '/logistics/kien-thuc/', '/logistics/kien-thuc/cach-tinh-so-khoi-va-can-nang-quy-doi/'];

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const slug = (p) => (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '_'));

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const VIEWPORTS = { desktop: { width: 1366, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };

for (const [base, label, list] of [[PROD, 'prod', PAGES], [DEMO, 'demo', [...PAGES, ...DEMO_ONLY]]]) {
  for (const [vp, opts] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: { width: opts.width, height: opts.height }, isMobile: opts.isMobile, hasTouch: opts.hasTouch, deviceScaleFactor: opts.deviceScaleFactor ?? 1, locale: 'vi-VN' });
    for (const p of list) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      const res = await page.goto(base + p, { waitUntil: 'load' }); await page.waitForTimeout(400);
      check(`[${label}/${vp}] ${p} HTTP 200`, res?.status() === 200, String(res?.status()));
      check(`[${label}/${vp}] ${p} không lỗi console / CSP`, errors.length === 0, errors.join(' | ').slice(0, 300));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`[${label}/${vp}] ${p} không tràn ngang`, overflow <= 1, `dư ${overflow}px`);
      if (vp === 'mobile' && p.startsWith('/logistics/')) {
        const bar = await page.locator('nav.sticky-bar').isVisible();
        check(`[${label}/${vp}] ${p} thanh liên hệ nhanh hiện`, bar);
        const small = await page.evaluate(() => [...document.querySelectorAll('.sticky-bar a, .contact-actions a, .btn')].filter((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); }).length);
        check(`[${label}/${vp}] ${p} vùng chạm nút ≥ 44px`, small === 0, `${small} nút nhỏ`);
      }
      if (['/logistics/', '/logistics/bang-gia/', '/logistics/van-chuyen-trung-quoc-bac-ninh/', '/logistics/van-chuyen-tham-quyen-viet-nam/', '/logistics/kho-quang-chau/', '/', '/logistics/kien-thuc/cach-tinh-so-khoi-va-can-nang-quy-doi/'].includes(p)) {
        await page.screenshot({ path: join(OUT, `${label}-${vp}-${slug(p)}.png`), fullPage: true });
      }
      await page.close();
    }
    await ctx.close();
  }
}

// Luồng chức năng trên bản production: công cụ tính (hệ số 6000 owner), đo lường nút liên hệ, không gọi domain ngoài
// ngoài Turnstile. Luồng gửi lead đầy đủ nằm ở tests/e2e/lead.e2e.mjs.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'vi-VN' });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (r) => { if (!r.url().startsWith(PROD)) requests.push(r.url()); });
  await page.goto(PROD + '/logistics/bang-gia/', { waitUntil: 'load' });
  await page.fill('#vc-n', '3');
  check('calc: 60×50×40 × 3 kiện = 0,36 m³', (await page.textContent('[data-out="m3"]'))?.trim() === '0,36 m³', await page.textContent('[data-out="m3"]'));
  check('calc: cân thực 12 kg × 3 = 36 kg', (await page.textContent('[data-out="kg"]'))?.trim() === '36 kg');
  check('calc: cân quy đổi 360.000 ÷ 6000 = 60 kg (owner xác nhận hệ số 6000)', (await page.textContent('[data-out="dim"]'))?.trim() === '60 kg', await page.textContent('[data-out="dim"]'));
  check('bảng giá: form thu lead chọn sẵn "báo giá vận chuyển"', (await page.inputValue('#cf-need')) === 'bao-gia-van-chuyen');
  await page.route('https://zalo.me/**', (r) => r.abort());
  await page.evaluate(() => document.querySelectorAll('a[href^="tel:"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault())));
  await page.locator('.lg-cta a[data-track="call_click"]').click();
  const pop = page.waitForEvent('popup').catch(() => null);
  await page.locator('.lg-cta a[data-track="zalo_click"]').click();
  await pop;
  const names = await page.evaluate(() => (window.dataLayer ?? []).map((e) => e.event));
  check('đo lường: call_click + zalo_click', names.includes('call_click') && names.includes('zalo_click'), names.join(','));
  const foreign = requests.filter((u) => !u.startsWith('https://zalo.me') && !u.startsWith('https://challenges.cloudflare.com'));
  check('không gọi domain ngoài (trừ Turnstile chống spam)', foreign.length === 0, foreign.join(' | '));
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const p2 = await nojs.newPage();
  await p2.goto(PROD + '/logistics/bang-gia/');
  check('tắt JS: nút gửi form bảng giá disabled', await p2.locator('[data-contact-form] [data-submit]').isDisabled());
  await p2.goto(PROD + '/logistics/');
  check('tắt JS: menu chính vẫn có link Logistics', await p2.locator('#site-menu a[href="/logistics/"]').isVisible());
  await nojs.close();
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(OUT, 'e2e-results.json'), JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2));
console.log(`\nTỔNG: ${results.length} kiểm tra, ${failed.length} lỗi`);
process.exit(failed.length ? 1 : 0);
