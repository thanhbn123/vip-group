# G13 — QA / Security độc lập (V1.2: G09 hotline, G10 bảng giá, G11 form lead)

> **LỖI THỜI MỘT PHẦN (07/11/2026):** chính sách giá đã đổi theo owner directive 07/11 — bậc giá theo **từng kiện**, bảng giá chung cho 4 kho; V2 thay trang Thâm Quyến cũ bằng 4 trang `/logistics/van-chuyen-*-ve-viet-nam/`. Trạng thái mới nhất: `docs/seo/G17_BAO_CAO_NGHIEM_THU_CUOI.md`.


- Người kiểm: QA/Security Agent độc lập (không viết code này). Ngày: 06/11/2026.
- Đối tượng: nhánh `feature/vipg-web-025-seo-v11` HEAD `500cd4c`. Production so sánh: `origin/main` `5ee2efd` + `https://www.vipgroup.com.vn/` (curl 06/11/2026 15:06 GMT).
- Không sửa file nào trong repo ngoài file báo cáo này; không commit/push/deploy; không gọi Google Sheet / Zalo / CRM thật (mọi thử worker dùng `fetch` giả, host `sheet.invalid`). Đột biến làm trên bản sao `/tmp/g13qa`.

## KẾT LUẬN: **PASS WITH FINDINGS**

Không có P0, không có P1 về mã. G09/G10/G11 đạt đủ theo chỉ thị. Có 7 mục P2 (cứng hoá) + 1 lưu ý phạm vi phát hành (bản này kèm toàn bộ SEO v1.1 / Logistics, không chỉ G09–G11).

---

## 1. Kiểm tĩnh và test

| Lệnh | Kết quả |
|---|---|
| `npm run check` | `Result (84 files): 0 errors, 0 warnings, 0 hints` |
| `npm test` (pretest = `astro build`) | `tests 159 · pass 159 · fail 0 · cancelled 0 · skipped 0` (exit 0, ~67 s) |

`git status --short` sau khi chạy: sạch (`dist/` nằm trong .gitignore).

## 2. Yêu cầu owner V1.2 — bằng chứng

### G09 Hotline — ĐẠT
```
$ grep -rnE '0968[ .]?961[ .]?962|968961962' dist src public ops      → (không có kết quả)
$ grep -rhoE 'href="tel:[^"]*"' dist | sort | uniq -c                  → 49 href="tel:0961102655"
$ grep -rhoE 'https://zalo\.me/[^"]*' dist | sort | uniq -c            → 29 https://zalo.me/0961102655
mọi chuỗi 9–11 chữ số giống SĐT trong dist/*.html                        → 141 × 0961102655, 23 × 84961102655 (JSON-LD "+84961102655"); không số nào khác
$ grep -rn "0961102655\|0961 102 655" src | grep -v src/data/vi/contact.ts → (không có kết quả)
```
- Cấu hình tập trung: `src/data/vi/contact.ts:20-22` (`hotline`, `hotlineDisplay`, `zaloUrl`).
- Không đụng VIPORDER: `git diff --name-only origin/main..HEAD | grep -i viporder` → rỗng; link ngoài tới viporder.com.vn trên trang chủ y hệt production (diff mục 4 không có dòng nào liên quan).

### G10 Bảng giá trang chủ — ĐẠT
Trích văn bản `dist/index.html` (bỏ thẻ):
```
VIP GROUP – BẢNG GIÁ VẬN CHUYỂN | VIP GROUP 运输价格表 | Trung Quốc – Việt Nam / | 中国 – 越南 |
VIP GROUP · Con người - Công nghệ - Cơ hội | Đơn giá theo trọng lượng, đơn vị VNĐ/kg. |
Gửi yêu cầu báo giá | Gọi tư vấn: 0961 102 655 | Nhắn Zalo |
0–5 kg 20.000 đ/kg | Trên 5 đến dưới 100 kg 16.000 đ/kg | Từ 100 đến dưới 500 kg 15.000 đ/kg |
Từ 500 đến 1.000 kg 14.000 đ/kg | Trên 1.000 kg 12.000 đ/kg | Đơn vị tính: VNĐ/kg · 单位：越南盾/公斤 |
... Phụ phí và thuế (nếu có) sẽ được xác nhận trước khi báo giá chính thức.
khuyến mãi / giảm giá / ưu đãi trong trang: False / False / False
```
- Đúng 5 mức, đúng thứ tự, đúng giá. Dữ liệu nguồn `src/data/vi/pricing.ts:20-24` có biên liền mạch (1.000 kg thuộc mức 14.000, `maxInclusive: true`; mức cuối `minInclusive: false`).
- Không tự khẳng định thuế/phụ phí (chỉ ghi "nếu có… sẽ được xác nhận"). Không khuyến mãi.

