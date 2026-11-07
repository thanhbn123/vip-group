# CỔNG KHÁCH HÀNG VIP GROUP P1 — GÓI CHUẨN BỊ TRIỂN KHAI PRODUCTION

Phiên bản 0.1 · 07/11/2026 · Người lập: DevOps/Security (phiên website, chỉ đọc repo).
**Trạng thái: ĐỀ XUẤT – CHƯA ÁP DỤNG. Production NO-GO.** Tài liệu này chỉ để owner xem xét. Khi lập, tôi **không** chạy lệnh nào trên VPS, DNS, Cloudflare hay production, **không** sửa repo VIP ID hay CRM. Mọi lệnh bên dưới dành cho owner hoặc người vận hành, và chỉ chạy khi có phê duyệt riêng.

Căn cứ (đọc ngày 07/11/2026):
- Hợp đồng: `docs/cong-khach-hang/KIEN_TRUC_P1.md` (v1.1), gọi tắt **HĐ**.
- VIP ID: `~/code/vip-group-id-khach`, nhánh `feature/khach-p1` @ `5e1effe`.
- CRM: `~/Projects/vip-group-khoqctq`, nhánh `main` @ `a791c67`.
- Website: repo này.

Quy ước trích dẫn: `VIPID:` = repo VIP ID, `CRM:` = repo CRM, `WEB:` = repo này.

---

## 0. Tóm tắt cho owner

| Hạng mục | Kết luận |
|---|---|
| Sẵn sàng production? | **Chưa.** Còn 8 điểm chặn cứng (mục 11.1). Lớn nhất: (1) VIP ID chưa có kênh gửi email (A8); (2) **hai bên đang ký HMAC theo hai kiểu khác nhau**, nên mọi lời gọi server↔server sẽ bị từ chối (mục 5.3); (3) container VIP ID không gọi được CRM qua `127.0.0.1` (mục 1.3); (4) CRM production chưa có bản phát hành chứa cổng khách, và vẫn NO-GO PUBLIC |
| DNS | Thêm **một** bản ghi `A khachhang → 160.22.170.20` tại iNET/vCloudDNS. DNS **không** nằm ở Cloudflare |
| Email | Tên miền đang dùng **Google Workspace** (MX, SPF, DKIM đã có). Đề xuất: gửi bằng Workspace với SMTP AUTH; thêm bản ghi DMARC. VIP ID cần thêm khoảng **2–3 ngày công** code |
| Thứ tự | Sửa chặn → staging `khachhang-staging` E2E → backup → CRM → VIP ID → Caddy → kiểm tra → website. Website bật **sau cùng** |
| Rollback nhanh nhất | Tắt cờ `COWORK_KHACH_ENABLED=0` / `PORTAL_ENABLED=0` (≈ 1 phút), rồi gỡ khối Caddy (< 2 phút). Không cần đụng DB |

---

## 1. Kiến trúc production

### 1.1. Sơ đồ (ĐỀ XUẤT)

```
                         Internet (trình duyệt khách)
                                   │ HTTPS 443
                                   ▼
  DNS iNET/vCloudDNS: khachhang.vipgroup.com.vn  A  160.22.170.20   (ĐỀ XUẤT, chưa tạo)
                                   │
 ┌─────────────────────────────── VPS 160.22.170.20 ───────────────────────────────────────┐
 │  Caddy v2.11.4 · container vip-staging-caddy · network host · /srv/vip-staging-proxy/Caddyfile │
 │                                                                                          │
 │  site khachhang.vipgroup.com.vn                                                          │
 │   ├─ /tai-khoan, /tai-khoan/*  ──────────► 127.0.0.1:8899  VIP ID (container cowork-staging)│
 │   │                                         realm KHÁCH (chọn theo Host)                 │
 │   ├─ /portal, /portal/*        ──────────► 127.0.0.1:18185 CRM (container app, vipcrm6-prod)│
 │   ├─ /api/internal/khach/*     ──► CHỈ nguồn nội bộ đã đo (CRM → VIP ID), còn lại 404      │
 │   ├─ /api/internal/* khác      ──► 404                                                    │
 │   ├─ /                         ──► 302 /tai-khoan/dang-nhap                               │
 │   └─ mọi đường khác            ──► 404                                                    │
 │                                                                                          │
 │  site cowork.vipgroup.com.vn (đang chạy) ──► 127.0.0.1:8899  VIP ID realm NHÂN VIÊN       │
 │  site crm.vipgroup.com.vn    (CHƯA mở)   ──► 127.0.0.1:18185 CRM nhân viên                │
 │                                                                                          │
 │  Server↔server (HMAC, VIPID_PORTAL_SECRET):                                              │
 │   VIP ID ──POST /api/internal/portal/{signups,thu-hoi}──► CRM  (Host KHÔNG phải host khách)│
 │   CRM    ──POST https://khachhang…/api/internal/khach/{ket-qua-duyet,tam-khoa,thu-hoi}──► │
 │            Caddy ──► VIP ID (Host = khachhang.vipgroup.com.vn)                            │
 │  Trình duyệt: VIP ID 302 ──► /portal/auth/launch?token=… (HS256, TTL ≤ 60 s, nonce 1 lần)  │
 └──────────────────────────────────────────────────────────────────────────────────────────┘
```

Cơ sở:
- IP VPS, Caddy, container: VIPID `docs/CAU-HINH-TEN-MIEN.md:12-13,17`, `docs/TRIEN-KHAI-PRODUCTION.md:14`.
- VIP ID production chạy trong container `cowork-staging` cổng `127.0.0.1:8899`: VIPID `deploy/vps/docker-compose.yml:9-14`, `deploy/vps/README.md:71-79`, `docs/TRIEN-KHAI-PRODUCTION.md:297-301`.
- CRM production `127.0.0.1:18185`: CRM `deploy/production/compose.yml:55`, `VIP_CRM_V6_PRODUCTION_RUNBOOK.md:22`.
- Chia đường dẫn theo HĐ §2 và §3.2 (`KIEN_TRUC_P1.md:22-34,61-72`).

### 1.2. Mỗi bên tự chặn theo Host (đã có trong code)

| Bên | Host khách (`khachhang…`) | Host khác | Nguồn |
|---|---|---|---|
| VIP ID | chỉ `/tai-khoan/*` khách và `/api/internal/khach/*`. Route nhân viên trả 404 | `/tai-khoan/*` khách trả 404. Host không thuộc hai danh sách trả **421** | VIPID `cowork/config.py:118-129`, `cowork/khach_web.py:31-58`, `cowork/khach.py:197-206` |
| CRM | chỉ `/portal`, `/portal/*`. Mọi đường khác (kể cả `/api/internal/portal/*`) trả 404 | `/portal*` trả 404. `/api/internal/portal/*` **chỉ** nhận ở host này | CRM `server/lib/hostguard.js:4-11,44-56` |

**Hệ quả cho vận hành:** việc chặn theo Host của CRM chỉ bật khi đặt `PORTAL_HOST` (CRM `server/config.js:89-92`). Nếu Caddy chuyển `khachhang…/*` sang CRM khi `PORTAL_HOST` còn rỗng, **toàn bộ giao diện CRM nhân viên sẽ lộ ra Internet** trên host khách. Vì vậy khối Caddy đề xuất **chỉ** chuyển `/portal*` sang CRM (mục 6.2), và khối này chỉ được thêm **sau khi** đã kiểm `PORTAL_HOST`.

### 1.3. Đường gọi server↔server: cần owner quyết định (điểm chặn B3)

**VIP ID → CRM** (`CRM_PORTAL_INTERNAL_URL`, mặc định `http://127.0.0.1:8897`, VIPID `cowork/config.py:133-134`):
- VIP ID chạy trong container, network bridge mặc định (VIPID `deploy/vps/docker-compose.yml:13-14`).
- CRM chỉ publish trên `127.0.0.1:18185` của host (CRM `compose.yml:55`).
- Vì vậy `http://127.0.0.1:18185` **từ trong container VIP ID không tới được CRM** (127.0.0.1 khi đó là chính container).

Các phương án:

| PA | Cách làm | Ưu | Nhược |
|---|---|---|---|
| **N1 (đề xuất)** | Gắn container `cowork-staging` vào network `edge` của CRM (network ngoài, khai báo `external`). Đặt `CRM_PORTAL_INTERNAL_URL=http://<tên dịch vụ/alias app CRM>:5175` | Không đi qua Internet hay Caddy. Host gửi đi không phải host khách nên CRM nhận `/api/internal/portal/*`. Không cần mở `crm.vipgroup.com.vn` | Phải sửa compose VIP ID. Hai dự án chung một network docker. Phải đo tên network thật (`<project>_edge`) |
| N2 | `CRM_PORTAL_INTERNAL_URL=https://crm.vipgroup.com.vn` | Có TLS | Phụ thuộc việc mở công khai CRM (đang NO-GO). Phải chặn `/api/internal/portal/*` theo IP ở khối `crm.*` |

**CRM → VIP ID** (`VIPID_PORTAL_URL`):
- Production **bắt buộc** `https:` (CRM `server/config.js:60-64`).
- CRM luôn gửi `Host: <PORTAL_HOST>` (CRM `server/modules/portal/vipid-client.js:109`).
- VIP ID chỉ phục vụ `/api/internal/khach/*` trên host khách (VIPID `docs/CAU-HINH-TEN-MIEN.md:225`).

