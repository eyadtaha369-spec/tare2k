# TARE2K — YOUR WAY TO ALAMEIN

Student bus booking system: Damanhour · Itay El Barud – Abu Hummus · Delengat ⇄ Alamein International University (AIU).

**Stack:** Next.js 15 (App Router) · Tailwind CSS · Supabase (DB, Auth, Storage) · qrcode.react · html5-qrcode · jsPDF + html2canvas

## Setup (about 10 minutes)

1. **Supabase**
   - Create a project → SQL Editor → paste and run `supabase/schema.sql` (it creates the tables and the private `receipts` bucket).
   - Authentication → Users → **Add user** (email + password) for yourself and each supervisor.
   - Make yourself admin (SQL Editor):
     ```sql
     insert into public.staff (user_id, full_name, role)
     select id, 'Safwat', 'admin' from auth.users where email = 'you@example.com';
     ```
     Supervisors: same query with `'supervisor'`.

2. **Environment** — copy `.env.example` → `.env.local` and fill in values from Supabase → Project Settings → API. Add the same 4 variables in Vercel → Project → Settings → Environment Variables.

3. **Business details** — edit `lib/config.ts`:
   - Pickup spots for each area (currently placeholders)
   - Vodafone Cash number, InstaPay address, optional fare
   - Support WhatsApp number, departure times

4. **Run**
   ```bash
   npm install
   npm run dev       # http://localhost:3000
   ```
   Deploy: push to GitHub → import in Vercel.

> Note: Use TypeScript 5 (already pinned). TypeScript 7 breaks Next.js `@/` path aliases.

## Pages

| Route | Who | What |
|---|---|---|
| `/` | Public | Brand, live trip status, routes & stops, how it works |
| `/book` | Public | Booking form with time-window lock, cascading area/spot, receipt upload |
| `/pass/[token]` | Student | Boarding pass with QR (only for approved bookings) |
| `/admin/requests` | Admin | Pending queue, receipt lightbox, Approve / Reject / Undo, one-click WhatsApp |
| `/admin/manifest` | Admin + Supervisor | Approved passengers by area → stop, seat counts, PDF export (كشف ركاب) |
| `/admin/scanner` | Admin + Supervisor | Camera QR scanner — Boarded / Already used / Wrong trip / Invalid |
| `/admin/trips` | Admin | Force-open / force-close any upcoming trip, or leave on automatic |

## Booking windows (Africa/Cairo time, DST-aware)

| Trip | Opens | Closes |
|---|---|---|
| Saturday (to Alamein) | Wed 6:00 PM | Fri 6:00 PM |
| Sunday (to Alamein) | Wed 6:00 PM | Sat 6:00 PM |
| Wednesday (return) | Sun 6:00 PM | Tue 6:00 PM |
| Thursday (return) | Sun 6:00 PM | Wed 6:00 PM |

Enforced both in the UI and on the server (`/api/bookings`), so a closed trip can't be booked even with a direct request. Logic: `lib/trips.ts`.

## Security

- All tables have RLS on with no public policies; every read/write goes through server routes using the service-role key after checking the `staff` table.
- Receipts sit in a **private** bucket and are shown to admins via 1-hour signed URLs.
- Pass links use a 256-bit random token (not the booking ID), so passes can't be guessed.
- Check-in is atomic: a pass can only be scanned once.
- Duplicate requests (same phone + same trip) are blocked.
