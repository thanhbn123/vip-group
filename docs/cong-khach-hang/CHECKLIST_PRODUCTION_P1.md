# CHECKLIST PRODUCTION — CỔNG KHÁCH HÀNG P1 + THU LEAD WEBSITE

Ngày 07/11/2026.
- **Chi tiết kỹ thuật và lệnh:** `GOI_TRIEN_KHAI_P1.md` (v0.2).
- **Kết quả nghiệm thu:** `BAO_CAO_NGHIEM_THU_P1.md`.
- **Quy ước:** Controller **không** tự làm thao tác production và **không** nhập khoá bí mật. Cột "Ai làm" ghi người thực hiện.
- **Khoá bí mật** (🔒): không dán vào chat, không gửi qua ticket hay email; nhập thẳng vào nơi lưu.

## A. Thu lead website (đã phát hành website; chỉ còn khoá)

| ☐ | Việc | Ai làm | Ghi chú |
|---|---|---|---|
| ☐ | A–C: Google Sheet + Apps Script, bot Zalo, Turnstile form website | Owner | Đã có `ZALO_NOTIFY_CHAT_ID` (07/11) |
| ☐ | **Bước D:** Cloudflare → Workers & Pages → `vip-group` → Settings → Variables and Secrets. Nhập 5 biến **Secret** cho **Production** và **Preview**: `TURNSTILE_SECRET`, `SHEET_WEBHOOK_URL`, `SHEET_WEBHOOK_SECRET`, `ZALO_BOT_TOKEN`, `ZALO_NOTIFY_CHAT_ID` | Owner 🔒 | `docs/HUONG_DAN_CAI_DAT_THU_LEAD.md` |
| ☐ | Triển khai lại production cùng SHA để nhận biến | Controller (owner đã GO website) | Không đổi nội dung |
| ☐ | Gửi 1 lead **TEST**, kiểm Zalo + Sheet + CRM | Controller + Owner | Xoá dòng TEST sau khi kiểm |

## B. Hạ tầng cổng khách

| ☐ | Việc | Ai làm | Trạng thái |
|---|---|---|---|
| ✅ | DNS `khachhang.vipgroup.com.vn` A → 160.22.170.20 (iNET) | Owner | Đã có (kiểm 07/11) |
| ☐ | DNS `khachhang-staging.vipgroup.com.vn` A → 160.22.170.20 (để chạy thử staging) | Owner | Đề xuất |
| ✅ | Máy chủ đồng bộ giờ (NTP) | — | CRM xác nhận "synchronized: yes" 07/11 |
| ☐ | **Turnstile riêng** cho `khachhang.vipgroup.com.vn` (và staging). Ghi nhận khi tạo: Mode **Managed**; action `khach_dang_ky` và `khach_login` (code kiểm action, không phải cấu hình widget) | Owner 🔒 | Production từ chối khoá thử |
| ☐ | Khối Caddy cho host khách: `/tai-khoan/*` → VIP ID; `/portal*` → CRM; `/api/internal/*` → 404; giữ Host gốc; ghi đè `X-Real-IP` | Người có quyền root | Bản đề xuất: `GOI_TRIEN_KHAI_P1.md` §6 |
| ☐ | Mạng docker chung VIP ID ↔ CRM (gọi nội bộ, không vòng qua Internet) | Người vận hành VPS | Đo tên mạng/alias thật trên VPS |

## C. Cơ sở dữ liệu và cấu hình

