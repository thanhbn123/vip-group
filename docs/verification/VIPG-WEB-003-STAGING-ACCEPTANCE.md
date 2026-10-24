# Biên bản nghiệm thu STAGING — VIPG-WEB-003 (issue #4)

**STAGING ACCEPTANCE: PASS** — verifier độc lập, chỉ đọc, tự lấy mọi dữ kiện (không dùng số liệu Controller).

## Truy vết

| Mục | Giá trị |
|---|---|
| Develop SHA dự định | `920919b57fd60ff1e39218c25bad8dd53ea932fd` (Merge PR #14) |
| Workflow run | 36602899641 · `workflow_dispatch` · headSha `920919b…` · deploy step **success** |
| TARGET_BRANCH / TARGET_SHA | `staging` / `920919b57fd60ff1e39218c25bad8dd53ea932fd` |
| Staging URL (alias cố định) | https://staging.vip-group.pages.dev |
| URL lượt deploy | https://df7f0124.vip-group.pages.dev (Cloudflare deployment `df7f0124-641b-4e0a-a1ba-945f1ae89fd8`, môi trường **Preview**) |
| Artifact ↔ nguồn | Build lại `920919b` trong clone sạch: **15/15 file `dist/` (trừ `_headers`) trùng từng byte** với bản live (wrangler: "Uploaded 15 files") |
| Production host | `https://vip-group.pages.dev/` → 404 "Deployment Not Found"; dashboard: "No production deployment yet" |
| Thời điểm | deploy 2026-09-29T17:09Z (00:09 +0700 30/09/2026); nghiệm thu 30/09/2026 |
| main | `57214628acd7aa1f05e5d018cc3dee4ca8d4ed9e` — không đổi |

## Kết quả kiểm (verifier)

| # | Hạng mục | KQ | Bằng chứng |
|---|---|---|---|
| 1 | Credential | PASS | Repo có secret `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (chỉ kiểm tên), biến `CF_PAGES_PROJECT=vip-group` |
| 2 | Log run | PASS | Secret hiện `***`; không chuỗi dạng token; 0 `bearer` |
| 3 | HTTPS | PASS | TLSv1.3, verify ok, CN `vip-group.pages.dev` / SAN `*.vip-group.pages.dev`, Let's Encrypt, hết hạn 28/12/2026; `http://` → 301 `https://` |
| 4 | Mã trạng thái | PASS | 7 route 200; sitemap, robots, ảnh, favicon, logo 200 đúng content-type; đường dẫn lạ 404 = `404.html` từng byte |
| 5 | Thiếu `/` cuối | PASS | `/gioi-thieu`, `/lien-he`, `/tin-tuc` → 308 bản có `/` |
| 6 | Header bảo mật | PASS | `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`, `CSP: frame-ancestors 'none'`, `COOP: same-origin`, `X-Robots-Tag: noindex` — trên alias, host deployment, trang 404 |
| 7 | Không lộ là production | PASS | canonical, `og:url`, sitemap trỏ `https://vipgroup.com.vn/…`; lập chỉ mục bị chặn bằng `X-Robots-Tag: noindex`; 404 không canonical |
| 8 | Link nội bộ | PASS | 11/11 URL nội bộ duy nhất trả 200 |
| 9 | CSP trong Chrome | PASS | 7 route: `html.js`, 0 vi phạm; script chèn inline **bị chặn** |
| 10 | Form JS bật | PASS | Click chuột thật → "Dữ liệu CHƯA được gửi…", URL không đổi, 0 request |
| 11 | Form JS tắt | PASS | CDP `setScriptExecutionDisabled`: nút `disabled`, 0 `name`, không `action`; click chuột + Enter thật → URL `/lien-he/` không query, 0 request; menu 375px hiện 7 link |
| 12 | Rò credential | PASS | HTML, robots, sitemap, svg, header: 0 dấu vết token / account id; chuỗi base64 dài chỉ là 19 hash CSP |

## Lighthouse 13.5.0 — URL staging thật

| Trang | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| / | 100 | 100 | 100 | 66 |
| /gioi-thieu/ | 100 | 100 | 100 | 66 |
| /linh-vuc-hoat-dong/ | 100 | 100 | 100 | 66 |
| /cong-ty-thanh-vien/ | 100 | 100 | 100 | 66 |
| /tin-tuc/ | 100 | 100 | 100 | 66 |
| /tuyen-dung/ | 100 | 100 | 100 | 66 |
| /lien-he/ | 100 | 100 | 100 | 66 |

- **SEO 66 là thuộc tính staging có chủ đích, không phải hồi quy:** audit duy nhất hỏng là `is-crawlable`, nguồn chặn `x-robots-tag: noindex` — do `public/_headers` đặt cho `*.pages.dev`. Phân loại nguyên nhân: **security headers**. Không phải mạng/CDN, asset, chuyển hướng hay mã ứng dụng. Audit `canonical` đạt. Điểm SEO trên production (tên miền thật, không khớp mẫu `*.pages.dev`) phải đo lại ở cổng production.
- `/linh-vuc-hoat-dong/`: một lượt TTFB 1034 ms (mạng/CDN, một lần); đo lại bằng curl 0.20–0.30 s; Performance vẫn 100.

## Quan sát (không chặn)

1. Cloudflare Pages tự thêm `access-control-allow-origin: *` (site tĩnh, không dữ liệu riêng).
2. Không có header HSTS; tên miền `.dev` nằm trong danh sách HSTS preload của trình duyệt.
3. `og:image` trỏ `https://vipgroup.com.vn/og-image.jpg` — sẽ chỉ hoạt động khi production lên.
4. Có header `report-to` / `nel` mặc định của Cloudflare.
5. **Sai sót phép đo của Controller** (không phải lỗi site, ghi lại theo quy tắc nghiệm thu): lần đo header đầu dùng mẫu `x-content-type:` nên tưởng thiếu `X-Content-Type-Options`; lần đo link đầu dùng vòng `for` của zsh không tách dòng nên báo 1 link hỏng giả. Cả hai đo lại đúng: đủ header, 0 link hỏng — và verifier độc lập xác nhận.

## Sau biên bản này

Mỗi lần push vào `develop`, workflow tự deploy lại alias `staging` với SHA mới. Biên bản này chứng nhận nội dung tại `920919b`. Các thay đổi chỉ sửa `docs/` không đổi `dist/`.

## Chưa làm (ngoài phạm vi staging)

Không merge `main`, không deploy production, không đổi DNS, không gắn `vipgroup.com.vn`.
