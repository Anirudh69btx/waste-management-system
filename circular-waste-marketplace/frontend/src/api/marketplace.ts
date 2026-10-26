import { apiClient } from "./client";
import type {
  MarketplaceListingRead,
  ListingListResponse,
  BidCreate,
  BidRead,
  BuyNowRequest,
  PurchaseOrderRead,
  OrderListResponse,
  InventoryLotRead,
} from "./types";

export async function listListings(params: {
  category_id?: number;
  status?: string;
  price_min?: number;
  price_max?: number;
  seller_id?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ListingListResponse> {
  const q = new URLSearchParams();
  if (params.category_id) q.append("category_id", String(params.category_id));
  if (params.status) q.append("status", params.status);
  if (params.price_min) q.append("price_min", String(params.price_min));
  if (params.price_max) q.append("price_max", String(params.price_max));
  if (params.seller_id) q.append("seller_id", params.seller_id);
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<ListingListResponse>(`/marketplace/listings?${q.toString()}`);
  return res.data;
}

export async function getListing(id: string): Promise<MarketplaceListingRead> {
  const res = await apiClient.get<MarketplaceListingRead>(`/marketplace/listings/${id}`);
  return res.data;
}

export async function placeBid(listingId: string, payload: BidCreate): Promise<BidRead> {
  const res = await apiClient.post<BidRead>(`/marketplace/listings/${listingId}/bids`, payload);
  return res.data;
}

export async function buyNow(listingId: string, payload: BuyNowRequest): Promise<PurchaseOrderRead> {
  const res = await apiClient.post<PurchaseOrderRead>(`/marketplace/listings/${listingId}/buy-now`, payload);
  return res.data;
}

export async function listMyOrders(params: { role?: "buyer" | "seller"; limit?: number; offset?: number } = {}): Promise<OrderListResponse> {
  const q = new URLSearchParams();
  if (params.role) q.append("role_view", params.role);
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<OrderListResponse>(`/marketplace/orders?${q.toString()}`);
  return res.data;
}

export async function getOrder(id: string): Promise<PurchaseOrderRead> {
  const res = await apiClient.get<PurchaseOrderRead>(`/marketplace/orders/${id}`);
  return res.data;
}

export async function confirmPayment(orderId: string): Promise<PurchaseOrderRead> {
  const res = await apiClient.post<PurchaseOrderRead>(`/marketplace/orders/${orderId}/confirm-payment`, {});
  return res.data;
}

export async function completeOrder(orderId: string, note?: string): Promise<PurchaseOrderRead> {
  const res = await apiClient.post<PurchaseOrderRead>(`/marketplace/orders/${orderId}/complete`, { note });
  return res.data;
}

export async function listInventoryLots(params: { category_id?: number; status?: string; limit?: number; offset?: number } = {}): Promise<{ items: InventoryLotRead[]; total: number }> {
  const q = new URLSearchParams();
  if (params.category_id) q.append("category_id", String(params.category_id));
  if (params.status) q.append("status", params.status);
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<{ items: InventoryLotRead[]; total: number }>(`/inventory/lots?${q.toString()}`);
  return res.data;
}

export interface CreateListingFromLotPayload {
  inventory_lot_id: string;
  title: string;
  description?: string;
  price_per_kg: number;
  min_bid_kg: number;
}

export async function createListing(payload: CreateListingFromLotPayload): Promise<MarketplaceListingRead> {
  const res = await apiClient.post<MarketplaceListingRead>(`/marketplace/listings`, payload);
  return res.data;
}
