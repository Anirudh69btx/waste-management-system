import React, { useState, useMemo } from 'react';
import {
  VehicleRead,
  PickupRequestRead,
  CreateTripPayload,
  RouteSuggestionResponse,
} from '../../../api/types';
import { createTrip, suggestRoute } from '../../../api/fleet';
import { toast } from 'react-hot-toast';

interface DriverOption {
  id: string;
  full_name: string;
  email: string;
}

export interface TripCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicles: VehicleRead[];
  drivers: DriverOption[];
  unassignedPickups: (PickupRequestRead & {
    declared_weight_kg?: number;
    category_id?: number;
    supplier_name?: string;
  })[];
}

export function getWasteStreamClass(categoryId?: number): string {
  if (!categoryId) return 'GENERAL';
  if (categoryId === 33) return 'ORGANIC';
  if ([34, 35, 36, 37, 40].includes(categoryId)) return 'DRY_RECYCLABLE';
  if (categoryId === 38) return 'E_WASTE';
  if (categoryId === 39) return 'HAZARDOUS';
  return 'GENERAL';
}

export const TripCreateModal: React.FC<TripCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vehicles,
  drivers,
  unassignedPickups,
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedPickupIds, setSelectedPickupIds] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [suggestion, setSuggestion] = useState<RouteSuggestionResponse | null>(null);

  const availableVehicles = useMemo(
    () => vehicles.filter((v) => v.status === 'available'),
    [vehicles]
  );

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId),
    [vehicles, selectedVehicleId]
  );

  // Active waste stream class of selected pickups
  const activeStream = useMemo(() => {
    if (selectedPickupIds.length === 0) return null;
    const firstPickup = unassignedPickups.find((p) => p.id === selectedPickupIds[0]);
    return getWasteStreamClass(firstPickup?.category_id);
  }, [selectedPickupIds, unassignedPickups]);

  // Total weight of selected pickups
  const totalWeightKg = useMemo(() => {
    return selectedPickupIds.reduce((sum, id) => {
      const p = unassignedPickups.find((item) => item.id === id);
      return sum + (p?.declared_weight_kg || 0);
    }, 0);
  }, [selectedPickupIds, unassignedPickups]);

  const capacityKg = selectedVehicle ? Number(selectedVehicle.capacity_kg) : 0;
  const isOverCapacity = capacityKg > 0 && totalWeightKg > capacityKg;

  const handleTogglePickup = (pickupId: string, streamClass: string) => {
    if (selectedPickupIds.includes(pickupId)) {
      setSelectedPickupIds(selectedPickupIds.filter((id) => id !== pickupId));
      setSuggestion(null);
    } else {
      if (activeStream && activeStream !== streamClass) {
        toast.error(`Cannot mix waste stream "${streamClass}" with selected "${activeStream}"`);
        return;
      }
      setSelectedPickupIds([...selectedPickupIds, pickupId]);
      setSuggestion(null);
    }
  };

  const handleSuggestRoute = async () => {
    if (!selectedVehicleId) {
      toast.error('Please select a vehicle first');
      return;
    }
    setIsSuggesting(true);
    try {
      const res = await suggestRoute({
        vehicle_id: selectedVehicleId,
        max_stops: 10,
      });
      setSuggestion(res);
      // Auto-select the suggested pickups
      const suggestedIds = res.suggested_stops.map((s) => s.pickup_request_id);
      setSelectedPickupIds(suggestedIds);
      toast.success(`Optimized route suggested with ${res.suggested_stops.length} stops!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to suggest route';
      toast.error(msg);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedVehicleId) {
      toast.error('Please select a vehicle');
      return;
    }
    if (!selectedDriverId) {
      toast.error('Please select a driver');
      return;
    }
    if (selectedPickupIds.length === 0) {
      toast.error('Please select at least one pickup');
      return;
    }
    if (isOverCapacity) {
      toast.error(`Total weight (${totalWeightKg}kg) exceeds vehicle capacity (${capacityKg}kg)`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Build stops list with sequences
      const stops = suggestion
        ? suggestion.suggested_stops
            .filter((s) => selectedPickupIds.includes(s.pickup_request_id))
            .map((s, idx) => ({
              pickup_request_id: s.pickup_request_id,
              sequence: idx + 1,
            }))
        : selectedPickupIds.map((id, idx) => ({
            pickup_request_id: id,
            sequence: idx + 1,
          }));

      const payload: CreateTripPayload = {
        vehicle_id: selectedVehicleId,
        driver_user_id: selectedDriverId,
        stops,
      };

      await createTrip(payload);
      toast.success('Trip created successfully');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create trip';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-testid="trip-create-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🚛</span> Create Dispatch Trip
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Step 1: Vehicle & Driver */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Select Vehicle (Available)
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Choose Vehicle --</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} ({v.capacity_kg} kg - {v.fuel_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Assign Logistics Driver
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full rounded-xl bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Choose Driver --</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Route Suggestion trigger */}
        <div className="flex items-center justify-between bg-slate-800/40 rounded-xl p-3 border border-slate-800 mb-5">
          <div>
            <p className="text-sm font-semibold text-white">Smart Stream & Proximity Routing</p>
            <p className="text-xs text-slate-400">
              Auto-select compatible pickups and calculate shortest path
            </p>
          </div>
          <button
            type="button"
            disabled={!selectedVehicleId || isSuggesting}
            onClick={handleSuggestRoute}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-lg"
          >
            {isSuggesting ? 'Optimizing...' : '⚡ Suggest Route'}
          </button>
        </div>

        {/* Step 2: Unassigned Pickups list */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select Pickups ({selectedPickupIds.length} selected)
            </label>
            {activeStream && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                Locked Stream: {activeStream}
              </span>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800 bg-slate-950/50">
            {unassignedPickups.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No unassigned pickups available
              </div>
            ) : (
              unassignedPickups.map((p) => {
                const stream = getWasteStreamClass(p.category_id);
                const isSelected = selectedPickupIds.includes(p.id);
                const isConflict = activeStream !== null && activeStream !== stream;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isConflict && handleTogglePickup(p.id, stream)}
                    className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/40 border-l-4 border-emerald-500'
                        : isConflict
                        ? 'opacity-40 cursor-not-allowed bg-slate-900/30'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isConflict}
                        onChange={() => {}}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {p.supplier_name || 'Supplier'}
                        </p>
                        <p className="text-xs text-slate-400">
                          Pickup #{p.id.slice(0, 8)} • Stream:{' '}
                          <span className="font-semibold text-slate-300">{stream}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-white">
                        {p.declared_weight_kg ?? 0} kg
                      </span>
                      {isConflict && (
                        <p className="text-[10px] text-amber-400 font-medium">
                          Cannot mix with {activeStream}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Step 3: Capacity Bar */}
        {selectedVehicle && (
          <div className="mb-6 p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400 font-medium">Vehicle Payload Capacity:</span>
              <span
                className={`font-mono font-bold ${
                  isOverCapacity ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {totalWeightKg.toFixed(1)} / {capacityKg.toFixed(1)} kg (
                {capacityKg > 0 ? ((totalWeightKg / capacityKg) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isOverCapacity ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, capacityKg > 0 ? (totalWeightKg / capacityKg) * 100 : 0)}%`,
                }}
              />
            </div>
            {isOverCapacity && (
              <p className="text-xs text-rose-400 mt-2 font-medium">
                ⚠️ Warning: Selected pickups exceed this vehicle's max capacity!
              </p>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || isOverCapacity || selectedPickupIds.length === 0}
            onClick={handleCreate}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-900/30 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Creating Trip...' : 'Create & Dispatch'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TripCreateModal;
