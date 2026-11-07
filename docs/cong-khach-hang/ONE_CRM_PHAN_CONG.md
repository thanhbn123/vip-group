# ONE VIP GROUP CRM: phân công module và hợp đồng API cổng khách (đề xuất, Website Controller)

Căn cứ: **OWNER MASTER DIRECTIVE — ONE VIP GROUP CRM** (07/11/2026).
Nguyên tắc: **ONE CRM — ONE CUSTOMER DATA SOURCE — MULTIPLE INTERFACES**. Production vẫn NO-GO PUBLIC.

## 1. Hiện trạng đối chiếu nguyên tắc (07/11/2026)

| Nguyên tắc | Hiện trạng | Kết luận |
|---|---|---|
| Một nguồn dữ liệu khách | Hồ sơ khách, mã VG, kiện, vận đơn, đại lý và duyệt đăng ký **chỉ nằm trong CRM** (Postgres). VIP ID chỉ giữ danh tính (SĐT, email, mật khẩu, phiên) cùng liên kết `crm_customer_id` và `portal_code` do CRM cấp. Website tĩnh, **không có DB khách** | ✅ Đạt, không có CRM thứ hai |
| Webhook VIP ID chỉ cập nhật xác thực và trạng thái | VIP ID → CRM: `signups` (đăng ký chờ duyệt) và `thu-hoi` (huỷ phiên). CRM → VIP ID: `ket-qua-duyet`, `tam-khoa`, `thu-hoi` | ✅ Đúng phạm vi |
| G7: đăng xuất chỉ thu hồi phiên | CRM e885396: `thu-hoi` chỉ huỷ phiên portal, không đụng `users.active` / `customers.active` / signup | ✅ Đã sửa. E2E kiểm hồi quy: đăng xuất rồi đăng nhập lại được |
| Kiểm soát tenant, đại lý, kho ở backend | API `/portal/api/*` lọc theo `customer_id` lấy từ phiên. Role `crm_portal` chỉ được đọc view; `perm.js` giới hạn theo tenant và đại lý | ✅ Có. Đang rà soát đối kháng và chạy E2E |
| Kho XM/YW "Sắp mở" | `warehouses.status='planned'` + trigger chặn dữ liệu vận hành | ✅ |

## 2. Chủ sở hữu module

| Module | Repo / đường dẫn | Chủ sở hữu (người ghi duy nhất) |
|---|---|---|
| CRM backend, DB, migration, nghiệp vụ khách, mã VG, duyệt, đại lý, quyền, WMS/logistics API | `vip-group-khoqctq`: `server/**`, `deploy/**`, `scripts/**` | **CRM Controller** |
| Giao diện CRM nội bộ (nhân viên, quản trị, màn duyệt) | `vip-group-khoqctq/web/**` | **CRM Controller** |
| API cổng khách | `vip-group-khoqctq`: `/portal/api/*`, `/portal/auth/*` | **CRM Controller** (cung cấp) |
| **Giao diện cổng khách** (tổng quan, hồ sơ, kiện, tra cứu, 4 kho) | `vip-group-khoqctq/web-portal/**` | **Website Controller** (thiết kế và viết). Cách phối hợp ở §3 |
| Giao diện đăng ký, đăng nhập, xác minh, khôi phục, đổi mật khẩu, hồ sơ tài khoản | `vip-group-id`: `cowork/templates/khach/**`, `cowork/khach*.py` (nhánh `feature/khach-p1`) | **Website Controller** (hiện là người ghi duy nhất nhánh này) |
| Website công khai (nút vào cổng khi owner bật) | `vip-group-com-vn` | **Website Controller** |

## 3. Cách phối hợp để không cùng ghi một repo

1. **Repo CRM:** chỉ CRM Controller commit và merge vào `main`.
2. **Thay đổi `web-portal/**` do Website Controller làm:**
   - làm trong bản clone riêng ngoài thư mục của CRM;
   - giao dạng `git bundle` hoặc patch, kèm danh sách test đã chạy;
   - CRM Controller review và merge.
3. **CRM không sửa `web-portal/**`** khi chưa báo trước, trừ khi phải sửa lỗi chặn; khi đó báo SHA để Website rebase.
4. **Đổi API `/portal/api/*` hoặc hợp đồng VIP ID:** cập nhật §4 trước, rồi mới code. Ưu tiên thay đổi tương thích ngược.

## 4. Hợp đồng API cổng khách (CRM cung cấp, chỉ đọc)

Mọi route chạy trên host khách, yêu cầu phiên `vg_portal`, và chỉ trả dữ liệu của khách trong phiên.

| Route | Trả về | Ghi chú |
|---|---|---|
| `GET /portal/auth/launch?token=` | 303 → `/portal/` + cookie `vg_portal` | Token từ VIP ID (hợp đồng §4) |
| `GET /portal/api/me` | Mã VG, tên, SĐT che bớt, **`email` (string\|null)**, **`agent` ({code,name}\|null)** | Trang hồ sơ trong cổng. v1.1: thêm email/agent (đề xuất 07/11, chờ CRM) |
| `GET /portal/api/parcels?status=&page=` | `{items, page, pages, total}`, chỉ kiện **đã xác minh chủ** | Tuỳ chọn P2: `counts` theo trạng thái |
| `GET /portal/api/parcels/search?tracking=` → `{items:[…]}` | Một kiện. Không thấy thì 404 giống hệt trường hợp không tồn tại | Có giới hạn tần suất |
| `GET /portal/api/warehouses` | 4 kho, XM/YW `planned` | |
| `POST /portal/api/logout` | Huỷ phiên `vg_portal` | Sau đó chuyển `/tai-khoan/dang-xuat` để VIP ID huỷ phiên của mình |
| *(P2)* `GET /portal/api/parcels/:id/history` | Hành trình, chuyến, POD | CRM đã có dữ liệu `movements`; cần route nếu chưa có |

**Liên kết sang VIP ID** (cùng origin): `/tai-khoan/ho-so`, `/tai-khoan/doi-mat-khau`, `/tai-khoan/dang-xuat`, `/tai-khoan/vao-cong`.

## 5. Việc tiếp theo (song song, không chồng chéo)

**CRM Controller**
- Cấp mã VG1001 theo hợp đồng §12.
- Phạm vi CRM nội bộ B1–B10.
- Route lịch sử kiện (P2).

**Website Controller**
- Hoàn thiện `web-portal/**` theo §4: trang hồ sơ, liên kết tài khoản VIP ID, chi tiết kiện, tối ưu điện thoại.
- VIP ID giữ ở `d74655f`.
- E2E toàn trình, verifier độc lập, demo local.

**Chung**
- Chạy E2E sau mỗi lần merge.
- Verifier độc lập cuối.
- Gói triển khai (`GOI_TRIEN_KHAI_P1.md`).
