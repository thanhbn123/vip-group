# BÀN GIAO PHIÊN — trạng thái ngày 09/11/2026 (đọc file này trước khi trả lời owner)

Phiên tiếp theo (DeepSeek trong Orca) **được code**, theo đúng các quy tắc ở §7. Owner muốn tiếp tục công việc liền mạch.

## 1. Đang chạy production

| Hệ thống | Địa chỉ | Phiên bản |
|---|---|---|
| Website | https://www.vipgroup.com.vn | repo này, `main` @`5a7274e`. Header có nút Đăng nhập / Đăng ký |
| Đăng ký khách (VIP ID) | https://dangky.vipgroup.com.vn | `vip-group-id` `main` @`8ea72bd`. Realm khách bật, đăng ký mở (pilot = 0), Turnstile thật |
| Đăng nhập khách (VIP ID) | https://dangnhap.vipgroup.com.vn | như trên |
| Cổng khách (CRM) | https://khachhang.vipgroup.com.vn | CRM `vip-group-khoqctq`, production theo phiên CRM: V6.1 `fb8ca2a` |
| CRM nội bộ | https://crm.vipgroup.com.vn | duyệt khách: menu "Đăng ký khách (cổng)" |
| COWORK nhân viên | https://cowork.vipgroup.com.vn | module CRM đã có trong code; P-13/P-14 (cấp quyền `crm.view`/`crm.use`, liên kết nhân viên) **chưa làm** |

Luồng hiện tại trên production: khách đăng ký → **nhân viên duyệt** → mã VG (bắt đầu VG1001) → đăng nhập → cổng khách.

## 2. Đang chờ owner duyệt (tính năng TỰ KÍCH HOẠT, bỏ nhân viên duyệt)

- **Đề án và hợp đồng:** `docs/cong-khach-hang/DE_XUAT_TU_DONG_DUYET.md`. Owner đã chốt Q1–Q4.
- **Code đã xong và kiểm xong:**
  - VIP ID: PR #4 (`feature/khach-tu-dong` @`2635b03`), cờ `COWORK_KHACH_TU_DONG` mặc định tắt. Verifier độc lập vòng 13: GO.
  - CRM: RC `14e6da7`, đã chạy staging, cờ `PORTAL_AUTO_APPROVE`.
  - E2E thật: 10/10, 1 pending. Khi tắt cờ: 57/0.
- **Owner cần gửi:**
  1. `I_APPROVE_UPDATE_14e6da7` → **trực tiếp** cho phiên CRM (vip-group-khoqctq).
  2. `DUYỆT TỰ KÍCH HOẠT` → cho phiên Website/VIP ID (Claude).
- **Thứ tự phát hành:**
  1. CRM với cờ = 0.
  2. Backup VIP ID → merge PR #4 → deploy VIP ID với cờ = 0.
  3. Bật cờ CRM rồi cờ VIP ID. Sau mỗi lần tạo lại container VIP ID: `docker network connect vipcrm6-prod_edge cowork-staging`.
  4. `node scripts/portal-auto-approve-pending.js --as <vip_admin>`: chạy thử (dry-run) trước, rồi `--apply`.
  5. Smoke.

## 3. Việc owner còn tồn

- **Bước D thu lead website:** nhập 5 secret vào Cloudflare Pages → `docs/HUONG_DAN_CAI_DAT_THU_LEAD.md`.
- **P-13/P-14 COWORK → CRM:** cấp quyền trong COWORK, liên kết `vip_subject` nhân viên → `vip-group-id` `docs/COWORK-CRM-PILOT.md`.
- **Nội dung website:** địa chỉ Bắc Ninh thật, thời gian vận chuyển, ảnh kho, GA4.

## 4. Tắt khẩn cổng khách (KHÔNG ảnh hưởng CRM nội bộ / COWORK)

Bật **cả hai** file:
- VIP ID: `/srv/vip-staging/cowork/deploy/vps/data/khach_bao_tri.flag`. Tạo bằng docker alpine vì file thuộc uid 10001.
- CRM: `touch ~/vipcrm6-prod/secrets/portal-ctl/portal.off`.

