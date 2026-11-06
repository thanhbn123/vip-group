/**
 * Kiểu dữ liệu nội dung website.
 *
 * Quy ước placeholder: thông tin CHƯA CHỐT để `null`, không điền chuỗi giả.
 * Giao diện tự hiện "Đang cập nhật"; schema.org tự bỏ trường `null`.
 */

export interface CompanyProfile {
  name: string;
  /** Tên pháp lý đầy đủ — null cho tới khi chủ dự án cung cấp. */
  legalName: string | null;
  /** Tên tiếng nước ngoài và tên viết tắt trên Giấy CN ĐKDN. */
  englishName: string | null;
  shortName: string | null;
  /** Mã số doanh nghiệp (đồng thời là mã số thuế). */
  taxId: string | null;
  /** Ngày thành lập, ISO 8601 (YYYY-MM-DD). */
  foundingDate: string | null;
  /** Người đại diện theo pháp luật. */
  legalRepresentative: { name: string; title: string } | null;
  slogan: string;
  tagline: string;
  intro: string[];
  about: { heading: string; paragraphs: string[] };
  values: { title: string; text: string }[];
}

export interface Sector {
  id: string;
  order: number;
  title: string;
  summary: string;
  focus: string[];
  /** Trang chi tiết của lĩnh vực (nếu có). */
  link?: { href: string; label: string };
}

export interface Subsidiary {
  id: string;
  /** Tên hiển thị. Với placeholder là nhãn mô tả, KHÔNG phải tên pháp lý. */
  name: string;
  /** Tên pháp lý — chỉ điền khi đã có giấy tờ. */
  legalName: string | null;
  sectorId: string;
  description: string;
  url: string | null;
  /** Quan hệ với VIP GROUP, viết đúng như giấy tờ cho phép (ví dụ: cùng chủ sở hữu). */
  relation: string | null;
  status: 'active' | 'placeholder';
}

export interface NewsItem {
  slug: string;
  title: string;
  /** ISO 8601, ví dụ 2026-10-01 */
  date: string;
  summary: string;
  tag: string;
}

export interface CareerOpening {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  summary: string;
}

export interface CareersInfo {
  intro: string;
  openings: CareerOpening[];
  /** Email nhận hồ sơ — null thì dùng email liên hệ chung. */
  applyEmail: string | null;
}

export interface ContactInfo {
  email: string;
  hotline: string | null;
  address: string | null;
  /** Địa chỉ tách trường cho schema.org PostalAddress. */
  addressParts: { street: string; ward: string; region: string; country: string } | null;
  domain: string;
  /** Form liên hệ đã có máy chủ nhận dữ liệu chưa. v1: false. Tính từ `lead.turnstileSiteKey` (xem contact.ts). */
  formBackendReady: boolean;
  /** Thu lead (VIPG-WEB-023): endpoint cùng tên miền + mã site Turnstile công khai (null = chưa cài). */
  lead: { endpoint: string; turnstileSiteKey: string | null; privacyHref: string };
}

export interface SiteContent {
  company: CompanyProfile;
  sectors: Sector[];
  subsidiaries: Subsidiary[];
  news: NewsItem[];
  careers: CareersInfo;
  contact: ContactInfo;
  pricing: ShippingPricing;
}

/** Một mức giá vận chuyển theo khối lượng (VIPG-WEB-022). */
export interface PriceTier {
  /** Nhãn hiển thị tiếng Việt — đúng nguyên văn owner cung cấp. */
  label: string;
  /** Nhãn tiếng Trung (giản thể). */
  labelZh: string;
  /** Cận dưới (kg) và cận trên (kg, null = không giới hạn); `minInclusive`/`maxInclusive` cho biết có gồm biên không. */
  min: number;
  minInclusive: boolean;
  max: number | null;
  maxInclusive: boolean;
  /** Đơn giá VNĐ/kg. */
  price: number;
}

