# BÁO CÁO NGHIỆM THU — CỔNG KHÁCH HÀNG VIP GROUP P1 + ONE VIP GROUP CRM

Ngày 07/11/2026 · Website Controller.

**Trạng thái:** **READY FOR OWNER ACCEPTANCE** (môi trường phát triển, dữ liệu giả) · **NO-GO PRODUCTION**, chờ owner phê duyệt riêng.

## 1. Phiên bản được nghiệm thu

| Hệ thống | Repo / nhánh | SHA | Kiểm thử riêng |
|---|---|---|---|
| VIP ID (danh tính khách) | `vip-group-id` · `feature/khach-p1` (chưa push) | `ab940df` (verifier cuối chạy trên `6030e14`; `ab940df` chỉ thêm sửa P2-b) | 230/230 |
| ONE VIP GROUP CRM (dữ liệu khách, mã VG, kiện, duyệt, đại lý, API, cổng khách `/portal`) | `vip-group-khoqctq` · `main` (local, chưa deploy) | `5007252` | 528/528 |
| Website vipgroup.com.vn | `vip-group` · `main` | `ce289ca` (**đã phát hành production 07/11**, cổng khách đang tắt) | 183/183 |

## 2. Kiến trúc: ONE CRM, một nguồn dữ liệu, nhiều giao diện

- **VIP ID:** đăng ký, đăng nhập (SĐT hoặc mã VG), mật khẩu, phiên và thu hồi phiên. Không giữ nghiệp vụ khách.
- **CRM:** nguồn **duy nhất** cho hồ sơ khách, mã VG1001…, kiện, vận đơn, đại lý, duyệt đăng ký và quyền.
  - Giao diện nhân viên: `/`.
  - Giao diện khách: `/portal`.
- **Hai hệ thống nối với nhau** bằng HMAC (ký cả method và path, chống phát lại) và launch token dùng một lần 60 giây.
- **Chi tiết:** `KIEN_TRUC_P1.md` §1–§14 và `ONE_CRM_PHAN_CONG.md`.

## 3. Chức năng đã hoàn thành (đã chạy thực tế)

**Khách hàng**
- Tự đăng ký. Không xác minh email hay SĐT, theo quyết định owner; SĐT là duy nhất.
- Chờ nhân viên duyệt.
- Nhận mã **VG1001, VG1002…**.
- Đăng nhập bằng SĐT hoặc mã VG (chữ thường cũng được).
- Xem hồ sơ (mã VG, SĐT che bớt, email, đại lý).
- Danh sách kiện có phân trang; tra cứu vận đơn của chính mình.
- Xem 4 kho Trung Quốc (Hạ Môn, Nghĩa Ô: **"Sắp mở"**).
- Đổi mật khẩu; đăng xuất (thoát cả cổng lẫn VIP ID).
- Khôi phục tài khoản: nhân viên cấp link một lần, 30 phút, gửi qua Zalo.
- Giao diện điện thoại 390px.

**Nhân viên (CRM nội bộ)**
- Màn duyệt đăng ký: duyệt, liên kết hồ sơ có sẵn, từ chối. Màn này **hiện cảnh báo trùng SĐT** và không bao giờ tự liên kết.
- Danh sách và tìm khách; xem và sửa hồ sơ.
- Khoá/mở cổng (đồng bộ sang VIP ID).
- Nhật ký thao tác; phân quyền theo đại lý.
- Hàng đợi gửi VIP ID: gửi lại, bỏ qua.

**An toàn**
- Chặn dò mật khẩu, kể cả từ nhiều IP và theo dải IPv6.
- Turnstile ở đăng ký và khi có dấu hiệu dò.
- Trần 200 đăng ký/giờ.
- Chống đoán SĐT qua thời gian phản hồi.
- CSP chặt, chống CSRF.
- Thu hồi phiên chính xác đến mili-giây.
- Nếu nâng cấp dữ liệu khách lỗi, phần khách tự tắt còn phần nhân viên vẫn chạy.

## 4. Kết quả kiểm thử

| Kiểm thử | Kết quả |
|---|---|
| E2E toàn trình (VIP ID thật + CRM thật + proxy giống production) | **34 PASS / 0 FAIL / 2 PENDING**. Pending: FLOW-11b (nút cấp link trong CRM), INTEROP-02 (chỉ chạy ở mock) |
| Bộ kiểm hợp đồng VIP ID ⇄ CRM | CRM 30 PASS / 0 FAIL; chiều CRM → VIP ID 4/4 |
| Kiểm tra bảo mật độc lập VIP ID | 8 vòng; vòng 7–8: **GO** |
| Rà soát đối kháng CRM + Security Auditor phía CRM | P0/P1 đã sửa |
| **Verifier độc lập toàn hệ thống cuối** (người mới, tự chạy lại toàn bộ) | **READY** cho nghiệm thu dev/staging |

**Các điểm bắt buộc theo chỉ thị owner**

| Yêu cầu | Kết quả |
|---|---|
| Không trùng mã khi duyệt đồng thời | ✅ 12 duyệt song song cho 12 mã khác nhau, bỏ qua mã đã dùng. 8 duyệt cùng một đơn chỉ tạo 1 khách |
| Không chiếm tài khoản bằng SĐT trùng | ✅ Không tạo tài khoản thứ hai. Nhân viên chỉ được liên kết hoặc từ chối |
| Không lộ dữ liệu khách khác | ✅ Tra mã của khách khác trả 404 giống hệt mã không tồn tại; tham số giả bị bỏ qua |
| Không lộ dữ liệu đại lý khác | ✅ |
| Khách không có quyền nhân viên | ✅ Ở cả hai ứng dụng: chặn đổi cookie, đổi Host, đăng nhập local |
| Quyền kiểm tra tại backend | ✅ API và role DB `crm_portal`. Xem P1-b ở §5 |
| Ký và xác minh yêu cầu | ✅ Chặn sửa body, phát lại, sai path, sai chiều, lệch giờ, quá 10 KB |
| Mất kết nối VIP ID hoặc CRM | ✅ Xếp hàng, gửi lại, không mất dữ liệu, không mở quyền |
| Đăng xuất chỉ thu hồi phiên (G7) | ✅ Đăng xuất xong đăng nhập lại được |
| Không ghi dữ liệu thử vào production | ✅ Chỉ dùng DB `vipcrm5_*` local; script seed từ chối chạy trên production |

