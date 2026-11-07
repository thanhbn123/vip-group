import { contact } from './contact';
import { company } from './company';
import type { Article, FaqItem, LogisticsPage, LogisticsProvider, PickupId, PickupPoint, Fact } from '../types';

/**
 * KHU LOGISTICS — VIPG-WEB-021.
 *
 * QUY TẮC NGUỒN (bắt buộc):
 * - Dữ kiện dịch vụ: owner xác nhận (VIP GROUP cung cấp — directive 07/11/2026, tách khỏi VIPORDER)
 *   (đọc ngày 06/11/2026) hoặc từ dữ liệu owner đã chốt trong repo này.
 * - Chưa có nguồn → `value: null` (OWNER INPUT PENDING). Giao diện hiện "Đang cập nhật" + nút liên hệ.
 * - `sample` là dữ liệu MẪU chỉ hiện khi build `VIPG_DEMO=1`, luôn kèm nhãn MẪU. KHÔNG phải sự thật.
 * - Không ghi giá, thời gian giao, địa chỉ kho, cam kết bồi thường khi chưa có văn bản của owner.
 */

const HOTLINE = contact.hotlineDisplay!;

// Owner directive 07/11/2026: CÔNG TY TNHH VIP GROUP trực tiếp cung cấp dịch vụ logistics, TÁCH khỏi VIPORDER (không link, không nhắc tên).
const SRC_OWNER_PROVIDER = 'Owner directive 07/11/2026 — VIP GROUP cung cấp dịch vụ logistics';

export const provider: LogisticsProvider = {
  name: company.name,
  legalName: company.legalName!,
  taxId: company.taxId!,
  // Hotline/Zalo tập trung của VIP GROUP (src/data/vi/contact.ts).
  hotline: contact.hotline!,
  zaloUrl: contact.zaloUrl!,
  // Owner 07/11/2026: TẠM ghi văn phòng Lạng Sơn (địa chỉ pháp lý VIP GROUP); địa chỉ Bắc Ninh cập nhật sau.
  officeAddress: { value: `${contact.address} (văn phòng VIP GROUP — tạm thời)`, source: 'Owner 07/11/2026: tạm ghi văn phòng Lạng Sơn' },
  registerHref: '/lien-he/?nhu-cau=khac&dang-ky=1#form-lien-he',
};

/** Dịch vụ VIP GROUP cung cấp — nguồn: SRC_OWNER_PROVIDER. */
export const servicesSource = SRC_OWNER_PROVIDER;
export const services = [
  {
    title: 'Vận chuyển Trung Quốc – Việt Nam',
    text: 'Nhận hàng tại Trung Quốc, vận chuyển về Việt Nam và hỗ trợ giao hàng.',
  },
  {
    title: 'Nhập khẩu chính ngạch',
    text: 'Hỗ trợ doanh nghiệp nhập khẩu hàng hóa với bộ chứng từ phù hợp.',
  },
  {
    title: 'Khai báo hải quan',
    text: 'Hỗ trợ khai báo, hồ sơ và quy trình thông quan hàng hóa.',
  },
  {
    title: 'Đặt hàng 1688 / Taobao / Pinduoduo',
    text: 'Hỗ trợ tìm nguồn và đặt hàng từ các nền tảng thương mại Trung Quốc.',
  },
];

/** Quy trình 4 bước (nguồn: SRC_OWNER_PROVIDER). */
export const processSteps = [
  { title: 'Đăng ký khách hàng', text: `Đăng ký với VIP GROUP qua form trên website hoặc Zalo ${HOTLINE} để nhận mã khách hàng riêng.` },
  { title: 'Gửi hàng', text: 'Dùng mã khách hàng khi gửi hàng hoặc đặt hàng từ Trung Quốc.' },
  { title: 'Theo dõi', text: `Gửi mã vận đơn qua Zalo / hotline ${HOTLINE}, nhân viên VIP GROUP báo tình trạng lô hàng.` },
  { title: 'Nhận hàng', text: 'Nhận hàng tại kho hoặc theo phương án giao hàng đã thỏa thuận.' },
];

const pending = (sample?: string): Fact => ({ value: null, source: null, sample });

/* ───────────── 4 kho nhận hàng tại Trung Quốc (VIPG-WEB-026) ───────────── */

/**
 * NGUỒN: owner xác nhận 06/11/2026 (Project Controller — "VIP GROUP SEO MULTI-WAREHOUSE V2"):
 * "VIP GROUP nhận hàng trực tiếp tại 4 địa điểm ở Trung Quốc" + địa chỉ tiếng Trung NGUYÊN VĂN.
 * - KHÔNG viết "kho của VIP GROUP" / "thuộc sở hữu": chưa có chứng cứ sở hữu pháp lý.
 * - KHÔNG công khai tên người nhận, SĐT kho, mã khách hàng (owner yêu cầu).
 * - Bảng giá chung (pricing.ts) ÁP DỤNG cho cả 4 kho — owner directive 07/11/2026 (`priceApplies`, nguồn SRC_OWNER_PRICE).
 * - `context` / `goods` là kiến thức địa lý – thương mại chung về thành phố, không phải cam kết dịch vụ.
 */
/** Owner directive 07/11/2026 (Final Local Acceptance): giá theo từng kiện + bảng giá chung cho 4 kho. */
export const SRC_OWNER_PRICE = 'Owner directive 07/11/2026 — chính sách giá đã chốt';
export const SRC_OWNER_WAREHOUSES = 'Owner xác nhận 06/11/2026 (Project Controller — SEO Multi-Warehouse V2)';
const owner = (value: string): Fact => ({ value, source: SRC_OWNER_WAREHOUSES });

type PickupBase = Omit<PickupPoint, 'faq' | 'faqZh'> & { extraFaq: FaqItem; extraFaqZh?: { q: string; a: string } };

