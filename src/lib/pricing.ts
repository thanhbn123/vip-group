/**
 * Logic tính cước DÙNG CHUNG (công cụ tính trên web + test) — chính sách owner chốt 07/11/2026:
 * - Owner 18/11/2026 (thay chỉ thị 07/11): bậc giá theo TỔNG trọng lượng tính cước của cả lô = Σ (cân tính cước mỗi kiện, đã làm tròn) — như phiếu xuất kho.
 * - Trọng lượng tính cước của kiện = max(cân thực, cân quy đổi); cân quy đổi = dài × rộng × cao (cm) ÷ 6000.
 * - Một bảng giá chung cho 5 kho Thâm Quyến, Hạ Môn, Quảng Châu, Nghĩa Ô, Bằng Tường (thêm 18/11/2026).
 *
 * Làm tròn (như CRM V6.10, owner 11/11/2026): cân tính cước MỖI KIỆN dưới 1 kg tính 1 kg, từ 1 kg làm tròn LÊN 0,1 kg; tiền làm tròn tới đồng.
 * Ranh giới bậc dùng đúng min/max/inclusive trong pricing.ts.
 */
import type { PriceTier } from '../data/types';

export const VOLUMETRIC_DIVISOR = 6000;

/** Cân quy đổi (kg) của một kiện từ kích thước cm. */
export const volumetricKg = (lCm: number, wCm: number, hCm: number, divisor = VOLUMETRIC_DIVISOR) =>
  (Math.max(0, lCm) * Math.max(0, wCm) * Math.max(0, hCm)) / divisor;

/** Trọng lượng tính cước của một kiện = số lớn hơn giữa cân thực và cân quy đổi. */
export const chargeableKg = (actualKg: number, lCm: number, wCm: number, hCm: number, divisor = VOLUMETRIC_DIVISOR) =>
  Math.max(Math.max(0, actualKg), volumetricKg(lCm, wCm, hCm, divisor));

/** Bậc giá áp cho MỘT kiện theo trọng lượng tính cước của chính kiện đó. */
export function tierFor(tiers: PriceTier[], kg: number): PriceTier {
  const hit = tiers.filter((t) =>
    (t.minInclusive ? kg >= t.min : kg > t.min) && (t.max === null || (t.maxInclusive ? kg <= t.max : kg < t.max)));
  if (hit.length !== 1) throw new Error(`Khối lượng ${kg} kg rơi vào ${hit.length} bậc giá`);
  return hit[0];
}

/** Cân tính cước MỘT kiện sau làm tròn như phiếu xuất: < 1 kg → 1 kg; còn lại làm tròn LÊN 0,1 kg. */
export const roundChargeableKg = (kg: number) => (kg < 1 ? 1 : Math.ceil(Math.round(kg * 1e6) / 1e5) / 10);

/**
 * Ước tính cước cho `count` kiện giống nhau — NHƯ PHIẾU XUẤT KHO (owner 18/11/2026): tổng = cân tính cước mỗi kiện (đã làm tròn) × số kiện,
 * bậc giá theo TỔNG đó, tiền = tổng × đơn giá bậc.
 */
export function estimate(tiers: PriceTier[], p: { lCm: number; wCm: number; hCm: number; kg: number; count: number }, divisor = VOLUMETRIC_DIVISOR) {
  const perKg = roundChargeableKg(chargeableKg(p.kg, p.lCm, p.wCm, p.hCm, divisor));
  const count = Math.max(1, Math.round(p.count));
  const totalKg = Math.round(perKg * count * 10) / 10;
  const tier = tierFor(tiers, totalKg);
  return { chargeablePerPackage: perKg, totalKg, tier, perPackage: perKg * tier.price, count, total: Math.round(totalKg * tier.price) };
}

/** schema.org Offer cho từng bậc giá (VND/kg) — dùng chung cho trang chủ, bảng giá chi tiết, trang tuyến. */
export const priceOffers = (tiers: PriceTier[]) =>
  tiers.map((t) => ({
    '@type': 'Offer',
    name: t.label,
    priceCurrency: 'VND',
    priceSpecification: {
      '@type': 'UnitPriceSpecification', price: t.price, priceCurrency: 'VND', unitCode: 'KGM', unitText: 'kg',
      // Bậc theo TỔNG trọng lượng tính cước của cả lô (owner 18/11/2026).
      eligibleQuantity: { '@type': 'QuantitativeValue', minValue: t.min, ...(t.max !== null ? { maxValue: t.max } : {}), unitCode: 'KGM', unitText: 'kg' },
    },
  }));

/**
 * VIPG-WEB-034 · Phí dịch vụ order (owner 17/11/2026): % theo giá trị tiền hàng, bậc theo src/data/vi/service-terms.ts
 * (min loại trừ, max bao gồm). Đơn hàng đầu tiên miễn phí. Làm tròn tới đồng.
 */
export function orderServiceFee(tiers: { min: number; max: number | null; percent: number }[], goodsVnd: number, firstOrder = false) {
  const v = Math.max(0, goodsVnd);
  const tier = tiers.find((t) => (t.min === 0 ? v >= 0 : v > t.min) && (t.max === null || v <= t.max));
  if (!tier) throw new Error(`Giá trị ${v}đ không thuộc bậc phí nào`);
  return { tier, fee: firstOrder ? 0 : Math.round((v * tier.percent) / 100) };
}
