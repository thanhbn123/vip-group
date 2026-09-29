// Kiểm tra bản build tĩnh trong dist/. Chạy: npm run build && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = 'https://vipgroup.com.vn';

const PAGES = ['/', '/gioi-thieu/', '/linh-vuc-hoat-dong/', '/cong-ty-thanh-vien/', '/tin-tuc/', '/tuyen-dung/', '/lien-he/'];

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
    assert.equal(org.email, 'contact@vipgroup.com.vn');
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

test('sitemap.xml liệt kê đủ 7 trang, robots.txt trỏ sitemap', () => {
  const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  for (const path of PAGES) assert.ok(sitemap.includes(`<loc>${SITE}${path}</loc>`), `sitemap thiếu ${path}`);
  assert.equal((sitemap.match(/<loc>/g) ?? []).length, PAGES.length);
  const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/vipgroup\.com\.vn\/sitemap\.xml/);
});

test('trang 404 có noindex và không nằm trong sitemap', () => {
  const html = readFileSync(join(dist, '404.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.ok(!readFileSync(join(dist, 'sitemap.xml'), 'utf8').includes('404'));
});

test('favicon, logo và ảnh Open Graph tồn tại', () => {
  for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'logo.svg', 'og-image.png']) {
    assert.ok(existsSync(join(dist, f)), `thiếu ${f}`);
  }
});

test('form liên hệ không giả vờ gửi dữ liệu', () => {
  const html = read('/lien-he/');
  const form = attr(html, /(<form [^>]*data-contact-form[^>]*>)/);
  assert.ok(form, 'có form liên hệ');
  assert.doesNotMatch(form, /\saction=/, 'form chưa có backend thì không được có action');
  assert.match(html, /chưa gửi được dữ liệu/, 'phải báo rõ form chưa gửi được');
  for (const id of ['cf-name', 'cf-phone', 'cf-email', 'cf-message']) {
    assert.match(html, new RegExp(`<label for="${id}"`), `thiếu label cho ${id}`);
  }
});

test('menu mobile có nút bấm truy cập được', () => {
  const html = read('/');
  assert.match(html, /<button class="menu-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="site-menu"/);
  assert.match(html, /<nav id="site-menu"[^>]*aria-label=/);
});
