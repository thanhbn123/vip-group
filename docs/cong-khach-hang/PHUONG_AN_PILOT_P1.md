# PHƯƠNG ÁN PRODUCTION PILOT: CỔNG KHÁCH HÀNG VIP GROUP P1

Ngày 07/11/2026. Website Controller phối hợp CRM Controller. Căn cứ: OWNER DIRECTIVE "GO-LIVE FAST TRACK — PRODUCTION PILOT".

**Nguyên tắc.** Mỗi thao tác trên DNS, Caddy, quyền root, database production hay secret chỉ được thực thi khi owner trả lời đúng **câu duyệt** của thao tác đó (cột "Câu duyệt" ở §4). Chỉ thị tổng **không** thay cho các câu duyệt này. Controller không tự nhập khoá bí mật.

## 1. Phạm vi Pilot (đợt A)

- **Địa chỉ:**
  - `https://khachhang.vipgroup.com.vn/tai-khoan/dang-nhap`: VIP ID (đăng ký, đăng nhập, mật khẩu).
  - `https://khachhang.vipgroup.com.vn/portal/`: CRM portal (hồ sơ, kiện, tra cứu, 4 kho).
- **CRM nội bộ:** hệ thống CRM production hiện có, nâng lên bản có module cổng. **Không tạo CRM mới.**
- **Ai dùng được:** chỉ các SĐT trong danh sách Pilot do owner cung cấp. Có **hai lớp chặn độc lập**:
  - VIP ID chặn đăng ký, đăng nhập, cấp link với SĐT ngoài danh sách;
  - CRM chặn vào cổng với khách ngoài danh sách.
- **Đăng ký công khai (đợt B):** **chưa mở**. Chỉ mở khi owner xác nhận Pilot đạt.

## 2. Điều kiện bắt buộc trước khi mở Pilot

| # | Điều kiện | Trạng thái | Bằng chứng / việc còn lại |
|---|---|---|---|
| 1 | E2E thật CRM ↔ VIP ID, có khôi phục mật khẩu | ⏳ Đang chạy trên CRM `d5666fc` + VIP ID `ab940df` | Lần trước trên `5007252` + `6030e14`: 34/0/2. Lần này có thêm FLOW-11b (nhân viên cấp link) |
| 2 | Cách ly dữ liệu khách và đại lý | ✅ Dev (verifier độc lập cuối + E2E SEC-01/02) | Kiểm lại trên staging sau khi lên RC |
| 3 | Không còn P0/P1 bảo mật | ⏳ Verifier đang kiểm phần thay đổi `d5666fc` / `ab940df` | P1-b chuyển thành điều kiện 4 |
| 4 | Role DB riêng cho cổng, quyền tối thiểu, kiểm quyền thực tế | ⏳ CRM đang viết `portal-role.sql` + `verify-portal-role.sh` | Chạy trên staging → **prod (P-08)** |
| 5 | Backup + xác minh khôi phục + rollback | ⏳ Đã diễn tập: CRM 79/79 trên prod, 83/83 trên staging; G9d rollback | Chạy lại ngay trước Pilot cho cả CRM (P-07) và VIP ID (P-02) |
| 6 | Proxy, secure cookie, HTTPS, Host, secret chuẩn production | ⏳ Code đã có: VIP ID **từ chối khởi động** khi thiếu `TIN_PROXY=1`, `COOKIE_SECURE=1`, `STAFF_HOSTS`, Turnstile thật, https | Cấu hình ở P-03, P-05, P-09 |
| 7 | Đồng bộ giờ máy chủ | ✅ VPS: "System clock synchronized: yes", NTP active (kiểm 07/11) | Kiểm lại ngày triển khai |
| 8 | Turnstile thật, xác thực tại server | ⏳ Code đã kiểm server-side (hostname, action, chặn token rác) | Owner tạo widget (P-04), thử thật sau khi lên |
| 9 | Pilot chỉ cho owner và tài khoản được phép | ⏳ Đang code: VIP ID allowlist SĐT; CRM allowlist subject/mã VG | P-10 nạp danh sách |
| 10 | Tắt nhanh cổng, không ảnh hưởng CRM nội bộ | ⏳ Đang code: VIP ID file bảo trì; CRM file `portal.off` (không restart) | Diễn tập bật/tắt trước khi mở |

