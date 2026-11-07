/**
 * Chế độ build.
 * - Mặc định (production): chỉ dữ liệu đã xác minh; trang `pending` noindex; trang `draft` không build.
 * - DEMO (`VIPG_DEMO=1`): hiện dữ liệu MẪU có nhãn, build cả trang nháp, MỌI trang noindex.
 */
export const DEMO: boolean = __VIPG_DEMO__;
