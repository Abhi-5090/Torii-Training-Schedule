/* Backends in order of preference, comma-separated. The defaults are Vercel
   rewrites (see vercel.json), so the session cookie stays first-party:
   /api → torii-schedule-api, /api-ii → torii-schedule-api-ii. */
const API_BASES = (import.meta.env.VITE_API_URL || '/api,/api-ii')
  .split(',')
  .map(base => base.trim().replace(/\/+$/, ''))
  .filter(Boolean);

/* Whichever backend last answered goes first, so a dead one costs one miss. */
let preferred = 0;

/* The API only ever answers in JSON. A gateway error or an HTML page (Render's
   "suspended" or wake-up page, a Vercel timeout) means that backend never
   handled the request, so it is safe to try the next one. */
const isDown = res => [502, 503, 504].includes(res.status)
  || !(res.headers.get('content-type') || '').includes('application/json');

/* Free Render instances sleep after ~15 idle minutes and take up to a minute
   to wake, so reads keep retrying through that instead of failing at once. */
const WAKE_WINDOW_MS = 90_000;
const RETRY_DELAY_MS = 4_000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/* One pass over every backend, starting with the last one that answered. */
async function tryBackends(path, init) {
  for (let i = 0; i < API_BASES.length; i++) {
    const index = (preferred + i) % API_BASES.length;
    const base = API_BASES[index];
    const url = base.startsWith('http') ? `${base}/api${path}` : `${base}${path}`;
    try {
      const res = await fetch(url, init);
      if (isDown(res)) continue;
      preferred = index;
      return res;
    } catch {
      /* network error — try the next backend */
    }
  }
  return null;
}

/* Every call carries the session cookie; nothing here reads or stores a token. */
async function call(path, { method = 'GET', body } = {}) {
  const init = {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  };

  /* Only reads are retried; a write that timed out may still have landed. */
  const started = Date.now();
  let res = await tryBackends(path, init);
  while (!res && method === 'GET' && Date.now() - started < WAKE_WINDOW_MS) {
    await sleep(RETRY_DELAY_MS);
    res = await tryBackends(path, init);
  }
  if (!res) {
    const err = new Error('The server is waking up — please try again in a minute.');
    err.status = 503;
    throw err;
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: `Server returned ${res.status}` };
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  schedule: () => call('/schedule'),

  login: (email, password) => call('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => call('/auth/logout', { method: 'POST' }),
  me: () => call('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    call('/auth/password', { method: 'POST', body: { currentPassword, newPassword } }),

  config: () => call('/admin/config'),
  saveConfig: body => call('/admin/config', { method: 'PUT', body }),

  /* `when` is [{day, slots}] — one entry for a single session, every session
     on the batch when checking a hall. */
  availability: (when, excludeBatch) => {
    const q = when
      .filter(w => w.day && w.slots.length)
      .map(w => `when=${encodeURIComponent(`${w.day}:${[...w.slots].sort((a, b) => a - b).join(',')}`)}`);
    if (!q.length) return Promise.resolve({ when: [], trainers: [], venues: [] });
    if (excludeBatch) q.push(`excludeBatch=${excludeBatch}`);
    return call(`/admin/availability?${q.join('&')}`);
  },

  /* groups / trainers / venues / batches all share one CRUD shape */
  list:   kind => call(`/admin/${kind}`),
  create: (kind, body) => call(`/admin/${kind}`, { method: 'POST', body }),
  update: (kind, id, body) => call(`/admin/${kind}/${id}`, { method: 'PUT', body }),
  remove: (kind, id) => call(`/admin/${kind}/${id}`, { method: 'DELETE' }),

  reorderBatches: items =>
    Promise.all(items.map(item => call(`/admin/batches/${item.id || item._id}`, { method: 'PUT', body: { order: Number(item.order) || 0 } }))),
  reorderGroupBatches: (group, orderedIds) =>
    Promise.all(orderedIds.map((id, index) => call(`/admin/batches/${id}`, { method: 'PUT', body: { order: index } }))),

  /* what a trainer is doing during a period that isn't a class */
  setActivity: (payload, day, slot, kind, label) => {
    // support both legacy setActivity(trainer, day, slot, kind, label) and setActivity({ trainer, day, slots, kind, label })
    const body = typeof payload === 'object' && payload !== null && payload.trainer
      ? payload
      : { trainer: payload, day, slot, kind, label };
    return call('/admin/activities', { method: 'PUT', body });
  },
  clearActivity: (payload, day, slot) => {
    if (typeof payload === 'object' && payload !== null && payload.trainer) {
      const q = [`trainer=${encodeURIComponent(payload.trainer)}`];
      if (payload.day) q.push(`day=${encodeURIComponent(payload.day)}`);
      if (Array.isArray(payload.slots) && payload.slots.length) q.push(`slots=${payload.slots.join(',')}`);
      else if (payload.slot !== undefined) q.push(`slot=${payload.slot}`);
      return call(`/admin/activities?${q.join('&')}`, { method: 'DELETE' });
    }
    const q = [`trainer=${encodeURIComponent(payload)}`];
    if (day) q.push(`day=${encodeURIComponent(day)}`);
    if (slot !== undefined) q.push(`slot=${slot}`);
    return call(`/admin/activities?${q.join('&')}`, { method: 'DELETE' });
  },
};
