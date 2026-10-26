import { useState, useEffect } from 'react';
import { VehicleLocationRead } from '../../../api/types';
import { getVehicleLocation } from '../../../api/fleet';

export function useGpsPolling(vehicleId: string | null, intervalMs = 10000): VehicleLocationRead | null {
  const [location, setLocation] = useState<VehicleLocationRead | null>(null);

  useEffect(() => {
    if (!vehicleId) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const loc = await getVehicleLocation(vehicleId);
        if (!cancelled) setLocation(loc);
      } catch {
        // Ignore polling errors silently
      }
    };

    tick();

    const id = setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [vehicleId, intervalMs]);

  return location;
}

export default useGpsPolling;
