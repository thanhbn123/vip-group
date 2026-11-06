# G08 — HỒ SƠ NGHIỆM THU CHỦ DỰ ÁN · VIPG-WEB-021 LOGISTICS SEO

**Trạng thái: DỪNG TẠI G08 — CHỜ CHỦ DỰ ÁN NGHIỆM THU.** Chưa push GitHub, chưa mở PR, chưa deploy, không đổi DNS/máy chủ. Production `https://www.vipgroup.com.vn` **không thay đổi**.

- Repo: `~/code/vip-group` (GitHub `thanhbn123/vip-group`) · worktree `~/Projects/vip-group-com-vn`
- Nhánh: `feature/vipg-web-021-logistics-seo` (commit local, từ `develop@2c998ed`)

## Cách xem demo (máy local)

```bash
cd ~/Projects/vip-group-com-vn
npm run build && npm run build:demo
node tests/e2e/serve.mjs dist 4321        # bản PRODUCTION: đúng những gì sẽ phát hành
node tests/e2e/serve.mjs dist-demo 4322   # bản DEMO: có dữ liệu MẪU + trang nháp (mọi trang noindex)
```

| Màn hình | Production (4321) | Demo (4322) |
|---|---|---|
| Hub Logistics | http://localhost:4321/logistics/ | http://localhost:4322/logistics/ |
| Vận chuyển về Bắc Ninh (+ mục Từ Sơn – Đồng Kỵ) | /logistics/van-chuyen-trung-quoc-bac-ninh/ | như bên trái |
| Vận chuyển Trung Quốc về Việt Nam | /logistics/van-chuyen-trung-quoc-viet-nam/ | |
| Quy trình gửi hàng | /logistics/quy-trinh-gui-hang/ | |
| Bảng giá + công cụ tính số khối + form báo giá | /logistics/bang-gia/ | bảng giá MẪU |
| Tra cứu vận đơn (dẫn sang VIPORDER) | /logistics/tra-cuu-van-don/ | |
| Câu hỏi thường gặp | /logistics/cau-hoi-thuong-gap/ | |
| Liên hệ & khu vực phục vụ | /logistics/lien-he/ | |
| Kho Quảng Châu / Kho Thâm Quyến | *(không phát hành — chờ xác nhận)* | /logistics/kho-quang-chau/, /kho-tham-quyen/ |
| Kiến thức (3 bài nháp) | *(không phát hành — chờ duyệt)* | /logistics/kien-thuc/ |
| Trang chủ tập đoàn (giữ nguyên, thêm 1 mục menu + 1 link) | / | |

Ảnh chụp desktop + mobile của cả hai bản: `evidence/screenshots/` (21 ảnh) · kết quả E2E: `evidence/screenshots/e2e-results.json`.

## 1. Đã hoàn thành

- **G00** khảo sát & baseline có đo đạc: `docs/seo/G00_DISCOVERY_BASELINE.md`.
- **G01/G02** nghiên cứu từ khóa + 12 đối thủ (`G01_KEYWORD_COMPETITOR_RESEARCH.md`), ma trận một cụm = một URL, kiến trúc URL, lộ trình 90 ngày, chiến lược 12 tháng, KPI (`G01_G02_SEO_STRATEGY_ARCHITECTURE.md`).
- **G03** khu `/logistics/`: 7 trang phát hành (index, vào sitemap) + 1 trang `pending` (bảng giá: noindex cho tới khi có giá) + 2 trang kho và 4 trang kiến thức ở dạng nháp (chỉ có trong DEMO). Responsive, menu phụ, breadcrumb, nút Gọi/Zalo/Báo giá, thanh liên hệ cố định trên mobile, công cụ tính số khối, form báo giá **không gửi dữ liệu lên máy chủ** (khách tự gửi qua Zalo/email), JSON-LD `Service` / `BreadcrumbList` / `FAQPage` / `HowTo` / `Article`, sitemap tự sinh theo trạng thái trang. Cơ chế dữ kiện có nguồn (`Fact {value, source}`) và chế độ DEMO tách biệt.
- **G04** hồ sơ Google Business Profile soạn sẵn + quy trình xác minh + kế hoạch xin đánh giá thật: `G04_LOCAL_SEO_GBP.md`.
- **G05** lịch nội dung 90 ngày (12 mục), 3 bài đã viết dạng nháp: `G05_CONTENT_CALENDAR_90D.md`.
- **G06** lớp sự kiện chuyển đổi (11 sự kiện, không chứa PII, không tải script bên ngoài) + hướng dẫn bật GA4 + đặc tả backend nhận lead: `G06_ANALYTICS_LEAD_TRACKING.md`.
- **G07** verifier độc lập + khắc phục: `G07_INDEPENDENT_VERIFIER.md`.

