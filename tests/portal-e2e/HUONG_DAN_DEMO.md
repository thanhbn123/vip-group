# Hướng dẫn chạy bản demo Cổng khách hàng VIP GROUP

Bản demo chạy trên máy của anh/chị, chỉ có dữ liệu giả để thử nghiệm. Không có khách thật, không gửi email hay tin nhắn, không kết nối CRM production.

## 1. Bật và tắt demo

Mở Terminal tại thư mục `vip-group-com-vn`:

```sh
node tests/portal-e2e/demo.mjs start     # bật demo (khoảng 1–2 phút)
node tests/portal-e2e/demo.mjs status    # xem demo có đang chạy không
node tests/portal-e2e/demo.mjs stop      # tắt demo và xoá toàn bộ dữ liệu demo
```

Khi chạy `start`, công cụ sẽ:

1. Lấy bản CRM mới nhất (nhánh `main`) và bản VIP ID đã commit mới nhất để chạy riêng. Repo gốc không bị đụng tới.
2. Tạo cơ sở dữ liệu thử `vipcrm5_demo_portal`.
3. Bật VIP ID, CRM và cổng khách. Các dịch vụ này chạy nền, đóng Terminal vẫn không tắt.
4. Tạo sẵn khách mẫu bằng đúng quy trình thật: khách đăng ký, rồi nhân viên duyệt.

Muốn dùng một phiên bản cụ thể, đặt mã phiên bản trước lệnh, ví dụ: `CRM_SHA=66e3470 VIPID_SHA=c3d848f node tests/portal-e2e/demo.mjs start`.

Dùng xong, nhớ chạy `stop`. Lệnh này tắt đúng các dịch vụ của demo, xoá cơ sở dữ liệu demo và xoá tệp mật khẩu.

## 2. Địa chỉ

Demo chạy giống sơ đồ tên miền thật (§15): mỗi việc một địa chỉ riêng.

| Dùng cho | Địa chỉ | Tương ứng khi chạy thật |
|---|---|---|
| Khách đăng ký mới | http://dangky.vipgroup.localhost:8890/tai-khoan/dang-ky | dangky.vipgroup.com.vn |
| Khách đăng nhập, hồ sơ, đổi mật khẩu | http://dangnhap.vipgroup.localhost:8890/tai-khoan/dang-nhap | dangnhap.vipgroup.com.vn |
| Cổng khách (kiện hàng, tra cứu, kho) | http://khachhang.vipgroup.localhost:8890/ | khachhang.vipgroup.com.vn |
| Nhân viên (CRM) | http://127.0.0.1:5195/ → menu **"Đăng ký khách (cổng)"** | crm.vipgroup.com.vn |

Mở các địa chỉ trên bằng Chrome, Firefox hoặc Safari. Tên `*.localhost` chạy được ngay, không cần cài đặt gì. Mở thẳng địa chỉ cổng khách khi chưa đăng nhập, hệ thống tự chuyển sang trang đăng nhập rồi quay lại cổng sau khi đăng nhập xong.

Muốn chạy kiểu cũ (một địa chỉ `khach.localhost:8890` cho tất cả), bật demo bằng `TOPO=single node tests/portal-e2e/demo.mjs start`.

## 3. Tài khoản demo

Toàn bộ tài khoản và mật khẩu nằm trong **một tệp duy nhất**: `TAI_KHOAN_DEMO.txt`. Đường dẫn tới tệp được in ra khi `start` xong. Tệp này chỉ tài khoản máy của anh/chị đọc được. Mật khẩu không hiện trên màn hình và không có trong báo cáo.

| Khách | Đăng nhập bằng | Tình trạng |
|---|---|---|
| K1 | SĐT `0900000011` hoặc mã `VG1001` | Đã duyệt, có 5 kiện mẫu |
| K2 | SĐT `0900000012` hoặc mã `VG1002` | Đã duyệt, có 3 kiện mẫu, đăng ký không có email |
| K3 | SĐT `0900000003` hoặc mã `VG1003` | Khách cũ của đại lý A1 (mã nội bộ `K3-A1`), đã được liên kết với cổng, có 2 kiện |
| K4 | SĐT `0900000014` | **Đang chờ duyệt**, để anh/chị thử duyệt |
| Nhân viên | `vip.admin` | Quản trị CRM. Mật khẩu dev ghi trong cùng tệp |

Mỗi khách có thêm một kiện "chưa rõ chủ" dạng `E2E-VG100x-PENDING`. Kiện này **không được hiện** với bất kỳ khách nào.

## 4. Thử phía khách hàng

