#!/usr/bin/env bash
# VIPG-WEB-015 (V-11519) — CHẠY BẰNG ROOT TRÊN VPS 160.22.170.20.
# Nối MỘT khối vào Caddy dùng chung: vipgroup.com.vn (không www) → 301 → https://www.vipgroup.com.vn{uri}.
# Web thật nằm ở Cloudflare Pages (www CNAME → vip-group.pages.dev); VPS chỉ làm chuyển hướng, không phục vụ nội dung.
# Trước khi chạy: DNS A  @ (vipgroup.com.vn) → 160.22.170.20 tại iNET. KHÔNG đụng MX/TXT/DKIM.
# Thứ tự: sao lưu → nối → validate (hỏng: khôi phục, không reload) → reload (hỏng: khôi phục) → ĐO 301 (không đạt: mã 7).
# Idempotent: Caddyfile đã có khối này thì không nối lại — vẫn NẠP LẠI file máy chủ rồi đo (lượt trước có thể đứt giữa chừng).
#
# BẪY V-13417 (đo 24/10 và 25/10/2026): Caddyfile được bind-mount vào container THEO TỆP. Khi tệp máy chủ bị thay inode,
# container giữ bản CŨ — `caddy validate/reload --config /etc/caddy/Caddyfile` đều "thành công" trên bản cũ và GỠ MẤT
# mọi khối mới (25/10 đã gỡ nhầm ai-thu 14:35→17:03). Nên script KHÔNG BAO GIỜ nạp /etc/caddy/Caddyfile:
# nó chép tệp MÁY CHỦ vào /tmp trong container rồi validate/reload đúng bản đó.
set -euo pipefail
CF="${CADDYFILE:-/srv/vip-staging-proxy/Caddyfile}"
CONTAINER="${CADDY_CONTAINER:-vip-staging-caddy}"
PROBE_TRIES="${PROBE_TRIES:-6}"
APEX=vipgroup.com.vn
WWW=www.vipgroup.com.vn
VPS_IP=160.22.170.20
MARK="# VIPG-WEB-015 apex-redirect $APEX"
TMPCF=/tmp/Caddyfile.host

[ "$(id -u)" = 0 ] || { echo "cần root (file $CF do root sở hữu)" >&2; exit 2; }
[ -f "$CF" ] || { echo "không thấy $CF" >&2; exit 2; }

ip=$(getent ahostsv4 "$APEX" | awk '{print $1}' | head -1 || true)
[ "$ip" = "$VPS_IP" ] || { echo "DNS $APEX → '${ip:-rỗng}' (cần $VPS_IP). Thêm bản ghi A @ tại iNET rồi chạy lại." >&2; exit 3; }

# Đo: http và https của tên miền gốc đều phải 301 sang https://www... (chứng chỉ mới có thể cần vài chục giây).
probe() {
  local i u out code loc ok
  for i in $(seq 1 "$PROBE_TRIES"); do
    ok=1
    for u in "http://$APEX/lien-he/?b=2" "https://$APEX/gioi-thieu/?a=1"; do
      out=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 20 "$u" || echo "000 -")
      code=${out%% *}; loc=${out#* }
      echo "  lượt $i: $u → $out"
      # Phải là 301 thẳng sang www, GIỮ NGUYÊN đường dẫn + tham số (không chấp nhận 308 sang https của chính tên miền gốc).
      if [ "$code" != 301 ] || [ "$loc" != "https://$WWW/${u#*://"$APEX"/}" ]; then ok=0; fi
    done
    [ "$ok" = 1 ] && return 0
    [ "$i" -lt "$PROBE_TRIES" ] && sleep 10
  done
  return 1
}
ket_thuc() {
  if probe; then echo "XONG — $APEX chuyển 301 sang https://$WWW/"; exit 0; fi
  echo "CHƯA ĐẠT — cấu hình đã nạp nhưng chưa đo được 301 sang https://$WWW/<cùng đường dẫn> ở cả http lẫn https (xem các dòng trên)." >&2
  echo "  https lỗi kết nối (000) thường là chứng chỉ đang cấp → chạy lại sau ít phút; mã khác thì cần người xem cấu hình Caddy." >&2
  exit 7
}

# Nạp ĐÚNG tệp máy chủ (không qua bind-mount theo tệp). Trả 5 nếu validate hỏng, 6 nếu reload hỏng.
nap() {
  docker cp "$CF" "$CONTAINER:$TMPCF" || return 6
  docker exec "$CONTAINER" caddy validate --config "$TMPCF" --adapter caddyfile || return 5
  docker exec "$CONTAINER" caddy reload --config "$TMPCF" --adapter caddyfile || return 6
}

if grep -qF "$MARK" "$CF"; then
  echo "Caddyfile đã có khối $APEX — không nối lại; nạp lại tệp máy chủ rồi đo"
  rc=0; nap || rc=$?
  [ "$rc" = 0 ] || { echo "nạp lại HỎNG (mã $rc) — không sửa gì thêm, cần người xem." >&2; exit "$rc"; }
  ket_thuc
fi

# Khối site khác đã khai báo đúng tên miền gốc thì dừng (nối thêm sẽ thành hai khối trùng tên).
# Tách từng địa chỉ ở dòng mở khối: bỏ scheme, cổng, đường dẫn; so không phân biệt hoa thường.
# Chỉ dùng [ \t] (không dùng lớp [[:space:]]) để chạy được cả trên mawk cũ.
if awk -v apex="$APEX" '
  { line = $0; sub(/[ \t]#.*$/, "", line); sub(/^[ \t]*#.*$/, "", line) }
  line ~ /\{[ \t]*$/ {
    sub(/\{[ \t]*$/, "", line); gsub(/,/, " ", line)
    n = split(line, a, /[ \t]+/)
    for (i = 1; i <= n; i++) {
      h = tolower(a[i]); sub(/^[a-z]+:\/\//, "", h); sub(/\/.*$/, "", h); sub(/:[0-9]*$/, "", h)
      if (h == apex) found = 1
    }
  }
  END { exit found ? 0 : 1 }' "$CF"; then
  echo "Caddyfile đã có khối khác khai báo $APEX — dừng, cần người xem." >&2; exit 4
fi

BAK="$CF.bak-truoc-vipg-web-015-$(date +%F-%H%M%S)"
cp -p "$CF" "$BAK"
cat >> "$CF" <<EOF2

$MARK — web thật ở Cloudflare Pages ($WWW), đây chỉ chuyển hướng.
# Khai báo thẳng http:// để Caddy KHÔNG tự chèn 308 sang https://$APEX trước khi redir chạy.
$APEX, http://$APEX {
	redir https://$WWW{uri} permanent
}
EOF2

rc=0; nap || rc=$?
if [ "$rc" = 5 ]; then
  cp -p "$BAK" "$CF"
  echo "validate HỎNG — đã khôi phục $CF từ $BAK, KHÔNG reload." >&2; exit 5
fi
if [ "$rc" != 0 ]; then
  # reload của Caddy là nguyên tử: hỏng thì cấu hình đang chạy vẫn là bản cũ → trả file về đúng bản cũ.
  cp -p "$BAK" "$CF"
  echo "reload HỎNG — Caddy vẫn chạy cấu hình cũ; đã khôi phục $CF từ $BAK." >&2; exit 6
fi
echo "đã reload. Sao lưu: $BAK"
ket_thuc