## 2. Chưa hoàn thành và lý do

| Hạng mục | Lý do |
|---|---|
| Trang kho Quảng Châu, Thâm Quyến chưa phát hành | Không có bằng chứng VIPORDER có kho tại hai nơi này (viporder.com.vn không nhắc tới). Verifier xếp P0 → chuyển nháp. |
| Bảng giá chưa công khai (trang noindex) | Chưa có bảng giá, hệ số quy đổi, thời gian vận chuyển bằng văn bản |
| 3 bài kiến thức chưa xuất bản | Chờ owner duyệt (quy tắc: không tự xuất bản) |
| GA4 / Search Console chưa gắn | Chưa có Measurement ID và quyền Search Console |
| Lưu lead tự động / nối CRM | Chưa có hợp đồng API CRM/VIPORDER đã xác minh; không ghi vào CRM thật |
| Ảnh thật kho/văn phòng | Chưa có ảnh; site không dùng ảnh minh họa giả |
| Lighthouse trên tên miền thật | Chỉ đo được sau khi phát hành |

## 3. Kết quả kiểm thử (đo 06/11/2026)

| Kiểm thử | Kết quả |
|---|---|
| `npm run check` (TypeScript/Astro) | 0 lỗi, 0 cảnh báo |
| `npm test` (build + kiểm bản build) | **131/131 PASS** (baseline 107 + 24 test mới ở `tests/logistics.test.mjs`) |
| E2E Chromium (prod + demo × desktop 1366 + mobile 390) | **189/189 PASS**: HTTP 200, 0 lỗi console/CSP, không tràn ngang, vùng chạm ≥ 44px, công cụ tính đúng (60×50×40 × 3 = 0,36 m³), form validate + không điều hướng + mailto đúng, dataLayer có sự kiện và không có PII, 0 request ra domain ngoài, tắt JS thì nút gửi bị khóa, radio điều khiển bằng bàn phím |
| Verifier độc lập | Lần 1: FAIL (1 P0, 4 P1) → đã khắc phục toàn bộ P0/P1; 4/4 đột biến từng lọt nay bị test bắt |
| Dung lượng trang | ~11–13 KB gzip/trang, CSS/JS nội tuyến, không font/ảnh/script ngoài |
| Bảo mật | CSP giữ nguyên (không `unsafe-inline`, `form-action 'none'`), mọi hash khớp; không secret trong mã |

## 4. Việc chủ doanh nghiệp cần làm

1. **Duyệt / sửa nội dung** 7 trang production (xem bảng trên) — đặc biệt câu chữ về VIPORDER và Bắc Ninh.
2. **Search Console**: thêm property Domain `vipgroup.com.vn` (TXT tại iNET), cấp quyền.
3. **GA4**: tạo property, gửi Measurement ID `G-…`.
4. **Google Business Profile**: tự tạo và xác minh theo `G04_LOCAL_SEO_GBP.md` (không gửi mật khẩu).
5. **Ra lệnh phát hành** khi đồng ý (xem mục 6).

## 5. Thông tin còn cần xác nhận (OWNER INPUT PENDING)

