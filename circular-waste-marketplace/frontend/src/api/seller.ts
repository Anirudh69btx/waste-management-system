import { apiClient } from "./client";
import type {
  InventoryLotRead,
  MarketplaceListingRead,
  BidRead,
  PurchaseOrderRead,
  OrderListResponse,
  BidActionRequest,
  OrderShipRequest,
  OrderDeliverRequest,
  ListingCancelRequest,
  CreateListingFromLotPayload,
} from "./types";

export async function listMyInventoryLots(params: {
  status?: string;
  category_id?: number;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: InventoryLotRead[]; total: number }> {
  const q = new URLSearchParams();
  if (params.status) q.append("status", params.status);
  if (params.category_id) q.append("category_id", String(params.category_id));
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<{ items: InventoryLotRead[]; total: number }>(
    `/inventory/lots?${q.toString()}`
  );
  return res.data;
}

export async function createListingFromLot(
  payload: CreateListingFromLotPayload
): Promise<MarketplaceListingRead> {
  const res = await apiClient.post<MarketplaceListingRead>("/marketplace/listings", payload);
  return res.data;
}

export async function cancelListing(
  listingId: string,
  payload: ListingCancelRequest = {}
): Promise<MarketplaceListingRead> {
  const res = await apiClient.patch<MarketplaceListingRead>(
    `/marketplace/listings/${listingId}`,
    { status: "cancelled", ...payload }
  );
  return res.data;
}

export async function listListingBids(listingId: string): Promise<{ items: BidRead[]; total: number }> {
  const res = await apiClient.get<{ items: BidRead[]; total: number }>(
    `/marketplace/listings/${listingId}/bids`
  );
  return res.data;
}

export async function acceptBid(listingId: string, bidId: string): Promise<PurchaseOrderRead> {
  const res = await apiClient.post<PurchaseOrderRead>(
    `/marketplace/listings/${listingId}/bids/${bidId}/accept`,
    {}
  );
  return res.data;
}

export async function rejectBid(
  listingId: string,
  bidId: string,
  payload: BidActionRequest = {}
): Promise<BidRead> {
  const res = await apiClient.post<BidRead>(
    `/marketplace/listings/${listingId}/bids/${bidId}/reject`,
    payload
  );
  return res.data;
}

export async function listSellerOrders(params: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<OrderListResponse> {
  const q = new URLSearchParams();
  q.append("role_view", "seller");
  if (params.status) q.append("status", params.status);
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<OrderListResponse>(`/marketplace/orders?${q.toString()}`);
  return res.data;
}

export async function shipOrder(orderId: string, payload: OrderShipRequest = {}): Promise<PurchaseOrderRead> {
  const res = await apiClient.patch<PurchaseOrderRead>(
    `/marketplace/orders/${orderId}/ship`,
    payload
  );
  return res.data;
}

export async function deliverOrder(orderId: string, payload: OrderDeliverRequest = {}): Promise<PurchaseOrderRead> {
  const res = await apiClient.patch<PurchaseOrderRead>(
    `/marketplace/orders/${orderId}/deliver`,
    payload
  );
  return res.data;
}

export async function listMyListings(params: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: MarketplaceListingRead[]; total: number }> {
  const q = new URLSearchParams();
  if (params.status) q.append("status", params.status);
  q.append("limit", String(params.limit ?? 20));
  q.append("offset", String(params.offset ?? 0));
  const res = await apiClient.get<{ items: MarketplaceListingRead[]; total: number }>(
    `/marketplace/listings?${q.toString()}&seller_id=me`
  );
  return res.data;
}
