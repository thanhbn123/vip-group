# PHƯƠNG ÁN PRODUCTION PILOT: CỔNG KHÁCH HÀNG VIP GROUP P1

Ngày 07/11/2026 (bản cập nhật theo mô hình **bốn tên miền + crm**, `KIEN_TRUC_P1.md` §15, §15.6, §15.7). Website Controller phối hợp CRM Controller và VIP ID Controller. Căn cứ: OWNER DIRECTIVE "GO-LIVE FAST TRACK — PRODUCTION PILOT" và "DOMAIN & COWORK INTEGRATION". Đã gộp phụ lục COWORK → CRM (`vip-group-id/docs/COWORK-CRM-PILOT.md`, nhánh `feature/cowork-crm` @`a41911d`).

**Nguyên tắc.** Mỗi thao tác trên DNS, Caddy, quyền root, database production hay secret chỉ được thực thi khi owner trả lời đúng **câu duyệt** của thao tác đó (cột "Câu duyệt" ở §4). Chỉ thị tổng **không** thay cho các câu duyệt này. Controller không tự nhập khoá bí mật. Mọi khối Caddy trong tài liệu này là **ĐỀ XUẤT – CHƯA ÁP DỤNG**.

## 1. Phạm vi Pilot (đợt A)

- **Địa chỉ:**
  - `https://dangky.vipgroup.com.vn/`: VIP ID, **chỉ** đăng ký và trang "chờ duyệt".
  - `https://dangnhap.vipgroup.com.vn/`: VIP ID, đăng nhập, đăng xuất, hồ sơ, đổi/quên/đặt lại mật khẩu, `vao-cong`.
  - `https://khachhang.vipgroup.com.vn/portal/`: CRM portal (hồ sơ, kiện, tra cứu, 4 kho).
  - `https://cowork.vipgroup.com.vn/`: COWORK nhân viên (đang chạy), thêm module **CRM**.
  - `https://crm.vipgroup.com.vn/`: CRM nhân viên, **chỉ vào qua COWORK** (SSO `cowork-launch/1`).
- **CRM nội bộ:** hệ thống CRM production hiện có, nâng lên bản có module cổng. **Không tạo CRM mới.**
- **Ai dùng được:** chỉ các SĐT trong danh sách Pilot do owner cung cấp. Có **hai lớp chặn độc lập**:
  - VIP ID chặn đăng ký, đăng nhập, vào cổng, cấp link với SĐT ngoài danh sách;
  - CRM chặn vào cổng với subject/mã VG ngoài danh sách (`PILOT_NOT_ALLOWED`).
- **Đăng ký công khai (đợt B):** **chưa mở**. Chỉ mở khi owner xác nhận Pilot đạt.

## 2. Điều kiện bắt buộc trước khi mở Pilot

