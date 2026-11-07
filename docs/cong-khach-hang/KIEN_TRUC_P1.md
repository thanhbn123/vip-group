# CỔNG KHÁCH HÀNG VIP GROUP — KIẾN TRÚC P1 (hợp đồng liên hệ thống)

Phiên bản 1.1 · 07/11/2026 (1.1: góp ý phiên CRM — portal_code, chống khoá ác ý, outbox CRM, C0) · Controller: phiên website (vip-group-com-vn).
Căn cứ: OWNER DIRECTIVE — CUSTOMER PORTAL P1 (07/11/2026). **Production NO-GO.** Không đổi DNS, Cloudflare, CRM production hay website thật.

## 1. Quyết định owner → ràng buộc thiết kế

| # | Quyết định | Ràng buộc |
|---|---|---|
| A1/A3 | VIP ID là danh tính tập trung; không dựng hệ danh tính cạnh tranh | Mật khẩu, xác minh, khôi phục và phiên đăng nhập của khách **chỉ ở VIP ID**. CRM **không** lưu mật khẩu khách (`users.password_hash = NULL` với `kind='customer'`) |
| A2 | CRM quản lý khách, mã khách, kiện, vận đơn | Hồ sơ khách, mã VG, kiện và trạng thái **chỉ ở CRM**. VIP ID chỉ giữ liên kết `crm_customer_id` và mã khách để hiển thị |
| A4 | `khachhang.vipgroup.com.vn` | Một host, chia theo đường dẫn (mục 3) |
| A5 | Nhân viên duyệt trước khi cấp mã | Bảng `portal_signups` trong CRM; chỉ khi duyệt mới tạo `customers` và `users` |
| A6 | Mã tự động VG000001 | Sinh trong CRM bằng `SEQUENCE` Postgres; `UNIQUE (tenant_id, code)` đã có |
| A7 | Đăng nhập bằng SĐT **đã xác minh** | Định danh đăng nhập là SĐT chuẩn E.164 (+84…). Chỉ đăng nhập được khi `phone_verified_at` có giá trị (mục 5.2) |
| A8 | Email dùng để kích hoạt và khôi phục; chỉ phát hành khi xác minh và khôi phục đã an toàn | Link một lần đã băm, TTL 30 phút. **Production chặn** cho tới khi có kênh gửi email thật (SMTP hoặc API) và đã kiểm thử |
| A9 | Mật khẩu ≥ 12 ký tự, băm an toàn, chống dò mật khẩu | scrypt (hàm sẵn có của VIP ID: `security.bam_mat_khau`); khoá theo tài khoản và theo IP; dùng hàm băm giả khi tài khoản không tồn tại để không lộ qua thời gian phản hồi |
| A10 | Thêm danh mục kho Hạ Môn, Nghĩa Ô; không dữ liệu giả ở production | CRM migration mở `CHECK` kho thêm `XM`, `YW` (chỉ danh mục). Dữ liệu tổng hợp chỉ có trong seed dev/test |

## 2. Thành phần

```
Trình duyệt khách
   │  https://khachhang.vipgroup.com.vn
   ▼
Caddy (staging: khachhang-staging…; production: CHƯA)
   ├─ /tai-khoan/*  ─► VIP ID (FastAPI, realm KHÁCH)  — đăng ký, xác minh email, đăng nhập, đăng xuất, khôi phục
   └─ /*            ─► CRM portal (Node)              — tổng quan, kiện, tra cứu, 4 kho
                         ▲            │
     launch token (một lần, 60 giây)  │ HMAC server↔server
     VIP ID → CRM                     ▼
                     VIP ID ⇄ CRM: nộp đăng ký, kết quả duyệt, thu hồi phiên
Nhân viên: cowork.vipgroup.com.vn (VIP ID realm NHÂN VIÊN) → CRM nhân viên → màn "Duyệt đăng ký khách"
```

## 3. VIP ID — realm khách (repo `vip-group-id`)

### 3.1. Dữ liệu
Bảng **riêng**, không dùng `users` của nhân viên, nên không thể leo thang sang vai trò nhân viên.

