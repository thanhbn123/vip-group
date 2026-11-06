# BÁO CÁO NGHIỆM THU — SEO V1.1 + CHỈ THỊ V1.2 (G09–G13) + V2 4 ĐIỂM NHẬN HÀNG

Ngày 06/11/2026 · Controller: phiên `vip-group-com-vn-8d` (owner chỉ định single-writer).
Nhánh: `feature/vipg-web-025-seo-v11` (local, **chưa push**) · Production hiện tại: `main@5ee2efd` (không đổi).

## 0. Xem demo

```bash
cd ~/Projects/vip-group-com-vn
npm run build && VIPG_DEMO=1 npx astro build && VIPG_TURNSTILE_SITE_KEY=1x00000000000000000000AA VIPG_OUTDIR=./dist-lead npx astro build
node tests/e2e/serve.mjs dist 4321          # bản SẼ PHÁT HÀNH
node tests/e2e/serve.mjs dist-demo 4322     # bản nghiệm thu: + dữ liệu MẪU, bài nháp (noindex)
node tests/e2e/lead-server.mjs dist-lead 4351   # form gửi thật (Turnstile mã THỬ, Sheet giả) — xem lead: /__mock/rows
```
Bản 4321 dùng mã Turnstile thật nên trên localhost ô xác minh báo "domain not allowed" (đúng thiết kế); thử gửi form ở 4351.
Ảnh chụp: `evidence/final/` (không đưa vào git).

## 1. ĐÃ HOÀN THÀNH

| Hạng mục | Kết quả |
|---|---|
| Single-writer | Phát hiện phiên `ec` ghi cùng workspace → dừng, owner chọn phiên này. Thay đổi của ec lưu ở `wip/vipg-web-024-tham-quyen-route`; V2 của ec nhận qua bundle, review rồi áp. |
| G09 Hotline | 0961 102 655 / `tel:0961102655` toàn site; **cấu hình tập trung duy nhất** `src/data/vi/contact.ts` (test chặn số ở file khác); Zalo `zalo.me/0961102655` theo tin nhắn owner 06/11 ("đổi hết số zalo và liên hệ…"); không còn 0968961962; không đụng site VIPORDER. |
| G10 Bảng giá trang chủ | Tiêu đề "VIP GROUP – BẢNG GIÁ VẬN CHUYỂN / VIP GROUP 运输价格表 / Trung Quốc – Việt Nam / 中国 – 越南"; đúng 5 mức; VNĐ/kg; nút "Gọi tư vấn: 0961 102 655"; slogan; không khuyến mãi; thuế/phụ phí "sẽ được xác nhận". |
| G11 Form | Họ tên, SĐT/Zalo, email (tuỳ chọn), **tuyến vận chuyển**, nhu cầu, khối lượng, nội dung, đồng ý xử lý dữ liệu; báo thành công/thất bại; Turnstile + honeypot + thời gian điền; kiểm dữ liệu phía máy chủ; Google Sheet → Zalo Bot → CRM V5 (ký HMAC); không PII trong đo lường/log; trang Chính sách bảo mật (NĐ 13/2023). Thử nghiệm không ghi CRM production. |
| G12 SEO Logistics | `/logistics/` + Bắc Ninh + Trung–Việt + **mạng lưới 4 kho** `/logistics/kho-trung-quoc/` + 4 trang tuyến Thâm Quyến / Hạ Môn / Quảng Châu / Nghĩa Ô (song ngữ, nút sao chép địa chỉ) + quy trình + bảng giá chi tiết (công cụ tính, quy đổi 6000) + FAQ + tra cứu + liên hệ. Metadata riêng, breadcrumb, JSON-LD (Service/Offer/FAQPage/HowTo/Breadcrumb), sitemap theo trạng thái trang. |
| P2 | 10 bài ưu tiên (8 bài nháp đã viết), GA4/GSC, đo nguồn khách → CRM, lộ trình mở rộng toàn quốc: `P2_NOI_DUNG_DO_LUONG_MO_RONG.md`, `G10_GSC_AI_SEARCH_MONITORING.md`. |
| G13 Kiểm thử độc lập | QA/Security: PASS WITH FINDINGS (0 P0/P1; P2 cổng lead đã sửa) — `G13_QA_SECURITY.md`. SEO: PASS WITH FINDINGS (0 P0; 5 P1 đã sửa — 3 qua V2, 2 tại đây) — `G13_SEO_AUDIT.md`. V2: `G15_MULTI_WAREHOUSE_V2.md`. |

## 2. Kết quả kiểm thử (đo trên commit cuối)

| Bộ | Kết quả |
|---|---|
| `astro check` | 0 lỗi |
| `npm test` (build + kiểm bản build + worker + Apps Script giả lập) | **168/168** |
| E2E Logistics (prod + demo × desktop/mobile) | **204/204** |
| E2E form thu lead (Turnstile thật mã thử, Sheet giả) | **21/21** — lead ghi đủ trường kể cả `route` |
| E2E bảng giá trang chủ 1366/768/390/320 px | **37/37** |
| E2E V2 4 điểm nhận hàng | **148/148** |
| Đột biến (QA) | 7/7 bị bắt |

