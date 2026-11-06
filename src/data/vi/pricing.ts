import type { ShippingPricing } from '../types';

/**
 * Bảng giá vận chuyển Trung Quốc – Việt Nam (VIPG-WEB-022).
 * NGUỒN: owner cung cấp ngày 06/11/2026 (yêu cầu "HOMEPAGE SHIPPING PRICE UPDATE"). Nhãn tiếng Việt giữ NGUYÊN VĂN.
 * Bản dịch tiếng Trung: Controller soạn — CẦN NGƯỜI BẢN NGỮ DUYỆT trước khi phát hành.
 * Không thêm thời gian giao, phụ phí, thuế, hệ số quy đổi: chưa được owner xác nhận.
 */
export const pricing: ShippingPricing = {
  // Tiêu đề theo chỉ thị owner V1.2 (G10).
  title: 'VIP GROUP – BẢNG GIÁ VẬN CHUYỂN',
  titleZh: 'VIP GROUP 运输价格表',
  route: 'Trung Quốc – Việt Nam',
  routeZh: '中国 – 越南',
  unit: 'VNĐ/kg',
  unitZh: '越南盾/公斤',
  note: 'Phụ phí và thuế (nếu có) sẽ được xác nhận trước khi báo giá chính thức.',
  noteZh: '附加费及税费（如有）将在正式报价前确认。',
  tiers: [
    { label: '0–5 kg', labelZh: '0–5 公斤', min: 0, minInclusive: true, max: 5, maxInclusive: true, price: 20000 },
    { label: 'Trên 5 đến dưới 100 kg', labelZh: '超过 5 公斤，不足 100 公斤', min: 5, minInclusive: false, max: 100, maxInclusive: false, price: 16000 },
    { label: 'Từ 100 đến dưới 500 kg', labelZh: '100 公斤至不足 500 公斤', min: 100, minInclusive: true, max: 500, maxInclusive: false, price: 15000 },
    { label: 'Từ 500 đến 1.000 kg', labelZh: '500–1,000 公斤', min: 500, minInclusive: true, max: 1000, maxInclusive: true, price: 14000 },
    { label: 'Trên 1.000 kg', labelZh: '超过 1,000 公斤', min: 1000, minInclusive: false, max: null, maxInclusive: false, price: 12000 },
  ],
  // Owner xác nhận 06/11/2026: tra mức giá theo TỔNG khối lượng tính cước của cả lô; hàng cồng kềnh quy đổi hệ số 6000.
  basis: 'Mức giá áp dụng theo tổng khối lượng tính cước của cả lô hàng trong một lần gửi. Hàng nhẹ, cồng kềnh tính theo số lớn hơn giữa cân nặng thực và cân nặng quy đổi (dài × rộng × cao cm ÷ 6000).',
  basisZh: '按同一批货物的总计费重量适用价格档位。轻泡货按实际重量与体积重量（长×宽×高 cm ÷ 6000）中较大者计费。',
  source: 'Owner cung cấp 06/11/2026',
  updated: '2026-11-06',
};
