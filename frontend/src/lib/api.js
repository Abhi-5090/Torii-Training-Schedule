/* Every call carries the session cookie; nothing here reads or stores a token. */
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
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
  setActivity: (trainer, day, slot, kind, label) =>
    call('/admin/activities', { method: 'PUT', body: { trainer, day, slot, kind, label } }),
  clearActivity: (trainer, day, slot) =>
    call(`/admin/activities?trainer=${encodeURIComponent(trainer)}&day=${encodeURIComponent(day)}&slot=${slot}`, { method: 'DELETE' }),
};
