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
    { label: 'Từ 500 đến 1.000 kg', labelZh: '500–1,000 公斤（含 1,000）', min: 500, minInclusive: true, max: 1000, maxInclusive: true, price: 14000 },
    { label: 'Trên 1.000 kg', labelZh: '超过 1,000 公斤', min: 1000, minInclusive: false, max: null, maxInclusive: false, price: 12000 },
  ],
  // OWNER DIRECTIVE 07/11/2026 (chốt, thay xác nhận 06/11 "cả lô"): bậc giá theo trọng lượng tính cước TỪNG KIỆN,
  // không gộp lô; quy đổi hệ số 6000; một bảng giá chung cho 4 kho. Logic dùng chung: src/lib/pricing.ts.
  basis: 'Bậc giá xác định theo trọng lượng tính cước của từng kiện, không cộng gộp cả lô. Trọng lượng tính cước mỗi kiện là số lớn hơn giữa cân nặng thực và cân nặng quy đổi (dài × rộng × cao cm ÷ 6000). Áp dụng chung cho hàng nhận tại 4 kho Thâm Quyến, Hạ Môn, Quảng Châu, Nghĩa Ô.',
  basisZh: '价格档位按每件货物的计费重量确定，不合并整批重量。每件计费重量取实际重量与体积重量（长×宽×高 cm ÷ 6000）中较大者。适用于深圳、厦门、广州、义乌四个仓库。',
  source: 'Owner cung cấp 06/11/2026; cách áp bậc theo từng kiện + 4 kho: owner directive 07/11/2026',
  updated: '2026-11-07',
};
