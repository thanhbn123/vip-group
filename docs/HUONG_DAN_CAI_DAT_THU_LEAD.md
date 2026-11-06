# HƯỚNG DẪN CÀI ĐẶT THU LEAD — dành cho anh (owner)

Làm lần lượt **A → B → C → D → E**. Mất khoảng 30–40 phút. Mỗi bước có ô ☐ để đánh dấu.

> **Quy tắc an toàn:** các giá trị đánh dấu 🔒 là **bí mật** — chỉ dán vào Google Apps Script hoặc Cloudflare, **không gửi qua chat/Zalo/email**, kể cả gửi cho em. Giá trị đánh dấu 🌐 là công khai, gửi em được.

Anh cần chuẩn bị một chỗ ghi tạm (ví dụ Notes trên máy) để ghi 5 giá trị:

| Tên | Lấy ở bước | Loại |
|---|---|---|
| `SHEET_WEBHOOK_SECRET` | A2 | 🔒 |
| `SHEET_WEBHOOK_URL` | A5 | 🔒 |
| `ZALO_BOT_TOKEN` | B1 | 🔒 |
| `ZALO_NOTIFY_CHAT_ID` | B2 | 🔒 |
| `TURNSTILE_SECRET` | C1 | 🔒 |
| **Site Key** Turnstile | C1 | 🌐 gửi em |

Xong bước E thì **xoá ghi chú tạm**.

---

## A. Google Sheet sổ lead (Google Workspace công ty)

☐ **A1. Tạo Sheet.** Đăng nhập Google bằng tài khoản công ty (vd. `viporder@vipgroup.com.vn`) → mở `https://sheets.new` → đặt tên **Lead vipgroup.com.vn**.

☐ **A2. Tạo khoá bí mật cho Sheet.** Trên Mac mở **Terminal**, gõ:
```bash
openssl rand -hex 32
```
Ra một chuỗi 64 ký tự → đó là 🔒 `SHEET_WEBHOOK_SECRET`. Ghi tạm.

☐ **A3. Dán mã Apps Script.** Trong Sheet: menu **Tiện ích mở rộng → Apps Script**. Xoá hết mã mẫu trong `Code.gs`, dán toàn bộ nội dung file
`~/Projects/vip-group-com-vn-bang-gia/ops/lead-sheet/Code.gs` (mở bằng TextEdit → Cmd+A → Cmd+C). Bấm 💾 **Lưu**. Đặt tên dự án: *VIP GROUP Lead*.

☐ **A4. Nhập khoá + chạy cài đặt.**
1. Bên trái bấm ⚙️ **Cài đặt dự án** → kéo xuống **Thuộc tính tập lệnh** → **Thêm thuộc tính**: tên `SHEET_WEBHOOK_SECRET`, giá trị = chuỗi A2 → **Lưu**.
2. (Để sau, khi phiên CRM có địa chỉ) thêm `CRM_INTAKE_URL` và `LEAD_INTAKE_SECRET`. **Bây giờ chưa cần** — lead sẽ ghi "chưa cấu hình CRM" và tự đồng bộ khi có.
3. Quay lại **Trình chỉnh sửa** (<>), ô chọn hàm ở thanh trên chọn **caiDat** → **Chạy**.
4. Google hỏi quyền: **Xem xét quyền** → chọn tài khoản → **Nâng cao** → **Đi tới VIP GROUP Lead (không an toàn)** → **Cho phép**. (Cảnh báo này xuất hiện vì đây là script nội bộ của chính anh.)
5. Nhật ký phải ghi: `OK: đã tạo trigger, SHEET_WEBHOOK_SECRET hợp lệ`. Sheet có thêm tab **Leads** với dòng tiêu đề.

☐ **A5. Triển khai thành Web app.** Góc trên phải **Triển khai → Tùy chọn triển khai mới** → bánh răng chọn **Ứng dụng web**:
- Thực thi dưới dạng: **Tôi**
- Người có quyền truy cập: **Bất kỳ ai** *(bắt buộc để Cloudflare gọi được; không có khoá A2 thì không ghi được gì)*
- **Triển khai** → copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`) → 🔒 `SHEET_WEBHOOK_URL`.

> Nếu không thấy lựa chọn **Bất kỳ ai** (chỉ có "Bất kỳ ai trong vipgroup.com.vn"): quản trị Google Workspace đang chặn chia sẻ ra ngoài. Vào `admin.google.com` → Ứng dụng → Google Workspace → Drive và Tài liệu → Cài đặt chia sẻ → cho phép chia sẻ ra bên ngoài, rồi làm lại A5. Báo em nếu vướng.

> Sau này nếu sửa mã Apps Script: **Triển khai → Quản lý triển khai → ✏️ → Phiên bản: Mới → Triển khai** (giữ nguyên URL).

---

## B. Bot Zalo thông báo (giống viporder.com.vn, bot RIÊNG cho VIP GROUP)

☐ **B1. Tạo bot.** Trên điện thoại, dùng Zalo của số **0961102655**: tìm **"Zalo Bot Creator"** (hoặc mở `https://bot.zapps.me`) → **Tạo bot** → tên *VIP GROUP Lead* → copy **token** (dạng `12345678:abc…`) → 🔒 `ZALO_BOT_TOKEN`.

