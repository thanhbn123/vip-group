# DNS MIGRATION — `vipgroup.com.vn` sang Cloudflare (OPTION A) — CHỈ LÀ KẾ HOẠCH

> Owner chọn **OPTION A — Cloudflare là DNS có thẩm quyền** ngày 30/09/2026 như **quyết định chuẩn bị**. Không bước nào ở đây được Controller tự thực hiện. **Không đổi nameserver, không sửa DNS** khi chưa có lệnh riêng của owner.
> Nguồn Cloudflare (đọc nguyên văn từ developers.cloudflare.com ngày 30/09/2026): Pages → Custom domains; DNS → Full setup.

## 1. Kiểm kê DNS hiện tại (đo 30/09/2026, chỉ đọc)

**Phương pháp:** truy vấn thẳng nameserver có thẩm quyền `ns1.vclouddns.vn` (`dig +norecurse`) cho tên gốc và hơn 40 tên hay gặp (www, mail, webmail, autodiscover, `_dmarc`, các selector DKIM, SRV email, mta-sts…), đủ loại A, AAAA, CNAME, MX, TXT, SRV, CAA, NS. `ns2.vclouddns.vn` trả cùng serial SOA `2026092910`. Tên không tồn tại trả `NXDOMAIN` → **không có bản ghi wildcard**. **Không** thử zone transfer (AXFR).

**Giới hạn — đọc kỹ:** truy vấn công khai chỉ tìm được tên mà mình hỏi tới. Nó **không chứng minh** zone không còn bản ghi nào khác. Muốn có danh sách đầy đủ, owner phải **xuất zone từ bảng quản trị vCloud** (mục 6, điều kiện E1).

| Tên | Loại | Giá trị | TTL | Nhãn |
|---|---|---|---|---|
| `vipgroup.com.vn` | MX | `1 SMTP.GOOGLE.COM.` | 300 | **EMAIL CRITICAL** — Google Workspace nhận thư |
| `vipgroup.com.vn` | TXT | `v=spf1 include:_spf.google.com ~all` | 300 | **EMAIL CRITICAL** — SPF |
| `google._domainkey.vipgroup.com.vn` | TXT | `v=DKIM1;k=rsa;p=MIIBIjAN…IDAQAB` (khoá RSA 2048, 2 chuỗi) | 300 | **EMAIL CRITICAL** — DKIM Google |
| `vipgroup.com.vn` | TXT | `google-site-verification=Za0kjaLIHu58KLZbRrrLHfZPY8wqDG6g8QVUkR395N8` | 300 | **EMAIL CRITICAL** — xác minh tên miền Google Workspace |
| `vipgroup.com.vn` | NS | `ns1.vclouddns.vn.`, `ns2.vclouddns.vn.` | 300 | Sẽ thay bằng NS Cloudflare |
| `vipgroup.com.vn` | SOA | `ns1.vclouddns.vn. hostmaster.vipgroup.com.vn. 2026092910 7200 300 1209600 60` | 300 | Cloudflare tự tạo SOA mới |

**Không tìm thấy (trong phạm vi đã hỏi):** A/AAAA/CNAME cho `vipgroup.com.vn` và `www` (hiện chưa có website) · **DMARC** (`_dmarc`) · CAA · SRV · các bản ghi mail khác (autodiscover, mta-sts…) · DS ở zone cha → **không bật DNSSEC**.

Giá trị DKIM đầy đủ: lấy từ bản xuất vCloud hoặc `dig +short TXT google._domainkey.vipgroup.com.vn` ngay trước khi chép — phải chép **nguyên văn cả hai chuỗi**, không cắt.

## 2. Kế hoạch zone Cloudflare (chưa tạo)

