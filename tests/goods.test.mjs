// VIPG-WEB-032 · /api/goods/rules + /api/goods/check (public/_worker.js) chuyển tiếp sang CRM /api/public/goods-* bằng NEWS_PUBLIC_KEY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleGoods } from '../public/_worker.js';

const ENV = { CRM_NEWS_URL: 'https://crm.example.test/', NEWS_PUBLIC_KEY: 'k'.repeat(40) };
const req = (p, init = {}) => new Request(`https://www.vipgroup.com.vn${p}`, init);
function fakeFetch(status, body, seen) {
  return async (url, opt) => { seen?.push({ url, opt }); return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); };
}

test('chưa cấu hình → 503; chỉ GET; thiếu q → 400', async () => {
  assert.equal((await handleGoods(req('/api/goods/rules'), {})).status, 503);
  assert.equal((await handleGoods(req('/api/goods/rules', { method: 'POST' }), ENV)).status, 405);
  assert.equal((await handleGoods(req('/api/goods/check?q=%20'), ENV, fakeFetch(200, {}))).status, 400);
});

test('chuyển tiếp: khóa X-News-Key + IP người xem; danh sách có cache 300 s', async () => {
  const seen = [];
  const r = await handleGoods(req('/api/goods/check?q=n%C6%B0%E1%BB%9Bc%20hoa', { headers: { 'cf-connecting-ip': '1.2.3.4' } }), ENV, fakeFetch(200, { level: 'banned', matches: [] }, seen));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).level, 'banned');
  assert.equal(seen[0].url, 'https://crm.example.test/api/public/goods-check?q=n%C6%B0%E1%BB%9Bc%20hoa');
  assert.equal(seen[0].opt.headers['x-news-key'], ENV.NEWS_PUBLIC_KEY);
  assert.equal(seen[0].opt.headers['x-client-ip'], '1.2.3.4');
  const l = await handleGoods(req('/api/goods/rules'), ENV, fakeFetch(200, { groups: [] }));
  assert.equal(l.headers.get('cache-control'), 'public, max-age=300');
});

test('CRM chưa bật trang công khai → 404 disabled; quá nhanh → 429; CRM lỗi → 502', async () => {
  let r = await handleGoods(req('/api/goods/rules'), ENV, fakeFetch(404, { error: { code: 'GOODS_DISABLED' } }));
  assert.equal(r.status, 404); assert.equal((await r.json()).error, 'disabled');
  r = await handleGoods(req('/api/goods/check?q=x'), ENV, fakeFetch(429, {}));
  assert.equal(r.status, 429);
  r = await handleGoods(req('/api/goods/check?q=x'), ENV, async () => { throw new Error('down'); });
  assert.equal(r.status, 502);
});

test('worker định tuyến /api/goods/* (không rơi vào 404 api)', async () => {
  const r = await worker.fetch(req('/api/goods/rules'), {}, {});
  assert.equal(r.status, 503);
});