Vì vậy đường thực tế duy nhất là `VIPID_PORTAL_URL=https://khachhang.vipgroup.com.vn`: CRM container ra IP công khai, rồi quay vòng (hairpin) vào Caddy trên chính VPS. Khi đó Caddy **không được** chặn toàn bộ `/api/internal/khach/*`, mà chỉ cho phép nguồn của container CRM. Dự kiến nguồn đó là dải `172.31.250.0/24` (network `edge` ghim ở CRM `compose.yml:79`), nhưng **phải đo trên máy**: xem nhật ký Caddy sau một lời gọi thử, mục 8 bước S3. Proxy e2e cục bộ của website (WEB `tests/portal-e2e/proxy.mjs:4,21`) đang chặn hết `/api/internal/*`. Cách đó **không** dùng được cho production theo thiết kế hiện tại.

### 1.4. Những thứ KHÔNG được ra Internet

| Thành phần | Cách bảo đảm |
|---|---|
| `/api/internal/portal/*` (CRM) | Caddy host khách trả 404. CRM hostguard cũng 404 trên host khách. Nếu sau này mở `crm.*` thì thêm chặn theo IP |
| `/api/internal/khach/*` (VIP ID) | Caddy chỉ cho nguồn nội bộ đã đo. Phía sau vẫn có HMAC, chống phát lại và giới hạn 10 KB (VIPID `cowork/khach_web.py:535-581`, `cowork/khach.py:967-994`) |
| Giao diện CRM nhân viên, `/api/*` CRM | Caddy host khách chỉ chuyển `/portal*`. CRM hostguard trả 404 |
| Route nhân viên VIP ID (`/`, `/dang-nhap`, quản trị, `/api/internal/brain…`) | Caddy host khách chỉ chuyển `/tai-khoan*` và `/api/internal/khach/*`. VIP ID tách realm theo Host |
| Cổng 8899 / 18185 / Postgres | Chỉ bind `127.0.0.1`. DB nằm ở network `internal: true` (CRM `compose.yml:80`) |
| Caddy admin API `127.0.0.1:2019` | Rủi ro có sẵn: user `deploy` thuộc nhóm docker (CRM `VIP_CRM_V6_HTTPS_GO_PUBLIC_PLAN.md:108`). Không do P1 tạo ra, nhưng owner cần biết |

---

## 2. Email — điểm chặn A8

### 2.1. Hiện trạng (đã kiểm trong repo)

- VIP ID **chỉ ghi outbox**, không gửi thật:
  - `gui_email` ghi bảng `customer_outbox` (VIPID `cowork/khach.py:472-478`);
  - tập kênh thật `KENH_EMAIL_THAT` đang **rỗng** (VIPID `cowork/khach.py:45-46`);
  - `COWORK_KHACH_MAIL_TRANSPORT` chỉ có giá trị `outbox` (VIPID `cowork/config.py:141-143`).
- Khi `COWORK_ENV=production` và realm khách bật, VIP ID **từ chối khởi động** (VIPID `cowork/khach.py:103-105`, gọi từ `cowork/main.py:26`).
  - **Lưu ý:** lỗi khởi động làm dừng **cả** `cowork.vipgroup.com.vn` của nhân viên, vì cùng một tiến trình. Xem mục 8 bước V2 (kiểm cấu hình trong container tạm).
- Tên miền dùng **Google Workspace**. Bản đo DNS chỉ đọc ngày 30/09/2026 (WEB `docs/DNS_MIGRATION.md:16-19,23`, `docs/PRODUCTION.md:50`):
  - `MX 1 SMTP.GOOGLE.COM`;
  - `TXT v=spf1 include:_spf.google.com ~all`;
  - `google._domainkey` (DKIM RSA 2048);
  - `google-site-verification`;
  - **không có `_dmarc`**.
- DNS có thẩm quyền: `ns1/ns2.vclouddns.vn` (iNET). Owner đã chọn **phương án B: giữ DNS ở iNET**, không chuyển sang Cloudflare (WEB `docs/DNS_MIGRATION.md:6`).
- Chính sách bảo mật của website đã nêu "Google Workspace của công ty" là nơi xử lý dữ liệu (WEB `src/pages/chinh-sach-bao-mat.astro:29`).

### 2.2. Các phương án gửi

| PA | Cấu hình | DNS cần đổi | Ghi chú |
|---|---|---|---|
| **E1 (đề xuất)** Workspace, SMTP AUTH | `smtps://smtp.gmail.com:465` (hoặc `smtp://smtp.gmail.com:587` STARTTLS). Tài khoản riêng `no-reply@vipgroup.com.vn` có bật xác minh 2 bước và **App Password** | Không cần thêm SPF/DKIM (đã có). **Thêm DMARC** | Cùng kiểu mà CRM đã chuẩn bị cho kênh cảnh báo (CRM `deploy/production/backup/backup.env.example:38-39`, `ops/alert-send.sh:7-8`). Cần một license Workspace cho hộp `no-reply` (owner kiểm chi phí) |
| E2 Workspace SMTP relay | Admin console → Gmail → Routing → **SMTP relay service** → `smtp-relay.gmail.com:587`. Bật "Require SMTP Authentication" **và** "Require TLS". Người gửi: "Only addresses in my domains" | Như E1 | **Không** dùng kiểu xác thực "chỉ theo IP 160.22.170.20": VPS dùng chung với khoảng 39 container của dự án khác (CRM `VIP_CRM_V6_HTTPS_GO_PUBLIC_PLAN.md:74`). Theo IP thì tiến trình nào trên VPS cũng gửi được thư mang tên @vipgroup.com.vn |
| E3 Nhà cung cấp giao dịch (Amazon SES, Postmark, Mailgun, Brevo…) | API hoặc SMTP của nhà cung cấp | Sửa **chính** bản ghi SPF hiện có (thêm `include:` của nhà cung cấp, hoặc dùng tên miền con MAIL FROM riêng). Thêm DKIM (CNAME/TXT do nhà cung cấp cấp). Thêm DMARC | Phải cập nhật chính sách bảo mật (bên xử lý mới, có thể chuyển dữ liệu ra nước ngoài). Phải có tài khoản, có chi phí. Lợi thế: báo cáo bounce, hạn mức cao |

Hạn mức gửi của Gmail/relay: owner kiểm theo tài liệu Google hiện hành. P1 dự kiến lưu lượng thấp (kích hoạt và khôi phục), nên không phải yếu tố quyết định.

### 2.3. Bản ghi DNS (ĐỀ XUẤT, làm tại iNET/vCloudDNS)

| Tên | Loại | Giá trị | Ghi chú |
|---|---|---|---|
| `vipgroup.com.vn` | TXT (SPF) | **giữ nguyên** `v=spf1 include:_spf.google.com ~all` | E1/E2: không đổi. E3: **sửa bản ghi này**, không tạo bản ghi SPF thứ hai (hai bản ghi SPF thì SPF lỗi `permerror`) |
| `google._domainkey` | TXT | giữ nguyên | Owner kiểm trong Admin console → Apps → Google Workspace → Gmail → **Authenticate email**: trạng thái phải là "Authenticating email" cho `vipgroup.com.vn` |
| `_dmarc.vipgroup.com.vn` | TXT | `v=DMARC1; p=none; rua=mailto:<hộp nhận báo cáo>; fo=1` | Bản ghi **mới**. Chạy `p=none` 2–4 tuần, đọc báo cáo, rồi nâng lên `p=quarantine`. Hộp nhận báo cáo do owner chọn |

Phải giữ nguyên các bản ghi email đánh dấu **EMAIL CRITICAL** (WEB `docs/DNS_MIGRATION.md:16-19`).

### 2.4. Địa chỉ gửi đề xuất

- `From: VIP GROUP <no-reply@vipgroup.com.vn>`.
- `Reply-To`: tuỳ chọn, `viporder@vipgroup.com.vn` (email công khai, WEB `src/data/vi/contact.ts:19`). Chân thư hiện ghi "Email tự động, vui lòng không trả lời" (VIPID `cowork/khach.py:486-487`). Nếu đặt Reply-To thì nên sửa câu này cho nhất quán.

### 2.5. Thay đổi code còn thiếu ở VIP ID (ước tính)

Tên biến dưới đây là **ĐỀ XUẤT**, hiện **chưa có** trong code. Đội VIP ID chốt tên cuối cùng.

| # | Việc | Ước tính |
|---|---|---|
| M1 | Kênh `smtp`, cấu hình: `COWORK_KHACH_MAIL_TRANSPORT=smtp`, `COWORK_KHACH_SMTP_URL`, `COWORK_KHACH_SMTP_USER`, `COWORK_KHACH_SMTP_PASS_FILE` (tệp 0600, không đọc từ env), `COWORK_KHACH_MAIL_FROM`. TLS bắt buộc, kiểm chứng chỉ, có timeout | 0,5 ngày |
| M2 | Bộ gửi **tách khỏi request**: cron `docker exec cowork-staging python -m cowork.cli …` hoặc luồng nền đọc `customer_outbox WHERE sent_at IS NULL`. Gửi đồng bộ trong request sẽ làm lộ tài khoản qua thời gian phản hồi: đăng ký trùng có gửi thư, đăng ký mới cũng gửi, nhưng nhánh "im lặng" thì không (VIPID `cowork/khach.py:557-659`) | 0,5–1 ngày |
| M3 | Thêm cột thử lại (`attempts`, `last_error`, `next_at`) bằng migration chỉ thêm, có backoff. Sau khi gửi xong thì **xoá link token trong `body_text`**: bảng đang lưu nguyên link một lần, và link đó lọt vào bản backup | 0,5 ngày |
| M4 | Chỉ thêm `smtp` vào `KENH_EMAIL_THAT` khi đủ cấu hình. Không ghi nội dung thư hay mật khẩu vào log. Thêm test với máy chủ SMTP giả | 0,5 ngày |
| M5 | Kiểm thử thật trên staging: thư tới Gmail và một hộp ngoài Google; xem "Show original": SPF/DKIM/DMARC đều PASS; link hết hạn sau 30 phút (VIPID `cowork/config.py:145`) | 0,5 ngày |

