# design/

File nguồn đồ hoạ. Không được build vào website.

- `logo-vip-group-do-trang-goc-1254.jpg` — **logo chính thức** VIP GROUP bản đỏ – trắng do owner gửi 27/10/2026 (JPEG 1254×1254, nền trắng). Không vẽ lại, không chỉnh sửa. Thay logo navy – vàng gửi 24/10/2026 (còn trong lịch sử git).
- `og-image.html` → `public/og-image.jpg` (1200×630, ảnh chia sẻ Open Graph; dùng `../public/logo-vip-group.png`).

Đỏ thương hiệu đo trên logo gốc: **`#D0071A`** (`srgb(81.7%, 2.9%, 9.9%)`) — dùng làm `--brand` trong `src/styles/global.css`.

## Ảnh trong `public/` sinh từ logo gốc (chỉ tách nền + cắt + đổi kích thước)

| File | Cách sinh |
|---|---|
| `logo-vip-group.webp` / `.png`, `-600.webp`, `-400.webp` | logo đầy đủ, nền trắng → trong suốt (tô loang từ 4 góc, giữ chim trắng trong vòng tròn; ở dải chữ xoá mọi điểm trắng để thủng lỗ chữ O/P/R), rộng 720 / 600 / 400 px |
| `logo-mark.webp` / `.png` (80×80), `logo-mark-40.webp` | biểu tượng tròn đỏ (cắt phía trên dòng trắng y = 980 giữa vòng tròn và chữ) |
| `favicon.ico` (48/32/16), `favicon-32.png` | từ biểu tượng tròn |
| `apple-touch-icon.png` | biểu tượng tròn 160 px giữa nền trắng 180×180 |

Lệnh (ImageMagick 7 + Chrome):

```bash
S=design/logo-vip-group-do-trang-goc-1254.jpg; T=$(mktemp -d)
magick $S -alpha set -fuzz 12% -fill none -floodfill +0+0 white -floodfill +1253+0 white -floodfill +0+1253 white -floodfill +1253+1253 white -trim +repage $T/full.png
H=$(magick identify -format %h $T/full.png)      # dòng trong suốt giữa vòng tròn và chữ trong full.png: y = 845 (đo 27/10)
magick $T/full.png -crop 1112x845+0+0 +repage $T/tren.png
magick $T/full.png -crop 1112x$((H-845))+0+845 +repage -fuzz 15% -transparent white $T/duoi.png
magick $T/tren.png $T/duoi.png -background none -append $T/full2.png
magick $S -crop 1254x980+0+0 +repage -alpha set -fuzz 12% -fill none -floodfill +0+0 white -floodfill +1253+0 white -floodfill +0+979 white -floodfill +1253+979 white -trim +repage $T/em0.png
magick $T/em0.png -background none -gravity center -extent "%[fx:max(w,h)]x%[fx:max(w,h)]" $T/emblem.png
magick $T/full2.png -resize 720x -strip -quality 86 public/logo-vip-group.webp
magick $T/full2.png -resize 720x -strip public/logo-vip-group.png
magick $T/full2.png -resize 600x -strip -quality 82 public/logo-vip-group-600.webp
magick $T/full2.png -resize 400x -strip -quality 86 public/logo-vip-group-400.webp
magick $T/emblem.png -resize 80x80 -strip -quality 90 public/logo-mark.webp
magick $T/emblem.png -resize 80x80 -strip public/logo-mark.png
magick $T/emblem.png -resize 40x40 -strip -quality 90 public/logo-mark-40.webp
magick $T/emblem.png -resize 32x32 -strip public/favicon-32.png
magick $T/emblem.png -resize 64x64 -define icon:auto-resize=48,32,16 public/favicon.ico
magick $T/emblem.png -resize 160x160 -background white -gravity center -extent 180x180 -flatten -strip public/apple-touch-icon.png
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1200,630 --screenshot=$T/og.png "file://$PWD/design/og-image.html"
magick $T/og.png -strip -quality 86 public/og-image.jpg
```

Chrome headless có lúc chụp xong không tự thoát — thấy file ảnh đã ra thì bấm Ctrl+C.
