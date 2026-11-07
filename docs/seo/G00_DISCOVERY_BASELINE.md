# G00 — DISCOVERY & BASELINE (VIPG-WEB-021)

Đo ngày **06/11/2026** từ máy local của owner. Mọi số liệu dưới đây là đo thật; mục không đo được ghi `OWNER ACTION REQUIRED`.

## 1. Mã nguồn và workspace

| Hạng mục | Kết quả đo |
|---|---|
| Repository chính | `~/code/vip-group` → GitHub `thanhbn123/vip-group` (README: "Website chính thức VIP GROUP — vipgroup.com.vn") |
| Nhánh | `main` = `26417fd` (production), `develop` = `2c998ed` (local = origin, đo bằng `git fetch`) |
| Workspace phát triển | `~/Projects/vip-group-com-vn` = **git worktree** của repo chính, nhánh `feature/vipg-web-021-logistics-seo` tạo từ `develop@2c998ed`. Không tạo repo mới. |
| Single-writer | Repo chính sạch (`git status` rỗng), commit cuối 27/10; không phát hiện controller khác ghi vào repo này. (Có phiên khác đang ghi `~/Projects/vip-group-khoqctq` — dự án khác, không đụng tới.) |
| Stack | Astro 7.3.5, xuất HTML tĩnh, không backend/CMS. Node ≥ 22.12. CSP `<meta>` có hash, không `unsafe-inline`. |
| Test baseline | `npm test`: **107/107 PASS** trước khi sửa |
| Quy trình | Issue → branch → PR vào `develop` → CI → verifier → merge (docs/PROJECT_CONTROLLER.md). Controller không được merge `main`/deploy. |

## 2. Hosting, tên miền, triển khai

| Hạng mục | Kết quả đo |
|---|---|
| `www.vipgroup.com.vn` | CNAME → `vip-group.pages.dev` (**Cloudflare Pages**), HTTP/2 200 |
| `vipgroup.com.vn` (apex) | A → `160.22.170.20` (Caddy) → **301** `https://www.vipgroup.com.vn/` |
| HTTP → HTTPS | `http://` apex và `http://www` đều 301 → `https://www.../` |
| DNS | NS `ns1/ns2.vclouddns.vn` (iNET) |
| Triển khai | `.github/workflows/production.yml` chạy tay từ `main`, có cổng; staging tự động từ `develop` lên `staging.vip-group.pages.dev` |
| Header bảo mật | nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options DENY, COOP; `*.pages.dev` noindex |

## 3. SEO kỹ thuật hiện trạng (trước thay đổi)

| Hạng mục | Kết quả |
|---|---|
| robots.txt | `Allow: /` + Sitemap — đúng |
| sitemap.xml | 7 URL (trang tập đoàn), đúng `www`, trailing slash |
| Canonical | Mỗi trang tự canonical tuyệt đối về `www` |
| Metadata | Title/description riêng mỗi trang, OG đủ |
| Heading | Mỗi trang đúng một H1 |
| Structured data | `Organization` VIP GROUP (pháp nhân, MST, địa chỉ Lạng Sơn) |
| Mobile | Responsive, menu mobile, Lighthouse staging 30/09: P/A/BP = 100 |
| **Khoảng trống SEO** | **Không có trang dịch vụ logistics nào** — toàn bộ nội dung logistics chỉ là 1 thẻ lĩnh vực trên trang chủ. Không có trang đích cho bất kỳ từ khóa vận chuyển nào. |

## 4. Dữ kiện kinh doanh đã kiểm chứng (nguồn công khai)

Nguồn: `https://viporder.com.vn` (đọc 06/11/2026) + dữ liệu owner chốt trong repo.

| Dữ kiện | Giá trị | Nguồn |
|---|---|---|
| Đơn vị vận hành logistics | VIPORDER — CÔNG TY TNHH XUẤT NHẬP KHẨU LOGISTICS VIP ORDER | `src/data/vi/subsidiaries.ts` (owner chốt 24/10) |
| Quan hệ với VIP GROUP | Cùng chủ sở hữu (không phải mẹ–con) | như trên |
| Dịch vụ | Vận chuyển Trung–Việt; nhập khẩu chính ngạch; khai báo hải quan; đặt hàng 1688/Taobao/Pinduoduo | viporder.com.vn |
| Văn phòng | Số 62 Khu đô thị Nam Hồng, Đồng Nguyên, Bắc Ninh | viporder.com.vn |
| Hotline / Zalo | 0968 961 962 · `https://zalo.me/0968961962` | viporder.com.vn |
| Tra cứu vận đơn | `viporder.com.vn/#tracking` (mã vận đơn / mã bao, không cần đăng nhập) | viporder.com.vn |
| Cổng khách hàng | `khachhang.viporder.com.vn/login` | viporder.com.vn |
| Quy trình | Đăng ký mã KH → Gửi hàng → Theo dõi → Nhận hàng (tại kho hoặc theo phương án giao) | viporder.com.vn |

**Chưa có bằng chứng (OWNER INPUT PENDING):** địa chỉ kho Quảng Châu, kho Thâm Quyến; giờ nhận hàng; tuyến/cửa khẩu; thời gian vận chuyển; bảng giá; hệ số quy đổi cân nặng; chính sách kiểm đếm/bồi thường; phạm vi giao ngoài Bắc Ninh; ủy thác nhập khẩu, hàng nguyên container, kho Bằng Tường.

## 5. Không đo được — OWNER ACTION REQUIRED

| Hạng mục | Lý do | Việc owner cần làm |
|---|---|---|
| Google Search Console | Không có quyền | Thêm property Domain `vipgroup.com.vn` (xác minh DNS TXT tại iNET), cấp quyền "Đầy đủ" cho tài khoản vận hành |
| Trang đã lập chỉ mục, thứ hạng | Cần Search Console; `site:` không phải số liệu xác minh | Như trên — sau 7–14 ngày xuất báo cáo Hiệu suất + Lập chỉ mục |
| GA4 | Site chưa gắn GA4 | Tạo property GA4, gửi Measurement ID (`G-…`) |
| Core Web Vitals thực tế (CrUX) | Site mới, chưa đủ lưu lượng | Theo dõi trong Search Console → Trải nghiệm |
| Lighthouse trên tên miền thật | Chưa đo (đã có trên staging 30/09) | Có thể chạy sau khi phát hành |

## 6. Backup / rollback

- Mã nguồn: Git (GitHub). Thay đổi nằm hoàn toàn trên nhánh `feature/vipg-web-021-logistics-seo`; `main`/production không đổi.
- Production là Cloudflare Pages: mỗi lần deploy là một bản bất biến → rollback bằng "Rollback to this deployment" trong Cloudflare Pages hoặc chạy lại `production.yml` từ commit `main` trước đó (xem `docs/PRODUCTION.md`).
- Thay đổi là **cộng thêm** (thư mục `/logistics/`, 1 mục menu, 1 link trên thẻ lĩnh vực) → gỡ bằng `git revert` merge commit là đủ.

> **Cập nhật 06/11/2026:** owner đổi toàn bộ Hotline/Zalo liên hệ sang **0961 102 655** (`https://zalo.me/0961102655`). Số 0968 961 962 ở bảng trên là số đo được lúc khảo sát (vẫn đang ghi trên viporder.com.vn).
