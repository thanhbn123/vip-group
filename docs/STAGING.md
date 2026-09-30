# STAGING — Cloudflare Pages

Owner chọn **Cloudflare Pages** ngày 29/09/2026 (VIPG-WEB-003, issue #4). URL `*.pages.dev` là **staging**, không phải production.

## Hiện trạng (nghiệm thu 30/09/2026)

| Mục | Giá trị |
|---|---|
| Trạng thái | **STAGING ACCEPTANCE: PASS** — `docs/verification/VIPG-WEB-003-STAGING-ACCEPTANCE.md` |
| Staging URL | https://staging.vip-group.pages.dev |
| Project Cloudflare Pages | `vip-group` (Direct Upload, tạo 30/09/2026) — production `vip-group.pages.dev` **chưa có deployment** |
| SHA đã nghiệm thu | `920919b57fd60ff1e39218c25bad8dd53ea932fd` (run 36602899641) |
| Credential GitHub | secret `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; biến `CF_PAGES_PROJECT=vip-group` |

Khi repo còn đủ secret/biến Cloudflare: mỗi lần push `develop`, alias `staging` được deploy lại với SHA mới; mỗi PR vào `develop` có preview `pr-<số>`. Thiếu credential thì bước deploy bị bỏ qua và ghi `BLOCKED_EXTERNAL_CREDENTIAL`.

Một số chi tiết (project tạo ngày 30/09; lượt deploy staging hiện là môi trường **Preview**; "No production deployment yet") được đọc trên dashboard Cloudflare lúc nghiệm thu; phía công khai kiểm lại được bằng `https://vip-group.pages.dev/` trả 404 "Deployment Not Found".

## Thiết kế

| Sự kiện GitHub | Nhánh Cloudflare | URL cố định |
|---|---|---|
| push `develop` | `staging` | `https://staging.<project>.pages.dev` |
| pull request vào `develop` | `pr-<số PR>` | `https://pr-<số>.<project>.pages.dev` |
| (không bao giờ) | `main` — nhánh production của project | `https://<project>.pages.dev` |

- Workflow: `.github/workflows/staging.yml`, **hai job**:
  - `build` — checkout đúng SHA (PR: PR HEAD), `npm ci`, `check`, `build`, `test`, tải `dist` lên artifact. **Không có secret.**
  - `deploy` (`needs: build`) — **không checkout, không `npm ci`**, chỉ tải artifact `dist` rồi Direct Upload (`wrangler pages deploy`), gắn `--commit-hash` = SHA thật. Secret chỉ ở job này.
- Workflow **cấm** deploy vào `main` / `master` / `production`. Production là workflow riêng `production.yml` (chạy tay từ `main`) — xem `docs/PRODUCTION.md`.
- Trước khi deploy, job `deploy` **đọc** `production_branch` của project qua API Cloudflare và dừng nếu khác `main` (để nhánh `staging` không bao giờ thành production).
- `public/_headers`: header bảo mật + `X-Robots-Tag: noindex` cho mọi host `*.pages.dev`.
- CSP: thẻ `<meta>` do Astro sinh (`security.csp` trong `astro.config.mjs`).
- Secret Cloudflare chỉ cấp cho **ba** bước của job `deploy`: kiểm credential, **preflight đọc `production_branch`** (API Cloudflare, chỉ đọc; khác `main` → dừng), và deploy. Trước mọi việc khác, job `deploy` kiểm nhánh đích bằng regex `^(staging|pr-[0-9]+)$`, SHA 40 ký tự hex, **và tự tính lại nhánh + SHA mong đợi từ ngữ cảnh sự kiện** (`github.event_name`, số PR, PR head SHA, `github.sha`) rồi so khớp — output của job build lệch là dừng.
- **Phạm vi bảo vệ (nói đúng, không nói rộng):** việc tách job chặn được mã chạy trong job build (kể cả gói npm bị chiếm) chạm vào token hay tự chọn alias/SHA. Nó **không** chặn người có quyền push sửa chính `staging.yml` trong một PR để lấy secret. Muốn chặn cả điều đó: đặt secret trong một GitHub **Environment** (ví dụ `staging`) có reviewer bắt buộc và gắn `environment: staging` cho job `deploy` — cần owner cấu hình, chưa làm.
- PR từ fork không nhận secret → không deploy preview (hành vi mặc định của GitHub).
- Thiếu credential → bước deploy bị bỏ qua, job summary ghi `BLOCKED_EXTERNAL_CREDENTIAL` và có annotation cảnh báo. **Job vẫn hiện dấu xanh** (build/test thật sự đạt) — dấu xanh đó KHÔNG có nghĩa staging đã deploy; phải đọc summary.
- Mọi bước chạy `bash -eo pipefail`; deploy lỗi hoặc wrangler không in ra URL → bước FAIL, không in bảng "Staging deploy".
- `workflow_dispatch` chỉ chạy từ `develop`.
- Chốt chặn production dựa vào tên nhánh: project Cloudflare **phải** đặt production branch = `main`. Khi nghiệm thu staging, kiểm lại cấu hình này trên dashboard.

## Việc owner đã làm / phải làm khi cấp lại credential (Claude không tạo hay nhập token)

1. Tạo tài khoản / đăng nhập Cloudflare.
2. Tạo project Pages kiểu **Direct Upload** (không nối Git), tên gợi ý `vip-group`, production branch = `main`.
3. Tạo API token quyền **Account → Cloudflare Pages → Edit** (chỉ quyền này).
4. Trong GitHub repo → Settings → Secrets and variables → Actions:
   - Secret `CLOUDFLARE_API_TOKEN`
   - Secret `CLOUDFLARE_ACCOUNT_ID`
   - Variable `CF_PAGES_PROJECT` = tên project ở bước 2
5. Báo lại Controller để chạy lại workflow và nghiệm thu staging.

**Không** gửi token qua chat hay commit vào repo. Không cần đổi DNS tại vCloud cho staging.

## Nghiệm thu staging (sau khi đã deploy)

7 trang · mobile · desktop · assets · form (JS bật/tắt) · điều hướng nội bộ · HTTPS · canonical · robots · sitemap · OG preview · Lighthouse · không asset hỏng · không lỗi console · header bảo mật (`curl -I`) · `X-Robots-Tag: noindex` · URL thiếu `/` được chuyển hướng · 404 trả trang 404. Deployment phải mang đúng SHA của `develop`.
