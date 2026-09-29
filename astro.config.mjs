// @ts-check
import { defineConfig } from 'astro/config';

// Tên miền chính thức — dùng cho canonical, Open Graph, sitemap.
export const SITE_URL = 'https://vipgroup.com.vn';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    // Thêm 'en', 'zh' vào đây khi mở rộng ngôn ngữ (xem src/i18n/config.ts).
    locales: ['vi'],
    defaultLocale: 'vi',
    routing: { prefixDefaultLocale: false },
  },
});
