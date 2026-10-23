import type { ContactInfo } from '../types';

/**
 * Nguồn: Giấy CN ĐKDN + công bố đăng ký thành lập Công ty TNHH VIP GROUP (21/10/2026).
 * Hotline và email công khai do owner chốt ngày 24/10/2026.
 */
export const contact: ContactInfo = {
  email: 'viporder@vipgroup.com.vn',
  hotline: '0968961962',
  address: 'Số 183 đường Bắc Sơn, Phường Kỳ Lừa, Tỉnh Lạng Sơn, Việt Nam',
  addressParts: { street: 'Số 183 đường Bắc Sơn', ward: 'Phường Kỳ Lừa', region: 'Tỉnh Lạng Sơn', country: 'VN' },
  domain: 'vipgroup.com.vn',
  formBackendReady: false,
};
