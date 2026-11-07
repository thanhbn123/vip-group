#!/usr/bin/env bash
# Bật / tắt 3 bản xem trước LOCAL để owner nghiệm thu (không deploy, không đụng Cloudflare/DNS).
#
#   npm run preview:start    build 3 bản → chép sang .preview/ → chạy 3 server nền (sống độc lập với phiên AI)
#   npm run preview:status   xem trạng thái
#   npm run preview:stop     tắt ĐÚNG 3 server do script này bật (theo PID đã ghi), không đụng tiến trình khác
#
# Bản phục vụ là BẢN CHÉP trong .preview/ → chạy `npm test` (build lại dist/) không làm đổi nội dung đang xem.
# Đổi cổng: PREVIEW_PORT_PROD=… PREVIEW_PORT_DEMO=… PREVIEW_PORT_LEAD=… npm run preview:start
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
DIR="$ROOT/.preview"
P_PROD=${PREVIEW_PORT_PROD:-4321}
P_DEMO=${PREVIEW_PORT_DEMO:-4322}
P_LEAD=${PREVIEW_PORT_LEAD:-4351}
NAMES=(prod demo lead)

port_of() { case "$1" in prod) echo "$P_PROD";; demo) echo "$P_DEMO";; lead) echo "$P_LEAD";; esac; }
pid_of() { [ -f "$DIR/$1.pid" ] && cat "$DIR/$1.pid" || true; }
# Chỉ coi là "của mình" khi PID còn sống VÀ đúng là server xem trước của repo này.
ours() { local pid=$1; [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && ps -o command= -p "$pid" | grep -q "tests/e2e/\(serve\|lead-server\)\.mjs $DIR/"; }
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

status() {
  for n in "${NAMES[@]}"; do
    local pid; pid=$(pid_of "$n"); local port; port=$(port_of "$n")
    if ours "$pid"; then echo "  $n  ĐANG CHẠY  http://localhost:$port/  (pid $pid)"; else echo "  $n  đã tắt     (cổng $port)"; fi
  done
}

stop() {
  for n in "${NAMES[@]}"; do
    local pid; pid=$(pid_of "$n")
    if ours "$pid"; then kill "$pid" && echo "  đã tắt $n (pid $pid)"; fi
    rm -f "$DIR/$n.pid"
  done
}

start() {
  mkdir -p "$DIR"
  for n in "${NAMES[@]}"; do
    if ours "$(pid_of "$n")"; then echo "Đang chạy sẵn — dùng 'npm run preview:stop' trước."; status; exit 1; fi
    if port_busy "$(port_of "$n")"; then echo "DỪNG: cổng $(port_of "$n") đang bị tiến trình khác dùng (không tự tắt). Đổi cổng bằng PREVIEW_PORT_*."; exit 2; fi
  done
  echo "Build 3 bản (mất ~1 phút)…"
  rm -rf "$DIR/prod" "$DIR/demo" "$DIR/lead" "$DIR/build-tmp"
  VIPG_OUTDIR="$DIR/build-tmp" npx astro build >"$DIR/build-prod.log" 2>&1 && mv "$DIR/build-tmp" "$DIR/prod"
  VIPG_DEMO=1 VIPG_OUTDIR="$DIR/build-tmp" npx astro build >"$DIR/build-demo.log" 2>&1 && mv "$DIR/build-tmp" "$DIR/demo"
  VIPG_TURNSTILE_SITE_KEY=1x00000000000000000000AA VIPG_OUTDIR="$DIR/build-tmp" npx astro build >"$DIR/build-lead.log" 2>&1 && mv "$DIR/build-tmp" "$DIR/lead"
  git -C "$ROOT" rev-parse --short HEAD >"$DIR/COMMIT"
  nohup node tests/e2e/serve.mjs "$DIR/prod" "$P_PROD" >"$DIR/prod.log" 2>&1 & echo $! >"$DIR/prod.pid"
  nohup node tests/e2e/serve.mjs "$DIR/demo" "$P_DEMO" >"$DIR/demo.log" 2>&1 & echo $! >"$DIR/demo.pid"
  nohup node tests/e2e/lead-server.mjs "$DIR/lead" "$P_LEAD" >"$DIR/lead.log" 2>&1 & echo $! >"$DIR/lead.pid"
  disown -a 2>/dev/null || true
  sleep 2
  echo "Bản xem trước của commit $(cat "$DIR/COMMIT"):"
  echo "  1. Bản SẼ PHÁT HÀNH     http://localhost:$P_PROD/"
  echo "  2. Bản nghiệm thu DEMO  http://localhost:$P_DEMO/      (dữ liệu MẪU + bài nháp, mọi trang noindex)"
  echo "  3. Gửi thử form lead    http://localhost:$P_LEAD/lien-he/   (Turnstile mã THỬ, Sheet giả — xem lead: /__mock/rows)"
  echo "Tắt: npm run preview:stop"
}

case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *) echo "Dùng: $0 start|stop|status"; exit 64 ;;
esac
