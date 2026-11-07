/**
 * Banner trang chủ (owner gửi 07/11/2026: ảnh xe đầu kéo chở hàng tại kho + logo + slogan).
 * File do `bash scripts/banner.sh <ảnh>` sinh ra trong public/banner/ và tự ghi lại file này.
 * null = chưa có ảnh → trang chủ giữ phần đầu hiện tại.
 * Owner chọn BỎ dòng "Ưu đãi đặc biệt khi liên hệ từ Nền tảng TMĐT OBranding" khỏi website (07/11/2026).
 */
export interface HeroBanner {
  /** Đường dẫn gốc, ví dụ '/banner/hero' → /banner/hero-1300.webp … */
  base: string;
  widths: number[];
  width: number;
  height: number;
  alt: string;
}

export const heroBanner: HeroBanner | null = null;
