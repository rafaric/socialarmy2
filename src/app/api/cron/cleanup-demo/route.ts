import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "@/lib/constants";

// Posts seeded on 2026-04-16 — delete anything created after that
const SEED_DATE = "2026-04-17T00:00:00.000Z";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [posts, likes, notifications] = await Promise.all([
    supabase
      .from("posts")
      .delete()
      .eq("user_id", DEMO_USER_ID)
      .gt("created_at", SEED_DATE),
    supabase
      .from("likes")
      .delete()
      .eq("user_id", DEMO_USER_ID)
      .gt("created_at", SEED_DATE),
    supabase
      .from("notifications")
      .delete()
      .eq("user_id", DEMO_USER_ID)
      .gt("created_at", SEED_DATE),
  ]);

  const errors = [posts.error, likes.error, notifications.error].filter(Boolean);
  if (errors.length > 0) {
    console.error("Cleanup errors:", errors);
    return NextResponse.json({ error: "Partial failure", details: errors }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cleaned: ["posts", "likes", "notifications"] });
}
