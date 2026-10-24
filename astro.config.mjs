// @ts-check
import { defineConfig } from 'astro/config';

// Tên miền chính thức — dùng cho canonical, Open Graph, sitemap.
export const SITE_URL = 'https://vipgroup.com.vn';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
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
        "base-uri 'self'",
        "form-action 'none'",
      ],
      scriptDirective: {
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
