# Bộ dữ liệu mẫu (TỔNG HỢP) — cổng khách P1, VIP ID ⇄ CRM

**Chỉ dùng ở dev/test.** Mọi tên, SĐT, email, vận đơn dưới đây là giả. Không nạp vào staging công khai hay production. Không có dữ liệu vận hành nào ở kho Hạ Môn (`XM`) và Nghĩa Ô (`YW`).

Mục tiêu: một bộ dữ liệu chung để phiên CRM, phiên VIP ID và QA cùng chạy cổng khách P1 từ đầu đến cuối:
- đăng ký → xác minh email → duyệt → launch;
- chống xem chéo;
- xung đột SĐT với khách sẵn có của đại lý.

## 1. Quy ước định dạng

| Trường | Quy ước | Ví dụ |
|---|---|---|
| SĐT | E.164 `+8490000000x` (x = 1…9). VIP ID chuẩn hoá mọi dạng nhập (`0900 000 001`, `84900000001`…) về E.164 (`khach.py:389-409`) | `+84900000001` |
| Email | `<tên>@example.test`, chữ thường | `k1@example.test` |
| Họ tên | `Khách Thử K<n>` (có dấu, để thử UTF-8 trong chữ ký) | `Khách Thử K1` |
| Mật khẩu (chỉ VIP ID) | ≥ 12 ký tự, giả | `Khach!Passw0rd-12` |
| subject | do VIP ID sinh: `cust:kh_` + 26 ký tự `[a-z0-9]` (`khach.py:600,608`). **Không** đặt tay | `cust:kh_jejlgbq89md1ir211edsn4mzwm` |
| portal_code | CRM cấp bằng `next_portal_code()` khi duyệt (`700_portal.sql:26-29`). DB dev mới thì lần lượt `VG1001`, `VG1002`… (bỏ qua mã đã có) | `VG1001` |
| Mã vận đơn | `KIT-<KHO>-<KHÁCH>-<NN>`, chỉ chữ hoa, số và gạch ngang, ≤ 32 ký tự. Tiền tố `KIT-` để nhận ra và lọc dữ liệu giả | `KIT-SZ-K1-01` |
| Kho | Chỉ `SZ` (Thâm Quyến) và `GZ` (Quảng Châu). `XM`, `YW` chỉ có dòng danh mục `planned` | — |

### Bảng phân bổ SĐT
| SĐT | Dùng cho |
|---|---|
| `+84900000001` | K1 |
| `+84900000002` | K2 |
| `+84900000003` | K3 (khách cũ của đại lý) và đăng ký mới trùng SĐT |
| `+84900000004` | dự phòng QA |
| `+84900000005` | kịch bản giữ chỗ SĐT trên VIP ID (mục 4.2) |
| `+84900000006`…`+84900000008` | dự phòng |
| `+84900000009` | mặc định của `contract-test.mjs` (mỗi lần chạy tạo một đăng ký `cho_duyet` mới — bảng `portal_signups` không xoá được) |

## 2. Tenant

| Mã | kind | Tên (giả) | Ghi chú |
|---|---|---|---|
| `VIP` | `vip` | VIP GROUP (tổng hợp) | Tenant nhận khách tự đăng ký (`review.js:29-34`, `PORTAL_TENANT_CODE` mặc định `VIP`) |
| `A1` | `agent` | Đại lý A1 (tổng hợp) | Đại lý có khách cũ K3 |

## 3. Khách

