import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { rateLimit, buildKey } from "@/lib/rate-limit";
import type { UserCard } from "@/types";

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

  // 2. Rate limit: 60 req/min.
  const key = buildKey("cards/inventory", req, user.id);
  if (!rateLimit(key, 60, 60_000)) {
    console.warn("[rate_limit_exceeded] route=cards/inventory userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Query user_cards JOIN cards.
  const db = admin();
  const { data, error } = await db
    .from("user_cards")
    .select(
      `user_id,
       card_definition_id,
       quantity,
       locked_quantity,
       first_obtained_at,
       updated_at,
       cards (
         id,
         name,
         member,
         era,
         rarity,
         rarity_points,
         image_url
       )`
    )
    .eq("user_id", user.id)
    .order("rarity_points", { referencedTable: "cards", ascending: false });

  if (error) {
    console.warn("[query_error] route=cards/inventory userId=%s error=%s", user.id, error.message);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }

  // 4. Map: add available_quantity as a derived field.
  const cards = (data as unknown as UserCard[]).map((uc) => ({
    ...uc,
    available_quantity: uc.quantity - uc.locked_quantity,
  }));

  return NextResponse.json({ cards });
}
