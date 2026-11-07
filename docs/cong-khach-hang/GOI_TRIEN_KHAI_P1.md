# CỔNG KHÁCH HÀNG VIP GROUP P1 — GÓI CHUẨN BỊ TRIỂN KHAI PRODUCTION

Phiên bản 0.2 · 07/11/2026 · Người lập: DevOps/Security (phiên website, chỉ đọc repo).
**Trạng thái: ĐỀ XUẤT – CHƯA ÁP DỤNG. Production NO-GO.** Tài liệu này chỉ để owner xem xét. Khi lập, tôi **không** chạy lệnh nào trên VPS, DNS, Cloudflare hay production, **không** sửa repo VIP ID hay CRM. Mọi lệnh bên dưới dành cho owner hoặc người vận hành, và chỉ chạy khi có phê duyệt riêng.

Căn cứ (đọc ngày 07/11/2026):
- Hợp đồng: `docs/cong-khach-hang/KIEN_TRUC_P1.md` §1–§14, gọi tắt **HĐ**; phân công `docs/cong-khach-hang/ONE_CRM_PHAN_CONG.md`; báo cáo nghiệm thu `docs/cong-khach-hang/BAO_CAO_NGHIEM_THU_P1.md`.
- VIP ID: `~/code/vip-group-id-khach`, nhánh `feature/khach-p1` @ **`6030e14`** (HEAD lúc đọc, chưa merge `main`, chưa deploy).
- CRM: `~/Projects/vip-group-khoqctq`, nhánh `main` @ **`5007252`**; commit bằng chứng **`a87df12`** (`docs/evidence/g7-hotfix/SUMMARY.md`). Bỏ qua thay đổi chưa commit trong working tree CRM.
- Website: repo này; production đã phát hành 07/11 từ `main` @ `ce289ca`, `contact.portal = null`.

Quy ước trích dẫn: `VIPID:` = repo VIP ID, `CRM:` = repo CRM (theo `5007252`), `WEB:` = repo này.

---

## 0. Tóm tắt cho owner

| Hạng mục | Kết luận |
|---|---|
| Sẵn sàng production? | **Chưa.** Chặn cứng còn lại (mục 11.1): **P1-a** CRM chưa có nút/route nhân viên cấp link đặt lại mật khẩu; **P1-b** CRM chưa dùng `PORTAL_DATABASE_URL` (hoặc owner ký chấp nhận rủi ro); **B3** đường mạng VIP ID ⇄ CRM; **B4** chưa có bản phát hành; **B5** cảnh báo + admin CRM thứ hai; **B6** E2E trên staging; **B7** khoá Turnstile thật; **B8** DNS + Caddy |
| Đã giải quyết | **B1 email**: owner bỏ xác minh email/SĐT; production chỉ đòi kênh thư thật khi bật `COWORK_KHACH_EMAIL_ENABLED=1` (VIPID `cowork/khach.py:110-112`). **B2 header HMAC**: hai bên cùng một chuỗi ký, kit 30/30 + 4/4 (mục 5.3) |
| Kiểm thử | E2E local VIP ID `6030e14` + CRM `5007252`: **34 PASS / 0 FAIL / 2 PENDING** (WEB `BAO_CAO_NGHIEM_THU_P1.md:58`). Vẫn phải chạy lại trên staging |
| DNS | Thêm **một** bản ghi `A khachhang → 160.22.170.20` tại iNET/vCloudDNS (DNS **không** ở Cloudflare) |
| Thứ tự | Gỡ chặn → staging E2E → backup → CRM → VIP ID → Caddy → kiểm tra → website (PR riêng, sau cùng) |
| Rollback nhanh nhất | `COWORK_KHACH_ENABLED=0` / `PORTAL_ENABLED=0` (≈ 1 phút), gỡ khối Caddy (< 2 phút). **Không** quay mã VIP ID về trước v6 nếu không khôi phục DB (mục 9) |

---

## 1. Kiến trúc production

### 1.1. Sơ đồ (ĐỀ XUẤT – CHƯA ÁP DỤNG)

```
                         Internet (trình duyệt khách)
                                   │ HTTPS 443
  DNS iNET/vCloudDNS: khachhang.vipgroup.com.vn  A  160.22.170.20   (chưa tạo)
                                   ▼
 ┌──────────────────────────── VPS 160.22.170.20 ─────────────────────────────────┐
 │ Caddy v2.11.4 · container vip-staging-caddy · network host                      │
 │  site khachhang.vipgroup.com.vn                                                 │
 │   ├─ /tai-khoan, /tai-khoan/*  ──► 127.0.0.1:8899  VIP ID (cowork-staging)      │
 │   ├─ /portal, /portal/*        ──► 127.0.0.1:18185 CRM (vipcrm6-prod app)       │
 │   ├─ /api/internal/*           ──► 404 (mọi nhánh, theo PA N1)                  │
 │   ├─ /                         ──► 302 /tai-khoan/dang-nhap                     │
 │   └─ còn lại                   ──► 404                                          │
 │  site cowork.vipgroup.com.vn (đang chạy) ──► 127.0.0.1:8899 VIP ID nhân viên     │
 │                                                                                 │
 │  Server↔server (HMAC VIPID_PORTAL_SECRET) qua network docker chung (PA N1):     │
 │   VIP ID ──POST /api/internal/portal/{signups,thu-hoi}──► CRM app:5175          │
 │   CRM    ──POST /api/internal/khach/{ket-qua-duyet,tam-khoa,thu-hoi,            │
 │             tao-link-dat-lai} (Host: khachhang…)──► VIP ID cowork:8899          │
 │  Trình duyệt: VIP ID 302 ──► /portal/auth/launch?token=… (HS256, ≤ 60 s, 1 lần) │
 └─────────────────────────────────────────────────────────────────────────────────┘
```

Cơ sở: VIP ID chạy container `cowork-staging`, `127.0.0.1:8899`, network bridge mặc định (VIPID `deploy/vps/docker-compose.yml:1-15`). CRM `127.0.0.1:18185 → 5175`, network `edge` 172.31.250.0/24 + `db` internal (CRM `deploy/production/compose.yml:55-56,78-80`). Chia đường theo HĐ §2, §3.2.

### 1.2. Mỗi bên tự chặn theo Host (đã có trong code)

| Bên | Host khách | Host khác | Nguồn |
|---|---|---|---|
| VIP ID | chỉ `/tai-khoan/*` và `/api/internal/khach/*`; route nhân viên 404 | `/tai-khoan/*` 404; host không thuộc hai danh sách → **421** | VIPID `cowork/khach_web.py:25-60`, `cowork/khach.py:191-200`, `cowork/config.py:123-129` |
| CRM | chỉ `/portal`, `/portal/*`; mọi đường khác (kể cả `/api/internal/portal/*`) 404 | `/portal*` 404; `/api/internal/portal/*` **chỉ** ở host này | CRM `server/lib/hostguard.js:5-10` |

**Hệ quả vận hành:** hostguard CRM chỉ bật khi đặt `PORTAL_HOST`. Production bật cổng mà thiếu `PORTAL_HOST` thì CRM từ chối khởi động (CRM `server/config.js:62`). Dù vậy, khối Caddy chỉ chuyển `/portal*` sang CRM (mục 6.2), không bao giờ `/*`.