| # | Điều kiện | Trạng thái | Bằng chứng / việc còn lại |
|---|---|---|---|
| 1 | E2E thật CRM ↔ VIP ID, có khôi phục mật khẩu | ⏳ Đang chạy E2E **nhiều host** (dangky / dangnhap / khachhang) | Lần trước (một host, CRM `5007252` + VIP ID `6030e14`): 34/0/2 |
| 2 | Cách ly dữ liệu khách và đại lý | ✅ Dev (verifier độc lập + E2E SEC-01/02) | Kiểm lại trên staging sau khi lên RC |
| 3 | Không còn P0/P1 bảo mật | ✅ VIP ID: verifier vòng 9 **GO** cho cả `feature/khach-p1` (`a63b430`) và `feature/cowork-crm` (`a41911d`, 329 test PASS) | CRM: kiểm phần thay đổi sau `c78e5af` (§4 P-07) |
| 4 | Role DB riêng cho cổng, quyền tối thiểu, kiểm quyền thực tế | ⏳ CRM đã có `portal-role.sql` + `ops/verify-portal-role.sh` (PASS trên DB dev) | Chạy trên staging → **prod (P-08)** |
| 5 | Backup + xác minh khôi phục + rollback | ⏳ Đã diễn tập: CRM 79/79 trên prod, 83/83 trên staging; G9d rollback | Chạy lại ngay trước Pilot cho CRM (P-07) và VIP ID (P-02) |
| 6 | Proxy, secure cookie, HTTPS, Host, secret chuẩn production | ⏳ Code: VIP ID **từ chối khởi động** khi thiếu `TIN_PROXY=1`, `COOKIE_SECURE=1`, `STAFF_HOSTS`, Turnstile thật, URL https; CRM từ chối khi thiếu `PORTAL_HOST`, URL không https | Cấu hình ở P-03, P-05, P-09 |
| 7 | Đồng bộ giờ máy chủ | ✅ VPS: "System clock synchronized: yes", NTP active (kiểm 07/11) | Kiểm lại ngày triển khai |
| 8 | Turnstile thật, xác thực tại server | ⏳ Code kiểm hostname khớp đúng host đang phục vụ (dangky ≠ dangnhap), action, chặn token rác | Owner tạo widget (P-04), thử thật sau khi lên |
| 9 | Pilot chỉ cho owner và tài khoản được phép | ✅ Code: VIP ID `COWORK_KHACH_PILOT_FILE` (SĐT); CRM `PORTAL_PILOT_FILE` (subject/mã VG) | P-10 nạp danh sách |
| 10 | Tắt nhanh cổng, không ảnh hưởng CRM nội bộ | ✅ Code: VIP ID `COWORK_KHACH_MAINTENANCE_FILE`; CRM `PORTAL_OFF_FILE` (không restart) | Diễn tập bật/tắt **cả hai** trước khi mở (§7) |
| 11 | DNS 5 tên miền | ✅ `dangky`, `dangnhap`, `khachhang`, `cowork`, `crm` đều A → 160.22.170.20 (kiểm 07/11 19:40) | Không cần đổi DNS |
| 12 | TLS cho các tên miền mới | ❌ `dangky`, `dangnhap`, `khachhang`, `crm` lỗi TLS (`tlsv1 alert internal error`): Caddy chưa có khối site. `cowork` ✅ | P-09, P-09b |

## 3. Kiến trúc triển khai trên VPS 160.22.170.20 (hiện trạng đã kiểm chỉ đọc)

```
Internet ─► Caddy (root, /srv/vip-staging-proxy/Caddyfile, container vip-staging-caddy, network host)
  dangky.vipgroup.com.vn    ─► VIP ID 127.0.0.1:8899  realm khách: chỉ /tai-khoan/dang-ky, /tai-khoan/cho-duyet, static
  dangnhap.vipgroup.com.vn  ─► VIP ID 127.0.0.1:8899  realm khách: đăng nhập, tài khoản, mật khẩu, vao-cong
  khachhang.vipgroup.com.vn ─► CRM prod 127.0.0.1:18185  chỉ /portal, /portal/*  ('/' → /portal/, còn lại 404)
  cowork.vipgroup.com.vn    ─► VIP ID 127.0.0.1:8899  realm nhân viên COWORK (đang chạy) + module CRM
  crm.vipgroup.com.vn       ─► CRM prod 127.0.0.1:18185  CRM nhân viên (vào qua COWORK SSO)
  /api/internal/*           ─► 404 trên MỌI host công khai

Mạng docker chung (P-06), KHÔNG qua Caddy, ký HMAC:
  CRM    ─► VIP ID  http://cowork-staging:8899/api/internal/khach/*      Host: dangnhap.vipgroup.com.vn
  VIP ID ─► CRM     http://vipcrm6-prod-app-1:5175/api/internal/portal/*
Trình duyệt: dangnhap ─(launch token 60 s, một lần)─► khachhang/portal/auth/launch
             cowork /crm/mo ─(cowork-launch/1, 60 s, nonce)─► crm/api/auth/cowork/launch
```

