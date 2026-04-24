import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { rateLimit, buildKey } from "@/lib/rate-limit";
import type { CardRarity } from "@/types";

/** Regex simple para UUID v4 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_RARITIES: CardRarity[] = ["common", "rare", "epic", "legendary"];

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isValidISO(str: string): boolean {
  const d = new Date(str);
  return !isNaN(d.getTime());
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit: 60/min.
  const key = buildKey("market/listings/get", req, user.id);
  if (!rateLimit(key, 60, 60_000)) {
    console.warn("[rate_limit_exceeded] route=market/listings GET userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Parse + validate query params.
  const searchParams = req.nextUrl.searchParams;
  const limitParam = searchParams.get("limit");
  const rarityParam = searchParams.get("rarity");
  const cursorParam = searchParams.get("cursor");

  let limit = 20;
  if (limitParam !== null) {
    limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: "Invalid limit: must be between 1 and 50" },
        { status: 400 }
      );
    }
  }

  if (rarityParam !== null && !VALID_RARITIES.includes(rarityParam as CardRarity)) {
    return NextResponse.json(
      { error: `Invalid rarity: must be one of ${VALID_RARITIES.join(", ")}` },
      { status: 400 }
    );
  }

  if (cursorParam !== null && !isValidISO(cursorParam)) {
    return NextResponse.json(
      { error: "Invalid cursor: must be a valid ISO date string" },
      { status: 400 }
    );
  }

  // 4. Query market_listings JOIN cards JOIN profiles.
  const db = admin();
  // We fetch limit+1 to determine if there's a next page
  const fetchLimit = limit + 1;

  let query = db
    .from("market_listings")
    .select(
      `id,
       seller_id,
       card_definition_id,
       auto_accept,
       status,
       expires_at,
       created_at,
       completed_at,
       cards (id, name, member, era, rarity, rarity_points, image_url),
       seller:profiles!seller_id (id, name, avatar)`
    )
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (rarityParam) {
    query = query.eq("cards.rarity", rarityParam);
  }

  if (cursorParam) {
    query = query.lt("created_at", cursorParam);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[query_error] route=market/listings GET userId=%s error=%s", user.id, error.message);
    return NextResponse.json({ error: "Failed to fetch listings" }, { status: 500 });
  }

  const listings = data ?? [];
  const hasMore = listings.length > limit;
  const page = hasMore ? listings.slice(0, limit) : listings;
  const next_cursor = hasMore ? page[page.length - 1].created_at : null;

  return NextResponse.json({ listings: page, next_cursor });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit: 10/min.
  const key = buildKey("market/listings/post", req, user.id);
  if (!rateLimit(key, 10, 60_000)) {
    console.warn("[rate_limit_exceeded] route=market/listings POST userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Validate body.
  const body = await req.json().catch(() => null);
  const card_definition_id: unknown = body?.card_definition_id;
  const auto_accept: unknown = body?.auto_accept;

  if (typeof card_definition_id !== "string" || !UUID_REGEX.test(card_definition_id)) {
    return NextResponse.json(
      { error: "Invalid card_definition_id: must be a valid UUID" },
      { status: 400 }
    );
  }

  if (typeof auto_accept !== "boolean") {
    return NextResponse.json(
      { error: "Invalid auto_accept: must be a boolean" },
      { status: 400 }
    );
  }

  // 4. Call RPC create_listing.
  const db = admin();
  const { data, error } = await db.rpc("create_listing", {
    p_seller_id: user.id,
    p_card_id: card_definition_id,
    p_auto_accept: auto_accept,
  });

  if (error) {
    console.warn("[rpc_error] route=market/listings POST userId=%s error=%s", user.id, error.message);
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string; listing?: unknown };

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ listing: result.listing }, { status: 201 });
}
