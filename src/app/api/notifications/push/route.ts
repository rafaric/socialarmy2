import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { rateLimit, buildKey } from "@/lib/rate-limit";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Compara dos strings usando tiempo constante para prevenir timing attacks.
 * Retorna false inmediatamente si las longitudes difieren (sin leak de info útil).
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

const MESSAGES: Record<string, string> = {
  like:       "reaccionó a tu publicación",
  comentario: "comentó tu publicación",
  follow:     "empezó a seguirte",
  mention:    "te mencionó en un comentario",
};

export async function POST(req: NextRequest) {
  // 1. Verificar webhook secret — PRIMER paso antes de leer body.
  const provided = req.headers.get("x-webhook-secret") ?? "";
  const expected = process.env.SUPABASE_WEBHOOK_SECRET ?? "";
  const previous = process.env.SUPABASE_WEBHOOK_SECRET_PREVIOUS ?? "";

  if (!expected) {
    console.warn("SUPABASE_WEBHOOK_SECRET not set — webhook endpoint is unprotected. Set this variable in production.");
  } else {
    const matchesCurrent  = timingSafeEqualStr(provided, expected);
    const matchesPrevious = previous !== "" && timingSafeEqualStr(provided, previous);

    if (!matchesCurrent && !matchesPrevious) {
      console.warn("[invalid_webhook_secret] route=notifications/push ip=%s", buildKey("notifications/push", req, null));
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 2. Rate limit por IP (defense in depth, ya autenticado por secret).
  const key = buildKey("notifications/push", req, null);
  if (!rateLimit(key, 60, 60_000)) {
    console.warn("[rate_limit_exceeded] route=notifications/push ip=%s", key);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Lógica original del handler.
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
