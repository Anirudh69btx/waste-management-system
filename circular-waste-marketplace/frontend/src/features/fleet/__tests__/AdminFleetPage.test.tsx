import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AdminFleetPage } from '../pages/AdminFleetPage';
import * as fleetApi from '../../../api/fleet';
import * as pickupsApi from '../../../api/pickups';

// Mock fleet API
vi.mock('../../../api/fleet', () => ({
  listVehicles: vi.fn(),
  listTrips: vi.fn(),
  cancelTrip: vi.fn(),
  getVehicleLocation: vi.fn(),
}));

// Mock pickups API
vi.mock('../../../api/pickups', () => ({
  listPickups: vi.fn(),
}));

// Mock LiveMap component
vi.mock('../components/LiveMap', () => ({
  LiveMap: () => <div data-testid="mock-live-map">LiveMap Mock</div>,
}));

describe('AdminFleetPage', () => {
  const mockVehicles = [
    {
      id: 'veh-1',
      plate_number: 'KA01AB1234',
      capacity_kg: 1000,
      fuel_type: 'diesel',
      status: 'available',
      assigned_driver_user_id: null,
      current_lat: 19.076,
      current_lng: 72.877,
      last_ping_at: null,
      last_ping_source: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockTrips = [
    {
      id: 'trip-1',
      vehicle_id: 'veh-1',
      driver_user_id: 'driver-1',
      status: 'in_progress',
      planned_distance_km: 15.5,
      actual_distance_km: 5.0,
      started_at: new Date().toISOString(),
      ended_at: null,
      total_weight_kg: 350,
      stops: [
        {
          id: 'stop-1',
          trip_id: 'trip-1',
          pickup_request_id: 'p-1',
          sequence: 1,
          status: 'completed',
          arrived_at: null,
          completed_at: null,
          failure_reason: null,
          notes: null,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockPickups = [
    {
      id: 'p-2',
      intake_id: 'intake-2',
      requested_by_user_id: 'user-2',
      assigned_driver_user_id: null,
      scheduled_start: new Date().toISOString(),
      scheduled_end: new Date().toISOString(),
      actual_pickup_at: null,
      status: 'requested' as const,
      cancellation_reason: null,
      failure_reason: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fleetApi.listVehicles).mockResolvedValue({
      items: mockVehicles,
      total: 1,
    });
    vi.mocked(fleetApi.listTrips).mockResolvedValue({
      items: mockTrips,
      total: 1,
    });
    vi.mocked(pickupsApi.listPickups).mockResolvedValue({
      items: mockPickups,
      total: 1,
      limit: 100,
      offset: 0,
    });
    vi.mocked(fleetApi.getVehicleLocation).mockResolvedValue({
      vehicle_id: 'veh-1',
      plate_number: 'KA01AB1234',
      lat: 19.076,
      lng: 72.877,
      speed_kmh: 30,
      heading: 90,
      recorded_at: new Date().toISOString(),
      source: 'simulated',
      is_simulated: true,
    });
  });

  it('renders 4 stat cards with aggregate metrics', async () => {
    render(<AdminFleetPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/active trips/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/waiting assignment/i)).toBeInTheDocument();
      expect(screen.getByText(/vehicles available/i)).toBeInTheDocument();
      expect(screen.getByText(/payload in transit/i)).toBeInTheDocument();
    });
  });

  it('renders live operations map panel', async () => {
    render(<AdminFleetPage />);
    await waitFor(() => {
      expect(screen.getByTestId('mock-live-map')).toBeInTheDocument();
      expect(screen.getByText(/live operations map/i)).toBeInTheDocument();
    });
  });

  it('renders active trips table with trip details', async () => {
    render(<AdminFleetPage />);
    await waitFor(() => {
      expect(screen.getByText(/trip-1/)).toBeInTheDocument();
      expect(screen.getByText(/KA01AB1234/)).toBeInTheDocument();
      expect(screen.getByText(/1 stops/)).toBeInTheDocument();
    });
  });

  it('switches to waiting for assignment tab and displays pending pickups', async () => {
    render(<AdminFleetPage />);
    await waitFor(() => {
      expect(screen.getByText(/Waiting for Assignment/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Waiting for Assignment/i));

    await waitFor(() => {
      expect(screen.getByText(/p-2/)).toBeInTheDocument();
      expect(screen.getByText(/\+ Add to Trip/i)).toBeInTheDocument();
    });
  });

  it('opens TripCreateModal when clicking "+ Create Trip" button', async () => {
    render(<AdminFleetPage />);
    await waitFor(() => {
      expect(screen.getByTestId('create-trip-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-trip-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('trip-create-modal')).toBeInTheDocument();
      expect(screen.getByText(/create dispatch trip/i)).toBeInTheDocument();
    });
  });
});
