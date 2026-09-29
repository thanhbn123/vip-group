# PROJECT CONTROLLER — VIP GROUP WEBSITE

Luật điều phối dự án website VIP GROUP (https://vipgroup.com.vn). GitHub là nguồn chân lý (source of truth): mọi trạng thái trong `docs/` phải đo lại từ GitHub trước khi dùng.

## Quy trình bắt buộc

```
Issue / Change Request
→ branch riêng từ develop
→ code + test
→ push branch → Pull Request vào develop
→ CI (đúng SHA của PR HEAD)
→ verifier độc lập (không phải người viết code)
→ merge develop
→ staging acceptance
→ PR develop → main → CI → verifier → merge main
→ production deploy từ main
```

## Cấm

- Push hoặc sửa trực tiếp `main`, `develop`, production.
- Deploy code chưa merge đúng quy trình; upload code tay lên production.
- Dùng CI của SHA cũ để nghiệm thu SHA mới.
- Merge khi PR HEAD đã đổi sau verifier, hoặc `develop` đã đổi làm hỏng baseline.
- Đưa secret / token / mật khẩu vào repo.
- Bịa dữ liệu pháp lý, số điện thoại, địa chỉ, tên công ty, tin tức, số liệu.

## Quyền của Controller (owner cấp ngày 29/09/2026)

| Được tự làm | Không được tự làm |
|---|---|
| Issue/CR, branch, code, test, commit, push, PR, CI | Merge `develop` → `main` |
| Giao verifier độc lập, sửa blocker, chạy lại | Deploy production, ghi đè production |
| Merge PR vào `develop` khi đủ chốt bên dưới | Đổi DNS / nameserver, sửa trực tiếp VPS production |
| | Tự điền hotline, pháp nhân, địa chỉ, email, logo |

`main` giữ nguyên cho tới khi staging acceptance PASS **và** owner ra lệnh production riêng.

## Chốt an toàn trước mọi merge

Đo ngay trước merge, merge bằng `gh pr merge --match-head-commit <VERIFIED HEAD>`, ghi biên bản vào `docs/verification/`:

| Đại lượng | Điều kiện |
|---|---|
| PR HEAD | == VERIFIED HEAD |
| CI SHA | == PR HEAD, kết luận `success` |
| develop hiện tại | == base mà verifier đã kiểm |
| mergeable | `MERGEABLE` |

Sai một điều → dừng merge, đo lại baseline.

## Dữ liệu nội dung

Thông tin owner chưa cung cấp để `null` trong `src/data/`, giao diện hiện "Đang cập nhật". Trạng thái: `CONTENT_PENDING`. Không phải blocker kỹ thuật khi placeholder hiển thị rõ ràng.

## Điều kiện dừng

GitHub auth lỗi · SHA đổi bất ngờ · conflict · CI sai SHA · lộ secret · cấu hình production không rõ · cần DNS / secret / thông tin pháp lý từ owner. Khi dừng: không đoán, báo đúng blocker.

## Báo cáo sau mỗi vòng

PROJECT · CONTROLLER · MEASURED AT · MAIN · DEVELOP · OPEN PRS · MERGED THIS ROUND · CREATED PRS · CI · VERIFICATION · CURRENT GATE · TECHNICAL STATUS · CONTENT STATUS · STAGING · PRODUCTION · BLOCKERS · NEXT ACTION.

## Staging

Nền tảng: **Cloudflare Pages** (owner chọn 29/09/2026). URL `*.pages.dev` chỉ là staging, không phải production. Không dùng GitHub Pages, không dùng VPS cho staging. Thiếu credential Cloudflare → `BLOCKED_EXTERNAL_CREDENTIAL`.
