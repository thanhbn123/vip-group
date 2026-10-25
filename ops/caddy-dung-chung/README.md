# Vá gốc V-13417 — Caddy dùng chung gắn Caddyfile theo THƯ MỤC

**Máy:** VPS `160.22.170.20`, container `vip-staging-caddy` (Caddy v2.11.4, ảnh `caddy:2` = `sha256:0c994536…`, mạng `host`).
**Bẫy:** container gắn `/srv/vip-staging-proxy/Caddyfile` **theo tệp**. Tệp máy chủ đã đổi inode (máy chủ 528439, container 528434 — đo 24/10 và 25/10/2026),
nên container đọc bản cũ: `caddy reload --config /etc/caddy/Caddyfile` báo thành công mà gỡ mất khối mới (25/10 gỡ nhầm `ai-thu` 14:35→17:03),
và **mỗi lần container khởi động lại** sẽ mất `vipgroup.com.vn` → www và `ai-thu`.
**Vá:** dựng lại container y hệt (đo bằng `docker inspect` 25/10), chỉ đổi mount sang `/srv/vip-staging-proxy:/etc/caddy:ro`.
Ổ `vip-staging-caddy-config` / `vip-staging-caddy-data` giữ nguyên ⇒ không phải xin lại chứng chỉ.

## Chạy (root)

```bash
DRY_RUN=1 bash doi-mount-thu-muc-root.sh   # chỉ đo + validate + in kế hoạch
bash doi-mount-thu-muc-root.sh             # chạy thật — gián đoạn vài giây mọi site dùng chung
```

Script làm theo thứ tự: kiểm cấu hình container **khớp đúng bản đo** → kiểm tệp máy chủ **trùng bản đang chạy** (`/tmp/Caddyfile.host`) →
validate bằng container tạm (không mạng) → đo mã trả về **mọi site** → cất bằng chứng ở `/root/thung-rac/V-13417-doi-mount-caddy-<giờ>/` →
dừng container cũ, **đổi tên giữ lại** (`restart=no`) → dựng mới → chờ cổng 2019 → kiểm **inode khớp** → đo lại, so từng site.

| Mã | Nghĩa |
|---|---|
| 0 | xong (hoặc đã gắn thư mục từ trước) — container cũ giữ ở `vip-staging-caddy-cu-<giờ>` |
| 2 | không phải root / không thấy Caddyfile |
| 3 | cấu hình container khác bản đo 25/10 — **không dựng theo đoán** |
| 4 | tệp máy chủ khác bản đang chạy — xem diff; đúng ý thì chạy lại với `ALLOW_CONFIG_CHANGE=1` |
| 5 | validate hỏng — chưa đụng gì |
| 6 | container mới không lên / inode lệch / mã site đổi ⇒ **đã tự trả về container cũ** và nạp lại tệp máy chủ qua `/tmp` |
| 7 | trả về cũng hỏng — **người xử ngay**, làm theo `LY-DO.txt` trong thư mục bằng chứng |

Sau khi ổn vài ngày, xoá container cũ bằng tay: `docker rm vip-staging-caddy-cu-<giờ>` (script không tự xoá).
Từ đó, sửa Caddyfile rồi `docker exec vip-staging-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` là đủ — **mọi cách ghi tệp** (kể cả `sed -i`) đều thấy được.

**Chưa đo:** chạy thật trên VPS. Bộ thử `tests/caddy-mount.test.mjs` (12 ca) chạy thật script dưới `/bin/bash` với docker/curl giả lập có trạng thái.
