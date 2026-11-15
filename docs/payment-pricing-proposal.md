# Paystack launch offer proposal

## Approved first release offer

- **Free trials:** one successful AI rewrite and one PDF or DOCX export per
  account. These are account-level trial uses, rather than a time period.
- **Export unlock:** **₦1,500 once** for unlimited PDF and DOCX exports.
- **AI Premium:** **₦3,000/month** for additional AI assistance, with a limit
  of 20 requests per minute while subscribed.
- The AI monthly checkout uses a Paystack subscription plan code configured in
  the secret environment. Users can cancel through the app; access continues
  through the recorded paid period.

These are the prices selected by the product owner. Review conversion and AI
provider costs after early usage; do not enable sales until the Paystack plan is
set up in test mode and each flow is verified.

## Payment safety

The amount must be set on the server, stored with the unique payment reference,
and checked against the Paystack verification response before Premium is
granted. Webhook requests must be authenticated and processed idempotently.
The app must never accept the amount or account ID to unlock from the browser.
The app verifies payment status, reference, exact server-side amount, currency,
user ID, and product before granting features. Webhooks are HMAC checked and
transaction references are idempotent. Live Paystack keys belong only in
production secret settings.

## Still to confirm

- Create and configure a ₦3,000 monthly Paystack plan; set its plan code as
  `PAYSTACK_AI_PLAN_CODE` and confirm its currency/amount match the app.
- Add Paystack test credentials to the local secret file without sharing them
  in chat. Configure webhook `/api/billing/webhook` in the Paystack dashboard.
- AI checkout has a default-off `PAYSTACK_AI_BILLING_ENABLED` switch. Keep it
  false until the AI provider is reliably configured and tested, the plan is
  verified at ₦3,000/month, and renewal/cancellation webhooks are confirmed.
- Configure live keys and webhook only in production secret settings after test
  payments, renewal, cancellation, refund, and failure paths are reviewed.
- Publish the renewal, cancellation, refund, and privacy contact terms before
  enabling live checkout.
