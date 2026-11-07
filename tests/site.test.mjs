// Kiểm tra bản build tĩnh trong dist/. Chạy: npm run build && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = 'https://www.vipgroup.com.vn';

const PAGES = ['/', '/gioi-thieu/', '/linh-vuc-hoat-dong/', '/cong-ty-thanh-vien/', '/tin-tuc/', '/tuyen-dung/', '/lien-he/'];
// Trang ngoài menu nhưng vào sitemap (VIPG-WEB-023).
const SITEMAP_EXTRA = ['/chinh-sach-bao-mat/'];
// Trang Logistics trạng thái `ready` (VIPG-WEB-021) — cũng phải nằm trong sitemap. Trang `pending` thì không.
const LOGISTICS_READY = ['/logistics/', '/logistics/van-chuyen-trung-quoc-bac-ninh/', '/logistics/van-chuyen-trung-quoc-viet-nam/',
  '/logistics/quy-trinh-gui-hang/', '/logistics/tra-cuu-van-don/', '/logistics/cau-hoi-thuong-gap/', '/logistics/lien-he/', '/logistics/bang-gia/',
  '/logistics/kho-trung-quoc/', '/logistics/van-chuyen-tham-quyen-ve-viet-nam/', '/logistics/van-chuyen-ha-mon-ve-viet-nam/',
  '/logistics/van-chuyen-quang-chau-ve-viet-nam/', '/logistics/van-chuyen-nghia-o-ve-viet-nam/'];

const fileFor = (path) => join(dist, path, 'index.html');
const read = (path) => readFileSync(fileFor(path), 'utf8');
const attr = (html, re) => html.match(re)?.[1];

function allHtml(dir = dist) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return allHtml(p);
    return p.endsWith('.html') ? [p] : [];
  });
}

test('dist/ đã được build', () => {
  assert.ok(existsSync(dist), 'Chạy `npm run build` trước khi test');
});

for (const path of PAGES) {
  test(`trang ${path}: HTML, SEO, Open Graph, schema`, () => {
    assert.ok(existsSync(fileFor(path)), `thiếu ${fileFor(path)}`);
    const html = read(path);

    assert.match(html, /<html lang="vi">/);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, 'mỗi trang đúng một <h1>');
    assert.match(html, /<main id="main"/);
    assert.match(html, /<header /);
    assert.doesNotMatch(html, /<link rel="stylesheet"/, 'CSS phải được nhúng, không chặn hiển thị');
    assert.match(html, /<footer /);
    assert.match(html, /class="skip-link"/);

    const title = attr(html, /<title>([^<]+)<\/title>/);
    assert.ok(title && title.includes('VIP GROUP'), 'title có tên thương hiệu');
    assert.ok(title.length <= 70, `title quá dài (${title.length}): ${title}`);

    const desc = attr(html, /<meta name="description" content="([^"]+)"/);
    assert.ok(desc && desc.length >= 50 && desc.length <= 170, `description dài ${desc?.length}`);

    assert.equal(attr(html, /<link rel="canonical" href="([^"]+)"/), `${SITE}${path}`);
    assert.equal(attr(html, /<meta property="og:url" content="([^"]+)"/), `${SITE}${path}`);
    for (const p of ['og:title', 'og:description', 'og:image', 'og:type', 'og:locale', 'og:site_name']) {
      assert.match(html, new RegExp(`<meta property="${p}" content="[^"]+"`), `thiếu ${p}`);
    }

    const ld = attr(html, /<script type="application\/ld\+json">([^<]+)<\/script>/);
    const org = JSON.parse(ld);
    assert.equal(org['@type'], 'Organization');
    assert.equal(org.name, 'VIP GROUP');
    assert.equal(org.url, `${SITE}/`);
    assert.equal(org.email, 'viporder@vipgroup.com.vn');
    assert.equal(org.legalName, 'CÔNG TY TNHH VIP GROUP');
    assert.equal(org.taxID, '4900951703');
    assert.equal(org.foundingDate, '2026-10-21');
    assert.equal(org.telephone, '+84961102655');
    assert.deepEqual(org.alternateName, ['VIP GROUP COMPANY LIMITED', 'VIP GROUP CO., LTD']);
    assert.equal(org.address['@type'], 'PostalAddress');
    assert.equal(org.address.streetAddress, 'Số 183 đường Bắc Sơn, Phường Kỳ Lừa');
    assert.equal(org.address.addressRegion, 'Tỉnh Lạng Sơn');
    assert.equal(org.address.addressCountry, 'VN');
    assert.equal(org.slogan, 'Con người - Công nghệ - Cơ hội');
    assert.equal(org.logo, `${SITE}/logo-vip-group.png`);
    for (const [k, v] of Object.entries(org)) assert.ok(v !== null && v !== '', `schema có trường rỗng: ${k}`);

    assert.match(html, /aria-current="page"/, 'menu đánh dấu trang hiện tại');
  });
}

