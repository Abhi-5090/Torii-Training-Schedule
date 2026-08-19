# Torii · NCET Training Schedule

The weekly schedule board, split into a React frontend and a Node/Express + MongoDB
backend. The board itself is public; creating and changing the schedule is done by the
admin, behind a login.

```
Torii Schedule/
├── Torii Schedule.html     the original single-file board, kept as the design reference
├── frontend/               React + Vite      → the public board and the admin console
└── backend/                Node + Express    → the API and MongoDB
```

## Running it

Two terminals. Backend first — the frontend proxies `/api` to it.

```bash
# terminal 1
cd backend
npm install
npm run seed        # loads the current schedule into MongoDB (safe to re-run)
npm run dev         # http://localhost:4000

# terminal 2
cd frontend
npm install
npm run dev         # http://localhost:5180
```

Port 5180 rather than Vite's usual 5173, because 5173–5175 are taken by the other
projects on this machine.

| URL | What it is |
| --- | --- |
| `http://localhost:5180/` | the board — public, no login |
| `http://localhost:5180/?view=trainer` | deep link to the trainer view |
| `http://localhost:5180/admin` | the console — redirects to login if not signed in |

## Configuration

`backend/.env` holds the MongoDB URI, the cookie signing key, and the admin account.
It is gitignored; `backend/.env.example` is the template.

```
MONGODB_URI=…            your Atlas connection string
JWT_SECRET=…             random; rotating it signs the admin out
ADMIN_EMAIL=…            hashed into MongoDB on first boot
ADMIN_PASSWORD=…         change this before going live
PORT=4000
CLIENT_ORIGIN=http://localhost:5180
```

The admin account is created on the first boot that finds no matching email. After that
the seeded password is ignored, so a password changed from the Settings tab sticks.

## How the data is shaped

**Batch sessions are the only thing stored.** A session is one class, on one day, over
one or more periods, with its main and support mentors. Everything else on the board is
calculated from them on every request:

- each trainer's free/occupied timetable, and whether they were main or support
- each hall's occupancy
- the collapsed card rows (`Monday – Wednesday` instead of three separate lines)
- double-bookings, surfaced on the dashboard

That is why the three views can never disagree with each other, and why assigning a
mentor in the console shows up on the board with no second step.

Periods are referred to **by number**, not by time. `Slot 1–2` means the first two rows
of the period grid; what those rows actually say is set under *Time Slots & Days*. Lunch
is a break for everyone unless a class is explicitly booked over it — First Year's
slot 3–4 sessions run 11:00 AM – 12:50 PM and do exactly that.

## API

Public:

| | |
| --- | --- |
| `GET /api/schedule` | the whole derived board |
| `GET /api/health` | liveness |

Auth (`POST /api/auth/login` sets an httpOnly cookie):

`POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/password`

Admin — all require the session cookie:

| | |
| --- | --- |
| `GET PUT /api/admin/config` | the period grid |
| `/api/admin/groups` | year groups — full CRUD |
| `/api/admin/trainers` | trainers — full CRUD |
| `/api/admin/venues` | halls — full CRUD |
| `/api/admin/batches` | batches and their sessions — full CRUD |
| `GET /api/admin/availability?day=&slots=` | who and what is free at a given time |

Renames cascade: renaming a trainer, hall, or year group rewrites every session and batch
that referred to it by name, so nothing is orphaned.

## Notes

- `frontend/src/styles/torii.css` is the original stylesheet, unchanged. Everything new
  is in `console.css`, built from the same tokens.
- The theme reveal — the circle that wipes across on light/dark — is ported as-is in
  `frontend/src/lib/theme.js`.
- `npm run seed -- --fresh` wipes the schedule collections before loading. The admin
  account is never touched by the seed.