## 5. Lỗi còn tồn

| Mã | Mức | Bên | Nội dung | Xử lý |
|---|---|---|---|---|
| P1-a | Chặn production | CRM | Chưa có nút/route nhân viên "Cấp link đặt lại mật khẩu". Hiện phải dùng lệnh VIP ID | CRM chờ **owner xác nhận trực tiếp** |
| P1-b | Chặn production (hoặc owner ký chấp nhận rủi ro) | CRM | Cách ly ở tầng DB còn phụ thuộc code ứng dụng: kết nối dùng chung vẫn đổi được phạm vi khách | Dùng `PORTAL_DATABASE_URL` với role đăng nhập riêng cho cổng |
| P1-c | Tài liệu | Website | Gói triển khai cũ | Đang viết lại theo SHA hiện tại |
| P2-a | Thấp | CRM | Request dạng absolute-URL lọt bộ chặn Host (vẫn bị chặn ở phiên) | Đã gửi CRM |
| P2-b | Thấp | VIP ID | Ghi sai số phiên bản schema khi nâng cấp lỗi | ✅ Đã sửa (`ab940df`) |
| P2-c | Quyết định | CRM | Màn duyệt vẫn yêu cầu tích "đã xác minh SĐT" | Chờ owner xác nhận trực tiếp |

## 6. Bản demo nghiệm thu (local, dữ liệu giả)

- **Bật / kiểm tra / tắt:**

  ```
  node tests/portal-e2e/demo.mjs start | status | stop
  ```

  Hướng dẫn chi tiết: `tests/portal-e2e/HUONG_DAN_DEMO.md`.
- **Cổng khách hàng:** `http://khach.localhost:8890/tai-khoan/dang-nhap` (đăng ký: `/tai-khoan/dang-ky`).
- **CRM nội bộ:** `http://127.0.0.1:5195/`, tài khoản `vip.admin`, mục **"Đăng ký khách (cổng)"**.
- **Tài khoản thử:**
  - K1 `0900000011` / VG1001
  - K2 `0900000012` / VG1002
  - K3 `0900000003` / VG1003 (khách đại lý A1)
  - K4 `0900000014`: đang chờ duyệt, để owner thử duyệt
- **Mật khẩu:** chỉ có trong tệp `TAI_KHOAN_DEMO.txt` (quyền 0600) mà lệnh `start` in đường dẫn. **Không ghi trong báo cáo, log hay commit.**
- **Lệnh thay nút còn thiếu:** `demo.mjs reset-link <SĐT|VG>`, `demo.mjs lock|unlock <VG>`.

## 7. Điều kiện để dùng production

Chi tiết trong `GOI_TRIEN_KHAI_P1.md`.

1. **Owner xác nhận trực tiếp với phiên CRM:** bỏ tích "đã gọi xác minh SĐT"; thêm nút cấp link đặt lại mật khẩu (P1-a, P2-c).
2. **CRM:** dùng role DB đăng nhập riêng cho cổng (P1-b); bản phát hành CRM có cổng; thêm admin thứ hai; có cảnh báo vận hành.
3. **VIP ID:** merge `feature/khach-p1` và triển khai. Cấu hình production bắt buộc:
   - `COWORK_TIN_PROXY=1`
   - `COWORK_COOKIE_SECURE=1`
   - `COWORK_STAFF_HOSTS`
   - Khoá **Cloudflare Turnstile thật** cho `khachhang.vipgroup.com.vn`

   Production sẽ từ chối khởi động nếu thiếu một trong các cấu hình trên.
4. **Mạng nội bộ VIP ID ↔ CRM** trên VPS: chung mạng docker.
5. **Đã đáp ứng:** VPS có NTP (CRM đã xác nhận).
6. **DNS `khachhang.vipgroup.com.vn`** (iNET) và **khối Caddy** (người có quyền root). Owner duyệt.
7. **E2E trên staging**, rồi smoke production bằng một tài khoản thật do owner chỉ định.
8. **Owner chốt:**
   - Tên đăng nhập chính (hiện nhận cả SĐT lẫn mã VG).
   - Khách cũ của CRM có còn được vào giao diện nhân viên không (`STAFF_HOST_ALLOW_LEGACY_CUSTOMERS`).
   - Mã kho XM/YW và dữ liệu vận hành trước khi "mở".
   - Ký chấp nhận các rủi ro: không xác minh khi đăng ký; NAT dùng chung có thể bị chặn 1 phút; quá 200 đăng ký/giờ thì hiện trang báo hotline.
9. **Bật nút "Đăng nhập / Đăng ký" trên website** (`contact.portal`): làm sau cùng, bằng PR riêng.

**Rollback:**
- Tắt cờ `COWORK_KHACH_ENABLED=0` / `PORTAL_ENABLED=0`.
- Gỡ khối Caddy.
- CRM: chạy `portal-down.sql` (đảo 660, 700–706).
- VIP ID schema v6: **cần backup** nếu phải lùi code.
