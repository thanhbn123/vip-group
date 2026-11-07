# G05 — LỊCH NỘI DUNG 90 NGÀY

Tuần 1 = tuần owner duyệt phát hành. Mỗi bài: **không xuất bản khi còn thông tin chưa xác minh**. Bài pháp lý/thuế/hải quan phải có người chuyên môn VIPORDER duyệt, ghi ngày cập nhật và dẫn văn bản pháp luật đang hiệu lực.

Trạng thái: `ĐÃ VIẾT – NHÁP` (có trong `src/data/vi/logistics.ts`, `status: 'draft'`, xem được ở bản DEMO) · `CHỜ DỮ LIỆU` · `CHƯA VIẾT`.

| Tuần | URL / slug | Mục tiêu tìm kiếm | Từ khóa chính · phụ | Bằng chứng cần có | Cấu trúc | Internal links | CTA | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| 1 | `/logistics/kien-thuc/cach-tinh-so-khoi-va-can-nang-quy-doi/` | Thông tin trước báo giá | cách tính số khối hàng Trung Quốc · cân nặng quy đổi, m³, 1 khối bao nhiêu kg | Hệ số quy đổi VIPORDER (OWNER) — bài đã viết trung lập, không nêu hệ số | Vì sao → cách đo → công thức + ví dụ → quy đổi → mẹo giảm khối | `/bang-gia/` (công cụ tính), `/quy-trinh-gui-hang/` | Yêu cầu báo giá | ĐÃ VIẾT – NHÁP |
| 1 | `/logistics/kien-thuc/ghi-ma-khach-hang-khi-dat-hang-1688-taobao/` | Giảm lỗi vận hành | ghi mã khách hàng đặt hàng 1688 · nhãn kiện, địa chỉ kho | Mẫu ghi người nhận thật (OWNER) | Vì sao → các bước → lỗi thường gặp | `/quy-trinh-gui-hang/`, `/kho-quang-chau/` | Đăng ký mã KH | ĐÃ VIẾT – NHÁP |
| 2 | `/logistics/kien-thuc/dong-goi-hang-gui-tu-trung-quoc/` | Thông tin | đóng gói hàng gửi từ Trung Quốc · đóng gỗ, gia cố | Phí đóng gỗ có/không (OWNER) | Nguyên tắc → theo loại hàng → trao đổi trước | `/van-chuyen-trung-quoc-bac-ninh/`, `/bang-gia/` | Zalo tư vấn | ĐÃ VIẾT – NHÁP |
| 2 | `/logistics/kho-quang-chau/`, `/logistics/kho-tham-quyen/` (nâng `ready`) | Giao dịch | kho Quảng Châu · kho Thâm Quyến | Địa chỉ kho, giờ nhận, mẫu người nhận, tuyến, thời gian (OWNER) | Đã có khung | Hub, Bắc Ninh | Đăng ký mã KH | CHỜ DỮ LIỆU |
| 3 | `/logistics/bang-gia/` (nâng `ready`) | Giao dịch | bảng giá vận chuyển Trung Việt · cước kg, m³ | Bảng giá + ngày hiệu lực + hệ số quy đổi (OWNER, văn bản) | Đã có khung + công cụ tính + form | Mọi trang | Báo giá | CHỜ DỮ LIỆU |
| 4 | `nhap-khau-chinh-ngach-hang-trung-quoc` | Giao dịch (B2B) | nhập khẩu chính ngạch hàng Trung Quốc · hồ sơ, thuế, VAT | Quy trình thật + người duyệt chuyên môn | Khi nào cần → hồ sơ → thuế/VAT (dẫn văn bản) → quy trình → FAQ | `/van-chuyen-trung-quoc-viet-nam/`, `/lien-he/` | Tư vấn chính ngạch | CHƯA VIẾT |
| 5 | `nhap-phu-kien-may-moc-nganh-go-tu-trung-quoc` | Địa phương (khoảng trống SERP) | nhập phụ kiện nội thất Trung Quốc Đồng Kỵ · bản lề, ray trượt | Ví dụ lô hàng thật (ẩn danh) | Nhu cầu xưởng → chọn kho → đóng gói → chứng từ | `/van-chuyen-trung-quoc-bac-ninh/#tu-son-dong-ky` | Zalo | CHƯA VIẾT |
| 6 | `hang-nguyen-container-va-hang-le-lcl` | Thông tin/giao dịch | hàng nguyên container Trung Quốc · hàng lẻ LCL | VIPORDER có nhận FCL không (OWNER) — nếu không, viết trung lập | Khái niệm → so sánh → khi nào chọn | `/bang-gia/` | Báo giá | CHỜ XÁC NHẬN DỊCH VỤ |
| 7 | `van-chuyen-hang-1688-ve-viet-nam` | Giao dịch | vận chuyển hàng 1688 về Việt Nam | Thống nhất với viporder.com.vn (order) | Từ shop → kho TQ → Bắc Ninh → tra cứu | `/tra-cuu-van-don/`, viporder.com.vn | Đăng ký mã KH | CHƯA VIẾT |
| 8 | `case-study-quang-chau-tu-son` | E-E-A-T | vận chuyển Quảng Châu Từ Sơn | Lô hàng thật + **đồng ý bằng văn bản của khách** | Bối cảnh → hàng → hành trình → thời gian/chi phí thật → bài học | Bắc Ninh, kho QC | Báo giá | CHỜ DỮ LIỆU |
| 9 | `hang-cam-va-hang-han-che-nhap-khau` | Thông tin | hàng cấm nhập khẩu từ Trung Quốc | Danh mục theo văn bản hiện hành + chính sách nhận hàng của VIPORDER | Nhóm hàng → lý do → cần giấy phép gì | `/cau-hoi-thuong-gap/` | Hỏi trước khi gửi | CHƯA VIẾT |
| 10 | `khai-bao-hai-quan-hang-nhap-tu-trung-quoc` | Thông tin B2B | khai báo hải quan hàng Trung Quốc | Người duyệt chuyên môn | Chứng từ → quy trình → lỗi thường gặp | Bài chính ngạch | Tư vấn | CHƯA VIẾT |
| 11 | `hang-trung-quoc-ve-cham-nguyen-nhan` | Thông tin | hàng Trung Quốc về chậm | Dữ liệu vận hành thật (không bịa số ngày) | Theo chặng → cách xử lý | `/tra-cuu-van-don/` | Hotline | CHƯA VIẾT |
| 12 | `lich-nghi-le-trung-quoc-anh-huong-van-chuyen` | Theo mùa (đăng trước Tết) | nghỉ Tết Trung Quốc hàng về chậm | Lịch nghỉ chính thức năm 2027 | Mốc nghỉ → khuyến nghị đặt hàng sớm | `/quy-trinh-gui-hang/` | Đặt sớm | CHƯA VIẾT |

Quy trình mỗi bài: Content Agent soạn (`status: 'draft'`) → kiểm dữ kiện với nguồn → owner/chuyên môn duyệt → đổi `ready` → `npm test` → PR. Dữ liệu chi tiết từ khóa/ý tưởng: `G01_KEYWORD_COMPETITOR_RESEARCH.md` §5–6.
