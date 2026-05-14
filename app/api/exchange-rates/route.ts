import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { verifyAuth } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!(await verifyAuth(auth))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`rates:${clientKey(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
      next: { revalidate: 3600 }, // cache for 1 hour on Vercel
    });
    if (!res.ok) throw new Error(`Frankfurter error ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch rates" }, { status: 502 });
  }
}
