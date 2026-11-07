import type { APIRoute } from 'astro';
import { t } from '../i18n/ui';
import { sitemapPaths } from '../lib/logistics';
import { DEMO } from '../lib/mode';

/**
 * Sitemap = menu chính + các trang Logistics trạng thái `ready` (VIPG-WEB-021).
 * Trang `pending` (noindex) và `draft` không bao giờ vào sitemap.
 */
export const GET: APIRoute = ({ site }) => {
  // Trang pháp lý ngoài menu chính + trang Logistics `ready`. Bản DEMO: sitemap rỗng (mọi trang noindex).
  const extra = ['/chinh-sach-bao-mat/'];
  const paths = [...new Set([...t('vi').nav.map((item) => item.href), ...extra, ...sitemapPaths()])];
  const urls = DEMO ? [] : paths.map((href) => new URL(href, site).href);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${loc}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
