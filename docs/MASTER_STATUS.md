# MASTER STATUS — VIP GROUP WEBSITE

> Ảnh chụp trạng thái, **không phải nguồn chân lý**. GitHub là nguồn chân lý: đo lại (`git ls-remote`, `gh pr list`, `gh run list`) trước khi dựa vào bất kỳ SHA nào ở đây.
> Cập nhật lần cuối: 25/10/2026, trong PR của VIPG-WEB-017 (biên bản phát hành). SHA của chính PR này và commit merge của nó không ghi được ở đây — xem PR trên GitHub.

## Nhánh

| Nhánh | SHA đo được | Ghi chú |
|---|---|---|
| `main` | `552a2bda2f539cd31573c8c90a79fba809bc5fe7` (đo 24/10) | Production. Chỉ cập nhật qua PR `develop → main` khi owner ra lệnh phát hành |
| `develop` | `55f5011d185fd404e3a785fda38d31799f597ef7` (base của PR VIPG-WEB-012) — bảng dòng dưới là lịch sử base của VIPG-WEB-011: `5bb43bd` | CI 36667603110 success · Staging 36667603028 lần 1 success (04:10Z), **lần chạy lại 2 FAIL** (04:28Z, token Cloudflare 401) |

## Work item

| Issue | CR | Trạng thái | PR |
|---|---|---|---|
| #1 | VIPG-WEB-001 — Official corporate website v1 | CLOSED — merged develop `5f34a0b` | #2 |
| #3 | VIPG-WEB-002 — Hardening sau verifier + tài liệu điều phối | CLOSED — `7ce3b7d` | #5 |
| #4 | VIPG-WEB-003 — Thiết lập môi trường staging | CLOSED — **STAGING ACCEPTANCE PASS** 30/09/2026 | #6, hồ sơ #16 |
| #7 | VIPG-WEB-004 — SHA preview chính xác + script inline dưới CSP | CLOSED — `c50fb70` | #8 |
| #9 | VIPG-WEB-005 — Tách job deploy khỏi job build | CLOSED — `e7c813f` | #10 |
| #11 | VIPG-WEB-006 — Job deploy tự tính nhánh/SHA mong đợi | CLOSED — `cc55fac` | #12 |
| #13 | VIPG-WEB-007 — Test hành vi workflow | CLOSED — `920919b` | #14 |
| #15 | VIPG-WEB-008 — Hồ sơ nghiệm thu staging | CLOSED — `1974fcd` | #16 |
| #17 | VIPG-WEB-009 — Siết test hành vi + sửa tài liệu | CLOSED — `393cadd` | #18 |
| #19 | VIPG-WEB-010 — Chuẩn bị production (không phát hành) | CLOSED — `5bb43bd`; READINESS kỹ thuật PASS | #20 |
| #21 | VIPG-WEB-011 — Chuẩn bị cuối: V-11510, DNS, email, nội dung, kế hoạch phát hành | CLOSED — `55f5011` | #22 |
| #23 | VIPG-WEB-012 — Nội dung thật: pháp nhân, hotline, email, slogan, logo | Đang làm | (PR của chính thay đổi này) |

## Gate hiện tại

**Production readiness** (VIPG-WEB-010). Phát hành cần lệnh owner + CONTENT gate + quyết định DNS — xem `docs/PRODUCTION_READINESS.md`.

## Kỹ thuật — mỗi dòng ghi đúng nơi đo

| Hạng mục | Trạng thái | Đo ở đâu |
|---|---|---|
| Type check / build / test | PASS | CI mỗi PR; gần nhất CI 36607106601 trên `393cadd` |
| Link nội bộ, sitemap, robots, canonical, OG, schema.org | PASS | test mỗi PR; staging thật 30/09 (11/11 link) |
| Form tắt/bật JS không rò dữ liệu | PASS | verifier PR #5 (cục bộ) · nghiệm thu staging 30/09 (live, CDP) |
| CSP `<meta>` có hash, không unsafe-inline, thực thi thật | PASS | verifier PR #8 (đột biến bị chặn) · staging 30/09 |
| Header bảo mật `public/_headers` | PASS trên staging | nghiệm thu staging 30/09 |
| Lighthouse | Staging thật: 7/7 trang P/A/BP 100, SEO 66 (noindex có chủ đích) | nghiệm thu staging 30/09 |
| Workflow staging: không deploy giả, không production, credential cô lập, không tin output build | PASS | verifier PR #6, #10, #12 |
| Test hành vi workflow (chạy thật script) | PASS | verifier PR #14, #18; CI Ubuntu |
| Chế độ production (noindex chỉ ở `*.pages.dev`, workflow production có cổng) | PASS | verifier PR #20 (7/7 đột biến) · verifier RC `5bb43bd` |
| Token Cloudflare trong repo | Hợp lệ — preflight `production_branch=main` (run 36670538125) | Sự cố 30/09 ~04:22Z–04:45Z: 401 / code 10000; owner đặt lại secret 04:45:06Z |

## CONTENT gate — V-11501

**3 mục MUST_HAVE đã có đủ (24/10/2026):** tên pháp lý, địa chỉ, logo — cùng hotline, email, slogan owner chốt. Từ VIPG-WEB-013 không còn placeholder nội dung: hai khối Công nghệ và Bất động sản ghi rõ là chưa có công ty thành viên riêng. Chi tiết: `docs/CONTENT_INPUT_PACK.md`.

## Staging

**PASS** (30/09/2026) — https://staging.vip-group.pages.dev, SHA nghiệm thu `920919b`, run 36602899641, verifier độc lập PASS. Chi tiết: `docs/verification/VIPG-WEB-003-STAGING-ACCEPTANCE.md`.

## Production

**ĐÃ PHÁT HÀNH 24/10/2026** theo lệnh owner — web chạy ở **https://www.vipgroup.com.vn** (DNS giữ ở iNET, `www` CNAME → `vip-group.pages.dev`); tên miền gốc 301 sang `www` từ 25/10 (`ops/apex-redirect/`). Biên bản: `docs/verification/PRODUCTION-RELEASE-2026-10-24.md`. Kiến trúc, rollback: `docs/PRODUCTION.md`.

## Blocker

| Loại | Nội dung |
|---|---|
| OWNER_DECISION | V-13417 (hạ tầng VPS, ngoài repo): Caddy dùng chung gắn Caddyfile theo tệp — vá gốc cần dựng lại container, gián đoạn ngắn |
| NOT_MEASURED | Lighthouse trên tên miền thật |
