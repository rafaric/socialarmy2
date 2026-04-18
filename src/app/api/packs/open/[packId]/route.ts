import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { pickCards } from "@/lib/card-distribution";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ packId: string }> }
) {
  const { packId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();

  const { data: pack, error: packErr } = await db
    .from("pack_log")
    .select("*")
    .eq("id", packId)
    .eq("user_id", user.id)
    .single();

  if (packErr || !pack) return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
  if (pack.opened) return NextResponse.json({ error: "Ya abierto" }, { status: 409 });

  const cardIds = await pickCards(db, pack.pack_type);
  if (cardIds.length === 0) return NextResponse.json({ error: "Sin cartas disponibles" }, { status: 503 });

  // Insertar en colección del usuario
  await db.from("user_cards").insert(
    cardIds.map((card_id) => ({ user_id: user.id, card_id }))
  );

  // Marcar sobre como abierto
  await db.from("pack_log").update({
    opened: true,
    cards_awarded: cardIds,
  }).eq("id", packId);

  // Retornar las cartas completas
  const { data: cards } = await db
    .from("cards")
    .select("*")
    .in("id", cardIds);

  return NextResponse.json({ cards: cards ?? [] });
}
