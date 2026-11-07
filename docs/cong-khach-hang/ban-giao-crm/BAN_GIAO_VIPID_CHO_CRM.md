# BÀN GIAO VIP ID → CRM — Cổng khách hàng P1

Ngày 07/11/2026. Người lập: kỹ sư tích hợp (phiên website, Controller). **Chỉ dev, chỉ dữ liệu tổng hợp. Production NO-GO.**

**Nguồn sự thật:** mã VIP ID realm khách, worktree `~/code/vip-group-id-khach`, nhánh `feature/khach-p1` @ **`5e1effe`**. Mọi trích dẫn `file:dòng` không ghi repo là của VIP ID ở commit này. Hợp đồng nền: `../KIEN_TRUC_P1.md` v1.1 và §11. Chỗ nào hợp đồng và mã khác nhau, tài liệu này theo **mã**.

**Phía CRM được đối chiếu ở hai trạng thái** (repo `vip-group-khoqctq`, chỉ đọc):
- **HEAD `a791c67`**: bản đã commit;
- **WIP**: cây làm việc chưa commit lúc đọc (07/11 khoảng 16:30), gồm sửa `internal.js`, `vipid-client.js`, `outbox.js`, `review.js` và migration mới `703_portal_hmac_seen.sql`.

Bộ kit: `kit/contract-test.mjs`. Dữ liệu mẫu: `kit/du-lieu-mau.md`.

---

## 0. Tóm tắt cho đội CRM

1. **Chữ ký hai chiều** chỉ có **một** công thức: `HMAC-SHA256(secret, "<direction>.<METHOD>.<path>.<ts>." + byte_thân)`. Kết quả là hex, gửi trong **`X-Portal-Sig`**. VIP ID **không gửi và không đọc** `X-Portal-Sig-V2`. HEAD `a791c67` sai cả hai chiều (G1, G2). WIP đã sửa và kit đã kiểm bằng VIP ID thật (mục 6).
2. **Signup là upsert theo `subject`.** Cờ `phone_conflict` đến bằng một bản gửi **mới** với `Idempotency-Key = signup:<subject>:xung-dot-<n>`. VIP ID coi **2xx và 409** là "đã xong", nên CRM **không được** trả 409 cho bản cập nhật hợp lệ, nếu không cờ sẽ mất (G5, G6).
3. **Còn chặn ở cả HEAD lẫn WIP (G7).** `POST /api/internal/portal/thu-hoi` của CRM đặt `users.active=false` **vĩnh viễn** và đánh dấu đăng ký `revoked_at`. Nhưng VIP ID gửi `thu-hoi` mỗi khi khách **đăng xuất** hoặc **đặt lại mật khẩu**. Hậu quả:
   - khách đăng xuất một lần là không vào cổng được nữa;
   - khách đang chờ duyệt mà đặt lại mật khẩu thì không bao giờ được duyệt nữa.

   `thu-hoi` phải chỉ **huỷ phiên**.
4. **Host khi gọi VIP ID.** Gọi thẳng cổng nội bộ VIP ID, kèm `Host:` thuộc `COWORK_KHACH_HOSTS`. Dev: `http://127.0.0.1:8898` với `Host: khach.localhost:8890`. Sai Host ⇒ **421**.

   VIP ID gọi CRM ở `CRM_PORTAL_INTERNAL_URL`. Đây phải là **cổng trực tiếp** của CRM (dev `http://127.0.0.1:5175`), không qua proxy và không mang Host cổng khách.

---

## 1. HMAC — đặc tả ký và kiểm (cả hai chiều)

### 1.1. Bí mật
| Mục | VIP ID | Ghi chú cho CRM |
|---|---|---|
| Nguồn | env `VIPID_PORTAL_SECRET` → tệp `VIPID_PORTAL_SECRET_FILE` (mặc định `data/portal_secret.key`, 0600) → dev tự sinh (`khach.py:73-78`, `config.py:76-98,140`) | Dev: CRM đọc **cùng tệp** `data/khach-dev/portal_secret.key` (`scripts/khach-dev.sh:35-36`) |
| Chuẩn hoá | `.strip()`: bỏ mọi khoảng trắng đầu và cuối (`config.py:78,83`) | CRM chỉ bỏ CR/LF **cuối** (`server/config.js:29`), env dùng nguyên văn ⇒ G11 |
| Độ dài | ≥ 32 byte UTF-8, nếu không thì từ chối khởi động (`khach.py:136-138`) | |
| Khác bí mật khác | so với `BRAIN_SHARED_SECRET`, `SECRET_KEY`, `HATANG_SHARED_SECRET`, `VIPID_SHARED_SECRET`, `COWORK_SHARED_SECRET` (`khach.py:139-143`) | |
| Dùng cho | HMAC hai chiều **và** launch token (`khach.py:942`) | |

### 1.2. Chuỗi ký (canonical) — `khach.py:953-956`
```
canonical = UTF8("<direction>.<METHOD>.<path>.<ts>.") ‖ body_bytes
sig       = lowercase_hex( HMAC_SHA256( UTF8(secret), canonical ) )
```
| Thành phần | Giá trị chính xác |
|---|---|
| `direction` | `vipid->crm` khi VIP ID gửi (`khach.py:35`), `crm->vipid` khi CRM gửi (`khach.py:36`) |
| `METHOD` | chữ hoa, luôn `POST` (`khach.py:956` gọi `.upper()`) |
| `path` | đường dẫn request **không có query**, đúng như bên nhận thấy. VIP ID kiểm bằng `request.url.path` (`khach_web.py:560`). Không có host, scheme hay dấu `/` cuối |
| `ts` | Unix **giây**, số nguyên thập phân, chỉ chữ số (`khach.py:961`). Bên nhận chấp nhận `^\d{1,12}$` (`khach.py:975`). `"+N"` hay `"N.0"` đều bị từ chối |
| `body_bytes` | **đúng các byte** gửi trên dây (không parse rồi serialize lại). VIP ID gửi `json.dumps(payload, ensure_ascii=False, separators=(",",":"))`, UTF-8, không khoảng trắng (`khach.py:1008-1009`) |
| Ngăn cách | dấu `.` sau `ts` luôn có, kể cả khi body rỗng |

