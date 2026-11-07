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

test('ca bàn giao: 3 kiện × 4 kg → mỗi kiện 20.000 đ/kg (không gộp 12 kg → 16.000)', () => {
  const e = P.estimate(T, { lCm: 20, wCm: 20, hCm: 20, kg: 4, count: 3 }); // quy đổi 1,33 kg < 4 kg
  assert.equal(e.chargeablePerPackage, 4);
  assert.equal(e.tier.price, 20000);
  assert.equal(e.total, 240000);
  assert.equal(P.tierFor(T, 12).price, 16000, 'nếu gộp lô 12 kg sẽ ra 16.000 — KHÔNG được dùng');
});

test('FAQ trang tuyến (vi + zh) nêu đủ 5 mức và "từng kiện"', () => {
  for (const p of ROUTES) {
    const html = read(p);
    const faq = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((m) => JSON.parse(m[1])).find((d) => d['@type'] === 'FAQPage');
    const cuoc = faq.mainEntity.find((q) => /Cước vận chuyển từ .* tính thế nào/.test(q.name));
    assert.ok(cuoc, `${p}: thiếu câu cước trong FAQPage`);
    for (const v of ['20.000đ/kg', '16.000đ/kg', '15.000đ/kg', '14.000đ/kg', '12.000đ/kg', 'từng kiện']) assert.ok(cuoc.acceptedAnswer.text.includes(v), `${p}: ${v}`);
    assert.match(text(html), /按每件货物的计费重量确定/, `${p}: FAQ zh`);
  }
});

test('verifier P1-1: KHÔNG câu nào nói áp giá theo cả lô / 整批 — mọi câu nhắc "lô"/整批/同一批 phải là câu phủ định', () => {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
  for (const f of walk(dist)) {
    const html = readFileSync(f, 'utf8');
    // Gồm cả chữ hiển thị và JSON-LD (FAQPage/Service) — nơi Google/AI đọc.
    const all = text(html) + ' ' + [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((m) => m[1]).join(' ');
    for (const sentence of all.split(/[.;。；!?！？]\s|[。；]/)) {
      // Lookaround Unicode: `\b` của JS không nhận chữ có dấu ("lô", "cả").
      if (/(?<!\p{L})(?:cả|toàn bộ|tổng)(?!\p{L})[^.]{0,60}?(?<!\p{L})lô(?!\p{L})|(?<!\p{L})gộp(?!\p{L})[^.]{0,20}lô|整批|同一批|总重量/u.test(sentence)) {
        assert.match(sentence, /(?<!\p{L})không(?!\p{L})|不/u, `${f.replace(dist, '')}: câu áp giá theo lô: "${sentence.trim().slice(0, 160)}"`);
      }
    }
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
  const ADDR = ['深圳市宝安区福海街道海洋新城新钢物流园三期2栋', '福建省厦门市海沧区囷瑶路嘉功物流2号库3号仓', '广州市白云区钟落潭镇虎塘村凤岗路26号', '义乌市北苑三期秋实路121号6号楼10-12库西门，靠5号货梯'];
  const seen = new Set();
  for (const p of ['/logistics/kho-trung-quoc/', ...ROUTES]) {
    for (const [, t] of read(p).matchAll(/<p class="addr"[^>]*data-copy-text[^>]*>([^<]*)</g)) { assert.ok(ADDR.includes(t.trim()), `${p}: chuỗi sao chép lạ "${t}"`); seen.add(t.trim()); }
  }
  assert.equal(seen.size, 4, 'đủ 4 địa chỉ có nút sao chép');
});
