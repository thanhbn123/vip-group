# Biên bản nghiệm thu — VIPG-WEB-001 · PR #2

| Mục | Giá trị |
|---|---|
| Issue | #1 VIPG-WEB-001 — Official corporate website v1 (CLOSED 29/09/2026 theo xác nhận owner) |
| PR | #2 `feature/vip-group-official-website-v1` → `develop` |
| Base đã kiểm | `57214628acd7aa1f05e5d018cc3dee4ca8d4ed9e` |
| PR HEAD đã kiểm | `cc415676448b41af56fbbc875e446d4884413938` |
| CI trên PR HEAD | run 36542545616 — success |
| Verifier | tác tử độc lập, clone sạch, chỉ đọc — **PASS**, 0 blocker |
| Đo 4 chốt trước merge | 29/09/2026 15:33 +0700 — HEAD = verified · CI SHA = HEAD · develop = base · MERGEABLE/CLEAN |
| Merge | `gh pr merge --merge --match-head-commit cc41567…` → `5f34a0bb3811ca2e97c0f5d5c186d95edfb70457` (08:34:07 UTC) |
| Sau merge | `cc41567` là tổ tiên của `develop`; cây `develop` == cây `cc41567`; CI push develop run 36543543887 — success |

## Verifier đã kiểm (tóm tắt)

`npm ci` · `npm run check` (0 lỗi / 36 file) · `npm run build` (8 trang) · `npm test` (20/20) · 7 route + 404 chạy thật qua `astro preview` · lang / h1 / title / description / canonical / OG / JSON-LD trên từng trang · 0 link nội bộ hỏng · sitemap đúng 7 URL · robots trỏ sitemap · ảnh OG, favicon tồn tại · trung thực nội dung · form không `action` · không secret · `npm audit` 0 lỗ hổng · skip link, `aria-expanded`/`aria-controls`, label form.

## Phát hiện NON-BLOCKER → chuyển sang VIPG-WEB-002 (#3)

1. Form tắt JS submit GET đưa dữ liệu vào query string.
2. Hero ghi "Việt Nam" — chưa có trong brief.
3. Câu mô tả hệ sinh thái viết như hiện trạng.
4. Mô tả trụ cột — chấp nhận, chờ owner duyệt câu chữ.
5. Trang 404 phát canonical tới URL không tồn tại.
6. Năm © lấy lúc build.
7. Menu mobile ẩn khi tắt JS.
8. URL thiếu `/` cuối trả 404 ở `astro preview`.
