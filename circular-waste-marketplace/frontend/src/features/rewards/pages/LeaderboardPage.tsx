import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy } from "lucide-react";
import { getLeaderboard } from "@/api/rewards";
import type { LeaderboardPeriod } from "@/api/types";
import { useAuthStore } from "@/features/auth/authStore";

const PERIOD_OPTIONS: Array<{ value: LeaderboardPeriod; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all_time", label: "All-time" },
];

function rankBadge(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export const LeaderboardPage: React.FC = () => {
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["rewards", "leaderboard", period],
    queryFn: () => getLeaderboard(period),
  });

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            to="/rewards"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Rewards</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Trophy className="h-7 w-7 text-amber-400" />
            <span>Green Champions Leaderboard</span>
          </h1>
          <p className="text-xs text-slate-400">
            Top circular contributors ranked by verified points (identities masked for privacy)
          </p>
        </div>

        {/* Period Selector */}
        <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900/90 p-1">
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/75 shadow-xl">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading leaderboard...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No leaderboard entries yet for this period.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3.5 font-semibold">Rank</th>
                <th className="px-5 py-3.5 font-semibold">Contributor</th>
                <th className="px-5 py-3.5 text-right font-semibold">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {entries.map((entry) => {
                const isCurrentUser = Boolean(user?.id && entry.user_id === user.id);
                return (
                  <tr
                    key={entry.user_id}
                    data-testid={`leaderboard-row-${entry.rank}`}
                    data-current-user={isCurrentUser ? "true" : "false"}
                    className={
                      isCurrentUser
                        ? "bg-emerald-500/15 text-emerald-200 font-semibold"
                        : "text-slate-200 hover:bg-slate-800/40"
                    }
                  >
                    <td className="px-5 py-3.5 text-base font-bold">
                      <span>{rankBadge(entry.rank)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span>{entry.display_name}</span>
                        {isCurrentUser && (
                          <span className="rounded-full bg-emerald-500/25 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-extrabold text-emerald-400">
                      {entry.points.toLocaleString("en-IN")} pts
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CTA Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-5">
        <div>
          <h3 className="text-sm font-bold text-white">Want to climb the ranks?</h3>
          <p className="text-xs text-slate-400">
            Submit segregated waste batches daily to earn 10 pts/kg plus 7, 14, and 30-day streak bonuses.
          </p>
        </div>
        <Link
          to="/intake"
          className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shrink-0"
        >
          Earn more points →
        </Link>
      </div>
    </div>
  );
};

export default LeaderboardPage;