Ví dụ chuỗi ký (secret giả `S`):
```
vipid->crm.POST./api/internal/portal/signups.1794043532.{"subject":"cust:kh_…","display_name":"Khách Thử 1",…}
crm->vipid.POST./api/internal/khach/tam-khoa.1794043532.{"subject":"cust:kh_…","action":"khoa","reason":"…"}
```
Chuỗi ký **cũ** `"<direction>.<ts>.<body>"` (KIEN_TRUC_P1 §4) **không còn hợp lệ ở bất kỳ chiều nào**, vì VIP ID trả 401 (kit V08).

### 1.3. Header
| Header | Bắt buộc | Giá trị |
|---|---|---|
| `Content-Type` | có | `application/json` (`khach.py:1022`) |
| `Content-Length` | **có** | VIP ID từ chối thân không có Content-Length (chunked) bằng 413 (`khach_web.py:538-545`) |
| `X-Portal-Ts` | có | như trên |
| `X-Portal-Sig` | có | 64 ký tự hex. VIP ID nhận cả hex hoa vì có `.lower()` (`khach.py:973`), nhưng khi gửi hãy dùng hex thường |
| `Idempotency-Key` | VIP ID → CRM: luôn gửi (`khach.py:1022`) | CRM → VIP ID: VIP ID **bỏ qua**; idempotent theo trạng thái (mục 2.2) |
| `Host` | CRM → VIP ID: **bắt buộc** thuộc `COWORK_KHACH_HOSTS` | mục 4 |
| `X-Portal-Sig-V2` | **không dùng** | VIP ID không đọc. Gửi kèm cũng vô hại nhưng không thay được `X-Portal-Sig` |

### 1.4. Lệch giờ, phát lại, giới hạn thân (bên nhận VIP ID — CRM nên làm y hệt)
- **Lệch giờ:** `|now − ts| ≤ 300` giây, cả quá khứ lẫn tương lai (`khach.py:977`).
- **Phát lại:** chữ ký hợp lệ được ghi vào `customer_hmac_seen(sig PRIMARY KEY)` **trước khi** chạy xử lý, và giữ 900 giây (`khach.py:983-991`, `schema.py:335`). Gửi lại **y hệt** (cùng method, path, ts, body) ⇒ **409 `PHAT_LAI`**.
  - Hệ quả: `ts` tính bằng giây, nên hai lần gửi **cùng thân trong cùng một giây** cũng là phát lại (kit đã gặp ở lần chạy đầu: V23).
  - CRM **phải ký lại với `ts` mới mỗi lần gửi** và nên giãn ≥ 1 giây giữa các lần gửi cùng thân.
  - Chữ ký bị "tiêu" ngay cả khi xử lý sau đó trả lỗi. Vì vậy 409 `PHAT_LAI` chỉ an toàn để coi là "đã gửi" khi lần trước đó đã nhận được 2xx.
- **Giới hạn thân:** tối đa **10 000 byte** (`khach_web.py:535`).
  - Kiểm `Content-Length` **trước** khi đọc: thiếu, âm hoặc lớn hơn ⇒ 413 (`khach_web.py:540-545`).
  - Đọc dạng luồng và cắt ở giới hạn (`khach_web.py:546-551`).
  - **Thứ tự kiểm:** thân (413) → chữ ký (409/401) → JSON (400) → nghiệp vụ (`khach_web.py:554-580`). 413 có thể đến **trước** khi chữ ký được xét.

### 1.5. Mã trạng thái CRM sẽ nhận từ VIP ID (`/api/internal/khach/*`)
Thân lỗi luôn là `{"ok":false,"loi":{"ma":"<MÃ>","thongBao":"…"}}` (`khach_web.py:530-532`). Thân thành công là `{"ok":true,"data":{…}}` (`khach_web.py:580`). **Không** có `error.code`.

| HTTP | `loi.ma` | Khi nào | CRM nên |
|---|---|---|---|
| 200 | — | thành công (kể cả idempotent: `data.idempotent=true`) | đánh dấu sent |
| 400 | `JSON_SAI` | chữ ký đúng nhưng thân không phải JSON object (`khach_web.py:569-574`) | lỗi lập trình: failed, không thử lại |
| 400 | `DU_LIEU_SAI` | thiếu hoặc sai trường (mục 2.2) | failed, cho nhân viên xem |
| 400 | `THAM_SO_SAI` | lỗi kiểm tham số của framework (`khach_web.py:619-621`) | failed |
| 401 | `CHU_KY_SAI` | thiếu hoặc sai chữ ký, sai chiều, sai path hay method, lệch > 300 giây, ts không phải số thuần (`khach_web.py:565-568`) | cảnh báo cấu hình hoặc bí mật; chỉ thử lại sau khi sửa |
| 404 | `KHONG_TIM_THAY` | chữ ký **đã qua** nhưng `subject` không có hoặc không bắt đầu bằng `cust:` (`khach.py:1065-1067,1129-1131,1159-1161`) | failed |
| 404 | `HTTP_404` | sai đường dẫn trên host khách (`khach_web.py:599-603`) | lỗi cấu hình |
| 405 | `HTTP_405` | sai method | lỗi lập trình |
| 409 | `PHAT_LAI` | chữ ký đã dùng (`khach_web.py:563-564`) | xem 1.4 |
| 409 | `XUNG_DOT` | xung đột nghiệp vụ (mục 2.2) | failed, cho nhân viên xem |
| 413 | `QUA_LON` | thiếu Content-Length, chunked, hoặc > 10 000 byte | lỗi lập trình |
| 421 | *(text/plain "421 Misdirected Request")* | `Host` không thuộc danh sách host khách hay host nhân viên (`khach_web.py:42-57`) | lỗi cấu hình `PORTAL_HOST` / `VIPID_PORTAL_URL` |
| 500 | `LOI_HE_THONG` | lỗi VIP ID (`khach_web.py:610-614`) | thử lại theo backoff |

