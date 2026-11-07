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
| A6 | Mã tự động **VG1001, VG1002…** (owner 07/11, thay VG000001) | CRM sinh khi duyệt: sequence bắt đầu 1001, bỏ qua mã đã tồn tại, UNIQUE toàn cục, cấp đồng thời không trùng (§12) |
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
   - `portal_code` (VG + số ≥ 1001, không đệm 0: VG1001…).

   Owner chốt định danh chính ở hồ sơ nghiệm thu.
2. **`portal_code`.** `ket-qua-duyet` và launch token có thêm trường `portal_code` (VG1001…, **unique toàn hệ thống**). CRM đối chiếu thêm `portal_code` với hồ sơ khách.
3. **Khách cũ được liên kết.** Giữ mã nội bộ cũ (chỉ unique theo tenant) và **cấp thêm** `customers.portal_code` loại VG. Thay thế câu "giữ nguyên mã cũ" ở §8.
4. **`portal_outbox` của CRM.** CRM dùng bảng này để thử lại `ket-qua-duyet` và `thu-hoi`, idempotent theo (subject, event).
5. **C0 (CRM).** Đường đăng nhập VIP ID của nhân viên phải **từ chối** `kind='customer'` (`adapters.js:38`). Sửa trước khi có tài khoản khách đầu tiên.
6. **Chống khoá ác ý.** Realm khách không có khoá cứng theo tài khoản từ mọi IP:
   - khoá theo cặp (tài khoản, IP);
   - giới hạn theo IP;
   - trên mọi IP cộng lại, tài khoản chỉ bị làm chậm dần.
7. **Kho.** `warehouses.status='planned'` cho XM/YW, kèm trigger chặn dữ liệu vận hành, **cho tới khi owner xác minh mã kho và dữ liệu vận hành** (chỉ thị owner 07/11).
8. **HMAC (sau kiểm thử bảo mật độc lập).** Chuỗi ký áp dụng cho mọi lời gọi VIP ID ⇄ CRM:

   ```
   canonical = "<direction>.<METHOD>.<path>.<ts>.<body>"
   ```

   Body tối đa 10 KB; kiểm `Content-Length` trước khi đọc.
9. **Host.** Khi bật realm khách, VIP ID chỉ nhận Host nằm trong danh sách host khách hoặc host nhân viên; host lạ trả 421/404. Caddy phải **giữ nguyên Host gốc**.

## 12. Quy tắc mã khách (owner 07/11/2026, thay quy tắc VG000001)

1. Mã bắt đầu **VG1001**, tăng dần VG1002, VG1003… Không đệm số 0; sau VG9999 là VG10000.
2. Chỉ cấp khi nhân viên **duyệt** hoặc **liên kết**. Đăng ký chờ duyệt hay bị từ chối không giữ mã.
3. **Không trùng:** nếu mã kế tiếp đã tồn tại (ở bất kỳ khách nào, toàn hệ thống), lấy mã hợp lệ chưa dùng kế tiếp theo thứ tự tăng.
4. **Cấp đồng thời:** sequence Postgres + `UNIQUE(portal_code)` toàn cục + thử lại khi xung đột, tất cả trong giao dịch duyệt.
5. **Định dạng chung cho VIP ID ⇄ CRM ⇄ cổng:** `^VG[0-9]{4,9}$`, phần số ≥ 1001, không có số 0 đứng đầu. Khách nhập chữ thường vẫn được nhận; hệ thống lưu chữ hoa.
6. **Kiểm thử bắt buộc:**
   - mã đầu tiên là VG1001;
   - đã có VG1001 và VG1002 thì cấp VG1003;
   - duyệt song song thì các mã khác nhau;
   - VG999, VG01001, VG000001 bị từ chối;
   - đăng nhập bằng `vg1001` được.

## 13. Bỏ bước xác minh (owner 07/11/2026: "bỏ bước xác minh đó chỉ lưu thông tin khách hàng gửi là được" → chọn "Bỏ cả hai")