## 3. Kiến trúc triển khai trên VPS 160.22.170.20 (hiện trạng đã kiểm chỉ đọc)

```
Internet ─► Caddy (root, /srv/vip-staging-proxy/Caddyfile)
              khachhang.vipgroup.com.vn
                ├─ /tai-khoan/*     ─► VIP ID  (container cowork-staging, 127.0.0.1:8899 — cũng là COWORK nhân viên)
                ├─ /portal, /portal/* ─► CRM prod (container vipcrm6-prod-app-1)
                ├─ /api/internal/*  ─► 404   (không công khai)
                └─ còn lại          ─► 404
VIP ID ⇄ CRM: gọi nội bộ qua mạng docker chung (P-06), ký HMAC, không ra Internet
```

- **DNS:** `khachhang.vipgroup.com.vn` A → 160.22.170.20 **đã có** (owner tạo, kiểm 07/11). Caddy tự cấp chứng chỉ HTTPS khi có khối site.
- **VIP ID production chính là container `cowork-staging`, cũng phục vụ COWORK nhân viên.** Vì vậy mọi bước VIP ID đều làm theo thứ tự:
  1. backup;
  2. lên bản mới với **cổng khách TẮT**;
  3. kiểm COWORK nhân viên còn bình thường;
  4. mới bật cổng.

## 4. Danh sách thao tác cần OWNER duyệt (theo thứ tự)

| Mã | Thao tác | Ai làm | Thời gian | Câu duyệt owner gửi |
|---|---|---|---|---|
| P-01 | Push nhánh VIP ID `feature/khach-p1` lên GitHub `vip-group-id`, mở PR vào `main` (code đã kiểm 230 test + 8 vòng verifier) | Website Controller | 10 phút | `DUYỆT P-01 PUSH VIPID` |
| P-02 | Backup DB VIP ID trên VPS (`/srv/vip-staging/cowork/deploy/vps/data/cowork.db` → bản sao có ngày, 0600), kiểm `integrity_check` trên bản sao | Website Controller qua SSH `deploy` | 10 phút | `DUYỆT P-02 BACKUP VIPID` |
| P-03 | Triển khai VIP ID bản mới với `COWORK_KHACH_ENABLED=0`. Kiểm health, đăng nhập nhân viên COWORK. Schema nâng v6 (rebuild bảng khách; bảng nhân viên không đổi) | Website Controller qua SSH `deploy` | 15 phút, gián đoạn COWORK < 1 phút | `DUYỆT P-03 DEPLOY VIPID` |
| P-04 | Tạo widget **Turnstile riêng** cho `khachhang.vipgroup.com.vn` (Managed) trên Cloudflare, ghi Site Key + Secret Key vào file 0600 trên VPS (không qua chat) | **Owner** | 10 phút | Owner tự làm, báo "xong P-04" |
| P-05 | Sinh `VIPID_PORTAL_SECRET` trên VPS (`openssl rand`, ≥ 32 byte, 0600) dùng chung cho VIP ID và CRM. Đặt biến production VIP ID (§5) | Website Controller + CRM Controller qua SSH | 10 phút | `DUYỆT P-05 SECRET` |
| P-06 | Nối mạng docker: `docker network connect` cho `cowork-staging` vào mạng của CRM prod (hoặc ngược lại), đặt URL nội bộ hai chiều | CRM Controller qua SSH | 5 phút, không gián đoạn | `DUYỆT P-06 MẠNG` |
| P-07 | CRM: RC mới (≥ `d5666fc`) lên staging, chạy E2E (~1 giờ). Diễn tập G9e update + rollback (~1 giờ). Backup + restore-drill. **update-prod** (15–20 phút, dừng app < 1 phút) với `PORTAL_ENABLED=1`, allowlist rỗng, `portal.off` có sẵn | CRM Controller | ~2,5 giờ | Theo quy trình CRM: `CONFIRM_STAGING_PASSED`, `I_APPROVE_UPDATE_<rel>` |
| P-08 | CRM: tạo role `vipcrm6_portal` (LOGIN NOINHERIT, chỉ là thành viên `crm_portal`), đặt `PORTAL_DATABASE_URL`, chạy `verify-portal-role.sh` trên prod | CRM Controller | 15 phút | `DUYỆT P-08 ROLE DB` |
| P-09 | Thêm khối Caddy cho `khachhang.vipgroup.com.vn` (bản ở §6), `caddy validate` rồi reload | **Owner hoặc người giữ root** | 10 phút | Người root thực hiện, báo "xong P-09" |
| P-10 | Nạp danh sách Pilot: SĐT của owner và nhân viên được chỉ định (VIP ID), mã VG/subject sau khi duyệt (CRM) | Website + CRM Controller | 5 phút | Owner gửi danh sách SĐT, kèm `DUYỆT P-10 PILOT` |
| P-11 | Mở Pilot: bật `COWORK_KHACH_ENABLED=1` + Pilot, xoá file bảo trì hai bên. Smoke bằng **tài khoản thật của owner**: đăng ký → owner tự duyệt trong CRM → đăng nhập → xem kiện → đăng xuất | Hai Controller + owner | 20 phút | `DUYỆT P-11 MỞ PILOT` |

