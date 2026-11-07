#!/bin/bash
# P-04 — Owner nhập Turnstile SECRET KEY của widget cổng khách (dangky + dangnhap) lên VPS.
# Khoá KHÔNG hiện trên màn hình, KHÔNG qua chat, KHÔNG lưu trên máy này.
# Ghi vào /srv/vip-staging/cowork/deploy/vps/data/turnstile_khach.secret (chủ 10001, quyền 0600).
# Chạy:  bash docs/cong-khach-hang/ops/nhap-turnstile-khach.sh
set -euo pipefail
read -rsp "Dán Turnstile SECRET KEY (không hiện ra) rồi Enter: " S; echo
if [ "${#S}" -lt 20 ]; then echo "Khoá quá ngắn — kiểm lại."; exit 1; fi
case "$S" in 1x0000000000000000000000000000000AA|2x0000000000000000000000000000000AA|3x0000000000000000000000000000000AA)
  echo "Đây là khoá THỬ của Cloudflare — production không nhận. Dùng khoá thật."; exit 1;; esac
printf %s "$S" | ssh -o BatchMode=yes viporder-staging \
  'cd /srv/vip-staging/cowork/deploy/vps && docker run --rm -i -v "$PWD/data:/d" alpine:3.20 sh -c "umask 077; cat > /d/turnstile_khach.secret && chown 10001:10001 /d/turnstile_khach.secret && chmod 600 /d/turnstile_khach.secret && printf \"Đã ghi %s byte.\n\" \$(wc -c < /d/turnstile_khach.secret)"'
unset S
echo "Xong. Gửi cho Controller SITE KEY (khoá công khai, bắt đầu bằng 0x...) — KHÔNG gửi secret."
