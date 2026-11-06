import type { ContactInfo } from '../types';

/**
 * Nguồn: Giấy CN ĐKDN + công bố đăng ký thành lập Công ty TNHH VIP GROUP (21/10/2026).
 * Email công khai do owner chốt ngày 24/10/2026.
 * HOTLINE: CẤU HÌNH TẬP TRUNG DUY NHẤT của toàn site (header/footer/trang chủ/liên hệ/Logistics/nút gọi/JSON-LD đều đọc ở đây).
 *   Owner đổi sang 0961102655 ngày 06/11/2026 ("đổi hết số zalo và liên hệ theo số này 0961102655");
 *   chỉ thị V1.2: hotline chính VIP GROUP là 0961 102 655. Zalo cùng số theo chính tin nhắn trên của owner.
 */
/**
 * Mã site Cloudflare Turnstile — CÔNG KHAI (không phải bí mật). Owner tạo theo docs/HUONG_DAN_CAI_DAT_THU_LEAD.md.
 * null = chưa cài → form giữ trạng thái "chưa gửi được dữ liệu" như trước.
 */
// Owner tạo widget Turnstile (06/11/2026). Form chỉ gửi được khi Cloudflare có đủ biến bí mật (docs/HUONG_DAN_CAI_DAT_THU_LEAD.md, bước D).
const TURNSTILE_SITE_KEY: string | null = '0x4AAAAAAF2QZNcXX6-6puJf';
const siteKey = __VIPG_TURNSTILE_OVERRIDE__ || TURNSTILE_SITE_KEY;

export const contact: ContactInfo = {
  email: 'viporder@vipgroup.com.vn',
  hotline: '0961102655',
  hotlineDisplay: '0961 102 655',
  zaloUrl: 'https://zalo.me/0961102655',
  address: 'Số 183 đường Bắc Sơn, Phường Kỳ Lừa, Tỉnh Lạng Sơn, Việt Nam',
  addressParts: { street: 'Số 183 đường Bắc Sơn', ward: 'Phường Kỳ Lừa', region: 'Tỉnh Lạng Sơn', country: 'VN' },
  domain: 'vipgroup.com.vn',
  formBackendReady: siteKey !== null,
  lead: { endpoint: '/api/lead', turnstileSiteKey: siteKey, privacyHref: '/chinh-sach-bao-mat/' },
};
