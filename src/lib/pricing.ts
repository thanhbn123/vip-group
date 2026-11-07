/**
 * Logic tính cước DÙNG CHUNG (công cụ tính trên web + test) — chính sách owner chốt 07/11/2026:
 * - Bậc giá xác định theo trọng lượng tính cước của TỪNG KIỆN, không cộng gộp cả lô.
 * - Trọng lượng tính cước của kiện = max(cân thực, cân quy đổi); cân quy đổi = dài × rộng × cao (cm) ÷ 6000.
 * - Một bảng giá chung cho 4 kho Thâm Quyến, Hạ Môn, Quảng Châu, Nghĩa Ô.
 *
 * Làm tròn: owner CHƯA quy định làm tròn khối lượng (ví dụ lên 0,1 kg hay 0,5 kg). Hàm ở đây KHÔNG làm tròn khối lượng;
 * chỉ làm tròn tiền ước tính tới đồng khi hiển thị. Ranh giới bậc dùng đúng min/max/inclusive trong pricing.ts.
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

/** Ước tính cước cho `count` kiện giống nhau — mỗi kiện tra bậc giá riêng (không gộp lô). */
export function estimate(tiers: PriceTier[], p: { lCm: number; wCm: number; hCm: number; kg: number; count: number }, divisor = VOLUMETRIC_DIVISOR) {
  const perKg = chargeableKg(p.kg, p.lCm, p.wCm, p.hCm, divisor);
  const count = Math.max(1, Math.round(p.count));
  const tier = tierFor(tiers, perKg);
  const perPackage = perKg * tier.price;
  return { chargeablePerPackage: perKg, tier, perPackage, count, total: Math.round(perPackage * count) };
}

/** schema.org Offer cho từng bậc giá (VND/kg) — dùng chung cho trang chủ, bảng giá chi tiết, trang tuyến. */
export const priceOffers = (tiers: PriceTier[]) =>
  tiers.map((t) => ({
    '@type': 'Offer',
    name: t.label,
    priceCurrency: 'VND',
    priceSpecification: {
      '@type': 'UnitPriceSpecification', price: t.price, priceCurrency: 'VND', unitCode: 'KGM', unitText: 'kg',
      // Bậc theo trọng lượng tính cước của MỘT kiện (owner 07/11/2026).
      eligibleQuantity: { '@type': 'QuantitativeValue', minValue: t.min, ...(t.max !== null ? { maxValue: t.max } : {}), unitCode: 'KGM', unitText: 'kg/kiện' },
    },
  }));
