# G13 — Kiểm tra SEO độc lập (kỹ thuật + nội dung)

- Ngày: 06/11/2026 · Nhánh `feature/vipg-web-025-seo-v11` · commit `500cd4c`
- Người kiểm: SEO Agent (độc lập, chỉ đọc; không sửa mã, không commit/deploy)
- **Kết luận: PASS WITH FINDINGS** (0 P0 · 5 P1 · 9 P2)

## 0. Lệnh đã chạy (bằng chứng)

| Lệnh | Kết quả |
|---|---|
| `npm run build` | `18 page(s) built` → `dist/` (17 trang + 404) |
| `VIPG_DEMO=1 npx astro build` | `28 page(s) built` → `dist-demo/` (thêm `kho-quang-chau` + 9 trang `kien-thuc/*`) |
| Script Python (html.parser) quét mọi `dist/**/*.html` | title, description, H1–H6, canonical, robots, OG, lang, JSON-LD (`json.loads`), `<a>`, `<img>`, gzip |
| Cùng script trên `dist-demo/` | 28/28 trang có `robots=noindex`; `dist-demo/sitemap.xml` có 0 `<loc>` |
| `grep -rl 'kho-quang-chau\|kien-thuc' dist` · `grep -rl 'MẪU' dist` | không có kết quả (trang nháp và dữ liệu mẫu không lọt vào dist) |
| `grep -rlE 'aggregateRating\|"review"\|ratingValue' dist` | không có kết quả |
| `grep -oE '"price":[0-9]+' -r dist` | chỉ có 12000/14000/15000/16000/20000 (đúng 5 mức) |

## 1. On-page từng trang (dist/)

Không có robots meta = mặc định index (đúng với trang `ready`). Mọi trang: `lang="vi"`, canonical tuyệt đối `https://www.vipgroup.com.vn/...` (trừ 404, đúng), có đủ OG (`og:title/description/url/image 1200×630/locale vi_VN`) + `twitter:card`, đúng 1 H1, không nhảy cấp heading. Không trùng title và không trùng description.

| URL | Title (ký tự) | Desc (ký tự) | H1 | JSON-LD |
|---|---|---|---|---|
| `/` | VIP GROUP \| Con người - Công nghệ - Cơ hội (42) | 149 | Con người.Công nghệ.Cơ hội. | Organization, Service (5 Offer) |
| `/gioi-thieu/` | Giới thiệu \| VIP GROUP (22) | 161 ⚠ | Nền tảng kết nối… | Organization |
| `/linh-vuc-hoat-dong/` | (30) | 118 ⚠ | Ba trụ cột phát triển | Organization |
| `/cong-ty-thanh-vien/` | (30) | **56** ⚠ | Hệ sinh thái VIP GROUP | Organization |
| `/tin-tuc/` | (19) | 104 ⚠ | Thông tin từ VIP GROUP | Organization |
| `/tuyen-dung/` | (22) | 148 | Gia nhập VIP GROUP | Organization |
| `/lien-he/` | (19) | **73** ⚠ | Kết nối với VIP GROUP | Organization |
| `/chinh-sach-bao-mat/` | (30) | 137 | Bảo vệ dữ liệu cá nhân | Organization |
| `/logistics/` | Logistics Trung – Việt: vận chuyển, nhập khẩu, hải quan \| VIP GROUP (**67**) | 149 | Logistics Trung Quốc – Việt Nam | Breadcrumb, Service |
| `/logistics/van-chuyen-trung-quoc-bac-ninh/` | Vận chuyển hàng Trung Quốc về Bắc Ninh, Từ Sơn \| VIP GROUP (58) | 144 | Vận chuyển hàng Trung Quốc về Bắc Ninh | Breadcrumb, Service |
| `/logistics/van-chuyen-trung-quoc-viet-nam/` | Vận chuyển hàng Trung Quốc về Việt Nam, chính ngạch \| VIP GROUP (63) | 137 | Vận chuyển hàng Trung Quốc về Việt Nam | Breadcrumb, Service |
| `/logistics/van-chuyen-tham-quyen-viet-nam/` | Vận chuyển Trung Việt từ Thâm Quyến về Việt Nam \| VIP GROUP (59) | 152 | Vận chuyển hàng hóa từ Thâm Quyến về Việt Nam | Breadcrumb, Service, WebPage, FAQPage |
| `/logistics/quy-trinh-gui-hang/` | Quy trình gửi hàng từ Trung Quốc về Việt Nam \| VIP GROUP (56) | 139 | = title | Breadcrumb, HowTo |
| `/logistics/bang-gia/` | Bảng giá vận chuyển Trung Quốc – Việt Nam theo kg \| VIP GROUP (61) | 137 | Bảng giá vận chuyển Trung Quốc – Việt Nam | Breadcrumb, Service (5 Offer) |
| `/logistics/tra-cuu-van-don/` | (54) | 119 ⚠ | Tra cứu vận đơn | Breadcrumb |
| `/logistics/cau-hoi-thuong-gap/` | (60) | 139 | Câu hỏi thường gặp | Breadcrumb, FAQPage (9 câu) |
| `/logistics/lien-he/` | Liên hệ Logistics – văn phòng Bắc Ninh, Hotline/Zalo \| VIP GROUP (64) | 139 | Liên hệ và khu vực phục vụ | Breadcrumb |
| `/404.html` | (32) | 28 | Không tìm thấy trang | `noindex`, không canonical (đúng) |

