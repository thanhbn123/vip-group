# ĐỀ ÁN CỔNG KHÁCH HÀNG VIP GROUP — P1 (CRM + VIP ID)

Ngày 07/11/2026 · Owner duyệt P1: *"a duyệt làm đi"*. NO-GO PRODUCTION vẫn giữ nguyên: chưa đổi DNS, chưa mở `khachhang.vipgroup.com.vn` công khai khi owner chưa nghiệm thu.

Phiên website (vip-group-com-vn) **không ghi vào repo CRM hay VIP ID**. Tài liệu này là đặc tả và danh sách việc giao cho từng phiên.

## 1. Hiện trạng đo được (07/11/2026)

| Thành phần | Đã có | Nguồn |
|---|---|---|
| Tài khoản khách trong CRM | `users.kind = 'customer'`, vai trò `customer`; mỗi tài khoản gắn với 1 hồ sơ khách (`customers.user_id`) | `vip-group-khoqctq/server/migrations/001_core.sql` |
| Phân quyền khách | Vai trò `customer` chỉ thấy dữ liệu của `customerId` của mình; không có quyền kho/CRM chung | `server/lib/perm.js` |
| Mã khách hàng | `customers.code`, duy nhất theo tenant | `001_core.sql` |
| Kiện hàng / vận đơn | `parcels.tracking_no`, `customer_id`, `status` (in_stock, held, manifested, shipped, delivered …), `weight_kg`, `volume_m3`, `received_at` | `001_core.sql` |
| Đăng nhập nhân viên qua VIP ID | Token mở CRM từ COWORK, nonce dùng 1 lần; `users.vip_subject` | `101_crm.sql`, `adapters.js` |
| VIP ID (COWORK) | Chỉ dành cho **nhân viên**: FastAPI, cookie `cowork_session`, MFA, 5 vai trò nội bộ; **chưa có** OIDC hay tài khoản khách | `vip-group-id/README.md`, `docs/AGENT-CONTRACTS.md` |
| Kho trong WMS | Chỉ có **SZ (Thâm Quyến) và GZ (Quảng Châu)** | `perm.js` |
| Thu lead website | `/api/lead` → Google Sheet + CRM (`need`, HMAC) | PR #36–#44 |

**Kết luận:** phần lõi (tài khoản khách, phân quyền, kiện hàng theo khách) đã có trong CRM. P1 chủ yếu cần thêm **đăng ký tự phục vụ**, **giao diện cổng khách** và **API tra cứu theo khách**. Ước tính giảm từ 2–4 tuần xuống còn khoảng **1,5–2,5 tuần**.

## 2. Kiến trúc đề xuất

```
vipgroup.com.vn (Astro, tĩnh)
  ├─ nút "Đăng nhập" / "Đăng ký"  ─────────►  khachhang.vipgroup.com.vn  (cổng khách)
  └─ /api/lead (đã có)                          │  phục vụ bởi CRM (route /portal), cookie riêng
                                                ▼
                                     CRM (Postgres): users(kind=customer), customers, parcels
VIP ID / COWORK  ── chỉ nhân viên ──►  CRM (duyệt đăng ký, cấp mã, xử lý kiện)
```

| Câu hỏi | Đề xuất |
|---|---|
| Khách đăng nhập bằng gì? | **CRM tự xác thực khách** (adapter mật khẩu nội bộ đã có, `kind='customer'`), cookie riêng `vg_customer` cho miền `khachhang.vipgroup.com.vn`. **Không** đưa khách vào VIP ID nhân viên. |
| VIP ID làm gì? | Nhân viên đăng nhập CRM qua VIP ID như hiện tại, để duyệt đăng ký khách, cấp mã khách, xử lý kiện. Nếu sau này cần dùng chung một tài khoản khách cho nhiều ứng dụng, sẽ mở một "realm khách" riêng trong VIP ID (bước P1b, không làm ngay). |
| Tenant | `VIP` (VIP GROUP). |
| Mã khách hàng | CRM sinh mã khi **nhân viên duyệt**, không cấp tự động cho người tự đăng ký, để tránh khách ảo và spam. |

> ⚠️ **Lệch so với phương án owner đã duyệt:** đề án ghi "Đăng nhập: VIP ID mở rộng cho khách". Đề xuất trên dùng **tài khoản khách của CRM** vì CRM đã có sẵn, nhanh hơn, và tách hẳn khách khỏi hệ thống nhân viên. **Owner chọn ở mục 6, câu Q-P1.**

## 3. Luồng chức năng P1

