// @ts-check
import { defineConfig } from 'astro/config';
import { baseRewrite } from './scripts/astro-base-rewrite.mjs';

// Tên miền chính thức — dùng cho canonical, Open Graph, sitemap.
// Owner chọn 24/10/2026 phương án B (giữ DNS iNET): web chạy ở www — tên miền gốc không gắn được
// vào Cloudflare Pages khi DNS không nằm ở Cloudflare. Xem docs/DNS_MIGRATION.md.
export const SITE_URL = 'https://www.vipgroup.com.vn';

// Chế độ DEMO (VIPG-WEB-021): `VIPG_DEMO=1 npm run build` → hiện dữ liệu MẪU có nhãn để nghiệm thu
// giao diện, MỌI trang noindex. Build mặc định (production) không bao giờ hiện dữ liệu mẫu.
const DEMO = /** @type {any} */ (globalThis).process?.env?.VIPG_DEMO === '1';
// Mã site Cloudflare Turnstile (công khai) ghi đè khi build thử: VIPG_TURNSTILE_SITE_KEY=… npm run build.
// Bình thường lấy từ src/data/vi/contact.ts (lead.turnstileSiteKey).
const TURNSTILE_OVERRIDE = /** @type {any} */ (globalThis).process?.env?.VIPG_TURNSTILE_SITE_KEY ?? '';
// Bật nút Đăng nhập/Đăng ký khi build THỬ (preview/staging): VIPG_PORTAL=1 npm run build. Production bật bằng contact.portal.
const PORTAL_OVERRIDE = /** @type {any} */ (globalThis).process?.env?.VIPG_PORTAL === '1';

// VIP CHAT V1.0 — khung "Phòng chat chung" trên trang chủ (src/components/CommunityChat.astro).
// Mặc định TẮT: build thường không đổi trang thật cho tới khi owner duyệt go-live.
//   PUBLIC_CHAT_WIDGET=1            → render khung + mở CSP connect-src cho origin của API chat.
//   PUBLIC_CHAT_API_BASE=<url>      → gốc API (mặc định https://khachhang.vipgroup.com.vn).
//   PUBLIC_CHAT_API_BASE=           → (đặt RỖNG) gọi cùng origin '/portal/public/community' — bản demo cùng máy chủ CRM.
const ENV = /** @type {any} */ (globalThis).process?.env ?? {};
const CHAT_ENABLED = ENV.PUBLIC_CHAT_WIDGET === '1';
const CHAT_API_BASE = (ENV.PUBLIC_CHAT_API_BASE === undefined ? 'https://khachhang.vipgroup.com.vn' : String(ENV.PUBLIC_CHAT_API_BASE).trim()).replace(/\/+$/, '');
let CHAT_ORIGIN = '';
if (CHAT_ENABLED && CHAT_API_BASE) {
  let u;
  try { u = new URL(CHAT_API_BASE); } catch { throw new Error(`PUBLIC_CHAT_API_BASE không hợp lệ: ${CHAT_API_BASE}`); }
  if (!/^https?:$/.test(u.protocol) || u.search || u.hash || u.username) throw new Error(`PUBLIC_CHAT_API_BASE phải là http(s)://host[/path]: ${CHAT_API_BASE}`);
  CHAT_ORIGIN = u.origin;
}
// Đường dẫn gốc khi phục vụ dưới thư mục con (vd bản demo https://chat-test.vipgroup.com.vn/demo-home/): VIPG_BASE=/demo-home/.
// Production luôn là '/'. Khi khác '/', scripts/astro-base-rewrite.mjs gắn tiền tố cho link/ảnh tuyệt đối trong HTML.
const BASE = (() => { const b = String(ENV.VIPG_BASE ?? '/').trim() || '/'; return b === '/' ? '/' : `/${b.replace(/^\/+|\/+$/g, '')}/`; })();

export default defineConfig({
  base: BASE,
  integrations: BASE === '/' ? [] : [baseRewrite(BASE)],
  site: SITE_URL,
  // Cờ tắt → bí danh trỏ tới component rỗng: CSS/JS của khung chat KHÔNG lọt vào bản build (Astro gom style theo import).
  vite: { resolve: { alias: { '@vipg/community-chat': decodeURIComponent(new URL(CHAT_ENABLED ? './src/components/CommunityChat.astro' : './src/components/CommunityChatOff.astro', import.meta.url).pathname) } },
    define: { __VIPG_DEMO__: JSON.stringify(DEMO), __VIPG_TURNSTILE_OVERRIDE__: JSON.stringify(TURNSTILE_OVERRIDE), __VIPG_PORTAL_OVERRIDE__: JSON.stringify(PORTAL_OVERRIDE),
    __VIPG_CHAT__: JSON.stringify({ enabled: CHAT_ENABLED, apiBase: CHAT_API_BASE }) } },
  output: 'static',
  // DEMO ra thư mục riêng → không bao giờ lẫn vào dist/ phát hành. VIPG_OUTDIR cho bản build thử (tests/lead.test.mjs).
  outDir: /** @type {any} */ (globalThis).process?.env?.VIPG_OUTDIR || (DEMO ? './dist-demo' : './dist'),
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
        // Khung chat (khi bật) đọc API công khai ở origin khác → thêm đúng origin đó; tắt / cùng origin → chỉ 'self'.
        CHAT_ORIGIN ? `connect-src 'self' ${CHAT_ORIGIN}` : "connect-src 'self'",
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
