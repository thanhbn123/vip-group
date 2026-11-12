// Bản build dưới thư mục con (VIPG_BASE=/demo-home/): mã nguồn site dùng đường dẫn tuyệt đối "/..." cho link,
// ảnh trong public/ — Astro chỉ tự gắn `base` cho tài nguyên đóng gói (_astro/). Integration này gắn tiền tố
// base cho href/src/srcset tuyệt đối trong HTML đã sinh. Chỉ chạy khi base ≠ '/' (production không dùng).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function rewriteHtml(html, base) {
  // /portal/… là đường dẫn của máy chủ CRM cùng origin (nút "Tham gia chat" bản demo) → giữ nguyên.
  const fix = (u) => (u.startsWith('/') && !u.startsWith('//') && !u.startsWith(base) && !u.startsWith('/portal/') ? base + u.slice(1) : u);
  return html
    .replace(/\s(href|src)="([^"]*)"/g, (_m, a, v) => ` ${a}="${fix(v)}"`)
    .replace(/\ssrcset="([^"]*)"/g, (_m, v) => ` srcset="${v.split(',').map((p) => p.trim().replace(/^\S+/, fix)).join(', ')}"`);
}

export function baseRewrite(base) {
  return {
    name: 'vipg-base-rewrite',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
        for (const f of walk(fileURLToPath(dir)).filter((f) => f.endsWith('.html'))) {
          writeFileSync(f, rewriteHtml(readFileSync(f, 'utf8'), base));
        }
      },
    },
  };
}
