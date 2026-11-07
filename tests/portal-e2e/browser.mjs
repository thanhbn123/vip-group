// Playwright (bản cài sẵn ở veh4-g12-playwright) + chrome-headless-shell. Theo dõi console error, lỗi JS, vi phạm CSP, tràn ngang.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PLAYWRIGHT = process.env.PLAYWRIGHT || '/Users/viporder/code/veh4-g12-playwright/node_modules/playwright/index.mjs';
const CHROMIUM = process.env.CHROMIUM || '/Users/viporder/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';

export async function launchBrowser() {
  const pw = await import(pathToFileURL(PLAYWRIGHT).href);
  const chromium = pw.chromium || pw.default?.chromium;
  return chromium.launch({ executablePath: CHROMIUM, headless: true, args: ['--host-resolver-rules=MAP khach.localhost 127.0.0.1'] });
}

export const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'vi-VN' };

/**
 * Gắn bộ theo dõi vào context: mọi console error / pageerror / CSP violation được ghi kèm URL.
 * Vi phạm CSP: listener securitypolicyviolation (init script chạy qua DevTools, không bị CSP chặn) + dòng console "Refused to…".
 */
export async function guard(context) {
  const events = [];
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP-VIOLATION ${e.violatedDirective} blocked=${e.blockedURI} src=${e.sourceFile}:${e.lineNumber}`);
    });
  });
  context.on('page', (p) => attach(p, events));
  for (const p of context.pages()) attach(p, events);
  return events;
}

function attach(page, events) {
  page.on('console', (m) => { if (m.type() === 'error') events.push({ kind: /CSP-VIOLATION|Content Security Policy|Refused to/.test(m.text()) ? 'csp' : 'console', url: page.url(), text: m.text() }); });
  page.on('pageerror', (e) => events.push({ kind: 'pageerror', url: page.url(), text: String(e?.message || e) }));
}

/** Đo tràn ngang ở viewport hiện tại. */
export async function overflow(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const w = window.innerWidth;
    const wide = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > w + 1 && getComputedStyle(el).position !== 'fixed') wide.push(`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`);
      if (wide.length >= 5) break;
    }
    return { scrollWidth: de.scrollWidth, innerWidth: w, overflow: de.scrollWidth > w, wide };
  });
}

export function shotPath(dir, name) { return path.join(dir, `${name.replace(/[^a-z0-9_-]+/gi, '_')}.png`); }