```sql
customer_accounts(
  id TEXT PK,                      -- 'kh_' + 26 ký tự ngẫu nhiên
  subject TEXT UNIQUE NOT NULL,    -- 'cust:' || id  (không thể trùng subject nhân viên)
  phone_e164 TEXT UNIQUE NOT NULL, -- +849xxxxxxxx
  email_norm TEXT UNIQUE NOT NULL, -- chữ thường, đã trim
  display_name TEXT NOT NULL,
  password_hash, password_salt, password_algo='scrypt',
  status TEXT CHECK IN ('cho_xac_minh_email','cho_duyet','hoat_dong','tu_choi','tam_khoa'),
  email_verified_at, phone_verified_at, phone_verified_by,  -- SĐT do nhân viên xác minh khi duyệt (5.2)
  crm_customer_id TEXT, customer_code TEXT,                  -- nhận từ CRM khi duyệt
  token_version INT, failed_attempts INT, locked_until,
  created_at, updated_at, last_login_at)
customer_sessions(id, token_hash UNIQUE, csrf_token, account_id, token_version, created_at, last_seen_at, expires_at, ip, user_agent, status)
customer_tokens(id, token_hash UNIQUE, account_id, purpose IN ('kich_hoat_email','khoi_phuc'), expires_at, used_at, created_at)
customer_login_attempts(id, account_key, ip, success, created_at)
customer_outbox(id, to_email, subject, body_text, created_at, sent_at)  -- dev/staging: KHÔNG gửi thật; production cần kênh thật
```
Ghi nhật ký vào `audit_log` sẵn có (append-only) với `tenant_id='khach'` và `actor_id = subject`.

### 3.2. Route (tiền tố `/tai-khoan`, chỉ phục vụ khi Host là host khách)
| Route | Việc |
|---|---|
| `GET/POST /tai-khoan/dang-ky` | Họ tên, SĐT, email, mật khẩu (≥ 12), đồng ý chính sách, CSRF, giới hạn tần suất theo IP. Phản hồi **giống nhau** dù SĐT/email đã tồn tại (không lộ tài khoản) |
| `GET /tai-khoan/xac-minh-email?t=` | Token một lần → `cho_duyet`, rồi gửi HMAC đăng ký sang CRM |
| `GET/POST /tai-khoan/dang-nhap` | SĐT + mật khẩu. Chỉ khi `hoat_dong` và SĐT đã xác minh. Sau đó phát launch token rồi chuyển sang CRM |
| `POST /tai-khoan/dang-xuat` | Thu hồi phiên VIP ID và gửi HMAC thu hồi sang CRM |
| `GET/POST /tai-khoan/quen-mat-khau` → `/dat-lai?t=` | Link qua email; đặt lại thì tăng `token_version`, thu hồi mọi phiên VIP ID và CRM |
| `POST /api/internal/khach/ket-qua-duyet` | CRM → VIP ID (HMAC): `{subject, decision: approved/rejected, crm_customer_id, customer_code, phone_verified_by}` |
| `POST /api/internal/khach/tam-khoa` | CRM → VIP ID (HMAC): khoá hoặc mở tài khoản |

Cookie `vg_khach` có `Path=/tai-khoan`, `HttpOnly`, `Secure`, `SameSite=Lax`, chỉ host khách. Host khách **từ chối** mọi route nhân viên; host nhân viên **từ chối** `/tai-khoan/*`.

## 4. Hợp đồng VIP ID ⇄ CRM

Bí mật **mới, riêng**: `VIPID_PORTAL_SECRET` (≥ 32 byte). Phải khác `VIPID_SHARED_SECRET` và `COWORK_SHARED_SECRET`; mỗi bên kiểm tra khi khởi động. Nằm ở `secrets/` 0600, không đưa vào chat hay repo.

| Luồng | Chiều | Định dạng |
|---|---|---|
| **Launch** | Trình duyệt: VIP ID → `GET /portal/auth/launch?token=` | HS256 compact `{ver:1, aud:'vip-crm-portal', sub:'cust:…', crm_customer_id, exp ≤ now+60, iat, nonce}`; nonce dùng một lần (bảng `portal_nonces`). CRM kiểm `sub` → `users.vip_subject` (`kind='customer'`, active) → `customers.user_id`, active, khớp `crm_customer_id` |
| **Nộp đăng ký** | VIP ID → CRM `POST /api/internal/portal/signups` | Header `X-Portal-Ts`, `X-Portal-Sig = hex(HMAC(secret, "vipid->crm." + ts + "." + body))`, lệch ±300 giây, `Idempotency-Key` = subject. Body `{subject, display_name, phone_e164, email, province?, warehouse_pref?}` |
| **Kết quả duyệt** | CRM → VIP ID `POST /api/internal/khach/ket-qua-duyet` | `"crm->vipid." + ts + "." + body` |
| **Thu hồi phiên** | Hai chiều `/…/thu-hoi` | `{subject, reason}` → huỷ mọi phiên portal của subject |