| Khách | Tenant | Hồ sơ CRM trước khi thử | Đăng ký VIP ID | Kết quả mong đợi |
|---|---|---|---|---|
| **K1** | VIP | Chưa có | `Khách Thử K1`, `+84900000001`, `k1@example.test` | Nhân viên gọi xác minh rồi **duyệt (approve)**, tạo khách mới `code = portal_code = VG1001`. Đăng nhập được bằng `0900000001` hoặc `VG1001` |
| **K2** | VIP | Chưa có | `Khách Thử K2`, `+84900000002`, `k2@example.test` | Duyệt, nhận `VG1002`. Dùng để thử chống xem chéo với K1 |
| **K3** | **A1** (đại lý) | **Đã có**: `customers(tenant=A1, code='A1-KH-0003', name='Khách Thử K3', phone='0900 000 003', phone_e164=NULL, portal_code=NULL, user_id=NULL, active=true)` | `Khách Thử K3`, `+84900000003`, `k3@example.test` (người thật của hồ sơ A1) | Màn duyệt phải hiện trùng SĐT với `A1-KH-0003` (`findDuplicates`, `review.js:53-68`, so cả `phone` tự do lẫn `phone_e164`). **Approve phải bị chặn** (`409 DUPLICATE_CUSTOMER`, `review.js:132-134`). Nhân viên gọi xác minh, rồi chọn **liên kết (link)** có audit: giữ `code='A1-KH-0003'`, cấp thêm `portal_code=VG1003`, `phone_e164='+84900000003'`. Không bao giờ tự liên kết |

Thứ tự tạo khuyến nghị: K1 → K2 → K3. Như vậy mã VG ứng với số thứ tự, nếu DB dev mới và không có lần duyệt nào bị rollback.

## 4. Kịch bản xung đột SĐT

### 4.1. K3: SĐT trùng khách cũ của đại lý (phía CRM)
1. Seed hồ sơ K3 thuộc A1 như bảng trên (SĐT lưu dạng tự do `0900 000 003`, chưa có `phone_e164`).
2. Trên VIP ID: đăng ký K3 với `0900000003` / `k3@example.test`, rồi xác minh email.
3. VIP ID gửi `POST /api/internal/portal/signups` với `phone_conflict=false` (VIP ID **không biết** hồ sơ CRM).
4. CRM: danh sách chờ duyệt có `duplicates.customers[0].code = 'A1-KH-0003'`, `tenant_code='A1'`, `linkable=true`.
5. Kiểm từng bước:
   - (a) `approve` → 409 `DUPLICATE_CUSTOMER`;
   - (b) `link` khi chưa xác minh SĐT → 409 `PHONE_NOT_VERIFIED`;
   - (c) `link` với `phone_verified=true` → 200. Kết quả: `ket-qua-duyet` approved với `crm_customer_id` = id hồ sơ A1, `portal_code=VG1003`, `customer_code='A1-KH-0003'`;
   - (d) K3 đăng nhập và chỉ thấy kiện của chính hồ sơ A1.

### 4.2. Giữ chỗ SĐT trên VIP ID (cờ `phone_conflict`)
1. "Kẻ giữ chỗ" đăng ký `Khách Thử K5` với `0900000005` / `ke-gia@example.test` và xác minh email. CRM nhận signup subject S5 với `phone_conflict=false`, `Idempotency-Key: signup:S5`.
2. "Chủ thật" đăng ký cùng `0900000005` với `chu-that@example.test`. VIP ID **không tạo** tài khoản mới, mà tăng `phone_conflict_count` của S5. CRM nhận lại signup **cùng subject S5** với `phone_conflict=true`, `phone_conflict_count=1`, `Idempotency-Key: signup:S5:xung-dot-1` (`khach.py:633-643,698-707`).
3. CRM: **cùng một dòng** S5 hiện cờ xung đột, số lần là 1 và được xếp lên đầu danh sách.
4. Nhân viên gọi `+84900000005`. Người nghe máy không xác nhận được email `ke-gia@example.test` ⇒ **từ chối** (lý do: "SĐT không khớp chủ đăng ký").
5. VIP ID giải phóng SĐT và email của S5 (`khach.py:1110-1112`). Chủ thật đăng ký lại ⇒ VIP ID sinh **subject mới S5'**. CRM nhận signup S5' như một đăng ký mới (dòng mới; dòng S5 giữ trạng thái `tu_choi`).
6. Duyệt S5' ⇒ `VG100x` tiếp theo.

Kiểm bằng máy: `contract-test.mjs crm` các dòng C13/C14 (cần `KIT_CRM_ADMIN_TOKEN_FILE`), và ở VIP ID là test `test_p1_3_xung_dot_sdt_bao_crm_va_tu_choi_giai_phong` (`tests/test_khach_p1.py:1000-1038`).

## 5. Kiện (chỉ SZ/GZ)

