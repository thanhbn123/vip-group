import { provider } from '../data/vi/logistics';

/** schema.org Organization của đơn vị vận hành (VIPORDER) — chỉ trường có nguồn. */
export const providerLd = () => ({
  '@type': 'Organization',
  name: provider.name,
  legalName: provider.legalName,
  url: provider.url,
  telephone: provider.hotline.replace(/^0/, '+84'),
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