- **Ba ứng dụng, năm tên miền.** VIP ID (container `cowork-staging`) chọn realm theo `Host`: dangky/dangnhap là realm khách, `cowork.vipgroup.com.vn` và `127.0.0.1:8899` là realm nhân viên; host khác ⇒ 421. CRM (container `vipcrm6-prod-app-1`) tách host: `PORTAL_HOST` chỉ phục vụ `/portal*`; `/api/internal/portal/*` chỉ nhận ở host **khác** host khách.
- **Cookie host-only** trên từng tên miền (không bao giờ `Domain=.vipgroup.com.vn`): `vg_khach` chỉ ở dangnhap, `vg_portal` chỉ ở khachhang, phiên COWORK chỉ ở cowork, phiên CRM chỉ ở crm.
- **Gọi nội bộ bắt buộc đi qua mạng docker.** VIP ID chỉ nhận `/api/internal/khach/*` trên host dangnhap **và** chỉ khi request **không** mang `X-Forwarded-For`, `X-Real-IP`, `Forwarded`, `Via` (tức không đi qua proxy công khai) — nếu có ⇒ 404. Vì vậy CRM không được gọi VIP ID qua `https://dangnhap…`. Caddy chặn thêm `/api/internal/*` ở mọi site công khai (lớp phòng thủ thứ hai).
- **`tiep` sau đăng nhập** chỉ nhận URL khớp `COWORK_KHACH_TIEP_CHO_PHEP` (`https://khachhang.vipgroup.com.vn/portal`); không khớp ⇒ về `vao-cong` mặc định.
- **VIP ID production chính là container `cowork-staging`, cũng phục vụ COWORK nhân viên.** Mọi bước VIP ID làm theo thứ tự:
  1. backup;
  2. lên bản mới với **cổng khách TẮT**;
  3. kiểm COWORK nhân viên còn bình thường;
  4. mới bật cổng.

## 4. Danh sách thao tác cần OWNER duyệt (theo thứ tự)

