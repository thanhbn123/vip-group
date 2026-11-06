# G10 — Google Search Console & theo dõi hiển thị trên Google / AI Overview / Gemini

**Phạm vi:** vipgroup.com.vn — trang chủ lực `/logistics/van-chuyen-tham-quyen-viet-nam/` và khu `/logistics/`.
**Soạn:** phiên ec, 06/11/2026 · **Trạng thái:** kế hoạch, chưa thực hiện.
**Nguyên tắc:** chỉ ghi kết quả đo thực tế, có ngày giờ và ảnh chụp. Không tuyên bố "đã lên top" hay "đã được AI trích dẫn" khi chưa có bằng chứng. Không cam kết thứ hạng.

---

## Phần A — Google Search Console (GSC)

### A1. Xác minh quyền sở hữu

DNS iNET đã có bản ghi TXT `google-site-verification=…` (theo phiên 8d).

1. Vào https://search.google.com/search-console, đăng nhập bằng tài khoản Google của owner.
2. Thêm property loại **Domain** với giá trị `vipgroup.com.vn` (bao gồm cả `www` và các subdomain).
3. Bấm **Xác minh**. Nếu báo chưa thấy bản ghi: chờ DNS cập nhật (thường vài phút, có thể tới 24 giờ) rồi thử lại.
4. Thêm người dùng (Cài đặt → Người dùng và quyền): người làm SEO được cấp **Toàn quyền**, người chỉ xem báo cáo được cấp **Bị hạn chế**. Không gửi mật khẩu cho ai.

Ghi vào sổ nghiệm thu: ngày xác minh, tài khoản sở hữu, ảnh chụp màn hình trạng thái "Đã xác minh".

### A2. Gửi sitemap (sau khi phát hành production)

1. Kiểm tra trước: mở `https://www.vipgroup.com.vn/sitemap.xml`. Phải có `/logistics/van-chuyen-tham-quyen-viet-nam/` và các trang `/logistics/` ở trạng thái `ready`. Không được có trang nháp hoặc trang noindex.
2. Kiểm tra `https://www.vipgroup.com.vn/robots.txt` có dòng `Sitemap: https://www.vipgroup.com.vn/sitemap.xml`.
3. GSC → **Sơ đồ trang web** → nhập `sitemap.xml` → **Gửi**.
4. Sau 1–3 ngày: trạng thái phải là "Thành công", "Số URL đã phát hiện" phải bằng số URL thực có trong sitemap.

### A3. Kiểm tra URL và yêu cầu lập chỉ mục

Làm cho từng URL ưu tiên, theo thứ tự sau:

| # | URL | Lý do ưu tiên |
|---|-----|---------------|
| 1 | `/logistics/van-chuyen-tham-quyen-viet-nam/` | Trang dịch vụ chủ lực |
| 2 | `/` | Trang chủ (có bảng giá song ngữ) |
| 3 | `/logistics/` | Hub |
| 4 | `/logistics/van-chuyen-trung-quoc-viet-nam/` | Cụm rộng |
| 5 | `/logistics/van-chuyen-trung-quoc-bac-ninh/` | Cụm địa phương |
| 6 | `/logistics/cau-hoi-thuong-gap/` | FAQ |
| 7 | Các bài kiến thức đã duyệt | Hỗ trợ chủ đề |

Các bước cho mỗi URL:

1. Dán URL đầy đủ (bắt đầu bằng `https://www.`) vào ô **Kiểm tra URL** ở đầu trang GSC.
2. Bấm **Kiểm tra URL đang hoạt động** và xác nhận:
   - "Trang có thể được lập chỉ mục";
   - URL chuẩn (canonical) do người dùng khai báo trùng với URL đang kiểm tra;
   - **Dữ liệu có cấu trúc / Kết quả nhiều định dạng**: FAQ, Breadcrumb hợp lệ, không có lỗi.
3. Bấm **Yêu cầu lập chỉ mục**. Mỗi ngày GSC chỉ cho một số lượt nhất định, vì vậy chỉ yêu cầu các URL ưu tiên.
4. Ghi vào sổ: ngày yêu cầu, kết quả kiểm tra, ảnh chụp màn hình.
5. Sau 3–7 ngày, kiểm tra lại. Ghi trạng thái "Đã lập chỉ mục" hoặc lý do bị loại, ví dụ "Đã thu thập dữ liệu – hiện chưa được lập chỉ mục".

