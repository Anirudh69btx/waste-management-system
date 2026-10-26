import { apiClient } from "./client";
import type { SupplierAnalytics, SellerAnalytics, AdminAnalytics, AnalyticsPeriod } from "./types";

function periodToRange(period: AnalyticsPeriod): { from_date: string; to_date: string } {
  const today = new Date();
  const to_date = today.toISOString().slice(0, 10);
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  return { from_date: from.toISOString().slice(0, 10), to_date };
}

export async function getSupplierAnalytics(period: AnalyticsPeriod = "30d"): Promise<SupplierAnalytics> {
  const { from_date, to_date } = periodToRange(period);
  const res = await apiClient.get<SupplierAnalytics>(
    `/analytics/supplier?from_date=${from_date}&to_date=${to_date}`
  );
  return res.data;
}

export async function getSellerAnalytics(period: AnalyticsPeriod = "30d"): Promise<SellerAnalytics> {
  const { from_date, to_date } = periodToRange(period);
  const res = await apiClient.get<SellerAnalytics>(
    `/analytics/seller?from_date=${from_date}&to_date=${to_date}`
  );
  return res.data;
}

export async function getAdminAnalytics(period: AnalyticsPeriod = "30d"): Promise<AdminAnalytics> {
  const { from_date, to_date } = periodToRange(period);
  const res = await apiClient.get<AdminAnalytics>(
    `/analytics/admin?from_date=${from_date}&to_date=${to_date}`
  );
  return res.data;
}