test('không có link nội bộ hỏng', () => {
  const broken = [];
  for (const file of allHtml()) {
    const html = readFileSync(file, 'utf8');
    for (const [, href] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:|data:|#)/.test(href)) continue;
      const clean = href.split('#')[0].split('?')[0];
      const target = join(dist, clean);
      const ok = existsSync(target) && (statSync(target).isFile() || existsSync(join(target, 'index.html')));
      if (!ok) broken.push(`${file.replace(dist, '')} → ${href}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('link ngoài mở tab mới phải có rel="noopener"', () => {
  for (const file of allHtml()) {
    const html = readFileSync(file, 'utf8');
    for (const [tag] of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) {
      assert.match(tag, /rel="[^"]*noopener/, `${file}: ${tag}`);
    }
  }
});

test('ảnh đều có alt', () => {
  for (const file of allHtml()) {
    for (const [tag] of readFileSync(file, 'utf8').matchAll(/<img [^>]*>/g)) assert.match(tag, /\salt="/, `${file}: ${tag}`);
  }
});

test('sitemap.xml liệt kê đủ 7 trang tập đoàn + các trang Logistics ready, robots.txt trỏ sitemap', () => {
  const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  for (const path of [...PAGES, ...SITEMAP_EXTRA, ...LOGISTICS_READY]) assert.ok(sitemap.includes(`<loc>${SITE}${path}</loc>`), `sitemap thiếu ${path}`);
  assert.equal((sitemap.match(/<loc>/g) ?? []).length, PAGES.length + SITEMAP_EXTRA.length + LOGISTICS_READY.length);
  const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/www\.vipgroup\.com\.vn\/sitemap\.xml/);
});

test('trang 404 có noindex và không nằm trong sitemap', () => {
  const html = readFileSync(join(dist, '404.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.ok(!readFileSync(join(dist, 'sitemap.xml'), 'utf8').includes('404'));
});

test('favicon, logo và ảnh Open Graph tồn tại', () => {
  for (const f of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'logo-vip-group.png', 'logo-vip-group.webp', 'logo-mark.png', 'logo-mark.webp', 'og-image.jpg']) {
    assert.ok(existsSync(join(dist, f)), `thiếu ${f}`);
  }
});

test('form liên hệ: gửi thật qua /api/lead (Turnstile), có nhãn cho mọi ô, có đồng ý xử lý dữ liệu', () => {
  const html = read('/lien-he/');
  const form = attr(html, /(<form [^>]*data-contact-form[^>]*>)/);
  assert.ok(form, 'có form liên hệ');
  assert.doesNotMatch(form, /\saction=/, 'gửi bằng fetch, không submit form');
  assert.match(form, /data-backend-ready="true"/);
  assert.match(form, /data-endpoint="\/api\/lead"/);
  assert.match(html, /class="cf-turnstile" data-sitekey="0x/);
  assert.match(html, /<input id="cf-consent" type="checkbox" required/);
  for (const id of ['cf-name', 'cf-phone', 'cf-email', 'cf-need', 'cf-weight', 'cf-message', 'cf-consent']) {
    assert.match(html, new RegExp(`<label[^>]*for="${id}"`), `thiếu label cho ${id}`);
  }
});

test('form liên hệ tắt JavaScript: không dữ liệu nào lọt ra URL', () => {
  const html = read('/lien-he/');
  const start = html.indexOf('<form ');
  const formHtml = html.slice(start, html.indexOf('</form>', start));
  // Không có `name` thì trình duyệt không tuần tự hoá giá trị vào query string / body.
  for (const [tag] of formHtml.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)) {
    assert.doesNotMatch(tag, /\sname=/, `ô nhập có name khi chưa có backend: ${tag}`);
  }
  // Nút gửi disabled sẵn trong HTML → tắt JS thì không gửi được, kể cả bấm Enter.
  assert.match(formHtml, /<button [^>]*type="submit"[^>]*\sdisabled[\s>]/, 'nút gửi phải disabled khi tắt JS');
});

test('trang noindex (404) không phát canonical / og:url', () => {
  const html = readFileSync(join(dist, '404.html'), 'utf8');
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.doesNotMatch(html, /property="og:url"/);
});

test('menu dùng được khi tắt JavaScript', () => {
  const html = read('/');
  // Script gắn html.js phải chạy TRƯỚC khi header/menu hiển thị (không nháy menu): ngay đầu <body>.
  const bodyStart = html.slice(html.indexOf('<body'), html.indexOf('<header'));
  assert.match(bodyStart, /document\.documentElement\.classList\.add\('js'\)/, 'đánh dấu html.js ở đầu <body>, trước <header>');
  // Chỉ ẩn menu khi có lớp js; không có JS thì mọi link menu vẫn nằm trong HTML và không bị ẩn.
  assert.match(html, /html\.js [^{]*\.menu[^{]*\{[^}]*display:\s*none/, 'ẩn menu phải gắn với html.js');
  assert.doesNotMatch(html, /(?<!html\.js )\.menu\[[^\]]*\]\s*\{[^}]*display:\s*none/, 'không được ẩn menu vô điều kiện');
});

test('menu mobile có nút bấm truy cập được', () => {
  const html = read('/');
  // Tên truy cập của link logo phải khớp chữ hiển thị (Lighthouse label-content-name-mismatch).
  assert.doesNotMatch(attr(html, /(<a href="\/" class="brand"[^>]*>)/), /aria-label=/);
  assert.match(html, /<button class="menu-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="site-menu"/);
  assert.match(html, /<nav id="site-menu"[^>]*aria-label=/);
});