Khách "cũ" (tài khoản `kind='customer'` đăng nhập mật khẩu local) **vẫn dùng được CRM nhân viên** khi `STAFF_HOST_ALLOW_LEGACY_CUSTOMERS` khác `0` (mặc định) (CRM `server/config.js:102-104`, `server/app.js:88`). Owner quyết định (Q2, mục 11.2).

### 1.3. Đường gọi server↔server — điểm chặn B3

Sự thật trong code:
- VIP ID → CRM dùng `CRM_PORTAL_INTERNAL_URL` (mặc định `http://127.0.0.1:8897`, VIPID `cowork/config.py:133-134`). Trong container, `127.0.0.1` là chính container, nên **không** tới được `127.0.0.1:18185` của host.
- CRM → VIP ID dùng `VIPID_PORTAL_URL`, luôn gửi `Host: <PORTAL_HOST>`. Production nhận `https:`, hoặc `http:` **chỉ** tới đích nội bộ: tên dịch vụ docker một nhãn (vd `cowork`), `localhost`, 127/8, 10/8, 172.16/12, 192.168/16, `::1`, `fc00::/7` (CRM `server/lib/internal-url.js:1-46`, `server/config.js:65-71`). Tên miền có dấu chấm hoặc IP công khai bắt buộc https.
- Request VIP ID **không** gọi CRM; mọi sự kiện xếp hàng `crm_sync_pending`, vòng nền gửi mỗi `COWORK_KHACH_SYNC_GIAY` giây (mặc định 5) (VIPID `cowork/khach_web.py:182-187`, `cowork/config.py:179`).

| PA | Cách làm | Ghi chú |
|---|---|---|
| **N1 (đề xuất)** | Gắn container `cowork-staging` vào network `edge` của CRM (khai báo `external`, tên thật dạng `vipcrm6-prod_edge` — **phải đo**). VIP ID: `CRM_PORTAL_INTERNAL_URL=http://<alias app CRM>:5175`. CRM: `VIPID_PORTAL_URL=http://cowork:8899` (tên dịch vụ một nhãn, được CRM nhận) | Không đi qua Internet/Caddy, không hairpin; Caddy chặn **toàn bộ** `/api/internal/*`. Phải sửa compose VIP ID (đội VIP ID). Nên đặt alias riêng cho app CRM (vd `vipcrm-app`) để tránh trùng tên `app` |
| N2 (dự phòng) | CRM: `VIPID_PORTAL_URL=https://khachhang.vipgroup.com.vn` (hairpin qua Caddy). VIP ID → CRM vẫn cần N1 hoặc mở `crm.*` | Caddy phải cho `/api/internal/khach/*` **chỉ** từ nguồn đo được (dự kiến 172.31.250.0/24). Phức tạp hơn, phụ thuộc NO-GO PUBLIC của CRM |

### 1.4. Những thứ KHÔNG được ra Internet

| Thành phần | Cách bảo đảm |
|---|---|
| `/api/internal/portal/*` (CRM), `/api/internal/khach/*` (VIP ID) | Caddy host khách 404 (N1). Phía sau còn HMAC, chống phát lại, lệch giờ ±300 s, giới hạn body (VIPID `cowork/khach.py:964-990`; CRM `server/modules/portal/internal.js:26,51-56,174-181`) |
| Giao diện/`/api/*` CRM nhân viên | Caddy chỉ chuyển `/portal*`; hostguard 404 |
| Route nhân viên VIP ID | Caddy chỉ chuyển `/tai-khoan*`; VIP ID tách realm theo Host |
| Cổng 8899 / 18185 / Postgres | Chỉ bind `127.0.0.1`; DB ở network `internal: true` |
| Caddy admin `127.0.0.1:2019` | Rủi ro có sẵn (user `deploy` thuộc nhóm docker), không do P1 tạo ra |

---

## 2. Đăng ký, khôi phục và email (quyết định owner 07/11)

- **Không xác minh email, không gọi xác minh SĐT** (HĐ §13). Đăng ký tạo ngay tài khoản `cho_duyet`, gửi signup sang CRM; nhân viên duyệt là cổng duy nhất. Email là thông tin **tuỳ chọn**, không unique; SĐT unique (VIPID `docs/CAU-HINH-TEN-MIEN.md:239-249`; schema v6 bỏ `email_norm NOT NULL UNIQUE`, `cowork/db.py:117-123`).
- **Kênh email:** `COWORK_KHACH_EMAIL_ENABLED=0` (mặc định) thì không ghi outbox email và production **không** đòi kênh thư. Bật `=1` mà chưa có kênh thật thì từ chối khởi động (A8) (VIPID `cowork/config.py:171-173`, `cowork/khach.py:110-112`). Hiện chưa có kênh thật nào (`KENH_EMAIL_THAT` rỗng, `cowork/khach.py:48`). **Production đặt `=0`.**
- **Khôi phục mật khẩu do nhân viên hỗ trợ:** trang quên mật khẩu chỉ hướng dẫn gọi hotline/Zalo (`COWORK_KHACH_HOTLINE`, mặc định `0961 102 655`, VIPID `cowork/config.py:175`). Nhân viên CRM cấp link một lần, 30 phút, qua `POST /api/internal/khach/tao-link-dat-lai` `{subject, requested_by}` → `{url, expires_at}` (VIPID `cowork/khach_web.py:727-729`, `cowork/khach.py:1332-1352`).
  - **P1-a:** ở CRM `5007252` **chưa có** route/nút nhân viên gọi endpoint này (chỉ có trong thay đổi chưa commit của CRM). VIP ID không có CLI tương đương; bản demo dùng `tests/portal-e2e/demo.mjs reset-link` (ký HMAC từ máy dev — **không** dùng ở production). CRM đang chờ owner xác nhận trực tiếp.
- **Chống đăng ký ồ ạt:** 5 đăng ký/giờ/IP (IPv6 gộp /64) và trần toàn hệ thống **200/giờ**; vượt trần → trang 503 "Hệ thống đang nhận quá nhiều đăng ký… liên hệ hotline/Zalo" + audit `khach.canh_bao.dang_ky_tang_dot_bien` (≤ 1 dòng/giờ) (VIPID `cowork/khach.py:597-610`, `cowork/config.py:153,177`).
- Email đăng ký trùng SĐT: phản hồi y hệt, không tạo tài khoản, đánh dấu `phone_conflict` gửi CRM (VIPID `cowork/khach.py:648-656`).

**Gửi email thật (giai đoạn sau) — ĐỀ XUẤT – CHƯA ÁP DỤNG:** tên miền dùng Google Workspace (MX/SPF/DKIM có, **chưa có `_dmarc`**, WEB `docs/DNS_MIGRATION.md:16-19,23`). Khi cần: Workspace SMTP AUTH từ hộp `no-reply@`, App Password trong tệp 0600, bộ gửi tách khỏi request, thêm `_dmarc` `v=DMARC1; p=none; rua=mailto:<hộp owner chọn>`. Không chặn P1.

---

## 3. Cloudflare Turnstile — bắt buộc ở production

