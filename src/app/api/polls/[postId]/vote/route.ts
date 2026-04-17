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
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const optionIndex = body.option_index;
  if (typeof optionIndex !== "number") {
    return NextResponse.json({ error: "option_index requerido" }, { status: 400 });
  }

  // Fetch post to validate poll exists and hasn't ended
  const admin = adminClient();
  const { data: post } = await admin
    .from("posts")
    .select("id, author, poll")
    .eq("id", postId)
    .single();

  if (!post?.poll) return NextResponse.json({ error: "No hay encuesta en este post" }, { status: 404 });

  const poll = post.poll as { question: string; options: string[]; ends_at: string };
  if (new Date(poll.ends_at) < new Date()) {
    return NextResponse.json({ error: "La encuesta ya finalizó" }, { status: 400 });
  }
  if (optionIndex < 0 || optionIndex >= poll.options.length) {
    return NextResponse.json({ error: "Opción inválida" }, { status: 400 });
  }

  // Insert vote (unique constraint handles double-vote)
  const { error: voteError } = await admin
    .from("poll_votes")
    .insert({ post_id: postId, user_id: user.id, option_index: optionIndex });

  if (voteError) {
    if (voteError.code === "23505") {
      return NextResponse.json({ error: "Ya votaste en esta encuesta" }, { status: 409 });
    }
    return NextResponse.json({ error: voteError.message }, { status: 500 });
  }

  // Notify post author (best-effort, skip if self-vote)
  if (post.author !== user.id) {
    await admin.from("notifications").insert({
      notification_type: "poll_vote",
      user_emisor: user.id,
      user_receptor: post.author,
      post_id: postId,
    }).then(null, () => {});
  }

  return NextResponse.json({ ok: true });
}
