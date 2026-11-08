# ĐỀ XUẤT: BỎ BƯỚC NHÂN VIÊN DUYỆT — TỰ ĐỘNG KÍCH HOẠT THEO SĐT (chờ owner duyệt, CHƯA CODE)

Ngày 08/11/2026. Yêu cầu của owner:
> Bỏ phương án duyệt. Chỉ đối chiếu SĐT đã tồn tại chưa trong khách hàng. Nếu chưa tồn tại thì cho đăng nhập được luôn. Nếu SĐT trùng thì yêu cầu khách nhập SĐT khác hoặc tìm lại mật khẩu.

## 1. Luồng mới

```
Khách điền form tại dangky (họ tên, SĐT, email tuỳ chọn, mật khẩu, Turnstile)
      │
      ▼  VIP ID gọi CRM NGAY, đồng bộ (HMAC, ≤ 3 s): "đăng ký tự động"
CRM kiểm SĐT (chuẩn hoá +84) trong TOÀN BỘ hồ sơ khách và tài khoản cổng
      ├─ CHƯA có → tạo khách (tenant VIP) + mã VG kế tiếp + tài khoản cổng, trong MỘT giao dịch
      │            → VIP ID kích hoạt ngay → trang "Tạo tài khoản thành công · Mã khách VG1002"
      │            → nút "Vào cổng khách hàng" (đăng nhập luôn, không phải gõ lại)
      └─ ĐÃ có  → không tạo gì → trang "Số điện thoại này đã được đăng ký"
                   [Dùng số khác]  [Đăng nhập]  [Quên mật khẩu]
```

- **CRM tạm lỗi** (mạng, bảo trì): VIP ID **không** tạo tài khoản dở dang. Khách thấy "Hệ thống đang bận, vui lòng thử lại sau ít phút".
- **Nhân viên vẫn kiểm soát sau đó:** màn duyệt CRM thành **"Khách tự đăng ký"**, có nhật ký ai đăng ký lúc nào, và nút **Khoá cổng** nếu thấy bất thường.

## 2. Thay đổi kỹ thuật

| Bên | Việc |
|---|---|
| **CRM** | API nội bộ mới `POST /api/internal/portal/dang-ky-tu-dong` (ký HMAC như hiện tại), bật bằng cờ `PORTAL_AUTO_APPROVE=1`. API kiểm trùng SĐT (cả `phone` tự do lẫn `phone_e164`, mọi tenant/đại lý, cả tài khoản cổng), cấp mã VG theo quy tắc hiện tại (VG1001…, bỏ qua mã đã dùng, an toàn khi đồng thời), ghi audit `portal.signup.auto_approve`. Trả `{ok, crm_customer_id, portal_code}` hoặc `{trung: 'sdt'}` |
| **VIP ID** | Đăng ký gọi API trên **đồng bộ**. Chỉ khi CRM trả `ok` mới tạo tài khoản `hoat_dong`. Thêm trang thành công và trang "SĐT đã được đăng ký". Bỏ trạng thái `cho_duyet` cho đăng ký mới. Giữ nguyên Turnstile, giới hạn theo IP và trần 200 đăng ký/giờ |
| **Màn CRM** | Đổi thành danh sách "Khách tự đăng ký" (xem, khoá, cấp link đặt lại). Giữ nút Liên kết cho các ca hotline cần nối hồ sơ cũ |
| **Kiểm thử** | E2E: đăng ký → vào cổng ngay, SĐT trùng (3 dạng nhập), 20 đăng ký đồng thời cùng SĐT ra đúng 1 tài khoản, CRM lỗi không để lại rác, mã VG không trùng. Verifier độc lập |
| **Triển khai** | Cờ tắt mặc định → staging → E2E → owner duyệt bản phát hành CRM (`I_APPROVE_UPDATE_<rel>`) + VIP ID → bật cờ. Tắt cờ là quay về luồng duyệt cũ, không đổi dữ liệu |

Ước tính: CRM khoảng 1 ngày, VIP ID khoảng 1 ngày, kiểm thử và verifier nửa ngày.

## 3. Rủi ro owner cần biết

1. **Lộ thông tin "số này đã đăng ký"** (owner chủ động chọn). Người lạ thử số sẽ biết số đó là khách VIP GROUP. Biện pháp giảm: Turnstile, giới hạn theo IP, trần mỗi giờ. Thông báo không nói tên hay mã khách.
2. **Chiếm số của người khác.** Không xác minh SĐT nên ai cũng đăng ký được bằng số của người khác và **vào cổng ngay**. Thiệt hại hiện thấp vì tài khoản mới **chưa có kiện nào**: kiện chỉ gắn khi kho gắn cho mã VG. Nhưng chủ số thật sau đó sẽ bị báo "đã đăng ký". Muốn chặn hẳn phải có **mã OTP gửi qua SMS hoặc Zalo** (xem Q3).
3. **Khách cũ trong CRM** (có hồ sơ, có kiện, kể cả khách của đại lý) chưa có tài khoản cổng mà đăng ký: hệ thống báo trùng. **Tuyệt đối không tự nối** vào hồ sơ cũ, vì người đăng ký chưa chắc là chủ hồ sơ.

## 4. Owner cần chốt

- **Q1. Khách cũ trong CRM đăng ký (SĐT trùng hồ sơ cũ, chưa có tài khoản cổng)**
  - ☐ **(khuyến nghị)** Báo "Số này đã có hồ sơ tại VIP GROUP — gọi/nhắn Zalo 0961 102 655 để kích hoạt". Nhân viên xác minh rồi bấm **Liên kết** (nút đã có).
  - ☐ Chỉ báo "dùng số khác".
- **Q2. "Tìm lại mật khẩu" khi khách tự làm**
  - ☐ **(khuyến nghị cho bây giờ)** Giữ cách hiện tại: trang Quên mật khẩu hướng dẫn gọi/nhắn Zalo hotline, nhân viên cấp link.
  - ☐ Tự phục vụ qua **email** (chỉ với khách có email; cần cấu hình gửi email thật, khoảng 2–3 ngày).
  - ☐ Tự phục vụ qua **OTP SMS/Zalo** (cần nhà cung cấp, có phí mỗi tin).
- **Q3. Xác minh chủ số điện thoại khi đăng ký**
  - ☐ Chấp nhận rủi ro 3.2 cho giai đoạn này.
  - ☐ Thêm OTP SMS/Zalo trước khi kích hoạt (an toàn nhất; cần chọn nhà cung cấp).
- **Q4. Các đăng ký đang chờ duyệt (nếu có) khi bật cờ**
  - ☐ Tự kích hoạt luôn nếu không trùng.
  - ☐ Nhân viên xử lý tay.