| Bản ghi hiện tại | Loại | Tên | Giá trị | TTL | Proxy dự kiến | EMAIL CRITICAL | Hành động |
|---|---|---|---|---|---|---|---|
| MX Google | MX | `@` | `SMTP.GOOGLE.COM` (ưu tiên `1`) | Auto | DNS only (MX không proxy được) | **CÓ** | Chép nguyên |
| SPF | TXT | `@` | `v=spf1 include:_spf.google.com ~all` | Auto | DNS only (TXT không proxy) | **CÓ** | Chép nguyên |
| DKIM | TXT | `google._domainkey` | nguyên văn khoá hiện tại | Auto | DNS only | **CÓ** | Chép nguyên, so từng ký tự |
| Xác minh Google | TXT | `@` | `google-site-verification=Za0kjaLIHu58KLZbRrrLHfZPY8wqDG6g8QVUkR395N8` | Auto | DNS only | **CÓ** | Chép nguyên |
| (bản ghi khác trong bản xuất vCloud, nếu có) | — | — | — | — | Mail → DNS only | tuỳ | Chép nguyên, gắn nhãn |
| — (chưa có) | CNAME | `@` | `vip-group.pages.dev` | Auto | **Pages tự tạo** khi thêm custom domain | không | **Không tạo tay** — thêm trong Pages (mục 3 bước 11) |
| — (chưa có) | CNAME | `www` | `vip-group.pages.dev` | Auto | Pages tự tạo | không | Thêm `www` làm custom domain trong Pages, rồi Redirect Rule `www` → apex (301) |
| DMARC | — | — | — | — | — | — | **Không có hiện tại — không thêm trong lần chuyển** (giữ nguyên hành vi email). Có thể thêm sau, quyết định riêng của owner |

**Không cần bản ghi A** cho website: tài liệu Pages viết *"If your nameservers are successfully pointed to Cloudflare, Cloudflare will proceed by creating a CNAME record for you."* Cloudflare dùng CNAME ở apex (được làm phẳng).

## 3. Trình tự thực hiện (owner ra lệnh từng giai đoạn)

| # | Bước | Ai | Thay đổi production? |
|---|---|---|---|
| 1 | **Xuất toàn bộ zone** từ bảng quản trị vCloud (file hoặc ảnh chụp đủ mọi bản ghi, kèm TTL) và lưu lại | Owner | Không |
| 2 | Cloudflare → *Onboard a domain* → `vipgroup.com.vn`, chọn gói → zone ở trạng thái **Pending** | Owner (hoặc Controller nếu owner uỷ quyền riêng) | Không (NS chưa đổi) |
| 3 | Rà bản ghi Cloudflare tự quét, **đối chiếu từng dòng** với bản xuất bước 1 (*"the quick scan is not guaranteed to find all existing DNS records"*); thêm bản ghi thiếu; xoá bản ghi web thừa nếu quét nhầm | Owner/Controller | Không |
| 4 | Kiểm 4 bản ghi EMAIL CRITICAL: giá trị trùng từng ký tự; MX/TXT ở **DNS only** | Owner + Controller đối chiếu | Không |
| 5 | Ghi lại cặp **nameserver Cloudflare cấp** (không đổi được) | Owner | Không |
| 6 | (Khuyến nghị) Hỏi thẳng NS Cloudflare trước khi chuyển: `dig @<ns-cloudflare> vipgroup.com.vn MX/TXT`, `dig @<ns-cloudflare> TXT google._domainkey.vipgroup.com.vn` — kết quả phải trùng bảng mục 1. Nếu NS Cloudflare không trả lời khi zone còn Pending, bỏ qua bước này và dựa vào bước 4 | Controller (chỉ đọc) | Không |
| 7 | **Đổi nameserver** tại nhà đăng ký/nhà cung cấp tên miền `.vn` sang cặp NS Cloudflare. DNSSEC đang **tắt** (không có DS) nên không cần thao tác DNSSEC trước | **Owner** | **CÓ** — cổng riêng |
| 8 | Theo dõi lan truyền: `dig NS vipgroup.com.vn @8.8.8.8`, `@1.1.1.1`; Cloudflare chuyển zone sang **Active** (có thể tới 24 giờ) | Controller (chỉ đọc) | — |
| 9 | Kiểm email ngay (mục 4 phần "Sau") | Owner + Controller | — |
| 10 | Workflow production đã deploy bản `main` (theo `docs/RELEASE_PLAN.md`) | Owner duyệt | CÓ |
| 11 | Pages → `vip-group` → Custom domains → thêm `vipgroup.com.vn`, rồi `www.vipgroup.com.vn` → Pages tự tạo CNAME + cấp chứng chỉ (không có CAA chặn) | Owner (hoặc Controller nếu uỷ quyền) | **CÓ** |
| 12 | Redirect Rule `www.vipgroup.com.vn/*` → `https://vipgroup.com.vn/$1` (301) | Owner/Controller | CÓ |
| 13 | Kiểm HTTPS apex + www, canonical, lập chỉ mục (không `X-Robots-Tag` trên `vipgroup.com.vn`) — `docs/PRODUCTION_READINESS.md` phần C | Controller + verifier | — |
| 14 | (Tuỳ chọn, sau khi ổn định) bật DNSSEC trong Cloudflare rồi thêm DS tại nhà đăng ký | Owner | CÓ |

