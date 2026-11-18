# Forme — AI resume builder

A Next.js and TypeScript resume builder built from the requirements in the supplied PDF. The current editor includes the MVP workflow and several Phase 2 tools.

## Included

- Structured resume editor with a live, ATS-friendly preview and print-to-PDF export.
- Browser autosave, multiple local resume versions, restore, editable templates and section ordering.
- PDF and DOCX text import with file size and file type checks.
- Consent-gated AI rewriting endpoint. Suggestions use structured JSON, Zod validation, short-term rate limiting and a strict no-invention instruction. Original text changes only after the user selects a suggestion.
- Job-description keyword comparison, fact-preserving bullet suggestions, cover-letter drafting, plain-text and DOCX export, drag ordering for experience entries, version checkpoints, and revocable public links.
- Postgres and Prisma models for user accounts, resumes and resume versions; Auth.js credential and Google providers; authenticated resume APIs, account deletion, privacy notice, and account data export.
- Paystack checkout offers: one PDF/DOCX export trial then ₦1,500 one-time unlimited exports, and one successful AI rewrite trial then ₦3,000/month AI subscription (20 requests per minute). Server-side payment verification, HMAC-verified webhook handling, and subscription cancellation are included. The test secret was validated and the ₦3,000 monthly test plan is configured locally; the checkout, webhook, renewal, and cancellation flows still need end-to-end testing against the deployed test endpoint before any live payments.
- Encrypted PostgreSQL backups prepared for Backblaze B2, with a 30-day lifecycle rule; B2 credentials, Hostless scheduling, and restore drill are not activated yet.

## Run locally

1. Install Node.js 20.19 or newer, then run `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and `AUTH_SECRET`.
3. Configure a PostgreSQL database and run `npm run db:generate`, then `npm run db:push`.
4. Set Google OAuth credentials for Google sign-in. Create a Gemini API key in Google AI Studio and set `GEMINI_API_KEY` to enable AI suggestions. The default model is `gemini-3.5-flash-lite` and can be changed with `GEMINI_MODEL`.
5. Install and start Docker Desktop. Set `CLAMAV_HOST=127.0.0.1` and `CLAMAV_PORT=3310` in `.env.local`, then run `docker compose -f compose.clamav.yaml up -d`. The first start downloads ClamAV and its virus definitions; wait until the container is healthy. The TCP port is bound to loopback for local use only. Resume imports fail closed when the scanner is unavailable.
6. Run `npm run dev` and open `http://localhost:3000`.

The editor can be explored with sample content and local browser autosave. Account sync and sign-in require the database and Auth.js settings; AI suggestions also need the Gemini API key. Document import validates type and size, scans through ClamAV, then processes files in memory without storing the original upload. The AI route only receives text after the user checks the consent box. Gemini's free tier may use prompts and responses to improve Google products and has usage limits that can change; confirm its current terms and suitability before public launch. Set `AUTH_TRUST_HOST` only when the app is behind a host you control.

## Delivery sequence

The MVP foundation is in place: structured editing, fact-only AI suggestions, selectable-text PDF export, file import, autosave, accounts, and ATS-focused templates. Phase 2 includes job matching and edits, cover-letter drafts, DOCX and plain-text export, entry ordering, version restore, and public share links. Paystack test credentials and the monthly test plan are configured in the local ignored `.env.local`; checkout still needs deployed end-to-end verification, and separate live-mode configuration must wait until launch approval. AI checkout stays disabled by default in `.env.example`.

The local ClamAV Compose service is for local development only. For production, deploy the scanner gateway as an HTTPS service and keep ClamAV on its private container network. Set `CLAMAV_SCAN_URL` to the gateway's HTTPS `/scan` URL and `CLAMAV_SCAN_TOKEN` as a secret in Vercel and the gateway. Never expose ClamAV's unauthenticated TCP port directly to the public internet. The production scanner still needs a host and deployment credentials before it can be reachable.

## Production follow-up

AI responses stream from Gemini. Subscriber limits use atomic per-user PostgreSQL minute windows, and identical requests reuse a five-minute in-memory cache on warm app instances. Cached resume-derived suggestions are not written to the database. Apply the updated Prisma schema before using AI (`npm run db:generate`, then `npm run db:push`). Resume imports fail closed unless the configured scanner is reachable through `CLAMAV_SCAN_URL` or the private `CLAMAV_HOST`/`CLAMAV_PORT` socket. Configure secure deployment secrets, backup storage and retention, account recovery, and the privacy launch checklist in `docs/privacy-and-data-handling.md`. The privacy notice still needs the operator's legal identity/contact, actual provider regions, and confirmed retention terms before public launch. PDF accessibility depends on the browser print engine; verify exported files with assistive technology and ATS tools.
