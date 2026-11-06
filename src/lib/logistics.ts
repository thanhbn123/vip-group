import type { Fact, PublishStatus, LogisticsPage } from '../data/types';
import { DEMO } from './mode';
import { pages, knowledgeIndex, articles } from '../data/vi/logistics';

/** Trang có được build không: production bỏ `draft`; DEMO build tất cả. */
export const isBuilt = (status: PublishStatus) => DEMO || status !== 'draft';

/** Trang có được lập chỉ mục + vào sitemap không. DEMO: không trang nào. */
export const isIndexable = (status: PublishStatus) => !DEMO && status === 'ready';

/**
 * Giá trị hiển thị của một dữ kiện.
 * - có `value` (đã xác minh) → hiện value;
 * - chưa có, chế độ DEMO, có `sample` → hiện sample, `isSample = true` (giao diện gắn nhãn MẪU);
 * - còn lại → null (giao diện hiện "Đang cập nhật").
 */
export function shown<T>(fact: Fact<T>): { value: T | null; isSample: boolean } {
  // Dữ kiện đã điền giá trị mà không ghi nguồn → dừng build (không xuất bản thông tin không kiểm chứng).
  if (fact.value !== null && !fact.source) throw new Error(`Dữ kiện có value nhưng thiếu source: ${JSON.stringify(fact.value)}`);
  if (fact.value !== null) return { value: fact.value, isSample: false };
  if (DEMO && fact.sample !== undefined) return { value: fact.sample, isSample: true };
  return { value: null, isSample: false };
}

export const pageByKey = (key: string): LogisticsPage => {
  const p = pages.find((x) => x.key === key);
  if (!p) throw new Error(`Không có trang logistics key=${key}`);
  return p;
};

/** Trang hiện trong menu phụ: đã build được. */
export const navPages = () => pages.filter((p) => isBuilt(p.status));

/** URL logistics cho sitemap: chỉ trang `ready` (và bài `ready`), không bao giờ ở DEMO. */
export function sitemapPaths(): string[] {
  const list = pages.filter((p) => isIndexable(p.status)).map((p) => p.href);
  const readyArticles = articles.filter((a) => isIndexable(a.status));
  if (readyArticles.length && isIndexable(knowledgeIndex.status)) list.push(knowledgeIndex.href);
  for (const a of readyArticles) list.push(`${knowledgeIndex.href}${a.slug}/`);
  return list;
}

/** Link nội bộ chỉ được trỏ tới trang có build — tránh link hỏng khi trang là nháp. */
export const linkable = (href: string) => {
  const p = pages.find((x) => x.href === href);
  if (p) return isBuilt(p.status);
  if (href === knowledgeIndex.href) return isBuilt(knowledgeIndex.status);
  const a = articles.find((x) => href === `${knowledgeIndex.href}${x.slug}/`);
  return a ? isBuilt(a.status) : true;
};

/** URL trang của một kho. Thâm Quyến dùng trang tuyến (một URL cho cả cụm "vận chuyển / kho Thâm Quyến"). */
export const warehouseHref = (id: string) => (id === 'tham-quyen' ? pageByKey('tham-quyen').href : `/logistics/kho-${id}/`);

export const telHref = (n: string) => `tel:${n.replace(/\s/g, '')}`;
export const prettyPhone = (n: string) => n.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
