#!/usr/bin/env bash
# V-13417 — CHẠY BẰNG ROOT TRÊN VPS 160.22.170.20 (khuyên chạy trong tmux). Vá gốc bẫy "Caddyfile gắn theo TỆP".
#
# Bẫy (đo 24/10 và 25/10/2026): container vip-staging-caddy gắn /srv/vip-staging-proxy/Caddyfile THEO TỆP.
# Tệp máy chủ đổi inode ⇒ container đang chạy giữ bản CŨ; `caddy reload --config /etc/caddy/Caddyfile` báo thành công
# trên bản cũ và gỡ mất khối mới. Mỗi lần có người ghi tệp kiểu tạo tệp mới (sed -i, trình soạn thảo) là bẫy lặp lại.
# (Khởi động lại container nhiều khả năng gắn lại đúng tệp mới — CHƯA ĐO.)
# Vá: dựng lại container y hệt, CHỈ đổi mount sang THƯ MỤC  /srv/vip-staging-proxy -> /etc/caddy (chỉ đọc).
#
# An toàn:
#   1. Container phải đang chạy và cấu hình KHỚP ĐÚNG bản đo 25/10; mọi tuỳ chọn khác phải ở giá trị mặc định — lệch là dừng (3).
#   2. Cấu hình ĐANG CHẠY (cổng quản trị 2019) phải trùng kết quả dịch tệp máy chủ — khác là dừng (4):
#      dựng lại không được lén áp thay đổi của ai. Muốn áp thì nạp tệp máy chủ qua /tmp trước, kiểm, rồi chạy lại.
#   3. Validate tệp máy chủ bằng container tạm (cùng ảnh, không mạng) trước khi đụng gì (5).
#   4. Đo mã trả về MỌI site TRƯỚC (phải có site trả lời được); dừng container cũ, ĐỔI TÊN GIỮ LẠI; dựng mới; đo SAU.
#      Lệch / container mới không lên / inode lệch / lệnh hỏng giữa chừng / Ctrl-C ⇒ TỰ TRẢ VỀ container cũ và ĐO LẠI (6).
#      Trả về mà đo lại không khớp ⇒ 7 (người xử ngay).
#      Chạy thật BẮT BUỘC trong tmux/screen (CHAY_NGOAI_TMUX=1 để bỏ qua — không khuyên). HUP bị bỏ qua từ trước khi
#      mở nhật ký (tee cũng bỏ qua HUP/INT/TERM) — nếu lệnh docker con chết vì HUP thì bẫy ERR trả về container cũ.
# CẢNH BÁO cho người sửa sau: không có `set -E`, nên lỗi BÊN TRONG một hàm gọi trần (không nằm sau ||/if) trong vùng
#      bước 6–8 sẽ thoát mà KHÔNG trả về. Mọi hàm trong vùng đó phải gọi kiểu `ham || tra_ve "..."`.
#   5. Bằng chứng (inspect cũ, mã trước/sau, nhật ký) cất ở /root/thung-rac/<việc>-<giờ>/ kèm LY-DO.txt (CLAUDE.md §19.5).
# DRY_RUN=1: chỉ đo + validate + in kế hoạch, KHÔNG dừng/dựng gì.
set -euo pipefail
C="${CADDY_CONTAINER:-vip-staging-caddy}"
DIR="${CADDY_DIR:-/srv/vip-staging-proxy}"
IMAGE_ID="${CADDY_IMAGE_ID:-sha256:0c994536bddb66445885237f1a5dcc1916bccea922661c76b4e9fc24061f9b52}"
TRASH_ROOT="${TRASH_ROOT:-/root/thung-rac}"
DRY_RUN="${DRY_RUN:-0}"
WAIT_TRIES="${WAIT_TRIES:-15}"
CMP_TRIES="${CMP_TRIES:-3}"
TS=$(date +%Y%m%d-%H%M%S)
OLD="$C-cu-$TS"
HONG="$C-moi-hong-$TS"
CF="$DIR/Caddyfile"
CMD_JSON='["caddy","run","--config","/etc/caddy/Caddyfile","--adapter","caddyfile"]'

