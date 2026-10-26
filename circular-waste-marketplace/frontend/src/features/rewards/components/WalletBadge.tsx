import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { getWallet } from "@/api/rewards";

export const WalletBadge: React.FC = () => {
  const navigate = useNavigate();
  const { data: wallet } = useQuery({
    queryKey: ["rewards", "wallet"],
    queryFn: getWallet,
    staleTime: 30_000,
  });

  const points = wallet?.points_balance ?? 0;
  const streak = wallet?.streak_days ?? 0;

  return (
    <button
      type="button"
      data-testid="wallet-badge"
      onClick={() => navigate("/rewards")}
      className="w-full flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
    >
      <span className="flex items-center gap-1.5">
        <Award className="h-3.5 w-3.5 text-emerald-400" />
        <span>{points.toLocaleString("en-IN")} pts</span>
      </span>
      {streak > 0 && (
        <span
          data-testid="wallet-badge-streak"
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300"
        >
          🔥 {streak}d
        </span>
      )}
    </button>
  );
};

export default WalletBadge;
