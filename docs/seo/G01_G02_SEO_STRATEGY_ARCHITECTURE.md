# G01 + G02 — CHIẾN LƯỢC SEO & KIẾN TRÚC KHU LOGISTICS (VIPG-WEB-021)

Dữ liệu nghiên cứu chi tiết (từ khóa, SERP quan sát được, 12 đối thủ, 20 ý tưởng bài, 26 câu hỏi FAQ):
`docs/seo/G01_KEYWORD_COMPETITOR_RESEARCH.md`.

> **Mọi mức ưu tiên từ khóa là GIẢ THUYẾT.** Chưa có quyền Google Keyword Planner / Search Console / Ahrefs; không có số volume nào trong tài liệu này. Xác minh lại sau 4–6 tuần có dữ liệu Search Console.

## 1. Định vị

- **vipgroup.com.vn** là website tập đoàn — giữ nguyên trang chủ, giới thiệu, lĩnh vực, thành viên. Logistics chỉ là **một khu riêng `/logistics/`**, vào từ 1 mục menu + 1 link trên thẻ lĩnh vực "Xuất nhập khẩu – Hải quan – Logistics". Trang chủ không có CTA bán hàng logistics.
- Mọi trang logistics ghi rõ **đơn vị vận hành là VIPORDER** (công ty cùng chủ sở hữu) — đúng pháp lý, tránh hiểu nhầm VIP GROUP là bên cung cấp dịch vụ / bên ký hợp đồng.
- Lợi thế thật để khai thác: **văn phòng thật tại Đồng Nguyên, Bắc Ninh** (cạnh Từ Sơn, Đồng Kỵ) — trong khi đối thủ viết về Bắc Ninh đều là đơn vị ở nơi khác; Từ Sơn/Đồng Kỵ gần như không có nội dung logistics chuyên biệt (quan sát SERP, xem file nghiên cứu §5).

## 2. Nhóm từ khóa → URL (một cụm chính = một URL)

| # | Cụm chính (giả thuyết ưu tiên) | Ý định | URL sở hữu | Trạng thái trang |
|---|---|---|---|---|
| 1 | vận chuyển hàng Trung Quốc về Bắc Ninh / Từ Sơn / Đồng Kỵ (Cao) | Địa phương + giao dịch | `/logistics/van-chuyen-trung-quoc-bac-ninh/` (Từ Sơn–Đồng Kỵ là H2 `#tu-son-dong-ky`, **không** làm trang riêng) | ready |
| 2 | vận chuyển hàng Trung Quốc về Việt Nam, vận chuyển Trung Việt (Cao) | Giao dịch | `/logistics/van-chuyen-trung-quoc-viet-nam/` | ready |
| 3 | logistics Trung – Việt VIP GROUP (thương hiệu) | Điều hướng | `/logistics/` | ready |
| 4 | kho Quảng Châu, vận chuyển Quảng Châu về Việt Nam / Bắc Ninh (Cao) | Giao dịch | `/logistics/kho-quang-chau/` | **draft** – chưa xác nhận kho có thật (không build ở production) |
| 5 | kho Thâm Quyến, vận chuyển Thâm Quyến về Việt Nam (TB–Cao) | Giao dịch | `/logistics/kho-tham-quyen/` | **draft** – chưa xác nhận kho có thật (không build ở production) |
| 6 | bảng giá / cước vận chuyển Trung Việt (Cao) | Giao dịch | `/logistics/bang-gia/` | **pending** – thiếu bảng giá |
| 7 | quy trình gửi hàng Trung Quốc về Việt Nam (TB) | Thông tin | `/logistics/quy-trinh-gui-hang/` | ready |
| 8 | tra cứu vận đơn VIPORDER / mã vận đơn (TB) | Điều hướng | `/logistics/tra-cuu-van-don/` → dẫn sang hệ thống thật | ready |
| 9 | câu hỏi gửi hàng Trung Quốc (TB) | Thông tin | `/logistics/cau-hoi-thuong-gap/` | ready |
| 10 | liên hệ / địa chỉ / khu vực phục vụ | Điều hướng + địa phương | `/logistics/lien-he/` | ready |
| 11 | cách tính số khối, cân nặng quy đổi (Cao, thông tin) | Thông tin | `/logistics/kien-thuc/cach-tinh-so-khoi-va-can-nang-quy-doi/` | draft |
| 12 | ghi mã khách hàng khi đặt 1688 / Taobao | Thông tin | `/logistics/kien-thuc/ghi-ma-khach-hang-khi-dat-hang-1688-taobao/` | draft |
| 13 | đóng gói hàng gửi từ Trung Quốc | Thông tin | `/logistics/kien-thuc/dong-goi-hang-gui-tu-trung-quoc/` | draft |