[ "$(id -u)" = 0 ] || { echo "cần root" >&2; exit 2; }
[ -f "$CF" ] || { echo "không thấy $CF" >&2; exit 2; }
command -v python3 >/dev/null || { echo "cần python3 trên máy chủ (để so cấu hình JSON)" >&2; exit 2; }
docker inspect "$C" >/dev/null 2>&1 || { echo "không thấy container $C" >&2; exit 3; }

# ---------- 1. cấu hình container hiện tại ----------
mounts() { docker inspect "$1" --format '{{range .Mounts}}{{.Type}}:{{.Name}}:{{.Source}}:{{.Destination}}:{{.RW}}{{println}}{{end}}' | sed '/^$/d' | sort; }
cur_mounts=$(mounts "$C")
if printf '%s\n' "$cur_mounts" | grep -qxF "bind::$DIR:/etc/caddy:false"; then
  echo "ĐÃ VÁ từ trước: $C gắn thư mục $DIR -> /etc/caddy. Không làm gì."; exit 0
fi
want_mounts=$(printf '%s\n' \
  "bind::$CF:/etc/caddy/Caddyfile:false" \
  "volume:vip-staging-caddy-config:/var/lib/docker/volumes/vip-staging-caddy-config/_data:/config:true" \
  "volume:vip-staging-caddy-data:/var/lib/docker/volumes/vip-staging-caddy-data/_data:/data:true" | sort)
got=$(docker inspect "$C" --format '{{.State.Running}}|{{.Image}}|{{.HostConfig.NetworkMode}}|{{.HostConfig.RestartPolicy.Name}}|{{json .Config.Cmd}}|{{json .Config.Entrypoint}}|{{.Config.User}}|{{.Config.WorkingDir}}|{{.HostConfig.Privileged}}|{{.HostConfig.ReadonlyRootfs}}|{{.HostConfig.LogConfig.Type}}')
want="true|$IMAGE_ID|host|unless-stopped|$CMD_JSON|null||/srv|false|false|json-file"
envs=$(docker inspect "$C" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed '/^$/d' | grep -v '^PATH=' | grep -v '^CADDY_VERSION=' | sort | tr '\n' ' ')
want_envs="XDG_CONFIG_HOME=/config XDG_DATA_HOME=/data "
# Tuỳ chọn chưa đo 25/10: phải ở giá trị mặc định (rỗng) — khác là dừng, không đoán.
rong_lech=""
for f in .HostConfig.CapAdd .HostConfig.CapDrop .HostConfig.Ulimits .HostConfig.ExtraHosts .HostConfig.Dns .HostConfig.Tmpfs \
         .HostConfig.Init .HostConfig.SecurityOpt .HostConfig.Sysctls .HostConfig.Devices .HostConfig.LogConfig.Config \
         .HostConfig.Memory .HostConfig.NanoCpus .HostConfig.PidMode .HostConfig.IpcMode .Config.StopSignal .Config.StopTimeout; do
  v=$(docker inspect "$C" --format "{{json $f}}")
  # IpcMode: Docker đời mới gán mặc định "private" cho MỌI container `docker run` (đo 26/10 trên VPS) ⇒ chấp nhận đúng giá trị đó.
  if [ "$f" = .HostConfig.IpcMode ] && [ "$v" = '"private"' ]; then continue; fi
  case "$v" in null|'[]'|'{}'|'""'|0|false) ;; *) rong_lech="$rong_lech $f=$v";; esac
done
if [ "$got" != "$want" ] || [ "$cur_mounts" != "$want_mounts" ] || [ "$envs" != "$want_envs" ] || [ -n "$rong_lech" ]; then
  {
    echo "Cấu hình $C KHÁC bản đo 25/10 — dừng, không dựng lại theo đoán."
    echo "  đo:   $got"; echo "  cần:  $want"
    echo "  mount đo:"; printf '    %s\n' "$cur_mounts"
    echo "  env đo: $envs | cần: $want_envs"
    [ -z "$rong_lech" ] || echo "  tuỳ chọn không mặc định:$rong_lech"
  } >&2
  exit 3
