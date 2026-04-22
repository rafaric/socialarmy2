import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

// GET → lista de IDs que bloqueé
export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", user.id);

  return NextResponse.json((data ?? []).map((r) => r.blocked_id));
}

// POST → bloquear usuario { blocked_id }
export async function POST(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blocked_id } = await req.json().catch(() => ({}));
  if (!blocked_id) return NextResponse.json({ error: "blocked_id requerido" }, { status: 400 });
  if (blocked_id === user.id) return NextResponse.json({ error: "No podés bloquearte a vos mismo" }, { status: 400 });

  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: user.id, blocked_id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Remover amistad si existe (best-effort)
  await supabase
    .from("friends")
    .delete()
    .or(`and(user_id.eq.${user.id},friend_id.eq.${blocked_id}),and(user_id.eq.${blocked_id},friend_id.eq.${user.id})`);

  return NextResponse.json({ ok: true });
}
