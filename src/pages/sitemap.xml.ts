import type { APIRoute } from 'astro';
import { t } from '../i18n/ui';

/** Sitemap sinh từ menu chính — thêm trang vào menu là tự vào sitemap. */
export const GET: APIRoute = ({ site }) => {
  // Trang pháp lý không nằm trong menu chính nhưng cần được lập chỉ mục.
  const extra = ['/chinh-sach-bao-mat/'];
  const urls = [...t('vi').nav.map((item) => item.href), ...extra].map((href) => new URL(href, site).href);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${loc}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
