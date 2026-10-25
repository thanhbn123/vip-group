#!/usr/bin/env bash
# V-13417 — CHẠY BẰNG ROOT TRÊN VPS 160.22.170.20. Vá gốc bẫy "Caddyfile gắn theo TỆP".
#
# Bẫy (đo 24/10 và 25/10/2026): container vip-staging-caddy gắn /srv/vip-staging-proxy/Caddyfile THEO TỆP.
# Tệp máy chủ đổi inode ⇒ container giữ bản CŨ, `caddy reload --config /etc/caddy/Caddyfile` báo thành công
# trên bản cũ và gỡ mất khối mới. Khởi động lại container cũng đọc lại bản cũ.
# Vá: dựng lại container y hệt, CHỈ đổi mount sang THƯ MỤC  /srv/vip-staging-proxy -> /etc/caddy (chỉ đọc).
#
# An toàn:
#   1. Cấu hình container hiện tại phải KHỚP ĐÚNG bản đo 25/10 (ảnh, mạng, lệnh, ổ dữ liệu, biến môi trường) — lệch là dừng (3).
#   2. Tệp máy chủ phải TRÙNG bản đang chạy (/tmp/Caddyfile.host trong container) — khác là dừng (4),
#      để lượt dựng lại không lén áp thay đổi của người khác. ALLOW_CONFIG_CHANGE=1 mới cho đi tiếp.
#   3. Validate tệp máy chủ bằng container tạm (cùng ảnh, không mạng) trước khi đụng gì (5).
#   4. Đo mã trả về của MỌI site TRƯỚC; dừng container cũ, ĐỔI TÊN GIỮ LẠI (không xoá); dựng mới; đo SAU.
#      Lệch bất kỳ site nào, hoặc container mới không lên, hoặc inode không khớp ⇒ TỰ TRẢ VỀ container cũ (6).
#   5. Bằng chứng (inspect cũ, mã trước/sau) cất ở /root/thung-rac/<việc>-<giờ>/ kèm LY-DO.txt (CLAUDE.md §19.5).
# DRY_RUN=1: chỉ đo + validate + in kế hoạch, KHÔNG dừng/dựng gì.
set -euo pipefail
C="${CADDY_CONTAINER:-vip-staging-caddy}"
DIR="${CADDY_DIR:-/srv/vip-staging-proxy}"
IMAGE_ID="${CADDY_IMAGE_ID:-sha256:0c994536bddb66445885237f1a5dcc1916bccea922661c76b4e9fc24061f9b52}"
TRASH_ROOT="${TRASH_ROOT:-/root/thung-rac}"
DRY_RUN="${DRY_RUN:-0}"
ALLOW_CONFIG_CHANGE="${ALLOW_CONFIG_CHANGE:-0}"
WAIT_TRIES="${WAIT_TRIES:-15}"
CMP_TRIES="${CMP_TRIES:-3}"
TS=$(date +%Y%m%d-%H%M%S)
OLD="$C-cu-$TS"
CF="$DIR/Caddyfile"
CMD_JSON='["caddy","run","--config","/etc/caddy/Caddyfile","--adapter","caddyfile"]'

[ "$(id -u)" = 0 ] || { echo "cần root" >&2; exit 2; }
[ -f "$CF" ] || { echo "không thấy $CF" >&2; exit 2; }

# ---------- 1. cấu hình container hiện tại ----------
mounts() { docker inspect "$1" --format '{{range .Mounts}}{{.Type}}:{{.Name}}:{{.Source}}:{{.Destination}}:{{.RW}}{{println}}{{end}}' | sed '/^$/d' | sort; }
cur_mounts=$(mounts "$C")
dir_mount="bind::$DIR:/etc/caddy:false"
if printf '%s\n' "$cur_mounts" | grep -qxF "$dir_mount"; then
  echo "ĐÃ VÁ từ trước: $C gắn thư mục $DIR -> /etc/caddy. Không làm gì."; exit 0
fi
want_mounts=$(printf '%s\n' \
  "bind::$CF:/etc/caddy/Caddyfile:false" \
  "volume:vip-staging-caddy-config:/var/lib/docker/volumes/vip-staging-caddy-config/_data:/config:true" \
  "volume:vip-staging-caddy-data:/var/lib/docker/volumes/vip-staging-caddy-data/_data:/data:true" | sort)
