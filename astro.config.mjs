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
  i18n: {
    // Thêm 'en', 'zh' vào đây khi mở rộng ngôn ngữ (xem src/i18n/config.ts).
    locales: ['vi'],
    defaultLocale: 'vi',
    routing: { prefixDefaultLocale: false },
  },
});