### G11 Form lead — ĐẠT
- Trường: họ tên, SĐT/Zalo, email (tuỳ chọn), tuyến (`cf-route`, 6 giá trị), nhu cầu, khối lượng, nội dung, đồng ý chính sách — `src/components/ContactForm.astro:50-96`.
- Thông báo thành công/thất bại: `ContactForm.astro:202` (thành công kèm mã lead), `:205-216` (sai trường, Turnstile, Sheet hỏng có/không kênh dự phòng, mất mạng).
- Chống spam 3 lớp: Turnstile (`_worker.js:84-97,163`), honeypot `website` (`:79`), thời gian điền ≥ 3 s và ≤ 24 h (`:17,80-81`). Bot nhận 201 giả, không lưu, không báo.
- Kiểm dữ liệu phía máy chủ: `_worker.js:40-75` (danh sách trắng `need`/`route` dùng `Object.hasOwn` → `__proto__`/`constructor` bị chặn; SĐT VN chuẩn hoá; khối lượng hữu hạn 0–1.000.000; `consent === true`).
- PII: dataLayer chỉ có `event, page_path, need, route` (`ContactForm.astro:200`) và `link_location, route` (`TrackEvents.astro:18`); log máy chủ duy nhất `_worker.js:169` chỉ ghi mã trạng thái Sheet. Input không có `name=`, form không có `action`, CSP `form-action 'none'` → tắt JS không lọt dữ liệu ra URL.
- Chống công thức bảng tính: `ops/lead-sheet/Code.gs:52-56` `cell_()` thêm `'` cho `= + - @ \t \r`; khoảng trắng/xuống dòng đầu đã bị worker `trim()` trước → `"\n=1"` thành `"=1"` rồi bị chặn. Trường không qua `cell_` (`need`, `route`, `idempotency_key`, `phone`, thời gian) đều đã qua danh sách trắng/regex ở worker hoặc có `'` cứng.
- Chống gửi trùng: `idempotency_key` (UUID phía trình duyệt) + `Code.gs:78-86` tra 500 dòng gần nhất dưới `LockService`; khoá `sending` phía client.

## 3. Chạy thử worker (node, fetch giả — không gọi dịch vụ thật)

Script: `import { handleLead } from public/_worker.js`, `fetchImpl` giả trả lời siteverify / sheet / zapps. Kết quả (status | body | các host bị gọi):
```
happy                    | 201 {"ok":true,"lead_id":"VG-2"}        | challenges.cloudflare.com,sheet.invalid,bot-api.zapps.me
GET                      | 405 method                              |
missing env              | 503 not_configured                      |
no Origin / evil Origin  | 403 origin                              |
Origin "null"            | THROW TypeError: Invalid URL            |        ← P2-1
Origin http://same host  | 201 ok                                  | ...    ← P2-2 (chỉ so host, không so scheme)
text/plain               | 415   · 9KB body → 413 · "{" → 400 · null → 400 · [] → 201 giả (bot)
honeypot / <3s / thiếu started_at | 201 {"lead_id":null} — không gọi host nào
bad phone 400 · +84 phone 201 · route "__proto__" 400 · need "constructor" 400
weight -1 400 · 1e999 400 · "0x10" 201 (=16 kg, chấp nhận được) · consent "true" 400 · name {obj} 400
name '=HYPERLINK(...)'   | 201 — worker cho qua, Code.gs cell_ chặn khi ghi Sheet
page "//evil.com/x"      | 201 — lưu & gửi Zalo nguyên văn          ← P2-5
turnstile fail/throw/rỗng| 403 turnstile (không gọi Sheet)
sheet throw/500/HTML     | 503 store_failed notified:true; log chỉ "sheet 500"/"Error: net" (không PII)
sheet duplicate          | 200 duplicate:true — KHÔNG báo Zalo lần 2
sheet ok + Zalo throw    | 201 (Zalo lỗi không ảnh hưởng khách)
sheet 500 + Zalo 500     | 503 store_failed notified:false → client "Chưa gửi được. Vui lòng gọi…"
```
Kiểm thêm `cell_()` của Code.gs (eval trong node): `=1+1→'=1+1`, `+1→'+1`, `-1→'-1`, `@x→'@x`, `\t=1→'\t=1`.

