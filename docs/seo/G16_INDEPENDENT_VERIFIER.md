# G16 — Independent Verifier (SEO Technical · Content & Chinese Localization · QA)

- **Đối tượng:** nhánh `feature/vipg-web-025-seo-v11` @ `150828888b0e4ec0dee117d3bfe186151c82eeef`. Production `origin/main` = `5ee2efd` (không đổi; trên main **chưa có trang /logistics/ nào**).
- **Người kiểm:** Independent Verifier (không viết code này). Ngày 07/11/2026.
- **Cách làm:** không sửa repo (chỉ ghi file này), không commit/push/deploy, không gọi Google Sheet/Zalo/CRM, không chạy `preview:*`, không đụng cổng 4321/4322/4351. Build và test chạy trên bản chép `/tmp/g15v/copy` (rsync, bỏ `dist*`, `.preview`, `node_modules`, `.git`; `node_modules` là symlink tới `/Users/viporder/code/vip-group/node_modules`). Đột biến chạy trên `/tmp/g15v/m_<tên>`.

## Kết luận: **PASS WITH FINDINGS**

Không có lỗi P0. Giá, ngưỡng, địa chỉ kho, hotline, canonical/sitemap/JSON-LD và CSP đều đúng. Có 3 mục P1: (1) test không bắt được câu "cả lô" viết kiểu khác; (2) `npm test` không kiểm công cụ tính cước và nút sao chép; (3) giá bị bất liên tục ở các ngưỡng, owner cần quyết định. Các mục P2 là câu chữ, tiếng Trung, mức trùng lặp nội dung và tài liệu cũ.

---

## 1. Check / test

| Lệnh | Kết quả |
|---|---|
| `npm run check` (repo) | `Result (91 files): 0 errors, 0 warnings, 0 hints` |
| `npm test` (bản chép, tự build qua `pretest`) | `tests 178 · pass 178 · fail 0 · skipped 0` (57 s) |

## 2. Giá

**Nguồn:** `src/data/vi/pricing.ts:20-24` có 5 bậc với min/max/inclusive đúng chính sách owner. `src/lib/pricing.ts:23-28` (`tierFor`) báo lỗi khi một khối lượng rơi vào 0 bậc hoặc nhiều hơn 1 bậc.

**Thử `tierFor` bằng node** (`node --experimental-strip-types`, gọi trực tiếp mô-đun thật):

```
0 → 20000 | 5 → 20000 | 5.0001 → 16000 | 99.999 → 16000 | 100 → 15000
499.99 → 15000 | 500 → 14000 | 1000 → 14000 | 1000.0001 → 12000 | -1 → ERR "rơi vào 0 bậc"
estimate 3 kiện × 4 kg → tier 20000, perPackage 80000, total 240000   (từng kiện, không gộp)
```

**Mọi trang trong build có số tiền** (quét text ngoài script/style và `"price"` trong JSON-LD). Chỉ thấy đúng 5 mức 20000/16000/15000/14000/12000, không có số tiền lạ:
- `/`, `/logistics/bang-gia/`: 5 mức và Offer 5 giá.
- `/logistics/cau-hoi-thuong-gap/`: 5 mức, không có Offer.
- 4 trang `/logistics/van-chuyen-*-ve-viet-nam/`: 5 mức ×2 (vi + zh) và Offer 5 giá.

**JSON-LD offers:** cả 6 trang có `offers` đều khai `[20000, 16000, 15000, 14000, 12000]`, `eligibleQuantity.unitText = "kg/kiện"`. JSON-LD toàn site parse được hết, 0 lỗi: Organization 22, BreadcrumbList 13, Service 10, Place 8, FAQPage 6, WebPage 5, HowTo 1, ItemList 1.

**Câu "cả lô":** mọi câu "cả lô" / "整批" trong `dist/` đều ở dạng phủ định ("không gộp cả lô", "không cộng gộp cả lô", "不合并整批重量"). Câu "làm chậm cả lô hàng" nằm ở mục mã khách, không nói về giá. Không còn câu áp giá gộp lô.

