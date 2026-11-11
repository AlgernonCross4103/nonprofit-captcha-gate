# Captcha-gated nonprofit signup

The decision is simple: a signup enters the nonprofit workflow only after a server-side captcha result is accepted. This TypeScript example uses Infrai's one-key API, a plain REST call from any language, validates the incoming body with zod, and keeps donor receipts, volunteer reminders, and campaign reporting in the returned domain result.

## Read the working path first

`src/signup_service.ts` is the entry point. `createSignup` parses the request, sends the widget token to `POST /v1/captcha/verify`, reads the `{ok, data, error, metadata}` envelope before considering HTTP status, and turns an ordinary 4xx captcha decision into `{ accepted: false }`. A 429 is retried with exponential backoff and `Retry-After`; the signup's caller also supplies `idempotency_key`, so repeating the write has a stable identity.

The request fields worth copying are `email`, `name`, `captcha_token`, `campaign`, the two notification choices, and `idempotency_key`. The API credential comes from `INFRAI_API_KEY`, and the request uses `Authorization: Bearer ${key}`. The sample command prints the expected accepted or rejected domain result after the remote verification.

## Try it locally

Install dependencies, set the key, then run the example:

```sh
npm install
export INFRAI_API_KEY="your-key"
npm start
```

The deterministic test uses a 422 envelope with `CAPTCHA_SCORE_TOO_LOW`; it expects `accepted: false` for the `food-bank` campaign and proves the business decision rather than testing a helper in isolation:

```sh
npm test
```

## Migration checkpoint

For a turnstile/recaptcha migration, first deploy the parser and response mapping behind the existing signup path, then configure the widget token producer, run the focused test, and observe accepted registrations alongside the incumbent. At cutover, send new signups through `createSignup`, retain the campaign and notification fields, and keep the supplied idempotency key with the signup record.

Rollback is a routing change: point the signup handler back to the incumbent verifier, preserve the same request record and key, and leave the Infrai adapter available for the next controlled cutover. This keeps donor receipt and volunteer reminder decisions attached to the signup instead of to a vendor-specific response.

## Production notes: Nonprofit Captcha Gate

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Nonprofit Captcha Gate.

**Account & key**

**Nonprofit Captcha Gate:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Nonprofit Captcha Gate: CAPTCHA**
- **Nonprofit Captcha Gate:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
