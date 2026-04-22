import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { rateLimit, buildKey } from "@/lib/rate-limit";
import type { FriendRequestResponse } from "@/types";

/** Regex simple para UUID v4 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth check.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit: 20 req/hora por userId.
  const key = buildKey("friends/request", req, user.id);
  if (!rateLimit(key, 20, 3_600_000)) {
    console.warn("[rate_limit_exceeded] route=friends/request userId=%s", user.id);
    return NextResponse.json(
      { error: "Too many requests", retryAfter: 3600 },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // 3. Validar body.
  const body = await req.json().catch(() => null);
  const friend_id: unknown = body?.friend_id;

  if (typeof friend_id !== "string" || !UUID_REGEX.test(friend_id)) {
    return NextResponse.json(
      { error: "Invalid friend_id: must be a valid UUID" },
      { status: 400 }
    );
  }

  if (friend_id === user.id) {
    return NextResponse.json(
      { error: "Cannot send friend request to yourself" },
      { status: 400 }
    );
  }

  const db = admin();

  // 4. Dedup check bidireccional.
  const { data: existingFriend } = await db
    .from("friends")
    .select("status")
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${friend_id}),` +
      `and(user_id.eq.${friend_id},friend_id.eq.${user.id})`
    )
    .in("status", ["pending", "accepted"])
    .maybeSingle();

  if (existingFriend) {
    const message =
      existingFriend.status === "accepted"
        ? "Already friends"
        : "Friend request already pending";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  // 5. Block check (ambas direcciones). Tabla real: user_blocks.
  const { data: block } = await db
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${friend_id}),` +
      `and(blocker_id.eq.${friend_id},blocked_id.eq.${user.id})`
    )
    .maybeSingle();

  if (block) {
    return NextResponse.json(
      { error: "Cannot send friend request" },
      { status: 403 }
    );
  }

  // 6. Insert en friends.
  const { error: friendErr } = await db
    .from("friends")
    .insert({ user_id: user.id, friend_id, status: "pending" });

  if (friendErr) {
    if (friendErr.code === "23505") {
      return NextResponse.json({ error: "Friend request already pending" }, { status: 409 });
    }
    console.warn("[insert_error] route=friends/request userId=%s error=%s", user.id, friendErr.message);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }

  // 7. Insert en notifications.
  const { error: notifErr } = await db
    .from("notifications")
    .insert({
      notification_type: "friend_request",
      user_emisor: user.id,
      user_receptor: friend_id,
      post_id: null,
    });

  if (notifErr) {
    // Rollback manual: la tabla friends usa clave compuesta (user_id, friend_id).
    console.warn("[notif_rollback] route=friends/request userId=%s error=%s", user.id, notifErr.message);
    await db
      .from("friends")
      .delete()
      .eq("user_id", user.id)
      .eq("friend_id", friend_id);
    return NextResponse.json({ error: "Failed to notify" }, { status: 500 });
  }

  // 8. Éxito. La tabla friends usa clave compuesta, retornamos ok.
  return NextResponse.json({ ok: true } as unknown as FriendRequestResponse, { status: 201 });
}
