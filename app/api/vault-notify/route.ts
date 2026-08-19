import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { randomInt, timingSafeEqual } from "crypto";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { getAuthUser } from "@/lib/apiAuth";

// Lazy + memoised — see app/api/chat/route.ts.
let _resend: Resend | null = null;
function resend() {
  return (_resend ??= new Resend(process.env.RESEND_API_KEY));
}

const MAX_OTP_LEN = 10;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// OTP store — expires after 10 minutes, max 5 verify attempts before lockout
const otpStore = new Map<string, { otp: string; expires: number; attempts: number }>();

/**
 * Drop every expired OTP. Without this the Map only ever shrank on a successful
 * verify, so abandoned requests left live secrets sitting in memory for the
 * lifetime of the instance and the Map grew once per distinct email. Purging on
 * write keeps expired material out of a heap dump and bounds the size.
 */
function purgeExpiredOtps(now: number) {
  for (const [key, record] of otpStore) {
    if (now > record.expires) otpStore.delete(key);
  }
}

export async function POST(req: NextRequest) {
  // ── Auth ──
  const auth = req.headers.get("authorization");
  const user = await getAuthUser(auth);
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Emails only ever go to the verified account owner — never a
  // client-supplied address (prevents using this route as a mail relay)
  const email = user.email;

  // ── Rate limit: 5 requests / 10 minutes per IP, and per user ──
  if (
    !rateLimit(`vault:${clientKey(req)}`, 5, 10 * 60_000) ||
    !rateLimit(`vault:u:${user.id}`, 5, 10 * 60_000)
  ) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  // A malformed body must fail as a controlled 400, not as a thrown parse error
  // that escapes the handler and becomes an uncontrolled 500 (§1.7).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { type, otp: submittedOtp } = (body ?? {}) as {
    type?: unknown;
    otp?: unknown;
  };

  const ALLOWED_TYPES = new Set(["verify", "pin_change_request", "setup", "changed"]);
  if (typeof type !== "string" || !ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  purgeExpiredOtps(Date.now());

  // ── VERIFY OTP ──
  if (type === "verify") {
    if (typeof submittedOtp !== "string" || submittedOtp.length > MAX_OTP_LEN) {
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }
    const record = otpStore.get(email);
    if (!record) {
      return NextResponse.json(
        { error: "No OTP found. Request a new one." },
        { status: 400 },
      );
    }
    if (Date.now() > record.expires) {
      otpStore.delete(email);
      return NextResponse.json(
        { error: "OTP expired. Request a new one." },
        { status: 400 },
      );
    }
    // Brute-force lockout after 5 wrong attempts
    if (record.attempts >= 5) {
      otpStore.delete(email);
      return NextResponse.json(
        { error: "Too many attempts. Request a new code." },
        { status: 429 },
      );
    }
    if (!safeEqual(record.otp, submittedOtp)) {
      record.attempts += 1;
      return NextResponse.json({ error: "Wrong code." }, { status: 400 });
    }
    otpStore.delete(email); // one-time use
    return NextResponse.json({ ok: true });
  }

  // ── SEND OTP ──
  if (type === "pin_change_request") {
    const otp = randomInt(100000, 1000000).toString();
    otpStore.set(email, { otp, expires: Date.now() + 10 * 60 * 1000, attempts: 0 });

    try {
      await resend().emails.send({
      from: "Tyunnie <onboarding@resend.dev>",
      to: email,
      subject: "Your Tyunnie vault PIN change code",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #faf8f5; border-radius: 16px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 24px;">🔐</span>
            <span style="font-family: Georgia, serif; font-style: italic; font-size: 20px; color: #f97316; margin-left: 8px;">Tyunnie</span>
          </div>
          <h2 style="color: #111010; font-size: 16px; margin-bottom: 12px;">Vault PIN Change Request</h2>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            Your verification code to change your vault PIN is:
          </p>
          <div style="background: #fff; border: 2px solid #f97316; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f97316; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #9a8f7e; font-size: 13px; margin-bottom: 24px;">
            This code expires in <strong>10 minutes</strong>. If you didn't request this, your vault PIN has not been changed.
          </p>
          <div style="border-top: 1px solid #e8e2d8; padding-top: 16px;">
            <p style="color: #c5bdb0; font-size: 11px; font-family: monospace;">
              Automated security notification from Tyunnie. Do not reply.
            </p>
          </div>
        </div>
      `,
      });
    } catch {
      // The OTP was never delivered, so don't leave it verifiable.
      otpStore.delete(email);
      return NextResponse.json({ error: "Failed to send" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // ── NOTIFY: setup or change confirmed ──
  const subject =
    type === "setup"
      ? "Your Tyunnie vault PIN has been set"
      : "Your Tyunnie vault PIN was changed";

  const message =
    type === "setup"
      ? "Your password vault PIN has been set up successfully. If this wasn't you, please secure your account immediately."
      : "Your password vault PIN was successfully changed. If this wasn't you, please secure your account immediately.";

  try {
    await resend().emails.send({
      from: "Tyunnie <onboarding@resend.dev>",
      to: email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #faf8f5; border-radius: 16px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 24px;">🔐</span>
            <span style="font-family: Georgia, serif; font-style: italic; font-size: 20px; color: #f97316; margin-left: 8px;">Tyunnie</span>
          </div>
          <h2 style="color: #111010; font-size: 16px; margin-bottom: 12px;">${subject}</h2>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">${message}</p>
          <div style="border-top: 1px solid #e8e2d8; padding-top: 16px;">
            <p style="color: #c5bdb0; font-size: 11px; font-family: monospace;">
              Automated security notification from Tyunnie. Do not reply.
            </p>
          </div>
        </div>
      `,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("vault-notify error:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
