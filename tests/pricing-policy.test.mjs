// Chính sách giá owner chốt 07/11/2026: bậc giá theo trọng lượng tính cước TỪNG KIỆN (không gộp lô),
// cân quy đổi = dài × rộng × cao (cm) ÷ 6000, một bảng giá chung cho 4 kho. Test chạy đúng mô-đun thật src/lib/pricing.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(pathToFileURL(join(root, 'src/lib/pricing.ts')).href);
const { pricing } = await import(pathToFileURL(join(root, 'src/data/vi/pricing.ts')).href);
const T = pricing.tiers;
const dist = join(root, 'dist');
const read = (p) => readFileSync(join(dist, p, 'index.html'), 'utf8');
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const ROUTES = ['tham-quyen', 'ha-mon', 'quang-chau', 'nghia-o'].map((id) => `/logistics/van-chuyen-${id}-ve-viet-nam/`);

test('ngưỡng giá: mỗi khối lượng/kiện rơi đúng 1 bậc, kể cả sát biên', () => {
  const cases = [
    [0, 20000], [0.01, 20000], [4.99, 20000], [5, 20000],          // 0–5 kg (gồm 5)
    [5.0001, 16000], [5.01, 16000], [99.99, 16000],                // trên 5 đến dưới 100
    [100, 15000], [100.01, 15000], [499.99, 15000],                // từ 100 đến dưới 500
    [500, 14000], [750, 14000], [1000, 14000],                     // từ 500 đến 1.000 (gồm 1.000)
    [1000.0001, 12000], [1000.01, 12000], [25000, 12000],          // trên 1.000
  ];
  for (const [kg, price] of cases) assert.equal(P.tierFor(T, kg).price, price, `${kg} kg/kiện`);
  assert.throws(() => P.tierFor(T, -1), /rơi vào 0 bậc/);
});

test('công thức quy đổi: dài × rộng × cao (cm) ÷ 6000; tính cước theo số lớn hơn', () => {
  assert.equal(P.VOLUMETRIC_DIVISOR, 6000);
  assert.equal(P.volumetricKg(60, 50, 40), 20);            // 120.000 ÷ 6000
  assert.equal(P.volumetricKg(100, 100, 100), 1000000 / 6000);
  assert.equal(P.chargeableKg(12, 60, 50, 40), 20);        // hàng nhẹ cồng kềnh → theo quy đổi
  assert.equal(P.chargeableKg(30, 60, 50, 40), 30);        // hàng nặng → theo cân thực
  assert.equal(P.chargeableKg(0, 0, 0, 0), 0);
  assert.equal(P.chargeableKg(-5, -1, 10, 10), 0, 'giá trị âm không làm sai kết quả');
});

test('TỪNG KIỆN, không gộp lô: 10 kiện × 12 kg → mỗi kiện 16.000 đ/kg (không phải bậc 120 kg = 15.000)', () => {
  const e = P.estimate(T, { lCm: 30, wCm: 30, hCm: 30, kg: 12, count: 10 });
  assert.equal(e.chargeablePerPackage, 12);
  assert.equal(e.tier.price, 16000);
  assert.equal(e.perPackage, 192000);
  assert.equal(e.total, 1920000);
  // 1 kiện 120 kg mới vào bậc 15.000.
  assert.equal(P.estimate(T, { lCm: 30, wCm: 30, hCm: 30, kg: 120, count: 1 }).tier.price, 15000);
});

test('làm tròn: KHÔNG làm tròn khối lượng (owner chưa quy định); tiền ước tính làm tròn tới đồng', () => {
  const e = P.estimate(T, { lCm: 33, wCm: 27, hCm: 19, kg: 2, count: 3 }); // 16.929 cm³ ÷ 6000 = 2,8215 kg
  assert.equal(e.chargeablePerPackage, (33 * 27 * 19) / 6000);
  assert.equal(e.tier.price, 20000);
  assert.equal(e.total, Math.round(((33 * 27 * 19) / 6000) * 20000 * 3));
  assert.ok(Number.isInteger(e.total));
  assert.equal(P.estimate(T, { lCm: 1, wCm: 1, hCm: 1, kg: 5, count: 2.4 }).count, 2, 'số kiện là số nguyên');
});

test('nguồn dữ liệu: basis vi/zh nêu "từng kiện", "không gộp", hệ số 6000, 4 kho', () => {
  assert.match(pricing.basis, /từng kiện/);
  assert.match(pricing.basis, /không cộng gộp cả lô/);
  assert.match(pricing.basis, /÷ 6000/);
  assert.match(pricing.basis, /Thâm Quyến, Hạ Môn, Quảng Châu, Nghĩa Ô/);
  assert.match(pricing.basisZh, /每件/);
  assert.match(pricing.basisZh, /不合并/);
  const src = readFileSync(join(root, 'src/data/vi/logistics.ts'), 'utf8');
  assert.equal((src.match(/priceApplies: \{ value: 'Áp dụng bảng giá chung Trung Quốc – Việt Nam', source: SRC_OWNER_PRICE \}/g) ?? []).length, 4);
});

test('toàn site: không còn câu "theo tổng khối lượng cả lô"; trang giá + 4 trang tuyến + mạng lưới kho đồng bộ chính sách', () => {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
  for (const f of walk(dist)) {
    const t = text(readFileSync(f, 'utf8'));
    assert.doesNotMatch(t, /theo tổng khối lượng[^.]*cả lô|按同一批货物的总计费重量/, `${f}: còn chính sách cũ (cả lô)`);
    assert.doesNotMatch(t, /được xác nhận khi báo giá — gửi yêu cầu báo giá/, `${f}: còn câu "đơn giá kho … xác nhận khi báo giá"`);
  }
  for (const p of ['/', '/logistics/bang-gia/', '/logistics/kho-trung-quoc/', ...ROUTES]) {
    assert.match(text(read(p)), /trọng lượng tính cước (của )?từng kiện/, `${p}: thiếu chính sách từng kiện`);
  }
});

test('4 trang tuyến: hiện đủ 5 bậc giá + Offer schema đúng 5 đơn giá, eligibleQuantity theo kiện', () => {
  for (const p of ROUTES) {
    const html = read(p);
    const t = text(html);
    for (const [label, price] of [['0–5 kg', '20.000'], ['Trên 5 đến dưới 100 kg', '16.000'], ['Từ 100 đến dưới 500 kg', '15.000'], ['Từ 500 đến 1.000 kg', '14.000'], ['Trên 1.000 kg', '12.000']]) {
      assert.match(t, new RegExp(`${label} .{0,40}?${price.replace('.', '\\.')} đ/kg`), `${p}: ${label}`);
    }
    const lds = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const svc = lds.find((d) => d['@type'] === 'Service');
    assert.deepEqual(svc.offers.map((o) => o.priceSpecification.price), [20000, 16000, 15000, 14000, 12000], p);
    assert.ok(svc.offers.every((o) => o.priceSpecification.eligibleQuantity.unitText === 'kg/kiện'), p);
  }
});

test('công cụ tính trên trang bảng giá có đủ ô cước ước tính theo kiện', () => {
  const html = read('/logistics/bang-gia/');
  for (const k of ['charge', 'tier', 'cost', 'cost-per']) assert.match(html, new RegExp(`data-out="${k}"`), k);
  assert.match(html, /data-divisor="6000"/);
});
