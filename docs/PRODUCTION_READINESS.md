# PRODUCTION READINESS — checklist

> **PASS ở đây nghĩa là sẵn sàng về kỹ thuật để owner duyệt phát hành — KHÔNG phải lệnh phát hành.**
> Ứng viên phát hành (`PRODUCTION_CANDIDATE_SHA`) = SHA `develop` tại thời điểm verifier độc lập kiểm; biên bản ghi trong `docs/verification/`.
> Lập 30/09/2026 (VIPG-WEB-010, issue #19).

## A. Kỹ thuật (Controller + verifier độc lập)

| # | Mục | Cách kiểm | Kết quả mong đợi |
|---|---|---|---|
| A1 | CI trên SHA ứng viên | `gh run list` theo SHA | CI + Staging success |
| A2 | Type check / build / test | `npm ci && npm run check && npm run build && npm test` | 0 lỗi · 8 trang · toàn bộ test đạt |
| A3 | Repo sạch, không PR/issue mở ngoài dự kiến | `gh pr list`, `gh issue list` | Chỉ các mục đã biết |
| A4 | Staging khoẻ và khớp repo | curl staging + so byte `dist/` | 200, nội dung khớp build của SHA staging |
| A5 | Không workflow nào deploy production từ `develop` | Đọc `.github/workflows/*`, `tests/production.test.mjs` | Chỉ `production.yml` deploy `main`, chỉ chạy tay, chỉ từ `main` |
| A6 | Không tự động hoá DNS / tên miền / nameserver trong repo | grep `.github/` | Không có |
| A7 | Không rò secret | secret scan repo · log CI (`***`) · HTML/JS/header staging | 0 |
| A8 | Chế độ production: lập chỉ mục | `tests/production.test.mjs` (mô phỏng `_headers` theo host) | `vipgroup.com.vn` không `X-Robots-Tag`; `*.pages.dev` noindex; trang không meta noindex (trừ 404) |
| A9 | Canonical / sitemap / robots | test | Trỏ `https://vipgroup.com.vn`; `Allow: /`; 7 URL |
| A10 | Header bảo mật + CSP giữ nguyên ở production | test `_headers` theo host · CSP `<meta>` | nosniff, Referrer-Policy, Permissions-Policy, XFO DENY, frame-ancestors, COOP; CSP không unsafe-inline |
| A11 | Không chuỗi staging trong `dist/` | test | Không `pages.dev` / `staging` ngoài `_headers` |
| A12 | Form JS bật/tắt | test tĩnh + nghiệm thu staging (CDP) | Không gửi dữ liệu, không lọt vào URL |
| A13 | Lighthouse chế độ production | Lighthouse trên bản chạy cục bộ (không header noindex) | P/A/BP/SEO — ghi số đo |
| A14 | Rollback có tài liệu | `docs/PRODUCTION.md` mục 6 | Có |
| A15 | Quy trình phát hành có tài liệu | `docs/PRODUCTION.md` mục 3 | Có |
| A16 | `main` không đổi | `git ls-remote` | `57214628…` |

## B. Cổng ngoài kỹ thuật (owner)

| # | Cổng | Trạng thái | Việc cần |
|---|---|---|---|
| B1 | CONTENT (V-11501) | **CHẶN** | Gửi 8 mục trong `docs/CONTENT_INPUT_PACK.md`, hoặc chấp nhận phát hành với placeholder |
| B2 | DNS | **BLOCKED_EXTERNAL_DNS** | Chọn phương án A (chuyển zone sang Cloudflare) hoặc B (`www` + CNAME) — `docs/PRODUCTION.md` mục 4 |
| B3 | GitHub Environment `production` có Required reviewers (V-11507) | Khuyến nghị làm trước lần phát hành đầu | `docs/PRODUCTION.md` mục 5 |
| B4 | Duyệt merge `develop` → `main` | Chờ lệnh | PR → CI → verifier → owner duyệt |
| B5 | Chạy workflow production | Chờ lệnh | `docs/PRODUCTION.md` mục 3 |

## C. Sau phát hành (khi owner đã ra lệnh)

Kiểm trên `https://vipgroup.com.vn`: 200 · HTTPS · **không** `X-Robots-Tag` · đủ header bảo mật · CSP · canonical · 7 route · sitemap · robots · OG · form JS bật/tắt · Lighthouse (SEO kỳ vọng 100) · SHA đang phục vụ khớp build của `main`. Ghi biên bản vào `docs/verification/`.
