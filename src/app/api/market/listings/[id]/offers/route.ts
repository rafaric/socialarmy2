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

export async function GET(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  // 1. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit: 60/min.
  const key = buildKey("market/listings/offers/get", req, user.id);
  if (!rateLimit(key, 60, 60_000)) {
    console.warn("[rate_limit_exceeded] route=market/listings/[id]/offers GET userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { id: listingId } = await params;

  // 3. Verify the user is the seller of this listing.
  const db = admin();
  const { data: listing, error: listingErr } = await db
    .from("market_listings")
    .select("id, seller_id")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) {
    return NextResponse.json({ error: "Failed to fetch listing" }, { status: 500 });
  }

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Query trade_offers with joins.
  const { data: offers, error: offersErr } = await db
    .from("trade_offers")
    .select(
      `id,
       listing_id,
       buyer_id,
       offered_card_id,
       status,
       created_at,
       resolved_at,
       offered_card:cards!offered_card_id (id, name, member, era, rarity, rarity_points, image_url),
       buyer:profiles!buyer_id (id, name, avatar)`
    )
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  if (offersErr) {
    console.warn("[query_error] route=market/listings/[id]/offers GET userId=%s listingId=%s error=%s", user.id, listingId, offersErr.message);
    return NextResponse.json({ error: "Failed to fetch offers" }, { status: 500 });
  }

  return NextResponse.json({ offers: offers ?? [] });
}

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  // 1. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit: 5/min (spec F-03).
  const key = buildKey("market/listings/offers/post", req, user.id);
  if (!rateLimit(key, 5, 60_000)) {
    console.warn("[rate_limit_exceeded] route=market/listings/[id]/offers POST userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Validate body.
  const body = await req.json().catch(() => null);
  const offered_card_id: unknown = body?.offered_card_id;

  if (typeof offered_card_id !== "string" || !UUID_REGEX.test(offered_card_id)) {
    return NextResponse.json(
      { error: "Invalid offered_card_id: must be a valid UUID" },
      { status: 400 }
    );
  }

  const { id: listingId } = await params;

  // 4. Call RPC create_offer (handles all business validations + locking).
  const db = admin();
  const { data, error } = await db.rpc("create_offer", {
    p_listing_id: listingId,
    p_buyer_id: user.id,
    p_offered_card_id: offered_card_id,
  });

  if (error) {
    console.warn("[rpc_error] route=market/listings/[id]/offers POST userId=%s listingId=%s error=%s", user.id, listingId, error.message);
    return NextResponse.json({ error: "Failed to create offer" }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string; offer?: unknown };

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ offer: result.offer }, { status: 201 });
}