got=$(docker inspect "$C" --format '{{.Image}}|{{.HostConfig.NetworkMode}}|{{.HostConfig.RestartPolicy.Name}}|{{json .Config.Cmd}}|{{json .Config.Entrypoint}}|{{.Config.User}}|{{json .HostConfig.CapAdd}}|{{.HostConfig.Privileged}}|{{.HostConfig.LogConfig.Type}}')
want="$IMAGE_ID|host|unless-stopped|$CMD_JSON|null||null|false|json-file"
envs=$(docker inspect "$C" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed '/^$/d' | cut -d= -f1 | sort | tr '\n' ' ')
want_envs="CADDY_VERSION PATH XDG_CONFIG_HOME XDG_DATA_HOME "
if [ "$got" != "$want" ] || [ "$cur_mounts" != "$want_mounts" ] || [ "$envs" != "$want_envs" ]; then
  echo "Cấu hình $C KHÁC bản đo 25/10 — dừng, không dựng lại theo đoán." >&2
  echo "  đo:   $got" >&2; echo "  cần:  $want" >&2
  echo "  mount đo:"; printf '    %s\n' "$cur_mounts" >&2
  echo "  env đo: $envs | cần: $want_envs" >&2
  exit 3
fi
echo "[1] cấu hình container khớp bản đo 25/10"

# ---------- 2. tệp máy chủ = bản đang chạy? ----------
h_host=$(sha256sum "$CF" | cut -c1-64)
h_run=$(docker exec "$C" sh -c 'sha256sum /tmp/Caddyfile.host 2>/dev/null' | cut -c1-64 || true)
if [ "$h_host" != "$h_run" ]; then
  echo "Tệp máy chủ ($h_host) KHÁC bản đang chạy /tmp/Caddyfile.host (${h_run:-không có})." >&2
  docker exec "$C" sh -c 'cat /tmp/Caddyfile.host 2>/dev/null || cat /etc/caddy/Caddyfile' | diff - "$CF" >&2 || true
  if [ "$ALLOW_CONFIG_CHANGE" != 1 ]; then
    echo "Dừng: dựng lại sẽ áp các thay đổi trên. Xem kỹ rồi chạy lại với ALLOW_CONFIG_CHANGE=1 nếu đúng ý." >&2; exit 4
  fi
  echo "[2] ALLOW_CONFIG_CHANGE=1 — chấp nhận áp thay đổi trên"
else
  echo "[2] tệp máy chủ trùng bản đang chạy ($h_host)"
fi

# ---------- 3. validate trước khi đụng gì ----------
if ! docker run --rm --network none -v "$DIR:/etc/caddy:ro" "$IMAGE_ID" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "validate tệp máy chủ HỎNG — không đụng gì." >&2; exit 5
fi
echo "[3] validate đạt (container tạm, gắn thư mục, không mạng)"

