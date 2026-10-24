#!/usr/bin/env bash
# VIPG-WEB-015 (V-11519) — CHẠY BẰNG ROOT TRÊN VPS 160.22.170.20.
# Nối MỘT khối vào Caddy dùng chung: vipgroup.com.vn (không www) → 301 → https://www.vipgroup.com.vn{uri}.
# Web thật nằm ở Cloudflare Pages (www CNAME → vip-group.pages.dev); VPS chỉ làm chuyển hướng, không phục vụ nội dung.
# Trước khi chạy: DNS A  @ (vipgroup.com.vn) → 160.22.170.20 tại iNET. KHÔNG đụng MX/TXT/DKIM.
# Thứ tự: sao lưu → nối → validate (hỏng thì KHÔI PHỤC bản sao lưu, không reload) → reload → đo.
# Idempotent: Caddyfile đã có khối này thì không nối lại.
set -euo pipefail
CF="${CADDYFILE:-/srv/vip-staging-proxy/Caddyfile}"
CONTAINER="${CADDY_CONTAINER:-vip-staging-caddy}"
APEX=vipgroup.com.vn
WWW=www.vipgroup.com.vn
VPS_IP=160.22.170.20
APEX_RE='vipgroup\.com\.vn'
MARK="# VIPG-WEB-015 apex-redirect $APEX"

[ "$(id -u)" = 0 ] || { echo "cần root (file $CF do root sở hữu)" >&2; exit 2; }
[ -f "$CF" ] || { echo "không thấy $CF" >&2; exit 2; }

ip=$(getent hosts "$APEX" | awk '{print $1}' | head -1 || true)
[ "$ip" = "$VPS_IP" ] || { echo "DNS $APEX → '${ip:-rỗng}' (cần $VPS_IP). Thêm bản ghi A @ tại iNET rồi chạy lại." >&2; exit 3; }

if grep -qF "$MARK" "$CF"; then echo "Caddyfile đã có khối $APEX — không nối lại"; exit 0; fi
# Khối site khác đã khai báo đúng tên miền gốc thì dừng: nối thêm sẽ thành hai khối trùng tên.
if grep -Eq "^[[:space:]]*(https?://)?$APEX_RE([[:space:]]*[,{]|[[:space:]]*$)" "$CF"; then
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
docker exec "$CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
echo "đã reload. Sao lưu: $BAK"
sleep 8
for u in "http://$APEX/" "https://$APEX/gioi-thieu/?a=1"; do
  printf "%-36s → " "$u"; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" --max-time 20 "$u" || echo "lỗi kết nối (chứng chỉ có thể đang được cấp, thử lại sau 1 phút)"
done
echo "XONG. Kỳ vọng: 301 → https://$WWW/... ; báo lại cho phiên Claude để nghiệm thu."
