import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { rateLimit, clientKey } from "@/lib/rateLimit";

const resend = new Resend(process.env.RESEND_API_KEY);

const MAX_EMAIL_LEN = 254;
const MAX_OTP_LEN   = 10;

// OTP store — expires after 10 minutes, max 5 verify attempts before lockout
const otpStore = new Map<string, { otp: string; expires: number; attempts: number }>();

export async function POST(req: NextRequest) {
  // ── Rate limit: 5 requests / 10 minutes per IP ──
  const key = `vault:${clientKey(req)}`;
  if (!rateLimit(key, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { email, type, otp: submittedOtp } = await req.json();

  // ── Input validation ──
  if (!email || typeof email !== "string" || email.length > MAX_EMAIL_LEN) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const ALLOWED_TYPES = new Set(["verify", "pin_change_request", "setup", "changed"]);
  if (!type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

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
    if (record.otp !== submittedOtp) {
      record.attempts += 1;
      return NextResponse.json({ error: "Wrong code." }, { status: 400 });
    }
    otpStore.delete(email); // one-time use
    return NextResponse.json({ ok: true });
  }

  // ── SEND OTP ──
  if (type === "pin_change_request") {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, expires: Date.now() + 10 * 60 * 1000, attempts: 0 });

    await resend.emails.send({
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
    await resend.emails.send({
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
