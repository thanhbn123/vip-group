# G06 — ĐO LƯỜNG & THEO DÕI KHÁCH HÀNG TIỀM NĂNG

## 1. Đã triển khai (trong mã, chạy được ngay, không cần ID)

`src/components/logistics/TrackEvents.astro` đẩy sự kiện vào `window.dataLayer`. **Không tải GA4/GTM, không gọi domain ngoài** (E2E xác nhận 0 request ra ngoài). Sự kiện **không chứa họ tên/SĐT/email** (E2E + test xác nhận).

| Sự kiện | Khi nào | Tham số |
|---|---|---|
| `call_click` | Bấm số hotline (hero, CTA, thanh mobile, trang kho/Bắc Ninh/liên hệ) | `link_location`, `route`, `page_path` |
| `zalo_click` | Bấm Zalo | như trên |
| `quote_cta_click` | Bấm "Yêu cầu báo giá" / "Báo giá" | như trên |
| `route_select` | Chọn kho trong form báo giá | `route` = `quang-chau` / `tham-quyen` / `khac` / `chua-ro` |
| `quote_form_start` | Bắt đầu nhập form | — |
| `quote_generate` | Tạo nội dung yêu cầu hợp lệ | `route`, `service` |
| `quote_send_zalo` / `quote_send_email` | Khách gửi yêu cầu qua Zalo / email | `route` |
| `register_click` | Đăng ký mã khách hàng (sang viporder.com.vn) | `link_location`, `route` |
| `tracking_click`, `portal_login_click` | Tra cứu vận đơn / đăng nhập cổng KH | `link_location` |
| `provider_site_click`, `email_click` | Sang website VIPORDER / bấm email | `link_location` |

## 2. Việc owner làm để bật GA4 (OWNER ACTION)

1. Tạo GA4 property (múi giờ Việt Nam, VND) → Web stream `https://www.vipgroup.com.vn` → gửi **Measurement ID `G-…`**.
2. Đội phát triển: nạp `gtag.js` trong `BaseLayout.astro` + mở CSP `script-src`/`connect-src` cho `https://www.googletagmanager.com` và `https://*.google-analytics.com`; thêm banner đồng ý cookie nếu owner yêu cầu tuân thủ Nghị định 13/2023 về dữ liệu cá nhân (khuyến nghị: Consent Mode, mặc định từ chối quảng cáo).
3. Trong GA4: đánh dấu **sự kiện chính (key events)**: `quote_send_zalo`, `quote_send_email`, `call_click`, `zalo_click`.
4. Search Console: thêm property Domain, liên kết với GA4.

## 3. Các chỉ số còn lại theo yêu cầu — cần dữ liệu ngoài website

| Chỉ số | Nơi có dữ liệu thật | Cách nối |
|---|---|---|
| Khách gửi hàng lần đầu | Hệ thống VIPORDER / KHAIBAO9610 (mã KH mới) | Đối soát hàng tuần: mã KH mới có nguồn `vipgroup.com.vn` (đăng ký qua link có `utm_source=vipgroup`) |
| Khách phát sinh đơn | Cổng khachhang.viporder.com.vn | Báo cáo đơn theo mã KH, nối với nguồn đăng ký |
| Khách quay lại | Như trên (số đơn/mã KH theo tháng) | Báo cáo cohort tháng |

Đề xuất bước tiếp (cần owner duyệt — **không tự làm**): thêm `?utm_source=vipgroup&utm_medium=referral&utm_campaign=<trang>` vào các link đăng ký sang viporder.com.vn để VIPORDER ghi nhận nguồn (viporder.com.vn đã có trường "Ghi nhận nguồn đăng ký").

## 4. Đặc tả backend nhận lead (khi owner duyệt — chưa triển khai)

Hiện form **không gửi dữ liệu lên máy chủ** (khách tự gửi qua Zalo/email). Khi cần lưu lead tự động:

- Endpoint: Cloudflare Pages Function `POST /api/lead` (cùng origin → chỉ cần mở CSP `form-action 'self'`/`connect-src 'self'`).
- Chống spam: Cloudflare Turnstile (site key công khai, secret ở Cloudflare env — không vào repo), honeypot field ẩn, giới hạn tần suất theo IP (vd. 5/giờ), độ dài tối đa từng trường, chỉ nhận `application/json`.
- Lưu trữ: chuyển tiếp sang API lead của VIPORDER backend (FastAPI hiện có, `docs/REGISTRATION-FLOW.md` của repo viporder-com-vn) với idempotency key — **cần hợp đồng API đã xác minh**, không đoán endpoint. Không lưu dữ liệu khách trong Cloudflare KV lâu dài.
- CRM VIP GROUP: chỉ tích hợp qua interface/API được owner cung cấp; **không ghi trực tiếp vào DB CRM thật**.
- Thông báo: Zalo OA / email nội bộ khi có lead mới.
- Đồng ý xử lý dữ liệu cá nhân (checkbox + link chính sách) trước khi gửi.
