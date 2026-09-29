import type { Subsidiary } from '../types';

/**
 * Chỉ VIPORDER là công ty thành viên đã chốt.
 * Các mục `placeholder` là chỗ giữ cho pháp nhân chưa chốt — KHÔNG đặt tên pháp lý giả.
 * Khi có pháp nhân thật: đổi `name`, điền `legalName`, `url`, chuyển `status` sang 'active'.
 */
export const subsidiaries: Subsidiary[] = [
  {
    id: 'viporder',
    name: 'VIPORDER',
    legalName: null,
    sectorId: 'logistics',
    description: 'Xuất nhập khẩu, hải quan và logistics.',
    url: null,
    status: 'active',
  },
  {
    id: 'technology-member',
    name: 'Công ty thành viên khối Công nghệ',
    legalName: null,
    sectorId: 'technology',
    description: 'Pháp nhân đang được hoàn thiện. Thông tin sẽ cập nhật khi chính thức.',
    url: null,
    status: 'placeholder',
  },
  {
    id: 'real-estate-member',
    name: 'Công ty thành viên khối Bất động sản',
    legalName: null,
    sectorId: 'real-estate',
    description: 'Pháp nhân đang được hoàn thiện. Thông tin sẽ cập nhật khi chính thức.',
    url: null,
    status: 'placeholder',
  },
];
