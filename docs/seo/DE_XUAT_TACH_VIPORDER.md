# ĐỀ XUẤT TÁCH vipgroup.com.vn KHỎI viporder.com.vn — ĐÃ CHỐT 07/11/2026 (đã triển khai, PR #45)

> **Owner chốt:** Q1 = CÔNG TY TNHH VIP GROUP cung cấp dịch vụ · Q2 = VIP GROUP có điểm giao dịch Bắc Ninh (**chờ địa chỉ**) · Q3 = bỏ VIPORDER khỏi website · Q4 = P3 ngay (đăng ký = form), P1 sau · Q5 = tra cứu qua Zalo/hotline · Q6 = giữ email.

Ngày 07/11/2026 · Owner: *"tách khỏi viporder.com.vn ra riêng, không gộp vào nhau, đăng ký đăng nhập sẽ làm riêng khách"*.
**Chưa sửa code.** NO-GO PRODUCTION vẫn giữ nguyên.

## 1. Hiện trạng đo được (bản đang ở staging)

| Điểm dính VIPORDER | Số lượng | Ở đâu |
|---|---|---|
| Link sang website viporder.com.vn | 16 | Ô "Đơn vị vận hành dịch vụ" cuối mọi trang Logistics |
| "Đăng ký mã khách hàng" → viporder.com.vn/#register | 6 | Quy trình, trang tuyến, mạng lưới kho |
| "Tra cứu vận đơn" → viporder.com.vn/#tracking | 1 | `/logistics/tra-cuu-van-don/` |
| "Đăng nhập" → khachhang.viporder.com.vn | 1 | Trang tra cứu |
| Trang nhắc tên VIPORDER | 15 | Câu "dịch vụ do VIPORDER vận hành", FAQ quan hệ, schema `provider` |
| Dữ kiện lấy nguồn từ viporder.com.vn | 4 nhóm | Danh sách dịch vụ, quy trình 4 bước, **văn phòng Bắc Ninh (Số 62 KĐT Nam Hồng)**, tra cứu |

**Đã tách sẵn:** thu lead (Google Sheet + Zalo VIP GROUP + CRM V5, không qua VIPORDER); hotline/Zalo 0961 102 655 của VIP GROUP.

**Hệ thống VIP GROUP có thể dùng làm nền:** VIP GROUP COWORK / VIP ID (`cowork.vipgroup.com.vn`, đăng nhập nhân viên); CRM V5 (có module khách hàng, lead, kho WMS, tài chính — đang staging).

## 2. Các quyết định owner cần chốt

### Q1. Ai là đơn vị cung cấp dịch vụ logistics trên vipgroup.com.vn?
| Phương án | Ý nghĩa | Hệ quả |
|---|---|---|
| **A. CÔNG TY TNHH VIP GROUP trực tiếp cung cấp** *(khuyến nghị nếu đúng pháp lý)* | Bỏ mọi câu "do VIPORDER vận hành"; schema `provider` = VIP GROUP | Cần owner xác nhận VIP GROUP có ngành nghề + năng lực thực hiện (hợp đồng, hoá đơn đứng tên VIP GROUP) |
| B. Vẫn ghi VIPORDER vận hành nhưng không link sang | Chỉ bỏ link | Không đúng tinh thần "tách riêng" |

### Q2. Văn phòng / điểm nhận hàng tại Bắc Ninh
Địa chỉ Bắc Ninh hiện là **của VIPORDER**. Nếu tách: (a) VIP GROUP có điểm tại Bắc Ninh → owner cung cấp địa chỉ; hoặc (b) trang Bắc Ninh bỏ địa chỉ, chỉ giữ "phục vụ khách Bắc Ninh – Từ Sơn – Đồng Kỵ" + hotline. Trang Bắc Ninh vẫn giữ được SEO, nhưng **mất tín hiệu địa chỉ địa phương** (Google Business Profile Bắc Ninh khi đó cần địa chỉ VIP GROUP thật).

### Q3. Trang "Công ty thành viên"
VIPORDER đang được liệt kê là công ty cùng chủ sở hữu (thông tin pháp lý tập đoàn, owner chốt 24/10). Đề xuất: **giữ** ở trang Công ty thành viên (đúng sự thật), nhưng **không** link/đẩy khách từ khu Logistics sang. Owner chọn giữ hay bỏ.