1. **Không còn xác minh email.** Khách đăng ký xong, tài khoản vào ngay trạng thái `cho_duyet` và VIP ID gửi signup sang CRM. Email là thông tin liên hệ, không bắt buộc.
2. **Không còn gọi xác minh SĐT.** Bước duyệt của nhân viên là cổng duy nhất. Khi duyệt, VIP ID ghi `phone_verified_at` = thời điểm duyệt, với `method = 'duyet_crm'`.
3. **Khôi phục mật khẩu do nhân viên hỗ trợ:**
   - Khách liên hệ hotline/Zalo **0961 102 655**.
   - Nhân viên xác nhận danh tính, rồi bấm "Tạo link đặt lại" trong CRM. CRM gọi VIP ID qua `POST /api/internal/khach/tao-link-dat-lai` (HMAC).
   - Link dùng một lần, hạn 30 phút. Nhân viên gửi cho khách qua Zalo; link không được lưu trong DB hay log.
   - Email reset chỉ bật lại khi có kênh gửi thật (`COWORK_KHACH_EMAIL_ENABLED=1`).
4. **Rủi ro owner chấp nhận:** người khác có thể đăng ký bằng SĐT của khách thật. Biện pháp giảm thiểu:
   - SĐT unique, nên tài khoản thứ hai cùng SĐT không được tạo;
   - cờ `phone_conflict` hiện trên màn duyệt;
   - nhân viên tự cân nhắc trước khi duyệt;
   - đăng ký bị từ chối thì SĐT được giải phóng.
5. **Không cần email thật để lên production.** Điểm chặn A8 được gỡ khi `COWORK_KHACH_EMAIL_ENABLED=0`.

## 14. Mốc thu hồi phiên chính xác đến mili-giây (07/11/2026, CRM 580efe1, VIP ID theo sau)

1. **Body `POST /api/internal/portal/thu-hoi`:**

   ```
   {subject, reason, revoked_at, revoked_at_ms}
   ```

   - `revoked_at_ms`: số nguyên, unix mili-giây, ghi lúc VIP ID thu hồi (không phải lúc gửi).
   - `revoked_at`: giây, giữ để tương thích.
   - `reason`: `dang_xuat` | `dat_lai_mat_khau` | `doi_mat_khau`.
2. **Cách CRM chọn mốc:** ưu tiên `revoked_at_ms`, nếu thiếu thì dùng `revoked_at`, thiếu cả hai thì lấy lúc CRM nhận. Mốc không vượt quá thời điểm hiện tại và chỉ tiến, không lùi. Sai kiểu dữ liệu trả 422 `THU_HOI_INVALID`.
3. **Phạm vi huỷ:** CRM chỉ huỷ phiên portal có `created_at` < mốc. Phiên tạo sau mốc được giữ nên thu-hoi đến trễ qua hàng đợi không huỷ nhầm phiên mới.
4. **Launch token có claim `iat_ms`:**
   - `iat_ms` phải nằm trong giây `iat`, lệch thì CRM trả 401 `TOKEN_CLAIMS`.
   - Thiếu `iat_ms` thì CRM coi là `iat*1000`.
   - `iat_ms` < mốc thì CRM trả 401 `TOKEN_REVOKED`.
5. **Đổi mật khẩu hoặc đặt lại:** VIP ID ghi `revoked_at_ms` **trước** khi tạo phiên hoặc token mới, bảo đảm `iat_ms > revoked_at_ms`.
6. **Thay đổi kèm theo:**
   - Email signup là tuỳ chọn: `null`, thiếu hoặc rỗng đều lưu NULL.
   - `/portal/api/me` trả thêm `email` (string|null) và `agent` ({code,name}|null).
   - CRM có thêm `POST /api/portal/outbox/:id/abandon` cho sự kiện thất bại vĩnh viễn.

