# Biên bản nghiệm thu — VIPG-WEB-004 · PR #8

| Mục | Giá trị |
|---|---|
| Issue | #7 VIPG-WEB-004 — SHA preview chính xác + script inline nằm dưới CSP (CLOSED 29/09/2026) |
| PR | #8 `feature/vipg-web-004-preview-sha-csp-order` → `develop` |
| Base đã kiểm | `bc6be7b4c87ed8d8228915d79f9b4b9acc75e9e4` |
| PR HEAD đã kiểm | `1fcd534ee84761c033f83c51f6ed88ce2d83c755` |
| CI trên PR HEAD | CI 36594387447 success · Staging 36594387497 success (log: `HEAD is now at 1fcd534`, `BRANCH="pr-8"`, deploy skipped) |
| Verifier | tác tử độc lập, clone sạch, chỉ đọc — **PASS**, 0 blocker |
| Bằng chứng cốt lõi | Đột biến nội dung script `html.js` giữ hash cũ: trên HEAD **Chrome chặn** (vi phạm `script-src-elem`); trên base `bc6be7b` **không chặn** → thứ tự cũ không thực thi hash, thứ tự mới có |
| Đo 4 chốt trước merge | 29/09/2026 23:06:20 +0700 — HEAD = verified · 2 workflow success đúng SHA · develop = base · MERGEABLE/CLEAN |
| Merge | `--match-head-commit 1fcd534…` → `c50fb70de72336c6012dfc541df5f1b6d7725266` (16:06:31 UTC) |
| Sau merge | `1fcd534` là tổ tiên `develop`; cây trùng; CI 36595289188 + Staging 36595289082 (push develop) success |

## Phát hiện NON-BLOCKER

1. Mã PR chạy `npm ci`/build cùng job với bước deploy cầm token → có thể chiếm `npx` qua `GITHUB_PATH`/`GITHUB_ENV` (chỉ PR cùng repo; rủi ro có từ trước) → **VIPG-WEB-005 (#9)**: tách job deploy.
2. `MASTER_STATUS` ghi CSP "PASS cục bộ" dựa trên verifier PR #6 — thực ra hash script `html.js` chỉ được thực thi từ PR #8 → sửa căn cứ trong VIPG-WEB-005.
3. Script `html.js` nay ở đầu `<body>`, sau CSS `<head>` — chưa đo nháy menu; về lý thuyết không nháy vì đứng trước `<header>`.
