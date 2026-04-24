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

type RouteContext = { params: Promise<{ id: string; offerId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  // 1. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit: 20/min.
  const key = buildKey("market/listings/offers/accept", req, user.id);
  if (!rateLimit(key, 20, 60_000)) {
    console.warn("[rate_limit_exceeded] route=.../offers/[offerId]/accept POST userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Validate params.
  const { id: listingId, offerId } = await params;
  if (!UUID_REGEX.test(offerId)) {
    return NextResponse.json({ error: "Invalid offerId" }, { status: 400 });
  }

  // 4. Verify the user is the seller of this listing.
  const db = admin();
  const { data: listing, error: listingErr } = await db
    .from("market_listings")
    .select("id, seller_id")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) {
    return NextResponse.json({ error: "Failed to fetch listing" }, { status: 500 });
  }

  if (!listing || listing.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5. Call RPC execute_trade (handles atomicity, cascade rejections, notifications).
  const { data, error } = await db.rpc("execute_trade", {
    p_offer_id: offerId,
  });

  if (error) {
    console.warn("[rpc_error] route=.../offers/[offerId]/accept POST userId=%s offerId=%s error=%s", user.id, offerId, error.message);
    return NextResponse.json({ error: "Failed to execute trade" }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string; trade_id?: string; offer_id?: string };

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, trade_id: result.trade_id });
}
