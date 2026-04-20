import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  const adminUser = await assertAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { recipient_id, pack_type, reason } = await req.json().catch(() => ({}));
  if (!recipient_id || !pack_type) {
    return NextResponse.json({ error: "recipient_id y pack_type requeridos" }, { status: 400 });
  }
  if (pack_type !== "simple" && pack_type !== "super") {
    return NextResponse.json({ error: "pack_type inválido" }, { status: 400 });
  }

  const db = admin();

  const { data: pack, error } = await db.from("pack_log").insert({
    user_id: recipient_id,
    pack_type,
    activity: `gift_${reason ?? "event"}`,
    opened: false,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pack });
}

// Buscar usuarios por nombre
export async function GET(req: NextRequest) {
  const adminUser = await assertAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const db = admin();
  const { data } = await db
    .from("profiles")
    .select("id, name, avatar")
    .ilike("name", `%${q}%`)
    .limit(8);

  return NextResponse.json(data ?? []);
}
