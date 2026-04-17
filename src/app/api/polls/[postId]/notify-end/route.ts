import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false });

  const admin = adminClient();

  // Verify poll ended
  const { data: post } = await admin
    .from("posts")
    .select("id, poll")
    .eq("id", postId)
    .single();

  if (!post?.poll) return NextResponse.json({ ok: false });
  const poll = post.poll as { ends_at: string };
  if (new Date(poll.ends_at) > new Date()) return NextResponse.json({ ok: false });

  // Check user voted
  const { data: vote } = await admin
    .from("poll_votes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();

  if (!vote) return NextResponse.json({ ok: false });

  // Idempotent: skip if notification already exists
  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("notification_type", "poll_ended")
    .eq("user_receptor", user.id)
    .eq("post_id", postId)
    .single();

  if (existing) return NextResponse.json({ ok: true, already: true });

  await admin.from("notifications").insert({
    notification_type: "poll_ended",
    user_emisor: user.id,
    user_receptor: user.id,
    post_id: postId,
  });

  return NextResponse.json({ ok: true });
}
