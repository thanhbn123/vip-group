# P2 — NỘI DUNG, ĐO LƯỜNG VÀ MỞ RỘNG (SEO V1.1 / V1.2)

Ngày 06/11/2026. Ưu tiên là **giả thuyết** (chưa có dữ liệu Search Console / Keyword Planner) — nguồn: `G01_KEYWORD_COMPETITOR_RESEARCH.md`. Đo lại sau 4–6 tuần có dữ liệu thật.

## 1. 10 bài SEO ưu tiên

| # | Bài (slug `/logistics/kien-thuc/…/`) | Cụm từ khóa | Trạng thái | Cần trước khi xuất bản |
|---|---|---|---|---|
| 1 | `cach-tinh-so-khoi-va-can-nang-quy-doi` | cách tính số khối, cân nặng quy đổi | NHÁP — có thể duyệt ngay | Hệ số 6000 đã được owner xác nhận → bổ sung vào bài |
| 2 | `chinh-ngach-va-ky-gui-tron-goi-khac-nhau-the-nao` | chính ngạch và tiểu ngạch | NHÁP | Chuyên viên hải quan duyệt câu về nghĩa gốc "tiểu ngạch" |
| 3 | `thu-tuc-hai-quan-nhap-khau-hang-trung-quoc-duong-bo` | thủ tục hải quan nhập khẩu hàng Trung Quốc | NHÁP | Chuyên viên hải quan duyệt phần phân luồng |
| 4 | `tham-quyen-o-dau-nhap-hang-tham-quyen` | Thâm Quyến ở đâu, nhập hàng Thâm Quyến | NHÁP | Kiểm số liệu khoảng cách Quảng Châu – Thâm Quyến |
| 5 | `c-o-form-e-va-ma-hs-hang-tham-quyen` | C/O Form E, mã HS | NHÁP | Chuyên viên duyệt |
| 6 | `hang-dien-tu-co-pin-tu-trung-quoc` | gửi hàng có pin từ Trung Quốc | NHÁP | VIPORDER xác nhận chính sách nhận hàng có pin |
| 7 | `ghi-ma-khach-hang-khi-dat-hang-1688-taobao` | ghi mã khách hàng 1688 | NHÁP | Mẫu ghi người nhận thật |
| 8 | `dong-goi-hang-gui-tu-trung-quoc` | đóng gói hàng gửi từ Trung Quốc | NHÁP | Có/không dịch vụ đóng gỗ, phí |
| 9 | `nhap-phu-kien-noi-that-cho-xuong-go-dong-ky` *(chưa viết)* | nhập phụ kiện nội thất Đồng Kỵ | CHƯA VIẾT | 1 ví dụ lô hàng thật (ẩn danh) — khoảng trống lớn nhất trên SERP |
| 10 | `case-study-tham-quyen-ve-bac-ninh` *(chưa viết)* | vận chuyển Thâm Quyến về Bắc Ninh | CHƯA VIẾT | Lô hàng thật + **đồng ý bằng văn bản của khách** |

Quy trình: nháp (`status: 'draft'`, chỉ hiện ở bản DEMO) → đối chiếu nguồn → owner/chuyên môn duyệt → `ready` → `npm test` → PR. Không xuất bản bài có số liệu chưa kiểm chứng.

## 2. Chuẩn bị GA4 và Google Search Console

**Đã có trong mã (chạy ngay khi phát hành, không cần ID):** lớp sự kiện `window.dataLayer` trên **mọi trang**, không tải script ngoài, không chứa họ tên/SĐT/email:
`call_click`, `zalo_click`, `quote_cta_click`, `lead_submit` (kèm `need`, `route`), `register_click`, `tracking_click`, `portal_login_click`, `provider_site_click`, `email_click`.

**Owner cần:**
1. **Search Console:** DNS `vipgroup.com.vn` đã có bản ghi `google-site-verification` → có thể property Domain đã được xác minh. Owner kiểm tại search.google.com/search-console; nếu đúng: cấp quyền "Đầy đủ" cho tài khoản vận hành, gửi `https://www.vipgroup.com.vn/sitemap.xml` sau khi phát hành. Quy trình chi tiết + theo dõi AI Overview/Gemini: `G10_GSC_AI_SEARCH_MONITORING.md`.
2. **GA4:** tạo property, gửi Measurement ID `G-…`. Khi có ID, đội phát triển nạp gtag + mở CSP cho `googletagmanager.com` / `google-analytics.com` (PR riêng, cần duyệt), đánh dấu sự kiện chính: `lead_submit`, `call_click`, `zalo_click`.

## 3. Theo dõi nguồn khách từ website về VIP GROUP CRM

Luồng **đã xây** (PR thu lead, chờ phát hành):

```
Khách vào web (utm_source/medium/campaign hoặc trang giới thiệu)
 → form: ghi utm + trang gửi + tuyến + nhu cầu
 → /api/lead (Turnstile) → Google Sheet (sổ gốc, mã VG-YYYYMMDD-xxxxxx)
 → Apps Script ký HMAC → CRM V5 POST /api/intake/leads (tenant VIP, đã chạy staging HTTPS)
 → CRM: lead (mới → đã liên hệ → báo giá → thành khách / huỷ), gợi ý trùng theo SĐT
```

Đo được trong CRM: lead theo nguồn/trang/tuyến → tỉ lệ thành khách. **Chưa đo:** "khách gửi hàng lần đầu / phát sinh đơn / quay lại" — cần nối đơn hàng (hệ thống VIPORDER) với lead theo SĐT hoặc mã khách; owner quyết định có cho CRM đọc dữ liệu đơn VIPORDER hay không. Thử nghiệm **không** ghi vào CRM production (chỉ staging, lead thử đã chuyển "huỷ").

Đề xuất (cần duyệt, chưa làm): link "Đăng ký mã khách hàng" sang viporder.com.vn gắn `?utm_source=vipgroup&utm_medium=referral` để VIPORDER ghi nhận nguồn.

## 4. Mở rộng SEO từ Bắc Ninh ra toàn quốc

| Giai đoạn | Điều kiện mở | Việc làm |
|---|---|---|
| 1 (hiện tại) | — | Bắc Ninh / Từ Sơn / Đồng Kỵ + tuyến Thâm Quyến + bảng giá + FAQ |
| 2 | Search Console có hiển thị cho truy vấn tỉnh lân cận (Hà Nội, Bắc Giang, Hưng Yên, Hải Dương) **và** owner xác nhận giao tận nơi tỉnh đó | 1 trang khu vực / tỉnh có nội dung khác biệt thật: điểm nhận/giao, thời gian thật, case study địa phương |
| 3 | Thêm điểm nhận hàng Trung Quốc được xác nhận (Quảng Châu, Hạ Môn, Nghĩa Ô — đang làm ở V2) | Trang mạng lưới điểm nhận + trang tuyến từng điểm |
| 4 | Năng lực giao toàn quốc được xác nhận | Trang "giao toàn quốc" + trang miền (Bắc / Trung / Nam), không nhân bản theo 63 tỉnh |

Nguyên tắc: **không** tạo hàng loạt trang chỉ đổi tên tỉnh (rủi ro bị Google đánh giá nội dung mỏng/trùng lặp); không mua backlink, không đánh giá giả.
