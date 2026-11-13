# Khung "Phòng chat chung VIP GROUP" trên trang chủ (VIP CHAT V1.0)

Mã: `src/components/CommunityChat.astro` (giao diện) + `src/lib/community-chat.ts` (script, Astro đóng gói thành file `_astro/*.js`).
Hợp đồng API: `GET <API>/portal/public/community` (repo CRM `docs/VIP_CHAT_V1_CONTRACT.md` §5.4).

## Biến build

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PUBLIC_CHAT_WIDGET` | (không đặt) = TẮT | `1` → render khung trên trang chủ + thêm origin API vào CSP `connect-src` |
| `PUBLIC_CHAT_API_BASE` | `https://khachhang.vipgroup.com.vn` | Gốc API. Đặt **rỗng** (`PUBLIC_CHAT_API_BASE=`) → gọi cùng origin `/portal/public/community`, CSP giữ `connect-src 'self'` |
| `VIPG_BASE` | `/` | Phục vụ dưới thư mục con (vd `/demo-home/`); link/ảnh tuyệt đối được gắn tiền tố (trừ `/portal/…`) |
| `VIPG_OUTDIR` | `./dist` | Thư mục build riêng (không đè `dist/`) |

Biến phải đặt trong shell (không đọc từ `.env`) — CSP và mã client lấy cùng một giá trị trong `astro.config.mjs`.

## Chạy thử với API giả

```bash
node tests/chat-widget/mock-server.mjs 4399 open          # open | closed | locked | error | empty
PUBLIC_CHAT_WIDGET=1 PUBLIC_CHAT_API_BASE=http://127.0.0.1:4399 npm run build && npm run preview
# mở http://localhost:4321/  — đổi trạng thái: curl -X POST http://127.0.0.1:4399/__mock/state/closed
# thêm tin:   curl -X POST http://127.0.0.1:4399/__mock/message
```
(Build này ghi vào `dist/`; build lại không cờ trước khi phát hành, hoặc thêm `VIPG_OUTDIR=./dist-chat` cho cả build và preview.)

## Bản demo trên máy chủ thử nghiệm CRM (cùng origin)

```bash
PUBLIC_CHAT_WIDGET=1 PUBLIC_CHAT_API_BASE= VIPG_BASE=/demo-home/ VIPG_OUTDIR=./dist-demo-home npx astro build
# → phục vụ nội dung dist-demo-home/ tại https://chat-test.vipgroup.com.vn/demo-home/
```

## Kiểm thử trình duyệt (Chromium + WebKit, 390×844 · 360×800 · 1440×900)

```bash
node tests/chat-widget/run.mjs            # tự dựng mock + build dist-chat/ + astro preview, chụp ảnh, kiểm
PLAYWRIGHT=/đường/dẫn/playwright/index.mjs CHAT_EVIDENCE_DIR=/thư/mục node tests/chat-widget/run.mjs
```
Ảnh: `web-<trình duyệt>-<khổ>-<trạng thái>[-sheet].png`. Kiểm: nhãn trạng thái, phiên tiếp theo, số tin, không cuộn ngang,
không chèn HTML từ API, nút Tham gia (cùng tab trên điện thoại / tab mới trên máy tính), khung 520 px cột phải, nút nổi,
sheet toàn màn hình + bẫy focus + Esc trả focus, tin mới sau chu kỳ 10 s, không lỗi console.
Lưu ý: trên WebKit, chính Playwright khi chụp ảnh chèn 1 stylesheet và CSP của site chặn (đúng) → kịch bản trừ đúng số lỗi đó.
