# MASTER STATUS — VIP GROUP WEBSITE

> Ảnh chụp trạng thái, **không phải nguồn chân lý**. GitHub là nguồn chân lý: đo lại (`git ls-remote`, `gh pr list`, `gh run list`) trước khi dựa vào bất kỳ SHA nào ở đây.
> Cập nhật lần cuối: 29/09/2026, trong PR của VIPG-WEB-002 (#3). SHA của chính PR này và commit merge của nó không ghi được ở đây — xem PR trên GitHub.

## Nhánh

| Nhánh | SHA đo được | Ghi chú |
|---|---|---|
| `main` | `57214628acd7aa1f05e5d018cc3dee4ca8d4ed9e` | Chỉ có commit khởi tạo. Giữ nguyên tới khi staging PASS + owner ra lệnh production |
| `develop` | `5f34a0bb3811ca2e97c0f5d5c186d95edfb70457` (base của PR VIPG-WEB-002) | CI push run 36543543887 — success |

## Work item

| Issue | CR | Trạng thái | PR |
|---|---|---|---|
| #1 | VIPG-WEB-001 — Official corporate website v1 | CLOSED — merged develop `5f34a0b` | #2 MERGED |
| #3 | VIPG-WEB-002 — Hardening sau verifier + tài liệu điều phối | Đang làm | (PR của chính thay đổi này) |
| #4 | VIPG-WEB-003 — Staging Cloudflare Pages | Mở — chờ VIPG-WEB-002 | — |

## Gate hiện tại

VIPG-WEB-002 → verifier độc lập → merge `develop`. Sau đó VIPG-WEB-003 (staging).

## Kỹ thuật (đo trên `develop` `5f34a0b`)

| Hạng mục | Trạng thái | Căn cứ |
|---|---|---|
| Type check / build / test | PASS | verifier PR #2; CI 36543543887 |
| Link nội bộ, sitemap, robots, canonical, OG, schema.org | PASS | verifier PR #2 |
| Lighthouse | 100/100/100/100 trên 7 trang | đo cục bộ 29/09 (Lighthouse 13.5.0, mobile mặc định, không độ trễ mạng thật) — cần đo lại trên staging |
| Form tắt JS | Sửa trong VIPG-WEB-002 | verifier PR #2, phát hiện 1 |
| Security headers | Chưa có | phụ thuộc hosting → VIPG-WEB-003 |

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

Chưa có. Nền tảng owner chọn: Cloudflare Pages (`*.pages.dev`). Repo chưa có environment / secret nào (đo 29/09).

## Production

NOT DEPLOYED. DNS `vipgroup.com.vn` (đo 29/09, chỉ đọc): NS `ns1/ns2.vclouddns.vn`, MX Google Workspace, **không có A/AAAA** cho apex và `www`. Trỏ tên miền là việc của owner.

## Blocker

| Loại | Nội dung |
|---|---|
| CONTENT_PENDING | V-11501 — bảng trên. Không chặn kỹ thuật |
| BLOCKED_EXTERNAL_DNS | Production cần owner trỏ DNS sau staging PASS |
