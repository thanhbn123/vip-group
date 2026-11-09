# BÀN GIAO PHIÊN — trạng thái ngày 09/11/2026 (đọc file này trước khi trả lời owner)

Phiên tiếp theo chỉ **HỎI ĐÁP**: không code, không push, không SSH, không thao tác production.

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
  - Website + VIP ID: phiên Claude này.
- Không bao giờ yêu cầu gửi mật khẩu hay secret qua chat.