const pickupBase: PickupBase[] = [
  {
    id: 'tham-quyen',
    city: 'Thâm Quyến',
    cityZh: '深圳',
    cityEn: 'Shenzhen',
    province: 'Quảng Đông',
    provinceZh: '广东',
    district: 'quận Bảo An',
    addressZh: owner('深圳市宝安区福海街道海洋新城新钢物流园三期2栋'),
    context:
      'Thâm Quyến (深圳, Shenzhen) thuộc tỉnh Quảng Đông, sát Hồng Kông — một trong những trung tâm sản xuất điện tử, linh kiện và thiết bị công nghệ lớn nhất thế giới. Kho nhận hàng nằm ở quận Bảo An (宝安区), phía tây thành phố.',
    contextZh: '深圳位于广东省，毗邻香港，是全球重要的电子产品、元器件及科技设备制造中心之一。收货仓位于深圳西部的宝安区。',
    goods: ['Linh kiện, bo mạch, thiết bị điện tử', 'Phụ kiện điện thoại, máy tính, thiết bị thông minh', 'Đèn LED, thiết bị điện, máy móc nhỏ', 'Hàng từ nhà máy khu vực Thâm Quyến – Đông Quản'],
    goodsZh: ['电子元器件、电路板、电子设备', '手机及电脑配件、智能设备', 'LED 灯具、电器、小型机械', '深圳及东莞地区工厂货物'],
    deliveryNotes: ['Điểm nhận nằm trong khu logistics 新钢物流园, giai đoạn 3 (三期), tòa nhà số 2 (2栋) — ghi đủ "三期2栋" để tài xế tìm đúng tòa.', 'Khu vực: 海洋新城, phường 福海街道 (Phúc Hải), quận Bảo An (宝安区), phía tây Thâm Quyến.'],
    deliveryNotesZh: ['送货点位于新钢物流园三期2栋，请写全“三期2栋”，以免送错楼栋。', '区域：宝安区福海街道海洋新城。'],
    receivingHours: pending('[MẪU] 09:00–18:00, thứ Hai – thứ Bảy'),
    transitTime: pending('[MẪU] 2–3 ngày về Hà Nội'),
    priceApplies: { value: 'Áp dụng bảng giá chung Trung Quốc – Việt Nam', source: SRC_OWNER_PRICE },
    photos: { value: null, source: null },
    extraFaq: {
      q: 'Kho Thâm Quyến ở trang này có liên quan tới Shopee không?',
      a: 'Không. Kho Thâm Quyến ở trang này là nơi VIP GROUP nhận hàng của khách tự nhập từ nhà cung cấp tại Trung Quốc rồi vận chuyển về Việt Nam; không liên quan tới Shopee hay sàn thương mại điện tử nào.',
    },
  },
  {
    id: 'ha-mon',
    city: 'Hạ Môn',
    cityZh: '厦门',
    cityEn: 'Xiamen',
    province: 'Phúc Kiến',
    provinceZh: '福建',
    district: 'quận Hải Thương',
    addressZh: owner('福建省厦门市海沧区囷瑶路嘉功物流2号库3号仓'),
    context:
      'Hạ Môn (厦门, Xiamen) là thành phố cảng của tỉnh Phúc Kiến. Trong tỉnh có các vùng sản xuất giày dép, quần áo thể thao (Tấn Giang thuộc Tuyền Châu), gốm sứ (Đức Hóa) và đá ốp lát. Kho nhận hàng nằm ở quận Hải Thương (海沧区).',
    contextZh: '厦门是福建省的港口城市。福建省内有晋江（泉州）鞋服产业、德化陶瓷及石材产区。收货仓位于海沧区。',
    goods: ['Giày dép, quần áo thể thao', 'Gốm sứ, đồ gia dụng', 'Đá ốp lát, vật liệu trang trí', 'Hàng từ nhà cung cấp khu vực Phúc Kiến'],
    goodsZh: ['鞋类、运动服装', '陶瓷、家居用品', '石材、装饰材料', '福建地区供应商货物'],
    deliveryNotes: ['Điểm nhận là kho số 2, ô kho số 3 (2号库3号仓) trong khu kho 嘉功物流 trên đường 囷瑶路 — ghi đủ số kho và số ô.', 'Khu vực: quận Hải Thương (海沧区), Hạ Môn, tỉnh Phúc Kiến.'],
    deliveryNotesZh: ['送货点为嘉功物流2号库3号仓（囷瑶路），请写全库号与仓号。', '区域：福建省厦门市海沧区。'],
    receivingHours: pending('[MẪU] 09:00–18:00, thứ Hai – thứ Bảy'),
    transitTime: pending('[MẪU] 3–5 ngày về Hà Nội'),
    priceApplies: { value: 'Áp dụng bảng giá chung Trung Quốc – Việt Nam', source: SRC_OWNER_PRICE },
    photos: { value: null, source: null },
    extraFaq: {
      q: 'Nên gửi hàng về kho Hạ Môn hay kho Quảng Châu?',
      a: `Chọn kho gần nhà cung cấp nhất để rút ngắn quãng giao nội địa Trung Quốc: nhà cung cấp ở Phúc Kiến (Hạ Môn, Tuyền Châu, Tấn Giang) nên giao về kho Hạ Môn; nhà cung cấp ở Quảng Đông nên giao về kho Quảng Châu hoặc Thâm Quyến. Chưa chắc chọn kho nào, gọi hoặc nhắn Zalo ${HOTLINE}.`,
    },
  },
  {
    id: 'quang-chau',
    city: 'Quảng Châu',
    cityZh: '广州',
    cityEn: 'Guangzhou',
    province: 'Quảng Đông',
    provinceZh: '广东',
    district: 'quận Bạch Vân',
    addressZh: owner('广州市白云区钟落潭镇虎塘村凤岗路26号'),
    context:
      'Quảng Châu (广州, Guangzhou) là thủ phủ tỉnh Quảng Đông, nơi tổ chức Hội chợ Canton (广交会) và có nhiều chợ đầu mối bán buôn quần áo, giày dép, túi xách, phụ kiện. Kho nhận hàng nằm ở trấn Chung Lạc Đàm, quận Bạch Vân (白云区钟落潭镇), phía bắc thành phố.',
    contextZh: '广州是广东省省会、广交会举办地，拥有众多服装、鞋类、箱包及饰品批发市场。收货仓位于广州北部的白云区钟落潭镇。',
    goods: ['Quần áo, thời trang', 'Giày dép, túi xách', 'Phụ kiện, đồ gia dụng', 'Hàng đặt từ 1688 / Taobao giao về Quảng Châu'],
    goodsZh: ['服装、时尚产品', '鞋类、箱包', '饰品、家居用品', '1688、淘宝订单发往广州'],
    deliveryNotes: ['Địa chỉ ở thôn Hổ Đường (虎塘村), số 26 đường 凤岗路, trấn Chung Lạc Đàm — khu ngoại thành phía bắc Quảng Châu.', 'Gửi nhà cung cấp đủ tên người nhận và số điện thoại liên hệ (cung cấp khi đăng ký) để tài xế liên hệ khi tới.'],
    deliveryNotesZh: ['地址位于广州北部白云区钟落潭镇虎塘村凤岗路26号。', '请将客户提供的收货人及联系电话一并告知司机，便于到达时联系。'],
    receivingHours: pending('[MẪU] 09:00–18:00, thứ Hai – thứ Bảy'),
    transitTime: pending('[MẪU] 3–5 ngày về Hà Nội'),
    priceApplies: { value: 'Áp dụng bảng giá chung Trung Quốc – Việt Nam', source: SRC_OWNER_PRICE },
    photos: { value: null, source: null },
    extraFaq: {
      q: 'Đặt hàng 1688, Taobao có giao về kho Quảng Châu được không?',
      a: 'Được. Khi đặt hàng, điền địa chỉ kho Quảng Châu làm địa chỉ nhận và ghi mã khách hàng theo hướng dẫn nhận được khi đăng ký. VIP GROUP cũng hỗ trợ đặt hàng 1688 / Taobao / Pinduoduo nếu bạn cần.',
    },
  },
  {
    id: 'nghia-o',
    city: 'Nghĩa Ô',
    cityZh: '义乌',
    cityEn: 'Yiwu',
    province: 'Chiết Giang',
    provinceZh: '浙江',
    district: 'khu Bắc Uyển',
    addressZh: owner('义乌市北苑三期秋实路121号6号楼10-12库西门，靠5号货梯'),
    context:
      'Nghĩa Ô (义乌, Yiwu) thuộc tỉnh Chiết Giang, nổi tiếng với Thành phố Thương mại Quốc tế Nghĩa Ô (义乌国际商贸城) — một trong những chợ bán buôn hàng tiêu dùng nhỏ lớn nhất thế giới. Kho nhận hàng nằm ở khu Bắc Uyển (北苑).',
    contextZh: '义乌位于浙江省，以义乌国际商贸城闻名，是全球最大的小商品批发市场之一。收货仓位于北苑。',
    goods: ['Đồ chơi, văn phòng phẩm', 'Đồ trang trí, quà tặng, đồ dùng lễ hội', 'Trang sức thời trang, phụ kiện', 'Đồ gia dụng nhỏ'],
    goodsZh: ['玩具、文具', '装饰品、礼品、节日用品', '时尚饰品、配件', '小家居用品'],
    deliveryNotes: ['Điểm nhận: khu Bắc Uyển giai đoạn 3 (北苑三期), số 121 đường 秋实路, tòa nhà số 6, kho 10 đến 12.', 'Vào cửa Tây (西门), dỡ hàng cạnh thang máy chở hàng số 5 (5号货梯).'],
    deliveryNotesZh: ['送货点：北苑三期秋实路121号6号楼10-12库。', '请从西门进入，靠5号货梯卸货。'],
    receivingHours: pending('[MẪU] 08:30–17:30, thứ Hai – thứ Bảy'),
    transitTime: pending('[MẪU] 5–7 ngày về Hà Nội'),
    priceApplies: { value: 'Áp dụng bảng giá chung Trung Quốc – Việt Nam', source: SRC_OWNER_PRICE },
    photos: { value: null, source: null },
    extraFaq: {
      q: 'Giao hàng tới kho Nghĩa Ô cần lưu ý gì?',
      a: 'Theo địa chỉ kho, điểm nhận là kho 10 đến 12, tòa nhà số 6, cửa Tây, cạnh thang máy chở hàng số 5 (6号楼10-12库西门，靠5号货梯). Gửi nguyên văn địa chỉ tiếng Trung cho nhà cung cấp hoặc tài xế để giao đúng chỗ.',
    },
    extraFaqZh: { q: '送货到义乌仓需要注意什么？', a: '请按地址从西门进入，靠5号货梯卸货（6号楼10-12库）。' },
  },
];