**Công cụ tính trên /logistics/bang-gia/:** đọc script đã bundle trong HTML. Script gọi `estimate(tiers, {lCm, wCm, hCm, kg: <cân 1 kiện>, count: n}, 6000)`, tức là mỗi kiện tra bậc riêng rồi nhân số kiện. Không làm tròn khối lượng, chỉ làm tròn tiền tới đồng. `data-divisor="6000"` có nguồn (`logistics.ts:240`) và không bị gắn nhãn MẪU.

## 3. Năm trang V2

| Trang | Địa chỉ (số lần xuất hiện) | `data-copy-text` = chuỗi owner | canonical | sitemap | Breadcrumb | JSON-LD | H1 |
|---|---|---|---|---|---|---|---|
| `/logistics/kho-trung-quoc/` | đủ 4 địa chỉ, mỗi cái ×2 | 4/4 khớp từng ký tự | đúng | có | Trang chủ › Logistics › Kho Trung Quốc | Org, Breadcrumb, Service (provider VIPORDER), ItemList (4), Place ×4, WebPage, FAQPage(3) | 1 |
| `…/van-chuyen-tham-quyen-ve-viet-nam/` | 深圳… ×6 | khớp | đúng | có | …› Kho Trung Quốc › Thâm Quyến | Org, Breadcrumb, Service+Offer, Place, WebPage(about), FAQPage(4) | 1 |
| `…/van-chuyen-ha-mon-ve-viet-nam/` | 福建…囷瑶路… ×6 | khớp | đúng | có | …› Hạ Môn | như trên | 1 |
| `…/van-chuyen-quang-chau-ve-viet-nam/` | 广州… ×6 | khớp | đúng | có | …› Quảng Châu | như trên | 1 |
| `…/van-chuyen-nghia-o-ve-viet-nam/` | 义乌…，靠5号货梯 ×6 (dấu phẩy toàn độ "，" đúng nguyên văn) | khớp | đúng | có | …› Nghĩa Ô | như trên | 1 |

- **Nút sao chép** (`src/components/logistics/CopyAddress.astro:41-52`): chép `src.textContent.trim()` của `<p class="addr" lang="zh-CN" data-copy-text translate="no">{address}</p>`. Đã trích `data-copy-text` từ HTML build và so với chuỗi owner: khớp cả 8 lần (4 trên trang mạng lưới, 4 trên trang tuyến). Khi không có Clipboard API thì nút bôi đen địa chỉ để khách tự chép. Sự kiện `copy_address` chỉ mang mã kho và kết quả, không mang địa chỉ.
- **Không lộ thông tin riêng:** không có số điện thoại nào khác ngoài `0961102655` / `0961 102 655`. Không có số di động TQ, không có `+86`. Người nhận, SĐT kho và mã khách chỉ được nói là "cung cấp riêng sau khi đăng ký — không đăng công khai" (vi + zh).
- **Không khẳng định sở hữu kho:** không có "kho của VIP GROUP", "sở hữu kho", "自有", "自营", "我司". Câu duy nhất có "sở hữu" là "VIPORDER là công ty cùng chủ sở hữu với VIP GROUP", đúng bối cảnh owner. (Câu chữ "trực tiếp": xem P2-4.)
- **Hotline:** không có chỗ nào trong `src/` khai số ngoài `src/data/vi/contact.ts:20`. Đột biến đổi số hotline làm 25 test fail, nên test đang canh tốt.
- **Internal links:** test link-check trong `site.test.mjs` pass. Có 23 link tới `/logistics/kho-trung-quoc/`. Không link nào tới URL cũ, trong cả `dist/` lẫn `dist-demo/`. Sitemap có đủ 5 URL V2 và không có URL cũ.
- **Title/description:** dài 58–67 / 146–166 ký tự, mỗi trang một khác. `og:url` = canonical.

## 4. Trùng lặp nội dung giữa 4 trang tuyến

Lấy text trong `<main>` (≈1.480 từ mỗi trang), shingle 5 từ, so Jaccard và tỉ lệ chứa (containment) từng cặp:

