const COOKIE_NAME = 'spk_flash';

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[name] = value;
  }
  return cookies;
}

export function flashMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  let flash = null;

  if (raw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (parsed && typeof parsed.message === 'string') {
        flash = {
          type: ['success', 'error', 'info'].includes(parsed.type) ? parsed.type : 'info',
          message: parsed.message,
        };
      }
    } catch {
      flash = null;
    }
    res.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  res.locals.flash = flash;
  res.setFlash = (type, message) => {
    const safeType = ['success', 'error', 'info'].includes(type) ? type : 'info';
    const payload = encodeURIComponent(JSON.stringify({ type: safeType, message: String(message) }));
    res.append(
      'Set-Cookie',
      `${COOKIE_NAME}=${payload}; Path=/; HttpOnly; SameSite=Lax; Max-Age=60`,
    );
  };

  next();
}