fi
echo "[1] container đang chạy, cấu hình khớp bản đo 25/10, tuỳ chọn khác đều mặc định"

# ---------- 2. cấu hình ĐANG CHẠY = dịch tệp máy chủ? ----------
chuan() { python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin), sort_keys=True, indent=1))'; }
dang_chay=$(curl -s --max-time 5 http://127.0.0.1:2019/config/ | chuan) || { echo "không đọc được cấu hình đang chạy ở cổng 2019" >&2; exit 4; }
dich_tep=$(docker run --rm --network none -v "$DIR:/etc/caddy:ro" "$IMAGE_ID" caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null | chuan) \
  || { echo "không dịch được tệp máy chủ (caddy adapt)" >&2; exit 5; }
if [ "$dang_chay" != "$dich_tep" ]; then
  echo "Cấu hình ĐANG CHẠY khác tệp máy chủ $CF — dừng: dựng lại sẽ lén áp thay đổi. Chỗ khác (< đang chạy, > tệp máy chủ):" >&2
  diff <(printf '%s\n' "$dang_chay") <(printf '%s\n' "$dich_tep") | head -60 >&2 || true
  echo "  Muốn áp: nạp tệp máy chủ qua /tmp (docker cp $CF $C:/tmp/Caddyfile.host; caddy validate/reload --config /tmp/Caddyfile.host), kiểm site, rồi chạy lại script." >&2
  exit 4
fi
echo "[2] cấu hình đang chạy trùng đúng tệp máy chủ"

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
      if (h ~ /^[a-z0-9.-]+\.[a-z0-9-]+$/ && h !~ /^[0-9.]+$/) print h }
  }' "$CF" | sort -u)
[ -n "$hosts" ] || { echo "không tách được site nào từ $CF — dừng." >&2; exit 3; }
do_ma() { for h in $hosts; do printf '%s %s\n' "$h" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve "$h:443:127.0.0.1" "https://$h/" || true)"; done; }
truoc=$(do_ma)
echo "[4] đo TRƯỚC ($(printf '%s\n' "$truoc" | wc -l | tr -d ' ') site):"; printf '%s\n' "$truoc" | sed 's/^/    /'
printf '%s\n' "$truoc" | grep -qv ' 000$' || { echo "không site nào trả lời được trước khi làm — phép so trước/sau vô nghĩa, dừng." >&2; exit 3; }

if [ "$DRY_RUN" != 1 ] && [ -z "${TMUX:-}" ] && [ -z "${STY:-}" ] && [ "${CHAY_NGOAI_TMUX:-0}" != 1 ]; then
  echo "Chạy thật phải ở trong tmux hoặc screen (mất ssh giữa chừng không được làm đứt script). Mở: tmux new -s caddy" >&2; exit 2
fi
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
trap '' HUP
exec > >(trap '' HUP INT TERM; exec tee -a "$BOX/nhat-ky.txt") 2>&1
echo "[5] bằng chứng: $BOX"