| Cặp | Jaccard (thô) | Containment (thô) | Jaccard (che tên TP/quận/tỉnh) | Containment (che) |
|---|---|---|---|---|
| TQ–HM, TQ–QC, TQ–NO, HM–QC, QC–NO | 0,56 | 0,72 | 0,67–0,69 | 0,80–0,82 |
| HM–NO | 0,55 | 0,71 | 0,67 | 0,80 |

- Shingle chung cho cả 4 trang chiếm **69 %** (thô) và **79 %** (đã che tên) so với trung bình mỗi trang.
- **15 khối giống hệt nhau** trên cả 4 trang (sau khi che tên), tổng 2.636 / ~6.980 ký tự mỗi trang. Gồm:
  - bảng 5 bậc giá + đoạn `basis` (vi)
  - câu FAQ "Hàng nhận tại kho X áp dụng bảng giá chung…"
  - FAQ giá tiếng Trung "四个仓库适用统一价格表…"
  - 4 bước `pickupSteps` (`src/lib/pickup.ts:37-42`) và `pickupStepsZh` (`:44-49`)
  - `pickupAnswer` / `pickupAnswerZh` (đổi đúng tên thành phố)
  - đoạn công bố VIPORDER, ghi chú `addr-note`
  - FAQ thời gian "Thời gian phụ thuộc loại hàng…"
  - "Gửi thông tin cân nặng…", dòng "Cập nhật · đơn vị vận hành"
  - thẻ "3 kho khác"
- **Phần riêng của mỗi trang** (~2,2–2,3 nghìn ký tự): `context`, `goods`, `deliveryNotes`, câu FAQ riêng, chú thích địa chỉ.
- **Đánh giá:** chưa tới mức doorway (mỗi trang có địa chỉ, lưu ý giao hàng và FAQ riêng). Nhưng khoảng 70–80 % là khung chung, nên có rủi ro Google chỉ chọn 1–2 trang tuyến làm canonical. Xếp **P2**.
- **Đề xuất (chỉ dùng dữ liệu đã có nguồn, không bịa thời gian hay giá):**
  1. Trên trang tuyến, chỉ giữ 1 câu giá + link `/logistics/bang-gia/`. Bảng 5 bậc đầy đủ chỉ để ở bảng giá và trang mạng lưới. Riêng FAQPage giữ câu giá (test `pricing-policy` đang yêu cầu, nên phải sửa test theo).
  2. Chuyển 4 bước chung sang `/logistics/quy-trinh-gui-hang/` và link sang đó. Trên trang tuyến thay bằng các bước suy ra từ địa chỉ owner:
     - Thâm Quyến: ghi "三期2栋"
     - Hạ Môn: ghi "2号库3号仓"
     - Quảng Châu: 虎塘村, 凤岗路26号; báo người nhận và SĐT cho tài xế
     - Nghĩa Ô: vào 西门, dỡ hàng cạnh 5号货梯, kho 10–12
  3. Thẻ "3 kho khác" chỉ cần tên + link, bỏ phần mô tả hàng hóa lặp lại.
  4. Phần tiếng Trung: giữ khối "发货须知" riêng từng kho, bỏ 4 bước zh lặp lại (để 1 dòng link).

## 5. Tiếng Trung

- **`lang="zh-CN"`:** dùng parser HTML lần theo `lang` của phần tử cha, không có text chữ Hán nào trong `<body>` nằm ngoài `zh-CN`. Trừ 8 chuỗi trong `<option>` của form (`src/components/ContactForm.astro:67`, ví dụ "Thâm Quyến (深圳)") trên `/lien-he/` và `/logistics/bang-gia/`. Chữ Hán trong `<title>` / `meta description` thì không gắn `lang` được, chấp nhận.
- **Nhãn giá biên** (`pricing.ts:20-24`): không chồng, không hở.
  - `0–5 公斤` = [0,5], `超过 5 公斤，不足 100 公斤` = (5,100), `100 公斤至不足 500 公斤` = [100,500), `超过 1,000 公斤` = (1000,∞): đúng nghĩa.
  - `500–1,000 公斤`: không nói rõ có gồm hai đầu hay không. Đề xuất `500 公斤（含）至 1,000 公斤（含）`, và tương tự `100 公斤（含）至 500 公斤（不含）`.
