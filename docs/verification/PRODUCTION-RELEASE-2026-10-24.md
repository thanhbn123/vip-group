# Biên bản phát hành production — 24/10/2026 (bổ sung 25/10/2026)

> Bước 16 của `docs/RELEASE_PLAN.md`. Mọi SHA, mã run, URL dưới đây lấy từ đầu ra lệnh (`git`, `gh`, `curl`, `dig`) tại thời điểm đo, không chép từ trí nhớ.

## Lệnh của owner

- 24/10/2026, trong hội thoại: *"phát hành production muốn đưa web lên vipgroup.com.vn"*.
- Cùng ngày, sau khi Cloudflare không thêm được zone `.com.vn`: owner chọn **phương án B — giữ DNS ở iNET**, web chạy ở `www`.

## Hai lượt phát hành

| Lượt | PR `develop → main` | SHA `main` | Run workflow Production | Deployment Cloudflare Pages | Duyệt environment `production` |
|---|---|---|---|---|---|
| 1 | #27 | `8284b3a63263be4363c88c66f5457bf40ea0f37d` (cây = develop `3eae2a9`) | 40080219747 — `workflow_dispatch`, success, 2026-10-24T09:00:14Z | `https://4569c168.vip-group.pages.dev` | `thanhbn123` approved — lời duyệt ghi lại câu lệnh của owner |
| 2 | #30 | `552a2bda2f539cd31573c8c90a79fba809bc5fe7` (cây = develop `f2e30a3`) | 40082340108 — `workflow_dispatch`, success, 2026-10-24T09:32:11Z | `https://f35e15f3.vip-group.pages.dev` | `thanhbn123` approved |

Preflight trong cả hai run in `production_branch=main`. Lượt 2 chỉ đổi canonical/sitemap/robots sang `https://www.vipgroup.com.vn` (PR #29).

## Nghiệm thu trên tên miền thật

| Kiểm | Kết quả | Đo |
|---|---|---|
| `https://www.vipgroup.com.vn/` | 200, chứng chỉ Google Trust Services (WE1), hạn 22/01/2027 | `curl -sI`, `openssl s_client` — 24/10 |
| Trùng byte với bản build từ `main` `552a2bd` | 9/9 tệp (7 trang + `robots.txt` + `sitemap.xml`) | `shasum` từng tệp — 24/10 |
| Lập chỉ mục | không có `X-Robots-Tag` trên `www`; `*.pages.dev` vẫn `noindex` | `curl -sI` — 24/10 |
| Header bảo mật | `nosniff`, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, Referrer-Policy | `curl -sI` — 24/10 |
| 404 | `/khong-ton-tai/` → 404 | `curl` — 24/10 |
| Canonical | `https://www.vipgroup.com.vn/` | trang chủ — 24/10 |
| Tên miền gốc | `http(s)://vipgroup.com.vn/<đường dẫn>?<tham số>` → **301** → `https://www.vipgroup.com.vn/<cùng đường dẫn + tham số>`, 1 bước tới 200; chứng chỉ Let's Encrypt (YE1) hạn 23/01/2027 | `curl`, `openssl` — 25/10 17:04 +0700 |

## DNS (iNET OnePortal, nameserver `ns1/ns2.vclouddns.vn` — không đổi)

Bản ghi **thêm** (không sửa bản ghi nào sẵn có):

- 24/10: `www CNAME vip-group.pages.dev` (OneShield tắt).
- 24/10–25/10: `@ A 160.22.170.20` (Chỉ DNS) — tên miền gốc trỏ VPS, Caddy dùng chung chỉ trả 301 sang `www` (`ops/apex-redirect/`).

Bốn bản ghi email Google Workspace (MX, SPF, DKIM `google._domainkey`, `google-site-verification`) đo lại sau mỗi lần thêm: không đổi; khoá DKIM trùng mã băm bản xuất zone 24/10.

## Sự cố trong lúc làm (ghi đúng như đã xảy ra)

- **Cloudflare dashboard** không thêm được zone `vipgroup.com.vn`: bước `registrar/domains/batch_check` trả 422, trang treo (3 lần). Lý do đổi sang phương án B.
- **25/10, Caddy dùng chung trên VPS:** container gắn Caddyfile theo tệp và đang đọc bản cũ (bẫy V-13417 của vault). Hai lượt `caddy reload --config /etc/caddy/Caddyfile` (14:35, 14:36 +0700) theo lệnh Controller đưa đã **gỡ nhầm `ai-thu.vipgroup.com.vn`** khỏi cấu hình đang chạy tới 17:03, khi nạp lại đúng tệp máy chủ qua `/tmp`. Script trong `ops/apex-redirect/` nay luôn nạp qua `/tmp` (PR #33).

## Chưa làm / ngoài phạm vi

- Lighthouse trên tên miền thật (bước 14 của RELEASE_PLAN): **chưa đo**.
- Vá gốc bẫy V-13417 (đổi mount sang thư mục, dựng lại container — gián đoạn ngắn các site dùng chung): chờ owner.
- Phương án A (chuyển nameserver sang Cloudflare): **không làm**; `docs/DNS_MIGRATION.md` giữ làm lịch sử.