| Mã | Thao tác | Ai làm | Thời gian | Câu duyệt owner gửi |
|---|---|---|---|---|
| P-01 | Push lên GitHub `vip-group-id` **theo thứ tự**: (1) `feature/khach-p1` (`a63b430`) rồi mở PR vào `main`; (2) `feature/cowork-crm` (`a41911d`) rồi mở PR vào `main`. `cowork-crm` **chứa** `khach-p1`, nên gộp PR khach-p1 trước, PR cowork-crm sau (sau khi gộp PR 1, PR 2 chỉ còn phần COWORK → CRM). Verifier vòng 9: GO | Website Controller | 10 phút | `DUYỆT P-01 PUSH VIPID` |
| P-02 | Backup DB VIP ID trên VPS (`/srv/vip-staging/cowork/deploy/vps/data/cowork.db` → bản sao có ngày, 0600), kiểm `integrity_check` trên bản sao | Website Controller qua SSH `deploy` | 10 phút | `DUYỆT P-02 BACKUP VIPID` |
| P-03 | Triển khai VIP ID từ **đỉnh `feature/cowork-crm`** (`a41911d`, gồm cả hai nhánh) với `COWORK_KHACH_ENABLED=0`. Kiểm health, đăng nhập nhân viên COWORK, trang `/crm` báo "chưa cấu hình" (chưa có bí mật launch, COWORK vẫn chạy). Schema nâng v6 (rebuild bảng khách; bảng nhân viên không đổi; module/quyền `crm` chỉ thêm vào registry) | Website Controller qua SSH `deploy` | 15 phút, gián đoạn COWORK < 1 phút | `DUYỆT P-03 DEPLOY VIPID` |
| P-04 | Tạo widget **Turnstile riêng cho cổng khách** (Managed) trên Cloudflare, khai **hai hostname** `dangky.vipgroup.com.vn` và `dangnhap.vipgroup.com.vn`. Ghi Site Key + Secret Key vào file 0600 trên VPS (không qua chat) | **Owner** | 10 phút | Owner tự làm, báo "xong P-04" |
| P-05 | Sinh `VIPID_PORTAL_SECRET` trên VPS (`openssl rand -hex 32`, 0600): VIP ID `/data/portal_secret.key`, CRM `~/vipcrm6-prod/secrets/vipid_portal_secret` (**cùng giá trị**). Đặt biến production VIP ID và CRM (§5) | Website Controller + CRM Controller qua SSH | 10 phút | `DUYỆT P-05 SECRET` |
| P-06 | Nối mạng docker: `docker network connect` cho `cowork-staging` vào mạng `edge` của CRM prod (hoặc ngược lại), kiểm hai URL nội bộ ở §5 | CRM Controller qua SSH | 5 phút, không gián đoạn | `DUYỆT P-06 MẠNG` |
| P-07 | CRM: RC mới **≥ `c78e5af` và phải gồm `55da95a`** (link đặt lại chỉ bắt buộc https ở production; tìm khách theo SĐT mọi định dạng; `thu-hoi` nhận reason `rut_pilot`). `main` hiện tại `4f80fd5` đã gồm cả hai. Lên staging, chạy E2E (~1 giờ). Diễn tập G9e update + rollback (~1 giờ). Backup + restore-drill. **update-prod** (15–20 phút, dừng app < 1 phút) với `PORTAL_ENABLED=1`, file Pilot rỗng, `PORTAL_OFF_FILE` có sẵn | CRM Controller | ~2,5 giờ | Theo quy trình CRM: `CONFIRM_STAGING_PASSED`, `I_APPROVE_UPDATE_<rel>` |
| P-08 | CRM: tạo role `vipcrm6_portal` (`portal-role.sql`: LOGIN NOINHERIT, chỉ là thành viên `crm_portal`), đặt `PORTAL_DATABASE_URL`, chạy `ops/verify-portal-role.sh` trên prod | CRM Controller | 15 phút | `DUYỆT P-08 ROLE DB` |
| P-09 | Thêm ba khối Caddy `dangky`, `dangnhap`, `khachhang` (§6.1–6.3), `caddy validate` rồi reload | **Owner hoặc người giữ root** | 15 phút | Người root thực hiện, báo "xong P-09" |
| P-09b | Thêm khối Caddy `crm.vipgroup.com.vn` → CRM prod (§6.4, theo kế hoạch HTTPS của CRM `VIP_CRM_V6_HTTPS_GO_PUBLIC_PLAN.md`) | **Owner hoặc người giữ root** | 10 phút | Người root thực hiện, báo "xong P-09b" |
| P-10 | Nạp danh sách Pilot: SĐT của owner và nhân viên được chỉ định (VIP ID, `cowork.cli khach-pilot add`), mã VG/subject sau khi duyệt (CRM `PORTAL_PILOT_FILE`) | Website + CRM Controller | 5 phút | Owner gửi danh sách SĐT, kèm `DUYỆT P-10 PILOT` |
| P-11 | Mở Pilot: bật `COWORK_KHACH_ENABLED=1` + Pilot, xoá file bảo trì **hai bên**. Smoke bằng **tài khoản thật của owner** (§8.1) | Hai Controller + owner | 20 phút | `DUYỆT P-11 MỞ PILOT` |
| P-12 | Sinh **một** bí mật launch mới: `openssl rand -hex 32`. Ghi vào **tệp 0600 ở cả hai bên**: VIP ID `/data/crm_launch_secret.key`; CRM prod tệp secret riêng, trỏ bằng `COWORK_SHARED_SECRET_FILE` (CRM `52fcdeb`). CRM prod hiện **chưa có** `COWORK_SHARED_SECRET`. Không qua chat hay log. Bí mật này **phải khác** `VIPID_PORTAL_SECRET`. Khởi động lại app CRM (< 1 phút); VIP ID đọc tệp khi phát token, không cần restart | VIP ID + CRM Controller qua SSH | 10 phút | `DUYỆT P-12 SECRET CRM` |
| P-13 | Cấp quyền `crm.view` và `crm.use` trong COWORK: màn **Vai trò** (theo vai trò) hoặc **Phân quyền module** (từng người). Có audit | **Owner** (giao diện COWORK) | 10 phút | Owner tự làm |
| P-14 | Liên kết nhân sự trong CRM: vip_admin đặt `vip_subject = cowork:<ID đăng nhập COWORK>` (màn Nhân sự). Mỗi nhân viên xem mã của mình ở `https://cowork.vipgroup.com.vn/crm`. Smoke §8.2 | vip_admin CRM | 15 phút | Owner chỉ định danh sách |

- **P-09b, P-12…P-14** (nhân viên COWORK → CRM) không phụ thuộc P-10/P-11 và có thể làm song song với Pilot khách, nhưng **chặn** bởi P-09b: chưa có HTTPS ở `crm.vipgroup.com.vn` thì nút "Mở CRM" dẫn tới trang lỗi TLS.

**Lưu ý quyền:**
- User `deploy` thuộc nhóm docker, nên trên thực tế tương đương root. Quy tắc dự án **cấm** dùng quyền này để sửa Caddy: P-09 / P-09b do owner hoặc người giữ root làm.
- `deploy` **không** có sudo.

## 5. Cấu hình production

### 5.1. VIP ID (`cowork-staging`, P-03 / P-05 / P-11 / P-12)