- **Thuật ngữ:** 计费重量, 体积重量, 实际重量, 附加费, 正式报价, 唛头, 货梯 là thuật ngữ logistics giản thể đúng.
- **Cần người bản ngữ duyệt (đánh dấu):**
  1. `pickup.ts:33` "运费适用四个仓库统一价格表" → tự nhiên hơn: "运费按四个仓库统一价格表计算".
  2. "客户编号（唛头）": 唛头 là shipping mark (ký hiệu trên thùng), không hẳn là mã khách. Đề xuất "客户编号（写在唛头上）".
  3. `pickupStepsZh[2]` "如使用国内快递，请将快递单号告知客户": chủ ngữ là nhà cung cấp, cần xác nhận đúng ý.
  4. Câu bối cảnh trong `logistics.ts:95,120,145,170` ("毗邻香港", "全球最大的小商品批发市场之一", "晋江（泉州）鞋服产业、德化陶瓷"): là kiến thức chung, không phải dữ liệu owner.
  5. `kho-trung-quoc.astro:77`: Nghĩa Ô thiếu khu → "义乌（北苑）" cho đồng bộ với 3 kho kia.
  6. `PriceTiers.astro:10` "每件重量" → "每件计费重量" (và vi "Trọng lượng tính cước / kiện"). Bậc giá tính theo trọng lượng tính cước chứ không phải cân thực.
- **Bản tiếng Việt:** `logistics.ts:99` "phố 福海街道" sai nghĩa (街道 là phường / nhai đạo, không phải "phố") → "phường Phúc Hải (福海街道)".

## 6. Lỗi do khác phiên bản nhánh / rebase

- **URL cũ** (`/logistics/van-chuyen-tham-quyen-viet-nam/`, `/logistics/kho-tham-quyen/`, `/logistics/kho-quang-chau/`): không sinh trong `dist/` hay `dist-demo/`, không có link nào trỏ tới. Danh sách `RETIRED` trong test được dùng đúng (`tests/logistics.test.mjs:25,177`; `tests/e2e/warehouses.e2e.mjs:22`). Production main chưa từng có các URL này, nên **không cần 301**.
- **Comment cũ:** `src/data/vi/logistics.ts:356-357` "Nếu nhánh 025 phát hành trước V2 → cần 301". V2 hiện đã nằm trên chính nhánh 025, nên cần sửa comment.
- **Code chết:**
  - `logistics.ts:236` `pickupById`: export nhưng không ai dùng.
  - `src/i18n/config.ts` `locales`: không ai dùng.
  - `pickup.ts:29-30,33`: nhánh `priceApplies.value` rỗng không bao giờ chạy (cả 4 kho đều có value). Có thể giữ để phòng hờ, nhưng nên ghi chú.
  - Không có import thừa (đã quét mọi `.astro` / `.ts`). Không test nào bị `skip` / `only` ngoài skip có điều kiện python3 (`production.test.mjs:209`, hợp lý).
- **Docs cũ dễ gây hiểu nhầm:**
  - `docs/seo/G10_GSC_AI_SEARCH_MONITORING.md:3,24,35` hướng dẫn kiểm sitemap phải có `/logistics/van-chuyen-tham-quyen-viet-nam/`. Đây là URL đã bỏ; ai làm theo sau phát hành sẽ báo lỗi sai.
  - `G13_SEO_AUDIT.md:36,64,78,80,106`, `V1_2_BAO_CAO_NGHIEM_THU.md:54,67`, `G13_QA_SECURITY.md:105` còn ghi "áp theo tổng cả lô".
  - `G01*`, `G05`, `G08` còn `kho-quang-chau` / `kho-tham-quyen`.
- **Siêu dữ liệu cũ:**
  - `pricing.ts:31-32` `source: 'Owner cung cấp 06/11/2026'`, `updated: '2026-11-06'`, trong khi chính sách chốt 07/11.
  - `[tuyen].astro:38`, `kho-trung-quoc.astro:19`: `dateModified` 2026-11-06.

## 7. Bảo mật nhanh

