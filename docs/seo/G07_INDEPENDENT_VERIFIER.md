# G07 — Independent Verifier (QA/Security) · VIPG-WEB-021

- Nhánh: `feature/vipg-web-021-logistics-seo`, base `develop@2c998ed`. Ngày kiểm: 06/11/2026.
- Người kiểm: Independent Verifier. Không phải người viết code, không sửa `src/`, `tests/` hay config, không commit/push/deploy.
- Phạm vi: diff `git diff 2c998ed` (14 file sửa) + file mới chưa track (`src/components/logistics/*`, `src/data/vi/logistics.ts`, `src/layouts/LogisticsLayout.astro`, `src/lib/*`, `src/pages/logistics/**`, `tests/logistics.test.mjs`, `tests/e2e/*`).
- Ghi chú quy trình: trong lúc kiểm, worktree vẫn có người sửa (`README.md` lúc 11:53, `docs/seo/G04–G06` lúc 11:52–11:53). Lúc 11:55 tôi so `src/` của bản sao với repo gốc và hai bên giống hệt nhau, nên kết quả dưới đây áp dụng cho `src/` tại thời điểm đó. Nếu tác giả còn sửa `src/` thì phải chạy lại `npm test`.

## Kết luận: **FAIL (có điều kiện)**

Phần kỹ thuật đạt: build production sạch dữ liệu mẫu, CSP còn nguyên, form không gửi dữ liệu đi, JSON-LD hợp lệ, noindex/canonical/sitemap nhất quán. Còn **1 P0 về trung thực nội dung**: các trang được lập chỉ mục khẳng định có kho Quảng Châu và Thâm Quyến, nhưng chưa có nguồn. Khi owner xác nhận việc này bằng văn bản và ghi nguồn vào repo, hoặc gỡ các khẳng định đó khỏi trang `ready`, kết luận chuyển thành **PASS WITH FINDINGS**. Các mục P1 nên sửa trước khi merge.

## 1. Kiểm tra tự động

| Lệnh | Kết quả |
|---|---|
| `npm run check` | 73 file, 0 errors · 0 warnings · 0 hints (exit 0) |
| `npm test` (pretest = `astro build`) | **131/131 pass**, 0 fail, khoảng 55 s. Có test DEMO tự build `dist-demo/` |
| Bản sao `/tmp/verifier-copy` (node_modules symlink, cùng phiên bản astro) | baseline 131/131 pass |

Lưu ý: `tests/e2e/*.mjs` không nằm trong glob `tests/*.test.mjs`, nên CI không chạy e2e.

## 2. Kiểm `dist/` (production) và `dist-demo/` (DEMO)

Tôi dùng script riêng (`/tmp/vf-scripts/audit.py`, `csp.py`) để parse mọi file HTML.

**Production `dist/` (18 trang)**
- Không còn dữ liệu mẫu trong nội dung hiển thị. Đã quét text và HTML thô tìm `MẪU`, `[MẪU]`, `KHÔNG PHẢI ĐỊA CHỈ THẬT`, `Bạch Vân`, `Long Cương`, `09:00`, `3–5 ngày`, `6000`, giá kèm `đ/₫/VND`, khoảng thời gian `n–m ngày`, giờ `hh:mm`, các tỉnh mở rộng mẫu và `cửa khẩu`. Chỉ khớp tên class CSS (`.sample-tag`, `.sample-value`). Công cụ tính có `data-divisor=""` (rỗng). Không có bảng giá. Không có `_astro/*.js` vì mọi script được nhúng thẳng.
- Trạng thái lập chỉ mục khớp với trạng thái trang:
  - 7 trang logistics `ready`: không có noindex, canonical và og:url đúng URL, có trong sitemap.
  - 3 trang `pending` (`kho-quang-chau`, `kho-tham-quyen`, `bang-gia`): `noindex`, không canonical, không og:url, không có trong sitemap.
  - Các trang `draft` (`/logistics/kien-thuc/**`) không được build.
  - Sitemap có 14 URL, không trùng, không có trang nào vừa noindex vừa nằm trong sitemap.
