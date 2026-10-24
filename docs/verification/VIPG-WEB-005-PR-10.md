# Biên bản nghiệm thu — VIPG-WEB-005 · PR #10

| Mục | Giá trị |
|---|---|
| Issue | #9 VIPG-WEB-005 — Tách job deploy staging khỏi job build (CLOSED 29/09/2026) |
| PR | #10 `feature/vipg-web-005-isolate-deploy-job` → `develop` |
| Base đã kiểm | `c50fb70de72336c6012dfc541df5f1b6d7725266` |
| PR HEAD đã kiểm | `10b718604e358f5ef81c43bc3292cdfe33d8d883` |
| CI trên PR HEAD | CI 36595835466 success · Staging 36595835705 success — job `build` (checkout `10b7186`, upload artifact `dist`), job `deploy` (guard + credential check chạy; download/setup-node/deploy skipped; log 0 lần checkout / npm) |
| Verifier | tác tử độc lập, clone sạch, chỉ đọc — **PASS**, 0 blocker |
| Đo 4 chốt trước merge | 29/09/2026 23:18:10 +0700 — HEAD = verified · 2 workflow success đúng SHA · develop = base · MERGEABLE/CLEAN |
| Merge | `--match-head-commit 10b718604e35…` → `e7c813f1a94b6ccdaef079563d12d35f7db8f8c8` (16:18:18 UTC) |
| Sau merge | `10b7186` là tổ tiên `develop`; cây trùng; CI 36596733243 + Staging 36596733539 (push develop, 2 job) success |

## Sai sót của Controller (ghi lại, không che)

Đề giao verifier ghi "Expected PR HEAD" là `10b718684f3a0a64a1ad4bf36dc4f47ea8ca4bdb` — SHA **không tồn tại** (`git cat-file` báo lỗi). Controller chỉ có 7 ký tự `10b7186` từ `git log --oneline` rồi tự điền phần còn lại thay vì lấy từ lệnh. Phép kiểm không sai đối tượng vì đề đã yêu cầu verifier tự lấy SHA thật bằng `gh pr view` và chỉ đối chiếu tiền tố; verifier phát hiện và báo lỗi. Lệnh merge dùng SHA thật lấy từ `gh`. Từ đây: SHA đầy đủ chỉ lấy bằng `git rev-parse` / `gh`.

## Verifier đã kiểm (tóm tắt)

YAML: job build không `secrets.`, job deploy không checkout/npm, secret đúng 2 bước · guard nhánh/SHA: `staging`, `pr-12` qua; `main`, `production`, `pr-`, `pr-1;x`, `staging;x`, `pr-1abc`, rỗng, SHA sai → exit 1 · mô phỏng deploy a/b/c · 4 đột biến đều bị test bắt · hồi quy site (7 route, 404, CSP hash + thứ tự, trung thực nội dung, form) · docs khớp `gh` · 0 secret · `npm audit` 0.

## Phát hiện NON-BLOCKER

1. Job deploy tin nhánh/SHA từ output của job build (chạy mã không tin cậy) → **VIPG-WEB-006 (#11)**: tự tính và so khớp.
2. `dist` do PR quyết định (có thể chứa `_worker.js` / `_routes.json`) — đó chính là bản preview, chấp nhận.
3. Người có quyền push vẫn sửa được chính workflow để chạm secret — tách job chỉ chặn mã phụ thuộc bị chiếm. `docs/STAGING.md` nói quá phạm vi → sửa trong VIPG-WEB-006; phương án mạnh hơn: GitHub Environment có reviewer.
4. Mô phỏng chạy bằng bash 3.2 của macOS, runner dùng bash 5.
