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
  '/logistics/quy-trinh-gui-hang/', '/logistics/bang-gia/',
  '/logistics/tra-cuu-van-don/', '/logistics/cau-hoi-thuong-gap/', '/logistics/lien-he/', '/'];
const DEMO_ONLY = ['/logistics/kho-quang-chau/', '/logistics/kho-tham-quyen/', '/logistics/kien-thuc/', '/logistics/kien-thuc/cach-tinh-so-khoi-va-can-nang-quy-doi/'];

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
      const res = await page.goto(base + p, { waitUntil: 'networkidle' });
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
      if (['/logistics/', '/logistics/bang-gia/', '/logistics/van-chuyen-trung-quoc-bac-ninh/', '/logistics/kho-quang-chau/', '/', '/logistics/kien-thuc/cach-tinh-so-khoi-va-can-nang-quy-doi/'].includes(p)) {
        await page.screenshot({ path: join(OUT, `${label}-${vp}-${slug(p)}.png`), fullPage: true });
      }
      await page.close();
    }
    await ctx.close();
  }
}

// Luồng chức năng trên bản production.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'vi-VN' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: PROD });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (r) => { if (!r.url().startsWith(PROD)) requests.push(r.url()); });
  await page.goto(PROD + '/logistics/bang-gia/', { waitUntil: 'networkidle' });

  // Công cụ tính số khối: 60×50×40 cm × 3 kiện = 0,36 m³.
  await page.fill('#vc-n', '3');
  check('calc: 60×50×40 × 3 kiện = 0,36 m³', (await page.textContent('[data-out="m3"]'))?.trim() === '0,36 m³', await page.textContent('[data-out="m3"]'));
  check('calc: cân nặng thực 12 kg × 3 = 36 kg', (await page.textContent('[data-out="kg"]'))?.trim() === '36 kg');
  check('calc production: không tự dùng hệ số quy đổi chưa xác minh', /báo theo từng lô/.test(await page.textContent('[data-out="dim"]')));

  // Form: gửi rỗng → báo lỗi, không tạo nội dung.
  await page.click('[data-quote-form] [data-submit]');
  check('form: thiếu trường bắt buộc → báo lỗi', /Vui lòng điền/.test(await page.textContent('[data-status]')));
  check('form: ô lỗi được đánh dấu aria-invalid', (await page.getAttribute('#qf-name', 'aria-invalid')) === 'true');
  check('form: chưa hợp lệ thì không hiện kết quả', await page.locator('[data-result]').isHidden());

  await page.fill('#qf-name', 'Nguyễn Văn Thử');
  await page.fill('#qf-phone', '0900000000');
  await page.check('input[name="qf-route"][value="quang-chau"]');
  await page.fill('#qf-dest', 'Từ Sơn');
  await page.fill('#qf-goods', 'Phụ kiện nội thất');
  await page.fill('#qf-kg', '120');
  await page.fill('#qf-m3', '0.8');
  const urlBefore = page.url();
  await page.click('[data-quote-form] [data-submit]');
  const summary = await page.inputValue('[data-summary]');
  check('form: tạo nội dung yêu cầu đúng', /Họ tên: Nguyễn Văn Thử/.test(summary) && /Nơi gửi tại Trung Quốc: Quảng Châu/.test(summary) && /0.8 m³/.test(summary), summary.split('\n').slice(0, 4).join(' / '));
  check('form: trang KHÔNG điều hướng / không gửi dữ liệu', page.url() === urlBefore && !page.url().includes('?'));
  const mailto = await page.getAttribute('[data-mailto]', 'href');
  check('form: mailto tới email chính thức, có nội dung', mailto?.startsWith('mailto:viporder@vipgroup.com.vn?subject=') && mailto.includes(encodeURIComponent('Phụ kiện nội thất')));
  const layer = await page.evaluate(() => (window.dataLayer ?? []).map((e) => ({ ...e })));
  const names = layer.map((e) => e.event);
  check('đo lường: có quote_form_start, route_select, quote_generate', ['quote_form_start', 'route_select', 'quote_generate'].every((n) => names.includes(n)), names.join(','));
  check('đo lường: sự kiện không chứa họ tên / SĐT', !JSON.stringify(layer).includes('Nguyễn') && !JSON.stringify(layer).includes('0900000000'));
  const gen = layer.find((e) => e.event === 'quote_generate');
  check('đo lường: quote_generate mang tuyến kho', gen?.route === 'quang-chau', JSON.stringify(gen));

  // Nút Zalo / gọi đẩy sự kiện (chặn điều hướng thật).
  await page.route('https://zalo.me/**', (r) => r.abort());
  await page.evaluate(() => document.querySelectorAll('a[href^="tel:"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault())));
  await page.locator('.lg-cta a[data-track="call_click"]').click();
  const pop = page.waitForEvent('popup').catch(() => null);
  await page.locator('.lg-cta a[data-track="zalo_click"]').click();
  await pop;
  const names2 = (await page.evaluate(() => (window.dataLayer ?? []).map((e) => e.event)));
  check('đo lường: call_click + zalo_click', names2.includes('call_click') && names2.includes('zalo_click'));
  check('không có request ra domain ngoài (không tracking bên thứ ba)', requests.filter((u) => !u.startsWith('https://zalo.me')).length === 0, requests.join(' | '));

  // Tắt JS: nút gửi bị khoá.
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const p2 = await nojs.newPage();
  await p2.goto(PROD + '/logistics/bang-gia/');
  check('tắt JS: nút gửi báo giá disabled', await p2.locator('[data-quote-form] [data-submit]').isDisabled());
  await p2.goto(PROD + '/logistics/');
  check('tắt JS: menu chính vẫn hiện link Logistics', await p2.locator('#site-menu a[href="/logistics/"]').isVisible());
  await nojs.close();

  // Bàn phím: radio cùng nhóm, mũi tên chuyển lựa chọn.
  await page.focus('input[name="qf-route"][value="quang-chau"]');
  await page.keyboard.press('ArrowRight');
  check('bàn phím: mũi tên chuyển radio trong nhóm', await page.isChecked('input[name="qf-route"][value="tham-quyen"]'));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(OUT, 'e2e-results.json'), JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2));
console.log(`\nTỔNG: ${results.length} kiểm tra, ${failed.length} lỗi`);
process.exit(failed.length ? 1 : 0);