## 15. Bốn tên miền chính thức (OWNER DIRECTIVE "DOMAIN & COWORK INTEGRATION", 07/11/2026)

| Tên miền | Ứng dụng | Phục vụ | `/` |
|---|---|---|---|
| `dangky.vipgroup.com.vn` | **VIP ID**, realm khách | Chỉ trang đăng ký và trang "chờ duyệt" | → form đăng ký |
| `dangnhap.vipgroup.com.vn` | **VIP ID**, realm khách | Đăng nhập (SĐT là chính, mã VG phụ), đăng xuất, hồ sơ tài khoản, đổi mật khẩu, quên mật khẩu (hotline), đặt lại (`/dat-lai?t=`), `vao-cong` | → form đăng nhập |
| `khachhang.vipgroup.com.vn` | **CRM** portal | `/portal/*`, `/portal/api/*`, `/portal/auth/launch`. Chưa có phiên → **302 sang dangnhap** kèm `tiep=` | → `/portal/` |
| `cowork.vipgroup.com.vn` | **VIP ID** realm nhân viên (COWORK) | Thêm **module "CRM"** cho nhân viên có quyền: COWORK ký launch token `cowork-launch/1` và chuyển sang CRM nhân viên | (giữ nguyên) |
| `crm.vipgroup.com.vn` | **CRM** nhân viên (đã có trong kế hoạch deploy CRM) | Toàn bộ CRM nội bộ. **Chỉ vào qua COWORK** (SSO); khách bị từ chối (C0) | (CRM) |

**Quy tắc chung**
1. **Cookie host-only cho từng tên miền.** Không bao giờ đặt `Domain=.vipgroup.com.vn`. Phiên VIP ID khách (`vg_khach`) chỉ ở dangnhap; phiên portal (`vg_portal`) chỉ ở khachhang; phiên COWORK chỉ ở cowork; phiên CRM chỉ ở crm.
2. **Chuyển hướng sau đăng nhập.** Tham số `tiep` chỉ chấp nhận URL tuyệt đối `https://khachhang.vipgroup.com.vn/portal…`, khớp danh sách cấu hình `COWORK_KHACH_TIEP_CHO_PHEP`. Không khớp thì bỏ qua và về `vao-cong`. Mọi đường về khachhang đều đi qua launch token một lần (60 giây, nonce, aud `vip-crm-portal`).
3. **Gọi nội bộ CRM ↔ VIP ID** đi qua mạng docker. CRM gửi `Host: dangnhap.vipgroup.com.vn` (biến mới phía CRM: `VIPID_PORTAL_HOST`) khi gọi `/api/internal/khach/*`. VIP ID gửi Host phù hợp CRM. `/api/internal/*` trả **404 trên mọi tên miền công khai**.
4. **CSRF.** Form VIP ID post cùng origin (dangky→dangky, dangnhap→dangnhap). Portal gọi API cùng origin khachhang. Đăng xuất từ portal: `POST /portal/api/logout` rồi chuyển `https://dangnhap…/tai-khoan/dang-xuat` (trang xác nhận + POST có CSRF).
5. **Turnstile.** Widget riêng cho `dangky` và `dangnhap` (hostname kiểm tại server).
6. **COWORK → CRM.**
   - Module `crm`: quyền `crm.view` (thấy module) và `crm.use` (mở CRM). Vai trò dưới nhân viên (partner) bị từ chối ở backend.
   - COWORK ký `{ver:1, aud:'vip-crm', sub:<id nhân viên COWORK>, tenant_code, iat, exp≤60s, nonce}` bằng `COWORK_SHARED_SECRET` rồi chuyển hướng `https://crm.vipgroup.com.vn/api/auth/cowork/launch?token=`.
   - CRM ánh xạ `sub` → `users.vip_subject` (`kind='staff'`).
   - Nhân viên CRM phải được admin liên kết `vip_subject` trước.
7. **DNS cần thêm:** `dangky`, `dangnhap` (A → 160.22.170.20). `khachhang` đã có. `crm`: kiểm.

