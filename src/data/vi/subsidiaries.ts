import type { Subsidiary } from '../types';

/**
 * Owner directive 07/11/2026: website VIP GROUP TÁCH khỏi VIPORDER — không liệt kê, không link VIPORDER.
 * Hiện chưa công bố công ty thành viên nào; các lĩnh vực do CÔNG TY TNHH VIP GROUP trực tiếp thực hiện.
 * Khi có pháp nhân thành viên thật: thêm mục với `legalName`, `url`, `status: 'active'`. KHÔNG đặt tên pháp lý giả.
 */
export const subsidiaries: Subsidiary[] = [];
