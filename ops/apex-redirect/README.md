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

   Script: kiểm root → kiểm DNS → không nối đôi → dừng nếu Caddyfile đã có khối khác cho tên miền gốc → sao lưu →
   nối khối `redir ... permanent` → `caddy validate` (hỏng thì **khôi phục bản sao lưu, không reload**) → reload → đo 301.

| Mã thoát | Nghĩa |
|---|---|
| 0 | đã nối và reload, hoặc khối đã có từ trước |
| 2 | không phải root / không thấy Caddyfile |
| 3 | DNS tên miền gốc chưa trỏ về 160.22.170.20 |
| 4 | Caddyfile đã có khối KHÁC khai báo tên miền gốc — cần người xem |
| 5 | validate hỏng — Caddyfile đã khôi phục, chưa reload |

**Lùi lại:** chép đè Caddyfile bằng bản `Caddyfile.bak-truoc-vipg-web-015-<ngày giờ>` rồi `caddy validate` + `caddy reload`; xoá bản ghi `A @` ở iNET nếu muốn bỏ hẳn.

Bộ thử: `tests/ops.test.mjs` chạy thật script dưới `/bin/bash`, giả lập `id/getent/docker/curl/sleep` (8 ca, gồm các ca chặn).
