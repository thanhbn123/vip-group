/**
 * Script phía trình duyệt cho khung "Phòng chat chung VIP GROUP" (src/components/CommunityChat.astro).
 * Hợp đồng API: GET <base>/portal/public/community (VIP CHAT V1.0 §5.4). Không cookie, chỉ GET.
 * AN TOÀN: mọi dữ liệu từ API chỉ được ghi bằng textContent / setAttribute giá trị đã kiểm — không innerHTML.
 */

export interface Slot { dow: number; start: string; end: string }
export interface Exception { date: string; closed: boolean; note?: string | null }
export interface Message { seq: number; name: string; badge?: string | null; body: string; created_at: string }
export interface Community {
  open: boolean;
  locked: boolean;
  session: { no: number; opened_at: string; closes_at: string | null } | null;
  schedule: { slots: Slot[]; exceptions: Exception[]; note?: string | null; next: { start: string; end: string } | null } | null;
  online: number;
  messages: Message[];
  join_url: string;
}

export const POLL_MS = 10_000;
export const MAX_BACKOFF_MS = 120_000;
const TZ = 'Asia/Ho_Chi_Minh';
const DOW = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
/** Ngày giờ theo giờ Việt Nam (không phụ thuộc múi giờ máy khách). */
export function vn(d: Date) {
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(d)) p[x.type] = x.value;
  return { y: p.year, m: p.month, d: p.day, hh: p.hour === '24' ? '00' : p.hour, mm: p.minute, dow: WD[p.weekday] ?? 0 };
}
const parse = (s: unknown) => { const d = new Date(String(s)); return Number.isNaN(d.getTime()) ? null : d; };
export const hhmm = (s: unknown) => { const d = parse(s); if (!d) return ''; const v = vn(d); return `${v.hh}:${v.mm}`; };
const hm = (s: unknown) => (typeof s === 'string' && /^\d{1,2}:\d{2}/.test(s) ? s.slice(0, 5).padStart(5, '0') : '');

export function slotLabel(s: Slot) { return `${DOW[s.dow] ?? '?'} · ${hm(s.start)}–${hm(s.end)}`; }
export function nextLabel(n: { start: string; end: string }) {
  const a = parse(n.start); if (!a) return '';
  const v = vn(a);
  return `${DOW[v.dow]}, ${v.d}/${v.m} · ${v.hh}:${v.mm}${parse(n.end) ? `–${hhmm(n.end)}` : ''}`;
}
export function exceptionLabel(e: Exception) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(e.date)); if (!m) return '';
  const dow = vn(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 5))).dow;
  const head = `${DOW[dow]}, ${m[3]}/${m[2]}`;
  const note = e.note ? ` — ${String(e.note)}` : '';
  return e.closed ? `${head}: nghỉ${note}` : `${head}${note || ': có thay đổi lịch'}`;
}
export function statusOf(c: Community | null): { state: 'open' | 'closed' | 'locked' | 'error'; label: string } {
  if (!c) return { state: 'error', label: 'KHÔNG RÕ' };
  if (c.locked) return { state: 'locked', label: 'TẠM NGƯNG' };
  return c.open ? { state: 'open', label: 'ĐANG MỞ' } : { state: 'closed', label: 'ĐÓNG' };
}

/** Kiểm hình dạng tối thiểu của phản hồi — dữ liệu lạ coi như lỗi. */
export function valid(x: unknown): x is Community {
  const c = x as Community;
  return !!c && typeof c === 'object' && typeof c.open === 'boolean' && Array.isArray(c.messages);
}

/**
 * Chỉ nhận join_url http(s) (chặn javascript:, data:…) TRỎ TỚI vipgroup.com.vn (hoặc tên miền con) hoặc cùng host với trang / API base
 * (môi trường thử, máy dev). http chỉ khi chính API base là http (máy dev). Sai → fallback.
 */
export function safeJoin(raw: unknown, fallback: string, apiBase: string) {
  try {
    const u = new URL(String(raw), location.href);
    const host = u.hostname.toLowerCase();
    let apiHost = '';
    try { apiHost = apiBase ? new URL(apiBase, location.href).hostname.toLowerCase() : location.hostname.toLowerCase(); } catch { apiHost = ''; }
    const trusted = host === 'vipgroup.com.vn' || host.endsWith('.vipgroup.com.vn') || host === location.hostname.toLowerCase() || (apiHost !== '' && host === apiHost);
    if (trusted && (u.protocol === 'https:' || (u.protocol === 'http:' && !/^https:/.test(apiBase)))) return u.href;
  } catch { /* bỏ qua */ }
  return fallback;
}

