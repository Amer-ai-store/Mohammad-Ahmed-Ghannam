// Push notifications: device-token registry + Expo Push API sender (server side).
// Every in-app notification is also pushed to the user's registered devices when
// PUSH_ENABLED=1 (and EXPO_ACCESS_TOKEN if the Expo project enforces it). The app
// registers its token once the native notifications module is added to the build.
const TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[\w-]{10,200}\]$/;

export function installPush(ctx) {
  const { db, get, all, run, now, fail, text, requireUser, rate, options } = ctx;
  db.exec('CREATE TABLE IF NOT EXISTS push_devices(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,platform TEXT NOT NULL,created_at TEXT NOT NULL,last_error TEXT)');
  const env = { ...process.env, ...(options.pushEnv || {}) };
  const enabled = env.PUSH_ENABLED === '1';
  const fetcher = options.pushFetch || fetch;
  async function send(userId, title, body) {
    if (!enabled) return { sent: 0 };
    const devices = all('SELECT token FROM push_devices WHERE user_id=?', userId);
    if (!devices.length) return { sent: 0 };
    try {
      const r = await fetcher('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}) }, body: JSON.stringify(devices.map((d) => ({ to: d.token, title, body, sound: 'default', channelId: 'default' }))) });
      const data = await r.json().catch(() => ({}));
      (data.data || []).forEach((ticket, i) => { if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') run('DELETE FROM push_devices WHERE token=?', devices[i].token); else if (ticket.status === 'error') run('UPDATE push_devices SET last_error=? WHERE token=?', String(ticket.message || 'error').slice(0, 200), devices[i].token); });
      return { sent: devices.length };
    } catch { return { sent: 0 }; }
  }
  async function handle(method, path, body, req) {
    if (method === 'GET' && path === '/api/push/status') return { status: 200, body: { enabled } };
    if (method === 'POST' && path === '/api/devices') {
      const actor = requireUser(req); rate(req, 'push-register', 30);
      const token = text(body.token, 'رمز الجهاز', 20, 260); if (!TOKEN.test(token)) fail(400, 'رمز الإشعارات غير صالح', 'invalid_push_token');
      const platform = ['android', 'ios', 'web'].includes(body.platform) ? body.platform : 'android';
      if (get('SELECT COUNT(*) AS n FROM push_devices WHERE user_id=?', actor.id).n >= 10 && !get('SELECT 1 AS x FROM push_devices WHERE token=?', token)) fail(400, 'الحد الأقصى 10 أجهزة');
      run('INSERT INTO push_devices VALUES(?,?,?,?,NULL) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,platform=excluded.platform,last_error=NULL', token, actor.id, platform, now());
      return { status: 201, body: { ok: true } };
    }
    if (method === 'DELETE' && path === '/api/devices') { const actor = requireUser(req); run('DELETE FROM push_devices WHERE user_id=? AND token=?', actor.id, String(body.token || '')); return { status: 200, body: { ok: true } }; }
    return undefined;
  }
  return { handle, send, enabled: () => enabled };
}
