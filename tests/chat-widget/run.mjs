// Kiểm thử giao diện khung "Phòng chat chung" trang chủ (VIP CHAT V1.0) — Playwright Chromium + WebKit.
//   node tests/chat-widget/run.mjs [--no-build]
// Biến môi trường (tùy chọn):
//   PLAYWRIGHT=/đường/dẫn/playwright/index.mjs   (mặc định: playwright của repo CRM vip-group-khoqctq)
//   CHAT_EVIDENCE_DIR=/thư/mục/ảnh                 (mặc định: vip-group-khoqctq-chat/docs/evidence/vip-chat)
// Tự: dựng mock API (cổng 4399) → build PUBLIC_CHAT_WIDGET=1 vào dist-chat/ → astro preview (cổng 4398) → chụp ảnh + kiểm.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMock } from './mock-server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PW = process.env.PLAYWRIGHT ?? '/Users/viporder/Projects/vip-group-khoqctq/node_modules/playwright/index.mjs';
const OUT = process.env.CHAT_EVIDENCE_DIR ?? '/Users/viporder/Projects/vip-group-khoqctq-chat/docs/evidence/vip-chat';
const MOCK_PORT = 4399, WEB_PORT = 4398;
const API = `http://127.0.0.1:${MOCK_PORT}`, WEB = `http://127.0.0.1:${WEB_PORT}`;
const ENV = { ...process.env, PUBLIC_CHAT_WIDGET: '1', PUBLIC_CHAT_API_BASE: API, VIPG_OUTDIR: './dist-chat' };
mkdirSync(OUT, { recursive: true });

const { chromium, webkit } = await import(PW);
const mock = createMock({ state: 'open' });
await new Promise((r) => mock.server.listen(MOCK_PORT, '127.0.0.1', r));

if (!process.argv.includes('--no-build')) {
  const b = spawnSync('npx', ['astro', 'build'], { cwd: root, env: ENV, encoding: 'utf8' });
  if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
}
const preview = spawn('npx', ['astro', 'preview', '--host', '127.0.0.1', '--port', String(WEB_PORT)], { cwd: root, env: ENV, stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-preview.pid); } catch { /* đã dừng */ } mock.server.close(); };
for (let i = 0; i < 60; i++) { try { if ((await fetch(WEB + '/')).ok) break; } catch { /* chờ */ } await new Promise((r) => setTimeout(r, 500)); }

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); if (!ok) console.error('FAIL', name, info); };
const LABEL = { open: 'ĐANG MỞ', closed: 'ĐÓNG', locked: 'TẠM NGƯNG', error: 'KHÔNG RÕ' };
const VIEWS = [{ w: 390, h: 844, phone: true }, { w: 360, h: 800, phone: true }, { w: 1440, h: 900, phone: false }];