**Lưu ý quyền:**
- User `deploy` thuộc nhóm docker, nên trên thực tế tương đương root. Quy tắc dự án **cấm** dùng quyền này để sửa Caddy: P-09 do owner hoặc người giữ root làm.
- `deploy` **không** có sudo.

## 5. Cấu hình production VIP ID (P-03 / P-05 / P-11)

```
COWORK_ENV=production
COWORK_KHACH_ENABLED=0            # P-03; bật =1 ở P-11
COWORK_KHACH_PILOT=1
COWORK_KHACH_PILOT_FILE=/data/khach_pilot_phones.txt
COWORK_KHACH_MAINTENANCE_FILE=/data/khach.off
COWORK_KHACH_HOSTS=khachhang.vipgroup.com.vn
COWORK_STAFF_HOSTS=cowork.vipgroup.com.vn,127.0.0.1:8899
COWORK_KHACH_PUBLIC_URL=https://khachhang.vipgroup.com.vn
CRM_PORTAL_PUBLIC_URL=https://khachhang.vipgroup.com.vn
CRM_PORTAL_INTERNAL_URL=http://<tên dịch vụ CRM trên mạng chung>:<cổng>   # đo ở P-06
COWORK_TIN_PROXY=1
COWORK_COOKIE_SECURE=1
COWORK_KHACH_EMAIL_ENABLED=0
COWORK_KHACH_TURNSTILE_SITE_KEY=<P-04>
COWORK_KHACH_TURNSTILE_SECRET_FILE=/data/turnstile_khach.secret       # 0600
VIPID_PORTAL_SECRET_FILE=/data/portal_secret.key                     # 0600, P-05
```

- **Phía CRM:** `PORTAL_ENABLED=1`, `PORTAL_HOST=khachhang.vipgroup.com.vn`, `PORTAL_PUBLIC_URL`, `VIPID_PORTAL_URL=http://cowork-staging:8899`, `VIPID_PORTAL_SECRET_FILE`, `PORTAL_DATABASE_URL`, cùng allowlist và `portal.off`.
- **Kiểm bắt buộc trước khi khởi động:**
  - `COWORK_STAFF_HOSTS` phải chứa host thật của COWORK;
  - VIP ID gọi `/api/internal/khach/*` của chính mình theo Host khách.

