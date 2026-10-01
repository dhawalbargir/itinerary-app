# Itinerary

Drop in tickets, boarding passes, e-ticket PDFs and hotel or car confirmations. Each file is read by an OpenAI vision model and placed on a day-by-day timeline in local time. Every flight shows how the same flight number performed on recent days.

Built with Next.js 15, Neon Postgres (Drizzle), Vercel Blob, the OpenAI API and AeroDataBox.

## Deploy to Vercel (about 15 minutes)

1. **Push to GitHub.** Create an empty repository, then from this folder:
   ```bash
   git init && git add . && git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/itinerary-app.git
   git push -u origin main
   ```
2. **Import into Vercel.** Vercel → Add New → Project → pick the repo. Next.js is detected automatically. The first deploy will fail until steps 3 and 4 are done; that's expected.
3. **Add storage.** In the project, open **Storage**:
   - **Create Database → Neon** (Postgres). This adds `DATABASE_URL`.
   - **Create → Blob**. This adds `BLOB_READ_WRITE_TOKEN`.
4. **Add environment variables** (Settings → Environment Variables, all environments):

   | Name | Value |
   | --- | --- |
   | `APP_PASSWORD` | The password you'll sign in with |
   | `AUTH_SECRET` | A long random string: `openssl rand -base64 32` |
   | `OPENAI_API_KEY` | From platform.openai.com → API keys (add billing credit) |
   | `OPENAI_MODEL` | Optional. Defaults to `gpt-5-mini`; any vision model that accepts PDFs works |
   | `AERODATABOX_API_KEY` | Optional. Your RapidAPI key for AeroDataBox; flight history is off without it |
   | `AERODATABOX_HOST` | Optional. Defaults to `aerodatabox.p.rapidapi.com` |
   | `FLIGHT_CALLS_PER_DAY` | Optional. Daily cap on flight-data calls, default `200` |
   | `DEFAULT_TZ` | Optional. Fallback zone, default `Asia/Kolkata` |

5. **Deploy** (Deployments → Redeploy). The build runs `vercel-build`, which applies database migrations first, then builds. Open the URL and sign in.

Every push to `main` now deploys automatically, and pull requests get preview URLs. GitHub Actions runs type checks, tests and a build on each push.

## Run locally

```bash
npm install
cp .env.example .env.local     # fill in values, or: vercel env pull .env.local
npm run db:migrate
npm run dev                    # http://localhost:3000
```

## How it works

- **Upload:** the browser converts HEIC photos to JPEG, shrinks images to 2000 px, hashes each file to skip duplicates, and uploads straight to Vercel Blob (`app/api/upload`).
- **Reading:** `POST /api/documents` registers the file and runs `lib/extraction/process.ts` in the background with Next's `after()`. The OpenAI Responses API returns items through a forced function call, validated with Zod, with one retry on bad output.
- **Time:** the model returns local wall-clock times. Flights get zones from the bundled airport list (`data/airports.json`); other items use the model's zone hint, then `DEFAULT_TZ`. Everything is stored in UTC with its zone.
- **Timeline:** `lib/timeline.ts` sorts, groups by local day, adds layovers, tight-connection and overlap warnings, "+1" arrivals and hotel stays.
- **Edits stick:** fields you change are recorded, and "Read document again" never overwrites them.
- **Flight track record:** `lib/flights/` fetches the same flight number for the last 7 or 14 days (matched on departure airport; the operating flight for codeshares), caches finished days permanently and live status for 5 minutes, and enforces a daily call cap. Card badges only use cached data, so browsing never spends API calls.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm test` | Unit tests (time zones, sorting, flight history) |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | New migration after editing `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |

## Notes and limits

- Single owner: sign-in is one password. Share links give others read-only access.
- Uploaded files live at unguessable random URLs on Vercel Blob but are not behind sign-in.
- Documents are sent to the OpenAI API to be read.
- Flight data quality depends on AeroDataBox coverage for the airline and route.
