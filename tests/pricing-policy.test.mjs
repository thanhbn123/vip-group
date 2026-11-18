// Chính sách giá: owner 18/11/2026 (VIPG-WEB-036 "Q5a", như phiếu xuất kho CRM V9.12) — bậc giá theo TỔNG trọng lượng tính cước của cả lô
// (cộng cân tính cước đã làm tròn của từng kiện; thay chỉ thị 07/11/2026 "từng kiện, không gộp lô"),
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
const ROUTES = ['tham-quyen', 'ha-mon', 'quang-chau', 'nghia-o', 'bang-tuong'].map((id) => `/logistics/van-chuyen-${id}-ve-viet-nam/`);

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

test('GỘP LÔ như phiếu xuất (owner 18/11/2026): 10 kiện × 12 kg = 120 kg → bậc 15.000 đ/kg', () => {
  const e = P.estimate(T, { lCm: 30, wCm: 30, hCm: 30, kg: 12, count: 10 });
  assert.equal(e.chargeablePerPackage, 12);
  assert.equal(e.totalKg, 120);
  assert.equal(e.tier.price, 15000);
  assert.equal(e.total, 1800000);
  // 1 kiện 120 kg mới vào bậc 15.000.
  assert.equal(P.estimate(T, { lCm: 30, wCm: 30, hCm: 30, kg: 120, count: 1 }).tier.price, 15000);
});

test('làm tròn như phiếu xuất: mỗi kiện < 1 kg → 1 kg, từ 1 kg lên 0,1 kg; tổng × đơn giá bậc theo tổng', () => {
  const e = P.estimate(T, { lCm: 33, wCm: 27, hCm: 19, kg: 2, count: 3 }); // 16.929 cm³ ÷ 6000 = 2,8215 kg → 2,9 kg
  assert.equal(e.chargeablePerPackage, 2.9);
  assert.equal(e.totalKg, 8.7);
  assert.equal(e.tier.price, 16000);
  assert.equal(e.total, 139200);
  assert.equal(P.roundChargeableKg(0.4), 1); assert.equal(P.roundChargeableKg(1.11), 1.2); assert.equal(P.roundChargeableKg(3), 3);
  assert.ok(Number.isInteger(e.total));
  assert.equal(P.estimate(T, { lCm: 1, wCm: 1, hCm: 1, kg: 5, count: 2.4 }).count, 2, 'số kiện là số nguyên');
});

test('nguồn dữ liệu: basis vi/zh nêu bậc theo tổng cân cả lô (như phiếu xuất), hệ số 6000, các kho', () => {
  assert.match(pricing.basis, /tổng trọng lượng tính cước của cả lô/);
  assert.match(pricing.basis, /như phiếu xuất kho/);
  assert.doesNotMatch(pricing.basis, /không (cộng )?gộp/);
  assert.match(pricing.basis, /÷ 6000/);
  assert.match(pricing.basis, /Thâm Quyến, Hạ Môn, Quảng Châu, Nghĩa Ô/);
  assert.match(pricing.basisZh, /总计费重量/);
  assert.match(pricing.basisZh, /出库单/);
  assert.doesNotMatch(pricing.basisZh, /不合并/);
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
    assert.match(text(read(p)), /tổng trọng lượng tính cước (của )?cả lô/, `${p}: thiếu chính sách bậc theo tổng cân cả lô`);
  }
});

test('4 trang tuyến: hiện đủ 5 bậc giá + Offer schema đúng 5 đơn giá, eligibleQuantity theo kg (tổng cân)', () => {
  for (const p of ROUTES) {
    const html = read(p);
    const t = text(html);
    for (const [label, price] of [['0–5 kg', '20.000'], ['Trên 5 đến dưới 100 kg', '16.000'], ['Từ 100 đến dưới 500 kg', '15.000'], ['Từ 500 đến 1.000 kg', '14.000'], ['Trên 1.000 kg', '12.000']]) {
      assert.match(t, new RegExp(`${label} .{0,40}?${price.replace('.', '\\.')} đ/kg`), `${p}: ${label}`);
    }
    const lds = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const svc = lds.find((d) => d['@type'] === 'Service');
    assert.deepEqual(svc.offers.map((o) => o.priceSpecification.price), [20000, 16000, 15000, 14000, 12000], p);
    assert.ok(svc.offers.every((o) => o.priceSpecification.eligibleQuantity.unitText === 'kg'), p);
  }
});

test('công cụ tính trên trang bảng giá có đủ ô cước ước tính theo kiện', () => {
  const html = read('/logistics/bang-gia/');
  for (const k of ['charge', 'tier', 'cost', 'cost-per']) assert.match(html, new RegExp(`data-out="${k}"`), k);
  assert.match(html, /data-divisor="6000"/);
});