## 6. Khối Caddy đề xuất (P-09, người giữ root áp dụng)

```
khachhang.vipgroup.com.vn {
	encode zstd gzip
	header Strict-Transport-Security "max-age=31536000"
	request_body { max_size 64KB }

	@internal path /api/internal/*
	respond @internal 404

	@vipid path /tai-khoan /tai-khoan/*
	reverse_proxy @vipid 127.0.0.1:8899 {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}

	@portal path /portal /portal/*
	reverse_proxy @portal 127.0.0.1:<cổng CRM prod> {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}

	@root path /
	redir @root /tai-khoan/dang-nhap 302

	respond 404
}
```

- Cổng CRM prod lấy theo hiện trạng compose CRM; CRM Controller đo và điền.
- Không đặt CSP ở Caddy, vì hai app tự đặt.
- `caddy validate` trước khi `reload`.
- Chi tiết thêm: `GOI_TRIEN_KHAI_P1.md` §6.

## 7. Tắt nhanh và rollback

| Tình huống | Làm gì | Thời gian | Ảnh hưởng nội bộ |
|---|---|---|---|
| Sự cố bất kỳ ở cổng | `touch` file bảo trì VIP ID (`/data/khach.off`) **và** CRM (`~/vipcrm6-prod/portal.off`). Cả host khách trả 503 trang hotline | < 1 phút, không restart | Không |
| Cần tắt hẳn | VIP ID `COWORK_KHACH_ENABLED=0` + restart; CRM `PORTAL_ENABLED=0` + recreate (~10 giây) | ~2 phút | COWORK gián đoạn < 1 phút |
| Gỡ khỏi Internet | Người root xoá khối Caddy `khachhang` rồi reload | 5 phút | Không |
| Lỗi CRM sau update | Rollback app về release cũ (đã diễn tập G9d). DB: `portal-down.sql` khi chưa có dữ liệu cổng, hoặc `restore-db.sh` từ backup trước migrate | 15–30 phút | CRM dừng ngắn |
| Lỗi VIP ID sau update | Chạy lại image cũ + **khôi phục backup P-02** (schema v6 không lùi tại chỗ) | ~15 phút | COWORK dừng ngắn |

## 8. URL và tài khoản nghiệm thu thật

- **Khách:** `https://khachhang.vipgroup.com.vn/tai-khoan/dang-ky`. Owner đăng ký bằng SĐT thật trong danh sách Pilot, tự đặt mật khẩu. Controller **không** biết mật khẩu.
- **Nhân viên:** CRM production hiện có, tài khoản admin VIP của owner, mục **"Đăng ký khách (cổng)"**:
  - duyệt để cấp **VG1001**;
  - tab "Đã duyệt" có nút "Cấp link đặt lại mật khẩu".
- **Không tạo dữ liệu giả trên production.** Kiện hàng hiển thị là kiện thật của khách đã duyệt (nếu có).

## 9. Theo dõi và xử lý lỗi trong Pilot

- **Hằng ngày trong 7 ngày đầu,** Controller kiểm (chỉ đọc, qua SSH `deploy`):
  - health hai app;
  - audit cảnh báo `khach.canh_bao.*`: dò mật khẩu, đăng ký tăng đột biến, đồng hồ;
  - `khach.migration.loi`;
  - hàng đợi `crm_sync_pending` và CRM `portal_outbox`: lỗi, bị bỏ;
  - HMAC bị từ chối, `TOKEN_*`;
  - log lỗi 5xx.
- **Owner báo lỗi** qua chat. Quy trình: phân loại P0/P1/P2 → sửa trong development → kiểm thử độc lập → triển khai bản cập nhật có kiểm soát (backup trước) → owner kiểm lại.
- **P0** (lộ dữ liệu, chiếm tài khoản, sai quyền): **tắt cổng ngay** bằng file bảo trì, báo owner.
- **Không** sửa trực tiếp DB production để thử chức năng.
