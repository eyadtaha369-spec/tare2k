# TARE2K — YOUR WAY TO ALAMEIN

Student bus booking system: Delengat · Itay El Barud · Damanhour · Abu Hummus · Kafr El Dawar ⇄ Alamein International University (AIU).

**Stack:** Next.js 15 (App Router) · Tailwind CSS · Google Sheets + Apps Script (database) · Google Drive (receipts) · qrcode.react · html5-qrcode · jsPDF + html2canvas

## Setup

1. **Google Sheet + Apps Script**
   - Create a new Google Sheet (e.g. "TARE2K Bookings") → **Extensions → Apps Script**.
   - Delete the sample code, paste everything from `apps-script/Code.gs`, save.
   - **Project Settings (⚙️) → Script properties → Add**: `SECRET` = the same value as `APPS_SCRIPT_SECRET` in Vercel.
   - Back in the editor, choose the `setup` function → **Run** → accept the permissions. This creates the `Bookings` and `Overrides` tabs and a Drive folder "TARE2K Receipts".
   - **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → Deploy → copy the `/exec` URL.
   - After any later change to the script: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (the URL stays the same).

2. **Vercel environment variables** (see `.env.example`): `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET`, `ADMIN_PASSWORD` (optional `ADMIN_USERNAME`, default `admin`), `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`. Redeploy after changing them.

3. **Business details** — edit `lib/config.ts`: pickup spots, Vodafone Cash number, InstaPay address, optional fare, support WhatsApp, departure times.

4. **Run locally**
   ```bash
   npm install
   npm run dev
   ```

> Use TypeScript 5 (already pinned). TypeScript 7 breaks Next.js `@/` path aliases.

## Staff login & roles

Login page: `/admin/login` (username + password).

| Role | How to log in | Access |
|---|---|---|
| **Admin** | username `admin` + `ADMIN_PASSWORD` (Vercel env) | Everything: Requests, Manifests & PDF, Scanner, Trips, Supervisors |
| **Supervisor** | account created by the admin in **Supervisors / المشرفين** | **Scanner only** (`/admin/scan`) |

- Supervisors are stored in the **Users** tab of the Google Sheet. Passwords are saved as scrypt hashes, never plain text.
- Any other admin URL a supervisor opens redirects to `/admin/scan`; admin APIs return 403 (enforced in `middleware.ts` and again in each page/route).
- Deactivating or deleting a supervisor takes effect immediately: their next page load or scan signs them out.
- Supervisor sessions last 16 hours; admin sessions 14 days.

## Pages

| Route | Who | What |
|---|---|---|
| `/` | Public | Brand, live trip status, routes & stops, how it works |
| `/book` | Public | Booking form with time-window lock, cascading area/spot, receipt upload |
| `/pass/[token]` | Student | Boarding pass with QR (only for approved bookings) |
| `/admin/requests` | Admin | Pending queue, receipt lightbox, Approve / Reject / Undo, one-click WhatsApp |
| `/admin/manifest` | Admin | Approved passengers by area → stop, seat counts, PDF export (كشف ركاب) |
| `/admin/scan` | Admin + Supervisor | Camera QR scanner — Boarded / Already used / Wrong trip / Invalid |
| `/admin/trips` | Admin | Force-open / force-close any upcoming trip, or leave on automatic |
| `/admin/supervisors` | Admin | Create, activate/deactivate and delete supervisor accounts |

You can also see and edit everything directly in the Google Sheet.

## Booking windows (Africa/Cairo time, DST-aware)

| Trip | Opens | Closes |
|---|---|---|
| Saturday (to Alamein) | Wed 6:00 PM | Fri 6:00 PM |
| Sunday (to Alamein) | Wed 6:00 PM | Sat 6:00 PM |
| Wednesday (return) | Sun 6:00 PM | Tue 6:00 PM |
| Thursday (return) | Sun 6:00 PM | Wed 6:00 PM |

Enforced both in the UI and on the server (`/api/bookings`), so a closed trip can't be booked even with a direct request. Logic: `lib/trips.ts`.

## Security

- The browser never talks to Google directly: all reads/writes go through Next.js server routes, which call Apps Script with a shared secret.
- Receipts are stored privately in your Google Drive and streamed only to logged-in admins.
- Pass links use a 256-bit random token, so passes can't be guessed.
- Writes and check-ins run under an Apps Script lock, so a pass can only be scanned once.
- Duplicate requests (same phone + same trip) are blocked.
- Staff sessions are signed, HTTP-only cookies valid for 14 days.
