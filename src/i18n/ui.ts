import type { Locale } from './config';

export interface NavItem {
  key: string;
  label: string;
  href: string;
}

const ui = {
  vi: {
    skipToContent: 'Bỏ qua tới nội dung chính',
    openMenu: 'Mở menu',
    closeMenu: 'Đóng menu',
    mainNav: 'Điều hướng chính',
    updating: 'Đang cập nhật',
    nav: [
      { key: 'home', label: 'Trang chủ', href: '/' },
      { key: 'about', label: 'Giới thiệu', href: '/gioi-thieu/' },
      { key: 'sectors', label: 'Lĩnh vực hoạt động', href: '/linh-vuc-hoat-dong/' },
      { key: 'members', label: 'Công ty thành viên', href: '/cong-ty-thanh-vien/' },
      { key: 'news', label: 'Tin tức', href: '/tin-tuc/' },
      { key: 'careers', label: 'Tuyển dụng', href: '/tuyen-dung/' },
      { key: 'contact', label: 'Liên hệ', href: '/lien-he/' },
    ] satisfies NavItem[],
  },
};

export function t(locale: Locale) {
  return ui[locale];
}
