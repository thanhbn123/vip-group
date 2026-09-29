# Biên bản nghiệm thu — VIPG-WEB-002 · PR #5

| Mục | Giá trị |
|---|---|
| Issue | #3 VIPG-WEB-002 — Hardening sau verifier + tài liệu điều phối (CLOSED 29/09/2026) |
| PR | #5 `feature/vipg-web-002-hardening-docs` → `develop` |
| Base đã kiểm | `5f34a0bb3811ca2e97c0f5d5c186d95edfb70457` |
| PR HEAD đã kiểm | `aecdef7281335522bf6a183e4ef44df945b22461` |
| CI trên PR HEAD | run 36587838658 — success |
| Verifier | tác tử độc lập, clone sạch, chỉ đọc — **PASS**, 0 blocker |
| Đo 4 chốt trước merge | 29/09/2026 22:19:21 +0700 — HEAD = verified · CI SHA = HEAD · develop = base · MERGEABLE/CLEAN |
| Merge | `gh pr merge --merge --match-head-commit aecdef7…` → `7ce3b7dd1d6d6b8b09270ed24d41df67787b61cf` (15:19:33 UTC) |
| Sau merge | `aecdef7` là tổ tiên của `develop`; cây `develop` == cây `aecdef7`; CI push develop run 36589327008 — success |

## Verifier đã kiểm (tóm tắt)

Phạm vi 15 file đúng Issue #3, không đổi `package*.json` / `.github/` · `npm ci` / `check` (0 lỗi, 37 file) / `build` (8 trang) / `test` 25/25 · đối chứng âm: 4 test mới FAIL trên base · **form JS tắt thật** (Chrome CDP `Emulation.setScriptExecutionDisabled`, 375px + 1280px): nút disabled, click chuột + Enter thật → URL `/lien-he/` không query, không request ngoài trang + favicon · form JS bật: nút mở, thông báo "CHƯA được gửi", 0 request · `dist` không có fetch/XHR/sendBeacon/WebSocket · menu tắt JS hiện 7 link · 404 noindex, không canonical/og:url, `/khong-ton-tai/` trả 404 · SEO/schema 7 route · trung thực nội dung · SHA/run trong docs khớp `gh` · 0 secret · `npm audit` 0.

## Phát hiện NON-BLOCKER

1. `docs/MASTER_STATUS.md` — Lighthouse là số đo cục bộ (đã ghi rõ), cần đo lại trên staging.
2. `docs/MASTER_STATUS.md` — tên Issue #4 diễn đạt lại → sửa trong VIPG-WEB-003.
3. `src/pages/cong-ty-thanh-vien.astro` — câu dẫn đọc như cả ba công ty đang hoạt động → sửa trong VIPG-WEB-003.
4. `tests/site.test.mjs` — một assert phụ của test menu yếu; test vẫn đứng nhờ assert chính + đối chứng âm.
5. `ContactForm.astro` — bỏ `novalidate`: bật JS mà để trống ô bắt buộc thì trình duyệt báo trước thông báo "CHƯA được gửi". Chủ ý, không lộ dữ liệu.