SSRF: không URL nào do người dùng điều khiển (Sheet/Zalo/siteverify cố định hoặc từ env). Secret: chỉ đọc từ env / Script Properties; không có trong git hay dist.

## 4. dist/ — CSP, headers, script ngoài, link

Script kiểm tự viết (băm SHA-256 từng `<script>`/`<style>` inline, so với CSP meta):
```
pages 18 csp problems 0
external scripts [ 'https://challenges.cloudflare.com/turnstile/v0/api.js' ]
blank w/o noopener []
broken []            (link nội bộ, anchor #id, ảnh/asset — 0 hỏng)
external links: khachhang.viporder.com.vn/login, viporder.com.vn (+#register, #tracking), zalo.me/0961102655
```
- CSP mọi trang: không `unsafe-inline`/`unsafe-eval`, có `form-action 'none'`, `object-src 'none'`, `base-uri 'self'`; không thuộc tính `style=`/`on*=` inline.
- `public/_headers`: nosniff, Referrer-Policy, Permissions-Policy, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, COOP, noindex cho `*.pages.dev`. Production hiện trả đúng các header này; `/_worker.js`, `/_headers`, `/_routes.json` trên production → 404 (không lộ).
- `public/_routes.json`: chỉ `/api/*` qua worker.

## 5. So `dist/index.html` với production (diff văn bản + head)

Trong phạm vi G09–G11: tiêu đề song ngữ, "Gọi tư vấn: 0961 102 655", nhãn "Từ 100…", "Từ 500 đến 1.000 kg", "Trọng lượng", dòng mô tả VNĐ/kg, footer hiển thị "0961 102 655" (production in "0961102655"). Số hotline production đã là 0961102655 từ trước.

**Ngoài phạm vi G09–G11 (đến từ SEO v1.1 / VIPG-WEB-023/025 cùng nhánh):**
1. Menu header + footer thêm link "Logistics" → `/logistics/`.
2. Khối lĩnh vực thêm link "Dịch vụ vận chuyển Trung Quốc – Việt Nam →".
3. Bảng giá thêm nút "Gửi yêu cầu báo giá" (`/lien-he/?nhu-cau=bao-gia-van-chuyen#form-lien-he`), đoạn "áp theo tổng khối lượng cả lô… ÷ 6000" (VI+ZH), link "Xem bảng giá chi tiết…".
4. Footer thêm link "Chính sách bảo mật".
5. CSP trang chủ mở thêm `frame-src`/`script-src https://challenges.cloudflare.com` dù trang chủ không có form.
6. Sitemap +10 URL: `/chinh-sach-bao-mat/` và 9 trang `/logistics/...` (production `/logistics/` hiện 404, `/api/lead` 404).

→ Không thấy thay đổi "lạ" (title/H1/khối cũ giữ nguyên, test `không ảnh hưởng nội dung trang chủ đang chạy` pass). Nhưng owner cần biết phát hành nhánh này = phát hành cả Logistics/SEO v1.1 + form thật, không chỉ G09–G11.

## 6. Rò rỉ dữ liệu nội bộ trong dist/

```
secret/password/passwd/ssh/api_key/private_key/bearer/localhost/chat_id/webhook/zapps/script.google/
orca/claude/anthropic/tailscale/ngrok/caddy/wrangler/"/Users/"   → không có (ngoài dist/_worker.js, không được phục vụ)
"token"      → chỉ tên trường "turnstile_token" trong JS form (lien-he, logistics/bang-gia)
"pages.dev"  → chỉ trong dist/_headers (luật noindex)
IP 127.x / 10.x / 192.168.x / 172.16-31.x / 100.64-127.x → không có
email        → 69 × viporder@vipgroup.com.vn, không email khác
*.map        → không có
data-sitekey → 0x4AAAAAAF2QZNcXX6-6puJf (site key Turnstile công khai — không phải bí mật)
```

## 7. Thử đột biến (bản sao /tmp/g13qa, mỗi lần `git checkout` sạch rồi `npm test`)

