# Chuyển hướng `vipgroup.com.vn` → `https://www.vipgroup.com.vn` (VIPG-WEB-015)

Web thật chạy ở Cloudflare Pages qua `www` CNAME → `vip-group.pages.dev` (phương án B, owner chọn 24/10/2026 — DNS giữ ở iNET).
Tên miền gốc không gắn được vào Pages khi DNS không nằm ở Cloudflare, và DNS iNET (OneShield) không có loại bản ghi chuyển hướng URL.
Nên tên miền gốc trỏ về VPS `160.22.170.20`, nơi Caddy dùng chung chỉ trả **301** sang `www` — VPS không phục vụ nội dung web.

## Hai bước, đúng thứ tự

1. **DNS (iNET OnePortal → OneShield → DNS → Thêm bản ghi):** `A  @  160.22.170.20`, TTL 5 phút, **Bảo vệ: Tắt**.
   Không sửa MX / SPF / DKIM / google-site-verification. Kiểm: `dig +short A vipgroup.com.vn @ns1.vclouddns.vn` ra `160.22.170.20`.
2. **Root trên VPS** (cần root vì `/srv/vip-staging-proxy/Caddyfile` do root giữ):

   ```bash
   sudo bash noi-caddy-apex-root.sh
   ```

   Script: kiểm root → kiểm DNS (IPv4) → không nối đôi → dừng nếu Caddyfile đã có khối khác cho tên miền gốc
   (tách từng địa chỉ: có scheme, cổng, danh sách, chữ hoa đều nhận ra; `www.`/tên miền con/`*.` thì không) → sao lưu →
   nối khối `redir ... permanent` → `caddy validate` (hỏng: **khôi phục, không reload**) → reload (hỏng: **khôi phục**) →
   **đo**: `http://` và `https://` tên miền gốc đều phải 301 sang `https://www.vipgroup.com.vn/...` (thử lại tối đa 6 lượt, cách 10 giây).
   Chạy lại khi khối đã có: không nối, chỉ đo lại.

| Mã thoát | Nghĩa |
|---|---|
| 0 | đã nối + reload (hoặc khối đã có) **và đo được 301 sang www** |
| 2 | không phải root / không thấy Caddyfile |
| 3 | DNS tên miền gốc chưa trỏ về 160.22.170.20 |
| 4 | Caddyfile đã có khối KHÁC khai báo tên miền gốc — cần người xem |
| 5 | validate hỏng — Caddyfile đã khôi phục, chưa reload |
| 6 | reload hỏng — Caddy vẫn chạy cấu hình cũ, Caddyfile đã khôi phục |
| 7 | đã nạp cấu hình nhưng **chưa đo được 301 sang www** (thường là chứng chỉ đang cấp — chạy lại sau ít phút) |

**Lùi lại:** chép đè Caddyfile bằng bản `Caddyfile.bak-truoc-vipg-web-015-<ngày giờ>` rồi `caddy validate` + `caddy reload`; xoá bản ghi `A @` ở iNET nếu muốn bỏ hẳn.

Bộ thử: `tests/ops.test.mjs` chạy thật script dưới `/bin/bash`, giả lập `id/getent/docker/curl/sleep` (10 ca, gồm mọi mã thoát và các dạng địa chỉ Caddy; đột biến ở mọi cửa chặn đều bị bắt).