# ---------- 4. danh sách site + đo TRƯỚC ----------
hosts=$(awk '
  { line = $0; sub(/[ \t]#.*$/, "", line); sub(/^[ \t]*#.*$/, "", line) }
  line ~ /\{[ \t]*$/ {
    sub(/\{[ \t]*$/, "", line); gsub(/,/, " ", line); n = split(line, a, /[ \t]+/)
    for (i = 1; i <= n; i++) { h = tolower(a[i]); if (h ~ /^http:\/\//) continue; sub(/^https:\/\//, "", h); sub(/\/.*$/, "", h); sub(/:[0-9]*$/, "", h)
      if (h ~ /^[a-z0-9.-]+\.[a-z]+$/) print h }
  }' "$CF" | sort -u)
[ -n "$hosts" ] || { echo "không tách được site nào từ $CF — dừng." >&2; exit 3; }
do_ma() { for h in $hosts; do printf '%s %s\n' "$h" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$h:443:127.0.0.1" "https://$h/" || true)"; done; }
truoc=$(do_ma)
echo "[4] đo TRƯỚC ($(printf '%s\n' "$truoc" | wc -l | tr -d ' ') site):"; printf '    %s\n' "$truoc"

if [ "$DRY_RUN" = 1 ]; then
  echo "CHẠY KHÔ — CHƯA LÀM: dừng $C → đổi tên $OLD → docker run mới gắn $DIR:/etc/caddy:ro → đo SAU, lệch thì trả về."; exit 0
fi

# ---------- 5. cất bằng chứng ----------
BOX="$TRASH_ROOT/V-13417-doi-mount-caddy-$TS"
mkdir -p "$BOX"
docker inspect "$C" > "$BOX/inspect-container-cu.json"
printf '%s\n' "$truoc" > "$BOX/ma-truoc.txt"
cat > "$BOX/LY-DO.txt" <<EOF3
V-13417 — đổi mount Caddyfile của $C từ TỆP sang THƯ MỤC ($DIR -> /etc/caddy, chỉ đọc). $(date '+%F %T %z')
Container cũ được GIỮ (dừng, đổi tên $OLD, restart=no). Khôi phục tay nếu cần:
  docker stop $C && docker rename $C $C-bo-$TS && docker rename $OLD $C && docker update --restart=unless-stopped $C && docker start $C
  rồi nạp tệp máy chủ: docker cp $CF $C:/tmp/Caddyfile.host && docker exec $C caddy reload --config /tmp/Caddyfile.host --adapter caddyfile
Xoá hẳn container cũ khi đã ổn vài ngày: docker rm $OLD
EOF3
echo "[5] bằng chứng: $BOX"

tra_ve() {
  echo "TRẢ VỀ container cũ: $1" >&2
  docker stop -t 10 "$C" >/dev/null 2>&1 || true
  docker rename "$C" "$C-moi-hong-$TS" >/dev/null 2>&1 || true
  docker update --restart=no "$C-moi-hong-$TS" >/dev/null 2>&1 || true
  if docker rename "$OLD" "$C" && docker update --restart=unless-stopped "$C" >/dev/null && docker start "$C" >/dev/null; then
    sleep 3
    docker cp "$CF" "$C:/tmp/Caddyfile.host" && docker exec "$C" caddy reload --config /tmp/Caddyfile.host --adapter caddyfile || true
    echo "đã trả về $C cũ và nạp lại tệp máy chủ qua /tmp. Container mới hỏng giữ ở $C-moi-hong-$TS để xem log." >&2
    exit 6
  fi
  echo "TRẢ VỀ HỎNG — cần người xử NGAY: container cũ tên $OLD, mới $C-moi-hong-$TS. Hướng dẫn: $BOX/LY-DO.txt" >&2
  exit 7
}

# ---------- 6. dừng cũ, đổi tên giữ lại ----------
docker stop -t 15 "$C" >/dev/null
docker rename "$C" "$OLD"
docker update --restart=no "$OLD" >/dev/null
echo "[6] đã dừng + đổi tên container cũ → $OLD (restart=no)"

# ---------- 7. dựng mới ----------
if ! docker run -d --name "$C" --network host --restart unless-stopped \
     -v vip-staging-caddy-config:/config -v vip-staging-caddy-data:/data -v "$DIR:/etc/caddy:ro" \
     "$IMAGE_ID" caddy run --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null; then
  tra_ve "docker run hỏng"
fi
up=0
for _ in $(seq 1 "$WAIT_TRIES"); do
  if curl -s -o /dev/null --max-time 3 http://127.0.0.1:2019/config/; then up=1; break; fi
  sleep 2
done
[ "$up" = 1 ] || tra_ve "cổng quản trị 2019 không lên"
echo "[7] container mới đã lên"

# ---------- 8. kiểm mount + đo SAU ----------
i_host=$(stat -c %i "$CF"); i_ctr=$(docker exec "$C" stat -c %i /etc/caddy/Caddyfile || echo "?")
[ "$i_host" = "$i_ctr" ] || tra_ve "inode máy chủ $i_host ≠ container $i_ctr"
echo "[8] inode khớp ($i_host) — container đọc đúng tệp máy chủ"
sau=""
for k in $(seq 1 "$CMP_TRIES"); do
  sau=$(do_ma)
  [ "$sau" = "$truoc" ] && break
  [ "$k" -lt "$CMP_TRIES" ] && sleep 10
done
printf '%s\n' "$sau" > "$BOX/ma-sau.txt"
if [ "$sau" != "$truoc" ]; then
  echo "LỆCH trước/sau:" >&2; diff <(printf '%s\n' "$truoc") <(printf '%s\n' "$sau") >&2 || true
  tra_ve "mã trả về của site đổi sau khi dựng lại"
fi
echo "[9] mã trả về $(printf '%s\n' "$sau" | wc -l | tr -d ' ') site trùng trước/sau"
echo "XONG — $C gắn thư mục $DIR -> /etc/caddy. Container cũ giữ ở $OLD (dừng). Bằng chứng: $BOX"
