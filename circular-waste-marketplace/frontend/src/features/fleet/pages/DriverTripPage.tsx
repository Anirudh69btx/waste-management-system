import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '../../auth/store';
import { TripRead, TripStopRead } from '../../../api/types';
import {
  listTrips,
  startTrip,
  endTrip,
  arriveAtStop,
  failStop,
} from '../../../api/fleet';
import { useGpsPolling } from '../hooks/useGpsPolling';
import { LiveMap, MapMarker, MapPolyline } from '../components/LiveMap';
import { DriverStopDetailModal } from '../components/DriverStopDetailModal';
import { toast } from 'react-hot-toast';

export const DriverTripPage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTrip, setActiveTrip] = useState<TripRead | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedStopForDetail, setSelectedStopForDetail] = useState<TripStopRead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isActionBusy, setIsActionBusy] = useState<boolean>(false);

  const vehicleLocation = useGpsPolling(activeTrip?.vehicle_id ?? null, 10000);

  const loadActiveTrip = useCallback(async () => {
    if (!user) return;
    try {
      // Find trips for this driver that are planned or in_progress
      const res = await listTrips({
        driver_user_id: user.id,
        limit: 10,
      });
      const inProgress = (res.items || []).find(
        (t) => t.status === 'in_progress' || t.status === 'planned'
      );
      setActiveTrip(inProgress || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load driver trip';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadActiveTrip();
  }, [loadActiveTrip]);

  const handleStartTrip = async () => {
    if (!activeTrip) return;
    setIsActionBusy(true);
    try {
      const updated = await startTrip(activeTrip.id);
      setActiveTrip(updated);
      toast.success('Trip started! Proceed to first pickup.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start trip';
      toast.error(msg);
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleArrive = async (stopId: string) => {
    if (!activeTrip) return;
    setIsActionBusy(true);
    try {
      const updated = await arriveAtStop(activeTrip.id, stopId);
      setActiveTrip(updated);
      toast.success('Marked as arrived at pickup!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark arrival';
      toast.error(msg);
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleFailStop = async (stopId: string) => {
    if (!activeTrip) return;
    const reason = window.prompt('Enter reason for pickup failure (e.g. Facility closed, Wrong material):');
    if (!reason || !reason.trim()) return;

    setIsActionBusy(true);
    try {
      const updated = await failStop(activeTrip.id, stopId, reason.trim());
      setActiveTrip(updated);
      toast.error(`Stop marked failed: ${reason}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record stop failure';
      toast.error(msg);
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;
    if (!window.confirm('All stops are finished. Complete and end this trip now?')) return;
    setIsActionBusy(true);
    try {
      await endTrip(activeTrip.id);
      toast.success('Trip successfully completed and closed!');
      loadActiveTrip();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to end trip';
      toast.error(msg);
    } finally {
      setIsActionBusy(false);
    }
  };

  // Map markers & polylines
  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];
    if (!activeTrip) return markers;

    // Vehicle marker
    if (vehicleLocation?.lat !== null && vehicleLocation?.lng !== null && vehicleLocation) {
      markers.push({
        id: `driver-veh-${activeTrip.vehicle_id}`,
        lat: vehicleLocation.lat,
        lng: vehicleLocation.lng,
        kind: 'vehicle',
        label: `My Vehicle (${vehicleLocation.plate_number})`,
        status: activeTrip.status,
        isSimulated: vehicleLocation.is_simulated,
      });
    }

    return markers;
  }, [activeTrip, vehicleLocation]);

  const polylines = useMemo<MapPolyline[]>(() => {
    return [];
  }, []);

  const allStopsFinished = useMemo(() => {
    if (!activeTrip || activeTrip.stops.length === 0) return false;
    return activeTrip.stops.every((s) => s.status === 'completed' || s.status === 'failed');
  }, [activeTrip]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-400">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span>Loading trip assignment...</span>
        </div>
      </div>
    );
  }

  if (!activeTrip) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center text-center">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-3xl">
            🚛
          </div>
          <h2 className="text-xl font-bold text-white">No Active Trip Assigned</h2>
          <p className="text-sm text-slate-400">
            You currently have no scheduled or active dispatch trips. When a dispatcher assigns a
            route, it will appear here immediately.
          </p>
          <button
            onClick={() => loadActiveTrip()}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
          >
            Check Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Banner for Simulated Telemetry Honesty */}
      {vehicleLocation?.is_simulated ? (
        <div
          data-testid="simulated-telemetry-banner"
          className="rounded-xl bg-amber-950/80 border border-amber-600/60 p-3.5 flex items-center justify-between text-amber-200 shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Simulated Telemetry Active
              </p>
              <p className="text-xs text-amber-300/90">
                GPS pings for this vehicle are artificially generated by the simulation engine for demo & testing.
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">
            SIMULATED
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-end text-xs text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
          Live GPS Connected
        </div>
      )}

      {/* Trip Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">
              Trip #{activeTrip.id.slice(0, 8)}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                activeTrip.status === 'in_progress'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}
            >
              {activeTrip.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Total Stops: {activeTrip.stops.length} • Vehicle: {activeTrip.vehicle_id.slice(0, 8)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTrip.status === 'planned' && (
            <button
              disabled={isActionBusy}
              onClick={handleStartTrip}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 transition-colors disabled:opacity-50"
            >
              {isActionBusy ? 'Starting...' : '🚀 Start Trip'}
            </button>
          )}

          {activeTrip.status === 'in_progress' && allStopsFinished && (
            <button
              disabled={isActionBusy}
              onClick={handleEndTrip}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 transition-colors disabled:opacity-50"
            >
              {isActionBusy ? 'Ending...' : '🏁 Complete & End Trip'}
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Live Map + Stop List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stops List (Left 1 Col) */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4">
          <h2 className="text-base font-semibold text-white px-2">Itinerary Stops</h2>

          <div className="space-y-3">
            {activeTrip.stops
              .slice()
              .sort((a, b) => a.sequence - b.sequence)
              .map((stop) => {
                const isEnRoute = stop.status === 'en_route';
                const isArrived = stop.status === 'arrived';
                const isDone = stop.status === 'completed';
                const isFailed = stop.status === 'failed';

                return (
                  <div
                    key={stop.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isArrived
                        ? 'bg-amber-950/30 border-amber-500/80 shadow-md'
                        : isEnRoute
                        ? 'bg-emerald-950/20 border-emerald-500/50'
                        : isDone
                        ? 'bg-slate-900/40 border-slate-800 opacity-60'
                        : isFailed
                        ? 'bg-rose-950/20 border-rose-800 opacity-60'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">
                          {stop.sequence}
                        </span>
                        Pickup #{stop.pickup_request_id.slice(0, 8)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isDone
                            ? 'bg-emerald-900/60 text-emerald-300'
                            : isFailed
                            ? 'bg-rose-900/60 text-rose-300'
                            : isArrived
                            ? 'bg-amber-900/60 text-amber-300 animate-pulse'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {stop.status}
                      </span>
                    </div>

                    {stop.failure_reason && (
                      <p className="text-xs text-rose-400 mb-2 font-mono">
                        Failure: {stop.failure_reason}
                      </p>
                    )}

                    {/* Driver actions per stop status */}
                    {activeTrip.status === 'in_progress' && (
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/80">
                        {isEnRoute && (
                          <button
                            disabled={isActionBusy}
                            onClick={() => handleArrive(stop.id)}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            📍 I have Arrived
                          </button>
                        )}

                        {isArrived && (
                          <button
                            onClick={() => {
                              setSelectedStopForDetail(stop);
                              setIsModalOpen(true);
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg"
                          >
                            ⚖️ Weigh & Complete
                          </button>
                        )}

                        {(isEnRoute || isArrived) && (
                          <button
                            disabled={isActionBusy}
                            onClick={() => handleFailStop(stop.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-medium transition-colors"
                          >
                            Fail
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Live Map (Right 2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl flex flex-col">
          <h2 className="text-base font-semibold text-white px-2 mb-3">Live Navigation Map</h2>
          <div className="flex-1 min-h-[460px]">
            <LiveMap
              markers={mapMarkers}
              polylines={polylines}
              center={
                vehicleLocation?.lat !== null && vehicleLocation?.lng !== null && vehicleLocation
                  ? [vehicleLocation.lat, vehicleLocation.lng]
                  : undefined
              }
              height="100%"
            />
          </div>
        </div>
      </div>

      {/* Driver Stop Detail Modal for QR Scan & Weight Ticket */}
      <DriverStopDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStopForDetail(null);
        }}
        tripId={activeTrip.id}
        stop={selectedStopForDetail}
        intakeId={selectedStopForDetail?.pickup_request_id}
        expectedBatchCode={`INT-${selectedStopForDetail?.pickup_request_id.slice(0, 6).toUpperCase()}`}
        onSuccess={() => loadActiveTrip()}
      />
    </div>
  );
};

export default DriverTripPage;
