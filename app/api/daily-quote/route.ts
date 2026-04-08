import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import Groq from "groq-sdk";

const resend = new Resend(process.env.RESEND_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Verify cron secret so random people can't spam this endpoint
function verifyCronSecret(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (error || !profiles?.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Get user emails from auth.users for each profile
  const results = await Promise.allSettled(
    profiles.map(async (profile) => {
      const { data: userData } = await adminSupabase.auth.admin.getUserById(
        profile.id,
      );
      const email = userData?.user?.email;
      if (!email) return;

      const name = profile.display_name ?? "you";

      // Generate quote with Groq
      const quoteTypes = ["motivational", "funny", "romantic", "reassuring"];
      const type = quoteTypes[Math.floor(Math.random() * quoteTypes.length)];

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are Taehyun from TXT (Tomorrow X Together). You are calm, quietly intense, deeply caring, occasionally dry and funny, and genuinely protective of the people you care about. You speak directly but warmly, never over-the-top. Your style is similar to Xavier from Love and Deepspace — steady, thoughtful, sometimes unexpectedly poetic or humorous. Generate a single short quote or message (2-4 sentences max) for ${name}. The tone should be: ${type}. Sign off naturally as Taehyun. Do not use asterisks, emojis, or formatting — just plain warm text.`,
          },
          {
            role: "user",
            content: `Send ${name} a ${type} daily message.`,
          },
        ],
        max_tokens: 150,
        temperature: 0.9,
      });

      const quote =
        completion.choices[0]?.message?.content?.trim() ??
        "Hey. Just checking in. You're doing better than you think. — Taehyun";

      const typeLabels: Record<string, string> = {
        motivational: "For today",
        funny: "A thought",
        romantic: "Just so you know",
        reassuring: "From me to you",
      };

      // Send email
      await resend.emails.send({
        from: "Taehyun via Tyunnie <onboarding@resend.dev>",
        to: email,
        subject: `${typeLabels[type]} — Taehyun`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #faf8f5; border-radius: 16px;">
            
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 28px;">
              <span style="font-family: Georgia, serif; font-style: italic; font-size: 22px; color: #f97316;">Tyunnie</span>
              <span style="font-size: 11px; font-family: monospace; color: #c5bdb0; letter-spacing: 2px; text-transform: uppercase;">× Taehyun</span>
            </div>

            <p style="font-size: 11px; font-family: monospace; color: #f97316; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px;">
              ${typeLabels[type]}
            </p>

            <div style="background: #ffffff; border: 1.5px solid #f97316; border-radius: 14px; padding: 24px 28px; margin-bottom: 24px;">
              <p style="font-family: Georgia, serif; font-style: italic; font-size: 17px; color: #111010; line-height: 1.7; margin: 0;">
                ${quote}
              </p>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 28px;">
              <div style="flex: 1; height: 1px; background: #e8e2d8;"></div>
              <span style="font-size: 10px; font-family: monospace; color: #c5bdb0;">
                ${new Date().toLocaleDateString("en-MY", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
              <div style="flex: 1; height: 1px; background: #e8e2d8;"></div>
            </div>

            <div style="border-top: 1px solid #e8e2d8; padding-top: 16px;">
              <p style="color: #c5bdb0; font-size: 11px; font-family: monospace; margin: 0;">
                You're receiving this because you enabled daily quotes in Tyunnie. 
                Turn it off anytime in Profile → Preferences.
              </p>
            </div>
          </div>
        `,
      });
    }),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, sent });
}
