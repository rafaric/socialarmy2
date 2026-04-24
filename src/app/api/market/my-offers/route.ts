import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { OfferStatus } from "@/types";

const VALID_STATUSES: OfferStatus[] = ["pending", "accepted", "rejected", "cancelled"];

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

  // 2. Parse + validate query params.
  const statusParam = req.nextUrl.searchParams.get("status");

  if (statusParam !== null && !VALID_STATUSES.includes(statusParam as OfferStatus)) {
    return NextResponse.json(
      { error: `Invalid status: must be one of ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // 3. Query trade_offers WHERE buyer_id = user.id
  //    JOIN cards (offered_card) + market_listings JOIN cards (listed_card).
  const db = admin();

  let query = db
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
       listing:market_listings!listing_id (
         id,
         seller_id,
         card_definition_id,
         auto_accept,
         status,
         expires_at,
         created_at,
         completed_at,
         cards (id, name, member, era, rarity, rarity_points, image_url)
       )`
    )
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  if (statusParam) {
    query = query.eq("status", statusParam);
  }

  const { data, error } = await query;

  if (error) {
    console.warn(
      "[query_error] route=market/my-offers GET userId=%s error=%s",
      user.id,
      error.message
    );
    return NextResponse.json({ error: "Failed to fetch offers" }, { status: 500 });
  }

  return NextResponse.json({ offers: data ?? [] });
}