1. **Đăng ký khách mới.** Mở trang đăng ký. Nhập họ tên, SĐT di động (ví dụ `0900000099`) và mật khẩu từ 12 ký tự trở lên. Email có thể bỏ trống. Màn hình sẽ báo "Đã nhận đăng ký, chờ VIP GROUP duyệt". Lúc này khách chưa đăng nhập được.
2. **Nhân viên duyệt** (xem mục 5).
3. **Đăng nhập.** Nhập SĐT hoặc mã VG (viết thường như `vg1001` cũng được) cùng mật khẩu. Hệ thống tự chuyển sang cổng khách: tổng quan, **Kiện hàng**, **Tra cứu**, **Kho TQ**.
4. **Tra cứu vận đơn.** Vào **Tra cứu**, nhập `E2E-VG1001-001` (khi đăng nhập bằng K1). Nhập mã kiện của khách khác (ví dụ `E2E-VG1002-001`) sẽ nhận "Không tìm thấy", giống hệt như mã không tồn tại.
5. **Hồ sơ.** Trang hồ sơ hiện mã khách và SĐT đã che bớt.
6. **Đổi mật khẩu.** Ở trang hồ sơ, chọn "Đổi mật khẩu". Các thiết bị khác đang đăng nhập sẽ tự bị đăng xuất.
7. **Đăng xuất.** Bấm "Đăng xuất" trong cổng, rồi xác nhận ở trang VIP ID. Màn hình sẽ báo "Bạn đã đăng xuất.".

## 5. Thử phía nhân viên

Đăng nhập CRM bằng `vip.admin`, vào **"Đăng ký khách (cổng)"**.

- **Duyệt** (thử với K4 hoặc khách anh/chị vừa đăng ký): bấm **"Duyệt · cấp mã"**. Hệ thống cấp mã kế tiếp (VG1004, VG1005…). Khoảng 15 giây sau, khách đăng nhập được. Từ quyết định của chủ dự án ngày 07/11, nhân viên **không bắt buộc** gọi xác minh SĐT trước khi duyệt. Nút "Đã gọi xác minh SĐT" vẫn còn để ghi chú nếu đã gọi.
- **Liên kết hồ sơ có sẵn:** dùng khi SĐT đăng ký trùng một khách đã có trong CRM, như trường hợp của K3. Hệ thống không bao giờ tự liên kết. Nút "Duyệt" sẽ bị khoá, nhân viên phải chủ động chọn liên kết. Khách giữ mã nội bộ cũ và được cấp thêm mã VG để đăng nhập.
- **Từ chối:** cần ghi lý do. SĐT đó được giải phóng để chủ thật có thể đăng ký lại.
- **Khoá cổng / mở cổng của một khách:** CRM chưa có nút cho việc này. Tạm thời dùng lệnh:

  ```sh
  node tests/portal-e2e/demo.mjs lock VG1002     # khoá: khách bị đăng xuất, không đăng nhập được
  node tests/portal-e2e/demo.mjs unlock VG1002   # mở lại
  ```

## 6. Khách quên mật khẩu

Trang "Quên mật khẩu" chỉ hiện số hotline/Zalo. Quy trình như sau:

1. Khách gọi hotline.
2. Nhân viên xác nhận đúng người.
3. Trong CRM, vào **"Đăng ký khách (cổng)"**, tìm khách đã duyệt, bấm **"Cấp link đặt lại mật khẩu"**, nhập lý do rồi bấm **"Cấp link"**.
4. Gửi liên kết cho khách qua Zalo. Liên kết chỉ hiện **một lần**, CRM không lưu lại, dùng được một lần và hết hạn sau 30 phút. Cấp liên kết mới thì liên kết cũ hết hiệu lực. Khách đang bị khoá cổng thì không cấp được liên kết.

Khi khách mở liên kết, trang hiện ô nhập mật khẩu mới. Đặt mật khẩu xong, mọi phiên đăng nhập cũ (VIP ID và cổng) đều bị đăng xuất.

Cũng có thể cấp liên kết bằng lệnh (đi qua đúng API của CRM):

```sh
node tests/portal-e2e/demo.mjs reset-link 0900000011     # hoặc: reset-link VG1001
```

## 7. Khi có trục trặc

- `start` báo "Cổng … đang bận": một bản demo cũ hoặc chương trình khác đang chạy. Chạy `stop` rồi thử lại.
- `start` báo lỗi: công cụ in phần cuối nhật ký và tự dọn dẹp. Có thể chạy `start` lại.
- Kiểm tra nhanh demo còn chạy tốt không: `node tests/portal-e2e/demo.mjs smoke`. Lệnh này đăng nhập K1 và đếm số kiện, không in mật khẩu.
