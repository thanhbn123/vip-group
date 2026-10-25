# Vá gốc V-13417 — Caddy dùng chung gắn Caddyfile theo THƯ MỤC

**Máy:** VPS `160.22.170.20`, container `vip-staging-caddy` (Caddy v2.11.4, ảnh `caddy:2` = `sha256:0c994536…`, mạng `host`).
**Bẫy:** container gắn `/srv/vip-staging-proxy/Caddyfile` **theo tệp**. Tệp máy chủ đã đổi inode (máy chủ 528439, container 528434 — đo 24/10 và 25/10/2026),
nên container đang chạy đọc bản cũ: `caddy reload --config /etc/caddy/Caddyfile` báo thành công mà gỡ mất khối mới (25/10 gỡ nhầm `ai-thu` 14:35→17:03).
Mỗi lần có người ghi tệp kiểu tạo tệp mới (`sed -i`, trình soạn thảo) là bẫy lặp lại. (Khởi động lại container nhiều khả năng gắn lại đúng tệp mới — **chưa đo**.)
**Vá:** dựng lại container y hệt (đo bằng `docker inspect` 25/10), chỉ đổi mount sang `/srv/vip-staging-proxy:/etc/caddy:ro`.
Ổ `vip-staging-caddy-config` / `vip-staging-caddy-data` giữ nguyên ⇒ không phải xin lại chứng chỉ.

## Chạy (root)

Chạy trong `tmux` (mất kết nối ssh thì script vẫn chạy tới cuối; nhật ký nằm trong thư mục bằng chứng):

```bash
DRY_RUN=1 bash doi-mount-thu-muc-root.sh   # chỉ đo + adapt + validate + in kế hoạch
bash doi-mount-thu-muc-root.sh             # chạy thật — gián đoạn vài giây mọi site dùng chung
```

Script làm theo thứ tự: container **đang chạy** và cấu hình **khớp đúng bản đo** (tuỳ chọn chưa đo phải ở mặc định; giá trị `XDG_*` đúng `/config`, `/data`) →
cấu hình **đang chạy** (cổng 2019) **trùng** kết quả `caddy adapt` tệp máy chủ → validate bằng container tạm (không mạng) → đo mã trả về **mọi site**
(phải có site trả lời được) → cất bằng chứng ở `/root/thung-rac/V-13417-doi-mount-caddy-<giờ>/` → dừng container cũ, **đổi tên giữ lại** (`restart=no`)
→ dựng mới → chờ cổng 2019 → kiểm **inode khớp** → đo lại, so từng site. Từ lúc dừng container cũ: lệnh nào hỏng hoặc Ctrl-C ⇒ tự trả về.
Trả về = dừng chắc container mới (còn chạy thì **không** bật cũ) → cất mới với `restart=no` → đổi tên cũ về → bật → chờ 2019 → nạp tệp máy chủ qua `/tmp` → **đo lại**.

| Mã | Nghĩa |
|---|---|
| 0 | xong (hoặc đã gắn thư mục từ trước) — container cũ giữ ở `vip-staging-caddy-cu-<giờ>` |
| 2 | không phải root / không thấy Caddyfile |
| 3 | không thấy / không chạy / cấu hình khác bản đo 25/10, hoặc trước khi làm không site nào trả lời — **không dựng theo đoán** |
| 4 | cấu hình đang chạy khác tệp máy chủ — dựng lại sẽ lén áp thay đổi. Muốn áp: nạp tệp máy chủ qua `/tmp`, kiểm site, rồi chạy lại |
| 5 | validate hỏng — chưa đụng gì |
| 6 | container mới không lên / inode lệch / mã site đổi / lệnh hỏng giữa chừng ⇒ **đã tự trả về container cũ**, đo lại khớp lúc trước |
| 7 | trả về không trọn (mới không dừng được, cũ không lên, hay đo lại khác) — **người xử ngay**, theo `LY-DO.txt` |

Sau khi ổn vài ngày, xoá container cũ bằng tay: `docker rm vip-staging-caddy-cu-<giờ>` (script không tự xoá).
Từ đó, sửa Caddyfile rồi `docker exec vip-staging-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` là đủ — **mọi cách ghi tệp** (kể cả `sed -i`) đều thấy được.

**Chưa đo:** chạy thật trên VPS. Chưa đo trên Docker thật: `stat -c %i` qua mount thư mục, busybox trong `caddy:2`. Bộ thử `tests/caddy-mount.test.mjs` (23 ca) chạy thật script dưới `/bin/bash`; docker/curl/python3 giả lập có trạng thái (container nào chạy, gắn kiểu gì).