Quy tắc chống cannibalization (đã áp dụng + có test `chống trùng lặp` kiểm title/description/H1 toàn site):
- Hub `/logistics/` nhắm cụm thương hiệu "Logistics Trung – Việt", **không** đặt "vận chuyển hàng Trung Quốc về Việt Nam" vào title/H1 (cụm đó thuộc trang #2) — hub chỉ link về bằng anchor đúng cụm.
- Trang kho không nhắm "Bắc Ninh"; trang Bắc Ninh không nhắm "Hà Nội". Bảng giá là nơi duy nhất có "bảng giá" trong title; bài số khối không dùng chữ "bảng giá".
- **Giữa hai domain**: đề xuất vipgroup.com.vn/logistics sở hữu cụm vận chuyển/kho/Bắc Ninh/kiến thức; viporder.com.vn sở hữu cụm order/đặt hàng hộ + đăng ký + tra cứu (công cụ tra cứu thật chỉ có ở VIPORDER — trang tra cứu của vipgroup chỉ dẫn sang). → **Quyết định của owner** (xem G08).

## 3. Kiến trúc URL (G02)

```
/                                   (tập đoàn — giữ nguyên)
/linh-vuc-hoat-dong/ …              (tập đoàn — giữ nguyên)
/logistics/                         Hub Logistics
├── van-chuyen-trung-quoc-bac-ninh/  #tu-son-dong-ky
├── van-chuyen-trung-quoc-viet-nam/
├── kho-quang-chau/
├── kho-tham-quyen/
├── quy-trinh-gui-hang/
├── bang-gia/                        #bao-gia (form)
├── tra-cuu-van-don/                 → viporder.com.vn/#tracking
├── cau-hoi-thuong-gap/
├── lien-he/
└── kien-thuc/                       mục lục + bài (/kien-thuc/<slug>/)
```

- URL tiếng Việt không dấu, cố định, trailing slash (đồng bộ `trailingSlash: 'always'` của site).
- **Mở rộng tỉnh** (Hà Nội, Bắc Giang, Hải Dương…): KHÔNG nhân bản trang theo tên tỉnh. Chỉ tạo trang khu vực mới khi có (a) dữ liệu Search Console cho thấy nhu cầu, và (b) nội dung khác biệt thật (điểm nhận/giao thật, lịch xe thật, case study địa phương). Trước đó: liệt kê khu vực trên `/logistics/lien-he/`.
- **Kho mới** (ví dụ Bằng Tường): chỉ tạo `/logistics/kho-<ten>/` khi có kho thật; trước đó chỉ là bài giải thích trong `/kien-thuc/`.

### Cơ chế xuất bản an toàn (đã cài trong mã)

| Trạng thái | Production build (`npm run build` → `dist/`) | DEMO build (`npm run build:demo` → `dist-demo/`) |
|---|---|---|
| `ready` | Build, index, vào sitemap | Build, noindex |
| `pending` | Build, **noindex**, không sitemap; trường thiếu hiện "Đang cập nhật — liên hệ hotline/Zalo" | Build + dữ liệu MẪU có nhãn |
| `draft` | **Không build** (không URL, không link) | Build, nhãn "NHÁP — CHỜ DUYỆT" |

Dữ liệu ở `src/data/vi/logistics.ts`: mỗi dữ kiện là `Fact { value, source, sample }`. Owner cung cấp dữ liệu → điền `value` + `source` → đổi `status` sang `ready` → test tự kiểm lại.

### SEO on-page đã triển khai
Title/description riêng (test ≤70 ký tự / 50–170 ký tự), 1 H1/trang, H2/H3 theo cấu trúc, breadcrumb hiển thị + `BreadcrumbList`, menu phụ khu Logistics, link ngữ cảnh giữa các trang, `Service` (provider = VIPORDER, `areaServed` chỉ khu vực có căn cứ, **không** `offers`/`aggregateRating`), `FAQPage` (chỉ câu đã có căn cứ), `HowTo` (quy trình), `Article` (bài viết). Organization VIP GROUP giữ nguyên trên mọi trang.

## 4. Lộ trình 90 ngày (từ ngày owner duyệt phát hành)

| Tuần | Việc | Điều kiện |
|---|---|---|
| 0 | Owner nghiệm thu, merge → staging → production. Gửi sitemap trong Search Console; yêu cầu lập chỉ mục 7 trang ready | Owner duyệt (G08) |
| 1–2 | Owner gửi địa chỉ kho QC/TQ + mẫu ghi người nhận → 2 trang kho `ready`. Lập Google Business Profile (G04) | OWNER INPUT |
| 2–4 | Bảng giá (dù chỉ khung giá "từ…" + ngày cập nhật) + hệ số quy đổi → `/bang-gia/` `ready`. Duyệt 3 bài nháp → xuất bản | OWNER INPUT |
| 3–6 | 4 bài ưu tiên cao: nhập khẩu chính ngạch, hàng nguyên container vs LCL, xưởng gỗ Đồng Kỵ nhập phụ kiện, vận chuyển hàng 1688 (xem G05) | Chuyên môn VIPORDER duyệt |
| 5–8 | Case study thật Quảng Châu → Từ Sơn (có đồng ý của khách); ảnh thật kho/văn phòng (alt text, WebP) | Ảnh + đồng ý KH |
| 6–10 | Gắn GA4 + sự kiện (G06); đọc Search Console: truy vấn có hiển thị nhưng CTR thấp → tối ưu title/description | GA4 ID |
| 8–12 | Đánh giá: cụm nào có hiển thị → bổ sung nội dung; xin đánh giá Google từ khách thật (G04) | Dữ liệu thật |

## 5. Chiến lược 12 tháng

1. **Q1 (tháng 1–3):** Bắc Ninh + 2 kho + bảng giá + 7–10 bài. Mục tiêu: lập chỉ mục đủ, có hiển thị cho cụm Bắc Ninh/Từ Sơn.
2. **Q2:** Mở rộng theo dữ liệu — nếu Search Console cho thấy truy vấn "Hà Nội", "Bắc Giang"… có hiển thị, viết nội dung khu vực khác biệt thật; thêm bài chuyên môn hải quan/chính ngạch (do người có chuyên môn duyệt, ghi văn bản pháp luật + ngày cập nhật).
3. **Q3:** Công cụ: công cụ tính cước (khi có bảng giá thật), trang tuyến cụ thể nếu có lịch xe thật; liên kết từ báo chí/hiệp hội ngành (đồ gỗ Đồng Kỵ, KCN) — **không mua backlink**.
4. **Q4:** Toàn quốc chỉ khi có năng lực giao thật; tối ưu chuyển đổi theo dữ liệu GA4/CRM; xem lại phân chia cụm giữa 2 domain.

## 6. KPI (đo được, không hứa thứ hạng)

| KPI | Nguồn đo | Mốc 90 ngày (giả thuyết, điều chỉnh sau tháng 1) |
|---|---|---|
| Trang ready được lập chỉ mục | Search Console → Trang | 100% trang ready |
| Số truy vấn có hiển thị chứa "Bắc Ninh"/"Từ Sơn"/"Đồng Kỵ" | Search Console → Hiệu suất | Có hiển thị cho cả 3 nhóm |
| Lượt nhấp tự nhiên vào /logistics/* | Search Console | Tăng theo tháng |
| Sự kiện `call_click`, `zalo_click`, `quote_generate`, `quote_send_*` | GA4 | Đo baseline tháng 1, tăng tháng 2–3 |
| Lead đủ điều kiện / khách gửi hàng lần đầu | CRM / VIPORDER | Đo baseline (cần owner nối dữ liệu) |
| Số đánh giá Google thật trên GBP | GBP | Theo kế hoạch G04 |
