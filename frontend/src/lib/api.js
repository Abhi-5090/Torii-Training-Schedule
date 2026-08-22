const RAW_API_URL = import.meta.env.VITE_API_URL || 'https://torii-schedule-api.onrender.com';
const API_BASE = RAW_API_URL.replace(/\/+$/, '');

/* Every call carries the session cookie; nothing here reads or stores a token. */
async function call(path, { method = 'GET', body } = {}) {
  const url = API_BASE.startsWith('http') ? `${API_BASE}/api${path}` : `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

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