**Tổng: khoảng 2–3 ngày công**, cộng một vòng rà soát bảo mật. A8 chỉ coi là xong khi M5 có bằng chứng (HĐ `KIEN_TRUC_P1.md:16`).

---

## 3. Cloudflare Turnstile (thử thách đăng nhập)

VIP ID bắt buộc có Turnstile ở production khi bật realm khách, và từ chối khoá thử nghiệm của Cloudflare (VIPID `cowork/khach.py:116-121,245-247`).

### 3.1. Tạo widget riêng (owner làm trên dashboard Cloudflare)

| Trường | Giá trị |
|---|---|
| Tên widget | `VIP GROUP — Cổng khách hàng (đăng nhập)` |
| Hostname | `khachhang.vipgroup.com.vn` (chỉ host này). VIP ID kiểm `hostname` trong kết quả siteverify phải trùng host khách đang phục vụ (VIPID `cowork/khach.py:251-259`) |
| Widget mode | **Managed** |
| Pre-clearance | Không |
| Action | `khach_login`. Template gửi `data-action` (VIPID `cowork/templates/khach/dang_nhap.html:26`), server kiểm `action == "khach_login"` (VIPID `cowork/khach.py:248,255`). Action do client gửi, không cấu hình trên dashboard |

- **Không dùng lại** widget của form lead website (`0x4AAAAAAF2QZNcXX6-6puJf`, WEB `src/data/vi/contact.ts:15`). Hostname và secret khác nhau, nên lộ một bên thì bên kia vẫn an toàn.
- Turnstile không cần zone DNS ở Cloudflare, nên chạy được dù DNS ở iNET.
- Staging (`khachhang-staging…`) dùng widget riêng, hoặc khoá thử nghiệm của Cloudflare (VIPID `deploy/vps/README.md:104-106`).

### 3.2. Biến môi trường (đúng tên VIP ID đọc)

| Biến | Giá trị | Nguồn |
|---|---|---|
| `COWORK_KHACH_TURNSTILE_SITE_KEY` | site key (công khai), đặt trong `.env` của VIP ID | VIPID `cowork/config.py:169` |
| `COWORK_KHACH_TURNSTILE_SECRET_FILE` | `/data/turnstile_secret.key` (mặc định `DATA_DIR/turnstile_secret.key`) | VIPID `cowork/config.py:170-171` |
| `COWORK_KHACH_TURNSTILE_SECRET` | **không dùng** ở production. Code có nhận biến này (VIPID `cowork/khach.py:229-237`), nhưng tệp 0600 an toàn hơn: không lộ qua `docker inspect`, không lộ qua env của tiến trình | — |

- Secret **không** tự sinh: thiếu thì tắt thử thách, và production từ chối khởi động (VIPID `cowork/config.py:166-168`).
- Container cần ra được `https://challenges.cloudflare.com` (VIPID `cowork/config.py:172`).

### 3.3. Ghi secret (người vận hành chạy trên VPS, không dán vào chat hay ticket)

```bash
# Dán secret khi được hỏi (không hiện lên màn hình, không vào history)
read -rs TS && printf '%s' "$TS" | docker run --rm -i \
  -v /srv/vip-staging/cowork/deploy/vps/data:/data alpine:3.20 \
  sh -c 'umask 077; cat > /data/turnstile_secret.key && chown 10001:10001 /data/turnstile_secret.key && chmod 600 /data/turnstile_secret.key'
unset TS
```

uid 10001 là user `cowork` trong image (VIPID `deploy/vps/Dockerfile:9`). Cách chown qua container tạm lấy theo VIPID `deploy/vps/README.md:20-21`.

---

## 4. Danh mục bí mật

### 4.1. Bảng

| Bí mật | Ở đâu (VIP ID) | Ở đâu (CRM) | Sinh bằng | Ràng buộc |
|---|---|---|---|---|
| `VIPID_PORTAL_SECRET` | tệp `/data/portal_secret.key` trong container (host: `/srv/vip-staging/cowork/deploy/vps/data/portal_secret.key`), qua `VIPID_PORTAL_SECRET_FILE` (VIPID `cowork/config.py:140`, `cowork/khach.py:73-78`) | `~/vipcrm6-prod/secrets/vipid_portal_secret` (docker secret → `/run/secrets/vipid_portal_secret`) (CRM `compose.yml:45,54,89`, runbook `:162-164`) | `openssl rand -hex 32` (64 ký tự = 64 byte ASCII) | **Cùng một giá trị** hai bên. ≥ 32 byte. **Khác** `VIPID_SHARED_SECRET`, `COWORK_SHARED_SECRET`, `LEAD_INTAKE_SECRET`, và khác các khoá VIP ID `secret.key`, `brain_secret.key`, `hatang_secret.key`. Hai bên đều kiểm khi khởi động (VIPID `cowork/khach.py:136-143`; CRM `server/config.js:47-58`, `server/modules/portal/vipid-client.js:28-32`) |
| Turnstile secret | `/data/turnstile_secret.key` (mục 3.3) | — | Cloudflare cấp | Không dùng khoá thử nghiệm |
| Mật khẩu SMTP (App Password) | ĐỀ XUẤT `/data/smtp_pass` 0600 (mục 2.5 M1) | (CRM cảnh báo dùng `~/vipcrm6-prod/secrets/smtp_pass` riêng, runbook `:143-144`) | Google cấp App Password | Mỗi hệ thống một App Password riêng để thu hồi riêng được |
| Mật khẩu role DB cổng | — | **Hiện không có.** `crm_portal` là role `NOLOGIN`, app chuyển sang bằng `SET LOCAL ROLE` (CRM `deploy/production/backup/db-roles.sql:46-55`) | — | Lớp gia cố tuỳ chọn: role LOGIN riêng (đề xuất tên `vipcrm6_portal`) và `PORTAL_DATABASE_URL`. **Chưa làm ở production** (CRM `VIP_CRM_V6_CUSTOMER_PORTAL_P1.md:186`). Nếu owner chọn làm: thêm tệp `~/vipcrm6-prod/secrets/db_portal_password`, sinh bằng `openssl rand -base64 33`. Mật khẩu này nằm trong URL ở `app.env` (0600) |

**Cảnh báo quan trọng ở VIP ID:** khi thiếu tệp, hàm `_secret()` **tự sinh khoá mới** (VIPID `cowork/config.py:76-98`). Nếu khởi động khi chưa đặt tệp `portal_secret.key`, VIP ID sẽ chạy với khoá **khác** CRM: không mất an toàn, nhưng mọi HMAC đều sai. Vì vậy phải đặt tệp **trước** khi bật `COWORK_KHACH_ENABLED=1`, rồi so khớp như lệnh bên dưới.

### 4.2. Sinh và phân phối `VIPID_PORTAL_SECRET` (cả hai bên trên **cùng VPS**, bí mật không rời máy)

```bash
# 1) Sinh tại CRM (lệnh trích nguyên runbook CRM :164)
( umask 077; openssl rand -hex 32 > ~/vipcrm6-prod/secrets/vipid_portal_secret )
id -u deploy          # phải = 1000 (uid 'node' của CRM, runbook :165)

# 2) Chép sang VIP ID, chủ sở hữu 10001, 0600
docker run --rm -i -v /srv/vip-staging/cowork/deploy/vps/data:/data alpine:3.20 \
  sh -c 'umask 077; cat > /data/portal_secret.key && chown 10001:10001 /data/portal_secret.key && chmod 600 /data/portal_secret.key' \
  < ~/vipcrm6-prod/secrets/vipid_portal_secret

# 3) So khớp mà không in giá trị
docker run --rm -v /srv/vip-staging/cowork/deploy/vps/data:/data:ro \
  -v ~/vipcrm6-prod/secrets/vipid_portal_secret:/crm.key:ro alpine:3.20 \
  sh -c 'cmp -s /data/portal_secret.key /crm.key && echo GIONG || echo KHAC'
```

VIP ID `strip()` khoảng trắng, CRM bỏ ký tự xuống dòng cuối (VIPID `cowork/config.py:83`; CRM `server/config.js:25-31`). Vì vậy dấu xuống dòng cuối tệp không làm hai bên lệch nhau.

### 4.3. Xoay vòng

| Bí mật | Quy trình | Ảnh hưởng |
|---|---|---|
| `VIPID_PORTAL_SECRET` | Hai bên **không** hỗ trợ hai khoá cùng lúc, nên phải đổi đồng thời. Các bước: (1) sinh khoá mới vào tệp tạm; (2) thay **cả hai** tệp (mục 4.2); (3) `RELEASE=<current> docker compose -p vipcrm6-prod -f ~/vipcrm6-prod/app/deploy/production/compose.yml up -d --no-deps app`; (4) `docker compose -f deploy/vps/docker-compose.yml up -d` tại `/srv/vip-staging/cowork`. Phải khởi động lại vì VIP ID giữ khoá trong bộ nhớ (`_bi_mat_cache`, VIPID `cowork/khach.py:69-78`); (5) `docker exec cowork-staging python -m cowork.cli khach-dong-bo --tat-ca` (VIPID `cowork/cli.py:8,209-215`) | CRM gián đoạn 10–40 s. VIP ID gián đoạn vài giây, **kể cả nhân viên**. Launch token đang bay (≤ 60 s) bị từ chối, khách đăng nhập lại. Hàng đợi hai bên (`crm_sync_pending`, `portal_outbox`) tự gửi lại, không mất sự kiện |
| Turnstile | Dashboard Cloudflare → widget → xoay secret. Ghi tệp mới (mục 3.3), khởi động lại VIP ID. Owner kiểm trên dashboard xem secret cũ còn hiệu lực bao lâu | Vài giây |
| SMTP | Tạo App Password mới, thay tệp, khởi động lại hoặc chờ lượt gửi kế tiếp, rồi **thu hồi** App Password cũ | Thư chờ trong outbox, gửi sau |
| Khi nghi lộ | Tắt cờ hai bên **trước** (mục 9), rồi mới xoay. Ghi bằng chứng | — |