- **CSP `<meta>`:** có trên mọi trang. `script-src 'self' https://challenges.cloudflare.com` + hash; `style-src 'self'` + hash, không có `unsafe-inline`; `form-action 'none'`, `object-src 'none'`, `frame-src https://challenges.cloudflare.com`. `_headers` có `frame-ancestors 'none'`, `X-Frame-Options DENY`, COOP.
- **Hash:** tính SHA-256 cho **96 script/style inline** trên mọi trang `dist/`: **96/96 khớp** CSP của chính trang đó. Không có thuộc tính `style=""` hay `on*=` inline.
- **Script ngoài:** duy nhất `https://challenges.cloudflare.com/turnstile/v0/api.js`.
- **Bí mật:** không thấy `/Users/`, `localhost:`, URL Apps Script, token hay key trong `dist/`. `_worker.js` chỉ đọc `env.SHEET_WEBHOOK_URL`, `env.SHEET_WEBHOOK_SECRET`, `env.TURNSTILE_SECRET`, `env.ZALO_BOT_TOKEN`, `env.ZALO_NOTIFY_CHAT_ID`, không có giá trị cứng.

## 8. Đột biến (bản chép, chạy đủ `npm test` có build)

| # | Đột biến | Kết quả | Có bắt được? |
|---|---|---|---|
| M1 | `pricing.ts`: dời ngưỡng 500 → 499 (bậc 3 max và bậc 4 min) | 176 pass / **2 fail** ("ngưỡng giá…", "mức khối lượng nối liền…") | Có |
| M2 | `pickup.ts:28,33`: "không gộp cả lô" → "áp theo tổng trọng lượng cả lô"; "不合并整批重量" → "按整批货物总重量确定" (đã xác nhận có trong HTML build) | **178 pass / 0 fail** | **Không** |
| M3 | `logistics.ts:118`: 囷瑶路 → 困瑶路 (1 ký tự) | 177 pass / **1 fail** ("địa chỉ 4 kho NGUYÊN VĂN…") | Có |
| M4 | `VolumeCalculator.astro:75`: gộp lô (`kg: cân × n, count: 1`) | **178 pass / 0 fail** | **Không** |
| M5 | `CopyAddress.astro:42`: chép thiếu 2 ký tự cuối | **178 pass / 0 fail** | **Không** |
| M6 | `contact.ts:20`: hotline đổi 1 chữ số | 153 pass / **25 fail** | Có |

M4 và M5 có kịch bản e2e (`tests/e2e/logistics.e2e.mjs:71-73`, `warehouses.e2e.mjs:69-87`), nhưng không nằm trong `npm test` và cổng bị gắn cứng 4321/4322 (trùng cổng preview của owner), nên verifier không chạy.

---

## Phát hiện theo mức

### P0 (chặn): không có.

### P1

