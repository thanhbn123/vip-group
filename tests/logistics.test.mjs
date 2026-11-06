// VIPG-WEB-021 — Khu Logistics: SEO kỹ thuật, chống trùng lặp, dữ liệu có cấu trúc, an toàn form,
// trung thực nội dung (không lọt dữ liệu MẪU ra production) và chế độ DEMO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const demo = join(root, 'dist-demo');
const SITE = 'https://www.vipgroup.com.vn';

const READY = ['/logistics/', '/logistics/van-chuyen-trung-quoc-bac-ninh/', '/logistics/van-chuyen-trung-quoc-viet-nam/',
  '/logistics/quy-trinh-gui-hang/', '/logistics/tra-cuu-van-don/', '/logistics/cau-hoi-thuong-gap/', '/logistics/lien-he/',
  // V1.1: bảng giá (đơn giá owner 06/11/2026) + tuyến Thâm Quyến (owner xác nhận nhận hàng tại Thâm Quyến) → ready.
  '/logistics/bang-gia/', '/logistics/van-chuyen-tham-quyen-viet-nam/'];
const PENDING = [];
// Trang kho: DRAFT cho tới khi owner xác nhận kho có thật (verifier P0-1).
const KT = '/logistics/kien-thuc/';
// Trang kho Quảng Châu + tuyến Thâm Quyến: DRAFT cho tới khi owner xác nhận nhận hàng/kho tại đó (verifier P0-1).
const DRAFT = ['/logistics/kho-quang-chau/', KT,
  ...['cach-tinh-so-khoi-va-can-nang-quy-doi', 'ghi-ma-khach-hang-khi-dat-hang-1688-taobao', 'dong-goi-hang-gui-tu-trung-quoc',
    'c-o-form-e-va-ma-hs-hang-tham-quyen', 'tham-quyen-o-dau-nhap-hang-tham-quyen', 'chinh-ngach-va-ky-gui-tron-goi-khac-nhau-the-nao',
    'thu-tuc-hai-quan-nhap-khau-hang-trung-quoc-duong-bo', 'hang-dien-tu-co-pin-tu-trung-quoc'].map((s) => `${KT}${s}/`)];
const BUILT = [...READY, ...PENDING];

const read = (path, base = dist) => readFileSync(join(base, path, 'index.html'), 'utf8');
const attr = (html, re) => html.match(re)?.[1];
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
const ldAll = (html) => [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map((m) => JSON.parse(m[1]));
function allHtml(dir) {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? allHtml(p) : p.endsWith('.html') ? [p] : []; });
}

test('production: đủ trang ready + pending, KHÔNG build trang nháp', () => {
  for (const p of BUILT) assert.ok(existsSync(join(dist, p, 'index.html')), `thiếu ${p}`);
  for (const p of DRAFT) assert.ok(!existsSync(join(dist, p, 'index.html')), `trang nháp lọt ra production: ${p}`);
});

for (const p of BUILT) {
  test(`logistics ${p}: một H1, title/description riêng, breadcrumb, nút liên hệ có đo lường`, () => {
    const html = read(p);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
    const title = attr(html, /<title>([^<]+)<\/title>/);
    assert.ok(title.endsWith(' | VIP GROUP') && title.length <= 70, `title: ${title} (${title.length})`);
    const desc = attr(html, /<meta name="description" content="([^"]+)"/);
    assert.ok(desc.length >= 50 && desc.length <= 170, `description dài ${desc.length}`);
    assert.match(html, /<nav class="breadcrumb" aria-label="Đường dẫn"[^>]*>/);
    assert.match(html, /<nav class="lg-subnav[^"]*" aria-label="Mục Logistics"[^>]*>/);
    const lds = ldAll(html);
    assert.equal(lds[0]['@type'], 'Organization', 'Organization VIP GROUP vẫn đứng đầu');
    const bc = lds.find((d) => d['@type'] === 'BreadcrumbList');
    assert.ok(bc, 'thiếu BreadcrumbList');
    assert.equal(bc.itemListElement.at(-1).item, `${SITE}${p}`);
    assert.equal(bc.itemListElement[0].item, `${SITE}/`);
    // Gọi điện / Zalo đều có data-track; Zalo đúng link VIPORDER công bố.
    assert.match(html, /<a [^>]*href="tel:0961102655"[^>]*data-track="call_click"/);
    assert.match(html, /<a [^>]*href="https:\/\/zalo\.me\/0961102655"[^>]*data-track="zalo_click"/);
    assert.match(html, /<nav class="sticky-bar[^"]*" aria-label="Liên hệ nhanh"[^>]*>/, 'thanh liên hệ nhanh mobile');
    // Ghi rõ đơn vị vận hành.
    assert.match(text(html), /CÔNG TY TNHH XUẤT NHẬP KHẨU LOGISTICS VIP ORDER/);
  });
}

