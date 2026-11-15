# Forme privacy and data-handling launch checklist

This is an engineering inventory, not a legal opinion. Finish the open business
and retention details with a qualified privacy professional before opening
Forme to the public.

## Current data flows

| Data | Why it is processed | Current location or recipient | User control |
| --- | --- | --- | --- |
| Account name, email, password hash, Google account identifier | Sign-in and account operation | Forme database on Hostless; Google for Google sign-in | Download account data or delete account |
| Resume content and saved versions | Edit, save, restore, export, and share a resume | Browser local storage and the Hostless database for signed-in users | Edit, export, turn off share link, delete account |
| Imported PDF/DOCX text | Extract fields into a draft | Processed in application memory; original upload is not persisted by the import route | Review before adding; cancel import |
| Text selected for AI assistance | Return an optional rewrite | Sent to Google Gemini only after the consent checkbox; Gemini API free-tier prompts and responses may be used to improve Google products | Do not consent or do not use AI |
| Public resume link content | Display a resume to link holders | Public route while its token remains active | Revoke link or delete account |
| Payment data | Checkout, receipts, and entitlement decisions | Paystack; Forme stores transaction references, amount/status and an encrypted subscription management token, never full card details | Cancel AI subscription in the app; deletion removes the account-linked records |

## Controls in the codebase

- Account/resume deletion is available and has database cascading deletes.
- Authenticated users can download a JSON export containing server records and
  the local browser draft.
- AI requests require an explicit per-request consent checkbox.
- Imported files have type and size checks and are not retained by that route.
- Public share links can be revoked.
- A Backblaze B2-compatible encrypted off-site backup job and 30-day lifecycle
  rule example are prepared in `ops/database-backup/`; bucket, secrets, schedule,
  and restore drill still need activation.
- Paystack checkout, verification, signed webhooks, one-time export unlock,
  monthly AI subscription, and cancellation routes are implemented. Test/live
  credentials and the configured monthly plan are still required.

## Required before public launch

- Forme is the product/service operator. Confirm the legal entity name and
  business address if the service is run by a registered entity, plus a
  monitored privacy contact.
- Have the privacy notice, terms, lawful bases, cross-border transfer details,
  controller/processor roles, and any NDPC registration/DPO obligations reviewed
  for the actual business and audience.
- Confirm 30-day backup retention and configure B2 lifecycle deletion to match.
  Document how backup deletion requests are handled and the maximum backup
  expiry delay.
- Confirm each provider's current data-processing terms and storage region:
  Hostless, Google/Gemini, and Paystack. In particular, confirm that Gemini's
  free-tier data use and rate limits are acceptable for the public service.
- Add a monitored privacy contact and a process for access, correction,
  objection, erasure, portability, complaints, and security incidents.
- Verify deletion and data export with an account that has multiple resumes,
  versions, and an active public share link.
- Create a written restore runbook and perform a restore drill into a separate
  database before relying on backups.
- Confirm Paystack pricing, currency, paid features, refund/cancellation terms,
  receipts, monthly plan settings, and webhook signing secret before enabling
  live charges.

## Open configuration

- `NEXT_PUBLIC_PRIVACY_EMAIL` is intentionally empty until the operator chooses
  a monitored address.
- Paystack test/live keys and monthly plan code are
  intentionally empty. Configure them in the relevant environment secret
  manager, never in source control. `GEMINI_API_KEY` is also required for AI;
  AI billing remains default-off until Gemini is configured and verified.
- Backup object-storage credentials and the `age` decryption identity are not
  present in the web application's environment.
