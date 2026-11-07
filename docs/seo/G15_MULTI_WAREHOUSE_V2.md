# G15 — SEO MULTI-WAREHOUSE V2 · VIPG-WEB-026

**Trạng thái:** đã hoàn thiện trên nhánh `feature/vipg-web-026-multi-warehouse` (base `feature/vipg-web-025-seo-v11@d7b70c1`).
Chưa push, chưa merge, **chưa triển khai production, không đổi DNS/Cloudflare**.
**Soạn:** phiên Controller ec, 06/11/2026. Phiên 8d (giữ quyền ghi repo) review và áp vào repo.

---

## 1. Phạm vi đã làm

| # | Trang | URL | Trạng thái |
|---|---|---|---|
| 1 | Mạng lưới 4 kho Trung Quốc | `/logistics/kho-trung-quoc/` | ready (index, sitemap) |
| 2 | Thâm Quyến → Việt Nam | `/logistics/van-chuyen-tham-quyen-ve-viet-nam/` | ready |
| 3 | Hạ Môn → Việt Nam | `/logistics/van-chuyen-ha-mon-ve-viet-nam/` | ready |
| 4 | Quảng Châu → Việt Nam | `/logistics/van-chuyen-quang-chau-ve-viet-nam/` | ready |
| 5 | Nghĩa Ô → Việt Nam | `/logistics/van-chuyen-nghia-o-ve-viet-nam/` | ready |

**URL bỏ:** `/logistics/kho-quang-chau/` (nháp), `/logistics/kho-tham-quyen/` (nháp) và `/logistics/van-chuyen-tham-quyen-viet-nam/` (ready trên nhánh 025, **chưa lên staging/production**). Link ngữ cảnh trên trang chủ (P1-5 của G13) đã đổi sang URL mới, giữ nguyên chữ hiển thị. Các URL này chưa từng có trên production nên không cần chuyển hướng 301. Nếu nhánh 025 được phát hành trước V2, cần thêm 301 từ `/logistics/van-chuyen-tham-quyen-viet-nam/` sang URL mới, cấu hình trong `public/_redirects`.

**Lý do đặt URL trong `/logistics/`:** thống nhất breadcrumb (Trang chủ › Logistics › Kho Trung Quốc › Tuyến), menu phụ và cụm chủ đề. Slug dùng mẫu `van-chuyen-<kho>-ve-viet-nam` khớp từ khóa owner chỉ định ("vận chuyển … về Việt Nam").

### Chức năng cho khách hàng
- **Địa chỉ tiếng Trung nguyên văn** (`lang="zh-CN"`, `translate="no"` để trình duyệt không tự dịch) và **nút "Sao chép địa chỉ · 复制地址"**:
  - dùng Clipboard API; khi trình duyệt chặn thì tự bôi đen để khách sao chép tay;
  - thông báo kết quả qua `aria-live`;
  - khi tắt JavaScript, địa chỉ vẫn hiển thị và nút được ẩn.
- **Hướng dẫn gửi hàng 4 bước** cho từng kho, dựa trên quy trình VIPORDER công bố.
- **Phần tiếng Trung riêng cho nhà cung cấp** (`<section lang="zh-CN">`): 发货须知, địa chỉ, các bước, hàng thường gửi, FAQ tiếng Trung.
- **Báo giá:** dẫn tới form thu lead ở `/logistics/bang-gia/#form-lien-he`, kèm nút Gọi / Zalo **0961 102 655** và thanh liên hệ cố định trên điện thoại (có sẵn trong layout).
- **Không công khai** tên người nhận, số điện thoại kho, mã khách hàng. Có test chặn số di động Trung Quốc và mọi số Việt Nam khác hotline.

