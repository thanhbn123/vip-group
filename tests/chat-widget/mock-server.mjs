// Máy chủ GIẢ cho GET /portal/public/community (VIP CHAT V1.0 §5.4) — chỉ để phát triển/kiểm thử khung chat trang chủ.
//   node tests/chat-widget/mock-server.mjs [cổng=4399] [trạng thái=open|closed|locked|error]
// Đổi trạng thái khi đang chạy:  curl -X POST http://127.0.0.1:4399/__mock/state/closed   (open | closed | locked | error | empty)
// Thêm tin:                      curl -X POST http://127.0.0.1:4399/__mock/message
// CORS: phản hồi Access-Control-Allow-Origin theo Origin gửi lên (chỉ localhost / 127.0.0.1) — giống danh sách CHAT_PUBLIC_ORIGINS.
import { createServer } from 'node:http';

export function createMock({ state = 'open' } = {}) {
  let mode = state;
  let seq = 0;
  let hits = 0;
  const now = () => Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const NAMES = [['Hoa Mai', null], ['VIP GROUP', 'VIP GROUP'], ['Anh Tuấn 88', null], ['Lan Chi', null], ['CSKH Linh', 'VIP GROUP']];
  const BODIES = ['Chào cả nhà, tối nay hàng Quảng Châu về Lạng Sơn chưa ạ?', 'Chào chị, xe tối nay xuất kho Bằng Tường lúc 21:00, mai trưa có hàng ạ.',
    'Ship lẻ 3 kiện tính cân thế nào vậy mọi người?', 'Mình dùng VIP GROUP 2 tháng rồi, hàng về đều 👍', 'Tin rất dài để kiểm tra xuống dòng: ' + 'abcdefghij'.repeat(12),
    '<b>không phải HTML</b> <img src=x onerror=alert(1)>', 'Số điện thoại 09******55 đã được che', 'Cảm ơn admin nhé!'];
  const messages = [];
  const add = () => {
    seq++;
    const [name, badge] = NAMES[seq % NAMES.length];
    messages.push({ seq, name, badge, body: BODIES[seq % BODIES.length], created_at: iso(now() - (20 - seq) * 60_000) });
    if (messages.length > 20) messages.shift();
  };
  for (let i = 0; i < 8; i++) add();
  const opened = now() - 25 * 60_000;
  const schedule = {
    slots: [{ dow: 1, start: '20:00', end: '21:00' }, { dow: 3, start: '20:00', end: '21:00' }, { dow: 5, start: '20:00', end: '21:30' }, { dow: 7, start: '09:00', end: '10:00' }],
    exceptions: [{ date: '2099-01-01', closed: true, note: 'Nghỉ Tết Dương lịch' }, { date: '2000-01-01', closed: true, note: 'đã qua — không hiển thị' }],
    note: 'Lịch có thể thay đổi vào dịp lễ; VIP GROUP sẽ thông báo trước.',
    next: { start: '2099-01-05T13:00:00.000Z', end: '2099-01-05T14:00:00.000Z' },
  };
  const body = (joinBase) => {
    const open = mode === 'open' || mode === 'locked' || mode === 'empty';
    return {
      open, locked: mode === 'locked',
      session: open ? { no: 12, opened_at: iso(opened), closes_at: iso(opened + 60 * 60_000) } : null,
      schedule, online: open ? 17 : 0,
      messages: open && mode !== 'empty' ? messages : [],
      join_url: `${joinBase}/portal/#/cong-dong`,
    };
  };
  const server = createServer((req, res) => {
    const origin = req.headers.origin ?? '';
    const cors = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const url = new URL(req.url, 'http://x');
    const m = /^\/__mock\/state\/(open|closed|locked|error|empty)$/.exec(url.pathname);
    if (req.method === 'POST' && m) { mode = m[1]; res.writeHead(204, cors); return res.end(); }
    if (req.method === 'POST' && url.pathname === '/__mock/message') { add(); res.writeHead(204, cors); return res.end(); }
    if (req.method === 'GET' && url.pathname === '/portal/public/community') {
      hits++;
      if (req.headers.cookie) console.warn('[mock] CẢNH BÁO: nhận cookie — widget phải gửi credentials: omit');
      if (mode === 'error') { res.writeHead(503, { ...cors, 'Content-Type': 'application/json' }); return res.end('{"error":"down"}'); }
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=5', 'X-Robots-Tag': 'noindex' });
      return res.end(JSON.stringify(body(`http://${req.headers.host}`)));
    }
    res.writeHead(404, cors); res.end();
  });
  return { server, setState: (s) => { mode = s; }, add, hits: () => hits };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [port = '4399', state = 'open'] = process.argv.slice(2);
  createMock({ state }).server.listen(Number(port), '127.0.0.1', () => console.log(`mock chat API → http://127.0.0.1:${port}/portal/public/community (state=${state})`));
}
