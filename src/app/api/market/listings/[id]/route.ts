import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { rateLimit, buildKey } from "@/lib/rate-limit";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  // 1. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit: 20/min.
  const key = buildKey("market/listings/delete", req, user.id);
  if (!rateLimit(key, 20, 60_000)) {
    console.warn("[rate_limit_exceeded] route=market/listings/[id] DELETE userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Validate param.
  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
  }

  // 4. Call RPC cancel_listing (validates ownership + status internally).
  const db = admin();
  const { data, error } = await db.rpc("cancel_listing", {
    p_listing_id: id,
    p_user_id: user.id,
  });

  if (error) {
    console.warn("[rpc_error] route=market/listings/[id] DELETE userId=%s listingId=%s error=%s", user.id, id, error.message);
    return NextResponse.json({ error: "Failed to cancel listing" }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string };

  if (!result.ok) {
    if (result.error === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (result.error === "listing_not_cancellable") {
      return NextResponse.json({ error: "listing_not_cancellable" }, { status: 409 });
    }
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