Chú ý: Host là host **nhân viên** VIP ID (vd `127.0.0.1:8899`) ⇒ request đi vào app nhân viên, nơi `/api/internal/khach/*` không tồn tại (404 dạng khác). Realm khách tắt (`COWORK_KHACH_ENABLED=0`) ⇒ không có route nội bộ khách ở đâu cả (`khach_web.py:7`).

---

## 2. Endpoint

### 2.1. VIP ID gọi CRM (`vipid->crm`)
Mọi lời gọi đi qua hàng đợi `crm_sync_pending` (`schema.py:319-332`):
- `xep_hang_crm` ghi `INSERT OR IGNORE` theo `idem_key` rồi gửi **ngay, đồng bộ trong request của khách** (`khach.py:1002-1014`). Timeout `CRM_PORTAL_TIMEOUT` = **3 giây** (`config.py:137`, `khach.py:995-999`). CRM chậm thì khách phải chờ.
- **Thành công** = `200 ≤ status < 300` **hoặc** `status == 409` (`khach.py:1026`). VIP ID **không đọc thân** phản hồi.
- Mọi kết quả khác (4xx ≠ 409, 5xx, lỗi mạng) ⇒ giữ lại, `next_at = now + min(3600, 30·2^min(n,7))` giây, tức 60 s, 120 s, 240 s, … tối đa 1 giờ (`khach.py:1035`). Thử lại **không giới hạn số lần**.
- Lần thử lại **chỉ** chạy qua CLI và cron `python -m cowork.cli khach-dong-bo` (`cli.py:8,209-224`). Không có worker nền.
- Mỗi lần gửi (kể cả gửi lại) **ký `ts` mới** (`khach.py:1021-1023`).

Hệ quả cho CRM:
- **đừng** trả 409 cho thứ cần VIP ID gửi lại;
- **đừng** trả 4xx cho thứ đã xử lý xong, nếu không VIP ID sẽ gửi lại mãi;
- trả lời trong < 3 giây.

#### a) `POST /api/internal/portal/signups` (`khach.py:37,698-707`)
Gửi khi:
1. khách xác minh email xong và trạng thái chuyển `cho_xac_minh_email → cho_duyet` (`khach.py:685-694`);
2. **mỗi lần** có người khác (email khác) đăng ký cùng SĐT với tài khoản này **khi tài khoản đang `cho_duyet`** (`khach.py:633-643`). Nếu tài khoản còn `cho_xac_minh_email`, chỉ tăng bộ đếm; signup gửi lúc xác minh sẽ mang sẵn `n>0`.

| Trường | Kiểu | Ràng buộc phía VIP ID |
|---|---|---|
| `subject` | string | `cust:kh_` + 26 ký tự `[a-z0-9]` (`khach.py:600,608`) |
| `display_name` | string | 2–100 ký tự sau NFC, đã gộp khoảng trắng, không ký tự điều khiển và `<>` (`khach.py:419-425`) |
| `phone_e164` | string | `+84` + 9 số, đầu `3/5/7/8/9` (`khach.py:389-409`) |
| `email` | string | chữ thường, NFKC, ≤ 254 (`khach.py:412-416`) |
| `phone_conflict` | boolean | `phone_conflict_count > 0` |
| `phone_conflict_count` | integer ≥ 0 | tăng dần, không bao giờ giảm |

Thứ tự khoá trên dây: `subject, display_name, phone_e164, email, phone_conflict, phone_conflict_count`. VIP ID **không** gửi `province` hay `warehouse_pref`.

**`Idempotency-Key`** (`khach.py:702`):
- `signup:<subject>` khi `n = 0`;
- `signup:<subject>:xung-dot-<n>` khi `n ≥ 1` (vd `signup:cust:kh_ckh72p530kg289um36ta3nfwd7:xung-dot-1`).

Mỗi khoá được gửi tới khi thành công rồi thôi (`INSERT OR IGNORE`, `khach.py:1005-1007`). Mỗi bản có `n` lớn hơn là **một sự kiện mới** với thân khác.

**CRM phải:**
- UPSERT theo `subject`;
- cờ chỉ bật thêm, số lần chỉ tăng (bản cũ đến muộn không hạ cờ);
- đăng ký đã quyết định hoặc đã thu hồi ⇒ **2xx** kèm trạng thái hiện tại, không đổi dòng;
- **không** tạo khách và **không** tự liên kết hồ sơ khi nhận signup.

Phản hồi gợi ý: 201 mới, 200 cập nhật hoặc trùng. VIP ID không đọc thân.

#### b) `POST /api/internal/portal/thu-hoi` (`khach.py:38,1056-1058`)
| Trường | Kiểu | Giá trị |
|---|---|---|
| `subject` | string | `cust:…` |
| `reason` | string | `"dang_xuat"` (khách bấm đăng xuất, `khach.py:922`) hoặc `"dat_lai_mat_khau"` (khách đặt lại mật khẩu, `khach.py:1235`). Đặt lại mật khẩu được phép cả khi đang `cho_duyet` (`khach.py:1180,1204`) |

`Idempotency-Key` = `thu-hoi:<subject>:<reason>:<8 ký tự ngẫu nhiên>` (`khach.py:1057`). Khoá này **khác nhau mỗi lần**, nên không dùng để khử trùng. CRM khử trùng theo **tác dụng**: huỷ mọi phiên `vg_portal` của subject, lặp lại thì vô hại, subject lạ ⇒ 2xx.

**Ngữ nghĩa bắt buộc:** chỉ **huỷ phiên**. Không khoá user, không đánh dấu đăng ký bị thu hồi. Khoá do nhân viên CRM quyết định (`tam-khoa`, mục 2.2). Hiện CRM làm sai (G7).

### 2.2. CRM gọi VIP ID (`crm->vipid`) — `khach_web.py:583-595`
Base URL nội bộ VIP ID với `Host:` hợp lệ (mục 4). Cả ba endpoint dùng cùng lớp kiểm của mục 1.4 và 1.5.