---

## 5. Ma trận cấu hình production

### 5.1. VIP ID — `/srv/vip-staging/cowork/deploy/vps/.env.staging`

Tên tệp là **`.env.staging` dù đây là production**: compose dùng tệp này (VIPID `deploy/vps/docker-compose.yml:11-12`). CRM đã ghi nhận đây là rủi ro nhầm môi trường (CRM `VIP_CRM_V6_CUSTOMER_PORTAL_P1.md:115`, V6). Nội dung tệp thật trên VPS **không có trong repo**: owner kiểm lại từng dòng.

| Biến | Giá trị production | Bắt buộc? | Nguồn |
|---|---|---|---|
| `COWORK_ENV` | `production` | Có (bật các kiểm tra production) | `config.py:70`, `khach.py:88-92` |
| `COWORK_HOST` / `COWORK_PORT` | `0.0.0.0` / `8899` (trong container) | Giữ | `.env.staging.example` |
| `COWORK_DATA_DIR` | `/data` | Giữ | `.env.staging.example`, `config.py:34` |
| `COWORK_PUBLIC_URL` | `https://cowork.vipgroup.com.vn` | Giữ | `docs/TRIEN-KHAI-PRODUCTION.md:75` |
| `COWORK_COOKIE_SECURE` | `1` | **Có**, thiếu thì từ chối khởi động | `config.py:52`, `khach.py:114-115` |
| `COWORK_TIN_PROXY` | `1` | **Có**, thiếu thì từ chối khởi động | `config.py:73`, `khach.py:111-113` |
| `COWORK_KHACH_ENABLED` | `1`, **bật sau cùng** (mục 8 bước V4) | — | `config.py:118` |
| `COWORK_KHACH_HOSTS` | `khachhang.vipgroup.com.vn` | Có | `config.py:123-124` |
| `COWORK_STAFF_HOSTS` | `cowork.vipgroup.com.vn,127.0.0.1:8899` | **Có**, thiếu thì từ chối khởi động. **Phải có `127.0.0.1:8899`**: healthcheck docker gọi `http://127.0.0.1:8899/api/health` (VIPID `docker-compose.yml:23`, `deploy.sh:12`), nếu thiếu sẽ nhận 421 và container báo unhealthy | `config.py:128-129`, `khach.py:122-125` |
| `COWORK_KHACH_PUBLIC_URL` | `https://khachhang.vipgroup.com.vn` | Có (https) | `config.py:131-132`, `khach.py:144-148` |
| `CRM_PORTAL_PUBLIC_URL` | `https://khachhang.vipgroup.com.vn`. Launch đi tới `…/portal/auth/launch` (`khach.py:948-949`) và origin này được thêm vào CSP `form-action` (`khach_web.py:80-90`) | Có (https) | `config.py:135-136` |
| `CRM_PORTAL_INTERNAL_URL` | theo quyết định N1/N2 (mục 1.3) | Có | `config.py:133-134` |
| `CRM_PORTAL_TIMEOUT` | `3` (mặc định) | — | `config.py:137` |
| `VIPID_PORTAL_SECRET_FILE` | `/data/portal_secret.key` (ghi tường minh) | Có | `config.py:140` |
| `COWORK_KHACH_MAIL_TRANSPORT` | `smtp`, **giá trị này chưa tồn tại** (mục 2.5) | Có | `config.py:143` |
| `COWORK_KHACH_TURNSTILE_SITE_KEY` | site key thật | Có | `config.py:169` |
| `COWORK_KHACH_TURNSTILE_SECRET_FILE` | `/data/turnstile_secret.key` | Có | `config.py:170-171` |
| Tham số tinh chỉnh (giữ mặc định): `COWORK_KHACH_TOKEN_TTL_MIN=30`, `_LAUNCH_TTL=60` (trần 60), `_SESSION_HOURS=12`, `_IDLE_MINUTES=120`, `_LOGIN_MAX_FAIL=5`, `_LOGIN_IP_MAX_FAIL=20`, `_LOGIN_WINDOW_MIN=15`, `_LOCK_MIN=15`, `_SIGNUP_IP_PER_HOUR=5`, `_FORGOT_IP_PER_HOUR=10`, `_UNVERIFIED_TTL_HOURS=48`, `_SCRYPT_LOG2_N=17`, `_SCRYPT_DONG_THOI=2`, `_THIET_BI_NGAY=180`, `_RESET_ACC_IP_PER_HOUR=3` | — | — | `config.py:144-164` |

Hai điểm owner cần biết:
- **CGNAT di động:** `COWORK_KHACH_SIGNUP_IP_PER_HOUR=5` tính theo IP (IPv6 gộp theo /64, `khach.py:213-222`). Ở Việt Nam, nhiều thuê bao 4G chung một IP, nên khách thật có thể bị chặn đăng ký khi cao điểm. Theo dõi sự kiện `khach.dang_ky.qua_tan_suat` tuần đầu rồi mới chỉnh (mục 10).
- **RAM:** scrypt N=2¹⁷ dùng 128 MiB mỗi lượt, tối đa 2 lượt đồng thời, tức khoảng 256 MiB đỉnh (`config.py:158-161`). Container VIP ID **không** đặt giới hạn bộ nhớ (`docker-compose.yml`). Cần kiểm RAM trống của VPS: CRM dùng ngưỡng watchdog 1,2 GB (CRM runbook `:21`).

### 5.2. CRM — `~/vipcrm6-prod/secrets/app.env` và compose

| Biến | Nơi | Giá trị production | Nguồn |
|---|---|---|---|
| `APP_ENV` | compose (cố định) | `production` | CRM `compose.yml:47` |
| `COOKIE_SECURE` | compose | `1` | `compose.yml:49` |
| `TRUST_PROXY` | compose | `172.31.250.1` (gateway network edge, nơi Caddy đi qua docker-proxy) | `compose.yml:50,79` |
| `VIPID_PORTAL_SECRET_FILE` | compose | `/run/secrets/vipid_portal_secret` | `compose.yml:54` |
| `PORTAL_ENABLED` | app.env | `1` (production mặc định **tắt**) | `server/config.js:104-107`, runbook `:158` |
| `PORTAL_HOST` | app.env | `khachhang.vipgroup.com.vn` (không kèm cổng) | `server/config.js:89-92`, runbook `:159` |
| `PORTAL_PUBLIC_URL` | app.env | `https://khachhang.vipgroup.com.vn` | runbook `:160` |
| `VIPID_PORTAL_URL` | app.env | `https://khachhang.vipgroup.com.vn` (client tự nối thêm `/api/internal/khach/…`, `vipid-client.js:11-15,99-110`) | `server/config.js:60-64,94` |
| `PORTAL_SIG_V2_REQUIRED` | app.env | `1`, **chỉ sau khi** sửa B2 (mục 5.3) | `server/config.js:95-96`, `internal.js:11-14` |
| `PORTAL_DATABASE_URL` | app.env | rỗng (hoặc role LOGIN riêng nếu owner chọn, mục 4.1) | `server/config.js:97-98` |
| `PORTAL_TENANT_CODE` | app.env | `VIP` (mặc định) | `server/modules/portal/review.js:30` |
| `PORTAL_LAUNCH_RATE_PER_IP` | app.env | `30` (mặc định) | `launch.js:24-26,116` |
| `PORTAL_INTERNAL_RATE_PER_IP` | app.env | `120` (mặc định) | `internal.js:125` |

`PORTAL_*` cố ý **không** đặt trong `environment:` của compose (CRM runbook `:166`).

### 5.3. Điểm chặn B2 — header ký HMAC lệch nhau

| Chiều | Bên gửi ký | Bên nhận kiểm | Kết quả |
|---|---|---|---|
| VIP ID → CRM | `X-Portal-Sig = HMAC("vipid->crm.POST.<path>.<ts>." + body)`, **không** có `X-Portal-Sig-V2` (VIPID `khach.py:953-964,1017-1024`) | Không có V2 nên CRM kiểm kiểu v1.1: `X-Portal-Sig = HMAC("vipid->crm.<ts>.<body>")` (CRM `internal.js:27-29,46-50,69-77`) | **401 SIGNATURE_INVALID** |
| CRM → VIP ID | `X-Portal-Sig` = v1.1 (không có method/path), `X-Portal-Sig-V2` = có method/path (CRM `vipid-client.js:43-57,104-108`) | VIP ID chỉ đọc `X-Portal-Sig` và kiểm có method/path (VIPID `khach_web.py:559-561`, `khach.py:967-981`) | **401 CHU_KY_SAI** và audit `khach.hmac.sai` |

Nguyên nhân:
- HĐ §11.8 đổi chuỗi ký nhưng không nêu tên header.
- VIP ID đặt chuỗi mới vào `X-Portal-Sig` và kiểm thử với CRM **giả** (commit `5bd7249` "CRM giả theo chuỗi ký mới").
- CRM giữ `X-Portal-Sig` cho v1.1 và thêm header V2 riêng (CRM commit `80cd161`).