1. **Đăng ký:** form trên cổng gồm họ tên, SĐT, email (tuỳ chọn), tỉnh/thành, kho hay gửi, đồng ý chính sách. Có Turnstile chống bot. Tạo `customers` + `users(kind=customer, active=false)` ở trạng thái *chờ duyệt*. Thông báo Zalo cho nhân viên theo cách đang dùng cho lead.
2. **Duyệt:** nhân viên (đăng nhập VIP ID) duyệt trong CRM. CRM cấp mã khách, kích hoạt tài khoản và gửi mã kèm link đặt mật khẩu qua Zalo/SMS/email. **Không gửi mật khẩu qua chat.**
3. **Đăng nhập:** SĐT hoặc mã khách + mật khẩu. Giới hạn số lần thử; khoá tạm khi sai nhiều lần; đặt lại mật khẩu bằng link một lần.
4. **Tra cứu:**
   - danh sách kiện của chính khách (mã vận đơn, kho, ngày nhập, cân nặng, số khối, trạng thái);
   - tìm theo mã vận đơn, **chỉ trong dữ liệu của khách đó**;
   - người chưa đăng nhập **không** tra cứu được (tránh dò mã vận đơn của người khác).
5. **Hồ sơ:** xem mã khách, 4 địa chỉ kho Trung Quốc kèm mã khách để ghi lên kiện, và đổi mật khẩu.
6. **Website:** khi cổng chạy ở staging, thêm nút "Đăng nhập / Đăng ký" vào trang tra cứu và Liên hệ. Trang `/logistics/tra-cuu-van-don/` vẫn giữ cách tra cứu qua Zalo/hotline cho khách chưa có tài khoản.

## 4. Giao việc

### Phiên CRM (vip-group-khoqctq)
| # | Việc | Ghi chú |
|---|---|---|
| C1 | Route `/portal/*` gồm đăng ký, đăng nhập, đăng xuất, đặt lại mật khẩu, hồ sơ, danh sách kiện | Cookie riêng, CSRF, rate limit |
| C2 | Trạng thái "chờ duyệt" cho khách tự đăng ký; màn duyệt cho nhân viên; sinh mã khách | Theo quy tắc đặt mã owner chốt |
| C3 | API khách `GET /portal/api/parcels?tracking=` lọc cứng theo `ctx.customerId` | Có test chống xem chéo dữ liệu khách |
| C4 | Thông báo Zalo khi có đăng ký mới | Dùng lại kênh thông báo lead |
| C5 | Bổ sung kho **Hạ Môn, Nghĩa Ô** vào WMS (hiện chỉ có SZ, GZ) | Nếu chưa có dữ liệu, cổng ghi "đang cập nhật" |
| C6 | Caddy: `khachhang-staging.vipgroup.com.vn` → CRM staging | Chỉ staging; DNS do owner duyệt |

### Phiên VIP ID (vip-group-id) — P1a không cần sửa
Chỉ xác nhận nhân viên duyệt khách qua CRM bằng tài khoản VIP ID hiện có. Realm khách trong VIP ID chỉ làm ở P1b, nếu owner chọn.

### Phiên website (phiên này)
| # | Việc |
|---|---|
| W1 | Nút "Đăng nhập / Đăng ký" (hằng `portalUrl` trong `src/data/vi/contact.ts`), **tắt** cho tới khi cổng đạt staging |
| W2 | Trang tra cứu: thêm khối "Đã có tài khoản? Đăng nhập để tra cứu trực tuyến" |
| W3 | Test: link cổng chỉ hiện khi `portalUrl` có giá trị; không còn link VIPORDER |

## 5. An toàn và dữ liệu
- Không lưu mật khẩu dạng rõ; băm bằng hàm CRM đang dùng.
- Không đưa dữ liệu khách lên AI cloud hay vào repo; ảnh bằng chứng nghiệm thu dùng dữ liệu giả (khach.x / khach.y).
- Website tĩnh không giữ phiên đăng nhập; mọi thao tác tài khoản nằm ở miền `khachhang.`.
- Tách cookie theo miền con; không dùng chung cookie với `cowork.` hoặc CRM nhân viên.

## 6. Owner cần chốt
- **Q-P1. Đăng nhập khách:** ☐ tài khoản khách của CRM *(khuyến nghị — đã có sẵn, nhanh hơn)* ☐ VIP ID mở rộng realm khách (thêm khoảng 1–2 tuần)
- **Q-P2. Duyệt đăng ký:** ☐ nhân viên duyệt rồi mới cấp mã *(khuyến nghị)* ☐ cấp mã tự động ngay
- **Q-P3. Quy tắc mã khách:** ví dụ `VG` + 5 số (VG00123)? ________
- **Q-P4. Kênh gửi link đặt mật khẩu:** ☐ Zalo ☐ SMS ☐ email
- **Q-P5. Tên miền:** `khachhang.vipgroup.com.vn` (staging: `khachhang-staging.vipgroup.com.vn`) ☐ đồng ý
