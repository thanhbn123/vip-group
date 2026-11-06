# VIPG-WEB-022 — Bảng giá vận chuyển song ngữ trên trang chủ · BÁO CÁO CHO CHỦ DỰ ÁN

**Trạng thái: CHỜ OWNER DUYỆT.** Chưa push, chưa PR, chưa deploy. Production `https://www.vipgroup.com.vn` không đổi.

- Repo `~/code/vip-group` · worktree `~/Projects/vip-group-com-vn-bang-gia` · nhánh `feature/vipg-web-022-homepage-bang-gia` từ `develop@2c998ed` (nội dung = production `main@26417fd`).
- **Độc lập với VIPG-WEB-021** (khu /logistics/ chưa duyệt): có thể phát hành riêng.

## 1. Xem trước

```bash
cd ~/Projects/vip-group-com-vn-bang-gia && npm run build && node tests/e2e/serve.mjs dist 4331
# mở http://localhost:4331/#bang-gia
```
Ảnh: `evidence/bang-gia-{desktop,tablet,mobile,mobile-sm}.png` (khối bảng giá) và `evidence/trang-chu-*.png` (cả trang).

## 2. Thay đổi

| File | Nội dung |
|---|---|
| `src/data/vi/pricing.ts` (mới) | 5 mức giá đúng nguyên văn owner; nhãn Trung; chú thích; ngày cập nhật 06/11/2026 |
| `src/components/PriceTable.astro` (mới) | Khối bảng giá: tiêu đề song ngữ, khẩu hiệu VIP GROUP, bảng `<table>` (caption, `th scope`), nút Gọi / Zalo, chú thích đơn vị + phụ phí/thuế |
| `src/pages/index.astro` | Chèn khối **sau "Ba trụ cột"**, trước "Công ty thành viên"; thêm JSON-LD `Service` + 5 `Offer` (VND/kg) |
| `src/components/Seo.astro`, `src/layouts/BaseLayout.astro` | Cho phép JSON-LD bổ sung (Organization vẫn đứng đầu) |
| `src/data/types.ts`, `src/data/vi/index.ts` | Kiểu + đăng ký dữ liệu |
| `tests/pricing.test.mjs` (mới), `tests/e2e/*` | Kiểm thử |
| `docs/backup/live-home-2026-11-06.html` | Bản sao HTML trang chủ production trước thay đổi |

Không đổi: title, H1, mô tả, menu, các khối hiện có, form liên hệ, CSP/header bảo mật, DNS, máy chủ.

## 3. Mức giá hiển thị (đối chiếu yêu cầu)

| Khối lượng | 重量 | Đơn giá |
|---|---|---|
| 0–5 kg | 0–5 公斤 | 20.000 đ/kg |
| Trên 5 đến dưới 100 kg | 5 公斤以上至 100 公斤以下 | 16.000 đ/kg |
| 100 đến dưới 500 kg | 100 公斤至 500 公斤以下 | 15.000 đ/kg |
| 500–1.000 kg | 500–1,000 公斤 | 14.000 đ/kg |
| Trên 1.000 kg | 1,000 公斤以上 | 12.000 đ/kg |

Chú thích: "Đơn vị tính: VNĐ/kg · 单位：越南盾/公斤" và "Phụ phí và thuế (nếu có) sẽ được xác nhận trước khi báo giá chính thức. 附加费及税费（如有）将在正式报价前确认。"

Test kiểm các mức **nối liền, không hở, không chồng**: 5 kg → 20.000; 5,1 kg → 16.000; 100 kg → 15.000; 500 kg và 1.000 kg → 14.000; 1.000,5 kg → 12.000.

## 4. Kiểm thử (06/11/2026)

| Kiểm thử | Kết quả |
|---|---|
| `astro check` | 0 lỗi |
| `npm test` | **115/115 PASS** (107 cũ không đổi + 8 mới) |
| Không ảnh hưởng nội dung cũ | Test so chữ trang chủ (bỏ khối bảng giá) với bản production đã sao lưu: **giống hệt**; thứ tự các khối giữ nguyên |
| E2E Chromium 1366 / 768 / 390 / 320 px | **37/37 PASS**: 0 lỗi console/CSP, không tràn ngang, bảng không bị cắt kể cả ở 320 px, chữ ≥ 14 px, giá ≥ 22 px, nút ≥ 44 px, chữ Trung hiển thị, neo `/#bang-gia` hoạt động |
| SEO | Bảng HTML có ngữ nghĩa, H2 song ngữ, chữ Trung gắn `lang="zh-CN"`, JSON-LD `Service`/`UnitPriceSpecification` (VND, KGM) hợp lệ; không khai thời gian giao/đánh giá |

## 5. Cần owner xác nhận trước khi phát hành

1. **Bản dịch tiếng Trung** (Controller soạn, giản thể) — nên nhờ người bản ngữ / đối tác Trung Quốc duyệt.
2. **Câu chú thích phụ phí/thuế**: yêu cầu ghi "cần được xác nhận trước khi công bố"; trên web tôi viết cho khách đọc là "*sẽ được xác nhận trước khi báo giá chính thức*". Owner duyệt câu chữ, hoặc nếu giá đã gồm/chưa gồm VAT thì ghi rõ.
3. **Cách tính kg**: theo cân nặng thực hay có quy đổi thể tích với hàng cồng kềnh? Hiện web chỉ ghi "theo khối lượng hàng", không nhắc quy đổi.
4. **Phạm vi áp dụng**: giá áp dụng từ kho nào, giao tới đâu (tận nơi hay nhận tại kho)? Hiện ghi chung "Trung Quốc → Việt Nam".
5. **Đơn vị cung cấp dịch vụ**: bảng giá đặt dưới thương hiệu VIP GROUP; trước đây owner chốt mảng logistics do VIPORDER vận hành. Có cần ghi "Dịch vụ do VIPORDER thực hiện" không?
6. Khẩu hiệu giữ bản tiếng Việt chính thức; **chưa dịch khẩu hiệu sang tiếng Trung** (là bản sắc thương hiệu) — nếu muốn, owner cung cấp bản chính thức.

## 6. Phát hành (khi owner ra lệnh) và rollback

Quy trình: push nhánh → PR vào `develop` → CI → verifier → merge → staging → PR `develop → main` → owner duyệt → `production.yml`.

**Sao lưu đã có:**
- Git tag local `backup/production-before-vipg-web-022` → `main@26417fd` (bản đang chạy).
- `docs/backup/live-home-2026-11-06.html`: HTML trang chủ production tải lúc 06/11/2026 06:28 GMT.
- Cloudflare Pages giữ mọi bản deploy trước.

**Rollback:** (a) Cloudflare Pages → Deployments → *Rollback* về bản trước (tức thì); hoặc (b) `git revert <merge commit>` trên `main` rồi chạy lại `production.yml`; hoặc (c) build lại từ tag `backup/production-before-vipg-web-022`. Thay đổi chỉ cộng thêm một khối, nên gỡ không ảnh hưởng phần khác.

## 7. Ghi chú liên quan VIPG-WEB-021 (khu /logistics/)

Khi cả hai được duyệt: trang `/logistics/bang-gia/` (nhánh 021) nên dùng chung `pricing.ts` này và chuyển sang được lập chỉ mục; test 021 "không có giá trên production" sẽ được cập nhật để cho phép giá có nguồn owner. Tôi sẽ xử lý khi gộp hai nhánh.
