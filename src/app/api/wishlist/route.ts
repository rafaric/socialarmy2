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
  const key = buildKey("wishlist/get", req, user.id);
  if (!rateLimit(key, 60, 60_000)) {
    console.warn("[rate_limit_exceeded] route=wishlist GET userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Query wishlists JOIN cards.
  const db = admin();
  const { data, error } = await db
    .from("wishlists")
    .select(
      `user_id,
       card_definition_id,
       created_at,
       cards (id, name, member, era, rarity, rarity_points, image_url)`
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[query_error] route=wishlist GET userId=%s error=%s", user.id, error.message);
    return NextResponse.json({ error: "Failed to fetch wishlist" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
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

  // 2. Rate limit: 20/min.
  const key = buildKey("wishlist/post", req, user.id);
  if (!rateLimit(key, 20, 60_000)) {
    console.warn("[rate_limit_exceeded] route=wishlist POST userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Validate body.
  const body = await req.json().catch(() => null);
  const card_definition_id: unknown = body?.card_definition_id;

  if (typeof card_definition_id !== "string" || !UUID_REGEX.test(card_definition_id)) {
    return NextResponse.json(
      { error: "Invalid card_definition_id: must be a valid UUID" },
      { status: 400 }
    );
  }

  // 4. Insert into wishlists.
  const db = admin();
  const { data, error } = await db
    .from("wishlists")
    .insert({ user_id: user.id, card_definition_id })
    .select(
      `user_id,
       card_definition_id,
       created_at,
       cards (id, name, member, era, rarity, rarity_points, image_url)`
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_in_wishlist" }, { status: 409 });
    }
    console.warn("[insert_error] route=wishlist POST userId=%s error=%s", user.id, error.message);
    return NextResponse.json({ error: "Failed to add to wishlist" }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