**Sửa đề xuất (đội VIP ID, khoảng 0,5 ngày + E2E chung):**
1. Gửi `X-Portal-Sig-V2`, có thể kèm `X-Portal-Sig` v1.1 trong giai đoạn chuyển.
2. Kiểm `X-Portal-Sig-V2` trên `/api/internal/khach/*`.
3. Sau đó CRM bật `PORTAL_SIG_V2_REQUIRED=1`.
4. Ghi tên header vào HĐ (v1.2).

Chưa có E2E nào chạy giữa VIP ID thật và CRM thật.

---

## 6. DNS và Caddy

### 6.1. DNS (ĐỀ XUẤT – chưa áp dụng; owner làm tại iNET OnePortal)

| Tên | Loại | Giá trị | TTL | Ghi chú |
|---|---|---|---|---|
| `khachhang-staging` | A | `160.22.170.20` | 300 | Tạo trước, cho staging |
| `khachhang` | A | `160.22.170.20` | 300 | Tạo khi qua cổng go/no-go G5 (mục 8) |

- Cùng IP với `cowork` và `ai` (VIPID `docs/CAU-HINH-TEN-MIEN.md:12-13`) và `crm` (CRM `VIP_CRM_V6_HTTPS_GO_PUBLIC_PLAN.md:10`).
- Không có AAAA. Không có CNAME. Tắt OneShield/proxy, giống bản ghi `www` (WEB `docs/DNS_MIGRATION.md:6`).
- Zone không có CAA (WEB `docs/DNS_MIGRATION.md:23`), nên Let's Encrypt HTTP-01 qua cổng 80 cấp được chứng chỉ (VIPID `docs/CAU-HINH-TEN-MIEN.md:19`).
- **Không** sửa 14 bản ghi A sẵn có và các bản ghi email.
- Kiểm tra: `dig +short A khachhang.vipgroup.com.vn @ns1.vclouddns.vn`, `@8.8.8.8`, `@1.1.1.1`. Cả ba phải trả `160.22.170.20`.

### 6.2. Khối Caddy (ĐỀ XUẤT – chưa áp dụng)

```caddy
# ===== ĐỀ XUẤT – CHƯA ÁP DỤNG · Cổng khách hàng VIP GROUP P1 =====
# Đích: /srv/vip-staging-proxy/Caddyfile (root giữ). Chỉ THÊM khối này, không sửa khối khác.
# Matcher loại trừ nhau ⇒ thứ tự các handle không quan trọng.
khachhang.vipgroup.com.vn {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		X-Robots-Tag "noindex, nofollow"
		# '?' = chỉ đặt khi upstream KHÔNG gửi. KHÔNG ghi đè CSP của VIP ID/CRM
		# (trang Turnstile cần CSP riêng — VIPID docs/CAU-HINH-TEN-MIEN.md:227-228).
		?Content-Security-Policy "default-src 'none'; frame-ancestors 'none'"
		?X-Frame-Options "DENY"
		?Referrer-Policy "same-origin"
		-Server
	}

	# (1) CRM → VIP ID (server↔server). Chỉ nguồn nội bộ ĐÃ ĐO (mục 1.3, bước S3).
	@vipid_noi_bo path /api/internal/khach/*
	handle @vipid_noi_bo {
		@ngoai not remote_ip <NGUON_CRM_DA_DO>   # dự kiến 172.31.250.0/24 — PHẢI đo
		respond @ngoai "Not Found" 404
		request_body {
			max_size 10KB
		}
		reverse_proxy 127.0.0.1:8899 {
			header_up X-Real-IP {remote_host}
		}
	}

	# (2) Mọi /api/internal khác (kể cả /api/internal/portal/* của CRM): không bao giờ qua host khách.
	@noi_bo_khac {
		path /api/internal /api/internal/*
		not path /api/internal/khach/*
	}
	handle @noi_bo_khac {
		respond "Not Found" 404
	}

	# (3) VIP ID realm khách
	@vipid path /tai-khoan /tai-khoan/*
	handle @vipid {
		request_body {
			max_size 64KB
		}
		reverse_proxy 127.0.0.1:8899 {
			header_up X-Real-IP {remote_host}
		}
	}

	# (4) CRM portal — CHỈ /portal* (không bao giờ /* ⇒ không lộ CRM nhân viên nếu PORTAL_HOST sai)
	@crm path /portal /portal/*
	handle @crm {
		request_body {
			max_size 64KB
		}
		reverse_proxy 127.0.0.1:18185 {
			header_up X-Real-IP {remote_host}
		}
	}

	# (5) Trang gốc
	@goc path /
	handle @goc {
		redir /tai-khoan/dang-nhap 302
	}

	# (6) Còn lại
	handle {
		respond "Not Found" 404
	}

	log {
		output file /data/access-khachhang.log {
			roll_size 10mb
			roll_keep 5
		}
		# Xoá token khỏi URI trong log: ?t= (link email, 30 phút) và ?token= (launch, 60 s).
		# Cú pháp phải 'caddy validate' trên 2.11.4; nếu không nhận, bọc trong 'fields { … }'.
		format filter {
			wrap json
			request>uri query {
				delete t
				delete token
			}
		}
	}
}
```

Giải thích từng điểm:
- **Giữ Host gốc:** `reverse_proxy` của Caddy mặc định chuyển nguyên `Host`, và đặt `X-Forwarded-Host`, `X-Forwarded-For`, `X-Forwarded-Proto`. Khi không khai báo `trusted_proxies`, Caddy bỏ giá trị `X-Forwarded-*` mà client gửi lên. HĐ §11.9 (`KIEN_TRUC_P1.md:176`) và CRM hostguard (`hostguard.js:13-14`) đều cần Host gốc.
- **Ghi đè `X-Real-IP`:** VIP ID với `COWORK_TIN_PROXY=1` ưu tiên `X-Real-IP` (VIPID `cowork/audit.py:15-17`). Uvicorn chạy `--no-proxy-headers` (VIPID `Dockerfile:25-27`). Lưu ý: VIP ID tin `X-Real-IP` từ **mọi** nguồn tới `127.0.0.1:8899`. Mọi tiến trình cục bộ trên VPS đều giả được IP. Rủi ro này chấp nhận được vì cổng chỉ bind loopback, nhưng owner cần biết.
- **`X-Forwarded-Proto`:** Caddy đặt `https`. VIP ID dùng giá trị này để bật HSTS và kiểm https (VIPID `cowork/auth.py:15-18`, `khach_web.py:92-93`).
- **HSTS:** không dùng `preload`. Có `-Server` nên Caddy hoãn toàn khối header tới lúc ghi phản hồi, và giá trị HSTS của Caddy thay giá trị của upstream.
- **Giới hạn body:** VIP ID đã tự chặn ở 10 KB cho `/api/internal/khach/*` (`khach_web.py:535-551`). CRM chặn ở 16 KB (`internal.js:22`). Form đăng ký/đăng nhập nhỏ, 64 KB là đủ rộng. Đội CRM xác nhận lại nếu `/portal/api/*` có POST lớn hơn.
- **Không** thêm `header_down Set-Cookie "…; Secure"` như khối cowork: cả hai app đã đặt `Secure` khi `COOKIE_SECURE=1`.
- **Log:** Caddy mặc định đã che `Cookie`, `Set-Cookie`, `Authorization` trong log. Bộ lọc `query` ở trên xoá thêm token trong URL.
  - Rủi ro token trong access log đã được ghi nhận với Brain (VIPID `docs/TRIEN-KHAI-PRODUCTION.md:249-254`).
  - Log app CRM (json-file) có thể vẫn ghi URL launch: đội CRM kiểm.

### 6.3. Áp dụng (người có quyền root; theo mẫu đã diễn tập của CRM)

1. Dùng kiểu script `apply-caddy-prod-root.sh`: backup → **thêm** khối → `validate` → `reload` graceful → chờ HTTPS → so mã HTTP các site khác → lỗi thì tự khôi phục (CRM `deploy/production/apply-caddy-prod-root.sh:2-8,63-89`). Đội CRM hoặc DevOps có thể nhân bản script này cho `DOMAIN=khachhang.vipgroup.com.vn` (khoảng 0,5 ngày, cần diễn tập sandbox như CRM `VIP_CRM_V6_HTTPS_GO_PUBLIC_PLAN.md:79-93`).
2. **Không bao giờ** `docker restart vip-staging-caddy`: container này phục vụ 13 site khác (CRM `VIP_CRM_V6_HTTPS_GO_PUBLIC_PLAN.md:105`).
   - Ghi đè tệp tại chỗ bằng `cp -p` để giữ inode, rồi `reload`.
   - Không dùng `sed -i`: lệnh này đổi inode, khi đó bind mount read-only không thấy nội dung mới và buộc phải restart (VIPID `docs/CAU-HINH-TEN-MIEN.md:175-191,207`).
3. Kiểm cú pháp trước bằng container tạm `--network none`, như CRM đã làm (CRM `VIP_CRM_V6_HTTPS_GO_PUBLIC_PLAN.md:12`).

---

## 7. Bật trên website (sau cùng, chỉ khi cổng đã chạy ổn)

Giá trị cần đặt trong `src/data/vi/contact.ts`. Hiện tại là `portal: null` (WEB `src/data/vi/contact.ts:28-30`). Kiểu dữ liệu: WEB `src/data/types.ts:96`.

```ts
portal: {
  loginUrl: 'https://khachhang.vipgroup.com.vn/tai-khoan/dang-nhap',
  registerUrl: 'https://khachhang.vipgroup.com.vn/tai-khoan/dang-ky',
},
```

