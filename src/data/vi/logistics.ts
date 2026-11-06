import type { Article, FaqItem, LogisticsPage, LogisticsProvider, PriceRow, Warehouse, Fact } from '../types';

/**
 * KHU LOGISTICS — VIPG-WEB-021.
 *
 * QUY TẮC NGUỒN (bắt buộc):
 * - Mọi dữ kiện về dịch vụ lấy từ nội dung VIPORDER đang công bố tại https://viporder.com.vn
 *   (đọc ngày 06/11/2026) hoặc từ dữ liệu owner đã chốt trong repo này.
 * - Chưa có nguồn → `value: null` (OWNER INPUT PENDING). Giao diện hiện "Đang cập nhật" + nút liên hệ.
 * - `sample` là dữ liệu MẪU chỉ hiện khi build `VIPG_DEMO=1`, luôn kèm nhãn MẪU. KHÔNG phải sự thật.
 * - Không ghi giá, thời gian giao, địa chỉ kho, cam kết bồi thường khi chưa có văn bản của owner.
 */

const SRC_VIPORDER = 'https://viporder.com.vn (nội dung công khai, đọc 06/11/2026)';

export const provider: LogisticsProvider = {
  name: 'VIPORDER',
  legalName: 'CÔNG TY TNHH XUẤT NHẬP KHẨU LOGISTICS VIP ORDER',
  url: 'https://viporder.com.vn',
  // Owner chốt 24/10/2026 (src/data/vi/subsidiaries.ts).
  relation: 'Cùng chủ sở hữu với VIP GROUP',
  // Owner đổi số Hotline/Zalo ngày 06/11/2026 (viporder.com.vn vẫn đang ghi số cũ 0968961962).
  hotline: '0961102655',
  zaloUrl: 'https://zalo.me/0961102655',
  officeAddress: {
    value: 'Số 62 Khu đô thị Nam Hồng, Đồng Nguyên, Bắc Ninh',
    source: SRC_VIPORDER,
  },
  trackingUrl: 'https://viporder.com.vn/#tracking',
  customerPortalUrl: 'https://khachhang.viporder.com.vn/login',
  registerUrl: 'https://viporder.com.vn/#register',
};

/** Dịch vụ VIPORDER đang công bố (nguồn: SRC_VIPORDER). */
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

/** Quy trình 4 bước VIPORDER công bố (nguồn: SRC_VIPORDER). */
export const processSteps = [
  { title: 'Đăng ký mã khách hàng', text: 'Đăng ký thông tin trên viporder.com.vn để nhận mã khách hàng riêng.' },
  { title: 'Gửi hàng', text: 'Dùng mã khách hàng khi gửi hàng hoặc đặt hàng từ Trung Quốc.' },
  { title: 'Theo dõi', text: 'Tra cứu mã vận đơn / mã bao hoặc đăng nhập hệ thống khách hàng để xem tình trạng.' },
  { title: 'Nhận hàng', text: 'Nhận hàng tại kho hoặc theo phương án giao hàng đã thỏa thuận.' },
];

const pending = (sample?: string): Fact => ({ value: null, source: null, sample });

export const warehouses: Warehouse[] = [
  {
    id: 'quang-chau',
    city: 'Quảng Châu',
    cityZh: '广州',
    address: pending('[MẪU] Số 00, đường Mẫu, quận Bạch Vân, Quảng Châu — KHÔNG PHẢI ĐỊA CHỈ THẬT'),
    receivingHours: pending('[MẪU] 09:00–18:00, thứ Hai – thứ Bảy'),
    receiver: pending('[MẪU] Tên người nhận + SĐT kho + mã khách hàng'),
    route: pending('[MẪU] Quảng Châu → cửa khẩu Lạng Sơn → Bắc Ninh'),
    transitTime: pending('[MẪU] 3–5 ngày làm việc'),
    goodsFit: ['Hàng thời trang, phụ kiện', 'Hàng gia dụng', 'Hàng đặt từ 1688 / Taobao giao về Quảng Châu'],
  },
  {
    id: 'tham-quyen',
    city: 'Thâm Quyến',
    cityZh: '深圳',
    address: pending('[MẪU] Số 00, đường Mẫu, quận Long Cương, Thâm Quyến — KHÔNG PHẢI ĐỊA CHỈ THẬT'),
    receivingHours: pending('[MẪU] 09:00–18:00, thứ Hai – thứ Bảy'),
    receiver: pending('[MẪU] Tên người nhận + SĐT kho + mã khách hàng'),
    route: pending('[MẪU] Thâm Quyến → cửa khẩu Lạng Sơn → Bắc Ninh'),
    transitTime: pending('[MẪU] 4–6 ngày làm việc'),
    goodsFit: ['Linh kiện, thiết bị điện tử', 'Phụ kiện công nghệ', 'Hàng từ nhà cung cấp khu vực Thâm Quyến'],
  },
];