#### a) `POST /api/internal/khach/ket-qua-duyet` (`khach.py:1062-1121`)
| Trường | Kiểu | Khi `approved` | Khi `rejected` |
|---|---|---|---|
| `subject` | string `cust:…` | bắt buộc | bắt buộc |
| `decision` | `"approved"` \| `"rejected"` | | |
| `crm_customer_id` | string `^[A-Za-z0-9_-]{1,64}$` (UUID của CRM hợp lệ) | bắt buộc | bỏ qua (gửi `null` được) |
| `portal_code` | `^VG[0-9]{4,9}$`, số ≥ 1001 (owner 07/11); VIP ID trim và viết hoa trước khi kiểm (`khach.py:428-430`) | bắt buộc, **unique toàn hệ thống** (`schema.py:257`) | bỏ qua |
| `customer_code` | string ≤ 40, tuỳ chọn (mã cũ của đại lý khi link) | tuỳ chọn | bỏ qua |
| `phone_verified_by` | string 1–120 (id nhân viên đã gọi) | bắt buộc | bỏ qua |
| `reason` | string | — | tuỳ chọn, ghi audit ≤ 200 |

| Tình huống | Phản hồi |
|---|---|
| subject lạ | 404 `KHONG_TIM_THAY` |
| approved, thiếu hoặc sai trường | 400 `DU_LIEU_SAI` (`khach.py:1073-1076`) |
| approved lần đầu, tài khoản `cho_duyet` | 200 `{"subject","status":"hoat_dong"}`. VIP ID đặt `phone_verified_at`, `phone_verified_by`, `crm_customer_id`, `customer_code`, `portal_code` và gửi email kích hoạt vào outbox (`khach.py:1083-1102`) |
| approved lại, **cùng** `crm_customer_id` và `portal_code` (đang `hoat_dong`/`tam_khoa`) | 200 `{…,"idempotent":true}` (`khach.py:1077-1079`) |
| approved lại với `crm_customer_id` hoặc `portal_code` **khác** | 409 `XUNG_DOT` (`khach.py:1080`) |
| `portal_code` **hoặc** `crm_customer_id` đã thuộc subject khác | 409 `XUNG_DOT` (ràng buộc UNIQUE, `khach.py:1091-1093`) |
| tài khoản chưa `cho_duyet` (chưa xác minh email) hoặc đã `tu_choi` | 409 `XUNG_DOT` (`khach.py:1081-1082`) |
| rejected, tài khoản `cho_duyet` | 200 `{"status":"tu_choi"}`. VIP ID **giải phóng SĐT và email** (`phone_e164 = email_norm = 'released:<id>'`), huỷ phiên, audit lưu sha256 của SĐT và email (`khach.py:1108-1120`) |
| rejected lại | 200 `{…,"idempotent":true}` |
| rejected khi đã `hoat_dong` hoặc `tam_khoa` | 409 `XUNG_DOT` (`khach.py:1106-1107`) |

Kit đã kiểm tất cả các dòng trên với VIP ID thật (V15, V20–V26, V31–V33).

#### b) `POST /api/internal/khach/tam-khoa` (`khach.py:1124-1154`)
`{subject, action: "khoa"|"mo_khoa", reason?}`.
- `khoa` ⇒ trạng thái `tam_khoa`, `token_version+1` (cookie thiết bị tin cậy và phiên cũ mất hiệu lực), huỷ mọi phiên. Trả 200 `{"status":"tam_khoa"}`.
- `mo_khoa` ⇒ trả về `hoat_dong` nếu đã xác minh SĐT và có `crm_customer_id`, ngược lại `cho_duyet` hoặc `cho_xac_minh_email`. Trả 200 `{"status":…}`. Mở khoá khi không khoá thì không làm gì, vẫn 200.
- action lạ ⇒ 400. Tài khoản đã `tu_choi` ⇒ 409 `XUNG_DOT`. Lặp lại thì idempotent.

#### c) `POST /api/internal/khach/thu-hoi` (`khach.py:1157-1165`)
`{subject, reason}` ⇒ huỷ mọi phiên VIP ID của subject. Trả 200 `{"subject","phien_thu_hoi":<số phiên>}`.
- **Không** khoá tài khoản và không tăng `token_version`: khách đăng nhập lại được bằng mật khẩu.
- Muốn chặn hẳn thì dùng `tam-khoa`.

**Khử trùng phía CRM:** VIP ID không dùng `Idempotency-Key`. CRM giữ `dedupe_key` trong `portal_outbox` (vd `<subject>:ket_qua_duyet`, `<subject>:tam_khoa:<n>`) và **ký lại `ts` mỗi lần**.

---

## 3. Xung đột SĐT

### 3.1. VIP ID gửi gì
- Người thứ hai đăng ký cùng SĐT với **email khác**, trong khi tài khoản đầu đang `cho_xac_minh_email` hoặc `cho_duyet`:
  - VIP ID **không tạo** tài khoản thứ hai;
  - phản hồi cho người đăng ký vẫn giống hệt bình thường (không lộ tài khoản);
  - `phone_conflict_count` của tài khoản **đầu** tăng 1, có audit `khach.dang_ky.xung_dot_sdt` (`khach.py:633-641`).
- Nếu tài khoản đầu đang `cho_duyet` ⇒ gửi lại signup **cùng subject** với `phone_conflict=true` và `phone_conflict_count=n`, khoá `signup:<subject>:xung-dot-<n>` (`khach.py:642-643,698-707`).
- Tài khoản đầu đã `hoat_dong`: không có cờ. VIP ID chỉ gửi email "có người dùng thông tin của bạn" (`khach.py:651-656`).
- VIP ID **không biết** hồ sơ khách sẵn có trong CRM (khách đại lý). Trùng loại đó là việc của CRM (`findDuplicates`, `review.js:53-68`).

