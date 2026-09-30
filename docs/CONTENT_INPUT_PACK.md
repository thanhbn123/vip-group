# CONTENT INPUT PACK — dữ liệu owner cần cung cấp (V-11501)

> **Gate chặn production về nội dung.** Controller không tự điền, không suy đoán. Cột "Ví dụ định dạng" chỉ minh hoạ khuôn — **không phải dữ liệu thật và không được đưa vào website**.
> Quét toàn bộ `src/` ngày 30/09/2026.

| # | Trường | Placeholder hiện tại | Chỗ dùng trên site | Định dạng cần | Ví dụ định dạng (KHÔNG dùng) |
|---|---|---|---|---|---|
| 1 | Hotline chính thức | `contact.hotline = null` → hiện "Đang cập nhật" | Footer mọi trang (Hotline) · `/lien-he/` (Hotline, thành link `tel:`) · schema.org `telephone` | Số điện thoại Việt Nam, có thể có khoảng trắng; ghi rõ là hotline chung hay theo khối | `0XXX XXX XXX` |
| 2 | Địa chỉ pháp lý | `contact.address = null` → "Đang cập nhật" | Footer mọi trang (Địa chỉ) · `/lien-he/` · schema.org `address` | Một dòng đầy đủ: số nhà, đường, phường/xã, quận/huyện, tỉnh/thành | `Số ___, đường ___, phường ___, ___, tỉnh ___` |
| 3 | Tên pháp lý VIP GROUP | `company.legalName = null` → footer hiện "© năm VIP GROUP" | Footer mọi trang (dòng ©) · schema.org `legalName` | Đúng tên trên giấy phép đăng ký doanh nghiệp | `CÔNG TY ___ ___` |
| 4 | Pháp nhân khối Công nghệ | nhãn "Công ty thành viên khối Công nghệ" + "Đang hoàn thiện" | Trang chủ (Hệ sinh thái) · `/cong-ty-thanh-vien/` | Tên hiển thị + tên pháp lý đầy đủ (+ website nếu có) | `Tên hiển thị: ___` / `Tên pháp lý: CÔNG TY ___` |
| 5 | Pháp nhân khối Bất động sản | nhãn "Công ty thành viên khối Bất động sản" + "Đang hoàn thiện" | Trang chủ · `/cong-ty-thanh-vien/` | Như #4 | như #4 |
| 6 | Website VIPORDER chính thức | `subsidiaries.viporder.url = null` → không có link | Thẻ VIPORDER ở trang chủ và `/cong-ty-thanh-vien/` (nút "Website thành viên", mở tab mới) | URL đầy đủ `https://…` | `https://___.___` |
| 7 | Logo chính thức | Logo chữ "VIP" (`Logo.astro`), `public/logo.svg`, `favicon.svg/.ico`, `apple-touch-icon.png`, ảnh OG | Header mọi trang · favicon · schema.org `logo` · ảnh chia sẻ Open Graph | SVG (ưu tiên) hoặc PNG ≥ 512 px nền trong suốt; bản cho nền tối; biểu tượng vuông cho favicon | `logo-vip-group.svg`, `logo-icon.svg` |
| 8 | Email tuyển dụng | `careers.applyEmail = null` → dùng `contact@vipgroup.com.vn` | `/tuyen-dung/` (link `mailto:` gửi hồ sơ) | Địa chỉ email thuộc tên miền công ty, đang nhận thư | `___@vipgroup.com.vn` |

## Phân loại trước production (30/09/2026)

> Đây là **phân loại sẵn sàng sản phẩm** của Controller, không phải ý kiến pháp lý. Nghĩa vụ công bố thông tin theo pháp luật (nếu có) cần owner / tư vấn pháp lý xác nhận.
> Tiêu chí: website là **trang chính thức** của VIP GROUP — người đọc phải xác định được **ai** vận hành và **nhận diện thương hiệu** đúng. Mục thiếu mà không làm sai lệch điều đó, và site đã có đường liên hệ thay thế, thì có thể giữ placeholder.

| # | Trường | Phân loại | Lý do |
|---|---|---|---|
| 1 | Hotline | CAN_REMAIN_PLACEHOLDER | Đã có email `contact@vipgroup.com.vn` làm kênh liên hệ; không có dữ liệu sai |
| 2 | Địa chỉ pháp lý | **MUST_HAVE_BEFORE_PRODUCTION** | Trang chính thức cần cho người đọc biết pháp nhân ở đâu; "Đang cập nhật" ở footer mọi trang làm giảm độ tin cậy của một trang doanh nghiệp chính thức |
| 3 | Tên pháp lý VIP GROUP | **MUST_HAVE_BEFORE_PRODUCTION** | Xác định pháp nhân vận hành website (dòng ©, schema.org `legalName`) |
| 4 | Pháp nhân khối Công nghệ | CAN_REMAIN_PLACEHOLDER | Đã ghi rõ "Đang hoàn thiện pháp nhân", không mạo danh tên pháp lý |
| 5 | Pháp nhân khối Bất động sản | CAN_REMAIN_PLACEHOLDER | Như #4 |
| 6 | Website VIPORDER | CAN_REMAIN_PLACEHOLDER | Thẻ VIPORDER vẫn đúng, chỉ thiếu link |
| 7 | Logo chính thức | **MUST_HAVE_BEFORE_PRODUCTION** | Logo chữ "VIP" là placeholder kỹ thuật; phát hành chính thức cần nhận diện thương hiệu thật (header, favicon, ảnh chia sẻ OG, schema.org `logo`) |
| 8 | Email tuyển dụng | CAN_REMAIN_PLACEHOLDER | Tự động dùng `contact@vipgroup.com.vn`; chưa có vị trí tuyển nào được đăng |

**Kết luận:** CONTENT gate còn **3 mục MUST_HAVE** (#2, #3, #7). Owner có thể quyết khác (ví dụ chấp nhận phát hành với placeholder) — khi đó ghi quyết định vào `docs/verification/`.

**Đã có, không cần cung cấp:** email liên hệ `contact@vipgroup.com.vn` · slogan "Kết nối giá trị – Kiến tạo tương lai" · 3 trụ cột · VIPORDER là công ty thành viên.

**Cách gửi:** một tin nhắn / một file liệt kê 8 mục theo số thứ tự; logo gửi dạng file. Mục nào chưa có thì ghi "chưa có" — site giữ placeholder cho mục đó.

**Sau khi nhận:** Controller sửa `src/data/vi/*.ts` (và logo trong `public/`, `design/`) qua Issue → PR → CI → verifier → merge `develop` → staging; test chặn chuỗi chưa có nguồn (`tests/content.test.mjs`) sẽ được cập nhật theo dữ liệu thật.
