import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const SUPER_ACTIVITIES = new Set(["post", "login_streak"]);

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activity, ref_id } = await req.json().catch(() => ({}));
  if (!activity) return NextResponse.json({ error: "activity requerido" }, { status: 400 });

  const db = admin();

  // Cap diario: máximo 5 sobres simples por día
  const isSimple = !SUPER_ACTIVITIES.has(activity);
  if (isSimple) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await db
      .from("pack_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("pack_type", "simple")
      .gte("created_at", todayStart.toISOString());
    if ((count ?? 0) >= 5) return NextResponse.json({ daily_limit_reached: true });
  }

  // Idempotency — evitar doble reward
  const { error: dupError } = await db.from("activity_rewards").insert({
    user_id: user.id,
    activity,
    ref_id: ref_id ?? activity,
  });

  // 23505 = unique violation → ya fue recompensado
  if (dupError) {
    if (dupError.code === "23505") return NextResponse.json({ already_rewarded: true });
    return NextResponse.json({ error: dupError.message }, { status: 500 });
  }

  const pack_type = SUPER_ACTIVITIES.has(activity) ? "super" : "simple";

  const { data: pack, error: packError } = await db.from("pack_log").insert({
    user_id: user.id,
    pack_type,
    activity,
    opened: false,
  }).select().single();

  if (packError) return NextResponse.json({ error: packError.message }, { status: 500 });

  return NextResponse.json({ pack });
}
