// VIPG-WEB-020 — giao diện đỏ – trắng theo logo VIP GROUP (owner 27/10/2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8');
const token = (n) => { const m = css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`)); assert.ok(m, `thiếu --${n}`); return m[1]; };
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const tuongPhan = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('màu thương hiệu = đỏ đo trên logo gốc #D0071A; nền trắng', () => {
  assert.equal(token('brand').toLowerCase(), '#d0071a');
  assert.equal(token('bg').toLowerCase(), '#ffffff');
});

test('độ tương phản chữ đạt WCAG AA (≥ 4.5:1) cho mọi cặp chữ/nền chính', () => {
  const cap = [
    ['text', 'bg'], ['text', 'bg-alt'], ['text-2', 'bg'], ['muted', 'bg'], ['muted', 'bg-alt'], ['muted', 'bg-soft'],
    ['brand-ink', 'bg'], ['brand-ink', 'bg-alt'], ['brand-ink', 'bg-soft'], ['on-brand', 'brand'], ['on-brand', 'brand-dark'],
  ];
  for (const [chu, nen] of cap) {
    const t = tuongPhan(token(chu), token(nen));
    assert.ok(t >= 4.5, `--${chu} trên --${nen}: ${t.toFixed(2)} < 4.5`);
  }
});

test('không còn sót màu navy / vàng cũ trong mã nguồn', () => {
  const tim = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? tim(p) : [p]; });
  for (const f of tim(join(root, 'src')).filter((f) => /\.(astro|css|ts)$/.test(f))) {
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /--(navy|gold|on-gold)\b|var\(--(navy|gold)|217,\s*182,\s*111|#06101d|#d8e0ea|#f0d698|#d9b66f/i, f.replace(root, ''));
  }
});

test('build: theme-color đỏ; ảnh logo trang chủ khai đúng kích thước tệp thật (720×661)', () => {
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
  assert.match(html, /<meta name="theme-color" content="#d0071a"/);
  assert.match(html, /<img src="\/logo-vip-group\.png" alt="Logo VIP GROUP" width="720" height="661"/);
  const png = readFileSync(join(root, 'public/logo-vip-group.png'));
  assert.equal(png.readUInt32BE(16), 720); assert.equal(png.readUInt32BE(20), 661);
});

test('chân trang + dải CTA nền đỏ: chữ phụ (.muted) phải đổi sang trắng, không dùng xám mặc định', () => {
  for (const f of ['src/components/Footer.astro', 'src/components/CtaBand.astro']) {
    const s = readFileSync(join(root, f), 'utf8');
    assert.match(s, /\.muted \{ color: rgba\(255, 255, 255, \.9\); \}/, f);
  }
});
