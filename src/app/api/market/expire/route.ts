import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth: validate x-cron-secret header.
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get("x-cron-secret");

  if (!headerSecret || !cronSecret || headerSecret !== cronSecret) {
    console.warn("[auth_failed] route=market/expire missing or invalid x-cron-secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Call expire_listings RPC.
  const db = admin();
  const { data, error } = await db.rpc("expire_listings");

  if (error) {
    console.warn("[rpc_error] route=market/expire error=%s", error.message);
    return NextResponse.json({ error: "Failed to expire listings" }, { status: 500 });
  }

  // The RPC returns TABLE(processed integer, errors integer) — Supabase returns as array.
  const result = Array.isArray(data) && data.length > 0
    ? data[0]
    : { processed: 0, errors: 0 };

  return NextResponse.json({ processed: result.processed, errors: result.errors });
}
