// app/api/run/route.ts
import { NextRequest, NextResponse } from "next/server";

const LANG_MAP: Record<string, { language: string; versionIndex: string }> = {
  py: { language: "python3", versionIndex: "4" },
  js: { language: "nodejs", versionIndex: "4" },
  ts: { language: "typescript", versionIndex: "1" },
  bash: { language: "bash", versionIndex: "4" },
  other: { language: "python3", versionIndex: "4" },
};

export async function POST(req: NextRequest) {
  try {
    const { code, language } = await req.json();
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
    console.log("JDoodle response:", data);

    // JDoodle returns output in data.output
    const output = data.output ?? "(no output)";
    return NextResponse.json({ output });
  } catch (error) {
    console.error("Run error:", error);
    return NextResponse.json(
      { output: "Error: Could not run code." },
      { status: 500 },
    );
  }
}