| ☐ | Việc | Ai làm |
|---|---|---|
| ☐ | **Backup** DB CRM production + VIP ID (`data/cowork.db`) trước mọi thay đổi; thử khôi phục | Người vận hành |
| ☐ | CRM: tạo **role LOGIN riêng** chỉ là thành viên `crm_portal` → đặt `PORTAL_DATABASE_URL` (P1-b, điều kiện bắt buộc) | Người vận hành 🔒, owner duyệt |
| ☐ | CRM: chạy migration 660 + 700–707 | Người vận hành |
| ☐ | VIP ID: merge `feature/khach-p1` (cần owner cho phép push/merge), nâng schema v6. **Rebuild bảng nên phải có backup** | Controller (khi được phép) + người vận hành |
| ☐ | `VIPID_PORTAL_SECRET`: sinh trên VPS (≥ 32 byte), cùng giá trị cho hai bên, khác mọi secret khác | Người vận hành 🔒 |
| ☐ | Biến VIP ID production (thiếu thì app tự từ chối khởi động): `COWORK_ENV=production`, `COWORK_KHACH_ENABLED=1`, `COWORK_KHACH_HOSTS`, `COWORK_STAFF_HOSTS` (gồm `127.0.0.1:8899` cho healthcheck), `COWORK_TIN_PROXY=1`, `COWORK_COOKIE_SECURE=1`, Turnstile site key + secret, `COWORK_KHACH_EMAIL_ENABLED=0`, `CRM_PORTAL_INTERNAL_URL`, `CRM_PORTAL_PUBLIC_URL` | Người vận hành 🔒 |
| ☐ | Biến CRM production: `PORTAL_ENABLED=1`, `PORTAL_HOST`, `PORTAL_PUBLIC_URL`, `VIPID_PORTAL_URL` (nội bộ), `VIPID_PORTAL_SECRET_FILE`, `PORTAL_DATABASE_URL` | Người vận hành 🔒 |
| ☐ | Thêm **admin CRM thứ hai**; bật cảnh báo vận hành | Owner |

## D. Thứ tự triển khai (mỗi bước có điểm dừng)

1. **Staging** `khachhang-staging` với dữ liệu giả. Chạy E2E (`tests/portal-e2e`). Đạt thì đi tiếp.
2. **Production, cờ tắt:** deploy code, chạy migration, khởi động với `COWORK_KHACH_ENABLED=0` / `PORTAL_ENABLED=0`. Kiểm hệ thống nhân viên vẫn bình thường.
3. **Bật cờ cổng khách.** Smoke bằng **một tài khoản thật do owner chỉ định**, không tạo dữ liệu giả trên production: đăng ký → duyệt → đăng nhập → xem kiện → đăng xuất.
4. **Theo dõi 24 giờ** các cảnh báo: dò mật khẩu, đăng ký tăng đột biến, đồng hồ, hàng đợi gửi lỗi.
5. **Bật nút "Đăng nhập / Đăng ký" trên website** (`contact.portal`) bằng PR riêng, owner GO.

## E. Rollback (ước tính ≤ 15 phút)

| Mức | Làm gì |
|---|---|
| 1, nhanh nhất | Tắt cờ `COWORK_KHACH_ENABLED=0` và `PORTAL_ENABLED=0`, khởi động lại. Nhân viên không bị ảnh hưởng |
| 2 | Gỡ khối Caddy host khách |
| 3 | CRM: `deploy/production/ops/portal-down.sql`. Đảo 660, 700–707; từ chối chạy khi đã có dữ liệu cổng |
| 4 | VIP ID: lùi code về trước v6 → **phải khôi phục backup** DB (schema v6 không lùi tại chỗ) |
| Website | Đặt lại `contact.portal = null` (PR) hoặc chạy lại production workflow với SHA cũ |

## F. Owner chốt trước khi bật

| ☐ | Quyết định |
|---|---|
| ☐ | Tên đăng nhập chính: SĐT, mã VG hay cả hai (hiện nhận cả hai) |
| ☐ | Khách cũ trong CRM còn vào giao diện nhân viên? (`STAFF_HOST_ALLOW_LEGACY_CUSTOMERS`) |
| ☐ | Mã kho XM/YW và dữ liệu vận hành (hiện "Sắp mở") |
| ☐ | Ký chấp nhận rủi ro: không xác minh khi đăng ký; NAT dùng chung có thể bị chặn 1 phút; trần 200 đăng ký/giờ |
| ☐ | Tài khoản thật dùng cho smoke production |