Kiểm tra bổ sung ngoài GSC:
- **Rich Results Test** (https://search.google.com/test/rich-results) cho URL #1: kiểm FAQPage và BreadcrumbList.
- **Schema Markup Validator** (https://validator.schema.org): kiểm Service, Organization, WebPage. Các loại này không tạo kết quả nhiều định dạng nhưng giúp Google hiểu đúng thực thể.
- **PageSpeed Insights** cho URL #1, đo cả di động và máy tính. Ghi điểm LCP, INP, CLS.

### A4. Báo cáo truy vấn (Hiệu suất → Kết quả tìm kiếm)

Mỗi tuần (thứ Hai), lọc **Truy vấn** theo các mẫu sau rồi xuất CSV vào `evidence/gsc/YYYY-MM-DD/`:

| Bộ lọc (Truy vấn chứa) | Mục đích |
|---|---|
| `thâm quyến` | Cụm chính |
| `thẩm quyến` | Lỗi chính tả phổ biến |
| `tham quyen` | Gõ không dấu |
| `shenzhen` | Từ khóa tiếng Anh |
| `深圳` | Khách tìm bằng tiếng Trung |
| `trung việt` | Cụm "vận chuyển trung việt" |
| `vip group` · `viporder` | Truy vấn thương hiệu |

Ghi lại cho từng truy vấn: số lần hiển thị, số lần nhấp, CTR, vị trí trung bình. Đọc theo xu hướng 4 tuần, không kết luận từ một ngày đơn lẻ. Lưu ý: GSC tính lượt hiển thị trong AI Overview chung vào báo cáo "Web", không tách riêng.

Lọc thêm **Trang** = URL #1 để xem trang thực sự đang hiện cho những truy vấn nào. Đây là căn cứ để bổ sung câu hỏi FAQ.

### A5. Lập chỉ mục và trải nghiệm (hằng tháng)

- **Trang (Lập chỉ mục)**: liệt kê URL bị loại và lý do. Trang nháp hoặc pending bị noindex là bình thường; trang `ready` bị loại thì cần xử lý.
- **Chỉ số Web Chính**: phải không có URL nào ở mức "Kém".
- **Nâng cao → Đoạn trích thường gặp (FAQ)**: số mục hợp lệ phải bằng số câu trong FAQPage.

---

## Phần B — Theo dõi hiển thị trên Google Search, AI Overview và Gemini

### B1. Bộ truy vấn chuẩn (cố định, không đổi giữa các lần đo)

| ID | Truy vấn | Nhóm |
|---|---|---|
| Q01 | vận chuyển trung việt từ thâm quyến về việt nam | Chính |
| Q02 | vận chuyển hàng từ thâm quyến về việt nam | Chính |
| Q03 | ship hàng thâm quyến về hà nội | Tuyến |
| Q04 | vận chuyển thâm quyến về bắc ninh | Tuyến địa phương |
| Q05 | giá cước vận chuyển thâm quyến việt nam | Giá cước |
| Q06 | vận chuyển từ thâm quyến về việt nam mất bao lâu | Thời gian |
| Q07 | nhận hàng tại thâm quyến gửi về việt nam | Địa điểm nhận |
| Q08 | kho thâm quyến vận chuyển về việt nam | Địa điểm nhận |
| Q09 | quy trình gửi hàng từ thâm quyến về việt nam | Quy trình |
| Q10 | nhập khẩu chính ngạch hàng thâm quyến | Chính ngạch |
| Q11 | vận chuyển thẩm quyến về việt nam | Lỗi chính tả |
| Q12 | 深圳到越南物流 | Tiếng Trung |
| Q13 | 深圳发货到越南河内 | Tiếng Trung |
| Q14 | VIP GROUP vận chuyển thâm quyến | Thương hiệu |

### B2. Môi trường đo (để kết quả so sánh được giữa các lần)

- Trình duyệt Chrome ở **cửa sổ ẩn danh**, không đăng nhập. Riêng Gemini phải đăng nhập, dùng một tài khoản cố định dành riêng cho việc đo, không có lịch sử trò chuyện.
- Truy cập `google.com.vn`, ngôn ngữ giao diện tiếng Việt. Với Q12 và Q13, đo thêm một lần với ngôn ngữ giao diện tiếng Trung giản thể (`hl=zh-CN`).
- Ghi vị trí mạng gần đúng (ví dụ Bắc Ninh hoặc Hà Nội) vì kết quả Google thay đổi theo vị trí. Đo trên cả máy tính và điện thoại.
- Không bấm vào kết quả của chính mình trong lúc đo.

### B3. Tần suất

| Giai đoạn | Google Search + AI Overview | Gemini | Ghi chú |
|---|---|---|---|
| Trước phát hành | 1 lần (baseline) | 1 lần | Mốc so sánh |
| Tuần 1–4 sau phát hành | Hằng tuần | 2 tuần/lần | Theo dõi lập chỉ mục |
| Tháng 2–3 | 2 tuần/lần | Hằng tháng | |
| Từ tháng 4 | Hằng tháng | Hằng tháng | |

### B4. Ghi nhận cho mỗi truy vấn

Lưu vào `evidence/ai-search/YYYY-MM-DD/` gồm một file `ket-qua.csv` và ảnh chụp toàn trang `QID-<kenh>.png`.

| Cột | Giá trị |
|---|---|
| `ngay_gio` | ISO, giờ Việt Nam |
| `query_id` / `query` | Theo bảng B1 |
| `kenh` | `google-web` · `ai-overview` · `ai-mode` · `gemini` |
| `thiet_bi` | desktop / mobile |
| `vi_tri_organic` | Thứ hạng của vipgroup.com.vn trong 10 kết quả xanh đầu tiên (1–10), hoặc `>10` / `khong` |
| `url_xuat_hien` | URL vipgroup.com.vn cụ thể xuất hiện |
| `ai_overview_hien` | có / không (có khối AI Overview cho truy vấn này hay không) |
| `ai_trich_vipgroup` | có / không (vipgroup.com.vn có trong danh sách nguồn được trích hay không) |
| `ai_vi_tri_nguon` | Vị trí của vipgroup.com.vn trong danh sách nguồn (1 = đầu tiên) |
| `ai_noi_dung_dung` | đúng / sai / một phần — thông tin AI nêu về VIP GROUP (giá, Hotline) có khớp với trang không |
| `doi_thu_duoc_trich` | Tên miền các đơn vị khác được trích |
| `ghi_chu` | |

**Gemini:** hỏi nguyên văn câu trong B1, và hỏi thêm câu "Đơn vị nào nhận hàng tại Thâm Quyến vận chuyển về Bắc Ninh?". Ghi các thông tin sau:
- câu trả lời có nhắc VIP GROUP hoặc VIPORDER không;
- có kèm link nguồn không;
- thông tin nêu ra (giá, Hotline 0961 102 655) đúng hay sai.

### B5. Đọc kết quả và hành động

| Tình huống | Hành động |
|---|---|
| URL chưa được lập chỉ mục sau 14 ngày | Kiểm tra lại URL trong GSC; tăng link nội bộ trỏ tới trang; kiểm tra nội dung có quá mỏng không |
| Có thứ hạng organic nhưng AI Overview không trích | Rà lại đoạn trả lời trực tiếp đầu trang: có đủ con số không (giá, thời gian, địa điểm)? Thêm câu FAQ đúng nguyên văn câu hỏi AI Overview đang trả lời |
| AI nêu sai thông tin về VIP GROUP | Sửa cho thông tin trên trang rõ ràng và nhất quán (trang chủ, trang tuyến, FAQ, schema), rồi ghi nhận lại ở lần đo sau. Có thể gửi phản hồi qua nút "Phản hồi" trên khối AI Overview |
| Đối thủ được trích, VIP GROUP không | Ghi lại cấu trúc trang của đối thủ (bảng, số liệu, ngày cập nhật) để tham khảo. Không sao chép nội dung |
| Truy vấn tiếng Trung không có hiển thị | Bình thường trong 1–3 tháng đầu. Kiểm tra khối `lang="zh-CN"` có hiển thị trong HTML hay không |

### B6. Báo cáo cho owner (hằng tháng, 1 trang)

- Bảng 14 truy vấn × 4 kênh: so sánh lần đo trước với lần đo này.
- Số liệu GSC: lượt hiển thị, lượt nhấp, CTR của cụm Thâm Quyến.
- Số lượt `call_click`, `zalo_click` từ trang #1, sau khi đã gắn GA4.
- Ghi rõ: "Đây là quan sát tại thời điểm đo, kết quả có thể thay đổi theo người dùng, vị trí và thời gian."

---

## Phần C — Câu hỏi AI Overview cần trang trả lời bằng con số

| Chủ đề | Câu hỏi mẫu | Trạng thái dữ liệu |
|---|---|---|
| Giá cước | Vận chuyển Thâm Quyến về Việt Nam giá bao nhiêu? | **Có**: 5 mức giá, từ 12.000 đến 20.000 đ/kg (`pricing.ts`). Cần owner trả lời giá tính theo kiện hay theo lô |
| Thời gian | Mất bao lâu? | **Chưa có**: cần owner cho số ngày về Hà Nội, Bắc Ninh, Lạng Sơn, TP.HCM |
| Địa điểm nhận | Nhận hàng ở đâu tại Thâm Quyến? | **Owner xác nhận** có nhận hàng trực tiếp tại Thâm Quyến. Địa chỉ chưa có. Hỏi owner có cho công khai cấp quận không |
| Quy trình | Gửi hàng thế nào? | **Có** (quy trình 4 bước VIPORDER, mở rộng thành 6 bước) |
| Phạm vi | Giao tới đâu? | **Có một phần**: Bắc Ninh, Từ Sơn, Đồng Kỵ. Chưa xác nhận phạm vi toàn quốc |

Thiếu số liệu thời gian thì AI Overview nhiều khả năng sẽ trích nguồn khác cho câu hỏi "mất bao lâu". Đây là dữ liệu đáng xin owner nhất.
