// Proxy dev mô phỏng Caddy production (chỉ local, dữ liệu tổng hợp). Giữ nguyên Host gốc; GHI ĐÈ X-Real-IP (IP thật cho
// VIP ID với COWORK_TIN_PROXY=1) và X-Forwarded-Proto; xoá mọi X-Forwarded-For / Forwarded / Via do client gửi và KHÔNG tự thêm
// (VIP ID nhận ra request đi qua proxy công khai nhờ X-Real-IP; lời gọi nội bộ CRM → VIP ID không qua proxy).
//
// PROXY_TOPO=multi (KIEN_TRUC_P1 §15):
//   dangky.localhost:8890     → VIP ID (VIP ID tự chỉ phục vụ đăng ký)
//   dangnhap.localhost:8890   → VIP ID (đăng nhập / tài khoản)
//   khachhang.localhost:8890  → CRM: /portal, /portal/* ; '/' → 302 /portal/ ; còn lại 404
// PROXY_TOPO=single (cũ): khach.localhost:8890 — /tai-khoan* → VIP ID, /portal* → CRM, còn lại 404
// Mọi host: /api/internal/* → 404 (server↔server không đi qua host công khai); Host lạ → 421.
import http from 'node:http';

const PORT = Number(process.env.PROXY_PORT ?? 8890);
const VIPID = { host: '127.0.0.1', port: Number(process.env.VIPID_PORT ?? 8898) };
const CRM = { host: '127.0.0.1', port: Number(process.env.CRM_PORT ?? 0) };
const TOPO = process.env.PROXY_TOPO || 'single';
const HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer',
  'x-real-ip', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host', 'forwarded', 'via'];

const isPortal = (p) => p === '/portal' || p.startsWith('/portal/');
const isTaiKhoan = (p) => p === '/tai-khoan' || p.startsWith('/tai-khoan/');
const routes = TOPO === 'multi'
  ? {
    [process.env.PROXY_HOST_DANGKY || `dangky.localhost:${PORT}`]: () => VIPID,
    [process.env.PROXY_HOST_DANGNHAP || `dangnhap.localhost:${PORT}`]: () => VIPID,
    [process.env.PROXY_HOST_PORTAL || `khachhang.localhost:${PORT}`]: (p) => (p === '/' ? 'redirect-portal' : isPortal(p) ? CRM : null),
  }
  : { [`khach.localhost:${PORT}`]: (p) => (isTaiKhoan(p) ? VIPID : isPortal(p) ? CRM : null) };

const notFound = (res) => res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }).end('404');

http.createServer((req, res) => {
  const host = String(req.headers.host ?? '').toLowerCase();
  const route = routes[host];
  if (!route) { res.writeHead(421).end('misdirected'); return; }
  const path = req.url ?? '/';
  if (!path.startsWith('/')) { res.writeHead(400).end(); return; }
  const p = path.split('?')[0];
  if (p === '/api/internal' || p.startsWith('/api/internal/')) { notFound(res); return; }
  const target = route(p);
  if (target === 'redirect-portal') { res.writeHead(302, { location: '/portal/', 'cache-control': 'no-store' }).end(); return; }
  if (!target) { notFound(res); return; }
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
}).listen(PORT, '127.0.0.1', () => console.log(`proxy (${TOPO}) :${PORT} hosts=${Object.keys(routes).join(',')} → VIP ID :${VIPID.port}, CRM :${CRM.port || '(chưa đặt)'}`));
