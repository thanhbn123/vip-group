# Biên bản nghiệm thu — VIPG-WEB-003 · PR #6

| Mục | Giá trị |
|---|---|
| Issue | #4 VIPG-WEB-003 — Thiết lập môi trường staging (**vẫn mở**: staging thật chưa deploy, BLOCKED_EXTERNAL_CREDENTIAL) |
| PR | #6 `feature/vipg-web-003-cloudflare-staging` → `develop` |
| Base đã kiểm | `7ce3b7dd1d6d6b8b09270ed24d41df67787b61cf` |
| Verifier lượt 1 | HEAD `92ea55a3f5c1b60182550d0286c9ae08a5afb76b` — **FAIL**: bước deploy `wrangler \| tee` chạy dưới `bash -e` không `pipefail` → wrangler lỗi vẫn xanh và in bảng "Staging deploy" (deploy giả) |
| Sửa | `23fec69` — `defaults.run.shell: bash` (`-eo pipefail`), `set -euo pipefail`, không có URL → `exit 1` trước khi in bảng; `workflow_dispatch` chỉ từ develop |
| Verifier lượt 2 | HEAD `23fec69754900ce4c5ee5d0b5037bc46c37ee1d6` — **PASS**, 0 blocker. Chạy lại bước deploy với `npx` giả: mới (a) wrangler lỗi → rc 1, (b) không URL → rc 1, (c) có URL → rc 0 + bảng; cũ (a)(b) → rc 0 + bảng (xác nhận lỗi cũ có thật) |
| CI trên PR HEAD | CI 36592294624 success · Staging 36592294764 success (deploy **skipped**, annotation BLOCKED_EXTERNAL_CREDENTIAL, shell `bash -e -o pipefail`) |
| Đo 4 chốt trước merge | 29/09/2026 22:52:52 +0700 — HEAD = verified · 2 workflow success đúng SHA · develop = base · MERGEABLE/CLEAN |
| Merge | `--match-head-commit 23fec69…` → `bc6be7b4c87ed8d8228915d79f9b4b9acc75e9e4` (15:53:00 UTC) |
| Sau merge | `23fec69` là tổ tiên `develop`; cây trùng; CI 36593581246 + Staging 36593581189 (push develop → nhánh Cloudflare `staging`, SHA `bc6be7b`, deploy skipped) success |

## Phát hiện NON-BLOCKER lượt 2 → VIPG-WEB-004 (#7)

1. Preview PR build từ merge ref nhưng gắn `--commit-hash` = PR head → sửa: checkout đúng PR head.
2. Script `is:inline` nằm trước thẻ CSP → trình duyệt không kiểm hash → sửa: chuyển xuống đầu `<body>`.
3. Chốt production dựa vào tên nhánh — project Cloudflare phải đặt production branch = `main` (ghi trong `docs/STAGING.md`, kiểm khi nghiệm thu).
4. Cảnh báo Shiki của Astro khi bật CSP — site không dùng Shiki.

## Chưa kiểm được

Deploy thật, header thật trên Cloudflare, noindex `*.pages.dev`, chuyển hướng URL thiếu `/`, HTTPS — cần credential Cloudflare của owner.