- Production bật realm khách mà thiếu site key/secret, hoặc dùng **khoá thử nghiệm** của Cloudflare, thì VIP ID **từ chối khởi động** (VIPID `cowork/khach.py:124-129,253-255`).
- Dùng ở **hai nơi**: đăng ký (action `khach_dang_ky`) và đăng nhập khi bị thử thách sau nhiều lần sai (action `khach_login`, audit `khach.dang_nhap.thu_thach`) (VIPID `cowork/khach.py:256-259,751-753`; `docs/CAU-HINH-TEN-MIEN.md:257-258`).
- Kiểm `hostname` và `action` trong kết quả siteverify; container phải ra được `https://challenges.cloudflare.com` (VIPID `cowork/config.py:169`).

Tạo widget (owner, dashboard Cloudflare): tên `VIP GROUP — Cổng khách hàng`, hostname **chỉ** `khachhang.vipgroup.com.vn`, mode **Managed**, không pre-clearance. **Không** dùng lại widget form lead website (WEB `src/data/vi/contact.ts:15`). Staging dùng widget riêng. Turnstile không cần zone DNS ở Cloudflare.

| Biến VIP ID | Giá trị | Nguồn |
|---|---|---|
| `COWORK_KHACH_TURNSTILE_SITE_KEY` | site key thật | VIPID `cowork/config.py:166` |
| `COWORK_KHACH_TURNSTILE_SECRET_FILE` | `/data/turnstile_secret.key` (0600, uid 10001) | `cowork/config.py:167-168` |
| `COWORK_KHACH_TURNSTILE_SECRET` | **không dùng** ở production (lộ qua `docker inspect`) | `cowork/khach.py:239-243` |

Ghi secret (trên VPS, không dán vào chat/ticket):

```bash
read -rs TS && printf '%s' "$TS" | docker run --rm -i \
  -v /srv/vip-staging/cowork/deploy/vps/data:/data alpine:3.20 \
  sh -c 'umask 077; cat > /data/turnstile_secret.key && chown 10001:10001 /data/turnstile_secret.key && chmod 600 /data/turnstile_secret.key'
unset TS
```

**Kiểm sống (B7):** trên staging và ngay sau mở production, đăng ký thử một lần và cố tình sai mật khẩu đủ để bị thử thách; widget phải hiện và qua được.

---

## 4. Bí mật

| Bí mật | VIP ID | CRM | Sinh | Ràng buộc |
|---|---|---|---|---|
| `VIPID_PORTAL_SECRET` | `/data/portal_secret.key` qua `VIPID_PORTAL_SECRET_FILE` (VIPID `cowork/config.py:140`, `cowork/khach.py:72-80`) | `~/vipcrm6-prod/secrets/vipid_portal_secret` → `/run/secrets/vipid_portal_secret` (CRM `deploy/production/compose.yml:54,89`) | `openssl rand -hex 32` | **Cùng giá trị** hai bên, ≥ 32 byte, khác mọi bí mật khác; hai bên kiểm khi khởi động (VIPID `cowork/khach.py:144-150`; CRM `server/config.js:55-60`) |
| Turnstile secret | `/data/turnstile_secret.key` | — | Cloudflare | Không khoá thử nghiệm |
| Mật khẩu role cổng (P1-b) | — | ĐỀ XUẤT `~/vipcrm6-prod/secrets/db_portal_password`, dùng trong `PORTAL_DATABASE_URL` (`app.env` 0600) | `openssl rand -base64 33` | Role LOGIN NOINHERIT, **chỉ** là thành viên `crm_portal` (CRM `server/config.js:107-108`, `VIP_CRM_V6_CUSTOMER_PORTAL_P1.md:186`) |

**Cảnh báo VIP ID:** thiếu tệp thì `_secret()` **tự sinh khoá mới** (VIPID `cowork/config.py:76-98`) — chạy được nhưng mọi HMAC sai. Đặt tệp **trước** khi bật realm, rồi so khớp:

```bash
( umask 077; openssl rand -hex 32 > ~/vipcrm6-prod/secrets/vipid_portal_secret )
id -u deploy   # phải = 1000 (uid node của CRM)
docker run --rm -i -v /srv/vip-staging/cowork/deploy/vps/data:/data alpine:3.20 \
  sh -c 'umask 077; cat > /data/portal_secret.key && chown 10001:10001 /data/portal_secret.key && chmod 600 /data/portal_secret.key' \
  < ~/vipcrm6-prod/secrets/vipid_portal_secret
docker run --rm -v /srv/vip-staging/cowork/deploy/vps/data:/data:ro \
  -v ~/vipcrm6-prod/secrets/vipid_portal_secret:/crm.key:ro alpine:3.20 \
  sh -c 'cmp -s /data/portal_secret.key /crm.key && echo GIONG || echo KHAC'
```

**Xoay vòng `VIPID_PORTAL_SECRET`:** không hỗ trợ hai khoá cùng lúc ⇒ thay **cả hai** tệp, `up -d --no-deps app` (CRM, gián đoạn 10–40 s), `docker compose -f deploy/vps/docker-compose.yml up -d` (VIP ID giữ khoá trong bộ nhớ, `_bi_mat_cache`), rồi `docker exec cowork-staging python -m cowork.cli khach-dong-bo --tat-ca`. Launch đang bay (≤ 60 s) bị từ chối; hàng đợi hai bên tự gửi lại. Nghi lộ ⇒ tắt cờ hai bên **trước**, rồi mới xoay.

---

## 5. Cấu hình production và điều kiện tiên quyết

### 5.1. VIP ID — `/srv/vip-staging/cowork/deploy/vps/.env.staging`

Tên tệp là `.env.staging` dù là production (VIPID `deploy/vps/docker-compose.yml:11-12`). Nội dung thật không có trong repo: owner kiểm từng dòng.

| Biến | Giá trị production | Nguồn (VIPID) |
|---|---|---|
| `COWORK_ENV` | `production` | `cowork/config.py:70` |
| `COWORK_TIN_PROXY` | `1` — **thiếu ⇒ từ chối khởi động** | `config.py:73`, `khach.py:119-121` |
| `COWORK_COOKIE_SECURE` | `1` — **thiếu ⇒ từ chối khởi động** | `config.py:52`, `khach.py:122-123` |
| `COWORK_STAFF_HOSTS` | `cowork.vipgroup.com.vn,127.0.0.1:8899` — **thiếu ⇒ từ chối khởi động**; cần `127.0.0.1:8899` cho healthcheck docker | `config.py:128-129`, `khach.py:130-133`, `docker-compose.yml:21-22` |
| `COWORK_KHACH_ENABLED` | `1`, **bật sau cùng** (bước V3) | `config.py:118` |
| `COWORK_KHACH_HOSTS` | `khachhang.vipgroup.com.vn` | `config.py:123-124` |
| `COWORK_KHACH_PUBLIC_URL`, `CRM_PORTAL_PUBLIC_URL` | `https://khachhang.vipgroup.com.vn` (bắt buộc https) | `config.py:131-136`, `khach.py:152-156` |
| `CRM_PORTAL_INTERNAL_URL` | theo N1 (mục 1.3) | `config.py:133-134` |
| `VIPID_PORTAL_SECRET_FILE` | `/data/portal_secret.key` | `config.py:140` |
| `COWORK_KHACH_EMAIL_ENABLED` | `0` | `config.py:173` |
| `COWORK_KHACH_HOTLINE` | `0961 102 655` (hoặc số owner chốt) | `config.py:175` |
| `COWORK_KHACH_TURNSTILE_SITE_KEY` / `_SECRET_FILE` | khoá thật (mục 3) | `config.py:166-168` |
| Giữ mặc định | `_SIGNUP_GLOBAL_PER_HOUR=200`, `_SIGNUP_IP_PER_HOUR=5`, `_SYNC_GIAY=5`, `CRM_PORTAL_TIMEOUT=3`, `_TOKEN_TTL_MIN=30`, `_LAUNCH_TTL=60` (trần 60), `_SESSION_HOURS=12`, `_IDLE_MINUTES=120`, `_LOGIN_MAX_FAIL=5`, `_LOGIN_IP_MAX_FAIL=20`, `_LOCK_MIN=15`, `_SCRYPT_LOG2_N=17`, `_SCRYPT_DONG_THOI=2` | `config.py:137,144-161,177-179` |

