// Lấy ZALO_NOTIFY_CHAT_ID cho bot Zalo thông báo lead VIP GROUP (cùng cách viporder.com.vn — tools/zalo_chat_id.py).
//
//   node ops/lead-sheet/zalo-chat-id.mjs          → dán token (không hiện), rồi NHẮN BOT 1 tin từ Zalo 0961102655
//   node ops/lead-sheet/zalo-chat-id.mjs --test   → dán token + chat id, gửi thử 1 tin
//
// Token chỉ nhập qua bàn phím, không ghi ra đĩa, không in ra màn hình.
import { createInterface } from 'node:readline';

const API = 'https://bot-api.zapps.me';
const POLL_SECONDS = 30;
const ROUNDS = 10;

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(question); };
    rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
  });
}

async function call(token, method, body) {
  const r = await fetch(`${API}/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  return r.json().catch(() => ({ ok: false, error_code: r.status }));
}

const updates = (res) => (Array.isArray(res) ? res : res && typeof res === 'object' ? [res] : []);

const token = await ask('Dán token bot Zalo rồi Enter (không hiện ra): ', true);
if (!/^\d+:[\w-]+$/.test(token)) { console.log('Token không đúng dạng 12345678:abc…'); process.exit(1); }

if (process.argv.includes('--test')) {
  const chatId = await ask('ZALO_NOTIFY_CHAT_ID: ');
  const r = await call(token, 'sendMessage', { chat_id: chatId, text: '✅ VIP GROUP: thông báo lead đã hoạt động.' });
  console.log(r.ok ? 'ĐÃ GỬI — kiểm tra Zalo.' : `LỖI: ${JSON.stringify(r).slice(0, 200)}`);
  process.exit(r.ok ? 0 : 1);
}

console.log('\nĐang chờ… BÂY GIỜ mở Zalo của số 0961102655, nhắn cho bot một tin bất kỳ (vd. "hi").');
for (let i = 1; i <= ROUNDS; i++) {
  const r = await call(token, 'getUpdates', { timeout: POLL_SECONDS });
  const seen = new Map();
  if (r.ok) for (const u of updates(r.result)) {
    const m = u?.message ?? {};
    if (m.chat?.id !== undefined) seen.set(String(m.chat.id), m.from?.display_name ?? m.from?.name ?? '?');
  }
  if (seen.size) {
    for (const [id, name] of seen) console.log(`\nZALO_NOTIFY_CHAT_ID=${id}    (từ: ${name})`);
    console.log('Ghi lại số này để nhập vào Cloudflare (bước D).');
    process.exit(0);
  }
  if (!r.ok && ![undefined, 408].includes(r.error_code)) { console.log(`Bot từ chối: ${JSON.stringify(r).slice(0, 200)}`); process.exit(1); }
  console.log(`  … chưa có tin (lượt ${i}/${ROUNDS})`);
}
console.log('Chưa nhận được tin. Chạy lại và nhắn bot TRONG LÚC lệnh đang chờ.');
process.exit(1);
