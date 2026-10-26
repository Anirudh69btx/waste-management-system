import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DriverTripPage } from '../pages/DriverTripPage';
import * as fleetApi from '../../../api/fleet';
import * as authStoreModule from '../../auth/store';

// Mock auth store
vi.mock('../../auth/store', () => ({
  useAuthStore: vi.fn(),
}));

// Mock fleet API
vi.mock('../../../api/fleet', () => ({
  listTrips: vi.fn(),
  startTrip: vi.fn(),
  endTrip: vi.fn(),
  arriveAtStop: vi.fn(),
  failStop: vi.fn(),
  getVehicleLocation: vi.fn(),
}));

// Mock LiveMap component
vi.mock('../components/LiveMap', () => ({
  LiveMap: () => <div data-testid="mock-live-map">LiveMap Mock</div>,
}));

describe('DriverTripPage Component', () => {
  const mockUser = {
    id: 'driver-u1',
    email: 'driver@cwm.io',
    full_name: 'Driver Joe',
    role: 'LOGISTICS' as const,
  };

  const mockPlannedTrip = {
    id: 'trip-planned-1',
    vehicle_id: 'veh-1',
    driver_user_id: 'driver-u1',
    status: 'planned',
    planned_distance_km: 10,
    actual_distance_km: null,
    started_at: null,
    ended_at: null,
    total_weight_kg: 250,
    stops: [
      {
        id: 'stop-1',
        trip_id: 'trip-planned-1',
        pickup_request_id: 'pickup-1',
        sequence: 1,
        status: 'en_route',
        arrived_at: null,
        completed_at: null,
        failure_reason: null,
        notes: null,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockInProgressTrip = {
    ...mockPlannedTrip,
    id: 'trip-prog-1',
    status: 'in_progress',
    started_at: new Date().toISOString(),
    stops: [
      {
        id: 'stop-1',
        trip_id: 'trip-prog-1',
        pickup_request_id: 'pickup-1',
        sequence: 1,
        status: 'en_route',
        arrived_at: null,
        completed_at: null,
        failure_reason: null,
        notes: null,
      },
      {
        id: 'stop-2',
        trip_id: 'trip-prog-1',
        pickup_request_id: 'pickup-2',
        sequence: 2,
        status: 'arrived',
        arrived_at: new Date().toISOString(),
        completed_at: null,
        failure_reason: null,
        notes: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authStoreModule.useAuthStore).mockReturnValue({
      user: mockUser,
      status: 'authenticated',
      accessToken: 'token',
      refreshToken: null,
      setTokens: vi.fn(),
      clearTokens: vi.fn(),
      hydrate: vi.fn(),
      hasRole: vi.fn().mockReturnValue(true),
    });
  });

  it('renders "No Active Trip Assigned" when listTrips returns empty', async () => {
    vi.mocked(fleetApi.listTrips).mockResolvedValue({ items: [], total: 0 });

    render(<DriverTripPage />);

    await waitFor(() => {
      expect(screen.getByText(/no active trip assigned/i)).toBeInTheDocument();
    });
  });

  it('renders "Start Trip" button when assigned trip is in planned status', async () => {
    vi.mocked(fleetApi.listTrips).mockResolvedValue({
      items: [mockPlannedTrip],
      total: 1,
    });

    render(<DriverTripPage />);

    await waitFor(() => {
      expect(screen.getByText(/trip #trip-pla/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start trip/i })).toBeInTheDocument();
    });
  });

  it('calls startTrip API when "Start Trip" button is clicked', async () => {
    vi.mocked(fleetApi.listTrips).mockResolvedValue({
      items: [mockPlannedTrip],
      total: 1,
    });
    vi.mocked(fleetApi.startTrip).mockResolvedValue({
      ...mockPlannedTrip,
      status: 'in_progress',
    });

    render(<DriverTripPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start trip/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /start trip/i }));

    await waitFor(() => {
      expect(fleetApi.startTrip).toHaveBeenCalledWith('trip-planned-1');
    });
  });

  it('renders live itinerary stops and map when trip is in_progress', async () => {
    vi.mocked(fleetApi.listTrips).mockResolvedValue({
      items: [mockInProgressTrip],
      total: 1,
    });

    render(<DriverTripPage />);

    await waitFor(() => {
      expect(screen.getByText(/Itinerary Stops/i)).toBeInTheDocument();
      expect(screen.getByTestId('mock-live-map')).toBeInTheDocument();
      expect(screen.getByText(/I have Arrived/i)).toBeInTheDocument();
      expect(screen.getByText(/Weigh & Complete/i)).toBeInTheDocument();
    });
  });

  it('shows honest simulated telemetry banner when vehicle location is simulated', async () => {
    vi.mocked(fleetApi.listTrips).mockResolvedValue({
      items: [mockInProgressTrip],
      total: 1,
    });
    vi.mocked(fleetApi.getVehicleLocation).mockResolvedValue({
      vehicle_id: 'veh-1',
      plate_number: 'KA01AB1234',
      lat: 12.97,
      lng: 77.59,
      speed_kmh: 40,
      heading: 180,
      recorded_at: new Date().toISOString(),
      source: 'simulated',
      is_simulated: true,
    });

    render(<DriverTripPage />);

    await waitFor(() => {
      expect(screen.getByTestId('simulated-telemetry-banner')).toBeInTheDocument();
      expect(screen.getByText(/Simulated Telemetry Active/i)).toBeInTheDocument();
    });
  });

  it('opens stop detail modal when "Weigh & Complete" is clicked', async () => {
    vi.mocked(fleetApi.listTrips).mockResolvedValue({
      items: [mockInProgressTrip],
      total: 1,
    });

    render(<DriverTripPage />);

    await waitFor(() => {
      expect(screen.getByText(/Weigh & Complete/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Weigh & Complete/i));

    await waitFor(() => {
      expect(screen.getByTestId('driver-stop-detail-modal')).toBeInTheDocument();
    });
  });
});
