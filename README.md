# VIP GROUP — Website chính thức

Website chính thức của VIP GROUP tại https://vipgroup.com.vn.

- Stack: [Astro](https://astro.build) 7, xuất HTML tĩnh (không backend, không CMS).
- Dependency chạy: chỉ `astro`. Dev dependency: `@astrojs/check` + `typescript` (kiểm kiểu).
- Ngôn ngữ: tiếng Việt; cấu trúc sẵn để thêm tiếng Anh / tiếng Trung.

## Yêu cầu

- Node.js ≥ 22.12 (xem `.nvmrc`)

## Chạy local

```bash
npm ci
npm run dev        # http://localhost:4321
```

## Build và kiểm tra

```bash
npm run build      # xuất ra dist/
npm run check      # kiểm tra kiểu (astro check) cho file .astro / .ts
npm test           # kiểm tra bản build (SEO, link, sitemap, form, CSP, nội dung) + hành vi workflow staging
npm run preview    # xem bản build tại http://localhost:4321
```

CI (GitHub Actions, `.github/workflows/ci.yml`) chạy `npm ci → check → build → test` cho mọi Pull Request vào `develop` / `main`.

## Staging (Cloudflare Pages)

`.github/workflows/staging.yml` build + test rồi deploy **staging/preview** lên Cloudflare Pages (không bao giờ production): push `develop` → `staging.<project>.pages.dev`, mỗi PR → `pr-<số>.<project>.pages.dev`. Cần owner tạo project + secret — xem `docs/STAGING.md`. Thiếu credential thì workflow bỏ qua bước deploy và ghi `BLOCKED_EXTERNAL_CREDENTIAL`.

## Bảo mật

- CSP dạng thẻ `<meta>` do Astro sinh (`security.csp` trong `astro.config.mjs`), tự băm script/CSS nội tuyến. Script `is:inline` trong `BaseLayout.astro` được khai hash tay — **sửa script đó thì phải cập nhật hash** (`tests/security.test.mjs` sẽ báo).
- `public/_headers` (Cloudflare Pages): `nosniff`, `Referrer-Policy`, `Permissions-Policy`, chặn nhúng khung (`X-Frame-Options`, `frame-ancestors`), `noindex` cho `*.pages.dev`.

## Deploy

Website là thư mục tĩnh `dist/` — đưa lên bất kỳ hosting tĩnh nào (Nginx, Caddy, Cloudflare Pages, Netlify, cPanel `public_html`…):

1. `npm ci && npm run build`
2. Tải **toàn bộ nội dung** `dist/` lên thư mục gốc của `vipgroup.com.vn`.
3. Cấu hình máy chủ trả `404.html` cho đường dẫn không tồn tại.
4. Cấu hình máy chủ **chuyển hướng URL thiếu `/` cuối** sang bản có `/` (ví dụ `/gioi-thieu` → `/gioi-thieu/`). Site build với `trailingSlash: 'always'`; `astro preview` không tự chuyển hướng nên trả 404 cho URL thiếu `/`.

Năm © ở footer lấy lúc build — sang năm mới cần build lại (CI build mỗi lần merge).

Build không cần biến môi trường hay secret nào. Riêng workflow staging cần secret/biến Cloudflare đặt trong GitHub (không nằm trong repo) — xem `docs/STAGING.md`. Tên miền cấu hình ở `astro.config.mjs` (`SITE_URL`).

> Chưa deploy production. Việc deploy và DNS do chủ dự án quyết định.

## Cấu trúc

```
src/
  data/
    types.ts            # kiểu dữ liệu
    index.ts            # getContent(locale)
    vi/                 # nội dung tiếng Việt
      company.ts        # hồ sơ công ty, slogan, giá trị
      sectors.ts        # 3 lĩnh vực
      subsidiaries.ts   # công ty thành viên
      news.ts           # tin tức
      careers.ts        # tuyển dụng
      contact.ts        # liên hệ
  i18n/
    config.ts           # danh sách ngôn ngữ
    ui.ts               # chuỗi giao diện + menu (menu cũng sinh sitemap)
  components/           # Header, Footer, Seo, các khối nội dung, form liên hệ
  layouts/BaseLayout.astro
  pages/                # 7 trang + 404 + sitemap.xml + robots.txt
  styles/global.css     # biến màu thương hiệu ở :root
public/                 # favicon, logo, ảnh Open Graph
design/                 # file nguồn đồ hoạ placeholder
tests/                  # node:test, chạy trên dist/
```

## Cập nhật nội dung

Mọi nội dung nằm trong `src/data/vi/`. Quy ước: **thông tin chưa chốt để `null`**, giao diện tự hiện "Đang cập nhật" và schema.org tự bỏ trường đó — không điền chuỗi giả.

| Việc | Sửa ở đâu |
|---|---|
| Hotline, địa chỉ pháp lý | `contact.ts` → `hotline`, `address` |
| Tên pháp lý công ty mẹ | `company.ts` → `legalName` |
| Thêm/chốt công ty thành viên | `subsidiaries.ts` — điền `name`, `legalName`, `url`, đổi `status` sang `'active'` |
| Đăng tin | `news.ts` — thêm phần tử, `date` dạng `YYYY-MM-DD` |
| Đăng vị trí tuyển dụng | `careers.ts` → `openings`; email nhận hồ sơ riêng ở `applyEmail` |

## Form liên hệ

Giai đoạn 1 **chỉ có giao diện**: form không có `action`, các ô nhập không có `name` và nút gửi `disabled` sẵn trong HTML — nên kể cả khi trình duyệt tắt JavaScript cũng không dữ liệu nào lọt vào URL. Bật JS thì nút gửi mở, bấm gửi chỉ hiện thông báo dữ liệu chưa được gửi, kèm email `contact@vipgroup.com.vn`. Khi có backend: nối API trong `src/components/ContactForm.astro` (thêm `action`/`method`) rồi đặt `formBackendReady: true` — ô nhập sẽ tự có `name` trong `contact.ts` (test sẽ cần cập nhật theo).

## Thay logo / favicon

Logo hiện là placeholder dạng chữ.

1. Thay `public/logo.svg`, `public/favicon.svg`, `design/og-image.svg`.
2. Sinh lại ảnh JPG/PNG/ICO (cần Chrome và ImageMagick; Chrome headless có lúc chụp xong không tự thoát — thấy file ảnh đã ra thì bấm Ctrl+C):
   ```bash
   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   "$CHROME" --headless=new --hide-scrollbars --window-size=1200,630 --screenshot=/tmp/og.png "file://$PWD/design/og-image.svg"
   magick /tmp/og.png -strip -quality 86 public/og-image.jpg
   "$CHROME" --headless=new --hide-scrollbars --default-background-color=00000000 --window-size=540,540 --screenshot=/tmp/fav.png "file://$PWD/public/favicon.svg"
   magick /tmp/fav.png -resize 180x180 public/apple-touch-icon.png
   magick /tmp/fav.png -define icon:auto-resize=32,16 public/favicon.ico
   ```
3. Muốn dùng ảnh logo trong header: sửa `src/components/Logo.astro`.

Màu thương hiệu: biến CSS ở đầu `src/styles/global.css`.

## Thêm ngôn ngữ (EN / ZH)

1. `astro.config.mjs` → thêm `'en'` / `'zh'` vào `i18n.locales`.
2. `src/i18n/config.ts` → thêm vào `locales`, `htmlLang`, `ogLocale`.
3. `src/i18n/ui.ts` → thêm bộ chuỗi và menu (đường dẫn có tiền tố `/en/`…).
4. `src/data/en/` → chép cấu trúc `vi/`, dịch nội dung, đăng ký trong `src/data/index.ts`.
5. `src/pages/en/` → tạo trang, truyền `locale="en"` cho `BaseLayout`.
6. Mở rộng `sitemap.xml.ts` và thêm thẻ `hreflang` trong `Seo.astro`.

## Tài liệu điều phối

- `docs/PROJECT_CONTROLLER.md` — quy trình, quyền, chốt an toàn trước merge.
- `docs/MASTER_STATUS.md` — ảnh chụp trạng thái (GitHub vẫn là nguồn chân lý).
- `docs/verification/` — biên bản nghiệm thu từng PR.
- `docs/STAGING.md` — thiết kế staging Cloudflare Pages và việc owner phải làm.

## Quy trình Git

Issue/CR → branch `feature/*` từ `develop` → commit → Pull Request vào `develop` → CI → review → merge.
Không push trực tiếp vào `main`.