```
COWORK_ENV=production
COWORK_TIN_PROXY=1
COWORK_COOKIE_SECURE=1
COWORK_STAFF_HOSTS=cowork.vipgroup.com.vn,127.0.0.1:8899

# Realm khách — hai tên miền (§15). KHÔNG đặt COWORK_KHACH_HOSTS
# (đặt cả hai kiểu ⇒ production từ chối khởi động, trừ khi COWORK_KHACH_HOSTS_CA_HAI=1)
COWORK_KHACH_ENABLED=0                      # P-03; bật =1 ở P-11
COWORK_KHACH_HOST_DANGKY=dangky.vipgroup.com.vn
COWORK_KHACH_HOST_DANGNHAP=dangnhap.vipgroup.com.vn
COWORK_KHACH_DANGKY_URL=https://dangky.vipgroup.com.vn
COWORK_KHACH_DANGNHAP_URL=https://dangnhap.vipgroup.com.vn
COWORK_KHACH_PUBLIC_URL=https://dangnhap.vipgroup.com.vn      # production bắt buộc https (mặc định là http)
COWORK_KHACH_TIEP_CHO_PHEP=https://khachhang.vipgroup.com.vn/portal
CRM_PORTAL_PUBLIC_URL=https://khachhang.vipgroup.com.vn
CRM_PORTAL_INTERNAL_URL=http://vipcrm6-prod-app-1:5175        # mạng docker chung, xác nhận ở P-06
VIPID_PORTAL_SECRET_FILE=/data/portal_secret.key              # 0600, P-05

# Pilot + tắt nhanh
COWORK_KHACH_PILOT=1                        # production bắt buộc đặt tường minh 0 hoặc 1
COWORK_KHACH_PILOT_FILE=/data/khach_pilot.txt
COWORK_KHACH_MAINTENANCE_FILE=/data/khach_bao_tri.flag

# Turnstile (P-04) + email
COWORK_KHACH_TURNSTILE_SITE_KEY=<P-04>
COWORK_KHACH_TURNSTILE_SECRET_FILE=/data/turnstile_khach.secret   # 0600
COWORK_KHACH_EMAIL_ENABLED=0

# COWORK → CRM nội bộ (§15.6)
COWORK_CRM_ENABLED=1
COWORK_CRM_PUBLIC_URL=https://crm.vipgroup.com.vn
COWORK_CRM_TENANT_MAP=vip-group=VIP
COWORK_CRM_LAUNCH_SECRET_FILE=/data/crm_launch_secret.key     # 0600, P-12
# COWORK_CRM_LAUNCH_TTL mặc định 60 (1..60)
```

- `/data` là `./data` của `/srv/vip-staging/cowork/deploy/vps` (mount trong compose).
- Thiếu bí mật launch, bí mật yếu hoặc trùng bí mật khác: module CRM báo "chưa cấu hình" và không phát token; COWORK vẫn chạy. Bí mật launch **trùng** `VIPID_PORTAL_SECRET`: realm khách **từ chối khởi động**.

### 5.2. CRM prod (`~/vipcrm6-prod/secrets/app.env`, P-05 / P-07 / P-08 / P-12)

```
PORTAL_ENABLED=1                            # P-07 (kèm PORTAL_OFF_FILE có sẵn, Pilot rỗng)
PORTAL_HOST=khachhang.vipgroup.com.vn
PORTAL_PUBLIC_URL=https://khachhang.vipgroup.com.vn
PORTAL_LOGIN_URL=https://dangnhap.vipgroup.com.vn/tai-khoan/dang-nhap
VIPID_PUBLIC_URL=https://dangnhap.vipgroup.com.vn               # link hồ sơ, đổi mật khẩu, đăng xuất
VIPID_PORTAL_URL=http://cowork-staging:8899                     # mạng docker chung (P-06)
VIPID_PORTAL_HOST=dangnhap.vipgroup.com.vn                      # Host khi gọi /api/internal/khach/*
PORTAL_PILOT_FILE=<đường dẫn trong container>/portal_pilot.txt  # subject hoặc mã VG, reload 5 s; thiếu file ⇒ từ chối tất cả
PORTAL_OFF_FILE=<đường dẫn trong container>/portal.off          # có file ⇒ 503 /portal* và /api/internal/portal/*
PORTAL_DATABASE_URL=postgres://vipcrm6_portal:<P-08>@db:5432/vipcrm6_prod
COWORK_SHARED_SECRET_FILE=<đường dẫn tệp 0600, P-12>           # cùng giá trị bí mật launch của VIP ID (CRM 52fcdeb)
# VIPID_PORTAL_SECRET_FILE=/run/secrets/vipid_portal_secret    (đã cố định trong compose.yml, file secrets/vipid_portal_secret)
```

