// E2E bảng giá trang chủ (VIPG-WEB-022). Cần Chromium; không nằm trong `npm test`.
// node tests/e2e/serve.mjs dist 4331  →  PLAYWRIGHT=… CHROMIUM=… node tests/e2e/pricing.e2e.mjs evidence
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const pw = await import(process.env.PLAYWRIGHT ?? 'playwright');
const chromium = pw.chromium ?? pw.default?.chromium;
const BASE = process.env.BASE_URL ?? 'http://localhost:4331';
const OUT = process.argv[2] ?? 'evidence';
mkdirSync(OUT, { recursive: true });
const res = [];
const check = (n, ok, d = '') => { res.push({ n, ok: !!ok, d }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [name, w, h, mobile] of [['desktop', 1366, 900, false], ['tablet', 768, 1024, true], ['mobile', 390, 844, true], ['mobile-sm', 320, 640, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'vi-VN' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  const r = await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  check(`[${name}] HTTP 200`, r.status() === 200);
  check(`[${name}] không lỗi console/CSP`, errs.length === 0, errs.join(' | '));
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(`[${name}] không tràn ngang trang`, ov <= 1, `${ov}px`);
  const m = await page.evaluate(() => {
    const card = document.querySelector('.price-card');
    const tbl = document.querySelector('.price-table');
    const rows = [...document.querySelectorAll('.price-table tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ').trim());
    const minFont = Math.min(...[...document.querySelectorAll('.price-section .w-vi, .price-section .p, .price-section .price-notes p')].map((e) => parseFloat(getComputedStyle(e).fontSize)));
    const priceFont = parseFloat(getComputedStyle(document.querySelector('.price-table .p')).fontSize);
    const zhFont = getComputedStyle(document.querySelector('.w-zh')).fontFamily;
    const cut = [...document.querySelectorAll('.price-table .num')].some((e) => e.getBoundingClientRect().right > card.getBoundingClientRect().right + 0.5);
    return { rows, minFont, priceFont, tblOverflow: tbl.scrollWidth - card.clientWidth, cut, zhFont,
      zhRendered: document.querySelector('.w-zh').getBoundingClientRect().width > 20 };
  });
  check(`[${name}] 5 dòng giá hiển thị`, m.rows.length === 5, m.rows.join(' | '));
  check(`[${name}] bảng không tràn khung thẻ, giá không bị cắt`, m.tblOverflow <= 1 && !m.cut, `dư ${m.tblOverflow}px`);
  check(`[${name}] cỡ chữ nhỏ nhất trong khối ≥ 14px`, m.minFont >= 14, `${m.minFont}px`);
  check(`[${name}] giá nổi bật ≥ 22px`, m.priceFont >= 22, `${m.priceFont}px`);
  check(`[${name}] chữ Trung hiển thị`, m.zhRendered);
  const small = await page.evaluate(() => [...document.querySelectorAll('.price-section a.btn')].filter((a) => a.getBoundingClientRect().height < 44).length);
  check(`[${name}] nút liên hệ cao ≥ 44px`, small === 0);
  await page.locator('#bang-gia').screenshot({ path: join(OUT, `bang-gia-${name}.png`) });
  await page.screenshot({ path: join(OUT, `trang-chu-${name}.png`), fullPage: true });
  await ctx.close();
}
const p = await (await browser.newContext()).newPage();
await p.goto(BASE + '/#bang-gia'); await p.waitForTimeout(1500);
check('neo /#bang-gia cuộn tới bảng giá', await p.evaluate(() => { const r = document.querySelector('#bang-gia').getBoundingClientRect(); return r.top >= 0 && r.top < 200; }));
await browser.close();
const fail = res.filter((x) => !x.ok);
writeFileSync(join(OUT, 'e2e-pricing-results.json'), JSON.stringify({ at: new Date().toISOString(), total: res.length, failed: fail.length, res }, null, 2));
console.log(`\nTỔNG: ${res.length} kiểm tra, ${fail.length} lỗi`);
process.exit(fail.length ? 1 : 0);