export function initCommunityChat(root: HTMLElement) {
  const apiBase = root.dataset.api ?? '';
  const fallbackJoin = root.dataset.join ?? '/portal/#/cong-dong';
  const url = `${apiBase}/portal/public/community`;
  const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
  const mqPhone = window.matchMedia('(max-width: 767px)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let data: Community | null = null;
  let fails = 0;
  let timer: number | undefined;
  let inflight: AbortController | null = null;
  let sessionKey = '';
  const rendered = new Map<HTMLElement, number[]>();

  // ── Hiển thị ──────────────────────────────────────────────────────────
  const el = (tag: string, cls: string, text?: string) => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };

  function msgNode(m: Message) {
    const li = el('li', 'cc-msg');
    li.dataset.seq = String(m.seq);
    const head = el('div', 'cc-msg-head');
    head.append(el('span', 'cc-name', String(m.name ?? '')));
    if (m.badge) head.append(el('span', 'cc-badge', String(m.badge)));
    const t = el('time', 'cc-time', hhmm(m.created_at));
    const d = parse(m.created_at); if (d) t.setAttribute('datetime', d.toISOString());
    head.append(t);
    li.append(head, el('p', 'cc-body', String(m.body ?? '')));
    return li;
  }

  /** Cập nhật danh sách theo kiểu nối thêm (aria-live chỉ đọc tin mới), dựng lại khi đổi phiên / tin bị ẩn. */
  function renderList(list: HTMLElement, msgs: Message[]) {
    const limit = Number(list.dataset.limit) || 0;
    const want = (limit ? msgs.slice(-limit) : msgs).filter((m) => m && Number.isFinite(Number(m.seq)));
    const wantSeq = want.map((m) => Number(m.seq));
    const have = rendered.get(list) ?? [];
    const scroller = list.closest<HTMLElement>('[data-cc-scroll]');
    const atBottom = !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
    const keep = have.filter((s) => wantSeq.includes(s));
    const prefixOk = keep.every((s, i) => wantSeq[i] === s) && have.slice(have.length - keep.length).every((s, i) => s === keep[i]);
    let added = 0;
    if (!prefixOk || list.dataset.session !== sessionKey) {
      list.replaceChildren(...want.map(msgNode));
      list.dataset.session = sessionKey;
      added = -1;
    } else {
      for (const child of Array.from(list.children) as HTMLElement[]) if (!wantSeq.includes(Number(child.dataset.seq))) child.remove();
      for (const m of want.slice(keep.length)) { list.append(msgNode(m)); added++; }
    }
    rendered.set(list, wantSeq);
    if (!scroller) return;
    const btn = scroller.parentElement?.querySelector<HTMLButtonElement>('[data-cc-newbtn]');
    if (added === -1 || atBottom) { scroller.scrollTop = scroller.scrollHeight; if (btn) btn.hidden = true; }
    else if (added > 0 && btn) { btn.hidden = false; btn.textContent = `↓ ${added} tin mới`; }
  }

  function setText(sel: string, text: string) { for (const n of $$(sel)) n.textContent = text; }

  function render() {
    const st = statusOf(data);
    for (const n of $$('[data-cc-status]')) { n.dataset.state = st.state; n.textContent = st.label; }
    for (const n of $$('[data-cc-dot]')) n.dataset.state = st.state;
    setText('[data-cc-fab-state]', `, trạng thái: ${st.label.toLowerCase()}`);
    for (const n of $$('[data-cc-warn]')) n.hidden = !(fails > 0 && data);

    for (const a of $$<HTMLAnchorElement>('[data-cc-join]')) {
      a.href = safeJoin(data?.join_url, fallbackJoin, apiBase);
      if (mqPhone.matches) { a.removeAttribute('target'); a.removeAttribute('rel'); }
      else { a.target = '_blank'; a.rel = 'noopener'; }
    }

    if (!data) {
      setText('[data-cc-session]', 'Không tải được trạng thái phòng chat');
      for (const ul of $$('[data-cc-schedule]')) ul.replaceChildren(el('li', 'cc-muted', 'Không tải được lịch chat. Bấm "Tham gia chat" để xem trực tiếp.'));
      for (const p of $$('[data-cc-sched-note]')) p.hidden = true;
      for (const l of $$('[data-cc-list]')) { l.replaceChildren(); rendered.set(l, []); }
      setText('[data-cc-empty]', 'Không tải được trạng thái phòng chat.');
      setText('[data-cc-online]', '');
      return;
    }

    // Trạng thái phiên
    let session = '';
    if (data.locked) session = 'Phòng chat đang tạm ngưng. Vui lòng quay lại sau.';
    else if (data.open && data.session) {
      session = `Phiên #${data.session.no} · mở lúc ${hhmm(data.session.opened_at)}`;
      if (data.session.closes_at) session += ` · đóng lúc ${hhmm(data.session.closes_at)}`;
    } else if (data.open) session = 'Phòng chat đang mở.';
    else {
      const nx = data.schedule?.next ? nextLabel(data.schedule.next) : '';
      session = nx ? `Phiên tiếp theo: ${nx}` : 'Phòng chat đang đóng. Chưa có lịch phiên tiếp theo.';
    }
    setText('[data-cc-session]', session);
    setText('[data-cc-online]', data.open && !data.locked && data.online > 0 ? `${data.online} người đang trong phòng` : '');

    // Lịch
    const slots = [...(data.schedule?.slots ?? [])].filter((s) => s && s.dow >= 1 && s.dow <= 7)
      .sort((a, b) => a.dow - b.dow || String(a.start).localeCompare(String(b.start)));
    const today = (() => { const v = vn(new Date()); return `${v.y}-${v.m}-${v.d}`; })();
    const exc = (data.schedule?.exceptions ?? []).filter((e) => e && String(e.date) >= today)
      .sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 3);
    for (const ul of $$('[data-cc-schedule]')) {
      const items = slots.map((s) => el('li', '', slotLabel(s)));
      for (const e of exc) { const t = exceptionLabel(e); if (t) items.push(el('li', 'cc-exc', t)); }
      if (!items.length) items.push(el('li', 'cc-muted', 'Chưa có lịch cố định — theo dõi thông báo của VIP GROUP.'));
      ul.replaceChildren(...items);
    }
    for (const p of $$('[data-cc-sched-note]')) { const note = data.schedule?.note ? String(data.schedule.note) : ''; p.textContent = note; p.hidden = !note; }

    // Tin nhắn — chỉ phiên đang mở (server đã lọc; phiên đóng → trống)
    sessionKey = data.session ? String(data.session.no) : '';
    const msgs = data.open ? [...data.messages].sort((a, b) => Number(a.seq) - Number(b.seq)) : [];
    for (const l of $$('[data-cc-list]')) renderList(l, msgs);
    setText('[data-cc-empty]', data.locked ? 'Phòng chat đang tạm ngưng.'
      : data.open ? 'Chưa có tin nhắn trong phiên này. Hãy là người mở lời!'
      : 'Phòng chat đang đóng. Tin nhắn chỉ hiển thị khi phiên đang mở.');
  }

  // ── Tải dữ liệu: 10 s khi tab hiện, lùi dần khi lỗi, dừng khi tab ẩn ───
  function schedule(ms: number) { window.clearTimeout(timer); timer = window.setTimeout(tick, ms); }
  async function tick() {
    if (document.visibilityState === 'hidden') return;
    inflight?.abort();
    const ac = new AbortController(); inflight = ac;
    const kill = window.setTimeout(() => ac.abort(), 8000);
    try {
      const res = await fetch(url, { credentials: 'omit', cache: 'no-store', signal: ac.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: unknown = await res.json();
      if (!valid(body)) throw new Error('bad payload');
      data = body; fails = 0;
    } catch {
      if (ac.signal.aborted && inflight !== ac) return; // bị thay bởi lần gọi mới
      fails++;
    } finally { window.clearTimeout(kill); if (inflight === ac) inflight = null; }
    render();
    if ((document.visibilityState as string) === 'hidden') return;
    const delay = fails ? Math.min(POLL_MS * 2 ** fails, MAX_BACKOFF_MS) * (0.8 + Math.random() * 0.4) : POLL_MS;
    schedule(delay);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { window.clearTimeout(timer); inflight?.abort(); inflight = null; }
    else schedule(0);
  });
  window.addEventListener('online', () => schedule(0));

  for (const btn of $$<HTMLButtonElement>('[data-cc-newbtn]')) {
    btn.addEventListener('click', () => {
      const sc = btn.parentElement?.querySelector<HTMLElement>('[data-cc-scroll]');
      sc?.scrollTo({ top: sc.scrollHeight, behavior: reduce.matches ? 'auto' : 'smooth' });
      btn.hidden = true;
    });
  }
  for (const sc of $$('[data-cc-scroll]')) {
    sc.addEventListener('scroll', () => {
      if (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 48) { const b = sc.parentElement?.querySelector<HTMLElement>('[data-cc-newbtn]'); if (b) b.hidden = true; }
    }, { passive: true });
  }

  // ── Màn toàn màn hình trên điện thoại ────────────────────────────────
  const sheet = root.querySelector<HTMLDialogElement>('[data-cc-sheet]');
  const fab = root.querySelector<HTMLButtonElement>('[data-cc-fab]');
  const closeBtn = root.querySelector<HTMLButtonElement>('[data-cc-close]');
  if (sheet && fab && typeof sheet.showModal === 'function') {
    const focusables = () => Array.from(sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
      .filter((n) => !n.hidden && n.offsetParent !== null);
    const open = () => {
      sheet.showModal();
      document.documentElement.classList.add('cc-lock');
      fab.setAttribute('aria-expanded', 'true');
      const sc = sheet.querySelector<HTMLElement>('[data-cc-scroll]'); if (sc) sc.scrollTop = sc.scrollHeight;
      closeBtn?.focus();
    };
    const close = () => { if (sheet.open) sheet.close(); };
    sheet.addEventListener('close', () => {
      document.documentElement.classList.remove('cc-lock');
      fab.setAttribute('aria-expanded', 'false');
      if (mqPhone.matches) fab.focus();
    });
    fab.setAttribute('aria-expanded', 'false');
    fab.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    sheet.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
    sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    mqPhone.addEventListener('change', () => { if (!mqPhone.matches) close(); render(); });
  }

  render();
  schedule(0);
}
