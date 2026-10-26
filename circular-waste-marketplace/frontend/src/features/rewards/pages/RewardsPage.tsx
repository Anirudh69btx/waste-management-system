import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CheckCircle2,
  Flame,
  Gift,
  History,
  ShoppingBag,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import {
  getWallet,
  listMyEcoOrders,
  listProducts,
  listTransactions,
  redeemVoucher,
} from "@/api/rewards";
import type { EcoProduct } from "@/api/types";
import { AnimatedCounter } from "@/components/charts/AnimatedCounter";

export const RewardsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<EcoProduct | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const txLimit = showAllTransactions ? 50 : 10;

  const walletQuery = useQuery({
    queryKey: ["rewards", "wallet"],
    queryFn: getWallet,
  });

  const productsQuery = useQuery({
    queryKey: ["rewards", "products"],
    queryFn: listProducts,
  });

  const transactionsQuery = useQuery({
    queryKey: ["rewards", "transactions", txLimit],
    queryFn: () => listTransactions(txLimit, 0),
  });

  const ordersQuery = useQuery({
    queryKey: ["rewards", "orders"],
    queryFn: listMyEcoOrders,
  });

  const redeemMutation = useMutation({
    mutationFn: (productId: string) => redeemVoucher(productId),
    onSuccess: (order) => {
      setRedeemError(null);
      setRedeemSuccess(`Redeemed "${order.product_title}" (${order.order_code})`);
      setSelectedVoucher(null);
      void queryClient.invalidateQueries({ queryKey: ["rewards"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err instanceof Error ? err.message : "Failed to redeem voucher");
      setRedeemError(msg);
    },
  });

  const wallet = walletQuery.data;
  const products = productsQuery.data?.items ?? [];
  const transactions = transactionsQuery.data?.items ?? [];
  const totalTransactions = transactionsQuery.data?.total ?? 0;
  const orders = ordersQuery.data?.items ?? [];

  const pointsBalance = wallet?.points_balance ?? 0;
  const lifetimePoints = wallet?.lifetime_points ?? 0;
  const streakDays = wallet?.streak_days ?? 0;

  const pointsEarnedThisMonth = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return transactions
      .filter((tx) => {
        const ts = new Date(tx.created_at).getTime();
        return tx.points_delta > 0 && (!Number.isFinite(ts) || ts >= startOfMonth);
      })
      .reduce((acc, tx) => acc + tx.points_delta, 0);
  }, [transactions]);

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Card */}
      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/50 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Green Rewards Wallet</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span
                data-testid="wallet-points-balance"
                className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white"
              >
                <AnimatedCounter value={pointsBalance} />
              </span>
              <span className="text-lg font-semibold text-emerald-400">pts available</span>
            </div>
            <p className="text-sm text-slate-300">
              Lifetime earned:{" "}
              <span className="font-semibold text-white">
                {lifetimePoints.toLocaleString("en-IN")} pts
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              data-testid="streak-badge"
              className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-300"
            >
              <Flame className="h-4 w-4 text-amber-400" />
              <span>🔥 {streakDays}-day streak</span>
            </div>

            <Link
              to="/rewards/leaderboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 transition"
            >
              <Trophy className="h-4 w-4" />
              <span>Leaderboard →</span>
            </Link>
          </div>
        </div>
      </section>

      {redeemSuccess && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{redeemSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setRedeemSuccess(null)}
            className="text-xs text-emerald-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3 Stat Tiles */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Points Earned This Month</span>
            <Award className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            +{pointsEarnedThisMonth.toLocaleString("en-IN")} pts
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Vouchers Redeemed</span>
            <ShoppingBag className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{orders.length}</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Current Streak</span>
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{streakDays} days</div>
        </div>
      </section>

      {/* Vouchers Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-400" />
              <span>Circular Voucher Catalog</span>
            </h2>
            <p className="text-xs text-slate-400">
              Redeem points for circular economy products and verified impact certificates
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const outOfStock = product.stock_quantity <= 0;
            const insufficient = pointsBalance < product.points_cost;
            const disabled = outOfStock || insufficient;

            return (
              <div
                key={product.id}
                data-testid={`voucher-card-${product.id}`}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/75 p-5 transition hover:border-emerald-500/40"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                      {product.category}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        outOfStock
                          ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                          : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      }`}
                    >
                      {outOfStock ? "Out of stock" : `${product.stock_quantity} in stock`}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">{product.title}</h3>
                  {product.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">{product.description}</p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold text-emerald-400">
                      {product.points_cost.toLocaleString("en-IN")} pts
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Value ₹{Number(product.price).toLocaleString("en-IN")} / {product.unit}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setRedeemError(null);
                      setSelectedVoucher(product);
                    }}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                      disabled
                        ? "cursor-not-allowed bg-slate-800 text-slate-500"
                        : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                    }`}
                  >
                    {outOfStock ? "Out of Stock" : insufficient ? "Need More Points" : "Redeem"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Transactions & My Redemptions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Transactions */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-400" />
              <span>Recent Transactions</span>
            </h2>
            {totalTransactions > 10 && !showAllTransactions && (
              <button
                type="button"
                onClick={() => setShowAllTransactions(true)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                View all ({totalTransactions})
              </button>
            )}
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
              Earn points by submitting waste.
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {transactions.map((tx) => {
                const isPositive = tx.points_delta >= 0;
                return (
                  <li key={tx.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">
                        {tx.description}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold ${
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isPositive ? `+${tx.points_delta}` : tx.points_delta} pts
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* My Redemptions */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-emerald-400" />
            <span>My Redemptions</span>
          </h2>

          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
              No vouchers redeemed yet. Choose a circular reward above!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-semibold">Order</th>
                    <th className="pb-2 font-semibold">Voucher</th>
                    <th className="pb-2 font-semibold">Points</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {orders.map((order) => (
                    <tr key={order.id} className="text-slate-200">
                      <td className="py-2.5 font-mono text-[11px] text-slate-400">
                        {order.order_code}
                      </td>
                      <td className="py-2.5 font-medium">{order.product_title}</td>
                      <td className="py-2.5 text-emerald-400 font-semibold">
                        {order.points_paid} pts
                      </td>
                      <td className="py-2.5">
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Confirmation Modal */}
      {selectedVoucher && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Confirm Voucher Redemption</h3>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              Redeem <span className="font-semibold text-white">{selectedVoucher.title}</span> for{" "}
              <span className="font-bold text-emerald-400">
                {selectedVoucher.points_cost.toLocaleString("en-IN")} pts
              </span>
              ?
            </p>

            {redeemError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                {redeemError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={redeemMutation.isPending}
                onClick={() => redeemMutation.mutate(selectedVoucher.id)}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {redeemMutation.isPending ? "Redeeming..." : "Confirm Redeem"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RewardsPage;