Ghi chú:
- **Uvicorn một worker** (Dockerfile không đặt `--workers`, VIPID `deploy/vps/Dockerfile:25-27`) là đủ. Gửi CRM nhận dòng theo **lease** nguyên tử nên nhiều tiến trình (vòng nền + cron CLI) không gửi trùng (VIPID `cowork/khach.py:1018-1059`).
- **RAM:** scrypt N=2¹⁷ ≈ 128 MiB/lượt × 2 lượt đồng thời; container VIP ID không đặt giới hạn bộ nhớ. Kiểm RAM trống.
- **CGNAT:** 5 đăng ký/giờ/IP có thể chặn khách 4G chung IP; theo dõi `khach.dang_ky.qua_tan_suat` tuần đầu.

### 5.2. CRM — `~/vipcrm6-prod/secrets/app.env` và compose

| Biến | Giá trị production | Nguồn (CRM) |
|---|---|---|
| `APP_ENV`, `COOKIE_SECURE`, `TRUST_PROXY`, `VIPID_PORTAL_SECRET_FILE` | cố định trong compose: `production`, `1`, `172.31.250.1`, `/run/secrets/vipid_portal_secret` | `deploy/production/compose.yml:46-54` |
| `PORTAL_ENABLED` | `1` (production mặc định tắt) | `server/config.js:113-117` |
| `PORTAL_HOST` | `khachhang.vipgroup.com.vn` | `server/config.js:101` |
| `PORTAL_PUBLIC_URL` | `https://khachhang.vipgroup.com.vn` | `server/config.js:105` |
| `VIPID_PORTAL_URL` | N1: `http://cowork:8899` (hoặc https theo N2) | `server/config.js:65-71,106`, `server/lib/internal-url.js` |
| `PORTAL_DATABASE_URL` | **P1-b:** URL role LOGIN NOINHERIT chỉ là thành viên `crm_portal`. Không đặt ⇒ app dùng `SET LOCAL ROLE` trên pool app; `RESET ROLE` trong giao dịch lấy lại quyền app (đã ghi nhận) | `server/config.js:107-108`, `VIP_CRM_V6_CUSTOMER_PORTAL_P1.md:186` |
| `STAFF_HOST_ALLOW_LEGACY_CUSTOMERS` | theo Q2 (mặc định cho phép) | `server/config.js:102-104` |

`PORTAL_*` cố ý **không** đặt trong `environment:` compose (CRM runbook §6). Không còn biến `PORTAL_SIG_V2_REQUIRED` (đã bỏ cùng header V2).

### 5.3. Hợp đồng HMAC và thu hồi — B2 ĐÃ GIẢI QUYẾT

- Một header duy nhất `X-Portal-Sig` = hex(HMAC-SHA256(secret, `"<chiều>.<METHOD>.<path>.<ts>." + body`)), kèm `X-Portal-Ts`; không còn `X-Portal-Sig-V2` (VIPID `cowork/khach.py:950-961`; CRM `server/modules/portal/internal.js:8-9,174`, `server/modules/portal/vipid-client.js:4,120`).
- Bằng chứng: kit hợp đồng (WEB `6d7fee5`) với CRM `5007252` — chiều VIP ID → CRM **30 PASS / 0 FAIL / 1 INFO**, chiều CRM → VIP ID **4/4** (CRM `docs/evidence/g7-hotfix/SUMMARY.md`, commit `a87df12`).
- **Idempotency-Key:** VIP ID gửi mỗi sự kiện kèm `Idempotency-Key`; CRM tôn trọng khoá này nên gửi lại sau timeout không tạo trùng (VIPID `cowork/khach.py:1033,1069`; CRM `server/modules/portal/internal.js:204-227`).
- **Thu hồi (HĐ §14):** body `{subject, reason, revoked_at, revoked_at_ms}`; launch token có `iat_ms`. CRM ưu tiên `revoked_at_ms`, từ chối token có `iat_ms` trước mốc; `iat` tương lai > **5 s** bị từ chối (CRM `server/modules/portal/internal.js:266-285`, `server/modules/portal/launch.js:24,75-77,132`). VIP ID ghi mốc nguyên tử, kẹp tối đa `now + 5 phút`, kẹp thì audit `khach.canh_bao.dong_ho` (VIPID `docs/CAU-HINH-TEN-MIEN.md:272-302`).

### 5.4. Điều kiện tiên quyết production (kiểm trước G3)

| # | Điều kiện | Kiểm |
|---|---|---|
| T1 | Khoá Turnstile thật (đăng ký + đăng nhập bị thử thách); production từ chối khoá thử | V2 in `CAU_HINH_OK` + kiểm sống mục 3 |
| T2 | `COWORK_TIN_PROXY=1`, `COWORK_COOKIE_SECURE=1`, `COWORK_STAFF_HOSTS` đặt | V2 |
| T3 | NTP đồng bộ trên VPS (lệch iat ≤ 5 s, HMAC ±300 s). CRM đã đo chỉ đọc 07/11: `System clock synchronized: yes`, `NTP service: active` (CRM `docs/evidence/prod-readiness/survey_deploy.txt:269-270`) | `timedatectl` lại ngày triển khai |
| T4 | `PORTAL_DATABASE_URL` role riêng (P1-b), **hoặc** owner ký chấp nhận rủi ro | Biên bản |
| T5 | `COWORK_KHACH_EMAIL_ENABLED=0` | V2 |
| T6 | Backup DB VIP ID **trước** khi mã v6 chạy lần đầu (mục 9) | B2 in `BACKUP_OK` |
| T7 | Truy vấn trước deploy CRM: không có user `vip_subject LIKE 'cust:%'` có `password_hash` hoặc `kind≠customer` (ràng buộc 704) | CRM `docs/evidence/g7-hotfix/SUMMARY.md` |

---

## 6. DNS và Caddy

### 6.1. DNS (ĐỀ XUẤT – CHƯA ÁP DỤNG; owner làm tại iNET)

| Tên | Loại | Giá trị | TTL | Khi |
|---|---|---|---|---|
| `khachhang-staging` | A | `160.22.170.20` | 300 | Trước, cho staging |
| `khachhang` | A | `160.22.170.20` | 300 | Qua G3 |

Không AAAA/CNAME, tắt OneShield. Zone không có CAA nên Let's Encrypt HTTP-01 cấp được. Không sửa bản ghi sẵn có (đặc biệt bản ghi EMAIL CRITICAL, WEB `docs/DNS_MIGRATION.md:16-19`). Kiểm: `dig +short A khachhang.vipgroup.com.vn @ns1.vclouddns.vn` / `@8.8.8.8` / `@1.1.1.1` → `160.22.170.20`.