## 2. sitemap.xml & robots.txt — PASS

- `robots.txt`: `Allow: /` + `Sitemap: https://www.vipgroup.com.vn/sitemap.xml`. `_headers` đặt `X-Robots-Tag: noindex` cho `*.pages.dev` (đúng).
- `sitemap.xml` có 17 `<loc>` = đúng 17 trang HTML index được trong dist (18 trang trừ 404). Không có trang nháp (`kho-quang-chau`, `kien-thuc/*`), không có trang noindex, không thiếu trang ready (gồm `van-chuyen-tham-quyen-viet-nam`).
- P2: sitemap không có `<lastmod>`; `dist-demo/robots.txt` vẫn trỏ sitemap production (vô hại vì mọi trang demo đều noindex và sitemap demo rỗng).

## 3. JSON-LD — PASS

- Tất cả khối parse được (0 lỗi). Organization VIP GROUP: địa chỉ **Lạng Sơn** (183 Bắc Sơn, Kỳ Lừa), MST 4900951703, tel +84961102655. Địa chỉ Bắc Ninh **chỉ** nằm trong `provider` = VIPORDER (đúng nguồn `logistics.ts`, `SRC_VIPORDER`).
- Offer/UnitPriceSpecification: đúng 5 mức 20.000/16.000/15.000/14.000/12.000 VND/kg (`pricing.ts`). Không có rating hay review.
- P2: `/logistics/bang-gia/` Offer **thiếu** `eligibleQuantity` (trang chủ có), nên hai khối Service cùng tên không khớp nhau; Service trên trang chủ có `url` `/#bang-gia` → nên chỉ khai đầy đủ ở `/logistics/bang-gia/`.
- P2: HowTo (từ 2023 Google không còn hiển thị rich result) và FAQPage (rich result chỉ còn cho trang chính phủ/y tế) vẫn hợp lệ nhưng không đem lại hiển thị đặc biệt. Không có Article trong dist (bài viết đều là nháp), đúng.

## 4. Cannibalization — bản đồ từ khóa → URL

| Từ khóa chính | URL đích | URL cạnh tranh | Mức |
|---|---|---|---|
| vận chuyển Trung Quốc về Bắc Ninh | `/logistics/van-chuyen-trung-quoc-bac-ninh/` | `/logistics/lien-he/` (title có "văn phòng Bắc Ninh"), `/logistics/` (areaServed Bắc Ninh) — nhẹ | P2 |
| vận chuyển hàng Trung Quốc về Việt Nam | `/logistics/van-chuyen-trung-quoc-viet-nam/` | **`/logistics/`**: JSON-LD Service `name` trùng nguyên văn "Vận chuyển hàng Trung Quốc về Việt Nam", title/desc cùng ý định ("vận chuyển, nhập khẩu, hải quan"); `/logistics/quy-trinh-gui-hang/` ("…từ Trung Quốc về Việt Nam") | **P1** |
| bảng giá vận chuyển Trung Việt | `/logistics/bang-gia/` | trang chủ (Service + 5 Offer), H2 trang Thâm Quyến "Bảng giá cước ký gửi hàng Thâm Quyến về Việt Nam 2026" | P2 |
| vận chuyển Thâm Quyến Việt Nam | `/logistics/van-chuyen-tham-quyen-viet-nam/` | không có | OK |
| kho Quảng Châu | (nháp, không build) | không có | OK |
| quy trình gửi hàng | `/logistics/quy-trinh-gui-hang/` | H2 Thâm Quyến "Quy trình nhận hàng tại kho Thâm Quyến…" (khác ý định, chấp nhận được) | OK |
| câu hỏi thường gặp | `/logistics/cau-hoi-thuong-gap/` | FAQ trên trang Thâm Quyến/Bắc Ninh/TQ-VN có câu hỏi khác nhau | OK |

## 5. Internal linking