## 5. Tài liệu chính

| Tài liệu | Nội dung |
|---|---|
| `docs/cong-khach-hang/KIEN_TRUC_P1.md` | Kiến trúc, hợp đồng §1–§15.7 |
| `docs/cong-khach-hang/PHUONG_AN_PILOT_P1.md` | Phương án triển khai |
| `docs/cong-khach-hang/CHECKLIST_PRODUCTION_P1.md` | Checklist production |
| `docs/cong-khach-hang/BAO_CAO_NGHIEM_THU_P1.md` | Báo cáo nghiệm thu |
| `tests/portal-e2e/` (README, HUONG_DAN_DEMO.md) | Bộ E2E và demo local |
| `vip-group-id`: `docs/KHACH-DUYET-CHECKLIST.md` | Checklist nhân viên duyệt, gồm mục hồ sơ cũ |

## 6. Nguyên tắc (giữ nguyên)

- Không deploy production, không đổi DNS, Caddy hay secret khi owner chưa duyệt cụ thể.
- Mỗi repo chỉ một người ghi.
  - Phiên CRM: duy nhất ghi repo CRM, nhận phê duyệt **trực tiếp** từ owner.
  - Website + VIP ID: phiên đang làm (Claude hoặc DeepSeek), **mỗi lúc chỉ một phiên**. Xem §7.
- Không bao giờ yêu cầu gửi mật khẩu hay secret qua chat.

## 7. Quy tắc cho phiên code tiếp theo (BẮT BUỘC)

1. **Người ghi duy nhất:** khi phiên này làm, nó là người ghi duy nhất của repo `vip-group-com-vn` (website) và `~/code/vip-group-id-khach` (VIP ID). **Không ghi** repo CRM `~/Projects/vip-group-khoqctq`; việc CRM do phiên CRM làm, phối hợp qua tin nhắn hoặc owner chuyển lời.
2. **Nhánh:** luôn làm trên nhánh mới, không commit thẳng `main`/`develop`. Website: PR → `develop` (CI + staging) → PR → `main`. VIP ID: PR vào `main`.
3. **Test trước khi báo xong:**

   | Repo | Lệnh | Kỳ vọng |
   |---|---|---|
   | Website | `npx astro check` | 0 lỗi |
   | Website | `npm test` | 183 test đạt hết |
   | VIP ID | `cd ~/code/vip-group-id-khach && /Users/viporder/code/vip-group-id/.venv/bin/python -m pytest -q --ignore=tests/test_ui_ag01.py -p no:warnings` | rc=0 |
   | Tích hợp | `tests/portal-e2e/README.md` (`MODE=real TOPO=multi …`) | hết các mục |

   Đổi gì liên quan đăng nhập, phiên, quyền hoặc dữ liệu khách thì cần thêm **một lượt rà soát bảo mật độc lập**.
4. **Production:**
   - Chỉ làm khi owner gửi câu duyệt cụ thể cho đúng việc đó.
   - Luôn backup trước.
   - Cập nhật VIP ID theo đúng quy trình ở `PHUONG_AN_PILOT_P1.md`: thử bằng container tạm → `docker compose up -d` → **`docker network connect vipcrm6-prod_edge cowork-staging`** (thiếu bước này thì CRM không gọi được VIP ID).
   - Caddy: backup, `caddy validate`, `reload` mềm. Không bao giờ restart Caddy, vì nó dùng chung cho nhiều site.
   - Không in hay commit secret. Không yêu cầu owner gửi mật khẩu hay secret qua chat.