- JSON-LD: mọi khối đều parse được và có `@context`. Organization VIP GROUP luôn đứng đầu, `addressRegion: "Tỉnh Lạng Sơn"`, không chứa "Bắc Ninh". `Service.provider` là VIPORDER với legalName và url đúng. Không có `offers`, `priceRange`, `aggregateRating` hay `Review`. FAQPage chỉ có 7 câu không ở trạng thái pending, và cả 7 câu đều hiển thị trên trang. Có thêm HowTo (quy trình) và BreadcrumbList trên mọi trang logistics.
- Title, description và H1 không trùng nhau trên toàn site (trừ 404). Title dài 54–64 ký tự, description 119–145 ký tự.
- Không có link nội bộ hỏng. Anchor `#bao-gia` tồn tại. Mọi link `target="_blank"` đều có `rel="noopener"`. Link sang viporder (`#tracking`, `#register`, `https://zalo.me/0968961962`, `https://khachhang.viporder.com.vn/login`) đều có thật trên trang nguồn.

**DEMO `dist-demo/` (22 trang)**
- Mọi trang đều `noindex` và không có canonical. Có 4 trang nháp `kien-thuc`. Dữ liệu mẫu luôn gắn nhãn `MẪU` hoặc `[MẪU]`, có banner "BẢN DEMO NGHIỆM THU". Build DEMO không ghi đè `dist/`, và CI/production chỉ deploy `dist/`.
- Lệch nhỏ: `dist-demo/sitemap.xml` vẫn liệt kê 8 URL từ menu chính (kể cả `/logistics/`), trong khi các trang này đều noindex. Xem P2-1.

## 3. Đối chiếu khẳng định với nguồn https://viporder.com.vn

Tôi fetch bằng `curl` lúc 06/11/2026 (HTTP 200, 26.859 byte). Nguồn **có** các nội dung sau:
- 4 dịch vụ: Vận chuyển Trung–Việt, Nhập khẩu chính ngạch, Khai báo hải quan, 1688/Taobao/Pinduoduo. Câu chữ trùng gần như nguyên văn với `services`.
- Quy trình 4 bước (Đăng ký → Gửi hàng → Theo dõi → Nhận hàng "tại kho hoặc theo phương án giao hàng").
- Tra mã vận đơn hoặc mã bao, không cần đăng nhập. Cổng `khachhang.viporder.com.vn`.
- Hotline/Zalo 0968 961 962. Địa chỉ "Số 62 Khu đô thị Nam Hồng, Đồng Nguyên, Bắc Ninh".

Tên pháp lý "CÔNG TY TNHH XUẤT NHẬP KHẨU LOGISTICS VIP ORDER" và quan hệ "cùng chủ sở hữu" **không có** trên viporder.com.vn. Tuy vậy, hai thông tin này có nguồn owner chốt ngày 24/10 (`src/data/vi/subsidiaries.ts`), nên đạt yêu cầu.

**Khẳng định KHÔNG có trong nguồn và không tìm thấy dữ liệu owner chốt trong repo:**