/** Câu hỏi chung cho mọi kho + 1 câu riêng. Câu phụ thuộc dữ kiện chưa có nguồn → `pending` (không vào FAQPage). */
function pickupFaq(p: PickupBase): FaqItem[] {
  const addr = p.addressZh.value ?? '';
  return [
    {
      q: `Địa chỉ kho nhận hàng ${p.city} ở đâu?`,
      a: `Địa chỉ kho ${p.city} (${p.district}, ${p.province}): ${addr}. Tên người nhận, số điện thoại liên hệ khi giao và mã khách hàng ghi trên kiện được cung cấp riêng sau khi bạn đăng ký mã khách hàng — không đăng công khai trên website.`,
    },
    {
      q: `Gửi hàng từ ${p.city} về Việt Nam như thế nào?`,
      a: `Đăng ký khách hàng với VIP GROUP (form trên website hoặc Zalo ${HOTLINE}), gửi địa chỉ kho ${p.city} cho nhà cung cấp và yêu cầu ghi mã khách hàng trên từng kiện. Sau khi hàng nhập kho, theo dõi bằng mã vận đơn / mã bao và nhận hàng tại Việt Nam theo phương án đã thỏa thuận.`,
    },
    {
      q: `Cước vận chuyển từ ${p.city} về Việt Nam tính thế nào?`,
      a: p.priceApplies.value
        ? `Hàng nhận tại kho ${p.city} áp dụng bảng giá chung cho 4 kho: 0–5 kg 20.000đ/kg; trên 5 đến dưới 100 kg 16.000đ/kg; từ 100 đến dưới 500 kg 15.000đ/kg; từ 500 đến 1.000 kg 14.000đ/kg; trên 1.000 kg 12.000đ/kg. Bậc giá chọn theo trọng lượng tính cước của từng kiện — số lớn hơn giữa cân nặng thực và cân nặng quy đổi (dài × rộng × cao cm ÷ 6000), không gộp cả lô. Phụ phí và thuế (nếu có) được xác nhận trước khi báo giá chính thức.`
        : `Cước tính theo kg trên khối lượng tính cước — số lớn hơn giữa cân nặng thực và cân nặng quy đổi (dài × rộng × cao cm ÷ 6000). Bảng giá chung Trung Quốc – Việt Nam có tại trang Bảng giá; đơn giá áp dụng cho hàng nhận tại kho ${p.city} được xác nhận khi báo giá, cùng phụ phí và thuế (nếu có).`,
    },
    {
      q: `Hàng từ ${p.city} về Việt Nam mất bao lâu?`,
      a: `Thời gian phụ thuộc loại hàng, thủ tục và lịch xe. Gọi hoặc nhắn Zalo ${HOTLINE} để được báo thời gian cho lô hàng cụ thể.`,
      pending: p.transitTime.value === null,
    },
    p.extraFaq,
  ];
}

function pickupFaqZh(p: PickupBase): { q: string; a: string }[] {
  return [
    { q: `${p.cityZh}仓地址是什么？`, a: `${p.addressZh.value ?? ''}。收货人姓名、联系电话及客户编号（唛头）由客户注册后单独提供，网站不公开。` },
    { q: '供应商如何发货？', a: '请按客户提供的收货信息发货，并在每件货物外箱标明客户编号（唛头）；如使用国内快递，请将快递单号告知客户。' },
    {
      q: '运费如何计算？',
      a: p.priceApplies.value
        ? '四个仓库适用统一价格表（越南盾/公斤）：0–5 公斤 20,000；超过 5 公斤，不足 100 公斤 16,000；100 公斤至不足 500 公斤 15,000；500–1,000 公斤 14,000；超过 1,000 公斤 12,000。价格档位按每件货物的计费重量确定（实际重量与体积重量取较大者，体积重量 = 长×宽×高 cm ÷ 6000），不合并整批重量；附加费及税费（如有）将在正式报价前确认。'
        : '运费按计费重量（实际重量与体积重量取较大者，体积重量 = 长×宽×高 cm ÷ 6000）以公斤计算，具体单价以正式报价为准；附加费及税费（如有）将在正式报价前确认。',
    },
    ...(p.extraFaqZh ? [p.extraFaqZh] : []),
    { q: '如何联系？', a: `热线 / Zalo：${HOTLINE}（越南号码）。` },
  ];
}

export const pickupPoints: PickupPoint[] = pickupBase.map(({ extraFaq: _e, extraFaqZh: _z, ...p }, i) => ({
  ...p,
  faq: pickupFaq(pickupBase[i]),
  faqZh: pickupFaqZh(pickupBase[i]),
}));

export const pickupById = (id: PickupId) => pickupPoints.find((p) => p.id === id)!;

/** Hệ số quy đổi cân nặng thể tích (cm³ / kg) mà VIP GROUP áp dụng — chưa được owner cung cấp. */
// Owner xác nhận 06/11/2026: có quy đổi thể tích, hệ số 6000; tính theo số lớn hơn giữa cân thực và cân quy đổi.
export const volumetricDivisor: Fact<number> = { value: 6000, source: 'Owner xác nhận 06/11/2026 (phiên Controller 8d)' };

/** Bảng giá theo kg: dùng chung `pricing` (src/data/vi/pricing.ts — owner cung cấp 06/11/2026), không lặp lại ở đây. */

/** Các yếu tố ảnh hưởng tới cước — kiến thức chung của ngành, không phải cam kết giá. */
export const priceFactors = [
  { title: 'Cân nặng thực và số khối', text: 'Hàng nặng tính theo kg, hàng cồng kềnh thường tính theo thể tích (m³) hoặc cân nặng quy đổi.' },
  { title: 'Kho nhận và nơi giao', text: 'Kho xuất phát tại Trung Quốc và địa điểm nhận hàng tại Việt Nam quyết định quãng đường và chi phí.' },
  { title: 'Loại hàng và chứng từ', text: 'Hàng cần nhập khẩu chính ngạch, kiểm tra chuyên ngành hoặc giấy phép sẽ phát sinh thêm thủ tục.' },
  { title: 'Đóng gói và dịch vụ thêm', text: 'Đóng gỗ, gia cố, kiểm đếm, giao tận nơi là các hạng mục được báo riêng nếu khách cần.' },
];

export const serviceArea = {
  /**
   * Thị trường MỤC TIÊU owner chỉ định trong brief dự án 06/11/2026 (không phải cam kết giao tận nơi).
   * Hiển thị là "khu vực tập trung" — năng lực giao cụ thể vẫn là OWNER INPUT PENDING (`expansion`).
   */
  focus: ['Bắc Ninh', 'Từ Sơn', 'Đồng Kỵ', 'các khu công nghiệp lân cận'],
  /** Mở rộng giao tận nơi ngoài Bắc Ninh — chưa có xác nhận phạm vi. */
  expansion: pending('[MẪU] Hà Nội, Bắc Giang, Hải Dương, Hưng Yên và giao toàn quốc qua đối tác'),
};

