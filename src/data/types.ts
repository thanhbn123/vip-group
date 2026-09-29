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
  domain: string;
  /** Form liên hệ đã có máy chủ nhận dữ liệu chưa. v1: false. */
  formBackendReady: boolean;
}

export interface SiteContent {
  company: CompanyProfile;
  sectors: Sector[];
  subsidiaries: Subsidiary[];
  news: NewsItem[];
  careers: CareersInfo;
  contact: ContactInfo;
}
