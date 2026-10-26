import { apiClient } from "./client";
import type {
  RewardWallet, RewardTransaction, EcoProduct, EcoOrder,
  LeaderboardResponse, LeaderboardPeriod,
} from "./types";

export async function getWallet(): Promise<RewardWallet> {
  const res = await apiClient.get<RewardWallet>("/rewards/wallet");
  return res.data;
}

export async function listTransactions(limit = 20, offset = 0): Promise<{ items: RewardTransaction[]; total: number }> {
  const res = await apiClient.get<{ items: RewardTransaction[]; total: number }>(
    `/rewards/transactions?limit=${limit}&offset=${offset}`
  );
  return res.data;
}

export async function listProducts(): Promise<{ items: EcoProduct[]; total: number }> {
  const res = await apiClient.get<{ items: EcoProduct[]; total: number }>("/rewards/products");
  return res.data;
}

export async function redeemVoucher(productId: string): Promise<EcoOrder> {
  const res = await apiClient.post<EcoOrder>("/rewards/redeem", { product_id: productId });
  return res.data;
}

export async function listMyEcoOrders(): Promise<{ items: EcoOrder[]; total: number }> {
  const res = await apiClient.get<{ items: EcoOrder[]; total: number }>("/rewards/orders");
  return res.data;
}

export async function getLeaderboard(period: LeaderboardPeriod = "week"): Promise<LeaderboardResponse> {
  const res = await apiClient.get<LeaderboardResponse>(`/rewards/leaderboard?period=${period}`);
  return res.data;
}