### 3.2. CRM phải làm
1. **Upsert theo `subject`.** Cập nhật **cùng dòng**, không tạo dòng mới. Lưu và hiển thị `phone_conflict` và `phone_conflict_count`, xếp các đăng ký có cờ lên đầu.
2. **Không bao giờ tự liên kết** hồ sơ có sẵn. Trùng SĐT với khách sẵn có (kể cả của đại lý) ⇒ chặn approve, chỉ cho nhân viên chọn "liên kết" (có audit) hoặc "từ chối".
3. **Từ chối** ⇒ gửi `ket-qua-duyet` `rejected`. VIP ID giải phóng SĐT và email của subject đó.
4. **Đăng ký lại sau khi bị từ chối** ⇒ VIP ID tạo tài khoản **mới** với **subject mới** (`kh_…` mới), rồi gửi signup mới.
   - CRM phải nhận như một đăng ký mới (dòng mới). **Không** được chặn vì trùng SĐT với dòng `tu_choi` cũ (`portal_signups.phone_e164` không unique là đúng: `700_portal.sql:77`).
   - Subject cũ ở trạng thái `tu_choi` vĩnh viễn: mọi `ket-qua-duyet approved` sau đó cho subject cũ sẽ bị 409.
   - VIP ID test: `tests/test_khach_p1.py:1000-1038`.

### 3.3. Checklist nhân viên (theo `docs/KHACH-DUYET-CHECKLIST.md`)
- [ ] Trước khi gọi: xem **cờ `phone_conflict` và số lần**. Nếu > 0 thì đã có người khác thử đăng ký cùng SĐT, nghi giữ chỗ.
- [ ] Xem **trùng hồ sơ CRM** (khách VIP hoặc đại lý có cùng SĐT). Nếu có, chỉ được "liên kết" hoặc "từ chối", không "duyệt mới".
- [ ] Chỉ gọi **đúng số** trong đăng ký. Không gửi mã hay link qua kênh khác.
- [ ] Hỏi người nghe máy, **không đọc trước** thông tin: (1) họ tên, (2) **email** đã dùng để đăng ký, (3) có chủ động đăng ký cổng VIP GROUP không.
- [ ] Chỉ tích "đã gọi xác minh SĐT" và duyệt hoặc liên kết khi **cả tên lẫn email khớp**. Liên kết hồ sơ đại lý: xác nhận thêm với đại lý đó.
- [ ] Không khớp hoặc chủ số nói không đăng ký ⇒ **từ chối** kèm lý do, rồi khuyên chủ số tự đăng ký lại bằng email của chính họ (sẽ sinh subject mới).
- [ ] Không gọi được sau nhiều lần ⇒ để chờ, không duyệt.
- [ ] Mọi quyết định có audit ở cả CRM và VIP ID (`tenant_id='khach'`).

---

## 4. Host, callback và cấu hình

### 4.1. Cách VIP ID chọn realm
- `KhachHostDispatch` đọc `Host` (`khach_web.py:31-49`) và chuẩn hoá: chữ thường, bỏ dấu chấm cuối tên, bỏ số 0 đầu ở cổng (`khach.py:156-173`).
- Mục **có cổng** khớp đúng `host:cổng`. Mục **không cổng** khớp tên với mọi cổng (`khach.py:192-194`).
- Thuộc `COWORK_KHACH_HOSTS` ⇒ realm khách (`/tai-khoan/*`, `/api/internal/khach/*`). Thuộc `COWORK_STAFF_HOSTS` ⇒ app nhân viên. Còn lại hoặc thiếu Host ⇒ **421** (`khach.py:197-206`).

### 4.2. Luồng dev (proxy chung cổng 8890)
```
Trình duyệt ──► http://khach.localhost:8890  (proxy giữ nguyên Host, ghi X-Real-IP)
                  ├─ /tai-khoan/*  ─► VIP ID  127.0.0.1:8898
                  └─ /*            ─► CRM     127.0.0.1:5175
VIP ID ──► CRM   : http://127.0.0.1:5175/api/internal/portal/*   (Host 127.0.0.1:5175 — KHÔNG phải host cổng)
CRM    ──► VIP ID: http://127.0.0.1:8898/api/internal/khach/*    (Host: khach.localhost:8890)
VIP ID ──303──► trình duyệt ──► http://khach.localhost:8890/portal/auth/launch?token=<JWT> ──► CRM
```

**VIP ID (dev)**, chạy từ worktree VIP ID:
```sh
COWORK_KHACH_HOSTS="khach.localhost:8890,khach.localhost:8898" \
COWORK_KHACH_PUBLIC_URL=http://khach.localhost:8890 \
CRM_PORTAL_PUBLIC_URL=http://khach.localhost:8890 \
CRM_PORTAL_INTERNAL_URL=http://127.0.0.1:5175 \
COWORK_TIN_PROXY=1 \
./scripts/khach-dev.sh
```
- `CRM_PORTAL_INTERNAL_URL` **phải** đặt. Mặc định là `http://127.0.0.1:8897` (`config.py:133-134`, `khach-dev.sh:33`), tức CRM giả `--mock-crm`.
- Bí mật dev: `data/khach-dev/portal_secret.key` (`khach-dev.sh:35`).
- Script chạy `uvicorn --no-proxy-headers` trên 127.0.0.1:8898 (`khach-dev.sh:45`). Với `COWORK_TIN_PROXY=1`, IP thật lấy từ `X-Real-IP` hoặc `X-Forwarded-For` do proxy ghi (`web.py:25-40`).
- `COWORK_STAFF_HOSTS` mặc định `127.0.0.1:8899` (`khach-dev.sh:31`).

**CRM (dev)**, gợi ý:
```sh
PORTAL_ENABLED=1
VIPID_PORTAL_SECRET_FILE=<…>/vip-group-id-khach/data/khach-dev/portal_secret.key
PORTAL_HOST=khach.localhost:8890          # host cổng khách (hostguard) = Host gửi sang VIP ID
VIPID_PORTAL_URL=http://127.0.0.1:8898    # gọi THẲNG VIP ID, không qua proxy 8890 (proxy đẩy /api/* sang CRM)
```
- CRM dùng **cùng** `PORTAL_HOST` cho hai việc: tách host của mình (`server/lib/hostguard.js:44-56`) và header `Host` khi gọi VIP ID (`vipid-client.js` HEAD:109, `outbox.js` HEAD:96).
- Điều này đúng **chỉ khi** host cổng cũng nằm trong `COWORK_KHACH_HOSTS` của VIP ID. Dev: `khach.localhost:8890`. Production: `khachhang.vipgroup.com.vn`.
- Endpoint nội bộ CRM `/api/internal/portal/*` chỉ mở ở host **không phải** `PORTAL_HOST` (`hostguard.js:8-9`). Vì vậy `CRM_PORTAL_INTERNAL_URL` của VIP ID phải trỏ cổng trực tiếp của CRM.

