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

  // Contar duplicados dentro del sobre
  const cardCounts = cardIds.reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});

  // Leer quantities existentes para hacer incremento correcto
  const { data: existing } = await db
    .from("user_cards")
    .select("card_definition_id, quantity")
    .eq("user_id", user.id)
    .in("card_definition_id", Object.keys(cardCounts));

  const existingMap = Object.fromEntries(
    (existing ?? []).map((r) => [r.card_definition_id, r.quantity])
  );

  await db.from("user_cards").upsert(
    Object.entries(cardCounts).map(([card_definition_id, count]) => ({
      user_id: user.id,
      card_definition_id,
      quantity: (existingMap[card_definition_id] ?? 0) + count,
      locked_quantity: 0,
    })),
    { onConflict: "user_id,card_definition_id" }
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
