import type { ShippingPricing } from '../types';

/**
 * Bảng giá vận chuyển Trung Quốc – Việt Nam (VIPG-WEB-022).
 * NGUỒN: owner cung cấp ngày 06/11/2026 (yêu cầu "HOMEPAGE SHIPPING PRICE UPDATE"). Nhãn tiếng Việt giữ NGUYÊN VĂN.
 * Bản dịch tiếng Trung: Controller soạn — CẦN NGƯỜI BẢN NGỮ DUYỆT trước khi phát hành.
 * Không thêm thời gian giao, phụ phí, thuế, hệ số quy đổi: chưa được owner xác nhận.
 */
export const pricing: ShippingPricing = {
  title: 'Bảng giá vận chuyển Trung Quốc – Việt Nam',
  titleZh: '中国—越南货物运输价格表',
  route: 'Trung Quốc → Việt Nam',
  unit: 'VNĐ/kg',
  unitZh: '越南盾/公斤',
  note: 'Phụ phí và thuế (nếu có) sẽ được xác nhận trước khi báo giá chính thức.',
  noteZh: '附加费及税费（如有）将在正式报价前确认。',
  tiers: [
    { label: '0–5 kg', labelZh: '0–5 公斤', min: 0, minInclusive: true, max: 5, maxInclusive: true, price: 20000 },
    { label: 'Trên 5 đến dưới 100 kg', labelZh: '5 公斤以上至 100 公斤以下', min: 5, minInclusive: false, max: 100, maxInclusive: false, price: 16000 },
    { label: '100 đến dưới 500 kg', labelZh: '100 公斤至 500 公斤以下', min: 100, minInclusive: true, max: 500, maxInclusive: false, price: 15000 },
    { label: '500–1.000 kg', labelZh: '500–1,000 公斤', min: 500, minInclusive: true, max: 1000, maxInclusive: true, price: 14000 },
    { label: 'Trên 1.000 kg', labelZh: '1,000 公斤以上', min: 1000, minInclusive: false, max: null, maxInclusive: false, price: 12000 },
  ],
  source: 'Owner cung cấp 06/11/2026',
  updated: '2026-11-06',
};