### 15.6. Đã chốt giữa ba Controller (CRM, VIP ID, Website)

**COWORK → CRM**
- Định dạng: `cowork-launch/1`, **giữ nguyên JWT HS256 compact mà CRM đang kiểm** (`server/modules/adapters/tokens.js`). Không thêm claim.
- Payload:

  ```
  {ver:1, aud:'vip-crm', sub:'cowork:<users.id COWORK — ID đăng nhập bất biến, vd cowork:anh-thanh>', tenant_code:'VIP', iat, exp:iat+60, nonce:uuid4}
  ```

- Bí mật: một giá trị **riêng** dùng chung hai bên.
  - Ở VIP ID: biến `COWORK_CRM_LAUNCH_SECRET`.
  - Ở CRM: biến `COWORK_SHARED_SECRET`.
- Kiểm tra phía CRM: CRM kiểm nonce dùng một lần. Phía COWORK có route `GET /crm/mo` → 303 tới `https://crm.vipgroup.com.vn/api/auth/cowork/launch?token=`.
- Tenant: `tenant_code` lấy qua `COWORK_CRM_TENANT_MAP`, mặc định `vip-group → VIP`.

**CRM (khachhang)**
- `/` → 302 `/portal/`.
- Trang HTML `/portal/*` khi chưa có phiên → 302 tới `PORTAL_LOGIN_URL?tiep=<URL khachhang>`. `tiep` chỉ dựng từ `PORTAL_PUBLIC_URL` + path, không lấy từ Host.
- API `/portal/api/*` khi chưa có phiên → 401 JSON.
- Biến mới:
  - `PORTAL_LOGIN_URL`
  - `VIPID_PUBLIC_URL` (link hồ sơ, đổi mật khẩu, đăng xuất)
  - `VIPID_PORTAL_HOST` (Host khi gọi `/api/internal/khach/*`)
- `GET /portal/api/config` (công khai, no-store) trả `{login_url, account_url, change_password_url, logout_url}`. Web-portal đọc endpoint này.

**Pilot và tắt nhanh**
- CRM:
  - `PORTAL_PILOT_FILE`: subject hoặc mã VG, reload 5 giây. Không có trong danh sách → 401 `PILOT_NOT_ALLOWED`. Thiếu file thì từ chối tất cả.
  - `PORTAL_OFF_FILE`: 503 cho `/portal*` và `/api/internal/portal/*`, cache 2 giây.
- VIP ID:
  - `COWORK_KHACH_PILOT_FILE`: SĐT.
  - `COWORK_KHACH_MAINTENANCE_FILE`.

**DNS** (kiểm 07/11): `dangky`, `dangnhap`, `khachhang`, `crm`, `cowork` đều A → 160.22.170.20.

### 15.7. Bổ sung sau vòng kiểm tra độc lập 9 (07/11/2026)
- **Reason thu hồi mới: `rut_pilot`.** VIP ID gửi `rut_pilot` khi SĐT bị gỡ khỏi danh sách Pilot. Lúc gỡ, VIP ID huỷ phiên của tài khoản đó và gửi `thu-hoi` (có `revoked_at_ms`) sang CRM. CRM phải chấp nhận reason này.
- **Tắt nhanh khi có sự cố: bật CẢ HAI công tắc.**
  - File bảo trì VIP ID (`COWORK_KHACH_MAINTENANCE_FILE`) **không** đóng phiên portal CRM đang mở.
  - Phải bật thêm `PORTAL_OFF_FILE` phía CRM.
- **VIP ID nhánh khách:** `feature/khach-p1` @`a63b430`.
- **VIP ID nhánh COWORK → CRM:** `feature/cowork-crm` (gộp sau `khach-p1`). Nhánh này giữ phần kiểm chéo: `VIPID_PORTAL_SECRET` phải khác `COWORK_CRM_LAUNCH_SECRET`.