| # | Khẳng định | Vị trí | Trang | Mức |
|---|---|---|---|---|
| A | **Có kho Quảng Châu và kho Thâm Quyến** (viporder.com.vn không nhắc tới Quảng Châu, Thâm Quyến hay 广州/深圳) | `src/data/vi/logistics.ts:176-178` (title/description hub), `:212-216`, `:225-229`; `src/pages/logistics/index.astro:52-63`; `van-chuyen-trung-quoc-viet-nam.astro:58-59`; `van-chuyen-trung-quoc-bac-ninh.astro:90-98` | hub `/logistics/` (ready, indexed), Trung–Việt, Bắc Ninh | **P0** |
| B | Nhận hàng tại Bắc Ninh / "đầu mối nhận hàng ngay tại Bắc Ninh". Nguồn chỉ nói đây là văn phòng, không nói đây là điểm nhận hàng hay có kho | `index.astro:65-70`; `van-chuyen-trung-quoc-bac-ninh.astro:25,36-38,58,74-76`; `logistics.ts:155-157` (FAQ này **có trong FAQPage**) | ready | P1 |
| C | "Gom hàng / gom nhiều đơn nhỏ tại kho Trung Quốc" (dịch vụ gom hàng) | `logistics.ts:178,202,204`; `van-chuyen-trung-quoc-viet-nam.astro:24`; `index.astro:21,54` | ready | P1 |
| D | Khu vực ưu tiên "Bắc Ninh, Từ Sơn, Đồng Kỵ, các KCN lân cận" và "ưu tiên khách hàng tại Bắc Ninh". Comment ở dòng 112 ghi "có nguồn công khai" nhưng nguồn chỉ có địa chỉ văn phòng | `logistics.ts:111-113,180`; `lien-he.astro:32,35`; `van-chuyen-trung-quoc-bac-ninh.astro:52,59` | ready | P1 |
| E | Nhóm hàng phù hợp từng kho (thời trang/gia dụng cho QC, linh kiện điện tử cho TQ) | `logistics.ts:73,84` (hiển thị trên hub ready) | ready | P1 (đi cùng A) |
| F | Chính sách "Không nhận hàng cấm…" (có trong FAQPage) | `logistics.ts:164-166` | ready | P2 (nghĩa vụ pháp luật chung, nhưng vẫn là chính sách dịch vụ) |
| G | "Doanh nghiệp… có xuất hóa đơn được không?" Câu trả lời không xác nhận, nhưng câu hỏi vẫn vào FAQPage | `logistics.ts:136-138` | ready | P2 |
| H | "Địa chỉ kho được cung cấp khi bạn đăng ký mã khách hàng và liên hệ" | `WarehouseBody.astro:22,46` | pending (noindex) | P2 |
| I | "Chọn kho gần nhà cung cấp để gom hàng nhanh và tiết kiệm chi phí" | `index.astro:54` | ready | P1 (đi cùng A/C) |

Bài `kien-thuc` (draft) chỉ có ở DEMO, nên không xét là nội dung công khai.

## 4. Bảo mật và riêng tư

- **Form báo giá, khi tắt JS** (`QuoteForm.astro:25-79`): form không có `action`/`method`. Ô chữ không có `name` (chỉ radio có `name="qf-route"`). Nút submit `disabled`. CSP có `form-action 'none'`. Vì vậy không thể gửi dữ liệu. Giả sử cả ba lớp đều hỏng, dữ liệu duy nhất lọt ra URL là `qf-route=<giá trị radio>`, không phải PII.
- **Form báo giá, khi bật JS**: `e.preventDefault()`. Nội dung ghép vào `textarea.value`, trạng thái ghi qua `textContent`, không dùng `innerHTML`. `mailto` dùng `mailto:${data-email}` (giá trị build-time) và body qua `encodeURIComponent`, nên không chèn được header hay script. `window.open(data-zalo,'_blank','noopener')` dùng URL cố định. Không có `fetch` hay XHR, và `connect-src 'self'`. **XSS từ dữ liệu người dùng không khả thi.**
- **CSP** (`<meta>` trên cả 18 trang production và 22 trang DEMO): không có `unsafe-inline` hay `unsafe-eval`, `form-action 'none'` còn nguyên. Tôi tính SHA-256 cho **mọi** `<script>` và `<style>` inline: tất cả khớp hash trong CSP. Không có `style=""` hay `on*=""` inline. Không có `<script src>` ngoài.
- **dataLayer** (`TrackEvents.astro:10-23`): chỉ có `event`, `page_path`, `link_location`, `route`, `service`. Code hiện tại **không chứa PII**. Không tải GTM/GA hay script bên thứ ba nào.
- Nhãn email: form ghi "tự gửi nội dung cho đội ngũ VIPORDER", nhưng mailto đi tới `viporder@vipgroup.com.vn` (hộp thư trên domain VIP GROUP, owner đã chốt). Không phải rò rỉ, nhưng nên ghi rõ người nhận (P2-6).

## 5. Accessibility cơ bản

| Cặp màu | Tỉ lệ | WCAG AA |
|---|---|---|
| `#6b4e00` trên `#fff4d6` (viền/nhãn banner) | 7.06 | Đạt |
| `#fff` trên `#6b4e00` (nhãn MẪU, 11px đậm) | 7.74 | Đạt |
| `#3d2c00` trên `#fff4d6` (chữ banner) | 12.29 | Đạt |
| `--brand-ink #b80617` trên nền subnav đang chọn (≈`#fbebed`) | 5.92 | Đạt |
| `rgba(255,255,255,.9)` trên `--brand` (CTA `.muted`) | 4.71 | Đạt |
| `--muted #5b5f66` trên `#f6f6f7` (source-note, calc dt) | 5.94 | Đạt |
| `--brand-ink` trên `#fff3f4` (hover nút trắng) | 6.30 | Đạt |

