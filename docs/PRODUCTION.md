# PRODUCTION — kiến trúc, quy trình phát hành, rollback, DNS

> **Chưa phát hành.** Tài liệu này mô tả cách phát hành khi owner ra lệnh. Không có bước nào ở đây được Controller tự chạy.
> Lập 30/09/2026 (VIPG-WEB-010, issue #19). Nguồn Cloudflare: developers.cloudflare.com/pages (Custom domains, Direct Upload, Rollbacks), đọc 30/09/2026.

## 1. Kiến trúc đích

| | Staging / Preview | Production |
|---|---|---|
| Nguồn | `develop` (push) · PR vào `develop` | `main` — chỉ chạy tay |
| Workflow | `.github/workflows/staging.yml` | `.github/workflows/production.yml` |
| Nhánh Cloudflare | `staging` · `pr-<số>` | `main` (= production branch của project) |
| Project Cloudflare Pages | `vip-group` (Direct Upload) | `vip-group` — cùng project |
| URL | `staging.vip-group.pages.dev`, `pr-<số>.vip-group.pages.dev` | `vipgroup.com.vn` (sau khi gắn tên miền) · `vip-group.pages.dev` |
| Lập chỉ mục | `X-Robots-Tag: noindex` (mọi host `*.pages.dev`) | **Cho phép** trên `vipgroup.com.vn`; `vip-group.pages.dev` vẫn noindex |
| Header bảo mật, CSP | Có | Có — cùng `public/_headers` và CSP `<meta>` |
| canonical / sitemap / robots | Trỏ `https://vipgroup.com.vn` | Trỏ `https://vipgroup.com.vn` |

**Vì sao một project dùng được cho cả hai:** Cloudflare Pages coi deployment là *production* khi `--branch` trùng production branch của project; mọi nhánh khác là *preview* (tài liệu Direct Upload). Staging chỉ deploy `staging` / `pr-<số>` và bị chặn cứng với `main`; production chỉ deploy `main`. Cả hai workflow đều **đọc** `production_branch` của project qua API trước khi deploy và dừng nếu khác `main`.

**Noindex tách theo host:** `public/_headers` gắn `X-Robots-Tag: noindex` cho `https://:project.pages.dev/*` và `https://:version.:project.pages.dev/*`, **không** gắn cho `/*`. Tên miền riêng không khớp mẫu đó nên được lập chỉ mục. `tests/production.test.mjs` mô phỏng cách áp `_headers` theo host để chặn lỗi này. **Chưa đo trên tên miền thật** — phải kiểm lại ngay sau khi gắn tên miền (mục 3, bước 6).

## 2. Cổng bảo vệ của workflow production

1. Chỉ `workflow_dispatch` — không có trigger push / PR / lịch.
2. File workflow chỉ chạy được từ nhánh được chọn; hiện `main` **chưa có** file này → chỉ dùng được sau khi owner merge `develop` → `main`.
3. Job `build` chỉ chạy khi `github.ref == refs/heads/main`; job `deploy` kiểm lại ref.
4. Owner phải **gõ lại đúng SHA 40 ký tự** của `main` khi bấm Run.
5. Job `deploy` dùng GitHub Environment **`production`**. Owner nên cấu hình *Required reviewers* (mục 5) — khi đó mỗi lần phát hành phải có người duyệt trên GitHub.
6. Thiếu credential → **FAIL**, không bỏ qua.
7. Preflight: `production_branch` của project phải là `main`.
8. `bash -eo pipefail`; wrangler lỗi hoặc không in URL → FAIL, không in bảng deploy.
9. Job `deploy` không checkout, không `npm ci` — chỉ tải artifact `dist-production` đã build + test ở job `build`.

## 3. Quy trình phát hành (owner ra lệnh từng bước)

Điều kiện trước: `docs/PRODUCTION_READINESS.md` PASS; CONTENT gate (V-11501) đã có dữ liệu thật hoặc owner chấp nhận phát hành với placeholder; quyết định DNS (mục 4).

1. PR `develop` → `main` → CI → verifier độc lập → **owner** duyệt merge.
2. Ghi lại SHA mới của `main`: `git ls-remote https://github.com/thanhbn123/vip-group.git refs/heads/main`.
3. GitHub → Actions → "Production (Cloudflare Pages) — chạy tay từ main" → Run workflow trên `main`, dán SHA ở bước 2.
4. Nếu đã cấu hình Required reviewers: duyệt deployment `production`.
5. Kiểm `https://vip-group.pages.dev/` phục vụ đúng bản (so byte với build của SHA đó; vẫn có noindex vì là host pages.dev).
6. Gắn tên miền (mục 4) → kiểm `https://vipgroup.com.vn/`: 200, HTTPS hợp lệ, **không có** `X-Robots-Tag`, còn đủ header bảo mật, canonical đúng, 7 route, sitemap, robots, OG, form JS bật/tắt, Lighthouse (SEO kỳ vọng 100 vì không còn noindex).

## 4. DNS — BLOCKED_EXTERNAL_DNS (owner quyết và làm)

> **Owner đã chọn phương án A (30/09/2026) — chỉ là quyết định chuẩn bị.** Kế hoạch chi tiết, kiểm kê bản ghi, checklist email: **`docs/DNS_MIGRATION.md`**. Trình tự phát hành: **`docs/RELEASE_PLAN.md`**.

**Hiện trạng (đo 30/09/2026, chỉ đọc):** NS `ns1/ns2.vclouddns.vn`; MX `1 SMTP.GOOGLE.COM`; TXT `google-site-verification=…`, `v=spf1 include:_spf.google.com ~all`; DKIM `google._domainkey`; **không** A/AAAA cho `vipgroup.com.vn` và `www`. Danh sách này chỉ gồm các tên đã dò — phải xuất toàn bộ zone từ vCloud trước khi đổi.

**Ràng buộc Cloudflare Pages (tài liệu Custom domains):**
- Tên miền **gốc** `vipgroup.com.vn` chỉ gắn được khi nó là **zone trên Cloudflare**, dùng **nameserver Cloudflare**. Không làm được bằng bản ghi A/CNAME ở vCloud. *(Tài liệu Custom domains viết "that custom domain must be a zone on the Cloudflare account you have created your Pages project on" — tức cùng account với project `vip-group`; kế hoạch dưới đây theo đúng điều đó.)*
- Subdomain `www.vipgroup.com.vn` gắn được với DNS ngoài bằng **CNAME `www` → `vip-group.pages.dev`**.
- **Thứ tự bắt buộc:** thêm tên miền trong Pages (vip-group → Custom domains → Set up a domain) **trước**, rồi mới tạo bản ghi DNS; tạo CNAME trước sẽ gây lỗi 522.

**Phương án (owner chọn):**

| | A — chuyển zone sang Cloudflare (khuyến nghị) | B — giữ DNS vCloud, dùng `www` |
|---|---|---|
| Apex `vipgroup.com.vn` | Gắn trực tiếp vào Pages | Không gắn được vào Pages; cần chuyển hướng apex → `https://www…` tại vCloud (nếu vCloud hỗ trợ chuyển hướng có HTTPS) |
| Việc DNS | Thêm zone vào account Cloudflare → chép **toàn bộ** bản ghi (MX, SPF, DKIM, google-site-verification, bản ghi khác) → đổi nameserver tại nhà đăng ký sang cặp NS Cloudflare cấp → Pages → Custom domains thêm `vipgroup.com.vn` và `www` | Pages → Custom domains thêm `www.vipgroup.com.vn` → tại vCloud tạo CNAME `www` → `vip-group.pages.dev` |
| Rủi ro | Sai/thiếu bản ghi khi chuyển → **gián đoạn email Google Workspace** | Apex phụ thuộc chuyển hướng của vCloud; phải đổi canonical sang `www` (sửa `SITE_URL`, sitemap, test) |
| Thay đổi mã | Không | Có (PR riêng) |

Controller **không** đổi DNS, nameserver, hay gắn tên miền.

## 5. GitHub Environment `production` (V-11507)

**Đã tạo 30/09/2026 theo lệnh owner** (qua API, đo lại sau khi tạo):
- **Required reviewers:** `thanhbn123`.
- **Deployment branches:** tuỳ chỉnh — **chỉ `main`**.
- **Admin bypass:** tắt (`can_admins_bypass: false`).
- **Prevent self-review:** **tắt có chủ đích** — repo chỉ có một người duyệt; bật sẽ khiến chính owner không duyệt được lượt owner tự bấm chạy. Muốn bật: thêm người duyệt thứ hai trước.
- Secret vẫn ở cấp repo (owner yêu cầu không nhân bản). (Tuỳ chọn, mạnh hơn: chuyển sang environment secret của `production` và dùng token riêng cho staging.)

Hai environment tạo nhầm tên `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (trống: 0 secret, 0 biến, 0 deployment, không protection, không workflow nào dùng) đã được xoá cùng ngày theo lệnh owner; cấu hình của chúng được lưu trong nhật ký dự án trước khi xoá.

Controller không nới lỏng cổng này.

## 6. Rollback

- **Nhanh (khuyến nghị):** Cloudflare dashboard → Workers & Pages → `vip-group` → Deployments → chọn bản **production** trước đó → ⋯ → **Rollback**. Có hiệu lực ngay; chỉ quay về được bản *production* đã build thành công (không quay về bản preview/staging). Tài liệu Rollbacks của Cloudflare mô tả cho dự án nói chung, không riêng Direct Upload — cần thử một lần khi có ≥ 2 bản production.
- **Theo mã:** PR `revert` trên `main` (qua CI + verifier) → chạy lại workflow production với SHA mới.
- **Khẩn cấp (gỡ tên miền):** Pages → Custom domains → gỡ `vipgroup.com.vn` (site ngừng phục vụ trên tên miền; không đụng email vì MX/TXT độc lập).
- Sau mọi rollback: ghi SHA đang phục vụ + lý do vào `docs/verification/`.
