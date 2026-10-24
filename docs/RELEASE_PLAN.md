# RELEASE PLAN — trình tự phát hành production (CHƯA THỰC HIỆN)

> **RELEASE AUTHORIZATION: NOT AUTHORIZED.** Chỉ thực hiện khi owner ra lệnh phát hành rõ ràng. PASS kỹ thuật không phải lệnh phát hành.
> Rollback phải sẵn sàng **trước bước 4** — `docs/PRODUCTION.md` mục 6.

| # | Bước | Ai | Điều kiện / bằng chứng |
|---|---|---|---|
| 1 | Cung cấp / duyệt nội dung | Owner | Các mục MUST_HAVE trong `docs/CONTENT_INPUT_PACK.md` có dữ liệu thật → PR nội dung qua CI + verifier → staging |
| 2 | Xác nhận bảo vệ environment `production` | Owner | Required reviewers = owner · chỉ `main` · admin không bypass (đã tạo 30/09, owner xem lại) |
| 3 | Xác nhận kế hoạch DNS | Owner | `docs/DNS_MIGRATION.md` — `DNS MIGRATION READY = YES` |
| 4 | Merge **đúng** SHA `develop` đã verify → `main` | Owner duyệt PR | PR `develop` → `main` · CI · verifier · `--match-head-commit` |
| 5 | Xác minh SHA `main` | Controller | `git ls-remote … refs/heads/main`; cây `main` trùng cây SHA ứng viên |
| 6 | Chạy tay workflow production với đúng SHA | Owner | Actions → "Production (Cloudflare Pages) — chạy tay từ main" → Run trên `main`, dán SHA |
| 7 | Duyệt deployment `production` trên GitHub | Owner | Required reviewer |
| 8 | Deploy Cloudflare production | Workflow | preflight `production_branch=main`; deploy `--branch=main`; URL trong summary |
| 9 | Gắn / kích hoạt tên miền | Owner | `docs/DNS_MIGRATION.md` bước 11–12 |
| 10 | Chuyển nameserver | Owner | `docs/DNS_MIGRATION.md` bước 1–8; checklist email "Trước" đủ ✅ |
| 11 | Kiểm HTTPS + DNS | Controller | chứng chỉ hợp lệ apex + www; NS Cloudflare; www → apex 301 |
| 12 | Kiểm email Google Workspace | Owner | checklist email "Sau" đủ ✅ |
| 13 | Nghiệm thu trình duyệt production | Controller + verifier | 7 route, 404, form JS bật/tắt, CSP, header, không `X-Robots-Tag` |
| 14 | Lighthouse production | Controller | 7 trang trên `https://vipgroup.com.vn` (SEO kỳ vọng 100) |
| 15 | Lập chỉ mục / canonical / schema | Controller | canonical, sitemap, robots, JSON-LD trên tên miền thật |
| 16 | Lưu bằng chứng phát hành | Controller | `docs/verification/PRODUCTION-RELEASE-<ngày>.md`: SHA main, run production, URL deployment, kết quả 11–15 |

Bước 9 và 10 có thể đảo thứ tự (xem `docs/DNS_MIGRATION.md` mục 3): tên miền hiện chưa có website, rủi ro chính của việc đổi NS là email.
