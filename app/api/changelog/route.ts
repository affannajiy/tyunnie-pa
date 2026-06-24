import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { parseChangelog } from "@/lib/changelog";
import { APP_VERSION } from "@/lib/version";

// Reads docs/CHANGELOG.md from disk and returns it parsed. Public, no auth —
// it's the same info shown on the /about page. Cached so repeated reads are cheap.
export const revalidate = 3600; // re-read at most hourly

export async function GET() {
  try {
    const file = path.join(process.cwd(), "docs", "CHANGELOG.md");
    const raw = await readFile(file, "utf8");
    const entries = parseChangelog(raw);
    return NextResponse.json(
      { version: APP_VERSION, entries },
      // CDN may cache for an hour, but the browser must revalidate so a deploy
      // that changes CHANGELOG.md (e.g. adds Highlights) is never masked by a
      // stale client copy. `s-maxage` covers the CDN; `max-age=0` the browser.
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, must-revalidate" } },
    );
  } catch (err) {
    console.error("[changelog] failed to read CHANGELOG.md", err);
    return NextResponse.json({ version: APP_VERSION, entries: [] });
  }
}
