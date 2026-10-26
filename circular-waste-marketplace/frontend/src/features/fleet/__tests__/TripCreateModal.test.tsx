import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TripCreateModal } from '../components/TripCreateModal';
import * as fleetApi from '../../../api/fleet';

vi.mock('../../../api/fleet', () => ({
  createTrip: vi.fn(),
  suggestRoute: vi.fn(),
}));

describe('TripCreateModal Component', () => {
  const mockVehicles = [
    {
      id: 'v-1',
      plate_number: 'KA05MH9999',
      capacity_kg: 500,
      fuel_type: 'diesel',
      status: 'available',
      assigned_driver_user_id: null,
      current_lat: null,
      current_lng: null,
      last_ping_at: null,
      last_ping_source: null,
      created_at: '',
      updated_at: '',
    },
  ];

  const mockDrivers = [
    {
      id: 'd-1',
      full_name: 'Rajesh Driver',
      email: 'rajesh@cwm.io',
    },
  ];

  const mockPickups = [
    {
      id: 'p-organic',
      intake_id: 'i-1',
      requested_by_user_id: 'u-1',
      assigned_driver_user_id: null,
      scheduled_start: '',
      scheduled_end: '',
      actual_pickup_at: null,
      status: 'requested' as const,
      cancellation_reason: null,
      failure_reason: null,
      notes: null,
      created_at: '',
      updated_at: '',
      declared_weight_kg: 200,
      category_id: 33, // ORGANIC
      supplier_name: 'Metro Kitchens',
    },
    {
      id: 'p-hazard',
      intake_id: 'i-2',
      requested_by_user_id: 'u-2',
      assigned_driver_user_id: null,
      scheduled_start: '',
      scheduled_end: '',
      actual_pickup_at: null,
      status: 'requested' as const,
      cancellation_reason: null,
      failure_reason: null,
      notes: null,
      created_at: '',
      updated_at: '',
      declared_weight_kg: 100,
      category_id: 39, // HAZARDOUS
      supplier_name: 'Chemical Industries',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with vehicle and driver select dropdowns when open', () => {
    render(
      <TripCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vehicles={mockVehicles}
        drivers={mockDrivers}
        unassignedPickups={mockPickups}
      />
    );

    expect(screen.getByTestId('trip-create-modal')).toBeInTheDocument();
    expect(screen.getByText(/KA05MH9999/)).toBeInTheDocument();
    expect(screen.getByText(/Rajesh Driver/)).toBeInTheDocument();
  });

  it('renders unassigned pickups list with supplier name and weight', () => {
    render(
      <TripCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vehicles={mockVehicles}
        drivers={mockDrivers}
        unassignedPickups={mockPickups}
      />
    );

    expect(screen.getByText('Metro Kitchens')).toBeInTheDocument();
    expect(screen.getByText('200 kg')).toBeInTheDocument();
    expect(screen.getByText('Chemical Industries')).toBeInTheDocument();
    expect(screen.getByText('100 kg')).toBeInTheDocument();
  });

  it('locks waste stream and prevents incompatible pickup selection', async () => {
    render(
      <TripCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vehicles={mockVehicles}
        drivers={mockDrivers}
        unassignedPickups={mockPickups}
      />
    );

    // Select organic pickup
    fireEvent.click(screen.getByText('Metro Kitchens'));

    // Should now show locked stream badge
    expect(screen.getByText(/Locked Stream: ORGANIC/i)).toBeInTheDocument();

    // Hazard pickup should indicate cannot mix
    expect(screen.getByText(/Cannot mix with ORGANIC/i)).toBeInTheDocument();
  });

  it('triggers suggestRoute API when suggest route button is clicked', async () => {
    vi.mocked(fleetApi.suggestRoute).mockResolvedValue({
      vehicle_id: 'v-1',
      total_distance_km: 12.4,
      total_weight_kg: 200,
      waste_stream: 'ORGANIC',
      suggested_stops: [
        {
          pickup_request_id: 'p-organic',
          supplier_id: 'sup-1',
          supplier_name: 'Metro Kitchens',
          latitude: 19.076,
          longitude: 72.877,
          waste_stream: 'ORGANIC',
          declared_weight_kg: 200,
          sequence: 1,
          distance_from_prev_km: 2.5,
        },
      ],
    });

    render(
      <TripCreateModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        vehicles={mockVehicles}
        drivers={mockDrivers}
        unassignedPickups={mockPickups}
      />
    );

    // Choose vehicle first
    const vehicleSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(vehicleSelect, { target: { value: 'v-1' } });

    // Click suggest route button
    const suggestBtn = screen.getByRole('button', { name: /suggest route/i });
    fireEvent.click(suggestBtn);

    await waitFor(() => {
      expect(fleetApi.suggestRoute).toHaveBeenCalledWith({
        vehicle_id: 'v-1',
        max_stops: 10,
      });
    });
  });
});
