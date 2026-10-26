import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGpsPolling } from '../hooks/useGpsPolling';
import * as fleetApi from '../../../api/fleet';

vi.mock('../../../api/fleet', () => ({
  getVehicleLocation: vi.fn(),
}));

describe('useGpsPolling Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null and does not fetch when vehicleId is null', () => {
    const { result } = renderHook(() => useGpsPolling(null, 5000));
    expect(result.current).toBeNull();
    expect(fleetApi.getVehicleLocation).not.toHaveBeenCalled();
  });

  it('fetches vehicle location and updates state when vehicleId is provided', async () => {
    const mockLocation = {
      vehicle_id: 'veh-123',
      plate_number: 'KA01XY9876',
      lat: 12.9716,
      lng: 77.5946,
      speed_kmh: 45.0,
      heading: 90,
      recorded_at: new Date().toISOString(),
      source: 'simulated',
      is_simulated: true,
    };

    vi.mocked(fleetApi.getVehicleLocation).mockResolvedValue(mockLocation);

    const { result } = renderHook(() => useGpsPolling('veh-123', 5000));

    await waitFor(() => {
      expect(fleetApi.getVehicleLocation).toHaveBeenCalledWith('veh-123');
      expect(result.current).toEqual(mockLocation);
    });
  });
});