### Bảng giá: áp dụng đúng phạm vi
- Bảng giá đã phát hành là bảng **"Trung Quốc – Việt Nam" chung**. Owner **chưa xác nhận** bảng này áp dụng cho từng kho, nên trang tuyến **không hiện đơn giá** và không khai `Offer`; chỉ hiện:
  - cách tính khối lượng tính cước (hệ số 6000, owner xác nhận);
  - link tới bảng giá chung;
  - câu "đơn giá cho hàng nhận tại kho X được xác nhận khi báo giá".
- Từng kho có trường `priceApplies` (đang chờ owner). Owner xác nhận kho nào thì điền `value` và `source` cho kho đó; trang tuyến của kho sẽ tự đổi câu chữ sang "Áp dụng bảng giá…".
- Đã có test chặn đơn giá và `"offers"` xuất hiện trên trang tuyến.

## 2. SEO kỹ thuật

| Hạng mục | Cách làm | Kiểm chứng |
|---|---|---|
| Title / description / H1 riêng | Khai trong `pages[]` (`src/data/vi/logistics.ts`). Title ≤ 70 ký tự kể cả " \| VIP GROUP"; description 50–170 ký tự | Test "chống trùng lặp" toàn site + test độ dài |
| Canonical / robots | Trang ready có canonical tuyệt đối, không noindex | Test `trang ready: được lập chỉ mục, canonical đúng` |
| Sitemap | Tự sinh từ trạng thái trang: thêm 5 URL (21 URL tổng) | Test sitemap |
| Liên kết nội bộ | Hub, trang Bắc Ninh, trang Trung–Việt → thẻ 4 kho (`PickupCards`). Mỗi trang tuyến → trang mạng lưới, 3 kho còn lại, trang chủ, trang Công ty thành viên, Tra cứu. Menu phụ chỉ thêm 1 mục "Kho Trung Quốc" | Test V2 liên kết |
| Breadcrumb | Trang chủ › Logistics › Kho Trung Quốc › Tuyến (BreadcrumbList) | Test V2 |
| Structured data | Mạng lưới: Service, ItemList (4 tuyến), 4 Place, WebPage, FAQPage. Tuyến: Service (provider VIPORDER, brand VIP GROUP, availableLanguage vi + zh-CN), Place (địa chỉ nguyên văn, addressCountry CN), WebPage (dateModified), FAQPage (chỉ câu có căn cứ, không gồm câu "mất bao lâu") | Test Place khớp địa chỉ hiển thị; câu hỏi trong schema phải hiển thị trên trang |
| Song ngữ | Một URL, khối tiếng Trung gắn `lang="zh-CN"`. Không khai hreflang vì không có URL tiếng Trung riêng | — |
| Googlebot truy cập | HTML tĩnh, nội dung không cần JS; robots.txt không chặn `/logistics/` | Test tắt JS (E2E) |
| Hiệu năng | CSS/JS nội tuyến, không font hay ảnh ngoài; trang không gọi domain ngoài | E2E: 0 request ra ngoài trên 7 trang V2 |

## 3. Bộ từ khóa Việt – Trung

| Trang | Từ khóa chính | Biến thể / long-tail | Tiếng Trung (khách Trung Quốc / nhà cung cấp) |
|---|---|---|---|
| Mạng lưới | kho Trung Quốc | kho nhận hàng Trung Quốc, địa chỉ kho Trung Quốc, kho hàng Trung Quốc về Việt Nam | 中国仓库地址, 中国到越南物流仓库 |
| Thâm Quyến | vận chuyển trung việt từ thâm quyến về việt nam | vận chuyển Thâm Quyến về Việt Nam, kho Thâm Quyến, ship hàng Thâm Quyến về Hà Nội, "thẩm quyến" (sai chính tả) | 深圳到越南物流, 深圳发货到越南, 深圳宝安仓 |
| Hạ Môn | vận chuyển Hạ Môn về Việt Nam | kho Hạ Môn, hàng Phúc Kiến về Việt Nam, giày dép Tấn Giang về Việt Nam | 厦门到越南物流, 福建发货到越南 |
| Quảng Châu | vận chuyển Quảng Châu về Việt Nam | kho Quảng Châu, kho Bạch Vân, hàng 1688 Quảng Châu về Việt Nam | 广州到越南物流, 广州白云仓 |
| Nghĩa Ô | vận chuyển Nghĩa Ô về Việt Nam | kho Nghĩa Ô, hàng Yiwu về Việt Nam, chợ Nghĩa Ô | 义乌到越南物流, 义乌发货到越南 |