### Q4. Đăng ký / đăng nhập khách hàng riêng — 3 phương án
| | **P1. Cổng khách hàng trên CRM V5 + VIP ID** *(khuyến nghị)* | P2. Cổng khách hàng mới độc lập | P3. Tạm thời: không có tài khoản |
|---|---|---|---|
| Địa chỉ | `khachhang.vipgroup.com.vn` | `khachhang.vipgroup.com.vn` | — |
| Đăng ký | Form → tạo khách trong CRM V5 (tenant VIP) + mã khách VIP GROUP | Hệ thống tài khoản mới | Đăng ký = gửi yêu cầu (lead) → nhân viên cấp mã |
| Đăng nhập | VIP ID (mở rộng cho khách, tách hẳn nhân viên) | Tự xây | Không |
| Dùng lại | Khách hàng, lead, WMS, tài chính đã có trong CRM V5 | Không | Lead đã có |
| Thời gian (ước tính) | 2–4 tuần | 4–8 tuần | 1–2 ngày (chỉ sửa web) |
| Rủi ro | Cần phiên CRM làm phần khách hàng ngoài | Trùng dữ liệu với CRM | Khách chưa tự tra cứu được |

**Khuyến nghị:** làm **P3 ngay** (để tách khỏi VIPORDER trước khi phát hành) → **P1** là bước tiếp theo, giao phiên CRM V5 (cổng khách hàng) và phiên VIP ID (tài khoản khách tách khỏi tài khoản nhân viên).

### Q5. Tra cứu vận đơn
Hiện tra cứu dùng hệ thống VIPORDER. Nếu tách: (a) tạm bỏ trang tra cứu, thay bằng "tra cứu qua hotline/Zalo kèm mã vận đơn"; (b) khi có P1, tra cứu theo dữ liệu WMS CRM V5. Trang `/logistics/tra-cuu-van-don/` hiện được index → nếu bỏ: chuyển 301 về `/logistics/lien-he/` hoặc giữ trang với hướng dẫn mới.

### Q6. Email
Email công khai hiện là `viporder@vipgroup.com.vn` (tên hộp thư trùng tên VIPORDER, dù thuộc tên miền VIP GROUP). Có muốn đổi sang hộp thư khác (vd. `lienhe@vipgroup.com.vn`, owner tạo trong Google Workspace)?

## 3. Phạm vi sửa website khi owner chốt (theo khuyến nghị A + giữ thành viên + P3)

1. Bỏ ô "Đơn vị vận hành: VIPORDER" và mọi câu "do VIPORDER vận hành" → "VIP GROUP"; schema `provider` = VIP GROUP Organization.
2. Thay 6 link "Đăng ký mã khách hàng" → nút "Đăng ký khách hàng" mở form thu lead (nhu cầu = đăng ký); thông báo "nhân viên cấp mã khách trong giờ làm việc".
3. Tra cứu: theo Q5.
4. Trang Bắc Ninh / Liên hệ: theo Q2.
5. FAQ "VIP GROUP và VIPORDER quan hệ thế nào" → bỏ khỏi khu Logistics.
6. Rà lại các câu lấy nguồn viporder.com.vn (dịch vụ, quy trình 4 bước): giữ nội dung nếu owner xác nhận VIP GROUP cung cấp đúng các dịch vụ đó (nguồn đổi thành "owner xác nhận").
7. Test chặn tái phát: không còn link `viporder.com.vn` trong khu Logistics; không còn tên VIPORDER ngoài trang Công ty thành viên.
8. Ước tính 1 ngày, kiểm thử + verifier + staging như các vòng trước.

## 4. Owner chốt

- Q1: ☐ A (VIP GROUP cung cấp) ☐ B
- Q2: ☐ có địa chỉ VIP GROUP Bắc Ninh: ________ ☐ bỏ địa chỉ
- Q3: ☐ giữ VIPORDER ở trang Công ty thành viên ☐ bỏ
- Q4: ☐ P3 ngay rồi P1 ☐ chỉ P1 ☐ P2
- Q5: ☐ tạm bỏ tra cứu ☐ giữ trang, hướng dẫn qua hotline
- Q6: ☐ giữ email ☐ đổi sang: ________