cho_2019() { local _; for _ in $(seq 1 "$WAIT_TRIES"); do curl -s -o /dev/null --max-time 3 http://127.0.0.1:2019/config/ && return 0; sleep 2; done; return 1; }
dang_chay_ten() { [ "$(docker inspect "$1" --format '{{.State.Running}}' 2>/dev/null || echo false)" = true ]; }

tra_ve() {
  trap - ERR
  trap '' INT TERM HUP
  set +e
  echo "TRẢ VỀ container cũ: $1" >&2
  if docker inspect "$OLD" >/dev/null 2>&1; then
    # Container cũ đã bị đổi tên ⇒ cái đang mang tên $C (nếu có) là bản mới: dừng chắc chắn rồi mới bật cũ.
    if docker inspect "$C" >/dev/null 2>&1; then
      docker stop -t 10 "$C" >/dev/null 2>&1
      if dang_chay_ten "$C"; then echo "container mới KHÔNG dừng được — không bật cũ (tránh hai Caddy giành cổng)." >&2; exit 7; fi
      if ! { docker rename "$C" "$HONG" && docker update --restart=no "$HONG" >/dev/null; }; then echo "không cất được container mới hỏng." >&2; exit 7; fi
    fi
    docker rename "$OLD" "$C" || { echo "không đổi tên $OLD về $C." >&2; exit 7; }
  fi
  if ! { docker update --restart=unless-stopped "$C" >/dev/null && docker start "$C" >/dev/null; }; then echo "không bật lại được $C." >&2; exit 7; fi
  cho_2019 || { echo "container cũ bật lại nhưng cổng 2019 không lên." >&2; exit 7; }
  if ! { docker cp "$CF" "$C:/tmp/Caddyfile.host" && docker exec "$C" caddy reload --config /tmp/Caddyfile.host --adapter caddyfile; }; then
    echo "container cũ chạy nhưng nạp tệp máy chủ hỏng." >&2; exit 7
  fi
  local k lai=""
  for k in $(seq 1 "$CMP_TRIES"); do lai=$(do_ma); [ "$lai" = "$truoc" ] && break; [ "$k" -lt "$CMP_TRIES" ] && sleep 10; done
  if [ "$lai" = "$truoc" ]; then
    echo "đã trả về $C cũ, mã mọi site trùng lúc trước. Container mới hỏng (nếu có) giữ ở $HONG để xem log." >&2; exit 6
  fi
  echo "đã trả về nhưng mã site KHÁC lúc trước — người xử ngay. Xem $BOX/LY-DO.txt" >&2
  diff <(printf '%s\n' "$truoc") <(printf '%s\n' "$lai") >&2
  exit 7
}
trap 'tra_ve "lệnh hỏng giữa chừng (dòng $LINENO)"' ERR
trap 'tra_ve "bị ngắt"' INT TERM

# ---------- 6. dừng cũ, đổi tên giữ lại ----------
docker stop -t 15 "$C" >/dev/null
docker rename "$C" "$OLD"
docker update --restart=no "$OLD" >/dev/null
echo "[6] đã dừng + đổi tên container cũ → $OLD (restart=no)"

# ---------- 7. dựng mới ----------
docker run -d --name "$C" --network host --ipc private --restart unless-stopped \
  -v vip-staging-caddy-config:/config -v vip-staging-caddy-data:/data -v "$DIR:/etc/caddy:ro" \
  "$IMAGE_ID" caddy run --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
cho_2019 || tra_ve "cổng quản trị 2019 không lên"
echo "[7] container mới đã lên"

# ---------- 8. kiểm mount + đo SAU ----------
i_host=$(stat -c %i "$CF"); i_ctr=$(docker exec "$C" stat -c %i /etc/caddy/Caddyfile || echo "?")
[ "$i_host" = "$i_ctr" ] || tra_ve "inode máy chủ $i_host ≠ container $i_ctr"
echo "[8] inode khớp ($i_host) — container đọc đúng tệp máy chủ"
sau=""
for k in $(seq 1 "$CMP_TRIES"); do
  sau=$(do_ma)
  [ "$sau" = "$truoc" ] && break
  if [ "$k" -lt "$CMP_TRIES" ]; then sleep 10; fi
done
printf '%s\n' "$sau" > "$BOX/ma-sau.txt"
if [ "$sau" != "$truoc" ]; then
  echo "LỆCH trước/sau:" >&2; diff <(printf '%s\n' "$truoc") <(printf '%s\n' "$sau") >&2 || true
  tra_ve "mã trả về của site đổi sau khi dựng lại"
fi
trap - ERR INT TERM
echo "[9] mã trả về $(printf '%s\n' "$sau" | wc -l | tr -d ' ') site trùng trước/sau"
echo "XONG — $C gắn thư mục $DIR -> /etc/caddy. Container cũ giữ ở $OLD (dừng). Bằng chứng: $BOX"