## 3. CHƯA HOÀN THÀNH

- Trang Tin tức: chưa có tin thật (cần owner cung cấp).
- 8 bài kiến thức: nháp, chờ chuyên môn duyệt (không xuất bản).
- GA4: chưa gắn (chưa có Measurement ID).
- Lighthouse / Core Web Vitals trên tên miền thật: đo sau phát hành.
- 4 trang tuyến trùng ~80% cấu trúc: cần ảnh kho, giờ nhận, thời gian vận chuyển thật để khác biệt.

## 4. CẦN CHỦ DỰ ÁN CUNG CẤP / XÁC NHẬN

| # | Nội dung | Ghi chú |
|---|---|---|
| 1 | **Áp giá theo TỔNG CẢ LÔ hay TỪNG KIỆN** | Owner trả lời phiên này: **"Theo tổng cả lô"** (đang hiển thị). Phiên ec báo một tin nhắn owner khác ghi "từng kiện". **Cần owner chốt lại một lần** trước phát hành. |
| 2 | Thời gian vận chuyển từng tuyến, cửa khẩu | Hiện "báo theo lô hàng" |
| 3 | Ảnh thật 4 kho, giờ nhận hàng | Tăng khác biệt nội dung |
| 4 | Phạm vi giao tận nơi ngoài Bắc Ninh | Hiện "liên hệ để xác nhận" |
| 5 | Phụ phí, thuế, chính sách kiểm đếm/bồi thường | Hiện "sẽ được xác nhận" |
| 6 | Người bản ngữ duyệt tiếng Trung | Cả trang chủ + 4 trang tuyến |
| 7 | Tin tức thật, GA4 Measurement ID | |
| 8 | Cài đặt thu lead A–E (Sheet, Apps Script, Zalo Bot, biến Cloudflare **Production**) | `docs/HUONG_DAN_CAI_DAT_THU_LEAD.md` — Turnstile Site Key đã có |

## 5. CÁC THAY ĐỔI SẼ ÁP DỤNG LÊN PRODUCTION (khi owner duyệt)

So với `main@5ee2efd`:
- Menu + chân trang thêm "Logistics"; thẻ lĩnh vực 01 thêm 1 link; chân trang thêm "Chính sách bảo mật".
- Trang chủ: bảng giá đổi tiêu đề/nhãn theo G10, ghi chú áp giá theo cả lô + quy đổi 6000, nút "Gọi tư vấn", nút "Gửi yêu cầu báo giá", link "Xem bảng giá chi tiết" + link Bắc Ninh / Thâm Quyến.
- Liên hệ: form gửi thật (cần biến Cloudflare — mục 4.8), thêm dòng Zalo.
- Mới: `/chinh-sach-bao-mat/`, 13 trang `/logistics/…` (sitemap 7 → 21 URL), cổng `/api/lead` (`_worker.js`, `_routes.json` chỉ `/api/*`).
- CSP thêm `challenges.cloudflare.com` (script/frame) cho Turnstile; `form-action 'none'` giữ nguyên.
- CI: runner ghim `ubuntu-24.04` (đã có trên main).

## 6. THAO TÁC PRODUCTION CẦN OWNER PHÊ DUYỆT (theo thứ tự)

1. Push nhánh `feature/vipg-web-025-seo-v11` + mở PR vào `develop` (thay PR #43 — đóng #43).
2. CI + verifier → merge `develop` → kiểm staging (sau Cloudflare Access của owner).
3. **Trước khi lên production**: owner đặt biến Cloudflare Pages **Production** (`TURNSTILE_SECRET`, `SHEET_WEBHOOK_URL`, `SHEET_WEBHOOK_SECRET`, `ZALO_BOT_TOKEN`, `ZALO_NOTIFY_CHAT_ID`) và widget Turnstile có hostname `www.vipgroup.com.vn`. *Nếu chưa làm:* em đặt lại `TURNSTILE_SITE_KEY = null` để form giữ trạng thái cũ, phát hành phần còn lại.
4. PR `develop → main` → CI → merge → chạy `production.yml` với SHA `main` → owner duyệt environment `production`.
5. Sau phát hành: gửi sitemap Search Console; gửi 1 lead thật kiểm Sheet + Zalo + CRM.

## 7. Backup & rollback

- Tag `backup/production-before-vipg-web-022` (bản trước bảng giá) và commit `main@5ee2efd` (bản đang chạy) — đều có trên GitHub.
- Rollback nhanh: Cloudflare Pages → Deployments → Rollback về deployment của `5ee2efd`. Theo mã: revert merge trên `main` + chạy lại `production.yml`.
- Tắt riêng form: xoá `TURNSTILE_SECRET` trên Cloudflare → `/api/lead` trả 503, form hướng dẫn gọi hotline.
- Lead đã thu nằm trong Google Sheet của công ty — không mất khi rollback website.