5. **Việc làm ngay khi owner gửi `DUYỆT TỰ KÍCH HOẠT`** (sau khi phiên CRM đã cập nhật CRM `14e6da7`):
   1. SSH `viporder-staging`, backup `cowork.db` theo cách ở P-02 (sqlite backup API trong container → `/data/backups/`).
   2. Merge PR #4 (`thanhbn123/vip-group-id`).
   3. Trên VPS: `cd /srv/vip-staging/cowork && git pull --ff-only`, rồi build và thử bằng container tạm như P-03.
   4. Thêm `COWORK_KHACH_TU_DONG=0` vào `deploy/vps/.env.staging`, `up -d`, rồi `network connect`. Kiểm `/api/health` và đăng nhập COWORK.
   5. Báo phiên CRM bật `PORTAL_AUTO_APPROVE=1`. Sau đó đặt `COWORK_KHACH_TU_DONG=1`, `up -d`, `network connect`.
   6. Phiên CRM chạy `portal-auto-approve-pending.js`: dry-run trước, rồi `--apply`.
   7. Smoke trên production bằng trình duyệt thật. Không tạo khách giả trên production; nếu cần thì để owner tự đăng ký.
6. **Không lặp lại lỗi cũ:** image Docker của CRM từng thiếu thư mục `web-portal`. Mọi thay đổi đóng gói phải kiểm **bên trong container**, không chỉ chạy từ mã nguồn.
7. **Khi phiên Claude quay lại:** để lại ghi chú ở cuối file này (đã làm gì, SHA, còn dở gì) để Claude kiểm và tiếp tục.

## 8. Nhật ký phiên tiếp theo (phiên code ghi vào đây)

- **09/11/2026 — phiên DeepSeek (website + VIP ID): kiểm nền, KHÔNG phát hành.** Người ghi duy nhất theo §7.1: chỉ ghi website + VIP ID, repo CRM chỉ đọc.
  - **Chưa có câu duyệt** (`I_APPROVE_UPDATE_14e6da7` cho CRM, `DUYỆT TỰ KÍCH HOẠT` cho phiên này) → **không** làm §7.5: không SSH, không backup, không merge PR #4, không đổi cờ, không đụng production.
  - **Kiểm §7.3 — đạt hết:** `npx astro check` 0 lỗi / 0 cảnh báo (101 tệp); `npm test` 183/183, rc=0; VIP ID pytest (đúng lệnh §7.3) 388/388, rc=0. `origin/main` vẫn `5a7274e`, khớp §1.
  - **Cờ phát hành vẫn TẮT trong mã:** VIP ID `cowork/config.py:228` (`COWORK_KHACH_TU_DONG` mặc định `"0"`); CRM `server/config.js:137` (`PORTAL_AUTO_APPROVE === '1'` mới bật, tắt → 503). PR #4: OPEN, MERGEABLE, base `main`, đầu nhánh `2635b03`.
  - **Chưa chạy lại E2E thật:** repo CRM đang được phiên CRM sửa (nhánh `v6.3/customer-flat-price`, HEAD `9add387` V6.4, 2 tệp chưa commit) → `MODE=real` lúc này là kiểm cây mã trộn V6.4, trái §7.1. Kết quả có giá trị vẫn là 10/10 (1 pending) ở `ccd0448`; chạy lại khi CRM sạch.
  - **Đã làm theo §7.2/§7.7:** 6 commit bàn giao của phiên trước (3 tài liệu + `tests/portal-e2e/run.mjs` nhóm TUDONG) trước chỉ nằm local → đã đẩy lên nhánh `docs/vipg-web-027-ghi-chu-ban-giao` và mở **PR #51** vào `develop` (chỉ tài liệu + test, không đổi site).
  - **Lưu ý cho phiên sau:** `node_modules` (symlink) và `.git` thật của website đều nằm ngoài workspace (`~/code/vip-group/…`) → sandbox của harness phải mở rộng quyền thì `astro check` / `npm test` / lệnh git ghi mới chạy được (lần đầu rc=1 chỉ vì `EPERM .vite/deps`, không phải lỗi mã). CRM `14e6da7` đã nằm trong HEAD nhánh `v6.3/customer-flat-price` — khi phát hành phải dùng đúng bản RC, không lẫn V6.4.
  - **Sẵn sàng §7.5** ngay khi owner gửi `DUYỆT TỰ KÍCH HOẠT` và CRM đã lên `14e6da7`.