export const faqs: FaqItem[] = [
  {
    q: 'Muốn gửi hàng từ Trung Quốc về thì bắt đầu từ đâu?',
    a: `Đăng ký khách hàng với VIP GROUP qua form trên website hoặc Zalo ${HOTLINE} để nhận mã khách hàng, sau đó dùng mã này khi gửi hàng hoặc đặt hàng. Nếu chưa rõ nên gửi về kho nào, nhân viên sẽ hướng dẫn.`,
  },
  {
    q: 'Tra cứu tình trạng hàng ở đâu?',
    a: `Gửi mã vận đơn (hoặc mã kiện) và mã khách hàng qua Zalo / hotline ${HOTLINE}; nhân viên VIP GROUP tra cứu và báo tình trạng lô hàng.`,
  },
  {
    q: 'Có hỗ trợ đặt hàng 1688, Taobao, Pinduoduo không?',
    a: 'Có. VIP GROUP hỗ trợ khách tìm nguồn và đặt hàng từ các nền tảng 1688, Taobao, Pinduoduo, sau đó vận chuyển về Việt Nam.',
  },
  {
    q: 'Doanh nghiệp cần nhập khẩu chính ngạch thì làm thế nào?',
    a: 'VIP GROUP hỗ trợ nhập khẩu chính ngạch và khai báo hải quan với bộ chứng từ phù hợp. Hồ sơ cụ thể phụ thuộc mặt hàng — vui lòng gửi thông tin hàng để được tư vấn.',
  },
  {
    // VIPG-WEB-026: owner xác nhận 4 điểm nhận hàng 06/11/2026 → câu này có căn cứ.
    q: 'VIP GROUP nhận hàng ở đâu tại Trung Quốc?',
    a: 'VIP GROUP nhận hàng tại 4 kho ở Trung Quốc: Thâm Quyến (quận Bảo An), Hạ Môn (quận Hải Thương), Quảng Châu (quận Bạch Vân) và Nghĩa Ô (Chiết Giang). Địa chỉ tiếng Trung từng kho có tại trang Kho Trung Quốc; tên người nhận và mã khách hàng ghi trên kiện được cung cấp sau khi đăng ký.',
  },
  {
    q: 'Bảng giá vận chuyển Trung Quốc – Việt Nam bao nhiêu một kg?',
    a: 'Đơn giá theo khối lượng: 0–5 kg 20.000đ/kg; trên 5 đến dưới 100 kg 16.000đ/kg; từ 100 đến dưới 500 kg 15.000đ/kg; từ 500 đến 1.000 kg 14.000đ/kg; trên 1.000 kg 12.000đ/kg. Bậc giá xác định theo trọng lượng tính cước của từng kiện, không gộp cả lô; áp dụng chung cho 4 kho Thâm Quyến, Hạ Môn, Quảng Châu, Nghĩa Ô. Phụ phí và thuế (nếu có) được xác nhận trước khi báo giá chính thức.',
  },
  {
    q: 'Cước vận chuyển tính theo cân nặng hay theo khối?',
    a: 'Cước tính theo số lớn hơn giữa cân nặng thực và cân nặng quy đổi (dài × rộng × cao theo cm ÷ 6000). Bậc giá theo kg xác định theo trọng lượng tính cước của từng kiện (không cộng gộp các kiện trong lô).',
  },
  {
    q: 'Hàng về Bắc Ninh mất bao lâu?',
    a: 'Thời gian phụ thuộc kho xuất phát, loại hàng và thủ tục. Thời gian cụ thể đang được cập nhật — vui lòng liên hệ để được báo theo lô hàng.',
    pending: true,
  },
  {
    q: 'Nhận hàng tại Việt Nam như thế nào?',
    a: `Khách nhận hàng tại kho hoặc theo phương án giao hàng đã thỏa thuận khi báo giá. Gọi hoặc nhắn Zalo ${HOTLINE} để thống nhất địa điểm nhận.`,
  },
  {
    q: 'Hàng bị thiếu, hỏng khi vận chuyển thì xử lý ra sao?',
    a: 'Chính sách kiểm đếm, khiếu nại và bồi thường đang được cập nhật. Vui lòng liên hệ hotline để được hướng dẫn trước khi gửi hàng giá trị cao.',
    pending: true,
  },
  {
    q: 'Hàng cấm hoặc hàng cần giấy phép có gửi được không?',
    a: 'Hàng cấm nhập khẩu theo quy định pháp luật Việt Nam không được nhập khẩu. Hàng cần giấy phép hoặc kiểm tra chuyên ngành cần tư vấn trước khi đặt hàng.',
  },
];

/* ───────────── Trang ───────────── */

