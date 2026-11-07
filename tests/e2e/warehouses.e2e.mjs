// E2E trình duyệt thật cho V2 — mạng lưới 4 kho + 4 trang tuyến (VIPG-WEB-026). Cần Chromium → chạy bằng `npm run test:e2e:v2`
// (không nằm trong `npm test`); kết quả + ảnh lưu ở evidence/v2/.
// Chạy: node tests/e2e/serve.mjs dist 4321 & node tests/e2e/serve.mjs dist-demo 4322 &
//   PLAYWRIGHT=/…/node_modules/playwright node tests/e2e/warehouses.e2e.mjs [thư-mục-ảnh]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pw = await import(process.env.PLAYWRIGHT ? join(process.env.PLAYWRIGHT, 'index.mjs') : 'playwright');
const chromium = pw.chromium ?? pw.default?.chromium;
const PROD = process.env.PROD_URL ?? 'http://localhost:4321';
const DEMO = process.env.DEMO_URL ?? 'http://localhost:4322';
const OUT = process.argv[2] ?? 'evidence/v2';
mkdirSync(OUT, { recursive: true });

const ADDR = {
  '/logistics/van-chuyen-tham-quyen-ve-viet-nam/': '深圳市宝安区福海街道海洋新城新钢物流园三期2栋',
  '/logistics/van-chuyen-ha-mon-ve-viet-nam/': '福建省厦门市海沧区囷瑶路嘉功物流2号库3号仓',
  '/logistics/van-chuyen-quang-chau-ve-viet-nam/': '广州市白云区钟落潭镇虎塘村凤岗路26号',
  '/logistics/van-chuyen-nghia-o-ve-viet-nam/': '义乌市北苑三期秋实路121号6号楼10-12库西门，靠5号货梯',
};
const PAGES = ['/logistics/kho-trung-quoc/', ...Object.keys(ADDR), '/logistics/', '/logistics/van-chuyen-trung-quoc-bac-ninh/'];  // bang-gia + trang chủ có Turnstile (VIPG-WEB-023) — E2E riêng ở lead.e2e.mjs
const RETIRED = ['/logistics/kho-quang-chau/', '/logistics/kho-tham-quyen/', '/logistics/van-chuyen-tham-quyen-viet-nam/'];

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const slug = (p) => (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '_'));
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const VIEWPORTS = { desktop: { width: 1366, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };

for (const [base, label] of [[PROD, 'prod'], [DEMO, 'demo']]) {
  for (const [vp, o] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: { width: o.width, height: o.height }, isMobile: o.isMobile, hasTouch: o.hasTouch, deviceScaleFactor: o.deviceScaleFactor ?? 1, locale: 'vi-VN' });
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const errors = []; const external = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      // Turnstile (challenges.cloudflare.com) là thành phần có sẵn của form thu lead (VIPG-WEB-023) — không thuộc V2.
      page.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('https://challenges.cloudflare.com/')) external.push(u); });
      const res = await page.goto(base + p, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      check(`[${label}/${vp}] ${p} HTTP 200`, res?.status() === 200, String(res?.status()));
      // Lỗi do Turnstile không tải được ở localhost (form thu lead) bỏ qua; mọi lỗi khác tính là FAIL.
      const own = errors.filter((e) => !/turnstile|challenges\.cloudflare/i.test(e));
      check(`[${label}/${vp}] ${p} không lỗi console / CSP`, own.length === 0, own.join(' | ').slice(0, 300));
      check(`[${label}/${vp}] ${p} không request ra ngoài`, external.length === 0, external.join(' | '));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`[${label}/${vp}] ${p} không tràn ngang`, overflow <= 1, `dư ${overflow}px`);
      if (vp === 'mobile') {
        const small = await page.evaluate(() => [...document.querySelectorAll('.copy-btn, .addr-box a, .pickup-cards a')]
          .filter((el) => el.offsetParent).map((el) => el.getBoundingClientRect()).filter((r) => r.height < 44).length);
        check(`[${label}/${vp}] ${p} nút sao chép / thẻ kho cao ≥ 44px`, small === 0, `${small} phần tử nhỏ`);
      }
      if (label === 'prod') await page.screenshot({ path: join(OUT, `${label}-${vp}-${slug(p)}.png`), fullPage: true });
      await page.close();
    }
    await ctx.close();
  }
}