### 6.2. Khối Caddy (ĐỀ XUẤT – CHƯA ÁP DỤNG, theo PA N1)

```caddy
# ===== ĐỀ XUẤT – CHƯA ÁP DỤNG · Cổng khách hàng VIP GROUP P1 (PA N1) =====
# Đích: /srv/vip-staging-proxy/Caddyfile. Chỉ THÊM khối này. Matcher loại trừ nhau.
khachhang.vipgroup.com.vn {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		X-Robots-Tag "noindex, nofollow"
		# '?' = chỉ đặt khi upstream không gửi. KHÔNG ghi đè CSP (trang Turnstile cần CSP riêng).
		?Content-Security-Policy "default-src 'none'; frame-ancestors 'none'"
		?X-Frame-Options "DENY"
		?Referrer-Policy "same-origin"
		-Server
	}

	# Server↔server đi qua network docker (N1) ⇒ mọi /api/internal* từ Internet: 404.
	@noi_bo path /api/internal /api/internal/*
	handle @noi_bo {
		respond "Not Found" 404
	}

	@vipid path /tai-khoan /tai-khoan/*
	handle @vipid {
		request_body {
			max_size 64KB
		}
		reverse_proxy 127.0.0.1:8899 {
			header_up X-Real-IP {remote_host}
		}
	}

	# CHỈ /portal* — không bao giờ /*
	@crm path /portal /portal/*
	handle @crm {
		request_body {
			max_size 64KB
		}
		reverse_proxy 127.0.0.1:18185 {
			header_up X-Real-IP {remote_host}
		}
	}

	@goc path /
	handle @goc {
		redir /tai-khoan/dang-nhap 302
	}

	handle {
		respond "Not Found" 404
	}

	log {
		output file /data/access-khachhang.log {
			roll_size 10mb
			roll_keep 5
		}
		# Xoá token khỏi URI: ?t= (link đặt lại, 30 phút) và ?token= (launch, 60 s).
		# Phải 'caddy validate' trên 2.11.4; không nhận thì bọc trong 'fields { … }'.
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

Nếu owner chọn N2: thay `@noi_bo` bằng hai nhánh — `/api/internal/khach/*` chỉ cho `remote_ip <NGUON_CRM_DA_DO>` (đo ở bước S3, dự kiến 172.31.250.0/24), còn lại 404.

Giải thích:
- Caddy giữ nguyên `Host`, đặt `X-Forwarded-*` và bỏ giá trị client gửi; hai app cần Host gốc.
- `X-Real-IP` ghi đè từ `remote_host`: VIP ID với `COWORK_TIN_PROXY=1` tin header này từ **mọi** nguồn tới 8899 (uvicorn `--no-proxy-headers`). Chấp nhận được vì 8899 chỉ bind loopback và (N1) network `edge`, nhưng owner cần biết.
- Không `preload` HSTS. Không cần thêm `Secure` cho cookie (hai app tự đặt).

### 6.3. Áp dụng (người có quyền root)

1. Theo mẫu `apply-caddy-prod-root.sh` của CRM: backup → thêm khối → `validate` (container tạm `--network none`) → `reload` graceful → chờ HTTPS → so mã HTTP các site khác → lỗi thì tự khôi phục (CRM `deploy/production/apply-caddy-prod-root.sh`).
2. **Không bao giờ** `docker restart vip-staging-caddy` (phục vụ nhiều site khác). Ghi đè bằng `cp -p` (giữ inode), không `sed -i`.

---

## 7. Bật trên website (PR riêng, sau khi cổng chạy ổn)

Website production đã phát hành 07/11 từ `main` @ `ce289ca` với `portal: null` (WEB `src/data/vi/contact.ts:28-30`; kiểu `src/data/types.ts:96`). Bật link cổng là **một PR riêng**, chỉ sau G5:

```ts
portal: {
  loginUrl: 'https://khachhang.vipgroup.com.vn/tai-khoan/dang-nhap',
  registerUrl: 'https://khachhang.vipgroup.com.vn/tai-khoan/dang-ky',
},
```

1. PR sửa cả test đang khoá `null` (WEB `tests/content.test.mjs:100-106`): kiểm đúng 2 URL và chỉ trang tra cứu hiện khối `data-portal`.
2. Kiểm trên preview: nút hiện, link đúng, sự kiện `portal_login_click` / `portal_register_click`.
3. Merge `main`, chạy workflow production chạy tay với SHA đã duyệt (WEB `docs/PRODUCTION.md:41`).
4. Rollback: Cloudflare Pages → Deployments → bản trước → **Rollback**, hoặc revert PR.

---

## 8. Thứ tự triển khai (runbook đề xuất)

Mỗi cổng **G** là go/no-go; owner ký mới đi tiếp.

### Giai đoạn 0 — Điều kiện trước (không đụng production)

| # | Việc | Ai | Xong khi |
|---|---|---|---|
| P0.1 | Owner chốt quyết định mục 11.2 | Owner | Có văn bản |
| P0.2 | VIP ID: merge `feature/khach-p1` vào `main` (VPS `git pull --ff-only` từ `main`, VIPID `deploy/vps/deploy.sh`); sửa compose cho N1 | Đội VIP ID | Test xanh, rà soát |
| P0.3 | CRM: P1-a (route/nút cấp link), P1-b (`PORTAL_DATABASE_URL` + role trong `db-roles.sql`) hoặc biên bản chấp nhận rủi ro; release chứa cổng; diễn tập `update-prod.sh` `REHEARSAL=1` | Đội CRM | rc 0 khi diễn tập |
| P0.4 | CRM đủ điều kiện mở công khai: admin thứ hai, kênh cảnh báo thật | Owner + CRM | PASS |
| P0.5 | Widget Turnstile production + staging (mục 3) | Owner | Có site key |

**G0:** P0.1–P0.5 xong.

### Giai đoạn 1 — Staging `khachhang-staging.vipgroup.com.vn` (dữ liệu tổng hợp)

| # | Việc |
|---|---|
| S1 | DNS A `khachhang-staging`; khối Caddy như 6.2 trỏ instance staging |
| S2 | CRM staging `STAGING_PORTAL=1 CONFIRM_SYNTHETIC_DATA=1` (CRM runbook §7.1); VIP ID staging với khoá riêng staging; network N1 |
| S3 | **Kiểm đường mạng:** từ container VIP ID gọi được CRM qua `CRM_PORTAL_INTERNAL_URL`, từ container CRM gọi được VIP ID qua `VIPID_PORTAL_URL` (xem audit nhận hai bên). Từ Internet: `curl -X POST https://khachhang-staging…/api/internal/khach/thu-hoi` và `…/api/internal/portal/signups` → **404**. (N2: đo `remote_ip` hairpin từ log Caddy) |
| S4 | E2E đủ ca: đăng ký (có Turnstile) → nhân viên duyệt (cảnh báo trùng SĐT nếu có) → nhận mã VG → đăng nhập bằng SĐT **và** VG → launch → xem kiện / tra mã của khách khác → 404 → khoá/mở khoá → đăng xuất (thu hồi, đăng nhập lại được) → quên mật khẩu: nhân viên cấp link từ CRM (cần P1-a) → đặt lại → phiên cũ bị thu hồi → trần đăng ký 503. Chạy lại bộ E2E website (`tests/portal-e2e`) và kit hợp đồng nhắm staging |
| S5 | Diễn tập rollback: tắt từng cờ, gỡ Caddy, `portal-down.sql` trên DB staging (mục 9) |

**G1:** S1–S5 PASS, bằng chứng trong `docs/evidence/portal-staging/…` (CRM) và `evidence/` (VIP ID).

### Giai đoạn 2 — Production (khung bảo trì báo trước; khoảng 2–3 giờ)

| # | Bước | Lệnh / nội dung | Kiểm | Dừng nếu |
|---|---|---|---|---|
| B1 | Chụp trạng thái container (trước) | `snapshot.sh` của CRM (runbook) | Baseline | Bất thường |
| B2 | **Backup VIP ID** (bắt buộc — là đường lui duy nhất nếu quay mã về trước v6) | `/srv/vip-staging/cowork/deploy/vps/backup.sh` → `BACKUP_OK …`; sao `.env.staging`, `data/*.key` (0600, không rời VPS) | `integrity_check = ok` | Lỗi |
| B3 | Backup CRM (tự động trong `update-prod.sh`, pre-migrate) | — | rc ≠ 4 | rc 4 |
| **G2** | Owner xác nhận backup đọc được | | | |
| C1 | CRM release cổng, `PORTAL_ENABLED=0` | `CONFIRM_HOST=… CONFIRM_UPDATE=I_APPROVE_UPDATE_<rel> CONFIRM_STAGING_PASSED=<rel> STOP_APP_FOR_MIGRATION=1 deploy/production/update-prod.sh viporder-staging <rel>`. Chạy `db-roles.sql` (tạo `crm_portal`, và role LOGIN cổng nếu làm P1-b) rồi migration **660 và 700–706** (CRM `server/migrations/660_core_warehouses.sql` … `706_portal_session_auth_at.sql`) | rc 0, healthy; T7 | rc ≠ 0 theo bảng mã thoát |
| C2 | Secret (mục 4), `PORTAL_HOST`, `PORTAL_PUBLIC_URL`, `VIPID_PORTAL_URL`, `PORTAL_DATABASE_URL`, `PORTAL_ENABLED=1`; tạo lại app | `up -d --no-deps app` | App lên (lỗi cấu hình ⇒ không khởi động). `curl -s -o /dev/null -w '%{http_code}' -H 'Host: khachhang.vipgroup.com.vn' http://127.0.0.1:18185/api/me` → **404** | `PORTAL_ENABLED=0` |
| V1 | VIP ID lên `main` mới, realm **vẫn tắt**; đặt trước `COWORK_STAFF_HOSTS`. **Schema tự nâng lên v6 khi khởi động, có DỰNG LẠI BẢNG `customer_accounts`** (không phải chỉ thêm; VIPID `cowork/schema.py:4`, `cowork/db.py:88-157`). Lỗi nâng cấp ⇒ hoàn tác giao dịch, audit `khach.migration.loi`, realm khách tự tắt, nhân viên vẫn chạy | `./deploy/vps/deploy.sh` | Health 200; nhân viên cowork 200; SSO Brain 200; `curl -H 'Host: x' http://127.0.0.1:8899/api/health` → 421; không có `khach.migration.loi` | Nhân viên lỗi ⇒ khôi phục **mã + DB** từ B2 (mục 9) |
| V2 | Tệp secret, biến mục 5.1, `COWORK_KHACH_ENABLED=1`. **Kiểm bằng container tạm trước** (lỗi khởi động làm sập cả cowork nhân viên) | `docker run --rm --env-file deploy/vps/.env.staging -v $PWD/deploy/vps/data:/data:ro cowork-staging:local python -c "from cowork import khach; khach.kiem_cau_hinh(); print('CAU_HINH_OK')"` | `CAU_HINH_OK` | `Realm khách bị chặn: …` ⇒ sửa, chưa restart |
| V3 | Khởi động lại VIP ID | `docker compose -f deploy/vps/docker-compose.yml up -d` | Healthy; nhân viên OK | `COWORK_KHACH_ENABLED=0`, `up -d` |
| V4 | (Tuỳ chọn) cron dự phòng hàng đợi — vòng nền đã gửi mỗi 5 s | `*/5 * * * * docker exec cowork-staging python -m cowork.cli khach-dong-bo` | `crontab -l` | — |
| **G3** | Owner duyệt mở đường công khai; T1–T7 đủ | | | |
| D1 | DNS A `khachhang` | iNET | `dig` ba resolver | Sai IP |
| K1 | Khối Caddy (6.2) | Script root (6.3) | rc 0; chứng chỉ `CN=khachhang.vipgroup.com.vn` | Script tự khôi phục |
| K2 | Smoke chỉ đọc (8.1) | | Tất cả đúng | Rollback K1 |
| **G4** | Owner duyệt smoke chức năng | | | |
| F1 | Smoke chức năng với tài khoản thật do owner duyệt (8.2) | | PASS | Mục 9 |
| B4 | Chụp trạng thái (sau), so B1 | `impact-diff` | Container khác không đổi | Khác |
| **G5** | Theo dõi 72 giờ (mục 10) | | Không cảnh báo nghiêm trọng | |
| W1 | PR website bật link (mục 7) | | | |
| **G6** | Nghiệm thu | | | |

### 8.1. Smoke test chỉ đọc (K2)

```bash
D=https://khachhang.vipgroup.com.vn
curl -sS -o /dev/null -w 'goc %{http_code} → %{redirect_url}\n' $D/                 # 302 → /tai-khoan/dang-nhap
curl -sS -o /dev/null -w 'login %{http_code}\n'  $D/tai-khoan/dang-nhap               # 200
curl -sSI $D/tai-khoan/dang-nhap | grep -iE '^(strict-transport|content-security|x-frame|referrer|cache-control|server):'
curl -sS -o /dev/null -w 'portal-me %{http_code}\n' $D/portal/api/me                   # 401/403
curl -sS -o /dev/null -w 'launch-rac %{http_code}\n' "$D/portal/auth/launch?token=x"   # 4xx, audit portal.launch denied
for p in / /dang-nhap /api/me /api/health /api/internal/brain/x /api/internal/portal/signups \
         /api/internal/khach/thu-hoi /api/internal/khach/tao-link-dat-lai /admin; do
  curl -sS -o /dev/null -w "$p %{http_code}\n" -X POST "$D$p"; done                   # tất cả 404