async function scenario(bt, name, v, state, extra) {
  mock.setState(state);
  const browser = await bt.launch();
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.phone ? 2 : 1, isMobile: v.phone && name === 'chromium', hasTouch: v.phone });
  const page = await ctx.newPage();
  const errors = [];
  let shots = 0; // Playwright chụp ảnh trên WebKit tự chèn 1 stylesheet → CSP của site chặn (đúng) → 1 lỗi console/ảnh; trừ đúng số đó.
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const tag = `${name}-${v.w}x${v.h}-${state}`;
  try {
    await page.goto(WEB + '/', { waitUntil: 'load' });
    const chip = page.locator('.cc-info [data-cc-status]');
    await page.waitForFunction((l) => document.querySelector('.cc-info [data-cc-status]')?.textContent === l, LABEL[state], { timeout: 15000 });
    check(`${tag}: chip`, (await chip.textContent()) === LABEL[state]);
    await page.locator('#phong-chat').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.getElementById('phong-chat').getBoundingClientRect().top + window.scrollY - 60));
    await page.waitForTimeout(150);
    const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    check(`${tag}: không cuộn ngang`, sw.sw <= sw.iw, JSON.stringify(sw));
    // Dữ liệu API hiển thị dạng chữ, không thành thẻ HTML.
    check(`${tag}: khung tin không tràn ngang`, await page.evaluate(() => [...document.querySelectorAll('[data-cc-scroll]')].every((e) => e.scrollWidth <= e.clientWidth)));
    check(`${tag}: không chèn HTML từ API`, (await page.locator('.cc-list img, .cc-list b').count()) === 0);
    const target = await page.locator('.cc-info [data-cc-join]').getAttribute('target');
    check(`${tag}: nút Tham gia ${v.phone ? 'cùng tab' : 'tab mới'}`, v.phone ? target === null : target === '_blank');
    if (state === 'open') {
      const n = await page.locator(v.phone ? '[data-cc-list="preview"] > li' : '[data-cc-list="full"] > li').count();
      check(`${tag}: số tin hiển thị`, v.phone ? n === 3 : n === 8, String(n));
    }
    if (state === 'closed') check(`${tag}: phiên tiếp theo`, /Phiên tiếp theo: Thứ 2, 05\/01 · 20:00–21:00/.test(await page.locator('.cc-info [data-cc-session]').textContent()));
    if (state === 'error') check(`${tag}: báo lỗi`, (await page.locator('.cc-info [data-cc-session]').textContent()) === 'Không tải được trạng thái phòng chat');
    if (!v.phone) {
      const box = await page.locator('.cc-panel').boundingBox();
      check(`${tag}: khung cao 520px cột phải`, box && Math.round(box.height) === 520 && box.x > v.w / 2, JSON.stringify(box));
      check(`${tag}: không có nút nổi`, !(await page.locator('[data-cc-fab]').isVisible()));
    }
    shots++; await page.screenshot({ path: join(OUT, `web-${tag}.png`), caret: 'initial' });
    if (v.phone) {
      const fab = page.locator('[data-cc-fab]');
      check(`${tag}: nút nổi hiện`, await fab.isVisible());
      await fab.click();
      const sheet = page.locator('[data-cc-sheet]');
      await sheet.waitFor({ state: 'visible' });
      check(`${tag}: sheet mở, focus nút đóng`, await page.evaluate(() => document.activeElement?.hasAttribute('data-cc-close')));
      for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
      check(`${tag}: bẫy focus trong sheet`, await page.evaluate(() => !!document.activeElement?.closest('[data-cc-sheet]')));
      const sb = await sheet.boundingBox();
      check(`${tag}: tin nhắn trong sheet không tràn ngang`, await page.evaluate(() => [...document.querySelectorAll('[data-cc-sheet] [data-cc-scroll]')].every((e) => e.scrollWidth <= e.clientWidth)));
      check(`${tag}: sheet toàn màn hình`, sb && Math.round(sb.width) === v.w && Math.round(sb.height) === v.h, JSON.stringify(sb));
      await page.locator('[data-cc-close]').focus();
      shots++; await page.screenshot({ path: join(OUT, `web-${tag}-sheet.png`), caret: 'initial' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      check(`${tag}: Esc đóng, focus về nút nổi`, !(await sheet.isVisible()) && (await page.evaluate(() => document.activeElement?.hasAttribute('data-cc-fab'))));
    }
    if (extra) await extra(page, tag);
  } catch (e) { check(`${tag}: chạy kịch bản`, false, String(e)); }
  // Lỗi 503 của chính kịch bản "error" là chủ đích (trình duyệt tự ghi "Failed to load resource").
  let allowCsp = name === 'webkit' ? shots : 0;
  const real = errors.filter((t) => !(state === 'error' && /503|Failed to load resource/.test(t)))
    .filter((t) => !(/^Refused to apply a stylesheet/.test(t) && allowCsp-- > 0));
  check(`${tag}: không lỗi console`, real.length === 0, real.join(' | '));
  await browser.close();
}

try {
  for (const [name, bt] of [['chromium', chromium], ['webkit', webkit]]) {
    for (const v of VIEWS) for (const state of ['closed', 'open']) await scenario(bt, name, v, state);
  }
  await scenario(chromium, 'chromium', VIEWS[0], 'locked');
  await scenario(chromium, 'chromium', VIEWS[0], 'error');
  await scenario(webkit, 'webkit', VIEWS[2], 'error');
  // Hỏi lại mỗi 10 s: thêm tin ở mock → tin mới xuất hiện không cần tải lại trang.
  await scenario(chromium, 'chromium', VIEWS[2], 'open', async (page, tag) => {
    const before = await page.locator('[data-cc-list="full"] > li').count();
    mock.add();
    await page.waitForFunction((n) => document.querySelectorAll('[data-cc-list="full"] > li').length !== n
      || document.querySelector('[data-cc-list="full"] > li:last-child')?.dataset.seq !== String(n), before, { timeout: 15000 }).catch(() => {});
    const last = await page.locator('[data-cc-list="full"] > li:last-child').getAttribute('data-seq');
    check(`${tag}: tin mới sau 10 s`, Number(last) > before, `last seq ${last}`);
  });
  // Tab ẩn → dừng hỏi; hiện lại → hỏi ngay.
  await scenario(chromium, 'chromium', VIEWS[2], 'closed', async (page, tag) => {
    const setVis = (v) => page.evaluate((v) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); document.dispatchEvent(new Event('visibilitychange')); }, v);
    await setVis('hidden');
    const h0 = mock.hits();
    await page.waitForTimeout(12_000);
    check(`${tag}: tab ẩn không gọi API`, mock.hits() === h0, `${mock.hits() - h0} lần`);
    await setVis('visible');
    await page.waitForTimeout(1_000);
    check(`${tag}: tab hiện lại gọi ngay`, mock.hits() === h0 + 1, `${mock.hits() - h0} lần`);
  });
} finally { stop(); }

const fail = results.filter((r) => !r.ok);
console.log(`chat-widget UX: ${results.length - fail.length}/${results.length} PASS · ảnh: ${OUT}/web-*.png`);
process.exit(fail.length ? 1 : 0);
