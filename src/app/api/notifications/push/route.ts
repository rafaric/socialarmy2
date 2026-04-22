import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MESSAGES: Record<string, string> = {
  like:       "reaccionó a tu publicación",
  comentario: "comentó tu publicación",
  follow:     "empezó a seguirte",
  mention:    "te mencionó en un comentario",
};

export async function POST(req: NextRequest) {
  // Supabase webhook sends the row in `record`
  const body = await req.json().catch(() => null);
  const record = body?.record;

  if (!record?.user_receptor || !record?.notification_type) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const supabase = admin();

  // Get receptor's push token and emisor's name
  const [receptorRes, emisorRes] = await Promise.all([
    supabase.from("profiles").select("push_token").eq("id", record.user_receptor).single(),
    record.user_emisor
      ? supabase.from("profiles").select("name").eq("id", record.user_emisor).single()
      : Promise.resolve({ data: null }),
  ]);

  const pushToken = receptorRes.data?.push_token;
  if (!pushToken) return NextResponse.json({ ok: true, skipped: "no token" });

  const emisorName = emisorRes.data?.name ?? "Alguien";
  const body_text = MESSAGES[record.notification_type] ?? "te envió una notificación";

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: pushToken,
      title: "SocialARMY",
      body: `${emisorName} ${body_text}`,
      data: { postId: record.post_id ?? null },
      sound: "default",
    }),
  });

  return NextResponse.json({ ok: true });
}
