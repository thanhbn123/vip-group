# G17 — BÁO CÁO NGHIỆM THU CUỐI (G15 V2 + GIÁ TỪNG KIỆN + STAGING)

Ngày 07/11/2026 · Controller (single-writer): phiên `8d` · **Trạng thái: NO-GO PRODUCTION — chờ owner nghiệm thu.**

## 1. Commit trước / sau

| | Trước tích hợp | Sau tích hợp |
|---|---|---|
| `main` (production) | `5ee2efd` | **`5ee2efd` — KHÔNG ĐỔI** |
| `develop` (staging) | `37469e4` | `8c83901` (merge PR #44) |
| Nhánh tích hợp | — | `feature/vipg-web-025-seo-v11@6d1206b` (verifier PASS đúng HEAD này) |

V2 (phiên ec, bundle `vipg-web-026`, commit gốc 9701647) đã review và hợp nhất fast-forward; nhánh viết lại lịch sử chỉ ở commit chưa từng push để gỡ ảnh PNG kiểm thử (không force-push).

## 2. File thay đổi (develop 37469e4 → 8c83901)

94 file (+11.888 / −89), trong đó mã + cấu hình 50 file (+3.395 / −71): `src/pages/logistics/*` (10), `src/components/logistics/*` (9), `src/components/*` (6), `src/lib/*` (5: logistics, pricing, pickup, schema, mode), `src/data/vi/*` (4), `public/_worker.js`, `public/_routes.json`, `ops/lead-sheet/*`, `scripts/preview.sh`, test (12), docs/seo (15).

## 3. Kết quả kiểm thử thực tế (repo chính, không dùng kết quả bản phụ)

| Bộ | Kết quả |
|---|---|
| `astro check` | 0 lỗi, 0 cảnh báo |
| `npm test` | **181/181** (gồm `tests/pricing-policy.test.mjs`: mọi ngưỡng biên, quy đổi 6000, từng kiện vs lô, làm tròn, công cụ tính, nút sao chép) |
| CI GitHub (Node 22, ubuntu-24.04) | PR #44: build, build-test, deploy, staging-hub + 3 check con — đạt |
| E2E Chromium (desktop + mobile, prod + demo) | Logistics **209/209** · form lead (Turnstile mã thử, Sheet giả) **21/21** · bảng giá trang chủ 4 khổ màn hình **37/37** · V2 5 trang **148/148** |
| Kiểm tra độc lập | G13 QA, G13 SEO, G16 Verifier: PASS WITH FINDINGS → mọi P1 đã xử lý; verifier delta: **PASS** trên `6d1206b` |
| Đột biến | 7/7 (G13) + 6/6 (G16, sau khi vá) bị test bắt |

## 4. Lỗi đã sửa / còn tồn

**Đã sửa:** trang nháp lọt ra production (route kiểm trạng thái); khẳng định chưa nguồn (giao tận nơi, door-to-door, "kho của…"); câu "cả lô" thay bằng "từng kiện" toàn site (vi/zh/JSON-LD) + test theo câu có hỗ trợ Unicode; công cụ tính theo kiện; nhãn zh biên giá; "phường 福海街道"; cổng lead (Origin null, body lớn, timeout, `page`); hotline tập trung 1 nơi; ảnh PNG kiểm thử khỏi repo.

**Còn tồn (không chặn kỹ thuật):**
- 4 trang tuyến trùng ~72% văn bản (bảng giá, 4 bước, tóm tắt dùng chung) → cần dữ liệu thật riêng từng kho (ảnh, giờ nhận, thời gian vận chuyển) để khác biệt.
- Rủi ro kinh doanh do bậc giá (owner quyết): giá nhảy ở ngưỡng (5 kg = 100.000 đ > 5,01 kg = 80.160 đ; 1.000 kg = 14.000.000 đ > 1.000,01 kg ≈ 12.000.120 đ); tính theo kiện tạo động cơ gộp kiện (3×4 kg = 240.000 đ, gộp 12 kg = 192.000 đ).
- Chưa quy định: làm tròn trọng lượng (hiện KHÔNG làm tròn — kiện 5,02 kg → 16.000), cước tối thiểu/kiện, bậc 500 kg/1.000 kg cho MỘT kiện (pallet).
- Banner trang chủ: chờ file ảnh gốc (owner đã chọn bỏ dòng "Ưu đãi … OBranding").
- Tin tức trống; GA4 chưa gắn; 8 bài kiến thức còn nháp.

## 5. Staging

`https://staging.vip-group.pages.dev` (develop `8c83901`) — **Cloudflare Access** (owner đăng nhập), header `X-Robots-Tag: noindex` trên `*.pages.dev`. Không đổi DNS, Cloudflare production hay website thật.

## 6. Ảnh 5 trang V2 (desktop + mobile)

`evidence/final/` (local, không đưa vào git): `prod-{desktop,mobile}-logistics_kho-trung-quoc.png`, `…_van-chuyen-{tham-quyen,ha-mon,quang-chau,nghia-o}-ve-viet-nam.png` (10 ảnh) + bản demo.

## 7. Dữ liệu thật còn thiếu

Thời gian vận chuyển từng tuyến · giờ nhận hàng + ảnh thật 4 kho · phạm vi giao tận nơi · phụ phí/thuế/chính sách bồi thường · quy tắc làm tròn + cước tối thiểu · người bản ngữ duyệt tiếng Trung · tin tức · GA4 ID · cài thu lead A–E (biến Cloudflare **Production**) · file banner.

## 8. Đánh giá SEO và nội dung Việt–Trung

- SEO kỹ thuật: 1 H1/trang, title/description riêng, canonical về `www`, sitemap 21 URL khớp trang ready, robots đúng, JSON-LD hợp lệ (Service + Offer theo kiện, FAQPage, BreadcrumbList, HowTo, Place 4 kho), không link hỏng/trang mồ côi, HTML gzip 7–15 KB/trang.
- Nội dung: chỉ dữ kiện có nguồn; không khẳng định sở hữu kho; không công khai người nhận/SĐT kho/mã khách; địa chỉ zh nguyên văn (test so từng ký tự).
- Tiếng Trung: `lang="zh-CN"` đúng; nhãn biên giá rõ (超过 / 不足 / 含); vài câu cần người bản ngữ chỉnh tự nhiên hơn (G16 §5).

## 9. Production không đổi

`main@5ee2efd`; www.vipgroup.com.vn trả 200, không có link `/logistics/` (đo 07/11/2026).

## 10. Đề xuất GO/NO-GO

**NO-GO hiện tại.** Đề xuất **GO có điều kiện** khi owner:
1. Nghiệm thu thực tế trên staging + 3 bản local (mục 11).
2. Chấp nhận (hoặc điều chỉnh) rủi ro bậc giá ở mục 4 và quyết định làm tròn / cước tối thiểu — hoặc chấp nhận công bố như hiện tại.
3. Chọn: (a) cài thu lead A–E trước → form chạy ngay; hoặc (b) phát hành với form ở trạng thái cũ (đặt `TURNSTILE_SITE_KEY = null`).
4. Ra lệnh phát hành: PR `develop → main` → CI → merge → `production.yml` (gõ SHA) → duyệt environment `production`.

**Rollback:** Cloudflare Pages → Rollback về deployment của `5ee2efd` (tức thì); hoặc revert merge trên `main` + chạy lại `production.yml`. Tắt riêng form: xoá `TURNSTILE_SECRET`.

## 11. Mở 3 bản nghiệm thu local + checklist

```bash
cd ~/Projects/vip-group-com-vn
npm run preview:start     # build 3 bản → .preview/, chạy nền độc lập (không tắt theo phiên AI)
npm run preview:status
npm run preview:stop      # chỉ tắt đúng 3 server của script
```
1. Bản sẽ phát hành — http://localhost:4321/ (ô chống spam báo "domain not allowed" trên localhost là đúng)
2. Bản demo nghiệm thu — http://localhost:4322/ (dữ liệu MẪU + bài nháp, noindex)
3. Gửi thử form — http://localhost:4351/lien-he/ (lead đã gửi: `/__mock/rows`)

Checklist: ☐ trang chủ không đổi bố cục ngoài bảng giá/menu Logistics · ☐ bảng giá 5 mức + ghi chú "từng kiện" · ☐ hotline 0961 102 655 + nút gọi trên điện thoại · ☐ `/logistics/kho-trung-quoc/` 4 địa chỉ zh + nút sao chép (dán thử) · ☐ 4 trang tuyến có bảng giá chung · ☐ `/logistics/bang-gia/` công cụ tính: 3 kiện 60×50×40, 12 kg → 960.000 đ · ☐ gửi form ở :4351, xem `/__mock/rows` · ☐ mobile: thanh Gọi/Zalo/Báo giá · ☐ `/chinh-sach-bao-mat/`.
