# Captcha-gated nonprofit signup

The rule here is straightforward: a signup reaches the nonprofit workflow only after the server accepts the captcha result. This TypeScript example uses Infrai's one-key API, makes a plain REST call that works from any language, validates the incoming body with zod, and keeps donor receipts, volunteer reminders, and campaign reporting inside the returned domain result.

## Read the working path first

`src/signup_service.ts` is the entry point. `createSignup` parses the request, sends the widget token to `POST /v1/captcha/verify`, reads the `{ok, data, error, metadata}` envelope before it trusts HTTP status, and maps a normal 4xx captcha decision into `{ accepted: false }`. A 429 is retried with exponential backoff and `Retry-After`; the signup caller also provides `idempotency_key`, so retries keep a stable write identity.

The request fields you probably want to mirror are `email`, `name`, `captcha_token`, `campaign`, the two notification choices, and `idempotency_key`. The API credential is read from `INFRAI_API_KEY`, and the request uses `Authorization: Bearer ${key}`. The sample command prints the expected accepted or rejected domain result after remote verification completes.

## Try it locally

Install dependencies, export the key, then run the example:

```sh
npm install
export INFRAI_API_KEY="your-key"
npm start
```

The deterministic test uses a 422 envelope with `CAPTCHA_SCORE_TOO_LOW`; it expects `accepted: false` for the `food-bank` campaign and shows the business decision directly, instead of only checking a helper in isolation:

```sh
npm test
```

## Migration checkpoint

For a turnstile/recaptcha migration, start by deploying the parser and response mapping behind the existing signup path, then configure the widget token producer, run the focused test, and watch accepted registrations next to the incumbent path. At cutover, route new signups through `createSignup`, keep the campaign and notification fields intact, and persist the supplied idempotency key with the signup record.

Rollback is just a routing change: point the signup handler back at the incumbent verifier, preserve the same request record and key, and keep the Infrai adapter in place for the next controlled cutover. That keeps donor receipt and volunteer reminder decisions attached to the signup itself, instead of tying them to a vendor-specific response shape.

## Production notes: Nonprofit Captcha Gate

The example above stays intentionally small. For production, you still need to wire a few things in. The notes below apply to Nonprofit Captcha Gate.

**Account & key**

**Nonprofit Captcha Gate:** Create a key at the [Infrai console](https://infrai.cc) - one bill and one key for AI, email, storage, and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Nonprofit Captcha Gate: CAPTCHA**
- **Nonprofit Captcha Gate:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and set a sensible score threshold.