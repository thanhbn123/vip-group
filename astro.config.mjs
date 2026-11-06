// @ts-check
import { defineConfig } from 'astro/config';

// Tên miền chính thức — dùng cho canonical, Open Graph, sitemap.
// Owner chọn 24/10/2026 phương án B (giữ DNS iNET): web chạy ở www — tên miền gốc không gắn được
// vào Cloudflare Pages khi DNS không nằm ở Cloudflare. Xem docs/DNS_MIGRATION.md.
export const SITE_URL = 'https://www.vipgroup.com.vn';

// Mã site Cloudflare Turnstile (công khai) ghi đè khi build thử: VIPG_TURNSTILE_SITE_KEY=… npm run build.
// Bình thường lấy từ src/data/vi/contact.ts (lead.turnstileSiteKey). Rỗng → form giữ trạng thái "chưa gửi được".
const TURNSTILE_OVERRIDE = /** @type {any} */ (globalThis).process?.env?.VIPG_TURNSTILE_SITE_KEY ?? '';

export default defineConfig({
  site: SITE_URL,
  vite: { define: { __VIPG_TURNSTILE_OVERRIDE__: JSON.stringify(TURNSTILE_OVERRIDE) } },
  output: 'static',
  // Thư mục ra tuỳ chọn cho bản build thử (tests/lead.test.mjs) — mặc định dist/.
  outDir: /** @type {any} */ (globalThis).process?.env?.VIPG_OUTDIR || './dist',
  trailingSlash: 'always',
  // CSS nhỏ (~8 KB) — nhúng thẳng vào trang để không chặn hiển thị.
  build: { format: 'directory', inlineStylesheets: 'always' },
  // CSP (chính sách bảo mật nội dung) dạng thẻ <meta>: Astro tự băm script/CSS nội tuyến.
  // Script is:inline gắn lớp `js` (BaseLayout) không được tự băm → khai hash ở đây;
  // tests/security.test.mjs kiểm hash này khớp đúng nội dung script.
  // frame-ancestors không đặt được bằng <meta> → nằm ở public/_headers.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        // Cloudflare Turnstile (chống spam form lead) chạy trong iframe của challenges.cloudflare.com.
        "frame-src https://challenges.cloudflare.com",
        "base-uri 'self'",
        "form-action 'none'",
      ],
      scriptDirective: {
        resources: ["'self'", 'https://challenges.cloudflare.com'],
        hashes: ['sha256-Du+OJKJSbdUgz5nrHeWWINvez6XKDDU/tyj/5c2uvwo='],
      },
    },
  },
  i18n: {
    // Thêm 'en', 'zh' vào đây khi mở rộng ngôn ngữ (xem src/i18n/config.ts).
    locales: ['vi'],
    defaultLocale: 'vi',
    routing: { prefixDefaultLocale: false },
  },
});