Quy trình:
1. Chỉ mở PR khi mục 8 đã PASS tới **G6**, có ít nhất 72 giờ chạy ổn, và owner duyệt bằng văn bản.
2. Nhánh `feature/vipg-web-0xx-portal-on`. PR phải sửa **cả** test đang khoá giá trị `null` (WEB `tests/content.test.mjs:100-106`): đổi sang kiểm đúng 2 URL `https://khachhang.vipgroup.com.vn/tai-khoan/…`, và chỉ trang tra cứu hiện khối `data-portal` (WEB `src/pages/logistics/tra-cuu-van-don.astro:11,25-30`).
3. Kiểm trên preview/staging: nút hiện, link đúng, sự kiện `portal_login_click` / `portal_register_click` được ghi.
4. Merge vào `main`, rồi chạy workflow "Production (Cloudflare Pages) — chạy tay từ main" với SHA đã duyệt (WEB `docs/PRODUCTION.md:41`).
5. Rollback: Cloudflare Pages → Deployments → bản production trước → **Rollback** (có hiệu lực ngay, WEB `docs/PRODUCTION.md:83`). Hoặc revert PR.

---

## 8. Thứ tự triển khai (runbook đề xuất)

Mỗi cổng **G** là một điểm go/no-go. Owner ký mới đi tiếp. Thời gian là ước tính.

### Giai đoạn 0 — Điều kiện trước (không đụng production)

| # | Việc | Ai | Xong khi |
|---|---|---|---|
| P0.1 | Owner chốt các quyết định ở mục 11.2 (định danh đăng nhập, email, N1/N2, OTP, smoke test) | Owner | Có văn bản |
| P0.2 | VIP ID: kênh SMTP (mục 2.5) và sửa header HMAC (mục 5.3). Merge `feature/khach-p1` vào `main` của repo VIP ID (VPS `git pull --ff-only` từ `main`, VIPID `deploy/vps/deploy.sh:6`; repo GitHub đang **public**, VIPID `deploy/vps/README.md:39`) | Đội VIP ID | Test xanh, rà soát bảo mật |
| P0.3 | CRM: release chứa cổng khách (production đang `55d6ae3`, bản này bỏ qua `PORTAL_*`, CRM runbook `:154,205`). Diễn tập `update-prod.sh` với `REHEARSAL=1` (runbook `:51-52`) | Đội CRM | rc 0 khi diễn tập |
| P0.4 | CRM đủ điều kiện mở công khai: P6 admin thứ hai, P7 bản sửa khoá, P8 kênh cảnh báo thật (CRM `VIP_CRM_V6_HTTPS_GO_PUBLIC_PLAN.md:15-17`) | Owner + CRM | PASS |
| P0.5 | Widget Turnstile (mục 3), tài khoản email (mục 2), DMARC `p=none` | Owner | Có site key; thư thử tới nơi |

**G0:** P0.1–P0.5 xong.

### Giai đoạn 1 — Staging `khachhang-staging.vipgroup.com.vn` (dữ liệu tổng hợp)

| # | Việc | Thời gian |
|---|---|---|
| S1 | DNS A `khachhang-staging`. Khối Caddy giống mục 6.2 nhưng trỏ tới instance staging | 30 phút |
| S2 | CRM staging: `STAGING_PORTAL=1 CONFIRM_SYNTHETIC_DATA=1` (CRM runbook `:175-182`). VIP ID staging với `.env` staging (VIPID `deploy/vps/README.md:90-106`), dùng khoá riêng của staging | 1 giờ |
| S3 | **Đo nguồn hairpin:** CRM staging gửi một sự kiện thật vào outbox. Đọc nhật ký Caddy, lấy `remote_ip` của `/api/internal/khach/*`, điền vào `<NGUON_CRM_DA_DO>`. Kiểm từ Internet: `curl -X POST https://khachhang-staging…/api/internal/khach/thu-hoi` phải trả **404** | 30 phút |
| S4 | E2E đủ ca (a)–(g) theo CRM runbook `:192-197`: đăng ký → email thật tới hộp `@example.test`? **Không được**, vì `example.test` không nhận thư. Phải dùng hộp thử thật của công ty (owner chỉ định) → xác minh → duyệt → đăng nhập SĐT/VG → launch → xem kiện → khoá → thu hồi → quên mật khẩu | 0,5–1 ngày |
| S5 | Diễn tập rollback trên staging: tắt từng cờ, gỡ khối Caddy, `portal-down.sql` trên DB staging (CRM `VIP_CRM_V6_CUSTOMER_PORTAL_P1.md:68`) | 1 giờ |

**G1:** S1–S5 PASS, có bằng chứng trong `docs/evidence/portal-staging/…` (CRM) và `evidence/` (VIP ID).

### Giai đoạn 2 — Production (khung bảo trì báo trước; khoảng 2–3 giờ)

| # | Bước | Lệnh hoặc nội dung chính | Kiểm | Dừng nếu |
|---|---|---|---|---|
| B1 | Chụp trạng thái mọi container (trước) | `ssh viporder-staging 'bash -s' < docs/evidence/staging/snapshot.sh > before.txt` (CRM runbook `:19`) | Ghi baseline | Đã có bất thường |
| B2 | **Backup VIP ID** | `/srv/vip-staging/cowork/deploy/vps/backup.sh` → in `BACKUP_OK … users … audit …` (VIPID `deploy/vps/backup.sh:9-19`). Thêm bản sao `.env.staging` và `data/*.key` (0600, **không** rời VPS) | `integrity_check = ok` | Lỗi |
| B3 | **Backup CRM**: tự động trong `update-prod.sh` (pre-migrate bắt buộc, CRM runbook `:42-46`) | — | rc ≠ 4 | rc 4 |
| **G2** | Owner xác nhận backup đọc được | | | |
| C1 | Cập nhật CRM release cổng khách, `PORTAL_ENABLED=0` | `CONFIRM_HOST=viporder-staging CONFIRM_UPDATE=I_APPROVE_UPDATE_<rel> CONFIRM_STAGING_PASSED=<rel> STOP_APP_FOR_MIGRATION=1 deploy/production/update-prod.sh viporder-staging <rel>` (runbook `:37-39`). Chạy `db-roles.sql` (tạo `crm_portal`) rồi migration 660–702 (chỉ thêm) | rc 0, healthy | rc ≠ 0, theo bảng mã thoát (runbook `:57-69`) |
| C2 | Sinh và phân phối `VIPID_PORTAL_SECRET` (mục 4.2). Đặt `PORTAL_HOST`, `PORTAL_PUBLIC_URL`, `VIPID_PORTAL_URL`; `PORTAL_ENABLED=1`; tạo lại app | `up -d --no-deps app` | App khởi động (nghĩa là `portalStartupErrors` rỗng). Từ VPS: `curl -s -o /dev/null -w '%{http_code}' -H 'Host: khachhang.vipgroup.com.vn' http://127.0.0.1:18185/api/me` → **404** (hostguard) | App không lên ⇒ `PORTAL_ENABLED=0` |
| V1 | Cập nhật VIP ID lên `main` mới, realm **vẫn tắt**. Đặt **trước** `COWORK_STAFF_HOSTS=cowork.vipgroup.com.vn,127.0.0.1:8899` | `./deploy/vps/deploy.sh` (VIPID `deploy/vps/deploy.sh:5-18`). Schema VIP ID tự nâng lên v4 khi khởi động, chỉ thêm (`cowork/db.py:51-64,80-85`, `schema.py:4`) | Health 200; nhân viên đăng nhập cowork 200; SSO Brain 200; host lạ (`curl -H 'Host: x' http://127.0.0.1:8899/api/health`) → 421 | Nhân viên lỗi ⇒ quay mã cũ |
| V2 | Đặt tệp secret (mục 3.3, 4.2), thêm biến mục 5.1, `COWORK_KHACH_ENABLED=1`. **Kiểm cấu hình bằng container tạm trước**, để lỗi khởi động không làm sập cowork | `docker run --rm --env-file deploy/vps/.env.staging -v $PWD/deploy/vps/data:/data:ro cowork-staging:local python -c "from cowork import khach; khach.kiem_cau_hinh(); print('CAU_HINH_OK')"` | In `CAU_HINH_OK` | In `Realm khách bị chặn: …` ⇒ sửa, chưa restart |
| V3 | Khởi động lại VIP ID | `docker compose -f deploy/vps/docker-compose.yml up -d` | Healthy; nhân viên vẫn OK | Unhealthy ⇒ `COWORK_KHACH_ENABLED=0`, `up -d` |
| V4 | Cron thử lại hàng đợi CRM | `*/5 * * * * docker exec cowork-staging python -m cowork.cli khach-dong-bo` (VIPID `cowork/cli.py:8`). Nếu chọn cron cho bộ gửi email (M2) thì thêm cron đó | `crontab -l` | — |
| **G3** | Owner duyệt mở đường công khai | | | |
| D1 | DNS A `khachhang` (mục 6.1) | iNET | `dig` ba resolver | Sai IP |
| K1 | Khối Caddy (mục 6.2) với `<NGUON_CRM_DA_DO>` đo ở S3 (đo lại trên production nếu network khác) | Script root (mục 6.3) | rc 0; chứng chỉ LE `CN=khachhang.vipgroup.com.vn` | rc 4/5/6, script tự khôi phục |
| K2 | Smoke test chỉ đọc (bảng dưới) | | Tất cả đúng | Một mục sai ⇒ rollback K1 |
| **G4** | Owner duyệt smoke test chức năng | | | |
| F1 | Smoke test chức năng với **tài khoản thật do owner duyệt** (bảng dưới) | | PASS | Rollback theo mục 9 |
| B4 | Chụp trạng thái (sau), so với B1 | `impact-diff` (CRM runbook `:28`) | Các container khác không đổi | Khác |
| **G5** | Theo dõi 72 giờ (mục 10) | | Không cảnh báo nghiêm trọng | |
| W1 | Bật website (mục 7) | | | |
| **G6** | Nghiệm thu | | | |