test('trang ready: được lập chỉ mục, canonical đúng; trang pending: noindex, không canonical', () => {
  for (const p of READY) {
    const html = read(p);
    assert.doesNotMatch(html, /<meta name="robots" content="[^"]*noindex/, p);
    assert.equal(attr(html, /<link rel="canonical" href="([^"]+)"/), `${SITE}${p}`, p);
  }
  for (const p of PENDING) {
    const html = read(p);
    assert.match(html, /<meta name="robots" content="noindex"/, `${p} phải noindex khi còn thiếu dữ liệu`);
    assert.doesNotMatch(html, /rel="canonical"/, p);
  }
});

test('sitemap: có mọi trang ready, không có trang pending / nháp', () => {
  const sm = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  for (const p of READY) assert.ok(sm.includes(`<loc>${SITE}${p}</loc>`), `sitemap thiếu ${p}`);
  for (const p of [...PENDING, ...DRAFT]) assert.ok(!sm.includes(`<loc>${SITE}${p}</loc>`), `sitemap không được có ${p}`);
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, 'sitemap có URL trùng');
});

test('chống trùng lặp: title, description, H1 khác nhau trên toàn site', () => {
  const seen = { title: new Map(), desc: new Map(), h1: new Map() };
  for (const file of allHtml(dist)) {
    if (file.endsWith('404.html')) continue;
    const html = readFileSync(file, 'utf8');
    const vals = {
      title: attr(html, /<title>([^<]+)<\/title>/),
      desc: attr(html, /<meta name="description" content="([^"]+)"/),
      h1: text(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? '').replace(/\s+/g, ' ').trim(),
    };
    for (const [k, v] of Object.entries(vals)) {
      assert.ok(!seen[k].has(v), `${k} trùng: "${v}" ở ${file.replace(dist, '')} và ${seen[k].get(v)}`);
      seen[k].set(v, file.replace(dist, ''));
    }
  }
});

test('production KHÔNG chứa dữ liệu MẪU, giá, thời gian giao hay đánh giá chưa xác minh', () => {
  for (const file of allHtml(dist)) {
    const html = readFileSync(file, 'utf8');
    // Giá DUY NHẤT được phép: 5 mức owner cung cấp 06/11/2026 (src/data/vi/pricing.ts). Mọi giá khác vẫn bị chặn.
    const t = text(html).replace(/\b(?:20|16|15|14|12)\.000\s*(?:đ\/kg|VNĐ\/kg)/g, ' ').replace(/(?:20|16|15|14|12)\.000(?=\s*đ\/kg)/g, ' ');
    assert.doesNotMatch(t, /\bMẪU\b|\[MẪU\]|KHÔNG PHẢI ĐỊA CHỈ THẬT|BẢN DEMO/, `${file}: lọt dữ liệu mẫu`);
    // Cờ `u` + lookahead Unicode: `\b` của JS không nhận "đ"/"₫" (verifier P1-2).
    assert.doesNotMatch(t, /\d[\d.,]*\s*(?:đ|₫|VNĐ|vnđ|VND|đồng|triệu|nghìn|k)(?![\p{L}\p{N}])/iu, `${file}: có giá tiền chưa xác minh`);
    if (file.replace(dist, '').startsWith('/logistics/')) {
      assert.doesNotMatch(t, /\d+(?:\s*[–-]\s*\d+)?\s*(?:ngày|giờ|tiếng|tuần)(?![\p{L}])/iu, `${file}: có thời gian giao chưa xác minh`);
    }
    assert.doesNotMatch(html, /aggregateRating|"Review"|ratingValue/, `${file}: không được có đánh giá`);
    assert.doesNotMatch(html, /"priceRange"/, `${file}: không khai priceRange`);
    // Offer chỉ được mang đúng 5 đơn giá owner (VND/kg).
    for (const m of html.matchAll(/"price":(\d+)/g)) assert.ok([20000, 16000, 15000, 14000, 12000].includes(Number(m[1])), `${file}: giá lạ trong schema ${m[1]}`);
    assert.doesNotMatch(t, /tập đoàn/i, file);
  }
});

test('Service schema: đơn vị cung cấp là VIPORDER, không gán địa chỉ Bắc Ninh cho VIP GROUP', () => {
  for (const p of ['/logistics/', '/logistics/van-chuyen-trung-quoc-bac-ninh/', '/logistics/van-chuyen-trung-quoc-viet-nam/']) {
    const lds = ldAll(read(p));
    const svc = lds.find((d) => d['@type'] === 'Service');
    assert.ok(svc, `${p}: thiếu Service`);
    assert.equal(svc.provider.name, 'VIPORDER');
    assert.equal(svc.provider.legalName, 'CÔNG TY TNHH XUẤT NHẬP KHẨU LOGISTICS VIP ORDER');
    assert.equal(svc.provider.url, 'https://viporder.com.vn');
    const org = lds[0];
    assert.equal(org.address.addressRegion, 'Tỉnh Lạng Sơn', 'địa chỉ VIP GROUP giữ nguyên');
    assert.ok(!JSON.stringify(org).includes('Bắc Ninh'));
  }
  const bn = ldAll(read('/logistics/van-chuyen-trung-quoc-bac-ninh/')).find((d) => d['@type'] === 'Service');
  assert.deepEqual(bn.areaServed, [{ '@type': 'AdministrativeArea', name: 'Bắc Ninh' }]);
});

