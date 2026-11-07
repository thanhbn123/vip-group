// Proxy dev mô phỏng Caddy production cho khachhang.vipgroup.com.vn (chỉ local, dữ liệu tổng hợp).
//   http://khach.localhost:8890/tai-khoan, /tai-khoan/*  → VIP ID realm khách (mặc định 127.0.0.1:8898)
//   http://khach.localhost:8890/portal, /portal/*        → CRM portal (CRM_PORT)
//   mọi đường khác (gồm /, /api/*, /api/internal/*)      → 404 (server↔server KHÔNG đi qua host công khai)
//   Host lạ → 421
// Giữ nguyên Host gốc; GHI ĐÈ X-Real-IP/X-Forwarded-Proto như Caddy (không tin header client).
// Dùng: CRM_PORT=xxxx node proxy.mjs
import http from 'node:http';

const PORT = Number(process.env.PROXY_PORT ?? 8890);
const VIPID = { host: '127.0.0.1', port: Number(process.env.VIPID_PORT ?? 8898) };
const CRM = { host: '127.0.0.1', port: Number(process.env.CRM_PORT ?? 0) };
const ALLOWED_HOSTS = new Set([`khach.localhost:${PORT}`]);
const HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer',
  'x-real-ip', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host'];

http.createServer((req, res) => {
  const host = String(req.headers.host ?? '').toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) { res.writeHead(421).end('misdirected'); return; }
  const path = req.url ?? '/';
  if (!path.startsWith('/')) { res.writeHead(400).end(); return; }
  const p = path.split('?')[0];
  const target = p === '/tai-khoan' || p.startsWith('/tai-khoan/') ? VIPID
    : (p === '/portal' || p.startsWith('/portal/') ? CRM : null);
  if (!target) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }).end('404'); return; }
  if (!target.port) { res.writeHead(502).end('CRM_PORT chưa đặt'); return; }
  const headers = { ...req.headers };
  for (const h of HOP) delete headers[h];
  headers.host = req.headers.host;
  headers['x-real-ip'] = req.socket.remoteAddress ?? '';
  headers['x-forwarded-proto'] = 'http';
  const up = http.request({ ...target, method: req.method, path, headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('upstream lỗi'); });
  req.pipe(up);
}).listen(PORT, '127.0.0.1', () => console.log(`proxy khach.localhost:${PORT} → VIP ID :${VIPID.port}, CRM :${CRM.port || '(chưa đặt)'}`));