**Staging/production** (chưa được phép bật): Caddy phải **giữ nguyên Host gốc** (KIEN_TRUC §11.9). VIP ID production bắt buộc `COWORK_TIN_PROXY=1`, `COWORK_COOKIE_SECURE=1`, các URL https, Turnstile thật và kênh email thật (`khach.py:103-121,144-148`). Câu hỏi mở H1 ở mục 7.

### 4.3. Launch token (VIP ID ký, CRM kiểm) — `khach.py:925-949`
- **Phát khi:** đăng nhập thành công (`khach_web.py:405-417`) và `GET /tai-khoan/vao-cong` khi còn phiên (`khach_web.py:431-440`). Chỉ khi `status='hoat_dong'`, đã xác minh SĐT và có `crm_customer_id` (`khach.py:931-932`).
- **URL:** `303 Location: ${CRM_PORTAL_PUBLIC_URL}/portal/auth/launch?token=<JWT>` (`khach.py:948-949`, `khach_web.py:250-252`). Dev: `http://khach.localhost:8890/portal/auth/launch?token=…`.
- **Định dạng:** JWT compact HS256 = `b64url(header).b64url(payload).b64url(HMAC_SHA256(secret, "<h>.<p>"))`, base64url **không padding**.
  - header **đúng** `{"alg":"HS256","typ":"JWT"}`;
  - payload là JSON gọn, thứ tự khoá cố định:
  ```json
  {"ver":1,"aud":"vip-crm-portal","sub":"cust:kh_…","crm_customer_id":"<id CRM đã gửi>","portal_code":"VG1001","iat":1794043532,"exp":1794043592,"nonce":"<24 ký tự base64url>"}
  ```
  - `exp = iat + max(1, COWORK_KHACH_LAUNCH_TTL)`, TTL ≤ 60 (`config.py:146`);
  - `nonce = secrets.token_urlsafe(18)`, 24 ký tự (`security.py:63-64`);
  - `crm_customer_id` và `portal_code` là đúng giá trị CRM đã gửi trong `ket-qua-duyet`.
- **CRM phải kiểm:**
  - chữ ký (timing-safe), `alg=HS256`, `ver=1`, `aud`, `exp−iat ≤ 60`, `exp > now`, `iat` không quá tương lai (CRM cho lệch 30 giây);
  - **tiêu nonce một lần trước** khi kiểm danh tính;
  - `sub` → user `kind='customer'` đang active → khách active khớp **cả** `crm_customer_id` lẫn `portal_code`.
  - CRM HEAD làm đủ (`launch.js:52-74,118-171`). Kit L01–L11 kiểm các điểm này.
- Token nằm trong query string ⇒ CRM không ghi query của `/portal/auth/launch` vào log truy cập.

---

## 5. Bảng chênh lệch CRM (phát hiện cho đội CRM, không sửa hộ)

Mức: **Chặn** = luồng P1 không chạy được hoặc sai an toàn; **Cao**; **TB**; **Thấp**. "WIP" = cây làm việc chưa commit lúc đọc; cần commit, migrate 703 và chạy kit để xác nhận.

