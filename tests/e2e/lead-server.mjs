// Máy chủ E2E thu lead: phục vụ thư mục build + chạy public/_worker.js cho /api/*, Sheet giả ở /__mock/sheet.
// node tests/e2e/lead-server.mjs <thư-mục> <cổng>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

const [dir = 'dist-lead', port = '4341'] = process.argv.slice(2);
const W = await import(pathToFileURL(join(process.cwd(), 'public/_worker.js')).href);
const rows = [];
const ENV = {
  TURNSTILE_SECRET: '1x0000000000000000000000000000000AA', // khoá bí mật THỬ chính thức của Cloudflare (luôn đạt)
  SHEET_WEBHOOK_URL: `http://localhost:${port}/__mock/sheet`,
  SHEET_WEBHOOK_SECRET: 'e2e-secret-e2e-secret-e2e-secret-00',
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.xml': 'application/xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
const readBody = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === '/__mock/sheet') {
    const b = JSON.parse(await readBody(req));
    if (b.secret !== ENV.SHEET_WEBHOOK_SECRET) { res.end(JSON.stringify({ ok: false, error: 'auth' })); return; }
    const dup = rows.find((r) => r.idempotency_key === b.lead.idempotency_key);
    if (dup) { res.end(JSON.stringify({ ok: true, lead_id: dup.lead_id, duplicate: true })); return; }
    const lead_id = `VG-E2E-${String(rows.length + 1).padStart(4, '0')}`;
    rows.push({ lead_id, ...b.lead });
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, lead_id, duplicate: false })); return;
  }
  if (url.pathname === '/__mock/rows') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(rows)); return; }
  if (url.pathname.startsWith('/api/')) {
    const body = req.method === 'GET' ? undefined : await readBody(req);
    const r = await W.default.fetch(new Request(url, { method: req.method, headers: req.headers, body }), { ...ENV, ASSETS: null }, { waitUntil() {} });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text()); return;
  }
  let file = join(dir, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  try {
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); return res.end(); }
      file = join(file, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('404'); }
}).listen(Number(port), () => console.log(`lead e2e → http://localhost:${port}`));