Mỗi cụm có đúng một URL đích, các trang tuyến không tranh từ khóa của nhau. Cụm rộng "vận chuyển Trung Quốc – Việt Nam" vẫn thuộc `/logistics/van-chuyen-trung-quoc-viet-nam/`.

## 4. Tối ưu cho Google AI Overview / AI Mode / Gemini

- **Khối "Tóm tắt nhanh"** ở đầu mỗi trang, dưới 100 từ, trả lời thẳng các ý: ai nhận hàng, ở đâu (quận, tỉnh), gửi thế nào, tính cước ra sao, liên hệ số nào. Có thêm bản tiếng Trung và dòng "Cập nhật: 06/11/2026" kèm tên pháp nhân vận hành.
- **Bảng so sánh 4 kho** (tỉnh, khu vực, nhóm hàng) và danh sách "chọn kho theo nguồn hàng", dạng dữ liệu AI dễ tổng hợp.
- **FAQ theo từng tuyến:** địa chỉ, cách gửi, cách tính cước, thời gian, cộng một câu riêng mỗi kho (phân biệt kho Shopee; chọn Hạ Môn hay Quảng Châu; đặt 1688 về Quảng Châu; cửa Tây / thang hàng số 5 ở Nghĩa Ô).
- **Câu hỏi AI Overview đang trả lời và mức sẵn sàng của dữ liệu:**

| Chủ đề | Trạng thái |
|---|---|
| Địa điểm nhận hàng | **Đủ** (4 địa chỉ owner xác nhận) |
| Quy trình giao nhận | **Đủ** |
| Cách tính cước | **Đủ** (khối lượng tính cước, hệ số 6000) |
| Giá cước theo tuyến | **Thiếu**: chưa xác nhận bảng giá chung áp dụng cho kho nào |
| Thời gian vận chuyển | **Thiếu** |
| Phạm vi giao tại Việt Nam | **Một phần** (khu vực Bắc Ninh) |

## 5. Kiểm thử (đo 06/11/2026, trên clone, base d7b70c1)

| Kiểm thử | Kết quả |
|---|---|
| `astro check` | 0 lỗi, 0 cảnh báo |
| `npm test` | **167/167 PASS**. Có 6 test V2: địa chỉ nguyên văn + nút sao chép + Place khớp; trang tuyến (liên kết mạng lưới, phần zh-CN, breadcrumb, FAQPage, lưu ý giao hàng riêng, không đơn giá/Offer, không lộ SĐT kể cả +86 / số bàn TQ); mạng lưới (ItemList, menu phụ, link từ hub và Bắc Ninh, không đơn giá, FAQPage không trùng trang Hỏi đáp); URL cũ không còn; không khẳng định sở hữu kho (gồm 自有/自营/我司); DEMO không biến dữ liệu mẫu thành câu khẳng định. G09 (hotline chỉ khai ở contact.ts) vẫn đạt |
| E2E V2 `npm run test:e2e:v2` | **148/148 PASS**. Gồm: 7 trang × prod/demo × desktop/mobile, 0 lỗi console/CSP, không tràn ngang, 0 request ra ngoài, vùng chạm ≥ 44 px; URL cũ trả 404; nút sao chép chép đúng nguyên văn cả 4 kho; `copy_address` ghi result=copied/selected và không chứa địa chỉ; dự phòng khi clipboard bị chặn; nút có tên riêng theo kho; tắt JS thì nút ẩn, địa chỉ vẫn hiện. Kết quả lưu ở `evidence/v2/` |
| E2E logistics cũ (`tests/e2e/logistics.e2e.mjs`, đã đổi URL Thâm Quyến) | **204/204 PASS** |