| # | Mức | Vấn đề | CRM HEAD `a791c67` | Yêu cầu (VIP ID 5e1effe) | WIP |
|---|---|---|---|---|---|
| **G1** | Chặn | Kiểm chữ ký VIP ID → CRM theo chuỗi **cũ** | `internal.js:29-31` (`vipid->crm.${ts}.${rawBody}`), `:69-78`. Chuỗi mới chỉ kiểm khi có `X-Portal-Sig-V2` (`:46-50`, `:142-144`) mà VIP ID không bao giờ gửi (`khach.py:1022-1023`) ⇒ **mọi signup thật bị 401**, VIP ID thử lại mãi | `X-Portal-Sig` = chuỗi mới (mục 1.2) | **Đã sửa** (`internal.js:36-57`). Kiểm bằng chữ ký VIP ID thật: `{"ok":true}` |
| **G2** | Chặn | Ký CRM → VIP ID theo chuỗi **cũ** trong `X-Portal-Sig` | `vipid-client.js:43-46,106`. V2 ở `:107` bị VIP ID bỏ qua ⇒ **mọi `ket-qua-duyet`/`tam-khoa`/`thu-hoi` bị 401**. Đã kiểm: VIP ID thật trả `HTTP_401`, receiver chẩn đoán `sai:chuoi_ky_cu_v1.1` | như trên | **Đã sửa** (`vipid-client.js:43-63`). VIP ID thật trả 404 `KHONG_TIM_THAY` cho subject giả, tức chữ ký đã qua |
| **G3** | Cao | Không chống phát lại chiều vào | Không có bảng chữ ký đã dùng. Chú thích `internal.js:10` cho rằng gửi lại y hệt "vô hại" ⇒ trả 200 | 409 `PHAT_LAI`, giữ ≥ 900 giây | **Đã sửa**: `703_portal_hmac_seen.sql`, `consumeSignature` (`internal.js:67-72`) |
| **G4** | TB | Giới hạn thân | 16 KB (`internal.js:22`), parse JSON trước khi kiểm chữ ký (`:129-133`), không bắt buộc Content-Length | ≤ 10 KB, kiểm Content-Length trước khi đọc | **Phần lớn đã sửa**: 10240, hook `onRequest` bắt buộc Content-Length và từ chối chunked (`internal.js:26,138-142`). **Còn lệch** 10 001–10 240 byte so với ngưỡng 10 000 của VIP ID (`khach_web.py:535`). Mức Thấp, vì VIP ID không gửi > 10 000; kit ghi ở C11b |
| **G5** | Cao | Upsert xung đột SĐT | `validateSignup` bỏ qua `phone_conflict*` (`internal.js:88-105`). `signupHash` không gồm hai trường đó (`:108-111`) ⇒ bản `xung-dot-n` bị coi là **trùng** (200 `duplicate`), cờ mất. Bảng không có cột (`700_portal.sql:44-75`). `signupView` không trả cờ (`review.js:70-76`). Bỏ qua `Idempotency-Key` | lưu và hiển thị cờ trên cùng dòng; cờ chỉ bật thêm, số lần chỉ tăng | **Đã sửa**: cột ở 703 (`:16-18`), `internal.js:96-113`, upsert `GREATEST`, `review.js:73,212` (xếp đầu). Cần chạy C13b/C14b với token quản trị |
| **G6** | TB | 409 cho subject đã quyết định | `internal.js:180-183` trả 409 `SUBJECT_CONFLICT`. VIP ID coi 409 là xong nên tạm ổn, nhưng sai ngữ nghĩa | 2xx kèm trạng thái, không đổi dòng | **Đã sửa** (200 `unchanged`) |
| **G7** | **Chặn — còn mở** | `thu-hoi` **khoá vĩnh viễn** | HEAD `internal.js:210-223`, WIP `internal.js:251-263`: `UPDATE users SET active=false` và `portal_signups.revoked_at`. Trigger `700_portal.sql:103-105` cấm duyệt đăng ký đã thu hồi. VIP ID gửi `thu-hoi` khi **đăng xuất** (`khach.py:922`) và **đặt lại mật khẩu** (`khach.py:1235`, cho phép cả khi `cho_duyet`: `:1180,1204`) ⇒ (1) đăng xuất một lần thì mọi launch sau đó `USER_INACTIVE`; (2) khách chờ duyệt đặt lại mật khẩu thì không bao giờ được duyệt | chỉ huỷ phiên `vg_portal` của subject; idempotent; subject lạ ⇒ 2xx | **Chưa sửa.** Kit L12 (`KIT_DESTRUCTIVE=1`) phát hiện được |
| **G8** | TB | Đọc mã lỗi VIP ID | `vipid-client.js:81,119` đọc `error.code`, còn VIP ID dùng `loi.ma`. `PHAT_LAI` vẫn nhận ra nhờ regex (`:84`) nhưng `last_error` thiếu mã | `loi.ma` | **Đã sửa** (`errorCode`) |
| **G9** | TB | Outbox thử lại cả lỗi không thể thử lại | `outbox.js:71-78`: mọi lỗi thử lại 12 lần (4xx như 400 `DU_LIEU_SAI`, 409 `XUNG_DOT`, 421) | 4xx (trừ `PHAT_LAI`) ⇒ failed, cho nhân viên xem; 421 ⇒ cảnh báo cấu hình; 5xx/mạng ⇒ backoff | **Đã sửa** (failed ngay; 421 thành `HOST_MISDIRECTED` và thử lại sau ≥ 1 giờ) |
| **G10** | TB | `PORTAL_SIG_V2_REQUIRED` / `event` | `config.js:96` (HEAD), `internal.js:149-154`: cơ chế v1.2 riêng của CRM, VIP ID không dùng | bỏ V2; `event` là tuỳ chọn, VIP ID không gửi | **Đã bỏ V2**; `event` giữ ở dạng tuỳ chọn (vô hại) |
| **G11** | Thấp | Chuẩn hoá bí mật khác nhau | `server/config.js:27-29`: env dùng nguyên văn, tệp chỉ bỏ CR/LF cuối | VIP ID `.strip()` hai đầu (`config.py:78,83`) | chưa đổi. Chỉ lệch khi tệp hoặc env có khoảng trắng hay tab ở đầu/cuối. Nên `trim()` |
| **G12** | Thấp | Không có nơi phát `thu_hoi` CRM → VIP ID | `OUTBOX_EVENTS` có `thu_hoi` (`outbox.js:7`) nhưng không chỗ nào `enqueue(…'thu_hoi')`. Khoá khách dùng `tam_khoa` (`review.js:176-197`), như vậy là đủ | tuỳ chọn | — |
| **G13** | TB (mở) | Production: `VIPID_PORTAL_URL` phải https | `server/config.js:63-64`. VIP ID chỉ phục vụ `/api/internal/khach/*` trên **host khách**, mà trên host công khai Caddy đẩy `/*` (gồm `/api/*`) sang CRM (KIEN_TRUC §2) | cần chốt đường nội bộ (H1) | — |
| — | OK | C0: đường đăng nhập nhân viên từ chối `kind='customer'` | `adapters.js:41-43` | §11.5 | đã có |
| — | OK | Launch: ver/aud/TTL/nonce một lần/khớp `crm_customer_id` và `portal_code` | `launch.js:52-74,127-154` | §4.3 | đã có. Chú ý `crm_customer_id` bắt buộc là UUID (`launch.js:68`); VIP ID nhận rộng hơn (`khach.py:1073`), vẫn khớp vì CRM cấp UUID |

---

## 6. Bộ kit và kết quả chạy

