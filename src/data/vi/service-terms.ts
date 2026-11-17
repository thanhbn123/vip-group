import type { Fact } from '../types';

/**
 * VIPG-WEB-034 · Điều khoản dịch vụ owner chốt 17/11/2026 (trả lời khảo sát đối thủ, mục 1–3):
 *   1. Phí dịch vụ order: miễn phí đơn hàng đầu tiên; đến 1 triệu 3% · trên 1 đến 5 triệu 2% · trên 5 triệu 1%
 *      (owner chọn cách ghép bậc này khi được hỏi lại cùng ngày).
 *      Tính PHẲNG: cả đơn chịu % của bậc chứa giá trị đơn, KHÔNG lũy tiến (owner 17/11/2026 "theo em đề xuất" — giống
 *      cách đối thủ công bố; mốc chuyển bậc có lợi cho khách đặt đơn lớn).
 *   2. Tỷ giá CNY→VND: công khai trên web, admin cập nhật (ở CRM — web đọc qua /api/fx, không gõ tỷ giá vào repo).
 *   3. Đền bù gấp 10 lần tiền cước khi mất / hỏng hàng, hoàn lại tiền cước; 2 ngày về kho Việt Nam.
 * Đổi nội dung ở đây = đổi cam kết với khách: chỉ sửa khi owner chốt lại.
 */
export const SRC_OWNER_TERMS = 'Owner trả lời 17/11/2026 (phí order, tỷ giá, đền bù, thời gian về kho Việt Nam)';

export interface OrderFeeTier {
  label: string;
  /** Giá trị tiền hàng (VNĐ): min loại trừ, max bao gồm; null = không giới hạn. */
  min: number;
  max: number | null;
  percent: number;
}

export const orderFee = {
  firstOrderFree: { value: true, source: SRC_OWNER_TERMS } as Fact<boolean>,
  basis: 'Tính theo phần trăm giá trị tiền hàng của đơn.',
  tiers: [
    { label: 'Đến 1.000.000đ', min: 0, max: 1_000_000, percent: 3 },
    { label: 'Trên 1.000.000đ đến 5.000.000đ', min: 1_000_000, max: 5_000_000, percent: 2 },
    { label: 'Trên 5.000.000đ', min: 5_000_000, max: null, percent: 1 },
  ] as OrderFeeTier[],
  source: SRC_OWNER_TERMS,
};

/** Cam kết đền bù — nguyên ý owner: "đền bù x10 tiền cước, mất hàng hỏng hàng hoàn lại tiền cước". */
export const COMPENSATION_MULTIPLIER = 10;
export const compensation: Fact = {
  value: `Mất hàng, hỏng hàng: đền bù gấp ${COMPENSATION_MULTIPLIER} lần tiền cước và hoàn lại tiền cước.`,
  source: SRC_OWNER_TERMS,
};

/** Thời gian vận chuyển — nguyên ý owner: "2 ngày về kho VN"; owner xác nhận áp dụng cả 4 kho (transitTime từng kho dùng câu này). */
export const TRANSIT_DAYS = 2;
export const TRANSIT_PHRASE = `${TRANSIT_DAYS} ngày từ kho Trung Quốc về kho Việt Nam`;
export const transit: Fact = { value: TRANSIT_PHRASE, source: SRC_OWNER_TERMS };