- `update-prod.sh` chỉ tự thêm `PORTAL_ENABLED`, `PORTAL_HOST`, `PORTAL_PUBLIC_URL`, `VIPID_PORTAL_URL` khi thiếu. Các biến còn lại CRM Controller **đặt tay** trong `secrets/app.env`.
- Container CRM `read_only`, compose hiện **chưa** có bind mount cho `PORTAL_PILOT_FILE` / `PORTAL_OFF_FILE`. CRM Controller phải bổ sung mount từ host (để `touch`/`rm` từ host có hiệu lực) và chốt đường dẫn trước P-07.
- Kiểm bắt buộc trước khởi động: CRM từ chối chạy khi `PORTAL_HOST` trống, URL công khai không https, `VIPID_PORTAL_SECRET` < 32 byte hoặc trùng `VIPID_SHARED_SECRET` / bí mật COWORK.

## 6. Khối Caddy (P-09 / P-09b, người giữ root áp dụng)

**ĐỀ XUẤT – CHƯA ÁP DỤNG.** Cách áp dụng an toàn (Caddyfile là bind mount read-only trong container): `vip-group-id/docs/CAU-HINH-TEN-MIEN.md` §4 và §7.1. Luôn backup Caddyfile, `caddy validate` trước `reload`. Không đặt CSP ở Caddy cho dangky/dangnhap/khachhang vì app tự đặt (trang Turnstile cần CSP riêng của VIP ID). Chi tiết thêm: `GOI_TRIEN_KHAI_P1.md` §6.

### 6.1. `dangky.vipgroup.com.vn` (ĐỀ XUẤT – CHƯA ÁP DỤNG)