### Kiểm tra độc lập (agent verifier, không sửa code) và cách xử lý

| Mức | Phát hiện | Xử lý |
|---|---|---|
| P0 | V2 dựng trên base cũ, thiếu v1.2 (hotline tập trung G09) | Rebase lên `d7b70c1`; mọi số hotline lấy từ `contact.hotlineDisplay` / `provider` |
| P1 | FAQ mô tả "kho Thâm Quyến của Shopee" không có nguồn | Viết lại trung tính: "không liên quan tới Shopee hay sàn TMĐT nào" |
| P1 | DEMO hiện "Áp dụng bảng giá" từ dữ liệu mẫu, không có nhãn | Chỉ dùng giá trị đã xác minh; có test |
| P1 | 4 trang tuyến giống nhau 81–83% | Thêm mục "Lưu ý khi giao hàng tới kho X" (vi + zh) diễn giải từ chính địa chỉ; rút gọn khối cách tính cước. **Còn lại:** muốn nội dung khác biệt hơn nữa cần dữ liệu thật từ owner (ảnh kho, giờ nhận, thời gian, lưu ý vận hành) |
| P1 | E2E V2 không có lệnh chạy | Thêm `npm run test:e2e:v2`, lưu kết quả vào `evidence/v2/` |
| P2 | Nút sao chép trùng tên, timer, đo lường cả khi thất bại, thông báo thiếu tiếng Trung | Thêm tên kho ẩn cho trình đọc màn hình; `clearTimeout`; đo `copied`/`selected`; thông báo song ngữ |
| P2 | Bảng cuộn ngang không dùng được bằng bàn phím | `role="region"` + `tabindex="0"` + `aria-labelledby` |
| P2 | Chữ Hán trong câu tiếng Việt thiếu `lang` | Component `Mixed.astro` tự bọc `lang="zh-CN"` |
| P2 | Câu zh gượng; mô tả Phúc Kiến chưa chính xác; description "bảng giá"; FAQPage trùng; link không qua `linkable` | Đã sửa cả 5 |

## 6. Dữ liệu còn thiếu (OWNER INPUT PENDING)

| # | Cần owner cung cấp | Mở khóa |
|---|---|---|
| 1 | **Mâu thuẫn cách áp mức giá:** tin nhắn Project Controller (V1, V2) ghi "tính theo trọng lượng **từng kiện**", còn câu trả lời gửi phiên 8d ghi "theo **tổng khối lượng cả lô**". Code hiện theo bản "cả lô" (đã phát hành trên nhánh 025). Cần một câu chốt | Câu chữ `pricing.basis`, FAQ bảng giá |
| 2 | Bảng giá chung áp dụng cho kho nào (Thâm Quyến / Hạ Môn / Quảng Châu / Nghĩa Ô)? Kho nào có giá riêng? | `priceApplies` từng kho → hiện giá trên trang tuyến |
| 3 | Thời gian vận chuyển từ từng kho về Hà Nội / Bắc Ninh (và TP.HCM nếu có) | `transitTime`, câu FAQ "mất bao lâu" vào FAQPage, title |
| 4 | Giờ nhận hàng từng kho | `receivingHours` |
| 5 | **Ảnh kho thật** (≥ 2 ảnh/kho: cổng hoặc biển, khu nhận hàng) và quyền đăng | `photos`, tăng E-E-A-T |
| 6 | Phạm vi giao tại Việt Nam ngoài Bắc Ninh | trang Liên hệ, FAQ |
| 7 | Người bản ngữ duyệt bản tiếng Trung | toàn bộ khối `lang="zh-CN"` |
| 8 | Thông tin pháp nhân VIPORDER (mã số thuế) để công khai | schema provider, E-E-A-T |

