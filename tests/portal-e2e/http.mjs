// HTTP thô (node:http) — cần vì fetch() không cho đặt header Host. Không theo redirect.
import http from 'node:http';

/**
 * @param {{port:number, host?:string, method?:string, path:string, headers?:object, body?:string|Buffer, hostHeader?:string, timeoutMs?:number}} o
 * @returns {Promise<{status:number, headers:object, body:string, setCookies:string[]}>}
 */
export function raw(o) {
  return new Promise((resolve, reject) => {
    const headers = { ...(o.headers || {}) };
    if (o.hostHeader) headers.host = o.hostHeader;
    if (o.body !== undefined && headers['content-length'] === undefined) headers['content-length'] = Buffer.byteLength(o.body);
    // agent:false — không giữ socket keep-alive (uvicorn đóng sau 5 s → socket chết trong globalAgent làm client khác cùng tiến trình ECONNRESET)
    const req = http.request({ host: o.host || '127.0.0.1', port: o.port, method: o.method || 'GET', path: o.path, headers, timeout: o.timeoutMs || 15000, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const sc = res.headers['set-cookie'] || [];
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), setCookies: sc });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (o.body !== undefined) req.write(o.body);
    req.end();
  });
}

/** Gộp Set-Cookie vào một jar đơn giản {name: value} (bỏ cookie bị xoá). */
export function absorb(jar, setCookies) {
  for (const sc of setCookies || []) {
    const [nv, ...attrs] = sc.split(';');
    const i = nv.indexOf('=');
    const name = nv.slice(0, i).trim();
    const val = nv.slice(i + 1).trim();
    const expired = attrs.some((a) => /max-age=0/i.test(a) || /expires=thu, 01 jan 1970/i.test(a));
    if (expired || val === '' || val === '""') delete jar[name]; else jar[name] = val;
  }
  return jar;
}
export const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

/** Lấy giá trị input hidden name=_csrf (hoặc tên khác) từ HTML. */
export function formField(html, name) {
  const re = new RegExp(`<input[^>]*name=["']${name}["'][^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  if (!tag) return null;
  return /value=["']([^"']*)["']/i.exec(tag)?.[1] ?? null;
}