Phiên CRM portal: cookie `vg_portal` (host-only, `Path=/`), TTL 2 giờ, kiểm lại `customers.active` và `users.active` ở **mỗi request**.

## 5. CRM (repo `vip-group-khoqctq`, phiên CRM là người ghi duy nhất)

### 5.1. Migration
- `warehouses` CHECK thêm `'XM'` (Hạ Môn, 厦门) và `'YW'` (Nghĩa Ô, 义乌). Seed **danh mục** 4 kho, không có kiện.
- `CREATE SEQUENCE customer_code_seq`. Hàm sinh mã `'VG' || lpad(nextval, 6, '0')`, chỉ gọi khi duyệt.
- `portal_signups(id, subject UNIQUE, display_name, phone_e164, email, status IN ('cho_duyet','da_duyet','tu_choi'), reviewed_by, reviewed_at, reason, customer_id, created_at)`.
- `portal_nonces`, `portal_sessions` (hoặc thêm cột `source='portal'` vào `sessions`).
- Ràng buộc chống trùng danh tính:
  - `UNIQUE (users.vip_subject)` (đã có);
  - `UNIQUE (customers.user_id)` (đã có);
  - unique index trên `customers(phone)` theo SĐT chuẩn hoá cho khách tenant VIP;
  - signup trùng SĐT với khách sẵn có (kể cả khách của đại lý) phải để **nhân viên chọn** "liên kết hồ sơ có sẵn" (có audit) hoặc từ chối. Không bao giờ tự nhận hồ sơ.

### 5.2. Duyệt (màn nhân viên, quyền `vip_admin`, hoặc quyền mới `portal_review` nếu phiên CRM thấy cần)
1. Xem signup.
2. **Gọi xác minh SĐT** (bắt buộc tích "đã gọi xác minh SĐT"; lưu người và thời điểm).
3. Duyệt trong **một giao dịch**: sinh mã VG, tạo `customers` (tenant VIP), tạo `users(kind='customer', vip_subject=subject, password_hash NULL)`, tạo membership `customer`, cập nhật signup, ghi audit.
4. Gửi HMAC kết quả sang VIP ID; có hàng đợi thử lại nếu VIP ID lỗi (idempotent theo subject).

### 5.3. API portal (host khách; mọi truy vấn lọc **trong SQL** theo `customer_id` lấy từ phiên, không bao giờ lấy từ tham số)
| Route | Việc |
|---|---|
| `GET /portal/api/me` | Mã khách, tên, SĐT che bớt |
| `GET /portal/api/parcels?status=&page=` | Dùng lại `myParcels` / `parcelScopeSql` (chỉ `owner_status='verified'`) |
| `GET /portal/api/parcels/search?tracking=` | Khớp chính xác trong phạm vi khách. Không thấy thì trả **404 giống hệt** trường hợp không tồn tại. Giới hạn 30 lần/phút/khách và 60 lần/phút/IP |
| `GET /portal/api/warehouses` | Danh mục 4 kho (địa chỉ là dữ liệu công khai owner đã duyệt) |
| `GET /portal/*` | Giao diện tĩnh responsive, CSP chặt, không inline script |

**Phòng thủ ở tầng DB:** truy vấn portal chạy bằng role Postgres `crm_portal` chỉ có quyền `SELECT` trên view `portal_parcels_v` và bật **RLS**: `customer_id = current_setting('app.customer_id')::uuid`, đặt bằng `SET LOCAL` trong từng giao dịch. Như vậy, nếu tầng API bị lỗi lọc, DB vẫn chặn.

### 5.4. Tách host
- Host khách: chỉ `/portal/*` và `/portal/api/*`, chỉ nhận phiên `kind='customer'`.
- Host nhân viên: từ chối mọi phiên `customer` và mọi route `/portal`.

## 6. Website (repo này)
- Hằng `portalUrl` trong `src/data/vi/contact.ts`, mặc định `null`. Nút "Đăng nhập / Đăng ký" chỉ hiện khi có giá trị.
- Không bật ở production khi owner chưa phê duyệt.

