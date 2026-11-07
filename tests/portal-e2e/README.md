# E2E Cổng khách hàng P1 (VIP ID realm khách ⇄ CRM)

Bộ kiểm thử đầu-cuối (Playwright + HTTP thô) cho luồng khách theo quyết định owner 07/11: đăng ký (email tuỳ chọn, không xác minh email) → chờ duyệt → nhân viên duyệt/cấp mã VG1001… → đăng nhập (SĐT và mã VG) → launch sang CRM portal → xem kiện → tra cứu → hồ sơ / đổi mật khẩu → đăng xuất (cổng → trang xác nhận VIP ID) → khôi phục do nhân viên cấp link (`tao-link-dat-lai`), kèm các kiểm bảo mật bắt buộc. **Chỉ dữ liệu tổng hợp** (SĐT `+849000xxxxx`, email `@example.test`). Không nằm trong `npm test`.

Repo VIP ID (`~/code/vip-group-id-khach`) và CRM (`~/Projects/vip-group-khoqctq`) chỉ được **đọc/chạy**, không bị sửa: dữ liệu VIP ID nằm trong thư mục tạm riêng, CRM chạy với `STORAGE_DIR`/`BACKUP_DIR` tạm và DB `vipcrm5_e2e_portal` (tạo rồi `dropdb` khi xong).

## Chạy

```sh
# CRM giả của VIP ID (scripts/khach_mock_crm.py) + duyệt bằng `cowork.cli khach-duyet-dev`
node tests/portal-e2e/run.mjs [thư-mục-ảnh]            # mặc định /tmp/portal-e2e-shots

# CRM thật: createdb vipcrm5_e2e_portal → migrate → seed-if-empty → server/index.js :5195
MODE=real node tests/portal-e2e/run.mjs [thư-mục-ảnh]
```

Bộ test tự bật và tự tắt cả stack (`START=1`, mặc định): VIP ID `:8898`, CRM giả `:8897` hoặc CRM thật `:5195`, proxy `:8890`. Proxy giống Caddy production. Với `TOPO=multi`, `dangky.*` và `dangnhap.*` → VIP ID; `khachhang.*` → CRM cho `/portal*`, `/` → 302 `/portal/`. Với `TOPO=single`, `khach.localhost`: `/tai-khoan*` → VIP ID, `/portal*` → CRM. Ở cả hai: mọi đường khác → 404, `/api/internal/*` → 404, Host lạ → 421. Proxy ghi đè `X-Real-IP` và không thêm `X-Forwarded-For` / `Forwarded` / `Via`. Không dùng các cổng 4321/4322/4351/8899. Cổng `127.0.0.1:8899` chỉ xuất hiện dưới dạng giá trị header Host của realm nhân viên VIP ID, bộ test không nghe trên cổng đó.

Kết quả: bảng `PASS / FAIL / PENDING / XFAIL` trên stdout, `results.json` và ảnh 390px trong thư mục ảnh. Mã thoát khác 0 khi có ít nhất một `FAIL`.

- **PENDING**: kiểm chưa chạy được ở chế độ hiện tại (ví dụ cần CRM thật). Lý do được ghi rõ.
- **XFAIL**: lỗi tích hợp đã biết, ghi kèm nguyên nhân và hướng sửa. Không tính là FAIL. Khi lỗi được sửa, kiểm tự chuyển sang PASS.
- **BLOCKED** (real): CRM cấp mã không theo quy tắc `CODE_RULE` nên VIP ID từ chối kết quả duyệt; các kiểm phụ thuộc ghi "blocked by CRM VG1001". Tính như lỗi khi tính mã thoát.

Mỗi lượt in SHA đang chạy của VIP ID và CRM (`+dirty` nếu working tree có sửa đổi), và lưu vào `results.json`.