export const pages: LogisticsPage[] = [
  {
    key: 'home',
    href: '/logistics/',
    nav: 'Tổng quan',
    title: 'Logistics Trung – Việt: vận chuyển, nhập khẩu, hải quan',
    description:
      'Logistics VIP GROUP: nhận hàng tại 4 kho Trung Quốc, vận chuyển về Việt Nam, nhập khẩu chính ngạch, khai báo hải quan, đặt hàng 1688.',
    h1: 'Logistics Trung Quốc – Việt Nam',
    lead: 'Nhận hàng tại Trung Quốc, vận chuyển về Việt Nam, hỗ trợ nhập khẩu chính ngạch và khai báo hải quan — phục vụ khách hàng Bắc Ninh và toàn miền Bắc.',
    status: 'ready',
    keyword: 'logistics Trung Việt VIP GROUP (thương hiệu + tổng quan)',
  },
  {
    key: 'bac-ninh',
    href: '/logistics/van-chuyen-trung-quoc-bac-ninh/',
    nav: 'Về Bắc Ninh',
    title: 'Vận chuyển hàng Trung Quốc về Bắc Ninh, Từ Sơn',
    description:
      `Vận chuyển hàng Trung Quốc về Bắc Ninh, Từ Sơn, Đồng Kỵ và khu công nghiệp: bảng giá theo kg, 4 kho Trung Quốc. Gọi/Zalo ${HOTLINE}.`,
    h1: 'Vận chuyển hàng Trung Quốc về Bắc Ninh',
    lead: 'Dành cho xưởng sản xuất, doanh nghiệp trong khu công nghiệp và chủ shop tại Bắc Ninh, Từ Sơn, Đồng Kỵ cần nhập hàng Trung Quốc thường xuyên.',
    status: 'ready',
    keyword: 'vận chuyển hàng Trung Quốc về Bắc Ninh',
  },
  {
    key: 'viet-nam',
    href: '/logistics/van-chuyen-trung-quoc-viet-nam/',
    nav: 'Trung – Việt',
    title: 'Vận chuyển hàng Trung Quốc về Việt Nam, chính ngạch',
    description:
      'Dịch vụ vận chuyển hàng Trung Quốc về Việt Nam: nhận hàng tại Trung Quốc, nhập khẩu chính ngạch, khai báo hải quan, đặt hàng 1688/Taobao.',
    h1: 'Vận chuyển hàng Trung Quốc về Việt Nam',
    lead: 'Một đầu mối cho hành trình nhập hàng: đặt hàng, nhận hàng tại Trung Quốc, vận chuyển, chứng từ nhập khẩu và nhận hàng tại Việt Nam.',
    status: 'ready',
    keyword: 'vận chuyển hàng Trung Quốc về Việt Nam',
  },
  // ── VIPG-WEB-026: mạng lưới 4 kho + 4 trang tuyến (owner xác nhận 4 điểm nhận hàng 06/11/2026).
  //    Thay cho /logistics/kho-quang-chau/ (nháp) và /logistics/van-chuyen-tham-quyen-viet-nam/ (ready trên nhánh 025, CHƯA lên
//    staging/production). Nếu nhánh 025 phát hành trước V2 → cần 301 sang /logistics/van-chuyen-tham-quyen-ve-viet-nam/.
  {
    key: 'kho-trung-quoc',
    href: '/logistics/kho-trung-quoc/',
    nav: 'Kho Trung Quốc',
    title: 'Kho Trung Quốc: Thâm Quyến, Quảng Châu, Hạ Môn, Nghĩa Ô',
    description:
      `VIP GROUP nhận hàng tại 4 kho Trung Quốc: Thâm Quyến, Hạ Môn, Quảng Châu, Nghĩa Ô. Địa chỉ tiếng Trung, hướng dẫn gửi hàng, cách tính cước. Hotline/Zalo ${HOTLINE}.`,
    h1: '4 kho nhận hàng tại Trung Quốc',
    lead: 'Địa chỉ tiếng Trung để gửi cho nhà cung cấp, hướng dẫn ghi mã khách hàng và cách chọn kho gần nguồn hàng nhất.',
    status: 'ready',
    keyword: 'kho Trung Quốc; kho nhận hàng Trung Quốc; 中国仓库地址',
  },
  {
    key: 'tham-quyen',
    href: '/logistics/van-chuyen-tham-quyen-ve-viet-nam/',
    nav: 'Thâm Quyến',
    title: 'Vận chuyển Trung Việt từ Thâm Quyến về Việt Nam',
    description:
      `Kho nhận hàng Thâm Quyến (深圳, quận Bảo An) vận chuyển về Việt Nam: địa chỉ tiếng Trung, cách gửi hàng, cách tính cước theo kg. Hotline ${HOTLINE}.`,
    h1: 'Vận chuyển hàng từ Thâm Quyến về Việt Nam',
    lead: 'Nhận hàng trực tiếp tại Thâm Quyến cho doanh nghiệp, xưởng sản xuất và chủ shop nhập linh kiện, thiết bị điện tử, phụ kiện công nghệ.',
    status: 'ready',
    hideInNav: true,
    keyword: 'vận chuyển trung việt từ thâm quyến về việt nam; kho Thâm Quyến; 深圳到越南物流',
  },
  {
    key: 'ha-mon',
    href: '/logistics/van-chuyen-ha-mon-ve-viet-nam/',
    nav: 'Hạ Môn',
    title: 'Vận chuyển hàng Hạ Môn (Phúc Kiến) về Việt Nam',
    description:
      'Kho nhận hàng Hạ Môn (厦门, quận Hải Thương, Phúc Kiến) vận chuyển về Việt Nam: giày dép, đồ thể thao, gốm sứ. Địa chỉ tiếng Trung và cách gửi hàng.',
    h1: 'Vận chuyển hàng từ Hạ Môn về Việt Nam',
    lead: 'Nhận hàng trực tiếp tại Hạ Môn cho nhà nhập khẩu giày dép, quần áo thể thao, gốm sứ và hàng từ nhà cung cấp Phúc Kiến.',
    status: 'ready',
    hideInNav: true,
    keyword: 'vận chuyển Hạ Môn về Việt Nam; kho Hạ Môn; 厦门到越南物流',
  },
  {
    key: 'quang-chau',
    href: '/logistics/van-chuyen-quang-chau-ve-viet-nam/',
    nav: 'Quảng Châu',
    title: 'Vận chuyển Quảng Châu về Việt Nam – kho Bạch Vân',
    description:
      'Kho nhận hàng Quảng Châu (广州, quận Bạch Vân) vận chuyển về Việt Nam: quần áo, giày dép, túi xách, hàng 1688/Taobao. Địa chỉ tiếng Trung và cách gửi hàng.',
    h1: 'Vận chuyển hàng từ Quảng Châu về Việt Nam',
    lead: 'Nhận hàng trực tiếp tại Quảng Châu cho chủ shop thời trang, nhà bán buôn và khách đặt hàng 1688 / Taobao.',
    status: 'ready',
    hideInNav: true,
    keyword: 'vận chuyển Quảng Châu về Việt Nam; kho Quảng Châu; 广州到越南物流',
  },
  {
    key: 'nghia-o',
    href: '/logistics/van-chuyen-nghia-o-ve-viet-nam/',
    nav: 'Nghĩa Ô',
    title: 'Vận chuyển hàng Nghĩa Ô (Yiwu, 义乌) về Việt Nam',
    description:
      'Kho nhận hàng Nghĩa Ô (义乌, Chiết Giang) vận chuyển về Việt Nam: đồ chơi, văn phòng phẩm, quà tặng, hàng tiêu dùng nhỏ. Địa chỉ tiếng Trung và cách gửi hàng.',
    h1: 'Vận chuyển hàng từ Nghĩa Ô về Việt Nam',
    lead: 'Nhận hàng trực tiếp tại Nghĩa Ô cho chủ shop và nhà bán buôn nhập đồ chơi, văn phòng phẩm, quà tặng, hàng tiêu dùng nhỏ.',
    status: 'ready',
    hideInNav: true,
    keyword: 'vận chuyển Nghĩa Ô về Việt Nam; kho Nghĩa Ô; 义乌到越南物流',
  },
  {
    key: 'quy-trinh',
    href: '/logistics/quy-trinh-gui-hang/',
    nav: 'Quy trình',
    title: 'Quy trình gửi hàng từ Trung Quốc về Việt Nam',
    description:
      'Bốn bước gửi hàng Trung Quốc về Việt Nam cùng VIP GROUP: đăng ký khách hàng, gửi hàng, theo dõi vận đơn và nhận hàng. Kèm lưu ý đóng gói.',
    h1: 'Quy trình gửi hàng từ Trung Quốc về Việt Nam',
    lead: 'Bốn bước từ lúc đăng ký mã khách hàng tới lúc nhận hàng, kèm những lưu ý giúp lô hàng đi nhanh và đúng.',
    status: 'ready',
    keyword: 'quy trình gửi hàng Trung Quốc về Việt Nam',
  },
  {
    key: 'bang-gia',
    href: '/logistics/bang-gia/',
    nav: 'Bảng giá & báo giá',
    title: 'Bảng giá vận chuyển Trung Quốc – Việt Nam theo kg',
    description:
      'Bảng giá vận chuyển hàng Trung Quốc về Việt Nam theo kg: từ 12.000 đến 20.000 VNĐ/kg tùy khối lượng. Tính số khối và gửi yêu cầu báo giá.',
    h1: 'Bảng giá vận chuyển Trung Quốc – Việt Nam',
    lead: 'Đơn giá theo khối lượng, đơn vị VNĐ/kg. Phụ phí và thuế (nếu có) được xác nhận trước khi báo giá chính thức.',
    // READY (V1.1): đơn giá theo kg owner cung cấp 06/11/2026. Hệ số quy đổi + thời gian vẫn chờ owner (không hiển thị).
    status: 'ready',
    keyword: 'bảng giá vận chuyển Trung Quốc Việt Nam',
  },
  {
    key: 'tra-cuu',
    href: '/logistics/tra-cuu-van-don/',
    nav: 'Tra cứu vận đơn',
    title: 'Tra cứu vận đơn hàng Trung Quốc về Việt Nam',
    description:
      'Tra cứu tình trạng hàng Trung Quốc về Việt Nam: gửi mã vận đơn hoặc mã kiện qua Zalo / hotline, nhân viên VIP GROUP báo lại.',
    h1: 'Tra cứu vận đơn',
    lead: 'Gửi mã vận đơn và mã khách hàng cho VIP GROUP qua Zalo hoặc hotline — nhân viên tra cứu và báo tình trạng lô hàng.',
    status: 'ready',
    keyword: 'tra cứu vận đơn hàng Trung Quốc',
  },
  {
    key: 'faq',
    href: '/logistics/cau-hoi-thuong-gap/',
    nav: 'Hỏi đáp',
    title: 'Câu hỏi thường gặp về vận chuyển hàng Trung Quốc',
    description:
      'Giải đáp về gửi hàng Trung Quốc về Việt Nam: bắt đầu thế nào, tra cứu ở đâu, cách tính cước, nhập khẩu chính ngạch, nhận hàng tại Bắc Ninh.',
    h1: 'Câu hỏi thường gặp',
    lead: 'Những câu hỏi khách hàng hay hỏi trước khi gửi lô hàng đầu tiên.',
    status: 'ready',
    keyword: 'câu hỏi vận chuyển hàng Trung Quốc',
  },
  {
    key: 'lien-he',
    href: '/logistics/lien-he/',
    nav: 'Liên hệ',
    title: 'Liên hệ Logistics VIP GROUP – Hotline/Zalo, văn phòng',
    description:
      `Liên hệ dịch vụ vận chuyển Trung Quốc – Việt Nam của VIP GROUP: Hotline/Zalo ${HOTLINE}, form yêu cầu báo giá, khu vực phục vụ Bắc Ninh.`,
    h1: 'Liên hệ và khu vực phục vụ',
    lead: 'Gọi điện, nhắn Zalo hoặc gửi yêu cầu báo giá — đội ngũ VIP GROUP sẽ liên hệ lại.',
    status: 'ready',
    keyword: 'liên hệ vận chuyển Trung Quốc Bắc Ninh',
  },
];

export const knowledgeIndex: LogisticsPage = {
  key: 'kien-thuc',
  href: '/logistics/kien-thuc/',
  nav: 'Kiến thức',
  title: 'Kiến thức nhập hàng Trung Quốc',
  description:
    'Hướng dẫn thực tế về nhập hàng Trung Quốc: cách tính số khối, cân nặng quy đổi, ghi mã khách hàng khi đặt hàng, đóng gói hàng gửi về Việt Nam.',
  h1: 'Kiến thức nhập hàng Trung Quốc',
  lead: 'Bài hướng dẫn thực tế cho chủ shop, xưởng sản xuất và doanh nghiệp.',
  // Chưa có bài nào được duyệt → trang mục lục cũng chưa xuất bản.
  status: 'draft',
  keyword: 'kiến thức nhập hàng Trung Quốc',
};

/* ───────────── Bài viết (NHÁP — chờ owner duyệt) ───────────── */