| # | Đột biến | Kết quả | Test bắt |
|---|---|---|---|
| M1 | `pricing.ts` 16000 → 17000 | **BẮT** (fail 5) | bảng giá trang chủ đúng 5 mức; bảng giá chi tiết; production không giá chưa xác minh… |
| M2 | Thêm `0968961962` vào `Footer.astro` | **BẮT** (fail 3) | V1.2 G09 không còn số cũ; chỉ số đã chốt… |
| M3 | Thêm `name="phone"` vào `#cf-phone` | **BẮT** (fail 3) | form tắt JS không lọt dữ liệu ra URL… |
| M4 | Bỏ kiểm Origin trong worker | **BẮT** (fail 1) | worker: chặn khác nguồn… |
| M5 | Bỏ kiểm honeypot | **BẮT** (fail 1) | worker: bot → 201 giả, không lưu |
| M6 | Thêm `phone` vào dataLayer `lead_submit` | **BẮT** (fail 1) | lớp đo lường không gửi dữ liệu cá nhân |
| M7 | `MIN_FILL_MS = 0` | **BẮT** (fail 1) | worker: bot gửi quá nhanh |

7/7 đột biến bị bắt.

---

## 8. Phát hiện

### P0 — không có
### P1 — không có

### P2 (nên sửa, không chặn phát hành)
| # | Vị trí | Bằng chứng | Đề xuất |
|---|---|---|---|
| P2-1 | `public/_worker.js:148` | `Origin: null` (iframe sandbox, một số chế độ riêng tư) → `new URL('null')` ném `TypeError` → Worker lỗi 500/1101 thay vì 403 JSON | Bọc `try { new URL(origin) } catch { return json(403,…) }`; thêm ca test |
| P2-2 | `public/_worker.js:148` | So `host` không so scheme: `Origin: http://www.vipgroup.com.vn` được chấp nhận (201) | So `new URL(origin).origin === url.origin` |
| P2-3 | `public/_worker.js:150-151` | `request.text()` đọc hết body rồi mới kiểm 8 KB (và đếm ký tự, không byte) → kẻ lạ có thể bắt worker đệm body lớn trước bước Turnstile | Kiểm `Content-Length` trước khi đọc; đọc stream có giới hạn byte |
| P2-4 | `public/_worker.js:91,100` | `fetch` tới siteverify / Apps Script không có timeout; Apps Script `waitLock(20000)` có thể treo lâu → khách chờ "Đang gửi…" | `signal: AbortSignal.timeout(15000)` cho Sheet, 5000 cho siteverify |
| P2-5 | `public/_worker.js:67-68` | `page: "//evil.com/x"` được nhận (bắt đầu bằng `/`), lưu Sheet và in vào tin Zalo nhân viên ("Trang: //evil.com/x") | Chỉ nhận `^/(?!/)[\w\-/.]*$`, ngược lại `/` |
| P2-6 | `public/_worker.js:84-97` | Không kiểm `hostname`/`action` trong phản hồi siteverify; không giới hạn tần suất ngoài Turnstile | Kiểm `d.hostname` ∈ {www.vipgroup.com.vn, vipgroup.com.vn}; cân nhắc Cloudflare Rate Limiting rule cho `/api/lead` |
| P2-7 | `public/_worker.js:173-177` + `ContactForm.astro:185` | Khi Sheet hỏng, mỗi lần khách bấm gửi lại (cùng `idempotency_key`) lại phát thêm một tin Zalo "CHƯA LƯU ĐƯỢC SHEET" → nhân viên nhận trùng | Chấp nhận được (an toàn hơn mất lead); nếu muốn: ghi chú "lần thử N" hoặc khoá ngắn hạn theo key |
| P2-8 | CSP trang không có form (vd. `dist/index.html`) | `script-src`/`frame-src https://challenges.cloudflare.com` mở trên mọi trang | Chỉ thêm nguồn Turnstile cho trang có form (nếu Astro cho phép CSP theo trang) |

### Lưu ý phát hành (không phải lỗi mã)
- Phạm vi: phát hành nhánh này đưa lên đồng thời 10 trang mới (Logistics + Chính sách bảo mật) và form lead thật (mục 5) — cần owner chấp nhận cả gói.
- Trước khi bật: đặt `TURNSTILE_SECRET`, `SHEET_WEBHOOK_URL`, `SHEET_WEBHOOK_SECRET` (≥ 32 ký tự, trùng Script Properties) trên Cloudflare Pages; thiếu thì `/api/lead` trả 503 `not_configured` và khách được hướng gọi hotline (đã thử, hành vi đúng). Thử nghiệm đầu tiên trên production nên dùng một lead thử được đánh dấu rõ và xoá khỏi Sheet/CRM sau đó.
