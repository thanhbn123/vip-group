import type { ContactInfo } from '../types';

/**
 * Nguồn: Giấy CN ĐKDN + công bố đăng ký thành lập Công ty TNHH VIP GROUP (21/10/2026).
 * Email công khai do owner chốt ngày 24/10/2026. Hotline/Zalo owner đổi sang 0961102655 ngày 06/11/2026.
 */
/**
 * Mã site Cloudflare Turnstile — CÔNG KHAI (không phải bí mật). Owner tạo theo docs/HUONG_DAN_CAI_DAT_THU_LEAD.md.
 * null = chưa cài → form giữ trạng thái "chưa gửi được dữ liệu" như trước.
 */
const TURNSTILE_SITE_KEY: string | null = null;
const siteKey = __VIPG_TURNSTILE_OVERRIDE__ || TURNSTILE_SITE_KEY;

export const contact: ContactInfo = {
  email: 'viporder@vipgroup.com.vn',
  hotline: '0961102655',
  address: 'Số 183 đường Bắc Sơn, Phường Kỳ Lừa, Tỉnh Lạng Sơn, Việt Nam',
  addressParts: { street: 'Số 183 đường Bắc Sơn', ward: 'Phường Kỳ Lừa', region: 'Tỉnh Lạng Sơn', country: 'VN' },
  domain: 'vipgroup.com.vn',
  formBackendReady: siteKey !== null,
  lead: { endpoint: '/api/lead', turnstileSiteKey: siteKey, privacyHref: '/chinh-sach-bao-mat/' },
};