## 7. Phân quyền: ma trận kiểm tra
| Chủ thể | Thấy kiện | Ở đâu kiểm |
|---|---|---|
| Khách K1 | Chỉ kiện `customer_id = K1` và `verified` | API (`parcelScopeSql`) + RLS DB |
| Khách đại lý | Như trên, theo tenant đại lý | Như trên |
| Nhân viên đại lý | Tenant mình và nhánh con được cấp | `perm.js` (có sẵn) |
| Nhân viên kho | Theo kho được cấp | `warehouse_grants` (có sẵn) |
| Phiên khách trên host nhân viên | Không | Middleware Host |

## 8. Chuyển đổi dữ liệu và rollback
- **Khách đang có trong CRM** (có mã cũ, không có tài khoản): **không** tự tạo tài khoản VIP ID. Khách tự đăng ký; nhân viên chọn "liên kết hồ sơ có sẵn", giữ nguyên mã cũ, chỉ khách mới nhận mã VG.
- Migration chỉ **thêm** (thêm bảng, thêm giá trị CHECK, thêm sequence), không sửa hay xoá dữ liệu cũ.
- **Rollback:** tắt cờ `PORTAL_ENABLED` ở VIP ID và CRM, rồi gỡ block Caddy (owner duyệt).
- **Rollback DB:** migration down xoá bảng portal. CHECK kho chỉ được thu hẹp lại khi không còn kiện `XM`/`YW`.
- Backup trước migration theo `restore-db.sh` của CRM.

## 9. Môi trường
- **Dev/test:** VIP ID worktree `~/code/vip-group-id-khach` (nhánh `feature/khach-p1`, cổng 8898, DB riêng `data/khach-dev.db`); CRM do phiên CRM tự chọn.
- **Dữ liệu:** chỉ tổng hợp (SĐT +8490000000x, email `@example.test`).
- **Staging trên VPS** và Caddy cần owner cho phép riêng; mặc định chỉ local.

## 10. Chặn phát hành (biết trước)
1. Kênh gửi email thật (A8). Dev đang dùng outbox.
2. Xác minh SĐT bằng nhân viên gọi điện: owner có muốn OTP SMS/Zalo không? Nếu cần OTP, phải có nhà cung cấp.
3. CRM production vẫn NO-GO PUBLIC (HTTPS, admin thứ hai, kênh cảnh báo).
4. DNS và Caddy cho `khachhang.*` cần owner duyệt.
5. Chưa có dữ liệu WMS cho Hạ Môn và Nghĩa Ô.

## 11. Thay đổi v1.1 (07/11/2026, đã thống nhất với phiên CRM)

1. **Tên đăng nhập.** Chỉ thị owner gửi Controller (A7) ghi "SĐT đã xác minh". Chỉ thị owner gửi phiên CRM (Q-P6) ghi "mã khách làm tên đăng nhập chính". Cách giải: VIP ID **nhận cả hai**, mỗi định danh trỏ duy nhất tới một tài khoản:
   - SĐT E.164 đã xác minh, **hoặc**
   - `portal_code` (VG + 6 số).

   Owner chốt định danh chính ở hồ sơ nghiệm thu.
2. **`portal_code`.** `ket-qua-duyet` và launch token có thêm trường `portal_code` (VGxxxxxx, **unique toàn hệ thống**). CRM đối chiếu thêm `portal_code` với hồ sơ khách.
3. **Khách cũ được liên kết.** Giữ mã nội bộ cũ (chỉ unique theo tenant) và **cấp thêm** `customers.portal_code` loại VG. Thay thế câu "giữ nguyên mã cũ" ở §8.
4. **`portal_outbox` của CRM.** CRM dùng bảng này để thử lại `ket-qua-duyet` và `thu-hoi`, idempotent theo (subject, event).
5. **C0 (CRM).** Đường đăng nhập VIP ID của nhân viên phải **từ chối** `kind='customer'` (`adapters.js:38`). Sửa trước khi có tài khoản khách đầu tiên.
6. **Chống khoá ác ý.** Realm khách không có khoá cứng theo tài khoản từ mọi IP:
   - khoá theo cặp (tài khoản, IP);
   - giới hạn theo IP;
   - trên mọi IP cộng lại, tài khoản chỉ bị làm chậm dần.
7. **Kho.** `warehouses.status='planned'` cho XM/YW, kèm trigger chặn dữ liệu vận hành, **cho tới khi owner xác minh mã kho và dữ liệu vận hành** (chỉ thị owner 07/11).