☐ **B2. Lấy chat id.** Trên Mac, Terminal:
```bash
cd ~/Projects/vip-group-com-vn-bang-gia
node ops/lead-sheet/zalo-chat-id.mjs
```
Dán token (không hiện ra) → Enter. **Trong lúc máy báo "Đang chờ…"**, mở Zalo 0961102655, nhắn cho bot *VIP GROUP Lead* một tin bất kỳ ("hi"). Máy in ra `ZALO_NOTIFY_CHAT_ID=…` → 🔒 ghi tạm.

☐ **B3. Gửi thử.**
```bash
node ops/lead-sheet/zalo-chat-id.mjs --test
```
Dán token, dán chat id → Zalo 0961102655 nhận tin "✅ VIP GROUP: thông báo lead đã hoạt động."

---

## C. Cloudflare Turnstile (chống spam form, miễn phí)

☐ **C1.** Đăng nhập `https://dash.cloudflare.com` (tài khoản đang chứa dự án Pages `vip-group`) → menu trái **Turnstile** → **Add widget**:
- Widget name: *vipgroup.com.vn – form lead*
- Hostnames: thêm `vipgroup.com.vn`, `www.vipgroup.com.vn`, `vip-group.pages.dev`
- Widget mode: **Managed**
- **Create** → màn hình hiện **Site Key** 🌐 (gửi em) và **Secret Key** 🔒 `TURNSTILE_SECRET`.

---

## D. Nhập bí mật vào Cloudflare Pages

☐ **D1.** `https://dash.cloudflare.com` → **Workers & Pages** → **vip-group** → **Settings** → **Variables and Secrets**.

☐ **D2.** Ở môi trường **Production**, bấm **Add** 5 lần, mỗi lần chọn **Type: Secret**:

| Variable name | Value |
|---|---|
| `TURNSTILE_SECRET` | 🔒 C1 Secret Key |
| `SHEET_WEBHOOK_URL` | 🔒 A5 |
| `SHEET_WEBHOOK_SECRET` | 🔒 A2 |
| `ZALO_BOT_TOKEN` | 🔒 B1 |
| `ZALO_NOTIFY_CHAT_ID` | 🔒 B2 |

→ **Save**.

☐ **D3.** Chuyển sang môi trường **Preview**, nhập **đúng 5 biến như trên** (để em kiểm trên bản thử `staging` / `pr-…` trước khi lên web thật) → **Save**.

---

## E. Báo em

☐ **E1.** Nhắn em: *"đã cài xong, Site Key là 0x…"* (chỉ Site Key 🌐 — không gửi gì khác).

Em sẽ: ghi Site Key vào mã → mở PR → bản thử (staging) có form thật → **anh gửi thử 1 lead trên bản thử**: phải thấy (1) dòng mới trong Sheet, (2) tin Zalo trên 0961102655 → anh duyệt → em phát hành lên www.vipgroup.com.vn.

☐ **E2.** Xoá ghi chú tạm chứa các giá trị 🔒.

---

## Khi cần

- **Tắt thu lead khẩn cấp:** Cloudflare → vip-group → Settings → Variables → xoá `TURNSTILE_SECRET` → Retry deployment gần nhất. Form sẽ báo "chưa gửi được" kèm Hotline/Zalo.
- **Đổi người nhận Zalo:** lặp B2 với tài khoản Zalo mới → sửa `ZALO_NOTIFY_CHAT_ID` trên Cloudflare.
- **Lộ khoá:** tạo khoá mới (A2 / Turnstile Rotate / tạo lại token bot) và thay ở cả hai nơi.
- **Nối CRM** (khi phiên CRM có endpoint): Apps Script → Thuộc tính tập lệnh → thêm `CRM_INTAKE_URL`, `LEAD_INTAKE_SECRET` (giống khoá bên CRM). Lead cũ "chưa cấu hình CRM" tự được đẩy sang trong vòng 10 phút.