// URL cũ: 404.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const p of RETIRED) { const r = await page.goto(PROD + p); check(`URL cũ ${p} → 404`, r?.status() === 404, String(r?.status())); }
  await ctx.close();
}

// Nút sao chép: clipboard nhận đúng địa chỉ nguyên văn; thông báo aria-live; dataLayer có copy_address không kèm địa chỉ.
{
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  for (const [p, addr] of Object.entries(ADDR)) {
    await page.goto(PROD + p, { waitUntil: 'networkidle' });
    await page.locator('[data-copy-btn]').first().click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check(`sao chép ${p}: clipboard = địa chỉ nguyên văn`, clip === addr, clip);
    check(`sao chép ${p}: có thông báo`, /Đã sao chép/.test(await page.locator('[data-copy-status]').first().textContent()));
    const ev = await page.evaluate(() => (window.dataLayer ?? []).filter((e) => e.event === 'copy_address'));
    check(`sao chép ${p}: sự kiện copy_address (result=copied) không chứa địa chỉ`, ev.length === 1 && ev[0].result === 'copied' && !JSON.stringify(ev).includes('市'), JSON.stringify(ev));
  }
  // Trang mạng lưới: 4 nút, mỗi nút chép đúng kho của nó.
  await page.goto(PROD + '/logistics/kho-trung-quoc/', { waitUntil: 'networkidle' });
  const btns = page.locator('[data-copy-btn]');
  check('mạng lưới: 4 nút sao chép', (await btns.count()) === 4);
  await btns.nth(3).click();
  check('mạng lưới: nút thứ 4 chép địa chỉ Nghĩa Ô', (await page.evaluate(() => navigator.clipboard.readText())) === ADDR['/logistics/van-chuyen-nghia-o-ve-viet-nam/']);
  await ctx.close();
}

// Không có quyền clipboard → dự phòng bôi đen địa chỉ, không lỗi.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } }); });
  await page.goto(PROD + '/logistics/van-chuyen-ha-mon-ve-viet-nam/', { waitUntil: 'networkidle' });
  await page.locator('[data-copy-btn]').click();
  const sel = await page.evaluate(() => String(window.getSelection()));
  check('clipboard bị chặn: bôi đen địa chỉ để tự sao chép', sel === ADDR['/logistics/van-chuyen-ha-mon-ve-viet-nam/'], sel);
  const ev = await page.evaluate(() => (window.dataLayer ?? []).filter((e) => e.event === 'copy_address'));
  check('clipboard bị chặn: đo lường ghi result=selected (không tính là chép thành công)', ev.length === 1 && ev[0].result === 'selected', JSON.stringify(ev));
  // Nút có tên riêng theo kho cho trình đọc màn hình.
  check('nút sao chép có tên kho (accessible name)', /kho Hạ Môn/.test(await page.locator('[data-copy-btn]').innerText()));
  await ctx.close();
}

// Tắt JavaScript: địa chỉ vẫn hiện, nút sao chép ẩn (không có nút chết).
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(PROD + '/logistics/van-chuyen-quang-chau-ve-viet-nam/');
  check('tắt JS: địa chỉ hiển thị', await page.locator('p.addr').isVisible());
  check('tắt JS: nút sao chép ẩn', !(await page.locator('[data-copy-btn]').isVisible()));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(OUT, 'e2e-v2-results.json'), JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2));
console.log(`\nTỔNG: ${results.length} kiểm tra, ${failed.length} lỗi`);
process.exit(failed.length ? 1 : 0);