Mọi kiện: `source_tz='Asia/Shanghai'`, `received_at` trong 30 ngày gần nhất, `package_count=1`, `volume_m3=0.0100`. Cột "thấy trên cổng" là kết quả mong đợi với phiên của chính khách đó.

| tracking_no | Kho | Tenant / khách | owner_status | status | Thấy trên cổng? | Mục đích |
|---|---|---|---|---|---|---|
| `KIT-SZ-K1-01` | SZ | VIP / K1 | verified | in_stock | K1: có | cơ bản |
| `KIT-SZ-K1-02` | SZ | VIP / K1 | verified | manifested | K1: có | trạng thái |
| `KIT-SZ-K1-03` | SZ | VIP / K1 | **pending** | in_stock | **không** (cả K1) | chỉ `verified` (`701_portal_views.sql:5`) |
| `KIT-GZ-K1-01` | GZ | VIP / K1 | verified | shipped | K1: có | kho thứ hai |
| `KIT-GZ-K1-02` | GZ | VIP / K1 | verified | delivered | K1: có | |
| `KIT-SZ-K2-01` | SZ | VIP / K2 | verified | in_stock | K2: có; **K1 tra cứu → 404 giống hệt mã không tồn tại** | chống xem chéo |
| `KIT-GZ-K2-01` | GZ | VIP / K2 | verified | held | K2: có | |
| `KIT-GZ-K2-02` | GZ | VIP / K2 | verified | transferred | K2: có | |
| `KIT-SZ-K3-01` | SZ | **A1** / K3 | verified | in_stock | K3 sau khi link: có; K1/K2: 404 | khách đại lý |
| `KIT-GZ-K3-01` | GZ | **A1** / K3 | verified | shipped | K3: có | |
| `KIT-SZ-K3-02` | SZ | **A1** / K3 | verified | in_stock | K3: có, rồi **biến mất ngay** khi nhân viên `unmatchOwner` | gỡ chủ |
| `KIT-GZ-UNK-01` | GZ | NULL (chưa rõ chủ) | pending | in_stock | không ai thấy; tra cứu → 404 | vùng cách ly |
| `KIT-XX-NONE-01` | — | (không tồn tại) | — | — | 404, **cùng thân và cùng thời gian phản hồi** với `KIT-SZ-K2-01` khi K1 tra cứu | 404 đồng nhất |

**Kho `XM` / `YW`:** không seed kiện, lô WMS, chuyến, phiếu hay bảng giá. Test âm: `INSERT` một kiện `KIT-XM-K1-01` vào kho `XM` khi `planned` phải bị **DB** từ chối (`WAREHOUSE_NOT_ACTIVE`), kể cả khi chạy SQL trực tiếp. `GET /portal/api/warehouses` trả 4 kho, XM/YW ở trạng thái "Sắp mở".

## 6. Thứ tự nạp đề xuất (dev)

1. CRM: migrate (700–703), seed tenant `VIP`, `A1`, nhân viên `vip_admin` giả, hồ sơ K3 (A1).
2. VIP ID: `scripts/khach-dev.sh` trên cổng 8898, `COWORK_KHACH_ENABLED=1`, bí mật dev chung (mục 4 của tài liệu bàn giao).
3. Đăng ký K1, K2, K3 qua `http://khach.localhost:8890/tai-khoan/dang-ky`. Lấy link xác minh trong outbox: `python -m cowork.cli khach-outbox`.
4. Nhân viên CRM duyệt K1, K2 (approve) và K3 (link).
5. Seed kiện ở mục 5 gắn với `customer_id` vừa tạo (K3: id hồ sơ A1 có sẵn).
6. Chạy kịch bản 4.2 với `+84900000005`.
7. `node contract-test.mjs crm` với `KIT_LAUNCH_*` của K1. Chỉ thêm `KIT_DESTRUCTIVE=1` khi dùng khách thử riêng.

## 7. Dọn dẹp
Bảng `portal_signups`, `portal_outbox` và `audit_log` của CRM không cho xoá (trigger). Dữ liệu giả chỉ dọn được bằng cách dựng lại DB dev (`restore-db.sh` hoặc DB mới). Bên VIP ID: xoá `data/khach-dev.db` và `data/khach-dev/` (không đụng `data/cowork.db`).
