# MASTER STATUS — VIP GROUP WEBSITE

> Ảnh chụp trạng thái, **không phải nguồn chân lý**. GitHub là nguồn chân lý: đo lại (`git ls-remote`, `gh pr list`, `gh run list`) trước khi dựa vào bất kỳ SHA nào ở đây.
> Cập nhật lần cuối: 30/09/2026, trong PR của VIPG-WEB-009 (#17). SHA của chính PR này và commit merge của nó không ghi được ở đây — xem PR trên GitHub.

## Nhánh

| Nhánh | SHA đo được | Ghi chú |
|---|---|---|
| `main` | `57214628acd7aa1f05e5d018cc3dee4ca8d4ed9e` | Chỉ có commit khởi tạo. Giữ nguyên tới khi staging PASS + owner ra lệnh production |
| `develop` | `1974fcd51b7fcd40b59fff13370408a5d1eb09ed` (base của PR VIPG-WEB-009) | CI 36606230900 + Staging 36606230918 (push → alias `staging`, deploy success) |

## Work item

| Issue | CR | Trạng thái | PR |
|---|---|---|---|
| #1 | VIPG-WEB-001 — Official corporate website v1 | CLOSED — merged develop `5f34a0b` | #2 MERGED |
| #3 | VIPG-WEB-002 — Hardening sau verifier + tài liệu điều phối | CLOSED — merged develop `7ce3b7d` | #5 MERGED |
| #4 | VIPG-WEB-003 — Thiết lập môi trường staging | CLOSED — **STAGING ACCEPTANCE PASS** 30/09/2026 | #6 MERGED, hồ sơ #16 |
| #7 | VIPG-WEB-004 — SHA preview chính xác + script inline nằm dưới CSP | CLOSED — merged develop `c50fb70` | #8 MERGED |
| #9 | VIPG-WEB-005 — Tách job deploy staging khỏi job build (cô lập credential) | CLOSED — merged develop `e7c813f` | #10 MERGED |
| #11 | VIPG-WEB-006 — Job deploy tự tính nhánh/SHA mong đợi | CLOSED — merged develop `cc55fac` | #12 MERGED |
| #13 | VIPG-WEB-007 — Test hành vi: chạy thật script guard + deploy | CLOSED — merged develop `920919b` | #14 MERGED |
| #15 | VIPG-WEB-008 — Hồ sơ nghiệm thu staging | CLOSED — merged develop `1974fcd` | #16 MERGED |
| #17 | VIPG-WEB-009 — Siết test hành vi workflow + sửa tài liệu cũ | Đang làm | (PR của chính thay đổi này) |

## Gate hiện tại

Staging **PASS**. Cổng kế tiếp là **production** — cần lệnh riêng của owner (merge `develop` → `main`, trỏ DNS `vipgroup.com.vn`). Nội dung vẫn CONTENT_PENDING.

## Kỹ thuật (đo trên `develop` `920919b` và staging thật — nghiệm thu 30/09/2026)

| Hạng mục | Trạng thái | Căn cứ |
|---|---|---|
| Type check / build / test | PASS | verifier PR #12; CI 36598041986 |
| Link nội bộ, sitemap, robots, canonical, OG, schema.org | PASS | verifier PR #5 |
| Lighthouse | Staging thật: 7/7 trang P/A/BP 100, SEO 66 (`is-crawlable` do noindex có chủ đích) | nghiệm thu staging 30/09 |
| Form tắt JS | PASS — không dữ liệu nào vào URL | verifier PR #5 (Chrome CDP, JS tắt thật) |
| Menu tắt JS, 404 noindex không canonical | PASS | verifier PR #5 |
| CSP (`<meta>`, hash, không unsafe-inline) | PASS cục bộ | verifier PR #6: 0 vi phạm, script chèn bị chặn. Hash của script `html.js` **chỉ được trình duyệt thực thi từ PR #8** (trước đó script đứng trên thẻ CSP) — verifier PR #8: đột biến bị chặn trên `1fcd534`, không bị chặn trên `bc6be7b` |
| Header bảo mật (`public/_headers`) | PASS trên staging thật | nghiệm thu staging 30/09 |
| Workflow staging không deploy giả / không deploy production | PASS | verifier PR #6 lượt 2 (mô phỏng a/b/c + đối chứng âm) |
| Preview PR build từ đúng PR HEAD | PASS | verifier PR #8 (log Staging: `HEAD is now at 1fcd534`) |
| Cô lập credential (job deploy không chạy mã repo) | PASS | verifier PR #10 (log job deploy 0 lần checkout/npm; 4 đột biến bị bắt) |
| Job deploy không tin output của build | PASS | verifier PR #12 (19 ca guard) |
| Test hành vi workflow (chạy thật script, bash 5 trên CI) | Làm trong VIPG-WEB-007 | — |

## CONTENT_PENDING — V-11501 (owner cung cấp; không được tự điền)

| Dữ liệu | Hiện trên web | Sửa ở |
|---|---|---|
| Hotline | "Đang cập nhật" | `src/data/vi/contact.ts` → `hotline` |
| Địa chỉ pháp lý | "Đang cập nhật" | `contact.ts` → `address` |
| Tên pháp lý VIP GROUP | không hiện (footer dùng "VIP GROUP") | `company.ts` → `legalName` |
| Pháp nhân thành viên khối Công nghệ | nhãn "Công ty thành viên khối Công nghệ" + "Đang hoàn thiện" | `subsidiaries.ts` |
| Pháp nhân thành viên khối Bất động sản | nhãn "Công ty thành viên khối Bất động sản" + "Đang hoàn thiện" | `subsidiaries.ts` |
| Website VIPORDER | không có link | `subsidiaries.ts` → `url` |
| Logo chính thức | logo chữ placeholder | `public/logo.svg`, `favicon.svg`, `design/og-image.svg` |
| Email tuyển dụng | dùng `contact@vipgroup.com.vn` | `careers.ts` → `applyEmail` |

Đã có, không pending: email liên hệ `contact@vipgroup.com.vn` · slogan "Kết nối giá trị – Kiến tạo tương lai" · 3 trụ cột · VIPORDER là công ty thành viên.

## Staging

**PASS** (30/09/2026) — https://staging.vip-group.pages.dev, SHA nghiệm thu `920919b`, run 36602899641, verifier độc lập PASS. Lighthouse trên staging thật: 7/7 trang Performance / Accessibility / Best Practices 100; SEO 66 do `X-Robots-Tag: noindex` có chủ đích. Chi tiết: `docs/verification/VIPG-WEB-003-STAGING-ACCEPTANCE.md`.

## Production

NOT DEPLOYED. DNS `vipgroup.com.vn` (đo 29/09, chỉ đọc): NS `ns1/ns2.vclouddns.vn`, MX Google Workspace, **không có A/AAAA** cho apex và `www`. Trỏ tên miền là việc của owner.

## Blocker

| Loại | Nội dung |
|---|---|
| CONTENT_PENDING | V-11501 — bảng trên. Không chặn kỹ thuật |
| BLOCKED_EXTERNAL_DNS | Production cần owner trỏ DNS sau staging PASS |
