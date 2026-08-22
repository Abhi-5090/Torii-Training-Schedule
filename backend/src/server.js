import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { connectDB } from './db.js';
import Admin from './models/Admin.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import scheduleRoutes from './routes/schedule.js';

const clientOrigin = process.env.CLIENT_ORIGIN;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!clientOrigin || clientOrigin === '*' || origin === clientOrigin || origin.endsWith('.vercel.app') || origin.includes('localhost') || origin.includes('toriiminds.com')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/schedule', scheduleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use((_req, res) => res.status(404).json({ error: 'No such endpoint' }));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  /* Mongo's duplicate-key error is a user mistake, not a server fault. */
  if (err.code === 11000) {
    return res.status(409).json({ error: `That ${Object.keys(err.keyPattern || {})[0] || 'value'} is already taken` });
  }
  res.status(status).json({ error: err.message || 'Something went wrong' });
});

/* The single admin account lives in .env and is hashed into Mongo on first
   boot. Later boots leave it alone, so a password changed in the UI sticks. */
async function ensureAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('  admin   ADMIN_EMAIL / ADMIN_PASSWORD not set — no account seeded');
    return;
  }
  if (await Admin.findOne({ email })) {
    console.log('  admin  ', email, '(existing)');
    return;
  }
  await Admin.create({ email, passwordHash: await Admin.hash(password) });
  console.log('  admin  ', email, '(created)');
}

const PORT = process.env.PORT || 4000;

connectDB()
  .then(ensureAdmin)
  .then(() => app.listen(PORT, () => {
    console.log(`  api     http://localhost:${PORT}\n`);
  }))
  .catch(err => { console.error(err); process.exit(1); });

export default app;
