import jwt from 'jsonwebtoken';

export const COOKIE = 'torii_token';

export function signToken(admin) {
  return jwt.sign(
    { sub: String(admin._id), email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: '12h' },
  );
}

/* Sent as an httpOnly cookie so no token ever touches client-side JS.
   sameSite 'lax' keeps it working across the Vite dev proxy. */
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  };
}

export function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired — please sign in again' });
  }
}