Thứ tự bước 7 và 10–11 có thể đảo: hiện **chưa có website** trên tên miền nên không có gián đoạn web; rủi ro duy nhất của việc đổi NS là **email** — vì vậy bước 1–6 phải xong trước bước 7.

## 4. Checklist an toàn email (BẮT BUỘC)

**Trước khi đổi nameserver — tất cả phải ✅, thiếu một mục → `DNS MIGRATION READY = NO`:**

- [ ] E1 — Có bản xuất **toàn bộ** zone từ vCloud (không chỉ dựa vào truy vấn công khai)
- [ ] E2 — MX `1 SMTP.GOOGLE.COM` đã ghi lại
- [ ] E3 — SPF `v=spf1 include:_spf.google.com ~all` đã ghi lại
- [ ] E4 — DKIM `google._domainkey` đã ghi lại **đủ cả hai chuỗi**
- [ ] E5 — DMARC: xác nhận **không có** trong bản xuất (hoặc đã ghi lại nếu có)
- [ ] E6 — `google-site-verification` đã ghi lại
- [ ] E7 — Mọi bản ghi khác trong bản xuất đã có trong zone Cloudflare
- [ ] E8 — Zone Cloudflare chứa bản ghi tương đương E2–E7, giá trị trùng từng ký tự
- [ ] E9 — Không bản ghi liên quan email nào bị đặt **Proxied**
- [ ] E10 — DNSSEC tại nhà đăng ký đang tắt (đã đo: không có DS)

**Sau khi đổi nameserver — owner kiểm và báo lại:**

- [ ] Gmail **nhận** thư từ ngoài vào `@vipgroup.com.vn`
- [ ] Gmail **gửi** thư ra ngoài (ví dụ tới một hộp thư Gmail cá nhân) và thư không vào spam
- [ ] Tiêu đề thư nhận được: `spf=pass`, `dkim=pass` (Gmail → *Show original*)
- [ ] DMARC: không cấu hình (giữ nguyên) — hoặc `dmarc=pass` nếu owner đã thêm
- [ ] Google Admin → Domains / Gmail authentication: không cảnh báo
- [ ] `dig MX vipgroup.com.vn @8.8.8.8` và `@1.1.1.1` trả `SMTP.GOOGLE.COM`

## 5. DNS MIGRATION READY

**NO** — tại 30/09/2026. Lý do: **E1 chưa có** (chưa có bản xuất zone từ vCloud; truy vấn công khai không chứng minh được zone đầy đủ); E7–E9 chưa thể làm vì zone Cloudflare chưa tạo. E2, E3, E4, E6, E10 đã đo được qua truy vấn công khai; E5 "không thấy" qua truy vấn công khai.
