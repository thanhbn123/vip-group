# STAGING — Cloudflare Pages

Owner chọn **Cloudflare Pages** ngày 29/09/2026 (VIPG-WEB-003, issue #4). URL `*.pages.dev` là **staging**, không phải production.

## Thiết kế

| Sự kiện GitHub | Nhánh Cloudflare | URL cố định |
|---|---|---|
| push `develop` | `staging` | `https://staging.<project>.pages.dev` |
| pull request vào `develop` | `pr-<số PR>` | `https://pr-<số>.<project>.pages.dev` |
| (không bao giờ) | `main` — nhánh production của project | `https://<project>.pages.dev` |

- Workflow: `.github/workflows/staging.yml`, **hai job**:
  - `build` — checkout đúng SHA (PR: PR HEAD), `npm ci`, `check`, `build`, `test`, tải `dist` lên artifact. **Không có secret.**
  - `deploy` (`needs: build`) — **không checkout, không `npm ci`**, chỉ tải artifact `dist` rồi Direct Upload (`wrangler pages deploy`), gắn `--commit-hash` = SHA thật. Secret chỉ ở job này. Mã của PR vì thế không thể chạm vào token.
- Workflow **cấm** deploy vào `main` / `master` / `production`. Production là việc riêng, cần lệnh owner.
- `public/_headers`: header bảo mật + `X-Robots-Tag: noindex` cho mọi host `*.pages.dev`.
- CSP: thẻ `<meta>` do Astro sinh (`security.csp` trong `astro.config.mjs`).
- Secret Cloudflare chỉ cấp cho bước kiểm credential và bước deploy của job `deploy`. Job `deploy` kiểm lại nhánh đích bằng regex `^(staging|pr-[0-9]+)$` và SHA 40 ký tự hex trước mọi việc khác.
- PR từ fork không nhận secret → không deploy preview (hành vi mặc định của GitHub).
- Thiếu credential → bước deploy bị bỏ qua, job summary ghi `BLOCKED_EXTERNAL_CREDENTIAL` và có annotation cảnh báo. **Job vẫn hiện dấu xanh** (build/test thật sự đạt) — dấu xanh đó KHÔNG có nghĩa staging đã deploy; phải đọc summary.
- Mọi bước chạy `bash -eo pipefail`; deploy lỗi hoặc wrangler không in ra URL → bước FAIL, không in bảng "Staging deploy".
- `workflow_dispatch` chỉ chạy từ `develop`.
- Chốt chặn production dựa vào tên nhánh: project Cloudflare **phải** đặt production branch = `main`. Khi nghiệm thu staging, kiểm lại cấu hình này trên dashboard.

## Việc owner phải làm (Claude không có quyền, không tự làm)

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
