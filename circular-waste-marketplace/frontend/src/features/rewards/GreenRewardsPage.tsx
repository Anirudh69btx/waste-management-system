import React, { useState } from "react";
import {
  Award,
  Flame,
  Sparkles,
  TreePine,
  CheckCircle2,
  Gift,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

export const GreenRewardsPage: React.FC = () => {
  const [points, setPoints] = useState(1250);
  const [streakDays] = useState(14);
  const [co2SavedKg] = useState(384.2);
  const [redeemedVouchers, setRedeemedVouchers] = useState<string[]>([]);

  const vouchers = [
    {
      id: "v-01",
      title: "₹100 Off Organic Fertilizer / Compost",
      cost: 500,
      partner: "Kisan Bio-Agri Store",
      code: "BIOCOMPOST100",
    },
    {
      id: "v-02",
      title: "Plant 2 Native Forest Trees in Western Ghats",
      cost: 750,
      partner: "Green Canopy Project",
      code: "TREE-PLANT-02",
    },
    {
      id: "v-03",
      title: "₹250 Industrial Secondary Logistics Freight Credit",
      cost: 1000,
      partner: "EV Green Haulage Logistics",
      code: "EVHAUL250",
    },
  ];

  const handleRedeem = (voucher: (typeof vouchers)[0]) => {
    if (points < voucher.cost) {
      alert("Insufficient eco-points balance.");
      return;
    }
    setPoints(points - voucher.cost);
    setRedeemedVouchers([...redeemedVouchers, voucher.id]);
    alert(`Redeemed voucher code: ${voucher.code}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Award className="h-6 w-6 text-brand-400" />
          <span>Green Loyalty Rewards & Impact Ledger</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Every kilogram of verified segregated waste earns points, unlocks recycling streak bonuses, and drives verified ESG impact.
        </p>
      </div>

      {/* Gamified Stat Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-card rounded-2xl p-6 border border-emerald-500/20 bg-emerald-950/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <span>Eco-Points Balance</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{points.toLocaleString()} pts</div>
          <p className="text-xs text-slate-400">Equivalent to ₹{(points * 0.01).toFixed(2)} in circular platform credits</p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-amber-500/20 bg-amber-950/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <span>Recycling Streak</span>
            <Flame className="h-4 w-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{streakDays} Days Active</div>
          <p className="text-xs text-slate-400">Next milestone: 21 days (+250 bonus points)</p>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-cyan-500/20 bg-cyan-950/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            <span>Avoided Carbon (CO₂e)</span>
            <TreePine className="h-4 w-4" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{co2SavedKg} kg</div>
          <p className="text-xs text-slate-400">Equivalent to planting ~19 mature urban trees</p>
        </div>
      </div>

      {/* Available Redemption Vouchers */}
      <div className="space-y-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Redeemable Vouchers & ESG Carbon Offsets
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {vouchers.map((v) => {
            const isRedeemed = redeemedVouchers.includes(v.id);
            return (
              <div
                key={v.id}
                className="glass-card glass-card-hover rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="purple">{v.partner}</Badge>
                    <span className="text-xs font-bold text-emerald-400 font-mono">{v.cost} pts</span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{v.title}</h3>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  {isRedeemed ? (
                    <div className="text-center py-1.5 px-3 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                      Claimed: {v.code}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={points < v.cost}
                      onClick={() => handleRedeem(v)}
                    >
                      <Gift className="h-4 w-4" />
                      <span>Redeem for {v.cost} pts</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
