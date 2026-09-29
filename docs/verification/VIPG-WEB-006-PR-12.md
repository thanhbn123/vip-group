# Biên bản nghiệm thu — VIPG-WEB-006 · PR #12

| Mục | Giá trị |
|---|---|
| Issue | #11 VIPG-WEB-006 — Job deploy tự tính nhánh/SHA mong đợi, không tin output của job build (CLOSED 29/09/2026) |
| PR | #12 `feature/vipg-web-006-deploy-recompute-target` → `develop` |
| Base đã kiểm | `e7c813f1a94b6ccdaef079563d12d35f7db8f8c8` |
| PR HEAD đã kiểm | `f3bbbf430fd91d0ba62f14af7666d67617ad171b` |
| CI trên PR HEAD | CI 36597141129 success · Staging 36597141157 success — log guard: `EVENT_NAME=pull_request`, `EVENT_PR_NUMBER=12`, `TARGET_BRANCH=pr-12`, `TARGET_SHA=f3bbbf4…`, bước đạt; deploy skipped |
| Verifier | tác tử độc lập, clone sạch, chỉ đọc — **PASS**, 0 blocker. 19 ca guard (hợp lệ → 0; output bị sửa/thiếu → 1); 6 đột biến bị `security.test.mjs` bắt |
| Đo 4 chốt trước merge | 29/09/2026 23:28:53 +0700 — HEAD = verified · 2 workflow success đúng SHA · develop = base · MERGEABLE/CLEAN |
| Merge | `--match-head-commit f3bbbf43…` → `cc55faca393df90e52c5fc106b3ed23e5ebe2772` |
| Sau merge | `f3bbbf4` là tổ tiên `develop`; cây trùng; CI 36598041986 + Staging 36598041691 (push develop) success |

## Phát hiện NON-BLOCKER → VIPG-WEB-007 (#13)

1. Test chỉ kiểm cấu trúc: đổi `EXPECT_*` sang lấy từ `TARGET_*` vẫn PASS → thêm `tests/workflow-behavior.test.mjs` chạy thật script.
2. Mô phỏng hành vi chỉ chạy bash 3.2 (macOS) → test hành vi chạy trong CI (Ubuntu, bash 5).
3. Giờ đo 4 chốt và câu "verifier phát hiện lỗi SHA" trong biên bản PR #10 là lời Controller tự ghi, không kiểm được bằng `gh`.