- Mọi `<label for>` đều trỏ tới id có thật. Radio nằm trong `fieldset` + `legend`. `role="status" aria-live="polite"` có mặt. Khi lỗi, focus chuyển tới ô sai đầu tiên và ô đó có `aria-invalid`. Mọi `aria-labelledby` đều trỏ tới id có thật. Không có id trùng.
- Thứ tự heading trên 11 trang production và 4 trang DEMO không nhảy cấp (h1 → h2 → h3).
- Focus: dùng `:focus-visible` toàn cục 2px `#d0071a`, và đổi sang trắng trên nền đỏ (`.lg-cta`, `.dark`).
- Link mở tab mới có chữ ẩn "(mở tab mới)".

## 6. Kiểm test bằng đột biến

Tôi làm trên bản sao `/tmp/verifier-copy`, không bao giờ đụng repo gốc. Mỗi đột biến: build lại, chạy toàn bộ `node --test tests/*.test.mjs`, rồi hoàn nguyên. Sau cùng tôi kiểm `diff -rq src` và xác nhận bản sao đã khớp lại với gốc.

| # | Đột biến | Kết quả | Đánh giá |
|---|---|---|---|
| M1 | `kho-quang-chau` đổi `status 'pending'` → `'ready'` | **4 fail** (sitemap ×3, noindex/canonical) | Bắt đúng |
| M2 | thêm `name="hoten"` vào `#qf-name` | **1 fail** (form báo giá) | Bắt đúng |
| M3a | `transitTime: { value: '3–5 ngày làm việc', source: null }` | **1 fail** (không có thời gian giao) | Bắt đúng |
| M3b | `address: { value: '广州市白云区石井街道 88号', source: null }` (địa chỉ trông như thật, **không có nguồn**) | **0 fail** | **LỌT** |
| M4 | FAQ cước: thêm "Giá chỉ từ 25.000 đ/kg, hàng về trong 3 ngày." và bỏ `pending` (câu vào FAQPage) | **0 fail** | **LỌT** |
| M5 | `quote_send_zalo` thêm `phone: val('qf-phone')` vào dataLayer | **0 fail** | **LỌT** |
| M6 | bỏ `disabled` ở nút submit | **1 fail** | Bắt đúng |
| M7 | `shown()` bỏ điều kiện `DEMO` (mẫu lọt ra production) | **3 fail** | Bắt đúng |
| M8 | hub thêm link tới bài nháp `/logistics/kien-thuc/…` | **2 fail** | Bắt đúng |

Nguyên nhân M4 lọt: `tests/logistics.test.mjs:103` dùng `/\d[\d.,]*\s*(đ|₫|VNĐ|vnđ|VND)\b/` không có cờ `u`, nên `\b` của JS chỉ xét ký tự ASCII. Vì `đ`, `₫`, `Đ` không phải "word char", sau chúng không bao giờ có `\b`. Tôi chạy thử bằng `node`: `"00.000 đ "`, `"25.000đ/kg"`, `"25.000 ₫."`, `"100.000 VNĐ "` đều cho **false**. Regex chỉ bắt được đúng dạng `VND`. Dòng 104 chỉ bắt dạng khoảng `n–m ngày`, còn "3 ngày", "48h", "3 đến 5 ngày" đều lọt.

## Phát hiện

### P0 — chặn phát hành
**P0-1. Trang được lập chỉ mục khẳng định có kho Quảng Châu và Thâm Quyến khi chưa có nguồn.**
- Vị trí: `src/data/vi/logistics.ts:176-178` (title "Logistics Trung – Việt: kho Quảng Châu, Thâm Quyến", description "kho Quảng Châu, Thâm Quyến gom hàng về Bắc Ninh…"); `src/pages/logistics/index.astro:47-63`; `van-chuyen-trung-quoc-viet-nam.astro:58-59`; `van-chuyen-trung-quoc-bac-ninh.astro:87-98`.
- Bằng chứng: nội dung viporder.com.vn không chứa "Quảng Châu", "Thâm Quyến", 广州 hay 深圳. `docs/seo/G00_DISCOVERY_BASELINE.md:56` chỉ ghi *địa chỉ* kho là pending, không có dòng nào ghi owner xác nhận *có* kho. `G01_G02…:57` tự đặt quy tắc "chỉ tạo `/logistics/kho-<ten>/` khi có kho thật".
- Đề xuất: (a) owner xác nhận bằng văn bản rằng có kho nhận hàng tại QC/TQ, và ghi nguồn đó (ngày, người chốt) vào `logistics.ts` cũng như G00 §4; hoặc (b) cho tới lúc đó, đổi title, description và nội dung hub/Trung–Việt/Bắc Ninh sang cách nói trung tính ("nhận hàng tại Trung Quốc") và ẩn các card kho trên trang `ready`.