test('địa chỉ Bắc Ninh chỉ xuất hiện kèm ghi chú nguồn VIPORDER', () => {
  for (const file of allHtml(dist)) {
    const t = text(readFileSync(file, 'utf8'));
    if (!t.includes('Số 62 Khu đô thị Nam Hồng')) continue;
    assert.ok(file.replace(dist, '').startsWith('/logistics/'), `${file}: địa chỉ VIPORDER lọt ra trang tập đoàn`);
    assert.match(t, /VIPORDER/, file);
  }
});

test('mọi dữ kiện có value đều phải có source (không xuất bản thông tin không nguồn)', () => {
  const src = readFileSync(join(root, 'src/data/vi/logistics.ts'), 'utf8');
  const bad = [...src.matchAll(/value:\s*(?!\s|null\b)([^,\n]+),\s*source:\s*null/g)].map((m) => m[1]);
  assert.deepEqual(bad, [], 'Fact có value nhưng source: null');
  // Build cũng tự dừng (lib/logistics.ts → shown()).
  assert.match(readFileSync(join(root, 'src/lib/logistics.ts'), 'utf8'), /thiếu source/);
});

test('không trang ready nào khẳng định có kho Quảng Châu / Thâm Quyến khi trang kho chưa xuất bản', () => {
  for (const p of READY) {
    const t = text(read(p));
    // Thâm Quyến: owner xác nhận nhận hàng 06/11/2026. Quảng Châu: trang còn nháp → không được khẳng định.
    assert.doesNotMatch(t, /[Kk]ho Quảng Châu/, `${p}: khẳng định có kho chưa xác minh`);
    assert.doesNotMatch(t, /kho (?:thuộc sở hữu|của) VIP GROUP/i, `${p}: không khẳng định sở hữu kho`);
    assert.doesNotMatch(t, /gom hàng|[Gg]om nhiều đơn/, `${p}: dịch vụ gom hàng chưa có nguồn`);
  }
});

test('FAQPage chỉ chứa câu trả lời đã có căn cứ', () => {
  const html = read('/logistics/cau-hoi-thuong-gap/');
  const faq = ldAll(html).find((d) => d['@type'] === 'FAQPage');
  assert.ok(faq && faq.mainEntity.length >= 5);
  const names = faq.mainEntity.map((q) => q.name);
  assert.ok(names.includes('Bảng giá vận chuyển Trung Quốc – Việt Nam bao nhiêu một kg?'), 'câu hỏi bảng giá (đã có nguồn) phải vào FAQPage');
  assert.ok(names.includes('Cước vận chuyển tính theo cân nặng hay theo khối?'), 'quy đổi 6000 owner xác nhận → vào FAQPage');
  for (const pendingQ of ['Hàng về Bắc Ninh mất bao lâu?', 'Gửi hàng về địa chỉ nào tại Trung Quốc?']) {
    assert.ok(!names.includes(pendingQ), `câu chưa xác minh không được vào FAQPage: ${pendingQ}`);
  }
  // Mọi câu hỏi trong schema đều hiển thị trên trang.
  for (const n of names) assert.ok(text(html).includes(n), `câu hỏi trong schema không hiển thị: ${n}`);
});

test('bảng giá chi tiết: đúng 5 mức owner, áp theo cả lô, quy đổi 6000, form thu lead chọn sẵn "báo giá"', () => {
  const html = read('/logistics/bang-gia/');
  const t = text(html).replace(/\s+/g, ' ');
  for (const [label, price] of [['0–5 kg', '20.000'], ['Trên 5 đến dưới 100 kg', '16.000'], ['Từ 100 đến dưới 500 kg', '15.000'], ['Từ 500 đến 1.000 kg', '14.000'], ['Trên 1.000 kg', '12.000']]) {
    assert.match(t, new RegExp(`${label} .{0,40}?${price.replace('.', '\\.')} ?đ/kg`), `${label} → ${price}`);
  }
  assert.match(t, /Đơn vị tính: VNĐ\/kg/);
  assert.match(t, /Phụ phí và thuế \(nếu có\) sẽ được xác nhận trước khi báo giá chính thức/);
  assert.match(t, /theo tổng khối lượng tính cước của cả lô hàng/, 'owner: áp giá theo tổng cả lô');
  assert.match(html, /data-calc data-divisor="6000"/, 'owner: quy đổi hệ số 6000');
  assert.doesNotMatch(t, /\bMẪU\b/);
  const start = html.indexOf('<form '); const form = html.slice(start, html.indexOf('</form>', start));
  assert.match(form, /id="form-lien-he"/);
  assert.match(form, /<option value="bao-gia-van-chuyen" selected/);
  assert.doesNotMatch(form.slice(0, form.indexOf('>') + 1), /\saction=|\smethod=/);
  for (const [tag] of form.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)) assert.doesNotMatch(tag, /\sname=/, tag);
  assert.match(form, /<button [^>]*type="submit"[^>]*\sdisabled[\s>]/);
  assert.match(html, /form-action 'none'/);
});

