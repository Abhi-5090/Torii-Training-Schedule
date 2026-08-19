import { Router } from 'express';
import Admin from '../models/Admin.js';
import { signToken, cookieOptions, requireAdmin, COOKIE } from '../middleware/auth.js';
import { wrap } from '../middleware/asyncRoute.js';

const router = Router();

/* A fixed floor on how long a failed login takes, so the response time cannot
   be used to tell "no such account" apart from "wrong password". */
const SLOW = 350;
const settle = async (started) => {
  const left = SLOW - (Date.now() - started);
  if (left > 0) await new Promise(r => setTimeout(r, left));
};

router.post('/login', wrap(async (req, res) => {
  const started = Date.now();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    await settle(started);
    return res.status(400).json({ error: 'Email and password are both required' });
  }

  const admin = await Admin.findOne({ email });
  const ok = admin ? await admin.verify(password) : false;
  await settle(started);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });

  res.cookie(COOKIE, signToken(admin), cookieOptions());
  res.json({ admin: { email: admin.email, name: admin.name } });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

/* The client calls this on boot to find out whether it already has a session. */
router.get('/me', requireAdmin, wrap(async (req, res) => {
  const admin = await Admin.findById(req.admin.sub).lean();
  if (!admin) return res.status(401).json({ error: 'Account no longer exists' });
  res.json({ admin: { email: admin.email, name: admin.name } });
}));

router.post('/password', requireAdmin, wrap(async (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');

  if (next.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const admin = await Admin.findById(req.admin.sub);
  if (!admin) return res.status(401).json({ error: 'Account no longer exists' });
  if (!(await admin.verify(current))) return res.status(401).json({ error: 'Current password is incorrect' });

  admin.passwordHash = await Admin.hash(next);
  await admin.save();

  /* Force a fresh sign-in so any other open session dies with the old password. */
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true, reauth: true });
}));

export default router;