### P1 — nên sửa trước khi merge
1. **Khẳng định dịch vụ chưa có nguồn trên trang `ready`** (bảng §3, các mục B, C, D, E, I): nhận hàng tại Bắc Ninh (có trong FAQPage), dịch vụ gom hàng, khu vực ưu tiên Từ Sơn/Đồng Kỵ/KCN, nhóm hàng theo kho. Comment `logistics.ts:112` ghi "có nguồn công khai" là sai. Đề xuất: lấy xác nhận của owner, hoặc viết lại sát câu chữ nguồn ("Nhận hàng tại kho hoặc theo phương án giao hàng", "Văn phòng tại …"), và chuyển `serviceArea.focus` sang dạng `Fact` có `source`.
2. **Regex chặn giá và thời gian giao không có tác dụng** (`tests/logistics.test.mjs:103-104`; M4 lọt). Đề xuất: dùng `/\d[\d.,]*\s*(?:k|nghìn|ngàn|triệu)?\s*(?:đ|₫|vnđ|vnd|đồng)(?![\p{L}])/iu` cho giá, và `/\d+\s*(?:[–-]|đến)?\s*\d*\s*(?:ngày|giờ|h)\b/iu` cho thời gian. Thêm một self-test: chạy regex trên `dist-demo/logistics/bang-gia/` và assert nó **bắt được** giá mẫu.
3. **Thiếu bất biến "có `value` thì phải có `source`"** (M3b lọt). Đề xuất: thêm unit test import `src/data/vi/logistics.ts` (qua `tsx` hoặc build), duyệt mọi `Fact` và assert `value === null || (source && source.length > 0)`. Đồng thời assert các trường kho, giá và `transitTime` khớp với whitelist nguồn.
4. **Test PII của dataLayer chỉ soi sự kiện `quote_generate`** (`tests/logistics.test.mjs:199`; M5 lọt). Đề xuất: soi mọi lời gọi `track(`/`push(` (hoặc mọi object literal sau `vipg:track`), và cấm chuỗi `qf-name|qf-phone|qf-msg|qf-summary|phone|name|email|summary`.

### P2 — gợi ý
1. Sitemap ở DEMO vẫn liệt kê trang menu chính dù mọi trang noindex (`src/pages/sitemap.xml.ts:10`). Đề xuất: khi `DEMO`, trả về sitemap rỗng.
2. `Service.brand` trỏ tới Organization VIP GROUP (`src/lib/schema.ts:24`), cùng kicker "VIP GROUP Logistics" (`LogisticsLayout.astro:59`) và description "Logistics VIP GROUP…". Cách này dễ bị đọc là VIP GROUP cung cấp dịch vụ. Đề xuất: bỏ `brand`, hoặc owner chốt rõ định vị "VIP GROUP Logistics".
3. Nguy cơ cannibalization: title hub nhắm "kho Quảng Châu, Thâm Quyến", trùng ý định với 2 trang kho khi chúng chuyển `ready`. Title `bang-gia` hứa "Bảng giá" nhưng trang không có bảng. Đề xuất: bỏ từ khóa kho khỏi title hub, đổi title bảng giá thành "Báo giá vận chuyển…" cho tới khi có bảng.
4. Heading nằm trong `<summary>` (`FaqList.astro:10`): một số trình đọc màn hình làm phẳng mất ngữ nghĩa heading. Đề xuất: đặt heading bao ngoài `<details>` hoặc chấp nhận và ghi chú lại.
5. FAQ "hàng cấm" và "xuất hóa đơn" vẫn nằm trong FAQPage (mục F, G). Đề xuất: gắn `pending` cho tới khi owner duyệt câu chữ.
6. Ghi rõ người nhận email trong `QuoteForm.astro:28` (hộp thư `viporder@vipgroup.com.vn`).
7. Đưa `tests/e2e/*` vào CI, hoặc ghi rõ đó là bước thủ công.
8. Sau khi tác giả xong các thay đổi đang diễn ra (README, G04–G06), chạy lại `npm run check && npm test` trên commit cuối.

