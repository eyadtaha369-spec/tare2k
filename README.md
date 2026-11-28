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

## Booking statuses, cancellations & refunds

| Status | Meaning | QR pass | In manifest |
|---|---|---|---|
| `pending` | Waiting for admin review | — | No |
| `approved` | Paid & confirmed | ✅ Valid | Yes |
| `rejected` | Transfer not accepted | — | No |
| `refund_requested` | Student cancelled from their pass page | ❌ "CANCELLED / REFUNDED – DO NOT BOARD" | No |
| `refunded` | Admin transferred the money back | ❌ Same | No |
| `no_show` | Approved but didn't board (marked by admin) | ❌ Invalid | No |

- Students can cancel from `/pass/<token>` until **6 hours before departure**, as long as they haven't boarded. The cutoff is checked on the server too.
- Admin → Requests → **Refunds** tab → **Process refund**: amount (defaults to the ticket price), optional reference and screenshot (saved in Drive), then a one-click WhatsApp confirmation.
- The finance bar at the top of Requests shows collected revenue, refunded total, net revenue and active seats for the selected trip.
- Ticket prices: `DEFAULT_FARE` (190 EGP) and `FARES` (Abu Hummus & Kafr El Dawar 180 EGP) in `lib/config.ts`. Each booking stores its price at booking time.

## Payments & group bookings

- **Payment methods:** Vodafone Cash / wallet, InstaPay (both need the sender number and a receipt screenshot), or **Cash on Bus / الدفع كاش في الباص** (no receipt; still needs admin approval).
- Cash seats show **"دفع في الباص (Cash)"** in Requests, Manifests and the PDF, and the scanner shows **"COLLECT X EGP CASH"** when the passenger boards. Cash counts as revenue once the passenger is scanned.
- Cancelling a cash seat from the pass page sets it to `cancelled` (nothing to refund).
- **Group bookings:** up to 10 passengers per submission, one receipt for the total. Each passenger becomes their own row (linked by `group_id`) with their own QR pass and WhatsApp button. Admins can **Approve group** in one click.


- **Requests → "Start New Week / تصفير وبدء أسبوع جديد"** archives every current booking in one batch (nothing is deleted). Requests, Manifests, the finance bar and seat counts reset to 0.
- **Archive / الأرشيف** shows each past week with collected / refunded / net totals, the full booking list, and CSV export (opens in Excel with Arabic).
- Archived passes no longer scan, and can't be cancelled.
- **Delete (حذف)** on any booking permanently removes the row and moves its receipt images to Drive trash.

## Security

- The browser never talks to Google directly: all reads/writes go through Next.js server routes, which call Apps Script with a shared secret.
- Receipts are stored privately in your Google Drive and streamed only to logged-in admins.
- Pass links use a 256-bit random token, so passes can't be guessed.
- Writes and check-ins run under an Apps Script lock, so a pass can only be scanned once.
- Duplicate requests (same phone + same trip) are blocked.
- Staff sessions are signed, HTTP-only cookies valid for 14 days.