### 8.1. Smoke test chỉ đọc (K2): không tạo dữ liệu

```bash
D=https://khachhang.vipgroup.com.vn
curl -sS -o /dev/null -w 'goc %{http_code} → %{redirect_url}\n' $D/                       # 302 → /tai-khoan/dang-nhap
curl -sS -o /dev/null -w 'login %{http_code}\n'  $D/tai-khoan/dang-nhap                     # 200
curl -sSI $D/tai-khoan/dang-nhap | grep -iE '^(strict-transport|content-security|x-frame|referrer|cache-control|server):'
curl -sS -o /dev/null -w 'portal-me %{http_code}\n' $D/portal/api/me                         # 401/403 (không phiên)
curl -sS -o /dev/null -w 'launch-rac %{http_code}\n' "$D/portal/auth/launch?token=x"         # 4xx, có audit portal.launch denied
for p in / /dang-nhap /api/me /api/health /api/internal/brain/x /api/internal/portal/signups /api/internal/khach/thu-hoi /admin; do
  curl -sS -o /dev/null -w "$p %{http_code}\n" -X POST "$D$p"; done                         # tất cả 404 (POST / → 404; GET / mới 302)
curl -sS -o /dev/null -w 'http %{http_code}\n' http://khachhang.vipgroup.com.vn/              # 308 → https
echo | openssl s_client -connect khachhang.vipgroup.com.vn:443 -servername khachhang.vipgroup.com.vn 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
# Hồi quy nhân viên:
curl -sS -o /dev/null -w 'cowork %{http_code}\n' https://cowork.vipgroup.com.vn/api/health   # 200
curl -sS -o /dev/null -w 'cowork-tk %{http_code}\n' https://cowork.vipgroup.com.vn/tai-khoan/dang-ky   # 404
# Chống giả mạo header (gửi IP giả; audit phải ghi IP thật của máy kiểm):
curl -sS -o /dev/null -H 'X-Real-IP: 203.0.113.9' -H 'X-Forwarded-For: 203.0.113.9' -H 'X-Forwarded-Proto: http' $D/tai-khoan/dang-nhap
```

Trên VPS, xác nhận audit ghi đúng IP thật (Python có sẵn trong image, không cần sqlite3 CLI):
```bash
docker exec cowork-staging python -c "import sqlite3;c=sqlite3.connect('file:/data/cowork.db?mode=ro',uri=True);print(c.execute(\"select action,ip,created_at from audit_log where tenant_id='khach' order by id desc limit 5\").fetchall())"
```

### 8.2. Smoke test chức năng (F1): không tạo dữ liệu giả ở production

Owner đã yêu cầu không có dữ liệu giả ở production (HĐ A10, `KIEN_TRUC_P1.md:18`). Vì vậy **không** dùng `+8490000000x` hay `@example.test` ở đây. Đề xuất:

- **Một tài khoản thật**: một nhân viên (hoặc owner) đăng ký bằng SĐT thật và email thật của chính mình, với tư cách **khách thật** của VIP GROUP. Owner ghi tên trước vào biên bản.
- Đi đúng quy trình: đăng ký → nhận email (kiểm SPF/DKIM/DMARC PASS trong "Show original") → xác minh → nhân viên **gọi xác minh** theo checklist (VIPID `docs/KHACH-DUYET-CHECKLIST.md`) → duyệt → nhận mã VG → đăng nhập bằng SĐT **và** bằng mã VG → thấy danh sách kiện (trống, hoặc kiện thật nếu là khách thật) → tra một mã vận đơn không thuộc mình → **404** → đăng xuất → quên mật khẩu → đặt lại → các phiên cũ bị thu hồi.
- **Hệ quả owner phải chấp nhận:**
  - mã `VG1001` (hoặc mã đầu tiên) thuộc về tài khoản này. Sequence không lùi, không tái sử dụng (CRM `VIP_CRM_V6_CUSTOMER_PORTAL_P1.md:60`);
  - bản ghi `customers` và `users(kind='customer')` tồn tại vĩnh viễn, vì audit chỉ ghi thêm;
  - nếu không giữ tài khoản, kết thúc bằng **tạm khoá** từ CRM (`portal.customer.lock` → VIP ID `khach.tam_khoa`), không xoá.
- Kiểm hai chiều HMAC: duyệt sinh `ket-qua-duyet` (CRM → VIP ID); đăng xuất sinh `thu-hoi` (VIP ID → CRM). Sau đó `crm_sync_pending` và `portal_outbox` đều không còn mục treo.
- Nếu owner **không** muốn có tài khoản nào ở production trước khi mở cho khách: chỉ chạy 8.1, và coi khách thật đầu tiên là smoke test có người theo dõi trực tiếp. Phương án này rủi ro hơn.

---

## 9. Rollback

Nguyên tắc chung (VIPID `docs/ROLLBACK.md:3`): không xoá dữ liệu thật; tắt bằng cờ trước, gỡ đường vào sau; chỉ khôi phục DB khi hỏng dữ liệu.

| Lớp | Thao tác | Thời gian | Dữ liệu |
|---|---|---|---|
| Website | Pages → Rollback về bản trước, hoặc revert PR `contact.portal` → `null` | 1–15 phút | Không có |
| VIP ID realm | `COWORK_KHACH_ENABLED=0` trong `.env.staging` → `docker compose -f deploy/vps/docker-compose.yml up -d` | ~1 phút (nhân viên gián đoạn vài giây) | Bảng `customer_*` vẫn còn và không ảnh hưởng gì. Host khách trả 421 vì `COWORK_STAFF_HOSTS` đã đặt (`khach_web.py:42-50`). Khách đang đăng nhập bị mất phiên |
| CRM cổng | `PORTAL_ENABLED=0` → `RELEASE=<current> docker compose -p vipcrm6-prod -f ~/vipcrm6-prod/app/deploy/production/compose.yml up -d --no-deps app` (CRM runbook `:168`) | 10–40 s gián đoạn CRM | Không đụng DB. Route portal trả 404, launch bị từ chối |
| Caddy | `cp -p <Caddyfile.bak-before-khachhang-…> /srv/vip-staging-proxy/Caddyfile` → `docker exec vip-staging-caddy caddy validate …` → `caddy reload …` (mẫu CRM `VIP_CRM_V6_HTTPS_GO_PUBLIC_PLAN.md:95-105`) | < 2 phút | Không có. **Không** restart container |
| DNS | Xoá A `khachhang` tại iNET. Thường **không cần**: gỡ Caddy là đủ chặn | ~5 phút + thời gian cache (TTL 300) | Không có |
| Mã VIP ID | Quay commit trước → `deploy.sh`. Mã cũ bỏ qua bảng mới | ~2 phút | Schema chỉ thêm, **không có bước down**. Không cần gỡ bảng |
| DB VIP ID | Chỉ khi hỏng: khôi phục `cowork-*.db` (VIPID `docs/ROLLBACK.md:84-95`) | ~5 phút | **Mất** mọi ghi của nhân viên sau thời điểm backup (phiên, audit, việc). Tránh dùng |
| DB CRM (schema) | `deploy/production/ops/portal-down.sql` (role owner, một giao dịch) | phút | **Từ chối (`DOWN_REFUSED`)** khi đã có dữ liệu cổng (đăng ký, mã VG, user `cust:*`, phiên…) (CRM `VIP_CRM_V6_CUSTOMER_PORTAL_P1.md:68`). Sau khách thật đầu tiên thì coi như **chỉ tiến** |
| DB CRM (dữ liệu) | `restore-db.sh` (CRM runbook `:87-109`) | 5–15 phút | **Mất** mọi giao dịch CRM sau bản backup (kể cả vận hành kho). Chỉ dùng khi hỏng dữ liệu, cần phê duyệt riêng. Ưu tiên bút toán bù (runbook `:84`) |
| Bí mật | Mục 4.3 | — | — |

Cần cân nhắc về dữ liệu khi rollback:
- Đăng ký đang chờ vẫn nằm trong `portal_signups` (CRM) và `customer_accounts` (VIP ID). Khi bật lại, chạy `khach-dong-bo --tat-ca`. Outbox CRM tự thử lại.
- Khách đã có mã VG vẫn giữ mã. Thông báo cho khách qua hotline/Zalo nếu tắt lâu.
- Link email còn hạn (≤ 30 phút) sẽ lỗi khi realm tắt. Khách yêu cầu gửi lại sau.

Điều kiện kích hoạt rollback:
- 5xx diện rộng ⇒ gỡ Caddy trước, giữ dịch vụ lại để điều tra;
- nghi lộ dữ liệu chéo khách ⇒ `PORTAL_ENABLED=0` **ngay**;
- nghi lộ bí mật ⇒ tắt cả hai cờ rồi xoay khoá;
- nhân viên cowork bị ảnh hưởng ⇒ `COWORK_KHACH_ENABLED=0`.

Người quyết định: owner `anh-thanh` (VIPID `docs/ROLLBACK.md:159`).

---

## 10. Giám sát và cảnh báo

### 10.1. Sự kiện cần theo dõi

**VIP ID** (`audit_log`, `tenant_id='khach'`, VIPID `cowork/schema.py:170-184`):

