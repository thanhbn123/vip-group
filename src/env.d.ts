/** Mã site Turnstile ghi đè lúc build thử — xem astro.config.mjs. */
declare const __VIPG_TURNSTILE_OVERRIDE__: string;
/** true khi build bằng `VIPG_DEMO=1` — xem astro.config.mjs. */
declare const __VIPG_DEMO__: boolean;
declare const __VIPG_PORTAL_OVERRIDE__: boolean;
/** Khung "Phòng chat chung" (VIP CHAT V1.0) — xem astro.config.mjs. apiBase '' = cùng origin. */
declare const __VIPG_CHAT__: { enabled: boolean; apiBase: string };
declare module '@vipg/community-chat' {
  const C: (props: Record<string, never>) => unknown;
  export default C;
}
