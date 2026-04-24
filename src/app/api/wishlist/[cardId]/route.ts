import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { rateLimit, buildKey } from "@/lib/rate-limit";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type RouteContext = { params: Promise<{ cardId: string }> };

export async function DELETE(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  // 1. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit: 20/min.
  const key = buildKey("wishlist/delete", req, user.id);
  if (!rateLimit(key, 20, 60_000)) {
    console.warn("[rate_limit_exceeded] route=wishlist/[cardId] DELETE userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Validate param.
  const { cardId } = await params;
  if (!UUID_REGEX.test(cardId)) {
    return NextResponse.json({ error: "Invalid cardId" }, { status: 400 });
  }

  // 4. Delete from wishlists (ownership enforced by user_id filter).
  const db = admin();
  const { error } = await db
    .from("wishlists")
    .delete()
    .eq("user_id", user.id)
    .eq("card_definition_id", cardId);

  if (error) {
    console.warn("[delete_error] route=wishlist/[cardId] DELETE userId=%s cardId=%s error=%s", user.id, cardId, error.message);
    return NextResponse.json({ error: "Failed to remove from wishlist" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
