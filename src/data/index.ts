import type { SiteContent } from './types';
import { content as vi } from './vi';
import type { Locale } from '../i18n/config';

/** Thêm ngôn ngữ: tạo `src/data/<locale>/` cùng cấu trúc với `vi/` rồi đăng ký ở đây. */
const contents: Record<Locale, SiteContent> = { vi };

export function getContent(locale: Locale): SiteContent {
  return contents[locale];
}

export type * from './types';
