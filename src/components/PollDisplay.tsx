"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import { usePollVotes, useVotePoll, useNotifyPollEnd } from "@/hooks/usePolls";
import type { Poll } from "@/types";

interface Props {
  poll: Poll;
  postId: string;
  authorId: string;
}

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Finalizada";
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h restantes`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${mins}m restantes`;
}

export default function PollDisplay({ poll, postId, authorId }: Props) {
  const { user } = useAuthStore();
  const { data: votes = [], isLoading } = usePollVotes(postId);
  const voteMutation    = useVotePoll(postId);
  const notifyEndMutation = useNotifyPollEnd(postId);

  const ended    = new Date(poll.ends_at) < new Date();
  const myVote   = votes.find((v) => v.user_id === user)?.option_index ?? null;
  const hasVoted = myVote !== null;
  const total    = votes.length;
  const showResults = hasVoted || ended;

  // Notify user when poll ends and they voted
  useEffect(() => {
    if (ended && hasVoted && user && user !== authorId) {
      notifyEndMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, hasVoted, user]);

  if (isLoading) return <div className="skeleton h-24 w-full rounded-xl mt-3" />;

  return (
    <div className="mt-3 p-3 rounded-xl border border-white/10 bg-white/3 flex flex-col gap-2">
      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{poll.question}</p>

      <div className="flex flex-col gap-2">
        {poll.options.map((opt, i) => {
          const count   = votes.filter((v) => v.option_index === i).length;
          const pct     = total > 0 ? Math.round((count / total) * 100) : 0;
          const isMyVote = myVote === i;

          if (showResults) {
            return (
              <div key={i} className="relative overflow-hidden rounded-lg">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-lg"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{
                    background: isMyVote ? "var(--accent)30" : "rgba(255,255,255,0.06)",
                  }}
                />
                <div className="relative flex items-center justify-between px-3 py-2">
                  <span className="text-sm flex items-center gap-1.5" style={{ color: isMyVote ? "var(--accent)" : "var(--text-secondary)" }}>
                    {isMyVote && <span className="text-xs">✓</span>}
                    {opt}
                  </span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: isMyVote ? "var(--accent)" : "var(--text-muted)" }}>
                    {pct}%
                  </span>
                </div>
              </div>
            );
          }

          return (
            <button
              key={i}
              type="button"
              disabled={!user || voteMutation.isPending}
              onClick={() => voteMutation.mutate(i)}
              className="text-left px-3 py-2 rounded-lg text-sm text-[color:var(--text-secondary)] border border-white/10 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] hover:bg-[color:var(--accent)]/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-0.5">
        <span className="text-xs text-[color:var(--text-muted)]">
          {total} {total === 1 ? "voto" : "votos"}
        </span>
        <span
          className="text-xs font-medium"
          style={{ color: ended ? "var(--text-muted)" : "var(--accent)" }}
        >
          {timeLeft(poll.ends_at)}
        </span>
      </div>

      {voteMutation.isError && (
        <p className="text-xs text-red-400">{(voteMutation.error as Error).message}</p>
      )}
    </div>
  );
}
