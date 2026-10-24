/**
 * Ngôn ngữ của website. v1 chỉ có tiếng Việt (mặc định, không tiền tố URL).
 * Thêm tiếng Anh/Trung: thêm 'en' / 'zh' vào `locales`, khai báo trong astro.config.mjs,
 * thêm chuỗi vào `ui.ts`, dữ liệu vào `src/data/<locale>/`, trang vào `src/pages/<locale>/`.
 */
export const locales = ['vi'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'vi';

export const htmlLang: Record<Locale, string> = { vi: 'vi' };
export const ogLocale: Record<Locale, string> = { vi: 'vi_VN' };
