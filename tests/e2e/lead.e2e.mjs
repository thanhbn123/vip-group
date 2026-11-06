// E2E thu lead trên trình duyệt thật (Turnstile mã THỬ của Cloudflare, Sheet giả). Không nằm trong `npm test`.
// VIPG_TURNSTILE_SITE_KEY=1x00000000000000000000AA VIPG_OUTDIR=./dist-lead npx astro build
// node tests/e2e/lead-server.mjs dist-lead 4341 & PLAYWRIGHT=… CHROMIUM=… node tests/e2e/lead.e2e.mjs evidence
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const pw = await import(process.env.PLAYWRIGHT ?? 'playwright');
const chromium = pw.chromium ?? pw.default?.chromium;
const BASE = process.env.BASE_URL ?? 'http://localhost:4341';
const OUT = process.argv[2] ?? 'evidence';
mkdirSync(OUT, { recursive: true });
const res = [];
const check = (n, ok, d = '') => { res.push({ n, ok: !!ok, d }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const rows = async () => (await fetch(BASE + '/__mock/rows')).json();
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

async function open(vp, path = '/lien-he/') {
  const ctx = await browser.newContext({ viewport: vp, locale: 'vi-VN', isMobile: vp.width < 500, hasTouch: vp.width < 500 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE + path, { waitUntil: 'load' });
  return { ctx, page, errs };
}
const waitToken = (page) => page.waitForFunction(() => !!window.turnstile?.getResponse(document.querySelector('.cf-turnstile')), null, { timeout: 30000 });

for (const [name, vp] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const { ctx, page, errs } = await open(vp);
  await waitToken(page).then(() => check(`[${name}] Turnstile cấp mã xác minh`, true)).catch((e) => check(`[${name}] Turnstile cấp mã xác minh`, false, String(e)));
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(`[${name}] không tràn ngang`, ov <= 1, `${ov}px`);

  // Sai dữ liệu: không gửi.
  const before = (await rows()).length;
  await page.fill('#cf-name', 'Khách Thử E2E');
  await page.fill('#cf-phone', '12345');
  await page.click('[data-submit]');
  check(`[${name}] SĐT sai → báo lỗi, focus ô SĐT`, /Số điện thoại chưa đúng/.test(await page.textContent('[data-form-status]')) && (await page.evaluate(() => document.activeElement?.id)) === 'cf-phone');
  await page.fill('#cf-phone', '0961 102 655');
  await page.click('[data-submit]');
  check(`[${name}] chưa tích đồng ý → không gửi`, /đồng ý/.test(await page.textContent('[data-form-status]')) && (await rows()).length === before);

  // Hợp lệ: gửi thật qua worker → Sheet giả.
  await page.selectOption('#cf-need', 'bao-gia-van-chuyen');
  await page.selectOption('#cf-route', 'tham-quyen');
  await page.fill('#cf-weight', '250');
  await page.fill('#cf-message', `Lô hàng thử ${name}`);
  await page.check('#cf-consent');
  await page.waitForTimeout(3200); // đúng như người thật: > 3 giây sau khi mở form
  await page.click('[data-submit]');
  await page.waitForFunction(() => /Đã nhận yêu cầu|Chưa gửi|bận/.test(document.querySelector('[data-form-status]')?.textContent ?? ''), null, { timeout: 20000 });
  const msg = await page.textContent('[data-form-status]');
  check(`[${name}] gửi hợp lệ → "Đã nhận yêu cầu" + mã lead`, /Đã nhận yêu cầu \(mã VG-E2E-\d{4}\)/.test(msg), msg);
  const all = await rows(); const last = all.at(-1);
  check(`[${name}] Sheet nhận đúng 1 dòng, đúng dữ liệu`, all.length === before + 1 && last.phone === '0961102655' && last.weight_kg === 250 && last.need === 'bao-gia-van-chuyen' && last.route === 'tham-quyen' && last.page === '/lien-he/' && last.message === `Lô hàng thử ${name}`, JSON.stringify(last));
  check(`[${name}] form khoá sau khi gửi (chống gửi lặp)`, await page.locator('#cf-name').isDisabled());
  const layer = await page.evaluate(() => JSON.stringify(window.dataLayer ?? []));
  check(`[${name}] đo lường lead_submit, không chứa dữ liệu cá nhân`, layer.includes('lead_submit') && !layer.includes('0961102655') && !layer.includes('Khách Thử'));
  check(`[${name}] không lỗi console / CSP`, errs.filter((e) => !/Private Access Token|preload/i.test(e)).length === 0, errs.join(' | ').slice(0, 300));
  await page.screenshot({ path: join(OUT, `lead-${name}.png`), fullPage: true });
  await ctx.close();
}

// Nút "Gửi yêu cầu báo giá" ở bảng giá trang chủ → chọn sẵn nhu cầu.
{
  const { ctx, page } = await open({ width: 1366, height: 900 }, '/');
  await page.click('text=Gửi yêu cầu báo giá');
  await page.waitForURL(/lien-he\/\?nhu-cau=bao-gia-van-chuyen#form-lien-he/);
  check('trang chủ → Gửi yêu cầu báo giá → chọn sẵn "Báo giá vận chuyển"', (await page.inputValue('#cf-need')) === 'bao-gia-van-chuyen');
  await ctx.close();
}
// Tắt JS: không gửi được gì.
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + '/lien-he/');
  check('tắt JS: nút gửi disabled + có hướng dẫn gọi', (await page.locator('[data-submit]').isDisabled()) && /tắt JavaScript/.test(await page.content()));
  await ctx.close();
}
// API: request khác nguồn bị chặn.
{
  const r = await fetch(BASE + '/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
  check('API: request từ tên miền khác → 403', r.status === 403);
}
await browser.close();
const fail = res.filter((x) => !x.ok);
writeFileSync(join(OUT, 'e2e-lead-results.json'), JSON.stringify({ at: new Date().toISOString(), total: res.length, failed: fail.length, res }, null, 2));
console.log(`\nTỔNG: ${res.length} kiểm tra, ${fail.length} lỗi`);
process.exit(fail.length ? 1 : 0);