## Bằng chứng / công cụ
- Nguồn: `/tmp/vf-fetch/vo.html`, `/tmp/vf-fetch/vo.txt` (viporder.com.vn, 06/11/2026).
- Script: `/tmp/vf-scripts/audit.py` (SEO, JSON-LD, link, rò rỉ dữ liệu), `csp.py` (đối chiếu hash CSP), `contrast.py`, `mut.sh` (đột biến trên bản sao).
- Bản sao để thử đột biến: `/tmp/verifier-copy` (đã hoàn nguyên).

---

## 9. KHẮC PHỤC SAU VERIFIER (Controller, 06/11/2026)

| Phát hiện | Xử lý | Bằng chứng |
|---|---|---|
| **P0-1** khẳng định có kho Quảng Châu/Thâm Quyến | Hai trang kho chuyển `status: 'draft'`, sinh từ route động `src/pages/logistics/[kho].astro` → **không build ở production**, chỉ ở DEMO. Hub, Trung–Việt, Bắc Ninh chỉ hiện thẻ kho khi trang kho được xuất bản (`linkable()`); khi chưa có, hiện nội dung "Nhận hàng tại Trung Quốc" (có nguồn). Title/description hub bỏ chữ "kho". Nhãn form: "Quảng Châu/Thâm Quyến" là **nơi gửi hàng**, không phải kho. | Test mới `không trang ready nào khẳng định có kho…`; `dist/logistics/` không còn `kho-*` |
| P1-1 B "nhận hàng tại Bắc Ninh" | Viết lại: văn phòng tại Bắc Ninh; "nhận tại kho hoặc theo phương án giao hàng đã thỏa thuận khi báo giá" (nguyên văn nguồn). FAQ "Nhận hàng tại Bắc Ninh" → "Nhận hàng tại Việt Nam như thế nào?" | |
| P1-1 C "gom hàng" | Bỏ khỏi mọi trang ready (test chặn "gom hàng"/"gom nhiều đơn") | |
| P1-1 D khu vực ưu tiên | Comment sửa: nguồn là brief owner 06/11/2026 (thị trường mục tiêu); nhãn hiển thị "Khu vực tập trung", không cam kết giao | |
| P1-1 E nhóm hàng theo kho | Chỉ hiện trên trang kho (nay là draft) | |
| P1-2 regex giá/thời gian | Cờ `u` + lookahead Unicode; thêm "đồng/triệu/nghìn/k"; thời gian bắt cả "n ngày/giờ/tuần" (chỉ trong /logistics/) | Đột biến "Từ 25.000đ/kg" → test FAIL đúng |
| P1-3 value thiếu source | `shown()` ném lỗi khi build; test quét `src/data/vi/logistics.ts` | Đột biến địa chỉ không nguồn → test FAIL đúng |
| P1-4 PII trong dataLayer | Test quét **mọi** lời gọi `track()` trong các component | Đột biến thêm `phone` vào `quote_send_zalo` → test FAIL đúng |
| P2-1 sitemap DEMO | Sitemap DEMO rỗng (test kiểm) | |
| P2-6 người nhận email | Form ghi rõ Zalo 0968961962 hoặc email viporder@vipgroup.com.vn | |
| G (FAQ hóa đơn), F (hàng cấm) | Đổi câu hỏi: "Doanh nghiệp cần nhập khẩu chính ngạch thì làm thế nào?"; hàng cấm diễn đạt là quy định pháp luật, không phải chính sách dịch vụ | |

Chạy lại sau khắc phục: `npm run check` 0 lỗi · `npm test` **131/131 PASS** · E2E trình duyệt **189/189 PASS** · 4/4 đột biến (giá, value thiếu source, PII, kho→ready) bị bắt.
