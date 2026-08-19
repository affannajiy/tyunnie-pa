// app/api/run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { getAuthUser } from "@/lib/apiAuth";

const LANG_MAP: Record<string, { language: string; versionIndex: string }> = {
  py:    { language: "python3",    versionIndex: "4" },
  js:    { language: "nodejs",     versionIndex: "4" },
  ts:    { language: "typescript", versionIndex: "1" },
  bash:  { language: "bash",       versionIndex: "4" },
  other: { language: "python3",    versionIndex: "4" },
};

const MAX_CODE_CHARS   = 50_000;
const MAX_OUTPUT_CHARS = 100_000;
const ALLOWED_LANGS  = new Set(Object.keys(LANG_MAP));

export async function POST(req: NextRequest) {
  // ── Auth ──
  const auth = req.headers.get("authorization");
  const user = await getAuthUser(auth);
  if (!user) {
    return NextResponse.json({ output: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit: 10 executions / minute per IP + 100 / day per user ──
  // JDoodle has a daily credit quota; the per-user cap stops one account
  // from exhausting it.
  if (!rateLimit(`run:${clientKey(req)}`, 10, 60_000)) {
    return NextResponse.json({ output: "Rate limit exceeded — try again in a minute." }, { status: 429 });
  }
  if (!rateLimit(`run:u:${user.id}`, 100, 24 * 60 * 60_000)) {
    return NextResponse.json({ output: "Daily execution limit reached — try again tomorrow." }, { status: 429 });
  }

  try {
    const { code, language } = await req.json();

    // ── Input validation ──
    if (typeof code !== "string" || typeof language !== "string") {
      return NextResponse.json({ output: "Invalid request." }, { status: 400 });
    }
    if (!ALLOWED_LANGS.has(language)) {
      return NextResponse.json({ output: "Unsupported language." }, { status: 400 });
    }
    if (code.length > MAX_CODE_CHARS) {
      return NextResponse.json({ output: "Code too large (max 50 000 characters)." }, { status: 400 });
    }

    const lang = LANG_MAP[language] ?? LANG_MAP["other"];
    const res = await fetch("https://api.jdoodle.com/v1/execute", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script: code,
        language: lang.language,
        versionIndex: lang.versionIndex,
        clientId: process.env.JDOODLE_CLIENT_ID,
        clientSecret: process.env.JDOODLE_CLIENT_SECRET,
      }),
    });

    // JDoodle answers 401/429 with a JSON body too, and its `error` field can
    // name the credential that failed — never relay upstream text to the client.
    if (!res.ok) {
      console.error(`[run] JDoodle responded ${res.status}`);
      return NextResponse.json({ output: "Error: Could not run code." }, { status: 502 });
    }

    const data = await res.json();
    // Bound what we echo back: the output is attacker-authored (it's whatever
    // their script printed) and an unbounded print loop would otherwise stream
    // straight through us into the browser.
    const raw = typeof data.output === "string" ? data.output : "";
    const output = raw
      ? raw.length > MAX_OUTPUT_CHARS
        ? `${raw.slice(0, MAX_OUTPUT_CHARS)}\n…output truncated.`
        : raw
      : "(no output)";
    return NextResponse.json({ output });
  } catch {
    return NextResponse.json({ output: "Error: Could not run code." }, { status: 500 });
  }
}