test('link nội bộ tới trang nháp không tồn tại trong production', () => {
  for (const file of allHtml(dist)) {
    const html = readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /href="\/logistics\/kien-thuc\//, `${file}: trỏ tới bài nháp`);
  }
});

test('thương hiệu tập đoàn: trang chủ giữ nguyên H1/title; link Logistics chỉ ở menu, chân trang, thẻ lĩnh vực + bảng giá', () => {
  const html = read('/');
  assert.equal(attr(html, /<title>([^<]+)<\/title>/), 'VIP GROUP | Con người - Công nghệ - Cơ hội');
  assert.match(html, /<h1 id="hero-title"[^>]*>Con người\./);
  assert.ok(!html.includes('sticky-bar'), 'trang chủ không có thanh liên hệ logistics');
  assert.equal((html.match(/href="\/logistics\/"/g) ?? []).length, 3, 'menu + footer + thẻ lĩnh vực');
  assert.equal((html.match(/href="\/logistics\/bang-gia\/"/g) ?? []).length, 1, 'bảng giá trang chủ → bảng giá chi tiết');
});

test('lớp đo lường: chỉ dataLayer, không tải script bên thứ ba, không gửi dữ liệu cá nhân', () => {
  for (const p of BUILT) {
    const html = read(p);
    assert.doesNotMatch(html, /googletagmanager\.com|google-analytics\.com|connect\.facebook\.net/, p);
  }
  const all = allHtml(dist).map((f) => readFileSync(f, 'utf8')).join('\n');
  const assetJs = existsSync(join(dist, '_astro')) ? readdirSync(join(dist, '_astro')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dist, '_astro', f), 'utf8')).join('\n') : '';
  const js = all + assetJs;
  assert.match(js, /dataLayer/);
  // MỌI lời gọi đo lường (track/push/dataLayer) không được mang họ tên / SĐT / email / nội dung form (verifier P1-4).
  const PII = /cf-(name|phone|email|message|weight|website)|\bname\b|phone|email/i;
  const srcFiles = ['src/components/ContactForm.astro', 'src/components/logistics/TrackEvents.astro', 'src/components/logistics/VolumeCalculator.astro'];
  let calls = 0;
  for (const f of srcFiles) {
    const src = readFileSync(join(root, f), 'utf8');
    for (const m of src.matchAll(/\btrack\(\s*'([\w-]+)'\s*(?:,\s*(\{[^}]*\}))?\)/g)) {
      calls++;
      assert.doesNotMatch(m[2] ?? '', PII, `${f}: sự kiện ${m[1]} mang dữ liệu cá nhân: ${m[2]}`);
    }
  }
  assert.ok(calls >= 1, `phải tìm thấy các lời gọi track() (thấy ${calls})`);
});

test('DEMO (VIPG_DEMO=1): ra dist-demo/, mọi trang noindex, có nhãn MẪU, có bài nháp', { timeout: 180000 }, () => {
  const r = spawnSync('npx', ['astro', 'build'], { cwd: root, env: { ...process.env, VIPG_DEMO: '1' }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  for (const file of allHtml(demo)) assert.match(readFileSync(file, 'utf8'), /<meta name="robots" content="noindex"/, `${file} DEMO phải noindex`);
  assert.equal((readFileSync(join(demo, 'sitemap.xml'), 'utf8').match(/<loc>/g) ?? []).length, 0, 'DEMO: sitemap rỗng');
  for (const p of DRAFT) assert.ok(existsSync(join(demo, p, 'index.html')), `DEMO thiếu ${p}`);
  const kho = read('/logistics/kho-quang-chau/', demo);
  assert.match(text(kho), /MẪU/);
  assert.match(text(kho), /BẢN DEMO NGHIỆM THU/);
  // Build DEMO không được ghi đè dist/ production.
  assert.ok(!existsSync(join(dist, 'logistics/kho-quang-chau/index.html')), 'build DEMO không ghi đè dist/');
});