## 7. Đo lường

Thực hiện theo `docs/seo/G10_GSC_AI_SEARCH_MONITORING.md`, bổ sung cho V2:
- **GSC → Kiểm tra URL → Yêu cầu lập chỉ mục**, theo thứ tự: `/logistics/kho-trung-quoc/`, 4 trang tuyến, rồi `/logistics/`.
- **Bộ truy vấn theo dõi** thêm cho mỗi kho mới: "vận chuyển Hạ Môn về Việt Nam", "kho Quảng Châu", "vận chuyển Nghĩa Ô về Việt Nam", "义乌到越南物流", "厦门到越南物流", "广州到越南物流".
- **Lọc truy vấn GSC:** `hạ môn`, `quảng châu`, `nghĩa ô`, `yiwu`, `义乌`, `厦门`, `广州`, `深圳`.
- **Sự kiện mới `copy_address`** (route = mã kho) cho biết kho nào được quan tâm. Đọc trong GA4 khi owner gắn Measurement ID.
- **Nguyên tắc:** chỉ ghi kết quả đo thực tế, có ngày giờ và ảnh chụp. Không tuyên bố đã lên top hoặc đã được AI trích dẫn khi chưa có bằng chứng.

## 8. Đề xuất triển khai (chờ owner phê duyệt thao tác cuối)

1. Phiên 8d review patch V2, áp vào repo trên nhánh `feature/vipg-web-026-multi-warehouse` và chạy lại `npm test`.
2. Push nhánh → PR vào `develop` → CI → verifier → merge → staging (`staging.vip-group.pages.dev`). Owner xem 5 trang trên staging, cả điện thoại lẫn máy tính.
3. Owner trả lời mục 6.1 (từng kiện hay cả lô). Cần chốt trước khi phát hành, vì câu chữ giá đang hiển thị trên trang chủ.
4. PR `develop → main` → **owner ra lệnh** → `production.yml`. Không đổi DNS/Cloudflare.
5. Sau phát hành: gửi sitemap và yêu cầu lập chỉ mục 5 URL; đo baseline AI Overview/Gemini theo G10.

**Rollback:** Cloudflare Pages → Deployments → Rollback, hoặc `git revert` merge commit. Thay đổi chỉ cộng thêm trang và chỉnh link nội bộ, không ảnh hưởng trang tập đoàn.

---

## 7. CẬP NHẬT 07/11/2026 — GIÁ ĐÃ CHỐT (phiên 8d tích hợp)

- **Owner directive 07/11/2026:** bảng giá chung (20.000 / 16.000 / 15.000 / 14.000 / 12.000 đ/kg) **áp dụng cho cả 4 kho**; bậc giá chọn theo **trọng lượng tính cước của TỪNG KIỆN**, không gộp cả lô; trọng lượng tính cước kiện = max(cân thực, D×R×C cm ÷ 6000).
- Mâu thuẫn "từng kiện" / "cả lô" (§1, §6) **đã được owner giải quyết**: từng kiện. Câu "cả lô" (xác nhận 06/11) đã thay trên toàn site.
- `priceApplies` 4 kho: có value + nguồn `SRC_OWNER_PRICE`. Trang tuyến + mạng lưới hiện bảng 5 bậc, FAQ vi/zh nêu đủ 5 mức, JSON-LD `offers` (eligibleQuantity "kg/kiện").
- Logic dùng chung `src/lib/pricing.ts` (công cụ tính + test `tests/pricing-policy.test.mjs`).
- **Còn hỏi owner:** làm tròn trọng lượng (0,1 / 0,5 / 1 kg — hiện KHÔNG làm tròn, kiện 5,02 kg → 16.000); bậc 500 kg và trên 1.000 kg cho một kiện (pallet) có đúng ý; cước tối thiểu mỗi kiện.
