import type { Sector } from '../types';

export const sectors: Sector[] = [
  {
    id: 'logistics',
    order: 1,
    title: 'Xuất nhập khẩu – Hải quan – Logistics',
    summary: 'Dịch vụ hải quan, giao nhận, vận tải và quản trị chuỗi cung ứng cho doanh nghiệp xuất nhập khẩu.',
    focus: ['Thủ tục hải quan', 'Xuất nhập khẩu', 'Vận tải & giao nhận'],
  },
  {
    id: 'technology',
    order: 2,
    title: 'Công nghệ – Phần mềm – AI',
    summary: 'Xây dựng nền tảng số, phần mềm quản trị, tự động hoá quy trình và ứng dụng AI cho doanh nghiệp.',
    focus: ['Phần mềm quản trị', 'Tự động hoá quy trình', 'AI & dữ liệu doanh nghiệp'],
  },
  {
    id: 'real-estate',
    order: 3,
    title: 'Bất động sản',
    summary: 'Đầu tư, quản lý và phát triển tài sản phục vụ chiến lược tăng trưởng dài hạn.',
    focus: ['Đầu tư', 'Quản lý tài sản', 'Phát triển dự án'],
  },
];