| Sự kiện | Ý nghĩa | Ngưỡng đề xuất |
|---|---|---|
| `khach.canh_bao.do_mat_khau` | Một tài khoản bị dò mật khẩu (`khach.py:813`) | Bất kỳ ⇒ báo |
| `khach.dang_nhap.sai`, `.khoa_cap_ip`, `.chan_ip`, `.gioi_han_toan_cuc`, `.thu_thach` | Dò hoặc khoá (`khach.py:769-809`) | > 50/giờ hoặc tăng đột biến |
| `khach.dang_ky.trung`, `khach.dang_ky.xung_dot_sdt` | Đăng ký trùng; có người khác thử **giữ chỗ SĐT** (`khach.py:629,639`) | `xung_dot_sdt` bất kỳ ⇒ nhân viên duyệt cẩn thận (VIPID `docs/KHACH-DUYET-CHECKLIST.md:7-8`) |
| `khach.dang_ky.qua_tan_suat`, `khach.quen_mat_khau.qua_tan_suat` | Chạm giới hạn theo IP (có thể do CGNAT) | Theo dõi tuần đầu, chỉnh ngưỡng |
| `khach.xac_minh_email.token_sai` | Dò token | > 20/giờ |
| `khach.hmac.sai`, `khach.hmac.phat_lai` | **HMAC sai hoặc phát lại** từ phía "CRM" (`khach_web.py:566`, `khach.py:990`) | Bất kỳ ⇒ báo ngay (sai khoá, lệch đồng hồ, hoặc bị tấn công) |
| `khach.tam_khoa`, `khach.thu_hoi`, `khach.dat_lai_mat_khau`, `khach.duyet`, `khach.tu_choi` | Sự kiện quản trị | Ghi nhận |
| Hàng đợi `crm_sync_pending WHERE done_at IS NULL` | VIP ID → CRM chưa gửi được | > 0 quá 30 phút ⇒ báo |
| `customer_outbox WHERE sent_at IS NULL` (sau M2) | Email chưa gửi | > 0 quá 10 phút ⇒ báo |
| Log container: `Gửi CRM … thất bại`, `Turnstile siteverify lỗi`, HTTP 503 (quá tải scrypt) | `khach.py:1037`, `khach_web.py:222,236` | Bất kỳ lặp lại |

**CRM** (`audit_log` Postgres):

| Sự kiện | Ngưỡng |
|---|---|
| `portal.signup.receive` / `portal.thu_hoi.receive` với `outcome='denied'`, `reason` bắt đầu bằng `SIGNATURE_INVALID`, `TS_SKEW`, `SIGNATURE_V2_REQUIRED`, `EVENT_MISMATCH` (`internal.js:146,152`) | Bất kỳ ⇒ báo |
| `portal.signup.receive` với `reason='SUBJECT_CONFLICT'` (`internal.js:181`) | Ghi nhận |
| `portal.launch` với `outcome='denied'` (`launch.js:112-114`) | > 30/giờ |
| `portal.parcels.search` (khối lượng theo khách) | Tăng đột biến ⇒ nghi dò mã vận đơn |
| `portal.outbox.retry`; `portal_outbox` treo | > 0 quá 30 phút |
| `portal.user.deactivate`, `portal.customer.lock/unlock` | Ghi nhận |

### 10.2. Vị trí log

| Nguồn | Vị trí |
|---|---|
| Caddy host khách (đề xuất) | `/data/access-khachhang.log` trong container `vip-staging-caddy` (mẫu cowork: `/data/access-cowork.log`, VIPID `docs/CAU-HINH-TEN-MIEN.md:84`) |
| VIP ID app | `docker logs cowork-staging` (uvicorn tắt access log, `Dockerfile:27`). Audit nằm trong `/data/cowork.db` (host `/srv/vip-staging/cowork/deploy/vps/data/cowork.db`). Backup ở `/srv/vip-staging/cowork-backups` (`backup.sh:6`) |
| CRM app | `docker logs` project `vipcrm6-prod` (json-file 10 MB × 5, `compose.yml:6-8`). Audit trong Postgres. Monitor ở `~/vipcrm6-prod/backups/logs/monitor.log`, cảnh báo ở `backups/state/ALERTS.log` (runbook `:140,150`) |
| Caddy CRM nhân viên | `/data/logs/crm-prod-access.log` (CRM `Caddyfile.prod.snippet:25`) |

### 10.3. Kênh cảnh báo: chưa có (điểm chặn B5)

- CRM đã có `ops/alert-send.sh` (SMTP/Zalo), nhưng đang **PENDING CONFIGURATION** (CRM runbook `:126,150`).
- VIP ID **chưa có** cơ chế cảnh báo nào.
- Đề xuất (khoảng 0,5–1 ngày): một script cron mỗi 5 phút chạy `docker exec cowork-staging python -c …`, đếm các sự kiện ở 10.1 từ lần chạy trước, rồi gọi chung `alert-send.sh` của CRM sau khi kênh đã cấu hình. Nếu dùng SMTP Workspace (mục 2) thì kênh cảnh báo CRM cũng dùng được ngay. Đó là một lý do chọn E1.

---

## 11. Điểm chặn còn mở và quyết định của owner

### 11.1. Điểm chặn

| # | Điểm chặn | Bên xử lý | Ước tính | Chặn |
|---|---|---|---|---|
| **B1** | A8: VIP ID chưa có kênh gửi email thật; production từ chối khởi động (`khach.py:103-105`) | VIP ID + owner (tài khoản) | 2–3 ngày công | Cứng |
| **B2** | Header HMAC lệch: VIP ID `X-Portal-Sig` (method+path) ↔ CRM `X-Portal-Sig` v1.1 + `X-Portal-Sig-V2`. Cả hai chiều đều 401 (mục 5.3) | VIP ID (và cập nhật HĐ) | 0,5 ngày + E2E | Cứng |
| **B3** | Đường mạng: container VIP ID không tới được `127.0.0.1:18185` của CRM. CRM → VIP ID bắt buộc https, nên phải quay vòng qua Caddy và cần allowlist IP đã đo (mục 1.3) | DevOps + owner chọn N1/N2 | 0,5 ngày | Cứng |
| **B4** | Chưa có bản phát hành nào chứa cổng: VIP ID `feature/khach-p1` chưa vào `main`; CRM production `55d6ae3` bỏ qua `PORTAL_*`. Công cụ `update-prod.sh` có thay đổi mới, chưa diễn tập (runbook `:51-52`) | VIP ID, CRM | theo backlog | Cứng |
| **B5** | CRM NO-GO PUBLIC: chưa có admin thứ hai (P6), chưa có kênh cảnh báo thật (P8) (CRM HTTPS plan `:15-17`). VIP ID chưa có cảnh báo (mục 10.3) | Owner + CRM | — | Cứng |
| **B6** | Chưa có E2E staging giữa VIP ID thật và CRM thật (C14). Bản tra soát VIP ID chỉ dùng CRM giả | Cả hai | 1–1,5 ngày | Cứng |
| B7 | Widget Turnstile production | Owner | 15 phút | Cứng (VIP ID từ chối khởi động) |
| B8 | DNS A `khachhang` / `khachhang-staging` và khối Caddy (root) | Owner + root | 1 giờ | Cứng |
| B9 | DMARC chưa có; chưa xác nhận DKIM Workspace đang ký | Owner | 30 phút + 2–4 tuần theo dõi | Mềm (nên có trước khi mở) |
| B10 | Kho XM/YW chưa có dữ liệu WMS; cổng hiển thị "Sắp mở" (HĐ `:151`) | Owner | — | Không chặn P1 |

### 11.2. Quyết định owner cần đưa ra

| # | Câu hỏi | Đề xuất của gói này |
|---|---|---|
| Q1 | Định danh đăng nhập: chỉ mã VG (CRM đề xuất K1), hay **cả** SĐT và VG (VIP ID đang làm theo HĐ §11.1)? | Chốt trước B6. Nếu chỉ VG thì VIP ID tắt đăng nhập bằng SĐT để giảm bề mặt dò |
| Q2 | Kênh email: E1 Workspace SMTP AUTH (`no-reply@`, App Password), E2 relay có xác thực, hay E3 nhà cung cấp ngoài? | **E1**. Hộp nhận báo cáo DMARC do owner chỉ định |
| Q3 | Đường VIP ID → CRM: N1 (network docker chung) hay N2 (`https://crm.vipgroup.com.vn`)? | **N1** |
| Q4 | Xác minh SĐT: chấp nhận "nhân viên gọi điện" cho P1, OTP để giai đoạn 2? (HĐ `:148`, CRM K4) | Chấp nhận cho P1 |
| Q5 | Smoke test chức năng: tài khoản thật do owner chọn (mục 8.2), chấp nhận mã VG đầu tiên thuộc tài khoản đó? | Có. Ghi tên vào biên bản |
| Q6 | Có làm role LOGIN riêng (`PORTAL_DATABASE_URL`) cho CRM cổng trước khi mở không? (CRM P1 `:186`) | Nên làm. Thêm một secret (mục 4.1) |
| Q7 | Giới hạn đăng ký 5/giờ/IP có quá chặt với CGNAT không? | Giữ khi mở, theo dõi `khach.dang_ky.qua_tan_suat` 1 tuần |
| Q8 | Khung bảo trì cho giai đoạn 2 (khoảng 2–3 giờ; nhân viên cowork gián đoạn vài giây ở V1, V3; CRM gián đoạn 20–40 s ở C1) | Ngoài giờ làm việc, báo trước |
| Q9 | Có tạo staging `khachhang-staging` công khai (DNS + Caddy) không, hay chỉ kiểm qua SSH tunnel (CRM runbook `:184-190`)? | Cần DNS công khai cho staging, vì Turnstile và chứng chỉ thật đều kiểm theo hostname |
| Q10 | Ai giữ quyền root để chạy script Caddy, và ai nhận bàn giao bí mật (không qua chat)? | Owner chỉ định bằng văn bản |

---

*Hết tài liệu. Chưa có bước nào ở trên được áp dụng.*