export const articles: Article[] = [
  {
    slug: 'cach-tinh-so-khoi-va-can-nang-quy-doi',
    title: 'Cách tính số khối (m³) và cân nặng quy đổi khi gửi hàng Trung Quốc',
    description:
      'Hướng dẫn đo kiện, tính số khối m³ và cân nặng quy đổi để ước tính cước vận chuyển hàng Trung Quốc về Việt Nam, kèm ví dụ cụ thể.',
    keyword: 'cách tính số khối hàng Trung Quốc',
    status: 'draft',
    updated: '2026-11-06',
    sections: [
      {
        heading: 'Vì sao cần biết số khối?',
        paragraphs: [
          'Hàng nhẹ nhưng cồng kềnh (thú bông, đồ nhựa, nội thất tháo rời) chiếm nhiều chỗ trên xe hơn cân nặng thực của nó. Vì vậy đơn vị vận chuyển thường so sánh cân nặng thực với thể tích hoặc cân nặng quy đổi và tính cước theo giá trị lớn hơn.',
        ],
      },
      {
        heading: 'Cách đo và tính số khối',
        paragraphs: [
          'Đo chiều dài, rộng, cao của kiện theo centimet (đo phần lớn nhất, kể cả phần gồ ra). Số khối m³ = dài × rộng × cao ÷ 1.000.000.',
          'Ví dụ: kiện 60 × 50 × 40 cm có thể tích 60 × 50 × 40 = 120.000 cm³, tương đương 0,12 m³. Mười kiện như vậy là 1,2 m³.',
        ],
      },
      {
        heading: 'Cân nặng quy đổi',
        paragraphs: [
          'Cân nặng quy đổi (kg) = dài × rộng × cao (cm) ÷ hệ số quy đổi. Hệ số này do từng đơn vị vận chuyển quy định và có thể khác nhau theo tuyến, loại hình vận chuyển.',
          'Hệ số quy đổi VIP GROUP áp dụng sẽ được ghi rõ trong báo giá cho từng lô hàng.',
        ],
      },
      {
        heading: 'Mẹo để giảm số khối',
        paragraphs: ['Một vài cách đơn giản giúp lô hàng gọn hơn:'],
        list: [
          'Đề nghị nhà cung cấp đóng thùng vừa khít, không độn quá nhiều.',
          'Gom nhiều đơn nhỏ vào ít thùng lớn tại kho Trung Quốc.',
          'Với nội thất, đồ gỗ: ưu tiên tháo rời nếu sản phẩm cho phép.',
        ],
      },
    ],
    related: ['/logistics/bang-gia/', '/logistics/quy-trinh-gui-hang/'],
  },
  {
    slug: 'ghi-ma-khach-hang-khi-dat-hang-1688-taobao',
    title: 'Ghi mã khách hàng khi đặt hàng 1688, Taobao về kho Trung Quốc',
    description:
      'Hướng dẫn ghi mã khách hàng và thông tin người nhận khi đặt hàng 1688, Taobao để kho Trung Quốc nhận đúng hàng và không bị thất lạc.',
    keyword: 'ghi mã khách hàng đặt hàng 1688',
    status: 'draft',
    updated: '2026-11-06',
    sections: [
      {
        heading: 'Vì sao mã khách hàng quan trọng?',
        paragraphs: [
          'Kho Trung Quốc nhận hàng của rất nhiều khách mỗi ngày. Mã khách hàng ghi trên kiện là cách để kho biết kiện đó thuộc về ai. Thiếu mã, kiện có thể phải chờ xác minh, làm chậm cả lô hàng.',
        ],
      },
      {
        heading: 'Các bước',
        paragraphs: ['Quy trình chung:'],
        list: [
          `Đăng ký khách hàng với VIP GROUP qua form trên website hoặc Zalo ${HOTLINE}.`,
          'Liên hệ hotline / Zalo để nhận địa chỉ kho nhận hàng và mẫu ghi thông tin người nhận.',
          'Khi đặt hàng, điền địa chỉ kho và ghi mã khách hàng theo đúng mẫu được hướng dẫn.',
          'Lưu lại mã vận đơn nội địa Trung Quốc của nhà cung cấp để đối chiếu và tra cứu.',
        ],
      },
      {
        heading: 'Lỗi thường gặp',
        paragraphs: ['Thiếu mã khách hàng, ghi sai số điện thoại kho, hoặc nhà cung cấp tự đổi đơn vị chuyển phát mà không báo mã vận đơn mới.'],
      },
    ],
    related: ['/logistics/quy-trinh-gui-hang/', '/logistics/kho-trung-quoc/'],
  },
  {
    slug: 'dong-goi-hang-gui-tu-trung-quoc',
    title: 'Đóng gói hàng gửi từ Trung Quốc về Việt Nam: lưu ý cho xưởng và chủ shop',
    description:
      'Lưu ý đóng gói hàng từ Trung Quốc về Việt Nam: hàng dễ vỡ, đồ gỗ nội thất, linh kiện, máy móc. Khi nào nên đóng gỗ, gia cố kiện hàng.',
    keyword: 'đóng gói hàng gửi từ Trung Quốc',
    status: 'draft',
    updated: '2026-11-06',
    sections: [
      {
        heading: 'Nguyên tắc chung',
        paragraphs: [
          'Kiện hàng sẽ được bốc xếp nhiều lần từ kho Trung Quốc, lên xe, qua cửa khẩu tới kho Việt Nam. Thùng chắc chắn, chèn chặt bên trong và ghi rõ mã khách hàng là ba điều cơ bản nhất.',
        ],
      },
      {
        heading: 'Theo loại hàng',
        paragraphs: ['Một số gợi ý theo nhóm hàng phổ biến:'],
        list: [
          'Hàng dễ vỡ (gốm sứ, kính, đèn): nên yêu cầu đóng gỗ hoặc gia cố.',
          'Phụ kiện, vật tư cho xưởng đồ gỗ: gom theo bộ, dán nhãn rõ để kiểm đếm.',
          'Linh kiện điện tử: chống ẩm, chống va đập, giữ nguyên bao bì nhà sản xuất.',
          'Máy móc: cố định trên pallet, có ảnh và thông số để chuẩn bị chứng từ.',
        ],
      },
      {
        heading: 'Trao đổi trước khi gửi',
        paragraphs: ['Với hàng giá trị cao hoặc cần đóng gỗ, hãy trao đổi trước để được báo phí đóng gói và phương án vận chuyển phù hợp.'],
      },
    ],
    related: ['/logistics/van-chuyen-trung-quoc-bac-ninh/', '/logistics/bang-gia/'],
  },
  {
    // NHÁP — cần owner/chuyên viên hải quan VIP GROUP duyệt và bổ sung kinh nghiệm thực tế (E-E-A-T)
    // trước khi xuất bản. Chỉ nêu quy tắc chung, không trích số hiệu văn bản chưa đối chiếu.
    slug: 'c-o-form-e-va-ma-hs-hang-tham-quyen',
    title: 'C/O Form E và mã HS khi nhập hàng từ Thâm Quyến, Quảng Đông',
    description:
      'C/O Form E là gì, khi nào được hưởng thuế ưu đãi ACFTA, lỗi thường gặp với C/O và cách xác định mã HS cho linh kiện, điện tử nhập từ Thâm Quyến.',
    keyword: 'C/O Form E hàng Trung Quốc; mã HS hàng điện tử Thâm Quyến',
    status: 'draft',
    updated: '2026-11-06',
    sections: [
      {
        heading: 'C/O Form E là gì?',
        paragraphs: [
          'C/O Form E (giấy chứng nhận xuất xứ mẫu E) là chứng từ xác nhận hàng hóa có xuất xứ Trung Quốc theo Hiệp định Thương mại hàng hóa ASEAN – Trung Quốc (ACFTA). Khi C/O hợp lệ và hàng đáp ứng quy tắc xuất xứ, doanh nghiệp Việt Nam được áp dụng thuế suất nhập khẩu ưu đãi đặc biệt ACFTA — thường thấp hơn đáng kể so với thuế suất ưu đãi thông thường (MFN).',
          'C/O Form E do cơ quan có thẩm quyền phía Trung Quốc cấp theo đề nghị của nhà xuất khẩu, vì vậy cần thỏa thuận với nhà cung cấp ngay từ khi đặt hàng.',
        ],
      },
      {
        heading: 'Khi nào nên yêu cầu nhà cung cấp làm C/O Form E?',
        paragraphs: ['Nên trao đổi trước khi chốt đơn nếu:'],
        list: [
          'Doanh nghiệp nhập khẩu chính ngạch, đứng tên trên tờ khai hải quan.',
          'Thuế suất MFN của mặt hàng cao hơn thuế suất ACFTA — chênh lệch càng lớn, C/O càng có giá trị.',
          'Lô hàng có giá trị đủ lớn để bù chi phí làm C/O phía Trung Quốc.',
        ],
      },
      {
        heading: 'Lỗi thường gặp làm C/O bị từ chối',
        paragraphs: ['Hải quan có thể không chấp nhận ưu đãi nếu C/O có sai lệch so với bộ chứng từ. Các lỗi hay gặp:'],
        list: [
          'Tên hàng, số lượng, trọng lượng trên C/O không khớp hóa đơn thương mại và tờ khai.',
          'Mã HS trên C/O khác mã HS khai báo ở cấp 6 số.',
          'Thông tin người nhập khẩu, số hóa đơn hoặc ngày hóa đơn ghi sai.',
          'Hàng không vận chuyển trực tiếp hoặc chứng từ chuyển tải không đầy đủ.',
        ],
      },
      {
        heading: 'Xác định mã HS cho hàng từ Thâm Quyến',
        paragraphs: [
          'Hàng nhập từ Thâm Quyến phần lớn là linh kiện, thiết bị điện tử và phụ kiện công nghệ — thường thuộc Chương 84 (máy móc, thiết bị cơ khí) và Chương 85 (máy, thiết bị điện, điện tử). Việt Nam dùng mã HS 8 số; 6 số đầu thống nhất theo hệ thống HS quốc tế.',
          'Cùng một sản phẩm có thể được xếp vào nhiều mã khác nhau tùy chức năng chính, cấu tạo và mức độ hoàn thiện (linh kiện rời hay thành phẩm). Chọn sai mã có thể dẫn tới sai thuế suất, thiếu giấy phép hoặc kiểm tra chuyên ngành, và bị truy thu thuế.',
        ],
        list: [
          'Chuẩn bị catalogue, thông số kỹ thuật, ảnh sản phẩm trước khi khai báo.',
          'Đối chiếu mã HS với nhà cung cấp để mã trên C/O và tờ khai thống nhất.',
          'Với mặt hàng mới hoặc dễ tranh chấp mã, cân nhắc đề nghị cơ quan hải quan xác định trước mã số.',
        ],
      },
      {
        heading: 'VIP GROUP hỗ trợ gì?',
        paragraphs: [
          'VIP GROUP hỗ trợ nhập khẩu chính ngạch và khai báo hải quan với bộ chứng từ phù hợp. Gửi thông tin mặt hàng, catalogue và hóa đơn dự kiến để được tư vấn mã HS, C/O và chi phí trước khi đặt hàng.',
        ],
      },
    ],
    related: ['/logistics/van-chuyen-tham-quyen-ve-viet-nam/', '/logistics/van-chuyen-trung-quoc-viet-nam/'],
  },
  // ── VIPG-WEB-024: 4 bài cụm Thâm Quyến (phiên ec soạn, nháp — cần chuyên môn duyệt: khoảng cách địa lý bài 1,
  //    nghĩa pháp lý 'tiểu ngạch' bài 2, phân luồng hải quan bài 3).

  {
    slug: 'tham-quyen-o-dau-nhap-hang-tham-quyen',
    title: 'Thâm Quyến ở đâu? Nguồn hàng điện tử và cách nhập về Việt Nam',
    description:
      'Thâm Quyến (深圳, Shenzhen) thuộc Quảng Đông, sát Hồng Kông — trung tâm điện tử, linh kiện của Trung Quốc. Các khu nguồn hàng chính và cách nhập về Việt Nam.',
    keyword: 'Thâm Quyến ở đâu; nhập hàng Thâm Quyến; Thẩm Quyến',
    status: 'draft',
    updated: '2026-11-06',
    sections: [
      {
        heading: 'Thâm Quyến ở đâu?',
        paragraphs: [
          'Thâm Quyến (深圳, Shenzhen; nhiều người viết nhầm là "Thẩm Quyến") là thành phố thuộc tỉnh Quảng Đông, miền Nam Trung Quốc, nằm sát Hồng Kông và cách Quảng Châu khoảng hơn 100 km về phía đông nam. Đây là một trong những trung tâm sản xuất điện tử, linh kiện và thiết bị công nghệ lớn nhất thế giới.',
          'Với người nhập hàng Việt Nam, Thâm Quyến là nguồn chính của linh kiện điện tử, phụ kiện điện thoại – máy tính, thiết bị thông minh, đèn LED và máy móc nhỏ.',
        ],
      },
      {
        heading: 'Các khu nguồn hàng thường gặp',
        paragraphs: ['Một số khu vực người mua hàng hay nhắc tới:'],
        list: [
          'Hoa Cường Bắc (华强北, Huaqiangbei) – quận Phúc Điền: khu chợ điện tử, linh kiện nổi tiếng, phù hợp tìm mẫu và hàng lẻ.',
          'Bảo An (宝安), Long Hoa (龙华), Long Cương (龙岗): nhiều nhà máy, xưởng sản xuất điện tử và thiết bị.',
          'Đông Quản (东莞) – thành phố liền kề phía bắc: nhiều nhà máy gia công, thường gom chung tuyến với hàng Thâm Quyến.',
          'Cảng Diêm Điền (盐田) và Xà Khẩu (蛇口): cảng biển lớn cho hàng đi container.',
        ],
      },
      {
        heading: 'Hàng từ Thâm Quyến về Việt Nam đi bằng cách nào?',
        paragraphs: [
          'Phổ biến nhất là đường bộ: hàng được gom tại kho phía Trung Quốc, đi xe tải về cửa khẩu biên giới phía Bắc (khu vực Lạng Sơn) rồi giao về Hà Nội, Bắc Ninh hoặc chuyển tiếp vào miền Nam. Lô lớn, không gấp có thể đi đường biển từ cảng Thâm Quyến về Hải Phòng hoặc TP.HCM.',
          'Về thủ tục, người mua chọn giữa ký gửi trọn gói (không kèm chứng từ nhập khẩu) và nhập khẩu chính ngạch (có tờ khai hải quan). Xem bài so sánh hai hình thức để chọn đúng.',
        ],
      },
      {
        heading: 'Kinh nghiệm khi mua hàng Thâm Quyến',
        paragraphs: ['Một vài lưu ý giúp lô hàng đi suôn sẻ:'],
        list: [
          'Xin catalogue, thông số kỹ thuật ngay từ đầu — vừa để kiểm tra hàng, vừa để xác định mã HS nếu nhập chính ngạch.',
          'Hàng điện tử có pin, nam châm, chất lỏng cần báo trước để chọn phương án vận chuyển phù hợp.',
          'Yêu cầu nhà cung cấp ghi đúng mã khách hàng trên từng kiện khi giao tới kho.',
          'Doanh nghiệp cần hóa đơn, chứng từ nên trao đổi C/O Form E với nhà cung cấp trước khi chốt đơn.',
        ],
      },
    ],
    related: ['/logistics/van-chuyen-tham-quyen-ve-viet-nam/', '/logistics/quy-trinh-gui-hang/'],
  },
  {
    slug: 'chinh-ngach-va-ky-gui-tron-goi-khac-nhau-the-nao',
    title: 'Nhập hàng Trung Quốc chính ngạch và ký gửi trọn gói: chọn thế nào?',
    description:
      'So sánh nhập khẩu chính ngạch và ký gửi trọn gói (thường gọi tiểu ngạch) khi nhập hàng Trung Quốc: chứng từ, thuế, rủi ro, đối tượng phù hợp.',
    keyword: 'chính ngạch và tiểu ngạch; nhập hàng chính ngạch Trung Quốc',
    status: 'draft',
    updated: '2026-11-06',
    sections: [
      {
        heading: 'Khác nhau ở điểm nào?',
        paragraphs: [
          'Nhập khẩu chính ngạch là doanh nghiệp đứng tên nhập khẩu, mở tờ khai hải quan, nộp thuế nhập khẩu và thuế GTGT khâu nhập khẩu, nhận đủ chứng từ hợp pháp cho lô hàng. Ký gửi trọn gói (thị trường hay gọi là "tiểu ngạch" hoặc "vận chuyển trọn gói") là đơn vị vận chuyển lo toàn bộ khâu đưa hàng về, người mua trả một mức cước gộp và không nhận tờ khai nhập khẩu đứng tên mình.',
          'Lưu ý: theo pháp luật, "tiểu ngạch" vốn chỉ hoạt động mua bán, trao đổi hàng hóa của cư dân biên giới; cách gọi trên thị trường rộng hơn nghĩa gốc này.',
        ],
      },
      {
        heading: 'So sánh nhanh',
        paragraphs: ['Các tiêu chí người nhập hàng hay cân nhắc:'],
        list: [
          'Chứng từ: chính ngạch có tờ khai hải quan, chứng từ nộp thuế, hóa đơn thương mại; ký gửi trọn gói thường chỉ có phiếu gửi / biên nhận của đơn vị vận chuyển.',
          'Thuế: chính ngạch nộp thuế theo mã HS và trị giá khai báo, được khấu trừ thuế GTGT đầu vào (doanh nghiệp kê khai thuế); ký gửi trọn gói gộp chi phí vào cước.',
          'Ưu đãi thuế: chỉ chính ngạch mới dùng được C/O Form E để hưởng thuế suất ACFTA.',
          'Thủ tục: ký gửi trọn gói đơn giản hơn cho người mua; chính ngạch cần chuẩn bị hồ sơ, có thể bị kiểm tra theo phân luồng hải quan.',
          'Rủi ro: hàng không có chứng từ chứng minh nguồn gốc có thể bị xử lý khi cơ quan chức năng kiểm tra trên đường hoặc tại cửa hàng.',
        ],
      },
      {
        heading: 'Nên chọn hình thức nào?',
        paragraphs: ['Gợi ý theo đối tượng:'],
        list: [
          'Doanh nghiệp, xưởng sản xuất cần hạch toán, khấu trừ thuế, bán hàng có hóa đơn: chọn chính ngạch.',
          'Hàng có giá trị cao, hàng cần kiểm tra chuyên ngành hoặc giấy phép: chọn chính ngạch.',
          'Chủ shop nhập đơn nhỏ, hàng mẫu, chưa cần chứng từ: cân nhắc ký gửi trọn gói và hỏi rõ phạm vi trách nhiệm của đơn vị vận chuyển.',
        ],
      },
      {
        heading: 'VIP GROUP hỗ trợ gì?',
        paragraphs: [
          'VIP GROUP hỗ trợ nhập khẩu chính ngạch và khai báo hải quan với bộ chứng từ phù hợp theo mặt hàng. Gửi thông tin hàng hóa để được tư vấn hình thức phù hợp trước khi đặt hàng.',
        ],
      },
    ],
    related: ['/logistics/van-chuyen-trung-quoc-viet-nam/', '/logistics/van-chuyen-tham-quyen-ve-viet-nam/'],
  },
  {
    slug: 'thu-tuc-hai-quan-nhap-khau-hang-trung-quoc-duong-bo',
    title: 'Thủ tục hải quan nhập khẩu hàng Trung Quốc đường bộ: các bước',
    description:
      'Các bước làm thủ tục hải quan khi nhập khẩu chính ngạch hàng Trung Quốc qua cửa khẩu đường bộ: chuẩn bị hồ sơ, khai tờ khai, phân luồng, nộp thuế, thông quan.',
    keyword: 'thủ tục hải quan nhập khẩu hàng Trung Quốc; thông quan cửa khẩu Lạng Sơn',
    status: 'draft',
    updated: '2026-11-06',
    sections: [
      {
        heading: 'Tóm tắt quy trình',
        paragraphs: [
          'Nhập khẩu chính ngạch hàng Trung Quốc qua cửa khẩu đường bộ gồm 5 bước chính: chuẩn bị bộ chứng từ, xác định mã HS và thuế, khai tờ khai hải quan điện tử, xử lý theo kết quả phân luồng (xanh / vàng / đỏ), nộp thuế và thông quan để đưa hàng về kho.',
        ],
      },
      {
        heading: 'Bước 1 – Chuẩn bị bộ chứng từ',
        paragraphs: ['Bộ hồ sơ cơ bản thường gồm:'],
        list: [
          'Hợp đồng mua bán (sales contract).',
          'Hóa đơn thương mại (commercial invoice) và phiếu đóng gói (packing list).',
          'Chứng từ vận tải.',
          'C/O Form E nếu muốn hưởng thuế ưu đãi ACFTA.',
          'Giấy phép, kết quả kiểm tra chuyên ngành nếu mặt hàng thuộc diện quản lý.',
        ],
      },
      {
        heading: 'Bước 2 – Xác định mã HS và thuế',
        paragraphs: [
          'Mã HS quyết định thuế suất nhập khẩu, thuế GTGT và việc hàng có cần giấy phép hay kiểm tra chuyên ngành hay không. Với hàng điện tử, linh kiện từ Thâm Quyến, nên xác định mã trước khi đặt hàng dựa trên catalogue và thông số kỹ thuật.',
        ],
      },
      {
        heading: 'Bước 3 – Khai tờ khai hải quan điện tử',
        paragraphs: [
          'Tờ khai được khai trên hệ thống thông quan điện tử của Hải quan Việt Nam (VNACCS/VCIS). Thông tin trên tờ khai phải khớp với hóa đơn, phiếu đóng gói và C/O.',
        ],
      },
      {
        heading: 'Bước 4 – Phân luồng',
        paragraphs: ['Hệ thống tự phân luồng tờ khai:'],
        list: [
          'Luồng xanh: miễn kiểm tra chi tiết hồ sơ và miễn kiểm tra thực tế hàng hóa.',
          'Luồng vàng: kiểm tra chi tiết hồ sơ, miễn kiểm tra thực tế hàng hóa.',
          'Luồng đỏ: kiểm tra chi tiết hồ sơ và kiểm tra thực tế hàng hóa.',
        ],
      },
      {
        heading: 'Bước 5 – Nộp thuế và thông quan',
        paragraphs: [
          'Sau khi nộp đủ thuế nhập khẩu, thuế GTGT khâu nhập khẩu (và thuế khác nếu có), tờ khai được thông quan; hàng được đưa ra khỏi khu vực cửa khẩu và vận chuyển về kho người nhận.',
          'Lô hàng bị chậm thường do chứng từ không khớp, khai sai mã HS hoặc thiếu giấy phép chuyên ngành — đều xử lý được nếu chuẩn bị trước khi hàng tới cửa khẩu.',
        ],
      },
    ],
    related: ['/logistics/van-chuyen-trung-quoc-viet-nam/', '/logistics/van-chuyen-tham-quyen-ve-viet-nam/'],
  },
  {
    slug: 'hang-dien-tu-co-pin-tu-trung-quoc',
    title: 'Gửi hàng điện tử có pin từ Trung Quốc về Việt Nam: lưu ý',
    description:
      'Lưu ý khi vận chuyển hàng điện tử có pin lithium, sạc dự phòng, thiết bị có nam châm từ Thâm Quyến về Việt Nam: đóng gói, khai báo, chọn hình thức.',
    keyword: 'gửi hàng có pin từ Trung Quốc; vận chuyển pin lithium Trung Quốc',
    status: 'draft',
    updated: '2026-11-06',
    sections: [
      {
        heading: 'Vì sao hàng có pin cần lưu ý riêng?',
        paragraphs: [
          'Pin lithium (trong sạc dự phòng, tai nghe, đồng hồ thông minh, đồ chơi điện tử…) có nguy cơ cháy nổ khi va đập, chập điện hoặc quá nhiệt, nên bị hạn chế chặt trên đường hàng không và cần đóng gói, khai báo đúng khi đi đường bộ hoặc đường biển. Đây là nhóm hàng rất phổ biến khi nhập từ Thâm Quyến.',
        ],
      },
      {
        heading: 'Cách đóng gói an toàn',
        paragraphs: ['Một số nguyên tắc chung:'],
        list: [
          'Giữ nguyên bao bì nhà sản xuất; mỗi thiết bị / pin được cách ly, không để các cực chạm nhau.',
          'Chèn chặt trong thùng carton cứng, không để xê dịch.',
          'Pin rời đóng riêng, ghi rõ trên kiện để kho bốc xếp cẩn thận.',
          'Không gửi pin phồng, pin hỏng hoặc hàng đã qua sử dụng không rõ tình trạng.',
        ],
      },
      {
        heading: 'Khai báo và chứng từ',
        paragraphs: [
          'Hãy báo trước cho đơn vị vận chuyển loại hàng, số lượng và thông số pin để được tư vấn phương án phù hợp. Với nhập khẩu chính ngạch, một số thiết bị điện, điện tử có thể thuộc diện kiểm tra chuyên ngành — cần xác định trước dựa trên mã HS và thông số kỹ thuật.',
        ],
      },
      {
        heading: 'Trao đổi trước khi đặt hàng',
        paragraphs: [
          'Gửi danh sách mặt hàng, ảnh và thông số cho VIP GROUP qua hotline / Zalo trước khi chốt đơn với nhà cung cấp để được tư vấn hình thức vận chuyển và thủ tục.',
        ],
      },
    ],
    related: ['/logistics/van-chuyen-tham-quyen-ve-viet-nam/', '/logistics/quy-trinh-gui-hang/'],
  },
];