- Không có link nội bộ hỏng; không có trang mồ côi (mọi trang ready nhận link từ ≥ 8 trang).
- Các trang VIP GROUP nhận link từ 17 trang (header/footer). 8 trang con `/logistics/*` **chỉ** nhận link từ thanh điều hướng con của 8 trang trong cụm logistics. Trang chủ chỉ link tới `/logistics/` và `/logistics/bang-gia/`.
- **P1**: trang ưu tiên Bắc Ninh không nhận link nào từ trang chủ hay từ header/footer toàn site. Anchor chủ yếu là "Về Bắc Ninh" (điều hướng con), "Nhận hàng tại Bắc Ninh", "Xem chi tiết →", nên tín hiệu anchor cho "vận chuyển hàng Trung Quốc về Bắc Ninh" yếu. Tương tự: Thâm Quyến (anchor "Thâm Quyến – VN"), TQ-VN ("Trung – Việt").
- P2: "Báo giá"/"Yêu cầu báo giá" lặp nhiều, anchor không mô tả; card trên trang Bắc Ninh có anchor gộp dài ("Thâm Quyến → Bắc Ninh Tuyến: đang cập nhật Xem kho Thâm Quyến →").

## 6. Nội dung — khẳng định không có nguồn

Đã đối chiếu `src/data/vi/logistics.ts`, `pricing.ts`, `contact.ts`. Hotline/Zalo 0961 102 655, 5 mức giá, câu "áp theo tổng cả lô", hệ số 6000 đều đúng nguồn owner 06/11/2026. Không có giá, thời gian giao hay địa chỉ kho dạng MẪU nào lọt vào dist (các ô hiện "Báo theo lô"/"đang cập nhật").

**`/logistics/van-chuyen-tham-quyen-viet-nam/`**
- **P1** meta description + JSON-LD Service: "về Hà Nội, Bắc Ninh, TP.HCM"; bảng thời gian ghi chú Hà Nội "giao tận nơi nội thành", TP.HCM "Chuyển tiếp nội địa từ miền Bắc vào miền Nam". Trong khi đó `serviceArea.expansion` (giao ngoài Bắc Ninh) vẫn là `pending`, nên đây là cam kết phạm vi giao hàng chưa có nguồn.
- **P1** H2 "Quy trình nhận hàng tại kho Thâm Quyến và giao tận nơi (Door to Door)", câu hỏi FAQ "Địa chỉ **kho Thâm Quyến của VIPORDER** ở đâu?", bước "Nhận địa chỉ kho Thâm Quyến". Owner chỉ xác nhận "nhận hàng trực tiếp tại Thâm Quyến"; chưa có xác nhận về kho riêng hay dịch vụ door-to-door. Nên dùng "điểm nhận hàng tại Thâm Quyến".
- **P1** H2 "Bảng giá cước ký gửi hàng Thâm Quyến về Việt Nam 2026" nhưng bảng chỉ có 1 dòng (chính ngạch, "Báo theo lô"). Tiêu đề hứa bảng giá mà nội dung không có, gây hiểu nhầm. Chưa có nguồn nói 5 mức giá TQ–VN áp cho tuyến Thâm Quyến.
- P2 "hàng lô cồng kềnh thường tính thẳng theo m³" (FAQ) không có nguồn và lệch với `pricing.basis` (quy đổi ÷6000). Đoạn "Vận chuyển đường bộ (chuyển phát nhanh)… hàng cần nhanh" mô tả hình thức có `offered = pending`. Đường biển được nhắc ở phần tóm tắt (cũng `pending`).
- P2 title "Vận chuyển **Trung Việt** từ Thâm Quyến về Việt Nam" thừa chữ; nên đổi thành "Vận chuyển hàng Thâm Quyến về Việt Nam…".

**`/logistics/bang-gia/`** — đạt: tiêu đề, nhãn, giá, quy tắc tính và ghi chú phụ phí khớp nguyên văn `pricing.ts`. P2: form có lựa chọn Hạ Môn/Nghĩa Ô (là tùy chọn của form, không khẳng định dịch vụ nhưng có thể bị hiểu là có tuyến).

**`/logistics/van-chuyen-trung-quoc-bac-ninh/`** — P1 (gộp với Thâm Quyến về cách gọi "kho"): card "Thâm Quyến → Bắc Ninh — Tuyến: đang cập nhật — Xem **kho** Thâm Quyến →" hiện chữ placeholder trên trang ready và gọi là "kho".

**Song ngữ**: 26 phần tử `lang="zh-CN"` (trang chủ + bảng giá), mã ngôn ngữ đúng. P2: chữ Hán "深圳" trên trang Thâm Quyến (tóm tắt, thẻ) và nhãn form "(深圳)/(广州)…" không có `lang="zh-CN"`. `pricing.ts` ghi bản tiếng Trung **cần người bản ngữ duyệt** (chưa có bằng chứng đã duyệt).