curl -sS -o /dev/null -w 'http %{http_code}\n' http://khachhang.vipgroup.com.vn/        # 308 → https
echo | openssl s_client -connect khachhang.vipgroup.com.vn:443 -servername khachhang.vipgroup.com.vn 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
curl -sS -o /dev/null -w 'cowork %{http_code}\n' https://cowork.vipgroup.com.vn/api/health          # 200
curl -sS -o /dev/null -w 'cowork-tk %{http_code}\n' https://cowork.vipgroup.com.vn/tai-khoan/dang-ky # 404
curl -sS -o /dev/null -H 'X-Real-IP: 203.0.113.9' -H 'X-Forwarded-For: 203.0.113.9' $D/tai-khoan/dang-nhap
```

Trên VPS, audit phải ghi IP thật của máy kiểm (không phải 203.0.113.9):
```bash
docker exec cowork-staging python -c "import sqlite3;c=sqlite3.connect('file:/data/cowork.db?mode=ro',uri=True);print(c.execute(\"select action,ip,created_at from audit_log where tenant_id='khach' order by id desc limit 5\").fetchall())"
```

### 8.2. Smoke test chức năng (F1): không dữ liệu giả ở production

Owner yêu cầu không có dữ liệu giả ở production (HĐ A10). Đề xuất **một tài khoản thật** do owner chỉ định (Q5):
- Đăng ký bằng SĐT thật (email tuỳ chọn) qua Turnstile → nhân viên duyệt trên CRM → nhận mã VG → đăng nhập bằng SĐT **và** mã VG → thấy kiện (trống hoặc thật) → tra một mã vận đơn không thuộc mình → **404** → đăng xuất → đăng nhập lại được → nhân viên cấp link đặt lại (P1-a) → đặt lại → phiên cũ bị thu hồi.
- Kiểm hai chiều: duyệt sinh `ket-qua-duyet` (CRM → VIP ID); đăng xuất sinh `thu-hoi` (VIP ID → CRM). Sau đó `crm_sync_pending` và `portal_outbox` không còn mục treo.
- Hệ quả owner chấp nhận: `VG1001` (mã đầu tiên) thuộc tài khoản này, không tái sử dụng; bản ghi tồn tại vĩnh viễn. Không giữ thì **tạm khoá** từ CRM, không xoá.
- Không muốn có tài khoản trước khi mở: chỉ chạy 8.1 và theo dõi trực tiếp khách thật đầu tiên (rủi ro hơn).

---

## 9. Rollback

Nguyên tắc (VIPID `docs/ROLLBACK.md:3`): không xoá dữ liệu thật; tắt bằng cờ trước, gỡ đường vào sau; chỉ khôi phục DB khi hỏng dữ liệu hoặc bắt buộc.

| Lớp | Thao tác | Thời gian | Dữ liệu |
|---|---|---|---|
| Website | Pages → Rollback, hoặc revert PR `contact.portal` → `null` | 1–15 phút | Không |
| **VIP ID realm (cách an toàn)** | `COWORK_KHACH_ENABLED=0` → `docker compose -f deploy/vps/docker-compose.yml up -d` | ~1 phút (nhân viên gián đoạn vài giây) | Bảng khách giữ nguyên; host khách trả 421; khách mất phiên |
| CRM cổng | `PORTAL_ENABLED=0` → `RELEASE=<current> docker compose -p vipcrm6-prod -f ~/vipcrm6-prod/app/deploy/production/compose.yml up -d --no-deps app` | 10–40 s | Không đụng DB |
| Caddy | `cp -p <Caddyfile.bak-…> /srv/vip-staging-proxy/Caddyfile` → `caddy validate` → `caddy reload` | < 2 phút | Không. **Không** restart container |
| DNS | Xoá A `khachhang` (thường không cần) | ~5 phút + TTL | Không |
| **Mã VIP ID** | Quay về commit trước v6 **không** dùng được DB đã nâng v6 (ràng buộc khác) ⇒ phải khôi phục cùng lúc DB từ backup B2 (VIPID `docs/CAU-HINH-TEN-MIEN.md:266-269`, `docs/ROLLBACK.md:84-95`) | ~5 phút | **Mất** mọi ghi của nhân viên sau B2 (phiên, audit, việc). Chỉ dùng khi nhân viên bị ảnh hưởng mà tắt cờ không đủ |
| DB CRM (schema) | `deploy/production/ops/portal-down.sql` (role owner, một giao dịch): đảo ngược **660, 700–706**; từ chối (`DOWN_REFUSED`) khi đã có dữ liệu cổng, XM/YW đã được tham chiếu, hoặc có migration mới hơn 706 (CRM `portal-down.sql:1,18-21,40,57,108`; test PDN-01..03 `tests/api/portal_down.test.js:49,68,85`) | phút | Sau khách thật đầu tiên ⇒ coi như **chỉ tiến**. Role `crm_portal` giữ lại |
| DB CRM (dữ liệu) | `restore-db.sh` (CRM runbook) | 5–15 phút | **Mất** mọi giao dịch CRM sau backup. Phê duyệt riêng; ưu tiên bút toán bù |

Dữ liệu khi rollback: đăng ký chờ vẫn nằm ở `portal_signups` (CRM) và `customer_accounts` (VIP ID); bật lại thì `khach-dong-bo --tat-ca`, outbox CRM tự thử lại. Khách có mã VG giữ mã; báo khách qua hotline/Zalo nếu tắt lâu. Link đặt lại còn hạn sẽ lỗi khi realm tắt.

Kích hoạt rollback: 5xx diện rộng ⇒ gỡ Caddy trước; nghi lộ dữ liệu chéo khách ⇒ `PORTAL_ENABLED=0` **ngay**; nghi lộ bí mật ⇒ tắt hai cờ rồi xoay khoá; nhân viên cowork bị ảnh hưởng ⇒ `COWORK_KHACH_ENABLED=0`. Người quyết định: owner (VIPID `docs/ROLLBACK.md:159`).

---

## 10. Giám sát và cảnh báo

### 10.1. Sự kiện cần theo dõi

**VIP ID** (`audit_log`, `tenant_id='khach'`):

| Sự kiện | Ý nghĩa | Ngưỡng đề xuất |
|---|---|---|
| `khach.canh_bao.dang_ky_tang_dot_bien` | Chạm trần 200 đăng ký/giờ, đang trả 503 (VIPID `cowork/khach.py:605`) | Bất kỳ ⇒ báo ngay |
| `khach.canh_bao.dong_ho` | Mốc thu hồi/launch bị kẹp do lệch đồng hồ (`khach.py:1119`) | Bất kỳ ⇒ kiểm NTP, runbook `khach-dat-lai-moc` (VIPID `docs/CAU-HINH-TEN-MIEN.md:293-302`) |
| `khach.migration.loi` | Nâng cấp schema khách lỗi, realm khách đã tự tắt (`cowork/db.py:110-113`) | Bất kỳ ⇒ báo ngay |
| `khach.canh_bao.do_mat_khau` | Một tài khoản bị dò (`khach.py:781`) | Bất kỳ |
| `khach.dang_nhap.sai`, `.khoa_cap_ip`, `.chan_ip`, `.gioi_han_toan_cuc`, `.thu_thach` | Dò/khoá (`khach.py:737-777`) | > 50/giờ hoặc đột biến |
| `khach.dang_ky.trung`, `khach.dang_ky.xung_dot_sdt` | **Xung đột đăng ký** — SĐT đã có (`khach.py:648,656`) | `xung_dot_sdt` bất kỳ ⇒ nhân viên duyệt cẩn thận |
| `khach.dang_ky.qua_tan_suat`, `khach.quen_mat_khau.qua_tan_suat`, `khach.turnstile.qua_tan_suat` | Chạm giới hạn IP (có thể CGNAT) | Theo dõi tuần đầu |
| `khach.hmac.sai`, `khach.hmac.phat_lai` | HMAC sai/phát lại từ phía "CRM" (`khach_web.py:688`, `khach.py:987`) | Bất kỳ ⇒ báo ngay |
| `khach.tao_link_dat_lai`, `khach.dat_lai_mat_khau`, `khach.duyet`, `khach.tu_choi`, `khach.tam_khoa`, `khach.thu_hoi`, `khach.ops.dat_lai_moc` | Sự kiện quản trị | Ghi nhận; `tao_link_dat_lai` đối chiếu yêu cầu hotline |
| `crm_sync_pending WHERE done_at IS NULL` | VIP ID → CRM chưa gửi được | > 0 quá 30 phút |
| Log: `Gửi CRM … thất bại`, `Turnstile siteverify lỗi`, HTTP 503 hàng đợi băm | `khach.py:1086`, `khach_web.py:204,236` | Lặp lại |

**CRM** (`audit_log` Postgres):

| Sự kiện | Ngưỡng |
|---|---|
| `portal.signup.receive` / `portal.thu_hoi.receive` `outcome='denied'` với `SIGNATURE_INVALID`, `TS_SKEW`, `EVENT_MISMATCH`; `portal.hmac.replay` (CRM `internal.js:163-192`) | Bất kỳ ⇒ báo |
| `portal.signup.receive` `reason='SUBJECT_CONFLICT'`; đăng ký có `phone_conflict` | Ghi nhận, nhân viên xem |
| `portal.launch` `outcome='denied'` (gồm `TOKEN_REVOKED`, `TOKEN_IAT_FUTURE`) (`launch.js:116-132`) | > 30/giờ; `TOKEN_IAT_FUTURE` bất kỳ ⇒ kiểm NTP |
| `portal.parcels.search` theo khách | Đột biến ⇒ nghi dò mã |
| `portal_outbox` treo/failed; `portal.outbox.retry`, **`portal.outbox.abandon`**, `portal.outbox.host_misdirected` | Treo > 30 phút; abandon/host_misdirected bất kỳ ⇒ báo |
| `portal.customer.lock/unlock`, `portal.user.deactivate` | Ghi nhận |

### 10.2. Vị trí log

| Nguồn | Vị trí |
|---|---|
| Caddy host khách | `/data/access-khachhang.log` trong `vip-staging-caddy` |
| VIP ID | `docker logs cowork-staging` (tắt access log). Audit trong `/data/cowork.db`; backup `/srv/vip-staging/cowork-backups` |
| CRM | `docker logs` project `vipcrm6-prod` (json-file 10 MB × 5); audit Postgres; `~/vipcrm6-prod/backups/logs/monitor.log`, `backups/state/ALERTS.log` |

### 10.3. Kênh cảnh báo: chưa có (B5)

CRM có `ops/alert-send.sh` nhưng **PENDING CONFIGURATION** (rc 3, cảnh báo không tới ai, CRM runbook §5). VIP ID chưa có cảnh báo. ĐỀ XUẤT – CHƯA ÁP DỤNG: cron 5 phút đếm sự kiện 10.1 từ lần chạy trước (`docker exec cowork-staging python -c …` và truy vấn chỉ đọc Postgres), gọi chung `alert-send.sh` sau khi kênh đã cấu hình.

---

## 11. Điểm chặn còn mở và quyết định của owner

### 11.1. Điểm chặn

| # | Điểm chặn | Bên xử lý | Chặn |
|---|---|---|---|
| **P1-a** | CRM chưa có route/nút nhân viên "Cấp link đặt lại mật khẩu" (gọi VIP ID `tao-link-dat-lai`). Không có thì khách quên mật khẩu không khôi phục được ở production | CRM, **chờ owner xác nhận trực tiếp** với phiên CRM | Cứng |
| **P1-b** | Cổng CRM chưa dùng `PORTAL_DATABASE_URL` (role LOGIN riêng, chỉ thành viên `crm_portal`); hiện cách ly DB dựa vào kiểm tra trong code | CRM + owner | Cứng, **hoặc** owner ký chấp nhận rủi ro |
| **B3** | Đường mạng VIP ID container ⇄ CRM: `127.0.0.1` không dùng được; CRM chỉ nhận http tới đích nội bộ (tên dịch vụ docker / dải riêng). Cần N1 (mục 1.3) | DevOps + VIP ID (compose) | Cứng |
| **B4** | Chưa phát hành: VIP ID `feature/khach-p1` chưa merge `main`, chưa deploy; CRM production chưa có bản chứa cổng | VIP ID, CRM | Cứng |
| **B5** | Kênh cảnh báo thật (CRM + VIP ID) và admin CRM thứ hai | Owner + CRM | Cứng |
| **B6** | E2E thật: **đạt ở local** (34/0/2, VIP ID `6030e14` + CRM `5007252`; pending FLOW-11b = P1-a, INTEROP-02 chỉ ở mock). **Vẫn bắt buộc chạy trên staging** | Cả hai | Cứng |
| **B7** | Khoá Turnstile production + kiểm sống (đăng ký + đăng nhập bị thử thách) | Owner | Cứng (VIP ID từ chối khởi động) |
| **B8** | DNS A `khachhang` / `khachhang-staging` và khối Caddy (root) | Owner + root | Cứng |
| ~~B1~~ | Email: **không còn chặn** — đã bỏ xác minh; production chỉ đòi kênh thư khi `COWORK_KHACH_EMAIL_ENABLED=1` | — | Đã gỡ |
| ~~B2~~ | Header HMAC lệch: **đã giải quyết**, kit 30/30 + 4/4 | — | Đã gỡ |
| B9 | DMARC chưa có (chỉ cần khi gửi email thật) | Owner | Mềm |

### 11.2. Quyết định owner cần đưa ra

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Định danh đăng nhập: SĐT hay mã VG? Hiện **hỗ trợ cả hai** (VIPID `cowork/khach.py:680`) | Giữ cả hai cho P1; theo dõi dò mật khẩu |
| Q2 | Khách "cũ" có tiếp tục đăng nhập CRM nhân viên không (`STAFF_HOST_ALLOW_LEGACY_CUSTOMERS`, mặc định có)? | Giữ cho tới khi cổng thay thế được (khiếu nại, ticket, POD); đặt `0` khi xong |
| Q3 | P1-a: xác nhận với CRM thêm nút cấp link; P2-c: bỏ tích "đã gọi xác minh SĐT" trên màn duyệt | Xác nhận trực tiếp với phiên CRM |
| Q4 | P1-b: làm role riêng trước khi mở, hay ký chấp nhận rủi ro? | Làm trước khi mở |
| Q5 | Tài khoản smoke production (mục 8.2), chấp nhận mã VG đầu tiên thuộc tài khoản đó? | Có, ghi tên vào biên bản |
| Q6 | Mã kho XM (Hạ Môn) / YW (Nghĩa Ô): owner xác minh mã và dữ liệu vận hành trước khi chuyển khỏi `planned` (HĐ §11.7) | Giữ "Sắp mở" cho P1 |
| Q7 | Đường mạng N1 hay N2 | **N1** |
| Q8 | Khung bảo trì giai đoạn 2 (nhân viên cowork gián đoạn vài giây ở V1, V3; CRM 10–40 s ở C1/C2) | Ngoài giờ, báo trước |
| Q9 | Staging công khai `khachhang-staging` (DNS + Caddy) hay chỉ SSH tunnel? | Công khai, vì Turnstile và chứng chỉ kiểm theo hostname |
| Q10 | Ai giữ quyền root chạy Caddy, ai nhận bàn giao bí mật (không qua chat)? | Owner chỉ định bằng văn bản |

---

*Hết tài liệu. Chưa có bước nào ở trên được áp dụng.*
