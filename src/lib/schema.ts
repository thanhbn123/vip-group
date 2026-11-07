import { provider } from '../data/vi/logistics';

/** Đơn vị cung cấp dịch vụ = Organization VIP GROUP của site (owner 07/11/2026). Tham chiếu @id, không lặp dữ liệu. */
export const providerLd = () => ({
  '@type': 'Organization',
  '@id': 'https://www.vipgroup.com.vn/#organization',
  name: provider.name,
  legalName: provider.legalName,
  // Địa chỉ đã có trong Organization VIP GROUP (Lạng Sơn) — không khai lặp ở provider.
});

/**
 * schema.org Service. KHÔNG khai giá (offers), thời gian giao hay đánh giá (aggregateRating)
 * khi chưa có dữ liệu thật. `areaServed` chỉ liệt kê khu vực có căn cứ.
 */
export function serviceLd(opts: { name: string; serviceType: string; url: URL; areaServed?: string[]; description: string }) {
  return {
    '@type': 'Service',
    name: opts.name,
    serviceType: opts.serviceType,
    description: opts.description,
    url: opts.url.href,
    provider: providerLd(),
    brand: { '@id': new URL('/#organization', opts.url).href },
    ...(opts.areaServed?.length
      ? { areaServed: opts.areaServed.map((name) => ({ '@type': name === 'Việt Nam' ? 'Country' : 'AdministrativeArea', name })) }
      : {}),
  };
}
