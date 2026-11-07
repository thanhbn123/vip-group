#!/usr/bin/env bash
# Đưa banner owner vào website: cắt phần ẢNH (bỏ chữ in sẵn bên phải nếu là banner đầy đủ), nén WebP nhiều cỡ + JPG dự phòng,
# rồi bật banner ở src/data/vi/hero.ts. Chữ (logo, slogan) do HTML vẽ → Google đọc được, nét trên mọi màn hình.
#   bash scripts/banner.sh ~/Downloads/banner.jpg
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:?Dùng: bash scripts/banner.sh <đường dẫn ảnh banner>}
[ -f "$SRC" ] || { echo "Không thấy file: $SRC"; exit 2; }
command -v magick >/dev/null || { echo "Cần ImageMagick (magick)"; exit 2; }
read -r W H <<<"$(magick identify -format '%w %h' "$SRC[0]")"
echo "Ảnh gốc: ${W}×${H}"
mkdir -p design public/banner
rm -f public/banner/hero-*.webp public/banner/hero-*.jpg
EXT=$(printf %s "${SRC##*.}" | tr "[:upper:]" "[:lower:]"); cp "$SRC" "design/banner-trang-chu-goc.$EXT"
# Banner ngang có chữ bên phải (tỉ lệ ≥ 2,4 như mẫu 2000×667): lấy 64% bên trái (vùng xe hàng).
if [ $(( W * 10 / H )) -ge 24 ]; then CW=$(( W * 64 / 100 )); else CW=$W; fi
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
magick "$SRC[0]" -auto-orient -crop "${CW}x${H}+0+0" +repage -strip "$TMP/crop.png"
read -r CW CH <<<"$(magick identify -format '%w %h' "$TMP/crop.png")"
WIDTHS=()
MAXW=$(( CW < 1600 ? CW : 1600 ))
for w in $MAXW 900 600; do
  [ "$w" -le "$CW" ] || continue
  [ -e "public/banner/hero-${w}.webp" ] && continue
  magick "$TMP/crop.png" -resize "${w}x" -quality 78 "public/banner/hero-${w}.webp"
  WIDTHS+=("$w")
done
[ ${#WIDTHS[@]} -gt 0 ] || { magick "$TMP/crop.png" -quality 78 "public/banner/hero-${CW}.webp"; WIDTHS=("$CW"); }
magick "$TMP/crop.png" -resize "${WIDTHS[0]}x" -quality 80 "public/banner/hero-${WIDTHS[0]}.jpg"
RW=${WIDTHS[0]}; RH=$(( CH * RW / CW ))
LIST=$(printf '%s, ' "${WIDTHS[@]}"); LIST=${LIST%, }
python3 - "$RW" "$RH" "$LIST" <<'PY'
import sys, re
w, h, lst = sys.argv[1], sys.argv[2], sys.argv[3]
p = 'src/data/vi/hero.ts'
s = open(p).read()
s = re.sub(r"export const heroBanner: HeroBanner \| null = .*;\n?$",
  "export const heroBanner: HeroBanner | null = {\n  base: '/banner/hero',\n  widths: [" + lst + "],\n  width: " + w + ",\n  height: " + h + ",\n  alt: 'Xe đầu kéo chở hàng đóng kiện tại bãi kho — vận chuyển hàng Trung Quốc về Việt Nam',\n};\n", s, flags=re.S)
open(p, 'w').write(s)
PY
ls -la public/banner/
echo "Đã bật banner. Tiếp: npm test && npm run preview:stop && npm run preview:start"
