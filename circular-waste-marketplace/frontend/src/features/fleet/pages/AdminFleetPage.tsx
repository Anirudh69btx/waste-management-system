import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  VehicleRead,
  TripRead,
  PickupRequestRead,
  VehicleLocationRead,
} from '../../../api/types';
import {
  listVehicles,
  listTrips,
  cancelTrip,
  getVehicleLocation,
} from '../../../api/fleet';
import { listPickups } from '../../../api/pickups';
import { LiveMap, MapMarker } from '../components/LiveMap';
import { TripCreateModal } from '../components/TripCreateModal';
import { toast } from 'react-hot-toast';

export const AdminFleetPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<VehicleRead[]>([]);
  const [trips, setTrips] = useState<TripRead[]>([]);
  const [pickups, setPickups] = useState<PickupRequestRead[]>([]);
  const [vehicleLocations, setVehicleLocations] = useState<Record<string, VehicleLocationRead>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'trips' | 'unassigned'>('trips');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [vRes, tRes, pRes] = await Promise.all([
        listVehicles({ limit: 100 }),
        listTrips({ limit: 100 }),
        listPickups({ limit: 100 }),
      ]);

      setVehicles(vRes.items || []);
      setTrips(tRes.items || []);
      setPickups(pRes.items || []);

      // Fetch location for active/in-use vehicles
      const inUseVehicles = (vRes.items || []).filter(
        (v: VehicleRead) => v.status === 'in_use' || v.current_lat !== null
      );
      const locMap: Record<string, VehicleLocationRead> = {};
      await Promise.all(
        inUseVehicles.map(async (v: VehicleRead) => {
          try {
            const loc = await getVehicleLocation(v.id);
            locMap[v.id] = loc;
          } catch {
            // Ignore individual location fetch failures
          }
        })
      );
      setVehicleLocations(locMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load fleet data';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // 10s poll interval for fleet live tracking
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCancelTrip = async (tripId: string) => {
    if (!window.confirm('Are you sure you want to cancel this trip?')) return;
    try {
      await cancelTrip(tripId, 'Cancelled by Admin');
      toast.success('Trip cancelled');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel trip';
      toast.error(msg);
    }
  };

  // Filter unassigned pickups (requested or accepted, without an active trip stop)
  const assignedPickupIds = useMemo(() => {
    const ids = new Set<string>();
    trips.forEach((t) => {
      if (t.status === 'planned' || t.status === 'in_progress') {
        t.stops.forEach((s) => ids.add(s.pickup_request_id));
      }
    });
    return ids;
  }, [trips]);

  const unassignedPickups = useMemo(() => {
    return pickups.filter(
      (p) =>
        (p.status === 'requested' || p.status === 'accepted') &&
        !assignedPickupIds.has(p.id)
    );
  }, [pickups, assignedPickupIds]);

  // Active trips
  const activeTrips = useMemo(() => {
    return trips.filter((t) => t.status === 'in_progress' || t.status === 'planned');
  }, [trips]);

  // Available vehicles
  const availableVehicles = useMemo(() => {
    return vehicles.filter((v) => v.status === 'available');
  }, [vehicles]);

  // Compute stats
  const stats = useMemo(() => {
    const activeTripsCount = activeTrips.length;
    const waitingAssignmentCount = unassignedPickups.length;
    const availableVehiclesCount = availableVehicles.length;
    const capacityInUse = activeTrips.reduce((acc, t) => acc + (t.total_weight_kg || 0), 0);

    return {
      activeTripsCount,
      waitingAssignmentCount,
      availableVehiclesCount,
      capacityInUse,
    };
  }, [activeTrips, unassignedPickups, availableVehicles]);

  // Build markers for LiveMap
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];

    // 1. Vehicle markers
    vehicles.forEach((v) => {
      const loc = vehicleLocations[v.id];
      const lat = loc?.lat ?? (v.current_lat ? Number(v.current_lat) : null);
      const lng = loc?.lng ?? (v.current_lng ? Number(v.current_lng) : null);

      if (lat !== null && lng !== null) {
        markers.push({
          id: `veh-${v.id}`,
          lat,
          lng,
          kind: 'vehicle',
          label: `${v.plate_number} (${v.status})`,
          status: v.status,
          isSimulated: loc?.is_simulated || v.last_ping_source === 'simulated',
        });
      }
    });

    return markers;
  }, [vehicles, vehicleLocations]);

  // Prepare drivers list for modal (drivers assigned to available vehicles or unassigned)
  const driversList = useMemo(() => {
    const driversMap = new Map<string, { id: string; full_name: string; email: string }>();
    vehicles.forEach((v) => {
      if (v.assigned_driver_user_id) {
        driversMap.set(v.assigned_driver_user_id, {
          id: v.assigned_driver_user_id,
          full_name: `Driver (${v.assigned_driver_user_id.slice(0, 8)})`,
          email: `driver-${v.assigned_driver_user_id.slice(0, 6)}@cwm.io`,
        });
      }
    });
    return Array.from(driversMap.values());
  }, [vehicles]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🗺️</span> Fleet Management & Live Dispatch
          </h1>
          <p className="text-sm text-slate-400">
            Real-time vehicle telemetry, route optimization, and pickup dispatching
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition-colors"
          >
            🔄 Refresh
          </button>
          <button
            data-testid="create-trip-btn"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-900/40 transition-colors"
          >
            + Create Trip
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Trips</span>
            <span className="text-emerald-400 text-lg">🚛</span>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {stats.activeTripsCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">Trips currently in progress or planned</p>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Waiting Assignment
            </span>
            <span className="text-amber-400 text-lg">📦</span>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {stats.waitingAssignmentCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">Pending pickups without active trip</p>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Vehicles Available
            </span>
            <span className="text-blue-400 text-lg">🟢</span>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {stats.availableVehiclesCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">Ready for assignment</p>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Payload in Transit
            </span>
            <span className="text-purple-400 text-lg">⚖️</span>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {stats.capacityInUse.toFixed(0)} <span className="text-lg font-normal text-slate-400">kg</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Active transit load</p>
        </div>
      </div>

      {/* Live Map Panel */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 px-2">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>🛰️</span> Live Operations Map
          </h2>
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Auto-refreshing every 10s
          </span>
        </div>
        <LiveMap markers={mapMarkers} height="480px" />
      </div>

      {/* Tabs & Tables */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('trips')}
            className={`px-6 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'trips'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Active Trips ({activeTrips.length})
          </button>
          <button
            onClick={() => setActiveTab('unassigned')}
            className={`px-6 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'unassigned'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Waiting for Assignment ({unassignedPickups.length})
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'trips' ? (
            <div className="overflow-x-auto">
              {activeTrips.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No active trips found. Click "+ Create Trip" to dispatch one.
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Trip ID</th>
                      <th className="py-3 px-4">Vehicle</th>
                      <th className="py-3 px-4">Driver</th>
                      <th className="py-3 px-4">Stops Progress</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Started At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeTrips.map((trip) => {
                      const veh = vehicles.find((v) => v.id === trip.vehicle_id);
                      const completedCount = trip.stops.filter((s) => s.status === 'completed').length;
                      return (
                        <tr key={trip.id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-mono text-xs text-white">
                            #{trip.id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-200">
                            {veh ? `${veh.plate_number} (${veh.capacity_kg}kg)` : trip.vehicle_id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {trip.driver_user_id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-emerald-400">
                              {completedCount}
                            </span>{' '}
                            / {trip.stops.length} stops
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                                trip.status === 'in_progress'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}
                            >
                              {trip.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-400">
                            {trip.started_at ? new Date(trip.started_at).toLocaleTimeString() : 'Not started'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleCancelTrip(trip.id)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 transition-colors"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {unassignedPickups.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No pickups waiting for assignment. All scheduled pickups are assigned.
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Pickup ID</th>
                      <th className="py-3 px-4">Intake ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Scheduled Window</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {unassignedPickups.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono text-xs text-white">
                          #{p.id.slice(0, 8)}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">
                          #{p.intake_id.slice(0, 8)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase bg-amber-950 text-amber-400 border border-amber-800">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {new Date(p.scheduled_start).toLocaleDateString()}{' '}
                          {new Date(p.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {new Date(p.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-3 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            + Add to Trip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trip Create Modal */}
      <TripCreateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => loadData()}
        vehicles={vehicles}
        drivers={driversList}
        unassignedPickups={unassignedPickups}
      />
    </div>
  );
};

export default AdminFleetPage;
