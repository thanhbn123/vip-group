// VIPG-WEB-033 · /api/quote/price-list (GET) + /api/quote (POST) chuyển sang CRM /api/public/price-list | price-quote (NEWS_PUBLIC_KEY, x-client-ip).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleQuote } from '../public/_worker.js';

const ENV = { CRM_NEWS_URL: 'https://crm.example.test', NEWS_PUBLIC_KEY: 'k'.repeat(40) };
const req = (p, init = {}) => new Request(`https://www.vipgroup.com.vn${p}`, init);
const fake = (status, body, seen) => async (url, opt) => { seen?.push({ url, opt }); return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); };

test('chưa cấu hình → 503; sai phương thức → 405; JSON hỏng → 400', async () => {
  assert.equal((await handleQuote(req('/api/quote/price-list'), {})).status, 503);
  assert.equal((await handleQuote(req('/api/quote/price-list', { method: 'POST', body: '{}' }), ENV)).status, 405);
  assert.equal((await handleQuote(req('/api/quote'), ENV)).status, 405);
  assert.equal((await handleQuote(req('/api/quote', { method: 'POST', body: '{x' }), ENV, fake(200, {}))).status, 400);
});
test('chuyển tiếp báo giá: khóa + IP, thân JSON giữ nguyên; lỗi dữ liệu CRM 400/409 trả lại thông điệp', async () => {
  const seen = [];
  const body = { warehouse_code: 'SZ', lines: [{ weight_kg: 12, packages: 2 }] };
  const r = await handleQuote(req('/api/quote', { method: 'POST', body: JSON.stringify(body), headers: { 'cf-connecting-ip': '9.9.9.9' } }), ENV, fake(200, { total: { amount: '480000' } }, seen));
  assert.equal(r.status, 200); assert.equal((await r.json()).total.amount, '480000');
  assert.equal(seen[0].url, 'https://crm.example.test/api/public/price-quote');
  assert.equal(seen[0].opt.headers['x-news-key'], ENV.NEWS_PUBLIC_KEY); assert.equal(seen[0].opt.headers['x-client-ip'], '9.9.9.9');
  assert.deepEqual(JSON.parse(seen[0].opt.body), body);
  const e = await handleQuote(req('/api/quote', { method: 'POST', body: JSON.stringify(body) }), ENV, fake(409, { error: { code: 'QUOTE_NO_PRICE', message: 'Kho này chưa có bảng giá' } }));
  assert.equal(e.status, 409); assert.equal((await e.json()).message, 'Kho này chưa có bảng giá');
  const l = await handleQuote(req('/api/quote/price-list'), ENV, fake(200, { lists: [] }));
  assert.equal(l.headers.get('cache-control'), 'public, max-age=300');
});
test('worker định tuyến /api/quote*', async () => {
  assert.equal((await worker.fetch(req('/api/quote/price-list'), {}, {})).status, 503);
});
