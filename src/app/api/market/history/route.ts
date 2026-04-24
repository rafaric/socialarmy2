import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(): Promise<NextResponse> {
  // 1. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Query trade_history WHERE seller_id = user.id OR buyer_id = user.id
  //    JOIN cards para listed_card y offered_card + profiles para seller y buyer.
  const db = admin();

  const { data, error } = await db
    .from("trade_history")
    .select(
      `id,
       listing_id,
       seller_id,
       buyer_id,
       listed_card_id,
       offered_card_id,
       completed_at,
       listed_card:cards!listed_card_id   (id, name, member, era, rarity, rarity_points, image_url),
       offered_card:cards!offered_card_id (id, name, member, era, rarity, rarity_points, image_url),
       seller:profiles!seller_id (id, name, avatar),
       buyer:profiles!buyer_id   (id, name, avatar)`
    )
    .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
    .order("completed_at", { ascending: false });

  if (error) {
    console.warn(
      "[query_error] route=market/history GET userId=%s error=%s",
      user.id,
      error.message
    );
    return NextResponse.json({ error: "Failed to fetch trade history" }, { status: 500 });
  }

  return NextResponse.json({ history: data ?? [] });
}
