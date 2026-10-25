#!/usr/bin/env bash
# VIPG-WEB-015 (V-11519) — CHẠY BẰNG ROOT TRÊN VPS 160.22.170.20.
# Nối MỘT khối vào Caddy dùng chung: vipgroup.com.vn (không www) → 301 → https://www.vipgroup.com.vn{uri}.
# Web thật nằm ở Cloudflare Pages (www CNAME → vip-group.pages.dev); VPS chỉ làm chuyển hướng, không phục vụ nội dung.
# Trước khi chạy: DNS A  @ (vipgroup.com.vn) → 160.22.170.20 tại iNET. KHÔNG đụng MX/TXT/DKIM.
# Thứ tự: sao lưu → nối → validate (hỏng: khôi phục, không reload) → reload (hỏng: khôi phục) → ĐO 301 (không đạt: mã 7).
# Idempotent: Caddyfile đã có khối này thì không nối lại, chỉ đo lại.
set -euo pipefail
CF="${CADDYFILE:-/srv/vip-staging-proxy/Caddyfile}"
CONTAINER="${CADDY_CONTAINER:-vip-staging-caddy}"
PROBE_TRIES="${PROBE_TRIES:-6}"
APEX=vipgroup.com.vn
WWW=www.vipgroup.com.vn
VPS_IP=160.22.170.20
MARK="# VIPG-WEB-015 apex-redirect $APEX"

[ "$(id -u)" = 0 ] || { echo "cần root (file $CF do root sở hữu)" >&2; exit 2; }
[ -f "$CF" ] || { echo "không thấy $CF" >&2; exit 2; }

ip=$(getent ahostsv4 "$APEX" | awk '{print $1}' | head -1 || true)
[ "$ip" = "$VPS_IP" ] || { echo "DNS $APEX → '${ip:-rỗng}' (cần $VPS_IP). Thêm bản ghi A @ tại iNET rồi chạy lại." >&2; exit 3; }

# Đo: http và https của tên miền gốc đều phải 301 sang https://www... (chứng chỉ mới có thể cần vài chục giây).
probe() {
  local i u out code loc ok
  for i in $(seq 1 "$PROBE_TRIES"); do
    ok=1
    for u in "http://$APEX/" "https://$APEX/gioi-thieu/?a=1"; do
      out=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 20 "$u" || echo "000 -")
      code=${out%% *}; loc=${out#* }
      echo "  lượt $i: $u → $out"
      if [ "$code" != 301 ] || [ "${loc#https://"$WWW"/}" = "$loc" ]; then ok=0; fi
    done
    [ "$ok" = 1 ] && return 0
    [ "$i" -lt "$PROBE_TRIES" ] && sleep 10
  done
  return 1
}
ket_thuc() {
  if probe; then echo "XONG — $APEX chuyển 301 sang https://$WWW/"; exit 0; fi
  echo "CHƯA ĐẠT — cấu hình đã nạp nhưng chưa đo được 301 sang www (xem các dòng trên; chứng chỉ có thể đang cấp — chạy lại sau ít phút)." >&2
  exit 7
}

if grep -qF "$MARK" "$CF"; then echo "Caddyfile đã có khối $APEX — không nối lại, chỉ đo lại"; ket_thuc; fi

# Khối site khác đã khai báo đúng tên miền gốc thì dừng (nối thêm sẽ thành hai khối trùng tên).
# Tách từng địa chỉ ở dòng mở khối: bỏ scheme, cổng, đường dẫn; so không phân biệt hoa thường.
if awk -v apex="$APEX" '
  /^[[:space:]]*#/ { next }
  /\{[[:space:]]*$/ {
    line = $0; sub(/\{[[:space:]]*$/, "", line); gsub(/,/, " ", line)
    n = split(line, a, /[[:space:]]+/)
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
$APEX {
	redir https://$WWW{uri} permanent
}
EOF2

if ! docker exec "$CONTAINER" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  cp -p "$BAK" "$CF"
  echo "validate HỎNG — đã khôi phục $CF từ $BAK, KHÔNG reload." >&2; exit 5
fi
if ! docker exec "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  # reload của Caddy là nguyên tử: hỏng thì cấu hình đang chạy vẫn là bản cũ → trả file về đúng bản cũ.
  cp -p "$BAK" "$CF"
  echo "reload HỎNG — Caddy vẫn chạy cấu hình cũ; đã khôi phục $CF từ $BAK." >&2; exit 6
fi
echo "đã reload. Sao lưu: $BAK"
ket_thuc
