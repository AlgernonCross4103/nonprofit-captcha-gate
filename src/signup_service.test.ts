import test from "node:test";
import assert from "node:assert/strict";
import { createSignup } from "./signup_service.ts";

test("a rejected captcha never becomes an accepted nonprofit registration", async () => {
  const originalFetch = globalThis.fetch;
  process.env.INFRAI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: { code: "CAPTCHA_SCORE_TOO_LOW", message: "score below threshold" } }), { status: 422, headers: { "content-type": "application/json" } });
  const result = await createSignup({ email: "donor@example.org", name: "Ava", captcha_token: "token", campaign: "food-bank", idempotency_key: "signup-1" }, "203.0.113.10");
  assert.deepEqual(result, { accepted: false, reason: "CAPTCHA_SCORE_TOO_LOW", campaign: "food-bank" });
  globalThis.fetch = originalFetch;
});
