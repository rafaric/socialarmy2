import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data: profile } = await db
    .from("profiles")
    .select("login_streak, last_login_date")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ ok: true });

  const lastLogin = profile.last_login_date as string | null;
  if (lastLogin === todayStr) return NextResponse.json({ streak: profile.login_streak, pack: null });

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  const newStreak = lastLogin === yesterdayStr ? (profile.login_streak ?? 0) + 1 : 1;

  await db.from("profiles").update({
    login_streak: newStreak,
    last_login_date: todayStr,
  }).eq("id", user.id);

  // Cada 5 días de racha → super sobre
  let pack = null;
  if (newStreak % 5 === 0) {
    const { error: dupError } = await db.from("activity_rewards").insert({
      user_id: user.id,
      activity: "login_streak",
      ref_id: `streak_${newStreak}_${todayStr}`,
    });

    if (!dupError) {
      const { data: newPack } = await db.from("pack_log").insert({
        user_id: user.id,
        pack_type: "super",
        activity: "login_streak",
        opened: false,
      }).select().single();
      pack = newPack;
    }
  }

  return NextResponse.json({ streak: newStreak, pack });
}
