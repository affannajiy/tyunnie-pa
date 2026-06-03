import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import Groq from "groq-sdk";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const resend = new Resend(process.env.RESEND_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Verify cron secret so random people can't spam this endpoint
function verifyCronSecret(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  console.log(`[daily-quote] invoked at ${new Date().toISOString()}`);

  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all users who opted in
    const { createClient } = await import("@supabase/supabase-js");
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role — can read all profiles
    );

    const { data: profiles, error } = await adminSupabase
      .from("profiles")
      .select("id, display_name, daily_quote_email")
      .eq("daily_quote_email", true);

    if (error) {
      console.error("[daily-quote] failed to fetch profiles", error);
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // Early-exit when nobody opted in — skip Groq + Resend entirely
    if (!profiles.length) {
      console.log("[daily-quote] no opted-in users, exiting");
      return NextResponse.json({ sent: 0 });
    }

    // Get user emails from auth.users for each profile
    const sendAll = Promise.allSettled(
      profiles.map(async (profile) => {
      const { data: userData } = await adminSupabase.auth.admin.getUserById(
        profile.id,
      );
      const email = userData?.user?.email;
      if (!email) return;

      // Generate quote with Groq
      const quoteTypes = ["motivational", "funny", "romantic", "reassuring"];
      const type = quoteTypes[Math.floor(Math.random() * quoteTypes.length)];

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are Taehyun from TXT (Tomorrow X Together). You are calm and caring but mostly dry, a little sarcastic, and quietly funny — like a friend who teases you because they actually care. Never sappy, never over-the-top. Generate a single short message (1-2 sentences, max). Do NOT use the reader's name or any greeting like "Hey [name]" — just dive straight in. The tone should be: ${type} (but always with a friendly, playful, slightly sarcastic edge). Sign off as "— Taehyun". Do not use asterisks, emojis, or formatting — just plain text.`,
          },
          {
            role: "user",
            content: `Write today's ${type} message. Short, funny, no name.`,
          },
        ],
        max_tokens: 90,
        temperature: 0.95,
      });

      const quote = escapeHtml(
        completion.choices[0]?.message?.content?.trim() ??
        "Drink some water. Revolutionary advice, I know. — Taehyun",
      );

      const typeLabels: Record<string, string> = {
        motivational: "Get up",
        funny: "A thought",
        romantic: "Don't make it weird",
        reassuring: "Relax",
      };

      // Send email
      await resend.emails.send({
        from: "Taehyun via Tyunnie <onboarding@resend.dev>",
        to: email,
        subject: `${typeLabels[type]} — Taehyun`,
        html: `
          <div style="font-family: sans-serif; max-width: 440px; margin: 0 auto; padding: 28px; background: #faf8f5; border-radius: 16px;">
            <p style="font-size: 11px; font-family: monospace; color: #f97316; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 14px;">
              ${typeLabels[type]}
            </p>
            <div style="background: #ffffff; border: 1.5px solid #f97316; border-radius: 14px; padding: 22px 26px;">
              <p style="font-family: Georgia, serif; font-style: italic; font-size: 17px; color: #111010; line-height: 1.6; margin: 0;">
                ${quote}
              </p>
            </div>
            <p style="color: #c5bdb0; font-size: 10px; font-family: monospace; margin: 18px 0 0;">
              Tyunnie × Taehyun · daily quotes · turn off in Profile → Preferences
            </p>
          </div>
        `,
      });
    }),
    );

    // Vercel Hobby functions cap at 10s — race the whole send batch against a
    // 9s ceiling so we return cleanly instead of being killed mid-flight.
    const TIMEOUT = "__timeout__" as const;
    const timeout = new Promise<typeof TIMEOUT>((resolve) =>
      setTimeout(() => resolve(TIMEOUT), 9000),
    );

    const raceResult = await Promise.race([sendAll, timeout]);

    if (raceResult === TIMEOUT) {
      console.error("[daily-quote] timeout — skipping");
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }

    const recipientCount = raceResult.filter(
      (r) => r.status === "fulfilled",
    ).length;
    console.log(`[daily-quote] sent to ${recipientCount} users`);
    return NextResponse.json({ ok: true, sent: recipientCount });
  } catch (err) {
    console.error("[daily-quote] error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
