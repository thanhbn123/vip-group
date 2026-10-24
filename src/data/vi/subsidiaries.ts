import type { Subsidiary } from '../types';

/**
 * Chỉ VIPORDER là công ty thành viên đã chốt — quan hệ với VIP GROUP: hai công ty CÙNG CHỦ SỞ HỮU
 * (owner chốt 24/10/2026, đúng như giấy tờ). Không viết là công ty mẹ – con.
 * Khối Công nghệ và Bất động sản CHƯA có công ty thành viên riêng → không đặt thẻ giữ chỗ
 * (owner giao em đề xuất 24/10/2026, VIPG-WEB-013). Khi có pháp nhân thật: thêm mục mới
 * với `legalName`, `url`, `status: 'active'`. KHÔNG đặt tên pháp lý giả.
 */
export const subsidiaries: Subsidiary[] = [
  {
    id: 'viporder',
    name: 'VIPORDER',
    legalName: 'CÔNG TY TNHH XUẤT NHẬP KHẨU LOGISTICS VIP ORDER',
    sectorId: 'logistics',
    description: 'Xuất nhập khẩu, hải quan và logistics.',
    url: 'https://viporder.com.vn',
    relation: 'Cùng chủ sở hữu với VIP GROUP',
    status: 'active',
  },
];