export interface ShippingPricing {
  title: string;
  titleZh: string;
  route: string;
  unit: string;
  unitZh: string;
  note: string;
  noteZh: string;
  tiers: PriceTier[];
  /** Cách áp mức giá (owner xác nhận) — vd. theo tổng khối lượng cả lô. */
  basis: string;
  basisZh: string;
  /** Nguồn — owner chốt. */
  source: string;
  /** Ngày hiệu lực hiển thị (ISO). */
  updated: string;
}

/* ───────────── Khu Logistics (VIPG-WEB-021) ───────────── */

/**
 * Trạng thái xuất bản của một trang logistics.
 * - `ready`: mọi thông tin trên trang đã có nguồn → được lập chỉ mục, vào sitemap.
 * - `pending`: trang dùng được nhưng còn trường chờ owner xác nhận → noindex, không vào sitemap.
 * - `draft`: bài nháp chờ duyệt → KHÔNG build ở production (chỉ build ở chế độ DEMO).
 */
export type PublishStatus = 'ready' | 'pending' | 'draft';

/** Một dữ kiện có nguồn. `value: null` = OWNER INPUT PENDING; `sample` chỉ hiện ở chế độ DEMO. */
export interface Fact<T = string> {
  value: T | null;
  /** Nguồn kiểm chứng khi `value` khác null (URL công khai, giấy tờ, ngày owner chốt). */
  source: string | null;
  /** Dữ liệu MẪU để dựng giao diện — không bao giờ xuất hiện ở bản build production. */
  sample?: T;
}

export interface LogisticsProvider {
  /** Đơn vị trực tiếp vận hành dịch vụ. */
  name: string;
  legalName: string;
  url: string;
  relation: string;
  hotline: string;
  zaloUrl: string;
  /** Địa chỉ văn phòng đơn vị vận hành công bố. */
  officeAddress: Fact;
  trackingUrl: string;
  customerPortalUrl: string;
  registerUrl: string;
}

export interface Warehouse {
  id: 'tham-quyen' | 'quang-chau';
  city: string;
  cityZh: string;
  address: Fact;
  receivingHours: Fact;
  receiver: Fact;
  /** Tuyến/cửa khẩu về Việt Nam. */
  route: Fact;
  transitTime: Fact;
  goodsFit: string[];
}

/** Một hình thức vận chuyển trên bảng so sánh tuyến Thâm Quyến. Mô tả `how/unit/papers/fit` là kiến thức chung của ngành. */
export interface ShippingMode {
  id: string;
  name: string;
  how: string;
  unit: string;
  papers: string;
  fit: string;
  /** VIPORDER có cung cấp hình thức này trên tuyến không — production chỉ hiện dòng đã xác nhận. */
  offered: Fact;
  transitHanoi: Fact;
  price: Fact;
}

export interface ShenzhenRoute {
  /** Ngày cập nhật dữ liệu trang (ISO). */
  updated: string;
  /** Xác nhận VIPORDER nhận hàng tại Thâm Quyến. */
  served: Fact;
  borderGate: Fact;
  destinations: { city: string; transit: Fact; note: string }[];
  modes: ShippingMode[];
}

export interface FaqItem {
  q: string;
  a: string;
  /** Câu trả lời cần owner xác nhận trước khi coi là cam kết dịch vụ. */
  pending?: boolean;
}

export interface PriceRow {
  route: string;
  unit: string;
  price: string;
  transit: string;
}

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  keyword: string;
  status: PublishStatus;
  updated: string;
  sections: ArticleSection[];
  related: string[];
}

export interface LogisticsPage {
  key: string;
  href: string;
  /** Nhãn ngắn cho menu phụ. */
  nav: string;
  /** Phần trước ` | VIP GROUP` trong <title>. */
  title: string;
  description: string;
  h1: string;
  lead: string;
  status: PublishStatus;
  /** Lý do trang chưa `ready` — liệt kê trường OWNER INPUT PENDING. */
  pendingReason?: string;
  keyword: string;
}