1. **Test chính sách giá quá hẹp.** `tests/pricing-policy.test.mjs:74` chỉ chặn `/theo tổng khối lượng[^.]*cả lô|按同一批货物的总计费重量/`. Bằng chứng: M2 đưa câu áp giá gộp lô lên cả 4 trang tuyến (vi + zh) mà 178/178 vẫn pass. Đề xuất: chặn mọi câu có "tổng … (cả )?lô" / "整批…总" / "按整批" không đi sau "không" / "不". Đồng thời kiểm khẳng định ngược: đoạn `pickupAnswer` phải chứa "từng kiện" và "không gộp".
2. **Công cụ tính cước và nút sao chép không có test chạy được trong `npm test`.** Bằng chứng: M4 và M5 đều qua 178/178. Đề xuất: tách hàm đọc form → `estimate` thành mô-đun thuần để unit test (ví dụ 3 kiện × 4 kg ra 240.000, không ra 192.000). Thêm assert tĩnh trong HTML build rằng script truyền `count` và `kg` của 1 kiện. Cho e2e nhận cổng qua biến môi trường (mặc định khác 4321/4322/4351) rồi đưa vào CI.
3. **Rủi ro kinh doanh: giá bất liên tục ở các ngưỡng** (owner cần quyết định, không phải lỗi code):

   | Mốc | So sánh | Hệ quả |
   |---|---|---|
   | 5 kg | 5 kg = **100.000 đ**; 5,01 kg = **80.160 đ** | kiện từ trên 5 đến 6,25 kg rẻ hơn kiện 5 kg |
   | 100 kg | 99,99 kg = 1.599.840 đ; 100 kg = 1.500.000 đ | vùng 93,75–<100 kg đắt hơn 100 kg |
   | 500 kg | 499,99 kg = 7.499.850 đ; 500 kg = 7.000.000 đ | vùng 466,7–<500 kg đắt hơn 500 kg |
   | 1.000 kg | 1.000 kg = 14.000.000 đ; 1.000,01 kg = 12.000.120 đ | vùng 857–1.000 kg đắt hơn 1.000,01 kg |

   Tính theo từng kiện còn tạo động cơ gộp kiện (ví dụ 3×4 kg = 240.000 đ, gộp thành 1 kiện 12 kg = 192.000 đ). Owner chưa quy định làm tròn khối lượng và cước tối thiểu, nên công cụ tính có thể ra số ước tính rất nhỏ (ví dụ 0,1 kg → 2.000 đ). Đề xuất owner chốt: (a) quy tắc làm tròn; (b) cước tối thiểu / kiện; (c) có áp "giá trần" kiểu "tính theo bậc rẻ hơn nếu lên bậc trên" (break-point) hay không.

### P2

1. Công cụ tính: ô "Cân nặng quy đổi" (`VolumeCalculator.astro:25,70`) hiện **tổng của n kiện**, đặt cạnh "Trọng lượng tính cước / kiện" là số của 1 kiện, dễ nhầm. Nên đổi nhãn thành "Tổng cân quy đổi". Ngoài ra `fmt(…, 2)` (`:73`) làm 5,004 kg hiện "5 kg" trong khi bậc giá hiện "Trên 5…".
2. `PriceTiers.astro:10` "Trọng lượng / kiện · 每件重量" → "Trọng lượng tính cước / kiện · 每件计费重量".
3. JSON-LD `eligibleQuantity` (`src/lib/pricing.ts:47`) có min/max chồng nhau ở 5/100/500/1000, vì schema.org không có cờ inclusive. Chấp nhận được, có thể thêm `description` ghi rõ biên.
4. Câu "VIP GROUP nhận hàng **trực tiếp** tại kho…" (`pickup.ts:25`, "直接收货" ở `:33`, `kho-trung-quoc.astro:77`, các `lead` trong `logistics.ts:375,387,399,411`) đặt cạnh "VIPORDER trực tiếp vận hành". Câu này không khẳng định sở hữu, nhưng nên viết "VIP GROUP (dịch vụ do VIPORDER vận hành) nhận hàng tại kho…", bỏ chữ "trực tiếp".
5. Trùng lặp 4 trang tuyến: containment 0,71–0,72 (thô), 0,80–0,82 (che tên). Đề xuất ở §4.
6. Tiếng Trung / tiếng Việt: các câu đánh dấu ở §5, cần người bản ngữ duyệt. "phố 福海街道" (`logistics.ts:99`).
7. `<option>` chữ Hán không gắn `lang` (`ContactForm.astro:67`).
8. Siêu dữ liệu ngày / nguồn cũ (`pricing.ts:31-32`, `[tuyen].astro:38`, `kho-trung-quoc.astro:19`). Comment 301 cũ (`logistics.ts:356-357`). Export chết (`logistics.ts:236`, `i18n/config.ts`).
9. Docs cũ: `G10_GSC_AI_SEARCH_MONITORING.md:3,24,35` (URL Thâm Quyến cũ, nên sửa trước khi bàn giao giám sát GSC); `G13_SEO_AUDIT.md`, `V1_2_BAO_CAO_NGHIEM_THU.md`, `G13_QA_SECURITY.md` ("cả lô"). Nên thêm dòng "đã thay bởi chính sách 07/11/2026 — từng kiện".
10. E2E gắn cứng cổng 4321/4322: khi preview của owner đang chạy, e2e sẽ kiểm bản `.preview/` thay vì `dist/` vừa build.
