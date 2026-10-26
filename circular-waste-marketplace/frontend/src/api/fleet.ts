import { apiClient } from './client';
import {
  VehicleRead,
  VehicleCreatePayload,
  VehicleUpdatePayload,
  VehicleListResponse,
  TripRead,
  TripListResponse,
  CreateTripPayload,
  VehicleLocationRead,
  GpsPingRead,
  RecordPingPayload,
  RouteSuggestionRequest,
  RouteSuggestionResponse,
} from './types';

export interface VehicleFilterParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface TripFilterParams {
  status?: string;
  vehicle_id?: string;
  driver_user_id?: string;
  limit?: number;
  offset?: number;
}

// ─── Vehicle Endpoints ─────────────────────────────────────────────────────────

export async function listVehicles(params?: VehicleFilterParams): Promise<VehicleListResponse> {
  const response = await apiClient.get<VehicleListResponse>('/fleet/vehicles', { params });
  return response.data;
}

export async function createVehicle(payload: VehicleCreatePayload): Promise<VehicleRead> {
  const response = await apiClient.post<VehicleRead>('/fleet/vehicles', payload);
  return response.data;
}

export async function updateVehicle(id: string, payload: VehicleUpdatePayload): Promise<VehicleRead> {
  const response = await apiClient.patch<VehicleRead>(`/fleet/vehicles/${id}`, payload);
  return response.data;
}

export async function assignDriver(vehicleId: string, driverUserId: string): Promise<VehicleRead> {
  const response = await apiClient.patch<VehicleRead>(`/fleet/vehicles/${vehicleId}/assign-driver`, {
    driver_user_id: driverUserId,
  });
  return response.data;
}

// ─── Telemetry / GPS Endpoints ────────────────────────────────────────────────

export async function getVehicleLocation(vehicleId: string): Promise<VehicleLocationRead> {
  const response = await apiClient.get<VehicleLocationRead>(`/fleet/vehicles/${vehicleId}/location`);
  return response.data;
}

export async function getVehicleRoute(vehicleId: string, limit = 50): Promise<GpsPingRead[]> {
  const response = await apiClient.get<GpsPingRead[]>(`/fleet/vehicles/${vehicleId}/route`, {
    params: { limit },
  });
  return response.data;
}

export async function recordPing(vehicleId: string, payload: RecordPingPayload): Promise<GpsPingRead> {
  const response = await apiClient.post<GpsPingRead>(`/fleet/vehicles/${vehicleId}/gps-ping`, payload);
  return response.data;
}

// ─── Trip Endpoints ───────────────────────────────────────────────────────────

export async function listTrips(params?: TripFilterParams): Promise<TripListResponse> {
  const response = await apiClient.get<TripListResponse>('/fleet/trips', { params });
  return response.data;
}

export async function createTrip(payload: CreateTripPayload): Promise<TripRead> {
  const response = await apiClient.post<TripRead>('/fleet/trips', payload);
  return response.data;
}

export async function getTrip(id: string): Promise<TripRead> {
  const response = await apiClient.get<TripRead>(`/fleet/trips/${id}`);
  return response.data;
}

export async function startTrip(tripId: string): Promise<TripRead> {
  const response = await apiClient.post<TripRead>(`/fleet/trips/${tripId}/start`);
  return response.data;
}

export async function endTrip(tripId: string): Promise<TripRead> {
  const response = await apiClient.post<TripRead>(`/fleet/trips/${tripId}/end`);
  return response.data;
}

export async function cancelTrip(tripId: string, reason?: string): Promise<TripRead> {
  const response = await apiClient.post<TripRead>(`/fleet/trips/${tripId}/cancel`, {
    reason: reason || 'Trip cancelled by dispatcher',
  });
  return response.data;
}

export async function arriveAtStop(tripId: string, stopId: string): Promise<TripRead> {
  const response = await apiClient.post<TripRead>(`/fleet/trips/${tripId}/stops/${stopId}/arrive`);
  return response.data;
}

export async function completeStop(
  tripId: string,
  stopId: string,
  payload?: { notes?: string }
): Promise<TripRead> {
  const response = await apiClient.post<TripRead>(
    `/fleet/trips/${tripId}/stops/${stopId}/complete`,
    payload || {}
  );
  return response.data;
}

export async function failStop(
  tripId: string,
  stopId: string,
  reason: string
): Promise<TripRead> {
  const response = await apiClient.post<TripRead>(
    `/fleet/trips/${tripId}/stops/${stopId}/fail`,
    { reason }
  );
  return response.data;
}

// ─── Route Optimization / Suggestion ──────────────────────────────────────────

export async function suggestRoute(payload: RouteSuggestionRequest): Promise<RouteSuggestionResponse> {
  const response = await apiClient.post<RouteSuggestionResponse>('/fleet/routes/suggest', payload);
  return response.data;
}
