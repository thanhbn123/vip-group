# design/

File nguồn đồ hoạ. Không được build vào website.

- `logo-vip-group-goc-2000.webp` — **logo chính thức** VIP GROUP do owner gửi 24/10/2026 (PNG nền trong suốt 2000×2000; tới qua chat ở dạng WebP, giữ kênh trong suốt). Không vẽ lại, không chỉnh sửa.
- `og-image.html` → `public/og-image.jpg` (1200×630, ảnh chia sẻ Open Graph).

## Ảnh trong `public/` sinh từ logo gốc (chỉ cắt + đổi kích thước)

| File | Cách sinh |
|---|---|
| `logo-vip-group.webp` / `.png`, `logo-vip-group-600.webp`, `logo-vip-group-400.webp` | logo đầy đủ, cắt viền trong suốt, rộng 720 / 600 / 400 px (srcset) |
| `logo-mark.webp` / `.png` (80×80), `logo-mark-40.webp` (40×40) | biểu tượng tròn (phần trên logo, cắt ở dòng trong suốt giữa vòng tròn và chữ, y = 1530), 2x / 1x |
| `favicon.ico` (48/32/16), `favicon-32.png` | từ biểu tượng tròn |
| `apple-touch-icon.png` | biểu tượng tròn trên nền trắng 180×180 (iOS tô đen nền trong suốt) |

Lệnh (ImageMagick 7 + Chrome):

```bash
SRC=design/logo-vip-group-goc-2000.webp
magick $SRC -crop 2000x1530+0+0 +repage -trim +repage -background none -gravity center -extent "%[fx:max(w,h)]x%[fx:max(w,h)]" /tmp/emblem.png
magick $SRC -trim +repage /tmp/full.png
magick /tmp/full.png -resize 720x -strip -quality 86 public/logo-vip-group.webp
magick /tmp/full.png -resize 720x -strip public/logo-vip-group.png
magick /tmp/full.png -resize 600x -strip -quality 82 public/logo-vip-group-600.webp
magick /tmp/full.png -resize 400x -strip -quality 86 public/logo-vip-group-400.webp
magick /tmp/emblem.png -resize 80x80 -strip -quality 90 public/logo-mark.webp
magick /tmp/emblem.png -resize 80x80 -strip public/logo-mark.png
magick /tmp/emblem.png -resize 40x40 -strip -quality 90 public/logo-mark-40.webp
magick /tmp/emblem.png -resize 32x32 -strip public/favicon-32.png
magick /tmp/emblem.png -resize 64x64 -define icon:auto-resize=48,32,16 public/favicon.ico
magick /tmp/emblem.png -resize 180x180 -background white -gravity center -extent 180x180 -flatten -strip public/apple-touch-icon.png
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --hide-scrollbars --window-size=1200,630 --screenshot=/tmp/og.png "file://$PWD/design/og-image.html"
magick /tmp/og.png -strip -quality 86 public/og-image.jpg
```

Chrome headless có lúc chụp xong không tự thoát — thấy file ảnh đã ra thì bấm Ctrl+C.
