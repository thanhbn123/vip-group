// VIPG-WEB-022 — Bảng giá vận chuyển Trung Quốc – Việt Nam song ngữ trên trang chủ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const section = html.slice(html.indexOf('<section class="section price-section"'), html.indexOf('</section>', html.indexOf('<section class="section price-section"')));
const t = text(section);

// Đúng nguyên văn yêu cầu owner 06/11/2026.
const EXPECTED = [
  ['0–5 kg', '20.000'],
  ['Trên 5 đến dưới 100 kg', '16.000'],
  ['Từ 100 đến dưới 500 kg', '15.000'],
  ['Từ 500 đến 1.000 kg', '14.000'],
  ['Trên 1.000 kg', '12.000'],
];

test('trang chủ có khối bảng giá, đúng 5 mức, đúng thứ tự và đúng giá', () => {
  assert.ok(section.length > 100, 'thiếu khối bảng giá');
  const rows = [...section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(1).map((m) => text(m[1]).trim());
  assert.equal(rows.length, 5, `số dòng: ${rows.length}`);
  EXPECTED.forEach(([label, price], i) => {
    assert.ok(rows[i].startsWith(label), `dòng ${i + 1}: "${rows[i]}" phải bắt đầu bằng "${label}"`);
    assert.ok(rows[i].includes(`${price} đ/kg`) || rows[i].includes(`${price}đ/kg`), `dòng ${i + 1}: thiếu giá ${price}đ/kg — "${rows[i]}"`);
  });
});

test('các mức khối lượng nối liền, không hở, không chồng (dữ liệu nguồn)', async () => {
  const src = readFileSync(join(root, 'src/data/vi/pricing.ts'), 'utf8');
  const tiers = [...src.matchAll(/min: (\d+), minInclusive: (true|false), max: (\d+|null), maxInclusive: (true|false), price: (\d+)/g)]
    .map((m) => ({ min: +m[1], minIn: m[2] === 'true', max: m[3] === 'null' ? null : +m[3], maxIn: m[4] === 'true', price: +m[5] }));
  assert.equal(tiers.length, 5);
  assert.deepEqual(tiers.map((x) => x.price), [20000, 16000, 15000, 14000, 12000]);
  assert.equal(tiers[0].min, 0);
  assert.equal(tiers.at(-1).max, null);
  for (let i = 1; i < tiers.length; i++) {
    assert.equal(tiers[i].min, tiers[i - 1].max, `mức ${i + 1} không nối mức ${i}`);
    assert.notEqual(tiers[i].minIn, tiers[i - 1].maxIn, `biên ${tiers[i].min} kg bị ${tiers[i].minIn ? 'chồng' : 'hở'}`);
  }
  // Mỗi khối lượng thử rơi vào đúng một mức.
  const at = (kg) => tiers.filter((x) => (x.minIn ? kg >= x.min : kg > x.min) && (x.max === null || (x.maxIn ? kg <= x.max : kg < x.max)));
  for (const [kg, price] of [[0, 20000], [5, 20000], [5.1, 16000], [99.9, 16000], [100, 15000], [499, 15000], [500, 14000], [1000, 14000], [1000.5, 12000], [5000, 12000]]) {
    const hit = at(kg);
    assert.equal(hit.length, 1, `${kg} kg rơi vào ${hit.length} mức`);
    assert.equal(hit[0].price, price, `${kg} kg`);
  }
});

test('song ngữ Việt – Trung: tiêu đề, cột, từng mức; chữ Trung gắn lang="zh-CN"', () => {
  // Tiêu đề theo chỉ thị owner V1.2 (G10).
  assert.match(section, /<h2 id="price-title"[^>]*>\s*VIP GROUP – BẢNG GIÁ VẬN CHUYỂN/);
  assert.match(section, /<span class="title-zh"[^>]*lang="zh-CN"[^>]*>VIP GROUP 运输价格表<\/span>/);
  assert.match(text(section), /Trung Quốc – Việt Nam \/ 中国 – 越南/);
  assert.match(section, /<a [^>]*href="tel:0961102655"[^>]*>Gọi tư vấn: 0961 102 655<\/a>/, 'G10: nút Gọi tư vấn hoạt động trên điện thoại');
  for (const zh of ['重量', '单价', '0–5 公斤', '超过 5 公斤，不足 100 公斤', '100 公斤至不足 500 公斤', '500–1,000 公斤（含 1,000）', '超过 1,000 公斤']) {
    assert.ok(new RegExp(`lang="zh-CN"[^>]*>[^<]*${zh}`).test(section), `thiếu chữ Trung có lang: ${zh}`);
  }
  assert.ok(!/[一-鿿]/.test(section.replace(/<span[^>]*lang="zh-CN"[^>]*>[^<]*<\/span>/g, '')), 'mọi chữ Hán phải nằm trong phần tử lang="zh-CN"');
});

test('nhãn tiếng Trung không dùng 以上/以下 (dễ hiểu là gồm cả mốc → chồng mức)', () => {
  const src = readFileSync(join(root, 'src/data/vi/pricing.ts'), 'utf8');
  for (const [, zh] of src.matchAll(/labelZh: '([^']+)'/g)) assert.doesNotMatch(zh, /以上|以下/, zh);
});

test('giữ khẩu hiệu VIP GROUP trong khối bảng giá', () => {
  assert.match(t, /VIP GROUP · Con người - Công nghệ - Cơ hội/);
});

test('chú thích: đơn vị VNĐ/kg; phụ phí và thuế (nếu có) được xác nhận trước', () => {
  assert.match(t, /Đơn vị tính: VNĐ\/kg/);
  assert.match(t, /Phụ phí và thuế \(nếu có\) sẽ được xác nhận trước khi báo giá chính thức\./);
  assert.match(t, /单位：越南盾\/公斤/);
  assert.match(t, /附加费及税费（如有）将在正式报价前确认。/);
});

test('bảng có ngữ nghĩa: caption, th scope=col/row', () => {
  assert.match(section, /<caption[^>]*>/);
  assert.equal((section.match(/<th scope="col"/g) ?? []).length, 2);
  assert.equal((section.match(/<th scope="row"/g) ?? []).length, 5);
});

test('schema Service/Offer: đúng 5 mức VND/kg, không khai thời gian giao / đánh giá', () => {
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.equal(lds[0]['@type'], 'Organization', 'Organization giữ vị trí đầu');
  const svc = lds.find((d) => d['@type'] === 'Service');
  assert.ok(svc);
  assert.deepEqual(svc.offers.map((o) => o.priceSpecification.price), [20000, 16000, 15000, 14000, 12000]);
  for (const o of svc.offers) {
    assert.equal(o.priceCurrency, 'VND');
    assert.equal(o.priceSpecification.unitCode, 'KGM');
  }
  assert.doesNotMatch(JSON.stringify(lds), /aggregateRating|Review|deliveryTime|transitTime/);
});

test('không ảnh hưởng nội dung trang chủ đang chạy: title, H1, các khối cũ, thứ tự', () => {
  assert.match(html, /<title>VIP GROUP \| Con người - Công nghệ - Cơ hội<\/title>/);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
  // Owner 07/11/2026: bỏ VIPORDER → không còn khối "Công ty thành viên" trên trang chủ.
  const order = ['hero-title', 'about-title', 'sectors-title', 'price-title', 'news-title', 'careers-title', 'cta-title'];
  const pos = order.map((id) => html.indexOf(`id="${id}"`));
  assert.ok(pos.every((p) => p > 0), `thiếu khối: ${order.filter((_, i) => pos[i] < 0)}`);
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'thứ tự khối trang chủ thay đổi ngoài dự kiến');
  // Bản sao lưu trang chủ production trước thay đổi.
  const live = readFileSync(join(root, 'docs/backup/live-home-2026-11-06.html'), 'utf8');
  // Thay đổi có chủ đích khác: link "Chính sách bảo mật" ở chân trang (VIPG-WEB-023).
  // Thay đổi có chủ đích ngoài bảng giá: link "Chính sách bảo mật" chân trang (023); mục menu/chân trang "Logistics"
  // và link "Dịch vụ vận chuyển Trung Quốc – Việt Nam →" trên thẻ lĩnh vực (021).
  const strip = (h) => text(h.replace(/<section class="section price-section"[\s\S]*?<\/section>/, '').replace(/<section class="section" aria-labelledby="members-title"[\s\S]*?<\/section>/, '')).replace(/© \d{4}/, '')
    .replace(/Chính sách bảo mật · /, '').replace(/0961 102 655/g, '0961102655').replace(/ Xem thêm: Vận chuyển hàng Trung Quốc về Bắc Ninh · Vận chuyển Thâm Quyến về Việt Nam /, ' ').replace(/ Logistics /g, ' ').replace(/ Dịch vụ vận chuyển Trung Quốc – Việt Nam → /, ' ');
  // Thay đổi có chủ đích duy nhất ngoài bảng giá: owner đổi Hotline/Zalo 0968961962 → 0961102655 (06/11/2026).
  const liveNewPhone = live.replace(/0968961962/g, '0961102655').replace(/\+84968961962/g, '+84961102655');
  assert.equal(strip(html), strip(liveNewPhone), 'ngoài khối bảng giá + số điện thoại mới, nội dung chữ trang chủ phải giống hệt bản production');
});