## 7. Mobile / hiệu năng — PASS

- HTML gzip: 7,1–14,6 KB/trang (lớn nhất `/logistics/bang-gia/` 14,6 KB, Thâm Quyến 13,4 KB). CSS inline, 0 stylesheet ngoài, 0 font ngoài, 0 analytics bên thứ ba.
- Script ngoài: chỉ Cloudflare Turnstile (`challenges.cloudflare.com/turnstile/v0/api.js`) trên `/lien-he/` và `/logistics/bang-gia/`.
- Ảnh: mọi `<img>` có width/height/alt (logo trang trí `alt=""`); dùng `<picture>` WebP (400/600/720w) và PNG dự phòng; LCP trang chủ có `fetchpriority=high`. Không có ảnh nội dung nào trên các trang logistics (P2 cơ hội: ảnh thật văn phòng Bắc Ninh khi owner cung cấp).

## 8. Đề xuất ưu tiên (không vi phạm quy tắc nguồn)

1. **P1** Bỏ "TP.HCM/Hà Nội giao tận nơi" khỏi description, JSON-LD và ghi chú bảng Thâm Quyến cho đến khi `serviceArea.expansion` có nguồn; giữ "về Bắc Ninh" (văn phòng có nguồn).
2. **P1** Đổi "kho Thâm Quyến (của VIPORDER)", "Door to Door", "Xem kho Thâm Quyến" thành "điểm nhận hàng tại Thâm Quyến"; ẩn dòng "Tuyến: đang cập nhật" trên card Bắc Ninh.
3. **P1** Đổi H2 "Bảng giá cước… 2026" trên trang Thâm Quyến thành "Hình thức vận chuyển và cách tính cước"; chỉ đưa 5 mức giá vào khi owner xác nhận áp cho tuyến Thâm Quyến, nếu chưa thì chỉ link sang `/logistics/bang-gia/`.
4. **P1** Tách rõ ý định: `/logistics/` là hub (Service name hoặc title kiểu "Dịch vụ Logistics VIPORDER – tổng quan"), để từ khóa "vận chuyển hàng Trung Quốc về Việt Nam" chỉ thuộc `/van-chuyen-trung-quoc-viet-nam/`.
5. **P1** Thêm link từ trang chủ (mục Logistics/bảng giá) và footer toàn site tới trang Bắc Ninh và Thâm Quyến, anchor mô tả "Vận chuyển hàng Trung Quốc về Bắc Ninh", "Vận chuyển hàng Thâm Quyến về Việt Nam".
6. P2 Trên trang Bắc Ninh: thêm câu dẫn tới 5 mức giá đã có nguồn ("từ 12.000đ/kg cho lô trên 1.000 kg, áp theo tổng cả lô" + link `/logistics/bang-gia/`) và FAQPage cho 3 câu hỏi Bắc Ninh đang hiển thị.
7. P2 Thống nhất Offer (thêm `eligibleQuantity` ở bảng giá); chỉ giữ một khối Service/Offer đầy đủ ở `/logistics/bang-gia/`.
8. P2 Viết lại meta description ngắn (`/cong-ty-thanh-vien/` 56, `/lien-he/` 73, `/tin-tuc/` 104) thành 120–160 ký tự; thêm `<lastmod>` cho sitemap.
9. P2 Thêm `lang="zh-CN"` cho chữ Hán trên trang Thâm Quyến và nhãn form; nhờ người bản ngữ duyệt bản zh.
10. P2 Local SEO Bắc Ninh: hoàn tất Google Business Profile của VIPORDER theo `G04_LOCAL_SEO_GBP.md` (NAP khớp đúng địa chỉ Đồng Nguyên); xuất bản bài `kien-thuc` Thâm Quyến khi owner duyệt nguồn.

## Phân loại tổng hợp

- **P0**: không có (không lọt trang nháp hay dữ liệu MẪU, không khai sai giá, rating hay địa chỉ VIP GROUP; sitemap đúng).
- **P1 (5)**: khẳng định phạm vi giao Hà Nội/TP.HCM; cách gọi "kho/Door to Door" ở Thâm Quyến và Bắc Ninh; H2 bảng giá Thâm Quyến hứa mà không có giá; hub `/logistics/` tranh từ khóa với `/van-chuyen-trung-quoc-viet-nam/`; trang Bắc Ninh/Thâm Quyến thiếu link từ trang chủ.
- **P2 (9)**: FAQ "m³" không nguồn; mô tả các hình thức pending; title "Trung Việt" thừa; Offer không nhất quán; HowTo/FAQ ít giá trị rich result; meta description ngắn; thiếu lastmod; thiếu lang zh trên trang Thâm Quyến; anchor chung chung.
