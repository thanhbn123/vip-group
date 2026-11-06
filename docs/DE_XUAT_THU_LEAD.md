# ĐỀ XUẤT THU LEAD — FORM LIÊN HỆ / BÁO GIÁ vipgroup.com.vn

**Trạng thái: ĐỀ XUẤT — CHƯA CODE, CHỜ OWNER QUYẾT.** Ngày 06/11/2026.

## 1. Hiện trạng (đo thật)

| Hạng mục | Hiện trạng |
|---|---|
| Form `/lien-he/` | Chỉ là giao diện: không gửi dữ liệu, hiện thông báo "chưa gửi được dữ liệu" → **khách điền xong mất lead** |
| Website | HTML tĩnh trên Cloudflare Pages; CSP chặn mọi gửi form (`form-action 'none'`) |
| Email `@vipgroup.com.vn` | Google Workspace (MX `smtp.google.com`) |
| Backend VIPORDER | **Đang chạy thật** từ 10/10/2026 trên `160.22.170.20` (FastAPI + PostgreSQL), đã có bảng lead, nguyên tắc "không mất lead khi hệ thống phụ lỗi" |
| CRM VIP GROUP | Chưa có API đã xác minh |

## 2. Ba phương án

| | **A. Google Sheet + email** | **B. Về backend VIPORDER (khuyến nghị)** | **C. Google Forms nhúng** |
|---|---|---|---|
| Luồng | Form → Cloudflare Function → ghi Google Sheet + gửi email Workspace | Form → Cloudflare Function (chống spam) → API lead VIPORDER → PostgreSQL + báo Zalo/email | Nhúng Google Form vào trang |
| Dữ liệu nằm ở | Google Drive của công ty | Máy chủ của mình (cùng chỗ dữ liệu khách VIPORDER) | Google Forms |
| Thời gian làm | 1–2 ngày | 3–4 ngày (gồm sửa backend VIPORDER) | Nửa ngày |
| Ưu | Nhanh, quen dùng, xem trên điện thoại | Lead vào chung hệ thống khách hàng, nối được với đăng ký mã KH / đơn hàng → đo được "lead → khách gửi hàng"; không phụ thuộc bên thứ ba | Nhanh nhất, không cần máy chủ |
| Nhược | Sheet không phải CRM; sau này phải chuyển | Phải sửa hệ thống VIPORDER đang chạy (cần duyệt + test kỹ) | Giao diện lệch thương hiệu, phải mở CSP cho Google, khó đo chuyển đổi, khó chống spam |
| Chi phí | 0đ (gói miễn phí Cloudflare + Workspace sẵn có) | 0đ (hạ tầng sẵn có) | 0đ |

**Khuyến nghị: B.** Nếu cần có ngay trong tuần, làm **A trước** rồi chuyển sang B (giữ nguyên giao diện form, chỉ đổi đích nhận).

## 3. Thiết kế chung (cho A hoặc B)

**Form áp dụng:** `/lien-he/` (liên hệ chung) · nút "Nhận báo giá" ở bảng giá trang chủ · form báo giá khu `/logistics/` (khi phát hành).

**Trường thu:** Họ tên · Số điện thoại/Zalo (bắt buộc) · Email (không bắt buộc) · Nhu cầu (liên hệ / báo giá vận chuyển / nhập khẩu chính ngạch / khác) · Khối lượng ước tính (kg) · Nội dung · Ô đồng ý xử lý dữ liệu cá nhân (bắt buộc).
Hệ thống tự ghi: trang gửi, nguồn truy cập (UTM, Google/Zalo/Facebook), thời gian.

**Chống spam:** Cloudflare Turnstile (miễn phí, không bắt khách giải ô chữ) · ô bẫy ẩn cho bot · giới hạn ~5 lần/giờ/IP · kiểm tra số điện thoại Việt Nam hợp lệ · chặn gửi trùng trong 10 phút.

**Thông báo lead mới:** email tới hộp thư owner chọn + tin nhắn Zalo (Zalo OA hoặc bot) / Telegram cho người trực — trong vòng 1 phút. Khách thấy màn hình "Đã nhận yêu cầu — chúng tôi gọi lại trong … giờ" kèm nút Zalo 0961 102 655.

**Khi hệ thống lỗi:** không bao giờ báo "thành công" giả. Báo lỗi + hiện ngay số Hotline/Zalo để khách liên hệ trực tiếp.

**Bảo mật & pháp lý (Nghị định 13/2023):** thêm trang **Chính sách bảo mật** (hiện chưa có); ô đồng ý không tích sẵn; khóa bí mật chỉ nằm ở Cloudflare/máy chủ, không vào mã nguồn; GA4 chỉ nhận sự kiện "đã gửi form", **không** nhận tên/SĐT; xác định thời hạn lưu (đề xuất 24 tháng).

**Đo lường:** đếm lead theo trang/nguồn; với B nối tiếp được: lead → đăng ký mã KH → đơn đầu tiên → khách quay lại.

**Kiểm thử trước phát hành:** gửi thật trên staging, thử spam/bot, thử backend tắt, thử tắt JS, điện thoại/máy tính; không ảnh hưởng nội dung đang chạy; có phương án rollback (tắt Function → form quay về trạng thái hiện tại).

## 4. Owner cần quyết

1. **Chọn phương án:** A, B, hay A trước rồi B.
2. **Ai nhận lead:** email nào, Zalo/Telegram của ai; cam kết gọi lại trong bao lâu (vd. 2 giờ làm việc).
3. **Bên quản lý dữ liệu** ghi trên chính sách bảo mật: CÔNG TY TNHH VIP GROUP hay VIPORDER.
4. **Cho phép** tạo Cloudflare Turnstile + secret trên tài khoản Cloudflare; với B: cho phép thêm endpoint lead vào backend VIPORDER đang chạy.
5. Thời hạn lưu dữ liệu lead.