| # | Thông tin | Mở khóa |
|---|---|---|
| 1 | VIPORDER **có kho** tại Quảng Châu? Thâm Quyến? (Bằng Tường?) + địa chỉ, giờ nhận, mẫu ghi người nhận | 2 trang kho |
| 2 | Tuyến/cửa khẩu và thời gian vận chuyển thực tế từng kho | trang kho, FAQ |
| 3 | Bảng giá (kg / m³), ngày hiệu lực, hệ số quy đổi cân nặng | trang bảng giá → index |
| 4 | Văn phòng Đồng Nguyên có tiếp khách / nhận hàng không? Địa chỉ hành chính sau sáp nhập 2025 có đổi không? Giờ làm việc | GBP, trang Bắc Ninh |
| 5 | Phạm vi giao tận nơi ngoài Bắc Ninh | trang Liên hệ, mở rộng tỉnh |
| 6 | Chính sách kiểm đếm, khiếu nại, bồi thường, bảo hiểm | FAQ |
| 7 | Có dịch vụ ủy thác nhập khẩu, hàng nguyên container (FCL) không | bài kiến thức |
| 8 | Duyệt 3 bài nháp | xuất bản `/kien-thuc/` |

**Một quyết định chiến lược cần owner chốt:** vipgroup.com.vn/logistics và viporder.com.vn cùng nói về một dịch vụ → có thể tranh nhau từ khóa. Đề xuất: vipgroup.com.vn giữ các cụm vận chuyển / kho / Bắc Ninh / kiến thức; viporder.com.vn giữ cụm đặt hàng hộ, đăng ký, tra cứu. Đồng thời chọn website gắn với Google Business Profile.

## 6. Thay đổi dự kiến lên production (khi owner ra lệnh)

Quy trình bắt buộc của repo: push nhánh → PR vào `develop` → CI → verifier → merge → staging (`staging.vip-group.pages.dev`) → PR `develop → main` → owner ra lệnh → `production.yml`.

- **Thêm mới:** `/logistics/` + 6 trang con (index) + `/logistics/bang-gia/` (noindex). Sitemap từ 7 lên 14 URL.
- **Sửa site tập đoàn:** menu chính + footer thêm mục "Logistics"; thẻ lĩnh vực 01 trên trang chủ và trang Lĩnh vực thêm 1 link. Title, H1, nội dung, schema Organization của trang tập đoàn **giữ nguyên** (có test).
- Không đổi DNS, không đổi Caddy/VPS, không đổi `_headers`/CSP, không thêm dịch vụ bên ngoài.

## 7. Phương án rollback

- Trước khi merge: chỉ cần không merge nhánh (production không bị ảnh hưởng).
- Sau khi phát hành: Cloudflare Pages → Deployments → **Rollback** về bản trước (tức thì), hoặc `git revert` merge commit trên `main` rồi chạy lại `production.yml`. Thay đổi chỉ là cộng thêm nên gỡ không ảnh hưởng các trang tập đoàn. URL `/logistics/*` sau rollback trả 404 → Google tự gỡ khỏi chỉ mục; có thể yêu cầu gỡ nhanh trong Search Console.

## 8. Kế hoạch SEO & KPI 90 ngày

Chi tiết ở `G01_G02_SEO_STRATEGY_ARCHITECTURE.md` §4–6 và `G05_CONTENT_CALENDAR_90D.md`. Tóm tắt:
- Tuần 0–2: phát hành, gửi sitemap, GBP; mở khóa 2 trang kho khi có dữ liệu.
- Tuần 2–6: bảng giá → index; xuất bản bài nháp + 4 bài ưu tiên (chính ngạch, FCL/LCL, xưởng gỗ Đồng Kỵ, hàng 1688).
- Tuần 6–12: GA4 + đọc Search Console, tối ưu CTR, case study thật, đánh giá Google thật.
- KPI đo được: 100% trang ready được lập chỉ mục; có hiển thị cho cụm Bắc Ninh / Từ Sơn / Đồng Kỵ; xu hướng nhấp tự nhiên tăng; baseline và tăng trưởng `call_click`, `zalo_click`, `quote_send_*`; lead và khách gửi hàng lần đầu (khi nối dữ liệu VIPORDER). Không cam kết thứ hạng.
