// app/api/run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { verifyAuth } from "@/lib/apiAuth";

const LANG_MAP: Record<string, { language: string; versionIndex: string }> = {
  py:    { language: "python3",    versionIndex: "4" },
  js:    { language: "nodejs",     versionIndex: "4" },
  ts:    { language: "typescript", versionIndex: "1" },
  bash:  { language: "bash",       versionIndex: "4" },
  other: { language: "python3",    versionIndex: "4" },
};

const MAX_CODE_CHARS = 50_000;
const ALLOWED_LANGS  = new Set(Object.keys(LANG_MAP));

export async function POST(req: NextRequest) {
  // ── Auth ──
  const auth = req.headers.get("authorization");
  if (!(await verifyAuth(auth))) {
    return NextResponse.json({ output: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit: 10 executions / minute per IP ──
  const key = `run:${clientKey(req)}`;
  if (!rateLimit(key, 10, 60_000)) {
    return NextResponse.json({ output: "Rate limit exceeded — try again in a minute." }, { status: 429 });
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script: code,
        language: lang.language,
        versionIndex: lang.versionIndex,
        clientId: process.env.JDOODLE_CLIENT_ID,
        clientSecret: process.env.JDOODLE_CLIENT_SECRET,
      }),
    });

    const data = await res.json();
    const output = data.output ?? "(no output)";
    return NextResponse.json({ output });
  } catch {
    return NextResponse.json({ output: "Error: Could not run code." }, { status: 500 });
  }
}
