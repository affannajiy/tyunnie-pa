import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import Groq from "groq-sdk";
import { timingSafeEqual } from "crypto";
import { TYUN_CORE, isTyunBirthday } from "@/lib/tyunPersona";

// Concrete angles to seed each message so Taehyun ranges widely instead of
// drifting back to the same 3 safe lines. One is picked at random per send.
const TOPICS = [
  "his morning caramel macchiato run and whether they've eaten yet",
  "a photo he just took, and nudging them to actually look up from their screen today",
  "a magic trick he's been practising — and how persistence is the whole trick",
  "sleep — he's an early riser and suspects they are very much not",
  "a small money goal of theirs, framed without nagging",
  "a study slump and how he'd actually break out of it",
  "the smell of nature after rain, and stepping outside for two minutes",
  "clean math / a Gauss-flavoured aside about doing the hard thing first",
  "an idol-life moment from his day that loosely connects to theirs",
  "procrastination — calling it out with a smirk, not a lecture",
  "being basically a cat: rest is productive, stop feeling guilty about it",
  "hating spicy food and mint-choc, and an oddly strong food opinion",
  "a tiny win of theirs worth actually noticing",
  "the difference between busy and effective",
  "a half-finished thing they keep avoiding",
  "weather and how it's no excuse, gently",
  "left-handed stubbornness as a metaphor for doing it your own way",
  "drinking water — yes, again, he knows, do it anyway",
  "a sharp little observation about overthinking",
  "starting before you feel ready",
  "comparison and why theirs is a waste of good time",
  "the quiet satisfaction of a clean, finished task",
  "checking in because he noticed they've been pushing hard lately",
  "one honest sentence of encouragement, no sugar",
  "a dry joke about Mondays / the week, then a real point underneath",
  "rest vs grind, and permission to close the laptop",
  "an early-morning thought he hasn't told anyone",
  "their future self and what that person would thank them for",
  "doing the boring thing well",
  "a curveball: something completely unrelated he's just curious about",
  "music — what he'd put on for their kind of day",
  "the courage it takes to send the message / make the call they're avoiding",
  "patience with themselves on a slow day",
  "momentum — how one small thing started usually drags the rest along",
  "a teasing dare to surprise themselves today",
];

// Emotional register for the message. Wider than the old 4 so it doesn't feel
// like the same rotation every week.
const TONES = [
  "motivational",
  "funny",
  "reassuring",
  "curious",
  "teasing",
  "hyped",
  "contemplative",
  "blunt-but-caring",
];

// Fallback subject labels if the model omits its own SUBJECT line.
const FALLBACK_LABELS = [
  "From Taehyun",
  "A note",
  "Real quick",
  "Hey",
  "Something I noticed",
  "Read this",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Splits the model output into a short subject line + body. The model is asked
// to lead with "SUBJECT: ...". If it doesn't, we fall back to a label pool.
// The note is meant to read like a text message, so a trailing "— Taehyun" is
// noise (his name is already in the From line and the subject). The prompt says
// not to sign off; this strips it on the days the model does it anyway.
function stripSignOff(body: string): string {
  return body
    .replace(/\s*[—–-]{1,2}\s*taehyun\s*[.!]?\s*$/i, "")
    .trim();
}

function parseMessage(raw: string): { subject: string; body: string } {
  const text = raw.trim();
  const match = text.match(/^\s*subject:\s*(.+?)\s*(?:\n|$)/i);
  if (match) {
    const subject = match[1].trim().replace(/^["']|["']$/g, "").slice(0, 60);
    const body = stripSignOff(text.slice(match[0].length).trim());
    if (body) return { subject, body };
  }
  return { subject: pick(FALLBACK_LABELS), body: stripSignOff(text) };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Lazy + memoised — see app/api/chat/route.ts. `new Resend(undefined)` throws
// "Missing API key", and `next build` imports this module to collect its config.
let _resend: Resend | null = null;
function resend() {
  return (_resend ??= new Resend(process.env.RESEND_API_KEY));
}
let _groq: Groq | null = null;
function groq() {
  return (_groq ??= new Groq({ apiKey: process.env.GROQ_API_KEY }));
}

// Verify cron secret so random people can't spam this endpoint
function verifyCronSecret(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || !process.env.CRON_SECRET) return false;
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const provided = Buffer.from(auth);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
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
      // 500 so Vercel cron monitoring flags the failure instead of masking it
      return NextResponse.json({ error: "Failed to fetch recipients" }, { status: 500 });
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

      // On Feb 5 every note becomes a birthday note from Taehyun himself —
      // it's HIS birthday, not the reader's. Otherwise pick a random angle so
      // each message ranges widely instead of landing on the same safe lines.
      const tyunBday = isTyunBirthday();
      const topic = tyunBday
        ? "it's his own birthday (Feb 5) — he mentions it offhand, stays low-key and dry about it, and still turns it back to them with a small nudge for their day"
        : pick(TOPICS);
      const tone = tyunBday ? "teasing" : pick(TONES);

      const completion = await groq().chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `${TYUN_CORE}

You're sending this person ONE line — a text message you'd tap out in five seconds, not a note, not a card, not a speech.

TODAY'S ANGLE (your starting point, not a script — make it yours): ${topic}
TONE: ${tone}

RULES
- First line MUST be "SUBJECT: <2-4 word subject>" — lowercase-casual is fine, make it specific to today's line, never generic like "A thought" or "Get up".
- Then a blank line, then the message: normally ONE sentence. A second sentence only if it genuinely earns its place — most days it doesn't. Never three.
- Say one thing. Don't set it up, don't explain it, don't land a moral afterwards. The thought on its own is enough.
- Dive straight in — no greeting, no reader's name, no sign-off, no "— Taehyun". They know it's you.
- Real and specific over wise. Sound like a person talking, not a caption.
- Plain text only: no asterisks, no markdown, no emojis.`,
          },
          {
            role: "user",
            content: `Write today's one line. Angle: ${topic}. Tone: ${tone}. SUBJECT line first, then the single sentence.`,
          },
        ],
        max_tokens: 70,
        temperature: 1.0,
      });

      const { subject, body } = parseMessage(
        completion.choices[0]?.message?.content ??
          "SUBJECT: drink water\n\nDrink some water. Revolutionary advice, I know.",
      );
      const quote = escapeHtml(body);
      const subjectLabel = escapeHtml(subject);

      // Send email
      await resend().emails.send({
        from: "Taehyun via Tyunnie <onboarding@resend.dev>",
        to: email,
        subject: `${subject} — Taehyun`,
        html: `
          <div style="font-family: sans-serif; max-width: 440px; margin: 0 auto; padding: 28px; background: #faf8f5; border-radius: 16px;">
            <p style="font-size: 11px; font-family: monospace; color: #f97316; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 14px;">
              ${subjectLabel}
            </p>
            <p style="font-family: Georgia, serif; font-style: italic; font-size: 19px; color: #111010; line-height: 1.55; margin: 0;">
              ${quote}
            </p>
            <p style="color: #c5bdb0; font-size: 10px; font-family: monospace; margin: 26px 0 0;">
              Tyunnie × Taehyun · daily note · turn off in Profile → Preferences
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