### 6.1. Cách dùng (`kit/contract-test.mjs`, Node ≥ 20, không cần gói ngoài)
```sh
# 1) Kiểm phía nhận của CRM (VIP ID → CRM + launch)
KIT_SECRET_FILE=…/data/khach-dev/portal_secret.key \
KIT_CRM_URL=http://127.0.0.1:5175 \
KIT_CRM_PORTAL_HOST=khach.localhost:8890 \        # khi CRM đặt PORTAL_HOST (không đặt ⇒ launch 404)
KIT_CRM_ADMIN_TOKEN_FILE=…/vip_admin.token \      # tuỳ chọn: Bearer vip_admin để đọc GET /api/portal/signups (C13b/C14b)
KIT_LAUNCH_SUB=cust:kh_… KIT_LAUNCH_CRM_ID=<uuid> KIT_LAUNCH_PORTAL_CODE=VG1001 \  # tuỳ chọn: khách đã duyệt (L08–L11)
node kit/contract-test.mjs crm
#    KIT_DESTRUCTIVE=1 thêm L12 (gửi thu-hoi "dang_xuat" cho KIT_LAUNCH_SUB) — CRM hiện sẽ KHOÁ user đó.

# 2) VIP ID giả để CRM thử outbox (ký chiều ra): trỏ VIPID_PORTAL_URL=http://127.0.0.1:8895
KIT_SECRET_FILE=… KIT_LISTEN=127.0.0.1:8895 node kit/contract-test.mjs receiver
#    Log mỗi request một dòng JSON (kq, ly_do: "sai:chuoi_ky_cu_v1.1" nếu CRM còn ký kiểu cũ). Subject "cust:khong-co…" ⇒ 404.

# 3) Kiểm một bên VIP ID (VIP ID dev thật hoặc receiver) — CRM dùng để tự tin trước khi bật outbox
KIT_SECRET_FILE=… KIT_VIPID_URL=http://127.0.0.1:8898 KIT_VIPID_HOST=khach.localhost:8890 \
[KIT_VIPID_PENDING_SUBJECT=… KIT_VIPID_PENDING_SUBJECT2=… KIT_VIPID_REJECT_SUBJECT=…] node kit/contract-test.mjs vipid

# 4) In một launch token (thử tay trên trình duyệt)
KIT_SECRET_FILE=… KIT_LAUNCH_SUB=… KIT_LAUNCH_CRM_ID=… KIT_LAUNCH_PORTAL_CODE=… node kit/contract-test.mjs mint
```
- In bảng `PASS/FAIL/MANUAL/SKIP/INFO`. **Mã thoát:** 0 = không có FAIL, 1 = có FAIL, 2 = cấu hình sai.
- Không bao giờ in bí mật. Đã kiểm: bí mật không xuất hiện trong mọi đầu ra và log.
- Chế độ `crm` ghi **một đăng ký `cho_duyet` giả mới** mỗi lần chạy (SĐT `KIT_PHONE`, mặc định `+84900000009`), vì `portal_signups` không xoá được. Chỉ chạy trên DB dev.

### 6.2. Kiểm chính bộ kit với VIP ID thật (đã chạy 07/11/2026)
Môi trường: VIP ID `5e1effe` chạy uvicorn trên **127.0.0.1:8896**, DB và bí mật riêng trong thư mục tạm. `COWORK_KHACH_HOSTS="khach.localhost:8890,khach.localhost:8896"`, `CRM_PORTAL_INTERNAL_URL` trỏ `crm-ref` của kit (8894). Không đụng 8890, 8897, 8898 và DB dev chung. Mọi máy chủ đã dừng sau khi chạy.

| Kiểm | Kết quả |
|---|---|
| VIP ID thật ký 4 lời gọi signup (gồm `signup:<subject>:xung-dot-1`) gửi tới bên nhận của kit | 4/4 được nhận (3 × 201 mới, 1 × 200 cập nhật cùng dòng). VIP ID đánh dấu `done`, `last_error=null` |
| `vipid` (kit đóng vai CRM) → **VIP ID thật** | **30/30 PASS** sau khi sửa kit: 421, 401 (thiếu, sai path, sai method, cũ, chuỗi ký cũ, sai chiều, `+ts`), 409 `PHAT_LAI`, 413 (> 10 000 và chunked), 400 `JSON_SAI`, 404, duyệt / idempotent / 409 `XUNG_DOT` (khác crm_id, trùng portal_code, trùng crm_id), khoá / mở khoá, thu hồi, từ chối / idempotent / 409 |
| Lần chạy đầu | 29 PASS / 1 FAIL (V23). Kit gửi lại cùng thân trong cùng giây ⇒ VIP ID trả `PHAT_LAI` đúng thiết kế. Đã sửa kit (ts khác mỗi lần), ghi vào mục 1.4 |
| `vipid` → **receiver** của kit | 30/30 PASS, **giống hệt từng dòng** (status và mã lỗi) với VIP ID thật |
| Launch token: kit `mint` (cùng iat/nonce) so với `khach.phat_launch_token` | **trùng từng byte** |
| Token do VIP ID phát → `crm-ref` | lần 1: 303 `/portal/`; lần 2: 401 (nonce đã dùng) |
| `crm-ref` gửi `ket-qua-duyet` (chữ ký kit) → VIP ID thật | 200 `hoat_dong` |
| `crm` → `crm-ref` (tham chiếu đúng hợp đồng) | **30 PASS · 0 FAIL · 1 INFO** (C12: chunked) |
| Mã CRM (import chỉ đọc) | HEAD `createVipidClient` → VIP ID thật: **401**. WIP → VIP ID thật: 404 `KHONG_TIM_THAY` (chữ ký đúng). WIP `checkSignature` với chữ ký signup VIP ID thật: `ok:true` |

**Chưa chạy `crm` với CRM dev thật** (5175 đang do phiên khác dùng; kit ghi dữ liệu không xoá được). Đội CRM chạy bước 1 ở mục 6.1. Dự đoán theo mã đã đọc:
- HEAD sẽ FAIL ở C01, C02, C07, C11, C13b, C14b; L12 (nếu bật) FAIL;
- WIP sau migrate 703 chỉ còn FAIL ở L12 (G7), C11b là INFO.

---

## 7. Câu hỏi mở

| # | Câu hỏi | Đề xuất |
|---|---|---|
| H1 | Production: CRM gọi `/api/internal/khach/*` của VIP ID qua đường nào? VIP ID chỉ phục vụ đường này trên host khách. Caddy của `khachhang.*` đẩy `/api/*` sang CRM, và CRM bắt buộc `VIPID_PORTAL_URL` https | (a) Caddy thêm `handle /api/internal/khach/*` → VIP ID, chỉ cho IP nội bộ; hoặc (b) cho phép `http://127.0.0.1:<cổng VIP ID>` khi chạy cùng máy (nới `config.js:63-64` cho loopback). Owner/root chốt |
| H2 | G7: CRM có cần "thu hồi vĩnh viễn" từ VIP ID không? | Không ở P1. Khoá là quyết định của nhân viên CRM (`tam-khoa` CRM → VIP ID) |
| H3 | Ngưỡng thân 10 000 hay 10 240 byte | Thống nhất 10 000 như VIP ID (một chỗ sửa ở `internal.js:26`) |
| H4 | VIP ID chỉ thử lại signup qua cron `khach-dong-bo` | Khi lên staging: đặt cron mỗi phút (phía VIP ID) |