test('3 kiện × 4 kg → gộp 12 kg → 16.000 đ/kg = 192.000 đ (như phiếu xuất; trước 18/11 tính riêng 240.000 đ)', () => {
  const e = P.estimate(T, { lCm: 20, wCm: 20, hCm: 20, kg: 4, count: 3 }); // quy đổi 1,33 kg < 4 kg
  assert.equal(e.chargeablePerPackage, 4);
  assert.equal(e.totalKg, 12);
  assert.equal(e.tier.price, 16000);
  assert.equal(e.total, 192000);
});

test('FAQ trang tuyến (vi + zh) nêu đủ 5 mức và bậc theo tổng cân cả lô', () => {
  for (const p of ROUTES) {
    const html = read(p);
    const faq = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((m) => JSON.parse(m[1])).find((d) => d['@type'] === 'FAQPage');
    const cuoc = faq.mainEntity.find((q) => /Cước vận chuyển từ .* tính thế nào/.test(q.name));
    assert.ok(cuoc, `${p}: thiếu câu cước trong FAQPage`);
    for (const v of ['20.000đ/kg', '16.000đ/kg', '15.000đ/kg', '14.000đ/kg', '12.000đ/kg', 'cả lô']) assert.ok(cuoc.acceptedAnswer.text.includes(v), `${p}: ${v}`);
    assert.match(text(html), /按整批货物的总计费重量确定/, `${p}: FAQ zh`);
  }
});

test('owner 18/11/2026 (Q5a): KHÔNG còn câu "không gộp lô" / 不合并整批 ở bất kỳ trang nào (HTML + JSON-LD)', () => {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
  for (const f of walk(dist)) {
    const html = readFileSync(f, 'utf8');
    // Gồm cả chữ hiển thị và JSON-LD (FAQPage/Service) — nơi Google/AI đọc.
    const all = text(html) + ' ' + [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((m) => m[1]).join(' ');
    assert.doesNotMatch(all, /không (cộng )?gộp (cả |các kiện trong )?lô|不合并整批|xét riêng từng kiện/u, `${f.replace(dist, '')}: còn câu chính sách cũ "không gộp lô"`);
  }
});

test('verifier P1-2: công cụ tính gọi estimate THEO KIỆN (kg 1 kiện + số kiện), không tự tính gộp', () => {
  const src = readFileSync(join(root, 'src/components/logistics/VolumeCalculator.astro'), 'utf8');
  const script = src.slice(src.indexOf('<script>'));
  assert.match(script, /import \{ estimate \} from '\.\.\/\.\.\/lib\/pricing'/);
  assert.match(script, /estimate\(pricing\.tiers, \{ lCm: num\('vc-l'\), wCm: num\('vc-w'\), hCm: num\('vc-h'\), kg: num\('vc-kg'\), count: n \}, divisor\)/,
    'phải truyền cân nặng MỘT kiện + số kiện');
  assert.doesNotMatch(script, /tierFor|price\s*\*|\.tiers\.find|\.tiers\.filter/, 'không được có logic chọn bậc riêng trong component');
});

test('verifier P1-2: nút sao chép chép TOÀN BỘ địa chỉ; chuỗi trên trang khớp nguyên văn 4 địa chỉ owner', () => {
  const src = readFileSync(join(root, 'src/components/logistics/CopyAddress.astro'), 'utf8');
  assert.match(src, /const text = \(src\.textContent \?\? ''\)\.trim\(\);/);
  assert.match(src, /navigator\.clipboard\.writeText\(text\)/);
  assert.doesNotMatch(src.slice(src.indexOf('<script>')), /\.slice\(|substring|substr\(|replace\(/, 'không được cắt/sửa chuỗi trước khi chép');
  const ADDR = ['深圳市宝安区福海街道海洋新城新钢物流园三期2栋', '福建省厦门市海沧区囷瑶路嘉功物流2号库3号仓', '广州市白云区钟落潭镇虎塘村凤岗路26号', '义乌市北苑三期秋实路121号6号楼10-12库西门，靠5号货梯',
    // VIPG-WEB-035 · owner 18/11/2026
    '广西壮族自治区崇左市凭祥市友谊镇南山民族希望学校对面丰旗货场5号（雲晟跨境供应链）'];
  const seen = new Set();
  for (const p of ['/logistics/kho-trung-quoc/', ...ROUTES]) {
    for (const [, t] of read(p).matchAll(/<p class="addr"[^>]*data-copy-text[^>]*>([^<]*)</g)) { assert.ok(ADDR.includes(t.trim()), `${p}: chuỗi sao chép lạ "${t}"`); seen.add(t.trim()); }
  }
  assert.equal(seen.size, ADDR.length, 'đủ mọi địa chỉ owner có nút sao chép');
});