| Env | Mặc định | Ý nghĩa |
|---|---|---|
| `MODE` | `mock` | `mock` \| `real` |
| `START` | `1` | `0`: dùng stack đang chạy sẵn; các kiểm cần bật/tắt server sẽ chuyển PENDING |
| `BASE` | `http://khach.localhost:8890` | gốc host khách công khai |
| `VIPID_REPO`, `PY` | `~/code/vip-group-id-khach`, `~/code/vip-group-id/.venv/bin/python` | |
| `CRM_REPO`, `CRM_DB`, `CRM_PORT` | `~/Projects/vip-group-khoqctq`, `vipcrm5_e2e_portal`, `5195` | DB bắt buộc có tiền tố `vipcrm5_` |
| `CRM_STAFF_URL` | `http://127.0.0.1:$CRM_PORT` | API nhân viên CRM (`/api/auth/login`, `/api/portal/signups/*`) |
| `CRM_ADMIN_USER` / `CRM_ADMIN_PASSWORD` / `CRM_ADMIN_TOKEN` | `vip.admin` / mật khẩu dev đọc từ `server/lib/seed.js` | không in ra |
| `PLAYWRIGHT`, `CHROMIUM` | bản cài ở `veh4-g12-playwright` và `chrome-headless-shell-1243` | |
| `STRICT_BROWSER=1` | tắt | tắt vá tạm Origin (xem FLOW-00) |
| `KEEP=1` | tắt | giữ thư mục tạm và DB CRM để điều tra |
| `VERBOSE=1` | tắt | in từng điều kiện đã đạt |
| `TOPO` | `multi` (mock) / `single` (real) | §15: `multi` = `dangky.localhost` (đăng ký) · `dangnhap.localhost` (đăng nhập, tài khoản, API nội bộ) · `khachhang.localhost` (CRM `/portal`); `single` = một host `khach.localhost` (CRM chưa có §15) |
| `CODE_RULE` | `v2` | `v2`: VG1001, VG1002… (`^VG[1-9]\d{3,8}$`); `v1`: VG000001 |
| `CRM_SKIP_VERIFY_PHONE=1` | tắt | bỏ gọi `verify-phone` trước approve/link (khi CRM bỏ bước này) |
| `CRM_RESET_LINK_ROUTE` | chưa đặt | route nhân viên CRM cấp link đặt lại, vd `/api/portal/customers/:id/reset-link` (`:id` = customers.id, body `{reason}`); chưa đặt thì gọi thẳng VIP ID `tao-link-dat-lai` bằng HMAC và FLOW-11b là PENDING |

## Real mode dùng gì từ CRM

- Duyệt: `POST /api/auth/login` (vip_admin, Bearer), rồi `GET /api/portal/signups?status=all`, `POST /api/portal/signups/:id/verify-phone {phone_e164}` (bỏ được bằng `CRM_SKIP_VERIFY_PHONE=1`), `.../approve {phone_verified:true, phone_e164}`, `.../link {customer_id, phone_e164}`, `.../reject {reason}`. Kết quả về VIP ID qua `portal_outbox` (worker 15 giây). Bộ test chờ VIP ID nhận, tối đa 45 giây.
- Seed: `scripts/portal-dev-seed.js parcels <VG> <n>` (n kiện đã xác minh chủ + `E2E-<VG>-PENDING` chưa rõ chủ) và `agent-customer +84900000003` (khách đại lý A1 `K3-A1`, tạo trước khi K3 đăng ký).
- Đọc trạng thái (chỉ đọc): `psql` với `default_transaction_read_only=on` để kiểm `users.active` / `customers.active` (G7) và kiểm `portal_code` không trùng.
- Bật/tắt CRM thật cho kiểm "CRM sập" (SEC-08a), bật/tắt VIP ID cho SEC-08b: bộ test tự làm khi `START=1`.

## Tệp

`run.mjs` (các kiểm), `stack.mjs` (bật/tắt stack, CLI VIP ID, script CRM), `vipid.mjs` (client khách, outbox, HMAC), `crm.mjs` (adapter CRM giả/thật), `browser.mjs` (Playwright, theo dõi console/CSP/tràn ngang), `http.mjs`, `proxy.mjs`.
