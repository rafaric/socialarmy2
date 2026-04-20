import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return data?.is_admin ? user : null;
}

export async function GET() {
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = admin();

  const [
    { count: totalPacks },
    { count: openedPacks },
    { count: pendingPacks },
    { count: simplePacks },
    { count: superPacks },
    { data: byRarity },
    { data: recentPacks },
    { count: totalUsers },
  ] = await Promise.all([
    db.from("pack_log").select("id", { count: "exact", head: true }),
    db.from("pack_log").select("id", { count: "exact", head: true }).eq("opened", true),
    db.from("pack_log").select("id", { count: "exact", head: true }).eq("opened", false),
    db.from("pack_log").select("id", { count: "exact", head: true }).eq("pack_type", "simple"),
    db.from("pack_log").select("id", { count: "exact", head: true }).eq("pack_type", "super"),
    db.from("user_cards").select("cards(rarity)"),
    db.from("pack_log")
      .select("created_at, pack_type, activity")
      .order("created_at", { ascending: false })
      .limit(10),
    db.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const rarityCounts = (byRarity ?? []).reduce<Record<string, number>>((acc, row) => {
    const rarity = (row.cards as { rarity: string } | null)?.rarity;
    if (rarity) acc[rarity] = (acc[rarity] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    packs: { total: totalPacks, opened: openedPacks, pending: pendingPacks, simple: simplePacks, super: superPacks },
    cards: rarityCounts,
    recent: recentPacks,
    users: totalUsers,
  });
}
