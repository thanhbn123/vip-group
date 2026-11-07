/**
 * Dữ liệu có cấu trúc + câu chữ dùng chung cho trang mạng lưới kho và trang tuyến (VIPG-WEB-026).
 * Chỉ dùng dữ kiện có nguồn (địa chỉ owner xác nhận, hệ số quy đổi owner xác nhận, dịch vụ VIPORDER công bố).
 */
import type { PickupPoint } from '../data/types';
import { provider } from '../data/vi/logistics';
import { prettyPhone } from './logistics';

/** schema.org Place cho một kho nhận hàng — địa chỉ NGUYÊN VĂN, không khai chủ sở hữu. */
export const pickupPlaceLd = (p: PickupPoint, pageUrl: string) => ({
  '@type': 'Place',
  '@id': `${pageUrl}#kho-${p.id}`,
  name: `Kho nhận hàng ${p.city} (${p.cityZh})`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: p.addressZh.value,
    addressLocality: `${p.cityZh}`,
    addressRegion: p.provinceZh,
    addressCountry: 'CN',
  },
});

/** Đoạn trả lời trực tiếp đầu trang tuyến (< 100 từ) — cho Google AI Overview / Gemini trích dẫn. */
export const pickupAnswer = (p: PickupPoint) =>
  `VIP GROUP nhận hàng trực tiếp tại kho ${p.city} (${p.cityZh}, ${p.district}, ${p.province}) và vận chuyển về Việt Nam; dịch vụ do ${provider.name} vận hành. ` +
  `Nhà cung cấp giao hàng tới địa chỉ kho, ghi mã khách hàng trên từng kiện. ` +
  (p.priceApplies.value
    ? `Cước theo bảng giá chung cho cả 4 kho (5 bậc giá theo kg); bậc giá xác định theo trọng lượng tính cước của từng kiện — số lớn hơn giữa cân thực và cân quy đổi (dài × rộng × cao cm ÷ 6000), không gộp cả lô. `
    : `Cước tính theo kg trên khối lượng tính cước — số lớn hơn giữa cân nặng thực và cân nặng quy đổi (dài × rộng × cao cm ÷ 6000); đơn giá cho hàng nhận tại kho ${p.city} được xác nhận khi báo giá. `) +
  `Hotline/Zalo ${prettyPhone(provider.hotline)}.`;

export const pickupAnswerZh = (p: PickupPoint) =>
  `VIP GROUP 在${p.provinceZh}${p.cityZh}仓库直接收货并运往越南，服务由 ${provider.name} 运营。供应商将货物送至仓库地址，并在每件货物上标明客户编号（唛头）。${p.priceApplies.value ? '运费适用四个仓库统一价格表（按公斤分 5 档），价格档位按每件货物的计费重量确定，不合并整批重量。' : '运费按计费重量以公斤计算，具体单价以正式报价为准。'}热线 / Zalo：${prettyPhone(provider.hotline)}。`;

/** Các bước gửi hàng tới một kho (dựa trên quy trình 4 bước VIPORDER công bố). */
export const pickupSteps = (p: PickupPoint) => [
  { title: 'Đăng ký mã khách hàng', text: `Đăng ký trên viporder.com.vn để nhận mã khách hàng riêng và thông tin người nhận tại kho ${p.city}.` },
  { title: 'Gửi địa chỉ kho cho nhà cung cấp', text: `Sao chép nguyên văn địa chỉ tiếng Trung của kho ${p.city} gửi nhà cung cấp; yêu cầu ghi mã khách hàng trên từng kiện.` },
  { title: 'Báo mã vận đơn nội địa', text: 'Nếu nhà cung cấp gửi chuyển phát trong Trung Quốc, lưu lại mã vận đơn nội địa để đối chiếu khi hàng nhập kho.' },
  { title: 'Theo dõi và nhận hàng', text: 'Tra cứu bằng mã vận đơn / mã bao trên hệ thống VIPORDER; nhận hàng tại kho hoặc theo phương án giao hàng đã thỏa thuận.' },
];

export const pickupStepsZh = [
  '客户在 viporder.com.vn 注册，获取客户编号及收货人信息。',
  '供应商按中文地址原文发货，并在每件货物外箱标明客户编号（唛头）。',
  '如使用国内快递，请将快递单号告知客户，便于入库核对。',
  '货物入库后运往越南，客户可通过 VIPORDER 系统查询运单状态。',
];