/** Hệ số quy đổi cân nặng thể tích (cm³ / kg) mà VIPORDER áp dụng — chưa được owner cung cấp. */
export const volumetricDivisor: Fact<number> = { value: null, source: null, sample: 6000 };

/** Bảng giá — chưa có văn bản của owner. Production: không hiện bảng. */
export const priceTable: Fact<PriceRow[]> = {
  value: null,
  source: null,
  sample: [
    { route: '[MẪU] Quảng Châu → Bắc Ninh', unit: 'kg', price: '[MẪU] 00.000 đ', transit: '[MẪU] 3–5 ngày' },
    { route: '[MẪU] Quảng Châu → Bắc Ninh', unit: 'm³', price: '[MẪU] 0.000.000 đ', transit: '[MẪU] 4–6 ngày' },
    { route: '[MẪU] Thâm Quyến → Bắc Ninh', unit: 'kg', price: '[MẪU] 00.000 đ', transit: '[MẪU] 4–6 ngày' },
    { route: '[MẪU] Thâm Quyến → Bắc Ninh', unit: 'm³', price: '[MẪU] 0.000.000 đ', transit: '[MẪU] 5–7 ngày' },
  ],
};

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
    q: 'VIP GROUP và VIPORDER có quan hệ thế nào?',
    a: 'VIPORDER (CÔNG TY TNHH XUẤT NHẬP KHẨU LOGISTICS VIP ORDER) là công ty cùng chủ sở hữu với VIP GROUP, trực tiếp vận hành dịch vụ vận chuyển, nhập khẩu và hải quan Trung Quốc – Việt Nam.',
  },
  {
    q: 'Muốn gửi hàng từ Trung Quốc về thì bắt đầu từ đâu?',
    a: 'Đăng ký mã khách hàng trên viporder.com.vn, sau đó dùng mã này khi gửi hàng hoặc đặt hàng. Nếu chưa rõ nên gửi về kho nào, gọi hoặc nhắn Zalo 0961 102 655 để được hướng dẫn.',
  },
  {
    q: 'Tra cứu tình trạng hàng ở đâu?',
    a: 'Tra cứu theo mã vận đơn hoặc mã bao tại mục Tra cứu vận đơn trên viporder.com.vn, không cần đăng nhập. Khách hàng hiện tại có thể đăng nhập khachhang.viporder.com.vn để xem đơn và kiện hàng.',
  },
  {
    q: 'Có hỗ trợ đặt hàng 1688, Taobao, Pinduoduo không?',
    a: 'Có. VIPORDER hỗ trợ khách tìm nguồn và đặt hàng từ các nền tảng 1688, Taobao, Pinduoduo, sau đó vận chuyển về Việt Nam.',
  },
  {
    q: 'Doanh nghiệp cần nhập khẩu chính ngạch thì làm thế nào?',
    a: 'VIPORDER hỗ trợ nhập khẩu chính ngạch và khai báo hải quan với bộ chứng từ phù hợp. Hồ sơ cụ thể phụ thuộc mặt hàng — vui lòng gửi thông tin hàng để được tư vấn.',
  },
  {
    q: 'Gửi hàng về địa chỉ nào tại Trung Quốc?',
    a: 'Địa chỉ nhận hàng tại Trung Quốc và cách ghi thông tin người nhận đang được cập nhật trên website. Vui lòng liên hệ hotline / Zalo 0961 102 655 để được hướng dẫn.',
    pending: true,
  },
  {
    q: 'Cước vận chuyển tính theo cân nặng hay theo khối?',
    a: 'Thông thường cước được tính theo cân nặng thực hoặc theo thể tích / cân nặng quy đổi, áp dụng giá trị lớn hơn. Hệ số quy đổi và đơn giá cụ thể sẽ được báo theo từng lô hàng.',
    pending: true,
  },
  {
    q: 'Hàng về Bắc Ninh mất bao lâu?',
    a: 'Thời gian phụ thuộc kho xuất phát, loại hàng và thủ tục. Thời gian cụ thể đang được cập nhật — vui lòng liên hệ để được báo theo lô hàng.',
    pending: true,
  },
  {
    q: 'Nhận hàng tại Việt Nam như thế nào?',
    a: 'Khách nhận hàng tại kho hoặc theo phương án giao hàng đã thỏa thuận khi báo giá. Văn phòng VIPORDER công bố tại Số 62 Khu đô thị Nam Hồng, Đồng Nguyên, Bắc Ninh.',
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
      'Logistics VIP GROUP: nhận hàng tại Trung Quốc, vận chuyển về Việt Nam, nhập khẩu chính ngạch, khai báo hải quan, đặt hàng 1688. Do VIPORDER vận hành.',
    h1: 'Logistics Trung Quốc – Việt Nam',
    lead: 'Nhận hàng tại Trung Quốc, vận chuyển về Việt Nam, hỗ trợ nhập khẩu chính ngạch và khai báo hải quan — văn phòng đơn vị vận hành đặt tại Bắc Ninh.',
    status: 'ready',
    keyword: 'logistics Trung Việt VIP GROUP (thương hiệu + tổng quan)',
  },
  {
    key: 'bac-ninh',
    href: '/logistics/van-chuyen-trung-quoc-bac-ninh/',
    nav: 'Về Bắc Ninh',
    title: 'Vận chuyển hàng Trung Quốc về Bắc Ninh, Từ Sơn',
    description:
      'Vận chuyển hàng Trung Quốc về Bắc Ninh, Từ Sơn, Đồng Kỵ và khu công nghiệp. Văn phòng VIPORDER tại Đồng Nguyên, Bắc Ninh. Gọi/Zalo 0961 102 655.',
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
  {
    key: 'quang-chau',
    href: '/logistics/kho-quang-chau/',
    nav: 'Kho Quảng Châu',
    title: 'Kho Quảng Châu – vận chuyển Quảng Châu về Việt Nam',
    description:
      'Kho nhận hàng Quảng Châu (广州) gom hàng về Bắc Ninh và Việt Nam. Liên hệ để nhận địa chỉ kho, hướng dẫn ghi mã khách hàng và báo giá.',
    h1: 'Kho Quảng Châu — nhận và gom hàng về Việt Nam',
    lead: 'Phù hợp với hàng đặt từ nhà cung cấp và chợ đầu mối khu vực Quảng Châu, hàng mua trên 1688 / Taobao giao về kho Quảng Châu.',
    // DRAFT (verifier P0-1): chưa có bằng chứng VIPORDER có kho tại Quảng Châu → không xuất bản.
    status: 'draft',
    pendingReason: 'Chưa có xác nhận kho Quảng Châu tồn tại + địa chỉ, giờ nhận hàng, người nhận, tuyến, thời gian vận chuyển.',
    keyword: 'kho Quảng Châu, vận chuyển hàng Quảng Châu về Việt Nam',
  },
  {
    key: 'tham-quyen',
    href: '/logistics/kho-tham-quyen/',
    nav: 'Kho Thâm Quyến',
    title: 'Kho Thâm Quyến – vận chuyển Thâm Quyến về Việt Nam',
    description:
      'Kho nhận hàng Thâm Quyến (深圳) cho hàng điện tử, linh kiện, phụ kiện về Bắc Ninh và Việt Nam. Liên hệ để nhận địa chỉ kho và báo giá.',
    h1: 'Kho Thâm Quyến — vận chuyển Thâm Quyến về Việt Nam',
    lead: 'Phù hợp với linh kiện, thiết bị điện tử và hàng từ nhà cung cấp khu vực Thâm Quyến.',
    // DRAFT (verifier P0-1): chưa có bằng chứng VIPORDER có kho tại Thâm Quyến → không xuất bản.
    status: 'draft',
    pendingReason: 'Chưa có xác nhận kho Thâm Quyến tồn tại + địa chỉ, giờ nhận hàng, người nhận, tuyến, thời gian vận chuyển.',
    keyword: 'vận chuyển Thâm Quyến Việt Nam',
  },
  {
    key: 'quy-trinh',
    href: '/logistics/quy-trinh-gui-hang/',
    nav: 'Quy trình',
    title: 'Quy trình gửi hàng từ Trung Quốc về Việt Nam',
    description:
      'Bốn bước gửi hàng Trung Quốc về Việt Nam cùng VIPORDER: đăng ký mã khách hàng, gửi hàng, theo dõi vận đơn và nhận hàng. Kèm lưu ý đóng gói.',
    h1: 'Quy trình gửi hàng từ Trung Quốc về Việt Nam',
    lead: 'Bốn bước từ lúc đăng ký mã khách hàng tới lúc nhận hàng, kèm những lưu ý giúp lô hàng đi nhanh và đúng.',
    status: 'ready',
    keyword: 'quy trình gửi hàng Trung Quốc về Việt Nam',
  },
  {
    key: 'bang-gia',
    href: '/logistics/bang-gia/',
    nav: 'Bảng giá & báo giá',
    title: 'Bảng giá vận chuyển Trung Quốc – Việt Nam, báo giá',
    description:
      'Yêu cầu báo giá vận chuyển hàng Trung Quốc về Bắc Ninh, Việt Nam theo cân nặng, số khối, loại hàng. Công cụ tính số khối và cân nặng quy đổi.',
    h1: 'Bảng giá và yêu cầu báo giá',
    lead: 'Cước được báo theo từng lô hàng. Gửi thông tin hàng để nhận báo giá, hoặc dùng công cụ tính số khối để chuẩn bị trước.',
    status: 'pending',
    pendingReason: 'Chưa có bảng giá, hệ số quy đổi cân nặng và thời gian vận chuyển do owner xác nhận bằng văn bản.',
    keyword: 'bảng giá vận chuyển Trung Quốc Việt Nam',
  },
  {
    key: 'tra-cuu',
    href: '/logistics/tra-cuu-van-don/',
    nav: 'Tra cứu vận đơn',
    title: 'Tra cứu vận đơn hàng Trung Quốc – VIPORDER',
    description:
      'Tra cứu hành trình hàng Trung Quốc về Việt Nam theo mã vận đơn hoặc mã bao trên hệ thống VIPORDER, không cần đăng nhập.',
    h1: 'Tra cứu vận đơn',
    lead: 'Tra cứu được thực hiện trên hệ thống chính thức của VIPORDER — đơn vị trực tiếp vận hành dịch vụ.',
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
    title: 'Liên hệ Logistics – văn phòng Bắc Ninh, Hotline/Zalo',
    description:
      'Liên hệ dịch vụ vận chuyển Trung Quốc – Việt Nam: Hotline/Zalo 0961 102 655, văn phòng VIPORDER tại Đồng Nguyên, Bắc Ninh. Khu vực phục vụ.',
    h1: 'Liên hệ và khu vực phục vụ',
    lead: 'Gọi điện, nhắn Zalo hoặc gửi yêu cầu báo giá — đội ngũ VIPORDER sẽ liên hệ lại.',
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
          'Hệ số quy đổi VIPORDER áp dụng sẽ được ghi rõ trong báo giá cho từng lô hàng.',
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
          'Đăng ký mã khách hàng VIPORDER trên viporder.com.vn.',
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
    related: ['/logistics/quy-trinh-gui-hang/', '/logistics/kho-quang-chau/'],
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
];