```
dangky.vipgroup.com.vn {
	encode zstd gzip
	header Strict-Transport-Security "max-age=31536000"
	request_body { max_size 64KB }

	@internal path /api/internal /api/internal/*
	respond @internal 404

	reverse_proxy 127.0.0.1:8899 {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

### 6.2. `dangnhap.vipgroup.com.vn` (ĐỀ XUẤT – CHƯA ÁP DỤNG)

```
dangnhap.vipgroup.com.vn {
	encode zstd gzip
	header Strict-Transport-Security "max-age=31536000"
	request_body { max_size 64KB }

	@internal path /api/internal /api/internal/*
	respond @internal 404

	reverse_proxy 127.0.0.1:8899 {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

- VIP ID tự giới hạn route theo host (dangky chỉ đăng ký/chờ duyệt; còn lại 404) và tự chuyển `/` về form đúng host.
- Khi đi qua Caddy, request luôn mang `X-Forwarded-For`/`X-Real-IP` ⇒ VIP ID trả 404 cho `/api/internal/khach/*` kể cả khi khối `@internal` bị bỏ sót.

### 6.3. `khachhang.vipgroup.com.vn` (ĐỀ XUẤT – CHƯA ÁP DỤNG)

```
khachhang.vipgroup.com.vn {
	encode zstd gzip
	header Strict-Transport-Security "max-age=31536000"
	request_body { max_size 64KB }

	@internal path /api/internal /api/internal/*
	respond @internal 404

	@root path /
	redir @root /portal/ 302

	@portal path /portal /portal/*
	reverse_proxy @portal 127.0.0.1:18185 {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}

	respond 404
}
```

- `/` chuyển ở Caddy (không dựa vào CRM): CRM chỉ tự chuyển `/` → `/portal/` khi cổng bật **và** có `PORTAL_HOST`; nếu cổng tắt mà để `/` đi vào CRM thì giao diện CRM nhân viên sẽ lộ ra host khách.
- Cổng `18185` là cổng loopback của CRM prod theo `deploy/production/compose.yml`; CRM Controller xác nhận lại trên VPS.

### 6.4. `crm.vipgroup.com.vn` (P-09b, ĐỀ XUẤT – CHƯA ÁP DỤNG)

Dùng nguyên khối `vip-group-khoqctq/deploy/production/Caddyfile.prod.snippet` (chặn `/api/dev*`, `request_body 25MB`, HSTS, `X-Frame-Options DENY`, `reverse_proxy 127.0.0.1:18185` có `health_uri /api/health`, log JSON), **thêm** chặn `/api/internal/*`:

```
	@blocked path /api/dev/* /api/dev /api/internal /api/internal/*
	respond @blocked "Not Found" 404
```

- Đã kiểm code CRM: route `/api/internal/*` duy nhất là `/api/internal/portal/signups` và `/api/internal/portal/thu-hoi`, do VIP ID gọi qua mạng docker (`CRM_PORTAL_INTERNAL_URL`). CRM **không** cần `/api/internal/*` từ Internet; đường SSO là `/api/auth/cowork/launch` (không bị chặn).
- Khối `cowork.vipgroup.com.vn` hiện có **giữ nguyên** ở Pilot này. COWORK còn `/api/internal/brain/*` và `/api/internal/hatang/*` (Brain, hạ tầng); trước khi chặn `/api/internal/*` trên cowork phải kiểm các bên gọi này có đi qua host công khai không.

## 7. Tắt nhanh và rollback

**Sự cố ở cổng khách: luôn bật CẢ HAI công tắc.** File bảo trì VIP ID **không** đóng phiên portal CRM đang mở.

| Tình huống | Làm gì | Thời gian | Ảnh hưởng nội bộ |
|---|---|---|---|
| Sự cố bất kỳ ở cổng khách | (1) `touch /srv/vip-staging/cowork/deploy/vps/data/khach_bao_tri.flag` (VIP ID: dangky/dangnhap trả 503 kèm hotline, API nội bộ trả 503 `BAO_TRI`) **và** (2) `touch` file `PORTAL_OFF_FILE` của CRM (khachhang `/portal*` và `/api/internal/portal/*` trả 503). Mở lại: `rm` cả hai | < 1 phút, không restart | Không (COWORK, CRM nhân viên chạy bình thường) |
| Rút một khách khỏi Pilot | `cowork.cli khach-pilot remove <SĐT>` (VIP ID huỷ phiên + gửi `thu-hoi` reason `rut_pilot`) **và** gỡ subject/mã VG khỏi `PORTAL_PILOT_FILE` | < 1 phút | Không |
| Cần tắt hẳn cổng khách | VIP ID `COWORK_KHACH_ENABLED=0` + restart; CRM `PORTAL_ENABLED=0` + recreate (~10 giây) | ~2 phút | COWORK gián đoạn < 1 phút |
| Gỡ cổng khách khỏi Internet | Người root xoá khối Caddy `dangky`, `dangnhap`, `khachhang` rồi reload | 5 phút | Không |
| COWORK → CRM: một người | Bỏ `crm.use` của người đó (Phân quyền module) | Ngay, không restart | Không |
| COWORK → CRM: tất cả | Bỏ `crm.use` khỏi các vai trò (màn Vai trò) | Ngay, không restart | Không |
| COWORK → CRM: cắt kết nối | `COWORK_CRM_ENABLED=0` + restart COWORK; hoặc gỡ `COWORK_SHARED_SECRET_FILE` phía CRM + restart CRM (CRM trả 503 cho launch) | < 1 phút | COWORK hoặc CRM dừng < 1 phút |
| Lỗi CRM sau update | Rollback app về release cũ (đã diễn tập G9d). DB: `ops/portal-down.sql` khi chưa có dữ liệu cổng, hoặc `restore-db.sh` từ backup trước migrate | 15–30 phút | CRM dừng ngắn |
| Lỗi VIP ID sau update | Chạy lại image cũ (`docs/ROLLBACK.md`) + **khôi phục backup P-02** (schema v6 không lùi tại chỗ). Phần COWORK → CRM chỉ bổ sung, không đổi bảng | ~15 phút | COWORK dừng ngắn |

- Thu hồi quyền hoặc khoá tài khoản COWORK **không** huỷ phiên CRM đang mở; phiên tự hết hạn theo `sessionTtlHours`. Muốn chặn ngay: vip_admin khoá user trong CRM. Đồng bộ thu hồi COWORK → CRM để P2.

## 8. URL và tài khoản nghiệm thu thật

- **Khách** bắt đầu ở:
  - `https://dangky.vipgroup.com.vn/` (đăng ký) → trang chờ duyệt;
  - `https://dangnhap.vipgroup.com.vn/` (đăng nhập) → tự chuyển sang `https://khachhang.vipgroup.com.vn/portal/`.
  - Vào thẳng `https://khachhang.vipgroup.com.vn/` khi chưa có phiên → `/portal/` → 302 về dangnhap kèm `tiep=`.
- **Nhân viên:** `https://cowork.vipgroup.com.vn/` → menu **CRM VIP GROUP** → **Mở CRM** → `https://crm.vipgroup.com.vn/` (không đăng nhập lại). Trong CRM, tài khoản admin VIP của owner, mục **"Đăng ký khách (cổng)"**:
  - duyệt để cấp **VG1001**;
  - tab "Đã duyệt" có nút "Cấp link đặt lại mật khẩu" (link luôn trỏ dangnhap).
- Owner đăng ký bằng SĐT thật trong danh sách Pilot, tự đặt mật khẩu. Controller **không** biết mật khẩu.
- **Không tạo dữ liệu giả trên production.** Kiện hàng hiển thị là kiện thật của khách đã duyệt (nếu có).

### 8.1. Smoke P-11 (owner, khoảng 20 phút)

Đăng ký ở dangky → owner tự duyệt trong CRM (vào qua COWORK) → đăng nhập ở dangnhap → tới khachhang `/portal/`, xem kiện → đăng xuất (portal → trang xác nhận ở dangnhap) → kiểm `https://khachhang…/portal/` đòi đăng nhập lại. Diễn tập bật/tắt cả hai công tắc §7.

### 8.2. Smoke sau P-12 / P-13 / P-14 (owner, khoảng 5 phút)

1. Đăng nhập `cowork.vipgroup.com.vn` → menu **CRM VIP GROUP** → **Mở CRM**. Mong đợi: vào CRM đúng tài khoản, không hỏi đăng nhập lại.
2. Bấm Back và mở lại đúng URL launch cũ. Mong đợi: CRM từ chối (`TOKEN_REPLAYED`).
3. Đăng nhập một nhân viên **chưa** được cấp `crm.use`. Mong đợi: không thấy menu; vào thẳng `/crm` thì 403.
4. Nhân viên đã được cấp quyền nhưng **chưa** liên kết `vip_subject`. Mong đợi: CRM báo `SUBJECT_UNKNOWN`.
5. `cowork…/nhat-ky` có dòng `crm.launch` (kèm nonce, không có token). CRM audit có `auth.cowork.launch`.

## 9. Theo dõi và xử lý lỗi trong Pilot

- **Hằng ngày trong 7 ngày đầu,** Controller kiểm (chỉ đọc, qua SSH `deploy`):
  - health hai app;
  - TLS và chứng chỉ của 5 tên miền;
  - audit cảnh báo `khach.canh_bao.*`: dò mật khẩu, đăng ký tăng đột biến, đồng hồ;
  - `khach.migration.loi`, `khach.pilot.loi_tep`;
  - hàng đợi `crm_sync_pending` và CRM `portal_outbox`: lỗi, bị bỏ;
  - HMAC bị từ chối, `TOKEN_*`, `PILOT_NOT_ALLOWED`;
  - `crm.launch` / `auth.cowork.launch`, `TOKEN_REPLAYED`, `SUBJECT_UNKNOWN`;
  - log lỗi 5xx.
- **Owner báo lỗi** qua chat. Quy trình: phân loại P0/P1/P2 → sửa trong development → kiểm thử độc lập → triển khai bản cập nhật có kiểm soát (backup trước) → owner kiểm lại.
- **P0** (lộ dữ liệu, chiếm tài khoản, sai quyền): **tắt cổng ngay** bằng **cả hai** công tắc (§7), báo owner.
- **Không** sửa trực tiếp DB production để thử chức năng.


> Phụ lục COWORK → CRM theo `feature/cowork-crm@0cef75b` (`docs/COWORK-CRM-PILOT.md`). E2E thật COWORK → CRM: **9/9 PASS**, chạy trên CRM local TEST: owner, nhân viên kho, phát lại, chưa liên kết, khách, không quyền, partner, hết hạn, audit không chứa token.
