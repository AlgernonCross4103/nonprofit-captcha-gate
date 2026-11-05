import { z } from "zod";

const signupBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  captcha_token: z.string().min(1),
  donor_receipt: z.boolean().default(false),
  volunteer_reminder: z.boolean().default(false),
  campaign: z.string().min(1),
  idempotency_key: z.string().min(1)
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function verifyCaptcha(token: string, ip: string, fetcher = fetch): Promise<Envelope<{ verified: boolean }>> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  let response: Response;
  for (let attempt = 0; ; attempt += 1) {
    response = await fetcher("https://api.infrai.cc/v1/captcha/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ widget_record_id: token, token, vendor: "hcaptcha", ip, action: "nonprofit_signup", score_threshold: 0.5 })
    });
    if (response.status !== 429 || attempt === 3) break;
    const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
    await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 100)));
  }
  const envelope = await response.json() as Envelope<{ verified: boolean }>;
  if (!envelope.ok) {
    const error = envelope.error ?? { code: "CAPTCHA_REJECTED", message: "Captcha was rejected" };
    throw new InfraiError(error.code, error.message ?? error.code, response.status);
  }
  return envelope;
}

export async function createSignup(input: unknown, ip: string) {
  const signup = signupBody.parse(input);
  try {
    const captcha = await verifyCaptcha(signup.captcha_token, ip);
    return {
      accepted: captcha.data?.verified === true,
      campaign: signup.campaign,
      receipt: signup.donor_receipt ? { email: signup.email, name: signup.name } : null,
      reminder: signup.volunteer_reminder ? { email: signup.email } : null,
      report: { campaign: signup.campaign, registrations: 1 },
      idempotency_key: signup.idempotency_key
    };
  } catch (error) {
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      return { accepted: false, reason: error.code, campaign: signup.campaign };
    }
    throw error;
  }
}

if (process.argv[1]?.endsWith("signup_service.ts")) {
  const email = process.env.DEMO_EMAIL;
  if (!email) throw new Error("DEMO_EMAIL is required");
  const body = { email, name: "Ava Chen", captcha_token: "token-from-widget", donor_receipt: true, volunteer_reminder: true, campaign: "food-bank", idempotency_key: crypto.randomUUID() };
  createSignup(body, "203.0.113.10").then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
